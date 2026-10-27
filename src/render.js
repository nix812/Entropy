// ===================== ENTROPY — RENDERER (24px tiles, cached sprites, camera) =====================
const PAL = {
  bg: '#07080f', amber: '#ffb03a', bad: '#ff4d6a', good: '#59f0b4', warn: '#ffe14d', ink: '#e9e4d4', core: '#59f0b4',
};
const ENEMY_COL = {
  drone: '#ff5470', swarmer: '#ff9ad5', tank: '#c9405a', flyer: '#ff86b0', splitter: '#ff6f3c', phantom: '#d6d2ff',
  medic: '#ff7c9c', shielder: '#8ab6ff', voidling: '#b86cff', boss: '#ff3355',
};

const Render = (() => {
  let cv, ctx, buf, b, lightCv, lctx, mapLayer, mapKey = '', mapDirty = true, bufW = 0, mid, mctx, glowLayer, conduits = [], vignette = null, vigKey = '';
  let W = 0, H = 0, dpr = 1, scale = 1, ox = 0, oy = 0;
  const cam = { z: 1, x: 0, y: 0 };
  // the framed sector (buffer px). It eases outward when the run's sector grows.
  const reg = { x: 0, y: 0, w: 0, h: 0 };
  let regG = null, regKey = '', regAnim = null, frontier = null, onCam = null;
  let parts = [], rings = [], lines = [], texts = [], flashes = [], frame = 0, shake = 0, shakeT = 0;
  let scan = null, scanPat = null;
  let selTile = null, selTower = null, preview = null, aimPos = null;
  let fullHud = false, showNums = true, doShake = true;
  const comboLast = {};

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
  const EN = {
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
  const EN_SIZE = { drone: 15, swarmer: 9, tank: 20, flyer: 16, splitter: 14, phantom: 15, medic: 15, shielder: 17, voidling: 11 };
  function enemySprite(type) {
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
  };
  const BOSS_COL = { cat: '#ff9a3c', gloop: '#5cff7a', whale: '#4f8dff', duck: '#ffd83a', fsm: '#f2d27a' };
  const meatSprite = () => outlined('omeat', spr('meat', 12, 12, g => { D(g, 6, 6, 5, '#2a0a02'); D(g, 6, 6, 4, '#8a3a1a'); D(g, 5, 5, 1, '#c06a3a'); R(g, 6, 2, 3, 2, '#d8281a'); P(g, 8, 8, '#5a1a0a'); }));
  const scCache = {};
  function scaledSpr(k, s, f) { if (scCache[k]) return scCache[k]; const c = document.createElement('canvas'); c.width = Math.round(s.width * f); c.height = Math.round(s.height * f); const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(s, 0, 0, c.width, c.height); return scCache[k] = c; }
  function bossSprite(id) { return outlined('oboss:' + id, spr('boss:' + id, 48, 48, g => BOSS[id](g, ENEMY_COL.boss))); }

  // ---------- map layer ----------
  function drawMap() {
    if (mapLayer.width !== BW || mapLayer.height !== BH) { mapLayer.width = BW; mapLayer.height = BH; }
    const m = mapLayer.getContext('2d'), map = G.map, cols = COLS;
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
        R(m, X, Y, TILE, TILE, '#251c3d');
        for (let k = 0; k < 8; k++) P(m, X + (d * (k + 3) * 7) % 24, Y + (d * (k + 5) * 11) % 24, k % 2 ? '#2e2449' : '#1e1732');
        continue;
      }
      const v = (d % 7) - 3;
      R(m, X, Y, TILE, TILE, `rgb(${17 + v},${20 + v},${37 + v * 2})`);
      R(m, X, Y, TILE, 1, '#20264a'); R(m, X, Y + 1, 1, TILE - 1, '#1c2242');
      R(m, X, Y + TILE - 1, TILE, 1, '#0a0c19'); R(m, X + TILE - 1, Y, 1, TILE, '#0a0c19');
      if (d % 3 === 0) { R(m, X + 3, Y + 11, 18, 1, '#141a2f'); R(m, X + 3, Y + 12, 18, 1, '#1d2340'); }
      if (d % 5 === 0) for (const [bx, by] of [[3, 3], [19, 3], [3, 19], [19, 19]]) { R(m, X + bx, Y + by, 2, 2, '#283057'); P(m, X + bx, Y + by, '#3a4475'); }
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
        if (!isP(p.x, p.y - 1)) { R(m, X, Y, TILE, 2, '#4a3a78'); R(m, X, Y + 2, TILE, 1, '#5d4a92'); }
        if (!isP(p.x, p.y + 1)) { R(m, X, Y + TILE - 2, TILE, 2, '#0d0a18'); R(m, X, Y + TILE - 3, TILE, 1, '#3a2d5e'); }
        if (!isP(p.x - 1, p.y)) { R(m, X, Y, 2, TILE, '#4a3a78'); R(m, X + 2, Y, 1, TILE, '#5d4a92'); }
        if (!isP(p.x + 1, p.y)) { R(m, X + TILE - 2, Y, 2, TILE, '#0d0a18'); R(m, X + TILE - 3, Y, 1, TILE, '#3a2d5e'); }
        if (!isP(p.x, p.y - 1)) R(m, X, Y + 3, TILE, 3, 'rgba(6,4,14,0.28)');
        if (!isP(p.x - 1, p.y)) R(m, X + 3, Y, 3, TILE, 'rgba(6,4,14,0.22)');
        const nx = L.tiles[k + 1];
        if (nx && k % 2 === 0) {
          const dx = nx.x - p.x, dy = nx.y - p.y, cx = X + 12, cy = Y + 12;
          for (let s = -4; s <= 4; s++) { const a = Math.abs(s); R(m, cx + dx * (2 - a * 0.75) - dy * s, cy + dy * (2 - a * 0.75) + dx * s, 2, 2, '#4d3d80'); }
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
    if (bufW !== BW || buf.height !== BH) { buf.width = BW; buf.height = BH; bufW = BW; mapDirty = true; b.imageSmoothingEnabled = false; resetCam(); fit(); }
  }
  function drawTower(t) {
    const X = t.x * TILE, Y = t.y * TILE, D0 = TOWERS[t.type], el = t.s ? t.s.el : D0.el, c = EL[el].col;
    b.drawImage(baseSprite(el), X, Y);
    const top = topSprite(t.type, el, t.spec);
    if (ROTATES[t.type]) {
      const rc = t.flash > 0 ? 1.5 : 0;
      b.save(); b.translate(X + 12, Y + 12); b.rotate(t.angle || -1.57); b.drawImage(top, -13 - rc, -13); b.restore();
      if (t.flash > 0) { const a = t.angle || 0; D(b, X + 12 + Math.cos(a) * 11, Y + 12 + Math.sin(a) * 11, 2, '#ffffff'); }
    } else b.drawImage(top, X - 1, Y - (t.flash > 0 ? 0 : 1) + (t.type === 'pylon' && (frame >> 4) % 2 ? -1 : 0));
    // live details
    switch (t.type) {
      case 'cryo': if (t.flash > 0) { D(b, X + 12, Y + 12, 3, '#ffffff'); } break;
      case 'coil': if (frame % 7 < 3) for (let k = 0; k < 3; k++) { const a = Math.random() * 6.283; P(b, X + 12 + Math.cos(a) * 9, Y + 12 + Math.sin(a) * 9, '#fff6c0'); } break;
      case 'pylon': D(b, X + 12, Y + 4, 2, (frame >> 4) % 2 ? c : sh(c, -0.5)); break;
      case 'snare': if (t.s) { const left = Math.max(0, t.s.catches - (t.caught || 0)); P(b, X + 12, Y + 3, left ? ((frame >> 3) % 2 ? '#59f0b4' : '#c9fff0') : '#ff4d6a'); } break;
      case 'forge': if ((frame >> 3) % 8 === 0) { R(b, X + 10, Y + 13, 3, 2, '#fff6c0'); } break;
      case 'grav': { const a = frame / 10; R(b, X + 11 + Math.cos(a) * 9, Y + 11 + Math.sin(a) * 9, 2, 2, '#e0c8ff'); break; }
      case 'lens': { const a = t.angle || 0; D(b, X + 12 + Math.cos(a) * 2, Y + 12 + Math.sin(a) * 2, 2, t.ramp > 3 ? '#ffffff' : sh(c, 0.5)); break; }
    }
    if (t.asc) { b.strokeStyle = hexA('#ff8a2a', 0.55 + 0.3 * Math.sin(frame / 8)); b.lineWidth = 1; b.strokeRect(X + 0.5, Y + 0.5, 23, 23); }
    for (let i = 0; i < t.lvl; i++) R(b, X + 4 + i * 3, Y + 20, 2, 2, i >= 3 && t.spec ? PAL.amber : '#9aa3d6');
    let best = -1; for (const a of t.affixes) if (a.tier < 4 && a.tier > best) best = a.tier;
    if (best >= 1) { R(b, X + 18, Y + 2, 4, 4, '#090b16'); R(b, X + 19, Y + 3, 2, 2, RARITY[best].col); }
    if (t.affixes.some(a => a.tier === 4)) R(b, X + 18, Y + 7, 2, 2, RARITY[4].col);
    if (t.rank) {
      const sc = t.pending ? (frame % 16 < 8 ? '#ffffff' : PAL.warn) : PAL.warn;
      R(b, X + 4, Y + 1, 1, 7, '#090b16'); R(b, X + 1, Y + 4, 7, 1, '#090b16');
      R(b, X + 4, Y + 2, 1, 5, sc); R(b, X + 2, Y + 4, 5, 1, sc); P(b, X + 4, Y + 4, '#ffffff');
    }
    if (t.disabled > 0) for (let i = 0; i < 14; i++) R(b, X + 2 + Math.random() * 19, Y + 2 + Math.random() * 19, 2, 1, i % 2 ? '#ffffff' : '#5a5a7a');
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
  function drawCore() {
    const c = G.core, X = c.x * TILE, Y = c.y * TILE, pulse = (Math.sin(frame / 10) + 1) / 2;
    D(b, X, Y + 2, 17, 'rgba(0,0,0,0.5)');
    D(b, X, Y, 17, '#071812'); D(b, X, Y, 16, '#0b2a22'); O(b, X, Y, 16, 2, '#1f6b55');
    for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283 + frame / 70; R(b, X + Math.cos(a) * 12 - 1, Y + Math.sin(a) * 12 - 1, 3, 3, PAL.core); }
    D(b, X, Y, 9, '#103c31');
    D(b, X, Y, Math.round(5 + pulse * 1.5), PAL.core); D(b, X - 1, Y - 1, 3, '#b8ffe6'); P(b, X - 2, Y - 2, '#ffffff');
    const ec = EL[c.s ? c.s.el : c.el].col, a = c.angle || 0;
    b.save(); b.translate(X, Y); b.rotate(a); R(b, 6, -2, 12, 4, '#090b16'); R(b, 6, -1, 11, 2, ec); R(b, 6, -1, 11, 1, sh(ec, 0.6)); b.restore();
    if (c.shield > 1) { b.strokeStyle = hexA('#7fd4ff', 0.25 + 0.5 * (c.shield / Math.max(1, c.smax))); b.lineWidth = 2; b.beginPath(); b.arc(X, Y, 20, 0, 6.283); b.stroke(); }
    if (c.hp / c.max < 0.35 && frame % 20 < 10) { b.strokeStyle = PAL.bad; b.lineWidth = 2; b.beginPath(); b.arc(X, Y, 17, 0, 6.283); b.stroke(); }
  }
  function drawEnemy(e) {
    const X = e.x * TILE, Y = e.y * TILE, st = e.st;
    const cloaked = e.cloaked && !(e.revealed > 0);
    const bob = e.fly ? Math.round(Math.sin(frame / 6 + e.wob) * 1.5) : (e.boss ? 0 : (((frame >> 3) + ((e.wob * 10) | 0)) & 1) && !(e.st.frozen > 0) && !(e.st.stun > 0) ? -1 : 0);
    const y = Y - (e.fly ? 7 : 0) + bob;
    let s;
    if (e.boss) s = bossSprite(e.boss); else if (e.meat) s = meatSprite(); else s = enemySprite(e.type);
    if (e.gen) s = scaledSpr('g' + e.gen + ':' + e.boss, s, e.gen === 1 ? 0.67 : 0.45);
    const hw = s.width >> 1, hh = s.height >> 1;
    if (e.fly) { b.fillStyle = 'rgba(0,0,0,0.35)'; b.fillRect(X - hw + 2, Y + 4, s.width - 4, 3); }
    else { b.fillStyle = 'rgba(0,0,0,0.38)'; b.fillRect(Math.round(X - hw + 1), Math.round(Y + hh - 1), s.width - 2, 2); }
    if (cloaked) b.globalAlpha = 0.25;
    b.drawImage(s, Math.round(X - hw), Math.round(y - hh));
    if (e.hitFlash > 0) { b.globalAlpha = cloaked ? 0.2 : e.boss ? 0.3 : 0.6; b.drawImage(tinted('w:' + (e.boss || e.type), s, '#ffffff'), Math.round(X - hw), Math.round(y - hh)); }
    else if (st.frozen > 0) { b.globalAlpha = 0.6; b.drawImage(tinted('c:' + (e.boss || e.type), s, '#bff4ff'), Math.round(X - hw), Math.round(y - hh)); }
    else if (st.chill > 0) { b.globalAlpha = 0.12 + st.chill * 0.06; b.drawImage(tinted('c:' + (e.boss || e.type), s, '#9ad8ff'), Math.round(X - hw), Math.round(y - hh)); }
    b.globalAlpha = 1;
    if (e.boss === 'cat' && e.napT > 0) { const ox = Math.round(X - hw), oy = Math.round(y - hh); R(b, ox + 16, oy + 15, 6, 6, '#ff9a3c'); R(b, ox + 27, oy + 15, 6, 6, '#ff9a3c'); R(b, ox + 16, oy + 18, 6, 1, '#3a1606'); R(b, ox + 27, oy + 18, 6, 1, '#3a1606'); }
    if (e.boss === 'titan' && e.plates > 0) { R(b, X - 22, y - 22, 44, 5, '#8a8fa8'); R(b, X - 22, y + 17, 44, 5, '#8a8fa8'); if (e.plates > 1) { R(b, X - 22, y - 22, 5, 44, '#a4aac4'); R(b, X + 17, y - 22, 5, 44, '#a4aac4'); } }
    if (e.type === 'shielder' && frame % 30 < 15) { b.strokeStyle = 'rgba(138,182,255,0.5)'; b.lineWidth = 1; b.beginPath(); b.arc(X, y, 11, 0, 6.283); b.stroke(); }
    if (e.shield > 0 && !cloaked) { b.strokeStyle = 'rgba(127,212,255,0.55)'; b.lineWidth = 1; b.beginPath(); b.arc(X, y, hw + 3, 0, 6.283); b.stroke(); }
    if (e.elite.length && !cloaked) {
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
      const w = Math.max(12, s.width), hr = Math.max(0, e.hp / e.maxHp);
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
  function fit() {
    const rw = reg.w || BW, rh = reg.h || BH;
    scale = Math.min(W / rw, H / rh);
    ox = Math.round((W - rw * scale) / 2); oy = Math.round((H - rh * scale) / 2);
  }
  function view() {
    const vw = reg.w / cam.z, vh = reg.h / cam.z;
    const vx = clamp(cam.x - vw / 2, reg.x, reg.x + reg.w - vw), vy = clamp(cam.y - vh / 2, reg.y, reg.y + reg.h - vh);
    return { vx, vy, vw, vh };
  }
  function resetCam() { cam.z = 1; cam.x = reg.x + reg.w / 2; cam.y = reg.y + reg.h / 2; }
  // follow G.region: snap on a new run, otherwise pull the camera back over a few seconds
  const easeIO = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function updateRegion() {
    const R = G.region || { x0: 0, y0: 0, x1: COLS, y1: ROWS };
    const T = { x: R.x0 * TILE, y: R.y0 * TILE, w: (R.x1 - R.x0) * TILE, h: (R.y1 - R.y0) * TILE };
    const key = T.x + ',' + T.y + ',' + T.w + ',' + T.h, now = performance.now();
    if (G !== regG || !reg.w) { regG = G; regKey = key; Object.assign(reg, T); regAnim = null; frontier = null; resetCam(); }
    else if (key !== regKey) {
      regKey = key;
      frontier = { x: reg.x, y: reg.y, w: reg.w, h: reg.h, t0: now };
      regAnim = { from: { x: reg.x, y: reg.y, w: reg.w, h: reg.h }, to: T, t0: now, dur: 2600 };
      const was = cam.z; cam.z = 1;
      if (was > 1.01 && onCam) onCam();
    }
    if (regAnim) {
      const k = Math.min(1, (now - regAnim.t0) / regAnim.dur), e = easeIO(k), A = regAnim.from, B = regAnim.to;
      reg.x = A.x + (B.x - A.x) * e; reg.y = A.y + (B.y - A.y) * e; reg.w = A.w + (B.w - A.w) * e; reg.h = A.h + (B.h - A.h) * e;
      if (k >= 1) { Object.assign(reg, B); regAnim = null; }
      if (cam.z <= 1.001) resetCam();
    }
    fit();
  }
  function clampCam() { const v = view(); cam.x = v.vx + v.vw / 2; cam.y = v.vy + v.vh / 2; }
  function screenToBuf(sx, sy) { const v = view(); return { x: v.vx + (sx - ox) / (scale * cam.z), y: v.vy + (sy - oy) / (scale * cam.z) }; }
  function screenToTile(sx, sy) { const p = screenToBuf(sx, sy); return { x: p.x / TILE, y: p.y / TILE }; }
  function tileToScreen(x, y) { const v = view(); return { x: ox + (x * TILE - v.vx) * scale * cam.z, y: oy + (y * TILE - v.vy) * scale * cam.z }; }
  function zoomAt(sx, sy, factor) {
    const before = screenToBuf(sx, sy);
    cam.z = clamp(cam.z * factor, 1, 4);
    const v = view();
    // keep the point under the fingers fixed
    const nx = before.x - (sx - ox) / (scale * cam.z), ny = before.y - (sy - oy) / (scale * cam.z);
    cam.x = nx + v.vw / 2; cam.y = ny + v.vh / 2; clampCam();
  }
  function panBy(dx, dy) { cam.x -= dx / (scale * cam.z); cam.y -= dy / (scale * cam.z); clampCam(); }

  // ---------- frame ----------
  function draw(dt) {
    frame++;
    const c = ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = PAL.bg; c.fillRect(0, 0, cv.width, cv.height);
    if (!G) return;
    updateRegion();
    ensureBuffers();
    const key = G.seed + ':' + G.map.lanes.length + ':' + COLS + ':' + (G.mapRev || 0);
    if (key !== mapKey) { mapKey = key; mapDirty = true; }
    if (mapDirty) drawMap();
    b.clearRect(0, 0, BW, BH);
    b.drawImage(mapLayer, 0, 0);
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
    for (const z of G.zones) ditherDisc(z.x * TILE, z.y * TILE, z.r * TILE, hexA('#ff7b39', 0.4), 2, frame % 2);
    for (const L of G.map.lanes) drawWormhole(L);
    // snare nets and tethers
    for (const t of G.snares || []) {
      if (!t.s) continue;
      const cx = t.cx * TILE, cy = t.cy * TILE, rr = t.s.netR * TILE, spent = (t.caught || 0) >= t.s.catches;
      b.strokeStyle = spent ? 'rgba(255,77,106,0.25)' : 'rgba(89,240,180,0.32)'; b.lineWidth = 1;
      b.setLineDash([3, 3]); b.lineDashOffset = -frame / 6; b.beginPath(); b.arc(cx, cy, rr, 0, 6.283); b.stroke();
      b.setLineDash([]);
      if (!spent) { b.globalAlpha = 0.12; for (let k = 0; k < 6; k++) { const a = k / 6 * 3.1416 + frame / 200; b.beginPath(); b.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); b.lineTo(cx - Math.cos(a) * rr, cy - Math.sin(a) * rr); b.stroke(); } b.globalAlpha = 1; }
    }
    b.strokeStyle = 'rgba(89,240,180,0.45)'; b.lineWidth = 1; b.setLineDash([2, 4]);
    for (const e of G.enemies) if (e.lureT && !e.netted) { b.beginPath(); b.moveTo(e.x * TILE, e.y * TILE - 7); b.lineTo(e.lureT.cx * TILE, e.lureT.cy * TILE); b.stroke(); }
    b.setLineDash([]);
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
      R(b, X - 1, Y + 1, 16, 12, 'rgba(0,0,0,0.45)');
      R(b, X, Y, 14, 11, '#3a2a10'); R(b, X + 1, Y + 1, 12, 9, '#a8741c'); R(b, X + 1, Y + 1, 12, 2, '#e0a640'); R(b, X + 6, Y + 1, 2, 9, '#5a3c0c'); R(b, X + 1, Y + 5, 12, 1, '#5a3c0c');
      R(b, X + 5, Y - 3, 4, 3, on ? '#ffe14d' : '#7a6a20');
      const f = Math.max(0, cc.t / CACHE_LIFE), rr = 12;
      b.strokeStyle = hexA(late ? '#ff4d6a' : '#ffe14d', 0.8); b.lineWidth = 1.5; b.beginPath(); b.arc(cc.x * TILE + 12, cc.y * TILE + 12, rr, -1.5708, -1.5708 + 6.2832 * f); b.stroke();
    }
    for (const t of G.towers) drawTower(t);
    // resonance links
    for (const t of G.towers) for (const o of t.resonWith || []) {
      if (o.id < t.id && o.resonWith && o.resonWith.includes(t)) continue;
      const ax = t.cx * TILE, ay = t.cy * TILE, bx = o.cx * TILE, by = o.cy * TILE;
      for (let k = 2; k < 9; k++) { const f = k / 10, col = (k + (frame >> 3)) % 2 ? EL[t.s.el].col : EL[o.s.el].col; R(b, ax + (bx - ax) * f - 1, ay + (by - ay) * f - 1, 2, 2, hexA(col, 0.45 + 0.3 * Math.sin(frame / 6 + k))); }
    }
    // beams
    for (const t of G.towers) if (t.beamTargets && t.disabled <= 0) {
      const cc = EL[t.s.el].col, k = Math.min(1, t.ramp / 4);
      for (const e of t.beamTargets) {
        const ex = e.x * TILE, ey = e.y * TILE - (e.fly ? 7 : 0);
        b.strokeStyle = hexA(cc, 0.45 + 0.45 * k); b.lineWidth = 2 + k * 2; b.beginPath(); b.moveTo(t.cx * TILE, t.cy * TILE); b.lineTo(ex, ey); b.stroke();
        if (k > 0.4) { b.strokeStyle = hexA('#ffffff', 0.6 * k); b.lineWidth = 1; b.beginPath(); b.moveTo(t.cx * TILE, t.cy * TILE); b.lineTo(ex, ey); b.stroke(); }
        D(b, ex, ey, 2 + Math.round(k * 2), hexA('#ffffff', 0.5 + 0.4 * k));
      }
    }
    drawCore();
    for (const e of G.enemies) if (!e.fly) drawEnemy(e);
    for (const e of G.enemies) if (e.fly) drawEnemy(e);
    // projectiles
    for (const p of G.projs) {
      const X = p.x * TILE, Y = p.y * TILE, col = EL[p.el] ? EL[p.el].col : '#fff';
      if (p.k === 'bullet') {
        let dx = 0, dy = 0; if (p.e && !p.e.dead) { dx = p.e.x - p.x; dy = p.e.y - p.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d; }
        R(b, X - dx * 4 - 1, Y - dy * 4 - 1, 2, 2, hexA(col, 0.4)); R(b, X - dx * 2 - 1, Y - dy * 2 - 1, 2, 2, hexA(col, 0.7));
        R(b, X - 1.5, Y - 1.5, 3, 3, p.crit ? '#ffffff' : col); if (p.crit) { R(b, X - 2.5, Y - 0.5, 5, 1, '#ffffff'); R(b, X - 0.5, Y - 2.5, 1, 5, '#ffffff'); }
      } else if (p.k === 'missile') {
        const a = Math.atan2(p.vy, p.vx);
        b.save(); b.translate(X, Y); b.rotate(a); R(b, -4, -1.5, 7, 3, '#d8d0c8'); R(b, 2, -1.5, 2, 3, col); R(b, -5, -1, 1, 2, '#ffb03a'); b.restore();
        if (frame % 2) parts.push({ x: X - Math.cos(a) * 5, y: Y - Math.sin(a) * 5, vx: 0, vy: -4, life: 0.45, max: 0.45, col: '#7a7a8a', s: 2 });
      } else if (p.k === 'mortar') {
        const h = (p.h || 0) * TILE;
        b.fillStyle = 'rgba(0,0,0,0.4)'; b.fillRect(X - 3, Y - 1, 6, 3);
        D(b, X, Y - h, 3, '#2a2816'); D(b, X, Y - h, 2, col); P(b, X - 1, Y - h - 1, '#ffffff');
      } else if (p.k === 'bomblet') { D(b, X, Y, 2, col); }
    }
    // fx
    for (const L of lines) {
      L.life -= dt; const a = Math.max(0, L.life / L.max);
      b.lineCap = 'round';
      b.strokeStyle = hexA(L.col, a); b.lineWidth = L.w || 3; b.beginPath(); b.moveTo(L.pts[0].x, L.pts[0].y); for (let i = 1; i < L.pts.length; i++) b.lineTo(L.pts[i].x, L.pts[i].y); b.stroke();
      if (L.core) { b.strokeStyle = hexA('#ffffff', a * 0.85); b.lineWidth = 1; b.stroke(); }
      b.lineCap = 'butt';
    }
    lines = lines.filter(L => L.life > 0);
    for (const Rg of rings) {
      Rg.life -= dt;
      const k = 1 - Math.max(0, Rg.life / Rg.max), r = Rg.r0 + (Rg.r1 - Rg.r0) * k;
      if (Rg.fill) fillRing(Rg.x, Rg.y, r, Rg.col, (1 - k) * 0.22);
      strokeRing(Rg.x, Rg.y, r, Rg.col, (1 - k) * (Rg.a || 1), Rg.w || 2);
    }
    rings = rings.filter(Rg => Rg.life > 0);
    for (const p of parts) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt; p.vx *= 0.96; p.vy *= 0.96;
      b.fillStyle = hexA(p.col, Math.max(0, p.life / p.max));
      const s = p.s || 2; b.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
    }
    parts = parts.filter(p => p.life > 0);
    if (parts.length > 800) parts.splice(0, parts.length - 800);
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
      if (e.boss) light(e.x * TILE, e.y * TILE, TILE * (e.gen ? 1.4 : 2.4), BOSS_COL[e.boss] || '#ff3355', 0.22);
      else if (e.elite.length) light(e.x * TILE, e.y * TILE, TILE * 1.1, ELITE_AFFIXES.find(a => a.id === e.elite[0]).col, 0.18);
      if (e.st.burn) light(e.x * TILE, e.y * TILE, TILE * 0.7, EL.T.col, 0.16);
    }
    for (const Rg of rings) { const k = 1 - Math.max(0, Rg.life / Rg.max); light(Rg.x, Rg.y, (Rg.r0 + (Rg.r1 - Rg.r0) * k) * 1.3 + 6, Rg.col, (1 - k) * (Rg.fill ? 0.5 : 0.3)); }
    for (const L of lines) { const a = Math.max(0, L.life / L.max), q = L.pts[L.pts.length - 1]; light(q.x, q.y, 16, L.col, a * 0.5); light(L.pts[0].x, L.pts[0].y, 12, L.col, a * 0.35); }
    for (const s2 of G.storms) light(s2.x * TILE, s2.y * TILE, s2.r * TILE * 1.1, s2.mael ? '#ff4d6a' : STORMS[s2.types[0]].col, 0.13);
    for (const z of G.zones) light(z.x * TILE, z.y * TILE, z.r * TILE * 1.2, '#ff7b39', 0.22);
    for (const q of conduits) light(q.x, q.y, 14, q.col, 0.05 + 0.05 * Math.sin(frame / 20 + q.ph));
    for (const q of G.nodes || []) light(q.x * TILE + 12, q.y * TILE + 12, TILE * 1.1, '#6ae2ff', 0.16 + 0.06 * Math.sin(frame / 12 + q.x));
    for (const cc of G.caches || []) light(cc.x * TILE + 12, cc.y * TILE + 12, TILE * 1.3, '#ffe14d', 0.22);
    for (const L of G.map.lanes) { const p0 = L.tiles[0]; light((p0.x + 0.5) * TILE, (p0.y + 0.5) * TILE, TILE * (L.openWave ? 1.4 : 2), L.openWave ? '#b86cff' : '#ff4d6a', (L.openWave ? 0.18 : 0.26) + 0.08 * Math.sin(frame / 7)); }

    // ---------- composite ----------
    let sx = 0, sy = 0;
    if (shakeT > 0 && doShake) { shakeT -= dt; sx = (Math.random() - 0.5) * shake; sy = (Math.random() - 0.5) * shake; }
    const v = view();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    // sharp-bilinear: integer nearest-neighbour upscale first, then one smooth resample to the exact size,
    // so every art pixel lands the same width on screen (no shimmer from uneven nearest-neighbour scaling)
    const ds = scale * cam.z * dpr, k = (window.__rdbg & 8) ? 1 : Math.max(1, Math.min(8, Math.ceil(ds - 0.08)));
    const vxI = Math.floor(v.vx), vyI = Math.floor(v.vy);
    const vwI = Math.min(BW - vxI, Math.ceil(v.vw) + 1), vhI = Math.min(BH - vyI, Math.ceil(v.vh) + 1);
    if (mid.width !== vwI * k || mid.height !== vhI * k) { mid.width = vwI * k; mid.height = vhI * k; }
    mctx.imageSmoothingEnabled = false;
    mctx.drawImage(buf, vxI, vyI, vwI, vhI, 0, 0, vwI * k, vhI * k);
    c.imageSmoothingEnabled = true;
    const DW = reg.w * scale, DH = reg.h * scale, X0 = ox + sx, Y0 = oy + sy;
    c.drawImage(mid, (v.vx - vxI) * k, (v.vy - vyI) * k, v.vw * k, v.vh * k, X0, Y0, DW, DH);
    // lighting pass: additive soft lights in screen space
    const ws = scale * cam.z, bx2s = x => X0 + (x - v.vx) * ws, by2s = y => Y0 + (y - v.vy) * ws;
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
    c.globalCompositeOperation = 'lighter'; c.drawImage(lightCv, ox, oy, DW, DH);
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
    if (selTile) {
      const x = bx2s(selTile.x * TILE), y = by2s(selTile.y * TILE), w = TILE * ws, L = Math.max(4, w * 0.28), cc = frame % 30 < 20 ? PAL.amber : '#b07a20';
      c.strokeStyle = cc; c.lineWidth = 2; c.beginPath();
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const px = x + dx * w, py = y + dy * w, sx2 = dx ? -1 : 1, sy2 = dy ? -1 : 1; c.moveTo(px, py + sy2 * L); c.lineTo(px, py); c.lineTo(px + sx2 * L, py); }
      c.stroke();
    }
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
    // the old sector border fades out as the camera pulls back
    if (frontier) {
      const age = (performance.now() - frontier.t0) / 1000, a = age < 0.4 ? age / 0.4 : Math.max(0, 1 - (age - 0.4) / 3.2);
      if (a <= 0) frontier = null;
      else {
        const x = bx2s(frontier.x), y = by2s(frontier.y), w = frontier.w * ws, h = frontier.h * ws;
        c.setLineDash([6, 6]); c.lineDashOffset = -frame / 2; c.lineWidth = 2; c.strokeStyle = hexA('#b86cff', 0.75 * a);
        c.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h)); c.setLineDash([]);
        c.fillStyle = hexA('#07080f', 0.35 * a);
        const X1 = x + w, Y1 = y + h;
        c.fillRect(ox, oy, DW, y - oy); c.fillRect(ox, Y1, DW, oy + DH - Y1); c.fillRect(ox, y, x - ox, h); c.fillRect(X1, y, ox + DW - X1, h);
      }
    }
    // veterans waiting for a mutation: a bobbing badge above the tower
    c.font = '10px Silkscreen, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const t of G.towers) if (t.pending > 0) {
      const x = bx2s(t.cx * TILE), y = by2s(t.y * TILE) - 7 + Math.sin(frame / 6 + t.id) * 2;
      c.fillStyle = '#090b16'; c.fillRect(x - 8, y - 8, 16, 15);
      c.fillStyle = frame % 24 < 16 ? PAL.warn : '#fff6c0'; c.fillRect(x - 7, y - 7, 14, 13);
      c.fillStyle = '#1a1004'; c.fillText('!', x + 0.5, y + 0.5);
    }
    c.restore();

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
      c.fillStyle = 'rgba(7,8,15,0.8)'; c.fillRect(bx - 4, by - 2, bw + 8, 22);
      c.font = '10px Silkscreen, monospace'; c.fillStyle = '#ff9aac'; c.textAlign = 'left';
      c.fillText(e.bossName.toUpperCase() + (e.bossTitle ? ' · ' + e.bossTitle.toUpperCase() : '') + (e.elite.length ? ' · ' + e.elite.map(id => ELITE_AFFIXES.find(a => a.id === id).name).join(' · ') : ''), bx, by + 5);
      c.fillStyle = '#3a0a18'; c.fillRect(bx, by + 12, bw, 5);
      c.fillStyle = '#ff3355'; c.fillRect(bx, by + 12, bw * Math.max(0, e.hp / e.maxHp), 5);
      if (e.shield > 0) { c.fillStyle = '#8ab6ff'; c.fillRect(bx, by + 12, bw * Math.min(1, e.shield / e.maxHp), 2); }
      c.textAlign = 'center';
    }
    // zoom minimap hint
    if (cam.z > 1.01) {
      const mw = 64, mh = mw * reg.h / reg.w, mx = W - mw - 8, my = H - mh - 8;
      c.fillStyle = 'rgba(7,8,15,0.7)'; c.fillRect(mx - 2, my - 2, mw + 4, mh + 4);
      c.drawImage(mapLayer, reg.x, reg.y, reg.w, reg.h, mx, my, mw, mh);
      for (const cc of G.caches || []) { c.fillStyle = (frame >> 3) % 2 ? '#ffe14d' : '#7a6a20'; c.fillRect(Math.round(mx + ((cc.x + 0.5) * TILE - reg.x) / reg.w * mw) - 1, Math.round(my + ((cc.y + 0.5) * TILE - reg.y) / reg.h * mh) - 1, 3, 3); }
      c.strokeStyle = PAL.amber; c.lineWidth = 1; c.strokeRect(mx + (v.vx - reg.x) / reg.w * mw, my + (v.vy - reg.y) / reg.h * mh, v.vw / reg.w * mw, v.vh / reg.h * mh);
    }
    if (!scanPat) scanPat = c.createPattern(scan, 'repeat');
    c.fillStyle = scanPat; c.fillRect(0, 0, W, H);
  }

  // ---------- fx hook ----------
  const T2P = v => v * TILE;
  function burst(x, y, n, col, spd, life, g, s) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, v = spd * (0.3 + Math.random());
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.6 + Math.random() * 0.6), max: life, col, g: g || 0, s: s || 2 });
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
      case 'boom': rings.push({ x: T2P(d.x), y: T2P(d.y), r0: 2, r1: Math.max(6, d.r * TILE), life: d.big ? 0.6 : 0.25, max: d.big ? 0.6 : 0.25, col: d.col, fill: 1, w: d.big ? 3 : 2 }); burst(T2P(d.x), T2P(d.y), d.big ? 70 : 10, d.col, (d.big ? 90 : 35) * K, d.big ? 0.8 : 0.35); if (d.big) flashes.push({ col: '#ffe9b0', life: 0.25, max: 0.25, a: 0.35 }); break;
      case 'spark': burst(T2P(d.x), T2P(d.y), 3, d.col, 30 * K, 0.15); break;
      case 'rail': lines.push({ pts: [{ x: T2P(d.x1), y: T2P(d.y1) }, { x: T2P(d.x2), y: T2P(d.y2) }], life: 0.18, max: 0.18, col: d.col, core: 1, w: d.crit ? 5 : 3 }); break;
      case 'chain': case 'zap': {
        const pts = d.pts || [{ x: d.x1, y: d.y1 }, { x: d.x2, y: d.y2 }], out = [];
        for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], c2 = pts[i + 1]; for (let k = 0; k < 5; k++) { const tt = k / 5; out.push({ x: T2P(lerp(a.x, c2.x, tt)) + (k ? (Math.random() - 0.5) * 10 : 0), y: T2P(lerp(a.y, c2.y, tt)) + (k ? (Math.random() - 0.5) * 10 : 0) }); } }
        const last = pts[pts.length - 1]; out.push({ x: T2P(last.x), y: T2P(last.y) });
        lines.push({ pts: out, life: 0.14, max: 0.14, col: d.col, core: 1, w: 2 }); break;
      }
      case 'flame': for (let i = 0; i < 6; i++) { const a = d.ang + (Math.random() - 0.5) * 1.0, v = (d.range * TILE) * (2 + Math.random()); parts.push({ x: T2P(d.x) + Math.cos(d.ang) * 10, y: T2P(d.y) + Math.sin(d.ang) * 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.3, max: 0.3, col: Math.random() < 0.5 ? d.col : '#ffe14d', s: 3 }); } break;
      case 'pulse': rings.push({ x: T2P(d.x), y: T2P(d.y), r0: 4, r1: d.r * TILE, life: 0.35, max: 0.35, col: d.col, fill: 1 }); break;
      case 'grav': rings.push({ x: T2P(d.x), y: T2P(d.y), r0: d.r * TILE, r1: 2, life: 0.5, max: 0.5, col: '#b86cff', w: 3 }); break;
      case 'death': burst(T2P(d.x), T2P(d.y), d.boss ? (d.gen ? 40 : 100) : d.elite ? 22 : 9, d.boss ? (BOSS_COL[d.boss] || '#ff3355') : (ENEMY_COL[d.type] || '#ff5470'), (d.boss ? 70 : 30) * K, d.boss ? 1.2 : 0.4); if (d.boss) { flashes.push({ col: '#ffffff', life: 0.3, max: 0.3, a: 0.4 }); shakeAt(8, 0.5); } if (fullHud && d.cr) text(d.x, d.y - 0.6, '+' + d.cr, PAL.amber, 13, 0.6, -0.6); break;
      case 'arcs': for (let i = 0; i < 5; i++) { const a = Math.random() * 6.283, rr = d.r * TILE; lines.push({ pts: [{ x: T2P(d.x), y: T2P(d.y) }, { x: T2P(d.x) + Math.cos(a) * rr * 0.5 + (Math.random() - 0.5) * 10, y: T2P(d.y) + Math.sin(a) * rr * 0.5 }, { x: T2P(d.x) + Math.cos(a) * rr, y: T2P(d.y) + Math.sin(a) * rr }], life: 0.18, max: 0.18, col: '#9ff2ff', core: 1, w: 2 }); } break;
      case 'heal': rings.push({ x: T2P(d.x), y: T2P(d.y), r0: 2, r1: 36, life: 0.4, max: 0.4, col: '#7dffb0' }); break;
      case 'shieldpulse': rings.push({ x: T2P(d.x), y: T2P(d.y), r0: 2, r1: 36, life: 0.5, max: 0.5, col: '#8ab6ff' }); break;
      case 'blink': burst(T2P(d.x), T2P(d.y), 14, '#b86cff', 40 * K, 0.3); break;
      case 'lure': lines.push({ pts: [{ x: T2P(d.x1), y: T2P(d.y1) }, { x: T2P(d.x2), y: T2P(d.y2) }], life: 0.35, max: 0.35, col: '#59f0b4', core: 0, w: 1 }); break;
      case 'net': rings.push({ x: T2P(d.x), y: T2P(d.y), r0: 14, r1: 3, life: 0.35, max: 0.35, col: '#59f0b4', w: 2 }); burst(T2P(d.x), T2P(d.y), 8, '#c9fff0', 20 * K, 0.3); break;
      case 'say': if (texts.filter(T => T.bub).length >= 4) break; text(d.x, d.y - 1.5, d.t, '#ffffff', 13, 1.6, -0.35, 'Silkscreen, monospace'); texts[texts.length - 1].bub = 1; break;
      case 'song': for (let i = 0; i < 3; i++) rings.push({ x: T2P(d.x), y: T2P(d.y), r0: 6 + i * 10, r1: d.r * TILE, life: 0.6 + i * 0.25, max: 0.6 + i * 0.25, col: '#9fe7ff', w: 2 }); burst(T2P(d.x), T2P(d.y), 12, '#7dffb0', 30 * K, 0.6, -20 * K); break;
      case 'noodle': { const out = []; for (let k = 0; k <= 10; k++) { const t = k / 10, w = Math.sin(t * Math.PI * 3) * 8 * Math.sin(t * Math.PI); const dx = d.x2 - d.x1, dy = d.y2 - d.y1, L = Math.hypot(dx, dy) || 1; out.push({ x: T2P(lerp(d.x1, d.x2, t)) - dy / L * w, y: T2P(lerp(d.y1, d.y2, t)) + dx / L * w }); } lines.push({ pts: out, life: 0.7, max: 0.7, col: '#f2d27a', core: 0, w: 4 }); break; }
      case 'emp': rings.push({ x: T2P(d.x), y: T2P(d.y), r0: 2, r1: d.r * TILE, life: 0.4, max: 0.4, col: '#ffe14d', w: 3 }); burst(T2P(d.x), T2P(d.y), 10, '#ffffff', 40 * K, 0.25); break;
      case 'freeze': burst(T2P(d.x), T2P(d.y), 12, '#d8f8ff', 25 * K, 0.4); break;
      case 'implode': rings.push({ x: T2P(d.x), y: T2P(d.y), r0: d.r * TILE, r1: 0, life: 0.6, max: 0.6, col: '#b86cff', fill: 1, w: 3 }); for (let i = 0; i < 40; i++) { const a = Math.random() * 6.283, rr = d.r * TILE; parts.push({ x: T2P(d.x) + Math.cos(a) * rr, y: T2P(d.y) + Math.sin(a) * rr, vx: -Math.cos(a) * rr * 2, vy: -Math.sin(a) * rr * 2, life: 0.45, max: 0.45, col: '#d6a6ff', s: 2 }); } break;
      case 'leak': flashes.push({ col: '#ff3355', life: d.boss ? 0.6 : 0.25, max: d.boss ? 0.6 : 0.25, a: d.boss ? 0.45 : 0.2 }); shakeAt(d.boss ? 10 : 4, d.boss ? 0.6 : 0.2); burst(T2P(d.x), T2P(d.y), 18, '#ff3355', 50 * K, 0.5); break;
      case 'strike': lines.push({ pts: [{ x: T2P(d.x), y: -10 }, { x: T2P(d.x), y: T2P(d.y) }], life: 0.6, max: 0.6, col: '#ffe9b0', core: 1, w: 6 }); rings.push({ x: T2P(d.x), y: T2P(d.y), r0: 1.7 * TILE, r1: 2, life: 0.6, max: 0.6, col: '#ffe9b0', w: 3 }); break;
      case 'nova': flashes.push({ col: '#b86cff', life: 0.6, max: 0.6, a: 0.5 }); rings.push({ x: G.core.x * TILE, y: G.core.y * TILE, r0: 4, r1: BW, life: 0.7, max: 0.7, col: '#d6a6ff', w: 4 }); break;
      case 'stasis': flashes.push({ col: '#6ae2ff', life: 0.5, max: 0.5, a: 0.4 }); break;
      case 'overclock': flashes.push({ col: '#ffe14d', life: 0.3, max: 0.3, a: 0.3 }); for (const t of G.towers) burst(t.cx * TILE, t.cy * TILE, 6, '#ffe14d', 30 * K, 0.4); break;
      case 'rift': burst(T2P(d.x), T2P(d.y), 40, '#b86cff', 50 * K, 0.8); break;
      case 'cache': rings.push({ x: T2P(d.x), y: T2P(d.y), r0: 30, r1: 4, life: 0.6, max: 0.6, col: '#ffe14d', w: 2 }); break;
      case 'cacheClaim': rings.push({ x: T2P(d.x), y: T2P(d.y), r0: 4, r1: 34, life: 0.5, max: 0.5, col: '#ffe14d', w: 3, fill: 1 }); burst(T2P(d.x), T2P(d.y), 22, '#ffe14d', 50 * K, 0.6); break;
      case 'wormhole': { const p0 = d.lane.tiles[0]; rings.push({ x: (p0.x + 0.5) * TILE, y: (p0.y + 0.5) * TILE, r0: 40, r1: 2, life: 0.8, max: 0.8, col: '#b86cff', w: 3 }); burst((p0.x + 0.5) * TILE, (p0.y + 0.5) * TILE, 30, '#d6a6ff', 40 * K, 0.7); shakeAt(3, 0.25); break; }
      case 'lane': flashes.push({ col: '#ff4d6a', life: 0.5, max: 0.5, a: 0.3 }); { const p0 = d.lane.tiles[0]; rings.push({ x: (p0.x + 0.5) * TILE, y: (p0.y + 0.5) * TILE, r0: 2, r1: 56, life: 0.7, max: 0.7, col: '#ff4d6a', w: 4, fill: 1 }); } for (const p of d.lane.tiles.slice(0, d.lane.branch || 99)) burst(p.x * TILE + 12, p.y * TILE + 12, 4, '#ff4d6a', 20 * K, 0.8); break;
      case 'meteor': lines.push({ pts: [{ x: T2P(d.x) - 70, y: T2P(d.y) - 120 }, { x: T2P(d.x), y: T2P(d.y) }], life: 0.5, max: 0.5, col: '#ff7b39', core: 1, w: 5 }); break;
      case 'elite': burst(T2P(d.x), T2P(d.y), 10, '#ffe14d', 25 * K, 0.5); break;
      case 'jam': case 'fizzle': burst(T2P(d.x), T2P(d.y), 8, '#8a8aa6', 20 * K, 0.4, -20 * K); break;
      case 'plates': burst(T2P(d.x), T2P(d.y), 40, '#a4aac4', 60 * K, 0.8, 60 * K, 3); shakeAt(6, 0.3); break;
      case 'coin': text(d.x, d.y - 0.6, '+' + d.v, PAL.amber, 15, 1, -0.6); break;
      case 'shake': shakeAt(d.v, 0.3); break;
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
    scan = document.createElement('canvas'); scan.width = 1; scan.height = 3; scanPat = null;
    const sc = scan.getContext('2d'); sc.fillStyle = 'rgba(0,0,0,0.13)'; sc.fillRect(0, 2, 1, 1);
  }
  function reset() { parts = []; rings = []; lines = []; texts = []; flashes = []; conduits = []; vigKey = ''; mapDirty = true; mapKey = ''; selTile = null; selTower = null; preview = null; bufW = 0; }

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
    const tmp = document.createElement('canvas'); tmp.width = tmp.height = 24;
    const tg = tmp.getContext('2d'); tg.imageSmoothingEnabled = false;
    tg.drawImage(baseSprite(el), 0, 0);
    const top = topSprite(type, el, 0);
    if (ROTATES[type]) { tg.save(); tg.translate(12, 12); tg.rotate(-0.6); tg.drawImage(top, -12, -12); tg.restore(); } else tg.drawImage(top, 0, 0);
    if (locked) { g.globalAlpha = 0.9; g.drawImage(tinted('lk:' + type, tmp, '#151829'), 5, -3); g.globalAlpha = 1; }
    else g.drawImage(tmp, 5, -3);
  }
  function towerIcon(type, canvas) {
    const g = canvas.getContext('2d'), el = TOWERS[type].el;
    g.imageSmoothingEnabled = false; g.clearRect(0, 0, canvas.width, canvas.height);
    const tmp = document.createElement('canvas'); tmp.width = tmp.height = 24;
    const tg = tmp.getContext('2d');
    tg.drawImage(baseSprite(el), 0, 0);
    const top = topSprite(type, el, 0);
    if (ROTATES[type]) { tg.save(); tg.translate(12, 12); tg.rotate(-0.6); tg.imageSmoothingEnabled = false; tg.drawImage(top, -12, -12); tg.restore(); } else tg.drawImage(top, 0, 0);
    g.drawImage(tmp, 0, 0, 24, 24, 0, 0, canvas.width, canvas.height);
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
    init, resize, draw, fx, reset, towerIcon, towerCard, preview_map, screenToTile, zoomAt, panBy, resetCam,
    set sel(v) { selTile = v; }, set selT(v) { selTower = v; }, set prev(v) { preview = v; }, set aim(v) { aimPos = v; },
    set full(v) { fullHud = v; }, set nums(v) { showNums = v; }, set shakeOn(v) { doShake = v; },
    get layout() { return { ox, oy, scale, W, H, z: cam.z }; }, get zoom() { return cam.z; }, markMap() { mapDirty = true; },
    set onCam(f) { onCam = f; },
    tileToScreen,
  };
})();
