// Kumanda konsolu, 1600 × 900 sabit yerleşim: başlık, üretim paneli, bobin paneli, istasyon kartı, katlama şeması,
// istasyon düğmeleri, kontroller, hız ve register sürgüleri, çağrı etiketleri. update(s) her kareyi durumdan çizer.
import {COVERAGE, INK} from './design.js';
import {ANILOX, L, PACK, PLATE_R, PLY, TRANSFER} from './kin.js';
import {ACCENT} from './machine.js';

export const C = {ink: '#1f262d', mute: '#7d8893', faint: '#c9d0d6', line: '#d9dfe4', panel: 'rgba(250,251,252,.94)', or: ACCENT};
export const STATIONS = ['overview', 'unwind', 'emboss', 'print1', 'print2', 'fold', 'cut', 'stack'];
export const ST_LABEL = {
  overview: 'GENEL',
  unwind: '1 · BOBİN',
  emboss: '2 · KABARTMA',
  print1: '3 · BASKI 1',
  print2: '4 · BASKI 2',
  fold: '5 · BOYUNA KAT',
  cut: '6 · KESİM + KAT',
  stack: '7 · İSTİF',
};
const fmt = (n, d = 0) => Number(n).toLocaleString('tr-TR', {minimumFractionDigits: d, maximumFractionDigits: d});

// istasyon kartları: başlık, açıklama, canlı satırlar (durumdan)
const CARD = {
  overview: {
    t: 'Peçete makinesi',
    d: 'İki bobinden gelen kağıt birleşir, kabartılır, iki renk flekso baskı alır, iki kez boyuna katlanır, 330 mm’de kesilir, ikiye katlanır ve 100’lük istif olur.',
    rows: (m) => [
      ['ÜRÜN', '33 × 33 cm · 1/8'],
      ['KATLI ÖLÇÜ', '165 × 82,5 mm'],
      ['TABAKA', `8 × ${PLY} kat = ${8 * PLY}`],
      ['KAĞIT', `${fmt(m.kgH, 0)} kg/saat`],
    ],
    a: ['P1', 'PL1', 'F1', 'stack'],
  },
  unwind: {
    t: 'Bobin açıcı',
    d: 'İki ana bobin (2 kat) pnömatik aynalarla tutulur, frenle gerilir. Bobin küçüldükçe aynı bant hızı için daha hızlı döner.',
    rows: (m) => [
      ['BOBİN ÇAPI', `${fmt(m.r1 * 2000, 0)} mm`],
      ['BOBİN DEVRİ', `${fmt(m.rollRpm, 0)} dev/dk`],
      ['KALAN', `${fmt(m.meters, 0)} m`],
      ['BİTİŞE', `${fmt(m.minutesLeft, 1)} dk`],
    ],
    a: ['P1', 'P2', 'M'],
  },
  emboss: {
    t: 'Kabartma (embossing)',
    d: 'Desenli çelik merdane kağıdı kauçuk merdaneye bastırır. Kabartma iki katı birbirine kilitler ve peçeteye hacim verir.',
    rows: (m) => [
      ['ÇELİK MERDANE', `Ø ${fmt(180)} mm`],
      ['DEVİR', `${fmt((m.v * 60) / (Math.PI * 0.18), 0)} dev/dk`],
      ['NOKTA ARALIĞI', '2,8 mm'],
      ['BANT HIZI', `${fmt(m.webMin, 0)} m/dk`],
    ],
    a: ['E1', 'E2'],
  },
  print1: {
    t: `Baskı 1 · ${INK[1].name}`,
    d: 'Hazneden gelen mürekkep anilox merdanenin hücrelerine dolar, rakle fazlasını sıyırır, kauçuk klişe alır ve kağıda basar.',
    rows: (m) => [
      ['KLİŞE SİLİNDİRİ', `Ø ${fmt(PLATE_R * 2000, 1)} mm`],
      ['ÇEVRE = TEKRAR', `${fmt(L * 1000, 0)} mm`],
      ['KAPLAMA', `% ${fmt(COVERAGE[1] * 100, 1)}`],
      ['MÜREKKEP', `${fmt(inkGmin(m, 1), 1)} g/dk`],
    ],
    a: ['PL1', 'AN1', 'I1'],
  },
  print2: {
    t: `Baskı 2 · ${INK[2].name}`,
    d: 'İkinci renk aynı tekrarla basılır. Register ayarı klişe silindirini döndürür; kayma, kırmızı baklavanın lacivert halkadan kaçmasıyla görünür.',
    rows: (m, s) => [
      ['REGISTER', `${s.reg >= 0 ? '+' : ''}${fmt(s.reg * 1000, 1)} mm`],
      ['FAZ', `${fmt((s.reg / L) * 360, 1)}°`],
      ['KAPLAMA', `% ${fmt(COVERAGE[2] * 100, 1)}`],
      ['MÜREKKEP', `${fmt(inkGmin(m, 2), 1)} g/dk`],
    ],
    a: ['PL2', 'AN2', 'I2'],
  },
  fold: {
    t: 'Boyuna katlama',
    d: 'Katlama sacları bandı hareket halindeyken katlar: önce ortadan (330 → 165 mm), sonra yine ortadan (165 → 82,5 mm). Baskılı panel üstte kalır.',
    rows: (m) => [
      ['1. KAT', '330 → 165 mm'],
      ['2. KAT', '165 → 82,5 mm'],
      ['TABAKA', `4 × ${PLY} = ${4 * PLY}`],
      ['BANT HIZI', `${fmt(m.webMin, 0)} m/dk`],
    ],
    a: ['F1', 'F2'],
  },
  cut: {
    t: 'Kesim + çapraz katlama',
    d: 'Bıçak merdanesi her turda bir kez keser (çevre 330 mm). Vakumlu bant peçeteyi 2× hıza çıkarıp ara açar, arka yarı alta katlanır.',
    rows: (m) => [
      ['KESİM', `${fmt(m.rpm, 0)} /dk`],
      ['BIÇAK DEVRİ', `${fmt(m.rpm, 0)} dev/dk`],
      ['ÇAPRAZ KAT', '330 → 165 mm'],
      ['KESİLEN', fmt(m.cut, 0)],
    ],
    a: ['K', 'belt', 'crease'],
  },
  stack: {
    t: 'İstifleme',
    d: 'Asansör tablası her peçetede bir kalınlık iner, istif üstü sabit kalır. 100 olunca paket konveyöre itilir.',
    rows: (m) => [
      ['İSTİFTE', `${m.inStack} / ${PACK}`],
      ['PAKET', fmt(m.packs, 0)],
      ['PAKET / DK', fmt(m.rpm / PACK, 1)],
      ['TOPLAM', fmt(m.done, 0)],
    ],
    a: ['stack', 'conv'],
  },
};
// mürekkep g/dk: alan hızı × kaplama × anilox hacmi × aktarım (yoğunluk ~1 g/cm³)
export const inkGmin = (m, c) => m.webMin * L * COVERAGE[c] * ANILOX * TRANSFER;

