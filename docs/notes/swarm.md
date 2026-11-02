# Swarm: the evolving swarm made visible (branch `swarm`)

## What the player sees
- **Gene marks on the field.** Every gene now has its own mark, drawn crisp in screen space so it reads at phone zoom:
  - Shell: a blue hexagon around the unit. Solid while the shield holds, a broken outline while it recharges.
  - Plating: white steel plates on both flanks and the brow.
  - Wings: pixel wings at the shoulders, beating.
  - Haste: three yellow speed streaks trailing behind.
  - Bulk: an orange bracket under its feet (the sprite is also a size up, as before).
  - Brood: three pink eggs clinging on.
  - Regrowth: a green cross that pulses at the shoulder and a green pulse on the body. The cross turns grey while the unit Burns (it can't heal).
  - Ward: a small ring in the colour of the element it resists.
  - Cloak: the body is dithered violet while visible; the cloaked shimmer is violet too.
  - A unit shows at most 2 marks: the genes most common in the swarm right now. With more than 40 enemies on the field it shows 1, so a late wave reads as one dominant trait.
- **Strain Assault families.** Every unit of an assault gets an outline and a diamond in the strain's colour (one of 8, picked from its genes), so an assault wave reads as one family. The Threat Board shows the same colour beside the strain's name.
- **Arms Race strip** (first section of the Threat Board): your recent damage mix by element, then up to 4 counters the swarm has bred, each with its mark, tier (I 20%, II 35%, III 50% of the wave), share bar with tier ticks, trend (red ▲ rising, green ▼ falling, over about 3 waves), the reason in plain words ("73% of your damage is Kinetic") and the counter. Below: "Next it may breed", the strongest reads that are not in the swarm yet. The Swarm DNA list underneath now has a mark beside each gene (it doubles as the legend).
- **Between-wave notice:** "SWARM EVOLVES · Plating II 38% · counter: …" only when a gene reaches a tier it has not reached before in the run. All gains of one wave go in one line. It goes to the corner feed (not an alert card) and pulses the Threat chip, as before. Assault waves are skipped. It replaces the old 35% trigger, which could repeat after a trait faded.
- **Recap timeline** (game over and Hall of Fame): a track from the start wave to the last with a mark for each tier gained (taller for higher tiers) and a diamond for each Strain Assault (filled = broken), the same as chips ("W15 Plating II", "W38 Gunship Strain held"), and "Ended by Gunship Drone · 6 leaked on the last wave" when a strain ended the run.
- **Swarm Collection** (Archive, replaces the old strain list that capped at 400 and filled in one run): a grid of the 12 species that evolve × the 9 genes, three pips per cell (seen with that gene alone, in a pair, in a triple or more), plus the 12 named pairs (Zoomwing, Fortress…). 318 points in all, shown as a % and a bar. New entries pulse pink with an "N NEW" count, once; the hangar's Archive button gets a pink ring while there are new entries. Cells a species can't carry (Wings on fliers, Plating on the Juggernaut…) are blank. A "NEW STRAIN" feed line appears only the first time a named pair is met (at most one per wave).

## Code map
- **data.js** (after `strainName`): `GENE_TIERS`, `geneTier(v)`, `GENE_VS` (what a gene exploits, for the strip), `STRAIN_COLS`, `strainCol(genes)`, `COLL_SPECIES`.
- **sim.js**
  - `prepareWave` (end): the tier logic replaces the `geneTold` block. Run fields `G.stats.gTier` (gene → best tier this run) and `G.stats.evo` (`[wave, gene, tier]`, capped at 60). They live in `G.stats`, which snapshots already save, so `snapshotRun`/`resumeRun` are untouched. A resumed pre-5.8 run seeds `gTier` from `G.geneTold` so old announcements don't repeat. `G.geneTold` is no longer written.
  - `spawnEnemy`: the `PROF.codex.strains` write (and its 400 cap) is gone; `G.strainN` is unchanged. It now calls `Hooks.strainSeen(type, genes, gel)` for every gened spawn (assault units included). The sim no longer reads or writes the profile there.
  - After `topStrain`: `runEndStrain()` (read-only, no `G.r`), and the collection helpers `collOk`, `collMax`, `collHave`, `collAdd(codex, type, genes)`, `collMigrate(codex)`.
  - `defaultProfile().codex` gains `coll: {}, collC: {}, collNew: []`.
- **PROF.codex fields:** `coll = { species: '010230000' }` (one digit per `GENE_IDS` entry, 0–3), `collC = { 'haste+wings': 'drone' }` (named pair → first species), `collNew = ['drone.plating', 'c:haste+wings']` (max 150), `collV = 1` (migration done). `strains` is kept but no longer written.
- **Migration:** `Save.merge` calls `collMigrate(out.codex)`: every old `strains` key counts once, nothing flagged NEW. Idempotent.
- **ui.js**
  - `hydrateIcons` draws every `canvas[data-gico]` with `Render.geneIcon` (so any modal gets gene icons for free).
  - `Hooks.strainSeen` (next to `Hooks.newEnemy`): records with `collAdd` unless `ghostRun()` (replays, Daily resume replay, watch mode).
  - `wardElNow`, `armsHTML` (before `openThreat`); `openThreat` puts the strip first, adds the assault swatch and drops the duplicate reads list from the DNA section. `evoRowsHTML` rows get icons.
  - `swarmTimelineHTML(R)` (before `recapHTML`), called from `recapHTML`. **Hotspot:** `recapHTML` (one line) and `runRecord` (adds `evo`, `endStrain`).
  - `collPctTxt`, `collHTML` (replace `strainsHTML`, removed); `openArchive` appends the collection after its grid and clears `collNew`; `codexHTML` shows the % instead of the old strain row. `renderHangar` toggles `#bArchive.hasnew`.
- **render.js**
  - `ditherOf` (next to `tintOf`), `geneMark(ctx, gene, x, y, hw, hh, u, e)`, `geneRanks()` (gene shares every 20 frames; crowded flag every frame), `geneMarks(e)` (cached per enemy by stamp).
  - `drawEnemy`: picks `e._gmOn`, stores `e._hw`; assault outline in the strain colour before the sprite; Cloak dither and Regrowth pulse after it; diamond in the strain colour; the plain shield ring is skipped when the Shell hexagon shows; the old 1–3 px gene marks are removed.
  - A screen-space pass in the overlay section (before the inspect ring) draws the marks. `Render.geneIcon(gene, canvas, el)` for menus.
- **template.html**: CSS block after `.evrow.dim` (`.arms`, `.armrow`, `.armbar`, `.sxtl`, `.sxc`, `.coll*`, `.ccell`, `#hangar .util .ib.hasnew`). `.evrow` first column widened to 116px for the icon.

## Determinism
Rendering only reads state (`e._gm*`, `e._hw` are render caches on the enemy object, like `_hx`/`_hh`). No `G.r` anywhere new. The tier log and toasts are deterministic sim bookkeeping in `G.stats` (not in `runHash`). Collection writes happen in a UI hook, skipped for ghost runs. `node test/replay.js` prints "all replays match".

## Tests
- **`test/swarmshot.py`** (new): gene lineup (each gene alone, three assault units, four pairs) with labels at phone 852×393 and iPad 1180×820; a 60-enemy crowd (checks ≤ 2 marks, 1 when crowded); Threat Board (strip first, rows, icons drawn); collection migration from old `strains` (cells, named pairs, nothing NEW, old list kept, idempotent merge); recording in a real run vs `G.replaying`/`G.watch` (nothing recorded); Archive grid (every cell, %, NEW, cleared after viewing); recap timeline (8 gains + 3 assaults) and the ending strain. Prints `FAIL` lines, `FAILED: []`, `ERRORS: []`.
- **`test/drawbench.py`**: new `GENES=1` knob (every enemy carries 1–3 genes, a third are assault units).
- Screenshots: `test/out/swarm_phone_genes.png`, `swarm_phone_crowd.png`, `swarm_phone_threat.png`, `swarm_ipad_genes.png`, `swarm_ipad_crowd.png`, `swarm_ipad_threat.png`, `swarm_archive.png`, `swarm_recap.png`.

## Balance
No balance change: genes, breeding, assaults and rewards are untouched. Only when a notice fires changed.

## Performance
DRAWBENCH_PLACEHOLDER

## Open issues
- The marks are tuned for u = 2 px (phone and iPad home zoom). Pinching far in shows them at up to 4 px.
- Gene icons in menus use a Drone; the Ward icon shows the gene colour unless an element is given.
- The recap still has the older one-line assault summary under the timeline (kept for its counts).
