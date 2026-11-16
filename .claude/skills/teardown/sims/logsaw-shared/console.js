// Logsaw konsolu, 1600 × 900: başlık, üretim, bıçak, istasyon kartı, canlı kesim planı, istasyon düğmeleri,
// kontroller, kesim hızı ve rulo boyu sürgüleri, çağrı etiketleri.
import {BLADE_R0, BLADE_RMIN, GRIND_EVERY, GRIND_WEAR, LOG_D, LOG_L, ORBIT_E, SHEET} from './kin.js';
import {ACCENT} from './machine.js';

export const C = {ink: '#1f262d', mute: '#7d8893', faint: '#c9d0d6', line: '#d9dfe4', panel: 'rgba(250,251,252,.94)', or: ACCENT};
export const STATIONS = ['overview', 'infeed', 'clamp', 'head', 'grind', 'trim', 'outfeed'];
export const ST_LABEL = {
  overview: 'GENEL',
  infeed: '1 · BESLEME',
  clamp: '2 · BASKI PAPUCU',
  head: '3 · ORBİTAL KAFA',
  grind: '4 · BİLEME',
  trim: '5 · FİRE',
  outfeed: '6 · ÇIKIŞ',
};
const fmt = (n, d = 0) => (Number.isFinite(n) ? Number(n).toLocaleString('tr-TR', {minimumFractionDigits: d, maximumFractionDigits: d}) : '—');
const mm = (m, d = 0) => `${fmt(m * 1000, d)} mm`;
const lifeH = (m) => (((m.bladeR - BLADE_RMIN) / GRIND_WEAR) * GRIND_EVERY) / Math.max(1, m.cpm) / 60;

const CARD = {
  overview: {
    t: 'Orbital log kesme',
    d: 'Sarma makinesinden gelen 1700 mm kağıt havlu logu, bir yandan kendi ekseninde dönen, bir yandan yörüngede gezen bıçakla rulolara bölünür.',
    rows: (m) => [
      ['LOG', `Ø ${fmt(LOG_D * 1000)} × ${fmt(LOG_L * 1000)} mm`],
      ['RULO BOYU', mm(m.plan.Lr)],
      ['RULO / LOG', `${m.plan.n} + 2 fire`],
      ['FİRE', `% ${fmt(m.plan.waste * 100, 1)}`],
    ],
    a: ['lane', 'blade', 'flap', 'out'],
  },
  infeed: {
    t: 'Besleme',
    d: 'Log V-kanalda yatar, iki tahrik bandı onu bıçak logun dışındayken tam bir rulo boyu ileri iter. Bıçak loga girerken log durur.',
    rows: (m) => [
      ['ADIM', mm(m.step)],
      ['BESLEME SÜRESİ', `${fmt(m.feedTime * 1000)} ms`],
      ['ORT. ADIM HIZI', `${fmt(m.feedSpeed, 2)} m/s`],
      ['LOG / DK', fmt(m.logsMin, 1)],
    ],
    a: ['lane', 'belts'],
  },
  clamp: {
    t: 'Baskı papucu',
    d: 'Bıçak girmeden papuç inip logu kanala bastırır, kesim düz ve ezilmeden olur. Besleme başlarken kalkar.',
    rows: (m, s) => [
      ['DURUM', s.clampOpen > 0.5 ? 'AÇIK · BESLEME' : 'KAPALI · KESİM'],
      ['KESİM DERİNLİĞİ', `% ${fmt(m.depth * 100)}`],
      ['KAFA AÇISI', `${fmt(((m.psi * 180) / Math.PI + 180) % 360 - 180)}°`],
      ['KESİM SÜRESİ', `${fmt(m.cutTime * 1000)} ms`],
    ],
    a: ['clamp', 'blade'],
  },
  head: {
    t: 'Orbital kafa',
    d: 'Bıçak kendi milinde döner, kol onu 200 mm eksantrikle yörüngede gezdirir. Kesim hızı arttıkça bıçak devri de artar (+7,5 dev/dk her kesim/dk için).',
    rows: (m) => [
      ['KAFA DEVRİ', `${fmt(m.cpm)} dev/dk`],
      ['BIÇAK DEVRİ', `${fmt(m.bladeRpm)} dev/dk`],
      ['ÇEVRE HIZI', `${fmt(m.bladeV, 1)} m/s`],
      ['KESİMDE KENAR YOLU', `${fmt(m.edgePerCut, 1)} m`],
    ],
    a: ['blade', 'arm'],
  },
  grind: {
    t: 'Bileme',
    d: `Koldaki iki taş, her ${GRIND_EVERY} kesimde bıçağın iki yüzünü bileyler. Taşlar bıçağın loga hiç girmeyen iç kenarındadır. Bıçak küçülür; Ø ${fmt(BLADE_RMIN * 2000)} altında değişir.`,
    rows: (m) => [
      ['BIÇAK ÇAPI', `${fmt(m.bladeR * 2000, 2)} mm`],
      ['SONRAKİ BİLEME', `${m.nextGrind} kesim`],
      ['BİLEME BAŞI AŞINMA', `${fmt(GRIND_WEAR * 2000, 2)} mm`],
      ['BIÇAK ÖMRÜ', `${fmt(lifeH(m), 0)} saat`],
    ],
    a: ['grind', 'blade'],
  },
  trim: {
    t: 'Fire atma',
    d: 'Her logun ilk ve son kesimi uçlardaki düzensiz kısmı ayırır. Kapak açılır, fireler hazneye düşer, rulolar banda geçer.',
    rows: (m) => [
      ['FİRE / UÇ', mm(m.plan.trim, 1)],
      ['FİRE ORANI', `% ${fmt(m.plan.waste * 100, 1)}`],
      ['FİRE', `${fmt(m.logsMin * 60 * 2 * m.plan.trim * (m.roll.kg / m.plan.Lr), 0)} kg/saat`],
      ['KESİLEN LOG', fmt(m.logs)],
    ],
    a: ['flap', 'bin'],
  },
  outfeed: {
    t: 'Çıkış',
    d: 'Ayrılan rulo hızlı banda geçer, arkadakiyle arası açılır ve paketleme makinesine akar.',
    rows: (m) => [
      ['RULO / DK', fmt(m.rollsMin, 1)],
      ['RULO KÜTLESİ', `${fmt(m.roll.kg, 2)} kg`],
      ['KAĞIT / RULO', `${fmt(m.roll.meters, 0)} m`],
      ['YAPRAK', `${fmt(m.roll.sheets)} × ${fmt(SHEET * 1000)} mm`],
    ],
    a: ['out', 'pack'],
  },
};

