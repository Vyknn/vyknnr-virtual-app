/**
 * Example commands shown in the chat empty state. Every entry must resolve to a non-null intent in
 * `makePlan` (enforced by tests/core/commandSuggestions.test.ts), so keep keywords aligned with roster.ts.
 */
export const BASE_SUGGESTIONS = ['ให้ทุกคนทำงานทั้งหมด', 'ทำเกมใหม่แนว puzzle', 'ทำ API login', 'ทำโลโก้'] as const;

export const EXTRA_SUGGESTIONS: readonly string[] = [
  // new game (10)
  'ทำเกมใหม่แนว platformer', 'ทำเกมใหม่แนว racing', 'ทำเกมใหม่แนว RPG', 'ทำเกมใหม่แนว tower defense',
  'ทำเกมใหม่แนว roguelike', 'ทำเกมใหม่แนว rhythm', 'ทำเกมใหม่แนว survival', 'ทำเกมใหม่แนว card battle',
  'ทำเกมใหม่แนว idle clicker', 'new game แนว match-3',
  // ceo / strategy (6)
  'วางกลยุทธ์ปีหน้า', 'ทำ roadmap ไตรมาสถัดไป', 'อนุมัติงบโปรเจกต์ใหม่', 'approve แผนเปิดตัว',
  'วาง strategy ตลาดต่างประเทศ', 'อนุมัติ release เวอร์ชัน 2.0',
  // producer (6)
  'เขียน brief เกม Space Run', 'สรุปความต้องการลูกค้า', 'ทำแผนงานสปรินต์หน้า', 'แตก requirements ฟีเจอร์ร้านค้า',
  'เขียน BRD ระบบ guild', 'ทำแผนงาน milestone เดือนหน้า',
  // gamedev (9)
  'ทำ gameplay ระบบต่อสู้', 'ออกแบบ mechanic กระโดดสองชั้น', 'ทำระบบ inventory ใน unity', 'ทำ boss fight ใน unreal',
  'ออกแบบด่าน 1-10', 'ทำ level ใหม่ธีมหิมะ', 'ทำ map โลกเปิด', 'optimize fps ให้ถึง 60', 'จูน engine ลด performance drop',
  // graphic (9)
  'ทำโลโก้ใหม่ให้สตูดิโอ', 'ออกแบบ logo เกม Space Run', 'วาด icon แอป', 'ทำ ui art หน้าเมนู',
  'วาด 2d background ป่า', 'ออกแบบตัวละครหลัก', 'ทำ character ศัตรูใหม่', 'ปั้น 3d model ยานอวกาศ', 'ทำ animation ตัวละครวิ่ง',
  // frontend (8)
  'ทำหน้า leaderboard', 'ทำ page โปรไฟล์ผู้เล่น', 'ปรับ ui หน้าร้านค้า', 'แก้ css ปุ่มบนมือถือ',
  'ทำเว็บ landing ด้วย react', 'ทำ web dashboard ผู้ดูแล', 'อัปเกรด next เวอร์ชันใหม่', 'ทำ frontend ระบบแชท',
  // backend (12)
  'ทำ API ร้านค้า', 'ทำระบบ login ด้วย Google', 'ทำ auth แบบ JWT', 'ออกแบบ database ผู้เล่น',
  'ทำ API leaderboard', 'ทำ login ด้วยเบอร์โทร', 'ทำ api ระบบเพื่อน', 'รัน migration database เวอร์ชันใหม่',
  'migrate db ไป Postgres', 'deploy server ขึ้น production', 'ทำ server multiplayer', 'ตั้ง infra สำหรับ staging',
  // mobile (8)
  'ทำแอป iOS', 'ทำแอป Android', 'พอร์ตเกมลง iphone', 'เขียนแอปด้วย swift',
  'ทำแอปด้วย flutter', 'ทำ mobile app ร้านค้า', 'ทำแอป mobile คู่หูสำหรับเกม', 'ทำ android widget',
  // qa (8)
  'แก้ bug หน้า login', 'เขียน test ระบบร้านค้า', 'หาบั๊กในด่าน 3', 'ทำ qa ก่อนปล่อยเวอร์ชัน',
  'แก้ bug เกมค้างตอนโหลด', 'test ระบบจ่ายเงิน', 'แก้บั๊กเสียงไม่ดัง', 'qa regression ทั้งเกม',
  // sound (8)
  'แต่งเพลงธีมหลัก', 'ทำ music ด่านบอส', 'ทำ sfx กระโดด', 'ทำเสียงปุ่มกด',
  'ทำ sound ประกอบ cutscene', 'แต่งเพลงหน้าเมนู', 'ทำ sfx ระเบิด', 'ทำเสียงบรรยากาศป่า',
  // marketing (8)
  'ทำ campaign เปิดตัวเกม', 'โปรโมทเกมบน social', 'โพสต์ข่าวอัปเดต', 'ทำโฆษณา Facebook',
  'ยิง ads บน TikTok', 'ดู analytics ผู้เล่นใหม่', 'สรุปยอดดาวน์โหลด', 'โปรโมท event วันหยุด',
  // account (8)
  'คำนวณงบโปรเจกต์', 'ทำ budget ไตรมาสหน้า', 'สรุปบัญชีเดือนนี้', 'สรุปค่าใช้จ่ายเซิร์ฟเวอร์',
  'ออก invoice ลูกค้า', 'ทำใบแจ้งหนี้ค่าโฆษณา', 'คำนวณเงินเดือนทีม', 'รัน payroll สิ้นเดือน',
];

export const ALL_SUGGESTIONS: readonly string[] = [...BASE_SUGGESTIONS, ...EXTRA_SUGGESTIONS];

/**
 * Autocomplete: rank suggestions for a partial input. Prefix matches first, then substring matches,
 * then entries containing every whitespace-separated token. Exact matches are dropped (nothing to complete).
 */
export function matchSuggestions(input: string, limit = 6, pool: readonly string[] = ALL_SUGGESTIONS): string[] {
  const q = input.toLowerCase().trim();
  if (!q) return [];
  const tokens = q.split(/\s+/);
  const ranked: { s: string; rank: number; i: number }[] = [];
  pool.forEach((s, i) => {
    const l = s.toLowerCase();
    if (l === q) return;
    const rank = l.startsWith(q) ? 0 : l.includes(q) ? 1 : tokens.every((t) => l.includes(t)) ? 2 : -1;
    if (rank >= 0) ranked.push({ s, rank, i });
  });
  return ranked.sort((a, b) => a.rank - b.rank || a.i - b.i).slice(0, limit).map((r) => r.s);
}
