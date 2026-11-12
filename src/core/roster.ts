import type { AgentDef, DeptId, SkillId } from './types';

export const ROSTER: AgentDef[] = [
  { id: 'arthit', name: 'Arthit', dept: 'ceo', title: 'CEO', personality: 'big-picture, decisive; strategy, approvals',
    color: '#c0392b', skills: ['approve', 'strategy'], tools: ['review_plan', 'sign_off', 'market_scan'],
    keywords: ['กลยุทธ์', 'strategy', 'อนุมัติ', 'approve', 'roadmap'], idleStyle: 'wander',
    voice: { accept: ['รับทราบ ตัดสินใจเลย', 'ภาพใหญ่ชัดแล้ว ลุยเลย'], done: ['อนุมัติเรียบร้อย', 'ผ่านครับ เดินหน้าต่อ'] } },
  { id: 'mali', name: 'Mali', dept: 'producer', title: 'Producer', personality: 'organizer; splits big jobs across depts',
    color: '#e67e22', skills: ['breakdown_requirements', 'write_brief'], tools: ['split_tasks', 'write_doc', 'assign_owner'],
    keywords: ['brief', 'requirements', 'plan', 'แผนงาน'], idleStyle: 'chat',
    voice: { accept: ['เดี๋ยวมะลิแบ่งงานให้ค่ะ', 'จัดตารางเรียบร้อย เริ่มเลย'], done: ['แบ่งงานเสร็จแล้วค่ะ', 'บรีฟพร้อมส่งต่อทุกทีม'] } },
  { id: 'kai', name: 'Kai', dept: 'gamedev', title: 'Gameplay Programmer', personality: 'experimental; gameplay, mechanics',
    color: '#27ae60', skills: ['gameplay', 'prototype'], tools: ['unity_editor', 'prototype_mechanic', 'playtest'],
    keywords: ['gameplay', 'mechanic', 'เกม', 'unity', 'unreal'], idleStyle: 'pingpong',
    voice: { accept: ['ลองสูตรใหม่ดูนะ', 'ไอเดียนี้สนุกแน่'], done: ['เมคานิกใหม่เสร็จแล้ว ลองเล่นดู', 'เล่นได้แล้ว!'] } },
  { id: 'ploy', name: 'Ploy', dept: 'gamedev', title: 'Engine Programmer', personality: 'deep-diver; engine, performance',
    color: '#16a085', skills: ['engine_optimize', 'profile_performance'], tools: ['profiler', 'shader_compiler', 'memory_tracer'],
    keywords: ['engine', 'performance', 'optimize', 'fps'], idleStyle: 'coffee',
    voice: { accept: ['ขอขุดลึกหน่อยนะคะ', 'เดี๋ยวดู profiler ก่อน'], done: ['เฟรมเรตนิ่งแล้วค่ะ', 'จูนเสร็จ ลื่นขึ้นเยอะ'] } },
  { id: 'tan', name: 'Tan', dept: 'gamedev', title: 'Level Designer', personality: 'thoughtful; level design',
    color: '#2ecc71', skills: ['level_design', 'blockout'], tools: ['level_editor', 'blockout_map', 'flow_graph'],
    keywords: ['level', 'ด่าน', 'map'], idleStyle: 'sofa',
    voice: { accept: ['ขอคิดเส้นทางผู้เล่นก่อน', 'เดี๋ยววางด่านให้'], done: ['ด่านวางเสร็จแล้ว', 'ลองเดินดูได้เลย'] } },
  { id: 'mint', name: 'Mint', dept: 'graphic', title: '2D / UI Artist', personality: '2D, UI art, logo',
    color: '#1abc9c', skills: ['ui_art', 'make_logo'], tools: ['generate_image', 'vector_editor', 'palette_picker'],
    keywords: ['โลโก้', 'logo', 'ui art', 'icon', '2d'], idleStyle: 'chat',
    voice: { accept: ['ได้เลยค่ะ ขอสเก็ตช์ก่อนนะ', 'สีสวยๆ มาแน่'], done: ['โลโก้เสร็จแล้วค่ะ', 'อาร์ตพร้อมส่ง'] } },
  { id: 'bank', name: 'Bank', dept: 'graphic', title: '3D Artist', personality: '3D, character, animation',
    color: '#8e44ad', skills: ['character_art', 'animation'], tools: ['blender', 'sculpt_tool', 'rig_tool'],
    keywords: ['ตัวละคร', 'character', '3d', 'model', 'animation'], idleStyle: 'wander',
    voice: { accept: ['ปั้นตัวละครให้เลย', 'ขอเวลาขึ้นโมเดลหน่อย'], done: ['โมเดลเสร็จแล้ว หมุนดูได้', 'แอนิเมชันเรียบร้อย'] } },
  { id: 'fah', name: 'Fah', dept: 'frontend', title: 'Frontend Designer-Dev', personality: 'detail-oriented; UI, animation',
    color: '#3498db', skills: ['frontend_ui', 'animation'], tools: ['css_inspector', 'figma_sync', 'storybook'],
    keywords: ['หน้า', 'page', 'ui', 'css', 'animation'], idleStyle: 'coffee',
    voice: { accept: ['ขอเช็กพิกเซลละเอียดนะคะ', 'รับค่ะ ขอจัดระยะให้เป๊ะ'], done: ['หน้าเสร็จแล้ว เป๊ะทุกพิกเซล', 'อนิเมชันลื่นแล้วค่ะ'] } },
  { id: 'nont', name: 'Nont', dept: 'frontend', title: 'Web Developer', personality: 'fast; React, web',
    color: '#2980b9', skills: ['write_code', 'frontend_ui'], tools: ['code_editor', 'npm_run', 'browser_preview'],
    keywords: ['react', 'web', 'next', 'frontend'], idleStyle: 'pingpong',
    voice: { accept: ['เดี๋ยวเสร็จเร็วๆ', 'จัดไป!'], done: ['ขึ้นเว็บแล้ว!', 'เสร็จไวใช่มั้ย'] } },
  { id: 'nara', name: 'Nara', dept: 'backend', title: 'Backend Developer', personality: 'calm; API, auth, DB',
    color: '#34495e', skills: ['design_api', 'write_code', 'run_migration'], tools: ['api_designer', 'code_editor', 'db_console'],
    keywords: ['api', 'login', 'auth', 'database', 'db'], idleStyle: 'sofa',
    voice: { accept: ['ใจเย็นๆ เดี๋ยวจัดการให้', 'รับทราบ ขอออกแบบก่อน'], done: ['API พร้อมใช้งาน', 'ฐานข้อมูลเรียบร้อยดี'] } },
  { id: 'pete', name: 'Pete', dept: 'backend', title: 'Infra / Server Engineer', personality: 'server, multiplayer, infra',
    color: '#7f8c8d', skills: ['provision_server', 'deploy'], tools: ['terminal', 'docker', 'load_balancer'],
    keywords: ['server', 'multiplayer', 'deploy', 'infra'], idleStyle: 'coffee',
    voice: { accept: ['เปิดเซิร์ฟเวอร์ให้เลย', 'ขอดูโหลดก่อนนะ'], done: ['ดีพลอยเสร็จ เซิร์ฟเวอร์ขึ้นแล้ว', 'ออนไลน์เรียบร้อย'] } },
  { id: 'june', name: 'June', dept: 'mobile', title: 'iOS Developer', personality: 'iOS, Swift',
    color: '#e84393', skills: ['ios_app', 'swift_ui'], tools: ['xcode', 'swift_compiler', 'simulator'],
    keywords: ['ios', 'swift', 'iphone'], idleStyle: 'chat',
    voice: { accept: ['รับค่ะ เดี๋ยวเขียน Swift ให้', 'ขอเปิด Xcode แป๊บ'], done: ['แอป iOS รันบน simulator แล้ว', 'บิลด์ผ่านค่ะ'] } },
  { id: 'ohm', name: 'Ohm', dept: 'mobile', title: 'Android Developer', personality: 'Android, Flutter',
    color: '#a3cb38', skills: ['android_app', 'flutter_ui'], tools: ['android_studio', 'flutter_cli', 'emulator'],
    keywords: ['android', 'flutter', 'mobile', 'แอป'], idleStyle: 'wander',
    voice: { accept: ['ได้เลยครับ Flutter จัดไป', 'เดี๋ยวลงมือเลย'], done: ['แอป Android เสร็จแล้วครับ', 'รันบน emulator ผ่าน'] } },
  { id: 'beam', name: 'Beam', dept: 'qa', title: 'QA Engineer', personality: 'nitpicker; testing, bugs',
    color: '#f1c40f', skills: ['run_tests', 'file_bug'], tools: ['test_runner', 'bug_tracker', 'device_farm'],
    keywords: ['test', 'bug', 'บั๊ก', 'qa'], idleStyle: 'sofa',
    voice: { accept: ['ขอไล่เช็กทุกซอกทุกมุม', 'เดี๋ยวหาบั๊กให้'], done: ['เทสต์ผ่านแล้ว แต่ยังจับตาดูอยู่', 'เจอบั๊กเล็กๆ ลงรายงานแล้ว'] } },
  { id: 'jazz', name: 'Jazz', dept: 'sound', title: 'Sound Designer', personality: 'music, SFX',
    color: '#d35400', skills: ['compose_music', 'sfx'], tools: ['daw', 'synth', 'sample_library'],
    keywords: ['เสียง', 'sound', 'music', 'เพลง', 'sfx'], idleStyle: 'wander',
    voice: { accept: ['ขอจังหวะหน่อยนะ', 'ได้เลย เดี๋ยวแต่งเพลงให้'], done: ['เพลงเสร็จแล้ว ฟังดู', 'เอฟเฟกต์เสียงพร้อม'] } },
  { id: 'praew', name: 'Praew', dept: 'marketing', title: 'Social Marketer', personality: 'talker; social, campaigns',
    color: '#fd79a8', skills: ['campaign', 'social_post'], tools: ['social_scheduler', 'copywriter', 'trend_tracker'],
    keywords: ['โปรโมท', 'campaign', 'social', 'โพสต์'], idleStyle: 'chat',
    voice: { accept: ['โอ๊ย สนุกเลย เดี๋ยวโปรโมทให้!', 'เรื่องนี้แพรวถนัดเลยค่ะ'], done: ['แคมเปญปล่อยแล้วค่ะ ปังมาก!', 'โพสต์ขึ้นแล้วนะคะ'] } },
  { id: 'toy', name: 'Toy', dept: 'marketing', title: 'Data / Ads Analyst', personality: 'data, ads, analytics',
    color: '#00cec9', skills: ['query_analytics', 'ads'], tools: ['sql_console', 'ads_manager', 'dashboard'],
    keywords: ['ads', 'โฆษณา', 'analytics', 'ยอด'], idleStyle: 'coffee',
    voice: { accept: ['ขอดูข้อมูลก่อนนะ', 'รับครับ เดี๋ยวดึงตัวเลข'], done: ['ตัวเลขออกแล้วครับ', 'ยิงแอดเรียบร้อย'] } },
  { id: 'somchai', name: 'Somchai', dept: 'account', title: 'Accountant', personality: 'careful; budget, cost',
    color: '#6c5ce7', skills: ['calc_budget', 'budget_report'], tools: ['spreadsheet', 'calculator', 'ledger'],
    keywords: ['งบ', 'budget', 'บัญชี', 'ค่าใช้จ่าย'], idleStyle: 'coffee',
    voice: { accept: ['ขอตรวจตัวเลขให้รอบคอบก่อน', 'รับครับ ขอเช็กงบ'], done: ['งบคำนวณเสร็จ ตรวจสองรอบแล้ว', 'ตัวเลขตรงทุกบรรทัด'] } },
  { id: 'lin', name: 'Lin', dept: 'account', title: 'Billing / Payroll', personality: 'invoices, payroll',
    color: '#b2bec3', skills: ['invoice', 'payroll'], tools: ['invoice_generator', 'payroll_system', 'spreadsheet'],
    keywords: ['invoice', 'ใบแจ้งหนี้', 'เงินเดือน', 'payroll'], idleStyle: 'sofa',
    voice: { accept: ['รับค่ะ เดี๋ยวออกเอกสารให้', 'ขอเช็กรายการก่อนนะคะ'], done: ['ใบแจ้งหนี้ออกแล้วค่ะ', 'เงินเดือนเรียบร้อย'] } },
];

const BY_ID: Record<string, AgentDef> = Object.fromEntries(ROSTER.map((a) => [a.id, a]));

export function agentById(id: string): AgentDef {
  const a = BY_ID[id];
  if (!a) throw new Error(`Unknown agent: ${id}`);
  return a;
}

export const DEPT_LABEL: Record<DeptId, string> = {
  ceo: 'ผู้บริหาร / Executive',
  producer: 'โปรดิวเซอร์ / Producer',
  gamedev: 'พัฒนาเกม / Game Dev',
  graphic: 'กราฟิก / Graphic',
  frontend: 'หน้าบ้าน / Frontend',
  backend: 'หลังบ้าน / Backend',
  mobile: 'โมบายล์ / Mobile',
  qa: 'ทดสอบ / QA',
  sound: 'เสียง / Sound',
  marketing: 'การตลาด / Marketing',
  account: 'บัญชี / Account',
};

export const SKILL_OWNERS: Record<SkillId, string[]> = (() => {
  const m: Record<SkillId, string[]> = {};
  for (const a of ROSTER) for (const s of a.skills) (m[s] ??= []).push(a.id);
  return m;
})();
