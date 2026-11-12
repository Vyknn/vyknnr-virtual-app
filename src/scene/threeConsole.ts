import { setConsoleFunction } from 'three';

/*
 * three r183 deprecated THREE.Clock, but @react-three/fiber 9.8.2 (latest stable) still creates one for
 * `state.clock` on every Canvas, so the warning fires on each mount and we can't fix it at the source.
 * Route three's console output through its official hook and drop only that exact message; every other
 * three log/warn/error passes through unchanged. Remove once R3F switches to THREE.Timer.
 */
const MUTED = new Set(['THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.']);

setConsoleFunction((type: 'log' | 'warn' | 'error', message: string, ...params: unknown[]) => {
  if (MUTED.has(message)) return;
  console[type](message, ...params);
});
