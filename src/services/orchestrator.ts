// Orchestrator service contract. A future `RemoteOrchestratorService` will consume the same
// `SimEvent` stream over SSE and implement this interface unchanged.
import type { SimEvent, SimState } from '@/core/sim';

export type SpeedMult = 0.5 | 1 | 2 | 4;

export interface OrchestratorService {
  submit(command: string): void;
  setSpeed(mult: SpeedMult): void;
  subscribe(listener: (state: Readonly<SimState>, events: SimEvent[]) => void): () => void;
  getState(): Readonly<SimState>;
  start(): void;
  stop(): void;
}
