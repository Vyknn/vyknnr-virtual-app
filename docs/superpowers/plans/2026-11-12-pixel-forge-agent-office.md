# Pixel Forge Agent Orchestrator Office — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Next.js app that shows an isometric, futuristic 3D game-studio office where a holographic "AI Core" orchestrator plans chat commands into task DAGs and 19 named AI agents walk to desks / server racks, run a mock agent loop, hand off outputs, and return to the lounge.

**Architecture:** Pure TypeScript domain core (`src/core/`: roster, office grid + A*, planner, simulation reducer) with no React/three imports, fully unit-tested. A `MockOrchestratorService` drives the core on a simulation clock in the browser and emits events into a zustand store. React UI panels and a react-three-fiber scene only read the store and call the service interface.

**Tech Stack:** Node 22, Next.js 16 (App Router, TypeScript, `src/` dir), React 19, Tailwind CSS 4, three 0.187, @react-three/fiber 9, @react-three/drei 10, @react-three/postprocessing 3, zustand 5, vitest 5.

**Spec:** `docs/superpowers/specs/2026-11-12-pixel-forge-agent-office-design.md`

## Global Constraints

- Simulation only: no LLM calls, no DB, no persistence; reload = reset.
- No external 3D models, images, or audio files; all geometry/textures procedural.
- Isometric `OrthographicCamera`: yaw 45°, pitch ≈ 35.264°; pan (drag), zoom (wheel), rotate in 90° steps (buttons + Q/E).
- UI copy Thai-first; codes/technical terms in English. `<html lang="th">`. Fonts: Inter + Noto Sans Thai (Google Fonts via `next/font/google`).
- Glassmorphism light panels mirroring `image.png`; futuristic office (neon cyan/blue/violet accents, glossy floor, bloom).
- 19 agents exactly as in spec §6 (ids lowercase names).
- `src/core/**` must not import `react`, `three`, `next`, or `zustand`.
- Scene must be client-only: loaded through `dynamic(..., { ssr: false })`.
- Target ≥ 50 FPS on a typical laptop: instancing for repeated furniture/racks; bloom only on emissive materials.

## Review Focus

1. Empty / whitespace / unmatched command → Core replies "ขอรายละเอียดเพิ่ม" in chat, no job created, nothing crashes. (Task 4 test)
2. Thai text has no spaces → keywords match by lowercase substring, so "ทำapi loginให้เกม" still routes to backend. (Task 4 test)
3. Two concurrent jobs that need the same agent → second node queues on that agent and starts when the first finishes; no agent ever holds two running nodes. (Task 5 test)
4. Sim speed change or tab hidden mid-run → large `dt` is clamped (max 0.25 s sim per tick sub-step) so agents don't teleport through walls or skip states. (Task 5 test)
5. Unreachable target cell (blocked by furniture) → pathfinder returns `null` and the sim falls back to the nearest walkable neighbor of the target; agent never freezes. (Task 3 + Task 5 tests)

---

## File Structure

```
src/
  core/                       pure domain (unit tested)
    types.ts                  all shared types
    roster.ts                 19 agents, skills, tools, keywords, personalities
    office.ts                 grid layout: zones, desks, seats, racks, lounge, core
    pathfinding.ts            A* on grid
    planner.ts                intent scoring, templates, plan DAG, assignee pick
    steps.ts                  mock agent-loop step generator + mock deliverables
    sim.ts                    simulation reducer: tick(), submitCommand()
  services/
    orchestrator.ts           OrchestratorService interface + event types
    mockOrchestrator.ts       MockOrchestratorService (sim clock, emits events)
  store/
    useOfficeStore.ts         zustand store fed by service events
  scene/
    OfficeScene.tsx           Canvas, camera, lights, postprocessing
    IsoCamera.tsx             orthographic iso camera + controls + focus
    Floor.tsx, Zones.tsx, Desks.tsx, ServerRoom.tsx, Lounge.tsx, AICore.tsx
    AgentAvatar.tsx           character mesh + walk/sit/idle animation + label
    Effects.tsx               dispatch beams, handoff packets
    materials.ts              shared materials / canvas textures
  ui/
    TopBar.tsx, KpiCards.tsx, ChatPanel.tsx, AgentDetail.tsx, AgentTelemetry.tsx,
    JobCard.tsx, PlanGraph.tsx, QueueList.tsx, SpeedControl.tsx, glass.ts
  app/
    layout.tsx, page.tsx, globals.css
    api/agents/route.ts, api/plan/route.ts
tests/core/*.test.ts, tests/services/*.test.ts
```

