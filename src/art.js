// ===================== ENTROPY — HI-RES ART KIT (v4.5) =====================
// Sprites are painted procedurally at 2 px per world unit. Each design is a list of parts: a height field (how tall the
// surface is at each point, in local coords facing +x) plus a colour ramp. The rasterizer picks the tallest part per pixel,
// lights it from the top-left with a 6-tone ramp and a 2x2 dither, adds cast shadows, contact lines and a sel-out outline.
// Rotating turrets are re-rendered per heading (32 steps), so the light stays fixed and edges stay crisp at every angle.
const ART = (() => {
  const RESA = 2;
  // ---------- colour ----------
  const rgbC = new Map();
  function rgb(hex) {
    let v = rgbC.get(hex); if (v) return v;
    const n = parseInt(hex.slice(1), 16); v = [n >> 16 & 255, n >> 8 & 255, n & 255]; rgbC.set(hex, v); return v;
  }
  function mix(a, b, t) {
    const A = rgb(a), B = rgb(b), r = Math.round(A[0] + (B[0] - A[0]) * t), g = Math.round(A[1] + (B[1] - A[1]) * t), bb = Math.round(A[2] + (B[2] - A[2]) * t);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bb).toString(16).slice(1);
  }
  const rampC = new Map();
  // six tones, darkest first; shadows lean cool/purple and highlights warm, the classic pixel-art hue shift
  function ramp(col, hi) {
    const key = col + (hi || ''); let r = rampC.get(key); if (r) return r;
    r = [mix(col, '#07051a', 0.84), mix(col, '#0b0a26', 0.62), mix(col, '#100e2c', 0.36), col, mix(col, '#fff4dc', 0.32), mix(col, '#ffffff', hi === undefined ? 0.66 : hi)];
    rampC.set(key, r); return r;
  }
  const STEEL = ['#06070f', '#121630', '#1f2546', '#2f3762', '#48528a', '#8d97cb'];
  const DARKSTEEL = ['#04050b', '#0b0d1d', '#151a33', '#212849', '#323b66', '#5f6aa0'];
  const BRASS = ['#120a02', '#3a2408', '#6e4a14', '#a8762a', '#dcaa4e', '#fff0b8'];
  const RUST = ['#0e0604', '#2a140c', '#4a2818', '#6e4228', '#97643e', '#d9a676'];

  // ---------- height-field shapes (local px, origin at sprite centre, facing +x) ----------
  const S = {
    dome: (cx, cy, r, h) => (x, y) => { const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy); return d2 > r * r ? -1 : Math.sqrt(r * r - d2) / r * h; },
    // flat-topped disc with a rounded bevel of width bv
    puck: (cx, cy, r, h, bv) => (x, y) => { const d = r - Math.hypot(x - cx, y - cy); return d < 0 ? -1 : h * Math.min(1, Math.sqrt(Math.min(1, (d + 0.4) / (bv || 2)))); },
    box: (x0, y0, x1, y1, h, bv) => (x, y) => { const d = Math.min(x - x0, x1 - x, y - y0, y1 - y); return d < 0 ? -1 : h * Math.min(1, Math.sqrt(Math.min(1, (d + 0.4) / (bv || 2)))); },
    // rounded rectangle, corner radius rr
    rbox: (x0, y0, x1, y1, rr, h, bv) => (x, y) => {
      const qx = Math.max(x0 + rr - x, 0, x - (x1 - rr)), qy = Math.max(y0 + rr - y, 0, y - (y1 - rr));
      const out = Math.hypot(qx, qy) - rr, inner = Math.min(x - x0, x1 - x, y - y0, y1 - y), d = qx > 0 && qy > 0 ? -out : inner;
      return d < 0 || out > 0 ? -1 : h * Math.min(1, Math.sqrt(Math.min(1, (d + 0.4) / (bv || 2))));
    },
    // cylinder lying along x (a barrel), radius r around cy, base height h0
    tube: (x0, x1, cy, r, h0) => (x, y) => { const dy = y - cy; return x < x0 || x > x1 || Math.abs(dy) > r ? -1 : (h0 || 0) + Math.sqrt(r * r - dy * dy); },
    // torus seen from above
    ring: (cx, cy, r0, r1, h0) => (x, y) => { const m = (r0 + r1) / 2, w = (r1 - r0) / 2, t = Math.abs(Math.hypot(x - cx, y - cy) - m); return t > w ? -1 : (h0 || 0) + Math.sqrt(w * w - t * t); },
    // convex or concave polygon with a bevel
    poly: (pts, h, bv) => (x, y) => {
      let ins = false, dm = 1e9;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
        const ex = xj - xi, ey = yj - yi, L = ex * ex + ey * ey || 1, t = Math.max(0, Math.min(1, ((x - xi) * ex + (y - yi) * ey) / L));
        dm = Math.min(dm, Math.hypot(x - xi - ex * t, y - yi - ey * t));
      }
      return ins ? h * Math.min(1, Math.sqrt(Math.min(1, (dm + 0.4) / (bv || 2)))) : -1;
    },
    ell: (cx, cy, rx, ry, h) => (x, y) => { const q = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; return q > 1 ? -1 : Math.sqrt(1 - q) * h; },
    // a faceted gem (diamond / crystal): height falls linearly to the edges, giving hard facets
    gem: (cx, cy, rx, ry, h) => (x, y) => { const q = Math.abs(x - cx) / rx + Math.abs(y - cy) / ry; return q > 1 ? -1 : (1 - q) * h; },
    hexgem: (cx, cy, r, h) => (x, y) => { const dx = Math.abs(x - cx), dy = Math.abs(y - cy), q = Math.max(dx * 0.866 + dy * 0.5, dy) / r; return q > 1 ? -1 : (1 - q * 0.7) * h; },
  };
  const max = (...fs) => (x, y) => { let m = -1; for (const f of fs) { const v = f(x, y); if (v > m) m = v; } return m; };
  const cut = (f, g) => (x, y) => g(x, y) >= 0 ? -1 : f(x, y);

  // ---------- rasterizer ----------
  const L = (() => { const v = [-0.52, -0.7, 0.9], n = Math.hypot(...v); return v.map(a => a / n); })();
  const BAY = [0, 0.5, 0.75, 0.25];
  // parts: [{ f, z, r: ramp, d?: (lx, ly) => tone delta, e?: (lx, ly) => hex | null (emissive), k?: steepness }]
  function raster(parts, W, H, ang, opt) {
    opt = opt || {};
    const cx = W / 2, cy = H / 2, ca = Math.cos(ang || 0), sa = Math.sin(ang || 0), n = W * H;
    const hm = new Float32Array(n).fill(-1e9), pid = new Int16Array(n).fill(-1), lx = new Float32Array(n), ly = new Float32Array(n);
    const ox = opt.ox || 0, oy = opt.oy || 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - cx - ox, dy = y + 0.5 - cy - oy, X = dx * ca + dy * sa, Y = -dx * sa + dy * ca, i = y * W + x;
      lx[i] = X; ly[i] = Y;
      let best = -1, bh = -1e9;
      for (let k = 0; k < parts.length; k++) { const h = parts[k].f(X, Y); if (h >= 0 && parts[k].z + h > bh) { bh = parts[k].z + h; best = k; } }
      if (best >= 0) { hm[i] = bh; pid[i] = best; }
    }
    const out = new Uint8ClampedArray(n * 4), tone = new Int8Array(n).fill(-1);
    const loc = (x, y) => { const dx = x + 0.5 - cx - ox, dy = y + 0.5 - cy - oy; return [dx * ca + dy * sa, -dx * sa + dy * ca]; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, p = pid[i]; if (p < 0) continue;
      const P = parts[p], h0 = hm[i] - P.z, k = P.k || 1;
      const hs = (xx, yy) => { const [a, bq] = loc(xx, yy), v = P.f(a, bq); return v < 0 ? h0 - 2.5 : v; };
      const gx = (hs(x + 1, y) - hs(x - 1, y)) * 0.5 * k, gy = (hs(x, y + 1) - hs(x, y - 1)) * 0.5 * k;
      const nl = Math.hypot(gx, gy, 1), d = (-gx * L[0] - gy * L[1] + L[2]) / nl;
      // a flat top lands in the middle of tone 3; facing the light climbs to 4-5, facing away drops to 2-0. Dither only near tone edges.
      let t = 3.5 + (d - L[2]) * 5.2 + (BAY[(x & 1) + ((y & 1) << 1)] - 0.375) * 0.55;
      // cast shadow from anything taller up and to the left
      for (const s of [1, 2, 3]) { const j = (y - s) * W + (x - s); if (y - s >= 0 && x - s >= 0 && hm[j] > hm[i] + 1.6 * s + 0.5) { t -= 1.4; break; } }
      if (P.d) t += P.d(lx[i], ly[i]) || 0;
      let ti = Math.max(0, Math.min(5, Math.floor(t)));
      // contact line where this surface meets a taller neighbour
      for (const j of [i - 1, i + 1, i - W, i + W]) if (j >= 0 && j < n && pid[j] >= 0 && pid[j] !== p && hm[j] > hm[i] + 3) { ti = Math.min(ti, 1); break; }
      tone[i] = ti;
      let col = P.r[ti];
      if (P.e) { const e = P.e(lx[i], ly[i], ti); if (e) col = e; }
      const c = rgb(col); out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = 255;
    }
    // sel-out: a dark rim on empty pixels touching the sprite, tinted by the neighbour's darkest tone
    if (opt.outline !== false) {
      const oc = rgb(opt.outline || '#04040a'), add = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x; if (pid[i] >= 0) continue;
        let q = -1;
        if (x > 0 && pid[i - 1] >= 0) q = i - 1; else if (x < W - 1 && pid[i + 1] >= 0) q = i + 1; else if (y > 0 && pid[i - W] >= 0) q = i - W; else if (y < H - 1 && pid[i + W] >= 0) q = i + W;
        if (q >= 0) add.push(i, q);
      }
      for (let k = 0; k < add.length; k += 2) { const i = add[k], c = rgb(parts[pid[add[k + 1]]].r[0]); out[i * 4] = (c[0] + oc[0]) >> 1; out[i * 4 + 1] = (c[1] + oc[1]) >> 1; out[i * 4 + 2] = (c[2] + oc[2]) >> 1; out[i * 4 + 3] = 255; }
    }
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    cv.getContext('2d').putImageData(new ImageData(out, W, H), 0, 0);
    cv.u = 1 / RESA; // world units per pixel
    return cv;
  }
  // flat overlays painted after shading (emissive lights, decals), in local coords
  function paintOver(cv, ang, fn, ox, oy) {
    const g = cv.getContext('2d'), W = cv.width, H = cv.height, ca = Math.cos(ang || 0), sa = Math.sin(ang || 0);
    const P = (x, y, c, a) => { const X = W / 2 + (ox || 0) + x * ca - y * sa, Y = H / 2 + (oy || 0) + x * sa + y * ca; g.globalAlpha = a === undefined ? 1 : a; g.fillStyle = c; g.fillRect(Math.floor(X), Math.floor(Y), 1, 1); };
    fn(P); g.globalAlpha = 1; return cv;
  }
  // ---------- cache with a background warm-up queue ----------
  const cache = new Map(), queue = [];
  function get(key, make) { let c = cache.get(key); if (!c) { c = make(); cache.set(key, c); } return c; }
  function warm(key, make) { if (!cache.has(key)) queue.push([key, make]); }
  function idle(budgetMs) { const t0 = performance.now(); while (queue.length && performance.now() - t0 < budgetMs) { const [k, m] = queue.shift(); if (!cache.has(k)) cache.set(k, m()); } }
  return { RES: RESA, raster, paintOver, S, max, cut, ramp, mix, rgb, STEEL, DARKSTEEL, BRASS, RUST, get, warm, idle, cacheSize: () => cache.size };
})();
