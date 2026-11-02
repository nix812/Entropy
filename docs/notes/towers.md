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
Recorded on the untouched 5.7.4 source (frozen copy) and again on this branch; identical on every line.
- `node test/replay.js 6 60` (scripted player, 6 runs, std and daily): same wave / score / tick / `runHash` per run
  (b7257dd9, 8deeb648, 9ac3a3d1, 7be93660, 40bc9873, 179f1d52), and "all replays match". The default `node test/replay.js` also passes.
- `smartbot.js 1 40 1 1 60` with `COLS=48`, seeds 0–2, and `Math.random` replaced by a fixed-seed generator
  (`node -r seedmath.js`, so the bot's own boon picks repeat): identical full result rows, e.g.
  seed 0 wave 64 (44.6 min, 19632 combos, damage share lens 50 / rail 23 / emp 12), seed 1 wave 81, seed 2 wave 153 (95.2 min).
- How it stays true: sim.js only gained extra fields on existing `Hooks.fx`/`Hooks.sfx` payloads and new Hooks calls; no `G.r()`
  calls were added or moved (the Overvolt fx sits inside the existing stun branch), and no `Math.random` was added to sim.js
  (it would shift the seeded bot proof). All randomness for the new effects is `Math.random` in render.js and audio.js.

## Loudness (sfxrender.py, loudest 50 ms RMS dBFS, after trims)
Tiers from the comment above `TRIM`. Two renders; values vary about ±1.5 dB per render from the built-in pitch and level jitter.

| Sound | rms50 dB | Tier |
|---|---|---|
| shot (Pulse) / shotG (Gatling) / shot2 (Twin, both taps) | −30.3 / −30.8 / −30.5 | rapid −28…−31 |
| coil / coil1 Tesla / coil2 Overvolt | −27.2 / −26.8 / −25.8 | as the old `zap` (−27) |
| flames roar (1 projector) / Inferno / Plasma | −29.7 / −28.4 / −28.5 | rapid |
| ignite | −32.0 | rapid, quiet |
| pulse (Cryo) / Glacier / Shatter | −27.9 / −27.7 / −27.4 | as before (−27.3) |
| rail / Gauss / Splinter | −21.8 / −20.6 / −21.1 | as before (−21.7) |
| missile / Cluster / Napalm launch | −26.8 / −25.3 / −25.2 | as before (−25.4) |
| mortar / Blackout / Ion Barrage | −21.9 / −21.2 / −22.0 | as before (−22.1) |
| grav / Singularity / Tidal Lock | −24.1 / −22.6 / −23.4 | 3 dB under the old −21.6 |
| hit (generic) / hitK / hitR / hitC / hitF / hitV / hitA | −39.3 / −35.3 / −35.9 / −36.9 / −37.7 / −41.4 / −35.5 | hits −36 (frequent ones lower) |
| boomT / boomT2 (Napalm) / empboom / empboom1 (Blackout) | −20.4 / −20.2 / −21.4 / −19.9 | as the old `boom` (−20.8) |
| pop (bomblet) | −28.9 | small blast |
| net / net1 (Tangle) | −25.9 / −25.8 | as before (−26.1) |
| lure / lure2 (Long Lure) | −34.4 / −34.6 | quiet |
| lock (Lens lock-on) | −33.3 | quiet |
| forge / forge1 (one bell each) | −26.3 / −24.4 | notices −20…−24, a little under |
| pylon (new link) | −32.2 | quiet |

Voice budgets (gap s, polyphony): hitK 0.04/4, hitR 0.05/3, hitC 0.09/2, hitF 0.12/2, hitV 0.1/2, hitA 0.05/3, generic 0.035/5;
coil 0.07/4, ignite 0.12/2, boomT 0.06/4, pop 0.05/3, empboom 0.06/3, lure 0.25/2, lock 0.08/2, pylon 0.3/2, forge 8 bells max.
Frequent sounds use at most 4 layers (Tesla Crown's per-hop clicks and Ion Barrage's three thumps play on towers that fire about once a second).

## Render cost
Measured on a shared, heavily loaded machine (load average 60–130 from other builders' bot batches), so single numbers swing ±50%;
read the pairs, not the absolutes. No regression showed up in any pair.
- `test/drawbench.py` (static busy scene, ms per `Render.draw`, 5.7.4 vs this branch, run back to back):
  pair 1 home 148.9 / 81.5, zoomIn 109.6 / 78.3, zoomOut 122.1 / 61.7; pair 2 home 153.6 / 95.9, zoomIn 112.3 / 71.1, zoomOut 213.1 / 86.9.
- Live 36-tower battle (every tower and spec firing, 90 enemies; `towerfx.py` bench and a draw-call counter), 5.7.4 / branch:
  ms 60.9 / 57.4 and 91.0 / 61.8; canvas calls per frame in the heavier pair: fillRect 646 / 949, stroke 62 / 101, drawImage 261 / 316
  (the extra calls are the new flashes, discs and wedges; frame time stays level because compositing dominates).
- Extras skip when there are more than 600 particles or the game runs faster than 2× (`LITE`). Colour strings come from the
  existing caches (`hexA`, `sh`, with the Lens colour quantised); the Snare mesh is drawn once per size into a cached canvas;
  no gradients or shadowBlur.
- `test/perfcheck.py` (music only, unaffected by this work) ran 0.66–2.47× realtime under the same load; sfx have no new ConvolverNodes.

## Pictures for Nic
Per-family GIFs (about 1 s each, real speed) and 4-frame strips: `test/out/towerfx/<family>.gif` and `<family>_strip.png`
(pulse, rail, cryo, snare, missile, pylon, coil, forge, flame, lens, emp, grav), regenerate with `DSF=2 python3 test/towerfx.py`.

## Open issues
- Pylon pulses and Forge sparks are small at the default zoom by design (ambient, not alerts). If Nic wants them louder visually, raise `D(b, px, py, 1.5 …)` and the spark count.
- The flame roar is one shared voice panned centre (like the Lens hum).
- `splashshot.py` "Nigel blinks twice" fails on this loaded machine for 5.7.4 as well (timing); unrelated to this branch.
- `uiaudit.py` flags (help text clipping etc.) are pre-existing; this branch changes no DOM.
