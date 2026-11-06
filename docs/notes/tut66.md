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
| 55 | 1 |  | power | held | Power | power cap |
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

## 2. The new Basic Training (6.6, "v2")

One guided first run, in the order a player meets things. A lesson is one idea: a short chain of cards where the player does
the thing and the card moves on. Read-only notes are coach lines while the game runs (no pause, a Got it button).

| s 667×375 / 1180×820 | Wave | Lesson | Held | Lines | What the player does / learns |
|---|---|---|---|---|---|
| 0 / 0 | 0 | Start | 4 | 0 | Your core (health, shield, losing) · Road and build spots (green tiles, wormhole radius) · build a Pulse Blaster · tap Next (early-call bonus) |
| 22 / 22 | 1 | Look around | 1 | 0 | pan, pinch, edge arrows, the core arrow (ends on a drag) |
| 44 / 44 | 1 | Credits | 0 | 1 | kills pay; score becomes XP |
| 57 / 57 | 1 end | Power | 2 | 1 | a second tower; power full; Power Nodes in real runs |
| 103 / 102 | 2 end | Upgrade | 4 | 1 | tap a tower, Upgrade, what changed (credits, not power), Details: affixes; the upgrade arrow |
| 125 / 125 | 3 | The core | 2 | 1 | tap the core, upgrade the Battery (its gun hits harder and sees farther); Shield, Hull, Uplink in one line |
| 158 / 158 | 3 end | Threat Board | 3 | 1 | the chip, Juggernaut is Plated, build the counter: a Rail Lance |
| 180 / 180 | 4 | Lift Off | 4 | 1 | Lift Off, pick the Rail Lance, the new road, land. 6.5.2 rule: the core's own gun keeps firing; the docked Rail Lance is a second gun (×2 damage, +1 range). Links (+10% damage and rate) as a line |
| 205 / 205 | 4 | Move | 4 | 0 | move a tower into link reach (10% fee, cheaper than selling) |
| 240 / 240 | 4 end | Veterans | 2 | 1 | the Ready button, pick a mutation |
| 252 / 252 | 5 | Strike | 2 | 1 | Strike a tight pack, aim; the cooldown bar as a line |
| 265 / 265 | 5 | **Probe** | 3 | 2 | tap Probe (selected: every map tap sends it; Probe again lets it go; Home and Upgrades show under it), tap the wreck to send it, it salvages 2.5 s into its hold (line), Home, banked at the core (+160, line: it repairs the core; a lost probe drops its cargo) |
| 298 / 298 | 6 | **Fog of war** | 3 | 1 | a guarded wreck far out (one red drone): send the probe. On the way: Fog of war (black = unexplored; on dim ground enemies are hidden); Fair warnings as a line (bosses, roads, edge arrows, Threat Board). Get out: Home (the drone shoots while it stays; Upgrades buys a Lance that shoots back) |
| 341 / 341 | 7 | **Entropy** | 1 | 1 | the gauge is full: tap it. In Training the draw's header line teaches boon (green), cost (red) and rarity (frame: Common, Rare, Exotic); Stabilize explains itself. Then a line: it lasts the run, the next gauge is 30% longer, Pause lists them |
| 363 / 363 | 7 | Specialty | 3 | 0 | the strongest tower to LV 3, pick a spec |
| 385 / 386 | 7 | Most Wanted | 0 | 1 | the bounty chip: a boss on Wave 8 |
| 433 / 431 | 8 | **Boss** | 1 | 0 | the Most Wanted (Hasted) Behemoth: Plated, huge health; every boss has its own theme music; bosses always show, even in fog |
| 514 / 502 | 8 | Bounty | 1 | 0 | Extract banks the purse (jump doors in real runs; you keep 30% if you fall later) |
| end | | **What's next** | end card | | XP, level, talent points; Real runs (endless, the first bounty on Wave 20), Talents (16 points in one tree unlock a new tower), Daily Hunt, Field Manual |

Totals (final run on the 6.5.4 merge, test/tut66.py, scripted new player, 4 s to read each held card): **18 lessons, 53
coach cards (44 held, 9 lines), 4 modals**; 508 s of play at both sizes; **estimated 11.4 minutes** at 1× at both sizes.
Gap between lessons: **min 12.1 s, median 22.5 / 22.8 s**; between dialogs (first held card of a lesson, or a modal the
coach did not open): min 12.1 s, median 33.3 / 33.2 s. tutcadence at 852×393 (3 s per card): 18 lessons, 495 s of play,
about 10.3 minutes, shortest gap between lessons 10.1 s, median 22.2 s. 6.5.2 for comparison: 20 lessons, 63 cards (60 held), 15.4 minutes, min gap 0 s, median 22 s.

