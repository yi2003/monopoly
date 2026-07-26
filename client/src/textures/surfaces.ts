/* Procedural surface textures for streets, sidewalks, building skins — ported from opus5. */

import * as THREE from 'three';
import { tex, noiseLayer, grain, splotches, drips, cracks, shade, rgba } from '../util/canvas';
import { Rng } from '../util/rng';

export function asphaltTex(eraId: string, variant = 'base'): THREE.CanvasTexture {
  return tex(`asphalt:${eraId}:${variant}`, 512, 512, (x, w, h) => {
    const rng = new Rng(`asphalt-${eraId}-${variant}`);
    const base = eraId === 'classic' ? '#2a2a28' : '#222422';
    x.fillStyle = base;
    x.fillRect(0, 0, w, h);
    noiseLayer(x, w, h, { cells: 10, octaves: 4, alpha: 0.45, seed: rng.i(1, 999), dark: true });
    grain(x, w, h, 18, rng.i(1, 999));
    if (variant.includes('cracked')) {
      cracks(x, w, h, { count: 22, seed: rng.i(1, 999), color: 'rgba(0,0,0,0.45)', maxLen: 180 });
    }
  }, { repeat: [8, 8], aniso: 8 });
}

export function sidewalkTex(eraId: string): THREE.CanvasTexture {
  return tex(`sidewalk:${eraId}`, 512, 512, (x, w, h) => {
    const rng = new Rng(`sw-${eraId}`);
    const base = '#8a8680';
    x.fillStyle = base;
    x.fillRect(0, 0, w, h);
    // paver grid
    const cell = 128;
    x.strokeStyle = 'rgba(0,0,0,0.18)';
    x.lineWidth = 2;
    for (let i = 0; i <= w; i += cell) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); }
    for (let j = 0; j <= h; j += cell) { x.beginPath(); x.moveTo(0, j); x.lineTo(w, j); x.stroke(); }
    noiseLayer(x, w, h, { cells: 8, octaves: 3, alpha: 0.3, seed: rng.i(1, 999) });
    grain(x, w, h, 12, rng.i(1, 999));
  }, { repeat: [4, 4], aniso: 8 });
}

export interface FacadeOpts {
  floors?: number;
  bays?: number;
  soot?: number;
  lit?: number;
  warmth?: number;
  brick?: string;
  tint?: string;
  eraId?: string;
}

export function brickFacade(seed: string, opts: FacadeOpts = {}): THREE.CanvasTexture {
  const {
    floors = 5, bays = 4, soot = 0.3, lit = 0.7, warmth = 0.6,
    brick = '#8a4a38', eraId = 'classic',
  } = opts;
  const key = `brick:${seed}:${floors}:${bays}:${soot}:${lit}:${eraId}`;
  return tex(key, 512, 1024, (x, w, h) => {
    const rng = new Rng(seed);
    x.fillStyle = brick;
    x.fillRect(0, 0, w, h);

    // brick courses
    const bh = 14, bw = 30;
    for (let row = 0, y = 0; y < h; row++, y += bh) {
      const off = row % 2 ? bw / 2 : 0;
      for (let px = -bw; px < w + bw; px += bw) {
        const j = rng.j(12);
        x.fillStyle = shade(brick, j / 255);
        x.fillRect(px + off + 1, y + 1, bw - 2, bh - 2);
      }
      x.fillStyle = '#c8b8a8'; // mortar
      x.fillRect(0, y + bh - 1, w, 1);
    }
    // vertical mortar
    x.globalAlpha = 0.35;
    x.fillStyle = '#c8b8a8';
    for (let row = 0, y = 0; y < h; row++, y += bh) {
      const off = row % 2 ? bw / 2 : 0;
      for (let px = -bw; px < w + bw; px += bw) {
        x.fillRect(px + off, y, 1, bh);
      }
    }
    x.globalAlpha = 1;

    const storeH = h * 0.18;
    drawWindows(x, w, h, floors, bays, storeH, rng, { lit, warmth, eraId, style: 'doublehung' });

    if (soot > 0.05) {
      splotches(x, w, h, { count: Math.floor(40 * soot), color: rgba('#1a1208', 0.25 * soot), seed: rng.i(1, 999), yBias: 0.4 });
      drips(x, w, h, { count: Math.floor(25 * soot), y0: storeH, len: 120 * soot, color: rgba('#0a0804', 0.2 * soot), seed: rng.i(1, 999) });
    }
    grain(x, w, h, 10, rng.i(1, 999));
  }, { aniso: 8 });
}

