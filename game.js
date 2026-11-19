// Game console for The Price of Unity. The model itself is engine.js, copied unchanged from the book repository.
// This file only adds the classroom rules, the turn structure and the record keeping.
(() => {
'use strict';

const $ = id => document.getElementById(id);
const STORE = 'price-of-unity-game-v1';
const fmt = (v, d = 1) => (v === null || v === undefined || Number.isNaN(v)) ? '' : Number(v).toFixed(d);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

// ------------------------------------------------------------------ classroom rules
const TEAMS = [
  ['ig', 'Irish Government', [5, 5, 6], 'Dublin table'],
  ['pro', 'Pro-unity campaign, Northern Ireland', [4, 4, 5], 'Belfast table, left'],
  ['union', 'Pro-union campaign, Northern Ireland', [4, 4, 5], 'Belfast table, right'],
  ['uk', 'UK Treasury', [3, 4, 4], 'London table'],
  ['ec', 'European Commission', [3, 3, 3], 'Brussels table'],
  ['fc', 'Fiscal Council', [3, 3, 3], 'Front of room'],
  ['panel', "Citizens' Panel", [6, 8, 8], 'Centre of room'],
  ['desk', 'Simulator desk', [2, 2, 2], 'Beside the screen'],
];
const SIZES = {30: 0, 33: 1, 36: 2};
const DESIGNS = ['unitary', 'federal', 'glide', 'worst'];
const DESIGN_NOTES = {
  unitary: 'Pay and welfare reach Republic levels from day one.',
  federal: 'Pay and welfare reach Republic levels over 20 years, with a Northern Ireland administration kept in place.',
  glide: 'Pay and welfare reach Republic levels over 15 years, with extra spending in the first decade.',
  worst: 'Immediate harmonisation with no extra investment and a larger administration allowance.',
};
const CASE_KEYS = ['upper', 'middle', 'rateBased', 'lower'];
const CASE_NOTES = {upper: 'Full pay and welfare gaps, FitzGerald and Morgenroth (2024).', middle: 'Doyle (2025) pay gap with the full welfare gap.',
  rateBased: 'Doyle pay gap with welfare costed benefit by benefit.', lower: 'Doyle pay gap and no welfare gap.'};
const BANDS = {none: 1.3, credible: 2.0, ambitious: 3.0};
const TURN_END = [8, 16, 25], TURN_START = [1, 9, 17];
const PHASES = [['Corridor time', 4], ['Decision sheets', 6], ['Simulator run', 6], ['Fiscal Council', 2], ['Panel vote and event', 2]];
const CAMPAIGN = [
  ['A leaked costing', 'You give the panel the upper-case cost before either side speaks.'],
  ['A slowdown before the vote', 'The Fiscal Council must present its range with the lower growth rate of 1.3%.'],
  ['A large employer warns about pay', 'The pro-unity campaign must say at the hearing how it will protect local firms.'],
  ['A cross-community business group speaks out', 'Each campaign may add one extra minute at the hearing.'],
];
const EVENTS = [
  ['modelled', 'Productivity stalls in Northern Ireland', 'Cut Northern Ireland growth by 0.5 points from now on, unless both Northern teams sign a productivity plan next turn.'],
  ['modelled', 'Pay runs ahead of productivity', 'The Northern administration chooses pay restraint, which costs 1 support point, or a 0.5 point cut in growth.'],
  ['modelled', 'Investment boom', 'If the investment channel is on, add 0.5 points to growth for the next turn. This console does not model the channels, so record the event and discuss it in the debrief.'],
  ['modelled', 'Merger savings come slowly', 'If the integration channel is on, switch it off for one turn. This console does not model the channels, so record the event and discuss it in the debrief.'],
  ['modelled', 'EU budget review', 'The Commission must confirm or withdraw EU funding before the next turn.'],
  ['modelled', 'New UK government', 'The UK Treasury must decide again whether to keep any transition payment.'],
  ['narrative', 'Corporation tax receipts fall', 'The Irish Government must say how it will cover the gap, and the Fiscal Council rates the answer.'],
  ['narrative', 'Interest rates rise', 'The model holds the real interest rate at 2%, so record the event and discuss its effect in the debrief.'],
  ['narrative', 'A dispute over flags and symbols', 'The pro-union campaign may boycott next turn without losing support, unless the Irish Government offers a new guarantee.'],
];

// ------------------------------------------------------------------ state
const fresh = () => ({
  classSize: 36, hiddenCase: null, revealed: false,
  design: 'glide', unityYear: 2035, holdDeficit: false, guarantees: 3, promises: '',
  costGrowth: 2, campaign: null,
  polls: [], deal: 'fav', euLine: true, promiseGap: 0,
  stage: 'setup', act2Started: false, support: 5, govFell: null,
  growthBand: 'credible', councilRate: 3.5, eventAdj: 0, boycott: false, broken: 0,
  panel: null, eventSupport: 0, pendingEvent: null, eventsDrawn: [],
  euTransfer: 0, euTransferStart: 1, euTransferYears: 10,
  turns: [], lastRun: null,
  points: {objective: {}, brief: {}, guaranteesKept: false},
  log: [], tab: 'setup', voteTopic: null,
});
let S = load() || fresh();
const ROOM = new URLSearchParams(location.search).get('view') === 'room';
let channel = null;
try { channel = new BroadcastChannel('price-of-unity'); } catch (e) { /* older browser, the room screen then follows saved state only */ }

function load() { try { const raw = localStorage.getItem(STORE); return raw ? {...fresh(), ...JSON.parse(raw)} : null; } catch (e) { return null; } }
function save() {
  if (ROOM) return;
  try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* storage unavailable, export the game file instead */ }
  if (channel) channel.postMessage({type: 'state', state: S});
}

const turnNo = () => S.act2Started ? Math.min(S.turns.length + 1, 3) : 0;
const gameOver = () => S.turns.length >= 3;
const stageLabel = () => !S.act2Started ? (S.polls.length ? 'Act One, after the polls' : 'Act One') : gameOver() ? 'Debrief' : `Act Two, Turn ${turnNo()}`;

function logChange(setting, oldV, newV, results = '') {
  S.log.push({time: new Date().toLocaleTimeString('en-IE', {hour: '2-digit', minute: '2-digit'}), stage: stageLabel(),
    setting, old: oldV === undefined ? '' : String(oldV), new: newV === undefined ? '' : String(newV), source: '', results});
}

// ------------------------------------------------------------------ model wrapper
function run(caseKey, design, growth, fav, euOn) {
  const s = {...paperSettings(caseKey)};
  if (!euOn) { s.euContributionRate = 0; s.euReceipts = 0; }
  s.euTransfer = +S.euTransfer || 0; s.euTransferStart = +S.euTransferStart || 1; s.euTransferYears = +S.euTransferYears || 0;
  const p = policy(design, growth, fav);
  const rows = simulate(p, s);
  return {rows, checks: checks(rows), need: growthNeeded(p, s, repaid)};
}
// Range across all four harmonisation cases for one set of decisions, year by year.
function fan(design, growth, fav, euOn) {
  const runs = CASE_KEYS.map(c => run(c, design, growth, fav, euOn).rows);
  const band = key => runs[0].map((_, i) => { const v = runs.map(r => r[i][key]); return [i + 1, Math.min(...v), Math.max(...v)]; });
  return {cost: band('cost'), debt: band('totalDebtPct'), burden: runs[0].map(r => [r.year, r.burdenLimit]),
          end: CASE_KEYS.map((c, i) => [c, runs[i][24].totalDebtPct, Math.max(...runs[i].map(r => r.totalDebtPct))])};
}
function turnGrowth() {
  const base = S.growthBand === 'council' ? +S.councilRate : BANDS[S.growthBand];
  return Math.round((base + (+S.eventAdj || 0))*100)/100;
}
function history(extra) {
  const rows = [];
  S.turns.forEach((t, i) => rows.push(...t.rows));
  if (extra) rows.push(...extra);
  return rows;
}
function checksToDate(rows) {
  const last = rows.length ? rows[rows.length - 1].year : 0;
  const debt = rows.every(r => r.totalDebtPct < 80), burden = rows.every(r => r.costPctGni <= 2);
  let falling = null;
  if (last >= 25) falling = rows.filter(r => r.year >= 20).every(r => r.cost < rows[r.year - 2].cost);
  return {debt, burden, falling, firstDebtFail: rows.find(r => r.totalDebtPct >= 80)?.year};
}
const slim = r => ({year: r.year, cost: r.cost, totalDebtPct: r.totalDebtPct, costPctGni: r.costPctGni, burdenLimit: r.burdenLimit, borrowing: r.borrowing, cumulative: r.cumulative});

// ------------------------------------------------------------------ verification against the paper
function verify() {
  let n = 0, bad = 0;
  for (const [key, pub] of Object.entries(PAPER_VALUES)) {
    const [c, rest] = key.split('|'), i = rest.lastIndexOf('_'), f = rest.slice(0, i), fav = rest.slice(i + 1) === 'fav';
    const p = policy(f, 2, fav), s = paperSettings(c), r = simulate(p, s);
    [Math.round(r[0].cost*10)/10, Math.round(r[24].cost*10)/10, growthNeeded(p, s, repaid)].forEach((v, j) => { n++; if (Math.abs(v - pub[j]) > 1e-9) bad++; });
  }
  const el = $('verify');
  el.className = 'banner ' + (bad ? 'no' : 'ok');
  el.textContent = bad ? `${bad} of ${n} published numbers differ from paper version 3.14. Do not use this console in class until it is fixed.`
                       : `Model check passed. All ${n} published numbers from paper version 3.14 were reproduced when this page opened.`;
}

// ------------------------------------------------------------------ charts
function chart(svg, opts) {
  const W = 640, H = 260, L = 46, R = 14, T = 14, B = 30;
  const bands = opts.bands || [];
  const all = [...opts.series.flatMap(s => s.pts.map(p => p[1])), ...opts.limit.map(p => p[1]), ...bands.flatMap(b => b.pts.flatMap(p => [p[1], p[2]])), 0];
  let lo = Math.min(...all), hi = Math.max(...all);
  const raw = (hi - lo || 1)/5, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m*mag).find(s => s >= raw);
  lo = Math.floor(lo/step)*step; hi = Math.ceil(hi/step)*step;
  if (hi <= lo) hi = lo + step*5;
  const x = v => L + (v - 1)/24*(W - L - R), y = v => T + (hi - v)/(hi - lo)*(H - T - B);
  let g = '';
  for (let v = lo; v <= hi + 1e-9; v += step) {
    g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--rule)" stroke-width="${Math.abs(v) < 1e-9 ? 1.2 : .7}"/>`;
    g += `<text x="${L - 6}" y="${y(v) + 3.5}" text-anchor="end">${+v.toFixed(2)}${opts.unit}</text>`;
  }
  if (opts.turns !== false) [8.5, 16.5].forEach((b, i) => { g += `<line x1="${x(b)}" x2="${x(b)}" y1="${T}" y2="${H - B}" stroke="var(--rule)" stroke-dasharray="2 3"/>`; });
  if (opts.turns !== false) ['Turn 1', 'Turn 2', 'Turn 3'].forEach((t, i) => { g += `<text x="${x([4.5, 12.5, 21][i])}" y="${T + 10}" text-anchor="middle">${t}</text>`; });
  [1, 5, 10, 15, 20, 25].forEach(t => g += `<text x="${x(t)}" y="${H - 10}" text-anchor="middle">${t}</text>`);
  const path = pts => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join('');
  for (const b of bands) if (b.pts.length) {
    const top = b.pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[2]).toFixed(1)}`).join('');
    const bot = b.pts.slice().reverse().map(p => `L${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join('');
    g += `<path d="${top}${bot}Z" fill="${b.fill}" stroke="none"/>`;
  }
  if (opts.limit.length) g += `<path d="${path(opts.limit)}" fill="none" stroke="var(--limit)" stroke-width="1.3" stroke-dasharray="1.5 3.5"/>`;
  for (const s of opts.series) if (s.pts.length) {
    g += `<path d="${path(s.pts)}" fill="none" stroke="${s.color}" stroke-width="${s.w || 2.6}" ${s.dash ? 'stroke-dasharray="6 4"' : ''} opacity="${s.op || 1}" stroke-linejoin="round"/>`;
  }
  svg.innerHTML = g;
}

