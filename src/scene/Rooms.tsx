'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { OFFICE, type Wall } from '@/core/office';
import { HALF_D, HALF_W, cellToWorld } from './coords';
import { PALETTE, glow, instanceMatrix, makeLabelTexture } from './materials';

/** Waist-high glass partitions: the iso camera looks over them, so desks and agents stay visible. */
const LOW_H = 1.25;
const PANE_T = 0.05;
const POST = 0.07;
const DOOR_H = 1.75;
const PLATE_H = 0.26;
const PLATE_MAX_W = 0.95;

interface Box { m: THREE.Matrix4; c?: THREE.Color }

const key = (x: number, z: number) => z * OFFICE.width + x;

/** Every cell covered by a wall segment (outer, solid, glass and low partitions). */
function wallCells(): Set<number> {
  const s = new Set<number>();
  for (const w of OFFICE.walls)
    for (let z = Math.min(w.from.z, w.to.z); z <= Math.max(w.from.z, w.to.z); z++)
      for (let x = Math.min(w.from.x, w.to.x); x <= Math.max(w.from.x, w.to.x); x++) s.add(key(x, z));
  return s;
}

/**
 * Low partition run → [a, b] extent along its axis (cell units).
 * An end meeting another wall in line extends to that wall's centre line; an end at a corner (perpendicular
 * wall next to it) stops at the cell centre so the two runs meet cleanly; a free end (doorway) stops at the cell edge.
 */
function runExtent(w: Wall, cells: Set<number>, low: Set<number>): { horizontal: boolean; a: number; b: number; fixed: number } {
  const horizontal = w.from.z === w.to.z;
  const lo = horizontal ? Math.min(w.from.x, w.to.x) : Math.min(w.from.z, w.to.z);
  const hi = horizontal ? Math.max(w.from.x, w.to.x) : Math.max(w.from.z, w.to.z);
  const fixed = horizontal ? w.from.z : w.from.x;
  const at = (i: number, j: number) => (horizontal ? key(i, j) : key(j, i));
  const end = (i: number, dir: -1 | 1): number => {
    if (cells.has(at(i + dir, fixed))) return i + 0.5 + dir; // continue to the neighbouring wall's centre
    if (low.has(at(i, fixed - 1)) || low.has(at(i, fixed + 1))) return i + 0.5 + dir * POST * 0.5; // corner
    return dir < 0 ? i : i + 1; // free end (doorway edge)
  };
  return { horizontal, a: end(lo, -1), b: end(hi, 1), fixed };
}

/** Partition box in world space for a run extent at height y with size (along, h, thickness). */
function runBox(r: ReturnType<typeof runExtent>, y: number, h: number, t: number, grow = 0): THREE.Matrix4 {
  const mid = (r.a + r.b) / 2, len = r.b - r.a + grow;
  const f = r.fixed + 0.5;
  return r.horizontal
    ? instanceMatrix([mid - HALF_W, y, f - HALF_D], 0, [len, h, t])
    : instanceMatrix([f - HALF_W, y, mid - HALF_D], 0, [t, h, len]);
}

function Instanced({ boxes, children, geo }: { boxes: Box[]; children: React.ReactNode; geo?: THREE.BufferGeometry }) {
  return (
    <instancedMesh
      args={[geo, undefined, boxes.length]}
      frustumCulled={false}
      ref={(m) => {
        if (!m) return;
        boxes.forEach((b, i) => { m.setMatrixAt(i, b.m); if (b.c) m.setColorAt(i, b.c); });
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }}
    >
      {geo ? null : <boxGeometry />}
      {children}
    </instancedMesh>
  );
}

/** Small nameplate on the partition next to the door, on the corridor side. */
function Nameplate({ label, color, pos, rotY }: { label: string; color: string; pos: [number, number, number]; rotY: number }) {
  const { texture, aspect } = useMemo(() => makeLabelTexture(label, color), [label, color]);
  useEffect(() => () => texture.dispose(), [texture]);
  const h = Math.min(PLATE_H, PLATE_MAX_W / aspect); // long labels shrink so the plate never spans the doorway
  return (
    <mesh position={pos} rotation-y={rotY}>
      <planeGeometry args={[h * aspect, h]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} color="#ffffff" depthWrite={false} />
    </mesh>
  );
}

