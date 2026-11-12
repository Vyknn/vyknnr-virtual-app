import type { AgentRuntime, AgentStep, Cell, ChatMessage, Deliverable, Job, TaskNode } from './types';
import { ROSTER, agentById } from './roster';
import { OFFICE, deskOf, isWalkable } from './office';
import { findPath, nearestWalkable } from './pathfinding';
import { makePlan, pickAssignee, type PlanResult } from './planner';
import { makeSteps, makeDeliverable } from './steps';

// ---------------------------------------------------------------- public API

export interface SimState { t: number; agents: Record<string, AgentRuntime>; nodes: Record<string, TaskNode>; jobs: Record<string, Job>;
  chat: ChatMessage[]; seq: number; rngSeed: number; coreState: 'idle'|'thinking'|'dispatching' }
export type SimEvent =
  | { type: 'job.planned'; jobId: string } | { type: 'node.dispatched'; nodeId: string; agentId: string }
  | { type: 'node.started'; nodeId: string } | { type: 'step.appended'; nodeId: string; step: AgentStep }
  | { type: 'node.completed'; nodeId: string } | { type: 'handoff'; fromNodeId: string; toNodeId: string; fromAgentId: string; toAgentId: string }
  | { type: 'job.completed'; jobId: string } | { type: 'chat'; message: ChatMessage };

export const WALK_SPEED = 2.2;       // cells per sim second
export const PLANNING_TIME = 2.5;    // sim seconds Core spends "thinking"
export const DONE_TIME = 1.2;        // celebrate pause
export const MAX_SUBSTEP = 0.25;     // dt clamp per sub-step (Review Focus #4)
/** Max sim time consumed by a single tick() call. Larger dt (e.g. a backgrounded tab resuming) is dropped, not replayed,
 *  so one call never does more than 30 / MAX_SUBSTEP = 120 sub-steps. */
export const MAX_TICK_DT = 30;
/** Idle agents wander to another free lounge spot after WANDER_MIN..WANDER_MIN+WANDER_SPREAD s in place. */
export const WANDER_MIN = 8;
export const WANDER_SPREAD = 7;

export const JOB_COLORS = ['#22d3ee', '#f472b6', '#a3e635', '#facc15', '#c084fc', '#fb923c', '#34d399', '#60a5fa'];

