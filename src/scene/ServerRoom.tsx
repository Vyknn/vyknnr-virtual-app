'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { OFFICE } from '@/core/office';
import type { SimState } from '@/core/sim';
import { useOfficeStore } from '@/store/useOfficeStore';
import { cellToWorld, rectCenterWorld } from './coords';
import { PALETTE, glow, instanceMatrix, makeAisleTexture, makeLedTexture, makePulseTexture } from './materials';

const RACK_H = 2.1;

/** Running nodes whose current step is a tool_call (drives rack LED intensity). */
export function activeToolCalls(sim: SimState): number {
  let n = 0;
  for (const id in sim.nodes) {
    const node = sim.nodes[id];
    if (node.status === 'running' && node.steps[node.stepIndex]?.kind === 'tool_call') n++;
  }
  return n;
}

function setInstances(mats: THREE.Matrix4[]) {
  return (m: THREE.InstancedMesh | null) => {
    if (!m) return;
    mats.forEach((mx, i) => m.setMatrixAt(i, mx));
    m.instanceMatrix.needsUpdate = true;
  };
}

/** Rack row cells → front direction. Racks face +z (rack.facing = 0); console sits at z + 1. */
function Racks() {
  const ledTex = useMemo(() => makeLedTexture(), []);
  useEffect(() => () => ledTex.dispose(), [ledTex]);
  const ledMat = useRef<THREE.MeshBasicMaterial>(null);
  const level = useRef(0);
  const acc = useRef(0);

  const { bodies, fronts, tops } = useMemo(() => {
    const bodies: THREE.Matrix4[] = [], fronts: THREE.Matrix4[] = [], tops: THREE.Matrix4[] = [];
    for (const r of OFFICE.racks) {
      const [x, , z] = cellToWorld(r.cell);
      bodies.push(instanceMatrix([x, RACK_H / 2, z], r.facing, [0.9, RACK_H, 0.9]));
      // front panel just in front of local +z face
      const fx = x + Math.sin(r.facing) * 0.452, fz = z + Math.cos(r.facing) * 0.452;
      fronts.push(instanceMatrix([fx, RACK_H / 2 + 0.02, fz], r.facing, [0.74, RACK_H - 0.22, 1]));
      tops.push(instanceMatrix([x, RACK_H + 0.01, z], r.facing, [0.92, 0.02, 0.92]));
    }
    return { bodies, fronts, tops };
  }, []);

  useFrame((_, delta) => {
    const m = ledMat.current;
    if (!m) return;
    const n = activeToolCalls(useOfficeStore.getState().sim);
    const goal = Math.min(1, n / 4); // 0 idle .. 1 at ≥4 concurrent tool calls
    level.current += (goal - level.current) * (1 - Math.exp(-delta * 3));
    // Blink: step the LED pattern; faster with activity.
    acc.current += delta * (1.5 + level.current * 10);
    const map = m.map;
    if (acc.current >= 1 && map) { acc.current %= 1; map.offset.y = (map.offset.y + 1 / 48) % 1; }
    const intensity = 0.9 + level.current * 2.6;
    m.color.setRGB(intensity, intensity, intensity);
  });

  return (
    <group>
      <instancedMesh args={[undefined, undefined, bodies.length]} ref={setInstances(bodies)} frustumCulled={false} castShadow>
        <boxGeometry />
        <meshStandardMaterial color="#1e2533" roughness={0.35} metalness={0.7} />
      </instancedMesh>
      <instancedMesh args={[undefined, undefined, fronts.length]} ref={setInstances(fronts)} frustumCulled={false}>
        <planeGeometry />
        <meshBasicMaterial ref={ledMat} map={ledTex} toneMapped={false} />
      </instancedMesh>
      <instancedMesh args={[undefined, undefined, tops.length]} ref={setInstances(tops)} frustumCulled={false}>
        <boxGeometry />
        <meshBasicMaterial color={glow(PALETTE.cyan, 2)} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

/** Small standing consoles in front of racks (where infra agents "work"). */
function Consoles() {
  const mats = useMemo(() => OFFICE.rackConsoles.map((c) => {
    const [x, , z] = cellToWorld(c);
    return instanceMatrix([x + 0.38, 0, z], 0);
  }), []);
  const screens = useMemo(() => OFFICE.rackConsoles.map((c) => {
    const [x, , z] = cellToWorld(c);
    return new THREE.Matrix4().compose(new THREE.Vector3(x + 0.38, 1.12, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 3, -Math.PI / 2, 0, 'YXZ')), new THREE.Vector3(0.36, 0.26, 1));
  }), []);
  const post = useMemo(() => new THREE.BoxGeometry(0.1, 1.05, 0.1).translate(0, 0.525, 0), []);
  return (
    <group>
      <instancedMesh args={[post, undefined, mats.length]} ref={setInstances(mats)} frustumCulled={false}>
        <meshStandardMaterial color={PALETTE.graphite} roughness={0.4} metalness={0.6} />
      </instancedMesh>
      <instancedMesh args={[undefined, undefined, screens.length]} ref={setInstances(screens)} frustumCulled={false}>
        <planeGeometry />
        <meshBasicMaterial color={glow('#38bdf8', 1.6)} toneMapped={false} side={THREE.DoubleSide} />
      </instancedMesh>
    </group>
  );
}

/** Cold-aisle tiles in front of each rack row and overhead cable trays. */
function AisleAndTrays() {
  const tex = useMemo(() => makeAisleTexture(), []);
  useEffect(() => () => tex.dispose(), [tex]);
  const rows = useMemo(() => [...new Set(OFFICE.racks.map((r) => r.cell.z))], []);
  const xs = OFFICE.racks.map((r) => r.cell.x);
  const x1 = Math.min(...xs), x2 = Math.max(...xs);
  const width = x2 - x1 + 1;
  const cx = (x1 + x2 + 1) / 2 - OFFICE.width / 2;
  useMemo(() => tex.repeat.set(width, 1), [tex, width]);
  return (
    <group>
      {rows.map((z) => {
        const [, , wz] = cellToWorld({ x: 0, z: z + 1 });
        const [, , rz] = cellToWorld({ x: 0, z });
        return (
          <group key={z}>
            <mesh rotation-x={-Math.PI / 2} position={[cx, 0.008, wz]}>
              <planeGeometry args={[width, 0.96]} />
              <meshStandardMaterial map={tex} roughness={0.3} metalness={0.3} />
            </mesh>
            {/* overhead cable tray */}
            <mesh position={[cx, RACK_H + 0.42, rz]}>
              <boxGeometry args={[width, 0.06, 0.4]} />
              <meshStandardMaterial color="#5b6577" roughness={0.4} metalness={0.8} />
            </mesh>
            <mesh position={[cx, RACK_H + 0.46, rz]}>
              <boxGeometry args={[width, 0.03, 0.22]} />
              <meshStandardMaterial color="#2563eb" roughness={0.6} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** Glowing floor conduits from the server room door to the AI Core with a travelling pulse (UV offset). */
function Conduits() {
  const pulse = useMemo(() => makePulseTexture(), []);
  useEffect(() => () => pulse.dispose(), [pulse]);
  // Polyline in cell units: server door (36.5,12) → down to z=14.5 → west to core (22.5,16).
  const paths = useMemo(() => {
    const core = OFFICE.corePos;
    const mk = (pts: [number, number][]) => pts.map(([x, z]) => new THREE.Vector3(x - OFFICE.width / 2, 0.014, z - OFFICE.depth / 2));
    return [
      mk([[36.2, 12.6], [36.2, 15.7], [core.x + 1.6, 15.7]]),
      mk([[37.8, 12.6], [37.8, 16.3], [core.x + 1.6, 16.3]]),
    ];
  }, []);

  const segments = useMemo(() => paths.flatMap((pts) => {
    let along = 0;
    const out: { pos: THREE.Vector3; len: number; rotY: number; u0: number }[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const len = a.distanceTo(b);
      out.push({ pos: a.clone().add(b).multiplyScalar(0.5), len, rotY: Math.atan2(b.x - a.x, b.z - a.z), u0: along });
      along += len;
    }
    return out;
  }), [paths]);

  const textures = useMemo(() => segments.map((s) => {
    const t = pulse.clone();
    t.repeat.set(s.len / 6, 1);
    t.needsUpdate = true;
    return t;
  }), [segments, pulse]);
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures]);

  const pulseMats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  useFrame((_, delta) => {
    const speed = useOfficeStore.getState().sim.coreState === 'idle' ? 0.12 : 0.45;
    // Plane u runs from segment end (core side) back to start; increasing offset moves the band toward the core.
    for (const m of pulseMats.current) if (m?.map) m.map.offset.x = (m.map.offset.x + delta * speed) % 1;
  });

  return (
    <group>
      {segments.map((s, i) => (
        <group key={i} position={s.pos} rotation-y={s.rotY}>
          {/* plane's u axis along local x → rotate so it runs along local z */}
          <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
            <planeGeometry args={[s.len + 0.12, 0.12]} />
            <meshBasicMaterial ref={(m) => { pulseMats.current[i] = m; }} map={textures[i]} color={glow(PALETTE.cyan, 3)} transparent toneMapped={false} depthWrite={false} />
          </mesh>
          <mesh position={[0, -0.006, 0]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[0.26, s.len + 0.26]} />
            <meshStandardMaterial color="#1f2937" roughness={0.3} metalness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export default function ServerRoom() {
  const zone = OFFICE.zones.find((z) => z.id === 'server');
  const [sx, , sz] = zone ? rectCenterWorld(zone.rect) : [0, 0, 0];
  return (
    <group>
      <Racks />
      <Consoles />
      <AisleAndTrays />
      <Conduits />
      {/* cool fill light inside the server room */}
      <pointLight position={[sx, 2.6, sz]} color="#67e8f9" intensity={8} distance={12} decay={1.6} />
    </group>
  );
}
