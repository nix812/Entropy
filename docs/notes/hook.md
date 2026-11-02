# Hook: zones, jump doors, the Bounty Purse and escalations (builder "hook", for 5.8)

Every run now has a reason to exist and a shape of its own. You pick a zone at the start, choose where to jump at every bounty, bank or risk a growing purse of XP, and from Wave 50 each boss wave makes the run stranger instead of only tougher.

## What the player sees

**Zones (internally "sectors").** The game already uses "sector" for the playable map area ("Sector expanding"), so players see them as *zones*. A zone sets which enemies come most, the weather that rolls in most, the event mix, the Most Wanted boss and its mutation, plus one perk and one drawback.

| Zone | Pitch | Enemies lean to | Weather | Events lean to | Most Wanted | Perk | Drawback |
|---|---|---|---|---|---|---|---|
| Quiet Drift (start zone) | Thin traffic and kind weather | Drones (fewer Juggernauts, Skimmers) | Cryo Front | Gold Rush, Meteors, Overcharge | Colossal Behemoth | +10% Credits | −10% score |
| The Hive | Brood nests on every lane | Swarmers, Splitters | Solar Flare | Swarm Tide, Rift Breach | Twin Hive Queen | +1 Chain, +15% Thermal | +10% enemy speed |
| Iron Reach | Juggernauts and Aegis walls | Juggernauts, Aegis, Reflectors | Static Haze | Elite Tide, Nanite Bloom | Armored Titan (from W30) | +15% armour piercing | +6% enemy HP |
| Open Skies | Skimmers and Carriers fly straight in | Skimmers, Carriers | Ion Storm | Phase Shift, Surge | Spectral Space Whale | +20% Arc, +8% Range | +10% tower cost |
| Ghost Lanes | Phantoms flicker in and out | Phantoms, Menders, Leeches | Void Tide | Blackout, Phase Shift | Spectral Phase Wraith | +25% Void | −10% Range |
| Salvage Belt | Rich wrecks, Leeches after your bank | Leeches, Sappers, Drones | Static Haze | Gold Rush, EMP Storm | Loaded Auditor | +25% Credits | +15% upgrade cost |
| Tempest Front | Storms back to back | Skimmers, Carriers (mild) | all, twice as often | Surge, Overcharge | Hasted Spaghetti Monster | Storms ×2 as often, +40% stronger | +10% enemy speed |
| Demolition Row | Your towers will go dark | Sappers, Splitters, Reflectors | Cryo Front | EMP Storm, Elite Tide | Hasted Overmind | +10% Attack Speed | More Elites |
| Green Choir | Whatever you leave standing comes back | Menders, Aegis | Solar Flare | Nanite Bloom | Colossal Immortal Snail (from W25) | +15% Thermal, Burn +30% | Enemies regen 0.5%/s |
| The Odd Belt | Expect the cat | even | Void Tide | Meteors, Phase Shift | Loaded Mr. Whiskers | Oddball bosses pay 3× credits | Every boss is an oddball |

- **Run start.** The setup screen shows a "Zone" row with three offers. They come from the setup's map seed (Reroll Map gives new offers), never from the run's random stream. A fresh profile (best wave under 10) is not asked and plays Quiet Drift.
- **Jump doors.** A claimed bounty no longer offers a boon or a plain Push button. The Bounty Claimed card shows the purse and four buttons: Extract, or one of three jump doors. Each door is a different zone (never the current one) at a risk tier: Steady (purse ×1.25), Hot (×1.4, +12% enemy HP, +10% score) or Deadly (×1.6, +25% enemy HP, more Elites, +25% score). The door sets the zone for the next 20 waves and re-posts the next bounty as that zone's Most Wanted when its boss can appear by then.
- **Daily Hunt.** The day's zone comes from `dailySpec` (drawn after the older fields, so the day's seed, anomalies and Nemesis are unchanged), shown on the Daily card as "Today's zone".

**Bounty Purse.**
- 60% of every XP gain banks at once (the level-up feedback stays); the other 40% goes into the purse.
- Each bounty claimed grows the purse ×1.5. Each push multiplies it by the door's tier.
- Extract banks the whole purse. If the core falls (or you abandon), you keep 30%.
- The purse shows on the HUD's bounty chip ("W40 12K XP", gold), on the bounty card with plain text, and on the game-over card ("you kept 30%, +1,500 of 5,000 XP. Extracting after X would have banked all of it").
- Replays, watching and Daily resumes never pay it out.

