import { describe, it, expect } from 'vitest';
import { MockOrchestratorService } from '@/services/mockOrchestrator';
import { connectService, useOfficeStore, pruneFx } from '@/store/useOfficeStore';
import { OFFICE } from '@/core/office';

const CMD = 'ทำ API login ให้เกม Space Run';

describe('store', () => {
  it('rack beam targets a rack console', () => {
    const s = new MockOrchestratorService({ seed: 1 });
    const un = connectService(s);
    useOfficeStore.getState().submit('deploy server ใหม่');
    const seen: { x: number; z: number }[] = [];
    for (let i = 0; i < 600; i++) {
      s.advance(0.1);
      for (const f of useOfficeStore.getState().fx) if (f.kind === 'beam') seen.push(f.to);
    }
    const consoles = OFFICE.rackConsoles.map((c) => `${c.x},${c.z}`);
    expect(seen.some((c) => consoles.includes(`${c.x},${c.z}`))).toBe(true);
    un();
  });
  it('reconnect drops previous connection', () => {
    const a = new MockOrchestratorService({ seed: 1 });
    const b = new MockOrchestratorService({ seed: 2 });
    connectService(a);
    const un = connectService(b);
    a.submit(CMD); a.advance(1);
    expect(useOfficeStore.getState().sim).toBe(b.getState());
    un();
  });
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
