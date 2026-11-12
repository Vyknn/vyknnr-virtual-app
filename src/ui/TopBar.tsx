'use client';

import { useMemo, useState } from 'react';
import { ROSTER } from '@/core/roster';
import { useOfficeStore } from '@/store/useOfficeStore';
import { glass } from './glass';
import SpeedControl from './SpeedControl';
import { focusAgent, listEq, useClock, useFps, useThrottledSelector } from './hooks';

const CORE_CHIP = {
  idle: { text: 'Core idle', dot: 'bg-slate-400', cls: 'border-slate-200 bg-slate-50 text-slate-600' },
  thinking: { text: 'Core thinking', dot: 'bg-violet-500 animate-pulse', cls: 'border-violet-200 bg-violet-50 text-violet-700' },
  dispatching: { text: 'Core dispatching', dot: 'bg-cyan-500 animate-pulse', cls: 'border-cyan-200 bg-cyan-50 text-cyan-700' },
} as const;

type Hit = { kind: 'agent' | 'task'; id: string; title: string; sub: string; agentId: string; jobId?: string };
type NodeLite = { id: string; title: string; jobId: string; assigneeId: string };

/** Search agents (name/title/skill) and task nodes (id/title); picking selects + focuses. */
function Search() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const nodes = useThrottledSelector<NodeLite[]>(
    (s) => Object.values(s.sim.nodes).map((n) => ({ id: n.id, title: n.title, jobId: n.jobId, assigneeId: n.assigneeId })),
    listEq,
    2,
  );
  const hits = useMemo<Hit[]>(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    const agents: Hit[] = ROSTER.filter((a) =>
      [a.id, a.name, a.title, a.dept, ...a.skills].some((v) => v.toLowerCase().includes(t)),
    ).map((a) => ({ kind: 'agent', id: a.id, title: a.name, sub: a.title, agentId: a.id }));
    const tasks: Hit[] = nodes
      .filter((n) => n.id.toLowerCase().includes(t) || n.title.toLowerCase().includes(t))
      .slice(-6)
      .reverse()
      .map((n) => ({ kind: 'task', id: n.id, title: n.title, sub: `${n.id} · ${n.jobId}`, agentId: n.assigneeId, jobId: n.jobId }));
    return [...agents.slice(0, 6), ...tasks];
  }, [q, nodes]);

  const pick = (h: Hit) => {
    if (h.jobId) useOfficeStore.getState().selectJob(h.jobId);
    focusAgent(h.agentId);
    setQ('');
    setOpen(false);
  };

  return (
    <div className="relative min-w-0 flex-1 max-w-md">
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && hits[0]) pick(hits[0]);
          if (e.key === 'Escape') { setQ(''); setOpen(false); }
        }}
        placeholder="ค้นหา agent, task… (เช่น Nara, T-1003)"
        aria-label="Search agents and tasks"
        className="w-full rounded-xl border border-slate-200/80 bg-white/70 px-3 py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
      />
      {open && hits.length > 0 && (
        <ul className={`${glass} absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto p-1`}>
          {hits.map((h) => (
            <li key={`${h.kind}:${h.id}`}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(h)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-blue-50"
              >
                <span className={`rounded px-1 font-mono text-[9px] uppercase ${h.kind === 'agent' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                  {h.kind}
                </span>
                <span className="truncate text-sm text-slate-800">{h.title}</span>
                <span className="ml-auto truncate font-mono text-[10px] text-slate-400">{h.sub}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CoreChip() {
  const core = useOfficeStore((s) => s.sim.coreState);
  const running = useOfficeStore((s) => {
    let n = 0;
    for (const j of Object.values(s.sim.jobs)) if (j.status !== 'done') n++;
    return n;
  });
  const c = CORE_CHIP[core];
  return (
    <span className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium sm:inline-flex ${c.cls}`}>
      <span className={`h-2 w-2 rounded-full ${c.dot}`} />
      {c.text}
      <span className="font-mono text-[10px] opacity-70">· {running} jobs</span>
    </span>
  );
}

function ClockFps() {
  const clock = useClock();
  const fps = useFps();
  return (
    <div className="hidden items-center gap-3 md:flex">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
        Live <span className="font-mono tabular-nums">{clock || '--:--:--'}</span>
      </span>
      <span className="font-mono text-xs tabular-nums text-slate-500">
        <b className="font-semibold text-slate-800">{fps}</b> FPS
      </span>
    </div>
  );
}

export default function TopBar() {
  return (
    <header className={`${glass} flex items-center gap-3 px-3 py-2`}>
      <div className="flex shrink-0 items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-linear-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white shadow">
          PF
        </div>
        <div className="hidden leading-tight lg:block">
          <div className="text-sm font-bold text-slate-900">Pixel Forge Studio</div>
          <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">AI Agent Orchestrator</div>
        </div>
      </div>
      <Search />
      <div className="ml-auto flex shrink-0 items-center gap-3">
        <CoreChip />
        <ClockFps />
        <SpeedControl />
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-linear-to-br from-orange-400 to-rose-500 text-xs font-bold text-white">
            AD
          </div>
          <div className="hidden leading-tight xl:block">
            <div className="text-xs font-semibold text-slate-800">Admin</div>
            <div className="text-[10px] text-slate-500">Studio Director</div>
          </div>
        </div>
      </div>
    </header>
  );
}
