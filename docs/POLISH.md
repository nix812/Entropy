# Last Gradient: polish and release-ready brief (Nov 7 2026)

Read this right after HANDOFF.md. It sets the work for the next sessions and overrides older roadmap items.

## 1. The ask (Nic, Nov 7, his words)

"I want to concentrate on squashing bugs and making the UI and player control perfect. I'll stop throwing features out there for now. It's time to polish it up and get it ready for the release. I also want to do a sweep on any front facing messaging. Some of it is a bit robotic and sounds AI generated... I don't want there to be an off putting situation with that where players say yep this AI generated slop, I'm not gonna play it. Really do some research here and let's make this game truly great and ready... I just want this to be a love message to gamers and it needs to be really good. I'd rather not have to rewrite everything by hand."

So:
- **No new features.** New systems wait until after launch. A fix may add a small affordance (a confirm, a clearer state) when the problem needs it.
- **Three workstreams:** bugs (section 3), UI and player control (section 4), voice and copy (section 5).
- **Nic does not rewrite text by hand.** He approves a voice, reviews samples, and flags lines he dislikes. The session does the writing.
- **Goal:** ready for the App Store plan (doc "Last Gradient Store Launch Plan", https://claude.ai/artifact/1tcJ28d5UZ1g5FgCwrxrb4). Five store decisions are still open there (price, seller name, web demo, app name, Google Play timing). Don't block on them.

## 2. Ground rules that still hold

- Release process (HANDOFF section 2): small fixes go straight to live with the lab redeployed. A big pass (the copy rewrite, a control redesign) goes to the lab first and ships when Nic says. "Push to production" = the whole lab build goes live and the lab is reset.
- **Verify every push.** `deploy.py` prints `PAGES: success`. Check `origin/main:index.html` and `lab/index.html` for the version and a marker. On Nov 6, a GitHub Pages deploy timed out silently and the site stayed on 6.2.0 for 2 hours.
- **No emoji anywhere in the game** (HANDOFF section 8). Use pixel `ICONS` via `svgIcon`.
- Determinism: rules changes gate on `G.frV` (now 6). Replays must match. UI and copy changes don't touch the sim.
- Replies to Nic: plain language, short. He is not a coder.
- Writing rule change: see section 5. The old "Simple Technical English" rule made the in-game text clipped and robotic. It now applies only to replies to Nic and to the handoff. In-game text follows the voice guide below once Nic picks a voice.

## 3. Workstream A: bug sweep

Known issues, collected from Nic's run logs and the builders' reports, Nov 4–7. Confirm each one before fixing. Add new ones as Nic reports them.

| Area | Issue | Source |
| --- | --- | --- |
| Sound | Sound stopped late in a 28-minute run (6.5.3). 6.5.5 logs sound health (`aud*` lines). Ask Nic for the next log where it happens, then fix the cause (likely an AudioContext rebuild on iOS). | Nic, Nov 6 log |
| Balance | Drone floods from about Wave 41: 14–22 drone leaks per wave (`breachWarn` Drone), which end long runs. Seen in 6.0.2 and both 6.5.3 logs. Check whether it is a bug (breach scaling) or a balance spike. | Nic's logs |
| Controls | Tapping an underlined glossary word inside a Veteran pick button opens the tooltip instead of picking. | tut66 report |
| Controls | Top bar hit areas reach 12 px into the field and can take taps meant for an edge arrow. | ui652 report |
| Controls | Under 44 px: rail buttons (50×42), tower panel Sell and Move (37–41 px wide), Studio genre names and its ✕ (40 px). | ui652 tapsize |
| Training | Towers sit idle on the small board (the core gun kills most). The boss walks half the road untouched. On iPad the "SPEED 1×" tip covers the boss card's Fight button for about 3 s. | tut66 report |
| Training | `node test/tutorial.js`: the Lift Off lesson check fails ("moved 0"), the same since 6.5.2. | tut66 report |
| Towers | Buzzsaw blade can finish its run on the old road after the core moves. Rimewall walls and Entangler links aren't in snapshots (rebuilt on resume). Wildcard and Surge Spire look weak for the bot. | tower64 report |
| Cards | The 60-point bot median rose to about W82 with generated cards. If late runs feel easy, raise `ANOM_GEN.dr` from 0.8 to 0.9. | cards64 report |
| Music | No boss theme if the boss arrives before the first tap. Leaving Compose during a boss fight starts a radio song. Techno lead is silent at mid energy. Trance Progressive is about 6 dB quiet. | mus63 report |
| Probe | No sounds of its own (reuses others). Gas clouds look the same in every zone. | probe65 report |
| UI audit | Standing `uiaudit` flags: hangar version label, setup zone lines, Dictionary clipping, Archive and Hall close button. Decide fix or whitelist. | gate logs |
| Tests | Flaky: `zone63shot` colour check, `probe65shot` one tap, the daily-seed check in `frontier.js`. Make them stable so a red gate means a real bug. | gate logs |
| Old copy | The Claude artifact copy listed in the Project instructions is version 4.4 and unused. Tell Nic it can be dropped from the instructions. | Nov 6 check |

Method: reproduce in Playwright or the node harness, fix, add a regression check, ship in small batches.

## 4. Workstream B: UI and player control

Target: every tap does what the player expects, the map stays clear while playing, and a new player never has to guess.

1. **Interaction inventory.** List every input: tap a tower, tap an empty tile, pan, pinch, tap the core, Lift Off and landing, the probe (select, send, Home, Upgrades), chests and crates, loot sites, wormholes, boss and event cards, the rails, the top bar, panels, Studio, Settings. For each: what it does, what it covers, how you leave it.
2. **Conflict pass.** Where one tap can mean two things (probe vs chest vs tower vs site), set a clear order and make it visible. 6.5.4 set chest-first for the probe; apply the same thinking everywhere.
3. **Consistency.** One rule for closing things: a map tap closes any side panel (the probe panel does this since 6.5.3). Same button styles, same words for the same action.
4. **Map clarity.** Panels and cards cover as little of the field as possible on 667×375. Nic found the 6.5.2 probe bar obtrusive; check every overlay with the same eye.
5. **Feedback.** Every action answers: sound, a flash, a number. In the app build, add haptics.
6. **Tap targets.** At least 44×44 px where they fit (`test/tapsize.py`). Fix the misses in section 3.
7. **Destructive actions.** Sell, reset talents and leaving a run get a confirm or an undo.
8. **Real devices.** Emulation misses things. Ask Nic for short screen recordings of anything that feels off, and plan a TestFlight round (store plan) for 5–10 people.

## 5. Workstream C: voice and copy sweep

### What the research says

- Players punish games that look AI-made. A Game Oracle study of about 10,000 Steam releases found that games with AI-generated assets got a median of 4 reviews versus 14, and averaged 74% versus 80% positive. They were 16% less likely to turn a profit ([feedbagel](https://feedbagel.com/post/ai-is-ruining-game-sales-numbers-show)).
- Players hunt for AI text. After The Alters launched, players found a leftover chatbot reply in its text, then searched the rest and found AI-translated subtitles. The studio had to patch it out and apologise ([TechSpot](https://www.techspot.com/community/topics/the-alters-developer-forgot-to-alter-its-ai-text-before-launch-studio-responds-after-fan-backlash.293798/)).
- Steam requires a disclosure for AI-generated content, and the store plan has Steam as a later option. Raise this with Nic before any Steam work.
- The tells readers notice ([Grammarly](https://www.grammarly.com/blog/ai/common-ai-words/)): stock words (delve, realm, harness, unleash, seamless, journey, elevate), stacked transitions and hedges, every sentence the same length and shape, lists of three, a formal and flat tone, and generic lines with no point of view.

### What is wrong with the current text

- About 10,000 words of player-facing text live in `src/ui.js` (most), `src/sim.js` (alerts, event text), `src/data.js` (towers, enemies, bosses, zones, perks, cards, Field Manual, What's New) and `src/audio.js` (Studio).
- Much of it was written to the Nov 4 "Simple Technical English" rule: every sentence short, numbers everywhere, no idioms. That is clear but flat. It reads like a manual written by a machine, which is exactly the "robotic" feel Nic means.
- Data strings are often fragments ("Long-range piercing shot.", "Teleports forward and cloaks"). Toasts are fine and functional. The boss and enemy flavour lines (Quackzilla, The Auditor's "Form 1040-Z", Leia, the Immortal Snail) already have the personality the rest should have.
- 3 uses of "unleash" in ui.js. Few em dashes. The bigger problem is the rhythm, not specific words.

### The process (Nic approves; the session writes)

1. **Pick a voice (Nic, one short decision).** Rewrite the same 10 lines (one tower, one enemy, one boss line, a Training card, a toast, a perk, a card, a zone line, a What's New item, a Field Manual line) in 3 voices. Send them side by side. Candidate voices:
   - **Dry mission control:** a calm, wry flight controller who has seen everything. Short, warm, a little deadpan.
   - **Salvage crew:** a scrappy crew talking shop. Plain words, gallows humour, pride in the gear.
   - **Arcade cabinet:** punchy, playful 80s arcade energy. Bold verbs, quick jokes.
2. **Write the voice guide** (add it to this file and HANDOFF section 8) once Nic picks: who is speaking, to whom, three do's and three don'ts, 6 before/after examples, and the banned list below.
3. **Text tiers.** Each string gets one tier, and each tier has its own rules:
   - **Rules text** (stats, tooltips, perks, card numbers): exact numbers and game terms, but read as a sentence a person would say, not a fragment list.
   - **Coaching** (Training, intro cards, hints): second person, encouraging, one idea, the reason in a few words.
   - **Flavour** (towers, enemies, bosses, zones, events, loading lines): personality first, jokes welcome, idioms fine.
   - **UI labels and buttons:** short verbs, the same word for the same action everywhere.
   - **System messages** (errors, saves, updates): calm and human. Say what happened and what to do.
4. **Export every string** to a review sheet (location, tier, current text, proposed text). Build a small script that extracts them and later writes approved text back, so nothing is retyped by hand.
5. **Rewrite in batches by area:** Training and intro cards first (players see them first), then towers, enemies and bosses, then perks, cards and Field Manual, then UI labels, toasts and system messages, then Studio and Settings. After each batch send Nic 10–15 sample lines and the full sheet. He flags what he dislikes. Then apply.
6. **Checks on every batch:**
   - The banned list: no delve, realm, harness, unleash, seamless, journey, elevate, tapestry, embark, "dive into", "at its core", "it's not just X, it's Y", "whether you're X or Y", "get ready to". No em-dash chains. No triple lists by habit. No exclamation marks in rules text.
   - Vary sentence length on purpose. Read every card aloud; if it sounds like a brochure or a manual, rewrite it.
   - Each line has a point of view: something only this game would say.
   - Numbers stay correct: a test compares every number in old and new rules text.
   - Layout: run uiaudit, tapsize and the screenshot suites at 667×375 and 1180×820 (new text can wrap or clip).
7. **A human read.** Before it ships, a fresh player (Nic's brother or a friend) plays Training and reads the cards. Note anything that sounds off.
8. **Ship to the lab first**, then live when Nic says.

### Honesty note for Nic

Claude does the rewriting, so the safeguards matter: a voice Nic chose, the banned list, line-by-line review of samples, and a human reader. The aim is text a person would be proud to have written, not text that hides how it was made. If Nic later lists on Steam, its AI disclosure rules apply.

## 6. Definition of ready (release gate)

- No known crash or soft-lock. The sound holds up through a 45-minute run on Nic's iPhone.
- Every interaction in the section 4 inventory behaves as listed, at 667×375 and 1180×820, and on Nic's real devices.
- Every player-facing string has passed the voice sweep and Nic's sample review.
- A fresh player finishes Training without help and wants another run.
- The full gate is green with no flaky checks.

## 7. Start-of-session checklist

1. Clone `source` from nix812/Entropy and read HANDOFF.md, then this file.
2. Check live and lab versions (`git show origin/main:index.html | grep VERSION` in the site clone).
3. Ask Nic for any new run logs (6.5.5+ logs carry sound health) and recordings.
4. Start with the voice sample (section 5, step 1), since it needs Nic's answer, and work the bug list while waiting.
