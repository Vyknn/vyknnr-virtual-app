import { describe, it, expect } from 'vitest';
import { MockOrchestratorService } from '@/services/mockOrchestrator';
import { connectService, useOfficeStore, pruneFx } from '@/store/useOfficeStore';
import { OFFICE } from '@/core/office';

const CMD = 'ทำ API login ให้เกม Space Run';

describe('store', () => {
  it('maps dispatch to beams, prunes old fx, unique ids', () => {
    const s = new MockOrchestratorService({ seed: 1 });
    const un = connectService(s);
    useOfficeStore.getState().submit(CMD);
    useOfficeStore.getState().setSpeed(4);
    const kinds = new Set<string>();
    for (let i = 0; i < 400; i++) {
      s.advance(0.1);
      useOfficeStore.getState().fx.forEach((f) => kinds.add(f.kind));
    }
    expect(kinds.has('beam')).toBe(true);
    const { fx, sim } = useOfficeStore.getState();
    expect(fx.every((x) => sim.t - x.born <= 3)).toBe(true);
    expect(new Set(fx.map((x) => x.id)).size).toBe(fx.length);
    un();
  });
  it('beam starts at core', () => {
    const s = new MockOrchestratorService({ seed: 1 });
    const un = connectService(s);
    useOfficeStore.getState().submit(CMD);
    let b;
    for (let i = 0; i < 80 && !b; i++) {
      s.advance(0.1);
      b = useOfficeStore.getState().fx.find((x) => x.kind === 'beam');
    }
    expect(b?.from).toEqual(OFFICE.corePos);
    un();
  });
  it('pruneFx drops old', () => {
    const c = { x: 0, z: 0 };
    expect(pruneFx([{ id: 'a', kind: 'beam', from: c, to: c, born: 0, color: '#fff' }], 3.5)).toEqual([]);
  });
});
