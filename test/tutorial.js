// 5.8 Training: a Basic Training run and every lesson run replay exactly from their recordings (newRun(G.recOpts) + G.inputs),
// never touch the profile, and finish. usage: node test/tutorial.js
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
    if (S.ghostRun() && G.tutS && G.wave >= G.startWave + G.tutS.waves.length - 1 && G.spawningDone && G.enemies.every(e => e.dead) && !G.wanted) break;
    if (!G.draft && !G.huntChoice && !(G.checkpoint && !G.enemies.length)) S.simStep(S.SIM_STEP);
  }
  return G;
}
const P0 = JSON.stringify(S.PROF);
for (const opts of [{ tut: 1, cols: 44 }, { tut: 1, cols: 38 }].concat(S.LESSONS.filter(L => L.run && (!L.need || L.need())).map(L => ({ tut: 1, lesson: L.id, cols: 52 })))) {
  const G = play(opts), h = S.runHash(), rec = { opts: G.recOpts, inputs: G.inputs.slice(), end: G.tick }, w = G.wave;
  const R = S.replayRun(rec, { quiet: true, until: rec.end });
  const h2 = S.runHash();
  ok(h === h2, `${opts.lesson || 'basic'} cols ${opts.cols}: replay ${h} vs ${h2}`);
  ok(!opts.lesson ? G.extracted : true, `basic cols ${opts.cols}: reached the bounty and extracted (wave ${w})`);
  console.log(`${h === h2 ? 'ok  ' : 'FAIL'} ${(opts.lesson || 'basic').padEnd(11)} cols ${opts.cols} wave ${w} inputs ${rec.inputs.length} tick ${rec.end} hash ${h}`);
}
const P1 = JSON.parse(JSON.stringify(S.PROF)), P0o = JSON.parse(P0);
ok(P1.runs === P0o.runs && P1.xp === P0o.xp && P1.bestWave === P0o.bestWave && P1.kills === P0o.kills, 'Training runs never touch the profile');
console.log(fails ? `${fails} FAILED` : 'all tutorial replays match');
