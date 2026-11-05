# sky65: fog of war and the roaming Black Hole (6.5.0, on top of 6.4.0 / v640)

Nic asked for two things:
- "The outer regions of the map that are explored should retain a fog of war so if the probe isn't out there you can't
  actively see what's happening or spawning unless you're out there."
- "I want to incorporate something with time dilation and maybe a black hole somehow." He chose a roaming event: it drifts
  onto the map, pulls enemies toward it and dilates time nearby. Towers near its edge fire faster: risk and reward.

Both are gated on `FR_VER = 5` / `G.frV >= 5` (the same one-line `FR_VER` edit as probe65). Runs recorded at frV 1–4 replay
bit for bit (replay.js, cards64.js, tower64.js fixtures, and test/sky65.js replays both 6.4 fixtures again).

## What the player gets

### Fog of war
- You see what your core, your towers and your probe see. Everything else on the board is in fog.
- Three states per half tile:
  - **Unseen**: never explored. Near black. The ground is hidden.
  - **Explored**: seen before, not seen now. The ground shows, dimmed. Enemies, crates, storms, pirate drop ships and the
    Black Hole there are hidden.
  - **Visible**: normal.
- Vision radii: the core sees as far as its gun reaches (16 tiles at Battery 1, +1.4 per level; at least 10). A tower sees its
  range + 1.5 tiles (at least 4). The probe sees `G.probe.vis` while `G.probe.alive`.
- The home area plays exactly as before: the core's gun range already covers most of the starting sector, and every tower sees
  past its own range, so nothing a tower can shoot is ever in fog. Fog is only out on the far parts of the map.
- **Roads are always known** (explored from the start and when a wormhole is detected). You can always plan around a road.
- **What shows through fog, and why:**
  - **Bosses, always.** A boss at the core ends the run. Hiding the one thing that can end a run would be unfair. A boss in
    fog is drawn on top of the fog, with its light.
  - **Enemies that Sensor Sweep Marked.** Scan is a sensor. This gives Scan a new job: a 30 s cooldown look into the fog.
  - **Wormholes** (they sit on roads, so they are always at least dimmed, and their glow shows through).
  - **Wave previews, the Threat Board, the next-wave flight lines and the Rift Breach marker** are unchanged.
  - **Edge arrows for bosses and for enemies within 10 road tiles of the core** are unchanged (they are the leak warning).
  - **Treasure arrows** show only for crates you can see. Salvage out in the fog is what the probe is for.
  - Hidden enemies can't be tapped (no inspect panel from the fog).
- The minimap (shown when zoomed in) carries the fog too.
- New Help row "Fog of war" and a one-time card "Fog of war" (waits in the normal 30 s teaching queue, from Wave 2).

### The Black Hole (event)
- A new wave event, from Wave 10, weight 5 (the other events are 6–10). Zones: Ghost Lanes ×2.5, The Odd Belt ×2.
  At most one at a time.
- It spawns 3 tiles past the sector edge and drifts in at 1.2 tiles/s to a point on a road (25–85% of the way along a lane,
  ±1 tile). It stays 30 s, drifting 0.12 tiles/s, then collapses over 1.5 s with a white pinch, a ring and sparks.
  Total about 40–50 s.
- **Reach 6 tiles.** Inside it, with f = 1 − distance / 6:
  - **Time dilation:** enemies move and act (Mender heals, Aegis shields, Blink, Carrier drops, Sapper hits) at
    1 − 0.5 f. At the centre: half speed.
  - **Drag along the road:** speed × (1 + 0.6 f cos θ), θ = the angle between the road's direction and the hole. Enemies speed
    up on the way in and crawl on the way out. Combined speed never drops under 25%. They never leave the road (it only changes
    speed along their lane, so pathing, targeting order and leaks all work as before).
  - Bosses feel half of both.
- **Towers:** 2.5 to 6 tiles from its centre: **+40% Attack Speed**. Inside 2.5 tiles: **−50%**. Both scale down during the
  collapse. The tower panel lists "Black Hole edge: +40% Attack Speed" or "Black Hole horizon: −50% Attack Speed".
  On the field: an amber frame on boosted towers, a dashed red frame on slowed ones, and "+40%" / "−50%" tags on the two rings.
