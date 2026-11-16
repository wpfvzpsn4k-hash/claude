// Peçete makinesinin geometrisi, koddan: bobin açıcı, kabartma, iki flekso baskı ünitesi, iki boyuna katlama,
// kesici, çapraz katlama ve istifleyici. update(state) her şeyi ana mil açısından pozlar.
import * as THREE from 'three';
import {COVERAGE, GLSL, INK} from './design.js';
import {
  aniloxOf, DROP_END, EPS, foldAngles, foldCross, KNIFE_R, L, mainPath, NAP_T, PACK, pAtX, pieceAt, plyPath, ROLLS, R_CORE, STATION, UPPER, WEB_Y,
} from './kin.js';

const TAU = Math.PI * 2;
export const ACCENT = '#e8590c';
export const KEYS = ['unwind', 'emboss', 'print1', 'print2', 'fold', 'cut', 'stack'];

// ------------------------------------------------------------ kağıt shader'ı
const PAPER_VERT = /* glsl */ `
attribute float aS; attribute float aW;
varying float vS; varying float vW; varying vec3 vN; varying vec3 vP;
void main(){
  vS = aS; vW = aW;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vP = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const PAPER_FRAG = /* glsl */ `
uniform int uMode; uniform int uInk;
uniform float uF, uPc, uPe, uP1, uP2, uReg, uBase, uM0, uHi;
uniform vec3 uC1, uC2, uPaper, uRubber, uAcc, uSun;
varying float vS; varying float vW; varying vec3 vN; varying vec3 vP;
${GLSL}
void main(){
  float m; bool e = true; bool p1 = true; bool p2 = true;
  if (uMode == 0) { m = uF - (vS - uPc); e = vS > uPe; p1 = vS > uP1; p2 = vS > uP2; }
  else if (uMode == 1) { m = uBase + vS; }
  else { m = uM0 - vS * NL / 6.2831853; }
  vec2 uv = vec2(mod(m, NL), vW + NL * 0.5);
  float aw = max(length(vec2(dFdx(m), dFdy(m))), 2e-5) * 0.8;
  vec3 n = normalize(vN);
  bool front = gl_FrontFacing;
  if (!front) n = -n;
  float lam = 0.55 + 0.45 * max(dot(n, normalize(uSun)), 0.0);
  float hemi = 0.5 + 0.5 * n.y;
  float light = 0.42 + 0.48 * lam + 0.12 * hemi;
  vec3 col;
  if (uMode == 2) {
    float k = uInk == 1 ? ink1(uv, aw) : ink2(mod(uv, vec2(NL)), aw);
    col = mix(uRubber, uInk == 1 ? uC1 : uC2, k);
  } else {
    col = uPaper;
    float i1 = p1 ? ink1(uv, aw) : 0.0;
    float i2 = p2 ? ink2(uv + vec2(uReg, 0.0), aw) : 0.0;
    float sh = front ? 1.0 : 0.16;
    col = mix(col, uC1, i1 * 0.92 * sh);
    col = mix(col, uC2, i2 * 0.94 * sh);
    if (e) {
      vec2 g = fract(uv / 0.0028) - 0.5;
      float dot = 1.0 - smoothstep(0.18, 0.32, length(g));
      float fade = 1.0 - smoothstep(0.0004, 0.0011, aw);
      col *= 1.0 - 0.07 * dot * fade;
    }
  }
  col *= light;
  col = mix(col, uAcc, uHi * 0.28);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;
const lin = (hex) => new THREE.Color(hex);
export function paperMaterial(mode, extra = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: PAPER_VERT,
    fragmentShader: PAPER_FRAG,
    side: THREE.DoubleSide,
    uniforms: {
      uMode: {value: mode},
      uInk: {value: 1},
      uF: {value: 0},
      uPc: {value: 0},
      uPe: {value: 0},
      uP1: {value: 0},
      uP2: {value: 0},
      uReg: {value: 0},
      uBase: {value: 0},
      uM0: {value: 0},
      uHi: {value: 0},
      uC1: {value: lin(INK[1].hex)},
      uC2: {value: lin(INK[2].hex)},
      uPaper: {value: lin('#fbfaf5')},
      uRubber: {value: lin('#3a3d42')},
      uAcc: {value: lin(ACCENT)},
      uSun: {value: new THREE.Vector3(-0.3, 0.85, 0.45)},
      ...extra,
    },
  });
}

// ------------------------------------------------------------ yardımcılar
const zCyl = (r, len, seg = 48) => {
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1);
  g.rotateX(Math.PI / 2);
  return g;
};
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

