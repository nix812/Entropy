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
  scan: ['..#####..', '.#.....#.', '#...#...#', '#..#.#..#', '#.#.#.#.#', '#..#.##.#', '#...#..##', '.#.....##', '..#####.#'],
  archive: ['#########', '#########', '.........', '.#######.', '.#.....#.', '.#.###.#.', '.#.....#.', '.#######.', '.........'],
  help: ['..#####..', '.##...##.', '......##.', '.....##..', '....##...', '....##...', '.........', '....##...', '....##...'],
  gear: ['...#.#...', '.#######.', '.##...##.', '##.....##', '.#..#..#.', '##.....##', '.##...##.', '.#######.', '...#.#...'],
  overdrive: ['..#####..', '.#.....#.', '#..###..#', '#.#...#.#', '#.#.#.#.#', '#.#...#.#', '#..###..#', '.#.....#.', '..#####..'],
  music: ['...######', '...######', '...#....#', '...#....#', '...#....#', '.###..###', '####.####', '####.####', '.##...##.'],
  fit: ['###...###', '#.......#', '#.......#', '.........', '.........', '.........', '#.......#', '#.......#', '###...###'],  // v5.5 Music Studio transport
  play: ['.#.......', '.##......', '.###.....', '.####....', '.#####...', '.####....', '.###.....', '.##......', '.#.......'],
  prev: ['..........', '#....#...#', '#...##..##', '#..###.###', '#.########', '#..###.###', '#...##..##', '#....#...#', '..........'],
  repeat: ['.....#...', '.#######.', '#....#..#', '#.......#', '#.......#', '#.......#', '#..#....#', '.#######.', '...#.....'],
  heart: ['.........', '.##...##.', '####.####', '#########', '#########', '.#######.', '..#####..', '...###...', '....#....'],
  heartO: ['.........', '.##...##.', '#..#.#..#', '#...#...#', '#.......#', '.#.....#.', '..#...#..', '...#.#...', '....#....'],
  share: ['....#....', '...###...', '..#.#.#..', '....#....', '....#....', '#...#...#', '#.......#', '#.......#', '#########'],
  edit: ['......##.', '.....#..#', '....#..#.', '...#..#..', '..#..#...', '.#..#....', '#..#.....', '##.......', '###......'],
  dice: ['#########', '#.......#', '#.##.##.#', '#.##.##.#', '#.......#', '#.##.##.#', '#.##.##.#', '#.......#', '#########'],
};
function svgIcon(name, size) {
  const rows = ICONS[name]; if (!rows) return '';
  let r = '';
  rows.forEach((row, y) => { let x = 0; while (x < row.length) { if (row[x] === '#') { let w = 1; while (row[x + w] === '#') w++; r += `<rect x="${x}" y="${y}" width="${w}" height="1"/>`; x += w; } else x++; } });
  const w = Math.max(...rows.map(q => q.length));
  return `<svg class="svgi" viewBox="0 0 ${w} 9" ${size ? `style="width:${size}px;height:${size}px"` : ''} aria-hidden="true">${r}</svg>`;
}
// v4.8 pixel sliders: fill the track up to the thumb
function paintRange(el) { const lo = +el.min || 0, hi = +el.max || 1; el.style.setProperty('--p', ((+el.value - lo) / (hi - lo) * 100) + '%'); }
document.addEventListener('input', e => { if (e.target && e.target.type === 'range') paintRange(e.target); }, true);
function hydrateIcons(root) {
  for (const r of (root || document).querySelectorAll('input[type=range]')) paintRange(r);
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
    out.alloc = ['start'];
    out.tal = p.tal && typeof p.tal === 'object' ? Object.fromEntries(Object.entries(p.tal).filter(([k, v]) => TAL[k] && !TAL[k].cap && v > 0).map(([k, v]) => [k, Math.min(TAL[k].max, v | 0)])) : {};
    out.caps = Array.isArray(p.caps) ? p.caps.filter(c => TAL[c] && TAL[c].cap) : [];
    if (!Array.isArray(out.builds) || out.builds.length !== 5) out.builds = [null, null, null, null, null];
    // v5.1: a veteran has met the first eight enemies already; only the newcomers get an introduction card
    out.codex = Object.assign(defaultProfile().codex, out.codex || {});
    if (!out.seenSys && (out.bestWave || 0) >= 15) out.seenSys = { storm: 1, crate: 1, vet: 1 };
    if (!out.codex.enemies) { out.codex.enemies = {}; if ((out.bestWave || 0) >= 12) for (const k in ENEMIES) if (ENEMIES[k].from <= 12) out.codex.enemies[k] = 1; }
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
          tidyCaps();
          if (migrateWeb()) { PROF.updatedAt = Date.now(); UI.toast('TALENTS ARRIVE', 'The passive web is now seven Talent trees. Every point is refunded: open Talents to spend them', '#ffb03a'); queue(); }
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
    const nv = PROF.nova || 0, done = capsHeld().length, req = novaLevelReq(nv), ready = novaReady();
    $('#hNovaBox').hidden = !nv; $('#hNova').textContent = nv;
    const bn = $('#bNova'); bn.hidden = !nv && done < 1; bn.classList.toggle('ready', ready);
    $('#hNovaSub').textContent = ready ? 'Ready' : PROF.runSnap && done >= 2 && L.level >= req ? 'Finish your run' : `${Math.min(done, 2)}/2 Capstones · Lv ${req}`;
    const snap = PROF.runSnap;
    $('#bLaunch2').hidden = !snap;
    $('#bLaunch').firstChild.textContent = snap ? 'Resume' : 'Play';
    const dk = dailyKey(), dd = PROF.daily && PROF.daily.date === dk ? PROF.daily : null;
    $('#hPlaySub').textContent = snap ? (snap.rec ? `Daily Hunt · Wave ${snap.wave}` : `Wave ${snap.wave} · ${CHAOS_LEVELS[snap.chaos].name}`) : '';
    // v5.3 The Hunt: what is waiting for you, what you've won, and today's Daily Hunt, before you press Play
    const H = PROF.hunt || {}, N = PROF.nemesis, hh = $('#hHunt'), rows = [];
    if (N) rows.push(`<div class="hhr nem"><span class="lbl">Nemesis</span><b>${esc(N.name)}</b><small>${N.kind === 'boss' ? 'takes your next bounty' : 'leads your next Strain Assault'} · ended you on Wave ${N.lastW}</small></div>`);
    if (H.bounties || H.extracts || H.nemDown) rows.push(`<div class="hhr"><span class="lbl">Trophies</span><b>${H.bounties || 0} bount${H.bounties === 1 ? 'y' : 'ies'} · ${H.extracts || 0} extracted${H.nemDown ? ` · ${H.nemDown} Nemes${H.nemDown === 1 ? 'is' : 'es'} down` : ''}</b></div>`);
    rows.push(`<div class="hhr day"><span class="lbl">Today's Hunt</span><b>${dd && dd.ranked ? `Wave ${dd.ranked.wave}${dd.ranked.ext ? ' · extracted' : ''}` : 'Not played yet'}</b><button class="btn small" data-hact="daily">${dd && dd.ranked ? 'Ladder' : 'Hunt'}</button></div>`);
    hh.innerHTML = rows.join('');
  }

  // ---------- Setup ----------
  function openSetup() {
    const ls = PROF.lastSetup || { startWave: 1, chaos: 1 };
    setup.chaos = ls.chaos ?? 1; if (!chaosUnlocked(setup.chaos)) setup.chaos = 1;
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
    const credits = Math.round(320 + computeMods(null, null).startCredits + (sw > 1 ? 70 * (sw - 1) * (1 + 0.045 * (sw - 1)) : 0));
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
            <div class="chips">${CHAOS_LEVELS.map((c, i) => chaosUnlocked(i) ? `<button class="chip ${i === setup.chaos ? 'on' : ''} ${i === 3 ? 'hot' : ''}" data-act="ch" data-v="${i}">${c.name}</button>` : `<button class="chip locked" data-act="chLock" data-v="${i}">${c.name}<small>Extract on ${CHAOS_LEVELS[i - 1].name}</small></button>`).join('')}</div>
            <p class="note">Enemy HP ×${CH.hp} · Events ×${CH.ev} · Storms ×${CH.storm} · Elites ×${CH.elite}${CH.cr ? ` · Credits ×${CH.cr}` : ""} · <b class="amber">Score ×${CH.score}</b></p>
            <p class="note">${tipify('Evolution')}: ${esc(CH.evo ? CH.evo.desc : '')}</p>
            <p class="note">Sector ${R0.x1 - R0.x0}×${R0.y1 - R0.y0} → ${COLS}×${ROWS} · ${CH.lanes.length} wormholes${CH.lanes[0] <= 1 ? ', one at start' : ''}</p>
            ${PROF.nemesis ? `<p class="note nem"><b>Nemesis waiting: ${esc(PROF.nemesis.name)}.</b> ${PROF.nemesis.kind === 'boss' ? 'It takes your first bounty, mutated, for double the reward.' : 'The swarm starts already carrying it, and it leads your first Strain Assault, with a double bounty.'}</p>` : ''}
          </div>
          <div class="col">
            ${setupSectorHTML()}
            <div class="lbl">Map</div>
            <canvas id="mapPrev" width="320" height="150"></canvas>
            <div class="row"><button class="btn small" data-act="reroll">Reroll Map</button><span class="note">Each wormhole expands the sector.</span></div>
          </div>
        </div>
        <div class="foot"><button class="btn primary" data-act="launch">Start · Wave ${sw}</button></div>
      </div>`, 'setup');
    Render.preview_map($('#mapPrev'), setup.map, setup.frac);
  }
  // 5.8 sector contracts: three offers from the setup seed (a new map, new offers). A fresh profile gets the gentle default, unasked
  function setupSector() {
    if (freshProfile()) return SECTOR_START;
    if (setup.secSeed !== setup.seed) { setup.secSeed = setup.seed; setup.secOffers = sectorOffers(setup.seed); }
    if (!setup.secOffers.includes(setup.sector)) setup.sector = setup.secOffers[0];
    return setup.sector;
  }
  function sectorLine(S, tier) {
    const T = tier ? DOOR_TIERS[tier] : null;
    return `<span class="good">${tipify(S.up || '')}</span>${S.down ? ` · <span class="bad">${tipify(S.down)}</span>` : ''}${T ? ` · <span style="color:${T.col}">${esc(T.desc)}</span>` : ''}`;
  }
  function setupSectorHTML() {
    const cur = setupSector(); if (freshProfile()) return '';
    const S = SECTOR_BY[cur], P = sectorWantedName(cur);
    return `<div class="lbl">Zone</div>
      <div class="secs">${setup.secOffers.map(id => { const X = SECTOR_BY[id]; return `<button class="secb${id === cur ? ' on' : ''}" data-act="sector" data-v="${id}" style="--c:${X.col}"><b>${esc(X.name)}</b></button>`; }).join('')}</div>
      <p class="note secnote"><b style="color:${S.col}">${esc(S.pitch)}</b> ${sectorLine(S)}${P ? ` · Most Wanted: ${esc(P)}` : ''}</p>`;
  }
  // the sector's poster boss, when it can show up by the first bounty (Wave 20)
  function sectorWantedName(id) { const S = SECTOR_BY[id], B = S && BOSSES.find(b => b.id === S.boss), M = S && WANTED_MODS.find(m => m.id === S.mod); return B && M && bossFrom(B) <= 20 ? `${M.name} ${B.name}` : ''; }
  function modeChips() {
    return `<div class="chips"><button class="chip ${setup.mode === 'std' ? 'on' : ''}" data-act="mode" data-v="std">Standard</button><button class="chip ${setup.mode === 'daily' ? 'on' : ''}" data-act="mode" data-v="daily" style="--c:#b86cff">Daily Hunt</button></div>`;
  }
  function renderDaily() {
    const spec = dailySpec(dailyKey());
    setRows(CHAOS_LEVELS[spec.chaos].rows); setCols(fitCols());
    setup.daily = spec; setup.seed = spec.seed; setup.map = genMap(mulberry32(spec.seed));
    const d = PROF.daily && PROF.daily.date === spec.date ? PROF.daily : null, hb = huntBuildProf();
    let spent = 0; for (const k in hb.tal) if (TAL[k]) spent += hb.tal[k]; const capN = (hb.caps || []).filter(c => TAL[c]);
    const nem = Object.assign({}, spec.nemesis); nem.name = nemesisName(nem);
    const runs = d && d.runs ? d.runs.slice(0, 5) : [];
    if (d && d.rec) prepHuntCode();
    modal(`
      <div class="card setup">
        <div class="ch"><h2>New Run</h2>${modeChips()}<button class="x" data-act="close">✕</button></div>
        <div class="setup-grid">
          <div class="col">
            <div class="lbl">Daily Hunt · ${spec.date}</div>
            <p class="note">Same map, bounty and Nemesis for everyone. Every tower open, ${HUNT.pts} talent points each: it comes down to play. Your first run today is ranked.</p>
            <div class="hbuild"><span>Hunt build <b>${spent}/${HUNT.pts}</b> points${capN.length ? ' · ' + capN.map(c => esc(TAL[c].name)).join(', ') : ''}</span><button class="btn small" data-act="huntBuild">${spent ? 'Edit' : 'Build it'}</button></div>
            <p class="note nem"><b>Today's Nemesis: ${esc(nem.name)}.</b> It leads the first Strain Assault.</p>
            ${spec.sector && SECTOR_BY[spec.sector] ? `<p class="note secnote">Today's zone: <b style="color:${SECTOR_BY[spec.sector].col}">${esc(SECTOR_BY[spec.sector].name)}</b>. ${sectorLine(SECTOR_BY[spec.sector])}</p>` : ''}
            <div class="anlist">${spec.anoms.map(id => { const A = ANOMALIES.find(a => a.id === id); return `<div><b>${esc(A.name)}</b><span class="good">${tipify(A.up)}</span><span class="bad">${tipify(A.down)}</span></div>`; }).join('')}</div>
          </div>
          <div class="col">
            <div class="lbl">Map</div>
            <canvas id="mapPrev" width="320" height="150"></canvas>
            <div class="lbl">Today's ladder <em class="dim">(this device; online at launch)</em></div>
            ${runs.length ? `<div class="ladder">${runs.map((r, i) => `<div class="${d.ranked && r.ts === d.ranked.ts ? 'ranked' : ''}"><em>#${i + 1}</em><b>Wave ${r.wave}${r.ext ? ' · extracted' : ''}</b><span>${fmt(r.score)}${d.ranked && r.ts === d.ranked.ts ? ' · ranked' : ''}</span></div>`).join('')}</div>` : '<p class="note">No runs yet today.</p>'}
            <div class="row">${d && d.rec ? '<button class="btn small" data-act="huntWatch">Watch ranked run</button><button class="btn small" data-act="huntCode">Copy hunt code</button>' : ''}<button class="btn small" data-act="huntPaste">Watch a code</button></div>
          </div>
        </div>
        <div class="foot"><button class="btn primary" data-act="launchDaily">${d && d.ranked ? 'Practice run' : 'Start ranked run'}</button></div>
      </div>`, 'setup');
    Render.preview_map($('#mapPrev'), setup.map);
  }
  function launch(snap) {
    closeModal();
    show('game');
    Render.reset();
    requestAnimationFrame(() => { Render.resize(); });
    feedLines.length = 0; renderFeed();
    if (snap && snap.rec) { const sv = PROF.runSnap; replayRun(snap.rec, { quiet: true, until: snap.rec.end }); PROF.runSnap = sv; G.resumedHunt = { tick: G.tick, h: runHash(), n: G.inputs.length, w: G.wave }; }
    else if (snap) resumeRun(snap);
    else if (setup.mode === 'daily') { const sp = setup.daily; newRun({ seed: sp.seed, chaos: sp.chaos, startWave: 1, daily: sp, cols: COLS, huntBuild: JSON.parse(JSON.stringify(huntBuildProf())), nemesis: sp.nemesis, sector: sp.sector || null }); }
    else {
      PROF.lastSetup = { startWave: setup.startWave, chaos: setup.chaos };
      newRun({ seed: setup.seed, chaos: setup.chaos, startWave: setup.startWave, cols: COLS, nemesis: PROF.nemesis || null, sector: setupSector() });
    }
    Render.resetCam(); updateZoomBtn();
    if (!PROF.zoomHint) { PROF.zoomHint = 1; setTimeout(() => toast('BIGGER MAPS', 'Pinch or double-tap to zoom. Drag to pan.', '#6ae2ff', 1), 1200); }
    G.unlocks = []; G.bestAtStart = PROF.bestWave; G.fresh = freshProfile();
    if (!snap && G.preAdapted) { const pa = G.preAdapted; setTimeout(() => { if (G && screen === 'game') toast('SWARM PRE-ADAPTED', `${pa.join(' and ')} already in its DNA. Plan your counters`, '#ff4d6a', 1); }, 1600); }
    hudFull = PROF.settings.hud === 'full';
    Render.full = hudFull; Render.nums = PROF.settings.dmgNums; Render.shakeOn = PROF.settings.shake; Render.glow = PROF.settings.glow !== false; Render.sharp = PROF.settings.sharp !== false;
    document.body.classList.toggle('hudfull', hudFull);
    closePanel();
    buildAbilityBar();
    updateHud(true);
    Save.save();
    try { navigator.wakeLock && navigator.wakeLock.request('screen').catch(() => {}); } catch (e) {}
    // v5.3: no wall of rules on the first run. Glowing tiles show where to build; How to Play waits in the pause menu
    if (!PROF.seenHelp) { PROF.seenHelp = true; setTimeout(() => toast('WELCOME', 'Enemies walk the road to your core. Tap a glowing tile beside it to build a tower. How to Play is in the pause menu', '#59f0b4', true, 'alert'), 900); }
    G.wantedTold = !!snap || briefMode() === 'off';
    G.hints = !snap && (PROF.bestWave || 0) < 10 && G.wave <= 1 ? buildHints() : null; Render.hints = G.hints;
  }
  // v5.3 first run: the three spots that cover the most road near the start of the main lane
  function buildHints() {
    const R = G.region, L = G.map.lanes[0], road = L.tiles.slice(0, Math.ceil(L.tiles.length * 0.7)), out = [];
    const score = (x, y) => road.reduce((a, p) => a + (Math.hypot(p.x - x, p.y - y) <= 2.6 ? 1 : 0), 0);
    const cands = []; for (let y = R.y0; y < R.y1; y++) for (let x = R.x0; x < R.x1; x++) if (canBuildAt(x, y)) cands.push({ x, y, s: score(x, y) });
    cands.sort((a, b) => b.s - a.s);
    for (const c of cands) { if (out.length >= 3) break; if (out.every(o => Math.abs(o.x - c.x) + Math.abs(o.y - c.y) >= 4)) out.push(c); }
    return out;
  }
  // v5.3 one-time intro cards: each system says what it is the first time it shows up, in two lines
  function introCard(key, title, body) {
    const S = PROF.seenSys || (PROF.seenSys = {}); if (S[key]) return false;
    if (modalOpen || Tree.isOpen || (G && G.draft)) return false;
    S[key] = 1; Save.save();
    if (briefMode() !== 'pause') { toast(title.toUpperCase(), body, '#6ae2ff', true, 'alert'); return true; }
    closePanel(); G.paused = true; G.briefing = true;
    modal(`<div class="card narrow brief intro"><div class="bi"><em>New</em><h3>${esc(title)}</h3><p class="desc">${tipify(body)}</p></div>
      <div class="foot"><span class="note">Change this in Settings · Briefings</span><button class="btn primary" data-act="brief">Got it</button></div></div>`, 'brief');
    return true;
  }
  let nudgeW = -99;
  function onboardingTick() {
    if (!G || G.over || screen !== 'game' || modalOpen) return;
    if (G.hints && (G.towers.length || G.wave >= 3)) { G.hints = null; Render.hints = null; }
    if (G.wanted && !G.wantedTold && G.time > 2.6 && ((PROF.bestWave || 0) >= 15 || G.wave >= G.wanted.w - 12)) { G.wantedTold = 1; wantedPoster(briefMode() === 'pause'); return; }
    if (G.storms.length && introCard('storm', 'Storms', 'Storms drift across the map and boost one element: towers of that element inside fight harder (they get an outline). Tap the storm chip to see exactly what it does.')) return;
    if (G.caches.some(c => c.kind !== 'gold' && c.kind !== 'cursed') && introCard('crate', 'Salvage', 'Drop ships leave crates on the map. Tap one to claim it before it decays. A tower right next to a crate collects it for you.')) return;
    if (G.towers.some(t => t.pending > 0) && introCard('vet', 'Veterans', 'Towers that fight earn ranks. Tap the "veterans ready" chip at the top to pick each one a mutation.')) return;
    if (G.charges.stasis > 0 && G.abilOn && G.abilOn.stasis && introCard('abil', 'Abilities', 'The buttons on the left are abilities. Each recharges on its own timer (the bar fills); crates and bosses give extra charges that stack.')) return;
    // credits piling up: say so once in a while, with what to do about it
    if (G.spawningDone && G.wave >= 6 && G.wave - nudgeW >= 8 && G.towers.length) {
      const cheap = Math.min(...G.towers.map(t => upgradeCost(t))), lim = Math.max(900, cheap * 4, 250 * G.wave);
      if (G.credits > lim) { nudgeW = G.wave; toast('CREDITS PILING UP', `${fmt(G.credits)} credits banked. Spend them: the arrow marks your best upgrade, or build, expand the reactor, or reinforce the core's Hull${G.wave >= 28 ? '. Leeches steal from big banks' : ''}`, '#ffb03a', false, 'alert'); }
    }
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
        <p class="note">Bring it in and the run is a win: extract and bank it, or push on for a bigger score and the next bounty.</p>
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
    const r = window.act('od');
    if (r === 'empty') { SFX.play('deny'); toast('OVERDRIVE', 'Nothing to clear yet. Save it for a crowd', '#ff4d6a'); }
    else if (r !== 'ok') SFX.play('deny');
    else { closePanel(); toast('OVERDRIVE', `${G.stats.odKills} enemies erased`, '#59f0b4'); }
    updateHud();
  }
  const marketShut = () => !!(G && G.fresh && G.wave < 10);
  function buildAbilityBar() {
    $('#abils').innerHTML = `<button class="rb od" id="bOD" aria-label="Overdrive">${svgIcon('overdrive')}<span>Overdrive</span></button>` +
      ABIL_ORDER.slice().reverse().map(k => `<button class="rb abil" data-abil="${k}" aria-label="${esc(ABILITIES[k].name)}">${svgIcon(k)}<span>${esc(ABILITIES[k].short)}</span><em class="cnt"></em><i class="cdf"></i></button>`).join('');
  }
  function updateHud(force) {
    if (!G) return;
    const c = G.core;
    $('#hpfill').style.width = pct(Math.max(0, c.hp / c.max));
    $('#shfill').style.width = pct(c.smax ? c.shield / c.smax : 0);
    $('#hptxt').textContent = `${Math.max(0, Math.ceil(c.hp))}${c.shield >= 1 ? '+' + Math.floor(c.shield) : ''}`;
    $('#hpbar').classList.toggle('low', c.hp / c.max < 0.3);
    { const lm = $('#leakmark'), P = Math.min(1, G.breachP || 0); if (lm) { lm.style.width = pct(P); lm.classList.toggle('hot', P >= 0.5); } } // v5.4: last wave's leaks against shield + hull
    $('#cr').textContent = fmt(G.credits);
    $("#wave").textContent = G.wave || "—";
    const cpWait = G.spawningDone && cpPending();
    $('#nextw').textContent = G.checkpoint ? 'Checkpoint' : cpWait ? `${G.enemies.length} left · Checkpoint next` : G.spawningDone ? `next in ${Math.max(0, Math.ceil(G.next))}s` : `${G.queue.length + G.enemies.length} left`;
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
    $('#bCash').classList.toggle('on', !!(panel && panel.kind === 'cash')); $('#bCash').classList.toggle('nomkt', marketShut());
    const sp = $('#bSpeed'); sp.querySelector('b').textContent = G.speed + '×'; sp.classList.toggle('fast', G.speed > 1);
    { const ob = $('#bOD'); if (ob) { const ready = odReady(), lbl = G.odUsed ? 'Used' : ready ? (odArm ? 'Again!' : 'Overdrive') : 'W' + OD_WAVE;
      ob.classList.toggle('ready', ready && !odArm); ob.classList.toggle('arm', ready && odArm); ob.classList.toggle('dim', !ready); ob.classList.toggle('ghost', !!G.fresh && !ready && !G.odUsed);
      const sp = ob.querySelector('span'); if (sp.textContent !== lbl) sp.textContent = lbl; } }
    // v5.1: every ability keeps its place on the rail. Empty ones dim and fill as they recharge; offline ones show their wave
    for (const k of ABIL_ORDER) {
      const n = G.charges[k] || 0, btn = document.querySelector(`[data-abil="${k}"]`);
      if (!btn) continue;
      const on = abilOnline(k), slots = abilSlots(), cnt = btn.querySelector('.cnt'), lab = btn.querySelector('span');
      const ct = on && (n > 1 || n > slots) ? String(n) : '';
      if (cnt.textContent !== ct) cnt.textContent = ct;
      cnt.classList.toggle('extra', n > slots);
      // v5.1.1: a running ability counts down on its button (label → seconds left, a bar drains along the top)
      const left = on ? abilLeft(k) : 0, mxl = left > 0 ? Math.max(left, (G.abilMax && G.abilMax[k]) || left) : 1;
      const lt = !on ? 'W' + ABILITIES[k].from : left > 0 ? `${left < 10 ? left.toFixed(1) : Math.ceil(left)}s` : ABILITIES[k].short;
      if (lab.textContent !== lt) lab.textContent = lt;
      btn.classList.toggle('live', left > 0);
      let db = btn.querySelector('.dur'); if (!db) { db = document.createElement('i'); db.className = 'dur'; btn.appendChild(db); }
      db.style.width = left > 0 ? pct(clamp(left / mxl, 0, 1)) : '0%';
      btn.classList.toggle('locked', !on); btn.classList.toggle('empty', on && n <= 0); btn.classList.toggle('ghost', !!G.fresh && !on);
      const mx = on ? abilCdMax(k) : 1, cd = G.abilCd ? G.abilCd[k] : 0, filling = on && n < slots && cd > 0;
      btn.querySelector('.cdf').style.width = filling ? pct(clamp(1 - cd / mx, 0, 1)) : '0%';
      btn.classList.toggle('aim', G.aimAbility === k);
      // v5.1.3: Scan lights up while cloaked enemies are on the field and it has a charge
      if (k === 'scan') { const hid = on && n > 0 && !(G.scanT > 0) && G.enemies.some(e => !e.dead && e.cloaked && !(e.revealed > 0)); btn.classList.toggle('want', hid);
        if (hid && (G.scanHintW || 0) + 6 <= G.wave) { G.scanHintW = G.wave; toast('CLOAKED ENEMIES', 'Your towers can\'t see them. Scan reveals them and marks them for +15% damage', '#7dffb0', false, 'alert'); } }
    }
    const free = huntRun() ? 0 : pointsFree(); // a Hunt run's build is locked: no badge
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
      for (const E of P.list) chips.push(`<span class="evchip next ${E.good ? 'good' : 'bad'}">${esc(E.name)}</span>`);
    }
    // v5.2 threat board: one chip says what is coming and what the swarm is doing (next wave, new and headline enemies, DNA, Strain Assault).
    // Tap it for the full board. Replaces the separate Next / headline / gene / DNA chips and the assault banner
    { const th = threatChip(); if (th) chips.push(th); }
    if (G.wanted && G.wantedTold && !G.wanted.done) chips.push(G.hk // 5.8: the bounty wave and the Bounty Purse, kept short so it fits beside the threat chip on a phone
      ? `<span class="evchip wanted${G.wanted.nemesis ? ' nem' : ''}" data-wanted="1" title="Bounty on Wave ${G.wanted.w}. Bounty Purse: Extract after a bounty to bank all of it; if your core falls you keep ${Math.round(PURSE.death * 100)}%">${G.wanted.nemesis ? 'Nemesis ' : ''}W${G.wanted.w} · <i class="pz">${fmt(G.purse)} XP</i></span>`
      : `<span class="evchip wanted${G.wanted.nemesis ? ' nem' : ''}" data-wanted="1">${G.wanted.nemesis ? 'Nemesis' : 'Bounty'} · W${G.wanted.w}${G.pushes ? ' · ×' + huntMult().toFixed(2) : ''}</span>`);
    { const asb = $('#asbar'); if (asb && !asb.hidden) { asb.hidden = true; document.body.classList.remove('asbar'); } }
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
    { const rdy = G.towers.filter(t => t.pending > 0).length; if (rdy) chips.unshift(`<span class="evchip warn ready" data-ready="1" style="--c:#ffe14d">${rdy} veteran${rdy > 1 ? 's' : ''} ready</span>`); }
    if (G.flux) chips.push(`<span class="evchip storm" style="--c:${EL[G.flux.el].col}">${EL[G.flux.el].name} ×2</span>`);
    for (const s of G.storms) { const I = stormInfo(s); chips.push(`<span class="evchip storm tap${performance.now() < stormPulse ? ' pulse' : ''}" data-storm="${s.id}" style="--c:${s.mael ? '#ff4d6a' : STORMS[s.types[0]].col}">${esc(stormName(s))}${I.n ? ` · boosts ${I.boosted} of ${I.n}` : ''}</span>`); }
    G.laneWarn = null; for (const L of G.map.lanes) if (L.openWave) { const d = L.openWave - G.wave; if (d >= 1 && (!G.laneWarn || d < G.laneWarn)) G.laneWarn = d; }
    if (G.laneWarn) chips.unshift(`<span class="evchip warn ${G.laneWarn === 1 ? 'bad' : 'storm'}" style="--c:#d6a6ff">${G.laneWarn === 1 ? 'Wormhole opens next wave' : 'Wormhole opens in ' + G.laneWarn + ' waves'}</span>`);
    if (G.overclockT > 0) chips.push('<span class="evchip good">Frenzy</span>');
    if (G.stasisT > 0) chips.push('<span class="evchip good">Stasis</span>');
    // order by what you need to act on first; anything that doesn't fit goes behind a "+N" chip (the Field Report)
    const prio = h => /evchip warn/.test(h) ? 0 : /next bad">Boss/.test(h) ? 1 : /data-threat/.test(h) ? 2 : /data-wanted/.test(h) ? 3 : /evchip (bad|good)"/.test(h) ? 5 : /storm/.test(h) ? 6 : /next (bad|good)/.test(h) ? 7 : 8;
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
  // ---------- v5.2 Threat board ----------
  const geneTxt = (g, el) => GENES[g].name + (g === 'ward' && el ? ' ' + EL[el].name : '');
  function threatChip() {
    const A = G.assault, pulse = performance.now() < dnaPulse ? ' pulse' : '';
    if (A && A.state === 'live') { const left = A.n - A.killed - A.leaked, lim = assaultLimit(A);
      return `<span class="evchip threat hot live${A.leaked > lim ? ' lost' : ''}" data-threat="1"><b>Assault</b> ${left} left · leaks ${A.leaked}/${lim}</span>`; }
    const parts = [];
    let hot = false;
    if (A && A.state === 'warn') { hot = true; parts.push(`<b>Assault W${A.w}</b>`, A.genes.map(g => `<i style="color:${GENES[g].col}">${esc(geneTxt(g, A.el))}</i>`).join(' ')); }
    if (G.spawningDone && G.prep) {
      const P = G.prep;
      if (!hot) parts.push(`<b>W${P.w}</b> ${P.total} enemies${P.fly ? ' · ' + P.fly + ' air' : ''}${P.elites ? ' · ' + P.elites + ' elite' : ''}`);
      for (const k of P.fresh || []) parts.push(`<i class="new">New ${esc(ENEMIES[k].name)}</i>`);
      const hd = (P.heads || []).filter(k => !(P.fresh || []).includes(k))[0]; if (hd && !hot) parts.push(`${esc(ENEMIES[hd].name)} ×${P.counts[hd]}`);
      if (!hot) { const top = Object.entries(P.genes || {}).filter(([g, v]) => v >= 0.2).sort((a, b) => b[1] - a[1])[0]; if (top) parts.push(`<i style="color:${GENES[top[0]].col}">${GENES[top[0]].name} ${Math.round(top[1] * 100)}%</i>`); }
    } else if (!hot && geneCap(G.wave) > 0) {
      const gs = Object.entries(geneShares()).filter(([g, v]) => v >= 0.15).sort((a, b) => b[1] - a[1]).slice(0, 2);
      parts.push('<b>Swarm</b>', gs.length ? gs.map(([g, v]) => `<i style="color:${GENES[g].col}">${GENES[g].name} ${Math.round(v * 100)}%</i>`).join(' ') : 'stable');
    }
    if (!parts.length) return '';
    return `<span class="evchip threat${hot ? ' hot' : ''}${pulse}" data-threat="1">${parts.join(' · ').replace('</b> · ', '</b> ')}</span>`;
  }
  function openThreat() {
    if (!G) return;
    if (!G.over) G.paused = true;
    const P = G.spawningDone ? G.prep : null, A = G.assault, cap = geneCap(G.wave);
    const sec = [];
    if (P) {
      const kinds = Object.entries(P.counts).sort((a, b) => b[1] - a[1]);
      sec.push(`<div class="lbl">Next · Wave ${P.w} · ${P.total} enemies${P.fly ? ' · ' + P.fly + ' flying' : ''}${P.elites ? ' · ' + P.elites + ' elite' : ''}${P.boss ? ' · Boss ' + (P.boss.odd ? '???' : esc(P.boss.name)) : ''}</div>
        <div class="thlist">${kinds.map(([k, n]) => { const D = ENEMIES[k], head = (P.heads || []).includes(k), nw = (P.fresh || []).includes(k);
          return `<div class="threv${head || nw ? ' head' : ''}"><canvas width="36" height="36" data-eico="${k}"></canvas><b>${esc(D.name)} ×${n}${nw ? ' <i class="new">New</i>' : head ? ' <i>Headline</i>' : ''}</b><span>${tipify(D.desc)}. <u>Beat it: ${tipify(D.beat)}</u></span></div>`; }).join('')}</div>`);
      if (P.list.length) sec.push(`<p class="note">${P.list.map(E => `<b class="${E.good ? 'good' : 'bad'}">${esc(E.name)}</b>: ${esc(E.desc || '')}`).join(' · ')}</p>`);
    } else sec.push(`<div class="lbl">Wave ${G.wave} in progress · ${G.queue.length + G.enemies.length} left</div>`);
    if (A && A.state !== 'done') {
      const live = A.state === 'live', lim = live ? assaultLimit(A) : null;
      sec.push(`<div class="lbl bad">Strain Assault · Wave ${A.w}${live ? ' · in progress' : ''}</div><h3 class="asname">${esc(A.name)}</h3>
        <div class="evlist">${A.genes.map(g => { const D = GENES[g]; return `<div class="evrow"><b style="color:${D.col}">${esc(geneTxt(g, A.el))}</b><div></div><em></em><span>${esc(g === 'ward' && A.el ? `Resists ${EL[A.el].name} by 50%` : D.desc)} · <u>Counter: ${esc(g === 'ward' && A.el ? `anything but ${EL[A.el].name}` : D.counter)}</u></span></div>`; }).join('')}</div>
        ${A.why && A.why.length ? `<ul class="aswhy">${A.why.map(x => `<li>${esc(x[0].toUpperCase() + x.slice(1))}</li>`).join('')}</ul>` : ''}
        <p class="note hl">${live ? `${A.n - A.killed - A.leaked} of ${A.n} left · ${A.leaked} leaked of ${lim} allowed. Hold it and it breaks: +1 power and a bounty.` : tipify(`Selling is free until Wave ${A.w} starts. Swap towers for the counters above. Let few enough through and the strain breaks: +1 power and a bounty.`)}</p>`);
    }
    if (cap > 0) {
      const R = readDefence(Math.max(G.wave, 1)).slice(0, 2);
      sec.push(`<div class="lbl">Swarm DNA · up to ${cap} gene${cap === 1 ? '' : 's'} per enemy${G.assaultNext && !(A && A.state !== 'done') ? ` · next Strain Assault ~Wave ${G.assaultNext}` : ''}</div>
        ${R.length ? `<ul class="aswhy">${R.map(x => `<li><b style="color:${GENES[x.g].col};font-weight:400">${GENES[x.g].name}${x.el ? ' · ' + EL[x.el].name : ''}</b>: ${esc(x.why)}</li>`).join('')}</ul>` : ''}
        <div class="evlist">${evoRowsHTML()}</div>`);
    } else sec.push(`<p class="note">${tipify(`The swarm starts to evolve at Wave ${evoCfg().start}: whatever your defence handles worst spreads through it.`)}</p>`);
    { const S = SECTOR_BY[G.sector], tw = Object.keys(G.twists || {}).map(id => { const X = TWISTS.find(t => t.id === id); return X ? X.name + (G.twists[id] > 1 ? ' ×' + G.twists[id] : '') : ''; }).filter(Boolean);
      if (S) sec.unshift(`<p class="note secnote">Zone: <b style="color:${S.col}">${esc(S.name)}</b>${G.tier ? ` <b style="color:${DOOR_TIERS[G.tier].col}">${esc(DOOR_TIERS[G.tier].name)}</b>` : ''}. ${sectorLine(S, G.tier)}${tw.length ? ` · <span class="bad">Escalations: ${esc(tw.join(', '))}</span>` : ''}</p>`); }
    modal(`<div class="card evo threat"><div class="ch"><h2>Threat Board</h2><span class="note">Wave ${G.wave || 0} · ${esc(G.CH.name)}</span><button class="x" data-act="close2" aria-label="Close">✕</button></div>
      ${sec.join('')}
      <div class="foot">${G.wanted && !G.wanted.done ? '<button class="btn" data-act="wantR">Most Wanted</button>' : ''}<button class="btn primary" data-act="close2">Back</button></div></div>`, 'evo');
    for (const cv of document.querySelectorAll('#modal canvas[data-eico]')) Render.enemyIcon(cv.dataset.eico, cv);
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
      ${noteLog.length ? `<div class="lbl">Recent notices</div><div class="nlog">${noteLog.slice().reverse().map(n => `<div style="--c:${n.col || '#c9c6bc'}"><b>${esc(n.title)}</b><span>${esc(n.body || '')}</span><i>W${n.w}</i></div>`).join('')}</div>` : ''}
      <div class="foot"><button class="btn" data-act="evoR">Threat Board</button>${G.wanted && !G.wanted.done ? '<button class="btn" data-act="wantR">Most Wanted</button>' : ''}<button class="btn primary" data-act="resume">Continue</button></div></div>`);
  }
  function renderDps() {
    const list = G.towers.filter(t => t.s.kind !== 'support' && t.s.kind !== 'eco').sort((a, b) => b.dps - a.dps).slice(0, 6);
    const max = Math.max(1, ...list.map(t => t.dps), G.core.dps || 0);
    const total = G.towers.reduce((a, t) => a + t.dps, 0);
    $('#dps').innerHTML = `<div class="dh">DPS <b>${fmt(total)}</b></div>` + list.map(t => `<div class="drow"><span>${esc(TOWERS[t.type].name)} <em style="color:${lvTier(towerLevel(t)).col};font-style:normal">${towerLevel(t)}</em></span><i style="width:${Math.round(t.dps / max * 100)}%;background:${EL[t.s.el].col}"></i><b>${fmt(t.dps)}</b></div>`).join('');
  }
  const toastHeld = [], toastSeen = {};
  // v4.0 notifications, three channels so the centre of the screen stays clear:
  //  ALERT: rare cards for things you should react to (a strain assault, a wormhole, pirates, the worm eating a tower).
  //         One at a time, wrapped text, tap to dismiss.
  //  TIP:   instant feedback to something you just tapped (not enough power, reactor expanded). Replaces itself, never queues.
  //  FEED:  everything else (combos, salvage, boons, veterans, boss phases) goes to a small fading list in the corner.
  const ALERT_RE = /^(BOSS HALFWAY|CREDITS PILING UP|NEW ENEMY|CAPSTONE REFUNDED|[A-Z ]+ ONLINE$|BREACH WARNING|STRAIN|SWARM PRE-ADAPTED|WORMHOLE|PIRATES|CAPTAIN|LOOT STOLEN|THE WORM HUNTS|DIGESTED|MAELSTROM|CHECKPOINT|OVERDRIVE ONLINE|TALENTS ARRIVE|UPDATING|GALAXY REBORN|CONSTELLATION|LEVEL UP|NODE BEACON|RED ALERT|MOST WANTED|BOUNTY)/;
  const TIP_RE = /^(NOT ENOUGH|NO ROUTE|RELOCATE|OVERDRIVE|OVERCHARGED|SPARE POWER|POWER$|GRID FULL|REACTOR|CORE RELOCATED|CASHED IN|LOG |INVALID|FULL SCREEN|CAN'T|ORBITAL|BIGGER MAPS|ENTROPY$|SPEED BONUS|BOON|ANOMALY|STABILIZED|SAVE |PROFILE|NOTHING|REFIT)/;
  const KEY_RE = /^(BOSS HALFWAY|NEW ENEMY|BREACH WARNING|RED ALERT|WORMHOLE|STRAIN|MAELSTROM|CHECKPOINT|PIRATES|LOOT STOLEN|THE WORM HUNTS|DIGESTED)/;
  // v5.1.2 notices in a game go to one slim ticker under the top bar, never over the field. URGENT ones (the run is at stake)
  // flash the screen edge and buzz; everything is kept in noteLog, read back from the ticker or the +N chip (Field Report)
  const URGENT_RE = /^(RED ALERT|BOSS HALFWAY|BREACH WARNING)/;
  const HOMED_RE = /^(STRAIN ASSAULT|MAELSTROM|SWARM EVOLVES|WORMHOLE DETECTED)/;
  const noteLog = []; let stormPulse = 0;
  function noteKeep(title, body, col) { noteLog.push({ title, body, col, w: G ? G.wave : 0 }); if (noteLog.length > 30) noteLog.shift(); }
  const toastNQ = []; let toastBusy = false, toastT = null, tipT = null, dnaPulse = 0;
  function toastKind(title) { return ALERT_RE.test(title) ? 'alert' : TIP_RE.test(title) ? 'tip' : 'feed'; }
  function toast(title, body, col, force, as) {
    const key = title + '|' + body, now = performance.now();
    if (toastSeen[key] !== undefined && now - toastSeen[key] < 4000) return;
    toastSeen[key] = now;
    let kind = as || (screen !== 'game' ? (TIP_RE.test(title) ? 'tip' : 'alert') : toastKind(title));
    // Settings > Notifications: Key keeps only the cards you must react to; Off keeps none (tips answering your own taps stay)
    const nm = PROF.settings.notes || 'all';
    if (screen === 'game' && !force && kind === 'alert' && (nm === 'off' || (nm === 'key' && !KEY_RE.test(title)))) { feed(title, body, col, true); return; }
    if (/^SWARM EVOLVES/.test(title)) dnaPulse = now + 9000;
    if (/^MAELSTROM|^STORM/.test(title)) stormPulse = now + 6000;
    // v5.1.2: news that already has a home on screen (the assault strip, the DNA and storm chips) doesn't also get a notice
    if (screen === 'game' && kind === 'alert' && HOMED_RE.test(title)) kind = 'feed';
    if (kind === 'feed') { feed(title, body, col); return; }
    if (kind === 'tip') { flashTip(title, body, col); return; }
    if (!force && screen === 'game' && (modalOpen || Tree.isOpen)) { toastHeld.push([title, body, col]); if (toastHeld.length > 3) toastHeld.shift(); return; }
    if (toastNQ.some(t => t.title === title)) return;
    // urgent news jumps the queue and cuts in
    if (screen === 'game' && URGENT_RE.test(title)) { toastNQ.unshift({ title, body, col }); if (toastBusy && !$('#ticker').classList.contains('urgent')) { clearTimeout(tickT); tickerShow(toastNQ.shift()); } else if (!toastBusy) nextToast(); return; }
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
    if (screen === 'game') { tickerShow(t); return; }
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
  let tickT = null;
  function tickerShow(t) {
    const el = $('#ticker'), urgent = URGENT_RE.test(t.title);
    noteKeep(t.title, t.body, t.col);
    el.style.setProperty('--c', urgent ? '#ff4d6a' : t.col || '#ffb03a');
    el.classList.toggle('urgent', urgent); el.classList.remove('out', 'scroll');
    el.innerHTML = `<div class="tkl"><b>${esc(t.title)}</b><span>${esc(t.body || '')}</span></div><button class="tkb" aria-label="Notice log">LOG</button>`;
    el.hidden = false;
    const line = el.firstChild, over = line.scrollWidth - el.clientWidth + 56;
    let dur = urgent ? 6500 : Math.min(6000, 2800 + (t.body || '').length * 30);
    // too long for one line: it slides across once instead of being cut off
    if (over > 0) { const secs = Math.max(2.5, over / 45); line.style.setProperty('--shift', -over + 'px'); line.style.setProperty('--dur', secs + 's'); el.classList.add('scroll'); dur = Math.max(dur, 1200 + secs * 1000 + 1600); }
    if (toastNQ.length) dur = Math.min(dur, Math.max(2600, over > 0 ? 1200 + Math.max(2.5, over / 45) * 1000 + 600 : 0));
    if (urgent) { const st = $('#stage'); st.classList.remove('edgeflash'); void st.offsetWidth; st.classList.add('edgeflash'); Haptics.big(); }
    clearTimeout(tickT);
    const end = () => { clearTimeout(tickT); el.classList.add('out'); tickT = setTimeout(() => { el.hidden = true; el.classList.remove('out'); nextToast(); }, 250); };
    tickT = setTimeout(end, dur);
  }
  // the feed: recent events in the corner. Old ones fade; with Stats on it keeps the last few
  const feedLines = [];
  function feed(title, body, col, quiet) {
    if (!quiet && screen === 'game') noteKeep(title, body, col);
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
  const briefMode = () => G && G.watch ? 'off' : PROF.settings.briefings || 'pause';
  // v5.1: the first time you meet an enemy, a short card says what it is and what beats it (queued if something is open)
  const enemyCards = []; let readyIx = -1;
  function enemyCard(k) {
    const D = ENEMIES[k]; if (!D) return;
    if (briefMode() !== 'pause' || screen !== 'game') { toast('NEW ENEMY · ' + D.name.toUpperCase(), `${D.desc}. Beat it: ${D.beat}`, '#ff4d6a', true); return; }
    if (modalOpen || Tree.isOpen || (G && G.draft)) { if (!enemyCards.includes(k)) enemyCards.push(k); return; }
    closePanel(); if (G && !G.over) { G.paused = true; G.briefing = true; }
    modal(`<div class="card narrow brief ecard"><div class="erow"><canvas width="88" height="88" data-eico="${k}"></canvas><div class="bi"><em>New enemy · next wave</em><h3>${esc(D.name)}</h3><p class="desc">${tipify(D.desc)}.</p><p class="ph good">Beat it: ${tipify(D.beat)}</p></div></div>
      <div class="foot"><span class="note">Tap any enemy on the field to inspect it</span><button class="btn primary" data-act="brief">Got it</button></div></div>`, 'brief');
    const cv = $('#modal canvas[data-eico]'); if (cv) Render.enemyIcon(k, cv);
  }
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
    Render.sel = null; Render.selT = null; Render.prev = null; Render.selE = null;
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
  // v5.0.2: a re-render between finger-down and finger-up swallowed the tap (Nic: two Sell taps did nothing while a veteran
  // rank or affix changed mid-fight). While a finger is on the panel, re-renders wait until it lifts
  let panelHeld = false, panelDirty = false;
  function renderPanel() {
    if (!panel) return;
    if (panelHeld) { panelDirty = true; return; }
    panelDirty = false;
    const el = $('#panel'), pst = el.querySelector(':scope > .pbody'), keep = pst && renderPanel.last === panel && !panel.resetScroll ? pst.scrollTop : 0;
    renderPanel.last = panel; panel.resetScroll = false;
    if (panel.kind === 'build') el.innerHTML = buildPanelHTML();
    else if (panel.kind === 'tower') el.innerHTML = towerPanelHTML(panel.t);
    else if (panel.kind === 'core') el.innerHTML = corePanelHTML();
    else if (panel.kind === 'cash') el.innerHTML = cashPanelHTML();
    else if (panel.kind === 'reloc') el.innerHTML = relocPanelHTML();
    else if (panel.kind === 'enemy') el.innerHTML = enemyPanelHTML(panel.e);
    el.classList.remove('framed');
    const nb = frameBox(el, 'ph', 'pfoot', 'pbody');
    // a footer that would squeeze the body to nothing (the core's on a small phone) scrolls with the content instead
    { const ft = el.querySelector(':scope > .pfoot'); if (nb && ft && ft.offsetHeight > el.clientHeight * 0.5) { nb.appendChild(ft); ft.classList.add('inbody'); } }
    if (nb && keep) nb.scrollTop = keep;
    for (const cv of el.querySelectorAll('canvas[data-eico]')) Render.enemyIcon(cv.dataset.eico, cv);
    for (const cv of el.querySelectorAll('canvas[data-bico]')) Render.bossPortrait(cv.dataset.bico, cv);
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
    coil: 'Shields and crowds · ×3 vs shields, stops Shell recharging, chains', forge: 'Economy · credits every wave',
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
    if (t.lvl < 3 || t.lvl === 4) { const c = upgradeCost(t); up = `<button class="btn primary wide lvup" style="${tierStyle(t.lvl + 1)}" data-act="up" ${costBtn(c)}>Upgrade to LV ${t.lvl + 1} · ${fmt(c)}<small>${s.kind === 'snare' ? 'more catches, longer hold, wider net' : s.kind === 'support' ? 'stronger boost' : s.kind === 'eco' ? 'more income' : 'more Damage'}, new affix</small></button>`; }
    else if (t.lvl === 3) { const c = upgradeCost(t); up = `<div class="lbl">Specialize · ${fmt(c)}</div><div class="specs">${D.specs.map((sp, i) => `<button class="spec" data-act="spec" data-v="${i + 1}" ${costBtn(c)}><b>${esc(sp.name)}</b><span>${tipify(sp.desc)}</span></button>`).join('')}</div>`; }
    else { const c = upgradeCost(t); up = `<button class="btn primary wide asc lvup" style="${tierStyle(towerLevel(t) + 1)}" data-act="up" ${costBtn(c)}>Ascend to LV ${towerLevel(t) + 1} · ${fmt(c)}<small>${lvTier(towerLevel(t) + 1).name} · ×1.3 Damage, new affix</small></button>`; }
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
    const head = `<div class="ph tabbed"><canvas class="ico" width="24" height="24" data-ico="${t.type}"></canvas><div class="pt"><b>${title}</b><small>${t.name ? `<em class="vname">"${esc(t.name)}"</em> · ` : ''}<b class="lvtag" style="background:${lvTier(towerLevel(t)).col}">LV ${towerLevel(t)}</b>${spec ? ' · ' + esc(spec) : ''} · <span style="color:${EL[s.el].col}">${EL[s.el].name}</span></small></div><button class="x" data-act="close" aria-label="Close">✕</button>${tabsHTML(t.affixes.length ? t.affixes.length : '')}</div>`;
    const foot = `<div class="pfoot">${t.lvl === 3 ? `<button class="btn wide lvup" disabled>Choose a Specialization<small>${(panel.tab || 'act') === 'info' ? 'on the Actions tab' : 'above'}</small></button>` : up}
      <div class="row2"><button class="btn" data-act="reroll" ${costBtn(rc)}>Reroll · ${fmt(rc)}</button>${G.tokens > 0 ? `<button class="btn tokbtn" data-act="rerollTok">Reroll · 1 token<small>${G.tokens} left</small></button>` : ''}<button class="btn danger" data-act="sell">Sell +${fmt(sellRefund(t))}${G.refit && !G.checkpoint ? '<small>Free refit · 100%</small>' : ''}</button></div></div>`;
    if ((panel.tab || 'act') === 'info') return `${head}
      ${vbar}
      ${stats}
      ${condHTML(t)}
      ${idle}
      ${t.linkedTo ? `<div class="sts node">${tipify(`Node Link with ${TOWERS[t.linkedTo.type].name}: +10% Damage, shared beam`)}</div>` : ''}
      ${s.node ? `<div class="sts node">${tipify(s.kind === 'support' ? 'Power Node: +25% Boost strength' : s.kind === 'eco' ? 'Power Node: +25% Income' : s.kind === 'snare' ? 'Power Node: +25% catches, +15% Range' : 'Power Node: +25% Damage, +15% Range')}</div>` : ''}
      ${t.affixes.length ? `<div class="lbl">Affixes</div><div class="affs">${t.affixes.map(a => s.kind === 'snare' ? affixHTML(a).replace('Boost strength', 'Net strength') : affixHTML(a)).join('')}</div>` : ''}
      ${foot}`;
    return `${head}
      ${t.lvl === 3 ? up : ''}
      ${vet}
      ${condHTML(t)}
      ${idle}
      ${canOvercharge(t) ? `<div class="lbl">${tipify('Overcharge')} · +${Math.round((OVERCHARGE.dmg + FX('msOc') / 100) * 100)}% per step · power ${gridUsed()}/${gridCap()}</div><div class="modes oc">${ocFree(t) ? `<span class="note">Marksman: +${ocFree(t)} free</span>` : ''}${Array.from({ length: ocMax() + 1 }, (_, n) => `<button class="chip ${(t.oc || 0) === n ? 'on' : ''}" data-act="oc" data-v="${n}" ${n - (t.oc || 0) > gridFree() ? 'disabled' : ''}>${n ? `+${n}` : 'Off'}</button>`).join('')}</div>` : ''}
      ${modes}
      ${!canOvercharge(t) && !modes ? `<div class="sg mini">${stats.replace(/^<div class="sg">|<\/div>.*$/gs, '')}</div>` : ''}
      ${foot}`;
  }
  // v5.1: every live modifier on this tower in one place (Nic: storms weren't transparent)
  function condHTML(t) {
    const C = towerConditions(t);
    return `<div class="conds" data-live="conds" data-sig="${esc(C.map(c => c.t).join('|'))}">${C.length ? `<span class="lbl">Conditions</span>${C.map(c => `<span class="${c.bad ? 'bad' : c.good ? 'good' : ''}"${c.col ? ` style="box-shadow:inset 3px 0 0 ${c.col}"` : ''}>${esc(c.t)}</span>`).join('')}` : ''}</div>`;
  }
  function corePanelHTML() {
    const c = G.core, s = coreStats();
    const wc = coreWeaponCost(), sc = coreShieldCost(), rc = coreRepairCost();
    const nextMod = CORE_MODULES.find(m => m.lv === c.wLvl + 1);
    const mods = `<div class="cmods">${CORE_MODULES.map(m => `<span class="${c.wLvl >= m.lv ? 'on' : ''}"><b>${c.wLvl >= m.lv ? '' : 'LV ' + m.lv + ' · '}${esc(m.name)}</b>${tipify(m.desc)}</span>`).join('')}</div>`;
    const head = `<div class="ph tabbed"><div class="pt"><b>Core Battery</b><small>Battery LV ${c.wLvl} · Shield LV ${c.sLvl}${c.uLvl ? ' · Uplink ' + c.uLvl : ''}${c.hLvl ? ' · Hull ' + c.hLvl : ''}</small></div><button class="x" data-act="close" aria-label="Close">✕</button>${tabsHTML(c.affixes.length ? c.affixes.length : '')}</div>`;
    const foot = `<div class="pfoot">${canRelocate() ? relocHTML() : ''}<button class="btn primary wide" data-act="cw" ${c.wLvl >= CORE_GUN.maxLv ? 'disabled' : costBtn(wc)}>${c.wLvl >= CORE_GUN.maxLv ? 'Battery · Max' : `Upgrade Battery · ${fmt(wc)}<small>${nextMod ? `LV ${nextMod.lv}: unlocks ${esc(nextMod.name)}` : '+50% Damage, +Range, new affix'}</small>`}</button>
      <div class="row2"><button class="btn" data-act="cs" ${c.sLvl >= 10 ? 'disabled' : costBtn(sc)}>Shield · ${fmt(sc)}</button>${G.af.lastStand ? '' : `<button class="btn" data-act="cr" ${costBtn(rc)}>Repair · ${fmt(rc)}</button>`}</div>
      ${(() => { const u = c.uLvl || 0, nm = UPLINK.mods.find(m => m.lv > u), h = c.hLvl || 0;
        return `<div class="row2"><button class="btn" data-act="cu" ${u >= UPLINK.max ? 'disabled' : costBtn(coreUplinkCost())}>${u >= UPLINK.max ? 'Uplink · Max' : `Uplink ${u + 1} · ${fmt(coreUplinkCost())}`}<small>−${UPLINK.cd}% cooldowns</small></button><button class="btn" data-act="ch" ${h >= HULL.max ? 'disabled' : costBtn(coreHullCost())}>${h >= HULL.max ? 'Hull · Max' : `Hull ${h + 1} · ${fmt(coreHullCost())}`}<small>+${HULL.hp}% hull, −${HULL.guard}% leak damage</small></button></div>`; })()}
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
      <div class="lbl">Command Uplink · LV ${c.uLvl || 0}/${UPLINK.max} · −${UPLINK.cd * (c.uLvl || 0)}% cooldowns</div>
      <div class="cmods">${UPLINK.mods.map(m => `<span class="${(c.uLvl || 0) >= m.lv ? 'on' : ''}"><b>${(c.uLvl || 0) >= m.lv ? '' : 'LV ' + m.lv + ' · '}${esc(m.name)}</b>${tipify(m.desc)}</span>`).join('')}</div>
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
      const cd = el.querySelector('[data-live="conds"]'); if (cd && !panelHeld) { const sg = towerConditions(t).map(c => c.t).join('|'); if (cd.dataset.sig !== sg) cd.outerHTML = condHTML(t); }
      const k = el.querySelector('[data-live="kills"]'); if (k) k.textContent = t.kills;
    }
    if (panel.kind === 'enemy') { const e = panel.e, b = el.querySelector('[data-live="ehpbar"]'); if (b) b.style.width = pct(clamp(e.hp / e.maxHp, 0, 1));
      const h = el.querySelector('[data-live="ehp"]'); if (h) h.textContent = `${fmt(Math.max(0, e.hp))} / ${fmt(e.maxHp)} HP`;
      const pg = el.querySelector('[data-live="eprog"]'); if (pg && e.L && e.L.len) pg.textContent = Math.round(e.d / e.L.len * 100) + '%';
      const sig = [e.st.burn ? 1 : 0, e.st.chill, e.st.frozen > 0 ? 1 : 0, e.st.shock > 0 ? 1 : 0, e.st.mark, e.scanned > 0 ? 1 : 0, e.shield > 0 ? 1 : 0, e.phase || 0].join(':');
      if (panel.sig !== undefined && panel.sig !== sig) { panel.sig = sig; renderPanel(); return; } panel.sig = sig; return; }
    if (panel.kind === 'cash') { const sig = Math.floor(G.credits) + ':' + G.wave; if (panel.sig !== sig) { panel.sig = sig; renderPanel(); } return; }
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
    if (act === 'tab') { panel.tab = b.dataset.v; panel.resetScroll = true; renderPanel(); return; }
    if (panel.kind === 'build') {
      if (act === 'pick') {
        if (pick === b.dataset.type && G.credits >= towerCost(pick)) return panelAction('build', b);
        pick = b.dataset.type;
        const D = TOWERS[pick];
        Render.prev = D.range ? { x: panel.x, y: panel.y, range: D.range * G.mods.range * (pick === 'pulse' || pick === 'rail' ? 1 + G.mods.rangeKR : 1), col: EL[D.el].col } : null;
        renderPanel();
      } else if (act === 'reactor') {
        if (!window.act('reactor')) { SFX.play('deny'); return; }
        toast('REACTOR EXPANDED', `Power ${gridUsed()}/${gridCap()} · next expansion ${fmt(reactorCost())}`, '#59f0b4'); renderPanel(); updateHud();
      } else if (act === 'build') {
        const t = window.act('build', pick, panel.x, panel.y);
        if (!t) { SFX.play('deny'); return; }
        Render.prev = null;
        openTower(t);
      }
      return;
    }
    if (panel.kind === 'tower') {
      const t = panel.t;
      if (act === 'mode') { window.act('mode', t.x, t.y, b.dataset.v); renderPanel(); }
      else if (act === 'up') { if (!window.act('up', t.x, t.y)) SFX.play('deny'); renderPanel(); }
      else if (act === 'spec') { if (!window.act('up', t.x, t.y, +b.dataset.v)) SFX.play('deny'); renderPanel(); }
      else if (act === 'reroll') { if (!window.act('reroll', t.x, t.y, 0)) SFX.play('deny'); renderPanel(); }
      else if (act === 'rerollTok') { if (!window.act('reroll', t.x, t.y, 1)) SFX.play('deny'); renderPanel(); }
      else if (act === 'sell') { window.act('sell', t.x, t.y); closePanel(); }
      else if (act === 'oc') { if (!window.act('oc', t.x, t.y, +b.dataset.v)) { SFX.play('deny'); toast('NOT ENOUGH POWER', 'Free some power: lower another Overcharge or sell a tower', '#ff4d6a'); } renderPanel(); updateHud(); }
      else if (act === 'vet') { if (!window.act('vet', t.x, t.y, +b.dataset.v)) SFX.play('deny'); renderPanel(); }
      return;
    }
    if (panel.kind === 'cash') {
      if (act === 'cash') { const got = window.act('cash', Math.floor(G.credits * +b.dataset.v)); if (got) toast('CASHED IN', `+${fmt(got)} score`, '#ffb03a'); else SFX.play('deny'); updateHud(); panel.sig = null; liveRefreshPanel(); }
      else if (act === 'buy') {
        const m = window.act('buy', b.dataset.v);
        if (!m) { SFX.play('deny'); return; }
        const I = MARKET_ITEMS.find(x => x.id === b.dataset.v);
        if (G.placing === 'beacon') { closePanel(); toast('NODE BEACON', m + '. Tap the core to cancel', '#6ae2ff', true); }
        else { toast('BLACK MARKET', `${I.name}: ${m}`, I.col); panel.sig = null; liveRefreshPanel(); }
        updateHud(); Save.save();
      }
      return;
    }
    if (panel.kind === 'core') {
      if (act === 'cel') { window.act('coreEl', b.dataset.v); renderPanel(); }
      else if (act === 'cw') { if (!window.act('core', 'weapon')) SFX.play('deny'); renderPanel(); }
      else if (act === 'cs') { if (!window.act('core', 'shield')) SFX.play('deny'); renderPanel(); }
      else if (act === 'cu') { if (!window.act('core', 'uplink')) SFX.play('deny'); renderPanel(); updateHud(); }
      else if (act === 'ch') { if (!window.act('core', 'hull')) SFX.play('deny'); else toast('HULL REINFORCED', `LV ${G.core.hLvl}: ${Math.round(G.core.max)} max hull, leaks deal ${HULL.guard * G.core.hLvl}% less`, '#59f0b4', true, 'tip'); renderPanel(); updateHud(); }
      else if (act === 'cr') { if (!window.act('core', 'repair')) SFX.play('deny'); renderPanel(); }
      else if (act === 'crr') { if (!window.act('coreRoll')) SFX.play('deny'); renderPanel(); }
      else if (act === 'od') {
        // two taps: the first arms it for 3 seconds
        if (!panel.odArm) { panel.odArm = true; renderPanel(); setTimeout(() => { if (panel && panel.kind === 'core' && panel.odArm) { panel.odArm = false; renderPanel(); } }, 3000); return; }
        panel.odArm = false;
        const r = window.act('od');
        if (r === 'empty') { SFX.play('deny'); toast('OVERDRIVE', 'Nothing to clear yet. Save it for a crowd', '#ff4d6a'); renderPanel(); }
        else if (r !== 'ok') { SFX.play('deny'); renderPanel(); }
        else { closePanel(); toast('OVERDRIVE', `${G.stats.odKills} enemies erased`, '#59f0b4'); updateHud(); }
      }
      else if (act === 'reloc') startReloc();
      else if (act === 'reactor') { if (!window.act('reactor')) SFX.play('deny'); else toast('REACTOR EXPANDED', `Power ${gridUsed()}/${gridCap()} · next ${fmt(reactorCost())}`, '#59f0b4'); renderPanel(); updateHud(); }
      return;
    }
    if (panel.kind === 'reloc') {
      if (act === 'rcancel') endReloc();
      else if (act === 'rgo') {
        if (!(G.reloc && G.reloc.plan && window.act('reloc', G.reloc.plan.x, G.reloc.plan.y))) { SFX.play('deny'); return; }
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
  // ---------- v5.1 Know Your Enemy: tap (or hover) any enemy to see what it is, what it does and what beats it ----------
  function enemyAt(p, rad) {
    let best = null, bd = (rad || 0.6) * (rad || 0.6);
    for (const e of G.enemies) { if (e.dead || (e.cloaked && !(e.revealed > 0)) || e.burrowT > 0) continue; const ey = e.y - (e.fly ? 0.3 : 0), r = e.boss ? 1.4 : 1, d = dist2(e.x, ey, p.x, p.y) / (r * r); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  function enemyInfo(e) {
    const B = e.boss ? BOSSES.find(b => b.id === e.boss) : null, D = ENEMIES[e.type] || {};
    return { name: e.boss ? e.bossName : D.name || e.type, desc: B ? B.desc : D.desc, beat: B ? (B.tip || 'Single-target damage, Stasis and Strike. A boss that reaches the core ends the run') : D.beat };
  }
  function enemyPanelHTML(e) {
    const I = enemyInfo(e), st = e.st || {};
    const tags = [];
    if (e.boss) tags.push(`<span class="etag bad">Boss${e.phase ? ' · phase ' + (e.phase + 1) : ''}</span>`);
    if (e.fly) tags.push('<span class="etag">Flying</span>');
    if (e.armor) tags.push(`<span class="etag">Plated ${Math.round(e.armor * 100)}%</span>`);
    for (const [k, v] of Object.entries(e.res || {})) if (v) tags.push(`<span class="etag" style="color:${EL[k].col}">${v > 0 ? 'Resists' : 'Weak to'} ${EL[k].name} ${Math.round(Math.abs(v) * 100)}%</span>`);
    const sts = [];
    if (st.burn) sts.push('<span style="color:#ff7b39">Burning</span>'); if (st.frozen > 0) sts.push('<span style="color:#bff4ff">Frozen</span>'); else if (st.chill > 0) sts.push(`<span style="color:#9ad8ff">Chilled ${st.chill}</span>`);
    if (st.shock > 0) sts.push('<span style="color:#ffe14d">Shocked</span>'); if (st.mark > 0) sts.push(`<span style="color:#b86cff">Marked ${st.mark}</span>`); if (e.scanned > 0) sts.push('<span style="color:#7dffb0">Scanned +15%</span>');
    if (e.shield > 0) sts.push(`<span style="color:#7fd4ff">Shield ${fmt(e.shield)}</span>`);
    const elites = (e.elite || []).map(id => ELITE_AFFIXES.find(a => a.id === id)).filter(Boolean);
    const genes = (e.genes || []).filter(g => GENES[g]);
    const prog = e.L && e.L.len ? Math.round(e.d / e.L.len * 100) : 0;
    return `<div class="ph"><canvas class="ico eico" width="32" height="32" ${e.boss ? `data-bico="${e.boss}"` : `data-eico="${e.pirate ? 'pirate' : e.type}"`}></canvas><div class="pt"><b>${esc(I.name)}</b><small>${tags.join(' ') || 'Ground'}</small></div><button class="x" data-act="close" aria-label="Close">✕</button></div>
      <div class="ehp"><i data-live="ehpbar" style="width:${pct(clamp(e.hp / e.maxHp, 0, 1))}"></i><span data-live="ehp">${fmt(Math.max(0, e.hp))} / ${fmt(e.maxHp)} HP</span></div>
      <div class="sg mini"><span>Speed<b>${num1(e.spd)}</b></span><span>Road<b data-live="eprog">${prog}%</b></span><span>Bounty<b>${fmt(Math.round(e.cr * G.mods.credits))}</b></span></div>
      <div class="sts">${tipify(I.desc || '')}</div>
      ${I.beat ? `<div class="sts good">Beat it: ${tipify(I.beat)}</div>` : ''}
      ${elites.length ? `<div class="lbl">Elite</div>${elites.map(A => `<div class="sts erow" style="box-shadow:inset 3px 0 0 ${A.col}"><b style="color:${A.col};font-weight:400">${esc(A.name)}</b> · ${esc(A.desc)}</div>`).join('')}` : ''}
      ${genes.length ? `<div class="lbl">Genes</div>${genes.map(g => `<div class="sts erow" style="box-shadow:inset 3px 0 0 ${GENES[g].col}"><b style="color:${GENES[g].col};font-weight:400">${GENES[g].name}${g === 'ward' && e.gel ? ' · ' + EL[e.gel].name : ''}</b> · ${esc(GENES[g].desc)} · <u>Counter: ${esc(GENES[g].counter)}</u></div>`).join('')}` : ''}
      <div class="sts" data-live="ests">${sts.join(' · ') || 'No statuses'}</div>`;
  }
  function openEnemy(e) {
    Render.sel = null; Render.selT = null; Render.prev = null; Render.selE = e; G.selCore = false;
    const p = { kind: 'enemy', e, x: Math.floor(e.x), y: Math.floor(e.y) };
    openPanel(p);
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
    // v5.0.1 mouse: right or middle button drags the map straight away; a right click without a drag cancels (see canvasUp)
    if (e.pointerType === 'mouse' && (e.button === 1 || e.button === 2)) { e.preventDefault(); gesture = { kind: 'pan', moved: 0, btn: e.button }; $('#cv').style.cursor = 'grabbing'; return; }
    if (ptrs.size === 1) gesture = { kind: 'tap', moved: 0 };
    else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; gesture = { kind: 'pinch', d: Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)) }; }
  }
  function canvasMove(e) {
    const r = $('#cv').getBoundingClientRect();
    if (G && G.aimAbility) Render.aim = Render.screenToTile((e.clientX / UIS) - (r.left / UIS), (e.clientY / UIS) - (r.top / UIS));
    if (e.pointerType === 'mouse' && G && !gesture) hoverAt(e, r);
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
      if (gesture.kind === 'pan') { Render.panBy(dx, dy); updateZoomBtn(); if (e.pointerType === 'mouse') $('#cv').style.cursor = 'grabbing'; }
    }
  }
  // v5.0.1 mouse hover: faint corners on the tile under the cursor, a range ring on towers, and a pointer cursor on anything you can click
  function hoverAt(e, r) {
    const p = Render.screenToTile((e.clientX - r.left) / UIS, (e.clientY - r.top) / UIS), tx = Math.floor(p.x), ty = Math.floor(p.y);
    const inside = G.region && inRegion(tx, ty, G.region);
    Render.hover = inside ? { x: tx, y: ty } : null;
    const en = !G.towerAt[tIdx(tx, ty)] ? enemyAt(p) : null;
    Render.hoverE = en;
    const tip = $('#etip');
    if (en) { const I = enemyInfo(en); tip.innerHTML = `<b>${esc(I.name)}</b><span>${esc(I.beat ? 'Beat it: ' + I.beat : I.desc || '')}</span>`; tip.hidden = false;
      const sr = $('#stage').getBoundingClientRect(), x = e.clientX - sr.left, y = e.clientY - sr.top; tip.style.left = Math.round(Math.min(sr.width - 230, x + 14) / UIS) + 'px'; tip.style.top = Math.round(Math.max(0, y - 46) / UIS) + 'px'; }
    else tip.hidden = true;
    const live = en || inside && (G.towerAt[tIdx(tx, ty)] || (tx === G.map.core.x && ty === G.map.core.y) || canBuildAt(tx, ty) || cacheAt(tx, ty));
    $('#cv').style.cursor = G.aimAbility ? 'crosshair' : live ? 'pointer' : 'default';
  }
  function canvasUp(e) {
    const p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId);
    if (!gesture || !p) return;
    if (gesture.btn !== undefined) { // right or middle button
      const g = gesture; gesture = null; $('#cv').style.cursor = 'default';
      if (g.btn === 2 && g.moved <= 12) mouseCancel();
      return;
    }
    if (gesture.kind === 'pinch') { if (ptrs.size === 0) gesture = null; return; }
    const g = gesture; gesture = null;
    if (g.kind !== 'tap' || g.moved > 12 || !G || G.over) return;
    const r = $('#cv').getBoundingClientRect();
    const sx = (e.clientX - r.left) / UIS, sy = (e.clientY - r.top) / UIS, now = performance.now();
    // double-tap: zoom in on that spot, or back out to the full map
    if (lastTap && now - lastTap.t < 330 && Math.hypot(sx - lastTap.x, sy - lastTap.y) < 30) {
      lastTap = null; closePanel();
      if (Render.zoom < Render.homeZoom * 1.4) Render.zoomAt(sx, sy, Math.max(1.6, 2.2 / Render.zoom)); else Render.resetCam();
      updateZoomBtn(); SFX.play('ui'); return;
    }
    lastTap = { t: now, x: sx, y: sy };
    tapTile(Render.screenToTile(sx, sy));
  }
  let lastTap = null;
  function tapTile(p) {
    if (G.watch) return; // a replay plays itself
    if (G.aimAbility) {
      const Rg = G.region; if (p.x < Rg.x0 || p.y < Rg.y0 || p.x > Rg.x1 || p.y > Rg.y1) return;
      window.act('abil', G.aimAbility, p.x, p.y);
      G.aimAbility = null; Render.aim = null; updateHud();
      return;
    }
    const tx = Math.floor(p.x), ty = Math.floor(p.y);
    if (G.placing === 'beacon') {
      if (tx === G.map.core.x && ty === G.map.core.y) { window.act('beaconCancel'); SFX.play('sell', {}); toast('NODE BEACON', 'Cancelled and refunded', '#6ae2ff', true); updateHud(); return; }
      if (window.act('beacon', tx, ty)) { SFX.play('ui'); toast('POWER NODE PLANTED', 'Towers built here draw no power and hit harder', '#6ae2ff'); updateHud(); }
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
    if (cc) { const kind = cc.kind, m = window.act('cache', tx, ty); if (m) { toast(kind === 'gold' ? 'GOLDEN SALVAGE' : kind === 'cursed' ? 'CURSED SALVAGE' : 'SALVAGE', m, kind === 'gold' ? '#ffd84a' : kind === 'cursed' ? '#ff4d6a' : '#ffe14d'); updateHud(); if (panel) renderPanel(); } return; }
    const isCore = tx === G.map.core.x && ty === G.map.core.y;
    const t = G.towerAt[tIdx(tx, ty)];
    if (!isCore && !t) { const en = enemyAt(p); if (en) { SFX.play('ui'); if (panel && panel.kind === 'enemy' && panel.e === en) { closePanel(); return; } openEnemy(en); return; } }
    SFX.play('ui');
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
    // v5.0.1: scale by how far the wheel moved, so trackpads (small deltas, pinch = ctrl+wheel) zoom smoothly and mouse notches still step
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY, k = Math.exp(-clamp(dy, -120, 120) * (e.ctrlKey ? 0.01 : 0.0012));
    Render.zoomAt((e.clientX / UIS) - (r.left / UIS), (e.clientY / UIS) - (r.top / UIS), k);
    updateZoomBtn();
  }
  // right click: cancel whatever is in progress (aiming an ability, placing a beacon), otherwise close the open panel
  function mouseCancel() {
    if (!G) return;
    if (G.aimAbility) { G.aimAbility = null; Render.aim = null; updateHud(); SFX.play('ui'); return; }
    if (panel) { closePanel(); SFX.play('ui'); }
  }
  function updateZoomBtn() { const b = $('#bZoom'); if (b) { const close = Render.homeZoom > 1.05; b.hidden = Render.home && !close; b.innerHTML = svgIcon('fit', 16) + (Render.home ? 'Map' : 'Fit · ' + (Render.zoom / Render.homeZoom).toFixed(1) + '×'); } }
  function fitCols() {
    // measure the playfield the game screen will have: app minus safe areas, the two thumb rails and the status bar
    let pr = document.getElementById('fitProbe');
    if (!pr) { pr = document.createElement('div'); pr.id = 'fitProbe'; pr.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;top:0;left:max(8px,var(--sal));right:max(8px,var(--sar));bottom:max(6px,var(--sab));'; $('#app').appendChild(pr); }
    const r = pr.getBoundingClientRect(), rail = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--rail')) || 56;
    const w = Math.max(300, r.width / UIS - 2 * rail - 12), h = Math.max(200, r.height / UIS - 32);
    return clamp(Math.round(ROWS * w / h), 38, 76);
  }

  // ---------- modals ----------
  // v5.1.4: modals and the side panel get a fixed header and footer around a scrolling body. Sticky headers and footers
  // inside a scrolling, clipped box drifted on iOS during momentum scrolling (Nic: a band across the New Run text)
  function frameBox(box, headCls, footCls, bodyCls) {
    const kids = [...box.children], head = kids[0] && kids[0].classList.contains(headCls) ? kids[0] : null, last = kids[kids.length - 1], foot = last && last !== head && last.classList.contains(footCls) ? last : null;
    if (!head && !foot) return null;
    const body = document.createElement('div'); body.className = bodyCls;
    for (const k of kids) if (k !== head && k !== foot) body.appendChild(k);
    box.insertBefore(body, foot); box.classList.add('framed');
    return body;
  }
  function modal(html, kind) {
    if (modalOpen === 'studio' && kind !== 'studio' && stInCompose) { stInCompose = false; leaveCompose(); }
    const m = $('#modal');
    m.innerHTML = html; m.hidden = false; modalOpen = kind || 'modal';
    for (const c of m.querySelectorAll(':scope > .card')) frameBox(c, 'ch', 'foot', 'cbody');
    document.body.classList.add('modal-open');
    hydrateIcons(m);
  }
  function closeModal() {
    if (modalOpen === 'studio' && stInCompose) { stInCompose = false; leaveCompose(); }
    $('#modal').hidden = true; $('#modal').innerHTML = ''; modalOpen = null; modalFrom = null; confirmAbandon = false; confirmReset = false;
    document.body.classList.remove('modal-open');
    flushToasts();
  }
  function flushToasts() { const held = toastHeld.splice(0); held.slice(-2).forEach((t, i) => setTimeout(() => toast(...t), 350 + i * 250)); }
  function openPause() {
    if (!G || G.over) return;
    G.paused = true;
    modal(`<div class="card narrow"><div class="ch"><h2>Paused</h2></div>
      <p class="note">Wave ${G.wave} · Score ${fmt(G.score)} · Multiplier ×${(G.scoreMult * huntMult()).toFixed(2)}</p>
      <p class="note">${G.bounties.length ? `${G.bounties.length} bount${G.bounties.length === 1 ? 'y' : 'ies'} claimed · ` : ''}${G.wanted ? `Next bounty: ${esc(G.wanted.name)}, Wave ${G.wanted.w}` : ''}${G.nemesis && !G.nemesis.beaten ? ` · Nemesis: ${esc(G.nemesis.name)}` : ''}</p>
      ${G.anoms.length ? `<div class="lbl">Anomalies</div><div class="anlist">${G.anoms.map(id => { const A = ANOMALIES.find(a => a.id === id); return `<div><b>${esc(A.name)}</b><span class="good">${tipify(A.up)}</span><span class="bad">${tipify(A.down)}</span></div>`; }).join('')}</div>` : ''}
      <div class="stack"><button class="btn primary" data-act="resume">Resume</button>
      <button class="btn" data-act="help">How to Play</button>
      <button class="btn" data-act="studio">Music Studio</button>
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
      ext: G.extracted || 0, bounties: G.bounties.length, bounty: G.stats.bounty || null, elites: G.stats.elites, bosses: G.stats.bossKills, leaks: G.stats.leaks, cashed: G.stats.cashed || 0, lastLeak: G.stats.lastLeak || '', crates: G.stats.crates || 0, assaults: G.stats.assaults ? JSON.parse(JSON.stringify(G.stats.assaults)) : null, pirates: G.stats.pirates || 0, odKills: G.stats.odKills || 0, relocs: G.relocUsed || 0, peakGene: G.stats.peakGene || null, strain: topStrain(), pre: G.preAdapted || null,
      mvp: mvp ? tw(mvp) : null, top: byDmg.slice(1, 4).map(tw), towers: G.towers.length,
      keystones: activeCaps().map(id => TAL[id].name) };
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
  // ---------- Hall of Fame: best three runs by wave reached (then score), with their summaries ----------
  function hallAdd(R) {
    if (!(R.score > 0) || R.wave < 10) return -1; // v5.2: a Wave 3 run is not a Hall of Fame run
    PROF.hall = (PROF.hall || []).concat([R]).sort((a, b) => b.wave - a.wave || b.score - a.score).slice(0, 3);
    const i = PROF.hall.indexOf(R); return i;
  }
  const runMode = R => R.daily ? 'Daily' : (CHAOS_LEVELS[R.chaos] || {}).name || '';
  const runDate = R => { try { return new Date(R.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return ''; } };
  function hallHTML() {
    const H = PROF.hall || [];
    if (!H.length) return `<div class="lbl">Hall of Fame</div><p class="note">Finish a run to claim a spot.</p>`;
    return `<div class="lbl">Hall of Fame</div><div class="hall">${H.map((R, i) => `<button class="hrow" data-act="hall" data-v="${i}"><em>#${i + 1}</em><span><b>Wave ${R.wave}${R.ext ? ' · Extracted' : ''}</b><small>${fmt(R.score)} · ${esc(runMode(R))}${R.strain ? ' · vs ' + esc(R.strain.name) : ''}${R.nova ? ' · Supernova ' + R.nova : ''} · ${esc(runDate(R))}</small></span>${R.mvp ? `<canvas class="ico" width="20" height="20" data-ico="${R.mvp.type}"></canvas>` : ''}</button>`).join('')}</div>`;
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
    if (opts[0] && opts[0].twist) { // 5.8 escalation: one of two permanent twists, each raising the score and XP multiplier
      const have = Object.keys(G.twists || {}).map(id => { const X = TWISTS.find(t => t.id === id); return X ? X.name + (G.twists[id] > 1 ? ' ×' + G.twists[id] : '') : ''; }).filter(Boolean);
      modal(`<div class="card narrow twist"><div class="ch"><h2 class="bad">Escalation</h2><span class="note">Wave ${G.wave} · choose a twist. It lasts the run</span></div>
        <div class="dchoice pair">${opts.map((b, i) => `<button class="hopt tw" data-act="boon" data-v="${i}"><b>${esc(b.name)}${b.n > 1 ? ' ' + roman(b.n) : ''} <i>+${Math.round(b.score * 100)}% score</i></b><span>${tipify(b.desc)}</span></button>`).join('')}</div>
        <p class="note">Score and XP ×${(G.scoreMult || 1).toFixed(2)} now${have.length ? ' · Active: ' + esc(have.join(', ')) : ''}</p></div>`, 'draft');
      SFX.play('bosswarn');
      return;
    }
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
  function copyText(txt, onDone) {
    const done = onDone || (() => toast('LOG COPIED', `${Math.round(txt.length / 1024)} KB · paste it into a chat with Claude`, '#59f0b4', true));
    const fallback = () => { const ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, txt.length); let ok = false; try { ok = document.execCommand('copy'); } catch (e) {} ta.remove();
      if (ok) done(); else if (onDone) askText({ title: 'Copy this code', value: txt, multiline: true, readOnly: true, ok: 'Done', onDone: () => {} }); else toast('COPY FAILED', 'Use Save log instead', '#ff4d6a', true); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, fallback); else fallback();
  }
  // v5.5.10 typing on a phone: a panel pinned to the part of the screen the keyboard leaves visible. The game is a fixed,
  // scaled layer, so iOS cannot scroll a text box inside it into view; this panel lives outside it and follows visualViewport.
  let entryOpen = false;
  function askText(o) {
    const old = $('#entry'); if (old) old.remove();
    const el = document.createElement('div'); el.id = 'entry';
    el.innerHTML = `<div class="enbox"><b>${esc(o.title || '')}</b>${o.multiline ? `<textarea rows="3" ${o.readOnly ? 'readonly' : ''} autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="${esc(o.placeholder || '')}"></textarea>` : `<input type="text" maxlength="${o.max || 60}" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="${esc(o.placeholder || '')}">`}
      <div class="enrow">${o.readOnly ? '' : '<button class="btn" data-en="x">Cancel</button>'}<button class="btn primary" data-en="ok">${esc(o.ok || 'OK')}</button></div></div>`;
    document.body.appendChild(el); entryOpen = true;
    const inp = el.querySelector('input, textarea'), vv = window.visualViewport;
    inp.value = o.value || '';
    const place = () => { if (!vv) return; el.style.top = vv.offsetTop + 'px'; el.style.left = vv.offsetLeft + 'px'; el.style.width = vv.width + 'px'; el.style.height = vv.height + 'px'; };
    place(); if (vv) { vv.addEventListener('resize', place); vv.addEventListener('scroll', place); }
    const finish = v => { if (vv) { vv.removeEventListener('resize', place); vv.removeEventListener('scroll', place); } inp.blur(); el.remove(); entryOpen = false; setTimeout(() => UI.fitVV && UI.fitVV(), 250); if (v !== null && o.onDone) o.onDone(v); };
    el.onclick = e => { const b = e.target.closest('[data-en]'); if (b) { e.preventDefault(); finish(b.dataset.en === 'ok' ? inp.value : null); } else if (e.target === el) finish(null); };
    inp.onkeydown = e => { if (e.key === 'Enter' && !o.multiline) { e.preventDefault(); finish(inp.value); } if (e.key === 'Escape') finish(null); };
    inp.focus(); if (o.readOnly || o.value) { inp.select(); try { inp.setSelectionRange(0, inp.value.length); } catch (e) {} } // focus inside the tap, or iOS keeps the keyboard down
  }
  // a code from the clipboard (iOS asks to allow the paste), else the typing panel
  function pasteCode(title, use) {
    const ask = () => askText({ title, multiline: true, placeholder: 'Paste the code here', ok: 'Add', onDone: v => v.trim() && use(v.trim()) });
    if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(t => { t = (t || '').trim(); if (/^(TRACK|HUNT)[01]:/.test(t)) use(t); else ask(); }, ask); else ask();
  }
  function saveText(txt) {
    const name = `last-gradient-run-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.txt`;
    try {
      const file = new File([txt], name, { type: 'text/plain' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: 'Last Gradient run log' }).catch(() => {}); return; }
    } catch (e) {}
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function openNews() {
    const N = WHATS_NEW;
    modal(`<div class="card news"><div class="ch"><h2>${esc(N.title)}</h2><span class="note">Version ${esc(N.ver)}</span><button class="x" data-act="newsDone" aria-label="Close">✕</button></div>
      <div class="newslist">${N.items.map(([h, t]) => `<div><b>${esc(h)}</b><span>${tipify(t)}</span></div>`).join('')}</div>
      <div class="foot"><button class="btn primary" data-act="newsDone">Let's go</button></div></div>`, 'news');
  }
  // v5.3: the death screen says why, and what would have stopped it
  function lossWhyHTML() {
    if (G.stats.bossBreach) return `<div class="why"><b>Why</b><span>${esc(G.stats.bossBreach)} reached the core. A boss at the core ends the run, whatever your shield.</span><span class="good">Next time: slow it (Cryo, Gravity Well, Stasis), Scan it for +15% damage taken, and put single-target fire on it (Rail Lance, Void Lens). Upgrade the core's Command Uplink for faster Stasis.</span></div>`;
    const L = G.leakWave || {}, top = Object.entries(L).sort((a, b) => b[1] - a[1])[0];
    if (!top) return '';
    const n = Object.values(L).reduce((a, b) => a + b, 0), [ty, ...gs] = top[0].split('+'), D = ENEMIES[ty];
    const nm = D ? D.name : ty.replace('boss:', ''), g0 = gs.find(g => GENES[g]);
    const beat = g0 ? GENES[g0].counter : D && D.beat;
    return `<div class="why"><b>Why</b><span>${n} got through in Wave ${G.wave}, mostly ${esc(nm)}${gs.length ? ' with ' + gs.map(g => GENES[g] ? GENES[g].name : g).join(', ') : ''} (${top[1]}).</span>${beat ? `<span class="good">Beat it: ${tipify(beat)}</span>` : ''}</div>`;
  }
  // ---------- v5.3 The Hunt: the choice after a bounty, hunt codes, and watching a recorded run ----------
  // v5.3.4 Veteran Picks: the "veterans ready" chip walks through every tower with a mutation waiting, one card at a time
  const vetFlow = { ix: 0, n: 0 };
  const vetsReady = () => G ? G.towers.filter(t => t.pending > 0) : [];
  function showOnMap(t) { openTower(t); const p = Render.tileToScreen(t.cx, t.cy), L = Render.layout; Render.panBy(L.W / 2 - p.x, L.H / 2 - p.y); updateZoomBtn(); }
  function openVets() {
    const rd = vetsReady();
    if (!rd.length) { closeModal(); if (G && !G.over) G.paused = false; if (vetFlow.n) toast('VETERANS', `${vetFlow.n} mutation${vetFlow.n === 1 ? '' : 's'} picked. Every veteran is up to date`, '#ffe14d', true, 'tip'); vetFlow.n = 0; return; }
    vetFlow.ix = ((vetFlow.ix % rd.length) + rd.length) % rd.length;
    const t = rd[vetFlow.ix], o = vetOffer(t), left = rd.reduce((a, x) => a + x.pending, 0);
    closePanel(); G.paused = true;
    modal(`<div class="card narrow vets"><div class="ch"><h2>Veteran Picks</h2><span class="note">Tower ${vetFlow.ix + 1} of ${rd.length} · ${left} pick${left === 1 ? '' : 's'} waiting</span><button class="x" data-act="vetDone" aria-label="Close">✕</button></div>
      <div class="vhead"><canvas class="ico" width="32" height="32" data-ico="${t.type}"></canvas><div><b>${esc(towerLabel(t))}</b><small>${towerLabel(t) !== TOWERS[t.type].name ? esc(TOWERS[t.type].name) + ' · ' : ''}LV ${towerLevel(t)} · ${tipify('Veteran')} ${roman(t.rank)}${t.pending > 1 ? ` · ${t.pending} picks here` : ''} · choose a mutation</small></div></div>
      <div class="vet">${o.map((a, i) => `<button class="aff pickable" data-act="vpick" data-v="${i}" style="--c:${RARITY[a.tier].col}"><i>${tipify(RARITY[a.tier].name)}</i>${tipify(affixText(a))}</button>`).join('')}</div>
      ${t.affixes.length ? `<div class="lbl">Already has</div><div class="affs mini">${t.affixes.map(affixHTML).join('')}</div>` : ''}
      <div class="foot"><button class="btn" data-act="vetMap">Show on map</button>${rd.length > 1 ? '<button class="btn" data-act="vetSkip">Next tower</button>' : ''}<button class="btn" data-act="vetDone">Later</button></div></div>`, 'vets');
    for (const cv of document.querySelectorAll('#modal canvas[data-ico]')) Render.towerIcon(cv.dataset.ico, cv);
  }
  function openHunt() {
    const C = G.huntChoice; if (!C) return;
    if (G.hk && C.doors) return openDoors(C);
    const xp = Math.round(G.xpEarned * HUNT.extractXp), m2 = 1 + HUNT.pushScore * ((G.pushes || 0) + 1);
    modal(`<div class="card narrow hunt"><div class="ch"><h2 class="amber">Bounty Claimed</h2><span class="note">Wave ${G.wave} · ${G.bounties.length} claimed this run</span></div>
      <p class="wname">${esc(C.name)}</p>
      <p class="note">+${fmt(C.cr)} credits and a Legendary schematic. This run is a win. Bank it, or push your luck.</p>
      <div class="hchoice">
        <button class="hopt ext" data-act="extract"><b>Extract</b><span>End the run here as a win: +${fmt(xp)} XP on top (half again), and it counts toward opening the next Chaos level${G.daily ? '. Your Daily Hunt result is locked in' : ''}.</span></button>
        <button class="hopt push" data-act="push"><b>Push on</b><span>Keep playing at score ×${m2.toFixed(2)}. Next bounty: ${esc(C.nextName)}, Wave ${C.next}. Fall before you extract and the bonus is lost.</span></button>
      </div></div>`, 'hunt');
    SFX.play('levelup');
  }
  // 5.8: the bounty card with the Bounty Purse and the jump doors (Extract, or push on through one of three sectors)
  function openDoors(C) {
    const P = Math.round(G.purse), cur = SECTOR_BY[G.sector];
    modal(`<div class="card hunt doors"><div class="ch"><h2 class="amber">Bounty Claimed</h2><span class="note">Wave ${G.wave} · ${G.bounties.length} claimed this run${cur ? ' · ' + esc(cur.name) : ''}</span></div>
      <p class="note"><b class="wname">${esc(C.name)}</b> +${fmt(C.cr)} credits, a Legendary schematic, and your purse grew ×${PURSE.bounty}.</p>
      <div class="pursebox"><span>Bounty Purse</span><b>${fmt(P)} XP</b><em>Extract banks all of it. Push on and fall later, and you keep ${Math.round(PURSE.death * 100)}%.</em></div>
      <div class="dchoice">
        <button class="hopt ext" data-act="extract"><b>Extract</b><span>End the run as a win and bank ${fmt(P)} XP. ${G.daily ? 'Your Daily Hunt result is locked in.' : 'Counts toward the next Chaos level.'}</span><span>Or take a jump door: a new zone for 20 waves, and the purse grows.</span></button>
        ${C.doors.map((d, i) => { const S = SECTOR_BY[d.sector], T = DOOR_TIERS[d.tier]; return `<button class="hopt door" data-act="door" data-v="${i}" style="--c:${S.col};--t:${T.col}"><b>${esc(S.name)} <i>${esc(T.name)} · purse ×${d.mult}</i></b><span class="dp">${esc(S.pitch)}</span><span>${sectorLine(S, d.tier)}</span><span class="dw">Next bounty: ${esc(d.wanted)}, Wave ${C.next}</span></button>`; }).join('')}
      </div></div>`, 'hunt');
    SFX.play('levelup');
  }
  let huntCodeCache = null;
  const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = t => { const s = atob(t), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
  async function pipe(u8, Stream) { const out = new Response(new Blob([u8]).stream().pipeThrough(new Stream('deflate-raw'))); return new Uint8Array(await out.arrayBuffer()); }
  async function huntCode(rec) {
    const raw = new TextEncoder().encode(JSON.stringify({ opts: rec.opts, inputs: rec.inputs, end: rec.end }));
    try { if (typeof CompressionStream !== 'undefined') return 'HUNT1:' + b64(await pipe(raw, CompressionStream)); } catch (e) {}
    return 'HUNT0:' + b64(raw);
  }
  async function readHuntCode(code) {
    try {
      code = (code || '').trim(); const m = /^HUNT([01]):(.+)$/s.exec(code); if (!m) return null;
      let u = unb64(m[2].replace(/\s+/g, ''));
      if (m[1] === '1') u = await pipe(u, DecompressionStream);
      const rec = JSON.parse(new TextDecoder().decode(u));
      return rec && rec.opts && Array.isArray(rec.inputs) ? rec : null;
    } catch (e) { return null; }
  }
  function prepHuntCode() { huntCodeCache = null; const d = PROF.daily; if (d && d.rec) huntCode(d.rec).then(c => { huntCodeCache = c; }); }
  function openPasteHunt() {
    modal(`<div class="card narrow"><div class="ch"><h2>Watch a Hunt</h2><button class="x" data-act="close" aria-label="Close">✕</button></div>
      <p class="note">Paste a hunt code a friend sent you. You'll watch their exact run, tap for tap.</p>
      <textarea id="huntIn" class="codebox" rows="4" placeholder="HUNT1:…"></textarea>
      <div class="foot"><button class="btn primary" data-act="huntPasteGo">Watch</button></div></div>`, 'paste');
  }
  // Watching: the recording drives the run on screen. Taps do nothing (act refuses), the profile is never touched,
  // briefings stay quiet, and when the inputs run out (or the run ends) a card says so
  function watchRun(rec, title) {
    closeModal(); closePanel();
    show('game'); Render.reset(); requestAnimationFrame(() => Render.resize());
    feedLines.length = 0; renderFeed();
    const keep = JSON.stringify(PROF);
    newRun(rec.opts);
    G.watch = { inputs: rec.inputs || [], i: 0, title: title || 'Replay', keep, ver: rec.opts && rec.opts.v };
    G.inputs = []; G.speed = 2; G.unlocks = []; G.wantedTold = true; G.fresh = false;
    Render.resetCam(); updateZoomBtn(); buildAbilityBar(); updateHud(true);
    document.body.classList.add('watching');
    const wb = $('#watchbar'); wb.hidden = false; wb.querySelector('b').textContent = G.watch.title + (G.watch.ver && G.watch.ver !== VERSION ? ` · recorded on ${G.watch.ver}, may drift` : '');
  }
  // feed the recording into the live loop: called before each frame's steps
  function watchFeed() {
    const W = G.watch, inp = W.inputs;
    while (W.i < inp.length && inp[W.i][0] <= G.tick && !G.over) { const [, n, ...a] = inp[W.i++]; if (ACTS[n]) ACTS[n](...a); }
    const halted = G.draft || G.huntChoice || (G.checkpoint && !G.enemies.length);
    if (halted && W.i < inp.length && inp[W.i][0] > G.tick && G.checkpoint) G.tick = inp[W.i][0];
    if (!G.over && halted && W.i >= inp.length && !W.done) { W.done = 1; watchDone('The recording ends here.'); }
  }
  function watchDone(msg) {
    if (modalOpen) return;
    G.paused = true;
    modal(`<div class="card narrow"><div class="ch"><h2>Replay Over</h2><span class="note">${esc(G.watch ? G.watch.title : '')}</span></div>
      <div class="bigstats"><span>Wave<b>${G.wave}</b></span><span>Score<b>${fmt(G.score)}</b></span><span>Bounties<b>${G.bounties.length}</b></span></div>
      <p class="note">${esc(msg)}${G.extracted ? ` Extracted at Wave ${G.extracted}.` : ''}</p>
      <div class="foot"><button class="btn primary" data-act="watchEnd">Done</button></div></div>`, 'watch');
  }
  function endWatch() {
    if (G && G.watch) { try { const P = JSON.parse(G.watch.keep); for (const k of Object.keys(PROF)) delete PROF[k]; Object.assign(PROF, P); } catch (e) {} }
    closeModal(); document.body.classList.remove('watching'); $('#watchbar').hidden = true;
    G = null; show('hangar'); renderHangar();
  }
  function openGameOver() {
    const L = profLevel(), gained = L.level - G.lvlStart;
    const best = G.wave > (G.bestAtStart || 0);
    if (!G.rec) { G.rec = runRecord(); G.hallRank = hallAdd(G.rec); storeRunLog(); }
    Save.save();
    if (G.watch) { watchDone(G.extracted ? 'They extracted.' : 'Their core fell here.'); return; }
    const N = G.newNemesis, ranked = !!G.rankedRun;
    if (G.daily) prepHuntCode();
    modal(`<div class="card over"><div class="ch">${G.extracted ? '<h2 class="good">Extracted</h2>' : '<h2 class="bad">Core Destroyed</h2>'}<span class="note">${G.daily ? 'Daily Hunt · ' + esc(G.daily) : CHAOS_LEVELS[G.chaos] ? CHAOS_LEVELS[G.chaos].name : ''}</span></div>
      <div class="bigstats"><span>Wave<b>${G.wave}</b></span><span>Score<b>${fmt(G.score)}</b></span><span>XP<b>+${fmt(G.xpEarned)}</b></span><span>${G.daily ? 'Bounties' : 'Levels'}<b>${G.daily ? G.bounties.length : '+' + gained}</b></span></div>
      ${G.extracted ? `<div class="why good"><b>Bounty banked</b><span>${esc(G.bounties.map(b => b.name).join(', '))}. ${G.purseOut ? `Bounty Purse: +${fmt(G.purseOut.paid)} XP, all of it.` : G.stats.extractXp ? `+${fmt(G.stats.extractXp)} XP for getting out alive.` : ''}${G.pushes ? ` You pushed past ${G.pushes} bount${G.pushes === 1 ? 'y' : 'ies'} first.` : ''}</span></div>` : lossWhyHTML()}
      ${!G.extracted && G.purseOut && G.purseOut.purse > 0 ? `<p class="note hl" style="color:#ffd84a">Bounty Purse: you kept ${Math.round(G.purseOut.share * 100)}%, +${fmt(G.purseOut.paid)} of ${fmt(G.purseOut.purse)} XP.${G.bounties.length ? ` Extracting after ${esc(G.bounties[G.bounties.length - 1].name)} would have banked all of it.` : ' Claim a bounty, then Extract, to bank all of it.'}</p>`
        : !G.extracted && G.bounties.length ? `<p class="note hl" style="color:#ffd84a">Bounties claimed: ${esc(G.bounties.map(b => b.name).join(', '))}. Pushing on cost you the extraction bonus.</p>` : ''}
      ${G.nemDown ? `<p class="good">Nemesis down: ${esc(G.nemDown)}.</p>` : ''}
      ${N ? `<div class="why nem"><b>${N.rank > 1 ? 'It got you again' : 'New Nemesis'}</b><span>${esc(N.name)}${N.rank > 1 ? ` (rank ${N.rank})` : ''}. ${N.kind === 'boss' ? 'It will take your next bounty, mutated, for double the reward.' : 'The swarm will start your next run already carrying it, and it leads your first Strain Assault.'}</span></div>` : ''}
      ${G.daily ? `<p class="note">${ranked ? 'This was your ranked run for today.' : 'Practice run: your first run of the day is the ranked one.'}</p>${PROF.daily && PROF.daily.rec ? '<div class="row"><button class="btn small" data-act="huntWatch">Watch ranked run</button><button class="btn small" data-act="huntCode">Copy hunt code</button></div>' : ''}` : ''}
      ${G.daily ? '' : best ? '<p class="amber">New best wave!</p>' : `<p class="note">Best: Wave ${PROF.bestWave}</p>`}
      ${G.hallRank >= 0 ? `<p class="amber">Hall of Fame #${G.hallRank + 1}!</p>` : ''}
      ${recapHTML(G.rec)}
      ${G.unlocks && G.unlocks.length ? `<p class="good">New towers: ${G.unlocks.map(k => esc(TOWERS[k].name)).join(', ')}</p>` : ''}
      ${pointsFree() > 0 ? `<p class="good">${pointsFree()} talent point${pointsFree() === 1 ? '' : 's'} to spend</p>` : ''}
      <div class="row logrow"><span class="note">Run log for analysis</span><button class="btn small" data-act="logCopy">Copy log</button><button class="btn small" data-act="logSave">Save log</button></div>
      <div class="foot"><button class="btn" data-act="hangar">Main Menu</button><button class="btn" data-act="web">Talents</button><button class="btn primary" data-act="again">Play Again</button></div></div>`, 'over');
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
  // v4.8: buttons that raise a level wear the colour of the tier they lead to
  const tierStyle = n => { const T = lvTier(n); return `--tc:${T.col}`; };
  function openSettings() {
    const S = PROF.settings;
    modal(`<div class="card narrow"><div class="ch"><h2>Settings</h2><button class="x" data-act="close2">✕</button></div>
      <label class="set"><span>Sound Effects</span><input id="setSfx" type="range" min="0" max="1" step="0.05" value="${S.sfx}"></label>
      <label class="set"><span>Music</span><input id="setMus" type="range" min="0" max="1" step="0.05" value="${S.music}"></label>
      <div class="set"><span>Music Studio <em class="dim">genres, mixer, your tracks</em></span><button class="chip on" style="--c:#ff5fa8" data-act="studioS">Open</button></div>
      <div class="set"><span>Sound <em class="dim" id="sndStat">${esc(soundStatus())}</em></span><button class="chip" data-act="sndFix">Restart sound</button></div>
      <div class="set"><span>Mono Audio <em class="dim">one earbud, one speaker</em></span><button class="chip ${S.mono ? 'on' : ''}" data-act="mono">${S.mono ? 'On' : 'Off'}</button></div>
      <label class="set"><span>Music Tempo <em id="bpmV" class="dim">${S.bpm || 72} BPM</em></span><input id="setBpm" type="range" min="56" max="100" step="2" value="${S.bpm || 72}"></label>
      <p class="note tempo">The tempo of the Default mix. In the Music Studio each genre has its own.</p>
      ${fsOK() ? `<div class="set"><span>Full Screen</span><button class="chip ${fsOn() ? 'on' : ''}" data-act="fs">${fsOn() ? 'On' : 'Off'}</button></div>` : ''}
      <div class="set"><span>HUD</span><div class="chips"><button class="chip ${S.hud === 'lean' ? 'on' : ''}" data-act="hud" data-v="lean">Minimal</button><button class="chip ${S.hud === 'full' ? 'on' : ''}" data-act="hud" data-v="full">Detailed</button></div></div>
      <div class="set"><span>Interface Size</span><div class="chips">${[['auto', 'Auto'], [0.85, 'Small'], [1.2, 'Large']].map(([v, l]) => `<button class="chip ${(S.uiScale || 'auto') === v ? 'on' : ''}" data-act="uis" data-v="${v}">${l}</button>`).join('')}</div></div>
      <div class="set"><span>Haptics <em class="dim">buzz when the core is hit</em></span><div class="chips">${[[true, 'On'], [false, 'Off']].map(([v, l]) => `<button class="chip ${(S.haptics !== false) === v ? 'on' : ''}" data-act="haptic" data-v="${v ? 1 : 0}">${l}</button>`).join('')}</div></div>
      <div class="set"><span>Glow <em class="dim">soft lighting on the field</em></span><div class="chips">${[[true, 'On'], [false, 'Off']].map(([v, l]) => `<button class="chip ${(S.glow !== false) === v ? 'on' : ''}" data-act="gfx" data-k="glow" data-v="${v ? 1 : 0}">${l}</button>`).join('')}</div></div>
      <div class="set"><span>Pixel scaling <em class="dim">Sharp is crisper; Simple is lighter work</em></span><div class="chips">${[[true, 'Sharp'], [false, 'Simple']].map(([v, l]) => `<button class="chip ${(S.sharp !== false) === v ? 'on' : ''}" data-act="gfx" data-k="sharp" data-v="${v ? 1 : 0}">${l}</button>`).join('')}</div></div>
      <div class="set"><span>Boss slow-down <em class="dim">drop to 1× when a boss arrives</em></span><div class="chips">${[[true, 'On'], [false, 'Off']].map(([v, l]) => `<button class="chip ${(S.autoSlow !== false) === v ? 'on' : ''}" data-act="autoslow" data-v="${v ? 1 : 0}">${l}</button>`).join('')}</div></div>
      <div class="set"><span>Briefings <em class="dim">bosses, bounty</em></span><div class="chips">${[['pause', 'Pause'], ['brief', 'Brief'], ['off', 'Off']].map(([v, l]) => `<button class="chip ${(S.briefings || 'pause') === v ? 'on' : ''}" data-act="briefs" data-v="${v}">${l}</button>`).join('')}</div></div>
      <div class="set"><span>Notifications</span><div class="chips">${[['all', 'All'], ['key', 'Key'], ['off', 'Off']].map(([v, l]) => `<button class="chip ${(S.notes || 'all') === v ? 'on' : ''}" data-act="notes" data-v="${v}">${l}</button>`).join('')}</div></div>
      <p class="note tempo">Pause stops the game for a boss or bounty card until you tap Fight. Key notifications keep only what needs a reaction: Red Alert, wormholes, assaults, Maelstroms, checkpoints, pirates.</p>
      <div class="set"><span>Damage Numbers</span><button class="chip ${S.dmgNums ? 'on' : ''}" data-act="nums">${S.dmgNums ? 'On' : 'Off'}</button></div>
      <div class="set"><span>Screen Shake</span><button class="chip ${S.shake ? 'on' : ''}" data-act="shake">${S.shake ? 'On' : 'Off'}</button></div>
      <div class="set"><span>Save Location</span><span id="cloud" class="cloud ${cloudOk ? 'on' : ''}">${cloudOk ? 'Synced' : 'This device'}</span></div>
      ${G && !G.over ? '' : `<div class="set"><span>Transfer Save</span><div class="chips"><button class="chip" data-act="xcopy">Export</button><button class="chip" data-act="xpaste">Import</button></div></div>`}
      ${G && !G.over ? '' : `<button class="btn danger wide" data-act="wipe">${confirmReset ? 'Tap again to erase all progress' : 'Reset Progress'}</button>`}
      <p class="note credits">Music: Drift, a generative score written live as you play, in ten genres. No two runs sound the same.</p>
      <div class="row"><p class="note">Version ${VERSION}</p><button class="btn small" data-act="news">What's New</button></div>
      <div class="row"><p class="note">${lastLogText() ? 'Last run log' : 'No run log yet'}</p>${lastLogText() ? '<button class="btn small" data-act="logCopy">Copy log</button><button class="btn small" data-act="logSave">Save log</button>' : ''}</div></div>`, 'settings');
    $('#setSfx').oninput = e => { S.sfx = +e.target.value; SFX.setVolumes(S.sfx, S.music); };
    $('#setMus').oninput = e => { S.music = +e.target.value; SFX.setVolumes(S.sfx, S.music); };
    $('#setSfx').onchange = $('#setMus').onchange = () => Save.save();
    const bp = $('#setBpm'); if (bp) { bp.oninput = () => { PROF.settings.bpm = +bp.value; $('#bpmV').textContent = bp.value + ' BPM'; SFX.music.setBaseBpm(+bp.value); }; bp.onchange = () => Save.save(); }
  }
  // v5.5.4: one line on the state of the sound, for Settings (and for Nic to read out if the music ever goes quiet)
  function soundStatus() {
    const M = SFX.music, st = SFX.state || 'none', p = M.piece, bits = [];
    bits.push(st === 'none' ? 'not started yet (tap anywhere)' : st === 'running' ? 'on' : st);
    if (M.paused) bits.push('music paused'); if (M.held) bits.push('composer holding the radio');
    if ((PROF.settings.music || 0) <= 0.01) bits.push('music volume is 0');
    if (p && st === 'running' && !M.paused && !M.held) bits.push('playing ' + p.genreName);
    if (SFX.mono) bits.push('mono');
    const e = SFX.lastError; if (e) bits.push('recovered from: ' + e.msg);
    return bits.join(' · ');
  }
  // ---------- v5.5 Music Studio: Listen / Shape / Compose, with the piece always in view ----------
  // The now-playing bar (name, visualizer, Back / Pause / Skip / Repeat / Keep) sits in the card's header so it never scrolls
  // away. Listen: vibe presets, genres, My Tracks (rename, share codes, delete). Shape: energy, tempo, mixer, effects.
  // Compose (hidden; tap the visualizer five times): build a track from parts. Everything persists in PROF.settings.studio
  // (it is SFX.music.config): custom genres/mix, favs (each remembers its sound, composed ones carry their comp), draft, composer.
  let studioRaf = 0, studioBack = null, stTab = 'listen', stEdit = -1, stDelArm = -1, stPaste = false, stGrid = 'drums', stTaps = [], stSig = '', stStep = -1, stSnd = -1, stInCompose = false, stRadio = null, stOverArm = false;
  const ST_FX = [['reverb', 'Reverb'], ['echo', 'Echo'], ['tone', 'Tone'], ['tape', 'Tape & Vinyl'], ['pump', 'Pump']];
  const ST_CH = [['pads', 'Pads'], ['keys', 'Keys'], ['arp', 'Arps'], ['bass', 'Bass'], ['drums', 'Drums'], ['lead', 'Lead']];
  const ST_VIBES = [['calm', 'Calm', ['ambient', 'lofi', 'downtempo']], ['club', 'Club', ['house', 'techno', 'trance', 'dnb']], ['retro', 'Retro', ['synthwave', 'chiptune']], ['all', 'Everything', null]];
  const energyWord = v => v < 0.15 ? 'Still' : v < 0.4 ? 'Chill' : v < 0.7 ? 'Groove' : 'Peak';
  const fxWord = v => v < 0.02 ? 'Off' : Math.abs(v - 0.5) < 0.03 ? 'Genre' : (v < 0.5 ? '−' : '+') + Math.round(Math.abs(v - 0.5) * 200) + '%';
  const studioCfg = () => SFX.music.config;
  function studioTouch() { const c = studioCfg(); if (!c.custom) { const D = JSON.parse(JSON.stringify(SFX.music.DEF)); Object.assign(c, { genres: D.genres, energy: D.energy, follow: D.follow, mix: D.mix, mute: {}, fx: D.fx, favOnly: false }); c.custom = true; SFX.music.apply(); } }
  function studioSave() { PROF.settings.studio = studioCfg(); Save.save(); }
  const stGenres = () => { const c = studioCfg(); return c.custom ? c.genres : SFX.music.DEF.genres; };
  const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));
  // ---- track share codes: TRACK1 (deflate-raw) or TRACK0 (plain), base64 JSON of the track ----
  async function trackCode(f) {
    const o = { s: f.seed >>> 0, g: f.genre, f: f.flav, n: f.name }; if (f.snd) o.d = f.snd; if (f.comp) o.c = f.comp;
    const raw = new TextEncoder().encode(JSON.stringify(o));
    try { if (typeof CompressionStream !== 'undefined') return 'TRACK1:' + b64(await pipe(raw, CompressionStream)); } catch (e) {}
    return 'TRACK0:' + b64(raw);
  }
  async function readTrackCode(code) {
    try {
      const m = /^TRACK([01]):(.+)$/s.exec((code || '').trim()); if (!m) return null;
      let u = unb64(m[2].replace(/\s+/g, '')); if (m[1] === '1') u = await pipe(u, DecompressionStream);
      const o = JSON.parse(new TextDecoder().decode(u)), M = SFX.music;
      if (!o || !M.GENRES[o.g] || !M.GENRES[o.g].flavours[o.f]) return null;
      return { seed: o.s >>> 0, genre: o.g, flav: o.f, name: String(o.n || 'Shared Track').slice(0, 32), snd: o.d && typeof o.d === 'object' ? o.d : undefined, comp: o.c && typeof o.c === 'object' ? o.c : undefined };
    } catch (e) { return null; }
  }
  // ---- the now-playing bar ----
  function stNowHTML() {
    const M = SFX.music, p = M.piece || {};
    return `<div class="stnow">
      <canvas id="stViz" width="160" height="48" data-act="stViz" aria-label="Visualizer"></canvas>
      <div class="stinfo"><b id="stName">${esc(p.name || '…')}</b><span class="lbl" id="stGen">${esc((p.genreName || '') + (p.flavName ? ' · ' + p.flavName : ''))}${p.comp ? ' · composed' : ''}</span>
        <span class="stmeta"><span id="stKey">${esc(p.key || '')} · ${p.now || p.bpm || ''} BPM</span><em id="stSec">${esc(p.section || '')}</em></span><div class="stbar"><i id="stBar"></i></div></div>
      <div class="sttr">
        <button class="stb" id="stBackB" data-act="stBack" aria-label="Previous piece" data-svg="prev"></button>
        <button class="stb" id="stPauseB" data-act="stPause" aria-label="Pause music" data-svg="${M.paused ? 'play' : 'pause'}"></button>
        <button class="stb" data-act="stSkip" aria-label="Next piece" data-svg="next"></button>
        <button class="stb ${M.repeat ? 'on' : ''}" id="stRepB" data-act="stRepeat" aria-label="Repeat this piece" data-svg="repeat"></button>
        <button class="stb keep ${p.saved ? 'on' : ''}" id="stKeepB" data-act="stKeep" aria-label="Keep this piece" data-svg="${p.saved ? 'heart' : 'heartO'}"></button>
        <button class="stb" data-act="stShareNow" aria-label="Copy a share code for this piece" data-svg="share"></button>
      </div></div>`;
  }
  // ---- Listen ----
  function stListenHTML() {
    const M = SFX.music, c = studioCfg(), G5 = M.GENRES, sel = stGenres(), p = M.piece || {}, tg = p.genre && G5[p.genre] ? p.genre : 'lofi';
    const vibeOn = v => v[2] ? sameSet(sel, v[2]) && (v[0] !== 'calm' || true) : M.GENRE_IDS.every(g => sel.includes(g));
    const favs = c.favs.map((f, i) => {
      const G0 = G5[f.genre] || G5.lofi, sub = `${G0.short || G0.name} · ${M.flavName(f.genre, f.flav)}${f.comp ? ' · composed' : ''}`;
      const nm = stEdit === i ? `<input class="stren" id="stRenIn" data-i="${i}" maxlength="24" value="${esc(f.name)}" aria-label="Track name">` : `<button class="stnm" data-act="stRen" data-v="${i}" aria-label="Rename"><b>${esc(f.name)}</b></button>`;
      return `<div class="stfav" style="--c:${G0.col}"><div class="stft">${nm}<span class="dim">${esc(sub)}</span></div>
        <button class="stb" data-act="stPlay" data-v="${i}" aria-label="Play" data-svg="play"></button>
        ${f.comp && c.composer ? `<button class="stb" data-act="stEditT" data-v="${i}" aria-label="Edit in Composer" data-svg="edit"></button>` : ''}
        <button class="stb" data-act="stShare" data-v="${i}" aria-label="Copy share code" data-svg="share"></button>
        <button class="stb del ${stDelArm === i ? 'arm' : ''}" data-act="stDel" data-v="${i}" aria-label="Delete">${stDelArm === i ? 'Delete?' : '✕'}</button></div>`;
    }).join('');
    return `<div class="stlisten">
      <div class="stcol">
        <div class="lbl stl">Vibe</div>
        <div class="stvibe">${ST_VIBES.map(v => `<button class="chip ${vibeOn(v) ? 'on' : ''}" data-act="stVibe" data-v="${v[0]}">${v[1]}</button>`).join('')}</div>
        <div class="lbl stl">Genres <em class="dim">tap to add or remove · ▶ plays one now</em></div>
        <div class="stgen">${M.GENRE_IDS.map(g => `<div class="gw ${sel.includes(g) ? 'on' : ''}" style="--c:${G5[g].col}"><button class="gch" data-act="stGenre" data-v="${g}">${esc(G5[g].short || G5[g].name)}</button><button class="gpl" data-act="stPlayG" data-v="${g}" aria-label="Play ${esc(G5[g].name)} now" data-svg="play"></button></div>`).join('')}</div>
        <p class="note stblurb" id="stBlurb"><span style="color:${G5[tg].col}">${esc(G5[tg].name)}</span> ${esc(G5[tg].blurb.toLowerCase())}.</p>
      </div>
      <div class="stcol">
        <div class="lbl stl">My Tracks <em class="dim">${c.favs.length ? c.favs.length + ' kept' : ''}</em></div>
        <div class="strow">${c.favs.length ? `<button class="chip ${c.favOnly ? 'on' : ''}" data-act="stFavOnly">Only my tracks</button>` : ''}<button class="chip" data-act="stPaste">Paste a code</button></div>
        ${stPaste ? `<div class="strow"><input id="stCode" class="stcode" placeholder="Paste a TRACK code" autocomplete="off" spellcheck="false"><button class="btn small" data-act="stCodeGo">Add</button></div>` : ''}
        ${(c.favs.forEach(warmCode), '')}${c.favs.length ? `<div class="stfavs">${favs}</div>` : '<p class="note">Tap the heart while a piece plays to keep it here. Kept tracks remember your sound settings, and you can share them as codes.</p>'}
      </div></div>`;
  }
  // ---- Shape ----
  function stShapeHTML() {
    const M = SFX.music, c = studioCfg(), vis = c.custom ? c : Object.assign({}, M.DEF, { favs: c.favs }), p = M.piece || {}, G5 = M.GENRES, g = p.genre && G5[p.genre] ? p.genre : 'lofi';
    const slider = (id, lab, v, min, max, step, out, mid, dis) => `<label class="st2"><span>${lab}</span><output id="${id}V">${out}</output><span class="rng${mid ? ' mid' : ''}"><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${v}" ${dis ? 'disabled' : ''}></span></label>`;
    const bpm = p.comp ? p.bpm : (vis.bpm[g] || G5[g].bpm[1]);
    return `<div class="stshape">
      <div class="stcol">
        <div class="lbl stl">Feel</div>
        ${slider('stEnergy', 'Energy', vis.energy, 0, 1, 0.01, energyWord(vis.energy))}
        ${slider('stFollow', 'Follow battle', vis.follow, 0, 1, 0.01, Math.round(vis.follow * 100) + '%')}
        ${slider('stTempo', `Tempo · <span style="color:${G5[g].col}">${esc(p.comp ? 'composed' : G5[g].short || G5[g].name)}</span>`, bpm, G5[g].bpm[0], G5[g].bpm[2], 1, bpm + ' BPM', 0, p.comp)}
        <div class="st2"><span>Song length</span><output>${{ short: 'about 1 min', standard: 'about 3 min', long: 'about 5 min' }[c.length || 'standard']}</output></div>
        <div class="strow stlen">${[['short', 'Short'], ['standard', 'Standard'], ['long', 'Long']].map(([k, l]) => `<button class="chip ${(c.length || 'standard') === k ? 'on' : ''}" data-act="stLen" data-v="${k}">${l}</button>`).join('')}</div>
        <p class="note sthint">Energy: how full the music is. Follow: how much the battle pushes it. Length: Short changes song often; Standard plays a full radio edit (intro, build, drop, outro); Long an extended mix.${p.comp ? ' A composed track sets its tempo in Compose.' : ''}</p>
        <button class="btn small" data-act="stReset">Reset sound</button>
      </div>
      <div class="stcol">
        <div class="lbl stl">Mixer <em class="dim">tap a name to mute</em></div>
        <div class="mixer">${ST_CH.map(([k, l]) => `<div class="fch" data-ch="${k}"><div class="fader" data-ch="${k}"><i class="fmeter"></i><i class="ffill" style="height:${Math.round((vis.mix[k] / 1.25) * 100)}%"></i><i class="fknob" style="bottom:${Math.round((vis.mix[k] / 1.25) * 100)}%"></i></div><button class="fmute ${vis.mute && vis.mute[k] ? 'm' : ''}" data-act="stMute" data-v="${k}">${l}</button></div>`).join('')}</div>
      </div>
      <div class="stcol">
        <div class="lbl stl">Effects <em class="dim">middle = the genre's own</em></div>
        ${ST_FX.map(([k, l]) => slider('stFx_' + k, l, vis.fx[k], 0, 1, 0.01, fxWord(vis.fx[k]), 1)).join('')}
      </div></div>`;
  }
  // ---- Compose ----
  const CP_EXTRA = [{ degs: [0, 4, 5, 3], q: [], bars: 1 }, { degs: [0, 5, 3, 4], q: [], bars: 1 }, { degs: [0, 3], q: [], bars: 2 }, { degs: [0], q: [], bars: 4 }, { degs: [0, 6, 5, 6], q: [], bars: 1 }]; // the jazz ii-V-I lives in Bright only (MOOD_LOOPS)
  // 5.5.8: each mood's signature progressions, then the style's own and the common ones, keeping only those that fit the mood
  const L_ = (degs, q, bars) => ({ degs, q: q || [], bars: bars || 1 });
  const MOOD_LOOPS = {
    ionian: [L_([0, 4, 5, 3]), L_([0, 5, 3, 4]), L_([3, 0, 4, 5]), L_([0, 3, 4, 3]), L_([1, 4, 0, 0], ['m7', '7', 'M7', 'M7'])],
    lydian: [L_([0, 1], [], 2), L_([0, 1, 0, 4]), L_([0, 1, 6, 0]), L_([0, 4, 1, 0])],
    mixolydian: [L_([0, 6, 3, 0]), L_([0, 6], [], 2), L_([0, 3, 6, 3]), L_([0, 6, 3, 4])],
    dorian: [L_([0, 3], [], 2), L_([0, 3, 0, 6]), L_([0, 2, 3, 0]), L_([0, 6, 3, 3])],
    aeolian: [L_([0, 5, 2, 6]), L_([0, 3, 6, 2]), L_([0, 6, 5, 6]), L_([0, 5, 3, 4])],
    phrygian: [L_([0, 1], [], 2), L_([0, 1, 2, 1]), L_([0, 6, 1, 0]), L_([0, 1, 6, 1])],
    harmonic: [L_([0, 4], [], 2), L_([0, 3, 4, 0]), L_([0, 5, 4, 0]), L_([0, 3, 5, 4])],
  };
  function cpLoops(g, mode) {
    const M = SFX.music, seen = new Set(), out = [];
    for (const L0 of (MOOD_LOOPS[mode] || []).concat(M.loopsFor(g), CP_EXTRA)) {
      const k = JSON.stringify([L0.degs, L0.bars || 1, L0.q || []]), forced = (L0.q || []).some(Boolean);
      if (seen.has(k) || (mode && !M.loopOK(L0, mode)) || (mode && forced && L0.modes && !L0.modes.includes(mode))) continue;
      seen.add(k); out.push({ degs: L0.degs, q: L0.q || [], bars: L0.bars || 1 });
    }
    return out.length ? out : M.loopsFor(g);
  }
  const cpLoopIdx = (L0, d) => L0.findIndex(L1 => JSON.stringify([L1.degs, L1.bars || 1, L1.q || []]) === JSON.stringify([d.loop.degs, d.loop.bars || 1, d.loop.q || []]));
  function cpStyles() { const M = SFX.music, out = []; for (const g of M.GENRE_IDS) for (const f of Object.keys(M.GENRES[g].flavours)) out.push([g, f]); return out; }
  function cpDefaults(cp) { // a style's own drums, bass, lead and tempo
    const M = SFX.music, G0 = M.GENRES[cp.genre], F = G0.flavours[cp.flav] || {};
    cp.drums = M.drumsFor(cp.genre, cp.flav);
    const B = Object.assign({}, G0.bass || {}, F.bass || {}); cp.bass = B.kind ? [B.kind, B.line] : null;
    const Ld = F.lead === null ? null : Object.assign({}, G0.lead || {}, F.lead || {}); cp.lead = Ld && Ld.kind ? Ld.kind : 'none';
    cp.bpm = Math.round(G0.bpm[1] * (F.bpmX || 1));
  }
  function stComposeHTML() {
    const M = SFX.music, c = studioCfg(), d = c.draft, G5 = M.GENRES;
    if (!d) return `<div class="stcompose empty"><p class="note">Your first song starts here. Pick a style: it gives you a beat, a bassline and chords to build on. Then change anything, draw a melody, and save it to My Tracks.</p>
      <div class="cpstyles">${cpStyles().map(([g, f]) => `<button class="cpsty" style="--c:${G5[g].col}" data-act="cpStart" data-g="${g}" data-f="${f}"><b>${esc(G5[g].short || G5[g].name)}</b><small>${esc(M.flavName(g, f))}</small></button>`).join('')}</div>
      ${stRadio ? `<div class="strow"><button class="btn small" data-act="cpFrom">Or remix the last radio song (${esc(stRadio.name)})</button></div>` : ''}</div>`;
    const G0 = G5[d.genre];
    const mood = M.MOODS.find(m => m[0] === d.mode) || M.MOODS[4], bass = M.BASSES.find(b => d.bass && b[0] === d.bass[0] && b[1] === d.bass[1]), lead = M.LEADS.find(l => l[0] === d.lead) || M.LEADS[0];
    const st = (k, lab, val, col) => `<div class="cpst"><span class="lbl">${lab}</span><button class="stb" data-act="cpStep" data-k="${k}" data-v="-1" aria-label="Previous ${lab}">◀</button><b ${col ? `style="color:${col}"` : ''}>${val}</b><button class="stb" data-act="cpStep" data-k="${k}" data-v="1" aria-label="Next ${lab}">▶</button></div>`;
    return `<div class="stcompose">
      <div class="cpleft">
        <button class="cpnamebtn" data-act="cpRename" aria-label="Rename song"><b>${esc(d.name || 'My Track')}</b><i data-svg="edit"></i></button>
        <div class="cpsteps">
          ${st('style', 'Style', esc((G0.short || G0.name) + ' · ' + M.flavName(d.genre, d.flav)), G0.col)}
          ${st('mood', 'Mood', mood[1])}
          ${st('key', 'Key', M.NOTE[d.key % 12])}
          ${st('bpm', 'Tempo', d.bpm + ' BPM')}
          ${st('loop', 'Chords', esc(M.numerals(d.loop.degs, d.mode, d.loop.q)) + (d.loop.bars > 1 ? ` <small>×${d.loop.bars}</small>` : ''))}
          ${st('bass', 'Bass', bass ? bass[2] : 'Style')}
          ${st('lead', 'Lead', lead[1])}
        </div>
        <div class="strow"><button class="btn small ${stOverArm ? 'danger' : ''}" data-act="cpOver">${stOverArm ? 'Sure? Unsaved changes go' : 'New song'}</button></div>
      </div>
      <div class="cpright">
        <div class="strow cpgt"><button class="chip ${stGrid === 'drums' ? 'on' : ''}" data-act="cpGrid" data-v="drums">Drums</button><button class="chip ${stGrid === 'melody' ? 'on' : ''}" data-act="cpGrid" data-v="melody">Melody</button>
          ${stGrid === 'melody' ? `<button class="chip ${d.melAbs ? 'on' : ''}" data-act="cpMelAbs">${d.melAbs ? 'Fixed notes' : 'Follow chords'}</button><button class="chip" data-act="cpDice"><i data-svg="dice"></i>Roll</button>${d.mel && d.mel.some(x => x !== null) ? '<button class="chip" data-act="cpMelClr">Clear</button>' : ''}` : '<button class="chip" data-act="cpDrumReset">Reset</button><button class="chip" data-act="cpDrumClr">Clear</button>'}
          <button class="btn small ${SFX.music.held ? 'primary' : ''} cpplay" id="cpPlayB" data-act="stPause">${SFX.music.held ? '▶ Play' : '■ Stop'}</button><button class="btn small cpsave" data-act="cpSave">Save</button></div>
        <div id="cpGridBox">${cpGridHTML()}</div>
        <p class="note sthint">${stGrid === 'melody' ? (d.melAbs ? 'Fixed notes: each row is a note of the key (named on the left) and stays put while the chords move, the way a songwriter writes a hook. Tap to place, tap again to remove.' : d.mel === null ? 'The faint notes are a rolled melody. Tap the grid to make it yours, or roll again.' : d.mel.some(x => x !== null) ? 'Your melody, one bar looping. Higher rows are higher notes; they move with the chords, so every note fits. Tap a lit square to remove it.' : 'No melody yet. Tap the grid to write one (it always fits the chords), or Roll one.') : 'One bar, looping. Each column is a step; the white column is where the song is right now. Every lit square plays: tap one to switch it on or off.'}</p>
      </div>
    </div>`;
  }
  function cpRollFixed() { // a hook on the key's own notes: a rhythm cell, mostly stepwise motion, ending home or on the fifth
    const cells = ['x...x...x.x.x...', 'x..x..x.x.......', 'x.x.x...x.x.x...', '..x.x.x...x.x.x.', 'x...x.x...x.x...'], rh = cells[Math.floor(Math.random() * cells.length)], o = Array(16).fill(null);
    let n = [0, 2, 4][Math.floor(Math.random() * 3)]; const on = [...rh].map((ch, i) => ch === 'x' ? i : -1).filter(i => i >= 0);
    on.forEach((i, j) => { if (j) n = Math.max(0, Math.min(7, n + [-1, 1, -1, 1, 2, -2, 0][Math.floor(Math.random() * 7)])); if (j === on.length - 1) n = Math.random() < 0.6 ? 0 : 4; o[i] = n; });
    return o;
  }
  function cpAutoMel() { const M = SFX.music, p = M.piece; return p && p.comp && M.autoMel ? M.autoMel() : null; }
  function cpGridHTML() {
    const M = SFX.music, d = studioCfg().draft; if (!d) return '';
    const head = `<div class="cprow cph"><span></span>${Array.from({ length: 16 }, (_, i) => `<i class="${i % 4 ? '' : 'b'}">${i % 4 ? '' : i / 4 + 1}</i>`).join('')}</div>`;
    if (stGrid === 'drums') return `<div class="cpgrid drums">${head}${M.DRUM_ROWS.map(([k, lab]) => `<div class="cprow"><span>${lab.replace('Open hat', 'Open')}</span>${Array.from({ length: 16 }, (_, i) => { const v = +(d.drums[k] || '')[i] || 0; return `<button class="cell ${v ? 'on' : ''} ${i % 4 ? '' : 'b'}" style="--a:${v ? (0.35 + v / 15).toFixed(2) : 0}" data-act="cpCell" data-r="${k}" data-i="${i}" data-c="${i}" aria-label="${lab} step ${i + 1}"></button>`; }).join('')}</div>`).join('')}</div>`;
    const mel = d.mel && d.mel.length === 16 ? d.mel : null, ghost = d.mel === null && !d.melAbs ? cpAutoMel() : null;
    const sc = M.MODES[d.mode] || M.MODES.aeolian, lab = r => d.melAbs ? M.NOTE[((d.key | 0) + sc[r % 7]) % 12] : String(r + 1);
    let rows = '';
    for (let r = 7; r >= 0; r--) rows += `<div class="cprow"><span>${lab(r)}</span>${Array.from({ length: 16 }, (_, i) => { const on = mel ? mel[i] === r : false, gh = !mel && ghost && ghost[i] === r; return `<button class="cell ${on ? 'on' : ''} ${gh ? 'gh' : ''} ${i % 4 ? '' : 'b'}" data-act="cpNote" data-r="${r}" data-i="${i}" data-c="${i}" aria-label="Step ${i + 1} note ${r + 1}"></button>`; }).join('')}</div>`;
    return `<div class="cpgrid melody">${head}${rows}</div>`;
  }
  // Compose is its own room: the radio stops when you walk in, your song loops while you work, and the radio comes back when you leave
  const cpSpec = d => ({ genre: d.genre, flav: d.flav, seed: d.seed >>> 0, name: d.name, comp: d, start: 8 });
  // 5.5.7: a tap changes the song now (a short fade), never at the end of the bar (up to 3 s in the slow genres)
  function stPlayNow(force) { const M = SFX.music; M.setPaused(false); if (M.held) M.setHold(false); M.jump(force || null); }
  // 5.5.5 (Nic: "the radio just keeps playing"): walking in is always silent; your song starts with Play or with any change.
  // In Compose the play/stop is the hold: held = your song stopped and the radio off.
  function enterCompose() {
    const M = SFX.music, p = M.piece; stOverArm = false; M.setPaused(false);
    stRadio = p && !p.comp ? M.spec : stRadio; M.editing = true; M.setHold(true);
  }
  function cpPlay(on) { const M = SFX.music, d = studioCfg().draft; if (on && d) { M.setPaused(false); M.setHold(false); M.jump(cpSpec(d)); } else M.setHold(true); }
  function leaveCompose() {
    const M = SFX.music; M.editing = false; M.setHold(false); M.setPaused(false);
    M.jump(stRadio ? Object.assign({}, stRadio, { start: 0 }) : null); stRadio = null;
  }
  function cpApply(rerender) { // the draft changed: save it and hear it
    const M = SFX.music, c = studioCfg(); studioSave(); M.editing = stTab === 'compose';
    if (M.held || M.paused || !(M.piece && M.piece.comp)) cpPlay(true); else M.compose(c.draft); // any change plays your song
    if (rerender === 'grid') { const gb = $('#cpGridBox'); if (gb) gb.innerHTML = cpGridHTML(); } else if (rerender) openStudio();
  }
  // ---- the card ----
  function openStudio(from) {
    SFX.init(); if (from) studioBack = from;
    if (G && !G.over) G.paused = true;
    const M = SFX.music, c = M.config, p = M.piece || {}, G5 = M.GENRES, tg = p.genre && G5[p.genre] ? p.genre : 'lofi';
    if (stTab === 'compose' && !c.composer) stTab = 'listen';
    const tabs = [['listen', 'Listen'], ['shape', 'Shape']].concat(c.composer ? [['compose', 'Compose']] : []);
    const prev = $('#modal .card.studio .cbody'), keep = prev ? prev.scrollTop : 0, wasTab = prev ? prev.dataset.tab : '';
    modal(`<div class="card studio" style="--gc:${G5[tg].col}"><div class="ch"><h2>Music Studio</h2><div class="chips sttabs">${tabs.map(([k, l]) => `<button class="chip ${stTab === k ? 'on' : ''}" data-act="stTab" data-v="${k}">${l}</button>`).join('')}</div><button class="x" data-act="stClose" aria-label="Close">✕</button>
      ${stNowHTML()}</div>
      ${stTab === 'shape' ? stShapeHTML() : stTab === 'compose' ? stComposeHTML() : stListenHTML()}</div>`, 'studio');
    const body = $('#modal .card.studio .cbody'); if (body) { body.dataset.tab = stTab; if (wasTab === stTab) body.scrollTop = keep; }
    if (stTab === 'compose' && !stInCompose) { stInCompose = true; enterCompose(); } else if (stTab !== 'compose' && stInCompose) { stInCompose = false; leaveCompose(); }
    const card = $('#modal .card.studio'); if (card) card.classList.toggle('composing', stTab === 'compose');
    stSig = ''; stStep = -1; stSnd = M.sndGen;
    const bind = (id, fn, label) => { const el = $('#' + id); if (!el) return; el.oninput = () => { studioTouch(); fn(+el.value); const v = $('#' + id + 'V'); if (v && label) v.textContent = label(+el.value); SFX.music.apply(); }; el.onchange = studioSave; };
    bind('stEnergy', v => c.energy = v, energyWord);
    bind('stFollow', v => c.follow = v, v => Math.round(v * 100) + '%');
    bind('stTempo', v => { const g = (M.piece || {}).genre; if (g) c.bpm[g] = v; }, v => v + ' BPM');
    for (const [k] of ST_FX) bind('stFx_' + k, v => c.fx[k] = v, fxWord);
    for (const f of document.querySelectorAll('#modal .fader')) {
      const k = f.dataset.ch, set = ev => { const r = f.getBoundingClientRect(), v = clamp(1 - (ev.clientY - r.top) / r.height, 0, 1) * 1.25; studioTouch(); c.mix[k] = Math.round(v * 100) / 100; f.querySelector('.ffill').style.height = (v / 1.25 * 100) + '%'; f.querySelector('.fknob').style.bottom = (v / 1.25 * 100) + '%'; SFX.music.apply(); };
      f.onpointerdown = ev => { ev.preventDefault(); f.setPointerCapture(ev.pointerId); set(ev); f.onpointermove = set; };
      f.onpointerup = f.onpointercancel = () => { f.onpointermove = null; studioSave(); };
      f.ondblclick = () => { studioTouch(); c.mix[k] = 1; SFX.music.apply(); studioSave(); openStudio(); };
    }
    const ren = $('#stRenIn'); if (ren) { ren.focus(); ren.select(); const done = () => { if (ren._done) return; ren._done = 1; const i = +ren.dataset.i, f = c.favs[i]; if (f && ren.value.trim()) { f.name = ren.value.trim().slice(0, 24); const p0 = SFX.music.piece; if (p0 && p0.seed === f.seed && !f.comp === !p0.comp) SFX.music.setName(f.name); } stEdit = -1; studioSave(); openStudio(); }; ren.onkeydown = e => { if (e.key === 'Enter') done(); if (e.key === 'Escape') { stEdit = -1; openStudio(); } }; ren.onblur = () => setTimeout(done, 0); }
    cancelAnimationFrame(studioRaf); studioLoop();
  }
  function studioLoop() {
    if (modalOpen !== 'studio') return;
    const M = SFX.music, p = M.piece, cv = $('#stViz');
    if (cv && p) {
      const x = cv.getContext('2d'), W = cv.width, H = cv.height, arr = new Uint8Array(128), col = M.GENRES[p.genre].col;
      M.spectrum(arr); x.clearRect(0, 0, W, H);
      const n = 24, bw = W / n;
      for (let i = 0; i < n; i++) {
        const lo = Math.floor(Math.pow(i / n, 1.7) * 100), hi = Math.max(lo + 1, Math.floor(Math.pow((i + 1) / n, 1.7) * 100)); let v = 0; for (let k = lo; k < hi; k++) v = Math.max(v, arr[k]);
        const h = M.paused ? 0 : Math.round(v / 255 * (H - 3) / 3) * 3;
        for (let y = 0; y < h; y += 3) { x.fillStyle = y > H * 0.7 ? '#ffffff' : col; x.globalAlpha = 0.35 + 0.65 * (y / H); x.fillRect(Math.round(i * bw) + 1, H - y - 3, Math.max(2, Math.round(bw) - 2), 2); }
      }
      x.globalAlpha = 1;
      const dr = stInCompose ? studioCfg().draft : null;
      const sig = p.name + '|' + p.genre + '|' + p.seed + '|' + p.saved + '|' + M.paused + '|' + M.repeat + '|' + M.canBack + '|' + M.held + '|' + stInCompose + '|' + (dr ? dr.name + dr.genre + dr.flav + dr.mode + dr.key + dr.bpm : '');
      if (sig !== stSig) {
        { const tk = M.track; if (tk) warmCode(tk); }
        const changed = stSig && stSig.split('|').slice(0, 3).join('|') !== sig.split('|').slice(0, 3).join('|'); stSig = sig;
        if (stInCompose) { // the bar is about your song, never the radio
          const G1 = dr && M.GENRES[dr.genre], md = dr && (M.MOODS.find(m => m[0] === dr.mode) || [0, ''])[1];
          $('#stName').textContent = dr ? dr.name : 'New song';
          $('#stGen').textContent = dr ? `Your song · ${M.held ? 'stopped: press play' : 'playing'}` : 'Pick a style to begin';
          $('#stKey').textContent = dr ? `${(G1.short || G1.name)} · ${M.NOTE[dr.key % 12]} ${md} · ${dr.bpm} BPM` : 'The radio is off while you compose';
          const cb = $('#cpPlayB'); if (cb) { cb.textContent = M.held ? '▶ Play' : '■ Stop'; cb.classList.toggle('primary', M.held); }
        } else { $('#stName').textContent = p.name; $('#stGen').textContent = p.genreName + ' · ' + p.flavName + (p.comp ? ' · composed' : ''); }
        const kb = $('#stKeepB'); if (kb) { kb.classList.toggle('on', p.saved); kb.innerHTML = svgIcon(p.saved ? 'heart' : 'heartO'); }
        const quiet = stInCompose ? M.held : M.paused;
        const pb = $('#stPauseB'); if (pb) { pb.innerHTML = svgIcon(quiet ? 'play' : 'pause'); pb.setAttribute('aria-label', quiet ? 'Play' : 'Pause'); pb.classList.toggle('on', quiet); pb.style.visibility = stInCompose && !dr ? 'hidden' : ''; }
        const sbar = $('.stbar'); if (sbar) sbar.style.visibility = M.held ? 'hidden' : '';
        const rb = $('#stRepB'); if (rb) rb.classList.toggle('on', M.repeat);
        const bb = $('#stBackB'); if (bb) bb.disabled = !M.canBack;
        const card = $('.card.studio'); if (card) card.style.setProperty('--gc', col);
        const G0 = M.GENRES[p.genre], bl = $('#stBlurb'); if (bl) bl.innerHTML = `<span style="color:${col}">${esc(G0.name)}</span> ${esc(G0.blurb.toLowerCase())}.`;
        if (changed && stTab === 'shape') openStudio(); // the tempo slider belongs to the genre that plays
        if (changed && stTab === 'compose' && stGrid === 'melody' && studioCfg().draft && !studioCfg().draft.mel) { const gb = $('#cpGridBox'); if (gb) gb.innerHTML = cpGridHTML(); }
      }
      if (stSnd !== M.sndGen) { stSnd = M.sndGen; if (stTab === 'shape') openStudio(); } // a kept track brought its own sound
      const ky = $('#stKey'); if (ky && !stInCompose) ky.textContent = p.key + ' · ' + p.now + ' BPM';
      const br = $('#stBar'); if (br) br.style.width = ((p.bar + p.step / 16) / p.bars * 100) + '%';
      const se = $('#stSec'); if (se) se.textContent = M.held ? '' : M.paused ? 'Paused' : p.section;
      if (stTab === 'shape') { const mt = M.meters(); for (const f of document.querySelectorAll('#modal .fader')) { const v = Math.min(1, Math.sqrt(mt[f.dataset.ch] || 0) * 2.6); f.firstChild.style.height = Math.round(v * 100) + '%'; } }
      if (stTab === 'compose') { // playhead on the grid while the draft plays
        const step = p.comp && !M.paused && !M.held ? p.step : -1;
        if (step !== stStep) { for (const el of document.querySelectorAll('#cpGridBox .cell.ph')) el.classList.remove('ph'); if (step >= 0) for (const el of document.querySelectorAll(`#cpGridBox .cell[data-c="${step}"]`)) el.classList.add('ph'); stStep = step; }
      }
    }
    studioRaf = requestAnimationFrame(studioLoop);
  }
  // codes are made ahead (Safari only lets a tap copy, and making one waits on compression), so a tap copies at once
  const codeCache = new Map(); const codeKey = f => JSON.stringify([f.seed, f.genre, f.flav, f.name, f.comp || 0, f.snd || 0]);
  const warmCode = f => { const k = codeKey(f); if (!codeCache.has(k)) { codeCache.set(k, null); trackCode(f).then(c => codeCache.set(k, c)); } };
  function shareTrack(f) {
    const tell = () => toast('TRACK CODE COPIED', `Send it to a friend: Music Studio › Paste a code plays ${f.name} for them`, '#ff5fa8', true, 'tip');
    const c0 = codeCache.get(codeKey(f)); if (c0) { copyText(c0, tell); return; }
    trackCode(f).then(c => { codeCache.set(codeKey(f), c); copyText(c, tell); });
  }
  function studioAction(act, b) {
    const M = SFX.music, c = M.config;
    if (act !== 'stDel') stDelArm = -1; if (act !== 'cpOver') stOverArm = false;
    switch (act) {
      case 'stTab': stTab = b.dataset.v; stPaste = false; stEdit = -1; SFX.play('ui'); openStudio(); return true;
      case 'stVibe': {
        studioTouch(); const v = ST_VIBES.find(x => x[0] === b.dataset.v); c.genres = (v[2] || M.GENRE_IDS).slice(); c.favOnly = false;
        M.apply(); studioSave(); if (M.piece && !c.genres.includes(M.piece.genre)) stPlayNow(); openStudio(); return true;
      }
      case 'stGenre': {
        studioTouch();
        const g = b.dataset.v;
        if (c.genres.includes(g)) { if (c.genres.length > 1) c.genres = c.genres.filter(x => x !== g); }
        else c.genres = c.genres.concat([g]);
        M.apply(); studioSave();
        // a newly picked genre should be heard right away
        if (c.genres.includes(g) && M.piece && M.piece.genre !== g) stPlayNow({ genre: g });
        else if (M.piece && !c.genres.includes(M.piece.genre)) stPlayNow();
        openStudio(); return true;
      }
      case 'stPlayG': { const g = b.dataset.v; stPlayNow({ genre: g }); toast('NOW PLAYING', M.GENRES[g].name, M.GENRES[g].col); return true; }
      case 'stLen': M.setLength(b.dataset.v); studioSave(); SFX.play('ui'); openStudio(); return true;
      case 'stMute': studioTouch(); c.mute[b.dataset.v] = !c.mute[b.dataset.v]; b.classList.toggle('m', !!c.mute[b.dataset.v]); M.apply(); studioSave(); return true;
      case 'stSkip': stPlayNow(); SFX.play('ui'); return true;
      case 'stBack': { const n = M.back(); if (n) stPlayNow(M.queued); if (n) toast('BACK TO', n, '#ff5fa8'); return true; }
      case 'stPause': if (stInCompose) { cpPlay(M.held); return true; } M.setPaused(!M.paused); return true;
      case 'stRepeat': M.repeat = !M.repeat; toast(M.repeat ? 'REPEAT ON' : 'REPEAT OFF', M.repeat ? 'This piece plays again when it ends' : 'A new piece follows this one', '#ff5fa8'); return true;
      case 'stKeep': {
        if (M.isSaved()) { M.unsave(); toast('REMOVED', 'Taken out of My Tracks', '#ff5fa8'); }
        else { const f = M.save(); if (f) toast('KEPT', f.name + ' · with your sound settings', '#ff5fa8'); }
        studioSave(); if (stTab === 'listen') openStudio(); return true;
      }
      case 'stPlay': { const f = c.favs[+b.dataset.v]; if (f) { stPlayNow(f); toast('NOW PLAYING', f.name, '#ff5fa8'); } return true; }
      case 'stRen': { const i = +b.dataset.v, f = c.favs[i]; if (!f) return true; askText({ title: 'Rename track', value: f.name, max: 24, ok: 'Rename', onDone: v => { v = v.trim().slice(0, 24); if (!v) return; f.name = v; const p0 = M.piece; if (p0 && p0.seed === f.seed && !f.comp === !p0.comp) M.setName(v); studioSave(); openStudio(); } }); return true; }
      case 'stDel': { const i = +b.dataset.v; if (stDelArm !== i) { stDelArm = i; openStudio(); return true; } stDelArm = -1; c.favs.splice(i, 1); if (!c.favs.length) c.favOnly = false; studioSave(); openStudio(); return true; }
      case 'stShare': { const f = c.favs[+b.dataset.v]; if (f) shareTrack(f); return true; }
      case 'stShareNow': { const t = M.track; if (t) shareTrack(t); return true; }
      case 'stPaste': pasteCode('Paste a track code', v => readTrackCode(v).then(f => {
        if (!f) { toast('TRACK CODE', /^HUNT/.test(v) ? 'That is a hunt code: Daily Hunt › Watch a code' : 'That code could not be read', '#ff4d6a', true, 'tip'); return; }
        const t = M.addTrack(f); if (t) { studioSave(); stPlayNow(t); toast('TRACK ADDED', t.name + ' · playing now', '#ff5fa8'); openStudio(); } })); return true;
      case 'stCodeGo': { const v = ($('#stCode') || {}).value || ''; readTrackCode(v).then(f => { if (!f) { toast('TRACK CODE', 'That code could not be read', '#ff4d6a', true, 'tip'); return; } const t = M.addTrack(f); if (t) { stPaste = false; studioSave(); stPlayNow(t); toast('TRACK ADDED', t.name + ' · playing now', '#ff5fa8'); openStudio(); } }); return true; }
      case 'stEditT': { const f = c.favs[+b.dataset.v]; if (f && f.comp) { c.draft = Object.assign(JSON.parse(JSON.stringify(f.comp)), { name: f.name }); stTab = 'compose'; studioSave(); M.editing = true; M.compose(c.draft); openStudio(); } return true; }
      case 'stFavOnly': studioTouch(); c.favOnly = !c.favOnly; studioSave(); if (c.favOnly) stPlayNow(); openStudio(); return true;
      case 'stReset': { const keepK = { favs: c.favs, calmBpm: c.calmBpm, draft: c.draft, composer: c.composer, length: c.length }; M.setConfig(keepK); PROF.settings.studio = M.config; studioSave(); stPlayNow(); openStudio(); return true; }
      case 'stViz': { // the hidden door: five taps on the visualizer
        if (c.composer) return true;
        const now = performance.now(); stTaps = stTaps.filter(t => now - t < 2500); stTaps.push(now);
        if (stTaps.length >= 5) { stTaps = []; c.composer = true; studioSave(); SFX.play('levelup'); toast('COMPOSER UNLOCKED', 'A new tab in the Music Studio: build your own track', '#ff5fa8', true, 'alert'); stTab = 'compose'; openStudio(); }
        return true;
      }
      // ---- composer ----
      case 'cpStart': { // a new song from a style: its beat, bassline, chords and sound, and no melody yet
        const g = b.dataset.g, f = b.dataset.f, G0 = M.GENRES[g], F = G0.flavours[f] || {};
        const n = c.favs.filter(t => t.comp).length + 1, mode = (F.modes || ['aeolian'])[0], own = (F.loops || []).find(L1 => M.loopOK(L1, mode));
        const d = { v: 1, genre: g, flav: f, seed: (Math.random() * 4294967296) >>> 0, name: 'Song ' + n, mode, key: Math.floor(Math.random() * 12), loop: JSON.parse(JSON.stringify(own || cpLoops(g, mode)[0])), mel: [], melSeed: (Math.random() * 4294967296) >>> 0 };
        cpDefaults(d); if (d.lead === 'none') d.lead = 'bell';
        c.draft = d; stGrid = 'drums'; stOverArm = false; M.editing = true; cpApply(true); return true;
      }
      case 'cpFrom': { const cp = M.compFromPiece(); if (cp) { cp.name = 'Song ' + (c.favs.filter(t => t.comp).length + 1); c.draft = cp; stGrid = 'drums'; stOverArm = false; M.editing = true; cpApply(true); } return true; }
      case 'cpOver': { if (!stOverArm) { stOverArm = true; openStudio(); return true; } stOverArm = false; c.draft = null; studioSave(); M.setHold(true); openStudio(); return true; }
      case 'cpDrumClr': { const d = c.draft; if (d) { for (const k in d.drums) d.drums[k] = '0'.repeat(16); cpApply('grid'); } return true; }
      case 'cpRename': { const d = c.draft; if (d) askText({ title: 'Name your song', value: d.name, max: 24, ok: 'Rename', onDone: v => { v = v.trim().slice(0, 24); if (v) { d.name = v; studioSave(); if (M.piece && M.piece.comp) M.setName(v); openStudio(); } } }); return true; }
      case 'cpSave': { const d = c.draft; if (!d) return true; M.saveComp(d); studioSave(); toast('SAVED TO MY TRACKS', d.name, '#ff5fa8'); return true; }
      case 'cpGrid': stGrid = b.dataset.v; openStudio(); return true;
      case 'cpStep': {
        const d = c.draft; if (!d) return true; const k = b.dataset.k, dir = +b.dataset.v, wrap = (i, n) => ((i % n) + n) % n;
        if (k === 'style') { const L0 = cpStyles(), i = L0.findIndex(x => x[0] === d.genre && x[1] === d.flav), nx = L0[wrap(i + dir, L0.length)]; d.genre = nx[0]; d.flav = nx[1]; cpDefaults(d); const lp0 = cpLoops(d.genre, d.mode); if (cpLoopIdx(lp0, d) < 0) d.loop = JSON.parse(JSON.stringify(lp0[0])); }
        else if (k === 'mood') { const i = M.MOODS.findIndex(m => m[0] === d.mode); d.mode = M.MOODS[wrap(i + dir, M.MOODS.length)][0]; { const L0 = cpLoops(d.genre, d.mode); if (cpLoopIdx(L0, d) < 0) d.loop = JSON.parse(JSON.stringify(L0[0])); } }
        else if (k === 'key') d.key = wrap((d.key | 0) + dir, 12);
        else if (k === 'bpm') { const G0 = M.GENRES[d.genre]; d.bpm = clamp((d.bpm | 0) + dir * 2, Math.round(G0.bpm[0] * 0.8), Math.round(G0.bpm[2] * 1.15)); }
        else if (k === 'loop') { const L0 = cpLoops(d.genre, d.mode), i = cpLoopIdx(L0, d); d.loop = JSON.parse(JSON.stringify(L0[wrap(i + dir, L0.length)])); }
        else if (k === 'bass') { const i = M.BASSES.findIndex(x => d.bass && x[0] === d.bass[0] && x[1] === d.bass[1]); const nx = M.BASSES[wrap(i + dir, M.BASSES.length)]; d.bass = [nx[0], nx[1]]; }
        else if (k === 'lead') { const i = M.LEADS.findIndex(x => x[0] === d.lead); d.lead = M.LEADS[wrap(i + dir, M.LEADS.length)][0]; }
        SFX.play('ui'); cpApply(true); return true;
      }
      case 'cpCell': { const d = c.draft; if (!d) return true; const r = b.dataset.r, i = +b.dataset.i, row = (d.drums[r] || '0'.repeat(16)).padEnd(16, '0').split(''); const def = (M.DRUM_ROWS.find(x => x[0] === r) || [0, 0, 8])[2]; row[i] = +row[i] ? '0' : String(def); d.drums[r] = row.join(''); cpApply('grid'); return true; }
      case 'cpDrumReset': { const d = c.draft; if (d) { d.drums = M.drumsFor(d.genre, d.flav); cpApply('grid'); } return true; }
      case 'cpNote': {
        const d = c.draft; if (!d) return true; const r = +b.dataset.r, i = +b.dataset.i;
        if (!d.mel || d.mel.length !== 16) { const gh = d.mel === null ? cpAutoMel() : null; d.mel = gh ? gh.slice() : Array(16).fill(null); if (d.lead === 'none') d.lead = 'bell'; }
        d.mel[i] = d.mel[i] === r ? null : r;
        if (!d.mel.some(x => x !== null)) d.mel = [];
        cpApply(true); return true;
      }
      case 'cpMelAbs': { const d = c.draft; if (d) { d.melAbs = !d.melAbs; if (d.melAbs && !(d.mel && d.mel.length === 16)) d.mel = cpRollFixed(); cpApply(true); } return true; }
      case 'cpDice': { const d = c.draft; if (d && d.melAbs) { d.mel = cpRollFixed(); if (d.lead === 'none') d.lead = 'bell'; SFX.play('ui'); cpApply(true); return true; } if (d) { d.mel = null; d.melSeed = (Math.random() * 4294967296) >>> 0; if (d.lead === 'none') d.lead = 'bell'; SFX.play('ui'); cpApply(true); } return true; }
      case 'cpMelClr': { const d = c.draft; if (d) { d.mel = []; cpApply(true); } return true; }
      case 'stClose': { cancelAnimationFrame(studioRaf); if (stInCompose) { stInCompose = false; leaveCompose(); } M.editing = false; const back = studioBack; studioBack = null; stEdit = -1; stPaste = false; closeModal();
        if (M.paused) toast('MUSIC PAUSED', 'Press play in the Music Studio to bring it back', '#ff5fa8');
        if (back === 'settings') { if (G && !G.over && screen === 'game') modalFrom = 'pause'; openSettings(); }
        else if (back === 'pause' && G && !G.over && screen === 'game') openPause();
        else if (G && !G.over && screen === 'game') G.paused = false;
        return true; }
    }
    return false;
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
      ['Mouse & keys', 'Click to tap, drag (any button) to pan, wheel to zoom, right-click to close a panel or cancel an aim. Keys: WASD or arrows pan, + and − zoom, F map/fit, N next wave, T talents, U upgrade the open tower, Z X C V B abilities, Space pause, 1–3 speed, Esc close.'],
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
      ['Veterans', 'Towers rank up from kills. When one has a mutation to pick, a "veterans ready" chip appears at the top: tap it to jump there.'],
      ['Ascend', 'Max-level towers can Ascend for ×1.3 Damage.'],
      ['Entropy', 'Fills as you fight. When full, draw an Anomaly or Stabilize.'],
      ['Storms', 'Boost one element. Storms merge; 3 types form a Maelstrom.'],
      ['Wormholes', 'New lanes open from wormholes anywhere around the core. Warned 2 waves ahead.'],
      ['Skimmers', 'Fly straight at the core. Pink lines show their route.'],
      ['Abilities', 'The left rail. Each ability comes online at its wave and recharges on its own timer (the bar under it fills). Crates, chests, bosses and milestones add extra charges on top, with no cap. Command talents and the core\'s Command Uplink cut cooldowns and add charge slots.'],
      ['Sensor Sweep', `Scan: reveals cloaked enemies for ${SCAN.dur}s, Marks everything it sweeps (+${SCAN.mark}% damage taken) and flags the biggest threat with a reticle. Short cooldown.`],
      ['Know your enemy', 'Tap (or hover) any enemy to see its HP, what it does and what beats it. Each wave leans on a headline enemy, shown as an amber chip. New enemies are announced the wave before they land.'],
      ['Command Uplink', `A core upgrade line: −${UPLINK.cd}% ability cooldowns per level. ${UPLINK.mods.map(m => `LV ${m.lv} ${m.name}: ${m.desc}`).join('. ')}.`],
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
      ['XP', 'Score converts to XP. Each level grants 1 talent point.'],
      ['Talents', 'Seven trees of permanent bonuses. Each row opens after 5 points in its tree; 20 points reach its Capstones, play styles you pick one of. You hold 1 Capstone, 2 from Level 50, 3 from Level 100. Changes are free between runs and at checkpoints; mid-run they cost Recalibration tokens.'],
      ['Capstones', 'Each tree ends in three play styles, for example Marksman (few huge guns), Wildfire (the road burns), War Economy (banked credits arm the core), Glass Cannon or Conflagration. Each changes how a run plays, often with a cost on the field.'],
      ['Recalibration', 'Tokens from boss kills, Stabilize and pirate crates. Spend one to reroll a tower\'s affixes, or to refund a talent mid-run (2 for a Capstone).'],
      ['Builds', 'Save up to five talent layouts and load one between runs (2 tokens mid-run).'],
      ['Supernova', 'Hold 2 Capstones and reach the required level to collapse your galaxy. You lose your level and talents. You keep one Capstone as a Remnant (always on, no slot), gain a Cosmic Law, and earn more score and XP from then on.'],
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
        ['Milestone', 'Score threshold. Grants an extra ability charge and a small bonus.'], ['Conditions', 'In a tower\'s panel: every live modifier on it (storms, events, Frenzy, outages) with numbers.'], ['Headline', 'The enemy a wave leans on. Amber chip in the top bar; tap it for what beats it.'], ['IDLE', 'Tag on a tower that hasn\'t fired for three waves. Move it to where the enemies are.'], ['Entropy', 'Gauge that fills as you fight. Full: draw an Anomaly.'],
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
        ['Bounty Purse', `${Math.round(PURSE.safe * 100)}% of the XP you earn banks at once; the rest rides in the purse. Each bounty claimed grows it ×${PURSE.bounty}, and each push through a jump door multiplies it again (×${DOOR_TIERS.map(t => t.mult).join(', ×')} by risk). Extract to bank all of it. If your core falls you keep ${Math.round(PURSE.death * 100)}%.`],
        ['Zone', 'The contract a run is fought under: which enemies come most, the weather, the events, the Most Wanted boss, plus a perk and a drawback. You pick one of three at the start, and a new one through a jump door at every bounty.'],
        ['Jump door', 'After a bounty you can push on through one of three doors: a new zone for the next 20 waves at a risk tier (Steady, Hot or Deadly). Riskier doors grow the Bounty Purse more and pay more score.'],
        ['Escalation', `From Wave ${TWIST_FROM}, each boss wave makes you choose one of two permanent twists. They stack and each one raises your score and XP.`],
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
      { id: 'enemy', name: 'Enemies', rows: Object.entries(ENEMIES).map(([k, E]) => [E.name, `${esc(E.desc)}. <em>Beat it: ${esc(E.beat || '')}${E.from < 999 ? ` · from Wave ${E.from}` : ''}</em>`, '#ff8a9c', k]) },
      { id: 'genes', name: 'Evolution', rows: GENE_IDS.map(g => [GENES[g].name, `${GENES[g].desc}. Counter: ${GENES[g].counter}.`, GENES[g].col]) },
      { id: 'elite', name: 'Elite Affixes', rows: ELITE_AFFIXES.map(E => [E.name, E.desc + '.', E.col]) },
      { id: 'boss', name: 'Bosses', rows: BOSSES.map(B => [B.name, B.desc + '.', '#ff4d6a']) },
      { id: 'storm', name: 'Storms', rows: [...Object.values(STORMS).map(S => [S.name, S.desc + '.', S.col]),
        ...Object.entries(COMBO_STORMS).map(([k, n]) => [n, 'Merged storm: ' + k.split('+').map(x => STORMS[x].name).join(' + ') + '. Both effects.']),
        ['Maelstrom', 'Forms when storms of 3 types merge. +75% Damage inside. Collapses after 30s.', '#ff4d6a'] ] },
      { id: 'event', name: 'Events', rows: EVENTS.map(E => [E.name, E.desc + '.', E.good ? '#59f0b4' : '#ff8a9c']) },
      { id: 'laws', name: 'Cosmic Laws', rows: LAWS.map(L => [L.name, `${esc(L.up)}. <span class="bad">Cost: ${esc(L.down)}.</span>`, '#ff9adf']) },
      { id: 'anom', name: 'Anomalies', rows: ANOMALIES.map(A => [A.name, `${A.up}. <span class="bad">Cost: ${esc(A.down)}.</span>`, '#d6a6ff']) },
      { id: 'talent', name: 'Talents', rows: TALENTS.flatMap(tr => tr.rows.flat().map(T => [T.name, `${talentLines(T, T.max).join('. ')}. <em>${esc(tr.name)} · ${T.max > 1 ? 'at ' + T.max + ' ranks' : 'one rank'}</em>`, tr.col])) },
      { id: 'cap', name: 'Capstones', rows: TALENTS.flatMap(tr => tr.caps.map(T => [T.name, `${talentLines(T).join('. ')}. <em>${esc(tr.name)} Capstone</em>`, tr.col])) },
      { id: 'abil', name: 'Abilities', rows: ABIL_ORDER.map(k => [ABILITIES[k].name, ABILITIES[k].desc, PAL.warn]) },
      { id: 'tower', name: 'Towers', rows: TOWER_ORDER.map(k => { const D = TOWERS[k]; return [D.name, `${D.blurb} <em>${EL[D.el].name} · Unlocks at Wave ${D.unlock}</em>`, EL[D.el].col]; }) },
    ];
  }
  function dictHTML() {
    const cats = dictData(), q = dictQ.trim().toLowerCase();
    const strip = h => h.replace(/<[^>]+>/g, '');
    const row = r => `<b style="--c:${r[2] || ''}">${r[3] ? `<canvas class="dico" width="22" height="22" data-eico="${r[3]}"></canvas>` : ''}${esc(r[0])}</b><span>${r[1].includes('<') ? r[1] : esc(r[1])}</span>`;
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
    for (const cv of document.querySelectorAll('#modal canvas[data-eico]')) Render.enemyIcon(cv.dataset.eico, cv);
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
    const F = novaFlow, nv = PROF.nova || 0, ready = novaReady(), done = capsHeld();
    const rems = done.filter(r => !PROF.remnants.includes(r));
    const head = `<div class="ch"><h2>Supernova${nv ? ' ' + roman(nv + 1) : ''}</h2><button class="x" data-act="close">✕</button></div>`;
    let body = '';
    if (F.step === 0) {
      const lawsHave = PROF.laws.map(id => LAWS.find(L => L.id === id)).filter(Boolean);
      body = `<p class="note">Collapse your galaxy and start a new one. It's harder, it's stranger, and it's worth more.</p>
        <div class="nkeep"><div class="lose"><b>Reset</b>Level and XP<br>Talents and Capstones</div>
        <div class="keep"><b>Keep and gain</b>One Remnant: a Capstone you hold, active forever without a slot or points<br>One Cosmic Law: +${Math.round(LAW_SCORE * 100)}% score, changes the rules<br>+${Math.round(NOVA_SCORE * 100)}% score and +${Math.round(NOVA_XP * 100)}% XP per Supernova</div></div>
        ${PROF.remnants.length ? `<div class="lbl">Your Remnants</div><p class="note">${PROF.remnants.map(r => esc(TAL[r] ? TAL[r].name : 'Old web: ' + (TALENTS[+r.slice(1)] || {}).name)).join(' · ')}</p>` : ''}
        ${lawsHave.length ? `<div class="lbl">Your Laws</div><p class="note">${lawsHave.map(L => esc(L.name)).join(' · ')}</p>` : ''}
        <div class="lbl">Requirements</div><p class="note">${done.length >= 2 ? '✓' : '✗'} 2 Capstones (${done.length}) · ${profLevel().level >= novaLevelReq(nv) ? '✓' : '✗'} Level ${novaLevelReq(nv)} · ${PROF.runSnap ? '✗ Finish or abandon your saved run' : '✓ No run in progress'}</p>
        <div class="ta"><button class="btn primary" data-act="novaNext" ${ready ? '' : 'disabled'}>${ready ? 'Begin' : 'Not ready yet'}</button></div>`;
    } else if (F.step === 1) {
      body = `<div class="lbl">Choose a Remnant</div><p class="note">It stays active in every galaxy from now on, without a Capstone slot or points.</p>
        <div class="ncards">${rems.length ? rems.map(r => { const T = TAL[r], tr = TREE_BY_ID[T.tree]; return `<button class="ncard ${F.remnant === r ? 'on' : ''}" style="--c:${tr.col}" data-act="novaR" data-v="${r}"><b>${esc(T.name)}</b><small>${esc(tr.name)}</small>${talentLines(T).map(l => `<span>${esc(l)}</span>`).join('')}</button>`; }).join('') : '<p class="note">Every Capstone you hold is already a Remnant.</p>'}</div>
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
    const ks = activeCaps().map(id => TAL[id].name);
    const hrs = Math.floor(PROF.playTime / 3600), mins = Math.floor(PROF.playTime / 60) % 60;
    modal(`<div class="card"><div class="ch"><h2>Archive</h2><button class="x" data-act="close2">✕</button></div>
      <div class="setup-grid"><div class="col"><div class="lbl">Arsenal</div>${rows}</div>
      <div class="col">${hallHTML()}<div class="lbl">Record</div>
        <div class="bigstats two"><span>Runs<b>${PROF.runs}</b></span><span>Best Wave<b>${PROF.bestWave || '—'}</b></span><span>Best Score<b>${PROF.bestScore ? fmt(PROF.bestScore) : '—'}</b></span><span>Kills<b>${fmt(PROF.kills)}</b></span><span>Time Played<b>${hrs}h ${mins}m</b></span><span>Level<b>${profLevel().level}</b></span></div>
        <div class="lbl">Capstones</div><p class="note">${ks.length ? ks.map(esc).join(' · ') : 'None yet'}</p>
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
    if (act.startsWith('st') || act.startsWith('cp')) { try { if (studioAction(act, b)) return; } catch (e) { SFX.report(e, 'studio ' + act); toast('STUDIO ERROR', String(e && e.message || e).slice(0, 90) + ' · tell Claude', '#ff4d6a', true); return; } }
    SFX.play('ui');
    switch (act) {
      case 'close': closeModal(); break;
      case 'brief': closeModal(); if (G) { G.paused = false; G.briefing = false; } break;
      case 'evoR': closeModal(); if (G) G.paused = false; openThreat(); break;
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
      case 'chLock': SFX.play('deny'); toast(CHAOS_LEVELS[+b.dataset.v].name.toUpperCase(), `Opens when you extract once on ${CHAOS_LEVELS[+b.dataset.v - 1].name}, or reach Wave ${CHAOS_GATE[+b.dataset.v]}`, '#8a8fa8', true, 'tip'); break;
      case 'reroll': rerollMap(); renderSetup(); break;
      case 'sector': setup.sector = b.dataset.v; renderSetup(); break;
      case 'launch': launch(); break;
      case 'launchDaily': { // v5.4.1: unspent Hunt points are asked about before the run starts (the build locks once it does)
        const hb = huntBuildProf(); let sp = 0; for (const k in hb.tal) if (TAL[k]) sp += hb.tal[k]; sp += (hb.caps || []).filter(c => TAL[c]).length;
        const left = HUNT.pts - sp;
        if (left > 0 && b.dataset.v !== 'anyway') {
          SFX.play('ui');
          modal(`<div class="card narrow"><div class="ch"><h2>Unspent Points</h2><span class="note">Daily Hunt</span></div>
            <p>${left === HUNT.pts ? `Your Hunt build is empty: all ${HUNT.pts} talent points are waiting.` : `${left} of your ${HUNT.pts} Hunt talent points ${left === 1 ? 'is' : 'are'} unspent.`} The build locks when the run starts.</p>
            <div class="foot"><button class="btn" data-act="launchDaily" data-v="anyway">Start anyway</button><button class="btn primary" data-act="huntBuild">Spend them</button></div></div>`, 'confirm');
          break;
        }
        launch(); break; }
      case 'mode': setup.mode = b.dataset.v; if (setup.mode === 'std') rerollMap(); renderSetup(); break;
      case 'resume': closeModal(); G.paused = false; break;
      case 'help': if (modalOpen === 'pause') modalFrom = 'pause'; openHelp(); break;
      case 'htab': openHelp(b.dataset.v); break;
      case 'dcat': dictCat = b.dataset.v; openHelp(); break;
      case 'settings': if (modalOpen === 'pause') modalFrom = 'pause'; openSettings(); break;
      case 'studio': openStudio('pause'); break;
      case 'studioS': openStudio('settings'); break;
      case 'exit': G.paused = false; snapshotNow(); Save.save(); G = null; closeModal(); show('hangar'); renderHangar(); SFX.music.setIntensity(0.15); break;
      case 'abandon': if (!confirmAbandon) { confirmAbandon = true; openPause(); return; } closeModal(); window.act('abandon'); break;
      case 'vpick': { const rd = vetsReady(), t = rd[vetFlow.ix]; if (!t || !window.act('vet', t.x, t.y, +b.dataset.v)) { SFX.play('deny'); break; } SFX.play('upgrade'); vetFlow.n++; if (!(t.pending > 0)) { const nr = vetsReady(), j = nr.indexOf(t); vetFlow.ix = j >= 0 ? j : vetFlow.ix; } openVets(); break; }
      case 'vetSkip': vetFlow.ix++; openVets(); break;
      case 'vetMap': { const t = vetsReady()[vetFlow.ix]; closeModal(); G.paused = false; vetFlow.n = 0; if (t) showOnMap(t); break; }
      case 'vetDone': closeModal(); if (G && !G.over) G.paused = false; vetFlow.n = 0; break;
      case 'extract': closeModal(); window.act('extract'); break;
      case 'push': closeModal(); if (window.act('push')) { G.paused = false; SFX.play('levelup'); } break;
      case 'door': closeModal(); if (window.act('push', +b.dataset.v)) { G.paused = false; SFX.play('levelup'); } break;
      case 'huntBuild': closeModal(); Tree.open('hunt'); break;
      case 'huntWatch': { const d = PROF.daily; if (d && d.rec) watchRun(d.rec, `Your Daily Hunt · ${d.date}`); break; }
      case 'huntCode': { const d = PROF.daily, tell = () => toast('HUNT CODE COPIED', 'Paste it to a friend: they can watch your exact run', '#59f0b4', true, 'tip'); if (huntCodeCache) copyText(huntCodeCache, tell); else if (d && d.rec) huntCode(d.rec).then(c => { huntCodeCache = c; copyText(c, tell); }); break; }
      case 'huntPaste': pasteCode('Paste a hunt code', v => readHuntCode(v).then(rec => { if (!rec) { toast('HUNT CODE', /^TRACK/.test(v) ? 'That is a track code: Music Studio › Paste a code' : 'That code could not be read', '#ff4d6a', true, 'tip'); return; } watchRun(rec, `Hunt code · ${rec.opts && rec.opts.daily ? rec.opts.daily.date : ''}`); })); break;
      case 'huntPasteGo': { const v = ($('#huntIn') || {}).value || ''; readHuntCode(v).then(rec => { if (!rec) { toast('HUNT CODE', 'That code could not be read', '#ff4d6a', true, 'tip'); return; } watchRun(rec, `Hunt code · ${rec.opts && rec.opts.daily ? rec.opts.daily.date : ''}`); }); break; }
      case 'watchEnd': endWatch(); break;
      case 'boon': { const o = G.draft && G.draft[+b.dataset.v]; if (!o) { closeModal(); break; } window.act('boon', +b.dataset.v); closeModal(); if (!o.twist) toast('BOON', o.name, '#59f0b4'); renderPanel(); break; }
      case 'anom': { window.act('anom', b.dataset.v); closeModal(); G.paused = false; const A = ANOMALIES.find(a => a.id === b.dataset.v); toast('ANOMALY', A.name, '#b86cff'); Render.fx('nova', {}); renderPanel(); Save.save(); break; }
      case 'stab': { window.act('stab'); closeModal(); G.paused = false; toast('STABILIZED', `Score multiplier ×${G.scoreMult.toFixed(2)}`, '#59f0b4'); break; }
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
          SFX.setVolumes(PROF.settings.sfx, PROF.settings.music); SFX.setMono(!!PROF.settings.mono);
  SFX.setSoundtrack(PROF.settings.soundtrack || 'ec'); SFX.music.setConfig(PROF.settings.studio); PROF.settings.studio = SFX.music.config; SFX.music.setBaseBpm(PROF.settings.bpm || 72);
          toast('SAVE IMPORTED', `Level ${profLevel().level} · Best Wave ${PROF.bestWave || 0}`, '#59f0b4');
        } catch (e) { toast('INVALID CODE', 'Make sure the full code was pasted', '#ff4d6a', 1); }
        break;
      }
      case 'hud': PROF.settings.hud = b.dataset.v; Save.save(); openSettings(); break;
      case 'uis': PROF.settings.uiScale = b.dataset.v === 'auto' ? 'auto' : +b.dataset.v; Save.save(); UI.fitVV(); openSettings(); break;
      case 'gfx': PROF.settings[b.dataset.k] = b.dataset.v === '1'; Render.glow = PROF.settings.glow !== false; Render.sharp = PROF.settings.sharp !== false; Save.save(); openSettings(); break;
      case 'autoslow': PROF.settings.autoSlow = b.dataset.v === '1'; Save.save(); openSettings(); break;
      case 'haptic': PROF.settings.haptics = b.dataset.v === '1'; Save.save(); if (PROF.settings.haptics) Haptics.tap(true); openSettings(); break;
      case 'briefs': PROF.settings.briefings = b.dataset.v; Save.save(); openSettings(); break;
      case 'notes': PROF.settings.notes = b.dataset.v; Save.save(); renderFeed(); openSettings(); break;
      case 'nums': PROF.settings.dmgNums = !PROF.settings.dmgNums; Render.nums = PROF.settings.dmgNums; Save.save(); openSettings(); break;
      case 'sndFix': { // v5.5.4: wake the audio, clear any pause or hold, start a fresh piece now
        SFX.init(); SFX.wake(); const M = SFX.music; M.setPaused(false); if (modalOpen !== 'studio') M.setHold(false); M.jump(null);
        setTimeout(() => { const el = $('#sndStat'); if (el) el.textContent = soundStatus(); }, 700);
        toast('SOUND RESTARTED', soundStatus(), '#59f0b4'); break; }
      case 'mono': PROF.settings.mono = !PROF.settings.mono; SFX.setMono(PROF.settings.mono); Save.save(); openSettings(); break;
      case 'shake': PROF.settings.shake = !PROF.settings.shake; Render.shakeOn = PROF.settings.shake; Save.save(); openSettings(); break;
      case 'wipe': if (!confirmReset) { confirmReset = true; openSettings(); return; } PROF = defaultProfile(); Save.save(); closeModal(); renderHangar(); toast('PROGRESS RESET', 'All progress erased', '#ff4d6a'); break;
    }
  }

  // ---------- wiring ----------
  function wire() {
    $('#panel').addEventListener('pointerdown', () => { panelHeld = true; });
    const panelLift = () => { if (!panelHeld) return; panelHeld = false; if (panelDirty) setTimeout(() => { if (panelDirty && !panelHeld) renderPanel(); }, 30); };
    window.addEventListener('pointerup', panelLift, true); window.addEventListener('pointercancel', panelLift, true);
    $('#panel').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && !b.disabled) panelAction(b.dataset.act, b); });
    $('#modal').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && !b.disabled) modalAction(b.dataset.act, b); });
    const cv = $('#cv');
    cv.addEventListener('pointerdown', canvasDown);
    cv.addEventListener('pointermove', canvasMove);
    cv.addEventListener('pointerup', canvasUp);
    cv.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); if (!ptrs.size) gesture = null; });
    cv.addEventListener('wheel', canvasWheel, { passive: false });
    $('#bZoom').onclick = () => { SFX.play('ui'); if (Render.home && Render.homeZoom > 1.05) Render.overview(); else Render.resetCam(); updateZoomBtn(); };
    $('#bCall').onclick = () => { SFX.init(); if (G && G.checkpoint) { const B = window.act('cpResume', G.cpT); if (B && B.cr) toast('SPEED BONUS', `+${fmt(B.cr)} credits · +${fmt(B.sc)} score`, '#59f0b4'); updateHud(); return; } const v = window.act('call'); if (v) toast('WAVE CALLED', `+${fmt(v)} credits`, '#ffb03a'); updateHud(); };
    $('#asbar').onclick = () => { SFX.play('ui'); openThreat(); };
    $('#ticker').onclick = e => { if (!e.target.closest('.tkb')) return; SFX.play('ui'); clearTimeout(tickT); $('#ticker').hidden = true; toastBusy = false; toastNQ.length = 0; openReport(); };
    $('#chips').addEventListener('click', e => { if (e.target.closest('[data-more]')) { SFX.play('ui'); openReport(); return; } if (e.target.closest('[data-threat]') || e.target.closest('[data-evo]')) { SFX.play('ui'); openThreat(); return; } if (e.target.closest('[data-wanted]')) { SFX.play('ui'); wantedPoster(); return; } if (e.target.closest('[data-ready]')) { SFX.play('ui'); vetFlow.ix = 0; openVets(); return; } const sc = e.target.closest('[data-storm]'); if (sc) { const st = G.storms.find(x => x.id === +sc.dataset.storm); if (st) { const I = stormInfo(st); SFX.play('ui'); toast(stormName(st).toUpperCase(), `${I.fx.join(' · ')}. ${I.n ? `${I.n} of your towers inside, ${I.boosted} boosted (outlined)` : 'None of your towers inside'}`, st.mael ? '#ff4d6a' : STORMS[st.types[0]].col, true, 'tip'); } return; } const h = e.target.closest('[data-ehead]'); if (h) { const D = ENEMIES[h.dataset.ehead]; SFX.play('ui'); toast('HEADLINE · ' + D.name.toUpperCase(), `${D.desc}. Beat it: ${D.beat}`, '#ffb03a', true, 'tip'); return; } const c = e.target.closest('[data-gene]'); if (!c) return; const g = GENES[c.dataset.gene]; SFX.play('ui'); toast(g.name.toUpperCase(), `${g.desc} · counter: ${g.counter}`, g.col, true); });
    $('#pw').parentNode.onclick = () => {
      if (!G || G.over) return; SFX.play('ui');
      const free = gridFree(), T = topTower();
      if (free >= 1 && T && canOvercharge(T) && (T.oc || 0) < ocMax()) {
        const n = Math.min(ocMax(), (T.oc || 0) + free);
        if (window.act('oc', T.x, T.y, n)) { openTower(T); toast('OVERCHARGED', `${TOWERS[T.type].name}${T.name ? ` "${T.name}"` : ''} +${n}: spare power put to work. Change it any time in the tower panel`, '#59f0b4'); updateHud(); return; }
      }
      if (free >= 1) toast('SPARE POWER', `${free} unused. Tap a tower and raise its Overcharge: +${Math.round(OVERCHARGE.dmg * 100)}% Damage per point`, '#59f0b4');
      else toast('POWER', `Every tower draws 1 power; Overcharge draws more. Capacity grows 1 every ${GRID.perWaves} waves, or expand the reactor from the core panel`, '#59f0b4');
    };
    $('#bCash').onclick = () => { SFX.play('ui'); if (!G || G.over) return; if (marketShut()) { toast('EXCHANGE', 'The Black Market and Cash In open at Wave 10. Score comes from kills', '#8a8fa8', true, 'tip'); return; } if (panel && panel.kind === 'cash') closePanel(); else { closePanel(); openPanel({ kind: 'cash', x: 0, y: 0 }); } updateHud(); };
    // v5.5.14 music: the rail tile opens a deck (back · song · next). Back: one tap replays the song, a double tap goes to the
    // last one (the single tap waits TRK_DBL to see whether a second follows). The deck tucks away after a few idle seconds.
    let trkBackT = 0, trkBackTimer = 0, deckT = 0; const TRK_DBL = 350;
    const deckFill = () => { const M = SFX.music, p = M.piece, d = $('#mdeck'); if (!d || !p) return; const col = (M.GENRES[p.genre] || {}).col || '#59f0b4';
      d.style.setProperty('--mc', col); d.querySelector('.mdname b').textContent = p.name; d.querySelector('.mdname span').textContent = `${p.genreName} · ${p.section}${M.paused ? ' · paused' : ''}`; };
    const deckShow = on => { const d = $('#mdeck'); d.hidden = !on; $('#bMusic').classList.toggle('on', on); clearTimeout(deckT); if (on) { deckFill(); deckT = setTimeout(() => deckShow(false), 5000); } };
    UI.deckFill = deckFill;
    $('#bMusic').onclick = () => { SFX.init(); SFX.play('ui'); deckShow($('#mdeck').hidden); };
    $('#mdName').onclick = () => { deckShow(false); openStudio(); };
    $('#bTrkNext').onclick = () => { SFX.init(); const M = SFX.music; M.setPaused(false); M.jump(null); deckShow(true); setTimeout(deckFill, 60); };
    $('#bTrkBack').onclick = () => {
      SFX.init(); const M = SFX.music, now = performance.now(); deckShow(true);
      if (now - trkBackT < TRK_DBL) { clearTimeout(trkBackTimer); trkBackT = 0; if (M.back()) { M.setPaused(false); M.jump(M.queued); setTimeout(deckFill, 60); } else toast('NO EARLIER SONG', 'This is the first song this session', '#ff5fa8'); return; }
      trkBackT = now; trkBackTimer = setTimeout(() => { trkBackT = 0; M.setPaused(false); M.restart(); setTimeout(deckFill, 60); }, TRK_DBL);
    };
    $('#stage').addEventListener('pointerdown', e => { if (!$('#mdeck').hidden && !e.target.closest('#mdeck')) deckShow(false); }, true); // a tap on the field puts it away
    $('#bSpeed').onclick = () => { SFX.play('ui'); G.speed = G.speed >= 3 ? 1 : G.speed + 1; G.speedWas = 0; updateHud(); };
    $('#bStats').onclick = () => { SFX.play('ui'); hudFull = !hudFull; Render.full = hudFull; document.body.classList.toggle('hudfull', hudFull); updateHud(); };
    $('#bWeb').onclick = () => { SFX.play('ui'); Tree.open(); };
    $('#bPause').onclick = () => { SFX.play('ui'); openPause(); };
    $('#bEnt').onclick = () => { SFX.play('ui'); if (G && G.anomOffers) openAnomaly(); else toast('ENTROPY', 'Fills from kills, combos and waves. Draw an Anomaly when full.', '#b86cff'); };
    $('#abils').addEventListener('click', e => {
      if (e.target.closest('#bOD')) { overdriveTap(); return; }
      const b = e.target.closest('[data-abil]'); if (!b || b.disabled || !G) return;
      const k = b.dataset.abil;
      if (!abilOnline(k)) { SFX.play('deny'); toast(ABILITIES[k].name.toUpperCase(), `Comes online at Wave ${ABILITIES[k].from}. ${ABILITIES[k].desc}`, '#8a8fa8', true, 'tip'); return; }
      if (!(G.charges[k] > 0)) { SFX.play('deny'); toast(ABILITIES[k].name.toUpperCase(), `Recharging · ${Math.ceil(G.abilCd[k] || 0)}s. Upgrade the core's Command Uplink or take Command talents for faster cooldowns`, '#8a8fa8', true, 'tip'); return; }
      if (ABILITIES[k].target) { G.aimAbility = G.aimAbility === k ? null : k; if (G.aimAbility) { toast('ORBITAL STRIKE', 'Tap a target', '#ffb03a'); closePanel(); } }
      else window.act('abil', k);
      updateHud();
    });
    $('#bLaunch').onclick = () => { SFX.init(); SFX.play('ui'); if (PROF.runSnap && PROF.runSnap.rec) { modal(`<div class="card narrow"><div class="ch"><h2>Daily Hunt</h2></div><p class="note">Restoring your run exactly where you left it…</p></div>`, 'wait'); setTimeout(() => launch(PROF.runSnap), 80); } else if (PROF.runSnap) launch(PROF.runSnap); else openSetup(); };
    $('#watchbar').addEventListener('click', e => { if (e.target.closest('[data-act=watchEnd]')) { SFX.play('ui'); endWatch(); } });
    $('#hHunt').addEventListener('click', e => { const b = e.target.closest('[data-hact]'); if (!b) return; SFX.init(); SFX.play('ui'); if (b.dataset.hact === 'daily') { if (PROF.runSnap) { toast('RUN IN PROGRESS', 'Finish or end your current run first', '#ffb03a', true, 'tip'); return; } openSetup(); setup.mode = 'daily'; renderSetup(); } });
    $('#bLaunch2').onclick = () => { SFX.init(); SFX.play('ui'); openSetup(); };
    $('#bWebH').onclick = () => { SFX.init(); SFX.play('ui'); Tree.open(); };
    $('#bNova').onclick = () => { SFX.init(); SFX.play('ui'); novaFlow = { step: 0 }; openNova(); };
    $('#bArchive').onclick = () => { SFX.init(); SFX.play('ui'); openArchive(); };
    $('#bSettings').onclick = () => { SFX.init(); SFX.play('ui'); openSettings(); };
    $('#bHelp').onclick = () => { SFX.init(); SFX.play('ui'); openHelp(); };
    $('#bStudio').onclick = () => { SFX.init(); SFX.play('ui'); openStudio('hangar'); };
    $('#bRotate').onclick = () => document.body.classList.add('portrait-ok');
    document.addEventListener('pointerdown', () => SFX.init(), { once: true });
    document.addEventListener('gesturestart', e => e.preventDefault());
    document.addEventListener('dblclick', e => e.preventDefault());
    // size to the visible viewport so browser toolbars never crop the bottom rail
    const fitVV = () => {
      if (entryOpen) return; // the typing panel handles the keyboard; the game keeps its size underneath
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
      if (e.key >= '1' && e.key <= '3') { G.speed = +e.key; G.speedWas = 0; updateHud(); }
      if (e.key === 'Escape') { if (G.aimAbility) mouseCancel(); else closePanel(); }
      // v5.0.1 keyboard for mouse players: pan, zoom, map, next wave, talents, upgrade, abilities
      if (modalOpen || Tree.isOpen || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase(), P = 70;
      const pan = { arrowleft: [P, 0], a: [P, 0], arrowright: [-P, 0], d: [-P, 0], arrowup: [0, P], w: [0, P], arrowdown: [0, -P], s: [0, -P] }[k];
      if (pan) { e.preventDefault(); Render.panBy(pan[0], pan[1]); updateZoomBtn(); return; }
      const L = Render.layout;
      if (k === '=' || k === '+') { Render.zoomAt(L.W / 2, L.H / 2, 1.2); updateZoomBtn(); return; }
      if (k === '-' || k === '_') { Render.zoomAt(L.W / 2, L.H / 2, 1 / 1.2); updateZoomBtn(); return; }
      if (k === 'f') { $('#bZoom').hidden ? Render.overview() : $('#bZoom').click(); updateZoomBtn(); return; }
      if (k === 'n') { $('#bCall').click(); return; }
      if (k === 't') { SFX.play('ui'); Tree.open(); return; }
      if (k === 'u' && panel && panel.kind === 'tower') { const b = $('#panel [data-act=up]'); if (b && !b.disabled) b.click(); else SFX.play('deny'); return; }
      const ab = { z: 0, x: 1, c: 2, v: 3, b: 4 }[k];
      if (ab !== undefined) { const b = document.querySelector(`[data-abil="${ABIL_ORDER[ab]}"]`); if (b && !b.hidden && !b.disabled) b.click(); return; }
    });
    $('#cv').addEventListener('contextmenu', e => e.preventDefault());
    $('#cv').addEventListener('pointerleave', () => { Render.hover = null; Render.hoverE = null; $('#etip').hidden = true; });
    // hooks
    Hooks.sfx = (n, a) => { SFX.play(n, a); if (n === 'leak') Haptics.leak(); else if (n === 'bigleak') Haptics.big(); };
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
    Hooks.onLevel = (L, n) => { toast('LEVEL UP · ' + L, `+${n} talent point${n > 1 ? 's' : ''}`, '#59f0b4'); Save.save(); };
    Hooks.onUnlock = k => { if (G) (G.unlocks || (G.unlocks = [])).push(k); if (panel && panel.kind === 'build') renderPanel(); };
    Hooks.onChange = () => { if (G && panel) renderPanel(); Save.save(); };
    Hooks.onSave = () => Save.save();
    Hooks.onWave = () => {};
    Hooks.onCheckpoint = w => { toast('CHECKPOINT', 'A wormhole opens next wave. Rebuild, then Resume fast for a bonus.', '#59f0b4'); if (panel && panel.kind === 'tower') renderPanel(); Save.save(); };
    Hooks.onEntropy = () => {};
    Hooks.newEnemy = k => setTimeout(() => enemyCard(k), 400);
    Hooks.abilReady = k => { const b = document.querySelector(`[data-abil="${k}"]`); if (b) { b.classList.remove('ping'); void b.offsetWidth; b.classList.add('ping'); } };
    Hooks.scanned = e => { const nm = e.boss ? e.bossName : ENEMIES[e.type] ? ENEMIES[e.type].name : e.type, gs = (e.genes || []).filter(g => GENES[g]);
      const beat = gs.length ? GENES[gs[0]].counter : ENEMIES[e.type] && ENEMIES[e.type].beat;
      toast('BIGGEST THREAT', `${nm}${gs.length ? ' · ' + gs.map(g => GENES[g].name).join(', ') : ''} · ${fmt(e.hp)} HP${beat ? ' · Beat it: ' + beat : ''}`, '#ffb03a', true, 'tip'); };
  }
  let eqT = 0; const eqBuf = new Uint8Array(128);
  function tick(dt) {
    if (screen === 'game') { eqT -= dt; if (eqT <= 0) { eqT = 0.08; const tile = $('#bMusic'); if (tile) { const M = SFX.music, p = M.piece, bars = tile.querySelectorAll('.meq i');
      if (p) tile.style.setProperty('--mc', (M.GENRES[p.genre] || {}).col || '#59f0b4'); const quiet = !p || M.paused || M.held || SFX.state !== 'running'; tile.classList.toggle('quiet', quiet);
      M.spectrum(eqBuf); const band = [[1, 3], [3, 7], [7, 14], [14, 28], [28, 56]]; bars.forEach((b, i) => { let v = 0; if (!quiet) for (let k = band[i][0]; k < band[i][1]; k++) v = Math.max(v, eqBuf[k]); b.style.height = Math.max(3, Math.round(v / 255 * 16)) + 'px'; });
      if (!$('#mdeck').hidden) UI.deckFill && UI.deckFill(); } } }
    if (panel && panel.kind === 'tower' && G && !G.towers.includes(panel.t)) closePanel(); // swallowed by the worm, or otherwise gone
    if (panel && panel.kind === 'enemy' && (panel.e.dead || !G || !G.enemies.includes(panel.e))) closePanel();
    if (enemyCards.length && screen === 'game' && G && !G.over && !modalOpen && !Tree.isOpen && !G.draft) enemyCard(enemyCards.shift());
    onboardingTick();
    const bossOn = !!(screen === 'game' && G && G.bossAlive && !G.bossAlive.dead); if (bossOn !== document.body.classList.contains('bossbar')) document.body.classList.toggle('bossbar', bossOn);
    // v5.2: fast-forward is safe to leave on. A boss arriving (or reaching Red Alert) drops the game to 1×; the old speed comes back when it falls.
    // Speeding up again by hand during the fight is respected
    if (bossOn && !G.over) { const b = G.bossAlive, key = b.id + (G.redAlert ? 'r' : '');
      if (G.speed > 1 && G.slowKey !== key && PROF.settings.autoSlow !== false) { G.slowKey = key; G.speedWas = Math.max(G.speedWas || 0, G.speed); G.speed = 1; toast('SPEED 1×', G.redAlert ? 'Red Alert: the boss is at your gate' : 'Boss on the field. Your speed comes back when it falls', '#ffb03a', true, 'tip'); updateHud(); } }
    else if (G && !G.over && G.speedWas && screen === 'game') { if (G.speed === 1) { G.speed = G.speedWas; toast(`SPEED ${G.speed}×`, 'Boss down', '#59f0b4', true, 'tip'); } G.speedWas = 0; G.slowKey = null; updateHud(); }
    hudClock += dt;
    if (screen === 'game' && G && hudClock > 0.1) { hudClock = 0; updateHud(); }
    if (screen === 'game' && G && G.draft && !G.over && !modalOpen && !Tree.isOpen && !G.watch) { closePanel(); openDraft(G.draft); }
    if (screen === 'game' && G && G.huntChoice && !G.draft && !G.over && !modalOpen && !Tree.isOpen && !G.watch) { closePanel(); openHunt(); }
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
    wire, tick, show, renderHangar, toast, flushToasts, closePanel, refreshAll, cloud, renderPanel, zoomChanged: () => updateZoomBtn(), openNews, openEvo, slowmo: 0, watchFeed, openSetupDaily: () => { openSetup(); setup.mode = 'daily'; renderSetup(); },
    get screen() { return screen; }, get modalOpen() { return modalOpen; },
    // test hooks (test/uiaudit.py opens every screen through these)
    _dbg: { openSetup, openHelp, openSettings, openArchive, openHall, openPause, openReport, openAssault, openEvo, openThreat, updateHud, openHunt, watchRun, endWatch, huntCode, readHuntCode, renderSetup, setup: () => setup, openNews, openGameOver, openStudio, openNova, openTransfer, openTower, openCore, openBuild, openEnemy, enemyCard, introCard, wantedPoster, closeModal, modal },
  };
})();

