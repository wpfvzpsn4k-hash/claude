// Sarma hattı konsolu, 1600 × 900: başlık, üretim, jumbo, istasyon kartı, log sarım göstergesi, düğmeler, sürgüler.
import {CORE_R, GSM, L_CAL, PERF_N, PERF_R, PLY, ROLL_W, ROLLS_PER_LOG, SHEET, TRIM, UPPER, WIDTH} from './kin.js';
import {ACCENT} from './machine.js';

export const C = {ink: '#1f262d', mute: '#7d8893', faint: '#c9d0d6', line: '#d9dfe4', panel: 'rgba(250,251,252,.94)', or: ACCENT};
export const STATIONS = ['overview', 'unwind', 'emboss', 'perf', 'rewind', 'core', 'seal', 'out'];
export const ST_LABEL = {
  overview: 'GENEL',
  unwind: '1 · JUMBO',
  emboss: '2 · KABARTMA',
  perf: '3 · PERFORASYON',
  rewind: '4 · SARICI',
  core: '5 · MASURA',
  seal: '6 · KUYRUK',
  out: '7 · ÇIKIŞ',
};
const fmt = (n, d = 0) => (Number.isFinite(n) ? Number(n).toLocaleString('tr-TR', {minimumFractionDigits: d, maximumFractionDigits: d}) : '—');
const mm = (m, d = 0) => `${fmt(m * 1000, d)} mm`;

