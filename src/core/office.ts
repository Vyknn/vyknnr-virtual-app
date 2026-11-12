import type { AgentDef, Cell, DeptId } from './types';

export interface Zone { id: DeptId | 'core' | 'server' | 'lounge' | 'meeting'; label: string; rect: { x: number; z: number; w: number; d: number }; color: string }
export interface Desk { id: string; agentId: string; cell: Cell; seat: Cell; facing: number } // seat = walkable cell agent stands/sits on
export interface Office {
  width: number; depth: number; blocked: boolean[][] /* [z][x] */; zones: Zone[];
  desks: Desk[]; rackConsoles: Cell[]; racks: { cell: Cell; facing: number }[]; loungeSpots: { cell: Cell; style: AgentDef['idleStyle'] }[];
  corePos: Cell; walls: Wall[]; doors: Door[]; decor: Decor[];
}
/** `low` = waist-high glass partition (department rooms); `color` tints its glowing top trim. */
export interface Wall { from: Cell; to: Cell; glass: boolean; low?: boolean; color?: string }
/** Two-cell doorway left open in a room's partition (cells stay walkable). */
export interface Door { zoneId: Zone['id']; cells: [Cell, Cell]; color: string }
export type DecorKind = 'plantTall' | 'plantBush' | 'succulent' | 'snakePlant' | 'bookshelf' | 'whiteboard' | 'speaker' | 'trophyShelf';
/** Static prop on one cell (the cell becomes blocked). `face` = direction the prop's front looks (s = +z). */
export interface Decor { cell: Cell; kind: DecorKind; face: 'n' | 'e' | 's' | 'w' }

const W = 44;
const D = 32;
const c = (x: number, z: number): Cell => ({ x, z });

// ---- Zones (declarative) ----
const ZONES: Zone[] = [
  { id: 'ceo', label: 'CEO Office', rect: { x: 1, z: 1, w: 7, d: 6 }, color: '#8b5cf6' },
  { id: 'meeting', label: 'Meeting Room', rect: { x: 10, z: 1, w: 9, d: 7 }, color: '#38bdf8' },
  { id: 'server', label: 'Server Room', rect: { x: 30, z: 1, w: 13, d: 11 }, color: '#22d3ee' },
  { id: 'producer', label: 'Producer', rect: { x: 1, z: 9, w: 6, d: 4 }, color: '#f59e0b' },
  { id: 'gamedev', label: 'Game Dev', rect: { x: 8, z: 9, w: 8, d: 4 }, color: '#ef4444' },
  { id: 'graphic', label: 'Graphic', rect: { x: 20, z: 9, w: 6, d: 4 }, color: '#ec4899' },
  { id: 'core', label: 'AI Core', rect: { x: 19, z: 14, w: 7, d: 5 }, color: '#06b6d4' },
  { id: 'frontend', label: 'Frontend', rect: { x: 1, z: 21, w: 7, d: 4 }, color: '#3b82f6' },
  { id: 'backend', label: 'Backend', rect: { x: 9, z: 21, w: 7, d: 4 }, color: '#10b981' },
  { id: 'mobile', label: 'Mobile', rect: { x: 17, z: 21, w: 7, d: 4 }, color: '#6366f1' },
  { id: 'qa', label: 'QA', rect: { x: 1, z: 26, w: 5, d: 4 }, color: '#84cc16' },
  { id: 'sound', label: 'Sound', rect: { x: 8, z: 26, w: 5, d: 4 }, color: '#a855f7' },
  { id: 'marketing', label: 'Marketing', rect: { x: 16, z: 26, w: 7, d: 4 }, color: '#f97316' },
  { id: 'account', label: 'Account', rect: { x: 24, z: 26, w: 6, d: 4 }, color: '#14b8a6' },
  { id: 'lounge', label: 'Lounge', rect: { x: 31, z: 17, w: 11, d: 12 }, color: '#facc15' },
];