export function glassFacade(seed: string, opts: FacadeOpts = {}): THREE.CanvasTexture {
  const { floors = 12, bays = 6, lit = 0.9, warmth = 0.15, tint = '#3a5a6a', eraId = 'classic' } = opts;
  const key = `glass:${seed}:${floors}:${bays}:${tint}:${eraId}`;
  return tex(key, 512, 1024, (x, w, h) => {
    const rng = new Rng(seed);
    const g = x.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, shade(tint, 0.1));
    g.addColorStop(0.5, tint);
    g.addColorStop(1, shade(tint, -0.08));
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);

    // mullions
    const storeH = h * 0.12;
    const usable = h - storeH;
    const fh = usable / floors;
    const bw = w / bays;

    x.strokeStyle = 'rgba(200,210,220,0.35)';
    x.lineWidth = 2;
    for (let i = 0; i <= bays; i++) {
      x.beginPath(); x.moveTo(i * bw, storeH); x.lineTo(i * bw, h); x.stroke();
    }
    for (let f = 0; f <= floors; f++) {
      x.beginPath(); x.moveTo(0, storeH + f * fh); x.lineTo(w, storeH + f * fh); x.stroke();
    }

    // lit panes
    for (let f = 0; f < floors; f++) {
      for (let b = 0; b < bays; b++) {
        if (rng.next() > lit) continue;
        const px = b * bw + 3;
        const py = storeH + f * fh + 3;
        const warm = warmth > 0
          ? `rgba(255,${Math.floor(200 + warmth * 40)},${Math.floor(120 + (1 - warmth) * 80)},${0.35 + rng.f(0, 0.35)})`
          : `rgba(${Math.floor(120 + rng.f(0, 80))},${Math.floor(200 + rng.f(0, 55))},255,${0.25 + rng.f(0, 0.3)})`;
        x.fillStyle = warm;
        x.fillRect(px, py, bw - 6, fh - 6);
        if (rng.bool(0.35)) {
          x.fillStyle = 'rgba(20,30,40,0.35)';
          x.fillRect(px, py + fh * 0.55, bw - 6, fh * 0.3);
        }
      }
    }

    // sky reflection streaks
    x.globalAlpha = 0.12;
    for (let i = 0; i < 8; i++) {
      const gx = rng.f(0, w);
      const gg = x.createLinearGradient(gx, 0, gx + 40, h);
      gg.addColorStop(0, 'rgba(255,255,255,0)');
      gg.addColorStop(0.4, 'rgba(255,255,255,0.8)');
      gg.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gg;
      x.fillRect(gx, 0, 30, h);
    }
    x.globalAlpha = 1;
  }, { aniso: 8 });
}

export function midcenturyFacade(seed: string, opts: FacadeOpts = {}): THREE.CanvasTexture {
  const { floors = 7, bays = 5, lit = 0.8, warmth = 0.5, eraId = 'classic' } = opts;
  const key = `mcm:${seed}:${floors}:${bays}`;
  return tex(key, 512, 1024, (x, w, h) => {
    const rng = new Rng(seed);
    const panel = rng.pick(['#d8c8b0', '#c0b0a0', '#a8b8c0', '#e0d0c0']);
    x.fillStyle = panel;
    x.fillRect(0, 0, w, h);
    noiseLayer(x, w, h, { cells: 6, octaves: 3, alpha: 0.25, seed: rng.i(1, 999), dark: false });

    // vertical fin accents
    x.fillStyle = shade(panel, -0.15);
    for (let i = 0; i < bays + 1; i++) {
      const px = (i / bays) * w;
      x.fillRect(px - 3, 0, 6, h);
    }

    const storeH = h * 0.16;
    drawWindows(x, w, h, floors, bays, storeH, rng, { lit, warmth, eraId, style: 'ribbon' });

    // colorful spandrel
    x.fillStyle = rng.pick(['#e05030', '#2080a0', '#d0a020', '#4060a0']);
    x.fillRect(0, storeH - 8, w, 8);
    grain(x, w, h, 8, rng.i(1, 999));
  }, { aniso: 8 });
}

