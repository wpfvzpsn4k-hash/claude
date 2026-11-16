// Orbital log kesme makinesinin (logsaw) matematiği. Tek girdi: kafa yörünge açısı θ (radyan).
// Her yörünge turu = bir kesim. Tur içinde ψ = θ mod 2π; ψ = 0'da bıçak merkezi tam aşağıda (kesimin ortası).
// three.js yok; her poz ve gösterge buradan okunur. Birimler metre.

export const LOG_D = 0.2; // log çapı 200 mm
export const LOG_R = LOG_D / 2;
export const LOG_L = 1.7; // log boyu 1700 mm
export const CORE_R = 0.02; // 40 mm karton masura
export const LOG_Y = 0.95; // log ekseni yüksekliği
export const MIN_TRIM = 0.015; // uç başına en az 15 mm fire

// orbital kafa: bıçak merkezi H ekseni etrafında e yarıçapında döner, bıçak kendi ekseninde ayrıca döner
export const H = {y: LOG_Y + 0.38, z: 0}; // kafa ekseni log ekseninin 380 mm üstünde
export const ORBIT_E = 0.2; // eksantrik 200 mm
export const BLADE_R0 = 0.31; // yeni bıçak Ø 620 mm
export const BLADE_RMIN = 0.28; // Ø 560 altında log tam kesilemez: D + r ≤ e + R
export const BLADE_T = 0.004;
export const BLADE_RPM = 1500;
export const GRIND_EVERY = 40; // her 40 kesimde bir bileme
export const GRIND_WEAR = 0.00002; // bileme başına yarıçaptan 0,02 mm
export const SHEET = 0.25; // yaprak boyu (delik aralığı) 250 mm
export const CALIPER = 0.00035; // sarılı 2 kat havlu, kat başına (sarım) 0,35 mm
export const GSM = 2 * 20; // 2 kat × 20 g/m²

const D = H.y - LOG_Y;
// bıçak kenarı log kesitine girdiği yarı açı: |C − log| = R + r
export const engageHalf = (R) => Math.acos(Math.min(1, (D * D + ORBIT_E * ORBIT_E - (R + LOG_R) ** 2) / (2 * D * ORBIT_E)));
export const FEED = [(150 * Math.PI) / 180, (270 * Math.PI) / 180]; // besleme penceresi (bıçak logdan uzakta)
export const RELEASE = engageHalf(BLADE_R0); // kesimin bittiği ψ

// kesim planı: n rulo, iki uçta eşit fire
export function plan(Lr) {
  const n = Math.max(1, Math.floor((LOG_L - 2 * MIN_TRIM) / Lr));
  const trim = (LOG_L - n * Lr) / 2;
  return {Lr, n, trim, cuts: n + 1, waste: (2 * trim) / LOG_L};
}
// k. kesimin malzeme konumu (m = 0 ilk logun ön ucu, akış yönünün tersine artar)
export const cutPos = (p, k) => {
  const j = Math.floor(k / p.cuts);
  const i = k - j * p.cuts;
  return j * LOG_L + p.trim + i * p.Lr;
};
const sm = (u) => {
  const k = Math.min(1, Math.max(0, u));
  return k * k * k * (k * (k * 6 - 15) + 10);
};
// besleme: testere düzlemindeki malzeme koordinatı f(θ)
export function feedAt(p, theta) {
  const k = Math.floor(theta / (2 * Math.PI));
  const psi = theta - k * 2 * Math.PI;
  const a = cutPos(p, k);
  const b = cutPos(p, k + 1);
  return {k, psi, f: a + (b - a) * sm((psi - FEED[0]) / (FEED[1] - FEED[0])), step: b - a};
}
// bıçak merkezi (y, z) ve kafa kolu açısı; ψ = 0 aşağı
export const bladeCenter = (psi) => ({y: H.y - ORBIT_E * Math.cos(psi), z: ORBIT_E * Math.sin(psi)});
// bıçağın logda olduğu derinlik 0..1 (log çapı boyunca kesilen oran)
export function cutDepth(psi, R) {
  const c = bladeCenter(psi);
  // log merkezinden bıçak kenarına uzaklık; kenar log kesitinde ne kadar ilerledi
  const d = Math.hypot(c.y - LOG_Y, c.z);
  return Math.min(1, Math.max(0, (R + LOG_R - d) / (2 * LOG_R)));
}