- Look (pixel style, no gradients, no shadowBlur): a dithered two-arm accretion spiral (one pre-rendered sprite, rotated each
  frame), a black core with a photon ring, a dark halo, 48 motes spiralling in (hotter near the centre), 3 rings closing from the
  reach to the horizon (time dilation), dashed violet reach ring and dashed red horizon ring, and lensing: the board under it is
  redrawn ×1.35 inside a circle with a faint Einstein ring at the seam (skipped when LITE or Zone effects are off).
- **Announce:** alert card "BLACK HOLE · Inbound from the north-east. Arrives in 12s. Towers at its edge +40% Attack Speed", a
  violet edge arrow (big while it drifts in, even out in the fog), a one-time intro card with every number (skips the 30 s
  queue, like the boss warning, because the event lasts 45 s). Dictionary › Events has the full rule.
- Under fog it is hidden unless any part of it within 1.75 tiles of its centre is in vision. Its arrival arrow always shows.
- **Sound:** arrival: a slow sub swell under a falling rush, a short duck (sfxrender −12.5 dB loudest 50 ms, between the
  wormhole and the Maelstrom). Collapse: a rising suck and a deep thump (−13 dB). While it is out: a low drone (two detuned saws
  at 41 Hz and a 27.5 Hz sine) on the event bus (glue compressor and limiter), level and brightness from camera proximity
  (`SFX.proxK`), panned from its screen position (`SFX.proxPan`). It rises in pitch and opens up as the camera nears it.

### Old runs and Daily Hunts
- frV 1–4 runs (old recordings, hunt codes) have no fog and no hole: the event is filtered out of the pool before the weighted
  pick, so their event rolls are draw-for-draw identical (test/sky65.js checks 395 rolls).
- A resumed snapshot runs on the current rules (as before: `resumeRun` builds a new run), so an old Frontier save resumes with
  fog. Older snapshots carry no fog grid: they start from what the core, towers and roads show now.
- **Daily Hunts: both on, the same for everyone.** Fog has no profile input: it depends only on the sim state. The hole is a
  normal event roll from the run's seed.
- **Training and lessons: no fog** (`fogOn` checks `!G.tut`), and no events at all (as before).

## Code map

- **data.js:** `FR_VER = 5`. `EVENTS` entry `hole` (`fr: 5`, `long` for the Dictionary). `HOLE` and `FOG` tunables right after
  `EVENTS`. `SECTORS` ghost `ev.hole: 2.5`, oddball `ev.hole: 2`.
- **sim.js** (block "6.5 Black Hole event" and "6.5 fog of war" just before `// ---------- waves ----------`):
  - `holeSpawn()` (from `startWave` when `G.ev.hole`), `holeUpdate(dt)` (from `simStep`, before `updateEnemies`),
    `holeEnemy(e)` (sets `e.hk`, returns the speed factor), `holeRate(t)`, `holeZone(t)` (−1/0/1 for UI), `COMPASS`.
  - `G.hole = { x, y, tx, ty, dx, dy, ph, t, k }` or null. Draws `G.r` 5 times at the spawn only.
  - `rollEvents`: `!(E.fr > G.frV)` in both pools; env knob `HOLEALL=1` forces one every wave from 10 (bots only).
  - `updateEnemies`: `hm`/`dtE` per enemy; `e.timer`, `e.dropT`, `e.sapCD` use `dtE`; `spd *= netK * hm`. Without a hole these
    are `dt` and `1` exactly.
  - `updateTowers`: `if (G.hole) rate *= holeRate(t)`. `towerConditions`: the two lines.
  - Fog: `fogOn()`, `fogSources()` (flat `[x, y, r, …]`; reads `G.probe` only), `fogMark(src)` (explored + all road tiles,
    bumps `G.fogRev`), `fogInit()` (end of `newRun`), `fogTick()` (end of `simStep`, every `FOG.every` = 15 ticks),
    `fogPack`/`fogUnpack` (run lengths). `G.fogEx` is a `Uint8Array(COLS*ROWS)` or null. No randomness, never read by rules.
  - **Hotspots (small):** `newRun` (1 line: `G.hole = null; fogInit();`), `snapshotRun` (1 line: `fog`, `hole`), `resumeRun`
    (2 lines), `startWave` (1 line), `simStep` (2 lines).
