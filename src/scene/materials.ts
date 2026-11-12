import * as THREE from 'three';

/** Palette: light-neutral base + saturated neon accents (spec §7.1). */
export const PALETTE = {
  background: '#e8edf4',
  floor: '#d9e0ea',
  slab: '#aeb8c7',
  wall: '#eef1f6',
  graphite: '#2a3140',
  deskTop: '#f4f6fa',
  deskLeg: '#9aa6b8',
  chair: '#3b4456',
  glass: '#cfe8ff',
  cyan: '#22d3ee',
  blue: '#3b82f6',
  violet: '#8b5cf6',
  screenIdle: '#1b2333',
  screenWorking: '#67e8f9',
} as const;

/** HDR color for emissive/basic materials with toneMapped={false}: values > 1 pass the bloom threshold. */
export function glow(color: THREE.ColorRepresentation, intensity: number): THREE.Color {
  return new THREE.Color(color).multiplyScalar(intensity);
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return [c, ctx];
}

function finish(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Faint tile grid for the glossy floor (repeat = 1 tile per cell). */
export function makeFloorTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 128);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(120,135,160,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 126, 126);
  const t = finish(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Cold-aisle perforated tiles. */
export function makeAisleTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(64, 64);
  ctx.fillStyle = '#9fd8ff';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = 'rgba(20,60,110,0.45)';
  for (let y = 6; y < 64; y += 8) for (let x = 6; x < 64; x += 8) ctx.fillRect(x, y, 3, 3);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 62, 62);
  const t = finish(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Rack front: grid of LEDs (some off). Scroll `offset.y` in steps to fake blinking. */
export function makeLedTexture(): THREE.CanvasTexture {
  const cols = 6, rows = 48, cw = 12, ch = 10;
  const [c, ctx] = canvas(cols * cw, rows * ch);
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, c.width, c.height);
  const leds = ['#34d399', '#22d3ee', '#22d3ee', '#60a5fa', '#fbbf24', '#a78bfa'];
  let s = 1234567;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let r = 0; r < rows; r++) {
    // horizontal bezel line every 4 rows = one "server unit"
    if (r % 4 === 0) { ctx.fillStyle = '#1f2a3d'; ctx.fillRect(0, r * ch, c.width, 1); }
    for (let k = 0; k < cols; k++) {
      if (rnd() < 0.35) continue;
      ctx.fillStyle = leds[Math.floor(rnd() * leds.length)];
      ctx.fillRect(k * cw + 3, r * ch + 3, cw - 6, ch - 6);
    }
  }
  const t = finish(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 0.5);
  t.magFilter = THREE.NearestFilter;
  return t;
}

/** Soft travelling light pulse for floor conduits (u axis = along the conduit). */
export function makePulseTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 8);
  const g = ctx.createLinearGradient(0, 0, 128, 0);
  g.addColorStop(0, 'rgba(255,255,255,0.08)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.15)');
  g.addColorStop(0.8, 'rgba(255,255,255,1)');
  g.addColorStop(0.86, 'rgba(255,255,255,0.15)');
  g.addColorStop(1, 'rgba(255,255,255,0.08)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 8);
  const t = finish(c, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function sceneFont(): string {
  if (typeof document === 'undefined') return 'system-ui, sans-serif';
  // Resolved next/font family list (hashed names) + Thai fallback.
  const fam = getComputedStyle(document.body).fontFamily;
  return fam ? `${fam}, "Noto Sans Thai", "Leelawadee UI", Tahoma, sans-serif` : 'system-ui, sans-serif';
}

/**
 * Holographic sign texture (zone label). Supports Thai via system/next fonts; redraws when fonts load.
 * Returns the texture and its aspect ratio (width / height).
 */
export function makeLabelTexture(text: string, color: string, sub?: string): { texture: THREE.CanvasTexture; aspect: number } {
  const H = 128, pad = 36;
  const draw = (c: HTMLCanvasElement, ctx: CanvasRenderingContext2D, measureOnly: boolean): number => {
    const font = sceneFont();
    ctx.font = `700 54px ${font}`;
    const tw = ctx.measureText(text.toUpperCase()).width;
    let sw = 0;
    if (sub) { ctx.font = `500 22px ${font}`; sw = ctx.measureText(sub).width; }
    const W = Math.ceil(Math.max(tw, sw) + pad * 2 + 24);
    if (measureOnly) return W;
    ctx.clearRect(0, 0, c.width, c.height);
    const r = 26;
    ctx.beginPath();
    ctx.roundRect(4, 4, c.width - 8, H - 8, r);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.82;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.stroke();
    // accent bar
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillRect(pad - 14, 30, 6, H - 60);
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.font = `700 54px ${font}`;
    ctx.fillText(text.toUpperCase(), pad + 6, sub ? 52 : H / 2 + 2);
    if (sub) { ctx.font = `500 22px ${font}`; ctx.globalAlpha = 0.85; ctx.fillText(sub, pad + 8, 96); ctx.globalAlpha = 1; }
    return c.width;
  };
  const [probe, pctx] = canvas(8, 8);
  const W = draw(probe, pctx, true);
  const [c, ctx] = canvas(W, H);
  draw(c, ctx, false);
  const texture = finish(c);
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    void document.fonts.ready.then(() => { draw(c, ctx, false); texture.needsUpdate = true; });
  }
  return { texture, aspect: W / H };
}

/** Compose an instance matrix: translate(pos) · rotateY(rotY) · scale(s). */
const _q = new THREE.Quaternion();
const _y = new THREE.Vector3(0, 1, 0);
export function instanceMatrix(pos: [number, number, number], rotY = 0, scale: [number, number, number] = [1, 1, 1]): THREE.Matrix4 {
  _q.setFromAxisAngle(_y, rotY);
  return new THREE.Matrix4().compose(new THREE.Vector3(...pos), _q, new THREE.Vector3(...scale));
}
