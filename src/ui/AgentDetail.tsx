'use client';

import { useEffect, useRef } from 'react';
import { agentById, DEPT_LABEL } from '@/core/roster';
import type { AgentState, AgentStep } from '@/core/types';
import { useOfficeStore, type OfficeStore } from '@/store/useOfficeStore';
import { btn, btnPrimary, chip, glass, label, monoChip, STATE_BADGE } from './glass';
import { focusAgent, listEq, nodeProgress, useThrottledSelector } from './hooks';

interface Live {
  state: AgentState; doneToday: number; queue: number;
  nodeId: string | null; nodeTitle: string; jobId: string; progress: number;
  stepIndex: number; stepCount: number;
}
type LogLine = Pick<AgentStep, 'kind' | 'text'>;

const STEP_CLS: Record<AgentStep['kind'], { tag: string; cls: string }> = {
  thinking: { tag: 'think', cls: 'text-violet-300' },
  tool_call: { tag: 'call', cls: 'text-cyan-300' },
  tool_result: { tag: 'result', cls: 'text-emerald-300' },
  output: { tag: 'output', cls: 'text-amber-300' },
};

function liveOf(id: string) {
  return (s: OfficeStore): Live => {
    const a = s.sim.agents[id];
    const n = a?.currentNodeId ? s.sim.nodes[a.currentNodeId] : undefined;
    return {
      state: a?.state ?? 'idle', doneToday: a?.doneToday ?? 0, queue: a?.queue.length ?? 0,
      nodeId: n?.id ?? null, nodeTitle: n?.title ?? '', jobId: n?.jobId ?? '',
      progress: n ? Math.round(nodeProgress(n) * 100) : 0,
      stepIndex: n?.stepIndex ?? 0, stepCount: n?.steps.length ?? 0,
    };
  };
}

function logOf(id: string) {
  return (s: OfficeStore): LogLine[] => {
    const a = s.sim.agents[id];
    const n = a?.currentNodeId ? s.sim.nodes[a.currentNodeId] : undefined;
    if (!n || n.status !== 'running') return [];
    return n.steps.slice(0, n.stepIndex + 1).map((st) => ({ kind: st.kind, text: st.text }));
  };
}

function StepLog({ agentId }: { agentId: string }) {
  const lines = useThrottledSelector(logOf(agentId), listEq, 4);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);
  return (
    <div ref={ref} className="mt-2 max-h-36 overflow-y-auto rounded-lg bg-slate-900 px-2.5 py-2 font-mono text-[10.5px] leading-relaxed">
      {lines.length === 0 ? (
        <div className="text-slate-500">$ รองานอยู่…</div>
      ) : (
        lines.map((l, i) => {
          const c = STEP_CLS[l.kind];
          const last = i === lines.length - 1;
          return (
            <div key={i} className={`flex gap-1.5 ${last ? '' : 'opacity-70'}`}>
              <span className={`shrink-0 ${c.cls}`}>[{c.tag}]</span>
              <span className="break-all text-slate-200">{l.text}</span>
              {last && <span className="animate-pulse text-slate-400">▍</span>}
            </div>
          );
        })
      )}
    </div>
  );
}

function Detail({ agentId }: { agentId: string }) {
  const def = agentById(agentId);
  const live = useThrottledSelector(liveOf(agentId));
  const badge = STATE_BADGE[live.state];
  return (
    <div className="p-3.5">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-bold text-white shadow" style={{ background: def.color }}>
          {def.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className={label}>{DEPT_LABEL[def.dept]}</div>
          <div className="flex items-center gap-2">
            <span className="truncate text-lg font-bold text-slate-900">{def.name}</span>
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${badge.cls}`}>{badge.text}</span>
          </div>
          <div className="truncate text-xs text-slate-500">{def.title} · <span className="font-mono">{def.id}</span></div>
        </div>
      </div>
      <p className="mt-2 text-xs italic text-slate-600">“{def.personality}”</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {def.skills.map((s) => <span key={s} className={`${monoChip} border-blue-200 bg-blue-50 text-blue-700`}>{s}</span>)}
        {def.tools.map((t) => <span key={t} className={monoChip}>{t}</span>)}
      </div>

      <div className="mt-3 rounded-xl border border-slate-200/70 bg-white/60 p-2.5">
        <div className="flex items-center justify-between">
          <span className={label}>งานปัจจุบัน</span>
          {live.nodeId && <span className="font-mono text-[10px] text-slate-400">{live.nodeId} · {live.jobId}</span>}
        </div>
        {live.nodeId ? (
          <>
            <div className="mt-1 truncate text-sm font-semibold text-slate-800">{live.nodeTitle}</div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-linear-to-r from-blue-500 to-cyan-400" style={{ width: `${live.progress}%`, transition: 'width 250ms linear' }} />
              </div>
              <span className="font-mono text-[10px] tabular-nums text-slate-500">{live.progress}%</span>
            </div>
            <div className="mt-0.5 font-mono text-[10px] text-slate-400">
              ขั้นที่ {Math.min(live.stepIndex + 1, live.stepCount)}/{live.stepCount}
              {live.queue > 0 && ` · +${live.queue} ในคิว`}
            </div>
          </>
        ) : (
          <div className="mt-1 text-xs text-slate-500">ไม่มีงานในมือ · เสร็จวันนี้ {live.doneToday}</div>
        )}
        <StepLog agentId={agentId} />
      </div>

      <div className="mt-3 flex gap-2">
        <button type="button" className={`${btnPrimary} flex-1`} onClick={() => focusAgent(agentId)}>โฟกัส</button>
        <button type="button" className={btn} onClick={() => useOfficeStore.getState().select(null)}>ปิด</button>
      </div>
    </div>
  );
}

/** Selected agent card. Keyed on the id so throttled selectors never show the previous agent's frame. */
export default function AgentDetail() {
  const id = useOfficeStore((s) => s.selectedAgentId);
  return (
    <section className={glass}>
      {id ? (
        <Detail key={id} agentId={id} />
      ) : (
        <div className="p-3.5">
          <div className={label}>รายละเอียด Agent</div>
          <p className="mt-1 text-xs text-slate-500">คลิก agent ในฉาก หรือในรายการ Telemetry เพื่อดูรายละเอียด</p>
          <div className={`${chip} mt-2`}>Q / E หมุนกล้อง · ลากเพื่อ pan · scroll เพื่อ zoom</div>
        </div>
      )}
    </section>
  );
}