/** mulberry32 PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- rng helpers
// Randomness is derived statelessly from (rngSeed, entity ids) instead of a shared advancing stream, so the outcome
// never depends on sub-step size or processing order (tick(10) == 100 x tick(0.1)). rngSeed is constant per game.

/** Stateless hash -> [0,1). */
function hash01(...xs: number[]): number {
  let h = 0x9e3779b9 | 0;
  for (const x of xs) {
    h = Math.imul(h ^ (x | 0), 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return (h >>> 0) / 4294967296;
}

const idNum = (id: string) => Number(id.slice(id.lastIndexOf('-') + 1)) || 0;
const nodeRng = (d: { s: SimState }, id: string, salt: number) => mulberry32(Math.floor(hash01(d.s.rngSeed, idNum(id), salt) * 4294967296));

const AGENT_INDEX = new Map(ROSTER.map((a, i) => [a.id, i]));
const W = OFFICE.width, D = OFFICE.depth;
const eq = (a: Cell, b: Cell) => a.x === b.x && a.z === b.z;
const manhattan = (a: Cell, b: Cell) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
const RACK_FACING = Math.atan2(0, -1); // racks sit at z-1 of their console

const PLAN_CACHE = new Map<string, PlanResult>();
function planOf(command: string): PlanResult {
  let p = PLAN_CACHE.get(command);
  if (!p) {
    if (PLAN_CACHE.size > 256) PLAN_CACHE.clear(); // bound memory; makePlan is pure so recomputing is safe
    p = makePlan(command); PLAN_CACHE.set(command, p);
  }
  return p;
}

// ---------------------------------------------------------------- draft (copy-on-write per call)

interface Draft {
  s: SimState;           // new top-level object; records below replaced lazily
  events: SimEvent[];
  agentsCopied: boolean; nodesCopied: boolean; jobsCopied: boolean; chatCopied: boolean;
  touchedAgents: Set<string>; touchedNodes: Set<string>; touchedJobs: Set<string>;
}

function begin(s: SimState): Draft {
  return { s: { ...s }, events: [], agentsCopied: false, nodesCopied: false, jobsCopied: false, chatCopied: false,
    touchedAgents: new Set(), touchedNodes: new Set(), touchedJobs: new Set() };
}
function finish(d: Draft): { state: SimState; events: SimEvent[] } {
  return { state: d.s, events: d.events };
}
/** Copy-on-write agent: cloned (with its own `pos`) on first write per tick; untouched agents keep identity.
 *  `path`, `queue` and `cell` are always replaced, never mutated in place, so a shallow copy is enough. */
function agentW(d: Draft, id: string): AgentRuntime {
  if (!d.agentsCopied) { d.s.agents = { ...d.s.agents }; d.agentsCopied = true; }
  if (!d.touchedAgents.has(id)) {
    const a = d.s.agents[id];
    d.s.agents[id] = { ...a, pos: { x: a.pos.x, z: a.pos.z } };
    d.touchedAgents.add(id);
  }
  return d.s.agents[id];
}
function nodeW(d: Draft, id: string): TaskNode {
  if (!d.nodesCopied) { d.s.nodes = { ...d.s.nodes }; d.nodesCopied = true; }
  if (!d.touchedNodes.has(id)) { d.s.nodes[id] = { ...d.s.nodes[id] }; d.touchedNodes.add(id); }
  return d.s.nodes[id];
}
function jobW(d: Draft, id: string): Job {
  if (!d.jobsCopied) { d.s.jobs = { ...d.s.jobs }; d.jobsCopied = true; }
  if (!d.touchedJobs.has(id)) { d.s.jobs[id] = { ...d.s.jobs[id] }; d.touchedJobs.add(id); }
  return d.s.jobs[id];
}
function say(d: Draft, at: number, from: string, text: string, extra: Partial<ChatMessage> = {}): void {
  if (!d.chatCopied) { d.s.chat = [...d.s.chat]; d.chatCopied = true; }
  const message: ChatMessage = { id: `M-${d.s.chat.length + 1}`, from, text, at, ...extra };
  d.s.chat.push(message);
  d.events.push({ type: 'chat', message });
}
const nextId = (d: Draft, prefix: string) => `${prefix}-${1000 + ++d.s.seq}`;

// ---------------------------------------------------------------- init / submit

export function createInitialState(seed = 1): SimState {
  const taken = new Set<string>();
  const agents: Record<string, AgentRuntime> = {};
  for (const a of ROSTER) {
    const spot = OFFICE.loungeSpots.find((l) => l.style === a.idleStyle && !taken.has(`${l.cell.x},${l.cell.z}`))
      ?? OFFICE.loungeSpots.find((l) => !taken.has(`${l.cell.x},${l.cell.z}`))!;
    taken.add(`${spot.cell.x},${spot.cell.z}`);
    agents[a.id] = { id: a.id, state: 'idle', cell: { ...spot.cell }, pos: { x: spot.cell.x, z: spot.cell.z }, path: [], heading: 0,
      currentNodeId: null, queue: [], doneToday: 0, stateTime: 0 };
  }
  return { t: 0, agents, nodes: {}, jobs: {}, chat: [], seq: 0, rngSeed: seed >>> 0, coreState: 'idle' };
}

export function submitCommand(s: SimState, text: string): { state: SimState; events: SimEvent[] } {
  const d = begin(s);
  say(d, s.t, 'admin', text);
  const plan = planOf(text);
  if (plan.intent === null) {
    say(d, s.t, 'core', plan.reply);
    return finish(d);
  }
  const id = nextId(d, 'JOB');
  const n = Object.keys(s.jobs).length;
  jobW(d, id);
  d.s.jobs[id] = { id, command: text, color: JOB_COLORS[n % JOB_COLORS.length], status: 'planning', nodeIds: [],
    createdAt: s.t, planningLeft: PLANNING_TIME, summary: null };
  d.s.coreState = 'thinking';
  say(d, s.t, 'core', 'AI Core กำลังวางแผน…', { jobId: id });
  streamReasoning(d, id, plan, 0, 0, s.t);
  return finish(d);
}

/** Reasoning line i is emitted when planning elapsed time reaches i * interval. */
function streamReasoning(d: Draft, jobId: string, plan: PlanResult, before: number, after: number, at: number) {
  const len = plan.reasoning.length;
  if (!len) return;
  const interval = PLANNING_TIME / len;
  const count = (e: number) => (e < 0 ? 0 : Math.min(len, Math.floor(e / interval + 1e-9) + 1));
  const from = before === 0 && after === 0 ? 0 : count(before);
  for (let i = from; i < count(after); i++) say(d, at, 'core', plan.reasoning[i], { jobId });
}

// ---------------------------------------------------------------- tick

export function tick(s: SimState, dt: number): { state: SimState; events: SimEvent[] } {
  if (!(dt > 0)) return { state: s, events: [] };
  const total = Math.min(dt, MAX_TICK_DT);
  const n = Math.ceil(total / MAX_SUBSTEP - 1e-9);
  const sub = total / n;
  const d = begin(s);
  for (let i = 0; i < n; i++) substep(d, sub);
  return finish(d);
}

/** Sub-step-size independence: agents carry leftover time across transitions and randomness is stateless, so each
 *  agent's own timeline is exact. Cross-agent coupling is quantised: dispatch (ready -> queue) runs only at sub-step
 *  boundaries and planning advances per sub-step, so tick(10) vs 100 x tick(0.1) can differ by up to one sub-step of
 *  latency per hand-off (position drift <= MAX_SUBSTEP * WALK_SPEED cells per hand-off). */
function substep(d: Draft, dt: number) {
  const t0 = d.s.t;
  planning(d, dt, t0);
  dispatch(d);
  for (const a of ROSTER) advanceAgent(d, a.id, dt, t0);
  dispatch(d);
  d.s.t = t0 + dt;
  updateCore(d);
}

function activeJobs(d: Draft): Job[] {
  const out: Job[] = [];
  for (const id in d.s.jobs) if (d.s.jobs[id].status !== 'done') out.push(d.s.jobs[id]);
  return out;
}

function updateCore(d: Draft) {
  const act = activeJobs(d);
  const cs = act.some((j) => j.status === 'planning') ? 'thinking' : act.length ? 'dispatching' : 'idle';
  if (cs !== d.s.coreState) d.s.coreState = cs;
}

// ---- planning

function planning(d: Draft, dt: number, t0: number) {
  for (const j0 of activeJobs(d)) {
    if (j0.status !== 'planning') continue;
    const job = jobW(d, j0.id);
    const plan = planOf(job.command);
    const before = PLANNING_TIME - job.planningLeft;
    job.planningLeft = Math.max(0, job.planningLeft - dt);
    streamReasoning(d, job.id, plan, before, PLANNING_TIME - job.planningLeft, t0 + dt);
    if (job.planningLeft <= 0) materialize(d, job, plan, t0 + dt);
  }
}

/** Agents view used for assignment: anyone with work queued/in hand counts as busy. */
function assignView(d: Draft): Record<string, AgentRuntime> {
  const v: Record<string, AgentRuntime> = {};
  for (const id in d.s.agents) {
    const a = d.s.agents[id];
    const busy = a.state === 'walking_to_work' || a.state === 'working' || a.queue.length > 0 || a.currentNodeId !== null;
    v[id] = busy && a.state === 'idle' ? { ...a, state: 'walking_to_work' } : a;
  }
  return v;
}

function materialize(d: Draft, job: Job, plan: PlanResult, at: number) {
  const ids = new Map<string, string>();
  for (const pn of plan.nodes) ids.set(pn.key, nextId(d, 'T'));
  const view = assignView(d);
  const nodeIds: string[] = [];
  for (const pn of plan.nodes) {
    const id = ids.get(pn.key)!;
    nodeW(d, id);
    d.s.nodes[id] = { id, jobId: job.id, title: pn.title, skill: pn.skill,
      assigneeId: pn.assigneeId ?? pickAssignee(pn.skill, job.command, view), pinned: pn.assigneeId !== undefined,
      dependsOn: pn.dependsOn.map((k) => ids.get(k)!), status: pn.dependsOn.length ? 'blocked' : 'ready', workplace: pn.workplace,
      steps: [], stepIndex: 0, stepElapsed: 0, inputs: [], output: null };
    nodeIds.push(id);
  }
  job.nodeIds = nodeIds;
  job.status = 'running';
  d.events.push({ type: 'job.planned', jobId: job.id });
  say(d, at, 'core', plan.reply, { jobId: job.id });
}

// ---- dispatch

function dispatch(d: Draft) {
  for (const job of activeJobs(d)) {
    if (job.status !== 'running') continue;
    for (const nid of job.nodeIds) {
      if (d.s.nodes[nid].status !== 'ready') continue;
      const node = nodeW(d, nid);
      const view = assignView(d);
      if (!node.pinned && view[node.assigneeId].state !== 'idle') {
        // Prefer reassignment to a free owner of the same skill (spec §9.2 step 3).
        const alt = pickAssignee(node.skill, job.command, view);
        if (view[alt].state === 'idle') node.assigneeId = alt;
      }
      const a = agentW(d, node.assigneeId);
      a.queue = [...a.queue, nid];
      node.status = 'queued';
      d.events.push({ type: 'node.dispatched', nodeId: nid, agentId: a.id });
    }
  }
}

// ---- agents

/** Max state transitions per agent per sub-step. A legitimate sub-step needs only a handful (finish walk, arrive,
 *  finish step, next step, ..., complete, done pause). Every iteration either returns (budget consumed) or performs one
 *  transition that advances the agent's timeline, so hitting this bound means a logic bug (a zero-time transition
 *  cycle), not a slow agent. */
const MAX_AGENT_TRANSITIONS = 64;

/** Advance one agent by `budget` seconds of its own timeline; leftover time carries across state transitions
 *  so results do not depend on sub-step size. `stateTime` is the absolute sim time the current state began, so
 *  waiting (idle in place, done pause) and mid-step work never write to the agent, which keeps its object identity. */
function advanceAgent(d: Draft, id: string, budget: number, t0: number) {
  const total = budget;
  let a = d.s.agents[id];
  const w = () => (a = agentW(d, id));
  for (let guard = 0; budget > 1e-12; guard++) {
    if (guard >= MAX_AGENT_TRANSITIONS) {
      if (process.env.NODE_ENV !== 'production')
        throw new Error(`sim: agent ${id} exceeded ${MAX_AGENT_TRANSITIONS} transitions in one sub-step (state ${a.state})`);
      return; // production: drop the rest of this sub-step instead of hanging the frame
    }
    const now = t0 + (total - budget);
    switch (a.state) {
      case 'idle':
      case 'walking_to_lounge': {
        if (a.queue.length) { w(); startWalkToWork(d, a, now); continue; }
        if (a.path.length) {
          w();
          budget = move(a, budget);
          if (!a.path.length) { a.state = 'idle'; a.stateTime = t0 + (total - budget); }
          continue;
        }
        if (a.state === 'walking_to_lounge') { w(); a.state = 'idle'; a.stateTime = now; continue; }
        // Wander decisions happen only on whole-second sim-time boundaries, so agents contending for the same free
        // spot resolve in the same (roster) order regardless of sub-step size.
        const last = Math.floor(now + budget + 1e-9);
        const due = Math.max(Math.floor(now + 1e-9) + 1, Math.ceil(a.stateTime + wanderThreshold(d, a) - 1e-9));
        if (due > last) return;
        budget -= due - now;
        w();
        a.stateTime = due;
        startWander(d, a);
        if (!a.path.length) return; // nowhere free: keep standing, retry after another threshold
        continue;
      }
      case 'walking_to_work': {
        w();
        budget = move(a, budget);
        if (!a.path.length) arriveAtWork(d, a, t0 + (total - budget));
        continue;
      }
      case 'working': {
        const node = nodeW(d, a.currentNodeId!);
        const step = node.steps[node.stepIndex];
        const left = step.duration - node.stepElapsed;
        if (left > budget) { node.stepElapsed += budget; return; }
        budget -= Math.max(0, left);
        node.stepIndex += 1;
        node.stepElapsed = 0;
        const at = t0 + (total - budget);
        if (node.stepIndex < node.steps.length) {
          node.steps = node.steps.slice();
          node.steps[node.stepIndex] = { ...node.steps[node.stepIndex], at };
          d.events.push({ type: 'step.appended', nodeId: node.id, step: node.steps[node.stepIndex] });
        } else { w(); completeNode(d, a, node, at); }
        continue;
      }
      case 'done': {
        const left = a.stateTime + DONE_TIME - now;
        if (left > budget) return;
        budget -= Math.max(0, left);
        const at = t0 + (total - budget);
        w();
        if (a.queue.length) startWalkToWork(d, a, at);
        else startWalkToLounge(d, a, at);
        continue;
      }
    }
  }
}

/** Move along path; returns leftover time once the path is exhausted (0 if still walking). */
function move(a: AgentRuntime, budget: number): number {
  while (budget > 0 && a.path.length) {
    const next = a.path[0];
    const dx = next.x - a.pos.x, dz = next.z - a.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0) a.heading = Math.atan2(dx, dz);
    const reach = WALK_SPEED * budget;
    if (dist <= reach + 1e-9) {
      a.pos.x = next.x; a.pos.z = next.z;
      a.cell = next;
      a.path = a.path.slice(1);
      budget -= dist / WALK_SPEED;
    } else {
      a.pos.x += (dx / dist) * reach;
      a.pos.z += (dz / dist) * reach;
      budget = 0;
    }
  }
  return Math.max(0, budget);
}

/** Path from the agent's current location; if mid-segment, finish the segment first so it never cuts corners.
 *  Unreachable target (Review Focus #5): retry with nearestWalkable(target); if that is unreachable too, use the
 *  reachable cell closest to the target. The path's last cell becomes the work/rest cell, so the agent never freezes. */
export function routeTo(a: Pick<AgentRuntime, 'pos' | 'cell' | 'path'>, target: Cell, walk: (c: Cell) => boolean = isWalkable): Cell[] {
  const mid = a.pos.x !== a.cell.x || a.pos.z !== a.cell.z;
  const start = mid && a.path.length ? a.path[0] : a.cell;
  let rest = findPath(start, target, walk, W, D);
  if (!rest) {
    const near = nearestWalkable(target, walk, W, D);
    if (near) rest = findPath(start, near, walk, W, D);
  }
  if (!rest) rest = findPath(start, closestReachable(start, target, walk), walk, W, D) ?? [];
  return mid && a.path.length ? [a.path[0], ...rest] : rest;
}

/** BFS flood from `start`; the reachable cell with minimal Manhattan distance to `target` (ties: BFS order). */
function closestReachable(start: Cell, target: Cell, walk: (c: Cell) => boolean): Cell {
  const seen = new Set<number>([start.z * W + start.x]);
  let best = start, bestD = manhattan(start, target);
  const queue: Cell[] = [start];
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i];
    const dist = manhattan(c, target);
    if (dist < bestD) { best = c; bestD = dist; }
    for (const [dx, dz] of NEIGHBOURS) {
      const n = { x: c.x + dx, z: c.z + dz };
      const k = n.z * W + n.x;
      if (seen.has(k) || !walk(n)) continue;
      seen.add(k);
      queue.push(n);
    }
  }
  return best;
}
const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

