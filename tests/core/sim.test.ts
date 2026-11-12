import { describe, it, expect } from 'vitest';
import { createInitialState, submitCommand, tick, routeTo, MAX_SUBSTEP, type SimState, type SimEvent } from '@/core/sim';
import { OFFICE, deskOf, isWalkable } from '@/core/office';
import { findPath, nearestWalkable } from '@/core/pathfinding';
import { ROSTER } from '@/core/roster';

const DT = 0.1;

interface RunResult { state: SimState; events: SimEvent[]; ok: boolean; elapsed: number }
/** Ticks 0.1 s until pred(state) holds or maxSimSeconds pass. onTick sees every intermediate state. */
function runUntil(state: SimState, pred: (s: SimState) => boolean, maxSimSeconds: number,
  onTick?: (s: SimState, ev: SimEvent[]) => void): RunResult {
  const events: SimEvent[] = [];
  let s = state, elapsed = 0;
  const steps = Math.round(maxSimSeconds / DT);
  for (let i = 0; i < steps; i++) {
    if (pred(s)) return { state: s, events, ok: true, elapsed };
    const r = tick(s, DT);
    s = r.state; elapsed += DT;
    events.push(...r.events);
    onTick?.(s, r.events);
  }
  return { state: s, events, ok: pred(s), elapsed };
}

const submit = (s: SimState, text: string) => submitCommand(s, text).state;
const jobsOf = (s: SimState) => Object.values(s.jobs);
const allJobsDone = (s: SimState) => jobsOf(s).length > 0 && jobsOf(s).every((j) => j.status === 'done');
const roundCell = (p: { x: number; z: number }) => ({ x: Math.round(p.x), z: Math.round(p.z) });

describe('createInitialState', () => {
  it('19 idle agents on distinct walkable cells', () => {
    const s = createInitialState();
    const agents = Object.values(s.agents);
    expect(agents.length).toBe(19);
    expect(new Set(agents.map((a) => a.id))).toEqual(new Set(ROSTER.map((a) => a.id)));
    for (const a of agents) {
      expect(a.state).toBe('idle');
      expect(isWalkable(a.cell)).toBe(true);
      expect(a.pos).toEqual({ x: a.cell.x, z: a.cell.z });
    }
    expect(new Set(agents.map((a) => `${a.cell.x},${a.cell.z}`)).size).toBe(19);
    expect(s.coreState).toBe('idle');
  });
});

describe('submitCommand', () => {
  it('unknown command: admin + Core reply only, no job', () => {
    const { state } = submitCommand(createInitialState(), 'สวัสดี');
    expect(Object.keys(state.jobs).length).toBe(0);
    expect(state.chat.map((m) => m.from)).toEqual(['admin', 'core']);
    expect(state.chat[0].text).toBe('สวัสดี');
  });

  it('known command creates planning job and Core thinks', () => {
    const { state } = submitCommand(createInitialState(), 'ทำ API login ให้เกม Space Run');
    const jobs = jobsOf(state);
    expect(jobs.length).toBe(1);
    expect(jobs[0].id).toBe('JOB-1001');
    expect(jobs[0].status).toBe('planning');
    expect(state.coreState).toBe('thinking');
  });

  it('does not mutate the input state', () => {
    const s0 = createInitialState();
    const chat0 = s0.chat;
    submitCommand(s0, 'ทำ API login');
    expect(s0.chat).toBe(chat0);
    expect(s0.chat.length).toBe(0);
    expect(Object.keys(s0.jobs).length).toBe(0);
  });
});

