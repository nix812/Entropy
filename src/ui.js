// ===================== ENTROPY — UI, TREE VIEW, SAVES, LOOP =====================
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = v => Math.round(v * 100) + '%';
const num1 = v => (Math.round(v * 10) / 10).toString();


// ---------------- Pixel icons (9x9 bitmaps → crisp SVG) ----------------
const ICONS = {
  pause: ['.........', '.##...##.', '.##...##.', '.##...##.', '.##...##.', '.##...##.', '.##...##.', '.##...##.', '.........'],
  web: ['...###...', '...#.#...', '...###...', '....#....', '.###.###.', '.#.#.#.#.', '.###.###.', '.........', '.........'],
  stats: ['.......##', '.......##', '....##.##', '....##.##', '.##.##.##', '.##.##.##', '.##.##.##', '.........', '#########'],
  next: ['..........', '#...#....#', '##..##...#', '###.###..#', '########.#', '###.###..#', '##..##...#', '#...#....#', '..........'],
  strike: ['....#....', '....#....', '..#####..', '..#...#..', '###.#.###', '..#...#..', '..#####..', '....#....', '....#....'],
  nova: ['#...#...#', '.#..#..#.', '..#.#.#..', '...###...', '####.####', '...###...', '..#.#.#..', '.#..#..#.', '#...#...#'],
  stasis: ['#########', '.#.....#.', '..#...#..', '...#.#...', '....#....', '...#.#...', '..#.#.#..', '.#.###.#.', '#########'],
  overclock: ['.....###.', '....###..', '...###...', '..######.', '....###..', '...###...', '..##.....', '.##......', '#........'],
  archive: ['#########', '#########', '.........', '.#######.', '.#.....#.', '.#.###.#.', '.#.....#.', '.#######.', '.........'],
  help: ['..#####..', '.##...##.', '......##.', '.....##..', '....##...', '....##...', '.........', '....##...', '....##...'],
  gear: ['...#.#...', '.#######.', '.##...##.', '##.....##', '.#..#..#.', '##.....##', '.##...##.', '.#######.', '...#.#...'],
  overdrive: ['..#####..', '.#.....#.', '#..###..#', '#.#...#.#', '#.#.#.#.#', '#.#...#.#', '#..###..#', '.#.....#.', '..#####..'],
  fit: ['###...###', '#.......#', '#.......#', '.........', '.........', '.........', '#.......#', '#.......#', '###...###'],
};
function svgIcon(name, size) {
  const rows = ICONS[name]; if (!rows) return '';
  let r = '';
  rows.forEach((row, y) => { let x = 0; while (x < row.length) { if (row[x] === '#') { let w = 1; while (row[x + w] === '#') w++; r += `<rect x="${x}" y="${y}" width="${w}" height="1"/>`; x += w; } else x++; } });
  const w = Math.max(...rows.map(q => q.length));
  return `<svg class="svgi" viewBox="0 0 ${w} 9" ${size ? `style="width:${size}px;height:${size}px"` : ''} aria-hidden="true">${r}</svg>`;
}
function hydrateIcons(root) {
  for (const el of (root || document).querySelectorAll('[data-svg]')) {
    const svg = svgIcon(el.dataset.svg);
    if (el.tagName === 'I') el.outerHTML = svg; else el.innerHTML = svg;
  }
}

// ---------------- Saves ----------------
const Save = (() => {
  const KEY = 'entropy.save.v1';
  let db = null, uid = null, writing = false, timer = null;
  function merge(p) {
    const d = defaultProfile();
    if (!p || typeof p !== 'object') return d;
    const out = Object.assign(d, p);
    out.settings = Object.assign(defaultProfile().settings, p.settings || {});
    out.webV = p.webV || 1;
    out.alloc = Array.isArray(p.alloc) ? p.alloc.filter(id => TREE.nodes[id]) : ['start'];
    if (!out.alloc.includes('start')) out.alloc.unshift('start');
    if (!Array.isArray(out.builds) || out.builds.length !== 5) out.builds = [null, null, null, null, null];
    return out;
  }
  function loadLocal() { try { const s = localStorage.getItem(KEY); return s ? merge(JSON.parse(s)) : null; } catch (e) { return null; } }
  function save() {
    PROF.updatedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(PROF)); } catch (e) {}
    queue();
  }
  function queue() { if (!db) return; clearTimeout(timer); timer = setTimeout(flush, 1500); }
  async function flush() {
    if (!db) return;
    if (writing) { timer = setTimeout(flush, 1000); return; }
    writing = true;
    try { await db.doc('data/users/' + uid + '/save').set({ json: JSON.stringify(PROF), updatedAt: PROF.updatedAt || Date.now(), v: 1 }); UI.cloud(true); }
    catch (e) { if (e && (e.code === 'revoked' || e.code === 'not_granted')) db = null; UI.cloud(false); }
    writing = false;
  }
  async function initRemote() {
    try {
      if (!window.claude || !window.claude.use) return;
      const [d, u] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!d || !u) return;
      const id = await u.id();
      if (!id) return;
      db = d; uid = id;
      const snap = await db.doc('data/users/' + uid + '/save').get();
      if (snap.exists) {
        let remote = null;
        try { remote = merge(JSON.parse(snap.data().json)); } catch (e) {}
        if (remote && (remote.updatedAt || 0) > (PROF.updatedAt || 0) && !(G && !G.over)) {
          PROF = remote;
          if (migrateWeb()) { PROF.updatedAt = Date.now(); UI.toast('PASSIVE WEB REBUILT', 'Doctrines have arrived. All your points are refunded: pick a play style', '#ffb03a'); queue(); }
          try { localStorage.setItem(KEY, JSON.stringify(PROF)); } catch (e) {}
          UI.refreshAll();
        } else queue();
      } else queue();
      UI.cloud(true);
    } catch (e) { db = null; }
  }
  return { loadLocal, save, initRemote, merge, flushNow: flush };
})();

