import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { createInitialState, type SimEvent, type SimState } from '@/core/sim';
import { OFFICE, deskOf } from '@/core/office';
import type { Cell } from '@/core/types';
import type { OrchestratorService, SpeedMult } from '@/services/orchestrator';
import { MockOrchestratorService } from '@/services/mockOrchestrator';

export interface Fx { id: string; kind: 'beam' | 'packet'; from: Cell; to: Cell; born: number; color: string }
export const FX_TTL = 3; // sim seconds

export interface OfficeStore {
  sim: SimState; speed: number; selectedAgentId: string | null; selectedJobId: string | null; fx: Fx[];
  select(agentId: string | null): void; selectJob(id: string | null): void;
  submit(text: string): void; setSpeed(m: SpeedMult): void;
}

let service: OrchestratorService | null = null;
let fxSeq = 0;

export const useOfficeStore: UseBoundStore<StoreApi<OfficeStore>> = create<OfficeStore>((set) => ({
  sim: createInitialState(1), speed: 1, selectedAgentId: null, selectedJobId: null, fx: [],
  select: (agentId) => set({ selectedAgentId: agentId }),
  selectJob: (id) => set({ selectedJobId: id }),
  submit: (text) => { service?.submit(text); },
  setSpeed: (m) => { service?.setSpeed(m); set({ speed: m }); },
}));

export function fxFromEvents(state: SimState, events: SimEvent[]): Fx[] {
  const out: Fx[] = [];
  for (const e of events) {
    if (e.type === 'node.dispatched') {
      const node = state.nodes[e.nodeId];
      const color = (node && state.jobs[node.jobId]?.color) ?? '#ffffff';
      const agent = state.agents[e.agentId];
      const dest = node?.workplace === 'rack' && agent && agent.path.length > 0
        ? agent.path[agent.path.length - 1] : deskOf(e.agentId).seat;
      out.push({ id: `fx${++fxSeq}`, kind: 'beam', from: OFFICE.corePos, to: dest, born: state.t, color });
    } else if (e.type === 'handoff') {
      const node = state.nodes[e.toNodeId];
      const color = (node && state.jobs[node.jobId]?.color) ?? '#ffffff';
      out.push({ id: `fx${++fxSeq}`, kind: 'packet', from: deskOf(e.fromAgentId).cell, to: deskOf(e.toAgentId).cell, born: state.t, color });
    }
  }
  return out;
}

export function pruneFx(fx: Fx[], t: number): Fx[] {
  const kept = fx.filter((f) => t - f.born <= FX_TTL);
  return kept.length === fx.length ? fx : kept;
}

export function connectService(svc: OrchestratorService): () => void {
  service = svc;
  useOfficeStore.setState({ sim: svc.getState() as SimState });
  const unsub = svc.subscribe((state, events) => {
    const cur = useOfficeStore.getState().fx;
    const next = pruneFx(events.length ? [...cur, ...fxFromEvents(state as SimState, events)] : cur, state.t);
    useOfficeStore.setState({ sim: state as SimState, fx: next });
  });
  return () => { unsub(); if (service === svc) service = null; };
}

let singleton: MockOrchestratorService | null = null;
/** Lazy singleton. Never starts the clock; UI calls start() client-side. */
export function getOfficeService(): OrchestratorService {
  if (!singleton) singleton = new MockOrchestratorService();
  return singleton;
}
