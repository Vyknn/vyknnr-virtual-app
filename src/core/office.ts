import type { AgentDef, Cell, DeptId } from './types';

export interface Zone { id: DeptId | 'core' | 'server' | 'lounge' | 'meeting'; label: string; rect: { x: number; z: number; w: number; d: number }; color: string }
export interface Desk { id: string; agentId: string; cell: Cell; seat: Cell; facing: number } // seat = walkable cell agent stands/sits on
export interface Office {
  width: number; depth: number; blocked: boolean[][] /* [z][x] */; zones: Zone[];
  desks: Desk[]; rackConsoles: Cell[]; racks: { cell: Cell; facing: number }[]; loungeSpots: { cell: Cell; style: AgentDef['idleStyle'] }[];
  corePos: Cell; walls: { from: Cell; to: Cell; glass: boolean }[];
}

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
type Seg = { from: Cell; to: Cell; glass: boolean };
/** Horizontal wall at z from x1..x2 with gap columns left open. */
function hWall(z: number, x1: number, x2: number, glass: boolean, gaps: number[] = []): Seg[] {
  const out: Seg[] = [];
  let start: number | null = null;
  for (let x = x1; x <= x2 + 1; x++) {
    const open = x > x2 || gaps.includes(x);
    if (!open && start === null) start = x;
    if (open && start !== null) { out.push({ from: c(start, z), to: c(x - 1, z), glass }); start = null; }
  }
  return out;
}
const vWall = (x: number, z1: number, z2: number, glass: boolean): Seg[] => [{ from: c(x, z1), to: c(x, z2), glass }];

const WALLS: Seg[] = [
  // perimeter
  ...hWall(0, 0, W - 1, false), ...hWall(D - 1, 0, W - 1, false),
  ...vWall(0, 1, D - 2, false), ...vWall(W - 1, 1, D - 2, false),
  // CEO glass office (corner), door at x=4
  ...vWall(8, 1, 7, true), ...hWall(7, 1, 8, true, [4]),
  // meeting room, door at x=14
  ...vWall(9, 1, 8, false), ...vWall(19, 1, 8, false), ...hWall(8, 10, 18, false, [14]),
  // server room glass, 2-wide door at x=36..37
  ...vWall(29, 1, 12, true), ...hWall(12, 29, W - 2, true, [36, 37]),
];

function build(): Office {
  const blocked: boolean[][] = Array.from({ length: D }, () => Array<boolean>(W).fill(false));
  const block = (p: Cell) => { blocked[p.z][p.x] = true; };

  for (const w of WALLS) {
    for (let z = Math.min(w.from.z, w.to.z); z <= Math.max(w.from.z, w.to.z); z++)
      for (let x = Math.min(w.from.x, w.to.x); x <= Math.max(w.from.x, w.to.x); x++) block(c(x, z));
  }
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

  return { width: W, depth: D, blocked, zones: ZONES, desks, rackConsoles, racks, loungeSpots: LOUNGE_SPOTS, corePos, walls: WALLS };
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