// ---------------- UI ----------------
const UI = (() => {
  let screen = 'hangar', panel = null, pick = null, hudFull = false, toastQ = [], logLines = [], modalOpen = null, modalFrom = null;
  let hudClock = 0, cloudOk = null, setup = { startWave: 1, chaos: 1, seed: 0, map: null, mode: 'std' };
  let confirmAbandon = false, confirmReset = false, confirmWebReset = false;
  const stage = () => $('#stage');

  function show(id) {
    // the web is a .screen too: switching screens while it's open would hide it but leave Tree.isOpen set, which halts the game
    try { if (id !== 'tree' && Tree.isOpen) Tree.close(); } catch (e) { /* Tree not built yet during boot */ }
    for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
    screen = id;
    if (id !== 'tree') SFX.setTrack(id === 'game' ? 'game' : 'menu');
  }
  function cloud(ok) { cloudOk = ok; const c = $('#cloud'); if (c) { c.textContent = ok ? 'Synced' : 'This device'; c.className = 'cloud ' + (ok ? 'on' : ''); } }

  // ---------- Hangar ----------
  function renderHangar() {
    const hv = $('#hVer'); if (hv) hv.textContent = 'v' + VERSION;
    const L = profLevel(), free = pointsFree();
    $('#hLevel').textContent = L.level;
    $('#hXpFill').style.width = pct(L.into / L.need);
    $('#hBest').textContent = PROF.bestWave || '—';
    const hp = $('#hPts'); hp.hidden = free <= 0; hp.textContent = free + ' pt' + (free === 1 ? '' : 's');
    $('#bWebH').classList.toggle('glow', free > 0);
    const nv = PROF.nova || 0, done = regionsDone().length, req = novaLevelReq(nv), ready = novaReady();
    $('#hNovaBox').hidden = !nv; $('#hNova').textContent = nv;
    const bn = $('#bNova'); bn.hidden = !nv && done < 1; bn.classList.toggle('ready', ready);
    $('#hNovaSub').textContent = ready ? 'Ready' : PROF.runSnap && done >= 3 && L.level >= req ? 'Finish your run' : `${Math.min(done, 3)}/3 constellations · Lv ${req}`;
    const snap = PROF.runSnap;
    $('#bLaunch2').hidden = !snap;
    $('#bLaunch').firstChild.textContent = snap ? 'Resume' : 'Play';
    const dk = dailyKey(), dd = PROF.daily && PROF.daily.date === dk ? PROF.daily : null;
    $('#hPlaySub').textContent = snap ? `Wave ${snap.wave} · ${CHAOS_LEVELS[snap.chaos].name}` : (dd ? `Daily best: Wave ${dd.best}` : '');
  }

  // ---------- Setup ----------
  function openSetup() {
    const ls = PROF.lastSetup || { startWave: 1, chaos: 1 };
    setup.chaos = ls.chaos ?? 1;
    const maxStart = Math.max(1, Math.floor((PROF.bestWave - 5) / 5) * 5);
    setup.startWave = Math.min(ls.startWave || 1, maxStart);
    if (setup.startWave !== 1 && setup.startWave % 5) setup.startWave = 1;
    rerollMap();
    renderSetup();
  }
  function rerollMap() {
    setRows(CHAOS_LEVELS[setup.chaos ?? 1].rows);
    setCols(fitCols());
    setup.seed = Math.floor(Math.random() * 1e9);
    setup.map = genMap(mulberry32(setup.seed));
  }
  function renderSetup() {
    if (setup.mode === 'daily') return renderDaily();
    const maxStart = Math.max(1, Math.floor((PROF.bestWave - 5) / 5) * 5);
    const starts = [1]; for (let w = 5; w <= maxStart; w += 5) starts.push(w);
    const sw = setup.startWave;
    const credits = Math.round(320 + computeMods(PROF.alloc, null).startCredits + (sw > 1 ? 70 * (sw - 1) * (1 + 0.045 * (sw - 1)) : 0));
    const CH = CHAOS_LEVELS[setup.chaos];
    const f0 = stageFrac(CH.lanes.filter(w => w <= sw).length, CH.lanes.length), R0 = mapRegion(setup.map.core, f0);
    setup.frac = f0;
    modal(`
      <div class="card setup">
        <div class="ch"><h2>New Run</h2>${modeChips()}<button class="x" data-act="close">✕</button></div>
        <div class="setup-grid">
          <div class="col">
            <div class="lbl">Starting Wave</div>
            <div class="chips wrap">${starts.map(w => `<button class="chip ${w === sw ? 'on' : ''}" data-act="sw" data-v="${w}">${w}</button>`).join('')}</div>
            <p class="note">${starts.length === 1 ? 'Reach Wave 10 to unlock later starts.' : sw === 1 ? 'Later starts skip early waves and grant bonus credits.' : `${fmt(credits)} starting credits. Tougher enemies, bigger rewards.`}</p>
            <div class="lbl">Chaos</div>
            <div class="chips">${CHAOS_LEVELS.map((c, i) => `<button class="chip ${i === setup.chaos ? 'on' : ''} ${i === 3 ? 'hot' : ''}" data-act="ch" data-v="${i}">${c.name}</button>`).join('')}</div>
            <p class="note">Enemy HP ×${CH.hp} · Events ×${CH.ev} · Storms ×${CH.storm} · Elites ×${CH.elite}${CH.cr ? ` · Credits ×${CH.cr}` : ""} · <b class="amber">Score ×${CH.score}</b></p>
            <p class="note">${tipify('Evolution')}: ${esc(CH.evo ? CH.evo.desc : '')}</p>
            <p class="note">Sector ${R0.x1 - R0.x0}×${R0.y1 - R0.y0} → ${COLS}×${ROWS} · ${CH.lanes.length} wormholes${CH.lanes[0] <= 1 ? ', one at start' : ''}</p>
          </div>
          <div class="col">
            <div class="lbl">Map</div>
            <canvas id="mapPrev" width="320" height="150"></canvas>
            <div class="row"><button class="btn small" data-act="reroll">Reroll Map</button><span class="note">Each wormhole expands the sector.</span></div>
          </div>
        </div>
        <div class="foot"><button class="btn primary" data-act="launch">Start · Wave ${sw}</button></div>
      </div>`, 'setup');
    Render.preview_map($('#mapPrev'), setup.map, setup.frac);
  }
  function modeChips() {
    return `<div class="chips"><button class="chip ${setup.mode === 'std' ? 'on' : ''}" data-act="mode" data-v="std">Standard</button><button class="chip ${setup.mode === 'daily' ? 'on' : ''}" data-act="mode" data-v="daily" style="--c:#b86cff">Daily</button></div>`;
  }
  function renderDaily() {
    const spec = dailySpec(dailyKey());
    setCols(fitCols());
    setRows(CHAOS_LEVELS[spec.chaos].rows); setCols(fitCols());
    setup.daily = spec; setup.seed = spec.seed; setup.map = genMap(mulberry32(spec.seed));
    const d = PROF.daily && PROF.daily.date === spec.date ? PROF.daily : null;
    modal(`
      <div class="card setup">
        <div class="ch"><h2>New Run</h2>${modeChips()}<button class="x" data-act="close">✕</button></div>
        <div class="setup-grid">
          <div class="col">
            <div class="lbl">Daily Challenge · ${spec.date}</div>
            <p class="note">Same map and anomalies for everyone today. Unstable chaos. Resets at midnight.</p>
            <div class="anlist">${spec.anoms.map(id => { const A = ANOMALIES.find(a => a.id === id); return `<div><b>${esc(A.name)}</b><span class="good">${tipify(A.up)}</span><span class="bad">${tipify(A.down)}</span></div>`; }).join('')}</div>
            <p class="note">${d ? `Today's best: Wave ${d.best} · ${fmt(d.score)} · ${d.tries} ${d.tries === 1 ? 'attempt' : 'attempts'}` : 'No attempts yet today.'}</p>
          </div>
          <div class="col">
            <div class="lbl">Map</div>
            <canvas id="mapPrev" width="320" height="150"></canvas>
          </div>
        </div>
        <div class="foot"><button class="btn primary" data-act="launchDaily">Start Daily</button></div>
      </div>`, 'setup');
    Render.preview_map($('#mapPrev'), setup.map);
  }
  function launch(snap) {
    closeModal();
    show('game');
    Render.reset();
    requestAnimationFrame(() => { Render.resize(); });
    feedLines.length = 0; renderFeed();
    if (snap) resumeRun(snap);
    else if (setup.mode === 'daily') newRun({ seed: setup.daily.seed, chaos: setup.daily.chaos, startWave: 1, daily: setup.daily, cols: COLS });
    else {
      PROF.lastSetup = { startWave: setup.startWave, chaos: setup.chaos };
      newRun({ seed: setup.seed, chaos: setup.chaos, startWave: setup.startWave, cols: COLS });
    }
    Render.resetCam(); updateZoomBtn();
    if (!PROF.zoomHint) { PROF.zoomHint = 1; setTimeout(() => toast('BIGGER MAPS', 'Pinch or double-tap to zoom. Drag to pan.', '#6ae2ff', 1), 1200); }
    G.unlocks = []; G.bestAtStart = PROF.bestWave;
    if (!snap && G.wanted && briefMode() !== 'off') setTimeout(() => { if (G && screen === 'game' && G.wanted) wantedPoster(briefMode() === 'pause'); }, 2600);
    if (!snap && G.preAdapted) { const pa = G.preAdapted; setTimeout(() => { if (G && screen === 'game') toast('SWARM PRE-ADAPTED', `${pa.join(' and ')} already in its DNA. Plan your counters`, '#ff4d6a', 1); }, 1600); }
    hudFull = PROF.settings.hud === 'full';
    Render.full = hudFull; Render.nums = PROF.settings.dmgNums; Render.shakeOn = PROF.settings.shake;
    document.body.classList.toggle('hudfull', hudFull);
    closePanel();
    buildAbilityBar();
    updateHud(true);
    Save.save();
    try { navigator.wakeLock && navigator.wakeLock.request('screen').catch(() => {}); } catch (e) {}
    if (!PROF.seenHelp) { PROF.seenHelp = true; openHelp(); }
  }

  // v4.4 Most Wanted: the run's bounty poster
  function wantedPoster(card) {
    const Wd = G && G.wanted; if (!Wd) return;
    const M = WANTED_MODS.find(m => m.id === Wd.mod);
    if (card && !modalOpen && !Tree.isOpen) {
      G.paused = true; G.briefing = true;
      modal(`<div class="card narrow brief wanted"><div class="ch"><h2>Most Wanted</h2><span class="note">Wave ${Wd.w}</span></div>
        <p class="wname">${esc(Wd.name)}</p><p class="note">Wanted for ${esc(Wd.crime)}.</p>${M ? `<p>${tipify(M.desc)}.</p>` : ''}
        <p class="amber">Reward: ${fmt(Wd.bounty)} credits and a Legendary schematic${M && M.loaded ? " (double, plus a Captain's Chest)" : ''}.</p>
        <div class="foot"><span class="note">Tap the Wanted chip any time to see this again</span><button class="btn primary" data-act="brief">Got it</button></div></div>`, 'brief');
      return;
    }
    toast('MOST WANTED', `${Wd.name} · Wave ${Wd.w} · wanted for ${Wd.crime}. ${M ? M.desc + '. ' : ''}Reward: ${fmt(Wd.bounty)} credits and a Legendary schematic${M && M.loaded ? ' (double, plus a Captain\'s Chest)' : ''}`, '#ffd84a', true);
  }
  // ---------- HUD ----------
  // Overdrive from the rail: first tap arms it for 3 s, second tap releases
  let odArm = false, odArmT = null;
  function overdriveTap() {
    if (!G || G.over) return;
    SFX.play('ui');
    if (G.odUsed) { toast('OVERDRIVE', `Already used on Wave ${G.odUsed}. One per run`, '#8a8fa8'); return; }
    if (!odReady()) { toast('OVERDRIVE', `Charges at Wave ${OD_WAVE}: one board clear per run (bosses survive)`, '#8a8fa8'); return; }
    if (!odArm) { odArm = true; clearTimeout(odArmT); odArmT = setTimeout(() => { odArm = false; updateHud(); }, 3000); updateHud(); toast('OVERDRIVE ARMED', 'Tap again to erase every non-boss enemy. One use per run', '#59f0b4', true); return; }
    odArm = false; clearTimeout(odArmT);
    const r = releaseOverdrive();
    if (r === 'empty') { SFX.play('deny'); toast('OVERDRIVE', 'Nothing to clear yet. Save it for a crowd', '#ff4d6a'); }
    else if (r !== 'ok') SFX.play('deny');
    else { closePanel(); toast('OVERDRIVE', `${G.stats.odKills} enemies erased`, '#59f0b4'); }
    updateHud();
  }
  function buildAbilityBar() {
    $('#abils').innerHTML = `<button class="rb od" id="bOD" aria-label="Overdrive">${svgIcon('overdrive')}<span>Overdrive</span></button>` +
      ABIL_ORDER.slice().reverse().map(k => `<button class="rb abil" data-abil="${k}" aria-label="${esc(ABILITIES[k].name)}" hidden>${svgIcon(k)}<span>${esc(ABILITIES[k].short)}</span><em class="cnt">0</em></button>`).join('');
  }
  function updateHud(force) {
    if (!G) return;
    const c = G.core;
    $('#hpfill').style.width = pct(Math.max(0, c.hp / c.max));
    $('#shfill').style.width = pct(c.smax ? c.shield / c.smax : 0);
    $('#hptxt').textContent = `${Math.max(0, Math.ceil(c.hp))}${c.shield >= 1 ? '+' + Math.floor(c.shield) : ''}`;
    $('#hpbar').classList.toggle('low', c.hp / c.max < 0.3);
    $('#cr').textContent = fmt(G.credits);
    $('#wave').textContent = G.wave;
    const cpWait = G.spawningDone && cpPending();
    $('#nextw').textContent = G.checkpoint ? 'Checkpoint' : cpWait ? `${G.enemies.length} left · Checkpoint next` : G.spawningDone ? `in ${Math.max(0, Math.ceil(G.next))}s` : `${G.queue.length + G.enemies.length} left`;
    $('#score').textContent = fmt(G.score);
    const canCall = G.spawningDone && G.next > 0.5 && !G.checkpoint && !cpWait;
    const cb = $('#bCall');
    cb.disabled = !canCall && !G.checkpoint;
    cb.classList.toggle('cp', !!G.checkpoint);
    cb.querySelector('span').textContent = G.checkpoint ? 'Resume' : 'Next';
    const cpb = G.checkpoint ? cpBonus() : null;
    cb.querySelector('b').textContent = G.checkpoint ? (cpb.cr ? '+' + fmt(cpb.cr) : '') : canCall ? '+' + fmt(Math.round(Math.ceil(G.next) * (2 + G.wave * 0.6) * G.mods.credits)) : '';
    $('#cpBanner').hidden = !G.checkpoint || !!G.reloc;
    if (G.checkpoint) { const t = Math.max(0, Math.ceil(CP_WINDOW - G.cpT)); $('#cpBanner').querySelector('span').textContent = cpb.f > 0 ? `Resume within ${t}s for +${fmt(cpb.cr)} credits and +${fmt(cpb.sc)} score` : 'Speed bonus expired · Full refunds and free respec still active'; $('#cpFill').style.width = pct(cpb.f); }
    $('#bCash').classList.toggle('on', !!(panel && panel.kind === 'cash'));
    const sp = $('#bSpeed'); sp.querySelector('b').textContent = G.speed + '×'; sp.classList.toggle('fast', G.speed > 1);
    { const ob = $('#bOD'); if (ob) { const ready = odReady(), lbl = G.odUsed ? 'Used' : ready ? (odArm ? 'Again!' : 'Overdrive') : 'W' + OD_WAVE;
      ob.classList.toggle('ready', ready && !odArm); ob.classList.toggle('arm', ready && odArm); ob.classList.toggle('dim', !ready);
      const sp = ob.querySelector('span'); if (sp.textContent !== lbl) sp.textContent = lbl; } }
    for (const k of ABIL_ORDER) {
      const n = G.charges[k], btn = document.querySelector(`[data-abil="${k}"]`);
      if (!btn) continue;
      btn.querySelector('.cnt').textContent = n > 1 ? n : '';
      btn.hidden = n <= 0;
      btn.classList.toggle('aim', G.aimAbility === k);
    }
    const free = pointsFree();
    $('#bStats').classList.toggle('on', hudFull);
    const eb = $('#bEnt');
    $('#entFill').style.height = pct(Math.min(1, G.entropy / 100));
    $('#entTxt').textContent = G.anomOffers ? 'DRAW' : Math.floor(G.entropy) + '%';
    eb.classList.toggle('ready', !!G.anomOffers);
    $('#entCount').textContent = G.anoms.length ? '×' + G.anoms.length : '';
    $('#webBadge').textContent = free > 0 ? free : '';
    $('#webBadge').hidden = free <= 0;
    // chips: events + storms
    const chips = [];
    if (G.spawningDone && G.prep) {
      const P = G.prep;
      if (P.boss) chips.push(`<span class="evchip next bad">Boss ${P.boss.odd ? "???" : esc(P.boss.name)}</span>`);
      if (G.wanted && !G.wanted.done && G.wanted.w > G.wave) chips.push(`<span class="evchip wanted" data-wanted="1">Wanted · W${G.wanted.w}</span>`);
      for (const [g, v] of Object.entries(P.genes || {}).filter(([g, v]) => v >= 0.2).sort((a, b) => b[1] - a[1]).slice(0, 3))
        chips.push(`<span class="evchip gene" data-gene="${g}" style="--c:${GENES[g].col}">${GENES[g].name} ${Math.round(v * 100)}%</span>`);
      chips.push(`<span class="evchip next">Next ${P.total}${P.fly ? ' · ' + P.fly + ' air' : ''}${P.elites ? ' · ' + P.elites + ' elite' : ''}</span>`);
      for (const E of P.list) chips.push(`<span class="evchip next ${E.good ? 'good' : 'bad'}">${esc(E.name)}</span>`);
    }
    if (!(G.spawningDone && G.prep) && geneCap(G.wave) > 0) {
      const gs = Object.entries(geneShares()).filter(([g, v]) => v >= 0.15).sort((a, b) => b[1] - a[1]).slice(0, 2);
      chips.unshift(`<span class="evchip dna${performance.now() < dnaPulse ? ' pulse' : ''}" data-evo="1">DNA${gs.length ? ' · ' + gs.map(([g, v]) => `<i style="color:${GENES[g].col}">${GENES[g].name} ${Math.round(v * 100)}%</i>`).join(' ') : ' · stable'}</span>`);
    }
    // assault banner (top of the field): warn shows the strain's genes, live shows what's left and the leak budget
    const AS = G.assault, asb = $('#asbar'); let asH = '';
    if (AS && AS.state === 'warn') asH = `<b>STRAIN ASSAULT · WAVE ${AS.w}</b><span>${AS.genes.map(g => `<i style="color:${GENES[g].col}">${GENES[g].name}${g === 'ward' && AS.el ? ' ' + EL[AS.el].name : ''}</i>`).join(' · ')}</span><em>${G.refit ? 'Selling is free' : ''}</em>`;
    else if (AS && AS.state === 'live') { const left = AS.n - AS.killed - AS.leaked, lim = assaultLimit(AS); asH = `<b>${esc(AS.name)}</b><span>${left} left</span><em class="${AS.leaked > lim ? 'lost' : ''}">Leaks ${AS.leaked}/${lim}</em>`; }
    if (asb) { const on = !!asH && !(G.bossAlive && !G.bossAlive.dead); if (asb.dataset.h !== asH) { asb.innerHTML = asH; asb.dataset.h = asH; } if (asb.hidden === on) asb.hidden = !on; document.body.classList.toggle('asbar', on); }
    { // Doctrine meters, bottom right of the field
      const db = $('#docbar'), parts = [];
      if (G.mods.ks.wildfire) parts.push(`<span class="heat">Road heat <b>${Math.round(G.heat * 100)}%</b><i>/${Math.round(wildHeatCap() * 100)}</i></span>`);
      if (G.mods.ks.wareco) { const wt = warTier(), st = warStep(); parts.push(`<span class="chest">War chest <b>${wt}/8</b><i>${wt < 8 ? 'next at ' + fmt((wt + 1) * st) : 'full'}</i></span>`); }
      if (G.mods.ks.marksman) parts.push(`<span class="mark">Marksman <b>+2</b><i>free Overcharge</i></span>`);
      if (G.mods.ks.circuit) { const ch = G.chains || [], big = ch.reduce((a, c) => Math.max(a, c.m.length), 0); parts.push(`<span class="circ">Chains <b>${ch.length}</b><i>longest ${big}${big >= 4 ? ' · lightning' : ' · need 4'}</i></span>`); }
      if (G.mods.ks.glacier) { const j = G.enemies.filter(e => e.jammed).length; parts.push(`<span class="ice">Ice jam <b>${j}</b><i>held</i></span>`); }
      if (G.mods.ks.horizon) parts.push(`<span class="hor">Gravity wells <b>${(G.wells || []).length}</b></span>`);
      if (G.mods.ks.artisan) { const at = G.towers.filter(t => canOvercharge(t)), v = at.filter(t => t.rank > 0).length; parts.push(`<span class="art">Veterans <b>${v}/${at.length}</b><i>rookies −25%</i></span>`); }
      if (G.mods.ks.gambler) parts.push(`<span class="gam">Gambler <b>×${num1(G.scoreMult || 1)}</b><i>score</i></span>`);
      const h = parts.join(''); if (db && db.dataset.h !== h) { db.innerHTML = h; db.dataset.h = h; db.hidden = !h; }
    }
    for (const E of G.evList) chips.push(`<span class="evchip ${E.good ? 'good' : 'bad'}" title="${esc(E.desc)}">${esc(E.name)}</span>`);
    if (G.flux) chips.push(`<span class="evchip storm" style="--c:${EL[G.flux.el].col}">${EL[G.flux.el].name} ×2</span>`);
    for (const s of G.storms) chips.push(`<span class="evchip storm" style="--c:${s.mael ? '#ff4d6a' : STORMS[s.types[0]].col}">${esc(stormName(s))}</span>`);
    G.laneWarn = null; for (const L of G.map.lanes) if (L.openWave) { const d = L.openWave - G.wave; if (d >= 1 && (!G.laneWarn || d < G.laneWarn)) G.laneWarn = d; }
    if (G.laneWarn) chips.unshift(`<span class="evchip warn ${G.laneWarn === 1 ? 'bad' : 'storm'}" style="--c:#d6a6ff">${G.laneWarn === 1 ? 'Wormhole opens next wave' : 'Wormhole opens in ' + G.laneWarn + ' waves'}</span>`);
    if (G.overclockT > 0) chips.push('<span class="evchip good">Frenzy</span>');
    if (G.stasisT > 0) chips.push('<span class="evchip good">Stasis</span>');
    // order by what you need to act on first; anything that doesn't fit goes behind a "+N" chip (the Field Report)
    const prio = h => /evchip warn/.test(h) ? 0 : /next bad">Boss/.test(h) ? 1 : /data-wanted/.test(h) ? 2 : /evchip next">Next/.test(h) ? 3 : /data-evo/.test(h) ? 4 : /evchip (bad|good)"/.test(h) ? 5 : /storm/.test(h) ? 6 : /next (bad|good)/.test(h) ? 7 : 8;
    chips.sort((a, b) => prio(a) - prio(b));
    chipList = chips;
    const html = chips.join('');
    const pwEl = $('#pw'); if (pwEl) { const u = gridUsed(), c = gridCap(), tx = `${u}/${c}`; if (pwEl.textContent !== tx) pwEl.textContent = tx; pwEl.parentNode.classList.toggle('full', u >= c);
      // spare power during a wave is wasted: the counter pulses, and a tap puts it on your best tower (Nic never used Overcharge)
      pwEl.parentNode.classList.toggle('spare', c - u >= 1 && !G.spawningDone && G.wave >= 4 && !!topTower()); }
    const ch = $('#chips');
    if (ch.dataset.h !== html || ch.dataset.w !== String(ch.clientWidth)) { ch.innerHTML = html; ch.dataset.h = html; ch.dataset.w = String(ch.clientWidth); fitChips(ch); }
    if (hudFull) renderDps();
    renderFeed();
    liveRefreshPanel();
    // the score follows the action: the run's depth, how busy the field is right now, bosses and Maelstroms
    const boss = !!(G.bossAlive && !G.bossAlive.dead);
    SFX.music.setIntensity(0.2 + Math.min(0.3, G.wave / 70) + Math.min(0.22, G.enemies.length / 90) + (boss ? 0.25 : 0) + (G.storms.some(s => s.mael) ? 0.12 : 0) - (G.paused ? 0.15 : 0));
    SFX.music.setMood(boss ? 'boss' : 'calm');
  }
  let chipList = [];
  function fitChips(ch) {
    const kids = [...ch.children]; if (!kids.length) return;
    const W = ch.clientWidth; let x = 0, hidden = 0;
    for (const k of kids) { x += k.offsetWidth + 5; if (x > W - (hidden || kids.indexOf(k) < kids.length - 1 ? 46 : 0)) { k.hidden = true; hidden++; } }
    if (hidden) { const m = document.createElement('span'); m.className = 'evchip more'; m.dataset.more = '1'; m.textContent = '+' + hidden; ch.appendChild(m); }
  }
  // the Field Report: every chip in full, one per line, with what each event does
  function openReport() {
    if (!G) return;
    const rows = chipList.map(h => { const m = /title="([^"]*)"/.exec(h); return `<div class="rrow">${h.replace(/ title="[^"]*"/, '')}${m ? `<span>${m[1]}</span>` : ''}</div>`; }).join('');
    G.paused = true;
    modal(`<div class="card narrow report"><div class="ch"><h2>Field Report</h2><span class="note">Wave ${G.wave}</span><button class="x" data-act="resume" aria-label="Close">✕</button></div>
      <div class="rlist">${rows || '<p class="note">Nothing to report.</p>'}</div>
      <div class="foot">${geneCap(G.wave) > 0 ? '<button class="btn" data-act="evoR">Swarm DNA</button>' : ''}${G.wanted && !G.wanted.done ? '<button class="btn" data-act="wantR">Most Wanted</button>' : ''}<button class="btn primary" data-act="resume">Continue</button></div></div>`);
  }
  function renderDps() {
    const list = G.towers.filter(t => t.s.kind !== 'support' && t.s.kind !== 'eco').sort((a, b) => b.dps - a.dps).slice(0, 6);
    const max = Math.max(1, ...list.map(t => t.dps), G.core.dps || 0);
    const total = G.towers.reduce((a, t) => a + t.dps, 0);
    $('#dps').innerHTML = `<div class="dh">DPS <b>${fmt(total)}</b></div>` + list.map(t => `<div class="drow"><span>${esc(TOWERS[t.type].name)} ${t.lvl}</span><i style="width:${Math.round(t.dps / max * 100)}%;background:${EL[t.s.el].col}"></i><b>${fmt(t.dps)}</b></div>`).join('');
  }
  const toastHeld = [], toastSeen = {};
  // v4.0 notifications, three channels so the centre of the screen stays clear:
  //  ALERT: rare cards for things you should react to (a strain assault, a wormhole, pirates, the worm eating a tower).
  //         One at a time, wrapped text, tap to dismiss.
  //  TIP:   instant feedback to something you just tapped (not enough power, reactor expanded). Replaces itself, never queues.
  //  FEED:  everything else (combos, salvage, boons, veterans, boss phases) goes to a small fading list in the corner.
  const ALERT_RE = /^(STRAIN|SWARM PRE-ADAPTED|WORMHOLE|PIRATES|CAPTAIN|LOOT STOLEN|THE WORM HUNTS|DIGESTED|MAELSTROM|CHECKPOINT|OVERDRIVE ONLINE|PASSIVE WEB REBUILT|UPDATING|GALAXY REBORN|CONSTELLATION|LEVEL UP|NODE BEACON|RED ALERT|MOST WANTED|BOUNTY)/;
  const TIP_RE = /^(NOT ENOUGH|NO ROUTE|RELOCATE|OVERDRIVE|OVERCHARGED|SPARE POWER|POWER$|GRID FULL|REACTOR|CORE RELOCATED|CASHED IN|LOG |INVALID|FULL SCREEN|CAN'T|ORBITAL|BIGGER MAPS|ENTROPY$|SPEED BONUS|BOON|ANOMALY|STABILIZED|SAVE |PROFILE|NOTHING|REFIT)/;
  const KEY_RE = /^(RED ALERT|WORMHOLE|STRAIN|MAELSTROM|CHECKPOINT|PIRATES|LOOT STOLEN|THE WORM HUNTS|DIGESTED)/;
  const toastNQ = []; let toastBusy = false, toastT = null, tipT = null, dnaPulse = 0;
  function toastKind(title) { return ALERT_RE.test(title) ? 'alert' : TIP_RE.test(title) ? 'tip' : 'feed'; }
  function toast(title, body, col, force) {
    const key = title + '|' + body, now = performance.now();
    if (toastSeen[key] !== undefined && now - toastSeen[key] < 4000) return;
    toastSeen[key] = now;
    let kind = screen !== 'game' ? (TIP_RE.test(title) ? 'tip' : 'alert') : toastKind(title);
    // Settings > Notifications: Key keeps only the cards you must react to; Off keeps none (tips answering your own taps stay)
    const nm = PROF.settings.notes || 'all';
    if (screen === 'game' && !force && kind === 'alert' && (nm === 'off' || (nm === 'key' && !KEY_RE.test(title)))) { feed(title, body, col, true); return; }
    if (/^SWARM EVOLVES/.test(title)) dnaPulse = now + 9000;
    if (kind === 'feed') { feed(title, body, col); return; }
    if (kind === 'tip') { flashTip(title, body, col); return; }
    if (!force && screen === 'game' && (modalOpen || Tree.isOpen)) { toastHeld.push([title, body, col]); if (toastHeld.length > 3) toastHeld.shift(); return; }
    if (toastNQ.some(t => t.title === title)) return;
    toastNQ.push({ title, body, col });
    while (toastNQ.length > 2) feed(...Object.values(toastNQ.shift()));
    if (!toastBusy) nextToast();
  }
  function flashTip(title, body, col) {
    const el = $('#tip'); if (!el) return;
    el.style.setProperty('--c', col || '#ffb03a');
    el.innerHTML = `<b>${esc(title)}</b>${body ? `<span>${esc(body)}</span>` : ''}`;
    el.hidden = false; el.classList.remove('out'); document.body.classList.add('tipon');
    clearTimeout(tipT); tipT = setTimeout(() => { el.classList.add('out'); tipT = setTimeout(() => { el.hidden = true; document.body.classList.remove('tipon'); }, 300); }, 1700 + Math.min(2200, (body || '').length * 30));
  }
  function nextToast() {
    const t = toastNQ.shift(); if (!t) { toastBusy = false; return; }
    toastBusy = true;
    const box = $('#toasts');
    box.innerHTML = '';
    const d = document.createElement('div');
    d.className = 'toast'; d.style.setProperty('--c', t.col || '#ffb03a');
    d.innerHTML = `<b>${esc(t.title)}</b><span>${esc(t.body)}</span>`;
    box.appendChild(d);
    feed(t.title, t.body, t.col, true);
    const end = () => { if (!d.isConnected || d.classList.contains('out')) return; clearTimeout(toastT); d.classList.add('out'); setTimeout(() => { d.remove(); nextToast(); }, 300); };
    d.onclick = end;
    const dur = Math.min(5600, 2600 + (t.body || '').length * 35);
    toastT = setTimeout(end, toastNQ.length ? 2400 : dur);
  }
  // the feed: recent events in the corner. Old ones fade; with Stats on it keeps the last few
  const feedLines = [];
  function feed(title, body, col, quiet) {
    const now = performance.now(), last = feedLines[feedLines.length - 1];
    if (last && last.title === title && last.body === body) { last.n++; last.t = now; renderFeed(); return; }
    feedLines.push({ title, body, col, t: now, n: 1, quiet: !!quiet });
    if (feedLines.length > 8) feedLines.shift();
    renderFeed();
  }
  const feedTitle = t => t.split(' ').map(w => /^[IVX]+$/.test(w) || w.length < 2 ? w : w[0] + w.slice(1).toLowerCase()).join(' ');
  let feedH = '';
  function renderFeed() {
    const l = $('#log'); if (!l) return;
    const now = performance.now();
    const nm = PROF.settings.notes || 'all';
    const show = hudFull ? feedLines.slice(-6) : nm !== 'all' ? [] : feedLines.filter(x => !x.quiet && !x.minor && now - x.t < 7000).slice(-3);
    const html = show.map(x => `<div class="fl ${!hudFull && now - x.t > 5500 ? 'old' : ''}" style="--c:${x.col || '#c9c6bc'}">${x.title ? `<b>${esc(feedTitle(x.title))}</b> ` : ''}${esc(x.body || '')}${x.n > 1 ? ` <i>×${x.n}</i>` : ''}</div>`).join('');
    if (html !== feedH) { l.innerHTML = html; feedH = html; }
  }
  // boss arrival: a portrait card and a moment of slow motion, so every boss gets its entrance
  let bossT = null;
  const briefMode = () => PROF.settings.briefings || 'pause';
  function bossIntro(e, B) {
    const box = $('#bossIntro'); if (!box) return;
    const first = !PROF.codex.bosses[B.id];
    if (briefMode() === 'off') { log(`${B.name} incoming`, '#ff4d6a'); return; }
    if (briefMode() === 'pause' && !modalOpen && !Tree.isOpen && screen === 'game') {
      const tag = e.wanted ? `Most Wanted · ${(WANTED_MODS.find(m => m.id === e.wanted) || { name: '' }).name} · ${fmt(G.wanted ? G.wanted.bounty * (e.wantedLoaded ? 2 : 1) : 0)} bounty` : first ? 'New boss · first encounter' : B.odd ? 'Boss?!' : 'Boss incoming';
      closePanel(); G.paused = true; G.briefing = true;
      modal(`<div class="card narrow brief boss"><div class="bwrap"><canvas width="112" height="112"></canvas><div class="bi"><em>${esc(tag)}</em><h3>${esc(B.name)}</h3>${e.bossTitle ? `<p class="ttl">${esc(e.bossTitle)}</p>` : ''}<p class="desc">${tipify(B.desc)}</p>
        <p class="ph">${esc(B.id === 'gloop' ? 'Pop it. Then pop the pieces.' : `Phase II at 66% and a final phase at 33%: each time it unleashes ${BOSS_POWER[B.id] || 'its power'}.`)} If it reaches your core, the run is over.</p></div></div>
        <div class="foot"><span class="note">Change this in Settings · Briefings</span><button class="btn primary" data-act="brief">Fight</button></div></div>`, 'brief');
      Render.bossPortrait(B.id, $('#modal canvas'));
      log(`${B.name} incoming`, '#ff4d6a'); return;
    }
    box.querySelector('em').textContent = e.wanted ? `MOST WANTED · ${(WANTED_MODS.find(m => m.id === e.wanted) || { name: '' }).name.toUpperCase()} · ${fmt(G.wanted ? G.wanted.bounty * (e.wantedLoaded ? 2 : 1) : 0)} BOUNTY` : first ? 'NEW BOSS · FIRST ENCOUNTER' : B.odd ? 'BOSS?!' : 'BOSS INCOMING';
    box.querySelector('h3').textContent = B.name;
    box.querySelector('.ttl').textContent = e.bossTitle || '';
    box.querySelector('.desc').textContent = B.desc;
    box.querySelector('.ph').textContent = (B.id === 'gloop' ? 'Pop it. Then pop the pieces.' : `Phase II at 66% and a final phase at 33%: each time it unleashes ${BOSS_POWER[B.id] || 'its power'}.`) + ' If it reaches your core, the run is over.';
    Render.bossPortrait(B.id, box.querySelector('canvas'));
    box.classList.remove('out'); box.hidden = false;
    UI.slowmo = 1.4;
    clearTimeout(bossT);
    const hide = () => { box.classList.add('out'); bossT = setTimeout(() => { box.hidden = true; box.classList.remove('out'); }, 350); };
    box.onclick = () => { clearTimeout(bossT); UI.slowmo = 0; hide(); };
    bossT = setTimeout(hide, first ? 4800 : 3400);
    log(`${B.name} incoming`, '#ff4d6a');
  }
  // minor sim events: only shown in the feed when Stats is on
  function log(text, col) {
    feedLines.push({ title: '', body: text, col, t: performance.now(), n: 1, minor: true });
    if (feedLines.length > 8) feedLines.shift();
    renderFeed();
  }

  // ---------- Panels ----------
  function closePanel() {
    panel = null; pick = null;
    $('#panel').hidden = true;
    Render.sel = null; Render.selT = null; Render.prev = null;
    if (G) { G.selCore = false; G.reloc = null; }
    document.body.classList.remove('panel-l', 'panel-r');
  }
  function openPanel(p) {
    panel = p;
    const left = Render.tileToScreen(p.x + 0.5, p.y).x > Render.layout.W / 2;
    const el = $('#panel');
    el.hidden = false;
    el.className = 'panel ' + (left ? 'left' : 'right');
    document.body.classList.toggle('panel-l', left);
    document.body.classList.toggle('panel-r', !left);
    renderPanel();
  }
  function renderPanel() {
    if (!panel) return;
    const el = $('#panel');
    if (panel.kind === 'build') el.innerHTML = buildPanelHTML();
    else if (panel.kind === 'tower') el.innerHTML = towerPanelHTML(panel.t);
    else if (panel.kind === 'core') el.innerHTML = corePanelHTML();
    else if (panel.kind === 'cash') el.innerHTML = cashPanelHTML();
    else if (panel.kind === 'reloc') el.innerHTML = relocPanelHTML();
    for (const cv of el.querySelectorAll('canvas[data-ico]')) Render.towerIcon(cv.dataset.ico, cv);
    for (const cv of el.querySelectorAll('canvas[data-card]')) Render.towerCard(cv.dataset.card, cv, !!cv.dataset.lock);
    liveRefreshPanel();
  }
  function costBtn(cost) { return `data-cost="${cost}"`; }
  // tower and core panels: Actions (what you tap) and Details (what you read). Actions opens by default.
  function tabsHTML(note) { const t = panel.tab || 'act'; return `<div class="ptabs"><button class="chip ${t === 'act' ? 'on' : ''}" data-act="tab" data-v="act">Actions</button><button class="chip ${t === 'info' ? 'on' : ''}" data-act="tab" data-v="info">Details${note ? `<i>${note}</i>` : ''}</button></div>`; }
  // what each tower is for, in one line: a playstyle, not a stat sheet
  const TOWER_ROLE = {
    pulse: 'Anti-air all-rounder · fast shots, weak to Plating', rail: 'Pierces Plating and lines · slow, long range, hits air',
    cryo: 'Control · slows everything in its ring, air included', snare: 'Anti-air control · pulls fliers into a net',
    missile: 'Crowds, Brood and air · splash and Burn, weak to Plating', pylon: 'Support · boosts towers around it, reveals Cloak',
    coil: 'Shields and crowds · ×2.5 vs shields, chains', forge: 'Economy · credits every wave',
    flame: 'Ground crowds · Burn stops Regrowth · can\'t hit air', lens: 'Plating, Bulk and bosses · beam ignores Plating, weak vs swarms',
    emp: 'Control · stuns and strips shields, hits air', grav: 'Control · drags ground enemies back · can\'t hit air',
  };
  function buildPanelHTML() {
    const order = TOWER_ORDER.filter(towerUnlocked).concat(TOWER_ORDER.filter(k => !towerUnlocked(k)));
    const tiles = order.map(k => {
      const D = TOWERS[k];
      if (!towerUnlocked(k)) return `<div class="bt locked" aria-label="${esc(D.name)} locked"><canvas class="tcard" data-card="${k}" data-lock="1"></canvas><span class="bn"><em>???</em><b>Wave ${D.unlock}</b></span></div>`;
      const cost = towerCost(k);
      return `<button class="bt ${pick === k ? 'on' : ''}" data-act="pick" data-type="${k}" aria-label="${esc(D.name)}" style="--c:${EL[D.el].col}"><canvas class="tcard" data-card="${k}"></canvas><span class="bn"><em>${esc(TSHORT[k] || D.name)}</em><b ${costBtn(cost)}>${fmt(cost)}</b></span></button>`;
    }).join('');
    let info, foot;
    if (pick) {
      const D = TOWERS[pick], cost = towerCost(pick);
      const stat = D.kind === 'snare' ? `Catches ${D.catches} fliers per wave · Lure range ${D.range}` : D.kind === 'support' ? `+${D.buffDmg}% Damage, +${D.buffRate}% Attack Speed · Range ${D.range}`
        : D.kind === 'eco' ? `+${D.income} credits per wave`
        : `Damage ${num1(D.dmg * G.mods.dmg * G.mods.el[D.el])} · ${num1(D.rate)}/s · Range ${num1(D.range * G.mods.range)}`;
      info = `<div class="binfo"><b>${esc(D.name)} <span style="color:${EL[D.el].col}">${EL[D.el].name}</span></b><p class="role">${tipify(TOWER_ROLE[pick] || '')}</p><p>${esc(D.blurb)}</p><p class="bst">${stat}</p></div>`;
      const full = gridFree() < 1 && !isNode(panel.x, panel.y);
      foot = full ? `<button class="btn primary wide" data-act="reactor" ${costBtn(reactorCost())}>Expand reactor · ${fmt(reactorCost())}<small>Grid full (${gridUsed()}/${gridCap()}): +1 power. Or upgrade, Overcharge or sell; Power Nodes are free</small></button>`
        : `<button class="btn primary wide" data-act="build" ${costBtn(cost)}>Build · ${fmt(cost)}<small>Uses 1 power · grid ${gridUsed()}/${gridCap()}</small></button>`;
    } else {
      info = `<div class="binfo"><p class="dim">Select a tower to see its range. Tap it again to build.</p></div>`;
      foot = gridFree() < 1 && !isNode(panel.x, panel.y) ? `<button class="btn primary wide" data-act="reactor" ${costBtn(reactorCost())}>Expand reactor · ${fmt(reactorCost())}<small>Grid full (${gridUsed()}/${gridCap()}): +1 power</small></button>` : '';
    }
    const nodeNote = isNode(panel.x, panel.y) ? `<div class="sts node">${tipify('Power Node: towers here draw no power and get +25% Damage, +15% Range (support and economy +25%)')}</div>` : '';
    return `<div class="ph"><b>Build</b><small class="grid ${gridFree() < 1 ? 'full' : ''}">Power ${gridUsed()}/${gridCap()}</small>${isNode(panel.x, panel.y) ? '<small class="node">Power Node</small>' : ''}<button class="x" data-act="close" aria-label="Close">✕</button></div><div class="bgrid">${tiles}</div>${nodeNote}${info}${foot ? `<div class="pfoot">${foot}</div>` : ''}`;
  }

  // ---------- tappable glossary terms ----------
  let GLOSS = null, glossRe = null;
  function buildGloss() {
    GLOSS = {};
    const D = dictData();
    for (const cat of D) if (['status', 'combos', 'terms'].includes(cat.id)) for (const [k, v] of cat.rows) GLOSS[k.toLowerCase()] = [k, v];
    const extra = [
      ['Power', 'Attribute. Each point adds +0.5% Damage.'], ['Tempo', 'Attribute. Each point adds +0.4% Attack Speed.'],
      ['Focus', 'Attribute. Each point adds +0.35% Range and +0.5% status chance.'], ['Integrity', 'Attribute. Each point adds +1.5 core HP and +0.4 shield.'],
      ['Kinetic', 'Physical element. Armor reduces it. Pairs with Frozen enemies for Shatter.'], ['Thermal', 'Fire element. Can Burn.'],
      ['Cryo', 'Cold element. Can Chill, and Freeze at 5 Chill stacks.'], ['Arc', 'Electric element. Can Shock.'], ['Void', 'Gravity element. Can Mark.'],
      ['Crit Chance', 'Chance for a hit to be a critical hit.'], ['Crit Damage', 'Extra damage dealt by critical hits.'],
      ['Armor penetration', 'Ignores this share of enemy Armor.'], ['Frozen', 'Held in place by Freeze. Kinetic hits on Frozen enemies Shatter.'],
      ['Chilled', 'Has Chill stacks, which slow it. At 5 stacks it Freezes.'], ['Shocked', 'Takes +15% damage while Shocked.'], ['Burning', 'On fire: takes Burn damage over time.'], ['Marked', 'Has Mark stacks. Each stack adds +5% damage taken.'],
      ['Elites', 'Enemies with 1 or more elite affixes.'], ['Storm', 'Drifting field on the map with an elemental effect. See Storms in the Dictionary.'],
      ['Remnant', 'A finished sector kept through a Supernova. Its notables stay active forever.'],
      ['Star Ranks', 'Unlimited points spent in a finished constellation. Each rank adds a little less than the last.'],
      ['Supernova', 'Prestige. Reset your level and web for a Remnant, a Cosmic Law, and permanent score and XP bonuses.'],
      ['Cosmic Law', 'Permanent rule change chosen at a Supernova. Adds score.'],
      ['Recalibration', 'Recalibration tokens pay for respecs during a run.'], ['Legendary', 'Highest affix rarity with a unique effect.'], ['Curse', 'A negative affix.'],
      ['Boss', 'Arrives every 10 waves, on the longest road.'], ['Snare Beacon', 'Pulls passing fliers off their straight line, through its net, then on to the core. Catches a set number per wave. Bosses are too big to lure.'], ['Skimmers', 'Flying enemies. They ignore the path.'], ['Resonance', 'Adjacent towers of different elements: +8% Damage per element.'],
    ];
    const named = [
      ...Object.values(TOWERS).map(T => [T.name, T.blurb]),
      ...Object.values(TOWERS).flatMap(T => (T.specs || []).map(sp => [sp.name, `${T.name} specialization. ${sp.desc}.`])),
      ...Object.values(ENEMIES).map(E => [E.name, E.desc + '.']),
      ...BOSSES.map(B => [B.name, `Boss. ${B.desc}.`]),
      ...ELITE_AFFIXES.map(E => [E.name, `Elite affix. ${E.desc}.`]),
      ...ANOMALIES.map(A => [A.name, `Anomaly. ${A.up}. Cost: ${A.down}.`]),
      ...LAWS.map(L => [L.name, `Cosmic Law. ${L.up}. Cost: ${L.down}.`]),
      ...LEGENDARIES.map(L => [L.name, `Legendary affix. ${L.t()}.`]),
      ...Object.values(STORMS).map(S => [S.name, `Storm. ${S.desc}.`]),
      ...EVENTS.map(E => [E.name, `Wave event. ${E.desc}.`]),
      ...GENE_IDS.map(g => [GENES[g].name, `Evolved trait. ${GENES[g].desc}. Counter: ${GENES[g].counter}.`]),
      ...MARKET_ITEMS.map(I => [I.name, `Black Market item. ${I.desc}.`]),
      ['Power', `Your grid. Every tower draws 1 power (towers on Power Nodes draw none); Overcharge draws more. Capacity is ${GRID.base} plus 1 every ${GRID.perWaves} waves.`],
      ['Overcharge', `Spend spare power on a tower: +${OVERCHARGE.dmg * 100}% Damage and +${OVERCHARGE.rate * 100}% Attack Speed per point, up to ${OVERCHARGE.max}. Change it any time, even mid-wave.`],
      ['Plating', 'Blunts every hit except piercing fire: Rail Lance, Void Lens beams, Burn and other damage over time, and abilities.'],
      ['Evolution', 'Waves are bred from the enemies that got furthest last time, so the swarm drifts towards whatever your defence handles worst. Counter what is spreading and it drifts away again.'],
      ['Common', 'Affix rarity. Base value.'], ['Magic', 'Affix rarity. ×1.7 value.'], ['Rare', 'Affix rarity. ×2.6 value.'],
      ['Leaks', 'Enemies that reached your core. Each one costs core HP.'], ['Lone Wolf', 'Bonus damage for towers with no neighbours.'],
    ];
    for (const [k, v] of named) if (k && v) GLOSS[k.toLowerCase()] = [k, esc(v)];
    for (const [k, v] of extra) GLOSS[k.toLowerCase()] = [k, v];
    const keys = Object.keys(GLOSS).sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    glossRe = new RegExp(`\\b(${keys.join('|')})(s|es)?\\b`, 'gi');
  }
  function tipify(str) {
    if (!GLOSS) buildGloss();
    return esc(String(str)).replace(glossRe, (m, a) => { const g = GLOSS[a.toLowerCase()]; return g ? `<span class="tip" data-tip="${esc(g[0])}">${m}</span>` : m; });
  }
  globalThis.tipify = tipify;
  function showTip(el) {
    const g = GLOSS[el.dataset.tip.toLowerCase()]; if (!g) return;
    let box = $('#tipbox'); if (!box) { box = document.createElement('div'); box.id = 'tipbox'; document.body.appendChild(box); }
    box.innerHTML = `<b>${esc(g[0])}</b><span>${g[1]}</span>`;
    box.hidden = false;
    clearTimeout(box._t); box._t = setTimeout(() => { box.hidden = true; box.dataset.for = ''; }, 7000);
    const r = el.getBoundingClientRect(), bw = Math.min(260 * UIS, window.innerWidth - 24);
    box.style.width = bw + 'px';
    box.style.left = Math.max(12, Math.min(window.innerWidth - bw - 12, r.left + r.width / 2 - bw / 2)) + 'px';
    const below = r.bottom + 8, h = box.offsetHeight;
    box.style.top = (below + h < window.innerHeight - 8 ? below : Math.max(8, r.top - h - 8)) + 'px';
  }
  document.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('.tip');
    const box = $('#tipbox');
    if (t) { e.stopPropagation(); e.preventDefault(); if (box && !box.hidden && box.dataset.for === t.dataset.tip) { box.hidden = true; box.dataset.for = ''; return; } showTip(t); $('#tipbox').dataset.for = t.dataset.tip; return; }
    if (box && !box.hidden) box.hidden = true;
  }, true);
  function affixHTML(a) { return `<div class="aff" style="--c:${RARITY[a.tier].col}"><i>${tipify(RARITY[a.tier].name)}</i>${tipify(affixText(a))}</div>`; }
  function towerPanelHTML(t) {
    const D = TOWERS[t.type], s = t.s;
    const spec = t.spec ? D.specs[t.spec - 1].name : '';
    let stats;
    if (s.kind === 'snare') stats = `<div class="sg"><span>Catches left<b>${Math.max(0, s.catches - (t.caught || 0))}/${s.catches}</b></span><span>Lure range<b>${num1(s.range)}</b></span><span>Net slow<b>${pct(s.netSlow)}</b></span><span>Hold<b>${num1(s.hold)}s</b></span></div>`;
    else if (s.kind === 'support') stats = `<div class="sg"><span>Dmg buff<b>+${pct(s.buffDmg)}</b></span><span>Speed buff<b>+${pct(s.buffRate)}</b></span><span>Range<b>${num1(s.range)}</b></span>${s.buffCrit ? `<span>Crit buff<b>+${num1(s.buffCrit)}%</b></span>` : ''}</div>`;
    else if (s.kind === 'eco') stats = `<div class="sg"><span>Income<b>${fmt(s.income * G.mods.credits)}/wave</b></span>${s.bountyAura ? `<span>Bounty aura<b>+${pct(s.bountyAura)}</b></span>` : ''}${s.fbounty ? `<span>All kills<b>+${pct(s.fbounty)}</b></span>` : ''}</div>`;
    else {
      const sts = [];
      if (s.burn > 0) sts.push(`Burn ${pct(s.burn)}`); if (s.chill > 0) sts.push(`Chill ${pct(s.chill)}`);
      if (s.shock > 0) sts.push(`Shock ${pct(s.shock)}`); if (s.mark > 0) sts.push(`Mark ${pct(s.mark)}`);
      if (s.pierce) sts.push(`Pierce ${s.pierce}`); if (s.chain) sts.push(`Chain ${s.chain}`); if (s.splash) sts.push(`Splash ${num1(s.splash)}`);
      if (s.multi) sts.push(`+${s.multi} target`);
      stats = `<div class="sg"><span>Damage<b>${fmt(s.dmg * (1 + t.buff.dmg))}</b></span><span>Rate<b>${num1(s.rate * (1 + t.buff.rate))}/s</b></span><span>Range<b>${num1(t.effRange || s.range)}</b></span><span>Crit<b>${Math.round(s.critC + t.buff.crit)}%</b></span><span>DPS<b data-live="dps">${fmt(t.dps)}</b></span><span>Kills<b data-live="kills">${t.kills}</b></span></div>${sts.length ? `<div class="sts">${tipify(sts.join(' · '))}</div>` : ''}${t.isolated && G.mods.loneWolf ? `<div class="sts amber">${tipify('Lone Wolf: active')}</div>` : ''}${t.reson ? `<div class="sts reson">${tipify(`Resonance: +${Math.round(t.reson * RESON_DMG * 100)}% Damage (${t.resonWith.map(o => EL[o.s.el].name).join(', ')})`)}</div>` : ''}`;
    }
    const modes = s.kind === 'support' || s.kind === 'snare' || s.kind === 'eco' || s.kind === 'pulse' || s.kind === 'grav' ? '' :
      `<div class="lbl">Target</div><div class="modes">${['first', 'last', 'strong', 'close'].map(m => `<button class="chip ${t.mode === m ? 'on' : ''}" data-act="mode" data-v="${m}">${{ first: 'First', last: 'Last', strong: 'Strong', close: 'Near' }[m]}</button>`).join('')}</div>`;
    let up = '';
    if (t.lvl < 3 || t.lvl === 4) { const c = upgradeCost(t); up = `<button class="btn primary wide" data-act="up" ${costBtn(c)}>Upgrade · ${fmt(c)}<small>LV ${t.lvl + 1}: ${s.kind === 'snare' ? 'more catches, longer hold, wider net' : s.kind === 'support' ? 'stronger boost' : s.kind === 'eco' ? 'more income' : 'more Damage'}, new affix</small></button>`; }
    else if (t.lvl === 3) { const c = upgradeCost(t); up = `<div class="lbl">Specialize · ${fmt(c)}</div><div class="specs">${D.specs.map((sp, i) => `<button class="spec" data-act="spec" data-v="${i + 1}" ${costBtn(c)}><b>${esc(sp.name)}</b><span>${tipify(sp.desc)}</span></button>`).join('')}</div>`; }
    else { const c = upgradeCost(t); up = `<button class="btn primary wide asc" data-act="up" ${costBtn(c)}>Ascend · ${fmt(c)}<small>A${(t.asc || 0) + 1}: ×1.3 Damage, new affix</small></button>`; }
    let vet = '';
    if (t.pending > 0) {
      const o = vetOffer(t);
      vet = `<div class="vet"><div class="lbl">Choose a mutation${t.pending > 1 ? ` · ${t.pending} ready` : ''}</div>${o.map((a, i) => `<button class="aff pickable" data-act="vet" data-v="${i}" style="--c:${RARITY[a.tier].col}"><i>${tipify(RARITY[a.tier].name)}</i>${tipify(affixText(a))}</button>`).join('')}</div>`;
    }
    const nextVet = vetThreshold(t.rank + 1), prevVet = t.rank ? vetThreshold(t.rank) : 0;
    const rc = rerollCost(t);
    const title = esc(D.name);
    const combat = !(s.kind === 'eco' || s.kind === 'support' || s.kind === 'snare');
    const vbar = combat ? `<div class="vrow"><span class="lbl">${t.rank ? 'Veteran ' + roman(t.rank) : 'Rookie'}</span><div class="xpbar"><i style="width:${pct(clamp((t.vxp - prevVet) / Math.max(1, nextVet - prevVet), 0, 1))}"></i></div></div>` : '';
    const idle = idleWaves(t) >= 2 ? `<div class="sts bad">Idle for ${idleWaves(t)} waves: nothing has come in range. Sell it and build where the enemies are.</div>` : '';
    const head = `<div class="ph tabbed"><canvas class="ico" width="24" height="24" data-ico="${t.type}"></canvas><div class="pt"><b>${title}</b><small>${t.name ? `<em class="vname">"${esc(t.name)}"</em> · ` : ''}LV ${t.lvl}${t.asc ? ' · A' + t.asc : ''}${spec ? ' · ' + esc(spec) : ''} · <span style="color:${EL[s.el].col}">${EL[s.el].name}</span></small></div><button class="x" data-act="close" aria-label="Close">✕</button>${tabsHTML(t.affixes.length ? t.affixes.length : '')}</div>`;
    const foot = `<div class="pfoot">${t.lvl === 3 ? '' : up}
      <div class="row2"><button class="btn" data-act="reroll" ${costBtn(rc)}>Reroll · ${fmt(rc)}</button><button class="btn danger" data-act="sell">Sell +${fmt(sellRefund(t))}${G.refit && !G.checkpoint ? '<small>Free refit · 100%</small>' : ''}</button></div></div>`;
    if ((panel.tab || 'act') === 'info') return `${head}
      ${vbar}
      ${stats}
      ${idle}
      ${t.linkedTo ? `<div class="sts node">${tipify(`Node Link with ${TOWERS[t.linkedTo.type].name}: +10% Damage, shared beam`)}</div>` : ''}
      ${s.node ? `<div class="sts node">${tipify(s.kind === 'support' ? 'Power Node: +25% Boost strength' : s.kind === 'eco' ? 'Power Node: +25% Income' : s.kind === 'snare' ? 'Power Node: +25% catches, +15% Range' : 'Power Node: +25% Damage, +15% Range')}</div>` : ''}
      ${t.affixes.length ? `<div class="lbl">Affixes</div><div class="affs">${t.affixes.map(a => s.kind === 'snare' ? affixHTML(a).replace('Boost strength', 'Net strength') : affixHTML(a)).join('')}</div>` : ''}
      ${foot}`;
    return `${head}
      ${t.lvl === 3 ? up : ''}
      ${vet}
      ${idle}
      ${canOvercharge(t) ? `<div class="lbl">${tipify('Overcharge')} · +${Math.round((OVERCHARGE.dmg + FX('msOc') / 100) * 100)}% per step · power ${gridUsed()}/${gridCap()}</div><div class="modes oc">${ocFree(t) ? `<span class="note">Marksman: +${ocFree(t)} free</span>` : ''}${Array.from({ length: ocMax() + 1 }, (_, n) => `<button class="chip ${(t.oc || 0) === n ? 'on' : ''}" data-act="oc" data-v="${n}" ${n - (t.oc || 0) > gridFree() ? 'disabled' : ''}>${n ? `+${n}` : 'Off'}</button>`).join('')}</div>` : ''}
      ${modes}
      ${!canOvercharge(t) && !modes ? `<div class="sg mini">${stats.replace(/^<div class="sg">|<\/div>.*$/gs, '')}</div>` : ''}
      ${foot}`;
  }
  function corePanelHTML() {
    const c = G.core, s = coreStats();
    const wc = coreWeaponCost(), sc = coreShieldCost(), rc = coreRepairCost();
    const nextMod = CORE_MODULES.find(m => m.lv === c.wLvl + 1);
    const mods = `<div class="cmods">${CORE_MODULES.map(m => `<span class="${c.wLvl >= m.lv ? 'on' : ''}"><b>${c.wLvl >= m.lv ? '' : 'LV ' + m.lv + ' · '}${esc(m.name)}</b>${tipify(m.desc)}</span>`).join('')}</div>`;
    const head = `<div class="ph tabbed"><div class="pt"><b>Core Battery</b><small>Battery LV ${c.wLvl} · Shield LV ${c.sLvl}</small></div><button class="x" data-act="close" aria-label="Close">✕</button>${tabsHTML(c.affixes.length ? c.affixes.length : '')}</div>`;
    const foot = `<div class="pfoot">${canRelocate() ? relocHTML() : ''}<button class="btn primary wide" data-act="cw" ${c.wLvl >= CORE_GUN.maxLv ? 'disabled' : costBtn(wc)}>${c.wLvl >= CORE_GUN.maxLv ? 'Battery · Max' : `Upgrade Battery · ${fmt(wc)}<small>${nextMod ? `LV ${nextMod.lv}: unlocks ${esc(nextMod.name)}` : '+50% Damage, +Range, new affix'}</small>`}</button>
      <div class="row2"><button class="btn" data-act="cs" ${c.sLvl >= 10 ? 'disabled' : costBtn(sc)}>Shield · ${fmt(sc)}</button>${G.af.lastStand ? '' : `<button class="btn" data-act="cr" ${costBtn(rc)}>Repair · ${fmt(rc)}</button>`}</div>
      <div class="row2"><button class="btn" data-act="reactor" ${costBtn(reactorCost())}>Reactor +1 · ${fmt(reactorCost())}</button>${c.affixes.length ? `<button class="btn" data-act="crr" ${costBtn(coreRerollCost())}>Reroll · ${fmt(coreRerollCost())}</button>` : ''}</div></div>`;
    if ((panel.tab || 'act') === 'act') return `${head}
      <div class="sg mini"><span>Hull<b data-live="chp">${Math.ceil(c.hp)}/${Math.round(c.max)}</b></span><span>Shield<b data-live="csh">${Math.floor(c.shield)}/${Math.round(c.smax)}</b></span><span>${tipify('Power')}<b>${gridUsed()}/${gridCap()}</b></span></div>
      <div class="lbl">Weapon Element</div>
      <div class="elgrid">${ELS.map(e => `<button class="chip ${c.el === e ? 'on' : ''}" data-act="cel" data-v="${e}" style="--c:${EL[e].col};color:${c.el === e ? '' : EL[e].col}">${EL[e].name}</button>`).join('')}</div>
      ${G.af.lastStand ? '<div class="sts bad">Last Stand: repairs disabled</div>' : ''}
      ${foot}`;
    return `${head}
      <div class="sg"><span>Hull<b data-live="chp">${Math.ceil(c.hp)}/${Math.round(c.max)}</b></span><span>Shield<b data-live="csh">${Math.floor(c.shield)}/${Math.round(c.smax)}</b></span><span>Damage<b>${fmt(s.dmg)}</b></span><span>Rate<b>${num1(s.rate)}/s</b></span><span>Range<b>${num1(s.range)}</b></span><span>Kills<b data-live="ckills">${c.kills || 0}</b></span></div>
      <div class="sts">${tipify(`Shells hit whatever is closest to reaching the core · Blast ${num1(s.splash)}`)}</div>
      ${mods}
      ${s.node ? `<div class="sts node">${tipify('Power Node: core overcharged, +50% Damage, +20% Rate')}</div>` : ''}
      <div class="sts ${G.odUsed ? 'dim' : odReady() ? 'good' : ''}">${tipify(G.odUsed ? `Overdrive: used on Wave ${G.odUsed}` : odReady() ? 'Overdrive: ready · release it from the left rail. One board clear this run' : `Overdrive: unlocks at Wave ${OD_WAVE} · once per run`)}</div>
      <div class="lbl">Affixes${c.affixes.length ? '' : ' · each Weapon or Shield upgrade rolls one'}</div>
      ${c.affixes.length ? `<div class="affs">${c.affixes.map(affixHTML).join('')}</div>` : ''}
      <div class="sts">${tipify(`Power grid ${gridUsed()}/${gridCap()}${G.reactorN ? ` · ${G.reactorN} reactor expansion${G.reactorN > 1 ? 's' : ''}` : ''}. Each expansion adds +1 power for the rest of the run and costs more than the last`)}</div>
      ${canRelocate() ? '' : relocHTML()}
      ${foot}`;
  }
  const relocPrice = () => relocCost() ? `${fmt(RELOCATE_COST)}` : 'Free';
  function relocHTML() {
    const free = !relocCost();
    if (canRelocate()) return `<button class="btn wide reloc" data-act="reloc" ${free ? '' : costBtn(RELOCATE_COST)}>Relocate Core · ${relocPrice()}<small>Up to ${RELOCATE_RADIUS} tiles · roads re-route</small></button>`;
    return `<div class="sts">${tipify(`Relocate Core: at Checkpoints, field clear · ${free ? 'first move this run is free' : `${fmt(RELOCATE_COST)} credits`}`)}</div>`;
  }
  function relocPanelHTML() {
    const P = G.reloc && G.reloc.plan, cost = relocCost();
    const head = `<div class="ph"><div class="pt"><b>Relocate Core</b><small>${cost ? `${fmt(RELOCATE_COST)} credits` : 'Free · first move this run'}</small></div><button class="x" data-act="rcancel" aria-label="Cancel">✕</button></div>`;
    if (!P) return head + `<p class="note">Tap a highlighted tile within ${RELOCATE_RADIUS} tiles of the core. Every road re-routes to reach it. Road no lane uses any more becomes buildable ground.</p>
      <p class="note">After the free move, each move costs ${fmt(RELOCATE_COST)} credits.</p>
      <div class="pfoot"><button class="btn" data-act="rcancel">Cancel</button></div>`;
    const tot = a => a.reduce((x, y) => x + y, 0), d = tot(P.after) - tot(P.before);
    const rows = P.before.map((b, i) => { const a = P.after[i], dd = a - b, L = G.map.lanes[i]; return `<span>${i === 0 ? 'Main road' : L.openWave ? 'Forming' : 'Lane ' + (i + 1)}<b class="${dd > 0 ? 'good' : dd < 0 ? 'bad' : ''}">${b} → ${a}</b></span>`; }).join('');
    return head + `<div class="lbl">Road length (tiles)</div><div class="sg">${rows}</div>
      <div class="sts ${d > 0 ? 'good' : d < 0 ? 'bad' : ''}">${d === 0 ? 'Same total road length' : `${d > 0 ? '+' : '−'}${Math.abs(d)} tiles of road in total`}${d > 0 ? ': enemies walk further' : d < 0 ? ': enemies arrive sooner' : ''}</div>
      ${P.lose || P.gain ? `<div class="sts ${P.lose > P.gain ? 'bad' : 'good'}">${P.lose ? `${P.lose} tower${P.lose > 1 ? 's' : ''} would lose the road and sit idle` : ''}${P.lose && P.gain ? ' · ' : ''}${P.gain ? `${P.gain} tower${P.gain > 1 ? 's' : ''} would gain road` : ''}</div>` : '<div class="sts good">Every tower keeps road in range</div>'}
      ${isNode(P.x, P.y) ? `<div class="sts node">${tipify('Power Node: the core will be overcharged, +50% Damage, +20% Rate')}</div>` : ''}
      <p class="note">Tap another tile to compare.</p>
      <div class="pfoot"><button class="btn primary wide" data-act="rgo" ${cost ? costBtn(cost) : ''}>Move Core · ${relocPrice()}</button><button class="btn" data-act="rcancel">Cancel</button></div>`;
  }
  function cashPanelHTML() {
    const r = cashRate() * G.CH.score * (G.scoreMult || 1), cr = Math.floor(G.credits);
    const opt = (f, label) => { const amt = Math.floor(cr * f); return `<button class="btn ${f === 1 ? 'primary' : ''}" data-act="cash" data-v="${f}" ${amt > 0 ? '' : 'disabled'}>${label} · ${fmt(amt)}<small>+${fmt(amt * r)} score</small></button>`; };
    return `<div class="ph"><div class="pt"><b>Exchange</b><small>Cash In and the Black Market</small></div><button class="x" data-act="close" aria-label="Close">✕</button></div>
      ${marketHTML()}
      <div class="lbl">Cash In · ${num1(r)} score per credit</div>
      <div class="cashopts">${opt(0.25, '25%')}${opt(0.5, '50%')}${opt(1, 'All')}</div>
      ${G.stats.cashed ? `<div class="sts">Cashed in this run: ${fmt(G.stats.cashed)} credits</div>` : ''}`;
  }
  // v4.4 Black Market: a pirate trader's three items, restocked after every boss wave
  function marketHTML() {
    const M = marketEnsure(), nextW = (M.n + 1) * MARKET.refresh;
    const rows = M.stock.map(id => { const I = MARKET_ITEMS.find(x => x.id === id), got = M.bought.includes(id), ok = marketOk(I), p = marketPrice(I);
      return `<button class="mkt ${got ? 'sold' : ''}" data-act="buy" data-v="${id}" ${got || !ok ? 'disabled' : costBtn(p)} style="--c:${I.col}"><b>${esc(I.name)}</b><span>${tipify(I.desc)}</span><em>${got ? 'Sold' : !ok ? 'Unavailable' : fmt(p)}</em></button>`; }).join('');
    return `<div class="lbl">Black Market · <i class="mline">"${esc(M.line)}"</i></div><div class="mktlist">${rows || '<p class="note">The trader has nothing left.</p>'}</div><p class="note">New stock at Wave ${nextW}. Prices rise with the wave.${M.spent ? ` Spent here: ${fmt(M.spent)}.` : ''}</p>`;
  }
  function liveRefreshPanel() {
    if (!panel || !G) return;
    const el = $('#panel');
    for (const b of el.querySelectorAll('[data-cost]')) {
      const ok = G.credits >= +b.dataset.cost;
      if (b.tagName === 'BUTTON') b.disabled = !ok; else b.classList.toggle('poor', !ok);
    }
    if (panel.kind === 'tower') {
      const t = panel.t;
      const sig = t.pending + ':' + t.rank + ':' + t.reson + ':' + t.affixes.length + ':' + t.lvl;
      if (panel.sig !== undefined && panel.sig !== sig) { panel.sig = sig; renderPanel(); return; }
      panel.sig = sig;
      const d = el.querySelector('[data-live="dps"]'); if (d) d.textContent = fmt(t.dps);
      const k = el.querySelector('[data-live="kills"]'); if (k) k.textContent = t.kills;
    }
    if (panel.kind === 'cash') { const sig = Math.floor(G.credits) + ':' + G.wave; if (panel.sig !== sig) { panel.sig = sig; el.innerHTML = cashPanelHTML(); } return; }
    if (panel.kind === 'core') {
      const c = G.core, sig = (canRelocate() ? 1 : 0) + ':' + relocCost() + ':' + c.affixes.length + ':' + (odReady() ? 1 : 0);
      if (panel.sig !== undefined && panel.sig !== sig) { panel.sig = sig; renderPanel(); return; }
      panel.sig = sig;
      const a = el.querySelector('[data-live="chp"]'); if (a) a.textContent = `${Math.ceil(c.hp)}/${Math.round(c.max)}`;
      const s = el.querySelector('[data-live="csh"]'); if (s) s.textContent = `${Math.floor(c.shield)}/${Math.round(c.smax)}`;
      const r = el.querySelector('[data-act="cr"]'); if (r && c.hp >= c.max) r.disabled = true;
    }
  }
  function panelAction(act, b) {
    SFX.play('ui');
    if (act === 'close') return closePanel();
    if (!panel || !G || G.over) return; // a stale tap on a panel that just closed
    if (act === 'tab') { panel.tab = b.dataset.v; renderPanel(); $('#panel').scrollTop = 0; return; }
    if (panel.kind === 'build') {
      if (act === 'pick') {
        if (pick === b.dataset.type && G.credits >= towerCost(pick)) return panelAction('build', b);
        pick = b.dataset.type;
        const D = TOWERS[pick];
        Render.prev = D.range ? { x: panel.x, y: panel.y, range: D.range * G.mods.range * (pick === 'pulse' || pick === 'rail' ? 1 + G.mods.rangeKR : 1), col: EL[D.el].col } : null;
        renderPanel();
      } else if (act === 'reactor') {
        if (!expandReactor()) { SFX.play('deny'); return; }
        toast('REACTOR EXPANDED', `Power ${gridUsed()}/${gridCap()} · next expansion ${fmt(reactorCost())}`, '#59f0b4'); renderPanel(); updateHud();
      } else if (act === 'build') {
        const t = buildTower(pick, panel.x, panel.y);
        if (!t) { SFX.play('deny'); return; }
        Render.prev = null;
        openTower(t);
      }
      return;
    }
    if (panel.kind === 'tower') {
      const t = panel.t;
      if (act === 'mode') { t.mode = b.dataset.v; renderPanel(); }
      else if (act === 'up') { if (!upgradeTower(t)) SFX.play('deny'); renderPanel(); }
      else if (act === 'spec') { if (!upgradeTower(t, +b.dataset.v)) SFX.play('deny'); renderPanel(); }
      else if (act === 'reroll') { if (!rerollTower(t)) SFX.play('deny'); renderPanel(); }
      else if (act === 'sell') { sellTower(t); closePanel(); }
      else if (act === 'oc') { if (!setOvercharge(t, +b.dataset.v)) { SFX.play('deny'); toast('NOT ENOUGH POWER', 'Free some power: lower another Overcharge or sell a tower', '#ff4d6a'); } renderPanel(); updateHud(); }
      else if (act === 'vet') { if (!claimVet(t, +b.dataset.v)) SFX.play('deny'); renderPanel(); }
      return;
    }
    if (panel.kind === 'cash') {
      if (act === 'cash') { const got = cashIn(Math.floor(G.credits * +b.dataset.v)); if (got) toast('CASHED IN', `+${fmt(got)} score`, '#ffb03a'); else SFX.play('deny'); updateHud(); panel.sig = null; liveRefreshPanel(); }
      else if (act === 'buy') {
        const m = marketBuy(b.dataset.v);
        if (!m) { SFX.play('deny'); return; }
        const I = MARKET_ITEMS.find(x => x.id === b.dataset.v);
        if (G.placing === 'beacon') { G.placingRefund = marketPrice(I); closePanel(); toast('NODE BEACON', m + '. Tap the core to cancel', '#6ae2ff', true); }
        else { toast('BLACK MARKET', `${I.name}: ${m}`, I.col); panel.sig = null; liveRefreshPanel(); }
        updateHud(); Save.save();
      }
      return;
    }
    if (panel.kind === 'core') {
      if (act === 'cel') { G.core.el = b.dataset.v; renderPanel(); }
      else if (act === 'cw') { if (!coreUpgrade('weapon')) SFX.play('deny'); renderPanel(); }
      else if (act === 'cs') { if (!coreUpgrade('shield')) SFX.play('deny'); renderPanel(); }
      else if (act === 'cr') { if (!coreUpgrade('repair')) SFX.play('deny'); renderPanel(); }
      else if (act === 'crr') { if (!rerollCore()) SFX.play('deny'); renderPanel(); }
      else if (act === 'od') {
        // two taps: the first arms it for 3 seconds
        if (!panel.odArm) { panel.odArm = true; renderPanel(); setTimeout(() => { if (panel && panel.kind === 'core' && panel.odArm) { panel.odArm = false; renderPanel(); } }, 3000); return; }
        panel.odArm = false;
        const r = releaseOverdrive();
        if (r === 'empty') { SFX.play('deny'); toast('OVERDRIVE', 'Nothing to clear yet. Save it for a crowd', '#ff4d6a'); renderPanel(); }
        else if (r !== 'ok') { SFX.play('deny'); renderPanel(); }
        else { closePanel(); toast('OVERDRIVE', `${G.stats.odKills} enemies erased`, '#59f0b4'); updateHud(); }
      }
      else if (act === 'reloc') startReloc();
      else if (act === 'reactor') { if (!expandReactor()) SFX.play('deny'); else toast('REACTOR EXPANDED', `Power ${gridUsed()}/${gridCap()} · next ${fmt(reactorCost())}`, '#59f0b4'); renderPanel(); updateHud(); }
      return;
    }
    if (panel.kind === 'reloc') {
      if (act === 'rcancel') endReloc();
      else if (act === 'rgo') {
        if (!applyRelocation(G.reloc && G.reloc.plan)) { SFX.play('deny'); return; }
        const paid = G.relocUsed > 1;
        endReloc(); toast('CORE RELOCATED', paid ? `−${fmt(RELOCATE_COST)} credits` : 'Next move costs ' + fmt(RELOCATE_COST), '#59f0b4'); updateHud(); Save.save();
      }
    }
  }
  function startReloc() {
    if (!canRelocate()) { SFX.play('deny'); return; }
    if (relocCost() && G.credits < relocCost()) { SFX.play('deny'); toast('RELOCATE CORE', `Needs ${fmt(RELOCATE_COST)} credits`, '#ff4d6a'); return; }
    G.reloc = { cands: new Set(relocCandidates()), plan: null };
    Render.sel = null; G.selCore = false;
    openPanel({ kind: 'reloc', x: G.map.core.x, y: G.map.core.y });
  }
  function endReloc() { if (G) G.reloc = null; Render.sel = null; closePanel(); }
  function openTower(t) {
    Render.sel = { x: t.x, y: t.y }; Render.selT = t; Render.prev = null; G.selCore = false;
    openPanel({ kind: 'tower', t, x: t.x, y: t.y });
  }
  const TSHORT = { pulse: 'Pulse', rail: 'Rail', cryo: 'Cryo', snare: 'Snare', missile: 'Missile', pylon: 'Pylon', coil: 'Coil', forge: 'Forge', flame: 'Flame', lens: 'Lens', emp: 'EMP', grav: 'Gravity' };
  function openBuild(x, y) {
    Render.sel = { x, y }; Render.selT = null; G.selCore = false;
    pick = null; Render.prev = null;
    openPanel({ kind: 'build', x, y });
  }
  function openCore() {
    Render.sel = { x: G.map.core.x, y: G.map.core.y }; Render.selT = null; Render.prev = null; G.selCore = true;
    openPanel({ kind: 'core', x: G.map.core.x, y: G.map.core.y });
  }

  // ---------- canvas input: tap to act, drag to pan, pinch or wheel to zoom ----------
  const ptrs = new Map(); let gesture = null;
  function canvasDown(e) {
    SFX.init();
    $('#cv').setPointerCapture && $('#cv').setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: (e.clientX / UIS), y: (e.clientY / UIS), sx: (e.clientX / UIS), sy: (e.clientY / UIS) });
    if (ptrs.size === 1) gesture = { kind: 'tap', moved: 0 };
    else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; gesture = { kind: 'pinch', d: Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)) }; }
  }
  function canvasMove(e) {
    const r = $('#cv').getBoundingClientRect();
    if (G && G.aimAbility) Render.aim = Render.screenToTile((e.clientX / UIS) - (r.left / UIS), (e.clientY / UIS) - (r.top / UIS));
    const p = ptrs.get(e.pointerId); if (!p || !gesture) return;
    const dx = (e.clientX / UIS) - p.x, dy = (e.clientY / UIS) - p.y;
    p.x = (e.clientX / UIS); p.y = (e.clientY / UIS);
    if (gesture.kind === 'pinch' && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()], d = Math.max(20, Math.hypot(a.x - b.x, a.y - b.y));
      Render.zoomAt((a.x + b.x) / 2 - (r.left / UIS), (a.y + b.y) / 2 - (r.top / UIS), d / gesture.d);
      gesture.d = d; updateZoomBtn();
    } else if (gesture.kind === 'tap' || gesture.kind === 'pan') {
      gesture.moved += Math.abs(dx) + Math.abs(dy);
      if (gesture.moved > 12) gesture.kind = 'pan';
      if (gesture.kind === 'pan') { Render.panBy(dx, dy); updateZoomBtn(); }
    }
  }
  function canvasUp(e) {
    const p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId);
    if (!gesture || !p) return;
    if (gesture.kind === 'pinch') { if (ptrs.size === 0) gesture = null; return; }
    const g = gesture; gesture = null;
    if (g.kind !== 'tap' || g.moved > 12 || !G || G.over) return;
    const r = $('#cv').getBoundingClientRect();
    const sx = (e.clientX - r.left) / UIS, sy = (e.clientY - r.top) / UIS, now = performance.now();
    // double-tap: zoom in on that spot, or back out to the full map
    if (lastTap && now - lastTap.t < 330 && Math.hypot(sx - lastTap.x, sy - lastTap.y) < 30) {
      lastTap = null; closePanel();
      if (Render.zoom < 1.5) Render.zoomAt(sx, sy, 2.2 / Render.zoom); else Render.resetCam();
      updateZoomBtn(); SFX.play('ui'); return;
    }
    lastTap = { t: now, x: sx, y: sy };
    tapTile(Render.screenToTile(sx, sy));
  }
  let lastTap = null;
  function tapTile(p) {
    if (G.aimAbility) {
      const Rg = G.region; if (p.x < Rg.x0 || p.y < Rg.y0 || p.x > Rg.x1 || p.y > Rg.y1) return;
      useAbility(G.aimAbility, p.x, p.y);
      G.aimAbility = null; Render.aim = null; updateHud();
      return;
    }
    const tx = Math.floor(p.x), ty = Math.floor(p.y);
    if (G.placing === 'beacon') {
      if (tx === G.map.core.x && ty === G.map.core.y) { G.placing = null; G.credits += G.placingRefund || 0; G.placingRefund = 0; if (G.market) { G.market.bought = G.market.bought.filter(x => x !== 'beacon'); G.market.spent = Math.max(0, (G.market.spent || 0) - marketPrice(MARKET_ITEMS.find(x => x.id === 'beacon'))); } SFX.play('sell', {}); toast('NODE BEACON', 'Cancelled and refunded', '#6ae2ff', true); updateHud(); return; }
      if (marketPlaceNode(tx, ty)) { SFX.play('ui'); G.placingRefund = 0; toast('POWER NODE PLANTED', 'Towers built here draw no power and hit harder', '#6ae2ff'); updateHud(); }
      else { SFX.play('deny'); toast('NODE BEACON', 'Needs an empty ground tile inside the sector. Tap the core to cancel', '#ff4d6a', true); }
      return;
    }
    if (G.reloc) {
      if (!G.reloc.cands.has(tIdx(tx, ty))) { SFX.play('deny'); return; }
      const P = planRelocation(tx, ty);
      if (!P) { SFX.play('deny'); toast('NO ROUTE', 'A road cannot reach that tile', '#ff4d6a'); return; }
      SFX.play('ui'); G.reloc.plan = P; Render.sel = { x: tx, y: ty }; renderPanel(); return;
    }
    if (!inRegion(tx, ty, G.region)) { closePanel(); return; }
    const cc = cacheAt(tx, ty);
    if (cc) { const kind = cc.kind, m = claimCache(cc); if (m) { toast(kind === 'gold' ? 'GOLDEN SALVAGE' : kind === 'cursed' ? 'CURSED SALVAGE' : 'SALVAGE', m, kind === 'gold' ? '#ffd84a' : kind === 'cursed' ? '#ff4d6a' : '#ffe14d'); updateHud(); if (panel) renderPanel(); } return; }
    SFX.play('ui');
    const isCore = tx === G.map.core.x && ty === G.map.core.y;
    const t = G.towerAt[tIdx(tx, ty)];
    // with a panel open, tapping empty ground (or the selected tile again) dismisses it;
    // towers and the core still switch straight to their own panel
    if (panel) {
      const selHere = Render.sel && Render.sel.x === tx && Render.sel.y === ty;
      if (selHere || (!isCore && !t)) { closePanel(); return; }
    }
    if (isCore) return openCore();
    if (t) return openTower(t);
    if (canBuildAt(tx, ty)) return openBuild(tx, ty);
    closePanel();
  }
  function canvasWheel(e) {
    e.preventDefault();
    const r = $('#cv').getBoundingClientRect();
    Render.zoomAt((e.clientX / UIS) - (r.left / UIS), (e.clientY / UIS) - (r.top / UIS), e.deltaY < 0 ? 1.15 : 0.87);
    updateZoomBtn();
  }
  function updateZoomBtn() { const b = $('#bZoom'); if (b) { b.hidden = Render.home; b.innerHTML = svgIcon('fit', 16) + 'Fit · ' + Render.zoom.toFixed(1) + '×'; } }
  function fitCols() {
    // measure the playfield the game screen will have: app minus safe areas, the two thumb rails and the status bar
    let pr = document.getElementById('fitProbe');
    if (!pr) { pr = document.createElement('div'); pr.id = 'fitProbe'; pr.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;top:0;left:max(8px,var(--sal));right:max(8px,var(--sar));bottom:max(6px,var(--sab));'; $('#app').appendChild(pr); }
    const r = pr.getBoundingClientRect(), rail = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--rail')) || 56;
    const w = Math.max(300, r.width / UIS - 2 * rail - 12), h = Math.max(200, r.height / UIS - 32);
    return clamp(Math.round(ROWS * w / h), 38, 76);
  }

  // ---------- modals ----------
  function modal(html, kind) {
    const m = $('#modal');
    m.innerHTML = html; m.hidden = false; modalOpen = kind || 'modal';
    document.body.classList.add('modal-open');
    hydrateIcons(m);
  }
  function closeModal() {
    $('#modal').hidden = true; $('#modal').innerHTML = ''; modalOpen = null; modalFrom = null; confirmAbandon = false; confirmReset = false;
    document.body.classList.remove('modal-open');
    flushToasts();
  }
  function flushToasts() { const held = toastHeld.splice(0); held.slice(-2).forEach((t, i) => setTimeout(() => toast(...t), 350 + i * 250)); }
  function openPause() {
    if (!G || G.over) return;
    G.paused = true;
    modal(`<div class="card narrow"><div class="ch"><h2>Paused</h2></div>
      <p class="note">Wave ${G.wave} · Score ${fmt(G.score)} · Multiplier ×${G.scoreMult.toFixed(2)}</p>
      ${G.anoms.length ? `<div class="lbl">Anomalies</div><div class="anlist">${G.anoms.map(id => { const A = ANOMALIES.find(a => a.id === id); return `<div><b>${esc(A.name)}</b><span class="good">${tipify(A.up)}</span><span class="bad">${tipify(A.down)}</span></div>`; }).join('')}</div>` : ''}
      <div class="stack"><button class="btn primary" data-act="resume">Resume</button>
      <button class="btn" data-act="help">How to Play</button>
      <button class="btn" data-act="settings">Settings</button>
      <button class="btn" data-act="exit">Save &amp; Quit</button>
      <button class="btn danger" data-act="abandon">${confirmAbandon ? 'Tap again to confirm' : 'End Run'}</button></div></div>`, 'pause');
  }
  function openAnomaly() {
    if (!G || !G.anomOffers) return;
    G.paused = true;
    modal(`<div class="card anom"><div class="ch"><h2 class="void">Anomaly</h2><span class="note">Choose one. Each Anomaly also grants +5% score.</span></div>
      <div class="boons four">${G.anomOffers.map(id => { const A = ANOMALIES.find(a => a.id === id); return `<button class="boon anomaly" data-act="anom" data-v="${id}"><b>${esc(A.name)}</b><span class="good">${tipify(A.up)}</span><i class="lbl cost">Cost</i><span class="bad">${tipify(A.down)}</span></button>`; }).join('')}
      <button class="boon stab" data-act="stab"><b>Stabilize</b><span class="good">+10% score</span><span class="good">+1 Recalibration token</span><span class="dim">No other changes</span></button></div></div>`, 'anomaly');
  }
  function runRecord() {
    const byDmg = G.towers.slice().sort((a, b) => b.dmgDone - a.dmgDone), mvp = byDmg[0];
    const tw = t => ({ type: t.type, label: towerLabel(t), dmg: t.dmgDone, kills: t.kills, rank: t.rank || 0 });
    return { ts: Date.now(), wave: G.wave, score: Math.round(G.score), xp: Math.round(G.xpEarned), chaos: G.chaos, daily: G.daily || null, startWave: G.startWave,
      nova: G.novaN || 0, laws: (G.laws || []).slice(), anoms: G.anoms.slice(), els: Object.assign({}, G.stats.dmgByEl), combos: Object.assign({}, G.stats.combos),
      bounty: G.stats.bounty || null, elites: G.stats.elites, bosses: G.stats.bossKills, leaks: G.stats.leaks, cashed: G.stats.cashed || 0, lastLeak: G.stats.lastLeak || '', crates: G.stats.crates || 0, assaults: G.stats.assaults ? JSON.parse(JSON.stringify(G.stats.assaults)) : null, pirates: G.stats.pirates || 0, odKills: G.stats.odKills || 0, relocs: G.relocUsed || 0, peakGene: G.stats.peakGene || null, strain: topStrain(), pre: G.preAdapted || null,
      mvp: mvp ? tw(mvp) : null, top: byDmg.slice(1, 4).map(tw), towers: G.towers.length,
      keystones: TREE.list.filter(n => n.kind === 'keystone' && PROF.alloc.includes(n.id)).map(n => n.name) };
  }
  function recapHTML(R) {
    const els = R.els, tot = Object.values(els).reduce((a, b) => a + b, 0) || 1, mvp = R.mvp;
    const combos = COMBO_NAMES.filter(n => R.combos[n]).map(n => `${n[0] + n.slice(1).toLowerCase()} ×${fmt(R.combos[n])}`).join(' · ');
    return `<div class="recap">
      ${mvp ? `<div class="mvp"><canvas class="ico" width="24" height="24" data-ico="${mvp.type}"></canvas><div><span class="lbl">Top Tower</span><b>${esc(mvp.label)}</b><small>${fmt(mvp.dmg)} damage · ${mvp.kills} kills${mvp.rank ? ' · ' + tipify('Veteran') + ' ' + roman(mvp.rank) : ''}</small></div></div>` : ''}
      <div class="elbar">${ELS.filter(e => els[e] / tot > 0.005).map(e => `<i style="flex:${Math.max(0.001, els[e] / tot)};background:${EL[e].col}" title="${EL[e].name}"></i>`).join('')}</div>
      <div class="ellab">${ELS.filter(e => els[e] / tot >= 0.04).map(e => `<span style="color:${EL[e].col}">${EL[e].name} ${Math.round(els[e] / tot * 100)}%</span>`).join('')}</div>
      <p class="note">${combos ? tipify('Combos: ' + combos) : 'No combos this run.'}</p>
      ${R.peakGene ? `<p class="note hl" style="color:${GENES[R.peakGene.g].col}">${tipify(`Evolution peak: ${GENES[R.peakGene.g].name} reached ${Math.round(R.peakGene.v * 100)}% of the swarm at Wave ${R.peakGene.w}`)}${R.strain ? ` · Signature strain: <b>${esc(R.strain.name)}</b> ×${fmt(R.strain.n)}` : ''}${R.pre ? ` · Arrived adapted: ${esc(R.pre.join(', '))}` : ''}</p>` : ''}
      ${R.assaults && R.assaults.list.length ? `<p class="note hl">${tipify(`Strain Assaults: ${R.assaults.won} broken, ${R.assaults.lost} entrenched`)}${R.assaults.list.slice(-3).map(a => ` · W${a.w} ${esc(a.name)} ${a.won ? '✓' : '✗'}`).join('')}</p>` : ''}
      ${R.bounty ? `<p class="note hl" style="color:#ffd84a">Bounty claimed: ${esc(R.bounty)}</p>` : ''}
      ${(R.crates || R.pirates || R.odKills || R.relocs) ? `<p class="note hl">${[R.crates ? `Salvage crates ${R.crates}` : '', R.pirates ? `Pirates downed ${R.pirates}` : '', R.odKills ? `Overdrive erased ${fmt(R.odKills)}` : '', R.relocs ? `Core moved ${R.relocs}×` : ''].filter(Boolean).join(' · ')}</p>` : ''}
      <p class="note">${tipify(`Elites ${R.elites} · Bosses ${R.bosses} · Leaks ${R.leaks}${R.cashed ? ' · Cashed in ' + fmt(R.cashed) + ' credits' : ''}${R.lastLeak ? ' · Final hit: ' + R.lastLeak : ''}${R.anoms.length ? ' · Anomalies: ' + R.anoms.map(id => (ANOMALIES.find(a => a.id === id) || { name: id }).name).join(', ') : ''}`)}</p>
    </div>`;
  }
  // ---------- Hall of Fame: best three runs by score, with their summaries ----------
  function hallAdd(R) {
    if (!(R.score > 0)) return -1;
    PROF.hall = (PROF.hall || []).concat([R]).sort((a, b) => b.score - a.score).slice(0, 3);
    const i = PROF.hall.indexOf(R); return i;
  }
  const runMode = R => R.daily ? 'Daily' : (CHAOS_LEVELS[R.chaos] || {}).name || '';
  const runDate = R => { try { return new Date(R.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return ''; } };
  function hallHTML() {
    const H = PROF.hall || [];
    if (!H.length) return `<div class="lbl">Hall of Fame</div><p class="note">Finish a run to claim a spot.</p>`;
    return `<div class="lbl">Hall of Fame</div><div class="hall">${H.map((R, i) => `<button class="hrow" data-act="hall" data-v="${i}"><em>#${i + 1}</em><span><b>${fmt(R.score)}</b><small>Wave ${R.wave} · ${esc(runMode(R))}${R.strain ? ' · vs ' + esc(R.strain.name) : ''}${R.nova ? ' · Supernova ' + R.nova : ''} · ${esc(runDate(R))}</small></span>${R.mvp ? `<canvas class="ico" width="20" height="20" data-ico="${R.mvp.type}"></canvas>` : ''}</button>`).join('')}</div>`;
  }
  function openHall(i) {
    const R = (PROF.hall || [])[i]; if (!R) return openArchive();
    const laws = (R.laws || []).map(id => (LAWS.find(L => L.id === id) || { name: id }).name);
    modal(`<div class="card over"><div class="ch"><h2 class="amber">Hall of Fame #${i + 1}</h2><span class="note">${esc(runMode(R))} · ${esc(runDate(R))}</span><button class="x" data-act="hallBack" aria-label="Back">✕</button></div>
      <div class="bigstats"><span>Wave<b>${R.wave}</b></span><span>Score<b>${fmt(R.score)}</b></span><span>XP<b>+${fmt(R.xp)}</b></span><span>Towers<b>${R.towers}</b></span></div>
      ${recapHTML(R)}
      ${R.top && R.top.length ? `<div class="lbl">Supporting Cast</div><div class="hcast">${R.top.map(t => `<span><canvas class="ico" width="16" height="16" data-ico="${t.type}"></canvas>${esc(t.label)} <small>${fmt(t.dmg)}</small></span>`).join('')}</div>` : ''}
      <p class="note">${tipify([R.startWave > 1 ? 'Started at wave ' + R.startWave : '', R.nova ? 'Supernova ' + R.nova : '', laws.length ? 'Cosmic Laws: ' + laws.join(', ') : '', R.keystones && R.keystones.length ? 'Keystones: ' + R.keystones.join(', ') : ''].filter(Boolean).join(' · ') || 'No keystones or laws.')}</p>
      <div class="foot"><button class="btn" data-act="hallBack">Back</button></div></div>`, 'hall');
    for (const cv of document.querySelectorAll('#modal canvas[data-ico]')) Render.towerIcon(cv.dataset.ico, cv);
  }
  function openDraft(opts) {
    modal(`<div class="card"><div class="ch"><h2>Boss Defeated</h2><span class="note">Choose a boon. Lasts until the run ends. +1 Recalibration token.</span></div>
      <div class="boons">${opts.map((b, i) => `<button class="boon" data-act="boon" data-v="${i}"><b>${esc(b.name)}</b><span>${tipify(b.desc)}</span></button>`).join('')}</div></div>`, 'draft');
    SFX.play('milestone');
  }
  function evoRowsHTML() {
    const now = geneShares(), H = G.geneHist || [], prev = H.length > 1 ? H[H.length - 2].g : {};
    return GENE_IDS.map(g => { const v = now[g] || 0, d = v - (prev[g] || 0), A = GENES[g];
      const locked = A.from && G.wave < A.from;
      return `<div class="evrow ${locked ? 'dim' : ''}"><b style="color:${A.col}">${A.name}</b><div class="evbar"><i style="width:${Math.round(v * 100)}%;background:${A.col}"></i></div><em>${locked ? 'Wave ' + A.from : Math.round(v * 100) + '%' + (Math.abs(d) >= 0.05 ? (d > 0 ? ' ▲' : ' ▼') : '')}</em><span>${esc(A.desc)} · <u>${esc(A.counter)}</u></span></div>`; }).join('');
  }
  // v4.0 Strain Assault: the swarm's move, announced a wave ahead
  function openAssault(intro) {
    const A = G && G.assault; if (!A) { openEvo(); return; }
    if (!G.over) G.paused = true;
    const S = G.stats.assaults || { won: 0, lost: 0 };
    const est = A.n || Math.round(Math.min(65, 6 + A.w * 1.15) * ASSAULT.share * ASSAULT.count * (G.CH.count || 1));
    const lim = Math.max(1, Math.round(est * ASSAULT.hold));
    const live = A.state === 'live', done = A.state === 'done';
    modal(`<div class="card evo assault"><div class="ch"><h2>${intro ? 'The Swarm Makes Its Move' : 'Strain Assault'}</h2><span class="note">Wave ${A.w}${live ? ' · in progress' : done ? (A.won ? ' · broken' : ' · entrenched') : ''} · record ${S.won} held, ${S.lost} lost</span><button class="x" data-act="close2" aria-label="Close">✕</button></div>
      ${intro ? `<p class="note">${tipify('Every few waves the swarm studies your defence, breeds the strain that beats it and throws most of a wave at you. It warns you a wave ahead: this is your move.')}</p>` : ''}
      <h3 class="asname">${esc(A.name)}</h3>
      <div class="evlist">${A.genes.map(g => { const D = GENES[g]; return `<div class="evrow"><b style="color:${D.col}">${D.name}${g === 'ward' && A.el ? ' · ' + EL[A.el].name : ''}</b><div></div><em></em><span>${esc(g === 'ward' && A.el ? `Resists ${EL[A.el].name} by 50%` : D.desc)} · <u>Counter: ${esc(g === 'ward' && A.el ? `anything but ${EL[A.el].name}` : D.counter)}</u></span></div>`; }).join('')}</div>
      ${A.why.length ? `<div class="lbl">How it read you</div><ul class="aswhy">${A.why.map(x => `<li>${esc(x[0].toUpperCase() + x.slice(1))}</li>`).join('')}</ul>` : ''}
      ${live ? `<p class="note hl">${A.n - A.killed - A.leaked} of ${A.n} left · ${A.leaked} leaked of ${assaultLimit(A)} allowed</p>`
        : done ? '' : `<p class="note hl">${tipify(`Your move: selling is free (100% refund) until Wave ${A.w} starts, and Overcharge moves for free. Swap towers for the counters above.`)}</p>`}
      ${done ? '' : `<p class="note">${tipify(`Let ${live ? assaultLimit(A) : '~' + lim} or fewer through and the strain is broken: +1 power for the rest of the run and a credit bounty, and the swarm stops trusting those genes. More, and it entrenches: it spreads through the next waves and the next assault comes sooner.`)}</p>`}
      <div class="foot"><button class="btn primary" data-act="${intro ? 'assaultDone' : 'close2'}">${intro ? 'Answer it' : 'Back'}</button></div></div>`, 'assault');
  }
  function openEvo(intro) {
    if (!G) return;
    if (!G.over) G.paused = true;
    const cap = geneCap(G.wave);
    modal(`<div class="card evo"><div class="ch"><h2>${intro ? 'The Swarm Evolves' : 'Swarm DNA'}</h2><span class="note">Wave ${G.wave} · up to ${cap} gene${cap === 1 ? '' : 's'} per enemy${G.assaultNext && !(G.assault && G.assault.state !== 'done') ? ` · next Strain Assault ~Wave ${G.assaultNext}` : ''}</span><button class="x" data-act="close2" aria-label="Close">✕</button></div>
      ${intro ? `<p class="note">${tipify("Enemies that get furthest pass their traits on. Whatever your defence handles worst spreads; answer it and it fades. Each trait costs them HP or speed, so a balanced, adaptable defence keeps the swarm in check. Tap DNA in the top bar any time to see this.")}</p>` : ''}
      ${(() => { const R = geneCap(G.wave) > 0 ? readDefence(Math.max(G.wave, 1)).slice(0, 2) : []; return R.length ? `<div class="lbl">What the swarm sees in your defence right now</div><ul class="aswhy">${R.map(x => `<li><b style="color:${GENES[x.g].col};font-weight:400">${GENES[x.g].name}${x.el ? ' · ' + EL[x.el].name : ''}</b>: ${esc(x.why)}</li>`).join('')}</ul>` : ''; })()}
      <div class="evlist">${evoRowsHTML()}</div>
      <div class="foot"><button class="btn primary" data-act="${intro ? 'evoDone' : 'close2'}">${intro ? 'Adapt' : 'Back'}</button></div></div>`, 'evo');
  }
  // ---- v3.1 run log export ----
  const LOG_KEY = 'entropy.runlog';
  function storeRunLog() { try { if (G && G.rlog) localStorage.setItem(LOG_KEY, 'ENTROPY RUN LOG · ' + VERSION + ' · ' + new Date().toISOString() + '\n' + G.rlog.map(e => JSON.stringify(e)).join('\n')); } catch (e) {} }
  function lastLogText() { try { return localStorage.getItem(LOG_KEY) || ''; } catch (e) { return ''; } }
  function copyText(txt) {
    const done = () => toast('LOG COPIED', `${Math.round(txt.length / 1024)} KB · paste it into a chat with Claude`, '#59f0b4', true);
    const fallback = () => { const ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, txt.length); let ok = false; try { ok = document.execCommand('copy'); } catch (e) {} ta.remove(); ok ? done() : toast('COPY FAILED', 'Use Save log instead', '#ff4d6a', true); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, fallback); else fallback();
  }
  function saveText(txt) {
    const name = `entropy-run-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.txt`;
    try {
      const file = new File([txt], name, { type: 'text/plain' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: 'Entropy run log' }).catch(() => {}); return; }
    } catch (e) {}
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function openNews() {
    const N = WHATS_NEW;
    modal(`<div class="card news"><div class="ch"><h2>${esc(N.title)}</h2><span class="note">Version ${esc(N.ver)}</span><button class="x" data-act="newsDone" aria-label="Close">✕</button></div>
      <div class="newslist">${N.items.map(([h, t]) => `<div><b>${esc(h)}</b><span>${tipify(t)}</span></div>`).join('')}</div>
      <div class="foot"><button class="btn primary" data-act="newsDone">Let's go</button></div></div>`, 'news');
  }
  function openGameOver() {
    const L = profLevel(), gained = L.level - G.lvlStart;
    const best = G.wave > (G.bestAtStart || 0);
    if (!G.rec) { G.rec = runRecord(); G.hallRank = hallAdd(G.rec); storeRunLog(); }
    Save.save();
    modal(`<div class="card over"><div class="ch"><h2 class="bad">Core Destroyed</h2><span class="note">${G.daily ? 'Daily Challenge' : CHAOS_LEVELS[G.chaos] ? CHAOS_LEVELS[G.chaos].name : ''}</span></div>
      <div class="bigstats"><span>Wave<b>${G.wave}</b></span><span>Score<b>${fmt(G.score)}</b></span><span>XP<b>+${fmt(G.xpEarned)}</b></span><span>Levels<b>+${gained}</b></span></div>
      ${G.daily ? `<p class="void">Today's best: Wave ${PROF.daily ? PROF.daily.best : G.wave}</p>` : best ? '<p class="amber">New best wave!</p>' : `<p class="note">Best: Wave ${PROF.bestWave}</p>`}
      ${G.hallRank >= 0 ? `<p class="amber">Hall of Fame #${G.hallRank + 1}!</p>` : ''}
      ${recapHTML(G.rec)}
      ${G.unlocks && G.unlocks.length ? `<p class="good">New towers: ${G.unlocks.map(k => esc(TOWERS[k].name)).join(', ')}</p>` : ''}
      ${pointsFree() > 0 ? `<p class="good">${pointsFree()} passive point${pointsFree() === 1 ? '' : 's'} available</p>` : ''}
      <div class="row logrow"><span class="note">Run log for analysis</span><button class="btn small" data-act="logCopy">Copy log</button><button class="btn small" data-act="logSave">Save log</button></div>
      <div class="foot"><button class="btn small" data-act="logCopy" title="Copy this run's log to paste into a chat">Copy log</button><button class="btn" data-act="hangar">Main Menu</button><button class="btn" data-act="web">Passive Web</button><button class="btn primary" data-act="again">Play Again</button></div></div>`, 'over');
    for (const cv of document.querySelectorAll('#modal canvas[data-ico]')) Render.towerIcon(cv.dataset.ico, cv);
  }
  const fsOK = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  const fsOn = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  function toggleFs() {
    const d = document, el = d.documentElement;
    try {
      if (fsOn()) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      else { const r = (el.requestFullscreen || el.webkitRequestFullscreen).call(el); if (r && r.then) r.then(() => { try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} }).catch(() => toast('FULL SCREEN', 'Not supported here', '#ff4d6a', 1)); }
    } catch (e) { toast('FULL SCREEN', 'Not supported here', '#ff4d6a', 1); }
    setTimeout(openSettings, 300);
  }
  function saveCode() {
    const P = Object.assign({}, PROF); delete P.runSnap;
    return 'ENT1:' + btoa(unescape(encodeURIComponent(JSON.stringify(P))));
  }
  function openTransfer(mode) {
    const code = mode === 'copy' ? saveCode() : '';
    modal(`<div class="card narrow"><div class="ch"><h2>${mode === 'copy' ? 'Export Save' : 'Import Save'}</h2><button class="x" data-act="settings" aria-label="Back">✕</button></div>
      <p class="note">${mode === 'copy' ? 'Copy this code, then paste it into Import Save on your other device. Runs in progress are not included.' : 'Paste an exported save code. This replaces your current progress.'}</p>
      <textarea id="xcode" class="xcode" ${mode === 'copy' ? 'readonly' : 'placeholder="ENT1:…"'}>${code}</textarea>
      <div class="foot">${mode === 'copy' ? '<button class="btn primary" data-act="xclip">Copy</button>' : '<button class="btn primary" data-act="xload">Import</button>'}</div></div>`, 'settings');
    const ta = $('#xcode'); if (mode === 'copy') { ta.focus(); ta.select(); }
  }
  function openSettings() {
    const S = PROF.settings;
    modal(`<div class="card narrow"><div class="ch"><h2>Settings</h2><button class="x" data-act="close2">✕</button></div>
      <label class="set"><span>Sound Effects</span><input id="setSfx" type="range" min="0" max="1" step="0.05" value="${S.sfx}"></label>
      <label class="set"><span>Music</span><input id="setMus" type="range" min="0" max="1" step="0.05" value="${S.music}"></label>
      <label class="set"><span>Music Tempo <em id="bpmV" class="dim">${S.bpm || 72} BPM</em></span><input id="setBpm" type="range" min="56" max="100" step="2" value="${S.bpm || 72}"></label>
      <p class="note tempo">The average tempo. Each piece sits a little above or below it, and the action still nudges it up and down.</p>
      ${fsOK() ? `<div class="set"><span>Full Screen</span><button class="chip ${fsOn() ? 'on' : ''}" data-act="fs">${fsOn() ? 'On' : 'Off'}</button></div>` : ''}
      <div class="set"><span>HUD</span><div class="chips"><button class="chip ${S.hud === 'lean' ? 'on' : ''}" data-act="hud" data-v="lean">Minimal</button><button class="chip ${S.hud === 'full' ? 'on' : ''}" data-act="hud" data-v="full">Detailed</button></div></div>
      <div class="set"><span>Interface Size</span><div class="chips">${[['auto', 'Auto'], [0.85, 'Small'], [1.2, 'Large']].map(([v, l]) => `<button class="chip ${(S.uiScale || 'auto') === v ? 'on' : ''}" data-act="uis" data-v="${v}">${l}</button>`).join('')}</div></div>
      <div class="set"><span>Briefings <em class="dim">bosses, bounty</em></span><div class="chips">${[['pause', 'Pause'], ['brief', 'Brief'], ['off', 'Off']].map(([v, l]) => `<button class="chip ${(S.briefings || 'pause') === v ? 'on' : ''}" data-act="briefs" data-v="${v}">${l}</button>`).join('')}</div></div>
      <div class="set"><span>Notifications</span><div class="chips">${[['all', 'All'], ['key', 'Key'], ['off', 'Off']].map(([v, l]) => `<button class="chip ${(S.notes || 'all') === v ? 'on' : ''}" data-act="notes" data-v="${v}">${l}</button>`).join('')}</div></div>
      <p class="note tempo">Pause stops the game for a boss or bounty card until you tap Fight. Key notifications keep only what needs a reaction: Red Alert, wormholes, assaults, Maelstroms, checkpoints, pirates.</p>
      <div class="set"><span>Damage Numbers</span><button class="chip ${S.dmgNums ? 'on' : ''}" data-act="nums">${S.dmgNums ? 'On' : 'Off'}</button></div>
      <div class="set"><span>Screen Shake</span><button class="chip ${S.shake ? 'on' : ''}" data-act="shake">${S.shake ? 'On' : 'Off'}</button></div>
      <div class="set"><span>Save Location</span><span id="cloud" class="cloud ${cloudOk ? 'on' : ''}">${cloudOk ? 'Synced' : 'This device'}</span></div>
      ${G && !G.over ? '' : `<div class="set"><span>Transfer Save</span><div class="chips"><button class="chip" data-act="xcopy">Export</button><button class="chip" data-act="xpaste">Import</button></div></div>`}
      ${G && !G.over ? '' : `<button class="btn danger wide" data-act="wipe">${confirmReset ? 'Tap again to erase all progress' : 'Reset Progress'}</button>`}
      <p class="note credits">Music: Drift, a generative score written live as you play. No two runs sound the same.</p>
      <div class="row"><p class="note">Version ${VERSION}</p><button class="btn small" data-act="news">What's New</button></div>
      <div class="row"><p class="note">${lastLogText() ? 'Last run log' : 'No run log yet'}</p>${lastLogText() ? '<button class="btn small" data-act="logCopy">Copy log</button><button class="btn small" data-act="logSave">Save log</button>' : ''}</div></div>`, 'settings');
    $('#setSfx').oninput = e => { S.sfx = +e.target.value; SFX.setVolumes(S.sfx, S.music); };
    $('#setMus').oninput = e => { S.music = +e.target.value; SFX.setVolumes(S.sfx, S.music); };
    $('#setSfx').onchange = $('#setMus').onchange = () => Save.save();
    const bp = $('#setBpm'); if (bp) { bp.oninput = () => { PROF.settings.bpm = +bp.value; $('#bpmV').textContent = bp.value + ' BPM'; SFX.music.setBaseBpm(+bp.value); }; bp.onchange = () => Save.save(); }
  }
  const GUIDE = [
    { id: 'basics', name: 'Basics', rows: [
      ['Build', 'Tap an empty tile, choose a tower, then tap it again to build. With a panel open, tap empty ground to close it.'],
      ['Power', `Every tower draws 1 power. You start with ${GRID.base} and gain 1 every ${GRID.perWaves} waves (shown next to your credits). Towers on Power Nodes are free. When the grid is full, the game is about making the towers you have count.`],
      ['Overcharge', `Tap a tower to spend spare power on it: +${OVERCHARGE.dmg * 100}% Damage per point, up to ${OVERCHARGE.max}. Free to move at any time, even mid-wave. When power sits unused during a wave, the power counter pulses: tap it to Overcharge your best tower in one go.`],
      ['Evolution', 'From Wave 8 the swarm evolves. Enemies that get furthest pass on their traits (Plating, Wings, Haste, Shell...), so whatever your defence handles worst spreads. The next-wave chips show what is spreading; tap one to see its counter, then adapt.'],
      ['Upgrade', 'Tap a tower. Each level adds damage and rolls a random affix.'],
      ['Specialize', 'At LV 3, choose one of two specializations.'],
      ['Core Battery', 'The core is a long-range gun that shells whatever is closest to reaching it, almost anywhere on the map. It starts as light support; Battery upgrades are expensive but make it a real weapon, with Twin Battery at LV 4, Siege Shells at LV 8 and Orbital Uplink at LV 12. Tap the core to upgrade, repair or reroll it.'],
      ['Next Wave', 'Tap Next to call the wave early for bonus credits.'],
      ['Cash In', 'Tap Score to trade credits for score. The rate rises every wave.'],
      ['Zoom', 'Pinch to zoom, drag to pan. Tap Fit to reset the view.'],
    ] },
    { id: 'elements', name: 'Elements', rows: [
      ['Burn', 'Deals damage over time.'],
      ['Chill', 'Slows. 5 stacks Freeze the enemy.'],
      ['Shock', 'Enemy takes +15% damage.'],
      ['Mark', 'Each stack adds +5% damage taken.'],
      ['Resonance', 'Adjacent towers of different elements: +8% Damage per element.'],
    ], combos: true },
    { id: 'run', name: 'In a Run', rows: [
      ['Affixes', 'Random bonuses: Common, Magic, Rare, Legendary. Curses are negative.'],
      ['Veterans', 'Towers rank up from kills. A ! means a mutation is ready.'],
      ['Ascend', 'Max-level towers can Ascend for ×1.3 Damage.'],
      ['Entropy', 'Fills as you fight. When full, draw an Anomaly or Stabilize.'],
      ['Storms', 'Boost one element. Storms merge; 3 types form a Maelstrom.'],
      ['Wormholes', 'New lanes open from wormholes anywhere around the core. Warned 2 waves ahead.'],
      ['Skimmers', 'Fly straight at the core. Pink lines show their route.'],
      ['Abilities', 'Earned from score milestones. Shown on the left.'],
      ['Bosses', 'Every 10 waves, always on the longest road (flying bosses skim it). Drop a boon and a Recalibration token. If one reaches your core, the run ends, so watch the Red Alert.'],
      ['Red Alert', `A boss within ${RED_ALERT.tiles} tiles of the core: sirens, the field turns red and the core goes to Last Stand, hitting it ×${RED_ALERT.coreDmg}. That is the moment for Stasis, a Strike or a burst of Overcharge.`],
      ['Black Market', 'Tap Score to open the Exchange: Cash In, plus a pirate trader with 3 items in stock (a Legendary for your next towers, a bribe for the boss, a stolen blueprint...). Prices climb with the wave; new stock after every boss.'],
      ['Checkpoint', 'Once the field is clear, the game holds before a wormhole opens. Full refunds, free respec, and you can relocate the core. Resume fast for a bonus.'],
      ['Power Nodes', 'Glowing cyan diamonds. A tower built on one is overcharged. Move the core onto one for a bigger boost. Each sector expansion reveals a new one.'],
      ['Space Pirates', "Pirate ships fly over during waves and drop salvage crates. Tap a crate before its ring runs out for credits, a charge, Entropy, score or a token. Red crates are booby-trapped: double loot, but a stowaway elite breaks loose. Boss waves bring the Captain's Chest. Leave a crate too long and a Pirate Skiff may come to steal it; shoot it down to get the loot back plus a bounty."],
      ['Overdrive', `Your one emergency button. From Wave ${OD_WAVE}, tap the core to erase every enemy on the map except bosses. Once per run.`],
      ['Node Links', 'Two attack towers on Power Nodes within 9 tiles link up: +10% Damage each and a beam between them that burns anything crossing it.'],
    ] },
    { id: 'progress', name: 'Progression', rows: [
      ['XP', 'Score converts to XP. Each level grants 1 passive point.'],
      ['Passive Web', 'Spend points on permanent bonuses. Open it anytime.'],
      ['Doctrines', 'Seal a region to adopt its play style: Marksman (few huge guns), Wildfire (the road burns) or War Economy (banked credits arm the core). Each has a cost on the field. You hold 1 seal, 2 from level 75, 3 from level 120.'],
      ['Notables', 'Larger nodes with a signature effect that changes how a build plays. In a Doctrine region they need its seal.'],
      ['Masteries', 'Choose 1 of 3 effects. Swap freely between runs and at checkpoints.'],
      ['Keystones', 'Powerful nodes with a drawback, on the outer rim and at the ends of the Z-axis.'],
      ['Orbits', 'Rings above and below the galaxy. Each satellite boosts the sector it faces. Rotate to retarget.'],
      ['Respec', 'Free between runs and at checkpoints. Otherwise costs Recalibration tokens.'],
      ['Constellation', 'Each region of the web. Light every node in a region to finish it.'],
      ['Star Ranks', 'Spend unlimited points in a finished constellation. Each rank adds a little less than the last.'],
      ['Supernova', 'Finish 3 constellations and reach the required level to collapse your galaxy. You lose your level and web. You keep a Remnant, gain a Cosmic Law, and earn more score and XP from then on.'],
      ['Remnant', "A finished sector you kept through a Supernova. Its notables stay active forever."],
      ['Cosmic Law', 'A permanent rule change picked at each Supernova. Every law adds score.'],
      ['Builds', 'Save up to 5 web layouts and swap between them.'],
      ['Daily', 'One shared map and set of anomalies each day.'],
    ] },
    { id: 'dict', name: 'Dictionary' },
  ];
  let helpTab = 'basics', dictCat = 'status', dictQ = '';
  const rng = (lo, hi, div) => div ? `${lo / div}–${hi / div}` : `${lo}–${hi}`;
  function dictData() {
    const P = { atk: 'Attack towers and the Core', pylon: 'Relay Pylon', forge: 'Credit Forge', core: 'Core' };
    const affRange = A => A.fixed ? (() => { const f = A.fixed.filter(x => x > 0); return f.length > 1 ? `${Math.min(...f)}–${Math.max(...f)}` : `${f[0]}`; })() : rng(A.lo, A.hi, A.div);
    return [
      { id: 'status', name: 'Statuses', rows: [
        ['Burn', 'Deals damage over time.', EL.T.col], ['Chill', 'Slows. Stacks up to 5.', EL.C.col], ['Freeze', 'At 5 Chill stacks the enemy is frozen in place.', EL.C.col],
        ['Shock', 'Enemy takes +15% damage while Shocked.', EL.A.col], ['Mark', 'Each stack adds +5% damage taken.', EL.V.col], ['Stun', 'Enemy cannot move.', EL.A.col],
        ['Cloaked', 'Cannot be targeted. Relay Pylons reveal cloaked enemies.'], ['Plating', 'Blunts every hit except piercing fire: Rail Lance, Void Lens beams, Burn and other damage over time, and abilities. Armor penetration reduces it.'],
        ['Shield', 'Absorbs damage before HP.'] ] },
      { id: 'combos', name: 'Combos', rows: COMBO_NAMES.map(n => [n[0] + n.slice(1).toLowerCase(), COMBO_DESC[n] + '.']) },
      { id: 'terms', name: 'Terms', rows: [
        ['Pierce', 'Hits pass through additional enemies.'], ['Chain', 'Attacks jump to additional nearby enemies.'], ['Splash', 'Damages enemies around the impact. Radius in tiles.'],
        ['Crit', 'Critical hit. Deals bonus Crit Damage.'], ['Ramp', 'Beam damage that grows while it holds one target.'], ['Resonance', 'Adjacent towers of different elements: +8% Damage per element.'],
        ['Specialization', 'A permanent fork chosen at LV 3.'], ['Veteran', 'Rank earned from kills. Each rank offers a mutation.'], ['Mutation', 'An affix you choose when a tower ranks up.'],
        ['Ascend', 'Upgrade past max level for ×1.3 Damage and a new affix.'], ['Elite', 'Enemy with 1 or more elite affixes.'], ['Boon', 'Run-long bonus chosen after a boss.'],
        ['Milestone', 'Score threshold. Grants an ability charge and a small bonus.'], ['Entropy', 'Gauge that fills as you fight. Full: draw an Anomaly.'],
        ['Anomaly', 'Run modifier with a bonus and a cost.'], ['Stabilize', 'Decline an Anomaly for +10% score and a token.'], ['Recalibration token', 'Pays for respecs during a run.'],
        ['Wormhole', 'Origin of a lane. New ones can open on any side of the core, even behind it, and their paths may cross others. Forming wormholes show their future route and open 2 waves later. How many open, and when, depends on Chaos: Normal opens them at Waves 15, 28, 42, 58 and 78.'],
        ['Checkpoint', `Pause before a wormhole's first wave, once the field is clear. Full sell refunds, free respec and core relocation. Resume within ${CP_WINDOW}s for bonus credits and score; the bonus drains over time.`],
        ['Power', `Every tower draws 1 power from your grid; capacity is ${GRID.base} plus 1 every ${GRID.perWaves} waves (shown next to your credits). Towers on Power Nodes draw none. When it's full, make towers better instead of adding more.`],
        ['Overcharge', `Spend spare power on one tower: +${OVERCHARGE.dmg * 100}% Damage and +${OVERCHARGE.rate * 100}% Attack Speed per point, up to ${OVERCHARGE.max}. Free to change at any time, so shift it to whatever the wave needs.`],
        ['Evolution', 'From Wave 8 enemies carry genes: up to 1 until Wave 22, 2 until Wave 45, then 3. Each gene trades HP or speed for an edge. Waves are bred from the enemies that got furthest, so traits your defence handles badly spread. The next-wave chips show what is spreading; tap one for its counter.'],
        ['Ground-only', 'Flame Projector and Gravity Well cannot hit fliers (including enemies that evolve Wings).'],
        ['Power Node', 'Charged tile. Towers on it draw no power and get +25% Damage and +15% Range (support and economy +25%). The core on a Node gets +50% Damage and +20% Rate. Roads never pave over one.'],
        ['Overdrive', `Once per run, from Wave ${OD_WAVE}: tap Overdrive on the left rail (or in the core panel), then tap again to confirm. Every enemy on the map that isn't a boss is erased (with kill credits and score). Bosses survive, losing ${Math.round(OD_BOSS * 100)}% of their remaining HP.`],
        ['Node Link', `Attack towers on Power Nodes within ${LINK_MAX} tiles of each other. Each gets +10% Damage, and a beam between them deals 50% of their average damage per second to anything touching it.`],
        ['Cursed Cache', 'Booby-trapped pirate loot, red, from Wave 10. Double reward, but a stowaway pirate (an elite) breaks loose from a wormhole.'],
        ["Captain's Chest", 'Golden crate the pirate flagship drops once per boss wave. Either your next tower rolls a Legendary, or triple credits plus an ability charge.'],
        ['Pirate Skiff', `From Wave 5, a crate left with under 8 seconds sometimes draws a skiff (1 in 4). It flies in, grabs the crate and escapes. Shoot it down for a bounty of 25 + 6 per wave credits and the loot. It never attacks the core.`],
        ['Salvage Cache', `Drops during waves from Wave 3 and decays in ${CACHE_LIFE}s. Tap to claim credits, an ability charge, Entropy, score or a Recalibration token.`],
        ['Red Alert', `A boss within ${RED_ALERT.tiles} tiles of the core. The field turns red and the core goes to Last Stand: its shells deal ×${RED_ALERT.coreDmg} to that boss and it fires ×${RED_ALERT.coreRate} as fast. While a boss is on the field the next wave's countdown runs slow for up to ${BOSS_HOLD}s.`],
        ['Black Market', `In the Exchange (tap Score). A pirate trader stocks ${MARKET.slots} items, restocked every ${MARKET.refresh} waves. Prices rise with the wave, and each item sells once per stock.`],
        ['Node Beacon', 'Black Market item: tap an empty tile and it becomes a Power Node. Two per run.'], ['Boss Bribe', 'Black Market item: the next boss arrives at 70% health.'],
        ['Stolen Blueprint', 'Black Market item: your next locked tower is unlocked for the rest of this run.'],
        ['Relocate Core', `At Checkpoints: move the core up to ${RELOCATE_RADIUS} tiles. Every road re-routes to reach it. The first move each run is free, then ${RELOCATE_COST} credits each.`], ['Cash In', 'Trade credits for score. Rate: 3 × (1 + 10% per wave), before multipliers.'],
        ['Score multiplier', 'Raised by chaos level, Anomalies, Stabilize, Supernovas and Cosmic Laws.'], ['Skimmer route', 'Pink dotted line. Fliers ignore the path unless a Snare Beacon pulls them in.'] ] },
      { id: 'affix', name: 'Affixes', rows: [
        ['Common', 'Base value.', RARITY[0].col], ['Magic', '×1.7 value.', RARITY[1].col], ['Rare', '×2.6 value.', RARITY[2].col], ['Legendary', 'Unique effect. See Legendaries.', RARITY[3].col], ['Curse', 'Negative affix. See Curses.', RARITY[4].col],
        ...AFFIXES.map(A => [A.t(affRange(A)), `Common range · ${P[A.pool]}`]) ] },
      { id: 'legend', name: 'Legendaries', rows: LEGENDARIES.map(L => [L.name, `${L.t()}. ${P[L.pool]}.`, RARITY[3].col]) },
      { id: 'curse', name: 'Curses', rows: CURSES.map(C => [C.t(), 'Curse', RARITY[4].col]) },
      { id: 'enemy', name: 'Enemies', rows: Object.values(ENEMIES).map(E => [E.name, E.desc + '.', '#ff8a9c']) },
      { id: 'genes', name: 'Evolution', rows: GENE_IDS.map(g => [GENES[g].name, `${GENES[g].desc}. Counter: ${GENES[g].counter}.`, GENES[g].col]) },
      { id: 'elite', name: 'Elite Affixes', rows: ELITE_AFFIXES.map(E => [E.name, E.desc + '.', E.col]) },
      { id: 'boss', name: 'Bosses', rows: BOSSES.map(B => [B.name, B.desc + '.', '#ff4d6a']) },
      { id: 'storm', name: 'Storms', rows: [...Object.values(STORMS).map(S => [S.name, S.desc + '.', S.col]),
        ...Object.entries(COMBO_STORMS).map(([k, n]) => [n, 'Merged storm: ' + k.split('+').map(x => STORMS[x].name).join(' + ') + '. Both effects.']),
        ['Maelstrom', 'Forms when storms of 3 types merge. +75% Damage inside. Collapses after 30s.', '#ff4d6a'] ] },
      { id: 'event', name: 'Events', rows: EVENTS.map(E => [E.name, E.desc + '.', E.good ? '#59f0b4' : '#ff8a9c']) },
      { id: 'laws', name: 'Cosmic Laws', rows: LAWS.map(L => [L.name, `${esc(L.up)}. <span class="bad">Cost: ${esc(L.down)}.</span>`, '#ff9adf']) },
      { id: 'anom', name: 'Anomalies', rows: ANOMALIES.map(A => [A.name, `${A.up}. <span class="bad">Cost: ${esc(A.down)}.</span>`, '#d6a6ff']) },
      { id: 'notable', name: 'Notables', rows: TREE.list.filter(n => n.kind === 'notable').map(n => [n.name, nodeLines(n).join('. ') + '.', n.sector >= 0 ? SECTORS[n.sector].col : '']) },
      { id: 'mastery', name: 'Masteries', rows: TREE.list.filter(n => n.opts).flatMap(n => n.opts.map(o => [o.name, `${Object.keys(o.fx).map(k => STAT_TXT[k] ? STAT_TXT[k](o.fx[k]) : '').filter(Boolean).join('. ')}. <em>${esc(n.name)}</em>`, SECTORS[n.sector].col])) },
      { id: 'orbit', name: 'Orbits', rows: Object.values(ORBITS).flatMap(O => O.sats.map(S => [S.name, `${S.d}. Facing Bastion instead: ${Object.keys(S.E).map(k => STAT_TXT[k](S.E[k])).join(', ')}. <em>${esc(O.name)}</em>`, O.col])) },
      { id: 'ks', name: 'Keystones', rows: TREE.list.filter(n => n.kind === 'keystone').map(n => [n.name, n.lines.join('. ') + '.']) },
      { id: 'abil', name: 'Abilities', rows: ABIL_ORDER.map(k => [ABILITIES[k].name, ABILITIES[k].desc, PAL.warn]) },
      { id: 'tower', name: 'Towers', rows: TOWER_ORDER.map(k => { const D = TOWERS[k]; return [D.name, `${D.blurb} <em>${EL[D.el].name} · Unlocks at Wave ${D.unlock}</em>`, EL[D.el].col]; }) },
    ];
  }
  function dictHTML() {
    const cats = dictData(), q = dictQ.trim().toLowerCase();
    const strip = h => h.replace(/<[^>]+>/g, '');
    const row = r => `<b style="--c:${r[2] || ''}">${esc(r[0])}</b><span>${r[1].includes('<') ? r[1] : esc(r[1])}</span>`;
    let body;
    if (q) {
      const hits = cats.map(c => ({ c, rows: c.rows.filter(r => (r[0] + ' ' + strip(r[1])).toLowerCase().includes(q)) })).filter(x => x.rows.length);
      body = hits.length ? hits.map(x => `<div class="dh2">${x.c.name}</div>` + x.rows.map(row).join('')).join('') : '<span class="dim" style="grid-column:1/-1">No matches.</span>';
    } else body = (cats.find(c => c.id === dictCat) || cats[0]).rows.map(row).join('');
    return `<input class="dsearch" id="dSearch" type="search" placeholder="Search terms" value="${esc(dictQ)}" autocomplete="off">
      ${q ? '' : `<div class="dict-cats">${cats.map(c => `<button class="chip ${c.id === dictCat ? 'on' : ''}" data-act="dcat" data-v="${c.id}">${c.name}</button>`).join('')}</div>`}
      <div class="dict" id="dictBody">${body}</div>`;
  }
  function openHelp(tab) {
    if (G && !G.over) G.paused = true;
    if (tab) helpTab = tab;
    const T = GUIDE.find(g => g.id === helpTab) || GUIDE[0];
    const combos = T.combos ? `<div class="lbl gsub">Combos</div><div class="gcombo">${[
      ['Kinetic', 'Frozen', 'Shatter'], ['Thermal', 'Chilled', 'Thermal Shock'], ['Thermal', 'Shocked', 'Overload'],
      ['Arc', 'Burning', 'Overload'], ['Arc', 'Chilled', 'Superconduct'], ['Void', 'max Marks', 'Collapse'],
    ].map(([a, b, c]) => `<span>${a} <i>on</i> ${b}</span><b>${c}</b>`).join('')}</div>` : '';
    modal(`<div class="card help"><div class="ch"><h2>How to Play</h2><button class="x" data-act="close2" aria-label="Close">✕</button></div>
      <div class="chips gtabs">${GUIDE.map(g => `<button class="chip ${g.id === T.id ? 'on' : ''}" data-act="htab" data-v="${g.id}">${g.name}</button>`).join('')}</div>
      ${T.id === 'dict' ? dictHTML() : `<div class="gd">${T.rows.map(([k, v]) => `<b>${k}</b><span>${v}</span>`).join('')}</div>`}
      ${combos}</div>`, 'help');
    const ds = $('#dSearch');
    if (ds) {
      ds.oninput = () => { dictQ = ds.value; const pos = ds.selectionStart; openHelp(); const n = $('#dSearch'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} };
      ds.onkeydown = e => e.stopPropagation();
    }
  }

  // ---------- Supernova ----------
  let novaFlow = null;
  function novaOffers() {
    PROF.novaOffer = PROF.novaOffer && PROF.novaOffer.n === (PROF.nova || 0) ? PROF.novaOffer : null;
    if (!PROF.novaOffer) {
      const pool = LAWS.filter(L => !PROF.laws.includes(L.id)).map(L => L.id), out = [];
      while (pool.length && out.length < 3) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      PROF.novaOffer = { n: PROF.nova || 0, laws: out }; Save.save();
    }
    return PROF.novaOffer.laws;
  }
  function openNova() {
    const F = novaFlow, nv = PROF.nova || 0, ready = novaReady(), done = regionsDone();
    const rems = done.filter(r => r[0] === 's' && !PROF.remnants.includes(r));
    const head = `<div class="ch"><h2>Supernova${nv ? ' ' + roman(nv + 1) : ''}</h2><button class="x" data-act="close">✕</button></div>`;
    let body = '';
    if (F.step === 0) {
      const lawsHave = PROF.laws.map(id => LAWS.find(L => L.id === id)).filter(Boolean);
      body = `<p class="note">Collapse your galaxy and start a new one. It's harder, it's stranger, and it's worth more.</p>
        <div class="nkeep"><div class="lose"><b>Reset</b>Level and XP<br>Passive web and Star Ranks</div>
        <div class="keep"><b>Keep and gain</b>One Remnant: a finished constellation's notables, active forever<br>One Cosmic Law: +${Math.round(LAW_SCORE * 100)}% score, changes the rules<br>+${Math.round(NOVA_SCORE * 100)}% score and +${Math.round(NOVA_XP * 100)}% XP per Supernova</div></div>
        ${PROF.remnants.length ? `<div class="lbl">Your Remnants</div><p class="note">${PROF.remnants.map(r => esc(REGION_NAME[r])).join(' · ')}</p>` : ''}
        ${lawsHave.length ? `<div class="lbl">Your Laws</div><p class="note">${lawsHave.map(L => esc(L.name)).join(' · ')}</p>` : ''}
        <div class="lbl">Requirements</div><p class="note">${done.length >= 3 ? '✓' : '✗'} 3 finished constellations (${done.length}) · ${profLevel().level >= novaLevelReq(nv) ? '✓' : '✗'} Level ${novaLevelReq(nv)} · ${PROF.runSnap ? '✗ Finish or abandon your saved run' : '✓ No run in progress'}</p>
        <div class="ta"><button class="btn primary" data-act="novaNext" ${ready ? '' : 'disabled'}>${ready ? 'Begin' : 'Not ready yet'}</button></div>`;
    } else if (F.step === 1) {
      body = `<div class="lbl">Choose a Remnant</div><p class="note">Its notables stay active in every galaxy from now on, without spending points.</p>
        <div class="ncards">${rems.length ? rems.map(r => { const S = SECTORS[+r.slice(1)]; return `<button class="ncard ${F.remnant === r ? 'on' : ''}" style="--c:${S.col}" data-act="novaR" data-v="${r}"><b>${esc(REGION_NAME[r])}</b><small>${esc(S.name)}</small>${remnantNodes(r).map(id => `<span>${esc(TREE.nodes[id].name)}</span>`).join('')}</button>`; }).join('') : '<p class="note">No new constellation to keep. Finish another sector to earn a Remnant.</p>'}</div>
        <div class="ta"><button class="btn" data-act="novaBack">Back</button><button class="btn primary" data-act="novaNext" ${F.remnant || !rems.length ? '' : 'disabled'}>Next</button></div>`;
    } else if (F.step === 2) {
      const offers = novaOffers();
      body = `<div class="lbl">Choose a Cosmic Law</div><p class="note">It applies to every run in your new galaxy, and all future ones.</p>
        <div class="ncards">${offers.length ? offers.map(id => { const L = LAWS.find(x => x.id === id); return `<button class="ncard ${F.law === id ? 'on' : ''}" style="--c:#ff9adf" data-act="novaL" data-v="${id}"><b>${esc(L.name)}</b><span class="good">${tipify(L.up)}</span><span class="bad">${tipify(L.down)}</span><small>+${Math.round(LAW_SCORE * 100)}% score</small></button>`; }).join('') : '<p class="note">You already live under every law.</p>'}</div>
        <div class="ta"><button class="btn" data-act="novaBack">Back</button><button class="btn primary" data-act="novaGo" ${F.law || !offers.length ? '' : 'disabled'}>Collapse the galaxy</button></div>`;
    }
    modal(`<div class="card nova-card">${head}${body}</div>`, 'nova');
  }
  function doNova() {
    const F = novaFlow;
    if (!supernova(F.remnant, F.law)) return;
    PROF.novaOffer = null; Save.save(); closeModal();
    const fx = document.createElement('div'); fx.id = 'novafx'; document.body.appendChild(fx); setTimeout(() => fx.remove(), 1700);
    SFX.play('maelstrom');
    setTimeout(() => { renderHangar(); toast('GALAXY REBORN', `Supernova ${PROF.nova}. Score ×${(1 + PROF.nova * NOVA_SCORE + PROF.laws.length * LAW_SCORE).toFixed(2)}, XP +${Math.round(PROF.nova * NOVA_XP * 100)}%.`, '#ff9adf', 1); }, 900);
  }
  function openArchive() {
    const rows = TOWER_ORDER.map(k => { const D = TOWERS[k], ok = towerUnlocked(k); return `<div class="arow ${ok ? '' : 'dim'}"><canvas class="ico" width="20" height="20" data-ico="${k}"></canvas><span>${esc(D.name)}</span><small style="color:${EL[D.el].col}">${EL[D.el].name}</small><em>${ok ? '' : 'Wave ' + D.unlock}</em></div>`; }).join('');
    const ks = TREE.list.filter(n => n.kind === 'keystone' && PROF.alloc.includes(n.id)).map(n => n.name);
    const hrs = Math.floor(PROF.playTime / 3600), mins = Math.floor(PROF.playTime / 60) % 60;
    modal(`<div class="card"><div class="ch"><h2>Archive</h2><button class="x" data-act="close2">✕</button></div>
      <div class="setup-grid"><div class="col"><div class="lbl">Arsenal</div>${rows}</div>
      <div class="col">${hallHTML()}<div class="lbl">Record</div>
        <div class="bigstats two"><span>Runs<b>${PROF.runs}</b></span><span>Best Wave<b>${PROF.bestWave || '—'}</b></span><span>Best Score<b>${PROF.bestScore ? fmt(PROF.bestScore) : '—'}</b></span><span>Kills<b>${fmt(PROF.kills)}</b></span><span>Time Played<b>${hrs}h ${mins}m</b></span><span>Level<b>${profLevel().level}</b></span></div>
        <div class="lbl">Keystones</div><p class="note">${ks.length ? ks.map(esc).join(' · ') : 'None allocated'}</p>
        ${codexHTML()}</div></div></div>`, 'archive');
    for (const cv of document.querySelectorAll('#modal canvas[data-ico]')) Render.towerIcon(cv.dataset.ico, cv);
  }
  function strainsHTML() {
    const X = (PROF.codex || {}).strains || {}, ks = Object.keys(X);
    if (!ks.length) return `<div class="codex"><em>Strains</em><span>None met yet</span></div>`;
    const top = ks.map(k => { const [type, key] = k.split(/:(.*)/), P = parseGenes(key); return { k, type, P, n: X[k].n, w: X[k].w }; })
      .sort((a, b) => (b.P.genes.length - a.P.genes.length) || (b.n - a.n)).slice(0, 10);
    return `<div class="codex strains"><em>Strains · ${ks.length} met</em>${top.map(t => `<span class="on" title="First met on Wave ${t.w}">${esc(strainName(t.type, t.P.genes, t.P.el))} <small>×${fmt(t.n)}</small>${t.P.genes.map(g => `<i style="background:${GENES[g].col}"></i>`).join('')}</span>`).join('')}</div>`;
  }
  function codexHTML() {
    const C = PROF.codex || {};
    const cb = COMBO_NAMES.map(n => `<span class="${C.combos && C.combos[n] ? 'on' : ''}">${C.combos && C.combos[n] ? n[0] + n.slice(1).toLowerCase() : '???'}</span>`).join('');
    const bs = BOSSES.map(b => `<span class="${C.bosses && C.bosses[b.id] ? 'on' : ''}">${C.bosses && C.bosses[b.id] ? esc(b.name) : '???'}</span>`).join('');
    const an = ANOMALIES.filter(a => C.anomalies && C.anomalies[a.id]).length;
    const lg = LEGENDARIES.filter(a => C.legendaries && C.legendaries[a.id]).length;
    return `<div class="lbl">Codex</div>
      <div class="codex"><em>Combos</em>${cb}</div>
      <div class="codex"><em>Bosses</em>${bs}</div>
      ${strainsHTML()}
      <p class="note">Anomalies ${an}/${ANOMALIES.length} · Legendaries ${lg}/${LEGENDARIES.length} · Maelstroms ${C.maelstroms || 0}${C.bestRank ? ` · Top veteran: ${esc(C.bestName)} (${roman(C.bestRank)})` : ''}</p>`;
  }
  function modalAction(act, b) {
    SFX.play('ui');
    switch (act) {
      case 'close': closeModal(); break;
      case 'brief': closeModal(); if (G) { G.paused = false; G.briefing = false; } break;
      case 'evoR': closeModal(); if (G) G.paused = false; openEvo(); break;
      case 'wantR': closeModal(); if (G) G.paused = false; wantedPoster(true); break;
      case 'hall': openHall(+b.dataset.v); break;
      case 'hallBack': openArchive(); break;
      case 'novaNext': novaFlow.step++; openNova(); break;
      case 'novaBack': novaFlow.step = Math.max(0, novaFlow.step - 1); openNova(); break;
      case 'novaR': novaFlow.remnant = b.dataset.v; openNova(); break;
      case 'novaL': novaFlow.law = b.dataset.v; openNova(); break;
      case 'novaGo': doNova(); break;
      case 'close2': { const back = modalFrom; closeModal(); if (back === 'pause' && G && !G.over && screen === 'game') { openPause(); break; } if (G && !G.over && screen === 'game') G.paused = false; break; }
      case 'sw': setup.startWave = +b.dataset.v; renderSetup(); break;
      case 'ch': setup.chaos = +b.dataset.v; rerollMap(); renderSetup(); break;
      case 'reroll': rerollMap(); renderSetup(); break;
      case 'launch': launch(); break;
      case 'launchDaily': launch(); break;
      case 'mode': setup.mode = b.dataset.v; if (setup.mode === 'std') rerollMap(); renderSetup(); break;
      case 'resume': closeModal(); G.paused = false; break;
      case 'help': if (modalOpen === 'pause') modalFrom = 'pause'; openHelp(); break;
      case 'htab': openHelp(b.dataset.v); break;
      case 'dcat': dictCat = b.dataset.v; openHelp(); break;
      case 'settings': if (modalOpen === 'pause') modalFrom = 'pause'; openSettings(); break;
      case 'exit': G.paused = false; snapshotNow(); Save.save(); G = null; closeModal(); show('hangar'); renderHangar(); SFX.music.setIntensity(0.15); break;
      case 'abandon': if (!confirmAbandon) { confirmAbandon = true; openPause(); return; } closeModal(); abandonRun(); break;
      case 'boon': { const o = G.draft && G.draft[+b.dataset.v]; if (!o) { closeModal(); break; } takeBoon(o); closeModal(); toast('BOON', o.name, '#59f0b4'); renderPanel(); break; }
      case 'anom': { takeAnomaly(b.dataset.v); closeModal(); G.paused = false; const A = ANOMALIES.find(a => a.id === b.dataset.v); toast('ANOMALY', A.name, '#b86cff'); Render.fx('nova', {}); renderPanel(); Save.save(); break; }
      case 'stab': { stabilize(); closeModal(); G.paused = false; toast('STABILIZED', `Score multiplier ×${G.scoreMult.toFixed(2)}`, '#59f0b4'); break; }
      case 'hangar': closeModal(); G = null; show('hangar'); renderHangar(); SFX.music.setIntensity(0.15); break;
      case 'again': closeModal(); G = null; show('hangar'); renderHangar(); openSetup(); break;
      case 'web': closeModal(); G = null; show('hangar'); renderHangar(); Tree.open(); break;
      case 'fs': toggleFs(); break;
      case 'newsDone': PROF.seenVer = VERSION; Save.save(); closeModal(); break;
      case 'logCopy': { const t = lastLogText(); if (t) copyText(t); break; }
      case 'logSave': { const t = lastLogText(); if (t) saveText(t); break; }
      case 'assaultDone': PROF.seenAssault = true; Save.save(); closeModal(); if (G && !G.over) G.paused = false; break;
      case 'evoDone': PROF.seenEvo = true; Save.save(); closeModal(); if (G && !G.over) G.paused = false; break;
      case 'news': openNews(); break;
      case 'strack': PROF.settings.soundtrack = b.dataset.v; SFX.setSoundtrack(b.dataset.v); Save.save(); openSettings(); break;
      case 'xcopy': openTransfer('copy'); break;
      case 'xpaste': openTransfer('paste'); break;
      case 'xclip': { const ta = $('#xcode'); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) {} if (navigator.clipboard) navigator.clipboard.writeText(ta.value).then(() => toast('COPIED', 'Save code copied', '#59f0b4', 1)).catch(() => { if (!ok) toast('COPY FAILED', 'Select the code and copy it manually', '#ffb03a', 1); }); else if (ok) toast('COPIED', 'Save code copied', '#59f0b4', 1); break; }
      case 'xload': {
        const raw = ($('#xcode').value || '').trim();
        try {
          if (!raw.startsWith('ENT1:')) throw 0;
          const P = Save.merge(JSON.parse(decodeURIComponent(escape(atob(raw.slice(5))))));
          P.runSnap = null; PROF = P; Save.save(); closeModal(); renderHangar(); Tree.refresh();
          SFX.setVolumes(PROF.settings.sfx, PROF.settings.music);
  SFX.setSoundtrack(PROF.settings.soundtrack || 'ec'); SFX.music.setBaseBpm(PROF.settings.bpm || 72);
          toast('SAVE IMPORTED', `Level ${profLevel().level} · Best Wave ${PROF.bestWave || 0}`, '#59f0b4');
        } catch (e) { toast('INVALID CODE', 'Make sure the full code was pasted', '#ff4d6a', 1); }
        break;
      }
      case 'hud': PROF.settings.hud = b.dataset.v; Save.save(); openSettings(); break;
      case 'uis': PROF.settings.uiScale = b.dataset.v === 'auto' ? 'auto' : +b.dataset.v; Save.save(); UI.fitVV(); openSettings(); break;
      case 'briefs': PROF.settings.briefings = b.dataset.v; Save.save(); openSettings(); break;
      case 'notes': PROF.settings.notes = b.dataset.v; Save.save(); renderFeed(); openSettings(); break;
      case 'nums': PROF.settings.dmgNums = !PROF.settings.dmgNums; Render.nums = PROF.settings.dmgNums; Save.save(); openSettings(); break;
      case 'shake': PROF.settings.shake = !PROF.settings.shake; Render.shakeOn = PROF.settings.shake; Save.save(); openSettings(); break;
      case 'wipe': if (!confirmReset) { confirmReset = true; openSettings(); return; } PROF = defaultProfile(); Save.save(); closeModal(); renderHangar(); toast('PROGRESS RESET', 'All progress erased', '#ff4d6a'); break;
    }
  }

  // ---------- wiring ----------
  function wire() {
    $('#panel').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && !b.disabled) panelAction(b.dataset.act, b); });
    $('#modal').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && !b.disabled) modalAction(b.dataset.act, b); });
    const cv = $('#cv');
    cv.addEventListener('pointerdown', canvasDown);
    cv.addEventListener('pointermove', canvasMove);
    cv.addEventListener('pointerup', canvasUp);
    cv.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); if (!ptrs.size) gesture = null; });
    cv.addEventListener('wheel', canvasWheel, { passive: false });
    $('#bZoom').onclick = () => { SFX.play('ui'); Render.resetCam(); updateZoomBtn(); };
    $('#bCall').onclick = () => { SFX.init(); if (G && G.checkpoint) { const B = resumeCheckpoint(); if (B && B.cr) toast('SPEED BONUS', `+${fmt(B.cr)} credits · +${fmt(B.sc)} score`, '#59f0b4'); updateHud(); return; } const v = callEarly(); if (v) toast('WAVE CALLED', `+${fmt(v)} credits`, '#ffb03a'); updateHud(); };
    $('#asbar').onclick = () => { SFX.play('ui'); openAssault(); };
    $('#chips').addEventListener('click', e => { if (e.target.closest('[data-more]')) { SFX.play('ui'); openReport(); return; } if (e.target.closest('[data-evo]')) { SFX.play('ui'); openEvo(); return; } if (e.target.closest('[data-wanted]')) { SFX.play('ui'); wantedPoster(); return; } const c = e.target.closest('[data-gene]'); if (!c) return; const g = GENES[c.dataset.gene]; SFX.play('ui'); toast(g.name.toUpperCase(), `${g.desc} · counter: ${g.counter}`, g.col, true); });
    $('#pw').parentNode.onclick = () => {
      if (!G || G.over) return; SFX.play('ui');
      const free = gridFree(), T = topTower();
      if (free >= 1 && T && canOvercharge(T) && (T.oc || 0) < ocMax()) {
        const n = Math.min(ocMax(), (T.oc || 0) + free);
        if (setOvercharge(T, n)) { openTower(T); toast('OVERCHARGED', `${TOWERS[T.type].name}${T.name ? ` "${T.name}"` : ''} +${n}: spare power put to work. Change it any time in the tower panel`, '#59f0b4'); updateHud(); return; }
      }
      if (free >= 1) toast('SPARE POWER', `${free} unused. Tap a tower and raise its Overcharge: +${Math.round(OVERCHARGE.dmg * 100)}% Damage per point`, '#59f0b4');
      else toast('POWER', `Every tower draws 1 power; Overcharge draws more. Capacity grows 1 every ${GRID.perWaves} waves, or expand the reactor from the core panel`, '#59f0b4');
    };
    $('#bCash').onclick = () => { SFX.play('ui'); if (!G || G.over) return; if (panel && panel.kind === 'cash') closePanel(); else { closePanel(); openPanel({ kind: 'cash', x: 0, y: 0 }); } updateHud(); };
    $('#bSpeed').onclick = () => { SFX.play('ui'); G.speed = G.speed >= 3 ? 1 : G.speed + 1; updateHud(); };
    $('#bStats').onclick = () => { SFX.play('ui'); hudFull = !hudFull; Render.full = hudFull; document.body.classList.toggle('hudfull', hudFull); updateHud(); };
    $('#bWeb').onclick = () => { SFX.play('ui'); Tree.open(); };
    $('#bPause').onclick = () => { SFX.play('ui'); openPause(); };
    $('#bEnt').onclick = () => { SFX.play('ui'); if (G && G.anomOffers) openAnomaly(); else toast('ENTROPY', 'Fills from kills, combos and waves. Draw an Anomaly when full.', '#b86cff'); };
    $('#abils').addEventListener('click', e => {
      if (e.target.closest('#bOD')) { overdriveTap(); return; }
      const b = e.target.closest('[data-abil]'); if (!b || b.disabled || !G) return;
      const k = b.dataset.abil;
      if (ABILITIES[k].target) { G.aimAbility = G.aimAbility === k ? null : k; if (G.aimAbility) { toast('ORBITAL STRIKE', 'Tap a target', '#ffb03a'); closePanel(); } }
      else useAbility(k);
      updateHud();
    });
    $('#bLaunch').onclick = () => { SFX.init(); SFX.play('ui'); if (PROF.runSnap) launch(PROF.runSnap); else openSetup(); };
    $('#bLaunch2').onclick = () => { SFX.init(); SFX.play('ui'); openSetup(); };
    $('#bWebH').onclick = () => { SFX.init(); SFX.play('ui'); Tree.open(); };
    $('#bNova').onclick = () => { SFX.init(); SFX.play('ui'); novaFlow = { step: 0 }; openNova(); };
    $('#bArchive').onclick = () => { SFX.init(); SFX.play('ui'); openArchive(); };
    $('#bSettings').onclick = () => { SFX.init(); SFX.play('ui'); openSettings(); };
    $('#bHelp').onclick = () => { SFX.init(); SFX.play('ui'); openHelp(); };
    $('#bRotate').onclick = () => document.body.classList.add('portrait-ok');
    document.addEventListener('pointerdown', () => SFX.init(), { once: true });
    document.addEventListener('gesturestart', e => e.preventDefault());
    document.addEventListener('dblclick', e => e.preventDefault());
    // size to the visible viewport so browser toolbars never crop the bottom rail
    const fitVV = () => {
      const vv = window.visualViewport, vw = vv ? vv.width : window.innerWidth, vh = vv ? vv.height : window.innerHeight;
      const auto = clamp(Math.min(vw / 820, vh / 480), 1, 1.6), pref = PROF.settings && PROF.settings.uiScale;
      UIS = pref && pref !== 'auto' ? clamp(auto * pref, 0.8, 2) : auto;
      document.documentElement.style.setProperty('--ui', UIS.toFixed(3));
      document.documentElement.style.setProperty('--vvh', Math.round(vh) + 'px');
      Render.resize(); Tree.resize();
    };
    UI.fitVV = fitVV;
    window.addEventListener('resize', fitVV);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', fitVV);
    window.addEventListener('orientationchange', () => setTimeout(fitVV, 250));
    fitVV();
    document.addEventListener('fullscreenchange', fitVV); document.addEventListener('webkitfullscreenchange', fitVV);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (G && !G.over && screen === 'game') { snapshotNow(); if (!modalOpen) openPause(); } Save.save(); }
    });
    window.addEventListener('keydown', e => {
      if (screen !== 'game' || !G) return;
      if (e.key === ' ') { e.preventDefault(); if (modalOpen === 'pause') modalAction('resume'); else if (!modalOpen) openPause(); }
      if (e.key >= '1' && e.key <= '3') { G.speed = +e.key; updateHud(); }
      if (e.key === 'Escape') closePanel();
    });
    // hooks
    Hooks.sfx = (n, a) => SFX.play(n, a);
    // where on screen a sound happens: -1 left … 1 right, and whether it is in view
    SFX.setLocator((x, y) => { if (screen !== 'game' || !G) return null; const p = Render.tileToScreen(x, y), L = Render.layout; return { px: p.x / L.W * 2 - 1, on: p.x > -20 && p.y > -20 && p.x < L.W + 20 && p.y < L.H + 20 }; });
    Hooks.fx = (t, d) => Render.fx(t, d);
    Hooks.bossIntro = (e, B) => bossIntro(e, B);
    Hooks.evoIntro = () => { if (!PROF.seenEvo && !modalOpen && screen === 'game') setTimeout(() => { if (!modalOpen && G && !G.over) openEvo(true); }, 600); };
    Hooks.assaultWarn = () => { if (!PROF.seenAssault && screen === 'game') setTimeout(() => { if (!modalOpen && G && !G.over && G.assault) openAssault(true); }, 700); };
    Hooks.gridFull = () => { const T = topTower(); toast('GRID FULL', `Every tower uses 1 power (${gridUsed()}/${gridCap()}). Build on a Power Node (free), sell an idle tower, or expand the reactor${T ? `. Or Overcharge your best: ${TOWERS[T.type].name}` : ''}`, '#ffb03a'); };
    Hooks.log = log;
    Hooks.toast = toast;
    Hooks.onDraft = opts => { closePanel(); openDraft(opts); };
    Hooks.onGameOver = () => { closePanel(); setTimeout(openGameOver, 900); };
    Hooks.onLevel = (L, n) => { toast('LEVEL UP · ' + L, `+${n} passive point${n > 1 ? 's' : ''}`, '#59f0b4'); Save.save(); };
    Hooks.onUnlock = k => { if (G) (G.unlocks || (G.unlocks = [])).push(k); if (panel && panel.kind === 'build') renderPanel(); };
    Hooks.onChange = () => { if (G && panel) renderPanel(); Save.save(); };
    Hooks.onSave = () => Save.save();
    Hooks.onWave = () => {};
    Hooks.onCheckpoint = w => { toast('CHECKPOINT', 'A wormhole opens next wave. Rebuild, then Resume fast for a bonus.', '#59f0b4'); if (panel && panel.kind === 'tower') renderPanel(); Save.save(); };
    Hooks.onEntropy = () => {};
  }
  function tick(dt) {
    if (panel && panel.kind === 'tower' && G && !G.towers.includes(panel.t)) closePanel(); // swallowed by the worm, or otherwise gone
    const bossOn = !!(screen === 'game' && G && G.bossAlive && !G.bossAlive.dead); if (bossOn !== document.body.classList.contains('bossbar')) document.body.classList.toggle('bossbar', bossOn);
    hudClock += dt;
    if (screen === 'game' && G && hudClock > 0.1) { hudClock = 0; updateHud(); }
    if (screen === 'game' && G && G.draft && !G.over && !modalOpen && !Tree.isOpen) { closePanel(); openDraft(G.draft); }
    if (G && G.reloc && !canRelocate()) endReloc();
    // continuous sounds: the Void Lens hum and the low-hull heartbeat
    const live = screen === 'game' && G && !G.over && !G.paused && !modalOpen && !Tree.isOpen;
    let nb = 0, rk = 0;
    if (live) for (const t of G.towers) if (t.beamTargets && t.beamTargets.length && t.disabled <= 0) { nb++; rk = Math.max(rk, (t.ramp || 0) / (t.s.rampMax || 3.5)); }
    SFX.beams(nb, rk);
    SFX.danger(live && G.core.hp < G.core.max * 0.35 ? 1 - G.core.hp / (G.core.max * 0.35) : 0, dt);
  }
  function refreshAll() { if (screen === 'hangar') renderHangar(); Tree.refresh(); }
  return {
    wire, tick, show, renderHangar, toast, flushToasts, closePanel, refreshAll, cloud, renderPanel, zoomChanged: () => updateZoomBtn(), openNews, openEvo, slowmo: 0,
    get screen() { return screen; }, get modalOpen() { return modalOpen; },
  };
})();

