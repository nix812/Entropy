# Drift Studio II: genre research (v4.8, October 31 2026)

This is the research behind the ten genres in `src/audio.js` (`Music`). It was compiled from two web research passes (rhythm/form and harmony/sound design), and the engine was then checked against it with `test/genrecheck.py`. **[S]** marks a figure taken from a fetched source, **[C]** common practice or a starting value to tune by ear, **[U]** widely quoted but unverified.

## How the engine encodes a genre
- **Tempo** is a hard constraint per genre, because tempo alone carries much of a genre's identity (Ballroom dataset study, arXiv 1606.03044).
- **Swing** follows the MPC convention: 50% is straight and 66% is a triplet feel; at S% every even 16th is delayed by (2S/100 - 1) of a 16th [S, Roger Linn].
- **Microtiming:** applied only to the human genres (lo-fi, trip hop, dub, DnB breaks), as fixed per-voice offsets (snare late, offbeat hats early) plus at most a few ms of jitter. Random jitter barely moves listener preference [S, GrooVAE paper], and exaggerated microtiming lowers groove ratings [S, Frontiers 2017]. Electronic genres stay quantised plus swing.
- **Drum maps** work like Mutable Instruments Grids [S]: every step holds a level per voice, a step fires when its level beats 255 minus the density, and high levels are accents. Here levels are 0–9 per step, and density comes from Energy plus the section, so thinning keeps the backbone and drops the ghosts first.
- **Harmony:** curated chord loops per flavour, rather than an open Markov chain. MusicVAE showed flat note-by-note generation loses long-range structure, and planning per bar first fixes it [S].
- **Voicing rule per genre:**
  - jazz: rootless 3-7-9, common tones kept, top voice stepwise (lo-fi, liquid DnB)
  - plane: one shape moved in parallel, out of key on purpose (Detroit techno, deep house) [S, Attack Magazine]
  - pad: closest inversions (synthwave, trance)
  - open: fifths and add9 (ambient)
  - triad: close triads (skank, chip, piano house)
- **Melody is motif-first:** a 2-bar motif from the genre's rhythm grammar, in the key's scale or pentatonic, offset by the chord's position. Chord tones land on strong beats. Phrases run A A' A B with a cadence to the root in bar 8.
- **Form** works on 8-bar phrases:
  - dance: intro, groove, breakdown with a 4-bar snare roll (quarters → 8ths → 16ths, silent last beat) and a noise riser, then a crash on the drop
  - trance: drums and bass fully out in the breakdown
  - DnB: bass muted for the last 2 beats of every phrase [S, EDMProd]
  - song: A A' B A''
  - dub: drop-outs mid-phrase, a "dub version" phrase, sirens and echo throws [S, MusicRadar 25 dub tips]
  - flow (ambient): bell loops whose periods never line up (19.7, 23.5, 25.9, 29.9, 31.3 s), after Eno's Music for Airports, where the loops were deliberately incommensurable [S]

