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

/** Rack nodes whose beam target is unknown until the agent starts walking. */
export interface PendingBeam { nodeId: string; agentId: string }

export function fxFromEvents(state: SimState, events: SimEvent[]): { fx: Fx[]; pending: PendingBeam[] } {
  const fx: Fx[] = [];
  const pending: PendingBeam[] = [];
  for (const e of events) {
    if (e.type === 'node.dispatched') {
      const node = state.nodes[e.nodeId];
      if (node?.workplace === 'rack') { pending.push({ nodeId: e.nodeId, agentId: e.agentId }); continue; }
      const color = (node && state.jobs[node.jobId]?.color) ?? '#ffffff';
      fx.push({ id: `fx${++fxSeq}`, kind: 'beam', from: OFFICE.corePos, to: deskOf(e.agentId).seat, born: state.t, color });
    } else if (e.type === 'handoff') {
      const node = state.nodes[e.toNodeId];
      const color = (node && state.jobs[node.jobId]?.color) ?? '#ffffff';
      fx.push({ id: `fx${++fxSeq}`, kind: 'packet', from: deskOf(e.fromAgentId).cell, to: deskOf(e.toAgentId).cell, born: state.t, color });
    }
  }
  return { fx, pending };
}

/** Resolve pending rack beams: agent walking to this node -> last path cell; node running -> agent cell. */
export function resolvePending(state: SimState, pending: PendingBeam[]): { fx: Fx[]; pending: PendingBeam[] } {
  const fx: Fx[] = [];
  const rest: PendingBeam[] = [];
  for (const p of pending) {
    const node = state.nodes[p.nodeId];
    const agent = state.agents[p.agentId];
    if (!node || !agent || node.status === 'done') continue;
    let to: Cell | null = null;
    if (agent.currentNodeId === p.nodeId && agent.state === 'walking_to_work' && agent.path.length > 0) to = agent.path[agent.path.length - 1];
    else if (node.status === 'running') to = agent.cell;
    if (to) {
      const color = state.jobs[node.jobId]?.color ?? '#ffffff';
      fx.push({ id: `fx${++fxSeq}`, kind: 'beam', from: OFFICE.corePos, to, born: state.t, color });
    } else rest.push(p);
  }
  return { fx, pending: rest };
}

export function pruneFx(fx: Fx[], t: number): Fx[] {
  const kept = fx.filter((f) => t - f.born <= FX_TTL);
  return kept.length === fx.length ? fx : kept;
}

let disconnect: (() => void) | null = null;
let pendingBeams: PendingBeam[] = [];

export function connectService(svc: OrchestratorService): () => void {
  disconnect?.();
  service = svc;
  pendingBeams = [];
  useOfficeStore.setState({ sim: svc.getState() as SimState });
  const unsub = svc.subscribe((s, events) => {
    const state = s as SimState;
    const added = fxFromEvents(state, events);
    const res = resolvePending(state, [...pendingBeams, ...added.pending]);
    pendingBeams = res.pending;
    const newFx = [...added.fx, ...res.fx];
    const cur = useOfficeStore.getState().fx;
    const next = pruneFx(newFx.length ? [...cur, ...newFx] : cur, state.t);
    useOfficeStore.setState({ sim: state, fx: next });
  });
  const off = () => {
    unsub();
    if (service === svc) { service = null; pendingBeams = []; }
    if (disconnect === off) disconnect = null;
  };
  disconnect = off;
  return off;
}

let singleton: MockOrchestratorService | null = null;
/** Lazy singleton. Never starts the clock; UI calls start() client-side. */
export function getOfficeService(): OrchestratorService {
  if (!singleton) singleton = new MockOrchestratorService();
  return singleton;
}
