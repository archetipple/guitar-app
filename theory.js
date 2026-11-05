/* Music theory engine for the CAGED trainer.
 * Strings are indexed 0..5 from the low E (6th string) to the high e (1st string).
 * Every shape is stored once in a reference key and transposed by semitone offset,
 * so all notes, intervals and positions are computed rather than hand-drawn. */
(function (root) {
  'use strict';

  const FRETS = 18;
  const OPEN = [40, 45, 50, 55, 59, 64]; // MIDI pitches of open strings, low E to high e
  const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];
  const SHAPES = ['C', 'A', 'G', 'E', 'D']; // order they appear going up the neck

  // CAGED chord voicings in the key of C (C major and C minor), as [string, fret].
  const CHORDS = {
    maj: {
      C: [[1, 3], [2, 2], [3, 0], [4, 1], [5, 0]],
      A: [[1, 3], [2, 5], [3, 5], [4, 5], [5, 3]],
      G: [[0, 8], [1, 7], [2, 5], [3, 5], [4, 5], [5, 8]],
      E: [[0, 8], [1, 10], [2, 10], [3, 9], [4, 8], [5, 8]],
      D: [[2, 10], [3, 12], [4, 13], [5, 12]],
    },
    min: {
      C: [[1, 3], [2, 1], [3, 0], [4, 1]],
      A: [[1, 3], [2, 5], [3, 5], [4, 4], [5, 3]],
      G: [[0, 8], [1, 6], [2, 5], [3, 5], [4, 8], [5, 8]],
      E: [[0, 8], [1, 10], [2, 10], [3, 8], [4, 8], [5, 8]],
      D: [[2, 10], [3, 12], [4, 13], [5, 11]],
    },
  };

  // The five minor pentatonic boxes in A minor (= C major pentatonic), two frets per string,
  // listed low E to high e. Box 1 has the root on the low E under the first finger.
  const BOXES = {
    1: [[5, 8], [5, 7], [5, 7], [5, 7], [5, 8], [5, 8]],
    2: [[8, 10], [7, 10], [7, 10], [7, 9], [8, 10], [8, 10]],
    3: [[10, 12], [10, 12], [10, 12], [9, 12], [10, 13], [10, 12]],
    4: [[0, 3], [0, 3], [0, 2], [0, 2], [1, 3], [0, 3]],
    5: [[3, 5], [3, 5], [2, 5], [2, 5], [3, 5], [3, 5]],
  };

  // Which pentatonic box sits on which chord shape.
  const BOX_FOR = {
    maj: { G: 1, E: 2, D: 3, C: 4, A: 5 },
    min: { E: 1, D: 2, C: 3, A: 4, G: 5 },
  };

  const PENT = { maj: [0, 2, 4, 7, 9], min: [0, 3, 5, 7, 10] };

  const ARPS = {
    maj: { triad: [0, 4, 7], maj7: [0, 4, 7, 11], dom7: [0, 4, 7, 10] },
    min: { triad: [0, 3, 7], m7: [0, 3, 7, 10] },
  };
  const ARP_NAMES = { triad: 'Triad', maj7: 'Major 7', dom7: 'Dominant 7', m7: 'Minor 7' };

  const INTERVALS = ['R', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];
  const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const KEY_NAMES = {
    maj: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'],
    min: ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'],
  };

  const mod = (n, m) => ((n % m) + m) % m;

  function keyName(key, q) { return KEY_NAMES[q][mod(key, 12)]; }

  function usesFlats(key, q) {
    const name = keyName(key, q);
    if (name.includes('b')) return true;
    if (q === 'maj') return name === 'F';
    return ['C', 'D', 'F', 'G'].includes(name);
  }

  function noteName(pc, key, q) { return (usesFlats(key, q) ? FLATS : SHARPS)[mod(pc, 12)]; }

  function makeNote(s, f, key) {
    const midi = OPEN[s] + f;
    return { s, f, midi, pc: midi % 12, iv: mod(midi - key, 12) };
  }

  function arpTypesFor(q) { return Object.keys(ARPS[q]); }

  function arpSet(q, arpType) { return ARPS[q][arpType] || ARPS[q].triad; }

  function span(frets) { return [Math.min(...frets), Math.max(...frets)]; }

  /* All playable copies (octaves) of one CAGED position in a key, each with its chord voicing,
   * matching pentatonic box and arpeggio notes. */
  function positions(key, q, shape, arpType) {
    const d = mod(key, 12);
    const bshift = q === 'maj' ? d : mod(key - 9, 12);
    const boxN = BOX_FOR[q][shape];
    const arpIv = arpSet(q, arpType);
    const out = [];
    for (const o of [-24, -12, 0, 12, 24]) {
      const chordSF = CHORDS[q][shape].map(([s, f]) => [s, f + d + o]);
      const [cLo, cHi] = span(chordSF.map((n) => n[1]));
      if (cLo < 0 || cHi > FRETS) continue;
      // place the box in the octave closest to the chord
      const base = BOXES[boxN].map((pair) => pair.map((f) => f + bshift));
      const [bLo, bHi] = span(base.flat());
      const cMid = (cLo + cHi) / 2;
      let best = 0, bestDist = Infinity;
      for (const k of [-36, -24, -12, 0, 12, 24]) {
        const dist = Math.abs((bLo + bHi) / 2 + k - cMid);
        if (dist < bestDist) { bestDist = dist; best = k; }
      }
      const box = [];
      base.forEach((pair, s) => pair.forEach((f) => {
        const ff = f + best;
        if (ff >= 0 && ff <= FRETS) box.push(makeNote(s, ff, key));
      }));
      const lo = Math.max(0, Math.min(cLo, bLo + best));
      const hi = Math.min(FRETS, Math.max(cHi, bHi + best));
      const arp = [];
      for (let s = 0; s < 6; s++) {
        for (let f = lo; f <= hi; f++) {
          const n = makeNote(s, f, key);
          if (arpIv.includes(n.iv)) arp.push(n);
        }
      }
      out.push({
        shape, boxN, key, q, lo, hi,
        chord: chordSF.map(([s, f]) => makeNote(s, f, key)),
        box, arp,
      });
    }
    return out;
  }

  function allPositions(key, q, arpType) {
    return SHAPES.flatMap((sh) => positions(key, q, sh, arpType));
  }

  /* Box numbering. 'shared': major boxes use the same numbers as the relative minor fingering
   * (E shape = Box 2). 'major1': major Box 1 is the E shape box. */
  function boxLabel(n, q, scheme) {
    if (scheme === 'major1' && q === 'maj') return mod(n + 3, 5) + 1;
    return n;
  }

  function nextShape(shape, dir) {
    const i = SHAPES.indexOf(shape);
    return SHAPES[mod(i + (dir === 'down' ? -1 : 1), 5)];
  }

  function shapeForBox(n, q) {
    return Object.keys(BOX_FOR[q]).find((sh) => BOX_FOR[q][sh] === n);
  }

  const api = {
    FRETS, OPEN, STRING_NAMES, SHAPES, CHORDS, BOXES, BOX_FOR, PENT, ARPS, ARP_NAMES,
    INTERVALS, keyName, noteName, usesFlats, makeNote, positions, allPositions, boxLabel,
    nextShape, shapeForBox, arpTypesFor, arpSet, mod,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Theory = api;
})(typeof window !== 'undefined' ? window : globalThis);
