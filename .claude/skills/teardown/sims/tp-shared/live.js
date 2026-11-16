// Peçete makinesi, sürülebilir sayfa: istasyon düğmeleri kamerayı ve vurguyu taşır, hız ve register sürgüleri,
// ağır çekim, gövde şeffaf, etiketler, sürükleyerek döndürme ve tekerlekle yakınlaştırma. Dokunulmazsa kendi
// turunu imleçle oynar; herhangi bir tık, sürükleme, tekerlek ya da tuş kontrolü ziyaretçiye verir, 25 sn sessizlik geri alır.
import {createConsole, STATIONS} from './console.js';
import {lineAt} from './kin.js';
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
const SPEED = [100, 400];
const LENS = [15, 50];
const SLOW = 0.25;

export const VIEW = {
  overview: {tx: 5.6, ty: 0.8, tz: 0, az: 14, el: 22, d: 16.5},
  unwind: {tx: 2.0, ty: 1.05, tz: 0, az: 32, el: 16, d: 6.2},
  emboss: {tx: 4.4, ty: 1.3, tz: 0.55, az: 24, el: 14, d: 2.2},
  perf: {tx: 5.4, ty: 1.32, tz: 0.55, az: 20, el: 12, d: 2.0},
  rewind: {tx: 6.5, ty: 1.28, tz: 0.6, az: 22, el: 10, d: 1.9},
  core: {tx: 6.25, ty: 1.4, tz: 0.6, az: 30, el: 18, d: 2.1},
  seal: {tx: 7.45, ty: 1.05, tz: 0.6, az: 26, el: 16, d: 2.3},
  out: {tx: 8.9, ty: 0.95, tz: 0, az: 36, el: 22, d: 4.6},
};
const XRAY = {overview: 1, unwind: 0, emboss: 1, perf: 1, rewind: 1, core: 1, seal: 0, out: 0};

