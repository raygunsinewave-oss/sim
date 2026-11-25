// Shared helpers for DJSIM
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Deterministic RNG (mulberry32)
export function makeRng(seed) {
  let s = seed >>> 0;
  const rng = () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (a, b) => a + (b - a) * rng();
  rng.int = (a, b) => Math.floor(a + (b - a + 1) * rng());
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.chance = (p) => rng() < p;
  rng.gauss = () => { let u = 0, v = 0; while (u === 0) u = rng(); while (v === 0) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
  rng.weighted = (obj) => {
    let total = 0; for (const k in obj) total += obj[k];
    let r = rng() * total;
    for (const k in obj) { r -= obj[k]; if (r <= 0) return k; }
    return Object.keys(obj)[0];
  };
  return rng;
}

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function normalizeTitle(s) {
  return (s || '')
    .toLowerCase()
    .replace(/\.(mp3|wav|flac|m4a|aac|ogg|aiff?)$/i, '')
    .replace(/\((feat|ft)\.?[^)]*\)/g, ' ')
    .replace(/\b(feat|ft)\.?\s.*$/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[^a-z0-9À-ɏ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatClock(minutes) {
  const h = Math.floor(minutes / 60) % 24, m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Event bus
export class Emitter {
  constructor() { this._h = {}; }
  on(ev, fn) { (this._h[ev] ||= []).push(fn); return () => this.off(ev, fn); }
  off(ev, fn) { const a = this._h[ev]; if (a) this._h[ev] = a.filter((f) => f !== fn); }
  emit(ev, ...args) { const a = this._h[ev]; if (a) for (const f of a.slice()) f(...args); }
}