// rulo: kağıt boyu, yaprak, kütle
export function rollStats(Lr) {
  const meters = (Math.PI * (LOG_R * LOG_R - CORE_R * CORE_R)) / CALIPER;
  return {meters, sheets: Math.floor(meters / SHEET), kg: (meters * Lr * GSM) / 1000};
}

// parçalar: θ anında görünen log/rulo/fire parçaları
// tür: 'log' (kesilmemiş, akışla), 'roll' (serbest, çıkış bandında), 'trim' (fire kapağından düşüyor)
export const VOUT = 1.0; // çıkış bandı: tur başına 1 m
export const OUT_END = 2.75;
export const LANE_START = -6.2;
export function pieces(p, theta) {
  const {k, psi, f} = feedAt(p, theta);
  const out = [];
  const done = (kk) => theta >= kk * 2 * Math.PI + RELEASE; // kk. kesim bitti mi
  // geriye: en fazla 40 kesim önceden, ileriye: şeride sığan kadar
  for (let kk = k - 12; kk <= k + 3 * p.cuts + 2; kk++) {
    const j = Math.floor(kk / p.cuts);
    const i = kk - j * p.cuts;
    const q = cutPos(p, kk); // bu parçanın yukarı (arka) sınırı = kk. kesim
    if (i === 0) {
      // log başı firesi [j·L, q] ve önceki logun kuyruk firesi [önceki son kesim, j·L]
      const tails = [
        [cutPos(p, kk - 1), j * LOG_L, 'tail'],
        [j * LOG_L, q, 'head'],
      ];
      for (const [a, b, side] of tails) {
        if (!done(kk)) out.push({kind: 'log', a, b, x: f - a, len: b - a, end: side});
        else {
          const dt = (theta - (kk * 2 * Math.PI + RELEASE)) / (2 * Math.PI);
          if (dt > 0.32) continue;
          out.push({kind: 'trim', a, b, x: cutPos(p, kk) - a, len: b - a, fall: sm(dt / 0.14), dt});
        }
      }
      continue;
    }
    const a = cutPos(p, kk - 1);
    if (!done(kk)) {
      const x = f - a;
      if (x - (q - a) < LANE_START) continue;
      out.push({kind: 'log', a, b: q, x, len: q - a});
    } else {
      const dt = (theta - (kk * 2 * Math.PI + RELEASE)) / (2 * Math.PI);
      const g = dt - 0.1 * (1 - Math.exp(-dt / 0.1)); // yumuşak hızlanma
      const x = q - a + VOUT * g;
      if (x - (q - a) > OUT_END) continue;
      out.push({kind: 'roll', a, b: q, x, len: q - a, idx: kk});
    }
  }
  return {k, psi, f, list: out};
}

// makine durumu (göstergeler)
export function machineAt(theta, {cpm, Lr, bladeR, grindPhase = 0}) {
  const p = plan(Lr);
  const {k, psi, f, step} = feedAt(p, theta);
  const cutsDone = Math.max(0, k + (psi >= RELEASE ? 1 : 0));
  const logs = Math.floor(cutsDone / p.cuts);
  const rolls = logs * p.n + Math.max(0, (cutsDone % p.cuts) - 1);
  const feedTime = ((FEED[1] - FEED[0]) / (2 * Math.PI)) * (60 / cpm);
  const rs = rollStats(Lr);
  return {
    theta,
    psi,
    k,
    f,
    plan: p,
    cpm,
    logsMin: cpm / p.cuts,
    rollsMin: (cpm * p.n) / p.cuts,
    rollsHour: (cpm * p.n * 60) / p.cuts,
    step,
    feedTime,
    feedSpeed: step / Math.max(1e-6, feedTime), // m/s besleme tepe ortalaması
    bladeR,
    bladeV: (2 * Math.PI * bladeR * BLADE_RPM) / 60,
    depth: cutDepth(psi, bladeR),
    cutsDone,
    logs,
    rolls,
    kgH: ((cpm * p.n * 60) / p.cuts) * rs.kg,
    roll: rs,
    grinding: (((k - grindPhase) % GRIND_EVERY) + GRIND_EVERY) % GRIND_EVERY === 0 && psi > Math.PI * 0.6 && psi < Math.PI * 1.4,
    nextGrind: GRIND_EVERY - ((((k - grindPhase) % GRIND_EVERY) + GRIND_EVERY) % GRIND_EVERY),
    cutTime: ((2 * RELEASE) / (2 * Math.PI)) * (60 / cpm),
  };
}
