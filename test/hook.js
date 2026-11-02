// 5.8 The Hook: sector contracts, jump doors, the Bounty Purse and escalations (headless checks on the sim).
// usage: node test/hook.js      prints ok/FAIL per check and "FAILED: [...]"
const { load } = require('./harness.js');
const fails = []; let n = 0;
const ok = (c, msg) => { n++; console.log((c ? 'ok   ' : 'FAIL ') + msg); if (!c) fails.push(msg); };
const fresh = () => { const S = load(); S.PROF = S.defaultProfile(); S.PROF.bestWave = 80; S.PROF.xp = 4e6; return S; };
// kill the next boss wave's boss by hand (spawn it at the start of its road, then kill)
function bossKill(S, w) {
  const G = S.G; G.wave = w; const B = S.BOSSES[0];
  const e = S.spawnBoss({ boss: B.id, lane: G.map.lanes[0], hpm: 1 }); S.kill(e, null); return e;
}

{ // data
  const S = fresh();
  ok(S.SECTORS.length >= 8 && S.SECTORS.length <= 12, `${S.SECTORS.length} sectors`);
  ok(S.SECTORS.every(s => s.name && s.pitch && s.col && s.up && s.down && s.boss && s.mod && S.BOSSES.some(b => b.id === s.boss)), 'every sector has a name, pitch, colour, perk, drawback and a real Most Wanted');
  const o1 = S.sectorOffers(1234), o2 = S.sectorOffers(1234);
  ok(o1.length === 3 && new Set(o1).size === 3 && o1.join() === o2.join(), 'setup offers: 3 distinct contracts, stable for a seed');
  const d = S.dailySpec('2026-11-02'), d2 = S.dailySpec('2026-11-02');
  ok(d.sector && d.sector === d2.sector && S.SECTOR_BY[d.sector], `Daily Hunt contract fixed for the day (${d.sector})`);
  const D0 = S.dailySpec('2026-11-03'); ok(D0.anoms.length === 2 && D0.nemesis.genes.length === 2, 'dailySpec still draws its older fields first');
}
{ // rules version
  const S = fresh();
  S.newRun({ seed: 11, chaos: 1, startWave: 1, cols: 40, sector: 'hive' });
  ok(S.G.hk === S.HOOK_VER && S.G.sector === 'hive' && S.G.recOpts.sector === 'hive' && S.G.recOpts.hk === S.HOOK_VER, 'a fresh run uses the 5.8 rules and records its sector');
  ok(S.G.mods.chain >= 1 && S.G.af.haste >= 0.1, 'sector perk and drawback reach the mods (Hive: +1 chain, +10% enemy speed)');
  const share = (sid, ks) => { let a = 0, t = 0; for (let k = 0; k < 6; k++) { S.newRun({ seed: 11 + k, chaos: 1, startWave: 1, cols: 40, sector: sid }); const q = S.genWave(30, {}).queue.filter(x => x.type !== 'boss'); a += q.filter(x => ks.includes(x.type)).length; t += q.length; } return a / t; };
  const hiveSw = share('hive', ['swarmer', 'splitter']), ironSw = share('iron', ['swarmer', 'splitter']), ironTk = share('iron', ['tank', 'shielder']), hiveTk = share('hive', ['tank', 'shielder']);
  ok(hiveSw > ironSw + 0.15 && ironTk > hiveTk * 2.5, `roster lean at Wave 30: swarmers/splitters Hive ${Math.round(hiveSw * 100)}% vs Iron ${Math.round(ironSw * 100)}%; tanks/Aegis Iron ${Math.round(ironTk * 100)}% vs Hive ${Math.round(hiveTk * 100)}%`);
  S.newRun({ seed: 11, chaos: 1, startWave: 1, cols: 40, sector: 'hive' });
  const S2 = fresh(); S2.newRun({ seed: 11, chaos: 1, startWave: 1, cols: 40, v: '5.7.4' });
  ok(S2.G.hk === 0 && !S2.G.sector, 'an old recording (opts.v, no hk) replays on the 5.7 rules');
  ok(S2.hpMult(90) === S2.hpMult0(90), 'old rules keep the old health curve');
  S2.newRun({ seed: 11, chaos: 1, startWave: 1, cols: 40 });
  ok(S2.hpMult(90) < S2.hpMult0(90) * 0.7 && S2.hpMult(50) === S2.hpMult0(50), `5.8 trims health past Wave 50 (W90 ×${(S2.hpMult(90) / S2.hpMult0(90)).toFixed(2)})`);
}
{ // purse: split, bounty growth, doors, push, extract
  const S = fresh(); const G = S.newRun({ seed: 21, chaos: 1, startWave: 1, cols: 40, sector: 'drift' });
  const xp0 = S.PROF.xp; G.mods.xp = 1; S.G.scoreMult = 1;
  const v = 10000; S.G.score = 0; const sc0 = S.G.xpEarned;
  require('vm'); // addScore through a kill would need an enemy; call it through a crate-free path:
  S.G.purse = 0; S.G.nextMs = 1e18;
  const e = S.spawnEnemy('drone', { lane: G.map.lanes[0] }); e.score = v; S.kill(e, null);
  const raw = S.G.xpRaw;
  ok(Math.abs(S.G.purse - raw * (1 - S.PURSE.safe)) < 1e-6 && Math.abs(S.PROF.xp - xp0 - raw * S.PURSE.safe) < 1e-6, `XP splits: ${S.PURSE.safe * 100}% banked live, the rest in the purse (${Math.round(S.G.purse)})`);
  // claim a bounty
  S.G.wave = 20; S.planWanted(20); const Wd = S.G.wanted; const p0 = S.G.purse, r0 = S.G.xpRaw;
  const b = S.spawnBoss({ boss: Wd.boss, lane: G.map.lanes[0], hpm: 1 });
  const twins = S.G.wanted.mod === 'twins'; S.kill(b, null); if (twins) { const b2 = S.G.enemies.find(x => x.wanted && !x.dead); if (b2) S.kill(b2, null); }
  const C = S.G.huntChoice;
  ok(C && C.doors && C.doors.length === 3 && new Set(C.doors.map(d => d.sector)).size === 3 && C.doors.every((d, i) => d.tier === i && d.sector !== 'drift'), 'bounty: three doors, one per risk tier, none the current sector');
  ok(Math.abs(S.G.purse - (p0 + (S.G.xpRaw - r0) * (1 - S.PURSE.safe)) * S.PURSE.bounty) < 1e-6, `bounty grows the purse ×${S.PURSE.bounty}`);
  ok(!S.G.draft, 'no boon pick on a bounty wave (the doors replace it)');
  const snap = JSON.parse(JSON.stringify((S.snapshotRun(), S.PROF.runSnap)));
  ok(snap.huntChoice && snap.huntChoice.doors.length === 3 && snap.purse > 0 && snap.sector === 'drift', 'snapshot carries the doors, purse and sector');
  const p1 = S.G.purse, D = C.doors[2];
  ok(S.act('push', 2) === true && S.G.sector === D.sector && S.G.tier === 2 && Math.abs(S.G.purse - p1 * D.mult) < 1e-6, `door 3 pushes into ${D.sector} (Deadly), purse ×${D.mult}`);
  ok(S.G.af.hpx >= 0.25 && S.G.af.score >= 0.25, 'Deadly tier adds enemy HP and score');
  const want = S.sectorWanted(D.sector, S.G.wanted.w); ok(!want || S.G.wanted.boss === want.B.id, `next poster is the sector's Most Wanted (${S.G.wanted.name})`);
  // resume keeps it
  const S3 = fresh(); S3.PROF.runSnap = null; S.snapshotRun(); const RS = JSON.parse(JSON.stringify(S.PROF.runSnap)); S3.resumeRun(RS);
  ok(S3.G.sector === D.sector && S3.G.tier === 2 && Math.round(S3.G.purse) === Math.round(S.G.purse) && S3.G.hk === S.HOOK_VER, 'resume restores sector, tier and purse');
  // extract banks all of it
  S.G.huntChoice = { w: 40, name: 'x', cr: 1, next: 60, nextName: 'y', doors: C.doors }; const xpB = S.PROF.xp, pur = S.G.purse;
  S.act('extract');
  ok(S.G.over && S.G.purseOut && S.G.purseOut.share === 1 && Math.abs(S.PROF.xp - xpB - Math.round(pur)) < 1, `Extract banks the whole purse (+${Math.round(pur)})`);
}
{ // death pays a share; ghost runs never pay
  const S = fresh(); S.newRun({ seed: 31, chaos: 1, startWave: 1, cols: 40, sector: 'drift' });
  S.G.purse = 1000; const x0 = S.PROF.xp; S.act('abandon');
  ok(Math.abs(S.PROF.xp - x0 - 1000 * S.PURSE.death) < 1, `a fallen core banks ${S.PURSE.death * 100}% of the purse`);
  const S2 = fresh(); S2.newRun({ seed: 31, chaos: 1, startWave: 1, cols: 40, sector: 'drift' }); S2.G.purse = 1000; S2.G.replaying = true; const x1 = S2.PROF.xp; S2.G.over = false;
  S2.act; S2.G.over = false; // gameOver from inside a replay
  const go = S2.G; go.replaying = true; go.watch = null; S2.Hooks.onGameOver = () => {};
  S2.huntExtract(); // no hunt choice: refused
  go.huntChoice = { w: 20, name: 'x', cr: 1, next: 40, nextName: 'y' }; S2.huntExtract();
  ok(S2.PROF.xp === x1, 'a replay never pays out the purse');
}
{ // push without a door keeps the sector; old-rules push unchanged
  const S = fresh(); S.newRun({ seed: 41, chaos: 1, startWave: 1, cols: 40, sector: 'ghost' });
  S.G.huntChoice = { w: 20, name: 'x', cr: 1, next: 40, nextName: 'y', doors: [{ sector: 'hive', tier: 0, mult: 1.25 }] };
  ok(S.act('push') === true && S.G.sector === 'ghost' && S.G.pushes === 1, 'push with no door index keeps the current sector');
  S.G.huntChoice = { w: 40, name: 'x', cr: 1, next: 60, nextName: 'y', doors: [{ sector: 'hive', tier: 0, mult: 1.25 }] };
  ok(S.act('push', 5) === false && S.G.huntChoice, 'a door index that does not exist is refused');
}
{ // escalations
  const S = fresh(); S.newRun({ seed: 51, chaos: 1, startWave: 1, cols: 40, sector: 'drift' }); S.G.wanted.w = 999;
  bossKill(S, 30); ok(S.G.draft && !S.G.draft[0].twist, 'Wave 30 boss: a boon pick as before');
  S.act('boon', 0);
  bossKill(S, 50); const dr = S.G.draft;
  ok(dr && dr.length === 2 && dr.every(d => d.twist) && dr[0].id !== dr[1].id, `Wave 50 boss: an escalation pick (${dr && dr.map(d => d.id).join(' / ')})`);
  const sm = S.G.scoreMult; const id = dr[0].id;
  S.act('boon', 0);
  ok(!S.G.draft && S.G.twists[id] === 1 && S.G.scoreMult > sm, `twist taken (${id}), score multiplier ${sm.toFixed(2)} → ${S.G.scoreMult.toFixed(2)}`);
  bossKill(S, 50); ok(!S.G.draft, 'one escalation per boss wave (a twin does not offer a second)');
  // every twist's effect
  S.G.twists = { twin: 1, rifts: 1, affix: 2, storms: 1, learn: 1, carriers: 1, blitz: 2 }; S.recomputeAll();
  const g = S.genWave(60, {});
  ok(g.queue.filter(q => q.type === 'boss').length === 2 && g.queue.filter(q => q.type === 'boss').every(q => q.hpX === 0.65), 'Twin Bosses: two bosses at 65%');
  ok(!!g.rift, 'Torn Space: every wave has a rift');
  ok(g.heads.includes('carrier'), 'Carrier Fleet: Carriers headline');
  ok(S.G.af.affN === 2 && S.G.af.gap === 0.5 && S.G.af.stormHaste === 0.25 && S.G.af.learn === 1, 'Elite Plating, Blitz, Hostile Weather and Quick Study reach the run');
  const lanes = S.G.map.lanes.length; S.takeTwist({ id: 'worm' }); ok(S.G.map.lanes.length === lanes + 1 && S.G.map.lanes[lanes].openWave === S.G.wave + 2, 'New Wormhole: a lane opens in 2 waves');
  // the snapshot keeps a pending escalation and the twists
  bossKill(S, 70); const S4 = fresh(); S.snapshotRun(); S4.resumeRun(JSON.parse(JSON.stringify(S.PROF.runSnap)));
  ok(S4.G.draft && S4.G.draft[0].twist && S4.G.twists.blitz === 2 && S4.G.twists.worm === 1, 'resume keeps the pending escalation and the twists');
  // old rules: a Wave 50 boss still gives a boon
  const S5 = fresh(); S5.newRun({ seed: 51, chaos: 1, startWave: 1, cols: 40, v: '5.7.4' }); S5.G.wanted.w = 999; bossKill(S5, 50);
  ok(S5.G.draft && !S5.G.draft[0].twist, 'old rules: a Wave 50 boss still offers a boon');
}
console.log(`${n} checks`);
console.log('FAILED:', JSON.stringify(fails));
process.exit(fails.length ? 1 : 0);
