// Peçete deseni: tek kaynak. Aynı ölçüler GLSL'e yazılır (bant, klişe silindiri, peçeteler) ve buradan
// mürekkep kaplama oranı hesaplanır (panellerdeki g/dk değerleri).
// Koordinatlar: u = ön kenardan geriye (0..L), v = bant enine (0..L), metre.
import {L} from './kin.js';

export const INK = {
  1: {name: 'KIRMIZI', hex: '#c8102e', pantone: 'P 186 C'},
  2: {name: 'LACİVERT', hex: '#1d3557', pantone: 'P 2767 C'},
};
// 1/8 katlamanın 8 panelinin her birine aynı motif
export const D = {
  frame: [0.008, 0.0125], // renk 1: kenar çerçevesi (içe mesafe)
  ring: [0.0165, 0.0215], // renk 2: halka yarıçapları
  dot: 0.0032, // renk 2: halka üzerinde 4 nokta
  dotR: 0.0265,
  diamond: 0.0085, // renk 1: merkezde baklava
};
const f = (x) => x.toFixed(5);

export const GLSL = /* glsl */ `
const float NL = ${f(L)};
float aaBand(float d, float w){ return 1.0 - smoothstep(-w, w, d); }
// kaplama: x = renk 1, y = renk 2 (renk 2 register kayması uygulanmış koordinatta)
float ink1(vec2 uv, float aw){
  vec2 e = min(uv, vec2(NL) - uv);
  float m = min(e.x, e.y);
  float fr = aaBand(abs(m - ${f((D.frame[0] + D.frame[1]) / 2)}) - ${f((D.frame[1] - D.frame[0]) / 2)}, aw);
  vec2 c = vec2(NL * 0.25, NL * 0.125) + floor(uv / vec2(NL * 0.5, NL * 0.25)) * vec2(NL * 0.5, NL * 0.25);
  vec2 q = abs(uv - c);
  float di = aaBand(q.x + q.y - ${f(D.diamond)}, aw);
  return max(fr, di);
}
float ink2(vec2 uv, float aw){
  uv = mod(uv, vec2(NL));
  vec2 c = vec2(NL * 0.25, NL * 0.125) + floor(uv / vec2(NL * 0.5, NL * 0.25)) * vec2(NL * 0.5, NL * 0.25);
  vec2 q = uv - c;
  float r = length(q);
  float ri = aaBand(abs(r - ${f((D.ring[0] + D.ring[1]) / 2)}) - ${f((D.ring[1] - D.ring[0]) / 2)}, aw);
  vec2 a = abs(q);
  float dd = min(length(a - vec2(${f(D.dotR)}, 0.0)), length(a - vec2(0.0, ${f(D.dotR)})));
  float dt = aaBand(dd - ${f(D.dot)}, aw);
  return max(ri, dt);
}
`;

// JS ikizi: kaplama oranı (keskin kenar)
const ink1 = (u, v) => {
  const m = Math.min(u, v, L - u, L - v);
  if (m >= D.frame[0] && m <= D.frame[1]) return 1;
  const cu = L * 0.25 + Math.floor(u / (L * 0.5)) * L * 0.5;
  const cv = L * 0.125 + Math.floor(v / (L * 0.25)) * L * 0.25;
  return Math.abs(u - cu) + Math.abs(v - cv) <= D.diamond ? 1 : 0;
};
const ink2 = (u, v) => {
  const cu = L * 0.25 + Math.floor(u / (L * 0.5)) * L * 0.5;
  const cv = L * 0.125 + Math.floor(v / (L * 0.25)) * L * 0.25;
  const r = Math.hypot(u - cu, v - cv);
  if (r >= D.ring[0] && r <= D.ring[1]) return 1;
  const a = Math.abs(u - cu);
  const b = Math.abs(v - cv);
  return Math.min(Math.hypot(a - D.dotR, b), Math.hypot(a, b - D.dotR)) <= D.dot ? 1 : 0;
};
const N = 400;
let c1 = 0;
let c2 = 0;
for (let i = 0; i < N; i++)
  for (let j = 0; j < N; j++) {
    const u = ((i + 0.5) / N) * L;
    const v = ((j + 0.5) / N) * L;
    c1 += ink1(u, v);
    c2 += ink2(u, v);
  }
export const COVERAGE = {1: c1 / (N * N), 2: c2 / (N * N)};
