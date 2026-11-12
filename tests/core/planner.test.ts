import { describe, it, expect } from 'vitest';
import { makePlan, pickAssignee, scoreDepartments, detectIntent } from '@/core/planner';
import { ROSTER } from '@/core/roster';
import type { AgentRuntime, AgentState } from '@/core/types';

function agent(id: string, state: AgentState = 'idle', extra: Partial<AgentRuntime> = {}): AgentRuntime {
  return { id, state, cell: { x: 0, z: 0 }, pos: { x: 0, z: 0 }, path: [], heading: 0,
    currentNodeId: null, queue: [], doneToday: 0, stateTime: 0, ...extra };
}
function agents(over: Record<string, Partial<AgentRuntime>> = {}): Record<string, AgentRuntime> {
  return Object.fromEntries(ROSTER.map((a) => [a.id, agent(a.id, 'idle', over[a.id])]));
}

describe('planner', () => {
  it('API login -> feature_backend with tests', () => {
    const p = makePlan('ทำ API login ให้เกม Space Run');
    expect(p.intent).toBe('feature_backend');
    expect(p.nodes.map((n) => n.skill)).toEqual(['write_code', 'run_tests']);
    expect(p.nodes[1].dependsOn).toEqual([p.nodes[0].key]);
  });
  it('handles no-space Thai', () => {
    expect(makePlan('ทำapi loginให้เกม').intent).toBe('feature_backend');
  });
  it('new_game template', () => {
    const p = makePlan('ทำเกมใหม่แนว puzzle');
    expect(p.intent).toBe('new_game');
    expect(p.nodes.length).toBe(10);
    expect(p.nodes.filter((n) => n.skill === 'approve').length).toBe(1);
    expect(p.nodes[9].skill).toBe('approve');
    expect(p.nodes[0].skill).toBe('breakdown_requirements');
    const brief = p.nodes[0].key;
    for (const s of ['level_design', 'gameplay', 'ui_art', 'character_art', 'compose_music']) {
      expect(p.nodes.find((n) => n.skill === s)!.dependsOn).toEqual([brief]);
    }
    const done = new Set<string>();
    let progress = true;
    while (progress) {
      progress = false;
      for (const n of p.nodes) {
        if (!done.has(n.key) && n.dependsOn.every((d) => done.has(d))) { done.add(n.key); progress = true; }
      }
    }
    expect(done.size).toBe(p.nodes.length);
  });
  it('no match -> null plan', () => {
    for (const t of ['   ', 'สวัสดี']) {
      const p = makePlan(t);
      expect(p.intent).toBeNull();
      expect(p.nodes.length).toBe(0);
      expect(p.reply).toContain('ขอรายละเอียดเพิ่ม');
    }
  });
  it('deploy -> rack node', () => {
    const p = makePlan('deploy server ใหม่');
    const n = p.nodes.find((x) => x.workplace === 'rack');
    expect(n).toBeTruthy();
    expect(['provision_server', 'deploy']).toContain(n!.skill);
  });
  it('logo -> art_asset make_logo', () => {
    const p = makePlan('ทำโลโก้เกม');
    expect(p.intent).toBe('art_asset');
    expect(p.nodes.map((n) => n.skill)).toEqual(['make_logo']);
  });
  it('is deterministic with reasoning 3-5', () => {
    const a = makePlan('ทำเกมใหม่'); const b = makePlan('ทำเกมใหม่');
    expect(a).toEqual(b);
    expect(a.reasoning.length).toBeGreaterThanOrEqual(3);
    expect(a.reasoning.length).toBeLessThanOrEqual(5);
  });
  it('scoring: context words weigh 1', () => {
    const s = scoreDepartments('เกม');
    expect(s.gamedev).toBe(1);
    expect(detectIntent('เกม')).toBeNull();
  });
});

describe('planner fixes', () => {
  it('ASCII word boundaries', () => {
    expect(makePlan('build API login').intent).toBe('feature_backend');
    expect(makePlan('latest uploads').intent).toBeNull();
    expect(makePlan('ทำapi loginให้เกม').intent).toBe('feature_backend');
  });
  it('multi-dept combined plan', () => {
    const p = makePlan('ทำ API login และโลโก้');
    expect(p.intent).toBe('feature_backend');
    const w = p.nodes.find((n) => n.skill === 'write_code')!;
    const l = p.nodes.find((n) => n.skill === 'make_logo')!;
    expect(w.dependsOn).toEqual([]);
    expect(l.dependsOn).toEqual([]);
    expect(p.nodes.find((n) => n.skill === 'run_tests')!.dependsOn).toEqual([w.key]);
  });
  it('mobile_app branch', () => {
    const p = makePlan('ทำแอป android');
    expect(p.intent).toBe('mobile_app');
    expect(p.nodes.map((n) => n.skill)).toEqual(['breakdown_requirements', 'android_app', 'run_tests']);
  });
  it('strategy pick', () => {
    const p = makePlan('ขอ roadmap');
    expect(p.intent).toBe('strategy');
    expect(p.nodes.map((n) => n.skill)).toEqual(['strategy']);
  });
});

describe('pickAssignee', () => {
  it('queues on sole owner', () => {
    expect(pickAssignee('engine_optimize', 'optimize fps', agents())).toBe('ploy');
    expect(pickAssignee('engine_optimize', 'optimize fps', agents({ ploy: { state: 'working' } }))).toBe('ploy');
  });
  it('keyword match then idle fallback', () => {
    expect(pickAssignee('write_code', 'api', agents())).toBe('nara');
    expect(pickAssignee('write_code', 'api', agents({ nara: { state: 'working' } }))).toBe('nont');
  });
  it('shortest queue when none idle', () => {
    const a = agents({ nara: { state: 'working', queue: ['a', 'b'] }, nont: { state: 'working', queue: ['c'] } });
    expect(pickAssignee('write_code', 'api', a)).toBe('nont');
  });
});