// ---- Desks: [agentId, deskX, deskZ]; seat is directly below (z+1) ----
const DESK_TABLE: [string, number, number][] = [
  ['arthit', 4, 2],
  ['mali', 3, 10],
  ['kai', 9, 10], ['ploy', 11, 10], ['tan', 13, 10],
  ['mint', 21, 10], ['bank', 23, 10],
  ['fah', 3, 22], ['nont', 5, 22],
  ['nara', 10, 22], ['pete', 12, 22],
  ['june', 18, 22], ['ohm', 20, 22],
  ['beam', 3, 27],
  ['jazz', 10, 27],
  ['praew', 18, 27], ['toy', 20, 27],
  ['somchai', 25, 27], ['lin', 27, 27],
];

// ---- Server racks: 3 rows x 5; consoles in front (z+1) of racks at x = 32,36,40 ----
const RACK_XS = [32, 34, 36, 38, 40];
const RACK_ZS = [3, 6, 9];
const CONSOLE_XS = [32, 36, 40];

// ---- Furniture blocked rects: [x, z, w, d] ----
const FURNITURE: [number, number, number, number][] = [
  [12, 3, 5, 3],   // meeting table
  [32, 18, 4, 1],  // sofa A back
  [32, 24, 4, 1],  // sofa B back
  [40, 17, 3, 1],  // coffee counter
  [39, 23, 3, 2],  // ping-pong table
];

const LOUNGE_SPOTS: { cell: Cell; style: AgentDef['idleStyle'] }[] = [
  ...[32, 33, 34, 35].map((x) => ({ cell: c(x, 19), style: 'sofa' as const })),
  ...[32, 33, 34, 35].map((x) => ({ cell: c(x, 23), style: 'sofa' as const })),
  ...[39, 40, 41, 42].map((x) => ({ cell: c(x, 18), style: 'coffee' as const })),
  { cell: c(38, 17), style: 'coffee' },
  { cell: c(38, 23), style: 'pingpong' }, { cell: c(38, 24), style: 'pingpong' },
  { cell: c(42, 22), style: 'pingpong' }, { cell: c(42, 25), style: 'pingpong' },
  { cell: c(37, 27), style: 'chat' }, { cell: c(38, 27), style: 'chat' },
  { cell: c(37, 28), style: 'chat' }, { cell: c(38, 28), style: 'chat' },
  { cell: c(33, 27), style: 'wander' }, { cell: c(34, 27), style: 'wander' }, { cell: c(33, 28), style: 'wander' },
];

// ---- Walls ----
type Seg = Wall;
type Extra = Pick<Wall, 'low' | 'color'>;
/** Straight wall over positions a..b (cell built by `at`), split around `gaps`. */
function runWall(a: number, b: number, at: (i: number) => Cell, glass: boolean, gaps: number[], extra: Extra): Seg[] {
  const out: Seg[] = [];
  let start: number | null = null;
  for (let i = a; i <= b + 1; i++) {
    const open = i > b || gaps.includes(i);
    if (!open && start === null) start = i;
    if (open && start !== null) { out.push({ from: at(start), to: at(i - 1), glass, ...extra }); start = null; }
  }
  return out;
}
/** Horizontal wall at z from x1..x2 with gap columns left open. */
const hWall = (z: number, x1: number, x2: number, glass: boolean, gaps: number[] = [], extra: Extra = {}): Seg[] =>
  runWall(x1, x2, (x) => c(x, z), glass, gaps, extra);
/** Vertical wall at x from z1..z2 with gap rows left open. */
const vWall = (x: number, z1: number, z2: number, glass: boolean, gaps: number[] = [], extra: Extra = {}): Seg[] =>
  z1 > z2 ? [] : runWall(z1, z2, (z) => c(x, z), glass, gaps, extra);

