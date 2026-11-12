'use client';

import { ROSTER } from '@/core/roster';
import type { NodeStatus } from '@/core/types';
import type { OfficeStore } from '@/store/useOfficeStore';
import { glass, label, NODE_STYLE } from './glass';
import { focusAgent, listEq, useThrottledSelector } from './hooks';

interface Q { id: string; jobId: string; title: string; skill: string; status: NodeStatus; assigneeId: string; color: string }

const AGENT = new Map(ROSTER.map((a) => [a.id, a]));
const RANK: Partial<Record<NodeStatus, number>> = { queued: 0, ready: 1, blocked: 2 };
const MAX = 12;

function selectQueue(s: OfficeStore): Q[] {
  const out: Q[] = [];
  for (const n of Object.values(s.sim.nodes)) {
    if (RANK[n.status] === undefined) continue;
    out.push({ id: n.id, jobId: n.jobId, title: n.title, skill: n.skill, status: n.status, assigneeId: n.assigneeId,
      color: s.sim.jobs[n.jobId]?.color ?? '#94a3b8' });
  }
  out.sort((a, b) => RANK[a.status]! - RANK[b.status]! || a.id.localeCompare(b.id));
  return out.slice(0, MAX);
}

/** Upcoming nodes across all jobs (queued > ready > blocked). */
export default function QueueList({ className = '' }: { className?: string }) {
  const q = useThrottledSelector(selectQueue, listEq, 4);
  return (
    <section className={`${glass} flex min-h-0 flex-col ${className}`}>
      <div className="flex items-center gap-2 px-3.5 pb-1 pt-3">
        <span className={label}>Upcoming · งานถัดไป</span>
        <span className="ml-auto font-mono text-[10px] text-slate-400">{q.length}{q.length === MAX ? '+' : ''}</span>
      </div>
      <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-2.5 pb-2.5">
        {q.length === 0 && <li className="px-1 py-2 text-xs text-slate-400">ไม่มีงานรอคิว</li>}
        {q.map((n) => {
          const a = AGENT.get(n.assigneeId);
          const st = NODE_STYLE[n.status];
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => focusAgent(n.assigneeId)}
                className="flex w-full items-center gap-2 rounded-xl border border-slate-200/70 bg-white/60 px-2.5 py-1.5 text-left hover:bg-white"
              >
                <span className="h-6 w-1 shrink-0 rounded-full" style={{ background: n.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-slate-800">{n.title}</span>
                  <span className="block truncate font-mono text-[9px] text-slate-400">{n.id} · {n.skill} · {a?.name ?? n.assigneeId}</span>
                </span>
                <span className={`shrink-0 rounded px-1.5 py-px text-[9px] font-semibold ${st.pill}`}>{st.th}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