- **render.js** (block "6.5 fog of war" and "6.5 the Black Hole event" before the 6.3 zone wipe):
  - `fogUpdate()` (vision at half-tile resolution: one filled span per row per source; 3×3 box blur; only changed pixels
    rewritten, `putImageData` of the dirty rectangle; a smoothed 6× copy `fogHi` refreshed in that rectangle; `fogBlk`, 8×8
    half-tile blocks that hold any fog). Re-rasterised only when the sources' hash or `G.fogRev` changes, checked every other
    frame (every frame in flight).
  - `drawFog()` blits only fog blocks in view, merged into runs per block row, nearest-neighbour from `fogHi`. A view in full
    vision draws nothing.
  - `fogSee`, `fogSeeR`; `e._fogH` / `e._fogB` set once per frame. Hidden: enemies, their lights, gene marks, crowns, lure
    lines, pirate paths; storms, crates and drop ships out of vision; treasure arrows; minimap crates.
  - `holeSprites()`, `drawHole()`, `holeVisible()`; fx `holeEnd`; light; tower frames and the two tags (screen space, beside the
    storm frames); the violet edge arrow (`frArrows[i].hole`).
  - Test hooks: `Render.fogAt(x, y)` (0 visible, 1 explored, 2 unseen, −1 off), `Render.fogLive`.
- **audio.js:** `EVT.hole`, `EVT.holeEnd`, continuous `hole(k, pan)` (`holeV`, reset in `offlineCtx`), `SFX.proxPan`.
- **ui.js:** `SFX.hole` in the continuous-sound block of `UI.tick`; `ALERT_RE` gets `BLACK HOLE`; `TEACH_NOW.hole`; intro cards
  `hole` and `fog` in `onboardingTick`; Help row "Fog of war"; Dictionary Events uses `E.long`; `enemyAt` skips `e._fogH`.

## Tests
- `node test/sky65.js` (47 checks): event gating and identical frV 4 rolls, spawn/drift/hold/collapse timing, dilation and drag
  numbers (centre, 3 tiles in/out, floor, outside, boss, collapse), a tank walking through stays on its road and spends longer
  near it, tower rates (horizon, ring, outside, collapse) and the real fire loop (Pulse Blaster 48 → 67 shots in 20 s in the
  ring, 24 inside the horizon), tower panel line, fog sources (core range, probe alive/dead), explored grid and roads, snapshot
  round trip (fog and a hole), an old snapshot without fog, **fog never changes the sim** (the same run with the grid removed
  ends on the same hash), the frV 5 fixture with a hole replays bit for bit with the same explored fog, a fresh run replays,
  both 6.4 fixtures still replay.
