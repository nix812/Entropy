#!/bin/bash
# Balance sweep: runs a batch of bots (par.sh) and prints one summary line.
# usage: bash test/sweep.sh LABEL N points chaos startWave bestWave   (env knobs pass through: DOC, FORCE, NOGA, ...)
# Prints: LABEL | median | mean | min-max | boss deaths (runs ended by a boss breach) | assaults won/total
LABEL=$1; shift
OUT=$(COLS=${COLS:-48} bash test/par.sh "$@")
echo "$OUT" | node -e '
const rows = require("fs").readFileSync(0, "utf8").split("\n").filter(l => /^│ [0-9]/.test(l)).map(l => l.split("│").map(s => s.trim()));
const waves = rows.map(r => +r[2]).sort((a, b) => a - b), n = waves.length;
if (!n) { console.log(process.argv[1] + " | NO RESULTS"); process.exit(); }
const BOSSES = /Behemoth|Hive Queen|Phase Wraith|Overmind|Titan|Mr\. Whiskers|Gloop|Space Whale|Quackzilla|Flying Spaghetti|Wormhole Worm|The Auditor|Immortal Snail/;
const bossDeaths = rows.filter(r => BOSSES.test(r[5])).length, early = rows.filter(r => BOSSES.test(r[5]) && +r[2] <= 30).length;
let aw = 0, at = 0; for (const r of rows) { const m = /(\d+)\/(\d+)/.exec(r[14]); if (m) { aw += +m[1]; at += +m[2]; } }
const med = waves[Math.floor(n / 2)], mean = (waves.reduce((a, b) => a + b, 0) / n).toFixed(1);
const killers = rows.map(r => `${r[2]}:${r[5].replace(/[^A-Za-z. ]/g, "").split(" ").map(w => w.slice(0, 4)).join("")}`).join(" ");
console.log(`${process.argv[1]} | n=${n} median=${med} mean=${mean} range=${waves[0]}-${waves[n - 1]} | boss deaths=${bossDeaths} (<=W30: ${early}) | assaults ${aw}/${at} | waves: ${waves.join(",")} | by seed: ${killers}`);
' "$LABEL"