---

### Task 1: Project scaffold

**Files:**
- Create: Next.js app at repo root (`package.json`, `src/app/*`, `tsconfig.json`, Tailwind), `vitest.config.ts`, `tests/smoke.test.ts`
- Modify: `.gitignore` (keep existing; ensure `.next`, `node_modules`)

**Interfaces:**
- Produces: `npm run dev`, `npm run build`, `npm test` (vitest run), path alias `@/` → `src/`.

- [ ] **Step 1:** Scaffold in a temp dir and move into repo root (repo is not empty): `npx create-next-app@16.4.6 tmpapp --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack --yes`, then move contents (excluding `.git`) into root, merge `.gitignore`.
- [ ] **Step 2:** `npm i three@0.187.0 @react-three/fiber@9.8.2 @react-three/drei@10.7.9 @react-three/postprocessing@3.2.2 zustand@5.1.0` and `npm i -D vitest@5.1.0 @types/three`.
- [ ] **Step 3:** Add `vitest.config.ts` (node environment, alias `@` → `src`), script `"test": "vitest run"`. Write `tests/smoke.test.ts`: `expect(1+1).toBe(2)`.
- [ ] **Step 4:** Run `npm test` → 1 passed. Run `npm run build` → success.
- [ ] **Step 5:** `layout.tsx`: `lang="th"`, Inter + Noto_Sans_Thai via `next/font/google`, title `Pixel Forge Studio — AI Agent Orchestrator`. `page.tsx`: placeholder text. Commit `chore: scaffold Next.js app with three/r3f/zustand/vitest`.

---

### Task 2: Domain types + roster

**Files:**
- Create: `src/core/types.ts`, `src/core/roster.ts`
- Test: `tests/core/roster.test.ts`

**Interfaces:**
- Produces (types.ts):
```ts
export type DeptId = 'ceo'|'producer'|'gamedev'|'graphic'|'frontend'|'backend'|'mobile'|'qa'|'sound'|'marketing'|'account';
export type SkillId = string;              // e.g. 'write_code', 'generate_image'
export type Cell = { x: number; z: number };
export interface AgentDef { id: string; name: string; dept: DeptId; title: string; personality: string;
  color: string; skills: SkillId[]; tools: string[]; keywords: string[]; idleStyle: 'sofa'|'coffee'|'pingpong'|'wander'|'chat';
  voice: { accept: string[]; done: string[] } }
export type AgentState = 'idle'|'walking_to_work'|'working'|'done'|'walking_to_lounge';
export interface AgentRuntime { id: string; state: AgentState; cell: Cell; pos: { x: number; z: number };
  path: Cell[]; heading: number; currentNodeId: string | null; queue: string[]; doneToday: number; stateTime: number }
export type NodeStatus = 'blocked'|'ready'|'queued'|'running'|'done';
export interface AgentStep { kind: 'thinking'|'tool_call'|'tool_result'|'output'; text: string; tool?: string; args?: Record<string,string>; at: number; duration: number }
export interface TaskNode { id: string; jobId: string; title: string; skill: SkillId; assigneeId: string;
  dependsOn: string[]; status: NodeStatus; workplace: 'desk'|'rack'; steps: AgentStep[]; stepIndex: number;
  stepElapsed: number; inputs: string[]; output: Deliverable | null }
export type Deliverable = { kind: 'code'; files: string[]; snippet: string } | { kind: 'image'; title: string; palette: string[] }
  | { kind: 'numbers'; rows: [string, string][] } | { kind: 'text'; text: string };
export interface Job { id: string; command: string; color: string; status: 'planning'|'running'|'done';
  nodeIds: string[]; createdAt: number; planningLeft: number; summary: string | null }
export interface ChatMessage { id: string; from: 'admin'|'core'|string; text: string; at: number; jobId?: string; deliverable?: Deliverable }
```
- Produces (roster.ts): `export const ROSTER: AgentDef[]`, `export function agentById(id: string): AgentDef`, `export const DEPT_LABEL: Record<DeptId, string>` (Thai+English label), `export const SKILL_OWNERS: Record<SkillId, string[]>` (derived).