export function bioFacade(seed: string, opts: FacadeOpts = {}): THREE.CanvasTexture {
  const { floors = 18, bays = 5, lit = 0.95, eraId = 'classic' } = opts;
  const key = `bio:${seed}:${floors}:${bays}`;
  return tex(key, 512, 1024, (x, w, h) => {
    const rng = new Rng(seed);
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0a2820');
    g.addColorStop(0.5, '#143830');
    g.addColorStop(1, '#0a2018');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);

    // living panels
    splotches(x, w, h, { count: 80, rMin: 6, rMax: 50, color: 'rgba(40,180,90,0.35)', seed: rng.i(1, 999) });
    splotches(x, w, h, { count: 40, rMin: 4, rMax: 25, color: 'rgba(80,255,160,0.2)', seed: rng.i(1, 999) });

    const storeH = h * 0.1;
    drawWindows(x, w, h, floors, bays, storeH, rng, { lit, warmth: -0.2, eraId, style: 'crystal' });

    // biolume veins
    x.strokeStyle = 'rgba(80,255,200,0.35)';
    x.lineWidth = 1.5;
    x.shadowColor = '#40ffc0';
    x.shadowBlur = 8;
    for (let i = 0; i < 12; i++) {
      x.beginPath();
      let px = rng.f(0, w), py = rng.f(0, h);
      x.moveTo(px, py);
      for (let s = 0; s < 6; s++) {
        px += rng.j(60); py += rng.f(20, 80);
        x.lineTo(px, py);
      }
      x.stroke();
    }
    x.shadowBlur = 0;
  }, { aniso: 8 });
}

export interface WindowOpts {
  lit: number;
  warmth: number;
  eraId: string;
  style: 'doublehung' | 'ribbon' | 'crystal';
}

function drawWindows(
  x: CanvasRenderingContext2D, w: number, h: number,
  floors: number, bays: number, storeH: number,
  rng: Rng, opts: WindowOpts,
): void {
  const { lit, warmth, eraId, style } = opts;
  const usable = h - storeH - 8;
  const fh = usable / floors;
  const bw = w / bays;
  const marginX = style === 'ribbon' ? 4 : bw * 0.18;
  const marginY = style === 'ribbon' ? fh * 0.15 : fh * 0.22;

  for (let f = 0; f < floors; f++) {
    for (let b = 0; b < bays; b++) {
      const px = b * bw + marginX;
      const py = storeH + 4 + f * fh + marginY;
      const ww = bw - marginX * 2;
      const wh = fh - marginY * 2;

      // frame
      x.fillStyle = style === 'crystal' ? 'rgba(180,255,220,0.4)' : '#1a1814';
      x.fillRect(px - 2, py - 2, ww + 4, wh + 4);

      const isLit = rng.next() < lit;
      if (isLit) {
        const r = warmth > 0 ? 255 : Math.floor(140 + rng.f(0, 60));
        const g = warmth > 0 ? Math.floor(200 + warmth * 40) : Math.floor(210 + rng.f(0, 40));
        const bch = warmth > 0 ? Math.floor(100 + (1 - warmth) * 100) : 255;
        const a = 0.75 + rng.f(0, 0.25);
        x.fillStyle = `rgba(${r},${g},${bch},${a})`;
      } else {
        x.fillStyle = 'rgba(20,28,40,0.92)';
      }
      x.fillRect(px, py, ww, wh);

      // muntins
      if (style === 'doublehung') {
        x.strokeStyle = 'rgba(30,25,20,0.7)';
        x.lineWidth = 1.5;
        x.beginPath();
        x.moveTo(px + ww / 2, py); x.lineTo(px + ww / 2, py + wh);
        x.moveTo(px, py + wh / 2); x.lineTo(px + ww, py + wh / 2);
        x.stroke();
      }

      // curtain / blind
      if (isLit && rng.bool(0.3)) {
        x.fillStyle = `rgba(${rng.i(40, 100)},${rng.i(30, 80)},${rng.i(20, 60)},0.45)`;
        x.fillRect(px, py, ww, wh * rng.f(0.3, 0.7));
      }
    }
  }
}