## The ten genres (and what makes each one recognisable)
| Genre | Tempo | Groove | Harmony | Signature sounds |
|---|---|---|---|---|
| **Ambient** | 60–90 (72) | none; soft kick and E(5,16) shaker only at high energy | Lydian/Ionian pedals, open fifths/add9, one chord per 2–8 bars | slow-attack pads, FM bells on incommensurable loops, 7 s hall |
| **Lo-fi Hip Hop** | 70–90 (80) | swing 58%; kick 1 + steps 10/11 alternating, snare 2 & 4 laid back, 8th hats with 16th ghosts [S, MusicRadar] | maj7/m9 jazz loops, ii–V–I, IVmaj7–iii7–vi7 [S, NI] | DX7-style Rhodes (1:1 body pair, 14:1 tine pair) [S, Yamaha], upright bass, low-pass ~8 kHz, wow 0.5–2 Hz at 5–15 cents, crackle [S, Splice] |
| **Trip Hop** | 76–100 (88) | half-time, behind the beat, swing 55% [S] | i–♭VI, Phrygian ♭II, line cliché i–i(maj7)–i7–i6 | dub bass, string pads, theremin-like sine lead with portamento and 5.5 Hz vibrato, vinyl |
| **Synthwave** | 88–128 (104) | four on the floor or rock beat, 16th hats skipping beats 2 & 4, gated-reverb snare, tom fills [S, NI] | Axis i–♭VI–♭III–♭VII; Nightcall i–♭VII–♭VI–iv [S]; darksynth Phrygian/harmonic minor | octave saw bass on 8ths, Juno arps, saw+pulse lead with delayed 5.3 Hz vibrato [S, Reverb Machine], sidechain |
| **House** | 118–128 (124) | four on the floor, clap 2 & 4, offbeat hats, swing ~55% [S, EDMProd] | deep: m7/m9 stabs in parallel (Kerri Chandler) [S]; piano: I–V–vi–IV; disco: ii7–V7 vamps | sub bass between kicks, M1-style organ bass (triangle + square at +19 st) [S, MusicRadar], 8–16 bar filter sweeps (filter house) [S, Splice] |
| **Techno** | 122–140 (128) | four on the floor, rims never on a kick step, offbeat open hats [S, Attack] | one chord or parallel minor-7 stabs; dub techno: one stab through a dotted-⅛ echo [S, Attack] | 909 kick (body + click), TB-303 acid line: saw into a resonant low-pass, accent opens the filter, 60 ms slide [S/U] |
| **Trance** | 128–142 (138) | four on the floor, rolling offbeat bass (silent on the kick), 16-bar breakdown, accelerating snare roll [S, Wikipedia] | Axis and vi–IV–I–V, wide voicings | supersaw (7 voices, ±8/18/30 cents) [C], 16th trancegate, pluck arps, heavy pump |
| **Drum & Bass** | 165–178 (174) | two-step: kick 1 and step 11, snare 2 & 4, ghosts 6–12 dB down [S, EDMProd] | liquid: m9 / maj7 shared tones [S, MusicRadar]; roller: one dark chord | sub or Reese (two saws ±14 cents, low-pass ~400–700 Hz, slow LFO) [S, Attack] |
| **Chiptune** | 112–180 (150) | rock beat on the noise channel; triangle kick drop | I–V–vi–IV, ♭VI–♭VII–I | 2A03 pulse duties 12.5/25/50%, triangle bass, chords as 32nd-note arpeggios [S, NESdev], no reverb |
| **Dub** | 64–82 (72) | one drop (beat 1 empty, kick and rim on beat 3), rockers, steppers [S, Soundbrenner]; swing ~60% | one or two chords per riddim | skank on 2 and 4 into tape echo (dotted ⅛, 40–70% feedback), heavy round bass, spring reverb, siren [S, MusicRadar] |

