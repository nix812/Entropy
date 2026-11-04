# mus63 (6.3.0): more variety in each genre, and a theme for every boss

Builder mus63, branch `mus63` from 6.2.0 (7eabde8). Audio and Studio UI only. **No simulation change**: sim.js and data.js are untouched, `node test/replay.js` prints "all replays match".

Nic asked: "How do we get more music track variety within respective genres?" and "Along with the music changes we need some good boss music for all the bosses make it unique, catchy and hard."

## What the player sees

**More variety (Simple Technical English, for What's New):**
- Each genre now has 4 styles. There are 14 new styles: Deep Space, Boom Bap, Bedroom, Cinematic, Noir, Chase, Tech House, Industrial, Psy, Tech Trance, Jungle, Neuro, Speedrun and Digital.
- Each new song picks its own drums, instruments, tempo, key and arrangement. Two songs of one style now sound different.
- Each melody grows from a short hook. The hook repeats and develops through the song.
- Some songs drop to half-time for one section. Some songs lift the key for the last drop or hook.
- Songs kept before 6.3, and their codes, play exactly as before.

**Boss themes:**
- Each of the 13 bosses has its own theme. The theme starts with a hit when the boss arrives.
- A new boss phase moves the theme to its Final section, 1 semitone higher.
- When you kill the boss, a short victory sting plays. Then your song continues from the section it was in. If it was near its end, a new song starts.
- With 2 bosses on the field, the first boss's theme plays. When it falls, the second boss's theme plays.
- Studio › Listen has a Boss themes list. Beat a boss to unlock its theme there. Tap a theme to play it.
- The switch "Play in boss fights" (Studio › Listen, default On) turns the themes off. Off gives the old behaviour: minor keys during a boss, Trip Hop in the default mix.
- The ♥ keeps a boss theme in My Tracks. Its TRACK code carries the theme.
- In Compose, boss themes do not interrupt your song.

| Boss | Theme | BPM | Mode | Lead | Character |
|---|---|---|---|---|---|
| Behemoth | Siege Engine | 108 | E phrygian | Brass | Distorted stomp, galloping saw bass, power-chord chugs, a 4-note "E E-F G" hook |
| Hive Queen | Royal Swarm | 138 | B harmonic minor | Saw | Trance roll, buzzing 16th trill that leaps to a regal phrase, plucked arps |
| Phase Wraith | Blink | 160 | F♯ phrygian dominant | Theremin | Half-time breaks, gliding ghost wail, Reese bass, glitch ticks, long echoes |
| Overmind | Mind Lock | 132 | A dorian | Bleep | Acid 303 ostinato, a 5-note arpeggio on every third 16th (3 against 4): hypnotic |
| Titan | Colossus March | 120 | D harmonic minor | Supersaw | Military snare, anvil hits, dotted march hook climbing to the octave |
| Leia | Couch Shredder | 116 | E minor, chromatic | Pizzicato + meow | Swung sneaky creep with a "mee-ow"; Nap section (half-time, muffled), then Pounce |
| Gloop | Leftovers | 146 | G dorian | Water drop | Half-time wobble bass; each repeat of the hook jumps an octave (it splits) |
| Space Whale | Deep Song | 78 | C minor | Whale (glide) | Slow and huge: pulsing octave bass, strings, glass sparkles, a gliding song |
| Quackzilla | Rubber Reckoning | 178 | G mixolydian | Quack | Hardcore kick at 178 in a major key; the Hop section stops the band for a quack |
| Flying Spaghetti Monster | Al Dente | 152 | A harmonic minor | Melodica | Tarantella shuffle, oom-pah bass, accordion chords, mandolin tremolo |
| Wormhole Worm | Burrow | 174 | F phrygian | Growl | Neuro DnB, serpentine hook, Underground section (muffled), then Surface |
| The Auditor | Form 1040-Z | 126 | C minor (Andalusian) | Harpsichord | Typewriter ticks, desk stamps, harpsichord ostinato, a desk bell every 8 bars |
| The Immortal Snail | Inevitable | 64 | D phrygian | Distorted | Doom: power chords, a tritone hook, double-kick bursts in Final |

## How it works (code map, all in src/audio.js unless noted)

### Variety: generator version 2
- **Why songs sounded alike (6.2.0):** a flavour fixed the drum maps (only energy thinned them), every instrument kind, the bass line type, the lead grammar, the tempo (no per-song spread), the arrangement and the arp shape. Only mode, chord loop, key (7 semitones), name and the 2-bar melody were rolled per seed, and the melody was a random walk.
- **Versioning.** A spec has an optional `v`. `VCUR = 2`. `newPiece`: a spec with a `seed` keeps `force.v || 1`; a new piece gets 2; a composed song is always 1. `specOf`, `save`, `addTrack`, `Music.track`, `hist`, Repeat and Back carry `v`. Version 1 runs the 6.2.0 code path draw for draw; every new branch is guarded by `P.v2` or `P.boss`. `test/mus63.py v1` compares note events of 27 specs (every 6.2.0 flavour plus a composed song) with a 6.2.0 fixture: identical.
- **`varyRecipe(S, g, f)`** (called right after `recipe()` for v2): copies the recipe, then from the seed's own stream: drum rows from `VX[genre]` (the flavour's row is one choice; a row the flavour writes itself is kept unless `VX_F` lists choices), ghost snares, fill (adds `snare`/`clap` fills), bass line, lead kind and grammar (unless the flavour sets them), lead duty (chiptune), pad and keys kind, extra loops and modes (`VX_F[...].loops2/modes2`, still filtered by `loopOK`). Returns tempo jitter (`bpmJ`, per-genre spread 1.5 to 7%), arp shape and rate, arrangement variant (`fv`), key-lift size, key offset (all 12 keys around the genre's register).
- **`makeHook(Ld)`**: 2-bar hook = call bar (rhythm figure from `HOOK_R[grammar]`, contour arch/rise/fall/zig/pedal) + answer bar (same or sister rhythm, contour moved, ends on root/5th). Second motif = contrast. `varyHook` develops only the answer bar. In the lead block (v2): verse-like phrases play the call only; drops and hooks go up an octave in bars 5–6 (lead oct ≤ 74); no random tail drops.
- **Arrangements:** `makeForm(kind, len, fv)` → `formVariant`: 1 = the second peak phrase plays half-time (`half`), 2 = the last peak phrase lifts the key (`lift`, +1 or +2, stays to the end). `setLength` keeps `P.fv`.
- **New bass lines:** `walk`, `gallop`, `pulse8`, `pat` (explicit). New arp shapes: up, down, pinky, skip; rate 8 or 16.
- **14 new flavours** in `GENRES` (marked `// 6.3`), each with an `ftrim` from genrecheck renders. They appear in the Composer's style list. `BASSES` +5 (Walking, Gallop, Wobble, Psy, Chip dub) and `LEADS` +2 (Pulse, Brass), appended, so saved comps are unaffected.
- New sounds: kit `hard` (driven kick), drum voices `X` anvil, `Z` tick, `T` tom; bass `wobble`; keys `power`; leads in `BOSS_LEADS` (brass, dist, growl, quack, meow, pizz, harpsi, whale, drop). New mode `phrydom` (boss themes only, not in the Composer moods).

### Boss themes
- **Data:** `BOSS_THEMES[id]` (one per `BOSSES` id): `base` [genre, flavour] for defaults, `bpm`, `mode`, `root`, `kit`, `loop`, `drums`, `bass.pat` (`BP` tokens "st:iv:len[:a|s]"), `keys`, `pad`, `arp`, `lead {kind, oct, k2}`, `hook`/`ans`/`m2`/`m3` (`HK` tokens "st:semitone:len[:m]", semitones above the tonic so the hook keeps its exact notes), `form` overrides per phrase, `mix`, `trim` (measured: every theme -17.7 to -19.4 LUFS against genres at -16.9 to -19.4).
- **`bossPiece(force)`** builds the piece (P.boss = id) and enters at bar `in` (4, or 6 for the slow Whale and Snail): the Alarm's snare-roll build. `bossForm`: Alarm > Hook > Drive > Hook > Break > Final; each 2-bar slot plays motif `L[i]`. `bossLead` plays it (Final doubles an octave up; the Auditor's desk bell). Phrase flags: `half`, `hop`, `under` (muffled sweepLP), `dr` (drum row swap), `up`.
- **Loop and phases:** at the end the theme loops from Hook while `bossNow === P.boss`; otherwise it ends like a song. At a phrase start, a higher `bossPhase` jumps to Final and lifts the key 1 semitone. `effE()` for a theme = 0.55 + 0.45 × energy + 0.08 per phase (never below Groove, Follow still pushes it).
- **`Music.setBoss(id, phase, win)`** (edge-triggered): starts the theme (`fadeTo`, stinger `bossHit`) and remembers the interrupted spec at its phrase (`bossRet`; null if under 16 bars were left). On null after a theme: `victory` sting on a kill, then `newPiece(bossRet)`. Does nothing when `config.bossThemes === false`, or while the composer edits or holds. A Skip during the fight stays skipped.
- **ui.js:** `bossMusic()` before `tick` (called every frame next to the boss bar toggle): the tracked boss while any enemy with its id lives (Gloop splits, Most Wanted twins), else `G.bossAlive`, else any live boss (the sim clears `bossAlive` when the first of two bosses dies). Win = the tracked boss has hp ≤ 0 and the run is not over.
- **Studio (ui.js):** `stBossHTML()` in the Listen tab under the genre blurb; actions `stBossP` (plays an unlocked theme: `PROF.codex.bosses[id]`, which the sim counts on a kill) and `stBossT` (switch). Shape's Tempo is greyed for boss themes. Reset sound keeps the switch. My Tracks rows label kept themes "Boss theme · name". `stRadio` skips boss themes. `trackCode`/`readTrackCode` carry `v` and `b`. `UI._trackCode`/`UI._readTrackCode` exposed for the test. `ST_HELP`: new Listen rows (Boss themes, Play in boss fights), Advanced rows (Variety, Boss fights, Boss fights switch off, Keep a boss theme), Shape rows (Tempo, Reset sound, Boss themes), Compose "Twenty bass lines".
- **CSS (template.html):** `.stboss` grid, `.cpsty.lockd` (classes checked free).
- **PROF:** `settings.studio.bossThemes` (default true, in `DEF`; old profiles get it from `setConfig` defaults). Favs may carry `v` and `boss`. Nothing in `G`, no snapshot change.