**Checklist (17 lines, in lesson order):** Place a tower · Call a wave early · Upgrade a tower · Read its bonus · Core:
upgrade the Battery · Counter it: a Rail Lance · Lift Off: dock on a tower · Link towers to the core · Move a tower ·
Veteran: tap Ready, pick · Use Strike · Probe: loot a site, bank it · Probe: a guarded site in the fog · Entropy: take a
card · Pick a specialty (LV 3) · Beat the bounty boss · Extract. Every line ticked at both sizes, each on its own lesson.

### Design choices
- **Order.** The core and its Battery now come before Lift Off (6.5.2's rule makes the docked tower a *second* gun beside
  the core's own, so the core's gun should be known first). Veterans moved to the end of Wave 4, before Strike, so no two
  lessons share one break (6.5.2 had vets and "the swarm adapts" at the same second). The separate second-upgrade lesson
  (the upgrade arrow) is gone: it landed 9 s after Strike. The arrow is one line in Affixes, and the specialty lesson
  upgrades again.
- **Cut or folded** (each is still taught where it matters in a real run): Score (folded into Credits), Core health (into
  Your core), Build spots (into Road), the preview card (into Land), Ranking up and Why upgrade? (into Upgraded), Shield (no
  longer an action: one line), Inspect (the idle line says "Tap an enemy to inspect it"), the swarm adapts / Arms Race /
  counter / gene marks (the real-run evolution intro now shows, since Training no longer marks `seenEvo`), LV 5 and Ascend,
  Sell (Move says it is cheaper), Moved/Linked (into Move), the second upgrade (arrow line in Affixes).
- **Pacing.** Same rules as 6.2 (`PACE_GAP` 22 s of play, or a wave end with 10 s since the last card, a calm moment, the
  Strike pack waits 12 s). One fix: the "countdown almost out" rule now also needs 12 s of play since the last card, so two
  lessons never land back to back. Read-only notes (Credits, Affixes, Shield/Hull/Uplink, Links, Recharging, Salvage,
  Banked, Fair warnings, Anomaly taken, Most Wanted) are coach lines while the game runs, not held cards.
- **Shorter.** 8 waves instead of 9 (the old Wave 8 taught nothing). The Most Wanted is now **Hasted** (35% faster) with
  700 health: the old Colossal crawled half the road out of every tower's reach and the fight took 140 s; now about 80 s.
- **The probe first site is guard-free and close** (8.5 tiles from the core, visible), the second is far out in the fog with
  one drone. The script marks a small patch around the second site as explored (dim), so the wreck and its drone are
  visible from home; the rest of the way is black fog. Site values are set (160 and 220 credits, no jackpot), so the
  specialty is affordable for everyone.
- **The Entropy draw is fixed in rarity** (Common, Rare, Exotic, no Classic), so every player sees all three frames. The
  cards themselves are still generated from the run (they lean toward your towers). On a phone the draw fills the screen,
  so the draw's own header line teaches it in Training instead of a coach card on top.
- **Black Hole: no scripted moment.** It is rare (from Wave 10, about 1 wave in 20), it lasts 40–50 s, and the only answer
  is moving towers, which Training already teaches. Its own intro card skips the 30 s queue, shows every number and comes
  with an alert and an edge arrow. Scripting one would add about a minute and push Training past 12 minutes.
- **Boss music.** The Training boss already plays its theme (the music module runs in Training). The boss card now says
  every boss has one.
- **Fog in Training** is on from the start, as in real runs. The core sees 16 tiles, so the home area is clear; only the
  far ground and the first tiles of the road are in fog.
- **Skip and replay.** Skip Training (two taps) and Basic Training from the Tutorial button and the Field Manual work as
  before. The offer, the chooser and the manual now say "about 10 minutes".

### Intro cards in the first real run
`openTutDone` and Skip call `markTaught(Coach.taught())`: every lesson the player passed marks its first-time card seen.
- Taught → no card: WELCOME (`seenHelp`), LOOK AROUND (`zoomHint`), Upgrades (`upg`), Power full (`power`), Lift Off
  (`frontier`), Abilities (`abil`), Veterans (`vet`), Probe (`probe`), Fog of war (`fog`), Entropy full (`anomaly`), Boss
  next wave (`boss`).
