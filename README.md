# Entropy — Project Handoff

**Version at handoff: 1.16.0 · October 26, 2026**

Entropy is Nic's personal sci-fi, retro-pixel, endless tower defense game, played on iPhone and iPad in landscape. It is one self-contained HTML file with no frameworks and no network dependencies at runtime (it only fetches its fonts and two music files).

This document has everything a new session needs to keep working on it: where things live, how to build and deploy, how the code is organized, how every system works, the conventions used, the known pitfalls, and the backlog.

---

## 1. Where everything lives

| What | Where |
|---|---|
| **Live game (Home Screen app)** | https://nix812.github.io/Entropy/ — Nic plays this from an iPhone Home Screen icon (Safari → Share → Add to Home Screen). It runs fullscreen. |
| **Claude artifact copy** | https://claude.ai/artifact/RXpFeihcddkscRg4GaHNe9 (private to Nic). Publish `dist/entropy.html` to this same URL. |
| **GitHub repo** | `nix812/Entropy` (public). **`main`** = the built site that GitHub Pages serves. **`source`** = the full source tree, build script, tests and this handoff. |
| **Source zip** | `entropy-source-v1.16.0.zip`, sent alongside this document. It has the same content as the `source` branch. |
| **Music** | `audio/bgm-menu.mp3` and `audio/bgm-battle.mp3`, committed on `main` and published as artifact files. Originally from Nic's Elemental Clash repo (`nix812/Elemental-Clash-V2`). **Never mention Elemental Clash in the UI.** The setting is just "Soundtrack: Composed / Generative". |

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
| `src/audio.js` | ~310 | Web Audio synth SFX (`SFX.play(name)`) and music. Music uses plain `HTMLAudio` elements, because `createMediaElementSource` broke playback on iOS. |
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
| Pandemonium | 34 | **1**, 10, 20, 32, 46, 62, 80, 100 | HP ×1.35, score ×1.8 |

- **Expanding sector (v1.15):** a run starts on `REGION0` = 60% of the full map (rows and columns), placed so the core keeps the same relative position. Each time a wormhole is *detected*, `growRegion()` widens the sector one step (`stageFrac(stage, N)`, linear), so the last scheduled wormhole brings the full map.
  - `G.region = {x0, y0, x1, y1}` (tiles, x1/y1 exclusive) is derived, never stored: `regionAt(G.lanesOpened)`. Snapshots carry `grow: 1`; snapshots without it (v1.14 and older) resume with `G.fullMap = true`.
  - `genMap` builds the main path inside the starting sector. `genExtraLane` searches and pathfinds only inside the current (already grown) sector, placing wormholes at 75–100% of the in-bounds distance.
  - `extendMain(R)` lengthens the main path from its old start to the new left edge, with a 3–7 row jog. It replaces `map.lanes[0]` with a new lane object; enemies already walking keep the old object, so nobody jumps. The main path grows from about 55 to about 100 tiles on Normal.
  - `canBuildAt`, taps, ability aim and storms (spawn, drift bounds, Maelstrom centre) all respect `G.region`.
  - **Camera:** `Render` frames `reg` (buffer px), not the whole buffer. `updateRegion()` snaps on a new run and otherwise eases over 2.6 s (wall clock, so it runs while paused), resets zoom to 1, and draws the old border as a fading dashed outline. The minimap shows the sector. `Render.onCam` lets the UI refresh the Fit button.
  - **Setup screen:** the preview dims the full map and outlines the starting sector; the note reads "Sector 28×16 → 47×26".
- **Columns** are fitted to the playfield aspect: `fitCols()` = `ROWS × w / h`, clamped to 38–76. A phone on Normal gets about 44×26.
- **Core position:** the core sits 6–8 tiles in from the right edge, so wormholes can open on every side, including behind it.
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

