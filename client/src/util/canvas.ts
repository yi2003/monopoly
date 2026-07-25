/* Low-level 2D canvas helpers for procedural textures — ported from opus5. */

import * as THREE from 'three';
import { Rng } from './rng';

const _cache = new Map<string, THREE.CanvasTexture>();

export function cacheStats(): number { return _cache.size; }

export function disposeTextureCache(): void {
  for (const t of _cache.values()) if (t && t.dispose) t.dispose();
  _cache.clear();
}

export interface CanvasResult {
  c: HTMLCanvasElement;
  x: CanvasRenderingContext2D;
  w: number;
  h: number;
}

export function cv(w: number, h: number): CanvasResult {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: false })!;
  return { c, x, w, h };
}

export interface TexOpts {
  srgb?: boolean;
  repeat?: [number, number];
  aniso?: number;
  flipY?: boolean;
  wrap?: THREE.Wrapping;
}

/**
 * Cached texture factory.
 * @param key      cache key
 * @param w,h      canvas size
 * @param draw     draw function
 * @param opts     texture options
 */
export function tex(
  key: string, w: number, h: number,
  draw: (x: CanvasRenderingContext2D, w: number, h: number) => void,
  opts: TexOpts = {},
): THREE.CanvasTexture {
  if (_cache.has(key)) return _cache.get(key)!;
  const { c, x } = cv(w, h);
  draw(x, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  const wrap = opts.wrap ?? THREE.RepeatWrapping;
  t.wrapS = t.wrapT = wrap;
  if (opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
  t.anisotropy = opts.aniso ?? 8;
  if (opts.flipY === false) t.flipY = false;
  t.needsUpdate = true;
  _cache.set(key, t);
  return t;
}

/** Uncached variant for one-off textures. */
export function texOnce(
  w: number, h: number,
  draw: (x: CanvasRenderingContext2D, w: number, h: number) => void,
  opts: TexOpts = {},
): THREE.CanvasTexture {
  const { c, x } = cv(w, h);
  draw(x, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = opts.wrap ?? THREE.ClampToEdgeWrapping;
  if (opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
  t.anisotropy = opts.aniso ?? 8;
  t.needsUpdate = true;
  return t;
}

/* ─────────────────────────── noise ─────────────────────────── */

export function noiseLayer(
  x: CanvasRenderingContext2D, w: number, h: number,
  opts: { cells?: number; octaves?: number; alpha?: number; seed?: number; mode?: string; dark?: boolean } = {},
): void {
  const { cells = 8, octaves = 4, alpha = 0.5, seed = 1, mode = 'source-over', dark = true } = opts;
  const rng = new Rng(seed);
  x.save();
  (x as any).globalCompositeOperation = mode;
  let a = alpha, cs = cells;
  for (let o = 0; o < octaves; o++) {
    const cw = w / cs, ch = h / cs;
    for (let iy = 0; iy < cs; iy++) {
      for (let ix = 0; ix < cs; ix++) {
        const v = rng.next();
        const lum = dark ? Math.floor(v * 60) : Math.floor(120 + v * 135);
        x.fillStyle = `rgba(${lum},${lum},${lum},${a})`;
        x.fillRect(ix * cw, iy * ch, cw + 1, ch + 1);
      }
    }
    a *= 0.55; cs *= 2;
  }
  x.restore();
}

const clamp255 = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Per-pixel monochrome grain. Use on small textures only. */
export function grain(
  x: CanvasRenderingContext2D, w: number, h: number,
  amount = 14, seed = 7, alpha = 1,
): void {
  const img = x.getImageData(0, 0, w, h);
  const d = img.data;
  const rng = new Rng(seed);
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng.next() - 0.5) * amount * 2;
    d[i] = clamp255(d[i] + n);
    d[i + 1] = clamp255(d[i + 1] + n);
    d[i + 2] = clamp255(d[i + 2] + n);
    if (alpha !== 1) d[i + 3] = Math.floor(d[i + 3] * alpha);
  }
  x.putImageData(img, 0, 0);
}

export function splotches(
  x: CanvasRenderingContext2D, w: number, h: number,
  opts: { count?: number; rMin?: number; rMax?: number; color?: string; seed?: number; yBias?: number } = {},
): void {
  const { count = 24, rMin = 8, rMax = 60, color = 'rgba(0,0,0,0.2)', seed = 3, yBias = 0 } = opts;
  const rng = new Rng(seed);
  for (let i = 0; i < count; i++) {
    const cx = rng.f(0, w);
    const cy = yBias ? h * Math.pow(rng.next(), 1 / Math.max(0.001, yBias)) : rng.f(0, h);
    const r = rng.f(rMin, rMax);
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.beginPath();
    x.ellipse(cx, cy, r, r * rng.f(0.5, 1.4), rng.f(0, Math.PI), 0, Math.PI * 2);
    x.fill();
  }
}

export function drips(
  x: CanvasRenderingContext2D, w: number, h: number,
  opts: { count?: number; y0?: number; len?: number; color?: string; seed?: number; width?: number } = {},
): void {
  const { count = 30, y0 = 0, len = 90, color = 'rgba(0,0,0,0.16)', seed = 11, width = 3 } = opts;
  const rng = new Rng(seed);
  for (let i = 0; i < count; i++) {
    const cx = rng.f(0, w);
    const l = rng.f(len * 0.25, len);
    const g = x.createLinearGradient(0, y0, 0, y0 + l);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(cx, y0, rng.f(1, width), l);
  }
}

export function cracks(
  x: CanvasRenderingContext2D, w: number, h: number,
  opts: { count?: number; seed?: number; color?: string; maxLen?: number; width?: number } = {},
): void {
  const { count = 14, seed = 5, color = 'rgba(0,0,0,0.35)', maxLen = 120, width = 1.1 } = opts;
  const rng = new Rng(seed);
  x.save();
  x.strokeStyle = color;
  x.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    let px = rng.f(0, w), py = rng.f(0, h);
    let ang = rng.f(0, Math.PI * 2);
    x.lineWidth = rng.f(width * 0.5, width);
    x.beginPath(); x.moveTo(px, py);
    const segs = rng.i(3, 9);
    for (let s = 0; s < segs; s++) {
      ang += rng.j(0.9);
      const step = rng.f(6, maxLen / segs);
      px += Math.cos(ang) * step; py += Math.sin(ang) * step;
      x.lineTo(px, py);
    }
    x.stroke();
    if (rng.bool(0.4)) {
      x.lineWidth = rng.f(0.4, 0.9);
      x.beginPath(); x.moveTo(px, py);
      let a2 = ang + rng.j(1.4);
      for (let s = 0; s < 3; s++) {
        a2 += rng.j(0.7);
        px += Math.cos(a2) * rng.f(5, 22); py += Math.sin(a2) * rng.f(5, 22);
        x.lineTo(px, py);
      }
      x.stroke();
    }
  }
  x.restore();
}

/* ─────────────────── text helpers ─────────────────── */

export function glowText(
  x: CanvasRenderingContext2D, text: string, cx: number, cy: number,
  opts: { color?: string; glow?: string; blur?: number; passes?: number; lineWidth?: number } = {},
): void {
  const { color = '#fff', glow = '#f0f', blur = 26, passes = 3, lineWidth = 0 } = opts;
  x.save();
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = glow;
  for (let i = passes; i > 0; i--) {
    x.shadowBlur = blur * (i / passes);
    x.fillStyle = color;
    x.fillText(text, cx, cy);
  }
  x.shadowBlur = 0;
  if (lineWidth) { x.lineWidth = lineWidth; x.strokeStyle = color; x.strokeText(text, cx, cy); }
  x.restore();
}

export function trackedText(
  x: CanvasRenderingContext2D, text: string, cx: number, cy: number,
  tracking: number, align: CanvasTextAlign = 'center',
): number {
  const chars = [...text];
  let total = 0;
  for (const ch of chars) total += x.measureText(ch).width + tracking;
  total -= tracking;
  let px = align === 'center' ? cx - total / 2 : cx;
  const prev = x.textAlign;
  x.textAlign = 'left';
  for (const ch of chars) {
    x.fillText(ch, px, cy);
    px += x.measureText(ch).width + tracking;
  }
  x.textAlign = prev;
  return total;
}

/* ─────────────────── colour helpers ─────────────────── */

export function shade(hex: string, amt: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l + amt)));
  return '#' + c.getHexString();
}

export function rgba(hex: string, a: number): string {
  const c = new THREE.Color(hex);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
}

export function jitterHex(hex: string, rng: Rng, hA = 0.02, sA = 0.1, lA = 0.08): string {
  const c = new THREE.Color(hex);
  const o = { h: 0, s: 0, l: 0 }; c.getHSL(o);
  c.setHSL(
    (o.h + rng.j(hA) + 1) % 1,
    Math.min(1, Math.max(0, o.s + rng.j(sA))),
    Math.min(1, Math.max(0, o.l + rng.j(lA))),
  );
  return '#' + c.getHexString();
}
