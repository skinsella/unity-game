// Live vote by QR code. Phones send votes to a public message relay, ntfy.sh, under a random topic for this vote.
// The console and the room screen each listen to that topic and count the latest vote from each phone.
(() => {
'use strict';
const q = new URLSearchParams(location.search);
const RELAY = (q.get('relay') || 'https://ntfy.sh').replace(/\/$/, '');
let topic = null, source = null, status = 'idle';
const votes = new Map(), seen = new Set(), views = new Set();

function listen(t) {
  if (t === topic) return;
  if (source) source.close();
  topic = t; votes.clear(); seen.clear(); status = 'connecting';
  if (!t) { status = 'idle'; redraw(); return; }
  try {
    source = new EventSource(`${RELAY}/${t}/sse?since=all`);
    source.onopen = () => { status = 'live'; redraw(); };
    source.onerror = () => { status = 'reconnecting'; redraw(); };
    source.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch (err) { return; }
      if (m.event !== 'message' || seen.has(m.id)) return;
      seen.add(m.id);
      let v; try { v = JSON.parse(m.message); } catch (err) { return; }
      if (!v || !v.voter || !['ni', 'south'].includes(v.region) || !['yes', 'no'].includes(v.answer)) return;
      const old = votes.get(v.voter);
      if (!old || old.time <= m.time) votes.set(v.voter, {region: v.region, answer: v.answer, time: m.time});
      status = 'live'; redraw();
    };
  } catch (err) { status = 'unavailable'; }
  redraw();
}

function tally() {
  const t = {ni: {yes: 0, no: 0}, south: {yes: 0, no: 0}};
  for (const v of votes.values()) t[v.region][v.answer]++;
  return t;
}

function voteUrl(t) {
  const base = location.protocol.startsWith('http') ? new URL('vote.html', location.href).href : 'https://stephenkinsella.net/unity-game/vote.html';
  return `${base}?s=${t}` + (q.get('relay') ? `&relay=${encodeURIComponent(RELAY)}` : '');
}

function qrSvg(text) {
  const qr = qrcode(0, 'M'); qr.addData(text); qr.make();
  return qr.createSvgTag({cellSize: 6, margin: 2, scalable: true});
}

function bar(label, c) {
  const n = c.yes + c.no, y = n ? 100*c.yes/n : 0;
  return `<div class="vbar"><div class="vlab"><b>${label}</b><span>${n} ${n === 1 ? 'vote' : 'votes'}</span></div>
    <div class="vtrack">${n ? (c.yes ? `<div class="vyes" style="width:${y}%">Yes ${Math.round(y)}%</div>` : '') + (c.no ? `<div class="vno" style="width:${100 - y}%">No ${Math.round(100 - y)}%</div>` : '') : '<div class="vempty">No votes yet</div>'}</div>
    <div class="vcount">${c.yes} yes, ${c.no} no</div></div>`;
}

function html() {
  if (!topic) return '<p class="muted">Start a vote to show the QR code.</p>';
  const t = tally(), all = {yes: t.ni.yes + t.south.yes, no: t.ni.no + t.south.no};
  const both = t.ni.yes > t.ni.no && t.south.yes > t.south.no;
  const any = all.yes + all.no > 0;
  const st = {live: ['pass', 'Live'], connecting: ['wait', 'Connecting'], reconnecting: ['fail', 'Reconnecting'], unavailable: ['fail', 'Relay unavailable'], idle: ['wait', 'Idle']}[status];
  return `<div class="votegrid">
    <div class="qrbox"><div class="qr">${qrSvg(voteUrl(topic))}</div><p class="small muted qrurl">${voteUrl(topic).replace(/^https?:\/\//, '').replace(/&relay=.*/, '')}</p></div>
    <div>
      <h2 class="vq">Do you support reunification?</h2>
      <p><span class="pill ${st[0]}">${st[1]}</span> <span class="muted">${all.yes + all.no} phones have voted</span></p>
      ${bar('Northern Ireland', t.ni)}${bar('Southern Ireland', t.south)}${bar('Whole room', all)}
      ${any ? `<p class="vresult">${both ? 'A majority says yes in both polls.' : 'There is not a yes majority in both polls.'} A tie counts as a no.</p>` : ''}
    </div></div>`;
}

function redraw() { for (const el of views) if (el.isConnected) el.innerHTML = html(); else views.delete(el); }

window.LiveVote = {
  show(el, t) { listen(t); views.add(el); el.innerHTML = html(); },
  newTopic() { const a = new Uint32Array(3); crypto.getRandomValues(a); return 'pou-' + Array.from(a, x => x.toString(36)).join(''); },
  counts: tally,
};
})();
