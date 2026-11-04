# qolB (6.2.0): tabbed Settings, Music Studio help and likes, tutorial pacing

Builder qolB, branch `qolB` from 6.1.0 (996905d). UI only: **no simulation change** (no edits to sim.js or data.js; `node test/replay.js` all match).

## What the player sees

**Settings, in tabs.** Nic: "We need a better tabular view of the settings overlay it's getting really crowded." The overlay is now a console-style options screen: a tab rail on the left (General · Sound · Graphics · Interface, each with a pixel icon; the version sits at the foot of the rail) and one scrolling pane on the right. Each row has a name, one line on what it does in muted text, and its control on the right: a pixel switch (track plus On/Off word), a segmented strip (the choice filled amber), a slider with a live readout, or a button. Sections have small amber headers. The last tab is remembered until the game closes. Fits 667×375 (the pane scrolls), 1180×820 has room to spare. Every tap target in it is 44 px or more (the close ✕ too).

Where everything went:

| Tab | Section | Rows |
|---|---|---|
| General | Gameplay | Boss slow-down (switch), Briefings (Pause / Brief / Off), Haptics (switch) |
| General | Save | Save location (Synced / This device), Transfer save (Export, Import; hidden during a run), Run log (Copy, Save) |
| General | About | What's New (Version x), Music credit line, Reset progress (two taps; hidden during a run) |
| Sound | Volume | Sound effects (slider, %), Music (slider, %) |
| Sound | Music | Music Studio (Open), Music tempo (slider, BPM), Mono audio (switch) |
| Sound | Troubleshooting | Sound (live status line) + Restart sound |
| Graphics | Effects | Glow (switch), Screen shake (switch) |
| Graphics | Display | Pixel scaling (Sharp / Simple), Full screen (switch, where the browser supports it) |
| Interface | Layout | HUD (Minimal / Detailed), Interface size (Auto / Small / Large) |
| Interface | Information | Notifications (All / Key / Off), Damage numbers (switch) |

Nothing was removed. The old two explanatory notes (tempo, briefings/notifications) became the rows' one-line descriptions.

**Music Studio.**
- Compose is visible from the start. Nic: "It doesn't need to be hidden." Fresh profiles have it; existing profiles are switched on once on load. (The old five-taps-on-the-visualizer door still exists but does nothing now.)
- A **?** button in the Studio header opens "How it works": a sheet over the Studio with the same Listen / Shape / Compose tabs, opening on the tab you were on. Each tab lists every control on that tab, then **Advanced**: how the controls interact (Energy + Follow, why the hangar sounds thinner, composed songs ignore Energy, Settings tempo vs Studio tempo, boss fights go minor), how seeds, likes (kept tracks restore their sound) and playlists (Only my tracks, 80-track cap) work, and **Moods to try** on Shape and Compose (Focus, Tension, Night drive, Console; Uplifting, Melancholy, Menace, Floaty). Every statement was checked against audio.js and the Studio code. ✕ returns to the Studio on the same tab; from Compose the radio stays held.
- The battlefield music deck (Music tile → ⏮ · song · ⏭) has a **♥** between the song and ⏭. Nic: "let people like songs to their playlist there while they're on the battle field." It is the Studio's Keep: same My Tracks list, saved with the current sound. Filled pink when the song is kept, a short pop, and the song line reads "♥ Kept in My Tracks" for 1.8 s (or "Removed from My Tracks" on a second tap). It does not raise a notification, so it never adds to the toast traffic.

**Tutorial pacing.** Nic's friend: "you get spammed with dialog boxes… hard to get into the game." Measured before and after with the new bot `test/tutcadence.py` (Basic Training, 852×393; times are seconds of play, which stop while a card holds the game):

| | 6.1.0 | 6.2 qolB |
|---|---|---|
| Coach cards | 64 | 62 |
| Lessons (a new topic) | 64 cards in 13 bursts | 19, each one action chain |
| New topic less than 15 s of play after the last | 54 | 4 (12.3 s and 11.8 s after a wave end or for the Strike pack; 8.6 s once, when a lesson was due before the countdown ran out) |
| Shortest gap between topics | 0 s | 8.6 s |
| Median gap between topics | 0 s | 22 s |
| Biggest burst | 15 cards at once after Wave 3 (threat, Rail, Lift Off, dock, links, Move) | 6 before Wave 1 (core, health, road, build spots, build, start) |
| Training length (play) / wall time at 1× with 3 s per card | 704 s / 875 s | 710 s / 875 s |