function destination(a: AgentRuntime): Cell { return a.path.length ? a.path[a.path.length - 1] : a.cell; }

/** Cells held by other agents: where they stand (if stationary) or are heading. Walkers' transient cells are not
 *  held — they are leaving them, and including them would make decisions depend on sub-step size. */
function heldCells(d: Draft, except: string): Set<number> {
  const held = new Set<number>();
  for (const id in d.s.agents) {
    if (id === except) continue;
    const c = destination(d.s.agents[id]);
    held.add(c.z * W + c.x);
  }
  return held;
}

function workTarget(d: Draft, a: AgentRuntime, node: TaskNode): Cell {
  if (node.workplace === 'desk') return deskOf(a.id).seat;
  const held = heldCells(d, a.id);
  let best: Cell | null = null;
  for (const c of OFFICE.rackConsoles) {
    if (held.has(c.z * W + c.x)) continue;
    if (!best || manhattan(a.cell, c) < manhattan(a.cell, best)) best = c;
  }
  return best ?? nearestWalkable(OFFICE.rackConsoles[0], isWalkable, W, D)!;
}

function startWalkToWork(d: Draft, a: AgentRuntime, at: number) {
  const node = d.s.nodes[a.queue[0]];
  a.state = 'walking_to_work';
  a.stateTime = at;
  a.path = routeTo(a, workTarget(d, a, node));
  const voice = agentById(a.id).voice.accept;
  say(d, at, a.id, voice[Math.floor(hash01(d.s.rngSeed, idNum(node.id), 11) * voice.length)], { jobId: node.jobId });
}

