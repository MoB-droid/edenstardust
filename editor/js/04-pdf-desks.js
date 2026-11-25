// ---- Automatic analysis of an uploaded PDF: read its drawing lines, find the desks, group them into teams.
var PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
function loadScript(src) { return new Promise(function (ok, bad) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { bad({ code: 'load' }); }; document.head.appendChild(s); }); }
function loadPdf() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  // the worker script first: pdf.js then runs it on this page (no separate worker needed)
  return loadScript(PDFJS + 'pdf.worker.min.js').then(function () { return loadScript(PDFJS + 'pdf.min.js'); }).then(function () {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; return window.pdfjsLib;
  });
}
// straight horizontal (H: [x0, y, x1]) and vertical (V: [y0, x, y1]) segments lo–hi pt long (default 20–110), in page points (top-left origin)
function pdfSegments(lib, page, vp, lo, hi) {
  lo = lo || 20; hi = hi || 110;
  return page.getOperatorList().then(function (ol) {
    var O = lib.OPS, U = lib.Util, fn = ol.fnArray, ar = ol.argsArray, ctm = [1, 0, 0, 1, 0, 0], st = [], H = [], V = [], A = [];
    function add(M, x0, y0, x1, y1) {
      var ax = M[0] * x0 + M[2] * y0 + M[4], ay = M[1] * x0 + M[3] * y0 + M[5], bx = M[0] * x1 + M[2] * y1 + M[4], by = M[1] * x1 + M[3] * y1 + M[5];
      var dx = Math.abs(bx - ax), dy = Math.abs(by - ay), len = Math.sqrt(dx * dx + dy * dy);
      if (len > lo && len < hi) A.push([ax, ay, bx, by]);   // every straight segment, at any angle
      if (dy < 0.3 && dx > lo && dx < hi) H.push([Math.min(ax, bx), (ay + by) / 2, Math.max(ax, bx)]);
      else if (dx < 0.3 && dy > lo && dy < hi) V.push([Math.min(ay, by), (ax + bx) / 2, Math.max(ay, by)]);
    }
    for (var i = 0; i < fn.length; i++) {
      var f = fn[i], a = ar[i];
      if (f === O.save) st.push(ctm.slice());
      else if (f === O.restore) { if (st.length) ctm = st.pop(); }
      else if (f === O.transform) ctm = U.transform(ctm, a);
      else if (f === O.paintFormXObjectBegin) { st.push(ctm.slice()); if (a && a[0]) ctm = U.transform(ctm, a[0]); }
      else if (f === O.paintFormXObjectEnd) { if (st.length) ctm = st.pop(); }
      else if (f === O.constructPath) {
        var M = U.transform(vp.transform, ctm), ops = a[0], c = a[1], j = 0, cx = 0, cy = 0, sx = 0, sy = 0;
        for (var k = 0; k < ops.length; k++) {
          var o = ops[k];
          if (o === O.moveTo) { cx = sx = c[j]; cy = sy = c[j + 1]; j += 2; }
          else if (o === O.lineTo) { add(M, cx, cy, c[j], c[j + 1]); cx = c[j]; cy = c[j + 1]; j += 2; }
          else if (o === O.curveTo) { cx = c[j + 4]; cy = c[j + 5]; j += 6; }
          else if (o === O.curveTo2 || o === O.curveTo3) { cx = c[j + 2]; cy = c[j + 3]; j += 4; }
          else if (o === O.closePath) { add(M, cx, cy, sx, sy); cx = sx; cy = sy; }
          else if (o === O.rectangle) { var x = c[j], y = c[j + 1], w = c[j + 2], h = c[j + 3]; add(M, x, y, x + w, y); add(M, x + w, y, x + w, y + h); add(M, x + w, y + h, x, y + h); add(M, x, y + h, x, y); cx = sx = x; cy = sy = y; j += 4; }
        }
      }
    }
    return { H: H, V: V, A: A };
  });
}
// Desks = two parallel, equal, aligned edges a desk-size apart (desks 160×70, 140×70, 160×80 cm at 1:50;
// square or rounded corners). Candidates that overlap each other are not desks (lounge seats, tables) and are dropped.
function findDesks(S, sizes) {
  var K = 72 / 2.54 / 50, R = [];
  function uniq(list) { var seen = {}, out = []; list.forEach(function (s) { var k = s.map(function (v) { return Math.round(v * 5); }).join(','); if (!seen[k]) { seen[k] = 1; out.push(s); } }); return out; }
  function index(list) { var m = {}; list.forEach(function (s) { var k = Math.round(s[0]) + '|' + Math.round(s[2]); (m[k] = m[k] || []).push(s); }); return m; }
  var H = uniq(S.H), V = uniq(S.V), mH = index(H), mV = index(V);
  function scan(list, m, len, gap, make) {
    list.forEach(function (a) {
      var L = a[2] - a[0];
      if (Math.abs(L - len) > 0.8 && Math.abs(L - (len - 5.7)) > 0.8) return;
      var r0 = Math.round(a[0]), r2 = Math.round(a[2]);
      for (var i = -1; i <= 1; i++) for (var j = -1; j <= 1; j++) (m[(r0 + i) + '|' + (r2 + j)] || []).forEach(function (b) {
        var g = b[1] - a[1];
        if (Math.abs(g - gap) < 1.5 && Math.abs(a[0] - b[0]) < 0.8 && Math.abs(a[2] - b[2]) < 0.8) R.push(make(a, b, (len - L) / 2));
      });
    });
  }
  (sizes || BASE_SIZES).forEach(function (sz) {
    var A = sz[0] * K, B = sz[1] * K;
    [[A, B], [B, A]].forEach(function (p) {
      scan(H, mH, p[0], p[1], function (a, b, pad) { return [a[0] - pad, a[1], a[2] + pad, b[1]]; });
      scan(V, mV, p[0], p[1], function (a, b, pad) { return [a[1], a[0] - pad, b[1], a[2] + pad]; });
    });
  });
  // office desks drawn with one long and one short edge only (the rest hidden by chairs or a return): a square corner
  var C = [], A8 = 160 * K, B8 = 80 * K;
  function corners(hs, vs, a, b, flip) {
    hs.forEach(function (h) {
      if (Math.abs((h[2] - h[0]) - a) > 0.8) return;
      vs.forEach(function (v) {
        if (Math.abs((v[2] - v[0]) - b) > 0.8) return;
        var atEnd = Math.abs(v[1] - h[0]) < 0.8 || Math.abs(v[1] - h[2]) < 0.8, below = Math.abs(v[0] - h[1]) < 0.8, above = Math.abs(v[2] - h[1]) < 0.8;
        if (!atEnd || !(below || above)) return;
        var r = below ? [h[0], h[1], h[2], h[1] + b] : [h[0], h[1] - b, h[2], h[1]];
        C.push(flip ? [r[1], r[0], r[3], r[2]] : r);
      });
    });
  }
  var Hb = H.filter(function (h) { var L = h[2] - h[0]; return Math.abs(L - A8) < 0.8 || Math.abs(L - B8) < 0.8; });
  var Vb = V.filter(function (v) { var L = v[2] - v[0]; return Math.abs(L - A8) < 0.8 || Math.abs(L - B8) < 0.8; });
  corners(Hb, Vb, A8, B8, false);   // horizontal desk: long top or bottom edge, short side edge
  corners(Vb, Hb, A8, B8, true);    // upright desk: long side edge, short top or bottom edge
  var D = [];
  R.forEach(function (r) { if (!D.some(function (q) { return Math.abs(r[0] - q[0]) < 3 && Math.abs(r[1] - q[1]) < 3 && Math.abs(r[2] - q[2]) < 3 && Math.abs(r[3] - q[3]) < 3; })) D.push(r); });
  var bad = D.map(function () { return false; });
  for (var i = 0; i < D.length; i++) for (var j = 0; j < i; j++) {
    var a = D[i], b = D[j], w = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), h = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
    if (w > 0 && h > 0 && w * h > 0.2 * Math.min((a[2] - a[0]) * (a[3] - a[1]), (b[2] - b[0]) * (b[3] - b[1]))) bad[i] = bad[j] = true;
  }
  D = D.filter(function (_, i) { return !bad[i]; });
  // a gap between two desks of a row reads like a desk too: drop a candidate squeezed between two desks of another size
  function sq(r, o) {
    var vt = D.filter(function (q) { return q !== r && Math.abs(q[0] - r[0]) < 1 && Math.abs(q[2] - r[2]) < 1; });
    var hz = D.filter(function (q) { return q !== r && Math.abs(q[1] - r[1]) < 1 && Math.abs(q[3] - r[3]) < 1; });
    var hv = r[3] - r[1], wv = r[2] - r[0];
    var up = vt.some(function (q) { return Math.abs(q[3] - r[1]) < 1 && Math.abs((q[3] - q[1]) - hv) > 5; }), dn = vt.some(function (q) { return Math.abs(q[1] - r[3]) < 1 && Math.abs((q[3] - q[1]) - hv) > 5; });
    var lf = hz.some(function (q) { return Math.abs(q[2] - r[0]) < 1 && Math.abs((q[2] - q[0]) - wv) > 5; }), rt = hz.some(function (q) { return Math.abs(q[0] - r[2]) < 1 && Math.abs((q[2] - q[0]) - wv) > 5; });
    return (up && dn) || (lf && rt);
  }
  D = D.filter(function (r) { return !sq(r); });
  function ov(a, b, k) { var w = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), h = Math.min(a[3], b[3]) - Math.max(a[1], b[1]); return w > k && h > k; }
  var CD = [];
  C.forEach(function (r) { if (!D.concat(CD).some(function (q) { return ov(r, q, 3); })) CD.push(r); });
  var cbad = CD.map(function () { return false; });
  for (var i2 = 0; i2 < CD.length; i2++) for (var j2 = 0; j2 < i2; j2++) if (ov(CD[i2], CD[j2], 3)) cbad[i2] = cbad[j2] = true;
  return D.concat(CD.filter(function (_, i) { return !cbad[i]; })).map(function (r) { return r.map(function (v) { return Math.round(v * 10) / 10; }); });
}