- [ ] **Step 1: Write the failing test** `tests/core/roster.test.ts`:
  - `ROSTER.length === 19`; ids unique; ids equal `['arthit','mali','kai','ploy','tan','mint','bank','fah','nont','nara','pete','june','ohm','beam','jazz','praew','toy','somchai','lin']` as a set.
  - every dept in `DeptId` has ≥1 agent; marketing, account, gamedev(3), graphic, frontend, backend, mobile counts match spec §6.
  - `SKILL_OWNERS.write_code` includes `'nara'` and `'nont'`; `SKILL_OWNERS.provision_server` includes `'pete'`; `SKILL_OWNERS.approve` equals `['arthit']`; `SKILL_OWNERS.breakdown_requirements` equals `['mali']`.
  - every agent has ≥2 skills, ≥2 tools, ≥3 keywords, ≥2 voice lines each.
- [ ] **Step 2:** `npx vitest run tests/core/roster.test.ts` → FAIL (module not found).
- [ ] **Step 3:** Implement types and roster. Personalities/specialties/keywords from spec §6 table verbatim. Skill set (builder may extend): `approve, strategy, breakdown_requirements, write_brief, gameplay, engine_optimize, level_design, ui_art, make_logo, character_art, animation, frontend_ui, write_code, design_api, run_migration, provision_server, deploy, ios_app, android_app, run_tests, file_bug, compose_music, sfx, campaign, social_post, query_analytics, ads, calc_budget, invoice, payroll`. Distinct shirt colors.
- [ ] **Step 4:** test → PASS.
- [ ] **Step 5:** Commit `feat(core): agent roster and domain types`.

---

### Task 3: Office layout + A* pathfinding

**Files:**
- Create: `src/core/office.ts`, `src/core/pathfinding.ts`
- Test: `tests/core/office.test.ts`, `tests/core/pathfinding.test.ts`

**Interfaces:**
- Consumes: `Cell`, `DeptId`, `ROSTER`.
- Produces:
```ts
export interface Zone { id: DeptId | 'core'|'server'|'lounge'|'meeting'; label: string; rect: { x: number; z: number; w: number; d: number }; color: string }
export interface Desk { id: string; agentId: string; cell: Cell; seat: Cell; facing: number }  // seat = walkable cell agent stands/sits on
export interface Office { width: number; depth: number; blocked: boolean[][] /* [z][x] */; zones: Zone[];
  desks: Desk[]; rackConsoles: Cell[]; racks: { cell: Cell; facing: number }[]; loungeSpots: { cell: Cell; style: AgentDef['idleStyle'] }[];
  corePos: Cell; walls: { from: Cell; to: Cell; glass: boolean }[] }
export const OFFICE: Office;
export function deskOf(agentId: string): Desk;
export function isWalkable(c: Cell): boolean;
// pathfinding.ts
export function findPath(from: Cell, to: Cell, isWalkable: (c: Cell) => boolean, w: number, d: number): Cell[] | null; // 4-neighbour A*, Manhattan, excludes `from`, includes `to`
export function nearestWalkable(target: Cell, isWalkable: (c: Cell) => boolean, w: number, d: number): Cell | null; // BFS ring
```
Layout (builder call on exact coords): grid 44 × 32, 1 cell = 1 m. Zones: department desk clusters around a central `core` plaza; `server` room glass-walled with ≥ 3 rows × 5 racks; `lounge` with sofa/coffee/ping-pong spots (≥ 19 spots total, so every agent can rest); CEO glass office in a corner; `meeting` room.

- [ ] **Step 1: Write failing tests.**
  - office: 19 desks, one per roster agent; every `desk.seat`, `rackConsoles` cell, `loungeSpots` cell is walkable; ≥19 lounge spots; each seat is reachable from the core plaza neighbour via `findPath` (not null); racks are blocked cells.
  - pathfinding: on a 5×5 open grid `findPath({0,0},{2,0})` returns `[{1,0},{2,0}]`; around a wall column at x=1 (z 0..3) path length from (0,0) to (2,0) is 8; fully enclosed target returns `null`; `from === to` returns `[]`; `nearestWalkable` of a blocked cell returns an adjacent walkable cell (distance 1).
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** Implement. A* with a binary heap or simple sorted array (grid ≤ 1408 cells, either fine).
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5:** Commit `feat(core): office grid layout and A* pathfinding`.

---

### Task 4: Planner (AI Core mock)

