// ---- C3 element inventory (set by the user 25 Nov 2026, version 1): on the first analysis of a layout, every C2 element
// in C3 order: on the layout or not, where, how many. Read from the PDF: paths (lines, curves, fills) and text (labels,
// furniture tags and their legend). Never a guess: what cannot be read reliably is "not detected yet" (nd), never "no".
var EL_V = 1;
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
// the drawing rasterised at 20 cells per metre (black and grey lines and fills; coloured annotations, the boxes round
// tags and room numbers, and lines across the whole sheet left out), then the free space split into connected areas:
// a closed room is an area of 1.5–100 m² inside the building; bigger ones are open space. f = layout units per page point.
function elSpaces(R, f) {
  var mU = 72 / 2.54 * 100 / 50 / (f || 1), s = 20 / mU, W = Math.ceil(R.w * s) + 2, H = Math.ceil(R.h * s) + 2;
  if (W * H > 9e6) { s *= Math.sqrt(9e6 / (W * H)); W = Math.ceil(R.w * s) + 2; H = Math.ceil(R.h * s) + 2; }
  var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  var x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.lineWidth = 1; x.strokeStyle = '#000'; x.fillStyle = '#000';
  function plain(c) { return c && Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]) <= 60 && Math.max(c[0], c[1], c[2]) < 235; }
  var boxes = R.text.map(function (t) { return [t.x0, t.y - t.fs, t.x1, t.y]; });
  function aroundText(b) {
    if (b[2] - b[0] > 4 * mU / 10 * 6 || b[3] - b[1] > mU * 0.6) return false;
    return boxes.some(function (t) { return t[0] >= b[0] - 2 && t[2] <= b[2] + 2 && t[1] >= b[1] - 2 && t[3] <= b[3] + 2; });
  }
  // dimension lines: a single straight line with a number written along its middle (they cut rooms in two)
  var nums = R.text.filter(function (t) { return /^\d{1,4}([.,]\d)?$/.test(t.s); }).map(function (t) { return { c: [(t.x0 + t.x1) / 2, t.y - t.fs / 2], fs: t.fs }; })
    .concat(R.rot.filter(function (t) { return /^\d{1,4}([.,]\d)?$/.test(t.s); }));
  var nb = {}; nums.forEach(function (n) { var k = Math.floor(n.c[0] / 50) + '|' + Math.floor(n.c[1] / 50); (nb[k] = nb[k] || []).push(n); });
  function dimLine(p) {
    if (p.lines.length !== 1 || p.lines[0].length !== 4 || p.fill) return false;
    var l = p.lines[0], dx = l[2] - l[0], dy = l[3] - l[1], L = Math.hypot(dx, dy); if (L < 0.25 * mU) return false;
    var hit = false;
    for (var gx = Math.floor(Math.min(l[0], l[2]) / 50) - 1; gx <= Math.floor(Math.max(l[0], l[2]) / 50) + 1 && !hit; gx++)
      for (var gy = Math.floor(Math.min(l[1], l[3]) / 50) - 1; gy <= Math.floor(Math.max(l[1], l[3]) / 50) + 1 && !hit; gy++)
        (nb[gx + '|' + gy] || []).forEach(function (n) {
          var t = ((n.c[0] - l[0]) * dx + (n.c[1] - l[1]) * dy) / (L * L), d = Math.abs((n.c[0] - l[0]) * dy - (n.c[1] - l[1]) * dx) / L;
          if (t > 0.2 && t < 0.8 && d < 1.1 * n.fs) hit = true;
        });
    return hit;
  }
  R.paths.forEach(function (p) {
    if (dimLine(p)) return;
    var b = p.b; if (b[2] - b[0] > 0.85 * R.w || b[3] - b[1] > 0.85 * R.h) return;
    var st = plain(p.stroke), fi = plain(p.fill); if (!st && !fi) return;
    if (aroundText(b)) return;
    x.beginPath();
    p.lines.forEach(function (l) {
      if ((Math.abs(l[0]) < 2 && Math.abs(l[1]) < 2) || (Math.abs(l[l.length - 2]) < 2 && Math.abs(l[l.length - 1]) < 2)) return;
      x.moveTo(l[0] * s, l[1] * s); for (var q = 2; q < l.length; q += 2) x.lineTo(l[q] * s, l[q + 1] * s);
    });
    if (fi) x.fill(); if (st || fi) x.stroke();
  });
  var px = x.getImageData(0, 0, W, H).data, N = W * H, ink = new Uint8Array(N);
  for (var i = 0; i < N; i++) if (px[i * 4] < 200) ink[i] = 1;
  // label the free cells (4-connected)
  var lab = new Int32Array(N), q = new Int32Array(N), comps = [{}];
  for (var k = 0; k < N; k++) {
    if (ink[k] || lab[k]) continue;
    var id = comps.length, qh = 0, qt = 0, n = 0, b0 = [1e9, 1e9, -1, -1], edge = false; lab[k] = id; q[qt++] = k;
    while (qh < qt) {
      var c = q[qh++], cx = c % W, cy = (c / W) | 0; n++;
      if (cx < b0[0]) b0[0] = cx; if (cx > b0[2]) b0[2] = cx; if (cy < b0[1]) b0[1] = cy; if (cy > b0[3]) b0[3] = cy;
      if (cx === 0 || cy === 0 || cx === W - 1 || cy === H - 1) edge = true;
      if (cx > 0 && !ink[c - 1] && !lab[c - 1]) { lab[c - 1] = id; q[qt++] = c - 1; }
      if (cx < W - 1 && !ink[c + 1] && !lab[c + 1]) { lab[c + 1] = id; q[qt++] = c + 1; }
      if (c >= W && !ink[c - W] && !lab[c - W]) { lab[c - W] = id; q[qt++] = c - W; }
      if (c < N - W && !ink[c + W] && !lab[c + W]) { lab[c + W] = id; q[qt++] = c + W; }
    }
    comps.push({ id: id, a: n / 400, b: [b0[0] / s, b0[1] / s, (b0[2] + 1) / s, (b0[3] + 1) / s], out: edge });
  }
  // the building: the biggest block of drawing not reached from the sheet's edge
  var blk = new Int32Array(N), best = null;
  for (var k2 = 0; k2 < N; k2++) {
    if (blk[k2] || (lab[k2] && comps[lab[k2]].out)) continue;
    var qh2 = 0, qt2 = 0, n2 = 0, bb = [1e9, 1e9, -1, -1]; blk[k2] = 1; q[qt2++] = k2;
    while (qh2 < qt2) {
      var c2 = q[qh2++], x2 = c2 % W, y2 = (c2 / W) | 0; n2++;
      if (x2 < bb[0]) bb[0] = x2; if (x2 > bb[2]) bb[2] = x2; if (y2 < bb[1]) bb[1] = y2; if (y2 > bb[3]) bb[3] = y2;
      [x2 > 0 ? c2 - 1 : -1, x2 < W - 1 ? c2 + 1 : -1, c2 >= W ? c2 - W : -1, c2 < N - W ? c2 + W : -1].forEach(function (nb) {
        if (nb < 0 || blk[nb] || (lab[nb] && comps[lab[nb]].out)) return; blk[nb] = 1; q[qt2++] = nb;
      });
    }
    if (!best || n2 > best.n) best = { n: n2, b: [bb[0] / s, bb[1] / s, (bb[2] + 1) / s, (bb[3] + 1) / s] };
  }
  return { s: s, W: W, H: H, mU: mU, lab: lab, ink: ink, comps: comps, bld: best ? best.b : [0, 0, R.w, R.h] };
}
// text items joined into labels (same line, same size, side by side); Hebrew labels read right to left
function elLabels(T) {
  var it = T.slice().sort(function (a, b) { return a.y - b.y || a.x0 - b.x0; }), used = [], out = [];
  it.forEach(function (a, i) {
    if (used[i]) return; used[i] = 1; var g = [a], grew = true;
    while (grew) {
      grew = false;
      for (var j = i + 1; j < it.length; j++) {
        var q = it[j]; if (used[j]) continue; if (q.y - a.y > a.fs) break;
        if (g.some(function (p) { return p.s === q.s && Math.abs(p.x0 - q.x0) < 1 && Math.abs(p.y - q.y) < 1; })) { used[j] = 1; continue; }   // the same text drawn twice
        if (g.some(function (p) { return Math.abs(q.y - p.y) < 0.15 * p.fs && Math.abs(q.fs - p.fs) < 0.6 && (Math.abs(q.x0 - p.x1) < 0.8 * p.fs || Math.abs(p.x0 - q.x1) < 0.8 * p.fs); })) { g.push(q); used[j] = 1; grew = true; }
      }
    }
    var heb = g.some(function (p) { return /[֐-׿]/.test(p.s); });
    g.sort(function (p, q) { return heb ? q.x0 - p.x0 : p.x0 - q.x0; });
    var x0 = Math.min.apply(null, g.map(function (p) { return p.x0; })), x1 = Math.max.apply(null, g.map(function (p) { return p.x1; }));
    out.push({ s: g.map(function (p) { return p.s; }).join(' ').replace(/\s+/g, ' '), x0: x0, x1: x1, y0: a.y - a.fs, y1: a.y, fs: a.fs, c: [(x0 + x1) / 2, a.y - a.fs / 2], items: g });
  });
  return out;
}
// furniture tags (WS01, FR12, N 07…) and the legend that names them: a tag with a description on its own row
// (furniture list) is a legend row; every other copy of that tag is a piece of furniture on the plan
var EL_TAG = /^[A-Z]{1,3}-?\d{1,3}(\.\d)?$/;
function elTags(T) {
  var out = [], used = {};
  T.forEach(function (t, i) {
    if (EL_TAG.test(t.s)) { out.push({ s: t.s.replace('-', ''), c: [(t.x0 + t.x1) / 2, t.y - t.fs / 2], t: t }); return; }
    if (/^[A-Z]{1,3}$/.test(t.s)) T.forEach(function (u, j) {
      if (used[j] || j === i || !/^\d{1,3}(\.\d)?$/.test(u.s) || Math.abs(u.y - t.y) > 0.15 * t.fs || Math.abs(u.fs - t.fs) > 0.5 || u.x0 - t.x1 > 0.6 * t.fs || u.x0 < t.x0) return;
      used[j] = 1; out.push({ s: t.s + u.s, c: [(t.x0 + u.x1) / 2, t.y - t.fs / 2], t: t });
    });
  });
  var legend = {}, rows = [];
  out.forEach(function (g) {
    var row = T.filter(function (u) { return u !== g.t && Math.abs(u.y - g.t.y) < 0.2 * g.t.fs && Math.abs(u.fs - g.t.fs) < 0.6 && Math.abs((u.x0 + u.x1) / 2 - g.c[0]) < 25 * g.t.fs && /[A-Za-z֐-׿]{2}/.test(u.s) && !EL_TAG.test(u.s); });
    if (!row.length) return;
    var heb = row.some(function (p) { return /[֐-׿]/.test(p.s); });
    row.sort(function (p, q) { return heb ? q.x0 - p.x0 : p.x0 - q.x0; });
    var d = row.map(function (p) { return p.s; }).join(' ').replace(/\s+/g, ' ');
    if (d.length < 3) return;
    g.leg = true; if (!legend[g.s]) legend[g.s] = d; rows.push(g);
  });
  return { legend: legend, on: out.filter(function (g) { return !g.leg && legend[g.s]; }), all: out };
}
// what a legend description names (Hebrew or English): chairs first ("chair for worker + manager + reception" is a chair)
function elKind(d) {
  d = String(d || '').toLowerCase();
  if (/כסא|כיסא|chair|שרפרף|stool/.test(d) && !/כורס/.test(d)) {
    if (/שרפרף|stool|בר(\s|$)/.test(d)) return 'stool';
    if (/ישיבות|בורד|board|meeting|conference/.test(d)) return 'mchair';
    if (/קפיטריה|cafeteria|dining|אוכל/.test(d)) return 'dchair';
    if (/לאונג|lounge/.test(d)) return 'arm';
    if (/אורח|guest|visitor/.test(d)) return 'gchair';
    return 'wchair';
  }
  if (/ספה|sofa|couch/.test(d)) return 'sofa';
  if (/כורס|armchair|lounge chair|פוף|pouf/.test(d)) return 'arm';
  if (/ספסל|bench/.test(d) && /ישיבות|meeting|board|בורד/.test(d)) return 'mbench';
  if (/שולחן|table|desk/.test(d)) {
    if (/ישיבות|בורד|board|meeting|conference|אחד על אחד/.test(d)) return 'mtable';
    if (/קפיטריה|cafeteria|dining|אוכל/.test(d)) return 'dtable';
    if (/קפה|coffee|side|צד|לאונג|lounge/.test(d)) return 'ctable';
    if (/מנהל|manager|executive|director/.test(d)) return 'mdesk';
    if (/עובד|עבודה|workstation|desk/.test(d)) return 'desk';
    return 'table';
  }
  if (/דלפק\s*קבלה|קבלה|reception|front desk/.test(d)) return 'reception';
  if (/(^|\s)אי(\s|$)|island|bar counter/.test(d)) return 'island';
  if (/מטבח|kitchen|כיור|sink/.test(d)) return 'kitchen';
  if (/מדפסת|printer/.test(d)) return 'printer';
  return 'other';
}
// the C3 rows, in order (sections 1–6, every sub-item): id, section, name
var EL_ROWS = [
  ['1a', 1, 'Elevators / main entrance'], ['1b', 1, 'Entrances (incl. fire stairs, side doors)'], ['1c', 1, 'Facade (exterior glass wall)'], ['1d', 1, 'Cement core'], ['1e', 1, 'Columns'],
  ['2a', 2, 'Gypsum walls'], ['2b', 2, 'Interior glass walls'], ['2c', 2, 'Doors (incl. glass doors)'],
  ['3a', 3, 'Reception + waiting area'], ['3b', 3, 'Cafeteria'], ['3b.1', 3, 'Cafeteria island / bar counter'], ['3b.2', 3, 'Dining tables'], ['3b.3', 3, 'Dining chairs'], ['3b.4', 3, 'Side / coffee tables'],
  ['3c', 3, 'Lounges'], ['3d', 3, 'Big meeting rooms (13–50)'], ['3e', 3, 'Mid meeting rooms (7–12)'], ['3f', 3, 'Small meeting rooms (2–6)'], ['3g', 3, 'Lounge meeting rooms'], ['3h', 3, 'Meeting rooms in the open space'], ['3i', 3, 'Printer stations'],
  ['4a', 4, 'Corridors'], ['4b', 4, 'Main corridors'], ['4c', 4, 'Secondary corridors'], ['4d', 4, 'Movement / privacy hierarchy'], ['4e', 4, 'Unclear thin walls'],
  ['5a', 5, 'Manager rooms (M)'], ['5b', 5, 'Single rooms (S)'], ['5c', 5, 'Rooms for N (R2–R10)'], ['5d', 5, 'C-level rooms (C)'],
  ['6a', 6, 'Open-space benches (OS)'], ['6b', 6, 'Open space hidden (OSH)'], ['6c', 6, 'Benches at an angle']
];
var EL_SECTIONS = ['', 'Entrances, shell and core', 'Interior walls and doors', 'Public spaces', 'Corridors', 'Room types', 'Open-space desks'];
// R: elRead; L: the layout (desks, chairs, ang, osh in layout units); f: layout units per page point; ink: pdfInk result
function elInventory(R, L, f, ink) {
  f = f || 1;
  var S = elSpaces(R, f), mU = S.mU, rows = {}, BL = S.bld, W = BL[2] - BL[0], H = BL[3] - BL[1];
  function inB(c, pad) { pad = pad || 0; return c[0] > BL[0] - pad && c[0] < BL[2] + pad && c[1] > BL[1] - pad && c[1] < BL[3] + pad; }
  function zone(c) {
    var fx = (c[0] - BL[0]) / W, fy = (c[1] - BL[1]) / H, v = fy < 0.3 ? 'N' : fy > 0.7 ? 'S' : '', h = fx < 0.3 ? 'W' : fx > 0.7 ? 'E' : '';
    return v + h || 'centre';
  }
  function ctr(b) { return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; }
  function ub(a, b) { return a ? [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])] : b.slice(); }
  function grow(b, d) { return [b[0] - d, b[1] - d, b[2] + d, b[3] + d]; }
  function out(b) { return b.map(function (v) { return Math.round(v * f); }); }   // plan units
  function zones(list) { var z = []; list.forEach(function (b) { var k = zone(ctr(b)); if (z.indexOf(k) < 0) z.push(k); }); return z.join(', '); }
  function put(id, found, n, loc, boxes, note) { rows[id] = { found: found, n: n === undefined ? null : n, loc: loc || '', boxes: (boxes || []).slice(0, 400).map(out), note: note || '' }; }
  function nd(id, why) { put(id, 'nd', null, '', [], why); }
  // an area that can be a room or open space: 1.5 m² or more, or 0.7 m² or more when it is not a plain rectangle (the
  // inside of a desk or a table is a rectangle with nothing in it)
  function ok(cp) { if (!cp || cp.out) return false; if (cp.a >= 1.5) return true; var ba = (cp.b[2] - cp.b[0]) * (cp.b[3] - cp.b[1]) * S.s * S.s / 400; return cp.a >= 0.7 && cp.a < 0.85 * ba; }
  // the area a point belongs to: of the areas within about 0.7 m, the one with the most free cells there
  function at(c, small) {
    var x0 = Math.round(c[0] * S.s), y0 = Math.round(c[1] * S.s), R0 = 14, cnt = {}, best = null, bn = 0;
    for (var dy = -R0; dy <= R0; dy++) for (var dx = -R0; dx <= R0; dx++) {
      if (dx * dx + dy * dy > R0 * R0) continue;
      var x = x0 + dx, y = y0 + dy; if (x < 0 || y < 0 || x >= S.W || y >= S.H) continue;
      var id = S.lab[y * S.W + x]; if (!id) continue;
      cnt[id] = (cnt[id] || 0) + 1;
    }
    // furniture tags and desks: a room or open space (1.5 m² or more) first; room numbers: any area, the tiniest rooms too
    [true, false].forEach(function (big) {
      if (best || (big && small)) return;
      Object.keys(cnt).forEach(function (id) { var cp = S.comps[id]; if (ok(cp) && (!big || cp.a >= 1.5) && cnt[id] > bn) { bn = cnt[id]; best = cp; } });
    });
    return best;
  }
  function closed(cp) { return ok(cp) && cp.a <= 60; }
  // labels on the plan (inside the building), furniture tags with their legend
  var LB = elLabels(R.text).filter(function (l) { return inB(l.c); }), TG = elTags(R.text), tags = TG.on.filter(function (g) { return inB(g.c); });
  tags.forEach(function (g) { g.k = elKind(TG.legend[g.s]); });
  var hasTags = tags.length >= 10;
  function lab(re) { return LB.filter(function (l) { return re.test(l.s); }); }
  function tagsOf(k) { return tags.filter(function (g) { return k.indexOf(g.k) >= 0; }); }
  function tb(g) { var t = g.t; return [t.x0 - 2, t.y - t.fs - 2, t.x1 + 2, t.y + 2]; }
  // desks (layout units → page points), their areas
  // a desk belongs to the area its chair is in (a desk against a wall is closer to the next room than its own centre says)
  var CH = Array.isArray(L.chairs) && L.chairs.length === (L.desks || []).length ? L.chairs : chairsFor(L.desks || [], L.ang);
  var D = (L.desks || []).map(function (d, i) { var b = [d[0] / f, d[1] / f, d[2] / f, d[3] / f], ch = CH[i] && isFinite(CH[i][0]) ? [CH[i][0] / f, CH[i][1] / f] : null; return { i: i, b: b, c: ctr(b), cp: at(ch || ctr(b)) }; });
  tags.forEach(function (g) {
    var d = (g.k === 'desk' || g.k === 'mdesk') && D.filter(function (o) { return g.c[0] > o.b[0] - 3 && g.c[0] < o.b[2] + 3 && g.c[1] > o.b[1] - 3 && g.c[1] < o.b[3] + 3; })[0];
    g.cp = d ? d.cp : at(g.c);
  });
  // ---- 1. entrances, shell, core
  // core: the biggest cluster of grey-filled walls (concrete)
  var grey = R.paths.filter(function (p) {
    var c = p.fill; if (!c) return false; var mx = Math.max(c[0], c[1], c[2]), mn = Math.min(c[0], c[1], c[2]);
    return mx - mn < 40 && mx >= 60 && mx <= 200 && (p.b[2] - p.b[0]) * (p.b[3] - p.b[1]) > 0.05 * mU * mU && inB(ctr(p.b));
  });
  var gcl = [];
  grey.forEach(function (p) {
    var hit = gcl.filter(function (g) { var a = grow(g.b, 2 * mU); return p.b[0] < a[2] && p.b[2] > a[0] && p.b[1] < a[3] && p.b[3] > a[1]; });
    var g = { b: p.b.slice(), a: (p.b[2] - p.b[0]) * (p.b[3] - p.b[1]), n: 1 };
    hit.forEach(function (h) { g.b = ub(g.b, h.b); g.a += h.a; g.n += h.n; gcl.splice(gcl.indexOf(h), 1); });
    gcl.push(g);
  });
  gcl.sort(function (a, b) { return b.a - a.a; });
  var core = gcl[0] && gcl[0].a > 8 * mU * mU && (gcl[0].b[2] - gcl[0].b[0]) > 4 * mU && (gcl[0].b[3] - gcl[0].b[1]) > 4 * mU ? gcl[0].b : null;
  // elevators: a label (lift, elevator, מעלית), else a row of 2+ shaft ids (H5, G10…) each alone in a square shaft of 2.5–9 m²
  var lifts = lab(/מעלית|elevator|\blifts?\b/i).map(function (l) { return [l.x0, l.y0, l.x1, l.y1]; }), liftNote = 'labelled';
  if (!lifts.length) {
    var ids = R.text.filter(function (t) { return /^[A-Z]{1,2}\d{1,2}$/.test(t.s) && !TG.legend[t.s] && inB([t.x0, t.y]); }).map(function (t) {
      var c = [(t.x0 + t.x1) / 2, t.y - t.fs / 2], cp = at(c); return { c: c, cp: cp, s: t.s };
    }).filter(function (o) {
      var cp = o.cp; if (!cp || cp.a < 1.5 || cp.a > 12) return false; var w = cp.b[2] - cp.b[0], h = cp.b[3] - cp.b[1];
      return Math.max(w, h) / Math.min(w, h) < 2.2 && (!core || (o.c[0] > core[0] && o.c[0] < core[2] && o.c[1] > core[1] && o.c[1] < core[3]));
    });
    var seen = {}; ids = ids.filter(function (o) { if (seen[o.cp.id]) return false; seen[o.cp.id] = 1; return true; });
    // a bank = 2+ shafts side by side (same row, 1.5–4 m apart)
    ids = ids.filter(function (o) { return ids.some(function (p) { return p !== o && Math.abs(ctr(p.cp.b)[1] - ctr(o.cp.b)[1]) < 1.2 * mU && Math.abs(ctr(p.cp.b)[0] - ctr(o.cp.b)[0]) < 4.2 * mU; }); });
    lifts = ids.map(function (o) { return o.cp.b; }); liftNote = 'shafts with ids';
  }
  var banks = [];
  lifts.forEach(function (b) { var k = banks.filter(function (g) { return Math.abs(ctr(g)[1] - ctr(b)[1]) < 1.5 * mU && b[0] < g[2] + 3 * mU && b[2] > g[0] - 3 * mU; })[0]; if (k) banks[banks.indexOf(k)] = ub(k, b); else banks.push(b.slice()); });
  var lobby = null;
  if (banks.length >= 2) {
    banks.sort(function (a, b) { return a[1] - b[1]; });
    var a1 = banks[0], b1 = banks[banks.length - 1];
    if (b1[1] - a1[3] > 1.5 * mU && b1[1] - a1[3] < 8 * mU) lobby = [Math.max(a1[0], b1[0]), a1[3], Math.min(a1[2], b1[2]), b1[1]];
  }
  if (lifts.length) put('1a', 'yes', lifts.length, zones(lifts) + ' · ' + banks.length + ' bank' + (banks.length > 1 ? 's' : '') + (lobby ? ' · main entrance = lift lobby (' + zone(ctr(lobby)) + ')' : ''), lifts.concat(lobby ? [lobby] : []), liftNote);
  else nd('1a', 'no lift label or shaft ids found');
  // stairs: 8+ parallel treads 0.9–1.8 m long, 0.22–0.36 m apart
  var tr = [];
  R.paths.forEach(function (p) { if (!p.stroke || !inB(ctr(p.b))) return; p.lines.forEach(function (l) {
    for (var q = 0; q + 3 < l.length; q += 2) {
      var dx = l[q + 2] - l[q], dy = l[q + 3] - l[q + 1], L0 = Math.hypot(dx, dy) / mU;
      if (L0 < 0.85 || L0 > 1.9) continue;
      if (Math.abs(dy) < 0.02 * Math.abs(dx)) tr.push({ o: 0, u: (l[q + 1] + l[q + 3]) / 2, a: Math.min(l[q], l[q + 2]), b: Math.max(l[q], l[q + 2]) });
      else if (Math.abs(dx) < 0.02 * Math.abs(dy)) tr.push({ o: 1, u: (l[q] + l[q + 2]) / 2, a: Math.min(l[q + 1], l[q + 3]), b: Math.max(l[q + 1], l[q + 3]) });
    }
  }); });
  var flights = [], tg2 = {};
  tr.forEach(function (t) { var k = t.o + '|' + Math.round(t.a / 3) + '|' + Math.round(t.b / 3); (tg2[k] = tg2[k] || []).push(t); });
  Object.keys(tg2).forEach(function (k) {
    var g = tg2[k].sort(function (p, q) { return p.u - q.u; }), run = [g[0]];
    for (var i = 1; i <= g.length; i++) {
      var gap = i < g.length ? (g[i].u - run[run.length - 1].u) / mU : 0;
      if (i < g.length && gap < 0.05) continue;
      if (i < g.length && gap >= 0.2 && gap <= 0.38 && (run.length < 2 || Math.abs(gap - (run[1].u - run[0].u) / mU) < 0.04)) { run.push(g[i]); continue; }
      if (run.length >= 8) { var t0 = run[0], t1 = run[run.length - 1]; flights.push(t0.o ? [t0.u, t0.a, t1.u, t0.b] : [t0.a, t0.u, t0.b, t1.u]); }
      if (i < g.length) run = [g[i]];
    }
  });
  var stairs = [];
  flights.forEach(function (b) { var k = stairs.filter(function (s) { var a = grow(s, 1.2 * mU); return b[0] < a[2] && b[2] > a[0] && b[1] < a[3] && b[3] > a[1]; })[0]; if (k) stairs[stairs.indexOf(k)] = ub(k, b); else stairs.push(b.slice()); });
  var ent = lab(/כניסה|entrance|entry|exit|יציאה|מילוט/i).map(function (l) { return { b: [l.x0, l.y0, l.x1, l.y1], s: l.s }; });
  var e1 = (lobby ? 1 : 0) + ent.length + stairs.length;
  if (e1) put('1b', 'yes', e1, [lobby ? 'main: lift lobby (' + zone(ctr(lobby)) + ')' : '', ent.map(function (e) { return e.s + ' (' + zone(ctr(e.b)) + ')'; }).join(', '), stairs.length ? stairs.length + ' stair' + (stairs.length > 1 ? 's' : '') + ' (' + zones(stairs) + ')' : ''].filter(Boolean).join(' · '),
    (lobby ? [lobby] : []).concat(ent.map(function (e) { return e.b; }), stairs), 'labelled entrances + stairs (treads); unlabelled side doors not counted');
  else nd('1b', 'no entrance labels or stairs found');
  put('1c', 'yes', 1, 'outline, all sides', [BL], 'the building outline');
  if (core) put('1d', 'yes', 1, zone(ctr(core)), [core], 'grey-filled walls'); else nd('1d', 'no grey-filled core walls found');
  // columns: small solid squares (filled black or grey, 0.2–1.2 m), not part of the core
  var cols = [];
  R.paths.forEach(function (p) {
    var c = p.fill; if (!c || Math.max(c[0], c[1], c[2]) > 200 || Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]) > 40) return;
    var w = (p.b[2] - p.b[0]) / mU, h = (p.b[3] - p.b[1]) / mU;
    if (w < 0.2 || h < 0.2 || w > 1.2 || h > 1.2 || Math.max(w, h) / Math.min(w, h) > 2 || !inB(ctr(p.b))) return;
    if (core && p.b[0] > core[0] - 0.3 * mU && p.b[2] < core[2] + 0.3 * mU && p.b[1] > core[1] - 0.3 * mU && p.b[3] < core[3] + 0.3 * mU) return;
    if (!cols.some(function (q) { return p.b[0] < q[2] && p.b[2] > q[0] && p.b[1] < q[3] && p.b[3] > q[1]; })) cols.push(p.b);
  });
  if (cols.length) put('1e', 'yes', cols.length, zones(cols), cols, 'solid squares 0.2–1.2 m outside the core; hatched columns not counted'); else nd('1e', 'no solid column squares found');
  // ---- 2. walls and doors
  var G = ink ? oshGrid(ink.segs, f, ink.w, ink.h) : null, walls = [];
  if (G) {
    var seenW = new Uint8Array(G.cols * G.rows);
    for (var k0 = 0; k0 < G.cols * G.rows; k0++) {
      if (!G.hat[k0] || G.col[k0] || seenW[k0]) continue;
      var stk = [k0], bx = [1e9, 1e9, -1, -1], n0 = 0; seenW[k0] = 1;
      while (stk.length) { var kk = stk.pop(), kx = kk % G.cols, ky = (kk / G.cols) | 0; n0++; bx = [Math.min(bx[0], kx), Math.min(bx[1], ky), Math.max(bx[2], kx), Math.max(bx[3], ky)];
        [kk - 1, kk + 1, kk - G.cols, kk + G.cols].forEach(function (nb) { if (nb >= 0 && nb < seenW.length && G.hat[nb] && !G.col[nb] && !seenW[nb]) { seenW[nb] = 1; stk.push(nb); } }); }
      var wb = [bx[0] * G.C / f, bx[1] * G.C / f, (bx[2] + 1) * G.C / f, (bx[3] + 1) * G.C / f];
      if (Math.max(wb[2] - wb[0], wb[3] - wb[1]) > 1 * mU && inB(ctr(wb)) && !(core && ctr(wb)[0] > core[0] && ctr(wb)[0] < core[2] && ctr(wb)[1] > core[1] && ctr(wb)[1] < core[3])) walls.push(wb);
    }
  }
  if (walls.length) put('2a', 'yes', null, zones(walls), walls, walls.length + ' hatched wall runs read; walls without hatch not read'); else nd('2a', 'no hatched walls found');
  nd('2b', 'glass and opaque thin walls are not told apart yet');
  // doors: quarter-circle swing arcs 0.55–1.3 m, drawn as one curve or as a chain of short chords (round tables, whole
  // circles, left out); the two leaves of a double door count once
  var sw = elSwings(R, mU).filter(function (a) { return inB(a.c); }), doors = [];
  sw.forEach(function (s) {
    var b = s.b, d = doors.filter(function (o) { return o.r && Math.abs(o.r - s.r) < 0.15 * s.r && Math.hypot(o.c[0] - s.c[0], o.c[1] - s.c[1]) > 1.5 * s.r && Math.hypot(o.c[0] - s.c[0], o.c[1] - s.c[1]) < 2.4 * s.r && (Math.abs(o.c[0] - s.c[0]) < 0.08 * mU || Math.abs(o.c[1] - s.c[1]) < 0.08 * mU) && b[0] < o.b[2] + 0.1 * mU && b[2] > o.b[0] - 0.1 * mU && b[1] < o.b[3] + 0.1 * mU && b[3] > o.b[1] - 0.1 * mU; })[0];
    if (d) { d.b = ub(d.b, b); d.r = 0; } else doors.push({ b: b, c: s.c, r: s.r });
  });
  if (doors.length) put('2c', 'yes', doors.length, zones(doors.map(function (d) { return d.b; })), doors.map(function (d) { return d.b; }), 'swing doors (arcs); sliding doors not read');
  else nd('2c', 'no door swings found');
  // ---- rooms: closed areas with their desks, furniture tags and labels
  var RM = {};
  // a closed room is a closed area of 1.5–60 m² with a room number (boxed) or a room name, not an open-space label
  var NUMS = elBoxed(R, mU).filter(function (n) { return inB(n.c); });
  var ROOMW = /חדר|room|ישיבות|meeting|בורד|board|^1:1$|סמנכ|מנכ|מנהל|manager|office|משרד|קבלה|reception|קפיטריה|cafeteria|מטבח|kitchen|lounge|לאונג|שירות|toilet|ממ"?ד|מחסן|storage|\bIT\b|server|focus/i;
  function room(cp) { if (!closed(cp)) return null; return RM[cp.id] || (RM[cp.id] = { cp: cp, b: cp.b, desks: [], tags: [], labels: [], nums: [] }); }
  NUMS.forEach(function (n) { var r = room(at(n.c, true)); if (r) r.nums.push(n); });
  LB.forEach(function (l) { var r = room(at(l.c)); if (r) r.labels.push(l); });
  Object.keys(RM).forEach(function (k) { var r = RM[k]; if (r.labels.some(function (l) { return /^OS\b|open ?space|אופן ?ספייס/i.test(l.s); }) || (!r.nums.length && !r.labels.some(function (l) { return ROOMW.test(l.s); }))) delete RM[k]; });
  function room2(cp) { return cp && RM[cp.id]; }
  D.forEach(function (d) { var r = room2(d.cp); if (r) r.desks.push(d); });
  tags.forEach(function (g) { var r = room2(g.cp); if (r) r.tags.push(g); });
  var RL = Object.keys(RM).map(function (k) { return RM[k]; });
  // desks in a room: the desk tags when the plan has furniture tags (detected desks can be meeting tables), else the desks read
  RL.forEach(function (r) { r.nd = hasTags ? r.tags.filter(function (g) { return g.k === 'desk' || g.k === 'mdesk'; }).length : r.desks.length; r.mgr = r.tags.filter(function (g) { return g.k === 'mdesk'; }).length; });
  function rk(r, ks) { return r.tags.filter(function (g) { return ks.indexOf(g.k) >= 0; }).length; }
  function rname(r) {
    var l = r.labels.filter(function (x) { return /[֐-׿A-Za-z]{2}|^1:1$/.test(x.s) && !EL_TAG.test(x.s.replace(/\s/g, '')); })[0];
    var num = r.nums[0];
    var t = [num ? num.s : '', l ? l.s.replace(/\s*''\s*/g, '"').replace(/\s*-\s*/g, '-') : ''].filter(Boolean).join(' ');
    return t ? '\u2068' + t + '\u2069' : '';   // isolated, so Hebrew names keep their order in an English line
  }
  function rloc(list) { var o = {}; list.forEach(function (r) { var z = zone(ctr(r.b)); (o[z] = o[z] || []).push(rname(r)); }); return Object.keys(o).map(function (z) { var n = o[z].filter(Boolean); return z + (n.length ? ' (' + n.join(', ') + ')' : ''); }).join(' · '); }
  var NONWORK = /קפיטריה|cafeteria|קבלה|reception|שירות|toilet|\bwc\b|restroom|ממ"?ד|ממד|מחסן|אחסון|storage|\bIT\b|server|חשמל|תקשורת|ניקיון|janitor|מקלחת|shower|הנקה|מטבח|kitchen/i;
  RL.forEach(function (r) { r.nonwork = r.labels.some(function (l) { return NONWORK.test(l.s); }); });
  // ---- 3. public spaces
  var rec = tagsOf(['reception']), recLab = lab(/קבלה|reception|front desk/i), recB = null;
  rec.forEach(function (g) { recB = ub(recB, tb(g)); }); recLab.forEach(function (l) { recB = ub(recB, [l.x0, l.y0, l.x1, l.y1]); });
  var wait = recB ? tagsOf(['sofa', 'arm', 'ctable']).filter(function (g) { var c = ctr(recB); return Math.hypot(g.c[0] - c[0], g.c[1] - c[1]) < 7 * mU && !closed(g.cp); }) : [];
  if (recB) put('3a', 'yes', 1, zone(ctr(recB)) + (lobby ? ', next to the lift lobby' : '') + (wait.length ? ' · waiting area: ' + wait.filter(function (g) { return g.k !== 'ctable'; }).length + ' lounge seats' : ''),
    [recB].concat(wait.map(tb)), rec.length ? 'reception counter tag' + (wait.length ? ' + lounge furniture within 7 m' : '') : 'label');
  else nd('3a', hasTags ? 'no reception counter tag or label' : 'no reception label');
  var cafL = lab(/קפיטריה|cafeteria|dining|lunch|מטבחון|kitchenette/i), dT = tagsOf(['dtable']), dC = tagsOf(['dchair']), isl = tagsOf(['island']), kit = tagsOf(['kitchen']);
  var cafB = null; cafL.filter(function (l) { return /קפיטריה|cafeteria|dining|lunch/i.test(l.s); }).forEach(function (l) { cafB = ub(cafB, [l.x0, l.y0, l.x1, l.y1]); });
  dT.concat(dC, isl, kit).forEach(function (g) { cafB = ub(cafB, tb(g)); });
  var kn = cafL.filter(function (l) { return /מטבחון|kitchenette/i.test(l.s); });
  if (cafB) put('3b', 'yes', cafL.filter(function (l) { return /קפיטריה|cafeteria|dining|lunch/i.test(l.s); }).length ? 1 : null, zone(ctr(cafB)) + (kn.length ? ' · kitchenette ' + zones(kn.map(function (l) { return [l.x0, l.y0, l.x1, l.y1]; })) : ''), [cafB], kn.length ? 'kitchenette shown in location only' : '');
  else nd('3b', 'no cafeteria label or dining furniture');
  function tagRow(id, list, none, note) {
    if (list.length) put(id, 'yes', list.length, zones(list.map(tb)), list.map(tb), note || 'furniture tags');
    else if (hasTags) nd(id, none); else nd(id, 'no furniture tags on this plan');
  }
  tagRow('3b.1', isl, 'no island / bar tag');
  tagRow('3b.2', dT, 'no dining table tag');
  tagRow('3b.3', dC, 'no dining chair tag', 'furniture tags; never seats');
  tagRow('3b.4', tagsOf(['ctable']), 'no side / coffee table tag');
  // lounges: sofas / armchairs in open space, not the waiting area: groups within 3 m
  var lg = tagsOf(['sofa', 'arm']).filter(function (g) { return !closed(g.cp) && wait.indexOf(g) < 0; }), lgc = [];
  lg.forEach(function (g) { var b = tb(g), k = lgc.filter(function (o) { var a = grow(o, 3 * mU); return b[0] < a[2] && b[2] > a[0] && b[1] < a[3] && b[3] > a[1]; })[0]; if (k) lgc[lgc.indexOf(k)] = ub(k, b); else lgc.push(b); });
  if (lgc.length) put('3c', 'yes', lgc.length, zones(lgc), lgc, 'sofas / armchairs in open space (not the waiting area)');
  else nd('3c', hasTags ? 'no sofa / armchair outside rooms and the waiting area' : 'no furniture tags on this plan');
  // meeting rooms: closed, no desk, a meeting table or meeting chairs or a meeting label; size = chairs at the table
  var MEETL = /ישיבות|meeting|conference|board\s*room|בורד|^1:1$|focus|חדר\s*שקט/i, mt = { big: [], mid: [], small: [], lounge: [], unk: [] };
  RL.forEach(function (r) {
    if (r.nd || r.nonwork || r.tags.some(function (g) { return g.k === 'dtable' || g.k === 'dchair' || g.k === 'reception'; })) return;
    var ch = rk(r, ['mchair', 'gchair', 'wchair', 'chair']), tbl = rk(r, ['mtable', 'table']), soft = rk(r, ['sofa', 'arm']), ml = r.labels.some(function (l) { return MEETL.test(l.s); });
    if (soft && !tbl && !rk(r, ['mchair'])) { mt.lounge.push(r); return; }
    if (!tbl && !rk(r, ['mchair']) && !ml) return;
    r.ch = ch;
    if (ch >= 13) mt.big.push(r); else if (ch >= 7) mt.mid.push(r); else if (ch >= 2) mt.small.push(r); else mt.unk.push(r);
  });
  [['3d', mt.big], ['3e', mt.mid], ['3f', mt.small]].forEach(function (p) {
    if (p[1].length) put(p[0], 'yes', p[1].length, rloc(p[1]), p[1].map(function (r) { return r.b; }), 'chairs at the table: ' + p[1].map(function (r) { return r.ch; }).join(', '));
    else nd(p[0], hasTags ? 'no closed room of that size found' : 'no furniture tags: chairs not counted');
  });
  if (mt.unk.length) { var o3 = rows['3f']; o3.note = (o3.note ? o3.note + '; ' : '') + 'size not read: ' + rloc(mt.unk) + ' (fewer than 2 chairs found)'; }
  if (mt.lounge.length) put('3g', 'yes', mt.lounge.length, rloc(mt.lounge), mt.lounge.map(function (r) { return r.b; }), 'closed room, soft seating, no desk or meeting table');
  else nd('3g', hasTags ? 'no closed room with soft seating only' : 'no furniture tags on this plan');
  nd('3h', 'needs the open space read around each room (corridors, section 4)');
  var pr = lab(/מדפסת|printer|\bprint|copy|צילום/i).map(function (l) { return [l.x0, l.y0, l.x1, l.y1]; }).concat(tagsOf(['printer']).map(tb));
  if (pr.length) put('3i', 'yes', pr.length, zones(pr), pr, 'labels / tags'); else nd('3i', 'no printer label');
  // ---- 4. corridors: not read yet
  ['4a', '4b', '4c', '4d'].forEach(function (id) { nd(id, 'corridors are not traced yet'); });
  nd('4e', 'paused by the user (C2 24)');
  // ---- 5. room types: closed rooms with desks
  var rt = { M: [], S: [], R: [], C: [], U: [] };
  RL.forEach(function (r) {
    var n = r.nd; if (!n || r.nonwork) return;
    if (n >= 2 && r.mgr) { rt.U.push(r); return; }   // two manager desks in one area: two rooms read as one
    if (n >= 2 && n <= 10) { r.rn = 'R' + n; rt.R.push(r); return; }
    if (n !== 1) return;
    var soft = rk(r, ['sofa', 'arm']), tbl = rk(r, ['mtable', 'table', 'ctable']), mch = rk(r, ['mchair']);
    if (!r.tags.length) return;   // no furniture tags in the room: type not read
    if (soft && !rk(r, ['mtable'])) rt.C.push(r);
    else if (tbl || mch) rt.M.push(r);
    else rt.S.push(r);
  });
  [['5a', rt.M], ['5b', rt.S], ['5d', rt.C]].forEach(function (p) {
    if (p[1].length) put(p[0], 'yes', p[1].length, rloc(p[1]), p[1].map(function (r) { return r.b; }), 'closed room, 1 desk');
    else nd(p[0], hasTags ? 'no closed room of this type found' : 'no furniture tags: room furniture not read');
  });
  if (rt.U.length) ['5a', '5b', '5d'].forEach(function (id) { var o = rows[id]; o.note = (o.note ? o.note + '; ' : '') + 'not read: ' + rloc(rt.U) + ' (two rooms drawn as one area)'; });
  if (rt.R.length) {
    var byN = {}; rt.R.forEach(function (r) { byN[r.rn] = (byN[r.rn] || 0) + 1; });
    put('5c', 'yes', rt.R.length, rloc(rt.R), rt.R.map(function (r) { return r.b; }), Object.keys(byN).sort().map(function (k) { return byN[k] + ' × ' + k; }).join(', '));
  } else nd('5c', 'no closed room with 2–10 desks found');
  // ---- 6. open-space desks
  var inRoom = {}; RL.forEach(function (r) { if (r.nd <= 10) r.desks.forEach(function (d) { inRoom[d.i] = 1; }); });
  var os = D.filter(function (d) { return !inRoom[d.i]; }), par = os.map(function (_, i) { return i; });
  function rt0(i) { while (par[i] !== i) i = par[i] = par[par[i]]; return i; }
  os.forEach(function (a, i) { os.forEach(function (b, j) { if (j < i && a.b[0] < b.b[2] + 6 / f && b.b[0] < a.b[2] + 6 / f && a.b[1] < b.b[3] + 6 / f && b.b[1] < a.b[3] + 6 / f) par[rt0(i)] = rt0(j); }); });
  var bn = {}; os.forEach(function (d, i) { var k = rt0(i), n = bn[k] ? bn[k].n : 0; bn[k] = ub(bn[k], d.b); bn[k].n = n + 1; });
  var benches = Object.keys(bn).map(function (k) { return bn[k]; }).filter(function (b) { return b.n >= 2; }), nOS = benches.reduce(function (s, b) { return s + b.n; }, 0);
  if (benches.length) put('6a', 'yes', nOS, zones(benches) + ' · ' + benches.length + ' benches', benches, 'desks on benches of 2+, outside closed rooms');
  else put('6a', 'no', 0, '', [], '');
  var osh = (L.osh || []).map(function (s) { return D[s - 1]; }).filter(Boolean);
  put('6b', osh.length ? 'yes' : 'no', osh.length, osh.length ? zones(osh.map(function (d) { return d.b; })) : '', osh.map(function (d) { return d.b; }), 'from the OSH reading (C2 23)');
  var ang = D.filter(function (d) { return Array.isArray(L.ang) && Math.abs(+L.ang[d.i] || 0) >= 0.5; });
  put('6c', ang.length ? 'yes' : 'no', ang.length, ang.length ? zones(ang.map(function (d) { return d.b; })) : '', ang.map(function (d) { return d.b; }), 'desks drawn at an angle');
  return { elv: EL_V, rows: EL_ROWS.map(function (r) { var o = rows[r[0]] || { found: 'nd', n: null, loc: '', boxes: [], note: '' }; o.id = r[0]; o.sec = r[1]; o.name = r[2]; return o; }) };
}

