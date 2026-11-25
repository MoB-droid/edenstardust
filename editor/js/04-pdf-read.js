// ---- Reading an uploaded PDF. This page only reads what is drawn (lines, curves, fills, text) and draws the plan
// picture. What the drawing means (desks, seat types, elements) is worked out by the server ("the brain"): the page
// sends it the raw reading and gets the answer back. See pageRaw and brain below.
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
// one pass over the page: every path (polylines in page points, its fill / stroke colour, door-swing arcs) and every text item
function elRead(lib, page) {
  var vp = page.getViewport({ scale: 1 });
  return Promise.all([page.getOperatorList(), page.getTextContent()]).then(function (r) {
    var ol = r[0], tc = r[1], O = lib.OPS, U = lib.Util, fn = ol.fnArray, ar = ol.argsArray, ctm = [1, 0, 0, 1, 0, 0], st = [], sc = [0, 0, 0], fc = [0, 0, 0], P = [], cur = null;
    function rgb(a) {
      if (a && typeof a[0] === 'string' && /^#/.test(a[0])) return [parseInt(a[0].substr(1, 2), 16), parseInt(a[0].substr(3, 2), 16), parseInt(a[0].substr(5, 2), 16)];
      if (a && a.length >= 3) { var x = [+a[0], +a[1], +a[2]]; if (x[0] <= 1 && x[1] <= 1 && x[2] <= 1) x = x.map(function (v) { return v * 255; }); return x; }
      return [0, 0, 0];
    }
    var PAINT = {}; ['stroke', 'closeStroke', 'fill', 'eoFill', 'fillStroke', 'eoFillStroke', 'closeFillStroke', 'closeEOFillStroke'].forEach(function (k) { if (O[k] !== undefined) PAINT[O[k]] = k; });
    for (var i = 0; i < fn.length; i++) {
      var f = fn[i], a = ar[i];
      if (f === O.save) st.push([ctm.slice(), sc, fc]);
      else if (f === O.restore) { if (st.length) { var s0 = st.pop(); ctm = s0[0]; sc = s0[1]; fc = s0[2]; } }
      else if (f === O.transform) ctm = U.transform(ctm, a);
      else if (f === O.setStrokeRGBColor) sc = rgb(a);
      else if (f === O.setFillRGBColor) fc = rgb(a);
      else if (f === O.paintFormXObjectBegin) { st.push([ctm.slice(), sc, fc]); if (a && a[0]) ctm = U.transform(ctm, a[0]); }
      else if (f === O.paintFormXObjectEnd) { if (st.length) { var s1 = st.pop(); ctm = s1[0]; sc = s1[1]; fc = s1[2]; } }
      else if (f === O.constructPath) {
        var M = U.transform(vp.transform, ctm), ops = a[0], c = a[1], j = 0, cx = 0, cy = 0, sx = 0, sy = 0, lines = [], ln = null, arcs = [], moved = false;
        var T = function (x, y) { return [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]]; };
        var to = function (x, y) { var p = T(x, y); if (!ln) { var q = T(cx, cy); ln = [q[0], q[1]]; lines.push(ln); } ln.push(p[0], p[1]); };
        for (var k = 0; k < ops.length; k++) {
          var o = ops[k];
          if (o === O.moveTo) { cx = sx = c[j]; cy = sy = c[j + 1]; j += 2; ln = null; moved = true; }
          else if (o === O.lineTo) { if (moved) to(c[j], c[j + 1]); cx = c[j]; cy = c[j + 1]; j += 2; }
          else if (o === O.curveTo || o === O.curveTo2 || o === O.curveTo3) {
            var p1, p2, p3;
            if (o === O.curveTo) { p1 = [c[j], c[j + 1]]; p2 = [c[j + 2], c[j + 3]]; p3 = [c[j + 4], c[j + 5]]; j += 6; }
            else if (o === O.curveTo2) { p1 = [cx, cy]; p2 = [c[j], c[j + 1]]; p3 = [c[j + 2], c[j + 3]]; j += 4; }
            else { p1 = [c[j], c[j + 1]]; p2 = [c[j + 2], c[j + 3]]; p3 = p2; j += 4; }
            if (moved) {
              var B = function (u) { var v = 1 - u; return T(v * v * v * cx + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0], v * v * v * cy + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1]); };
              for (var t = 1; t <= 8; t++) { var q2 = B(t / 8); if (!ln) { var q0 = T(cx, cy); ln = [q0[0], q0[1]]; lines.push(ln); } ln.push(q2[0], q2[1]); }
              var ac = elArc(B(0), B(0.5), B(1), B(0.25));
              if (ac) arcs.push(ac);
            }
            cx = p3[0]; cy = p3[1];
          }
          else if (o === O.closePath) { if (moved && ln) to(sx, sy); cx = sx; cy = sy; ln = null; }
          else if (o === O.rectangle) { var rx = c[j], ry = c[j + 1], rw = c[j + 2], rh = c[j + 3], A = T(rx, ry), Bq = T(rx + rw, ry), C = T(rx + rw, ry + rh), D = T(rx, ry + rh); lines.push([A[0], A[1], Bq[0], Bq[1], C[0], C[1], D[0], D[1], A[0], A[1]]); ln = null; cx = sx = rx; cy = sy = ry; j += 4; moved = true; }
        }
        cur = { lines: lines, arcs: arcs };
      }
      else if (cur && PAINT[f]) {
        var nm = PAINT[f], fill = /fill/i.test(nm), stroke = /stroke/i.test(nm), b = [Infinity, Infinity, -Infinity, -Infinity];
        cur.lines.forEach(function (l) { for (var q = 0; q < l.length; q += 2) { b[0] = Math.min(b[0], l[q]); b[1] = Math.min(b[1], l[q + 1]); b[2] = Math.max(b[2], l[q]); b[3] = Math.max(b[3], l[q + 1]); } });
        if (isFinite(b[0])) P.push({ lines: cur.lines, arcs: cur.arcs, b: b, fill: fill ? fc : null, stroke: stroke ? sc : null });
        cur = null;
      }
      else if (f === O.endPath) cur = null;
    }
    var T2 = [], Rt = [];
    tc.items.forEach(function (it) {
      var s = String(it.str || '').trim(); if (!s) return;
      var m = U.transform(vp.transform, it.transform), fs = Math.hypot(m[2], m[3]);
      if (fs < 2) return;
      if (Math.abs(m[1]) > 0.2 * Math.abs(m[0])) {   // rotated text (dimensions): only its centre is kept
        var ux = m[0] / (Math.hypot(m[0], m[1]) || 1), uy = m[1] / (Math.hypot(m[0], m[1]) || 1), w = it.width || s.length * fs * 0.5;
        Rt.push({ s: s, c: [m[4] + ux * w / 2 + uy * fs / 2, m[5] + uy * w / 2 - ux * fs / 2], fs: fs }); return;
      }
      T2.push({ s: s, x0: m[4], x1: m[4] + (it.width || s.length * fs * 0.5), y: m[5], fs: fs });
    });
    return { paths: P, text: T2, rot: Rt, w: vp.width, h: vp.height };
  });
}
// a cubic piece that is a circular arc (door swing): centre, radius, start, end, span in degrees; null if not round
function elArc(a, m, b, q) {
  var ax = a[0], ay = a[1], bx = m[0], by = m[1], cx = b[0], cy = b[1], d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-6) return null;
  var ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
  var uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
  var r = Math.hypot(ax - ux, ay - uy); if (!(r > 0) || Math.abs(Math.hypot(q[0] - ux, q[1] - uy) - r) > 0.03 * r) return null;
  var t0 = Math.atan2(ay - uy, ax - ux), t1 = Math.atan2(cy - uy, cx - ux), sp = Math.abs(t1 - t0); if (sp > Math.PI) sp = 2 * Math.PI - sp;
  return { c: [ux, uy], r: r, s: a, e: b, span: sp * 180 / Math.PI };
}
// the plan picture: the building area, grayscale, light greys to white, a few grey levels (small PNG)
function planPicture(page, E, pf, asIs) {
  var W = E[2] - E[0], H = E[3] - E[1], S = Math.min(1.5, Math.sqrt(14e6 / (W * H)));
  var vp = page.getViewport({ scale: S * (pf || 1), offsetX: -E[0] * S, offsetY: -E[1] * S });
  var c = document.createElement('canvas'); c.width = Math.round(W * S); c.height = Math.round(H * S);
  var ctx = c.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
  return page.render({ canvasContext: ctx, viewport: vp }).promise.then(function () {
    if (asIs) return new Promise(function (ok, bad) { c.toBlob(function (b) { if (b) ok(b); else bad({ code: 'png' }); }, 'image/png'); });
    var im = ctx.getImageData(0, 0, c.width, c.height), d = im.data;
    for (var i = 0; i < d.length; i += 4) { var v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; v = v > 235 ? 255 : Math.round(v / 51) * 51; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    ctx.putImageData(im, 0, 0);
    return new Promise(function (ok, bad) { c.toBlob(function (b) { if (b) ok(b); else bad({ code: 'png' }); }, 'image/png'); });
  });
}
// The raw reading of a page, as the brain wants it. want = { A, texts, ink, el } (truthy = include):
//   A     straight segments 5-400 pt [ax, ay, bx, by]      texts  the page's text strings that hold digits
//   ink   { segs, w, h } (pdfInk)                           el     { paths, text, rot, w, h } (elRead)
function pageRaw(lib, page, want) {
  var vp = page.getViewport({ scale: 1 }), out = {}, jobs = [];
  if (want.A) jobs.push(pdfSegments(lib, page, vp, 5, 400).then(function (r) { out.A = r.A; }));
  if (want.texts) jobs.push(page.getTextContent().then(function (tc) { out.texts = tc.items.map(function (it) { return it.str || ''; }).filter(function (t) { return /\d/.test(t); }); }, function () { out.texts = []; }));
  if (want.ink) jobs.push(pdfInk(lib, page).then(function (r) { out.ink = r; }));
  if (want.el) jobs.push(elRead(lib, page).then(function (r) { out.el = r; }, function () {}));
  return Promise.all(jobs).then(function () { return out; });
}
// Ask the brain: op = 'layout' | 'desks' | 'osh' | 'elements' | …; raw = a raw reading (its numbers are sent rounded
// to 0.01 pt), more = small exact values (desks, scale, names). Resolves with the answer; rejects with { code: 'nobrain' }
// where there is no server (the preview artifact) or { code: 'brain', status } when the server fails.
function brain(op, raw, more) {
  if (!window.__edenBrain) return Promise.reject({ code: 'nobrain' });
  var body = '{"raw":' + JSON.stringify(raw || {}, function (k, v) { return typeof v === 'number' ? Math.round(v * 100) / 100 : v; }) + ',"more":' + JSON.stringify(more || {}) + '}';
  return window.__edenBrain(op, body);
}
// a new layout from a raw reading: one trip, or three smaller ones when the drawing is too heavy for one
function readLayout(raw, name) {
  return brain('layout', raw, { name: name }).catch(function (e) {
    if (!e || e.code !== 'brain' || e.status < 500) throw e;
    var L;
    return brain('desks', { A: raw.A, texts: raw.texts, ink: raw.ink }, { name: name }).then(function (r) {
      if (r.error) return r;
      L = r.L;
      return brain('osh', { ink: raw.ink }, { f: L.pscale, desks: L.desks, ang: L.ang, chairs: L.chairs }).then(function (o) { L.osh = o.osh; L.oshv = o.oshv; L.ask = o.ask; }, function () { L.osh = []; })
        .then(function () { return brain('elements', { el: raw.el, ink: raw.ink }, { L: { desks: L.desks, ang: L.ang, chairs: L.chairs, osh: L.osh }, f: L.pscale }).then(function (E) { L.elements = E; L.elv = EL_V; }, function () {}); })
        .then(function () { return { L: L }; });
    });
  });
}