**Files:**
- Create: `src/core/planner.ts`
- Test: `tests/core/planner.test.ts`

**Interfaces:**
- Consumes: `ROSTER`, `SKILL_OWNERS`, `TaskNode`, `AgentRuntime`.
- Produces:
```ts
export type Intent = 'new_game'|'feature_backend'|'feature_frontend'|'mobile_app'|'art_asset'|'audio'|'marketing_campaign'|'budget_report'|'bug_fix'|'infra'|'strategy'|'single';
export interface PlanDraftNode { key: string; title: string; skill: SkillId; dependsOn: string[]; workplace: 'desk'|'rack' }
export interface PlanResult { intent: Intent | null; nodes: PlanDraftNode[]; reasoning: string[]; reply: string }
export function scoreDepartments(text: string): Record<DeptId, number>;
export function detectIntent(text: string): Intent | null;
export function makePlan(text: string): PlanResult;            // pure, deterministic
export function pickAssignee(skill: SkillId, text: string, agents: Record<string, AgentRuntime>): string; // best keyword match if idle, else any idle owner (fewest doneToday), else owner with shortest queue
```
Rules (spec §9.3): lowercase; keywords match by substring; action/skill keywords weight 3, context words (`เกม`, `game`, `แอป`, `app`, `project`, `โปรเจกต์`) weight 1. Broad triggers `ทำเกมใหม่`, `เกมใหม่`, `new game` → `new_game`. If top dept ≥ 3 and no other dept ≥ 3 → single-dept intent. Dev intents (`feature_backend`, `feature_frontend`, `mobile_app`, `bug_fix`) append a `run_tests` node depending on the last node. Plans with ≥ 5 nodes append `approve` as final node depending on all leaves. `deploy`/`run_migration`/`provision_server` nodes have `workplace: 'rack'`.

`new_game` template (exact): `brief(breakdown_requirements)` → [`level(level_design)`, `gameplay(gameplay)`, `ui_art(ui_art)`, `chars(character_art)`, `music(compose_music)`] each depends on `brief` → `game_ui(frontend_ui)` depends on `ui_art`,`gameplay` → `qa(run_tests)` depends on `game_ui`,`level`,`chars`,`music` → `launch(campaign)` depends on `qa` → `approve(approve)` depends on `launch`.

