'use client';

import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import { OFFICE } from '@/core/office';
import type { SimState } from '@/core/sim';
import { useOfficeStore } from '@/store/useOfficeStore';
import { cellToWorld } from './coords';
import { PALETTE, glow } from './materials';

const PULSE: Record<SimState['coreState'], { speed: number; spin: number; amp: number; color: string }> = {
  idle: { speed: 1.1, spin: 0.35, amp: 0.25, color: PALETTE.cyan },
  thinking: { speed: 4.2, spin: 1.4, amp: 0.6, color: PALETTE.violet },
  dispatching: { speed: 7, spin: 2.4, amp: 0.8, color: '#38bdf8' },
};

/** Height of the crystal center above the floor — beams from the Core should start here. */
export const CORE_HEIGHT = 2.2;

/** AI Core: pedestal + rotating icosahedron + orbit rings + point light; pulse speed by `sim.coreState`. */
export default function AICore() {
  const [x, , z] = cellToWorld(OFFICE.corePos);
  const crystal = useRef<THREE.Mesh>(null);
  const crystalMat = useRef<THREE.MeshStandardMaterial>(null);
  const shell = useRef<THREE.Mesh>(null);
  const ring1 = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const phase = useRef(0);
  const col = useRef({ cur: new THREE.Color(PULSE.idle.color), goal: new THREE.Color() });

  useFrame((_, delta) => {
    const p = PULSE[useOfficeStore.getState().sim.coreState] ?? PULSE.idle;
    phase.current += delta * p.speed;
    const pulse = 0.5 + 0.5 * Math.sin(phase.current); // 0..1
    const { cur, goal } = col.current;
    cur.lerp(goal.set(p.color), 1 - Math.exp(-delta * 4));

    if (crystal.current) {
      crystal.current.rotation.y += delta * p.spin;
      crystal.current.rotation.x += delta * p.spin * 0.4;
      const s = 1 + pulse * p.amp * 0.18;
      crystal.current.scale.setScalar(s);
    }
    if (crystalMat.current) {
      crystalMat.current.emissive.copy(cur);
      crystalMat.current.emissiveIntensity = 1.6 + pulse * p.amp * 3;
    }
    if (shell.current) shell.current.rotation.y -= delta * p.spin * 0.5;
    if (ring1.current) ring1.current.rotation.z += delta * p.spin * 0.8;
    if (ring2.current) ring2.current.rotation.z -= delta * p.spin * 1.1;
    if (ringMat.current) ringMat.current.color.copy(cur).multiplyScalar(1.6 + pulse * p.amp * 2);
    if (light.current) {
      light.current.color.copy(cur);
      light.current.intensity = 1.5 + pulse * p.amp * 3; // weak: keep lit surfaces < bloom threshold
    }
  });

  return (
    <group position={[x, 0, z]}>
      {/* pedestal */}
      <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.2, 1.4, 0.3, 40]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.15} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.31, 0]}>
        <torusGeometry args={[1.12, 0.03, 8, 64]} />
        <meshBasicMaterial color={glow(PALETTE.cyan, 3)} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.55, 0.85, 0.5, 6]} />
        <meshStandardMaterial color={PALETTE.graphite} roughness={0.3} metalness={0.7} />
      </mesh>
      {/* light column */}
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.5, 0.6, 2, 24, 1, true]} />
        <meshBasicMaterial color={glow(PALETTE.cyan, 0.9)} transparent opacity={0.12} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {/* crystal */}
      <mesh ref={crystal} position={[0, CORE_HEIGHT, 0]}>
        <icosahedronGeometry args={[0.55, 0]} />
        <meshStandardMaterial ref={crystalMat} color="#e0f2fe" emissive={PALETTE.cyan} emissiveIntensity={2} roughness={0.1} metalness={0.2} flatShading toneMapped={false} />
      </mesh>
      <mesh ref={shell} position={[0, CORE_HEIGHT, 0]}>
        <icosahedronGeometry args={[0.85, 1]} />
        <meshBasicMaterial color={glow(PALETTE.cyan, 1.4)} wireframe transparent opacity={0.35} toneMapped={false} />
      </mesh>
      {/* orbit rings */}
      <group position={[0, CORE_HEIGHT, 0]}>
        <mesh ref={ring1} rotation-x={Math.PI / 2.3}>
          <torusGeometry args={[1.25, 0.025, 8, 64]} />
          <meshBasicMaterial ref={ringMat} color={glow(PALETTE.cyan, 2)} toneMapped={false} />
        </mesh>
        <mesh ref={ring2} rotation={[Math.PI / 1.8, 0.5, 0]}>
          <torusGeometry args={[1.05, 0.018, 8, 64]} />
          <meshBasicMaterial color={glow(PALETTE.violet, 2.4)} toneMapped={false} />
        </mesh>
      </group>
      <pointLight ref={light} position={[0, CORE_HEIGHT, 0]} color={PALETTE.cyan} intensity={2} distance={8} decay={1.5} />
      <Sparkles count={40} scale={[2.6, 2.4, 2.6]} position={[0, 1.8, 0]} size={2.5} speed={0.35} color="#a5f3fc" opacity={0.8} />
    </group>
  );
}
