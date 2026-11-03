# Last Gradient: mechanics audit (November 2, 2026, at 5.7.4)

Three read-only reviews of the code, plus bot runs on a copy. They covered tower character (look and sound), talents and play-style progression, and the hook and run variety.

## Verdict
The game's identity is the swarm that adapts to you. Most of the systems meant to answer it only raise numbers. Every run follows the same calendar: content runs out by wave 30, and from wave 63 the waves only add health. The Hunt's central choice (Extract or Push) has an obvious answer. The towers look and sound alike because they share one impact sound and one effects budget.

## Tower character
- Every tower shares one impact sound, gated to 5 voices. Lens, Flame and Cryo use up that budget, so impacts from other towers are dropped (`hit()` in sim.js, `HIT.hit` in audio.js).
- `boom` is used for Missile, Cluster and EMP, and `zap` for Coil, Circuit and thunder.
- The muzzle flash is one pixel and lasts one frame. Recoil is on or off. No charge-ups, no tower shake, no hit-stop.
- Specs and Ascend never change effects or sounds; only the Gatling's sound reads `t.spec`. Pylon has no visual or sound; Forge has no sound.
- Bug: the Lens hum's ramp is `t.ramp / t.s.rampMax` (seconds divided by a multiplier); it should be `t.ramp / 4`.
- Character scores (out of 10): Missile 7, Rail, Coil, Lens and Gravity 6, Pulse, Cryo, Flame and EMP 5, Snare 4, Forge 3, Pylon 2.

## Talents and progression
- Of 64 talents, 7 change behaviour, 15 are procs and 42 are stat sticks. Rows force about 10 stat points per tree before anything interesting.
- `TAL_PT_DMG` (0.4% per point, about +73% at full spend) flattens specialisation.
- 9 of 22 Capstones define a play style (Marksman, Wildfire, Circuit, Glacier, Event Horizon, War Economy, Artisan, Tactician, part of Conflagration). 10 are stat trades.
- The first Capstone needs 20 points in one tree. Capstone slots open at levels 50 and 100.
- XP is 10% of score, so it comes in lumps: about 3–5 points after a first run, then 38 levels in one wave-81 run. All 12 towers open by best wave 30. Dead stretches run from level 21 to 50 and from 50 to 100.
- Void Lens did 83% of the damage in a 40-point bot run (damage per credit 7.5, next best 1.7). The cause is unlimited ×1.3 Ascends with multiplicative stacking, plus Singularity feeding it.
- In-run picks (Ascend, affixes, veterans, milestones, boons) are mostly automatic. Real choices: placement and resonance, specs, anomalies, the Market, Extract or Push.
- The C tree has no damage tower; Cryo deals 7.5 damage.

## Hook and variety
- Fixed calendar: enemy debuts, tower and boss unlocks, wormholes, assaults, bounties (every 20) and Overdrive (W35) are constants. The setup screen offers no run-defining choice.
- `genWave` caps: 65 enemies by W52, a 0.3 s gap by W63, 45% elites by W42, `geneCap` 3 by W45. After that only HP rises. In a 60-point bot log, 60–70% of waves after W31 had no decision.
- Extract or Push: score and XP go to the profile as they are earned, so dying after a Push loses nothing and pushing always wins. Trophies are counters.
- Swarm genes show as 1–3 pixel marks (Shell has none). The DNA readout is hidden behind the Threat chip. The strain codex caps at 400 entries and fills in one run.
- Boons, Anomalies and the Black Market are three overlapping pick-1-of-3 stat systems.

## Proposals (with code touch points from the reviews)
**Tower character:** per-tower impacts with their own voice budgets; distinct names for `boomT`, `empboom`, `pop` and `coil`; per-type muzzle flashes and recoil kick; charge-ups (Rail, Coil); spec variants for every tower; a continuous flame loop (`SFX.flames`, built like `beams`); Pylon link pulses; a Forge payout chime; small shakes for heavy hits. All cosmetic: render-only lists, `Math.random`, and no `G.r`.

**Progression:**
- A. Techniques: talents that unlock alternate fire modes per tower, such as Cryo Cold Lance, Rail Overcharge, Flame Backdraft, Coil Arc Fence and EMP Pulse Mines. Needs a `TOWER_FIRE` table, `t.fire`, `ACTS.fire` and snapshots.
- B. Rebuild the 10 stat Capstones into tower-family play styles. Change `TCAP` 20→12, `TROW` 5→3, `capSlots` to 25/60, and cut `TAL_PT_DMG`.
- C. Ascension perks: 1 of 3 tower-specific perks per Ascend, with the flat bonus cut to ×1.15. Uses its own offer stream, like `vetOffer`.
- D. Per-tower Mastery in `PROF.mastery`, weighted toward towers that weren't your top tower. Copy it into `G` at `newRun`.
- E. Named archetypes in the recap (no replay risk).
- Pacing: flatter XP (about score^0.75, or based on waves and bounties).

**Hook:**
1. Bounty Purse (S): each Push grows the purse ×1.4. Extract pays all of it; death pays 30%.
2. Sectors (M): a contract at run start, plus a choice of jump doors at each bounty that sets the next 20 waves (roster, storm, events). Replaces boons.
3. Late escalations (M): from W50, each boss wave offers 1 of 2 permanent twists. Trim `HPQ` to match.
4. A visible swarm (S): readable gene silhouettes, strain tints, an arms-race strip, and a finite codex with % complete.
5. A weekly mutator (S). 6. Wanted Relics (M–L). 7. Wave shapes (S–M). 8. Cut and merge Cash In, Relocation, Stabilize and Boons.

**Replay rules for all of it:** every player action goes through `act()`/`ACTS`; offers come from `G.r` inside the sim or from separate seeded streams; profile data passes into runs through `newRun` opts, never read from `PROF` inside the sim; run `node test/replay.js` after any sim change.
