import type { AgentState, NodeStatus } from '@/core/types';

/** Shared Tailwind class strings for the glassmorphism dashboard (mirrors image.png). */
export const glass =
  'pointer-events-auto rounded-2xl border border-white/60 bg-white/70 shadow-[0_8px_32px_rgba(15,23,42,0.10)] backdrop-blur-xl';
export const inset = 'rounded-xl border border-slate-200/70 bg-white/60';
export const label = 'font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500';
export const subLabel = 'text-[10px] text-slate-400';
export const chip = 'inline-flex items-center rounded-md border border-slate-200/80 bg-white/70 px-1.5 py-0.5 text-[10px] text-slate-600';
export const monoChip = `${chip} font-mono`;
export const btn =
  'inline-flex items-center justify-center rounded-lg border border-slate-200/80 bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40';
export const btnPrimary =
  'inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40';

/** Thai-first agent state badges. */
export const STATE_BADGE: Record<AgentState, { text: string; cls: string; bar: string }> = {
  idle: { text: 'ว่าง', cls: 'bg-slate-100 text-slate-500', bar: 'bg-slate-300' },
  walking_to_work: { text: 'กำลังเดิน', cls: 'bg-amber-100 text-amber-700', bar: 'bg-amber-400' },
  walking_to_lounge: { text: 'กำลังเดิน', cls: 'bg-amber-100 text-amber-700', bar: 'bg-amber-400' },
  working: { text: 'ทำงาน', cls: 'bg-cyan-100 text-cyan-700', bar: 'bg-cyan-500' },
  done: { text: 'เสร็จ', cls: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500' },
};

/** Plan node status colours (SVG fill/stroke + Tailwind pill). */
export const NODE_STYLE: Record<NodeStatus, { fill: string; stroke: string; text: string; pill: string; th: string }> = {
  blocked: { fill: '#f1f5f9', stroke: '#94a3b8', text: '#475569', pill: 'bg-slate-100 text-slate-500', th: 'รอ dependency' },
  ready: { fill: '#fef3c7', stroke: '#f59e0b', text: '#92400e', pill: 'bg-amber-100 text-amber-700', th: 'พร้อม' },
  queued: { fill: '#fef3c7', stroke: '#f59e0b', text: '#92400e', pill: 'bg-amber-100 text-amber-700', th: 'รอคิว' },
  running: { fill: '#cffafe', stroke: '#06b6d4', text: '#155e75', pill: 'bg-cyan-100 text-cyan-700', th: 'กำลังทำ' },
  done: { fill: '#d1fae5', stroke: '#10b981', text: '#065f46', pill: 'bg-emerald-100 text-emerald-700', th: 'เสร็จ' },
};

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

/** Sim seconds -> mm:ss. */
export function simClock(t: number): string {
  const s = Math.max(0, Math.floor(t));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
