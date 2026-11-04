// 5.8 Training: a Basic Training run and every lesson run replay exactly from their recordings (newRun(G.recOpts) + G.inputs),
// never touch the profile, and finish. 6.1: Training and lessons run on Frontier rules (the bot also lifts off onto a tower and
// moves one); the old Classic runs (no flag) still replay. usage: node test/tutorial.js
const { load } = require('./harness.js');
const S = load(); let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } };
function play(opts) {
  S.newRun(opts); const G = S.G, road = G.map.lanes[0].tiles;
  const spot = () => { for (const p of road) for (const [dx, dy] of [[0, -1], [0, 1], [1, 0], [-1, 0], [1, 1], [-1, -1]]) if (S.canBuildAt(p.x + dx, p.y + dy)) return [p.x + dx, p.y + dy]; };
  let guard = 0; const types = G.tutS.towers;
  while (!G.over && guard++ < 60000) {
    if (G.huntChoice) { S.act('extract'); break; }
    if (G.draft) S.act('boon', 0);
    if (G.anomOffers) S.act('stab');
    if (G.checkpoint && !G.enemies.length) S.act('cpResume', 4);
    if (guard % 300 === 0) { const s = spot(); if (s && S.gridFree() > 0) S.act('build', types[(guard / 300) % types.length | 0], s[0], s[1]); else if (G.towers.length) { const t = G.towers[guard % G.towers.length]; S.act('up', t.x, t.y, t.lvl === 3 ? 1 : null); } }
    if (guard % 700 === 0) { const e = G.enemies.find(x => !x.dead); if (e) S.act('abil', 'strike', e.x, e.y); S.act('call'); }
    if (G.fr && guard % 900 === 450) { // 6.1 Frontier: dock on a tower that allows it, then move another one next to the core
      const c = S.frCands(), t = S.frCanFly() && G.towers.find(o => c.includes(S.tIdx(o.x, o.y)) && S.frPlan(o.x, o.y));
      if (t && S.act('frFly', t.x, t.y)) G.flew = (G.flew || 0) + 1;
      else if (!G.frFly && G.towers.length > 1) { const m = G.towers.find(o => o !== S.frDockT() && !(o.mvT > 0)), cx = G.map.core.x, cy = G.map.core.y;
        if (m) for (const [dx, dy] of [[2, 0], [0, 2], [-2, 0], [0, -2], [2, 2], [-2, -2]]) if (S.act('frMove', m.x, m.y, cx + dx, cy + dy)) { G.moved = (G.moved || 0) + 1; break; } }
    }
    if (S.ghostRun() && G.tutS && G.wave >= G.startWave + G.tutS.waves.length - 1 && G.spawningDone && G.enemies.every(e => e.dead) && !G.wanted) break;
    if (!G.draft && !G.huntChoice && !(G.checkpoint && !G.enemies.length)) S.simStep(S.SIM_STEP);
  }
  return G;
}
const P0 = JSON.stringify(S.PROF);
const LES = S.LESSONS.filter(L => L.run && (!L.need || L.need()));
for (const opts of [{ tut: 1, frontier: 1, cols: 46 }, { tut: 1, cols: 44 }, { tut: 1, cols: 38 }].concat(LES.map(L => ({ tut: 1, frontier: 1, lesson: L.id, cols: 46 })), LES.filter(L => L.id !== 'lift').map(L => ({ tut: 1, lesson: L.id, cols: 52 })))) {
  const G = play(opts), h = S.runHash(), rec = { opts: G.recOpts, inputs: G.inputs.slice(), end: G.tick }, w = G.wave;
  const R = S.replayRun(rec, { quiet: true, until: rec.end });
  const h2 = S.runHash();
  ok(h === h2, `${opts.lesson || 'basic'} cols ${opts.cols}: replay ${h} vs ${h2}`);
  ok(!opts.lesson ? G.extracted : true, `basic cols ${opts.cols}: reached the bounty and extracted (wave ${w})`);
  if (opts.frontier && (!opts.lesson || opts.lesson === 'lift')) ok(G.fr === 1 && G.flew >= 1 && G.moved >= 1 && rec.opts.frontier === 1, `${opts.lesson || 'basic'} Frontier: lifted off ${G.flew || 0}, moved ${G.moved || 0}`);
  console.log(`${h === h2 ? 'ok  ' : 'FAIL'} ${(opts.lesson || 'basic').padEnd(11)} ${opts.frontier ? 'fr ' : 'cls'} cols ${opts.cols} wave ${w} inputs ${rec.inputs.length} tick ${rec.end} hash ${h}${opts.frontier ? ` flew ${G.flew || 0} moved ${G.moved || 0} leaks ${G.stats.leaks} time ${Math.round(G.time)}s` : ''}`);
}
const P1 = JSON.parse(JSON.stringify(S.PROF)), P0o = JSON.parse(P0);
ok(P1.runs === P0o.runs && P1.xp === P0o.xp && P1.bestWave === P0o.bestWave && P1.kills === P0o.kills, 'Training runs never touch the profile');
console.log(fails ? `${fails} FAILED` : 'all tutorial replays match');
