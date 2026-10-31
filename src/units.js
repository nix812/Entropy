// ===================== ENTROPY — TOWER AND ENEMY DESIGNS (v4.5 hi-res) =====================
// Local coords are hi-res pixels (2 per world unit), origin at the centre, +x = facing. A tile is 48 px.
const UNITS = (() => {
  const { S, max, cut, ramp, mix, STEEL, DARKSTEEL, BRASS, RUST, raster, paintOver, get } = ART;
  const P = (f, z, r, o) => Object.assign({ f, z: z || 0, r }, o || {});
  const NA = 32; // headings per turret
  const angOf = i => i / NA * Math.PI * 2;
  const idxOf = a => ((Math.round(a / (Math.PI * 2) * NA) % NA) + NA) % NA;
  const GUN = ramp('#7f89bd', 0.7), GUNM = ramp('#5d6798'), HULL = ramp('#3d4672', 0.55);
  const stripes = (period, w, axis) => (x, y) => (((axis ? y : x) % period + period) % period) < w ? -1 : 0;
  const glow = (col, test) => (x, y) => test(x, y) ? col : null;

  // ---------- bases: an octagonal deck plate per element, with lit seams ----------
  function base(el) {
    return get('tb:' + el, () => {
      const c = EL[el].col, oct = [];
      for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * Math.PI * 2; oct.push([Math.cos(a) * 25, Math.sin(a) * 25]); }
      const plate = cut(S.poly(oct, 5, 3), S.dome(0, 0, 15.5, 1));
      const parts = [
        P(plate, 0, STEEL, { d: (x, y) => (Math.abs(x) < 0.8 || Math.abs(y) < 0.8 ? -1.2 : 0) + ((Math.abs(Math.abs(x) - 17) < 1.4 && Math.abs(Math.abs(y) - 17) < 1.4) ? 1.5 : 0),
          e: (x, y) => (Math.abs(x) < 2.6 && Math.abs(y) > 19 && Math.abs(y) < 22.5) || (Math.abs(y) < 2.6 && Math.abs(x) > 19 && Math.abs(x) < 22.5) ? (Math.abs(x) + Math.abs(y) < 21.5 ? mix(c, '#ffffff', 0.4) : c) : null }),
        P(S.puck(0, 0, 15.5, 1.5, 1), 0, DARKSTEEL, { d: (x, y) => { const r = Math.hypot(x, y); return r > 13.5 ? 1 : 0; } }),
      ];
      return raster(parts, 52, 52, 0);
    });
  }

  // ---------- tower tops ----------
  // each returns parts for heading ang; a = { rk: recoil 0..1, ph: animation phase, ld: loaded }
  const TOP = {
    pulse(c, v, a) {
      const C = ramp(c), rk = a.rk * 4, parts = [
        P(S.rbox(-13, -11, 5, 11, 5, 7, 3), 3, HULL, { d: (x, y) => Math.abs(y) < 0.7 && x < 2 ? -1 : 0 }),
        P(S.dome(-3, 0, 8.5, 7), 8, GUNM, { e: glow(c, (x, y) => Math.hypot(x + 6, y + 3) < 1.6) }),
      ];
      const barrel = (y, r, L) => { parts.push(P(S.tube(2, L - rk, y, r, 0), 9, GUN, { d: stripes(5, 1) }));
        parts.push(P(S.tube(L - 5 - rk, L + 1 - rk, y, r + 1.2, 0), 9, C, { e: glow(mix(c, '#ffffff', 0.5), (x, yy) => x > L - rk - 0.5) })); };
      if (v === 1) { // Gatling Array: a fat rotating drum
        parts.push(P(S.tube(1, 21 - rk * 0.5, 0, 5.5, 0), 8, GUNM, { d: (x, y) => ((Math.floor(y + 5.5 + a.ph * 1.8) % 4) === 0 ? -1.5 : 0.3) }));
        parts.push(P(S.tube(17 - rk * 0.5, 23 - rk * 0.5, 0, 6.5, 0), 8, C));
      } else if (v === 2) { barrel(-5, 2.6, 21); barrel(5, 2.6, 21); parts.push(P(S.box(0, -7, 7, 7, 4, 2), 10, GUNM)); }
      else barrel(0, 3, 22);
      return parts;
    },
    rail(c, v, a) {
      const C = ramp(c), rk = a.rk * 3, L = v === 1 ? 26 : 23, parts = [
        P(S.rbox(-16, -10, -1, 10, 3, 7, 2), 3, ramp('#2a3156', 0.5), { d: stripes(3, 1) , e: glow(c, (x, y) => Math.abs(y) < 1.2 && x < -3 && x > -14) }),
        P(S.box(-6, -8.5, L - rk, -3.5, 5, 1.6), 7, GUN, { d: (x, y) => x > L - rk - 3 ? 1 : 0 }),
        P(S.box(-6, 3.5, L - rk, 8.5, 5, 1.6), 7, GUN, { d: (x, y) => x > L - rk - 3 ? 1 : 0 }),
        P(S.box(-4, -2.4, L - 3 - rk, 2.4, 2, 1), 5, C, { e: (x, y) => Math.abs(y) < 0.9 ? mix(c, '#ffffff', 0.7) : null }),
      ];
      if (v === 1) for (const x of [4, 11, 18]) parts.push(P(S.box(x - rk, -10.5, x + 2.5 - rk, 10.5, 3, 1), 9, ramp(mix(c, '#5d6798', 0.5))));
      if (v === 2) { parts.push(P(S.poly([[L - 4 - rk, -8.5], [L + 4 - rk, -13], [L + 1 - rk, -8.5]], 5, 1), 7, GUN)); parts.push(P(S.poly([[L - 4 - rk, 8.5], [L + 4 - rk, 13], [L + 1 - rk, 8.5]], 5, 1), 7, GUN)); }
      return parts;
    },
    missile(c, v, a) {
      const body = ramp('#5e5040', 0.5), parts = [P(S.rbox(-15, -15, 13, 15, 4, 7, 3), 2, body, { d: (x, y) => (Math.abs(x + 15) < 1.4 ? -1 : 0) + (Math.abs(y) < 0.7 ? -1 : 0) })];
      const tubes = v === 1 ? [-9, 0, 9].flatMap(y => [-7, 3].map(x => [x, y, 3.8])) : [[-5, -6.5, 5.6], [-5, 6.5, 5.6], [6, -6.5, 5.6], [6, 6.5, 5.6]];
      for (const [x, y, r] of tubes) {
        parts.push(P(S.puck(x, y, r, 5, 1.2), 8, ramp('#968266', 0.6)));
        parts.push(P(S.puck(x, y, r - 1.6, 0.6, 0.5), 13, ramp('#120806'), { e: a.ld ? (xx, yy) => { const q = Math.hypot(xx - x, yy - y); return q < r - 2.4 ? (q < 1.3 ? mix(c, '#fff2c0', 0.6) : c) : null; } : null }));
      }
      if (v === 2) for (const y of [-17, 17]) parts.push(P(S.tube(-14, 10, y, 4, 0), 4, ramp('#c8551c', 0.5), { d: (x) => (Math.floor((x + 40) / 3) % 2 ? -1 : 0) }));
      return parts;
    },
    flame(c, v, a) {
      const tank = v === 1 ? ramp('#b0401c', 0.5) : ramp('#7a3a1c', 0.5), parts = [
        P(S.rbox(-15, -11, 2, 11, 6, 8, 3), 2, ramp('#3e2a20', 0.5), { d: stripes(4, 1, 1) }),
        P(S.dome(-9, -7, v === 1 ? 6.5 : 5.5, 7), 8, tank), P(S.dome(-9, 7, v === 1 ? 6.5 : 5.5, 7), 8, tank),
        P(S.tube(-2, 17, 0, 3.4, 0), 8, GUNM, { d: stripes(4, 1) }),
        P(max(S.tube(15, 22, 0, 5, 0), S.ell(21, 0, 3, 6, 4)), 8, ramp('#8a6a4a', 0.6), { e: glow(['#ffe14d', '#ff9a3c', c][a.ph % 3], (x, y) => x > 21.5 && Math.abs(y) < 2.4) }),
      ];
      if (v === 2) for (const x of [4, 9]) parts.push(P(S.ring(x, 0, 3, 5.4, 0), 10, ramp(EL.A.col, 0.8)));
      return parts;
    },
    emp(c, v, a) {
      const rk = a.rk * 3, parts = [P(S.puck(-3, 0, 14, 6, 3), 2, ramp('#3a3a28', 0.55), { d: (x, y) => { const an = Math.atan2(y, x + 3), r = Math.hypot(x + 3, y); return r > 11.5 ? ((Math.floor(an / 0.4) % 2) ? -1 : 1) : 0; } })];
      const tubes = v === 2 ? [[-6, 3.6], [0, 3.6], [6, 3.6]] : [[0, v === 1 ? 7.5 : 6.5]];
      for (const [y, r] of tubes) {
        parts.push(P(S.tube(-2, 15 - rk, y, r, 0), 8, ramp(v === 1 ? '#3a3a3a' : '#6a6a52', 0.6), { d: v === 1 ? (x) => (Math.floor((x + 40) / 3) % 2 ? -1.5 : 0.5) : stripes(6, 1) }));
        parts.push(P(S.ell(15 - rk, y, 2.2, r, r), 8, ramp('#0c0c08'), { e: glow(c, (x, yy) => Math.abs(yy - y) < 1 && a.rk > 0) }));
      }
      parts.push(P(S.dome(-8, 0, 5, 5), 12, ramp(c), { e: glow('#ffffff', (x, y) => Math.hypot(x + 9.5, y + 1.5) < 1.2) }));
      return parts;
    },
    cryo(c, v, a) {
      const C = ramp(c, 0.85), parts = [P(S.puck(0, 0, 14, 3, 2), 0, STEEL, { d: (x, y) => (Math.hypot(x, y) > 12 ? 1 : 0) })];
      const big = v === 1 ? 11 : 9.5;
      parts.push(P(S.hexgem(0, 0, big, v === 1 ? 20 : 16), 3, C, { e: (x, y, t) => t >= 5 ? '#ffffff' : null }));
      const n = v === 2 ? 6 : 3, rr = v === 2 ? 13 : 11;
      for (let k = 0; k < n; k++) { const an = k / n * 6.283 + 0.5; parts.push(P(S.gem(Math.cos(an) * rr, Math.sin(an) * rr, v === 2 ? 3 : 4.5, v === 2 ? 3 : 4.5, v === 2 ? 9 : 11), 3, C)); }
      return parts;
    },
    lens(c, v, a) {
      const parts = [P(S.ring(0, 0, 13, 18, 0), 3, ramp('#2e2448', 0.5), { d: (x, y) => { const an = Math.atan2(y, x); return Math.abs(((an + 6.283) % 1.571) - 0.785) < 0.12 ? -2 : 0; } })];
      for (let k = 0; k < 4; k++) { const an = k * 1.5708 + 0.785; parts.push(P(S.box(-3, -3, 3, 3, 4, 1.5), 0, GUNM, {}));
        parts[parts.length - 1].f = (f => (x, y) => f(x - Math.cos(an) * 15.5, y - Math.sin(an) * 15.5))(S.box(-3, -3, 3, 3, 5, 1.5)); parts[parts.length - 1].z = 5; }
      if (v === 2) for (let k = 0; k < 3; k++) { const an = k / 3 * 6.283; parts.push(P(S.dome(Math.cos(an) * 6, Math.sin(an) * 6, 5, 7), 6, ramp(c, 0.9))); }
      else if (v === 1) { parts.push(P(S.ring(0, 0, 7, 11, 0), 7, ramp(c, 0.8))); parts.push(P(S.dome(0, 0, 7.5, 9), 6, ramp('#16102a', 0.25))); }
      else parts.push(P(S.dome(0, 0, 9, 10), 5, ramp(c, 0.9), { e: (x, y) => Math.hypot(x + 2.5, y + 2.5) < 2 ? '#ffffff' : null }));
      return parts;
    },
    coil(c, v, a) {
      const parts = [P(S.puck(0, 0, 16, 3, 2), 0, ramp('#3a3020', 0.5))];
      const rings = [[11.5, 16, 2], [7.5, 11.5, 6], [4, 7.5, 10]];
      rings.forEach(([r0, r1, z], k) => parts.push(P(S.ring(0, 0, r0, r1, 0), z, ramp(v === 2 ? '#d86a2a' : '#c89a3a', 0.8), { d: (x, y) => (Math.floor((Math.atan2(y, x) + 3.1416) * 6 + k) % 2 ? 0 : -1) })));
      parts.push(P(S.dome(0, 0, 4, 5), 13, ramp(c, 0.95), { e: (x, y) => Math.hypot(x + 1, y + 1) < 1.5 ? '#ffffff' : null }));
      if (v === 1) for (let k = 0; k < 6; k++) { const an = k / 6 * 6.283; parts.push(P(S.gem(Math.cos(an) * 15, Math.sin(an) * 15, 2.5, 2.5, 9), 3, ramp(c, 0.9))); }
      return parts;
    },
    pylon(c, v, a) { // relay mast: tripod struts, a tall spine, radar dishes sweeping round, a beacon on top
      const hex = []; for (let k = 0; k < 6; k++) { const an = k / 6 * 6.283; hex.push([Math.cos(an) * 15, Math.sin(an) * 15]); }
      const parts = [P(S.poly(hex, 5, 3), 0, HULL, { e: glow(c, (x, y) => Math.abs(Math.hypot(x, y) - 11.5) < 0.8 && (Math.floor(Math.atan2(y, x) * 3) % 2 === 0)) })];
      for (let k = 0; k < 3; k++) { const an = k / 3 * 6.283 + 0.5, ex = Math.cos(an) * 15, ey = Math.sin(an) * 15, nx = -Math.sin(an) * 1.6, ny = Math.cos(an) * 1.6;
        parts.push(P(S.poly([[nx, ny], [ex + nx, ey + ny], [ex - nx, ey - ny], [-nx, -ny]], 4, 1), 5, GUNM)); }
      parts.push(P(S.puck(0, 0, 4.5, 16, 1.5), 5, GUN, { d: (x, y) => 0 }));
      const nd = (v || 0) + 1;
      for (let k = 0; k < nd; k++) { const an = k / nd * 6.283;
        parts.push(P((x, y) => { const X = x * Math.cos(an) + y * Math.sin(an), Y = -x * Math.sin(an) + y * Math.cos(an); const r = Math.hypot(X - 3, Y); return X < 4 || r < 8 || r > 15 || Math.abs(Y) > 9 ? -1 : 2 + (r - 8) * 0.5; }, 17, ramp(mix(c, '#c8d0f0', 0.5), 0.8), { e: (x, y) => null }));
        parts.push(P((x, y) => { const X = x * Math.cos(an) + y * Math.sin(an), Y = -x * Math.sin(an) + y * Math.cos(an); return X < 0 || X > 9 || Math.abs(Y) > 1.2 ? -1 : 2; }, 19, GUN)); }
      parts.push(P(S.dome(0, 0, 3.6, 4), 22, ramp(c, 1), { e: (x, y) => Math.hypot(x + 1, y + 1) < 1.4 ? '#ffffff' : null }));
      return parts;
    },
    forge(c, v, a) {
      const body = v === 1 ? BRASS : RUST, parts = [
        P(S.rbox(-17, -15, 17, 15, 4, 8, 3), 0, body, { d: (x, y) => (Math.abs(y + 3) < 0.7 ? -1 : 0) + ((Math.abs(Math.abs(x) - 14) < 1.2 && Math.abs(Math.abs(y) - 12) < 1.2) ? 2 : 0) }),
        P(S.rbox(-11, 0, 11, 11, 2, 3, 1), 8, ramp('#1a0c04'), { e: (x, y) => { const k = (y - 1) / 9; return k > 0.2 ? [ '#ff8a2a', '#ffb03a', '#ffe14d' ][Math.min(2, Math.floor(k * 3 + (a.ph % 2) * 0.4))] : null; } }),
        P(S.puck(10, -8, 4.5, 14, 1.5), 4, DARKSTEEL, { e: (x, y) => Math.hypot(x - 10, y + 8) < 2.6 ? '#120a06' : null }),
        P(S.ring(-8, -8, 2.5, 6, 0), 9, BRASS, { d: (x, y) => (Math.floor((Math.atan2(y + 8, x + 8) + a.ph * 0.4) * 2.6) % 2 ? -1 : 0) }),
      ];
      if (v === 2) parts.push(P(S.ring(0, 0, 18, 21, 0), 1, ramp(c, 0.8)));
      return parts;
    },
    snare(c, v, a) {
      const parts = [P(S.puck(0, 0, 15, 4, 2), 0, HULL, { e: glow(c, (x, y) => Math.abs(Math.hypot(x, y) - 12.5) < 0.9 && (Math.floor(Math.atan2(y, x) * 4) % 2 === 0)) }),
        P(S.puck(0, 0, 4, 12, 1.5), 4, GUN),
        P(S.box(-3, -13, 3, 13, 3, 1.5), 15, ramp('#9fb4d8', 0.7), { e: glow(c, (x, y) => Math.abs(y) > 10.5) }),
        P(S.dome(0, 0, 3.5, 3), 18, ramp(c, 0.9))];
      for (const s of [-1, 1]) parts.push(P(S.ring(s * 9, 0, 2, 5, 0), 5, ramp(v === 1 ? '#3ac08a' : '#2a8a6a', 0.7)));
      if (v === 2) parts.push(P(S.ring(0, 0, 15, 18, 0), 2, ramp(c, 0.8)));
      return parts;
    },
    grav(c, v, a) {
      const parts = [];
      for (let k = 0; k < 4; k++) { const an = k * 1.5708 + 0.785, f = S.box(-3.5, -3.5, 3.5, 3.5, 9, 2); parts.push(P((x, y) => f(x - Math.cos(an) * 17, y - Math.sin(an) * 17), 0, HULL, { e: glow(c, (x, y) => Math.hypot(x - Math.cos(an) * 17, y - Math.sin(an) * 17) < 1.5) })); }
      parts.push(P(S.ring(0, 0, 10, v === 2 ? 17 : 15, 0), 2, ramp(c, 0.9), { d: (x, y) => (Math.floor((Math.atan2(y, x) + 3.1416) * 2.2) % 2 ? -1 : 0.5) }));
      parts.push(P(S.dome(0, 0, v === 1 ? 10 : 8.5, 9), 3, ['#020106', '#06030e', '#0c0618', '#160c2a', '#2a1a4a', '#6a4aa0']));
      return parts;
    },
  };
  // non-rotating tops spin as an idle animation (lighting stays fixed, so only the asymmetric details move)
  const SPIN = { cryo: 0.25, lens: 0.4, coil: 0, pylon: 0.9, forge: 0, snare: 1.4, grav: 0.7 };
  function top(type, el, spec, ang, anim) {
    const ai = idxOf(ang), rk = anim.rk ? 1 : 0, ph = anim.ph || 0, ld = anim.ld ? 1 : 0;
    const key = `tt:${type}:${el}:${spec}:${ai}:${rk}:${ph}:${ld}`;
    return ART.getB(key, () => raster(TOP[type](EL[el].col, spec || 0, { rk, ph, ld }), 60, 60, angOf(ai)), () => {
      for (let d = 0; d <= NA / 2; d++) for (const a2 of [(ai + d) % NA, (ai - d + NA) % NA]) for (const k of [`tt:${type}:${el}:${spec}:${a2}:${rk}:${ph}:${ld}`, `tt:${type}:${el}:${spec}:${a2}:0:0:${ld}`, `tt:${type}:${el}:${spec}:${a2}:0:0:1`, `tt:${type}:${el}:${spec}:${a2}:0:0:0`]) { const c = ART.has(k); if (c) return c; } return null; });
  }
  // build-menu card / icon art: one composite at a fixed heading
  function icon(type, el) {
    return get('ti:' + type + ':' + el, () => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 60; const g = cv.getContext('2d');
      g.drawImage(base(el), 4, 4); g.drawImage(top(type, el, 0, ROT[type] ? -0.6 : 0, { ld: 1 }), 0, 0); cv.u = 0.5; return cv;
    });
  }
  const ROT = { pulse: 1, rail: 1, missile: 1, flame: 1, emp: 1 };

  // ---------- enemies ----------
  // ground units face their heading; frames animate legs, wings and tendrils
  const ENEMY = {
    drone(c, f) { // a beetle: split carapace, mandibles, a glowing eye, six scuttling legs
      const C = ramp(c, 0.6), parts = [], st = [0, 1, 0, -1][f] * 1.8;
      for (const s of [-1, 1]) for (const k of [-1, 0, 1]) { const sw = (k === 0 ? -st : st) * s, x0 = k * 5.5, x1 = x0 + sw + k * 2.5, y1 = s * 14;
        parts.push(P(S.poly([[x0 - 1, s * 5], [x0 + 1, s * 5], [x1 + 1, y1], [x1 - 1, y1]].map(([px, py]) => [px, py]), 3, 1), 0, ramp('#4a1222', 0.5))); }
      parts.push(P(S.ell(-2, -4.2, 10.5, 6.2, 8), 3, C, { d: (x, y) => (Math.abs(y) < 0.8 ? -2 : 0) + (Math.hypot(x + 4, y + 5) < 2 ? 1 : 0) }));
      parts.push(P(S.ell(-2, 4.2, 10.5, 6.2, 8), 3, C, { d: (x, y) => (Math.abs(y) < 0.8 ? -2 : 0) + (Math.hypot(x + 4, y - 5) < 2 ? 1 : 0) }));
      parts.push(P(S.ell(9.5, 0, 4.5, 5, 6), 3, ramp(mix(c, '#2a0618', 0.5), 0.5), { e: (x, y) => Math.hypot(x - 11, y) < 1.8 ? '#ffe9a0' : null }));
      for (const s of [-1, 1]) parts.push(P(S.poly([[11, s * 2.5], [17, s * (3 + (f % 2))], [15, s * 0.8]], 3, 1), 4, ramp('#ffd0dc', 0.8)));
      return parts;
    },
    swarmer(c, f) { // a twitchy tick
      const parts = [], st = f % 2 ? 1.5 : -1.5;
      for (const s of [-1, 1]) for (const k of [-1, 1]) parts.push(P(S.box(k * 3 - 0.8 + st * s * k, Math.min(s * 3, s * 7.5), k * 3 + 0.8 + st * s * k, Math.max(s * 3, s * 7.5), 2, 1), 0, ramp('#3a0a24')));
      parts.push(P(S.dome(-1, 0, 5.5, 6), 2, ramp(c, 0.7))); parts.push(P(S.dome(4.5, 0, 3, 4), 2, ramp(mix(c, '#3a0a24', 0.4)), { e: (x, y) => Math.hypot(x - 5.5, y) < 1.2 ? '#ffffff' : null }));
      return parts;
    },
    tank(c, f) { // Juggernaut: tracked fortress with stacked plates
      const parts = [];
      for (const s of [-1, 1]) parts.push(P(S.box(-17, s * 10 - 5.5, 17, s * 10 + 5.5, 6, 2), 0, ramp('#24101a', 0.4), { d: (x) => (((Math.floor((x + 40 + f * 1.5) / 3)) % 2) ? -1.2 : 0.6) }));
      parts.push(P(S.rbox(-15, -9, 15, 9, 4, 9, 3), 3, ramp(c, 0.5), { d: (x, y) => (Math.abs(x - 2) < 0.7 || Math.abs(x + 7) < 0.7 ? -1.5 : 0) }));
      parts.push(P(S.rbox(-8, -6, 6, 6, 3, 6, 2), 11, ramp(mix(c, '#2a0a12', 0.3), 0.6)));
      parts.push(P(S.tube(4, 17, 0, 2.2, 0), 13, ramp('#5a2a38'), { e: (x, y) => x > 15.5 ? '#ffe14d' : null }));
      return parts;
    },
    flyer(c, f) { // Skimmer: a manta with beating wings and twin engines
      const w = [12, 10, 7, 10][f], parts = [
        P(S.poly([[13, 0], [-2, -w - 3], [-9, -w], [-5, 0], [-9, w], [-2, w + 3]], 4, 4), 0, ramp(c, 0.6), { d: (x, y) => Math.abs(y) < 0.7 ? -1 : 0 }),
        P(S.ell(1, 0, 9, 4, 7), 3, ramp(mix(c, '#2a0616', 0.3), 0.7), { e: (x, y) => Math.hypot(x - 6, y) < 1.6 ? '#fff0f4' : null }),
      ];
      for (const s of [-1, 1]) parts.push(P(S.ell(-8, s * 3, 2.5, 1.6, 3), 2, ramp('#ffb03a'), { e: () => f % 2 ? '#ffe14d' : '#ffb03a' }));
      return parts;
    },
    splitter(c, f) { // four pods bound to a pulsing seed; it splits along the seams
      const parts = [], p = f % 2 ? 0.6 : 0;
      for (const [x, y] of [[-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5]]) parts.push(P(S.dome(x * (1 + p * 0.06), y * (1 + p * 0.06), 6.5, 7), 0, ramp(c, 0.65), { d: (xx, yy) => (Math.hypot(xx - x, yy - y) < 2.4 ? 0.8 : 0) }));
      parts.push(P(S.dome(0, 0, 3.2, 9), 0, ramp('#fff2e0', 1), { e: () => (f % 2 ? '#fff2e0' : '#ffd09a') }));
      return parts;
    },
    phantom(c, f) { // a wisp with trailing tendrils
      const parts = [P(S.dome(3, 0, 8.5, 8), 0, ramp(c, 0.95), { e: (x, y) => (Math.hypot(x - 6.5, y + 3) < 1.6 || Math.hypot(x - 6.5, y - 3) < 1.6) ? '#1a1440' : null })];
      for (const k of [-1, 0, 1]) { const ph = f * 1.57 + k; for (let i = 0; i < 4; i++) { const x = -4 - i * 3.2, y = k * 4 + Math.sin(ph + i * 0.9) * 1.6; parts.push(P(S.dome(x, y, 3 - i * 0.55, 4 - i * 0.6), 0, ramp(c, 0.8))); } }
      return parts;
    },
    medic(c, f) { // Mender: a jelly with a healing cross, tentacles trailing
      const parts = [P(S.dome(2, 0, 9, 9), 3, ramp(c, 0.7), { e: (x, y) => ((Math.abs(x - 2) < 1.6 && Math.abs(y) < 5.5) || (Math.abs(y) < 1.6 && Math.abs(x - 2) < 5.5)) ? (f % 2 ? '#7dffb0' : '#ffffff') : null })];
      for (const k of [-2, -1, 0, 1, 2]) for (let i = 0; i < 3; i++) { const x = -7 - i * 3, y = k * 2.6 + Math.sin(f * 1.57 + i + k) * 1.2; parts.push(P(S.dome(x, y, 1.6, 2), 0, ramp(mix(c, '#ffffff', 0.2)))); }
      return parts;
    },
    shielder(c, f) { // Aegis: a crab carrying a hex shield in front
      const parts = [];
      for (const s of [-1, 1]) for (const k of [-1, 0, 1]) { const x = k * 5 - 3 + (f % 2 ? s : -s) * k, y = s * 11; parts.push(P(S.box(x - 1.1, Math.min(y, s * 5), x + 1.1, Math.max(y, s * 5), 2, 1), 0, ramp('#0a1430'))); }
      parts.push(P(S.ell(-3, 0, 8, 7, 7), 2, ramp(mix(c, '#203060', 0.4), 0.6)));
      parts.push(P(S.poly([[6, -12], [11, -6], [11, 6], [6, 12], [3, 6], [3, -6]], 6, 2.5), 5, ramp(c, 0.85), { d: (x, y) => (Math.abs(y) < 0.7 || Math.abs(Math.abs(y) - 6) < 0.6 ? -1 : 0), e: (x, y) => (x > 9.2 && Math.abs(y) < 2 && f % 2) ? '#ffffff' : null }));
      return parts;
    },
    voidling(c, f) { // a void bat
      const w = [9, 6, 3, 6][f];
      return [P(S.poly([[7, 0], [-1, -w - 2], [-4, -2], [-7, 0], [-4, 2], [-1, w + 2]], 3, 3), 0, ramp(c, 0.8)),
        P(S.gem(1, 0, 4, 3, 6), 2, ramp('#2a1050', 0.8), { e: (x, y) => Math.hypot(x - 2, y) < 1.1 ? '#ffffff' : null })];
    },
  };
  const ESZ = { drone: 42, swarmer: 24, tank: 46, flyer: 40, splitter: 34, phantom: 40, medic: 38, shielder: 40, voidling: 30 };
  const EA = 16;
  function enemy(type, ang, fr) {
    if (!ENEMY[type]) return null;
    const ai = ((Math.round(ang / (Math.PI * 2) * EA) % EA) + EA) % EA, f = fr & 3, sz = ESZ[type];
    const mk = (a2, f2) => () => raster(ENEMY[type](ENEMY_COL[type], f2), sz, sz, a2 / EA * Math.PI * 2);
    return ART.getB(`en:${type}:${ai}:${f}`, mk(ai, f), () => { for (let d = 0; d <= EA / 2; d++) for (const a2 of [(ai + d) % EA, (ai - d + EA) % EA]) for (const f2 of [f, 0, 1, 2, 3]) { const c = ART.has(`en:${type}:${a2}:${f2}`); if (c) return c; } return null; });
  }
  // ---------- bosses: 72 world units (144 px), two-frame idle animation, drawn facing right and flipped by heading ----------
  const nz = (x, y) => Math.sin(x * 0.71 + Math.sin(y * 0.53) * 2.1) * Math.cos(y * 0.67 - x * 0.19) ; // soft organic texture
  const eye = (cx, cy, r, iris, pupil, look) => [P(S.dome(cx, cy, r, r * 0.8), 40, ramp('#f4f0ff', 1), { e: (x, y) => { const q = Math.hypot(x - cx - (look || 0), y - cy); return q < r * 0.5 ? (q < r * 0.26 ? pupil : iris) : (Math.hypot(x - cx + r * 0.35, y - cy + r * 0.35) < r * 0.22 ? '#ffffff' : null); } })];
  const BOSS_ART = {
    behemoth(f) {
      const c = '#ff3355', parts = [];
      for (const s of [-1, 1]) parts.push(P(S.rbox(s * 54 - 12, -50, s * 54 + 12, 58, 6, 16, 4), 0, ramp('#2a0e18', 0.4), { d: (x, y) => ((Math.floor((y + 80 + f * 3) / 6)) % 2 ? -1.4 : 0.6) }));
      parts.push(P(S.rbox(-44, -46, 44, 60, 14, 26, 8), 6, ramp(c, 0.55), { d: (x, y) => (Math.abs(((y + 60) % 19) - 9.5) < 1 ? -2 : 0) + nz(x, y) * 0.35 }));
      for (const s of [-1, 1]) parts.push(P(S.poly([[s * 16, -38], [s * 34, -70], [s * 28, -36]], 18, 4), 18, ramp('#e8d8c0', 0.8)));
      parts.push(P(S.rbox(-24, -44, 24, -14, 8, 10, 4), 28, ramp(mix(c, '#2a0a12', 0.35), 0.6)));
      for (const s of [-1, 1]) parts.push(P(S.dome(s * 11, -30, 5.5, 4), 38, ramp('#ffe14d', 1), { e: (x, y) => f && Math.hypot(x - s * 11 + 1.5, y + 31.5) < 1.6 ? '#ffffff' : '#ffe14d' }));
      for (let k = 0; k < 4; k++) parts.push(P(S.poly([[-6, -2 + k * 15], [0, -12 + k * 15], [6, -2 + k * 15], [0, 2 + k * 15]], 10, 3), 30, ramp('#7a1428', 0.6)));
      return parts;
    },
    queen(f) {
      const c = '#ff3355', w = f ? 0.82 : 1, parts = [];
      for (const s of [-1, 1]) for (const k of [0, 1]) parts.push(P(S.ell(s * (34 + k * 6) * w, -14 + k * 24, 30 * w, 14, 4), 4, ramp('#ffd6e8', 0.9), { d: (x, y) => (Math.abs(((x * s + 100) % 9) - 4.5) < 0.6 ? -1 : 0), e: (x, y, t) => t >= 4 ? '#fff0f6' : null }));
      parts.push(P(S.ell(0, 26, 20, 40, 24), 8, ramp(c, 0.5), { d: (x, y) => (Math.abs(((y + 100) % 13) - 6.5) < 2.4 ? -1.6 : 0) }));
      parts.push(P(S.dome(0, -16, 17, 20), 14, ramp(mix(c, '#2a0616', 0.35), 0.6)));
      parts.push(P(S.dome(0, -40, 12, 14), 18, ramp(c, 0.6), { e: (x, y) => (Math.hypot(x - 5, y + 42) < 2.6 || Math.hypot(x + 5, y + 42) < 2.6) ? '#ffe14d' : null }));
      for (let k = -2; k <= 2; k++) parts.push(P(S.poly([[k * 6 - 3, -50], [k * 6, -64 + Math.abs(k) * 4], [k * 6 + 3, -50]], 8, 2), 26, ramp('#ffe14d', 1)));
      return parts;
    },
    wraith(f) {
      const c = '#d6ceff', parts = [P(S.dome(0, -12, 40, 30), 4, ramp(c, 0.95), { d: (x, y) => nz(x * 0.6, y * 0.6) * 0.5 })];
      parts.push(P((x, y) => { if (Math.abs(x) > 38 || y < -12 || y > 50) return -1; const tat = 40 + Math.sin(x * 0.32 + f * 1.7) * 6 + (Math.floor((x + 40) / 9) % 2 ? 6 : -2); return y > tat ? -1 : Math.max(0.5, 18 * (1 - Math.abs(x) / 40)); }, 2, ramp(c, 0.8)));
      parts.push(P(S.ell(0, -8, 26, 16, 6), 34, ramp('#1a1440', 0.3), { e: (x, y) => { for (const s of [-1, 1]) { const q = Math.hypot(x - s * 11, y + 7); if (q < 5) return q < 2 ? '#ffffff' : '#ff4d6a'; } return null; } }));
      return parts;
    },
    overmind(f) {
      const c = '#ff3355', parts = [];
      for (let k = 0; k < 8; k++) { const an = k / 8 * 6.283 + (f ? 0.12 : 0); for (let i = 0; i < 5; i++) { const r = 50 + i * 4.5; parts.push(P(S.dome(Math.cos(an + i * 0.18) * r, Math.sin(an + i * 0.18) * r, 6 - i, 7 - i), 0, ramp(mix(c, '#5a1438', 0.5), 0.6))); } }
      parts.push(P(S.dome(0, 0, 54, 46), 4, ramp(c, 0.55), { d: (x, y) => (Math.sin(Math.hypot(x, y) * 0.5 + Math.atan2(y, x) * 3) > 0.75 ? -1.6 : 0) + nz(x, y) * 0.4 }));
      parts.push(P(S.dome(0, 0, 18, 16), 40, ramp('#2a0010', 0.4)));
      parts.push(P(S.dome(f ? 2 : -1, 0, 12, 12), 46, ramp('#ffe14d', 1), { e: (x, y) => Math.hypot(x - (f ? 2 : -1), y) < 4 ? '#1a0806' : Math.hypot(x + 4, y + 5) < 2.5 ? '#ffffff' : null }));
      return parts;
    },
    titan(f) {
      const c = '#ff3355', parts = [P(S.rbox(-60, -60, 60, 60, 10, 22, 6), 0, ramp('#4a1626', 0.5), { d: (x, y) => (Math.abs(x) < 1 || Math.abs(y) < 1 ? -1.5 : 0) + nz(x, y) * 0.3 })];
      parts.push(P(S.rbox(-50, -50, 50, 50, 8, 10, 5), 18, ramp(c, 0.5)));
      for (const [x, y] of [[-40, -40], [40, -40], [-40, 40], [40, 40]]) parts.push(P(S.dome(x, y, 6, 6), 28, ramp('#c8ccd8', 0.9)));
      parts.push(P(S.rbox(-24, -24, 24, 24, 4, 8, 3), 26, ramp('#2a0a12')));
      parts.push(P(S.dome(0, 0, 18, 10), 30, ramp('#ffe14d', 1), { e: (x, y) => Math.hypot(x, y) < (f ? 9 : 7) ? '#fff6c0' : null }));
      return parts;
    },
    cat(f, v) { // Mr. Whiskers. v = 1: asleep
      const c = '#ff9a3c', C = ramp(c, 0.6), parts = [];
      parts.push(P((x, y) => { const tx = 46 + Math.sin(y * 0.12 + f * 1.4) * 7; return y < 6 || y > 64 || Math.abs(x - tx) > 6 ? -1 : 6 * Math.sqrt(1 - ((x - tx) / 6) ** 2); }, 0, C, { d: (x, y) => (Math.floor(y / 6) % 2 ? -1 : 0) }));
      parts.push(P(S.dome(0, 30, 40, 26), 2, C, { d: (x, y) => (Math.abs(((x + 60) % 14) - 7) < 1.6 && Math.abs(x) > 18 ? -1.2 : 0) }));
      parts.push(P(S.ell(0, 40, 20, 18, 8), 26, ramp('#ffd29a', 0.8)));
      for (const s of [-1, 1]) parts.push(P(S.dome(s * 20, 62, 11, 9), 10, ramp('#ffd29a', 0.8)));
      parts.push(P(S.dome(0, -16, 36, 30), 20, C, { d: (x, y) => (Math.abs(x) < 1.6 && y < -26 ? -1 : 0) + (Math.abs(Math.abs(x) - 9) < 1.4 && y < -30 ? -1 : 0) }));
      for (const s of [-1, 1]) { parts.push(P(S.poly([[s * 12, -42], [s * 32, -64], [s * 34, -30]], 14, 4), 26, C)); parts.push(P(S.poly([[s * 17, -42], [s * 30, -57], [s * 31, -36]], 4, 2), 36, ramp('#ff8fb0', 0.8))); }
      for (const s of [-1, 1]) {
        if (v) parts.push(P(S.box(s * 15 - 8, -20, s * 15 + 8, -16, 2, 1), 50, ramp('#3a1606')));
        else parts.push(...eye(s * 15, -18, 9, '#8dff4a', '#0a0a0a', 0).map(q => Object.assign(q, { f: S.ell(s * 15, -18, 8, 9, 7) })));
      }
      parts.push(P(S.poly([[-5, -4], [5, -4], [0, 1]], 4, 1), 52, ramp('#ff6f9a', 0.9)));
      return parts;
    },
    gloop(f) {
      const c = '#5cff7a', sq = f ? 1.05 : 0.96, parts = [];
      parts.push(P((x, y) => { if (y > 64) return -1; const ry = 66 * sq, rx = 62 / Math.sqrt(sq), q = (x / rx) ** 2 + ((y - 64) / ry) ** 2; return q > 1 ? -1 : 40 * Math.sqrt(1 - q) * Math.min(1, (64 - y) / 10 + 0.3); }, 0, ramp(c, 0.85), { d: (x, y) => nz(x, y) * 0.5 + (y > 56 ? -1 : 0), e: (x, y) => (Math.hypot(x + 30, y + 28) < 5 || Math.hypot(x + 38, y + 12) < 3) ? '#d8ffe0' : null }));
      for (const [x, l] of [[-34, 10], [-12, 14], [20, 7], [40, 12]]) parts.push(P(S.ell(x, 66 + l / 2, 4, l / 2 + 1, 4), 2, ramp(c, 0.7)));
      parts.push(...eye(-16, 4, 15, '#0a0a0a', '#0a0a0a', 3).map(q => Object.assign(q, { e: (x, y) => Math.hypot(x + 13 - (f ? 1 : 0), y - 8) < 5 ? '#0a0a0a' : Math.hypot(x + 20, y) < 3 ? '#ffffff' : null })));
      parts.push(...eye(22, -2, 18, '#0a0a0a', '#0a0a0a', -4).map(q => Object.assign(q, { e: (x, y) => Math.hypot(x - 17 + (f ? 1 : 0), y - 4) < 7 ? '#0a0a0a' : Math.hypot(x - 15, y + 8) < 3.5 ? '#ffffff' : null })));
      parts.push(P((x, y) => Math.abs(x) < 24 && Math.abs(y - 36 - Math.sin(x * 0.4) * 3) < 2 ? 2 : -1, 40, ramp('#0c3a18')));
      return parts;
    },
    whale(f) {
      const c = '#4f8dff', parts = [];
      parts.push(P(S.poly([[-48, 0], [-66, -24 + (f ? 4 : 0)], [-60, 0], [-66, 24 - (f ? 4 : 0)]], 10, 5), 0, ramp(c, 0.6)));
      parts.push(P(S.ell(6, 2, 60, 34, 34), 4, ramp(c, 0.6), { d: (x, y) => (y > 14 && Math.abs(((x + 100) % 9) - 4.5) < 1 ? -1.4 : 0), e: (x, y, t) => y > 12 && t >= 3 ? '#cfe2ff' : null }));
      parts.push(P(S.ell(-6, 26, 16, 7, 8), 30, ramp('#2c5bc4', 0.5)));
      parts.push(...eye(40, -6, 5, '#0a0a0a', '#0a0a0a', 1));
      if (f) for (const [x, y, r] of [[18, -46, 4], [12, -56, 3], [24, -56, 3], [18, -40, 3]]) parts.push(P(S.dome(x, y, r, r), 6, ramp('#9fe7ff', 1)));
      return parts;
    },
    duck(f) {
      const c = '#ffd83a', C = ramp(c, 0.8), b = f ? -3 : 0, parts = [];
      parts.push(P(S.ell(-6, 26 + b, 52, 30, 30), 0, C, { d: (x, y) => (y > 46 ? -1 : 0) }));
      parts.push(P(S.poly([[-50, 4 + b], [-74, -14 + b], [-68, 10 + b], [-46, 22 + b]], 14, 5), 4, C));
      parts.push(P(S.ell(-12, 20 + b, 22, 12, 8), 30, C, { d: (x, y) => (Math.abs(((x + 60) % 8) - 4) < 1 ? -1 : 0) }));
      parts.push(P(S.dome(26, -24 + b, 28, 28), 14, C));
      parts.push(P(S.rbox(46, -26 + b, 72, -10 + b, 6, 8, 4), 34, ramp('#ff8a1f', 0.7), { d: (x, y) => (Math.abs(y + 18 - b) < 1 ? -2 : 0) }));
      parts.push(...eye(34, -34 + b, 6, '#0a0a0a', '#0a0a0a', 0).map(q => Object.assign(q, { z: 44 })));
      return parts;
    },
    fsm(f) {
      const n = '#f2d27a', parts = [];
      for (let k = 0; k < 11; k++) { const x0 = -50 + k * 10; parts.push(P((x, y) => { if (y < 0 || y > 66 - (k % 3) * 8) return -1; const cx = x0 + Math.sin(y * 0.1 + k * 1.7 + f * 0.8) * 7; const d = Math.abs(x - cx); return d > 2.6 ? -1 : 4 + Math.sqrt(2.6 * 2.6 - d * d); }, k % 2 ? 2 : 6, ramp(n, 0.8))); }
      parts.push(P(S.ell(0, 2, 56, 26, 22), 6, ramp(n, 0.8), { d: (x, y) => (Math.sin(x * 0.9 + y * 0.4) + Math.sin(x * 0.3 - y * 1.1) > 1 ? -1.5 : 0) }));
      for (const s of [-1, 1]) parts.push(P(S.dome(s * 26, -6, 15, 16), 22, ramp('#8a3a1a', 0.6), { d: (x, y) => nz(x * 1.6, y * 1.6) * 0.8 }));
      for (const s of [-1, 1]) { const ex = s * (46 + (f ? 2 : 0)); parts.push(P((x, y) => { if (y > -14 || y < -54) return -1; const t = (y + 54) / 40, cx = s * 30 + (ex - s * 30) * (1 - t); return Math.abs(x - cx) > 2.4 ? -1 : 4; }, 10, ramp(n, 0.8))); parts.push(...eye(ex, -58, 9, '#0a0a0a', '#0a0a0a', -s * 2)); }
      return parts;
    },
    worm(f) {
      const c = '#8a3ad6', parts = [];
      for (const s of [-1, 1]) for (let k = 0; k < 6; k++) parts.push(P(S.box(s * 48 - 10, -6 + k * 9 + (f && k % 2 ? 2 : 0), s * 48 + 10, -1 + k * 9 + (f && k % 2 ? 2 : 0), 6, 2), 0, ramp('#4a1a7a', 0.6)));
      parts.push(P(S.dome(0, 6, 50, 34), 4, ramp(c, 0.6), { d: (x, y) => (Math.abs(((y + 100) % 16) - 8) < 1.2 ? -2 : 0) + nz(x, y) * 0.3 }));
      parts.push(P(S.ell(0, -32, 34, 12, 12), 26, ramp('#c48cff', 0.8)));
      for (const s of [-1, 1]) parts.push(P(S.dome(s * 21, -10, 11, 8), 34, ramp('#5cf2ff', 1), { e: (x, y) => Math.hypot(x - s * 21 + 3, y + 13) < 3 ? '#ffffff' : null }));
      for (const s of [-1, 1]) parts.push(P(S.poly([[s * 10, 30], [s * (24 + (f ? 4 : 0)), 52], [s * 8, 44]], 10, 3), 30, ramp('#e8d8ff', 0.9)));
      parts.push(P(S.ell(0, 36, 14, 8, 4), 30, ramp('#ff4d6a', 0.8)));
      return parts;
    },
    auditor(f) {
      const suit = '#4a5266', parts = [];
      parts.push(P(S.rbox(-32, 8, 32, 64, 10, 24, 6), 4, ramp(suit, 0.6), { d: (x, y) => (Math.abs(Math.abs(x) - 14) < 1 && y < 40 ? -1.5 : 0) }));
      parts.push(P(S.poly([[-12, 8], [12, 8], [0, 40]], 4, 2), 28, ramp('#f0f0f0', 1)));
      parts.push(P(S.poly([[-3, 10], [3, 10], [4, 34], [0, 40], [-4, 34]], 6, 2), 31, ramp('#d8281a', 0.7)));
      parts.push(P(S.dome(0, -18, 28, 26), 16, ramp('#e8c2a0', 0.8)));
      parts.push(P(S.ell(-4, -40, 26, 9, 8), 36, ramp('#6a5a4a', 0.5), { d: (x, y) => (Math.abs(((x + 60) % 6) - 3) < 1 ? -1 : 0) }));
      parts.push(P(S.box(-20, -22, -6, -16, 2, 1), 40, ramp('#2a1408')));
      parts.push(P(S.ring(14, -18, 6, 9, 0), 40, ramp('#ffd83a', 1)));
      parts.push(P(S.dome(14, -18, 6, 3), 38, ramp('#cfefff', 1)));
      parts.push(P(S.box(-10, -2, 10, 1, 2, 1), 40, ramp('#8a4a3a')));
      parts.push(P(S.rbox(36, 22 + (f ? 2 : 0), 66, 52 + (f ? 2 : 0), 4, 14, 3), 6, ramp('#7a4a20', 0.6), { e: (x, y) => Math.hypot(x - 51, y - 37 - (f ? 2 : 0)) < 3 ? '#ffd83a' : null }));
      parts.push(P(S.rbox(-68, 10, -40, 50, 2, 10, 2), 6, ramp('#f0f0f0', 1), { d: (x, y) => (Math.abs(((y + 60) % 7) - 3.5) < 0.9 && Math.abs(x + 54) < 9 ? -3 : 0), e: (x, y) => x > -50 && y > 40 ? '#d8281a' : null }));
      return parts;
    },
    snail(f) {
      const body = '#9ad86a', parts = [];
      parts.push(P(S.rbox(-60, 36, 64 + (f ? 4 : 0), 58, 10, 12, 6), 0, ramp(body, 0.7), { d: (x, y) => (Math.abs(((x + 100) % 15) - 7.5) < 1 && y > 50 ? -1 : 0) }));
      for (const s of [0, 1]) { const x0 = 40 + s * 14; parts.push(P((x, y) => { if (y < -20 || y > 38) return -1; const cx = x0 + (y - 38) * -0.15; return Math.abs(x - cx) > 3 ? -1 : 5; }, 8, ramp(body, 0.7))); parts.push(...eye(x0 + 9, -24, 7, '#0a0a0a', '#0a0a0a', 2)); }
      parts.push(P(S.dome(-6, 4, 46, 44), 10, ramp('#5a2a8a', 0.6), { d: (x, y) => { const r = Math.hypot(x + 6, y - 4), a = Math.atan2(y - 4, x + 6); return Math.sin(r * 0.42 - a * 1.0 + (f ? 0.6 : 0)) > 0.3 ? 1.6 : 0; }, e: (x, y) => Math.hypot(x + 6, y - 4) < 4 ? '#ffd6ff' : null }));
      return parts;
    },
  };
  const BOSS_FR = { cat: 2 };
  function boss(id, fr, v) {
    if (!BOSS_ART[id]) return null;
    const f = fr & 1, vv = v ? 1 : 0;
    return get(`bs:${id}:${f}:${vv}`, () => raster(BOSS_ART[id](f, vv), 148, 148, 0));
  }
  function wormSeg() { return get('bs:wseg', () => raster([P(S.dome(0, 0, 26, 20), 0, ramp('#7a2ec4', 0.6), { d: (x, y) => (Math.abs(x) < 1.4 ? -1.5 : 0) }), P(S.ell(0, -8, 18, 8, 6), 14, ramp('#9a5ae0', 0.7))].concat([-1, 1].map(s => P(S.box(s * 28 - 3, -4, s * 28 + 3, 14, 4, 1), 0, ramp('#e8d8ff', 0.8)))), 66, 66, 0)); }
  function meat() { return get('bs:meat', () => raster([P(S.dome(0, 0, 11, 10), 0, ramp('#8a3a1a', 0.6), { d: (x, y) => nz(x * 2, y * 2) * 0.9 }), P(S.ell(2, -6, 6, 3, 3), 10, ramp('#d8281a', 0.7))], 28, 28, 0)); }

  const CORE_SC = 1.4; // v4.7: the base reads as the heart of the map, 40% larger
  // ---------- the core: a reactor drum with eight fuel cells around a living green heart ----------
  function core(spin, hurt) {
    const ai = idxOf(spin), h = hurt ? 1 : 0;
    return get(`core:${ai}:${h}`, () => {
      const G0 = '#59f0b4', parts = [P(S.puck(0, 0, 33, 8, 4), 0, ramp('#123a30', 0.5), { d: (x, y) => { const r = Math.hypot(x, y); return Math.abs(r - 29) < 0.8 ? -1.5 : 0; }, e: (x, y) => { const r = Math.hypot(x, y), a = Math.atan2(y, x); return Math.abs(r - 31) < 0.9 && (Math.floor((a + 3.1416) * 4) % 2) ? (h ? '#ff4d6a' : G0) : null; } })];
      for (let k = 0; k < 8; k++) { const an = k / 8 * 6.283, cx = Math.cos(an) * 22, cy = Math.sin(an) * 22;
        parts.push(P(S.rbox(cx - 4, cy - 4, cx + 4, cy + 4, 2, 5, 2), 8, ramp('#1f6b55', 0.6), { e: (x, y) => Math.hypot(x - cx, y - cy) < 2.2 ? (k % 2 ? '#b8ffe6' : G0) : null })); }
      parts.push(P(S.ring(0, 0, 13, 17, 0), 9, ramp('#2a8a70', 0.6)));
      parts.push(P(S.dome(0, 0, 13, 13), 8, ramp(h ? '#ff6f8a' : G0, 1), { e: (x, y, t) => t >= 4 ? (h ? '#ffd0d8' : '#e6fff6') : null }));
      return raster(parts, 72, 72, angOf(ai), { sc: CORE_SC });
    });
  }
  function coreGun(el, ang) {
    const ai = idxOf(ang);
    return get(`cgun:${el}:${ai}`, () => { const c = EL[el].col; return raster([P(S.tube(10, 32, -3.5, 2.4, 0), 18, GUNM, { d: stripes(5, 1) }), P(S.tube(10, 32, 3.5, 2.4, 0), 18, GUNM, { d: stripes(5, 1) }),
      P(S.box(28, -6.5, 33, 6.5, 4, 1.5), 18, ramp(c), { e: (x) => x > 31.5 ? mix(c, '#ffffff', 0.5) : null }), P(S.box(6, -7, 14, 7, 5, 2), 16, HULL)], 76, 76, angOf(ai), { sc: CORE_SC }); });
  }
  function pirate(gold) {
    return get('pship:' + (gold ? 1 : 0), () => {
      const trim = gold ? '#ffd84a' : '#9a7a4a', hull = gold ? '#7a4418' : '#5a3818';
      return raster([
        P(S.poly([[-22, 0], [-18, -9], [20, -7], [26, 0], [20, 7], [-18, 9]], 9, 4), 0, ramp(hull, 0.5), { d: (x, y) => (Math.abs(Math.abs(y) - 4) < 0.6 ? -1 : 0), e: (x, y) => Math.abs(y) > 7 && x > -16 && x < 18 ? trim : null }),
        P(S.box(-26, -3, -21, 3, 3, 1), 0, ramp('#6ae2ff', 1), { e: () => '#bff4ff' }),
        P(S.puck(2, 0, 2, 26, 1), 0, ramp('#2a1a0a')),
        P(S.box(-12, -16, 10, 16, 3, 1.5), 22, ramp(gold ? '#3a1a50' : '#1a1420', 0.4), { e: (x, y) => { const sx = x + 1, sy = y; return (Math.hypot(sx, sy + 2) < 5.5 && !(Math.hypot(sx - 2, sy + 3) < 1.6 || Math.hypot(sx + 2.5, sy + 3) < 1.6)) || (Math.abs(sx) < 3.5 && Math.abs(sy - 5) < 1.1) ? '#e8e0d0' : null; } }),
        P(S.box(9, -3, 16, 3, 2, 1), 30, ramp('#d8281a', 0.7)),
      ], 60, 44, 0);
    });
  }

  // ---------- projectiles ----------
  function missile(el, ang) {
    const ai = ((Math.round(ang / (Math.PI * 2) * 16) % 16) + 16) % 16;
    return get(`pm:${el}:${ai}`, () => { const c = EL[el].col; return raster([P(S.tube(-6, 5, 0, 2.2, 0), 2, ramp('#d8d0c8', 0.8)), P(S.ell(5, 0, 3, 2.2, 2), 2, ramp(c, 0.9)),
      P(S.poly([[-6, -1], [-9, -4.5], [-4, -1]], 2, 1), 0, ramp('#8a8296')), P(S.poly([[-6, 1], [-9, 4.5], [-4, 1]], 2, 1), 0, ramp('#8a8296'))], 22, 22, ai / 16 * Math.PI * 2); });
  }
  function shell(el) { return get('psh:' + el, () => raster([P(S.dome(0, 0, 4.5, 4), 0, ramp('#4a4836', 0.6), { e: (x, y) => Math.abs(x) < 1 || Math.abs(y) < 1 ? EL[el].col : null })], 12, 12, 0)); }

  function warmEnemies() { for (const id of Object.keys(BOSS_ART)) for (const f of [0, 1]) ART.warm(`bs:${id}:${f}:0`, () => raster(BOSS_ART[id](f, 0), 148, 148, 0)); ART.warm('bs:cat:0:1', () => raster(BOSS_ART.cat(0, 1), 148, 148, 0)); ART.warm('bs:cat:1:1', () => raster(BOSS_ART.cat(1, 1), 148, 148, 0));
    for (const ty of Object.keys(ENEMY)) for (let f = 0; f < 4; f++) for (let i = 0; i < EA; i++) ART.warm(`en:${ty}:${i}:${f}`, () => raster(ENEMY[ty](ENEMY_COL[ty], f), ESZ[ty], ESZ[ty], i / EA * Math.PI * 2)); }
  function warmTower(type, el, spec) {
    if (ROT[type]) for (let i = 0; i < NA; i++) for (const rk of [0, 1]) ART.warm(`tt:${type}:${el}:${spec}:${i}:${rk}:0:${type === 'missile' ? 1 : 0}`, () => raster(TOP[type](EL[el].col, spec || 0, { rk, ph: 0, ld: type === 'missile' ? 1 : 0 }), 60, 60, angOf(i)));
  }
  return { base, top, icon, enemy, boss, wormSeg, meat, core, coreGun, pirate, missile, shell, warmTower, warmEnemies, ROT, SPIN, NA, ESZ };
})();