- Not taught → still one card each: the swarm evolution intro (`seenEvo` is no longer set by Training), storms, salvage
  crates, spare power / Overcharge, wormholes and checkpoints, the Exchange, support towers, the Black Hole, Strain Assaults,
  capstone tier towers, Techniques, new enemies and each boss's first-encounter card.
- Skip marks only the lessons passed so far.

## 3. Code map

Rules gate: **Training only.** The new sim behaviour lives in `TUT.b2` (data.js) and is used only by Basic Training started
with `newRun({ tut: 2, frontier: 1 })` (what the UI starts now: `TUT.v = 2`). Field Manual lessons and `tut: 1` recordings
get the old spec (`v: 1`). Normal runs, Daily Hunts and old recordings are unchanged (`node test/replay.js`, hookcompat,
cards64, tower64, probe65, sky65, frontier fixtures all match). No `FR_VER` bump.

- **data.js** (Training block): `TUT.v` 1 → 2. `TUT.b2` (on top of `TUT.fr`): `probe`, `fog`, `grant { 3: 140, 4: 120 }`,
  `vetAt 5`, `ent { w: 8, r: [0, 1, 2] }`, `sites` (2 entries: `n, w, k, dx, dy, val, g`), `boss { behemoth, hasted, 700 }`,
  8 `waves` (TUT.fr's script without the gene groups and without its filler Wave 8).
- **sim.js**
  - `tutSpec(id, fr, v)`: merges `TUT.b2` for Basic Training at v ≥ 2 and sets `T.v`. `newRun` passes `opts.tut` (**hotspot,
    one argument**). `newRun` probe line: `(!T || T.probe)` (**hotspot, one condition**).
  - `fogOn()`: `(!G.tut || G.tutS.fog)`.
  - `tutSetup`: `G.siteT = 1e9` when `T.probe` (no random sites).
  - `prepareWave`: one line calls `tutScript(tutIdx(w))`; the Veteran grant line falls back to the highest-level attack
    tower at `G.tut >= 2` (the core gun can do every kill on this small board, so `topTower()` can be empty).
  - New, after `tutHold`: `tutScript(k)` (spawns scripted sites, fills the gauge once: `G.tutEnt`), `tutSite(sp)` (a site at
    a set spot, set value, drone guards, `jp: 0`, `s.tut = n`; marks a 2.6-tile patch explored; flags `G.tutSites`).
  - `siteDone`: one line sets `G.tutLoot` bit `s.tut`.
  - `addEntropy` → `anomOffersGen(rar)`; `anomOffersGen(rar)` skips classics when `rar` is given; `anomGenCard(..., ri0)`
    takes a forced rarity (no `G.r` draw for it). Without the argument (every normal run) the draws are identical.
  - `takeAnomaly` / `takeGenAnomaly`: no profile codex writes in Training (also true now for the Storms lesson).
  - New run fields (Training only, never in snapshots since Training never snapshots): `G.tutSites`, `G.tutLoot`, `G.tutEnt`.
- **ui.js**
  - Coach `PLANS.basic` rewritten (lesson tags `start camera money power upgrade core threat lift move vets strike probe fog ent
    spec wanted boss bounty`). New helpers `site(n)`, `looted(n)`, `gone(n)`, `prOK()`; `bestUp(free)` skips the docked tower.
    `tapTw` ends the probe's command mode first (a map tap would send the probe).
  - `frSteps` (shared with the Lift Off lesson): no `preview` step (its line is in `land`), `links` is a line, no `moved` step
    (its line is in `mvBtn`), texts for the 6.5.2 rule.
  - `CHECK` (17 lines, new order and probe/Entropy lines). `paced`: the late rule needs 12 s of play.
  - `TAUGHT` + `taught()` (lessons passed) and `markTaught(keys)`; `openTutDone` and Skip use them (**openGameOver path,
    via openTutDone**). The `tutent` body class shows the Entropy gauge from the Training draw on.
  - `openAnomaly`: in Basic Training v2 the header note teaches the card (green boon, red cost, rarity).
  - `openTutDone`: the "What's next" block (`.lwhat.tnext`). Offer, chooser and manual say "about 10 minutes".
- **template.html**: `.card.tutdone .tnext`, `.card.anom .ch .note.tutn`.

## 4. Tests

- **New `test/tut66.py [WxH,…] [--audit] [--tag T]`** (Playwright): plays the whole Basic Training as a scripted new player.
  Logs every coach card, modal, alert and tip with its play second; checks Training finishes, every lesson shows in order,
  the probe / fog / Entropy / boss steps show, every checklist line ticks and in list order, the estimated length is
  8–12.5 minutes, the shortest gap between lessons is at least 10 s and the median at least 18 s. One screenshot per lesson
  in `test/out/tut66/<size>_<nn>_<lesson>.png` and the end card. `--audit` only logs (used for section 1).
- **New `test/tut66.js`** (node, 20 checks): v2 is Basic Training only (lessons, `tut: 1`, normal runs unchanged), probe and
  fog on, no random sites, sites on their waves and spots with their guards and no jackpot, the draw is Common/Rare/Exotic
  with no Classic, one draw only, the probe loots and banks both sites (the second under fire, through fog), the v2 run
  replays exactly, and the profile (runs, XP, best wave, kills, codex) is untouched.
- Changed: `test/tutorial.js` also plays and replays a v2 run (the bot sends the probe and takes a generated card);
  `test/tutcheck.py` and `test/tutorialshot.py` know the new steps and checklist (`credits` replaces `upWhy` for the open
  checklist screenshot; `prLost` is optional); tutorialshot prints the state when the coach stalls. Both bots now pick a
  card at the Training draw (no coach card sits on it).

### Merged 6.5.3 and 6.5.4
`release` (6.5.4) is merged into tut66 (one conflict: the Power card, resolved to 6.5.4's "Power" word with this branch's
short sentences). The probe lesson names the new controls: Home and Upgrades under Probe,
Probe again to let it go. The fading hint ("Tap the map to send it.") always shows in Training, and Training selections
do not count toward the 5-selection limit (`PROF.settings.prHints`), so a player who trains first still gets 5 hints in
real runs. The coach line says the same thing, so nothing depends on the hint.
6.5.4 rule (no emoji): the Training text uses words only. The checklist's ▸/▾ became "list"/"hide", the end card's
level-up ▲ is the pixel `up` icon. Still in the game outside Training (not changed here): ▲ in the Threat Board Arms Race
rows, the Archive evolution rows and the Talents tier row/tabs.

## 5. Results (final code: 6.5.4 merged, this branch's head)

- `python3 build.py` ok. `audit.py n` and `audit.py ipadA 1180 820 0,0,20`: `ERRORS: []`.
- `uiaudit.py`: only flags outside Training (hangar version label, setup zone lines, Dictionary clipping, Archive/Hall
  "Bosses" under the close button at 1180×820). Same list before this branch's changes.
- `trackcollide.py`, `splashshot.py`, `probe65shot.py`: `FAILED: []`.
- `node test/replay.js`: all replays match. qola 28/28, cards64 28/28, tower64 41/41, probe65 53/53, sky65 48/48,
  frontier 92/0, hookcompat match, tut66.js 20/20.
- `tut66.py 667x375,1180x820`: `FAILED: []` (numbers above; screenshots per lesson in `test/out/tut66/final_*`).
- `tutcheck.py`: 667×375 perfect, human and skip, 1180×820 human: `FAILED: []` (17/17, skip 16/17 with the missed line).
- `tutorialshot.py 667x375,1180x820 basic`: all 53 steps shown, `FAILED: []`; every Field Manual lesson at 852×393: `FAILED: []`.
- `tutcadence.py 852x393`: numbers above.

## 6. Open issues and risks

- **Not played on a real iPhone.** Timings are play seconds from a scripted player; a real new player reads slower or
  faster. 4 s per held card gives 11.4 minutes.
- The core gun does most of the killing on this small board (towers often read IDLE). Training gives the Veteran rank to
  the highest-level attack tower when none earned it. Real runs are bigger, so this is a Training-only effect.
- The Hasted Behemoth still walks the first half of the road before anything reaches it ("BOSS HALFWAY … 100% HP" shows);
  the fight is about 80 s.
- The "SPEED 1×" tip can sit over the bottom of the boss card for about 3 s on iPad (it lets taps through; as in 6.5.2).
- The Entropy draw's cards are generated from the run, so the exact boons differ per player; only the rarities are fixed.
- Test bots now tap the Veteran pick button itself: a tap on a glossary word inside a pick button opens its tooltip instead
  of picking (that was the old "stuck on vpick" flake). Real players can hit the same thing if they tap the underlined word.
- `node test/tutorial.js`: the Lift Off lesson line "moved 0" fails, the same on 6.5.2 (bfffd7e); a test-bot issue, not
  changed here. The v2 Basic Training replay in it passes.
- ▲ remains in the Threat Board Arms Race rows, Archive evolution rows and Talents (outside Training; 6.5.4's call).
