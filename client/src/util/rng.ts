/* Deterministic pseudo-random helpers — ported from opus5.
   Seeded RNG ensures identical city generation for a given seed. */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Random source with convenience methods, seeded from a string or number. */
export class Rng {
  next: () => number;

  constructor(seed: string | number) {
    this.next = mulberry32(typeof seed === 'string' ? hashStr(seed) : seed);
  }

  /** Float in [min, max) */
  f(min = 0, max = 1): number { return min + this.next() * (max - min); }

  /** Integer in [min, max] */
  i(min: number, max: number): number { return Math.floor(this.f(min, max + 1)); }

  /** Boolean with probability p */
  bool(p = 0.5): boolean { return this.next() < p; }

  /** Pick a random element from an array */
  pick<T>(arr: T[]): T { return arr[Math.floor(this.next() * arr.length)]; }

  /** Signed jitter around 0 */
  j(amount: number): number { return (this.next() * 2 - 1) * amount; }

  /** Weighted pick from [{w, ...}] or from items with optional weightOf */
  weighted<T>(items: T[], weightOf: (o: T) => number = (_o: T) => 1): T {
    let total = 0;
    for (const it of items) total += weightOf(it);
    let r = this.next() * total;
    for (const it of items) { r -= weightOf(it); if (r <= 0) return it; }
    return items[items.length - 1];
  }

  shuffle<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

export const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smoothstep = (t: number): number => t * t * (3 - 2 * t);
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
export const TAU = Math.PI * 2;