const LABEL = {
  lane: ['V-KANAL', 'log yatağı'],
  belts: ['TAHRİK BANTLARI', 'adım besleme'],
  clamp: ['BASKI PAPUCU', 'pnömatik'],
  blade: ['DAİRESEL BIÇAK', `Ø ${fmt(BLADE_R0 * 2000)} · devir kesim hızına bağlı`],
  arm: ['YÖRÜNGE KOLU', 'e = 200 mm'],
  grind: ['BİLEME TAŞLARI', 'iki yüz'],
  flap: ['FİRE KAPAĞI', 'kesimden sonra açılır'],
  bin: ['FİRE HAZNESİ', 'geri dönüşüm'],
  out: ['ÇIKIŞ BANDI', 'ara açar'],
  pack: ['PAKETLEME', 'giriş'],
};

const CSS = `
#app{font-family:Inter,system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;inset:0;pointer-events:none}
.mo{font-family:'JetBrains Mono',ui-monospace,monospace}
.cp{position:absolute;background:${C.panel};border:1px solid ${C.line};border-radius:6px;box-shadow:0 2px 12px rgba(40,60,80,.07)}
.ph{position:absolute;display:flex;align-items:center;gap:9px;font:700 10.5px 'JetBrains Mono',monospace;letter-spacing:1.8px}
.ph i{display:block;width:3px;height:13px;background:${C.or}}
.sm{font:500 9px 'JetBrains Mono',monospace;letter-spacing:1.5px;color:${C.mute};text-transform:uppercase;white-space:nowrap}
.kv{position:absolute;display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid ${C.line};padding-bottom:5px}
.kv b{font:600 17px Inter;letter-spacing:-.2px}
.bt{position:absolute;height:28px;padding:0 11px;display:flex;align-items:center;justify-content:center;border:1px solid ${C.faint};border-radius:4px;background:#fff;font:700 9.6px 'JetBrains Mono',monospace;letter-spacing:1.2px;color:${C.ink};white-space:nowrap;pointer-events:auto;cursor:pointer}
.bt:hover{border-color:${C.mute}}
.bt.on{background:${C.ink};color:#fff;border-color:${C.ink}}
.bt.st.on{background:${C.or};border-color:${C.or}}
.call{position:absolute;left:0;top:0;white-space:nowrap;padding:5px 8px;background:rgba(255,255,255,.9);border-radius:3px;border:1px solid ${C.line}}
.call b{display:flex;align-items:center;gap:6px;font:700 9.6px 'JetBrains Mono',monospace;letter-spacing:1.2px;color:${C.ink}}
.call b i{display:block;width:6px;height:6px;background:${C.or}}
.call span{display:block;font:500 8.4px 'JetBrains Mono',monospace;letter-spacing:1px;color:${C.mute};margin-top:2px}
.track{position:absolute;height:4px;background:${C.line};border-radius:2px}
.track i{position:absolute;left:0;top:0;bottom:0;background:${C.or};border-radius:2px}
.knob{position:absolute;width:14px;height:14px;margin:-5px 0 0 -7px;border-radius:50%;background:#fff;border:2px solid ${C.or};top:0}
.cur{position:absolute;left:0;top:0;z-index:50;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))}
.ring{position:absolute;left:0;top:0;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:1.5px solid ${C.or};opacity:0;z-index:49}
`;
const el = (h) => {
  const d = document.createElement('div');
  d.innerHTML = h.trim();
  return d.firstElementChild;
};

