'use client';

import { useOfficeStore } from '@/store/useOfficeStore';
import type { SpeedMult } from '@/services/orchestrator';

const SPEEDS: SpeedMult[] = [0.5, 1, 2, 4];

/** Sim speed segmented control (0.5x / 1x / 2x / 4x). */
export default function SpeedControl() {
  const speed = useOfficeStore((s) => s.speed);
  const setSpeed = useOfficeStore((s) => s.setSpeed);
  return (
    <div role="group" aria-label="Sim speed" className="flex items-center gap-0.5 rounded-lg border border-slate-200/80 bg-white/60 p-0.5">
      {SPEEDS.map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={speed === m}
          onClick={() => setSpeed(m)}
          className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] transition ${
            speed === m ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-white hover:text-slate-800'
          }`}
        >
          {m}x
        </button>
      ))}
    </div>
  );
}