## Tests
- **New `test/mus63.py [variety|v1|bosses|perf|levels|samples|ui|all]`** (see its docstring). `all` = v1, bosses, ui, perf, levels.
  - `v1`: 27 old specs play the same notes as 6.2.0 (fixture `test/fixtures/mus63_v1.json`, made with `V1PAGE=<6.2.0 entropy.html> python3 mus63.py v1 --write`).
  - `bosses`: 13 themes, hooks 3 to 8 notes per cell and pairwise distinct (closest pair 0.67), own BPM and lead each; a scripted fight per theme (radio, boss at 3 s, phase II at 30 s, kill at 50 s): stinger, Final reached, victory sting, radio back, no errors, hook heard 3 to 14 times in 26 s, level inside the genre band, peak under -1 dBFS (worst -5.0), no silent second. Writes `test/out/mus63/boss_<id>.mp3`.
  - `ui`: a real run at 852×393: theme on spawn, deck names it, phase reaches the music, victory and the interrupted song back, unlock on kill, Gloop splits keep one theme, two bosses, switch off keeps the radio, an old fav plays as v1, a boss theme keeps and survives a code; Studio list (13, unlocked playable, no spill), play, switch persists, help text; 852×393 and 667×375.
  - `perf`: themes 0.21 to 0.30× realtime (perfcheck genres 0.16 to 0.29×).
  - `levels`: same flavours and seeds on v1 and v2: means within 2 dB.
  - `variety N [old.html]`: the distance table below. `samples` (BEFORE=old html): before/after genre MP3s.
