# tut66 (6.6.0): Basic Training revamp

Builder tut66, branch `tut66` from release bfffd7e (live 6.5.2).
Nic: "Do we want to do a full tutorial run revamp too? I think it needs to go over the probe and be more comprehensive so a
player is set up for success on their first run." A friend on 6.2: "you get spammed with dialog boxes… it's hard to get into
the game and get connected with it when you're spamming new dialog every couple of seconds."

## 1. Audit of the 6.5.2 Training (before any change)

Played start to finish with `test/tut66.py --audit` (a scripted new player: taps what the coach points at, taps Got it /
Next, otherwise lets the game run) on a fresh profile at 667×375 and 1180×820. Both sizes gave the same cards in the same
order (1180×820: 676 s of play; 667×375: 684 s). Times are seconds of play (`G.time`, which stops while a card holds the
game). "held" = the card pauses the game; "line" = a coach line while the game runs.

| s | Wave | Lesson | Step | Kind | Card | Teaches |
|---|---|---|---|---|---|---|
| 0 | 0 | start | core | held | Your core | the core, losing |
| 0 | 0 |  | hp | held | Core health | health + shield |
| 0 | 0 |  | road | held | The road | wormhole, road |
| 0 | 0 |  | spots | held | Build spots | green tiles, wormhole radius |
| 0 | 0 |  | build1 | held | Build a tower | tile → card → Build |
| 0 | 0 |  | call1 | held | Start the wave | Next, early-call bonus |
| 22 | 1 | camera | camera | held | Look around | pan, pinch, edge arrows |
| 44 | 1 | money | credits | held | Credits | kills pay |
| 44 | 1 |  | score | held | Score | score → XP |
| 55 | 1 | power | build2 | held | A second tower | building again |
| 55 | 1 |  | power | held | Power | ⚡ cap |
| 56 | 1 |  | call2 | line | Wave 2 | |
| 101 | 2 | upgrade | tapTower | held | Upgrade | tap a tower |
| 101 | 2 |  | upgrade | held | The Upgrade button | price, tap |
| 101 | 2 |  | upDone | held | Upgraded | LV, numbers, affix |
| 101 | 2 |  | affix | held | Its bonus | Details tab |
| 101 | 2 |  | affixes | held | Affixes | rarity, reroll |
| 102 | 2 |  | call3 | line | Wave 3 | |
| 124 | 3 | rank | rank | held | Ranking up | level bar, LV 3 / 5 |
| 124 | 3 |  | upWhy | held | Why upgrade? | power vs credits |
| 148 | 3 | threat | threat | held | Threat Board | the chip |
| 148 | 3 |  | jugg | held | Juggernaut | Plated, Rail pierces |
| 148 | 3 |  | rail | held | Build a Rail Lance | the counter |
| 149 | 3 |  | call4 | line | Wave 4 | |
| 170 | 4 | lift | lift | held | Lift Off | the core flies |
| 170 | 4 |  | pick | held | Pick a landing spot | framed towers dock |
| 170 | 4 |  | preview | held | The preview | road length |
| 170 | 4 |  | land | held | Land and dock | roads swing |
| 173 | 4 |  | docked | held | Docked | 6.5.2 rule: two guns |
| 173 | 4 |  | links | held | Links | +10% per link |
| 195 | 4 | move | mvTap | held | Move a tower | |
| 195 | 4 |  | mvBtn | held | Move | 10% fee |
| 195 | 4 |  | mvPick | held | Its new tile | link reach |
| 195 | 4 |  | mvGo | held | Move here | 4 s offline |
| 199 | 4 |  | moved | held | Linked | move, don't sell |
| 221 | 4 | inspect | inspect | held | Inspect | tap an enemy |
| 221 | 4 |  | inspected | held | Enemy panel | |
| 235 | 4 | arrow | arrow | held | The upgrade arrow | the arrow cue |
| 235 | 4 |  | up2 | held | Upgrade it | |
| 235 | 4 |  | up2Done | held | Stronger | |
| 236 | 4 |  | call5 | line | Wave 5 | |
| 247 | 5 | strike | strike | held | Orbital Strike | abilities |
| 247 | 5 |  | aim | held | Aim | |
| 248 | 5 |  | recharge | line | Recharging | cooldown bar |
| 258 | 5 | vets | ready | held | Veterans ready | Ready button |
| 258 | 5 |  | vpick | held | Pick a mutation | (modal) |
| **258** | 5 | **evo** | evo | held | The swarm adapts | **0 s after vets** |
| 258 | 5 |  | arms | held | Arms Race | (modal) |
| 258 | 5 |  | counter | held | Answer it | build Cryo |
| 258 | 5 |  | call6 | line | Wave 6 | |
| 280 | 6 | core | tapCore | held | Upgrade the core | |
| 280 | 6 |  | shield | held | Shield | |
| 280 | 6 |  | battery | held | Battery | |
| 280 | 6 |  | coreMore | held | Hull and Uplink | |
| 302 | 6 | mark | mark | held | Gene marks | |
| 315 | 6 | spec | tapLv3 | held | Specialize | |
| 315 | 6 |  | toLv3 | held | To LV 3 | |
| 315 | 6 |  | spec | held | Pick a spec | |
| 315 | 6 |  | ascend | held | LV 5 and Ascend | |
| 315 | 6 |  | sell | held | Sell | |
| 338 | 7 | wanted | free | line | Most Wanted | bounty chip |
| 543 | 9 | boss | boss | held | Behemoth | |
| 684 | 9 | bounty | bounty | held | Bounty claimed | Extract |

Modals: Threat Board (148 s), Ready walkthrough (258 s), Threat Board again (258 s), the bounty (684 s). Alerts and tips:
LIFT OFF, ORBITAL STRIKE, VETERANS, SPEED 1× and BOSS HALFWAY (the Behemoth reached half the road at 100% HP).

**Summary (6.5.2):** 63 coach cards, 60 of them hold the game, in 20 lessons. 684 s of play; with 4 s to read each held card
a new player needs about **15.4 minutes**. Shortest gap between lessons **0 s** (vets → evo: the "countdown almost out" rule
let a second lesson go at once), median 22 s, 6 lessons less than 15 s after the one before. Checklist: 15/15 lines tick.

**Gaps (what a player still has to learn alone in the first real run):**
- **The probe**: not in Training at all (no probe, no loot sites). The button, command bar, cargo, guards and recall are
  only in a one-time card.
- **Fog of war**: Training has none. The first real run shows dark ground with no explanation for 20+ s.
- **Entropy cards**: the gauge is hidden in Training. Generated cards, rarity, boon/cost and Stabilize are never shown.
- **Boss music**: the boss fight has a theme, but nothing says so (or where to switch it off).
- **What next**: the end card says nothing about talents' capstone tier towers, the Daily Hunt or how often bounties come.
- Not in Training (by design, still a real-run card): storms, salvage crates, Overcharge, wormholes, the Exchange, support
  towers, the Black Hole.

**Problems:**
- Too long: 15 minutes, and the last 5 of them (W7–W9) teach one line (Most Wanted). W7–W8 are 206 s of waiting.
- Too many held cards: 60. The opening alone is 6 held cards before anything moves. Several are pure reading
  (Score, Ranking up, Why upgrade?, Gene marks, LV 5 and Ascend, Sell, Enemy panel).
- Stacking: three lessons at 258 s (vets, then the swarm adapts, with the Threat Board opened a second time).
- The boss walks half the road untouched, then the fight drags (140 s).
- The core comes late (W6), after Lift Off already said "Battery".
