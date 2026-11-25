// ---- Any drawing scale and desk size. findDesks works at 1:50 with known desk sizes (cm). A plan drawn at another
// scale (1:100, or a model fitted to the page, e.g. 1:89) is read at that scale and then enlarged to 1:50.
// The scale comes from rectangles whose sides match a desk size; desk sizes written on the plan ("130/60", "70X140") count most.
var BASE_SIZES = [[160, 70], [140, 70], [160, 80]];
var MORE_SIZES = [[130, 60], [120, 60], [140, 60], [150, 70], [150, 75], [180, 80], [180, 90], [120, 70], [140, 80], [120, 80], [200, 80], [200, 100]];
function sizeLabels(page) {
  return page.getTextContent().then(function (tc) {
    var out = [], seen = {};
    tc.items.forEach(function (it) {
      var re = /(\d{2,3})\s*[\/xX×*]\s*(\d{2,3})/g, m;
      while ((m = re.exec(it.str || ''))) {
        var a = Math.max(+m[1], +m[2]), b = Math.min(+m[1], +m[2]);
        if (a < 100 || a > 200 || b < 50 || b > 90 || a / b < 1.4 || a / b > 3.2 || seen[a + 'x' + b]) continue;
        seen[a + 'x' + b] = 1; out.push([a, b]);
      }
    });
    return out;
  }, function () { return []; });
}
function sameSize(a, b) { return a[0] === b[0] && a[1] === b[1]; }
function addSizes(list, more) { more.forEach(function (s) { if (!list.some(function (q) { return sameSize(q, s); })) list.push(s); }); return list; }
// votes for 1:N scales: pairs of parallel, equal, aligned edges whose length and gap match a desk size at that scale
function scaleVotes(S, labels) {
  var sizes = addSizes(labels.slice(), BASE_SIZES.concat(MORE_SIZES)), votes = {};
  function index(list) { var m = {}; list.forEach(function (s) { var k = Math.round(s[0]) + '|' + Math.round(s[2]); (m[k] = m[k] || []).push(s); }); return m; }
  function near(m, p, q) { var r0 = Math.round(p), r2 = Math.round(q), out = []; for (var i = -1; i <= 1; i++) for (var j = -1; j <= 1; j++) out = out.concat(m[(r0 + i) + '|' + (r2 + j)] || []); return out; }
  function run(list, perp) {
    var m = index(list), pm = index(perp);
    list.forEach(function (a) {
      var L = a[2] - a[0];
      near(m, a[0], a[2]).forEach(function (b) {
        var g = b[1] - a[1];
        if (g < 4 || Math.abs(a[0] - b[0]) > 0.6 || Math.abs(a[2] - b[2]) > 0.6) return;
        // a closed shape: a side edge joins the two edges at one end (hatching and parallel lines have none)
        if (!near(pm, a[1], b[1]).some(function (v) { return Math.abs(v[0] - a[1]) < 0.6 && Math.abs(v[2] - b[1]) < 0.6 && (Math.abs(v[1] - a[0]) < 0.6 || Math.abs(v[1] - a[2]) < 0.6); })) return;
        sizes.forEach(function (sz) {
          [[sz[0], sz[1]], [sz[1], sz[0]]].forEach(function (p) {
            if (Math.abs(L / g - p[0] / p[1]) > 0.025 * p[0] / p[1]) return;
            var n = 72 / 2.54 * p[0] / L; if (n < 20 || n > 250) return;
            var key = Math.round(n), w = labels.some(function (q) { return sameSize(q, sz); }) ? 3 : 1;
            var v = votes[key] = votes[key] || { n: 0, sizes: {} };
            v.n += w; v.sizes[sz[0] + 'x' + sz[1]] = (v.sizes[sz[0] + 'x' + sz[1]] || 0) + 1;
          });
        });
      });
    });
  }
  S.forEach(function (fr) { run(fr.H, fr.V); run(fr.V, fr.H); });
  // join neighbouring scales (89 and 90 are one scale)
  var keys = Object.keys(votes).map(Number).sort(function (a, b) { return votes[b].n - votes[a].n; }), out = [];
  keys.forEach(function (k) {
    var c = out.filter(function (o) { return Math.abs(o.n - k) / o.n < 0.025; })[0];
    if (!c) out.push(c = { n: k, votes: 0, sizes: {} });
    c.votes += votes[k].n;
    Object.keys(votes[k].sizes).forEach(function (z) { c.sizes[z] = (c.sizes[z] || 0) + votes[k].sizes[z]; });
  });
  return out.sort(function (a, b) { return b.votes - a.votes; });
}
// Wings of a building drawn at an angle, and benches turned to any angle (e.g. along a curved facade): the main
// angles of the drawing's lines, -45°..45°, besides 0. Only lines about a desk edge long count (20–110 pt), so the many
// short chords of curved walls and round columns do not hide a turned bench (set by the user 24 Nov 2026).
function tilts(A) {
  var bins = {};
  A.forEach(function (q) {
    var dx = q[2] - q[0], dy = q[3] - q[1], L = Math.sqrt(dx * dx + dy * dy);
    if (L < 20 || L > 110) return;
    var a = Math.atan2(dy, dx) * 180 / Math.PI; a = ((a % 90) + 90) % 90; if (a > 45) a -= 90;
    if (Math.abs(a) < 0.5 || Math.abs(a) > 44.5) return;
    var k = Math.round(a * 5), b = bins[k] = bins[k] || { n: 0, w: 0, s: 0 }; b.n++; b.w += L; b.s += a * L;
  });
  var out = [];
  Object.keys(bins).map(Number).sort(function (a, b) { return bins[b].n - bins[a].n; }).forEach(function (k) {
    if (bins[k].n < 8 || out.some(function (o) { return Math.abs(o.k - k) <= 2; })) return;
    var w = 0, sm = 0; for (var i = k - 1; i <= k + 1; i++) if (bins[i]) { w += bins[i].w; sm += bins[i].s; }
    out.push({ k: k, a: sm / w });
  });
  return out.slice(0, 8).map(function (o) { return o.a; });
}
// the segments turned by -deg and enlarged f times, split into horizontal and vertical ones lo–hi pt long
function frameSegs(A, deg, f, lo, hi) {
  var t = -deg * Math.PI / 180, c = Math.cos(t) * f, sn = Math.sin(t) * f, H = [], V = [];
  A.forEach(function (q) {
    var ax = c * q[0] - sn * q[1], ay = sn * q[0] + c * q[1], bx = c * q[2] - sn * q[3], by = sn * q[2] + c * q[3];
    var dx = Math.abs(bx - ax), dy = Math.abs(by - ay);
    if (dy < 0.4 && dx > lo && dx < hi) H.push([Math.min(ax, bx), (ay + by) / 2, Math.max(ax, bx)]);
    else if (dx < 0.4 && dy > lo && dy < hi) V.push([Math.min(ay, by), (ax + bx) / 2, Math.max(ay, by)]);
  });
  return { H: H, V: V };
}
// read the desks of a PDF page at any scale and angle: returns { D (desks in 1:50 points), f (page points × f = 1:50 points), n (1:n) }
function readDesks(lib, page) {
  var vp = page.getViewport({ scale: 1 });
  return Promise.all([pdfSegments(lib, page, vp, 5, 400), sizeLabels(page)]).then(function (r) {
    var A = r[0].A, labels = r[1], angles = [0].concat(tilts(A));
    var box = [Infinity, Infinity, -Infinity, -Infinity];   // everything drawn on the page, in page points
    A.forEach(function (q) { box[0] = Math.min(box[0], q[0], q[2]); box[1] = Math.min(box[1], q[1], q[3]); box[2] = Math.max(box[2], q[0], q[2]); box[3] = Math.max(box[3], q[1], q[3]); });
    var cands = [{ n: 50, sizes: addSizes(BASE_SIZES.slice(), labels) }];
    scaleVotes(angles.map(function (a) { return frameSegs(A, a, 1, 5, 400); }), labels).slice(0, 4).forEach(function (c) {
      if (c.votes < 3 || Math.abs(c.n - 50) / 50 < 0.025) return;
      var extra = Object.keys(c.sizes).filter(function (z) { return c.sizes[z] >= 3; }).map(function (z) { return z.split('x').map(Number); });
      cands.push({ n: c.n, sizes: addSizes(addSizes(BASE_SIZES.slice(), labels), extra) });
    });
    // two desks overlap: tested in the frame of each one's angle (a turned desk is kept as its own size around its centre)
    function corners(d, deg) {
      var t = deg * Math.PI / 180, co = Math.cos(t), sn = Math.sin(t), cx = (d[0] + d[2]) / 2, cy = (d[1] + d[3]) / 2, w = (d[2] - d[0]) / 2, h = (d[3] - d[1]) / 2;
      return [[-w, -h], [w, -h], [w, h], [-w, h]].map(function (p) { return [cx + co * p[0] - sn * p[1], cy + sn * p[0] + co * p[1]]; });
    }
    function ov(a, da, b, db) {
      var A = corners(a, da), B = corners(b, db), axes = [];
      [da, db].forEach(function (g) { var t = g * Math.PI / 180; axes.push([Math.cos(t), Math.sin(t)], [-Math.sin(t), Math.cos(t)]); });
      return axes.every(function (x) {
        var pa = A.map(function (p) { return p[0] * x[0] + p[1] * x[1]; }), pb = B.map(function (p) { return p[0] * x[0] + p[1] * x[1]; });
        return Math.min(Math.max.apply(null, pa), Math.max.apply(null, pb)) - Math.max(Math.min.apply(null, pa), Math.min.apply(null, pb)) > 3;
      });
    }
    var best = null;
    cands.forEach(function (c) {
      var f = c.n / 50, D = [], DA = [];
      angles.forEach(function (deg) {
        var t = deg * Math.PI / 180, co = Math.cos(t), sn = Math.sin(t);
        findDesks(frameSegs(A, deg, f, 20, 110), c.sizes).forEach(function (d) {
          if (deg) {   // back to the page's angle: same size, centre turned back
            var cx = (d[0] + d[2]) / 2, cy = (d[1] + d[3]) / 2, w = d[2] - d[0], h = d[3] - d[1], x = co * cx - sn * cy, y = sn * cx + co * cy;
            d = [x - w / 2, y - h / 2, x + w / 2, y + h / 2].map(function (v) { return Math.round(v * 10) / 10; });
          }
          if (!D.some(function (q, k) { return ov(d, deg, q, DA[k]); })) { D.push(d); DA.push(Math.round(deg * 100) / 100); }
        });
      });
      // 1:50 (tried first) stays unless another scale finds clearly more desks
      if (!best || D.length > Math.max(best.D.length * 1.25, best.D.length + 2)) best = { D: D, ang: DA, f: f, n: c.n, sizes: c.sizes, angles: angles };
    });
    if (isFinite(box[0])) best.box = box.map(function (v) { return v * best.f; });
    // then the chairs put the desks right (one desk per chair, centred on it)
    return pdfInk(lib, page).then(function (ink) { return chairDesks(best, findChairs(ink.segs)); }, function () { return best; });
  });
}
