# Entropy — Project Handoff

**Version at handoff: 2.1.0 · October 27, 2026**

Entropy is Nic's personal sci-fi, retro-pixel, endless tower defense game, played on iPhone and iPad in landscape. It is one self-contained HTML file with no frameworks and no network dependencies at runtime (it only fetches its fonts and two music files).

This document has everything a new session needs to keep working on it: where things live, how to build and deploy, how the code is organized, how every system works, the conventions used, the known pitfalls, and the backlog.

---

## 1. Where everything lives

| What | Where |
|---|---|
| **Live game (Home Screen app)** | https://nix812.github.io/Entropy/ — Nic plays this from an iPhone Home Screen icon (Safari → Share → Add to Home Screen). It runs fullscreen. |
| **Claude artifact copy** | https://claude.ai/artifact/RXpFeihcddkscRg4GaHNe9 (private to Nic). Publish `dist/entropy.html` to this same URL. |
| **GitHub repo** | `nix812/Entropy` (public). **`main`** = the built site that GitHub Pages serves. **`source`** = the full source tree, build script, tests and this handoff. |
| **Source zip** | `entropy-source-v2.1.0.zip`, sent alongside this document. It has the same content as the `source` branch. |
| **Music** | `audio/bgm-menu.mp3` and `audio/bgm-battle.mp3`, committed on `main` and published as artifact files. Originally from Nic's Elemental Clash repo (`nix812/Elemental-Clash-V2`). The composer isn't recorded anywhere in either repo (the files were re-encoded, tags stripped); ask Nic if more tracks are wanted. **Never mention Elemental Clash in the UI.** The setting is just "Soundtrack: Composed / Generative". |

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
| `src/audio.js` | ~360 | Web Audio synth SFX (`SFX.play(name)`) and music. Music uses plain `HTMLAudio` elements, because `createMediaElementSource` broke playback on iOS. **Playlists (v2.0):** on start it probes `audio/bgm-battle-2.mp3` … `-6` and `audio/bgm-menu-2.mp3` … `-6`; each file that loads joins its playlist (a lone track loops, a playlist advances on `ended`). To add music, commit the files to `main`'s `audio/` folder with those names (and attach them to the artifact with `files`); no code change. **Mixed** mode plays a 150 s generative interlude (`MIX_INTERLUDE`) after each composed battle track. `SFX.bgm` exposes the lists for tests. |
| `src/render.js` | ~950 | Canvas renderer (`Render`): pixel sprites built in code (towers via `TOPS`, enemies via `EN`, bosses via `BOSS`), map layer, lighting buffer, FX (particles, rings, lines, floating text, speech bubbles), camera zoom and pan, minimap, build-card art (`towerCard`), tower icons. |
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
| **Snare Beacon** | 75 | 4 | Kind `snare`. Netted fliers take +20% damage (v2.0, in `hit()`). Fliers whose straight line passes within the lure range (3.5) detour through the beacon, get held 0.8 s, and are slowed 50% inside the net (radius 1.3). Catches 8 fliers per wave. Bosses are affected less. Building one mid-wave re-routes fliers already in the air. |
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
- **Core boss rotation:** Behemoth, Hive Queen, Phase Wraith, Overmind, Titan.
- **Oddball bosses** have a 40% chance from wave 20 (100% with the Cat Nebula law). The wave preview shows them as "Boss ???".

| Oddball | What it does |
|---|---|
| Mr. Whiskers | A giant cat. Swats the nearest tower offline, and naps for 3 s every 12 s (60% damage reduction while asleep). |
| Gloop | A slime that splits on death: Gloop → 2 Gloop Jr. → 4 Glooplets. |
| Space Whale | Flies. Its song heals nearby enemies. |
| Quackzilla | A rubber duck. Quacks, hops forward and briefly disables nearby towers. |
| Flying Spaghetti Monster | Its noodly appendages disable up to 3 towers, and it drops meatball fliers. |

- **Boss health (v2.1):** `30 × B.hp × hpMult(w) × bossHpX(w) × …` in `spawnBoss`. `BOSS_HPX` is a piecewise curve: ×3 at wave 10, ×7 across waves 20–30, ×5 at 40, ×3 at 50, ×2.5 from 60. Nic reported bosses dying almost instantly; bots with 60 web points showed 5–6 s from the first hit to death at waves 20–30. After the change: 11–20 s, with run length unchanged (average wave 75 vs 76 at 60 points); with 0 points, bosses sometimes leak at waves 30–50. Gloop's children inherit through `hpAbs`, so they scale automatically.
- **Collapse vs bosses:** the combo's max-HP part is 3% for normal enemies but 0.4% for bosses. At 3% it fired about once a second under Void Lens and killed bosses regardless of their health.
- **Measuring bosses:** `BOSSLOG=1 node test/smartbot.js 1 60 1 1 60` prints each boss's life, time under fire, how far down the road it died, and the top damage sources (from `G.dbgBoss`, collected in `hit()` only when set). `test/bossttk.js` is a controlled version (a set budget of L3 towers against a lone boss).
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
| `newsshot.py [W H tag]` | What's New popup for a returning player, no repeat after closing, Settings, a build-menu role line and the run-recap highlights. |
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
5. **Toasts:** `toast()` de-duplicates identical messages within 4 s. While a modal or the web is open, toasts are queued unless `force` is passed. Long toasts (over 44 characters) stay up for 4.5 s.
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
