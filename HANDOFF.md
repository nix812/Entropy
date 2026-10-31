# Entropy — Project Handoff

**Version at handoff: 4.4.0 · October 30, 2026**

Entropy is Nic's personal sci-fi, retro-pixel, endless tower defense game, played on iPhone and iPad in landscape. It is one self-contained HTML file with no frameworks and no network dependencies at runtime (it only fetches its fonts and two music files).

This document has everything a new session needs to keep working on it: where things live, how to build and deploy, how the code is organized, how every system works, the conventions used, the known pitfalls, and the backlog.

---

## 1. Where everything lives

| What | Where |
|---|---|
| **Live game (Home Screen app)** | https://nix812.github.io/Entropy/ — Nic plays this from an iPhone Home Screen icon (Safari → Share → Add to Home Screen). It runs fullscreen. |
| **Claude artifact copy** | https://claude.ai/artifact/RXpFeihcddkscRg4GaHNe9 (private to Nic). Publish `dist/entropy.html` to this same URL. |
| **GitHub repo** | `nix812/Entropy` (public). **`main`** = the built site that GitHub Pages serves. **`source`** = the full source tree, build script, tests and this handoff. |
| **Source zip** | `entropy-source-v4.4.0.zip`, sent alongside this document. It has the same content as the `source` branch (minus `dist/`). |
| **Music** | Since 4.6 the only soundtrack is **Drift**, the generative composer in `src/audio.js` (`Music`). The old composed tracks (`audio/bgm-*.mp3` on `main`, by kjartan_abel) are no longer loaded or credited; the files can be deleted from `main`. |