// ---- Department rooms: low glass partitions on the zone's border cells + one 2-wide door ----
// [zoneId, door side, first door cell along that side]. A side lying against the outer wall is skipped (shared).
// Every department has desks on its north interior row and seats on the row below, so all doors sit in the south
// partition right next to the seat row and open onto a corridor: row 13 (AI Core side), row 25 or row 30.
type Side = 'n' | 's' | 'e' | 'w';
const ROOMS: [Zone['id'], Side, number][] = [
  ['producer', 's', 3], ['gamedev', 's', 11], ['graphic', 's', 22],
  ['frontend', 's', 3], ['backend', 's', 11], ['mobile', 's', 19],
  ['qa', 's', 2], ['sound', 's', 10], ['marketing', 's', 19], ['account', 's', 26],
];

function room(id: Zone['id'], side: Side, at: number): { walls: Seg[]; door: Door } {
  const zone = ZONES.find((z) => z.id === id);
  if (!zone) throw new Error(`No zone ${id}`);
  const { x: x1, z: z1, w, d } = zone.rect, x2 = x1 + w - 1, z2 = z1 + d - 1;
  const extra: Extra = { low: true, color: zone.color };
  const gap = (s: Side) => (s === side ? [at, at + 1] : []);
  const n = z1 > 1, s = z2 < D - 2, west = x1 > 1, east = x2 < W - 2; // false = against the outer wall
  const vz1 = n ? z1 + 1 : z1, vz2 = s ? z2 - 1 : z2; // corners belong to the horizontal runs
  const walls = [
    ...(n ? hWall(z1, x1, x2, true, gap('n'), extra) : []),
    ...(s ? hWall(z2, x1, x2, true, gap('s'), extra) : []),
    ...(west ? vWall(x1, vz1, vz2, true, gap('w'), extra) : []),
    ...(east ? vWall(x2, vz1, vz2, true, gap('e'), extra) : []),
  ];
  const cell = (i: number): Cell => (side === 'n' ? c(i, z1) : side === 's' ? c(i, z2) : side === 'w' ? c(x1, i) : c(x2, i));
  return { walls, door: { zoneId: id, cells: [cell(at), cell(at + 1)], color: zone.color } };
}
const BUILT_ROOMS = ROOMS.map(([id, side, at]) => room(id, side, at));

const WALLS: Seg[] = [
  // perimeter
  ...hWall(0, 0, W - 1, false), ...hWall(D - 1, 0, W - 1, false),
  ...vWall(0, 1, D - 2, false), ...vWall(W - 1, 1, D - 2, false),
  // CEO glass office (corner), door at x=4
  ...vWall(8, 1, 7, true), ...hWall(7, 1, 8, true, [4]),
  // meeting room, 2-wide door at x=17..18 (Game Dev's partition now sits below the old x=14 door)
  ...vWall(9, 1, 8, false), ...vWall(19, 1, 8, false), ...hWall(8, 10, 18, false, [17, 18]),
  // server room glass, 2-wide door at x=36..37
  ...vWall(29, 1, 12, true), ...hWall(12, 29, W - 2, true, [36, 37]),
  // department rooms
  ...BUILT_ROOMS.flatMap((r) => r.walls),
];
const DOORS: Door[] = BUILT_ROOMS.map((r) => r.door);

