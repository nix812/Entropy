# 6.5 probe65: the probe, loot sites, neutral guards

Nic: "let some exploration happen with a probe or something that I can control to explore the entire map. Let's put some
random ship wreckage to salvage, gas clouds or asteroids to mine… an upgrade path for the probe so it can kill some neutral
mobs… protecting these loot items. Balance risk and reward… If your probe dies. It's costly to rebuild… neutral mobs all scale
with waves… their loot also scales." His calls: tap to send; default loot is credits, ability charges and a chance at
Anomaly cards or boons.

Sim rules gated on `G.frV >= 5` (`FR_VER = 5`, the same one-line edit as sky65). Tunables: `PROBE` in data.js.

## What the player gets

- **The probe.** Every new run (Endless and Daily Hunt) starts with one, docked beside the core. Free: it is the feature's
  front door, so no one misses it, and the cost lives in the risk (rebuild price, lost cargo, time away). Docked, it repairs
  the core +0.05% of max hull per second and heals itself 8% per second. Training and lessons have none.
- **Tap to send.** The **Probe** button sits under Lift Off (Ready moves one slot down). Tap it, the probe or a loot site:
  the probe panel opens and the probe is selected (a pulsing ring, the Lance's reach). While the panel is open, a tap on the
  map sends the probe there in a straight line, over anything; a tap on a site sends it to work that site; a tap on the core
  recalls it. Its course shows as a dashed line with a cross at the end (brighter while selected). The game never pauses
  for it. Recall and Done in the panel footer. A tap on a site when nothing is selected opens the site's card (kind, guards,
  loot estimate, jackpot chance, time left, how it works) with **Send probe**.
- **Loot sites** spawn from Wave 2, mostly in the outer map: 75% outside the sector while there is unrevealed ground (they
  glow over the veil), never within 12 tiles of the core or 2 of a road, 6 tiles apart. One every 22–36 s while under the cap
  (2, +1 per 15 waves, max 4). They fade (wreckage 120 s, clouds 110 s, asteroids 140 s); a site the probe is working never
  fades under it. Magenta edge arrows (at most 3, merged with a count, with a small kind icon) point at off-screen sites,
  and a pale blue arrow at the probe when it is away. Arrows that land on a crowded spot now slide 20–40 px along the edge
  instead of vanishing (all arrow kinds).
  - **Wreckage**: a quick grab, 2.5 s on top of it. Credits; 35% an ability charge.
  - **Gas cloud**: harvest while inside for 12 s; credits and 15 Entropy trickle in as it drains (leave early, keep what you
    got). Static costs 1.5% hull per second. Guarded 40% less often.
  - **Asteroid**: drifts 0.12 tiles/s; mined in 3 chunks of credits (each chunk pops). 20% are crystal: +1 charge, +1 token.
  - **Rich** (gold trim, from Wave 8, 12%): ×2.5 loot, +1 guard, +10% jackpot.
- **Cargo.** Loot rides in the hold (shown over the probe, ★ for a jackpot) and banks only when the probe docks: credits,
  Entropy, charges, tokens. **Jackpot** per finished site: 2% + 2% per guard (+10% rich); it banks as a boon pick (3 boons)
  or a full Entropy gauge (an Anomaly draw); if both are busy, a crate's worth of credits.
- **Neutral guards** (from Wave 3): red drones orbit their site and shoot (6 × wave scale per shot, every 1.2 s, 3.5 tiles);
  brutes (from Wave 15, 30% of guards) chase the probe within 5.5 tiles of the site and bite (15 × wave scale per second).
  They wake when the probe comes within 4 tiles of the site, heal after 5 s out of a fight, never touch a road, never leak,
  and towers ignore them. Chance a site is guarded: 30% + wave/80 (max 75%); count 1 + random up to (1 + wave/20), max 4.
  A looted site keeps its living guards until they settle (so a dash-and-grab is still a fight on the way out). Each kill
  pays a bounty into the hold (0.1 crate, brute 0.2).
- **Upgrades** (3 levels each, price 150 / 400 / 900 × (1 + wave/30)):
  Lance (weapon: none → 1× / 1.9× / 3.2× of 14 × wave scale damage per second, 2.8 / 3.2 / 3.6 tiles, one shot per 0.5 s),
  Armour (hull ×1 / 1.6 / 2.4 / 3.5 of 80 × wave scale), Engine (2 / 2.6 / 3.2 / 4 tiles/s), Rig (harvest and mining ×1 /
  1.5 / 2 / 3), Scanner (vision 5 / 7 / 9 / 12 tiles, loot +10% per level).
