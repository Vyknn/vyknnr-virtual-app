'use client';

import { Suspense, useEffect, type ReactNode } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { Stats } from '@react-three/drei';
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { HALF_D, HALF_W } from './coords';
import { PALETTE } from './materials';
import { useOfficeStore } from '@/store/useOfficeStore';
import IsoCamera from './IsoCamera';
import Floor from './Floor';
import Zones from './Zones';
import Desks from './Desks';
import ServerRoom from './ServerRoom';
import Lounge from './Lounge';
import AICore from './AICore';
import Agents from './AgentAvatar';
import Effects from './Effects';

/*
 * Exposure budget for bloom (luminanceThreshold = 1.0):
 * the bloom pass runs on the linear HDR buffer before tone mapping, so any lit surface whose
 * linear radiance reaches 1.0 would bloom and wash the bright scene out. three's physical lights give
 * diffuse = intensity · cosθ · albedo / π, so a near-white surface (albedo ~0.9) facing up gets about
 *   sun 2.0 · 0.8 · 0.9 / π ≈ 0.46  +  hemisphere 0.8 · 0.9 / π ≈ 0.23  +  env 0.25 · ~0.9 ≈ 0.2   ≈ 0.89 < 1.0.
 * Local point lights (core / server room / lounge) are kept weak so they add only ~0.1–0.2 nearby.
 * Only emissive / basic materials with toneMapped={false} and color > 1 (see `glow()`) exceed the threshold.
 * (Estimate from the shading model, not measured on screen.)
 */
const ENV_INTENSITY = 0.25;
const HEMI_INTENSITY = 0.8;
const SUN_INTENSITY = 2.0;

/** Procedural studio reflections (no HDR download): PMREM of three's RoomEnvironment. */
function StudioEnvironment() {
  const gl = useThree((s) => s.gl);
  const get = useThree((s) => s.get);
  // Create + dispose in the same effect so StrictMode's mount/unmount/mount never reuses a disposed target.
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const rt = pmrem.fromScene(room, 0.04);
    room.dispose?.();
    pmrem.dispose();
    const scene = get().scene;
    scene.environment = rt.texture;
    scene.environmentIntensity = ENV_INTENSITY;
    return () => {
      if (scene.environment === rt.texture) scene.environment = null;
      rt.dispose();
    };
  }, [gl, get]);
  return null;
}

function Lights() {
  return (
    <>
      <hemisphereLight args={['#ffffff', '#c3cede', HEMI_INTENSITY]} />
      <directionalLight
        position={[-18, 30, 14]}
        intensity={SUN_INTENSITY}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
        shadow-camera-left={-HALF_W - 2}
        shadow-camera-right={HALF_W + 2}
        shadow-camera-top={HALF_D + 2}
        shadow-camera-bottom={-HALF_D - 2}
        shadow-camera-near={1}
        shadow-camera-far={90}
      />
    </>
  );
}

export interface OfficeSceneProps {
  /** Task 8 mounts avatars / dispatch beams / packets here (same world frame as `cellToWorld`). */
  children?: ReactNode;
}

/** Full-screen isometric office scene (static environment + live-reactive props). */
export default function OfficeScene({ children }: OfficeSceneProps) {
  return (
    <Canvas
      shadows
      onPointerMissed={() => useOfficeStore.getState().select(null)}
      dpr={[1, 1.75]}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <color attach="background" args={[PALETTE.background]} />
      <fog attach="fog" args={[PALETTE.background, 110, 220]} />
      <IsoCamera />
      <StudioEnvironment />
      <Lights />
      <Suspense fallback={null}>
        <Floor />
        <Zones />
        <Desks />
        <ServerRoom />
        <Lounge />
        <AICore />
        <Agents />
        <Effects />
        {children}
      </Suspense>
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur luminanceThreshold={1.0} luminanceSmoothing={0.1} intensity={0.9} radius={0.7} />
        {/* EffectComposer forces renderer.toneMapping = NoToneMapping; tone-map once at the end instead. */}
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      </EffectComposer>
      {process.env.NODE_ENV === 'development' && <Stats />}
    </Canvas>
  );
}