// otomatik tur: [t, eylem, değer, süre]
export const SCRIPT = [
  [0.0, 'station', 'overview'],
  [6.5, 'station', 'unwind'],
  [13, 'station', 'emboss'],
  [19, 'station', 'perf'],
  [25.5, 'station', 'rewind'],
  [26.0, 'pre', 0.8],
  [34, 'station', 'core'],
  [34.3, 'pre', 0.84],
  [42, 'station', 'seal'],
  [49.5, 'station', 'out'],
  [51, 'len', 35, 1.4],
  [57, 'len', 25, 1.2],
  [59.5, 'slow', false],
  [63, 'station', 'overview'],
  [69, 'slow', true],
];
export const DURATION = 73;

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
  document.title = 'Smart Tuvalet Kağıdı Sarma Hattı · 155 cm';
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
  let F = 250 * 25 + 3.0; // vardiyanın ortası
  let mpm = 250;
  let Llog = 25;
  const J0 = 0.62;
  let paused = false;
  let slow = true;
  let station = 'overview';
  let xray = 0;
  let xrayOn = false;
  let labelsOn = true;
  let labelsT = 0;
  let viewT = 0;
  const off = {az: 0, el: 0, k: 1};
  const cam = {...VIEW.overview, sx: 0, sy: 0};
  let ring = {t: -9, x: 0, y: 0};
  const pulse = (k) => (ring = {t: T, x: ui.spots[k][0], y: ui.spots[k][1]});
  // rulo metresi değişince sarılan log aynı oranda devam etsin (F'yi yeni log boyuna ölçekle)
  const setLen = (L) => {
    if (L === Llog) return;
    const j = Math.floor(F / Llog);
    const u = F / Llog - j;
    Llog = L;
    F = (j + u) * Llog;
  };
  const setStation = (s) => {
    station = s;
    viewT = T;
    xrayOn = !!XRAY[s];
    Object.assign(off, {az: 0, el: 0, k: 1});
  };

  // ------------------------------------------------------------ tur
  const AP = {on: true, t0: 0, last: -1};
  let lastInput = 0;
  const lenX = (v) => ui.LG.x + ((v - LENS[0]) / (LENS[1] - LENS[0])) * ui.LG.w;
  const spotOf = (ev) => {
    if (ev[1] === 'station') return ui.spots[ev[2]];
    if (ev[1] === 'slow') return ui.spots.slow;
    if (ev[1] === 'pre') return null;
    return [lenX(ev[2]), ui.LG.y + 2];
  };
  // imleç: her olaydan 1 sn önce hedefe süzülür, olayda basar; register olayında düğmeyi sürükler
  const tourCursor = (c) => {
    let prev = [800, 520];
    for (let i = 0; i < SCRIPT.length; i++) {
      const ev = SCRIPT[i];
      const t = ev[0];
      if (ev[1] === 'pre') continue;
      let target = spotOf(ev);
      let start = target;
      if (ev[1] === 'len') start = [lenX(i && SCRIPT[i - 1][1] === 'len' ? SCRIPT[i - 1][2] : 25), ui.LG.y + 2];
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
        return {x: target[0], y: target[1], press: age < 0.12, ring: ev[1] === 'len' ? 0 : r, ringX: target[0], ringY: target[1]};
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
    Llog = 25;
    mpm = 250;
    labelsOn = true;
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
  slider(ui.SP, (k) => (mpm = Math.round((SPEED[0] + k * (SPEED[1] - SPEED[0])) / 10) * 10));
  slider(ui.LG, (k) => setLen(Math.round(LENS[0] + k * (LENS[1] - LENS[0]))));
  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    if (/^[0-7]$/.test(key)) ui.btn[STATIONS[+key]].click();
    else if (key === ' ') ui.ctl.play.click();
    else if (key === 's') ui.ctl.slow.click();
    else if (key === 'g') ui.ctl.xray.click();
    else if (key === 'e') ui.ctl.labels.click();
    else if (key === 'arrowleft') setLen(Math.max(LENS[0], Llog - 1));
    else if (key === 'arrowright') setLen(Math.min(LENS[1], Llog + 1));
    else return;
    takeOver();
    e.preventDefault();
  });
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
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
  canvas.addEventListener('pointerup', endDrag);
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
  const lenAnim = {from: 25, to: 25, t0: -9, dur: 1};
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
        setLen(25);
      }
      for (const ev of SCRIPT) {
        if (!(ev[0] > AP.last && ev[0] <= c) && !(AP.last < 0 && ev[0] === 0)) continue;
        if (ev[1] === 'station') {
          setStation(ev[2]);
          pulse(ev[2]);
        } else if (ev[1] === 'slow') {
          slow = ev[2];
          pulse('slow');
        } else if (ev[1] === 'len') Object.assign(lenAnim, {from: Llog, to: ev[2], t0: T, dur: ev[3]});
        else if (ev[1] === 'pre') {
          // değişimi göstermek için logun sonuna yaklaş (aynı log içinde ileri sar)
          const j = Math.floor(F / Llog);
          if (F / Llog - j < ev[2]) F = (j + ev[2]) * Llog;
        }
      }
      if (T - lenAnim.t0 < lenAnim.dur + 0.1) setLen(Math.round(lenAnim.from + (lenAnim.to - lenAnim.from) * sm((T - lenAnim.t0) / lenAnim.dur)));
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

    // hat: beslenen kağıt
    if (!paused) F += dt * (slow ? SLOW : 1) * (mpm / 60);
    const m = lineAt(F, {mpm, Llog, J0});
    const mDisp = paused ? {...m, mpm: 0, logsMin: 0, rollsMin: 0, rollsHour: 0, kgH: 0, jRpm: 0, logRpm: 0, perfRpm: 0, embossRpm: 0, jMin: Infinity} : m;

    // vurgu, gövde, kamera
    const ke = 1 - Math.exp(-dt / 0.25);
    xray += ((xrayOn ? 1 : 0) - xray) * ke;
    const tgt = {...VIEW[station]};
    const since = T - viewT;
    tgt.az += off.az + (station === 'overview' ? 6 * Math.sin(since * 0.12) : 2.5 * Math.sin(since * 0.3));
    tgt.el = clamp(tgt.el + off.el, -25, 85);
    tgt.d *= off.k;
    const k = 1 - Math.exp(-dt / (AP.on ? 0.35 : 0.4));
    cam.az += wrap(tgt.az - cam.az) * k;
    for (const key of ['tx', 'ty', 'tz', 'el', 'd']) cam[key] += (tgt[key] - cam[key]) * k;
    st.frame({...m, J0, T, xray}, {...cam, az: cam.az * D2R, el: cam.el * D2R, sx: 0, sy: -24});

    const lab = (labelsOn ? sm((T - labelsT) / 0.4) : 1 - sm((T - labelsT) / 0.3)) * sm((since - 0.9) / 0.6);
    ui.update({
      mech: mDisp,
      station,
      lenK: (Llog - LENS[0]) / (LENS[1] - LENS[0]),
      speedK: (mpm - SPEED[0]) / (SPEED[1] - SPEED[0]),
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
      if ('F' in o) F = o.F;
      if ('pre' in o) F = (Math.floor(F / Llog) + o.pre) * Llog;
      if ('slow' in o) slow = o.slow;
      if ('paused' in o) paused = o.paused;
      if ('xray' in o) xrayOn = o.xray;
    },
  };
}