/** Department rooms: low glass partitions with a slim frame, zone-coloured glowing top trim, door frames, nameplates. */
export default function Rooms() {
  const data = useMemo(() => {
    const cells = wallCells();
    const lowWalls = OFFICE.walls.filter((w) => w.low);
    const low = new Set<number>();
    for (const w of lowWalls)
      for (let z = Math.min(w.from.z, w.to.z); z <= Math.max(w.from.z, w.to.z); z++)
        for (let x = Math.min(w.from.x, w.to.x); x <= Math.max(w.from.x, w.to.x); x++) low.add(key(x, z));

    const panes: Box[] = [], rails: Box[] = [], trims: Box[] = [], posts: Box[] = [];
    const doorPosts: Box[] = [], lintels: Box[] = [];
    for (const w of lowWalls) {
      const r = runExtent(w, cells, low);
      const col = glow(w.color ?? PALETTE.cyan, 2.2);
      panes.push({ m: runBox(r, LOW_H / 2, LOW_H, PANE_T) });
      rails.push({ m: runBox(r, 0.05, 0.1, 0.12) });
      trims.push({ m: runBox(r, LOW_H + 0.02, 0.04, 0.09, 0.02), c: col });
      for (const e of [r.a, r.b]) {
        const p = e + (e === r.a ? POST / 2 : -POST / 2);
        const f = r.fixed + 0.5;
        const pos: [number, number, number] = r.horizontal ? [p - HALF_W, LOW_H / 2, f - HALF_D] : [f - HALF_W, LOW_H / 2, p - HALF_D];
        posts.push({ m: instanceMatrix(pos, 0, [POST, LOW_H, POST]) });
      }
    }

    const plates: { id: string; label: string; color: string; pos: [number, number, number]; rotY: number }[] = [];
    for (const d of OFFICE.doors) {
      const zone = OFFICE.zones.find((z) => z.id === d.zoneId);
      if (!zone) continue;
      const [a, b] = d.cells;
      const horizontal = a.z === b.z;
      const col = glow(d.color, 2.6);
      // door edges: outer boundaries of the two door cells
      const [ax, , az] = cellToWorld(a), [bx, , bz] = cellToWorld(b);
      const e1: [number, number] = horizontal ? [Math.min(ax, bx) - 0.5, az] : [ax, Math.min(az, bz) - 0.5];
      const e2: [number, number] = horizontal ? [Math.max(ax, bx) + 0.5, az] : [ax, Math.max(az, bz) + 0.5];
      for (const [x, z] of [e1, e2]) doorPosts.push({ m: instanceMatrix([x, DOOR_H / 2, z], 0, [0.06, DOOR_H, 0.06]), c: col });
      const cx = (e1[0] + e2[0]) / 2, cz = (e1[1] + e2[1]) / 2;
      lintels.push({ m: instanceMatrix([cx, DOOR_H, cz], horizontal ? 0 : Math.PI / 2, [2.06, 0.05, 0.06]), c: col });

      // outward normal: away from the zone centre
      const zc = { x: zone.rect.x + zone.rect.w / 2, z: zone.rect.z + zone.rect.d / 2 };
      const nx = horizontal ? 0 : Math.sign(a.x + 0.5 - zc.x), nz = horizontal ? Math.sign(a.z + 0.5 - zc.z) : 0;
      const rotY = Math.atan2(nx, nz);
      // plate on the partition just past the second door post, centred on the next cell
      const along = horizontal ? [e2[0] + 0.55, cz] : [cx, e2[1] + 0.55];
      plates.push({
        id: zone.id, label: zone.label, color: zone.color, rotY,
        pos: [along[0] + nx * (PANE_T / 2 + 0.01), 1.0, along[1] + nz * (PANE_T / 2 + 0.01)],
      });
    }
    return { panes, rails, trims, posts, doorPosts, lintels, plates };
  }, []);

  return (
    <group>
      <Instanced boxes={data.panes}>
        <meshStandardMaterial color={PALETTE.glass} transparent opacity={0.2} roughness={0.05} metalness={0.3} depthWrite={false} side={THREE.DoubleSide} />
      </Instanced>
      <Instanced boxes={data.rails}>
        <meshStandardMaterial color={PALETTE.graphite} roughness={0.35} metalness={0.6} />
      </Instanced>
      <Instanced boxes={data.posts}>
        <meshStandardMaterial color={PALETTE.graphite} roughness={0.35} metalness={0.6} />
      </Instanced>
      <Instanced boxes={data.trims}>
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </Instanced>
      <Instanced boxes={data.doorPosts}>
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </Instanced>
      <Instanced boxes={data.lintels}>
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </Instanced>
      {data.plates.map((p) => <Nameplate key={p.id} label={p.label} color={p.color} pos={p.pos} rotY={p.rotY} />)}
    </group>
  );
}
