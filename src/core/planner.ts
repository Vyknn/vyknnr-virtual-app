import type { AgentRuntime, DeptId, SkillId } from './types';
import { ROSTER, SKILL_OWNERS } from './roster';

export type Intent = 'new_game'|'feature_backend'|'feature_frontend'|'mobile_app'|'art_asset'|'audio'|'marketing_campaign'|'budget_report'|'bug_fix'|'infra'|'strategy'|'single';
export interface PlanDraftNode { key: string; title: string; skill: SkillId; dependsOn: string[]; workplace: 'desk'|'rack' }
export interface PlanResult { intent: Intent | null; nodes: PlanDraftNode[]; reasoning: string[]; reply: string }

const ALL_DEPTS: DeptId[] = ['ceo','producer','gamedev','graphic','frontend','backend','mobile','qa','sound','marketing','account'];

// ---------- scoring ----------
const CONTEXT_WORDS: { word: string; dept: DeptId }[] = [
  { word: 'เกม', dept: 'gamedev' }, { word: 'game', dept: 'gamedev' },
  { word: 'แอป', dept: 'mobile' }, { word: 'app', dept: 'mobile' },
  { word: 'project', dept: 'producer' }, { word: 'โปรเจกต์', dept: 'producer' },
];
const CONTEXT_SET = new Set(CONTEXT_WORDS.map((c) => c.word));

// dept -> keyword -> weight
const DEPT_KEYWORDS: Record<DeptId, Map<string, number>> = (() => {
  const out = Object.fromEntries(ALL_DEPTS.map((d) => [d, new Map<string, number>()])) as Record<DeptId, Map<string, number>>;
  for (const a of ROSTER) for (const k of a.keywords) {
    const kw = k.toLowerCase();
    out[a.dept].set(kw, CONTEXT_SET.has(kw) ? 1 : 3);
  }
  for (const c of CONTEXT_WORDS) if (!out[c.dept].has(c.word)) out[c.dept].set(c.word, 1);
  return out;
})();

const norm = (t: string) => t.toLowerCase().trim();

export function scoreDepartments(text: string): Record<DeptId, number> {
  const t = norm(text);
  const res = Object.fromEntries(ALL_DEPTS.map((d) => [d, 0])) as Record<DeptId, number>;
  if (!t) return res;
  for (const d of ALL_DEPTS) for (const [kw, w] of DEPT_KEYWORDS[d]) if (t.includes(kw)) res[d] += w;
  return res;
}

// ---------- intent table (declarative) ----------
const NEW_GAME_TRIGGERS = ['ทำเกมใหม่', 'เกมใหม่', 'new game'];

type Pick = { match: string[]; skill: SkillId };
interface IntentDef { intent: Intent; picks: Pick[]; fallback: SkillId; withTests: boolean }

// dept -> ordered intent rules; first rule whose `when` matches (or no `when`) wins
const DEPT_INTENTS: Record<DeptId, { when?: string[]; def: IntentDef }[]> = {
  ceo: [{ def: { intent: 'strategy', picks: [{ match: ['อนุมัติ', 'approve'], skill: 'approve' }], fallback: 'strategy', withTests: false } }],
  producer: [{ def: { intent: 'single', picks: [], fallback: 'breakdown_requirements', withTests: false } }],
  gamedev: [{ def: { intent: 'single', withTests: false, fallback: 'gameplay', picks: [
    { match: ['level', 'ด่าน', 'map'], skill: 'level_design' },
    { match: ['engine', 'performance', 'optimize', 'fps'], skill: 'engine_optimize' },
  ] } }],
  graphic: [{ def: { intent: 'art_asset', withTests: false, fallback: 'ui_art', picks: [
    { match: ['โลโก้', 'logo'], skill: 'make_logo' },
    { match: ['ตัวละคร', 'character', '3d', 'model', 'animation'], skill: 'character_art' },
  ] } }],
  frontend: [{ def: { intent: 'feature_frontend', withTests: true, fallback: 'frontend_ui', picks: [
    { match: ['react', 'next', 'web'], skill: 'write_code' },
  ] } }],
  backend: [
    { when: ['api', 'login', 'auth', 'database', 'db'], def: { intent: 'feature_backend', withTests: true, fallback: 'write_code',
      picks: [{ match: ['migrat'], skill: 'run_migration' }] } },
    { def: { intent: 'infra', withTests: false, fallback: 'provision_server', picks: [{ match: ['deploy'], skill: 'deploy' }] } },
  ],
  mobile: [{ def: { intent: 'mobile_app', withTests: true, fallback: 'ios_app', picks: [
    { match: ['android', 'flutter'], skill: 'android_app' }, { match: ['ios', 'swift', 'iphone'], skill: 'ios_app' },
  ] } }],
  qa: [{ def: { intent: 'bug_fix', withTests: true, fallback: 'write_code', picks: [] } }],
  sound: [{ def: { intent: 'audio', withTests: false, fallback: 'compose_music', picks: [{ match: ['sfx'], skill: 'sfx' }] } }],
  marketing: [{ def: { intent: 'marketing_campaign', withTests: false, fallback: 'campaign', picks: [
    { match: ['ads', 'โฆษณา'], skill: 'ads' }, { match: ['analytics', 'ยอด'], skill: 'query_analytics' },
  ] } }],
  account: [{ def: { intent: 'budget_report', withTests: false, fallback: 'calc_budget', picks: [
    { match: ['invoice', 'ใบแจ้งหนี้'], skill: 'invoice' }, { match: ['เงินเดือน', 'payroll'], skill: 'payroll' },
  ] } }],
};

