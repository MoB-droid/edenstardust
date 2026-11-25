// ---- OSH = open space hidden (rules C2 23-25, set by the user 24 Nov 2026). An open-space seat is OSH when all hold:
// (1) right behind its chair (40-200 cm) is something nobody sees through from a passage: a hatched wall (gypsum,
// cement), a column joined to a wall, or the facade (the outer edge of the drawing, glass too: nobody passes outside);
// a free-standing column does not count (people walk round it); (2) nobody sits behind it (no desk of another bench
// there); (3) its bench end, when it is at one, faces a wall or the facade (a dead-end pocket), never an aisle or a
// corridor (a glass room front, a desk, or nothing within about 5 m). A thin plain line behind the chair (no hatch) may
// be glass or opaque: those seats (with the rest of their bench row) are not decided but asked with a red flag
// "Transparent? y / n" (L.flags, q: 'transparent'); n makes them OSH. Desks at any angle are read in their own frame.
// ASK_TRANSPARENT: the "Transparent? y / n" question (C2 rule 24) is paused by the user (24 Nov 2026): a plain thin wall
// behind the seats = OS, no question flag. OSH_V 3: stored layouts are read again once, which removes their question flags.
var OSH_V = 3, OSH_REV = 0, ASK_TRANSPARENT = false;
// every line and curve of the page (curves cut into 8 chords), in page points: [ax, ay, bx, by, curve, lineWidth, coloured, filled]
// coloured = drawn in a colour (red / blue / green annotations, dimensions): left out of the reading
function pdfInk(lib, page) {
  var vp = page.getViewport({ scale: 1 });
  return page.getOperatorList().then(function (ol) {
    var O = lib.OPS, U = lib.Util, fn = ol.fnArray, ar = ol.argsArray, ctm = [1, 0, 0, 1, 0, 0], st = [], lw = 1, sc = 0, fc = 0, out = [], cur = null;
    function colour(a) {
      var r, g, b;
      if (a && typeof a[0] === 'string' && /^#/.test(a[0])) { r = parseInt(a[0].substr(1, 2), 16); g = parseInt(a[0].substr(3, 2), 16); b = parseInt(a[0].substr(5, 2), 16); }
      else if (a && a.length >= 3) { r = +a[0]; g = +a[1]; b = +a[2]; if (r <= 1 && g <= 1 && b <= 1) { r *= 255; g *= 255; b *= 255; } }
      else return 0;
      return Math.max(r, g, b) - Math.min(r, g, b) > 60 ? 1 : 0;
    }
    var PAINT = {}; ['stroke', 'closeStroke', 'fill', 'eoFill', 'fillStroke', 'eoFillStroke', 'closeFillStroke', 'closeEOFillStroke'].forEach(function (k) { if (O[k] !== undefined) PAINT[O[k]] = k; });
    for (var i = 0; i < fn.length; i++) {
      var f = fn[i], a = ar[i];
      if (f === O.save) st.push([ctm.slice(), lw, sc, fc]);
      else if (f === O.restore) { if (st.length) { var s0 = st.pop(); ctm = s0[0]; lw = s0[1]; sc = s0[2]; fc = s0[3]; } }
      else if (f === O.transform) ctm = U.transform(ctm, a);
      else if (f === O.setLineWidth) lw = a[0];
      else if (f === O.setStrokeRGBColor) sc = colour(a);
      else if (f === O.setFillRGBColor) fc = colour(a);
      else if (f === O.paintFormXObjectBegin) { st.push([ctm.slice(), lw, sc, fc]); if (a && a[0]) ctm = U.transform(ctm, a[0]); }
      else if (f === O.paintFormXObjectEnd) { if (st.length) { var s1 = st.pop(); ctm = s1[0]; lw = s1[1]; sc = s1[2]; fc = s1[3]; } }
      else if (f === O.constructPath) {
        var M = U.transform(vp.transform, ctm), ops = a[0], c = a[1], j = 0, cx = 0, cy = 0, sx = 0, sy = 0, segs = [];
        var add = function (x0, y0, x1, y1, cv) { segs.push([M[0] * x0 + M[2] * y0 + M[4], M[1] * x0 + M[3] * y0 + M[5], M[0] * x1 + M[2] * y1 + M[4], M[1] * x1 + M[3] * y1 + M[5], cv]); };
        for (var k = 0; k < ops.length; k++) {
          var o = ops[k];
          if (o === O.moveTo) { cx = sx = c[j]; cy = sy = c[j + 1]; j += 2; }
          else if (o === O.lineTo) { add(cx, cy, c[j], c[j + 1], 0); cx = c[j]; cy = c[j + 1]; j += 2; }
          else if (o === O.curveTo || o === O.curveTo2 || o === O.curveTo3) {
            var p1, p2, p3;
            if (o === O.curveTo) { p1 = [c[j], c[j + 1]]; p2 = [c[j + 2], c[j + 3]]; p3 = [c[j + 4], c[j + 5]]; j += 6; }
            else if (o === O.curveTo2) { p1 = [cx, cy]; p2 = [c[j], c[j + 1]]; p3 = [c[j + 2], c[j + 3]]; j += 4; }
            else { p1 = [c[j], c[j + 1]]; p2 = [c[j + 2], c[j + 3]]; p3 = p2; j += 4; }
            var px = cx, py = cy;
            for (var t = 1; t <= 8; t++) {
              var u = t / 8, v = 1 - u, x = v * v * v * cx + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0], y = v * v * v * cy + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1];
              add(px, py, x, y, 1); px = x; py = y;
            }
            cx = p3[0]; cy = p3[1];
          }
          else if (o === O.closePath) { add(cx, cy, sx, sy, 0); cx = sx; cy = sy; }
          else if (o === O.rectangle) { var rx = c[j], ry = c[j + 1], rw = c[j + 2], rh = c[j + 3]; add(rx, ry, rx + rw, ry, 0); add(rx + rw, ry, rx + rw, ry + rh, 0); add(rx + rw, ry + rh, rx, ry + rh, 0); add(rx, ry + rh, rx, ry, 0); cx = sx = rx; cy = sy = ry; j += 4; }
        }
        cur = segs;
      }
      else if (cur && PAINT[f]) {
        var fill = /fill/i.test(PAINT[f]) && !/Stroke/.test(PAINT[f]), col = fill ? fc : sc;
        cur.forEach(function (q) { out.push([q[0], q[1], q[2], q[3], q[4], lw, col, fill ? 1 : 0]); });
        cur = null;
      }
      else if (f === O.endPath) cur = null;
    }
    return { segs: out, w: vp.width, h: vp.height };
  });
}
// the drawing as grids of 2-unit cells (layout units): ink, the facade band (outside + 40 units), hatch (walls,
// columns), free-standing columns, long straight lines
function oshGrid(segs, f, W, H) {
  var C = 2, cols = Math.ceil(W * f / C) + 2, rows = Math.ceil(H * f / C) + 2, N = cols * rows;
  var ink = new Uint8Array(N), hat = new Uint8Array(N), lin = new Int32Array(N);
  for (var z = 0; z < N; z++) lin[z] = -1;
  var S = [];
  var seen = {};
  segs.forEach(function (q) {
    if (q[6]) return;
    var a = Math.round(q[0] * 4) + ',' + Math.round(q[1] * 4), b = Math.round(q[2] * 4) + ',' + Math.round(q[3] * 4), key = a < b ? a + ',' + b : b + ',' + a;
    if (seen[key]) return; seen[key] = 1;   // the same line drawn twice counts once
    S.push([q[0] * f, q[1] * f, q[2] * f, q[3] * f, q[4], q[5], q[7]]);
  });
  function draw(s, arr, val) {
    var dx = s[2] - s[0], dy = s[3] - s[1], L = Math.sqrt(dx * dx + dy * dy), n = Math.max(1, Math.ceil(L / (C / 2)));
    for (var k = 0; k <= n; k++) {
      var x = Math.floor((s[0] + dx * k / n) / C), y = Math.floor((s[1] + dy * k / n) / C);
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      arr[y * cols + x] = val;
    }
  }
  var PW = W * f, PH = H * f;
  // hatch = short diagonal strokes whose two ends sit on other lines (between the two lines of a wall, inside a
  // column), in a family of at least 3 parallel strokes close together
  var cand = [], isC = {};
  S.forEach(function (s, i) {
    var dx = s[2] - s[0], dy = s[3] - s[1], L = Math.sqrt(dx * dx + dy * dy);
    if (L > PW * 0.85 || L > PH * 0.85) { s.frame = 1; return; }
    if (s[4] || L < 2 || L > 120) return;
    var a = Math.atan2(dy, dx) * 180 / Math.PI; a = ((a % 180) + 180) % 180; var m = a % 90;
    if (m < 15 || m > 75) return;
    cand.push({ i: i, a: a, x: (s[0] + s[2]) / 2, y: (s[1] + s[3]) / 2, L: L }); isC[i] = 1;
  });
  var other = new Uint8Array(N);
  S.forEach(function (s, i) { if (!s.frame && !isC[i]) draw(s, other, 1); });
  function touches(x, y) {
    var cx = Math.floor(x / C), cy = Math.floor(y / C);
    for (var j = -2; j <= 2; j++) for (var i = -2; i <= 2; i++) { var xx = cx + i, yy = cy + j; if (xx >= 0 && yy >= 0 && xx < cols && yy < rows && other[yy * cols + xx]) return true; }
    return false;
  }
  var hb = {};
  cand = cand.filter(function (c) { var s = S[c.i]; return touches(s[0], s[1]) && touches(s[2], s[3]); });
  cand.forEach(function (c) { var k = Math.floor(c.x / 20) + '|' + Math.floor(c.y / 20); (hb[k] = hb[k] || []).push(c); });
  cand.forEach(function (c) {
    // parallel strokes beside it (not its own continuation): at least three different offsets, 1.5-20 units away
    // (a wall's hatch; the two or three lines of a glass wall are not enough)
    var s = S[c.i], ux = (s[2] - s[0]) / c.L, uy = (s[3] - s[1]) / c.L, offs = [], cx = Math.floor(c.x / 20), cy = Math.floor(c.y / 20);
    for (var i = -2; i <= 2; i++) for (var j = -2; j <= 2; j++) (hb[(cx + i) + '|' + (cy + j)] || []).forEach(function (o) {
      if (o === c || Math.abs(o.a - c.a) > 1.5) return;
      var dx = o.x - c.x, dy = o.y - c.y, along = dx * ux + dy * uy, off = -dx * uy + dy * ux;
      if (Math.abs(off) < 1.5 || Math.abs(off) > 20 || Math.abs(along) > c.L + o.L) return;
      if (!offs.some(function (v) { return Math.abs(v - off) < 1.5; })) offs.push(off);
    });
    if (offs.length >= 3) S[c.i].hatch = 1;
  });
  S.forEach(function (s, i) {
    if (s.frame) return;
    draw(s, ink, 1);
    if (s.hatch) draw(s, hat, 1);
    else if (!s[4]) { var dx = s[2] - s[0], dy = s[3] - s[1]; if (dx * dx + dy * dy >= 30 * 30) draw(s, lin, i); }
  });
  // a thin wall drawn as two parallel lines with one line across from corner to corner (no hatch strokes) is a wall too
  var LS = [], lb = {};
  S.forEach(function (s, i) {
    if (s.frame || s[4]) return;
    var dx = s[2] - s[0], dy = s[3] - s[1], L = Math.sqrt(dx * dx + dy * dy); if (L < 8) return;
    var o = { i: i, L: L, ux: dx / L, uy: dy / L, x: (s[0] + s[2]) / 2, y: (s[1] + s[3]) / 2 };
    LS.push(o); var k = Math.floor(o.x / 60) + '|' + Math.floor(o.y / 60); (lb[k] = lb[k] || []).push(o);
  });
  function near(o, fn) { var cx = Math.floor(o.x / 60), cy = Math.floor(o.y / 60); for (var i = -2; i <= 2; i++) for (var j = -2; j <= 2; j++) (lb[(cx + i) + '|' + (cy + j)] || []).forEach(fn); }
  function onLine(px, py, o) { var s = S[o.i], t = (px - s[0]) * o.ux + (py - s[1]) * o.uy; return t > -1.5 && t < o.L + 1.5 && Math.abs(-(px - s[0]) * o.uy + (py - s[1]) * o.ux) < 1.5; }
  LS.forEach(function (a) {
    if (a.L < 30) return;
    near(a, function (b) {
      if (b.i <= a.i || b.L < 30 || Math.abs(a.ux * b.uy - a.uy * b.ux) > 0.02) return;
      var sa = S[a.i], sb = S[b.i], off = -(sb[0] - sa[0]) * a.uy + (sb[1] - sa[1]) * a.ux;
      if (Math.abs(off) < 3 || Math.abs(off) > 16) return;
      var t0 = (sb[0] - sa[0]) * a.ux + (sb[1] - sa[1]) * a.uy, t1 = (sb[2] - sa[0]) * a.ux + (sb[3] - sa[1]) * a.uy;
      var lo = Math.max(0, Math.min(t0, t1)), hi = Math.min(a.L, Math.max(t0, t1)); if (hi - lo < 0.5 * Math.min(a.L, b.L)) return;
      // a line from one of them to the other, running along the wall (a corner-to-corner diagonal)
      var hitD = false;
      near(a, function (c) {
        if (hitD || c === a || c === b || c.L < 0.5 * (hi - lo)) return;
        var cr = Math.abs(c.ux * a.uy - c.uy * a.ux); if (cr < 0.004 || cr > 0.5) return;
        var s = S[c.i];
        if ((onLine(s[0], s[1], a) && onLine(s[2], s[3], b)) || (onLine(s[0], s[1], b) && onLine(s[2], s[3], a))) hitD = true;
      });
      if (!hitD) return;
      for (var t = lo; t <= hi; t += 1) for (var v = 0; v <= 1; v += 0.25) {
        var px = sa[0] + a.ux * t - a.uy * off * v, py = sa[1] + a.uy * t + a.ux * off * v, cx = Math.floor(px / C), cy = Math.floor(py / C);
        if (cx >= 0 && cy >= 0 && cx < cols && cy < rows) hat[cy * cols + cx] = 1;
      }
    });
  });
  // close small gaps in the drawing, then flood the outside from the edges of the sheet
  var ink2 = new Uint8Array(N);
  for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) if (ink[y * cols + x]) for (var j = -1; j <= 1; j++) for (var i = -1; i <= 1; i++) { var xx = x + i, yy = y + j; if (xx >= 0 && yy >= 0 && xx < cols && yy < rows) ink2[yy * cols + xx] = 1; }
  var out = new Uint8Array(N), q = new Int32Array(N), qh = 0, qt = 0;
  function seed(k) { if (!ink2[k] && !out[k]) { out[k] = 1; q[qt++] = k; } }
  for (x = 0; x < cols; x++) { seed(x); seed((rows - 1) * cols + x); }
  for (y = 0; y < rows; y++) { seed(y * cols); seed(y * cols + cols - 1); }
  while (qh < qt) { var k = q[qh++], kx = k % cols; if (kx > 0) seed(k - 1); if (kx < cols - 1) seed(k + 1); if (k >= cols) seed(k - cols); if (k < N - cols) seed(k + cols); }
  // the facade band: everything within 40 units of the outside (the facade's lines, mullions, sills)
  var fz = new Uint8Array(N), fq = new Int32Array(N), fh = 0, ft = 0, fd = new Uint8Array(N);
  for (var k1 = 0; k1 < N; k1++) if (out[k1]) { fz[k1] = 1; fq[ft++] = k1; }
  while (fh < ft) {
    var k4 = fq[fh++], x4 = k4 % cols, y4 = (k4 / cols) | 0; if (fd[k4] >= 20) continue;
    for (j = -1; j <= 1; j++) for (i = -1; i <= 1; i++) {
      xx = x4 + i; yy = y4 + j; if (xx < 0 || yy < 0 || xx >= cols || yy >= rows) continue;
      var k5 = yy * cols + xx; if (!fz[k5]) { fz[k5] = 1; fd[k5] = fd[k4] + 1; fq[ft++] = k5; }
    }
  }
  // hatch cells grow by 2 cells (the wall between its hatch strokes)
  var hat2 = new Uint8Array(N);
  for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) if (hat[y * cols + x]) for (j = -2; j <= 2; j++) for (i = -2; i <= 2; i++) { xx = x + i; yy = y + j; if (xx >= 0 && yy >= 0 && xx < cols && yy < rows) hat2[yy * cols + xx] = 1; }
  // hatched blocks: a small one standing alone (both sides under about 2.3 m) is a free-standing column
  var lab = new Int32Array(N), col = new Uint8Array(N), stk = [];
  for (var k0 = 0; k0 < N; k0++) {
    if (!hat2[k0] || lab[k0]) continue;
    var id = k0 + 1, mem = [k0], bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1; lab[k0] = id; stk = [k0];
    while (stk.length) {
      var kk = stk.pop(), kx = kk % cols, ky = (kk / cols) | 0;
      if (kx < bx0) bx0 = kx; if (kx > bx1) bx1 = kx; if (ky < by0) by0 = ky; if (ky > by1) by1 = ky;
      for (j = -1; j <= 1; j++) for (i = -1; i <= 1; i++) {
        xx = kx + i; yy = ky + j; if (xx < 0 || yy < 0 || xx >= cols || yy >= rows) continue;
        var nk = yy * cols + xx; if (hat2[nk] && !lab[nk]) { lab[nk] = id; stk.push(nk); mem.push(nk); }
      }
    }
    if ((bx1 - bx0 + 1) * C < 130 && (by1 - by0 + 1) * C < 130) mem.forEach(function (m) { col[m] = 1; });
  }
  return { C: C, cols: cols, rows: rows, ink: ink2, out: fz, hat: hat2, col: col, lin: lin, S: S };
}
// frame of desk i: centre, unit long axis u, unit normal n toward the chair, half length / depth
function deskFrame(d, a, chair) {
  var t = (a || 0) * Math.PI / 180, ex = [Math.cos(t), Math.sin(t)], ey = [-Math.sin(t), Math.cos(t)];
  var w = (d[2] - d[0]) / 2, h = (d[3] - d[1]) / 2, c = [(d[0] + d[2]) / 2, (d[1] + d[3]) / 2];
  var u = w >= h ? ex : ey, nn = w >= h ? ey : ex, hl = Math.max(w, h), hd = Math.min(w, h);
  if (chair && ((chair[0] - c[0]) * nn[0] + (chair[1] - c[1]) * nn[1]) < 0) nn = [-nn[0], -nn[1]];
  return { c: c, u: u, n: nn, hl: hl, hd: hd };
}
function oshFeatures(desks, ang, G, chairs) {
  ang = ang || [];
  var C = G.C, cols = G.cols, rows = G.rows, CH = Array.isArray(chairs) && chairs.length === desks.length ? chairs : chairsFor(desks, ang), F = desks.map(function (d, i) { return deskFrame(d, ang[i], CH[i]); });
  // desk mask (desk index + 1), desks a little enlarged
  var dm = new Int32Array(cols * rows);
  F.forEach(function (f, i) {
    for (var a = -f.hl - 1; a <= f.hl + 1; a += 1) for (var b = -f.hd - 1; b <= f.hd + 1; b += 1) {
      var x = Math.floor((f.c[0] + f.u[0] * a + f.n[0] * b) / C), y = Math.floor((f.c[1] + f.u[1] * a + f.n[1] * b) / C);
      if (x >= 0 && y >= 0 && x < cols && y < rows) dm[y * cols + x] = i + 1;
    }
  });
  // benches: desks touching each other
  var par = desks.map(function (_, i) { return i; });
  function root(i) { while (par[i] !== i) i = par[i] = par[par[i]]; return i; }
  F.forEach(function (a, i) { F.forEach(function (b, j) {
    if (j >= i) return;
    var dx = b.c[0] - a.c[0], dy = b.c[1] - a.c[1];
    var p1 = Math.abs(dx * a.u[0] + dy * a.u[1]), p2 = Math.abs(dx * a.n[0] + dy * a.n[1]);
    var s1 = a.hl + Math.abs(b.hl * (b.u[0] * a.u[0] + b.u[1] * a.u[1])) + Math.abs(b.hd * (b.n[0] * a.u[0] + b.n[1] * a.u[1]));
    var s2 = a.hd + Math.abs(b.hl * (b.u[0] * a.n[0] + b.u[1] * a.n[1])) + Math.abs(b.hd * (b.n[0] * a.n[0] + b.n[1] * a.n[1]));
    if (p1 < s1 + 3 && p2 < s2 + 3) par[root(i)] = root(j);
  }); });
  var bench = desks.map(function (_, i) { return root(i); }), bsize = {};
  bench.forEach(function (b) { bsize[b] = (bsize[b] || 0) + 1; });
  function cell(x, y) { var cx = Math.floor(x / C), cy = Math.floor(y / C); return cx < 0 || cy < 0 || cx >= cols || cy >= rows ? -1 : cy * cols + cx; }
  // walk from p along dir: O = opaque (hatched wall / column / outside the facade), T = a plain line parallel to `par`,
  // D = another desk, N = nothing within d1
  function cast(p, dir, d0, d1, parv, own, inkFrom, strict) {
    for (var d = d0; d <= d1; d += 1) {
      var k = cell(p[0] + dir[0] * d, p[1] + dir[1] * d);
      if (k < 0 || G.out[k]) return { k: 'O', d: d, w: 'out' };
      if (G.hat[k] && (strict || !G.col[k])) return { k: 'O', d: d, w: G.col[k] ? 'column' : 'hatch' };
      if (dm[k] && bench[dm[k] - 1] !== own) return { k: 'D', d: d, s: dm[k] };
      if (dm[k]) continue;
      var li = G.lin[k];
      if (li >= 0) {
        var s = G.S[li], sx = s[2] - s[0], sy = s[3] - s[1], sl = Math.sqrt(sx * sx + sy * sy);
        if (Math.abs((sx * parv[0] + sy * parv[1]) / sl) > 0.9) {
          for (var e = d + 1; e <= d + 40; e += 1) { var k2 = cell(p[0] + dir[0] * e, p[1] + dir[1] * e); if (k2 < 0 || G.out[k2]) return { k: 'O', d: d, w: 'facade' }; if (G.hat[k2] && !G.col[k2]) return { k: 'O', d: d, w: 'wall' }; }
          return { k: 'T', d: d };
        }
      }
      if (inkFrom !== undefined && d >= inkFrom && G.ink[k]) {
        for (var e2 = d + 1; e2 <= d + (strict ? 60 : 45); e2 += 1) { var k3 = cell(p[0] + dir[0] * e2, p[1] + dir[1] * e2); if (k3 < 0 || G.out[k3]) return { k: 'O', d: d, w: 'facade' }; if (G.hat[k3] && (strict || !G.col[k3])) return { k: 'O', d: d, w: 'wall' }; }
        if (strict) return { k: 'T', d: d, w: 'ink' };
      }
    }
    return { k: 'N', d: d1 };
  }
  return { F: F, CH: CH, bench: bench, bsize: bsize, cast: cast, dm: dm, cell: cell, setBench: function (b) { bench = b; } };
}
function oshDecide(desks, ang, G, chairs) {
  var X = oshFeatures(desks, ang, G, chairs), F = X.F, U = 72 / 2.54 / 50, BACK = 240 * U, END = 520 * U, res = {};
  // benches again with a 6-unit gap (back-to-back desks are often drawn a panel apart)
  var par = desks.map(function (_, i) { return i; });
  function root(i) { while (par[i] !== i) i = par[i] = par[par[i]]; return i; }
  F.forEach(function (a, i) { F.forEach(function (b, j) {
    if (j >= i || Math.abs((ang[i] || 0) - (ang[j] || 0)) > 1) return;
    var dx = b.c[0] - a.c[0], dy = b.c[1] - a.c[1];
    var p1 = Math.abs(dx * a.u[0] + dy * a.u[1]), p2 = Math.abs(dx * a.n[0] + dy * a.n[1]);
    var s1 = a.hl + Math.abs(b.hl * (b.u[0] * a.u[0] + b.u[1] * a.u[1])) + Math.abs(b.hd * (b.n[0] * a.u[0] + b.n[1] * a.u[1]));
    var s2 = a.hd + Math.abs(b.hl * (b.u[0] * a.n[0] + b.u[1] * a.n[1])) + Math.abs(b.hd * (b.n[0] * a.n[0] + b.n[1] * a.n[1]));
    if (p1 < s1 + 6 && p2 < s2 + 6) par[root(i)] = root(j);
  }); });
  var bench = desks.map(function (_, i) { return root(i); }), size = {};
  bench.forEach(function (b) { size[b] = (size[b] || 0) + 1; });
  X.setBench(bench);
  function hit(p, dir, d0, d1, pv, i, inkFrom, strict) { return X.cast(p, dir, d0, d1, pv, bench[i], inkFrom, strict); }
  desks.forEach(function (d, i) {
    var f = F[i]; if (size[bench[i]] < 2 || !X.CH[i]) return;
    var e = [f.c[0] + f.n[0] * f.hd, f.c[1] + f.n[1] * f.hd];
    // 1. behind the chair: opaque (wall, facade), or a plain thin line (unclear), with nobody seated behind
    var kinds = [-0.6, 0, 0.6].map(function (t) { return hit([e[0] + f.u[0] * f.hl * t, e[1] + f.u[1] * f.hl * t], f.n, 4, BACK, f.u, i, 45).k; });
    if (kinds.some(function (k) { return k === 'N' || k === 'D'; })) return;
    var thin = kinds.filter(function (k) { return k === 'T'; }).length >= 2;   // one ray through a door gap is not a glass wall
    // 2. the bench ends: an end with no desk of the bench next to it must face a wall, a column or the facade (seen along
    // either long edge), never only a passage, a glass front or another bench
    var open = [1, -1].some(function (sg) {
      var dir = [f.u[0] * sg, f.u[1] * sg], p = [f.c[0] + dir[0] * f.hl, f.c[1] + dir[1] * f.hl];
      var k = X.cell(p[0] + dir[0] * 4, p[1] + dir[1] * 4);
      if (k >= 0 && X.dm[k] && bench[X.dm[k] - 1] === bench[i]) return false;
      return [-0.5, 0.5].every(function (t) { return hit([p[0] + f.n[0] * f.hd * t, p[1] + f.n[1] * f.hd * t], dir, 8, END, f.n, i, 8, true).k !== 'O'; });
    });
    if (open) return;
    res[i] = { thin: thin, row: bench[i] + '|' + Math.round(f.n[0] * 10) + '|' + Math.round(f.n[1] * 10) };
  });
  // a row of a bench behind a partly unclear wall: the whole row gets the one question
  var rowThin = {};
  Object.keys(res).forEach(function (i) { if (res[i].thin) rowThin[res[i].row] = 1; });
  var osh = [], ask = {};
  Object.keys(res).forEach(function (i) {
    var r = res[i];
    if (rowThin[r.row]) { if (ASK_TRANSPARENT) (ask[r.row] = ask[r.row] || []).push(+i); } else osh.push(+i + 1);
  });
  var q = Object.keys(ask).map(function (k) {
    var ids = ask[k].sort(function (a, b) { return a - b; }), x = 0, y = 0;
    ids.forEach(function (i) { var f = F[i]; x += f.c[0] + f.n[0] * (f.hd + 60 * U); y += f.c[1] + f.n[1] * (f.hd + 60 * U); });
    return { seats: ids.map(function (i) { return i + 1; }), at: [Math.round(x / ids.length), Math.round(y / ids.length)] };
  });
  return { osh: osh.sort(function (a, b) { return a - b; }), ask: q };
}
// OSH seats of a layout from its PDF page: { osh: [seat numbers], ask: [{ seats, at }] } (f = layout units per page point)
function oshFromPage(lib, page, f, desks, ang, chairs) {
  return pdfInk(lib, page).then(function (r) {
    return oshDecide(desks, ang || [], oshGrid(r.segs, f || 1, r.w, r.h), chairs);
  });
}
// the questions as red flags on the plan; answers already given to the same seats are kept
function oshFlags(old, ask) {
  var keep = (Array.isArray(old) ? old : []).filter(function (f) { return f && f.q !== 'transparent'; });
  if (!ASK_TRANSPARENT) return keep;   // the question is paused: note flags only
  var prev = (Array.isArray(old) ? old : []).filter(function (f) { return f && f.q === 'transparent' && f.ans; });
  return keep.concat(ask.map(function (a) {
    var key = a.seats.join(','), was = prev.filter(function (f) { return (f.seats || []).join(',') === key; })[0];
    return { q: 'transparent', seats: a.seats, at: a.at, n: seatRange(a.seats), text: 'Transparent?', ans: was ? was.ans : null };
  }));
}
function seatRange(s) {
  var out = [], i = 0;
  while (i < s.length) { var j = i; while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++; out.push(j > i + 1 ? s[i] + '–' + s[j] : j === i + 1 ? s[i] + ', ' + s[j] : String(s[i])); i = j + 1; }
  return out.join(', ');
}
// layouts read with an older OSH rule (or before OSH existed): read their OSH desks again from the stored PDF, once
function backfillOsh(db) {
  if (!LAYOUT || !LAYOUT.asIs || (LAYOUT.oshv || 0) >= OSH_V || !LAYOUT.desks || !LAYOUT.desks.length || !db) return;
  return db.collection('layouts').get().then(function (snap) {
    var recs = snap.docs.map(function (d) { return d.data(); }).filter(function (r) { return r && r.asset && /[.]pdf$/i.test(r.name || ''); })
      .sort(function (a, b) { return String(b.at || '').localeCompare(String(a.at || '')); });
    if (!recs.length) return;
    var url = '/_blob/' + recs[0].asset; if (window.__blobUrl) url = window.__blobUrl(url);
    var lib;
    return loadPdf().then(function (l) { lib = l; return fetch(url); }).then(function (r) { if (!r.ok) throw { code: 'fetch' }; return r.arrayBuffer(); })
      .then(function (buf) { return lib.getDocument({ data: new Uint8Array(buf) }).promise; })
      .then(function (pdf) { return pdf.getPage(1); })
      .then(function (pg) { return oshFromPage(lib, pg, LAYOUT.pscale || 1, LAYOUT.desks, LAYOUT.ang, LAYOUT.chairs); })
      .then(function (res) {
        LAYOUT.osh = res.osh; LAYOUT.oshv = OSH_V; LAYOUT.flags = oshFlags(LAYOUT.flags, res.ask); OSH_REV++;
        drawFlags(LAYOUT);
        if (window.__oshReady) window.__oshReady();
        return db.doc('plan/current').update({ osh: res.osh, oshv: OSH_V, flags: LAYOUT.flags });
      });
  }).catch(function () {});
}
