// Logsaw, sürülebilir sayfa: istasyon düğmeleri kamerayı ve vurguyu taşır, kesim hızı ve rulo boyu sürgüleri,
// ağır çekim, kabin şeffaf, etiketler, sürükleyerek döndürme ve tekerlekle yakınlaştırma. Dokunulmazsa kendi
// turunu imleçle oynar; herhangi bir tık, sürükleme, tekerlek ya da tuş kontrolü ziyaretçiye verir, 25 sn sessizlik geri alır.
import {createConsole, STATIONS} from './console.js';
import {KEYS} from './machine.js';
import {BLADE_R0, bladeRpm, FEED, GRIND_EVERY, GRIND_WEAR, machineAt} from './kin.js';
import * as THREE from 'three';
import {createStage, BG} from './stage.js';

const W = 1600;
const H = 900;
const IDLE = 25;
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sm = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
const SPEED = [40, 200];
const LRS = [0.15, 0.35];
const SLOW = 0.2;

export const VIEW = {
  overview: {tx: -1.5, ty: 0.9, tz: 0, az: 24, el: 22, d: 11.2},
  infeed: {tx: -1.6, ty: 0.95, tz: 0, az: 38, el: 20, d: 3.6},
  clamp: {tx: -0.08, ty: 1.08, tz: 0, az: -48, el: 16, d: 1.9},
  head: {tx: 0.05, ty: 1.25, tz: 0, az: -62, el: 8, d: 3.0},
  grind: {tx: 0.0, ty: 1.3, tz: 0, az: -70, el: 10, d: 2.1},
  trim: {tx: 0.1, ty: 0.68, tz: 0, az: -24, el: 30, d: 2.5},
  outfeed: {tx: 1.6, ty: 0.9, tz: 0, az: 34, el: 22, d: 3.6},
};
const XRAY = {overview: 0, infeed: 0, clamp: 1, head: 1, grind: 1, trim: 1, outfeed: 0};
const HI = {infeed: 'infeed', clamp: 'clamp', head: 'head', grind: 'grind', trim: 'trim', outfeed: 'outfeed'};

// otomatik tur: [t, eylem, değer, süre]
export const SCRIPT = [
  [0.0, 'station', 'overview'],
  [7, 'station', 'infeed'],
  [14, 'station', 'clamp'],
  [21.5, 'station', 'head'],
  [29, 'station', 'grind'],
  [37, 'station', 'trim'],
  [45, 'station', 'outfeed'],
  [48, 'lr', 0.28, 1.4],
  [55, 'lr', 0.23, 1.2],
  [24.5, 'section', true],
  [28.4, 'section', false],
  [58.5, 'slow', false],
  [62, 'station', 'overview'],
  [63.2, 'explode', true],
  [68.6, 'explode', false],
  [69.6, 'slow', true],
];
export const DURATION = 72;

const CSS = `
html,body{background:${BG};overflow:hidden}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
#gl{touch-action:none;cursor:grab}
#gl.drag{cursor:grabbing}
.call{left:0;top:0}
.hit{position:absolute;pointer-events:auto;cursor:ew-resize}
.tourchip{position:absolute;left:800px;top:100px;transform:translateX(-50%);display:flex;align-items:center;gap:7px;height:24px;padding:0 12px;border:1px solid #d9dfe4;border-radius:4px;background:rgba(250,251,252,.95);color:#1f262d;font:700 9.4px 'JetBrains Mono',monospace;letter-spacing:1.3px;white-space:nowrap;cursor:pointer;pointer-events:auto}
.tourchip i{display:block;width:6px;height:6px;border-radius:50%;background:#e8590c}
.tourchip.on i{animation:blink 1.2s steps(2) infinite}
@keyframes blink{50%{opacity:.15}}
.turn{position:fixed;left:0;right:0;bottom:18px;text-align:center;font:600 12px/1.4 'JetBrains Mono',monospace;letter-spacing:1px;color:#7d8893;text-transform:uppercase;display:none}
@media (orientation:portrait) and (max-width:820px){.turn{display:block}}
`;

