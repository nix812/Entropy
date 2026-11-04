# qolA: battlefield, sound and support towers (6.2.0, on top of 6.1.0 / 996905d)

Nic played on a flight and asked for seven things. All seven are built. Two of them change sim rules and are gated on
`FR_VER = 3` (`G.frV >= 3`); runs recorded at frV 1 or 2 replay exactly as before.

## What changed for the player

1. **Power Nodes stay out of the red zones.** "The diamond powered up squares shouldn't spawn in red zones for worm holes."
   No Power Node is placed within 6 tiles of a wormhole: at the start, in a newly revealed band, or by a Node Beacon
   (the Beacon now refuses a tile in a zone). When a wormhole is detected next to an existing node, the node **moves**:
   it disappears and a replacement appears elsewhere in the sector (log line "Power Node moved out of a wormhole zone").
   A node with a tower or the landed core on it stays until that tile is free again (sold, moved, lifted off), so nothing
   the player built loses its bonus; then it moves too. In 6.1, about one node in five sat in a zone by the time every
   wormhole had opened (113 of about 600 over 80 test maps); now none do.
2. **Overdrive is the Nuke.** "Change overdrive to 'nuke' make its animation more nuclear bomb detonation like."
   Every player-facing word: the rail button (new radiation icon), "NUKE ONLINE", "NUKE ARMED", the toasts, the log
   ("Nuke · 30 enemies erased"), the core panel line, Help and Dictionary entries, the Black Market item "Spare Nuke"
   and the run recap ("Nuke erased …"). The detonation at the core (about 3.3 s, play never stops): a white-out, a
   fireball that swells and cools from white to yellow to orange to dark red, a ground shockwave ring across the whole
   board with a dust front behind it, a mushroom cloud (a rising stem of puffs and a rolling cap, chunky pixel puffs lit
   from the top-left like the rest of the art), drifting ash and rising embers, a heavier shake, and orange sparks on
   every enemy it erases. The cloud is sized to the view (about 40% of its height) and its cap never rises off the top,
   so a core high on screen still shows the whole cloud. New sound: a crack and blast, two long falling subs, a rumble
   that rolls on for three seconds and a lower second roar as the shockwave lands; music and weapons duck under it.
3. **No camera reset button.** "I think we get rid of the camera reset button." The Home/Map button at the top right is
   gone. The right column now starts at the top: Lift Off, then Ready under it (Classic resumes: Ready at the top).
   The way home is the green edge arrow that points at the core when it is off screen: tap it and the camera goes home.
   Double-tap still zooms in and back out; on a desktop F toggles the whole map and home. Edge arrows now also show in
   old Classic resumes (they were Frontier-only). Help's Zoom entry and two "under Map" mentions were reworded.
4. **Yellow treasure arrows.** "Add cursors for pirate treasure like what you use for the base but make it yellow."
   Every salvage crate (normal, cursed or gold) that is off screen gets a solid yellow edge arrow with a small chest
   behind it. Crates whose arrows would land within 34 px merge into one arrow with a count; at most 3 show (the closest).
   Tapping one pans the camera there. All edge arrows (enemy, core, treasure) now slide along the edge clear of any
   button or banner (Lift Off, Ready, ticker, banners, music deck, panels, log, toasts, tips, the coach card); if a side
   panel covers a whole edge they step inward past it.
5. **Chests are easier to tap.** "Make pirate chests easier to click on 1 square buffer." A tap within 1.5 tiles of a
   crate's centre claims the nearest crate (the claim is recorded with the crate's own tile, so replays are unchanged).
   A tap on a tower or the core still opens that. An empty tile right next to a crate claims the crate first (it lasts
   22 s; build after).
