'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { MapControls, OrthographicCamera } from '@react-three/drei';
import type { MapControls as MapControlsImpl } from 'three-stdlib';
import { OFFICE } from '@/core/office';
import { useOfficeStore } from '@/store/useOfficeStore';
import { posToWorld } from './coords';
import { ISO_PITCH, useCameraControls, yawFromIndex } from './cameraControls';

const DIST = 80; // ortho: distance only affects clipping, not size
const MIN_ZOOM = 10;
const MAX_ZOOM = 140;
const PAN_LIMIT_X = OFFICE.width / 2 + 4;
const PAN_LIMIT_Z = OFFICE.depth / 2 + 4;

function offsetFor(yaw: number, out: THREE.Vector3): THREE.Vector3 {
  const h = Math.cos(ISO_PITCH) * DIST;
  return out.set(Math.sin(yaw) * h, Math.sin(ISO_PITCH) * DIST, Math.cos(yaw) * h);
}

/**
 * Isometric orthographic camera: yaw 45° (+90° steps via Q/E or `useCameraControls.rotate`),
 * pitch 35.264°, wheel zoom (clamped), drag pan on the ground plane, smooth focus on the selected agent.
 */
export default function IsoCamera() {
  const controls = useRef<MapControlsImpl>(null);
  const get = useThree((s) => s.get);
  const yaw = useRef(yawFromIndex(useCameraControls.getState().yawIndex));
  const focusGoal = useRef<THREE.Vector3 | null>(null);
  const tmp = useRef({ off: new THREE.Vector3(), step: new THREE.Vector3() });

  // Fit the whole floor on first mount; fixed afterwards so re-renders never reset the user's view.
  const [initial] = useState(() => {
    const { width, height } = get().size;
    return {
      zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(width / 58, height / 36))),
      pos: offsetFor(yawFromIndex(useCameraControls.getState().yawIndex), new THREE.Vector3()),
    };
  });

  // Q/E keyboard rotation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'q' || e.key === 'Q') useCameraControls.getState().rotate(-1);
      else if (e.key === 'e' || e.key === 'E') useCameraControls.getState().rotate(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Focus requests: explicit API + selected agent changes.
  useEffect(() => {
    const unsubFocus = useCameraControls.subscribe((s, prev) => {
      if (s.focus && s.focus !== prev.focus) focusGoal.current = new THREE.Vector3(...posToWorld(s.focus));
    });
    const unsubSel = useOfficeStore.subscribe((s, prev) => {
      if (s.selectedAgentId === prev.selectedAgentId || !s.selectedAgentId) return;
      const a = s.sim.agents[s.selectedAgentId];
      if (a) useCameraControls.getState().focusOn(a.pos);
    });
    return () => { unsubFocus(); unsubSel(); };
  }, []);

  // User drag cancels a running focus tween.
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const onStart = () => { focusGoal.current = null; };
    c.addEventListener('start', onStart);
    return () => c.removeEventListener('start', onStart);
  }, []);

  useFrame(({ camera }, delta) => {
    const c = controls.current;
    if (!c) return;
    const { off, step } = tmp.current;
    const k = 1 - Math.exp(-delta * 8);
    let moved = false;

    const goalYaw = yawFromIndex(useCameraControls.getState().yawIndex);
    if (Math.abs(goalYaw - yaw.current) > 1e-4) {
      yaw.current += (goalYaw - yaw.current) * k;
      if (Math.abs(goalYaw - yaw.current) < 1e-3) yaw.current = goalYaw;
      moved = true;
    }

    if (focusGoal.current) {
      step.copy(focusGoal.current).sub(c.target).setY(0);
      if (step.lengthSq() < 1e-4) focusGoal.current = null;
      c.target.addScaledVector(step, focusGoal.current ? k : 1);
      moved = true;
    }

    // Keep target near the office.
    const tx = THREE.MathUtils.clamp(c.target.x, -PAN_LIMIT_X, PAN_LIMIT_X);
    const tz = THREE.MathUtils.clamp(c.target.z, -PAN_LIMIT_Z, PAN_LIMIT_Z);
    if (tx !== c.target.x || tz !== c.target.z || c.target.y !== 0) { c.target.set(tx, 0, tz); moved = true; }

    if (moved) {
      camera.position.copy(c.target).add(offsetFor(yaw.current, off));
      camera.lookAt(c.target);
      c.update();
    }
  });

  return (
    <>
      <OrthographicCamera
        makeDefault
        position={initial.pos}
        zoom={initial.zoom}
        near={0.1}
        far={400}
        onUpdate={(cam) => cam.lookAt(0, 0, 0)}
      />
      <MapControls
        ref={controls}
        makeDefault
        target={[0, 0, 0]}
        enableRotate={false}
        enableDamping
        dampingFactor={0.12}
        screenSpacePanning={false}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        zoomSpeed={1.2}
      />
    </>
  );
}
