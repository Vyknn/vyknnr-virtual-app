# Pixel Forge Studio — AI Agent Orchestrator Office (Isometric 3D) — Design

Date: 2026-11-12
Status: Approved 2026-11-12

## 1. Intent

A single-admin web dashboard that visualizes a game-development software house staffed by AI agents, as an **isometric 3D office**. The admin types natural-language commands in a chat box; the system routes each command to the agent(s) whose skill fits, and the corresponding 3D characters walk to their desks, sit, and "work". Idle agents rest or wander in a lounge.

Visual and UX inspiration: `bcwarehousedemo1` (https://github.com/jaturapornchai/bcwarehousedemo1, live at https://test01.bcsmethai.com). That demo is a 3D warehouse "digital twin" with glassmorphism panels overlaid on a full-screen three.js scene: KPI cards on top, control panel left, detail + telemetry list right, current task + upcoming tasks bottom, floating labels above moving units (`FL-03 LOAD-3109`). This project transplants that language from forklifts/pallets to agents/tasks. Reference screenshot: `image.png` in repo root.

**Why:** the admin wants to monitor and command an AI-agent workforce in a way that is visual and legible at a glance — who is busy, on what, how far along — before wiring real AI.

## 2. Goals

- Isometric 3D office rendered with three.js inside a Next.js app.
- 19 named agents across departments, each with a personality, a desk, and a distinct look (shirt color).
- Chat-driven orchestration: admin types → AI Core plans a DAG of sub-tasks → dispatches to agents by skill → agents walk to desks, run a mock agent loop (thinking / tool calls), hand off outputs → Core aggregates → agents return to lounge.
- Live dashboard panels in the reference's glassmorphism style: KPIs, agent roster/telemetry, current tasks, task queue, chat.
- Click an agent (in scene or roster) to focus the camera on them and show their detail card.
- All data from **mock services** shaped like a real API, so real AI/DB can be plugged in later without touching the UI or scene.

## 3. Non-goals (this round)

- No real AI calls (no Claude/LLM API).
- No database, no persistence across reloads (in-memory state only; reload = reset).
- No auth / multi-user. One admin.
- No physics engine (reference uses cannon-es; not needed here).
- No external 3D model files, images, or audio — geometry and textures are procedural, like the reference.

## 4. Anti-goals (failure even if it "works")

- Looks like a generic template dashboard rather than the polished glassmorphism look of the reference.
- Characters teleport or slide through furniture instead of walking paths.
- Admin can't tell at a glance which agents are busy vs idle.
- Mock logic tangled into UI components such that swapping in a real backend later means rewriting the UI.

## 5. Decided constraints

| Item | Decision | Source |
|---|---|---|
| Framework | Next.js (App Router, TypeScript) | user |
| 3D | three.js | user |
| Camera | **Isometric 3D** | user |
| Interaction | Chat-style text commands | user |
| Backend | Simulation only, mock data, no DB | user |
| Agents | Named with personalities, preset by builder | user |
| Architecture | AI agent orchestrator: central Orchestrator plans + dispatches to worker agents | user |
| Orchestrator form | Holographic "AI Core" object in office center, not a character | user (accepted proposal) |
| User | Single admin; monitor + command | user |
| UI language | Thai-first UI copy, English for codes/technical terms (as in reference) | builder call, matches reference |

## 6. Company & agents (builder call — editable)

Company name: **Pixel Forge Studio**.

| Dept (id) | Agent | Personality / specialty | Keywords (routing) |
|---|---|---|---|
| ceo | Arthit | big-picture, decisive; strategy, approvals | กลยุทธ์, strategy, อนุมัติ, approve, roadmap |
| producer | Mali | organizer; splits big jobs across depts | (fallback / multi-dept orchestrator) |
| gamedev | Kai | experimental; gameplay, mechanics | gameplay, mechanic, เกม, unity, unreal |
| gamedev | Ploy | deep-diver; engine, performance | engine, performance, optimize, fps |
| gamedev | Tan | thoughtful; level design | level, ด่าน, map |
| graphic | Mint | 2D, UI art, logo | โลโก้, logo, ui art, icon, 2d |
| graphic | Bank | 3D, character, animation | ตัวละคร, character, 3d, model, animation |
| frontend | Fah | detail-oriented; UI, animation | หน้า, page, ui, css, animation |
| frontend | Nont | fast; React, web | react, web, next, frontend |
| backend | Nara | calm; API, auth, DB | api, login, auth, database, db |
| backend | Pete | server, multiplayer, infra | server, multiplayer, deploy, infra |
| mobile | June | iOS, Swift | ios, swift, iphone |
| mobile | Ohm | Android, Flutter | android, flutter, mobile, แอป |
| qa | Beam | nitpicker; testing, bugs | test, bug, บั๊ก, qa |
| sound | Jazz | music, SFX | เสียง, sound, music, เพลง, sfx |
| marketing | Praew | talker; social, campaigns | โปรโมท, campaign, social, โพสต์ |
| marketing | Toy | data, ads, analytics | ads, โฆษณา, analytics, ยอด |
| account | Somchai | careful; budget, cost | งบ, budget, บัญชี, ค่าใช้จ่าย |
| account | Lin | invoices, payroll | invoice, ใบแจ้งหนี้, เงินเดือน, payroll |

19 agents total.

Personality surfaces in: chat reply tone (short canned phrase templates per agent), shirt color, and idle behavior (e.g. Kai plays ping-pong, Somchai drinks coffee, Praew chats with others).

## 7. Office layout (builder call)

- Single floor, isometric. Department zones laid out as clusters of desks with a standing floor sign per zone (like `RACK B2` sign in reference) and a painted floor area tint per department.
- **AI Core** pedestal at the office center (Orchestrator, see §9.1). CEO glass office (corner), meeting room (optional: agents of a large job briefly gather here after planning), lounge (sofas, coffee machine, ping-pong table).
- **Server room** (user request): glass-walled room with rows of server rack cabinets (procedural; front panels with blinking LED grids, cable trays overhead, cold-aisle floor tiles). Racks react to activity: LED blink rate/color intensity rises with the number of agents currently in a `tool_call` step. Infra-type steps (`deploy`, `run_migration`, `provision_server`) make the assignee (e.g. Pete) walk to the server room to "work" at a rack console instead of their desk, then return. Glowing floor conduits connect the server room to the AI Core.
- Each agent has one fixed desk with a monitor whose screen glows while working.
- Floor is a walkable grid; furniture marks blocked cells. Pathfinding: A* on grid.

### 7.1 Visual style: futuristic tech office (user request)

The office must read as **high-tech / futuristic**, not a generic office:
- Glossy reflective floor (subtle environment reflections), glass partitions with frosted edges, thin emissive **neon accent strips** (cyan / electric blue / violet) along walls, desk edges and zone borders, with bloom post-processing.
- Holographic floating zone signs (department names) instead of plain boards; holographic screens above desks while working.
- Ergonomic floating-style desks, curved monitors, lounge with modern pods/sofas.
- Ambient touches: slow-moving light pulses along floor conduits, soft particle dust in the AI Core light.
- Builder call on palette: clean light-neutral base (to keep the reference's bright glassmorphism UI legible) with saturated neon accents; a **day/night toggle** is optional — night mode dims ambient light so neon and racks glow stronger. Must stay ≥50 FPS: bloom selective/cheap, instancing for racks/desks.

## 8. Agent behavior (state machine)

States: `idle` (in lounge: sitting / wandering / personality idle) → `walking_to_desk` → `working` (seated, typing animation, progress 0→100%) → `done` (brief celebrate) → `walking_to_lounge` → `idle`.

- Working duration: mock, randomized per task (e.g. 15–45 s simulated) so the demo stays lively. Builder may add a sim-speed control.
- Floating label above head while not idle: `<AgentName> · <TASK-ID> <pct>%`, color-coded by state. Idle agents show name only on hover.
- Characters are low-poly procedural (box/capsule body, head, arms/legs with simple walk-cycle swing, sit pose). Cute-but-clean, not cartoonish-chibi. Builder call on exact proportions.

## 9. Agent orchestration (core of the system)

The system is modeled as a **multi-agent AI orchestration** pipeline, mocked end-to-end but shaped like a real LLM tool-use system so real AI can be plugged in later.

### 9.1 Actors

- **Orchestrator — "AI Core"**: not a character. A holographic core object in the center of the office (glowing rotating crystal/sphere on a pedestal, pulses while thinking). It receives every admin command, produces a plan, dispatches sub-tasks, tracks dependencies, collects results, and writes the final summary in chat. In the scene, a light beam / particle stream travels from the Core to an agent's desk on dispatch.
- **Worker agents** (the 19 in §6): each has a `skills[]` list and a `tools[]` list (mock), e.g. Nara: `design_api`, `write_code`, `run_migration`; Mint: `generate_image`, `make_logo`; Beam: `run_tests`, `file_bug`; Toy: `query_analytics`; Somchai: `calc_budget`.
- **Mali (Producer)** is a worker agent whose skill is `breakdown_requirements` / `write_brief`. The Core may assign her a first planning sub-task for large jobs (e.g. new game) whose output feeds the others.
- **Arthit (CEO)** has an `approve` skill. Builder call: for plans with ≥5 sub-tasks, the plan's last node is an "approval" by Arthit.

### 9.2 Lifecycle of a command

1. Admin types a command in chat.
2. **Plan**: Core enters `thinking` (visual pulse, chat shows "AI Core กำลังวางแผน…" with mock reasoning lines streamed). Output is a **plan DAG**: nodes = sub-tasks `{ id, title, skill, assigneeId, dependsOn[] }`.
3. **Dispatch**: every node whose dependencies are satisfied is sent to its assignee (beam from Core to desk). If the assignee is busy, the node waits in that agent's queue; Core may reassign to another idle agent with the same skill (builder call: yes, prefer reassignment).
4. **Execute**: agent walks to desk, sits, and runs a mock **agent loop**: a sequence of steps `thinking → tool_call(name, args) → tool_result → … → final_output`. Each step is appended to the agent's log with timestamps; progress % = steps completed / steps planned.
5. **Handoff**: when a node finishes, its output is attached as context to dependent nodes (visual: small packet flies desk → desk, or desk → Core → desk). Dependents become ready.
6. **Aggregate**: when all nodes finish, Core produces a final summary message in chat listing deliverables (mock files, code snippets, placeholder image cards, numbers).
7. Agents return to lounge → `idle`.

Multiple commands can run concurrently; each has its own plan (`JOB-xxxx`), color-tagged.

### 9.3 Mock planner (how the Core decides, this round)

Deterministic, testable, no LLM:
- **Plan templates** keyed by intent, detected via weighted keywords (action words = 3, context words like "เกม", "game", "แอป" = 1). Examples:
  - `new_game` ("ทำเกมใหม่", "new game"): Mali brief → [Tan level design, Kai gameplay, Mint UI art, Bank characters, Jazz sound] → Fah game UI → Beam QA → Praew launch campaign → Arthit approve.
  - `feature_backend` ("api", "login", "server"): Nara/Pete design → implement → Beam test.
  - `mobile_app`: Mali brief → June iOS ∥ Ohm Android → Beam test.
  - `marketing_campaign`, `budget_report`, `art_asset`, `bug_fix`, etc.
- **Single-skill fallback**: if one department clearly wins (top score ≥3 and no other ≥3), create a one-node plan (+ optional QA node for dev work). "ทำ API login ให้เกม Space Run" → backend wins → Nara implement → Beam test.
- **No match**: Core replies asking for clarification; no plan.
- Assignee selection: agent whose personal keywords match best, else any idle agent with the skill, else queue on the best-match agent.
- Agent loop steps are generated from per-skill step templates with randomized durations (total ~10–40 s per node at 1× speed).

### 9.4 Data model (sketch)

- `Job { id, command, status: planning|running|done|failed, plan: TaskNode[], summary? }`
- `TaskNode { id, jobId, title, skill, assigneeId, dependsOn[], status: blocked|ready|queued|running|done, steps: AgentStep[], output? }`
- `AgentStep { kind: thinking|tool_call|tool_result|output, text, tool?, args?, at }`
- `Agent { id, name, dept, personality, color, deskId, skills[], tools[], state, currentNodeId?, queue[] }`

### 9.5 Service seam

UI and scene talk only to an `OrchestratorService` interface (`plan(command)`, `subscribe(events)`, `cancel(jobId)`), emitting events like `job.planned`, `node.dispatched`, `step.appended`, `node.completed`, `handoff`, `job.completed`. These mirror the event stream a real Claude tool-use backend would emit.

This round's `MockOrchestratorService` runs **in the browser** (no DB; needs live agent state), driving a zustand store through a simulation clock with a speed control (0.5×/1×/2×/4×). `app/api/*` route handlers (`GET /api/agents`, `POST /api/plan`) exist as stateless mock examples of the future contract using the same pure planner functions; the UI does not depend on them. Later a `RemoteOrchestratorService` (e.g. SSE from a server that calls Claude with each agent's tools) replaces the mock without UI/scene changes.

## 10. Orchestration UI

- **Plan graph panel**: DAG of the selected job (nodes colored by status, assignee avatar/initial, edges for dependencies). Click node → focuses agent.
- **Agent log**: in the agent detail card, a live feed of that agent's steps (thinking / tool_call `write_code(file="auth.ts")` / result), styled like a terminal-lite.
- **Core status chip** in top bar: idle / thinking / dispatching, jobs running.

## 11. Screen layout (mirrors reference)

- **Top bar:** logo "Pixel Forge Studio · AI Agent Office", search (agents/tasks), live clock, FPS, admin avatar.
- **KPI cards (top-left row):** Agents working (x of 19), Jobs running, Nodes in queue, Tasks done today, Utilization % ring.
- **Left panel:** Chat (command input + message history incl. Core planning lines and final summaries). Always visible.
- **Right panel:** selected agent detail card (name, dept, personality, current task, progress, Locate button) + "Agent Telemetry" list (all agents, state badge, progress bar, click = focus).
- **Bottom:** Current job card (blue, like reference: job id, command, nodes done x/y) + Plan graph (DAG) + Upcoming/queued nodes.
- **Scene:** full-screen behind panels. Controls: pan (drag), zoom (wheel), rotate 90° steps (buttons/Q-E keys).
- Fonts Inter + Noto Sans Thai; Tailwind; glassmorphism panels; light theme like reference.

## 12. Tech choices (builder call)

- Next.js latest stable App Router, TypeScript, Tailwind CSS.
- `@react-three/fiber` + `@react-three/drei` over raw three.js (still three.js underneath) for React integration; scene loaded via `dynamic(() => import(...), { ssr: false })`.
- `zustand` store shared by scene and UI.
- `OrthographicCamera` positioned at classic isometric angle (yaw 45°, pitch ≈35.264°).
- Procedural geometry/textures; instancing for repeated furniture where helpful.

## 13. Left to the builder

Exact visual proportions, colors per agent, furniture set, floor plan dimensions, chat reply templates, mock deliverable content, animation details, folder structure, sim speed, test approach (unit tests at least for router + state machine + pathfinding).

## 14. Success

Admin opens the page, sees 19 agents idling in the lounge and the AI Core glowing center-office. Types "ทำ API login ให้เกม Space Run" → Core thinks, shows a 2-node plan (Nara implement → Beam test) → beam to Nara's desk → Nara walks, sits, log streams mock tool calls → handoff packet to Beam → Beam tests → Core posts summary with mock code. Types "ทำเกมใหม่แนว puzzle" → Core builds the new_game DAG; Mali briefs first, then 5 agents work in parallel, handoffs flow, Arthit approves last. Panels and plan graph update live throughout. Runs smoothly (≥50 FPS on a typical laptop).
