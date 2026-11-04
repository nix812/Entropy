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
  overdrive: ['##.....##', '###...###', '####.####', '.##...##.', '....#....', '.........', '...###...', '..#####..', '..#####..'], // 6.2: the Nuke's radiation trefoil
  music: ['...######', '...######', '...#....#', '...#....#', '...#....#', '.###..###', '####.####', '####.####', '.##...##.'],
  fit: ['###...###', '#.......#', '#.......#', '.........', '.........', '.........', '#.......#', '#.......#', '###...###'],  // v5.5 Music Studio transport
  play: ['.#.......', '.##......', '.###.....', '.####....', '.#####...', '.####....', '.###.....', '.##......', '.#.......'],
  prev: ['..........', '#....#...#', '#...##..##', '#..###.###', '#.########', '#..###.###', '#...##..##', '#....#...#', '..........'],
  repeat: ['.....#...', '.#######.', '#....#..#', '#.......#', '#.......#', '#.......#', '#..#....#', '.#######.', '...#.....'],
  heart: ['.........', '.##...##.', '####.####', '#########', '#########', '.#######.', '..#####..', '...###...', '....#....'],
  heartO: ['.........', '.##...##.', '#..#.#..#', '#...#...#', '#.......#', '.#.....#.', '..#...#..', '...#.#...', '....#....'],
  share: ['....#....', '...###...', '..#.#.#..', '....#....', '....#....', '#...#...#', '#.......#', '#.......#', '#########'],
  edit: ['......##.', '.....#..#', '....#..#.', '...#..#..', '..#..#...', '.#..#....', '#..#.....', '##.......', '###......'],
  speaker: ['....#....', '...##.#..', '..#.#..#.', '###.#.#.#', '#...#.#.#', '###.#.#.#', '..#.#..#.', '...##.#..', '....#....'], // 6.2 Settings tabs
  screen: ['#########', '#.......#', '#.......#', '#.......#', '#.......#', '#########', '....#....', '...###...', '.........'],
  sliders: ['.##......', '#########', '.##......', '......##.', '#########', '......##.', '...##....', '#########', '...##....'],
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
  for (const cv of (root || document).querySelectorAll('canvas[data-gico]')) Render.geneIcon(cv.dataset.gico, cv, cv.dataset.el); // v5.8 gene marks
}

