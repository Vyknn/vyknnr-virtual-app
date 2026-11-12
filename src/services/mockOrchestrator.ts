import { createInitialState, submitCommand, tick, type SimEvent, type SimState } from '@/core/sim';
import type { OrchestratorService, SpeedMult } from './orchestrator';

type Listener = (state: Readonly<SimState>, events: SimEvent[]) => void;
const MAX_REAL_DT = 0.1;

export class MockOrchestratorService implements OrchestratorService {
  private state: SimState;
  private speed: SpeedMult = 1;
  private listeners = new Set<Listener>();
  private raf: number | null = null;
  private last = 0;
  private now: () => number;

  constructor(opts: { seed?: number; now?: () => number } = {}) {
    this.state = createInitialState(opts.seed ?? 1);
    this.now = opts.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  }

  submit(command: string): void {
    const r = submitCommand(this.state, command);
    this.state = r.state;
    this.emit(r.events);
  }

  setSpeed(mult: SpeedMult): void { this.speed = mult; }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  getState(): Readonly<SimState> { return this.state; }

  /** Advance by real seconds (scaled by speed). Used by the rAF loop and tests. */
  advance(realSeconds: number): void {
    const r = tick(this.state, realSeconds * this.speed);
    const changed = r.state !== this.state;
    this.state = r.state;
    if (changed || r.events.length > 0) this.emit(r.events);
  }

  start(): void {
    if (this.raf !== null || typeof window === 'undefined') return;
    this.last = this.now();
    const loop = () => {
      const n = this.now();
      const dt = Math.min(MAX_REAL_DT, Math.max(0, (n - this.last) / 1000));
      this.last = n;
      this.advance(dt);
      this.raf = window.requestAnimationFrame(loop);
    };
    this.raf = window.requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.raf !== null && typeof window !== 'undefined') window.cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  private emit(events: SimEvent[]): void {
    for (const l of [...this.listeners]) l(this.state, events);
  }
}