- `test/sky65_mkfix.js` writes `test/fixtures/rec_650_sky65.json` (seed 6500, Ghost Lanes, start Wave 10, one hole, Wave 16).
  Regenerate only if the 6.5 rules change before release (probe65's merge may change the draws: re-record after the merge).
- `python3 test/sky65shot.py [WxH …]` (Playwright, 15 checks per size): the three fog states, hidden/shown enemies, probe stub
  vision and the explored patch it leaves, a boss through fog, the hole at full strength with tower frames, the edge warning.
  Screens in `test/out/sky65/` (s01–s06).
- `test/trackcollide.py`: a probe stub that sees the whole map (so crates have arrows) and a hole drifting in from the left:
  its violet arrow must show and stay clear of controls.
- `test/sfxrender.py` lists `hole` and `holeEnd`. `test/cards64.js`: its FR_VER check reads `S.FR_VER` (was hard-coded 4).
- `test/harness.js`: one added `vm.runInContext` line of exports.

## Performance
`test/drawbench.py` (852×393 at dpr 3, headless software canvas, 36 towers and 90 enemies; this box was shared with another
builder, so absolute ms swing ±10 between runs: compare the in-page A/B rows, which interleave fog on and off in one page).

| Run | home | zoomIn | zoomOut |
|---|---|---|---|
| v640 before (two runs) | 40.8 / 41.4 | 43.5 / 31.2 | 58.6 / 44.5 |
| sky65 after (two runs) | 36.4 / 37.6 | 30.1 / 28.2 | 47.2 / 46.0 |
| In-page A/B, fog on − fog off (two runs) | −1.7 / −5.0 ms | – | +4.2 / +2.7 ms |
| In-page A/B, Black Hole on screen − none | +0.2 ms | – | +2 to +8 ms (noisy) |

- At home the fog is usually free or cheaper: no fog blocks are in view (nothing is drawn), and hidden enemies skip drawing.
- Zoomed all the way out: about 3–4 ms for the fog in software (the view is 3072×1728 buffer px). On iPhone Safari's GPU
  canvas a nearest-neighbour blit of that size is far cheaper.
- First version blitted the half-tile fog canvas with smoothing over the whole view: +16 ms zoomed out. The 6× pre-smoothed
  copy (nearest blit) cut it to +6 ms; the fog-block runs cut it to the numbers above.
- First lensing version drew the live buffer onto itself: +66 ms zoomed out (Chrome copies the whole buffer). It now reads the
  static map layer: no measurable cost.
- Fog re-rasterising (only on a change): about 9,200 cells, one blur, one small putImageData. It runs every frame only while
  the core flies.

## Balance
Frontier, smartbot (`FR=1 bash par.sh 8 P 1 1 60`), Normal, 8 seeds, frozen copies (pitfall 26). Median waves (sorted runs).

| Batch | 0 points | 60 points |
|---|---|---|
| v640 (before) | **50** (24 30 40 48 52 56 60 64) | – (RULES baseline about 70) |
| sky65, normal event rates | **52** (30 31 41 52 52 56 63 69) | **82** (41 41 71 81 83 83 83 102) |
| sky65, `HOLEALL=1` (a Black Hole every wave from 10), first version | 41 (30 31 40 41 41 41 54 55) | 62 (40 62 62 62 62 72 82 125) |
| `HOLEALL=1`, horizon 2 tiles at −40% (tried, not kept) | 36.5 | – |
| `HOLEALL=1`, final (ring bonus kept out of boss sizing) | **57** (22 41 41 57 57 61 63 68) | **62.5** (41 41 41 62 63 64 72 92) |

- Normal rates: no change beyond noise (the event is about 1 wave in 20 overall, about 1 in 8 in Ghost Lanes).
- The stress test found a real interaction: the ring's +40% raised the defence's peak DPS (`G.power`), which sizes bosses,
  so every boss after a hole came in tougher (scripted run: power 9,425 with holes against 2,604 without). Fixed: while a hole
  is out, `G.power` counts each tower's DPS divided by its hole factor. With that, a hole every wave is neutral at 0 points.
- At 60 points a hole every wave still costs about 20 waves for a bot that never reacts (it cannot Move towers out of the
  horizon or into the ring). At the real rate that is roughly 1 wave per run, and a player who moves one or two towers turns it
  into a gain. Not a run-ender, not a free win. Knobs if Nic finds it harsh: `HOLE.inner` (−0.5), `HOLE.horizon` (2.5).
- Smartbot ignores the event (it is passive: the only choice is where towers stand). Teaching it to Move towers into the ring
  is possible later via its existing idle-tower Move logic.

## Open issues
- Probe drawing is probe65's; the screenshots use a stub `G.probe`, so the probe itself does not show in them.
- `rec_650_sky65.json` was recorded before the probe65 merge; if the merged rules change any draw, re-record it.
- The lensing magnifies the board only (not units on it): reading the live buffer cost 60 ms a frame in the software bench.
- Not yet seen on a real iPhone.