export interface ShopDef {
  name: string;
  kind: string;
  color: string;
}

export function storefrontTex(shop: ShopDef, eraId: string, seed: string): THREE.CanvasTexture {
  const key = `shop:${shop.name}:${eraId}:${seed}`;
  return tex(key, 1024, 512, (x, w, h) => {
    const rng = new Rng(seed + shop.name);
    // awning / fascia
    x.fillStyle = shop.color;
    x.fillRect(0, 0, w, h * 0.28);

    // glass
    const glassY = h * 0.28;
    const glassH = h * 0.72;
    const gg = x.createLinearGradient(0, glassY, 0, h);
    gg.addColorStop(0, '#1a2838');
    gg.addColorStop(1, '#0a1218');
    x.fillStyle = gg;
    x.fillRect(0, glassY, w, glassH);

    // mullion
    x.fillStyle = shade(shop.color, -0.3);
    x.fillRect(w * 0.5 - 4, glassY, 8, glassH);
    x.fillRect(0, glassY, w, 6);

    // interior warm glow
    const glow = x.createRadialGradient(w * 0.25, glassY + glassH * 0.5, 10, w * 0.25, glassY + glassH * 0.5, w * 0.3);
    glow.addColorStop(0, 'rgba(255,200,120,0.45)');
    glow.addColorStop(1, 'rgba(255,200,120,0)');
    x.fillStyle = glow;
    x.fillRect(0, glassY, w * 0.48, glassH);

    const glow2 = x.createRadialGradient(w * 0.75, glassY + glassH * 0.45, 10, w * 0.75, glassY + glassH * 0.45, w * 0.28);
    glow2.addColorStop(0, 'rgba(255,180,100,0.35)');
    glow2.addColorStop(1, 'rgba(255,180,100,0)');
    x.fillStyle = glow2;
    x.fillRect(w * 0.52, glassY, w * 0.48, glassH);

    // door
    x.fillStyle = '#1a140e';
    x.fillRect(w * 0.42, glassY + glassH * 0.15, w * 0.16, glassH * 0.85);
    x.fillStyle = 'rgba(180,200,220,0.25)';
    x.fillRect(w * 0.44, glassY + glassH * 0.22, w * 0.12, glassH * 0.45);

    // sign text
    const isNeon = eraId === '1985' || eraId === '2055';
    const isPostwar = eraId === '1945';
    x.fillStyle = isNeon ? '#ffffff' : '#f5f0e6';
    x.font = `bold ${Math.floor(h * 0.12)}px "Barlow Condensed", Impact, sans-serif`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    if (isNeon) {
      x.shadowColor = shop.color;
      x.shadowBlur = 18;
    }
    x.fillText(shop.name, w / 2, h * 0.14);
    x.shadowBlur = 0;

    // kind badge
    x.font = `500 ${Math.floor(h * 0.045)}px "JetBrains Mono", monospace`;
    x.fillStyle = 'rgba(255,255,255,0.55)';
    x.fillText(shop.kind.toUpperCase(), w / 2, h * 0.22);

    // Poster clutter in window (1945 & 1985)
    if (isPostwar || eraId === '1985') {
      for (let i = 0; i < 3; i++) {
        x.fillStyle = rng.pick(['#e04030', '#2080c0', '#e0c020', '#40a060']);
        x.fillRect(rng.f(20, w * 0.35), glassY + rng.f(20, glassH * 0.5), 50, 70);
      }
    }

    // Dirt / age on 1945 storefronts
    if (isPostwar) {
      splotches(x, w, h, { count: 15, color: 'rgba(20,10,5,0.15)', seed: rng.i(1, 999) });
    }

    grain(x, w, h, 6, rng.i(1, 999));
  }, { aniso: 8 });
}

