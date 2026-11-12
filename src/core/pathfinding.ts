import type { Cell } from './types';

type Walk = (c: Cell) => boolean;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

const inBounds = (x: number, z: number, w: number, d: number) => x >= 0 && z >= 0 && x < w && z < d;

/** 4-neighbour A* (Manhattan). Result excludes `from`, includes `to`. null if unreachable. */
export function findPath(from: Cell, to: Cell, isWalkable: Walk, w: number, d: number): Cell[] | null {
  if (from.x === to.x && from.z === to.z) return [];
  if (!inBounds(to.x, to.z, w, d) || !isWalkable(to)) return null;
  const key = (x: number, z: number) => z * w + x;
  const h = (x: number, z: number) => Math.abs(x - to.x) + Math.abs(z - to.z);
  const g = new Map<number, number>([[key(from.x, from.z), 0]]);
  const parent = new Map<number, number>();
  const closed = new Set<number>();
  const open: { k: number; x: number; z: number; f: number }[] = [{ k: key(from.x, from.z), x: from.x, z: from.z, f: h(from.x, from.z) }];
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (closed.has(cur.k)) continue;
    closed.add(cur.k);
    if (cur.x === to.x && cur.z === to.z) {
      const out: Cell[] = [];
      let k = cur.k;
      while (k !== key(from.x, from.z)) {
        out.push({ x: k % w, z: Math.floor(k / w) });
        k = parent.get(k)!;
      }
      return out.reverse();
    }
    const gc = g.get(cur.k)!;
    for (const [dx, dz] of DIRS) {
      const nx = cur.x + dx, nz = cur.z + dz;
      if (!inBounds(nx, nz, w, d) || !isWalkable({ x: nx, z: nz })) continue;
      const nk = key(nx, nz);
      if (closed.has(nk)) continue;
      const ng = gc + 1;
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng);
        parent.set(nk, cur.k);
        open.push({ k: nk, x: nx, z: nz, f: ng + h(nx, nz) });
      }
    }
  }
  return null;
}

/** BFS rings outward from target; nearest walkable cell (target itself if walkable). */
export function nearestWalkable(target: Cell, isWalkable: Walk, w: number, d: number): Cell | null {
  const seen = new Set<number>([target.z * w + target.x]);
  let frontier: Cell[] = [target];
  while (frontier.length) {
    for (const c of frontier) if (inBounds(c.x, c.z, w, d) && isWalkable(c)) return c;
    const next: Cell[] = [];
    for (const c of frontier) {
      for (const [dx, dz] of DIRS) {
        const nx = c.x + dx, nz = c.z + dz;
        if (!inBounds(nx, nz, w, d)) continue;
        const k = nz * w + nx;
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ x: nx, z: nz });
      }
    }
    frontier = next;
  }
  return null;
}
