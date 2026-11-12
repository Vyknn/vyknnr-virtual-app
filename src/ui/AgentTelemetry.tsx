'use client';

import { memo } from 'react';
import { shallow } from 'zustand/shallow';
import { ROSTER } from '@/core/roster';
import type { AgentState } from '@/core/types';
import { useOfficeStore, type OfficeStore } from '@/store/useOfficeStore';
import { glass, label, STATE_BADGE } from './glass';
import { focusAgent, listEq, nodeProgress, useThrottledSelector } from './hooks';

interface Row { id: string; state: AgentState; progress: number; nodeId: string; title: string }

function selectRows(s: OfficeStore): Row[] {
  return ROSTER.map((d) => {
    const a = s.sim.agents[d.id];
    const n = a?.currentNodeId ? s.sim.nodes[a.currentNodeId] : undefined;
    return {
      id: d.id, state: a?.state ?? 'idle',
      progress: n ? Math.round(nodeProgress(n) * 100) : 0,
      nodeId: n?.id ?? '', title: n?.title ?? '',
    };
  });
}

const DEF = new Map(ROSTER.map((d, i) => [d.id, { ...d, idx: i + 1 }]));

const AgentRow = memo(function AgentRow({ r, selected }: { r: Row; selected: boolean }) {
  const d = DEF.get(r.id)!;
  const badge = STATE_BADGE[r.state];
  return (
    <li>
      <button
        type="button"
        onClick={() => focusAgent(r.id)}
        aria-pressed={selected}
        className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition ${
          selected ? 'border-blue-300 bg-blue-50/80 ring-2 ring-blue-100' : 'border-slate-200/70 bg-white/60 hover:bg-white'
        }`}
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg font-mono text-[10px] font-bold text-white" style={{ background: d.color }}>
          {String(d.idx).padStart(2, '0')}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-xs font-semibold text-slate-800">{d.name}</span>
            <span className="truncate text-[10px] text-slate-400">{d.title}</span>
            <span className={`ml-auto shrink-0 rounded px-1.5 py-px text-[10px] font-semibold ${badge.cls}`}>{badge.text}</span>
          </span>
          <span className="mt-1 flex items-center gap-2">
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-slate-200">
              <span className={`block h-full rounded-full ${badge.bar}`} style={{ width: `${r.progress}%`, transition: 'width 250ms linear' }} />
            </span>
            <span className="w-7 text-right font-mono text-[9px] tabular-nums text-slate-500">{r.progress}%</span>
          </span>
          <span className="mt-0.5 block truncate font-mono text-[9px] text-slate-400">
            {r.nodeId ? `${r.nodeId} · ${r.title}` : '—'}
          </span>
        </span>
      </button>
    </li>
  );
}, (a, b) => a.selected === b.selected && shallow(a.r, b.r));

/** All 19 agents: state badge (Thai), node progress, click = select + focus. */
export default function AgentTelemetry({ className = '' }: { className?: string }) {
  const rows = useThrottledSelector(selectRows, listEq);
  const selected = useOfficeStore((s) => s.selectedAgentId);
  return (
    <section className={`${glass} flex min-h-0 flex-col ${className}`}>
      <div className="flex items-baseline gap-2 px-3.5 pb-1.5 pt-3">
        <span className="text-sm font-semibold text-slate-900">Agent Telemetry</span>
        <span className="text-[10px] text-slate-400">สถานะรายคน</span>
        <span className={`${label} ml-auto normal-case`}>click = focus</span>
      </div>
      <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-2.5 pb-2.5">
        {rows.map((r) => <AgentRow key={r.id} r={r} selected={selected === r.id} />)}
      </ul>
    </section>
  );
}
