'use client';

import { useEffect, useRef, type CSSProperties, type RefObject } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { ROSTER } from '@/core/roster';
import { OFFICE, deskOf } from '@/core/office';
import { DONE_TIME } from '@/core/sim';
import type { AgentDef, AgentRuntime, AgentState, Cell, TaskNode } from '@/core/types';
import { useOfficeStore } from '@/store/useOfficeStore';
import { posToWorldInto } from './coords';
import { PALETTE, glow } from './materials';

/*
 * Low-poly procedural agents. Each avatar reads its own AgentRuntime from the store inside useFrame
 * (no React re-render per frame) and drives a small joint rig through refs:
 *   root (world pos + smoothed heading, local +z = forward) → body (bob / jump / sit drop)
 *     → hips → thigh → knee → shin, torso, head (+hair), shoulders → arm + hand.
 * Rotation sign: a negative rotation.x on a hip/shoulder swings the limb forward (+z).
 */

// ------------------------------------------------------------------ appearance (derived; roster has only `color`)

const SKIN = ['#f3cfb3', '#e8b48f', '#d49a6a', '#b57a4e', '#8d5a36', '#f6d8c2'];
const HAIR = ['#1b1715', '#2f221b', '#4a2f1f', '#262626', '#6b4226', '#121212', '#5b3a29'];
type HairStyle = 'short' | 'buzz' | 'long' | 'bun';

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

interface Look { shirt: string; skin: string; hair: string; style: HairStyle; phase: number }
function lookOf(def: AgentDef): Look {
  const h = hash(def.id);
  // Feminine speech particle in the roster voice lines picks the longer styles (purely cosmetic).
  const fem = def.voice.accept.some((v) => v.includes('ค่ะ') || v.includes('คะ'));
  const style: HairStyle = fem ? (h & 1 ? 'long' : 'bun') : (h & 2 ? 'short' : 'buzz');
  return { shirt: def.color, skin: SKIN[h % SKIN.length], hair: HAIR[(h >>> 4) % HAIR.length], style, phase: ((h >>> 8) % 1000) / 1000 * Math.PI * 2 };
}

// ------------------------------------------------------------------ shared geometry (module-level, never disposed)

const BOX = new THREE.BoxGeometry(1, 1, 1);
const TORSO = new THREE.CapsuleGeometry(0.19, 0.3, 4, 12);
const HEAD = new THREE.SphereGeometry(0.155, 18, 14);
const HAIR_CAP = new THREE.SphereGeometry(0.168, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.52);
const BUN = new THREE.SphereGeometry(0.07, 10, 8);
const CUP = new THREE.CylinderGeometry(0.04, 0.032, 0.09, 10);
const RING = new THREE.RingGeometry(0.42, 0.5, 48);
const PANTS = '#334155';
const SHOES = '#1e293b';

// ------------------------------------------------------------------ rig dimensions

const HIP_Y = 0.78;
const THIGH = 0.38;
const SHIN = 0.34;
const SHOULDER_Y = 1.32;
const ARM = 0.5;
const DESK_SIT_DROP = 0.25; // chair seat top ≈ 0.5
const SOFA_SIT_DROP = 0.38; // sofa cushion top ≈ 0.37
const LABEL_Y = 2.05;
const LABEL_HZ = 5;

// pose channels
const BODY_Y = 0, LEAN = 1, HIP_L = 2, HIP_R = 3, KNEE_L = 4, KNEE_R = 5, SH_L = 6, SH_R = 7, SPREAD = 8, HEAD_X = 9, HEAD_Y = 10, OFF_Z = 11;
const N_CH = 12;

const STATE_COLOR: Record<AgentState, string> = {
  idle: '#94a3b8',
  walking_to_work: '#60a5fa',
  working: '#22d3ee',
  done: '#34d399',
  walking_to_lounge: '#a78bfa',
};

const TAU = Math.PI * 2;
function angleLerp(a: number, b: number, k: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  else if (d < -Math.PI) d += TAU;
  return a + d * k;
}
const near = (p: { x: number; z: number }, c: Cell, r: number) => Math.abs(p.x - c.x) < r && Math.abs(p.z - c.z) < r;

