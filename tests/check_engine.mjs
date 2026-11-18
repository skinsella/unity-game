// Checks that engine.js still reproduces every published number in paper version 3.14.
// Run with node tests/check_engine.mjs
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const root = new URL('..', import.meta.url);
const code = ['engine.js', 'paper_values.js'].map(f => readFileSync(new URL(f, root), 'utf8')).join('\n');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(code + `
let n = 0, bad = [];
for (const [key, pub] of Object.entries(PAPER_VALUES)) {
  const [c, rest] = key.split('|'), i = rest.lastIndexOf('_'), f = rest.slice(0, i), fav = rest.slice(i + 1) === 'fav';
  const p = policy(f, 2, fav), s = paperSettings(c), r = simulate(p, s);
  [Math.round(r[0].cost*10)/10, Math.round(r[24].cost*10)/10, growthNeeded(p, s, repaid)]
    .forEach((v, j) => { n++; if (Math.abs(v - pub[j]) > 1e-9) bad.push(key + ' item ' + j + ' got ' + v + ' want ' + pub[j]); });
}
globalThis.result = {n, bad};`, ctx);

const {n, bad} = ctx.result;
if (bad.length) { console.error(`${bad.length} of ${n} published numbers differ\n` + bad.join('\n')); process.exit(1); }
console.log(`All ${n} published numbers reproduced.`);
