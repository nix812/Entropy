// ===================== ENTROPY — RENDERER (24px tiles, cached sprites, camera) =====================
const PAL = {
  bg: '#07080f', amber: '#ffb03a', bad: '#ff4d6a', good: '#59f0b4', warn: '#ffe14d', ink: '#e9e4d4', core: '#59f0b4',
};
const ENEMY_COL = {
  drone: '#ff5470', swarmer: '#ff9ad5', tank: '#c9405a', flyer: '#ff86b0', splitter: '#ff6f3c', phantom: '#d6d2ff',
  medic: '#ff7c9c', shielder: '#8ab6ff', voidling: '#b86cff', boss: '#ff3355', pirate: '#d8281a',
  reflector: '#cfe6ff', carrier: '#e0607a', sapper: '#ffa860', leech: '#ffd24a',
};

const Render = (() => {
  // the Marksman sight line is for direct-fire towers only; area towers (Cryo, Gravity Well, Arc Coil) and lobbed shots (Missile, Mortar) don't point
const TW_K = 1.12, EN_K = 1.15; // v4.8 sprite scale-up (towers still sit inside their tile)
const SIGHTED = { bullet: 1, rail: 1, beam: 1, cone: 1 };
const RES = 2;
  const R_ = { glow: true, sharp: true }; // v5.3 graphics switches (Settings · Glow, Pixel scaling)
  let cv, ctx, buf, b, lightCv, lctx, mapLayer, mapKey = '', mapDirty = true, bufW = 0, mid, mctx, glowLayer, conduits = [], vignette = null, vigKey = '';
  let W = 0, H = 0, dpr = 1, scale = 1, ox = 0, oy = 0;
  const cam = { z: 1, x: 0, y: 0 };
  // the framed sector (buffer px). It eases outward when the run's sector grows.
  const reg = { x: 0, y: 0, w: 0, h: 0 };
  let regG = null, regKey = '', regAnim = null, frontier = null, onCam = null;
  let parts = [], rings = [], lines = [], texts = [], flashes = [], frame = 0, shake = 0, shakeT = 0, selEnemy = null, hoverEnemy = null, hintTiles = null, spotTiles = null;
  let selTile = null, selTower = null, preview = null, aimPos = null, hoverTile = null;
  let wormFlashAt = 0; // Frontier: when the no-build ring around the wormholes was last flashed
  let nuke = null, nukeSpr = null; // 6.2 the Nuke's detonation (one at a time) and its pre-rendered puffs
  let frSel = null, frArrows = []; // Frontier: the lift-off / move picker (from the UI) and the edge arrows drawn this frame
  let fullHud = false, showNums = true, doShake = true;
  const comboLast = {};
  // v5.8 tower character (render-only): a render clock, small screen kicks for heavy hits, hop stars and pull streaks.
  // LITE skips decorative extras on a crowded field or at high speed
  let rt = 0, kickT = -9, stars = [], drags = [], LITE = false;
  function kick(px, gap) { if (!doShake || rt - kickT < (gap || 0.25)) return; kickT = rt; shakeAt(px * 2, 0.12); }
  // flame particles age white → yellow → orange → smoke (Inferno redder, Plasma Torch blue-white)
  const FLAME_RAMP = { 1: ['#ffffff', '#fff3b0', '#ffe14d', '#ff9a3c', '#ff6a2a', '#5e5658'], 2: ['#fff0c0', '#ffd24a', '#ff8a2a', '#ff4a1a', '#c0281a', '#5a4444'],
    3: ['#ffffff', '#e6fbff', '#9fe8ff', '#6ae2ff', '#5a8aff', '#50586a'] };
  const PRISM = ['#b86cff', '#e08cff', '#8a7cff'];
  const MUZ = { pulse: 12.5, rail: 13.5, flame: 12.5, emp: 8.5, missile: 5 }, RECOIL = { pulse: 1.5, rail: 2.5, emp: 2, flame: 0.6, missile: 1 };
  // Snare net: a hex mesh, drawn once per size and colour
  const meshCache = {};
  function hexMesh(rr, col, cell) {
    const key = rr + col + cell; if (meshCache[key]) return meshCache[key];
    const S = Math.ceil(rr * 2 + 2), cv = document.createElement('canvas'); cv.width = cv.height = S * RES;
    const g = cv.getContext('2d'); g.scale(RES, RES); g.translate(S / 2, S / 2);
    g.save(); g.beginPath(); g.arc(0, 0, rr, 0, 6.283); g.clip(); g.strokeStyle = col; g.lineWidth = 0.6; g.beginPath();
    const w = cell * 1.732, h = cell * 1.5;
    for (let row = -Math.ceil(rr / h) - 1; row <= Math.ceil(rr / h) + 1; row++) for (let q = -Math.ceil(rr / w) - 1; q <= Math.ceil(rr / w) + 1; q++) {
      const x = q * w + (row & 1 ? w / 2 : 0), y = row * h;
      for (let k = 0; k < 6; k++) { const a0 = k / 6 * 6.283 + 0.5236, a1 = (k + 1) / 6 * 6.283 + 0.5236; g.moveTo(x + Math.cos(a0) * cell, y + Math.sin(a0) * cell); g.lineTo(x + Math.cos(a1) * cell, y + Math.sin(a1) * cell); }
    }
    g.stroke(); g.restore(); meshCache[key] = cv; return cv;
  }

  // ---------- colour helpers ----------
  const shCache = new Map();
  function sh(hex, k) {
    const key = hex + k; let v = shCache.get(key); if (v) return v;
    const n = parseInt(hex.slice(1), 16); let r = n >> 16 & 255, g = n >> 8 & 255, bb = n & 255;
    const t = k > 0 ? 255 : 0, a = Math.abs(k);
    r = Math.round(r + (t - r) * a); g = Math.round(g + (t - g) * a); bb = Math.round(bb + (t - bb) * a);
    v = '#' + ((1 << 24) | (r << 16) | (g << 8) | bb).toString(16).slice(1); shCache.set(key, v); return v;
  }
  const rgbCache = new Map();
  function hexA(hex, a) {
    let c = rgbCache.get(hex);
    if (!c) { const n = parseInt(hex.slice(1), 16); c = `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},`; rgbCache.set(hex, c); }
    return c + (Math.round(Math.max(0, Math.min(1, a)) * 50) / 50) + ')';
  }

  // ---------- pixel painters (work on any 2D context) ----------
  function R(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); }
  function P(g, x, y, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), 1, 1); }
  function D(g, cx, cy, r, c) {
    g.fillStyle = c;
    for (let dy = -r; dy <= r; dy++) { const hw = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy))); g.fillRect(Math.round(cx - hw), Math.round(cy + dy), hw * 2 + 1, 1); }
  }
  function O(g, cx, cy, r, th, c) {
    g.fillStyle = c; const r2 = r - th;
    for (let dy = -r; dy <= r; dy++) {
      const hw = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
      if (Math.abs(dy) <= r2) {
        const ih = Math.round(Math.sqrt(Math.max(0, r2 * r2 - dy * dy)));
        g.fillRect(Math.round(cx - hw), Math.round(cy + dy), hw - ih, 1); g.fillRect(Math.round(cx + ih + 1), Math.round(cy + dy), hw - ih, 1);
      } else g.fillRect(Math.round(cx - hw), Math.round(cy + dy), hw * 2 + 1, 1);
    }
  }
  function diamond(g, cx, cy, r, c) { g.fillStyle = c; for (let dy = -r; dy <= r; dy++) { const hw = r - Math.abs(dy); g.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1); } }

  // ---------- sprite cache ----------
  const sprites = new Map();
  function spr(key, w, h, paint) {
    let s = sprites.get(key);
    if (!s) { s = document.createElement('canvas'); s.width = w; s.height = h; const g = s.getContext('2d'); paint(g, w, h); sprites.set(key, s); }
    return s;
  }
  function tinted(key, src, col) {
    return spr(key, src.width, src.height, g => { g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, src.width, src.height); });
  }
  // 1px dark outline around a sprite's silhouette (adds a 1px margin) for crisp separation from the ground
  function outlined(key, src, col) {
    return spr(key, src.width + 2, src.height + 2, g => {
      g.drawImage(src, 1, 1);
      const W2 = src.width + 2, H2 = src.height + 2, d = g.getImageData(0, 0, W2, H2), a = d.data, out = [];
      for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
        if (a[(y * W2 + x) * 4 + 3] > 40) continue;
        const n = (xx, yy) => xx >= 0 && yy >= 0 && xx < W2 && yy < H2 && a[(yy * W2 + xx) * 4 + 3] > 40;
        if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) out.push(x, y);
      }
      g.fillStyle = col || '#05060c';
      for (let i = 0; i < out.length; i += 2) g.fillRect(out[i], out[i + 1], 1, 1);
    });
  }
  // draw a sprite centred on (cx, cy) world units; hi-res sprites carry .u (units per pixel)
  function blit(s, cx, cy, k) {
    const u = (s.u || 1) * (k || 1), w = s.width * u, h = s.height * u;
    b.drawImage(s, Math.round((cx - w / 2) * RES) / RES, Math.round((cy - h / 2) * RES) / RES, w, h);
  }
  const tintW = new WeakMap();
  function tintOf(src, col) {
    let m = tintW.get(src); if (!m) { m = new Map(); tintW.set(src, m); }
    let c = m.get(col);
    if (!c) { c = document.createElement('canvas'); c.width = src.width; c.height = src.height; c.u = src.u; const g = c.getContext('2d'); g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height); m.set(col, c); }
    return c;
  }
  // v5.8 Cloak gene: the sprite's silhouette in a 2×2 checker of one colour (cached per sprite like tintOf)
  const dithW = new WeakMap();
  function ditherOf(src, col) {
    let c = dithW.get(src);
    if (!c) {
      c = document.createElement('canvas'); c.width = src.width; c.height = src.height; c.u = src.u; const g = c.getContext('2d');
      g.fillStyle = col; for (let y = 0; y < c.height; y += 2) for (let x = ((y >> 1) & 1) * 2; x < c.width; x += 4) g.fillRect(x, y, 2, 2);
      g.globalCompositeOperation = 'destination-in'; g.drawImage(src, 0, 0); dithW.set(src, c);
    }
    return c;
  }
  // v5.8 the visible swarm: one readable mark per gene, drawn in screen space (crisp at any zoom) around a unit whose half
  // extents on screen are hw × hh. u is the art pixel (2-4 screen px). Used on the field and for menu icons (e.icon: still).
  const MARK_INK = '#090b16';
  function geneMark(c, g, x, y, hw, hh, u, e) {
    const blk = (bx, by, w, h, col) => { c.fillStyle = MARK_INK; c.fillRect(Math.round(bx) - 1, Math.round(by) - 1, w + 2, h + 2); c.fillStyle = col; c.fillRect(Math.round(bx), Math.round(by), w, h); };
    const col = GENES[g].col;
    if (g === 'shell') { // a hexagon bubble; solid while the shield holds, broken while it recharges
      const R = Math.max(hw, hh) + 2 * u, up = e.icon || e.shield > 0;
      c.beginPath(); for (let i = 0; i < 6; i++) { const a = i * 1.0472 + 0.5236, px = x + Math.cos(a) * R, py = y + Math.sin(a) * R * 0.92; i ? c.lineTo(px, py) : c.moveTo(px, py); } c.closePath();
      c.lineWidth = u + 2; c.strokeStyle = 'rgba(9,11,22,0.75)'; if (!up) c.setLineDash([u * 2, u * 2]); c.stroke();
      c.lineWidth = u; c.strokeStyle = up ? col : 'rgba(127,212,255,0.55)'; c.stroke(); if (!up) c.setLineDash([]);
    } else if (g === 'plating') { // steel plates on both flanks and the brow
      const pw = Math.round(u * 1.5); blk(x - hw - u - pw, y - u * 2, pw, u * 4, '#eef1fa'); blk(x + hw + u, y - u * 2, pw, u * 4, '#eef1fa'); blk(x - u * 2, y - hh - u * 2, u * 4, pw, '#eef1fa');
      c.fillStyle = '#8f97b3'; c.fillRect(Math.round(x - hw - u - pw), Math.round(y + u), pw, u); c.fillRect(Math.round(x + hw + u), Math.round(y + u), pw, u);
    } else if (g === 'wings') { // pixel wings at the shoulders, beating
      const f = e.icon ? 0 : ((frame >> 2) & 1) * u, wy = y - hh * 0.5;
      for (const sd of [-1, 1]) { const bx = sd < 0 ? x - hw - u * 2 : x + hw; blk(bx, wy, u * 2, u, col); blk(bx + sd * u * 1.5, wy - u - f, u * 2, u, col); blk(bx + sd * u * 3, wy - u * 2 - f * 2, u * 2, u, '#e8f6ff'); }
    } else if (g === 'haste') { // speed streaks trailing behind
      const a = e._ha || 0, cx = Math.cos(a), cy = Math.sin(a), bx = x - cx * (hw + u), by = y - cy * (hh * 0.6 + u), fl = e.icon ? 1 : (frame >> 1) % 3;
      c.beginPath();
      for (let i = -1; i <= 1; i++) { const L = (i ? 3 : 5) * u + (i === fl - 1 ? u : 0), ox = -cy * i * u * 1.6, oy = cx * i * u * 1.6; c.moveTo(bx + ox, by + oy); c.lineTo(bx + ox - cx * L, by + oy - cy * L); }
      c.lineWidth = u + 2; c.strokeStyle = MARK_INK; c.stroke(); c.lineWidth = u; c.strokeStyle = col; c.stroke();
    } else if (g === 'bulk') { // a heavy bracket under its feet
      const w = Math.max(u * 4, Math.round(hw * 1.6)); blk(x - w / 2, y + hh + u * 0.5, w, u, col); blk(x - w / 2, y + hh - u * 0.5, u, u, col); blk(x + w / 2 - u, y + hh - u * 0.5, u, u, col);
    } else if (g === 'brood') { // three eggs clinging on
      const s = Math.round(u * 1.5); for (const [dx, dy] of [[-u, -u], [u, -u * 2.8], [u * 1.2, u * 0.4]]) { blk(x + hw + dx, y + hh + dy, s, s, col); c.fillStyle = '#ffe3f2'; c.fillRect(Math.round(x + hw + dx), Math.round(y + hh + dy), Math.max(1, s >> 1), Math.max(1, s >> 1)); }
    } else if (g === 'regen') { // a green cross that pulses (grey while Burning: it can't heal)
      const burn = e.st && e.st.burn, cc = burn ? '#7c8790' : e.icon || frame % 30 < 15 ? col : '#c8ffe9', qx = Math.round(x + hw * 0.75), qy = Math.round(y - hh - u);
      c.fillStyle = MARK_INK; c.fillRect(qx - Math.round(u / 2) - 1, qy - Math.round(u * 1.5) - 1, u + 2, u * 3 + 2); c.fillRect(qx - Math.round(u * 1.5) - 1, qy - Math.round(u / 2) - 1, u * 3 + 2, u + 2);
      c.fillStyle = cc; c.fillRect(qx - Math.round(u / 2), qy - Math.round(u * 1.5), u, u * 3); c.fillRect(qx - Math.round(u * 1.5), qy - Math.round(u / 2), u * 3, u);
    } else if (g === 'ward') { // a small ring in the colour of the element it resists
      const wc = EL[e.wardEl] ? EL[e.wardEl].col : col, bx = x - hw - u * 0.5, by = y + hh - u * 0.5, R = u * 1.6;
      c.beginPath(); c.arc(bx, by, R, 0, 6.283); c.fillStyle = MARK_INK; c.fill(); c.lineWidth = u + 2; c.strokeStyle = MARK_INK; c.stroke(); c.lineWidth = u; c.strokeStyle = wc; c.stroke();
    }
  }
  // which of a unit's genes get marks: the ones most common in the swarm right now (re-read a few times a second), at most two,
  // only one when the field is crowded
  let gRankT = -999, gRankStamp = 0; const gRank = {};
  function geneRanks() {
    const dense = G && G.enemies.length > 40 ? 1 : 0, bump = () => { gRankStamp = (((gRankStamp >> 1) + 1) << 1) | dense; };
    if (dense !== (gRankStamp & 1)) bump();
    if (frame - gRankT < 20 && frame >= gRankT) return;
    gRankT = frame; const sh = G ? geneShares() : {}; let ch = false;
    GENE_IDS.forEach((g, i) => { const v = Math.round((sh[g] || 0) * 50) + (GENE_IDS.length - i) * 0.01; if (gRank[g] !== v) { gRank[g] = v; ch = true; } });
    if (ch) bump();
  }
  function geneMarks(e) {
    if (e._gmS === gRankStamp) return e._gm;
    const n = gRankStamp & 1 ? 1 : 2, gs = e.genes.filter(g => GENES[g]).sort((a, b) => gRank[b] - gRank[a]);
    e._gmS = gRankStamp; e._gm = gs.length > n ? gs.slice(0, n) : gs; return e._gm;
  }
  const STEEL = { o: '#090b16', d: '#141830', m: '#232948', l: '#343d6a', h: '#4c568c' };

  // ---------- tower sprites ----------
  function baseSprite(el) {
    return spr('base:' + el, 24, 24, g => {
      const c = EL[el].col;
      R(g, 2, 3, 21, 21, 'rgba(0,0,0,0.45)');
      R(g, 1, 1, 22, 22, STEEL.o);
      R(g, 2, 2, 20, 20, STEEL.m);
      R(g, 2, 2, 20, 1, STEEL.h); R(g, 2, 3, 1, 19, STEEL.l);
      R(g, 2, 21, 20, 1, STEEL.d); R(g, 21, 3, 1, 18, STEEL.d);
      R(g, 5, 5, 14, 14, STEEL.d); R(g, 5, 5, 14, 1, STEEL.o); R(g, 5, 5, 1, 14, STEEL.o);
      for (const [x, y] of [[3, 3], [19, 3], [3, 19], [19, 19]]) { R(g, x, y, 2, 2, '#59628f'); P(g, x, y, '#7c86b8'); }
      O(g, 12, 12, 7, 1, sh(c, -0.55));
      P(g, 12, 2, sh(c, -0.2)); P(g, 12, 21, sh(c, -0.4));
    });
  }
  const TOPS = {
    pulse(g, c, v) {
      D(g, 12, 12, 7, STEEL.o); D(g, 12, 12, 6, '#262c4f'); D(g, 11, 11, 3, '#3b4475'); P(g, 10, 9, '#6a74a8');
      const barrel = y => { R(g, 13, y - 1, 10, 4, STEEL.o); R(g, 13, y, 9, 2, '#b8c0e0'); R(g, 13, y, 9, 1, '#e6eaff'); R(g, 21, y - 1, 2, 4, c); R(g, 21, y, 1, 2, sh(c, 0.5)); };
      if (v === 2) { barrel(8); barrel(15); }
      else if (v === 1) { R(g, 13, 9, 10, 7, STEEL.o); R(g, 13, 10, 9, 5, '#9aa3c8'); for (let x = 14; x < 22; x += 2) R(g, x, 10, 1, 5, '#6a7399'); R(g, 13, 10, 9, 1, '#d8ddf3'); R(g, 21, 9, 2, 7, c); }
      else barrel(11);
      D(g, 12, 12, 2, c); P(g, 11, 11, sh(c, 0.6));
    },
    rail(g, c, v) {
      R(g, 4, 7, 11, 11, STEEL.o); R(g, 5, 8, 9, 9, '#262c4f'); R(g, 5, 8, 9, 1, '#3b4475');
      const len = v === 1 ? 19 : 17;
      R(g, 8, 6, len - 2, 4, STEEL.o); R(g, 8, 15, len - 2, 4, STEEL.o);
      R(g, 8, 7, len - 3, 2, '#c9d1f2'); R(g, 8, 16, len - 3, 2, '#c9d1f2'); R(g, 8, 7, len - 3, 1, '#ffffff');
      R(g, 9, 11, len - 4, 3, sh(c, -0.4)); R(g, 9, 11, len - 4, 2, c); R(g, 9, 11, len - 4, 1, sh(c, 0.6));
      if (v === 2) { R(g, 8, 12, len - 3, 1, '#ffffff'); }
      D(g, 8, 12, 2, c); P(g, 7, 11, '#fff');
    },
    cryo(g, c) {
      for (let dy = -10; dy <= 10; dy++) { const hw = Math.round(5.5 - Math.abs(dy) * 0.55); R(g, 12 - hw - 1, 12 + dy, hw * 2 + 3, 1, STEEL.o); }
      for (let dy = -9; dy <= 9; dy++) { const hw = Math.round(5 - Math.abs(dy) * 0.55); R(g, 12 - hw, 12 + dy, hw, 1, sh(c, 0.35)); R(g, 12, 12 + dy, hw + 1, 1, sh(c, -0.25)); }
      R(g, 12, 4, 1, 16, sh(c, 0.7));
      diamond(g, 5, 15, 2, sh(c, -0.1)); diamond(g, 19, 9, 2, sh(c, -0.1)); P(g, 5, 14, '#fff'); P(g, 19, 8, '#fff');
      P(g, 11, 8, '#ffffff'); P(g, 10, 10, '#ffffff');
    },
    missile(g, c, v) {
      R(g, 4, 4, 16, 16, STEEL.o); R(g, 5, 5, 14, 14, '#3b2c24'); R(g, 5, 5, 14, 1, '#5c473a'); R(g, 5, 6, 1, 13, '#4c3a30');
      const pos = v === 1 ? [[6, 6], [11, 6], [6, 11], [11, 11], [16 - 1, 8.5]] : [[7, 7], [13, 7], [7, 13], [13, 13]];
      for (const [x, y] of pos) { R(g, x, y, 4, 4, '#120b08'); R(g, x + 1, y + 1, 3, 2, c); P(g, x + 3, y + 1, sh(c, 0.6)); }
      R(g, 19, 5, 2, 14, '#7a5a46'); R(g, 19, 5, 1, 14, '#a07a60');
      if (v === 2) { R(g, 2, 9, 3, 6, '#7a3a10'); P(g, 2, 10, '#ffb03a'); }
    },
    flame(g, c, v) {
      D(g, 8, 12, 7, STEEL.o); D(g, 8, 12, 6, '#3a1e10'); D(g, 7, 10, 3, '#5a3018'); P(g, 6, 9, '#8a4a22');
      for (let i = 0; i < 10; i++) { const h = Math.round(2 + i * 0.45); R(g, 13 + i, 12 - h - 1, 1, h * 2 + 2, STEEL.o); R(g, 13 + i, 12 - h, 1, h * 2, i < 7 ? '#6a4428' : sh(c, -0.2)); }
      R(g, 13, 11, 9, 1, '#9a6a40');
      if (v === 2) R(g, 15, 9, 6, 1, EL.A.col);
      P(g, 22, 12, '#ffe14d'); P(g, 22, 11, c);
    },
    emp(g, c) {
      D(g, 12, 12, 9, STEEL.o); D(g, 12, 12, 8, '#2a2816');
      for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; P(g, 12 + Math.cos(a) * 7, 12 + Math.sin(a) * 7, k % 2 ? '#ffe14d' : '#141206'); }
      R(g, 8, 7, 13, 10, STEEL.o); R(g, 9, 8, 11, 8, '#5d5838'); R(g, 9, 8, 11, 1, '#8a845a'); R(g, 9, 15, 11, 1, '#3a3622');
      R(g, 19, 8, 2, 8, c); R(g, 19, 9, 1, 6, sh(c, 0.6));
    },
    lens(g, c) {
      D(g, 12, 12, 9, STEEL.o); D(g, 12, 12, 8, '#1a1030'); O(g, 12, 12, 7, 1, sh(c, -0.35));
      for (let k = 0; k < 4; k++) { const a = k * 1.571 + 0.785; R(g, 12 + Math.cos(a) * 8 - 1, 12 + Math.sin(a) * 8 - 1, 3, 3, '#3a2a5c'); }
      D(g, 12, 12, 5, sh(c, -0.5)); D(g, 12, 12, 4, sh(c, -0.2));
    },
    coil(g, c) {
      D(g, 12, 12, 9, STEEL.o); D(g, 12, 12, 8, '#241f10');
      O(g, 12, 12, 7, 1, '#b8862e'); O(g, 12, 12, 5, 1, '#e8c25a'); O(g, 12, 12, 3, 1, '#b8862e');
      D(g, 12, 12, 1, sh(c, 0.4)); P(g, 9, 8, '#fff2c0');
    },
    pylon(g, c) {
      R(g, 6, 17, 12, 4, STEEL.o); R(g, 7, 17, 10, 3, '#2f375f'); R(g, 7, 17, 10, 1, '#4c568c');
      R(g, 10, 5, 5, 13, STEEL.o); R(g, 11, 5, 3, 13, '#3f4a7a'); R(g, 11, 5, 1, 13, '#6a76b0');
      R(g, 6, 5, 13, 3, STEEL.o); R(g, 7, 5, 11, 2, '#59628f');
      R(g, 8, 11, 9, 1, sh(c, -0.4)); R(g, 9, 13, 7, 1, sh(c, -0.4));
    },
    forge(g, c) {
      R(g, 4, 6, 16, 15, STEEL.o); R(g, 5, 7, 14, 13, '#3a3320'); R(g, 5, 7, 14, 1, '#5a5030');
      R(g, 15, 2, 4, 6, STEEL.o); R(g, 16, 2, 2, 5, '#2a2414');
      R(g, 7, 11, 10, 6, '#120d04'); R(g, 8, 12, 8, 4, '#ffb03a'); R(g, 8, 12, 8, 1, '#ffe14d'); R(g, 8, 15, 8, 1, '#c86a10');
      R(g, 6, 18, 12, 1, '#2a2414');
    },
    snare(g, c) {
      R(g, 7, 17, 10, 4, STEEL.o); R(g, 8, 17, 8, 3, '#2f375f'); R(g, 8, 17, 8, 1, '#4c568c');
      R(g, 11, 9, 3, 9, STEEL.o); R(g, 12, 9, 1, 9, '#6a76b0');
      for (let dx = -7; dx <= 7; dx++) { const y = 9 - Math.round(Math.sqrt(Math.max(0, 49 - dx * dx)) * 0.55); R(g, 12 + dx, y, 1, 10 - y - 0 > 0 ? 2 : 1, STEEL.o); P(g, 12 + dx, y, dx % 2 ? '#8fe8ff' : '#c9f4ff'); }
      R(g, 5, 8, 15, 1, STEEL.o); for (let x = 6; x < 19; x += 2) P(g, x, 8, '#59f0b4');
      D(g, 12, 4, 2, STEEL.o); P(g, 12, 4, '#59f0b4');
    },
    grav(g, c) {
      O(g, 12, 12, 10, 1, sh(c, -0.35)); D(g, 12, 12, 7, STEEL.o); D(g, 12, 12, 6, '#140a26'); D(g, 11, 11, 3, '#24123f'); P(g, 9, 9, '#5a3a8a');
      P(g, 12, 12, sh(c, 0.3));
    },
  };
  const ROTATES = { pulse: 1, rail: 1, missile: 1, flame: 1, emp: 1 };
  function topSprite(type, el, spec) {
    const v = spec || 0;
    return outlined(`otop:${type}:${el}:${v}`, spr(`top:${type}:${el}:${v}`, 24, 24, g => TOPS[type](g, EL[el].col, v)), 'rgba(3,4,10,0.85)');
  }

  // ---------- enemy sprites ----------
  // pirate skiff (faces right): black skull sail, dented hull, blue thruster
  function pirateShip(g, gold) {
    const trim = gold ? '#ffd84a' : '#8a6a3a', hull = gold ? '#6a3a14' : '#4a2e16';
    R(g, 3, 10, 17, 3, hull); R(g, 5, 13, 13, 1, '#2a180a'); R(g, 20, 10, 1, 2, hull); P(g, 21, 10, hull);
    R(g, 3, 9, 18, 1, trim); for (let k = 6; k < 19; k += 4) P(g, k, 11, '#2a180a');
    R(g, 0, 10, 3, 2, '#6ae2ff'); P(g, 0, 10, '#e6fbff');
    R(g, 11, 1, 1, 8, '#2a1a0a');
    R(g, 6, 2, 10, 6, gold ? '#2a1438' : '#141018'); R(g, 6, 2, 10, 1, '#3a3040');
    R(g, 9, 3, 4, 3, '#e8e0d0'); P(g, 10, 4, '#141018'); P(g, 12, 4, '#141018'); R(g, 10, 6, 3, 1, '#e8e0d0'); P(g, 8, 7, '#e8e0d0'); P(g, 14, 7, '#e8e0d0');
    R(g, 12, 0, 4, 2, '#d8281a');
    if (gold) { P(g, 4, 9, '#ffffff'); P(g, 15, 9, '#ffffff'); R(g, 14, 0, 2, 1, '#ffd84a'); }
  }
  const EN = {
    pirate(g) { pirateShip(g, false); },
    drone(g, c) { diamond(g, 7, 7, 7, '#2a0610'); diamond(g, 7, 7, 6, c); for (let dy = -5; dy < 0; dy++) R(g, 7 - (6 - Math.abs(dy)) + 1, 7 + dy, 6 - Math.abs(dy), 1, sh(c, 0.3)); R(g, 6, 6, 3, 3, '#2a0010'); P(g, 6, 6, '#ffd0dc'); P(g, 1, 7, '#ffb03a'); P(g, 13, 7, '#ffb03a'); },
    swarmer(g, c) { D(g, 4, 4, 3, '#3a0a24'); D(g, 4, 4, 2, c); P(g, 3, 3, sh(c, 0.6)); P(g, 0, 2, '#3a0a24'); P(g, 8, 2, '#3a0a24'); P(g, 0, 6, '#3a0a24'); P(g, 8, 6, '#3a0a24'); },
    tank(g, c) {
      R(g, 0, 1, 5, 18, '#16050a'); R(g, 15, 1, 5, 18, '#16050a');
      for (let y = 2; y < 19; y += 3) { R(g, 1, y, 3, 1, '#3a1420'); R(g, 16, y, 3, 1, '#3a1420'); }
      R(g, 3, 2, 14, 16, '#2a0a12'); R(g, 4, 3, 12, 14, c); R(g, 4, 3, 12, 2, sh(c, 0.3)); R(g, 4, 15, 12, 2, sh(c, -0.35));
      R(g, 6, 7, 8, 1, sh(c, -0.4)); R(g, 6, 12, 8, 1, sh(c, -0.4));
      D(g, 10, 10, 3, '#3a0a18'); D(g, 10, 10, 2, sh(c, -0.2)); R(g, 10, 9, 8, 2, '#3a0a18'); P(g, 9, 9, sh(c, 0.5));
    },
    flyer(g, c) {
      for (let r = 0; r < 11; r++) { const w = Math.round(2 + r * 1.3); R(g, 8 - (w >> 1) - 1, 1 + r, w + 2, 1, '#2a0616'); R(g, 8 - (w >> 1), 1 + r, w, 1, r < 4 ? sh(c, 0.25) : c); }
      R(g, 4, 9, 9, 3, '#2a0616'); R(g, 7, 2, 2, 7, sh(c, 0.5)); R(g, 7, 5, 2, 2, '#2a0010');
      R(g, 5, 12, 2, 1, '#ffb03a'); R(g, 10, 12, 2, 1, '#ffb03a');
    },
    splitter(g, c) { for (const [x, y] of [[4, 4], [10, 4], [4, 10], [10, 10]]) { D(g, x, y, 3, '#2a0c04'); D(g, x, y, 2, c); P(g, x - 1, y - 1, sh(c, 0.6)); } P(g, 7, 7, '#fff2e0'); },
    phantom(g, c) {
      D(g, 7, 6, 6, sh(c, -0.5)); D(g, 7, 6, 5, c); R(g, 2, 6, 11, 6, c); R(g, 1, 6, 1, 6, sh(c, -0.5)); R(g, 13, 6, 1, 6, sh(c, -0.5));
      for (let x = 2; x < 13; x += 3) R(g, x, 12, 2, 2, c);
      R(g, 4, 5, 2, 3, '#1a1440'); R(g, 9, 5, 2, 3, '#1a1440'); P(g, 5, 2, '#ffffff');
    },
    medic(g, c) { D(g, 7, 7, 7, '#2a0612'); D(g, 7, 7, 6, c); D(g, 6, 6, 3, sh(c, 0.3)); R(g, 6, 3, 3, 9, '#ffffff'); R(g, 3, 6, 9, 3, '#ffffff'); R(g, 7, 4, 1, 7, '#59f0b4'); R(g, 4, 7, 7, 1, '#59f0b4'); },
    shielder(g, c) {
      for (let dy = -7; dy <= 7; dy++) { const hw = dy < -3 || dy > 3 ? 7 - (Math.abs(dy) - 3) * 1.5 : 7; R(g, 8 - hw - 1, 8 + dy, hw * 2 + 2, 1, '#0a1430'); R(g, 8 - hw, 8 + dy, hw * 2, 1, dy < 0 ? sh(c, 0.2) : c); }
      D(g, 8, 8, 2, '#ffffff'); P(g, 7, 7, '#c8e0ff');
    },
    voidling(g, c) { diamond(g, 5, 5, 5, '#1a0830'); diamond(g, 5, 5, 4, c); P(g, 4, 3, '#ffffff'); P(g, 5, 5, '#ffffff'); },
  };
  const EN_SIZE = { drone: 15, swarmer: 9, tank: 20, flyer: 16, splitter: 14, phantom: 15, medic: 15, shielder: 17, voidling: 11, reflector: 15, carrier: 22, sapper: 13, leech: 14 };
  const pirateSprite = gold => UNITS.pirate(gold);
  function enemySprite(type) {
    if (type === 'pirate') return pirateSprite(false);
    const s = EN_SIZE[type] || 14, c = ENEMY_COL[type] || '#ff5470';
    return outlined('oen:' + type, spr('en:' + type, s, s, g => (EN[type] || EN.drone)(g, c)));
  }
  const BOSS = {
    behemoth(g, c) {
      R(g, 2, 8, 8, 34, '#16050a'); R(g, 38, 8, 8, 34, '#16050a');
      for (let y = 9; y < 42; y += 4) { R(g, 3, y, 6, 2, '#3a1420'); R(g, 39, y, 6, 2, '#3a1420'); }
      R(g, 7, 6, 34, 38, '#2a0a12'); R(g, 9, 8, 30, 34, c); R(g, 9, 8, 30, 3, sh(c, 0.3));
      for (let y = 16; y < 40; y += 7) R(g, 11, y, 26, 2, sh(c, -0.35));
      R(g, 14, 2, 6, 8, '#2a0a12'); R(g, 28, 2, 6, 8, '#2a0a12'); R(g, 15, 3, 4, 6, sh(c, 0.2)); R(g, 29, 3, 4, 6, sh(c, 0.2));
      R(g, 16, 12, 4, 4, '#ffe14d'); R(g, 28, 12, 4, 4, '#ffe14d'); P(g, 16, 12, '#fff');
    },
    queen(g, c) {
      for (let r = 0; r < 22; r++) { const w = Math.round(4 + r * 1.9); R(g, 24 - (w >> 1), 12 + r, w, 1, r % 4 === 0 ? sh(c, -0.4) : sh(c, -0.1)); }
      R(g, 20, 2, 8, 42, '#2a0616'); R(g, 21, 3, 6, 40, c); R(g, 21, 3, 2, 40, sh(c, 0.4));
      for (let k = 0; k < 5; k++) R(g, 18 + k * 3, 1, 2, 3, '#ffe14d');
      R(g, 22, 8, 4, 3, '#2a0010'); P(g, 22, 8, '#ffe14d');
    },
    wraith(g, c) {
      const lc = '#d6ceff';
      D(g, 24, 18, 15, '#2a2050'); D(g, 24, 18, 14, lc); R(g, 10, 18, 29, 16, lc); R(g, 9, 18, 1, 16, '#2a2050'); R(g, 39, 18, 1, 16, '#2a2050');
      for (let x = 10; x < 39; x += 4) R(g, x, 34, 3, 4 + (x % 8 ? 3 : 0), lc);
      R(g, 15, 12, 18, 10, '#1a1440'); R(g, 18, 15, 4, 4, '#ff4d6a'); R(g, 27, 15, 4, 4, '#ff4d6a'); P(g, 19, 15, '#fff'); P(g, 28, 15, '#fff');
    },
    overmind(g, c) {
      D(g, 24, 24, 21, '#2a0618'); D(g, 24, 24, 20, '#5a1438'); D(g, 24, 24, 17, c); D(g, 21, 20, 8, sh(c, 0.25));
      for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; for (let r = 9; r < 16; r++) P(g, 24 + Math.cos(a + r * 0.08) * r, 24 + Math.sin(a + r * 0.08) * r, sh(c, -0.4)); }
      D(g, 24, 24, 6, '#2a0010'); D(g, 24, 24, 4, '#ffe14d'); P(g, 23, 23, '#ffffff');
    },
    titan(g, c) {
      R(g, 4, 4, 40, 40, '#16050a'); R(g, 6, 6, 36, 36, c); R(g, 6, 6, 36, 3, sh(c, 0.3)); R(g, 6, 39, 36, 3, sh(c, -0.35));
      R(g, 16, 16, 16, 16, '#2a0a12'); R(g, 18, 18, 12, 12, '#ffe14d'); R(g, 20, 20, 8, 8, '#fff2a0');
      for (const [x, y] of [[9, 9], [36, 9], [9, 36], [36, 36]]) R(g, x, y, 3, 3, '#3a0a18');
    },
    cat(g) {
      const c = '#ff9a3c', dk = '#3a1606', st = '#c2611c', lt = '#ffd29a';
      for (let y = 30; y < 44; y++) R(g, 39 + Math.round(Math.sin(y / 3) * 2), y, 4, 1, y % 4 < 2 ? c : st);
      D(g, 24, 33, 14, dk); D(g, 24, 33, 13, c); D(g, 24, 37, 7, lt);
      for (const x of [14, 34]) for (let k = 0; k < 3; k++) R(g, x - 1 + k, 26 + k * 4, 3, 1, st);
      D(g, 24, 19, 12, dk); D(g, 24, 19, 11, c);
      for (let r = 0; r < 9; r++) { const w = 1 + r; R(g, 13, 4 + r, w, 1, dk); R(g, 14, 5 + r, Math.max(0, w - 2), 1, c); R(g, 36 - w, 4 + r, w, 1, dk); R(g, 36 - w + 2, 5 + r, Math.max(0, w - 2), 1, c); }
      R(g, 15, 8, 2, 4, '#ff8fb0'); R(g, 32, 8, 2, 4, '#ff8fb0');
      R(g, 20, 9, 1, 4, st); R(g, 24, 8, 1, 5, st); R(g, 28, 9, 1, 4, st);
      R(g, 16, 15, 6, 6, '#1a2a10'); R(g, 17, 16, 4, 4, '#8dff4a'); R(g, 19, 16, 1, 4, '#0a0a0a'); P(g, 17, 16, '#ffffff');
      R(g, 27, 15, 6, 6, '#1a2a10'); R(g, 28, 16, 4, 4, '#8dff4a'); R(g, 30, 16, 1, 4, '#0a0a0a'); P(g, 28, 16, '#ffffff');
      R(g, 23, 22, 3, 2, '#ff6f9a'); P(g, 22, 25, dk); P(g, 23, 26, dk); P(g, 24, 25, dk); P(g, 25, 26, dk); P(g, 26, 25, dk);
      for (const [y, dy] of [[22, -1], [24, 0], [26, 1]]) for (let k = 0; k < 7; k++) { P(g, 15 - k, y + Math.round(dy * k / 3), '#fff4e0'); P(g, 33 + k, y + Math.round(dy * k / 3), '#fff4e0'); }
      D(g, 17, 44, 4, dk); D(g, 17, 44, 3, lt); D(g, 31, 44, 4, dk); D(g, 31, 44, 3, lt);
    },
    gloop(g) {
      const c = '#5cff7a', dk = '#0c3a18', sd = '#2fb84e';
      for (let y = 8; y < 44; y++) { const t = (y - 8) / 36, hw = Math.round(Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t))) * 20); R(g, 24 - hw - 1, y, hw * 2 + 2, 1, dk); R(g, 24 - hw, y, hw * 2, 1, y > 36 ? sd : c); }
      R(g, 4, 43, 40, 2, dk);
      for (const [x, l] of [[9, 3], [17, 5], [30, 2], [38, 4]]) { R(g, x, 44, 3, l, dk); R(g, x + 1, 44, 1, l - 1, sd); }
      R(g, 13, 13, 5, 2, '#c8ffd2'); R(g, 11, 15, 2, 4, '#c8ffd2');
      for (const [x, y, r] of [[34, 34, 2], [14, 33, 1], [28, 38, 1]]) D(g, x, y, r, '#a6ffb6');
      D(g, 17, 22, 6, dk); D(g, 17, 22, 5, '#ffffff'); D(g, 19, 24, 2, '#0a0a0a');
      D(g, 31, 19, 7, dk); D(g, 31, 19, 6, '#ffffff'); D(g, 29, 22, 3, '#0a0a0a');
      for (let x = 18; x < 32; x++) P(g, x, 31 + Math.round(Math.sin(x * 1.3)), dk);
    },
    whale(g) {
      const c = '#4f8dff', dk = '#0a1a40', lt = '#cfe2ff', sd = '#2c5bc4';
      for (let x = 4; x < 46; x++) { const t = (x - 4) / 42, hh = Math.round(Math.sin(Math.min(1, t * 1.15) * Math.PI) * 11 + (t > 0.5 ? 3 : 0)); const cy = 25; R(g, x, cy - hh - 1, 1, hh * 2 + 2, dk); R(g, x, cy - hh, 1, hh * 2, c); R(g, x, cy + Math.round(hh * 0.3), 1, Math.round(hh * 0.7), lt); }
      for (let x = 14; x < 44; x += 3) R(g, x, 31, 1, 4, sd);
      for (let r = 0; r < 8; r++) { R(g, 1, 13 + r, 5 - Math.round(r / 2), 1, dk); R(g, 1, 36 - r, 5 - Math.round(r / 2), 1, dk); R(g, 2, 14 + r, 3 - Math.round(r / 3), 1, c); R(g, 2, 35 - r, 3 - Math.round(r / 3), 1, c); }
      R(g, 22, 33, 8, 3, dk); R(g, 23, 33, 6, 2, sd);
      D(g, 37, 22, 2, '#0a0a0a'); P(g, 37, 21, '#ffffff');
      R(g, 32, 8, 2, 6, '#9fe7ff'); R(g, 29, 6, 2, 3, '#9fe7ff'); R(g, 35, 6, 2, 3, '#9fe7ff');
      for (let x = 18; x < 40; x += 6) P(g, x, 17, lt);
    },
    duck(g) {
      const c = '#ffd83a', dk = '#3a2a00', sd = '#e0a812';
      D(g, 21, 33, 14, dk); D(g, 21, 33, 13, c); R(g, 6, 33, 30, 13, dk); R(g, 7, 33, 28, 12, c); R(g, 7, 43, 28, 2, sd);
      R(g, 3, 27, 6, 6, dk); R(g, 4, 28, 4, 4, c);
      for (let k = 0; k < 4; k++) R(g, 13 + k, 30 + k * 2, 14 - k * 2, 2, sd);
      D(g, 31, 16, 10, dk); D(g, 31, 16, 9, c); D(g, 28, 12, 3, '#fff2a8');
      R(g, 38, 15, 9, 5, '#5a2200'); R(g, 39, 16, 8, 3, '#ff8a1f'); R(g, 39, 19, 6, 2, '#d45a00');
      D(g, 33, 13, 2, '#0a0a0a'); P(g, 33, 12, '#ffffff');
      R(g, 28, 4, 2, 3, sd);
    },
    fsm(g) {
      const n = '#f2d27a', ns = '#c69a3a', dk = '#3a2a08';
      const strand = (x0, y0, len, ph, amp) => { for (let i = 0; i < len; i++) { const x = x0 + Math.round(Math.sin(i * 0.35 + ph) * amp), y = y0 + i; P(g, x - 1, y, dk); P(g, x + 1, y, dk); P(g, x, y, i % 5 === 0 ? ns : n); } };
      for (let k = 0; k < 9; k++) strand(8 + k * 4, 24, 20 - (k % 3) * 3, k * 1.7, 2 + (k % 2));
      for (let y = 18; y < 34; y++) for (let x = 6; x < 42; x++) { const v = Math.sin(x * 0.9 + y * 0.4) + Math.sin(x * 0.3 - y * 1.1); const dx = (x - 24) / 18, dy = (y - 26) / 8; if (dx * dx + dy * dy < 1) P(g, x, y, v > 0.6 ? ns : v < -1.2 ? dk : n); }
      for (const [x, y] of [[15, 22], [33, 22]]) { D(g, x, y, 7, '#2a0a02'); D(g, x, y, 6, '#8a3a1a'); D(g, x - 2, y - 2, 2, '#c06a3a'); P(g, x + 2, y + 2, '#5a1a0a'); }
      for (const [x0, x1] of [[13, 9], [35, 39]]) { for (let y = 3; y < 17; y++) { const x = Math.round(x0 + (x1 - x0) * (1 - (y - 3) / 14)); P(g, x, y, ns); P(g, x + 1, y, n); } }
      for (const x of [9, 39]) { D(g, x, 4, 4, dk); D(g, x, 4, 3, '#ffffff'); D(g, x + (x < 24 ? 1 : -1), 5, 1, '#0a0a0a'); }
    },
    worm(g) { // the head: armoured purple carapace, mandibles, wormhole-glow eyes
      const c = '#8a3ad6', dk = '#1e0838', lt = '#c48cff', gl = '#5cf2ff';
      for (let k = 0; k < 6; k++) { const y = 22 + k * 3; R(g, 4 - k % 2, y, 8, 2, dk); R(g, 36 + k % 2, y, 8, 2, dk); R(g, 5 - k % 2, y, 6, 1, '#4a1a7a'); R(g, 37 + k % 2, y, 6, 1, '#4a1a7a'); }
      D(g, 24, 26, 17, dk); D(g, 24, 26, 16, c); D(g, 24, 22, 12, sh(c, 0.15));
      for (let k = 0; k < 4; k++) R(g, 10 + k * 1, 14 + k * 6, 28 - k * 2, 1, sh(c, -0.35));
      R(g, 12, 9, 24, 4, lt); R(g, 14, 7, 20, 2, sh(lt, 0.2));
      for (const x of [17, 31]) { D(g, x, 19, 4, '#081a20'); D(g, x, 19, 3, gl); P(g, x - 1, 18, '#ffffff'); D(g, x, 19, 1, '#0a3a48'); }
      for (const sd of [-1, 1]) for (let i = 0; i < 9; i++) { const x = 24 + sd * (6 + i * 0.6), y = 34 + i; R(g, x - 1, y, 3, 1, dk); P(g, x, y, '#e8d8ff'); }
      R(g, 19, 36, 10, 4, '#2a0010'); R(g, 20, 37, 8, 2, '#ff4d6a'); for (let x = 20; x < 28; x += 2) P(g, x, 36, '#ffffff');
      for (const sd of [-1, 1]) for (let i = 0; i < 6; i++) P(g, 24 + sd * (4 + i), 6 - i, i % 2 ? lt : '#ffffff');
    },
    auditor(g) { // grey suit, red tie, comb-over, one monocle, a briefcase full of forms
      const suit = '#4a5266', sd = '#2a3040', skin = '#e8c2a0', dk = '#14161e';
      R(g, 14, 26, 20, 18, dk); R(g, 15, 27, 18, 16, suit); R(g, 15, 27, 18, 2, sh(suit, 0.2));
      R(g, 21, 27, 6, 10, '#f0f0f0'); R(g, 23, 28, 2, 9, '#d8281a'); P(g, 23, 37, '#a01810'); P(g, 24, 37, '#a01810');
      for (let i = 0; i < 6; i++) { P(g, 20 - i % 2, 27 + i, sd); P(g, 28 + i % 2, 27 + i, sd); }
      R(g, 16, 44, 6, 3, dk); R(g, 26, 44, 6, 3, dk);
      D(g, 24, 16, 10, dk); D(g, 24, 16, 9, skin); R(g, 15, 9, 18, 3, '#6a5a4a'); for (let x = 16; x < 32; x += 2) P(g, x, 8, '#6a5a4a');
      R(g, 17, 15, 5, 2, dk); D(g, 29, 16, 3, '#ffd83a'); D(g, 29, 16, 2, '#cfefff'); P(g, 28, 15, '#ffffff'); for (let y = 19; y < 26; y++) P(g, 32, y, '#ffd83a');
      R(g, 20, 21, 8, 1, '#8a4a3a');
      R(g, 34, 32, 12, 10, '#2a1408'); R(g, 35, 33, 10, 8, '#7a4a20'); R(g, 38, 30, 4, 2, '#2a1408'); R(g, 39, 36, 2, 2, '#ffd83a');
      R(g, 2, 30, 10, 13, dk); R(g, 3, 31, 8, 11, '#f0f0f0'); for (let y = 33; y < 41; y += 2) R(g, 4, y, 6, 1, '#8a8fa8'); R(g, 7, 38, 4, 3, '#d8281a');
    },
    snail(g) { // a smug little snail with a cosmic swirl shell
      const body = '#9ad86a', bd = '#2a4a14', sh1 = '#b86cff', sh2 = '#5a2a8a';
      R(g, 4, 36, 40, 8, bd); R(g, 5, 37, 38, 6, body); R(g, 5, 37, 38, 1, sh(body, 0.3)); for (let x = 7; x < 42; x += 5) P(g, x, 42, sh(body, -0.3));
      D(g, 22, 24, 15, '#1a0830'); D(g, 22, 24, 14, sh2);
      for (let a = 0; a < 26; a += 0.04) { const r = 1 + a * 0.5; P(g, 22 + Math.cos(a) * r, 24 + Math.sin(a) * r, a % 1.6 < 0.8 ? sh1 : '#ffd6ff'); }
      D(g, 22, 24, 2, '#ffffff');
      for (let i = 0; i < 10; i++) { P(g, 36 + i * 0.2, 34 - i, bd); P(g, 37 + i * 0.2, 34 - i, body); P(g, 40 + i * 0.3, 34 - i, bd); P(g, 41 + i * 0.3, 34 - i, body); }
      D(g, 38, 23, 3, bd); D(g, 38, 23, 2, '#ffffff'); P(g, 39, 23, '#0a0a0a'); D(g, 44, 23, 3, bd); D(g, 44, 23, 2, '#ffffff'); P(g, 43, 23, '#0a0a0a');
      R(g, 39, 39, 5, 1, bd);
    },
  };
  const BOSS_COL = { cat: '#ff9a3c', gloop: '#5cff7a', whale: '#4f8dff', duck: '#ffd83a', fsm: '#f2d27a', worm: '#c46cff', auditor: '#ffd83a', snail: '#9ad86a' };
  const wormSeg = () => outlined('owseg', spr('wseg', 22, 22, g => { D(g, 11, 11, 9, '#1e0838'); D(g, 11, 11, 8, '#7a2ec4'); D(g, 11, 9, 5, '#9a5ae0'); R(g, 4, 11, 14, 1, '#4a1a7a');
    for (const x of [2, 19]) { R(g, x, 13, 1, 6, '#1e0838'); } R(g, 1, 18, 2, 1, '#e8d8ff'); R(g, 19, 18, 2, 1, '#e8d8ff'); P(g, 9, 6, '#c48cff'); }));
  const meatSprite = () => outlined('omeat', spr('meat', 12, 12, g => { D(g, 6, 6, 5, '#2a0a02'); D(g, 6, 6, 4, '#8a3a1a'); D(g, 5, 5, 1, '#c06a3a'); R(g, 6, 2, 3, 2, '#d8281a'); P(g, 8, 8, '#5a1a0a'); }));
  const scCache = {};
  function scaledSpr(k, s, f) { if (scCache[k]) return scCache[k]; const c = document.createElement('canvas'); c.width = Math.round(s.width * f); c.height = Math.round(s.height * f); const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(s, 0, 0, c.width, c.height); return scCache[k] = c; }
  const BOSS_SCALE = 1.5; // bosses draw 1.5× their 48px art (3 tiles), so they read as bosses on big maps
  function bossSprite(id) { return outlined('oboss:' + id, spr('boss:' + id, 48, 48, g => BOSS[id](g, ENEMY_COL.boss))); }

  // crate palettes: frame, body, lid, beacon
  const CACHE_PAL = { normal: ['#3a2a10', '#a8741c', '#e0a640', '#ffe14d'], cursed: ['#2a0a18', '#8a1a3a', '#c8325a', '#ff4d6a'], gold: ['#5a4206', '#e8b820', '#fff0a0', '#ffffff'] };
  // ---------- map layer ----------
  function drawMap() {
    if (mapLayer.width !== BW * RES || mapLayer.height !== BH * RES) { mapLayer.width = BW * RES; mapLayer.height = BH * RES; }
    const m = mapLayer.getContext('2d'), map = G.map, cols = COLS;
    m.setTransform(RES, 0, 0, RES, 0, 0); m.imageSmoothingEnabled = false;
    m.clearRect(0, 0, BW, BH);
    const isP = (x, y) => x >= 0 && y >= 0 && x < cols && y < ROWS && (map.tiles[y * cols + x] === 1 || map.tiles[y * cols + x] === 4);
    for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < cols; tx++) {
      const i = ty * cols + tx, t = map.tiles[i], d = map.deco[i], X = tx * TILE, Y = ty * TILE;
      if (t === 5) {
        // reserved by a forming wormhole lane: darker ground with a hazard grid, no building
        R(m, X, Y, TILE, TILE, '#120f22');
        for (let k = 0; k < TILE; k += 6) { R(m, X + k, Y, 3, 1, '#3a2560'); R(m, X + k, Y + TILE - 1, 3, 1, '#3a2560'); R(m, X, Y + k, 1, 3, '#3a2560'); R(m, X + TILE - 1, Y + k, 1, 3, '#3a2560'); }
        continue;
      }
      if (t === 1 || t === 4) {
        R(m, X, Y, TILE, TILE, '#2b2048');
        for (let k = 0; k < 14; k++) { m.fillStyle = k % 3 === 0 ? '#2f254c' : k % 3 === 1 ? '#1f1834' : '#2a2045'; m.fillRect(X + ((d * (k + 3) * 7) % 48) / 2, Y + ((d * (k + 5) * 11) % 48) / 2, 0.5, 0.5); }
        continue;
      }
      const v = (d % 7) - 3;
      R(m, X, Y, TILE, TILE, `rgb(${17 + v},${20 + v},${37 + v * 2})`);
      m.fillStyle = '#262d55'; m.fillRect(X, Y, TILE, 0.5); m.fillStyle = '#1f2548'; m.fillRect(X, Y + 0.5, 0.5, TILE - 0.5); m.fillStyle = '#1a1f3c'; m.fillRect(X + 0.5, Y + 0.5, TILE - 1, 0.5);
      m.fillStyle = '#080a15'; m.fillRect(X, Y + TILE - 0.5, TILE, 0.5); m.fillRect(X + TILE - 0.5, Y, 0.5, TILE); m.fillStyle = '#0e1120'; m.fillRect(X + 0.5, Y + TILE - 1, TILE - 1, 0.5);
      if (d % 3 === 0) { R(m, X + 3, Y + 11, 18, 1, '#141a2f'); R(m, X + 3, Y + 12, 18, 1, '#1d2340'); }
      if (d % 5 === 0) for (const [bx, by] of [[3, 3], [19.5, 3], [3, 19.5], [19.5, 19.5]]) { m.fillStyle = '#0c0f1e'; m.fillRect(X + bx + 0.5, Y + by + 0.5, 1.5, 1.5); m.fillStyle = '#2c3460'; m.fillRect(X + bx, Y + by, 1.5, 1.5); m.fillStyle = '#4a5590'; m.fillRect(X + bx, Y + by, 0.5, 0.5); }
      if (d % 17 === 0) for (let k = 0; k < 3; k++) { R(m, X + 7, Y + 8 + k * 3, 10, 1, '#0b0d1b'); R(m, X + 7, Y + 9 + k * 3, 10, 1, '#222949'); }
      if (d % 23 === 0) for (let k = 0; k < 7; k++) P(m, X + 5 + k * 2, Y + 6 + k + (k % 2), '#0c0f1e');
      if (d % 61 === 0) { R(m, X + 11, Y + 11, 2, 2, '#1f6b55'); P(m, X + 11, Y + 11, '#59f0b4'); }
      if (t === 2) {
        if (d % 2) {
          R(m, X + 2, Y + 4, 21, 19, 'rgba(0,0,0,0.5)');
          R(m, X + 2, Y + 2, 20, 19, '#0a0c19'); R(m, X + 3, Y + 3, 18, 17, '#2a2f4d'); R(m, X + 3, Y + 3, 18, 2, '#3c4470'); R(m, X + 3, Y + 5, 2, 15, '#343b62');
          for (let k = 0; k < 18; k += 4) { R(m, X + 3 + k, Y + 10, 2, 3, '#ffb03a'); R(m, X + 5 + k, Y + 10, 2, 3, '#1a1408'); }
          R(m, X + 3, Y + 18, 18, 2, '#1c2038');
        } else {
          D(m, X + 9, Y + 14, 7, '#0a0c19'); D(m, X + 9, Y + 13, 6, '#30365a'); D(m, X + 7, Y + 11, 3, '#454d7e');
          D(m, X + 17, Y + 9, 5, '#0a0c19'); D(m, X + 17, Y + 8, 4, '#3a4170'); P(m, X + 15, Y + 6, '#6a74a8');
        }
      }
    }
    // path borders and direction chevrons
    for (const L of map.lanes) {
      if (L.openWave) continue;
      L.tiles.forEach((p, k) => {
        const X = p.x * TILE, Y = p.y * TILE;
        if (!isP(p.x, p.y - 1)) { R(m, X, Y, TILE, 2, '#5a46a0'); R(m, X, Y + 2, TILE, 1, '#8a6ee0'); }
        if (!isP(p.x, p.y + 1)) { R(m, X, Y + TILE - 2, TILE, 2, '#0d0a18'); R(m, X, Y + TILE - 3, TILE, 1, '#5a46a0'); }
        if (!isP(p.x - 1, p.y)) { R(m, X, Y, 2, TILE, '#5a46a0'); R(m, X + 2, Y, 1, TILE, '#8a6ee0'); }
        if (!isP(p.x + 1, p.y)) { R(m, X + TILE - 2, Y, 2, TILE, '#0d0a18'); R(m, X + TILE - 3, Y, 1, TILE, '#5a46a0'); }
        if (!isP(p.x, p.y - 1)) R(m, X, Y + 3, TILE, 3, 'rgba(6,4,14,0.28)');
        if (!isP(p.x - 1, p.y)) R(m, X + 3, Y, 3, TILE, 'rgba(6,4,14,0.22)');
        const nx = L.tiles[k + 1];
        if (nx && k % 2 === 0) {
          const dx = nx.x - p.x, dy = nx.y - p.y, cx = X + 12, cy = Y + 12;
          for (let s = -4; s <= 4; s++) { const a = Math.abs(s); R(m, cx + dx * (2 - a * 0.75) - dy * s, cy + dy * (2 - a * 0.75) + dx * s, 2, 2, '#6650a8'); }
        }
      });
    }
    // circuit conduits etched into the deck: dim traces along tile seams that end in small emitters
    conduits = [];
    const cr = mulberry32((G.seed ^ 0x5bd1e995) >>> 0), nC = Math.round(cols / 2.2);
    const nearPath = (vx, vy) => isP(vx, vy) || isP(vx - 1, vy) || isP(vx, vy - 1) || isP(vx - 1, vy - 1);
    for (let k = 0; k < nC; k++) {
      let x = 1 + Math.floor(cr() * (cols - 1)), y = 1 + Math.floor(cr() * (ROWS - 1));
      if (nearPath(x, y)) continue;
      let dir = Math.floor(cr() * 4), len = 3 + Math.floor(cr() * 7);
      const pts = [[x, y]];
      for (let st = 0; st < len; st++) {
        if (cr() < 0.3) dir = (dir + (cr() < 0.5 ? 1 : 3)) % 4;
        const nx = x + [1, 0, -1, 0][dir], ny = y + [0, 1, 0, -1][dir];
        if (nx < 1 || ny < 1 || nx >= cols || ny >= ROWS || nearPath(nx, ny)) break;
        x = nx; y = ny; pts.push([x, y]);
      }
      if (pts.length < 3) continue;
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
        const X0 = Math.min(ax, bx) * TILE, Y0 = Math.min(ay, by) * TILE;
        if (ay === by) { R(m, X0, Y0 - 1, TILE, 1, '#0b0e1c'); R(m, X0, Y0, TILE + 1, 1, '#1d3346'); }
        else { R(m, X0 - 1, Y0, 1, TILE, '#0b0e1c'); R(m, X0, Y0, 1, TILE + 1, '#1d3346'); }
      }
      const col = ['#59f0b4', '#6ae2ff', '#b86cff'][Math.floor(cr() * 3)];
      for (const [ex, ey] of [pts[0], pts[pts.length - 1]]) { R(m, ex * TILE - 2, ey * TILE - 2, 5, 5, '#0a0c19'); R(m, ex * TILE - 1, ey * TILE - 1, 3, 3, sh(col, -0.45)); P(m, ex * TILE, ey * TILE, col); conduits.push({ x: ex * TILE, y: ey * TILE, col, ph: cr() * 6.28 }); }
    }
    // soft emissive glow under the path, built once per map at quarter resolution
    const gs = 4;
    if (!glowLayer) glowLayer = document.createElement('canvas');
    glowLayer.width = Math.ceil(BW / gs); glowLayer.height = Math.ceil(BH / gs);
    const gg = glowLayer.getContext('2d'); gg.clearRect(0, 0, glowLayer.width, glowLayer.height);
    const gr = gg.createRadialGradient(0, 0, 0, 0, 0, TILE * 1.1 / gs); gr.addColorStop(0, 'rgba(150,90,255,0.32)'); gr.addColorStop(1, 'rgba(150,90,255,0)');
    gg.fillStyle = gr;
    for (const L of map.lanes) if (!L.openWave) for (const p of L.tiles) { gg.save(); gg.translate((p.x + 0.5) * TILE / gs, (p.y + 0.5) * TILE / gs); gg.fillRect(-TILE / gs * 1.2, -TILE / gs * 1.2, TILE / gs * 2.4, TILE / gs * 2.4); gg.restore(); }
    m.save(); m.globalCompositeOperation = 'lighter'; m.globalAlpha = 0.5; m.imageSmoothingEnabled = true; m.drawImage(glowLayer, 0, 0, BW, BH); m.restore();
    mapDirty = false;
  }

  // ground outside the current sector stays visible when zoomed out, but veiled, behind a dashed frontier line
  function drawVeil() {
    const x0 = reg.x, y0 = reg.y, x1 = reg.x + reg.w, y1 = reg.y + reg.h, full = reg.w >= BW - 1 && reg.h >= BH - 1;
    b.strokeStyle = '#1c2140'; b.lineWidth = 1; b.strokeRect(-0.5, -0.5, BW + 1, BH + 1);
    if (full) return;
    b.fillStyle = 'rgba(4,5,11,0.66)';
    b.fillRect(0, 0, BW, y0); b.fillRect(0, y1, BW, BH - y1); b.fillRect(0, y0, x0, y1 - y0); b.fillRect(x1, y0, BW - x1, y1 - y0);
    b.strokeStyle = 'rgba(184,108,255,0.38)'; b.setLineDash([4, 4]); b.lineDashOffset = -frame / 8;
    b.strokeRect(x0 - 0.5, y0 - 0.5, x1 - x0 + 1, y1 - y0 + 1); b.setLineDash([]);
  }

  // ---------- screen-space lighting ----------
  const lightSprites = new Map();
  function lightSprite(col) {
    let s2 = lightSprites.get(col);
    if (!s2) {
      s2 = document.createElement('canvas'); s2.width = s2.height = 64;
      const g = s2.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, hexA(col, 1)); gr.addColorStop(0.25, hexA(col, 0.55)); gr.addColorStop(0.6, hexA(col, 0.16)); gr.addColorStop(1, hexA(col, 0));
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64); lightSprites.set(col, s2);
    }
    return s2;
  }
  let lights = [];
  function light(x, y, r, col, a) { if (a > 0.01 && r > 0) lights.push(x, y, r, col, a); }

  // ---------- dynamic drawing ----------
  function ensureBuffers() {
    if (bufW !== BW || mapLayer.height !== BH * RES) { bufW = BW; mapDirty = true; fit(); resetCam(); }
  }
  // the view buffer grows in 128px steps so pinch-zooming doesn't reallocate every frame
  function sizeBuf(w, h) {
    if (buf.width < w || buf.height < h || buf.width > w + 512 || buf.height > h + 512) { buf.width = Math.ceil(w / 128) * 128; buf.height = Math.ceil(h / 128) * 128; }
  }
  // Frontier: a tower that is moving glides from its old tile to the new one (lifted off the ground) while it is offline
  function drawTower(t) {
    if (!(t.mvT > 0 && t.mvFrom)) return drawTower0(t);
    const k = clamp(1 - t.mvT / FRONTIER.moveT, 0, 1), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) * (-2 * k + 2) / 2, lift = Math.sin(k * Math.PI) * 7;
    const dx = (t.mvFrom.x - t.cx) * (1 - e) * TILE, dy = (t.mvFrom.y - t.cy) * (1 - e) * TILE;
    b.fillStyle = 'rgba(2,3,10,0.35)'; b.beginPath(); b.ellipse(t.cx * TILE + dx + 1.5, t.cy * TILE + dy + 3, 10, 8, 0, 0, 6.283); b.fill();
    b.save(); b.translate(dx, dy - lift); drawTower0(t); b.restore();
  }
  function drawTower0(t, onCore) {
    const X = t.x * TILE, Y = t.y * TILE, D0 = TOWERS[t.type], el = t.s ? t.s.el : D0.el, c = EL[el].col, cx = X + 12, cy = Y + 12;
    if (!onCore) blit(UNITS.base(el), cx, cy, TW_K);
    const firing = t.flash > 0 || (t.aimT !== undefined && G.time - t.aimT < 0.25) || (t.beamTargets && t.beamTargets.length);
    const anim = { rk: t.flash > 0.03 ? 1 : 0, ld: t.type === 'missile' ? t.cd < 0.45 : 0,
      ph: t.type === 'forge' ? (frame >> 4) % 2 : (t.spec === 1 && t.type === 'pulse' && firing) || t.type === 'flame' && firing ? (frame >> 1) % 3 : 0 };
    const sp = UNITS.SPIN[t.type], ang = UNITS.ROT[t.type] ? (t.angle === undefined ? -1.57 : t.angle) : sp ? frame / 60 * sp * (t.disabled > 0 ? 0 : 1) + t.id : 0;
    if (t._wk !== el + (t.spec || 0)) { t._wk = el + (t.spec || 0); UNITS.warmTower(t.type, el, t.spec || 0); }
    const top = UNITS.top(t.type, el, t.spec || 0, ang, anim);
    if (!onCore) { b.fillStyle = 'rgba(2,3,10,0.3)'; b.beginPath(); b.ellipse(cx + 1.5, cy + 2, 12, 11, 0, 0, 6.283); b.fill(); }
    // v5.8 tower character: a shot is seen when the sim stamps t.aimT; the turret kicks back along its heading and eases home
    if (t.aimT !== t._pa) { if (t._pa !== undefined && t.aimT !== undefined) towerFired(t, cx, cy, c); t._pa = t.aimT; }
    const age = t._ft === undefined ? 9 : rt - t._ft, rot = UNITS.ROT[t.type], ca = Math.cos(t.angle || 0), sa = Math.sin(t.angle || 0);
    const kb = rot && age < 0.14 ? (RECOIL[t.type] || 0) * (1 - age / 0.14) : 0;
    blit(top, cx - ca * kb, cy - sa * kb - (t.type === 'pylon' && (frame >> 5) % 2 ? 0.5 : 0), TW_K);
    if (rot && age < 0.055) muzzle(t, cx - ca * kb, cy - sa * kb, ca, sa, c, age);
    // live details
    switch (t.type) {
      case 'cryo': if (t.flash > 0) { D(b, cx, cy, t.spec === 1 ? 4 : 3, 'rgba(255,255,255,0.8)'); } break;
      case 'coil': { // sparks gather toward the dome as the next bolt charges (t.cd runs 1 → 0), then the dome flashes on the shot
        const q = t.cd > 0 ? 1 - Math.min(1, t.cd) : 0.15, n = 1 + Math.round(q * 4), hot = t.spec === 2 ? '#ffb070' : '#fff6c0';
        if (frame % 5 < 3 || q > 0.6) for (let k = 0; k < n; k++) { const a = Math.random() * 6.283, r = 3 + Math.random() * (9 - q * 5); R(b, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1, 1, k % 2 ? '#ffffff' : hot); }
        if (age < 0.06) { const s2 = 3 + (t.asc ? 1 : 0); R(b, cx - s2, cy, s2 * 2 + 1, 1, c); R(b, cx, cy - s2, 1, s2 * 2 + 1, c); D(b, cx, cy, 1, '#ffffff'); }
        break; }
      case 'rail': { // charge glow at the barrel tip once the next shot is close (and a target was in range)
        const q = t.cd > 0 && t.cd < 0.35 ? 1 - t.cd / 0.35 : t.cd <= 0 && t.aimT !== undefined && G.time - t.aimT < 3 ? 0.75 + 0.25 * Math.sin(frame / 3) : 0;
        if (q > 0.05 && age > 0.06) { const L = MUZ.rail - 1.5, gx = cx + ca * L, gy = cy + sa * L;
          b.strokeStyle = hexA(c, 0.25 + 0.4 * q); b.lineWidth = 1; b.beginPath(); b.moveTo(cx + ca * 3, cy + sa * 3); b.lineTo(gx, gy); b.stroke();
          D(b, gx, gy, 1 + Math.round(q * 1.5), hexA(c, 0.35 + 0.55 * q)); if (q > 0.7) P(b, gx, gy, '#ffffff'); }
        break; }
      case 'snare': if (t.s && (t.caught || 0) >= t.s.catches) { R(b, cx - 1, cy - 1, 2, 2, frame % 20 < 10 ? '#ff4d6a' : '#5a1020'); } break;
      case 'forge': if (frame % 9 === 0) parts.push({ x: cx + 5, y: cy - 6, vx: (Math.random() - 0.5) * 3, vy: -9, life: 0.9, max: 0.9, col: '#5a5470', s: 2 }); break;
      case 'lens': { const k = Math.min(1, (t.ramp || 0) / 3.5); if (k > 0.05) D(b, cx, cy, 1 + Math.round(k * 2), hexA('#ffffff', 0.4 + 0.5 * k)); break; }
    }
    if (t.asc) { b.strokeStyle = hexA(lvTier(towerLevel(t)).col, 0.55 + 0.3 * Math.sin(frame / 8)); b.lineWidth = 1; b.strokeRect(X + 0.5, Y + 0.5, 23, 23); }
    if (G.mastery && G.mastery[t.type] >= 3) { const g = '#ffd84a'; R(b, X + 1, Y + 21, 4, 1, g); R(b, X + 1, Y + 18, 1, 3, g); R(b, X + 19, Y + 21, 4, 1, g); R(b, X + 22, Y + 18, 1, 3, g); } // v5.8 Mastery 3: gold trim on the base corners
    // v4.7: the level now reads as a numbered badge in the overlay (drawn crisp at any zoom), see the v4.8 badge pass
    let best = -1; for (const a of t.affixes) if (a.tier < 4 && a.tier > best) best = a.tier;
    if (best >= 1) { R(b, X + 18, Y + 2, 4, 4, '#090b16'); R(b, X + 19, Y + 3, 2, 2, RARITY[best].col); }
    if (t.affixes.some(a => a.tier === 4)) R(b, X + 18, Y + 7, 2, 2, RARITY[4].col);
    if (t.rank) {
      const sc = t.pending ? (frame % 16 < 8 ? '#ffffff' : PAL.warn) : PAL.warn;
      R(b, X + 4, Y + 1, 1, 7, '#090b16'); R(b, X + 1, Y + 4, 7, 1, '#090b16');
      R(b, X + 4, Y + 2, 1, 5, sc); R(b, X + 2, Y + 4, 5, 1, sc); P(b, X + 4, Y + 4, '#ffffff');
    }
    if (t.disabled > 0) for (let i = 0; i < 14; i++) R(b, X + 2 + Math.random() * 19, Y + 2 + Math.random() * 19, 2, 1, i % 2 ? '#ffffff' : '#5a5a7a');
    if (G.mods.ks.circuit && t.wires && t.wires.length) { for (const o of t.wires) if (o.id > t.id || (o.id === undefined && o.x + o.y * 1000 > t.x + t.y * 1000)) { const live = t.chain && t.chain.m.length >= 4; b.strokeStyle = live ? (frame % 20 < 10 ? 'rgba(255,225,77,0.85)' : 'rgba(255,240,170,0.6)') : 'rgba(255,225,77,0.4)'; b.lineWidth = 1; b.beginPath(); b.moveTo(X + 12, Y + 12); b.lineTo(o.x * TILE + 12, o.y * TILE + 12); b.stroke(); } }
    if (t.hot && G.mods.ks.wildfire && frame % 6 < 4) { for (let k = 0; k < 3; k++) { const hx = X + 5 + ((frame >> 2) * 7 + k * 6) % 14, hy = Y + 2 - ((frame + k * 5) % 8); P(b, hx, hy, k % 2 ? '#ff9a3c' : '#ffd28a'); } }
    if (G.mods.ks.marksman && t.s && SIGHTED[TOWERS[t.type].kind] && t.aimT !== undefined && G.time - t.aimT < 0.7 && t.angle !== undefined) { const L = (t.effRange || t.s.range || 2) * TILE; b.strokeStyle = 'rgba(255,77,106,0.35)'; b.lineWidth = 1; b.beginPath(); b.moveTo(X + 12, Y + 12); b.lineTo(X + 12 + Math.cos(t.angle) * L, Y + 12 + Math.sin(t.angle) * L); b.stroke(); P(b, Math.round(X + 12 + Math.cos(t.angle) * L), Math.round(Y + 12 + Math.sin(t.angle) * L), '#ff4d6a'); }
    if (G.wave > 1 && idleWaves(t) >= 2) { // sleeping: two little pixel Zs drift up from the corner
      const zc = '#9fb3c8';
      for (let k = 0; k < 2; k++) { const ph = ((frame >> 2) + k * 12) % 24, zx = X + 1 + k * 4, zy = Y + 6 - (ph >> 2) - k * 3; if (ph > 20) continue; R(b, zx, zy, 3, 1, zc); R(b, zx + 1, zy + 1, 1, 1, zc); R(b, zx, zy + 2, 3, 1, zc); }
    }
    if (t.oc) for (let i = 0; i < t.oc; i++) { const bx = X + 18 - i * 5, by = Y + 1, c = frame % 16 < 8 ? '#59f0b4' : '#e6fff6'; R(b, bx + 1, by, 2, 3, c); R(b, bx, by + 2, 3, 1, c); R(b, bx + 1, by + 3, 2, 3, c); }
  }
  // v5.8: what a shot leaves behind at the tower (render-only, Math.random): a missile launch puff, an EMP smoke ring
  function towerFired(t, cx, cy, c) {
    t._ft = rt; if (t.type === 'pulse' && t.spec === 1) t._gb = !t._gb;
    if (LITE) return;
    const ca = Math.cos(t.angle || 0), sa = Math.sin(t.angle || 0);
    if (t.type === 'missile') {
      for (let k = 0; k < 4; k++) parts.push({ x: cx + ca * 4 + (Math.random() - 0.5) * 6, y: cy + sa * 4 + (Math.random() - 0.5) * 6, vx: -ca * 10 + (Math.random() - 0.5) * 8, vy: -sa * 10 + (Math.random() - 0.5) * 8 - 3, life: 0.45, max: 0.45, col: '#8a8494', s: 2.5, smoke: 1 });
      stars.push({ x: cx + ca * 5, y: cy + sa * 5, life: 0.05, max: 0.05, col: '#fff2c0', s: 2, disc: 1 });
    } else if (t.type === 'emp') {
      const mx = cx + ca * 9, my = cy + sa * 9;
      rings.push({ x: mx, y: my, r0: 2, r1: 7, life: 0.4, max: 0.4, col: '#a8a894', w: 1.5, a: 0.7, nl: 1 });
      for (let k = 0; k < 2; k++) parts.push({ x: mx, y: my, vx: ca * 8 + (Math.random() - 0.5) * 6, vy: sa * 8 - 4, life: 0.5, max: 0.5, col: '#7a7a6a', s: 2.5, smoke: 1 });
    }
  }
  // v5.8 per-type muzzle flashes (about 3 frames): element colour around a white core. Pulse a cross star (one per Twin barrel,
  // alternating Gatling barrels), Rail a hard line, Flame a cone lick, EMP and Missile a hot disc. Ascended towers flash bigger
  function muzzle(t, x, y, ca, sa, c, age) {
    const L = MUZ[t.type] || 11, mx = x + ca * L, my = y + sa * L, big = t.asc ? 1 : 0, f = age < 0.03 ? 1 : 0.6;
    switch (t.type) {
      case 'pulse': {
        const offs = t.spec === 2 ? [-2.8, 2.8] : t.spec === 1 ? [t._gb ? 1.2 : -1.2] : [0], s2 = (t.spec === 1 ? 3 : 4) + big, col = hexA(c, f);
        for (const o of offs) { const px = mx - sa * o, py = my + ca * o; R(b, px - s2, py, s2 * 2 + 1, 1, col); R(b, px, py - s2, 1, s2 * 2 + 1, col); R(b, px - 0.5, py - 0.5, 2, 2, '#ffffff'); }
        break; }
      case 'rail': {
        const L2 = 8 + big * 2;
        b.strokeStyle = hexA(c, f); b.lineWidth = 2.5; b.beginPath(); b.moveTo(mx, my); b.lineTo(mx + ca * L2, my + sa * L2); b.stroke();
        b.strokeStyle = '#ffffff'; b.lineWidth = 1; b.beginPath(); b.moveTo(mx, my); b.lineTo(mx + ca * (L2 - 2), my + sa * (L2 - 2)); b.moveTo(mx - sa * 3, my + ca * 3); b.lineTo(mx + sa * 3, my - ca * 3); b.stroke();
        break; }
      case 'flame': {
        const pl = t.spec === 2, L2 = 6 + big, cw = Math.cos(0.45), sw = Math.sin(0.45);
        b.fillStyle = hexA(pl ? '#9fe8ff' : t.spec === 1 ? '#ff7a2a' : '#ffb03a', 0.85 * f); b.beginPath(); b.moveTo(mx, my);
        b.lineTo(mx + (ca * cw - sa * sw) * L2, my + (sa * cw + ca * sw) * L2); b.lineTo(mx + (ca * cw + sa * sw) * L2, my + (sa * cw - ca * sw) * L2); b.closePath(); b.fill();
        D(b, mx + ca, my + sa, 1 + big, pl ? '#ffffff' : '#fff3b0');
        break; }
      case 'emp': D(b, mx, my, 2 + big, hexA(c, f)); D(b, mx, my, 1, '#ffffff'); break;
      case 'missile': D(b, mx, my, 1 + big, hexA('#fff2c0', f)); break;
    }
  }
  // wormhole: swirling portal at a lane's origin. Forming portals are small and unstable; open ones are full size.
  function drawWormhole(L) {
    const p0 = L.tiles[0], X = (p0.x + 0.5) * TILE, Y = (p0.y + 0.5) * TILE;
    const pending = !!L.openWave, waves = pending ? L.openWave - G.wave : 0;
    let sc = pending ? (waves >= 2 ? 0.45 : 0.7) : 1;
    if (pending && frame % 40 < 4) sc *= 0.8;
    const rot = frame / (pending ? 30 : 18);
    if (pending) {
      // the future route: dashes marching from the portal toward where it joins
      const n = L.branch || L.tiles.length;
      for (let j = (frame >> 2) % 4; j < n; j += 4) { const q = L.tiles[j]; R(b, q.x * TILE + 10, q.y * TILE + 10, 4, 4, hexA('#b86cff', 0.55)); }
    }
    const rO = Math.round(12 * sc);
    D(b, X, Y, rO + 2, 'rgba(5,3,12,0.55)');
    for (let a = 0; a < 3; a++) for (let k = 0; k < 18; k++) {
      const rr = rO * (1 - k / 20), an = rot * (a % 2 ? -1 : 1) + a * 2.094 + k * 0.32;
      const col = k < 6 ? '#ff4d6a' : k < 12 ? '#b86cff' : '#e9d8ff';
      R(b, X + Math.cos(an) * rr - 1, Y + Math.sin(an) * rr - 1, 2, 2, hexA(col, 0.25 + 0.6 * k / 18));
    }
    for (let k = 0; k < 16; k++) { const an = -rot * 1.6 + k * 0.3927; if (k % 2) P(b, X + Math.cos(an) * rO, Y + Math.sin(an) * rO, pending ? '#b86cff' : '#ff4d6a'); }
    D(b, X, Y, Math.max(2, Math.round(4 * sc)), '#05030a');
    if (frame % 9 < 2) P(b, X, Y, '#ffffff');
    if (frame % (pending ? 6 : 3) === 0) {
      const an = Math.random() * 6.283, rr = rO * 1.6;
      parts.push({ x: X + Math.cos(an) * rr, y: Y + Math.sin(an) * rr, vx: -Math.cos(an) * rr * 2.4, vy: -Math.sin(an) * rr * 2.4, life: 0.4, max: 0.4, col: pending ? '#b86cff' : '#ff86b0', s: 2 });
    }
  }
  let coreKick = 0;
  function drawCore() {
    // Frontier: in flight the core rises off the ground (its shadow stays below, thrusters flare); docked, the tower's turret
    // sits on the drum in place of the core gun, ringed in its element's colour
    const F = G.fr && G.frFly, dock = G.fr && !F ? frDockT() : null;
    if (F) {
      const k = clamp(F.t / F.dur, 0, 1), h = 6 + Math.sin(k * Math.PI) * 10;
      b.fillStyle = 'rgba(2,3,10,0.35)'; b.beginPath(); b.ellipse(G.core.x * TILE + 3, G.core.y * TILE + 6, 20, 15, 0, 0, 6.283); b.fill();
      b.save(); b.translate(0, -h);
      for (let i = 0; i < 3; i++) { const a = i * 2.094 + frame / 9; parts.push({ x: G.core.x * TILE + Math.cos(a) * 14, y: G.core.y * TILE + Math.sin(a) * 10 + 8, vx: (Math.random() - 0.5) * 20, vy: 50 + Math.random() * 40, life: 0.25, max: 0.25, col: i ? '#59f0b4' : '#e6fff6', s: 2 }); }
      drawCore0(null); b.restore(); return;
    }
    drawCore0(dock);
  }
  function drawCore0(dock) {
    const c = G.core, X = c.x * TILE, Y = c.y * TILE, pulse = (Math.sin(frame / 10) + 1) / 2;
    b.fillStyle = 'rgba(2,3,10,0.45)'; b.beginPath(); b.ellipse(X + 2, Y + 4, 25, 22, 0, 0, 6.283); b.fill();
    const hurt = c.hp / c.max < 0.35 && frame % 30 < 15;
    const kick = coreKick; coreKick = Math.max(0, coreKick - 0.06); // a hit makes the reactor flinch and flare red
    blit(UNITS.core(frame / 70, hurt || kick > 0.35), X, Y, 1 - 0.07 * kick * Math.sin(kick * 9));
    D(b, X, Y, 1 + Math.round(pulse * 2), hexA('#ffffff', 0.35 + 0.4 * pulse));
    const el = c.s ? c.s.el : c.el, a = c.angle || 0;
    if (dock) { const dc = EL[dock.s.el].col; b.strokeStyle = hexA(dc, 0.55 + 0.3 * pulse); b.lineWidth = 2; b.beginPath(); b.arc(X, Y, 19, 0, 6.283); b.stroke(); drawTower0(dock, true); }
    else blit(UNITS.coreGun(el, a), X, Y);
    { const wt = typeof warTier === 'function' ? warTier() : 0; // War Economy: a turret per stack of banked credits
      for (let k = 0; k < wt; k++) { const a2 = k / wt * 6.283 - frame / 120, tx = X + Math.cos(a2) * 30, ty = Y + Math.sin(a2) * 30; R(b, tx - 3, ty - 3, 6, 6, '#071812'); R(b, tx - 2, ty - 2, 4, 4, '#59f0b4'); const aa = c.angle || 0; R(b, Math.round(tx + Math.cos(aa) * 3) - 1, Math.round(ty + Math.sin(aa) * 3) - 1, 2, 2, '#e6fff6'); } }
    if (c.shield > 1) { b.strokeStyle = hexA('#7fd4ff', 0.25 + 0.5 * (c.shield / Math.max(1, c.smax))); b.lineWidth = 2; b.beginPath(); b.arc(X, Y, 28, 0, 6.283); b.stroke(); }
    if (c.hp / c.max < 0.35 && frame % 20 < 10) { b.strokeStyle = PAL.bad; b.lineWidth = 1.5; b.beginPath(); b.arc(X, Y, 25, 0, 6.283); b.stroke(); }
  }
  function drawEnemy(e) {
    const X = e.x * TILE, Y = e.y * TILE, st = e.st;
    const cloaked = e.cloaked && !(e.revealed > 0);
    const bob = e.fly ? Math.round(Math.sin(frame / 6 + e.wob) * 1.5) : (e.boss ? 0 : (((frame >> 3) + ((e.wob * 10) | 0)) & 1) && !(e.st.frozen > 0) && !(e.st.stun > 0) ? -1 : 0);
    const y = Y - (e.fly ? 7 : 0) + bob;
    let s;
    if (e.boss === 'worm') {
      if (e.burrowT > 0) { // only the wormhole shows while it's under
        const k = (frame % 30) / 30; b.strokeStyle = hexA('#c46cff', 0.8 - k * 0.6); b.lineWidth = 2; b.beginPath(); b.arc(X, Y, 6 + k * 14, 0, 6.283); b.stroke();
        b.fillStyle = 'rgba(10,0,20,0.85)'; b.beginPath(); b.arc(X, Y, 9, 0, 6.283); b.fill(); return;
      }
      const sg = UNITS.wormSeg(), o = {};
      for (let k = 7; k >= 1; k--) { const dd = e.d - k * 0.42; if (dd < 0) continue; lanePos(e.L, dd, o); const wig = Math.sin(frame / 4 + k) * 1.5;
        blit(sg, o.x * TILE, o.y * TILE + wig, 1 - k * 0.03); }
    }
    // heading and gait: units face where they are going; legs cycle with distance walked, wings with time
    if (e._hx === undefined) { e._hx = e.x; e._hy = e.y; e._ha = e.L && e.L.pts && e.L.pts[1] ? Math.atan2(e.L.pts[1].y - e.L.pts[0].y, e.L.pts[1].x - e.L.pts[0].x) : 0; e._wd = 0; }
    { const mx = e.x - e._hx, my = e.y - e._hy, md = Math.hypot(mx, my);
      if (md > 0.02) { const ta = Math.atan2(my, mx); let da = ta - e._ha; da = Math.atan2(Math.sin(da), Math.cos(da)); e._ha += da * Math.min(1, md * 6); e._wd += md; e._hx = e.x; e._hy = e.y; } }
    let k = 1, hiS = null;
    if (e.pirate) hiS = UNITS.pirate(false);
    else if (!e.boss && !e.meat) hiS = UNITS.enemy(e.type, e._ha, e.fly ? (frame >> 2) + (e.wob * 4 | 0) : Math.floor(e._wd * 9));
    if (hiS) s = hiS;
    else if (e.boss) s = UNITS.boss(e.boss, (frame >> 4) + (e.id & 1), e.boss === 'cat' && e.napT > 0) || scaledSpr('B:' + e.boss, bossSprite(e.boss), BOSS_SCALE);
    else if (e.meat) s = UNITS.meat(); else s = enemySprite(e.type);
    if (e.wanted === 'colossal') k *= 1.5;
    if (e.gen) k *= e.gen === 1 ? 0.67 : 0.45;
    if (e.genes && e.genes.includes('bulk')) k *= 1.3;
    if (e.mite) k *= 0.7;
    if (!e.boss) k *= EN_K; // v4.8: units a size up so they read at phone zoom
    const elite = e.elite.length && !e.boss && !e.pirate, eCols = e.elite.length ? e.elite.map(id => ELITE_AFFIXES.find(a => a.id === id).col) : null;
    if (elite) k *= 1.22; // v4.7: elites stand a size up from their kin
    const su = (s.u || 1) * k, sw = s.width * su, hw = sw / 2, hh = s.height * su / 2;
    b.fillStyle = e.fly ? 'rgba(0,0,0,0.3)' : 'rgba(2,3,10,0.4)';
    b.beginPath(); b.ellipse(X + 1, e.fly ? Y + 4 : y + hh * 0.55, hw * 0.75, Math.max(1.5, hh * (e.fly ? 0.25 : 0.4)), 0, 0, 6.283); b.fill();
    if (elite && !cloaked) {
      // v4.7 elite read: a turning sigil on the ground in the affix colour, then a glowing rim around the body
      const gy = e.fly ? Y + 4 : y + hh * 0.55, rx = hw * 1.05 + 3, ry = Math.max(3, rx * 0.42), rot = frame / 40;
      b.fillStyle = hexA(eCols[0], 0.16 + 0.06 * Math.sin(frame / 6)); b.beginPath(); b.ellipse(X, gy, rx, ry, 0, 0, 6.283); b.fill();
      b.strokeStyle = hexA(eCols[0], 0.8); b.lineWidth = 1.5; b.beginPath(); b.ellipse(X, gy, rx, ry, 0, 0, 6.283); b.stroke();
      b.fillStyle = eCols[0]; for (let i = 0; i < 6; i++) { const a = rot + i * 1.0472; b.fillRect(X + Math.cos(a) * rx - 1, gy + Math.sin(a) * ry - 1, 2, 2); }
      const rim = tintOf(s, eCols[0]), gw = sw * 1.2, gh = hh * 2 * 1.2;
      b.globalAlpha = 0.55 + 0.3 * Math.sin(frame / 5 + e.wob); b.drawImage(rim, Math.round((X - gw / 2) * RES) / RES, Math.round((y - gh / 2) * RES) / RES, gw, gh); b.globalAlpha = 1;
    }
    // v5.8: which genes get a mark (screen-space overlay pass), and an outline in the strain's colour on Strain Assault units
    const gm = e.genes && e.genes.length && !cloaked ? geneMarks(e) : null; e._gmOn = gm && gm.length ? gm : null; e._hw = hw;
    if (e.assault && !cloaked && G.assault) {
      const rim = tintOf(s, strainCol(G.assault.genes)), gw = sw + 3, gh = hh * 2 + 3;
      b.globalAlpha = 0.85; b.drawImage(rim, Math.round((X - gw / 2) * RES) / RES, Math.round((y - gh / 2) * RES) / RES, gw, gh); b.globalAlpha = 1;
    }
    if (cloaked) b.globalAlpha = 0.25;
    else if (e.cloak && e.cloakT < 0.6 && frame % 6 < 3) b.globalAlpha = 0.6; // v5.1 tell: it flickers just before it cloaks
    if (e.pirate) { const fl = e.L.pts[e.L.pts.length - 1].x < e.L.pts[0].x; b.save(); b.translate(Math.round(X), Math.round(y)); if (fl) b.scale(-1, 1); b.drawImage(s, -hw, -hh, sw, hh * 2); b.restore(); }
    else if (e.boss) { const fl = Math.cos(e._ha) < -0.3; b.save(); b.translate(Math.round(X * RES) / RES, Math.round(y * RES) / RES); if (fl && !e.burrowT) b.scale(-1, 1); b.drawImage(s, -hw, -hh, sw, hh * 2); b.restore(); }
    else b.drawImage(s, Math.round((X - hw) * RES) / RES, Math.round((y - hh) * RES) / RES, sw, hh * 2);
    if (e.stowaway) { R(b, X - 5, y - hh - 1, 10, 2, '#d8281a'); R(b, X + 5, y - hh - 1, 2, 1, '#d8281a'); P(b, X + 7, y - hh, '#d8281a'); }
    const ovl = col => { const tc = tintOf(s, col); if (e.boss && Math.cos(e._ha) < -0.3) { b.save(); b.translate(Math.round(X * RES) / RES, Math.round(y * RES) / RES); b.scale(-1, 1); b.drawImage(tc, -hw, -hh, sw, hh * 2); b.restore(); } else b.drawImage(tc, Math.round((X - hw) * RES) / RES, Math.round((y - hh) * RES) / RES, sw, hh * 2); };
    if (e.hitFlash > 0) { b.globalAlpha = cloaked ? 0.2 : e.boss ? 0.3 : 0.55; ovl('#ffffff'); }
    else if (st.frozen > 0) { b.globalAlpha = 0.6; ovl('#bff4ff'); }
    else if (st.chill > 0) { b.globalAlpha = 0.12 + st.chill * 0.06; ovl('#9ad8ff'); }
    if (gm) for (const g of gm) { // v5.8 body marks: Cloak dithers the body violet, Regrowth pulses it green
      if (g === 'cloak' && !e.boss) { b.globalAlpha = 0.8; b.drawImage(ditherOf(s, '#c58cff'), Math.round((X - hw) * RES) / RES, Math.round((y - hh) * RES) / RES, sw, hh * 2); }
      else if (g === 'regen' && !st.burn) { b.globalAlpha = 0.15 + 0.3 * (0.5 + 0.5 * Math.sin(frame / 5 + e.wob)); ovl('#59f0b4'); }
    }
    b.globalAlpha = 1;
    if (false) { const ox = Math.round(X - hw), oy = Math.round(y - hh); const q = v => Math.round(v * BOSS_SCALE); R(b, ox + q(16), oy + q(15), q(6), q(6), '#ff9a3c'); R(b, ox + q(27), oy + q(15), q(6), q(6), '#ff9a3c'); R(b, ox + q(16), oy + q(18), q(6), 2, '#3a1606'); R(b, ox + q(27), oy + q(18), q(6), 2, '#3a1606'); }
    if (e.boss === 'titan' && e.plates > 0) { const q = v => Math.round(v * BOSS_SCALE); const pl = (x, y, w, h) => { R(b, x, y, w, h, '#3a3f58'); R(b, x + 0.5, y + 0.5, w - 1, h - 1, '#6a7094'); b.fillStyle = '#9aa0c0'; b.fillRect(x + 0.5, y + 0.5, w - 1, 0.5); }; pl(X - q(22), y - q(22), q(44), q(5)); pl(X - q(22), y + q(17), q(44), q(5)); if (e.plates > 1) { pl(X - q(22), y - q(17), q(5), q(34)); pl(X + q(17), y - q(17), q(5), q(34)); } }
    if (e.type === 'shielder' && frame % 30 < 15) { b.strokeStyle = 'rgba(138,182,255,0.5)'; b.lineWidth = 1; b.beginPath(); b.arc(X, y, 11, 0, 6.283); b.stroke(); }
    if (e.phaseT > 0 && !cloaked) { const pr = hw + 5 + Math.sin(frame / 2) * 2; b.strokeStyle = hexA(BOSS_COL[e.boss] || '#ff3355', 0.5 + 0.4 * Math.sin(frame / 3)); b.lineWidth = 3; b.beginPath(); b.arc(X, y, pr, 0, 6.283); b.stroke(); b.strokeStyle = 'rgba(255,255,255,0.6)'; b.lineWidth = 1; b.beginPath(); b.arc(X, y, pr + 4, 0, 6.283); b.stroke(); }
    if (e.assault && !cloaked) { const ar = hw + 5; b.strokeStyle = hexA(G.assault ? strainCol(G.assault.genes) : '#ff4d6a', 0.55 + 0.35 * Math.sin(frame / 4 + e.wob)); b.lineWidth = 1; b.beginPath(); b.moveTo(X, y - ar); b.lineTo(X + ar, y); b.lineTo(X, y + ar); b.lineTo(X - ar, y); b.closePath(); b.stroke(); }
    if (e.wanted && !cloaked) { b.strokeStyle = hexA('#ffd84a', 0.6 + 0.35 * Math.sin(frame / 5)); b.lineWidth = 2; b.setLineDash([5, 4]); b.lineDashOffset = frame / 2; b.beginPath(); b.arc(X, y, hw + 8, 0, 6.283); b.stroke(); b.setLineDash([]); }
    if (cloaked) { // v5.1 tell: a heat-haze shimmer where a cloaked unit is
      b.strokeStyle = e.genes && e.genes.includes('cloak') ? 'rgba(197,140,255,0.45)' : 'rgba(214,210,255,0.35)'; b.lineWidth = 1; b.beginPath();
      for (let i = 0; i <= 16; i++) { const a = i / 16 * 6.283, rr = hw * 0.9 + Math.sin(a * 3 + frame / 4) * 1.5; i ? b.lineTo(X + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8) : b.moveTo(X + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8); }
      b.stroke();
    }
    if (e.type === 'reflector' && !cloaked && frame % 40 < 4) { b.fillStyle = 'rgba(255,255,255,0.8)'; b.fillRect(Math.round(X - hw * 0.4), Math.round(y - hh * 0.5), 2, 2); }
    if (e.shield > 0 && !cloaked && !(gm && gm.includes('shell'))) { b.strokeStyle = 'rgba(127,212,255,0.55)'; b.lineWidth = 1; b.beginPath(); b.arc(X, y, hw + 3, 0, 6.283); b.stroke(); }
    e._hh = hh; e._crown = elite && !cloaked ? eCols : null; // the crown is drawn in the overlay pass, above every unit
    if (false) {
    } else if (e.elite.length && !cloaked) {
      const ec = ELITE_AFFIXES.find(a => a.id === e.elite[0]).col, r = hw + 4;
      b.strokeStyle = hexA(ec, frame % 12 < 9 ? 0.9 : 0.4); b.lineWidth = 2; b.setLineDash([3, 3]); b.lineDashOffset = -frame / 2;
      b.beginPath(); b.arc(X, y, r, 0, 6.283); b.stroke(); b.setLineDash([]);
      R(b, X - 2, y - r - 5, 5, 3, ec); P(b, X - 2, y - r - 6, ec); P(b, X, y - r - 6, ec); P(b, X + 2, y - r - 6, ec);
    }
    // status pips
    if (st.burn && frame % 6 < 4) { R(b, X - 3 + (frame % 3) * 2, y - hh - 4, 2, 2, EL.T.col); P(b, X - 2 + (frame % 3) * 2, y - hh - 5, '#ffe14d'); }
    if (st.shock > 0 && frame % 5 < 3) { R(b, X + hw - 1, y - hh, 2, 2, EL.A.col); }
    for (let i = 0; i < Math.min(st.mark, 6); i++) R(b, X - 7 + i * 3, y + hh + 2, 2, 2, EL.V.col);
    if (!cloaked && (e.hp < e.maxHp || e.shield > 0) && !e.boss) {
      const w = Math.max(12, Math.round(sw)), hr = Math.max(0, e.hp / e.maxHp);
      if (elite) R(b, X - w / 2 - 1, y - hh - 5, w + 2, 4, '#ffd84a');
      R(b, X - w / 2, y - hh - 4, w, 2, '#2a0010'); R(b, X - w / 2, y - hh - 4, Math.max(1, Math.round(w * hr)), 2, hr > 0.5 ? '#ff7c9c' : '#ff3355');
      if (e.shield > 0) R(b, X - w / 2, y - hh - 6, Math.max(1, Math.round(w * Math.min(1, e.shield / e.maxHp))), 1, '#8ab6ff');
    }
  }
  function strokeRing(x, y, r, col, a, w, dash) {
    if (r <= 0) return;
    b.strokeStyle = hexA(col, a); b.lineWidth = w || 2;
    if (dash) { b.setLineDash(dash); b.lineDashOffset = -frame / 3; }
    b.beginPath(); b.arc(Math.round(x), Math.round(y), r, 0, 6.283); b.stroke();
    if (dash) b.setLineDash([]);
  }
  function fillRing(x, y, r, col, a) { if (r <= 0) return; b.fillStyle = hexA(col, a); b.beginPath(); b.arc(x, y, r, 0, 6.283); b.fill(); }
  // dithered discs (storms, ranges) cached per radius/colour/phase
  const discCache = new Map();
  // 6.2 the Nuke: chunky pixel puffs, pre-rendered once per colour stage (white-hot, yellow, orange, dark red, hot smoke, ash).
  // Lit from the top-left like the rest of the art, with a dithered rim; scaled with smoothing off so they stay blocky.
  const NUKE_RAMP = [['#ffffff', '#fffbe8', '#fff0b8'], ['#fff6b0', '#ffd84a', '#f0a428'], ['#ffc04a', '#ff8a2a', '#c8501a'], ['#e0602a', '#a8361a', '#6a2014'],
    ['#9a7a66', '#6e564a', '#43342f'], ['#77706c', '#55504f', '#36323a']];
  function nukeSprites() {
    if (nukeSpr) return nukeSpr;
    nukeSpr = NUKE_RAMP.map(([hi, mid, lo]) => {
      const R0 = 11, N = R0 * 2, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
      for (let y = 0; y < N; y += 2) for (let x = 0; x < N; x += 2) {
        const dx = x + 1 - R0, dy = y + 1 - R0, d = Math.hypot(dx, dy) / R0;
        if (d > 1 || (d > 0.8 && ((x + y) >> 1) % 2)) continue;
        const l = (-dx - dy) / (R0 * 1.41) * 0.65 + (1 - d) * 0.6;
        g.fillStyle = l > 0.5 ? hi : l > 0.1 ? mid : lo; g.fillRect(x, y, 2, 2);
      }
      return c;
    });
    return nukeSpr;
  }
  function startNuke(x, y, rr) {
    nukeSprites(); nuke = { x, y, t: 0, seed: Math.random() * 6.283, ash: 0 };
    flashes.push({ col: '#ffffff', life: 0.5, max: 0.5, a: 0.95 }); flashes.push({ col: '#ffc76a', life: 1.6, max: 1.6, a: 0.28 });
    const far = Math.max(rr, Math.hypot(BW, BH) / TILE) * TILE;
    rings.push({ x, y, r0: 8, r1: far, life: 1.5, max: 1.5, col: '#fff0c0', w: 4, a: 0.9 }); // the shockwave races across the board
    rings.push({ x, y, r0: 6, r1: far * 0.55, life: 1.9, max: 1.9, col: '#d08a4a', w: 7, fill: 1, a: 0.55, nl: 1 }); // a dust front behind it
    rings.push({ x, y, r0: 4, r1: TILE * 5, life: 0.5, max: 0.5, col: '#ffffff', w: 3, fill: 1 });
    for (let i = 0; i < (LITE ? 30 : 70); i++) { const a = Math.random() * 6.283, sp = 30 + Math.random() * 110;
      parts.push({ x: x + Math.cos(a) * 6, y: y + Math.sin(a) * 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 40 - Math.random() * 50, g: 45, life: 1.2 + Math.random() * 1.4, max: 2.6, col: ['#ffffff', '#ffe14d', '#ffb03a', '#ff7b29'][i % 4], s: 2 }); }
    shakeAt(16, 1.1);
  }
  // one frame of the detonation in the world buffer (about 3.3 s): fireball, stem, rolling cap, then ash and embers
  function drawNuke(dt) {
    const N = nuke; N.t += dt; const t = N.t, T = 3.3;
    if (t > T) { nuke = null; return; }
    const S = nukeSpr, cl = (v, a, z) => v < a ? a : v > z ? z : v, eo = v => 1 - (1 - v) * (1 - v);
    const pf = (st, x, y, r, a) => { if (a <= 0.02 || r < 1) return; b.globalAlpha = a > 1 ? 1 : a; const q = Math.round(r * RES) / RES; b.drawImage(S[cl(st | 0, 0, 5)], Math.round((x - q) * RES) / RES, Math.round((y - q) * RES) / RES, q * 2, q * 2); };
    const X = N.x, Y = N.y, fade = 1 - cl((t - 2.5) / 0.8, 0, 1);
    // fireball: swells fast, then cools white → yellow → orange → dark red and sinks into the stem's foot
    const fr = TILE * (0.45 + 1.35 * eo(cl(t / 0.45, 0, 1)) + 0.25 * cl(t / 2, 0, 1)), fst = cl(t / 0.42, 0, 3.6), fa = 1 - cl((t - 1.5) / 1, 0, 1);
    for (let i = 0; i < 6; i++) { const a = N.seed + i * 1.047 + t * 0.7; pf(fst + 0.6, X + Math.cos(a) * fr * 0.55, Y + Math.sin(a) * fr * 0.3, fr * 0.55, fa); }
    pf(fst, X, Y - fr * 0.1, fr * 0.8, fa);
    // stem: a column of puffs rising from the blast, hotter at the top while it climbs
    const rise = eo(cl((t - 0.2) / 1.5, 0, 1)), top = Y - TILE * (0.6 + 3.6 * rise), cst = cl(1 + t / 0.75, 1, 5);
    if (t > 0.2) for (let yy = Y - TILE * 0.3, k = 0; yy > top + TILE * 0.3; yy -= TILE * 0.32, k++) {
      const u = (Y - yy) / Math.max(1, Y - top), w = TILE * (0.34 + 0.12 * Math.sin(k * 1.7 + t * 3)) * (0.8 + 0.4 * u);
      pf(cst + 0.6 - u * 0.8, X + Math.sin(k * 0.9 + t * 2.2) * TILE * 0.08, yy, w, fade * (0.92 - 0.15 * u));
    }
    // cap: a rolling ring of puffs around a domed core; the back half first (darker), the underside glows while it is hot
    if (t > 0.3) {
      const g = eo(cl((t - 0.3) / 1.6, 0, 1)), rx = TILE * (0.55 + 1.25 * g), ry = rx * 0.42, pr = TILE * (0.4 + 0.42 * g), ph = N.seed + t * 1.5, n = 10;
      const ring = []; for (let i = 0; i < n; i++) { const a = ph + i * 6.283 / n; ring.push({ a, x: X + Math.cos(a) * rx, y: top + Math.sin(a) * ry }); }
      for (const q of ring) if (Math.sin(q.a) < 0) pf(cst + 0.9, q.x, q.y, pr, fade);
      pf(cst + 0.3, X, top - ry * 0.8, pr * 1.55, fade); pf(cst, X - rx * 0.35, top - ry * 1.3, pr * 1.05, fade); pf(cst, X + rx * 0.3, top - ry * 1.5, pr * 0.95, fade);
      for (const q of ring) if (Math.sin(q.a) >= 0) pf(cst - 0.5 * (1 - cl((t - 1) / 1.2, 0, 1)), q.x, q.y, pr, fade);
    }
    b.globalAlpha = 1;
    // ash drifts down off the cap; embers lift off the stem
    if (!LITE && t > 0.5 && t < 2.9) { N.ash += dt * 26; while (N.ash >= 1) { N.ash--;
      const rx = TILE * 1.6, ax = X + (Math.random() - 0.5) * rx * 2;
      if (Math.random() < 0.6) parts.push({ x: ax, y: top + (Math.random() - 0.3) * TILE * 0.6, vx: 6 + Math.random() * 10, vy: 6 + Math.random() * 10, life: 1.6, max: 1.6, col: Math.random() < 0.5 ? '#8a8486' : '#5e585c', s: 2 });
      else parts.push({ x: X + (Math.random() - 0.5) * TILE * 0.6, y: Y - Math.random() * (Y - top), vx: (Math.random() - 0.5) * 14, vy: -18 - Math.random() * 16, life: 0.9, max: 0.9, col: Math.random() < 0.5 ? '#ffb03a' : '#ff7b29', s: 1.5 }); } }
  }
  function ditherDisc(cx, cy, r, col, dither, phase) {
    const R0 = Math.max(1, Math.round(r)), key = R0 + col + dither + ':' + (phase % dither);
    let c = discCache.get(key);
    if (!c) {
      if (discCache.size > 120) discCache.clear();
      c = document.createElement('canvas'); c.width = c.height = R0 * 2 + 1;
      const g = c.getContext('2d'); g.fillStyle = col;
      for (let y = 0; y <= R0 * 2; y++) for (let x = 0; x <= R0 * 2; x++) {
        if ((x - R0) * (x - R0) + (y - R0) * (y - R0) > R0 * R0) continue;
        if (((x >> 1) + (y >> 1) + phase) % dither !== 0) continue;
        g.fillRect(x, y, 1, 1);
      }
      discCache.set(key, c);
    }
    b.drawImage(c, Math.round(cx) - R0, Math.round(cy) - R0);
  }

  // ---------- camera ----------
  // RES: buffer pixels per world unit. Sprites authored at RES (hi-res) land 1:1; classic 1× art lands as clean 2×2 blocks.
  // The buffer only covers what the camera sees, so its cost tracks the view, not the map.
  // Zoom 1 fits the current sector; zooming out below 1 reveals the whole map (unrevealed ground is veiled).
  const MARGIN = TILE * 1.5;
  let atHome = true;
  function fit() { const rw = reg.w || BW, rh = reg.h || BH; scale = Math.min(W / rw, H / rh); ox = 0; oy = 0; }
  function zMin() { return Math.min(1, Math.min(W / (BW + 2 * MARGIN), H / (BH + 2 * MARGIN)) / scale); }
  function view() {
    const ws = scale * cam.z, vw = W / ws, vh = H / ws, bx0 = -MARGIN, by0 = -MARGIN, bx1 = BW + MARGIN, by1 = BH + MARGIN;
    const vx = vw >= bx1 - bx0 ? (bx0 + bx1 - vw) / 2 : clamp(cam.x - vw / 2, bx0, bx1 - vw);
    const vy = vh >= by1 - by0 ? (by0 + by1 - vh) / 2 : clamp(cam.y - vh / 2, by0, by1 - vh);
    return { vx, vy, vw, vh, ws };
  }
  // v4.8 home view: zoom 1 fits the sector, but on a phone that leaves tiles ~13 px. Home instead guarantees MIN_TILE screen px per
  // tile and frames the sector around the core (the core always stays in view); pinch out or the Map button shows everything.
  const MIN_TILE = 22;
  const homeZ = () => Math.max(1, MIN_TILE / (TILE * scale));
  function homeAim() {
    const z = homeZ(), vw = W / (scale * z), vh = H / (scale * z), m = TILE * 3.5, cx = reg.x + reg.w / 2, cy = reg.y + reg.h / 2;
    if (!G || !G.core) return { x: cx, y: cy };
    const kx = G.core.x * TILE, ky = G.core.y * TILE;
    return { x: vw - 2 * m > 0 ? clamp(cx, kx - vw / 2 + m, kx + vw / 2 - m) : kx, y: vh - 2 * m > 0 ? clamp(cy, ky - vh / 2 + m, ky + vh / 2 - m) : ky };
  }
  function goHome() { cam.z = homeZ(); const a = homeAim(); cam.x = a.x; cam.y = a.y; clampCam(); }
  function resetCam() { goHome(); atHome = true; }
  function overview() { cam.z = 1; cam.x = reg.x + reg.w / 2; cam.y = reg.y + reg.h / 2; clampCam(); atHome = false; }
  // follow G.region: snap on a new run, otherwise pull the camera back over a few seconds
  const easeIO = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function updateRegion() {
    const R = G.region || { x0: 0, y0: 0, x1: COLS, y1: ROWS };
    const T = { x: R.x0 * TILE, y: R.y0 * TILE, w: (R.x1 - R.x0) * TILE, h: (R.y1 - R.y0) * TILE };
    const key = T.x + ',' + T.y + ',' + T.w + ',' + T.h, now = performance.now();
    if (G !== regG || !reg.w) { regG = G; regKey = key; Object.assign(reg, T); regAnim = null; frontier = null; fit(); resetCam(); }
    else if (key !== regKey) {
      regKey = key;
      frontier = { x: reg.x, y: reg.y, w: reg.w, h: reg.h, t0: now };
      regAnim = { from: { x: reg.x, y: reg.y, w: reg.w, h: reg.h }, to: T, t0: now, dur: 2600 };
      const was = !atHome; atHome = true;
      if (was && onCam) onCam();
    }
    if (regAnim) {
      const k = Math.min(1, (now - regAnim.t0) / regAnim.dur), e = easeIO(k), A = regAnim.from, B = regAnim.to;
      reg.x = A.x + (B.x - A.x) * e; reg.y = A.y + (B.y - A.y) * e; reg.w = A.w + (B.w - A.w) * e; reg.h = A.h + (B.h - A.h) * e;
      if (k >= 1) { Object.assign(reg, B); regAnim = null; }
    }
    fit();
    if (atHome) goHome();
  }
  function clampCam() { const v = view(); cam.x = v.vx + v.vw / 2; cam.y = v.vy + v.vh / 2; }
  function screenToBuf(sx, sy) { const v = view(); return { x: v.vx + sx / v.ws, y: v.vy + sy / v.ws }; }
  function screenToTile(sx, sy) { const p = screenToBuf(sx, sy); return { x: p.x / TILE, y: p.y / TILE }; }
  function tileToScreen(x, y) { const v = view(); return { x: (x * TILE - v.vx) * v.ws, y: (y * TILE - v.vy) * v.ws }; }
  function zoomAt(sx, sy, factor) {
    const before = screenToBuf(sx, sy);
    cam.z = clamp(cam.z * factor, zMin(), 4);
    const ws = scale * cam.z;
    // keep the point under the fingers fixed
    cam.x = before.x - sx / ws + W / ws / 2; cam.y = before.y - sy / ws + H / ws / 2; clampCam();
    atHome = false;
  }
  function panBy(dx, dy) { const ws = scale * cam.z; cam.x -= dx / ws; cam.y -= dy / ws; clampCam(); atHome = false; }

  // ---------- frame ----------
  function draw(dt) {
    frame++; rt += dt;
    ART.frameStart(); ART.idle(dt > 0 ? 3 : 1.5);
    const c = ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = PAL.bg; c.fillRect(0, 0, cv.width, cv.height);
    if (!G) return;
    LITE = parts.length > 600 || G.speed > 2;
    updateRegion();
    ensureBuffers();
    const key = G.seed + ':' + G.map.lanes.length + ':' + COLS + ':' + (G.mapRev || 0);
    if (key !== mapKey) { mapKey = key; mapDirty = true; }
    if (mapDirty) drawMap();
    const v = view();
    const vxI = Math.floor(v.vx), vyI = Math.floor(v.vy), vwI = Math.ceil(v.vw) + 2, vhI = Math.ceil(v.vh) + 2;
    const bw = vwI * RES, bh = vhI * RES;
    sizeBuf(bw, bh);
    b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, bw, bh); b.imageSmoothingEnabled = false;
    b.setTransform(RES, 0, 0, RES, -vxI * RES, -vyI * RES);
    { const x0 = Math.max(0, vxI), y0 = Math.max(0, vyI), x1 = Math.min(BW, vxI + vwI), y1 = Math.min(BH, vyI + vhI);
      if (x1 > x0 && y1 > y0) b.drawImage(mapLayer, x0 * RES, y0 * RES, (x1 - x0) * RES, (y1 - y0) * RES, x0, y0, x1 - x0, y1 - y0); }
    drawVeil();
    // animated path glow running toward the core
    if (frame % 2 === 0) for (const L of G.map.lanes) if (!L.openWave) { const k = (frame >> 1) % L.tiles.length; for (let j = k; j < L.tiles.length; j += 9) { const p = L.tiles[j]; R(b, p.x * TILE + 11, p.y * TILE + 11, 2, 2, 'rgba(184,108,255,0.35)'); } }
    if (G.rift && !G.spawningDone) { const p = G.rift.pts[0]; strokeRing(p.x * TILE, p.y * TILE, 9 + Math.sin(frame / 5) * 2, '#b86cff', 0.9, 2); strokeRing(p.x * TILE, p.y * TILE, 5 + Math.sin(frame / 3), '#ff4d6a', 0.9, 2); }
    if (G.spawningDone && G.prep && G.prep.fly) for (const L of G.map.lanes) if (!L.openWave) {
      const a = L.fly.pts[0], c2 = L.fly.pts[1];
      b.strokeStyle = 'rgba(255,134,176,0.55)'; b.lineWidth = 2; b.setLineDash([4, 6]); b.lineDashOffset = -frame / 2;
      b.beginPath(); b.moveTo(a.x * TILE, a.y * TILE); b.lineTo(c2.x * TILE, c2.y * TILE); b.stroke(); b.setLineDash([]);
    }
    for (const s of G.storms) {
      const col = s.mael ? '#ff4d6a' : STORMS[s.types[(frame >> 5) % s.types.length]].col;
      ditherDisc(s.x * TILE, s.y * TILE, s.r * TILE, hexA(col, s.mael ? 0.2 : 0.14), s.mael ? 2 : 3, (frame >> 3) % 3);
      const arms = s.mael ? 5 : 3;
      for (let a = 0; a < arms; a++) for (let k = 0; k < 26; k++) {
        const rr = s.r * TILE * k / 26, an = s.rot + a * 6.283 / arms + k * 0.22;
        R(b, s.x * TILE + Math.cos(an) * rr, s.y * TILE + Math.sin(an) * rr, 2, 2, hexA(s.mael ? (k % 2 ? '#b86cff' : '#ff4d6a') : col, 0.5 * (1 - k / 30)));
      }
      strokeRing(s.x * TILE, s.y * TILE, s.r * TILE, col, 0.35, 1, [2, 6]);
    }
    for (const z of G.zones) { ditherDisc(z.x * TILE, z.y * TILE, z.r * TILE, hexA('#ff7b39', 0.4), 2, frame % 2);
      // v5.8 Napalm Payload: flame tongues lick up out of the burning ground
      if (z.k === 'napalm' && !LITE && frame % 5 === 0) parts.push({ x: z.x * TILE + (Math.random() - 0.5) * z.r * TILE * 1.4, y: z.y * TILE + (Math.random() - 0.5) * z.r * TILE, vx: (Math.random() - 0.5) * 4, vy: -16 - Math.random() * 10, life: 0.4, max: 0.4, fl: 2, s: 1.5 }); }
    for (const L of G.map.lanes) drawWormhole(L);
    const wfA = G.fr && wormFlashAt ? Math.max(0, Math.min(1, (2.5 - (performance.now() - wormFlashAt) / 1000) / 0.8)) : 0; // shown for 2.5 s after a refused build, fading over the last 0.8 s
    if (wfA > 0) for (const L of G.map.lanes) { const p0 = L.tiles[0]; const X = (p0.x + 0.5) * TILE, Y = (p0.y + 0.5) * TILE, r = (FRONTIER.wormBuild - 0.5) * TILE; ditherDisc(X, Y, r, hexA('#ff4d6a', (L.openWave ? 0.1 : 0.16) * wfA), 3, 0); strokeRing(X, Y, r, '#ff4d6a', (L.openWave ? 0.4 : 0.7) * wfA, 2, [4, 4]); } // Frontier: the no-build zone
    // snare nets and tethers
    for (const t of G.snares || []) {
      if (!t.s) continue;
      const cx = t.cx * TILE, cy = t.cy * TILE, rr = t.s.netR * TILE, spent = (t.caught || 0) >= t.s.catches;
      b.strokeStyle = spent ? 'rgba(255,77,106,0.25)' : 'rgba(89,240,180,0.32)'; b.lineWidth = 1;
      b.setLineDash([3, 3]); b.lineDashOffset = -frame / 6; b.beginPath(); b.arc(cx, cy, rr, 0, 6.283); b.stroke();
      b.setLineDash([]);
      // v5.8: a hex-mesh net (Tangle Web finer and brighter); Long Lure sweeps its lure range like a radar
      if (!spent) { const m = hexMesh(rr, t.spec === 1 ? '#9fffd8' : '#59f0b4', t.spec === 1 ? 3 : 4); b.globalAlpha = (t.spec === 1 ? 0.26 : 0.16) + 0.05 * Math.sin(frame / 15 + t.id); b.drawImage(m, cx - m.width / RES / 2, cy - m.height / RES / 2, m.width / RES, m.height / RES); b.globalAlpha = 1; }
      if (!spent && t.spec === 2 && t.disabled <= 0) { const R2 = t.s.range * TILE, a = (rt * 2.1 + t.id) % 6.283;
        b.strokeStyle = 'rgba(89,240,180,0.22)'; b.lineWidth = 1; b.beginPath(); b.moveTo(cx, cy); b.lineTo(cx + Math.cos(a) * R2, cy + Math.sin(a) * R2); b.stroke();
        b.strokeStyle = 'rgba(89,240,180,0.12)'; b.lineWidth = 2; b.beginPath(); b.arc(cx, cy, R2, a - 0.5, a); b.stroke(); }
    }
    b.strokeStyle = 'rgba(89,240,180,0.45)'; b.lineWidth = 1; b.setLineDash([2, 4]);
    for (const e of G.enemies) if (e.lureT && !e.netted) { b.beginPath(); b.moveTo(e.x * TILE, e.y * TILE - 7); b.lineTo(e.lureT.cx * TILE, e.lureT.cy * TILE); b.stroke(); }
    b.setLineDash([]);
    // v5.8: a held flier strains on a taut tether back to its beacon
    for (const e of G.enemies) if (e.netted && e.netHold > 0 && e.lureT && !e.dead) { const ex = e.x * TILE, ey = e.y * TILE - 7, q = 0.55 + 0.35 * Math.sin(frame / 2 + e.id);
      b.strokeStyle = hexA('#9fffd8', q); b.lineWidth = 1; b.beginPath(); b.moveTo(e.lureT.cx * TILE, e.lureT.cy * TILE); b.lineTo(ex, ey); b.stroke(); R(b, ex - 1, ey - 1, 2, 2, '#e6fff6'); }
    // Power Nodes: a pulsing cyan diamond; with a tower on top, corner brackets show the charge
    for (const q of G.nodes || []) {
      const cx = q.x * TILE + 12, cy = q.y * TILE + 12, ph = (Math.sin(frame / 12 + q.x * 1.7 + q.y) + 1) / 2;
      if (G.towerAt[q.y * COLS + q.x] || (G.map.core.x === q.x && G.map.core.y === q.y)) {
        const col = hexA('#6ae2ff', 0.55 + 0.4 * ph);
        for (const [sx2, sy2] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { R(b, cx + sx2 * 12 - (sx2 > 0 ? 4 : 0), cy + sy2 * 12 - (sy2 > 0 ? 1 : 0), 4, 1, col); R(b, cx + sx2 * 12 - (sx2 > 0 ? 1 : 0), cy + sy2 * 12 - (sy2 > 0 ? 4 : 0), 1, 4, col); }
        continue;
      }
      for (let k = -7; k <= 7; k++) { const h = 7 - Math.abs(k); R(b, cx + k, cy - h, 1, 1, hexA('#6ae2ff', 0.75)); R(b, cx + k, cy + h, 1, 1, hexA('#6ae2ff', 0.75)); }
      for (let k = -3; k <= 3; k++) { const h = 3 - Math.abs(k); R(b, cx + k, cy - h, 1, h * 2 + 1, hexA('#bff4ff', 0.35 + 0.5 * ph)); }
    }
    // salvage caches: a crate with a beacon that blinks faster as it decays
    for (const cc of G.caches || []) {
      const X = cc.x * TILE + 5, Y = cc.y * TILE + 7, late = cc.t < 6, on = late ? (frame >> 2) % 2 : (frame >> 4) % 2;
      const P2 = CACHE_PAL[cc.kind || 'normal'];
      R(b, X - 1, Y + 1, 16, 12, 'rgba(0,0,0,0.45)');
      R(b, X, Y, 14, 11, P2[0]); R(b, X + 1, Y + 1, 12, 9, P2[1]); R(b, X + 1, Y + 1, 12, 2, P2[2]); R(b, X + 6, Y + 1, 2, 9, P2[0]); R(b, X + 1, Y + 5, 12, 1, P2[0]);
      if (cc.kind === 'cursed') { R(b, X + 4, Y + 3, 2, 2, '#ffd0d8'); R(b, X + 8, Y + 3, 2, 2, '#ffd0d8'); R(b, X + 5, Y + 7, 4, 1, '#ffd0d8'); }
      if (cc.kind === 'gold' && frame % 20 < 10) { P(b, X - 2 + (frame >> 1) % 18, Y - 2, '#ffffff'); P(b, X + 14 - (frame >> 2) % 16, Y + 12, '#fff6c0'); }
      R(b, X + 5, Y - 3, 4, 3, on ? P2[3] : P2[0]);
      const f = Math.max(0, cc.t / CACHE_LIFE), rr = 12;
      b.strokeStyle = hexA(late ? '#ff4d6a' : P2[3], 0.8); b.lineWidth = 1.5; b.beginPath(); b.arc(cc.x * TILE + 12, cc.y * TILE + 12, rr, -1.5708, -1.5708 + 6.2832 * f); b.stroke();
    }
    // Node Links: a jittering cyan beam between linked node towers
    for (const [a, b2] of G.links || []) {
      const ax = a.cx * TILE, ay = a.cy * TILE, bx = b2.cx * TILE, by = b2.cy * TILE, off = a.disabled > 0 || b2.disabled > 0;
      const n = Math.max(4, Math.round(Math.hypot(bx - ax, by - ay) / 10)), nx = -(by - ay), ny = bx - ax, nl = Math.hypot(nx, ny) || 1;
      for (const [w, col, al] of [[4, '#1a5a70', off ? 0.25 : 0.55], [2, '#6ae2ff', off ? 0.25 : 0.85], [1, '#e6fbff', off ? 0 : 0.8]]) {
        if (!al) continue;
        b.strokeStyle = hexA(col, al); b.lineWidth = w; b.beginPath(); b.moveTo(ax, ay);
        for (let k = 1; k < n; k++) { const j = off ? 0 : (Math.sin(frame * 0.7 + k * 2.3 + a.id) * 2.2); b.lineTo(ax + (bx - ax) * k / n + nx / nl * j, ay + (by - ay) * k / n + ny / nl * j); }
        b.lineTo(bx, by); b.stroke();
      }
    }
    // v5.8 Techniques and play styles on the field: Arc Fences, Gravity Garden lines, Pulse Mines, Blackout static and Hoarfrost ice
    for (const f of G.fields || []) ditherDisc(f.x * TILE, f.y * TILE, f.r * TILE, hexA(f.k === 'ice' ? '#bff4ff' : '#ffe14d', 0.18 + 0.22 * Math.min(1, f.t / 1.5)), 2, frame % 2);
    for (const m of G.mines || []) { const X = m.x * TILE, Y = m.y * TILE, on = (frame + (m.x * 7 | 0)) % 30 < 15; R(b, X - 3, Y - 1, 6, 2, '#2a2f52'); R(b, X - 1, Y - 3, 2, 6, '#2a2f52'); R(b, X - 1, Y - 1, 2, 2, on ? '#ffe14d' : '#7a6a10'); }
    if (G.mods.ks.garden) for (const [a, c] of G.gardens || []) {
      if (a.disabled > 0 || c.disabled > 0) continue;
      b.strokeStyle = hexA('#b86cff', 0.35 + 0.15 * Math.sin(frame / 9)); b.lineWidth = 2; b.setLineDash([3, 4]); b.lineDashOffset = -frame / 4;
      b.beginPath(); b.moveTo(a.cx * TILE, a.cy * TILE); b.lineTo(c.cx * TILE, c.cy * TILE); b.stroke(); b.setLineDash([]);
    }
    for (const t of G.towers) {
      const c = t.fenceTo;
      if (!c || !t.s || !t.s.fence || t.disabled > 0 || G.towerAt[c.y * COLS + c.x] !== c || (c.fenceTo === t && c.s && c.s.fence && c.id < t.id)) continue;
      const ax = t.cx * TILE, ay = t.cy * TILE, bx = c.cx * TILE, by = c.cy * TILE, n = Math.max(4, Math.round(Math.hypot(bx - ax, by - ay) / 8)), nx = -(by - ay), ny = bx - ax, nl = Math.hypot(nx, ny) || 1;
      for (const [w, col, al] of [[3, '#7a6a10', 0.5], [1, '#ffe14d', 0.9]]) {
        b.strokeStyle = hexA(col, al); b.lineWidth = w; b.beginPath(); b.moveTo(ax, ay);
        for (let k = 1; k < n; k++) { const j = (Math.random() - 0.5) * 4; b.lineTo(ax + (bx - ax) * k / n + nx / nl * j, ay + (by - ay) * k / n + ny / nl * j); }
        b.lineTo(bx, by); b.stroke();
      }
    }
    const dockT = G.fr ? frDockT() : null;
    for (const t of G.towers) if (t !== dockT) drawTower(t);
    // Frontier links: a glowing line from the landed core to each linked tower, with a pulse running out along it
    if (G.fr && G.frLinks && G.frLinks.length && !G.frFly) {
      const ax = G.core.x * TILE, ay = G.core.y * TILE;
      for (const t of G.frLinks) {
        const bx = t.cx * TILE, by = t.cy * TILE, col = EL[t.s.el].col, off = t.disabled > 0, f = ((rt * 0.8 + t.id * 0.29) % 1);
        b.strokeStyle = hexA('#0d3a2c', off ? 0.3 : 0.6); b.lineWidth = 4; b.beginPath(); b.moveTo(ax, ay); b.lineTo(bx, by); b.stroke();
        b.strokeStyle = hexA(PAL.core, off ? 0.3 : 0.75 + 0.2 * Math.sin(frame / 7 + t.id)); b.lineWidth = 1.5; b.beginPath(); b.moveTo(ax, ay); b.lineTo(bx, by); b.stroke();
        if (!off) { const px = ax + (bx - ax) * f, py = ay + (by - ay) * f; D(b, px, py, 2, hexA(col, 0.9)); R(b, px - 0.5, py - 0.5, 1, 1, '#ffffff'); }
      }
    }
    // v5.8 Relay Pylon: every 1.2 s a pulse runs out to each tower it boosts (amber Amplifier, cyan Uplink). The boosted set is
    // re-read once per cycle with the same range test as recomputeAuras; a newly linked tower gets a soft chirp
    for (const t of G.towers) if (t.s && t.s.kind === 'support' && t.disabled <= 0) {
      const ph = (rt + t.id * 0.37) % 1.2;
      if (!t._pyl || ph < (t._pph || 0)) { const r2 = t.s.range * t.s.range, was = t._pyl, now = [];
        for (const o of G.towers) if (o !== t && o.s && o.s.kind !== 'support' && o.s.kind !== 'eco' && o.s.kind !== 'snare' && dist2(t.cx, t.cy, o.cx, o.cy) <= r2) now.push(o);
        if (was && now.some(o => !was.includes(o))) SFX.play('pylon', t);
        t._pyl = now; }
      t._pph = ph;
      const f = ph / 0.5; if (f >= 1) continue;
      const col = t.spec === 1 ? '#ffb03a' : t.spec === 2 ? '#6ae2ff' : '#d8f0e8', x0 = t.cx * TILE, y0 = t.cy * TILE - 8, a = 1 - f * 0.4;
      for (const o of t._pyl) { const x1 = o.cx * TILE, y1 = o.cy * TILE, px = x0 + (x1 - x0) * f, py = y0 + (y1 - y0) * f;
        b.strokeStyle = hexA(col, 0.45 * a); b.lineWidth = 1.5; b.beginPath(); b.moveTo(x0 + (x1 - x0) * Math.max(0, f - 0.3), y0 + (y1 - y0) * Math.max(0, f - 0.3)); b.lineTo(px, py); b.stroke();
        D(b, px, py, 1.5, hexA(col, a)); R(b, px - 0.5, py - 0.5, 1, 1, '#ffffff');
        if (f > 0.8) strokeRing(x1, y1, 4 + (f - 0.8) * 30, col, (1 - f) * 3, 1); }
    }
    // resonance links
    for (const t of G.towers) for (const o of t.resonWith || []) {
      if (o.id < t.id && o.resonWith && o.resonWith.includes(t)) continue;
      const ax = t.cx * TILE, ay = t.cy * TILE, bx = o.cx * TILE, by = o.cy * TILE;
      for (let k = 2; k < 9; k++) { const f = k / 10, col = (k + (frame >> 3)) % 2 ? EL[t.s.el].col : EL[o.s.el].col; R(b, ax + (bx - ax) * f - 1, ay + (by - ay) * f - 1, 2, 2, hexA(col, 0.45 + 0.3 * Math.sin(frame / 6 + k))); }
    }
    // beams. v5.8: they leave from the lens tip, crawl toward the target, and shift from violet to white as they ramp.
    // Event Horizon burns with a dark inverted core and pulls sparks inward; Prism Split's three beams take three violet tints
    for (const t of G.towers) if (t.beamTargets && t.disabled <= 0) {
      const cc = EL[t.s.el].col, k = Math.min(1, t.ramp / 4), sp = t.spec || 0, x0 = t.cx * TILE, y0 = t.cy * TILE - 3, big = t.asc ? 1 : 0;
      t.beamTargets.forEach((e, i) => {
        const ex = e.x * TILE, ey = e.y * TILE - (e.fly ? 7 : 0), dx = ex - x0, dy = ey - y0, dl = Math.hypot(dx, dy) || 1, sx = x0 + dx / dl * 4, sy = y0 + dy / dl * 4;
        const col = sh(sp === 2 ? PRISM[i % 3] : cc, Math.round(k * 14) / 20); // quantised so the colour cache stays small
        b.lineCap = 'round';
        b.strokeStyle = hexA(col, 0.45 + 0.45 * k); b.lineWidth = 2 + k * 2 + big + (sp === 1 ? 1 : 0); b.beginPath(); b.moveTo(sx, sy); b.lineTo(ex, ey); b.stroke();
        if (sp === 1) { b.strokeStyle = hexA('#0a0614', 0.85); b.lineWidth = 1 + k; b.stroke();
          if (!LITE && frame % 3 === 0) { const u = 0.5 + Math.random() * 0.5; parts.push({ x: sx + dx * u + (Math.random() - 0.5) * 6, y: sy + dy * u + (Math.random() - 0.5) * 6, vx: -dx / dl * 60, vy: -dy / dl * 60, life: Math.min(0.35, dl * u / 70), max: 0.35, col, s: 1.5 }); } }
        else if (k > 0.15) { b.strokeStyle = hexA('#ffffff', 0.35 + 0.5 * k); b.lineWidth = 1; b.setLineDash([3, 4]); b.lineDashOffset = -frame * 0.9; b.stroke(); b.setLineDash([]); }
        b.lineCap = 'butt';
        D(b, sx, sy, 1, '#ffffff');
        D(b, ex, ey, 2 + Math.round(k * 2), hexA(sp === 1 ? col : '#ffffff', 0.5 + 0.4 * k)); if (sp === 1) D(b, ex, ey, 1, '#0a0614');
      });
    }
    drawCore();
    if (odReady()) { const cx = G.core.x * TILE, cy = G.core.y * TILE, k = (frame % 30) / 30;
      for (const ph of [k, (k + 0.5) % 1]) { b.strokeStyle = hexA(PAL.core, 0.75 * (1 - ph)); b.lineWidth = 2; b.beginPath(); b.arc(cx, cy, 17 + ph * 14, 0, 6.2832); b.stroke(); } }
    if (G.slime && G.slime.length) for (const p of G.slime) { const a2 = Math.min(1, p.t / 3) * 0.5; b.fillStyle = `rgba(154,216,106,${a2})`; b.beginPath(); b.ellipse(p.x * TILE, p.y * TILE + 3, 7, 4, 0, 0, 6.283); b.fill(); if ((frame + (p.d * 10 | 0)) % 40 < 3) P(b, p.x * TILE + 2, p.y * TILE + 1, '#e8ffd0'); }
    geneRanks();
    for (const e of G.enemies) if (!e.fly) drawEnemy(e);
    for (const e of G.enemies) if (e.fly) drawEnemy(e);
    // pirate drop ships
    for (const P2 of G.pirates || []) {
      const gold = P2.kind === 'gold', sp = pirateSprite(gold), k = (gold ? 1.5 : 1) * (sp.u || 1), w = sp.width * k, h = sp.height * k, X = P2.x * TILE, Y = P2.y * TILE - 16;
      b.fillStyle = 'rgba(0,0,0,0.3)'; b.fillRect(Math.round(X - w * 0.4), Math.round(P2.y * TILE + 4), Math.round(w * 0.8), 3);
      b.save(); b.translate(Math.round(X), Math.round(Y + Math.sin(frame / 5 + P2.id) * 1.5)); if (P2.vx < 0) b.scale(-1, 1); b.drawImage(sp, -w / 2, -h / 2, w, h); b.restore();
      if (frame % 2 === 0) parts.push({ x: X - Math.sign(P2.vx) * w / 2, y: Y + 2, vx: -P2.vx * 2, vy: (Math.random() - 0.5) * 6, life: 0.3, max: 0.3, col: '#6ae2ff', s: 2 });
      if (!P2.dropped) { const tx = (P2.tx + 0.5) * TILE, ty = (P2.ty + 0.5) * TILE; b.strokeStyle = hexA(CACHE_PAL[P2.kind][3], 0.4 + 0.3 * Math.sin(frame / 3)); b.lineWidth = 1; b.setLineDash([2, 3]); b.strokeRect(tx - 10, ty - 10, 20, 20); b.setLineDash([]); }
    }
    // projectiles
    for (const p of G.projs) {
      const X = p.x * TILE, Y = p.y * TILE, col = EL[p.el] ? EL[p.el].col : '#fff';
      if (p.k === 'bullet' && p.shell) {
        // core battery shell: a bright plasma orb with a streaming tail
        let dx = 0, dy = 0; { const tx = p.e && !p.e.dead ? p.e.x : p.lx, ty = p.e && !p.e.dead ? p.e.y : p.ly; if (tx !== undefined) { dx = tx - p.x; dy = ty - p.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d; } }
        for (let k = 4; k >= 1; k--) D(b, X - dx * k * 3, Y - dy * k * 3, Math.max(1, 3 - k * 0.6), hexA(col, 0.12 + 0.1 * (4 - k)));
        D(b, X, Y, 3, hexA(col, 0.9)); D(b, X, Y, 1.5, '#ffffff');
        if (frame % 3 === 0) parts.push({ x: X, y: Y, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, life: 0.35, max: 0.35, col, s: 2 });
      } else if (p.k === 'bullet') {
        let dx = 0, dy = 0; { const tx = p.e && !p.e.dead ? p.e.x : p.lx, ty = p.e && !p.e.dead ? p.e.y : p.ly; if (tx !== undefined) { dx = tx - p.x; dy = ty - p.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d; } }
        // a tracer: a soft streak behind a hot core
        b.lineCap = 'round'; b.strokeStyle = hexA(col, 0.35); b.lineWidth = p.crit ? 2.5 : 1.5; b.beginPath(); b.moveTo(X - dx * 7, Y - dy * 7); b.lineTo(X, Y); b.stroke();
        b.strokeStyle = hexA(p.crit ? '#ffffff' : col, 0.85); b.lineWidth = p.crit ? 1.5 : 1; b.beginPath(); b.moveTo(X - dx * 3.5, Y - dy * 3.5); b.lineTo(X, Y); b.stroke(); b.lineCap = 'butt';
        b.fillStyle = p.crit ? '#ffffff' : sh(col, 0.5); b.fillRect(X - 1, Y - 1, 2, 2);
      } else if (p.k === 'missile') {
        const a = Math.atan2(p.vy, p.vx);
        blit(UNITS.missile(p.el && EL[p.el] ? p.el : 'T', a), X, Y);
        D(b, X - Math.cos(a) * 5, Y - Math.sin(a) * 5, 1, frame % 2 ? '#ffe14d' : '#ffb03a');
        if (frame % 2) parts.push({ x: X - Math.cos(a) * 6, y: Y - Math.sin(a) * 6, vx: (Math.random() - 0.5) * 3, vy: -4, life: 0.5, max: 0.5, col: '#6a6a7a', s: 2.5, smoke: 1 });
      } else if (p.k === 'mortar') {
        const h = (p.h || 0) * TILE;
        b.fillStyle = 'rgba(0,0,0,0.4)'; b.fillRect(X - 3, Y - 1, 6, 3);
        blit(UNITS.shell(p.el && EL[p.el] ? p.el : 'A'), X, Y - h);
        if (!LITE && frame % 2 === 0) parts.push({ x: X + (Math.random() - 0.5) * 3, y: Y - h + (Math.random() - 0.5) * 3, vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10, life: 0.22, max: 0.22, col: Math.random() < 0.5 ? '#ffffff' : col, s: 1 });
      } else if (p.k === 'bomblet') { // v5.8 Cluster Pods: little bomblets drop onto their spots
        const hh = Math.max(0, p.t) * 26; b.fillStyle = 'rgba(0,0,0,0.4)'; b.fillRect(X - 1.5, Y, 3, 1.5);
        R(b, X - 1, Y - hh - 2, 2, 3, '#5e5040'); P(b, X - 1, Y - hh - 2, frame % 4 < 2 ? '#ffffff' : col); }
    }
    // fx
    for (const L of lines) {
      if (L.dl > 0) { L.dl -= dt; continue; }
      L.life -= dt; const a = Math.max(0, L.life / L.max);
      b.lineCap = 'round';
      b.strokeStyle = hexA(L.col, a); b.lineWidth = L.w || 3; b.beginPath(); b.moveTo(L.pts[0].x, L.pts[0].y); for (let i = 1; i < L.pts.length; i++) b.lineTo(L.pts[i].x, L.pts[i].y); b.stroke();
      if (L.core) { b.strokeStyle = hexA('#ffffff', a * 0.85); b.lineWidth = 1; b.stroke(); }
      b.lineCap = 'butt';
    }
    lines = lines.filter(L => L.life > 0);
    for (const Rg of rings) {
      if (Rg.dl > 0) { Rg.dl -= dt; continue; }
      Rg.life -= dt;
      const k = 1 - Math.max(0, Rg.life / Rg.max), r = Rg.r0 + (Rg.r1 - Rg.r0) * k;
      if (Rg.fill) fillRing(Rg.x, Rg.y, r, Rg.col, (1 - k) * 0.22);
      strokeRing(Rg.x, Rg.y, r, Rg.col, (1 - k) * (Rg.a || 1), Rg.w || 2, Rg.dash);
    }
    rings = rings.filter(Rg => Rg.life > 0);
    // v5.8: hop stars and white impact discs (a few frames each), and Gravity Well drag streaks
    for (const q of stars) {
      if (q.dl > 0) { q.dl -= dt; continue; }
      q.life -= dt; const a = Math.max(0, q.life / q.max);
      if (q.disc) D(b, q.x, q.y, q.s, hexA(q.col, Math.min(1, a * 1.5)));
      else { const s2 = q.s, col = hexA(q.col, a); R(b, q.x - s2, q.y, s2 * 2 + 1, 1, col); R(b, q.x, q.y - s2, 1, s2 * 2 + 1, col); P(b, q.x, q.y, '#ffffff'); }
    }
    stars = stars.filter(q => q.life > 0);
    for (const q of drags) {
      q.life -= dt; if (q.e.dead) continue;
      const a = Math.max(0, q.life / 0.15), ex = q.e.x * TILE, ey = q.e.y * TILE;
      if (Math.abs(ex - q.x0) + Math.abs(ey - q.y0) < 1) continue;
      b.strokeStyle = hexA(q.col, 0.7 * a); b.lineWidth = 2; b.beginPath(); b.moveTo(q.x0, q.y0); b.lineTo(ex, ey); b.stroke();
    }
    drags = drags.filter(q => q.life > 0);
    for (const p of parts) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt; p.vx *= 0.96; p.vy *= 0.96;
      const k = Math.max(0, p.life / p.max);
      if (p.smoke) { const s = (p.s || 2) * (1 + (1 - k) * 1.6); b.fillStyle = hexA(p.col, k * 0.5); b.fillRect(p.x - s / 2, p.y - s / 2, s, s); continue; }
      if (p.fl) { // v5.8 flame wedge: grows as it ages and cools from white to smoke; a smaller lick trails toward the nozzle
        const i = Math.min(5, Math.floor((1 - k) * 6)), s = (p.s || 2) * (1 + (1 - k) * 2.2), sp = Math.hypot(p.vx, p.vy) || 1;
        b.fillStyle = hexA(FLAME_RAMP[p.fl][i], i === 5 ? k * 0.9 : Math.min(1, k * 1.6));
        b.fillRect(p.x - s / 2, p.y - s / 2, s, s); const s3 = s * 0.55; b.fillRect(p.x - p.vx / sp * s * 0.8 - s3 / 2, p.y - p.vy / sp * s * 0.8 - s3 / 2, s3, s3); continue; }
      b.fillStyle = hexA(p.col, k);
      const s = (p.s || 2) * (k > 0.5 ? 1 : 0.75); b.fillRect(Math.round((p.x - s / 2) * RES) / RES, Math.round((p.y - s / 2) * RES) / RES, s, s);
    }
    parts = parts.filter(p => p.life > 0);
    if (parts.length > 800) parts.splice(0, parts.length - 800);
    if (nuke) drawNuke(dt);
    if (G.aimAbility && aimPos) D(b, aimPos.x * TILE, aimPos.y * TILE, 2, '#ffffff');

    // ---------- light sources (buffer coords) ----------
    lights.length = 0;
    const pz = (Math.sin(frame / 10) + 1) / 2;
    light(G.core.x * TILE, G.core.y * TILE, TILE * (2.6 + pz * 0.4), PAL.core, 0.38);
    for (const t of G.towers) { const c0 = EL[t.s.el].col; light(t.cx * TILE, t.cy * TILE, TILE * 1.15, c0, 0.13 + (t.flash > 0 ? 0.28 : 0) + (t.asc ? 0.08 : 0)); }
    for (const t of G.towers) if (t.beamTargets && t.disabled <= 0) for (const e of t.beamTargets) light(e.x * TILE, e.y * TILE, TILE * (0.8 + Math.min(1, t.ramp / 4) * 0.6), EL[t.s.el].col, 0.35);
    let np = 0;
    for (const p of G.projs) { if (np++ > 160) break; light(p.x * TILE, p.y * TILE, TILE * (p.k === 'bullet' ? 0.45 : 0.75), EL[p.el] ? EL[p.el].col : '#ffffff', p.k === 'bullet' ? 0.3 : 0.4); }
    for (const e of G.enemies) {
      if (e.boss) light(e.x * TILE, e.y * TILE, TILE * (e.gen ? 1.8 : 3.4), BOSS_COL[e.boss] || '#ff3355', 0.22);
      else if (e.elite.length) light(e.x * TILE, e.y * TILE, TILE * 1.1, ELITE_AFFIXES.find(a => a.id === e.elite[0]).col, 0.18);
      if (e.st.burn) light(e.x * TILE, e.y * TILE, TILE * 0.7, EL.T.col, 0.16);
    }
    for (const Rg of rings) { if (Rg.nl || Rg.dl > 0) continue; const k = 1 - Math.max(0, Rg.life / Rg.max); light(Rg.x, Rg.y, (Rg.r0 + (Rg.r1 - Rg.r0) * k) * 1.3 + 6, Rg.col, (1 - k) * (Rg.fill ? 0.5 : 0.3)); }
    for (const L of lines) { if (L.dl > 0) continue; const a = Math.max(0, L.life / L.max), q = L.pts[L.pts.length - 1]; light(q.x, q.y, 16, L.col, a * 0.5); light(L.pts[0].x, L.pts[0].y, 12, L.col, a * 0.35); }
    for (const s2 of G.storms) light(s2.x * TILE, s2.y * TILE, s2.r * TILE * 1.1, s2.mael ? '#ff4d6a' : STORMS[s2.types[0]].col, 0.13);
    for (const z of G.zones) light(z.x * TILE, z.y * TILE, z.r * TILE * 1.2, '#ff7b39', 0.22);
    for (const q of conduits) light(q.x, q.y, 14, q.col, 0.05 + 0.05 * Math.sin(frame / 20 + q.ph));
    for (const q of G.nodes || []) light(q.x * TILE + 12, q.y * TILE + 12, TILE * 1.1, '#6ae2ff', 0.16 + 0.06 * Math.sin(frame / 12 + q.x));
    for (const cc of G.caches || []) light(cc.x * TILE + 12, cc.y * TILE + 12, TILE * (cc.kind === 'gold' ? 1.8 : 1.3), CACHE_PAL[cc.kind || 'normal'][3], cc.kind === 'gold' ? 0.4 : 0.22);
    for (const [a, b2] of G.links || []) light((a.cx + b2.cx) / 2 * TILE, (a.cy + b2.cy) / 2 * TILE, TILE * 1.2, '#6ae2ff', 0.12);
    if (nuke) { const t = nuke.t; light(nuke.x, nuke.y, TILE * (3 + 3 * Math.min(1, t / 0.4)), t < 0.6 ? '#fff0c0' : '#ff8a2a', Math.max(0, 0.9 - t * 0.3)); light(nuke.x, nuke.y - TILE * 3.5 * Math.min(1, t / 1.5), TILE * 3, '#ff7b29', Math.max(0, 0.45 - t * 0.14)); }
    if (odReady()) light(G.core.x * TILE, G.core.y * TILE, TILE * 3.4, PAL.core, 0.25 + 0.15 * Math.sin(frame / 4));
    for (const L of G.map.lanes) { const p0 = L.tiles[0]; light((p0.x + 0.5) * TILE, (p0.y + 0.5) * TILE, TILE * (L.openWave ? 1.4 : 2), L.openWave ? '#b86cff' : '#ff4d6a', (L.openWave ? 0.18 : 0.26) + 0.08 * Math.sin(frame / 7)); }

    // ---------- composite ----------
    let sx = 0, sy = 0;
    if (shakeT > 0 && doShake) { shakeT -= dt; sx = (Math.random() - 0.5) * shake; sy = (Math.random() - 0.5) * shake; }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    // sharp-bilinear: integer nearest-neighbour upscale first, then one smooth resample to the exact size,
    // so every art pixel lands the same width on screen (no shimmer from uneven nearest-neighbour scaling)
    const dsb = v.ws * dpr / RES, k = (window.__rdbg & 8) || R_.sharp === false ? 1 : Math.max(1, Math.min(8, Math.ceil(dsb - 0.08)));
    let src = buf;
    if (k > 1) {
      if (mid.width !== bw * k || mid.height !== bh * k) { mid.width = bw * k; mid.height = bh * k; }
      mctx.imageSmoothingEnabled = false; mctx.clearRect(0, 0, mid.width, mid.height);
      mctx.drawImage(buf, 0, 0, bw, bh, 0, 0, bw * k, bh * k); src = mid;
    }
    c.imageSmoothingEnabled = true;
    const DW = W, DH = H, X0 = sx, Y0 = sy, KR = RES * k;
    c.drawImage(src, (v.vx - vxI) * KR, (v.vy - vyI) * KR, v.vw * KR, v.vh * KR, X0, Y0, DW, DH);
    // lighting pass: additive soft lights in screen space
    const ws = v.ws, bx2s = x => X0 + (x - v.vx) * ws, by2s = y => Y0 + (y - v.vy) * ws;
    c.save(); c.beginPath(); c.rect(ox, oy, DW, DH); c.clip();
    const DBG = window.__rdbg || 0;
    // lights accumulate in a quarter-resolution buffer, then land in one additive blit
    const LQ = 4, lw = Math.max(1, Math.ceil(DW * dpr / LQ)), lh = Math.max(1, Math.ceil(DH * dpr / LQ)), lsc = dpr / LQ;
    if (lightCv.width !== lw || lightCv.height !== lh) { lightCv.width = lw; lightCv.height = lh; }
    lctx.globalCompositeOperation = 'source-over'; lctx.globalAlpha = 1; lctx.clearRect(0, 0, lw, lh); lctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < ((DBG & 2) ? 0 : lights.length); i += 5) {
      const r = lights[i + 2] * ws * lsc, x = (bx2s(lights[i]) - ox) * lsc, y = (by2s(lights[i + 1]) - oy) * lsc;
      if (x + r < 0 || y + r < 0 || x - r > lw || y - r > lh) continue;
      lctx.globalAlpha = Math.min(1, lights[i + 4]); lctx.drawImage(lightSprite(lights[i + 3]), x - r, y - r, r * 2, r * 2);
    }
    if (R_.glow !== false) { c.globalCompositeOperation = 'lighter'; c.drawImage(lightCv, ox, oy, DW, DH); }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    // smooth overlays: ranges, selection, aim
    const ringS = (x, y, r, col, a, w, fill) => {
      c.beginPath(); c.arc(bx2s(x), by2s(y), r * ws, 0, 6.283);
      if (fill) { c.fillStyle = hexA(col, fill); c.fill(); }
      c.setLineDash([7, 5]); c.lineDashOffset = -frame / 3; c.strokeStyle = hexA(col, a); c.lineWidth = w; c.stroke(); c.setLineDash([]);
    };
    if (selTower && G.towers.includes(selTower)) { const r = (selTower.effRange || selTower.s.range) * TILE; if (r > 0) ringS(selTower.cx * TILE, selTower.cy * TILE, r, EL[selTower.s.el].col, 0.85, 1.5, 0.07); }
    if (preview) ringS((preview.x + 0.5) * TILE, (preview.y + 0.5) * TILE, preview.range * TILE, preview.col, 0.9, 1.5, 0.09);
    if (G.selCore) ringS(G.core.x * TILE, G.core.y * TILE, (G.core.s ? G.core.s.range : 3) * TILE, PAL.core, 0.75, 1.5, 0.05);
    if (G.aimAbility && aimPos) ringS(aimPos.x * TILE, aimPos.y * TILE, 1.7 * TILE, PAL.amber, 1, 2, 0.12);
    // v5.0.1 mouse: the tile under the cursor gets faint corners; a hovered tower shows its range
    if (hoverTile && !(selTile && selTile.x === hoverTile.x && selTile.y === hoverTile.y) && G && !G.over) {
      const x = bx2s(hoverTile.x * TILE), y = by2s(hoverTile.y * TILE), w = TILE * ws, L = Math.max(3, w * 0.22);
      c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 1.5; c.beginPath();
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const px = x + dx * w, py = y + dy * w, sx2 = dx ? -1 : 1, sy2 = dy ? -1 : 1; c.moveTo(px, py + sy2 * L); c.lineTo(px, py); c.lineTo(px + sx2 * L, py); }
      c.stroke();
      const ht = G.towerAt && G.towerAt[hoverTile.y * COLS + hoverTile.x];
      if (ht && ht !== selTower && ht.s) { const r = (ht.effRange || ht.s.range) * TILE; if (r > 0) ringS(ht.cx * TILE, ht.cy * TILE, r, EL[ht.s.el].col, 0.4, 1, 0.03); }
    }
    if (selTile) {
      const x = bx2s(selTile.x * TILE), y = by2s(selTile.y * TILE), w = TILE * ws, L = Math.max(4, w * 0.28), cc = frame % 30 < 20 ? PAL.amber : '#b07a20';
      c.strokeStyle = cc; c.lineWidth = 2; c.beginPath();
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const px = x + dx * w, py = y + dy * w, sx2 = dx ? -1 : 1, sy2 = dy ? -1 : 1; c.moveTo(px, py + sy2 * L); c.lineTo(px, py); c.lineTo(px + sx2 * L, py); }
      c.stroke();
    }
    // Node Beacon placement (Black Market): a cyan frame says "tap a tile"
    if (G.placing === 'beacon') { c.setLineDash([8, 6]); c.lineDashOffset = -frame / 2; c.lineWidth = 3; c.strokeStyle = hexA('#6ae2ff', 0.55 + 0.35 * Math.sin(frame / 5)); c.strokeRect(ox + 1.5, oy + 1.5, DW - 3, DH - 3); c.setLineDash([]); }
    // core relocation: reach circle, valid tiles, and the planned roads
    if (G.reloc) {
      ringS(G.core.x * TILE, G.core.y * TILE, RELOCATE_RADIUS * TILE, PAL.core, 0.55, 1.5, 0.025);
      const tw = TILE * ws, pa = 0.1 + 0.06 * Math.sin(frame / 9);
      c.fillStyle = hexA(PAL.core, pa);
      for (const i of G.reloc.cands) { const x = bx2s((i % COLS) * TILE), y = by2s(((i / COLS) | 0) * TILE); c.fillRect(Math.round(x + tw * 0.18), Math.round(y + tw * 0.18), Math.round(tw * 0.64), Math.round(tw * 0.64)); }
      const P = G.reloc.plan;
      if (P) {
        c.lineCap = 'round'; c.lineJoin = 'round';
        for (const route of P.routes) {
          c.beginPath();
          route.forEach((i, k) => { const x = bx2s(((i % COLS) + 0.5) * TILE), y = by2s((((i / COLS) | 0) + 0.5) * TILE); if (k) c.lineTo(x, y); else c.moveTo(x, y); });
          c.strokeStyle = 'rgba(7,8,15,0.7)'; c.lineWidth = Math.max(3, tw * 0.3); c.setLineDash([]); c.stroke();
          c.strokeStyle = hexA(PAL.amber, 0.95); c.lineWidth = Math.max(2, tw * 0.14); c.setLineDash([tw * 0.35, tw * 0.25]); c.lineDashOffset = -frame / 2; c.stroke();
        }
        c.setLineDash([]); c.lineCap = 'butt'; c.lineJoin = 'miter';
        const gx = (P.x + 0.5) * TILE, gy = (P.y + 0.5) * TILE;
        ringS(gx, gy, TILE * (0.62 + 0.08 * Math.sin(frame / 5)), PAL.core, 1, 2.5, 0.25);
      }
    }
    // Frontier picker: landing spots (open ground faint, dockable towers framed in their colour), then the preview: new roads,
    // the ghost core, the docked weapon's reach and the towers it would link. Moving a tower: open tiles and the new reach
    if (frSel && G.fr) {
      const tw = TILE * ws, pa = 0.09 + 0.05 * Math.sin(frame / 9), P = frSel.plan;
      c.fillStyle = hexA(frSel.kind === 'move' ? PAL.amber : PAL.core, pa);
      for (const i of frSel.cands) { if (G.towerAt[i]) continue; const x = bx2s((i % COLS) * TILE), y = by2s(((i / COLS) | 0) * TILE); c.fillRect(Math.round(x + tw * 0.22), Math.round(y + tw * 0.22), Math.round(tw * 0.56), Math.round(tw * 0.56)); }
      if (frSel.kind === 'land') {
        c.lineWidth = 2;
        for (const i of frSel.cands) { const t = G.towerAt[i]; if (!t) continue; const x = bx2s(t.x * TILE), y = by2s(t.y * TILE), m = Math.max(1, tw * 0.06) + (frame % 40 < 20 ? 0 : 1);
          c.strokeStyle = hexA(EL[t.s.el].col, 0.9); c.strokeRect(Math.round(x + m) + 0.5, Math.round(y + m) + 0.5, Math.round(tw - 2 * m), Math.round(tw - 2 * m)); }
        if (P) {
          c.lineCap = 'round'; c.lineJoin = 'round';
          for (const route of P.routes) {
            c.beginPath();
            route.forEach((i, k) => { const x = bx2s(((i % COLS) + 0.5) * TILE), y = by2s((((i / COLS) | 0) + 0.5) * TILE); if (k) c.lineTo(x, y); else c.moveTo(x, y); });
            c.strokeStyle = 'rgba(7,8,15,0.7)'; c.lineWidth = Math.max(3, tw * 0.3); c.setLineDash([]); c.stroke();
            c.strokeStyle = hexA(PAL.amber, 0.95); c.lineWidth = Math.max(2, tw * 0.14); c.setLineDash([tw * 0.35, tw * 0.25]); c.lineDashOffset = -frame / 2; c.stroke();
          }
          c.setLineDash([]); c.lineCap = 'butt'; c.lineJoin = 'miter';
          const gx = (P.x + 0.5) * TILE, gy = (P.y + 0.5) * TILE;
          for (const t of P.links) { c.strokeStyle = hexA(PAL.core, 0.8); c.lineWidth = 2; c.setLineDash([4, 4]); c.lineDashOffset = -frame / 3; c.beginPath(); c.moveTo(bx2s(gx), by2s(gy)); c.lineTo(bx2s(t.cx * TILE), by2s(t.cy * TILE)); c.stroke(); c.setLineDash([]); ringS(t.cx * TILE, t.cy * TILE, TILE * 0.55, PAL.core, 0.9, 1.5, 0); }
          if (P.dock) ringS(gx, gy, (P.dock.s.range + FRONTIER.dockRange) * TILE, EL[P.dock.s.el].col, 0.85, 1.5, 0.06);
          ringS(gx, gy, FRONTIER.linkR * TILE, PAL.core, 0.35, 1, 0);
          ringS(gx, gy, TILE * (0.62 + 0.08 * Math.sin(frame / 5)), PAL.core, 1, 2.5, 0.25);
        }
      } else if (frSel.t && frSel.dest) {
        const t = frSel.t, gx = (frSel.dest.x + 0.5) * TILE, gy = (frSel.dest.y + 0.5) * TILE;
        c.strokeStyle = hexA(PAL.amber, 0.85); c.lineWidth = 2; c.setLineDash([5, 5]); c.lineDashOffset = -frame / 2; c.beginPath(); c.moveTo(bx2s(t.cx * TILE), by2s(t.cy * TILE)); c.lineTo(bx2s(gx), by2s(gy)); c.stroke(); c.setLineDash([]);
        if (t.s.range) ringS(gx, gy, t.s.range * TILE, EL[t.s.el].col, 0.85, 1.5, 0.07);
      }
    }
    // Frontier edge arrows: bosses, and enemies close to the core, that are off screen (tap one to look)
    frArrows.length = 0;
    if (G.fr && !G.over) {
      const pad = 16, th = [];
      for (const e of G.enemies) { if (e.dead || (e.cloaked && !(e.revealed > 0))) continue; const near = e.L && e.L.len - e.d < 10; if (!e.boss && !near) continue; th.push(e); }
      th.sort((p, q) => (q.boss ? 1 : 0) - (p.boss ? 1 : 0) || (p.L.len - p.d) - (q.L.len - q.d));
      const homeOff = (() => { const x = bx2s(G.core.x * TILE) - ox, y = by2s(G.core.y * TILE) - oy; return x < 0 || y < 0 || x > DW || y > DH; })();
      const list = th.slice(0, 6).map(e => ({ x: e.x, y: e.y, col: e.boss ? PAL.bad : PAL.amber, big: !!e.boss }));
      if (homeOff) list.push({ x: G.core.x, y: G.core.y, col: PAL.core, home: 1 });
      const cx0 = ox + DW / 2, cy0 = oy + DH / 2;
      for (const A of list) {
        const sx2 = bx2s(A.x * TILE), sy2 = by2s(A.y * TILE);
        if (sx2 >= ox && sy2 >= oy && sx2 <= ox + DW && sy2 <= oy + DH) continue;
        const dx = sx2 - cx0, dy = sy2 - cy0, k = Math.min((DW / 2 - pad) / Math.max(1e-6, Math.abs(dx)), (DH / 2 - pad) / Math.max(1e-6, Math.abs(dy)));
        const px = cx0 + dx * k, py = cy0 + dy * k, an = Math.atan2(dy, dx), r = A.big ? 11 : 8, pl = 0.75 + 0.25 * Math.sin(frame / 6);
        if (frArrows.some(o => Math.hypot(o.sx - px, o.sy - py) < 18)) continue;
        c.save(); c.translate(px, py); c.rotate(an);
        c.fillStyle = 'rgba(7,8,15,0.75)'; c.beginPath(); c.moveTo(r + 3, 0); c.lineTo(-r + 1, -r); c.lineTo(-r * 0.4, 0); c.lineTo(-r + 1, r); c.closePath(); c.fill();
        c.fillStyle = hexA(A.col, pl); c.beginPath(); c.moveTo(r, 0); c.lineTo(-r + 3, -r + 2.5); c.lineTo(-r * 0.4 + 1, 0); c.lineTo(-r + 3, r - 2.5); c.closePath(); c.fill();
        c.restore();
        frArrows.push({ sx: px - ox, sy: py - oy, x: A.x, y: A.y, home: !!A.home });
      }
    }
    // the old sector border fades out as the camera pulls back
    if (frontier) {
      const age = (performance.now() - frontier.t0) / 1000, a = age < 0.4 ? age / 0.4 : Math.max(0, 1 - (age - 0.4) / 3.2);
      if (a <= 0) frontier = null;
      else {
        const x = bx2s(frontier.x), y = by2s(frontier.y), w = frontier.w * ws, h = frontier.h * ws;
        c.setLineDash([6, 6]); c.lineDashOffset = -frame / 2; c.lineWidth = 2; c.strokeStyle = hexA('#b86cff', 0.75 * a);
        c.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h)); c.setLineDash([]);
      }
    }
    // v5.8 gene marks, in screen space so they stay readable at phone zoom
    { const u = clamp(Math.round(ws * 1.1), 2, 4);
      for (const e of G.enemies) if (e._gmOn && !e.dead && !(e.cloaked && !(e.revealed > 0))) {
        const x = Math.round(bx2s(e.x * TILE)), y = Math.round(by2s(e.y * TILE - (e.fly ? 7 : 0))), hw = (e._hw || 6) * ws, hh = (e._hh || 6) * ws;
        if (x < -40 || y < -40 || x > DW + 40 || y > DH + 40) continue;
        for (const g of e._gmOn) geneMark(c, g, x, y, hw, hh, u, e);
      } }
    // v5.1 inspect: a ring follows the enemy you tapped (or hover)
    for (const [E0, col] of [[selEnemy, PAL.amber], [hoverEnemy, '#e9e4d4']]) if (E0 && !E0.dead && E0 !== (col === '#e9e4d4' ? selEnemy : null)) {
      const x = bx2s(E0.x * TILE), y = by2s(E0.y * TILE - (E0.fly ? 7 : 0)), r = (E0._hh || 8) * ws + 4;
      c.strokeStyle = 'rgba(9,11,22,0.8)'; c.lineWidth = 4; c.beginPath(); c.arc(x, y, r, 0, 6.283); c.stroke();
      c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r, 0, 6.283); c.stroke();
    }
    // v5.1 Sensor Sweep: green brackets on everything it Marked, an amber reticle on the biggest threat
    if (G.scanT > 0) {
      const u = clamp(Math.round(ws * 1.1), 2, 4);
      for (const e of G.enemies) if (e.scanned > 0 && !e.dead && e !== G.scanThreat) {
        const x = bx2s(e.x * TILE), y = by2s(e.y * TILE - (e.fly ? 7 : 0)), r = (e._hh || 6) * ws * 0.9 + 3 * u, a = Math.min(1, e.scanned / 1.5) * 0.85;
        c.fillStyle = hexA('#7dffb0', a);
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const px = Math.round(x + sx * r), py = Math.round(y + sy * r); c.fillRect(px - (sx > 0 ? 2 * u : 0), py - (sy > 0 ? u : 0), 2 * u, u); c.fillRect(px - (sx > 0 ? u : 0), py - (sy > 0 ? 2 * u : 0), u, 2 * u); }
      }
      const e = G.scanThreat;
      if (e && !e.dead) {
        const x = bx2s(e.x * TILE), y = by2s(e.y * TILE - (e.fly ? 7 : 0)), r = (e._hh || 8) * ws * 1.1 + 6 * u + Math.sin(frame / 4) * u;
        c.strokeStyle = 'rgba(9,11,22,0.8)'; c.lineWidth = u + 2; c.beginPath(); c.arc(x, y, r, 0, 6.283); c.stroke();
        c.strokeStyle = PAL.amber; c.lineWidth = u; c.setLineDash([u * 3, u * 2]); c.lineDashOffset = -frame / 3; c.beginPath(); c.arc(x, y, r, 0, 6.283); c.stroke(); c.setLineDash([]);
        c.fillStyle = PAL.amber; for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) c.fillRect(Math.round(x + dx * (r + u) - u / 2 - (dx ? (dx > 0 ? 0 : 2 * u) : 0)), Math.round(y + dy * (r + u) - u / 2 - (dy ? (dy > 0 ? 0 : 2 * u) : 0)), dx ? 3 * u : u, dy ? 3 * u : u);
        c.font = `${Math.max(8, 4 * u)}px Silkscreen, monospace`; c.textAlign = 'center'; c.textBaseline = 'bottom';
        c.fillStyle = 'rgba(9,11,22,0.85)'; const tw = c.measureText('THREAT').width; c.fillRect(Math.round(x - tw / 2 - u), Math.round(y - r - 3 * u - 5 * u), Math.round(tw + 2 * u), 5 * u + u);
        c.fillStyle = PAL.amber; c.fillText('THREAT', Math.round(x), Math.round(y - r - 3 * u)); c.textBaseline = 'alphabetic';
      }
    }
    // v4.7 elite crowns: gold, one gem per affix, drawn above everything so a crowd can't bury them
    for (const e of G.enemies) if (e._crown && !e.dead) {
      const x = Math.round(bx2s(e.x * TILE)), y = Math.round(by2s(e.y * TILE - (e.fly ? 7 : 0) - (e._hh || 6) - 4)), u = clamp(Math.round(ws * 1.1), 2, 4), n = e._crown.length, cw = (5 + n * 2) * u;
      c.fillStyle = '#090b16'; c.fillRect(x - cw / 2 - u, y - 4 * u, cw + 2 * u, 5 * u);
      c.fillStyle = '#ffd84a'; c.fillRect(x - cw / 2, y - u * 1.5, cw, u * 2); for (const dx of [-cw / 2, -u / 2, cw / 2 - u]) c.fillRect(x + dx, y - 3 * u, u, 2 * u);
      e._crown.forEach((col, i) => { c.fillStyle = col; c.fillRect(x - (n * 2 * u - u) / 2 + i * 2 * u, y - u, u, u); });
    }
    // 5.8 Training: every tile a tower can go on, softly marked (one fill per tile, one colour per frame)
    if (spotTiles && spotTiles.length) { const w = Math.round(TILE * ws), a = 0.16 + 0.1 * Math.sin(frame / 8); c.fillStyle = hexA(PAL.good, a);
      for (const h of spotTiles) c.fillRect(Math.round(bx2s(h.x * TILE)) + 1, Math.round(by2s(h.y * TILE)) + 1, w - 2, w - 2); }
    // v5.3 first run: glowing build spots until the first tower goes down
    if (hintTiles) for (const h of hintTiles) {
      const x0 = bx2s(h.x * TILE), y0 = by2s(h.y * TILE), w = TILE * ws, a = 0.55 + 0.4 * Math.sin(frame / 6), u = Math.max(2, Math.round(w / 8));
      c.fillStyle = hexA(PAL.good, 0.12 + 0.1 * a); c.fillRect(Math.round(x0), Math.round(y0), Math.round(w), Math.round(w));
      c.fillStyle = hexA(PAL.good, a); for (const [sx, sy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const px = Math.round(x0 + sx * (w - 2 * u)), py = Math.round(y0 + sy * (w - 2 * u)); c.fillRect(px, py + (sy ? u : 0), 2 * u, u); c.fillRect(px + (sx ? u : 0), py, u, 2 * u); }
      c.font = `${Math.max(8, Math.round(w / 4))}px Silkscreen, monospace`; c.textAlign = 'center'; c.textBaseline = 'top'; c.fillStyle = 'rgba(9,11,22,0.8)'; const tw = c.measureText('BUILD').width; c.fillRect(Math.round(x0 + w / 2 - tw / 2 - 2), Math.round(y0 + w + 1), Math.round(tw + 4), Math.round(w / 4) + 3);
      c.fillStyle = PAL.good; c.fillText('BUILD', Math.round(x0 + w / 2), Math.round(y0 + w + 2)); c.textBaseline = 'alphabetic';
    }
    // v5.3: towers that haven't fired for three waves say so on the map
    { const u = clamp(Math.round(ws * 1.1), 2, 4);
      for (const t of G.towers) if (!(t.disabled > 0) && G.wave >= 3 && idleWaves(t) >= 3) {
        const x = Math.round(bx2s(t.cx * TILE)), y = Math.round(by2s(t.y * TILE)) - u;
        c.font = `${Math.max(8, 3.5 * u)}px Silkscreen, monospace`; c.textAlign = 'center'; c.textBaseline = 'bottom'; const tw = c.measureText('IDLE').width;
        c.fillStyle = 'rgba(9,11,22,0.85)'; c.fillRect(Math.round(x - tw / 2 - u), y - Math.round(4.5 * u), Math.round(tw + 2 * u), Math.round(4.5 * u) + 1);
        c.fillStyle = '#9a96b0'; c.fillText('IDLE', x, y); c.textBaseline = 'alphabetic';
      } }
    // v5.2 pirates: the skiff's flight path ahead of it, its target, and its captain's name
    for (const e of G.enemies) if (e.pirate && !e.dead) {
      const P = e.pirate, L = e.L, pts = [{ x: e.x, y: e.y }]; for (let i = 0; i < L.pts.length; i++) if (L.cum[i] > e.d) pts.push(L.pts[i]);
      c.setLineDash([5, 5]); c.lineDashOffset = -frame / 2; c.lineWidth = 2; c.strokeStyle = hexA('#ff4d6a', 0.55); c.beginPath();
      pts.forEach((q, i) => { const x = bx2s(q.x * TILE), y = by2s(q.y * TILE - 7); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke(); c.setLineDash([]);
      if (!P.got && P.cache) { const x = bx2s((P.cache.x + 0.5) * TILE), y = by2s((P.cache.y + 0.5) * TILE), r = TILE * ws * 0.6 + Math.sin(frame / 4) * 2; c.strokeStyle = '#ff4d6a'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r, 0, 6.283); c.stroke(); c.beginPath(); c.moveTo(x - r - 4, y); c.lineTo(x - r + 4, y); c.moveTo(x + r - 4, y); c.lineTo(x + r + 4, y); c.moveTo(x, y - r - 4); c.lineTo(x, y - r + 4); c.moveTo(x, y + r - 4); c.lineTo(x, y + r + 4); c.stroke(); }
      if (P.captain) { const u = clamp(Math.round(ws * 1.1), 2, 4), x = Math.round(bx2s(e.x * TILE)), y = Math.round(by2s(e.y * TILE - 7 - (e._hh || 8) - 3));
        c.font = `${Math.max(8, 3.5 * u)}px Silkscreen, monospace`; c.textAlign = 'center'; c.textBaseline = 'bottom'; const tw = c.measureText(P.captain).width;
        c.fillStyle = 'rgba(9,11,22,0.85)'; c.fillRect(Math.round(x - tw / 2 - u), y - Math.round(4.5 * u), Math.round(tw + 2 * u), Math.round(4.5 * u) + 1);
        c.fillStyle = P.got ? '#ff4d6a' : '#ffd84a'; c.fillText(P.captain, x, y); c.textBaseline = 'alphabetic'; }
    }
    // v5.1 storm transparency: towers a storm boosts wear its colour (dashed if it only touches them); knocked-out towers say why
    if (G.storms.length) for (const st of G.storms) {
      const els = st.mael ? ELS : st.types.map(ty => STORMS[ty].el), col = st.mael ? '#ff4d6a' : STORMS[st.types[0]].col, r2 = st.r * st.r;
      for (const t of G.towers) { if (dist2(t.cx, t.cy, st.x, st.y) > r2) continue;
        const boosted = t.s && els.includes(t.s.el), x0 = Math.round(bx2s(t.x * TILE)) + 1.5, y0 = Math.round(by2s(t.y * TILE)) + 1.5, w = Math.round(TILE * ws) - 3;
        c.lineWidth = boosted ? 2 : 1; c.strokeStyle = hexA(col, boosted ? 0.9 : 0.45); if (!boosted) c.setLineDash([3, 3]); c.strokeRect(x0, y0, w, w); c.setLineDash([]); }
    }
    { const u = clamp(Math.round(ws * 1.1), 2, 4);
      for (const t of G.towers) if (t.disabled > 0) {
        const tag = t.disCause || 'OFFLINE', x = Math.round(bx2s(t.cx * TILE)), y = Math.round(by2s(t.y * TILE)) - u;
        c.font = `${Math.max(8, 3.5 * u)}px Silkscreen, monospace`; c.textAlign = 'center'; c.textBaseline = 'bottom';
        const tw = c.measureText(tag).width; c.fillStyle = 'rgba(9,11,22,0.88)'; c.fillRect(Math.round(x - tw / 2 - u), y - Math.round(4.5 * u), Math.round(tw + 2 * u), Math.round(4.5 * u) + 1);
        c.fillStyle = tag === 'SAPPED' ? '#ffa860' : '#ffe14d'; c.fillText(tag, x, y); c.textBaseline = 'alphabetic';
        if (frame % 4 === 0) { const a = Math.random() * 6.283; c.fillStyle = '#ffe14d'; c.fillRect(Math.round(bx2s((t.cx + Math.cos(a) * 0.4) * TILE)), Math.round(by2s((t.cy + Math.sin(a) * 0.4) * TILE)), u, u); }
      }
    }
    // v4.8.1 level display, kept off the tower art (Nic: the badges hid the sprites):
    //  - every tower: a thin tier-coloured line under its tile (white, green, blue, purple, orange, red in bands of 3 levels)
    //  - the selected tower: its level number on a plate below the tile
    //  - one arrow, floating above the tile: the lowest-level tower you can afford to upgrade (cheapest wins a tie); when every
    //    tower is maxed, the cheapest affordable Ascension. It points at the best next upgrade, not at everything you could buy
    { const tpx = TILE * ws, cr = G.credits, big = tpx >= 17;
      let best = null, bl = Infinity, bc = Infinity;
      if (!G.over) for (const t of G.towers) { const c0 = upgradeCost(t); if (cr < c0 || t.ascPend > 0) continue; const n = towerLevel(t), key = t.lvl < MAX_LV ? n : 100 + n; if (key < bl || (key === bl && c0 < bc)) { best = t; bl = key; bc = c0; } }
      for (const t of G.towers) {
        const n = towerLevel(t), col = lvTier(n).col, x0 = bx2s(t.x * TILE), x1 = bx2s(t.x * TILE + TILE), y = Math.round(by2s(t.y * TILE + TILE)), w = x1 - x0, lw = Math.max(2, Math.round(tpx / 12));
        c.fillStyle = 'rgba(9,11,22,0.85)'; c.fillRect(Math.round(x0 + w * 0.18) - 1, y - lw - 1, Math.round(w * 0.64) + 2, lw + 2);
        c.fillStyle = col; c.fillRect(Math.round(x0 + w * 0.18), y - lw, Math.round(w * 0.64), lw);
        if (t.spec) { c.fillStyle = PAL.amber; c.fillRect(Math.round(x0 + w * 0.18), y - lw, Math.max(2, Math.round(w * 0.1)), lw); }
      }
      if (selTower && G.towers.includes(selTower) && big) {
        const t = selTower, n = towerLevel(t), bs = Math.round(clamp(tpx * 0.42, 12, 18)), pw = Math.round(bs * (n >= 10 ? 1.9 : 1.55)), x = Math.round(bx2s(t.cx * TILE)) - pw / 2, y = Math.round(by2s(t.y * TILE + TILE)) + 3;
        c.font = `${bs - 4}px Silkscreen, monospace`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillStyle = '#090b16'; c.fillRect(x - 1, y - 1, pw + 2, bs + 2); c.fillStyle = lvTier(n).col; c.fillRect(x, y, pw, bs);
        c.fillStyle = '#0b0b12'; c.fillText('LV' + n, x + pw / 2 + 0.5, y + bs / 2 + 0.5);
      }
      // 5.8: a gold star over every tower with a pick waiting (veteran mutation or Ascend perk), so they stand out in a busy wave
      { const u = clamp(Math.round(tpx / 12), 2, 3); c.fillStyle = '#ffd84a';
        for (const t of G.towers) if (t.pending > 0 || t.ascPend > 0 || t.grow > 0) { const x = Math.round(bx2s(t.x * TILE)) + u, y = Math.round(by2s(t.y * TILE)) - 3 * u - (frame % 40 < 20 ? 0 : u);
          c.fillStyle = '#090b16'; c.fillRect(x - 1, y + u - 1, 5 * u + 2, 3 * u + 2); c.fillRect(x + 2 * u - 1, y - 1, u + 2, 5 * u + 2);
          c.fillStyle = '#ffd84a'; c.fillRect(x, y + 2 * u, 5 * u, u); c.fillRect(x + 2 * u, y, u, 5 * u); c.fillRect(x + u, y + u, 3 * u, 3 * u); } }
      if (best && big) {
        const t = best, aw = Math.round(clamp(tpx * 0.36, 9, 15)), ax = Math.round(bx2s(t.cx * TILE)) - aw / 2, ay = Math.round(by2s(t.y * TILE)) - aw - 4 - (frame % 30 < 15 ? 0 : 2) - (t.pending > 0 ? 16 : 0), nc = lvTier(towerLevel(t) + 1).col;
        const arrow = (o, k) => { c.beginPath(); c.moveTo(ax + aw / 2, ay - o); c.lineTo(ax + aw + o, ay + aw * 0.55 + o * k); c.lineTo(ax + aw * 0.68 + o * k, ay + aw * 0.55 + o * k); c.lineTo(ax + aw * 0.68 + o * k, ay + aw + o); c.lineTo(ax + aw * 0.32 - o * k, ay + aw + o); c.lineTo(ax + aw * 0.32 - o * k, ay + aw * 0.55 + o * k); c.lineTo(ax - o, ay + aw * 0.55 + o * k); c.closePath(); c.fill(); };
        c.fillStyle = '#090b16'; arrow(1.5, 0.5); c.fillStyle = frame % 30 < 20 ? nc : '#ffffff'; arrow(0, 0);
      }
    }
    // veterans waiting for a mutation: a bobbing badge above the tower
    c.font = '10px Silkscreen, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
    // v5.2: a small corner pip (one "ready" chip in the top bar does the shouting, not a badge on every tower)
    for (const t of G.towers) if (t.pending > 0) {
      const x = Math.round(bx2s(t.x * TILE + TILE)) - 5, y = Math.round(by2s(t.y * TILE)) + 1;
      c.fillStyle = '#090b16'; c.fillRect(x - 1, y - 1, 6, 6); c.fillStyle = frame % 40 < 30 ? PAL.warn : '#fff6c0'; c.fillRect(x, y, 4, 4);
    }
    // v5.8 an Ascension perk waiting to be picked: the same pip in orange, under the veteran one
    for (const t of G.towers) if (t.ascPend > 0) {
      const x = Math.round(bx2s(t.x * TILE + TILE)) - 5, y = Math.round(by2s(t.y * TILE)) + 8;
      c.fillStyle = '#090b16'; c.fillRect(x - 1, y - 1, 6, 6); c.fillStyle = frame % 40 < 30 ? '#ff8a2a' : '#ffd2a8'; c.fillRect(x, y, 4, 4);
    }
    c.restore();

    if (G.redAlert) { // a boss at the gate: the field pulses red and the frame throbs (v4.4 Red Alert)
      const k = 0.5 + 0.5 * Math.sin(frame / 4);
      c.fillStyle = hexA('#ff3355', 0.03 + 0.05 * k); c.fillRect(ox, oy, DW, DH);
      c.strokeStyle = hexA('#ff3355', 0.3 + 0.5 * k); c.lineWidth = 5; c.strokeRect(ox + 2.5, oy + 2.5, DW - 5, DH - 5);
    }
    if (G.stasisT > 0) { c.fillStyle = 'rgba(106,226,255,0.08)'; c.fillRect(ox, oy, DW, DH); }
    if (G.overclockT > 0 && frame % 10 < 5) { c.fillStyle = 'rgba(255,225,77,0.04)'; c.fillRect(ox, oy, DW, DH); }
    if (dt <= 0) flashes = [];
    for (const f of flashes) { f.life -= dt; c.fillStyle = hexA(f.col, Math.max(0, f.life / f.max) * f.a); c.fillRect(0, 0, W, H); }
    flashes = flashes.filter(f => f.life > 0);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const tz = 1 + (cam.z - 1) * 0.25;
    let lastFont = '';
    for (const T of texts) {
      T.life -= dt; T.y += T.vy * dt;
      const a = Math.min(1, T.life / T.max * 2), p = tileToScreen(T.x, T.y);
      const f = `${Math.round(T.size * tz)}px ${T.font || 'VT323, monospace'}`;
      if (f !== lastFont) { c.font = f; lastFont = f; }
      if (T.bub) { const tw = c.measureText(T.txt).width + 10, th = Math.round(T.size * tz) + 6; c.fillStyle = `rgba(8,8,20,${a * 0.85})`; c.fillRect(Math.round(p.x - tw / 2), Math.round(p.y - th / 2), Math.round(tw), th); c.fillRect(Math.round(p.x - 2), Math.round(p.y + th / 2), 4, 3); c.strokeStyle = `rgba(255,255,255,${a * 0.5})`; c.lineWidth = 1; c.strokeRect(Math.round(p.x - tw / 2) + 0.5, Math.round(p.y - th / 2) + 0.5, Math.round(tw) - 1, th - 1); }
      c.fillStyle = `rgba(0,0,0,${a * 0.8})`; c.fillText(T.txt, p.x + 1, p.y + 1);
      c.fillStyle = hexA(T.col, a); c.fillText(T.txt, p.x, p.y);
    }
    texts = texts.filter(T => T.life > 0);
    if (texts.length > 30) texts.splice(0, texts.length - 30);
    if (G.bossAlive && !G.bossAlive.dead) {
      const e = G.bossAlive, bw = Math.min(260, W * 0.4), bx = (W - bw) / 2, by = 6;
      c.fillStyle = 'rgba(7,8,15,0.8)'; c.fillRect(bx - 4, by - 2, bw + 8, e.gen || e.boss === 'gloop' ? 22 : 31);
      c.font = '10px Silkscreen, monospace'; c.fillStyle = e.redAlert && frame % 10 < 5 ? '#ffffff' : '#ff9aac'; c.textAlign = 'left';
      c.fillText((e.redAlert ? 'RED ALERT · ' : '') + e.bossName.toUpperCase() + (e.bossTitle ? ' · ' + e.bossTitle.toUpperCase() : '') + (e.elite.length ? ' · ' + e.elite.map(id => ELITE_AFFIXES.find(a => a.id === id).name).join(' · ') : ''), bx, by + 5);
      c.fillStyle = '#3a0a18'; c.fillRect(bx, by + 12, bw, 5);
      c.fillStyle = e.phaseT > 0 && frame % 8 < 4 ? '#ffffff' : '#ff3355'; c.fillRect(bx, by + 12, bw * Math.max(0, e.hp / e.maxHp), 5);
      if (!e.gen && e.boss !== 'gloop') { for (const th of BOSS_PHASES) { c.fillStyle = '#07080f'; c.fillRect(Math.round(bx + bw * th) - 1, by + 11, 2, 7); }
        c.font = '8px Silkscreen, monospace'; c.textAlign = 'right'; c.fillStyle = e.phase ? '#ff9aac' : '#8a8fa8'; c.fillText(e.phaseT > 0 ? 'SHIFTING' : ['PHASE I', 'PHASE II', 'FINAL PHASE'][e.phase || 0], bx + bw, by + 26); }
      if (e.shield > 0) { c.fillStyle = '#8ab6ff'; c.fillRect(bx, by + 12, bw * Math.min(1, e.shield / e.maxHp), 2); }
      c.textAlign = 'center';
    }
    // zoom minimap hint
    if (cam.z > 1.01) {
      const mw = 64, mh = mw * reg.h / reg.w, mx = W - mw - 8, my = H - mh - 8;
      c.fillStyle = 'rgba(7,8,15,0.7)'; c.fillRect(mx - 2, my - 2, mw + 4, mh + 4);
      c.drawImage(mapLayer, reg.x * RES, reg.y * RES, reg.w * RES, reg.h * RES, mx, my, mw, mh);
      for (const cc of G.caches || []) { c.fillStyle = (frame >> 3) % 2 ? CACHE_PAL[cc.kind || 'normal'][3] : '#3a3020'; c.fillRect(Math.round(mx + ((cc.x + 0.5) * TILE - reg.x) / reg.w * mw) - 1, Math.round(my + ((cc.y + 0.5) * TILE - reg.y) / reg.h * mh) - 1, 3, 3); }
      c.strokeStyle = PAL.amber; c.lineWidth = 1; c.strokeRect(mx + (v.vx - reg.x) / reg.w * mw, my + (v.vy - reg.y) / reg.h * mh, v.vw / reg.w * mw, v.vh / reg.h * mh);
    }
    // scanlines: one dark row every 3 px, drawn as plain stripes in one path. v5.3.2: a repeating createPattern fill left three
    // white seams across the field on iPhone Safari (Nic's display test isolated it), so no patterns here
    c.fillStyle = 'rgba(0,0,0,0.13)'; c.beginPath(); for (let y = 2; y < H; y += 3) c.rect(0, y, W, 1); c.fill();
  }

  // ---------- fx hook ----------
  const T2P = v => v * TILE;
  function burst(x, y, n, col, spd, life, g, s) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, v = spd * (0.3 + Math.random());
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.6 + Math.random() * 0.6), max: life, col, g: g || 0, s: s || (Math.random() < 0.4 ? 1 : Math.random() < 0.7 ? 1.5 : 2) });
    }
  }
  function text(x, y, txt, col, size, life, vy, font) { texts.push({ x, y, txt, col, size, life, max: life, vy: vy === undefined ? -0.8 : vy, font }); }
  const K = TILE / 10;
  function fx(type, d) {
    switch (type) {
      case 'build': rings.push({ x: T2P(d.x), y: T2P(d.y), r0: 4, r1: 22, life: 0.35, max: 0.35, col: d.col }); burst(T2P(d.x), T2P(d.y), 14, d.col, 30 * K, 0.4); break;
      case 'upgrade': rings.push({ x: T2P(d.x), y: T2P(d.y), r0: 22, r1: 4, life: 0.4, max: 0.4, col: d.col }); burst(T2P(d.x), T2P(d.y), 18, d.col, 25 * K, 0.6, -30 * K); break;
      case 'sell': burst(T2P(d.x), T2P(d.y), 16, '#8a8aa6', 20 * K, 0.5, 30 * K); break;
      case 'num': if (!showNums || (!fullHud && !d.crit && !d.combo) || texts.length > 22) return; text(d.x + (Math.random() - 0.5) * 0.4, d.y - 0.5, fmt(d.v) + (d.crit ? '!' : ''), d.crit ? '#ffffff' : d.col, d.crit ? 18 : 15, 0.7); break;
      case 'combo': {
        rings.push({ x: T2P(d.x), y: T2P(d.y), r0: 4, r1: 28, life: 0.3, max: 0.3, col: d.col });
        const now = performance.now();
        if (now - (comboLast[d.name] || 0) < 700 || texts.filter(T => T.combo).length >= 3) break;
        comboLast[d.name] = now;
        text(d.x, d.y - 0.9, d.name, d.col, 13, 0.9, -1, 'Silkscreen, monospace'); texts[texts.length - 1].combo = 1;
        break;
      }
      case 'boom':
        // v5.8: each payload lands differently. Cluster bomblets pop small; EMP shells flash a white disc with jagged arcs and a kick
        if (d.k === 'bomblet') { const x = T2P(d.x), y = T2P(d.y); rings.push({ x, y, r0: 1, r1: Math.max(5, d.r * TILE * 0.8), life: 0.18, max: 0.18, col: d.col, fill: 1, w: 1 }); burst(x, y, LITE ? 2 : 5, d.col, 25 * K, 0.2); stars.push({ x, y, life: 0.05, max: 0.05, col: '#ffffff', s: 2, disc: 1 }); break; }
        if (d.k === 'mortar') { const x = T2P(d.x), y = T2P(d.y), R0 = d.r * TILE, bo = d.t && d.t.spec === 1;
          stars.push({ x, y, life: 0.06, max: 0.06, col: '#ffffff', s: Math.max(5, R0 * 0.45), disc: 1 });
          for (let i = 0, n = LITE ? 2 : bo ? 7 : 5; i < n; i++) { const a = Math.random() * 6.283, L0 = R0 * (0.6 + Math.random() * 0.45), pts = [{ x, y }];
            for (let j = 1; j <= 3; j++) { const u = j / 3; pts.push({ x: x + Math.cos(a) * L0 * u + (j < 3 ? (Math.random() - 0.5) * 7 : 0), y: y + Math.sin(a) * L0 * u + (j < 3 ? (Math.random() - 0.5) * 7 : 0) }); }
            lines.push({ pts, life: bo ? 0.22 : 0.15, max: bo ? 0.22 : 0.15, col: i % 2 ? '#fff6c0' : d.col, core: 1, w: 1.5 }); }
          kick(2, 0.4); }
        else if (d.k === 'missile') stars.push({ x: T2P(d.x), y: T2P(d.y), life: 0.05, max: 0.05, col: '#fff2c0', s: Math.max(3, d.r * TILE * 0.35), disc: 1 });
        rings.push({ x: T2P(d.x), y: T2P(d.y), r0: 2, r1: Math.max(6, d.r * TILE), life: d.big ? 0.6 : 0.25, max: d.big ? 0.6 : 0.25, col: d.col, fill: 1, w: d.big ? 3 : 2 }); burst(T2P(d.x), T2P(d.y), d.big ? 70 : 10, d.col, (d.big ? 90 : 35) * K, d.big ? 0.8 : 0.35); if (d.big) flashes.push({ col: '#ffe9b0', life: 0.25, max: 0.25, a: 0.35 }); break;
      case 'spark': burst(T2P(d.x), T2P(d.y), 3, d.col, 30 * K, 0.15); stars.push({ x: T2P(d.x), y: T2P(d.y), life: 0.03, max: 0.03, col: '#ffffff', s: 2 }); break; // v5.8: a one-frame white + on each bolt impact
      case 'rail': {
        if (!d.t) { lines.push({ pts: [{ x: T2P(d.x1), y: T2P(d.y1) }, { x: T2P(d.x2), y: T2P(d.y2) }], life: 0.18, max: 0.18, col: d.col, core: 1, w: d.crit ? 5 : 3 }); break; }
        // v5.8 Rail Lance: the beam fades over ~0.25 s with small rings rippling along it and a white burst on each enemy it pierces.
        // Gauss Spire burns thicker and longer; Splinter Rail throws splinters off each pierced enemy. A crit kicks the screen
        const sp = d.t.spec || 0, big = d.t.asc ? 1 : 0, x1 = T2P(d.x1), y1 = T2P(d.y1), x2 = T2P(d.x2), y2 = T2P(d.y2), life = sp === 1 ? 0.32 : 0.25, dx = x2 - x1, dy = y2 - y1, dl = Math.hypot(dx, dy) || 1;
        lines.push({ pts: [{ x: x1 + dx / dl * 12, y: y1 + dy / dl * 12 }, { x: x2, y: y2 }], life, max: life, col: d.col, core: 1, w: (d.crit ? 5 : 3) + (sp === 1 ? 1.5 : 0) + big });
        if (!LITE) for (let k = 1; k <= 3; k++) rings.push({ x: x1 + dx * k / 4, y: y1 + dy * k / 4, r0: 1, r1: 5 + (sp === 1 ? 2 : 0), life: 0.22, max: 0.22, col: d.col, w: 1, dl: k * 0.025, nl: 1 });
        for (const q of d.hp || []) { const hx = T2P(q.x), hy = T2P(q.y); stars.push({ x: hx, y: hy, life: 0.07, max: 0.07, col: '#ffffff', s: 3 + big, disc: 1 }); if (!LITE) burst(hx, hy, 3, '#ffffff', 35 * K, 0.14);
          if (sp === 2 && !LITE) for (const sgn of [-1, 1]) { const a = Math.atan2(dy, dx) + sgn * (0.5 + Math.random() * 0.4), L2 = 6 + Math.random() * 5; lines.push({ pts: [{ x: hx, y: hy }, { x: hx + Math.cos(a) * L2, y: hy + Math.sin(a) * L2 }], life: 0.14, max: 0.14, col: d.col, core: 1, w: 1 }); } }
        if (d.crit) kick(1.5);
        break; }
      case 'chain': case 'zap': {
        const pts = d.pts || [{ x: d.x1, y: d.y1 }, { x: d.x2, y: d.y2 }];
        const bolt = () => { const out = []; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], c2 = pts[i + 1]; for (let k = 0; k < 5; k++) { const tt = k / 5; out.push({ x: T2P(lerp(a.x, c2.x, tt)) + (k ? (Math.random() - 0.5) * 10 : 0), y: T2P(lerp(a.y, c2.y, tt)) + (k ? (Math.random() - 0.5) * 10 : 0) }); } }
          const last = pts[pts.length - 1]; out.push({ x: T2P(last.x), y: T2P(last.y) }); return out; };
        if (!d.t) { lines.push({ pts: bolt(), life: 0.14, max: 0.14, col: d.col, core: 1, w: 2 }); break; }
        // v5.8 Arc Coil: the bolt is drawn twice with fresh jitter (a flicker) and a star lands on every hop.
        // Tesla Crown forks at each hop; Overvolt burns a thicker orange bolt
        const sp = d.t.spec || 0, col = sp === 2 ? '#ff9a3c' : d.col, w = (sp === 2 ? 3 : 2) + (d.t.asc ? 1 : 0);
        lines.push({ pts: bolt(), life: 0.14, max: 0.14, col, core: 1, w });
        if (!LITE) lines.push({ pts: bolt(), life: 0.09, max: 0.09, col, core: 1, w: Math.max(1, w - 1), dl: 0.05, nl: 1 });
        for (let i = 1; i < pts.length; i++) { const hx = T2P(pts[i].x), hy = T2P(pts[i].y); stars.push({ x: hx, y: hy, life: 0.12, max: 0.12, col, s: sp === 2 ? 4 : 3 });
          if (sp === 1 && !LITE) { const a0 = pts[i - 1], ang = Math.atan2(pts[i].y - a0.y, pts[i].x - a0.x) + (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.6), mx = T2P((a0.x + pts[i].x) / 2), my = T2P((a0.y + pts[i].y) / 2), L2 = 6 + Math.random() * 6;
            lines.push({ pts: [{ x: mx, y: my }, { x: mx + Math.cos(ang) * L2 * 0.5 + (Math.random() - 0.5) * 3, y: my + Math.sin(ang) * L2 * 0.5 + (Math.random() - 0.5) * 3 }, { x: mx + Math.cos(ang) * L2, y: my + Math.sin(ang) * L2 }], life: 0.12, max: 0.12, col, core: 1, w: 1, nl: 1 }); } }
        break;
      }
      case 'ovstun': { const x = T2P(d.x), y = T2P(d.y); rings.push({ x, y, r0: 2, r1: 9, life: 0.2, max: 0.2, col: '#ff9a3c', w: 1.5 }); if (!LITE) burst(x, y, 4, '#ffd28a', 30 * K, 0.2); kick(1, 0.8); break; }
      case 'flame': { // v5.8: wedges that grow and cool from white through orange to smoke (Inferno redder, Plasma Torch blue-white)
        const fl = d.t && d.t.spec === 1 ? 2 : d.t && d.t.spec === 2 ? 3 : 1;
        for (let i = 0, n = LITE ? 3 : 6; i < n; i++) { const a = d.ang + (Math.random() - 0.5) * 1.0, v = (d.range * TILE) * (2 + Math.random()); parts.push({ x: T2P(d.x) + Math.cos(d.ang) * 11, y: T2P(d.y) + Math.sin(d.ang) * 11, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.32, max: 0.32, fl, s: fl === 2 ? 2.4 : 2 }); }
        break; }
      case 'pulse': { // Cryo: ice shards fly out with the ring. Glacier Core: a slower, thicker white ring. Shatter Field: a cracked ring with tinks
        const sp = d.t ? d.t.spec || 0 : 0, x = T2P(d.x), y = T2P(d.y), R0 = d.r * TILE;
        if (sp === 1) rings.push({ x, y, r0: 4, r1: R0, life: 0.55, max: 0.55, col: '#dff6ff', fill: 1, w: 3 });
        else if (sp === 2) { rings.push({ x, y, r0: 4, r1: R0, life: 0.35, max: 0.35, col: d.col, fill: 1, dash: [5, 2, 2, 3] });
          if (!LITE) for (let i = 0; i < 4; i++) { const a = Math.random() * 6.283, rr = R0 * (0.5 + Math.random() * 0.45); stars.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr, life: 0.1, max: 0.1, col: '#e6fbff', s: 2, dl: rr / R0 * 0.3 }); } }
        else rings.push({ x, y, r0: 4, r1: R0, life: 0.35, max: 0.35, col: d.col, fill: 1 });
        if (!LITE) { const life = sp === 1 ? 0.5 : 0.32; for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + Math.random() * 0.8, v = R0 / life * 0.95; parts.push({ x: x + Math.cos(a) * 4, y: y + Math.sin(a) * 4, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, col: i % 2 ? '#ffffff' : '#bff4ff', s: 1.5 }); } }
        break; }
      case 'grav': { // Gravity Well: inward spiral arcs and a drag streak on every enemy it pulls. Singularity darker; Tidal Lock a double teal ring
        const sp = d.t ? d.t.spec || 0 : 0, x = T2P(d.x), y = T2P(d.y), R0 = d.r * TILE, col = sp === 2 ? '#4fd8c8' : sp === 1 ? '#7a3aff' : '#b86cff';
        rings.push({ x, y, r0: R0, r1: 2, life: sp === 2 ? 0.7 : 0.5, max: sp === 2 ? 0.7 : 0.5, col, w: 3 });
        if (sp === 2) rings.push({ x, y, r0: R0 * 0.8, r1: 2, life: 0.7, max: 0.7, col: '#9ff2e6', w: 2, dl: 0.1 });
        if (sp === 1) stars.push({ x, y, life: 0.25, max: 0.25, col: '#0a0614', s: 6, disc: 1 });
        if (!LITE) for (let arm = 0; arm < 3; arm++) { const a0 = arm / 3 * 6.283 + Math.random(), pts = []; for (let j = 0; j <= 8; j++) { const u = j / 8, rr = R0 * (1 - u * 0.85), an = a0 + u * 2.4; pts.push({ x: x + Math.cos(an) * rr, y: y + Math.sin(an) * rr }); } lines.push({ pts, life: 0.4, max: 0.4, col, core: 0, w: 1.5, nl: 1 }); }
        if (d.es) for (let i = 0; i < d.es.length && i < 24; i++) { const e = d.es[i]; drags.push({ e, x0: e.x * TILE, y0: e.y * TILE, life: 0.15, col }); }
        break; }
      case 'flamering': for (let i = 0; i < 8; i++) { const an = Math.random() * 6.2832, v = (d.range * TILE) * (2 + Math.random()); parts.push({ x: T2P(d.x), y: T2P(d.y), vx: Math.cos(an) * v, vy: Math.sin(an) * v, life: 0.28, max: 0.28, col: Math.random() < 0.5 ? d.col : '#ffe14d', s: 3 }); } break; // v5.8 Backdraft
      case 'death': burst(T2P(d.x), T2P(d.y), d.boss ? (d.gen ? 40 : 100) : d.elite ? 22 : 9, d.boss ? (BOSS_COL[d.boss] || '#ff3355') : (ENEMY_COL[d.type] || '#ff5470'), (d.boss ? 70 : 30) * K, d.boss ? 1.2 : 0.4); if (d.boss) { flashes.push({ col: '#ffffff', life: 0.3, max: 0.3, a: 0.4 }); shakeAt(8, 0.5); } if (fullHud && d.cr) text(d.x, d.y - 0.6, '+' + d.cr, PAL.amber, 13, 0.6, -0.6); break;
      case 'arcs': for (let i = 0; i < 5; i++) { const a = Math.random() * 6.283, rr = d.r * TILE; lines.push({ pts: [{ x: T2P(d.x), y: T2P(d.y) }, { x: T2P(d.x) + Math.cos(a) * rr * 0.5 + (Math.random() - 0.5) * 10, y: T2P(d.y) + Math.sin(a) * rr * 0.5 }, { x: T2P(d.x) + Math.cos(a) * rr, y: T2P(d.y) + Math.sin(a) * rr }], life: 0.18, max: 0.18, col: '#9ff2ff', core: 1, w: 2 }); } break;
      case 'heal': rings.push({ x: T2P(d.x), y: T2P(d.y), r0: 2, r1: 36, life: 0.4, max: 0.4, col: '#7dffb0' });
        for (const o of d.to || []) { lines.push({ pts: [{ x: T2P(d.x), y: T2P(d.y) }, { x: T2P(o.x), y: T2P(o.y) }], life: 0.45, max: 0.45, col: '#7dffb0', core: 1, w: 2 }); text(o.x, o.y - 0.5, '+', '#7dffb0', 14, 0.5, -0.8); }
        break;
      case 'shieldpulse': rings.push({ x: T2P(d.x), y: T2P(d.y), r0: 2, r1: 36, life: 0.5, max: 0.5, col: '#8ab6ff' });
        for (const o of d.to || []) lines.push({ pts: [{ x: T2P(d.x), y: T2P(d.y) }, { x: T2P(o.x), y: T2P(o.y) }], life: 0.4, max: 0.4, col: '#8ab6ff', core: 0, w: 1 });
        break;
      case 'shieldbreak': for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283 + Math.random() * 0.3; parts.push({ x: T2P(d.x) + Math.cos(a) * 10, y: T2P(d.y) + Math.sin(a) * 10, vx: Math.cos(a) * 40 * K, vy: Math.sin(a) * 40 * K, life: 0.4, max: 0.4, col: i % 2 ? '#c8e8ff' : '#7fd4ff', s: 3 }); } rings.push({ x: T2P(d.x), y: T2P(d.y), r0: 14, r1: 22, life: 0.25, max: 0.25, col: '#c8e8ff', w: 2 }); break;
      case 'ping': burst(T2P(d.x), T2P(d.y), 4, '#e9e4d4', 35 * K, 0.18); if (texts.filter(T => T.ping).length < 3) { text(d.x + 0.3, d.y - 0.6, 'tink', '#c8c4b8', 11, 0.4, -0.6, 'Silkscreen, monospace'); texts[texts.length - 1].ping = 1; } break;
      case 'glance': { const x = T2P(d.x), y = T2P(d.y), a = d.sx !== undefined ? Math.atan2(d.y - d.sy, d.x - d.sx) + Math.PI * (0.7 + Math.random() * 0.6) : Math.random() * 6.283;
        lines.push({ pts: [{ x, y }, { x: x + Math.cos(a) * 22, y: y + Math.sin(a) * 22 }], life: 0.2, max: 0.2, col: '#ffffff', core: 1, w: 2 }); burst(x, y, 5, '#cfe6ff', 40 * K, 0.2); break; }
      case 'sap': lines.push({ pts: [{ x: T2P(d.x1), y: T2P(d.y1) }, { x: T2P(d.x2), y: T2P(d.y2) }], life: 0.5, max: 0.5, col: '#ff3355', core: 1, w: 2 }); rings.push({ x: T2P(d.x2), y: T2P(d.y2), r0: 4, r1: 20, life: 0.4, max: 0.4, col: '#ff3355', w: 2, fill: 1 }); burst(T2P(d.x2), T2P(d.y2), 14, '#ffa860', 40 * K, 0.4); break;
      case 'drop': rings.push({ x: T2P(d.x), y: T2P(d.y), r0: 2, r1: 18, life: 0.35, max: 0.35, col: '#ffe14d', w: 2 }); burst(T2P(d.x), T2P(d.y), 6, '#ffe14d', 25 * K, 0.3, 30 * K); break;
      case 'blink': burst(T2P(d.x), T2P(d.y), 14, '#b86cff', 40 * K, 0.3); break;
      case 'lure': lines.push({ pts: [{ x: T2P(d.x1), y: T2P(d.y1) }, { x: T2P(d.x2), y: T2P(d.y2) }], life: 0.35, max: 0.35, col: '#59f0b4', core: 0, w: 1 });
        if (d.t && d.t.spec === 2) rings.push({ x: T2P(d.x1), y: T2P(d.y1), r0: 4, r1: 30, life: 0.5, max: 0.5, col: '#59f0b4', w: 1, a: 0.6, nl: 1 }); break;
      case 'net': rings.push({ x: T2P(d.x), y: T2P(d.y), r0: 14, r1: 3, life: 0.35, max: 0.35, col: '#59f0b4', w: 2 }); burst(T2P(d.x), T2P(d.y), 8, '#c9fff0', 20 * K, 0.3);
        if (d.t && d.t.spec === 1) rings.push({ x: T2P(d.x), y: T2P(d.y), r0: 20, r1: 6, life: 0.45, max: 0.45, col: '#9fffd8', w: 1, dash: [2, 2] }); break;
      case 'say': if (texts.filter(T => T.bub).length >= 4) break; text(d.x, d.y - 1.5, d.t, '#ffffff', 13, 1.6, -0.35, 'Silkscreen, monospace'); texts[texts.length - 1].bub = 1; break;
      case 'song': for (let i = 0; i < 3; i++) rings.push({ x: T2P(d.x), y: T2P(d.y), r0: 6 + i * 10, r1: d.r * TILE, life: 0.6 + i * 0.25, max: 0.6 + i * 0.25, col: '#9fe7ff', w: 2 }); burst(T2P(d.x), T2P(d.y), 12, '#7dffb0', 30 * K, 0.6, -20 * K); break;
      case 'noodle': { const out = []; for (let k = 0; k <= 10; k++) { const t = k / 10, w = Math.sin(t * Math.PI * 3) * 8 * Math.sin(t * Math.PI); const dx = d.x2 - d.x1, dy = d.y2 - d.y1, L = Math.hypot(dx, dy) || 1; out.push({ x: T2P(lerp(d.x1, d.x2, t)) - dy / L * w, y: T2P(lerp(d.y1, d.y2, t)) + dx / L * w }); } lines.push({ pts: out, life: 0.7, max: 0.7, col: '#f2d27a', core: 0, w: 4 }); break; }
      case 'emp': rings.push({ x: T2P(d.x), y: T2P(d.y), r0: 2, r1: d.r * TILE, life: 0.4, max: 0.4, col: '#ffe14d', w: 3 }); burst(T2P(d.x), T2P(d.y), 10, '#ffffff', 40 * K, 0.25); break;
      case 'freeze': burst(T2P(d.x), T2P(d.y), 12, '#d8f8ff', 25 * K, 0.4); break;
      case 'implode': rings.push({ x: T2P(d.x), y: T2P(d.y), r0: d.r * TILE, r1: 0, life: 0.6, max: 0.6, col: '#b86cff', fill: 1, w: 3 }); for (let i = 0; i < 40; i++) { const a = Math.random() * 6.283, rr = d.r * TILE; parts.push({ x: T2P(d.x) + Math.cos(a) * rr, y: T2P(d.y) + Math.sin(a) * rr, vx: -Math.cos(a) * rr * 2, vy: -Math.sin(a) * rr * 2, life: 0.45, max: 0.45, col: '#d6a6ff', s: 2 }); } break;
      case 'leak': coreKick = d.boss ? 1 : Math.max(coreKick, 0.6); rings.push({ x: d.x * TILE, y: d.y * TILE, r0: 14, r1: d.boss ? 70 : 42, life: 0.4, max: 0.4, col: '#ff3355', w: d.boss ? 4 : 2.5 }); flashes.push({ col: '#ff3355', life: d.boss ? 0.6 : 0.25, max: d.boss ? 0.6 : 0.25, a: d.boss ? 0.45 : 0.2 }); shakeAt(d.boss ? 10 : 4, d.boss ? 0.6 : 0.2); burst(T2P(d.x), T2P(d.y), 18, '#ff3355', 50 * K, 0.5); break;
      case 'strike': lines.push({ pts: [{ x: T2P(d.x), y: -10 }, { x: T2P(d.x), y: T2P(d.y) }], life: 0.6, max: 0.6, col: '#ffe9b0', core: 1, w: 6 }); rings.push({ x: T2P(d.x), y: T2P(d.y), r0: 1.7 * TILE, r1: 2, life: 0.6, max: 0.6, col: '#ffe9b0', w: 3 }); break;
      case 'nova': flashes.push({ col: '#b86cff', life: 0.6, max: 0.6, a: 0.5 }); rings.push({ x: G.core.x * TILE, y: G.core.y * TILE, r0: 4, r1: BW, life: 0.7, max: 0.7, col: '#d6a6ff', w: 4 }); break;
      case 'stasis': flashes.push({ col: '#6ae2ff', life: 0.5, max: 0.5, a: 0.4 }); break;
      case 'scan': rings.push({ x: T2P(d.x), y: T2P(d.y), r0: 4, r1: BW * 1.2, life: 1.1, max: 1.1, col: '#7dffb0', w: 3 }); rings.push({ x: T2P(d.x), y: T2P(d.y), r0: 4, r1: BW * 0.7, life: 0.8, max: 0.8, col: '#c9fff0', w: 1 }); flashes.push({ col: '#7dffb0', life: 0.25, max: 0.25, a: 0.12 }); break;
      case 'overclock': flashes.push({ col: '#ffe14d', life: 0.3, max: 0.3, a: 0.3 }); for (const t of G.towers) burst(t.cx * TILE, t.cy * TILE, 6, '#ffe14d', 30 * K, 0.4); break;
      case 'rift': burst(T2P(d.x), T2P(d.y), 40, '#b86cff', 50 * K, 0.8); break;
      case 'overdrive': startNuke(T2P(d.x), T2P(d.y), d.r); break; // 6.2: the Nuke (the fx id stays 'overdrive')
      // 6.2: a support tower grew a level with its towers: a soft double ring, rising motes and the new level
      case 'grow': rings.push({ x: T2P(d.x), y: T2P(d.y), r0: 4, r1: 20, life: 0.5, max: 0.5, col: PAL.core, w: 2 }); rings.push({ x: T2P(d.x), y: T2P(d.y), r0: 2, r1: 12, life: 0.7, max: 0.7, col: '#e6fff6', w: 1 });
        for (let i = 0; i < 10; i++) parts.push({ x: T2P(d.x) + (Math.random() - 0.5) * 16, y: T2P(d.y) + 4, vx: (Math.random() - 0.5) * 6, vy: -22 - Math.random() * 18, life: 0.8, max: 0.8, col: i % 3 ? PAL.core : '#e6fff6', s: 2 });
        text(d.x, d.y - 0.7, 'LV ' + d.lv, PAL.core, 14, 1.2, -0.6, 'Silkscreen, monospace'); break;
      case 'cache': rings.push({ x: T2P(d.x), y: T2P(d.y), r0: 30, r1: 4, life: 0.6, max: 0.6, col: '#ffe14d', w: 2 }); break;
      case 'cacheClaim': { const cc = CACHE_PAL[d.kind || 'normal'][3]; rings.push({ x: T2P(d.x), y: T2P(d.y), r0: 4, r1: d.kind === 'gold' ? 60 : 34, life: 0.5, max: 0.5, col: cc, w: 3, fill: 1 }); burst(T2P(d.x), T2P(d.y), d.kind === 'gold' ? 50 : 22, cc, 50 * K, 0.6); break; }
      case 'wormhole': { const p0 = d.lane.tiles[0]; rings.push({ x: (p0.x + 0.5) * TILE, y: (p0.y + 0.5) * TILE, r0: 40, r1: 2, life: 0.8, max: 0.8, col: '#b86cff', w: 3 }); burst((p0.x + 0.5) * TILE, (p0.y + 0.5) * TILE, 30, '#d6a6ff', 40 * K, 0.7); shakeAt(3, 0.25); break; }
      case 'lane': flashes.push({ col: '#ff4d6a', life: 0.5, max: 0.5, a: 0.3 }); { const p0 = d.lane.tiles[0]; rings.push({ x: (p0.x + 0.5) * TILE, y: (p0.y + 0.5) * TILE, r0: 2, r1: 56, life: 0.7, max: 0.7, col: '#ff4d6a', w: 4, fill: 1 }); } for (const p of d.lane.tiles.slice(0, d.lane.branch || 99)) burst(p.x * TILE + 12, p.y * TILE + 12, 4, '#ff4d6a', 20 * K, 0.8); break;
      case 'meteor': lines.push({ pts: [{ x: T2P(d.x) - 70, y: T2P(d.y) - 120 }, { x: T2P(d.x), y: T2P(d.y) }], life: 0.5, max: 0.5, col: '#ff7b39', core: 1, w: 5 }); break;
      case 'elite': burst(T2P(d.x), T2P(d.y), 10, '#ffe14d', 25 * K, 0.5); break;
      case 'jam': case 'fizzle': burst(T2P(d.x), T2P(d.y), 8, '#8a8aa6', 20 * K, 0.4, -20 * K); break;
      case 'plates': burst(T2P(d.x), T2P(d.y), 40, '#a4aac4', 60 * K, 0.8, 60 * K, 3); shakeAt(6, 0.3); break;
      case 'coin': text(d.x, d.y - 0.6, d.v < 0 ? '−' + Math.abs(d.v) : '+' + d.v, d.v < 0 ? PAL.bad : PAL.amber, 15, 1, -0.6);
        // v5.8 Credit Forge payout: a spray of sparks out of the furnace
        if (d.forge && !LITE) { for (let i = 0; i < 14; i++) parts.push({ x: T2P(d.x) + (Math.random() - 0.5) * 8, y: T2P(d.y) - 2, vx: (Math.random() - 0.5) * 50, vy: -40 - Math.random() * 45, g: 150, life: 0.7, max: 0.7, col: Math.random() < 0.3 ? '#ffffff' : Math.random() < 0.6 ? '#ffe14d' : '#ffb03a', s: 2 }); stars.push({ x: T2P(d.x), y: T2P(d.y), life: 0.08, max: 0.08, col: '#ffe14d', s: 4 }); }
        break;
      case 'shake': shakeAt(d.v, 0.3); break;
      case 'burrow': rings.push({ x: T2P(d.x), y: T2P(d.y), r0: 2, r1: TILE * 1.6, life: 0.5, max: 0.5, col: '#c46cff', w: 3, fill: 1 }); rings.push({ x: T2P(d.x), y: T2P(d.y), r0: TILE * 1.8, r1: 2, life: 0.5, max: 0.5, col: '#5cf2ff', w: 2 }); burst(T2P(d.x), T2P(d.y), 30, '#c46cff', 60 * K, 0.5); break;
      case 'swallow': lines.push({ pts: [{ x: T2P(d.x1), y: T2P(d.y1) }, { x: T2P(d.x2), y: T2P(d.y2) }], life: 0.45, max: 0.45, col: d.back ? '#59f0b4' : '#c46cff', core: 1, w: 5 }); burst(T2P(d.x1), T2P(d.y1), 24, d.back ? '#59f0b4' : '#c46cff', 50 * K, 0.5); break;
      case 'audit': lines.push({ pts: [{ x: T2P(d.x1), y: T2P(d.y1) }, { x: T2P(d.x2), y: T2P(d.y2) }], life: 0.5, max: 0.5, col: '#ffd83a', w: 2 }); burst(T2P(d.x2), T2P(d.y2), 10, '#ffd83a', 30 * K, 0.4); break;
      case 'bossPhase': { const col = BOSS_COL[d.boss] || '#ff3355';
        flashes.push({ col: '#ff3355', life: 0.35, max: 0.35, a: 0.35 });
        rings.push({ x: T2P(d.x), y: T2P(d.y), r0: 6, r1: TILE * 4, life: 0.7, max: 0.7, col, w: 4, fill: 1 });
        rings.push({ x: T2P(d.x), y: T2P(d.y), r0: 2, r1: TILE * 6, life: 1, max: 1, col: '#ffffff', w: 2 });
        burst(T2P(d.x), T2P(d.y), 80, col, 110 * K, 0.9); break; }
      case 'cash': flashes.push({ col: '#ffb03a', life: 0.25, max: 0.25, a: 0.18 }); break;
    }
  }
  function shakeAt(v, t) { shake = Math.max(shakeT > 0 ? shake : 0, v); shakeT = Math.max(shakeT, t); }

  function init(canvas) {
    cv = canvas; ctx = cv.getContext('2d');
    buf = document.createElement('canvas'); b = buf.getContext('2d');
    mapLayer = document.createElement('canvas');
    mid = document.createElement('canvas'); mctx = mid.getContext('2d');
    lightCv = document.createElement('canvas'); lctx = lightCv.getContext('2d');
    resize();
  }
  function resize() {
    const r = cv.parentElement.getBoundingClientRect();
    dpr = Math.min(3, window.devicePixelRatio || 1) * UIS;
    W = Math.max(1, r.width / UIS); H = Math.max(1, r.height / UIS);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    fit();
  }
  function reset() { nuke = null; parts = []; rings = []; lines = []; texts = []; flashes = []; stars = []; drags = []; conduits = []; vigKey = ''; mapDirty = true; mapKey = ''; selTile = null; selTower = null; preview = null; bufW = 0; }

  // build-menu card art: the tower on a lit plinth against its element's colour
  function towerCard(type, canvas, locked) {
    const W2 = 34, H2 = 22, el = TOWERS[type].el, c = EL[el].col, Z = 4;
    canvas.width = W2 * Z; canvas.height = H2 * Z;
    const g = canvas.getContext('2d'); g.imageSmoothingEnabled = false; g.setTransform(Z, 0, 0, Z, 0, 0);
    const bg = g.createLinearGradient(0, 0, 0, H2); bg.addColorStop(0, locked ? '#0c0d16' : sh(c, -0.78)); bg.addColorStop(1, '#06070d');
    g.fillStyle = bg; g.fillRect(0, 0, W2, H2);
    if (!locked) {
      const rg = g.createRadialGradient(17, 11, 1, 17, 11, 15); rg.addColorStop(0, hexA(c, 0.45)); rg.addColorStop(1, hexA(c, 0));
      g.fillStyle = rg; g.fillRect(0, 0, W2, H2);
      let sd = type.length * 97; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      for (let k = 0; k < 7; k++) { g.fillStyle = rnd() < 0.5 ? '#ffffff' : sh(c, 0.4); g.globalAlpha = 0.25 + rnd() * 0.5; g.fillRect(Math.floor(rnd() * W2), Math.floor(rnd() * 10), 1, 1); }
      g.globalAlpha = 1;
      g.fillStyle = hexA(c, 0.5); g.fillRect(4, 19, 26, 1); g.fillStyle = hexA(c, 0.22); g.fillRect(2, 20, 30, 1);
    }
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(9, 18, 16, 2);
    const ic = UNITS.icon(type, el);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    if (locked) { g.globalAlpha = 0.9; g.drawImage(tintOf(ic, '#151829'), 6, -0.5, 22, 22); g.globalAlpha = 1; }
    else g.drawImage(ic, 6, -0.5, 22, 22);
  }
  function towerIcon(type, canvas) {
    if (!canvas.dataset.sized) { const cs = getComputedStyle(canvas); canvas.style.width = cs.width && cs.width !== 'auto' ? cs.width : canvas.width + 'px'; canvas.style.height = cs.height && cs.height !== 'auto' ? cs.height : canvas.height + 'px'; canvas.width = canvas.height = 60; canvas.dataset.sized = 1; }
    const g = canvas.getContext('2d'), el = TOWERS[type].el;
    g.imageSmoothingEnabled = false; g.clearRect(0, 0, canvas.width, canvas.height);
    g.drawImage(UNITS.icon(type, el), 0, 0);
  }
  // setup preview: the whole map dimmed, with the starting sector lit and outlined
  function preview_map(canvas, map, frac) {
    const g = canvas.getContext('2d'), cols = map.tiles.length / ROWS, s = canvas.width / cols;
    canvas.height = Math.round(canvas.width * ROWS / cols);
    g.fillStyle = PAL.bg; g.fillRect(0, 0, canvas.width, canvas.height);
    const Rg = mapRegion(map.core, frac || REGION0);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < cols; x++) {
      const t = map.tiles[y * cols + x], inR = inRegion(x, y, Rg);
      g.fillStyle = t === 1 ? '#3a2f58' : t === 5 ? '#2a1d44' : t === 2 ? (inR ? '#3c4470' : '#1c2038') : t === 4 ? PAL.core : inR ? '#141831' : '#0c0e1d';
      g.fillRect(Math.floor(x * s), Math.floor(y * s), Math.ceil(s) - (t === 0 ? 1 : 0), Math.ceil(s) - (t === 0 ? 1 : 0));
    }
    const p = map.lanes[0].tiles[0];
    g.fillStyle = PAL.bad; g.fillRect(Math.floor(p.x * s), Math.floor(p.y * s), Math.ceil(s), Math.ceil(s));
    g.strokeStyle = 'rgba(184,108,255,0.8)'; g.lineWidth = 1; g.setLineDash([3, 3]);
    g.strokeRect(Math.round(Rg.x0 * s) + 0.5, Math.round(Rg.y0 * s) + 0.5, Math.round((Rg.x1 - Rg.x0) * s) - 1, Math.round((Rg.y1 - Rg.y0) * s) - 1);
    g.setLineDash([]);
  }
  return {
    set glow(v) { R_.glow = v; }, set sharp(v) { R_.sharp = v; },
    init, resize, draw, fx, reset, towerIcon, towerCard, preview_map, screenToTile, zoomAt, panBy, resetCam,
    set sel(v) { selTile = v; }, set hover(v) { hoverTile = v; }, set selT(v) { selTower = v; }, set prev(v) { preview = v; }, set aim(v) { aimPos = v; },
    set full(v) { fullHud = v; }, set nums(v) { showNums = v; }, set shakeOn(v) { doShake = v; },
    get fxCounts() { return { parts: parts.length, rings: rings.length, lines: lines.length, stars: stars.length, drags: drags.length, lite: LITE }; }, // v5.8 test hook
    get layout() { return { ox, oy, scale, W, H, z: cam.z }; }, get zoom() { return cam.z; }, get home() { return atHome; }, get homeZoom() { return homeZ(); }, overview, markMap() { mapDirty = true; },
    set onCam(f) { onCam = f; },
    tileToScreen,
    // draws a boss sprite, pixel-scaled, centred on a canvas (the boss intro card)
    // v5.1 an enemy's portrait for the inspect panel, the intro card and the Dictionary
    enemyIcon(type, cv) { const sp = type === 'pirate' ? UNITS.pirate(false) : UNITS.enemy(type, 0, 0) || enemySprite(type), g = cv.getContext('2d');
      if (!cv.dataset.sized) { cv.dataset.sized = 1; const cs = getComputedStyle(cv); if (cs.width && cs.width !== 'auto') { cv.style.width = cs.width; cv.style.height = cs.height; } cv.width = cv.height = 64; }
      const k = Math.min(cv.width / sp.width, cv.height / sp.height) * 0.9;
      g.clearRect(0, 0, cv.width, cv.height); g.imageSmoothingEnabled = false; g.drawImage(sp, Math.round((cv.width - sp.width * k) / 2), Math.round((cv.height - sp.height * k) / 2), sp.width * k, sp.height * k); },
    // v5.8: a gene's mark on a Drone, for the Threat Board, the recap and the Archive (canvas width attribute = CSS size)
    geneIcon(g, cv, el) { if (!GENES[g]) return; const gx = cv.getContext('2d');
      if (!cv.dataset.sized) { cv.dataset.sized = 1; const s0 = cv.width; cv.style.width = cv.style.height = s0 + 'px'; cv.width = cv.height = s0 * 3; }
      const W = cv.width, sp = UNITS.enemy('drone', 0, 0) || enemySprite('drone'), u = Math.max(2, Math.round(W / 15));
      const k = W * (g === 'bulk' ? 0.62 : 0.5) / Math.max(sp.width, sp.height), sw = sp.width * k, sh = sp.height * k, x = Math.round(W / 2), y = Math.round(W / 2 - (g === 'bulk' ? u : g === 'wings' ? -u : 0));
      gx.clearRect(0, 0, W, W); gx.imageSmoothingEnabled = false; gx.drawImage(sp, x - sw / 2, y - sh / 2, sw, sh);
      if (g === 'cloak') { gx.globalAlpha = 0.85; gx.drawImage(ditherOf(sp, '#c58cff'), x - sw / 2, y - sh / 2, sw, sh); gx.globalAlpha = 1; }
      if (g === 'regen') { gx.globalAlpha = 0.3; gx.drawImage(tintOf(sp, '#59f0b4'), x - sw / 2, y - sh / 2, sw, sh); gx.globalAlpha = 1; }
      geneMark(gx, g, x, y, sw * 0.4, sh * 0.4, u, { icon: 1, shield: 1, wardEl: el, st: {}, _ha: 0 }); },
    set hints(v) { hintTiles = v; }, set spots(v) { spotTiles = v; }, set selE(v) { selEnemy = v; }, set hoverE(v) { hoverEnemy = v; },
    flashWorm() { wormFlashAt = performance.now(); },
    set frSel(v) { frSel = v; }, get frArrows() { return frArrows; }, // Frontier picker and edge arrows
    arrowAt(sx, sy) { let best = null, bd = 26 * 26; for (const A of frArrows) { const d = (A.sx - sx) ** 2 + (A.sy - sy) ** 2; if (d < bd) { bd = d; best = A; } } return best; },
    lookAt(x, y) { cam.x = x * TILE; cam.y = y * TILE; clampCam(); atHome = false; if (onCam) onCam(); },
    bossPortrait(id, cv) { const sp = UNITS.boss(id, 0) || bossSprite(id), g = cv.getContext('2d');
      if (cv.width < sp.width * 2) { const cs = getComputedStyle(cv); cv.style.width = cs.width; cv.style.height = cs.height; cv.width = cv.height = sp.width * 2; }
      const k = Math.max(1, Math.floor(Math.min(cv.width / sp.width, cv.height / sp.height)));
      g.clearRect(0, 0, cv.width, cv.height); g.imageSmoothingEnabled = false; g.drawImage(sp, Math.round((cv.width - sp.width * k) / 2), Math.round((cv.height - sp.height * k) / 2), sp.width * k, sp.height * k); },
  };
})();