function arriveAtWork(d: Draft, a: AgentRuntime, at: number) {
  const nid = a.queue[0];
  a.queue = a.queue.slice(1);
  a.currentNodeId = nid;
  a.state = 'working';
  a.stateTime = at;
  const node = nodeW(d, nid);
  a.heading = node.workplace === 'desk' ? deskOf(a.id).facing : RACK_FACING;
  const steps = makeSteps(node, agentById(a.id), nodeRng(d, nid, 1));
  node.steps = steps.map((st) => ({ ...st, at: at + st.at }));
  node.stepIndex = 0;
  node.stepElapsed = 0;
  node.status = 'running';
  d.events.push({ type: 'node.started', nodeId: nid });
  d.events.push({ type: 'step.appended', nodeId: nid, step: node.steps[0] });
}

function completeNode(d: Draft, a: AgentRuntime, node: TaskNode, at: number) {
  node.status = 'done';
  node.output = makeDeliverable(node.skill, node.title, nodeRng(d, node.id, 2));
  a.currentNodeId = null;
  a.state = 'done';
  a.stateTime = at;
  a.doneToday += 1;
  d.events.push({ type: 'node.completed', nodeId: node.id });
  const voice = agentById(a.id).voice.done;
  say(d, at, a.id, voice[Math.floor(hash01(d.s.rngSeed, idNum(node.id), 12) * voice.length)], { jobId: node.jobId });

  const job = d.s.jobs[node.jobId];
  for (const did of job.nodeIds) {
    const dep = d.s.nodes[did];
    if (dep.status !== 'blocked' || !dep.dependsOn.includes(node.id)) continue;
    if (!dep.dependsOn.every((p) => d.s.nodes[p].status === 'done')) continue;
    const w = nodeW(d, did);
    w.status = 'ready';
    w.inputs = dep.dependsOn.map((p) => d.s.nodes[p].title);
    for (const p of dep.dependsOn)
      d.events.push({ type: 'handoff', fromNodeId: p, toNodeId: did, fromAgentId: d.s.nodes[p].assigneeId, toAgentId: w.assigneeId });
  }
  if (job.nodeIds.every((id) => d.s.nodes[id].status === 'done')) completeJob(d, job.id, at);
}