**Escalations (from Wave 50).** Each boss wave from Wave 50 offers one of two permanent twists instead of a boon. They stack, and each adds to the score and XP multiplier:

| Twist | Effect | Max | Score |
|---|---|---|---|
| Twin Bosses | Every boss arrives with a twin, each at 65% health (not on bounty waves, which have their own Wanted mutation) | 1 | +20% |
| Torn Space | Every wave opens a Rift (some enemies start halfway down the road) | 1 | +15% |
| Elite Plating | Elites carry one more affix | 2 | +12% |
| Hostile Weather | Enemies in storms move 25% faster; storms 50% more often | 1 | +12% |
| Quick Study | The swarm learns twice as fast (selection pressure ×2) | 1 | +12% |
| Carrier Fleet | Carriers headline every wave | 1 | +15% |
| Blitz | Enemies spawn 25% faster and move 6% faster | 2 | +15% |
| New Wormhole | A new lane opens in 2 waves | 2 | +15% |

Late health growth is trimmed to match: past Wave 50 the health curve's growth is raised to the power 0.9 (W60 ×0.82, W70 ×0.66, W90 ×0.41, W120 ×0.18 of the old health), so long runs end on twists and decisions rather than a pure health wall.

**Boons, folded in.** Bounty waves: the jump doors replace the boon. Boss waves from Wave 50: the escalation replaces the boon. Other boss waves (W10, W30, and any boss wave before 50 without a bounty) keep their boon pick, because those early picks are the only power spikes a young run gets before its first door. If a wave has both (a bounty at W60), the escalation comes first, then the bounty card.

## Rules version and old data
- `G.hk` (`HOOK_VER = 1`) is the ruleset. A fresh run gets it. A recording carries it in `recOpts.hk`; recordings made before 5.8 have `opts.v` and no `hk`, so they replay with `hk = 0`: no zone, no purse, boons on every boss wave, old health curve, `push` exactly as before. `test/hookcompat.js` replays four 5.7.4 recordings (a push, an extract-free loss, two Dailies) against their 5.7.4 hashes.
- `ACTS.push(door)`: a door index jumps through that door; no argument pushes on in the current zone (and is exactly the 5.7 push for hk 0). A door index that doesn't exist is refused.
- Escalations reuse `G.draft` (items carry `twist: 1`), so `HALTED()`, `ACTS.boon` and the UI's reopen-if-pending loop all work unchanged.
- Old snapshots (no `hk`) resume on the 5.8 rules with no zone and an empty purse.

## Code map
- **data.js** (after `HUNT`): `HOOK_VER`, `PURSE`, `DOOR_TIERS`, `SECTORS`, `SECTOR_BY`, `SECTOR_START`, `sectorOffers(seed)`, `TWISTS`, `TWIST_FROM`, `TWIN_HP`. `dailySpec` adds `sector`.
- **sim.js**
  - `hpMult0` (the old curve) and `hpMult` (trimmed past W50 when `G.hk`; `HKTRIM` env for tests).
  - `newRun`: `G.hk`, `G.sector`, `G.tier`, `G.purse`, `G.purseOut`, `G.twists`, `G.twistW`; `recOpts` gets `hk` and `sector`. **Hotspot (small).**
  - `hookFx()` feeds the zone, door tier and twists into `computeAf` (af) and `anomMods` (mods), so perks and drawbacks use the existing mod keys.
  - `genWave`: zone roster lean (types and headline picks), Carrier Fleet headline, `af.affN`, `af.gap`, `af.rifts`, Twin Bosses queue entry (`hpX`). `spawnBoss`: `hp × q.hpX`, boss remembers its wave (`e.bw`). `wpickI` helper.
  - `rollEvents` (zone event weights), `updateStorms` (zone weather ×4), enemy speed (`af.stormHaste`), `breedPlan` (`af.learn`).
  - `planWanted` → `sectorPoster()` / `sectorWanted(sid, w)`: the zone's Most Wanted, no `G.r` draw.
  - `claimBounty`: purse ×1.5, door offers from `G.r` on `G.huntChoice.doors`.
  - `huntPush(door)`, `enterSector(sid, tier)`, `huntExtract` (hk: banks via gameOver), `bankPurse()` (called first thing in `gameOver`; never pays in `ghostRun`). **Hotspot: one line in gameOver.**
  - `addScore`: on hk, `G.xpRaw` (what 5.7 would have paid), purse share, banked share.
  - `kill()`: escalation offer at W50+ boss waves, boon skipped on bounty kills and W50+; `twistOffers()`, `takeTwist()`, `takeBoon` routes twists.
  - `snapshotRun`/`resumeRun`: `hk, sector, tier, purse, xpRaw, twists, twistW, draft` (a pending boon or escalation now survives a resume). **Hotspot.**
  - `ACTS.push` takes the door index.
