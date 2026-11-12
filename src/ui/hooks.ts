'use client';

import { useEffect, useRef, useState } from 'react';
import { shallow } from 'zustand/shallow';
import { useOfficeStore, type OfficeStore } from '@/store/useOfficeStore';
import { focusCameraOn } from '@/scene/cameraControls';
import type { TaskNode } from '@/core/types';

export type Eq<T> = (a: T, b: T) => boolean;

/** Element-wise shallow equality for arrays of flat objects. */
export function listEq<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!shallow(a[i], b[i])) return false;
  return true;
}

/**
 * Polls `selector(getState())` at `hz` and sets local state only when `eq` says the value changed.
 * For continuously changing sim data (progress, KPIs) so components never re-render per frame.
 * The selector may close over props; a new selector is picked up on the next poll (key the component
 * on the prop when a stale frame is unacceptable). `T` must not be a function.
 */
export function useThrottledSelector<T>(selector: (s: OfficeStore) => T, eq: Eq<T> = shallow, hz = 5): T {
  const selRef = useRef(selector);
  const eqRef = useRef(eq);
  useEffect(() => {
    selRef.current = selector;
    eqRef.current = eq;
  });
  const [value, setValue] = useState<T>(() => selector(useOfficeStore.getState()));
  useEffect(() => {
    const id = window.setInterval(() => {
      const next = selRef.current(useOfficeStore.getState());
      setValue((prev) => (eqRef.current(prev, next) ? prev : next));
    }, 1000 / hz);
    return () => window.clearInterval(id);
  }, [hz]);
  return value;
}

/** Real FPS from a rAF counter, published at 2 Hz. */
export function useFps(): number {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let raf = 0;
    let frames = 0;
    let last = performance.now();
    const loop = (now: number) => {
      frames++;
      if (now - last >= 500) {
        const f = Math.round((frames * 1000) / (now - last));
        frames = 0;
        last = now;
        setFps((p) => (p === f ? p : f));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return fps;
}

/** Wall clock HH:MM:SS, 1 Hz. Empty until mounted (avoids SSR hydration mismatch). */
export function useClock(): string {
  const [now, setNow] = useState('');
  useEffect(() => {
    const fmt = () => new Date().toLocaleTimeString('en-GB', { hour12: false });
    const id = window.setInterval(() => setNow(fmt()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/** Node completion 0..1 from step index + elapsed fraction of the current step. */
export function nodeProgress(n: TaskNode): number {
  if (n.status === 'done') return 1;
  if (n.status !== 'running' || n.steps.length === 0) return 0;
  const step = n.steps[n.stepIndex];
  const frac = step ? Math.min(1, n.stepElapsed / Math.max(step.duration, 1e-6)) : 0;
  return Math.min(1, (n.stepIndex + frac) / n.steps.length);
}

/** Job shown by JobCard/PlanGraph: selected job, else latest running/planning job, else latest job. Returns a primitive. */
export function selectFocusJobId(s: OfficeStore): string | null {
  const { selectedJobId, sim } = s;
  if (selectedJobId && sim.jobs[selectedJobId]) return selectedJobId;
  let active: { id: string; at: number } | null = null;
  let latest: { id: string; at: number } | null = null;
  for (const j of Object.values(sim.jobs)) {
    if (!latest || j.createdAt >= latest.at) latest = { id: j.id, at: j.createdAt };
    if (j.status !== 'done' && (!active || j.createdAt >= active.at)) active = { id: j.id, at: j.createdAt };
  }
  return active?.id ?? latest?.id ?? null;
}

/** Select an agent and pan the camera to it (also re-pans when it is already selected). */
export function focusAgent(id: string): void {
  const s = useOfficeStore.getState();
  s.select(id);
  const a = s.sim.agents[id];
  if (a) focusCameraOn(a.pos);
}
