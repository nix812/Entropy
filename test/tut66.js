// 6.6 tut66: Basic Training v2 (newRun({ tut: 2, frontier: 1 })) in the sim. Checks: the v2 script is Basic Training only
// (lessons and tut 1 recordings keep the old rules, normal runs are unchanged), the probe and fog are on, the two scripted loot
// sites appear on their waves at their spots with their guards and no jackpot, the Entropy draw holds a Common, a Rare and an
// Exotic and no Classic, the boss health, the run replays exactly, and Training never touches the profile.
// usage: node test/tut66.js
const { load } = require('./harness.js');
const S = load(); let fails = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log('FAIL ' + m); } else console.log('ok   ' + m); };
const step = (G, until, max = 40000) => { for (let i = 0; i < max && !G.over && !until(); i++) { if (G.anomOffers && !G._keep) S.act('stab'); S.simStep(S.SIM_STEP); } };
// 1. who gets the v2 script
{
  let G = S.newRun({ tut: 2, frontier: 1, cols: 46 });
  ok(G.tut === 2 && !!G.probe && G.probe.alive && S.fogOn() && G.fogEx, 'v2 Basic Training: probe and fog of war');
  ok(G.siteT > 1e8 && G.sites.length === 0, 'v2: no random sites (script only)');
  ok(G.tutS.boss.hp === 700 && G.wanted && G.wanted.w === 8, `v2: Most Wanted on Wave 8 with ${G.tutS.boss.hp} health`);
  G = S.newRun({ tut: 1, frontier: 1, cols: 46 });
  ok(G.tut === 1 && G.probe === null && !S.fogOn() && G.tutS.boss.hp === 1500 && !G.tutS.sites, 'tut 1 (old recordings): no probe, no fog, the old script');
  for (const L of S.LESSONS.filter(x => x.run)) { G = S.newRun({ tut: 2, frontier: 1, cols: 46, lesson: L.id }); if (G.probe || S.fogOn() || G.tutS.sites || G.tutS.ent) { ok(false, `lesson ${L.id} got v2 fields`); break; } }
  ok(true, 'lessons (tut 2 + lesson): no probe, no fog, no scripted sites or draw');
  G = S.newRun({ seed: 9, chaos: 1, frontier: 1 });
  ok(!G.tut && G.siteT === S.PROBE.site.first && G.sites.length === 0, 'a normal run: random sites as before');
}
// 2. the script: sites, guards, the draw
{
  const G = S.newRun({ tut: 2, frontier: 1, cols: 46 }), cx = G.map.core.x, cy = G.map.core.y;
  step(G, () => G.sites.length > 0);
  const s1 = G.sites.find(s => s.tut === 1);
  ok(s1 && G.wave === 5 && s1.k === 'wreck' && s1.g.length === 0 && s1.val === 160 && s1.jp === 0, `site 1: a guard-free wreck as Wave 5 ends (wave ${G.wave}, ${s1 && s1.val} credits)`);
  ok(s1 && Math.hypot(s1.x - cx - 0.5, s1.y - cy - 0.5) < 10, `site 1 near the core (${s1 && Math.hypot(s1.x - cx - 0.5, s1.y - cy - 0.5).toFixed(1)} tiles)`);
  step(G, () => G.sites.some(s => s.tut === 2));
  const s2 = G.sites.find(s => s.tut === 2);
  ok(s2 && G.wave === 6 && s2.g.length === 1 && s2.g[0].k === 'drone' && s2.jp === 0, `site 2: one drone guard as Wave 6 ends (wave ${G.wave})`);
  ok(s2 && Math.hypot(s2.x - G.core.x, s2.y - G.core.y) > S.coreStats().range + 6, 'site 2 sits far out in the fog');
  G._keep = 1; step(G, () => !!G.anomOffers);
  const R = (G.anomOffers || []).map(o => typeof o === 'object' ? o.r : 'classic');
  ok(G.wave === 7 && R.join() === '0,1,2', `the Entropy draw as Wave 7 ends: rarities ${R.join()} (Common, Rare, Exotic, no Classic)`);
  const P0 = JSON.stringify(S.PROF.codex);
  S.act('anom', G.anomOffers[2].id);
  ok(G.ganoms.length === 1 && G.ganoms[0].r === 2 && JSON.stringify(S.PROF.codex) === P0, 'taking the Exotic works and leaves the profile codex alone');
  G._keep = 0; step(G, () => G.wave >= 8 && G.spawningDone);
  ok(!G.anomOffers && G.ganoms.length === 1, 'one draw only (the gauge never fills from kills in Training)');
}
// 3. the probe loots and banks; the run replays exactly; the profile is untouched
{
  const P0 = JSON.stringify({ runs: S.PROF.runs, xp: S.PROF.xp, best: S.PROF.bestWave, kills: S.PROF.kills, codex: S.PROF.codex });
  const G = S.newRun({ tut: 2, frontier: 1, cols: 46 });
  step(G, () => G.sites.some(s => s.tut === 1));
  const s1 = G.sites.find(s => s.tut === 1);
  ok(S.act('prGo', Math.round(s1.x * 10) / 10, Math.round(s1.y * 10) / 10) && G.probe.task === s1.id, 'prGo sends the probe to site 1');
  step(G, () => (G.tutLoot | 0) & 2, 3000);
  ok(((G.tutLoot | 0) & 2) && G.probe.cargo.cr > 100, `site 1 looted, ${Math.round(G.probe.cargo.cr)} credits in the hold`);
  const c0 = G.credits; S.act('prHome'); step(G, () => G.probe.home, 3000);
  ok(G.probe.home && G.credits >= c0 + 150 && G.stats.pr.trips === 1, `banked at the core (+${G.credits - c0})`);
  step(G, () => G.sites.some(s => s.tut === 2));
  const s2 = G.sites.find(s => s.tut === 2); S.act('prGo', Math.round(s2.x * 10) / 10, Math.round(s2.y * 10) / 10);
  let fog = false; step(G, () => { if (!fog && G.fogEx) { const k = Math.floor(G.probe.y) * S.COLS + Math.floor(G.probe.x); fog = G.fogEx[k] === 1 && Math.hypot(G.probe.x - G.core.x, G.probe.y - G.core.y) > S.coreStats().range + 2; } return (G.tutLoot | 0) & 4; }, 4000);
  ok(((G.tutLoot | 0) & 4) && G.probe.alive && G.probe.hp < G.probe.max, `site 2 looted under fire (hull ${Math.round(G.probe.hp)}/${Math.round(G.probe.max)})`);
  ok(fog, 'the probe explored fog on the way (explored tiles beyond the core\'s sight)');
  S.act('prHome'); step(G, () => G.probe.home, 4000);
  const h = S.runHash(), rec = { opts: G.recOpts, inputs: G.inputs.slice(), end: G.tick };
  S.replayRun(rec, { quiet: true, until: rec.end });
  ok(S.runHash() === h && rec.opts.tut === 2, `the v2 run replays exactly (${h})`);
  const P1 = JSON.stringify({ runs: S.PROF.runs, xp: S.PROF.xp, best: S.PROF.bestWave, kills: S.PROF.kills, codex: S.PROF.codex });
  ok(P0 === P1, 'Training v2 never touches the profile (runs, XP, best wave, kills, codex)');
}
console.log(fails ? `${fails} of ${n} FAILED` : `all ${n} tut66 checks pass`);
process.exitCode = fails ? 1 : 0;