Lesson starts after the change (play seconds): 0 start · 22 camera · 44 credits · 54 second tower · 100 upgrade · 122 ranking up · 147 Threat Board · 169 Lift Off · 194 Move · 220 inspect · 232 upgrade arrow · 244 Strike · 267 veterans · 275 swarm adapts · 297 core · 313 specialty · 335 Most Wanted · 578 boss · 710 bounty. Before: 0 (8 cards) · 28 · 47 (4) · 94 (8) · 140 (15) · 158 (2) · 236 (10) · 243 (3) · 273 (4) · 277 · 323 (6) · 563 · 704.

How it works now:
- Steps that start a lesson carry `ls`. A lesson's steps run back to back (Lift Off → pick → preview → land is one chain). A new lesson waits for **22 s of play** since the last card, or for **the end of a wave with at least 10 s of play since**, and for a calm moment (no tap in the last 2.5 s, not aiming or picking a landing, the core not in flight, fewer than two enemies at the core, no boss close). A busy spell can delay a lesson by at most 25 s. Between waves, with under 5 s left on the countdown, a lesson that belongs to this break goes ahead so it is never lost. The Strike lesson waits only 12 s (the pack is the moment), the boss and bounty cards don't wait. Call prompts ("Wave 3 · Tap Next") neither wait nor reset the clock. Field Manual lessons are one topic each and are not paced.
- The opening burst is shorter: the "Wave" card was folded into "Start the wave" and the first "Power" card into the later one (which now also mentions Power Nodes).
- New lesson schedule: start (before Wave 1) → camera (Wave 1) → credits and score (Wave 1) → second tower and power (end of Wave 1) → upgrade, its bonus (end of Wave 2) → ranking up, why upgrade (Wave 3) → Threat Board, Rail Lance (end of Wave 3) → Lift Off and dock (Wave 4) → Move (Wave 4) → inspect a Juggernaut (Wave 4, optional) → the upgrade arrow (end of Wave 4) → Strike (Wave 5) → veterans (Wave 5) → the swarm adapts (end of Wave 5) → core upgrades (Wave 6) → gene marks (optional) → specialty (end of Wave 6) → Most Wanted chip (Wave 7) → boss → bounty. The Training waves are unchanged (scripted, sim): all the waiting is in the coach.
- **Camera tip in Training** ("Look around", Wave 1, after ~22 s of play): "Drag to pan, pinch to zoom. When something is off screen, an arrow at the edge points to it: tap one to look there. Tap the core arrow to come back home." It ends when the player drags or pinches the map (or Got it). No mention of the Home button (qolA removes it).
- **Real runs: one teaching gate.** Every first-time card (`introCard`: Lift Off, storms, salvage, veterans, abilities, upgrades, power, spare power, wormhole, Entropy, boss next wave, Exchange, support towers, Techniques), first-time enemy cards, the evolution intro, the Most Wanted poster, WELCOME, the new camera tip and the "credits piling up" nudge wait their turn: **no two within 30 s of play**, and never in a busy moment (same test as above). A first boss and a Strain Assault intro can't wait, but they start the 30 s clock. A card that waits keeps its place (cards are checked in priority order every frame; its seen flag is set only when it shows). An enemy card that shows after its enemy landed says "New enemy · on the field" instead of "next wave".
- **Camera tip in a first real run**: LOOK AROUND, after WELCOME, 30 s later (once per profile, `PROF.zoomHint`; it replaces "BIGGER MAPS", which fired 0.3 s after WELCOME).