- **Scaling.** Wave scale = 1 + wave/15. Probe hull and Lance grow ×wave scale; guard HP grows ×wave scale^1.2 (so guards
  pull ahead: ×1.3 relative by Wave 45), guard count grows, loot = one crate's worth (`crateCr`) × the kind (wreck and rock
  0.4, cloud 0.3), ramped in early (×0.35 + wave/30, full from Wave 20).
- **Death and rebuild.** At 0 hull the probe is lost: its whole cargo lies in a **probe wreck** for 90 s (a quick grab, so
  a new probe can win it back), toast PROBE LOST (alert channel) with the price. Rebuild: (120 + 12 × wave) × (1 + 15% per
  upgrade level) credits, then 40 s in the yard. **Upgrades are kept**: losing them on top of cargo and a big bill made the
  probe something you never risk; a price that grows with what you built keeps the sting in one clear number.
- **Old runs**: recordings and Daily codes from frV 1–4 have no probe and no sites. A 6.4 *snapshot* resumes on current
  rules (as every resume does) and gets a fresh docked probe.
- **Daily Hunts**: the probe is on and identical for everyone: it starts the same, nothing in it reads the profile, and every
  roll is from `G.r` inside the sim. Same map, same sites, same guards. Leaving it out would have made the Daily a different
  game from Endless.
- **Teaching**: one card through the teaching queue when the first site appears (`introCard('probe')`); a Dictionary section
  "Probe" (10 entries).

## Code map

- **data.js**: `FR_VER = 5`; `PROBE` (after `WHATS_NEW`, before the pirate lines).
- **sim.js**, block "6.5 the probe, loot sites and neutral guards" (after `frUpdate`, before abilities): `prW`, `prWS`,
  `prLvN`, `prStats`, `prUpCost`, `prRebuildCost`, `prVal`, `prHomePt`, `prCargoN`, `siteById`, `siteReach`, `prNew`,
  `siteSpawn`, `sitesUpdate`, `prLoot`, `siteDone`, `prBank`, `prJackpot`, `prLose`, `guardsUpdate`, `prFire`, `prWork`,
  `probeUpdate`, `probeGo`, `probeRecall`, `probeUpgrade`, `probeRebuild`.
  - `ACTS`: `prGo(x, y)` (tiles, the UI rounds to 0.1), `prHome()`, `prUp(k)`, `prBuild()`.
  - **Hotspots (one line each):** `newRun` (`G.probe`, `G.sites`, `G.siteT`, `prNew()` when `G.frV >= 5 && !T`),
    `simStep` (`if (G.probe) probeUpdate(dt)` after `frUpdate`), `snapshotRun` (`probe`, `sites`, `siteT`), `resumeRun`
    (restores them; older saves keep the fresh probe from newRun), `runHash` (mixes probe position, hull and site ids
    only when `G.probe` exists, so old hashes are unchanged).
    `gameOver` (one `prEnd` run-log line: upgrade levels, alive, `G.stats.pr`).
  - Run fields: `G.probe` = `{ x, y, alive, vis }` (the sky65 contract) plus `hp, max, lv{hull,eng,gun,rig,scan}, tx, ty,
    task, home, ret, rb, cd, cargo{cr,ent,ch,tok,jp}, hitT, ang`. `G.sites[]` = `{ id, k: wreck|cloud|rock|lost, x, y, t,
    life, val, rich, prog, g[], z, jp, done?, hp/max/chunks/crystal/vx/vy (rock), ent (cloud) }`; guards `{ id, k:
    drone|brute, hp, max, a, x, y, hx, hy, cd, calm, hitT }`. `G.siteT`, `G.siteN`, `G.stats.pr = { sites, lost, kills, jp,
    cr, trips }`. Run log: `site`, `siteDone`, `prBank`, `prLost`, `prUp`, `prBuild`, `prEnd`.
