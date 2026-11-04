# cards64: generated Anomalies (6.4, on top of 6.3.0 / 85b4b54)

Nic: "We need more entropy cards. They're starting to get repetitive. Can we somehow make this somewhat generative instead of
fixed rolls?" Built. Every Entropy draw now builds most of its cards fresh. The rule change is gated on `FR_VER = 4`
(`G.frV >= 4`). Runs recorded at frV 1–3 and Classic runs draw the 21 fixed cards exactly as before.

## What changed for the player

- **Most cards are new each draw.** A card pairs 1 boon with 1 cost. Both are sized so the card is a fair trade: the cost
  is worth about 80% of the boon. 33 boon parts and 20 cost parts make about 600 pairings, each with its own numbers.
- **Rarity.** Each generated card is Common (70%), Rare (24%) or Exotic (6%). Rare and Exotic chances grow by 10% per draw,
  up to +60%. Rare cards swing about 1.35× harder than Common. Exotic cards carry 2 boons (2 stat boons, or a special plus
  a stat boon). The specials are Fractal shards, random statuses on hit, and Entropy filling 2× faster. A card shows
  its rarity as a small tag and a frame colour: Common grey-white, Rare cyan, Exotic amber.
- **Later cards swing harder.** The budget grows 6% per draw (up to 5 draws) and by wave / 800 (up to Wave 120).
  A sixth draw at Wave 60 is about 1.4× the size of the first draw at Wave 1.
- **Classic cards stay.** Each of the 3 slots has a 1 in 4 chance to hold one of the 21 handmade cards. A Classic card
  never repeats in a run. It wears a purple frame and a "Classic" tag.
- **Cards lean toward your build.** Element damage boons follow the elements your attack towers use (by credits spent).
  An all-Kinetic build sees Kinetic boons in 86% of element boons. Crit boons need crit towers. Chill strength needs Cryo,
  Burn damage needs Thermal, Shock effect needs Arc, Mark chance needs Void.
- **No near-copies.** Cards in one draw never share a boon stat or a cost stat. A card never pairs a boon with its own
  opposite (tower cost down with tower cost up, core HP up with core HP down, shield up with No core shield).
- **Caps.** Each stat has a cap on what all the run's Anomalies add together (Classic cards count toward it). Examples:
  Damage +90%, Attack Speed +60%, Range +45%, one element +120%, Credits +60%, echo 25%, death blasts 20%. Costs have caps too: Damage −30%,
  enemy regen 2.5% per second, jam 5%, core drain 8% per wave, core max HP −50%. When a stat is at its cap it stops
  appearing. A card is never offered if no cost fits under the caps.
- **Names.** 2 words from lists keyed to the parts: a boon word and a cost word (Exotic cards sometimes use a grand noun).
  Examples: "Iron Bulk", "Rapid Gremlins", "Glacial Thaw", "Splintered Covenant". 104 boon words and 53 cost words.
- **Where cards show.** The draw modal (tag, name, every up line and cost line with numbers), the Pause list (Classic and
  generated, each tagged), the run recap, the log line. Dictionary › Anomalies starts with "How cards are made".
- **Codex.** Archive › Codex: "Generated N (Rare n, Exotic n) · Parts found x/53". It counts rarity and parts, never names.

### 10 example cards as the player sees them (seed 11, a Pulse/Rail/Cryo/Missile/Lens build)
| Tag | Name | Boon | Cost |
|---|---|---|---|
| COMMON | Piercing Lemons | Ignores 40% of Armor | Attacks have a 2% chance to jam |
| COMMON | Angry Tithe | +200% core Damage | −30% Credits |
| RARE | Volatile Malaise | Enemies explode on death for 15% of max HP | −20% Damage |
| COMMON | Orbital Haze | +65% ability power | −15% Range |
| COMMON | Iron Bulk | +40% Kinetic Damage | +20% enemy HP |
| RARE | Retrofit Rush | −35% upgrade cost | +15% enemy speed |
| CLASSIC | Echo Chamber | Towers have a 15% chance to attack twice | +25% upgrade cost |
| COMMON | Iron Fault | +45% Kinetic Damage | −30% core max HP |
| EXOTIC | Retrofit Bloom | −35% upgrade cost · +30% Damage | Enemies regenerate 1.5% HP per second |
| EXOTIC | Splintered Covenant | Bullets and missiles split into 2 shards · +25% chance to Burn | Core loses 5% HP each wave · +15% upgrade cost |

(The last two come from the screenshot runs. Another Exotic, seed 23: Spectral Engine, Hits apply a random status · +35 core shield / +150% Skimmers. `SAMPLE=<seed> node test/cards64.js` prints 10 more.)