// ---------- v5.5 hangar backdrop: a Lorenz attractor (the chaos the game is named for) turning over a dithered nebula ----------
// Draws only while the hangar shows. Everything is drawn fresh each frame into a half-resolution canvas (2 CSS px per pixel) and
// shown pixelated. No createPattern (pitfall 40): the overlay is a pre-rendered canvas drawn 1:1.
const HangarFX = (() => {
  const C = { bg: [7, 8, 15], void: [184, 108, 255], cryo: [106, 226, 255], core: [89, 240, 180], amber: [255, 176, 58], bad: [255, 77, 106], ink: [233, 228, 212], star: [200, 210, 255] };
  const rgba = (k, a) => `rgba(${k[0]},${k[1]},${k[2]},${a})`;
  const sh = (k, a) => { const q = Math.max(0, Math.min(24, Math.round(a * 24))); const m = k.sh || (k.sh = []); return m[q] || (m[q] = rgba(k, q / 24)); }; // cached colour strings
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  let cv = null, c = null, W = 0, H = 0, PX = 2, R = 1, NP = 10, t = 0, fade = 0, lastCall = 0; // R: resolution relative to 5.4.2's 2 CSS px per pixel
  let neb = null, over = null, halo = null, dcv = null, dctx = null, dimg = null;
  const ZSPD = [1.2, 3, 6.5];
  let stars = [], sparks = [], comets = [], streak = null;
  let glitch = 0, nextGlitch = 3.5, nextStreak = 2.5, title = null, lay = null, layT = 0;
  const motion = () => { try { return !matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return true; } };

  // ---- value noise for the nebula (random each launch: no two hangars look the same) ----
  const PERM = new Uint8Array(512), NOX = Math.random() * 200, NOY = Math.random() * 200;
  { const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) PERM[i] = p[i & 255]; }
  const hash = (x, y) => PERM[PERM[x & 255] + (y & 255)] / 255;
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), d = hash(xi, yi + 1), e = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (d - a) * v + (a - b - d + e) * u * v;
  }
  function fbm(x, y) { let s = 0, a = 0.5; for (let i = 0; i < 5; i++) { s += a * vnoise(x, y); x = x * 2.03 + 17.1; y = y * 2.03 + 9.2; a *= 0.5; } return s; }
  const sstep = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

  // ---- the attractor: one long Lorenz trajectory, computed once ----
  const LN = 13000, LP = new Float32Array(LN * 3); // v5.4.3: twice the points at half the step, so trails stay solid at the finer resolution
  { let x = 0.1, y = 0, z = 20; const h = 0.0025;
    for (let i = -5000; i < LN; i++) {
      const dx = 10 * (y - x), dy = x * (28 - z) - y, dz = x * y - (8 / 3) * z; x += dx * h; y += dy * h; z += dz * h;
      if (i >= 0) { LP[i * 3] = x; LP[i * 3 + 1] = y; LP[i * 3 + 2] = z - 24; } } }
  const SX = new Float32Array(LN), SY = new Float32Array(LN), SD = new Float32Array(LN);

  function sprite(col, r) { // soft round glow, drawn additively
    const s = document.createElement('canvas'); s.width = s.height = r * 2; const g = s.getContext('2d');
    const gr = g.createRadialGradient(r, r, 0, r, r, r); gr.addColorStop(0, rgba(col, 0.9)); gr.addColorStop(0.25, rgba(col, 0.35)); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2); return s;
  }
  let GLOW = {};

  function buildNebula() { // dithered, palette-tinted clouds at half the backdrop's resolution, brightest around the attractor
    NP = Math.round(10 * R); const nw = Math.ceil(W / 2) + 2 * NP, nh = Math.ceil(H / 2) + 2 * NP;
    neb = document.createElement('canvas'); neb.width = nw; neb.height = nh;
    const g = neb.getContext('2d'), img = g.createImageData(nw, nh), d = img.data;
    const sc = 3.4 / nh, ox = NOX, oy = NOY, fx = lay.cx / 2 + NP, fy = lay.cy / 2 + NP, STEP = 7;
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      const px = x * sc + ox, py = y * sc + oy;
      const qx = fbm(px, py), qy = fbm(px + 5.2, py + 1.3), n = fbm(px + 3 * qx, py + 3 * qy), m = fbm(px * 0.8 + 8 - 2 * qy, py * 0.8 + 2 * qx);
      const dx = (x - fx) / nh, dy = (y - fy) / nh, near = Math.exp(-(dx * dx * 1.4 + dy * dy * 2.6));
      const side = 0.3 + 0.7 * sstep(0.1, 0.62, x / nw); // the title side stays dark
      let k = Math.max(0, n - 0.36) * 2.4; k = k * k * (0.35 + 1.1 * near) * side;
      const lane = 0.45 + 0.55 * sstep(0.32, 0.6, fbm(px * 2.2 + 40, py * 2.2)); // dark dust lanes
      k *= lane;
      const tm = sstep(0.38, 0.66, m), tr = sstep(0.56, 0.74, qx) * 0.75;
      const i = (y * nw + x) * 4, th = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * STEP;
      for (let ch = 0; ch < 3; ch++) {
        let col = C.void[ch] + (C.cryo[ch] - C.void[ch]) * tm; col += (C.bad[ch] - col) * tr;
        const v = C.bg[ch] + col * k * 0.55;
        d[i + ch] = Math.max(0, Math.min(255, Math.round((v + th) / STEP) * STEP));
      }
      d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  function buildOverlay() { // vignette and faint scanlines, drawn once per size
    over = document.createElement('canvas'); over.width = W; over.height = H; const g = over.getContext('2d');
    const gr = g.createRadialGradient(lay.cx, lay.cy, Math.min(W, H) * 0.25, lay.cx, lay.cy, Math.max(W, H) * 0.85);
    gr.addColorStop(0, 'rgba(4,5,10,0)'); gr.addColorStop(1, 'rgba(4,5,10,0.78)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); for (let y = 1; y < H; y += 2) g.rect(0, y, W, 1); g.fill();
    halo = sprite(C.void, Math.round(H * 0.42));
  }
  function seed() {
    stars = [];
    const n = Math.round(W * H / (140 * R * R)); // same number of stars at any resolution
    for (let i = 0; i < n; i++) {
      const z = Math.random() < 0.62 ? 0 : Math.random() < 0.7 ? 1 : 2, r = Math.random();
      stars.push({ x: Math.random() * W, y: Math.random() * H, z, b: [0.25, 0.5, 0.85][z] * (0.6 + 0.4 * Math.random()), p: Math.random() * 6.28, f: 0.6 + Math.random() * 2.2,
        col: r < 0.7 ? C.star : r < 0.8 ? C.cryo : r < 0.88 ? C.amber : r < 0.95 ? C.void : C.bad });
    }
    comets = [0, 1, 2, 3, 4].map(i => ({ i: Math.random() * LN, v: 170 + Math.random() * 80, len: 300 + Math.floor(Math.random() * 240), col: ['amber', 'ink', 'core', 'bad', 'cryo'][i] }));
    sparks = [];
  }
  function resize(w, h) {
    W = w; H = h; cv.width = W; cv.height = H;
    const gr = Math.round(8 * R); GLOW = { amber: sprite(C.amber, gr), ink: sprite(C.ink, gr), core: sprite(C.core, gr), bad: sprite(C.bad, gr), cryo: sprite(C.cryo, gr) };
    dcv = document.createElement('canvas'); dcv.width = W; dcv.height = H; dctx = dcv.getContext('2d'); dimg = dctx.createImageData(W, H);
    layout(); buildNebula(); buildOverlay(); seed(); fade = 0;
  }

  function layout() { // v5.7.3: the right-hand side, as large as fits: from under the utility icons to the bottom edge,
    // from the fractured end of the title word to just past the right edge (attractor extents over its sway, in s: x −29…+30, y −23…+19)
    const r0 = cv.getBoundingClientRect(), u = document.querySelector('#hangar .util'), ur = u && u.getBoundingClientRect();
    const k = W / (r0.width || 1); // the app may be zoomed by a transform, so measure in on-screen pixels
    const top = ((ur && ur.height ? ur.bottom : r0.top + r0.height * 0.12) - r0.top) * k + 3 * R;
    let left = W * 0.45;
    const words = document.querySelectorAll('#hangar .brand h1 .t1, #hangar .brand h1 .t2');
    if (words.length) { let wl = 1e9, wr = 0; for (const el of words) { const r = el.getBoundingClientRect(); wl = Math.min(wl, (r.left - r0.left) * k); wr = Math.max(wr, (r.right - r0.left) * k); }
      left = Math.max(W * 0.5, wr - 0.15 * (wr - wl)); } // may sit behind the last, already-broken letters
    const s = Math.max(0.8 * R, Math.min((W - left) / 55, (H * 0.98 - top) / 42.5, H * 0.04));
    lay = { cx: Math.round(W - 26 * s), cy: Math.round(top + 23.5 * s), s }; // the right lobe may run 4 s past the edge
  }
  function project(cx, cy, s, a) {
    const ca = Math.cos(a), sa = Math.sin(a), ct = Math.cos(0.32), st = Math.sin(0.32);
    for (let i = 0; i < LN; i++) {
      const x = LP[i * 3], y = LP[i * 3 + 1], z = LP[i * 3 + 2];
      const rx = x * ca - y * sa, ry = x * sa + y * ca, rz = z * ct + ry * st, dep = ry * ct - z * st, k = 140 / (140 + dep);
      SX[i] = cx + rx * s * k; SY[i] = cy - rz * s * k; SD[i] = dep;
    }
  }

  function draw(canvas, dt) {
    const now = performance.now(); if (now - lastCall > 600) fade = 0; lastCall = now;
    if (cv !== canvas) { cv = canvas; c = cv.getContext('2d'); W = 0; title = document.querySelector('.brand h1'); }
    // v5.4.3: finer pixels, 3 device pixels each (1 CSS px on 3x iPhones, 1.5 on 2x iPads), capped near 1100 across
    const br = cv.getBoundingClientRect(), cw = br.width || 1, ch = br.height || 1, dpr = window.devicePixelRatio || 1;
    PX = Math.max(cw / 1100, Math.min(2, Math.max(1, 3 / dpr))); R = 2 / PX;
    const w = Math.max(1, Math.round(cw / PX)), h = Math.max(1, Math.round(ch / PX));
    if (w !== W || h !== H) resize(w, h);
    const mv = motion(), sp = mv ? 1 : 0.25; dt *= sp; t += dt; fade = Math.min(1, fade + dt / 1.4);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.imageSmoothingEnabled = false;
    c.fillStyle = rgba(C.bg, 1); c.fillRect(0, 0, W, H);
    // nebula drifts on a slow orbit
    c.drawImage(neb, Math.round(-2 * NP + Math.sin(t * 0.05) * 7 * R), Math.round(-2 * NP + Math.cos(t * 0.037) * 5 * R), neb.width * 2, neb.height * 2);
    c.globalCompositeOperation = 'lighter';
    // the attractor: a wide soft halo, then thousands of points, two wings in two colours, nearer points brighter
    layT -= dt; if (layT <= 0) { layT = 0.5; const o = lay && lay.cx + ',' + lay.cy; layout(); if (o !== lay.cx + ',' + lay.cy) buildOverlay(); }
    const cx = lay.cx, cy = lay.cy, s = lay.s, a = -0.5 + 0.42 * Math.sin(t * 0.085); // sways around the widest view of the butterfly, never edge-on
    c.globalAlpha = 0.16 * fade * (0.85 + 0.15 * Math.sin(t * 0.7)); c.drawImage(halo, Math.round(cx - halo.width / 2), Math.round(cy - halo.height / 2));
    project(cx, cy, s, a);
    // every point (attractor, comet trails, sparks, stars, meteor) goes into one additive pixel buffer, uploaded once:
    // overlaps glow brighter, and it costs a fraction of drawing thousands of 1-pixel rects (the byte array clamps at 255 by itself)
    const dd = dimg.data; dd.fill(0);
    const plot = (x, y, k, a) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return; const q = (y * W + x) * 4; dd[q] += k[0] * a; dd[q + 1] += k[1] * a; dd[q + 2] += k[2] * a; dd[q + 3] = 255; };
    const lift = Math.min(1.8, Math.max(1, s / (2.2 * R))) * (0.6 + 0.4 * R) * fade; // finer lines read dimmer, so lift them a touch // bigger on big screens spreads the points, so lift them
    for (let i = 0; i < LN; i++) { const d = SD[i]; plot(SX[i], SY[i], LP[i * 3] > 0 ? C.void : C.cryo, (d > 9 ? 0.1 : d > -9 ? 0.17 : 0.27) * lift); }
    // comets run the trajectory, leaving fading trails and shedding sparks
    for (const k of comets) {
      k.i = (k.i + k.v * dt) % LN; const hi = Math.floor(k.i), col = C[k.col];
      for (let j = 0; j < k.len; j++) { const q = (hi - j + LN) % LN; plot(SX[q], SY[q], col, 0.9 * (0.7 + 0.3 * R) * fade * Math.pow(1 - j / k.len, 1.6)); }
      if (mv && Math.random() < dt * 9 && sparks.length < 140) {
        const q = (hi - 2 + LN) % LN, gx = SX[hi], gy = SY[hi], vx = gx - SX[q], vy = gy - SY[q], m = Math.hypot(vx, vy) || 1;
        sparks.push({ x: gx, y: gy, vx: (vx / m * (4 + Math.random() * 8) + (Math.random() - 0.5) * 6) * R, vy: (vy / m * (4 + Math.random() * 8) + (Math.random() - 0.5) * 6) * R, l: 0, L: 1.5 + Math.random() * 2.5, col });
      }
    }
    for (let i = sparks.length - 1; i >= 0; i--) { // entropy: everything drifts apart and fades
      const p = sparks[i]; p.l += dt; if (p.l >= p.L) { sparks.splice(i, 1); continue; }
      p.vx *= 1 - dt * 0.6; p.vy = p.vy * (1 - dt * 0.6) - dt * 1.5 * R; p.x += p.vx * dt; p.y += p.vy * dt;
      plot(p.x, p.y, p.col, 0.8 * (1 - p.l / p.L));
    }
    // stars: three depths drifting left, twinkling; the near ones flare into crosses
    for (const st of stars) {
      st.x -= ZSPD[st.z] * R * dt; if (st.x < -2) { st.x += W + 4; st.y = Math.random() * H; }
      st.p += st.f * dt; const tw = 0.55 + 0.45 * Math.sin(st.p), al = st.b * tw * (0.4 + 0.6 * fade), x = st.x, y = st.y;
      plot(x, y, st.col, al);
      if (st.z === 2 && tw > 0.86) { const a2 = al * 0.45; plot(x - 1, y, st.col, a2); plot(x + 1, y, st.col, a2); plot(x, y - 1, st.col, a2); plot(x, y + 1, st.col, a2);
        if (tw > 0.96) { const a3 = al * 0.2; plot(x - 2, y, st.col, a3); plot(x + 2, y, st.col, a3); plot(x, y - 2, st.col, a3); plot(x, y + 2, st.col, a3); } }
    }
    // now and then a meteor
    if (mv) { nextStreak -= dt; if (nextStreak <= 0 && !streak) { streak = { x: W * (0.35 + Math.random() * 0.6), y: -4, vx: -(60 + Math.random() * 50) * R, vy: (28 + Math.random() * 30) * R, l: 0, L: 0.7 + Math.random() * 0.5 }; nextStreak = 5 + Math.random() * 8; } }
    if (streak) {
      const m = streak; m.l += dt; m.x += m.vx * dt; m.y += m.vy * dt; const k = 1 - m.l / m.L;
      const n = Math.round(16 * R); for (let j = 0; j < n; j++) plot(m.x - m.vx * j * 0.128 / n, m.y - m.vy * j * 0.128 / n, C.ink, 0.7 * k * (1 - j / n));
      if (m.l >= m.L) streak = null;
    }
    dctx.putImageData(dimg, 0, 0); c.globalAlpha = 1; c.drawImage(dcv, 0, 0);
    for (const k of comets) { // soft heads on top
      const hi = Math.floor(k.i); c.globalAlpha = fade * (SD[hi] < 0 ? 1 : 0.6); const g = GLOW[k.col]; c.drawImage(g, Math.round(SX[hi] - g.width / 2), Math.round(SY[hi] - g.height / 2));
    }
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    // glitch: a few rows tear sideways and the title jumps with them
    if (mv) {
      nextGlitch -= dt;
      if (nextGlitch <= 0) { glitch = 0.2; nextGlitch = 4 + Math.random() * 6; if (title) { title.classList.remove('gl'); void title.offsetWidth; title.classList.add('gl'); } TitleFX.kick(); }
      if (glitch > 0) {
        glitch -= dt;
        for (let b = 0; b < 4; b++) {
          const y = Math.floor(Math.random() * H), hh = Math.round((1 + Math.random() * 4) * R), dx = (Math.random() < 0.5 ? -1 : 1) * Math.round((2 + Math.random() * 8) * R);
          c.drawImage(cv, 0, y, W, hh, dx, y, W, hh);
          c.fillStyle = sh(Math.random() < 0.5 ? C.bad : C.cryo, 0.1); c.fillRect(0, y, W, hh);
        }
      }
    }
    c.drawImage(over, 0, 0);
    if (fade < 1) { c.fillStyle = rgba(C.bg, (1 - fade) * 0.85); c.fillRect(0, 0, W, H); }
  }
  function center() { // the attractor in on-screen px, for TitleFX (null until laid out)
    if (!lay || !cv || !W) return null; const r0 = cv.getBoundingClientRect(), k = W / (r0.width || 1);
    return { x: r0.left + lay.cx / k, y: r0.top + lay.cy / k, s: lay.s / k };
  }
  return { draw, center };
})();

