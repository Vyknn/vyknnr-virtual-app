import { describe, expect, it } from 'vitest';
import { ALL_SUGGESTIONS, EXTRA_SUGGESTIONS } from '@/core/commandSuggestions';
import { makePlan } from '@/core/planner';

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