const CARD = {
  overview: {
    t: 'Tuvalet kağıdı sarma hattı',
    d: '1550 mm enindeki iki jumbo bobin tek banda birleşir, kabartılır, delinir ve masuraya log olarak sarılır. Kuyruğu yapıştırılan log, rulolara kesilmek üzere logsaw’a gider.',
    rows: (m) => [
      ['ÇALIŞMA ENİ', mm(WIDTH)],
      ['LOG', `Ø ${fmt(m.rollD * 1000)} × ${fmt(WIDTH * 1000)} mm`],
      ['RULO / LOG', `${ROLLS_PER_LOG} × ${fmt(ROLL_W * 1000)} mm`],
      ['KAĞIT', `${fmt(m.kgH)} kg/saat`],
    ],
    a: ['J1', 'E1', 'PF', 'log'],
  },
  unwind: {
    t: 'Jumbo açıcı',
    d: 'İki jumbo bobin (2 kat) pnömatik aynalarla tutulur, frenle gerilir; kağıtlar birleştirme merdanesinde üst üste gelir. Bobin küçüldükçe devri artar.',
    rows: (m) => [
      ['JUMBO ÇAPI', mm(m.jR * 2)],
      ['DEVİR', `${fmt(m.jRpm)} dev/dk`],
      ['KALAN', `${fmt(m.jMeters)} m`],
      ['BİTİŞE', `${fmt(m.jMin, 1)} dk`],
    ],
    a: ['J1', 'J2', 'M'],
  },
  emboss: {
    t: 'Kabartma',
    d: 'Desenli çelik merdane iki katı kauçuk merdaneye bastırır: katlar birbirine kilitlenir, kağıt yumuşar ve hacim kazanır.',
    rows: (m) => [
      ['ÇELİK MERDANE', mm(UPPER.E1.r * 2)],
      ['DEVİR', `${fmt(m.embossRpm)} dev/dk`],
      ['DESEN', '25 mm motif + nokta'],
      ['BANT HIZI', `${fmt(m.mpm)} m/dk`],
    ],
    a: ['E1', 'E2'],
  },
  perf: {
    t: 'Perforasyon',
    d: `Silindirdeki ${PERF_N} bıçak sabit karşı bıçağa (örs) değerek kağıdı her ${fmt(SHEET * 1000)} mm’de bir enine deler. Silindir çevresi tam ${PERF_N} yaprak.`,
    rows: (m) => [
      ['SİLİNDİR', `Ø ${fmt(PERF_R * 2000)} mm`],
      ['DEVİR', `${fmt(m.perfRpm)} dev/dk`],
      ['DELİK / DK', fmt(m.mpm / SHEET)],
      ['YAPRAK', mm(SHEET)],
    ],
    a: ['PF', 'anvil', 'web'],
  },
  rewind: {
    t: 'Yüzey sarıcı',
    d: 'Log iki alt merdanenin üstünde, üst bastırma merdanesinin altında döner; üç merdane yüzeyden sürer. Log büyüdükçe yükselir, devri düşer.',
    rows: (m, s) => [
      ['LOG ÇAPI', mm(m.Rl * 2, 1)],
      ['SARILAN', `${fmt(m.Lw, 1)} / ${fmt(m.Llog)} m`],
      ['LOG DEVRİ', `${fmt(m.logRpm)} dev/dk`],
      ['LOG SÜRESİ', `${fmt(m.logTime, 1)} sn`],
    ],
    a: ['log', 'W1', 'rider'],
  },
  core: {
    t: 'Masura besleme',
    d: 'Masuralar tutkal hattından geçip oluğa dizilir. Log dolunca bant koparılır, sıradaki tutkallı masura beşiğe iner ve kağıdı yakalar.',
    rows: (m) => [
      ['MASURA', `Ø ${fmt(CORE_R * 2000)} × ${fmt(WIDTH * 1000)}`],
      ['MASURA / DK', fmt(m.logsMin, 1)],
      ['TUTKAL', '2 hat'],
      ['DEĞİŞİM', `${fmt(m.logTime * 50)} ms`],
    ],
    a: ['chute', 'glue', 'log'],
  },
  seal: {
    t: 'Kuyruk yapıştırma',
    d: 'Log iki makara üstünde döndürülür, kağıdın ucu açılır, tutkal püskürtülür, uç geri sarılıp yapıştırılır; rulo açılmaz.',
    rows: (m) => [
      ['LOG / DK', fmt(m.logsMin, 1)],
      ['KUYRUK', '≈ 280 mm'],
      ['TUTKAL', 'püskürtme'],
      ['SÜRE', `${fmt(m.logTime * 0.34, 1)} sn`],
    ],
    a: ['sealer', 'nozzle'],
  },
  out: {
    t: 'Çıkış → logsaw',
    d: `Loglar banttan logsaw’a gider; her log ${ROLLS_PER_LOG} × ${fmt(ROLL_W * 1000)} mm rulo ve iki uçta ${fmt(TRIM * 1000)} mm fire verir.`,
    rows: (m) => [
      ['RULO / DK', fmt(m.rollsMin)],
      ['RULO / SAAT', fmt(m.rollsHour)],
      ['RULO', `${fmt(m.sheets)} yaprak · ${fmt(m.rollKg * 1000)} g`],
      ['FİRE', `% ${fmt(((2 * TRIM) / WIDTH) * 100, 1)}`],
    ],
    a: ['acc', 'saw'],
  },
};
const LABEL = {
  J1: ['JUMBO 1', 'Ø 1500 · 1550 mm'],
  J2: ['JUMBO 2', '2. kat'],
  M: ['BİRLEŞTİRME', '2 kat tek bant'],
  E1: ['ÇELİK DESEN MERDANESİ', 'Ø 280'],
  E2: ['KAUÇUK MERDANE', 'Shore 60'],
  PF: ['PERFORASYON SİLİNDİRİ', `${PERF_N} bıçak · Ø ${fmt(PERF_R * 2000)}`],
  anvil: ['KARŞI BIÇAK', 'sabit örs'],
  web: ['DELİKLİ BANT', `${fmt(SHEET * 1000)} mm yaprak`],
  W1: ['ALT SARMA MERDANELERİ', 'Ø 240 × 2'],
  rider: ['BASTIRMA MERDANESİ', 'pnömatik kol'],
  log: ['LOG', 'masura Ø 42'],
  chute: ['MASURA OLUĞU', 'tutkallı'],
  glue: ['TUTKAL HAZNESİ', 'masura hattı'],
  sealer: ['KUYRUK YAPIŞTIRICI', 'döndürme makaraları'],
  nozzle: ['TUTKAL MEMESİ', 'püskürtme'],
  acc: ['ÇIKIŞ BANDI', 'log akümülatörü'],
  saw: ['LOGSAW GİRİŞİ', '15 × 100 mm'],
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
.bt{position:absolute;height:28px;padding:0 10px;display:flex;align-items:center;justify-content:center;border:1px solid ${C.faint};border-radius:4px;background:#fff;font:700 9.4px 'JetBrains Mono',monospace;letter-spacing:1.1px;color:${C.ink};white-space:nowrap;pointer-events:auto;cursor:pointer}
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

  add(`<div style="position:absolute;left:0;top:0;width:118px;height:86px;background:${C.or}"></div>`);
  add(`<svg style="position:absolute;left:28px;top:20px" width="62" height="48"><g fill="none" stroke="#fff" stroke-width="2.4"><ellipse cx="18" cy="24" rx="12" ry="20"/><ellipse cx="18" cy="24" rx="4" ry="7"/><path d="M18 4h30M18 44h30"/><path d="M48 4c6 0 10 9 10 20s-4 20-10 20"/></g></svg>`);
  add(`<div class="sm" style="position:absolute;left:140px;top:18px;letter-spacing:2.4px">TISSUE CONVERTING · TUVALET KAĞIDI</div>`);
  add(`<div style="position:absolute;left:139px;top:32px;font-size:31px;font-weight:700;letter-spacing:-.6px;line-height:1">Smart Sarma Hattı <span style="color:${C.or};font-weight:400">/</span> <span style="font-weight:500">155 cm Rewinder</span></div>`);
  add(`<div class="mo" style="position:absolute;left:140px;top:70px;font-size:11px;letter-spacing:2px;color:#56616c">2 JUMBO · KABARTMA · PERFORASYON · YÜZEY SARMA · KUYRUK YAPIŞTIRMA</div>`);
  [['ÇALIŞMA ENİ', '1550 mm'], ['RULO', '15 × 100 mm']].forEach(([k, v], i) =>
    add(`<div style="position:absolute;left:${1210 + i * 190}px;top:28px"><div class="sm">${k}</div><div style="font-weight:700;font-size:20px;margin-top:3px">${v}</div></div>`),
  );

  panel(24, 110, 286, 262, 'ÜRETİM', '01');
  const big = add(`<div style="position:absolute;left:38px;top:140px;font-size:46px;font-weight:700;letter-spacing:-1.5px"></div>`);
  add(`<div class="sm" style="position:absolute;left:40px;top:194px">BANT HIZI · METRE / DAKİKA</div>`);
  const prod = kvRows(38, 222, 258, 4, 36);

  panel(24, 384, 286, 176, 'JUMBO · 2 KAT', '02');
  const jSvg = add(`<svg style="position:absolute;left:38px;top:418px" width="80" height="80"></svg>`);
  const jr = kvRows(132, 420, 164, 3, 40);

  panel(1290, 110, 286, 330, 'İSTASYON', '03');
  const cTitle = add(`<div style="position:absolute;left:1304px;top:140px;font-size:20px;font-weight:700;letter-spacing:-.3px;width:260px"></div>`);
  const cDesc = add(`<div style="position:absolute;left:1304px;top:172px;width:258px;font-size:12px;line-height:1.5;color:#46515c"></div>`);
  const card = kvRows(1304, 272, 258, 4, 40);

  panel(1290, 452, 286, 222, 'LOG SARIMI', '04');
  const logSvg = add(`<svg style="position:absolute;left:1304px;top:484px" width="258" height="180"></svg>`);

  add(`<div class="cp" style="left:24px;top:776px;width:1552px;height:100px"></div>`);
  add(`<div class="sm" style="position:absolute;left:40px;top:788px">İSTASYONLAR · 1–7 · 0 GENEL</div>`);
  const btn = {};
  let bx = 40;
  for (const s of STATIONS) {
    const w = s === 'overview' ? 62 : 112;
    btn[s] = add(`<div class="bt st" style="left:${bx}px;top:806px;width:${w}px">${ST_LABEL[s]}</div>`);
    bx += w + 5;
  }
  const spots = {};
  for (const s of STATIONS) spots[s] = [parseFloat(btn[s].style.left) + parseFloat(btn[s].style.width) / 2, 820];
  add(`<div class="sm" style="position:absolute;left:40px;top:846px">BOŞLUK DURDUR · S AĞIR ÇEKİM · G GÖVDE · E ETİKET · SÜRÜKLE DÖNDÜR · TEKERLEK YAKINLAŞ</div>`);
  const ctl = {};
  [['play', '❚❚ DURDUR', 970], ['slow', 'AĞIR ÇEKİM', 1060], ['xray', 'GÖVDE', 1158], ['labels', 'ETİKET', 1226]].forEach(([k, t, x]) => {
    ctl[k] = add(`<div class="bt" style="left:${x}px;top:806px">${t}</div>`);
  });
  for (const k of Object.keys(ctl)) spots[k] = [parseFloat(ctl[k].style.left) + 36, 820];
  add(`<div class="sm" style="position:absolute;left:1390px;top:790px">BANT HIZI · M/DK</div>`);
  const spdV = add(`<div class="mo" style="position:absolute;left:1500px;top:788px;font-size:11px;font-weight:700;width:60px;text-align:right"></div>`);
  const SP = {x: 1392, w: 168, y: 812};
  const spT = add(`<div class="track" style="left:${SP.x}px;top:${SP.y}px;width:${SP.w}px"><i></i><div class="knob"></div></div>`);
  add(`<div class="sm" style="position:absolute;left:1390px;top:834px">RULO METRESİ</div>`);
  const lV = add(`<div class="mo" style="position:absolute;left:1480px;top:832px;font-size:11px;font-weight:700;width:80px;text-align:right"></div>`);
  const LG = {x: 1392, w: 168, y: 856};
  const lT = add(`<div class="track" style="left:${LG.x}px;top:${LG.y}px;width:${LG.w}px"><i></i><div class="knob"></div></div>`);

  const callSvg = add(`<svg style="position:absolute;left:0;top:0;overflow:visible" width="1600" height="900"></svg>`);
  const calls = Array.from({length: 4}, () => add(`<div class="call" style="display:none"><b><i></i><em style="font-style:normal"></em></b><span></span></div>`));
  const ring = add(`<div class="ring"></div>`);
  const cur = add(`<svg class="cur" width="22" height="26" viewBox="0 0 22 26"><path d="M2 2l16 11-7 1.5 4 8-3 1.4-4-8L3 21z" fill="#fff" stroke="#1f262d" stroke-width="1.5" stroke-linejoin="round"/></svg>`);

  // log sarım göstergesi: kesit (masura + sarım), ilerleme çubuğu, yaprak sayacı
  const logDraw = (m) => {
    const k = 62 / m.Rfull;
    const r = m.Rl * k;
    let s = `<circle cx="70" cy="80" r="${62}" fill="none" stroke="${C.line}" stroke-dasharray="2 3"/>`;
    s += `<circle cx="70" cy="80" r="${r}" fill="#f6f3ec" stroke="${C.mute}"/>`;
    for (let i = 1; i < 6; i++) s += `<circle cx="70" cy="80" r="${CORE_R * k + (r - CORE_R * k) * (i / 6)}" fill="none" stroke="${C.line}"/>`;
    s += `<circle cx="70" cy="80" r="${CORE_R * k}" fill="#a8865c"/><circle cx="70" cy="80" r="${CORE_R * k * 0.82}" fill="#4a3a28"/>`;
    s += `<text x="150" y="40" font-family="JetBrains Mono" font-size="9" fill="${C.mute}" letter-spacing="1">ÇAP</text><text x="150" y="58" font-family="Inter" font-weight="700" font-size="17" fill="${C.ink}">${fmt(m.Rl * 2000, 1)} mm</text>`;
    s += `<text x="150" y="86" font-family="JetBrains Mono" font-size="9" fill="${C.mute}" letter-spacing="1">YAPRAK</text><text x="150" y="104" font-family="Inter" font-weight="700" font-size="17" fill="${C.ink}">${fmt(Math.floor(m.Lw / SHEET))} / ${fmt(m.sheets)}</text>`;
    s += `<rect x="4" y="158" width="250" height="6" fill="none" stroke="${C.faint}"/><rect x="4" y="158" width="${250 * m.u}" height="6" fill="${C.or}"/>`;
    s += `<text x="4" y="178" font-family="JetBrains Mono" font-size="8" fill="${C.mute}" letter-spacing="1">${fmt(m.Lw, 1)} / ${fmt(m.Llog)} M · SARIM ${fmt(L_CAL * 1000, 2)} MM/KAT</text>`;
    return s;
  };

  const update = (s) => {
    const m = s.mech;
    big.innerHTML = `${fmt(m.mpm)}<span style="font-size:15px;font-weight:600;color:${C.mute};letter-spacing:0"> m/dk</span>`;
    [
      ['LOG / DK', fmt(m.logsMin, 1)],
      ['RULO / DK', fmt(m.rollsMin)],
      ['SARILAN LOG', fmt(m.j)],
      ['GÖRÜNTÜ', s.slow ? 'AĞIR ÇEKİM × 0,25' : 'GERÇEK HIZ'],
    ].forEach(([k, v], i) => {
      prod[i].k.textContent = k;
      prod[i].v.textContent = v;
    });
    const rr = (m.jR / 0.75) * 36;
    jSvg.innerHTML = `<circle cx="40" cy="40" r="37" fill="none" stroke="${C.line}" stroke-dasharray="2 3"/><circle cx="40" cy="40" r="${rr}" fill="#f3f0e8" stroke="${C.mute}"/><circle cx="40" cy="40" r="2.6" fill="#9c7a52"/><line x1="40" y1="40" x2="${40 + Math.cos(-m.jA) * rr}" y2="${40 + Math.sin(-m.jA) * rr}" stroke="${C.or}" stroke-width="2"/>`;
    [
      ['ÇAP', mm(m.jR * 2)],
      ['DEVİR', `${fmt(m.jRpm)} /dk`],
      ['KALAN', `${fmt(m.jMin, 1)} dk`],
    ].forEach(([k, v], i) => {
      jr[i].k.textContent = k;
      jr[i].v.textContent = v;
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
    logSvg.innerHTML = logDraw(m);
    for (const k of STATIONS) btn[k].classList.toggle('on', k === s.station);
    ctl.play.textContent = s.paused ? '▶ ÇALIŞTIR' : '❚❚ DURDUR';
    ctl.slow.classList.toggle('on', s.slow);
    ctl.xray.classList.toggle('on', s.xray > 0.5);
    ctl.labels.classList.toggle('on', s.labelsOn);
    spT.firstElementChild.style.width = `${s.speedK * SP.w}px`;
    spT.lastElementChild.style.left = `${s.speedK * SP.w}px`;
    spdV.textContent = fmt(m.mpm);
    lT.firstElementChild.style.width = `${s.lenK * LG.w}px`;
    lT.lastElementChild.style.left = `${s.lenK * LG.w}px`;
    lV.textContent = `${fmt(m.Llog)} m`;
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
  void GSM;
  void PLY;
  return {root: ui, update, btn, ctl, spots, SP, LG};
}