export function createConsole(app) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const ui = el(`<div class="ui"></div>`);
  app.appendChild(ui);
  const add = (h) => {
    const n = el(h);
    ui.appendChild(n);
    return n;
  };
  const panel = (x, y, w, h, title, n) => {
    add(`<div class="cp" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></div>`);
    add(`<div class="ph" style="left:${x + 14}px;top:${y + 13}px"><i></i>${title}</div>`);
    add(`<div class="sm" style="position:absolute;right:${1600 - x - w + 14}px;top:${y + 15}px">${n}</div>`);
  };
  const kvRows = (x, y, w, n, gap = 40) =>
    Array.from({length: n}, (_, i) => {
      const r = add(`<div class="kv" style="left:${x}px;top:${y + i * gap}px;width:${w}px"><span class="sm"></span><b></b></div>`);
      return {k: r.children[0], v: r.children[1]};
    });

  // ------------------------------------------------------------ başlık
  add(`<div style="position:absolute;left:0;top:0;width:118px;height:86px;background:${C.or}"></div>`);
  add(`<svg style="position:absolute;left:30px;top:20px" width="58" height="48"><g fill="none" stroke="#fff" stroke-width="2.4"><circle cx="29" cy="24" r="20"/><circle cx="29" cy="24" r="4"/><path d="M29 4v10M29 34v10M9 24h10M39 24h10"/></g></svg>`);
  add(`<div class="sm" style="position:absolute;left:140px;top:18px;letter-spacing:2.4px">TISSUE CONVERTING · KAĞIT HAVLU</div>`);
  add(`<div style="position:absolute;left:139px;top:32px;font-size:31px;font-weight:700;letter-spacing:-.6px;line-height:1">Log Kesme Makinesi <span style="color:${C.or};font-weight:400">/</span> <span style="font-weight:500">Orbital Logsaw</span></div>`);
  add(`<div class="mo" style="position:absolute;left:140px;top:70px;font-size:11px;letter-spacing:2px;color:#56616c">LOG Ø 200 × 1700 MM · TEK HAT · DAİRESEL BIÇAK · OTOMATİK BİLEME</div>`);
  [['LOG ÇAPI', 'Ø 200 mm'], ['LOG BOYU', '1700 mm']].forEach(([k, v], i) =>
    add(`<div style="position:absolute;left:${1210 + i * 190}px;top:28px"><div class="sm">${k}</div><div style="font-weight:700;font-size:20px;margin-top:3px">${v}</div></div>`),
  );

  // ------------------------------------------------------------ 01 üretim
  panel(24, 110, 286, 262, 'ÜRETİM', '01');
  const big = add(`<div style="position:absolute;left:38px;top:140px;font-size:46px;font-weight:700;letter-spacing:-1.5px"></div>`);
  add(`<div class="sm" style="position:absolute;left:40px;top:194px">KESİM / DAKİKA · KAFA DEV/DK</div>`);
  const prod = kvRows(38, 222, 258, 4, 36);

  // ------------------------------------------------------------ 02 bıçak
  panel(24, 384, 286, 176, 'BIÇAK', '02');
  const bladeSvg = add(`<svg style="position:absolute;left:38px;top:418px" width="80" height="80"></svg>`);
  const bl = kvRows(132, 420, 164, 3, 40);

  // ------------------------------------------------------------ 03 istasyon kartı
  panel(1290, 110, 286, 330, 'İSTASYON', '03');
  const cTitle = add(`<div style="position:absolute;left:1304px;top:140px;font-size:20px;font-weight:700;letter-spacing:-.3px;width:260px"></div>`);
  const cDesc = add(`<div style="position:absolute;left:1304px;top:172px;width:258px;font-size:12px;line-height:1.5;color:#46515c"></div>`);
  const card = kvRows(1304, 272, 258, 4, 40);

  // ------------------------------------------------------------ 04 kesim planı
  panel(1290, 452, 286, 222, 'KESİM PLANI · 1 LOG', '04');
  const planSvg = add(`<svg style="position:absolute;left:1304px;top:484px" width="258" height="180"></svg>`);

  // ------------------------------------------------------------ alt bar
  add(`<div class="cp" style="left:24px;top:776px;width:1552px;height:100px"></div>`);
  add(`<div class="sm" style="position:absolute;left:40px;top:788px">İSTASYONLAR · 1–6 · 0 GENEL</div>`);
  const btn = {};
  let bx = 40;
  for (const s of STATIONS) {
    const w = s === 'overview' ? 70 : 132;
    btn[s] = add(`<div class="bt st" style="left:${bx}px;top:806px;width:${w}px">${ST_LABEL[s]}</div>`);
    bx += w + 6;
  }
  const spots = {};
  for (const s of STATIONS) spots[s] = [parseFloat(btn[s].style.left) + parseFloat(btn[s].style.width) / 2, 820];
  add(`<div class="sm" style="position:absolute;left:40px;top:846px">KONTROL · BOŞLUK DURDUR · G KABİN · E ETİKET · S AĞIR ÇEKİM</div>`);
  const ctl = {};
  [['play', '❚❚ DURDUR', 1000], ['slow', 'AĞIR ÇEKİM', 1084], ['xray', 'KABİN ŞEFFAF', 1180], ['labels', 'ETİKETLER', 1290]].forEach(([k, t, x]) => {
    ctl[k] = add(`<div class="bt" style="left:${x}px;top:806px">${t}</div>`);
  });
  for (const k of Object.keys(ctl)) spots[k] = [parseFloat(ctl[k].style.left) + 40, 820];
  add(`<div class="sm" style="position:absolute;left:1390px;top:790px">KESİM / DK</div>`);
  const spdV = add(`<div class="mo" style="position:absolute;left:1500px;top:788px;font-size:11px;font-weight:700;width:60px;text-align:right"></div>`);
  const SP = {x: 1392, w: 168, y: 812};
  const spT = add(`<div class="track" style="left:${SP.x}px;top:${SP.y}px;width:${SP.w}px"><i></i><div class="knob"></div></div>`);
  add(`<div class="sm" style="position:absolute;left:1390px;top:834px">RULO BOYU</div>`);
  const lrV = add(`<div class="mo" style="position:absolute;left:1480px;top:832px;font-size:11px;font-weight:700;width:80px;text-align:right"></div>`);
  const LR = {x: 1392, w: 168, y: 856};
  const lrT = add(`<div class="track" style="left:${LR.x}px;top:${LR.y}px;width:${LR.w}px"><i></i><div class="knob"></div></div>`);

  const callSvg = add(`<svg style="position:absolute;left:0;top:0;overflow:visible" width="1600" height="900"></svg>`);
  const calls = Array.from({length: 4}, () => add(`<div class="call" style="display:none"><b><i></i><em style="font-style:normal"></em></b><span></span></div>`));
  const ring = add(`<div class="ring"></div>`);
  const cur = add(`<svg class="cur" width="22" height="26" viewBox="0 0 22 26"><path d="M2 2l16 11-7 1.5 4 8-3 1.4-4-8L3 21z" fill="#fff" stroke="#1f262d" stroke-width="1.5" stroke-linejoin="round"/></svg>`);

  // kesim planı: log şeridi, fireler, rulolar; sıradaki kesim vurgulu, kesilmiş kısım soluk
  const planDraw = (m) => {
    const p = m.plan;
    const W = 250;
    const k = W / LOG_L;
    const y = 40;
    const h = 44;
    const ci = ((m.k % p.cuts) + p.cuts) % p.cuts; // logdaki kesim sırası (0 = baş firesi)
    const doneIn = m.psi >= Math.PI * 0.47 ? ci + 1 : ci; // bu kesim bitti mi (yaklaşık)
    let s = `<text x="0" y="18" font-family="JetBrains Mono" font-size="8.5" fill="${C.mute}" letter-spacing="1">${p.n} × ${fmt(p.Lr * 1000)} + 2 × ${fmt(p.trim * 1000, 1)} mm</text>`;
    const xs = [0, p.trim];
    for (let i = 1; i <= p.n; i++) xs.push(p.trim + i * p.Lr);
    xs.push(LOG_L);
    for (let i = 0; i < xs.length - 1; i++) {
      const a = xs[i] * k + 4;
      const w = (xs[i + 1] - xs[i]) * k;
      const trim = i === 0 || i === xs.length - 2;
      const cut = i < doneIn;
      s += `<rect x="${a}" y="${y}" width="${Math.max(1, w - 1)}" height="${h}" rx="2" fill="${trim ? '#f3e2c4' : cut ? '#eef1f3' : '#fbfaf5'}" stroke="${trim ? '#d6a336' : C.faint}"/>`;
    }
    for (let i = 1; i < xs.length - 1; i++) {
      const x = xs[i] * k + 4;
      const on = i - 1 === ci;
      s += `<line x1="${x}" y1="${y - 8}" x2="${x}" y2="${y + h + 8}" stroke="${on ? C.or : C.ink}" stroke-width="${on ? 2.4 : 1}" ${i - 1 < doneIn && !on ? 'opacity=".35"' : ''}/>`;
    }
    const cx = xs[ci + 1] * k + 4;
    s += `<text x="${Math.min(200, Math.max(0, cx - 22))}" y="${y + h + 22}" font-family="JetBrains Mono" font-size="9" font-weight="700" fill="${C.or}">KESİM ${ci + 1}/${p.cuts}</text>`;
    s += `<rect x="4" y="${y + h + 40}" width="${m.depth * 120}" height="6" fill="${C.or}"/><rect x="4" y="${y + h + 40}" width="120" height="6" fill="none" stroke="${C.faint}"/>`;
    s += `<text x="132" y="${y + h + 46}" font-family="JetBrains Mono" font-size="8.5" fill="${C.mute}" letter-spacing="1">DERİNLİK % ${fmt(m.depth * 100)}</text>`;
    s += `<text x="4" y="176" font-family="JetBrains Mono" font-size="8" fill="${C.mute}" letter-spacing="1">BEJ: FİRE · ÇİZGİ: KESİM YERİ</text>`;
    return s;
  };

  const update = (s) => {
    const m = s.mech;
    big.innerHTML = `${fmt(m.cpm)}<span style="font-size:15px;font-weight:600;color:${C.mute};letter-spacing:0"> /dk</span>`;
    [
      ['RULO / DK', fmt(m.rollsMin, 1)],
      ['RULO / SAAT', fmt(m.rollsHour)],
      ['KESİLEN LOG · RULO', `${fmt(m.logs)} · ${fmt(m.rolls)}`],
      ['GÖRÜNTÜ', s.slow ? 'AĞIR ÇEKİM × 0,2' : 'GERÇEK HIZ'],
    ].forEach(([k, v], i) => {
      prod[i].k.textContent = k;
      prod[i].v.textContent = v;
    });
    const rr = (m.bladeR / BLADE_R0) * 36;
    const rm = (BLADE_RMIN / BLADE_R0) * 36;
    const a = s.bladeAngle;
    bladeSvg.innerHTML = `<circle cx="40" cy="40" r="${rr}" fill="#e6eaee" stroke="${C.mute}"/><circle cx="40" cy="40" r="${rm}" fill="none" stroke="${C.or}" stroke-dasharray="2 2"/><circle cx="40" cy="40" r="6" fill="#2f353c"/><line x1="${40 + Math.cos(a) * 10}" y1="${40 + Math.sin(a) * 10}" x2="${40 + Math.cos(a) * rr}" y2="${40 + Math.sin(a) * rr}" stroke="#5c656e" stroke-width="2"/>${m.grinding ? `<circle cx="40" cy="${40 - rr}" r="5" fill="${C.or}"/>` : ''}`;
    [
      ['ÇAP', `${fmt(m.bladeR * 2000, 1)} mm`],
      ['DEVİR', `${fmt(m.bladeRpm)} /dk`],
      ['BİLEMEYE', m.grinding ? 'BİLENİYOR' : `${m.nextGrind} kesim`],
    ].forEach(([k, v], i) => {
      bl[i].k.textContent = k;
      bl[i].v.textContent = v;
    });
    const cd = CARD[s.station];
    if (cTitle.textContent !== cd.t) {
      cTitle.textContent = cd.t;
      cDesc.textContent = cd.d;
    }
    cd.rows(m, s).forEach(([k, v], i) => {
      card[i].k.textContent = k;
      card[i].v.textContent = v;
    });
    planSvg.innerHTML = planDraw(m);
    for (const k of STATIONS) btn[k].classList.toggle('on', k === s.station);
    ctl.play.textContent = s.paused ? '▶ ÇALIŞTIR' : '❚❚ DURDUR';
    ctl.slow.classList.toggle('on', s.slow);
    ctl.xray.classList.toggle('on', s.xray > 0.5);
    ctl.labels.classList.toggle('on', s.labelsOn);
    spT.firstElementChild.style.width = `${s.speedK * SP.w}px`;
    spT.lastElementChild.style.left = `${s.speedK * SP.w}px`;
    spdV.textContent = fmt(m.cpm);
    lrT.firstElementChild.style.width = `${s.lrK * LR.w}px`;
    lrT.lastElementChild.style.left = `${s.lrK * LR.w}px`;
    lrV.textContent = mm(m.plan.Lr);
    let lines = '';
    const placed = [];
    for (let i = 0; i < calls.length; i++) {
      const c = calls[i];
      const k = cd.a[i];
      const p = k && s.labels > 0.01 ? s.project(k) : null;
      if (!p || p[0] < 330 || p[0] > 1270 || p[1] < 100 || p[1] > 760) {
        c.style.display = 'none';
        continue;
      }
      let lx = p[0] + 46;
      let ly = p[1] - 70;
      for (const q of placed) if (Math.abs(q[0] - lx) < 190 && Math.abs(q[1] - ly) < 44) ly = q[1] - 48;
      if (ly < 108) ly = p[1] + 40;
      if (lx > 1110) lx = p[0] - 210;
      placed.push([lx, ly]);
      c.style.display = 'block';
      c.style.opacity = s.labels;
      c.style.transform = `translate(${lx}px,${ly}px)`;
      c.querySelector('em').textContent = LABEL[k][0];
      c.querySelector('span').textContent = LABEL[k][1];
      lines += `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="${C.or}" opacity="${s.labels}"/><path d="M${p[0]} ${p[1]}L${lx} ${ly + 14}" stroke="${C.ink}" stroke-width="1" fill="none" opacity="${0.7 * s.labels}"/>`;
    }
    callSvg.innerHTML = lines;
    const cu = s.cursor;
    cur.style.transform = `translate(${cu.x - 2}px,${cu.y - 2}px) scale(${cu.press ? 0.86 : 1})`;
    cur.style.display = cu.x < -50 ? 'none' : 'block';
    ring.style.opacity = cu.ring;
    ring.style.transform = `translate(${cu.ringX}px,${cu.ringY}px) scale(${1 + (1 - cu.ring) * 0.8})`;
  };
  return {root: ui, update, btn, ctl, spots, SP, LR};
}
