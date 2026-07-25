/* Billboard & sign textures — ported from opus5. */

import { tex, grain, rgba } from '../util/canvas';
import { Rng } from '../util/rng';

export interface AdDef {
  text: string;
  sub: string;
  style: string;
  color: string;
}

export function billboardTex(ad: AdDef, eraId: string, seed: string): ReturnType<typeof tex> {
  const key = `ad:${ad.text}:${eraId}:${seed}`;
  return tex(key, 1024, 512, (x, w, h) => {
    const rng = new Rng(seed + ad.text);
    const style = ad.style;

    if (style === 'neon' || style === 'holo') {
      x.fillStyle = '#0a0a10';
      x.fillRect(0, 0, w, h);
      // dark frame
      x.strokeStyle = rgba(ad.color, 0.5);
      x.lineWidth = 8;
      x.strokeRect(12, 12, w - 24, h - 24);

      x.font = `700 ${Math.floor(h * 0.28)}px "Barlow Condensed", Impact, sans-serif`;
      // glow text via shadow
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.shadowColor = ad.color;
      x.shadowBlur = style === 'holo' ? 40 : 28;
      for (let i = 3; i > 0; i--) {
        x.shadowBlur = (style === 'holo' ? 40 : 28) * (i / 3);
        x.fillStyle = '#ffffff';
        x.fillText(ad.text, w / 2, h * 0.42);
      }
      x.shadowBlur = 0;

      x.font = `500 ${Math.floor(h * 0.08)}px "JetBrains Mono", monospace`;
      x.shadowColor = ad.color;
      x.shadowBlur = 16;
      x.fillStyle = rgba(ad.color, 0.95);
      x.fillText(ad.sub, w / 2, h * 0.68);
      x.shadowBlur = 0;

      if (style === 'holo') {
        x.fillStyle = 'rgba(80,255,220,0.06)';
        for (let y = 0; y < h; y += 4) x.fillRect(0, y, w, 1);
      }
    } else if (style === 'led' || style === 'oled' || style === 'backlit') {
      x.fillStyle = style === 'oled' ? '#050508' : ad.color;
      x.fillRect(0, 0, w, h);
      if (style === 'led') {
        x.fillStyle = 'rgba(0,0,0,0.15)';
        for (let i = 0; i < w; i += 4) x.fillRect(i, 0, 1, h);
        for (let j = 0; j < h; j += 4) x.fillRect(0, j, w, 1);
      }
      x.fillStyle = '#ffffff';
      x.font = `700 ${Math.floor(h * 0.26)}px "Barlow Condensed", sans-serif`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      if (style !== 'backlit') {
        x.shadowColor = ad.color;
        x.shadowBlur = 20;
      }
      x.fillText(ad.text, w / 2, h * 0.4);
      x.shadowBlur = 0;
      x.font = `400 ${Math.floor(h * 0.075)}px "Inter", sans-serif`;
      x.fillStyle = 'rgba(255,255,255,0.7)';
      x.fillText(ad.sub, w / 2, h * 0.68);
    } else {
      // painted / poster
      x.fillStyle = ad.color;
      x.fillRect(0, 0, w, h);
      // border
      x.strokeStyle = 'rgba(255,255,255,0.25)';
      x.lineWidth = 10;
      x.strokeRect(16, 16, w - 32, h - 32);

      x.fillStyle = '#f5f0e0';
      x.font = `700 ${Math.floor(h * 0.24)}px "Barlow Condensed", Impact, sans-serif`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(ad.text, w / 2, h * 0.4);
      x.font = `500 ${Math.floor(h * 0.07)}px "JetBrains Mono", monospace`;
      x.fillStyle = 'rgba(255,240,220,0.8)';
      x.fillText(ad.sub, w / 2, h * 0.68);

      // weathering
      grain(x, w, h, 14, rng.i(1, 999));
      x.fillStyle = 'rgba(0,0,0,0.12)';
      for (let i = 0; i < 20; i++) {
        x.fillRect(rng.f(0, w), rng.f(0, h), rng.f(20, 80), rng.f(2, 8));
      }
    }
  }, { aniso: 4 });
}
