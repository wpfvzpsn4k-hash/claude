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
  const add = (geo, mat, x = 0, y = 0, z = 0, parent = root) => {
    const m = new THREE.Mesh(geo, mat);
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
  for (const s of [-1, 1]) vPlace(add(box(laneLen, 0.006, 0.04), beltMat, (X0 + X1) / 2, 0, 0), s, 0.003, 0);
  // şerit ayakları ve tahrik motoru
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
  for (const z of [-0.62, 0.62]) add(box(0.14, 1.95, 0.14), paint('head'), 0.36, 0.975, z);
  add(box(0.18, 0.16, 1.38), paint('head'), 0.36, 1.95 + 0.08, 0);
  const housing = add(box(0.42, 0.42, 0.34), M('head', {color: '#4d5c6c', metalness: 0.25}), 0.33, H.y + 0.1, 0);
  void housing;
  add(xCyl(0.07, 0.1), steel('head'), 0.1, H.y, 0);
  add(box(0.36, 0.22, 0.26), M('head', {color: '#3e4a57'}), 0.34, H.y + 0.45, 0); // yörünge motoru
  // dönen kol: H etrafında; içinde bıçak mili ve bileme taşları
  const arm = new THREE.Group();
  arm.position.set(0, H.y, H.z);
  root.add(arm);
  const armMat = M('head', {color: '#7b8794', metalness: 0.5, roughness: 0.35});
  // kol çubuğu: H'den C'ye (yerel −y), karşı ağırlık yukarıda
  add(box(0.03, ORBIT_E + 0.1, 0.1), armMat, 0.075, -ORBIT_E / 2 + 0.0, 0, arm);
  add(box(0.045, 0.12, 0.18), M('head', {color: '#3a434d', metalness: 0.4}), 0.075, 0.13, 0, arm);
  add(xCyl(0.06, 0.04), armMat, 0.075, 0, 0, arm);
  // bıçak mili kovanı ve kayış koruyucu
  add(xCyl(0.04, 0.07), steel('head'), 0.04, -ORBIT_E, 0, arm);
  add(box(0.03, ORBIT_E, 0.07), M('head', {color: ACCENT, roughness: 0.5}), 0.105, -ORBIT_E / 2, 0, arm);
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
  const bladeGeo = new THREE.CylinderGeometry(1, 1, BLADE_T, 128, 1);
  bladeGeo.rotateZ(Math.PI / 2);
  const bladeMat = M('head', {map: bladeTex, metalness: 0.45, roughness: 0.3});
  const blade = add(bladeGeo, [M('head', {color: '#e6eaee', metalness: 0.9, roughness: 0.2}), bladeMat, bladeMat], 0, 0, 0, bladePiv);
  blade.castShadow = true;
  // bileme taşları: bıçağın H'ye bakan iç kenarında (±150°), loga hiç girmeyen nokta; iki yüz için iki taş
  const grinders = [];
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
  const flap = new THREE.Group();
  flap.position.set(0.24, TABLE_Y - 0.004, 0);
  root.add(flap);
  add(box(0.21, 0.008, 0.26), M('trim', {color: '#8d969f', metalness: 0.6}), -0.105, 0, 0, flap);
  add(box(0.36, 0.34, 0.5), M('trim', {color: '#d6a336', metalness: 0.2, roughness: 0.6}), 0.12, 0.17, 0);
  add(box(0.32, 0.02, 0.46), dark('trim'), 0.12, 0.33, 0);
  const binMat = M('trim', {color: '#f7f5ef', roughness: 0.95});
  const binPile = add(box(0.3, 0.1, 0.44), binMat, 0.12, 0.3, 0);
  void binPile;

  // ---------------------------------------------------------- 5. çıkış bandı
  const outTex = beltTex.clone();
  outTex.needsUpdate = true;
  outTex.repeat.set((OUT_END - 0.25) / 0.08, 1);
  const outMat = M('outfeed', {map: outTex, roughness: 0.8, metalness: 0});
  add(box(OUT_END - 0.25 + 0.1, 0.03, 0.3), outMat, (0.25 + OUT_END) / 2 + 0.05, TABLE_Y - 0.015, 0);
  for (const x of [0.27, OUT_END + 0.08]) add(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 16).rotateX(Math.PI / 2), steel('outfeed'), x, TABLE_Y - 0.015, 0);
  for (let x = 0.6; x < OUT_END; x += 0.9) for (const z of [-0.13, 0.13]) add(box(0.05, TABLE_Y - 0.03, 0.05), dark('outfeed'), x, (TABLE_Y - 0.03) / 2, z);
  for (const z of [-0.16, 0.16]) add(box(OUT_END - 0.3, 0.05, 0.01), steel('outfeed'), (0.3 + OUT_END) / 2, TABLE_Y + 0.025, z);
  // paketleme makinesine giriş
  add(box(0.6, 1.3, 0.9), M('outfeed', {color: '#d7dce1', metalness: 0.2}), OUT_END + 0.42, 0.65, 0);
  add(box(0.02, 0.32, 0.32), M('outfeed', {color: '#1b2430'}), OUT_END + 0.11, TABLE_Y + 0.14, 0);

  // ---------------------------------------------------------- 6. güvenlik kabini (şeffaf polikarbon)
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
    root.add(mesh);
    return {mesh, mat};
  });

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
    // ψ = 0'da kol aşağı; rotation.x = −ψ ile bıçak merkezi (H.y − e cos ψ, e sin ψ), kin.bladeCenter ile aynı
    arm.rotation.x = -psi;
    bladePiv.rotation.x = st.bladeAngle;
    blade.scale.set(1, st.bladeR, st.bladeR);
    void bladeCenter;
    // bileme: taşlar bıçak kenarına yaklaşır
    const gr = st.grinding ? 1 : 0;
    for (const g of grinders) {
      const r = st.bladeR + 0.035 + 0.006 * (1 - gr) - 0.001;
      // kol yerel düzleminde (y, z): bıçak merkezinden ang yönünde; ang = 0 kol yönü (aşağı)
      g.g.position.set(g.side * (BLADE_T / 2 + 0.012), -ORBIT_E - r * Math.cos(g.ang), r * Math.sin(g.ang) * -1);
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
    for (const c of clamps) c.position.y = LOG_Y + 0.045 * open;
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
  };
  return {root, update, anchors};
}