## Code map

**data.js** (after `ANOMALIES`)
- `ANOM_RARITY` (name, colour, base budget `b`, weight), `ANOM_GEN` (classic share 0.25, drawback ratio `dr` 0.8, growth 0.06 per draw up to 5, wave / 800).
- `ANOM_UP` (33 boons) and `ANOM_DN` (20 costs). Fields: `k` stat key (`m` keys go through `computeMods`; `t: 'af'` parts
  go into `G.af` as value / 100), `p` power per unit (1 ≈ +1% Damage), `lo`/`hi` range on one card, `cap` run total,
  `st` step, `w` weight, `el`/`need` build tag, `grp` exclusion group, `sp` special (fixed, once a run), `words`/`nouns`.
- `ANOM_PART` (id → part with defaults `t`, `w`, `side` ±1; cost ids start with `-`), `ANOM_UPS`, `ANOM_DNS`,
  `ANOM_EXOTIC_NOUNS`, `ANOM_TXT` + `anomPartTxt(id, v)` (card lines; other keys reuse `STAT_TXT`, costs flip the sign).
- `FR_VER` 3 → 4 (the one-line edit shared with tower64).

**sim.js** (entropy section, after `stabilize`)
- `anomCount()` classic + generated (used by `entropyNeed` and the Rift orb bonus; unchanged for old runs).
- `anomTotals()` run totals per key from all Anomalies. `anomRoom(P, T)` room under the cap. `anomSize(P, power, room)`.
- `anomBuild()` element and crit shares of attack-tower credits. `anomWeight(P, B)` build bias.
- `anomGenCard(r, n, slot, B, T, used)` one card (rarity → budget → boon(s) → cost(s) → name). `anomOffersGen()` the draw.
- `takeGenAnomaly(o)` (called from `takeAnomaly` when the id matches a generated offer), `anomInfo(o)` display info for a
  classic id or a spec, `anomTaken()` everything taken.
- `computeAf` and `anomMods` add generated parts after the classic ones. `addEntropy` calls `anomOffersGen()` at frV 4.
- Run fields: **`G.ganoms`** (array of specs `{ id: 'g<draw><a|b|c>', name, r, up: [[part, v]], dn: [[part, v]], n }`).
  **`G.anomOffers`** at frV 4 mixes classic id strings and spec objects. `G.anoms` still holds classic ids only.
  `act('anom', id)` is unchanged: it takes a classic id or a generated id.
- Hotspots (small edits): `newRun` (`ganoms: []`), `snapshotRun`/`resumeRun` (`ganoms`, default `[]`), `gameOver` run log
  `end.gan` (names), `defaultProfile` codex `gen: { n, r: [c, r, e], parts: {} }` (old profiles get it through the
  existing codex merge in ui.js). Run log: `rlog('anom', { id, g: { name, r, up, dn } })`.

**ui.js**: `openAnomaly` renders `anomInfo` per offer; the `anom` click handler looks up the offer before `act`; Pause list
uses `anomTaken()`; `#entCount` uses `anomCount()`; `runRecord.anoms` appends generated names (the recap prints unknown
ids as-is); `codexHTML` line; Dictionary row. **template.html**: `.arar` tag, `.boon.anomaly[style]` frame colour from
`--ac`, `.boon.ar-exotic` double frame. No new modal, no new text inputs, nothing on the battlefield.

**smartbot.js** (`botAnom`, `anomVal`): a generated card scores boon power minus cost power, an element part counted by
that element's share, crit parts by the crit share, ability/storm/fill at half, ±6 noise. Classic cards get a flat guess
(6–20). A best score under −5 stabilizes; the old 20% random Stabilize stays. `ANOMPICK=rand` restores the random pick.

## Tests
- **`node test/cards64.js`** (new, 28 checks): frV 4 recorded; frV 3 and Classic runs draw only classic ids with exactly
  3 dice rolls per draw; same seed and picks → identical offers and mods over 10 draws; 1,062 generated cards on 60 seeds:
  every value on its step and in range, every line has a number, cost/boon power 0.55–1.00 (median 0.80), no offer with
  2 cards on one boon stat, rarity mix 67/27/6%, classic share of slots 26%; caps hold after 30 stacking draws on 3 seeds;
  build bias (Kinetic 86%); effects reach `G.mods` and score; run log holds the whole card; codex counts parts not names;
  snapshot/resume keeps cards and the open offer, and a 6.3 snapshot resumes; the frV 4 fixture replays bit for bit.