// door swings: circular arcs of 75–105° and 0.55–1.3 m radius: one curve, or a chain of short straight chords joined end to end
function elSwings(R, mU) {
  var out = [];
  function fit(pts) {
    if (pts.length < 4) return null;
    var a = pts[0], m = pts[Math.floor(pts.length / 2)], b = pts[pts.length - 1], q = pts[Math.floor(pts.length / 4)];
    var ac = elArc(a, m, b, q); if (!ac) return null;
    if (pts.some(function (p) { return Math.abs(Math.hypot(p[0] - ac.c[0], p[1] - ac.c[1]) - ac.r) > 0.04 * ac.r; })) return null;
    // the span through the middle point (an arc over 180° is not a door)
    var t0 = Math.atan2(a[1] - ac.c[1], a[0] - ac.c[0]), tm = Math.atan2(m[1] - ac.c[1], m[0] - ac.c[0]), t1 = Math.atan2(b[1] - ac.c[1], b[0] - ac.c[0]);
    function d(x, y) { var v = y - x; while (v < -Math.PI) v += 2 * Math.PI; while (v > Math.PI) v -= 2 * Math.PI; return v; }
    var sp = Math.abs(d(t0, tm) + d(tm, t1)) * 180 / Math.PI, r = ac.r / mU;
    if (sp < 75 || sp > 105 || r < 0.55 || r > 1.3) return null;
    var bx = [ac.c[0], ac.c[1], ac.c[0], ac.c[1]]; pts.forEach(function (p) { bx = [Math.min(bx[0], p[0]), Math.min(bx[1], p[1]), Math.max(bx[2], p[0]), Math.max(bx[3], p[1])]; });
    return { c: ac.c, r: ac.r, b: bx };
  }
  var seg = [];
  R.paths.forEach(function (p) {
    var c = p.stroke; if (!c || Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]) > 60) return;
    p.lines.forEach(function (l) {
      if (l.length >= 10) { var pts = []; for (var i = 0; i < l.length; i += 2) pts.push([l[i], l[i + 1]]); var f0 = fit(pts); if (f0) { out.push(f0); return; } }
      for (var j = 0; j + 3 < l.length; j += 2) { var L0 = Math.hypot(l[j + 2] - l[j], l[j + 3] - l[j + 1]); if (L0 > 0.02 * mU && L0 < 0.3 * mU) seg.push([l[j], l[j + 1], l[j + 2], l[j + 3]]); }
    });
  });
  // chains of chords: ends that meet (once each) are joined
  function key(x, y) { return Math.round(x * 2) + ',' + Math.round(y * 2); }
  var ends = {};
  seg.forEach(function (q, i) { [key(q[0], q[1]), key(q[2], q[3])].forEach(function (k) { (ends[k] = ends[k] || []).push(i); }); });
  var used = new Uint8Array(seg.length);
  seg.forEach(function (q0, i0) {
    if (used[i0]) return;
    used[i0] = 1; var pts = [[q0[0], q0[1]], [q0[2], q0[3]]];
    [true, false].forEach(function (fwd) {
      var guard = 0;
      while (guard++ < 200) {
        var p = fwd ? pts[pts.length - 1] : pts[0], nx = (ends[key(p[0], p[1])] || []).filter(function (j) { return !used[j]; });
        if (nx.length !== 1 || (ends[key(p[0], p[1])] || []).length > 2) break;
        var q = seg[nx[0]]; used[nx[0]] = 1;
        var o = key(q[0], q[1]) === key(p[0], p[1]) ? [q[2], q[3]] : [q[0], q[1]];
        if (fwd) pts.push(o); else pts.unshift(o);
      }
    });
    if (pts.length >= 5) { var f1 = fit(pts); if (f1) out.push(f1); }
  });
  // a whole circle drawn as quarter arcs (a round table) is not a door
  return out.filter(function (a) { return out.filter(function (o) { return Math.hypot(o.c[0] - a.c[0], o.c[1] - a.c[1]) < 0.05 * a.r && Math.abs(o.r - a.r) < 0.05 * a.r; }).length < 3; });
}
// room numbers: whole numbers drawn inside a small box (four lines round the text)
function elBoxed(R, mU) {
  var hs = [], vs = [];
  R.paths.forEach(function (p) {
    if (!p.stroke) return;
    p.lines.forEach(function (l) { for (var j = 0; j + 3 < l.length; j += 2) {
      var x0 = l[j], y0 = l[j + 1], x1 = l[j + 2], y1 = l[j + 3], L0 = Math.hypot(x1 - x0, y1 - y0);
      if (L0 < 0.1 * mU || L0 > 1 * mU) continue;
      if (Math.abs(y1 - y0) < 0.3) hs.push([Math.min(x0, x1), Math.max(x0, x1), (y0 + y1) / 2]);
      else if (Math.abs(x1 - x0) < 0.3) vs.push([Math.min(y0, y1), Math.max(y0, y1), (x0 + x1) / 2]);
    } });
  });
  return R.text.filter(function (t) {
    if (!/^\d{1,3}$/.test(t.s)) return false;
    var x0 = t.x0, x1 = t.x1, y0 = t.y - t.fs, y1 = t.y, g = 0.4 * mU;
    var up = hs.some(function (h) { return h[2] < y0 + 1 && h[2] > y0 - g && h[0] <= x0 + 0.5 && h[1] >= x1 - 0.5; });
    var dn = hs.some(function (h) { return h[2] > y1 - 1 && h[2] < y1 + g && h[0] <= x0 + 0.5 && h[1] >= x1 - 0.5; });
    var lf = vs.some(function (v) { return v[2] < x0 + 1 && v[2] > x0 - g && v[0] <= y0 + 0.5 && v[1] >= y1 - 0.5; });
    var rt = vs.some(function (v) { return v[2] > x1 - 1 && v[2] < x1 + g && v[0] <= y0 + 0.5 && v[1] >= y1 - 0.5; });
    return up && dn && lf && rt;
  }).map(function (t) { return { s: t.s, c: [(t.x0 + t.x1) / 2, t.y - t.fs / 2] }; });
}
// the inventory of a PDF page for layout L (f = layout units per page point); saved as plan / current fields elements, elv
function elOfPage(lib, page, L, f) {
  return Promise.all([elRead(lib, page), pdfInk(lib, page)]).then(function (r) { return elInventory(r[0], L, f, r[1]); });
}
// layouts read before the inventory existed (or with an older one): read it from the stored PDF, once; desks, seat
// numbers and OSH are not touched
function backfillElements(db) {
  if (!LAYOUT || !LAYOUT.asIs || (LAYOUT.elv || 0) >= EL_V || !LAYOUT.desks || !LAYOUT.desks.length || !db) return;
  return db.collection('layouts').get().then(function (snap) {
    var recs = snap.docs.map(function (d) { return d.data(); }).filter(function (r) { return r && r.asset && /[.]pdf$/i.test(r.name || ''); })
      .sort(function (a, b) { return String(b.at || '').localeCompare(String(a.at || '')); });
    if (!recs.length) return;
    var url = '/_blob/' + recs[0].asset; if (window.__blobUrl) url = window.__blobUrl(url);
    var lib;
    return loadPdf().then(function (l) { lib = l; return fetch(url); }).then(function (r) { if (!r.ok) throw { code: 'fetch' }; return r.arrayBuffer(); })
      .then(function (buf) { return lib.getDocument({ data: new Uint8Array(buf) }).promise; })
      .then(function (pdf) { return pdf.getPage(1); })
      .then(function (pg) { return elOfPage(lib, pg, LAYOUT, LAYOUT.pscale || 1); })
      .then(function (E) {
        LAYOUT.elements = E; LAYOUT.elv = EL_V;
        if (window.__elReady) window.__elReady();
        return db.doc('plan/current').update({ elements: E, elv: EL_V });
      });
  }).catch(function () {});
}
// Teams = groups of desks less than 110 pt (about 2 m) apart. Numbered top to bottom, then left to right;
// seats inside a team top to bottom, then left to right.
// ang (optional): each desk's angle in degrees (a desk turned around its centre); kept in L.ang, in seat order
// chairs (optional): each desk's chair [x, y] as read from the drawing (null = not found): kept in L.chairs in seat order,
// the missing ones worked out by chairsFor
function buildLayout(D, name, box, ang, chairs) {
  D = D.map(function (d, i) { return [d[0], d[1], d[2], d[3], (ang && ang[i]) || 0, i]; });
  var par = D.map(function (_, i) { return i; });
  function f(i) { while (par[i] !== i) i = par[i] = par[par[i]]; return i; }
  for (var i = 0; i < D.length; i++) for (var j = 0; j < i; j++) {
    var a = D[i], b = D[j], gx = Math.max(0, Math.max(a[0], b[0]) - Math.min(a[2], b[2])), gy = Math.max(0, Math.max(a[1], b[1]) - Math.min(a[3], b[3]));
    if (Math.sqrt(gx * gx + gy * gy) < 110) par[f(i)] = f(j);
  }
  var groups = {};
  D.forEach(function (d, i) { (groups[f(i)] = groups[f(i)] || []).push(d); });
  var G = Object.keys(groups).map(function (k) {
    var ds = groups[k], x0 = Math.min.apply(null, ds.map(function (d) { return d[0]; })), y0 = Math.min.apply(null, ds.map(function (d) { return d[1]; }));
    return { ds: ds, x0: x0, y0: y0 };
  });
  G.sort(function (a, b) { return Math.round(a.y0 / 250) - Math.round(b.y0 / 250) || a.x0 - b.x0; });
  var E = [Infinity, Infinity, -Infinity, -Infinity];
  D.forEach(function (d) { E[0] = Math.min(E[0], d[0]); E[1] = Math.min(E[1], d[1]); E[2] = Math.max(E[2], d[2]); E[3] = Math.max(E[3], d[3]); });
  E = box ? [Math.floor(Math.min(E[0], box[0]) - 30), Math.floor(Math.min(E[1], box[1]) - 30), Math.ceil(Math.max(E[2], box[2]) + 30), Math.ceil(Math.max(E[3], box[3]) + 30)]
    : [Math.floor(E[0] - 150), Math.floor(E[1] - 150), Math.ceil(E[2] + 150), Math.ceil(E[3] + 150)];
  var out = [], sides = {}, outAng = [], outIdx = [];
  G.forEach(function (g, ti) {
    var t = ti + 1;
    g.ds.sort(function (a, b) { return Math.round((a[1] + a[3]) / 60) - Math.round((b[1] + b[3]) / 60) || (a[0] - b[0]); });
    g.ds.forEach(function (d) { out.push([d[0], d[1], d[2], d[3], 0]); outAng.push(d[4]); outIdx.push(d[5]); });   // no team until a program is uploaded or typed in
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    g.ds.forEach(function (d) { b[0] = Math.min(b[0], d[0]); b[1] = Math.min(b[1], d[1]); b[2] = Math.max(b[2], d[2]); b[3] = Math.max(b[3], d[3]); });
    sides[t] = sideOf(E, b, true);   // automatic layouts: every marker outside the building, on its nearest side
  });
  var base = String(name || 'New floor').replace(/\.[^.]+$/, '');
  var L = { extent: E, margin: 250, desks: out, sides: sides, teams: G.length, heading: 'Layout · ' + base, desc: 'The ' + base + ' floor plan' };
  if (outAng.some(function (a) { return Math.abs(a) >= 0.5; })) L.ang = outAng;
  if (chairs && chairs.some(Boolean)) {
    var guess = chairsFor(out, L.ang);
    L.chairs = outIdx.map(function (k, i) { return chairs[k] || guess[i] || null; });
  }
  return L;
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
