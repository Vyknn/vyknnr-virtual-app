'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { OFFICE } from '@/core/office';
import { HALF_D, HALF_W, cellToWorld } from './coords';
import { PALETTE, glow } from './materials';

/** Rect in cell units (x,z,w,d) → world center. */
function rc(x: number, z: number, w: number, d: number, y = 0): [number, number, number] {
  return [x + w / 2 - HALF_W, y, z + d / 2 - HALF_D];
}

/** Modular sofa along a blocked "back" row; seat spots are on the facing row. dir = +1 faces +z, -1 faces -z. */
function Sofa({ x, z, w, dir, color }: { x: number; z: number; w: number; dir: 1 | -1; color: string }) {
  const [cx, , cz] = rc(x, z, w, 1);
  return (
    <group position={[cx, 0, cz]}>
      <mesh position={[0, 0.22, dir * 0.45]} castShadow>
        <boxGeometry args={[w - 0.1, 0.3, 0.9]} />
        <meshStandardMaterial color={color} roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.55, -dir * 0.1]} castShadow>
        <boxGeometry args={[w - 0.1, 0.7, 0.28]} />
        <meshStandardMaterial color={color} roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.04, dir * 0.3]}>
        <boxGeometry args={[w, 0.06, 1.3]} />
        <meshStandardMaterial color={PALETTE.graphite} roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.08, dir * 0.3 + dir * 0.66]}>
        <boxGeometry args={[w, 0.015, 0.03]} />
        <meshBasicMaterial color={glow(PALETTE.violet, 2.4)} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Lounge: two sofas around a low table, coffee bar, ping-pong table, lounge pods, plants. */
export default function Lounge() {
  const plants = useMemo<[number, number][]>(() => [[31, 28], [42, 28], [31, 17], [36, 21]], []);
  const podSpots = useMemo(() => OFFICE.loungeSpots.filter((s) => s.style === 'chat').map((s) => s.cell), []);
  const podCenter = useMemo(() => {
    const xs = podSpots.map((c) => c.x), zs = podSpots.map((c) => c.z);
    return podSpots.length ? cellToWorld({ x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 }) : null;
  }, [podSpots]);

  return (
    <group>
      {/* Lounge rug */}
      <mesh rotation-x={-Math.PI / 2} position={rc(31.5, 18.5, 5, 5.5, 0.01)} receiveShadow>
        <circleGeometry args={[2.9, 40]} />
        <meshStandardMaterial color="#c7d2fe" roughness={0.9} />
      </mesh>
      <Sofa x={32} z={18} w={4} dir={1} color="#e2e8f0" />
      <Sofa x={32} z={24} w={4} dir={-1} color="#e2e8f0" />
      {/* coffee table */}
      <mesh position={rc(32.5, 20.5, 3, 2, 0.32)}>
        <cylinderGeometry args={[0.9, 0.9, 0.05, 32]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.1} metalness={0.2} transparent opacity={0.8} />
      </mesh>
      <mesh position={rc(32.5, 20.5, 3, 2, 0.15)}>
        <cylinderGeometry args={[0.12, 0.3, 0.3, 16]} />
        <meshStandardMaterial color={PALETTE.graphite} metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Coffee counter (40..42, 17) */}
      <group position={rc(40, 17, 3, 1)}>
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[2.9, 1, 0.9]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.02, 0]}>
          <boxGeometry args={[3, 0.04, 1]} />
          <meshStandardMaterial color={PALETTE.graphite} roughness={0.2} metalness={0.4} />
        </mesh>
        <mesh position={[0, 0.3, 0.46]}>
          <boxGeometry args={[2.9, 0.02, 0.01]} />
          <meshBasicMaterial color={glow('#f59e0b', 2.4)} toneMapped={false} />
        </mesh>
        {/* espresso machine */}
        <mesh position={[0.8, 1.3, -0.15]}>
          <boxGeometry args={[0.6, 0.52, 0.45]} />
          <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.25} />
        </mesh>
        <mesh position={[0.8, 1.32, 0.09]}>
          <planeGeometry args={[0.3, 0.12]} />
          <meshBasicMaterial color={glow('#fbbf24', 1.8)} toneMapped={false} />
        </mesh>
      </group>

      {/* Ping-pong table (39..41, 23..24) */}
      <group position={rc(39, 23, 3, 2)}>
        <mesh position={[0, 0.74, 0]} castShadow>
          <boxGeometry args={[2.7, 0.05, 1.5]} />
          <meshStandardMaterial color="#1d4ed8" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.767, 0]}>
          <boxGeometry args={[2.7, 0.004, 0.025]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, 0.84, 0]}>
          <boxGeometry args={[0.02, 0.15, 1.6]} />
          <meshStandardMaterial color="#e2e8f0" transparent opacity={0.7} />
        </mesh>
        <mesh position={[0, 0.36, 0]}>
          <boxGeometry args={[0.3, 0.72, 1]} />
          <meshStandardMaterial color={PALETTE.graphite} metalness={0.6} roughness={0.3} />
        </mesh>
      </group>

      {/* Chat pods: ring bench around a glowing table */}
      {podCenter && (
        <group position={[podCenter[0], 0, podCenter[2]]}>
          <mesh position={[0, 0.2, 0]}>
            <torusGeometry args={[1.35, 0.22, 10, 32, Math.PI * 1.5]} />
            <meshStandardMaterial color="#e0e7ff" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.35, 0.35, 0.05, 24]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.15} />
          </mesh>
          <mesh position={[0, 0.37, 0]}>
            <torusGeometry args={[0.35, 0.015, 6, 32]} />
            <meshBasicMaterial color={glow(PALETTE.violet, 2.6)} toneMapped={false} />
          </mesh>
        </group>
      )}

      {/* Plants */}
      {plants.map(([x, z]) => {
        const [px, , pz] = cellToWorld({ x, z });
        return (
          <group key={`${x}-${z}`} position={[px, 0, pz]}>
            <mesh position={[0, 0.25, 0]}>
              <cylinderGeometry args={[0.22, 0.17, 0.5, 14]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.85, 0]} castShadow>
              <icosahedronGeometry args={[0.42, 0]} />
              <meshStandardMaterial color="#22c55e" roughness={0.8} flatShading />
            </mesh>
          </group>
        );
      })}

      {/* Warm lounge fill */}
      <pointLight position={rc(31, 17, 11, 12, 3)} color="#fde68a" intensity={6} distance={14} decay={1.6} />
      <MeetingAndCeo />
    </group>
  );
}

