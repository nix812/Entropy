# Combined balance pass (branch `balance`)

Cut from `release` at 1316744 (towers, swarm, hook, talents and ascend merged). Number changes only, plus one crash fix. Every changed number that old recordings use is gated behind the 5.8 rules flag `G.ascV >= 2` (perk runs), so 5.7 recordings replay unchanged.

## What the player will notice
- **The Void Lens builds up less.** It ramps to ×2.26 (was ×2.8). Event Horizon ramps to ×3.3 (was ×4.3), Prism Split to ×2 (was ×2.5). The spec cards show the new numbers.
- **The Lens Marks less, and its Collapses hit softer.** Every Mark chance on a Lens counts at 35% (the panel's "Mark %" line shows the real value; the Brand perk card shows its real bonus, +5% / +9%). Collapses a Lens sets off deal 35% of the usual damage.
- **Collapse is weaker on everyone.** Its max-HP part is 2% of each nearby enemy's max HP (was 3%). Bosses and assault units are unchanged (0.4%).
- **Lens Ascends add ×1.08 Damage** (other towers keep ×1.15). The Ascend button and both Help lines say so.
- **Talent points add +0.1% Damage each** (was +0.15%). The Talents screen reads the constant, so its text updates itself.
- **Fixed a crash:** past Wave 320, bosses rolled more elite affixes than exist and the game froze (`spawnBoss`). Seen in a bot run that reached W320.

## Why the Lens dominated (what the bots showed)
The ramp was not the main cause. A damage log by source (60 points, two Lens-heavy seeds, to W100) put **about 99% of all tower damage on max-HP effects**: Collapse 65–75% (nearly all of it credited to Lenses), Detonator about 20%, direct hits under 1%. Late enemy HP outgrows raw tower damage, so whatever deals a share of max HP carries the run. Collapse fires on any Void hit against a target at full Marks with another status. The Lens hits 10 times a second, so it set off almost every Collapse, including on targets that other towers had Marked. It also applied Marks ten times faster than any other tower, from the same per-hit chances.

Ramp and Ascend changes alone (ramp bonus ×0.6, or Lens Ascend ×1.08) left the Lens at 41–56% median. Halving Collapse for everyone also left it in place: Collapse and Detonator just split the max-HP work as before. The fix has to cut the Lens's own share of Collapses (markX, collX), and then its direct damage (rampX, Ascend ×1.08). Once Collapse was trimmed, direct damage at full ramp became the next engine.

## Numbers changed (old → new)
| Where | What | Old | New | Gate |
|---|---|---|---|---|
| `TOWERS.lens.markX` (data.js, new) | Lens Mark chance multiplier (all sources, incl. Prism legendary forced Marks) | 1 | 0.35 | `G.ascV >= 2` |
| `TOWERS.lens.collX` (data.js, new) | Collapses set off by a Lens, damage multiplier | 1 | 0.35 | `G.ascV >= 2` |
| `TOWERS.lens.rampX` (data.js, new) | Lens ramp bonus multiplier (base ×2.8 → ×2.26, EH ×4.3 → ×3.31, Prism ×2.5 → ×2.05) | 1 | 0.7 | `G.ascV >= 2` |
| `ASC_DMG_T.lens` (data.js, new) | Damage per Lens Ascend | ×1.15 | ×1.08 | `G.ascV >= 2` |
| `COLLAPSE_HP.mob` (data.js, new; was inline in `applyStatuses`) | Collapse max-HP part, non-boss | 3% | 2% | `G.ascV >= 2` (`old` 3% otherwise) |
| `TAL_PT_DMG` (data.js) | Damage per talent point spent | 0.15% | 0.1% | none (talent numbers are profile data; old recordings spend no points) |
| Lens spec text | Event Horizon / Prism Split | ×4.3 / ×2.5 | ×3.3 / ×2 | text |
| Brand perk text | shows effective chance | +15/+25% | +5/+9% | text |

Code: `towerStats` (sim.js: `s.markX`, `s.collX`, rampMax line, Ascend power), `applyStatuses` (forced Mark, Collapse line), `spawnBoss` (affix loop guard), ui.js line ~900 (Ascend button) and the two Ascend Help lines. `test/smartbot.js` gained `MAXW=n` (stop a run at Wave n, counted as n) so runaway runs don't stall a batch.

## Results
Bots: `smartbot.js`, Normal, COLS 48, start 1, best 80, `PUSH=1` (push at every bounty), frozen copies of `src`, 2 processes at a time, 8 seeds per row. A run that hit the wave cap counts as the cap. Treat ±10 waves and ±15 points of Lens share as noise: the same 8 seeds moved 25 waves and 16 points between two near-identical configs.

| Batch | 0 pts median | 60 pts median | 96 pts median | Lens share, median (mean) |
|---|---|---|---|---|
| Baseline 5.3 (brief) | 57 | 72 | 92 | |
| **Before**: merged `release` (cap W200) | 52 | 112 | 107.5 | 0: 19% (32) · 60: 72% (66) · 96: 81% (65) |
| Step 1: markX/collX 0.5, Collapse 2% (cap 150) | | 86.5 | 146.5 | 60: 30% (37) · 96: 57% (52) |
| Step 2: + markX/collX 0.35, `TAL_PT_DMG` 0.1 (cap 150) | 55 | | 122.5 | 0: 12% (13) · 96: 52% (46) |
| Step 2 + Lens Ascend ×1.08 (cap 120) | | | 102 | 96: 52% (50) |
| **After (shipped)**: + rampX 0.7 (cap 120) | 55¹ | **106** | **92** | 60: **40%** (35) · 96: **40%** (40) |

¹ Measured at step 2. The ramp and Ascend changes only touch Lenses at LV 5+ and Lens share at 0 points was 12%, so 0 points should barely move.

Waves per run, shipped numbers: 60 points 47, 55, 79, 92, 120, 120, 120, 120 (four at the cap; Lens 3/58/3/58/28/71/53/4%); 96 points 71, 80, 85, 90, 94, 120, 120, 120 (three at the cap; Lens 1/65/10/35/45/57/81/22%). 60 points reading above 96 points is noise. Both sets have runs at the cap, so the bots can't separate them.

**Per-tower damage share at 60 points, shipped numbers** (median / mean across 8 runs): Lens 40/35, Rail 12/25, Gravity 11/13, EMP 0/8, Coil 0/5, Missile 2/5, Cryo 3/4, Pulse 0/3, Flame 0/2, Forge 0/0. (Step 1: Lens 30/37, Rail 10/20, EMP 8/12, Missile 4/12, Gravity 2/6, Pulse 4/4, Cryo 4/4, Coil 2/2, Flame 2/2.) At 96 points, shipped numbers: Lens 40/40, Rail 12/17, EMP 4/12, Gravity 8/11, Missile 4/6, Pulse 2/5, Flame 2/4, Coil 2/4, Cryo 2/2. At 0 points (step 2): Missile 22/25, Rail 24/24, Lens 12/13, EMP 10/10, Coil 9/10, Pulse 6/8, Flame 3/6, Gravity 1/3, Cryo 2/1.

## Open issues
- **Difficulty at 60 points is still above target** (median 106 against 72–82; half the runs hit the W120 cap). 96 points landed at 92, the bottom of its range, and 0 points at 55. The runs that go long are max-HP engine runs (see the next point). Trimming more raw damage (row-1 talents) would mostly hurt the runs that already end at W50–90. The next step is a Detonator or Collapse-frequency change, measured with 12+ seeds and a W200 cap.
- **Lens share is bimodal.** Most runs sit at 1–45%, but 2–3 runs in 8 still reach 57–94% (always the same seeds, 1, 3, 5 and 6; maps where Lenses cover a merge point). Median and mean are under 45%; the long tail is not gone.
- **The late game is still decided by max-HP effects** (Collapse, Detonator). Any of them that fires fast enough makes a run endless, and HP curves don't touch them. The next lever would be a per-enemy Collapse cooldown or a Detonator trim, both new rules. Not done here.
- **Capstone spot-check not done.** The timeline was cut. The talents builder's 40-point numbers (71–134) were measured before these trims. Collapse and Lens changes should pull Cryo Artillery (134, Lens 69%) and Blackout (116) toward the pack. Nothing here buffs Ricochet (71) or Gravity Garden (73).
- **Traps:** at 60 points Flame, Coil and Cryo deal 2–4% median. The bot builds them early and sells them for gene answers late, so its share undersells control towers. Not a sign they are useless, but worth a `FORCE=` check.
- Browser tests were not rerun. The UI touch is text only: the Ascend button multiplier, two Help lines, two spec descs and the Brand perk text.

## Tests
`python3 build.py`, then in test/: `node replay.js` (all replays match), `node hook.js` (FAILED: []), `node hookcompat.js` (old recordings match), `node techniques.js` (127 passed), `node ascend.js` (all pass, v574 recording exact), `node fixes.js` (all ok).
