import { describe, it, expect, vi } from 'vitest';
import { MockOrchestratorService } from '@/services/mockOrchestrator';
import type { SimEvent } from '@/core/sim';

const CMD = 'ทำ API login ให้เกม Space Run';

describe('MockOrchestratorService', () => {
  it('plans job after planning time', () => {
    const s = new MockOrchestratorService({ seed: 1 });
    const evs: SimEvent[] = [];
    s.subscribe((_, e) => evs.push(...e));
    s.submit(CMD);
    s.advance(3);
    expect(evs.some((e) => e.type === 'job.planned')).toBe(true);
  });
  it('finishes job at speed 4', () => {
    const s = new MockOrchestratorService({ seed: 1 });
    s.submit(CMD); s.setSpeed(4);
    for (let i = 0; i < 500; i++) s.advance(0.1);
    expect(Object.values(s.getState().jobs).some((j) => j.status === 'done')).toBe(true);
  });
  it('unsubscribe stops calls', () => {
    const s = new MockOrchestratorService({ seed: 1 });
    const fn = vi.fn();
    const un = s.subscribe(fn);
    s.advance(1);
    const n = fn.mock.calls.length;
    un(); s.advance(1); s.submit(CMD);
    expect(fn.mock.calls.length).toBe(n);
  });
  it('speed scales sim time', () => {
    const a = new MockOrchestratorService({ seed: 1 });
    const b = new MockOrchestratorService({ seed: 1 });
    b.setSpeed(4);
    a.advance(2); b.advance(2);
    expect(b.getState().t).toBeCloseTo(a.getState().t * 4);
  });
});

describe('listener isolation', () => {
  it('throwing listener does not block others', () => {
    const s = new MockOrchestratorService({ seed: 1 });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fn = vi.fn();
    s.subscribe(() => { throw new Error('boom'); });
    s.subscribe(fn);
    s.submit(CMD);
    expect(fn).toHaveBeenCalled();
    err.mockRestore();
  });
});
