// Tuvalet kağıdı sarma hattının (rewinder) matematiği: 1550 mm çalışma eni. Tek girdi: hatta beslenen kağıt F (metre).
// Jumbo açıcı → kabartma → perforasyon → 3 merdaneli yüzey sarıcı (log) → kuyruk yapıştırma → logsaw'a çıkış.
// three.js yok; her poz ve gösterge buradan okunur.

export const WIDTH = 1.55; // çalışma eni
export const PLY = 2;
export const GSM = 17; // kat başına g/m²
export const J_CAL = 0.0001; // jumbo kat kalınlığı 0,10 mm
export const J_CORE = 0.038; // 3" jumbo mandreli
export const J_MAX = 0.75; // Ø 1500 jumbo
export const L_CAL = 0.00032; // logda 2 kat kabartmalı sarım kalınlığı 0,32 mm
export const CORE_R = 0.021; // Ø 42 masura
export const SHEET = 0.11; // yaprak 110 mm
export const PERF_N = 5; // perforasyon silindirinde 5 bıçak
export const PERF_R = (PERF_N * SHEET) / (2 * Math.PI); // çevre = 5 yaprak → Ø 175 mm
export const ROLL_W = 0.1; // logsaw'da rulo eni 100 mm
export const WEB_Y = 1.3;

export const ROLLS = {
  J1: {x: 0.9, y: 0.85, s: -1},
  J2: {x: 2.65, y: 0.85, s: -1},
  M: {x: 3.75, y: 1.95, r: 0.06, s: -1},
  E2: {x: 4.4, y: WEB_Y - 0.1, r: 0.1, s: -1}, // kauçuk kabartma merdanesi
  G2: {x: 4.95, y: WEB_Y - 0.05, r: 0.05, s: -1},
  G3: {x: 5.9, y: WEB_Y - 0.05, r: 0.05, s: -1},
  W1: {x: 6.4, y: 1.15, r: 0.12, s: -1}, // alt sarma merdaneleri
  W2: {x: 6.66, y: 1.15, r: 0.12, s: -1},
};
export const UPPER = {
  E1: {x: 4.4, y: WEB_Y + 0.14, r: 0.14}, // çelik desen merdanesi Ø 280
  PF: {x: 5.4, y: WEB_Y + PERF_R, r: PERF_R}, // perforasyon silindiri
};
export const RIDER_R = 0.05;
export const SEALER = {x: 7.62, y: 0.98}; // kuyruk yapıştırma: log iki makaranın üstünde
export const ACC = {x0: 8.0, x1: 10.1, y: 0.9}; // çıkış (akümülatör) bandı
export const ROLLS_PER_LOG = Math.floor(WIDTH / ROLL_W);
export const TRIM = (WIDTH - ROLLS_PER_LOG * ROLL_W) / 2;

// jumbo yarıçapı ve açısı (beslenen F metreye göre; iki kat aynı anda)
export const jumboR = (R0, F) => Math.sqrt(Math.max(J_CORE * J_CORE, R0 * R0 - (F * J_CAL) / Math.PI));
export const jumboAngle = (R0, F) => ((2 * Math.PI) / J_CAL) * (R0 - jumboR(R0, F));
export const jumboMeters = (R) => (Math.PI * (R * R - J_CORE * J_CORE)) / J_CAL;
// log yarıçapı: sarılan L metreye göre
export const logR = (L) => Math.sqrt(CORE_R * CORE_R + (L * L_CAL) / Math.PI);
export const logAngle = (L) => ((2 * Math.PI) / L_CAL) * (logR(L) - CORE_R);