function completeJob(d: Draft, jobId: string, at: number) {
  const job = jobW(d, jobId);
  job.status = 'done';
  const nodes = job.nodeIds.map((id) => d.s.nodes[id]);
  const rep = nodes.find((n) => n.output?.kind === 'code') ?? nodes[nodes.length - 1];
  const lines = nodes.map((n) => `• ${n.title} — ${agentById(n.assigneeId).name} (${describe(n.output!)})`);
  job.summary = `${job.id} เสร็จเรียบร้อย ส่งมอบ ${nodes.length} รายการ:\n${lines.join('\n')}`;
  d.events.push({ type: 'job.completed', jobId });
  say(d, at, 'core', job.summary, { jobId, deliverable: rep.output! });
}

function describe(o: Deliverable): string {
  switch (o.kind) {
    case 'code': return o.files.join(', ');
    case 'image': return `ภาพ ${o.title}`;
    case 'numbers': return `${o.rows.length} แถวตัวเลข`;
    case 'text': return o.text;
  }
}

// ---- lounge

function freeLoungeSpots(d: Draft, a: AgentRuntime): { cell: Cell; style: string }[] {
  const held = heldCells(d, a.id);
  return OFFICE.loungeSpots.filter((l) => !held.has(l.cell.z * W + l.cell.x));
}

