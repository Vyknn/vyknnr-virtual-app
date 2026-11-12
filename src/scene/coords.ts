import { OFFICE } from '@/core/office';
import type { Cell } from '@/core/types';

/** Office is centered on the world origin. 1 cell = 1 m; y is up; floor at y = 0. */
export const HALF_W = OFFICE.width / 2;
export const HALF_D = OFFICE.depth / 2;

/** World position of the center of a grid cell (x, z) on the floor. Shared by scene, avatars and effects. */
export function cellToWorld(c: Cell): [number, number, number] {
  return [c.x + 0.5 - HALF_W, 0, c.z + 0.5 - HALF_D];
}

/** Same mapping for fractional positions (e.g. `AgentRuntime.pos`, which is in cell units). */
export function posToWorld(p: { x: number; z: number }, y = 0): [number, number, number] {
  return [p.x + 0.5 - HALF_W, y, p.z + 0.5 - HALF_D];
}

/** World-space center of a cell rect {x, z, w, d} (cells inclusive from x..x+w-1). */
export function rectCenterWorld(r: { x: number; z: number; w: number; d: number }, y = 0): [number, number, number] {
  return [r.x + r.w / 2 - HALF_W, y, r.z + r.d / 2 - HALF_D];
}

/** Allocation-free `posToWorld` for per-frame use: writes into `out` and returns it. */
export function posToWorldInto<T extends { set(x: number, y: number, z: number): unknown }>(p: { x: number; z: number }, out: T, y = 0): T {
  out.set(p.x + 0.5 - HALF_W, y, p.z + 0.5 - HALF_D);
  return out;
}