/** Era-specific board tile slab texture */
export function tileSlabTex(eraId: string): THREE.CanvasTexture {
  return tex(`tileSlab:${eraId}`, 512, 512, (x, w, h) => {
    const rng = new Rng(`slab-${eraId}`);

    if (eraId === '1945') {
      // Worn, aged concrete with cracks and stains
      x.fillStyle = '#b0a498';
      x.fillRect(0, 0, w, h);
      noiseLayer(x, w, h, { cells: 10, octaves: 4, alpha: 0.35, seed: rng.i(1, 999), dark: true });
      splotches(x, w, h, { count: 35, color: 'rgba(40,30,20,0.25)', seed: rng.i(1, 999) });
      cracks(x, w, h, { count: 10, seed: rng.i(1, 999), color: 'rgba(0,0,0,0.4)', maxLen: 100 });
      drips(x, w, h, { count: 8, y0: 0, len: 200, color: 'rgba(20,10,5,0.12)', seed: rng.i(1, 999) });
      grain(x, w, h, 14, rng.i(1, 999));
    } else if (eraId === '1985') {
      // Stained concrete with some wear
      x.fillStyle = '#b8a898';
      x.fillRect(0, 0, w, h);
      noiseLayer(x, w, h, { cells: 8, octaves: 3, alpha: 0.28, seed: rng.i(1, 999) });
      splotches(x, w, h, { count: 25, color: 'rgba(30,20,30,0.2)', seed: rng.i(1, 999) });
      cracks(x, w, h, { count: 5, seed: rng.i(1, 999), color: 'rgba(0,0,0,0.25)', maxLen: 70 });
      grain(x, w, h, 8, rng.i(1, 999));
    } else if (eraId === '2055') {
      // Clean living surface with subtle biolume grid
      x.fillStyle = '#b8c8b8';
      x.fillRect(0, 0, w, h);
      noiseLayer(x, w, h, { cells: 6, octaves: 2, alpha: 0.1, seed: rng.i(1, 999), dark: false });
      // Smart grid lines
      x.strokeStyle = 'rgba(60,200,140,0.12)';
      x.lineWidth = 1;
      for (let i = 0; i <= w; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); }
      for (let j = 0; j <= h; j += 32) { x.beginPath(); x.moveTo(0, j); x.lineTo(w, j); x.stroke(); }
      // Biolume specks
      for (let i = 0; i < 30; i++) {
        x.fillStyle = `rgba(80,255,200,${0.03 + rng.f(0, 0.06)})`;
        x.beginPath();
        x.arc(rng.f(0, w), rng.f(0, h), rng.f(2, 15), 0, Math.PI * 2);
        x.fill();
      }
      grain(x, w, h, 4, rng.i(1, 999));
    } else {
      // 2025: clean modern paver
      x.fillStyle = '#d0c8c0';
      x.fillRect(0, 0, w, h);
      // Subtle paver grid
      const cell = 64;
      x.strokeStyle = 'rgba(0,0,0,0.08)';
      x.lineWidth = 2;
      for (let i = 0; i <= w; i += cell) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); }
      for (let j = 0; j <= h; j += cell) { x.beginPath(); x.moveTo(0, j); x.lineTo(w, j); x.stroke(); }
      noiseLayer(x, w, h, { cells: 6, octaves: 2, alpha: 0.12, seed: rng.i(1, 999), dark: false });
      grain(x, w, h, 5, rng.i(1, 999));
    }
  }, { repeat: [2, 2], aniso: 4 });
}

export function roadMarkingsCanvas(w: number, h: number, _eraId: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d')!;
  x.clearRect(0, 0, w, h);

  const alpha = 0.85;

  // center dashed line
  x.strokeStyle = `rgba(240,220,100,${alpha})`;
  x.lineWidth = 4;
  x.setLineDash([28, 22]);
  x.beginPath();
  x.moveTo(w / 2, 0);
  x.lineTo(w / 2, h);
  x.stroke();
  x.setLineDash([]);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