- **`test/fixtures/rec_640_fr4.json`** + `test/cards64_mkfix.js`: a frV 4 Frontier run to Wave 32 with 3 generated cards,
  a Stabilize and a start-of-run boost (Entropy Engine, +4000 credits, +300% damage, set by the same 'Run started' hook).
  **Regenerate it only if generation rules change on purpose** (any change to `ANOM_*` tables reshuffles the draws).
- **`python3 test/cards64shot.py`**: draw modal at 667×375 and 1180×820 with a Classic and Rare/Exotic cards, colours,
  numbers, no overflow, tap to take through `act()`, Pause list, codex. Screens `test/out/c64_draw_*.png`,
  `c64_draw2_*.png` (with an Exotic), `c64_pause_*.png`.
- Changed tests: `test/qola.js` check 1 now accepts `FR_VER >= 3` (it hard-coded 3); `test/frontier.js` Daily boost
  +1500% → +3000% damage (frV 4 draws reshuffle the dice and seed 4 lost to the Wave 20 bounty; same fix as 6.2).
  `test/harness.js` exports the new functions in a second `Object.assign` line (separate from the long export line).

## Balance
Smartbot `FR=1`, Normal, 8 seeds per batch, frozen copies of src (pitfall 26). 0 points: best wave 40. 60 points: best wave
80. "Random pick" (`ANOMPICK=rand`) picks a card at random, like the old bot, so it compares card power with the 21
classics. "Smart pick" is the new bot scoring (`botAnom`). Waves reached, sorted:

| Batch | 0 points | Median | 60 points | Median |
|---|---|---|---|---|
| 6.3.0 baseline (85b4b54), classic cards, random pick | 31 40 41 41 47 52 55 64 | **44** | 22 40 61 61 62 62 62 67 | **61.5** |
| cards64 final, random pick | 23 32 41 41 41 48 61 63 | **41** | 61 62 62 62 62 75 80 123 | **62** |
| cards64 final, smart pick | 31 32 39 41 48 51 65 72 | **44.5** | 41 65 81 82 82 84 84 84 | **82** |
| first draft (looser caps), random pick | 23 41 41 41 41 53 61 62 | 41 | 32 50 63 65 84 108 142 162 | 74.5 |
| first draft, smart pick | 30 32 36 50 62 62 63 66 | 56 | 41 61 62 63 70 83 86 143 | 66.5 |

- **Card power matches the classics.** With random picks the final cards land at 41 / 62 against 44 / 61.5 (inside bot
  noise, pitfall 16).
- **The first draft was too strong late.** Its 60-point runs reached 108–162 waves, all on Void Lens builds (66–85% Void
  damage). The build bias kept offering Void damage boons at the old price (0.5 power per %) up to +180%. The fix: element
  boons cost 0.8 per % (cap +120%), Damage cap 90%, Attack Speed cap 60%, Credits 1.0 per % (cap 60%), echo cap 25%, death
  blasts 1.6 per % (cap 20%), budget growth 6% per draw up to 5 draws and wave / 800.
- **Choosing well pays at 60 points** (82 with smart picks against 62 random). The old bot never chose, so the baseline has no
  "smart" row to compare. A player who reads the cards gets a stronger run than one who taps at random. That is the point
  of generated cards, but watch Nic's runs: if late runs feel easy, raise `ANOM_GEN.dr` (0.8 → 0.9) first.
- The container restarted during the second batch; the final rows mix `par.sh` (smart 60) and a 4-at-a-time runner (the
  rest). Same seeds and settings.

## Open issues and risks
- Bot numbers are noisy (±10 waves on 8 seeds); the random-pick control is the fair comparison of card power.
- Powers per part are estimates. Ability power, storm effects and core Damage depend on play style. If Nic sees one
  part feel dead or broken, change its `p` (or `w`) in `ANOM_UP`/`ANOM_DN`. Any table change reshuffles frV 4 draws, so
  regenerate `rec_640_fr4.json` with `node test/cards64_mkfix.js`.
- Merge: `FR_VER` line identical to tower64. `qola.js` check 1 and `frontier.js` boost may also be touched by tower64.
  smartbot.js: the Anomaly line and a new block before `const agg = [];`.
- A resumed snapshot always plays at the current frV (existing behaviour); a 6.3 snapshot with an open classic offer
  works (tested).
- No one-time teaching card: the existing "Entropy full" card still fits. The Dictionary explains rarity.
- Definition of done (final code): audit n and ipadA `ERRORS: []`, uiaudit, trackcollide, splashshot `FAILED: []`,
  `replay.js` all replays match, qola 28/28, frontier 92/92, cards64 28/28, cards64shot clean, hookcompat, ascend and
  tutorial replays match. One earlier `audit.py n` run timed out on `#bEnt` (a modal intercepted the tap under heavy bot
  load). It passed on rerun and in the final suite.
