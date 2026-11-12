'use client';

import type { Job } from '@/core/types';
import type { OfficeStore } from '@/store/useOfficeStore';
import { simClock } from './glass';
import { nodeProgress, selectFocusJobId, useThrottledSelector } from './hooks';

interface JobView { id: string; command: string; color: string; status: Job['status']; done: number; total: number; running: number; pct: number; age: number }

const STATUS_TH: Record<Job['status'], string> = { planning: 'Planning · วางแผน', running: 'Running · กำลังทำ', done: 'Done · เสร็จแล้ว' };

function selectJobView(s: OfficeStore): JobView | null {
  const id = selectFocusJobId(s);
  const j = id ? s.sim.jobs[id] : undefined;
  if (!j) return null;
  let done = 0, running = 0, sum = 0;
  for (const nid of j.nodeIds) {
    const n = s.sim.nodes[nid];
    if (!n) continue;
    if (n.status === 'done') done++;
    if (n.status === 'running') running++;
    sum += nodeProgress(n);
  }
  const total = j.nodeIds.length;
  return {
    id: j.id, command: j.command, color: j.color, status: j.status, done, total, running,
    pct: total ? Math.round((sum / total) * 100) : 0, age: Math.floor(s.sim.t - j.createdAt),
  };
}

/** Blue gradient "current job" card (reference: CURRENT TASK card). */
export default function JobCard({ className = '' }: { className?: string }) {
  const j = useThrottledSelector(selectJobView);
  return (
    <section
      className={`pointer-events-auto relative overflow-hidden rounded-2xl bg-linear-to-br from-blue-600 via-blue-600 to-indigo-700 p-3.5 text-white shadow-[0_8px_32px_rgba(37,99,235,0.35)] ${className}`}
    >
      <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-white/10" />
      <div className="relative flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-blue-100">Current job · งานปัจจุบัน</span>
        {j && <span className="ml-auto rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-semibold">{STATUS_TH[j.status]}</span>}
      </div>
      {j ? (
        <div className="relative">
          <div className="mt-1 flex items-baseline gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/40" style={{ background: j.color }} />
            <span className="font-mono text-xl font-bold">{j.id}</span>
          </div>
          <div className="mt-0.5 line-clamp-2 text-sm text-blue-50">“{j.command}”</div>
          <div className="mt-2.5 grid grid-cols-3 gap-1.5">
            {[
              ['Nodes done', `${j.done} / ${j.total}`],
              ['Running', String(j.running)],
              ['Elapsed', simClock(j.age)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-white/12 px-2 py-1.5">
                <div className="text-[10px] text-blue-100">{k}</div>
                <div className="font-mono text-sm font-semibold tabular-nums">{v}</div>
              </div>
            ))}
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white" style={{ width: `${j.pct}%`, transition: 'width 250ms linear' }} />
            </div>
            <span className="font-mono text-[11px] tabular-nums">{j.pct}%</span>
          </div>
        </div>
      ) : (
        <div className="relative mt-2 text-sm text-blue-50">ยังไม่มีงาน — สั่งงานผ่านแชตทางซ้าย</div>
      )}
    </section>
  );
}
