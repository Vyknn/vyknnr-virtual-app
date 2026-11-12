import { describe, it, expect } from 'vitest';
import { findPath, nearestWalkable } from '@/core/pathfinding';
import type { Cell } from '@/core/types';

const open = () => true;

describe('findPath', () => {
  it('straight path excludes from, includes to', () => {
    expect(findPath({ x: 0, z: 0 }, { x: 2, z: 0 }, open, 5, 5)).toEqual([{ x: 1, z: 0 }, { x: 2, z: 0 }]);
  });
  it('routes around wall column', () => {
    const wall = (c: Cell) => !(c.x === 1 && c.z >= 0 && c.z <= 2);
    const p = findPath({ x: 0, z: 0 }, { x: 2, z: 0 }, wall, 5, 5);
    expect(p).not.toBeNull();
    expect(p!.length).toBe(8);
  });
  it('null when enclosed', () => {
    const w = (c: Cell) => !((c.x === 3 && c.z === 4) || (c.x === 4 && c.z === 3));
    expect(findPath({ x: 0, z: 0 }, { x: 4, z: 4 }, w, 5, 5)).toBeNull();
  });
  it('from === to gives []', () => {
    expect(findPath({ x: 1, z: 1 }, { x: 1, z: 1 }, open, 5, 5)).toEqual([]);
  });
});

describe('nearestWalkable', () => {
  it('returns adjacent walkable for blocked cell', () => {
    const w = (c: Cell) => !(c.x === 2 && c.z === 2);
    const n = nearestWalkable({ x: 2, z: 2 }, w, 5, 5)!;
    expect(Math.abs(n.x - 2) + Math.abs(n.z - 2)).toBe(1);
  });
});