- **render.js**: block "6.5 the probe, loot sites and neutral guards" before the zone wipe block: `PR_COL`, `prSelOn`,
  `prIn` (view cull), `drawSites`, `drawGuard`, `drawProbe`. Calls: `drawSites(v)` after salvage crates, `drawProbe(v)`
  after pirate ships; lights after Node Links; a screen-space overlay after the aim ring (course line, selection ring and
  Lance reach, hull bar and cargo over the probe, guard hull bars); edge arrows (site and probe arrows, the crowded-spot
  slide); fx `site`, `siteDone`, `siteChunk`, `prBoom`; `Render.prSel` setter/getter.
- **ui.js**: block "6.5 the probe" after `frEnd`: `PR_KIND`, `PR_HOW`, `prStatus`, `prCargoTxt`, `prSiteTxt`, `prUpTxt`,
  `probePanelHTML`, `openProbe`, `probeTap`, `probeAction`, `probeLive`, `prBtnUI`. One line each in `renderPanel`,
  `closePanel` (`Render.prSel = false`), `panelAction`, `liveRefreshPanel`, `tapTile` (before the crate check), `updateHud`
  (`prBtnUI()`), `frModeUI`, `wire` (`#bProbe` onclick), `KEEP_OUT`, `onboardingTick` (intro card), `dictData` (Probe
  section).
- **template.html**: `#bProbe` button after `#bLift`; CSS `.probebtn` (+ `.away`, `.hit`, `.dead`), `body.prb.fr .rdybtn
  { top: 92px }`, `.sts.prsite`. Class names checked free.

## Tests

- `node test/probe65.js` (53 checks): who gets a probe (frV 4 / Classic / Training: none), Daily identical across profiles,
  speed and Engine, recall and docking, wreck / cloud / rock work and loot, Rig and Scanner, static damage, drone damage per
  shot, Lance time to kill, guard bounty, a looted site keeping its guards, death with cargo into a wreck, rebuild price at
  Waves 20 and 40, 40 s yard, upgrades kept, salvaging your own wreck, scaling (guards ×3.74 vs probe ×3.00 from Wave 5 to
  45, loot ×12.6, prices, guard counts), spawn rules (outside the sector, off roads, cap), jackpot, snapshots (and a 6.4
  snapshot), a live act() run replaying exactly, and the frV 5 fixture bit for bit.
- `test/probe65_mkfix.js` writes `test/fixtures/rec_650_probe.json` (Wave 30, 20 sites, 1 probe lost on purpose, a rebuild,
  10 upgrades, 44 sends). Re-record it if the 6.5 rules change before release (sky65's frV 5 rules will change the draws:
  **the integrator must re-run `node test/probe65_mkfix.js` after merging sky65**, as was done for tower64).
- `python3 test/probe65shot.py [WxH…]` (17 checks per size; default 667×375 and 1180×820): button placement, intro card,
  select by button / sprite / site, send by tap (recorded prGo), recall by tapping the core, Send probe, upgrade purchase,
  each site kind, a guard fight, site and probe edge arrows (and tapping one), lost probe and rebuild, Dictionary.
  Screenshots in `test/out/probe65/`.
- `test/trackcollide.py`: the Probe button against every control and banner, Ready against it, site arrows (≤ 3) and the
  probe arrow against controls, at all four sizes.
- `test/drawbench.py`: `PROBE=1` adds 5 guarded sites and the probe in flight, selected.
- `test/smartbot.js`: `botProbe` (upgrades in a set order when credits > 1.5× / 2.5× the price, the best site by value per
  second that its guards can't kill it on, chains sites, recalls under 40% hull or with a full hold or a jackpot, rebuilds
  when credits > 2× the price). `NOPROBE=1` leaves the probe docked. New table column `pr` (sites, lost, kills, jackpots,
  credits banked, upgrades).
- `test/harness.js`: one export line for the probe API.

## Balance

BALANCE_PLACEHOLDER

## Open issues

- The bot is careful (it skips sites whose guards out-damage 75% of its hull), so its runs rarely lose the probe; real
  players will lose it more. Watch Nic's run logs (`prLost`, `prBank`).
- No sound of its own: the probe and drones reuse `zap`, wrecks `crack`, banking `cash`. A small probe engine hum and a
  guard shot sound would help.
- Per-zone looks: clouds are violet (gold when rich) in every zone; wrecks and rocks do not change per zone.
- With sky65's fog, sites outside vision could be hidden until scouted. That is sky65's call; sites read `G.probe.vis`
  nowhere themselves.
- Not yet tried on a real iPhone.
