# CAGED Box Trainer

A browser app for memorizing the CAGED chord shapes, the five pentatonic boxes, their arpeggios, and which box goes with which shape. It works in major and minor, in all 12 keys.

Open `index.html` in a browser. There's no build step and no server.

## Explore
- Pick a key, major or minor, and one CAGED shape or all five.
- Turn layers on and off: chord shape, pentatonic box, arpeggio (triad, maj7, dom7, m7).
- Labels: intervals, note names, or plain dots. Roots are always drawn as squares.
- Colour per shape can be switched off. "Faint rest of neck" shows the whole pentatonic scale lightly.
- Hear the chord, arpeggio or box. Keys: `←`/`→` move along the cycle, `C A G E D` pick a shape, `0` shows all shapes, `M` switches major/minor, `Space`/`R`/`B` play.

## Quiz
Question types: name the chord shape, name the box, chord shape → box, box → chord shape, name the arpeggio shape, the next shape in the cycle, and building a chord on a blank neck. Missed questions come back more often. Progress is saved in localStorage.

## Box numbering
Minor pentatonic Box 1 has the root on the low E string under the first finger.

| Box | Minor chord shape | Major chord shape |
|-----|-------------------|-------------------|
| 1   | E                 | G                 |
| 2   | D                 | E                 |
| 3   | C                 | D                 |
| 4   | A                 | C                 |
| 5   | G                 | A                 |

By default, major boxes use the same numbers as the matching minor fingering. You can switch the setting so major Box 1 is the E-shape box.

## Tests
`node test/theory.test.js` checks every shape, box and arpeggio note in all keys against the theory.
