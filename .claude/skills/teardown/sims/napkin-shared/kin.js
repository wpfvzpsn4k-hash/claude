// Peçete makinesinin matematiği: gerçek ölçüler metre cinsinden, tek girdi ana mil açısı φ (radyan).
// Bir mil turu = bir peçete: kesici bıçak merdanesi ve klişe silindirleri tek turda 330 mm kağıt geçirir.
// three.js yok; her poz ve her gösterge buradaki fonksiyonlardan okunur.

export const L = 0.33; // peçete boyu = bant eni = 330 mm
export const PLY = 2; // 2 kat kağıt (iki ana bobin)
export const CALIPER = 0.0001; // kağıt kalınlığı, kat başına 0,10 mm
export const GSM = 17; // g/m² kat başına
export const R_CORE = 0.038; // 76 mm (3") mandrel
export const R_FULL = 0.5; // 1000 mm tam bobin
export const WEB_Y = 1.1; // baskı hattı yüksekliği
export const PLATE_R = L / (2 * Math.PI); // 52,52 mm → çevre 330 mm
export const KNIFE_R = PLATE_R;
export const PACK = 100; // paket başına peçete
export const NAP_T = 8 * PLY * CALIPER; // katlı peçete kalınlığı: 8 tabaka × 2 kat (istifte sıkışık)
export const ANILOX = 8; // cm³/m² hücre hacmi
export const TRANSFER = 0.3; // aniloksdan kağıda geçen oran (klişe üzerinden)

// ------------------------------------------------------------ kağıt yolu (merdaneler, x-y düzleminde)
// s = +1: merdane bantın solunda (bant saat yönü tersine sarılır), -1: sağında (altında)
export const ROLLS = {
  P1: {x: 0.62, y: 0.8, s: -1},
  P2: {x: 1.72, y: 0.8, s: -1},
  M: {x: 2.45, y: 1.6, r: 0.05, s: -1}, // birleştirme merdanesi
  E2: {x: 3.0, y: WEB_Y - 0.08, r: 0.08, s: -1}, // kauçuk kabartma karşı merdanesi
  G1: {x: 3.45, y: WEB_Y - 0.04, r: 0.04, s: -1},
  I1: {x: 3.95, y: WEB_Y - 0.06, r: 0.06, s: -1}, // baskı 1 çelik baskı merdanesi
  I2: {x: 4.75, y: WEB_Y - 0.06, r: 0.06, s: -1}, // baskı 2
  F0: {x: 5.3, y: WEB_Y - 0.04, r: 0.04, s: -1},
};
export const STATION = {
  emboss: 3.0,
  print1: 3.95,
  print2: 4.75,
  fold1: [5.42, 6.02],
  fold2: [6.12, 6.72],
  cut: 6.95,
  stop: 7.7, // çapraz katlamada ön kenarın durduğu yer
  stackTop: 0.82,
  conveyor: 0.66,
};
export const UPPER = {
  E1: {x: 3.0, y: WEB_Y + 0.09, r: 0.09}, // çelik desen merdanesi
  PL1: {x: 3.95, y: WEB_Y + PLATE_R, r: PLATE_R}, // klişe silindiri
  PL2: {x: 4.75, y: WEB_Y + PLATE_R, r: PLATE_R},
  K: {x: STATION.cut, y: WEB_Y + KNIFE_R, r: KNIFE_R}, // bıçak merdanesi
};
export const ANIL_R = 0.045;
export const aniloxOf = (pl) => {
  const a = (125 * Math.PI) / 180;
  const d = pl.r + ANIL_R;
  return {x: pl.x + d * Math.cos(a), y: pl.y + d * Math.sin(a), r: ANIL_R};
};

// bobin yarıçapı, tüketilen F metreye göre: π(R0² − R²) = F·t
export const rollR = (R0, F) => Math.sqrt(Math.max(R_CORE * R_CORE, R0 * R0 - (F * CALIPER) / Math.PI));
// bobin dönüş açısı = ∫ dF / R  (kapalı biçim)
export const rollAngle = (R0, F) => ((2 * Math.PI) / CALIPER) * (R0 - rollR(R0, F));
export const rollMeters = (R) => (Math.PI * (R * R - R_CORE * R_CORE)) / CALIPER;

// iki çember arası teğet: d doğrultusu; T = C − s·r·sol(d)
const tangent = (a, b) => {
  const Dx = b.x - a.x;
  const Dy = b.y - a.y;
  const k = b.s * b.r - a.s * a.r;
  const lam = Math.sqrt(Math.max(1e-9, Dx * Dx + Dy * Dy - k * k));
  const th = Math.atan2(Dy, Dx) - Math.atan2(k, lam);
  const dx = Math.cos(th);
  const dy = Math.sin(th);
  const t1 = {x: a.x + a.s * a.r * dy, y: a.y - a.s * a.r * dx};
  const t2 = {x: b.x + b.s * b.r * dy, y: b.y - b.s * b.r * dx};
  return [t1, t2];
};

