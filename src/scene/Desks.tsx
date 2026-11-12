'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { OFFICE } from '@/core/office';
import { useOfficeStore } from '@/store/useOfficeStore';
import { cellToWorld } from './coords';
import { PALETTE, glow } from './materials';

/**
 * Desk local frame: rotY = desk.facing (heading from seat to desk, atan2(dx,dz)),
 * so local +z points from the seat towards the desk; local origin = desk cell center.
 * The seat cell is therefore at local z = -1.
 */
interface Part { geo: THREE.BufferGeometry; local: THREE.Matrix4 }

const SCREEN_R = 1.1;
const SCREEN_ARC = 0.62;
const IDLE = new THREE.Color(PALETTE.screenIdle);
const WORK = glow(PALETTE.screenWorking, 2.4);
const HOLO_ON = glow('#7dd3fc', 1.5);

function m4(x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rx = 0): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, 0)),
    new THREE.Vector3(sx, sy, sz),
  );
}

function deskWorld(i: number): THREE.Matrix4 {
  const d = OFFICE.desks[i];
  const [x, , z] = cellToWorld(d.cell);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), d.facing), new THREE.Vector3(1, 1, 1));
}

function curvedScreenGeometry(inset = 0): THREE.BufferGeometry {
  const r = SCREEN_R - inset;
  const g = new THREE.CylinderGeometry(r, r, 0.36 - inset * 4, 16, 1, true, -SCREEN_ARC / 2, SCREEN_ARC);
  g.translate(0, 0, -r); // arc apex at local origin, concave towards -z (the seat)
  return g;
}

function InstancedPart({ part, children, onMesh }: { part: Part; children: React.ReactNode; onMesh?: (m: THREE.InstancedMesh) => void }) {
  const n = OFFICE.desks.length;
  return (
    <instancedMesh
      args={[part.geo, undefined, n]}
      frustumCulled={false}
      ref={(m) => {
        if (!m) return;
        const tmp = new THREE.Matrix4();
        for (let i = 0; i < n; i++) m.setMatrixAt(i, tmp.multiplyMatrices(deskWorld(i), part.local));
        m.instanceMatrix.needsUpdate = true;
        onMesh?.(m);
      }}
    >
      {children}
    </instancedMesh>
  );
}

/** All agent desks (instanced): floating desk, neon edge, curved monitor, chair, holo screen while working. */
export default function Desks() {
  const parts = useMemo(() => {
    const box = new THREE.BoxGeometry(1, 1, 1);
    return {
      top: { geo: box, local: m4(0, 0.74, 0.05, 1.5, 0.05, 0.75) },
      edge: { geo: box, local: m4(0, 0.735, -0.33, 1.5, 0.02, 0.025) },
      pedestal: { geo: box, local: m4(0, 0.37, 0.15, 0.12, 0.72, 0.4) },
      foot: { geo: box, local: m4(0, 0.02, 0.15, 0.9, 0.04, 0.45) },
      stand: { geo: box, local: m4(0, 0.88, 0.32, 0.05, 0.24, 0.05) },
      bezel: { geo: curvedScreenGeometry(), local: m4(0, 1.08, 0.3) },
      screen: { geo: curvedScreenGeometry(0.012), local: m4(0, 1.08, 0.3 - 0.012) },
      chairSeat: { geo: box, local: m4(0, 0.46, -0.85, 0.5, 0.08, 0.48) },
      chairBack: { geo: box, local: m4(0, 0.8, -1.1, 0.48, 0.6, 0.07) },
      chairBase: { geo: new THREE.CylinderGeometry(0.04, 0.24, 0.42, 10), local: m4(0, 0.21, -0.85) },
      holo: { geo: new THREE.PlaneGeometry(0.9, 0.5), local: m4(0, 1.62, 0.25) },
    } satisfies Record<string, Part>;
  }, []);

  const screenRef = useRef<THREE.InstancedMesh | null>(null);
  const holoRef = useRef<THREE.InstancedMesh | null>(null);
  const working = useRef<boolean[]>(OFFICE.desks.map(() => true)); // forces first update
  const holoBase = useMemo(() => OFFICE.desks.map((_, i) => new THREE.Matrix4().multiplyMatrices(deskWorld(i), parts.holo.local)), [parts]);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), s: new THREE.Matrix4(), c: new THREE.Color() }), []);

  useFrame(({ clock }) => {
    const screen = screenRef.current, holo = holoRef.current;
    if (!screen || !holo) return;
    const agents = useOfficeStore.getState().sim.agents;
    let colorDirty = false;
    const t = clock.elapsedTime;
    OFFICE.desks.forEach((d, i) => {
      const w = agents[d.agentId]?.state === 'working';
      if (w !== working.current[i]) {
        working.current[i] = w;
        screen.setColorAt(i, w ? WORK : IDLE);
        holo.setColorAt(i, w ? HOLO_ON : IDLE);
        colorDirty = true;
      }
      // Holo panel: hidden (scale 0) when not working, flickers in place when working.
      const sc = w ? 1 + Math.sin(t * 3 + i) * 0.02 : 0;
      holo.setMatrixAt(i, tmp.m.multiplyMatrices(holoBase[i], tmp.s.makeScale(sc, sc, sc)));
    });
    holo.instanceMatrix.needsUpdate = true;
    if (colorDirty) {
      if (screen.instanceColor) screen.instanceColor.needsUpdate = true;
      if (holo.instanceColor) holo.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      <InstancedPart part={parts.top}>
        <meshStandardMaterial color={PALETTE.deskTop} roughness={0.25} metalness={0.1} />
      </InstancedPart>
      <InstancedPart part={parts.edge}>
        <meshBasicMaterial color={glow(PALETTE.cyan, 2.2)} toneMapped={false} />
      </InstancedPart>
      <InstancedPart part={parts.pedestal}>
        <meshStandardMaterial color={PALETTE.deskLeg} roughness={0.3} metalness={0.7} />
      </InstancedPart>
      <InstancedPart part={parts.foot}>
        <meshStandardMaterial color={PALETTE.graphite} roughness={0.4} metalness={0.5} />
      </InstancedPart>
      <InstancedPart part={parts.stand}>
        <meshStandardMaterial color={PALETTE.graphite} roughness={0.4} metalness={0.6} />
      </InstancedPart>
      <InstancedPart part={parts.bezel}>
        <meshStandardMaterial color={PALETTE.graphite} roughness={0.35} metalness={0.5} side={THREE.DoubleSide} />
      </InstancedPart>
      <InstancedPart part={parts.screen} onMesh={(m) => { screenRef.current = m; }}>
        <meshBasicMaterial color="#ffffff" toneMapped={false} side={THREE.BackSide} />
      </InstancedPart>
      <InstancedPart part={parts.chairSeat}>
        <meshStandardMaterial color={PALETTE.chair} roughness={0.6} />
      </InstancedPart>
      <InstancedPart part={parts.chairBack}>
        <meshStandardMaterial color={PALETTE.chair} roughness={0.6} />
      </InstancedPart>
      <InstancedPart part={parts.chairBase}>
        <meshStandardMaterial color={PALETTE.deskLeg} roughness={0.3} metalness={0.7} />
      </InstancedPart>
      <InstancedPart part={parts.holo} onMesh={(m) => { holoRef.current = m; }}>
        <meshBasicMaterial color="#ffffff" transparent opacity={0.45} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
      </InstancedPart>
    </group>
  );
}