// ------------------------------------------------------------------ rendering
function render() {
  if (ROOM) { renderStatus(); renderAct1(); renderScore(); renderRoom(); return; }
  // tabs
  document.querySelectorAll('#tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === S.tab)));
  document.querySelectorAll('section[data-panel]').forEach(p => p.hidden = p.dataset.panel !== S.tab);
  renderStatus(); renderSetup(); renderAct1(); renderAct2(); renderScore(); renderLog(); renderDebrief();
  if (S.tab === 'vote' && window.LiveVote) LiveVote.show($('voteBox'), S.voteTopic);
  if (S.tab === 'feedback') renderFeedback();
  save();
}

function renderStatus() {
  const meter = Array.from({length: 10}, (_, i) => `<i class="${i < S.support ? 'on' : ''}"></i>`).join('');
  const caseText = !S.hiddenCase ? 'not set' : S.revealed ? CASE_LABELS[S.hiddenCase].toLowerCase() : 'set and hidden';
  $('status').innerHTML = `<span class="chip">${esc(stageLabel())}</span>` +
    `<span class="chip">Year of unity <b>${S.unityYear}</b></span>` +
    `<span class="chip">Harmonisation case, ${caseText}</span>` +
    (S.act2Started ? `<span class="chip">Support <b>${S.support}</b> of 10<span class="meter">${meter}</span></span>` : '');
}

function legend(items) {
  return '<div class="legend">' + items.map(([style, label]) => `<span><i ${style}></i>${label}</span>`).join('') + '</div>';
}
function renderRoom() {
  document.querySelectorAll('section[data-panel]').forEach(p => p.hidden = p.dataset.panel !== 'room');
  const body = $('roomBody'), act2 = S.act2Started;
  if (S.tab === 'vote' && S.voteTopic && window.LiveVote) {
    $('roomTimer').hidden = true; $('roomTitle').textContent = 'Live vote';
    const box = document.createElement('div'); box.className = 'card'; body.replaceChildren(box);
    LiveVote.show(box, S.voteTopic); return;
  }
  $('roomTimer').hidden = !act2 || gameOver();
  if (!act2) {
    $('roomTitle').textContent = S.polls.some(p => p.passed) ? 'Act One, unity approved' : 'Act One, the lead-up';
    const last = S.polls[S.polls.length - 1];
    body.innerHTML = `<div class="stats">
        <div class="stat"><div class="lab">Design in the prospectus</div><div class="val">${esc(FORMS[S.design].name)}</div></div>
        <div class="stat"><div class="lab">Year of unity</div><div class="val">${S.unityYear}</div></div>
        <div class="stat"><div class="lab">Northern Ireland poll</div><div class="val">${last ? `${last.niYes} to ${last.niNo}` : 'not held'}</div></div>
        <div class="stat"><div class="lab">Republic poll</div><div class="val">${last ? `${last.roiYes} to ${last.roiNo}` : 'not held'}</div></div></div>
      <div class="roomgrid">
        <div class="card"><h2>Cost range for the hearing, at ${fmt(+S.costGrowth)}% growth</h2><div class="tablewrap"><table>${costTableHtml}</table></div></div>
        <div class="card"><figure><figcaption>Total State debt across all four harmonisation cases, %</figcaption>
          ${legend([['class="band" style="background:var(--accent-band)"', 'Favourable deal'], ['class="band" style="background:var(--debt-band)"', 'Adverse deal'], ['style="border-color:var(--limit);border-top-style:dotted"', '80% ceiling']])}
          <svg class="chart" id="roomFan" viewBox="0 0 640 260"></svg></figure>
          ${S.campaign === null ? '' : card('Campaign card', CAMPAIGN[S.campaign][0], CAMPAIGN[S.campaign][1])}</div>
      </div>`;
    drawActOneFan($('roomFan'));
    return;
  }
  if (gameOver()) {
    $('roomTitle').textContent = 'The debrief';
    body.innerHTML = `<div class="card"><h2>Act Two scoreboard</h2><div class="tablewrap"><table>${act2TableHtml}</table></div></div>`;
    return;
  }
  const v = act2View();
  $('roomTitle').textContent = `Turn ${v.n}, years ${TURN_START[v.n - 1]} to ${TURN_END[v.n - 1]}`;
  const ev = S.pendingEvent === null ? '' : card('Event card, ' + EVENTS[S.pendingEvent][0], EVENTS[S.pendingEvent][1], EVENTS[S.pendingEvent][2]);
  const reveal = S.revealed ? `<p><span class="pill pass">Revealed</span> The ${esc(CASE_LABELS[S.hiddenCase].toLowerCase())} case. ${esc(CASE_NOTES[S.hiddenCase])}</p>` : '';
  body.innerHTML = `<div class="stats">${statsHtml(v)}</div><div class="inline" style="margin-bottom:14px">${checksHtml(v)}</div>${reveal}
    <div class="roomgrid">
      <figure class="card"><figcaption>Yearly cost to the Exchequer, € billion, 2023 prices</figcaption>
        ${legend([...(v.fan ? [['class="band" style="background:var(--accent-band)"', 'Range across the four cases']] : []), ['style="border-color:var(--accent)"', 'Recorded history'], ['style="border-color:var(--accent);border-top-style:dashed"', 'This run'], ['style="border-color:var(--limit);border-top-style:dotted"', 'Burden limit']])}
        <svg class="chart" id="roomCost" viewBox="0 0 640 260"></svg></figure>
      <figure class="card"><figcaption>Total State debt, % of GNI* plus Northern Ireland output</figcaption>
        ${legend([...(v.fan ? [['class="band" style="background:var(--debt-band)"', 'Range across the four cases']] : []), ['style="border-color:var(--debt)"', 'Recorded history'], ['style="border-color:var(--debt);border-top-style:dashed"', 'This run'], ['style="border-color:var(--limit);border-top-style:dotted"', '80% ceiling']])}
        <svg class="chart" id="roomDebt" viewBox="0 0 640 260"></svg></figure>
    </div>${ev}`;
  drawAct2Charts($('roomCost'), $('roomDebt'), v);
}

const REPO = 'https://github.com/skinsella/unity-game';
const FEEDBACK_LINKS = {Feedback: `${REPO}/issues/new?template=feedback.yml`, Change: `${REPO}/issues/new?template=change.yml`, Code: `${REPO}/blob/main/CONTRIBUTING.md`};
function renderFeedback() {
  for (const [k, url] of Object.entries(FEEDBACK_LINKS)) {
    $('link' + k).href = url;
    const box = $('qr' + k);
    if (!box.firstChild && window.qrcode) { const q = qrcode(0, 'M'); q.addData(url); q.make(); box.innerHTML = q.createSvgTag({cellSize: 6, margin: 2, scalable: true}); }
  }
}

function renderSetup() {
  $('classSize').value = String(S.classSize);
  const k = SIZES[S.classSize];
  $('teamTable').innerHTML = '<tr><th>Team</th><th class="num">Students</th><th>Base</th></tr>' +
    TEAMS.map(t => `<tr><td>${esc(t[1])}</td><td class="num">${t[2][k]}</td><td>${esc(t[3])}</td></tr>`).join('') +
    `<tr><th>Total</th><th class="num">${TEAMS.reduce((a, t) => a + t[2][k], 0)}</th><th></th></tr>`;
  $('caseState').textContent = !S.hiddenCase ? 'No case set yet.' : S.revealed ? `Revealed, ${CASE_LABELS[S.hiddenCase]} case.` : 'Case set and hidden.';
  $('drawCase').disabled = $('setCase').disabled = !!S.hiddenCase && S.act2Started;
}

function renderAct1() {
  $('design').innerHTML = DESIGNS.map(d => `<option value="${d}">${FORMS[d].name}</option>`).join('');
  $('design').value = S.design; $('designNote').textContent = DESIGN_NOTES[S.design];
  $('unityYear').value = S.unityYear; $('holdDeficit').checked = S.holdDeficit;
  $('guarantees').value = S.guarantees;
  if (document.activeElement !== $('promises')) $('promises').value = S.promises;
  $('costGrowth').value = String(S.costGrowth);
  const lock = S.act2Started;
  ['design', 'unityYear', 'holdDeficit', 'recordPoll', 'startAct2'].forEach(id => $(id).disabled = lock);

  // cost range
  const rows = [];
  for (const c of ['upper', 'lower']) for (const fav of [true, false]) {
    const r = run(c, S.design, +S.costGrowth, fav, S.euLine), last = r.rows[24];
    const peak = Math.max(...r.rows.map(x => x.totalDebtPct));
    const passed = [r.checks.debt, r.checks.burden, r.checks.falling].filter(Boolean).length;
    rows.push(`<tr><td>${CASE_LABELS[c]} case</td><td>${fav ? 'Favourable' : 'Adverse'}</td><td class="num">${fmt(r.rows[0].cost)}</td><td class="num">${fmt(last.cost)}</td><td class="num">${fmt(peak)}%</td><td class="num">${passed} of 3</td><td class="num">${r.need === null ? 'above 7%' : fmt(r.need) + '%'}</td></tr>`);
  }
  costTableHtml = '<tr><th>Case</th><th>Deal</th><th class="num">Year 1 cost, €bn</th><th class="num">Year 25 cost, €bn</th><th class="num">Peak debt</th><th class="num">Checks held</th><th class="num">Growth needed to repay</th></tr>' + rows.join('');
  $('costTable').innerHTML = costTableHtml;
  drawActOneFan($('fanChart'));

  $('campaignCard').innerHTML = S.campaign === null ? '' : card('Campaign card', CAMPAIGN[S.campaign][0], CAMPAIGN[S.campaign][1]);
  $('drawCampaign').disabled = S.campaign !== null;

  // polls
  const att = S.polls.length;
  const passed = S.polls.some(p => p.passed);
  $('pollIntro').textContent = passed ? 'Unity was approved.' : att === 0 ? 'Enter the secret ballot counts for each half of the panel. A tie counts as a no.'
    : att === 1 ? `The first attempt failed, so the clock moved seven years to ${S.unityYear}. The prospectus may be revised once before the second attempt.`
    : 'Both attempts failed. Play Act Two as a what-if on the revised terms, with support starting at 3.';
  $('recordPoll').disabled = lock || passed || att >= 2;
  $('pollResult').innerHTML = S.polls.map(p => `<p><span class="pill ${p.passed ? 'pass' : 'fail'}">Attempt ${p.attempt}, ${p.passed ? 'passed' : 'failed'}</span> Northern Ireland ${p.niYes} yes to ${p.niNo} no. Republic ${p.roiYes} yes to ${p.roiNo} no.</p>`).join('');

  document.querySelectorAll('input[name=deal]').forEach(r => { r.checked = r.value === S.deal; r.disabled = lock; });
  $('euLine').checked = S.euLine; $('euLine').disabled = lock;
  $('promiseGap').value = S.promiseGap; $('promiseGap').disabled = lock;
  document.querySelectorAll('[data-eut]').forEach(el => { if (document.activeElement !== el) el.value = S[el.dataset.eut]; el.disabled = gameOver(); });
  $('startAct2').disabled = lock || !(passed || att >= 2) || !S.hiddenCase;
  $('startAct2').title = !S.hiddenCase ? 'Set the hidden case in Setup first' : '';
}

let costTableHtml = '';
function drawActOneFan(svg) {
  const fv = fan(S.design, +S.costGrowth, true, S.euLine), ad = fan(S.design, +S.costGrowth, false, S.euLine);
  chart(svg, {unit: '%', series: [], turns: false, limit: [[1, 80], [25, 80]],
    bands: [{pts: ad.debt, fill: 'var(--debt-band)'}, {pts: fv.debt, fill: 'var(--accent-band)'}]});
}
const card = (kind, title, text) => `<div class="eventcard"><div class="kind">${esc(kind)}</div><div class="title">${esc(title)}</div><div>${esc(text)}</div></div>`;

function renderAct2() {
  const n = turnNo();
  $('turnTitle').textContent = !S.act2Started ? 'Act Two starts after the polls and the negotiation' : gameOver() ? 'All three turns recorded. Go to the debrief' : `Turn ${n}, years ${TURN_START[n - 1]} to ${TURN_END[n - 1]}`;
  $('growthBand').value = S.growthBand; $('councilField').hidden = S.growthBand !== 'council';
  $('councilRate').value = S.councilRate; $('eventAdj').value = S.eventAdj;
  $('boycott').checked = S.boycott; $('broken').value = S.broken;
  document.querySelectorAll('input[name=deal2]').forEach(r => r.checked = r.value === S.deal);
  $('euLine2').checked = S.euLine;
  document.querySelectorAll('input[name=panel]').forEach(r => r.checked = S.panel !== null && +r.value === S.panel);
  $('eventSupport').value = S.eventSupport;
  $('eventCard').innerHTML = S.pendingEvent === null ? '' : card('Event card, ' + EVENTS[S.pendingEvent][0], EVENTS[S.pendingEvent][1], EVENTS[S.pendingEvent][2]);
  const live = S.act2Started && !gameOver();
  ['runTurn', 'growthBand', 'councilRate', 'eventAdj', 'boycott', 'broken', 'euLine2', 'eventSupport'].forEach(id => $(id).disabled = !live);
  document.querySelectorAll('input[name=deal2],input[name=panel]').forEach(r => r.disabled = !live);
  $('drawEvent').disabled = !live || S.pendingEvent !== null || S.eventsDrawn.length >= EVENTS.length;
  $('recordTurn').disabled = !live || !S.lastRun || S.lastRun.turn !== n || S.panel === null;
  $('revealCase').disabled = S.revealed || S.turns.length < 1;
  $('revealText').innerHTML = S.revealed ? `<span class="pill pass">Revealed</span> The ${esc(CASE_LABELS[S.hiddenCase].toLowerCase())} case. ${esc(CASE_NOTES[S.hiddenCase])}` : '';

  const v = act2View();
  $('turnStats').innerHTML = statsHtml(v);
  $('turnChecks').innerHTML = checksHtml(v);
  document.querySelectorAll('.fanleg').forEach(el => el.hidden = !v.fan);
  drawAct2Charts($('costChart'), $('debtChart'), v);
}

function act2View() {
  const n = turnNo(), live = S.act2Started && !gameOver();
  const lr = S.lastRun && S.lastRun.turn === n && live ? S.lastRun : null;
  const end = lr ? TURN_END[n - 1] : 0;
  const shown = lr ? lr.rows.filter(r => r.year >= TURN_START[n - 1] && r.year <= end) : [];
  const hist = history(shown), recorded = history();
  const last = S.turns[S.turns.length - 1];
  // The fan is shown only while no figures from the hidden case are on screen, so it cannot give the case away.
  const showFan = S.act2Started && live && !S.revealed && S.turns.length === 0 && !lr;
  return {n, live, lr, hist, recorded, ck: checksToDate(hist), lastRow: hist[hist.length - 1],
    runPts: lr ? lr.rows.filter(r => r.year <= end) : [],
    g: lr ? lr.growth : (last ? last.growth : turnGrowth()), need: lr ? lr.need : (last ? last.need : null),
    fan: showFan ? fan(S.design, turnGrowth(), S.deal === 'fav', S.euLine) : null};
}
function statsHtml(v) {
  return [
    ['Design', FORMS[S.design].name],
    ['Northern Ireland growth', fmt(v.g) + '%'],
    ['Yearly cost, latest year', v.lastRow ? '€' + fmt(v.lastRow.cost) + 'bn' : 'not run'],
    ['Total State debt', v.lastRow ? fmt(v.lastRow.totalDebtPct) + '%' : 'not run'],
    ['Transition borrowing', v.lastRow ? '€' + fmt(v.lastRow.borrowing) + 'bn' : 'not run'],
    ['EU transfer', +S.euTransfer > 0 && +S.euTransferYears > 0 ? `€${fmt(+S.euTransfer)}bn, years ${S.euTransferStart} to ${+S.euTransferStart + +S.euTransferYears - 1}` : 'none'],
    ['Growth needed to repay in 25 years', v.need === null ? (v.lastRow ? 'above 7%' : 'not run') : fmt(v.need) + '%'],
  ].map(([l, x]) => `<div class="stat"><div class="lab">${l}</div><div class="val">${esc(x)}</div></div>`).join('');
}
function checksHtml(v) {
  const ck = v.ck;
  return v.hist.length ? [
    ['Debt check', ck.debt, ck.debt ? 'below 80% so far' : `crossed 80% in year ${ck.firstDebtFail}`],
    ['Burden check', ck.burden, ck.burden ? 'cost within 2% of GNI* so far' : 'cost above 2% of GNI*'],
    ['Falling check', ck.falling, ck.falling === null ? 'tested in years 20 to 25' : ck.falling ? 'cost falls from year 20' : 'cost does not fall from year 20'],
  ].map(([nm, ok, why]) => `<span class="pill ${ok === null ? 'wait' : ok ? 'pass' : 'fail'}">${nm}, ${why}</span>`).join('') : '';
}
function drawAct2Charts(costSvg, debtSvg, v) {
  chart(costSvg, {unit: '', series: [
      {pts: v.runPts.map(r => [r.year, r.cost]), color: 'var(--accent)', dash: true, w: 2, op: .8},
      {pts: v.recorded.map(r => [r.year, r.cost]), color: 'var(--accent)'}],
    bands: v.fan ? [{pts: v.fan.cost, fill: 'var(--accent-band)'}] : [],
    limit: v.hist.length ? v.hist.map(r => [r.year, r.burdenLimit]) : (v.fan ? v.fan.burden : [])});
  chart(debtSvg, {unit: '%', series: [
      {pts: v.runPts.map(r => [r.year, r.totalDebtPct]), color: 'var(--debt)', dash: true, w: 2, op: .8},
      {pts: v.recorded.map(r => [r.year, r.totalDebtPct]), color: 'var(--debt)'}],
    bands: v.fan ? [{pts: v.fan.debt, fill: 'var(--debt-band)'}] : [],
    limit: [[1, 80], [25, 80]]});
}

let act2TableHtml = '';
function renderScore() {
  const p1 = S.polls[0], pLast = S.polls[S.polls.length - 1];
  const rec = [
    ['Design', FORMS[S.design].name],
    ['Year of unity', S.unityYear],
    ['Deficit share held until unity', S.holdDeficit ? 'Yes' : 'No'],
    ['Northern Ireland poll, yes and no', pLast ? `${pLast.niYes} to ${pLast.niNo}` : ''],
    ['Republic poll, yes and no', pLast ? `${pLast.roiYes} to ${pLast.roiNo}` : ''],
    ['Second attempt needed', S.polls.length ? (S.polls.length > 1 ? 'Yes' : 'No') : ''],
    ['Deal on pensions and debt interest', S.act2Started ? (S.deal === 'fav' ? 'Favourable' : 'Adverse') : ''],
    ['EU budget line', S.act2Started ? (S.euLine ? 'Included' : 'Left out') : ''],
    ['Guarantees agreed', S.guarantees],
  ];
  $('act1Table').innerHTML = '<tr><th>Item</th><th>Result</th></tr>' + rec.map(([a, b]) => `<tr><td>${a}</td><td>${esc(b)}</td></tr>`).join('');

  const pill = v => v === null ? '<span class="pill wait">later</span>' : `<span class="pill ${v ? 'pass' : 'fail'}">${v ? 'holds' : 'fails'}</span>`;
  act2TableHtml = '<tr><th>Turn</th><th>Years</th><th class="num">Growth</th><th class="num">Yearly cost at end, €bn</th><th class="num">State debt</th><th>Burden</th><th>Debt</th><th>Falling</th><th class="num">Support</th><th>Pro-union</th><th class="num">Promises broken</th><th>Event card</th></tr>' +
    [0, 1, 2].map(i => { const t = S.turns[i];
      if (!t) return `<tr><td>${i + 1}</td><td>${TURN_START[i]} to ${TURN_END[i]}</td><td colspan="10" class="muted">not played yet</td></tr>`;
      const last = t.rows[t.rows.length - 1];
      return `<tr><td>${i + 1}</td><td>${TURN_START[i]} to ${TURN_END[i]}</td><td class="num">${fmt(t.growth)}%</td><td class="num">${fmt(last.cost)}</td><td class="num">${fmt(last.totalDebtPct)}%</td><td>${pill(t.checks.burden)}</td><td>${pill(t.checks.debt)}</td><td>${pill(t.checks.falling)}</td><td class="num">${t.support}</td><td>${t.boycott ? 'Out' : 'In'}</td><td class="num">${t.broken}</td><td>${t.event === null ? '' : esc(EVENTS[t.event][1])}</td></tr>`; }).join('');
  $('act2Table').innerHTML = act2TableHtml;

  // points
  const first = S.polls[0];
  const pollWin = first ? first.passed : null, niNo = first ? first.niYes <= first.niNo : null;
  const final = gameOver() ? S.turns[2].checks : null;
  const held = final ? [final.debt, final.burden, final.falling].filter(Boolean).length : null;
  const k = Object.fromEntries(TEAMS.map(t => [t[0], 0]));
  const rows = [];
  const add = (label, pts, teams, auto) => { if (pts) teams.forEach(t => k[t] += pts); rows.push([label, auto, teams.map(t => TEAMS.find(x => x[0] === t)[1].split(',')[0]).join(', '), pts]); };
  add('Both polls won at the first attempt', pollWin ? 3 : 0, ['ig', 'pro'], pollWin === null ? 'waiting' : pollWin ? 'yes' : 'no');
  add('A no vote in Northern Ireland at the first attempt', niNo ? 5 : 0, ['union'], niNo === null ? 'waiting' : niNo ? 'yes' : 'no');
  add('Three guarantees agreed and all kept', S.points.guaranteesKept ? 5 : 0, ['union'], `<label class="check"><input type="checkbox" data-pt="guarantees" ${S.points.guaranteesKept ? 'checked' : ''}> kept</label>`);
  add('Fiscal checks still holding at year 25, 3 each', held ? 3*held : 0, ['ig', 'pro', 'ec'], held === null ? 'after Turn 3' : `${held} of 3`);
  add('Final support meter, 1 a point', gameOver() ? S.support : 0, ['ig', 'pro'], gameOver() ? String(S.support) : 'after Turn 3');
  let html = '<tr><th>Source</th><th>Result</th><th>Who earns them</th><th class="num">Points each</th></tr>' + rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td class="num">${r[3]}</td></tr>`).join('');
  html += '<tr><th>Team</th><th>Private objective met, 5</th><th>Brief to Cabinet, up to 5</th><th class="num">Total</th></tr>';
  html += TEAMS.map(([key, name]) => {
    const obj = S.points.objective[key] ? 5 : 0, brief = +S.points.brief[key] || 0;
    return `<tr><td>${esc(name)}</td><td><label class="check"><input type="checkbox" data-pt="obj" data-team="${key}" ${obj ? 'checked' : ''}> met</label></td><td><input type="number" min="0" max="5" step="1" style="width:70px" data-pt="brief" data-team="${key}" value="${S.points.brief[key] ?? ''}"></td><td class="num"><b>${k[key] + obj + brief}</b></td></tr>`;
  }).join('');
  $('pointsTable').innerHTML = html;
}

function renderLog() {
  $('logTable').innerHTML = '<tr><th>Stage</th><th>Time</th><th>Setting</th><th>Old</th><th>New</th><th>Decision sheet that asked for it</th><th>Results shown</th></tr>' +
    S.log.map((e, i) => `<tr><td>${esc(e.stage)}</td><td class="num">${esc(e.time)}</td><td>${esc(e.setting)}</td><td>${esc(e.old)}</td><td>${esc(e.new)}</td><td><input type="text" data-log="${i}" value="${esc(e.source)}"></td><td class="small">${esc(e.results)}</td></tr>`).join('');
}

function finalSettings() {
  const t = S.turns[S.turns.length - 1];
  return {caseKey: S.hiddenCase || 'upper', design: S.design, growth: t ? t.growth : turnGrowth(), fav: S.deal === 'fav', eu: S.euLine};
}
function renderDebrief() {
  if (S.tab !== 'debrief') return;
  const f = finalSettings();
  const base = run(f.caseKey, f.design, f.growth, f.fav, f.eu), b25 = base.rows[24].totalDebtPct;
  const caseName = c => (S.revealed || c !== S.hiddenCase) ? CASE_LABELS[c] + ' case' : 'the hidden case';
  const tests = [
    [`Growth ${fmt(f.growth - 1)}% instead of ${fmt(f.growth)}%`, {...f, growth: f.growth - 1}],
    [`Growth ${fmt(f.growth + 1)}% instead of ${fmt(f.growth)}%`, {...f, growth: f.growth + 1}],
    [`${f.fav ? 'Adverse' : 'Favourable'} deal instead`, {...f, fav: !f.fav}],
    [`EU budget line ${f.eu ? 'left out' : 'included'}`, {...f, eu: !f.eu}],
    ...(+S.euTransfer > 0 && +S.euTransferYears > 0 ? [['No EU transfer', {...f, noTransfer: true}]] : []),
    ...CASE_KEYS.filter(c => c !== f.caseKey).map(c => [`${CASE_LABELS[c]} case instead of ${caseName(f.caseKey)}`, {...f, caseKey: c}]),
    ...DESIGNS.filter(d => d !== f.design).map(d => [`${FORMS[d].name} design instead`, {...f, design: d}]),
  ].map(([label, g]) => { const keep = S.euTransfer; if (g.noTransfer) S.euTransfer = 0; const r = run(g.caseKey, g.design, g.growth, g.fav, g.eu); S.euTransfer = keep; return [label, r.rows[24].totalDebtPct, r.rows[24].totalDebtPct - b25]; })
   .sort((a, b) => Math.abs(b[2]) - Math.abs(a[2]));
  const max = Math.max(...tests.map(t => Math.abs(t[2])), 1);
  $('sensTable').innerHTML = `<tr><th>Change from the final settings</th><th class="num">Year 25 debt</th><th class="num">Change, points</th><th style="width:34%"></th></tr>` +
    `<tr><td><b>Final settings</b>, ${FORMS[f.design].name}, ${f.fav ? 'favourable' : 'adverse'} deal, ${fmt(f.growth)}% growth</td><td class="num">${fmt(b25)}%</td><td class="num"></td><td></td></tr>` +
    tests.map(([l, v, d]) => `<tr><td>${esc(l)}</td><td class="num">${fmt(v)}%</td><td class="num">${d > 0 ? '+' : ''}${fmt(d)}</td><td><svg viewBox="0 0 200 12" style="width:100%;height:12px"><line x1="100" x2="100" y1="0" y2="12" stroke="var(--rule)"/><rect x="${d < 0 ? 100 + 100*d/max : 100}" y="2" width="${Math.abs(100*d/max)}" height="8" fill="${d > 0 ? 'var(--debt)' : 'var(--accent)'}"/></svg></td></tr>`).join('');
  $('pathTable').innerHTML = '<tr><th class="num">Year</th><th class="num">Yearly cost, €bn</th><th class="num">Cost, % of GNI*</th><th class="num">Transition borrowing, €bn</th><th class="num">Total State debt</th></tr>' +
    base.rows.map(r => `<tr><td class="num">${r.year}</td><td class="num">${fmt(r.cost, 2)}</td><td class="num">${fmt(r.costPctGni, 2)}</td><td class="num">${fmt(r.borrowing, 1)}</td><td class="num">${fmt(r.totalDebtPct, 1)}%</td></tr>`).join('');
  S._pathRows = base.rows.map(slim);
}

// ------------------------------------------------------------------ actions
function set(key, value, label, shown) {
  const old = S[key];
  if (String(old) === String(value)) return;
  S[key] = value;
  logChange(label, shown ? shown(old) : old, shown ? shown(value) : value);
  render();
}
const yesNo = v => v ? 'Yes' : 'No';
const dealName = v => v === 'fav' ? 'Favourable' : 'Adverse';

$('newVote').addEventListener('click', () => { S.voteTopic = LiveVote.newTopic(); logChange('Live vote', '', 'new vote started'); render(); });
$('openRoom').addEventListener('click', () => window.open(location.pathname + '?view=room', 'price-of-unity-room'));
if (channel) channel.onmessage = e => {
  const m = e.data || {};
  if (ROOM && m.type === 'state') { S = {...fresh(), ...m.state}; render(); }
  if (ROOM && m.type === 'timer') { timerView = m; drawRoomTimer(); }
  if (!ROOM && m.type === 'hello') { save(); sendTimer(); }
};
window.addEventListener('storage', e => { if (ROOM && e.key === STORE) { const x = load(); if (x) { S = x; render(); } } });
$('tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { S.tab = b.dataset.tab; render(); } });
$('classSize').addEventListener('change', e => { S.classSize = +e.target.value; render(); });

function setCase(key, how) {
  if (S.hiddenCase && !confirm('A case is already set. Replace it?')) return;
  S.hiddenCase = key; S.revealed = false;
  logChange('Harmonisation case', '', 'set and hidden, ' + how);
  render();
}
$('drawCase').addEventListener('click', () => {
  const a = new Uint32Array(1); crypto.getRandomValues(a);
  setCase(CASE_KEYS[a[0] % 4], 'drawn by the page');
});
$('setCase').addEventListener('click', () => { const v = $('enterCase').value; if (v) { setCase(v, 'entered from the card deck'); $('enterCase').value = ''; } });

$('design').addEventListener('change', e => set('design', e.target.value, 'Design', d => FORMS[d].name));
$('unityYear').addEventListener('change', e => set('unityYear', Math.round(+e.target.value), 'Year of unity'));
$('holdDeficit').addEventListener('change', e => set('holdDeficit', e.target.checked, 'Hold deficit share until unity', yesNo));
$('guarantees').addEventListener('change', e => set('guarantees', Math.max(0, Math.round(+e.target.value)), 'Guarantees offered'));
$('promises').addEventListener('change', e => { S.promises = e.target.value; save(); });
$('costGrowth').addEventListener('change', e => { S.costGrowth = +e.target.value; render(); });
$('drawCampaign').addEventListener('click', () => { S.campaign = Math.floor(Math.random()*CAMPAIGN.length); logChange('Campaign card', '', CAMPAIGN[S.campaign][0]); render(); });

$('recordPoll').addEventListener('click', () => {
  const v = ['niYes', 'niNo', 'roiYes', 'roiNo'].map(id => Math.max(0, Math.round(+$(id).value || 0)));
  if (v.every(x => x === 0)) { alertBox('Enter the ballot counts first.'); return; }
  const [niYes, niNo, roiYes, roiNo] = v, passed = niYes > niNo && roiYes > roiNo, attempt = S.polls.length + 1;
  S.polls.push({attempt, niYes, niNo, roiYes, roiNo, passed});
  logChange(`Polls, attempt ${attempt}`, '', `NI ${niYes} to ${niNo}, Republic ${roiYes} to ${roiNo}, ${passed ? 'passed' : 'failed'}`);
  if (!passed && attempt === 1) { const o = S.unityYear; S.unityYear = o + 7; logChange('Year of unity', o, S.unityYear); }
  ['niYes', 'niNo', 'roiYes', 'roiNo'].forEach(id => $(id).value = '');
  render();
});
function alertBox(msg) { $('pollResult').insertAdjacentHTML('afterbegin', `<p class="banner warn">${esc(msg)}</p>`); }

document.querySelectorAll('input[name=deal],input[name=deal2]').forEach(r => r.addEventListener('change', e => set('deal', e.target.value, 'Deal with the UK', dealName)));
['euLine', 'euLine2'].forEach(id => $(id).addEventListener('change', e => set('euLine', e.target.checked, 'EU budget line', v => v ? 'Included' : 'Left out')));
$('promiseGap').addEventListener('change', e => set('promiseGap', Math.max(0, Math.round(+e.target.value)), 'Undelivered prospectus promises'));

$('startAct2').addEventListener('click', () => {
  const failedTwice = S.polls.length >= 2 && !S.polls.some(p => p.passed);
  S.support = failedTwice ? 3 : 5;
  if (S.promiseGap > 0) S.support -= 1;
  S.act2Started = true; S.tab = 'act2';
  logChange('Act Two starts', '', `support ${S.support}, ${FORMS[S.design].name}, ${dealName(S.deal).toLowerCase()} deal`);
  resetTimer(); render();
});

$('growthBand').addEventListener('change', e => set('growthBand', e.target.value, 'Growth plan', v => v === 'council' ? 'Fiscal Council rate' : fmt(BANDS[v]) + '%'));
$('councilRate').addEventListener('change', e => set('councilRate', +e.target.value, 'Fiscal Council growth rate'));
$('eventAdj').addEventListener('change', e => set('eventAdj', +e.target.value || 0, 'Growth change from events'));
$('boycott').addEventListener('change', e => set('boycott', e.target.checked, 'Pro-union boycott', yesNo));
$('broken').addEventListener('change', e => set('broken', Math.max(0, Math.round(+e.target.value)), 'Promises broken'));
document.querySelectorAll('input[name=panel]').forEach(r => r.addEventListener('change', e => { S.panel = +e.target.value; render(); }));
$('eventSupport').addEventListener('change', e => { S.eventSupport = Math.round(+e.target.value) || 0; render(); });

$('runTurn').addEventListener('click', () => {
  const n = turnNo(), g = turnGrowth();
  const r = run(S.hiddenCase, S.design, g, S.deal === 'fav', S.euLine);
  S.lastRun = {turn: n, growth: g, need: r.need, rows: r.rows.map(slim)};
  const shown = r.rows[TURN_END[n - 1] - 1];
  logChange('Model run', '', `growth ${fmt(g)}%`, `year ${shown.year} cost €${fmt(shown.cost)}bn, debt ${fmt(shown.totalDebtPct)}%`);
  render();
});

$('drawEvent').addEventListener('click', () => {
  const left = EVENTS.map((_, i) => i).filter(i => !S.eventsDrawn.includes(i));
  const pick = left[Math.floor(Math.random()*left.length)];
  S.eventsDrawn.push(pick); S.pendingEvent = pick;
  logChange('Event card', '', EVENTS[pick][1]);
  render();
});

$('recordTurn').addEventListener('click', () => {
  const n = turnNo(), lr = S.lastRun;
  const shown = lr.rows.filter(r => r.year >= TURN_START[n - 1] && r.year <= TURN_END[n - 1]);
  const ck = checksToDate(history(shown));
  const before = S.support;
  S.support = Math.max(0, Math.min(10, S.support + S.panel + S.eventSupport - (S.boycott ? 1 : 0) - 2*S.broken));
  S.turns.push({n, growth: lr.growth, need: lr.need, rows: shown, checks: ck, support: S.support, boycott: S.boycott, broken: S.broken, event: S.pendingEvent});
  logChange(`Turn ${n} recorded`, `support ${before}`, `support ${S.support}`);
  if (S.support === 0 && S.govFell === null) { S.govFell = n; logChange('Irish Government falls', '', 'caretaker team plays on, Fiscal Council sets growth'); }
  S.broken = 0; S.boycott = false; S.panel = null; S.eventSupport = 0; S.pendingEvent = null; S.lastRun = null;
  resetTimer();
  if (gameOver()) S.tab = 'score';
  render();
});

$('revealCase').addEventListener('click', () => { S.revealed = true; logChange('Harmonisation case', 'hidden', CASE_LABELS[S.hiddenCase] + ' case revealed'); render(); });

document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.eut) { const k = el.dataset.eut, lim = {euTransfer: [0, 20], euTransferStart: [1, 25], euTransferYears: [0, 25]}[k]; let v = +el.value || 0; if (k !== 'euTransfer') v = Math.round(v); set(k, Math.min(lim[1], Math.max(lim[0], v)), {euTransfer: 'EU transfer, €bn a year', euTransferStart: 'EU transfer, first year', euTransferYears: 'EU transfer, number of years'}[k]); return; }
  if (el.dataset.log !== undefined) { S.log[+el.dataset.log].source = el.value; save(); }
  if (el.dataset.pt === 'guarantees') { S.points.guaranteesKept = el.checked; render(); }
  if (el.dataset.pt === 'obj') { S.points.objective[el.dataset.team] = el.checked; render(); }
  if (el.dataset.pt === 'brief') { S.points.brief[el.dataset.team] = Math.max(0, Math.min(5, Math.round(+el.value || 0))); render(); }
});

// ------------------------------------------------------------------ files
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type}));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const csv = rows => rows.map(r => r.map(v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v).join(',')).join('\n');
$('logCsv').addEventListener('click', () => download('change_log.csv', csv([['stage', 'time', 'setting', 'old', 'new', 'decision sheet', 'results shown'],
  ...S.log.map(e => [e.stage, e.time, e.setting, e.old, e.new, e.source, e.results])]), 'text/csv'));
$('pathCsv').addEventListener('click', () => download('final_path.csv', csv([['year', 'cost_eur_bn', 'cost_pct_gni_star', 'transition_borrowing_eur_bn', 'total_debt_pct'],
  ...(S._pathRows || []).map(r => [r.year, r.cost.toFixed(3), r.costPctGni.toFixed(3), r.borrowing.toFixed(3), r.totalDebtPct.toFixed(2)])]), 'text/csv'));
$('exportGame').addEventListener('click', () => download(`price_of_unity_game_${new Date().toISOString().slice(0, 16).replace(':', '')}.json`, JSON.stringify(S, null, 1), 'application/json'));
$('importGame').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try { S = {...fresh(), ...JSON.parse(await f.text())}; render(); } catch (err) { alert('That file is not a game file from this page.'); }
  e.target.value = '';
});
$('newGame').addEventListener('click', () => { if (confirm('Start a new game? Export the current one first if you need it.')) { S = fresh(); render(); } });

// ------------------------------------------------------------------ timer
let phase = 0, left = PHASES[0][1]*60, ticking = null;
let timerView = null;
function sendTimer() { if (channel && !ROOM) channel.postMessage({type: 'timer', phase, left, running: !!ticking}); }
function drawRoomTimer() {
  if (!timerView) return;
  const t = timerView;
  $('roomClock').textContent = `${Math.floor(t.left/60)}:${String(t.left%60).padStart(2, '0')}`;
  $('roomPhases').innerHTML = PHASES.map(([n, m], i) => `<span class="${i === t.phase ? 'now' : i < t.phase ? 'done' : ''}">${n}</span>`).join('');
}
function drawTimer() {
  sendTimer();
  $('clock').textContent = `${Math.floor(left/60)}:${String(left%60).padStart(2, '0')}`;
  $('phases').innerHTML = PHASES.map(([n, m], i) => `<span class="${i === phase ? 'now' : i < phase ? 'done' : ''}">${n}, ${m} min</span>`).join('');
  $('timerGo').textContent = ticking ? 'Pause' : 'Start';
}
function resetTimer() { clearInterval(ticking); ticking = null; phase = 0; left = PHASES[0][1]*60; drawTimer(); }
$('timerGo').addEventListener('click', () => {
  if (ticking) { clearInterval(ticking); ticking = null; }
  else ticking = setInterval(() => { if (left > 0) left--; else if (phase < PHASES.length - 1) { phase++; left = PHASES[phase][1]*60; } else { clearInterval(ticking); ticking = null; } drawTimer(); }, 1000);
  drawTimer();
});
$('timerNext').addEventListener('click', () => { if (phase < PHASES.length - 1) { phase++; left = PHASES[phase][1]*60; drawTimer(); } });
$('timerReset').addEventListener('click', resetTimer);

if (ROOM) { document.body.classList.add('room'); document.title = 'The Price of Unity, room screen'; timerView = {phase: 0, left: PHASES[0][1]*60}; drawRoomTimer(); render(); if (channel) channel.postMessage({type: 'hello'}); }
else { verify(); drawTimer(); render(); }
})();