// çember dizisinden örneklenmiş yol: [{x, y, tx, ty}], başta ve sonda düz
export function webPath(circles, step = 0.01) {
  const pts = [];
  const line = (p, q) => {
    const n = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / step));
    for (let i = pts.length ? 1 : 0; i <= n; i++) pts.push({x: p.x + ((q.x - p.x) * i) / n, y: p.y + ((q.y - p.y) * i) / n});
  };
  const arc = (c, p, q) => {
    if (!c.r) return;
    const a0 = Math.atan2(p.y - c.y, p.x - c.x);
    let a1 = Math.atan2(q.y - c.y, q.x - c.x);
    let da = (a1 - a0) * c.s;
    da = ((da % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    if (da > 1.9 * Math.PI) da = 0;
    const n = Math.max(1, Math.ceil((da * c.r) / (step * 0.5)));
    for (let i = 1; i <= n; i++) {
      const a = a0 + c.s * (da * i) / n;
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
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    pts[i].p = s;
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    pts[i].tx = (b.x - a.x) / l;
    pts[i].ty = (b.y - a.y) / l;
  }
  return pts;
}

const R = (k, r) => ({...ROLLS[k], r: r ?? ROLLS[k].r});
// ana bant: birleştirme merdanesinin tepesinden (p = 0) kesiciye
export function mainPath() {
  const M = R('M');
  const startPt = {x: M.x - 0.3, y: M.y + M.r, r: 0, s: -1};
  const end = {x: STATION.cut, y: WEB_Y, r: 0, s: -1};
  const pts = webPath([startPt, M, R('E2'), R('G1'), R('I1'), R('I2'), R('F0'), end]);
  const out = pts.slice(pts.findIndex((q) => q.x >= M.x - 1e-6));
  const p0 = out[0].p;
  for (const q of out) q.p -= p0;
  return out;
}
// kat kağıdı: bobinden birleştirme merdanesinin tepesine; p değerleri ana yolla süreklidir (tepede 0)
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

// yol üzerinde x'e en yakın düz noktanın p değeri (baskı merdanesinin tepe noktası)
export const pAtX = (pts, x) => {
  let best = pts[0];
  for (const q of pts) if (Math.abs(q.y - WEB_Y) < 1e-3 && Math.abs(q.x - x) < Math.abs(best.x - x)) best = q;
  return best.p + (x - best.x);
};

// ------------------------------------------------------------ katlama
// enine kesit: düz bant koordinatı w (−L/2..L/2) → (y' enine, h düşey) iki boyuna katlamadan sonra.
// a1: w>0 yarısı aşağıya, altına katlanır (eksen w=0); a2: w<−L/4 kısmı aşağıya katlanır (eksen w=−L/4).
export const EPS = 0.0012; // çizim için tabaka aralığı
export function foldCross(w, a1, a2) {
  let y;
  let h;
  if (a2 <= 0) {
    if (w > 0) {
      y = w * Math.cos(a1);
      h = -w * Math.sin(a1) - (EPS * a1) / Math.PI;
    } else {
      y = w;
      h = 0;
    }
    return [y, h];
  }
  const w1 = -Math.abs(w);
  const h1 = w > 0 ? -EPS : 0;
  const ax = -L / 4;
  if (w1 >= ax) return [w1, h1];
  const d = w1 - ax;
  y = ax + d * Math.cos(a2) - h1 * Math.sin(a2);
  h = d * Math.sin(a2) + h1 * Math.cos(a2) - (3 * EPS * a2) / Math.PI;
  return [y, h];
}
const sm = (a, b, x) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};
export const foldAngles = (x) => [Math.PI * sm(STATION.fold1[0], STATION.fold1[1], x), Math.PI * sm(STATION.fold2[0], STATION.fold2[1], x)];

// ------------------------------------------------------------ kesilmiş peçeteler
// j. peçete F = j·L anında kesilir; ρ = F/L − j (o andan beri geçen tur)
const ease = (u) => {
  const k = Math.min(1, Math.max(0, u));
  return k * k * (3 - 2 * k);
};
export const DROP_END = 1.6;
export function pieceAt(rho) {
  const xc = STATION.cut;
  let xLead;
  if (rho <= 0.5) xLead = xc + L + L * (rho + rho * rho); // hızlandırma bandı: 2× hıza çıkıp ara açar
  else {
    const x05 = xc + L + 0.75 * L;
    const u = Math.min(1, (rho - 0.5) / 0.25);
    xLead = x05 + (STATION.stop - x05) * (1 - (1 - u) * (1 - u));
  }
  const a3 = Math.PI * ease((rho - 0.75) / 0.45); // çapraz katlama: arka yarı alta
  const drop = ease((rho - 1.22) / (DROP_END - 1.22)); // istif üstüne iniş
  return {xLead, a3, drop};
}

// ------------------------------------------------------------ makine durumu (φ'den)
export function machineAt(phi, {rpm, R1, R2}) {
  const turns = phi / (2 * Math.PI);
  const F = turns * L;
  const v = (rpm * L) / 60; // m/s
  const r1 = rollR(R1, F);
  const r2 = rollR(R2, F);
  const done = Math.max(0, Math.floor(turns - DROP_END)); // istife inen
  const inStack = done % PACK;
  return {
    phi,
    F,
    turns,
    rpm,
    v,
    webMin: v * 60,
    r1,
    r2,
    a1: rollAngle(R1, F),
    a2: rollAngle(R2, F),
    rollRpm: (v * 60) / (2 * Math.PI * Math.min(r1, r2)),
    meters: Math.min(rollMeters(r1), rollMeters(r2)),
    minutesLeft: Math.min(rollMeters(r1), rollMeters(r2)) / Math.max(1e-6, v * 60),
    cut: Math.floor(turns),
    done,
    inStack,
    packs: Math.floor(done / PACK),
    kgH: (v * 3600 * L * GSM * PLY) / 1000, // kg/saat kağıt
  };
}
