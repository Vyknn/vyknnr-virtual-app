'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import Dashboard from '@/ui/Dashboard';
import { connectService, getOfficeService, useOfficeStore } from '@/store/useOfficeStore';

// WebGL scene is client-only (ssr:false must live in a Client Component in Next 16).
const OfficeScene = dynamic(() => import('@/scene/OfficeScene'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 grid place-items-center text-sm text-slate-500">กำลังโหลดออฟฟิศ…</div>,
});

/** Dev demo (`?demo=1`): submit one command after mount. Module flag survives StrictMode's double effect run. */
let demoSubmitted = false;
const DEMO_COMMAND = 'ทำเกมใหม่แนว puzzle';

/** Client bootstrap: connects the mock orchestrator to the store, starts the sim clock, renders the scene. */
export default function OfficeApp() {
  useEffect(() => {
    const svc = getOfficeService();
    const off = connectService(svc);
    svc.start();
    if (!demoSubmitted && new URLSearchParams(window.location.search).get('demo') === '1') {
      demoSubmitted = true;
      useOfficeStore.getState().submit(DEMO_COMMAND);
    }
    return () => { svc.stop(); off(); };
  }, []);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#e8edf4]">
      <OfficeScene />
      {/* Glassmorphism overlay: pointer-events-none root, re-enabled per panel. */}
      <Dashboard />
    </main>
  );
}
