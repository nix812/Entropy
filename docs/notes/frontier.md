# Frontier: the prototype (builder "frontier", on top of 6.0.0)

Design: `docs/Frontier-Design.md` (Project doc "Frontier-Design"). Nic, after 6.0: "It doesn't feel epic enough or decision-making enough. It's spam towers in differing ways." This build is the design's Phase 1 plus moving towers and the basic camera help, as a separate mode. Classic, Daily Hunts, Training, old recordings and old snapshots are untouched (every rule is gated on `G.fr`).

## What the player sees

- **New Run → Frontier tab** (between Standard and Daily Hunt, core green). A one-line pitch on top of the usual setup: "Frontier · prototype. A bigger, slower map. Your core lifts off and lands anywhere: on a tower it docks and fires that tower's weapon, and it links the towers around it." Starting wave, Chaos and Zone work as in Standard. The map preview and the "Sector 38×22 → 64×36" note show the bigger board. The last mode is remembered (`PROF.lastSetup.fr`). The hangar's Resume line says "Frontier · Wave N".
- **First-time card** (`introCard('frontier')`, once per profile): Lift Off, docking, links, Move, and "the swarm is slower here, but tougher".
- **A bigger, slower board.** Normal is 64×36 (Calm 53×30, Unstable and Pandemonium 71×40). The sector still starts at 60% (38×22 on Normal) and grows with each wormhole. Enemies walk at 60% speed; each wave has 60% as many units, each 1.75× as tough, spawned over the same time, with a heavier roster (Juggernauts ×2.5, Splitters ×1.6, Carriers ×2, Reflectors ×1.5, Aegis and Menders ×1.3; Swarmers ×0.4, Drones ×0.6). A wave pays what a Classic wave pays (kill credits and score ÷0.6). Bosses walk at 60% speed with 1.3× health.
- **Lift Off** (a green button under Map, and in the core panel). Tap it: the game pauses and every landing spot lights up (open ground faintly, attack towers framed in their element colour). Tap one for the preview: road length per lane before → after (and the total, red if enemies arrive sooner), what the cannon becomes ("Docks Rail Lance LV 3: Damage 130 → 299 · Range 5.1 → 6.1", or "Plain cannon"), which towers it links, Power Node bonus, flight time and the cooldown. On the map: the new roads (dashed amber), the ghost core, the docked weapon's reach, the 4-tile link circle and dashed lines to the towers it would link. **Land and dock** / **Land here** commits; Cancel or ✕ backs out.
  - The roads swing to the landing spot the moment you commit, and enemies already walking turn toward it (fliers fly straight at it).
  - **In the air** the core's gun is offline and its shield is down (it starts recharging 4 s after landing). Flight takes about 1 s per 3 tiles (at least 1 s); the core rises off the ground with thrusters and its shadow below; the camera follows it if it was at home. At a checkpoint with the field clear it lands at once.
  - **Cooldown:** 3 waves after landing (Uplink 4 and 8 take a wave off each, never below 1). The button reads "Lift · W5" while it recharges, "Flying" in the air.
  - **Landing spots:** inside the sector (1-tile margin), open ground or an attack tower (not Pylon, Forge or Snare: they stay towers for now), at least 10 tiles from every wormhole, and no lane's new road shorter than 10 tiles ("Too close" otherwise).