## Code map
- **ui.js, top level:** `studioMig(st)` (composer on, `cmpV: 1`), called from `Save.merge` and at boot before `SFX.music.setConfig`. Icons `speaker`, `screen`, `sliders` in `ICONS`.
- **ui.js, onboarding (after `buildHints`):** `TEACH_GAP`, `teachClock`, `teachBusy`, `teachOK`, `teachMark`, `teachTap` (set by a capture `pointerdown` on `#app` in `wire()`), `camUser` (counted in the canvas pan, pinch, wheel and keyboard pan handlers). `introCard` gated. `onboardingTick`: WELCOME and LOOK AROUND moved here from `launch` (**hotspot, two lines removed**), wanted poster and credits nudge gated. `enemyCard` gated (queue already existed), `evoWait` flag drained in `UI.tick`; `Hooks.evoIntro` sets it; `Hooks.assaultWarn` and `bossIntro` (first encounter) call `teachMark`.
- **ui.js, Coach:** `next()` records `mem.gapT/gapW/gapC`; `PACE_GAP`, `paced(S)`, `lessonOf(k)`; `tick` checks `paced`; `show2` records `mem.shownId`, `mem.lastLs`; `call()` steps are `free`; `UI.coach.chain` exposes the lesson. Basic plan: `ls` tags, `camera` step, `wave` and `power0` removed (text merged), windows widened for the moved lessons (rank, lift, move, core, vets, spec, wanted), core and vets blocks moved after the Strike/evo steps; `frSteps` lift/move carry `ls`.
- **ui.js, Settings:** `setTab`, `SET_TABS`, `openSettings` (rewritten), `setSettingsTab` (in place, no re-render), `modalAction` case `setTab`. All other setting actions are unchanged (`hud`, `uis`, `gfx`, `autoslow`, `haptic`, `briefs`, `notes`, `nums`, `mono`, `shake`, `fs`, `sndFix`, `xcopy`, `xpaste`, `wipe`, `news`, `logCopy`, `logSave`, `studioS`).
- **ui.js, Studio:** `stHelp`, `ST_HELP` (all help copy), `stHelpHTML()`; `openStudio` adds the ? button and re-attaches the sheet after a re-render (keeps its scroll); `studioAction` cases `stHelp`, `stHelpTab`, `stHelpX`; `stClose` clears it.
- **ui.js, music deck (wire):** `deckNoteT`, `deckFill` (heart state), `#bTrkLike` handler (Keep/unkeep via `SFX.music.save/unsave`, `studioSave`).
- **template.html:** `#bTrkLike` in `#mdeck`; CSS blocks "6.2 Settings" (after `.set`), "6.2 the ? sheet" (before Studio Listen), "6.2 like from the battlefield" (after `body.watching #mdeck`). New classes checked free first (pitfall 41): `.settab`, `.setrow`, `.setx`, `.setc`, `.setrail`, `.setpane`, `.setwrap`, `.setver`, `.spg`, `.ssec`, `.sw`, `.seg`, `.sval`, `.sthelp`, `.shh`, `.shbody`, `.shcols`, `.shdl`, `.shadv`, `.sthq`, `.shx`, `.mdlike`. (`.srow` and `.stab` were taken: `.tstar .srow`, `.boon.stab`.)
- **PROF:** `settings.studio.cmpV` (migration marker). Nothing new in `G`; snapshots untouched.

## Tests
- New `test/qolbshot.py [sizes] [settings|music|deck|camera|all]`: settings (four tabs, every 6.1 control present, each tab shows only its page, 44 px targets, no sideways spill, last row reachable, switch / segmented / slider work, tab remembered, reset two taps, in-run hides Transfer and Reset, back to pause); music (fresh and old profile get Compose, migration only once, ? opens on the current tab, each help tab ≥ 6 controls + Advanced, closes to the same tab, Compose keeps the radio held); deck (heart keeps the playing song with its sound, fills, confirms, the Studio list has it, second tap removes); camera (Training step in Wave 1 after ≥ 15 s, text, a drag completes it; first real run WELCOME then LOOK AROUND ≥ 30 s apart, once). Screens in `test/out/qolb/`.
- New `test/tutcadence.py [WxH] [tag]`: plays Basic Training with the coach bot and prints every card with its play-time gap, chain and the alerts/tips, plus a summary; writes `test/out/tutcadence_<tag>.json`.
- Updated `test/studio55.py`: Compose is there from the start (was "five taps unlock").
- Results (this session): build ok; `audit.py n` and `audit.py ipadA 1180 820 0,0,20` ERRORS []; `uiaudit.py` only the known flags (hangar version text, setup zone line, Dictionary 'Elite Affixes'/'Evolution' clipping; nothing in Settings or the Studio); `trackcollide.py` FAILED [] at all sizes with the wider deck; `splashshot.py` FAILED []; `node replay.js` all replays match; `node test/tutorial.js` all match; `qolbshot.py 667x375,1180x820 all` 106 passed, FAILED []; `tutorialshot.py` basic at 852×393, 667×375 and 1180×820: all 63 steps shown (no optional step skipped), checklist complete, misc checks pass; lessons at 852×393: all complete, FAILED []; `studio55.py` at 852×393, 667×375, 1180×820 FAILED []; `monocheck.py`, `soundcheck.py`, `newsshot.py` clean.

## Open issues
- The Dictionary row "Zoom" (GUIDE in ui.js) still says "Tap Home to return to the core". qolA removes Home; whoever merges should update that line (left alone here to avoid a conflict).
- The camera tips mention "the core arrow"; it exists in 6.1 (Frontier edge arrows, `A.home`), and qolA makes it pan home.
- Pacing uses play time, so at 3× speed a 22 s gap passes in about 7 s of wall time. That felt right (fast players want less waiting) but Nic may want wall time.
- The 30 s gate can push a first-time card past its moment (for example "Boss next wave" if another card showed just before). It then waits for the next time its condition holds.
