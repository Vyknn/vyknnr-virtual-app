'use client';

import { useEffect, useState } from 'react';
import { rotateCameraLeft, rotateCameraRight } from '@/scene/cameraControls';
import AgentDetail from './AgentDetail';
import AgentTelemetry from './AgentTelemetry';
import ChatPanel from './ChatPanel';
import { glass } from './glass';
import JobCard from './JobCard';
import KpiCards from './KpiCards';
import PlanGraph from './PlanGraph';
import QueueList from './QueueList';
import TopBar from './TopBar';

function CameraButtons({ uiHidden, onToggleUi }: { uiHidden: boolean; onToggleUi: () => void }) {
  const b = 'grid h-9 w-9 place-items-center rounded-xl text-slate-600 transition hover:bg-white hover:text-slate-900';
  return (
    <div className={`${glass} flex items-center gap-0.5 p-1`} role="group" aria-label="View controls">
      <button
        type="button"
        className={b}
        onClick={onToggleUi}
        aria-pressed={uiHidden}
        title={uiHidden ? 'แสดง UI panel (H)' : 'ซ่อน UI panel (H)'}
        aria-label={uiHidden ? 'Show UI panels' : 'Hide UI panels'}
      >
        {uiHidden ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3l18 18" /><path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1" />
            <path d="M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a10 10 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
          </svg>
        )}
      </button>
      <span className="mx-0.5 h-5 w-px bg-slate-300/70" aria-hidden />
      <button type="button" className={b} onClick={rotateCameraLeft} title="หมุนกล้องซ้าย (Q)" aria-label="Rotate camera left">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" />
        </svg>
      </button>
      <button type="button" className={b} onClick={rotateCameraRight} title="หมุนกล้องขวา (E)" aria-label="Rotate camera right">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" />
        </svg>
      </button>
    </div>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`${glass} px-3 py-2 text-xs font-semibold lg:hidden ${on ? 'text-blue-700 ring-2 ring-blue-200' : 'text-slate-700'}`}
    >
      {children}
    </button>
  );
}

/**
 * Glassmorphism overlay over the full-screen 3D scene. The root is pointer-events-none (inherited), and
 * every panel re-enables pointer events via `glass`, so empty overlay space passes clicks to the canvas.
 * >=1024px: 3-column grid (chat | scene | agents) with KPI row on top and job/plan/queue strip at the bottom.
 * <1024px: side panels collapse behind toggle buttons and open as overlays.
 */
export default function Dashboard() {
  const [left, setLeft] = useState(false);
  const [right, setRight] = useState(false);
  const [uiHidden, setUiHidden] = useState(false);
  const toggleUi = () => setUiHidden((v) => !v);

  // H toggles panels; ignored while typing (chat/search inputs, Thai IME composition).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'h' || e.key === 'H') setUiHidden((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (uiHidden) {
    return (
      <div id="office-ui" className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-3 right-3">
          <CameraButtons uiHidden onToggleUi={toggleUi} />
        </div>
      </div>
    );
  }

  return (
    <div id="office-ui" className="pointer-events-none absolute inset-0 flex flex-col gap-2.5 p-2.5 lg:gap-3 lg:p-3">
      <TopBar />

      {/* <1024px: side-panel toggles + camera buttons */}
      <div className="flex items-start gap-2 lg:hidden">
        <Toggle on={left} onClick={() => { setLeft((v) => !v); setRight(false); }}>แชต AI Core</Toggle>
        <Toggle on={right} onClick={() => { setRight((v) => !v); setLeft(false); }}>Agents</Toggle>
        <div className="ml-auto"><CameraButtons uiHidden={false} onToggleUi={toggleUi} /></div>
      </div>

      <div className="relative min-h-0 flex-1 lg:grid lg:grid-cols-[minmax(300px,340px)_1fr_minmax(300px,340px)] lg:grid-rows-[auto_minmax(0,1fr)_auto] lg:gap-3">
        <div className="hidden sm:block lg:col-span-2 lg:row-start-1">
          <KpiCards />
        </div>

        {/* Left: chat */}
        <aside
          className={`${left ? 'flex' : 'hidden'} absolute inset-x-0 inset-y-0 z-20 min-h-0 flex-col sm:right-auto sm:w-[360px] lg:static lg:z-auto lg:col-start-1 lg:row-start-2 lg:flex lg:w-auto`}
        >
          <ChatPanel className="h-full" />
        </aside>

        {/* Center: free scene area + camera controls */}
        <div className="hidden min-h-0 items-end justify-end lg:col-start-2 lg:row-start-2 lg:flex">
          <CameraButtons uiHidden={false} onToggleUi={toggleUi} />
        </div>

        {/* Right: agent detail + telemetry */}
        <aside
          className={`${right ? 'flex' : 'hidden'} absolute inset-x-0 inset-y-0 z-20 min-h-0 flex-col gap-3 sm:left-auto sm:w-[360px] lg:static lg:z-auto lg:col-start-3 lg:row-span-3 lg:row-start-1 lg:flex lg:w-auto`}
        >
          <div className="max-h-[60%] shrink-0 overflow-y-auto rounded-2xl">
            <AgentDetail />
          </div>
          <AgentTelemetry className="min-h-40 flex-1" />
        </aside>

        {/* Bottom strip */}
        <div className="absolute inset-x-0 bottom-0 grid grid-cols-1 gap-2.5 md:grid-cols-[minmax(260px,1fr)_minmax(0,1.6fr)] lg:static lg:col-span-2 lg:row-start-3 lg:h-[200px] lg:grid-cols-[minmax(260px,1fr)_minmax(0,1.6fr)_minmax(200px,0.9fr)] lg:gap-3">
          <JobCard />
          <PlanGraph className="hidden max-h-[200px] md:flex" />
          <QueueList className="hidden lg:flex" />
        </div>
      </div>

    </div>
  );
}
