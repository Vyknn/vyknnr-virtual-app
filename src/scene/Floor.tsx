'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { OFFICE } from '@/core/office';
import { HALF_D, HALF_W } from './coords';
import { PALETTE, glow, instanceMatrix, makeFloorTexture } from './materials';

const WALL_H = 2.2;
const GLASS_H = 2.4;
const WALL_T = 0.22;

interface WallBox { pos: [number, number, number]; size: [number, number, number] }

/** Wall segment → box centered on the cells it occupies (walls fill whole cells, drawn slimmer). */
function segBox(w: (typeof OFFICE.walls)[number], h: number): WallBox {
  const x1 = Math.min(w.from.x, w.to.x), x2 = Math.max(w.from.x, w.to.x);
  const z1 = Math.min(w.from.z, w.to.z), z2 = Math.max(w.from.z, w.to.z);
  const horizontal = z1 === z2;
  const lx = horizontal ? x2 - x1 + 1 : WALL_T;
  const lz = horizontal ? WALL_T : z2 - z1 + 1;
  return { pos: [(x1 + x2 + 1) / 2 - HALF_W, h / 2, (z1 + z2 + 1) / 2 - HALF_D], size: [lx, h, lz] };
}

function Boxes({ boxes, children }: { boxes: WallBox[]; children: React.ReactNode }) {
  const mats = useMemo(() => boxes.map((b) => instanceMatrix(b.pos, 0, b.size)), [boxes]);
  return (
    <instancedMesh
      args={[undefined, undefined, boxes.length]}
      frustumCulled={false}
      ref={(m) => {
        if (!m) return;
        mats.forEach((mx, i) => m.setMatrixAt(i, mx));
        m.instanceMatrix.needsUpdate = true;
      }}
    >
      <boxGeometry />
      {children}
    </instancedMesh>
  );
}

/** Glossy floor slab, perimeter + interior walls (solid and glass) with neon top strips. */
export default function Floor() {
  const floorTex = useMemo(() => {
    const t = makeFloorTexture();
    t.repeat.set(OFFICE.width, OFFICE.depth);
    return t;
  }, []);

  const { solid, glass, solidTrim, glassTrim, glassFrames } = useMemo(() => {
    const solid: WallBox[] = [], glass: WallBox[] = [], solidTrim: WallBox[] = [], glassTrim: WallBox[] = [], glassFrames: WallBox[] = [];
    const perimeter = (w: (typeof OFFICE.walls)[number]) =>
      w.from.z === 0 && w.to.z === 0 || w.from.z === OFFICE.depth - 1 && w.to.z === OFFICE.depth - 1 ||
      w.from.x === 0 && w.to.x === 0 || w.from.x === OFFICE.width - 1 && w.to.x === OFFICE.width - 1;
    for (const w of OFFICE.walls) {
      if (w.glass) {
        const b = segBox(w, GLASS_H);
        glass.push(b);
        const [x, , z] = b.pos, [sx, , sz] = b.size;
        glassTrim.push({ pos: [x, GLASS_H + 0.02, z], size: [sx + 0.02, 0.05, sz + 0.02] });
        glassFrames.push({ pos: [x, 0.06, z], size: [sx + 0.04, 0.12, sz + 0.06] });
      } else {
        // Perimeter walls are kept low on the camera-facing sides so the interior stays visible.
        const p = perimeter(w);
        const h = p ? 0.6 : WALL_H;
        const b = segBox(w, h);
        solid.push(b);
        const [x, , z] = b.pos, [sx, , sz] = b.size;
        solidTrim.push({ pos: [x, h + 0.015, z], size: [sx + 0.01, 0.03, sz + 0.04] });
      }
    }
    return { solid, glass, solidTrim, glassTrim, glassFrames };
  }, []);

  return (
    <group>
      {/* Base slab (seen at the edges) */}
      <mesh position={[0, -0.26, 0]} receiveShadow>
        <boxGeometry args={[OFFICE.width + 1.2, 0.5, OFFICE.depth + 1.2]} />
        <meshStandardMaterial color={PALETTE.slab} roughness={0.6} metalness={0.2} />
      </mesh>
      {/* Slab neon edge */}
      <mesh position={[0, -0.02, 0]}>
        <boxGeometry args={[OFFICE.width + 1.26, 0.04, OFFICE.depth + 1.26]} />
        <meshBasicMaterial color={glow(PALETTE.cyan, 2.2)} toneMapped={false} />
      </mesh>
      {/* Glossy floor */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.001, 0]} receiveShadow>
        <planeGeometry args={[OFFICE.width, OFFICE.depth]} />
        <meshStandardMaterial color={PALETTE.floor} map={floorTex} roughness={0.18} metalness={0.15} envMapIntensity={0.9} />
      </mesh>

      <Boxes boxes={solid}>
        <meshStandardMaterial color={PALETTE.wall} roughness={0.5} metalness={0.05} />
      </Boxes>
      <Boxes boxes={solidTrim}>
        <meshBasicMaterial color={glow(PALETTE.blue, 2.4)} toneMapped={false} />
      </Boxes>
      <Boxes boxes={glass}>
        <meshStandardMaterial color={PALETTE.glass} transparent opacity={0.22} roughness={0.05} metalness={0.3} depthWrite={false} side={THREE.DoubleSide} />
      </Boxes>
      <Boxes boxes={glassFrames}>
        <meshStandardMaterial color={PALETTE.graphite} roughness={0.35} metalness={0.6} />
      </Boxes>
      <Boxes boxes={glassTrim}>
        <meshBasicMaterial color={glow(PALETTE.cyan, 2.6)} toneMapped={false} />
      </Boxes>
    </group>
  );
}