// ---------------- Passive web view ----------------
const Tree = (() => {
  let cv, c, lb, lc, W = 0, H = 0, dpr = 1, open_ = false, cam = null, goal = null, sel = null, path = null;
  const ptrs = new Map(); let pinch = null, dragMoved = 0, drawer = null, confirmWipe = false, frame = 0, shiftPan = false;
  const R = { start: 15, small: 7, notable: 12, mastery: 14, keystone: 17, orbit: 13, sat: 11, seal: 15 };
  const PD = 1800, ORB_R = 120, WS = WEB_SCALE, PILX = 1420;
  const DEF = () => flatMode() ? { tx: 0, ty: 40, tz: 0, yaw: 0, pitch: 0.001, zoom: clamp(Math.min(W / 3200, H / 2300), 0.1, 1) } : { tx: 0, ty: 0, tz: 0, yaw: 0.35, pitch: 0.98, zoom: clamp(Math.min(W, H) / 1650, 0.16, 1) };
  let cy_ = 1, sy_ = 0, cp_ = 1, sp_ = 0, camOX = 0, viewT = 1, profOn = false;
  const flatMode = () => !PROF.settings || PROF.settings.webView !== '3d';
  const orbView = {};
  function camPrep() { cy_ = Math.cos(cam.yaw); sy_ = Math.sin(cam.yaw); cp_ = Math.cos(cam.pitch); sp_ = Math.sin(cam.pitch); }
  // world (x right, y down the plane, z up) -> screen css px
  function proj(x, y, z, o) {
    x -= cam.tx; y -= cam.ty; z -= cam.tz;
    const x1 = x * cy_ - y * sy_, y1 = x * sy_ + y * cy_;
    const y2 = y1 * cp_ - z * sp_, z2 = y1 * sp_ + z * cp_;
    const k = cam.zoom * PD / Math.max(300, PD - z2);
    o.x = W / 2 + camOX + x1 * k; o.y = H / 2 + y2 * k; o.s = k; o.d = z2;
    return o;
  }
  function satAngle(n) { const v = orbView[n.orbit] !== undefined ? orbView[n.orbit] : orbitRot(n.orbit); return (-90 + (n.sat * 2 + v) * 60) * Math.PI / 180; }
  function pos3(n) { if (n.sat !== undefined) { const a = satAngle(n); return [Math.cos(a) * ORB_R, Math.sin(a) * ORB_R, n.z]; } return [n.x, n.y, n.z || 0]; }
  // flat planning layout: the disk top-down, Zenith as a pillar on the right, Nadir on the left
  function posFlat(n) {
    if (n.sector !== -2) return [n.x, n.y, 0];
    const side = n.z > 0 ? 1 : -1, px = side * PILX, py = 330 - Math.abs(n.z) * 1.45;
    if (n.kind === 'seal') return [px + 150, py, 0];
    if (n.sat !== undefined) { const a = satAngle(n); return [px + Math.cos(a) * ORB_R * 0.9, py + Math.sin(a) * ORB_R * 0.55, 0]; }
    return [px, py, 0];
  }
  function npos(n) {
    if (viewT >= 0.999) return posFlat(n);
    if (viewT <= 0.001) return pos3(n);
    const a = pos3(n), b = posFlat(n), t = viewT * viewT * (3 - 2 * viewT);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  // galaxy dust, generated once
  let dust = null, bg = null;
  function makeDust() {
    let sd = 1337; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    const gauss = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;
    dust = [];
    SECTORS.forEach((S, i) => {
      const a0 = (-90 + i * 60) * Math.PI / 180;
      for (let k = 0; k < 360; k++) {
        const r = 90 + Math.pow(rnd(), 0.75) * 860 * WS, th = a0 + gauss() * 0.42 + 0.28 * Math.log(r / 90);
        dust.push({ x: Math.cos(th) * r, y: Math.sin(th) * r, z: gauss() * 26 * (1.1 - r / 1000), col: S.col, a: 0.18 + rnd() * 0.5, s: rnd() < 0.06 ? 2 : 1 });
      }
    });
    for (let k = 0; k < 560; k++) { const r = Math.abs(gauss()) * 150, th = rnd() * 6.283; dust.push({ x: Math.cos(th) * r, y: Math.sin(th) * r, z: gauss() * 45, col: ['#fff2c8', '#ffb03a', '#ffffff', '#ffd27a'][k % 4], a: 0.25 + rnd() * 0.6, s: rnd() < 0.15 ? 2 : 1 }); }
    for (let k = 0; k < 260; k++) { const r = 1250 + rnd() * 800, th = rnd() * 6.283; dust.push({ x: Math.cos(th) * r, y: Math.sin(th) * r, z: gauss() * 380, col: '#c9c6ff', a: 0.15 + rnd() * 0.35, s: 1 }); }
    bg = []; for (let k = 0; k < 220; k++) bg.push({ x: rnd(), y: rnd(), p: 0.2 + rnd() * 0.8, a: 0.15 + rnd() * 0.5 });
  }
  function init() {
    cv = $('#tcv'); c = cv.getContext('2d');
    lb = document.createElement('canvas'); lc = lb.getContext('2d');
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: (e.clientX / UIS), y: (e.clientY / UIS) }); dragMoved = 0; shiftPan = e.shiftKey || e.button === 2; goal = null; if (ptrs.size === 2) startPinch(); });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId) || !cam) return;
      const p = ptrs.get(e.pointerId), dx = (e.clientX / UIS) - p.x, dy = (e.clientY / UIS) - p.y;
      p.x = (e.clientX / UIS); p.y = (e.clientY / UIS);
      if (ptrs.size === 1) {
        dragMoved += Math.abs(dx) + Math.abs(dy);
        if (shiftPan || viewT > 0.5) panBy(dx, dy);
        else { cam.yaw -= dx * 0.0065; cam.pitch = clamp(cam.pitch - dy * 0.005, 0.22, 1.38); }
      } else if (ptrs.size === 2 && pinch) {
        const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        cam.zoom = clamp(pinch.z * d / pinch.d, 0.12, 3);
        panBy(mx - pinch.mx, my - pinch.my); pinch.mx = mx; pinch.my = my;
        dragMoved += 20;
      }
    });
    const up = e => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (ptrs.size === 0 && dragMoved < 10) tap((e.clientX / UIS), (e.clientY / UIS));
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); pinch = null; });
    cv.addEventListener('wheel', e => { e.preventDefault(); if (cam) cam.zoom = clamp(cam.zoom * (e.deltaY < 0 ? 1.12 : 0.89), 0.12, 3); }, { passive: false });
    $('#tree').addEventListener('click', e => { const b = e.target.closest('[data-tact]'); if (b && !b.disabled) action(b.dataset.tact, b); });
    makeDust();
  }
  function startPinch() { const [a, b] = [...ptrs.values()]; pinch = { d: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), z: cam.zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; }
  function panBy(dx, dy) {
    camPrep();
    const x1 = dx / cam.zoom, y1 = dy / cam.zoom / Math.max(0.35, cp_);
    cam.tx = clamp(cam.tx - (x1 * cy_ + y1 * sy_), -1700, 1700); cam.ty = clamp(cam.ty - (-x1 * sy_ + y1 * cy_), -1400, 1400);
  }
  function resize() {
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    dpr = Math.min(3, window.devicePixelRatio || 1) * UIS;
    W = r.width / UIS; H = r.height / UIS;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    lb.width = Math.max(1, Math.ceil(W / 2)); lb.height = Math.max(1, Math.ceil(H / 2));
  }
  function open() {
    if (G && !G.over) G.wasPaused = G.paused;
    UI.closePanel();
    $('#tree').hidden = false; open_ = true; document.body.classList.add('webopen');
    resize();
    viewT = flatMode() ? 1 : 0;
    if (!sel || !cam) cam = DEF();
    renderRegions();
    for (const k in ORBITS) { orbView[k] = orbitRot(k); delete orbView[k + '_t']; }
    drawer = null;
    refresh();
  }
  function close() {
    $('#tree').hidden = true; open_ = false; sel = null; path = null; drawer = null; document.body.classList.remove('tsel', 'webopen');
    UI.flushToasts();
    if (UI.screen === 'hangar') UI.renderHangar();
    Save.save();
  }
  function tap(sx, sy) {
    const r = cv.getBoundingClientRect(), px = sx - r.left / UIS, py = sy - r.top / UIS, o = {};
    camPrep();
    if (cA > 0.5) { let hb = null, hd = 1e9; for (const h of cHits) { const d = Math.hypot(h.x - px, h.y - py); if (d < h.r && d < hd) { hd = d; hb = h; } } if (hb) { SFX.play('ui'); flyTo(hb.rid); return; } }
    selStar = null;
    const A0 = new Set(PROF.alloc), cullR = cullRadius(), fs = focusSector(), cands = [];
    for (const n of TREE.list) {
      const [x, y, z] = npos(n);
      if (nodeFade(n, x, y, z, cullR, fs, A0, n.id === sel || (path && path.includes(n.id))) < 0.3) continue; // hidden or faded back
      proj(x, y, z, o);
      const d = Math.hypot(o.x - px, o.y - py), hitR = Math.max(16, R[n.kind] * o.s + 9);
      if (d >= hitR) continue;
      // nearer to the eye wins in 3D; the next step from your build and the current path get a nudge
      const next = !A0.has(n.id) && n.adj.some(x2 => A0.has(x2));
      cands.push({ n, d, sc: d - o.d * 0.004 - (next ? 6 : 0) - (path && path.includes(n.id) ? 4 : 0) - (n.id === sel ? 8 : 0) });
    }
    cands.sort((a, b) => a.sc - b.sc);
    const best = cands.length ? cands[0].n : null;
    // two nodes under one finger: zoom in on the spot instead of guessing
    if (cands.length > 1 && best.id !== sel && cands[1].sc - cands[0].sc < 5 && cands[0].d < 14 && cands[1].d < 14 && cam.zoom < 2.6) {
      const [x, y, z] = npos(best); SFX.play('ui'); goal = { tx: x, ty: y, tz: flatMode() ? 0 : z * 0.85, zoom: Math.min(3, cam.zoom * 1.9) }; return;
    }
    if (best && sel === best.id) {
      const p = treePathTo(best.id);
      if (p && p.length && p.length <= pointsFree()) { if (allocWithUndo(best.id)) SFX.play('upgrade', {}); else { SFX.play('deny'); blockToast(best.id); } }
    }
    sel = best ? best.id : null;
    path = sel ? treePathTo(sel) : null;
    if (best) { SFX.play('ui'); const [x, y, z] = flatMode() ? posFlat(best) : pos3(best); goal = { tx: x, ty: y, tz: flatMode() ? 0 : z * 0.85 }; const zf = DEF().zoom * (flatMode() ? 2.6 : 2); if (cam.zoom < zf) goal.zoom = zf; }
    refresh();
  }
  function inRun() { return !!(G && !G.over); }
  function blockMsg(id) {
    const r = treeBlock(id), lv = profLevel().level;
    if (r.startsWith('seal:')) { const i = +r.slice(5); return `Needs the ${DOCTRINES[i].name} seal first`; }
    if (r === 'slots') { const nx = SEAL_NEXT(lv); return `You hold ${sealsHeld()} of ${sealSlots(lv)} Doctrine seal${sealSlots(lv) > 1 ? 's' : ''}${nx ? `. Another opens at level ${nx}` : ''}. Refund one to switch`; }
    if (r.startsWith('conflict:')) { const o = TREE.nodes[r.slice(9)]; return `Cancels out ${o ? o.name : 'another node'} you already hold: refund it first`; }
    return '';
  }
  function blockToast(id) { const m = blockMsg(id); if (m) UI.toast('DOCTRINE', m, '#ffb03a', 1); }
  function docHTML() {
    const A = new Set(PROF.alloc), lv = profLevel().level, held = sealsHeld(), slots = sealSlots(lv), nx = SEAL_NEXT(lv);
    const rows = Object.keys(DOCTRINES).map(k => {
      const i = +k, D = DOCTRINES[i], pil = D.pillar, S = pil ? { col: pil === 'zen' ? '#9fd8ff' : '#ff5fa8' } : SECTORS[i], on = A.has('d' + i), pt = pil === 'zen' ? 'z' : 'n';
      const ms = (pil ? [['Seal', 'd' + i], ['Orbit I', pt + 'o1'], ['Orbit II', pt + 'o2'], ['Keystone', pt + 'ak']] : [['Seal', 'd' + i], ['Notables', [0, 1, 2].map(c => `c${i}_${c}n`)], ['Mastery', 'x' + i], ['Keystone', 'k' + i], ['Arm', 'w' + i]]).map(([nm, id]) => {
        if (Array.isArray(id)) { const h = id.filter(x => A.has(x)).length; return `<span class="${h === id.length ? 'on' : ''}">${nm} ${h}/${id.length}</span>`; }
        return `<span class="${A.has(id) ? 'on' : ''}">${nm}${TREE.nodes[id].kind === 'keystone' ? ': ' + esc(TREE.nodes[id].name) : ''}</span>`; }).join('');
      return `<div class="docrow ${on ? 'on' : ''}" style="--c:${S.col}"><b>${esc(D.name.toUpperCase())}</b><em>${esc(D.tag)}</em>
        <ul>${D.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul><div class="ms">${ms}</div>
        ${(() => { if (!on) return `<button class="btn small" data-tact="docgo" data-n="d${i}">Show seal</button>`;
          const goals = (pil ? [pt + 'o1', pt + 'o2', pt + 'ak'] : ['c' + i + '_0n', 'c' + i + '_1n', 'c' + i + '_2n', 'x' + i, 'k' + i, 'w' + i]).filter(id => !A.has(id)).map(id => ({ id, p: treePathTo(id) })).filter(g => g.p && !treeBlock(g.id, g.p)).sort((a, b) => a.p.length - b.p.length);
          return goals.length ? `<button class="btn small primary" data-tact="docgo" data-n="${goals[0].id}">Next: ${esc(TREE.nodes[goals[0].id].name)} · ${goals[0].p.length} pt${goals[0].p.length > 1 ? 's' : ''}</button>` : '<span class="note">Doctrine complete</span>'; })()}</div>`; }).join('');
    return `<div class="ph"><b>Doctrines · ${held}/${slots} sealed</b><button class="x" data-tact="docs">✕</button></div>
      <p class="note">${tipify(`A Doctrine changes how you play. Take its seal and its notables, mastery, keystone and arm open up. You can hold ${slots}${nx ? `; another seal opens at level ${nx}` : ''}. Refunds are free between runs.`)}</p>
      ${rows}<p class="note">Hybrid notables between sectors and the three outer keystones stay open to everyone.</p>`;
  }
  function action(act, b) {
    SFX.play('ui');
    switch (act) {
      case 'close': close(); break;
      case 'undo': if (undo()) SFX.play('sell', {}); else SFX.play('deny'); break;
      case 'alloc': if (allocWithUndo(sel)) { SFX.play('upgrade', {}); path = treePathTo(sel); } else { SFX.play('deny'); blockToast(sel); } refresh(); break;
      case 'refund': if (treeRefund(sel)) { SFX.play('sell', {}); path = treePathTo(sel); } else SFX.play('deny'); refresh(); break;
      case 'builds': drawer = drawer === 'builds' ? null : 'builds'; refresh(); break;
      case 'docs': drawer = drawer === 'docs' ? null : 'docs'; refresh(); break;
      case 'docgo': { const id = b.dataset.n, n = TREE.nodes[id]; drawer = null; sel = id; path = treePathTo(id); const [x, y, z] = flatMode() ? posFlat(n) : pos3(n); goal = { tx: x, ty: y, tz: flatMode() ? 0 : z * 0.85, zoom: Math.max(cam.zoom, DEF().zoom * (flatMode() ? 2.6 : 2)) }; refresh(); break; }
      case 'totals': drawer = drawer === 'totals' ? null : 'totals'; refresh(); break;
      case 'save': { const i = +b.dataset.v, inp = document.getElementById('bn' + i); PROF.builds[i] = { name: (inp && inp.value.trim()) || `Build ${i + 1}`, alloc: PROF.alloc.slice() }; Save.save(); UI.toast('BUILD SAVED', PROF.builds[i].name, '#59f0b4', 1); refresh(); break; }
      case 'load': { const r = treeLoadBuild(+b.dataset.v); const msg = { ok: PROF.builds[+b.dataset.v] ? PROF.builds[+b.dataset.v].name : '', points: 'Not enough passive points', tokens: 'Requires 2 Recalibration tokens', empty: 'Slot is empty' }[r]; UI.toast(r === 'ok' ? 'BUILD LOADED' : 'CAN\'T LOAD', msg, r === 'ok' ? '#59f0b4' : '#ff4d6a', 1); sel = null; path = null; refresh(); break; }
      case 'wipe': if (inRun()) return; if (!confirmWipe) { confirmWipe = true; refresh(); return; } PROF.alloc = ['start']; confirmWipe = false; sel = null; path = null; Save.save(); refresh(); break;
      case 'center': sel = null; path = null; selStar = null; refresh(); goal = Object.assign(DEF(), flatMode() ? {} : { yaw: 0.35 }); break;
      case 'view': PROF.settings.webView = flatMode() ? '3d' : 'flat'; Save.save(); goal = Object.assign(DEF(), { yaw: flatMode() ? 0 : 0.35 }); renderRegions(); break;
      case 'profile': profOn = !profOn; renderProfile(); break;
      case 'rgn': flyTo(b.dataset.v); break;
      case 'here': flyHere(); break;
      case 'star': { const v = b.dataset.v, n = v === 'max' ? pointsFree() : +v; if (starBuy(selStar, n)) { SFX.play('upgrade', {}); Save.save(); } refresh(); break; }
      case 'starR': if (starRefund(selStar, +b.dataset.v)) Save.save(); refresh(); break;
      case 'starX': selStar = null; refresh(); break;
      case 'rotL': case 'rotR': rotateOrbit(act === 'rotR' ? 1 : -1); break;
      case 'mopt': {
        const n = TREE.nodes[sel], v = +b.dataset.v; if (!n || !n.opts || !PROF.alloc.includes(sel) || masteryPick(sel) === v) break;
        if (inRun() && !G.checkpoint) { if (G.tokens < 1) { SFX.play('deny'); break; } G.tokens--; }
        PROF.mastery[sel] = v; if (inRun()) recomputeAll(); SFX.play('upgrade', {}); Save.save(); refresh(); break;
      }
      case 'lout': {
        const k = b.dataset.v; let L = loadoutList().slice();
        if (L.includes(k)) { if (L.length > 1) L = L.filter(x => x !== k); else { SFX.play('deny'); break; } } else L.push(k);
        PROF.loadout = ABIL_ORDER.filter(x => L.includes(x)); if (inRun()) recomputeAll(); Save.save(); refresh(); break;
      }
    }
  }
  function refresh() {
    if (!open_) return;
    if (sel) selStar = null;
    renderRegions();
    document.body.classList.toggle('tsel', !!sel || !!selStar);
    if (profOn) renderProfile();
    const free = pointsFree(), M = computeMods(PROF.alloc, null), a = M.attrs;
    $('#tPts').textContent = free;
    { const u = $('#tUndo'); if (u) u.hidden = !undoStack.some(p => p.length && p.every(x => PROF.alloc.includes(x))); }
    $('#tPts').parentElement.classList.toggle('glow', free > 0);
    $('#tTok').hidden = !inRun();
    if (inRun()) $('#tTok').querySelector('b').textContent = G.tokens;

    // info card
    const info = $('#tinfo');
    info.classList.toggle('hint', !sel && !selStar);
    if (!sel && selStar) {
      const rid = selStar, S = STARS[rid], rk = (PROF.stars && PROF.stars[rid]) || 0, col = rid[0] === 's' ? SECTORS[+rid.slice(1)].col : rid === 'zen' ? '#9fd8ff' : '#ff5fa8';
      const tot = starTotal(rid, rk), nxt = starTotal(rid, rk + 1) - tot, t = STAT_TXT[S.key], f2 = v => Math.round(v * 10) / 10;
      const rem = (PROF.remnants || []).includes(rid), canR = !inRun();
      info.innerHTML = `<div class="ti tstar" style="--c:${col}"><div><i style="color:${col}">Star Rank</i><b>${esc(REGION_NAME[rid])}</b></div>
        <div class="big">${rk}</div>
        <ul><li>${rk ? esc(t(f2(tot))) : 'No ranks yet'}</li><li>Next rank: ${esc(t(f2(nxt)))}</li>${rem ? '<li>Remnant: its notables carry through every Supernova</li>' : ''}</ul>
        <div class="srow"><button class="btn primary" data-tact="star" data-v="1" ${free ? '' : 'disabled'}>+1</button><button class="btn" data-tact="star" data-v="5" ${free >= 5 ? '' : 'disabled'}>+5</button><button class="btn" data-tact="star" data-v="max" ${free ? '' : 'disabled'}>All ${free}</button>${canR && rk ? `<button class="btn danger" data-tact="starR" data-v="1">−1</button>` : ''}</div>
        <span class="note">${free ? '' : 'No free points. '}${canR ? 'Refunds are free between runs.' : 'Refund ranks between runs.'}</span>
        <div class="ta"><button class="btn" data-tact="starX">Close</button></div></div>`;
    } else if (!sel) { info.innerHTML = `<p class="note">Drag to rotate · pinch to zoom · two fingers to pan · tap a node twice to allocate</p>`; }
    else {
      const n = TREE.nodes[sel], allocd = PROF.alloc.includes(sel);
      const kindName = { seal: 'Doctrine Seal', start: 'Galactic Core', small: n.sector === -2 ? (n.z > 0 ? 'Zenith' : 'Nadir') : 'Passive', notable: n.hybrid ? 'Hybrid Notable' : n.arm ? 'Arm Notable' : 'Notable', mastery: 'Mastery', keystone: n.sector === -2 ? (n.z > 0 ? 'Zenith Keystone' : 'Nadir Keystone') : 'Keystone', orbit: 'Orbit', sat: 'Satellite' }[n.kind];
      const col = n.col || (n.sector >= 0 ? SECTORS[n.sector].col : '#ffb03a');
      let act = '';
      if (n.kind === 'start') act = '<span class="note">Starting node</span>';
      else if (!allocd) {
        const p = treePathTo(sel);
        if (!p) act = '<span class="note">Not connected</span>';
        else { const bm = blockMsg(sel); act = bm ? `<span class="note lock">${esc(bm)}</span>` : `<button class="btn primary" data-tact="alloc" ${p.length > free ? 'disabled' : ''}>Allocate · ${p.length} point${p.length > 1 ? 's' : ''}</button>${p.length > free ? `<span class="note">${free} available</span>` : ''}`; }
      } else {
        const o = treeOrphans(sel) || [];
        const paid = inRun() && !G.checkpoint;
        const cost = paid ? ` · ${o.length} token${o.length > 1 ? 's' : ''}` : '';
        act = `<button class="btn danger" data-tact="refund" ${paid && G.tokens < o.length ? 'disabled' : ''}>Refund${o.length > 1 ? ` ${o.length} nodes` : ''}${cost}</button>${paid ? `<span class="note">Costs Recalibration tokens. Free at checkpoints.</span>` : `<span class="note">${inRun() ? 'Free at this checkpoint' : 'Free between runs'}</span>`}`;
      }
      let extra = '';
      if (n.opts) {
        const cur = masteryPick(n.id), paid = inRun() && !G.checkpoint;
        extra = `<div class="mopts"><div class="lbl">${allocd ? 'Choose one' + (paid ? ' · changing costs 1 token' : '') : 'Allocate to choose one'}</div>${n.opts.map((o, i) => `<button class="mopt ${i === cur ? 'on' : ''}" data-tact="mopt" data-v="${i}" ${allocd && i !== cur && !(paid && G.tokens < 1) ? '' : i === cur ? '' : 'disabled'}><b>${esc(o.name)}</b><span>${Object.keys(o.fx).map(k => STAT_TXT[k] ? tipify(STAT_TXT[k](o.fx[k])) : '').filter(Boolean).join('. ')}</span></button>`).join('')}</div>`;
      }
      if (n.orbitHub) {
        const O = ORBITS[n.id], paid = inRun() && !G.checkpoint;
        extra = `<div class="mopts"><div class="lbl">${allocd ? 'Rotate to retarget' + (paid ? ' · 1 token per turn' : ' · free right now') : 'Allocate to power the ring'}</div>${O.sats.map((S2, k) => { const sn = TREE.nodes[n.id + '_' + k]; return `<div class="mopt ${PROF.alloc.includes(sn.id) ? 'on' : ''}"><b>${esc(S2.name)}</b><span>${tipify(satLines(sn)[0])}</span></div>`; }).join('')}${allocd ? `<div class="rots"><button class="btn" data-tact="rotL" ${paid && G.tokens < 1 ? 'disabled' : ''}>⟲ Rotate</button><button class="btn" data-tact="rotR" ${paid && G.tokens < 1 ? 'disabled' : ''}>Rotate ⟳</button></div>` : ''}</div>`;
      }
      if (n.need !== undefined) extra += `<div class="mopts"><span class="note ${PROF.alloc.includes('d' + n.need) ? '' : 'lock'}">${PROF.alloc.includes('d' + n.need) ? `Part of the ${esc(DOCTRINES[n.need].name)} Doctrine` : `Locked: needs the ${esc(DOCTRINES[n.need].name)} seal`}</span></div>`;
      if (n.kind === 'seal') extra += `<div class="mopts"><span class="note">${esc(DOCTRINES[n.doctrine].tag)}. Opens this region's notables, mastery, keystone and arm. Seals held: ${sealsHeld()}/${sealSlots(profLevel().level)}.</span></div>`;
      if (REM_SET().has(n.id)) extra += `<div class="mopts"><span class="note">Kept by your Remnant. Always active, even unallocated.</span></div>`;
      if (n.sat !== undefined) extra = `<div class="mopts"><span class="note">Rotate ${esc(ORBITS[n.orbit].name)} to change which sector this faces.</span></div>`;
      if (n.fx.loadout && allocd) {
        const L = loadoutList();
        extra = `<div class="mopts"><div class="lbl">Milestone loadout · ${L.length} of ${ABIL_ORDER.length} · +${(ABIL_ORDER.length - L.length) * 25}% ability power</div><div class="louts">${ABIL_ORDER.map(k => `<button class="lout ${L.includes(k) ? 'on' : ''}" data-tact="lout" data-v="${k}">${svgIcon(k)}<span>${esc(ABILITIES[k].short)}</span></button>`).join('')}</div></div>`;
      }
      info.innerHTML = `<div class="ti"><div><i style="color:${col}">${kindName}</i><b>${esc(n.name)}</b></div><ul>${nodeLines(n).map(l => `<li>${tipify(l)}</li>`).join('')}</ul>${extra}<div class="ta">${act}</div></div>`;
    }
    // drawer
    const dr = $('#tdrawer');
    dr.hidden = !drawer;
    { const td = $('#tDoc'); if (td) { const on = Object.keys(DOCTRINES).filter(k => PROF.alloc.includes('d' + k)).map(k => DOCTRINES[k].name); td.textContent = on.length ? on.join(' + ') : 'Doctrine'; } }
    if (drawer === 'docs') dr.innerHTML = docHTML();
    else if (drawer === 'builds') {
      dr.innerHTML = `<div class="ph"><b>Saved Builds</b><button class="x" data-tact="builds">✕</button></div>
        ${PROF.builds.map((bd, i) => `<div class="slot"><input id="bn${i}" type="text" maxlength="20" placeholder="Build ${i + 1}" value="${bd ? esc(bd.name) : ''}"><small>${bd ? (bd.alloc.length - 1) + ' nodes' : 'Empty'}</small><button class="btn small" data-tact="save" data-v="${i}">Save</button><button class="btn small" data-tact="load" data-v="${i}" ${bd ? '' : 'disabled'}>Load</button></div>`).join('')}
        <p class="note">${inRun() && !G.checkpoint ? 'Loading during a run costs 2 Recalibration tokens. Free at checkpoints.' : 'Loading is free right now.'}</p>
        ${inRun() ? '' : `<button class="btn danger wide" data-tact="wipe">${confirmWipe ? 'Tap again to refund all nodes' : 'Reset Web'}</button>`}`;
    } else if (drawer === 'totals') {
      const raw = M.raw, lines = [];
      lines.push(`+${Math.round((M.dmg - 1) * 100)}% Damage (incl. Power)`);
      lines.push(`+${Math.round((M.rate - 1) * 100)}% Attack Speed (incl. Tempo)`);
      lines.push(`+${Math.round((M.range - 1) * 100)}% Range (incl. Focus)`);
      lines.push(`×${num1(M.stMult)} status chance (Focus)`);
      lines.push(`Core: ${Math.round(M.coreHP)} HP, ${Math.round(M.shield)} shield (incl. Integrity)`);
      for (const k in raw) if (!['P', 'Tm', 'F', 'I', 'dmg', 'rate', 'range', 'coreHP', 'shield'].includes(k) && STAT_TXT[k] && raw[k]) lines.push(STAT_TXT[k](Math.round(raw[k] * 100) / 100));
      const ks = TREE.list.filter(n => n.ks && PROF.alloc.includes(n.id));
      dr.innerHTML = `<div class="ph"><b>Totals</b><button class="x" data-tact="totals">✕</button></div>
        ${ks.length ? `<div class="lbl">Keystones</div>${ks.map(n => `<p class="amber">${esc(n.name)}</p>`).join('')}` : ''}
        <div class="lbl">Attributes</div><p class="note">Power ${a.P} · Tempo ${a.Tm} · Focus ${a.F} · Integrity ${a.I}</p>
        <div class="lbl">Stats</div><ul class="tot">${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>`;
    }
  }
  const PCAT = {
    off: { name: 'Offense', col: '#ff6a5a' }, spd: { name: 'Speed', col: '#ffe14d' }, ctl: { name: 'Control', col: '#6ae2ff' },
    def: { name: 'Defense', col: '#59f0b4' }, eco: { name: 'Economy', col: '#ffb03a' }, chs: { name: 'Chaos', col: '#d06cff' },
  };
  const CATW = {
    dmg: ['off', 1], dmgK: ['off', 0.5], dmgT: ['off', 0.5], dmgC: ['off', 0.5], dmgA: ['off', 0.5], dmgV: ['off', 0.5], critC: ['off', 2], critM: ['off', 0.5], P: ['off', 1],
    eliteDmg: ['off', 0.6], armorPen: ['off', 0.3], critSplash: ['off', 0.4], fifthCrit: ['off', 14], shredStack: ['off', 4], burnVuln: ['off', 1], burnBoom: ['off', 0.6],
    capacitor: ['off', 14], chainKeep: ['off', 12], shockBurst: ['off', 1], markVoid: ['off', 3], rampKeep: ['off', 12], napalmKill: ['off', 12], burnCrit: ['off', 14],
    pierceK: ['off', 10], pierceKeep: ['off', 10], critCK: ['off', 1], critMK: ['off', 0.3], burnDmg: ['off', 0.5], overload: ['off', 0.2], shatter: ['off', 0.2], collapse: ['off', 0.2],
    coreDmg: ['off', 0.15], multiA: ['off', 14], loneWolf: ['off', 0.6], splash: ['off', 30], chain: ['off', 10], infernoCore: ['off', 14], ovlBurn: ['off', 10], ovlFree: ['off', 10],
    rate: ['spd', 1], rateK: ['spd', 0.5], rateA: ['spd', 0.5], Tm: ['spd', 1], heatSink: ['spd', 14], coreRate: ['spd', 0.2], thunder: ['off', 14],
    chillChance: ['ctl', 1], shockChance: ['ctl', 1], markChance: ['ctl', 1], burnChance: ['ctl', 0.6], chillPot: ['ctl', 0.4], freezeDur: ['ctl', 25], freezeAt: ['ctl', 15],
    knock: ['ctl', 2], kSlow: ['ctl', 1], glacial: ['ctl', 1], markSlow: ['ctl', 0.5], coldSnap: ['ctl', 15], chillSplash: ['ctl', 12], stasisDur: ['ctl', 4], iceShards: ['ctl', 12],
    range: ['ctl', 0.6], rangeKR: ['ctl', 0.4], F: ['ctl', 0.8], frozenVuln: ['ctl', 0.5], shockEff: ['ctl', 0.3], markMax: ['ctl', 3], chillSlowDecay: ['ctl', 12], shockLong: ['ctl', 12],
    burnDur: ['ctl', 0.3], chainIgnite: ['ctl', 10], burnSpread: ['ctl', 12], knockMark: ['ctl', 8], freezeImmRed: ['ctl', 0.2], superChill: ['ctl', 10], superRad: ['ctl', 0.1], chillVoid: ['ctl', 0.6], blackHole: ['ctl', 12],
    coreHP: ['def', 0.3], shield: ['def', 0.4], shieldRegen: ['def', 0.15], I: ['def', 1], shieldWave: ['def', 12], fieldRepair: ['def', 3], coreRange: ['def', 6],
    credits: ['eco', 1], costRed: ['eco', 1.2], upgRed: ['eco', 1], startCredits: ['eco', 0.05], sellPct: ['eco', 0.12], interest: ['eco', 7], salvage: ['eco', 12], xp: ['eco', 0.6],
    abilCharge: ['eco', 0.6], abilPower: ['eco', 0.4], loadout: ['eco', 10],
    stormFreq: ['chs', 0.3], stormPow: ['chs', 0.3], affixLuck: ['chs', 0.3], voidSiphon: ['chs', 14], markPerma: ['ctl', 12], overloadRad: ['off', 0.1],
  };
  const KSW = { glass: { off: 40, def: -30 }, conflag: { off: 25, ctl: -10 }, overgrid: { spd: 30, chs: 10 }, abszero: { ctl: 30 }, singularity: { off: 30 }, dimret: { eco: 30 },
    prismatic: { ctl: 20, chs: 10 }, chaos: { chs: 35 }, unbreakable: { def: 35 }, celestial: { off: 15, chs: -15 }, singular: { chs: 40 } };
  const SATW = { dmg: 'off', rate: 'spd', status: 'ctl', range: 'ctl', reson: 'off', vxp: 'off', flux: 'off', storm: 'chs', vol: 'chs', ent: 'chs', rift: 'chs', combo: 'off' };
  function nodeFx(n) {
    if (n.sat !== undefined) { const S = ORBITS[n.orbit].sats[n.sat], el = SECTOR_EL[satSector(n)]; return el === 'E' ? S.E : null; }
    const fx = Object.assign({}, n.fx);
    if (n.opts) { const o = n.opts[masteryPick(n.id)]; if (o) for (const k in o.fx) fx[k] = (fx[k] || 0) + o.fx[k]; }
    return fx;
  }
  function nodeWeights(n) {
    const w = { off: 0, spd: 0, ctl: 0, def: 0, eco: 0, chs: 0 };
    if (n.ks && KSW[n.ks]) for (const k in KSW[n.ks]) w[k] += KSW[n.ks][k];
    if (n.sat !== undefined && SECTOR_EL[satSector(n)] !== 'E') { w[SATW[ORBITS[n.orbit].sats[n.sat].k]] += 18; return w; }
    const fx = nodeFx(n) || {};
    for (const k in fx) { const c = CATW[k]; if (c) w[c[0]] += fx[k] * c[1]; }
    return w;
  }
  function nodeCat(n) { const w = nodeWeights(n); let best = null, bv = 0.01; for (const k in w) if (w[k] > bv) { bv = w[k]; best = k; } return best; }
  function profileOf(alloc) {
    const t = { off: 0, spd: 0, ctl: 0, def: 0, eco: 0, chs: 0 };
    for (const id of alloc) { const n = TREE.nodes[id]; if (!n) continue; const w = nodeWeights(n); for (const k in t) t[k] += w[k]; }
    return t;
  }
  function renderProfile() {
    $('#tProf').classList.toggle('on', profOn);
    const box = $('#tprof'); box.hidden = !profOn; if (!profOn) return;
    const cvs = $('#tpcv'), d = Math.min(3, window.devicePixelRatio || 1); cvs.width = 180 * d; cvs.height = 150 * d;
    const g = cvs.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, 180, 150);
    const P = profileOf(PROF.alloc), keys = ['off', 'spd', 'ctl', 'def', 'eco', 'chs'], cx = 90, cy = 76, R0 = 50;
    const val = k => Math.max(0, P[k]) / (Math.max(0, P[k]) + 70);
    g.strokeStyle = '#2c3160'; g.lineWidth = 1;
    for (const f of [0.33, 0.66, 1]) { g.beginPath(); keys.forEach((k, i) => { const a = -Math.PI / 2 + i * Math.PI / 3; const x = cx + Math.cos(a) * R0 * f, y = cy + Math.sin(a) * R0 * f; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.stroke(); }
    g.beginPath(); keys.forEach((k, i) => { const a = -Math.PI / 2 + i * Math.PI / 3, r = R0 * Math.max(0.04, val(k)); const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath();
    g.fillStyle = 'rgba(255,176,58,0.28)'; g.fill(); g.strokeStyle = '#ffb03a'; g.lineWidth = 1.5; g.stroke();
    g.font = '8px Silkscreen, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    keys.forEach((k, i) => { const a = -Math.PI / 2 + i * Math.PI / 3; g.fillStyle = PCAT[k].col; g.fillText(PCAT[k].name.toUpperCase(), cx + Math.cos(a) * (R0 + 16), cy + Math.sin(a) * (R0 + 12)); });
    const off = P.off + P.spd * 0.7, def = P.def + P.ctl * 0.7, bal = (def - off) / Math.max(30, off + def);
    const lean = Math.abs(bal) < 0.15 ? 'Balanced' : bal < 0 ? (bal < -0.5 ? 'All-in offense' : 'Leans offensive') : (bal > 0.5 ? 'Fortress' : 'Leans defensive');
    const top = keys.slice().sort((a, b) => P[b] - P[a])[0];
    $('#tpbar').innerHTML = `<div class="obl"><span>Offense</span><span>Defense</span></div><div class="ob"><i style="left:calc(${Math.round((bal + 1) * 50)}% - 1px)"></i></div><span><b>${lean}</b>${P[top] > 5 ? ` · strongest in ${PCAT[top].name}` : ''}</span>`;
  }
  const REM_SET = () => { const o = new Set(); for (const r of PROF.remnants || []) for (const id of remnantNodes(r)) o.add(id); return o; };
  const REGIONS = () => [{ id: 'core', name: 'Core', col: '#ffb03a' }, ...SECTORS.map((S, i) => ({ id: 's' + i, name: S.name, col: S.col })), { id: 'zen', name: 'Zenith', col: '#9fd8ff' }, { id: 'nad', name: 'Nadir', col: '#ff5fa8' }];
  function renderRegions() {
    $('#tView').textContent = flatMode() ? '3D' : 'Flat';
    const D = new Set(regionsDone());
    $('#tregions').innerHTML = REGIONS().map(r => `<button class="rgn" data-tact="rgn" data-v="${r.id}" style="--c:${r.col}">${esc(r.name)}${D.has(r.id) ? `<em>${(PROF.stars && PROF.stars[r.id]) || 0}</em>` : ''}</button>`).join('');
  }
  function flyTo(id) {
    const flat = flatMode(), z0 = DEF().zoom;
    sel = null; path = null; selStar = REGION_IDS.includes(id) && regionDone(id) ? id : null; refresh();
    if (id === 'core') { goal = Object.assign(DEF()); return; }
    if (id === 'zen' || id === 'nad') {
      const side = id === 'zen' ? 1 : -1;
      goal = flat ? { tx: side * PILX, ty: 330 - 240 * 1.45, tz: 0, zoom: z0 * 3.4 } : { tx: 0, ty: 0, tz: side * 260, zoom: z0 * 1.7, pitch: 0.55 };
      return;
    }
    const i = +id.slice(1), a = (-90 + i * 60) * Math.PI / 180;
    goal = { tx: Math.cos(a) * 430 * WS, ty: Math.sin(a) * 430 * WS, tz: 0, zoom: z0 * (flat ? 3.2 : 2.3) };
    if (!flat) { goal.yaw = Math.PI / 2 - a; goal.pitch = 0.9; }
  }
  // zoomed in, only nodes near the focus are drawn and tappable, so far-off nodes (in 3D, ones behind) can't steal taps
  let visPos = null;
  function cullRadius() { const zr = cam.zoom / DEF().zoom; if (zr < 1.4) return 1e9; return (flatMode() ? 2600 : 1500) / zr; }
  // zoomed into a sector, other sectors fade back and the Zenith/Nadir pillars hide (3D), so taps land in the region you're looking at
  function focusSector() { const zr = cam.zoom / DEF().zoom; if (zr < 1.8 || viewT < 0 || Math.hypot(cam.tx, cam.ty) < 260 || Math.abs(cam.tz) > 120) return -1; const a = Math.atan2(cam.ty, cam.tx) * 180 / Math.PI; return ((Math.round((a + 90) / 60) % 6) + 6) % 6; }
  function nodeFade(n, x, y, z, cullR, fs, A0, keep) {
    if (keep || A0.has(n.id)) return 1;
    let f = clamp((cullR - Math.hypot(x - cam.tx, y - cam.ty, z - cam.tz)) / (cullR * 0.3), 0, 1);
    if (fs >= 0) { if (n.sector === -2) f = flatMode() ? f : 0; else if (n.sector >= 0 && n.sector !== fs && !n.adj.some(x2 => TREE.nodes[x2].sector === fs)) f = Math.min(f, 0.18); }
    return f;
  }
  // allocation history for Undo (this session)
  const undoStack = [];
  function allocWithUndo(id) { const p = treePathTo(id) || []; if (!treeAllocate(id)) return false; undoStack.push(p.slice()); if (undoStack.length > 30) undoStack.shift(); return true; }
  function undo() {
    while (undoStack.length) {
      const p = undoStack.pop(); if (!p.length || !p.every(x => PROF.alloc.includes(x))) continue;
      const orph = treeOrphans(p[0]) || [];
      if (orph.some(x => !p.includes(x))) { UI.toast('CAN\'T UNDO', 'Later picks depend on it. Refund those first', '#ff4d6a', 1); undoStack.push(p); return false; }
      if (treeRefund(p[0])) { sel = null; path = null; refresh(); return true; }
      UI.toast('CAN\'T UNDO', 'Needs Recalibration tokens during a run', '#ff4d6a', 1); undoStack.push(p); return false;
    }
    return false;
  }
  const lastNode = () => { const a = PROF.alloc || []; for (let i = a.length - 1; i >= 0; i--) if (TREE.nodes[a[i]] && TREE.nodes[a[i]].kind !== 'start') return a[i]; return null; };
  function flyHere() {
    const id = lastNode();
    if (!id) { flyTo('core'); return; }
    const [x, y, z] = npos(TREE.nodes[id]), z0 = DEF().zoom;
    hereT = 90;
    goal = { tx: x, ty: y, tz: z * 0.85, zoom: Math.max(cam.zoom, z0 * 3.2) };
  }
  function rotateOrbit(dir) {
    const n = TREE.nodes[sel]; if (!n || !n.orbitHub || !PROF.alloc.includes(sel)) return;
    if (inRun() && !G.checkpoint) { if (G.tokens < 1) { SFX.play('deny'); UI.toast('CAN\'T ROTATE', 'Requires 1 Recalibration token', '#ff4d6a', 1); return; } G.tokens--; }
    PROF.orbit = PROF.orbit || {};
    PROF.orbit[sel] = ((orbitRot(sel) + dir) % 6 + 6) % 6;
    orbView[sel + '_t'] = (orbView[sel + '_t'] !== undefined ? orbView[sel + '_t'] : orbView[sel]) + dir;
    if (inRun()) recomputeAll();
    SFX.play('reroll'); Save.save(); refresh();
  }
  // pixel helpers on the low-res buffer
  const pxR = (x, y, w, h, col) => { lc.fillStyle = col; lc.fillRect(Math.round(x), Math.round(y), w, h); };
  function pxDia(x, y, r, col) { lc.fillStyle = col; x = Math.round(x); y = Math.round(y); for (let dy = -r; dy <= r; dy++) { const hw = r - Math.abs(dy); lc.fillRect(x - hw, y + dy, hw * 2 + 1, 1); } }
  function pxRing(x, y, r, col) { lc.fillStyle = col; x = Math.round(x); y = Math.round(y); const n = Math.max(8, Math.round(r * 6)); for (let k = 0; k < n; k++) { const a = k / n * 6.283; lc.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), 1, 1); } }
  function line(ax, ay, bx, by, col, w) { lc.strokeStyle = col; lc.lineWidth = w || 1; lc.beginPath(); lc.moveTo(Math.round(ax) + 0.5, Math.round(ay) + 0.5); lc.lineTo(Math.round(bx) + 0.5, Math.round(by) + 0.5); lc.stroke(); }

  // constellations: one figure per region, stars light up as the region fills
  const CONST = (() => {
    const ring = (n, r, a0) => Array.from({ length: n }, (_, k) => [Math.cos(a0 + k / n * 6.283) * r, Math.sin(a0 + k / n * 6.283) * r]);
    const flake = [[0, 0], ...ring(6, 0.45, Math.PI / 2), ...ring(6, 0.9, Math.PI / 2)];
    const flakeL = []; for (let k = 0; k < 6; k++) flakeL.push([0, 1 + k], [1 + k, 7 + k], [1 + k, 1 + (k + 1) % 6]);
    const spiral = [[0, 0]]; for (let k = 0; k < 10; k++) { const th = k * 0.78, r = 0.12 + k * 0.088; spiral.push([Math.cos(th) * r, Math.sin(th) * r]); }
    const snake = []; for (let k = 0; k < 9; k++) { const t = k / 8; snake.push([Math.sin(t * Math.PI * 2.2) * 0.45, 0.85 - t * 1.7]); }
    return {
      K: { name: 'The Archer', pts: [[0, -0.85], [0, 0.9], [-0.16, 0.68], [0.16, 0.68], [-0.62, -0.2], [-0.46, 0.25], [0, 0.42], [0.46, 0.25], [0.62, -0.2], [0, -0.2]],
        ln: [[0, 1], [1, 2], [1, 3], [4, 5], [5, 6], [6, 7], [7, 8], [4, 9], [9, 8]] },
      T: { name: 'The Phoenix', pts: [[0, 0.8], [0, 0.45], [0, -0.2], [-0.4, 0.25], [-0.75, 0.6], [-0.95, 0.15], [0.4, 0.25], [0.75, 0.6], [0.95, 0.15], [-0.25, -0.7], [0, -0.92], [0.25, -0.7]],
        ln: [[0, 1], [1, 2], [1, 3], [3, 4], [4, 5], [5, 2], [1, 6], [6, 7], [7, 8], [8, 2], [2, 9], [2, 10], [2, 11]] },
      A: { name: 'The Thunderbolt', pts: [[0.35, 0.92], [-0.35, 0.02], [0, 0.02], [-0.3, -0.92], [0.42, 0.14], [0.06, 0.14], [-0.75, 0.55], [0.75, -0.45]],
        ln: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]] },
      C: { name: 'The Crystal', pts: flake, ln: flakeL },
      V: { name: 'The Maw', pts: spiral, ln: spiral.slice(1).map((_, k) => [k, k + 1]) },
      E: { name: 'The Bulwark', pts: [[-0.6, 0.72], [0, 0.88], [0.6, 0.72], [0.6, 0], [0.35, -0.52], [0, -0.88], [-0.35, -0.52], [-0.6, 0], [0, 0.5], [0, -0.45], [-0.35, 0.14], [0.35, 0.14]],
        ln: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [8, 9], [10, 11]] },
      zen: { name: 'The Crown', pts: [[-0.7, -0.45], [0.7, -0.45], [-0.75, 0.5], [-0.35, 0.05], [0, 0.75], [0.35, 0.05], [0.75, 0.5]],
        ln: [[0, 1], [0, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 1]] },
      nad: { name: 'The Serpent', pts: [...snake, [0.12, 1.0], [-0.12, 1.0]], ln: [...snake.slice(1).map((_, k) => [k, k + 1]), [0, 9], [0, 10]] },
    };
  })();
  let cgeo = null, cA = 1, cHits = [], hereT = 0, selStar = null;
  function constGeo() {
    if (cgeo) return cgeo;
    cgeo = [];
    SECTORS.forEach((S, i) => {
      const ns = TREE.list.filter(n => n.sector === i);
      if (!ns.length) return;
      let cx = 0, cy = 0; for (const n of ns) { cx += n.x; cy += n.y; } cx /= ns.length; cy /= ns.length;
      const L = Math.hypot(cx, cy) || 1, ur = [cx / L, cy / L], ut = [-ur[1], ur[0]];
      let er = 0, et = 0; for (const n of ns) { const dx = n.x - cx, dy = n.y - cy; er = Math.max(er, Math.abs(dx * ur[0] + dy * ur[1])); et = Math.max(et, Math.abs(dx * ut[0] + dy * ut[1])); }
      cgeo.push({ rid: 's' + i, F: CONST[S.id], col: S.col, ids: ns.map(n => n.id), c: [ur[0] * 560 * WS, ur[1] * 560 * WS], sr: 235, plane: 1 });
    });
    for (const [key, side, col] of [['zen', 1, '#9fd8ff'], ['nad', -1, '#ff5fa8']]) {
      const ns = TREE.list.filter(n => n.sector === -2 && Math.sign(n.z) === side);
      if (ns.length) cgeo.push({ rid: key, F: CONST[key], col, ids: ns.map(n => n.id), side, plane: 0 });
    }
    return cgeo;
  }
  function drawConstellations(A, o) {
    const out = []; cHits = [];
    if (cA < 0.02) return out;
    for (const g of constGeo()) {
      const tot = g.ids.length, have = g.ids.filter(id => A.has(id)).length, full = g.ids.some(id => A.has(id) && TREE.nodes[id].kind === 'keystone');
      const F = g.F, lit = full || have === tot ? F.pts.length : Math.round(have / tot * F.pts.length);
      // world position of figure point (x across, y outward/up)
      let W3;
      if (g.plane) W3 = viewT > 0.5 ? (x, y) => [g.c[0] + x * g.sr, g.c[1] - y * g.sr, 0] : (x, y) => [g.c[0] + cy_ * x * g.sr * 0.8, g.c[1] - sy_ * x * g.sr * 0.8, 60 + (y + 1) * g.sr * 0.8];
      else if (viewT > 0.5) { const px = g.side * PILX, py = 330 - 260 * 1.45; W3 = (x, y) => [px + x * 170, py - y * 240, 0]; }
      else W3 = (x, y) => [cy_ * x * 150, -sy_ * x * 150, g.side * 600 + y * 150];
      const sp = F.pts.map(([x, y]) => { const w = W3(x, y); proj(w[0], w[1], w[2], o); return { x: o.x / 2, y: o.y / 2, s: o.s }; });
      lc.globalCompositeOperation = 'lighter';
      for (const [a, b] of F.ln) {
        const on = a < lit && b < lit;
        lc.globalAlpha = (on ? 0.95 : 0.4) * cA; line(sp[a].x, sp[a].y, sp[b].x, sp[b].y, on ? g.col : '#7a80c0');
      }
      sp.forEach((p, k) => {
        const on = k < lit, tw = 0.8 + 0.2 * Math.sin(frame / 14 + k * 1.7), cl = on ? g.col : '#c8ccf0';
        lc.globalAlpha = cA * tw;
        pxR(p.x - 1, p.y, 3, 1, cl); pxR(p.x, p.y - 1, 1, 3, cl);
        if (on) { pxR(p.x, p.y, 1, 1, '#ffffff'); lc.globalAlpha = (full ? 0.5 : 0.3) * tw * cA; pxR(p.x - 2, p.y, 5, 1, g.col); pxR(p.x, p.y - 2, 1, 5, g.col); }
      });
      lc.globalCompositeOperation = 'source-over'; lc.globalAlpha = 1;
      const ctr = W3(0, 0); proj(ctr[0], ctr[1], ctr[2], o);
      cHits.push({ rid: g.rid, x: o.x, y: o.y, r: Math.max(40, Math.hypot(sp[0].x * 2 - o.x, sp[0].y * 2 - o.y)) });
      const top = W3(0, -1.2); proj(top[0], top[1], top[2], o);
      const done = have === tot, rk = (PROF.stars && PROF.stars[g.rid]) || 0, rem = (PROF.remnants || []).includes(g.rid);
      out.push({ x: o.x, y: o.y, name: F.name, txt: `${F.name.toUpperCase()}  ${done ? 'STAR ' + rk : have + '/' + tot}${rem ? '  · REMNANT' : ''}`, col: g.col, on: have > 0 || rem, full: full || done });
    }
    return out;
  }
  function draw() {
    if (!open_ || !cam) return;
    frame++;
    // smooth camera glide to a tapped node, smooth orbit rotation
    if (goal && !ptrs.size) {
      const k = 0.12;
      for (const f of ['tx', 'ty', 'tz', 'pitch', 'zoom']) if (goal[f] !== undefined) cam[f] += (goal[f] - cam[f]) * k;
      if (goal.yaw !== undefined) { let d = goal.yaw - cam.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); cam.yaw += d * k; }
      const err = Math.abs((goal.tx ?? cam.tx) - cam.tx) + Math.abs((goal.ty ?? cam.ty) - cam.ty) + Math.abs((goal.tz ?? cam.tz) - cam.tz) + Math.abs((goal.zoom ?? cam.zoom) - cam.zoom) * 500 + Math.abs((goal.pitch ?? cam.pitch) - cam.pitch) * 300;
      if (err < 0.5) goal = null;
    }
    const vt = flatMode() ? 1 : 0; viewT += (vt - viewT) * 0.12; if (Math.abs(vt - viewT) < 0.002) viewT = vt;
    for (const k in ORBITS) { if (orbView[k + '_t'] !== undefined) { orbView[k] += (orbView[k + '_t'] - orbView[k]) * 0.15; if (Math.abs(orbView[k + '_t'] - orbView[k]) < 0.005) { orbView[k] = orbView[k + '_t']; } } }
    camOX += ((sel ? -Math.min(330, W * 0.44) / 2 - 6 : 0) - camOX) * 0.15;
    camPrep();
    const RS = REM_SET();
    const LW = lb.width, LH = lb.height, A = new Set(PROF.alloc), Pth = new Set(path || []), o = {}, o2 = {};
    const sealOn = i => A.has('d' + i);
    const allocatable = n => !A.has(n.id) && n.adj.some(x => A.has(x)) && !(n.need !== undefined && !sealOn(n.need)) && !(n.kind === 'seal' && sealsHeld() >= sealSlots(profLevel().level));
    const pulse = (Math.sin(frame / 10) + 1) / 2;
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalCompositeOperation = 'source-over'; lc.globalAlpha = 1;
    lc.fillStyle = '#04050a'; lc.fillRect(0, 0, LW, LH);
    // far starfield with yaw parallax
    for (const st of bg) { const x = ((st.x * LW + cam.yaw * 60 * st.p) % LW + LW) % LW, y = ((st.y * LH + cam.pitch * 30 * st.p) % LH + LH) % LH; lc.globalAlpha = st.a * (0.7 + 0.3 * Math.sin(frame / 30 + st.x * 50)); pxR(x, y, 1, 1, '#d8d6ff'); }
    // galactic dust (additive)
    lc.globalCompositeOperation = 'lighter';
    for (const d of dust) {
      proj(d.x, d.y, d.z, o);
      const x = o.x / 2, y = o.y / 2; if (x < -2 || y < -2 || x > LW + 2 || y > LH + 2) continue;
      lc.globalAlpha = d.a * Math.min(1, 0.55 + o.s * 0.8); lc.fillStyle = d.col; lc.fillRect(Math.round(x), Math.round(y), d.s, d.s);
    }
    lc.globalCompositeOperation = 'source-over'; lc.globalAlpha = 1;
    // plane grid rings and the Z axis
    for (const rr of [250 * WS, 500 * WS, 750 * WS]) { lc.globalAlpha = 0.16; let prev = null; for (let k = 0; k <= 64; k++) { const a = k / 64 * 6.283; proj(Math.cos(a) * rr, Math.sin(a) * rr, 0, o); if (prev && k % 2) line(prev[0], prev[1], o.x / 2, o.y / 2, '#6a6fa8'); prev = [o.x / 2, o.y / 2]; } }
    if (viewT < 0.5) {
      lc.globalAlpha = 0.35 * (1 - viewT * 2); proj(0, 0, -520, o); proj(0, 0, 520, o2); line(o.x / 2, o.y / 2, o2.x / 2, o2.y / 2, '#8a8fd0');
      for (let z = -500; z <= 500; z += 50) { if (!z) continue; proj(0, 0, z, o); pxR(o.x / 2 - 1, o.y / 2, 3, 1, z > 0 ? '#9fd8ff' : '#ff5fa8'); }
    } else {
      // flat pillars for Zenith and Nadir
      for (const side of [1, -1]) {
        const colr = side > 0 ? '#9fd8ff' : '#ff5fa8';
        lc.globalAlpha = 0.3 * (viewT * 2 - 1); proj(side * PILX, 330, 0, o); proj(side * PILX, 330 - 500 * 1.45, 0, o2); line(o.x / 2, o.y / 2, o2.x / 2, o2.y / 2, colr);
        proj(side * PILX, 330 - 520 * 1.45 - 30, 0, o);
        lc.globalAlpha = 1;
      }
    }
    lc.globalAlpha = 1;
    // orbit rings with sector ticks (hidden in 3D while zoomed into a sector)
    if (!(viewT < 0.5 && focusSector() >= 0)) for (const k in ORBITS) {
      const O = ORBITS[k], on = A.has(k), hub = npos(TREE.nodes[k]);
      const fx = viewT > 0.5 ? 0.9 : 1, fy = viewT > 0.5 ? 0.55 : 1, rz = viewT > 0.5 ? 0 : O.z, cx0 = viewT > 0.5 ? hub[0] : 0, cy0 = viewT > 0.5 ? hub[1] : 0;
      lc.globalAlpha = on ? 0.6 : 0.25; let prev = null;
      for (let q = 0; q <= 48; q++) { const a = q / 48 * 6.283; proj(cx0 + Math.cos(a) * ORB_R * fx, cy0 + Math.sin(a) * ORB_R * fy, rz, o); if (prev) line(prev[0], prev[1], o.x / 2, o.y / 2, O.col); prev = [o.x / 2, o.y / 2]; }
      lc.globalAlpha = 0.9;
      SECTORS.forEach((S, i) => { const a = (-90 + i * 60) * Math.PI / 180; proj(cx0 + Math.cos(a) * (ORB_R + 14) * fx, cy0 + Math.sin(a) * (ORB_R + 14) * fy, rz, o); pxR(o.x / 2 - 1, o.y / 2 - 1, 2, 2, S.col); });
      lc.globalAlpha = 1;
    }
    const zr = cam.zoom / DEF().zoom, cT = clamp((1.7 - zr) / 0.6, 0, 1); cA += (cT - cA) * 0.2;
    const nodeDim = 1 - cA * 0.6;
    const cLabels = drawConstellations(A, o);
    // edges
    const pos = {}; for (const n of TREE.list) { const [x, y, z] = npos(n); proj(x, y, z, o); pos[n.id] = { x: o.x / 2, y: o.y / 2, s: o.s, d: o.d, wz: z, wx: x, wy: y }; }
    const cullR = cullRadius(), fs = focusSector(); for (const n of TREE.list) { const p = pos[n.id]; p.fade = nodeFade(n, p.wx, p.wy, p.wz, cullR, fs, A, n.id === sel || Pth.has(n.id)); p.vis = p.fade > 0.12; }
    visPos = pos;
    for (const [ai, bi] of TREE.edges) {
      const a = TREE.nodes[ai], b = TREE.nodes[bi], pa = pos[ai], pb = pos[bi];
      if (!pa.vis || !pb.vis) continue;
      if ((pa.x < -20 && pb.x < -20) || (pa.x > LW + 20 && pb.x > LW + 20) || (pa.y < -20 && pb.y < -20) || (pa.y > LH + 20 && pb.y > LH + 20)) continue;
      const both = A.has(ai) && A.has(bi);
      const onPath = (Pth.has(ai) || A.has(ai)) && (Pth.has(bi) || A.has(bi)) && (Pth.has(ai) || Pth.has(bi));
      const sc = b.col || a.col || (a.sector >= 0 ? SECTORS[a.sector] : SECTORS[Math.max(0, b.sector)]).col;
      lc.globalAlpha = (both ? 1 : onPath ? 0.95 : 0.45) * (both || onPath ? 1 : nodeDim);
      line(pa.x, pa.y, pb.x, pb.y, both ? sc : onPath ? '#ffb03a' : '#2c3160', both && (pa.s + pb.s) / 2 > 0.6 ? 2 : 1);
    }
    lc.globalAlpha = 1;
    // drop lines from off-plane nodes to the disk (Elite map style)
    for (const n of TREE.list) {
      const p = pos[n.id]; if (!p.vis || viewT > 0.5 || Math.abs(p.wz) < 10 || (n.sector === -2 && n.sat === undefined)) continue;
      proj(p.wx, p.wy, 0, o);
      lc.globalAlpha = 0.35; line(p.x, p.y, o.x / 2, o.y / 2, n.col || '#5a5f9a');
      lc.globalAlpha = 0.6; pxR(o.x / 2 - 1, o.y / 2, 3, 1, n.col || '#5a5f9a');
    }
    lc.globalAlpha = 1;
    // nodes, far to near
    const order = TREE.list.slice().sort((a, b) => pos[a.id].d - pos[b.id].d);
    for (const n of order) {
      const p = pos[n.id]; if (!p.vis || p.x < -10 || p.x > LW + 10 || p.y < -10 || p.y > LH + 10) continue;
      const col = profOn ? (PCAT[nodeCat(n)] || {}).col || '#6a6f9a' : n.col || (n.sector >= 0 ? SECTORS[n.sector].col : '#ffb03a');
      const on = A.has(n.id) || RS.has(n.id), can = allocatable(n), onP = Pth.has(n.id);
      const r = Math.max(1, Math.round(R[n.kind] * p.s / 2));
      lc.globalAlpha = (viewT < 0.5 ? clamp(1.25 - Math.hypot(p.wx - cam.tx, p.wy - cam.ty, p.wz - cam.tz) / 1400, 0.35, 1) : 1) * (on || onP ? 1 : nodeDim) * p.fade;
      const fill = on ? col : '#0b0d1c', edge = on ? '#ffffff' : onP ? '#ffb03a' : can ? (pulse > 0.5 ? '#ffb03a' : '#7a5418') : sh2(col);
      if (n.kind === 'small') { pxR(p.x - r, p.y - r, r * 2 + 1, r * 2 + 1, edge); if (r > 1) pxR(p.x - r + 1, p.y - r + 1, r * 2 - 1, r * 2 - 1, fill); }
      else if (n.kind === 'keystone') { pxDia(p.x, p.y, r + 1, edge); pxDia(p.x, p.y, r, fill); pxRing(p.x, p.y, r + 3, on ? col : sh2(col)); if (on) pxR(p.x - 1, p.y - 1, 3, 3, '#ffffff'); }
      else if (n.kind === 'mastery') { pxDia(p.x, p.y, r + 1, edge); pxDia(p.x, p.y, Math.max(0, r - 1), fill); pxRing(p.x, p.y, r + 3, on ? col : sh2(col)); }
      else if (n.kind === 'seal') { pxRing(p.x, p.y, r + 5, on ? '#ffffff' : sh2(col)); pxDia(p.x, p.y, r + 1, edge); pxDia(p.x, p.y, r, fill); pxRing(p.x, p.y, r + 2, on ? col : sh2(col)); pxR(p.x - 1, p.y - Math.max(2, r >> 1), 3, Math.max(4, r), on ? '#ffffff' : col); }
      else if (n.kind === 'start') { pxDia(p.x, p.y, r + 2, '#ffe9b0'); pxDia(p.x, p.y, r, '#ffb03a'); pxR(p.x - 1, p.y - 1, 3, 3, '#ffffff'); }
      else if (n.kind === 'orbit') { pxRing(p.x, p.y, r + 1, edge); pxRing(p.x, p.y, r, edge); pxDia(p.x, p.y, Math.max(1, r - 3), on ? col : '#151933'); }
      else { pxDia(p.x, p.y, r + 1, edge); pxDia(p.x, p.y, r, fill); if (n.kind === 'sat' || n.kind === 'notable') pxRing(p.x, p.y, r + 2, on ? col : sh2(col)); }
      lc.globalAlpha = 1;
      if (on && r >= 2) { lc.globalCompositeOperation = 'lighter'; lc.globalAlpha = 0.25; pxDia(p.x, p.y, r + 3, col); lc.globalAlpha = 1; lc.globalCompositeOperation = 'source-over'; }
    }
    // blit pixel buffer
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.imageSmoothingEnabled = false;
    c.drawImage(lb, 0, 0, LW * 2, LH * 2);
    // hi-res overlay: selection + labels
    if (sel && pos[sel]) { const p = pos[sel], r = R[TREE.nodes[sel].kind] * p.s + 7; c.beginPath(); c.arc(p.x * 2, p.y * 2, r, 0, 6.283); c.strokeStyle = '#ffffff'; c.lineWidth = 1.5; c.setLineDash([4, 4]); c.lineDashOffset = -frame / 3; c.stroke(); c.setLineDash([]); }
    { const hid = lastNode(); if (hid && pos[hid]) { const p = pos[hid], r = R[TREE.nodes[hid].kind] * p.s + 5 + (Math.sin(frame / 8) + 1) * 2; c.beginPath(); c.arc(p.x * 2, p.y * 2, r, 0, 6.283); c.strokeStyle = '#ffb03a'; c.globalAlpha = 0.85; c.lineWidth = 1.5; c.stroke();
      if (hereT > 0) { hereT--; const k = 1 - hereT / 90; c.beginPath(); c.arc(p.x * 2, p.y * 2, r + k * 60, 0, 6.283); c.globalAlpha = 1 - k; c.lineWidth = 2; c.stroke(); }
      c.globalAlpha = 1; } }
    const labels = [];
    for (const n of TREE.list) {
      const p = pos[n.id], rr = R[n.kind] * p.s;
      if (!p.vis || p.fade < 0.5) continue;
      if (n.kind === 'small' ? rr < 7.5 : rr < 3) continue;
      if (cA > 0.5 && sel !== n.id && n.kind !== 'start') continue;
      const on = A.has(n.id), pri = (sel === n.id ? 100 : 0) + (on ? 20 : 0) + ({ keystone: 50, seal: 55, mastery: 30, notable: 25, orbit: 35, sat: 22, start: 60, small: 0 }[n.kind]) + (Pth.has(n.id) ? 10 : 0) + p.d * 0.01;
      labels.push({ n, x: p.x * 2, y: p.y * 2 + rr + 5, pri, on });
    }
    labels.sort((a, b) => b.pri - a.pri);
    const placed = [];
    c.textAlign = 'center'; c.textBaseline = 'top';
    for (const L of labels) {
      const n = L.n, fs = n.kind === 'small' ? 10 : n.kind === 'keystone' || n.kind === 'seal' ? 12 : 11;
      c.font = `${fs}px Silkscreen, monospace`;
      const txt = n.name.toUpperCase(), w = c.measureText(txt).width + 6, h = fs + 4;
      const box = { x0: L.x - w / 2, x1: L.x + w / 2, y0: L.y - 2, y1: L.y + h };
      if (box.y0 < 52 || box.y1 > H || box.x1 < 0 || box.x0 > W) continue;
      if (placed.some(q => q.x0 < box.x1 && q.x1 > box.x0 && q.y0 < box.y1 && q.y1 > box.y0)) continue;
      placed.push(box);
      c.fillStyle = 'rgba(4,5,10,0.72)'; c.fillRect(box.x0, box.y0, w, h);
      c.fillStyle = L.on ? '#ffffff' : n.kind === 'keystone' || n.kind === 'seal' ? '#ffb03a' : n.col && (n.kind === 'orbit' || n.kind === 'sat') ? n.col : '#a9a7c4';
      c.fillText(txt, L.x, L.y);
    }
    c.font = '12px Silkscreen, monospace';
    for (const L of cLabels) {
      c.globalAlpha = cA;
      const w = c.measureText(L.txt).width + 8, box = { x0: L.x - w / 2, x1: L.x + w / 2, y0: L.y - 8, y1: L.y + 8 };
      if (box.y0 < 52 || box.y1 > H - 40 || box.x1 < 0 || box.x0 > W) continue;
      if (placed.some(q => q.x0 < box.x1 && q.x1 > box.x0 && q.y0 < box.y1 && q.y1 > box.y0)) continue;
      placed.push(box);
      c.globalAlpha = cA * (L.full ? 1 : L.on ? 0.9 : 0.6); c.fillStyle = L.on ? L.col : '#a9a7c4'; c.textBaseline = 'middle';
      c.fillText(L.txt, L.x, L.y); c.globalAlpha = 1; c.textBaseline = 'top';
    }
    c.globalAlpha = 1;
  }
  const sh2Cache = {};
  function sh2(col) { if (sh2Cache[col]) return sh2Cache[col]; const v = parseInt(col.slice(1), 16), r = (v >> 16 & 255) * 0.42, g = (v >> 8 & 255) * 0.42, b = (v & 255) * 0.5; return (sh2Cache[col] = `rgb(${r | 0},${g | 0},${b | 0})`); }
  function select(id) { const n = TREE.nodes[id]; if (!n) return; if (!cam) cam = DEF(); sel = id; path = treePathTo(id); const [x, y, z] = npos(n); cam.tx = x; cam.ty = y; cam.tz = z * 0.85; goal = null; refresh(); }
  // test hooks
  const _screen = id => { const n = TREE.nodes[id]; if (!n || !cam) return null; camPrep(); const [x, y, z] = npos(n), o = {}; proj(x, y, z, o); return { x: o.x, y: o.y }; };
  const _visCount = () => visPos ? Object.values(visPos).filter(p => p.vis).length : -1;
  const _dbg = () => ({ fs: focusSector(), zr: cam.zoom / DEF().zoom, tx: cam.tx, ty: cam.ty, tz: cam.tz, pil: TREE.list.filter(n => n.sector === -2 && visPos[n.id].vis).length });
  return { init, open, close, resize, draw, refresh, select, get isOpen() { return open_; }, _screen, _visCount, _dbg, _sel: () => sel };
})();

