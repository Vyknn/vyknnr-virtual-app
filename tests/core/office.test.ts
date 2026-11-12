import { describe, it, expect } from 'vitest';
import { OFFICE, deskOf, isWalkable } from '@/core/office';
import { ROSTER } from '@/core/roster';
import { findPath } from '@/core/pathfinding';
import type { Cell } from '@/core/types';

const walk = (c: Cell) => isWalkable(c);
const { width: W, depth: D } = OFFICE;
const coreNeighbour = (): Cell => {
  const c = OFFICE.corePos;
  return [{ x: c.x + 1, z: c.z }, { x: c.x - 1, z: c.z }, { x: c.x, z: c.z + 1 }, { x: c.x, z: c.z - 1 }].find(walk)!;
};
const reach = (to: Cell) => findPath(coreNeighbour(), to, walk, W, D) !== null;

describe('OFFICE', () => {
  it('grid 44x32', () => {
    expect(W).toBe(44);
    expect(D).toBe(32);
    expect(OFFICE.blocked.length).toBe(32);
    expect(OFFICE.blocked[0].length).toBe(44);
  });
  it('core blocked with walkable neighbour', () => {
    expect(walk(OFFICE.corePos)).toBe(false);
    expect(coreNeighbour()).toBeDefined();
  });
  it('19 desks, one per agent, seats walkable and reachable', () => {
    expect(OFFICE.desks.length).toBe(19);
    for (const a of ROSTER) {
      const d = deskOf(a.id);
      expect(d.agentId).toBe(a.id);
      expect(walk(d.seat)).toBe(true);
      expect(walk(d.cell)).toBe(false);
      expect(reach(d.seat)).toBe(true);
    }
  });
  it('rack consoles walkable, reachable, >=3; racks blocked, >=15', () => {
    expect(OFFICE.rackConsoles.length).toBeGreaterThanOrEqual(3);
    for (const c of OFFICE.rackConsoles) {
      expect(walk(c)).toBe(true);
      expect(reach(c)).toBe(true);
    }
    expect(OFFICE.racks.length).toBeGreaterThanOrEqual(15);
    for (const r of OFFICE.racks) expect(walk(r.cell)).toBe(false);
    expect(new Set(OFFICE.racks.map((r) => r.cell.z)).size).toBeGreaterThanOrEqual(3);
  });
  it('>=19 distinct walkable reachable lounge spots', () => {
    expect(OFFICE.loungeSpots.length).toBeGreaterThanOrEqual(19);
    expect(new Set(OFFICE.loungeSpots.map((s) => `${s.cell.x},${s.cell.z}`)).size).toBe(OFFICE.loungeSpots.length);
    for (const s of OFFICE.loungeSpots) {
      expect(walk(s.cell)).toBe(true);
      expect(reach(s.cell)).toBe(true);
    }
  });
  it('required zones and glass walls', () => {
    const ids = OFFICE.zones.map((z) => z.id);
    for (const id of ['core', 'server', 'lounge', 'meeting', 'ceo']) expect(ids).toContain(id);
    expect(OFFICE.walls.some((w) => w.glass)).toBe(true);
  });
  it('wall cells blocked', () => {
    for (const w of OFFICE.walls) expect(walk(w.from) && walk(w.to)).toBe(false);
  });
  it('isWalkable out of bounds false', () => {
    expect(walk({ x: -1, z: 0 })).toBe(false);
    expect(walk({ x: 0, z: 99 })).toBe(false);
  });
});
