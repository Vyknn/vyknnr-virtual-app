'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { ROSTER } from '@/core/roster';
import type { AgentDef, ChatMessage, Deliverable } from '@/core/types';
import { useOfficeStore } from '@/store/useOfficeStore';
import { glass, label, monoChip, simClock } from './glass';
import { focusAgent } from './hooks';

const BY_ID = new Map<string, AgentDef>(ROSTER.map((a) => [a.id, a]));
const PLACEHOLDER = 'สั่งงาน AI Core… เช่น ทำ API login ให้เกม Space Run';

function DeliverableCard({ d }: { d: Deliverable }) {
  switch (d.kind) {
    case 'code':
      return (
        <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-slate-900">
          <div className="flex flex-wrap gap-1 border-b border-white/10 px-2 py-1.5">
            {d.files.map((f) => (
              <span key={f} className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-cyan-200">{f}</span>
            ))}
          </div>
          <pre className="max-h-40 overflow-auto px-2.5 py-2 font-mono text-[11px] leading-relaxed text-slate-100">{d.snippet}</pre>
        </div>
      );
    case 'image':
      return (
        <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="h-20" style={{ background: `linear-gradient(135deg, ${d.palette.join(', ')})` }} />
          <div className="flex items-center gap-1.5 px-2 py-1.5">
            {d.palette.map((c, i) => (
              <span key={`${c}${i}`} className="h-3 w-3 rounded-full ring-1 ring-black/10" style={{ background: c }} title={c} />
            ))}
            <span className="ml-1 truncate text-[11px] text-slate-600">{d.title}</span>
          </div>
        </div>
      );
    case 'numbers':
      return (
        <table className="mt-2 w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-[11px]">
          <tbody>
            {d.rows.map(([k, v], i) => (
              <tr key={k + i} className={i === d.rows.length - 1 ? 'border-t border-slate-200 font-semibold' : ''}>
                <td className="px-2 py-1 text-slate-600">{k}</td>
                <td className="px-2 py-1 text-right font-mono tabular-nums text-slate-900">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    case 'text':
      return <div className="mt-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-700">{d.text}</div>;
  }
}

/** Core reasoning/status lines: single-line, job-bound, no deliverable (plan replies and summaries are multi-line). */
const isReasoning = (m: ChatMessage) => m.from === 'core' && !!m.jobId && !m.deliverable && !m.text.includes('\n');

const Message = memo(function Message({ m }: { m: ChatMessage }) {
  if (m.from === 'admin') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-blue-600 px-3 py-2 text-sm text-white shadow-sm">
          <div className="whitespace-pre-wrap break-words">{m.text}</div>
          <div className="mt-0.5 text-right font-mono text-[9px] text-blue-100">admin · {simClock(m.at)}</div>
        </div>
      </div>
    );
  }
  if (m.from === 'core') {
    if (isReasoning(m)) {
      return (
        <div className="flex gap-1.5 pl-1 font-mono text-[11px] leading-snug text-slate-400">
          <span className="text-violet-400">›</span>
          <span className="break-words">{m.text}</span>
        </div>
      );
    }
    return (
      <div className="flex gap-2">
        <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-linear-to-br from-violet-500 to-cyan-500 text-[9px] font-bold text-white">AI</div>
        <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-violet-100 bg-white/80 px-3 py-2 text-sm text-slate-800">
          <div className="mb-0.5 flex items-center gap-1.5">
            <span className="text-xs font-semibold text-violet-700">AI Core</span>
            {m.jobId && <span className="font-mono text-[9px] text-slate-400">{m.jobId}</span>}
            <span className="ml-auto font-mono text-[9px] text-slate-400">{simClock(m.at)}</span>
          </div>
          <div className="whitespace-pre-wrap break-words">{m.text}</div>
          {m.deliverable && <DeliverableCard d={m.deliverable} />}
        </div>
      </div>
    );
  }
  const a = BY_ID.get(m.from);
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => focusAgent(m.from)}
        title={a ? `${a.name} · ${a.title}` : m.from}
        className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[9px] font-bold text-white"
        style={{ background: a?.color ?? '#64748b' }}
      >
        {(a?.name ?? m.from).slice(0, 2).toUpperCase()}
      </button>
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-slate-100/80 px-3 py-1.5 text-sm text-slate-700">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-800">{a?.name ?? m.from}</span>
          <span className="truncate text-[10px] text-slate-400">{a?.title}</span>
          <span className="ml-auto font-mono text-[9px] text-slate-400">{simClock(m.at)}</span>
        </div>
        <div className="break-words">{m.text}</div>
        {m.deliverable && <DeliverableCard d={m.deliverable} />}
      </div>
    </div>
  );
});

function Composer() {
  const [text, setText] = useState('');
  const submit = useOfficeStore((s) => s.submit);
  const send = () => {
    const t = text.trim();
    if (!t) return;
    submit(t);
    setText('');
  };
  return (
    <form
      className="flex items-end gap-2 border-t border-slate-200/70 p-2.5"
      onSubmit={(e) => { e.preventDefault(); send(); }}
    >
      <textarea
        value={text}
        rows={2}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
        }}
        placeholder={PLACEHOLDER}
        aria-label="Command to AI Core"
        className="min-h-[2.5rem] flex-1 resize-none rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
      />
      <button
        type="submit"
        disabled={!text.trim()}
        className="h-10 shrink-0 rounded-xl bg-blue-600 px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        ส่ง
      </button>
    </form>
  );
}

/**
 * Command chat with AI Core. `sim.chat` is copy-on-write in the sim (new array only when a message is
 * appended), so selecting it re-renders exactly when chat.length changes.
 */
export default function ChatPanel({ className = '' }: { className?: string }) {
  const chat = useOfficeStore((s) => s.sim.chat);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.length]);

  return (
    <section className={`${glass} flex min-h-0 flex-col ${className}`}>
      <div className="flex items-center gap-2 px-3.5 pb-1.5 pt-3">
        <span className="text-sm font-semibold text-slate-900">AI Core Chat</span>
        <span className={label}>สั่งงาน</span>
        <span className="ml-auto font-mono text-[10px] text-slate-400">{chat.length} msgs</span>
      </div>
      <div ref={scroller} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-2">
        {chat.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white/50 p-3 text-xs text-slate-500">
            ยังไม่มีงาน ลองพิมพ์คำสั่ง เช่น
            <div className="mt-1.5 flex flex-wrap gap-1">
              {['ทำเกมใหม่แนว puzzle', 'ทำ API login', 'ทำโลโก้'].map((s) => <span key={s} className={monoChip}>{s}</span>)}
            </div>
          </div>
        )}
        {chat.map((m) => <Message key={m.id} m={m} />)}
      </div>
      <Composer />
    </section>
  );
}
