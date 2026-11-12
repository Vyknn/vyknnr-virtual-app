import type { AgentDef, AgentStep, Deliverable, SkillId, TaskNode } from './types';

/**
 * Mock agent loop: thinking -> (tool_call -> tool_result)xK -> [thinking] -> output.
 * K in 1..3 => 4..8 steps. `at` is the step's start offset (seconds) relative to node start;
 * the simulation rebases it to absolute sim time when the node starts.
 * Total duration is a random target in [12, 36] s (inside the 10-40 s contract).
 */
export function makeSteps(node: Pick<TaskNode, 'skill' | 'title'>, agent: AgentDef, rng: () => number): AgentStep[] {
  const draft: Omit<AgentStep, 'at' | 'duration'>[] = [];
  const w: number[] = [];
  const add = (s: Omit<AgentStep, 'at' | 'duration'>, lo: number, hi: number) => { draft.push(s); w.push(lo + rng() * (hi - lo)); };

  add({ kind: 'thinking', text: `วิเคราะห์งาน "${node.title}" (${node.skill})` }, 1, 2.5);
  const pairs = 1 + Math.floor(rng() * 3);
  const t0 = Math.floor(rng() * agent.tools.length);
  for (let i = 0; i < pairs; i++) {
    const tool = agent.tools[(t0 + i) % agent.tools.length];
    add({ kind: 'tool_call', text: `${tool}(task: "${node.title}")`, tool, args: { task: node.title, skill: node.skill, pass: String(i + 1) } }, 0.5, 1.5);
    add({ kind: 'tool_result', text: `${tool} → ok (${RESULT_NOTES[Math.floor(rng() * RESULT_NOTES.length)]})`, tool }, 2, 6);
  }
  if (draft.length < 7 && rng() < 0.5) add({ kind: 'thinking', text: 'ตรวจทานผลลัพธ์ก่อนส่งมอบ' }, 1, 2);
  add({ kind: 'output', text: `ส่งมอบ: ${node.title}` }, 1, 2);

  const target = 12 + rng() * 24;
  const sum = w.reduce((a, b) => a + b, 0);
  let at = 0;
  return draft.map((s, i) => {
    const duration = (w[i] / sum) * target;
    const step: AgentStep = { ...s, at, duration };
    at += duration;
    return step;
  });
}

const RESULT_NOTES = ['ผ่าน', 'เสร็จสมบูรณ์', 'อัปเดตแล้ว', 'ไม่มี error', 'บันทึกแล้ว'];

const CODE: Record<string, { files: string[]; snippet: string }> = {
  write_code: { files: ['src/api/auth/login.ts', 'src/api/auth/session.ts'],
    snippet: 'export async function login(req: Request) {\n  const { user, pass } = await req.json();\n  const ok = await verify(user, pass);\n  return ok ? issueToken(user) : unauthorized();\n}' },
  design_api: { files: ['docs/api/openapi.yaml'], snippet: 'paths:\n  /auth/login:\n    post: { summary: Login, responses: { "200": { description: OK } } }' },
  run_migration: { files: ['db/migrations/0042_users.sql'], snippet: 'ALTER TABLE users ADD COLUMN last_login TIMESTAMPTZ;' },
  frontend_ui: { files: ['src/ui/GameHud.tsx', 'src/ui/hud.css'], snippet: 'export function GameHud({ score }: { score: number }) {\n  return <div className="hud">Score: {score}</div>;\n}' },
  gameplay: { files: ['Assets/Scripts/PlayerController.cs'], snippet: 'void Update() {\n  var dir = Input.GetAxis("Horizontal");\n  body.velocity = new Vector2(dir * speed, body.velocity.y);\n}' },
  prototype: { files: ['Assets/Proto/Mechanic.cs'], snippet: 'public class Mechanic : MonoBehaviour { public float power = 1.5f; }' },
  engine_optimize: { files: ['engine/render/batcher.cpp'], snippet: '// merge draw calls by material\nbatches.sort(byMaterial);' },
  profile_performance: { files: ['perf/report.json'], snippet: '{ "fps": 60, "frameMs": 16.2 }' },
  ios_app: { files: ['App/ContentView.swift'], snippet: 'struct ContentView: View {\n  var body: some View { Text("Hello") }\n}' },
  swift_ui: { files: ['App/Views/Home.swift'], snippet: 'VStack { Text("Home") }' },
  android_app: { files: ['lib/main.dart'], snippet: 'void main() => runApp(const MyApp());' },
  flutter_ui: { files: ['lib/screens/home.dart'], snippet: 'Scaffold(body: Center(child: Text("Home")))' },
  provision_server: { files: ['infra/main.tf'], snippet: 'resource "server" "game" { size = "c6.large" count = 2 }' },
  deploy: { files: ['.github/workflows/deploy.yml'], snippet: 'run: docker compose up -d --build' },
};
const IMAGE = new Set(['ui_art', 'make_logo', 'character_art', 'animation', 'level_design', 'blockout']);
const NUMBERS = new Set(['calc_budget', 'budget_report', 'query_analytics', 'ads', 'invoice', 'payroll']);
const NEON = ['#22d3ee', '#f472b6', '#a3e635', '#facc15', '#c084fc', '#fb923c', '#34d399', '#60a5fa', '#f87171'];

/** Mock deliverable by skill family: code / image / numbers / text. */
export function makeDeliverable(skill: SkillId, title: string, rng: () => number): Deliverable {
  const code = CODE[skill];
  if (code) return { kind: 'code', files: [...code.files], snippet: code.snippet };
  if (IMAGE.has(skill)) {
    const n = 3 + Math.floor(rng() * 3);
    const o = Math.floor(rng() * NEON.length);
    return { kind: 'image', title, palette: Array.from({ length: n }, (_, i) => NEON[(o + i) % NEON.length]) };
  }
  if (NUMBERS.has(skill)) {
    const amt = () => (Math.round((10 + rng() * 490) * 1000)).toLocaleString('en-US');
    return { kind: 'numbers', rows: [['รายการหลัก', `${amt()} ฿`], ['รายการรอง', `${amt()} ฿`], ['รวม', `${amt()} ฿`]] };
  }
  if (skill === 'run_tests' || skill === 'file_bug') {
    const pass = 20 + Math.floor(rng() * 80);
    return { kind: 'text', text: `${title}: ${pass} tests passed, 0 failed` };
  }
  return { kind: 'text', text: `${title}: เสร็จเรียบร้อย พร้อมส่งต่อ` };
}