export function runLive() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  document.title = 'Logsaw · Ø200 × 1700 Kağıt Havlu Log Kesme';
  const app = document.getElementById('app');
  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  app.appendChild(canvas);
  const st = createStage({canvas});
  const ui = createConsole(app);

  // ------------------------------------------------------------ kalite kademeleri
  const TIERS = [
    {shadow: 4096, pr: 2},
    {shadow: 2048, pr: 1.5},
    {shadow: 1024, pr: 1},
  ];
  const light = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
  let tier = light ? 2 : 0;
  let scale = 1;
  const fit = () => {
    scale = Math.min(innerWidth / W, innerHeight / H);
    app.style.transform = `translate(${(innerWidth - W * scale) / 2}px, ${(innerHeight - H * scale) / 2}px) scale(${scale})`;
    st.resize(W, H, clamp((devicePixelRatio || 1) * scale, 0.75, TIERS[tier].pr));
  };
  const applyTier = () => {
    st.setQuality(TIERS[tier]);
    fit();
  };
  applyTier();
  addEventListener('resize', fit);
  const toStage = (cx, cy) => {
    const r = app.getBoundingClientRect();
    return [(cx - r.left) / scale, (cy - r.top) / scale];
  };
  const tourChip = document.createElement('div');
  tourChip.className = 'tourchip';
  ui.root.appendChild(tourChip);
  const note = document.createElement('div');
  note.className = 'turn';
  note.textContent = 'Tam konsol için telefonu yan çevirin';
  document.body.appendChild(note);

  // ------------------------------------------------------------ durum
  let T = 0;
  let theta = 2 * Math.PI * 12007.05; // vardiyanın ortası: 1500 log kesilmiş
  let cpm = 80;
  let Lr = 0.23;
  let bladeAngle = 0;
  let grindPhase = 0;
  let paused = false;
  let slow = true;
  let station = 'overview';
  let xray = 0;
  let xrayOn = false;
  let labelsOn = true;
  let labelsT = 0;
  let sectionOn = false;
  let section = 0;
  let explodeOn = false;
  let explode = 0;
  let pausedBefore = false;
  let focus = null; // {key, c: [x, y, z], d}
  let focusKey = null;
  let focusK = 0;
  const setExplode = (on) => {
    if (on === explodeOn) return;
    explodeOn = on;
    if (on) {
      pausedBefore = paused;
      paused = true;
    } else paused = pausedBefore;
  };
  let viewT = 0;
  const hi = Object.fromEntries(KEYS.map((k) => [k, 0]));
  const off = {az: 0, el: 0, k: 1};
  const cam = {...VIEW.overview, sx: 0, sy: 0};
  let ring = {t: -9, x: 0, y: 0};
  const pulse = (k) => (ring = {t: T, x: ui.spots[k][0], y: ui.spots[k][1]});
  const setStation = (s) => {
    station = s;
    viewT = T;
    xrayOn = !!XRAY[s];
    focus = null;
    Object.assign(off, {az: 0, el: 0, k: 1});
    // bileme istasyonu açılınca sıradaki turda bileme yap (her 40 kesimin sayacı buradan başlar)
    if (s === 'grind') grindPhase = Math.floor(theta / (2 * Math.PI)) + (theta / (2 * Math.PI) % 1 < 0.3 ? 0 : 1);
  };

  // ------------------------------------------------------------ tur
  const AP = {on: true, t0: 0, last: -1};
  let lastInput = 0;
  const lrX = (v) => ui.LR.x + ((v - LRS[0]) / (LRS[1] - LRS[0])) * ui.LR.w;
  const spotOf = (ev) => {
    if (ev[1] === 'station') return ui.spots[ev[2]];
    if (ui.spots[ev[1]]) return ui.spots[ev[1]];
    return [lrX(ev[2]), ui.LR.y + 2];
  };
  // imleç: her olaydan 1 sn önce hedefe süzülür, olayda basar; register olayında düğmeyi sürükler
  const tourCursor = (c) => {
    let prev = [800, 520];
    for (let i = 0; i < SCRIPT.length; i++) {
      const ev = SCRIPT[i];
      const t = ev[0];
      let target = spotOf(ev);
      let start = target;
      if (ev[1] === 'lr') start = [lrX(i && SCRIPT[i - 1][1] === 'lr' ? SCRIPT[i - 1][2] : 0.23), ui.LR.y + 2];
      if (c < t - 1.1) break;
      if (c < t) {
        const k = sm((c - (t - 1.1)) / 0.9);
        return {x: prev[0] + (start[0] - prev[0]) * k, y: prev[1] + (start[1] - prev[1]) * k, press: c > t - 0.15, ring: 0, ringX: 0, ringY: 0};
      }
      const dur = ev[3] || 0;
      if (c < t + dur) {
        const k = sm((c - t) / dur);
        return {x: start[0] + (target[0] - start[0]) * k, y: start[1], press: true, ring: 0, ringX: 0, ringY: 0};
      }
      const age = c - t - dur;
      if (age < 0.6) {
        const r = Math.max(0, 1 - age / 0.55);
        prev = target;
        return {x: target[0], y: target[1], press: age < 0.12, ring: ev[1] === 'lr' ? 0 : r, ringX: target[0], ringY: target[1]};
      }
      prev = target;
    }
    return {x: prev[0], y: prev[1], press: false, ring: 0, ringX: 0, ringY: 0};
  };
  const startTour = () => {
    AP.on = true;
    AP.t0 = T;
    AP.last = -1;
    paused = false;
    slow = true;
    Lr = 0.23;
    cpm = 80;
    labelsOn = true;
    sectionOn = false;
    explodeOn = false;
    focus = null;
  };
  const takeOver = () => {
    lastInput = T;
    AP.on = false;
  };
  tourChip.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    lastInput = T;
    if (AP.on) takeOver();
    else startTour();
  });
  addEventListener('pointerdown', (e) => {
    if (e.target !== tourChip) takeOver();
  });

  // ------------------------------------------------------------ kontroller
  for (const s of STATIONS)
    ui.btn[s].addEventListener('click', () => {
      takeOver();
      pulse(s);
      setStation(s);
    });
  const toggles = {
    play: () => (paused = !paused),
    slow: () => (slow = !slow),
    xray: () => (xrayOn = !xrayOn),
    section: () => {
      sectionOn = !sectionOn;
      if (sectionOn) xrayOn = true;
    },
    explode: () => {
      setExplode(!explodeOn);
      if (explodeOn) xrayOn = true;
    },
    labels: () => {
      labelsOn = !labelsOn;
      labelsT = T;
    },
  };
  for (const [k, f] of Object.entries(toggles))
    ui.ctl[k].addEventListener('click', () => {
      takeOver();
      pulse(k);
      f();
    });
  const slider = ({x, w, y}, apply) => {
    const d = document.createElement('div');
    d.className = 'hit';
    Object.assign(d.style, {left: `${x - 10}px`, top: `${y - 12}px`, width: `${w + 20}px`, height: '26px'});
    const move = (e) => {
      const [sx] = toStage(e.clientX, e.clientY);
      apply(clamp((sx - x) / w, 0, 1));
      lastInput = T;
    };
    d.addEventListener('pointerdown', (e) => {
      takeOver();
      const up = () => {
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
      };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
      move(e);
    });
    ui.root.appendChild(d);
  };
  slider(ui.SP, (k) => (cpm = Math.round((SPEED[0] + k * (SPEED[1] - SPEED[0])) / 5) * 5));
  slider(ui.LR, (k) => (Lr = Math.round((LRS[0] + k * (LRS[1] - LRS[0])) * 200) / 200));
  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    if (/^[0-6]$/.test(key)) ui.btn[STATIONS[+key]].click();
    else if (key === ' ') ui.ctl.play.click();
    else if (key === 's') ui.ctl.slow.click();
    else if (key === 'g') ui.ctl.xray.click();
    else if (key === 'e') ui.ctl.labels.click();
    else if (key === 'k') ui.ctl.section.click();
    else if (key === 'x') ui.ctl.explode.click();
    else if (key === 'escape') focus = null;
    else if (key === 'arrowleft') Lr = Math.max(LRS[0], Lr - 0.005);
    else if (key === 'arrowright') Lr = Math.min(LRS[1], Lr + 0.005);
    else return;
    takeOver();
    e.preventDefault();
  });
  let drag = null;
  // parçaya tıklama: sürüklemeden bırakılan tıkta ışın at, ilk görünür parçayı odakla
  const ray = new THREE.Raycaster();
  let down0 = null;
  const pick = (e) => {
    const r = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, st.camera);
    const vis = st.mc.pickables.filter((o) => {
      for (let p = o; p; p = p.parent) if (!p.visible) return false;
      return true;
    });
    const hit = ray.intersectObjects(vis, false).find((h) => [].concat(h.object.material).some((m) => m.opacity > 0.35));
    if (!hit) {
      focus = null;
      return;
    }
    const key = hit.object.userData.part;
    const b = key === 'roll' ? new THREE.Box3().setFromObject(hit.object) : st.mc.partBox(key);
    const c = b.getCenter(new THREE.Vector3());
    const size = b.getSize(new THREE.Vector3()).length();
    focus = {key, c: [c.x, c.y, c.z], d: Math.min(4.5, Math.max(0.7, size * 2.4))};
    focusKey = key;
  };
  canvas.addEventListener('pointerdown', (e) => {
    down0 = {x: e.clientX, y: e.clientY};
    drag = {x: e.clientX, y: e.clientY};
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('drag');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    off.az -= ((e.clientX - drag.x) / scale) * 0.3;
    off.el = clamp(off.el + ((e.clientY - drag.y) / scale) * 0.2, -30, 60);
    drag = {x: e.clientX, y: e.clientY};
    lastInput = T;
  });
  const endDrag = () => {
    drag = null;
    canvas.classList.remove('drag');
  };
  canvas.addEventListener('pointerup', (e) => {
    if (down0 && Math.hypot(e.clientX - down0.x, e.clientY - down0.y) < 6) pick(e);
    down0 = null;
    endDrag();
  });
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      takeOver();
      off.k = clamp(off.k * Math.exp(e.deltaY * 0.0012), 0.35, 2.6);
    },
    {passive: false},
  );

  // ------------------------------------------------------------ kare
  const lrAnim = {from: 0.23, to: 0.23, t0: -9, dur: 1};
  startTour();
  let last = performance.now();
  const perf = {n: 0, sum: 0, slow: 0, age: 0};
  const frame = (now) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    T += dt;
    if (tier < TIERS.length - 1) {
      perf.age += dt;
      if (perf.age > 0.8) {
        perf.sum += dt;
        perf.n++;
        if (perf.sum >= 0.5 && perf.n >= 6) {
          perf.slow = perf.sum / perf.n > 0.024 ? perf.slow + 1 : 0;
          perf.sum = 0;
          perf.n = 0;
          if (perf.slow >= 2) {
            tier++;
            applyTier();
            Object.assign(perf, {age: 0, slow: 0});
          }
        }
      }
    }

    let cursor;
    if (AP.on) {
      const c = (T - AP.t0) % DURATION;
      if (c < AP.last) {
        // yeni tur
        slow = true;
        Lr = 0.23;
        sectionOn = false;
        setExplode(false);
      }
      for (const ev of SCRIPT) {
        if (!(ev[0] > AP.last && ev[0] <= c) && !(AP.last < 0 && ev[0] === 0)) continue;
        if (ev[1] === 'station') {
          setStation(ev[2]);
          pulse(ev[2]);
        } else if (ev[1] === 'slow') {
          slow = ev[2];
          pulse('slow');
        } else if (ev[1] === 'section') {
          sectionOn = ev[2];
          pulse('section');
        } else if (ev[1] === 'explode') {
          setExplode(ev[2]);
          if (ev[2]) xrayOn = true;
          pulse('explode');
        } else if (ev[1] === 'lr') Object.assign(lrAnim, {from: Lr, to: ev[2], t0: T, dur: ev[3]});
      }
      if (T - lrAnim.t0 < lrAnim.dur + 0.1) Lr = Math.round((lrAnim.from + (lrAnim.to - lrAnim.from) * sm((T - lrAnim.t0) / lrAnim.dur)) * 200) / 200;
      AP.last = c;
      cursor = tourCursor(c);
      if (c < 0.8 && T - AP.t0 > DURATION) {
        const end = tourCursor(DURATION - 0.01);
        const k = sm(c / 0.8);
        cursor = {...cursor, x: end.x + (cursor.x - end.x) * k, y: end.y + (cursor.y - end.y) * k};
      }
    } else {
      if (T - lastInput > IDLE) startTour();
      const rk = Math.max(0, 1 - (T - ring.t) / 0.55);
      cursor = {x: -99, y: -99, press: false, ring: rk, ringX: ring.x, ringY: ring.y};
    }

    // kafa yörüngesi ve bıçak
    const rate = paused ? 0 : dt * (slow ? SLOW : 1);
    theta += rate * (cpm / 60) * 2 * Math.PI;
    bladeAngle += rate * (bladeRpm(cpm) / 60) * 2 * Math.PI;
    bladeAngle %= 2 * Math.PI;
    const kNow = Math.floor(theta / (2 * Math.PI));
    const bladeR = BLADE_R0 - GRIND_WEAR * Math.floor(kNow / GRIND_EVERY);
    const m = machineAt(theta, {cpm, Lr, bladeR, grindPhase});
    const mDisp = paused ? {...m, cpm: 0, rollsMin: 0, rollsHour: 0, logsMin: 0} : m;
    const psi = m.psi;
    const clampOpen = psi > FEED[0] - 0.2 && psi < FEED[1] + 0.1 ? 1 : 0;

    // vurgu, gövde, kamera
    const ke = 1 - Math.exp(-dt / 0.25);
    for (const k of KEYS) hi[k] += ((HI[station] === k ? 0.5 + 0.5 * Math.sin(T * 3.2) * 0.4 + 0.3 : 0) - hi[k]) * ke;
    xray += ((xrayOn ? 1 : 0) - xray) * ke;
    const ke2 = 1 - Math.exp(-dt / 0.35);
    section += ((sectionOn ? 1 : 0) - section) * ke2;
    explode += ((explodeOn ? 1 : 0) - explode) * ke2;
    focusK += ((focus ? 1 : 0) - focusK) * ke2;
    if (!focus && focusK < 0.01) focusKey = null;
    const tgt = {...VIEW[station]};
    const since = T - viewT;
    tgt.az += off.az + (station === 'overview' ? 6 * Math.sin(since * 0.12) : 2.5 * Math.sin(since * 0.3));
    tgt.el = clamp(tgt.el + off.el, -25, 85);
    tgt.d *= off.k;
    if (focus) {
      [tgt.tx, tgt.ty, tgt.tz] = focus.c;
      tgt.d = focus.d * off.k;
    } else if (section > 0.01 || explode > 0.01) {
      // kesit / patlatma: dişli kutusuna akış tarafından, operatör yanından bak
      const v = {tx: 0.36, ty: 1.48, tz: 0, az: 38, el: 14, d: 2.5};
      const k2 = Math.max(section, explode);
      for (const key of ['tx', 'ty', 'tz', 'el']) tgt[key] += (v[key] - tgt[key]) * k2;
      tgt.d += (v.d * off.k - tgt.d) * k2;
      tgt.az += (((((v.az + off.az - tgt.az) % 360) + 540) % 360) - 180) * k2;
    }
    const k = 1 - Math.exp(-dt / (AP.on ? 0.35 : 0.4));
    cam.az += wrap(tgt.az - cam.az) * k;
    for (const key of ['tx', 'ty', 'tz', 'el', 'd']) cam[key] += (tgt[key] - cam[key]) * k;
    st.frame({...m, Lr, bladeAngle, T, hi, xray, section, explode, focusKey, focusK}, {...cam, az: cam.az * D2R, el: cam.el * D2R, sx: 0, sy: -24});

    const lab = (labelsOn ? sm((T - labelsT) / 0.4) : 1 - sm((T - labelsT) / 0.3)) * sm((since - 0.9) / 0.6);
    ui.update({
      mech: mDisp,
      station,
      clampOpen,
      part: focus?.key ?? null,
      sectionOn,
      explodeOn,
      bladeAngle,
      lrK: (Lr - LRS[0]) / (LRS[1] - LRS[0]),
      speedK: (cpm - SPEED[0]) / (SPEED[1] - SPEED[0]),
      slow,
      paused,
      xray,
      labelsOn,
      labels: lab,
      project: (key) => st.project(st.mc.anchors[key]),
      cursor,
    });
    if (tourChip.classList.contains('on') !== AP.on || !tourChip.firstChild) {
      tourChip.classList.toggle('on', AP.on);
      tourChip.innerHTML = AP.on ? '<i></i>OTOMATİK TUR · KONTROL İÇİN TIKLAYIN' : '▶ TURU SÜRDÜR';
    }
    if (!window.SIM_SHOWN) {
      window.SIM_SHOWN = true;
      dispatchEvent(new Event('simframe'));
    }
    requestAnimationFrame(frame);
  };
  st.renderer.compileAsync(st.scene, st.camera).then(() => requestAnimationFrame(frame));
  window.LIVE = {
    st,
    cam,
    startTour,
    takeOver,
    setStation,
    snap: () => Object.assign(cam, VIEW[station]),
    get T() {
      return T;
    },
    set: (o) => {
      if ('theta' in o) theta = o.theta;
      if ('section' in o) sectionOn = o.section;
      if ('explode' in o) setExplode(o.explode);
      if ('focus' in o) {
        const b = st.mc.partBox(o.focus);
        const c = b.getCenter(new THREE.Vector3());
        focus = {key: o.focus, c: [c.x, c.y, c.z], d: Math.min(4.5, Math.max(0.7, b.getSize(new THREE.Vector3()).length() * 2.4))};
        focusKey = o.focus;
      }
      if ('Lr' in o) Lr = o.Lr;
      if ('slow' in o) slow = o.slow;
      if ('paused' in o) paused = o.paused;
      if ('xray' in o) xrayOn = o.xray;
    },
  };
}