// ------------------------------------------------------------ kağıt yolu (napkin ile aynı teğet çözücü)
const tangent = (a, b) => {
  const Dx = b.x - a.x;
  const Dy = b.y - a.y;
  const k = b.s * b.r - a.s * a.r;
  const lam = Math.sqrt(Math.max(1e-9, Dx * Dx + Dy * Dy - k * k));
  const th = Math.atan2(Dy, Dx) - Math.atan2(k, lam);
  const dx = Math.cos(th);
  const dy = Math.sin(th);
  return [
    {x: a.x + a.s * a.r * dy, y: a.y - a.s * a.r * dx},
    {x: b.x + b.s * b.r * dy, y: b.y - b.s * b.r * dx},
  ];
};
export function webPath(circles, step = 0.01) {
  const pts = [];
  const line = (p, q) => {
    const n = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / step));
    for (let i = pts.length ? 1 : 0; i <= n; i++) pts.push({x: p.x + ((q.x - p.x) * i) / n, y: p.y + ((q.y - p.y) * i) / n});
  };
  const arc = (c, p, q) => {
    if (!c.r) return;
    const a0 = Math.atan2(p.y - c.y, p.x - c.x);
    const a1 = Math.atan2(q.y - c.y, q.x - c.x);
    let da = (a1 - a0) * c.s;
    da = ((da % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    if (da > 1.9 * Math.PI) da = 0;
    const n = Math.max(1, Math.ceil((da * c.r) / (step * 0.5)));
    for (let i = 1; i <= n; i++) {
      const a = a0 + (c.s * (da * i)) / n;
      pts.push({x: c.x + c.r * Math.cos(a), y: c.y + c.r * Math.sin(a)});
    }
  };
  let prev = null;
  for (let i = 0; i < circles.length - 1; i++) {
    const [t1, t2] = tangent(circles[i], circles[i + 1]);
    if (prev) arc(circles[i], prev, t1);
    line(pts.length ? pts[pts.length - 1] : t1, t2);
    prev = t2;
  }
  finish(pts);
  return pts;
}
function finish(pts, p0 = 0) {
  let s = p0;
  for (let i = 0; i < pts.length; i++) {
    if (i) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    pts[i].p = s;
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    pts[i].tx = (b.x - a.x) / l;
    pts[i].ty = (b.y - a.y) / l;
  }
}
const R = (k, r) => ({...ROLLS[k], r: r ?? ROLLS[k].r});
// ana bant: birleştirme merdanesinin tepesinden (p = 0) alt sarma merdanesi W1'e girişe
export function mainPath() {
  const M = R('M');
  const pts = webPath([{x: M.x - 0.3, y: M.y + M.r, r: 0, s: -1}, M, R('E2'), R('G2'), R('G3'), R('W1'), {x: 9, y: ROLLS.W1.y + 2, r: 0, s: -1}]);
  const i0 = pts.findIndex((q) => q.x >= M.x - 1e-6);
  // W1 çemberine ilk değen nokta
  const W = ROLLS.W1;
  const i1 = pts.findIndex((q, i) => i > i0 && Math.abs(Math.hypot(q.x - W.x, q.y - W.y) - W.r) < 1e-4);
  const out = pts.slice(i0, i1 + 1);
  const p0 = out[0].p;
  for (const q of out) q.p -= p0;
  return out;
}
// W1 üstündeki yay: giriş noktasından loga değme noktasına (log büyüdükçe değişir)
export function wrapArc(entry, logC, n = 24) {
  const W = ROLLS.W1;
  const a0 = Math.atan2(entry.y - W.y, entry.x - W.x);
  const a1 = Math.atan2(logC.y - W.y, logC.x - W.x);
  let da = a0 - a1; // saat yönünde
  da = ((da % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 - (da * i) / n;
    pts.push({x: W.x + W.r * Math.cos(a), y: W.y + W.r * Math.sin(a)});
  }
  finish(pts, entry.p);
  return pts;
}
export function plyPath(key, Rnow, dr = 0) {
  const M = R('M', ROLLS.M.r + dr);
  const pts = webPath([R(key, Rnow), M, {x: M.x + 0.3, y: M.y + M.r, r: 0, s: -1}]);
  let i1 = pts.length - 1;
  while (i1 > 0 && pts[i1].x > M.x + 1e-6) i1--;
  const out = pts.slice(0, i1 + 1);
  const pe = out[out.length - 1].p;
  for (const q of out) q.p -= pe;
  return out;
}
export const pAtX = (pts, x) => {
  let best = pts[0];
  for (const q of pts) if (Math.abs(q.y - WEB_Y) < 2e-3 && Math.abs(q.x - x) < Math.abs(best.x - x)) best = q;
  return best.p + (x - best.x);
};

// ------------------------------------------------------------ sarma beşiği
// log iki alt merdanenin vadisinde: merkez her iki merdaneden R + r uzakta
export function cradle(Rl) {
  const a = ROLLS.W1;
  const b = ROLLS.W2;
  const half = (b.x - a.x) / 2;
  const d = Rl + a.r;
  return {x: (a.x + b.x) / 2, y: a.y + Math.sqrt(Math.max(0, d * d - half * half))};
}
const sm = (u) => {
  const k = Math.min(1, Math.max(0, u));
  return k * k * (3 - 2 * k);
};
const lerp = (a, b, k) => a + (b - a) * k;
// masura besleme: oluktan beşiğe; logun ilk %5'inde
export const CHUTE = {x: 6.1, y: 1.62};
export const CORE_IN = 0.05;
// sarılmış log j'nin sarıcıdan sonraki yolculuğu; q = (F − bitiş) / Llog
export const POST = {roll: 0.06, slide: 0.12, seal0: 0.16, seal1: 0.5, out: 0.56};
export function postLog(q, Rl) {
  const c0 = cradle(Rl);
  // sarıcıdan W2 üstünden yuvarlanır, rampadan yapıştırıcıya iner
  const top = {x: ROLLS.W2.x + 0.14, y: ROLLS.W2.y + ROLLS.W2.r + Rl - 0.02};
  const seal = {x: SEALER.x, y: SEALER.y + 0.05 + Rl - 0.02};
  let x;
  let y;
  if (q < POST.roll) {
    const k = sm(q / POST.roll);
    x = lerp(c0.x, top.x, k);
    y = lerp(c0.y, top.y, k) + 0.04 * Math.sin(Math.PI * k);
  } else if (q < POST.slide) {
    const k = sm((q - POST.roll) / (POST.slide - POST.roll));
    x = lerp(top.x, seal.x, k);
    y = lerp(top.y, seal.y, k);
  } else if (q < POST.out) {
    x = seal.x;
    y = seal.y;
  } else {
    // çıkış bandına iner ve +x yönünde akar
    const k = sm((q - POST.out) / 0.06);
    const base = {x: ACC.x0 + 0.15, y: ACC.y + Rl};
    x = lerp(seal.x, base.x, k) + Math.max(0, q - POST.out - 0.06) * 2.6;
    y = lerp(seal.y, base.y, k);
  }
  // kuyruk: yapıştırıcıda açılır (sarkar), tutkal sürülür, geri sarılır
  let tail = 0;
  if (q > POST.seal0 && q < POST.seal1) {
    const u = (q - POST.seal0) / (POST.seal1 - POST.seal0);
    tail = u < 0.35 ? sm(u / 0.35) : u < 0.6 ? 1 : 1 - sm((u - 0.6) / 0.4);
  }
  const glue = q > POST.seal0 + 0.12 && q < POST.seal1 ? 1 : 0;
  return {x, y, tail, glue, done: x > ACC.x1 + 0.3};
}

// ------------------------------------------------------------ durum
export function lineAt(F, {mpm, Llog, J0}) {
  const j = Math.floor(F / Llog);
  const Lw = F - j * Llog;
  const u = Lw / Llog;
  const Rl = logR(Lw);
  const v = mpm / 60;
  const jr = jumboR(J0, F);
  const rollsPerMin = (mpm / Llog) * ROLLS_PER_LOG;
  return {
    F,
    j,
    Lw,
    u,
    Rl,
    Rfull: logR(Llog),
    mpm,
    v,
    Llog,
    logsMin: mpm / Llog,
    rollsMin: rollsPerMin,
    rollsHour: rollsPerMin * 60,
    sheets: Math.floor(Llog / SHEET),
    kgH: (mpm * 60 * WIDTH * GSM * PLY) / 1000,
    jR: jr,
    jA: jumboAngle(J0, F),
    jRpm: mpm / (2 * Math.PI * jr),
    jMeters: jumboMeters(jr),
    jMin: jumboMeters(jr) / Math.max(1e-6, mpm),
    perfRpm: mpm / (2 * Math.PI * PERF_R),
    embossRpm: mpm / (2 * Math.PI * UPPER.E1.r),
    logRpm: mpm / (2 * Math.PI * Rl),
    logTime: (Llog / Math.max(1e-6, mpm)) * 60,
    rollD: 2 * logR(Llog),
    rollKg: (Llog * ROLL_W * GSM * PLY) / 1000,
  };
}
