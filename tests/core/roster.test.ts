import { describe, it, expect } from 'vitest';
import { ROSTER, agentById, DEPT_LABEL, SKILL_OWNERS } from '@/core/roster';
import type { DeptId } from '@/core/types';

const IDS = ['arthit','mali','kai','ploy','tan','mint','bank','fah','nont','nara','pete','june','ohm','beam','jazz','praew','toy','somchai','lin'];
const DEPTS: DeptId[] = ['ceo','producer','gamedev','graphic','frontend','backend','mobile','qa','sound','marketing','account'];
const count = (d: DeptId) => ROSTER.filter((a) => a.dept === d).length;

describe('roster', () => {
  it('has 19 unique agents with expected ids', () => {
    expect(ROSTER.length).toBe(19);
    expect(new Set(ROSTER.map((a) => a.id)).size).toBe(19);
    expect(new Set(ROSTER.map((a) => a.id))).toEqual(new Set(IDS));
  });
  it('covers every dept with spec counts', () => {
    for (const d of DEPTS) {
      expect(count(d)).toBeGreaterThanOrEqual(1);
      expect(DEPT_LABEL[d]).toBeTruthy();
    }
    expect(count('gamedev')).toBe(3);
    for (const d of ['graphic','frontend','backend','mobile','marketing','account'] as DeptId[]) expect(count(d)).toBe(2);
  });
  it('derives skill owners', () => {
    expect(SKILL_OWNERS.write_code).toEqual(expect.arrayContaining(['nara', 'nont']));
    expect(SKILL_OWNERS.provision_server).toContain('pete');
    expect(SKILL_OWNERS.approve).toEqual(['arthit']);
    expect(SKILL_OWNERS.breakdown_requirements).toEqual(['mali']);
    expect(SKILL_OWNERS.engine_optimize).toEqual(['ploy']);
  });
  it('has enough content per agent', () => {
    for (const a of ROSTER) {
      expect(a.skills.length).toBeGreaterThanOrEqual(2);
      expect(a.tools.length).toBeGreaterThanOrEqual(2);
      expect(a.keywords.length).toBeGreaterThanOrEqual(3);
      expect(a.voice.accept.length).toBeGreaterThanOrEqual(2);
      expect(a.voice.done.length).toBeGreaterThanOrEqual(2);
      for (const k of a.keywords) expect(k).toBe(k.toLowerCase());
    }
    expect(new Set(ROSTER.map((a) => a.color)).size).toBe(19);
  });
  it('agentById works', () => {
    expect(agentById('kai').name).toBe('Kai');
    expect(() => agentById('nope')).toThrow();
    expect(() => agentById('constructor')).toThrow();
    expect(() => agentById('toString')).toThrow();
  });
  it('pins dept per agent id', () => {
    const expected: Record<string, DeptId> = {
      arthit: 'ceo', mali: 'producer', kai: 'gamedev', ploy: 'gamedev', tan: 'gamedev',
      mint: 'graphic', bank: 'graphic', fah: 'frontend', nont: 'frontend',
      nara: 'backend', pete: 'backend', june: 'mobile', ohm: 'mobile', beam: 'qa',
      jazz: 'sound', praew: 'marketing', toy: 'marketing', somchai: 'account', lin: 'account',
    };
    for (const [id, dept] of Object.entries(expected)) expect(agentById(id).dept).toBe(dept);
    expect(Object.keys(expected).length).toBe(19);
  });
});