// ---- Decorations (each blocks its cell) ----
// Room props sit on free desk-row cells (dead ends: the seat row below stays the walkway, doors are two rows away).
// Open-floor plants flank doors one cell to the side, never in front of them, and stay out of 1-wide corridors.
const dec = (x: number, z: number, kind: DecorKind, face: Decor['face'] = 's'): Decor => ({ cell: c(x, z), kind, face });
const DECOR: Decor[] = [
  // CEO / meeting / server corners
  dec(1, 1, 'plantTall'), dec(7, 6, 'plantBush'),
  dec(10, 1, 'plantTall'), dec(18, 1, 'plantTall'), dec(18, 4, 'whiteboard', 'w'),
  dec(30, 1, 'snakePlant'), dec(42, 1, 'snakePlant'),
  // department rooms
  dec(1, 10, 'plantTall'), dec(5, 10, 'whiteboard'),          // producer
  dec(14, 10, 'plantBush'), dec(12, 10, 'succulent'),         // game dev
  dec(24, 10, 'plantTall'), dec(22, 10, 'succulent'),         // graphic
  dec(1, 22, 'bookshelf', 'e'), dec(6, 22, 'plantBush'),      // frontend
  dec(14, 22, 'bookshelf', 'w'), dec(11, 22, 'succulent'),    // backend
  dec(22, 22, 'plantTall'), dec(21, 22, 'snakePlant'),        // mobile
  dec(4, 27, 'plantBush'), dec(1, 27, 'succulent'),           // qa
  dec(9, 27, 'speaker'), dec(11, 27, 'speaker'),              // sound
  dec(17, 27, 'trophyShelf', 'e'), dec(21, 27, 'plantTall'),  // marketing
  dec(28, 27, 'snakePlant'), dec(26, 27, 'succulent'),        // account
  // open floor: flanking the north-row doors, west edge, AI Core corners, east side
  dec(2, 13, 'snakePlant'), dec(6, 13, 'plantBush'),
  dec(10, 13, 'snakePlant'), dec(14, 13, 'plantBush'),
  dec(21, 13, 'snakePlant'), dec(25, 13, 'plantBush'),
  dec(1, 16, 'plantTall'), dec(1, 19, 'plantBush'),
  dec(19, 14, 'succulent'), dec(25, 14, 'succulent'), dec(19, 18, 'succulent'), dec(25, 18, 'succulent'),
  dec(28, 19, 'plantTall'), dec(42, 14, 'plantBush'),
  // lounge
  dec(31, 28, 'plantTall'), dec(42, 28, 'plantBush'), dec(31, 17, 'plantTall'), dec(36, 21, 'snakePlant'),
];

function build(): Office {
  const blocked: boolean[][] = Array.from({ length: D }, () => Array<boolean>(W).fill(false));
  const block = (p: Cell) => { blocked[p.z][p.x] = true; };

  for (const w of WALLS) {
    for (let z = Math.min(w.from.z, w.to.z); z <= Math.max(w.from.z, w.to.z); z++)
      for (let x = Math.min(w.from.x, w.to.x); x <= Math.max(w.from.x, w.to.x); x++) block(c(x, z));
  }
  for (const p of DECOR) block(p.cell);
  for (const [x, z, w, d] of FURNITURE) for (let dz = 0; dz < d; dz++) for (let dx = 0; dx < w; dx++) block(c(x + dx, z + dz));

  const desks: Desk[] = DESK_TABLE.map(([agentId, x, z]) => {
    const cell = c(x, z), seat = c(x, z + 1);
    block(cell);
    return { id: `desk-${agentId}`, agentId, cell, seat, facing: Math.atan2(cell.x - seat.x, cell.z - seat.z) };
  });

  const racks = RACK_ZS.flatMap((z) => RACK_XS.map((x) => ({ cell: c(x, z), facing: 0 })));
  racks.forEach((r) => block(r.cell));
  const rackConsoles = RACK_ZS.flatMap((z) => CONSOLE_XS.map((x) => c(x, z + 1)));

  const corePos = c(22, 16);
  block(corePos);

  return { width: W, depth: D, blocked, zones: ZONES, desks, rackConsoles, racks, loungeSpots: LOUNGE_SPOTS, corePos, walls: WALLS, doors: DOORS, decor: DECOR };
}

export const OFFICE: Office = build();

export function deskOf(agentId: string): Desk {
  const d = OFFICE.desks.find((x) => x.agentId === agentId);
  if (!d) throw new Error(`No desk for agent ${agentId}`);
  return d;
}

export function isWalkable(p: Cell): boolean {
  return p.x >= 0 && p.z >= 0 && p.x < OFFICE.width && p.z < OFFICE.depth && !OFFICE.blocked[p.z][p.x];
}
