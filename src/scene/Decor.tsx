'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { OFFICE, type Decor as DecorItem, type DecorKind } from '@/core/office';
import { cellToWorld } from './coords';
import { PALETTE, glow } from './materials';

/**
 * Procedural low-poly props from `OFFICE.decor` (plants, shelves, whiteboards, speakers).
 * Each (kind, part) pair is one InstancedMesh written once on mount; nothing runs per frame.
 * Local frame: origin = cell centre on the floor, +z = the prop's front (`face`), back side at z = -0.5.
 */

type MatId = 'pot' | 'soil' | 'leaf' | 'stem' | 'shelf' | 'graphite' | 'board' | 'bookA' | 'bookB' | 'bookC' | 'gold' | 'glowCyan' | 'glowViolet' | 'glowOrange';
interface Part { geo: THREE.BufferGeometry; local: THREE.Matrix4; mat: MatId; tint?: boolean }

const FACE_ROT: Record<DecorItem['face'], number> = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 };
const LEAF_TINTS = ['#22c55e', '#16a34a', '#4ade80', '#15803d', '#65a30d'].map((c) => new THREE.Color(c));
const PLANTS = new Set<DecorKind>(['plantTall', 'plantBush', 'succulent', 'snakePlant']);

function m4(x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );
}

/** Deterministic 0..1 hash of a cell (stable variation in yaw, scale and leaf tint). */
const hash = (x: number, z: number, salt = 0) => {
  const s = Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

function buildParts(): Record<DecorKind, Part[]> {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const potGeo = new THREE.CylinderGeometry(1, 0.78, 1, 12);
  const disc = new THREE.CylinderGeometry(1, 1, 1, 12);
  const ico = new THREE.IcosahedronGeometry(1, 0);
  const icoFine = new THREE.IcosahedronGeometry(1, 1);
  const octa = new THREE.OctahedronGeometry(1, 0);
  const cone = new THREE.ConeGeometry(1, 1, 5);
  const stem = new THREE.CylinderGeometry(1, 1, 1, 5);
  const torus = new THREE.TorusGeometry(1, 0.08, 6, 20);
  const coneSpk = new THREE.CylinderGeometry(1, 1, 1, 16).rotateX(Math.PI / 2);

  const blades: Part[] = [
    [0, 0, 0.95, 0.04], [0.07, 0.04, 0.8, -0.18], [-0.07, -0.03, 0.85, 0.2], [0.02, -0.08, 0.7, 0.1], [-0.04, 0.08, 0.75, -0.12],
  ].map(([x, z, h, tilt]) => ({ geo: box, local: m4(x, 0.3 + h / 2, z, 0.075, h, 0.02, tilt, (x + z) * 9, tilt * 0.6), mat: 'leaf', tint: true }));

  return {
    plantTall: [
      { geo: potGeo, local: m4(0, 0.24, 0, 0.21, 0.48, 0.21), mat: 'pot' },
      { geo: disc, local: m4(0, 0.47, 0, 0.18, 0.02, 0.18), mat: 'soil' },
      { geo: stem, local: m4(0, 0.85, 0, 0.025, 0.8, 0.025), mat: 'stem' },
      { geo: ico, local: m4(0.04, 1.0, 0.02, 0.4, 0.34, 0.4), mat: 'leaf', tint: true },
      { geo: ico, local: m4(-0.05, 1.32, -0.03, 0.33, 0.3, 0.33, 0, 0.6), mat: 'leaf', tint: true },
      { geo: ico, local: m4(0.02, 1.58, 0.03, 0.21, 0.22, 0.21, 0, 1.1), mat: 'leaf', tint: true },
    ],
    plantBush: [
      { geo: potGeo, local: m4(0, 0.2, 0, 0.24, 0.4, 0.24), mat: 'pot' },
      { geo: icoFine, local: m4(0, 0.7, 0, 0.4, 0.36, 0.4), mat: 'leaf', tint: true },
    ],
    succulent: [
      { geo: potGeo, local: m4(0, 0.12, 0, 0.17, 0.24, 0.17), mat: 'pot' },
      { geo: octa, local: m4(0, 0.3, 0, 0.17, 0.1, 0.17, 0, 0.4), mat: 'leaf', tint: true },
      { geo: octa, local: m4(0, 0.35, 0, 0.11, 0.09, 0.11), mat: 'leaf', tint: true },
      { geo: cone, local: m4(0, 0.43, 0, 0.04, 0.09, 0.04), mat: 'glowOrange' },
    ],
    snakePlant: [
      { geo: box, local: m4(0, 0.16, 0, 0.36, 0.32, 0.36), mat: 'pot' },
      { geo: box, local: m4(0, 0.32, 0, 0.3, 0.02, 0.3), mat: 'soil' },
      ...blades,
    ],
    bookshelf: [
      { geo: box, local: m4(0, 0.8, -0.27, 0.92, 1.6, 0.04), mat: 'shelf' },
      { geo: box, local: m4(-0.45, 0.8, -0.13, 0.03, 1.6, 0.32), mat: 'shelf' },
      { geo: box, local: m4(0.45, 0.8, -0.13, 0.03, 1.6, 0.32), mat: 'shelf' },
      ...[0.03, 0.55, 1.07, 1.59].map((y) => ({ geo: box, local: m4(0, y, -0.13, 0.92, 0.03, 0.32), mat: 'shelf' as MatId })),
      { geo: box, local: m4(-0.12, 0.2, -0.13, 0.6, 0.3, 0.24), mat: 'bookA' },
      { geo: box, local: m4(0.1, 0.71, -0.13, 0.66, 0.28, 0.24), mat: 'bookB' },
      { geo: box, local: m4(-0.2, 1.22, -0.13, 0.42, 0.27, 0.24), mat: 'bookC' },
      { geo: box, local: m4(0, 0.045, 0.03, 0.9, 0.012, 0.012), mat: 'glowCyan' },
    ],
    whiteboard: [
      { geo: box, local: m4(-0.55, 0.75, -0.3, 0.04, 1.5, 0.04), mat: 'graphite' },
      { geo: box, local: m4(0.55, 0.75, -0.3, 0.04, 1.5, 0.04), mat: 'graphite' },
      { geo: box, local: m4(-0.55, 0.02, -0.3, 0.06, 0.04, 0.4), mat: 'graphite' },
      { geo: box, local: m4(0.55, 0.02, -0.3, 0.06, 0.04, 0.4), mat: 'graphite' },
      { geo: box, local: m4(0, 1.15, -0.3, 1.14, 0.72, 0.03), mat: 'board' },
      { geo: box, local: m4(0, 0.78, -0.27, 1.0, 0.025, 0.06), mat: 'graphite' },
      { geo: box, local: m4(-0.15, 1.28, -0.28, 0.6, 0.02, 0.005), mat: 'glowCyan' },
      { geo: box, local: m4(0.05, 1.16, -0.28, 0.75, 0.02, 0.005), mat: 'glowViolet' },
      { geo: box, local: m4(-0.2, 1.04, -0.28, 0.5, 0.02, 0.005), mat: 'glowOrange' },
    ],
    speaker: [
      { geo: box, local: m4(0, 0.55, -0.05, 0.48, 1.1, 0.42), mat: 'graphite' },
      { geo: coneSpk, local: m4(0, 0.38, 0.17, 0.16, 0.16, 0.02), mat: 'soil' },
      { geo: coneSpk, local: m4(0, 0.82, 0.17, 0.09, 0.09, 0.02), mat: 'soil' },
      { geo: torus, local: m4(0, 0.38, 0.18, 0.17, 0.17, 0.17), mat: 'glowViolet' },
      { geo: torus, local: m4(0, 0.82, 0.18, 0.1, 0.1, 0.1), mat: 'glowViolet' },
    ],
    trophyShelf: [
      { geo: box, local: m4(0, 0.45, -0.2, 0.9, 0.9, 0.3), mat: 'shelf' },
      { geo: box, local: m4(0, 0.6, -0.04, 0.88, 0.012, 0.012), mat: 'glowOrange' },
      ...[-0.28, 0, 0.28].flatMap((x, i) => {
        const h = i === 1 ? 1.15 : 1;
        return [
          { geo: box, local: m4(x, 0.94, -0.2, 0.12, 0.08, 0.12), mat: 'graphite' as MatId },
          { geo: stem, local: m4(x, 0.99 + (h - 1) * 0.5, -0.2, 0.02, 0.1 * h + 0.02, 0.02), mat: 'gold' as MatId },
          { geo: cone, local: m4(x, 1.11 + (h - 1) * 0.9, -0.2, 0.08, 0.14, 0.08, Math.PI), mat: 'gold' as MatId },
        ];
      }),
    ],
  };
}

function makeMaterials(): Record<MatId, THREE.Material> {
  const std = (color: THREE.ColorRepresentation, roughness: number, metalness = 0, flatShading = false) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading });
  const basic = (c: THREE.Color) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
  return {
    pot: std('#f8fafc', 0.3),
    soil: std('#3f2d22', 0.9),
    leaf: std('#ffffff', 0.8, 0, true), // tinted per instance
    stem: std('#6b4f3a', 0.8),
    shelf: std('#f1f5f9', 0.35, 0.05),
    graphite: std(PALETTE.graphite, 0.35, 0.6),
    board: std('#ffffff', 0.2, 0.05),
    bookA: std('#3b82f6', 0.6),
    bookB: std('#f59e0b', 0.6),
    bookC: std('#ec4899', 0.6),
    gold: std('#fbbf24', 0.25, 0.85),
    glowCyan: basic(glow(PALETTE.cyan, 2.2)),
    glowViolet: basic(glow('#a855f7', 2.4)),
    glowOrange: basic(glow('#f97316', 2.2)),
  };
}