describe('API login flow', () => {
  it('plans, dispatches nara then beam, completes with code summary', () => {
    let s = submit(createInitialState(), 'ทำ API login ให้เกม Space Run');
    const all: SimEvent[] = [];

    let r = runUntil(s, (x) => jobsOf(x)[0].nodeIds.length === 2, 3);
    expect(r.ok).toBe(true);
    all.push(...r.events); s = r.state;
    const job = jobsOf(s)[0];
    expect(job.status).toBe('running');
    expect(job.nodeIds.every((id) => /^T-\d{4}$/.test(id))).toBe(true);
    expect(s.nodes[job.nodeIds[0]].assigneeId).toBe('nara');
    expect(s.nodes[job.nodeIds[1]].assigneeId).toBe('beam');
    expect(s.nodes[job.nodeIds[1]].status).toBe('blocked');

    r = runUntil(s, (x) => x.agents.nara.state === 'working', 60);
    expect(r.ok).toBe(true);
    all.push(...r.events); s = r.state;
    const seat = deskOf('nara').seat;
    expect(s.agents.nara.cell).toEqual(seat);
    expect(s.agents.nara.pos.x).toBeCloseTo(seat.x, 6);
    expect(s.agents.nara.pos.z).toBeCloseTo(seat.z, 6);
    expect(s.agents.nara.heading).toBeCloseTo(deskOf('nara').facing, 6);
    expect(s.agents.nara.currentNodeId).toBe(job.nodeIds[0]);
    expect(s.nodes[job.nodeIds[0]].status).toBe('running');

    r = runUntil(s, (x) => x.jobs[job.id].status === 'done'
      && x.agents.nara.state === 'idle' && x.agents.beam.state === 'idle', 200);
    expect(r.ok).toBe(true);
    all.push(...r.events); s = r.state;

    const handoffs = all.filter((e) => e.type === 'handoff');
    expect(handoffs).toHaveLength(1);
    expect(handoffs[0]).toMatchObject({ fromAgentId: 'nara', toAgentId: 'beam', fromNodeId: job.nodeIds[0], toNodeId: job.nodeIds[1] });
    expect(all.filter((e) => e.type === 'job.completed')).toHaveLength(1);
    expect(s.nodes[job.nodeIds[1]].inputs).toContain(s.nodes[job.nodeIds[0]].title);

    const summary = s.chat.find((m) => m.from === 'core' && m.jobId === job.id && m.deliverable);
    expect(summary?.deliverable?.kind).toBe('code');
    expect(s.jobs[job.id].summary).toBeTruthy();
    expect(s.agents.nara.doneToday).toBe(1);
    expect(s.agents.beam.doneToday).toBe(1);
    // steps progressed fully
    for (const id of job.nodeIds) {
      const n = s.nodes[id];
      expect(n.stepIndex).toBe(n.steps.length);
      expect(n.steps[n.steps.length - 1].kind).toBe('output');
      expect(n.output).not.toBeNull();
    }
    // agent voice lines appear
    expect(s.chat.some((m) => m.from === 'nara')).toBe(true);
    expect(s.chat.some((m) => m.from === 'beam')).toBe(true);
    // step.appended events cover all steps of both nodes
    const appended = all.filter((e) => e.type === 'step.appended').length;
    expect(appended).toBe(job.nodeIds.reduce((t, id) => t + s.nodes[id].steps.length, 0));
  });
});

describe('new game', () => {
  it('finishes within 600 s, approve last, >=4 working at once', () => {
    let s = submit(createInitialState(), 'ทำเกมใหม่');
    let maxWorking = 0;
    const r = runUntil(s, allJobsDone, 600, (x) => {
      let n = 0;
      for (const a of Object.values(x.agents)) if (a.state === 'working') n++;
      if (n > maxWorking) maxWorking = n;
    });
    expect(r.ok).toBe(true);
    s = r.state;
    const job = jobsOf(s)[0];
    expect(job.nodeIds.length).toBe(10);
    const approveId = job.nodeIds.find((id) => s.nodes[id].skill === 'approve')!;
    const startIdx = r.events.findIndex((e) => e.type === 'node.started' && e.nodeId === approveId);
    expect(startIdx).toBeGreaterThan(-1);
    for (const id of job.nodeIds) {
      if (id === approveId) continue;
      const ci = r.events.findIndex((e) => e.type === 'node.completed' && e.nodeId === id);
      expect(ci).toBeGreaterThan(-1);
      expect(ci).toBeLessThan(startIdx);
    }
    expect(maxWorking).toBeGreaterThanOrEqual(4);
  });
});