6. **Tower sounds follow the camera.** "Make tower sounds fade in and out based on my camera proximity." Tower fire,
   impacts and enemy deaths get their volume and a gentle pan (at most 60% to one side) from their distance to the
   centre of the screen, measured in half-screens so zooming changes it: full volume within 0.6 of the way to the edge,
   easing down to 20% by 2.2 (well off screen), dulled once off screen. Never silent. UI, events, bosses, the Nuke and
   music are unchanged. The Void Lens hum follows the firing Lenses' average distance. Cost: one small calculation per
   sound request; a far-off sound plays at most every 0.25 s per sound name, so a battle off screen starts far fewer
   voices than before (numbers below).
7. **Support towers grow with their towers.** "Support towers need their own upgrade notification … Maybe there's a
   better mechanic." Nic chose: a Relay Pylon or Snare Beacon levels up for free as the attack towers in its range are
   upgraded. Its level rises to the rounded-down average level (1–5) of the attack towers in its range. Free levels roll
   an affix like a paid level but add nothing to the sell value; levels never go down (selling the towers keeps it);
   it can still be upgraded by hand above that (and Ascended, which stays paid). LV 3 → 4 needs a Specialization, so
   growth stops at LV 3 and the tower shows the gold star and counts on the Ready button; Ready offers the two
   Specializations marked Free, and the panel's Specialize block says "Free: grown with its towers". After the pick it
   keeps growing. The panel's first line: "Grows with nearby attack towers +2 LV free / 3 in range". A small effect when
   it grows: a double ring, rising motes and "LV n" floating up, plus the upgrade chime and a log line.
   The Credit Forge is not included: it has no range (it serves no towers) and making economy free is a different
   balance question.

## Code map

- **data.js**: `FR_VER = 3` (comment lists what 3 adds). Market item `recharge` renamed "Spare Nuke".
- **sim.js**
  - `placeNodes`: skips `frNearWorm` tiles when `G.frV >= 3`.
  - `frNodeFix()` (new, after `placeNodes`): drops nodes inside a zone with nothing on them and places replacements. Called
    after `genExtraLane` in `newRun` (startWave loop) and `prepareWave`, at the top of `prepareWave` every wave, from
    `sellTower` and `frMoveTower`. No-op below frV 3.
  - `marketPlaceNode`: refuses a zone tile at frV 3.
  - `supKind`, `supTarget(t)`, `supGrow()` (new, before `recomputeAuras`); `recomputeAuras` calls `supGrow()` first when
    `G.frV >= 3` (so after every build, upgrade, sell, move, resume). Tower fields `t.grow` (free Specialization waiting),
    `t.freeLv` (levels grown free); both in `snapshotRun`/`resumeRun` (**hotspot**, one field pair each).
    `G.stats.supGrow` counts free levels.
  - `upgradeTower`: cost 0 for a grown tower's Specialization (`t.grow && t.lvl === 3 && G.frV >= 3`). No new ACTS entry:
    the pick is `act('up', x, y, spec)` as before.
  - `releaseOverdrive`: toast/log say Nuke, `Hooks.sfx('nuke')`, orange sparks. Internal ids unchanged (`od*`, `act('od')`,
    fx `'overdrive'`, rlog `'overdrive'`, `G.stats.odKills`).
- **audio.js**: `prox(arg)` + `PROX_FLOOR/IN/OUT` (before `duck`); `ev()` uses it for `busW`/`busH`; `play()` computes it
  once for WEAP/HIT/die, thins far sounds (`allow(name + '~far', 0.25)`) and hands it to `ev` through `curP`.
  `beams(n, ramp, eh, pr, pk)`; `SFX.proxK(x, y)`. New EVT `nuke` and `TRIM.nuke`.
- **render.js**: `nuke`, `nukeSpr`, `NUKE_RAMP`, `nukeSprites()`, `startNuke()`, `drawNuke(dt, vy, vh)` (before
  `ditherDisc`); fx `'overdrive'` → `startNuke`; light for the blast; `reset()` clears it. Edge arrows block rewritten
  (all modes, treasure arrows with merge/cap/chest, keep-out sliding); `keepOut` (getter/setter). fx `'grow'`. Gold star
  also for `t.grow`.