// 6.2 (Nic: "Make the music full composer visible by default"): the Compose tab no longer hides behind five taps on the visualizer.
// Fresh profiles get it on; existing ones are switched on once (cmpV), so the flag stays a plain setting from then on.
function studioMig(st) {
  st = st && typeof st === 'object' ? st : {};
  if (!st.cmpV) { st.composer = true; st.cmpV = 1; }
  return st;
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
    out.settings.studio = studioMig(out.settings.studio);
    out.webV = p.webV || 1;
    out.alloc = ['start'];
    out.tal = p.tal && typeof p.tal === 'object' ? Object.fromEntries(Object.entries(p.tal).filter(([k, v]) => TAL[k] && !TAL[k].cap && v > 0).map(([k, v]) => [k, Math.min(TAL[k].max, v | 0)])) : {};
    out.caps = Array.isArray(p.caps) ? p.caps.filter(c => TAL[c] && TAL[c].cap) : [];
    if (!Array.isArray(out.builds) || out.builds.length !== 5) out.builds = [null, null, null, null, null];
    // v5.1: a veteran has met the first eight enemies already; only the newcomers get an introduction card
    out.codex = Object.assign(defaultProfile().codex, out.codex || {});
    if (!out.seenSys && (out.bestWave || 0) >= 15) out.seenSys = { storm: 1, crate: 1, vet: 1 };
    if (out.seenSys && !out.seenSys.v58 && (out.bestWave || 0) >= 15) Object.assign(out.seenSys, { upg: 1, power: 1, spare: 1, wormhole: 1, anomaly: 1, boss: 1, market: 1, support: 1 }); // 5.8 cards: veterans know these
    if (out.seenSys) out.seenSys.v58 = 1;
    if (!out.codex.enemies) { out.codex.enemies = {}; if ((out.bestWave || 0) >= 12) for (const k in ENEMIES) if (ENEMIES[k].from <= 12) out.codex.enemies[k] = 1; }
    collMigrate(out.codex); // v5.8: the old strain list counts towards the Swarm Collection
    if (!p.tut || typeof p.tut !== 'object') out.tut = (p.runs || 0) > 0 || (p.bestWave || 0) > 0 ? { seen: 1, done: 1, old: 1 } : {}; // 5.8: players with runs never get the Training prompt
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
          { const mw = migrateWeb(); if (mw) { PROF.updatedAt = Date.now(); UI.toast(...talentsToast(mw)); queue(); } }
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
  let screen = 'hangar', panel = null, pick = null, capPeek = null, hudFull = false, toastQ = [], logLines = [], modalOpen = null, modalFrom = null;
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
    $('#bArchive').classList.toggle('hasnew', ((PROF.codex || {}).collNew || []).length > 0); // v5.8: new Swarm Collection entries
    const nv = PROF.nova || 0, done = capsHeld().length, req = novaLevelReq(nv), ready = novaReady();
    $('#hNovaBox').hidden = !nv; $('#hNova').textContent = nv;
    const bn = $('#bNova'); bn.hidden = !nv && done < 1; bn.classList.toggle('ready', ready);
    $('#hNovaSub').textContent = ready ? 'Ready' : PROF.runSnap && done >= 2 && L.level >= req ? 'Finish your run' : `${Math.min(done, 2)}/2 Capstones · Lv ${req}`;
    const snap = PROF.runSnap;
    $('#bLaunch2').hidden = !snap;
    $('#bLaunch').firstChild.textContent = snap ? 'Resume' : 'Play';
    const dk = dailyKey(), dd = PROF.daily && PROF.daily.date === dk ? PROF.daily : null;
    $('#hPlaySub').textContent = snap ? (snap.rec ? `Daily Hunt · Wave ${snap.wave}` : `${snap.fr ? '' : 'Classic · '}Wave ${snap.wave} · ${CHAOS_LEVELS[snap.chaos].name}`) : ''; // 6.1: every new run flies; a saved pre-6.1 run resumes on the Classic rules and says so
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
    if (setup.mode !== 'daily') setup.mode = 'std'; // 6.1: one kind of run (Frontier rules); the Daily Hunt is the other tab
    setup.chaos = ls.chaos ?? 1; if (!chaosUnlocked(setup.chaos)) setup.chaos = 1;
    const maxStart = Math.max(1, Math.floor((PROF.bestWave - 5) / 5) * 5);
    setup.startWave = Math.min(ls.startWave || 1, maxStart);
    if (setup.startWave !== 1 && setup.startWave % 5) setup.startWave = 1;
    rerollMap();
    renderSetup();
  }
  function rerollMap() {
    setRows(frRows(setup.chaos ?? 1)); setCols(frCols(ROWS)); // the Frontier board (FRONTIER in data.js), the same on every screen
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
            <p class="note frpitch">Your core flies. Land it on a tower to fire that weapon, twice as hard.</p>
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
        <div class="foot"><button class="btn" data-act="tutStart">Training</button><button class="btn primary" data-act="launch">Start · Wave ${sw}</button></div>
      </div>`, 'setup');
    Render.preview_map($('#mapPrev'), setup.map, setup.frac, setupSector()); zoneSwatches(6, 2); // 6.3: the map and the zone buttons in each zone's look
  }
  // 6.3: paint every zone swatch canvas in the open modal (a patch of that zone's board)
  function zoneSwatches(cols, rows) { document.querySelectorAll('#modal canvas[data-zsw]').forEach(cv => Render.zoneSwatch(cv, cv.dataset.zsw, cols, rows)); }
  // 5.8 sector contracts: three offers from the setup seed (a new map, new offers). A fresh profile gets the gentle default, unasked
  // short numbers for tight chips: 940, 12K, 1.2M
  const fmtS = n => { n = Math.round(n || 0); return n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'K' : String(n); };
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
      <div class="secs">${setup.secOffers.map(id => { const X = SECTOR_BY[id]; return `<button class="secb${id === cur ? ' on' : ''}" data-act="sector" data-v="${id}" style="--c:${X.col}"><canvas class="zsw" width="144" height="48" data-zsw="${id}"></canvas><b>${esc(X.name)}</b></button>`; }).join('')}</div>
      <p class="note secnote"><b style="color:${S.col}">${esc(S.pitch)}</b> ${sectorLine(S)}${P ? ` · Most Wanted: ${esc(P)}` : ''}</p>`;
  }
  // the sector's poster boss, when it can show up by the first bounty (Wave 20)
  function sectorWantedName(id) { const S = SECTOR_BY[id], B = S && BOSSES.find(b => b.id === S.boss), M = S && WANTED_MODS.find(m => m.id === S.mod); return B && M && bossFrom(B) <= 20 ? `${M.name} ${B.name}` : ''; }
  function modeChips() {
    return `<div class="chips"><button class="chip ${setup.mode === 'std' ? 'on' : ''}" data-act="mode" data-v="std">Endless</button><button class="chip ${setup.mode === 'daily' ? 'on' : ''}" data-act="mode" data-v="daily" style="--c:#b86cff">Daily Hunt</button></div>`;
  }
  function renderDaily() {
    const spec = dailySpec(dailyKey());
    setRows(frRows(spec.chaos)); setCols(frCols(ROWS)); // 6.1: Daily Hunts fly too, on the fixed Frontier board (the same on every device)
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
  // the body class and the Lift Off button follow the run's rules (a resumed pre-6.1 run or an old recording plays Classic)
  function frModeUI() { document.body.classList.toggle('fr', !!(G && G.fr)); const lb = $('#bLift'); if (lb) { lb.hidden = !(G && G.fr); lb.dataset.l = ''; } }
  function launch(snap, tut) {
    closeModal();
    show('game');
    Render.reset();
    requestAnimationFrame(() => { Render.resize(); });
    feedLines.length = 0; renderFeed();
    if (snap && snap.rec) { const sv = PROF.runSnap; replayRun(snap.rec, { quiet: true, until: snap.rec.end }); PROF.runSnap = sv; G.resumedHunt = { tick: G.tick, h: runHash(), n: G.inputs.length, w: G.wave }; }
    else if (snap) resumeRun(snap);
    else if (tut) { const lid = typeof tut === 'string' ? tut : undefined; setRows(tutSpec(lid, 1).rows); setCols(frCols(ROWS)); newRun({ tut: TUT.v, frontier: 1, cols: COLS, rows: ROWS, lesson: lid }); } // 5.8 Training and lessons (6.1: on Frontier rules)
    else if (setup.mode === 'daily') { const sp = setup.daily; setRows(frRows(sp.chaos)); setCols(frCols(ROWS)); newRun({ seed: sp.seed, chaos: sp.chaos, startWave: 1, daily: sp, frontier: 1, cols: COLS, rows: ROWS, huntBuild: JSON.parse(JSON.stringify(huntBuildProf())), nemesis: sp.nemesis, sector: sp.sector || null }); } // 6.1: Frontier rules (the flag rides in recOpts, so resume, codes and ladder checks rebuild it)
    else {
      PROF.lastSetup = { startWave: setup.startWave, chaos: setup.chaos };
      newRun({ seed: setup.seed, chaos: setup.chaos, startWave: setup.startWave, cols: COLS, rows: ROWS, frontier: 1, nemesis: PROF.nemesis || null, sector: setupSector(), mastery: masteryRanks(), capT: capTowersOwned() }); // 6.1: every run is a Frontier run
    }
    Render.resetCam(); updateZoomBtn();
    frModeUI();
    G.unlocks = []; G.bestAtStart = PROF.bestWave; G.fresh = freshProfile() || !!G.tut;
    if (!snap && G.preAdapted) { const pa = G.preAdapted; setTimeout(() => { if (G && screen === 'game') toast('SWARM PRE-ADAPTED', `${pa.join(' and ')} already in its DNA. Plan your counters`, '#ff4d6a', 1); }, 1600); }
    hudFull = PROF.settings.hud === 'full';
    Render.full = hudFull; Render.nums = PROF.settings.dmgNums; Render.shakeOn = PROF.settings.shake; Render.glow = PROF.settings.glow !== false; Render.sharp = PROF.settings.sharp !== false; Render.zfx = zfxOn();
    zoneSeen = null; { const zb = $('#zoneBan'); if (zb) zb.hidden = true; } // 6.3: the zone banner shows once the field is clear
    document.body.classList.toggle('hudfull', hudFull);
    closePanel();
    buildAbilityBar();
    updateHud(true);
    Save.save();
    try { navigator.wakeLock && navigator.wakeLock.request('screen').catch(() => {}); } catch (e) {}
    // v5.3: no wall of rules on the first run. Glowing tiles show where to build; How to Play waits in the pause menu
    // (6.2: the WELCOME line and the camera tip now wait their turn in onboardingTick, with every other first-time card)
    G.wantedTold = !!snap || briefMode() === 'off' || !!G.tut;
    G.hints = !snap && !G.tut && !tutState().done && (PROF.bestWave || 0) < 10 && G.wave <= 1 ? buildHints() : null; Render.hints = G.hints; // 5.8: Training covers it
    if (G.tut) Coach.start(G.lesson || 'basic'); else Coach.stop();
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
  // 6.2 pacing (a friend's feedback: "you get spammed with dialog boxes"): every first-time card, teaching tip and nudge in a real
  // run goes through one gate. No two within TEACH_GAP seconds of play (G.time stops while a card holds the game), and never in a
  // busy moment: a tap in the last 2.5 s, aiming, the core picker or flight, enemies at the core, a boss closing in. A card that
  // has to wait is asked again next frame (its seen flag is set only when it shows). UI state only: nothing is written to G.
  const TEACH_GAP = 30;
  const TEACH_NOW = { boss: 1, wormhole: 1 }; // 6.2: these warn about the next wave, so they never wait behind the 30 s gap
  let teachG = null, teachAt = -1e9, teachTap = 0, camUser = 0; // camUser: camera moves made by the player (the Training camera step)
  const teachClock = () => { if (teachG !== G) { teachG = G; teachAt = -1e9; } return G ? G.time : 0; };
  function teachBusy() {
    if (!G) return false;
    if (performance.now() - teachTap < 2500 || G.aimAbility || frSel || G.frFly) return true;
    let n = 0; for (const e of G.enemies) if (!e.dead && !e.gen && e.L && e.L.len && e.d > e.L.len - 3.5) { if (e.boss) return true; n++; }
    return n >= 2 || G.enemies.some(e => e.boss && !e.dead && !e.gen && e.L && e.d > e.L.len * 0.6);
  }
  const teachOK = () => !!G && !G.tut && teachClock() - teachAt >= TEACH_GAP && !teachBusy();
  const teachMark = () => { teachClock(); if (G) teachAt = G.time; };
  // v5.3 one-time intro cards: each system says what it is the first time it shows up, in two lines
  function introCard(key, title, body, lesson) { // 5.8: lesson = the Field Manual entry its Learn more opens
    const S = PROF.seenSys || (PROF.seenSys = { v58: 1 }); if (S[key]) return false;
    if (modalOpen || Tree.isOpen || (G && G.draft)) return false;
    if (!TEACH_NOW[key] && !teachOK()) return true; // 6.2: it waits its turn (true: nothing after it in onboardingTick jumps the queue this frame); warnings tied to a moment skip the queue
    S[key] = 1; Save.save(); teachMark();
    if (briefMode() !== 'pause') { toast(title.toUpperCase(), body, '#6ae2ff', true, 'alert'); return true; }
    closePanel(); G.paused = true; G.briefing = true;
    modal(`<div class="card narrow brief intro"><div class="bi"><em>New</em><h3>${esc(title)}</h3><p class="desc">${tipify(body)}</p></div>
      <div class="foot">${lesson && LESSON_BY[lesson] ? `<button class="btn learn" data-act="lpage" data-v="${lesson}">Learn more</button>` : '<span class="note">Change this in Settings · Briefings</span>'}<button class="btn primary" data-act="brief">Got it</button></div></div>`, 'brief');
    return true;
  }
  let nudgeW = -99;
  function onboardingTick() {
    if (!G || G.over || screen !== 'game' || modalOpen || G.tut) return; // 5.8: Training has its coach instead
    if (G.hints &&(G.towers.length || G.wave >= 3)) { G.hints = null; Render.hints = null; }
    if (!PROF.seenHelp && G.time > 1) { if (!teachOK()) return; PROF.seenHelp = true; Save.save(); teachMark(); toast('WELCOME', 'Enemies walk the road to your core. Tap a glowing tile beside it to build a tower. How to Play is in the pause menu', '#59f0b4', true, 'alert'); return; }
    if (G.fr && G.time > 1 && introCard('frontier', 'Lift Off', `Your core can fly. Tap Lift Off, then a tile to land on: every road swings to follow. Land on a tower to dock it: the core fires that weapon, twice as hard. Towers near the landed core link up (+10% Damage and Rate). Towers can Move too (tower panel). The swarm is slow but tough. No building within ${FRONTIER.wormBuild} tiles of a wormhole.`, 'lift')) return;
    // 6.2: the camera, once, in a first real run (Training teaches it too). The core's edge arrow takes you home (qolA)
    if (!PROF.zoomHint && G.time > 4) { if (!teachOK()) return; PROF.zoomHint = 1; Save.save(); teachMark(); toast('LOOK AROUND', 'Drag to pan, pinch to zoom. Arrows at the screen edge point at what is off screen: tap one to look there. Tap the core arrow to come home.', '#6ae2ff', true, 'alert'); return; }
    if (G.wanted && !G.wantedTold && G.time > 2.6 && ((PROF.bestWave || 0) >= 15 || G.wave >= G.wanted.w - 12)) { if (!teachOK()) return; G.wantedTold = 1; teachMark(); wantedPoster(briefMode() === 'pause'); return; }
    if (G.storms.length && introCard('storm', 'Storms', 'Storms drift across the map and boost one element: towers of that element inside fight harder (they get an outline). Tap the storm chip to see exactly what it does.', 'storms')) return;
    if (G.caches.some(c => c.kind !== 'gold' && c.kind !== 'cursed') && introCard('crate', 'Salvage', 'Drop ships leave crates on the map. Tap one to claim it before it decays. A tower right next to a crate collects it for you.', 'salvage')) return;
    if (G.towers.some(t => t.pending > 0) && introCard('vet', 'Veterans', 'Towers that fight earn ranks. Tap the Ready button at the top right to pick each one a mutation.', 'veterans')) return;
    if (G.charges.stasis > 0 && G.abilOn && G.abilOn.stasis && introCard('abil', 'Abilities', 'The buttons on the left are abilities. Each recharges on its own timer (the bar fills); crates and bosses give extra charges that stack.', 'abilities')) return;
    // 5.8: one card for every other system, the first time it matters in a real run
    if (G.wave >= 2 && G.towers.length && !G.towers.some(t => t.lvl >= 2) && G.towers.some(t => G.credits >= upgradeCost(t)) && introCard('upg', 'Upgrades', 'Tap a tower to upgrade it: more damage and a random bonus. The arrow over a tower means you can afford it.', 'upgrades')) return;
    if (G.towers.length >= 3 && gridFree() < 1 && introCard('power', 'Power full', 'Every tower draws 1 power. Upgrade towers instead, or expand the reactor from the build menu.', 'power')) return;
    if (G.wave >= 6 && G.towers.length >= 3 && gridFree() >= 2 && introCard('spare', 'Spare power', 'Overcharge your best tower: open it and tap +1, or tap the ⚡ readout.', 'overcharge')) return;
    if (G.map.lanes.some(L => L.openWave && L.openWave > G.wave) && introCard('wormhole', 'Wormhole', 'A new road opens soon. The wave before it is a checkpoint: sell for full refunds and move towers to cover it.', 'wormholes')) return;
    if (G.anomOffers && introCard('anomaly', 'Entropy full', 'Tap the gauge on the right to draw an Anomaly: an upside and a downside for the rest of the run.', 'storms')) return;
    if (G.spawningDone && G.prep && G.prep.boss && introCard('boss', 'Boss next wave', 'Save Strike and Stasis for it. If it reaches the core, the run ends.', 'bosses')) return;
    if (!marketShut() && G.wave >= 10 && introCard('market', 'Exchange open', 'Tap Score at the top right: the Black Market sells items, Cash In turns credits into score.', 'market')) return;
    if (towerUnlocked('pylon') && G.wave >= 2 && introCard('support', 'Support towers', 'The Relay Pylon boosts the towers around it. The Credit Forge (Wave 12) pays every wave.', 'support')) return;
    { const nt = (G.capT || []).find(k => !(PROF.seenSys || {})['capT_' + k]); // 6.4: the first run with a new capstone tier tower
      if (nt && G.time > 3 && introCard('capT_' + nt, `New tower: ${TOWERS[nt].name}`, `${TOWERS[nt].blurb} ${TOWER_ROLE[nt].split(' · ')[0]}. It is in the build menu with a gold corner.`)) return; }
    if (typeof TOWER_FIRE !== 'undefined' && G.towers.some(t => fireModes(t.type).some(f => fireLearned(t.type, f.id))) && introCard('tech', 'Techniques', 'You learned a second fire mode. Open a tower of that type: the Fire row switches it.', 'techniques')) return;
    // credits piling up: say so once in a while, with what to do about it
    if (G.spawningDone && G.wave >= 6 && G.wave - nudgeW >= 8 && G.towers.length) {
      const cheap = Math.min(...G.towers.map(t => upgradeCost(t))), lim = Math.max(900, cheap * 4, 250 * G.wave);
      if (G.credits > lim && teachOK()) { nudgeW = G.wave; teachMark(); toast('CREDITS PILING UP', `${fmt(G.credits)} credits banked. Spend them: the arrow marks your best upgrade, or build, expand the reactor, or reinforce the core's Hull${G.wave >= 28 ? '. Leeches steal from big banks' : ''}`, '#ffb03a', false, 'alert'); }
    }
  }

  // ---------- 5.8 Training and the Field Manual ----------
  // PROF.tut: { seen (offered or started), done (Basic Training finished), paid (its reward given), lessons: { id: 1 } }.
  // A fresh profile is offered Basic Training on its first Play. The Field Manual (How to Play) lists every lesson with a % complete.
  // Runs are sim data (TUT, LESSONS[].run, newRun({ tut, lesson })); the coach below only watches and holds the game.
  const tutState = () => PROF.tut || (PROF.tut = {});
  // (skipped under automation like the splash, so the older Playwright tests reach New Run; tutorialshot.py sets window.tutOfferTest)
  const tutOffer = () => (!navigator.webdriver || window.tutOfferTest) && !PROF.runSnap && !(PROF.runs > 0) && !(PROF.bestWave > 0) && !tutState().seen;
  const tutReward = () => xpForLevel(0) + xpForLevel(1); // two talent points on a fresh profile
  function openTutOffer() {
    modal(`<div class="card narrow tutoffer"><div class="ch"><h2>First Time?</h2></div>
      <p>Basic Training is a short guided run: build, upgrade, fly the core, read the swarm, claim a bounty. About 7 minutes.</p>
      <p class="note">Finishing it pays ${fmt(tutReward())} XP: two talent points. Every lesson stays in the Field Manual (the ? button).</p>
      <div class="foot"><button class="btn" data-act="tutSkip">Skip</button><button class="btn primary" data-act="tutGo">Training · 7 min</button></div></div>`, 'tutoffer');
  }
  // the Tutorial button (hangar and pause menu): Basic Training or the Field Manual
  function openTutPick() {
    if (G && !G.over) G.paused = true;
    const inRun = !!(G && !G.over && !G.tut), S = tutState();
    modal(`<div class="card narrow tutpick"><div class="ch"><h2>Tutorial</h2><button class="x" data-act="close2" aria-label="Close">✕</button></div>
      <div class="tpick"><button class="lrow basic${S.done ? ' done' : ''}" data-act="tutStart"><i>${S.done ? '✓' : ''}</i><b>Basic Training</b><span>Build, upgrade, fly the core, a bounty: step by step, about 7 minutes.</span></button>
      <button class="lrow" data-act="manual"><i></i><b>Field Manual</b><span>A short lesson for every system · ${lessonPct()}% done.</span></button></div>
      ${inRun ? '<p class="note">Your run is saved first. Resume it from the main menu.</p>' : ''}</div>`, 'tutpick');
  }
  // leaving a real run for a lesson keeps it: it is saved and resumes from the hangar
  function startTut(lesson) {
    if (G && !G.over && !G.tut) { snapshotNow(); G = null; }
    if (!lesson) tutState().seen = 1;
    Save.save(); closeModal(); closePanel();
    if (lesson && LESSON_BY[lesson] && LESSON_BY[lesson].tour) { G = null; show('hangar'); renderHangar(); Coach.start(lesson); return; } // a walk through the hangar
    launch(null, lesson || true);
  }
  // the end of Basic Training: the reward once, the intro cards it covered marked as seen, and where to go next
  function openTutDone() {
    if (G.lesson) { if (G.extracted) return lessonDone(); Coach.stop(); G = null; closeModal(); show('hangar'); renderHangar(); openManual(); return; } // the Bounties lesson can end by extracting; abandoning goes back to the manual
    const S = tutState(), first = !S.paid;
    if (!G.extracted) { Coach.stop(); G = null; closeModal(); show('hangar'); renderHangar(); return; } // abandoned from the pause menu
    S.done = 1; S.seen = 1;
    const before = profLevel().level;
    if (first) { S.paid = 1; PROF.xp += tutReward(); }
    PROF.seenHelp = true; PROF.seenEvo = true; Object.assign(PROF.seenSys || (PROF.seenSys = {}), { abil: 1, upg: 1, frontier: 1 }); // 6.1: Training taught Lift Off, docking, links and Move
    Save.save();
    const L = profLevel(), pts = pointsFree();
    modal(`<div class="card narrow tutdone"><div class="ch"><h2 class="good">Training Complete</h2><span class="note">Extracted · Wave ${G.wave}</span></div>
      ${first ? `<div class="bigstats"><span>XP<b>+${fmt(tutReward())}</b></span><span>Level<b>${L.level}${L.level > before ? ' ▲' : ''}</b></span><span>Talent points<b>${pts}</b></span></div>` : '<p class="note">Reward already claimed. This one was practice.</p>'}
      <p>That's the loop: build, upgrade, dock the core where it counts, read the Threat Board, answer the swarm, claim the bounty and get out.</p>
      <p class="note">Real runs are endless and random: new enemies every few waves, storms, salvage, a bounty every 20 waves. ${pts > 0 ? 'Spend your talent points first. ' : ''}The Field Manual has a lesson for every system.</p>
      <div class="foot"><button class="btn" data-act="hangar">Main Menu</button><button class="btn" data-act="web">Talents</button><button class="btn primary" data-act="again">First Run</button></div></div>`, 'over');
    Coach.stop();
  }
  const lessonPct = () => { const L = lessonsOpen(), D = tutState().lessons || {}; return Math.round(100 * (L.filter(x => D[x.id]).length + (tutState().done ? 1 : 0)) / (L.length + 1)); };
  function lessonDone(id) {
    id = id || (G && G.lesson); const S = tutState(); (S.lessons || (S.lessons = {}))[id] = 1; Save.save();
    Coach.stop(); closePanel(); if (G) G = null;
    show('hangar'); renderHangar(); openManual(id, true);
  }
  // the Field Manual: Basic Training, every lesson (done marks, %), and the Dictionary
  let manTab = 'lessons';
  function openManual(id, justDone) {
    if (G && !G.over) G.paused = true;
    const S = tutState(), D = S.lessons || {}, inRun = !!(G && !G.over);
    if (id && LESSON_BY[id]) {
      const L = LESSON_BY[id];
      modal(`<div class="card narrow manual lpage"><div class="ch"><h2>${esc(L.title)}</h2>${D[id] ? '<span class="note good">Done</span>' : ''}<button class="x" data-act="close2" aria-label="Close">✕</button></div>
        ${justDone ? `<p class="good">Lesson complete. ${esc(L.real)}</p>` : ''}
        <div class="lwhat"><b>What it is</b><span>${tipify(L.what)}</span><b>When it matters</b><span>${tipify(L.when)}</span><b>What to do</b><span>${tipify(L.todo)}</span></div>
        <div class="foot"><button class="btn" data-act="manual">All lessons</button><button class="btn primary" data-act="lesson" data-v="${id}">${inRun ? 'Play lesson · saves your run' : D[id] ? 'Play again' : 'Play lesson'}</button></div></div>`, 'manual');
      return;
    }
    const row = (L, done) => `<button class="lrow${done ? ' done' : ''}" data-act="lpage" data-v="${L.id}"><i>${done ? '✓' : ''}</i><b>${esc(L.title)}</b><span>${esc(L.blurb)}</span></button>`;
    if (manTab === 'dict') return openHelp('dict');
    const body = `<div class="lgrid">
        <button class="lrow basic${S.done ? ' done' : ''}" data-act="tutStart"><i>${S.done ? '✓' : ''}</i><b>Basic Training</b><span>The whole loop in one guided run, about 7 minutes${S.paid ? '' : ` · +${fmt(tutReward())} XP`}.</span></button>
        ${lessonsOpen().map(L => row(L, D[L.id])).join('')}</div>`;
    modal(`<div class="card help manual"><div class="ch"><h2>Field Manual</h2><span class="note">${lessonPct()}% complete</span><button class="x" data-act="close2" aria-label="Close">✕</button></div>
      <div class="chips gtabs"><button class="chip on" data-act="mtab" data-v="lessons">Lessons</button><button class="chip" data-act="htab" data-v="dict">Dictionary</button></div>
      ${body}</div>`, 'help');
  }
  // The coach. Each step points at one thing (a spotlight that dims the rest, a pulsing ring, an arrow), says a line or two, and moves on
  // when the player does it: it watches state every frame (towers, panels, waves, kills, charges, modals), never a timer. Steps that wait
  // for the player hold the game (UI.coachHold, read by the frame loop). No sim state is touched, so the recording replays exactly.
  // The card lets taps through except its buttons, and always carries Skip (two taps). Between steps an idle line says what to do now.
  // PLANS: one step list per lesson id ('basic' is Basic Training). A step: { id, when, skip, hold, at (target rect), t, b, ok (button
  // label for a read step), okFn, done, back (step id to return to), enter, leave, modal (the modal kind it shows over), tree, idle }.
  const Coach = (() => {
    let on = false, plan = 'basic', i = 0, cur = null, el = null, held = false, sig = '', skipT = -1e9, mem = {}, miss = false;
    const STEPS = () => PLANS[plan] || [];
    const W = () => G ? tutIdx(G.wave) : 0; // the script's wave number
    const cleared = () => G.spawningDone && G.enemies.every(e => e.dead);
    const after = w => W() >= w && cleared(); // script wave w is over and the next has not started
    const q = s => document.querySelector(s);
    const appR = n => { if (!n || n.offsetParent === null) return null; const r = n.getBoundingClientRect(); return r.width || r.height ? { x: r.left / UIS, y: r.top / UIS, w: r.width / UIS, h: r.height / UIS } : null; };
    const sel = s => () => appR(q(s));
    let wAt = null; // the world point the current target sits on (worldR), so the camera can bring it on screen
    function worldR(x, y, rad) { wAt = { x, y }; const c = $('#cv').getBoundingClientRect(), a = Render.tileToScreen(x - rad, y - rad), b = Render.tileToScreen(x + rad, y + rad); return { x: c.left / UIS + a.x, y: c.top / UIS + a.y, w: b.x - a.x, h: b.y - a.y }; }
    const enemyR = e => e && !e.dead ? worldR(e.x, e.y, e.boss ? 1.1 : 0.6) : null;
    const towerR = t => t && G.towers.includes(t) ? worldR(t.cx, t.cy, 0.62) : null;
    const onField = e => !e.dead && e.d > 1.2 && e.d < e.L.len - 2;
    // the free tile beside a road that covers the most of it, not touching a tower (sim state only; no G.r)
    function spotFor(type, lane, near, ok) { // ok(x, y): an extra condition on the tile
      const R = G.region, road = (lane || G.map.lanes[0]).tiles, rg = type === 'rail' ? 3.6 : 2.4; let best = null;
      for (let y = R.y0; y < R.y1; y++) for (let x = R.x0; x < R.x1; x++) {
        if (!canBuildAt(x, y) || G.towers.some(t => Math.abs(t.x - x) <= 1 && Math.abs(t.y - y) <= 1 && !near) || (ok && !ok(x, y))) continue;
        let s = 0; if (near) s = -G.towers.reduce((a, t) => a + Math.hypot(t.x - x, t.y - y), 0); else for (const p of road) if (Math.hypot(p.x - x, p.y - y) <= rg) s++;
        if (!best || s > best.s) best = { x, y, s };
      }
      return best;
    }
    // building is three taps (tile, card, Build): the target and the line follow where the player is
    const flowStage = type => panel && panel.kind === 'build' ? (pick === type ? 2 : 1) : 0;
    function flowAt(type, key, lane, near, ok) {
      const st = flowStage(type);
      if (st === 1) return appR(q(`#panel [data-act=pick][data-type=${type}]`));
      if (st === 2) return appR(q('#panel [data-act=build]')) || appR(q('#panel [data-act=reactor]'));
      let s = mem[key]; if (!s || !canBuildAt(s.x, s.y)) s = mem[key] = spotFor(type, lane, near, ok) || (ok && spotFor(type, lane, near));
      if (!s) return null;
      Render.hints = [s];
      return worldR(s.x + 0.5, s.y + 0.5, 0.62); // (an off-screen spot is brought into view by see(), for every world target)
    }
    // 6.1 the camera: a world target that is off screen (or under a side panel) is brought into view, once per step and spot;
    // and one the card can't help covering (a small phone stage) is moved to the side of the stage away from the card
    function see(S, r, c) {
      if (!r || !wAt || !G || screen !== 'game' || S.modal || S.tree) return false;
      const key = S.id + ':' + Math.round(wAt.x * 2) + ',' + Math.round(wAt.y * 2); if (c ? mem.cam !== key || mem.camC === key : mem.cam === key) return false;
      const cv = $('#cv').getBoundingClientRect(), L = Render.layout; if (!cv.width || Math.abs(cv.width / UIS - L.W) > 2 || Math.abs(cv.height / UIS - L.H) > 2 || (Render.home && Math.abs(Render.zoom - Render.homeZoom) > 1e-3)) return false; // the camera is not settled yet: try next frame
      const pn = panel ? appR($('#panel')) : null, ox = cv.left / UIS, p = Render.tileToScreen(wAt.x, wAt.y);
      let x0 = 0, x1 = L.W; if (pn) { const a = pn.x - ox, b = a + pn.w; if (a > L.W / 2) x1 = Math.min(x1, a); else x0 = Math.max(x0, b); }
      const m = 48;
      if (c) { // the card covers the target: send the target to the far side from the card
        mem.camC = key; if (!ov(c, grow(r, 8))) return false; // (the ring sits 5 px outside the target)
        const left = c.x + c.w / 2 - ox < (x0 + x1) / 2, top = c.y + c.h / 2 - cv.top / UIS < L.H / 2;
        Render.panBy((left ? x0 + (x1 - x0) * 0.76 : x0 + (x1 - x0) * 0.24) - p.x, (top ? L.H * 0.7 : L.H * 0.3) - p.y); updateZoomBtn(); return true;
      }
      mem.cam = key;
      if (p.x >= x0 + m && p.x <= x1 - m && p.y >= m && p.y <= L.H - m) return false;
      if (Math.abs((x0 + x1) / 2 - p.x) < 2 && Math.abs(L.H / 2 - p.y) < 2) return false;
      Render.panBy((x0 + x1) / 2 - p.x, L.H / 2 - p.y); updateZoomBtn(); return true;
    }
    const flowText = (type, first) => { const D = TOWERS[type], st = flowStage(type);
      return st === 0 ? first : st === 1 ? `Tap ${D.name}: ${TOWER_ROLE[type] || D.blurb}.` : `Tap Build: ${fmt(towerCost(type))} credits and 1 power.`; };
    const has = type => G.towers.some(t => t.type === type);
    const afford = type => G.credits >= towerCost(type);
    const topEl = () => { const D = G.stats.dmgByEl; let b = 'K'; for (const k of ELS) if ((D[k] || 0) > (D[b] || 0)) b = k; return b; };
    const counterOf = () => topEl() === 'C' ? 'pulse' : 'cryo';
    const geneEnemy = g => G.enemies.find(e => onField(e) && e.genes && e.genes.includes(g));
    function pack() { // the densest knot of enemies on the road: [x, y, count]
      let best = null; const L = G.enemies.filter(e => !e.dead && !e.boss && onField(e));
      for (const e of L) { let n = 0, sx = 0, sy = 0; for (const o of L) if (dist2(o.x, o.y, e.x, e.y) <= 2.4) { n++; sx += o.x; sy += o.y; } if (!best || n > best[2]) best = [sx / n, sy / n, n]; }
      return best;
    }
    const tw = () => G.towers[0], noTw = () => !G.towers.length;
    // the Basic Training checklist, in the order the coach teaches it; each line ticks from game state, so doing things early still counts
    const used = n => (G.inputs || []).some(x => x[1] === n), lvls = () => G.towers.reduce((a, t) => a + t.lvl - 1 + (t.asc || 0), 0);
    const CHECK = [['Place a tower', () => G.towers.length >= 1], ['Call a wave early', () => used('call')], ['Upgrade a tower', () => lvls() >= 1], ['Read its bonus', () => !!mem.affix],
      ['Lift Off: dock on a tower', () => (mem.dk = mem.dk || !!(G.fr && frDockT()))], ['Link towers to the core', () => (mem.lk = mem.lk || (G.frLinks || []).length > 0)], ['Move a tower', () => used('frMove')], // 6.1 Frontier
      ['Upgrade again', () => lvls() >= 2], ['Core: Shield', () => G.core.sLvl >= 2], ['Core: Battery', () => G.core.wLvl >= 2], ['Veteran: tap Ready, pick', () => used('vet') || used('ascPick')], ['Use Strike', () => used('abil')],
      ['Pick a specialty (LV 3)', () => G.towers.some(t => t.spec)], ['Beat the bounty boss', () => G.bounties.length > 0], ['Extract', () => !!G.extracted]];
    let listEl = null, listSig = '', listOpen = false, flashT = 0;
    try { listOpen = localStorage.getItem('entropy.tutlist') === '1'; } catch (e) { /* private mode: closed by default */ }
    function list() {
      if (plan !== 'basic' || !G || !G.tut) { if (listEl) listEl.hidden = true; return; }
      if (!listEl || !listEl.isConnected) {
        listEl = document.createElement('button'); listEl.id = 'tutlist'; listEl.type = 'button';
        listEl.onclick = () => { listOpen = !listOpen; listSig = ''; SFX.play('ui'); try { localStorage.setItem('entropy.tutlist', listOpen ? '1' : '0'); } catch (e) {} };
        $('#stage').appendChild(listEl);
      }
      // the full list shows while nothing waits on the player; during a held step it folds to its strip (the current task) so the coach card has room
      const open = listOpen && !held, ok = CHECK.map(c => !!c[1]()), n = ok.filter(Boolean).length, now = ok.indexOf(false), key = ok.join('') + open + listOpen;
      listEl.hidden = !!modalOpen && modalOpen !== 'hunt';
      if (key === listSig) return;
      if (listSig && n > (+listEl.dataset.n || 0)) { listEl.classList.add('flash'); clearTimeout(flashT); flashT = setTimeout(() => listEl && listEl.classList.remove('flash'), 1200); }
      listSig = key; listEl.dataset.n = n; listEl.classList.toggle('open', open);
      listEl.innerHTML = `<span class="tlh">Training ${n}/${CHECK.length}<i>${listOpen ? '▾ hide' : '▸ list'}</i></span><span class="tlcur">${now < 0 ? 'All done' : `${now + 1}. ${esc(CHECK[now][0])}`}</span>
        <ol>${CHECK.map((c, k) => `<li class="${ok[k] ? 'ok' : k === now ? 'now' : ''}"><b>${ok[k] ? '✓' : k + 1}</b>${esc(c[0])}</li>`).join('')}</ol>`;
    }
    const allSpots = () => { const R = G.region, out = []; for (let y = R.y0; y < R.y1; y++) for (let x = R.x0; x < R.x1; x++) if (canBuildAt(x, y)) out.push({ x, y }); return out; };
    const packAt = () => { if (!mem.pk) mem.pk = pack(); if (!mem.pk) { const e = G.enemies.find(x => !x.dead); if (e) mem.pk = [e.x, e.y, 1]; } return mem.pk ? worldR(mem.pk[0], mem.pk[1], 1.7) : null; };
    const shut = () => { if (panel && panel.kind === 'tower') closePanel(); }; // a new tower opens its panel; the next step needs the field
    const panT = () => panel && panel.kind === 'tower' ? panel.t : null;
    const closeM = () => { closeModal(); if (G && !G.over) G.paused = false; };
    // the tower the upgrade arrow floats over (render.js: the lowest-level tower you can afford to upgrade, cheapest first)
    function bestUp() { let best = null, bl = Infinity, bc = Infinity; for (const t of G.towers) { const c0 = upgradeCost(t); if (G.credits < c0) continue; const n = towerLevel(t), k = t.lvl < MAX_LV ? n : 100 + n; if (k < bl || (k === bl && c0 < bc)) { best = t; bl = k; bc = c0; } } return best; }
    const stat = t => ({ lvl: towerLevel(t), dmg: t.s.dmg, rate: t.s.rate, range: t.s.range, aff: t.affixes.length });
    function upLine(t, b4) {
      if (!t || !b4) return '';
      const n = stat(t), a = t.affixes.length > b4.aff ? t.affixes[t.affixes.length - 1] : null, parts = [];
      if (n.dmg !== b4.dmg) parts.push(`Damage ${fmt(b4.dmg)} → ${fmt(n.dmg)}`); if (n.rate !== b4.rate) parts.push(`rate ${num1(b4.rate)} → ${num1(n.rate)}/s`); if (n.range !== b4.range) parts.push(`range ${num1(b4.range)} → ${num1(n.range)}`);
      return `LV ${b4.lvl} → LV ${n.lvl}. ${parts.join(', ')}.${a ? ` It also rolled a random bonus: ${affixText(a)}.` : ''}`;
    }
    // ---- step builders ----
    const info = (id, at, t, b, x) => Object.assign({ id, hold: 1, ok: 'Got it', at, t, b }, x || {});
    const call = (id, w, b, x) => Object.assign({ id, free: 1, at: sel('#bCall'), t: () => `Wave ${(G.startWave || 1) - 1 + w}`, b: b || 'Tap Next, or let the timer run.', done: () => W() >= w || (G.next <= 0 && G.spawningDone), skip: () => W() >= w }, x || {});
    const build = (id, type, key, t, first, x) => Object.assign({ id, hold: () => afford(type) && gridFree() >= 1, at: () => flowAt(type, key), t,
      b: () => !afford(type) ? `${TOWERS[type].name} costs ${fmt(towerCost(type))} credits. Kills pay; the next wave is coming.` : gridFree() < 1 ? 'The grid is full: upgrade instead.' : flowText(type, first), done: () => has(type), leave: shut }, x || {});
    const tapTw = (id, get, t, b, x) => Object.assign({ id, hold: 1, at: () => towerR(get()), t, b, done: () => !!get() && panT() === get() }, x || {});
    const intro = (id, t, b) => ({ id, hold: 1, ok: 'Start', t, b });
    const end = id => ({ id: 'end', hold: 1, ok: 'Finish', t: 'Lesson complete', b: () => LESSON_BY[plan].real, okFn: () => lessonDone(plan) });
    const threatOpen = (id, t, b, x) => Object.assign({ id, hold: 1, at: () => appR(q('#chips [data-threat]')), t, b, done: () => modalOpen === 'evo',
      ok: () => appR(q('#chips [data-threat]')) ? null : 'Open it', okFn: () => openThreat() }, x || {}); // on a narrow top bar the chip can fold into +N: the card opens the board itself
    const inThreat = (id, at, t, b, x) => Object.assign({ id, hold: 1, modal: 'evo', ok: 'Got it', at, t, b, okFn: closeM, skip: () => modalOpen !== 'evo' }, x || {});
    const rowOf = k => () => { const c = q(`#modal canvas[data-eico=${k}]`); return c ? appR(c.closest('.threv')) : null; };
    const scrollTo = s => () => { const n = q(s); if (n) n.scrollIntoView({ block: 'center' }); };
    // ---- 6.1 Frontier: Lift Off, docking, links and moving a tower (Basic Training after the Rail Lance, and the 'lift' lesson) ----
    const frOn = () => !!(G && G.fr);
    const inPick = k => !!(frSel && frSel.kind === k);
    // a tile beside the last stretch of the main road, clear of the wormholes: a Rail Lance there is a dock that keeps most of the road
    const dockable = (x, y) => { const L = G.map.lanes[0], R = G.region; if (x <= R.x0 || y <= R.y0 || x >= R.x1 - 1 || y >= R.y1 - 1) return false;
      if (G.map.lanes.some(l => Math.abs(l.tiles[0].x - x) + Math.abs(l.tiles[0].y - y) < FRONTIER.wormGap)) return false;
      const k = L.tiles.findIndex(p => Math.abs(p.x - x) + Math.abs(p.y - y) === 1); return k >= L.tiles.length * 0.68; };
    // the tower to dock on: a landing the sim allows that keeps the most road (a Rail Lance first); else the open tile nearest the core
    function dockPick() { let best = null; for (const t of G.towers) { if (!canOvercharge(t) || t.mvT > 0) continue; const P = frPlan(t.x, t.y); if (!P) continue; const sc = Math.min(...P.after) + (t.type === 'rail' ? 1000 : 0); if (!best || sc > best.sc) best = { t, sc }; } return best ? best.t : null; }
    function landPick() { let best = null; for (const i of frCands()) { const x = i % COLS, y = (i / COLS) | 0; if (G.towerAt[i]) continue; const d = Math.hypot(x - G.map.core.x, y - G.map.core.y); if (d < 2 || (best && d >= best.d)) continue; if (frPlan(x, y)) best = { x, y, d }; } return best; }
    const dockT = () => mem.dock && G.towers.includes(mem.dock) ? mem.dock : null;
    // the tower to move: an attack tower the core doesn't link, covering the least road; its tile: in link reach, covering the most road
    const roadIn = (x, y, rg) => { let n = 0; for (const L of G.map.lanes) for (const p of L.tiles) if (Math.hypot(p.x - x, p.y - y) <= rg) n++; return n; };
    const mvT = () => { if (mem.mv === undefined || (mem.mv && !G.towers.includes(mem.mv))) { let best = null; for (const t of G.towers) { if (!canOvercharge(t) || t === frDockT() || t.mvT > 0) continue; const sc = roadIn(t.x, t.y, t.s.range) + ((G.frLinks || []).includes(t) ? 1000 : 0); if (!best || sc < best.sc) best = { t, sc }; } mem.mv = best ? best.t : null; mem.mvL = !!best && (G.frLinks || []).includes(best.t); } return mem.mv; }; // (an unlinked tower first)
    const mvNear = d => !!d && dist2(d.x + 0.5, d.y + 0.5, G.core.x, G.core.y) <= (FRONTIER.linkR - 0.4) ** 2;
    function mvTo() {
      const t = mvT(); if (!t) return null; if (mem.mvTo && canBuildAt(mem.mvTo.x, mem.mvTo.y)) return mem.mvTo;
      const R = G.region; let best = null;
      for (let y = R.y0; y < R.y1; y++) for (let x = R.x0; x < R.x1; x++) { if (!canBuildAt(x, y)) continue; const sc = (mvNear({ x, y }) ? 1000 : 0) + roadIn(x, y, t.s.range) - Math.hypot(x + 0.5 - G.core.x, y + 0.5 - G.core.y) * 0.01; if (!best || sc > best.sc) best = { x, y, sc }; }
      return (mem.mvTo = best);
    }
    const flew = () => (G.frN || 0) > (mem.fn0 ?? 1e9), lifting = () => mem.fn0 !== undefined; // (the Lift Off step ran)
    function frSteps(when, gone) { // when: the steps may start; gone: the moment has passed (the next wave began)
      const off = () => !frOn() || gone(), back = () => !inPick('land') && !flew() && frCanFly() && 'lift', mvBack = () => !panT() && !inPick('move') && !used('frMove') && 'mvTap';
      return [
        { id: 'lift', ls: 'lift', when, hold: 1, at: sel('#bLift'), t: 'Lift Off', enter: () => { closePanel(); mem.dock = dockPick(); mem.land = mem.dock ? null : landPick(); mem.fn0 = G.frN || 0; },
          b: () => dockT() ? `Your core can fly. Land it on your ${TOWERS[dockT().type].name} and the core fires it, twice as hard. Tap Lift Off.` : 'Your core can fly, and the roads follow wherever it lands. Tap Lift Off.',
          done: () => inPick('land'), skip: () => off() || (!frCanFly() && !inPick('land')) },
        { id: 'pick', hold: 1, at: () => dockT() ? towerR(dockT()) : mem.land ? worldR(mem.land.x + 0.5, mem.land.y + 0.5, 0.62) : null, t: 'Pick a landing spot',
          b: () => dockT() ? `The game waits while you choose. A framed tower can be docked. Tap your ${TOWERS[dockT().type].name}.` : 'The game waits while you choose. Tap the marked tile.',
          done: () => inPick('land') && !!frSel.plan, skip: () => off() || flew() || !lifting(), back },
        { id: 'preview', hold: 1, ok: 'Next', at: () => appR(q('#panel .frdock')) || appR(q('#panel .sg')), t: 'The preview',
          b: 'Road length before and after: a shorter road means enemies arrive sooner (the dashed amber line is the new road). Below it: what the core will fire, and which towers it will link.',
          done: () => flew(), skip: () => off() || flew() || !lifting() || !(inPick('land') && frSel.plan), back },
        { id: 'land', hold: 1, at: sel('#panel [data-act=frgo]'), t: () => frSel && frSel.plan && frSel.plan.dock ? 'Land and dock' : 'Land here',
          b: 'Tap it. Every road swings to the landing spot at once. In the air the core’s gun is off and its shield is down.', done: () => flew(), skip: () => off() || !lifting(), back },
        { id: 'docked', when: () => !G.frFly, hold: 1, ok: 'Next', at: () => worldR(G.core.x, G.core.y, 1.1), t: () => frDockT() ? 'Docked' : 'Landed', skip: () => off() || !flew(),
          b: () => { const d = frDockT(); return d ? `The core fires the ${TOWERS[d.type].name} now: ×${num1(frDockX())} damage, +${FRONTIER.dockRange} range, and Battery upgrades raise it. Lift off again later and the tower is set back down, intact.` : 'Here the core fires its plain cannon. Land on an attack tower to dock it.'; } },
        { id: 'links', when: () => !G.frFly, hold: 1, ok: 'Next', at: () => worldR(G.core.x, G.core.y, 1.1), t: 'Links', skip: off,
          b: () => { const n = (G.frLinks || []).length; return `${n ? `The green lines link ${n} tower${n === 1 ? '' : 's'} to the core` : 'No tower is linked yet'}. The landed core links the ${frLinkN()} nearest attack towers within ${FRONTIER.linkR} tiles: each gets +${pct(FRONTIER.linkDmg)} damage and rate, and the core +${pct(FRONTIER.linkCore)} per link.`; } },
        tapTw('mvTap', mvT, 'Move a tower', () => `${mem.mvL ? `Towers can move too. Your ${TOWERS[mvT().type].name} can cover more road` : roadIn(mvT().x, mvT().y, mvT().s.range) ? `Your ${TOWERS[mvT().type].name} is out of link reach` : `Your ${TOWERS[mvT().type].name} guards empty ground now`}. Tap it.`,
          { ls: 'move', when: () => !G.frFly, skip: () => off() || used('frMove') || !mvT() }),
        { id: 'mvBtn', hold: 1, at: sel('#panel [data-act=frmove]'), t: 'Move', b: () => `Tap Move: ${fmt(frMoveFee(mvT()))} credits, ${pct(FRONTIER.moveFee)} of what it cost.`, done: () => inPick('move'), skip: () => off() || used('frMove') || !mvT(), back: mvBack },
        { id: 'mvPick', hold: 1, at: () => { const d = mvTo(); if (!d) return null; Render.hints = [d]; return worldR(d.x + 0.5, d.y + 0.5, 0.62); }, t: 'Its new tile',
          b: () => mvNear(mvTo()) ? `Tap the marked tile: in reach of the core, so it ${mem.mvL ? 'stays linked' : 'links'}.` : 'Tap the marked tile: it covers more road.', done: () => inPick('move') && !!frSel.dest, skip: () => off() || used('frMove'), back: mvBack },
        { id: 'mvGo', hold: 1, at: sel('#panel [data-act=frmovego]'), t: 'Move here', b: `It flies over and is offline for ${FRONTIER.moveT} s. Tap Move here.`, done: () => used('frMove'), skip: off, back: mvBack },
        info('moved', () => towerR(mvT()), () => (G.frLinks || []).includes(mvT()) ? 'Linked' : 'Moved', () => `${(G.frLinks || []).includes(mvT()) ? 'A green line joins it to the core. ' : ''}A move costs ${pct(FRONTIER.moveFee)} of what the tower cost: when the roads swing, move towers instead of selling them.`,
          { when: () => !mvT() || !(mvT().mvT > 0), skip: () => off() || !mvT() || !used('frMove'), leave: shut }),
      ];
    }
    const PLANS = {
      basic: [
        // 6.2 pacing: each ls starts a lesson; a new lesson waits for ~20 s of play or the end of a wave (Coach.paced)
        { id: 'core', ls: 'start', hold: 1, ok: 'Next', at: () => worldR(G.core.x, G.core.y, 1.1), t: 'Your core', b: 'Enemies walk the road to it. If its health runs out, the run is over.' },
        info('hp', sel('#hud .corebox'), 'Core health', () => `${Math.round(G.core.hp)} health plus ${Math.round(G.core.shield)} shield. Leaks hit the shield first; it recharges between hits.`, { ok: 'Next' }),
        { id: 'road', hold: 1, ok: 'Next', at: () => { const p = G.map.lanes[0].pts[0]; return worldR(p.x, p.y, 1); }, t: 'The road', b: 'Enemies come out of the wormhole and follow the road. Towers beside it shoot them.' },
        { id: 'spots', hold: 1, nodim: 1, ok: 'Next', t: 'Build spots', b: () => `Every green tile is a build spot: a tower fits on any of them. Beside the road is best.${G.fr ? ` Nothing can be built within ${FRONTIER.wormBuild} tiles of a wormhole.` : ''}`, enter: () => { Render.spots = allSpots(); }, leave: () => { Render.spots = null; } },
        build('build1', 'pulse', 'a', 'Build a tower', 'Tap the marked tile beside the road.', { hold: 1 }),
        { id: 'call1', hold: 1, at: sel('#bCall'), t: 'Start the wave', b: 'The top bar counts down to each wave; at zero it starts on its own. Tap Next to send Wave 1 now: calling early pays bonus credits.', done: () => G.wave >= 1 || G.next <= 0 },
        // the camera (6.2), once the first wave is under way
        { id: 'camera', ls: 'camera', hold: 1, nodim: 1, ok: 'Got it', when: () => W() >= 1, skip: () => W() >= 3, enter: () => { mem.cu0 = camUser; }, done: () => camUser - mem.cu0 > 12, t: 'Look around',
          b: 'Drag to pan, pinch to zoom. When something is off screen, an arrow at the edge points to it: tap one to look there. Tap the core arrow to come back home.' },
        info('credits', sel('#hud .hs.cr'), 'Credits', 'Every kill pays credits. You spend them on towers and upgrades.', { ls: 'money', when: () => G.kills >= 1, skip: () => W() >= 3 }),
        info('score', sel('#bCash'), 'Score', 'Kills and waves raise your score. It turns into XP: levels and talent points.', { skip: () => W() >= 3 }),
        build('build2', 'pulse', 'b', 'A second tower', 'Build another one on the marked tile.', { ls: 'power', when: () => after(1), skip: () => W() >= 2, done: () => G.towers.length >= 2,
          at: () => flowAt(pick && TUT.towers.includes(pick) ? pick : 'pulse', 'b'), b: () => afford('pulse') ? flowText(pick && TUT.towers.includes(pick) ? pick : 'pulse', 'Build another one on the marked tile. Any tower works.') : `Towers start at ${towerCost('pulse')} credits. Kills pay.` }),
        info('power', sel('#hud .hs.pwr'), 'Power', () => `⚡ ${gridUsed()}/${gridCap()}: full. Each tower draws 1 power, and capacity grows as waves pass. In real runs, towers on Power Nodes (diamond tiles) use none.`, { when: () => after(1), skip: () => W() >= 2 }),
        call('call2', 2, 'Tap Next, or let the timer run. Power is full, so the next credits go into upgrades.', { when: () => after(1) }),
        // upgrading, step by step (Nic's brother: "didn't understand how to upgrade towers or what that meant")
        tapTw('tapTower', tw, 'Upgrade', 'Towers you built can be tapped. Tap your first tower to open its panel.', { ls: 'upgrade', when: () => after(2), skip: () => W() >= 3 || noTw(), hold: () => G.credits >= upgradeCost(tw()),
          b: () => G.credits >= upgradeCost(tw()) ? 'Towers you built can be tapped. Tap your first tower to open its panel.' : `An upgrade costs ${upgradeCost(tw())} credits. Kills pay.`, done: () => !!panT() }),
        { id: 'upgrade', when: () => after(2), skip: () => W() >= 3 || noTw(), hold: 1, at: sel('#panel [data-act=up]'), t: 'The Upgrade button', enter: () => { mem.ut = panT(); mem.b4 = mem.ut && stat(mem.ut); },
          b: () => `Upgrading costs ${fmt(panT() ? upgradeCost(panT()) : 0)} credits: the price is on the button. It makes this tower stronger. Tap it.`,
          done: () => mem.ut && towerLevel(mem.ut) > mem.b4.lvl, back: () => !panT() && 'tapTower' },
        info('upDone', sel('#panel .lvtag'), 'Upgraded', () => upLine(mem.ut, mem.b4) + ' Every upgrade rolls one.', { when: () => !!panT(), skip: () => W() >= 3 || !panT(), ok: 'Next' }),
        { id: 'affix', hold: 1, at: sel('#panel [data-act=tab][data-v=info]'), t: 'Its bonus', b: 'That random bonus is an affix. Tap Details to see it.', skip: () => W() >= 3 || !panT(), done: () => panel && panel.tab === 'info' },
        info('affixes', () => appR(q('#panel .affs')) || appR(q('#panel .pbody')), 'Affixes', 'Every upgrade adds one. Rarer ones are coloured gold or purple. Reroll swaps them for credits.', { skip: () => W() >= 3 || !panT(), okFn: () => { mem.affix = 1; if (panel) { panel.tab = 'act'; renderPanel(); } }, enter: scrollTo('#panel .affs') }),
        call('call3', 3, 'Next wave when you are ready.', { when: () => after(2) }),
        // (6.2: ranking up waits for some play in Wave 3 instead of following the upgrade at once)
        info('rank', () => towerR(mem.ut), 'Ranking up', 'The coloured bar under a tower is its level; its panel shows the LV badge. Each level adds damage and an affix. At LV 3 it picks a specialty; LV 5 is the top.', { ls: 'rank', when: () => W() >= 3, skip: () => W() >= 4 || !mem.ut || !G.towers.includes(mem.ut), ok: 'Next', enter: shut }),
        info('upWhy', sel('#hud .hs.pwr'), 'Why upgrade?', () => `Power is limited: ${gridUsed()} of ${gridCap()}. A new tower needs power; an upgrade costs only credits.`, { skip: () => W() >= 4, leave: shut }),
        threatOpen('threat', 'Threat Board', 'This chip shows the next wave. Juggernauts are coming. Tap it.', { ls: 'threat', when: () => after(3), skip: () => W() >= 4 }),
        inThreat('jugg', rowOf('tank'), 'Juggernaut', 'Plated: Pulse shots lose a third. A Rail Lance pierces Plating.', { when: () => after(3), skip: () => W() >= 4 || modalOpen !== 'evo', enter: () => { const c = q('#modal canvas[data-eico=tank]'); if (c) c.closest('.threv').scrollIntoView({ block: 'center' }); } }),
        build('rail', 'rail', 'c', 'Build a Rail Lance', 'Tap the marked tile.', { when: () => after(3), skip: () => W() >= 4, at: () => flowAt('rail', 'c', null, false, frOn() ? dockable : null) }),
        call('call4', 4, 'Juggernauts are slow. Let them walk into the Rail.', { when: () => after(3) }),
        ...frSteps(() => W() >= 4, () => W() >= 5), // 6.1: dock on the Rail, links, Move (6.2: during Wave 4, one lesson at a time)
        { id: 'inspect', ls: 'inspect', when: () => W() === 4 && G.enemies.some(e => e.type === 'tank' && onField(e)), skip: () => W() >= 5 || !G.enemies.some(e => e.type === 'tank' && onField(e)), hold: 1, enter: () => { mem.tank = G.enemies.find(e => e.type === 'tank' && onField(e)); },
          at: () => enemyR(mem.tank), t: 'Inspect', b: 'Tap the Juggernaut. Any enemy can be tapped.', done: () => panel && panel.kind === 'enemy' },
        info('inspected', () => appR(q('#panel .sts.good')) || appR(q('#panel .ehp')), 'Enemy panel', 'Health, speed, Plating, genes and what beats it. Tap empty ground to close it.', { when: () => panel && panel.kind === 'enemy', skip: () => W() >= 5 || !(panel && panel.kind === 'enemy'), okFn: () => closePanel() }),
        // the second upgrade: the arrow cue
        tapTw('arrow', () => mem.au, 'The upgrade arrow', 'An arrow over a tower means you can afford its upgrade. Tap that tower.', { ls: 'arrow', when: () => after(4) && !!bestUp(), skip: () => W() >= 5, enter: () => { mem.au = bestUp(); } }),
        { id: 'up2', when: () => after(4), skip: () => W() >= 5 || !mem.au, hold: 1, at: sel('#panel [data-act=up]'), t: 'Upgrade it', enter: () => { mem.b4 = stat(mem.au); },
          b: () => `${fmt(upgradeCost(mem.au))} credits. Tap Upgrade.`, done: () => towerLevel(mem.au) > mem.b4.lvl, back: () => panT() !== mem.au && 'arrow' },
        info('up2Done', sel('#panel .lvtag'), 'Stronger', () => upLine(mem.au, mem.b4), { when: () => !!panT(), skip: () => W() >= 5 || !panT(), leave: shut }),
        call('call5', 5, 'A big pack is coming. Get ready to use an ability.', { when: () => after(4) }),
        { id: 'strike', ls: 'strike', gap: 12, busyOK: 1, when: () => W() === 5 && (G.charges.strike || 0) > 0 && (pack() || [0, 0, 0])[2] >= 6, skip: () => W() >= 6, hold: 1, enter: () => { mem.c0 = G.charges.strike; },
          at: sel('#abils [data-abil=strike]'), t: 'Orbital Strike', b: 'A tight pack. Abilities live on the left. Tap Strike.', done: () => G.aimAbility === 'strike' || (G.charges.strike || 0) < mem.c0 },
        { id: 'aim', when: () => W() === 5, skip: () => W() >= 6, hold: 1, enter: () => { mem.pk = pack(); },
          at: () => packAt(), t: 'Aim', b: 'Tap the middle of the pack.', done: () => (G.charges.strike || 0) < mem.c0, back: () => G.aimAbility !== 'strike' && (G.charges.strike || 0) >= mem.c0 && 'strike' },
        info('recharge', sel('#abils [data-abil=strike]'), 'Recharging', 'The bar on the button refills over time. Then it is ready again.', { when: () => W() === 5, skip: () => W() >= 6, hold: 0 }),
        { id: 'ready', ls: 'vets', when: () => W() >= 5 && vetsReady().length > 0 && !panel, skip: () => W() >= 8 || used('vet'), hold: 1, at: sel('#bReady'), t: 'Veterans ready',
          b: 'Towers that fight earn veteran ranks. This button counts towers with a pick waiting. Tap it.', done: () => modalOpen === 'vets' },
        { id: 'vpick', when: () => modalOpen === 'vets', skip: () => W() >= 8 || used('vet') || modalOpen !== 'vets', hold: 1, modal: 'vets', at: sel('#modal [data-act=vpick]'), t: 'Pick a mutation', b: 'Three choices for this tower; the colour is its rarity. Tap one. It walks you through every waiting tower.', done: () => used('vet') },
        threatOpen('evo', 'The swarm adapts', 'It breeds against whatever does your damage. Open the Threat Board.', { ls: 'evo', when: () => after(5), skip: () => W() >= 6 }),
        inThreat('arms', () => appR(q('#modal .armrow')) || appR(q('#modal .arms')), 'Arms Race',
          () => { const I = G.stats.dmgByEl, tot = ELS.reduce((a, k) => a + (I[k] || 0), 0) || 1, k = topEl(); return `${Math.round((I[k] || 0) / tot * 100)}% of your damage is ${EL[k].name}, so the swarm bred ${EL[k].name} Ward. Mix elements to stay ahead.`; },
          { when: () => after(5), skip: () => W() >= 6 || modalOpen !== 'evo' }),
        build('counter', 'cryo', 'd', 'Answer it', '', { when: () => after(5), skip: () => W() >= 6, at: () => flowAt(counterOf(), 'd'), hold: () => afford(counterOf()) && gridFree() >= 1, done: () => has(counterOf()),
          b: () => { const c = counterOf(), D = TOWERS[c]; return !afford(c) ? `A ${D.name} costs ${towerCost(c)} credits.` : gridFree() < 1 ? 'The grid is full: this wave, upgrade instead.' : flowText(c, `Build a ${D.name}: ${EL[D.el].name} damage goes straight through ${EL[topEl()].name} Ward.`); } }),
        call('call6', 6, 'Warded enemies are coming.', { when: () => after(5) }),
        // the core's own upgrades, during Wave 6 (6.2; supply drops as Waves 3 and 4 end pay for them)
        { id: 'tapCore', ls: 'core', when: () => W() >= 6 && !G.frFly, skip: () => W() >= 8 || G.core.sLvl >= 2 && G.core.wLvl >= 2, hold: 1, at: () => worldR(G.core.x, G.core.y, 1.1), t: 'Upgrade the core', b: 'The core has upgrades too. Tap it.', done: () => panel && panel.kind === 'core' },
        { id: 'shield', when: () => W() >= 6, skip: () => W() >= 8 || G.core.sLvl >= 2, hold: () => G.credits >= coreShieldCost(), enter: scrollTo('#panel [data-act=cs]'), at: sel('#panel [data-act=cs]'), t: 'Shield',
          b: () => G.credits >= coreShieldCost() ? `Tap Shield (${fmt(coreShieldCost())}). A bigger shield soaks more leaks before the core loses health.` : `Shield costs ${fmt(coreShieldCost())} credits.`, done: () => G.core.sLvl >= 2, back: () => !(panel && panel.kind === 'core') && 'tapCore' },
        { id: 'battery', when: () => W() >= 6, skip: () => W() >= 8 || G.core.wLvl >= 2, hold: () => G.credits >= coreWeaponCost(), enter: scrollTo('#panel [data-act=cw]'), at: sel('#panel [data-act=cw]'), t: 'Battery',
          b: () => G.credits >= coreWeaponCost() ? `Tap Upgrade Battery (${fmt(coreWeaponCost())}). ${G.fr && frDockT() ? `The docked ${TOWERS[frDockT().type].name} hits ${pct(FRONTIER.dockBat)} harder per level, and so does the plain cannon.` : "The core's own gun hits harder; some levels add a module."}` : `The Battery costs ${fmt(coreWeaponCost())} credits.`, done: () => G.core.wLvl >= 2, back: () => !(panel && panel.kind === 'core') && 'tapCore' },
        info('coreMore', sel('#panel [data-act=ch]'), 'Hull and Uplink', () => G.fr ? `Later: Hull adds core health. Uplink makes abilities recharge faster, adds a link every ${FRONTIER.linkUplink} levels and shortens the lift-off wait every ${FRONTIER.cdUplink}.` : 'Later: Hull adds core health, Uplink makes abilities recharge faster.', { when: () => panel && panel.kind === 'core', skip: () => W() >= 8 || !(panel && panel.kind === 'core'), okFn: () => closePanel(), enter: scrollTo('#panel [data-act=ch]') }),
        info('mark', () => enemyR(mem.we), 'Gene marks', () => `The ring is Ward: this one shrugs off half your ${EL[(mem.we && mem.we.gel) || 'K'].name} damage. Marks show what each enemy evolved.`,
          { ls: 'mark', when: () => W() === 6 && !!geneEnemy('ward'), skip: () => W() >= 7 || !geneEnemy('ward'), enter: () => { mem.we = geneEnemy('ward'); } }),
        // the spec: a permanent branch at LV 3, then Ascend and Sell, briefly
        tapTw('tapLv3', () => mem.st, 'Specialize', () => G.credits >= upgradeCost(mem.st) ? 'Tap your strongest tower. Get it to LV 3.' : `Next upgrade: ${fmt(upgradeCost(mem.st))} credits. Kills pay.`,
          { ls: 'spec', when: () => after(6) || W() >= 7, skip: () => W() >= 8 || noTw(), hold: () => G.credits >= upgradeCost(mem.st), enter: () => { mem.st = G.towers.slice().sort((a, b) => b.lvl - a.lvl || b.dmgDone - a.dmgDone)[0]; } }),
        { id: 'toLv3', when: () => after(6) || W() >= 7, skip: () => W() >= 8 || !mem.st || mem.st.lvl >= 3, hold: () => G.credits >= upgradeCost(mem.st), at: sel('#panel [data-act=up]'), t: 'To LV 3',
          b: () => `Upgrade to LV ${mem.st.lvl + 1}: ${fmt(upgradeCost(mem.st))} credits.`, done: () => mem.st.lvl >= 3, back: () => panT() !== mem.st && 'tapLv3' },
        { id: 'spec', when: () => (after(6) || W() >= 7) && mem.st && mem.st.lvl >= 3, skip: () => W() >= 8 || !mem.st || mem.st.spec, hold: () => G.credits >= upgradeCost(mem.st), at: sel('#panel .specs'), t: 'Pick a spec',
          b: () => G.credits >= upgradeCost(mem.st) ? `At LV 3 a tower specializes: one of two branches, for good. Read both and tap one (${fmt(upgradeCost(mem.st))} credits).` : `The spec costs ${fmt(upgradeCost(mem.st))} credits. Kills pay.`,
          done: () => !!mem.st.spec, back: () => panT() !== mem.st && G.credits >= upgradeCost(mem.st) && 'tapLv3' },
        info('ascend', sel('#panel [data-act=up]'), 'LV 5 and Ascend', `One more upgrade reaches LV 5, the top. After that a tower can Ascend: more damage${typeof PERKS !== 'undefined' ? ' and a perk' : ''} each time, at a steep price.`, { when: () => !!panT() && mem.st && mem.st.spec, skip: () => W() >= 8 || !panT() }),
        info('sell', sel('#panel [data-act=sell]'), 'Sell', 'Selling refunds 70% of what you put in. Sell a tower that sits idle and build where enemies walk.', { when: () => !!panT(), skip: () => W() >= 8 || !panT(), leave: shut }),
        info('free', () => appR(q('#chips [data-wanted]')) || appR(q('#chips [data-more]')), 'Most Wanted', () => `This chip is the bounty: a boss lands on Wave ${G.wanted ? G.wanted.w : 9}. Until then, build and upgrade as you like.`, { ls: 'wanted', when: () => W() >= 7, skip: () => W() >= 9, hold: 0 }),
        { id: 'boss', ls: 'boss', gap: 0, busyOK: 1, when: () => G.enemies.some(e => e.boss && !e.gen && onField(e)), skip: () => G.huntChoice || G.over, hold: 1, ok: 'Fight', enter: () => { mem.boss = G.enemies.find(e => e.boss && !e.gen && onField(e)); },
          at: () => enemyR(mem.boss), t: () => mem.boss ? mem.boss.bossName : 'Boss', b: 'The Most Wanted boss: huge health, Plated, slow. Kill it to claim the bounty. Strike helps.' },
        { id: 'bounty', ls: 'bounty', gap: 0, busyOK: 1, when: () => modalOpen === 'hunt', hold: 1, modal: 'hunt', at: sel('#modal [data-act=extract]'), t: 'Bounty claimed',
          b: `Extract banks your Bounty Purse and ends the run as a win. In real runs a jump door pushes on for a bigger purse; fall later and you keep ${Math.round(PURSE.death * 100)}%.`, done: () => G.over },
      ],
      towers: [
        intro('in', 'Towers and elements', 'Every tower has a job and an element. This lesson: read the build menu, then answer two waves.'),
        { id: 'open', hold: 1, at: () => flowAt('coil', 'a'), t: 'The build menu', b: 'Tap the marked tile.', done: () => panel && panel.kind === 'build' },
        info('grid', sel('#panel .bgrid'), 'Six towers', 'Each card is a tower. Its colour is its element: Kinetic, Thermal, Cryo, Arc, Void.', { skip: () => !(panel && panel.kind === 'build') || has('coil') }),
        build('coil', 'coil', 'a', 'Arc Coil', 'Tap the marked tile.', { b: () => flowStage('coil') === 1 ? 'Tap Arc Coil. Skimmers next wave are weak to Arc.' : flowText('coil', 'Tap the marked tile.') }),
        threatOpen('threat', 'Threat Board', 'Open it to see what is coming.'),
        inThreat('skim', rowOf('flyer'), 'Skimmers', 'They fly straight at the core and are weak to Arc. Flame and Gravity Well can’t reach them.', { enter: scrollTo('#modal canvas[data-eico=flyer]') }),
        call('c1', 1),
        build('missile', 'missile', 'b', 'Splash', 'Swarmers next: fast packs. Splash clears them. Tap the marked tile.', { when: () => after(1), skip: () => W() >= 2 }),
        call('c2', 2, null, { when: () => after(1) }),
        info('combo', null, 'Combos', 'Elements combine: Kinetic on a Frozen enemy Shatters, Thermal on a Chilled one is Thermal Shock. The Dictionary lists every combo.', { when: () => after(2) }),
        end(),
      ],
      upgrades: [
        intro('in', 'Upgrades and specs', 'A tower you built opens its panel when you tap it. Everything about making it stronger is there.'),
        info('arrow', () => towerR(bestUp()), 'The arrow', 'An arrow over a tower means you can afford its best upgrade.', { skip: () => !bestUp() }),
        tapTw('tapP', () => G.towers.find(t => t.type === 'pulse'), 'LV 3', 'This Pulse Blaster is LV 3. Tap it.'),
        { id: 'spec', hold: 1, at: sel('#panel .specs'), t: 'Specialize', b: 'At LV 3 a tower picks one of two branches, for good. Read both, tap one.', done: () => G.towers.some(t => t.type === 'pulse' && t.spec), back: () => !panT() && 'tapP' },
        info('specDone', sel('#panel .lvtag'), 'LV 4', 'The spec name now sits next to its level. Two more upgrades to LV 5.', { skip: () => !panT(), leave: shut }),
        tapTw('tapR', () => G.towers.find(t => t.type === 'rail'), 'LV 5', 'This Rail Lance is LV 5, the top. Tap it.'),
        info('asc', sel('#panel [data-act=up]'), 'Ascend', `Past LV 5 a tower Ascends: more damage${typeof PERKS !== 'undefined' ? ' and a perk you choose' : ''} each time. The price doubles every step.`, { skip: () => !panT(), leave: shut }),
        tapTw('tapC', () => G.towers.find(t => t.type === 'cryo'), 'Sell', 'This Cryo Emitter is in the way. Tap it.', { skip: () => !has('cryo') }),
        { id: 'sell', hold: 1, at: sel('#panel [data-act=sell]'), t: 'Sell', b: 'Selling refunds 70% of what you put in (100% at a checkpoint). Tap Sell.', done: () => !has('cryo'), back: () => has('cryo') && !panT() && 'tapC' },
        call('c1', 1),
        info('wrap', null, 'Upgrade or build?', 'Building needs power; upgrading needs only credits. When the grid is full, upgrade.', { when: () => after(1) }),
        end(),
      ],
      power: [
        intro('in', 'Power and the core', 'Power limits how many towers you run. Credits can buy more, and the core has upgrades of its own.'),
        info('pw', sel('#hud .hs.pwr'), 'Power', () => `${gridUsed()} of ${gridCap()}: full. Each tower draws 1. Capacity grows 1 every 3 waves.`),
        { id: 'open', hold: 1, at: () => flowAt('pulse', 'a'), t: 'Need more?', b: 'Tap the marked tile.', done: () => panel && panel.kind === 'build' },
        { id: 'reactor', hold: 1, at: sel('#panel [data-act=reactor]'), t: 'Expand the reactor', b: () => `With the grid full, the build menu sells +1 power: ${fmt(reactorCost())} credits. Tap it.`, done: () => (G.reactorN || 0) >= 1, back: () => !(panel && panel.kind === 'build') && 'open', leave: () => closePanel() },
        { id: 'core', hold: 1, at: () => worldR(G.core.x, G.core.y, 1.1), t: 'Core upgrades', b: 'Tap the core.', done: () => panel && panel.kind === 'core' },
        info('corep', sel('#panel'), 'The core panel', () => G.fr ? 'Battery: the core’s own gun, and a docked tower’s. Shield: soaks leaks. Hull: more health. Uplink: faster cooldowns, more links. Lift Off: fly it.' : 'Weapon: the core’s own gun. Shield: soaks leaks. Hull: more health. Uplink: faster ability cooldowns.', { skip: () => !(panel && panel.kind === 'core'), okFn: () => closePanel() }),
        call('c1', 1),
        end(),
      ],
      lift: [ // 6.1
        intro('in', 'Lift Off and docking', 'Your core can fly. Wherever it lands, the roads follow it; on a tower, it fires that tower’s weapon.'),
        ...frSteps(() => true, () => W() >= 1),
        call('c1', 1, 'Send the wave. The docked core fights alongside the towers it links.'),
        info('wrap', sel('#bLift'), 'Recharging', () => `Lift Off recharges for ${frCd()} waves after a landing. The button shows the wave it is ready again.`, { when: () => after(1) }),
        end(),
      ],
      overcharge: [
        intro('in', 'Overcharge', 'Spare power can go into one tower to make it hit harder.'),
        info('pw', sel('#hud .hs.pwr'), 'Spare power', () => `${gridUsed()} of ${gridCap()} used: ${gridFree()} spare.`),
        tapTw('tapR', () => G.towers.find(t => t.type === 'rail'), 'Your best tower', 'Tap the Rail Lance.'),
        { id: 'oc', hold: 1, at: sel('#panel [data-act=oc][data-v="1"]'), t: 'Overcharge +1', b: `Each step: +${Math.round(OVERCHARGE.dmg * 100)}% damage for 1 power. Tap +1.`, done: () => G.towers.some(t => t.type === 'rail' && t.oc >= 1), back: () => !panT() && 'tapR' },
        info('ocDone', sel('#hud .hs.pwr'), 'Power spent', () => `${gridUsed()} of ${gridCap()} now. Tap ⚡ any time to put all spare power into your top tower.`, { leave: shut }),
        call('c1', 1),
        end(),
      ],
      abilities: [
        intro('in', 'Abilities', 'Five abilities on the left rail. Each recharges on its own. Use them as the wave comes.'),
        call('c1', 1, 'Send the wave.'),
        { id: 'strike', when: () => W() >= 1 && (pack() || [0, 0, 0])[2] >= 5, hold: 1, enter: () => { mem.c0 = G.charges.strike; }, at: sel('#abils [data-abil=strike]'), t: 'Strike', b: 'Heavy damage in an area. Tap Strike.', done: () => G.aimAbility === 'strike' || G.charges.strike < mem.c0 },
        { id: 'aim', hold: 1, enter: () => { mem.pk = pack(); }, at: () => packAt(), t: 'Aim', b: 'Tap the pack.', done: () => G.charges.strike < mem.c0, back: () => G.aimAbility !== 'strike' && G.charges.strike >= mem.c0 && 'strike' },
        { id: 'stasis', when: () => G.enemies.filter(e => !e.dead).length >= 8, hold: 1, at: sel('#abils [data-abil=stasis]'), t: 'Stasis', b: 'Freezes every enemy for a few seconds. Tap it.', done: () => G.stasisT > 0 },
        { id: 'frenzy', hold: 1, at: sel('#abils [data-abil=overclock]'), t: 'Frenzy', b: 'Your towers fire faster for 8 seconds. Tap it.', done: () => G.overclockT > 0 },
        { id: 'nova', hold: 1, enter: () => { mem.n0 = G.charges.nova; }, at: sel('#abils [data-abil=nova]'), t: 'Nova', b: 'Damages every enemy on the map at once. Tap it.', done: () => G.charges.nova < mem.n0 },
        { id: 'scan', when: () => G.enemies.some(e => e.type === 'phantom' && onField(e)), skip: () => cleared() && W() >= 1, hold: 1, at: sel('#abils [data-abil=scan]'), t: 'Scan', b: 'Phantoms cloak. Scan reveals them and marks the biggest threat. Tap it.', done: () => G.scanT > 0 },
        info('charges', sel('#abils [data-abil=strike]'), 'Charges', 'Each bar refills over time. Crates and bosses give extra charges that stack. A full button wastes its timer: use it.', { when: () => cleared() }),
        end(),
      ],
      swarm: [
        intro('in', 'The swarm adapts', 'Enemies that get furthest pass on their genes. The swarm drifts toward whatever your defence handles worst.'),
        threatOpen('threat', 'Threat Board', 'Open it.'),
        inThreat('arms', () => appR(q('#modal .armrow')) || appR(q('#modal .arms')), 'Arms Race', 'Your fire, the genes the swarm bred against it, how far each has spread (I, II, III) and why.', { okFn: null, ok: 'Next' }),
        inThreat('dna', () => appR(q('#modal .evlist .evrow')) || appR(q('#modal .evlist')), 'Swarm DNA', 'Every gene in the swarm right now, with its counter.', { enter: scrollTo('#modal .evlist') }),
        call('c1', 1),
        info('mark', () => enemyR(mem.pe), 'Plating', 'Steel plates on its flanks: Plating. Pulse loses a third against it; Rail ignores it. Every gene has its own mark.', { when: () => !!geneEnemy('plating'), enter: () => { mem.pe = geneEnemy('plating'); } }),
        build('rail', 'rail', 'b', 'Counter it', 'Plating is spreading. Build a Rail Lance on the marked tile.', { when: () => after(1), skip: () => W() >= 2 }),
        call('c2', 2, null, { when: () => after(1) }),
        info('wrap', sel('#chips [data-threat]'), 'Keep reading it', 'The chip pulses when a gene climbs a tier. Open it between waves.', { when: () => after(2) }),
        end(),
      ],
      hunt: [
        intro('in', 'Bounties', 'Every run has a Most Wanted boss. Its bounty, and the purse it unlocks, decide how a run ends.'),
        info('chip', () => appR(q('#chips [data-wanted]')) || appR(q('#chips [data-more]')), 'The bounty chip', () => `The Most Wanted lands on Wave ${G.wanted.w}. The number after it is your Bounty Purse: XP you have not banked yet.`),
        call('c1', 1, 'Send the waves.'),
        { id: 'boss', when: () => G.enemies.some(e => e.boss && !e.gen && onField(e)), skip: () => G.huntChoice || G.over, hold: 1, ok: 'Fight', enter: () => { mem.boss = G.enemies.find(e => e.boss && !e.gen && onField(e)); }, at: () => enemyR(mem.boss), t: 'Most Wanted', b: 'Kill it to claim the bounty.' },
        info('purse', sel('#modal .pursebox'), 'The Bounty Purse', `Part of your XP rides here, and the bounty grew it. Extract banks all of it. Fall later and you keep ${Math.round(PURSE.death * 100)}%.`, { modal: 'hunt', when: () => modalOpen === 'hunt', ok: 'Next' }),
        info('doors', sel('#modal .hopt.door'), 'Jump doors', 'Each door is a new zone for 20 waves: its enemies, weather and Most Wanted. Steady, Hot and Deadly multiply the purse more.', { modal: 'hunt', ok: 'Next' }),
        { id: 'choose', hold: 1, modal: 'hunt', at: sel('#modal [data-act=extract]'), t: 'Your call', b: 'Extract to bank it and end the run as a win, or take a door.', done: () => G.over || G.pushes > 0 },
        info('esc', null, 'Late escalations', 'From Wave 50 each boss wave adds an escalation instead of a boon: the run gets stranger, and score and XP climb.', { when: () => G.pushes > 0 }),
        end(),
      ],
      salvage: [
        intro('in', 'Salvage', 'Drop ships leave crates on the map from Wave 3. They decay if nobody claims them.'),
        { id: 'crate', hold: 1, at: () => { const c = G.caches[0]; return c ? worldR(c.x + 0.5, c.y + 0.5, 0.6) : null; }, t: 'A crate', b: 'Tap it to claim it.', done: () => !G.caches.length },
        info('auto', null, 'Less tapping', 'A tower right next to a crate collects it for you. Golden crates pay big; cursed ones bite.'),
        info('pirate', null, 'Pirates', 'Pirate skiffs fly in to steal crates you leave. Shoot them down to get the loot back.'),
        call('c1', 1),
        end(),
      ],
      veterans: [
        intro('in', 'Veterans', 'Towers that fight earn ranks. Each rank lets you pick a mutation for that tower.'),
        { id: 'chip', hold: 1, at: sel('#bReady'), t: 'Ready', b: 'This button counts towers with a pick waiting (veteran mutations and Ascend perks). A gold star marks each one on the board. Tap it.', done: () => modalOpen === 'vets' || !G.towers.some(t => t.pending > 0) },
        { id: 'pick', hold: 1, modal: 'vets', at: sel('#modal [data-act=vpick]'), t: 'Pick a mutation', b: 'Three choices; the colour is its rarity. Tap one.', done: () => !G.towers.some(t => t.pending > 0) },
        tapTw('tapP', () => G.towers.find(t => t.type === 'pulse'), 'Affixes', 'Tap the Pulse Blaster.', { when: () => !modalOpen }),
        { id: 'details', hold: 1, at: sel('#panel [data-act=tab][data-v=info]'), t: 'Details', b: 'Tap Details.', done: () => panel && panel.tab === 'info', back: () => !panT() && 'tapP' },
        info('affs', sel('#panel .affs'), 'Affixes', 'Bonuses this tower rolled from upgrades and mutations. Reroll swaps them for credits or a token.', { skip: () => !panT() }),
        info('reson', () => towerR(G.towers.find(t => t.type === 'cryo')), 'Resonance', 'Towers of different elements side by side resonate: +8% damage each. Pulse and Cryo touch here.', { okFn: () => closePanel() }),
        call('c1', 1),
        end(),
      ],
      support: [
        intro('in', 'Support towers', 'Two towers never shoot. One makes others stronger, one makes credits.'),
        build('pylon', 'pylon', 'p', 'Relay Pylon', 'Tap the marked tile, next to your towers.', { at: () => flowAt('pylon', 'p', null, true) }),
        info('pyl', () => towerR(G.towers.find(t => t.type === 'pylon')), 'Boost', 'Towers in its ring deal more damage and fire faster. It also reveals cloaked Phantoms.'),
        build('forge', 'forge', 'f', 'Credit Forge', 'It pays credits at the start of every wave. Tap the marked tile.'),
        call('c1', 1),
        info('paid', sel('#hud .hs.cr'), 'Paid', 'The Forge paid at the start of the wave. Early Forges pay for themselves.', { when: () => W() >= 1 }),
        end(),
      ],
      storms: [
        intro('in', 'Storms and anomalies', 'Weather that boosts one element, and the gauge that brings permanent twists.'),
        info('storm', () => appR(q('#chips [data-storm]')) || appR(q('#chips [data-more]')), 'A storm', 'This chip is the storm over your Missile: a Solar Flare, +40% Thermal damage inside it. Towers it boosts get an outline.'),
        { id: 'gauge', hold: 1, at: sel('#bEnt'), t: 'Entropy', b: 'Kills fill this gauge. It is full: tap it.', done: () => modalOpen === 'anomaly' || !G.anomOffers },
        { id: 'anom', hold: 1, modal: 'anomaly', at: () => appR(q('#modal [data-act=anom]')) || appR(q('#modal .card')), t: 'Anomalies', b: 'Each has an upside and a downside for the rest of the run. Pick one, or Stabilize for score.', done: () => !G.anomOffers },
        call('c1', 1),
        end(),
      ],
      wormholes: [
        intro('in', 'Wormholes', 'Every so often a new road opens and the map grows.'),
        info('hole', () => { const L = G.map.lanes[1]; return L ? worldR(L.pts[0].x, L.pts[0].y, 1) : null; }, 'A wormhole', () => `A new road opens here at Wave 2. The map just grew to make room.${G.fr ? ` Nothing can be built within ${FRONTIER.wormBuild} tiles of it.` : ''}`),
        call('c1', 1),
        info('cp', sel('#cpBanner'), 'Checkpoint', 'The wave before a wormhole lands is a checkpoint: selling refunds 100%, talents respec free.', { when: () => !!G.checkpoint }),
        build('cover', 'pulse', 'n', 'Cover the new road', 'Tap the marked tile.', { when: () => !!G.checkpoint, at: () => flowAt('pulse', 'n', G.map.lanes[1]), done: () => G.towers.length >= 3 }),
        { id: 'resume', when: () => !!G.checkpoint, hold: 0, at: sel('#bCall'), t: 'Resume', b: 'Tap Next. Resuming fast pays a bonus.', done: () => !G.checkpoint },
        info('wrap', null, 'Two roads', 'Now enemies come down both. Towers between roads cover two at once.', { when: () => after(2) }),
        end(),
      ],
      assault: [
        intro('in', 'Strain Assaults', 'The swarm read your defence and built a strain to beat it. It lands next wave.'),
        threatOpen('threat', 'Red chip', 'A red Threat chip means an assault is coming. Tap it.'),
        inThreat('strain', () => appR(q('#modal .asname')), 'The strain', 'Its name and genes, and why it chose them.', { ok: 'Next', okFn: null, enter: scrollTo('#modal .asname') }),
        inThreat('refit', () => appR(q('#modal .note.hl')), 'Refit', 'Selling is free until it lands. Swap towers for the counters. Hold it and it breaks: +1 power and a bounty.', { enter: scrollTo('#modal .note.hl') }),
        call('c1', 1),
        info('wrap', sel('#chips [data-threat]'), 'Hold it', 'During the assault the chip counts its units and your leaks.', { when: () => W() >= 1 && !cleared(), hold: 0 }),
        { id: 'res', when: () => after(1), at: sel('#bCall'), t: 'Wave 2', b: 'The assault resolves when its last unit is gone.', done: () => W() >= 2, skip: () => W() >= 2 },
        end(),
      ],
      bosses: [
        intro('in', 'Bosses', 'A boss lands every 10 waves. If it reaches the core, the run ends.'),
        call('c1', 1),
        { id: 'boss', when: () => G.enemies.some(e => e.boss && onField(e)), hold: 1, ok: 'Next', enter: () => { mem.boss = G.enemies.find(e => e.boss && onField(e)); }, at: () => enemyR(mem.boss), t: () => mem.boss.bossName, b: 'Phases at 66% and 33%: each unleashes its power. The Hive Queen flies.' },
        { id: 'stasis', hold: 1, at: sel('#abils [data-abil=stasis]'), t: 'Stasis', b: 'Save abilities for bosses. Tap Stasis.', done: () => G.stasisT > 0, skip: () => !G.charges.stasis },
        { id: 'boon', when: () => modalOpen === 'draft', hold: 1, modal: 'draft', at: sel('#modal .boons'), t: 'Boon', b: 'A boss kill pays a boon: pick one of three. It lasts the whole run.', done: () => !G.draft },
        info('nem', null, 'Nemesis', 'A boss or strain that ends your run becomes your Nemesis. It comes back next run, stronger, for double the bounty.'),
        end(),
      ],
      market: [
        intro('in', 'The Exchange', 'From Wave 10 the Score button opens the Exchange: the Black Market and Cash In.'),
        { id: 'open', hold: 1, at: sel('#bCash'), t: 'Exchange', b: 'Tap Score.', done: () => panel && panel.kind === 'cash' },
        info('items', sel('#panel'), 'Black Market', 'Three items, restocked after each boss wave. Prices climb as the run goes on.', { skip: () => !(panel && panel.kind === 'cash') }),
        info('cash', () => appR(q('#panel .cashopts')) || appR(q('#panel')), 'Cash In', 'Turns credits into score. Spend on towers first; cash in what is left.', { skip: () => !(panel && panel.kind === 'cash'), okFn: () => closePanel() }),
        call('c1', 1),
        end(),
      ],
      techniques: [
        intro('in', 'Techniques', 'A Technique is a second fire mode for one tower type, learned in Talents. This build has Suppressor.'),
        tapTw('tapP', () => G.towers.find(t => t.type === 'pulse'), 'A Pulse Blaster', 'Tap it.'),
        { id: 'fire', hold: 1, at: sel('#panel .firerow'), t: 'Fire', b: 'Standard or Suppressor. Tap Suppressor.', done: () => G.towers.some(t => t.type === 'pulse' && t.fire), back: () => !panT() && 'tapP' },
        info('job', sel('#panel .firedesc'), 'A different job', 'Suppressor slows what it hits but deals less. Keep the other Pulse on Standard to finish them.', { leave: shut }),
        call('c1', 1),
        end(),
      ],
      mastery: [
        intro('in', 'Ascend perks', 'This Rail Lance is LV 5. Ascending it adds damage and a perk you choose.'),
        tapTw('tapR', () => G.towers.find(t => t.type === 'rail'), 'LV 5', 'Tap the Rail Lance.'),
        { id: 'asc', hold: 1, at: sel('#panel [data-act=up]'), t: 'Ascend', b: () => `Tap Ascend: ${fmt(upgradeCost(G.towers.find(t => t.type === 'rail')))} credits.`, done: () => G.towers.some(t => t.type === 'rail' && (t.asc || 0) >= 1), back: () => !panT() && 'tapR' },
        { id: 'perk', hold: 1, at: sel('#panel .perks'), t: 'Pick a perk', b: 'Three perks for this tower. Each changes how it works. Tap one.', done: () => G.towers.some(t => t.type === 'rail' && (t.asc || 0) >= 1 && !(t.ascPend > 0)), back: () => !panT() && 'tapR' },
        info('mast', null, 'Tower Mastery', 'Each tower type ranks up across runs from its share of your damage: a badge, +5% damage, gold trim, a fourth perk card, its own legendary.', { leave: shut }),
        call('c1', 1),
        end(),
      ],
      daily: [
        info('row', sel('#hHunt .hhr.day'), 'Daily Hunt', 'One run a day, the same for everyone: map, zone, bounty and Nemesis.', { ok: 'Next' }),
        { id: 'open', hold: 1, at: sel('#hHunt [data-hact=daily]'), t: 'Open it', b: 'Tap Hunt.', done: () => modalOpen === 'setup' && setup.mode === 'daily' },
        info('build', sel('#modal [data-act=huntBuild]'), 'Hunt build', 'A fixed talent build just for the Daily. Spend its points before you start.', { modal: 'setup', ok: 'Next' }),
        info('start', sel('#modal [data-act=launchDaily]'), 'Ranked', 'Your first run of the day is ranked. Watch it or share its code afterwards.', { modal: 'setup', okFn: () => closeModal() }),
        end(),
      ],
      meta: [
        info('lvl', () => appR(q('#hLevel') && q('#hLevel').closest('.lv')), 'Level', 'Runs pay XP from score and the Bounty Purse. Each level is a talent point.', { ok: 'Next' }),
        { id: 'tal', hold: 1, at: sel('#bWebH'), t: 'Talents', b: 'Tap Talents.', done: () => Tree.isOpen },
        info('trees', sel('#ttabs'), 'Seven trees', 'Rows open every 3 points in a tree. At 12, a Capstone: a new way to play.', { tree: 1, ok: 'Next' }),
        { id: 'done', hold: 1, tree: 1, at: sel('#tbar [data-tact=close]'), t: 'Back', b: 'Tap Done.', done: () => !Tree.isOpen },
        info('arch', sel('#bArchive'), 'Archive', 'Everything you have met: enemies, bosses, the Swarm Collection.', { ok: 'Next' }),
        info('nova', null, 'Supernova', 'At a high level with two Capstones, Supernova resets your talents for a permanent bonus and a Cosmic Law.'),
        end(),
      ],
    };
    // with nothing to do this moment, a line that says what is going on and what to do next
    function idleLine() {
      if (!G || G.over) return null;
      if (G.checkpoint) return ['Checkpoint', 'Rebuild for free, then tap Next.'];
      if (!G.spawningDone || G.enemies.some(e => !e.dead)) return [`Wave ${G.wave}`, 'Your towers fire on their own. Watch the core bar. Tap an enemy to inspect it.'];
      return ['Between waves', `Next wave in ${Math.max(0, Math.ceil(G.next))}s. Spend credits on towers or upgrades, or tap Next.`];
    }
    function ensureEl() {
      if (el) return el;
      el = document.createElement('div'); el.id = 'coach'; el.hidden = true;
      el.innerHTML = '<div class="cspot"></div><div class="cring"></div><div class="carrow"></div><div class="ccard"><div class="chd"><em></em><button class="cskip" type="button">Skip</button></div><b class="ct"></b><p class="cb"></p><div class="cft"><button class="btn primary small cok" type="button"></button></div></div>';
      el.addEventListener('click', e => {
        if (e.target.closest('.cskip')) { SFX.play('ui'); if (performance.now() - skipT < 3000) skip(); else { skipT = performance.now(); e.target.textContent = 'Tap again to skip'; setTimeout(() => { if (el) el.querySelector('.cskip').textContent = skipLbl(); }, 3000); } return; }
        if (e.target.closest('.cok') && cur) { SFX.play('ui'); const S = cur; next(); if (S.okFn) S.okFn(); }
      });
      $('#app').appendChild(el);
      return el;
    }
    const skipLbl = () => plan === 'basic' ? 'Skip Training' : 'Skip lesson';
    const tour = () => !!(LESSON_BY[plan] && LESSON_BY[plan].tour);
    function start(p) {
      plan = p || 'basic'; on = true; i = 0; cur = null; mem = {}; sig = ''; ensureEl(); el.querySelector('.cskip').textContent = skipLbl();
      document.body.classList.toggle('tut', !tour()); document.body.classList.toggle('tutent', plan === 'storms');
    }
    function stop() { on = false; cur = null; held = false; Render.spots = null; if (el) el.hidden = true; document.body.classList.remove('tut', 'tutent'); if (G && G.tut) Render.hints = null; }
    function skip() {
      const p = plan; stop(); closeModal(); closePanel();
      if (p === 'basic') { tutState().seen = 1; Save.save(); G = null; show('hangar'); renderHangar(); if (PROF.runSnap) toast('YOUR RUN IS SAVED', 'Tap Resume to carry on where you left off', '#59f0b4', true, 'tip'); else openSetup(); return; } // 6.0: never offer a new run over a saved one
      if (G && G.tut) G = null; if (Tree.isOpen) Tree.close(); show('hangar'); renderHangar(); openManual();
    }
    function next() { const S = cur; cur = null; i++; Render.hints = null; sig = ''; if (S && mem.shownId === S.id && !S.free && G) { mem.gapT = G.time; mem.gapW = W(); mem.gapC = cleared(); } if (S && S.leave) S.leave(); }
    // 6.2 pacing (Basic Training): steps that start a new lesson carry ls. One lesson's steps run back to back (an action chain); a
    // new lesson waits for PACE_GAP seconds of play since the last card (G.time stops while a card holds the game) or for a wave to
    // end with at least 10 s of play since, and for a calm moment (teachBusy). With the countdown nearly out between waves it goes ahead, so a lesson that belongs
    // to this break is never lost. Call prompts (free) neither wait nor reset the clock. Field Manual lessons are one topic each: no gap.
    const PACE_GAP = 22;
    function paced(S) {
      if (plan !== 'basic' || S.free || mem.gapT === undefined || !G || lessonOf(i) === mem.lastLs) return true;
      const gap = S.gap !== undefined ? S.gap : PACE_GAP, quiet = G.time - mem.gapT;
      const waveEnd = cleared() && (W() > mem.gapW || !mem.gapC) && quiet >= 10, late = cleared() && G.next < 5 && W() < G.tutS.waves.length;
      if (!(quiet >= gap || waveEnd || late)) return false;
      if (S.busyOK || late) return true;
      if (!teachBusy()) { mem.busyT = undefined; return true; }
      if (mem.busyT === undefined) mem.busyT = G.time; return G.time - mem.busyT > 25; // a busy spell can't hold a lesson for ever
    }
    const lessonOf = k => { const P = STEPS(); for (let j = Math.min(k, P.length - 1); j >= 0; j--) if (P[j].ls) return P[j].ls; return null; };
    function go(id) { const k = STEPS().findIndex(s => s.id === id); if (k >= 0) { cur = null; i = k; sig = ''; Render.hints = null; } }
    function hide() { if (el && !el.hidden) el.hidden = true; }
    const ov = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    const grow = (r, d) => ({ x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d });
    function place(S, r, idle) {
      const card = el.querySelector('.ccard'), app = $('#app');
      const AW = app.clientWidth, AH = app.clientHeight, full = S.modal || S.tree || tour() || screen !== 'game', st = full ? { x: 0, y: 0, w: AW, h: AH } : appR($('#stage')) || { x: 0, y: 0, w: AW, h: AH };
      const pn = !full && panel ? appR($('#panel')) : null, m = 6;
      // with a side panel open, the card lives in the free part of the stage and narrows to fit it (667 wide: the spec buttons stay clear)
      const fr = pn ? (pn.x > st.x + st.w / 2 ? { x: st.x, w: pn.x - st.x } : { x: pn.x + pn.w, w: st.x + st.w - pn.x - pn.w }) : null;
      const mf = 11; // beside a panel: clear of the ring (5 px) the coach draws around it when the panel is the target
      card.style.width = fr ? Math.max(180, Math.min(290, fr.w - 2 * mf)) + 'px' : '';
      const cw = card.offsetWidth, ch = card.offsetHeight;
      const xs = [st.x + m, st.x + (st.w - cw) / 2, st.x + st.w - cw - m]; if (fr) xs.push(fr.x + mf, fr.x + fr.w - cw - mf);
      const ys = [st.y + m, st.y + (st.h - ch) / 2, st.y + st.h - ch - m];
      const avoid = []; if (r) avoid.push(grow(r, 26));
      if (pn) avoid.push(pn);
      const tl = !full && listEl && !listEl.hidden ? appR(listEl) : null; // the checklist gives way (it hides for this step) rather than the target
      let best = null;
      for (const y of ys) for (const x of xs) {
        const c = { x, y, w: cw, h: ch }; let s = tl ? ov(c, tl) * 4 : 0; for (const a of avoid) s += ov(c, a) * 100;
        if (r) s += Math.hypot(x + cw / 2 - (r.x + r.w / 2), y + ch / 2 - (r.y + r.h / 2)) * 0.05;
        else if (idle) s += y === ys[2] && x === xs[1] ? 0 : 1; // an idle line sits bottom centre, out of the way
        if (!best || s < best.s) best = { x, y, s };
      }
      card.style.left = Math.round(best.x) + 'px'; card.style.top = Math.round(best.y) + 'px';
      if (listEl) listEl.style.visibility = tl && ov({ x: best.x, y: best.y, w: cw, h: ch }, tl) > 0 ? 'hidden' : ''; // no room for both: the card wins for this step
      return { x: best.x, y: best.y, w: cw, h: ch };
    }
    function show2(S, t, b, r, ok, idle) {
      const key = plan + i + '|' + t + '|' + b + '|' + (ok || '') + (idle ? 'i' : ''); // (the button too: a chip that folds into +N brings up "Open it")
      el.hidden = false; el.classList.toggle('idle', !!idle); if (!idle && S.id) { mem.shownId = S.id; if (!S.free) mem.lastLs = lessonOf(i); }
      if (key !== sig) {
        sig = key;
        const T = G && G.tutS, n = T ? T.waves.length : 0, Lt = LESSON_BY[plan];
        el.querySelector('em').textContent = plan === 'basic' ? `Training · Wave ${clamp(G.wave + (G.wave && G.wave < n && cleared() ? 1 : 0), 1, n)}/${n}` : `Lesson · ${Math.min(i + 1, STEPS().length)}/${STEPS().length}`;
        el.querySelector('.ct').textContent = t; el.querySelector('.cb').textContent = b;
        const o = el.querySelector('.cok'); o.hidden = !ok; o.textContent = ok || '';
      }
      el.classList.toggle('dim', held && !!r && !S.nodim); el.classList.toggle('dimall', held && !r && !S.nodim);
      const sp = el.querySelector('.cspot'), rg = el.querySelector('.cring'), ar = el.querySelector('.carrow');
      sp.hidden = rg.hidden = ar.hidden = !r;
      const c = place(S, r, idle);
      if (!r) return c;
      const s = grow(r, 5), set = (nd, R) => { nd.style.left = Math.round(R.x) + 'px'; nd.style.top = Math.round(R.y) + 'px'; nd.style.width = Math.round(R.w) + 'px'; nd.style.height = Math.round(R.h) + 'px'; };
      set(sp, s); set(rg, s);
      // the arrow sits on the side of the target that faces the card, pointing at it
      const dx = c.x + c.w / 2 - (r.x + r.w / 2), dy = c.y + c.h / 2 - (r.y + r.h / 2), horiz = Math.abs(dx) / (r.w + c.w) > Math.abs(dy) / (r.h + c.h);
      const dir = horiz ? (dx > 0 ? 'l' : 'r') : (dy > 0 ? 'u' : 'd'), A = 14;
      const ax = horiz ? (dx > 0 ? s.x + s.w + 4 : s.x - A - 4) : s.x + s.w / 2 - A / 2, ay = horiz ? s.y + s.h / 2 - A / 2 : (dy > 0 ? s.y + s.h + 4 : s.y - A - 4);
      ar.className = 'carrow ' + dir; ar.style.left = Math.round(ax) + 'px'; ar.style.top = Math.round(ay) + 'px';
      return c;
    }
    function idle() {
      held = false;
      const L = !tour() && !modalOpen && !Tree.isOpen && screen === 'game' && !panel ? idleLine() : null;
      if (!L) { hide(); return; }
      show2({}, L[0], L[1], null, null, true);
    }
    function tick() {
      if (!on) { if (listEl) listEl.hidden = true; return; }
      list();
      const runOK = G && G.tut && screen === 'game' && (G.lesson || 'basic') === plan, tourOK = tour() && !G && (screen === 'hangar' || Tree.isOpen);
      if (!runOK && !tourOK) { stop(); return; }
      const P = STEPS();
      while (i < P.length && !cur && P[i].skip && P[i].skip()) i++;
      const S = P[i];
      if (!S) { if (tour() || (G && G.lesson)) lessonDone(plan); else idle(); return; }
      if (G && G.over && plan === 'basic') { held = false; hide(); return; }
      if (!cur) { if ((S.when && !S.when()) || !paced(S)) { idle(); return; } cur = S; sig = ''; if (S.enter) S.enter(); }
      if (S.done && S.done()) { next(); idle(); return; }
      if (S.skip && S.skip()) { next(); idle(); return; }
      const bk = S.back && S.back(); if (bk) { go(bk); idle(); return; }
      if ((modalOpen && S.modal !== modalOpen) || (!modalOpen && S.modal) || (Tree.isOpen && !S.tree)) { held = false; hide(); return; }
      held = !!(typeof S.hold === 'function' ? S.hold() : S.hold);
      wAt = null; const r = S.at ? S.at() : null, panned = see(S, r); miss = !!S.at && !r && !(typeof S.ok === 'function' ? S.ok() : S.ok); // a read step with a button still works without its target
      const c = show2(S, typeof S.t === 'function' ? S.t() : S.t, typeof S.b === 'function' ? S.b() : S.b, r, typeof S.ok === 'function' ? S.ok() : S.ok);
      if (!panned && r && c) see(S, r, c);
    }
    return { start, stop, tick, get hold() { return on && held; }, get on() { return on; }, get step() { return on && cur ? cur.id : null; }, get plan() { return plan; }, get miss() { return on && !!cur && miss; },
      get chain() { return on && cur ? lessonOf(i) : null; }, // 6.2: the lesson the current step belongs to (test/tutcadence.py)
      steps: p => (PLANS[p || plan] || []).map(s => s.id), plans: () => Object.keys(PLANS) };
  })();

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
  // the Nuke (internally Overdrive) from the rail: first tap arms it for 3 s, second tap releases
  let odArm = false, odArmT = null;
  function overdriveTap() {
    if (!G || G.over) return;
    SFX.play('ui');
    if (G.odUsed) { toast('NUKE', `Already used on Wave ${G.odUsed}. One per run`, '#8a8fa8'); return; }
    if (!odReady()) { toast('NUKE', `Arms at Wave ${OD_WAVE}: one board clear per run (bosses survive)`, '#8a8fa8'); return; }
    if (!odArm) { odArm = true; clearTimeout(odArmT); odArmT = setTimeout(() => { odArm = false; updateHud(); }, 3000); updateHud(); toast('NUKE ARMED', 'Tap again to erase every non-boss enemy. One use per run', '#59f0b4', true); return; }
    odArm = false; clearTimeout(odArmT);
    const r = window.act('od');
    if (r === 'empty') { SFX.play('deny'); toast('NUKE', 'Nothing to clear yet. Save it for a crowd', '#ff4d6a'); }
    else if (r !== 'ok') SFX.play('deny');
    else { closePanel(); toast('NUKE', `${G.stats.odKills} enemies erased`, '#59f0b4'); }
    updateHud();
  }
  const marketShut = () => !!(G && G.fresh && G.wave < 10);
  function buildAbilityBar() {
    $('#abils').innerHTML = `<button class="rb od" id="bOD" aria-label="Nuke">${svgIcon('overdrive')}<span>Nuke</span></button>` +
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
    { const ob = $('#bOD'); if (ob) { const ready = odReady(), lbl = G.odUsed ? 'Used' : ready ? (odArm ? 'Again!' : 'Nuke') : 'W' + OD_WAVE;
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
      ? `<span class="evchip wanted${G.wanted.nemesis ? ' nem' : ''}" data-wanted="1" title="Bounty on Wave ${G.wanted.w}. Bounty Purse: Extract after a bounty to bank all of it; if your core falls you keep ${Math.round(PURSE.death * 100)}%">${G.wanted.nemesis ? 'Nemesis ' : ''}W${G.wanted.w}<i class="pz">${fmtS(G.purse)} XP</i></span>`
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
    { const rdy = vetsReady().length; if (rdy) chips.unshift(`<span class="evchip warn ready" data-ready="1" style="--c:#ffe14d">${rdy} ready</span>`);
      { const lb = $('#bLift'); if (lb) { const on = !!(G.fr && !G.over && !G.watch), lbl = on ? (G.frFly ? 'Flying' : frCanFly() ? 'Lift Off' : `Lift · W${G.frReady}`) : ''; // Frontier
        if (lb.hidden === on) lb.hidden = !on; if (on && lb.dataset.l !== lbl) { lb.dataset.l = lbl; lb.firstChild.textContent = lbl; lb.classList.toggle('fly', !!G.frFly); lb.classList.toggle('cool', !G.frFly && !frCanFly()); lb.classList.add('go'); } } }
      const rb = $('#bReady'); if (rb) { const was = +rb.dataset.n || 0; if (rdy !== was) { rb.dataset.n = rdy; $('#rdyN').textContent = rdy; rb.hidden = !rdy; if (rdy > was) { rb.classList.remove('pulse'); void rb.offsetWidth; rb.classList.add('pulse'); } } } } // 5.8 Ready button
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
  // v5.8 Arms Race: your recent damage mix, then the counters the swarm has bred against it (share, tier, trend, the reason)
  function wardElNow() {
    const c = {}; for (const q of G.queue) if (q.genes && q.genes.includes('ward') && q.gel) c[q.gel] = (c[q.gel] || 0) + 1;
    for (const e of G.enemies) if (e.wardEl && !e.dead) c[e.wardEl] = (c[e.wardEl] || 0) + 1;
    return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || null;
  }
  function armsHTML() {
    const I = G.intel || { el: {} }, et = ELS.reduce((a, k) => a + (I.el[k] || 0), 0);
    const now = geneShares(), H = G.geneHist || [], back = H.length > 1 ? H[Math.max(0, H.length - 4)].g : {};
    const reads = readDefence(Math.max(G.wave, 1)), T = G.stats.gTier || {};
    const rows = GENE_IDS.map(g => ({ g, v: now[g] || 0 })).filter(r => r.v >= 0.1 || (T[r.g] && r.v >= 0.05)).sort((a, b) => b.v - a.v).slice(0, 4);
    const fire = et > 0 ? `<div class="elbar">${ELS.filter(k => I.el[k] / et > 0.01).map(k => `<i style="flex:${(I.el[k] / et).toFixed(3)};background:${EL[k].col}"></i>`).join('')}</div><div class="ellab">${ELS.filter(k => I.el[k] / et >= 0.08).map(k => `<span style="color:${EL[k].col}">${EL[k].name} ${Math.round(I.el[k] / et * 100)}%</span>`).join('')}</div>` : '<span class="note">Nothing yet</span>';
    const row = r => { const R = reads.find(x => x.g === r.g), d = r.v - (back[r.g] || 0), t = geneTier(r.v), el = r.g === 'ward' ? (R && R.el) || wardElNow() : null, tr = d >= 0.04 ? 'up' : d <= -0.04 ? 'dn' : '';
      return `<div class="armrow" style="--c:${GENES[r.g].col}"><canvas width="30" height="30" data-gico="${r.g}"${el ? ` data-el="${el}"` : ''}></canvas><b>${esc(geneTxt(r.g, el))}</b><i class="tier">${t ? roman(t) : '–'}</i><div class="armbar"><i style="width:${Math.round(r.v * 100)}%"></i><s style="left:20%"></s><s style="left:35%"></s><s style="left:50%"></s></div><em class="${tr}">${Math.round(r.v * 100)}%${tr === 'up' ? ' ▲' : tr === 'dn' ? ' ▼' : ''}</em><span>${esc(R ? R.why[0].toUpperCase() + R.why.slice(1) : 'Exploits ' + GENE_VS[r.g])} · <u>${esc(GENES[r.g].counter)}</u></span></div>`; };
    const next = reads.filter(x => (now[x.g] || 0) < 0.1).slice(0, 2);
    return `<div class="lbl">Arms Race · how the swarm answers your defence</div>
      <div class="arms"><div class="armfire"><small>Your fire</small>${fire}</div>
      <div class="armrows">${rows.length ? rows.map(row).join('') : '<p class="note">No counters bred yet: the swarm is still mixing at random.</p>'}</div>
      ${next.length ? `<p class="note">Next it may breed: ${next.map(x => `<b style="color:${GENES[x.g].col};font-weight:400">${esc(geneTxt(x.g, x.el))}</b>, ${esc(x.why)}`).join(' · ')}</p>` : ''}</div>`;
  }
  function openThreat() {
    if (!G) return;
    if (!G.over) G.paused = true;
    const P = G.spawningDone ? G.prep : null, A = G.assault, cap = geneCap(G.wave);
    const sec = [];
    if (cap > 0) sec.push(armsHTML());
    if (P) {
      const kinds = Object.entries(P.counts).sort((a, b) => b[1] - a[1]);
      sec.push(`<div class="lbl">Next · Wave ${P.w} · ${P.total} enemies${P.fly ? ' · ' + P.fly + ' flying' : ''}${P.elites ? ' · ' + P.elites + ' elite' : ''}${P.boss ? ' · Boss ' + (P.boss.odd ? '???' : esc(P.boss.name)) : ''}</div>
        <div class="thlist">${kinds.map(([k, n]) => { const D = ENEMIES[k], head = (P.heads || []).includes(k), nw = (P.fresh || []).includes(k);
          return `<div class="threv${head || nw ? ' head' : ''}"><canvas width="36" height="36" data-eico="${k}"></canvas><b>${esc(D.name)} ×${n}${nw ? ' <i class="new">New</i>' : head ? ' <i>Headline</i>' : ''}</b><span>${tipify(D.desc)}. <u>Beat it: ${tipify(D.beat)}</u></span></div>`; }).join('')}</div>`);
      if (P.list.length) sec.push(`<p class="note">${P.list.map(E => `<b class="${E.good ? 'good' : 'bad'}">${esc(E.name)}</b>: ${esc(E.desc || '')}`).join(' · ')}</p>`);
    } else sec.push(`<div class="lbl">Wave ${G.wave} in progress · ${G.queue.length + G.enemies.length} left</div>`);
    if (A && A.state !== 'done') {
      const live = A.state === 'live', lim = live ? assaultLimit(A) : null;
      sec.push(`<div class="lbl bad">Strain Assault · Wave ${A.w}${live ? ' · in progress' : ''}</div><h3 class="asname"><i class="swatch" style="background:${strainCol(A.genes)}"></i>${esc(A.name)}</h3>
        <div class="evlist">${A.genes.map(g => { const D = GENES[g]; return `<div class="evrow"><b style="color:${D.col}">${esc(geneTxt(g, A.el))}</b><div></div><em></em><span>${esc(g === 'ward' && A.el ? `Resists ${EL[A.el].name} by 50%` : D.desc)} · <u>Counter: ${esc(g === 'ward' && A.el ? `anything but ${EL[A.el].name}` : D.counter)}</u></span></div>`; }).join('')}</div>
        ${A.why && A.why.length ? `<ul class="aswhy">${A.why.map(x => `<li>${esc(x[0].toUpperCase() + x.slice(1))}</li>`).join('')}</ul>` : ''}
        <p class="note hl">${live ? `${A.n - A.killed - A.leaked} of ${A.n} left · ${A.leaked} leaked of ${lim} allowed. Hold it and it breaks: +1 power and a bounty.` : tipify(`Selling is free until Wave ${A.w} starts. Swap towers for the counters above. Let few enough through and the strain breaks: +1 power and a bounty.`)}</p>`);
    }
    if (cap > 0) {
      sec.push(`<div class="lbl">Swarm DNA · up to ${cap} gene${cap === 1 ? '' : 's'} per enemy${G.assaultNext && !(A && A.state !== 'done') ? ` · next Strain Assault ~Wave ${G.assaultNext}` : ''}</div>
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
  const ALERT_RE = /^(BOSS HALFWAY|CREDITS PILING UP|NEW ENEMY|CAPSTONE REFUNDED|[A-Z ]+ ONLINE$|BREACH WARNING|STRAIN|SWARM PRE-ADAPTED|WORMHOLE|PIRATES|CAPTAIN|LOOT STOLEN|THE WORM HUNTS|DIGESTED|MAELSTROM|CHECKPOINT|NUKE ONLINE|TALENTS ARRIVE|UPDATING|GALAXY REBORN|CONSTELLATION|LEVEL UP|NODE BEACON|RED ALERT|MOST WANTED|BOUNTY)/;
  const TIP_RE = /^(NOT ENOUGH|NO ROUTE|RELOCATE|NUKE|OVERDRIVE|OVERCHARGED|SPARE POWER|POWER$|GRID FULL|REACTOR|CORE RELOCATED|CASHED IN|LOG |INVALID|FULL SCREEN|CAN'T|ORBITAL|BIGGER MAPS|ENTROPY$|SPEED BONUS|BOON|ANOMALY|STABILIZED|SAVE |PROFILE|NOTHING|REFIT)/;
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
  const enemyCards = []; let readyIx = -1, evoWait = false;
  function enemyCard(k) {
    const D = ENEMIES[k]; if (!D) return;
    if (screen === 'game' && G && !G.over && !teachOK()) { if (!enemyCards.includes(k)) enemyCards.push(k); return; } // 6.2: waits its turn like every first-time card
    teachMark();
    if (briefMode() !== 'pause' || screen !== 'game') { toast('NEW ENEMY · ' + D.name.toUpperCase(), `${D.desc}. Beat it: ${D.beat}`, '#ff4d6a', true); return; }
    if (modalOpen || Tree.isOpen || (G && G.draft)) { if (!enemyCards.includes(k)) enemyCards.push(k); return; }
    closePanel(); if (G && !G.over) { G.paused = true; G.briefing = true; }
    modal(`<div class="card narrow brief ecard"><div class="erow"><canvas width="88" height="88" data-eico="${k}"></canvas><div class="bi"><em>${G && G.enemies.some(e => e.type === k && !e.dead) ? 'New enemy · on the field' : 'New enemy · next wave'}</em><h3>${esc(D.name)}</h3><p class="desc">${tipify(D.desc)}.</p><p class="ph good">Beat it: ${tipify(D.beat)}</p></div></div>
      <div class="foot"><span class="note">Tap any enemy on the field to inspect it</span><button class="btn primary" data-act="brief">Got it</button></div></div>`, 'brief');
    const cv = $('#modal canvas[data-eico]'); if (cv) Render.enemyIcon(k, cv);
  }
  function bossIntro(e, B) {
    const box = $('#bossIntro'); if (!box || (G && G.tut)) return; // 5.8: the Training coach introduces its boss
    const first = !PROF.codex.bosses[B.id]; if (first) teachMark(); // 6.2: a first boss counts as a first-time card (it can't wait; the next card does)
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
  // 6.3 zone arrival (Nic: "You should know when you're in a different zone"): "Entering <zone>" in the zone's colour with its
  // pitch, for 2.5 s; taps pass through. Shown when a run starts or resumes in a zone and when a jump door changes it, once nothing
  // modal covers the field (UI.tick). The board's own re-tint is Render's (the zone wipe)
  let zoneSeen = null, zoneT = null;
  function zoneBanner(id) {
    const S = SECTOR_BY[id], box = $('#zoneBan'); if (!S || !box) return;
    box.style.setProperty('--zc', S.col); box.querySelector('h3').textContent = S.name; box.querySelector('span').textContent = S.pitch;
    const cp = G && G.core ? Render.tileToScreen(G.core.x, G.core.y) : null; box.classList.toggle('low', !!cp && cp.y < Render.layout.H * 0.5 && !panel); // keep clear of the core (beside an open panel it already sits in the other half)
    box.classList.remove('out'); box.hidden = false; box.style.animation = 'none'; void box.offsetWidth; box.style.animation = '';
    clearTimeout(zoneT); zoneT = setTimeout(() => { box.classList.add('out'); zoneT = setTimeout(() => { box.hidden = true; box.classList.remove('out'); }, 350); }, 2500);
    SFX.play('zone', id);
  }
  // Settings · Zone effects: on unless the player turned it off (or the device asks for reduced motion and they never chose)
  const zfxOn = () => PROF.settings.zfx !== undefined ? PROF.settings.zfx !== false : !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  // minor sim events: only shown in the feed when Stats is on
  function log(text, col) {
    feedLines.push({ title: '', body: text, col, t: performance.now(), n: 1, minor: true });
    if (feedLines.length > 8) feedLines.shift();
    renderFeed();
  }

  // ---------- Panels ----------
  function closePanel() {
    panel = null; pick = null; capPeek = null;
    $('#panel').hidden = true;
    Render.sel = null; Render.selT = null; Render.prev = null; Render.selE = null;
    if (G) { G.selCore = false; G.reloc = null; }
    frEnd();
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
    else if (panel.kind === 'frland') el.innerHTML = frLandPanelHTML();
    else if (panel.kind === 'frmove') el.innerHTML = frMovePanelHTML();
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
    // 6.4 capstone tier towers
    saw: 'Road clearer · cuts every ground enemy on a stretch of road · ignores Plating · can\'t hit air',
    flashover: 'Burn payoff · Burning enemies explode · pair with Flame and Missile',
    surge: 'Wave opener · stores charge while idle, unloads chain lightning',
    rime: 'Blocker · an ice wall holds ground enemies · bosses smash it',
    tangle: 'Damage sharing · links enemies, hits on one copy to the rest',
    aegis: 'Leak insurance · stops leaks at the core each wave · bosses excepted',
    joker: 'Combo engine · random element, attack and status every shot',
  };
  // 6.4: the tree whose capstone tier unlocks a tower, for the build menu and the codex
  const capTreeOf = k => TALENTS.find(tr => tr.top && tr.top.unlockT === k);
  function buildPanelHTML() {
    const order = G.tut ? G.tutS.towers.slice() : TOWER_ORDER.filter(towerUnlocked).concat(TOWER_ORDER.filter(k => !towerUnlocked(k) && !TOWERS[k].capT)); // 6.4: locked tier towers sit in their own strip
    const tiles = order.map(k => {
      const D = TOWERS[k];
      if (!towerUnlocked(k)) return `<div class="bt locked" aria-label="${esc(D.name)} locked"><canvas class="tcard" data-card="${k}" data-lock="1"></canvas><span class="bn"><em>???</em><b>Wave ${D.unlock}</b></span></div>`;
      const cost = towerCost(k);
      const mr = masteryRank(k);
      return `<button class="bt ${pick === k ? 'on' : ''}${D.capT ? ' capt' : ''}" data-act="pick" data-type="${k}" aria-label="${esc(D.name)}" style="--c:${EL[D.el].col}">${mr ? `<span class="mrank r${mr}">${mr}</span>` : ''}<canvas class="tcard" data-card="${k}"></canvas><span class="bn"><em>${esc(TSHORT[k] || D.name)}</em><b ${costBtn(cost)}>${fmt(cost)}</b></span></button>`;
    }).join('');
    // 6.4: the capstone tier towers this run can't build yet, greyed in one strip so players know they exist (tap one: how to get it)
    const capLock = G.tut || G.daily ? [] : CAP_TOWERS.filter(k => !towerUnlocked(k));
    const strip = capLock.length ? `<div class="capstrip"><span class="lbl">Capstone tier</span>${capLock.map(k => `<button class="cst${capPeek === k ? ' on' : ''}" data-act="cappeek" data-type="${k}" aria-label="${esc(TOWERS[k].name)} locked"><canvas class="ico" width="24" height="24" data-ico="${k}"></canvas></button>`).join('')}</div>` : '';
    let info, foot;
    if (capPeek && !towerUnlocked(capPeek) && !pick) {
      const D = TOWERS[capPeek], tr = capTreeOf(capPeek);
      info = `<div class="binfo"><b>${esc(D.name)} <span style="color:${EL[D.el].col}">${EL[D.el].name}</span></b><p class="role">${tipify(TOWER_ROLE[capPeek] || '')}</p><p>${esc(D.blurb)}</p><p class="bst lockline">Unlock: ${esc(tr ? tr.name : '')} capstone tier (${TTOP} points in ${esc(tr ? tr.name : '')})${PROF.tal && tr && PROF.tal[tr.top.id] ? '. Learned: it joins your next run' : ''}</p></div>`;
      foot = '';
    } else if (pick) {
      const D = TOWERS[pick], cost = towerCost(pick);
      const stat = D.kind === 'snare' ? `Catches ${D.catches} fliers per wave · Lure range ${D.range}` : D.kind === 'support' ? `+${D.buffDmg}% Damage, +${D.buffRate}% Attack Speed · Range ${D.range}`
        : D.kind === 'eco' ? `+${D.income} credits per wave`
        : D.kind === 'wall' ? `Wall strength ${D.hold} · regrows every ${Math.round(1 / D.rate)}s · Range ${num1(D.range * G.mods.range)}`
        : D.kind === 'aegis' ? `Stops ${D.guards} leaks per wave · Damage ${num1(D.dmg * G.mods.dmg)} · Range ${num1(D.range * G.mods.range)}`
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
    return `<div class="ph"><b>Build</b><small class="grid ${gridFree() < 1 ? 'full' : ''}">Power ${gridUsed()}/${gridCap()}</small>${isNode(panel.x, panel.y) ? '<small class="node">Power Node</small>' : ''}<button class="x" data-act="close" aria-label="Close">✕</button></div><div class="bgrid">${tiles}</div>${strip}${nodeNote}${info}${foot ? `<div class="pfoot">${foot}</div>` : ''}`;
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
      ['Recalibration', 'Recalibration tokens pay for respecs during a run.'], ['Technique', 'An alternate fire mode for one tower type, unlocked by a one-point talent. Switch it per tower from the tower panel (Fire row).'], ['Legendary', 'Highest affix rarity with a unique effect.'], ['Curse', 'A negative affix.'],
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
  // 6.2 (frV 3): a Relay Pylon or Snare Beacon grows with the attack towers in its range (supGrow in sim.js)
  function growHTML(t) {
    if (!(G.frV >= 3) || !t.s || !supKind(t.s.kind)) return '';
    const r2 = t.s.range * t.s.range, n = G.towers.filter(o => o !== t && canOvercharge(o) && dist2(t.cx, t.cy, o.cx, o.cy) <= r2).length, want = supTarget(t);
    const tail = t.grow > 0 ? ' · Specialize free' : !n ? ' · none in range' : t.lvl >= MAX_LV ? '' : want > t.lvl ? '' : ` · now LV ${want}`;
    return `<div class="sts grow">Grows with nearby attack towers${t.freeLv ? ` <b>+${t.freeLv} LV free</b>` : ''}<small>${n} in range${tail}</small></div>`;
  }
  // 6.4 (tower64): one live line per capstone tier tower, in plain words
  function capInfoHTML(t) {
    const s = t.s; let txt = '';
    if (s.kind === 'saw') txt = `Blade runs ${num1(s.sawLen)} tiles up the road${s.boomer ? ' and back' : ''} · ignores Plating · ground only`;
    else if (s.kind === 'det') txt = `Explosions: hit + remaining Burn ×${num1(s.detX)} · radius ${num1(s.detR)}${s.detSpread ? ` · spreads fire ${num1(s.detSpread)} tiles` : ''}`;
    else if (s.kind === 'surge') txt = `Charge ${Math.floor(t.charge || 0)}/${s.cells} · fills 1 per ${num1(1 / s.chargeRate)}s while idle · fires 4× as fast while charged`;
    else if (s.kind === 'wall') txt = t.wall ? `Wall ${Math.max(0, Math.ceil(t.wall.hp))}/${Math.round(s.hold)} · elites wear it 2× as fast` : `Wall down · regrows in ${Math.max(0, Math.ceil(t.cd / Math.max(0.01, s.rate)))}s`;
    else if (s.kind === 'tether') txt = `Links ${s.links} enemies for ${num1(s.linkT)}s · copies ${pct(s.share)} of each hit${s.tslow ? ` · linked ${pct(s.tslow)} slower` : ''}`;
    else if (s.kind === 'aegis') { const c = G.core, r = s.range + 0.5, ok = dist2(t.cx, t.cy, c.x, c.y) <= r * r; txt = `Stops left this wave ${Math.max(0, s.guards - (t.guardN || 0))}/${s.guards} · ${ok ? 'core in range' : 'core out of range: no stops'}`; }
    else if (s.kind === 'joker') txt = `Jackpot every ${s.jack}th shot · next in ${s.jack - ((t.jn || 0) % s.jack)}${s.sure ? ' · statuses always land' : ''}`;
    return txt ? `<div class="sts capinfo">${tipify(txt)}</div>` : '';
  }
  function towerPanelHTML(t) {
    const D = TOWERS[t.type], s = t.s;
    const spec = t.spec ? D.specs[t.spec - 1].name : '';
    let stats;
    if (s.kind === 'snare') stats = `<div class="sg"><span>Catches left<b>${Math.max(0, s.catches - (t.caught || 0))}/${s.catches}</b></span><span>Lure range<b>${num1(s.range)}</b></span><span>Net slow<b>${pct(s.netSlow)}</b></span><span>Hold<b>${num1(s.hold)}s</b></span></div>`;
    else if (s.kind === 'support') stats = `<div class="sg"><span>Dmg buff<b>+${pct(s.buffDmg)}</b></span><span>Speed buff<b>+${pct(s.buffRate)}</b></span><span>Range<b>${num1(s.range)}</b></span>${s.buffCrit ? `<span>Crit buff<b>+${num1(s.buffCrit)}%</b></span>` : ''}</div>`;
    else if (s.kind === 'eco') stats = `<div class="sg"><span>Income<b>${fmt(s.income * G.mods.credits)}/wave</b></span>${s.fdmg ? `<span>Slug<b>${fmt(s.fdmg)}</b></span>` : ''}${s.bountyAura ? `<span>Bounty aura<b>+${pct(s.bountyAura)}</b></span>` : ''}${s.fbounty ? `<span>All kills<b>+${pct(s.fbounty)}</b></span>` : ''}</div>`;
    else {
      const sts = [];
      if (s.burn > 0) sts.push(`Burn ${pct(s.burn)}`); if (s.chill > 0) sts.push(`Chill ${pct(s.chill)}`);
      if (s.shock > 0) sts.push(`Shock ${pct(s.shock)}`); if (s.mark > 0) sts.push(`Mark ${pct(s.mark)}`);
      if (s.pierce) sts.push(`Pierce ${s.pierce}`); if (s.chain) sts.push(`Chain ${s.chain}`); if (s.splash) sts.push(`Splash ${num1(s.splash)}`);
      if (s.multi) sts.push(`+${s.multi} target`);
      stats = `<div class="sg"><span>Damage<b>${fmt(s.dmg * (1 + t.buff.dmg))}</b></span><span>Rate<b>${num1(s.rate * (1 + t.buff.rate))}/s</b></span><span>Range<b>${num1(t.effRange || s.range)}</b></span><span>Crit<b>${Math.round(s.critC + t.buff.crit)}%</b></span><span>DPS<b data-live="dps">${fmt(t.dps)}</b></span><span>Kills<b data-live="kills">${t.kills}</b></span></div>${sts.length ? `<div class="sts">${tipify(sts.join(' · '))}</div>` : ''}${t.isolated && G.mods.loneWolf ? `<div class="sts amber">${tipify('Lone Wolf: active')}</div>` : ''}${t.reson ? `<div class="sts reson">${tipify(`Resonance: +${Math.round(t.reson * RESON_DMG * 100)}% Damage (${t.resonWith.map(o => EL[o.s.el].name).join(', ')})`)}</div>` : ''}`;
    }
    if (TOWERS[t.type].capT) stats += capInfoHTML(t); // 6.4 capstone tier towers: what this one is doing right now
    const modes = s.kind === 'support' || s.kind === 'snare' || s.kind === 'eco' || s.kind === 'pulse' || s.kind === 'grav' || s.kind === 'det' || s.kind === 'wall' ? '' :
      `<div class="firerow"><span class="lbl">Aim</span>${['first', 'last', 'strong', 'close'].map(m => `<button class="chip ${t.mode === m ? 'on' : ''}" data-act="mode" data-v="${m}">${{ first: 'First', last: 'Last', strong: 'Strong', close: 'Near' }[m]}</button>`).join('')}</div>`; // v5.8: label inline (one row) to make room for Fire
    const fire = fireHTML(t);
    let up = '';
    if (t.lvl < 3 || t.lvl === 4) { const c = upgradeCost(t); up = `<button class="btn primary wide lvup" style="${tierStyle(t.lvl + 1)}" data-act="up" ${costBtn(c)}>Upgrade to LV ${t.lvl + 1} · ${fmt(c)}<small>${s.kind === 'snare' ? 'more catches, longer hold, wider net' : s.kind === 'support' ? 'stronger boost' : s.kind === 'eco' ? 'more income' : 'more Damage'}, new affix</small></button>`; }
    else if (t.lvl === 3) { const c = t.grow > 0 ? 0 : upgradeCost(t); up = `<div class="lbl">Specialize · ${c ? fmt(c) : 'Free: grown with its towers'}</div><div class="specs">${D.specs.map((sp, i) => `<button class="spec" data-act="spec" data-v="${i + 1}" ${c ? costBtn(c) : ''}><b>${esc(sp.name)}</b><span>${tipify(sp.desc)}</span></button>`).join('')}</div>`; }
    else if (t.ascPend > 0) { const c = upgradeCost(t); up = `<button class="btn primary wide asc lvup" style="${tierStyle(towerLevel(t) + 1)}" disabled>Ascend to LV ${towerLevel(t) + 1} · ${fmt(c)}<small>Choose a perk ${(panel.tab || 'act') === 'info' ? 'on the Actions tab' : 'above'} first</small></button>`; }
    else { const c = upgradeCost(t); up = `<button class="btn primary wide asc lvup" style="${tierStyle(towerLevel(t) + 1)}" data-act="up" ${costBtn(c)}>Ascend to LV ${towerLevel(t) + 1} · ${fmt(c)}<small>${lvTier(towerLevel(t) + 1).name} · ×${G.ascV >= 2 ? ASC_DMG_T[t.type] || ASC_DMG : ASC_DMG_OLD} Damage${G.ascV >= 2 && perkPool(t).length ? ', perk' : ''}, affix</small></button>`; }
    let vet = '';
    if (t.pending > 0) {
      const o = vetOffer(t);
      vet = `<div class="vet"><div class="lbl">Choose a mutation${t.pending > 1 ? ` · ${t.pending} ready` : ''}</div>${o.map((a, i) => `<button class="aff pickable" data-act="vet" data-v="${i}" style="--c:${RARITY[a.tier].col}"><i>${tipify(RARITY[a.tier].name)}</i>${tipify(affixText(a))}</button>`).join('')}</div>`;
    }
    const nextVet = vetThreshold(t.rank + 1), prevVet = t.rank ? vetThreshold(t.rank) : 0;
    const perks = perkCardsHTML(t), perkList = perkListHTML(t);
    const rc = rerollCost(t);
    const title = esc(D.name);
    const combat = !(s.kind === 'eco' || s.kind === 'support' || s.kind === 'snare');
    const vbar = combat ? `<div class="vrow"><span class="lbl">${t.rank ? 'Veteran ' + roman(t.rank) : 'Rookie'}</span><div class="xpbar"><i style="width:${pct(clamp((t.vxp - prevVet) / Math.max(1, nextVet - prevVet), 0, 1))}"></i></div></div>` : '';
    const idle = idleWaves(t) >= 2 ? `<div class="sts bad">Idle for ${idleWaves(t)} waves: nothing has come in range. Sell it and build where the enemies are.</div>` : '';
    const head = `<div class="ph tabbed"><canvas class="ico" width="24" height="24" data-ico="${t.type}"></canvas><div class="pt"><b>${title}</b><small>${t.name ? `<em class="vname">"${esc(t.name)}"</em> · ` : ''}<b class="lvtag" style="background:${lvTier(towerLevel(t)).col}">LV ${towerLevel(t)}</b>${spec ? ' · ' + esc(spec) : ''} · <span style="color:${EL[s.el].col}">${EL[s.el].name}</span></small></div><button class="x" data-act="close" aria-label="Close">✕</button>${tabsHTML(t.affixes.length ? t.affixes.length : '')}</div>`;
    const foot = `<div class="pfoot">${t.lvl === 3 ? `<button class="btn wide lvup" disabled>Choose a Specialization<small>${(panel.tab || 'act') === 'info' ? 'on the Actions tab' : 'above'}</small></button>` : up}
      <div class="row2"><button class="btn" data-act="reroll" ${costBtn(rc)}>Reroll · ${fmt(rc)}</button>${G.tokens > 0 ? `<button class="btn tokbtn" data-act="rerollTok">Reroll · 1 token<small>${G.tokens} left</small></button>` : ''}${G.fr ? (t === frDockT() ? '<button class="btn frmove" disabled>Move<small>Docked</small></button>' : `<button class="btn frmove" data-act="frmove" ${t.mvT > 0 ? 'disabled' : costBtn(frMoveFee(t))}>Move · ${fmt(frMoveFee(t))}${t.mvT > 0 ? '<small>Moving</small>' : ''}</button>`) : ''}<button class="btn danger" data-act="sell">Sell +${fmt(sellRefund(t))}${G.refit && !G.checkpoint ? '<small>Free refit · 100%</small>' : ''}</button></div></div>`;
    if ((panel.tab || 'act') === 'info') return `${head}
      ${vbar}
      ${stats}
      ${condHTML(t)}
      ${idle}
      ${growHTML(t)}
      ${t.linkedTo ? `<div class="sts node">${tipify(`Node Link with ${TOWERS[t.linkedTo.type].name}: +10% Damage, shared beam`)}</div>` : ''}
      ${s.node ? `<div class="sts node">${tipify(s.kind === 'support' ? 'Power Node: +25% Boost strength' : s.kind === 'eco' ? 'Power Node: +25% Income' : s.kind === 'snare' ? 'Power Node: +25% catches, +15% Range' : 'Power Node: +25% Damage, +15% Range')}</div>` : ''}
      ${perkList}
      ${t.affixes.length ? `<div class="lbl">Affixes</div><div class="affs">${t.affixes.map(a => s.kind === 'snare' ? affixHTML(a).replace('Boost strength', 'Net strength') : affixHTML(a)).join('')}</div>` : ''}
      ${foot}`;
    return `${head}
      ${growHTML(t)}
      ${t.lvl === 3 ? up : ''}
      ${perks}
      ${vet}
      ${condHTML(t)}
      ${idle}
      ${canOvercharge(t) ? `<div class="lbl">${tipify('Overcharge')} · +${Math.round((OVERCHARGE.dmg + FX('msOc') / 100) * 100)}% per step · power ${gridUsed()}/${gridCap()}</div><div class="modes oc">${ocFree(t) ? `<span class="note">Marksman: +${ocFree(t)} free</span>` : ''}${Array.from({ length: ocMax() + 1 }, (_, n) => `<button class="chip ${(t.oc || 0) === n ? 'on' : ''}" data-act="oc" data-v="${n}" ${n - (t.oc || 0) > gridFree() ? 'disabled' : ''}>${n ? `+${n}` : 'Off'}</button>`).join('')}</div>` : ''}
      ${modes}
      ${fire}
      ${!canOvercharge(t) && !modes ? `<div class="sg mini">${stats.replace(/^<div class="sg">|<\/div>.*$/gs, '')}</div>` : ''}
      ${foot}`;
  }
  // v5.8 Techniques: Standard plus each fire mode in a fixed row; a locked mode stays in its slot, dimmed, naming its talent
  function fireHTML(t) {
    const L = fireModes(t.type); if (!L.length) return '';
    const cur = fireDef(t), D = TOWERS[t.type];
    const lock = L.find(f => !fireLearned(t.type, f.id)), lockT = lock && TAL[lock.need];
    const line = cur ? cur.short : lock && L.length === 1 ? `Locked: learn ${lockT.name} in ${TREE_BY_ID[lockT.tree].name}` : D.blurb;
    return `<div class="firerow"><span class="lbl">Fire</span>${[{ id: '', name: 'Standard' }].concat(L).map(f => { const ok = !f.id || fireLearned(t.type, f.id), on = (cur ? cur.id : '') === f.id;
      return `<button class="chip ${on ? 'on' : ''} ${ok ? '' : 'lock'}" data-act="${ok ? 'fire' : 'fireLock'}" data-v="${f.id}">${esc(f.name)}</button>`; }).join('')}</div><div class="firedesc">${tipify(line)}</div>`;
  }
  // v5.8 Ascension perks: the pending pick as fixed-height cards (3, or 4 at Mastery 4), and the perks taken (Details tab)
  function perkCardsHTML(t) {
    const o = ascOffer(t); if (!o) return '';
    return `<div class="perks n${o.length}"><div class="lbl">Ascension perk · choose 1</div>${o.map((id, i) => { const P = perkDef(t.type, id), n = perkStacks(t, id);
      return `<button class="perk${P.spec ? ' sp' : ''}" data-act="perk" data-v="${i}"${P.spec ? ` title="${esc(TOWERS[t.type].specs[P.spec - 1].name)} perk"` : ''}><b>${esc(P.name)}${n ? `<em>${roman(n + 1)}</em>` : ''}</b><span>${esc(perkText(P, n))}</span></button>`; }).join('')}</div>`; // plain text: a tooltip word would swallow the tap
  }
  function perkListHTML(t) {
    const ids = [...new Set(t.perks || [])]; if (!ids.length) return '';
    return `<div class="lbl">Perks</div><div class="affs">${ids.map(id => { const P = perkDef(t.type, id), n = perkStacks(t, id); return P ? `<div class="aff" style="--c:#ff8a2a"><i>${esc(P.name)}${n > 1 ? ' ' + roman(n) : ''}</i>${tipify(perkTotal(P, n))}</div>` : ''; }).join('')}</div>`;
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
      ${G.fr ? frCoreHTML() : `<div class="lbl">Weapon Element</div>
      <div class="elgrid">${ELS.map(e => `<button class="chip ${c.el === e ? 'on' : ''}" data-act="cel" data-v="${e}" style="--c:${EL[e].col};color:${c.el === e ? '' : EL[e].col}">${EL[e].name}</button>`).join('')}</div>`}
      ${G.af.lastStand ? '<div class="sts bad">Last Stand: repairs disabled</div>' : ''}
      ${foot}`;
    // 6.1 Frontier: docked, the core's gun is the docked tower (its stats, kills and element); in the air it is offline
    const dk = G.fr ? frDockT() : null, dS = dk && dk.s, air = G.fr && G.frFly;
    const gunSg = dk ? `<span>Damage<b>${fmt(dS.dmg * (1 + dk.buff.dmg))}</b></span><span>Rate<b>${num1(dS.rate * (1 + dk.buff.rate))}/s</b></span><span>Range<b>${num1(dk.effRange || dS.range)}</b></span><span>Kills<b>${dk.kills}</b></span>`
      : `<span>Damage<b>${air ? '—' : fmt(s.dmg)}</b></span><span>Rate<b>${air ? '—' : num1(s.rate) + '/s'}</b></span><span>Range<b>${num1(s.range)}</b></span><span>Kills<b data-live="ckills">${c.kills || 0}</b></span>`;
    const gunSts = dk ? `<div class="sts frdock" style="--c:${EL[dS.el].col}">Docked: <b>${esc(towerLabel(dk))}</b> LV ${towerLevel(dk)} · ${EL[dS.el].name} · ×${num1(frDockX())} Damage (Battery +${pct(FRONTIER.dockBat)} per level), +${FRONTIER.dockRange} Range</div><div class="sts dim">${tipify('Battery modules fire with the plain cannon, not while docked')}</div>`
      : air ? `<div class="sts">${tipify('In the air: the gun is offline and the shield is down until it lands')}</div>`
      : `<div class="sts">${tipify(`Shells hit whatever is closest to reaching the core · Blast ${num1(s.splash)}`)}</div>`;
    const zS = SECTOR_BY[G.sector]; // 6.3: the zone, in its colour
    return `${head}
      <div class="sg"><span>Hull<b data-live="chp">${Math.ceil(c.hp)}/${Math.round(c.max)}</b></span><span>Shield<b data-live="csh">${Math.floor(c.shield)}/${Math.round(c.smax)}</b></span>${gunSg}</div>
      ${gunSts}
      ${zS ? `<div class="sts zline" style="--c:${zS.col}">Zone: <b>${esc(zS.name)}</b>. ${esc(zS.pitch)}</div>` : ''}
      ${G.fr ? `<div class="sts ${(G.frLinks || []).length ? 'good' : 'dim'}">${G.frFly ? 'Links break while flying' : `Links ${(G.frLinks || []).length}/${frLinkN()} within ${FRONTIER.linkR} tiles · linked towers +${pct(FRONTIER.linkDmg)} Damage and Rate · core +${pct(FRONTIER.linkCore * (G.frLinks || []).length)}`}</div>` : ''}
      ${mods}
      <div class="lbl">Command Uplink · LV ${c.uLvl || 0}/${UPLINK.max} · −${UPLINK.cd * (c.uLvl || 0)}% cooldowns${G.fr ? ` · +1 link per ${FRONTIER.linkUplink} levels, lift-off wait −1 wave per ${FRONTIER.cdUplink}` : ''}</div>
      <div class="cmods">${UPLINK.mods.map(m => `<span class="${(c.uLvl || 0) >= m.lv ? 'on' : ''}"><b>${(c.uLvl || 0) >= m.lv ? '' : 'LV ' + m.lv + ' · '}${esc(m.name)}</b>${tipify(m.desc)}</span>`).join('')}</div>
      ${s.node ? `<div class="sts node">${tipify('Power Node: core overcharged, +50% Damage, +20% Rate')}</div>` : ''}
      <div class="sts ${G.odUsed ? 'dim' : odReady() ? 'good' : ''}">${tipify(G.odUsed ? `Nuke: used on Wave ${G.odUsed}` : odReady() ? 'Nuke: ready · launch it from the left rail. One board clear this run' : `Nuke: arms at Wave ${OD_WAVE} · once per run`)}</div>
      <div class="lbl">Affixes${c.affixes.length ? '' : ' · each Weapon or Shield upgrade rolls one'}</div>
      ${c.affixes.length ? `<div class="affs">${c.affixes.map(affixHTML).join('')}</div>` : ''}
      <div class="sts">${tipify(`Power grid ${gridUsed()}/${gridCap()}${G.reactorN ? ` · ${G.reactorN} reactor expansion${G.reactorN > 1 ? 's' : ''}` : ''}. Each expansion adds +1 power for the rest of the run and costs more than the last`)}</div>
      ${canRelocate() || G.fr ? '' : relocHTML()}
      ${foot}`;
  }
  // ---------- Frontier: the core panel's flight block, the landing picker and preview, and moving a tower ----------
  // The picker state lives here (frSel), not in G; Render draws it. The game pauses while you choose and resumes after.
  let frSel = null;
  function frLiftLabel() { return G.frFly ? 'In flight' : frCanFly() ? 'Lift Off' : `Lift Off · Wave ${G.frReady}`; }
  function frCoreHTML() {
    const d = frDockT(), n = (G.frLinks || []).length;
    const gun = G.frFly ? `<div class="sts">${tipify('In the air: the gun is offline and the shield is down until it lands')}</div>`
      : d ? `<div class="sts frdock" style="--c:${EL[d.s.el].col}">Docked: <b>${esc(TOWERS[d.type].name)}</b> LV ${towerLevel(d)} · ×${num1(frDockX())} Damage, +${FRONTIER.dockRange} Range</div>`
      : `<div class="sts">${tipify('Plain cannon. Land on an attack tower to dock it: the core fires its weapon')}</div>`;
    return `<div class="lbl">Flight</div>${gun}
      <div class="sts ${n ? 'good' : 'dim'}">${G.frFly ? 'Links break while flying' : `Links ${n}/${frLinkN()} · linked towers +${pct(FRONTIER.linkDmg)} Damage and Rate · core +${pct(FRONTIER.linkCore * n)}`}</div>
      <div class="row2"><button class="btn frlift" data-act="frlift" ${frCanFly() ? '' : 'disabled'}>${G.frFly ? 'In flight' : 'Lift Off'}<small>${frCanFly() ? 'Land anywhere · on a tower to dock' : G.frFly ? 'Landing' : `Ready on Wave ${G.frReady}`}</small></button>${d ? '<button class="btn" data-act="frtower">Docked tower<small>Upgrade, Fire, Aim</small></button>' : ''}</div>`;
  }
  function frPause(on) { if (!G) return; if (on) { if (frSel && frSel.paused === undefined) { frSel.paused = G.paused; G.paused = true; } } else if (frSel && frSel.paused === false && !modalOpen) G.paused = false; }
  function startLift() {
    if (!G || !G.fr || G.over) return;
    if (!frCanFly()) { SFX.play('deny'); toast('LIFT OFF', G.frFly ? 'Already in the air' : `Recharging: ready on Wave ${G.frReady}`, '#59f0b4', true, 'tip'); return; }
    frEnd(); closePanel();
    frSel = { kind: 'land', cands: new Set(frCands()), plan: null }; Render.frSel = frSel; frPause(true);
    openPanel({ kind: 'frland', x: G.map.core.x, y: G.map.core.y });
    updateHud(true);
  }
  function startMove(t) {
    if (!G || !G.fr || !t) return;
    if (t === frDockT()) { SFX.play('deny'); toast('MOVE', 'The core sits on this tower. Lift off first', '#ffb03a', true, 'tip'); return; }
    if (t.mvT > 0) { SFX.play('deny'); return; }
    const R = G.region, c = new Set(); for (let y = R.y0; y < R.y1; y++) for (let x = R.x0; x < R.x1; x++) if (canBuildAt(x, y)) c.add(tIdx(x, y));
    frEnd(); closePanel();
    frSel = { kind: 'move', cands: c, t, dest: null }; Render.frSel = frSel; frPause(true);
    Render.sel = { x: t.x, y: t.y };
    openPanel({ kind: 'frmove', x: t.x, y: t.y });
  }
  function frEnd() { if (!frSel) return; frPause(false); frSel = null; Render.frSel = null; }
  function frLandPanelHTML() {
    const P = frSel && frSel.plan;
    const head = `<div class="ph"><div class="pt"><b>Lift Off</b><small>Paused while you choose</small></div><button class="x" data-act="frcancel" aria-label="Cancel">✕</button></div>`;
    if (!P) return head + `<p class="note">Tap a highlighted tile to land there. A framed tower docks: the core fires its weapon at ×${num1(frDockX())} Damage, +${FRONTIER.dockRange} Range.</p>
      <p class="note">Every road swings to the landing spot, and enemies already walking turn toward it. In the air the gun is offline and the shield is down. Flight: about 1 s per ${FRONTIER.flySpd} tiles.</p>
      <div class="pfoot"><button class="btn" data-act="frcancel">Cancel</button></div>`;
    const tot = a => a.reduce((x, y) => x + y, 0), dd = tot(P.after) - tot(P.before);
    const rows = P.before.map((b, i) => { const a = P.after[i], d = a - b, L = G.map.lanes[i]; return `<span>${i === 0 ? 'Main road' : L.openWave ? 'Forming' : 'Lane ' + (i + 1)}<b class="${d > 0 ? 'good' : d < 0 ? 'bad' : ''}">${b} → ${a}</b></span>`; }).join('');
    const D = P.dock, ds = D && D.s;
    const gun = D ? `<div class="sts frdock" style="--c:${EL[ds.el].col}">Docks <b>${esc(TOWERS[D.type].name)}</b> LV ${towerLevel(D)}: Damage ${fmt(ds.dmg)} → ${fmt(ds.dmg * frDockX() * (1 + FRONTIER.linkCore * P.links.length))} · Range ${num1(ds.range)} → ${num1(ds.range + FRONTIER.dockRange)}</div>`
      : `<div class="sts">${tipify(`Plain cannon · ${EL[G.core.el].name}`)}</div>`;
    const links = P.links.length ? `Links ${P.links.length}: ${P.links.map(t => esc(TSHORT[t.type] || TOWERS[t.type].name)).join(', ')}` : `No towers within ${FRONTIER.linkR} tiles to link`;
    return head + `<div class="lbl">Road length (tiles)</div><div class="sg">${rows}</div>
      <div class="sts ${dd > 0 ? 'good' : dd < 0 ? 'bad' : ''}">${dd === 0 ? 'Same total road length' : `${dd > 0 ? '+' : '−'}${Math.abs(dd)} tiles of road in total`}${dd > 0 ? ': enemies walk further' : dd < 0 ? ': enemies arrive sooner' : ''}</div>
      ${gun}
      <div class="sts ${P.links.length ? 'good' : 'dim'}">${links}</div>
      ${isNode(P.x, P.y) ? `<div class="sts node">${tipify('Power Node: the core will be overcharged, +50% Damage, +20% Rate')}</div>` : ''}
      <div class="sts">${P.secs > 0 ? `Flight ${num1(P.secs)} s · ` : ''}next lift-off ${frCd()} waves after landing</div>
      <div class="pfoot"><button class="btn primary wide" data-act="frgo">${D ? 'Land and dock' : 'Land here'}</button><button class="btn" data-act="frcancel">Cancel</button></div>`;
  }
  function frMovePanelHTML() {
    const t = frSel && frSel.t; if (!t) return '';
    const fee = frMoveFee(t), d = frSel.dest;
    return `<div class="ph"><div class="pt"><b>Move ${esc(TOWERS[t.type].name)}</b><small>Paused while you choose</small></div><button class="x" data-act="frcancel" aria-label="Cancel">✕</button></div>
      <p class="note">${d ? 'Tap another tile to compare, or confirm.' : 'Tap an open tile inside the sector.'} It flies over and is offline for ${FRONTIER.moveT} s. Fee ${fmt(fee)} (${pct(FRONTIER.moveFee)} of what it cost).</p>
      <div class="pfoot"><button class="btn primary wide" data-act="frmovego" ${d ? costBtn(fee) : 'disabled'}>Move here · ${fmt(fee)}</button><button class="btn" data-act="frcancel">Cancel</button></div>`;
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
      const sig = t.pending + ':' + t.rank + ':' + t.reson + ':' + t.affixes.length + ':' + t.lvl + ':' + (t.ascPend || 0) + ':' + (t.perks ? t.perks.length : 0) + (G.fr ? ':' + (t.mvT > 0 ? 1 : 0) + (t === frDockT() ? 'd' : '') : '');
      if (panel.sig !== undefined && panel.sig !== sig) { panel.sig = sig; renderPanel(); return; }
      panel.sig = sig;
      const d = el.querySelector('[data-live="dps"]'); if (d) d.textContent = fmt(t.dps);
      const cd = el.querySelector('[data-live="conds"]'); if (cd && !panelHeld) { const sg = towerConditions(t).map(c => c.t).join('|'); if (cd.dataset.sig !== sg) cd.outerHTML = condHTML(t); }
      const k = el.querySelector('[data-live="kills"]'); if (k) k.textContent = t.kills;
    }
    if (panel.kind === 'enemy') { const e = panel.e, b = el.querySelector('[data-live="ehpbar"]'); if (b) b.style.width = pct(clamp(e.hp / e.maxHp, 0, 1));
      const h = el.querySelector('[data-live="ehp"]'); if (h) h.textContent = `${fmt(Math.max(0, e.hp))} / ${fmt(e.maxHp)} HP`;
      const pg = el.querySelector('[data-live="eprog"]'); if (pg && e.L && e.L.len) pg.textContent = Math.round(eProg(e) * 100) + '%';
      const sig = [e.st.burn ? 1 : 0, e.st.chill, e.st.frozen > 0 ? 1 : 0, e.st.shock > 0 ? 1 : 0, e.st.mark, e.scanned > 0 ? 1 : 0, e.shield > 0 ? 1 : 0, e.phase || 0].join(':');
      if (panel.sig !== undefined && panel.sig !== sig) { panel.sig = sig; renderPanel(); return; } panel.sig = sig; return; }
    if (panel.kind === 'cash') { const sig = Math.floor(G.credits) + ':' + G.wave; if (panel.sig !== sig) { panel.sig = sig; renderPanel(); } return; }
    if (panel.kind === 'core') {
      const c = G.core, sig = (canRelocate() ? 1 : 0) + ':' + relocCost() + ':' + c.affixes.length + ':' + (odReady() ? 1 : 0) + (G.fr ? ':' + frLiftLabel() + (frDockT() ? 'd' : '') + (G.frLinks || []).length : '');
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
      if (act === 'cappeek') { capPeek = b.dataset.type; pick = null; Render.prev = null; renderPanel(); const pb = $('#panel > .pbody'); if (pb) pb.scrollTop = pb.scrollHeight; return; } // 6.4: a locked tier tower: say how to get it (scrolled into view on a phone)
      if (act === 'pick') {
        if (pick === b.dataset.type && G.credits >= towerCost(pick)) return panelAction('build', b);
        pick = b.dataset.type; capPeek = null;
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
      else if (act === 'fire') { if (!window.act('fire', t.x, t.y, b.dataset.v)) SFX.play('deny'); renderPanel(); }
      else if (act === 'fireLock') { const F = fireModes(t.type).find(f => f.id === b.dataset.v), T = F && TAL[F.need]; if (F && T) toast(F.name.toUpperCase(), `${F.desc}. Learn ${T.name} in the ${TREE_BY_ID[T.tree].name} talents to unlock it`, TREE_BY_ID[T.tree].col, true, 'tip'); }
      else if (act === 'up') { if (!window.act('up', t.x, t.y)) SFX.play('deny'); else if (t.ascPend > 0) panel.tab = 'act'; renderPanel(); }
      else if (act === 'perk') { if (!window.act('ascPick', t.x, t.y, +b.dataset.v)) SFX.play('deny'); renderPanel(); }
      else if (act === 'spec') { if (!window.act('up', t.x, t.y, +b.dataset.v)) SFX.play('deny'); renderPanel(); }
      else if (act === 'reroll') { if (!window.act('reroll', t.x, t.y, 0)) SFX.play('deny'); renderPanel(); }
      else if (act === 'rerollTok') { if (!window.act('reroll', t.x, t.y, 1)) SFX.play('deny'); renderPanel(); }
      else if (act === 'sell') { window.act('sell', t.x, t.y); closePanel(); }
      else if (act === 'frmove') startMove(t);
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
        if (r === 'empty') { SFX.play('deny'); toast('NUKE', 'Nothing to clear yet. Save it for a crowd', '#ff4d6a'); renderPanel(); }
        else if (r !== 'ok') { SFX.play('deny'); renderPanel(); }
        else { closePanel(); toast('NUKE', `${G.stats.odKills} enemies erased`, '#59f0b4'); updateHud(); }
      }
      else if (act === 'reloc') startReloc();
      else if (act === 'frlift') startLift();
      else if (act === 'frtower') { const d = frDockT(); if (d) openTower(d); }
      else if (act === 'reactor') { if (!window.act('reactor')) SFX.play('deny'); else toast('REACTOR EXPANDED', `Power ${gridUsed()}/${gridCap()} · next ${fmt(reactorCost())}`, '#59f0b4'); renderPanel(); updateHud(); }
      return;
    }
    if (panel.kind === 'frland' || panel.kind === 'frmove') {
      if (act === 'frcancel') { closePanel(); return; }
      if (act === 'frgo' && frSel && frSel.plan) {
        const P = frSel.plan, wasPaused = frSel.paused;
        if (!window.act('frFly', P.x, P.y)) { SFX.play('deny'); toast('NO ROUTE', 'That spot is no longer open. Pick another', '#ff4d6a', true, 'tip'); frSel.cands = new Set(frCands()); frSel.plan = null; renderPanel(); return; }
        closePanel(); if (!wasPaused && !modalOpen) G.paused = false;
        toast('LIFT OFF', P.secs > 0 ? `Landing in ${num1(P.secs)} s${P.dock ? ` on ${TOWERS[P.dock.type].name}` : ''}. The roads already lead there` : 'Landed', '#59f0b4', true, 'tip');
        updateHud(true); Save.save();
      }
      if (act === 'frmovego' && frSel && frSel.t && frSel.dest) {
        const t = frSel.t, d = frSel.dest;
        if (!window.act('frMove', t.x, t.y, d.x, d.y)) { SFX.play('deny'); return; }
        closePanel(); openTower(t); updateHud();
      }
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
  const TSHORT = { pulse: 'Pulse', rail: 'Rail', cryo: 'Cryo', snare: 'Snare', missile: 'Missile', pylon: 'Pylon', coil: 'Coil', forge: 'Forge', flame: 'Flame', lens: 'Lens', emp: 'EMP', saw: 'Buzzsaw', flashover: 'Flashover', surge: 'Surge', rime: 'Rimewall', tangle: 'Tangler', aegis: 'Aegis', joker: 'Wildcard', grav: 'Gravity' };
  function openBuild(x, y) {
    Render.sel = { x, y }; Render.selT = null; G.selCore = false;
    pick = null; capPeek = null; Render.prev = null;
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
    const prog = e.L && e.L.len ? Math.round(eProg(e) * 100) : 0;
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
      Render.zoomAt((a.x + b.x) / 2 - (r.left / UIS), (a.y + b.y) / 2 - (r.top / UIS), d / gesture.d); camUser++;
      gesture.d = d; updateZoomBtn();
    } else if (gesture.kind === 'tap' || gesture.kind === 'pan') {
      gesture.moved += Math.abs(dx) + Math.abs(dy);
      if (gesture.moved > 12) gesture.kind = 'pan';
      if (gesture.kind === 'pan') { Render.panBy(dx, dy); updateZoomBtn(); camUser++; if (e.pointerType === 'mouse') $('#cv').style.cursor = 'grabbing'; }
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
    const live = en || inside && (G.towerAt[tIdx(tx, ty)] || (tx === G.map.core.x && ty === G.map.core.y) || canBuildAt(tx, ty) || cacheNear(p, tx, ty));
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
    { const A = Render.arrowAt(sx, sy); if (A) { lastTap = null; if (A.home) Render.resetCam(); else Render.lookAt(A.x, A.y); updateZoomBtn(); SFX.play('ui'); return; } } // edge arrows: the core goes home, the rest look there
    tapTile(Render.screenToTile(sx, sy));
  }
  let lastTap = null;
  // 6.2 (Nic: "1 square buffer, I miss them sometimes"): a tap within about a tile of a crate claims it (the nearest one; the
  // claim is recorded with the crate's own tile). A tap on a tower or the core still opens that, so building and selecting work
  const CACHE_REACH = 1.5;
  function cacheNear(p, tx, ty) {
    const on = cacheAt(tx, ty); if (on) return on;
    if (G.towerAt[tIdx(tx, ty)] || (tx === G.map.core.x && ty === G.map.core.y)) return null;
    let best = null, bd = CACHE_REACH;
    for (const c of G.caches || []) { const d = Math.hypot(p.x - (c.x + 0.5), p.y - (c.y + 0.5)); if (d <= bd) { bd = d; best = c; } }
    return best;
  }
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
    if (frSel) { // Frontier picker: a landing spot (preview) or a tower's new tile
      const i = tIdx(tx, ty);
      if (!frSel.cands.has(i)) { SFX.play('deny'); if (frSel.kind === 'move' && frNearWorm(tx, ty)) { Render.flashWorm(); toast('TOO CLOSE', `No towers within ${FRONTIER.wormBuild} tiles of a wormhole`, '#ff4d6a', true, 'tip'); } return; }
      if (frSel.kind === 'land') { const P = frPlan(tx, ty); if (!P) { const Q = planRelocation(tx, ty, true); SFX.play('deny'); toast('NO ROUTE', Q ? `Too close: a road from a wormhole would be under ${FRONTIER.minRoad} tiles` : 'A road cannot reach that tile', '#ff4d6a', true, 'tip'); return; } frSel.plan = P; }
      else frSel.dest = { x: tx, y: ty };
      SFX.play('ui'); Render.sel = { x: tx, y: ty }; renderPanel(); return;
    }
    if (G.reloc) {
      if (!G.reloc.cands.has(tIdx(tx, ty))) { SFX.play('deny'); return; }
      const P = planRelocation(tx, ty);
      if (!P) { SFX.play('deny'); toast('NO ROUTE', 'A road cannot reach that tile', '#ff4d6a'); return; }
      SFX.play('ui'); G.reloc.plan = P; Render.sel = { x: tx, y: ty }; renderPanel(); return;
    }
    const cc = cacheNear(p, tx, ty);
    if (!cc && !inRegion(tx, ty, G.region)) { closePanel(); return; }
    if (cc) { const kind = cc.kind, m = window.act('cache', cc.x, cc.y); if (m) { toast(kind === 'gold' ? 'GOLDEN SALVAGE' : kind === 'cursed' ? 'CURSED SALVAGE' : 'SALVAGE', m, kind === 'gold' ? '#ffd84a' : kind === 'cursed' ? '#ff4d6a' : '#ffe14d'); updateHud(); if (panel) renderPanel(); } return; }
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
    if (G.fr && frNearWorm(tx, ty) && G.map.tiles[tIdx(tx, ty)] === 0 && !G.towerAt[tIdx(tx, ty)]) { SFX.play('deny'); Render.flashWorm(); toast('TOO CLOSE', `No building within ${FRONTIER.wormBuild} tiles of a wormhole`, '#ff4d6a', true, 'tip'); }
    closePanel();
  }
  function canvasWheel(e) {
    e.preventDefault();
    const r = $('#cv').getBoundingClientRect();
    // v5.0.1: scale by how far the wheel moved, so trackpads (small deltas, pinch = ctrl+wheel) zoom smoothly and mouse notches still step
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY, k = Math.exp(-clamp(dy, -120, 120) * (e.ctrlKey ? 0.01 : 0.0012));
    Render.zoomAt((e.clientX / UIS) - (r.left / UIS), (e.clientY / UIS) - (r.top / UIS), k); camUser++;
    updateZoomBtn();
  }
  // right click: cancel whatever is in progress (aiming an ability, placing a beacon), otherwise close the open panel
  function mouseCancel() {
    if (!G) return;
    if (G.aimAbility) { G.aimAbility = null; Render.aim = null; updateHud(); SFX.play('ui'); return; }
    if (panel) { closePanel(); SFX.play('ui'); }
  }
  // 6.2: the Home/Map button was removed; callers still tell the camera UI it moved (kept as the one hook for that)
  function updateZoomBtn() { const b = $('#bZoom'); if (b) { const close = Render.homeZoom > 1.05; b.hidden = Render.home && !close; b.innerHTML = svgIcon('fit', 16) + (Render.home ? 'Map' : G && G.fr ? 'Home' : 'Fit · ' + (Render.zoom / Render.homeZoom).toFixed(1) + '×'); } } // Frontier: Home recentres on the core
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
    m.classList.remove('side'); m.innerHTML = html; m.hidden = false; modalOpen = kind || 'modal';
    for (const c of m.querySelectorAll(':scope > .card')) frameBox(c, 'ch', 'foot', 'cbody');
    document.body.classList.add('modal-open');
    hydrateIcons(m);
  }
  function closeModal() {
    if (modalOpen === 'studio' && stInCompose) { stInCompose = false; leaveCompose(); }
    $('#modal').hidden = true; $('#modal').innerHTML = ''; $('#modal').classList.remove('side'); modalOpen = null; modalFrom = null; confirmAbandon = false; confirmReset = false;
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
      <button class="btn" data-act="tutPick">Tutorial</button>
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
      keystones: activeCaps().map(id => TAL[id].name), evo: (G.stats.evo || []).slice(), endStrain: runEndStrain() };
  }
  // v5.8 the swarm's run on one line: each tier a gene reached (tall marks for higher tiers), each Strain Assault (filled = broken),
  // then the same as chips, and the strain that ended the run
  function swarmTimelineHTML(R) {
    const ev = R.evo || [], as = (R.assaults && R.assaults.list) || [];
    if (!ev.length && !as.length && !R.endStrain) return '';
    const w0 = R.startWave || 1, w1 = Math.max(R.wave, w0 + 1), pos = w => clamp((w - w0) / (w1 - w0) * 100, 0, 100).toFixed(1) + '%';
    const ticks = [w0, Math.round((w0 + w1) / 2), w1].filter((w, i, a) => a.indexOf(w) === i).map(w => `<em style="left:${pos(w)}">W${w}</em>`).join('');
    const marks = ev.map(([w, g, t]) => `<i class="t${t}" style="left:${pos(w)};--c:${GENES[g] ? GENES[g].col : '#888'}"></i>`).join('')
      + as.map(a => `<b class="${a.won ? 'won' : ''}" style="left:${pos(a.w)};--c:${strainCol(a.genes)}"></b>`).join('');
    let chips = ev.filter(e => GENES[e[1]] && (e[2] >= 2 || ev.length <= 8)).map(([w, g, t]) => ({ w, h: `<span class="sxc" style="--c:${GENES[g].col}"><canvas width="16" height="16" data-gico="${g}"></canvas><small>W${w}</small> ${GENES[g].name} ${roman(t)}</span>` }))
      .concat(as.map(a => ({ w: a.w + 0.5, h: `<span class="sxc as${a.won ? '' : ' lost'}" style="--c:${strainCol(a.genes)}"><i class="swatch" style="background:${strainCol(a.genes)}"></i><small>W${a.w}</small> ${esc(a.name)} ${a.won ? 'broken' : 'held'}</span>` })))
      .sort((a, b) => a.w - b.w);
    if (chips.length > 12) chips = chips.slice(-12);
    const E = R.endStrain;
    return `<div class="lbl">Swarm Timeline</div><div class="sxtl">${marks}${ticks}</div><div class="sxev">${chips.map(c => c.h).join('')}</div>
      ${E ? `<p class="note sxend"><i class="swatch" style="background:${E.col};display:inline-block;width:9px;height:9px;margin-right:6px"></i>Ended by <b style="color:${E.col}">${esc(E.name)}</b>${E.assault ? ' (Strain Assault)' : ''} · ${E.n} leaked on the last wave</p>` : ''}`;
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
      ${swarmTimelineHTML(R)}
      ${R.assaults && R.assaults.list.length ? `<p class="note hl">${tipify(`Strain Assaults: ${R.assaults.won} broken, ${R.assaults.lost} entrenched`)}${R.assaults.list.slice(-3).map(a => ` · W${a.w} ${esc(a.name)} ${a.won ? '✓' : '✗'}`).join('')}</p>` : ''}
      ${R.bounty ? `<p class="note hl" style="color:#ffd84a">Bounty claimed: ${esc(R.bounty)}</p>` : ''}
      ${(R.crates || R.pirates || R.odKills || R.relocs) ? `<p class="note hl">${[R.crates ? `Salvage crates ${R.crates}` : '', R.pirates ? `Pirates downed ${R.pirates}` : '', R.odKills ? `Nuke erased ${fmt(R.odKills)}` : '', R.relocs ? `Core moved ${R.relocs}×` : ''].filter(Boolean).join(' · ')}</p>` : ''}
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
      return `<div class="evrow ${locked ? 'dim' : ''}"><b style="color:${A.col}"><canvas width="18" height="18" data-gico="${g}"></canvas>${A.name}</b><div class="evbar"><i style="width:${Math.round(v * 100)}%;background:${A.col}"></i></div><em>${locked ? 'Wave ' + A.from : Math.round(v * 100) + '%' + (Math.abs(d) >= 0.05 ? (d > 0 ? ' ▲' : ' ▼') : '')}</em><span>${esc(A.desc)} · <u>${esc(A.counter)}</u></span></div>`; }).join('');
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
  const vetsReady = () => G ? G.towers.filter(t => t.pending > 0 || t.ascPend > 0 || t.grow > 0) : []; // 5.8: veteran picks and Ascend perks; 6.2: a grown support tower's free Specialization
  function showOnMap(t) { openTower(t); const p = Render.tileToScreen(t.cx, t.cy), L = Render.layout; Render.panBy(L.W / 2 - p.x, L.H / 2 - p.y); updateZoomBtn(); }
  function openVets() {
    const rd = vetsReady();
    if (!rd.length) { closeModal(); Render.sel = null; if (G && !G.over) G.paused = false; if (vetFlow.n) toast('VETERANS', `${vetFlow.n} pick${vetFlow.n === 1 ? '' : 's'} made. Every tower is up to date`, '#ffe14d', true, 'tip'); vetFlow.n = 0; return; }
    vetFlow.ix = ((vetFlow.ix % rd.length) + rd.length) % rd.length;
    const t = rd[vetFlow.ix], asc = !(t.pending > 0) && t.ascPend > 0, grow = !(t.pending > 0) && !asc && t.grow > 0, o = grow ? [] : asc ? ascOffer(t) || [] : vetOffer(t), left = rd.reduce((a, x) => a + (x.pending || 0) + (x.ascPend > 0 ? 1 : 0) + (x.grow > 0 ? 1 : 0), 0);
    closePanel(); G.paused = true;
    // 5.8: the tower is centred in the free (left) part of the board and selected, and the card docks right over a light backdrop
    { const p = Render.tileToScreen(t.cx, t.cy), L = Render.layout; Render.panBy(L.W * 0.3 - p.x, L.H / 2 - p.y); updateZoomBtn(); Render.sel = { x: t.x, y: t.y }; }
    modal(`<div class="card narrow vets"><div class="ch"><h2>Ready</h2><span class="note">Tower ${vetFlow.ix + 1} of ${rd.length} · ${left} pick${left === 1 ? '' : 's'} waiting</span><button class="x" data-act="vetDone" aria-label="Close">✕</button></div>
      <div class="vhead"><canvas class="ico" width="32" height="32" data-ico="${t.type}"></canvas><div><b>${esc(towerLabel(t))}</b><small>${towerLabel(t) !== TOWERS[t.type].name ? esc(TOWERS[t.type].name) + ' · ' : ''}LV ${towerLevel(t)} · ${grow ? 'Grew with its towers · free Specialization' : asc ? 'Ascended · choose a perk' : `${tipify('Veteran')} ${roman(t.rank)}${t.pending > 1 ? ` · ${t.pending} picks here` : ''} · choose a mutation`}</small></div></div>
      <div class="vet">${grow ? TOWERS[t.type].specs.map((sp, i) => `<button class="aff pickable" data-act="gpick" data-v="${i + 1}" style="--c:#59f0b4"><i>${esc(sp.name)} · Free</i>${tipify(sp.desc)}</button>`).join('') : asc ? o.map((id, i) => { const P = perkDef(t.type, id), n = perkStacks(t, id); return `<button class="aff pickable" data-act="apick" data-v="${i}" style="--c:#ff8a2a"><i>${esc(P.name)}${n ? ' ' + roman(n + 1) : ''}</i>${esc(perkText(P, n))}</button>`; }).join('')
        : o.map((a, i) => `<button class="aff pickable" data-act="vpick" data-v="${i}" style="--c:${RARITY[a.tier].col}"><i>${tipify(RARITY[a.tier].name)}</i>${tipify(affixText(a))}</button>`).join('')}</div>
      ${t.affixes.length ? `<div class="lbl">Already has</div><div class="affs mini">${t.affixes.map(affixHTML).join('')}</div>` : ''}
      <div class="foot"><button class="btn" data-act="vetMap">Show on map</button>${rd.length > 1 ? '<button class="btn" data-act="vetSkip">Next tower</button>' : ''}<button class="btn" data-act="vetDone">Later</button></div></div>`, 'vets');
    $('#modal').classList.add('side');
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
        <button class="hopt ext" data-act="extract"><b>Extract</b><span>End the run as a win and bank ${fmt(P)} XP. ${G.daily ? 'Your Daily Hunt result is locked in.' : 'Counts toward the next Chaos level.'}</span><span>${G.tut && !G.lesson ? 'Jump doors open in real runs.' : 'Or take a jump door: a new zone for 20 waves, and the purse grows.'}</span></button>
        ${C.doors.map((d, i) => { const S = SECTOR_BY[d.sector], T = DOOR_TIERS[d.tier]; return `<button class="hopt door" data-act="door" data-v="${i}" style="--c:${S.col};--t:${T.col}"${G.tut && !G.lesson ? ' disabled' : ''}><canvas class="zsw" width="72" height="120" data-zsw="${d.sector}"></canvas><b>${esc(S.name)} <i>${esc(T.name)} · purse ×${d.mult}</i></b><span class="dp">${esc(S.pitch)}</span><span>${sectorLine(S, d.tier)}</span><span class="dw">Next bounty: ${esc(d.wanted)}, Wave ${C.next}</span></button>`; }).join('')}
      </div></div>`, 'hunt');
    zoneSwatches(3, 5); // 6.3: each door shows the board you would land on
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
    Render.resetCam(); updateZoomBtn(); frModeUI(); buildAbilityBar(); updateHud(true);
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
    if (G.tut) return openTutDone(); // 5.8 Training: no records, Hall of Fame or recap
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
      ${masteryGainHTML(G.masteryGain)}
      ${pointsFree() > 0 ? `<p class="good">${pointsFree()} talent point${pointsFree() === 1 ? '' : 's'} to spend</p>` : ''}
      <div class="row logrow"><span class="note">Run log for analysis</span><button class="btn small" data-act="logCopy">Copy log</button><button class="btn small" data-act="logSave">Save log</button></div>
      <div class="foot"><button class="btn" data-act="hangar">Main Menu</button><button class="btn" data-act="web">Talents</button><button class="btn primary" data-act="again">Play Again</button></div></div>`, 'over');
    for (const cv of document.querySelectorAll('#modal canvas[data-ico]')) Render.towerIcon(cv.dataset.ico, cv);
  }
  // v5.8 Tower Mastery gained this run: rank-ups first ("Arc Coil Mastery 2 → 3"), then the biggest gains
  function masteryGainHTML(L) {
    if (!L || !L.length) return '';
    const up = L.filter(g => g.r1 > g.r0), rest = L.filter(g => g.r1 === g.r0).sort((a, b) => b.xp - a.xp).slice(0, Math.max(0, 4 - up.length));
    return `<p class="note mgain">${up.map(g => `<b>${esc(TOWERS[g.k].name)} Mastery ${g.r0} → ${g.r1}</b>`).concat(rest.map(g => `${esc(TOWERS[g.k].name)} +${g.xp}`)).join(' · ')}${up.length ? '' : ' Mastery XP'}</p>`;
  }
  const masteryPips = r => `<span class="mpip">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= r ? 'on' : ''}"></i>`).join('')}</span>`;
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
  // 6.2 Settings (Nic: "it's getting really crowded"): tabs on a left rail (General · Sound · Graphics · Interface) and one scrolling
  // pane, like a console game's options screen. Every row: a name, one line on what it does, and its control on the right (a switch,
  // a segmented choice, a slider or a button). All four pages are in the DOM (inactive ones hidden), so a tab switch is instant and
  // older tests that click a control by data-act still find it. The open tab is remembered for the session.
  let setTab = 'general';
  const SET_TABS = [['general', 'General', 'gear'], ['sound', 'Sound', 'speaker'], ['graphics', 'Graphics', 'screen'], ['interface', 'Interface', 'sliders']];
  function openSettings() {
    const S = PROF.settings, inRun = !!(G && !G.over);
    const prev = $('#modal .card.settings .setpane'), keep = prev && prev.dataset.tab === setTab ? prev.scrollTop : 0;
    const row = (name, desc, ctl, cls) => `<div class="setrow${cls ? ' ' + cls : ''}"><div class="setx"><b>${name}</b>${desc ? `<span>${desc}</span>` : ''}</div><div class="setc">${ctl}</div></div>`;
    const sec = t => `<h3 class="ssec">${t}</h3>`;
    const sw = (on, act, attrs) => `<button class="sw ${on ? 'on' : ''}" data-act="${act}" ${attrs || ''} aria-pressed="${on}"><span>${on ? 'On' : 'Off'}</span><i></i></button>`;
    const flip = (on, act, extra) => sw(on, act, `${extra || ''} data-v="${on ? 0 : 1}"`); // the actions that take the new value
    const seg = (act, opts, cur, extra) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button class="${cur === v ? 'on' : ''}" data-act="${act}" data-v="${v}" ${extra || ''} aria-pressed="${cur === v}">${l}</button>`).join('')}</div>`;
    const rng = (id, v, min, max, step, out, oid) => `<input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${v}"><output class="sval" id="${oid}">${out}</output>`;
    const pctV = v => Math.round(v * 100) + '%';
    const pages = {
      general: sec('Gameplay')
        + row('Boss slow-down', 'Drop to 1× speed when a boss arrives', flip(S.autoSlow !== false, 'autoslow'))
        + row('Briefings', 'Boss and bounty cards. Pause holds the game until you tap Fight', seg('briefs', [['pause', 'Pause'], ['brief', 'Brief'], ['off', 'Off']], S.briefings || 'pause'))
        + row('Haptics', 'A buzz when the core is hit', flip(S.haptics !== false, 'haptic'))
        + sec('Save')
        + row('Save location', cloudOk ? 'Synced to your Claude account' : 'Kept in this browser', `<span id="cloud" class="cloud ${cloudOk ? 'on' : ''}">${cloudOk ? 'Synced' : 'This device'}</span>`)
        + (inRun ? '' : row('Transfer save', 'Move your progress to another device with a code', '<button class="btn small" data-act="xcopy">Export</button><button class="btn small" data-act="xpaste">Import</button>'))
        + row('Run log', lastLogText() ? 'Your last run, for analysis' : 'No run log yet', lastLogText() ? '<button class="btn small" data-act="logCopy">Copy</button><button class="btn small" data-act="logSave">Save</button>' : '')
        + sec('About')
        + row("What's New", `Version ${VERSION}`, `<button class="btn small" data-act="news">Open</button>`)
        + row('Music', 'Drift: a generative score written live as you play, in ten genres', '')
        + (inRun ? '' : row('Reset progress', 'Erase everything on this device. There is no undo', `<button class="btn small danger" data-act="wipe">${confirmReset ? 'Tap again to erase' : 'Reset'}</button>`, 'danger')),
      sound: sec('Volume')
        + row('Sound effects', 'Weapons, impacts and alerts', rng('setSfx', S.sfx, 0, 1, 0.05, pctV(S.sfx), 'sfxV'))
        + row('Music', 'The score that follows the battle', rng('setMus', S.music, 0, 1, 0.05, pctV(S.music), 'musV'))
        + sec('Music')
        + row('Music Studio', 'Genres, mixer, your tracks and the composer', '<button class="btn small" data-act="studioS">Open</button>')
        + row('Music tempo', 'Average tempo of the default mix. Each genre in the Studio has its own', rng('setBpm', S.bpm || 72, 56, 100, 2, (S.bpm || 72) + ' BPM', 'bpmV'))
        + row('Mono audio', 'One earbud or one speaker', sw(!!S.mono, 'mono'))
        + sec('Troubleshooting')
        + row('Sound', `<em id="sndStat">${esc(soundStatus())}</em>`, '<button class="btn small" data-act="sndFix">Restart sound</button>'),
      graphics: sec('Effects')
        + row('Glow', 'Soft lighting on the field', flip(S.glow !== false, 'gfx', 'data-k="glow"'))
        + row('Screen shake', 'Big hits shake the view', sw(!!S.shake, 'shake'))
        + row('Zone effects', 'Weather and particles in each zone. The zone colours stay on', flip(zfxOn(), 'gfx', 'data-k="zfx"'))
        + sec('Display')
        + row('Pixel scaling', 'Sharp is crisper. Simple is lighter work for older devices', seg('gfx', [['1', 'Sharp'], ['0', 'Simple']], S.sharp !== false ? '1' : '0', 'data-k="sharp"'))
        + (fsOK() ? row('Full screen', 'Hide the browser bars', sw(fsOn(), 'fs')) : ''),
      interface: sec('Layout')
        + row('HUD', 'Detailed shows more numbers during a run', seg('hud', [['lean', 'Minimal'], ['full', 'Detailed']], S.hud === 'full' ? 'full' : 'lean'))
        + row('Interface size', 'Scale of buttons and text', seg('uis', [['auto', 'Auto'], ['0.85', 'Small'], ['1.2', 'Large']], String(S.uiScale || 'auto')))
        + sec('Information')
        + row('Notifications', 'Key keeps only what needs a reaction: Red Alert, wormholes, assaults, checkpoints, pirates', seg('notes', [['all', 'All'], ['key', 'Key'], ['off', 'Off']], S.notes || 'all'))
        + row('Damage numbers', 'Floating damage over enemies', sw(!!S.dmgNums, 'nums')),
    };
    modal(`<div class="card settings"><div class="ch"><h2>Settings</h2><button class="x" data-act="close2" aria-label="Close">✕</button></div>
      <div class="setwrap"><nav class="setrail" role="tablist">${SET_TABS.map(([k, l, ic]) => `<button class="settab ${setTab === k ? 'on' : ''}" data-act="setTab" data-v="${k}" role="tab" aria-selected="${setTab === k}"><i data-svg="${ic}"></i><span>${l}</span></button>`).join('')}<span class="setver">v${VERSION}</span></nav>
      <div class="setpane" data-tab="${setTab}">${SET_TABS.map(([k]) => `<div class="spg" data-pg="${k}" ${setTab === k ? '' : 'hidden'}>${pages[k]}</div>`).join('')}</div></div></div>`, 'settings');
    const pane = $('#modal .setpane'); if (pane) pane.scrollTop = keep;
    const vol = () => { SFX.setVolumes(S.sfx, S.music); $('#sfxV').textContent = pctV(S.sfx); $('#musV').textContent = pctV(S.music); };
    $('#setSfx').oninput = e => { S.sfx = +e.target.value; vol(); };
    $('#setMus').oninput = e => { S.music = +e.target.value; vol(); };
    $('#setSfx').onchange = $('#setMus').onchange = () => Save.save();
    const bp = $('#setBpm'); if (bp) { bp.oninput = () => { PROF.settings.bpm = +bp.value; $('#bpmV').textContent = bp.value + ' BPM'; SFX.music.setBaseBpm(+bp.value); }; bp.onchange = () => Save.save(); }
  }
  function setSettingsTab(k) { // in place: no re-render, so the rail never loses a tap
    if (!SET_TABS.some(t => t[0] === k)) return; setTab = k;
    for (const b of document.querySelectorAll('#modal .settab')) { const on = b.dataset.v === k; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); }
    for (const p of document.querySelectorAll('#modal .spg')) p.hidden = p.dataset.pg !== k;
    const pane = $('#modal .setpane'); if (pane) { pane.dataset.tab = k; pane.scrollTop = 0; }
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
    const o = { s: f.seed >>> 0, g: f.genre, f: f.flav, n: f.name }; if (f.snd) o.d = f.snd; if (f.comp) o.c = f.comp; if (f.v > 1) o.v = f.v; if (f.boss) o.b = f.boss; // 6.3: generator version, boss theme
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
      return { seed: o.s >>> 0, genre: o.g, flav: o.f, name: String(o.n || 'Shared Track').slice(0, 32), snd: o.d && typeof o.d === 'object' ? o.d : undefined, comp: o.c && typeof o.c === 'object' ? o.c : undefined,
        v: o.v | 0 || undefined, boss: o.b && M.BOSS_THEMES[o.b] ? o.b : undefined };
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
      const G0 = G5[f.genre] || G5.lofi, sub = f.boss && M.BOSS_THEMES[f.boss] ? `Boss theme · ${M.BOSS_THEMES[f.boss].name}` : `${G0.short || G0.name} · ${M.flavName(f.genre, f.flav)}${f.comp ? ' · composed' : ''}`;
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
        ${stBossHTML()}
      </div>
      <div class="stcol">
        <div class="lbl stl">My Tracks <em class="dim">${c.favs.length ? c.favs.length + ' kept' : ''}</em></div>
        <div class="strow">${c.favs.length ? `<button class="chip ${c.favOnly ? 'on' : ''}" data-act="stFavOnly">Only my tracks</button>` : ''}<button class="chip" data-act="stPaste">Paste a code</button></div>
        ${stPaste ? `<div class="strow"><input id="stCode" class="stcode" placeholder="Paste a TRACK code" autocomplete="off" spellcheck="false"><button class="btn small" data-act="stCodeGo">Add</button></div>` : ''}
        ${(c.favs.forEach(warmCode), '')}${c.favs.length ? `<div class="stfavs">${favs}</div>` : '<p class="note">Tap the heart while a piece plays to keep it here. Kept tracks remember your sound settings, and you can share them as codes.</p>'}
      </div></div>`;
  }
  // ---- 6.3 Boss themes: one fixed song per boss. In fights they replace the radio (switch: config.bossThemes); here you can
  // play the ones you have beaten (PROF.codex.bosses counts kills).
  function stBossHTML() {
    const M = SFX.music, c = studioCfg(), on = c.bossThemes !== false, met = M.BOSS_IDS.filter(id => PROF.codex.bosses[id]);
    return `<div class="lbl stl">Boss themes <em class="dim">${met.length} of ${M.BOSS_IDS.length} unlocked</em></div>
      <div class="strow"><button class="chip ${on ? 'on' : ''}" data-act="stBossT" aria-pressed="${on}">Play in boss fights: ${on ? 'On' : 'Off'}</button></div>
      <div class="stboss">${M.BOSS_IDS.map(id => { const T = M.BOSS_THEMES[id];
        return PROF.codex.bosses[id] ? `<button class="cpsty" style="--c:#ff4d6a" data-act="stBossP" data-v="${id}" aria-label="Play the ${esc(T.name)} theme"><b>${esc(T.name)}</b><small>${esc(T.title)}</small></button>`
          : `<button class="cpsty lockd" style="--c:#6a6584" disabled aria-label="Locked boss theme"><b>Locked</b><small>Beat this boss</small></button>`; }).join('')}</div>`;
  }
  // ---- Shape ----
  function stShapeHTML() {
    const M = SFX.music, c = studioCfg(), vis = c.custom ? c : Object.assign({}, M.DEF, { favs: c.favs }), p = M.piece || {}, G5 = M.GENRES, g = p.genre && G5[p.genre] ? p.genre : 'lofi';
    const slider = (id, lab, v, min, max, step, out, mid, dis) => `<label class="st2"><span>${lab}</span><output id="${id}V">${out}</output><span class="rng${mid ? ' mid' : ''}"><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${v}" ${dis ? 'disabled' : ''}></span></label>`;
    const bpm = p.comp || p.boss ? p.bpm : (vis.bpm[g] || G5[g].bpm[1]);
    return `<div class="stshape">
      <div class="stcol">
        <div class="lbl stl">Feel</div>
        ${slider('stEnergy', 'Energy', vis.energy, 0, 1, 0.01, energyWord(vis.energy))}
        ${slider('stFollow', 'Follow battle', vis.follow, 0, 1, 0.01, Math.round(vis.follow * 100) + '%')}
        ${slider('stTempo', `Tempo · <span style="color:${G5[g].col}">${esc(p.comp ? 'composed' : p.boss ? 'boss theme' : G5[g].short || G5[g].name)}</span>`, bpm, p.boss ? Math.min(bpm, G5[g].bpm[0]) : G5[g].bpm[0], p.boss ? Math.max(bpm, G5[g].bpm[2]) : G5[g].bpm[2], 1, bpm + ' BPM', 0, p.comp || p.boss)}
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
    stRadio = p && !p.comp && !p.boss ? M.spec : stRadio; M.editing = true; M.setHold(true);
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
  // ---- 6.2 the ? sheet (Nic: "a ? button that has all the details regarding the music overlay and some advanced notes"). It covers the
  // Studio card, opens on the tab you were on and has the same three tabs; each explains every control there, then Advanced: how the
  // controls interact, recipes for moods, and how seeds, likes and playlists work. Every line is checked against audio.js and this file.
  let stHelp = null; // null, or the help tab showing
  const ST_HELP = {
    listen: { rows: [
      ['Now playing', 'The bar at the top stays put on every tab: song name, genre and style, key, tempo, the section it is in (intro, groove, drop) and how far through it is.'],
      ['⏮ Back', 'The previous song. The Studio remembers the last 40 this session.'],
      ['⏸ Pause', 'Silences the music. Game sounds keep playing.'],
      ['⏭ Skip', 'A new song now, from the genres you have on.'],
      ['Repeat', 'This song plays again when it ends instead of moving on. Lasts until you close the game.'],
      ['♥ Keep', 'Adds the song to My Tracks with your current sound. Tap again to take it out.'],
      ['Share', 'Copies a track code for the song playing.'],
      ['Vibe', 'Sets the genre list in one tap. Calm: Ambient, Lo-fi, Trip Hop. Club: House, Techno, Trance, Drum & Bass. Retro: Synthwave, Chiptune. Everything: all ten.'],
      ['Genres', 'Tap one to add it to the rotation or take it out (one always stays on). A genre you add plays at once. ▶ plays one song of that genre now without changing the list.'],
      ['My Tracks', 'Every song you keep. ▶ plays it, the pencil opens a composed song in Compose, share copies its code, ✕ deletes it (tap twice). Tap a name to rename it.'],
      ['Only my tracks', 'The radio plays your kept songs in turn instead of new ones.'],
      ['Paste a code', 'Adds a friend’s TRACK code to My Tracks and plays it.'],
      ['Boss themes', 'Each of the 13 bosses has its own theme. Beat a boss to unlock its theme here. Tap a theme to play it.'],
      ['Play in boss fights', 'On: a boss theme plays while that boss is on the field. A short sting plays when you kill it. Then your music comes back. Off: the radio keeps playing.'],
    ], adv: [
      ['Seeds', 'Every song grows from a seed. The same seed, genre and style always give the same chords, melody and drums, on any device. A kept song or a code is that seed plus a name, so it plays back exactly.'],
      ['Variety', 'Each genre has 4 styles. Each new song also picks its own drums, instruments, tempo, key and arrangement. Its melody grows from a short hook that repeats. Songs kept before version 6.3 play exactly as before.'],
      ['Likes keep the sound', 'Keeping a song also stores your sound: Energy, Follow, the mixer, mutes, effects and that genre’s tempo. Playing it brings that sound back, so your Shape sliders move to match.'],
      ['Likes on the battlefield', 'The ♥ on the Music deck (tap the Music tile at the top of the left rail) keeps the song playing into the same My Tracks list.'],
      ['Build a playlist', 'Keep songs as they come up, rename and delete to taste, then turn on Only my tracks. My Tracks holds 80; past that the oldest drops off.'],
      ['Default mix', 'Until you change something, the Studio plays the default mix: the Calm genres, steered by the battle, at the tempo in Settings › Sound. Your first change switches to your own settings. Shape › Reset sound goes back.'],
      ['Boss fights', 'With Play in boss fights on, the theme of the first boss on the field plays. A new boss phase moves the theme to its Final section, 1 semitone higher. After the kill, your song continues from the section it was in. If it was near its end, a new song starts.'],
      ['Boss fights, switch off', 'During a boss, new songs avoid major keys. The default mix also switches to Trip Hop.'],
      ['Keep a boss theme', 'The ♥ works on a boss theme too. The theme then plays in My Tracks like any song. In Compose, boss themes do not stop your song.'],
    ] },
    shape: { rows: [
      ['Energy', 'How full the music is: Still, Chill, Groove, Peak. Low energy thins the music to its core; high energy brings in more parts and picks the harder styles of each genre.'],
      ['Follow battle', 'How much the fight moves Energy. At 100% a calm menu pulls it down and a boss wave pushes it up. At 0% the music stays where you set it.'],
      ['Tempo', 'BPM for the genre playing now. Each genre keeps its own. The slider is greyed out for composed songs and boss themes. They carry their own tempo.'],
      ['Song length', 'Short changes song about every minute. Standard is a radio edit (intro, build, drop, outro), about 3 minutes. Long is an extended mix, about 5. The song playing takes the new shape at once.'],
      ['Reset sound', 'Back to the default mix. Keeps My Tracks, your Compose song, the song length and the boss theme switch.'],
      ['Mixer', 'Pads, Keys, Arps, Bass, Drums and Lead, up to 125%. Drag a fader; double-tap it for 100%. Tap a name to mute that part. The thin bar inside a fader is its live level.'],
      ['Effects', 'Reverb, Echo, Tone, Tape & Vinyl and Pump. The middle is the genre’s own amount; left takes it down to off, right adds up to double. Tone is darker to the left, brighter to the right. Pump makes the music duck on each kick.'],
    ], adv: [
      ['Energy plus Follow', 'The music runs at Energy, plus Follow times how hard the battle is. The menu reads as calm, so with Follow high the hangar sounds thinner than the slider says, and a boss wave fuller.'],
      ['Composed songs', 'A composed song always plays every part you wrote. Energy and Follow shape the radio’s songs, not yours.'],
      ['Boss themes', 'A boss theme never plays below Groove. Energy and Follow push it higher. Each boss phase adds more.'],
      ['Mute to compare', 'A muted part comes back at its old level, so muting is quicker than dragging a fader down and back.'],
      ['Keep after shaping', 'A kept song saves this whole panel. Set the sound first, then press ♥.'],
      ['Settings tempo', 'Settings › Sound › Music tempo moves only the default mix. After your first change here, each genre uses its own Tempo slider.'],
    ], recipes: [
      ['Focus', 'Calm vibe, Energy at Chill, Follow 0%, Reverb and Tape & Vinyl right of middle, Pump off.'],
      ['Tension', 'Club vibe, Follow 100%, Pump up, Echo down. Boss waves hit hardest.'],
      ['Night drive', 'Synthwave only, Energy at Groove, Echo and Reverb right of middle.'],
      ['Console', 'Chiptune only, Reverb and Tape & Vinyl off for a dry 8-bit sound.'],
    ] },
    compose: { rows: [
      ['Start', 'Pick a style to start a song: you get its beat, bassline and chords, and no melody yet. Or remix the last radio song.'],
      ['Name', 'Tap the name to rename your song.'],
      ['Style', 'Genre and flavour. Changing it resets drums, bass, lead and tempo to that style’s own.'],
      ['Mood', 'The scale: Bright, Dreamy, Bluesy, Soulful, Moody, Dark, Exotic. If the chords don’t fit the new mood, they change to ones that do.'],
      ['Key', 'The home note. Everything moves with it.'],
      ['Tempo', 'In steps of 2 BPM, a little past either end of the style’s range.'],
      ['Chords', 'Progressions that fit the mood, written as numerals (I V vi IV). ×2 means two bars on each chord.'],
      ['Bass', 'Twenty bass lines. Style means the style’s own.'],
      ['Lead', 'The instrument that plays the melody. None silences it.'],
      ['Drums', 'One bar of 16 steps, looping, one row per drum. Every lit square plays; tap to switch it. The white column is where the song is. Reset brings back the style’s beat; Clear empties the grid.'],
      ['Melody', 'Eight rows; higher rows are higher notes. Follow chords: rows are steps above each chord’s root, so every note fits. Fixed notes: rows are notes of the key (named on the left) and stay put while the chords move. Faint squares are a rolled melody: tap the grid to make it yours. Roll writes a new one; Clear removes it.'],
      ['Play / Stop', 'Your song loops while you work. Walking into Compose stops the radio; any change starts your song; leaving brings the radio back.'],
      ['Save', 'Adds the song to My Tracks with your current sound.'],
      ['New song', 'Starts again from the style list. Tap twice: unsaved changes go.'],
    ], adv: [
      ['Live edits', 'Changes are heard at once while your song plays. Your draft is saved as you go: close the Studio and it is still here.'],
      ['Safe or bold', 'Follow chords can’t clash: notes on strong beats snap to the chord. Fixed notes is how a hook works: the same notes over moving chords, so some land as tension. Give it a slow loop with few chords.'],
      ['Groove', 'A kick on 1, 5, 9 and 13 is four on the floor. A kick on 1 with the snare on 9 is a half-time feel. Hats on every other step drive it; Shaker or Ride add motion without weight.'],
      ['Saved songs', 'A saved song keeps everything: style, mood, key, tempo, chords, parts, drums, melody and your sound. Its code carries all of it, so a friend hears exactly your song.'],
      ['Editing a kept song', 'The pencil in My Tracks opens a saved song as your draft. Save adds a new copy; the old one stays until you delete it.'],
    ], recipes: [
      ['Uplifting', 'Bright, chords I V vi IV, Piano or Bell lead.'],
      ['Melancholy', 'Moody, Lo-fi style, Upright bass, a sparse melody in Follow chords.'],
      ['Menace', 'Dark, Techno or Drum & Bass, Acid 303 or Reese bass.'],
      ['Floaty', 'Dreamy, a two-chord loop, Glass or Theremin lead, few drums.'],
    ] },
  };
  function stHelpHTML() {
    const k = ST_HELP[stHelp] ? stHelp : 'listen', H = ST_HELP[k];
    const dl = L => `<dl class="shdl">${L.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>`;
    return `<div class="sthelp" role="dialog" aria-label="How the Music Studio works"><div class="shh"><b>How it works</b>
      <div class="chips sttabs">${[['listen', 'Listen'], ['shape', 'Shape'], ['compose', 'Compose']].map(([v, l]) => `<button class="chip ${k === v ? 'on' : ''}" data-act="stHelpTab" data-v="${v}">${l}</button>`).join('')}</div>
      <button class="stb shx" data-act="stHelpX" aria-label="Back to the Studio">✕</button></div>
      <div class="shbody" data-tab="${k}"><div class="shcols"><section><h3 class="ssec">Controls</h3>${dl(H.rows)}</section>
      <section class="shadv"><h3 class="ssec">Advanced</h3>${dl(H.adv)}${H.recipes ? `<h3 class="ssec">Moods to try</h3>${dl(H.recipes)}` : ''}</section></div></div></div>`;
  }
  // ---- the card ----
  function openStudio(from) {
    SFX.init(); if (from) studioBack = from;
    if (G && !G.over) G.paused = true;
    const M = SFX.music, c = M.config, p = M.piece || {}, G5 = M.GENRES, tg = p.genre && G5[p.genre] ? p.genre : 'lofi';
    if (stTab === 'compose' && !c.composer) stTab = 'listen';
    const tabs = [['listen', 'Listen'], ['shape', 'Shape']].concat(c.composer ? [['compose', 'Compose']] : []);
    const prev = $('#modal .card.studio .cbody'), keep = prev ? prev.scrollTop : 0, wasTab = prev ? prev.dataset.tab : '';
    const hPrev = $('#modal .sthelp .shbody'), hKeep = hPrev && hPrev.dataset.tab === stHelp ? hPrev.scrollTop : 0;
    modal(`<div class="card studio" style="--gc:${G5[tg].col}"><div class="ch"><h2>Music Studio</h2><div class="chips sttabs">${tabs.map(([k, l]) => `<button class="chip ${stTab === k ? 'on' : ''}" data-act="stTab" data-v="${k}">${l}</button>`).join('')}</div><button class="stb sthq" data-act="stHelp" aria-label="How the Music Studio works">?</button><button class="x" data-act="stClose" aria-label="Close">✕</button>
      ${stNowHTML()}</div>
      ${stTab === 'shape' ? stShapeHTML() : stTab === 'compose' ? stComposeHTML() : stListenHTML()}</div>`, 'studio');
    if (stHelp) { const cd = $('#modal .card.studio'); if (cd) { cd.insertAdjacentHTML('beforeend', stHelpHTML()); const hb = cd.querySelector('.shbody'); if (hb) hb.scrollTop = hKeep; } }
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
      case 'stHelp': stHelp = stTab; SFX.play('ui'); openStudio(); return true; // 6.2 the ? sheet, on the tab you are on
      case 'stHelpTab': stHelp = b.dataset.v; SFX.play('ui'); openStudio(); return true;
      case 'stHelpX': stHelp = null; SFX.play('ui'); openStudio(); return true;
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
      case 'stBossP': { const id = b.dataset.v, T = M.BOSS_THEMES[id]; if (!T || !PROF.codex.bosses[id]) return true; stPlayNow({ boss: id }); toast('NOW PLAYING', `${T.title} · ${T.name}`, '#ff4d6a'); return true; }
      case 'stBossT': { c.bossThemes = c.bossThemes === false; studioSave(); openStudio(); return true; }
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
      case 'stReset': { const keepK = { favs: c.favs, calmBpm: c.calmBpm, draft: c.draft, composer: c.composer, length: c.length, bossThemes: c.bossThemes }; M.setConfig(keepK); PROF.settings.studio = M.config; studioSave(); stPlayNow(); openStudio(); return true; }
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
      case 'stClose': { stHelp = null; cancelAnimationFrame(studioRaf); if (stInCompose) { stInCompose = false; leaveCompose(); } M.editing = false; const back = studioBack; studioBack = null; stEdit = -1; stPaste = false; closeModal();
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
      ['Lift Off', `The core flies. Tap Lift Off (top right, or in the core panel), then a tile to land on: the preview shows the new roads, what the core will fire and the towers it will link. Every road swings to the landing spot. In the air the gun is offline and the shield is down. After landing it recharges for ${FRONTIER.cd} waves.`],
      ['Dock', `Land the core on an attack tower and the core fires that tower's weapon: ×${FRONTIER.dockDmg} Damage, +${FRONTIER.dockRange} Range, +${pct(FRONTIER.dockBat)} per Battery level. Lift off again and the tower is set back down, intact.`],
      ['Links', `The landed core links its ${FRONTIER.links} nearest attack towers within ${FRONTIER.linkR} tiles: +${pct(FRONTIER.linkDmg)} Damage and Rate each, and the core +${pct(FRONTIER.linkCore)} per link. Flying breaks them.`],
      ['Move', `Tap a tower, then Move, then a new tile. It is offline for ${FRONTIER.moveT} s and costs ${pct(FRONTIER.moveFee)} of what it cost. No towers within ${FRONTIER.wormBuild} tiles of a wormhole.`],
      ['Next Wave', 'Tap Next to call the wave early for bonus credits.'],
      ['Cash In', 'Tap Score to trade credits for score. The rate rises every wave.'],
      ['Zoom', 'Pinch to zoom, drag to pan, double-tap to zoom in or back out. Edge arrows point at what is off screen: bosses and enemies near the core, pirate treasure (yellow, with a chest) and the core itself (green). Tap one to look there; the green one brings the camera home.'],
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
      ['Ascend', `Max-level towers can Ascend: ×${ASC_DMG} Damage (Void Lens ×${ASC_DMG_T.lens}) and a perk you choose from 3.`],
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
      ['Checkpoint', 'Once the field is clear, the game holds before a wormhole opens. Full refunds and a free respec; a lift-off lands at once. Resume fast for a bonus.'],
      ['Power Nodes', 'Glowing cyan diamonds. A tower built on one is overcharged. Land the core on one for a bigger boost. Each sector expansion reveals a new one.'],
      ['Space Pirates', "Pirate ships fly over during waves and drop salvage crates. Tap a crate before its ring runs out for credits, a charge, Entropy, score or a token. Red crates are booby-trapped: double loot, but a stowaway elite breaks loose. Boss waves bring the Captain's Chest. Leave a crate too long and a Pirate Skiff may come to steal it; shoot it down to get the loot back plus a bounty."],
      ['Nuke', `Your one emergency button. From Wave ${OD_WAVE}, tap Nuke on the left rail to erase every enemy on the map except bosses. Once per run.`],
      ['Node Links', 'Two attack towers on Power Nodes within 9 tiles link up: +10% Damage each and a beam between them that burns anything crossing it.'],
    ] },
    { id: 'progress', name: 'Progression', rows: [
      ['XP', 'Score converts to XP. Each level grants 1 talent point.'],
      ['Talents', `Seven trees of permanent bonuses. Each row opens after ${TROW} points in its tree; ${TCAP} points reach its Capstones, play styles you pick one of. You hold 1 Capstone, 2 from Level 25, 3 from Level 60. Techniques (one point each) unlock an alternate fire mode for a tower: switch it per tower from the tower panel. Changes are free between runs and at checkpoints; mid-run they cost Recalibration tokens.`],
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
        ['Ascend', `Upgrade past max level: ×${ASC_DMG} Damage (Void Lens ×${ASC_DMG_T.lens}), a new affix and a perk you choose from 3 (4 at Mastery 4).`], ['Mastery', 'Each tower type ranks up from its share of your runs. Towers that are not your top damage dealer earn nearly as much. Ranks 1 to 5: badge, +5% stat, trim, a fourth perk choice, its own legendary.'], ['Elite', 'Enemy with 1 or more elite affixes.'], ['Boon', 'Run-long bonus chosen after a boss.'],
        ['Milestone', 'Score threshold. Grants an extra ability charge and a small bonus.'], ['Conditions', 'In a tower\'s panel: every live modifier on it (storms, events, Frenzy, outages) with numbers.'], ['Headline', 'The enemy a wave leans on. Amber chip in the top bar; tap it for what beats it.'], ['IDLE', 'Tag on a tower that hasn\'t fired for three waves. Move it to where the enemies are.'], ['Entropy', 'Gauge that fills as you fight. Full: draw an Anomaly.'],
        ['Anomaly', 'Run modifier with a bonus and a cost.'], ['Stabilize', 'Decline an Anomaly for +10% score and a token.'], ['Recalibration token', 'Pays for respecs during a run.'],
        ['Wormhole', `Origin of a lane. New ones can open on any side of the core, even behind it, and their paths may cross others. Forming wormholes show their future route and open 2 waves later. Nothing can be built within ${FRONTIER.wormBuild} tiles of one, and the core lands at least ${FRONTIER.wormGap} tiles away. How many open, and when, depends on Chaos: Normal opens them at Waves 15, 28, 42, 58 and 78.`],
        ['Checkpoint', `Pause before a wormhole's first wave, once the field is clear. Full sell refunds and a free respec; a lift-off lands at once. Resume within ${CP_WINDOW}s for bonus credits and score; the bonus drains over time.`],
        ['Power', `Every tower draws 1 power from your grid; capacity is ${GRID.base} plus 1 every ${GRID.perWaves} waves (shown next to your credits). Towers on Power Nodes draw none. When it's full, make towers better instead of adding more.`],
        ['Overcharge', `Spend spare power on one tower: +${OVERCHARGE.dmg * 100}% Damage and +${OVERCHARGE.rate * 100}% Attack Speed per point, up to ${OVERCHARGE.max}. Free to change at any time, so shift it to whatever the wave needs.`],
        ['Evolution', 'From Wave 8 enemies carry genes: up to 1 until Wave 22, 2 until Wave 45, then 3. Each gene trades HP or speed for an edge. Waves are bred from the enemies that got furthest, so traits your defence handles badly spread. The next-wave chips show what is spreading; tap one for its counter.'],
        ['Ground-only', 'Flame Projector and Gravity Well cannot hit fliers (including enemies that evolve Wings).'],
        ['Power Node', 'Charged tile. Towers on it draw no power and get +25% Damage and +15% Range (support and economy +25%). The core on a Node gets +50% Damage and +20% Rate. Roads never pave over one.'],
        ['Nuke', `Once per run, from Wave ${OD_WAVE}: tap Nuke on the left rail, then tap again to confirm. Every enemy on the map that isn't a boss is erased (with kill credits and score). Bosses survive, losing ${Math.round(OD_BOSS * 100)}% of their remaining HP.`],
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
        ['Lift Off', `The core flies to any open tile in the sector, or onto an attack tower (docking). Every road re-routes to the landing spot and enemies already walking turn toward it. Gun offline and shield down in the air; ${FRONTIER.cd} waves to recharge after landing (Uplink shortens it).`],
        ['Docking', `The landed core fires the attack tower under it: its element, affixes, spec, perks and Technique, at ×${FRONTIER.dockDmg} Damage and +${FRONTIER.dockRange} Range. Support towers can't be docked.`],
        ['Core link', `A green line from the landed core to one of its ${FRONTIER.links} nearest attack towers within ${FRONTIER.linkR} tiles: +${pct(FRONTIER.linkDmg)} Damage and Rate for the tower, +${pct(FRONTIER.linkCore)} Damage for the core.`],
        ['No-build zone', `The ground within ${FRONTIER.wormBuild} tiles of a wormhole: no towers, so the swarm is seen before it is shot.`], ['Cash In', 'Trade credits for score. Rate: 3 × (1 + 10% per wave), before multipliers.'],
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
      { id: 'tower', name: 'Towers', rows: TOWER_ORDER.map(k => { const D = TOWERS[k]; return [D.name, `${D.blurb} <em>${EL[D.el].name} · ${D.capT ? `Unlock: ${TREE_BY_ID[D.capT].name} capstone tier` : `Unlocks at Wave ${D.unlock}`}</em>`, EL[D.el].col]; }) },
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
  // 5.8: How to Play is the Field Manual (lessons); the Dictionary stays as its second tab
  function openHelp(tab) {
    if (G && !G.over) G.paused = true;
    if (tab) helpTab = tab;
    if (helpTab !== 'dict') { manTab = 'lessons'; return openManual(); }
    const T = GUIDE.find(g => g.id === helpTab) || GUIDE[0];
    const combos = T.combos ? `<div class="lbl gsub">Combos</div><div class="gcombo">${[
      ['Kinetic', 'Frozen', 'Shatter'], ['Thermal', 'Chilled', 'Thermal Shock'], ['Thermal', 'Shocked', 'Overload'],
      ['Arc', 'Burning', 'Overload'], ['Arc', 'Chilled', 'Superconduct'], ['Void', 'max Marks', 'Collapse'],
    ].map(([a, b, c]) => `<span>${a} <i>on</i> ${b}</span><b>${c}</b>`).join('')}</div>` : '';
    modal(`<div class="card help"><div class="ch"><h2>Field Manual</h2><span class="note">${lessonPct()}% complete</span><button class="x" data-act="close2" aria-label="Close">✕</button></div>
      <div class="chips gtabs"><button class="chip" data-act="mtab" data-v="lessons">Lessons</button><button class="chip on" data-act="htab" data-v="dict">Dictionary</button></div>
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
    const rows = TOWER_ORDER.map(k => { const D = TOWERS[k], ok = D.capT ? capTowersOwned().includes(k) || masteryXp(k) > 0 : towerUnlocked(k), xp = masteryXp(k), r = masteryRankOf(xp); // 6.4: tier towers count once learned
      return `<div class="arow ${ok ? '' : 'dim'}"><canvas class="ico" width="20" height="20" data-ico="${k}"></canvas><span>${esc(D.name)}</span><small style="color:${EL[D.el].col}">${EL[D.el].name}</small><em>${ok ? `${masteryPips(r)}<u>${r < 5 ? `${xp}/${MASTERY.xp[r + 1]}` : esc(LEGENDARIES.find(L => L.tower === k).name)}</u>` : D.capT ? esc(TREE_BY_ID[D.capT].name) + ' tier' : 'Wave ' + D.unlock}</em></div>`; }).join('');
    const ks = activeCaps().map(id => TAL[id].name);
    const hrs = Math.floor(PROF.playTime / 3600), mins = Math.floor(PROF.playTime / 60) % 60;
    modal(`<div class="card"><div class="ch"><h2>Archive</h2><button class="x" data-act="close2">✕</button></div>
      <div class="setup-grid"><div class="col"><div class="lbl">Arsenal · ${tipify('Mastery')}</div>${rows}<p class="note">${MASTERY.rewards.map((x, i) => `${i + 1}: ${esc(x)}`).join(' · ')}. Towers that are not your top damage dealer earn nearly as much.</p></div>
      <div class="col">${hallHTML()}<div class="lbl">Record</div>
        <div class="bigstats two"><span>Runs<b>${PROF.runs}</b></span><span>Best Wave<b>${PROF.bestWave || '—'}</b></span><span>Best Score<b>${PROF.bestScore ? fmt(PROF.bestScore) : '—'}</b></span><span>Kills<b>${fmt(PROF.kills)}</b></span><span>Time Played<b>${hrs}h ${mins}m</b></span><span>Level<b>${profLevel().level}</b></span></div>
        <div class="lbl">Capstones</div><p class="note">${ks.length ? ks.map(esc).join(' · ') : 'None yet'}</p>
        ${codexHTML()}</div></div>${collHTML()}</div>`, 'archive');
    for (const cv of document.querySelectorAll('#modal canvas[data-ico]')) Render.towerIcon(cv.dataset.ico, cv);
    for (const cv of document.querySelectorAll('#modal canvas[data-eico]')) Render.enemyIcon(cv.dataset.eico, cv);
    if ((PROF.codex.collNew || []).length) { PROF.codex.collNew = []; Save.save(); } // highlighted once, then they are no longer new
    $('#bArchive').classList.remove('hasnew');
  }
  // v5.8 Swarm Collection: species × gene, three pips per cell (seen carrying it alone, in a pair, in a triple), plus the named pairs
  const collPctTxt = () => Math.floor(collHave(PROF.codex) / collMax() * 100) + '%';
  function collHTML() {
    const C = PROF.codex || {}, X = C.coll || {}, N = C.collC || {}, nw = new Set(C.collNew || []), have = collHave(C), max = collMax();
    const head = `<span></span>` + GENE_IDS.map(g => `<span class="gh" style="color:${GENES[g].col}"><canvas width="28" height="28" data-gico="${g}"></canvas>${GENES[g].name}</span>`).join('');
    const rows = COLL_SPECIES.map(t => { const s = X[t] || '', met = (C.enemies || {})[t] || s.replace(/0/g, '');
      return `<span class="sp${met ? '' : ' dim'}"><canvas width="18" height="18" data-eico="${t}"></canvas>${met ? esc(SPECIES_NICK[t] || ENEMIES[t].name) : '???'}</span>` + GENE_IDS.map((g, i) => {
        if (!collOk(t, g)) return `<span class="ccell x"></span>`;
        const lv = Math.min(3, +s[i] || 0);
        return `<span class="ccell${lv >= 3 ? ' full' : ''}${nw.has(t + '.' + g) ? ' new' : ''}" style="--c:${GENES[g].col}" title="${esc(GENES[g].name)}">${[1, 2, 3].map(k => `<i class="${lv >= k ? 'on' : ''}"></i>`).join('')}</span>`; }).join(''); }).join('');
    const named = Object.keys(STRAIN_COMBO).map(k => N[k] ? `<span class="on${nw.has('c:' + k) ? ' new' : ''}">${esc(strainName(N[k], k.split('+')))}</span>` : `<span>???</span>`).join('');
    return `<div class="coll"><div class="lbl">Swarm Collection · ${Math.floor(have / max * 100)}% · ${have}/${max}${nw.size ? `<em>${nw.size} NEW</em>` : ''}</div>
      <div class="collbar"><i style="width:${(have / max * 100).toFixed(1)}%"></i></div>
      <p class="note">${tipify('Every species the swarm can evolve, and every gene it can carry. Pips: seen with it alone, in a pair, in a triple.')}</p>
      <div class="collgrid">${head}${rows}</div>
      <div class="lbl">Named strains · ${Object.keys(N).filter(k => STRAIN_COMBO[k]).length}/${Object.keys(STRAIN_COMBO).length}</div><div class="collc">${named}</div></div>`;
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
      <p class="note">Swarm Collection ${collPctTxt()}: see below</p>
      <p class="note">Anomalies ${an}/${ANOMALIES.length} · Legendaries ${lg}/${LEGENDARIES.length} · Maelstroms ${C.maelstroms || 0}${C.bestRank ? ` · Top veteran: ${esc(C.bestName)} (${roman(C.bestRank)})` : ''}</p>`;
  }
  function modalAction(act, b) {
    if (act.startsWith('st') || act.startsWith('cp')) { try { if (studioAction(act, b)) return; } catch (e) { SFX.report(e, 'studio ' + act); toast('STUDIO ERROR', String(e && e.message || e).slice(0, 90) + ' · tell Claude', '#ff4d6a', true); return; } }
    SFX.play('ui');
    switch (act) {
      case 'close': closeModal(); break;
      case 'brief': closeModal(); if (G) { G.paused = false; G.briefing = false; } break;
      case 'tutGo': case 'tutStart': startTut(); break; // 5.8 Training and the Field Manual
      case 'tutPick': if (modalOpen === 'pause') modalFrom = 'pause'; openTutPick(); break;
      case 'lesson': startTut(b.dataset.v); break;
      case 'lpage': openManual(b.dataset.v); break;
      case 'manual': openManual(); break;
      case 'mtab': manTab = b.dataset.v; helpTab = 'lessons'; openManual(); break;
      case 'tutSkip': tutState().seen = 1; Save.save(); openSetup(); break;
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
      case 'mode': setup.mode = b.dataset.v; if (setup.mode !== 'daily') rerollMap(); renderSetup(); break;
      case 'resume': closeModal(); G.paused = false; break;
      case 'help': if (modalOpen === 'pause') modalFrom = 'pause'; openHelp(); break;
      case 'htab': openHelp(b.dataset.v); break;
      case 'dcat': dictCat = b.dataset.v; openHelp(); break;
      case 'settings': if (modalOpen === 'pause') modalFrom = 'pause'; openSettings(); break;
      case 'setTab': setSettingsTab(b.dataset.v); break;
      case 'studio': openStudio('pause'); break;
      case 'studioS': openStudio('settings'); break;
      case 'exit': G.paused = false; snapshotNow(); Save.save(); G = null; closeModal(); show('hangar'); renderHangar(); SFX.music.setIntensity(0.15); break;
      case 'abandon': if (!confirmAbandon) { confirmAbandon = true; openPause(); return; } closeModal(); window.act('abandon'); break;
      case 'vpick': { const rd = vetsReady(), t = rd[vetFlow.ix]; if (!t || !window.act('vet', t.x, t.y, +b.dataset.v)) { SFX.play('deny'); break; } SFX.play('upgrade'); vetFlow.n++; if (!(t.pending > 0)) { const nr = vetsReady(), j = nr.indexOf(t); vetFlow.ix = j >= 0 ? j : vetFlow.ix; } openVets(); break; }
      case 'vetSkip': vetFlow.ix++; openVets(); break;
      case 'gpick': { const rd = vetsReady(), t = rd[vetFlow.ix]; if (!t || !window.act('up', t.x, t.y, +b.dataset.v)) { SFX.play('deny'); break; } SFX.play('upgrade'); vetFlow.n++; const nr = vetsReady(), j = nr.indexOf(t); vetFlow.ix = j >= 0 ? j : vetFlow.ix; openVets(); break; } // 6.2 grown support tower: the free Specialization
      case 'apick': { const rd = vetsReady(), t = rd[vetFlow.ix]; if (!t || !window.act('ascPick', t.x, t.y, +b.dataset.v)) { SFX.play('deny'); break; } SFX.play('upgrade'); vetFlow.n++; const nr = vetsReady(), j = nr.indexOf(t); vetFlow.ix = j >= 0 ? j : vetFlow.ix; openVets(); break; }
      case 'vetMap': { const t = vetsReady()[vetFlow.ix]; closeModal(); G.paused = false; vetFlow.n = 0; if (t) showOnMap(t); break; }
      case 'vetDone': closeModal(); Render.sel = null; if (G && !G.over) G.paused = false; vetFlow.n = 0; break;
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
      case 'again': closeModal(); G = null; show('hangar'); renderHangar(); if (PROF.runSnap) toast('YOUR RUN IS SAVED', 'Tap Resume to carry on where you left off', '#59f0b4', true, 'tip'); else openSetup(); break; // 6.0: after Training, a saved run comes first
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
          P.runSnap = null; PROF = P; tidyCaps(); { const mw = migrateWeb(); if (mw) UI.toast(...talentsToast(mw)); } Save.save(); closeModal(); renderHangar(); Tree.refresh(); // 6.0: an old save code gets the talents migration now, not on next launch
          SFX.setVolumes(PROF.settings.sfx, PROF.settings.music); SFX.setMono(!!PROF.settings.mono);
  SFX.setSoundtrack(PROF.settings.soundtrack || 'ec'); SFX.music.setConfig(PROF.settings.studio); PROF.settings.studio = SFX.music.config; SFX.music.setBaseBpm(PROF.settings.bpm || 72);
          toast('SAVE IMPORTED', `Level ${profLevel().level} · Best Wave ${PROF.bestWave || 0}`, '#59f0b4');
        } catch (e) { toast('INVALID CODE', 'Make sure the full code was pasted', '#ff4d6a', 1); }
        break;
      }
      case 'hud': PROF.settings.hud = b.dataset.v; Save.save(); openSettings(); break;
      case 'uis': PROF.settings.uiScale = b.dataset.v === 'auto' ? 'auto' : +b.dataset.v; Save.save(); UI.fitVV(); openSettings(); break;
      case 'gfx': PROF.settings[b.dataset.k] = b.dataset.v === '1'; Render.glow = PROF.settings.glow !== false; Render.sharp = PROF.settings.sharp !== false; Render.zfx = zfxOn(); Save.save(); openSettings(); break;
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
    $('#app').addEventListener('pointerdown', () => { teachTap = performance.now(); }, true); // 6.2: a busy hand delays teaching cards
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
    let trkBackT = 0, trkBackTimer = 0, deckT = 0, deckNoteT = 0; const TRK_DBL = 350;
    const deckFill = () => { const M = SFX.music, p = M.piece, d = $('#mdeck'); if (!d || !p) return; const col = (M.GENRES[p.genre] || {}).col || '#59f0b4';
      d.style.setProperty('--mc', col); d.querySelector('.mdname b').textContent = p.name;
      const sp = d.querySelector('.mdname span'); if (performance.now() > deckNoteT) { sp.textContent = `${p.genreName} · ${p.section}${M.paused ? ' · paused' : ''}`; sp.classList.remove('liked'); }
      const lk = $('#bTrkLike'), on = M.isSaved(); if (lk && lk.dataset.on !== String(on)) { lk.dataset.on = on; lk.innerHTML = svgIcon(on ? 'heart' : 'heartO'); lk.classList.toggle('on', on); lk.setAttribute('aria-pressed', on); lk.setAttribute('aria-label', on ? 'Remove this song from My Tracks' : 'Keep this song in My Tracks'); } };
    const deckShow = on => { const d = $('#mdeck'); d.hidden = !on; $('#bMusic').classList.toggle('on', on); clearTimeout(deckT); if (on) { deckFill(); deckT = setTimeout(() => deckShow(false), 5000); } };
    UI.deckFill = deckFill; UI._trackCode = trackCode; UI._readTrackCode = readTrackCode; // 6.3: for test/mus63.py
    $('#bMusic').onclick = () => { SFX.init(); SFX.play('ui'); deckShow($('#mdeck').hidden); };
    $('#mdName').onclick = () => { deckShow(false); openStudio(); };
    // 6.2 (Nic: "let people like songs to their playlist there while they're on the battle field"): Keep, as in the Studio
    $('#bTrkLike').onclick = () => {
      SFX.init(); const M = SFX.music; if (!M.piece) return; let line = '';
      if (M.isSaved()) { M.unsave(); line = 'Removed from My Tracks'; } else if (M.save()) line = '♥ Kept in My Tracks';
      studioSave(); SFX.play('ui'); deckShow(true);
      const d = $('#mdeck'), sp = d && d.querySelector('.mdname span'), lk = $('#bTrkLike');
      deckFill(); if (sp && line) { sp.textContent = line; sp.classList.add('liked'); deckNoteT = performance.now() + 1800; }
      if (lk) { lk.classList.remove('pop'); void lk.offsetWidth; lk.classList.add('pop'); }
    };
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
    $('#bLaunch').onclick = () => { SFX.init(); SFX.play('ui'); if (PROF.runSnap && PROF.runSnap.rec) { modal(`<div class="card narrow"><div class="ch"><h2>Daily Hunt</h2></div><p class="note">Restoring your run exactly where you left it…</p></div>`, 'wait'); setTimeout(() => launch(PROF.runSnap), 80); } else if (PROF.runSnap) launch(PROF.runSnap); else if (tutOffer()) openTutOffer(); else openSetup(); };
    $('#watchbar').addEventListener('click', e => { if (e.target.closest('[data-act=watchEnd]')) { SFX.play('ui'); endWatch(); } });
    $('#hHunt').addEventListener('click', e => { const b = e.target.closest('[data-hact]'); if (!b) return; SFX.init(); SFX.play('ui'); if (b.dataset.hact === 'daily') { if (PROF.runSnap) { toast('RUN IN PROGRESS', 'Finish or end your current run first', '#ffb03a', true, 'tip'); return; } openSetup(); setup.mode = 'daily'; renderSetup(); } });
    $('#bLaunch2').onclick = () => { SFX.init(); SFX.play('ui'); openSetup(); };
    $('#bWebH').onclick = () => { SFX.init(); SFX.play('ui'); Tree.open(); };
    $('#bReady').onclick = () => { SFX.play('ui'); if (!G || G.over) return; vetFlow.ix = 0; openVets(); };
    $('#bLift').onclick = () => { SFX.play('ui'); if (!G || G.over || !G.fr) return; startLift(); }; // Frontier
    $('#bTutH').onclick = () => { SFX.init(); SFX.play('ui'); openTutPick(); }; // 5.8: always on the main menu
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
      if (pan) { e.preventDefault(); Render.panBy(pan[0], pan[1]); updateZoomBtn(); camUser++; return; }
      const L = Render.layout;
      if (k === '=' || k === '+') { Render.zoomAt(L.W / 2, L.H / 2, 1.2); updateZoomBtn(); return; }
      if (k === '-' || k === '_') { Render.zoomAt(L.W / 2, L.H / 2, 1 / 1.2); updateZoomBtn(); return; }
      if (k === 'f') { if (Render.home) Render.overview(); else Render.resetCam(); updateZoomBtn(); return; } // desktop: F toggles the whole map and home
      if (k === 'n') { $('#bCall').click(); return; }
      if (k === 't') { SFX.play('ui'); Tree.open(); return; }
      if (k === 'u' && panel && panel.kind === 'tower') { const b = $('#panel [data-act=up]'); if (b && !b.disabled) b.click(); else SFX.play('deny'); return; }
      const ab = { z: 0, x: 1, c: 2, v: 3, b: 4 }[k];
      if (ab !== undefined) { const b = document.querySelector(`[data-abil="${ABIL_ORDER[ab]}"]`); if (b && !b.hidden && !b.disabled) b.click(); return; }
    });
    $('#cv').addEventListener('contextmenu', e => e.preventDefault());
    $('#cv').addEventListener('pointerleave', () => { Render.hover = null; Render.hoverE = null; $('#etip').hidden = true; });
    // hooks
    Hooks.sfx = (n, a, b) => { SFX.play(n, a, b); if (n === 'leak') Haptics.leak(); else if (n === 'bigleak') Haptics.big(); };
    // where on screen a sound happens: -1 left … 1 right, and whether it is in view
    SFX.setLocator((x, y) => { if (screen !== 'game' || !G) return null; const p = Render.tileToScreen(x, y), L = Render.layout; return { px: p.x / L.W * 2 - 1, py: p.y / L.H * 2 - 1, on: p.x > -20 && p.y > -20 && p.x < L.W + 20 && p.y < L.H + 20 }; }); // 6.2: py for the camera-distance mix
    Hooks.fx = (t, d) => Render.fx(t, d);
    Hooks.bossIntro = (e, B) => bossIntro(e, B);
    Hooks.evoIntro = () => { if (G && G.tut) return; if (!PROF.seenEvo && screen === 'game') evoWait = true; }; // 6.2: shown by tick when the teaching gate allows
    Hooks.assaultWarn = () => { if (!PROF.seenAssault && screen === 'game') setTimeout(() => { if (!modalOpen && G && !G.over && G.assault) { teachMark(); openAssault(true); } }, 700); }; // (an assault can't wait: it is this wave)
    Hooks.frLanded = d => { if (!G || G.replaying) return; const n = (G.frLinks || []).length; // Frontier
      toast(d ? 'DOCKED' : 'LANDED', `${d ? `The core fires the ${TOWERS[d.type].name}: ×${num1(frDockX())} Damage, +${FRONTIER.dockRange} Range` : 'Plain cannon'} · ${n} link${n === 1 ? '' : 's'} · next lift-off Wave ${G.frReady}`, d ? EL[d.s.el].col : '#59f0b4');
      if (panel && (panel.kind === 'core' || panel.kind === 'tower')) renderPanel(); updateHud(true); };
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
    Hooks.newEnemy = k => { if (!(G && G.tut)) setTimeout(() => enemyCard(k), 400); }; // 5.8: Training's coach covers its enemies
    let collToldW = -1;
    // v5.8 Swarm Collection: recorded only in real runs (never replays or watch mode); only a first named strain gets a notice
    Hooks.strainSeen = (type, genes, el) => {
      if (!G || ghostRun()) return;
      const got = collAdd(PROF.codex, type, genes); if (!got.length) return;
      const N = PROF.codex.collNew || (PROF.codex.collNew = []);
      for (const k of got) if (!N.includes(k)) N.push(k);
      if (N.length > 150) N.splice(0, N.length - 150);
      if (got.some(k => k.startsWith('c:')) && collToldW !== G.wave) collToldW = G.wave, toast('NEW STRAIN', `${strainName(type, genes, el)} · Collection ${collPctTxt()}`, GENES[genes[0]].col);
    };
    Hooks.abilReady = k => { const b = document.querySelector(`[data-abil="${k}"]`); if (b) { b.classList.remove('ping'); void b.offsetWidth; b.classList.add('ping'); } };
    Hooks.scanned = e => { const nm = e.boss ? e.bossName : ENEMIES[e.type] ? ENEMIES[e.type].name : e.type, gs = (e.genes || []).filter(g => GENES[g]);
      const beat = gs.length ? GENES[gs[0]].counter : ENEMIES[e.type] && ENEMIES[e.type].beat;
      toast('BIGGEST THREAT', `${nm}${gs.length ? ' · ' + gs.map(g => GENES[g].name).join(', ') : ''} · ${fmt(e.hp)} HP${beat ? ' · Beat it: ' + beat : ''}`, '#ffb03a', true, 'tip'); };
  }
  let eqT = 0; const eqBuf = new Uint8Array(128);
  // 6.2: the buttons and banners over the battlefield, in stage px, so the edge arrows (Render) never hide under one
  let koT = 0, koCls = '', beamKT = 0, beamK = 1;
  const KEEP_OUT = '#bLift, #bReady, #ticker, #asbar, #docbar, #mdeck, #panel, #dps, #cpBanner, #watchbar, #log > *, #toasts > *, #tip, #coach, #tutlist';
  // koT: wall-clock time of the next read (4 Hz; frame dt is capped, so a slow frame rate would stretch a dt timer).
  // The rects are re-read soon after a log line, toast or banner comes or goes (a MutationObserver flags it; no per-frame work)
  let koObs = null;
  function koWatch() {
    if (koObs || typeof MutationObserver === 'undefined') return;
    koObs = new MutationObserver(() => { koT = Math.min(koT, performance.now() + 230); }); // just after a new line's 0.2 s slide-in
    for (const q of ['#log', '#toasts']) { const el = $(q); if (el) koObs.observe(el, { childList: true }); }
    const st = $('#stage'); if (st) koObs.observe(st, { attributes: true, attributeFilter: ['hidden'], subtree: true });
  }
  function keepOutRects() {
    const cv = $('#cv'); if (!cv) return []; const o = cv.getBoundingClientRect(), out = [];
    for (const el of document.querySelectorAll(KEEP_OUT)) { if (el.hidden) continue; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
      const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      out.push({ l: (r.left - o.left) / UIS, t: (r.top - o.top) / UIS, r: (r.right - o.left) / UIS, b: (r.bottom - o.top) / UIS }); }
    return out;
  }
  // 6.3 boss themes: tell the music which boss is on the field (the first one: its theme keeps playing while any boss with that id
  // lives, so Gloop's splits and Most Wanted twins don't restart it) and its phase. A kill (hp at 0, run not over) gets the victory sting.
  let musBoss = { id: null, e: null };
  function bossMusic() {
    const M = SFX.music; let b = null;
    if (screen === 'game' && G && !G.over) {
      if (musBoss.id) b = musBoss.e && !musBoss.e.dead && musBoss.e.boss === musBoss.id ? musBoss.e : G.enemies.find(e => e.boss === musBoss.id && !e.dead);
      if (!b) b = G.bossAlive && !G.bossAlive.dead ? G.bossAlive : G.enemies.find(e => e.boss && !e.dead) || null; // the sim clears bossAlive when the first of two bosses dies
    }
    const id = b ? b.boss : null;
    if (id !== musBoss.id) { const win = !!(musBoss.e && musBoss.e.hp <= 0 && G && !G.over); musBoss = { id, e: b }; M.setBoss(id, b ? b.phase || 0 : 0, win); }
    else if (b) { musBoss.e = b; M.setBoss(id, b.phase || 0); }
  }
  function tick(dt) {
    if (screen === 'game') { eqT -= dt; if (eqT <= 0) { eqT = 0.08; const tile = $('#bMusic'); if (tile) { const M = SFX.music, p = M.piece, bars = tile.querySelectorAll('.meq i');
      if (p) tile.style.setProperty('--mc', (M.GENRES[p.genre] || {}).col || '#59f0b4'); const quiet = !p || M.paused || M.held || SFX.state !== 'running'; tile.classList.toggle('quiet', quiet);
      M.spectrum(eqBuf); const band = [[1, 3], [3, 7], [7, 14], [14, 28], [28, 56]]; bars.forEach((b, i) => { let v = 0; if (!quiet) for (let k = band[i][0]; k < band[i][1]; k++) v = Math.max(v, eqBuf[k]); b.style.height = Math.max(3, Math.round(v / 255 * 16)) + 'px'; });
      if (!$('#mdeck').hidden) UI.deckFill && UI.deckFill(); } } }
    if (screen === 'game') { koWatch(); const bc = document.body.className, now = performance.now(); if (now >= koT || bc !== koCls) { koT = now + 250; koCls = bc; Render.keepOut = keepOutRects(); } } // 6.2: edge arrows slide clear of these (at once when a panel or banner moves the layout)
    if (panel && panel.kind === 'tower' && G && !G.towers.includes(panel.t)) closePanel(); // swallowed by the worm, or otherwise gone
    if (panel && panel.kind === 'enemy' && (panel.e.dead || !G || !G.enemies.includes(panel.e))) closePanel();
    if (enemyCards.length && screen === 'game' && G && !G.over && !modalOpen && !Tree.isOpen && !G.draft && teachOK()) enemyCard(enemyCards.shift());
    if (evoWait && screen === 'game' && G && !G.over && !G.tut && !modalOpen && !Tree.isOpen && !G.draft && teachOK()) { evoWait = false; if (!PROF.seenEvo) { teachMark(); openEvo(true); } }
    if (screen === 'game' && G && !G.over && (G.sector || null) !== zoneSeen && !modalOpen && !Tree.isOpen && !G.draft && !G.huntChoice) { zoneSeen = G.sector || null; if (zoneSeen && !G.tut) zoneBanner(zoneSeen); } // 6.3
    onboardingTick(); Coach.tick();
    const bossOn = !!(screen === 'game' && G && G.bossAlive && !G.bossAlive.dead); if (bossOn !== document.body.classList.contains('bossbar')) document.body.classList.toggle('bossbar', bossOn);
    bossMusic();
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
    // v5.8: the hum's ramp is the beam's seconds on target out of the sim's 4 s cap (it used to divide seconds by the damage multiplier),
    // Event Horizon adds a sub octave and Prism Split a wider chorus; a Lens that locks onto a new target chirps.
    // Flame Projectors share one continuous roar; one that starts firing gives a short ignition chirp
    let nb = 0, rk = 0, neh = 0, npr = 0, nf = 0, nfi = 0, nfp = 0, pkS = 0; beamKT -= dt; const pkNow = beamKT <= 0; if (pkNow) beamKT = 0.25;
    if (live) for (const t of G.towers) {
      if (t.type === 'lens') {
        const tg = t.disabled <= 0 && t.beamTargets && t.beamTargets.length ? t.beamTargets[0] : null;
        if (tg) { nb++; if (pkNow) pkS += SFX.proxK(t.cx, t.cy); rk = Math.max(rk, Math.min(1, (t.ramp || 0) / 4)); if (t.spec === 1) neh++; else if (t.spec === 2) npr++; if (tg !== t._lock) SFX.play('lock', t); }
        t._lock = tg;
      } else if (t.type === 'flame') {
        const on = t.disabled <= 0 && t.aimT !== undefined && G.time - t.aimT < 0.3 && G.time >= t.aimT;
        if (on) { nf++; if (t.spec === 1) nfi++; else if (t.spec === 2) nfp++; if (!t._flOn) SFX.play('ignite', t); }
        t._flOn = on;
      }
    }
    if (pkNow) beamK = nb ? pkS / nb : 1; // 6.2: the hum follows the beams' average distance from the screen centre (4 times a second)
    SFX.beams(nb, rk, nb ? neh / nb : 0, nb ? npr / nb : 0, beamK);
    SFX.flames(nf, nf ? nfi / nf : 0, nf ? nfp / nf : 0);
    SFX.danger(live && G.core.hp < G.core.max * 0.35 ? 1 - G.core.hp / (G.core.max * 0.35) : 0, dt);
  }
  function refreshAll() { if (screen === 'hangar') renderHangar(); Tree.refresh(); }
  return {
    wire, tick, show, renderHangar, toast, flushToasts, closePanel, refreshAll, cloud, renderPanel, zoomChanged: () => updateZoomBtn(), openNews, openEvo, slowmo: 0, watchFeed, openSetupDaily: () => { openSetup(); setup.mode = 'daily'; renderSetup(); },
    zoneBanner, // 6.3 test hook
    get screen() { return screen; }, get modalOpen() { return modalOpen; }, get coachHold() { return Coach.hold; }, coach: Coach,
    // test hooks (test/uiaudit.py opens every screen through these)
    _dbg: { keepOutRects, openSetup, openHelp, openSettings, openArchive, openHall, openPause, openReport, openAssault, openEvo, openThreat, updateHud, openHunt, watchRun, endWatch, huntCode, readHuntCode, renderSetup, setup: () => setup, openNews, openGameOver, openStudio, openNova, openTransfer, openTower, openCore, openBuild, openEnemy, enemyCard, introCard, wantedPoster, closeModal, modal },
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
    talentAdd(id); SFX.play(TAL[id].cap || TAL[id].unlockT ? 'levelup' : 'upgrade');
    if (TAL[id].cap) UI.toast('CAPSTONE', `${TAL[id].name} · ${TREE_BY_ID[TAL[id].tree].name}`, TREE_BY_ID[TAL[id].tree].col);
    if (TAL[id].unlockT && TS() === PROF) UI.toast('NEW TOWER UNLOCKED', `${TAL[id].name} · ${G && !G.over && !(G.capT || []).includes(TAL[id].unlockT) ? 'Build it from your next run' : 'Build it in your next run'}`, TREE_BY_ID[TAL[id].tree].col); // 6.4 capstone tier
    Save.save(); refresh();
  }
  function remove(id) {
    const why = talentCanRemove(id);
    if (why) { SFX.play('deny'); UI.toast('CAN\'T REMOVE', why === 'tokens' ? `Refunding mid-run costs ${refundCost(id)} Recalibration token${refundCost(id) > 1 ? 's' : ''} (you have ${G ? G.tokens : 0})` : why === 'cap' ? `Your Capstone needs ${TCAP} points in this tree` : why === 'row' ? 'A talent further down needs these points' : 'Nothing to remove', '#ff4d6a'); return; }
    talentRemove(id); SFX.play('sell'); Save.save(); refresh();
  }
  function blockMsg(id, why) {
    const T = TAL[id], tr = TREE_BY_ID[T.tree];
    if (why === 'points') return 'No points left. You earn one each level';
    if (why === 'max') return 'Already at its last rank';
    if (why === 'have') return 'Already yours';
    if (why === 'locked') return 'Your Daily Hunt build is locked for this run';
    if (why === 'slots') { const lv = talLevel(), n = TAL_EDIT ? 0 : CAP_NEXT(lv); return `You can hold ${slotsNow()} Capstone${slotsNow() > 1 ? 's' : ''}${n ? `; another slot opens at Level ${n}` : ''}. Remove one first`; }
    if (why === 'row') return `Needs ${rowNeed(T.row)} points in ${tr.name} (you have ${T.row >= 5 ? treePts(tr.id, 5) : treePts(tr.id)})`;
    if (why === 'daily') return 'Daily Hunts use the base towers. Learn it on your own build';
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
    const F = T.tech && fireModes(T.tech).find(f => f.need === T.id);
    const desc = F ? `${TOWERS[T.tech].name} technique: ${F.short}` : talentLines(T, Math.max(1, r)).join(' · ');
    return `<div class="${cls}" style="--c:${tr.col}"><button class="tbody" data-tact="sel" data-v="${T.id}"><b>${esc(T.name)}${rem ? ' <em>Remnant</em>' : ''}</b>${T.cap ? '' : `<small>${r}/${T.max}</small>`}${rankPips(T, r)}<span class="td">${esc(desc)}</span></button>${canAdd ? `<button class="tadd" data-tact="add" data-v="${T.id}" aria-label="Add a rank">+</button>` : ''}</div>`;
  }
  // 6.4 capstone tier: the top of the tree, one wide tile with the tower it unlocks
  function tierHTML(tr) {
    const T = tr.top; if (!T) return '';
    const D = TOWERS[T.unlockT], r = talRank(T.id), why = talentBlock(T.id), ok = treePts(tr.id, 5) >= TTOP;
    const cls = ['ttile', 'tier', r ? 'have' : '', why === 'row' || why === 'daily' ? 'locked' : '', sel === T.id ? 'sel' : ''].join(' ');
    return `<div class="trow toprow ${ok ? '' : 'locked'}"><div class="trl"><b>▲</b><small>${TTOP} pts</small></div><div class="trt"><div class="${cls}" style="--c:${tr.col}">
      <button class="tbody" data-tact="sel" data-v="${T.id}"><canvas class="ico" width="24" height="24" data-ico="${T.unlockT}"></canvas><em>Capstone tier · new tower</em><b>${esc(D.name)}${r ? ' <i>Unlocked</i>' : ''}</b><span class="td">${esc(D.blurb)}</span></button>${!why ? `<button class="tadd" data-tact="add" data-v="${T.id}" aria-label="Unlock">+</button>` : ''}</div></div></div>`;
  }
  function treeHTML(tr) {
    const pts = treePts(tr.id), rowsHTML = tr.rows.map((row, r) => {
      const need = rowNeed(r), ok = pts >= need || treePts(tr.id, r) >= need;
      return `<div class="trow ${ok ? '' : 'locked'}"><div class="trl"><b>${r + 1}</b>${r ? `<small>${need} pts</small>` : ''}</div><div class="trt">${row.map(T => tile(T, tr)).join('')}</div></div>`;
    }).join('');
    const capOk = pts >= TCAP;
    return `<div class="thead" style="--c:${tr.col}"><b>${esc(tr.name)}</b><span>${esc(tr.tag)}</span><em>${pts} point${pts === 1 ? '' : 's'} in this tree</em></div>${rowsHTML}
      <div class="trow caprow ${capOk ? '' : 'locked'}"><div class="trl"><b>★</b><small>${TCAP} pts</small></div><div class="trt">${tr.caps.map(T => tile(T, tr)).join('')}</div></div>
      ${tierHTML(tr)}
      <p class="note tfoot">The capstone tier (${TTOP} points, no slot) unlocks a new tower. Capstones change how you play. Pick one per tree; ${TS() !== PROF ? `this build holds ${slotsNow()}` : `you can hold ${capSlots(profLevel().level)} at Level ${profLevel().level}${CAP_NEXT(profLevel().level) ? ` (another at Level ${CAP_NEXT(profLevel().level)})` : ''}`}.</p>`;
  }
  function sumHTML() {
    const M = computeMods(null, null), lines = [];
    const agg = {};
    for (const id in TS().tal || {}) { const T = TAL[id]; if (!T || T.cap) continue; for (const k in T.fx) agg[k] = (agg[k] || 0) + T.fx[k] * TS().tal[id]; }
    for (const k in agg) if (STAT_TXT[k]) lines.push(STAT_TXT[k](typeof agg[k] === 'number' && agg[k] !== 1 ? +agg[k].toFixed(2) : agg[k]));
    const caps = activeCaps();
    return `<div class="thead"><b>Your build</b><span>Everything your talents give you, in one place</span><em>${pointsSpent()} spent · ${pointsFree()} free</em></div>
      <div class="lbl">Capstones</div>${caps.length ? caps.map(id => { const T = TAL[id], tr = TREE_BY_ID[T.tree]; return `<div class="tsumcap" style="--c:${tr.col}"><b>${esc(T.name)}</b><small>${esc(tr.name)}${(TS().remnants || []).includes(id) ? ' · Remnant' : ''}</small><span>${talentLines(T).map(esc).join(' · ')}</span></div>`; }).join('') : '<p class="note">None yet. Spend 20 points in one tree to reach its Capstones.</p>'}
      ${(() => { const nt = TALENTS.filter(tr => tr.top && talRank(tr.top.id)); return nt.length ? `<div class="lbl">New towers</div><p class="note">${nt.map(tr => `<b style="color:${tr.col}">${esc(tr.top.name)}</b>`).join(' · ')}</p>` : ''; })()}
      <div class="lbl">Bonuses</div><p class="note">Every point spent: +${TAL_PT_DMG}% Damage to all towers (now +${+(pointsSpent() * TAL_PT_DMG).toFixed(1)}%).</p>${lines.length ? `<ul class="tsum">${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : '<p class="note">No talents yet.</p>'}
      <div class="lbl">Per tree</div><div class="tbars">${TALENTS.map(tr => `<div style="--c:${tr.col}"><span>${esc(tr.name)}</span><i style="width:${Math.min(100, treePts(tr.id) / treeMax(tr.id) * 100)}%"></i><b>${treePts(tr.id)}</b></div>`).join('')}</div>`;
  }
  function infoHTML() {
    if (!sel || !TAL[sel]) return `<div class="tinfo-empty"><b>${pointsFree()}</b><span>point${pointsFree() === 1 ? '' : 's'} to spend</span><p class="note">Tap a talent to read it. Tap + (or double-tap) to add a rank.</p><p class="note">Each row opens after ${TROW} points in that tree. Capstones open at ${TCAP}. Techniques unlock a tower's alternate fire mode. Every point also adds +${TAL_PT_DMG}% Damage to all towers.</p></div>`;
    const T0 = TAL[sel], T = T0.unlockT ? Object.assign({}, T0, { cap: 1 }) : T0, tr = TREE_BY_ID[T.tree], r = T0.cap ? (activeCaps().includes(T.id) ? 1 : 0) : talRank(T.id), why = talentBlock(T.id), rw = talentCanRemove(T.id); // 6.4: a tier node reads like a Capstone
    const now = r ? talentLines(T, r) : null, next = !T.cap && r < T.max ? talentLines(T, r + 1) : null;
    const rem = (TS().remnants || []).includes(T.id);
    return `<div class="tinfo-t" style="--c:${tr.col}"><em>${esc(tr.name)}${T.unlockT ? ' · Capstone tier' : T.cap ? ' · Capstone' : ` · Row ${T.row + 1}`}</em><b>${esc(T.name)}</b>${T.cap ? `<small>${r ? (rem ? 'Remnant: always on' : 'Yours') : 'Not taken'}</small>` : `<small>Rank ${r} of ${T.max}</small>`}</div>
      ${T.cap ? `<ul class="tl">${talentLines(T).map(l => `<li>${tipify(l)}</li>`).join('')}</ul>` : `${now ? `<div class="lbl">Now</div><ul class="tl">${now.map(l => `<li>${tipify(l)}</li>`).join('')}</ul>` : ''}${next ? `<div class="lbl">${r ? 'Next rank' : 'Rank 1'}</div><ul class="tl dim">${next.map(l => `<li>${tipify(l)}</li>`).join('')}</ul>` : ''}`}
      ${why && why !== 'max' && why !== 'have' ? `<p class="note bad">${esc(blockMsg(T.id, why))}</p>` : ''}
      <div class="tbtns">${!rem && (r > 0) ? `<button class="btn" data-tact="rem" data-v="${T.id}" ${rw && rw !== 'tokens' ? 'disabled' : ''}>Remove${refundFree() ? '' : `<small>${refundCost(T.id)} token${refundCost(T.id) > 1 ? 's' : ''}</small>`}</button>` : ''}
      ${!why ? `<button class="btn primary" data-tact="add" data-v="${T.id}">${T.unlockT ? 'Unlock tower' : T.cap ? 'Take Capstone' : r ? 'Add rank' : 'Learn'}<small>1 point</small></button>` : ''}</div>`;
  }
  function buildsHTML() {
    return `<div class="tbuilds"><div class="lbl">Builds <em>save a layout, load it later${refundFree() ? '' : ' (2 tokens mid-run)'}</em></div>${PROF.builds.map((b, i) => `<div class="tb"><b>${b && b.tal ? esc(b.name) : `Slot ${i + 1}`}</b><small>${b && b.tal ? `${b.lvl} pts · ${(b.caps || []).map(capName).map(esc).join(', ') || 'no Capstone'}` : 'empty'}</small><button class="btn small" data-tact="bsave" data-v="${i}">Save</button><button class="btn small" data-tact="bload" data-v="${i}" ${b && b.tal ? '' : 'disabled'}>Load</button></div>`).join('')}</div>`;
  }
  function refresh() {
    if (!open_) return;
    const lv = talLevel(), free = pointsFree(), held = capsHeld().length, slots = slotsNow();
    el('tree').querySelector('h2').textContent = mode === 'hunt' ? 'Hunt Build' : huntRun() ? 'Hunt Build · locked' : 'Talents';
    el('tPts').textContent = free;
    el('tCaps').innerHTML = `<b>${held}/${slots}</b> Capstones`;
    const tk = el('tTok'); tk.hidden = !(G && !G.over); if (G) tk.innerHTML = `<b>${G.tokens}</b> tokens`;
    const rs = el('tReset'); rs.hidden = !refundFree(); rs.textContent = confirmReset ? 'Tap again' : 'Reset';
    el('ttabs').innerHTML = TALENTS.map(tr => { const p = treePts(tr.id), cap = activeCaps().find(c => TAL[c].tree === tr.id); return `<button class="ttab ${cur === tr.id ? 'on' : ''}" style="--c:${tr.col}" data-tact="tab" data-v="${tr.id}"><b>${esc(tr.name)}</b><small>${p ? p + ' pts' : '—'}${cap ? ' · ★' : ''}${tr.top && talRank(tr.top.id) ? ' · ▲' : ''}</small></button>`; }).join('') + `<button class="ttab sum ${cur === 'sum' ? 'on' : ''}" data-tact="sum"><b>Your Build</b><small>${pointsSpent()} pts</small></button>`;
    el('tgrid').innerHTML = (drawer === 'builds' ? buildsHTML() : '') + (cur === 'sum' ? sumHTML() : treeHTML(TREE_BY_ID[cur] || TALENTS[0]));
    el('tinfo').innerHTML = infoHTML();
    for (const cv of el('tgrid').querySelectorAll('canvas[data-ico]')) Render.towerIcon(cv.dataset.ico, cv); // 6.4: the tier tile's tower
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
    [[1300, 1], [1650, 0], [2150, 1], [2550, 0]].forEach(([ms, f]) => timers.push(setTimeout(() => { img.src = NIGEL_PX[f]; if (f) UI.splashBlinks = (UI.splashBlinks || 0) + 1; }, ms))); // two slow blinks (counted for test/splashshot.py)
    timers.push(setTimeout(end, 3500)); };
  let started = false; const start = () => { if (!started) { started = true; go(); } };
  try { document.fonts.ready.then(start); } catch (e) {} setTimeout(start, 600);
  return 4100;
};
// v5.8: what the one-time talent refund says (migrateWeb returns 'web' for a pre-5.0 passive web, 'rework' for the 5.8 rework)
function talentsToast(kind) {
  return kind === 'web' ? ['TALENTS ARRIVE', 'The passive web is now seven Talent trees. Every point is refunded: open Talents to spend them', '#ffb03a']
    : ['TALENTS REWORKED', 'Every point is refunded. New: Techniques (alternate fire modes) and play-style Capstones. Open Talents to spend them', '#ffb03a'];
}
(function boot() {
  const loaded = Save.loadLocal();
  if (loaded) PROF = loaded;
  const webReset = migrateWeb();
  if (webReset) { Save.save(); setTimeout(() => UI.toast(...talentsToast(webReset)), 900); }
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
  else if (PROF.seenVer !== VERSION && PROF.seenVer !== WHATS_NEW.ver) setTimeout(() => { if (UI.screen === 'hangar' && !UI.modalOpen && WHATS_NEW.items.length) UI.openNews(); }, 900 + spT); // 6.0.1: a patch with no new What's New doesn't show the last one again
  SFX.setVolumes(PROF.settings.sfx, PROF.settings.music); SFX.setMono(!!PROF.settings.mono);
  SFX.setSoundtrack(PROF.settings.soundtrack || 'ec'); SFX.music.setConfig(studioMig(PROF.settings.studio)); PROF.settings.studio = SFX.music.config; SFX.music.setBaseBpm(PROF.settings.bpm || 72);
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
      const halted = G.over || G.paused || G.draft || G.huntChoice || (G.checkpoint && !G.enemies.length) || Tree.isOpen || UI.modalOpen || UI.coachHold;
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
