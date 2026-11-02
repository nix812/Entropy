# Tower character pass (branch `towers`)

A cosmetic pass: every tower now looks and sounds like itself, and each tower's two specializations (and Ascend) are
audibly and visibly different. The simulation is untouched (proof below).

## What the player notices
- **Every shot reads.** Turrets kick back along their barrel and ease home. Muzzle flashes last about three frames in the
  tower's element colour around a white core: Pulse a cross star (one per Twin Cannons barrel, alternating Gatling
  barrels), Rail a hard line, Flame a cone lick, EMP and Missile a hot disc. Ascended towers flash bigger and sound heavier.
- **Charge-ups.** A Rail Lance's barrel glows when its next shot is close; an Arc Coil's sparks gather toward the dome.
- **Impacts.** Each tower family has its own hit sound and its own voice budget, so Lens, Flame and Cryo no longer drown out
  the rest. Missile, EMP and Cluster blasts each have their own sound. Heavy hits (Rail crit, EMP impact, Overvolt stun) give a
  tiny screen kick, at most every 0.25 s, and only with Screen Shake on.
- **Per tower:**
  - Pulse: white "+" on each bolt impact. Gatling: fast thin chirps alternating a semitone per barrel. Twin Cannons: two taps panned apart.
  - Rail: the beam fades over 0.25 s with rings rippling along it and a white burst on each enemy it pierces; a sub thump.
    Gauss Spire: thicker, longer beam and a ringing hall tail. Splinter Rail: splinters fly off pierced enemies; a bright crack and three clicks.
  - Cryo: ice shards fly out with the ring. Glacier Core: slower, thicker white ring and a lower bell. Shatter Field: a cracked ring with glass tinks.
  - Snare: a hex-mesh net, a taut tether while a flier is held, a soft lure sound. Tangle Web: finer net and a low thwump. Long Lure: a radar sweep and ping.
  - Missile: launch puff and flash, its own impact. Cluster Pods: bomblets drop as little sprites and pop. Napalm Payload: flame tongues and a rising whoomph.
  - Relay Pylon: every 1.2 s a pulse runs out to each tower it boosts (amber Amplifier, cyan Uplink, pale base); a soft chirp when it links a new tower.
  - Arc Coil: its own crackle; bolts flicker and a star lands on every hop. Tesla Crown: forked bolts and a click per hop. Overvolt: thick orange bolt, crushed buzz and sub; stuns kick the screen.
  - Credit Forge: a payout chime per forge at wave end (several forges play a rising arpeggio) and a spray of sparks.
  - Flame: wedge flames that grow and cool from white to smoke; one continuous roar for all projectors (no more choppy retriggers) plus an ignition chirp. Inferno: redder, with a rumble. Plasma Torch: blue-white flames and a crushed 110 Hz buzz.
  - Void Lens: the beam leaves the lens tip, crawls toward the target and shifts violet to white as it ramps; a lock-on chirp on each new target. Event Horizon: dark core, sparks pulled inward, a sub octave under the hum. Prism Split: three violet tints and a wider chorus.
  - EMP: smoke ring at launch, sparks trailing the shell; impact = white disc, jagged arcs, kick. Blackout Shell: more arcs and a 0.4 s buzz tail. Ion Barrage: three launch thumps 70 ms apart.
  - Gravity Well: inward spiral arcs and a drag streak on each enemy it pulls; 3 dB quieter. Singularity: dark core and an upward suck before the drop. Tidal Lock: double teal ring and a longer drop with vibrato.
- **Bug fixed:** the Lens hum's ramp divided seconds by the damage multiplier; it now follows seconds on target out of 4 (Event Horizon reaches the top).

## Code map
**sim.js** (payload additions only, no `G.r`, no logic change):
- `hit()`: `Hooks.sfx(name, e, src)` passes the source tower.
- `explode()`: `Hooks.fx('boom', {…, k: p.k, t: src})`; sound is `boomT` (missile), `pop` (bomblet) or `empboom` (mortar).
- `towerAttack()`: `t` added to the `rail` (plus `hp`: pierced positions), `pulse`, `chain`, `flame` and `grav` (plus `es`: pulled enemies) fx; the Coil plays `coil`.
- `lure()`: `t` on the lure fx, new `Hooks.sfx('lure', e, best)`. Net: `Hooks.fx('net', {…, t})`, `Hooks.sfx('net', e, t)`.
- `applyStatuses()`: Overvolt stun emits `Hooks.fx('ovstun')` (inside the existing branch, same `r()` calls).
- Wave start: forge coin fx carries `forge: f`; new `Hooks.sfx('forge', f, i)` per forge.

**audio.js:** `play(name, arg, arg2)`; `ev(…, { tn })` picks a TRIM entry for spec variants while the voice budget stays shared.
`HIT_FAM`/`HITS` (per-family impacts: N, K, R, C, F, V, A), `shotBody`, `ascT`, `gatBar`; new/changed WEAP: `shot`, `rail`, `pulse`,
`missile`, `coil`, `flame` (silent), `ignite`, `mortar`, `grav`; new EVT: `lure`, `lock`, `forge`, `pylon`, `boomT`, `pop`, `empboom`, `net(e, t)`.
`beams(n, ramp, eh, pr)` (sub octave, chorus voice); new continuous `flames(n, inf, pl)`. No new ConvolverNodes.

**ui.js:** `Hooks.sfx` passes the third argument. `UI.tick` drives `SFX.beams` (fixed ramp, spec shares), `SFX.flames`, the Lens lock-on
(`t._lock`) and flame ignition (`t._flOn`).

**render.js:** render clock `rt`, `kick(px)`, `stars`, `drags`, `LITE` (parts > 600 or speed > 2 skips extras), `FLAME_RAMP`, `PRISM`,
`MUZ`, `RECOIL`, `hexMesh()` (cached canvas), `towerFired()`, `muzzle()`; drawTower (recoil, muzzle, Rail/Coil charge), Pylon pulses,
Snare mesh/tether/radar, napalm tongues, Lens beams, EMP shell sparks, bomblet sprites, delayed (`dl`) lines/rings/stars, dashed rings,
flame wedge particles, fx cases `boom`, `rail`, `chain`, `ovstun`, `flame`, `pulse`, `grav`, `lure`, `net`, `coin`, `spark`.
`Render.fxCounts` (test hook). Render-only tower fields: `_pa`, `_ft`, `_gb`, `_pyl`, `_pph`; UI: `_lock`, `_flOn` (never snapshotted or hashed).

No PROF or G fields added. No sprite frames added (recoil is an offset).

## Tests
- `test/towerfx.py [outdir] [page]`: builds each family (base + both specs) beside the road on a real map, records the sounds that fire,
  fails on missing new names / `zap` from the Coil / the shared `boom` from a tower, writes a GIF and a 4-frame strip per family, and times
  `Render.draw` in a live 36-tower battle. `FAMS=rail,coil` limits it.
- `test/sfxrender.py`: new names added (spec variants, hits, blasts, `flames*`, `lock`, `forge*`, `pylon`, `lure*`, `net1`).

## Simulation unchanged (proof)
SEE_PROOF

## Loudness (sfxrender.py, loudest 50 ms RMS dBFS, after trims)
SEE_LOUD

## Render cost
SEE_BENCH

## Open issues
- Pylon pulses and Forge sparks are small at the default zoom by design (ambient, not alerts). If Nic wants them louder visually, raise `D(b, px, py, 1.5 …)` and the spark count.
- The flame roar is one shared voice panned centre (like the Lens hum).
