// ---- Chairs mark desk centres (set by the user 24 Nov 2026): a top-view office chair sits centred on its desk's long
// edge, so the desk's centre lies on the line from the chair perpendicular to that edge, and the number of chairs around
// a bench is its number of desks. Chairs = small closed clusters of short strokes (curves, or curves cut into many short
// lines), roughly square, all about one size; each chair's desk is read from the lines around it: the nearest edge in
// front of the chair, the parallel edge one desk depth further, and the cross lines (desk ends) on both sides of it.
// segs: pdfInk segments (page points). Returns [{ c: [cx, cy], s: size, d: [x0, y0, x1, y1] desk in page points or null }].
function findChairs(segs) {
  var sh = [], H = [], V = [];
  segs.forEach(function (q) {
    var dx = q[2] - q[0], dy = q[3] - q[1], L = Math.sqrt(dx * dx + dy * dy);
    if (L < 0.05) return;
    if (L < 8 && !q[7]) sh.push(q);
    if (L >= 4) {
      if (Math.abs(dy) < 0.15) H.push([Math.min(q[0], q[2]), Math.max(q[0], q[2]), (q[1] + q[3]) / 2]);
      else if (Math.abs(dx) < 0.15) V.push([Math.min(q[1], q[3]), Math.max(q[1], q[3]), (q[0] + q[2]) / 2]);
    }
  });
  // short strokes joined end to end = one drawn piece
  var par = new Int32Array(sh.length), ends = new Map();
  for (var i = 0; i < sh.length; i++) par[i] = i;
  function root(i) { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; }
  function key(x, y) { return Math.round(x * 4) * 1e6 + Math.round(y * 4); }
  sh.forEach(function (q, i) {
    [key(q[0], q[1]), key(q[2], q[3])].forEach(function (k) { var j = ends.get(k); if (j === undefined) ends.set(k, i); else { var a = root(i), b = root(j); if (a !== b) par[a] = b; } });
  });
  var comp = new Map();
  sh.forEach(function (q, i) {
    var r = root(i), c = comp.get(r);
    if (!c) { c = { b: [Infinity, Infinity, -Infinity, -Infinity], n: 0, cv: 0, mx: 0, my: 0, w: 0 }; comp.set(r, c); }
    var ln = Math.sqrt((q[2] - q[0]) * (q[2] - q[0]) + (q[3] - q[1]) * (q[3] - q[1])); c.mx += (q[0] + q[2]) / 2 * ln; c.my += (q[1] + q[3]) / 2 * ln; c.w += ln;
    c.b[0] = Math.min(c.b[0], q[0], q[2]); c.b[1] = Math.min(c.b[1], q[1], q[3]); c.b[2] = Math.max(c.b[2], q[0], q[2]); c.b[3] = Math.max(c.b[3], q[1], q[3]);
    c.n++; if (Math.abs(q[2] - q[0]) > 0.05 && Math.abs(q[3] - q[1]) > 0.05) c.cv++;
  });
  // pieces whose boxes overlap = one symbol (seat, back and arms of a chair)
  var P = [], cb = {};
  comp.forEach(function (c) { if (c.b[2] - c.b[0] < 70 && c.b[3] - c.b[1] < 70) P.push(c); });
  var pp = P.map(function (_, i) { return i; });
  function pr(i) { while (pp[i] !== i) { pp[i] = pp[pp[i]]; i = pp[i]; } return i; }
  P.forEach(function (c, i) {
    var gx0 = Math.floor(c.b[0] / 20), gx1 = Math.floor(c.b[2] / 20), gy0 = Math.floor(c.b[1] / 20), gy1 = Math.floor(c.b[3] / 20);
    for (var gx = gx0; gx <= gx1; gx++) for (var gy = gy0; gy <= gy1; gy++) {
      var k = gx + '|' + gy, l = cb[k] || (cb[k] = []);
      l.forEach(function (j) { var o = P[j]; if (c.b[0] < o.b[2] + 0.3 && o.b[0] < c.b[2] + 0.3 && c.b[1] < o.b[3] + 0.3 && o.b[1] < c.b[3] + 0.3) { var a = pr(i), b = pr(j); if (a !== b) pp[a] = b; } });
      l.push(i);
    }
  });
  var G = {};
  P.forEach(function (c, i) {
    var r = pr(i), g = G[r] || (G[r] = { b: [Infinity, Infinity, -Infinity, -Infinity], n: 0, cv: 0, mx: 0, my: 0, w: 0 }); g.mx += c.mx; g.my += c.my; g.w += c.w;
    g.b = [Math.min(g.b[0], c.b[0]), Math.min(g.b[1], c.b[1]), Math.max(g.b[2], c.b[2]), Math.max(g.b[3], c.b[3])]; g.n += c.n; g.cv += c.cv;
  });
  var cand = Object.keys(G).map(function (k) { return G[k]; }).filter(function (g) {
    var w = g.b[2] - g.b[0], h = g.b[3] - g.b[1];
    return g.n >= 10 && g.cv >= 6 && w >= 5 && h >= 5 && w <= 60 && h <= 60 && Math.max(w, h) / Math.min(w, h) <= 1.6;
  });
  // lines by position, for the desk edges
  function idx(list) { var m = {}; list.forEach(function (l) { var k = Math.floor(l[2] / 4); (m[k] = m[k] || []).push(l); }); return m; }
  var mH = idx(H), mV = idx(V);
  function lines(m, a, b) { var out = []; for (var k = Math.floor(Math.min(a, b) / 4); k <= Math.floor(Math.max(a, b) / 4); k++) (m[k] || []).forEach(function (l) { if (l[2] >= Math.min(a, b) && l[2] <= Math.max(a, b)) out.push(l); }); return out; }
  // the desk in front of a chair: dir 0..3 = +x, -x, +y, -y
  function deskOf(cx, cy, s, dir) {
    var hz = dir < 2, sg = dir % 2 ? -1 : 1, u = hz ? cx : cy, v = hz ? cy : cx, mE = hz ? mV : mH, mX = hz ? mH : mV;
    var near = function (list, at) { var best = null; list.forEach(function (l) { if (!best || Math.abs(l[2] - at) < Math.abs(best[2] - at)) best = l; }); return best; };
    var e1 = near(lines(mE, u + sg * 0.12 * s, u + sg * 1.1 * s).filter(function (l) { return l[0] <= v - 0.3 * s && l[1] >= v + 0.3 * s; }), u);
    if (!e1) return null;
    var e2 = near(lines(mE, e1[2] + sg * 0.9 * s, e1[2] + sg * 2.2 * s).filter(function (l) { return l[0] <= v - 0.3 * s && l[1] >= v + 0.3 * s; }), e1[2]);
    if (!e2) return null;
    var depth = Math.abs(e2[2] - e1[2]), lo = Math.min(e1[2], e2[2]), hi = Math.max(e1[2], e2[2]);
    var cross = function (a, b) { return lines(mX, a, b).filter(function (l) { return l[0] <= lo + 0.15 * depth && l[1] >= hi - 0.15 * depth; }); };
    // the desk ends: a cross line on each side, the same distance from the chair (a line inside the desk, e.g. a drawn
    // middle line or a cable tray, is not an end when the chair says otherwise)
    var ups = cross(v - 2.2 * s, v - 0.5 * s), dns = cross(v + 0.5 * s, v + 2.2 * s), half = 0, bestD = Infinity;
    ups.forEach(function (p) { dns.forEach(function (q) {
      var a = v - p[2], b = q[2] - v, dd = Math.abs(a - b);
      if (dd <= 0.12 * (a + b) && (a + b) / depth >= 1.4 && (a + b) / depth <= 2.8 && dd + 0.02 * (a + b) < bestD) { bestD = dd + 0.02 * (a + b); half = (a + b) / 2; }
    }); });
    if (!half) return null;
    var r = [lo, v - half, hi, v + half];
    return { d: hz ? r : [r[1], r[0], r[3], r[2]], gap: Math.abs(e1[2] - u) };
  }
  function build(list) {
    return list.map(function (g) {
      // the backrest holds more ink than the front: a chair faces away from its ink's centre (a round stool faces nowhere)
      var cx = (g.b[0] + g.b[2]) / 2, cy = (g.b[1] + g.b[3]) / 2, s = Math.max(g.b[2] - g.b[0], g.b[3] - g.b[1]);
      var mx = g.mx / g.w - cx, my = g.my / g.w - cy, hz = Math.abs(mx) >= Math.abs(my), off = Math.max(Math.abs(mx), Math.abs(my));
      if (off < 0.02 * s) return null;   // a chair pulled out at an angle still faces its desk's side
      var dir = hz ? (mx < 0 ? 0 : 1) : (my < 0 ? 2 : 3), k = deskOf(cx, cy, s, dir);
      return { c: [cx, cy], s: s, f: dir, d: k ? k.d : null };
    }).filter(Boolean);
  }
  var first = build(cand), sz = first.filter(function (c) { return c.d; }).map(function (c) { return c.s; }).sort(function (a, b) { return a - b; });
  if (sz.length < 4) return [];
  // chairs are all about one size: symbols of another size (plants, lamps, letters) are left out
  var med = sz[Math.floor(sz.length / 2)];
  return first.filter(function (c) { return c.s >= 0.75 * med && c.s <= 1.35 * med; });
}
// the desks read from the lines (R from readDesks) put right by the chairs: a desk the chairs agree with stays; one they
// disagree with (its centre off the chair, a middle line taken for an edge, a strip read as a desk) gives way to the desk
// built on the chair. When most desks have chairs, a leftover box much smaller than a desk is not a desk. A plan read at
// a wrong scale (desks far from 1–2.2 m long) is set to the scale the chairs' desks give (160 cm long).
// Sets R.D, R.ang, R.f, R.n, R.box and R.chairs ([x, y] per desk in layout units, null = none found).
function chairDesks(R, C) {
  var K = 72 / 2.54 / 50, f0 = R.f, CD = [];
  function area(r) { return (r[2] - r[0]) * (r[3] - r[1]); }
  function ovl(a, b) { var w = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), h = Math.min(a[3], b[3]) - Math.max(a[1], b[1]); return w > 0 && h > 0 ? w * h : 0; }
  C.forEach(function (c) { if (c.d && !CD.some(function (o) { return ovl(o.d, c.d) > 0.5 * Math.min(area(o.d), area(c.d)); })) CD.push(c); });
  R.chairs = null;
  if (CD.length < 4) return R;
  var longs = CD.map(function (c) { return Math.max(c.d[2] - c.d[0], c.d[3] - c.d[1]); }).sort(function (a, b) { return a - b; }), medL = longs[Math.floor(longs.length / 2)];
  var areas = CD.map(function (c) { return area(c.d); }).sort(function (a, b) { return a - b; }), medA = areas[Math.floor(areas.length / 2)];
  var cm = medL * f0 / K, f = cm < 100 || cm > 220 ? 160 * K / medL : f0, plan = CD.length >= 0.3 * R.D.length;
  var used = CD.map(function () { return false; }), D = [], A = [], CH = [];
  R.D.forEach(function (d, i) {
    var o = d.map(function (v) { return v / f0; }), hit = [];
    CD.forEach(function (c, k) { if (ovl(o, c.d) > 0.2 * Math.min(area(o), area(c.d))) hit.push(k); });
    if (!hit.length) { if (!plan || area(o) >= 0.6 * medA) { D.push(o); A.push(R.ang[i] || 0); CH.push(null); } return; }
    var c = CD[hit[0]].d, mn = Math.min(c[2] - c[0], c[3] - c[1]);
    var agree = hit.length === 1 && Math.abs((o[0] + o[2]) / 2 - (c[0] + c[2]) / 2) < 0.2 * mn && Math.abs((o[1] + o[3]) / 2 - (c[1] + c[3]) / 2) < 0.2 * mn &&
      [[o[2] - o[0], c[2] - c[0]], [o[3] - o[1], c[3] - c[1]]].every(function (p) { return p[0] / p[1] > 0.8 && p[0] / p[1] < 1.25; });
    if (agree && !used[hit[0]]) { used[hit[0]] = true; D.push(o); A.push(R.ang[i] || 0); CH.push(CD[hit[0]].c); }
  });
  // desks centred on their chairs can leave a sliver between two desks of one bench (or overlap a little): they meet halfway
  CD.forEach(function (a, i) { CD.forEach(function (b, j) {
    if (j <= i || used[i] || used[j]) return;
    var p = a.d, q = b.d, t = 0.15 * Math.min(p[2] - p[0], p[3] - p[1], q[2] - q[0], q[3] - q[1]);
    [[0, 1], [1, 0]].forEach(function (ax) {
      var u = ax[0], v = ax[1];   // v: the axis along which they follow each other, u: the one they share
      if (Math.abs(p[u] - q[u]) > t || Math.abs(p[u + 2] - q[u + 2]) > t) return;
      var lo = p[v] < q[v] ? p : q, hi = lo === p ? q : p, gap = hi[v] - lo[v + 2];
      if (Math.abs(gap) < t && gap !== 0) { var m = (hi[v] + lo[v + 2]) / 2; lo[v + 2] = m; hi[v] = m; }
    });
  }); });
  CD.forEach(function (c, k) { if (!used[k]) { D.push(c.d); A.push(0); CH.push(c.c); } });
  // desks kept without a chair of their own: a chair right at one of their edges
  D.forEach(function (d, i) {
    if (CH[i] || A[i]) return;
    C.forEach(function (c) {
      if (CH[i]) return;
      var gx = Math.max(d[0] - c.c[0], 0, c.c[0] - d[2]), gy = Math.max(d[1] - c.c[1], 0, c.c[1] - d[3]);
      if ((gx > 0) !== (gy > 0) && Math.max(gx, gy) < 0.8 * c.s) CH[i] = c.c;
    });
  });
  R.D = D.map(function (d) { return d.map(function (v) { return Math.round(v * f * 10) / 10; }); });
  R.ang = A; R.chairs = CH.map(function (c) { return c ? [Math.round(c[0] * f * 10) / 10, Math.round(c[1] * f * 10) / 10] : null; });
  if (R.box) R.box = R.box.map(function (v) { return v / f0 * f; });
  R.f = f; R.n = Math.round(f * 50);
  return R;
}