- **Docking.** Land on an attack tower and the core's cannon *is* that tower: it fires its own attack (kind, element, affixes, specialization, Ascend perks, veteran mutations, Technique, Overcharge all kept) at ×2 damage and +1 range, with +20% damage per Battery level above 1. The tower's turret sits on the core drum, ringed in its element colour; the plain core gun is silent. Lift off again and the tower is simply a tower again, on its tile, intact. Its damage counts as that tower's, so the swarm's read (Strain Assaults, wards) sees the docked element. The core panel shows "Docked: Rail Lance LV 3 · ×2 Damage, +1 Range" and a **Docked tower** button that opens its panel (upgrade, Fire, Aim). A docked tower can't be moved; selling it leaves the core on the plain cannon.
- **Links.** While landed, the core links to the 3 nearest attack towers within 4 tiles (+1 per 3 Uplink levels): glowing green lines with a pulse running out to each. Linked towers get +10% damage and +10% rate; the core (docked weapon or plain cannon) gets +5% damage per link. Links follow the towers around the landed core (build one in reach and it links; move one away and it drops). Flying breaks every link.
- **Move a tower** (tower panel, Frontier only: "Move · fee"). Tap it, then a highlighted open tile (its range ring shows there), then **Move here**. It holds the new tile at once, glides over lifted off the ground, and is offline for 4 s. Fee: 10% of what it cost (`t.invested`). Moving off a Power Node needs a free power point.
- **Camera help.** Edge arrows point at off-screen bosses (red, bigger) and enemies within 10 tiles of the core (amber), and at the core itself (green) when it is off screen; tap an arrow to look there (the core arrow goes Home). The Fit button says **Home** in Frontier and recentres on the core (the existing home view keeps tiles at least 22 px). Pinch, double-tap and Map work as in Classic.
- **The core's element buttons are gone** in Frontier: docking is how the core changes damage (`setCoreEl` refuses in Frontier). Shield, Hull, Uplink, Battery, Reactor, Reroll stay.

## Nic's decisions taken (open questions, leanings used)
1. Towers lift off too (Move); links are a bonus, not a power switch. **Built that way.**
2. Run length: unknown. **Fewer, heavier waves** at the same cadence (13 s between waves, same spawn time); bots measured runs about 20–25% longer per wave than Classic (slower enemies stretch boss and crowd holds). Target still open.
3. Flying base vs bigger, slower battles: both built.
4. Support towers dockable only if cheap: **not docked for now** (Pylon, Forge, Snare are not landing spots). With the derived-dock design a support dock would be a few lines in `towerStats`/`frCands`, but each needs its own rule (a Pylon core boosting links, a Forge core paying), so it's Phase 2.
5. Core keeps Shield/Hull/Uplink; Battery scales the docked weapon (+20% per level above 1). **Built.**