Overlaps considered and folded in rather than offered separately: deep vs classic/disco house (flavours of House), downtempo vs lo-fi (Trip Hop stays distinct through half-time and dark minor), breakbeat (DnB's Roller flavour), vaporwave (better as a processing mode: Tape & Vinyl), IDM (a modifier, not a genre).

## Verification (test/genrecheck.py, energy 0.62, follow 0, 32 s per flavour)
For each flavour the test logs every note event, folds the drums onto the 16-step grid, measures how much of the keys, lead and bass lands in the mode, beat-tracks the audio (librosa), and measures loudness (BS.1770 LUFS) and spectral centroid. Results at the time of writing:
- Every flavour's kick/snare/hat grid matches its spec row, e.g. dub one drop `K ........X.......`, DnB `K X.........X.....`, house `H ..X...X...X...X.`.
- Audio tempo matches the target within ±3 BPM, or at half/double for DnB and dub.
- Chords and leads are 100% diatonic except where the style is chromatic on purpose: Detroit/deep house parallel stabs, minor V7, and lo-fi approach notes.
- Loudness is trimmed per genre to about −20 LUFS.
- The knob check showed:
  - Energy moves density from about 5 to 30 events/s (house).
  - Echo moves lo-fi and dub by about 5–7 LU.
  - Tone moves the centroid by more than 2× after the v4.8 shelf.
  - Tape adds wobble, crush and crackle.
  - Pump (with drums muted) deepens the envelope modulation.

## Sources
**Rhythm and form**
- [MusicRadar](https://www.musicradar.com/tutorials/you-can-easily-construct-your-own-bespoke-beat-rather-than-relying-on-stock-loops-how-to-make-fresh-lo-fi-beats) (lo-fi beat)
- [Attack: dusty chillout hip hop](https://www.attackmagazine.com/technique/beat-dissected/chillout-dusty-hip-hop/)
- [Attack: Roger Linn on swing](https://attackmagazine.com/features/interview/roger-linn-swing-groove-magic-mpc-timing/2)
- [Wikipedia: trip hop](https://en.wikipedia.org/wiki/Trip_hop)
- [NI: synthwave](https://blog.native-instruments.com/synthwave/)
- [MusicTech: gated reverb](https://musictech.com/tutorials/tips/how-to-create-authentic-vintage-drum-gated-reverb-for-synthwave-chillwave-music-styles)
- [EDMProd: deep house](https://www.edmprod.com/how-to-make-classic-deep-house/)
- [Attack: deep house beat](https://www.attackmagazine.com/technique/beat-dissected/deep-house-stripped-workout-beat-dissected/)
- [MusicRadar: disco beat](https://www.musicradar.com/how-to/how-to-program-a-typical-disco-drum-beat)
- [Attack: Detroit techno](https://www.attackmagazine.com/technique/beat-dissected/motor-city-detroit-techno/)
- [Attack: dub techno](https://www.attackmagazine.com/technique/beat-dissected/basic-channel-style-dub-techno/)
- [Perfect Circuit: kick synthesis](https://www.perfectcircuit.com/signal/kick-drum-synthesis)
- [Reverb Machine: Music for Airports](https://reverbmachine.com/blog/deconstructing-brian-eno-music-for-airports/)
- [Attack: acid bassline](https://www.attackmagazine.com/technique/tutorials/how-to-make-an-acid-house-bassline/)
- [Wikipedia: trance](https://en.wikipedia.org/wiki/Trance_music)
- [EDMProd: liquid DnB](https://www.edmprod.com/how-to-make-liquid-drum-and-bass/)
- [MusicRadar: Amen break](https://musicradar.com/tuition/tech/how-to-program-an-amen-style-break-637374)
- [Attack: UK garage](https://www.attackmagazine.com/technique/beat-dissected/uk-garage/)
- [Soundbrenner: one drop](https://www.soundbrenner.com/blogs/articles/one-drop)
- [Soundbrenner: steppers](https://www.soundbrenner.com/blogs/articles/steppers-rhythm)
- [MusicRadar: 25 dub tips](https://www.musicradar.com/tuition/tech/25-dub-tips-34138)
- [ddrkirby: NES chiptunes](https://ddrkirby.com/articles/nes-chiptunes-unlock-everything/nes-chiptunes-unlock-everything.html)
- [Werner, DAFx14 (808)](https://dafx14.fau.de/papers/dafx14_kurt_james_werner_a_physically_informed,_ci.pdf)
- [Toussaint: Euclidean rhythms](https://cgm.cs.mcgill.ca/~godfried/publications/banff.pdf)
- [Mutable Instruments Grids source](https://github.com/pichenettes/eurorack/blob/master/grids/pattern_generator.cc)
- [GrooVAE paper](https://arxiv.org/pdf/1905.06118)
- [Frontiers 2017 microtiming](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2017.01709/pdf)

**Harmony and sound**
- [Hooktheory: 1,300 songs](https://www.hooktheory.com/blog/i-analyzed-the-chords-of-1300-popular-songs-for-patterns-this-is-what-i-found/)
- [Attack: understanding modes](https://www.attackmagazine.com/technique/passing-notes/understanding-modes/)
- [Attack: deep house chords](https://www.attackmagazine.com/technique/passing-notes/passing-notes-deep-house-chords/)
- [Attack: Kerri Chandler chords](https://www.attackmagazine.com/technique/passing-notes/kerri-chandler-chords/)
- [Attack: parallel techno stabs](https://www.attackmagazine.com/technique/tutorials/the-theory-of-techno-parallel-chord-stabs/)
- [Attack: Reese bass](https://www.attackmagazine.com/technique/tutorials/reese-bass-redux/)
- [MusicRadar: M1 organ](https://www.musicradar.com/how-to/classic-house-organ-robin-s-show-me-love)
- [MusicRadar: liquid chords](https://musicradar.com/how-to/how-to-create-uplifting-liquid-dnb-chords)
- [MusicRadar: supersaw](https://musicradar.com/how-to/supersaw-synth-sound)
- [Reverb Machine: Nightcall](https://reverbmachine.com/blog/how-kavinsky-created-nightcall/)
- [eMastered: synthwave progressions](https://emastered.com/blog/synthwave-chord-progressions)
- [NI: lo-fi progressions](https://www.native-instruments.com/blogs/blog/lo-fi-chord-progressions)
- [Splice: tape](https://splice.com/blog/how-tape-machines-shaped-lo-fi-sound/)
- [Splice: filter house](https://splice.com/blog/filter-house-history-ingredients-techniques)
- [Unison: trance progressions](https://unison.audio/trance-chord-progressions/)
- [Yamaha FM 101](https://yamahasynth.com/learn/synth-programming/fm-101-part-five-expanding-your-sound/)
- [303 circuit analysis](https://github.com/a1k0n/303)
- [Wayne&Wax: roots riddim](https://www.wayneandwax.com/org/lessons/roots-riddim-tutorial.html)
- [NESdev: APU](https://nesdev.org/wiki/APU_basics)
- [Game Boy sound hardware](https://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware)
- [teropa: How Generative Music Works](https://teropa.info/loop/)
- [MusicVAE paper](https://ar5iv.arxiv.org/html/1803.05428)
- [FACT: No Man's Sky / 65daysofstatic](https://factmag.com/2016/08/13/no-mans-sky-65daysofstatic-soundtrack)