const LABEL = {
  P1: ['ANA BOBİN 1', 'Ø 1000 mm · 76 mm mandrel'],
  P2: ['ANA BOBİN 2', '2. kat'],
  M: ['BİRLEŞTİRME', '2 kat tek bant'],
  E1: ['ÇELİK DESEN MERDANESİ', 'Ø 180 mm'],
  E2: ['KAUÇUK KARŞI MERDANE', 'Shore 60'],
  PL1: ['KLİŞE SİLİNDİRİ', 'Ø 105,0 · çevre 330'],
  AN1: ['ANİLOKS + RAKLE', `${ANILOX} cm³/m²`],
  I1: ['BASKI MERDANESİ', 'çelik'],
  PL2: ['KLİŞE SİLİNDİRİ 2', 'register ayarlı'],
  AN2: ['ANİLOKS + RAKLE', `${ANILOX} cm³/m²`],
  I2: ['BASKI MERDANESİ', 'çelik'],
  F1: ['1. KATLAMA SACI', '330 → 165'],
  F2: ['2. KATLAMA SACI', '165 → 82,5'],
  K: ['BIÇAK MERDANESİ', '1 bıçak · çevre 330'],
  belt: ['VAKUMLU BANT', '2× hız'],
  crease: ['ÇAPRAZ KATLAMA', 'arka yarı alta'],
  stack: ['İSTİF ASANSÖRÜ', '100’lük'],
  conv: ['ÇIKIŞ KONVEYÖRÜ', 'paket'],
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
.call{position:absolute;white-space:nowrap;padding:5px 8px;background:rgba(255,255,255,.9);border-radius:3px;border:1px solid ${C.line}}
.call b{display:flex;align-items:center;gap:6px;font:700 9.6px 'JetBrains Mono',monospace;letter-spacing:1.2px;color:${C.ink}}
.call b i{display:block;width:6px;height:6px;background:${C.or}}
.call span{display:block;font:500 8.4px 'JetBrains Mono',monospace;letter-spacing:1px;color:${C.mute};margin-top:2px}
.track{position:absolute;height:4px;background:${C.line};border-radius:2px}
.track i{position:absolute;left:0;top:0;bottom:0;background:${C.or};border-radius:2px}
.knob{position:absolute;width:14px;height:14px;margin:-5px 0 0 -7px;border-radius:50%;background:#fff;border:2px solid ${C.or};top:0}
.cur{position:absolute;left:0;top:0;z-index:50;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))}
.ring{position:absolute;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:1.5px solid ${C.or};opacity:0;z-index:49}
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
  add(`<svg style="position:absolute;left:30px;top:22px" width="58" height="44"><g fill="none" stroke="#fff" stroke-width="2.4"><path d="M4 6h50v32H4z"/><path d="M4 6l25 16 25-16"/><path d="M29 22v16"/></g></svg>`);
  add(`<div class="sm" style="position:absolute;left:140px;top:18px;letter-spacing:2.4px">TISSUE CONVERTING · 33 × 33 CM</div>`);
  add(`<div style="position:absolute;left:139px;top:32px;font-size:31px;font-weight:700;letter-spacing:-.6px;line-height:1">Peçete Makinesi <span style="color:${C.or};font-weight:400">/</span> <span style="font-weight:500">1/8 Garson Katlama</span></div>`);
  add(`<div class="mo" style="position:absolute;left:140px;top:70px;font-size:11px;letter-spacing:2px;color:#56616c">2 RENK FLEKSO BASKI · KABARTMA · 2 KAT · 100’LÜK İSTİF</div>`);
  const inkChips = [1, 2].map((c, i) =>
    add(`<div style="position:absolute;left:${1180 + i * 205}px;top:28px;display:flex;align-items:center;gap:10px"><div style="width:30px;height:30px;border-radius:50%;background:${INK[c].hex}"></div><div><div class="sm">RENK ${c} · ${INK[c].pantone}</div><div style="font-weight:700;font-size:15px;margin-top:2px">${INK[c].name}</div></div></div>`),
  );
  void inkChips;

  // ------------------------------------------------------------ 01 üretim
  panel(24, 110, 286, 262, 'ÜRETİM', '01');
  const big = add(`<div style="position:absolute;left:38px;top:140px;font-size:46px;font-weight:700;letter-spacing:-1.5px"></div>`);
  add(`<div class="sm" style="position:absolute;left:40px;top:194px">ADET / DAKİKA · ANA MİL DEV/DK</div>`);
  const prod = kvRows(38, 222, 258, 4, 36);

  // ------------------------------------------------------------ 02 bobin
  panel(24, 384, 286, 176, 'BOBİN · 2 KAT', '02');
  const rollSvg = add(`<svg style="position:absolute;left:38px;top:418px" width="80" height="80"></svg>`);
  const roll = kvRows(132, 420, 164, 3, 40);

  // ------------------------------------------------------------ 03 istasyon kartı
  panel(1290, 110, 286, 330, 'İSTASYON', '03');
  const cTitle = add(`<div style="position:absolute;left:1304px;top:140px;font-size:20px;font-weight:700;letter-spacing:-.3px;width:260px"></div>`);
  const cDesc = add(`<div style="position:absolute;left:1304px;top:172px;width:258px;font-size:12px;line-height:1.5;color:#46515c"></div>`);
  const card = kvRows(1304, 272, 258, 4, 40);

  // ------------------------------------------------------------ 04 katlama şeması
  panel(1290, 452, 286, 222, 'KATLAMA SIRASI', '04');
  const foldSvg = add(`<svg style="position:absolute;left:1304px;top:484px" width="258" height="180"></svg>`);

  // ------------------------------------------------------------ alt bar: istasyonlar ve kontroller
  add(`<div class="cp" style="left:24px;top:776px;width:1552px;height:100px"></div>`);
  add(`<div class="sm" style="position:absolute;left:40px;top:788px">İSTASYONLAR · 1–7 · 0 GENEL</div>`);
  const btn = {};
  let bx = 40;
  for (const s of STATIONS) {
    const w = s === 'overview' ? 70 : 118;
    btn[s] = add(`<div class="bt st" style="left:${bx}px;top:806px;width:${w}px">${ST_LABEL[s]}</div>`);
    bx += w + 6;
  }
  const spots = {};
  for (const s of STATIONS) spots[s] = [parseFloat(btn[s].style.left) + parseFloat(btn[s].style.width) / 2, 820];
  add(`<div class="sm" style="position:absolute;left:40px;top:846px">KONTROL · BOŞLUK DURDUR · G GÖVDE · E ETİKET · S AĞIR ÇEKİM</div>`);
  const ctl = {};
  [['play', '❚❚ DURDUR', 1000], ['slow', 'AĞIR ÇEKİM', 1084], ['xray', 'GÖVDE ŞEFFAF', 1180], ['labels', 'ETİKETLER', 1290]].forEach(([k, t, x]) => {
    ctl[k] = add(`<div class="bt" style="left:${x}px;top:806px">${t}</div>`);
  });
  for (const k of Object.keys(ctl)) spots[k] = [parseFloat(ctl[k].style.left) + 40, 820];
  // sürgüler
  add(`<div class="sm" style="position:absolute;left:1390px;top:790px">HIZ · ADET/DK</div>`);
  const spdV = add(`<div class="mo" style="position:absolute;left:1500px;top:788px;font-size:11px;font-weight:700;width:60px;text-align:right"></div>`);
  const SP = {x: 1392, w: 168, y: 812};
  const spT = add(`<div class="track" style="left:${SP.x}px;top:${SP.y}px;width:${SP.w}px"><i></i><div class="knob"></div></div>`);
  add(`<div class="sm" style="position:absolute;left:1390px;top:834px">REGISTER · RENK 2</div>`);
  const regV = add(`<div class="mo" style="position:absolute;left:1500px;top:832px;font-size:11px;font-weight:700;width:60px;text-align:right"></div>`);
  const RG = {x: 1392, w: 168, y: 856};
  const rgT = add(`<div class="track" style="left:${RG.x}px;top:${RG.y}px;width:${RG.w}px"><i></i><div class="knob"></div></div>`);
  add(`<div style="position:absolute;left:${RG.x + RG.w / 2}px;top:${RG.y - 4}px;width:1px;height:12px;background:${C.mute}"></div>`);

  // ------------------------------------------------------------ etiketler ve imleç
  const callSvg = add(`<svg style="position:absolute;left:0;top:0;overflow:visible" width="1600" height="900"></svg>`);
  const calls = Array.from({length: 4}, () => add(`<div class="call" style="display:none"><b><i></i><em style="font-style:normal"></em></b><span></span></div>`));
  const ring = add(`<div class="ring"></div>`);
  const cur = add(`<svg class="cur" width="22" height="26" viewBox="0 0 22 26"><path d="M2 2l16 11-7 1.5 4 8-3 1.4-4-8L3 21z" fill="#fff" stroke="#1f262d" stroke-width="1.5" stroke-linejoin="round"/></svg>`);

  // katlama şeması: 4 adım, ölçekli dikdörtgenler; etkin adım vurgulu
  const foldSteps = (active) => {
    const k = 0.17;
    const steps = [
      ['AÇIK', 330, 330, '330 × 330'],
      ['1. KAT', 330, 165, '× 165'],
      ['2. KAT', 330, 82.5, '× 82,5'],
      ['ÇAPRAZ', 165, 82.5, '165 × 82,5'],
    ];
    let h = '';
    let x = 4;
    steps.forEach(([n, a, b, t], i) => {
      const w = b * k + 0.5;
      const hh = a * k;
      const on = i === active;
      h += `<rect x="${x}" y="${12 + (56 - hh) + 40}" width="${w}" height="${hh}" fill="${on ? '#fff4ec' : '#fff'}" stroke="${on ? C.or : C.faint}" stroke-width="${on ? 1.6 : 1}"/>`;
      if (i === 3) h += `<circle cx="${x + w / 2}" cy="${12 + (56 - hh) + 40 + hh / 2}" r="5.5" fill="none" stroke="${INK[2].hex}" stroke-width="1.6"/><rect x="${x + w / 2 - 2}" y="${12 + (56 - hh) + 40 + hh / 2 - 2}" width="4" height="4" transform="rotate(45 ${x + w / 2} ${12 + (56 - hh) + 40 + hh / 2})" fill="${INK[1].hex}"/>`;
      h += `<text x="${x}" y="22" font-family="JetBrains Mono" font-size="8.5" letter-spacing="1" fill="${on ? C.or : C.mute}" font-weight="700">${n}</text>`;
      h += `<text x="${x}" y="164" font-family="JetBrains Mono" font-size="8.2" fill="${C.ink}">${t}</text>`;
      x += Math.max(w, 34) + 22;
    });
    h += `<text x="4" y="178" font-family="JetBrains Mono" font-size="8" fill="${C.mute}" letter-spacing="1">ÖLÇEK 1:6 · KATLI KALINLIK ${8 * PLY} TABAKA</text>`;
    return h;
  };
  let lastFold = -2;

  let roundTick = -1;
  const update = (s) => {
    const m = s.mech;
    big.innerHTML = `${fmt(m.rpm, 0)}<span style="font-size:15px;font-weight:600;color:${C.mute};letter-spacing:0"> /dk</span>`;
    [
      ['BANT HIZI', `${fmt(m.webMin, 0)} m/dk`],
      ['KESİLEN · İSTİFTE', `${fmt(m.cut, 0)} · ${m.inStack}`],
      ['PAKET (100’LÜK)', fmt(m.packs, 0)],
      ['GÖRÜNTÜ', s.slow ? 'AĞIR ÇEKİM × 0,1' : 'GERÇEK HIZ'],
    ].forEach(([k, v], i) => {
      prod[i].k.textContent = k;
      prod[i].v.textContent = v;
    });
    // bobin: çap halkası
    const rr = (m.r1 / 0.5) * 36;
    rollSvg.innerHTML = `<circle cx="40" cy="40" r="37" fill="none" stroke="${C.line}" stroke-dasharray="2 3"/><circle cx="40" cy="40" r="${rr}" fill="#f3f0e8" stroke="${C.mute}"/><circle cx="40" cy="40" r="${(0.038 / 0.5) * 36}" fill="#9c7a52"/><line x1="40" y1="40" x2="${40 + Math.cos(-m.a1) * rr}" y2="${40 + Math.sin(-m.a1) * rr}" stroke="${C.or}" stroke-width="2"/>`;
    [
      ['ÇAP', `${fmt(m.r1 * 2000, 0)} mm`],
      ['DEVİR', `${fmt(m.rollRpm, 0)} /dk`],
      ['KALAN', `${fmt(m.minutesLeft, 1)} dk`],
    ].forEach(([k, v], i) => {
      roll[i].k.textContent = k;
      roll[i].v.textContent = v;
    });
    // kart
    const cd = CARD[s.station];
    if (cTitle.textContent !== cd.t) {
      cTitle.textContent = cd.t;
      cDesc.textContent = cd.d;
    }
    cd.rows(m, s).forEach(([k, v], i) => {
      card[i].k.textContent = k;
      card[i].v.textContent = v;
    });
    const fa = {fold: 2, cut: 3, stack: 3, overview: -1}[s.station] ?? 0;
    if (fa !== lastFold) {
      lastFold = fa;
      foldSvg.innerHTML = foldSteps(fa);
    }
    for (const k of STATIONS) btn[k].classList.toggle('on', k === s.station);
    ctl.play.textContent = s.paused ? '▶ ÇALIŞTIR' : '❚❚ DURDUR';
    ctl.slow.classList.toggle('on', s.slow);
    ctl.xray.classList.toggle('on', s.xray > 0.5);
    ctl.labels.classList.toggle('on', s.labelsOn);
    const sk = s.speedK;
    spT.firstElementChild.style.width = `${sk * SP.w}px`;
    spT.lastElementChild.style.left = `${sk * SP.w}px`;
    spdV.textContent = fmt(m.rpm, 0);
    const rk = s.regK;
    rgT.firstElementChild.style.left = `${Math.min(rk, 0.5) * RG.w}px`;
    rgT.firstElementChild.style.width = `${Math.abs(rk - 0.5) * RG.w}px`;
    rgT.lastElementChild.style.left = `${rk * RG.w}px`;
    regV.textContent = `${s.reg >= 0 ? '+' : ''}${fmt(s.reg * 1000, 1)} mm`;
    // etiketler
    let lines = '';
    const keys = cd.a;
    const placed = [];
    for (let i = 0; i < calls.length; i++) {
      const c = calls[i];
      const k = keys[i];
      const p = k && s.labels > 0.01 ? s.project(k) : null;
      if (!p || p[0] < 330 || p[0] > 1270 || p[1] < 100 || p[1] > 760) {
        c.style.display = 'none';
        continue;
      }
      // etiketi parçanın yukarı-sağına, üst üste binmeyecek şekilde
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
    // imleç
    const cu = s.cursor;
    cur.style.transform = `translate(${cu.x - 2}px,${cu.y - 2}px) scale(${cu.press ? 0.86 : 1})`;
    cur.style.display = cu.x < -50 ? 'none' : 'block';
    ring.style.opacity = cu.ring;
    ring.style.transform = `translate(${cu.ringX}px,${cu.ringY}px) scale(${1 + (1 - cu.ring) * 0.8})`;
    void roundTick;
  };
  return {root: ui, update, btn, ctl, spots, SP, RG};
}