/** Sofa seat spots and the heading that faces away from the sofa back (back is the blocked neighbour). */
const SOFA_SPOTS = OFFICE.loungeSpots
  .filter((s) => s.style === 'sofa')
  .map((s) => ({ cell: s.cell, heading: s.cell.z > 0 && OFFICE.blocked[s.cell.z - 1]?.[s.cell.x] ? 0 : Math.PI }));

function nodeProgress(n: TaskNode): number {
  let total = 0, done = 0;
  for (let i = 0; i < n.steps.length; i++) {
    const d = n.steps[i].duration;
    total += d;
    if (i < n.stepIndex) done += d;
    else if (i === n.stepIndex) done += Math.min(d, n.stepElapsed);
  }
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

// ------------------------------------------------------------------ label styles (glass pill, see reference FL-03 LOAD-3109)

const PILL_STYLE: CSSProperties = {
  display: 'none',
  alignItems: 'center',
  gap: 6,
  padding: '3px 9px 3px 7px',
  borderRadius: 7,
  background: 'rgba(15, 23, 42, 0.78)',
  border: '1px solid rgba(255,255,255,0.18)',
  boxShadow: '0 4px 14px rgba(15,23,42,0.25)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  color: '#f8fafc',
  font: '600 11px/1.25 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  letterSpacing: '0.03em',
  whiteSpace: 'nowrap',
  userSelect: 'none',
  position: 'relative',
  overflow: 'hidden',
};
const DOT_STYLE: CSSProperties = { width: 7, height: 7, borderRadius: 999, flex: '0 0 auto' };
const BAR_STYLE: CSSProperties = { position: 'absolute', left: 0, bottom: 0, height: 2, width: '0%', opacity: 0.9 };

// ------------------------------------------------------------------ avatar

function AgentAvatar({ def }: { def: AgentDef }) {
  const look = lookOf(def);
  const desk = deskOf(def.id);

  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const hipL = useRef<THREE.Group>(null);
  const hipR = useRef<THREE.Group>(null);
  const kneeL = useRef<THREE.Group>(null);
  const kneeR = useRef<THREE.Group>(null);
  const shL = useRef<THREE.Group>(null);
  const shR = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const cup = useRef<THREE.Mesh>(null);
  const pill = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLSpanElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  // Mutable per-avatar animation state (allocated once).
  const anim = useRef({
    cur: new Float32Array(N_CH),
    goal: new Float32Array(N_CH),
    heading: NaN,
    prevX: NaN,
    prevZ: NaN,
    speed: 0,
    walkK: 0,
    phase: 0,
    labelT: 1,
    hovered: false,
    lastNode: '' as string,
    lastText: '',
    lastColor: '',
    lastSelected: false,
    lastShow: false,
    lastPct: -1,
  });

  useEffect(() => () => {
    if (anim.current.hovered) document.body.style.cursor = '';
  }, []);

  useFrame((state, rawDelta) => {
    const s = useOfficeStore.getState();
    const a: AgentRuntime | undefined = s.sim.agents[def.id];
    const r = root.current;
    if (!a || !r) return;
    const dt = Math.min(rawDelta, 0.1);
    const m = anim.current;
    const { cur, goal } = m;
    const now = state.clock.elapsedTime + look.phase;

    // --- motion estimate (handles pause: no motion → no walk cycle)
    let moved = 0;
    if (!Number.isNaN(m.prevX)) {
      const dx = a.pos.x - m.prevX, dz = a.pos.z - m.prevZ;
      moved = Math.sqrt(dx * dx + dz * dz);
      if (moved > 2) moved = 0; // teleport / reconnect
    }
    m.prevX = a.pos.x; m.prevZ = a.pos.z;
    const inst = dt > 0 ? moved / dt : 0;
    m.speed += (inst - m.speed) * (1 - Math.exp(-dt * 10));
    const moving = m.speed > 0.25;

    // --- base pose targets
    goal.fill(0);
    let heading = a.heading;
    let typing = false;
    let showCup = false;

    if (a.state === 'working' && near(a.pos, desk.seat, 0.3)) {
      heading = desk.facing;
      goal[BODY_Y] = -DESK_SIT_DROP; goal[HIP_L] = goal[HIP_R] = -1.5; goal[KNEE_L] = goal[KNEE_R] = 1.45;
      goal[OFF_Z] = 0.12; goal[LEAN] = 0.08;
      typing = true;
    } else if (a.state === 'working') {
      for (const c of OFFICE.rackConsoles) if (near(a.pos, c, 0.3)) { heading = Math.PI; break; } // racks face +z: look back at them
      typing = true;
    } else if (a.state === 'done') {
      goal[SH_L] = goal[SH_R] = -2.7; goal[SPREAD] = 0.35;
    } else if (a.state === 'idle' && !moving) {
      let sofaHeading = NaN;
      if (def.idleStyle === 'sofa') for (const sp of SOFA_SPOTS) if (near(a.pos, sp.cell, 0.3)) { sofaHeading = sp.heading; break; }
      if (!Number.isNaN(sofaHeading)) {
        heading = sofaHeading;
        goal[BODY_Y] = -SOFA_SIT_DROP; goal[HIP_L] = goal[HIP_R] = -1.45; goal[KNEE_L] = goal[KNEE_R] = 1.4;
        goal[OFF_Z] = -0.5; goal[LEAN] = -0.12; goal[SH_L] = goal[SH_R] = -0.35;
        goal[HEAD_Y] = Math.sin(now * 0.4) * 0.25;
      } else if (def.idleStyle === 'coffee') {
        showCup = true;
        const sip = Math.max(0, Math.sin(now * 1.4)) ** 6; // short sip every ~4.5 s
        goal[SH_R] = -0.75 - sip * 1.1; goal[HEAD_X] = -sip * 0.15;
      } else if (def.idleStyle === 'pingpong') {
        goal[SH_R] = -0.9 + Math.sin(now * 6) * 0.55; goal[SPREAD] = 0.1;
        goal[BODY_Y] = Math.abs(Math.sin(now * 6)) * 0.03; goal[LEAN] = 0.1;
      } else if (def.idleStyle === 'chat') {
        goal[SH_L] = -0.35 + Math.sin(now * 2.3) * 0.3; goal[SH_R] = -0.25 + Math.sin(now * 1.7 + 1) * 0.25;
        goal[HEAD_X] = Math.sin(now * 3.1) * 0.1;
      } else {
        goal[HEAD_Y] = Math.sin(now * 0.7) * 0.5; // wander / standing: look around
      }
    }
    if (typing) {
      goal[SH_L] = -1.25 + Math.sin(now * 14) * 0.07;
      goal[SH_R] = -1.25 + Math.sin(now * 14 + 2) * 0.07;
      goal[SPREAD] = -0.08;
      goal[HEAD_X] = 0.12;
    }

    // --- damp pose + heading
    const k = 1 - Math.exp(-dt * 9);
    for (let i = 0; i < N_CH; i++) cur[i] += (goal[i] - cur[i]) * k;
    m.heading = Number.isNaN(m.heading) ? heading : angleLerp(m.heading, heading, 1 - Math.exp(-dt * 10));

    // --- additive walk cycle (phase follows distance travelled) + done hop + breathing
    m.walkK += ((moving ? 1 : 0) - m.walkK) * (1 - Math.exp(-dt * 8));
    m.phase = (m.phase + moved * (TAU / 1.15)) % TAU;
    const sw = Math.sin(m.phase) * 0.6 * m.walkK;
    let hop = 0;
    if (a.state === 'done') {
      const u = (s.sim.t - a.stateTime) / (DONE_TIME * 0.55);
      if (u >= 0 && u < 1) hop = Math.sin(Math.PI * u) * 0.32;
    }
    const bob = Math.abs(Math.cos(m.phase)) * 0.045 * m.walkK + Math.sin(now * 2) * 0.006;

    // --- apply to rig
    posToWorldInto(a.pos, r.position);
    r.position.x += Math.sin(m.heading) * cur[OFF_Z];
    r.position.z += Math.cos(m.heading) * cur[OFF_Z];
    r.rotation.y = m.heading;
    if (body.current) { body.current.position.y = cur[BODY_Y] + bob + hop; body.current.rotation.x = cur[LEAN]; }
    if (hipL.current) hipL.current.rotation.x = cur[HIP_L] + sw;
    if (hipR.current) hipR.current.rotation.x = cur[HIP_R] - sw;
    if (kneeL.current) kneeL.current.rotation.x = cur[KNEE_L] + Math.max(0, Math.sin(m.phase)) * 0.7 * m.walkK;
    if (kneeR.current) kneeR.current.rotation.x = cur[KNEE_R] + Math.max(0, -Math.sin(m.phase)) * 0.7 * m.walkK;
    if (shL.current) { shL.current.rotation.x = cur[SH_L] - sw * 0.8; shL.current.rotation.z = -cur[SPREAD] - 0.06; }
    if (shR.current) { shR.current.rotation.x = cur[SH_R] + sw * 0.8; shR.current.rotation.z = cur[SPREAD] + 0.06; }
    if (head.current) { head.current.rotation.x = cur[HEAD_X]; head.current.rotation.y = cur[HEAD_Y]; }
    if (cup.current) cup.current.visible = showCup;

    // --- label (DOM, throttled)
    m.labelT += dt;
    if (m.labelT < 1 / LABEL_HZ) return;
    m.labelT = 0;
    if (a.currentNodeId) m.lastNode = a.currentNodeId;
    const selected = s.selectedAgentId === def.id;
    const show = a.state !== 'idle' || m.hovered || selected;
    if (pill.current && show !== m.lastShow) { pill.current.style.display = show ? 'flex' : 'none'; m.lastShow = show; }
    if (!show) return;
    const node = a.currentNodeId ? s.sim.nodes[a.currentNodeId] : undefined;
    let pct = -1;
    let label = def.name;
    if (node) { pct = nodeProgress(node); label = `${def.name} · ${node.id} ${pct}%`; }
    else if (a.state === 'done' && m.lastNode) { pct = 100; label = `${def.name} · ${m.lastNode} 100%`; }
    if (label !== m.lastText && text.current) { text.current.textContent = label; m.lastText = label; }
    const color = STATE_COLOR[a.state];
    if (color !== m.lastColor) {
      if (dot.current) { dot.current.style.background = color; dot.current.style.boxShadow = `0 0 6px ${color}`; }
      if (bar.current) bar.current.style.background = color;
      m.lastColor = color;
      m.lastSelected = !selected; // force border refresh below
    }
    if (selected !== m.lastSelected) {
      if (pill.current) pill.current.style.borderColor = selected ? color : 'rgba(255,255,255,0.18)';
      m.lastSelected = selected;
    }
    if (pct !== m.lastPct && bar.current) { bar.current.style.width = `${Math.max(0, pct)}%`; m.lastPct = pct; }
  });

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    anim.current.hovered = true;
    anim.current.labelT = 1; // refresh label next frame
    document.body.style.cursor = 'pointer';
  };
  const onOut = () => {
    anim.current.hovered = false;
    anim.current.labelT = 1;
    document.body.style.cursor = '';
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 6) return; // ended a map drag, not a click
    useOfficeStore.getState().select(def.id);
  };

  const leg = (hip: RefObject<THREE.Group | null>, knee: RefObject<THREE.Group | null>, x: number) => (
    <group ref={hip} position={[x, HIP_Y, 0]}>
      <mesh geometry={BOX} dispose={null} position={[0, -THIGH / 2, 0]} scale={[0.13, THIGH, 0.14]} castShadow>
        <meshStandardMaterial color={PANTS} roughness={0.75} />
      </mesh>
      <group ref={knee} position={[0, -THIGH, 0]}>
        <mesh geometry={BOX} dispose={null} position={[0, -SHIN / 2, 0]} scale={[0.12, SHIN, 0.13]}>
          <meshStandardMaterial color={PANTS} roughness={0.75} />
        </mesh>
        <mesh geometry={BOX} dispose={null} position={[0, -SHIN - 0.03, 0.04]} scale={[0.13, 0.07, 0.22]}>
          <meshStandardMaterial color={SHOES} roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
  const arm = (ref: RefObject<THREE.Group | null>, x: number, withCup: boolean) => (
    <group ref={ref} position={[x, SHOULDER_Y, 0]}>
      <mesh geometry={BOX} dispose={null} position={[0, -ARM / 2, 0]} scale={[0.1, ARM, 0.11]}>
        <meshStandardMaterial color={look.shirt} roughness={0.7} />
      </mesh>
      <mesh geometry={BOX} dispose={null} position={[0, -ARM - 0.04, 0]} scale={[0.09, 0.09, 0.09]}>
        <meshStandardMaterial color={look.skin} roughness={0.6} />
      </mesh>
      {withCup && (
        <mesh ref={cup} geometry={CUP} dispose={null} position={[0, -ARM - 0.05, 0.07]} visible={false}>
          <meshStandardMaterial color="#f8fafc" roughness={0.35} />
        </mesh>
      )}
    </group>
  );

  return (
    <group ref={root} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
      <group ref={body}>
        {leg(hipL, kneeL, -0.1)}
        {leg(hipR, kneeR, 0.1)}
        <mesh geometry={TORSO} dispose={null} position={[0, 1.08, 0]} scale={[1, 1, 0.78]} castShadow>
          <meshStandardMaterial color={look.shirt} roughness={0.7} />
        </mesh>
        {arm(shL, -0.255, false)}
        {arm(shR, 0.255, true)}
        <group ref={head} position={[0, 1.57, 0]}>
          <mesh geometry={HEAD} dispose={null} castShadow>
            <meshStandardMaterial color={look.skin} roughness={0.6} />
          </mesh>
          <mesh geometry={HAIR_CAP} dispose={null} rotation={[-0.25, 0, 0]} scale={look.style === 'buzz' ? 0.96 : 1}>
            <meshStandardMaterial color={look.hair} roughness={0.8} />
          </mesh>
          {look.style === 'long' && (
            <mesh geometry={BOX} dispose={null} position={[0, -0.1, -0.1]} scale={[0.3, 0.3, 0.1]}>
              <meshStandardMaterial color={look.hair} roughness={0.8} />
            </mesh>
          )}
          {look.style === 'bun' && (
            <mesh geometry={BUN} dispose={null} position={[0, 0.12, -0.12]}>
              <meshStandardMaterial color={look.hair} roughness={0.8} />
            </mesh>
          )}
        </group>
      </group>
      <Html position={[0, LABEL_Y, 0]} center zIndexRange={[40, 10]} pointerEvents="none" style={{ pointerEvents: 'none' }}>
        <div ref={pill} style={PILL_STYLE}>
          <span ref={dot} style={DOT_STYLE} />
          <span ref={text}>{def.name}</span>
          <div ref={bar} style={BAR_STYLE} />
        </div>
      </Html>
    </group>
  );
}

// ------------------------------------------------------------------ selection ring

const RING_COLOR = glow(PALETTE.cyan, 4);

function SelectionRing() {
  const selected = useOfficeStore((s) => s.selectedAgentId);
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const a = selected ? useOfficeStore.getState().sim.agents[selected] : undefined;
    m.visible = !!a;
    if (!a) return;
    posToWorldInto(a.pos, m.position, 0.025);
    m.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 4) * 0.06);
  });
  return (
    <mesh ref={mesh} geometry={RING} dispose={null} rotation={[-Math.PI / 2, 0, 0]} visible={false} renderOrder={2}>
      <meshBasicMaterial color={RING_COLOR} toneMapped={false} transparent opacity={0.95} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** All roster avatars + the floor ring under the selected one. Mount inside OfficeScene. */
export default function Agents() {
  return (
    <>
      {ROSTER.map((def) => <AgentAvatar key={def.id} def={def} />)}
      <SelectionRing />
    </>
  );
}