// ızgara geometrisi: nu × nw köşe, aS / aW öznitelikleri; konumlar dışarıdan yazılır
function gridGeometry(nu, nw, sOf, wOf, flip = false) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(nu * nw * 3);
  const aS = new Float32Array(nu * nw);
  const aW = new Float32Array(nu * nw);
  for (let i = 0; i < nu; i++)
    for (let j = 0; j < nw; j++) {
      aS[i * nw + j] = sOf(i);
      aW[i * nw + j] = wOf(j);
    }
  const idx = [];
  for (let i = 0; i < nu - 1; i++)
    for (let j = 0; j < nw - 1; j++) {
      const a = i * nw + j;
      const b = (i + 1) * nw + j;
      if (flip) idx.push(a, b, a + 1, b, b + 1, a + 1);
      else idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  g.setIndex(idx);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aS', new THREE.BufferAttribute(aS, 1));
  g.setAttribute('aW', new THREE.BufferAttribute(aW, 1));
  return g;
}

// bant şeridi: yol örnekleri boyunca; katlama bölgesinde enine kesit foldCross ile
function writeRibbon(g, pts, nw, fold) {
  const pos = g.attributes.position.array;
  for (let i = 0; i < pts.length; i++) {
    const q = pts[i];
    const nx = -q.ty;
    const ny = q.tx;
    const [a1, a2] = fold ? foldAngles(q.x) : [0, 0];
    for (let j = 0; j < nw; j++) {
      const w = -L / 2 + (L * j) / (nw - 1);
      const [y, h] = a1 > 0 || a2 > 0 ? foldCross(w, a1, a2) : [w, 0];
      const k = (i * nw + j) * 3;
      pos[k] = q.x + nx * h;
      pos[k + 1] = q.y + ny * h;
      pos[k + 2] = y;
    }
  }
  g.attributes.position.needsUpdate = true;
  g.computeVertexNormals();
  g.computeBoundingSphere();
}

// kesilmiş peçete: u ön kenardan, w enine; tam boyuna katlı + çapraz katlama a3
function writePiece(g, nu, nw, xLead, y0, a3) {
  const pos = g.attributes.position.array;
  const xa = xLead - L / 2;
  for (let i = 0; i < nu; i++) {
    const u = (L * i) / (nu - 1);
    for (let j = 0; j < nw; j++) {
      const w = -L / 2 + (L * j) / (nw - 1);
      const [y, h] = foldCross(w, Math.PI, Math.PI);
      let x;
      let hh;
      if (u <= L / 2) {
        x = xLead - u;
        hh = h;
      } else {
        const d = u - L / 2;
        // (−d, h) noktası eksen etrafında saat yönü tersine a3 kadar: arka yarı aşağıdan öne
        const c = Math.cos(a3);
        const s = Math.sin(a3);
        x = xa + (-d * c - h * s);
        hh = -d * s + h * c - (4 * EPS * a3) / Math.PI;
      }
      const k = (i * nw + j) * 3;
      pos[k] = x;
      pos[k + 1] = y0 + hh;
      pos[k + 2] = y;
    }
  }
  g.attributes.position.needsUpdate = true;
  g.computeVertexNormals();
  g.computeBoundingSphere();
}