/** Meeting table + CEO furniture (static, not part of the agent desk instancing). */
function MeetingAndCeo() {
  const chairs = useMemo(() => {
    const out: { p: [number, number, number]; r: number }[] = [];
    const [cx, , cz] = rc(12, 3, 5, 3);
    for (let i = 0; i < 4; i++) {
      out.push({ p: [cx - 1.8 + i * 1.2, 0, cz - 1.95], r: 0 });
      out.push({ p: [cx - 1.8 + i * 1.2, 0, cz + 1.95], r: Math.PI });
    }
    return out;
  }, []);
  const geo = useMemo(() => new THREE.BoxGeometry(0.45, 0.08, 0.45).translate(0, 0.45, 0), []);
  return (
    <group>
      <group position={rc(12, 3, 5, 3)}>
        <mesh position={[0, 0.74, 0]} castShadow>
          <boxGeometry args={[4.6, 0.06, 2.4]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.12} metalness={0.15} />
        </mesh>
        <mesh position={[0, 0.72, 0]}>
          <boxGeometry args={[4.64, 0.015, 2.44]} />
          <meshBasicMaterial color={glow('#38bdf8', 2.2)} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.37, 0]}>
          <boxGeometry args={[3, 0.72, 0.3]} />
          <meshStandardMaterial color={PALETTE.graphite} metalness={0.6} roughness={0.3} />
        </mesh>
        {/* wall display */}
        <mesh position={[0, 1.6, -2.55]}>
          <boxGeometry args={[3.2, 1.3, 0.05]} />
          <meshBasicMaterial color={glow('#93c5fd', 1.3)} toneMapped={false} />
        </mesh>
      </group>
      {chairs.map((c, i) => (
        <mesh key={i} geometry={geo} position={c.p} rotation-y={c.r}>
          <meshStandardMaterial color={PALETTE.chair} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}
