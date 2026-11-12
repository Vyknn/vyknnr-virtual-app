'use client';

import { Suspense, useEffect, useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { Stats } from '@react-three/drei';
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { HALF_D, HALF_W } from './coords';
import { PALETTE } from './materials';
import IsoCamera from './IsoCamera';
import Floor from './Floor';
import Zones from './Zones';
import Desks from './Desks';
import ServerRoom from './ServerRoom';
import Lounge from './Lounge';
import AICore from './AICore';

/** Procedural studio reflections (no HDR download): PMREM of three's RoomEnvironment. */
function StudioEnvironment() {
  const gl = useThree((s) => s.gl);
  const get = useThree((s) => s.get);
  const env = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const rt = pmrem.fromScene(room, 0.04);
    room.dispose?.();
    pmrem.dispose();
    return rt;
  }, [gl]);
  useEffect(() => {
    const scene = get().scene;
    scene.environment = env.texture;
    scene.environmentIntensity = 0.55;
    return () => { scene.environment = null; env.dispose(); };
  }, [get, env]);
  return null;
}

function Lights() {
  return (
    <>
      <hemisphereLight args={['#ffffff', '#c3cede', 0.9]} />
      <directionalLight
        position={[-18, 30, 14]}
        intensity={1.6}
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
        {children}
      </Suspense>
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur luminanceThreshold={0.9} luminanceSmoothing={0.1} intensity={0.9} radius={0.7} />
        {/* EffectComposer forces renderer.toneMapping = NoToneMapping; tone-map once at the end instead. */}
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      </EffectComposer>
      {process.env.NODE_ENV === 'development' && <Stats className="pf-stats" />}
    </Canvas>
  );
}
