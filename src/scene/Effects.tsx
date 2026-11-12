'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useOfficeStore, type Fx } from '@/store/useOfficeStore';
import { CORE_HEIGHT } from './AICore';
import { cellToWorld } from './coords';
import { glow } from './materials';

/*
 * Dispatch beams (AI Core → target) and hand-off packets (desk → desk). One small component per fx, keyed by id;
 * the store prunes entries after FX_TTL, so the count stays small. Age = sim.t − born (pauses with the sim).
 * Colors are HDR (toneMapped={false}, ×4–5) so they pass the bloom threshold of 1.0.
 */

const BEAM_LIFE = 1.2;
const PACKET_LIFE = 1.5;
const BEAM_END_Y = 1.1; // roughly monitor / chest height at the target
const PACKET_Y = 0.95;
const PACKET_ARC = 1.6;

const CYL = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
const SPHERE = new THREE.SphereGeometry(1, 14, 10);
const CUBE = new THREE.BoxGeometry(0.16, 0.16, 0.16);
const UP = new THREE.Vector3(0, 1, 0);

/** HDR multiplier: blue/violet hues have low luma, so they need more push than cyan/yellow to bloom. */
function hdr(color: string, base: number): THREE.Color {
  const c = new THREE.Color(color);
  const luma = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return glow(color, luma < 0.35 ? base * 1.4 : base);
}

function Beam({ fx }: { fx: Fx }) {
  const geo = useMemo(() => {
    const [cx, , cz] = cellToWorld(fx.from);
    const [tx, , tz] = cellToWorld(fx.to);
    const a = new THREE.Vector3(cx, CORE_HEIGHT, cz);
    const b = new THREE.Vector3(tx, BEAM_END_Y, tz);
    const dir = b.clone().sub(a);
    const len = dir.length();
    return {
      a, b, len,
      mid: a.clone().add(b).multiplyScalar(0.5),
      quat: new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()),
      core: hdr(fx.color, 4),
      halo: hdr(fx.color, 1.6),
    };
  }, [fx]);
  const core = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const coreMat = useRef<THREE.MeshBasicMaterial>(null);
  const haloMat = useRef<THREE.MeshBasicMaterial>(null);
  const head = useRef<THREE.Mesh>(null);
  const impact = useRef<THREE.Mesh>(null);
  const impactMat = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    const age = useOfficeStore.getState().sim.t - fx.born;
    const u = age / BEAM_LIFE;
    const alive = u >= 0 && u < 1;
    if (core.current) core.current.visible = alive;
    if (halo.current) halo.current.visible = alive;
    if (head.current) head.current.visible = alive && u < 0.35;
    if (impact.current) impact.current.visible = alive && u > 0.2;
    if (!alive) return;
    // Quick draw-in (first 15%), then fade out.
    const grow = Math.min(1, u / 0.15);
    const fade = u < 0.15 ? 1 : 1 - (u - 0.15) / 0.85;
    const w = 0.03 * (0.6 + 0.4 * fade);
    if (core.current) {
      core.current.scale.set(w, geo.len * grow, w);
      core.current.position.copy(geo.a).lerp(geo.b, grow * 0.5);
    }
    if (halo.current) {
      halo.current.scale.set(w * 3.2, geo.len * grow, w * 3.2);
      halo.current.position.copy(geo.a).lerp(geo.b, grow * 0.5);
    }
    if (coreMat.current) coreMat.current.opacity = fade;
    if (haloMat.current) haloMat.current.opacity = 0.35 * fade;
    if (head.current) {
      head.current.position.copy(geo.a).lerp(geo.b, Math.min(1, u / 0.35));
      head.current.scale.setScalar(0.09);
    }
    if (impact.current) {
      const k = (u - 0.2) / 0.8;
      impact.current.scale.setScalar(0.12 + k * 0.45);
      if (impactMat.current) impactMat.current.opacity = 0.9 * (1 - k);
    }
  });

  return (
    <group>
      <mesh ref={core} geometry={CYL} dispose={null} quaternion={geo.quat} position={geo.mid} visible={false} renderOrder={3}>
        <meshBasicMaterial ref={coreMat} color={geo.core} toneMapped={false} transparent depthWrite={false} />
      </mesh>
      <mesh ref={halo} geometry={CYL} dispose={null} quaternion={geo.quat} position={geo.mid} visible={false} renderOrder={3}>
        <meshBasicMaterial ref={haloMat} color={geo.halo} toneMapped={false} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={head} geometry={SPHERE} dispose={null} visible={false}>
        <meshBasicMaterial color={geo.core} toneMapped={false} />
      </mesh>
      <mesh ref={impact} geometry={SPHERE} dispose={null} position={geo.b} visible={false}>
        <meshBasicMaterial ref={impactMat} color={geo.halo} toneMapped={false} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

function Packet({ fx }: { fx: Fx }) {
  const ends = useMemo(() => {
    const [fx0, , fz0] = cellToWorld(fx.from);
    const [tx, , tz] = cellToWorld(fx.to);
    return { a: new THREE.Vector3(fx0, PACKET_Y, fz0), b: new THREE.Vector3(tx, PACKET_Y, tz), color: hdr(fx.color, 4) };
  }, [fx]);
  const cube = useRef<THREE.Mesh>(null);
  const trail = useRef<THREE.Mesh>(null);
  const trailMat = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    const age = useOfficeStore.getState().sim.t - fx.born;
    const u = age / PACKET_LIFE;
    const alive = u >= 0 && u < 1;
    if (cube.current) cube.current.visible = alive;
    if (trail.current) trail.current.visible = alive;
    if (!alive) return;
    const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2; // ease in-out
    const arc = Math.sin(Math.PI * e) * PACKET_ARC;
    if (cube.current) {
      cube.current.position.copy(ends.a).lerp(ends.b, e);
      cube.current.position.y += arc;
      cube.current.rotation.set(age * 5, age * 7, 0);
      cube.current.scale.setScalar(u > 0.85 ? 1 - (u - 0.85) / 0.15 * 0.7 : 1);
    }
    if (trail.current) {
      const e2 = Math.max(0, e - 0.06);
      trail.current.position.copy(ends.a).lerp(ends.b, e2);
      trail.current.position.y += Math.sin(Math.PI * e2) * PACKET_ARC;
      trail.current.scale.setScalar(0.14);
      if (trailMat.current) trailMat.current.opacity = 0.5 * (1 - u);
    }
  });

  return (
    <group>
      <mesh ref={cube} geometry={CUBE} dispose={null} visible={false}>
        <meshBasicMaterial color={ends.color} toneMapped={false} />
      </mesh>
      <mesh ref={trail} geometry={SPHERE} dispose={null} visible={false}>
        <meshBasicMaterial ref={trailMat} color={ends.color} toneMapped={false} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

/** Renders the store's live fx list (re-renders only when the fx array changes). */
export default function Effects() {
  const fx = useOfficeStore((s) => s.fx);
  return <>{fx.map((f) => (f.kind === 'beam' ? <Beam key={f.id} fx={f} /> : <Packet key={f.id} fx={f} />))}</>;
}