const SKILL_TITLE: Record<string, string> = {
  breakdown_requirements: 'แตกความต้องการ / เขียนบรีฟ', level_design: 'ออกแบบด่าน', gameplay: 'ทำ gameplay',
  ui_art: 'วาด UI art', character_art: 'ทำตัวละคร', compose_music: 'แต่งเพลง', frontend_ui: 'ทำหน้า UI เกม',
  run_tests: 'ทดสอบระบบ', campaign: 'แคมเปญเปิดตัว', approve: 'อนุมัติขั้นสุดท้าย', write_code: 'เขียนโค้ด',
  make_logo: 'ออกแบบโลโก้', provision_server: 'เปิดเซิร์ฟเวอร์', deploy: 'ดีพลอย', run_migration: 'รัน migration',
  engine_optimize: 'จูนประสิทธิภาพเอนจิน', strategy: 'วางกลยุทธ์', ios_app: 'ทำแอป iOS', android_app: 'ทำแอป Android',
  sfx: 'ทำเอฟเฟกต์เสียง', ads: 'ทำโฆษณา', query_analytics: 'ดึงข้อมูลวิเคราะห์', invoice: 'ออกใบแจ้งหนี้',
  payroll: 'คำนวณเงินเดือน', calc_budget: 'คำนวณงบประมาณ',
};
const title = (s: SkillId) => SKILL_TITLE[s] ?? s;
const RACK = new Set(['deploy', 'run_migration', 'provision_server']);
const node = (key: string, skill: SkillId, dependsOn: string[] = []): PlanDraftNode =>
  ({ key, title: title(skill), skill, dependsOn, workplace: RACK.has(skill) ? 'rack' : 'desk' });

const NEW_GAME_NODES: PlanDraftNode[] = [
  node('brief', 'breakdown_requirements'),
  node('level', 'level_design', ['brief']),
  node('gameplay', 'gameplay', ['brief']),
  node('ui_art', 'ui_art', ['brief']),
  node('chars', 'character_art', ['brief']),
  node('music', 'compose_music', ['brief']),
  node('game_ui', 'frontend_ui', ['ui_art', 'gameplay']),
  node('qa', 'run_tests', ['game_ui', 'level', 'chars', 'music']),
  node('launch', 'campaign', ['qa']),
  node('approve', 'approve', ['launch']),
];

function singleDept(text: string): DeptId | null {
  const s = scoreDepartments(text);
  const strong = ALL_DEPTS.filter((d) => s[d] >= 3);
  return strong.length === 1 ? strong[0] : null;
}

function resolveDef(dept: DeptId, t: string): IntentDef {
  const rules = DEPT_INTENTS[dept];
  return (rules.find((r) => !r.when || r.when.some((w) => t.includes(w))) ?? rules[rules.length - 1]).def;
}