describe('Review Focus #3: concurrency invariants', () => {
  it('three API login jobs: one running node per agent, queueing, all done', () => {
    let s = createInitialState();
    for (let i = 0; i < 3; i++) s = submit(s, 'ทำ api login');
    expect(jobsOf(s).map((j) => j.id)).toEqual(['JOB-1001', 'JOB-1002', 'JOB-1003']);
    let sawQueuedWriteCode = false;
    const violations: string[] = [];
    const r = runUntil(s, allJobsDone, 900, (x) => {
      const running = Object.values(x.nodes).filter((n) => n.status === 'running');
      const perAgent = new Map<string, number>();
      for (const n of running) perAgent.set(n.assigneeId, (perAgent.get(n.assigneeId) ?? 0) + 1);
      for (const [id, c] of perAgent) if (c > 1) violations.push(`${x.t}: ${id} runs ${c}`);
      for (const a of Object.values(x.agents)) {
        if (a.currentNodeId && x.nodes[a.currentNodeId]?.status !== 'running') violations.push(`${x.t}: ${a.id} -> ${a.currentNodeId}`);
        if (a.currentNodeId && x.nodes[a.currentNodeId].assigneeId !== a.id) violations.push(`${x.t}: ${a.id} not assignee`);
      }
      if (Object.values(x.nodes).some((n) => n.skill === 'write_code' && n.status === 'queued')) sawQueuedWriteCode = true;
    });
    expect(violations).toEqual([]);
    expect(sawQueuedWriteCode).toBe(true);
    expect(r.ok).toBe(true);
    expect(r.events.filter((e) => e.type === 'job.completed')).toHaveLength(3);
    const writers = new Set(Object.values(r.state.nodes).filter((n) => n.skill === 'write_code').map((n) => n.assigneeId));
    expect([...writers].every((id) => id === 'nara' || id === 'nont')).toBe(true);
  });
});

describe('Review Focus #4: dt clamp and walk safety', () => {
  it('tick(10) == 100 x tick(0.1) positions; never on blocked cells', () => {
    let s = submit(createInitialState(), 'ทำ API login ให้เกม Space Run');
    const pre = runUntil(s, (x) => x.agents.nara.state === 'walking_to_work', 10);
    expect(pre.ok).toBe(true);
    s = pre.state;

    const big = tick(s, 10).state;
    let small = s;
    for (let i = 0; i < 100; i++) {
      small = tick(small, 0.1).state;
      for (const a of Object.values(small.agents)) {
        const c = roundCell(a.pos);
        if (!isWalkable(c)) throw new Error(`${a.id} on blocked ${c.x},${c.z} at t=${small.t}`);
      }
    }
    expect(big.t).toBeCloseTo(small.t, 6);
    for (const id of Object.keys(s.agents)) {
      expect(Math.abs(big.agents[id].pos.x - small.agents[id].pos.x)).toBeLessThan(0.01);
      expect(Math.abs(big.agents[id].pos.z - small.agents[id].pos.z)).toBeLessThan(0.01);
      expect(big.agents[id].state).toBe(small.agents[id].state);
    }
  });

  it('agent positions never on blocked cells across a whole new-game run (fine-grained)', () => {
    const s = submit(createInitialState(7), 'ทำเกมใหม่');
    const bad: string[] = [];
    runUntil(s, allJobsDone, 600, (x) => {
      for (const a of Object.values(x.agents)) {
        const c = roundCell(a.pos);
        if (!isWalkable(c)) bad.push(`${a.id}@${c.x},${c.z}`);
        if (!isWalkable(a.cell)) bad.push(`${a.id} cell ${a.cell.x},${a.cell.z}`);
      }
    });
    expect(bad).toEqual([]);
  });

  it('huge dt is capped and split into <= MAX_SUBSTEP sub-steps', () => {
    const s = createInitialState();
    const r = tick(s, 1e6);
    expect(r.state.t).toBeLessThanOrEqual(30 + 1e-9);
    expect(r.state.t).toBeGreaterThan(0);
    expect(MAX_SUBSTEP).toBe(0.25);
    expect(tick(s, 0).state.t).toBe(0);
    expect(tick(s, -5).state.t).toBe(0);
  });
});

describe('rack workplace', () => {
  it('deploy node is worked at a rack console', () => {
    let s = submit(createInitialState(), 'deploy server ใหม่');
    const r = runUntil(s, (x) => {
      const n = Object.values(x.nodes)[0];
      return !!n && x.agents[n.assigneeId].state === 'working';
    }, 120);
    expect(r.ok).toBe(true);
    s = r.state;
    const n = Object.values(s.nodes)[0];
    expect(n.workplace).toBe('rack');
    const cell = s.agents[n.assigneeId].cell;
    expect(OFFICE.rackConsoles.some((c) => c.x === cell.x && c.z === cell.z)).toBe(true);
  });
});

