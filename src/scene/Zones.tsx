'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import { OFFICE, type Zone } from '@/core/office';
import { rectCenterWorld } from './coords';
import { glow, instanceMatrix, makeLabelTexture } from './materials';

const STRIP_W = 0.07;
const STRIP_Y = 0.012;

/** Instanced tint quads + neon border strips colored per zone. */
function ZoneFloors() {
  const { tints, strips } = useMemo(() => {
    const tints: { m: THREE.Matrix4; c: THREE.Color }[] = [];
    const strips: { m: THREE.Matrix4; c: THREE.Color }[] = [];
    for (const z of OFFICE.zones) {
      const [cx, , cz] = rectCenterWorld(z.rect);
      const col = new THREE.Color(z.color);
      tints.push({ m: instanceMatrix([cx, 0.006, cz], 0, [z.rect.w - 0.1, 1, z.rect.d - 0.1]), c: col });
      const { w, d } = z.rect;
      const hw = w / 2 - 0.05, hd = d / 2 - 0.05;
      strips.push({ m: instanceMatrix([cx, STRIP_Y, cz - hd], 0, [w - 0.1, 1, STRIP_W]), c: col });
      strips.push({ m: instanceMatrix([cx, STRIP_Y, cz + hd], 0, [w - 0.1, 1, STRIP_W]), c: col });
      strips.push({ m: instanceMatrix([cx - hw, STRIP_Y, cz], 0, [STRIP_W, 1, d - 0.1]), c: col });
      strips.push({ m: instanceMatrix([cx + hw, STRIP_Y, cz], 0, [STRIP_W, 1, d - 0.1]), c: col });
    }
    return { tints, strips };
  }, []);
  const tintGeo = useMemo(() => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), []);

  const apply = (list: { m: THREE.Matrix4; c: THREE.Color }[]) => (mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return;
    list.forEach((it, i) => { mesh.setMatrixAt(i, it.m); mesh.setColorAt(i, it.c); });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };

  return (
    <>
      <instancedMesh args={[tintGeo, undefined, tints.length]} ref={apply(tints)} frustumCulled={false} receiveShadow>
        <meshStandardMaterial transparent opacity={0.16} roughness={0.25} metalness={0.1} depthWrite={false} />
      </instancedMesh>
      <instancedMesh args={[undefined, undefined, strips.length]} ref={apply(strips)} frustumCulled={false}>
        <boxGeometry args={[1, 0.012, 1]} />
        <meshBasicMaterial color={glow('#ffffff', 1.8)} toneMapped={false} />
      </instancedMesh>
    </>
  );
}

/** Floating holographic sign: CanvasTexture plane facing the camera, gently bobbing. */
function HoloSign({ zone }: { zone: Zone }) {
  const { texture, aspect } = useMemo(() => makeLabelTexture(zone.label, zone.color), [zone.label, zone.color]);
  useEffect(() => () => texture.dispose(), [texture]);
  const h = zone.id === 'core' ? 0.7 : 0.62;
  const [x, , z] = rectCenterWorld(zone.rect);
  const big = zone.id === 'server' || zone.id === 'lounge' || zone.id === 'meeting' || zone.id === 'ceo';
  const y = zone.id === 'core' ? 4.6 : big ? 3.2 : 2.6;
  const zOff = zone.id === 'core' ? 0 : -zone.rect.d / 2 + 0.6;
  const phase = (x * 0.37 + z * 0.21) % (Math.PI * 2);
  const ref = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = y + Math.sin(clock.elapsedTime * 1.2 + phase) * 0.06;
  });

  return (
    <group position={[x, 0, z + zOff]}>
      {/* projector pole + base */}
      <mesh position={[0, y / 2 - 0.25, 0]}>
        <cylinderGeometry args={[0.025, 0.025, y - 0.5, 6]} />
        <meshBasicMaterial color={glow(zone.color, 1.6)} toneMapped={false} transparent opacity={0.55} />
      </mesh>
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.18, 0.22, 0.08, 16]} />
        <meshStandardMaterial color="#2a3140" metalness={0.6} roughness={0.3} />
      </mesh>
      <Billboard ref={ref} position={[0, y, 0]} lockX lockZ>
        <mesh>
          <planeGeometry args={[h * aspect, h]} />
          <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} color={glow('#ffffff', 1.15)} side={THREE.DoubleSide} />
        </mesh>
      </Billboard>
    </group>
  );
}

export default function Zones() {
  return (
    <group>
      <ZoneFloors />
      {OFFICE.zones.map((z) => <HoloSign key={z.id} zone={z} />)}
    </group>
  );
}
