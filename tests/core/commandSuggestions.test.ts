import { describe, expect, it } from 'vitest';
import { ALL_SUGGESTIONS, EXTRA_SUGGESTIONS, matchSuggestions } from '@/core/commandSuggestions';
import { makePlan } from '@/core/planner';
import { ROSTER } from '@/core/roster';
import { createInitialState, submitCommand, tick } from '@/core/sim';

describe('command suggestions', () => {
  it('has exactly 100 extra commands, all unique', () => {
    expect(EXTRA_SUGGESTIONS).toHaveLength(100);
    expect(new Set(ALL_SUGGESTIONS).size).toBe(ALL_SUGGESTIONS.length);
  });

  it.each(ALL_SUGGESTIONS.map((s) => [s]))('planner understands "%s"', (cmd) => {
    const plan = makePlan(cmd);
    expect(plan.intent).not.toBeNull();
    expect(plan.nodes.length).toBeGreaterThan(0);
  });
});

describe('all hands command', () => {
  it.each([['ให้ทุกคนทำงานทั้งหมด'], ['ทุกคนลุย'], ['all hands'], ['everyone work now']])('"%s" is all_hands', (cmd) => {
    expect(makePlan(cmd).intent).toBe('all_hands');
  });

  it('"ทั้งหมด" alone does not trigger all hands', () => {
    expect(makePlan('แก้บั๊กทั้งหมด').intent).toBe('bug_fix');
  });

  it('gives every agent exactly one pinned task: brief -> parallel -> approve', () => {
    const { nodes } = makePlan('ให้ทุกคนทำงานทั้งหมด');
    expect(nodes).toHaveLength(ROSTER.length);
    expect(new Set(nodes.map((n) => n.assigneeId))).toEqual(new Set(ROSTER.map((a) => a.id)));
    expect(nodes[0]).toMatchObject({ assigneeId: 'mali', dependsOn: [] });
    const last = nodes[nodes.length - 1];
    expect(last).toMatchObject({ assigneeId: 'arthit', skill: 'approve' });
    expect(last.dependsOn).toHaveLength(ROSTER.length - 2);
    for (const n of nodes.slice(1, -1)) expect(n.dependsOn).toEqual([nodes[0].key]);
  });

  it('sim runs each pinned node on its own agent and finishes the job', () => {
    let s = submitCommand(createInitialState(7), 'ให้ทุกคนทำงานทั้งหมด').state;
    const seen = new Set<string>();
    for (let i = 0; i < 4000; i++) {
      s = tick(s, 0.1).state;
      for (const id in s.agents) if (s.agents[id].state === 'working') seen.add(id);
    }
    const job = Object.values(s.jobs)[0];
    expect(job.status).toBe('done');
    for (const nid of job.nodeIds) expect(s.nodes[nid].pinned).toBe(true);
    expect(seen).toEqual(new Set(ROSTER.map((a) => a.id)));
  });
});

describe('matchSuggestions', () => {
  const pool = ['ทำ API login', 'ทำ API ร้านค้า', 'แก้ bug หน้า login', 'ทำโลโก้'];

  it('returns nothing for empty or whitespace input', () => {
    expect(matchSuggestions('', 6, pool)).toEqual([]);
    expect(matchSuggestions('   ', 6, pool)).toEqual([]);
  });

  it('ranks prefix matches before substring matches', () => {
    expect(matchSuggestions('login', 6, pool)).toEqual(['ทำ API login', 'แก้ bug หน้า login']);
    expect(matchSuggestions('ทำ', 6, pool)).toEqual(['ทำ API login', 'ทำ API ร้านค้า', 'ทำโลโก้']);
  });

  it('is case-insensitive and matches all tokens in any order', () => {
    expect(matchSuggestions('api', 6, pool)).toEqual(['ทำ API login', 'ทำ API ร้านค้า']);
    expect(matchSuggestions('login api', 6, pool)).toEqual(['ทำ API login']);
  });

  it('drops exact match and respects limit', () => {
    expect(matchSuggestions('ทำโลโก้', 6, pool)).toEqual([]);
    expect(matchSuggestions('ทำ', 2, pool)).toHaveLength(2);
  });

  it('works against the real list', () => {
    expect(matchSuggestions('ทำเกมใหม่').length).toBe(6);
  });
});
