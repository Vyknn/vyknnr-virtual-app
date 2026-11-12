import { describe, it, expect } from 'vitest';
import { makeSteps, makeDeliverable } from '@/core/steps';
import { mulberry32 } from '@/core/sim';
import { ROSTER, agentById } from '@/core/roster';

describe('makeSteps', () => {
  it('4-8 steps, ends with output, uses own tools, total 10-40 s (many seeds/agents)', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const a of ROSTER) {
        const rng = mulberry32(seed * 97 + a.id.length);
        const steps = makeSteps({ skill: a.skills[0], title: 'งานทดสอบ' }, a, rng);
        expect(steps.length).toBeGreaterThanOrEqual(4);
        expect(steps.length).toBeLessThanOrEqual(8);
        expect(steps[steps.length - 1].kind).toBe('output');
        const calls = steps.filter((s) => s.kind === 'tool_call');
        expect(calls.length).toBeGreaterThanOrEqual(1);
        for (const c of calls) expect(a.tools).toContain(c.tool);
        const total = steps.reduce((t, s) => t + s.duration, 0);
        expect(total).toBeGreaterThanOrEqual(10);
        expect(total).toBeLessThanOrEqual(40);
        for (const s of steps) expect(s.duration).toBeGreaterThan(0);
        // `at` is the relative start offset, monotonically increasing
        for (let i = 1; i < steps.length; i++) expect(steps[i].at).toBeCloseTo(steps[i - 1].at + steps[i - 1].duration, 9);
      }
    }
  });

  it('deterministic for the same rng seed', () => {
    const a = agentById('nara');
    expect(makeSteps({ skill: 'write_code', title: 'x' }, a, mulberry32(5)))
      .toEqual(makeSteps({ skill: 'write_code', title: 'x' }, a, mulberry32(5)));
  });
});

describe('makeDeliverable', () => {
  it('kind by skill family', () => {
    const r = mulberry32(3);
    expect(makeDeliverable('write_code', 'API login', r).kind).toBe('code');
    expect(makeDeliverable('make_logo', 'โลโก้', r).kind).toBe('image');
    expect(makeDeliverable('calc_budget', 'งบ', r).kind).toBe('numbers');
    expect(makeDeliverable('campaign', 'แคมเปญ', r).kind).toBe('text');
  });
  it('image deliverable has a palette, code has files + snippet', () => {
    const img = makeDeliverable('ui_art', 'UI', mulberry32(1));
    if (img.kind !== 'image') throw new Error('expected image');
    expect(img.palette.length).toBeGreaterThan(0);
    const code = makeDeliverable('write_code', 'API', mulberry32(1));
    if (code.kind !== 'code') throw new Error('expected code');
    expect(code.files.length).toBeGreaterThan(0);
    expect(code.snippet.length).toBeGreaterThan(0);
  });
});