- **Updated `test/compcheck.py`**: one page per genre (40 styles × 34 parts in one offline context crashed the renderer) and it starts the music before the first `skip()`. 1320 combos, no failures, nothing silent.
- Run clean: harmony.py (2000 radio pieces, none bad), songlength.py, compcheck.py, complow.py, monocheck.py, soundcheck.py, studio55.py, qolbshot.py music, trackbtns.py, genrecheck (new flavours), perfcheck.py.

## Variety, measured (test/mus63.py variety 12)
Mean pairwise distance between 12 radio songs per genre, bars 17–32, energy 0.6 (0 = identical, 1 = nothing shared). Overall = mean of the seven.

| | chords | drums | lead rhythm | contour | bass | instruments | tempo | overall |
|---|---|---|---|---|---|---|---|---|
| 6.2.0 | 0.91 | 0.12 | 0.42 | 0.39 | 0.31 | 0.23 | 0.21 | **0.37** |
| 6.3 | 0.96 | 0.43 | 0.55 | 0.39 | 0.43 | 0.56 | 0.42 | **0.53** |

Overall per genre, 6.2.0 → 6.3: ambient 0.30 → 0.51, lofi 0.40 → 0.56, downtempo 0.32 → 0.61, synthwave 0.37 → 0.53, house 0.34 → 0.53, techno 0.27 → 0.38, trance 0.40 → 0.52, dnb 0.39 → 0.52, chiptune 0.50 → 0.59, dub 0.43 → 0.60. Drums 0.00 → 0.34–0.62 in the genres that had one fixed beat per style. Contour stays at 0.39: hooks change shape as much as the old random walk did, but now repeat as a call and answer. Full tables: `test/out/mus63/variety_before.json`, `variety_after.json`.

## Open issues
- Nothing here was heard on a phone. The samples in `test/out/mus63/` are for Nic: ask which themes land and which grate (the meow and the quack are the riskiest).
- Techno's lead stays silent at energy 0.6 in the groove (lead enters at 0.75, unchanged), so its lead-rhythm distance reads 0.
- Trance/Progressive renders about 6 dB under the other trance styles at bars 17–32 in both versions (6.2.0 behaviour, not changed).
- A boss arriving before the music has started (no tap yet) does not start its theme until the next boss.
- Leaving Compose during a boss fight starts a new radio song, not the theme.