- [ ] **Step 1: Write failing tests.**
  - `makePlan('ทำ API login ให้เกม Space Run')` → intent `feature_backend`; node skills in order `['write_code','run_tests']`; second dependsOn first.
  - `makePlan('ทำapi loginให้เกม')` → same intent (no-space Thai, Review Focus #2).
  - `makePlan('ทำเกมใหม่แนว puzzle')` → intent `new_game`, 10 nodes, last skill `approve`, first skill `breakdown_requirements`, the 5 parallel nodes all depend only on the brief key, and the DAG has no cycles (topological sort covers all nodes).
  - `makePlan('   ')` and `makePlan('สวัสดี')` → `intent === null`, `nodes.length === 0`, reply contains `'ขอรายละเอียดเพิ่ม'` (Review Focus #1).
  - `makePlan('deploy server ใหม่')` → contains a node with `workplace === 'rack'` and skill `provision_server` or `deploy`.
  - `makePlan('ทำโลโก้เกม')` → intent `art_asset`, single node skill `make_logo`.
  - `pickAssignee('engine_optimize', 'optimize fps', agents)` with ploy idle → `'ploy'`; with ploy working (ploy is the only owner of `engine_optimize`) → still `'ploy'` (queued on owner). `pickAssignee('write_code','api', …)` with nara idle → `'nara'` (keyword match); with nara working and nont idle → `'nont'`.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** Implement. `reasoning[]` is 3–5 short mock "thinking" lines (Thai) describing the decomposition; `reply` is the Core's chat message listing the nodes and assignee names.
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5:** Commit `feat(core): deterministic AI Core planner`.

---

### Task 5: Agent-loop steps + simulation reducer

**Files:**
- Create: `src/core/steps.ts`, `src/core/sim.ts`
- Test: `tests/core/steps.test.ts`, `tests/core/sim.test.ts`

**Interfaces:**
- Consumes: Tasks 2–4.
- Produces:
```ts
// steps.ts
export function makeSteps(node: Pick<TaskNode,'skill'|'title'>, agent: AgentDef, rng: () => number): AgentStep[]; // 4–8 steps, total duration 10–40 s, ends with 'output'
export function makeDeliverable(skill: SkillId, title: string, rng: () => number): Deliverable;
// sim.ts
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
export function createInitialState(seed?: number): SimState;          // all agents idle at distinct lounge spots
export function submitCommand(s: SimState, text: string): { state: SimState; events: SimEvent[] };
export function tick(s: SimState, dt: number): { state: SimState; events: SimEvent[] }; // splits dt into ≤ MAX_SUBSTEP chunks
```
Behavior: `submitCommand` appends admin chat; on `intent === null` appends Core reply only. Otherwise creates `Job` (`JOB-1001`…, color from a fixed neon palette) with `status 'planning'`, `planningLeft = PLANNING_TIME`, Core `thinking`, streams `reasoning` lines as Core chat messages. When planning ends: materialize nodes (`T-xxxx` ids, assignee via `pickAssignee`), status `ready` if no deps else `blocked`, emit `job.planned` + Core reply. Dispatch: each `ready` node is pushed to its assignee's `queue` (status `queued`, emit `node.dispatched`). An `idle` agent (or `walking_to_lounge`) with a non-empty queue takes the head: state `walking_to_work`, path to desk seat or nearest free `rackConsole` (fallback `nearestWalkable`, Review Focus #5). On arrival → `working`, node `running`, `node.started`; steps advance by `stepElapsed`, emitting `step.appended` as each begins; progress = stepIndex/steps.length. On final step → `node.completed`, `output = makeDeliverable(...)`, agent `done` for `DONE_TIME`, then if queue non-empty → next node, else `walking_to_lounge` to a free lounge spot → `idle`. Completing a node: each dependent whose deps are all done becomes `ready` (emit `handoff` per edge, dependent `inputs` gets producer's title). When all nodes of a job are done: `job.completed`, Core summary chat message with deliverables list; agent `doneToday++` per node. Idle agents occasionally (seeded rng) wander to another free lounge spot. Use a seeded PRNG (mulberry32) from `rngSeed` so tests are deterministic.

- [ ] **Step 1: Write failing tests** (`sim.test.ts` uses helper `runUntil(state, pred, maxSimSeconds)` that ticks 0.1 s):
  - initial: 19 agents, all `idle`, all on distinct walkable cells.
  - `submitCommand(s,'สวัสดี')` → no job, chat has admin msg + Core msg.
  - API login command → within 3 s a job exists with 2 nodes; within 60 s nara reaches `working` at her desk seat cell; within 200 s job `done`, both nara and beam back to `idle`, events include exactly one `handoff` (nara→beam) and one `job.completed`; Core summary message has a `deliverable` of kind `code`.
  - new game → within 600 s job done; `approve` node ran last (its `node.started` after every other `node.completed`); at some tick ≥ 4 agents were `working` simultaneously.
  - Review Focus #3: submit `'ทำ api login'` three times back-to-back (more `write_code` nodes than owners) → assert invariant every tick: no agent is assignee of >1 `running` node and no agent's `currentNodeId` points to a non-running node; at some tick one `write_code` node is `queued`; all three jobs eventually `done`.
  - Review Focus #4: `tick(s, 10)` produces same final agent positions as 100× `tick(s, 0.1)` within 0.01; no agent position ever lies on a blocked cell during walks.
  - rack node: `'deploy server ใหม่'` → assignee's working cell is in `OFFICE.rackConsoles`.
  - steps: `makeSteps` returns 4–8 steps, last kind `output`, at least one `tool_call` whose `tool` is in the agent's `tools`, durations sum within [10, 40].
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** Implement `steps.ts` then `sim.ts`. Keep reducer immutable at the top level (shallow-copy changed records) so the store can diff.
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5:** Commit `feat(core): agent-loop step generator and orchestration simulation`.

---

### Task 6: Orchestrator service, store, API routes

**Files:**
- Create: `src/services/orchestrator.ts`, `src/services/mockOrchestrator.ts`, `src/store/useOfficeStore.ts`, `src/app/api/agents/route.ts`, `src/app/api/plan/route.ts`
- Test: `tests/services/mockOrchestrator.test.ts`

**Interfaces:**
- Consumes: `SimState`, `SimEvent`, `submitCommand`, `tick`, `makePlan`, `ROSTER`.
- Produces:
```ts
export interface OrchestratorService {
  submit(command: string): void;
  setSpeed(mult: 0.5|1|2|4): void;
  subscribe(listener: (state: Readonly<SimState>, events: SimEvent[]) => void): () => void;
  getState(): Readonly<SimState>;
  start(): void; stop(): void;          // mock: requestAnimationFrame / setInterval clock
}
export class MockOrchestratorService implements OrchestratorService { constructor(opts?: { seed?: number; now?: () => number }); advance(realSeconds: number): void /* test hook */ }
// store
interface OfficeStore { sim: SimState; speed: number; selectedAgentId: string | null; selectedJobId: string | null;
  fx: { id: string; kind: 'beam'|'packet'; from: Cell; to: Cell; born: number; color: string }[];
  select(agentId: string | null): void; selectJob(id: string | null): void; submit(text: string): void; setSpeed(m: 0.5|1|2|4): void }
export const useOfficeStore: UseBoundStore<StoreApi<OfficeStore>>;
export function connectService(svc: OrchestratorService): () => void; // feeds events→store; maps node.dispatched→beam fx (core→desk), handoff→packet fx (desk→desk)
```
API routes: `GET /api/agents` → `{ agents: ROSTER }`; `POST /api/plan` body `{ text }` → `makePlan(text)` JSON; 400 on missing `text`. Comment at top of `orchestrator.ts`: future `RemoteOrchestratorService` consumes the same `SimEvent` stream over SSE.

- [ ] **Step 1: Write failing tests:** service with seed 1: `submit('ทำ API login ให้เกม Space Run')`, `advance(3)` → listener received a `job.planned` event; `setSpeed(4)`, `advance(50)` → `getState().jobs` has job `done`; unsubscribe stops calls; `advance` with speed 4 equals sim seconds 4× real.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** Implement service (clock: rAF in browser; `advance` used by both rAF loop and tests), store, `connectService`, API routes.
- [ ] **Step 4:** run → PASS; `npm run build` passes.
- [ ] **Step 5:** Commit `feat: mock orchestrator service, zustand store, API contract routes`.

---

### Task 7: Isometric futuristic office scene (static environment)

**Files:**
- Create: `src/scene/OfficeScene.tsx`, `IsoCamera.tsx`, `Floor.tsx`, `Zones.tsx`, `Desks.tsx`, `ServerRoom.tsx`, `Lounge.tsx`, `AICore.tsx`, `materials.ts`
- Modify: `src/app/page.tsx` (render scene full-screen via `dynamic(() => import('@/scene/OfficeScene'), { ssr: false })`)

**Interfaces:**
- Consumes: `OFFICE`, `useOfficeStore` (`sim.coreState`, active tool_call count, `selectedAgentId`).
- Produces: `<OfficeScene />` default export; `IsoCamera` exposes `focusOn(cell)` via store subscription to `selectedAgentId`.

Visual spec (spec §7, §7.1): glossy light floor (`MeshStandardMaterial` low roughness + drei `Environment` preset or `RoomEnvironment`), zone floor tints + emissive neon border strips, holographic floating zone labels (drei `Text` + emissive translucent plane), glass partitions (`MeshPhysicalMaterial` transmission off for perf → use transparent + low opacity), desks instanced with curved monitors whose screen material glows when that agent is `working`, server room racks instanced with LED grid canvas texture whose emissive intensity scales with active `tool_call` steps, glowing floor conduits from server room to AI Core with animated UV offset, AI Core = rotating icosahedron + rings + point light, pulse speed by `coreState`. Postprocessing: `EffectComposer` + `Bloom` (`luminanceThreshold` ≈ 0.9, `mipmapBlur`). Camera: `OrthographicCamera` at yaw 45°, pitch 35.264°, zoom limits, drag pan (custom pointer handler or drei `MapControls` with rotation disabled), Q/E rotates 90° with tween, wheel zoom.

- [ ] **Step 1:** Build environment components; render page.
- [ ] **Step 2:** `npm run build` → success; `npm run dev` and take a screenshot (Playwright `npx playwright screenshot http://localhost:3000 shot-env.png --viewport-size=1600,900` after install, or manual check). Expected: iso office with all zones, server room racks, AI Core visible, no console errors.
- [ ] **Step 3:** Commit `feat(scene): isometric futuristic office environment with server room and AI Core`.

---

### Task 8: Agents, labels, effects in scene

**Files:**
- Create: `src/scene/AgentAvatar.tsx`, `src/scene/Effects.tsx`
- Modify: `src/scene/OfficeScene.tsx`

**Interfaces:**
- Consumes: `useOfficeStore` (`sim.agents`, `sim.nodes`, `fx`, `select`), `ROSTER`.
- Produces: avatars clickable → `select(agentId)`.

Avatar: low-poly procedural (rounded capsule torso in shirt color, head sphere, simple hair cap, arms/legs as boxes pivoted at joints). Read `AgentRuntime.pos/heading` each frame via `useFrame` + `useOfficeStore.getState()` (no React re-render per frame); smooth heading. Animations: walk swing while `walking_*`; sit pose + typing arms while `working` at desk, standing typing at rack; small jump on `done`; idle per `idleStyle`. Label (drei `Html`, glass pill like `FL-03 LOAD-3109`): `Nara · T-1002 45%` when not idle, color by state; name only on hover when idle; selected agent gets ring on floor. Effects: beam = glowing line from AI Core to target desk fading over 1.2 s; packet = small emissive cube traveling desk→desk over 1.5 s on an arc.

- [ ] **Step 1:** Implement; wire a temporary dev auto-command in `useEffect` only if `?demo=1` query is present (submits the new-game command on load).
- [ ] **Step 2:** `npm run dev`, open `/?demo=1`, screenshot after ~15 s. Expected: Core beams, agents walking/sitting, labels with progress. Check FPS via drei `Stats` in dev (≥ 50 on dev machine).
- [ ] **Step 3:** Commit `feat(scene): animated agent avatars, labels, dispatch beams, handoff packets`.

---

### Task 9: Dashboard UI panels

**Files:**
- Create: `src/ui/*.tsx` (list in File Structure), `src/ui/glass.ts` (shared Tailwind class strings)
- Modify: `src/app/page.tsx`, `src/app/globals.css`

**Interfaces:**
- Consumes: `useOfficeStore` selectors; `ROSTER`, `DEPT_LABEL`.

Layout mirrors `image.png` (spec §11): TopBar (logo "Pixel Forge Studio · AI Agent Orchestrator", search agents/tasks → select, Core status chip, live clock, FPS, sim speed control, admin avatar). KpiCards top-left: Agents working x/19, Jobs running, Nodes in queue, Tasks done today, Utilization ring. Left: ChatPanel (history with admin/Core/agent messages, Core reasoning lines styled dimmer, deliverable cards: code → monospace snippet + file chips, image → gradient swatch card, numbers → mini table; input + send on Enter; disabled send on empty). Right: AgentDetail (name, dept, personality, skills/tools chips, current node + progress, live step log terminal-lite, Locate button) + AgentTelemetry list (all 19, state badge Thai: ว่าง/กำลังเดิน/ทำงาน/เสร็จ, progress bar, click = focus). Bottom: JobCard (blue gradient like reference: job id, command, nodes done x/y, progress bar), PlanGraph (SVG DAG, layered by topological depth, nodes colored by status, assignee initials; click node → select agent), QueueList (upcoming queued/blocked nodes). Panels: `bg-white/70 backdrop-blur-xl border-white/60 shadow` rounded-2xl; responsive: below 1024 px collapse side panels into toggles.

- [ ] **Step 1:** Implement panels.
- [ ] **Step 2:** `npm run build` passes; `npm test` still passes; dev screenshot at 1600×900 matches reference layout.
- [ ] **Step 3:** Commit `feat(ui): glassmorphism dashboard, chat, plan graph, telemetry`.

---

### Task 10: End-to-end verification

**Files:**
- Create: `README.md` (Thai: what it is, run instructions, architecture + service seam, how to plug real AI later)
- Remove: `?demo=1` hook stays (documented) or is removed — builder call.

- [ ] **Step 1:** Run the spec §14 success script manually in `npm run dev`: idle lounge on load; "ทำ API login ให้เกม Space Run" → 2-node plan, Nara → Beam handoff, summary with code; "ทำเกมใหม่แนว puzzle" → DAG, Mali first, parallel agents, Arthit last; "deploy server ใหม่" → Pete works at a rack; empty send does nothing; "สวัสดี" → clarification. Screenshot each.
- [ ] **Step 2:** `npm test` all pass; `npm run build` success; `npm run lint` clean.
- [ ] **Step 3:** Commit `docs: README and final verification`.
