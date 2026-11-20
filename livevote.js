// Live vote by QR code. Phones send votes to a public message relay, ntfy.sh, under a random topic for this vote.
// The console and the room screen each listen to that topic and count the first region choice from each phone.
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
      if (!v || !v.voter || !['ni', 'south'].includes(v.region)) return;
      if (!votes.has(v.voter)) votes.set(v.voter, v.region);
      status = 'live'; redraw();
    };
  } catch (err) { status = 'unavailable'; }
  redraw();
}

function tally() {
  const t = {ni: 0, south: 0};
  for (const region of votes.values()) t[region]++;
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

function bar(label, count, total, wholeRoom = false) {
  const share = total ? Math.round(100 * count / total) : 0;
  return `<div class="vbar"><div class="vlab"><b>${label}</b><span>${count} ${count === 1 ? 'vote' : 'votes'}</span></div>
    <div class="vtrack">${count ? `<div class="vregion" style="width:${wholeRoom ? 100 : share}%"></div>` : '<div class="vempty">No votes yet</div>'}</div>
    <div class="vcount">${wholeRoom ? `${count} total votes` : `${share}% of submissions`}</div></div>`;
}

function html() {
  if (!topic) return '<p class="muted">Start a vote to show the QR code.</p>';
  const t = tally(), all = t.ni + t.south;
  const st = {live: ['pass', 'Live'], connecting: ['wait', 'Connecting'], reconnecting: ['fail', 'Reconnecting'], unavailable: ['fail', 'Relay unavailable'], idle: ['wait', 'Idle']}[status];
  return `<div class="votegrid">
    <div class="qrbox"><div class="qr">${qrSvg(voteUrl(topic))}</div><p class="small muted qrurl">${voteUrl(topic).replace(/^https?:\/\//, '').replace(/&relay=.*/, '')}</p></div>
    <div>
      <h2 class="vq">Where do people vote?</h2>
      <p><span class="pill ${st[0]}">${st[1]}</span> <span class="muted">${all} ${all === 1 ? 'phone has' : 'phones have'} voted</span></p>
      ${bar('Northern Ireland', t.ni, all)}${bar('Southern Ireland', t.south, all)}${bar('Whole room', all, all, true)}
    </div></div>`;
}

function redraw() { for (const el of views) if (el.isConnected) el.innerHTML = html(); else views.delete(el); }

window.LiveVote = {
  show(el, t) { listen(t); views.add(el); el.innerHTML = html(); },
  newTopic() { const a = new Uint32Array(3); crypto.getRandomValues(a); return 'pou-' + Array.from(a, x => x.toString(36)).join(''); },
  counts: tally,
};
})();
