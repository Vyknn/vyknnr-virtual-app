import { create } from 'zustand';
import type { Cell } from '@/core/types';

/** Camera control API shared by the 3D scene (IsoCamera) and UI (Task 9 buttons). */
export interface CameraControlsState {
  /** Unbounded 90° step counter; yaw = π/4 + yawIndex·π/2. */
  yawIndex: number;
  /** Latest pan-to request in cell units (fractional ok); `seq` makes repeated requests distinct. */
  focus: { x: number; z: number; seq: number } | null;
  rotate(dir: 1 | -1): void;
  focusOn(cell: Cell | { x: number; z: number }): void;
}

let seq = 0;

export const useCameraControls = create<CameraControlsState>((set) => ({
  yawIndex: 0,
  focus: null,
  rotate: (dir) => set((s) => ({ yawIndex: s.yawIndex + dir })),
  focusOn: (cell) => set({ focus: { x: cell.x, z: cell.z, seq: ++seq } }),
}));

export const ISO_PITCH = Math.atan(1 / Math.SQRT2); // 35.264°
export const yawFromIndex = (i: number): number => Math.PI / 4 + i * (Math.PI / 2);

export const rotateCameraLeft = (): void => useCameraControls.getState().rotate(-1);
export const rotateCameraRight = (): void => useCameraControls.getState().rotate(1);
export const focusCameraOn = (cell: { x: number; z: number }): void => useCameraControls.getState().focusOn(cell);