// ------------------------------------------------------------ makine
export function buildMachine() {
  const root = new THREE.Group();
  const parts = Object.fromEntries(KEYS.map((k) => [k, []]));
  const hiMats = [];
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
  const rollers = []; // {obj, r, s} → açı = s·F/r
  // merdane: z ekseni boyunca, dönen pivot + uç işaretleri (dönüş görünsün diye)
  const roller = (key, c, r, len, mat, s, spin = true) => {
    const piv = new THREE.Group();
    piv.position.set(c.x, c.y, 0);
    root.add(piv);
    add(zCyl(r, len), mat, 0, 0, 0, piv);
    add(zCyl(Math.min(0.022, r * 0.45), len + 0.12), steel(key), 0, 0, 0, piv);
    for (const z of [-len / 2 - 0.001, len / 2 + 0.001]) add(box(r * 1.6, Math.max(0.006, r * 0.14), 0.002), dark(key), 0, 0, z, piv);
    if (spin) rollers.push({obj: piv, r, s});
    return piv;
  };

  // ---------------------------------------------------------- zemin kaidesi ve gövde
  const frameMat = M(null, {color: '#5d6f82', metalness: 0.15, roughness: 0.5, transparent: true, opacity: 1});
  const frameBack = paint(null);
  const FX0 = 2.22;
  const FX1 = 7.15;
  const plateGeo = (() => {
    const s = new THREE.Shape();
    s.moveTo(FX0, 0.32);
    s.lineTo(FX1, 0.32);
    s.lineTo(FX1, 1.36);
    s.lineTo(5.2, 1.36);
    s.lineTo(5.05, 1.42);
    s.lineTo(2.85, 1.42);
    s.lineTo(2.6, 1.78);
    s.lineTo(FX0, 1.78);
    s.lineTo(FX0, 0.32);
    // merdane ve mil geçişleri için pencereler
    const hole = (x0, x1, y0, y1) => {
      const h = new THREE.Path();
      h.moveTo(x0, y0);
      h.lineTo(x0, y1);
      h.lineTo(x1, y1);
      h.lineTo(x1, y0);
      h.lineTo(x0, y0);
      s.holes.push(h);
    };
    hole(2.75, 3.3, 0.55, 0.92);
    hole(3.6, 5.05, 0.55, 0.9);
    hole(5.45, 6.8, 0.55, 0.95);
    const g = new THREE.ExtrudeGeometry(s, {depth: 0.03, bevelEnabled: false});
    return g;
  })();
  const frameFront = add(plateGeo, frameMat, 0, 0, 0.26);
  add(plateGeo, frameBack, 0, 0, -0.29);
  add(box(FX1 - FX0 + 0.3, 0.32, 0.75), dark(null), (FX0 + FX1) / 2, 0.16, -0.01);
  // tahrik: ana motor ve dişli kutusu arka tarafta
  add(box(0.5, 0.36, 0.3), M(null, {color: '#3e4a57'}), 4.4, 0.5, -0.5);
  add(zCyl(0.13, 0.42), M(null, {color: '#2b3540', metalness: 0.4}), 3.95, 0.55, -0.5);
  add(box(4.6, 0.12, 0.06), dark(null), 4.7, 1.0, -0.33);

  // ---------------------------------------------------------- 1. bobin açıcı
  const unwind = [];
  const paperRollMat = M('unwind', {color: '#f3f0e8', roughness: 0.92, metalness: 0});
  const sideTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#f1ede3';
    x.fillRect(0, 0, 256, 256);
    for (let r = 12; r < 128; r += 2.2) {
      x.strokeStyle = `rgba(150,140,120,${0.08 + 0.06 * Math.sin(r * 1.7)})`;
      x.beginPath();
      x.arc(128, 128, r, 0, TAU);
      x.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const rollSide = M('unwind', {map: sideTex, roughness: 0.95, metalness: 0});
  for (const key of ['P1', 'P2']) {
    const c = ROLLS[key];
    const piv = new THREE.Group();
    piv.position.set(c.x, c.y, 0);
    root.add(piv);
    const body = add(new THREE.CylinderGeometry(1, 1, L, 72, 1), [paperRollMat, rollSide, rollSide], 0, 0, 0, piv);
    body.geometry.rotateX(Math.PI / 2);
    add(zCyl(R_CORE, L + 0.012), M('unwind', {color: '#9c7a52', roughness: 0.9, metalness: 0}), 0, 0, 0, piv);
    add(zCyl(0.02, 0.62), steel('unwind'), 0, 0, 0, piv);
    // pnömatik ayna (3 kollu), dönüşü gösterir
    for (const z of [-L / 2 - 0.035, L / 2 + 0.035])
      for (let k = 0; k < 3; k++) {
        const arm = add(box(0.075, 0.016, 0.014), M('unwind', {color: ACCENT, roughness: 0.5}), 0, 0, z, piv);
        arm.geometry = arm.geometry.clone().translate(0.0375, 0, 0);
        arm.rotation.z = (k * TAU) / 3;
      }
    // A-ayaklar
    for (const z of [-0.33, 0.33]) {
      const s = new THREE.Shape();
      s.moveTo(-0.42, 0);
      s.lineTo(0.42, 0);
      s.lineTo(0.06, c.y + 0.06);
      s.lineTo(-0.06, c.y + 0.06);
      s.lineTo(-0.42, 0);
      const h = new THREE.Path();
      h.moveTo(-0.26, 0.08);
      h.lineTo(0.26, 0.08);
      h.lineTo(0.03, c.y - 0.1);
      h.lineTo(-0.03, c.y - 0.1);
      s.holes.push(h);
      const g = new THREE.ExtrudeGeometry(s, {depth: 0.035, bevelEnabled: false});
      add(g, paint('unwind'), c.x, 0, z - 0.0175);
      add(zCyl(0.045, 0.06), dark('unwind'), c.x, c.y, z);
    }
    add(box(0.12, 0.08, 0.1), M('unwind', {color: '#d6a336', metalness: 0.4}), c.x, c.y, -0.4); // fren
    unwind.push({piv, body, key});
  }
  // birleştirme merdanesi ve kolonu
  roller('unwind', ROLLS.M, ROLLS.M.r, 0.46, steel('unwind'), -1);

  // ---------------------------------------------------------- 2. kabartma
  const knurl = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#808080';
    x.fillRect(0, 0, 128, 128);
    x.fillStyle = '#fff';
    for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) x.fillRect(i * 8 + 2, j * 8 + 2, 4, 4);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(24, 8);
    return t;
  })();
  roller('emboss', UPPER.E1, UPPER.E1.r, 0.4, M('emboss', {color: '#bfc5cc', metalness: 0.85, roughness: 0.3, bumpMap: knurl, bumpScale: 2}), 1);
  roller('emboss', ROLLS.E2, ROLLS.E2.r, 0.4, rubber('emboss'), -1);
  roller('emboss', ROLLS.G1, ROLLS.G1.r, 0.46, steel('emboss'), -1);
  // baskı silindiri: pnömatik
  for (const z of [-0.23, 0.23]) {
    add(box(0.05, 0.16, 0.04), M('emboss', {color: '#9aa4ae', metalness: 0.6}), UPPER.E1.x, UPPER.E1.y + 0.17, z);
    add(box(0.07, 0.04, 0.05), dark('emboss'), UPPER.E1.x, UPPER.E1.y + 0.27, z);
  }

  // ---------------------------------------------------------- 3-4. baskı üniteleri
  const plates = [];
  const anilox = [];
  for (const [key, ink, pl, imp] of [
    ['print1', 1, UPPER.PL1, ROLLS.I1],
    ['print2', 2, UPPER.PL2, ROLLS.I2],
  ]) {
    roller(key, imp, imp.r, 0.46, steel(key), -1);
    const plMat = paperMaterial(2, {uInk: {value: ink}});
    hiMats.push([key, plMat]);
    // klişe silindiri: aS = yerel açı, aW = z
    const geo = zCyl(pl.r + 0.0015, L + 0.02, 160);
    const p = geo.attributes.position;
    const uvA = geo.attributes.uv;
    const aS = new Float32Array(p.count);
    const aW = new Float32Array(p.count);
    // yerel açı α = atan2(y, x) = 2π·u − π/2, dikişte sürekli (desen tekrarı tam bir çevre)
    for (let i = 0; i < p.count; i++) {
      aS[i] = TAU * uvA.getX(i) - Math.PI / 2;
      aW[i] = p.getZ(i);
    }
    geo.setAttribute('aS', new THREE.BufferAttribute(aS, 1));
    geo.setAttribute('aW', new THREE.BufferAttribute(aW, 1));
    const piv = new THREE.Group();
    piv.position.set(pl.x, pl.y, 0);
    root.add(piv);
    const plm = new THREE.Mesh(geo, plMat);
    plm.castShadow = true;
    piv.add(plm);
    add(zCyl(pl.r - 0.004, 0.42), steel(key), 0, 0, 0, piv);
    add(zCyl(0.02, 0.6), steel(key), 0, 0, 0, piv);
    plates.push({piv, mat: plMat, key, ink});
    // anilox + rakle haznesi
    const an = aniloxOf(pl);
    const inkCol = INK[ink].hex;
    const ap = roller(key, an, an.r, 0.4, M(key, {color: new THREE.Color(inkCol).lerp(new THREE.Color('#9aa0a6'), 0.45), metalness: 0.7, roughness: 0.25}), 1, false);
    anilox.push({obj: ap, r: an.r});
    const ch = new THREE.Group();
    const dir = Math.atan2(an.y - pl.y, an.x - pl.x);
    ch.position.set(an.x + Math.cos(dir) * (an.r + 0.03), an.y + Math.sin(dir) * (an.r + 0.03), 0);
    ch.rotation.z = dir;
    root.add(ch);
    add(box(0.05, 0.07, 0.4), M(key, {color: '#7d868f', metalness: 0.5}), 0, 0, 0, ch);
    add(box(0.012, 0.045, 0.38), M(key, {color: inkCol, roughness: 0.15, metalness: 0}), -0.028, 0, 0, ch);
    // mürekkep kovası ve hortum (operatör tarafı)
    const bx = pl.x + 0.12;
    add(new THREE.CylinderGeometry(0.11, 0.095, 0.26, 40), M(key, {color: '#d9dde1', metalness: 0.2}), bx, 0.13, -0.62);
    add(new THREE.CylinderGeometry(0.1, 0.1, 0.01, 40), M(key, {color: inkCol, roughness: 0.1}), bx, 0.25, -0.62);
    add(box(0.12, 0.1, 0.1), dark(key), bx + 0.18, 0.05, -0.62); // pompa
    const hose = new THREE.CatmullRomCurve3([
      new THREE.Vector3(bx, 0.24, -0.62),
      new THREE.Vector3(bx, 1.05, -0.62),
      new THREE.Vector3(an.x, 1.56, -0.42),
      new THREE.Vector3(an.x, 1.52, -0.22),
      new THREE.Vector3(ch.position.x, ch.position.y + 0.04, -0.12),
    ]);
    add(new THREE.TubeGeometry(hose, 40, 0.009, 8), M(key, {color: inkCol, roughness: 0.35, transparent: true, opacity: 0.85}));
    // ünite kapağı (kiriş) ve renk etiketi
    add(box(0.42, 0.04, 0.6), paint(key), pl.x - 0.04, WEB_Y + 0.29, -0.015);
    add(box(0.08, 0.018, 0.012), M(key, {color: inkCol}), pl.x - 0.04, WEB_Y + 0.29, 0.29);
  }
  roller('fold', ROLLS.F0, ROLLS.F0.r, 0.46, steel('fold'), -1);

  // ---------------------------------------------------------- 5. boyuna katlama (V-pulluk)
  const foldMat = M('fold', {color: '#d3d8dd', metalness: 0.8, roughness: 0.28, side: THREE.DoubleSide});
  const tri = (x0, x1, wA, wB, wEdge, y) => {
    // katlanmayan kısmın altında, katlama kenarına kadar uzanan, sona doğru daralan sac
    const s = new THREE.Shape();
    s.moveTo(x0, wA);
    s.lineTo(x0, wB);
    s.lineTo(x1, wEdge);
    s.lineTo(x0, wA);
    const g = new THREE.ShapeGeometry(s);
    g.rotateX(Math.PI / 2);
    const m = add(g, foldMat, 0, y, 0);
    m.castShadow = false;
    return m;
  };
  const F1 = STATION.fold1;
  const F2 = STATION.fold2;
  tri(F1[0] - 0.05, F1[0] + 0.55 * (F1[1] - F1[0]), -0.15, -0.002, -0.06, WEB_Y - 0.0028);
  tri(F2[0] - 0.05, F2[0] + 0.55 * (F2[1] - F2[0]), -0.075, -0.0835, -0.06, WEB_Y - 0.0045);
  // katlama burnu çubukları
  const nose = (x0, x1, z, y) => {
    const g = new THREE.CylinderGeometry(0.0035, 0.0035, x1 - x0, 12);
    g.rotateZ(Math.PI / 2);
    add(g, steel('fold'), (x0 + x1) / 2, y, z);
  };
  nose(F1[0], F1[0] + 0.5 * (F1[1] - F1[0]), 0.004, WEB_Y - 0.0045);
  nose(F2[0], F2[0] + 0.5 * (F2[1] - F2[0]), -L / 4 - 0.004, WEB_Y - 0.0065);
  // taşıyıcı kollar
  for (const x of [F1[0] + 0.1, F2[0] + 0.1]) add(box(0.025, 0.02, 0.5), dark('fold'), x, WEB_Y + 0.12, -0.03);
  for (const x of [F1[0] + 0.1, F2[0] + 0.1]) add(box(0.01, 0.12, 0.01), dark('fold'), x, WEB_Y + 0.06, -0.02);
  // çekme merdane çifti (katlı şeridi kesiciye sürer)
  roller('fold', {x: 6.82, y: WEB_Y - 0.0036 - 0.03}, 0.03, 0.2, rubber('fold'), -1);
  roller('fold', {x: 6.82, y: WEB_Y + 0.03}, 0.03, 0.2, steel('fold'), 1);

  // ---------------------------------------------------------- 6. kesici + çapraz katlama
  const kn = UPPER.K;
  const knife = new THREE.Group();
  knife.position.set(kn.x, kn.y, 0);
  root.add(knife);
  add(zCyl(kn.r - 0.006, 0.36), steel('cut'), 0, 0, 0, knife);
  add(zCyl(0.02, 0.6), steel('cut'), 0, 0, 0, knife);
  const blade = add(box(0.004, 0.016, 0.34), M('cut', {color: '#eef1f4', metalness: 0.95, roughness: 0.15}), 0, -(kn.r - 0.0044), 0, knife);
  blade.castShadow = false;
  roller('cut', {x: kn.x, y: WEB_Y - 0.0036 - 0.06}, 0.06, 0.36, M('cut', {color: '#8d969f', metalness: 0.8, roughness: 0.35}), -1);
  // vakumlu üst bantlar: kesilen peçeteyi üstten tutar, 2× hıza çıkarıp ara açar; altı serbest kalır
  const beltY = WEB_Y + 0.004;
  const vac = M('cut', {color: '#2b3138', roughness: 0.8});
  for (const z of [-0.064, -0.018]) {
    add(box(0.74, 0.008, 0.024), vac, 7.39, beltY, z);
    for (const x of [7.03, 7.75]) add(zCyl(0.012, 0.03), steel('cut'), x, beltY + 0.012, z);
  }
  add(box(0.74, 0.05, 0.08), M('cut', {color: '#6b7783', metalness: 0.3}), 7.39, beltY + 0.035, -0.041);
  for (const z of [0.06, -0.2]) add(box(0.85, 0.07, 0.012), paint('cut'), 7.5, WEB_Y + 0.085, z);
  add(box(0.03, 0.03, 0.3), dark('cut'), 7.5, WEB_Y + 0.21, -0.07);

  // ---------------------------------------------------------- 7. istifleyici
  const SX = STATION.stop - L / 4; // katlı peçetenin merkezi
  const SZ = -L / 8;
  const platform = add(box(0.22, 0.012, 0.12), dark('stack'), SX, 0, SZ);
  const rod = add(new THREE.CylinderGeometry(0.012, 0.012, 1, 12), steel('stack'), SX, 0, SZ);
  for (const [dx, dz] of [[-0.1, -0.055], [0.1, -0.055], [-0.1, 0.055 + 0.01], [0.1, 0.055 + 0.01]].slice(0, 2))
    add(box(0.008, 0.48, 0.008), steel('stack'), SX + dx, STATION.conveyor + 0.24, SZ + dz);
  const fingers = [];
  for (const dz of [-0.03, 0.03]) fingers.push(add(box(0.26, 0.004, 0.006), M('stack', {color: ACCENT}), SX, STATION.stackTop - 0.003, SZ + dz));
  // çıkış konveyörü (operatör tarafına, +z)
  add(box(0.3, 0.04, 1.4), rubber('stack'), SX, STATION.conveyor - 0.02, SZ + 0.68);
  for (const z of [SZ + 0.0, SZ + 1.38]) add(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 16).rotateZ(Math.PI / 2), steel('stack'), SX, STATION.conveyor - 0.02, z);
  for (const z of [SZ + 0.2, SZ + 1.2]) add(box(0.3, STATION.conveyor - 0.04, 0.04), paint('stack'), SX, (STATION.conveyor - 0.04) / 2, z);
  // kumanda panosu (HMI)
  add(box(0.5, 1.5, 0.35), M(null, {color: '#d7dce1', metalness: 0.2}), 5.9, 0.75, -1.0);

  // ---------------------------------------------------------- kağıt
  const main = mainPath();
  const pc = main[main.length - 1].p;
  const P = {pc, pe: pAtX(main, UPPER.E1.x), p1: pAtX(main, UPPER.PL1.x), p2: pAtX(main, UPPER.PL2.x)};
  const NW = 23;
  const webMat = paperMaterial(0, {uPc: {value: pc}, uPe: {value: P.pe}, uP1: {value: P.p1}, uP2: {value: P.p2}});
  const webGeo = gridGeometry(main.length, NW, (i) => main[i].p, (j) => -L / 2 + (L * j) / (NW - 1));
  writeRibbon(webGeo, main, NW, true);
  const web = new THREE.Mesh(webGeo, webMat);
  root.add(web);
  const plyMat = paperMaterial(0, {uPc: {value: pc}, uPe: {value: 1e3}, uP1: {value: 1e3}, uP2: {value: 1e3}});
  const plies = ['P1', 'P2'].map((key, n) => {
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), plyMat);
    mesh.position.z = n ? -0.0 : 0;
    root.add(mesh);
    return {key, mesh, R: -1};
  });
  // kesilmiş peçeteler (en fazla 3 yolda) + istif üstü + paketler
  const NU = 31;
  const NWp = 33;
  const pieceGeo = () => gridGeometry(NU, NWp, (i) => (L * i) / (NU - 1), (j) => -L / 2 + (L * j) / (NWp - 1), true);
  const pieces = [0, 1, 2].map(() => {
    const mat = paperMaterial(1);
    const mesh = new THREE.Mesh(pieceGeo(), mat);
    mesh.frustumCulled = false;
    root.add(mesh);
    hiMats.push(['cut', mat]);
    return {mesh, mat};
  });
  const stackMat = M('stack', {color: '#f6f3ec', roughness: 0.95, metalness: 0});
  const stack = add(box(L / 2, 1, L / 4), stackMat, SX, 0, SZ);
  const topMat = paperMaterial(1);
  hiMats.push(['stack', topMat]);
  const topGeo = pieceGeo();
  writePiece(topGeo, NU, NWp, STATION.stop, 0, Math.PI);
  const topNap = new THREE.Mesh(topGeo, topMat);
  root.add(topNap);
  const packs = [0, 1, 2, 3].map(() => {
    const g = new THREE.Group();
    add(box(L / 2, PACK * NAP_T, L / 4), stackMat, SX, (PACK * NAP_T) / 2, 0, g);
    const m = paperMaterial(1);
    hiMats.push(['stack', m]);
    const t = new THREE.Mesh(topGeo, m);
    t.position.set(0, PACK * NAP_T + 7 * EPS, -SZ);
    g.add(t);
    root.add(g);
    return {g, m};
  });

  const ease = (u) => {
    const k = Math.min(1, Math.max(0, u));
    return k * k * (3 - 2 * k);
  };
  const tmpC = new THREE.Color();
  const accent = new THREE.Color(ACCENT);

  // st: machineAt(...) + {reg, hi: {key: 0..1}, xray: 0..1, R1, R2}
  const update = (st) => {
    const F = st.F;
    const phi = st.phi;
    // merdaneler: yüzey hızı = bant hızı
    for (const r of rollers) r.obj.rotation.z = (r.s * F) / r.r;
    for (const u of unwind) {
      const Rn = u.key === 'P1' ? st.r1 : st.r2;
      u.body.scale.set(Rn, Rn, 1);
      u.piv.rotation.z = -(u.key === 'P1' ? st.a1 : st.a2);
    }
    const regAng = (st.reg / L) * TAU;
    for (const p of plates) {
      p.piv.rotation.z = phi + (p.ink === 2 ? regAng : 0);
      const pk = p.ink === 1 ? P.p1 : P.p2;
      p.mat.uniforms.uM0.value = -L / 4 - pk + pc + (p.ink === 2 ? -0 : 0);
    }
    for (let i = 0; i < anilox.length; i++) anilox[i].obj.rotation.z = -(phi * UPPER.PL1.r) / anilox[i].r;
    knife.rotation.z = phi;
    // bant ve kat kağıtları
    webMat.uniforms.uF.value = F;
    webMat.uniforms.uReg.value = st.reg;
    plyMat.uniforms.uF.value = F;
    for (const pl of plies) {
      const Rn = pl.key === 'P1' ? st.r1 : st.r2;
      if (Math.abs(Rn - pl.R) > 0.0015) {
        pl.R = Rn;
        const pts = plyPath(pl.key, Rn, pl.key === 'P2' ? 0.0015 : 0);
        pl.mesh.geometry.dispose();
        const g = gridGeometry(pts.length, 9, (i) => pts[i].p, (j) => -L / 2 + (L * j) / 8);
        writeRibbon(g, pts, 9, false);
        pl.mesh.geometry = g;
      }
    }
    // yoldaki peçeteler
    const turns = st.turns;
    const jMax = Math.floor(turns);
    for (let k = 0; k < 3; k++) {
      const j = jMax - k;
      const rho = turns - j;
      const pc0 = pieces[k];
      if (j < 1 || rho > DROP_END) {
        pc0.mesh.visible = false;
        continue;
      }
      const s = pieceAt(rho);
      const yTop = STATION.stackTop + 7 * EPS + 0.0005;
      const y0 = WEB_Y + (yTop - WEB_Y) * s.drop;
      writePiece(pc0.mesh.geometry, NU, NWp, s.xLead, y0, s.a3);
      pc0.mat.uniforms.uBase.value = (j - 1) * L;
      pc0.mat.uniforms.uReg.value = st.reg;
      pc0.mesh.visible = true;
    }
    // istif
    const n = st.inStack;
    const h = n * NAP_T;
    const sepOn = st.packs > 0 && n < 8;
    const platY = sepOn ? STATION.conveyor : STATION.stackTop - h;
    platform.position.y = platY - 0.006;
    rod.scale.y = Math.max(0.01, platY - 0.012);
    rod.position.y = (platY - 0.012) / 2;
    for (const f of fingers) f.visible = sepOn;
    stack.visible = n > 0;
    stack.scale.y = Math.max(1e-4, h);
    stack.position.y = STATION.stackTop - h / 2;
    topNap.visible = n > 0;
    topNap.position.y = STATION.stackTop + 7 * EPS;
    topNap.position.x = 0;
    topMat.uniforms.uBase.value = (st.done - 1) * L;
    topMat.uniforms.uReg.value = st.reg;
    // paketler
    const doneC = Math.max(0, turns - DROP_END);
    for (let k = 0; k < packs.length; k++) {
      const q = st.packs - k;
      const pk = packs[k];
      const age = doneC - q * PACK;
      if (q < 1 || age < 0) {
        pk.g.visible = false;
        continue;
      }
      const z = SZ + 0.16 * ease(age / 8) + Math.max(0, age - 8) * 0.0045;
      pk.g.visible = z < SZ + 1.32;
      pk.g.position.set(0, STATION.conveyor, z);
      pk.m.uniforms.uBase.value = (q * PACK - 1) * L;
      pk.m.uniforms.uReg.value = st.reg;
    }
    // vurgular
    for (const k of KEYS) {
      const v = st.hi?.[k] ?? 0;
      for (const m of parts[k]) {
        if (!m.userData.e0) m.userData.e0 = m.emissive.clone();
        tmpC.copy(m.userData.e0).lerp(accent, v * 0.07);
        m.emissive.copy(tmpC);
      }
    }
    for (const [k, m] of hiMats) m.uniforms.uHi.value = (st.hi?.[k] ?? 0) * 0.25;
    webMat.uniforms.uHi.value = 0;
    frameMat.opacity = 1 - 0.86 * (st.xray ?? 0);
    frameMat.depthWrite = (st.xray ?? 0) < 0.5;
    frameFront.castShadow = (st.xray ?? 0) < 0.5;
  };

  // etiket çapaları (dünya koordinatı)
  const anchors = {
    P1: [ROLLS.P1.x, ROLLS.P1.y + 0.2, 0.17],
    P2: [ROLLS.P2.x, ROLLS.P2.y + 0.2, 0.17],
    chuck: [ROLLS.P1.x, ROLLS.P1.y, 0.2],
    M: [ROLLS.M.x, ROLLS.M.y + 0.05, 0.2],
    E1: [UPPER.E1.x, UPPER.E1.y + 0.05, 0.2],
    E2: [ROLLS.E2.x, ROLLS.E2.y - 0.04, 0.2],
    PL1: [UPPER.PL1.x, UPPER.PL1.y + 0.02, 0.18],
    AN1: [aniloxOf(UPPER.PL1).x - 0.02, aniloxOf(UPPER.PL1).y + 0.03, 0.2],
    I1: [ROLLS.I1.x, ROLLS.I1.y - 0.03, 0.2],
    PL2: [UPPER.PL2.x, UPPER.PL2.y + 0.02, 0.18],
    AN2: [aniloxOf(UPPER.PL2).x - 0.02, aniloxOf(UPPER.PL2).y + 0.03, 0.2],
    I2: [ROLLS.I2.x, ROLLS.I2.y - 0.03, 0.2],
    web2: [5.0, WEB_Y, 0.1],
    F1: [(F1[0] + F1[1]) / 2, WEB_Y - 0.06, 0.08],
    F2: [(F2[0] + F2[1]) / 2, WEB_Y - 0.03, -0.06],
    K: [kn.x, kn.y + 0.03, 0.18],
    belt: [7.25, beltY + 0.06, -0.02],
    crease: [STATION.stop - L / 2, WEB_Y - 0.09, SZ],
    stack: [SX + 0.08, STATION.stackTop - 0.05, SZ + 0.04],
    conv: [SX, STATION.conveyor + 0.08, SZ + 0.6],
  };
  return {root, update, anchors, P, coverage: COVERAGE, knifeR: KNIFE_R};
}
