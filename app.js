/* CAGED Box Trainer UI: fretboard rendering, explore view, quiz and audio. */
(function () {
  'use strict';
  const T = window.Theory;
  const $ = (id) => document.getElementById(id);
  const SVGNS = 'http://www.w3.org/2000/svg';
  const CHORD_IV = { maj: [0, 4, 7], min: [0, 3, 7] };
  const QNAME = { maj: 'major', min: 'minor' };

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };

  const defaults = {
    tab: 'explore', key: 0, q: 'maj', shape: 'all',
    layers: { chord: true, pent: true, arp: false }, arpType: 'triad',
    labels: 'interval', colors: true, ghost: false, numbering: 'shared',
    quizTypes: ['nameChord', 'nameBox', 'chordToBox', 'boxToChord', 'nameArp', 'next'],
    quizQ: 'both', quizKeys: 'all',
  };
  const state = Object.assign({}, defaults, store.get('caged.settings', {}));
  state.layers = Object.assign({}, defaults.layers, state.layers);
  const save = () => store.set('caged.settings', state);

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const shapeColor = (sh) => css('--sh-' + sh);

  const ROOT_TIPS = {
    C: '<strong>C shape</strong>: roots on the 5th and 2nd strings. The 5th-string root sits under the ring finger and the shape reaches back toward the nut.',
    A: '<strong>A shape</strong>: roots on the 5th and 3rd strings. Barre on the 5th-string root.',
    G: '<strong>G shape</strong>: roots on the 6th, 3rd and 1st strings. The 6th-string root is on top of the shape and it reaches back toward the nut.',
    E: '<strong>E shape</strong>: roots on the 6th, 4th and 1st strings. Barre on the 6th-string root.',
    D: '<strong>D shape</strong>: roots on the 4th and 2nd strings. The triangle on the top three strings.',
  };

  /* ---------- fretboard ---------- */
  const G = { W: 1200, LEFT: 44, OPENW: 40, RIGHT: 14, LANE: 17, GAP: 34, PAD: 18 };
  G.fretW = (G.W - G.LEFT - G.OPENW - G.RIGHT) / T.FRETS;
  G.neckTop = 3 * G.LANE + 8;
  G.neckH = 5 * G.GAP + 2 * G.PAD;
  G.H = G.neckTop + G.neckH + 26;
  const nutX = G.LEFT + G.OPENW;
  const xNote = (f) => (f === 0 ? G.LEFT + G.OPENW / 2 : nutX + (f - 0.5) * G.fretW);
  const yStr = (s) => G.neckTop + G.PAD + (5 - s) * G.GAP;
  const xFretLine = (k) => nutX + k * G.fretW;

  function el(tag, attrs, parent) {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  let clipSeq = 0;
  // Fill a circle or rounded square with one stripe per colour.
  function stripedShape(g, x, y, r, isRoot, colors, extra) {
    const id = 'c' + (++clipSeq);
    const clip = el('clipPath', { id }, g);
    if (isRoot) el('rect', { x: x - r, y: y - r, width: 2 * r, height: 2 * r, rx: r * 0.32 }, clip);
    else el('circle', { cx: x, cy: y, r }, clip);
    const w = (2 * r) / colors.length;
    colors.forEach((c, i) => el('rect', { x: x - r + i * w, y: y - r, width: w + 0.5, height: 2 * r, fill: c, 'clip-path': `url(#${id})` }, g));
    const outline = isRoot
      ? el('rect', { x: x - r, y: y - r, width: 2 * r, height: 2 * r, rx: r * 0.32, fill: 'none' }, g)
      : el('circle', { cx: x, cy: y, r, fill: 'none' }, g);
    for (const k in extra || {}) outline.setAttribute(k, extra[k]);
    return outline;
  }

  function drawNeck(svg, opts) {
    const o = Object.assign({ marks: [], spans: [], ghost: [], user: [], result: null, onCell: null }, opts);
    svg.setAttribute('viewBox', `0 0 ${G.W} ${G.H}`);
    svg.textContent = '';
    clipSeq = svg.id === 'neck' ? 0 : 1000;
    const C = palette();

    // shape spans in three lanes above the neck
    o.spans.forEach((sp) => {
      const lane = T.SHAPES.indexOf(sp.shape) % 3;
      const x1 = sp.lo === 0 ? G.LEFT + 2 : xFretLine(sp.lo - 1) + 2;
      const x2 = xFretLine(sp.hi) - 2;
      const y = lane * G.LANE + 3;
      el('rect', { x: x1, y, width: Math.max(x2 - x1, 10), height: G.LANE - 5, rx: 2, fill: sp.color || C.span }, svg);
      const t = el('text', { x: x1 + 6, y: y + G.LANE - 8.5, 'font-size': 10, 'font-weight': 500, 'letter-spacing': '0.06em', fill: C.noteInk }, svg);
      t.textContent = sp.label.toUpperCase();
    });

    // neck surface, inlays, frets, nut, strings
    el('rect', { x: G.LEFT, y: G.neckTop, width: G.W - G.LEFT - G.RIGHT, height: G.neckH, fill: C.neck, stroke: C.neckEdge, rx: 5 }, svg);
    const midY = G.neckTop + G.neckH / 2;
    [3, 5, 7, 9, 15, 17].forEach((f) => { if (f <= T.FRETS) el('circle', { cx: xNote(f), cy: midY, r: 5, fill: C.inlay }, svg); });
    [-1, 1].forEach((k) => el('circle', { cx: xNote(12), cy: midY + k * G.GAP * 1.5, r: 5, fill: C.inlay }, svg));
    for (let k = 1; k <= T.FRETS; k++) el('line', { x1: xFretLine(k), x2: xFretLine(k), y1: G.neckTop + 1, y2: G.neckTop + G.neckH - 1, stroke: C.fret, 'stroke-width': 1.5 }, svg);
    el('rect', { x: nutX - 3, y: G.neckTop, width: 4, height: G.neckH, fill: C.nut }, svg);
    for (let s = 0; s < 6; s++) {
      el('line', { x1: G.LEFT, x2: G.W - G.RIGHT, y1: yStr(s), y2: yStr(s), stroke: C.string, 'stroke-width': 0.6 + (5 - s) * 0.28 }, svg);
      const t = el('text', { x: G.LEFT - 14, y: yStr(s) + 4, 'font-size': 11, 'text-anchor': 'middle', fill: C.label }, svg);
      t.textContent = T.STRING_NAMES[s];
    }
    for (let f = 0; f <= T.FRETS; f++) {
      const strong = [3, 5, 7, 9, 12, 15, 17].includes(f);
      const t = el('text', { x: xNote(f), y: G.neckTop + G.neckH + 18, 'font-size': 11, 'text-anchor': 'middle', fill: strong ? C.ink : C.label, 'font-weight': strong ? 500 : 400, opacity: strong ? 0.85 : 0.7 }, svg);
      t.textContent = f;
    }

    o.ghost.forEach((n) => el('circle', { cx: xNote(n.f), cy: yStr(n.s), r: n.iv === 0 ? 4 : 3, fill: n.iv === 0 ? C.root : C.note, opacity: n.iv === 0 ? 0.5 : 0.28 }, svg));

    // note marks
    o.marks.forEach((m) => {
      const g = el('g', { class: 'mark' }, svg);
      const x = xNote(m.f), y = yStr(m.s), isRoot = m.iv === 0;
      const colors = m.colors.length ? m.colors : [isRoot ? C.root : C.note];
      let textFill;
      if (m.role === 'scale') {
        stripedShape(g, x, y, 11, isRoot, colors);
        if (isRoot) el('rect', { x: x - 8.5, y: y - 8.5, width: 17, height: 17, rx: 3, fill: C.neck }, g);
        else el('circle', { cx: x, cy: y, r: 8.5, fill: C.neck }, g);
        textFill = C.note;
      } else {
        const r = m.role === 'chord' ? 12.5 : 11;
        stripedShape(g, x, y, r, isRoot, colors, m.role === 'chord' ? { stroke: C.rim, 'stroke-width': 2 } : {});
        textFill = m.colors.length ? C.noteInk : (isRoot ? C.rootOn : C.noteOn);
      }
      if (m.text) {
        const t = el('text', { x, y: y + 3.8, 'font-size': m.text.length > 2 ? 9 : 10.5, 'font-weight': 600, 'text-anchor': 'middle', fill: textFill }, g);
        t.textContent = m.text;
      }
    });

    // quiz build marks
    o.user.forEach(([s, f]) => el('circle', { cx: xNote(f), cy: yStr(s), r: 11.5, fill: C.note, opacity: 0.85 }, svg));
    if (o.result) {
      o.result.forEach((r) => {
        const x = xNote(r.f), y = yStr(r.s);
        let tf = C.rootOn;
        if (r.kind === 'ok') el('circle', { cx: x, cy: y, r: 12, fill: C.ok, stroke: C.rim, 'stroke-width': 2 }, svg);
        if (r.kind === 'missed') { el('circle', { cx: x, cy: y, r: 11, fill: C.neck, stroke: C.root, 'stroke-width': 2, 'stroke-dasharray': '3 3' }, svg); tf = C.root; }
        if (r.kind === 'extra') {
          el('circle', { cx: x, cy: y, r: 11.5, fill: C.label }, svg);
          el('path', { d: `M${x - 5} ${y - 5}L${x + 5} ${y + 5}M${x + 5} ${y - 5}L${x - 5} ${y + 5}`, stroke: C.neck, 'stroke-width': 2 }, svg);
        }
        if (r.text) {
          const t = el('text', { x, y: y + 3.8, 'font-size': 10.5, 'font-weight': 600, 'text-anchor': 'middle', fill: tf }, svg);
          t.textContent = r.text;
        }
      });
    }

    if (o.onCell) {
      for (let s = 0; s < 6; s++) {
        for (let f = 0; f <= T.FRETS; f++) {
          const x1 = f === 0 ? G.LEFT : xFretLine(f - 1);
          const x2 = f === 0 ? nutX : xFretLine(f);
          const cell = el('rect', { x: x1, y: yStr(s) - G.GAP / 2, width: x2 - x1, height: G.GAP, fill: 'transparent', style: 'cursor:pointer' }, svg);
          cell.addEventListener('click', () => o.onCell(s, f));
        }
      }
    }
  }

  function palette() {
    return {
      neck: css('--neck'), neckEdge: css('--neck-edge'), fret: css('--fret'), string: css('--string'), inlay: css('--inlay'),
      nut: css('--nut'), label: css('--neck-label'), ink: css('--ink'), note: css('--note'), noteOn: css('--note-on'),
      noteInk: css('--note-ink'), rim: css('--rim'), root: css('--root'), rootOn: css('--root-on'), ok: css('--ok'), span: css('--span'),
    };
  }

  /* ---------- helpers ---------- */
  function labelFor(n, key, q, mode) {
    if (mode === 'interval') return T.INTERVALS[n.iv];
    if (mode === 'note') return T.noteName(n.pc, key, q);
    return '';
  }

  function boxText(n, q) { return 'Box ' + T.boxLabel(n, q, state.numbering); }

  // Merge the notes of several positions into one mark per fret, keeping the strongest role.
  function buildMarks(list, opt) {
    const rank = { scale: 0, arp: 1, chord: 2 };
    const map = new Map();
    const add = (notes, role, shape) => notes.forEach((n) => {
      const k = n.s + ':' + n.f;
      let m = map.get(k);
      if (!m) { m = Object.assign({}, n, { role, shapes: new Set() }); map.set(k, m); }
      if (rank[role] > rank[m.role]) m.role = role;
      m.shapes.add(shape);
    });
    list.forEach((p) => {
      if (opt.pent) add(p.box, 'scale', p.shape);
      if (opt.arp) add(p.arp, 'arp', p.shape);
      if (opt.chord) add(p.chord, 'chord', p.shape);
    });
    return [...map.values()].map((m) => Object.assign(m, {
      colors: opt.colors ? T.SHAPES.filter((sh) => m.shapes.has(sh)).map(shapeColor) : [],
      text: labelFor(m, opt.key, opt.q, opt.labels),
    }));
  }

  function spansFor(list, opt) {
    return list.map((p) => ({
      shape: p.shape, lo: p.lo, hi: p.hi,
      color: opt.colors ? shapeColor(p.shape) : css('--span'),
      label: `${p.shape} shape${opt.pent ? '  ·  ' + boxText(p.boxN, p.q) : ''}`,
    }));
  }

  function ghostNotes(key, q) {
    const out = [];
    for (let s = 0; s < 6; s++) for (let f = 0; f <= T.FRETS; f++) {
      const n = T.makeNote(s, f, key);
      if (T.PENT[q].includes(n.iv)) out.push(n);
    }
    return out;
  }

  function setPressed(container, value) {
    container.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === String(value))));
  }

  /* ---------- explore ---------- */
  function currentPositions() {
    return state.shape === 'all'
      ? T.allPositions(state.key, state.q, state.arpType)
      : T.positions(state.key, state.q, state.shape, state.arpType);
  }

  function renderExplore() {
    const list = currentPositions();
    const opt = { chord: state.layers.chord, pent: state.layers.pent, arp: state.layers.arp, colors: state.colors, labels: state.labels, key: state.key, q: state.q };
    drawNeck($('neck'), {
      marks: buildMarks(list, opt),
      spans: spansFor(list, opt),
      ghost: state.ghost ? ghostNotes(state.key, state.q) : [],
    });

    const kn = T.keyName(state.key, state.q);
    $('mapTitle').textContent = `Shape map · ${kn} ${QNAME[state.q]}`;
    const all = T.allPositions(state.key, state.q, state.arpType);
    let html = '<tr><th>Chord shape</th><th>Pentatonic</th><th>Frets in this key</th><th>Chord tones</th></tr>';
    T.SHAPES.forEach((sh) => {
      const ps = all.filter((p) => p.shape === sh);
      const frets = ps.map((p) => `${p.lo}–${p.hi}`).join(', ');
      const tones = CHORD_IV[state.q].map((iv) => T.noteName(state.key + iv, state.key, state.q)).join(' ');
      html += `<tr class="row${state.shape === sh ? ' on' : ''}" data-shape="${sh}">
        <td><span class="shape-name"><span class="dot" style="background:${shapeColor(sh)}"></span>${sh} shape</span></td>
        <td><span class="muted">Box</span> <span class="boxnum">${T.boxLabel(T.BOX_FOR[state.q][sh], state.q, state.numbering)}</span></td>
        <td class="mono">${frets}</td><td class="mono muted">${tones}</td></tr>`;
    });
    $('map').innerHTML = html;
    $('map').querySelectorAll('tr.row').forEach((tr) => tr.addEventListener('click', () => setShape(state.shape === tr.dataset.shape ? 'all' : tr.dataset.shape)));

    const single = state.shape !== 'all';
    ['play-chord', 'play-arp', 'play-box'].forEach((id) => { $(id).disabled = !single; });
    $('playHint').textContent = single
      ? `Plays the ${state.shape} shape in ${kn} ${QNAME[state.q]}${list.length > 1 ? ' (lowest position)' : ''}.`
      : 'Pick a single shape to hear it.';
    $('shapeTip').innerHTML = single
      ? ROOT_TIPS[state.shape] + ` It sits on <strong>${boxText(T.BOX_FOR[state.q][state.shape], state.q)}</strong> of the ${QNAME[state.q]} pentatonic.`
      : `Going up the neck the shapes always run <strong>C, A, G, E, D</strong> and then start again. Neighbouring shapes share notes, so each box joins onto the next.`;
    renderLegend();
  }

  function legendIcon(kind) {
    const s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('width', 22); s.setAttribute('height', 22); s.setAttribute('viewBox', '0 0 28 28');
    const C = palette();
    el('rect', { x: 0.5, y: 0.5, width: 27, height: 27, rx: 5, fill: C.neck, stroke: C.neckEdge }, s);
    if (kind === 'root') el('rect', { x: 6, y: 6, width: 16, height: 16, rx: 4, fill: C.root }, s);
    if (kind === 'chord') el('circle', { cx: 14, cy: 14, r: 9, fill: C.note, stroke: C.rim, 'stroke-width': 2 }, s);
    if (kind === 'arp') el('circle', { cx: 14, cy: 14, r: 7.5, fill: C.note }, s);
    if (kind === 'scale') el('circle', { cx: 14, cy: 14, r: 7.5, fill: 'none', stroke: C.note, 'stroke-width': 2.5 }, s);
    if (kind === 'split') {
      const c = el('clipPath', { id: 'lg-split' }, s); el('circle', { cx: 14, cy: 14, r: 9 }, c);
      el('rect', { x: 5, y: 5, width: 9, height: 18, fill: shapeColor('E'), 'clip-path': 'url(#lg-split)' }, s);
      el('rect', { x: 14, y: 5, width: 9, height: 18, fill: shapeColor('D'), 'clip-path': 'url(#lg-split)' }, s);
    }
    if (kind === 'ghost') el('circle', { cx: 14, cy: 14, r: 3.5, fill: C.note, opacity: 0.3 }, s);
    return s;
  }

  function renderLegend() {
    const items = [
      ['root', 'Square: root'], ['chord', 'Large, rimmed: chord shape'],
      ['arp', 'Solid: arpeggio note'], ['scale', 'Ring: pentatonic note'],
    ];
    if (state.colors) items.push(['split', 'Split colour: shared by two shapes']);
    if (state.ghost) items.push(['ghost', 'Small dot: scale note outside the shape']);
    const box = $('legend'); box.textContent = '';
    items.forEach(([k, txt]) => { const d = document.createElement('div'); d.appendChild(legendIcon(k)); d.appendChild(document.createTextNode(txt)); box.appendChild(d); });
  }

  function setShape(sh) { state.shape = sh; save(); renderControls(); renderExplore(); }

  function step(dir) {
    if (state.shape === 'all') setShape(dir === 'down' ? 'D' : 'C');
    else setShape(T.nextShape(state.shape, dir));
  }

  /* ---------- controls ---------- */
  function buildControls() {
    const keys = $('keys');
    for (let k = 0; k < 12; k++) {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.v = k;
      b.addEventListener('click', () => { state.key = k; save(); renderAll(); });
      keys.appendChild(b);
    }
    const shapes = $('shapes');
    ['all', ...T.SHAPES].forEach((sh) => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.v = sh;
      b.innerHTML = sh === 'all' ? 'All' : `<span class="dot" style="background:${shapeColor(sh)}"></span>${sh}`;
      b.addEventListener('click', () => setShape(sh));
      shapes.appendChild(b);
    });
    $('quality').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => setQuality(b.dataset.v)));
    $('labels').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { state.labels = b.dataset.v; save(); renderAll(); }));
    [['lay-chord', 'chord'], ['lay-pent', 'pent'], ['lay-arp', 'arp']].forEach(([id, k]) => $(id).addEventListener('change', (e) => { state.layers[k] = e.target.checked; save(); renderAll(); }));
    $('opt-colors').addEventListener('change', (e) => { state.colors = e.target.checked; save(); renderAll(); });
    $('opt-ghost').addEventListener('change', (e) => { state.ghost = e.target.checked; save(); renderAll(); });
    $('arpType').addEventListener('change', (e) => { state.arpType = e.target.value; state.layers.arp = true; save(); renderAll(); });
    $('numbering').addEventListener('change', (e) => { state.numbering = e.target.value; save(); renderAll(); });
    $('tabs').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
    $('prev').addEventListener('click', () => step('down'));
    $('next').addEventListener('click', () => step('up'));
    $('play-chord').addEventListener('click', () => playCurrent('chord'));
    $('play-arp').addEventListener('click', () => playCurrent('arp'));
    $('play-box').addEventListener('click', () => playCurrent('box'));
  }

  function setQuality(q) {
    state.q = q;
    if (!T.arpTypesFor(q).includes(state.arpType)) state.arpType = 'triad';
    save(); renderAll();
  }

  function renderControls() {
    const kb = $('keys').querySelectorAll('button');
    kb.forEach((b, k) => { b.textContent = T.keyName(k, state.q) + (state.q === 'min' ? 'm' : ''); });
    setPressed($('keys'), state.key);
    setPressed($('quality'), state.q);
    setPressed($('shapes'), state.shape);
    setPressed($('labels'), state.labels);
    $('tabs').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === state.tab)));
    $('lay-chord').checked = state.layers.chord;
    $('lay-pent').checked = state.layers.pent;
    $('lay-arp').checked = state.layers.arp;
    $('opt-colors').checked = state.colors;
    $('opt-ghost').checked = state.ghost;
    $('numbering').value = state.numbering;
    const sel = $('arpType');
    sel.innerHTML = T.arpTypesFor(state.q).map((t) => `<option value="${t}">${t === 'triad' ? (state.q === 'maj' ? 'Major triad' : 'Minor triad') : T.ARP_NAMES[t]}</option>`).join('');
    sel.value = state.arpType;
    document.querySelectorAll('[data-explore]').forEach((g) => { g.hidden = state.tab !== 'explore'; });
    document.querySelectorAll('[data-quiz]').forEach((g) => { g.hidden = state.tab !== 'quiz'; });
    $('explore').hidden = state.tab !== 'explore';
    $('quiz').hidden = state.tab !== 'quiz';
  }

  function setTab(tab) {
    state.tab = tab; save(); renderControls();
    if (tab === 'quiz') { if (!quiz.current) newQuestion(); else renderQuiz(); }
    else renderExplore();
  }

  function renderAll() {
    renderControls();
    if (state.tab === 'explore') renderExplore();
    else if (quiz.current && quiz.current.answered) renderQuiz();
  }

  /* ---------- audio ---------- */
  let actx = null;
  function pluck(midi, t, vol, dur) {
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const gain = actx.createGain();
    // bright pick attack: the filter opens wide, then settles so the tail stays clear
    const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.2;
    lp.frequency.setValueAtTime(9000, t);
    lp.frequency.exponentialRampToValueAtTime(3800, t + 0.35);
    const shelf = actx.createBiquadFilter(); shelf.type = 'highshelf'; shelf.frequency.value = 3000; shelf.gain.value = 5;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    // quick decay, then a short release so each note stops cleanly
    gain.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    [['sawtooth', 1, 0.45], ['triangle', 1, 0.7], ['sine', 2, 0.3], ['sine', 3, 0.12]].forEach(([type, mult, amp]) => {
      const o = actx.createOscillator(); o.type = type; o.frequency.value = f * mult;
      const g = actx.createGain(); g.gain.value = amp;
      o.connect(g); g.connect(lp); o.start(t); o.stop(t + dur + 0.05);
    });
    lp.connect(shelf); shelf.connect(gain); gain.connect(actx.destination);
  }
  function playSeq(midis, stepSec, vol, dur) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      actx.resume();
      const t0 = actx.currentTime + 0.05;
      midis.forEach((m, i) => pluck(m, t0 + i * stepSec, vol, dur || stepSec * 1.1));
    } catch (e) { /* audio unavailable */ }
  }
  function upDown(notes) {
    const asc = [...new Set(notes.map((n) => n.midi))].sort((a, b) => a - b);
    return asc.concat(asc.slice(0, -1).reverse());
  }
  function playPosition(p, what) {
    if (!p) return;
    if (what === 'chord') playSeq([...p.chord].sort((a, b) => a.s - b.s).map((n) => n.midi), 0.035, 0.16, 1.1);
    if (what === 'arp') playSeq(upDown(p.arp), 0.17, 0.22);
    if (what === 'box') playSeq(upDown(p.box), 0.15, 0.22);
  }
  function playCurrent(what) {
    if (state.shape === 'all') return;
    playPosition(T.positions(state.key, state.q, state.shape, state.arpType)[0], what);
  }

  /* ---------- quiz ---------- */
  const QTYPES = {
    nameChord: 'Name the chord shape',
    nameBox: 'Name the box',
    chordToBox: 'Chord shape → box',
    boxToChord: 'Box → chord shape',
    nameArp: 'Name the arpeggio shape',
    next: 'Next shape in the cycle',
    build: 'Build the chord',
  };
  const quiz = { current: null, user: [], session: { right: 0, total: 0, streak: 0, best: store.get('caged.best', 0) } };
  let stats = store.get('caged.stats', {});
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function itemsFor(type, qs) {
    const out = [];
    if (type === 'next') ['up', 'down'].forEach((dir) => T.SHAPES.forEach((sh) => out.push({ type, dir, shape: sh, q: 'maj', id: `next|${dir}|${sh}` })));
    else qs.forEach((q) => T.SHAPES.forEach((sh) => out.push({ type, q, shape: sh, id: `${type}|${q}|${sh}` })));
    return out;
  }

  function weight(id) {
    const s = stats[id] || { r: 0, w: 0 };
    return (s.w * 2 + 1) / (s.r + 1) + 0.15;
  }

  function quizKeyPool() {
    if (state.quizKeys === 'current') return [state.key];
    if (state.quizKeys === 'natural') return [0, 2, 4, 5, 7, 9, 11];
    return [...Array(12).keys()];
  }

  function newQuestion() {
    const qs = state.quizQ === 'both' ? ['maj', 'min'] : [state.quizQ];
    const types = state.quizTypes.length ? state.quizTypes : ['nameChord'];
    let items = types.flatMap((t) => itemsFor(t, qs));
    if (quiz.current && items.length > 1) items = items.filter((it) => it.id !== quiz.current.id);
    const total = items.reduce((a, it) => a + weight(it.id), 0);
    let r = Math.random() * total, it = items[0];
    for (const x of items) { r -= weight(x.id); if (r <= 0) { it = x; break; } }

    const q = it.q;
    const key = pick(quizKeyPool());
    const kn = `${T.keyName(key, q)} ${QNAME[q]}`;
    const ps = T.positions(key, q, it.shape, 'triad');
    const pos = pick(ps);
    const boxLbl = T.boxLabel(T.BOX_FOR[q][it.shape], q, state.numbering);
    const shapeAnswers = T.SHAPES.map((sh) => ({ v: sh, label: `${sh} shape`, hot: sh.toLowerCase() }));
    const boxAnswers = [1, 2, 3, 4, 5].map((n) => ({ v: String(n), label: `Box ${n}`, hot: String(n) }));
    const c = Object.assign({}, it, { key, pos, answered: false, picked: null });

    if (it.type === 'nameChord') Object.assign(c, { prompt: `Which shape is this ${kn} chord?`, sub: 'Squares are roots.', answers: shapeAnswers, correct: it.shape, show: 'chord' });
    if (it.type === 'nameArp') Object.assign(c, { prompt: `Which CAGED shape does this ${kn} arpeggio belong to?`, sub: 'Squares are roots. Find the chord shape hiding inside.', answers: shapeAnswers, correct: it.shape, show: 'arp' });
    if (it.type === 'nameBox') Object.assign(c, { prompt: `Which box of ${T.keyName(key, q)} ${QNAME[q]} pentatonic is this?`, sub: q === 'maj' && state.numbering === 'shared' ? 'Major boxes use the same numbers as their minor fingering.' : 'Squares are roots.', answers: boxAnswers, correct: String(boxLbl), show: 'box' });
    if (it.type === 'chordToBox') Object.assign(c, { prompt: `${kn}, ${it.shape} shape. Which pentatonic box goes with it?`, sub: 'Answer from memory. The neck shows it after you answer.', answers: boxAnswers, correct: String(boxLbl), show: null });
    if (it.type === 'boxToChord') Object.assign(c, { prompt: `${T.keyName(key, q)} ${QNAME[q]} pentatonic, Box ${boxLbl}. Which chord shape sits inside it?`, sub: 'Answer from memory. The neck shows it after you answer.', answers: shapeAnswers, correct: it.shape, show: null });
    if (it.type === 'next') {
      const target = T.nextShape(it.shape, it.dir);
      Object.assign(c, { prompt: `Moving ${it.dir} the neck from the ${it.shape} shape, which shape comes next?`, sub: `Shown in ${T.keyName(key, 'maj')} major after you answer.`, answers: shapeAnswers, correct: target, show: null, target });
    }
    if (it.type === 'build') Object.assign(c, { prompt: `Build the ${it.shape}-shape ${kn} chord.`, sub: 'Click frets to place notes, then press Check. Any octave counts.', answers: [], correct: null, show: null, build: true });
    quiz.current = c;
    quiz.user = [];
    renderQuiz();
  }

  function record(correct) {
    const c = quiz.current;
    c.answered = true;
    const s = stats[c.id] || { r: 0, w: 0 };
    if (correct) s.r++; else s.w++;
    stats[c.id] = s; store.set('caged.stats', stats);
    const S = quiz.session;
    S.total++;
    if (correct) { S.right++; S.streak++; if (S.streak > S.best) { S.best = S.streak; store.set('caged.best', S.best); } }
    else S.streak = 0;
  }

  function answer(v) {
    const c = quiz.current;
    if (!c || c.answered || c.build) return;
    c.picked = v;
    record(v === c.correct);
    renderQuiz();
  }

  function gradeBuild() {
    const c = quiz.current;
    if (!c || c.answered || !c.build) return;
    const U = new Set(quiz.user.map(([s, f]) => s + ':' + f));
    let best = null;
    T.positions(c.key, c.q, c.shape, 'triad').forEach((p) => {
      const R = new Set(p.chord.map((n) => n.s + ':' + n.f));
      const res = [];
      let hits = 0, bad = 0;
      p.chord.forEach((n) => { const k = n.s + ':' + n.f; if (U.has(k)) { hits++; res.push({ s: n.s, f: n.f, kind: 'ok' }); } else res.push({ s: n.s, f: n.f, kind: 'missed' }); });
      quiz.user.forEach(([s, f]) => {
        if (R.has(s + ':' + f)) return;
        const n = T.makeNote(s, f, c.key);
        const near = f >= p.lo - 1 && f <= p.hi + 1;
        if (CHORD_IV[c.q].includes(n.iv) && near) res.push({ s, f, kind: 'ok' });
        else { bad++; res.push({ s, f, kind: 'extra' }); }
      });
      const score = hits * 10 - bad * 5;
      if (!best || score > best.score) best = { score, res, ok: hits === R.size && bad === 0, p };
    });
    best.res.forEach((r) => { r.text = T.INTERVALS[T.makeNote(r.s, r.f, c.key).iv]; });
    c.result = best;
    c.pos = best.p;
    record(best.ok);
    renderQuiz();
  }

  function itemLabel(id) {
    const [type, a, sh] = id.split('|');
    if (type === 'next') return `Next shape ${a} from ${sh}`;
    const qn = QNAME[a];
    if (type === 'nameBox' || type === 'boxToChord') return `${QTYPES[type]}: ${qn} ${boxText(T.BOX_FOR[a][sh], a)}`;
    return `${QTYPES[type]}: ${qn} ${sh} shape`;
  }

  function renderQuiz() {
    const c = quiz.current;
    if (!c) return;
    const S = quiz.session;
    $('sRight').textContent = S.right; $('sTotal').textContent = S.total; $('sStreak').textContent = S.streak; $('sBest').textContent = S.best;
    $('qPrompt').textContent = c.prompt;
    $('qSub').textContent = c.sub;

    // neck
    const neckOpts = {};
    const plain = { chord: false, pent: false, arp: false, colors: false, labels: 'none', key: c.key, q: c.q };
    if (!c.answered) {
      if (c.show === 'chord') neckOpts.marks = buildMarks([c.pos], Object.assign({}, plain, { chord: true }));
      if (c.show === 'arp') neckOpts.marks = buildMarks([c.pos], Object.assign({}, plain, { arp: true }));
      if (c.show === 'box') neckOpts.marks = buildMarks([c.pos], Object.assign({}, plain, { pent: true }));
      if (c.build) {
        neckOpts.user = quiz.user;
        neckOpts.onCell = (s, f) => {
          const i = quiz.user.findIndex(([a, b]) => a === s && b === f);
          if (i >= 0) quiz.user.splice(i, 1); else quiz.user.push([s, f]);
          renderQuiz();
        };
      }
    } else if (c.build) {
      neckOpts.result = c.result.res;
      neckOpts.spans = spansFor([c.pos], { colors: true, pent: false });
    } else {
      const reveal = { chord: true, pent: true, arp: c.type === 'nameArp', colors: true, labels: 'interval', key: c.key, q: c.q };
      let list = [c.pos];
      if (c.type === 'next') {
        const from = T.positions(c.key, 'maj', c.shape, 'triad');
        const to = T.positions(c.key, 'maj', c.target, 'triad');
        list = [from[0]];
        // pick the copy of the target that sits next to the starting shape in the asked direction
        const cand = to.filter((p) => (c.dir === 'up' ? p.lo >= from[0].lo : p.hi <= from[0].hi));
        list.push(cand.length ? cand.sort((a, b) => Math.abs(a.lo - from[0].lo) - Math.abs(b.lo - from[0].lo))[0] : to[0]);
        reveal.q = 'maj'; reveal.pent = false;
      }
      neckOpts.marks = buildMarks(list, reveal);
      neckOpts.spans = spansFor(list, reveal);
    }
    drawNeck($('qneck'), neckOpts);

    // answers
    const box = $('qAnswers'); box.textContent = '';
    (c.answers || []).forEach((a) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn';
      b.innerHTML = `${a.label} <kbd>${a.hot.toUpperCase()}</kbd>`;
      if (c.answered) {
        if (a.v === c.correct) b.classList.add('right');
        else if (a.v === c.picked) b.classList.add('wrong');
        b.disabled = a.v !== c.correct && a.v !== c.picked;
      }
      b.addEventListener('click', () => answer(a.v));
      box.appendChild(b);
    });

    $('qCheck').hidden = !c.build || c.answered;
    $('qClear').hidden = !c.build || c.answered;

    // feedback
    const fb = $('qFeedback');
    if (!c.answered) fb.textContent = '';
    else {
      const ok = c.build ? c.result.ok : c.picked === c.correct;
      const pair = `${c.shape} shape ↔ ${boxText(T.BOX_FOR[c.q][c.shape], c.q)} (${QNAME[c.q]})`;
      let detail = '';
      if (c.type === 'next') detail = `Going ${c.dir}: ${c.shape} → ${c.target}. The cycle is C A G E D.`;
      else if (c.build) detail = ok ? `${pair}.` : 'Green = correct, dashed red = missed, grey X = not a chord tone in this shape.';
      else detail = `${pair}. ${ROOT_TIPS[c.shape].replace(/<[^>]+>/g, '')}`;
      fb.innerHTML = `<span class="${ok ? 'ok' : 'no'}">${ok ? 'Correct.' : 'Not quite.'}</span> ${detail}`;
    }

    // weakest items
    const weak = Object.entries(stats)
      .filter(([, s]) => s.w > 0)
      .sort((a, b) => (a[1].r / (a[1].r + a[1].w)) - (b[1].r / (b[1].r + b[1].w)) || b[1].w - a[1].w)
      .slice(0, 6);
    $('qWeak').innerHTML = weak.length
      ? weak.map(([id, s]) => `<li>${itemLabel(id)} <span class="muted mono">${s.r}/${s.r + s.w}</span></li>`).join('')
      : '<li class="muted">Nothing missed yet.</li>';

    // question type toggles
    const qt = $('qtypes');
    if (!qt.childElementCount) {
      Object.entries(QTYPES).forEach(([k, label]) => {
        const l = document.createElement('label');
        l.innerHTML = `<input type="checkbox" id="qt-${k}"> ${label}`;
        l.querySelector('input').addEventListener('change', (e) => {
          state.quizTypes = e.target.checked ? [...new Set([...state.quizTypes, k])] : state.quizTypes.filter((t) => t !== k);
          save(); newQuestion();
        });
        qt.appendChild(l);
      });
    }
    Object.keys(QTYPES).forEach((k) => { $('qt-' + k).checked = state.quizTypes.includes(k); });
    setPressed($('quizQ'), state.quizQ);
    setPressed($('quizKeys'), state.quizKeys);
  }

  function bindQuiz() {
    $('qNext').addEventListener('click', newQuestion);
    $('qCheck').addEventListener('click', gradeBuild);
    $('qClear').addEventListener('click', () => { quiz.user = []; renderQuiz(); });
    $('qReset').addEventListener('click', () => {
      stats = {}; store.set('caged.stats', stats);
      quiz.session = { right: 0, total: 0, streak: 0, best: 0 }; store.set('caged.best', 0);
      renderQuiz();
    });
    $('quizQ').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { state.quizQ = b.dataset.v; save(); newQuestion(); }));
    $('quizKeys').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { state.quizKeys = b.dataset.v; save(); newQuestion(); }));
  }

  /* ---------- keyboard ---------- */
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'select' || tag === 'input' && e.target.type !== 'checkbox') return;
    const k = e.key.toLowerCase();
    if (k === 'm') { setQuality(state.q === 'maj' ? 'min' : 'maj'); return; }
    if (state.tab === 'explore') {
      if (k === 'arrowright') { e.preventDefault(); step('up'); }
      else if (k === 'arrowleft') { e.preventDefault(); step('down'); }
      else if ('cagedCAGED'.includes(e.key) && e.key.length === 1) setShape(e.key.toUpperCase());
      else if (k === '0') setShape('all');
      else if (k === ' ') { e.preventDefault(); playCurrent('chord'); }
      else if (k === 'r') playCurrent('arp');
      else if (k === 'b') playCurrent('box');
    } else {
      const c = quiz.current;
      if (!c) return;
      if (k === 'enter') {
        e.preventDefault();
        if (c.build && !c.answered) gradeBuild(); else if (c.answered) newQuestion();
        return;
      }
      const hit = (c.answers || []).find((a) => a.hot === k);
      if (hit) answer(hit.v);
    }
  });

  try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { renderAll(); if (state.tab === 'quiz') renderQuiz(); }); } catch (e) { /* older browsers */ }
  new MutationObserver(() => { renderAll(); if (state.tab === 'quiz') renderQuiz(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  buildControls();
  bindQuiz();
  renderControls();
  if (state.tab === 'quiz') newQuestion(); else renderExplore();
})();