- **ui.js**: `overdrive` icon (trefoil), every Nuke string, `ALERT_RE`/`TIP_RE` (`NUKE ONLINE`, `NUKE`). `#bZoom` gone:
  its `onclick` wiring removed, `updateZoomBtn` is a no-op hook (kept, many callers), F key. `KEEP_OUT`, `keepOutRects()`,
  `koT` in `tick` (4 Hz). Edge-arrow tap no longer Frontier-only. `cacheNear()` + `CACHE_REACH` (before `tapTile`);
  `tapTile` and the hover cursor use it. Locator returns `py`; Lens hum proximity (`beamK`, 4 Hz). `growHTML(t)` (before
  `towerPanelHTML`, **hotspot** `towerPanelHTML`: one line in each tab, the Specialize block's price);
  `vetsReady`/`openVets` and a `gpick` action for the free Specialization. Help: Nuke, Zoom, Lift Off; the Veterans
  intro card ("Ready button at the top right": a Home reference, the only onboarding text touched).
- **template.html**: `.zoombtn` and `#bZoom` removed; `.rdybtn`/`.liftbtn` top 6 px, `body.fr .rdybtn` 52 px; `.sts.grow`.

## Tests

- `test/qola.js` (new, Node, 28 checks): frV 3 recorded, 6.1 recordings keep frV 2; no node in a zone over 80 maps with
  every wormhole open (frV 2 had 113); a node next to a new wormhole moves, one under a tower stays until it leaves;
  Beacon refused in a zone; Pylon growth step by step (free, sell value, stop at LV 3 with the pick, free spec, LV 5,
  never down, paid Ascension above), a hand-upgraded support keeps its level, snapshot/resume keeps `grow`/`freeLv`,
  Snare Beacon grows; frV 2 no growth; **the 6.1.0 Frontier recording `test/fixtures/rec_610_fr2.json` (frV 2, wave 22,
  793 inputs, made at 996905d by `test/qola_mkfix.js`) replays bit for bit**; a frV 3 run with growth replays bit for bit.
- `test/qolashot.py` (new, Playwright, 667×375 and 1180×820): no Home button and the right column; treasure arrows,
  merging and tapping one; a tap beside a crate claims it, two tiles away does not; Pylon growth, panel line, Ready with
  the free Specialization and the free pick; sound gain at centre/edge/far; the Nuke button, frames and that play goes on.
  Screens `test/out/qa_*.png`.
- `test/sfxload.py` (new): sound requests, voices started and JS time in `SFX.play` on a busy board at home, zoomed in
  on the middle and zoomed in on a corner; pass another build's page to compare.
- `test/trackcollide.py`: `#bZoom` removed from the lists; checks no Home button, at most 3 treasure arrows, and every edge
  arrow clear of controls, banners and each other (crates on every side, camera zoomed in).
- `test/frontiershot.py` (the green core arrow replaces the Home button check), `test/tiershot.py` (`Render.overview()`),
  `test/drawbench.py` (`NUKE=1`), `test/sfxrender.py` (`nuke` last), `test/harness.js` (exports `frNodeFix`,
  `frNearWorm`, `setNodes`, `supGrow`, `supTarget`).

RESULTS_PLACEHOLDER

## Open issues

- The Nuke cloud is drawn in the world buffer, so zoomed far in on another part of the map you see only the flash and
  the shockwave (the cloud is at the core). That seemed right; say if Nic wants it centred on screen instead.
- A tap on an empty tile beside a crate claims the crate instead of opening the build menu. Crates last 22 s, so I
  favoured the crate as Nic asked; if building next to crates feels sticky, shrink `CACHE_REACH` to 1.2.
- Support growth counts the attack towers in range now, including ones moved in; moving all towers away leaves the level.
- smartbot was not taught anything: it still upgrades support towers as before and simply finds them cheaper.
