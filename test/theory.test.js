// Run with: node test/theory.test.js
const T = require('../theory.js');
let fails = 0;
const check = (cond, msg) => { if (!cond) { fails++; console.error('FAIL', msg); } };
const CHORD = { maj: [0, 4, 7], min: [0, 3, 7] };
for (const q of ['maj', 'min']) {
  for (let key = 0; key < 12; key++) {
    const name = `${T.keyName(key, q)} ${q}`;
    for (const sh of T.SHAPES) {
      for (const arpType of T.arpTypesFor(q)) {
        const ps = T.positions(key, q, sh, arpType);
        check(ps.length >= 1, `${name} ${sh}: no playable copy`);
        for (const p of ps) {
          const tag = `${name} ${sh}-shape @${p.lo}`;
          check(p.chord.every((n) => CHORD[q].includes(n.iv)), `${tag}: non chord tone in chord`);
          check(p.chord.some((n) => n.iv === 0), `${tag}: chord has no root`);
          check(new Set(p.chord.map((n) => n.iv)).size === 3, `${tag}: chord missing a tone`);
          check(p.box.every((n) => T.PENT[q].includes(n.iv)), `${tag}: box note outside pentatonic`);
          check(p.arp.every((n) => T.arpSet(q, arpType).includes(n.iv)), `${tag}: bad arp note`);
          // every chord tone of the voicing is inside the box's fret span (box hugs the chord)
          const bf = p.box.map((n) => n.f);
          const cf = p.chord.map((n) => n.f);
          if (p.box.length === 12) {
            check(Math.min(...cf) >= Math.min(...bf) - 1 && Math.max(...cf) <= Math.max(...bf) + 1,
              `${tag}: chord ${cf} far from box ${bf}`);
          }
        }
      }
    }
  }
}
// spot checks against known shapes
const cG = T.positions(0, 'maj', 'G', 'triad')[0];
check(cG.boxN === 1 && Math.min(...cG.box.map((n) => n.f)) === 5, 'C major G shape should sit on Box 1 at fret 5');
const amE = T.positions(9, 'min', 'E', 'triad').find((p) => p.lo === 5);
check(amE && amE.boxN === 1, 'A minor E shape at fret 5 should be Box 1');
check(T.boxLabel(2, 'maj', 'major1') === 1 && T.boxLabel(1, 'maj', 'major1') === 5, 'major1 numbering');
check(T.nextShape('D', 'up') === 'C' && T.nextShape('C', 'down') === 'D', 'cycle wraps');
console.log(fails ? `${fails} failures` : 'all theory checks passed');
process.exit(fails ? 1 : 0);
