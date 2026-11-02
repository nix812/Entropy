# Hook: zones, jump doors, the Bounty Purse and escalations (builder "hook", for 5.8)

Every run now has a reason to exist and a shape of its own. You pick a zone at the start, choose where to jump at every bounty, bank or risk a growing purse of XP, and from Wave 50 each boss wave makes the run stranger instead of only tougher.

## What the player sees

**Zones (internally "sectors").** The game already uses "sector" for the playable map area ("Sector expanding"), so players see them as *zones*. A zone sets which enemies come most, the weather that rolls in most, the event mix, the Most Wanted boss and its mutation, plus one perk and one drawback.

| Zone | Pitch | Enemies lean to | Weather | Events lean to | Most Wanted | Perk | Drawback |
|---|---|---|---|---|---|---|---|
| Quiet Drift (start zone) | Thin traffic and kind weather | Drones (fewer Juggernauts, Skimmers) | Cryo Front | Gold Rush, Meteors, Overcharge | Colossal Behemoth | +10% Credits | −10% score |
| The Hive | Brood nests on every lane | Swarmers, Splitters | Solar Flare | Swarm Tide, Rift Breach | Twin Hive Queen | +1 Chain, +15% Thermal | +10% enemy speed |
| Iron Reach | Juggernauts and Aegis walls | Juggernauts, Aegis, Reflectors | Static Haze | Elite Tide, Nanite Bloom | Armored Titan (from W30) | +15% armour piercing | +10% enemy HP |
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
- Each bounty claimed grows the purse ×1.25. Each push multiplies it by the door's tier.
- Extract banks the whole purse. If the core falls (or you abandon), you keep 30%.
- The purse shows on the HUD's bounty chip ("Bounty · W40 · Purse 12.3K"), on the bounty card with plain text, and on the game-over card ("you kept 30%, +1,500 of 5,000 XP. Extracting after X would have banked all of it").
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

Late health growth is trimmed to match: past Wave 50 the health curve's growth is raised to the power 0.92 (W60 ×0.85, W70 ×0.72, W90 ×0.49, W120 ×0.26 of the old health), so long runs end on twists and decisions rather than a pure health wall.

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
  - `claimBounty`: purse ×1.25, door offers from `G.r` on `G.huntChoice.doors`.
  - `huntPush(door)`, `enterSector(sid, tier)`, `huntExtract` (hk: banks via gameOver), `bankPurse()` (called first thing in `gameOver`; never pays in `ghostRun`). **Hotspot: one line in gameOver.**
  - `addScore`: on hk, `G.xpRaw` (what 5.7 would have paid), purse share, banked share.
  - `kill()`: escalation offer at W50+ boss waves, boon skipped on bounty kills and W50+; `twistOffers()`, `takeTwist()`, `takeBoon` routes twists.
  - `snapshotRun`/`resumeRun`: `hk, sector, tier, purse, xpRaw, twists, twistW, draft` (a pending boon or escalation now survives a resume). **Hotspot.**
  - `ACTS.push` takes the door index.
- **ui.js**
  - Setup: `setupSector`, `setupSectorHTML`, `sectorLine`, `sectorWantedName`; `launch` passes `sector`; Daily card and Daily launch pass `spec.sector`; action `sector`. **Hotspot: renderSetup (one line), launch (two lines).**
  - `openHunt` → `openDoors(C)` for hk runs (action `door` → `act('push', i)`). **Hotspot (openHunt, one line).**
  - `openDraft`: escalation card when the draft items are twists.
  - Bounty chip: `Purse N` instead of the push multiplier on hk runs.
  - Game over: purse outcome lines. Threat Board: zone, tier and escalations line.
  - Glossary: Bounty Purse, Zone, Jump door, Escalation.
- **template.html**: `.secs`, `.secb`, `.secnote`, `.pursebox`, `.dchoice`, `.hopt.door`, `.hopt.tw`, `.evchip i.pz`, and a short-screen rule that hides door pitches.

## Tests
- `node test/hook.js`: 36 checks (data, rules version, roster lean, purse split, bounty growth, doors, push/extract/death/ghost payouts, push without a door, refused door index, every twist's effect, twins once per wave, resume of zone/purse/twists/pending pick, old rules keep boons).
- `node test/hookcompat.js`: 5.7.4 recordings replay identically (fixtures in `test/fixtures/rec_574.json`; re-record only on old code).
- `node test/replay.js` (now 5 runs by default): the scripted player picks a zone, jump doors (and sometimes a plain push) and escalations. Runs 0 and 4 get a deterministic boost (credits, core, damage) through a non-enumerable `Hooks.log` hook that quiet replays keep, so they claim bounties and kill W50+ bosses.
- `python3 test/hookshot.py [W H]`: setup zone pick (and none on a fresh profile), bounty card with purse and doors, purse on the chip and clear of controls, escalation pick at W50, reload/resume keeps zone, tier, purse, twists and the pending pick, game-over purse text, Daily uses the day's zone.
- `test/trackcollide.py`: also checks the bounty chip (with purse) stays in the chip row, clear of every control, at all four sizes.
- `test/v53shot.py`: pushes through a jump door now.
- `test/smartbot.js`: picks zones (`SEC_PREF`), doors (risk by how comfortable the last 10 waves were), escalations (`TW_PREF`), and extracts after a close call or now and then after two pushes. `SECTOR=id` forces a zone, `PUSH=1` never extracts. New columns at the end of the table: `sec` (zone and doors), `ext`, `tw`, `xp57` (what 5.7 would have paid), `paid`.

## Balance
BALANCE_PLACEHOLDER

## Open issues
OPEN_PLACEHOLDER