// ---------------- Main loop ----------------
(function boot() {
  const loaded = Save.loadLocal();
  if (loaded) PROF = loaded;
  const webReset = migrateWeb();
  if (webReset) { Save.save(); setTimeout(() => UI.toast('PASSIVE WEB REBUILT', 'Doctrines have arrived. All your points are refunded: pick a play style', '#ffb03a'), 900); }
  Render.init($('#cv'));
  Render.onCam = () => UI.zoomChanged && UI.zoomChanged();
  Tree.init();
  hydrateIcons();
  UI.wire();
  UI.renderHangar();
  UI.show('hangar');
  // returning players see what changed once per version; brand-new players skip it
  if (!PROF.runs) { PROF.seenVer = VERSION; }
  else if (PROF.seenVer !== VERSION) setTimeout(() => { if (UI.screen === 'hangar' && !UI.modalOpen && WHATS_NEW.items.length) UI.openNews(); }, 900);
  SFX.setVolumes(PROF.settings.sfx, PROF.settings.music);
  SFX.setSoundtrack(PROF.settings.soundtrack || 'ec'); SFX.music.setBaseBpm(PROF.settings.bpm || 72);
  Save.initRemote();
  // Home Screen copy: notice a newer release (Pages caches pages for ~10 min, and iOS keeps the app in memory)
  // and reload onto it from the main menu, never mid-run
  let updTo = null, updAt = 0;
  function checkUpdate() {
    if (!/github\.io$/.test(location.hostname) || !window.fetch) return;
    const now = Date.now(); if (now - updAt < 60000) return; updAt = now;
    fetch(location.pathname, { cache: 'reload' }).then(r => r.ok ? r.text() : '').then(t => {
      const m = t.match(/const VERSION = '([0-9.]+)'/);
      if (m && m[1] !== VERSION) updTo = m[1];
    }).catch(() => {});
  }
  checkUpdate();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkUpdate(); });
  setInterval(() => {
    if (!updTo || UI.screen !== 'hangar' || UI.modalOpen || Tree.isOpen) return;
    let tried = null; try { tried = sessionStorage.getItem('entropy.upd'); } catch (e) {}
    if (tried === updTo) { updTo = null; return; } // already reloaded for this one; don't loop
    try { sessionStorage.setItem('entropy.upd', updTo); } catch (e) {}
    UI.toast('UPDATING', 'Version ' + updTo, '#59f0b4', true);
    Save.save(); if (Save.flushNow) Save.flushNow();
    updTo = null; setTimeout(() => location.reload(), 900);
  }, 1000);
  // hangar backdrop
  const bg = $('#bgfx'), bc = bg.getContext('2d');
  let bt = 0;
  const stars = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), p: Math.random() * 6.28, c: ['#59f0b4', '#ffb03a', '#b86cff', '#6ae2ff', '#ff4d6a'][Math.floor(Math.random() * 5)] }));
  function drawBg(dt) {
    bt += dt;
    const r = bg.getBoundingClientRect();
    if (bg.width !== Math.round(r.width / 4) || bg.height !== Math.round(r.height / 4)) { bg.width = Math.max(1, Math.round(r.width / 4)); bg.height = Math.max(1, Math.round(r.height / 4)); }
    bc.fillStyle = 'rgba(7,8,15,0.35)'; bc.fillRect(0, 0, bg.width, bg.height);
    const cx = bg.width * 0.72, cy = bg.height * 0.5;
    for (let a = 0; a < 3; a++) for (let k = 0; k < 40; k++) {
      const rr = k * Math.min(bg.width, bg.height) / 70, an = bt * 0.4 + a * 2.09 + k * 0.18;
      bc.fillStyle = ['#b86cff', '#ff4d6a', '#ffb03a'][a] + '88';
      bc.fillRect(Math.round(cx + Math.cos(an) * rr), Math.round(cy + Math.sin(an) * rr), 1, 1);
    }
    for (const s of stars) { s.p += dt * 2; if (Math.sin(s.p) > 0.6) { bc.fillStyle = s.c; bc.fillRect(Math.floor(s.x * bg.width), Math.floor(s.y * bg.height), 1, 1); } }
  }
  let last = performance.now(), acc = 0;
  const STEP = 1 / 30;
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, Math.max(0, (ts - last) / 1000)); last = ts;
    if (UI.screen === 'game' && G) {
      if (G.checkpoint && !G.paused && !G.reloc && UI.modalOpen !== 'pause' && !document.hidden) G.cpT += dt;
      if (UI.slowmo > 0) UI.slowmo -= dt;
      const halted = G.over || G.paused || G.draft || (G.checkpoint && !G.enemies.length) || Tree.isOpen || UI.modalOpen;
      if (!halted) {
        acc += dt * G.speed * (UI.slowmo > 0 ? 0.3 : 1);
        let n = 0;
        while (acc >= STEP && n < 10) { simStep(STEP); acc -= STEP; n++; }
        if (n >= 10) acc = 0;
      }
      Render.draw(halted ? 0 : dt);
    } else { if (UI.screen === 'hangar') drawBg(dt); ART.idle(4); } // menus: pre-render unit art in the background
    if (Tree.isOpen) Tree.draw();
    UI.tick(dt);
  }
  setTimeout(() => UNITS.warmEnemies(), 1500);
  requestAnimationFrame(frame);
})();