export function detectIntent(text: string): Intent | null {
  const t = norm(text);
  if (!t) return null;
  if (NEW_GAME_TRIGGERS.some((k) => t.includes(k))) return 'new_game';
  const d = singleDept(t);
  return d ? resolveDef(d, t).intent : null;
}

function leaves(nodes: PlanDraftNode[]): string[] {
  const used = new Set(nodes.flatMap((n) => n.dependsOn));
  return nodes.filter((n) => !used.has(n.key)).map((n) => n.key);
}

function buildNodes(intent: Intent, t: string): PlanDraftNode[] {
  if (intent === 'new_game') return NEW_GAME_NODES.map((n) => ({ ...n, dependsOn: [...n.dependsOn] }));
  const d = singleDept(t)!;
  const def = resolveDef(d, t);
  let nodes: PlanDraftNode[];
  if (intent === 'mobile_app') {
    const ios = ['ios', 'swift', 'iphone'].some((k) => t.includes(k));
    const and = ['android', 'flutter'].some((k) => t.includes(k));
    nodes = [node('brief', 'breakdown_requirements')];
    if (ios || !and) nodes.push(node('ios', 'ios_app', ['brief']));
    if (and || !ios) nodes.push(node('android', 'android_app', ['brief']));
  } else {
    const skill = def.picks.find((p) => p.match.some((k) => t.includes(k)))?.skill ?? def.fallback;
    nodes = [node(skill, skill)];
  }
  if (def.withTests) nodes.push(node('tests', 'run_tests', leaves(nodes)));
  return nodes;
}

export function makePlan(text: string): PlanResult {
  const t = norm(text);
  const intent = detectIntent(t);
  if (!intent) {
    return { intent: null, nodes: [], reasoning: [],
      reply: 'ยังไม่แน่ใจว่าต้องการอะไร ขอรายละเอียดเพิ่มหน่อยได้ไหมคะ เช่น "ทำเกมใหม่", "ทำ API login", "ทำโลโก้"' };
  }
  const nodes = buildNodes(intent, t);
  if (nodes.length >= 5 && !nodes.some((n) => n.skill === 'approve')) nodes.push(node('approve', 'approve', leaves(nodes)));
  const parallel = nodes.filter((n) => n.dependsOn.length === 1 && nodes.some((m) => m !== n && m.dependsOn.join() === n.dependsOn.join())).length;
  const reasoning = [
    `วิเคราะห์คำสั่ง: "${text.trim()}"`,
    `จัดเป็นงานประเภท ${intent}`,
    `แตกเป็น ${nodes.length} งานย่อย`,
    parallel > 0 ? `มี ${parallel} งานที่ทำขนานกันได้` : 'งานต่อกันเป็นลำดับ',
    'กำลังหาคนที่เหมาะสมกับแต่ละงาน',
  ];
  const lines = nodes.map((n, i) => `${i + 1}. ${n.title} (${n.skill})`);
  return { intent, nodes, reasoning, reply: `รับทราบค่ะ แผนงานมี ${nodes.length} ขั้นตอน:\n${lines.join('\n')}` };
}

// ---------- assignment ----------
export function pickAssignee(skill: SkillId, text: string, agents: Record<string, AgentRuntime>): string {
  const owners = SKILL_OWNERS[skill];
  if (!owners || owners.length === 0) throw new Error(`No owner for skill: ${skill}`);
  const t = norm(text);
  const kwScore = (id: string) => ROSTER.find((a) => a.id === id)!.keywords.filter((k) => t.includes(k.toLowerCase())).length;
  const isIdle = (id: string) => agents[id]?.state === 'idle';
  const best = owners.reduce((b, id) => (kwScore(id) > kwScore(b) ? id : b), owners[0]);
  if (kwScore(best) > 0 && isIdle(best)) return best;
  const idle = owners.filter(isIdle);
  if (idle.length) return idle.reduce((b, id) => ((agents[id].doneToday < agents[b].doneToday) ? id : b), idle[0]);
  const qlen = (id: string) => agents[id]?.queue.length ?? 0;
  return owners.reduce((b, id) => {
    if (qlen(id) !== qlen(b)) return qlen(id) < qlen(b) ? id : b;
    return kwScore(id) > kwScore(b) ? id : b;
  }, owners[0]);
}
