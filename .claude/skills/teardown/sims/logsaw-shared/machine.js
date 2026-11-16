// Logsaw geometrisi, koddan: besleme şeridi (V-kanal + tahrik bantları), log baskı papuçları, orbital kafa
// (kol, karşı ağırlık, bıçak, iki bileme taşı), fire kapağı ve haznesi, çıkış bandı, güvenlik kabini.
// update(state) her şeyi kafa açısından pozlar.
import * as THREE from 'three';
import {
  BLADE_T, bladeCenter, CORE_R, FEED, H, LANE_START, LOG_R, LOG_Y, ORBIT_E, OUT_END, pieces, plan,
} from './kin.js';

const TAU = Math.PI * 2;
export const ACCENT = '#e8590c';
export const KEYS = ['infeed', 'clamp', 'head', 'grind', 'trim', 'outfeed'];
const TABLE_Y = LOG_Y - LOG_R; // log alt yüzeyi

// ------------------------------------------------------------ log / rulo shader'ı (birim silindir, x ekseni boyunca)
const LOG_VERT = /* glsl */ `
uniform float uLen;
varying vec3 vL; varying vec3 vN; varying vec3 vNl;
void main(){
  vL = vec3(position.x * uLen, position.y, position.z);
  vNl = normal;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const LOG_FRAG = /* glsl */ `
uniform float uLen, uA, uHi, uSpin;
uniform vec3 uPaper, uCore, uAcc, uSun;
varying vec3 vL; varying vec3 vN; varying vec3 vNl;
void main(){
  vec3 n = normalize(vN);
  vec3 col = uPaper;
  if (abs(vNl.x) > 0.5) {
    // kesit yüzü: sarım halkaları, karton masura, delik
    float r = length(vL.yz);
    float ring = 0.5 + 0.5 * sin(r * 2200.0);
    col *= 0.93 + 0.05 * ring;
    col = mix(col, uCore, step(r, ${(CORE_R + 0.0025).toFixed(4)}));
    col = mix(col, vec3(0.32, 0.25, 0.18), step(r, ${CORE_R.toFixed(4)}));
  } else {
    // yan yüzey: kabartma noktaları ve delik çizgileri (250 mm yaprak, sarımın üstünde eksene paralel)
    float m = uA + vL.x; // malzeme konumu boyunca
    float ang = atan(vL.z, vL.y) + uSpin;
    vec2 g = fract(vec2(m / 0.004, ang * ${LOG_R.toFixed(3)} / 0.004)) - 0.5;
    float aw = fwidth(m / 0.004);
    float dt = (1.0 - smoothstep(0.2, 0.34, length(g))) * (1.0 - smoothstep(0.3, 0.8, aw));
    col *= 1.0 - 0.06 * dt;
    float perf = abs(fract(ang * ${LOG_R.toFixed(3)} / 0.25) - 0.5);
    col *= 1.0 - 0.10 * (1.0 - smoothstep(0.004, 0.012, perf));
  }
  float lam = max(dot(n, normalize(uSun)), 0.0);
  float light = 0.42 + 0.46 * lam + 0.14 * (0.5 + 0.5 * n.y);
  col *= light;
  col = mix(col, uAcc, uHi * 0.25);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;
const LOG_GEO = (() => {
  const g = new THREE.CylinderGeometry(LOG_R, LOG_R, 1, 64, 1);
  g.rotateZ(-Math.PI / 2); // y → x
  g.translate(-0.5, 0, 0); // ön uç x = 0, geriye uzar (x ∈ [−1, 0])
  return g;
})();
function logMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: LOG_VERT,
    fragmentShader: LOG_FRAG,
    uniforms: {
      uLen: {value: 1},
      uA: {value: 0},
      uHi: {value: 0},
      uSpin: {value: 0},
      uPaper: {value: new THREE.Color('#f7f5ef')},
      uCore: {value: new THREE.Color('#a8865c')},
      uAcc: {value: new THREE.Color(ACCENT)},
      uSun: {value: new THREE.Vector3(-0.3, 0.85, 0.45)},
    },
  });
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const xCyl = (r, len, seg = 48) => {
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1);
  g.rotateZ(Math.PI / 2);
  return g;
};

