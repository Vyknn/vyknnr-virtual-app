'use client';

import { ROSTER } from '@/core/roster';
import type { NodeStatus } from '@/core/types';
import type { OfficeStore } from '@/store/useOfficeStore';
import { glass, initials, label, NODE_STYLE } from './glass';
import { focusAgent, listEq, selectFocusJobId, useThrottledSelector } from './hooks';

interface GNode { id: string; title: string; status: NodeStatus; assigneeId: string; deps: string }
interface Graph { jobId: string | null; nodes: GNode[] }

const NAME = new Map(ROSTER.map((a) => [a.id, a]));
const W = 132, H = 40, GX = 36, GY = 10, PAD = 8;

function selectGraph(s: OfficeStore): Graph {
  const jobId = selectFocusJobId(s);
  const j = jobId ? s.sim.jobs[jobId] : undefined;
  const nodes: GNode[] = [];
  if (j) {
    for (const id of j.nodeIds) {
      const n = s.sim.nodes[id];
      if (n) nodes.push({ id: n.id, title: n.title, status: n.status, assigneeId: n.assigneeId, deps: n.dependsOn.join(',') });
    }
  }
  return { jobId: jobId ?? null, nodes };
}
const graphEq = (a: Graph, b: Graph) => a.jobId === b.jobId && listEq(a.nodes, b.nodes);

/** Longest-path depth per node (nodes outside the job are ignored as deps). */
function layout(nodes: GNode[]) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const depth = new Map<string, number>();
  const visit = (id: string, stack: Set<string>): number => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    if (stack.has(id)) return 0; // cycle guard
    stack.add(id);
    const n = byId.get(id)!;
    let d = 0;
    for (const p of n.deps ? n.deps.split(',') : []) if (byId.has(p)) d = Math.max(d, visit(p, stack) + 1);
    stack.delete(id);
    depth.set(id, d);
    return d;
  };
  nodes.forEach((n) => visit(n.id, new Set()));
  const cols: string[][] = [];
  for (const n of nodes) (cols[depth.get(n.id)!] ??= []).push(n.id);
  const pos = new Map<string, { x: number; y: number }>();
  const rows = Math.max(1, ...cols.map((c) => c?.length ?? 0));
  const height = PAD * 2 + rows * H + (rows - 1) * GY;
  cols.forEach((col, ci) => {
    const colH = col.length * H + (col.length - 1) * GY;
    const y0 = (height - colH) / 2;
    col.forEach((id, ri) => pos.set(id, { x: PAD + ci * (W + GX), y: y0 + ri * (H + GY) }));
  });
  const width = PAD * 2 + cols.length * W + Math.max(0, cols.length - 1) * GX;
  const edges: { key: string; d: string; done: boolean }[] = [];
  for (const n of nodes) {
    const b = pos.get(n.id)!;
    for (const p of n.deps ? n.deps.split(',') : []) {
      const a = pos.get(p);
      if (!a) continue;
      const x1 = a.x + W, y1 = a.y + H / 2, x2 = b.x, y2 = b.y + H / 2, mx = (x1 + x2) / 2;
      edges.push({ key: `${p}>${n.id}`, d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`, done: byId.get(p)!.status === 'done' });
    }
  }
  return { pos, edges, width, height };
}

/** SVG DAG of the focused job: depth-layered, status-coloured, click node = select + focus assignee. */
export default function PlanGraph({ className = '' }: { className?: string }) {
  const g = useThrottledSelector(selectGraph, graphEq, 4);
  // Re-renders only when the throttled graph changed; layout of <=~12 nodes is trivial.
  const lay = layout(g.nodes);

  return (
    <section className={`${glass} flex min-h-0 min-w-0 flex-col ${className}`}>
      <div className="flex items-center gap-2 px-3.5 pb-1 pt-3">
        <span className="text-sm font-semibold text-slate-900">Plan graph</span>
        <span className={label}>DAG{g.jobId ? ` · ${g.jobId}` : ''}</span>
        <span className="ml-auto hidden gap-2 text-[9px] text-slate-500 sm:flex">
          {(['blocked', 'queued', 'running', 'done'] as const).map((s) => (
            <span key={s} className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm border" style={{ background: NODE_STYLE[s].fill, borderColor: NODE_STYLE[s].stroke }} />
              {s}
            </span>
          ))}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
        {g.nodes.length === 0 ? (
          <div className="grid h-full min-h-16 place-items-center text-xs text-slate-400">
            {g.jobId ? 'AI Core กำลังวางแผน…' : 'ยังไม่มีแผนงาน'}
          </div>
        ) : (
          <svg width={lay.width} height={lay.height} className="block" role="img" aria-label={`Plan graph ${g.jobId}`}>
            <defs>
              <marker id="pg-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0,0 L8,4 L0,8 z" fill="#94a3b8" />
              </marker>
            </defs>
            {lay.edges.map((e) => (
              <path key={e.key} d={e.d} fill="none" stroke={e.done ? '#10b981' : '#94a3b8'} strokeWidth={1.5}
                strokeDasharray={e.done ? undefined : '4 3'} markerEnd="url(#pg-arrow)" />
            ))}
            {g.nodes.map((n) => {
              const p = lay.pos.get(n.id);
              if (!p) return null;
              const st = NODE_STYLE[n.status];
              const a = NAME.get(n.assigneeId);
              return (
                <g key={n.id} transform={`translate(${p.x},${p.y})`} className="cursor-pointer" onClick={() => focusAgent(n.assigneeId)}>
                  <title>{`${n.id} · ${n.title} — ${a?.name ?? n.assigneeId} (${n.status})`}</title>
                  {n.status === 'running' && (
                    <rect x={-3} y={-3} width={W + 6} height={H + 6} rx={12} fill="none" stroke={st.stroke} strokeWidth={2} className="animate-pulse" />
                  )}
                  <rect width={W} height={H} rx={10} fill={st.fill} stroke={st.stroke} strokeWidth={1.25} />
                  <circle cx={18} cy={H / 2} r={11} fill={a?.color ?? '#64748b'} />
                  <text x={18} y={H / 2 + 3.5} textAnchor="middle" fontSize={9} fontWeight={700} fill="#fff">
                    {initials(a?.name ?? n.assigneeId)}
                  </text>
                  <text x={35} y={16} fontSize={10.5} fontWeight={600} fill={st.text}>
                    {n.title.length > 15 ? `${n.title.slice(0, 14)}…` : n.title}
                  </text>
                  <text x={35} y={30} fontSize={9} fill="#64748b" fontFamily="var(--font-mono)">{n.id}</text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </section>
  );
}