- **ui.js**
  - Setup: `setupSector`, `setupSectorHTML`, `sectorLine`, `sectorWantedName`; `launch` passes `sector`; Daily card and Daily launch pass `spec.sector`; action `sector`. **Hotspot: renderSetup (one line), launch (two lines).**
  - `openHunt` → `openDoors(C)` for hk runs (action `door` → `act('push', i)`). **Hotspot (openHunt, one line).**
  - `openDraft`: escalation card when the draft items are twists.
  - Bounty chip: `W40 12K XP` (wave and purse, `fmtS`) with a tooltip line instead of the push multiplier on hk runs.
  - Game over: purse outcome lines. Threat Board: zone, tier and escalations line.
  - Glossary: Bounty Purse, Zone, Jump door, Escalation.
- **template.html**: `.secs`, `.secb`, `.secnote`, `.pursebox`, `.dchoice`, `.hopt.door`, `.hopt.tw`, `.evchip i.pz`, and a short-screen rule that hides door pitches.

## Tests
- `node test/hook.js`: 36 checks (data, rules version, roster lean, purse split, bounty growth, doors, push/extract/death/ghost payouts, push without a door, refused door index, every twist's effect, twins once per wave, resume of zone/purse/twists/pending pick, old rules keep boons).
- `node test/hookcompat.js`: 5.7.4 recordings replay identically (fixtures in `test/fixtures/rec_574.json`; re-record only on old code).
- `node test/replay.js` (now 5 runs by default): the scripted player picks a zone, jump doors (and sometimes a plain push) and escalations. Runs 0 and 4 get a deterministic boost (credits, core, damage) through a non-enumerable `Hooks.log` hook that quiet replays keep, so they claim bounties and kill W50+ bosses.
- `python3 test/hookshot.py [W H]`: setup zone pick (and none on a fresh profile), bounty card with purse and doors, purse on the chip and clear of controls, escalation pick at W50, reload/resume keeps zone, tier, purse, twists and the pending pick, game-over purse text, Daily uses the day's zone.
- `test/trackcollide.py`: also checks the bounty chip (with purse) stays in the chip row, clear of every control, at all four sizes (or folds into the "+N" chip when the row is full).
- `test/v53shot.py`: pushes through a jump door now.
- `test/smartbot.js`: picks zones (`SEC_PREF`), doors (risk by how comfortable the last 10 waves were), escalations (`TW_PREF`), and extracts after a close call or now and then after two pushes. `SECTOR=id` forces a zone, `PUSH=1` never extracts. New columns at the end of the table: `sec` (zone and doors), `ext`, `tw`, `xp57` (what 5.7 would have paid), `paid`.

## Balance
Bots: `test/smartbot.js`, Normal, COLS 48, best wave 60, 8 seeds unless noted; the machine was shared by five builders (load 60–120), so batches were kept small. Baseline (5.3 sweep, bots push at every bounty): medians 57 / 72 / 92 at 0 / 60 / 96 points, means 46.5 / 88.5 / 109.5.

| Batch (bots push at every bounty, `PUSH=1`) | Median | Mean | Range | Waves |
|---|---|---|---|---|
| 0 points, final rules except trim 0.92 | **61** | 60.4 | 23–91 | 23,50,60,61,61,65,72,91 |
| 0 points, first pass (riskier bot doors, Skies/Iron/Ghost not yet softened) | 52 | 51.1 | 22–73 | 22,44,51,52,52,56,59,73 |
| 60 points, first pass (same) | **75** | 72.8 | 32–122 | 32,62,63,66,75,77,85,122 |
| 96 points, final rules (trim 0.9) | **96** | 81.6 | 31–107 | 31,65,72,83,96,97,102,107 |
| 96 points, trim 0.92 | 82 | 113.5 | 63–253 | 63,65,76,81,82,96,192,253 |

- **Run lengths.** Medians sit on the baseline (61 / 75 / 96 against 57 / 72 / 92, inside the ±5 noise). The long tail is what changed: at 96 points no run passed Wave 107 with the final trim, where 5.3 had 133 and 240. Runs now end on escalations and door risk instead of a health wall; with trim 0.92 two runs still reached 192 and 253 after every twist was taken (11 picks by about Wave 150), so 0.9 was kept. Early deaths at W22–31 still happen in about 1 run in 8, as in the baseline.
- **First bounty** stays at Wave 20 (the poster schedule is unchanged); every 0-point run but the W22–23 deaths claimed it.
- **Zones** (0 points, the whole run in one zone, 3 seeds each, so only large gaps mean anything): Drift 63, Choir 69, Hive 62, Demolition 55, Odd Belt 55, Iron 45, Skies 45 (one death at W14 to Skimmers), Ghost 41, Tempest 26, Salvage 22 (both with W15–22 deaths); all 30 together: median 55, mean 48.3. Skies (flyer lean 3.5 → 2.2, Carrier 3 → 2.5), Iron (lean 3 → 2.5, drawback +10% → +6% HP) and Ghost (Phantom lean 4 → 3) were softened after this; they were not re-measured. Tempest and Salvage lost their runs to early deaths that also happen in the baseline; worth a bigger batch.
- **The purse and extraction.** The default bot (`smartbot.js` without `PUSH`) extracts after a close call (core under 40% in the last 10 waves, or under 50% now) and otherwise 25% of the time once it has pushed twice. At 60 points it extracted in **7 of 8 runs** (Waves 61–83; the eighth died at 81), median wave 63. Its XP per minute of play was **27.1K against 26.1K** for the 5.3-style bot that always pushes on 5.7 rules, so progression pace is about where it was for a player who banks. A player who never extracts gets about **0.85×** the 5.7 XP (paid/raw 0.76–0.92 at 0 points); a long pushed run can pay more than 5.7 even after dying (×1.1–1.7 at 96 points, from many ×1.25–1.6 pushes).
- **Purse tuning history.** Safe share 50% and bounty ×1.25 paid a never-extracting bot 0.78× and the extracting bot 22K XP/min (−15%); 60% and ×1.5 brought it to the numbers above. `xpForLevel` is untouched (another builder owns it).

## Open issues
- **Wave shapes** (optional item 5) were not built: balance runs took most of the session on the shared machine.
- **60 points not re-measured on the final rules** (bounty ×1.5 and the softer zones don't change waves; trim 0.9 and the safer bot doors push it up a little from 75).
- **Per-zone batches are 3 seeds.** Tempest and Salvage read low from early deaths; Skies, Iron and Ghost were softened but not re-measured.
- **Narrow chip rows.** On 667 and 1180 wide screens the chip row only fits the threat chip plus "+N", so the bounty chip with the purse folds into "+N" (the Field Report lists it, with a tooltip line about the purse). The old "Bounty · W20" text is as wide, so it most likely folded there before 5.8 too. The bounty card and game-over card always show the purse. A permanent home (beside the score box) could be considered at merge.
- **splashshot.py** failed its "Nigel blinks twice" timing check at one size per run under heavy load (a different size each time); the splash is untouched by this branch.
- **Merging:** `hpMult` is now trimmed past W50 on 5.8 runs; anyone tuning HP should edit `hpMult0`. `addScore` banks only the safe share live; anyone touching XP flow should keep `G.xpRaw` (what 5.7 would have paid) and the purse split. Any new choice on boss waves should check `G.draft[0].twist`. `test/fixtures/rec_574.json` is replayed against 5.7.4 hashes: other branches' sim changes will make `hookcompat.js` drift after merge, and it should then be re-recorded from the merged base before 5.8 rules apply (`node test/hookcompat.js make` on that base).
- No version bump, WHATS_NEW or HANDOFF edits (per the rules). Suggested What's New line: "Zones and jump doors: pick a zone for each run and a new one at every bounty. Your Bounty Purse grows as you push; Extract to bank it. From Wave 50 every boss wave escalates the run.".