function startWalkToLounge(d: Draft, a: AgentRuntime, at: number) {
  const style = agentById(a.id).idleStyle;
  const free = freeLoungeSpots(d, a);
  const pool = free.some((l) => l.style === style) ? free.filter((l) => l.style === style) : free;
  let best = pool[0]?.cell ?? nearestWalkable(OFFICE.loungeSpots[0].cell, isWalkable, W, D)!;
  for (const l of pool) if (manhattan(a.cell, l.cell) < manhattan(a.cell, best)) best = l.cell;
  a.state = 'walking_to_lounge';
  a.stateTime = at;
  a.path = routeTo(a, best);
}

function wanderThreshold(d: Draft, a: AgentRuntime): number {
  return WANDER_MIN + WANDER_SPREAD * hash01(d.s.rngSeed, AGENT_INDEX.get(a.id)!, a.cell.x, a.cell.z, a.doneToday);
}

function startWander(d: Draft, a: AgentRuntime) {
  const style = agentById(a.id).idleStyle;
  const free = freeLoungeSpots(d, a).filter((l) => !eq(l.cell, a.cell));
  if (!free.length) return;
  const i = AGENT_INDEX.get(a.id)!;
  const same = free.filter((l) => l.style === style);
  const pool = same.length && hash01(d.s.rngSeed, i, a.cell.x, a.cell.z, 1) < 0.6 ? same : free;
  const pick = pool[Math.floor(hash01(d.s.rngSeed, i, a.cell.x, a.cell.z, 2) * pool.length)];
  a.path = routeTo(a, pick.cell);
}