// v5.6 title: GRADIENT shades cream to cyan to violet and breaks into pixel shards toward the right edge.
// Drawn on its own canvas inside .brand h1 .t2; the static part is built once per size, shards move per frame.
const TitleFX = (() => {
  let host = null, cv = null, c = null, src = null, stat = null, shards = [], t = 0, kickT = 0, key = '', geo = null, checkT = 0;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const sstep = (a, b, x) => { x = Math.max(0, Math.min(1, (x - a) / (b - a))); return x * x * (3 - 2 * x); };
  const hash = (a, b) => { let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const motion = () => { try { return !matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return true; } };
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function build() {
    const cs = getComputedStyle(host), fs = parseFloat(cs.fontSize), fam = cs.fontFamily, word = host.dataset.word || 'GRADIENT';
    const r = host.getBoundingClientRect(), scale = (host.offsetWidth ? r.width / host.offsetWidth : 1) || 1;
    const D = Math.min(3, (window.devicePixelRatio || 1) * scale); // device px per CSS px, including the interface scale
    const font = '700 ' + fs + 'px ' + fam, m0 = document.createElement('canvas').getContext('2d'); m0.font = font;
    const mt = m0.measureText(word), wd = Math.ceil(mt.width * D), asc = Math.ceil((mt.actualBoundingBoxAscent || fs * 0.62) * D), inkH = asc;
    const off = Math.round(3 * D), hc = Math.max(2, Math.round(fs / 16 * D)); // chromatic offset; shard = half a font pixel
    // v5.7.2: the attractor pulls the shards in. Its centre in this canvas's pixels, relative to the word's top-left
    const q = D / scale, hz = (typeof HangarFX !== 'undefined' && HangarFX.center) ? HangarFX.center() : null;
    const T = hz ? { x: (hz.x - r.left) * q, y: (hz.y - r.top) * q, s: hz.s * q } : { x: mt.width * D + fs * 1.4 * D, y: asc * 0.2, s: fs * 0.08 * D };
    const k = fs + '|' + D + '|' + word + '|' + fam + '|' + Math.round(T.x / 8) + ',' + Math.round(T.y / 8) + ',' + Math.round(T.s * 4); if (k === key) return; key = k;
    const padL0 = off + hc, padV0 = Math.round(fs * 0.45 * D);
    // source: red and cyan offsets under the main word, which carries the colour ramp
    src = document.createElement('canvas'); src.width = wd + off * 2; src.height = inkH; const sc = src.getContext('2d');
    const main = document.createElement('canvas'); main.width = wd; main.height = inkH; const mc = main.getContext('2d');
    mc.font = (700) + ' ' + fs * D + 'px ' + fam; mc.textBaseline = 'alphabetic'; mc.fillStyle = '#fff'; mc.fillText(word, 0, asc);
    mc.globalCompositeOperation = 'source-atop';
    const g = mc.createLinearGradient(0, 0, wd, 0); g.addColorStop(0, css('--ink')); g.addColorStop(0.36, css('--ink')); g.addColorStop(0.62, css('--cryo')); g.addColorStop(0.86, css('--void')); g.addColorStop(1, css('--void'));
    mc.fillStyle = g; mc.fillRect(0, 0, wd, inkH);
    sc.font = mc.font; sc.textBaseline = 'alphabetic';
    const ab = document.createElement('canvas'); ab.width = src.width; ab.height = inkH; const ac = ab.getContext('2d'); // red/cyan fringe, fading with the word
    ac.font = mc.font; ac.textBaseline = 'alphabetic'; ac.fillStyle = css('--bad'); ac.fillText(word, off * 2, asc); ac.fillStyle = css('--cryo'); ac.fillText(word, 0, asc);
    ac.globalCompositeOperation = 'destination-in'; const am = ac.createLinearGradient(off, 0, off + wd, 0); am.addColorStop(0.4, '#000'); am.addColorStop(0.8, 'rgba(0,0,0,0.12)'); ac.fillStyle = am; ac.fillRect(0, 0, ab.width, inkH);
    sc.drawImage(ab, 0, 0); sc.drawImage(main, off, 0);
    // cells: intact ones stay in the word, the rest become shards with a path into the attractor (word-relative coordinates)
    const px = sc.getImageData(0, 0, src.width, src.height).data, cols = Math.ceil(src.width / hc), rows = Math.ceil(src.height / hc);
    const keep = []; shards = [];
    let x0 = -padL0, y0 = -padV0, x1 = src.width + padV0, y1 = inkH + padV0;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      let lit = false;
      for (let yy = y * hc; yy < Math.min(src.height, y * hc + hc) && !lit; yy++) for (let xx = x * hc; xx < Math.min(src.width, x * hc + hc); xx++) if (px[(yy * src.width + xx) * 4 + 3] > 40) { lit = true; break; }
      if (!lit) continue;
      const u = (x * hc + hc / 2 - off) / wd, f = sstep(0.6, 1.22, u);
      const th = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16 * 0.62 + hash(x, y) * 0.38;
      const sx = x * hc, sy = y * hc;
      if (th >= f) { keep.push([sx, sy, 1 - 0.4 * f]); continue; }
      if (f > 0.8 && hash(y, x) < 0.4) continue; // the far end is simply gone
      const ja = hash(x + 41, y + 3) * 6.283, jr = T.s * (1.5 + 7 * hash(x + 17, y + 71));
      const s0 = { sx, sy, tx: T.x + Math.cos(ja) * jr, ty: T.y + Math.sin(ja) * jr * 0.7, P: 3.4 + hash(x + 91, y + 7) * 3.4, ph: hash(x + 13, y + 57),
        sw: 1.8 + hash(x + 3, y + 19) * 1.4, a: 1 - 0.35 * f, j: hash(x + 7, y + 29) };
      for (let i = 0; i <= 10; i++) { const P0 = path(s0, i / 10); x0 = Math.min(x0, P0[0] - hc); y0 = Math.min(y0, P0[1] - hc); x1 = Math.max(x1, P0[0] + hc * 2); y1 = Math.max(y1, P0[1] + hc * 2); }
      shards.push(s0);
    }
    const padL = Math.ceil(-x0), padT = Math.ceil(-y0), W = Math.ceil(x1) + padL, H = Math.ceil(y1) + padT;
    stat = document.createElement('canvas'); stat.width = W; stat.height = H; const st = stat.getContext('2d');
    // static layer: amber glow fading out, then every cell that has not broken away
    const glow = document.createElement('canvas'); glow.width = W; glow.height = H; const gc = glow.getContext('2d');
    gc.font = mc.font; gc.textBaseline = 'alphabetic'; gc.shadowColor = 'rgba(255, 176, 58, 0.34)'; gc.shadowBlur = 28 * D; gc.shadowOffsetX = 10000;
    gc.fillText(word, padL + off - 10000, padT + asc); gc.shadowColor = 'transparent';
    gc.globalCompositeOperation = 'destination-in'; const gm = gc.createLinearGradient(padL, 0, padL + wd, 0); gm.addColorStop(0.3, '#000'); gm.addColorStop(0.85, 'rgba(0,0,0,0)'); gc.fillStyle = gm; gc.fillRect(0, 0, W, H);
    st.drawImage(glow, 0, 0);
    for (const [sx, sy, al] of keep) { st.globalAlpha = al; st.drawImage(src, sx, sy, hc, hc, padL + sx, padT + sy, hc, hc); }
    st.globalAlpha = 1;
    cv.width = W; cv.height = H;
    Object.assign(cv.style, { position: 'absolute', width: W / D + 'px', height: H / D + 'px', left: (-padL / D) + 'px', top: (-padT / D) + 'px' });
    host.style.height = inkH / D + 'px'; host.style.width = wd / D + 'px';
    geo = { hc, padL, padT };
  }
  // a shard at progress p (0 = in the word, 1 = gone into the attractor): drawn in along a tightening spiral
  function path(s, p) {
    const vx = s.sx - s.tx, vy = s.sy - s.ty, an = -s.sw * p * p, ca = Math.cos(an), sa = Math.sin(an), rr = Math.pow(1 - p, 1.15);
    return [s.tx + (vx * ca - vy * sa) * rr, s.ty + (vx * sa + vy * ca) * rr];
  }
  function bind() {
    host = document.querySelector('.brand h1 .t2'); if (!host) return false;
    cv = host.querySelector('canvas'); if (!cv) { cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true'); host.appendChild(cv); }
    c = cv.getContext('2d'); return true;
  }
  function draw(dt) {
    if (!host && !bind()) return;
    checkT -= dt; if (checkT <= 0 || !geo) { checkT = 0.5; try { if (!document.fonts || document.fonts.check('700 16px Silkscreen')) build(); } catch (e) { build(); } }
    if (!geo) return;
    t += dt; if (kickT > 0) kickT -= dt;
    c.clearRect(0, 0, cv.width, cv.height); c.drawImage(stat, 0, 0);
    if (!motion()) return;
    const hc = geo.hc, kick = kickT > 0 ? kickT / 0.3 : 0;
    for (const s of shards) {
      const q = (t / s.P + s.ph) % 1, p = Math.pow(q, 1.6), a = s.a * sstep(0, 0.05, q) * (1 - sstep(0.8, 1, p));
      if (a < 0.02) continue;
      const P0 = path(s, p), jx = kick ? (s.j - 0.5) * hc * 6 * kick : 0;
      const sz = Math.max(1, Math.round(hc * (1 - 0.72 * p)));
      c.globalAlpha = a; c.drawImage(src, s.sx, s.sy, hc, hc, Math.round(geo.padL + P0[0] + jx), Math.round(geo.padT + P0[1]), sz, sz);
    }
    c.globalAlpha = 1;
  }
  return { draw, kick: () => { kickT = 0.3; }, rebuild: () => { key = ''; } };
})();