// ---------------- v5.0 Talents screen (replaces the 3D passive web) ----------------
// Tree tabs on the left, the chosen tree's rows in the middle, the selected talent's details on the right. Tap a talent to see it,
// tap + to add a rank (or double-tap the talent). Everything is plain DOM: it scrolls like any page on a phone.
const Tree = (() => {
  let mode = null, open_ = false, cur = 'K', sel = null, drawer = null, lastTap = { id: null, t: 0 }, confirmReset = false;
  const el = id => document.getElementById(id);
  const capName = id => TAL[id] ? TAL[id].name : id;
  function init() {
    el('tree').addEventListener('click', e => {
      const b = e.target.closest('[data-tact]'); if (!b) return;
      const a = b.dataset.tact, v = b.dataset.v;
      if (a === 'close') { close(); return; }
      if (a === 'tab') { cur = v; sel = null; drawer = null; SFX.play('ui'); refresh(); el('tgrid').scrollTop = 0; return; }
      if (a === 'sum') { cur = 'sum'; sel = null; drawer = null; SFX.play('ui'); refresh(); return; }
      if (a === 'sel') {
        const now = performance.now();
        if (lastTap.id === v && now - lastTap.t < 350) { add(v); lastTap = { id: null, t: 0 }; return; }
        lastTap = { id: v, t: now }; sel = v; SFX.play('ui'); refresh(); return;
      }
      if (a === 'add') { sel = v; add(v); return; }
      if (a === 'rem') { remove(v); return; }
      if (a === 'builds') { drawer = drawer === 'builds' ? null : 'builds'; refresh(); return; }
      if (a === 'reset') { if (!confirmReset) { confirmReset = true; refresh(); return; } confirmReset = false; if (talentReset()) { SFX.play('sell'); UI.toast('TALENTS RESET', 'Every point is back', '#ffb03a'); } refresh(); return; }
      if (a === 'bsave') { treeSaveBuild(+v); Save.save(); UI.toast('BUILD SAVED', `Slot ${+v + 1}`, '#59f0b4'); refresh(); return; }
      if (a === 'bload') { const r = treeLoadBuild(+v); if (r === 'ok') { SFX.play('upgrade'); UI.toast('BUILD LOADED', PROF.builds[+v].name, '#59f0b4'); } else UI.toast('CAN\'T LOAD', r === 'points' ? 'Not enough points for that build yet' : r === 'tokens' ? 'Loading a build mid-run costs 2 Recalibration tokens' : 'Empty slot', '#ff4d6a'); refresh(); return; }
    });
  }
  function add(id) {
    const why = talentBlock(id);
    if (why) { SFX.play('deny'); UI.toast('NOT YET', blockMsg(id, why), '#ff4d6a'); return; }
    talentAdd(id); SFX.play(TAL[id].cap ? 'levelup' : 'upgrade');
    if (TAL[id].cap) UI.toast('CAPSTONE', `${TAL[id].name} · ${TREE_BY_ID[TAL[id].tree].name}`, TREE_BY_ID[TAL[id].tree].col);
    Save.save(); refresh();
  }
  function remove(id) {
    const why = talentCanRemove(id);
    if (why) { SFX.play('deny'); UI.toast('CAN\'T REMOVE', why === 'tokens' ? `Refunding mid-run costs ${refundCost(id)} Recalibration token${refundCost(id) > 1 ? 's' : ''} (you have ${G ? G.tokens : 0})` : why === 'cap' ? 'Your Capstone needs 20 points in this tree' : why === 'row' ? 'A talent further down needs these points' : 'Nothing to remove', '#ff4d6a'); return; }
    talentRemove(id); SFX.play('sell'); Save.save(); refresh();
  }
  function blockMsg(id, why) {
    const T = TAL[id], tr = TREE_BY_ID[T.tree];
    if (why === 'points') return 'No points left. You earn one each level';
    if (why === 'max') return 'Already at its last rank';
    if (why === 'have') return 'Already yours';
    if (why === 'locked') return 'Your Daily Hunt build is locked for this run';
    if (why === 'slots') { const lv = talLevel(), n = TAL_EDIT ? 0 : CAP_NEXT(lv); return `You can hold ${capSlots(lv)} Capstone${capSlots(lv) > 1 ? 's' : ''}${n ? `; another slot opens at Level ${n}` : ''}. Remove one first`; }
    if (why === 'row') return `Needs ${rowNeed(T.row)} points in ${tr.name} (you have ${treePts(tr.id)})`;
    if (why === 'tree') return `One Capstone per tree. Remove ${capName(capsHeld().find(c => TAL[c].tree === T.tree))} first`;
    if (why.startsWith('conflict:')) return `Can't sit beside ${capName(why.slice(9))}: Conflagration turns every Chill into Burn`;
    return 'Not available';
  }
  // ---- rendering ----
  function rankPips(T, r) { if (T.max <= 1) return ''; let s = ''; for (let i = 0; i < T.max; i++) s += `<i class="${i < r ? 'on' : ''}"></i>`; return `<span class="pips">${s}</span>`; }
  function tile(T, tr) {
    const r = T.cap ? (activeCaps().includes(T.id) ? 1 : 0) : talRank(T.id), why = talentBlock(T.id), canAdd = !why, locked = why === 'row', full = !T.cap && r >= T.max;
    const rem = (TS().remnants || []).includes(T.id);
    const cls = ['ttile', T.cap ? 'cap' : '', r ? 'have' : '', locked ? 'locked' : '', full ? 'full' : '', sel === T.id ? 'sel' : ''].join(' ');
    const desc = talentLines(T, Math.max(1, r)).join(' · ');
    return `<div class="${cls}" style="--c:${tr.col}"><button class="tbody" data-tact="sel" data-v="${T.id}"><b>${esc(T.name)}${rem ? ' <em>Remnant</em>' : ''}</b>${T.cap ? '' : `<small>${r}/${T.max}</small>`}${rankPips(T, r)}<span class="td">${esc(desc)}</span></button>${canAdd ? `<button class="tadd" data-tact="add" data-v="${T.id}" aria-label="Add a rank">+</button>` : ''}</div>`;
  }
  function treeHTML(tr) {
    const pts = treePts(tr.id), rowsHTML = tr.rows.map((row, r) => {
      const need = rowNeed(r), ok = pts >= need || treePts(tr.id, r) >= need;
      return `<div class="trow ${ok ? '' : 'locked'}"><div class="trl"><b>${r + 1}</b>${r ? `<small>${need} pts</small>` : ''}</div><div class="trt">${row.map(T => tile(T, tr)).join('')}</div></div>`;
    }).join('');
    const capOk = pts >= TCAP;
    return `<div class="thead" style="--c:${tr.col}"><b>${esc(tr.name)}</b><span>${esc(tr.tag)}</span><em>${pts} point${pts === 1 ? '' : 's'} in this tree</em></div>${rowsHTML}
      <div class="trow caprow ${capOk ? '' : 'locked'}"><div class="trl"><b>★</b><small>${TCAP} pts</small></div><div class="trt">${tr.caps.map(T => tile(T, tr)).join('')}</div></div>
      <p class="note tfoot">Capstones change how you play. Pick one per tree; you can hold ${capSlots(profLevel().level)} at Level ${profLevel().level}${CAP_NEXT(profLevel().level) ? ` (another at Level ${CAP_NEXT(profLevel().level)})` : ''}.</p>`;
  }
  function sumHTML() {
    const M = computeMods(null, null), lines = [];
    const agg = {};
    for (const id in TS().tal || {}) { const T = TAL[id]; if (!T || T.cap) continue; for (const k in T.fx) agg[k] = (agg[k] || 0) + T.fx[k] * TS().tal[id]; }
    for (const k in agg) if (STAT_TXT[k]) lines.push(STAT_TXT[k](typeof agg[k] === 'number' && agg[k] !== 1 ? +agg[k].toFixed(2) : agg[k]));
    const caps = activeCaps();
    return `<div class="thead"><b>Your build</b><span>Everything your talents give you, in one place</span><em>${pointsSpent()} spent · ${pointsFree()} free</em></div>
      <div class="lbl">Capstones</div>${caps.length ? caps.map(id => { const T = TAL[id], tr = TREE_BY_ID[T.tree]; return `<div class="tsumcap" style="--c:${tr.col}"><b>${esc(T.name)}</b><small>${esc(tr.name)}${(TS().remnants || []).includes(id) ? ' · Remnant' : ''}</small><span>${talentLines(T).map(esc).join(' · ')}</span></div>`; }).join('') : '<p class="note">None yet. Spend 20 points in one tree to reach its Capstones.</p>'}
      <div class="lbl">Bonuses</div><p class="note">Every point spent: +${TAL_PT_DMG}% Damage to all towers (now +${+(pointsSpent() * TAL_PT_DMG).toFixed(1)}%).</p>${lines.length ? `<ul class="tsum">${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : '<p class="note">No talents yet.</p>'}
      <div class="lbl">Per tree</div><div class="tbars">${TALENTS.map(tr => `<div style="--c:${tr.col}"><span>${esc(tr.name)}</span><i style="width:${Math.min(100, treePts(tr.id) / 26 * 100)}%"></i><b>${treePts(tr.id)}</b></div>`).join('')}</div>`;
  }
  function infoHTML() {
    if (!sel || !TAL[sel]) return `<div class="tinfo-empty"><b>${pointsFree()}</b><span>point${pointsFree() === 1 ? '' : 's'} to spend</span><p class="note">Tap a talent to read it. Tap + (or double-tap) to add a rank.</p><p class="note">Each row opens after 5 points in that tree. Capstones open at 20. Every point also adds +${TAL_PT_DMG}% Damage to all towers.</p></div>`;
    const T = TAL[sel], tr = TREE_BY_ID[T.tree], r = T.cap ? (activeCaps().includes(T.id) ? 1 : 0) : talRank(T.id), why = talentBlock(T.id), rw = talentCanRemove(T.id);
    const now = r ? talentLines(T, r) : null, next = !T.cap && r < T.max ? talentLines(T, r + 1) : null;
    const rem = (TS().remnants || []).includes(T.id);
    return `<div class="tinfo-t" style="--c:${tr.col}"><em>${esc(tr.name)}${T.cap ? ' · Capstone' : ` · Row ${T.row + 1}`}</em><b>${esc(T.name)}</b>${T.cap ? `<small>${r ? (rem ? 'Remnant: always on' : 'Yours') : 'Not taken'}</small>` : `<small>Rank ${r} of ${T.max}</small>`}</div>
      ${T.cap ? `<ul class="tl">${talentLines(T).map(l => `<li>${tipify(l)}</li>`).join('')}</ul>` : `${now ? `<div class="lbl">Now</div><ul class="tl">${now.map(l => `<li>${tipify(l)}</li>`).join('')}</ul>` : ''}${next ? `<div class="lbl">${r ? 'Next rank' : 'Rank 1'}</div><ul class="tl dim">${next.map(l => `<li>${tipify(l)}</li>`).join('')}</ul>` : ''}`}
      ${why && why !== 'max' && why !== 'have' ? `<p class="note bad">${esc(blockMsg(T.id, why))}</p>` : ''}
      <div class="tbtns">${!rem && (r > 0) ? `<button class="btn" data-tact="rem" data-v="${T.id}" ${rw && rw !== 'tokens' ? 'disabled' : ''}>Remove${refundFree() ? '' : `<small>${refundCost(T.id)} token${refundCost(T.id) > 1 ? 's' : ''}</small>`}</button>` : ''}
      ${!why ? `<button class="btn primary" data-tact="add" data-v="${T.id}">${T.cap ? 'Take Capstone' : r ? 'Add rank' : 'Learn'}<small>1 point</small></button>` : ''}</div>`;
  }
  function buildsHTML() {
    return `<div class="tbuilds"><div class="lbl">Builds <em>save a layout, load it later${refundFree() ? '' : ' (2 tokens mid-run)'}</em></div>${PROF.builds.map((b, i) => `<div class="tb"><b>${b && b.tal ? esc(b.name) : `Slot ${i + 1}`}</b><small>${b && b.tal ? `${b.lvl} pts · ${(b.caps || []).map(capName).map(esc).join(', ') || 'no Capstone'}` : 'empty'}</small><button class="btn small" data-tact="bsave" data-v="${i}">Save</button><button class="btn small" data-tact="bload" data-v="${i}" ${b && b.tal ? '' : 'disabled'}>Load</button></div>`).join('')}</div>`;
  }
  function refresh() {
    if (!open_) return;
    const lv = talLevel(), free = pointsFree(), held = capsHeld().length, slots = capSlots(lv);
    el('tree').querySelector('h2').textContent = mode === 'hunt' ? 'Hunt Build' : huntRun() ? 'Hunt Build · locked' : 'Talents';
    el('tPts').textContent = free;
    el('tCaps').innerHTML = `<b>${held}/${slots}</b> Capstones`;
    const tk = el('tTok'); tk.hidden = !(G && !G.over); if (G) tk.innerHTML = `<b>${G.tokens}</b> tokens`;
    const rs = el('tReset'); rs.hidden = !refundFree(); rs.textContent = confirmReset ? 'Tap again' : 'Reset';
    el('ttabs').innerHTML = TALENTS.map(tr => { const p = treePts(tr.id), cap = activeCaps().find(c => TAL[c].tree === tr.id); return `<button class="ttab ${cur === tr.id ? 'on' : ''}" style="--c:${tr.col}" data-tact="tab" data-v="${tr.id}"><b>${esc(tr.name)}</b><small>${p ? p + ' pts' : '—'}${cap ? ' · ★' : ''}</small></button>`; }).join('') + `<button class="ttab sum ${cur === 'sum' ? 'on' : ''}" data-tact="sum"><b>Your Build</b><small>${pointsSpent()} pts</small></button>`;
    el('tgrid').innerHTML = (drawer === 'builds' ? buildsHTML() : '') + (cur === 'sum' ? sumHTML() : treeHTML(TREE_BY_ID[cur] || TALENTS[0]));
    el('tinfo').innerHTML = infoHTML();
    document.body.classList.toggle('tsel', !!sel);
  }
  function open(m) {
    mode = m === 'hunt' ? 'hunt' : null; TAL_EDIT = mode ? huntBuildProf() : null; // v5.3: the Daily Hunt build, a fixed budget
    if (G && !G.over) { G.wasPaused = G.paused; G.paused = true; }
    UI.closePanel();
    el('tree').hidden = false; open_ = true; document.body.classList.add('webopen');
    if (cur !== 'sum' && !TREE_BY_ID[cur]) cur = 'K';
    // open on the tree you've invested in most
    if (!sel) { let best = cur, bp = -1; for (const tr of TALENTS) { const p = treePts(tr.id); if (p > bp) { bp = p; best = tr.id; } } if (bp > 0) cur = best; }
    drawer = null; confirmReset = false; refresh();
  }
  function close() {
    const wasHunt = mode === 'hunt'; mode = null; TAL_EDIT = null;
    el('tree').hidden = true; open_ = false; sel = null; drawer = null; document.body.classList.remove('tsel', 'webopen');
    if (wasHunt) { Save.save(); UI.openSetupDaily(); return; }
    if (G && !G.over) G.paused = !!G.wasPaused;
    UI.flushToasts();
    if (UI.screen === 'hangar') UI.renderHangar();
    Save.save();
  }
  function select(id) { if (TAL[id]) { cur = TAL[id].tree; sel = id; refresh(); } }
  return { init, open, close, resize() {}, draw() {}, refresh, select, get isOpen() { return open_; }, _sel: () => sel, _cur: () => cur };
})();

// ---------------- Main loop ----------------
const NIGEL_PX = ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAA4CAYAAABNGP5yAAADXklEQVR4Xu2aS2gTQRjHp+JNCz6qh2B9rUKQoPjAir1Y9SDmoGg9ihcVFK/1WMRjpXpSaxVKztYiSKrQlgpSseIDtWgOpiiFXFpUqB6EgvKtTJrdnd355vFttnZ/EJrQ2d35/zI7M/u1jKWkpKSkpKRQ0Lis6Y+N89o6j4glNjoYxvp1OePOnz7WZUViGKQCdmWPssblq7QlQPiRF/covyNaARwdCXGEB8hGgGmAN6VBI4FYyATwAAecnNsXlVEA8r7/qFSPpYRMANz/HBUJfOTwY6hZSn0BPzASjh++HDqzU096fsgFPC1PuNeEb5S/l4WsbUsN2S3gh4fHoNLWlNgEJBUSAaZLoAiVVUQFEgG1a3jSIRFQuwQmHesCwoZ/cXSv+5KBbWcL6wJEwx9Cbd10ibXuGYiUgG1nE+sCwob/2tUHUf3GtrMF+UYIyLe9ZGOvTlTfh4FtZ5NYBHAJGEBCnDTYvhiUr2DNpmD25zc2+2vGap+VT9Z755HwQWbi3Xs3c27HdvZs8JN0vw9sWdPk/vw8PYP21X7yjNu2r3CDdV/vCxw3NPSY3e+/hc6FbsiDl0ofIzs793vO7RxmFMA3CmDaAhC+/0Ghev1D+86yh8Nd7Nz5Dk+fstltaBEoARBeFtzP3d5rkcFWrsgwKHoAte91AJF+CcDU1FfpaJAK0AnPkUmwia6ESAEjwx+E93tPz23W3LwB1f/pyQbUfGCDK1e7hacpFG6ysedPhFlDBUD4YnG+MOkHhhdGQlwCIDxMgGFUKpNCCcKdoCw8AOFBQhRJCQ9kMptZ6/4jgREdEIAJz4mSkKTwHJEEjwCV8DIJmJrA29cD7ksX2bAX4ZfgEVAuf9HtS4A4agKqS7MIjwDH2WhNAJadu/89JOkAGx5TrD8Oc2CHJsMkvC3IBMDOjG91k4zR43A+P//nLxGy39vAcS6wzs4Od3LTQVsAhIvaKMVJS0sbGx8f1ZKgdQskKTwHJMBuTxVlAUkMbyJBWYDNvUISUBZQj70CJcoC/jeMBcATYe1TYT0+m6C9DHL8NYF6f1bFMwKg0rPY8AiAcrKsyAG7roWMvzIUmANkEviuK4nIdoOisphwElyIEnTCA5FV4VPtF0P/nQ0kiWps9QKqvlH9CasKpyx2/gJwILY0tl0hfQAAAABJRU5ErkJggg==', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAA4CAYAAABNGP5yAAADP0lEQVR4Xu2aP2gUQRSHJ2KnAZXYHEbFtTjkUNQioo2ihZhC0ViKjQraxzKIZSRaqTEK4WqjCJIoJEFBFFOoqEGv8IISuCZBhWghBJQ3MMnu7Oz8f3tzZj8I3JHZvfl993Zn9iWEFBQUFBQUFGDQvqbjr4/z+jqPiFU+JpjF5k0V58mfOd7vRWIWqAL2lI+R9rUbrCVA+MnX9zC/I1wBDBsJeYQH0CrANcDb2piTQF3QBLAAB6MKnYtJFYC8Hz8bS8digiYArn+GiQRWOewYbFZjfwAPVMKJI5cz7+zYNz0edAHP69P0M+EbZa9VIeNjsUG7BHhYeB1MxrqSm4BQQRHgugSKMFlFTEAREF/DQwdFQHwJDB3vAjDKHxPvAkTlf3jfuaUM8dc8uuN80ubzZEBWBbBwqj2AbNzCr+9k4fe81zmjb4QYquCm43zh/RJoNbyWEwDtK1izMcC4BIwFDN15LHyQmX7/gWau7NpJXox91ir57Rs76DFf5ua1ffWcOkvHDldvkIHrw6njxsefkPsjt7RzaQ9kwWu1T9LJLv5ZpJPTqQL4RmnVaFYMhB95UE2sKI8m+sn5C72JOZXLO7RFaAmA8KrgPHeHrkmDrV9XItD0AOKvbQCRvARgdvabshqUAmzCM1QSfGIrQSpgcuKj8HofHLxNOju3aM1/bqZN637ggytXB4SnqVZvkpevngqzZgqA8KOjy41JHigvHQl5CYDwcAPMotGYEUoQ7gNU4QEIDxJkhBIeKJW2kQP7j6YqOiVAJzxDJiGk8AyRhIQAk/AqCTo9gXdvHtIfW1RlL4KXkBBQr3+1nUuKPHoCpkuziISAKNrqTYAuu/ee1B2aAjY8rqA9DMEOTYVLeF+gCYCdGdvqhoxTP6C7e/nPXyJUv/dBFF0kfX299OZmg7UACCfbKOVJV9chMjX1zEqC1SUQUngGSIDdninGAkIM7yLBWIDPvUIIGAtoxl4BE2MB/xvOAuCJMP5U2Iz3Llgvgwy+J9Ds96YkKgA6PSuNhABoJ6uaHLDramX4zlDqHqCSwHZdIaLaDYraYsKbYCtKsAkPSLvCp3suZf47G0gS9diaBXR9ZfPJ6goXrHT+AfnLr7228PTCAAAAAElFTkSuQmCC'];
// v5.7 studio splash: Nigel (the studio cat) in his couch, a slow blink, then the hangar. Skipped under automation
// unless forced (test/splashshot.py), returns how long it will cover the screen in ms.
UI.splash = function (force) {
  if (!force && navigator.webdriver) return 0;
  const old = document.getElementById('splash'); if (old) old.remove();
  const el = document.createElement('div'); el.id = 'splash'; el.setAttribute('aria-label', 'Nigel Industries presents');
  el.innerHTML = '<div class="spc"><img class="spcat" alt="" src="' + NIGEL_PX[0] + '"><div class="spn">NIGEL</div><div class="spi">INDUSTRIES</div><div class="spp">presents</div></div>';
  document.body.appendChild(el);
  const img = el.querySelector('.spcat'); new Image().src = NIGEL_PX[1];
  let done = false; const timers = [];
  const end = () => { if (done) return; done = true; timers.forEach(clearTimeout); el.classList.add('out'); setTimeout(() => el.remove(), 520); };
  el.addEventListener('pointerdown', e => { e.preventDefault(); end(); });
  const go = () => { if (done) return; el.classList.add('in');
    [[1300, 1], [1650, 0], [2150, 1], [2550, 0]].forEach(([ms, f]) => timers.push(setTimeout(() => { img.src = NIGEL_PX[f]; }, ms))); // two slow blinks
    timers.push(setTimeout(end, 3500)); };
  let started = false; const start = () => { if (!started) { started = true; go(); } };
  try { document.fonts.ready.then(start); } catch (e) {} setTimeout(start, 600);
  return 4100;
};
(function boot() {
  const loaded = Save.loadLocal();
  if (loaded) PROF = loaded;
  const webReset = migrateWeb();
  if (webReset) { Save.save(); setTimeout(() => UI.toast('TALENTS ARRIVE', 'The passive web is now seven Talent trees. Every point is refunded: open Talents to spend them', '#ffb03a'), 900); }
  const capDrop = tidyCaps();
  if (capDrop.length) { Save.save(); setTimeout(() => UI.toast('CAPSTONE REFUNDED', `One Capstone per tree now: ${capDrop.map(c => TAL[c].name).join(', ')} refunded. Spend the point elsewhere`, '#ffb03a'), 1400); }
  Render.init($('#cv'));
  Render.onCam = () => UI.zoomChanged && UI.zoomChanged();
  Tree.init();
  hydrateIcons();
  UI.wire();
  UI.renderHangar();
  UI.show('hangar');
  const spT = UI.splash(); // v5.7: Nigel Industries presents (cold start only; a tap skips)
  // returning players see what changed once per version; brand-new players skip it
  if (!PROF.runs) { PROF.seenVer = VERSION; }
  else if (PROF.seenVer !== VERSION) setTimeout(() => { if (UI.screen === 'hangar' && !UI.modalOpen && WHATS_NEW.items.length) UI.openNews(); }, 900 + spT);
  SFX.setVolumes(PROF.settings.sfx, PROF.settings.music); SFX.setMono(!!PROF.settings.mono);
  SFX.setSoundtrack(PROF.settings.soundtrack || 'ec'); SFX.music.setConfig(PROF.settings.studio); PROF.settings.studio = SFX.music.config; SFX.music.setBaseBpm(PROF.settings.bpm || 72);
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
  // hangar backdrop (v5.5: HangarFX in render.js)
  const bg = $('#bgfx'); const drawBg = dt => HangarFX.draw(bg, dt);
  let last = performance.now(), acc = 0, wakeT = 2;
  const STEP = 1 / 30;
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, Math.max(0, (ts - last) / 1000)); last = ts;
    if (UI.screen === 'game' && G) {
      if (G.checkpoint && !G.paused && !G.reloc && UI.modalOpen !== 'pause' && !document.hidden) G.cpT += dt;
      if (UI.slowmo > 0) UI.slowmo -= dt;
      if (G.watch && !G.paused && !UI.modalOpen) UI.watchFeed();
      const halted = G.over || G.paused || G.draft || G.huntChoice || (G.checkpoint && !G.enemies.length) || Tree.isOpen || UI.modalOpen;
      if (!halted) {
        acc += dt * G.speed * (UI.slowmo > 0 ? 0.3 : 1);
        let n = 0;
        while (acc >= STEP && n < 10) { simStep(STEP); acc -= STEP; n++; }
        if (n >= 10) acc = 0;
      }
      Render.draw(halted ? 0 : dt);
    } else { if (UI.screen === 'hangar') { drawBg(dt); TitleFX.draw(dt); } ART.idle(4); } // menus: pre-render unit art in the background
    if (Tree.isOpen) Tree.draw();
    wakeT -= dt; if (wakeT <= 0) { wakeT = 2; if (!document.hidden) SFX.wake(); } // iOS can leave the sound 'interrupted'
    UI.tick(dt);
  }
  setTimeout(() => UNITS.warmEnemies(), 1500);
  requestAnimationFrame(frame);
})();