export function buildMachine() {
  const root = new THREE.Group();
  const parts = Object.fromEntries(KEYS.map((k) => [k, []]));
  const M = (key, opt) => {
    const m = new THREE.MeshStandardMaterial({roughness: 0.5, metalness: 0.2, envMapIntensity: 0.6, ...opt});
    if (key) parts[key].push(m);
    return m;
  };
  // her mesh hangi parçaya ait: tıklama ve odak soluklaştırma bununla çalışır
  let tag = null;
  const add = (geo, mat, x = 0, y = 0, z = 0, parent = root) => {
    const m = new THREE.Mesh(geo, mat);
    m.userData.part = tag;
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const steel = (k) => M(k, {color: '#c4c9cf', metalness: 0.75, roughness: 0.32});
  const dark = (k) => M(k, {color: '#2f353c', metalness: 0.3, roughness: 0.55});
  const paint = (k) => M(k, {color: '#56677a', metalness: 0.15, roughness: 0.55});
  const rubber = (k) => M(k, {color: '#24272b', metalness: 0, roughness: 0.85});

  // ---------------------------------------------------------- 1. besleme şeridi
  tag = 'lane';
  const X0 = LANE_START - 0.2;
  const X1 = -0.025; // bıçak yarığından önce biter
  const laneLen = X1 - X0;
  // V-kanal: iki eğik sac, log iki çizgiden oturur
  const vAng = (40 * Math.PI) / 180;
  // kanal levhası / bant: log yüzeyine teğet; n log merkezine bakar, genişlik dışa-yukarı uzar
  const vPlace = (m, s, gap, out) => {
    const a = -s * vAng;
    m.rotation.x = a;
    const cy = LOG_Y - LOG_R * Math.cos(vAng);
    const cz = s * LOG_R * Math.sin(vAng);
    const n = [Math.cos(a), Math.sin(a)]; // (y, z)
    const wd = [-Math.sin(a), Math.cos(a)];
    m.position.y = cy - n[0] * gap + wd[0] * out * s;
    m.position.z = cz - n[1] * gap + wd[1] * out * s;
  };
  for (const s of [-1, 1]) vPlace(add(box(laneLen, 0.008, 0.2), paint('infeed'), (X0 + X1) / 2, 0, 0), s, 0.01, 0.075);
  // tahrik bantları: V-kanaldaki iki yarıktan logu taşır, kamçı desenli doku besleme ile kayar
  const beltTex = (() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 8;
    const x = c.getContext('2d');
    x.fillStyle = '#26292d';
    x.fillRect(0, 0, 64, 8);
    x.fillStyle = '#4a5058';
    x.fillRect(0, 0, 10, 8);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(laneLen / 0.08, 1);
    return t;
  })();
  const beltMat = M('infeed', {map: beltTex, roughness: 0.8, metalness: 0});
  tag = 'feedBelt';
  for (const s of [-1, 1]) vPlace(add(box(laneLen, 0.006, 0.04), beltMat, (X0 + X1) / 2, 0, 0), s, 0.003, 0);
  // şerit ayakları ve tahrik motoru
  tag = 'lane';
  for (let x = X0 + 0.3; x < X1; x += 1.2) {
    for (const z of [-0.22, 0.22]) add(box(0.06, TABLE_Y - 0.06, 0.06), dark('infeed'), x, (TABLE_Y - 0.06) / 2, z);
    add(box(0.06, 0.06, 0.5), dark('infeed'), x, TABLE_Y - 0.09, 0);
  }
  add(box(0.32, 0.26, 0.26), M('infeed', {color: '#3e4a57'}), X0 + 0.5, TABLE_Y - 0.25, -0.38);
  // yan kılavuzlar
  for (const z of [-0.19, 0.19]) add(box(laneLen, 0.012, 0.012), steel('infeed'), (X0 + X1) / 2, LOG_Y + 0.02, z);

  // ---------------------------------------------------------- 2. baskı papuçları (bıçağın iki yanında)
  // tek papuç bıçağın besleme tarafında: akış tarafı kafa koluyla çakışırdı, rulo çıkış bandının kılavuzunda tutulur
  const clamps = [];
  tag = 'clamp';
  {
    const x = -0.1;
    const g = new THREE.Group();
    root.add(g);
    const shoe = new THREE.CylinderGeometry(LOG_R + 0.012, LOG_R + 0.012, 0.1, 32, 1, true, -Math.PI / 2.6, Math.PI / 1.3);
    shoe.rotateZ(Math.PI / 2);
    const sm = add(shoe, M('clamp', {color: ACCENT, roughness: 0.5, side: THREE.DoubleSide}), x, 0, 0, g);
    sm.rotation.x = -Math.PI / 2;
    add(new THREE.CylinderGeometry(0.016, 0.016, 0.22, 16).translate(0, LOG_R + 0.12, 0), M('clamp', {color: '#b9c1c9', metalness: 0.8, roughness: 0.25}), x, 0, 0, g);
    clamps.push(g);
    add(new THREE.CylinderGeometry(0.035, 0.035, 0.18, 24), dark('clamp'), x, LOG_Y + LOG_R + 0.33, 0);
    add(box(0.3, 0.04, 0.08), paint('clamp'), -0.21, LOG_Y + LOG_R + 0.44, 0);
    add(box(0.05, LOG_Y + LOG_R + 0.46, 0.05), paint('clamp'), -0.34, (LOG_Y + LOG_R + 0.46) / 2, -0.26);
    add(box(0.05, 0.04, 0.3), paint('clamp'), -0.34, LOG_Y + LOG_R + 0.44, -0.12);
  }

  // ---------------------------------------------------------- 3. orbital kafa
  // portal: iki kolon + kiriş, kafa dişli kutusu kirişe asılı (akış yönünde, x > 0)
  tag = 'portal';
  for (const z of [-0.62, 0.62]) add(box(0.14, 1.95, 0.14), paint('head'), 0.36, 0.975, z).userData.secFade = z > 0 ? 0.8 : 0;
  add(box(0.18, 0.16, 1.38), paint('head'), 0.36, 1.95 + 0.08, 0);
  // kafa gövdesi (dişli kutusu): içi boş kutu; operatör tarafı kapağı kesitte kalkar, patlatmada açılır
  tag = 'housing';
  const HX = [0.12, 0.56];
  const HY = [H.y - 0.15, H.y + 0.58];
  const HZ = 0.17;
  const HT = 0.012;
  const hMat = () => M('head', {color: '#4d5c6c', metalness: 0.25});
  const hx = (HX[0] + HX[1]) / 2;
  const hw = HX[1] - HX[0];
  const hy = (HY[0] + HY[1]) / 2;
  const hh = HY[1] - HY[0];
  add(box(hw, hh, HT), hMat(), hx, hy, -HZ);
  const hFront = add(box(hw, hh, HT), hMat(), hx, hy, HZ);
  hFront.userData.secFade = 1;
  const hTop = add(box(hw, HT, 2 * HZ), hMat(), hx, HY[1], 0);
  add(box(hw, HT, 2 * HZ), hMat(), hx, HY[0], 0);
  for (const x of HX) add(box(HT, hh, 2 * HZ), hMat(), x, hy, 0);
  // dişli: modül m = 2r/z, diş başı r + m, diş dibi r − 1,25 m; eksen x
  const gearGeo = (r, z, w) => {
    const m = (2 * r) / z;
    const ra = r + m;
    const rf = r - 1.25 * m;
    const sh = new THREE.Shape();
    for (let i = 0; i < z; i++) {
      const t = TAU / z;
      const a0 = i * t;
      [[rf, a0], [rf, a0 + 0.12 * t], [ra, a0 + 0.32 * t], [ra, a0 + 0.52 * t], [rf, a0 + 0.72 * t]].forEach(([rr, a], j) => {
        if (i === 0 && j === 0) sh.moveTo(rr * Math.cos(a), rr * Math.sin(a));
        else sh.lineTo(rr * Math.cos(a), rr * Math.sin(a));
      });
    }
    const hole = new THREE.Path();
    hole.absarc(0, 0, Math.min(r * 0.45, 0.046), 0, TAU, true);
    sh.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(sh, {depth: w, bevelEnabled: false, curveSegments: 4});
    g.translate(0, 0, -w / 2);
    g.rotateY(Math.PI / 2);
    return g;
  };
  // düz kayış: iki kasnak etrafında açık kayış şeridi, (y, z) düzleminde; u = yol boyu / 0,02
  const beltStripe = (() => {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 4;
    const x = c.getContext('2d');
    x.fillStyle = '#1f2327';
    x.fillRect(0, 0, 16, 4);
    x.fillStyle = '#e8590c';
    x.fillRect(0, 0, 3, 4);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  })();
  const beltGeo = (A, rA, B, rB, w) => {
    const dy = B[0] - A[0];
    const dz = B[1] - A[1];
    const Ld = Math.hypot(dy, dz);
    const d = [dy / Ld, dz / Ld];
    const pp = [-d[1], d[0]];
    const c = (rA - rB) / Ld;
    const sn = Math.sqrt(1 - c * c);
    const n1 = [c * d[0] + sn * pp[0], c * d[1] + sn * pp[1]];
    const n2 = [c * d[0] - sn * pp[0], c * d[1] - sn * pp[1]];
    const ang = (v) => Math.atan2(v[1], v[0]);
    const pts = [];
    const arc = (C, r, a0, a1, thr) => {
      let sw = (((a1 - a0) % TAU) + TAU) % TAU;
      const mid = a0 + sw / 2;
      if (Math.cos(mid) * thr[0] + Math.sin(mid) * thr[1] < 0) sw -= TAU;
      for (let i = 0; i <= 40; i++) {
        const a = a0 + (sw * i) / 40;
        pts.push([C[0] + (r + 0.002) * Math.cos(a), C[1] + (r + 0.002) * Math.sin(a)]);
      }
    };
    arc(A, rA, ang(n1), ang(n2), [-d[0], -d[1]]);
    arc(B, rB, ang(n2), ang(n1), d);
    pts.push(pts[0]);
    const pos = [];
    const uv = [];
    const idx = [];
    let L = 0;
    pts.forEach((p, i) => {
      if (i) L += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
      for (const sx of [-w / 2, w / 2]) {
        pos.push(sx, p[0], p[1]);
        uv.push(L / 0.02, sx > 0 ? 1 : 0);
      }
      if (i) idx.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  const beltMatOf = () => {
    const t = beltStripe.clone();
    t.needsUpdate = true;
    return {t, m: M('head', {map: t, roughness: 0.8, metalness: 0, side: THREE.DoubleSide})};
  };
  // yörünge mili: içi boş Ø 90, iki rulmanda; üstünde 64 dişli yörünge dişlisi
  const orbitShaft = new THREE.Group();
  orbitShaft.position.set(0, H.y, 0);
  root.add(orbitShaft);
  tag = 'orbitShaft';
  const osMesh = add(xCyl(0.045, 0.45), steel('head'), 0.32, 0, 0, orbitShaft);
  osMesh.userData.secFade = 0.75;
  tag = 'bearing';
  for (const x of [0.15, 0.52]) add(xCyl(0.07, 0.03), dark('head'), x, H.y, 0);
  tag = 'orbitGear';
  add(gearGeo(0.12, 64, 0.03), M('head', {color: '#b08d4a', metalness: 0.7, roughness: 0.35}), 0.3, 0, 0, orbitShaft);
  // iç mil (bıçak mili): yörünge milinin içinden koaksiyel geçer, koldaki kasnağı döndürür
  const inner = new THREE.Group();
  inner.position.set(0, H.y, 0);
  root.add(inner);
  tag = 'innerShaft';
  add(xCyl(0.02, 0.62), M('head', {color: '#d9b34a', metalness: 0.7, roughness: 0.3}), 0.37, 0, 0, inner);
  // ara mil: 16 dişli pinyon + Ø 180 kasnak
  const inter = new THREE.Group();
  inter.position.set(0, H.y + 0.15, 0);
  root.add(inter);
  tag = 'pinion';
  add(gearGeo(0.03, 16, 0.035), M('head', {color: '#c9a35c', metalness: 0.7, roughness: 0.35}), 0.3, 0, 0, inter);
  tag = 'interShaft';
  add(xCyl(0.015, 0.4), steel('head'), 0.34, 0, 0, inter);
  tag = 'pulley';
  add(xCyl(0.09, 0.03), M('head', {color: '#9aa3ab', metalness: 0.7, roughness: 0.3}), 0.48, 0, 0, inter);
  add(box(0.032, 0.02, 0.16), dark('head'), 0.48, 0, 0, inter);
  // yörünge motoru (dışarıda, akış tarafında) + Ø 60 kasnak; triger kayış 3:1
  const motorG = new THREE.Group();
  motorG.position.set(0, H.y + 0.45, 0);
  root.add(motorG);
  tag = 'orbitMotor';
  add(xCyl(0.085, 0.28), M('head', {color: '#3e4a57', metalness: 0.3}), 0.71, 0, 0, motorG);
  add(xCyl(0.07, 0.02), dark('head'), 0.86, 0, 0, motorG);
  const motorRot = new THREE.Group();
  motorG.add(motorRot);
  add(xCyl(0.012, 0.15), steel('head'), 0.53, 0, 0, motorRot);
  tag = 'pulley';
  add(xCyl(0.03, 0.03), M('head', {color: '#9aa3ab', metalness: 0.7, roughness: 0.3}), 0.48, 0, 0, motorRot);
  add(box(0.032, 0.012, 0.06), dark('head'), 0.48, 0, 0, motorRot);
  tag = 'motorBelt';
  const mb = beltMatOf();
  const motorBelt = add(beltGeo([H.y + 0.15, 0], 0.09, [H.y + 0.45, 0], 0.03, 0.026), mb.m, 0.48, 0, 0);
  // bıçak motoru: iç mille koaksiyel, gövdenin arkasında
  const bmG = new THREE.Group();
  bmG.position.set(0, H.y, 0);
  root.add(bmG);
  tag = 'bladeMotor';
  add(xCyl(0.1, 0.3), M('head', {color: '#2f5d7c', metalness: 0.3}), 0.74, 0, 0, bmG);
  const bmFan = new THREE.Group();
  bmG.add(bmFan);
  add(xCyl(0.08, 0.02), dark('head'), 0.9, 0, 0, bmFan);
  add(box(0.024, 0.15, 0.02), M('head', {color: ACCENT}), 0.9, 0, 0, bmFan);

  // dönen kol: H etrafında; içinde 2:1 kayış, bıçak mili ve bileme taşları
  const arm = new THREE.Group();
  arm.position.set(0, H.y, H.z);
  root.add(arm);
  tag = 'arm';
  const armMat = M('head', {color: '#7b8794', metalness: 0.5, roughness: 0.35});
  const armCase = add(box(0.04, ORBIT_E + 0.13, 0.15), armMat, 0.075, -ORBIT_E / 2 + 0.015, 0, arm);
  armCase.userData.secFade = 0.85;
  add(box(0.05, 0.12, 0.2), M('head', {color: '#3a434d', metalness: 0.4}), 0.075, 0.14, 0, arm);
  tag = 'armPulley';
  const armH = new THREE.Group();
  arm.add(armH);
  add(xCyl(0.06, 0.016), M('head', {color: '#9aa3ab', metalness: 0.7, roughness: 0.3}), 0.075, 0, 0, armH);
  add(box(0.018, 0.016, 0.1), dark('head'), 0.075, 0, 0, armH);
  tag = 'armBelt';
  const ab = beltMatOf();
  const armBelt = add(beltGeo([0, 0], 0.06, [-ORBIT_E, 0], 0.03, 0.014), ab.m, 0.075, 0, 0, arm);
  tag = 'spindle';
  const kovan = add(xCyl(0.04, 0.07), steel('head'), 0.04, -ORBIT_E, 0, arm);
  kovan.userData.secFade = 0.8;
  // bıçak: kendi ekseninde döner
  const bladeTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(256, 256, 30, 256, 256, 256);
    g.addColorStop(0, '#9aa3ab');
    g.addColorStop(0.85, '#d9dee3');
    g.addColorStop(0.95, '#f4f6f8');
    g.addColorStop(1, '#ffffff');
    x.fillStyle = g;
    x.beginPath();
    x.arc(256, 256, 256, 0, TAU);
    x.fill();
    // genleşme yarıkları ve yazı: dönüş görünür olsun
    x.strokeStyle = '#5c656e';
    x.lineWidth = 4;
    for (let i = 0; i < 6; i++) {
      const a = (i * TAU) / 6;
      x.beginPath();
      x.moveTo(256 + Math.cos(a) * 200, 256 + Math.sin(a) * 200);
      x.lineTo(256 + Math.cos(a) * 245, 256 + Math.sin(a) * 245);
      x.stroke();
    }
    x.fillStyle = '#e8590c';
    x.font = 'bold 34px sans-serif';
    x.textAlign = 'center';
    x.fillText('Ø 620', 256, 150);
    x.fillStyle = '#2f353c';
    x.beginPath();
    x.arc(256, 256, 44, 0, TAU);
    x.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const bladePiv = new THREE.Group();
  bladePiv.position.set(0, -ORBIT_E, 0);
  arm.add(bladePiv);
  tag = 'spindle';
  add(xCyl(0.015, 0.09), steel('head'), 0.04, 0, 0, bladePiv);
  tag = 'armPulley';
  add(xCyl(0.03, 0.016), M('head', {color: '#9aa3ab', metalness: 0.7, roughness: 0.3}), 0.075, 0, 0, bladePiv);
  add(box(0.018, 0.012, 0.05), dark('head'), 0.075, 0, 0, bladePiv);
  tag = 'blade';
  const bladeGeo = new THREE.CylinderGeometry(1, 1, BLADE_T, 128, 1);
  bladeGeo.rotateZ(Math.PI / 2);
  const bladeMat = M('head', {map: bladeTex, metalness: 0.45, roughness: 0.3});
  const blade = add(bladeGeo, [M('head', {color: '#e6eaee', metalness: 0.9, roughness: 0.2}), bladeMat, bladeMat], 0, 0, 0, bladePiv);
  blade.castShadow = true;
  // bileme taşları: bıçağın H'ye bakan iç kenarında (±150°), loga hiç girmeyen nokta; iki yüz için iki taş
  const grinders = [];
  tag = 'grinder';
  for (const [ang, side] of [
    [(150 * Math.PI) / 180, -1],
    [(-150 * Math.PI) / 180, 1],
  ]) {
    const g = new THREE.Group();
    arm.add(g);
    const wheel = add(xCyl(0.035, 0.022, 32), M('grind', {color: '#b9a37a', roughness: 0.95, metalness: 0}), 0, 0, 0, g);
    const motor = add(xCyl(0.022, 0.06), dark('grind'), side * 0.04, 0, 0, g);
    void motor;
    grinders.push({g, wheel, ang, side});
  }
  const sparks = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(60 * 3), 3)),
    new THREE.PointsMaterial({color: '#ffb347', size: 0.012, transparent: true, opacity: 0.9}),
  );
  sparks.frustumCulled = false;
  arm.add(sparks);

  // ---------------------------------------------------------- 4. fire kapağı ve hazne
  tag = 'flap';
  const flap = new THREE.Group();
  flap.position.set(0.24, TABLE_Y - 0.004, 0);
  root.add(flap);
  add(box(0.21, 0.008, 0.26), M('trim', {color: '#8d969f', metalness: 0.6}), -0.105, 0, 0, flap);
  tag = 'bin';
  add(box(0.36, 0.34, 0.5), M('trim', {color: '#d6a336', metalness: 0.2, roughness: 0.6}), 0.12, 0.17, 0);
  add(box(0.32, 0.02, 0.46), dark('trim'), 0.12, 0.33, 0);
  const binMat = M('trim', {color: '#f7f5ef', roughness: 0.95});
  const binPile = add(box(0.3, 0.1, 0.44), binMat, 0.12, 0.3, 0);
  void binPile;

  // ---------------------------------------------------------- 5. çıkış bandı
  tag = 'outfeed';
  const outTex = beltTex.clone();
  outTex.needsUpdate = true;
  outTex.repeat.set((OUT_END - 0.25) / 0.08, 1);
  const outMat = M('outfeed', {map: outTex, roughness: 0.8, metalness: 0});
  add(box(OUT_END - 0.25 + 0.1, 0.03, 0.3), outMat, (0.25 + OUT_END) / 2 + 0.05, TABLE_Y - 0.015, 0);
  for (const x of [0.27, OUT_END + 0.08]) add(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 16).rotateX(Math.PI / 2), steel('outfeed'), x, TABLE_Y - 0.015, 0);
  for (let x = 0.6; x < OUT_END; x += 0.9) for (const z of [-0.13, 0.13]) add(box(0.05, TABLE_Y - 0.03, 0.05), dark('outfeed'), x, (TABLE_Y - 0.03) / 2, z);
  for (const z of [-0.16, 0.16]) add(box(OUT_END - 0.3, 0.05, 0.01), steel('outfeed'), (0.3 + OUT_END) / 2, TABLE_Y + 0.025, z);
  // paketleme makinesine giriş
  tag = 'packer';
  add(box(0.6, 1.3, 0.9), M('outfeed', {color: '#d7dce1', metalness: 0.2}), OUT_END + 0.42, 0.65, 0);
  add(box(0.02, 0.32, 0.32), M('outfeed', {color: '#1b2430'}), OUT_END + 0.11, TABLE_Y + 0.14, 0);

  // ---------------------------------------------------------- 6. güvenlik kabini (şeffaf polikarbon)
  tag = null;
  const glass = new THREE.MeshStandardMaterial({color: '#c9dbe6', transparent: true, opacity: 0.16, roughness: 0.1, metalness: 0, depthWrite: false, side: THREE.DoubleSide});
  const cab = new THREE.Group();
  root.add(cab);
  const CX = [-0.5, 0.62];
  const CY = [0.25, 2.12];
  const CZ = 0.7;
  const cw = CX[1] - CX[0];
  const ch = CY[1] - CY[0];
  for (const z of [-CZ, CZ]) {
    const m = new THREE.Mesh(box(cw, ch, 0.006), glass);
    m.position.set((CX[0] + CX[1]) / 2, (CY[0] + CY[1]) / 2, z);
    cab.add(m);
  }
  const edge = M(null, {color: '#e3b23c', metalness: 0.3});
  for (const z of [-CZ, CZ]) for (const x of CX) add(box(0.04, ch, 0.04), edge, x, (CY[0] + CY[1]) / 2, z, cab);
  for (const z of [-CZ, CZ]) for (const y of CY) add(box(cw, 0.04, 0.04), edge, (CX[0] + CX[1]) / 2, y, z, cab);

  // ---------------------------------------------------------- loglar, rulolar, fireler
  const POOL = 40;
  const pool = Array.from({length: POOL}, () => {
    const mat = logMaterial();
    const mesh = new THREE.Mesh(LOG_GEO, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.visible = false;
    mesh.userData.part = 'roll';
    root.add(mesh);
    return {mesh, mat};
  });

  // tıklanabilir parçalar: her mesh kendi malzemesini alır, böylece tek tek soluklaştırılabilir
  const pickables = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.userData.part) return;
    pickables.push(o);
    if (o.userData.part === 'roll') return;
    o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
    for (const m of [].concat(o.material)) {
      m.userData.op0 = m.opacity;
      m.userData.tr0 = m.transparent;
      m.userData.dw0 = m.depthWrite;
    }
  });
  const partBox = (key) => {
    const b = new THREE.Box3();
    for (const o of pickables) if (o.userData.part === key && o.visible) b.expandByObject(o);
    return b;
  };
  const ease = (u) => {
    const k = Math.min(1, Math.max(0, u));
    return k * k * (3 - 2 * k);
  };
  const tmpC = new THREE.Color();
  const accent = new THREE.Color(ACCENT);
  const sp = sparks.geometry.attributes.position.array;
  const hash = (n) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  // st: machineAt + {Lr, bladeAngle, hi, xray, T}
  const update = (st) => {
    const p = plan(st.Lr);
    const pc = pieces(p, st.theta);
    const psi = pc.psi;
    // kafa
    // ψ = 0'da kol aşağı; rotation.x = −ψ ile bıçak merkezi (H.y − e cos ψ, e sin ψ), kin.bladeCenter ile aynı.
    // patlatmada kol yukarı (ψ = π) döner ki bıçak logdan uzak dursun
    const ex = st.explode ?? 0;
    const sec = st.section ?? 0;
    const dpsi = ((((Math.PI - psi) % TAU) + TAU + Math.PI) % TAU) - Math.PI;
    const th = st.theta + dpsi * ex; // gösterilen yörünge açısı
    arm.rotation.x = -th;
    orbitShaft.rotation.x = -th;
    // iç mil: kol kasnağı 2:1 → iç milin kola göre açısı bıçağınkinin yarısı
    inner.rotation.x = -th + st.bladeAngle / 2;
    armH.rotation.x = st.bladeAngle / 2;
    bmFan.rotation.x = st.bladeAngle / 2;
    // yörünge dişlisi 64 / pinyon 16 = 4:1 ters yön; kasnak Ø180 / Ø60 = 3:1 aynı yön → motor 12 × kafa
    inter.rotation.x = 4 * th;
    motorRot.rotation.x = 12 * th;
    mb.t.offset.x = -(12 * th * 0.03) / 0.02;
    ab.t.offset.x = -((st.bladeAngle / 2) * 0.06) / 0.02;
    bladePiv.rotation.x = st.bladeAngle;
    bladePiv.position.x = -0.3 * ex;
    hFront.position.set(hx, hy + 0.8 * ex, HZ + 0.12 * ex);
    hTop.position.y = HY[1] + 0.3 * ex;
    inter.position.y = H.y + 0.15 + 0.2 * ex;
    motorG.position.set(0.22 * ex, H.y + 0.45 + 0.3 * ex, 0);
    bmG.position.x = 0.42 * ex;
    motorBelt.visible = ex < 0.02;
    armBelt.visible = ex < 0.02;
    kovan.position.x = 0.04 - 0.12 * ex;
    blade.scale.set(1, st.bladeR, st.bladeR);
    void bladeCenter;
    // bileme: taşlar bıçak kenarına yaklaşır
    const gr = st.grinding ? 1 : 0;
    for (const g of grinders) {
      const r = st.bladeR + 0.035 + 0.006 * (1 - gr) - 0.001;
      // kol yerel düzleminde (y, z): bıçak merkezinden ang yönünde; ang = 0 kol yönü (aşağı)
      const re = r + 0.1 * ex;
      g.g.position.set(g.side * (BLADE_T / 2 + 0.012) - 0.18 * ex + g.side * 0.05 * ex, -ORBIT_E - re * Math.cos(g.ang), re * Math.sin(g.ang) * -1);
      g.wheel.rotation.x = st.T * 40;
    }
    for (let i = 0; i < 60; i++) {
      const s = hash(i + Math.floor(st.T * 30) * 61);
      const g = grinders[i % 2];
      const life = hash(i * 7.3 + Math.floor(st.T * 30));
      const r = st.bladeR;
      const by = -ORBIT_E - r * Math.cos(g.ang);
      const bz = -r * Math.sin(g.ang);
      const v = 0.02 + 0.12 * life;
      sp[i * 3] = g.side * (0.02 + 0.06 * s);
      sp[i * 3 + 1] = gr ? by + v * (s - 0.3) : 1e3;
      sp[i * 3 + 2] = gr ? bz + v * (hash(i + 3.3) - 0.5) : 1e3;
    }
    sparks.geometry.attributes.position.needsUpdate = true;
    // papuçlar: besleme sırasında kalkar
    const open = ease((psi - (FEED[0] - 0.35)) / 0.3) * (1 - ease((psi - (FEED[1] + 0.02)) / 0.25));
    for (const c of clamps) c.position.y = LOG_Y + 0.045 * open + 0.25 * ex;
    // fire kapağı: fire kesildikten sonra açılır
    let flapOpen = 0;
    for (const q of pc.list) if (q.kind === 'trim') flapOpen = Math.max(flapOpen, ease(q.dt / 0.04) * (1 - ease((q.dt - 0.2) / 0.08)));
    flap.rotation.z = flapOpen * 1.0;
    // parçalar
    let n = 0;
    const hiOf = (k) => st.hi?.[k] ?? 0;
    for (const q of pc.list) {
      if (n >= POOL) break;
      if (q.kind === 'log' && q.x < LANE_START - 0.1) continue;
      const it = pool[n++];
      it.mesh.visible = true;
      it.mesh.scale.set(q.len, 1, 1);
      it.mat.uniforms.uLen.value = q.len;
      it.mat.uniforms.uA.value = q.a;
      let y = LOG_Y;
      let x = q.x;
      let rz = 0;
      if (q.kind === 'trim') {
        // kapaktan kayıp hazneye düşer
        y = LOG_Y - 0.55 * q.fall;
        x = q.x + 0.08 * q.fall;
        rz = -0.9 * q.fall;
        it.mesh.visible = q.dt < 0.3;
      }
      it.mesh.position.set(x, y, 0);
      it.mesh.rotation.set(0, 0, rz);
      it.mat.uniforms.uHi.value = q.kind === 'trim' ? hiOf('trim') : q.kind === 'roll' ? hiOf('outfeed') : 0;
    }
    for (; n < POOL; n++) pool[n].mesh.visible = false;
    // bant dokuları besleme ile
    beltTex.offset.x = -pc.f / 0.08;
    outTex.offset.x = -(st.theta / TAU) / 0.08;
    // vurgular
    for (const k of KEYS) {
      const v = hiOf(k);
      for (const m of parts[k]) {
        if (!m.userData.e0) m.userData.e0 = m.emissive.clone();
        tmpC.copy(m.userData.e0).lerp(accent, v * 0.025);
        m.emissive.copy(tmpC);
      }
    }
    // kesit ve odak: saydamlık mesh başına (kesit kapağı, kol gövdesi, mil kovanı + odak dışı parçalar)
    const fk = st.focusK ?? 0;
    for (const o of pickables) {
      if (o.userData.part === 'roll') continue;
      const dim = st.focusKey && o.userData.part !== st.focusKey ? fk : 0;
      const sf = o === hFront ? sec : Math.max(sec, ex);
      const f = (1 - (o.userData.secFade ?? 0) * sf) * (1 - 0.86 * dim);
      for (const m of [].concat(o.material)) {
        const op = m.userData.op0 * f;
        const tr = m.userData.tr0 || op < 0.999;
        if (m.transparent !== tr) {
          m.transparent = tr;
          m.needsUpdate = true;
        }
        m.opacity = op;
        m.depthWrite = tr ? op > 0.6 && m.userData.dw0 : m.userData.dw0;
      }
      o.visible = f > 0.03 && (o === motorBelt || o === armBelt ? ex < 0.02 : true);
    }
    glass.opacity = 0.16 * (1 - (st.xray ?? 0));
    edge.opacity = 1;
    cab.visible = (st.xray ?? 0) < 0.98;
  };

  const anchors = {
    lane: [-2.4, LOG_Y + LOG_R + 0.02, 0.0],
    belts: [-1.4, LOG_Y - LOG_R * 0.7, LOG_R * 0.7],
    clamp: [-0.1, LOG_Y + LOG_R + 0.02, 0.06],
    blade: [0, H.y - ORBIT_E, 0.18],
    arm: [0.075, H.y, 0.05],
    grind: [0, H.y - ORBIT_E + 0.27, 0.15],
    flap: [0.14, TABLE_Y, 0.12],
    bin: [0.12, 0.34, 0.25],
    out: [1.5, LOG_Y + LOG_R, 0],
    pack: [OUT_END + 0.3, 1.1, 0.45],
    gear: [0.3, H.y + 0.12, HZ],
    omotor: [0.71, H.y + 0.53, 0.06],
    bmotor: [0.74, H.y - 0.1, 0.06],
    inner: [0.62, H.y, 0.02],
  };
  return {root, update, anchors, pickables, partBox};
}