describe('immutability + determinism', () => {
  it('tick does not mutate input; unchanged jobs keep identity', () => {
    let s = submit(createInitialState(), 'ทำ API login');
    s = runUntil(s, (x) => x.agents.nara.state === 'walking_to_work', 10).state;
    const snap = JSON.stringify(s);
    const r = tick(s, 0.1);
    expect(JSON.stringify(s)).toBe(snap);
    expect(r.state).not.toBe(s);
    expect(r.state.agents).not.toBe(s.agents); // nara is walking
    expect(r.state.jobs).toBe(s.jobs);
  });

  it('same seed + same inputs -> identical states', () => {
    const run = () => runUntil(submit(createInitialState(3), 'ทำ API login'), () => false, 60).state;
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });

  it('idle agents wander occasionally to free lounge spots', () => {
    const r = runUntil(createInitialState(), () => false, 60);
    const moved = Object.values(r.state.agents).filter((a) => {
      const a0 = createInitialState().agents[a.id];
      return a.cell.x !== a0.cell.x || a.cell.z !== a0.cell.z;
    });
    expect(moved.length).toBeGreaterThan(0);
    for (const a of Object.values(r.state.agents)) expect(a.state).toBe('idle');
    const spots = new Set(OFFICE.loungeSpots.map((l) => `${l.cell.x},${l.cell.z}`));
    const settled = Object.values(r.state.agents).filter((a) => a.path.length === 0);
    for (const a of settled) expect(spots.has(`${a.cell.x},${a.cell.z}`)).toBe(true);
    expect(new Set(settled.map((a) => `${a.cell.x},${a.cell.z}`)).size).toBe(settled.length);
  });
});

describe('Review Focus #5: unreachable targets never freeze an agent', () => {
  /** Temporarily mark cells blocked in the shared OFFICE grid; always restored. */
  function withBlocked<T>(cells: { x: number; z: number }[], fn: () => T): T {
    const prev = cells.map((c) => OFFICE.blocked[c.z][c.x]);
    cells.forEach((c) => { OFFICE.blocked[c.z][c.x] = true; });
    try { return fn(); } finally { cells.forEach((c, i) => { OFFICE.blocked[c.z][c.x] = prev[i]; }); }
  }

  it('blocked desk seat: agent works at nearestWalkable(seat) instead', () => {
    const seat = deskOf('nara').seat;
    withBlocked([seat], () => {
      const near = nearestWalkable(seat, isWalkable, OFFICE.width, OFFICE.depth)!;
      expect(near).not.toEqual(seat);
      const s = submit(createInitialState(), 'ทำ API login ให้เกม Space Run');
      const r = runUntil(s, (x) => x.agents.nara.state === 'working', 60);
      expect(r.ok).toBe(true);
      expect(r.state.agents.nara.cell).toEqual(near);
      const done = runUntil(r.state, allJobsDone, 300);
      expect(done.ok).toBe(true);
    });
  });

  it('routeTo: enclosed walkable target falls back to the closest reachable cell', () => {
    const target = { x: 20, z: 5 };
    const ring = [{ x: 19, z: 5 }, { x: 21, z: 5 }, { x: 20, z: 4 }, { x: 20, z: 6 }];
    const walk = (c: { x: number; z: number }) => isWalkable(c) && !ring.some((r) => r.x === c.x && r.z === c.z);
    const from = { x: 14, z: 15 };
    expect(findPath(from, target, walk, OFFICE.width, OFFICE.depth)).toBeNull();
    const path = routeTo({ pos: { ...from }, cell: from, path: [] }, target, walk);
    expect(path.length).toBeGreaterThan(0);
    const end = path[path.length - 1];
    expect(walk(end)).toBe(true);
    expect(Math.abs(end.x - target.x) + Math.abs(end.z - target.z)).toBeLessThanOrEqual(2);
  });
});

describe('agent copy-on-write', () => {
  it('an agent standing idle keeps object identity across a small tick; a walker does not', () => {
    let s = submit(createInitialState(), 'ทำ API login');
    s = runUntil(s, (x) => x.agents.nara.state === 'walking_to_work', 10).state;
    const r = tick(s, 0.1).state;
    const still = Object.values(s.agents).filter((a) => a.state === 'idle' && a.path.length === 0 && a.queue.length === 0
      && r.agents[a.id].cell.x === a.cell.x && r.agents[a.id].cell.z === a.cell.z && r.agents[a.id].path.length === 0);
    expect(still.length).toBeGreaterThan(0);
    for (const a of still) expect(r.agents[a.id]).toBe(a);
    expect(r.agents.nara).not.toBe(s.agents.nara);
    expect(s.agents.nara.pos).not.toBe(r.agents.nara.pos);
  });

  it('a fully idle office with nobody due to wander keeps the agents record identity', () => {
    const s = createInitialState();
    const r = tick(s, 0.1).state;
    expect(r.agents).toBe(s.agents);
  });
});