## Other decisions and why
- **Docking is derived, never stored.** While landed, the attack tower on the core's tile is the docked weapon (`frDockT()`). The tower stays in `G.towers`/`towerAt` and keeps firing through `updateTowers`; `towerStats` scales it; `updateCore` skips the plain gun. So every tower system (affixes, perks, Techniques, veterans, Mastery, damage tracking, the swarm's read) works on the dock with no special cases, snapshots need no dock field, and lifting off "sets it back down" by doing nothing.
- **The roads re-route at commit, not at landing** (the design says so, and it makes the flight a real cost: enemies head for a core that isn't there yet, and a leak during flight hits the hull with the shield down). `applyRelocation` moves `G.map.core` at commit; `G.core.x/y` flies.
- **Walking enemies re-route** with one reverse Dijkstra from the landing spot (new road costs 0.1, ground 1, towers and rocks block): each enemy gets its own lane from where it stands, joins the nearest new road and follows it. Fliers fly straight at the landing spot. Pirate skiffs keep their course.
- **Reused relocation plumbing:** `planRelocation(x, y, fr)` and `applyRelocation(plan, fr)` take a Frontier flag (no cost, no checkpoint rule, Frontier candidates); Classic calls are unchanged. `canRelocate()` is false in Frontier (the Classic Relocate button never shows).
- **Landing spots exclude roads** (design), stay 10 tiles from wormholes and refuse any road under 10 tiles: the first playtest had a dock next to the gate that cut the main road from 49 tiles to 7.
- **Picking pauses the game** (like the Ready walkthrough); the pause is UI only, not recorded. The flight itself runs in real time.
- **Board size is fixed per chaos** (16:9 of the rows), not fitted to the screen: the home view already zooms to 22 px tiles around the core, and a fixed board keeps Frontier the same on phone and iPad.
- **HP per unit 1.75, bosses 1.3** (first guess 2.0 and 1.5 made bot runs end ~10 waves earlier than Classic without flying; see Balance).

## Code map
- **data.js:** `FRONTIER` (every tunable, next to `RELOCATE_COST`), `frRows(chaos)`, `frCols(rows)`.
- **sim.js**
  - `newRun` (**hotspot**, small): `opts.frontier` → `G.fr` (never for Daily or Training), rows/cols from `frRows`/`frCols` when not given, `G.frReady/frFly/frN/frLinks`. `recOpts` carries `frontier: 1` and the board, so replays rebuild it.
  - `genWave`: count ×0.6, `hpE` (unit HP ×1.75), weights ×`FRONTIER.w`, spacing ÷0.6. `spawnEnemy`: speed ×0.6, wave units' credits and score ÷0.6. `spawnBoss`: speed ×0.6, HP ×1.3. `updateWaves`: `FRONTIER.gap`.
  - `towerStats` (end): docked scaling. `recomputeAuras` (end): `frLinkUpdate()`. `coreStats`: +5% per link. `updateCore`: no gun while flying or docked, no shield regen in flight. `coreUpgrade('uplink')`: re-links. `setCoreEl`: refused. `simStep`: `frUpdate(dt)`.
  - Block "Frontier: lift-off, docking, links and tower moves" after `applyRelocation`: `frDockT`, `frCd`, `frLinkN`, `frCanFly`, `frDockX`, `frCands`, `frLinksAt`, `frLinkUpdate`, `frRestat`, `frPlan` (the preview: `routes/before/after` + `dock`, `links`, `dist`, `secs`), `frLiftOff`, `frLand` (→ `Hooks.frLanded`), `frReroute`, `frMoveFee`, `frMoveOk`, `frMoveTower`, `frUpdate` (flight, move timers).
  - `ACTS.frFly(x, y)`, `ACTS.frMove(fromX, fromY, x, y)`. Both return false outside Frontier (old recordings never send them).
  - `snapshotRun`/`resumeRun` (**hotspot**, small): `fr, frReady, frN, frFly`; `resumeRun` passes `frontier: 1` to `newRun` and continues a flight in progress. Snapshots without `fr` resume as Classic.
  - Run log: `frFly {x, y, dock, secs}`, `frMove {type, x, y, fee}`.
  - Tower fields: `t.mvT` (seconds left moving), `t.mvFrom` (render only); moving uses `t.disabled` with `disCause 'MOVING'`.
- **render.js:** `drawTower` wraps `drawTower0(t, onCore)` (moving towers glide; `onCore` draws only the turret); `drawCore` → `drawCore0(dock)` (flight lift and thrusters, docked turret and element ring); the docked tower is skipped in the tower loop; link lines after the towers; the picker overlay (`frSel`) and edge arrows (`frArrows`) in the overlay pass. API: `Render.frSel`, `Render.frArrows`, `Render.arrowAt(sx, sy)`, `Render.lookAt(x, y)`.
- **ui.js:** New Run tab (`modeChips`, `rerollMap`, `renderSetup` pitch, `launch` (**hotspot**, small), `openSetup`, `PROF.lastSetup.fr`, hangar label). Block "Frontier: the core panel's flight block…" before `relocPrice`: `frSel` (UI state, not in `G`), `frCoreHTML`, `frPause`, `startLift`, `startMove`, `frEnd`, `frLandPanelHTML`, `frMovePanelHTML`. Panel kinds `frland`, `frmove`; `closePanel` ends the picker. `tapTile` picker branch; `canvasUp` edge-arrow taps; `updateZoomBtn` Home label; `updateHud` Lift Off button; `Hooks.frLanded` toast (DOCKED / LANDED); tower panel Move button; core panel (element grid → `frCoreHTML` in Frontier; Classic relocation note hidden).
- **template.html:** `#bLift` (`.liftbtn`, under Map; `body.fr .rdybtn` moves Ready down one slot), `.frpitch`, `.frdock`, `.frlift`.
- **test/smartbot.js:** `FR=1` plays Frontier: between waves it docks on its strongest attack tower (judged without its dock bonus) when that keeps at least 85% of the road, and moves towers idle for 2 waves to its best spot (2 a wave). `NOFLY=1`, `NOMOVE=1`. Prints a `FRONTIER` line per run: wave, minutes, flights, moves, time in the air, share of time per dock.
- **test/harness.js:** exports the Frontier functions.

## Numbers (all in `FRONTIER`, data.js)
| Thing | Value |
|---|---|
| Board | Classic rows × 1.38 (max 40), width 16:9: Calm 53×30, Normal 64×36, Unstable/Pandemonium 71×40 |
| Enemies | speed ×0.6; count ×0.6 (min 3); unit HP ×1.75; spawn spacing ÷0.6; credits and score per unit ÷0.6 |
| Roster weights | tank 2.5, splitter 1.6, carrier 2, reflector 1.5, shielder 1.3, medic 1.3, swarmer 0.4, drone 0.6 |
| Bosses | speed ×0.6, HP ×1.3 |
| Between waves | 13 s (as Classic) |
| Flight | 3 tiles/s, at least 1 s; instant at a cleared checkpoint |
| Cooldown | 3 waves after landing, −1 per 4 Uplink levels, min 1 |
| Dock | ×2 damage, +1 range, +20% damage per Battery level above 1 |
| Links | 3 within 4 tiles, +1 per 3 Uplink levels; +10% damage and rate each; core +5% damage per link |
| Move | 4 s offline, 10% of invested |
| Landing | 10 tiles from wormholes; every road at least 10 tiles |

## Balance (bots, Normal, 0 points, best wave 40, 8 seeds; medians; bots are noisy, ±5 waves)
BALANCE_PLACEHOLDER

## Tests
- `node test/frontier.js [maxWave]` (new, 69 checks): Classic untouched (no flag, acts refused, Daily never Frontier); board per chaos; enemy speed; fewer/tougher units over the same spawn time; heavier roster; lift-off (preview docks, links, flight time), shield down and gun offline in the air, no second lift-off, every lane and every walking enemy re-routed to the landing spot, landing, docking (×2, +1 range), links (+10%/+5%), cooldown, Battery scaling, Move (docked can't, fee, tile held, offline, link breaks, back after 4 s), lift-off again sets the tower back intact, plain cannon, no element switch; two scripted runs with lift-offs, docks and moves through `act()` replay bit for bit, rebuild halfway mid-flight, and resume from a snapshot taken mid-flight (lands on the spot the roads lead to, docking comes back); a snapshot without the flag resumes as Classic.
- `python3 test/frontiershot.py [WxH ...]` (new; default 667×375, 852×393, 1180×820): New Run tab, intro card, Lift Off button, picker (paused), preview text, flight, docked core with links, core panel, Move (pick, confirm, offline), edge arrow for an off-screen boss and tapping it, Home, the zoomed-out board. Screens in `test/out/frontier/`.
- `test/trackcollide.py`: Frontier runs at 852, 667 and 1180 check the Lift Off button against every control and banner, and Ready against Lift Off.
- All existing suites pass unchanged (see the final report).

## Known gaps
- The bot is a weak Frontier player (it docks by DPS and moves idle towers, nothing smarter), so the balance numbers say little about a human who plans docks.
- No lift-off/landing/docking sounds or animation beyond the lift and thrusters (Phase 3). Lift-off reuses the lane sound, landing the upgrade sound.
- `frReroute` gives each walking enemy its own lane, so the progress-based targeting ("First", Glacier jams) treats rerouted enemies as just spawned until the next wave.
- The landing picker highlights every open tile; on the full 64×36 board the dock targets (framed towers) are what matters, and a phone has to pan to reach far spots.
- Support towers can't be docked; Salvage fields, high ground and siege enemies aren't built.
- Run length per wave is about 20–25% above Classic in bot runs.
- The core panel's Details tab still shows the plain cannon's stats while docked (Actions tab shows the dock).

## Phase 2 next
1. Playtest with Nic: does it feel epic, and is the dock-or-stay decision real? Answer open questions 2 and 4.
2. Support docks (Pylon core boosts every link, Forge core pays per wave, Snare core holds fliers at the gate).
3. Places worth flying to: salvage fields (credits per wave while landed near), high ground (+range); siege enemies (one or two huge slow units per wave).
4. Make the swarm read the dock explicitly in the assault reasons ("They're warded against your docked Thermal").
5. Teach the bot to choose docks by what the swarm is warded against and by road coverage, then sweep: no single dock type should hold the core more than about half the time.
6. Effects and sound: lift-off burst, landing thump, the tower rising onto the core; a Field Manual lesson.