function PartMesh({ part, items, material }: { part: Part; items: DecorItem[]; material: THREE.Material }) {
  const isPlant = PLANTS.has(items[0].kind);
  return (
    <instancedMesh
      args={[part.geo, material, items.length]}
      frustumCulled={false}
      castShadow
      ref={(m) => {
        if (!m) return;
        const base = new THREE.Matrix4();
        const out = new THREE.Matrix4();
        items.forEach((it, i) => {
          const [x, , z] = cellToWorld(it.cell);
          const yaw = FACE_ROT[it.face] + (isPlant ? hash(it.cell.x, it.cell.z) * Math.PI * 2 : 0);
          const s = isPlant ? 0.9 + hash(it.cell.x, it.cell.z, 1) * 0.2 : 1;
          base.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(s, s, s));
          m.setMatrixAt(i, out.multiplyMatrices(base, part.local));
          if (part.tint) m.setColorAt(i, LEAF_TINTS[Math.floor(hash(it.cell.x, it.cell.z, 2) * LEAF_TINTS.length)]);
        });
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }}
    />
  );
}

/** All decorations: one InstancedMesh per (kind, part), static after mount. */
export default function Decor() {
  const parts = useMemo(() => buildParts(), []);
  const materials = useMemo(() => makeMaterials(), []);
  const byKind = useMemo(() => {
    const map = new Map<DecorKind, DecorItem[]>();
    for (const d of OFFICE.decor) map.set(d.kind, [...(map.get(d.kind) ?? []), d]);
    return [...map];
  }, []);
  useEffect(() => () => {
    Object.values(materials).forEach((m) => m.dispose());
    new Set(Object.values(parts).flat().map((p) => p.geo)).forEach((g) => g.dispose());
  }, [materials, parts]);

  return (
    <group>
      {byKind.flatMap(([kind, items]) =>
        parts[kind].map((p, i) => <PartMesh key={`${kind}-${i}`} part={p} items={items} material={materials[p.mat]} />),
      )}
    </group>
  );
}