### Getting the code in a new session
```bash
git clone -b source https://github.com/nix812/Entropy.git entropy      # source tree
git clone https://github.com/nix812/Entropy.git entropy-site           # deploy target (main)
mkdir -p entropy/dist/audio entropy/dist/pages/audio
cp entropy-site/audio/*.mp3 entropy/dist/audio/ && cp entropy-site/audio/*.mp3 entropy/dist/pages/audio/
```
The music lives only on `main` (it's about 5 MB), so the `source` branch skips it. `build.py` doesn't copy audio. `main` already has `audio/`, and copying `dist/pages/*` over it keeps it.
Or unzip the source zip and clone `main` for deploying. Playwright with Chromium and Pillow are needed for the build icons and the UI tests (`pip install pillow playwright --break-system-packages` if missing; Chromium is usually preinstalled).

---

## 2. Build and deploy

```bash
cd entropy
python3 build.py        # -> dist/entropy.html (artifact), dist/bundle.js, dist/pages/ (GitHub Pages site)
```
- `build.py` concatenates `src/data.js, sim.js, audio.js, render.js, ui.js` **in that order** into the `/*__SCRIPT__*/` slot of `src/template.html`.
- It also writes `dist/pages/index.html`. That is a full document with Apple Home Screen meta tags, plus `manifest.webmanifest` and the generated pixel icons (`icon-180/192/512.png`).
- The scripts are plain globals, not modules. Top-level `const`/`let` declarations in one file are visible to the files after it, so order matters.

### Deploy to GitHub Pages (`main`)
```bash
cd entropy-site
cp -r ../entropy/dist/pages/* .
git add -A && git commit -m "vX.Y.Z: summary" && git push origin HEAD:main
```
Pages updates in about a minute, but GitHub serves pages with a 10-minute cache. Since v1.15.2 the app checks for a newer `VERSION` at launch and when it returns from the background, and reloads itself from the main menu. The version also shows in the bottom-left of the main menu.

### Publish the artifact
Publish `dist/entropy.html` to the existing URL above.
- On the very first publish the two music files were attached with `files: {"audio/bgm-menu.mp3": ..., "audio/bgm-battle.mp3": ...}`. Later publishes keep them, so they don't need re-sending.
- Don't change `icon` or `capabilities`. The page declares `db` and `user` for optional cloud saves; those are carried forward automatically.

### Commit conventions (required)
- Author commits as `Claude <noreply@anthropic.com>`: `git config user.name Claude && git config user.email noreply@anthropic.com`. A hook in the original environment enforced this.
- End every commit message with the attribution trailer the session provides (for example `Co-Authored-By: Claude …`).
- Bump `VERSION` in `src/data.js` for every user-facing release. It shows in Settings. Use semantic-ish versions: minor for features, patch for fixes.

### Release checklist (used for every version)
1. Edit `src/*`.
2. `python3 build.py`.
3. `cd test && python3 audit.py n` (phone, 852×393). It must print `ERRORS: []`.
4. For layout changes also run `python3 audit.py ipadA 1180 820 0,0,20`.
5. For balance changes run the bots (section 6).
6. Look at the screenshots in `test/audit/`.
7. Publish the artifact, then push Pages.
8. Tell Nic what changed in plain language (he isn't a coder).

---

## 3. Code map

| File | Lines | Role |
|---|---|---|
| `src/data.js` | ~650 | All tunables and content: towers, enemies, bosses, affixes, legendaries, curses, storms, events, abilities, chaos levels, passive web definition plus the `buildTree()` layout, anomalies, Cosmic Laws, Star Ranks, glossary sources. Also globals `COLS`, `ROWS` (mutable via `setCols`/`setRows`), `TILE=24`, `BW`/`BH`, `UIS` (interface scale), `VERSION`. |
| `src/sim.js` | ~2060 | Deterministic simulation: profile (`PROF`), passive web allocation, `computeMods`, map generation (`genMap`, `genExtraLane`), waves, enemies, towers, combat, statuses, combos, storms, anomalies, checkpoints, cash-in, Supernova, Snare Beacon, snapshots and resume. No DOM access, so it runs headless in Node (`test/harness.js`). Talks to the UI only through `Hooks`. |
| `src/audio.js` | ~560 | **v4.5.1 SFX engine** (`SFX.play(name, arg)`): voices are `tone` (sine, triangle, square, saw or NES pulse duties 0.125 / 0.25 via `pulseWave`), `fmv` (FM bells and zaps), `nz` (filtered noise, `lofi` = sample-and-hold grit), `sub` (falling sine thump), `click` (2 ms transient), and a bit-crush stage (`crush: 1`). Each play builds a small chain: gain → stereo pan (from `setLocator`, wired in ui.js to the screen position; off-screen = ×0.45 and lowpassed) → a bus, with sends to the shared `room` (0.7 s) and `hall` (2.8 s) reverbs. Buses: `busUI`, `busW` (weapons), `busH` (impacts), `busE` (events) → `glue` compressor (−20 dB, 3:1) → sfx volume → brickwall limiter (−3 dB). `duck(db, att, hold, rel, music)` dips weapons and impacts (and synth music) under big events. Voice control: `allow(name, gap, poly)` (minimum interval and polyphony per sound) and `density()` (1/√(1 + 0.18·voices in flight) on weapons and impacts). Every play jitters pitch (about ±0.6 semitone, per sound), level and noise offset. `TRIM` holds per-sound dB set from offline renders (`test/sfxrender.py`) so each role sits in its loudness tier. `SFX.beams(n, ramp)` drives the continuous Void Lens hum; `SFX.danger(k, dt)` the low-hull heartbeat; both are called from `UI.tick`. Kill sounds climb a semitone per rapid kill (up to +7). **Music (v4.7 Drift Studio, `Music`): see section 4.10 for the current design; the v4.6 description that follows is the ancestor.** **Music (v4.6, `Music` / Drift):** a generative composer. A piece = style (`STYLES`: drift, nocturne, glass, lofi, tide) + key (`root`, kept D3–A3, walks by 4ths/steps between pieces) + mode (`MODES`) + progression (`PROGS`, scale degrees, 1–2 bars per chord) + two motifs. 32 bars = phrases A, A', B (second motif, drums thinned), A''; motifs are 16 eighth-note scale-degree moves that `mutate` on repeat, snapped to chord tones on strong beats. Chords are stacked thirds (7ths, 9ths) voice-led into E3–D5 (`voice`). Instruments are synthesized per note (`pad`, `bass`, FM `keys`, `pluck`, `bell`, pulse `lead`, `arpN`, `kick`/`snare`/`hat`) into layer gains `L.*` → warm lowpass → glue compressor → music bus, with a 4.2 s hall send and a vinyl hiss/crackle loop. Layers fade in with intensity via `lvl(threshold)` (vertical layering); style choice at each new piece leans ambient when calm and groovy when busy, never repeats the last style, and `setMood('boss')` forces minor modes and drops drift/nocturne. Tempo: `setBaseBpm` (Settings > Music Tempo, `PROF.settings.bpm`, default 72) is the average; styles sit −9…+9 BPM around it and `liveSpb` nudges it by (intensity − 0.4) × 18 BPM with easing. Intensity comes from `updateHud` in ui.js (wave depth, enemies on field, boss, Maelstrom, pause). `renderAhead(seconds, curve)` writes music into an `OfflineAudioContext` for tests (`test/musicrender.py`). Music uses plain `HTMLAudio` elements, because `createMediaElementSource` broke playback on iOS. **Playlists (v2.0):** on start it probes `audio/bgm-battle-2.mp3` … `-6` and `audio/bgm-menu-2.mp3` … `-6`; each file that loads joins its playlist (a lone track loops, a playlist advances on `ended`). To add music, commit the files to `main`'s `audio/` folder with those names (and attach them to the artifact with `files`); no code change. **Mixed** mode plays a 150 s generative interlude (`MIX_INTERLUDE`) after each composed battle track. `SFX.bgm` exposes the lists for tests. |
| `src/art.js` | ~150 | **v4.5 hi-res art kit (`ART`).** A height-field rasterizer: a design is a list of parts `{ f(lx, ly) → height or -1, z, r: 6-tone ramp, d?: tone delta, e?: emissive colour }` in local px (2 per world unit, facing +x). `raster(parts, W, H, angle)` picks the tallest part per pixel, lights it from the top-left (fixed in world space, so rotated turrets stay correctly lit), dithers 2×2 near tone edges, adds cast shadows, contact lines and a sel-out outline. Shapes in `ART.S` (dome, puck, box, rbox, tube, ring, poly, ell, gem, hexgem) carry bounding boxes the rasterizer uses to skip work. Cache: `get` (sync), `getB` (frame-budgeted: past 5 ms per frame it returns a stand-in, e.g. the nearest cached heading, and queues the real sprite), `warm` + `idle` (background queue, drained 3 ms per game frame and 4 ms per menu frame). |
| `src/units.js` | ~420 | **v4.5 designs (`UNITS`).** Tower bases (per element) and tops (`TOP[type](col, spec, {rk recoil, ph phase, ld loaded})`, 32 headings for turrets; non-turrets spin slowly via `SPIN`), enemies (`ENEMY`, 16 headings × 4 gait frames, sizes in `ESZ`), bosses (`BOSS_ART`, 148 px, 2 frames, cat has an asleep variant), worm segment, meatball, core drum and core gun, pirate skiff, missile and mortar shell. `warmEnemies()` queues every enemy and boss frame at boot (done in ~10 s on the menu); `warmTower()` queues a turret's headings when it's first drawn. |
| `src/render.js` | ~950 | Canvas renderer (`Render`): legacy 1× pixel sprites (`TOPS`, `EN`, `BOSS`, now only fallbacks), map layer, lighting buffer, FX (particles, rings, lines, floating text, speech bubbles), camera zoom and pan, minimap, build-card art (`towerCard`), tower icons. **v4.5:** the world buffer is `RES = 2` pixels per world unit and only covers the camera view (`sizeBuf`, set with `b.setTransform(RES, …, -vx·RES, -vy·RES)`), so every draw call still uses world units. `blit(sprite, cx, cy, k)` draws a centred sprite honouring its `.u` (units per pixel). Hi-res sprites come from `UNITS`. map layer, lighting buffer, FX (particles, rings, lines, floating text, speech bubbles), camera zoom and pan, minimap, build-card art (`towerCard`), tower icons. |
| `src/ui.js` | ~1740 | DOM UI (`UI`): HUD, rails, panels (build, tower, core, cash), modals (setup, pause, game over, help, dictionary, archive, Hall of Fame, settings, save transfer, Supernova), toasts, glossary tooltips (`tipify`), input handling, the **passive web module `Tree`** (3D/flat galaxy view, constellations, regions, profile radar, Star Ranks panel), the `Save` module, and the boot loop. |
| `src/template.html` | ~540 | All CSS and markup skeleton. Design tokens live in `:root` (`--amber`, `--core`, `--bad`, `--panel`, `--line`, `--f-pix` = Silkscreen, `--f-term` = VT323, `--rail`, `--ui`). |
| `build.py` | 42 | The build (section 2). |

### Key globals and modules
- `G`: the current run state (null between runs).
- `PROF`: the persistent profile, saved to `localStorage` key `entropy.save.v1`, with optional cloud sync through the artifact `db`.
- `Hooks`: sim → UI callbacks (`toast`, `log`, `fx`, `sfx`, `onGameOver`, `onChange`, and others).
- `Render`, `UI`, `Tree`, `Save`, `SFX`: the module objects.
- `simStep(dt)`: one fixed 1/30 s tick. The main loop accumulates real time × speed and stops while paused, in modals, in the web, or at checkpoints with no enemies on the field.

---

## 4. Game systems reference

### 4.1 Core loop
- **Map:** a procedural serpentine main path from the left edge to the core, plus extra wormhole lanes that open on a schedule.
- **Waves:** endless, with a boss every 10 waves.
- **Credits** come from kills and Credit Forges. **Score** comes from kills, multiplied by chaos, anomalies, Stabilize, Supernovas and Laws. **XP** is score × 0.1, and XP becomes profile levels, which become passive points.
- **Run setup:** starting wave (in steps of 5, unlocked by best wave), Chaos level, and map reroll. Dailies get a fixed seed plus 2 anomalies, always on Unstable.
- **Snapshots:** `snapshotRun` saves at each wave start and when the app is hidden, so runs resume. Snapshots store `cols` and `rows`.

### 4.2 Map size and wormholes (scale with Chaos)
| Chaos | Rows | Extra wormholes open at waves | Other multipliers |
|---|---|---|---|
| Calm | 22 | 16, 30, 46, 64 | HP ×0.7, score ×0.8 |
| Normal | 26 | 15, 28, 42, 58, 78 | ×1 |
| Unstable | 30 | 12, 24, 36, 50, 66, 84 | HP ×1.15, score ×1.35 |
| Pandemonium | 34 | **1**, 10, 20, 32, 46, 62, 80, 100 | HP ×1.5, kill credits ×0.8 (`CH.cr`, v1.17), score ×1.8 |

- **Expanding sector (v1.15):** a run starts on `REGION0` = 60% of the full map (rows and columns), placed so the core keeps the same relative position. Each time a wormhole is *detected*, `growRegion()` widens the sector one step (`stageFrac(stage, N)`, linear), so the last scheduled wormhole brings the full map.
  - `G.region = {x0, y0, x1, y1}` (tiles, x1/y1 exclusive) is derived, never stored: `regionAt(G.lanesOpened)`. Snapshots carry `grow: 1`; snapshots without it (v1.14 and older) resume with `G.fullMap = true`.
  - `genMap` builds the main path inside the starting sector. `genExtraLane` searches and pathfinds only inside the current (already grown) sector, placing wormholes at 75–100% of the in-bounds distance.
  - `extendMain(R)` lengthens the main path from its old start to the new left edge, with a 3–7 row jog. It replaces `map.lanes[0]` with a new lane object; enemies already walking keep the old object, so nobody jumps. The main path grows from about 55 to about 100 tiles on Normal.
  - `canBuildAt`, taps, ability aim and storms (spawn, drift bounds, Maelstrom centre) all respect `G.region`.
  - **Camera:** `Render` frames `reg` (buffer px), not the whole buffer. `updateRegion()` snaps on a new run and otherwise eases over 2.6 s (wall clock, so it runs while paused), resets zoom to 1, and draws the old border as a fading dashed outline. The minimap shows the sector. `Render.onCam` lets the UI refresh the Fit button.
  - **Setup screen:** the preview dims the full map and outlines the starting sector; the note reads "Sector 28×16 → 47×26".
- **Columns** are fitted to the playfield aspect: `fitCols()` = `ROWS × w / h`, clamped to 38–76. A phone on Normal gets about 44×26.
- **Core position (v1.17):** random, x from 18% of the width to 6 tiles from the right edge, y 3 tiles in from top and bottom. `genMap` builds the main serpentine in a mirrored coordinate `u` from the sector edge *farther* from the core (left or right). Length rule: at least max(28, 2.05 × span) and at most 3.4 × span + 8, where span = tiles from that edge to the core − 2. Normal main road: median about 48 tiles at the start (range 32–69). `extendMain` extends on whichever side the main wormhole sits.
- **`genExtraLane`:**
  - It favours directions (angles around the core) that no existing wormhole uses.
  - It places the wormhole at 70–100% of the in-bounds distance along that angle.
  - 60% of new lanes route directly to the core, with a minimum of 11 tiles. The rest merge into an existing lane partway along.
  - Routes may cross existing paths (crossing costs extra in the pathfinder).
  - Pathfinding is Dijkstra on a binary heap.
- **Warning and opening:** a forming wormhole appears 2 waves before it opens, with its route marked as tile type 5, plus a "WORMHOLE DETECTED" toast.
- **Core relocation (v1.16):** at a checkpoint with the field clear (`canRelocate()`), the core panel offers Relocate Core. The first move each run is free, then each costs `RELOCATE_COST` = 800 credits (flat, always shown). Range is `RELOCATE_RADIUS` = 10 tiles from the current core.
  - `relocCandidates()`: inside the sector (1-tile margin), not an obstacle or tower, at least 6 tiles (Manhattan) from any wormhole. Roads are allowed.
  - `planRelocation(x, y)` re-paths every lane with `pathfind()` (Dijkstra in the sector). Costs: own road 0.08 (lanes keep their winding shape), roads already re-planned in this move 0.5 (later lanes merge), other lanes' roads 1.2 (crossable, no shortcut), ground 1 + 1.2 per adjacent road. Towers and obstacles block. Routes shorter than 6 fail. The result carries `before`/`after` lengths for the preview.
  - `applyRelocation(plan)` rewrites tiles (open lanes type 1, forming type 5 with `branch` = whole route), moves `G.core`, builds new lane objects, and remaps `G.prep.queue`/`G.queue` lane references (and rebuilds a Breach rift).
  - **The sector grows around `G.anchor`** (where the core started), not the current core. Snapshots carry `anchor` and `relocUsed`.
  - UI: `G.reloc = {cands, plan}`; panel kind `reloc` shows road lengths before → after per lane and the total. The map draws the 10-tile circle, valid tiles, dashed amber routes and a ghost core. The checkpoint banner hides and the bonus timer pauses while relocating.
- **Checkpoint:** the wave before a wormhole opens is a pause. Since v1.16 it waits for the field to clear (`cpPending()`; HUD says "N left · Checkpoint next", Next is disabled), with a 180 s safety cap so a stuck enemy can never stall a run. Sells refund 100% and respecs are free. Resuming quickly pays a bonus that decays over `CP_WINDOW` = 45 s.

### 4.2b Power Nodes and Salvage (v1.17)
- **Power Nodes** (`G.nodes`, `G.nodeSet`, `isNode`): 3 in the starting sector, then 1 in each newly revealed band (`placeNodes(n, R, P)`), on open ground within 2 tiles of a road where possible, at least 6 apart.
  - A tower on a node gets ×1.25 damage and ×1.15 range (`NODE_TOWER`). Support boost, economy income and snare catches get ×1.25.
  - The core on a node gets ×1.5 damage and ×1.2 rate (`NODE_CORE`). Only reachable by relocation; the core never spawns on one.
  - Roads (new lanes, main extension, relocation routes) never pave over a node. Snapshotted as `nodes`.
  - Drawn as a pulsing cyan diamond, or corner brackets when built on.
- **Salvage caches** (`G.caches`, `updateCaches`, `claimCache`): from wave 3, only while a wave is spawning, every 30–60 s, at most 2 at once. Each lasts `CACHE_LIFE` = 22 s and is never on a node, tower or road, nor within 4 tiles of the core.
  - Tapping one (checked before tower and build taps) rewards: credits `(40 + 14·wave) × credit mult` 40% · random ability charge 20% · +12 Entropy 15% · `150·wave` base score 15% · +1 Recalibration token 10%.
  - Not snapshotted (they're transient). Shown on the minimap when zoomed. Cleared when a checkpoint starts.
  - **Variants (v1.18):** `kind` is `normal`, `cursed` or `gold`. From wave 10, 22% are **cursed** (red): double reward, but `spawnEnemy` releases an elite (2 + wave/30 affixes, HP × chaos HP × 1.5) from a random open wormhole. Every boss wave forces one **golden** crate (`G.goldAt`): 50% the next tower built rolls a Legendary (`legendQueue++`), otherwise triple credits plus an ability charge.
- **Space pirates (v1.21):** crates are delivered by pirate drop ships (`G.pirates`, `updatePirates`, cosmetic and not targetable). A ship enters from the left or right sector edge at the crate's row, at 18 tiles/s (the gold flagship at 14, drawn ×1.5), and the crate appears as it passes over the tile. A dashed marker shows the drop spot. Ships in flight count toward the 2-crate cap.
  - Speech lines from `PIRATE_LINES` (normal, cursed, gold, thief, stow) via the existing `say` fx: 25% of drops, 60% of flagships, 50–60% of thieves, always for stowaways.
  - **Cursed claim:** the elite gets `e.stowaway` (drawn with a red bandana) and says a line.
  - **Thieves:** from wave 5, when an unclaimed crate drops below 8 s, there is a one-time 25% roll (`c.thiefRolled`) for `spawnThief(c)`. That spawns a real `pirate` enemy (in `ENEMIES` with `from: 9999` and `w: 0`, so never in waves; flying, 70 HP × wave HP × chaos HP, speed 2.6) on a custom lane: edge → crate → opposite edge.
    - The crate stops decaying while its thief lives. On reaching the crate the thief removes it ("LOOT STOLEN"). At the lane end it simply despawns (no leak, no core damage).
    - Snare Beacons ignore pirates. Killing a thief pays `(25 + 6·wave) × credit mult` bounty plus the crate's reward, whether or not it had grabbed it yet. Claiming the crate first leaves the thief empty-handed.
  - Ships and crates are cleared at checkpoints.
- **Node Links (v1.18):** combat towers (not support, eco or snare) on Power Nodes within `LINK_MAX` = 9 tiles pair up in `updateLinks()` (called from `recomputeAuras`). Each linked tower gets `+LINK_DMG` = 10% damage via `t.buff.dmg` and `t.linkedTo`. `updateLinkBeams(dt)` makes the beam deal `LINK_BEAM` = 50% × the average of the two towers' dmg × rate per second (as `dot` hits, no statuses) to enemies within about 0.55 tiles of the segment. Drawn as a jittering cyan beam; it goes slack and dim when either tower is disabled.
- **Core Overdrive (v1.19, replaces the v1.18 charge version):** once per run, from wave `OD_WAVE` = 35 (`odReady()`; `G.odUsed` = the wave it was used, snapshotted along with `odToldAt`). `odAnnounce()` at wave start toasts "OVERDRIVE ONLINE" once. From the core panel, the first tap arms the button for 3 s and the second releases it. `releaseOverdrive()` returns `over`, `used`, `locked`, `empty` (no non-boss enemies; not consumed) or `ok`. It `kill()`s every non-boss enemy on the map (up to 6 passes, so splitter children go too; full kill credits and score). Bosses survive, losing `OD_BOSS` = 20% of current HP (floor 1) plus a 0.6 s stun. The core shows pulsing rings while it's available.

### 4.3 Towers (12)
| Tower | Cost | Unlocks at wave | Notes |
|---|---|---|---|
| Pulse Blaster | 60 | 1 | |
| Rail Lance | 110 | 1 | |
| Cryo Emitter | 75 | 1 | |
| **Snare Beacon** | 75 | 4 | Kind `snare`. Netted fliers take +20% damage (v2.0, in `hit()`). Fliers whose straight line passes within the lure range (3.5) detour through the beacon, get held 0.8 s, and are slowed 50% inside the net (radius 1.3). Catches 8 fliers per wave. Bosses and pirate skiffs are never lured (v4.4). Building one mid-wave re-routes fliers already in the air. |
| Swarm Missile | 120 | 5 | |
| Relay Pylon | 100 | 8 | Support. Range 2.6, +18% damage, +12% rate (v2.0). |
| Arc Coil | 100 | 10 | |
| Credit Forge | 150 | 12 | Economy. |
| Flame Projector | 90 | 15 | |
| Void Lens | 150 | 20 | Ramp ×4 (Event Horizon ×6.5, Prism Split ×3). The strongest boss killer; trimmed three times in v2.0. |
| EMP Mortar | 130 | 25 | |
| Gravity Well | 140 | 30 | Each pull on the same enemy is 15% weaker (floor 30%), so it can't hold a line forever (`e.pullN`). |

- **Roles:** `TOWER_ROLE` in `ui.js` gives each tower a one-line role in the build menu ("Boss killer · …"). Keep it in step with any rework.
- **v2.0 tuning** (from 1.21): Lens dmg 2.8→2.0, ramp 4.5→4, Event Horizon 8→6.5, Prism 3.5→3, cost 140→150; EMP dmg 26→32 (Blackout 1.2 s stun, +0.3 splash, ×1.4 dmg); Coil 17→22; Grav 8→14, cost 150→140; Missile 26→31; Cryo dmg 5→6, rate 1.0→1.15, range 2.1→2.5; Pylon as above; Snare cost 90→75; Splinter Rail ×1.25→×1.4 damage. Conflagration keystone reworked: Thermal +25%→+50%; Resonance reads each tower's own element (`s.el0`) instead of the converted Thermal (it used to wipe Resonance out); Chill converts into Burn chance (Cryo towers become burn appliers); burning enemies are 25% slower (`enemySlow`); and with no Chill, heat builds instead: every 3rd Thermal hit on a burning enemy triggers Thermal Shock (`e.heat` in `applyStatuses`). The bots showed the real loss was combos and crowd control, not damage: raising Thermal alone from +35% to +60% moved it only from 58 to 60.5; restoring combos took it to 62.5, and the final version (+50%, 25% slow) to 64.5, near Chaos Engine's 67.5. The bot still builds Cryo for control, which suits this keystone badly, so players running fire builds should do better. Note `st.burn` is an object (`{dps, t, src}`), never compare it with numbers.
- **Keystone check (v2.0, 8 seeds, 40 points, Normal):** none 72.5 · Glass 71.5 · Overgrid 68.5 · Absolute Zero 70.5 · Singularity 74.5 · Diminishing Returns 73.5 · Prismatic 69 · Chaos Engine 67.5 · Unbreakable 71 · Celestial 70 · Event Singularity 70.5 · Conflagration 64.5 after its rework (medians). No keystone stands out.
- **Levels and specializations:** towers go to level 3, then pick one of 2 specializations, then can Ascend (levels 4–5) for ×1.3 damage and a new affix.
- **Affixes and veterans:** affixes roll on build and upgrade, and can be rerolled. Kills earn veteran ranks, and each rank offers a choice of mutations.
- **Resonance:** adjacent towers of different elements give +8% damage per element.
- **Elements:** Kinetic K, Thermal T, Cryo C, Arc A, Void V, plus N (neutral).
- **Statuses:** Burn, Chill (Freeze at 5 stacks), Shock, Mark.
- **Combos:** Shatter, Thermal Shock, Overload, Superconduct, Collapse.

### 4.3a Core Battery (v1.20)
- The core is a long-range support gun (`CORE_GUN`): damage `12 × 1.5^(LV−1)`, rate 0.8/s, range `16 + 1.4 × (LV−1)` (+ web `coreRange`, × range affixes), blast 0.6. Battery max LV 12; costs are unchanged (`120 × 1.75^(LV−1)`, about 32k for LV 12).
- Average coverage over 30 random cores: LV 1 reaches 86% of the starting sector and 49% of the full map; LV 12 reaches 94% of the full map.
- **Targeting:** the shortest remaining route to the core (`L.len − d`; fliers use straight-line distance), anywhere in range. Shells are homing bullets (`shell: 1`, speed 16, life 3 s) drawn as plasma orbs with trails.
- **Modules** (`CORE_MODULES`):

| LV | Module | Effect |
|---|---|---|
| 4 | Twin Battery | +1 target per volley |
| 8 | Siege Shells | +0.6 blast radius, +25% damage vs elites and bosses |
| 12 | Orbital Uplink | Every 5th volley strikes the highest-HP enemy in range: 3 × shell damage in 1.5 tiles |

- Approximate DPS (no affixes or web): LV 1 about 10 · LV 4 about 68 · LV 8 about 343 · LV 12 about 1,700 (plus blast and uplink). The old core was about 21 DPS at 3 range on LV 1. Bots: Normal 47.9 (24 seeds) versus 45.5 before.

### 4.3c v3.0 "Red Queen": power grid, counters, the evolving swarm
Nic (v2.3): tower choice felt irrelevant; two splash towers at the gate plus mass-spamming any tower carried every run. v3.0 attacks the three causes: unlimited cheap towers, enemies that don't care what hits them, and nothing to read or react to.
- **Power grid** (inspired by FTL's reactor). `GRID = { base: 8, perWaves: 3, max: 46 }` in data.js; `gridCap()` = base + floor(wave / 3) (capped at 46) + `G.gridBonus` (Spare Reactor boon, +2) + `G.mods.gridAdd` (unused hook for future web nodes). Every tower draws 1 (`towerPower`); towers on Power Nodes draw 0. `buildTower` refuses when `gridFree() < 1` and calls `Hooks.gridFull`. Runs resumed with more towers than the cap keep them (they just can't build). HUD shows `#pw` beside credits; the build panel shows the grid and a disabled "Grid full" button.
- **Overcharge:** `t.oc` 0–2 (`OVERCHARGE = { max: 2, dmg: 0.25, rate: 0.1 }`), applied at the end of `towerStats`; draws extra power; `setOvercharge(t, n)` is free and instant (mid-wave reallocation is the point). Not for eco, support or snare towers. Saved in snapshots. Drawn as green bolt pips on the tower.
- **Counters and identity:**
  - Plating (`e.armor`) now blunts every hit except piercing fire: Rail (`kind: 'rail'`), Void Lens (`kind: 'beam'`), `shred`, damage over time (`o.dot`) and abilities (`o.abil`). It used to touch only Kinetic. Plating is capped at 70%. Juggernaut has armor 0.35 (0.5–0.6 caused early collapses for fresh profiles) and lost its Thermal resistance.
  - Arc damage hits shields at ×2.5; EMP shell impacts halve shields.
  - Burn stops all regeneration.
  - `ground: 1` towers (Flame Projector and Gravity Well) can't target fliers (`findTargets`, the cone loop, the grav filter); napalm zones don't burn fliers. EMP started ground-only too, but forced-EMP bot runs collapsed once evolution bred Wings, so its shells hit air.
  - Tower changes for v3: Flame damage 4.2→6.5 and range 1.9→2.1; Gravity Well 14→30; EMP 32→40; Cryo 6→7.5; Void Lens damage 2.0→1.85 and ramp ×4→×3.5 (Event Horizon ×6.5→×5.5).
  - Ascension cost stays ×2 per Ascension. ×1.5 and ×1.75 were tried under the grid (bots sat on 3,000+ credits late), but both made the late game too easy (60-point bots: wave 72 → 82–85) and made Lens-heavy builds the meta, because the strongest tower per slot wins once slots are capped. Spare credits late go to Cash In.
  - Missile 31→35, Arc Coil 22→24 (v3 final pass).
  - `TOWER_ROLE` lines say what each tower answers. Splinter Rail is now `+4 Pierce, ×1.5` (Rail always pierces Plating).
- **The evolving swarm (the twist):** a small genetic algorithm over enemy traits, inspired by the Red Queen hypothesis (an arms race where both sides keep running). No notable tower defense game breeds its waves from your defence's failures.
  - `GENES` in data.js. Each gene trades HP or speed for its edge, priced to be roughly neutral against a balanced defence (damage needed ÷ time in range ≈ 1). The first pricing made most genes net upgrades, and bots on fresh profiles collapsed. Each gene has a counter.

    | Gene | Edge | Price |
    |---|---|---|
    | plating | +0.4 armor | hp 0.75 |
    | wings | flies (from wave 16) | hp 0.4, speed 0.65 (the flight line is about a third of the road, so Wings needs the steepest price; at hp 0.5, speed 0.8 it took 40–60% of the swarm in most builds) |
    | haste | speed 1.4 | hp 0.7 |
    | bulk | hp 1.4 | speed 0.75 |
    | brood | 3 mites at 12% HP | hp 0.7 |
    | shell | 50% shield | hp 0.7 |
    | regen | 2.5%/s unless Burning | hp 0.75 |
    | ward | 50% resistance to one element | hp 0.85 |
    | cloak | cloaks (from wave 12) | hp 0.75 |
  - Up to `geneCap(w)` genes per ordinary enemy: 0 before wave 8, 1 until 22, 2 until 45, then 3. `geneOk` stops pointless or early genes (a gene's `from`, wings on fliers, brood on swarmers or splitters, cloak on Phantoms, plating on already-armored types). Bosses, pirates, voidlings and spawned minions carry none.
  - **Fitness:** `geneRecord` on kill or leak records progress along the lane (a leak counts 1.5) minus that species' running average (`G.geneExp`), so it measures the genome's advantage, not the species'.
  - **Breeding:** `breedPlan` (once per wave in `genWave`) takes the top 10 genomes by average advantage, weights them `exp(press × adv)`, where `press` ramps from 0.4 at wave 8 to 4 by wave 30 (you can't diversify early), then halves all evidence so selection tracks the current defence. `breedOne` makes random immigrants: 70% early, falling to 30% by wave 30; the rest are crossovers (a gene shared by both parents is kept 95% of the time, one parent's 55%) with mutation (12% add, 8% drop, 10% ward element change).
  - The queue entry carries `genes` and `gel`; `spawnEnemy` applies them.
  - `G.prep.genes` holds each gene's share of the next wave. HUD chips show traits at 20%+; tap a chip for its counter. The "THE SWARM EVOLVES" toast fires when a trait crosses 35% (again only after it falls below 20%).
  - Saved in snapshots: `geneFit`, `geneExp`, `geneTold`. The test switch `NOGA=1` (passed into the harness VM) keeps genes random, for control runs. The recap shows the run's evolution peak (`G.stats.peakGene`).
  - Brood spawns 3 mites at 12% of the parent's HP (`m.mite`, drawn small).
  - Under Conflagration, a Thermal ward gives 25% instead of 50%.
- **Bot:** `smartbot.js` respects the grid (it upgrades when the grid is full) and answers genes at 30% or more half the time (`NOADAPT=1` turns that off). From wave 15, when the grid is full and it has too few answers to the dominant trait, it sells its weakest non-answer tower (LV 3 or lower) once per wave. `TRACE` prints grid and gene shares; `WAVELOG=1` prints core, credits, grid, leaks, genes, fliers and towers every wave.

### 4.3d v3.1 additions
- **Notifications:** `toast()` is now a queue showing one at a time (`toastNQ`, `nextToast`). Titles matching `LOW_TOAST` (combos, milestones, salvage, boons, refunds…) show for 1.7 s and go to the log when another toast is already waiting. The queue holds 3, dropping routine ones first. Repeats within 4 s are merged. `#tipbox` tooltips close after 7 s.
- **Swarm DNA:**
  - `geneShares()` reads the live queue and field (or `G.prep` between waves). `G.geneHist` keeps the last 12 waves for trend arrows.
  - During waves the HUD shows a `.evchip.dna` chip ("DNA · Plating 38% …"); between waves it shows the per-gene chips. Tapping either opens `openEvo()`, a panel listing every gene with share, trend, description and counter.
  - The first time a trait crosses 35% in a profile, `Hooks.evoIntro` opens it as an intro (`PROF.seenEvo`). Nic missed the twist entirely in 3.0, which is why this exists.
- **Reactor expansion:** `REACTOR = { base: 450, growth: 1.3 }`; `reactorCost()` = base × 1.3^n × (1 + 2% per wave past 10); `expandReactor()` adds 1 to `G.gridBonus` (counted in `G.reactorN`, saved). Offered on the build panel when the grid is full and always on the core panel. The bot buys one when the grid is full and the cheapest upgrade costs more.
- **Run log:**
  - `G.rlog` holds compact events: `start` (version, chaos, seed, level, points, keystones), `wave` (core, credits, score, grid, leaks, kills, measured and potential power, entropy, genes, events, plus the full tower list on waves 1–3 and every 5th), `boss` / `bossDown` / `bossLeak`, `boon`, `anom`, `abil`, `overdrive`, `reloc`, `reactor`, `swallow`, `resume` and `end` (totals, damage by tower type, elements, combos).
  - Snapshots carry the last 1,500 entries.
  - At game over `storeRunLog()` writes it as JSON lines to localStorage `entropy.runlog`. Copy log (clipboard, with a textarea fallback) is on the game-over footer and in Settings; Save log (Web Share with a file on iOS, else download) is in Settings and on the game-over card.
  - Save log works in the Home Screen (Pages) copy. In the Claude artifact viewer, downloads are blocked unless the page declares the `downloads` capability (not done), so use Copy log there.
  - A 100-wave run comes to about 40–50 KB. **When Nic pastes a log,** read the `wave` lines for the difficulty curve, `boss*` for fight outcomes, `tw` snapshots for build evolution, and `end.dmgBy` for the damage split.
- **Tests:** `v31shot.py` (toast queue, evolution intro and panel, DNA chip, reactor buttons, log stored and copied).

### 4.3e v3.2 additions
- **Swarm Codex:**
  - `strainName(type, genes, el)` in data.js builds the name from `GENE_ADJ` (plus `WARD_ADJ` by element) and `SPECIES_NICK`. A pair listed in `STRAIN_COMBO` replaces its two adjectives with a noun ("haste+wings" → "Zoomwing Drone").
  - The first spawn of each type+genome records `PROF.codex.strains[type:gkey] = { n, w }` (capped at 400). A 2+ gene strain's first sighting gets a low-priority "NEW STRAIN" toast.
  - The Archive's Codex lists strains (`strainsHTML`).
- **Run strain:** `G.strainN` counts strains per run (saved in snapshots); `topStrain()` gives the signature strain, stored in the run record, the recap note, the Hall of Fame row ("vs …") and `end.strain` in the run log.
- **Difficulty evolution profiles:** `CHAOS_LEVELS[i].evo = { start, press, seed, capAdd, desc }`. Calm 12 / ×0.6; Normal 8 / ×1; Unstable 6 / ×1.25 / seed 1; Pandemonium 4 / ×1.5 / seed 2 / +1 gene once enemies carry 2.
  - `geneCap` thresholds shift with `start`. Selection pressure is multiplied by `press`, and immigrants are divided by √press.
  - `seed` pre-adapts the swarm: `newRun` plants that many random genes (never Wings) as strong parents in `G.geneFit`. `G.preAdapted` names them; a run-start toast warns, and the recap shows "Arrived adapted".
  - The setup screen shows `evo.desc`.
- **Tests:** `v32shot.py`.

### 4.3f v4.0 "The Swarm Plays Back"
- **Strain Assaults (sim.js, after `genWave`):** the swarm's turn in a back-and-forth.
  - Cadence comes from `CHAOS_LEVELS[i].evo.first` / `.every`: Calm 18 / 10, Normal 14 / 8, Unstable 12 / 7, Pandemonium 9 / 6. `G.assaultNext` holds the next wave; it never lands on a boss wave (`% 10 === 0` shifts +1).
  - `assaultTick(w)` runs at the start of `prepareWave(w)`. When `w + 1 === G.assaultNext` it calls `planAssault(w + 1)`, sets `G.refit = true` (sell refund 100% via `sellRefund`), raises the "STRAIN ASSAULT" alert, and calls `Hooks.assaultWarn` (first time: `openAssault(true)`, paused).
  - **The read:** `intelUpdate()` runs at each `startWave`. It keeps per-tower-type damage (from `t.dmgDone` deltas) and per-element damage (from `G.stats.dmgByEl` deltas), halved every wave. `readDefence(w, jitter)` turns that into scored gene picks with a plain-words reason. Ward fires on an element at 35%+ share. Plating fires on low piercing share (rail, lens, half flame, quarter missile). Shell fires on low Arc. Wings fires on ground-only share (flame, grav). Haste fires on few slow towers. Regrowth fires on low Thermal. Cloak fires on having no Pylon. Brood fires on low splash. Genes from the last assault you broke score ×0.4. `jitter` (assaults only) uses `G.r`; the DNA panel calls it without jitter, so the UI never consumes run RNG.
  - `planAssault` takes up to 2 read genes, fills to `max(2, geneCap + 1)` from the best `G.geneFit` genome, then random. Its name is `strainName(...)` without the species, plus " Strain".
  - `genWave` converts each non-boss entry with probability `ASSAULT.share` (0.7) to the strain (`q.assault = 1`). It then adds `ASSAULT.count − 1` (30%) extra copies and re-sorts by `t`. `A.n` is the total.
  - At `startWave` the assault goes `live`, refit ends, and HP is sized like a boss: `A.hpx = max(1.3, fire × ASSAULT.secs / Σ base HP of the assault units)`, with `fire = max(G.power, potentialDps × 0.5)` and `secs = 30`. Assault units don't pay the gene HP price (Bulk still adds). `e.hpBase` keeps the pre-`hpx` HP.
  - **`hpBase(e)`:** on-death effects that scale with the victim's max HP use it: boom, detonator, burnBoom, shockBurst, napalm, brood mites and split elites. Without it one kill chain-killed a whole assault. Collapse and the Void ability treat assault units like bosses.
  - Kills and leaks of `e.assault` count in `assaultHit`. When all are done (or at the next `startWave` if any vanished) `resolveAssault()` runs. With ≤ 10% leaked (`assaultLimit`) the strain is **broken**: +1 `gridBonus`, credits `30 × wave × CH.cr`, those genes get negative fitness, next assault after `every`. Otherwise it is **entrenched**: `geneFit[key] = {s:3, n:4}`, next assault after `max(4, every − 2)`.
  - Results go to `G.stats.assaults {won, lost, list}`, the recap, and the run log (`assaultWarn`, `assault`). Snapshots save `assault, assaultNext, refit, intel`.
  - **UI:** `#asbar`, a red banner at the top of the field (warn: genes and "Selling is free"; live: strain name, left, leaks vs limit), tap it for `openAssault()`. It hides while a boss is alive, and `body.asbar` pushes alerts down. A HUD chip was tried first, but `#chips` is too narrow on phones. "Free refit · 100%" on the Sell button. Red diamond aura on assault enemies. The DNA panel shows "What the swarm sees in your defence right now" (top 2 reads) and the next assault wave. During an assault wave the "SWARM EVOLVES" announcements are skipped.
- **Notifications rebuilt (`toast()` in ui.js):** three channels, picked by title.
  - `ALERT_RE`: centre card, one at a time, at most 2 queued (extras go to the feed), wraps text, tap to dismiss.
  - `TIP_RE`: `#tip` at the bottom, replaced instantly, never queues; it is also used outside the game screen.
  - Everything else: the feed (`#log`, bottom left), at most 3 lines, each fading after about 7 s, with repeats merged (×n). With Stats on it keeps the last 6 and also shows minor `Hooks.log` lines. The feed hides while a tip shows or a left panel is open. To make something a card, add its title prefix to `ALERT_RE`; keep that list short.
- **Fixes from Nic's run log:**
  - Arc's ×2.5 shield damage keys off `src.s.el0`, so it works under Conflagration.
  - `OVERCHARGE = {max 3, dmg 0.35, rate 0.15}`; the panel shows 4 chips.
  - Idle towers: `t.lastFireW` (set in `hit()` when a tower deals damage) and `idleWaves(t)`. At 2+ idle waves the tower shows pixel Zs and its panel has a red line. `topTower()` names your best tower in the GRID FULL tip.
  - `planRelocation` returns `lose`/`gain` (attack towers losing or gaining road in range), shown in the relocation panel.
  - `rlogWave` now finds genes with `geneHist.find(h => h.w === w)`; it was almost never logged before. It also logs `leakBy` per wave (type+genes, or `boss:id`).
- **Balance (12 seeds, Normal):** 60 points: assaults off 78.5 median, on (bot without refit) 83, on (bot with refit) 73 — within the bot's noise, and the refit bot's crude swaps are the weak link, not the assault. 0 points with all towers locked to their unlock waves (`par.sh 12 0 1 1 1`): off 42.5, on 43.5. Bots break 85–95% of assaults; the losses come late. Sizing tried: `ASEC` 45 cost about 6 waves at 60 points; 100+ made early assaults unbeatable for weak defences. Before `hpBase`, even 200× HP assaults were cleared by on-death chains. Lens ramps up on tanky targets, so it is the natural assault answer; watch that.
- **Tests:** `v40notif.py`, `v40assault.py`. `test/harness.js` now passes the whole `process.env` into the VM; before, only `NOGA` reached the sim, so env knobs were silently ignored. New knobs: `NOASSAULT=1` (sim), `ASEC`, `ACNT` (sim), `NOREFIT=1` (bot), `ASLOG=1` (bot prints each assault: wave, leaked/n, won, hpx, genes). The bot answers an announced assault during refit by swapping its weakest non-answers for counters, and moves damage off a warded element.

### 4.3g v4.4 "Most Wanted" (Fable session, October 30 2026)
Nic gave the session full creative control: review, bug hunt, balance sweep, then 2–3 bold features. The design review is in section 11.
- **Most Wanted (`planWanted`, `claimBounty`, `WANTED_MODS`, `WANTED_FOR`):** every run posts a bounty on one boss. `newRun` picks a boss unlocked by wave `w = max(20, first boss wave ≥ startWave + 10)` and a mutation: Colossal (×1.6 HP, ×1.5 size, ×0.8 speed), Twin (two copies at 60% HP, 3 s apart via `setTimeoutSim`; the bounty pays on the second kill), Hasted (×1.35 speed, ×0.75 HP), Armored (`armorAll` 0.3), Spectral (cloaks 2 s every 7 s, `e.wcloak`), Loaded (×1.1 HP, double bounty, drops a Captain's Chest where it dies). `nextBoss` forces the boss onto wave `w`; `spawnBoss` applies the mod (`e.wanted` = mod id). Bounty = `60 × w × CH.cr` credits + `legendQueue++`. The crime line (`WANTED_FOR`) is the joke: the Auditor is wanted for tax evasion. UI: an alert poster 2.6 s into the run and from the `Wanted · W20` chip between waves, "MOST WANTED · COLOSSAL · 1200 BOUNTY" on the intro card, a gold dashed ring on the boss (Colossal draws ×1.5), "Bounty claimed" in the recap. `G.wanted` is snapshotted; `G.stats.bounty` holds the name.
- **The Black Market (`MARKET`, `MARKET_ITEMS`, `marketEnsure`, `marketBuy`, `marketPlaceNode`):** the late-game credit sink (Nic banked 25–60k with nothing to buy). The Score button now opens the **Exchange** panel: the trader's 3 items on top, Cash In below. Stock `n = floor(wave / 10)`, so it restocks after every boss wave; the stock is drawn from its own RNG (`seed ^ n`) so opening the panel never touches `G.r`. Each item sells once per stock, price `base × (1 + 0.11 × wave)`. Items: Forbidden Schematic (next 2 towers Legendary), Stolen Blueprint (unlocks the next locked tower for the run, `G.runUnlocks`; `towerUnlocked` reads it), Boss Bribe (`G.bossBribe`: next boss spawns at 70%), Node Beacon (`G.placing = 'beacon'`, tap a tile → `marketPlaceNode`; tap the core to cancel for a refund; max 2 per run), Ability Crate (+1 of each), Recalibration Kit (+2 tokens), Fake Star Map (`geneFit`/`geneExp` wiped, a pending assault warning cancelled and `assaultNext` +3), Mutagen Vial (every tower gains an affix), Battle Medal (top tower +1 Veteran rank), Spare Overdrive (only offered after Overdrive was used). Logged as `market`; `G.market` (stock, bought, beacons, spent) and `runUnlocks`, `bossBribe`, `placing` are snapshotted. The HUD tag under Score says "Market".
- **Spare power:** when `gridFree() ≥ 1` during a wave (from Wave 4) the power counter pulses (`.hs.pwr.spare`); tapping it puts the spare points on `topTower()` and opens its panel. Nic's logs showed he never used Overcharge.
- **Red Alert / Last Stand** and the rest of the boss fairness work: section 4.4.
- **Bugs fixed (regression tests in `test/fixes.js`):**
  1. Strain Assaults never happened in runs started past the first assault wave (`assaultNext` stayed in the past). `assaultTick` now catches up, and an assault that converted nothing reschedules.
  2. Pirate skiffs were lured by Snare Beacons (the lure ran before `e.pirate` was set) and vanished at the core. `spawnEnemy` gets `q.pirate`.
  3. A resumed Daily picked up the profile's Cosmic Laws. `resumeRun` clears them (and `G.goldAt` is saved, so a boss wave can't drop two chests).
  4. Marksman scaled the whole grid by 0.6, so a reactor expansion or assault reward could round to +0. Only the wave-grown capacity is scaled now.
  5. A wave saved mid-assault replayed without the strain and then resolved on stale counts. `resumeRun` puts a live assault back to `warn`.
  6. Help and Settings opened from Pause unpaused the game on ✕. `modalFrom` returns them to Pause.
  7. `Tree.action` had two `case 'center'` branches; the live one never cleared the selection.
  8. Conflagration + Glacier (legal at level 75) silently bricked Glacier. `TREE_CONFLICTS` makes `treeBlock` return `conflict:<id>` with a message.
  9. The Wormhole Worm could surface inside the core (section 4.4).
  10. `#tip` overlapped the region chips in the web (`body.webopen`).
  11. `test/doctrine.js`'s Circuit test depended on the map seed; it now builds a 2×2 block.
- **Tests:** `test/fixes.js` (19 checks), `test/v44shot.py` (market, beacon placement, snapshot, spare-power tap, Red Alert and its ×2.5, Most Wanted chip/poster/intro, Pause → Help → Pause), `test/sweep.sh` (one-line batch summaries with per-seed killers).

### 4.3b Core affixes (v1.16)
- Every Weapon or Shield upgrade rolls one affix with the tower rarity odds (`rollTier`, shared with towers). The pool is every attack-tower affix plus core-only ones, weighted 3× (`CORE_AFFIX_W`):

| Core affix | Common range |
|---|---|
| Core max HP | +6–10% |
| Shield | +10–15% |
| Shield recharge speed | +15–25% |
| Hull repair each wave | 2–3% |
| Leak damage reduction | 5–8% (total capped at 60%) |

- Core legendaries (`CORE_LEGS`): **Bulwark Matrix** (shield refills each wave), **Retribution** (a leak blasts 2.5 tiles for 4× core damage, 1.5 s cooldown), plus Detonator, Siphon, Ricochet, Prism and Echo.
- Attack affixes work through `coreStats()`: damage, rate, range, crit, status chances, boss and slowed damage, Execute, bounty, pierce and chain (as bullet bounces), splash, and extra targets.
- **Reroll** rerolls all core affixes for `45 × (1 + 0.5 × rerolls)` (halved by the reroll-discount boon). No curses on the core.
- `G.core.affixes`/`rerolls` are snapshotted; `coreAffSum(c)` caches `c.A` (sums) and `c.leg`.

### 4.4 Enemies and bosses
- **Enemies:** Drone, Swarmer, Juggernaut, Skimmer (flier), Splitter, Phantom (cloaks), Mender, Aegis, Voidling. Elite affixes stack on later waves.
- **Boss rotation (v2.3):** every boss wave calls `nextBoss(w, r)` in `genWave`: a weighted draw from every boss unlocked by that wave (`BOSS_FROM`, or `from` on the boss): Behemoth, Hive Queen, Mr. Whiskers, Gloop, Quackzilla and The Auditor from 10; Phase Wraith and Wormhole Worm from 15; Overmind, Space Whale and Flying Spaghetti Monster from 20; Immortal Snail from 25; Titan from 30. Never-seen bosses weigh 4, others 0.5 + (waves since seen)/20 up to 4, and the last two drawn are excluded (`G.bossHist`, `G.bossRecent`, both in snapshots). The Cat Nebula law limits the draw to oddballs.
- **Oddball bosses** are part of the random rotation above. The wave preview shows them as "Boss ???".

| Oddball | What it does |
|---|---|
| Mr. Whiskers | A giant cat. Swats the nearest tower offline, and naps for 3 s every 12 s (60% damage reduction while asleep). |
| Gloop | A slime that splits on death: Gloop → 2 Gloop Jr. → 4 Glooplets. |
| Space Whale | Flies. Its song heals nearby enemies. |
| Quackzilla | A rubber duck. Quacks, hops forward and briefly disables nearby towers. |
| Flying Spaghetti Monster | Its noodly appendages disable up to 3 towers, and it drops meatball fliers. |
| Wormhole Worm (v2.3) | A centipede (head sprite plus 7 trailing `wormSeg` segments drawn along its lane). Every 10 s it burrows for 1 s (untargetable, immune, held) and resurfaces 4–9% further down the road (never past 75%), sometimes on another lane (`wormSurface`). It swallows the nearest tower within 3.2 tiles (2 in its frenzy), and 15% of the time (always in a frenzy) also your top-damage tower anywhere. Swallowed towers live in `e.gut`; `wormRelease` puts them back on death (same tile or nearest free); a breach digests them. hp 26, speed 0.45. Forced into every boss wave, bots leaked it about 1 in 6 through wave 40 and about 2 in 3 at waves 50–60. |
| The Auditor (v2.3) | Drains 3% of credits + 4 + 1.5×wave every second into `e.audited`; every 9 s freezes your top earner (Credit Forges first, then damage) for 5 s; the empowered audit takes 15% at once and freezes 3. Killing him refunds 125% of the take; a breach keeps it. |
| The Immortal Snail (v2.3) | hp 70, speed 0.16, 20% armour. Regenerates 1.2% per second after 2 s without being hit (capped at its current phase ceiling). Lays slime (`G.slime`, points on its lane lasting 10 s) that makes other enemies 40% faster. Empowered: heals 8% and slimes 6 tiles behind it. |

- **Boss rework (v2.2).** Nic: bosses were no threat, so their abilities and art went unseen. Four parts:
  - **Adaptive health:** `G.power` is the defence's recent peak total tower DPS (sum of `t.dps` each second, held with ×0.995 decay per second, saved in snapshots). In `spawnBoss`: `hp = max(30 × B.hp × hpMult × bossHpX(w) × …, G.power × BOSS_SECS(w) × B.hp/38)`. `BOSS_HPX` (fixed floor for weak builds) is ×2 at wave 10, ×3 from 20 to 40, ×2 from 60; `BOSS_SECS` runs from 18 s at wave 10 to 28 s from wave 40. Gloop's children use `hpAbs`, so they scale with it.
  - **Phases:** `BOSS_PHASES = [0.66, 0.33]`. Crossing one in `hit()` calls `bossPhase`: health clamps at the threshold (no blowing through a phase in one volley), 2.5 s phase shift at 10% damage taken (`e.phaseT`, a pulsing aura in render), +15% speed, a speech line (`PHASE_LINES`) and a toast, and the next ability fires at once, empowered (`e.empowered` read as `big` in `bossBehavior`). Empowered: Behemoth quake (disables towers in 2.5) plus 8 tougher Swarmers; Queen 7 Skimmers; Wraith 4.5-tile jump with 3 s cloak; Overmind EMP radius 4.2 for 4 s; Titan stomp; Cat zoomies (swats every tower in 3.5); Whale big heal; Duck mega-hop; FSM seizes 7 towers and drops meatballs. Gloop has no phases (it splits). `BOSS_POWER` in data.js names each one.
  - **Breach (v4.1):** a boss that leaks ends the run instantly, ignoring shields and Unbreakable (Nic's call). Gloop children still deal 12% and 6% of core max HP. Before 4.1 it was 35% + 10% per phase.
  - **Presentation:** `Hooks.bossIntro` shows `#bossIntro` (portrait via `Render.bossPortrait`, name, title, ability, phase line, "NEW BOSS · FIRST ENCOUNTER" until one is killed) with 1.4 s of 30% slow motion (`UI.slowmo`, UI-only so the sim stays deterministic). The boss bar shows phase notches and PHASE I / PHASE II / FINAL PHASE / SHIFTING; `body.bossbar` pushes toasts below it.
  - **Bot results** (6 seeds, 60 points, Normal): bosses reach both phases in nearly every fight, die 50–70% down the road, and breach about 1 fight in 6 mid-game; runs average wave 77 (75 before), so overall difficulty held.
- **v3.1 boss health:** `fire = max(G.power, potentialDps() × 0.5)`; `hp = max(base floor, fire × BOSS_SECS(w) × B.hp / 38) × (1.3 if the boss flies)`.
  - `BOSS_SECS` is 36 s before wave 45, then 30 s.
  - `BOSS_HPX` floor: ×3 at wave 10, ×3.5 at 20, ×3 at 40, ×2 from 60.
  - Why: bot logs showed `G.power` at spawn reads 8–10× below in-fight DPS early, because small waves never let towers fire flat out. Half of `potentialDps()` (from tower stats: damage, rate, buffs, crit, boss damage, beam ramp) tracks in-fight DPS early. Late, measured power wins, because combos and multipliers the estimate can't see take over.
  - Result at 80 points: waves 10–40 bosses take 25–37 s of fire (it was 4–24 s), runs the same length. Gloop base HP 30→42 (no phases, splits fast).
- **v4.4 boss fairness (a breach is lethal, so every boss must be a fight, not a coin flip):**
  - Bosses always take the **longest open road** (`genWave`). A boss on a fresh 15-tile wormhole lane reached the core in 25 s.
  - **Flying bosses skim the road** (`spawnBoss` uses `lane`, never `lane.fly`). They still fly: Flame, Gravity Well and ice jams can't touch them, and `lure()` skips bosses. The straight line often crossed no tower; 3 of 12 fresh bot runs died to the Wave 10 Hive Queen.
  - **Firepower is capped**: `bossFire()` = `max(0.5 × potentialDps, min(G.power, 2 × potentialDps))`. Measured peak power includes crowd damage (splash, Collapse's %-max-HP on packs, combos) that a lone boss never takes; one Wave 40 whale was sized at 18M HP. Assault sizing uses the same function.
  - **Early floor lowered**: `BOSS_HPX` ×2 at Wave 10 and ×2.5 at 20 (was 3 / 3.5; `BHX10`/`BHX20` env knobs). The floor ignored firepower, so fresh profiles lost 7 runs in 12 to the Wave 10–20 boss.
  - **The swarm hangs back**: while a gen-0 boss is on the field the next wave's countdown runs at a third speed, for up to `BOSS_HOLD` = 45 s (`G.bossHold`).
  - **Red Alert** (`RED_ALERT = { tiles: 8, coreDmg: 2.5, coreRate: 1.6 }`): a boss within 8 tiles of the core (`e.redAlert`, once per boss) raises an alert card, sirens and shake; `G.redAlert` is true while such a boss lives; `hit()` multiplies core damage against it by 2.5 and `updateCore` fires 1.6× as fast. Render: red field tint and a throbbing frame, "RED ALERT ·" on the boss bar. Logged as `redAlert`.
  - **Wormhole Worm**: `wormSurface` keeps the same share of the road when it switches lanes (it used to keep the old distance, which on a shorter lane dropped it into the core = instant game over), hops 3–6% (was 4–9%) and never surfaces past 70%.
  - Result (12 seeds, fresh profile with locked towers, bots): median Wave 22 → 51, early boss deaths 6 → 0. See section 6.
- **Boss health history:** v2.1 tried a bigger fixed curve (up to ×7); it barely moved fight length for strong builds, which is why v2.2 went adaptive.
- **Collapse vs bosses:** the combo's max-HP part is 3% for normal enemies but 0.4% for bosses. At 3% it fired about once a second under Void Lens and killed bosses regardless of their health.
- **Measuring bosses:** `BOSSLOG=1 node test/smartbot.js 1 60 1 1 60` prints each boss's life, time under fire, how far down the road it died, and the top damage sources (from `G.dbgBoss`, collected in `hit()` only when set). `test/bossttk.js` is a controlled version (a set budget of L3 towers against a lone boss).
- **Snapshots and the new bosses:** bosses aren't saved, so `snapshotRun` writes swallowed towers back into the tower list (when their tile is free) and adds the Auditor's take back to credits.
- Oddballs have speech bubbles (the `say` FX), custom SFX (`quack`, `meow`, `whale`, `blorp`) and random titles that show on the boss bar.

### 4.5 Run modifiers
- **Abilities:** Orbital Strike, Entropy Nova, Stasis Field, Frenzy. Charges come from score milestones. A loadout of milestone abilities can be configured through the Command Uplink notable.
- **Entropy gauge:** when it fills, you draw an Anomaly (an upside paired with a cost) or Stabilize (+10% score and a Recalibration token).
- **Storms** drift across the map. Wave **events**, **Boons** after bosses, and **Cash In** (credits → score at 3 × (1 + 0.1 × wave)) are the other modifiers.

### 4.6 Passive web (meta progression)
- **Layout:**
  - 183 nodes, arranged as six sectors around the Entropy Core: Ballistics, Combustion, Voltaic, Cryogenics, Singularity, Bastion.
  - Each sector has a spine, 3 clusters (2 smalls then a notable), a mastery (pick 1 of 3), a keystone and an outer arm notable.
  - Between sectors there is a ring of hybrid notables, plus 3 arc keystones.
  - The Z-axis has a **Zenith** pillar and a **Nadir** pillar. Each holds 2 rotatable **Orbits** whose satellites buff the sector they face. Rotating is free at checkpoints or between runs, and costs 1 token otherwise. Each pillar ends in a keystone (Celestial Order, Event Singularity).
- **Version history:** in v1.7, `WEB_VER = 2` merged pairs of small nodes (90% of their combined value) and spread the layout by `WEB_SCALE = 1.3`. Older saves get their web reset and all points refunded (`migrateWeb()`).
- **Attributes:**

| Attribute | Each point gives |
|---|---|
| Power (P) | +0.5% damage |
| Tempo (Tm) | +0.4% attack speed |
| Focus (F) | +0.35% range, +0.5% status chance |
| Integrity (I) | +1.5 core HP, +0.4 shield |

- **UI (`Tree`):**
  - Flat view by default, with a 3D toggle.
  - Region chips fly the camera to each region.
  - **Here** jumps to the last allocated node, which also has a pulsing amber ring. **Center** goes back to the overview.
  - The **Profile** radar shows an offense–defense meter and colours nodes by category.
  - Tap a node twice to allocate it. Refunds are free between runs and at checkpoints, and cost Recalibration tokens mid-run.
  - Up to 5 builds can be saved.
- **Constellations:** each region has one, drawn on the zoomed-out overview. They fade away as you zoom in, and tapping one flies to that region.

| Region | Constellation |
|---|---|
| Ballistics | Archer |
| Combustion | Phoenix |
| Voltaic | Thunderbolt |
| Cryogenics | Crystal |
| Singularity | Maw |
| Bastion | Bulwark |
| Zenith | Crown |
| Nadir | Serpent |

  A constellation's stars light up as the region fills, and it glows fully when the region is complete or its keystone is taken.
- **Star Ranks:** a finished region accepts unlimited points. Each rank adds `a × 20 × ln(1 + n/20)` in total, by region:

| Region | Bonus per rank (`a`) |
|---|---|
| Five element sectors | +1.5% that element's damage |
| Bastion | +3 core HP |
| Zenith | +0.8% all damage |
| Nadir | +0.6% attack speed |

  Ranks refund for free between runs, and only count while the region stays complete.

### 4.6a v4.2 Doctrines (passive overhaul, phase 1 of 3)
- **Why:** Nic said the web was aimless: mostly small % nodes with no build to track and no visible consequence. A Doctrine turns a region into a play style you see on the field, with a cost. Phase 1 (4.2) = framework + Marksman, Wildfire, War Economy; phase 2 (4.3) = Circuit, Glacier, Event Horizon, Artisan, Gambler; phase 3 = Nic's feedback (and Fable's sweep). Other ideas from the proposal: forks inside doctrines, doctrine-tuning smalls everywhere.
- **Data (`DOCTRINES` in data.js, keyed by sector index):** `{ id, name, tag, counter, lines, smalls }`. `buildTree` adds a seal node `d{i}` (kind `seal`, `ks` = doctrine id) off `s{i}_0`, puts the doctrine smalls on spine nodes `s{i}_2` and `s{i}_3`, and marks cluster notables, mastery, keystone and arm with `need: i`. `WEB_VER = 3` refunds everyone once (toast "Doctrines have arrived").
- **Rules (sim.js):** `treeBlock(id, path)` returns `'seal:i'` (path has a `need` node without its seal) or `'slots'` (more seals than `sealSlots(level)` = 1, 2 from level 75, 3 from 120; `SEAL_NEXT`). `treeAllocate` refuses blocked paths. Refunding a seal also refunds its locked nodes (`treeOrphans`). `treeLoadBuild` drops extra seals and unsealed locked nodes. `computeMods` skips locked nodes without their seal (remnants bypass), and a seal sets `ks[id]`. Doctrine small stats are deleted when the seal is missing. `REGION_NODES` (completion, Star Ranks, Supernova) excludes seals and locked nodes; `REGION_ALL` keeps everything for remnants.
- **Marksman (`ks.marksman`):** `gridCap() × 0.6` (min 3). `ocFree(t)` = +2 Overcharge on attack towers, not drawing power; `ocMax()` = 5. Small `msOc` adds Damage per Overcharge step. Lasers draw while `G.time − t.aimT < 0.7`.
- **Wildfire (`ks.wildfire`):** a burning ground enemy calls `roadFire(e)` every 0.4 s: a `roadfire` zone (r 0.55, 2.2 s, dps = burn × 0.5), merged with one within 0.6 tiles, max 70. `G.heat = min(cap, zones × 0.04)` multiplies road-fire damage; cap 100% (+`wfHeat`); `wfDur` lengthens fires. Towers within 1 + r of a road fire get `t.hot` (checked 4×/s): −25% attack speed, orange flicker. Fliers ignore road fire.
- **War Economy (`ks.wareco`):** `warTier()` = min(8, credits / `warStep()`), step = (500 + 120 × wave) × (1 − `weStep`%). Each tier: core Damage × (1 + 0.6 + `weTur`%) and Attack Speed +8% (in `coreStats`). Towers cost ×1.2. Turrets orbit the core in `drawCore`.
- **Phase 2 (v4.3), the other five:** `DOCTRINES[2,3,4]` are sectors; `[6]` (Zenith, `pillar: 'zen'`) and `[7]` (Nadir, `pillar: 'nad'`) are pillars: `col()` adds seal `d6`/`d7` (x 110 in 3D, `posFlat` puts it 150 px right of the pillar) off the first axis node, gates both orbit hubs, their satellites and the pillar keystone (`need: 6/7`), and adds the doctrine smalls to the axis nodes after each hub.
  - **Circuit (`ks.circuit`):** `recomputeAuras` wires attack towers in the 8 neighbouring tiles (`t.wires`), +8% (+`cLink`) attack speed per wire (max 4), and groups them into `G.chains` (`{ m, t }`). In `updateTowers`, a chain with a member disabled by something else (`disabled > 0 && !stalled`) stalls the rest for 0.8 s (`stalled` flag stops the cascade). Chains of 4+ throw a bolt every 4 s at the toughest enemy in any member's reach: 2 s of Σ(dmg × rate) × (1 + `cBolt`%), Arc, `abil`. Wires draw in render (brighter when the chain is 4+).
  - **Glacier (`ks.glacier`):** `M.dmg × 0.8`. In `updateEnemies`, per lane, ground non-boss enemies sorted by distance: a Frozen one is a wall; anyone within 0.55 tiles behind a wall gets `e.jammed` (speed 0) and becomes the next wall. Smalls reuse `freezeDur` and `frozenVuln`.
  - **Event Horizon (`ks.horizon`):** enemies ×1.12 speed. Every kill pushes a well `{x, y, r 1.2 (+hWell%), t 0.6}` into `G.wells` (max 24); wells pull ground non-boss enemies back 2.6 tiles/s (+`hPull`%). Hitting max Marks yanks a ground non-boss enemy back 1.5 tiles once (`e.yanked`).
  - **Artisan (`ks.artisan`):** `grantVxp` ×2 (+`aVxp`%); `towerStats` × (1 + (0.05 + `aRank`%) × rank), or ×0.75 at rank 0, for attack towers (4.4 trim; was 0.06 / ×0.8); `rerollCost` ×0.5.
  - **Gambler (`ks.gambler`):** `rollEvents` adds one extra random event from Wave 2 (`from ≤ w + 10`); `gamblerScore()` = +25% (+`gScore`%) folded into `G.scoreMult` (newRun and stabilize); `addEntropy` ×1.25.
  - **Balance (12 seeds, 60 points, Normal, bot forced into each; no Doctrine = 58):** Marksman 65.5, Wildfire 55, War Economy 60, Circuit 56.5, Glacier 58.5 (at −20% damage it was 49, so −10%), Event Horizon 66, Artisan 71.5, Gambler 55.5 (when its extra event could be bad on boss waves it was 31; now a fair coin, always good on boss waves). Artisan is the strongest for the bot because it ranks towers anyway; Wildfire and Circuit depend on placement the bot doesn't do. Every batch has a few runs killed by early bosses (lethal breach), worth a look in a balance sweep.
  - Swarm reads: Shell vs Circuit, Wings vs Glacier, Bulk vs Event Horizon, Brood vs Artisan. `#docbar` meters for each. Hybrids and the three arc keystones stay open to everyone.
- **The swarm reads Doctrines:** `readDefence` adds Brood vs Marksman, Wings vs Wildfire, Haste vs War Economy.
- **UI:** seal nodes (double ring + bar), "Doctrine Seal" info card, lock reasons on locked nodes and on deny (`blockMsg`/`blockToast`), **Doctrine** button in the web's top bar opens `docHTML()` (each doctrine's lines, milestones Seal / Notables n/3 / Mastery / Keystone / Arm, Show seal). In a run, `#docbar` (bottom right of the field) shows Road heat, War chest tier and next threshold, Marksman's free Overcharge. The tower panel's Overcharge row goes to `ocMax()` and says how many steps are free.
- **Balance (12 seeds, 60 points, Normal, bot forced into each):** no Doctrine 58, Marksman 65.5, Wildfire 55, War Economy 60: all within noise, none a trap. The bot builds a random mix next to the road, so Wildfire's overheat hurts it more than a player who builds back; if Nic finds Wildfire weak, soften overheat (−25%) first. Every batch had a run die to the wave-10 boss (lethal breach since 4.1).
- **Tests:** `test/doctrine.js` (rules and each effect, headless), `test/v42doc.py` (web drawer, seal, locked notable, Wildfire + War Economy and Marksman on the field). Bot: `DOC=d0|d1|d5` forces a seal, `NODOC=1` never seals (by default it may pick one at random).

### 4.6b v4.2.1 web usability (Nic: far nodes stole taps on the path)
- `cullRadius()`: zoomed in past 1.4× the overview (`zr`), nodes farther than (flat 2600 / 3D 1500) ÷ zr from the camera target fade out over the outer 30% and stop being drawn, labelled or tappable. The selected node and its path always show.
- `focusSector()`: at zr ≥ 1.8 with the target over a sector, other sectors' nodes (except ones linked into it) fade to 18% and can't be tapped, and in 3D the Zenith/Nadir pillars, orbit rings and drop lines hide. `nodeFade()` is shared by drawing and `tap()`.
- `tap()`: collects every node under the finger (hit radius max(16, node + 9)), scores by distance minus a depth bonus, −6 for a next step from your build, −4 on the current path, −8 for the selected node. If the top two are within 5 px of each other (both within 14 px) and zoom < 2.6, it zooms ×1.9 on the spot instead of selecting. Selecting zooms in to at least 2.6× (flat) / 2× (3D) the overview.
- **Undo** (`#tUndo` in the nav column, shown when possible): `allocWithUndo` records each allocated path; `undo()` refunds the last one if nothing later depends on it (mid-run it costs tokens like any refund).
- Doctrine drawer: "Next: <name> · N pts" jumps to the cheapest remaining milestone of a sealed Doctrine.
- Test hooks `Tree._screen(id)`, `_visCount()`, `_dbg()`, `_sel()`; test `test/v43tree.py`.

### 4.7 Supernova (prestige)
- **Requirements:** 3 completed constellations, level ≥ `60 + 10 × novas` (capped at 150), and no saved run in progress.
- **Resets:** XP and level, the web, and Star Ranks.
- **Keeps and gains:**
  - **Remnant:** a finished sector's 4 notables (3 clusters + arm) stay active forever. They render as allocated.
  - **Cosmic Law:** pick 1 of 3. Each law is permanent and adds +15% score.
  - +10% score and +25% XP per Supernova.
- **The 9 Laws:**

| Law | Upside | Cost |
|---|---|---|
| Heavy Gravity | Ground enemies move 12% slower | Bosses have double HP |
| Red Shift | +20% tower range | +20% enemy HP |
| Cat Nebula | Oddball bosses drop 3× credits | Every boss wave brings an oddball |
| Dark Bloom | Elites drop 2× credits | Elites are far more common |
| Lean Times | +30% damage | −25% credits |
| Swarm Law | Enemies have 20% less HP | 35% more enemies per wave |
| Entropic Tide | Entropy fills twice as fast | Enemies move 8% faster |
| Stormfront | Storms hit 40% harder | Storms arrive twice as often |
| Brittle Star | +60% core damage, +1 core range | −25% core max HP |

- Laws don't apply to Daily runs.
- The law offers are stored in `PROF.novaOffer`, so reopening the screen can't reroll them.

### 4.8 Records
- **Hall of Fame:** the top 3 runs by score (`PROF.hall`), each with a full recap record from `runRecord()`. It's in the Archive, and each entry opens its own summary page. Game over shows "Hall of Fame #n".
- **Codex** in the Archive: discovered combos, bosses, anomalies and legendaries.

### 4.9 UI conveniences
- **Glossary tooltips:** `tipify(text)` escapes HTML and wraps known terms in `<span class="tip">`, which shows a dashed underline. A tap shows a popover (`#tipbox`, appended to `<body>`).
  - The glossary combines the dictionary rows (statuses, combos, terms) with every named entity: towers, specializations, enemies, bosses, elite affixes, anomalies, laws, legendaries, storms, events, rarities, attributes.
  - It's used in: web node lines, mastery options and satellites, tower affixes and stat lines, specializations, mutation picks, anomaly and law cards, boons, the game-over and Hall of Fame recaps.
- **Tablet scaling:** `UIS` = clamp(min(vw/820, vh/480), 1, 1.6). `#app` is sized to viewport / UIS and scaled with `transform: scale(var(--ui))`.
  - Canvases set their logical size to the client rect / UIS and multiply their device pixel ratio by UIS.
  - All pointer coordinates are divided by UIS.
  - Settings has Interface Size: Auto, Small (×0.85), Large (×1.2).
- **Zoom:** pinch or double-tap (2.2×), up to 4×. Drag to pan when zoomed. A Fit button and a minimap appear while zoomed. The first run shows a one-time hint (`PROF.zoomHint`).
- **Help:** a tabbed How to Play plus a searchable Dictionary.
- **Settings:** volumes, soundtrack (Composed, Mixed or Generative; see below), version and What's New, HUD lean or full, damage numbers, screen shake, interface size, fullscreen, and save export/import. The save code is `ENT1:` + base64 of the JSON profile, used to move progress between the iPhone and the iPad.

---

### 4.10 v4.7 Music Studio (October 31 2026)
- **Composer** (`Music` in src/audio.js): five genres (`GENRES`: chill 72, synthwave 104, techno 124, chiptune 132, dub 76 BPM; each has a colour, a blurb and a loudness `trim` from offline LUFS renders) and twelve styles (`STYLES`, each with `genre`, `hard` 0..1, a BPM offset scaled by genre tempo, modes, and instrument kinds: `pad` warm/saw/dark/chip/none, `bass` long/pattern/octave/drive16/acid/rumble/chip/chipLong/dub, `keys` broken/rhodes/stab/dubstab/skank/chiparp, `arp` pluck/pluckHi/pulse/pulse16, `lead` bell/keys/pulse/saw/bleep/chip/melodica, `kit` lofi/tide/synth/synth16/techno/deep/chip/chipsoft/onedrop/steppers). Phrygian mode added.
- **Seeded pieces:** genre and style are chosen with `Math.random` (weighted by effective energy, never the same style twice running); then `R = mulberry32(seed)` drives everything else, so a saved piece `{ seed, style, mode, root }` replays exactly. Pieces get names from `ADJ`/`NOUN`.
- **Effective intensity** `effI()` = follow × battle intensity + (1 − follow) × 0.45 + (energy − 0.35) × 0.65. Tempo: `pieceBpm()` = the genre's tempo (`cfg.bpm[genre]`) + the style offset; `liveSpb` nudges by intensity × follow and energy.
- **Chain:** six channel gains `CH` (pads, keys, arp, bass, drums, lead), each with an `AnalyserNode` for the Studio meters → `mIn` (per-genre trim) → warmth lowpass → glue compressor → music bus; a 4.2 s hall (`revRet` = Reverb), a tempo-synced echo (dotted eighth, darkened feedback = Echo), vinyl crackle (Vinyl), and `outAn` for the spectrum. `applyMix()` sets faders, mutes and FX.
- **Config** (`Music.config`, persisted as `PROF.settings.studio`, the same object): `custom`, `genres`, `energy`, `follow`, `bpm{}`, `mix{}`, `mute{}`, `fx{reverb, echo, warmth, vinyl}`, `favs[]`, `favOnly`. Default mode (`custom: false`) ignores all of it except `bpm.chill` (= Settings > Music Tempo = `PROF.settings.bpm`). API: `setConfig`, `apply`, `skip(fav?)` (switches at the next bar), `save`, `meters`, `spectrum`, `piece`.
- **Studio UI** (`openStudio` / `studioAction` in ui.js, CSS `.studio`): entry from the hangar note button (`#bStudio`), Pause and Settings. Touching any control in Default switches to Custom starting from the default values; the Default/Custom chips keep the custom mix. Faders are custom pointer-drag elements (0–125%, double-tap resets). Picking a genre skips to it.
- **Tests:** `test/studioshot.py [W H]` (UI, persistence, pause round trip), `test/musicrender.py secs tag '{studio config json}'` now streams the score into the OfflineAudioContext with `suspend()` every 0.25 s (scheduling everything up front made Chrome's render quadratic). Measured at energy 0.6: chill −19.8, synthwave −18.8, techno −20.1, chiptune −22.0 (trim raised after), dub −18.0 LUFS.

### 4.11 v4.7 field readability and pacing
- **Elites** (render.js `drawEnemy`): ×1.22 size, a turning sigil on the ground and a pulsing tinted rim in the first affix colour; the gold crown with one gem per affix is drawn in the overlay pass (`e._crown`) so crowds can't bury it.
- **Tower badges** (overlay pass): `LV_COL` plate with the level (A1, A2… when Ascended), amber top stripe once specialized, green arrow when the next level is affordable, orange arrow only on the cheapest affordable Ascension. Below 18 screen px per tile it's a dot. The old 2×2 level pips are gone.
- **Core** rendered 1.4× (`CORE_SC` in units.js via the new `raster(..., { sc })` option, which renders at full detail rather than upscaling). A leak makes it flinch (`coreKick`) with a red ring.
- **Haptics** (`Haptics` at the end of audio.js): `navigator.vibrate` where it exists (Android); on iOS a hidden `<input type=checkbox switch>` label click (works on iOS 17.4–26.4 only, Apple removed it in 26.5, and may need a user gesture). Setting `PROF.settings.haptics`. A native wrapper (Capacitor) would be the real fix.
- **Wave gap** 13 s (was 10; Time Debt 6), and the countdown runs at half speed for up to 12 s while more than 6 enemies of the last wave are alive (`G.lagHold`).
- **Marksman sight line** only on direct-fire kinds (`SIGHTED`: bullet, rail, beam, cone).

### 4.12 v4.8 Drift Studio II and the closer field (October 31 2026)
- **Music** (`Music` in src/audio.js) was rewritten around ten researched genres. The design, the sources and the verification numbers are in `docs/music-research.md`, so read that first.
  - **Recipes.** `GENRES[id]` holds: `bpm [lo, default, hi]`, `swing`, `human` (ms of microtiming), `form` (flow/song/dance/trance/dnb/dub), `keyR` (root range), `kit`, `drums` (Grids-style level maps 0–9 per step for K S C H O R D P, 16 or 32 chars), `fill`, `ext` (chord depth), `voicing` (jazz/plane/pad/open/triad), and `bass`/`keys`/`pad`/`arp`/`lead` role specs (kind + line/rhythm + `lv` = the energy at which the role enters).
  - **Flavours** (`flavours`) override any of these; `recipe(g, f)` merges them. `hard` steers which flavour Energy picks.
  - **A piece** is `{ genre, flav, seed }`. Everything after the flavour comes from `mulberry32(seed)`, so favourites store only those three.
  - **Studio config** (`PROF.settings.studio` = `Music.config`): `custom`, `genres`, `energy`, `follow`, `bpm{genre}`, `mix{}`, `mute{}`, `fx{reverb, echo, tone, tape, pump}` (0.5 = the genre's own value, via `fxK`), `favs`, `favOnly`, `calmBpm` (Default mix tempo = Settings > Music Tempo). `setConfig` migrates 4.7 configs: chill→lofi, warmth→tone (inverted), vinyl→tape.
  - **Default mode** = Ambient + Lo-fi + Trip Hop at energy 0.4, follow 1. A boss in Default plays Trip Hop.
  - **Effective energy** `effE()` = energy + follow × (battle − 0.4) × 0.85. Drum density = effE × 1.15 − 0.15 + phrase offset + voice bias; a step fires when its level ≥ 10 − density × 10.
  - **Chain:**
    - Channels (meters) → sidechain gain `scG` (all but drums; `duck()` on every kick) → `sweepLP` (filter sweeps for `filterLoop` flavours) → `mIn` → tape wow/flutter delay → 5-bit crush blend → `toneLP` → `toneHS` shelf → `trimG` (per-genre loudness trim) → glue compressor.
    - Sends: two crossfaded convolvers sized per genre (`revS`), a gated-reverb path for synthwave snares, and a ping-pong echo timed to `div` beats.
  - **CPU.** Measure with `test/perfcheck.py [secs] [genres]` (Chrome offline render time ÷ audio time at energy 0.85; v4.8 measures 0.15–0.42×, about where 4.7 sat). The savings that got it there:
    - only the active reverb convolver is fed (the other is disconnected after the crossfade)
    - the gated-reverb convolver and the crusher are patched in only when used
    - closed hats are filtered noise (the six-square metal is kept for open hats)
    - plucks use one saw
  - **Tests.** `Music.debug = true` logs every note event `[t, role, inst, midi, vel, bar, step, genre/flav, chordDeg]`. `test/genrecheck.py [secs] [genre or genre/flav,...] [--knobs] [--mp3]` checks each flavour against the spec (grid, tempo, diatonic share, LUFS, centroid) and that each knob moves the audio. `musicrender.py` still works for battle curves.
- **Studio UI** (`openStudio` in ui.js):
  - 10 genre chips plus Shuffle; tempo sliders for the selected genres only; Energy/Follow with a live Energy meter; five relative FX with a middle tick; section name (Intro/Groove/Breakdown/Drop/Dub version).
  - Pixel sliders everywhere: CSS on `input[type=range]`, filled to `--p` by `paintRange` (a document input listener plus `hydrateIcons`).
- **Camera:** home view guarantees `MIN_TILE` (22) screen points per tile and frames the sector around the core (`homeZ`, `homeAim`, `goHome`). `Render.overview()` fits the sector (zoom 1). The Fit button shows "Map" when home is zoomed in and toggles between the two. Double-tap compares against `homeZoom`.
- **Readability:**
  - Towers draw at `TW_K` 1.12 and enemies at `EN_K` 1.15.
  - Lanes are brighter, with a lit inner edge.
  - Level badges in the overlay use `towerLevel(t)` = lvl + asc and `lvTier(n)` (`LV_TIERS` in data.js: white 1–3, green 4–6, blue 7–9, purple 10–12, orange 13–15, red 16+). Upgrade/Ascend buttons use the next level's tier colour (`tierStyle`, class `.lvup`), and the panel header shows a coloured `.lvtag`. Test: `test/tiershot.py`.

## 5. Profile (`PROF`) fields worth knowing
`v, webV, xp, alloc[], builds[5], bestWave, bestScore, runs, seenVer (last version whose What's New was closed; the popup shows once per version for returning players), kills, playTime, settings{sfx, music, soundtrack, hud, dmgNums, shake, webView, uiScale}, seenHelp, zoomHint, runSnap, lastSetup, codex, mastery{}, loadout[], orbit{}, nova, remnants[], laws[], stars{}, hall[], novaOffer, daily, updatedAt`

- `Save.merge()` fills defaults for any missing fields, so adding a field means adding it to `defaultProfile()` in `sim.js`.
- Any change to the web layout that alters node IDs needs a `WEB_VER` bump, or saved builds break.

---

## 6. Testing tools (`test/`)
| Tool | Use |
|---|---|
| `harness.js` | Loads `data.js` and `sim.js` into a Node VM and exports the sim API. `ROWS` and `COLS` are getters. Add new exports here when you need them in tests. |
| `smartbot.js` | A heuristic player. Usage: `node test/smartbot.js runs points chaos startWave bestWave [keystone]`. `NOVA="s1,s3:lean,gravity"` simulates remnants and laws. The tower plan includes `snare`. |
| `par.sh` | `COLS=48 bash test/par.sh N points chaos startWave bestWave`: N seeds in parallel, printing a summary row each. Column 3 is the wave reached; column 6 is what killed the run. |
| `smartbot.js` `FORCE=type` | Makes that tower half of the bot's build plan. `for f in pulse rail …; do FORCE=$f bash test/par.sh 12 0 1 1 60; done` compares towers as the backbone of a whole run. |
| `lab.js WAVE SEEDS [filter]` | Equal-budget tower lab: each config (every attack tower at L3, Spec 1, Spec 2, plus "pulse+support" mixes at a 30% share) spends the same credits at the best road spots and fights 3 waves with the core held alive. Prints share of wave HP prevented and damage per credit. Set `BMULT` (calibrated: w8 0.559, w14 2.902, w20 2.211) or `CALIB=1` to find it. Survivors at the 1200 s cap count as leaked. **Don't edit `src/` while it runs**: the harness reloads source files for every config. |
| `bench.js` | Damage per 100 credits for every tower, level and spec against a single target, a pack and a stream. |
| `monkey.py MINUTES [W H seed]` | Plays the real page with random taps, panel buttons, zooms, reloads, snapshots and wave jumps, checking invariants (finite numbers, one core tile, `towerAt` in sync, no stalls). Prints page errors with stack lines, problems, and where the time went. Screens land in `test/audit/monkey_*`. CPU-starved runs can report false stalls; it now needs 4 s of frozen sim time, and its report includes frame counts so a starved page is easy to spot. |
| `odbtn.py [W H tag]` | Overdrive rail button: locked, ready, armed, released, used. |
| `sweep.sh LABEL N points chaos startWave bestWave` | v4.4. Runs `par.sh` and prints one line: median, mean, range, runs ended by a boss (and how many by Wave 30), assaults won/total, every wave reached, and `wave:killer` per seed. Env knobs (`DOC`, `FORCE`, `NOGA`…) pass through. The session's whole sweep is `bash test/sweep.sh … > file` in a loop; 12 seeds take 3–4 minutes on 2 cores. |
| `fixes.js` | v4.4 regression suite (19 checks): assault scheduling on late starts, pirate skiffs vs Snare, Daily resume without Laws, Marksman reactor rounding, mid-assault resume, Glacier/Conflagration conflict, Most Wanted (plan, forced wave, twins, resume). |
| `v44shot.py [W H tag]` | v4.4: Exchange panel with the Black Market, a purchase, Node Beacon placement by tap, snapshot carries the market, spare-power pulse and one-tap Overcharge, Red Alert (and the ×2.5 core multiplier), Most Wanted chip, poster and intro card, Help from Pause returns to Pause. |
| `v43doc.py [W H tag]` | v4.3 Doctrines: drawer with all 8, Zenith seal, Circuit wires / Glacier jam / Horizon wells on the field. |
| `v40notif.py [W H tag]` | v4.0 notification channels: alert card, tip, corner feed fading. |
| `v40assault.py [W H tag]` | v4.0 Strain Assault: first-time intro, chip, free refit on Sell, live chip and aura, broken outcome. |
| `v32shot.py [W H tag]` | v3.2: setup evolution note, Pandemonium pre-adapted toast, strains met, recap signature strain, Archive strains. |
| `v31shot.py [W H tag]` | v3.1: notification queue, evolution intro and DNA panel, reactor expansion buttons, run log stored and copied at game over. |
| `v3shot.py [W H tag]` | Power grid HUD readout, build panel when the grid is full, Overcharge buttons and damage, seeded evolution (gene chips, the tap-for-counter toast, evolved enemies on the field). |
| `newbosses.py [W H tag]` | Wormhole Worm intro, walk, burrow, surfacing bite and spit-back on death; Auditor drain, freeze and refund; Snail slime and regen. |
| `bossintro.py [W H tag boss]` | Boss intro card, phase II and final phase with the empowered ability, damage reduction during the shift, and breach damage. |
| `newsshot.py [W H tag]` | What's New popup for a returning player, no repeat after closing, Settings, a build-menu role line and the run-recap highlights. |
| `gallery.py [tag]` | v4.5 art review on a real map: every tower and spec zoomed, every enemy type with genes and an elite, all bosses, a live battle at home and zoomed, and the camera pulled all the way out. |
| `sheet.py [tag]` | v4.5 sprite sheets (towers × specs × headings × elements, enemies × frames × headings, bosses × frames) for close art review. |
| `drawbench.py [page]` | ms per `Render.draw` on a busy scene at home, zoomed in and zoomed out; pass an older build's `index.html` to compare. |
| `panelshot.py [W H]` | v4.5 tower/core panel tabs on a phone, and how many px each tab overflows (Actions must be 0). |
| `sfxrender.py` | v4.5.1: renders every sound offline, prints peak / loudest-50 ms RMS / length per sound, writes `test/out/sfx_all.wav` and a spectrogram sheet `sfx_spec.png`. Re-run after any sound change and keep each sound in its tier (comment above `TRIM`). |
| `musicrender.py [secs] [tag]` | v4.6: renders the score offline along a calm → build → boss → ease intensity curve; prints peak, RMS per 10 s and the pieces written; writes `test/out/music_<tag>.mp3`. Target: RMS around −24 to −26 dBFS, peaks under −6. |
| `closeshot.py` | v4.4.1 pinned headers and tap-empty-ground-to-close. |
| `mkpage.py` | Wraps `dist/entropy.html` with local fonts into `test/out/page.html` for Playwright. **Ad-hoc Playwright scripts must call `mkpage.mk()` after a rebuild**, or they test a stale page. |
| `audit.py TAG [W H SAFE]` | A full UI walkthrough with screenshots (`test/audit/TAG*.png`). Prints `ERRORS: []` when there are no page errors. The tap helper multiplies by `UIS`. |
| `bossfight.py [seed wave chaos]` | Plays a real boss wave through the live UI loop and reports whether the boon pick appeared. |
| `updshot.py` | Serves the Pages build at its real URL and checks the auto-update reloads once, from the menu only. |
| `pirateshot.py` | Drop ship, flagship, a thief skiff and a stowaway on screen. |
| `coreshot.py` | Core Battery shells mid-wave and the battery panel. |
| `odshot.py` | Node Link beam, Overdrive meter, button and shockwave, and all three crate variants. |
| `nodeshot.py [seeds…]` | Random-core starts, building on a Power Node, spawning and tapping a Salvage cache. |
| `relocshot.py [W H tag]` | Core affixes, reroll, relocation mode, preview, free then paid move, resume. |
| `cpwait.py` | Checks the checkpoint holds while enemies remain and starts once the field clears. |
| `boonshot.py` | Kills a boss and checks the boon pick appears and the game resumes; checks the Gloop family gives one pick. |
| `expandshot.py [W H chaos]` | Triggers a wormhole detection and screenshots the zoom-out (`x03_expand_*.png`), then jumps to the full map (`x04_full.png`). |
| `bossshot.py`, `constshot.py`, `navshot.py`, `novashot.py`, `snareshot.py`, `tipshot.py`, `webshot.py` | Focused screenshot scripts for each feature. |

**v4.4.0 balance** (12 seeds each, bots, COLS=48, `test/sweep.sh`; median wave, with the 4.3.0 baseline measured at the start of the session in brackets where it exists). Bots are not deterministic (pitfall 25); treat ±5 waves as noise.

| Batch | v4.4 median (mean) | Boss deaths of 12 (≤ Wave 30) | 4.3.0 |
|---|---|---|---|
| Fresh profile, 0 points, towers locked | **51** (44.8) | 3 (0) | 22 (22.8), 7 (6) |
| Normal, 0 points, all towers unlocked | 41 (38.0) | 3 (1) | 32 (31.3), 9 (5) |
| Normal, 60 points | **71** (70.3) | 1 (0) | 61 (49.3), 6 (2) |
| Calm 0 / 60 points | 57 / 72 | 4 (2) / 3 (0) | 32 / — |
| Unstable 0 / 60 points | 44 / 68 | 4 (1) / 0 | 21 / — |
| Pandemonium 0 / 60 points | 34 / 61 | 2 (0) / 2 (1) | 22 / — |

The two Calm Wave-10 deaths were both Quackzilla, which crosses a Calm road in about 40 s against Behemoth's 95 s; its hp budget (and the Phase Wraith's) was cut after this batch (24 → 17, 30 → 22). Normal 0 points reads lower than the fresh profile because an unlocked bot buys Gravity Wells and Lenses at Wave 1.

Doctrines (60 points, Normal, bot forced into each; the bot builds a random mix next to the road, so placement Doctrines read low): none 61 · Marksman 73 · Wildfire 63 · Circuit 61 · Glacier 62 · Event Horizon 70 · War Economy 72 · **Artisan 77** · Gambler 65. No Doctrine is a trap (all ≥ none). Artisan was trimmed after this batch (rank bonus 6% → 5%, rookies −20% → −25%) and re-measured at **73** (range 61–97, 3 late boss deaths, none before Wave 30), level with Marksman and War Economy; War Economy reads high because the bot banks credits late, which is exactly what the Doctrine rewards.

Towers as a backbone (`FORCE`, half the build one tower, 0 points, Normal): Pulse 51 · Rail 48 · EMP 47 · Missile 46 · Lens 43 · Cryo 41 · Flame 35 · Coil 28 · Gravity 23, against 41 for the mixed plan. Control towers failing as a backbone is by design (Coil is for shields and crowds, Gravity can't hit air); Lens fell from the top because the lower boss floors make a dedicated boss killer matter less early. Late-game damage per credit still has Lens far ahead (5× average at Wave 77 in one 60-point run, with Pulse, Cryo, Coil and Flame at 0.1×), so Lens remains the late-game backbone by design.

**v3.0.0 balance** (12 seeds each, Normal, bots that answer evolution; median wave, v2.3 in brackets):

| Profile | v3.0 | v2.3 |
|---|---|---|
| Fresh profile (0 points) | 52.5 | 56.5 |
| 60 points | 75.5 | 72 |

- **Controls:** evolution off (`NOGA=1`) with the same grid and counters gives about the same median at 0 points (51), so genes are fair trades. Evolution adds variance, not raw difficulty.
- **Tower-heavy builds** (`FORCE`, half the plan one tower, 0 points), against 52.5 for the mixed build:

  | Build | Median wave |
  |---|---|
  | Lens | 59.5 (average 50; boom or bust, because Lens unlocks at wave 20) |
  | Rail | 54 |
  | EMP | 53.5 |
  | Pulse | 51 |
  | Missile | 50 |
  | Coil | 47 |
  | Cryo | 41.5 |
  | Flame | 39.5 |
  | Gravity | 39.5 |

  Over-specialising is now the thing evolution punishes, which is the design.
- **Tuning history:** worth reading before changing genes. Each bullet below was a measured failure before the fix:
  - Gene pricing, from net upgrades to neutral trades.
  - Wings, three passes; the flight line is short.
  - Selection pressure ramp (early collapses at waves 11–14 on fresh profiles).
  - Juggernaut Plating 0.6 → 0.35.
  - EMP hitting air.
  - Ascension growth, ×1.5 and ×1.75 tried and reverted.

**v2.0.0 tower check** (`FORCE=type`, 12 seeds, Normal, 0 points; median wave): default plan 51.5 · Pulse 47.5 · Rail 50 · Cryo 46 · Missile 49.5 · Coil 49.5 · Flame 51 · Lens 55–58 · EMP 47 · Grav 49.5. Before the retune the bots' damage-per-credit had Lens at 4.1× the average and EMP, Cryo, Flame, Coil and Grav at 0.1–0.5×. Lens stays the best boss killer by design; its cost went to 150 after this table. Early deaths around waves 16–21 appear in every set (the bot defends new wormhole directions badly), so compare medians, not averages.

**v1.18.0**: Normal about 45.5 (24 seeds; the bot uses neither Overdrive nor crates, so the gain comes from Node Links plus variance).

**v1.17.0** (random core): Calm about 47 · Normal about 41.5 (24 seeds) · Unstable about 40 · Pandemonium about 44 at the old HP ×1.35 (24 seeds), so it was retuned to HP ×1.5 and kill credits ×0.8 (bracketed by HP 1.5 / credits 0.85 → 41.8 and HP 1.6 / credits 0.72 → 40.4). **Lesson:** raising enemy count (`CH.count`, still supported in `genWave`) made Pandemonium *easier* (46.5), because extra kills pay extra credits. Use HP or kill credits, not count. A random core adds a lot of per-map variance (Normal runs ranged from wave 17 to 53).

**v1.16.0 check** (same 12 seeds): Normal about 47, Unstable about 38, unchanged within noise from v1.15.

**Balance baseline at v1.15.0** (fresh profile, 0 points, bots, COLS=48, the same 12 seeds; v1.14 in brackets):

| Chaos | Average wave |
|---|---|
| Calm | about 51 (44) |
| Normal | about 45 (42) |
| Unstable | about 39 (32), after moving its first lane back to wave 12 (at wave 14 it measured 45, level with Normal) |
| Pandemonium | about 36 (34) |

The expanding sector made every level a little easier, because the compact early map lets towers near the core cover several lanes. The bot is weak at defending several directions, so real play is somewhat easier than these numbers.

---

## 7. Pitfalls already hit (don't repeat them)
1. **The CSS class `.card` is the modal card style.** Never put it on other elements. The build-menu canvases use `.tcard`, after `.card` padding shrank the art.
2. **`ROWS` is mutable** (`setRows`) and set per run from the Chaos level, while the setup screen calls `setRows` before `fitCols`/`genMap`. Anything new that sizes things by `ROWS` must read it at runtime, not cache it.
3. **UIS scaling:** any new code that reads pointer `clientX`/`clientY` or `getBoundingClientRect` for canvas maths must divide by `UIS`. Elements appended to `<body>`, outside `#app`, are not scaled.
4. **iOS audio:** keep music on plain `HTMLAudio`. It needs a user-gesture retry, and the volume slider behaves like on/off on iOS.
5. **Notifications (v4.0):** `toast()` routes by title regex: `ALERT_RE` (centre card), `TIP_RE` (bottom tip) and everything else (corner feed). Identical messages within 4 s are dropped. Alerts are held while a modal or the web is open, unless `force` is passed. Don't add titles to `ALERT_RE` casually: Nic's main complaint was spam.
6. **Checkpoint stall:** the sim halts only when the field is empty. Never wait for enemies to clear before triggering a checkpoint; it caused an infinite stall before.
7. **Map generation cost:** `genExtraLane` runs Dijkstra up to 120 attempts. Keep it heap-based. The old O(N²) version was too slow on big maps.
8. **Snapshots** must stay compatible across versions. The resume path passes `rows: S.rows || 15`. If snapshot fields change, migrate them; don't discard runs.
9. **`tipify` is global** (`globalThis.tipify`) because the `Tree` module lives outside the `UI` closure.
10. **Commits** must be authored as Claude with the attribution trailer.
11. **`G.region` bounds everything placeable.** New code that picks random tiles or spawn points must use `G.region`, not `0..COLS/ROWS`, or things land in unrevealed ground.
12. **Boss rewards and `G.draft`:** while `G.draft` is set the main loop halts, so the pick screen must always open. `UI.tick` reopens it if a pick is pending and nothing is on screen. Test with `test/boonshot.py`.
13. **Lane objects get replaced** (sector growth and core relocation). Anything that stores a lane reference outside an enemy (queued spawns, the rift) must be remapped, as `applyRelocation` does.
14. **Never mutate `map.lanes[0]` in place** when its shape changes; build a new lane with `makeLane` so walking enemies keep valid geometry.
15. **Click handlers can fire after their panel has closed** (double taps, a tap during a close). `panelAction` returns early when `panel` is null; keep that guard in any new handler that reads `panel`.
16. **Bot balance numbers are noisy.** Boon picks use `Math.random`, so the same 12 seeds can swing ±4 waves between runs (Lens measured 55, 56 and 58 on three runs). Re-run before acting on a gap under about 5 waves, and use `lab.js` and `bench.js` for controlled comparisons.
17. **The passive web (`#tree`) is a `.screen`.** `show(id)` hides every other screen, so switching screens while the web was open used to hide it but leave `Tree.isOpen` true, which halts the game loop (frozen run). `show()` now closes the web first. `monkey.py` checks this invariant.
18. **Damage based on max HP must be reduced for bosses**, or boss health stops mattering. Every other max-HP effect uses about 0.3× for bosses; Collapse had none until v2.1. Check new effects with `BOSSLOG`.
19. **Harness env:** the sim reads env knobs through the VM's `process.env`, which `harness.js` must pass in. It used to pass only `NOGA`, so other knobs did nothing in bot runs.
20. **Never inflate an enemy's max HP without `hpBase`:** on-death effects scale with the victim's max HP and will chain through the pack.
21. **`spawnEnemy` lures fliers before the caller can mark them.** Anything that must not be lured (pirates, bosses) is flagged through `q` (`q.pirate`) or checked inside `lure()` (`e.boss`), never by setting a field on the returned enemy.
22. **An enemy's `d` is only meaningful on its own lane.** When moving an enemy to another lane (the worm), convert through the road fraction; copying `d` onto a shorter lane puts it at the core.
23. **`G.power` is a peak of crowd damage.** Anything sized from it (bosses, assaults) must go through `bossFire()`, which caps it at twice the stat-based potential.
24. **Scheduled waves must catch up.** Anything keyed to "wave N" (`assaultNext`) must handle runs that start after N or skip it; otherwise it silently never fires again.
25. **Bots are not deterministic between runs** (boon picks and some cosmetics use `Math.random`), so a seed that died once may survive the next time. Trace with `BOSSLOG=1 WAVELOG=1` on several seeds, and compare batch medians, not single runs.
27. **World buffer is 2× (v4.5).** `R()` and `P()` round to whole world units (a 2×2 block). For half-unit detail use `b.fillRect` with .5 coordinates. Hi-res sprites must carry `.u = 0.5` and be drawn with `blit()` or an explicit size; drawing one with `drawImage(s, x, y)` makes it twice as big.
28. **Camera (v4.5):** `ox`/`oy` are always 0 and the view covers the whole stage. Zoom 1 fits the sector; zoom can go down to `zMin()` (whole map plus 1.5 tiles). `atHome` (exposed as `Render.home`) is true until the player zooms or pans; the Fit button shows whenever it's false, and sector growth snaps the camera home.
30. **Audio (v4.5.1):** new sounds must go through `ev()` + `done()` so they get placement, density, the trim table and voice tracking. Pass the tower, enemy or `{ x, y }` as the second argument so the sound is placed. Frequent sounds (fired per shot or per hit) need an `allow()` gap and polyphony cap. Composed music is plain `HTMLAudio`, so `duck(..., true)` only reaches the procedural synth.
29. **Sprite generation cost:** a turret heading is 1–4 ms, a boss frame ~35 ms, an enemy frame 1–2 ms. Never call `ART.get` for many new keys inside one frame; use `getB` with a stand-in or queue with `warm`.
31. **Offline music renders must stream.** Scheduling minutes of notes into an OfflineAudioContext up front makes every future voice get pulled on every block (quadratic). Use `oc.suspend(t)` steps, as `musicrender.py` does. Live play schedules 0.3 s ahead and is fine.
32. **Overlay badges are drawn in screen space** (`bx2s`/`by2s`), not the world buffer; anything that must stay on top of units (crowns, level badges, the ! mutation badge) goes there.
33. **Music CPU:** every ConvolverNode with an input keeps costing CPU even when its return gain is 0, and long IRs cost more. Feed only what plays (see 4.12), and run `perfcheck.py` after adding voices.
34. **`setConfig` must merge into fresh defaults** (`D2`), not into `d` after `Object.assign(d, c)`: that already replaced `d.fx` with the caller's partial object, which silently dropped the other FX keys (non-finite AudioParam errors).
26. **Don't edit `src/data.js` or `src/sim.js` while `par.sh` batches are running**: every bot process loads the source fresh, so a batch started after the edit measures the new code (and a syntax error kills the rest of the sweep).

---

## 8. Working with Nic
- He's a non-coder who drives product direction, plays on iPhone (Home Screen app) and iPad, always in landscape.
- He has explicitly given Claude **creative freedom** to decide what's fun and engaging. Make the call, explain briefly, and stay open to pushback. When he asks "what do you think" before a change, give the recommendation first, then build once he agrees.
- He wants the game to be **infinitely playable**, chaos-themed, with a deep PoE/Diablo-style build system and some "WTF factor" humour (the oddball bosses).
- **Copy style:** professional and terse, like a skilled game studio. No AI-sounding prose.
- **Reporting:** after each release, say in plain words what changed and anything he should try or know. Don't paste the artifact URL in chat unless he asks.
- **Moving between devices:** progress lives in each device's `localStorage`, so use the save code export and import.

---

## 9. Backlog and ideas discussed
- **Open threads as of 4.5 (October 31, 2026):**
  - **Studio ideas not built yet:** share a saved piece as a code; per-genre favourites playlists; a minimal-piano style; drum-pattern editor.
  - **Conduits (proposed, waiting on Nic; now 4.9):** late-game elite towers that are one ability each, fired by one tap from a left-rail button with a cooldown ring, no aiming. Slots at Waves 40, 60 and 80, one of each kind, ~3 power. The cooldown charges faster from damage dealt by nearby towers, so placement matters. Six proposed: Singularity Lance (one shot at the strongest enemy in range for ~15 s of total defence damage), Chrono Anchor (4 s time freeze, stored damage released ×1.5), Event Horizon (drags everything in range to one point for 3 s), Recall Gate (sends the 12 enemies nearest the core back to their wormhole; bosses lose 30% road), Overclock Spire (×3 fire rate in range for 6 s, then 2 s cooldown), Chaos Engine (random effect table, including turning every enemy into a duck). Planned as 4.6 with bot balance testing. Ask Nic which ones before building.
  - **Default camera framing:** 4.5 makes enemies ~30% larger relative to tiles and lets the camera pull back past the sector, but the home view still fits the whole sector. If Nic wants things bigger by default, raise the home zoom in `resetCam`/`updateRegion` (one number).
  - **Claude artifact copy is behind (still 4.4.0).** Republishing requires reading the whole published file first (~640 KB); Nic plays the Home Screen copy, so 4.5 shipped to Pages only.
- **Open threads as of 4.4 (October 30, 2026):**
  - **Nic has not played 4.4 yet.** First things to hear about: whether the Black Market prices feel right (section 11.4), whether Red Alert reads, and whether the Most Wanted bounty is worth chasing. His run logs now carry `market`, `wanted`, `bounty` and `redAlert` entries.
  - **Early-game feel after the boss changes:** bots say Wave 10–20 bosses are now killable on a fresh profile (0 early boss deaths in 12). If Nic finds bosses too soft, raise `BHX10`/`BHX20` (2 / 2.5) before touching `BOSS_SECS`.
  - **Quackzilla and Phase Wraith** had their hp budgets cut (17, 22) because they cross the road in ~40 s against Behemoth's ~95 s. Worth a `BOSSLOG` check that they still reach phase II against a 60-point bot.
  - **Twin bosses** (Most Wanted) are two lethal breaches at once; if Nic reports a twin death as unfair, make the second twin spawn 8 s later or at 50%.
- **Open threads carried from 4.3:**
  - **More music:** Nic wants more tracks by kjartan_abel. Freesound is blocked from the workspace; Nic plans to add `freesound.org` and `cdn.freesound.org` to his allowed domains (claude.ai Settings → Capabilities). Then fetch the public previews (no login), check each track page's licence (his profile says most are CC BY-SA 4.0; EC credited CC BY 4.0), commit to `main` as `audio/bgm-battle-2..6.mp3` / `bgm-menu-2..6.mp3` (no code change needed), attach to the artifact with `files`, and add each to the Settings credit line. Candidates: battle "Aube Électronique", "Snabba Ladda", "Project Nine – Time is of the Essence"; menu "Homage", "Duality". Nic may instead attach files himself.
  - **Early boss deaths:** since 4.1 a breach ends the run, and every 12-seed bot batch loses 1–3 runs to the wave 10–30 boss. Decide whether that's fair (warning, counterplay) or needs an early-boss HP cut / a first-breach grace.
  - **Doctrine feedback pending from Nic:** Wildfire overheat (−25%) is the first knob if it feels weak; Artisan (73 after the 4.4 trim), Marksman (73) and War Economy (72) are the bot's strongest.
  - **Nic's habits from his logs:** never uses Overcharge; banks 25–60k credits late with a full grid (War Economy is the answer offered); used Conflagration in 4.0.
  - **Fable experiment:** Nic may run one Fable session with a broad prompt (full review, bug hunt, balance sweep with bots, then 2–3 bold features of its own). If a later session sees big unexplained changes, that's where they came from; the version table and commits say what changed.
  - **Selling the game:** honest take given: worth trying on itch.io first ($2–3); blockers are a first-run tutorial, a name/trademark check on "Entropy", and confirming the music licences. iOS needs a wrapper and Apple's $99/yr account; Steam is $100 per game.
- **Keystones costing 2 points**, to slow web completion for veterans. Proposed, not built.
- **Watch the expanding sector's balance.** Bots say v1.15 is slightly easier at every level; check Nic's feel before touching HP. Possible knobs: `REGION0` (start size), the main-path extension jog (3–7 rows), wormhole radius (75–100%).
- **If multi-direction wormholes feel too punishing:** lengthen the warning, or make the first lane longer.
- **Smarter test bot** that defends multiple lanes, for more trustworthy balance numbers.
- **Possible extras:** more oddball bosses, more Laws after all 9 are owned, cosmetic galaxy colours per Supernova (the menu background and web dust), and an animated build-card idle.

---

## 10. Version history (this build cycle)
| Version | What changed |
|---|---|
| 1.6 | Flat web view, profile radar, region chips, oddball bosses |
| 1.6.1 | Constellations |
| 1.6.2 | Here and Center buttons |
| 1.7 | Leaner web: 183 nodes, spread 1.3×, point refund migration |
| 1.8 | Star Ranks and Supernova (Remnants, Cosmic Laws) |
| 1.8.1 | Glossary tooltips |
| 1.9 | Snare Beacon |
| 1.10 | Tablet scaling and Interface Size |
| 1.10.1 | Tooltips everywhere |
| 1.11 | Hall of Fame |
| 1.12 | 360° wormholes with an inset core |
| 1.13 | Larger maps, double-tap zoom, 4× zoom, economy rebalance |
| 1.14 | Map size and wormhole count scale with Chaos; build-menu card art |
| 1.15 | Expanding sector: runs start on 60% of the map, each wormhole grows it, the camera pulls back and the main path extends |
| 1.15.1 | Fix: boss kills froze the game since 1.11 (the boon pick screen `openDraft` had been deleted). The Gloop family now gives one reward when its last member dies. A pending pick with no screen showing reopens itself. |
| 1.15.2 | Home Screen auto-update: on launch and on return from background, the GitHub Pages copy fetches itself (`cache: 'reload'`), and if `VERSION` differs it reloads once from the main menu (never mid-run; a sessionStorage guard stops loops). |
| 1.15.3 | Version watermark in the main menu's bottom-left corner (`#hVer`, set in `renderHangar`). |
| 1.16 | Core relocation at checkpoints (first free, then 800); core affixes on Weapon/Shield upgrades with reroll; checkpoints wait for a clear field |
| 1.17 | Random core position (main road enters from the far side); Power Nodes; Salvage caches |
| 1.18 | Core Overdrive (charged shockwave), Node Links, cursed and golden Salvage crates |
| 1.19 | Overdrive reworked: one board clear per run from Wave 35, bosses survive, two-tap confirm |
| 1.20 | Core Battery: long range, shortest-route targeting, plasma shells, modules at LV 4, 8 and 12 |
| 1.21 | Space pirates: drop-ship deliveries, booby-trapped loot with stowaways, Captain's Chest flagship, Pirate Skiff thieves |
| 2.0 | Whole-game balance and polish pass: tower retune from bot, lab and bench sims (no build stands out); tower roles in the build menu; Gravity Well diminishing pull; Snare net damage bonus; Mixed soundtrack and auto-detected playlists; What's New popup and Settings version row; run highlights in the recap and Hall of Fame; stale-tap crash and serpentine map fixes; monkey, lab, bench and newsshot test tools |
| 2.1 | Bosses: much more health (×3 at wave 10, ×7 at waves 20–30, easing to ×2.5 from 60); Collapse's max-HP damage on bosses cut from 3% to 0.4%; boss measuring tools |
| 2.2 | Boss rework: health scales to the defence's peak DPS, three phases with empowered abilities, intro card with portrait and slow motion, breach damage as a share of the core |
| 2.3 | Random weighted boss rotation; three new oddball bosses: Wormhole Worm, The Auditor, The Immortal Snail |
| 3.0 | "Red Queen": power grid and Overcharge; enemy counters (Plating, ground-only Flame and Gravity Well, Arc vs shields, Burn stops healing); the evolving swarm (waves bred from your defence's failures); tower roles; Spare Reactor boon; evolution peak in the recap |
| 3.1 | Early bosses sized from potential DPS (25–37 s fights at waves 10–40), flying bosses +30%, Gloop tougher; notification queue; Swarm DNA chip, panel and first-time intro; reactor expansion; run log with Copy and Save |
| 3.2 | Swarm Codex (named strains), signature strain per run (recap, Hall of Fame, log), evolution profiles per difficulty (pre-adapted swarm on Unstable and Pandemonium) |
| 3.2.1 | Overdrive button on the left rail (`#bOD`, first in `#abils`): locked label `W35`, glows when ready, two taps (`overdriveTap`, 3 s arm), `Used` after |
| 4.8 | Drift Studio II (4.12): ten researched genres with flavours, Grids-style drum maps, voicing rules, motif melodies, dance/dub/ambient forms, sidechain, relative FX, genre verification test; closer default camera with Map toggle; bolder sprites and lanes; one tower level number in white→red tiers; pixel sliders |
| 4.7 | Music Studio (4.10): five genres, twelve styles, seeded named pieces, energy/follow/per-genre tempo, six-channel mixer with meters, FX, saved pieces; elites, tower level badges and a bigger core (4.11); haptics; longer wave gap; AoE towers lose the sight line. Tests: `studioshot.py`, `eliteshot.py` |
| 4.6.1 | Notifications: boss and bounty briefings are pausing modals with a Fight / Got it button (`PROF.settings.briefings`: pause, brief, off); HUD chips are priority-sorted and clipped to fit with a +N chip that opens the Field Report (`fitChips`, `openReport`); `PROF.settings.notes` (all, key, off) filters alert cards (`KEY_RE` is the Key whitelist) and the corner feed. Test: `test/briefshot.py` |
| 4.6 | Drift: the composed tracks and the soundtrack chooser are gone; a generative composer (five styles, modulating keys, extended chords with voice leading, mutating motifs, intensity layers, boss mood) is the only score; Settings > Music Tempo sets its average BPM (56–100) |
| 4.5.1 | Sound Pass: new SFX engine (layered retro voices, stereo placement, buses, ducking, density and voice limits, trims from offline loudness measurements); impact sounds (hit, crit, armour, shield), per-enemy death sounds with a kill-streak pitch climb, Void Lens hum, Snare net zip, low-hull heartbeat |
| 4.5 | High Definition: 2× world buffer covering only the view; every tower, enemy, boss, the core, pirate skiffs, missiles and shells redrawn with the `ART` height-field rasterizer (fixed top-left light, per-heading turret renders, gait and wing frames, enemies face their heading); camera zooms out past the sector to the whole map with unrevealed ground veiled, and pans at any zoom; half-unit floor detail; tower and core menus split into Actions and Details tabs (Actions fits a phone with no scrolling; Reactor +1 moved into the core footer; Overdrive lives on the rail only; the build menu offers the reactor as soon as the grid is full) |
| 4.4.1 | Panel and modal headers stay pinned while scrolling; with a panel open, tapping empty ground (or the selected tile) closes it, towers and the core still switch |
| 4.4 | "Most Wanted" (4.3g): a bounty boss with a mutation every run; the Black Market in the Exchange panel; Red Alert / Last Stand; boss fairness (longest road, flying bosses skim it, capped firepower, lower early floor, the swarm hangs back, worm fix); spare-power pulse with one-tap Overcharge; 11 bug fixes; balance sweep recorded in section 6 |
| 4.3 | Doctrines phase 2 (4.6a): Circuit, Glacier, Event Horizon, Artisan, Gambler; Zenith/Nadir seals gate their orbits and keystones |
| 4.2.1 | Passive Web usability (4.6b): zoomed-in culling and region focus, crowded taps zoom in, Undo, Doctrine next-goal button |
| 4.2 | Doctrines phase 1 (see 4.6a): seals, Marksman, Wildfire, War Economy, Doctrine drawer and meters, full point refund (`WEB_VER = 3`) |
| 4.1 | Boss HP `BOSS_SECS` ×0.65 before Wave 45 and ×0.8 after, because breaches now kill (bots, 60 points: lethal breach at 4.0 HP dropped the median 72 → 51; ×0.8 everywhere gave 80 but a third of runs died to wave 20–40 bosses; ×0.65 gave 63.5 with no early boss deaths). Assault `secs` 40. The swarm values a Thermal Ward ×0.45 under Conflagration (Nic's log: every assault was Ward-Thermal). Assaults force-resolve 2 waves on. Bosses drawn 1.5× (`BOSS_SCALE` in render.js; hit size 1.15, Gloop splits 0.85/0.6; titan plates, cat eyes and worm segments scaled). A non-split boss reaching the core is an instant game over in `leak()` (bypasses shields and Unbreakable); Gloop splits still breach for 12%/6% |
| 4.0.1 | Music credits in Settings (kjartan_abel, Freesound) |
| 4.0 | Strain Assaults: the swarm reads your defence, telegraphs a counter-strain a wave ahead, free refit, broken (+1 power) or entrenched. Notifications split into alerts, tips and a corner feed. Overcharge 3 × 35%. Idle-tower Zs, relocation coverage, Arc shield fix under Conflagration, log genes and leaks |

## 11. Design review (v4.4 session)
Written by the Fable session as a lead designer joining cold. Keep it current; strike items as they are addressed.

### 11.1 What makes it special
1. The swarm answers back. Genes bred from your failures, assaults that read your towers and tell you why. No other TD does this; it is the identity.
2. Tower count is a resource (power grid), so the game is about making towers count (Overcharge, nodes, placement) instead of spam.
3. Bosses sized to your damage with phases and a lethal breach: every boss is a fight with stakes.
4. A map that moves: expanding sector, wormholes from any side, core relocation, pirates dropping loot.
5. Build depth: affixes, veterans, specializations, Doctrines, Laws, with a dictionary wired into every line of text.
6. The humour lands: oddball bosses, pirate lines, the Auditor.

### 11.2 What is unfinished or confusing (player's eye)
- Currency overload on the first run: credits, power, score, Entropy, tokens, charges, XP, veteran XP, reactor. How to Play is a wall. (Not fixed this session; a guided first run is the single biggest missing feature.)
- Overcharge is invisible. Spare power sits unused for whole runs (Nic never used it). The HUD only shows "8/11". *(4.4: the counter pulses when power is spare mid-wave; a tap Overcharges the top tower.)*
- The lethal breach is fair only if the player sees it coming. Before 4.4 a boss walked the last stretch in silence. *(4.4: Red Alert and Last Stand.)*
- Bosses were unfair for weak builds: the fixed HP floor (×3 at Wave 10) ignored your firepower. Fresh profiles died to the Wave 10/20 boss in 7 of 12 bot runs. *(4.4: floor lowered, firepower capped, bosses on the longest road, fliers skim it; 0 of 12 after.)*
- Storms are weather you can't use: a random +40% to one element drifting around. Only Storm Caller/Magnet players notice.
- Late game money has nowhere to go (Nic banks 25–60k). Cash In is the only sink and it is boring. *(4.4: the Black Market.)*
- Doctrine + keystone conflicts could brick a build silently (Conflagration removes Chill, so Glacier never freezes). *(4.4: refused with a message.)*

### 11.3 Systems that fight each other
- Conflagration vs Glacier: Chill→Burn means no Freeze, Glacier does nothing. (4.4 refuses the pair.)
- Marksman (grid ×0.6) vs Circuit (needs 4+ adjacent towers): legal at level 75, pulls in opposite directions. Left as a real choice.
- Absolute Zero (−50% Thermal) vs Wildfire/Conflagration: weak, not broken.
- Assaults read your Doctrine every time (Wings vs Wildfire/Glacier, Brood vs Marksman/Artisan). Committing to a Doctrine means the same counter-strain returns; the ×0.4 after a broken strain keeps it from being every assault.
- The next wave starts while the boss is still walking (10 s after spawning ends), so the Wave 10 boss fight and Wave 11 overlap. Intentional pressure, but it is why "wave 11" shows as the death wave for a Wave 10 breach.
- Core relocation happens only at checkpoints, when the field is clear, and the bot never uses it; most players will not either. It needs a reason (Power Node on the way) to be worth the tap.

### 11.4 Where the next session should go
1. **A guided first run.** The single biggest gap. Ten waves with one new idea per wave (build, power, Overcharge, the DNA chip, the Exchange), replacing the How to Play wall for new players.
2. **Storms a player can use.** Let the player steer or pop a storm (tap a storm to spend a token: it parks over your towers for 20 s), or tie storm colour to a build choice.
3. **Relocation needs a lure.** Show a Power Node or a shorter-road win in the checkpoint banner, or let the Black Market sell a free relocation.
4. **Watch the Black Market's prices against Nic's logs** (`market` entries): if he still banks 20k+, raise `MARKET.price` growth or add a repeatable item (a credits-for-score-multiplier gamble).
5. **Most Wanted** can grow: a second poster after Wave 50, mods that change behaviour (a Worm that hunts Forges), a leaderboard line for bounties claimed.
