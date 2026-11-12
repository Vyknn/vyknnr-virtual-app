'use client';

import { ROSTER } from '@/core/roster';
import type { OfficeStore } from '@/store/useOfficeStore';
import { glass, label, subLabel } from './glass';
import { useThrottledSelector } from './hooks';

interface Kpi { working: number; busy: number; jobs: number; queue: number; doneToday: number }

function selectKpi(s: OfficeStore): Kpi {
  let working = 0, busy = 0, doneToday = 0;
  for (const a of Object.values(s.sim.agents)) {
    if (a.state === 'working') working++;
    if (a.currentNodeId) busy++;
    doneToday += a.doneToday;
  }
  let jobs = 0;
  for (const j of Object.values(s.sim.jobs)) if (j.status !== 'done') jobs++;
  let queue = 0;
  for (const n of Object.values(s.sim.nodes)) if (n.status === 'ready' || n.status === 'queued' || n.status === 'blocked') queue++;
  return { working, busy, jobs, queue, doneToday };
}

const TOTAL = ROSTER.length;

function Card({ title, value, sub, accent }: { title: string; value: React.ReactNode; sub: string; accent?: React.ReactNode }) {
  return (
    <div className={`${glass} flex min-w-0 flex-col justify-between px-3.5 py-2.5`}>
      <div className="text-xs font-medium text-slate-600">{title}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-2xl font-bold tabular-nums text-slate-900">{value}</span>
        {accent}
      </div>
      <div className={`${subLabel} truncate`}>{sub}</div>
    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90" aria-hidden>
      <circle cx="24" cy="24" r={r} fill="none" stroke="#e2e8f0" strokeWidth="5" />
      <circle
        cx="24" cy="24" r={r} fill="none" stroke="url(#kpi-ring)" strokeWidth="5" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
        style={{ transition: 'stroke-dashoffset 400ms ease' }}
      />
      <defs>
        <linearGradient id="kpi-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** KPI row (top-left): agents working, jobs running, nodes in queue, tasks done today, utilization ring. */
export default function KpiCards() {
  const k = useThrottledSelector(selectKpi);
  const util = Math.round((k.busy / TOTAL) * 100);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
      <Card
        title="Agents working"
        value={k.working}
        accent={<span className="text-xs text-slate-500">of {TOTAL}</span>}
        sub="กำลังทำงานอยู่ตอนนี้"
      />
      <Card title="Jobs running" value={k.jobs} sub="งานที่ยังไม่เสร็จ" />
      <Card title="Nodes in queue" value={k.queue} sub="ready · queued · blocked" />
      <Card title="Tasks done today" value={k.doneToday} sub="งานย่อยที่ส่งมอบแล้ว" />
      <div className={`${glass} col-span-2 flex items-center gap-3 px-3.5 py-2.5 sm:col-span-1`}>
        <Ring pct={util} />
        <div className="min-w-0">
          <div className={label}>Utilization</div>
          <div className="text-2xl font-bold tabular-nums text-slate-900">{util}%</div>
          <div className={`${subLabel} truncate`}>{k.busy}/{TOTAL} มีงานในมือ</div>
        </div>
      </div>
    </div>
  );
}
