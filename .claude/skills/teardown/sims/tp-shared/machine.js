// Tuvalet kağıdı sarma hattının geometrisi: iki jumbo açıcı, kabartma, perforasyon, 3 merdaneli yüzey sarıcı,
// masura oluğu, kuyruk yapıştırma, çıkış bandı. update(state) her şeyi beslenen kağıttan (F) pozlar.
import * as THREE from 'three';
import {
  ACC, CHUTE, CORE_IN, CORE_R, cradle, J_CORE, logAngle, logR, mainPath, pAtX, PERF_N, PERF_R, plyPath, postLog, RIDER_R, ROLLS,
  SEALER, SHEET, UPPER, WEB_Y, WIDTH, wrapArc, jumboR, jumboAngle,
} from './kin.js';

const TAU = Math.PI * 2;
export const ACCENT = '#e8590c';
const HW = WIDTH / 2;

const WEB_VERT = /* glsl */ `
attribute float aS; attribute float aW;
varying float vS; varying float vW; varying vec3 vN;
void main(){
  vS = aS; vW = aW;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}`;
const WEB_FRAG = /* glsl */ `
uniform float uF, uPe, uPp;
uniform vec3 uPaper, uSun;
varying float vS; varying float vW; varying vec3 vN;
void main(){
  float m = uF - vS;
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  vec3 col = uPaper;
  float aw = max(length(vec2(dFdx(m), dFdy(m))), 2e-5);
  if (vS > uPe) {
    vec2 g = fract(vec2(m, vW) / 0.004) - 0.5;
    float dot = (1.0 - smoothstep(0.18, 0.32, length(g))) * (1.0 - smoothstep(0.0006, 0.0016, aw));
    col *= 1.0 - 0.08 * dot;
    // kabartma deseni: 25 mm'lik çiçek motifi
    vec2 q = fract(vec2(m, vW) / 0.025) - 0.5;
    col *= 1.0 - 0.06 * (1.0 - smoothstep(0.08, 0.14, abs(length(q) - 0.28)));
  }
  if (vS > uPp) {
    float d = abs(fract(m / ${SHEET.toFixed(3)} + 0.5) - 0.5) * ${SHEET.toFixed(3)};
    float dash = step(0.5, fract(vW / 0.006));
    col *= 1.0 - 0.32 * (1.0 - smoothstep(0.0006, 0.0006 + aw * 1.5, d)) * dash;
  }
  float lam = max(dot(n, normalize(uSun)), 0.0);
  col *= 0.44 + 0.46 * lam + 0.12 * (0.5 + 0.5 * n.y);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;
function webMaterial(extra = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: WEB_VERT,
    fragmentShader: WEB_FRAG,
    side: THREE.DoubleSide,
    uniforms: {uF: {value: 0}, uPe: {value: 0}, uPp: {value: 0}, uPaper: {value: new THREE.Color('#fbfaf5')}, uSun: {value: new THREE.Vector3(-0.3, 0.85, 0.45)}, ...extra},
  });
}
// bant şeridi: yol noktaları × enine sütunlar
function ribbonGeo(pts, nw = 23) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(pts.length * nw * 3);
  const aS = new Float32Array(pts.length * nw);
  const aW = new Float32Array(pts.length * nw);
  const idx = [];
  for (let i = 0; i < pts.length; i++) {
    const q = pts[i];
    for (let j = 0; j < nw; j++) {
      const w = -HW + (WIDTH * j) / (nw - 1);
      const k = i * nw + j;
      pos.set([q.x, q.y, w], k * 3);
      aS[k] = q.p;
      aW[k] = w;
      if (i < pts.length - 1 && j < nw - 1) idx.push(k, k + 1, k + nw, k + nw, k + 1, k + nw + 1);
    }
  }
  g.setIndex(idx);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aS', new THREE.BufferAttribute(aS, 1));
  g.setAttribute('aW', new THREE.BufferAttribute(aW, 1));
  g.computeVertexNormals();
  return g;
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const zCyl = (r, len, seg = 48) => {
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1);
  g.rotateX(Math.PI / 2);
  return g;
};
const canvasTex = (w, h, draw, srgb = true) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};

export function buildMachine() {
  const root = new THREE.Group();
  const M = (opt) => new THREE.MeshStandardMaterial({roughness: 0.5, metalness: 0.2, envMapIntensity: 0.6, ...opt});
  const add = (geo, mat, x = 0, y = 0, z = 0, parent = root) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const steel = () => M({color: '#c4c9cf', metalness: 0.75, roughness: 0.32});
  const dark = () => M({color: '#2f353c', metalness: 0.3, roughness: 0.55});
  const paint = () => M({color: '#56677a', metalness: 0.15, roughness: 0.55});
  const rubber = () => M({color: '#2a2d31', metalness: 0, roughness: 0.85});
  const rollers = [];
  const roller = (c, r, len, mat, s, spin = true) => {
    const piv = new THREE.Group();
    piv.position.set(c.x, c.y, 0);
    root.add(piv);
    add(zCyl(r, len), mat, 0, 0, 0, piv);
    add(zCyl(Math.min(0.03, r * 0.45), len + 0.16), steel(), 0, 0, 0, piv);
    for (const z of [-len / 2 - 0.001, len / 2 + 0.001]) add(box(r * 1.6, Math.max(0.008, r * 0.14), 0.002), dark(), 0, 0, z, piv);
    if (spin) rollers.push({obj: piv, r, s});
    return piv;
  };

  // ---------------------------------------------------------- gövde ve kaide
  const frameMat = M({color: '#5d6f82', metalness: 0.15, roughness: 0.5, transparent: true, opacity: 1});
  const FX0 = 3.4;
  const FX1 = 7.15;
  const plate = (() => {
    const s = new THREE.Shape();
    s.moveTo(FX0, 0.3);
    s.lineTo(FX1, 0.3);
    s.lineTo(FX1, 1.5);
    s.lineTo(6.0, 1.5);
    s.lineTo(5.75, 1.62);
    s.lineTo(4.75, 1.62);
    s.lineTo(4.55, 1.78);
    s.lineTo(4.0, 2.15);
    s.lineTo(FX0, 2.15);
    s.lineTo(FX0, 0.3);
    for (const [x0, x1, y0, y1] of [[3.6, 4.2, 0.5, 1.0], [4.6, 5.8, 0.5, 1.0], [6.0, 6.95, 0.5, 0.95]]) {
      const h = new THREE.Path();
      h.moveTo(x0, y0);
      h.lineTo(x0, y1);
      h.lineTo(x1, y1);
      h.lineTo(x1, y0);
      h.lineTo(x0, y0);
      s.holes.push(h);
    }
    return new THREE.ExtrudeGeometry(s, {depth: 0.04, bevelEnabled: false});
  })();
  const frameFront = add(plate, frameMat, 0, 0, HW + 0.1);
  add(plate, paint(), 0, 0, -HW - 0.14);
  add(box(FX1 - FX0 + 0.3, 0.3, WIDTH + 0.4), dark(), (FX0 + FX1) / 2, 0.15, 0);
  // ana tahrik (arka taraf): motor ve kayış kutusu
  add(box(0.6, 0.4, 0.34), M({color: '#3e4a57'}), 5.2, 0.6, -HW - 0.4);
  add(box(3.2, 0.18, 0.08), dark(), 5.3, 1.2, -HW - 0.2);

  // ---------------------------------------------------------- 1. jumbo açıcılar
  const sideTex = canvasTex(256, 256, (x) => {
    x.fillStyle = '#f1ede3';
    x.fillRect(0, 0, 256, 256);
    for (let r = 8; r < 128; r += 1.8) {
      x.strokeStyle = `rgba(150,140,120,${0.07 + 0.05 * Math.sin(r * 1.7)})`;
      x.beginPath();
      x.arc(128, 128, r, 0, TAU);
      x.stroke();
    }
  });
  const jumbos = [];
  for (const key of ['J1', 'J2']) {
    const c = ROLLS[key];
    const piv = new THREE.Group();
    piv.position.set(c.x, c.y, 0);
    root.add(piv);
    const g = new THREE.CylinderGeometry(1, 1, WIDTH, 72, 1);
    g.rotateX(Math.PI / 2);
    const body = add(g, [M({color: '#f3f0e8', roughness: 0.92, metalness: 0}), M({map: sideTex, roughness: 0.95, metalness: 0}), M({map: sideTex, roughness: 0.95, metalness: 0})], 0, 0, 0, piv);
    add(zCyl(J_CORE, WIDTH + 0.014), M({color: '#9c7a52', roughness: 0.9, metalness: 0}), 0, 0, 0, piv);
    add(zCyl(0.025, WIDTH + 0.4), steel(), 0, 0, 0, piv);
    for (const z of [-HW - 0.05, HW + 0.05])
      for (let k = 0; k < 3; k++) {
        const arm = add(box(0.09, 0.02, 0.016), M({color: ACCENT}), 0, 0, z, piv);
        arm.geometry = arm.geometry.clone().translate(0.045, 0, 0);
        arm.rotation.z = (k * TAU) / 3;
      }
    for (const z of [-HW - 0.15, HW + 0.15]) {
      const s = new THREE.Shape();
      s.moveTo(-0.5, 0);
      s.lineTo(0.5, 0);
      s.lineTo(0.07, c.y + 0.07);
      s.lineTo(-0.07, c.y + 0.07);
      s.lineTo(-0.5, 0);
      const h = new THREE.Path();
      h.moveTo(-0.32, 0.1);
      h.lineTo(0.32, 0.1);
      h.lineTo(0.035, c.y - 0.12);
      h.lineTo(-0.035, c.y - 0.12);
      s.holes.push(h);
      add(new THREE.ExtrudeGeometry(s, {depth: 0.04, bevelEnabled: false}), paint(), c.x, 0, z - 0.02);
      add(zCyl(0.055, 0.07), dark(), c.x, c.y, z);
    }
    add(box(0.14, 0.1, 0.12), M({color: '#d6a336', metalness: 0.4}), c.x, c.y, -HW - 0.27);
    jumbos.push({piv, body, key});
  }
  roller(ROLLS.M, ROLLS.M.r, WIDTH + 0.1, steel(), -1);
  for (const z of [-HW - 0.14, HW + 0.1]) add(box(0.08, 1.95, 0.04), paint(), ROLLS.M.x, 0.98, z + 0.02);

  // ---------------------------------------------------------- 2. kabartma
  const knurl = canvasTex(128, 128, (x) => {
    x.fillStyle = '#808080';
    x.fillRect(0, 0, 128, 128);
    x.fillStyle = '#fff';
    for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) x.fillRect(i * 8 + 2, j * 8 + 2, 4, 4);
  }, false);
  knurl.repeat.set(30, 12);
  roller(UPPER.E1, UPPER.E1.r, WIDTH + 0.06, M({color: '#bfc5cc', metalness: 0.85, roughness: 0.3, bumpMap: knurl, bumpScale: 2}), 1);
  roller(ROLLS.E2, ROLLS.E2.r, WIDTH + 0.06, rubber(), -1);
  for (const z of [-HW - 0.02, HW + 0.02]) {
    add(box(0.06, 0.22, 0.05), M({color: '#9aa4ae', metalness: 0.6}), UPPER.E1.x, UPPER.E1.y + 0.25, z);
    add(box(0.09, 0.05, 0.07), dark(), UPPER.E1.x, UPPER.E1.y + 0.38, z);
  }
  roller(ROLLS.G2, ROLLS.G2.r, WIDTH + 0.1, steel(), -1);

  // ---------------------------------------------------------- 3. perforasyon
  const perf = new THREE.Group();
  perf.position.set(UPPER.PF.x, UPPER.PF.y, 0);
  root.add(perf);
  add(zCyl(PERF_R - 0.012, WIDTH + 0.04), M({color: '#7d8791', metalness: 0.6, roughness: 0.35}), 0, 0, 0, perf);
  add(zCyl(0.03, WIDTH + 0.2), steel(), 0, 0, 0, perf);
  // 5 bıçak: yerel açı −π/2 + i·2π/5; biri tepeye değil, kağıda (alta) indiğinde delik çizgisi oluşur
  for (let i = 0; i < PERF_N; i++) {
    const a = -Math.PI / 2 + (i * TAU) / PERF_N;
    const b = add(box(0.016, 0.004, WIDTH + 0.02), M({color: '#eef1f4', metalness: 0.95, roughness: 0.15}), Math.cos(a) * (PERF_R - 0.006), Math.sin(a) * (PERF_R - 0.006), 0, perf);
    b.rotation.z = a + Math.PI / 2;
    b.geometry = new THREE.BoxGeometry(0.004, 0.016, WIDTH + 0.02);
  }
  // sabit karşı bıçak (örs) ve kirişi
  add(box(0.012, 0.03, WIDTH + 0.04), M({color: ACCENT, metalness: 0.4}), UPPER.PF.x, WEB_Y - 0.016, 0);
  add(box(0.08, 0.08, WIDTH + 0.2), paint(), UPPER.PF.x, WEB_Y - 0.071, 0);
  roller(ROLLS.G3, ROLLS.G3.r, WIDTH + 0.1, steel(), -1);

  // ---------------------------------------------------------- 4. sarıcı: iki alt merdane + üst bastırma merdanesi
  roller(ROLLS.W1, ROLLS.W1.r, WIDTH + 0.06, M({color: '#9aa3ab', metalness: 0.6, roughness: 0.4}), -1);
  roller(ROLLS.W2, ROLLS.W2.r, WIDTH + 0.06, M({color: '#9aa3ab', metalness: 0.6, roughness: 0.4}), -1);
  const rider = new THREE.Group();
  root.add(rider);
  add(zCyl(RIDER_R, WIDTH + 0.04), M({color: '#c9a35c', metalness: 0.5, roughness: 0.4}), 0, 0, 0, rider);
  add(box(RIDER_R * 1.6, 0.008, 0.002), dark(), 0, 0, HW + 0.025, rider);
  const riderArms = [HW + 0.06, -HW - 0.06].map((z) => add(box(0.03, 1, 0.025), dark(), 0, 0, z));
  const RIDER_PIV = {x: 6.95, y: 1.58};
  for (const z of [HW + 0.06, -HW - 0.06]) add(zCyl(0.03, 0.05), steel(), RIDER_PIV.x, RIDER_PIV.y, z);
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.25, 16), dark(), RIDER_PIV.x + 0.12, RIDER_PIV.y + 0.12, HW + 0.06).rotation.z = 0.6;

  // ---------------------------------------------------------- 5. masura oluğu (tutkallı masuralar)
  const coreMat = M({color: '#a8865c', roughness: 0.85, metalness: 0});
  const glueMat = M({color: '#d9a43a', roughness: 0.3, metalness: 0});
  const makeCore = () => {
    const g = new THREE.Group();
    add(zCyl(CORE_R, WIDTH + 0.01, 24), coreMat, 0, 0, 0, g);
    for (const a of [0.3, 2.4]) add(box(0.004, 0.004, WIDTH - 0.02), glueMat, Math.cos(a) * CORE_R, Math.sin(a) * CORE_R, 0, g);
    root.add(g);
    return g;
  };
  const chuteCores = Array.from({length: 6}, makeCore);
  const CH_DIR = {x: -0.62, y: 0.42}; // oluk yönü (yukarı-geri)
  const chL = Math.hypot(CH_DIR.x, CH_DIR.y);
  for (const z of [-HW + 0.1, 0, HW - 0.1]) {
    const r = add(box(chL + 0.1, 0.012, 0.03), steel(), CHUTE.x + CH_DIR.x / 2, CHUTE.y + CH_DIR.y / 2 - CORE_R - 0.006, z);
    r.rotation.z = Math.atan2(CH_DIR.y, CH_DIR.x) + Math.PI;
  }
  // tutkal haznesi ve aplikatör
  add(box(0.12, 0.1, WIDTH + 0.1), M({color: '#d6a336', metalness: 0.3}), CHUTE.x - 0.32, CHUTE.y + 0.3, 0);
  // aktif masura (logun içinde)
  const activeCore = makeCore();

  // ---------------------------------------------------------- loglar
  const logSide = canvasTex(512, 64, (x, w, h) => {
    x.fillStyle = '#f8f6f0';
    x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(160,150,130,.18)';
    for (let i = 0; i < w; i += 8) for (let j = 0; j < h; j += 8) x.fillRect(i + 3, j + 3, 3, 3);
    x.fillStyle = 'rgba(120,110,95,.35)';
    for (let j = 0; j < h; j += 4) x.fillRect(0, j, 2, 2);
  });
  logSide.repeat.set(3, 20);
  const logCap = canvasTex(256, 256, (x) => {
    x.fillStyle = '#f3f0e8';
    x.fillRect(0, 0, 256, 256);
    for (let r = 40; r < 128; r += 2) {
      x.strokeStyle = `rgba(150,140,120,${0.1 + 0.06 * Math.sin(r)})`;
      x.beginPath();
      x.arc(128, 128, r, 0, TAU);
      x.stroke();
    }
    x.fillStyle = '#a8865c';
    x.beginPath();
    x.arc(128, 128, 49, 0, TAU);
    x.fill();
    x.fillStyle = '#4a3a28';
    x.beginPath();
    x.arc(128, 128, 44, 0, TAU);
    x.fill();
  });
  const logGeo = (() => {
    const g = new THREE.CylinderGeometry(1, 1, WIDTH, 64, 1);
    g.rotateX(Math.PI / 2);
    return g;
  })();
  const makeLog = () => {
    const piv = new THREE.Group();
    root.add(piv);
    const m = add(logGeo, [M({map: logSide, roughness: 0.95, metalness: 0}), M({map: logCap, roughness: 0.95, metalness: 0}), M({map: logCap, roughness: 0.95, metalness: 0})], 0, 0, 0, piv);
    // kuyruk: yapıştırıcıda sarkan kağıt ucu
    const tail = add(new THREE.PlaneGeometry(1, WIDTH), webMaterial({uPe: {value: -1e3}, uPp: {value: -1e3}}), 0, 0, 0, root);
    tail.visible = false;
    return {piv, m, tail};
  };
  const winding = makeLog();
  const posts = [0, 1, 2].map(makeLog);

  // ---------------------------------------------------------- 6. kuyruk yapıştırma
  for (const dx of [-0.075, 0.075]) roller({x: SEALER.x + dx, y: SEALER.y}, 0.05, WIDTH + 0.04, rubber(), 1, false);
  const sealRollers = [-0.075, 0.075].map((dx) => root.children[root.children.length - 1 - (dx < 0 ? 1 : 0)]);
  void sealRollers;
  add(box(0.5, 0.04, WIDTH + 0.3), paint(), SEALER.x, SEALER.y - 0.08, 0);
  for (const z of [-HW - 0.12, HW + 0.12]) add(box(0.06, SEALER.y - 0.1, 0.06), dark(), SEALER.x, (SEALER.y - 0.1) / 2, z);
  // rampa: sarıcıdan yapıştırıcıya
  const ramp = add(box(0.55, 0.012, WIDTH + 0.04), steel(), 7.12, 1.17, 0);
  ramp.rotation.z = -0.32;
  // tutkal püskürtme kirişi + damlalar
  const NZ = {x: SEALER.x - 0.2, y: SEALER.y + 0.05 + 2 * logR(25) + 0.12};
  const nozzle = add(box(0.05, 0.06, WIDTH + 0.1), M({color: '#3e4a57'}), NZ.x, NZ.y, 0);
  for (const z of [-HW - 0.08, HW + 0.08]) add(box(0.03, NZ.y - SEALER.y + 0.08, 0.03), dark(), NZ.x, (NZ.y + SEALER.y - 0.08) / 2, z);
  void nozzle;
  const spray = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(120 * 3), 3)),
    new THREE.PointsMaterial({color: '#f2b632', size: 0.01}),
  );
  spray.frustumCulled = false;
  root.add(spray);

  // ---------------------------------------------------------- 7. çıkış bandı ve logsaw girişi
  const accTex = canvasTex(64, 8, (x) => {
    x.fillStyle = '#26292d';
    x.fillRect(0, 0, 64, 8);
    x.fillStyle = '#4a5058';
    x.fillRect(0, 0, 10, 8);
  });
  accTex.repeat.set((ACC.x1 - ACC.x0) / 0.08, 1);
  add(box(ACC.x1 - ACC.x0, 0.03, WIDTH + 0.1), M({map: accTex, roughness: 0.8, metalness: 0}), (ACC.x0 + ACC.x1) / 2, ACC.y - 0.015, 0);
  for (let x = ACC.x0 + 0.2; x < ACC.x1; x += 0.9) for (const z of [-HW, HW]) add(box(0.05, ACC.y - 0.03, 0.05), dark(), x, (ACC.y - 0.03) / 2, z);
  for (const z of [-HW - 0.06, HW + 0.06]) add(box(ACC.x1 - ACC.x0, 0.08, 0.012), steel(), (ACC.x0 + ACC.x1) / 2, ACC.y + 0.04, z);
  const sawTex = canvasTex(512, 256, (x) => {
    x.fillStyle = '#d7dce1';
    x.fillRect(0, 0, 512, 256);
    x.fillStyle = '#1f262d';
    x.font = 'bold 64px sans-serif';
    x.fillText('LOGSAW', 40, 120);
    x.fillStyle = '#e8590c';
    x.font = 'bold 34px sans-serif';
    x.fillText('→ 15 × 100 mm', 40, 190);
  });
  add(box(0.8, 1.5, WIDTH + 0.4), [M({color: '#d7dce1'}), M({color: '#d7dce1'}), M({color: '#d7dce1'}), M({color: '#d7dce1'}), M({map: sawTex}), M({color: '#d7dce1'})], ACC.x1 + 0.45, 0.75, 0);
  // kumanda paneli
  add(box(0.5, 1.6, 0.4), M({color: '#d7dce1', metalness: 0.2}), 2.0, 0.8, -HW - 1.1);

  // ---------------------------------------------------------- kağıt
  const main = mainPath();
  const entry = main[main.length - 1];
  const P = {pe: pAtX(main, UPPER.E1.x), pp: pAtX(main, UPPER.PF.x)};
  const webMat = webMaterial({uPe: {value: P.pe}, uPp: {value: P.pp}});
  root.add(new THREE.Mesh(ribbonGeo(main, 31), webMat));
  const wrap = new THREE.Mesh(new THREE.BufferGeometry(), webMat);
  root.add(wrap);
  const plyMat = webMaterial({uPe: {value: 1e3}, uPp: {value: 1e3}});
  const plies = ['J1', 'J2'].map((key) => {
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), plyMat);
    root.add(mesh);
    return {key, mesh, R: -1};
  });

  const sm = (u) => {
    const k = Math.min(1, Math.max(0, u));
    return k * k * (3 - 2 * k);
  };
  const sp = spray.geometry.attributes.position.array;
  const hash = (n) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  let lastR = -1;

  // st: lineAt(...) + {J0, T, xray, Llog}
  const update = (st) => {
    const F = st.F;
    for (const r of rollers) r.obj.rotation.z = (r.s * F) / r.r;
    perf.rotation.z = (F - P.pp) / PERF_R;
    for (const j of jumbos) {
      const R = jumboR(st.J0, F);
      j.body.scale.set(R, R, 1);
      j.piv.rotation.z = -jumboAngle(st.J0, F);
    }
    for (const pl of plies) {
      const R = jumboR(st.J0, F);
      if (Math.abs(R - pl.R) > 0.0015) {
        pl.R = R;
        const pts = plyPath(pl.key, R, pl.key === 'J2' ? 0.0015 : 0);
        pl.mesh.geometry.dispose();
        pl.mesh.geometry = ribbonGeo(pts, 15);
      }
    }
    webMat.uniforms.uF.value = F;
    plyMat.uniforms.uF.value = F;
    // sarılan log
    const Rl = st.Rl;
    const c = cradle(Rl);
    // yeni masura oluktan beşiğe iner (logun ilk %5'i)
    const kin = sm(st.u / CORE_IN);
    const cx = CHUTE.x + (c.x - CHUTE.x) * kin;
    const cy = CHUTE.y + (c.y - CHUTE.y) * kin - 0.03 * Math.sin(Math.PI * kin);
    winding.piv.position.set(cx, cy, 0);
    winding.m.scale.set(Rl, Rl, 1);
    winding.piv.rotation.z = -logAngle(st.Lw);
    activeCore.position.set(cx, cy, 0);
    activeCore.rotation.z = winding.piv.rotation.z;
    // bant W1'den loga: log beşiğe oturana kadar W1 tepesinde biter
    if (Math.abs(Rl - lastR) > 0.0004 || st.u < CORE_IN + 0.01) {
      lastR = Rl;
      wrap.geometry.dispose();
      wrap.geometry = ribbonGeo(wrapArc(entry, {x: cx, y: cy}, 16), 31);
    }
    // bastırma merdanesi logun tepesinde, kolu pivottan
    const ry = cy + Rl + RIDER_R;
    rider.position.set(cx, Math.max(ry, c.y + Rl + RIDER_R), 0);
    rider.rotation.z = (F / RIDER_R) % TAU;
    for (const a of riderArms) {
      const dx = rider.position.x - RIDER_PIV.x;
      const dy = rider.position.y - RIDER_PIV.y;
      const L = Math.hypot(dx, dy);
      a.scale.y = L;
      a.position.x = RIDER_PIV.x + dx / 2;
      a.position.y = RIDER_PIV.y + dy / 2;
      a.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
    }
    // oluktaki masuralar: bir aralık öne kayar
    for (let i = 0; i < chuteCores.length; i++) {
      const k = i + 1 - kin;
      chuteCores[i].position.set(CHUTE.x + (CH_DIR.x * k * 0.075) / chL, CHUTE.y + (CH_DIR.y * k * 0.075) / chL, 0);
    }
    // bitmiş loglar: yapıştırıcı ve çıkış
    let sprayOn = false;
    for (let i = 0; i < posts.length; i++) {
      const lg = posts[i];
      const jj = st.j - 1 - i;
      const q = (F - (jj + 1) * st.Llog) / st.Llog;
      const Rf = logR(st.Llog);
      const pl = postLog(q, Rf);
      const vis = jj >= 0 && !pl.done;
      lg.piv.visible = vis;
      lg.tail.visible = vis && pl.tail > 0.01;
      if (!vis) continue;
      lg.piv.position.set(pl.x, pl.y, 0);
      lg.m.scale.set(Rf, Rf, 1);
      lg.piv.rotation.z = -(logAngle(st.Llog) + (pl.x - cradle(Rf).x) / Rf + 4 * pl.tail);
      if (lg.tail.visible) {
        // kuyruk vakumla açılır, logun tepesinden geriye düz uzanır; tutkal üstüne püskürtülür
        const h = 0.3 * pl.tail;
        lg.tail.scale.set(h, 1, 1);
        lg.tail.position.set(pl.x - h / 2 - 0.01, pl.y + Rf + 0.002, 0);
        lg.tail.rotation.set(-Math.PI / 2, 0, 0);
        lg.tail.material.uniforms.uF.value = 0;
      }
      if (pl.glue) sprayOn = true;
    }
    for (let i = 0; i < 120; i++) {
      const t = (st.T * 2.2 + hash(i)) % 1;
      sp[i * 3] = NZ.x + 0.03 * (hash(i + 5) - 0.5);
      sp[i * 3 + 1] = sprayOn ? NZ.y - 0.03 - 0.1 * t : 1e3;
      sp[i * 3 + 2] = -HW + WIDTH * hash(i * 3.1);
    }
    spray.geometry.attributes.position.needsUpdate = true;
    accTex.offset.x = -(F / st.Llog) * 2.6 * 0.3;
    frameMat.opacity = 1 - 0.86 * (st.xray ?? 0);
    frameMat.depthWrite = (st.xray ?? 0) < 0.5;
    frameFront.castShadow = (st.xray ?? 0) < 0.5;
  };

  const anchors = {
    J1: [ROLLS.J1.x, ROLLS.J1.y + 0.45, HW],
    J2: [ROLLS.J2.x, ROLLS.J2.y + 0.45, HW],
    M: [ROLLS.M.x, ROLLS.M.y + 0.06, HW],
    E1: [UPPER.E1.x, UPPER.E1.y + 0.1, HW],
    E2: [ROLLS.E2.x, ROLLS.E2.y - 0.06, HW],
    PF: [UPPER.PF.x, UPPER.PF.y + 0.06, HW],
    anvil: [UPPER.PF.x, WEB_Y - 0.03, HW],
    web: [5.1, WEB_Y, HW * 0.6],
    W1: [ROLLS.W1.x - 0.05, ROLLS.W1.y - 0.06, HW],
    rider: [6.53, 1.38, HW],
    log: [6.53, 1.27, HW * 0.5],
    chute: [CHUTE.x - 0.2, CHUTE.y + 0.15, HW],
    glue: [CHUTE.x - 0.32, CHUTE.y + 0.33, HW],
    sealer: [SEALER.x, SEALER.y + 0.05, HW],
    nozzle: [NZ.x, NZ.y, HW],
    acc: [8.9, ACC.y + 0.05, HW],
    saw: [ACC.x1 + 0.45, 1.2, HW + 0.2],
  };
  return {root, update, anchors, P};
}