### 4.3 Towers (12)
| Tower | Cost | Unlocks at wave | Notes |
|---|---|---|---|
| Pulse Blaster | 60 | 1 | |
| Rail Lance | 110 | 1 | |
| Cryo Emitter | 75 | 1 | |
| **Snare Beacon** | 90 | 4 | Kind `snare`. Fliers whose straight line passes within the lure range (3.5) detour through the beacon, get held 0.8 s, and are slowed 50% inside the net (radius 1.3). Catches 8 fliers per wave. Bosses are affected less. Building one mid-wave re-routes fliers already in the air. |
| Swarm Missile | 120 | 5 | |
| Relay Pylon | 100 | 8 | Support. |
| Arc Coil | 100 | 10 | |
| Credit Forge | 150 | 12 | Economy. |
| Flame Projector | 90 | 15 | |
| Void Lens | 140 | 20 | |
| EMP Mortar | 130 | 25 | |
| Gravity Well | 150 | 30 | |

- **Levels and specializations:** towers go to level 3, then pick one of 2 specializations, then can Ascend (levels 4–5) for ×1.3 damage and a new affix.
- **Affixes and veterans:** affixes roll on build and upgrade, and can be rerolled. Kills earn veteran ranks, and each rank offers a choice of mutations.
- **Resonance:** adjacent towers of different elements give +8% damage per element.
- **Elements:** Kinetic K, Thermal T, Cryo C, Arc A, Void V, plus N (neutral).
- **Statuses:** Burn, Chill (Freeze at 5 stacks), Shock, Mark.
- **Combos:** Shatter, Thermal Shock, Overload, Superconduct, Collapse.

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
- **Settings:** volumes, soundtrack (Composed or Generative), HUD lean or full, damage numbers, screen shake, interface size, fullscreen, and save export/import. The save code is `ENT1:` + base64 of the JSON profile, used to move progress between the iPhone and the iPad.

---

## 5. Profile (`PROF`) fields worth knowing
`v, webV, xp, alloc[], builds[5], bestWave, bestScore, runs, kills, playTime, settings{sfx, music, soundtrack, hud, dmgNums, shake, webView, uiScale}, seenHelp, zoomHint, runSnap, lastSetup, codex, mastery{}, loadout[], orbit{}, nova, remnants[], laws[], stars{}, hall[], novaOffer, daily, updatedAt`

- `Save.merge()` fills defaults for any missing fields, so adding a field means adding it to `defaultProfile()` in `sim.js`.
- Any change to the web layout that alters node IDs needs a `WEB_VER` bump, or saved builds break.

---

## 6. Testing tools (`test/`)
| Tool | Use |
|---|---|
| `harness.js` | Loads `data.js` and `sim.js` into a Node VM and exports the sim API. `ROWS` and `COLS` are getters. Add new exports here when you need them in tests. |
| `smartbot.js` | A heuristic player. Usage: `node test/smartbot.js runs points chaos startWave bestWave [keystone]`. `NOVA="s1,s3:lean,gravity"` simulates remnants and laws. The tower plan includes `snare`. |
| `par.sh` | `COLS=48 bash test/par.sh N points chaos startWave bestWave`: N seeds in parallel, printing a summary row each. Column 3 is the wave reached; column 6 is what killed the run. |
| `mkpage.py` | Wraps `dist/entropy.html` with local fonts into `test/out/page.html` for Playwright. **Ad-hoc Playwright scripts must call `mkpage.mk()` after a rebuild**, or they test a stale page. |
| `audit.py TAG [W H SAFE]` | A full UI walkthrough with screenshots (`test/audit/TAG*.png`). Prints `ERRORS: []` when there are no page errors. The tap helper multiplies by `UIS`. |
| `bossfight.py [seed wave chaos]` | Plays a real boss wave through the live UI loop and reports whether the boon pick appeared. |
| `updshot.py` | Serves the Pages build at its real URL and checks the auto-update reloads once, from the menu only. |
| `relocshot.py [W H tag]` | Core affixes, reroll, relocation mode, preview, free then paid move, resume. |
| `cpwait.py` | Checks the checkpoint holds while enemies remain and starts once the field clears. |
| `boonshot.py` | Kills a boss and checks the boon pick appears and the game resumes; checks the Gloop family gives one pick. |
| `expandshot.py [W H chaos]` | Triggers a wormhole detection and screenshots the zoom-out (`x03_expand_*.png`), then jumps to the full map (`x04_full.png`). |
| `bossshot.py`, `constshot.py`, `navshot.py`, `novashot.py`, `snareshot.py`, `tipshot.py`, `webshot.py` | Focused screenshot scripts for each feature. |

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
