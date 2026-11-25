// ---- The building's shell and core, read from the plan picture, for placing team markers.
// Outside = everything reachable from the edge of the drawing without crossing a drawn line (walls, facade).
// Core = the biggest connected block of thick grey walls (the concrete core).
// Saved as a grid of 8 pt cells: L.shell = { x, y, cell, cols, rows, out } (out = run lengths, inside first), L.core = [x0, y0, x1, y1].
function buildingShell(page, E, pf) {
  var R = [E[0] - 250, E[1] - 250, E[2] + 250, E[3] + 250], W = R[2] - R[0], H = R[3] - R[1];
  var s = Math.min(1, Math.sqrt(8e6 / (W * H)));
  var vp = page.getViewport({ scale: s * (pf || 1), offsetX: -R[0] * s, offsetY: -R[1] * s });
  var cw = Math.round(W * s), ch = Math.round(H * s);
  var c = document.createElement('canvas'); c.width = cw; c.height = ch;
  var ctx = c.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cw, ch);
  return page.render({ canvasContext: ctx, viewport: vp }).promise.then(function () {
    var px = ctx.getImageData(0, 0, cw, ch).data, N = cw * ch, lum = new Uint8Array(N);
    for (var i = 0; i < N; i++) lum[i] = (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) | 0;
    // walls and lines, thickened by about 3 pt so small gaps in a line still close it
    var r = Math.max(1, Math.round(3 * s)), ink = new Uint8Array(N), tmp = new Uint8Array(N);
    for (i = 0; i < N; i++) ink[i] = lum[i] < 232 ? 1 : 0;
    for (var y = 0; y < ch; y++) { var run = -1e9; for (var x = 0; x < cw; x++) { if (ink[y * cw + x]) run = x; tmp[y * cw + x] = x - run <= r ? 1 : 0; } run = 1e9; for (x = cw - 1; x >= 0; x--) { if (ink[y * cw + x]) run = x; if (run - x <= r) tmp[y * cw + x] = 1; } }
    for (x = 0; x < cw; x++) { run = -1e9; for (y = 0; y < ch; y++) { if (tmp[y * cw + x]) run = y; ink[y * cw + x] = y - run <= r ? 1 : 0; } run = 1e9; for (y = ch - 1; y >= 0; y--) { if (tmp[y * cw + x]) run = y; if (run - y <= r) ink[y * cw + x] = 1; } }
    // outside: flood from the edges of the picture through blank paper
    var out = new Uint8Array(N), q = new Int32Array(N), qh = 0, qt = 0;
    function seed(k) { if (!ink[k] && !out[k]) { out[k] = 1; q[qt++] = k; } }
    for (x = 0; x < cw; x++) { seed(x); seed((ch - 1) * cw + x); }
    for (y = 0; y < ch; y++) { seed(y * cw); seed(y * cw + cw - 1); }
    while (qh < qt) { var k = q[qh++], kx = k % cw; if (kx > 0) seed(k - 1); if (kx < cw - 1) seed(k + 1); if (k >= cw) seed(k - cw); if (k < N - cw) seed(k + cw); }
    // core: thick grey (not white, not black line edges), kept only where a 5 pt square is all grey
    var g = new Uint8Array(N);
    for (i = 0; i < N; i++) g[i] = lum[i] >= 60 && lum[i] <= 185 ? 1 : 0;
    var e = Math.max(1, Math.round(2.5 * s)), gx = new Uint8Array(N);
    for (y = 0; y < ch; y++) { var cnt = 0; for (x = 0; x < cw; x++) { cnt = g[y * cw + x] ? cnt + 1 : 0; gx[y * cw + x] = cnt > 2 * e ? 1 : 0; } }
    var gg = new Uint8Array(N);
    for (x = 0; x < cw; x++) { cnt = 0; for (y = 0; y < ch; y++) { cnt = gx[y * cw + x] ? cnt + 1 : 0; if (cnt > 2 * e) gg[y * cw + x] = 1; } }
    // connected grey blocks (joined across gaps of up to 4 cells of 4 pt); the one with the largest outline is the core
    var cs = Math.max(1, Math.round(4 * s)), gc = Math.ceil(cw / cs), gr = Math.ceil(ch / cs), cell = new Uint8Array(gc * gr);
    for (y = 0; y < ch; y++) for (x = 0; x < cw; x++) if (gg[y * cw + x]) cell[((y / cs) | 0) * gc + ((x / cs) | 0)] = 1;
    var lab = new Int32Array(gc * gr), best = null, nl = 0, comps = [];
    for (var c0 = 0; c0 < gc * gr; c0++) {
      if (!cell[c0] || lab[c0]) continue;
      nl++; var st = [c0], bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1, n = 0; lab[c0] = nl;
      while (st.length) {
        var cc = st.pop(), cx = cc % gc, cy = (cc / gc) | 0; n++;
        if (cx < bx0) bx0 = cx; if (cx > bx1) bx1 = cx; if (cy < by0) by0 = cy; if (cy > by1) by1 = cy;
        for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
          var nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= gc || ny >= gr) continue;
          var nk = ny * gc + nx; if (cell[nk] && !lab[nk]) { lab[nk] = nl; st.push(nk); }
        }
      }
      var area = (bx1 - bx0 + 1) * (by1 - by0 + 1);
      if (n > 60) { comps.push({ area: area, b: [bx0, by0, bx1 + 1, by1 + 1] }); if (!best || area > best.area) best = comps[comps.length - 1]; }
    }
    var core = null;
    if (best) {
      // the core can be several big wall blocks with corridors between them: join big blocks within about 320 pt
      var U = best.b.slice(), grew = true;
      while (grew) {
        grew = false;
        comps.forEach(function (k) {
          if (k.used || k === best || k.area < 0.15 * best.area) return;
          var gx = Math.max(0, Math.max(U[0], k.b[0]) - Math.min(U[2], k.b[2])), gy = Math.max(0, Math.max(U[1], k.b[1]) - Math.min(U[3], k.b[3]));
          if (gx * cs / s <= 320 && gy * cs / s <= 320) { k.used = true; grew = true; U = [Math.min(U[0], k.b[0]), Math.min(U[1], k.b[1]), Math.max(U[2], k.b[2]), Math.max(U[3], k.b[3])]; }
        });
      }
      best = { area: best.area, b: U };
      core = best.b.map(function (v, i) { return Math.round((i % 2 ? R[1] : R[0]) + v * cs / s); });
      // a real core is a large block well inside the building
      if (core[2] - core[0] < 150 || core[3] - core[1] < 150) core = null;
    }
    // every enclosed space inside the building (a room, an open space) gets its own number
    var sp = new Int32Array(N), nsp = 1;
    for (i = 0; i < N; i++) {
      if (ink[i] || out[i] || sp[i]) continue;
      nsp++; sp[i] = nsp; qh = 0; qt = 0; q[qt++] = i;
      while (qh < qt) {
        k = q[qh++]; kx = k % cw;
        if (kx > 0 && !ink[k - 1] && !sp[k - 1]) { sp[k - 1] = nsp; q[qt++] = k - 1; }
        if (kx < cw - 1 && !ink[k + 1] && !sp[k + 1]) { sp[k + 1] = nsp; q[qt++] = k + 1; }
        if (k >= cw && !ink[k - cw] && !sp[k - cw]) { sp[k - cw] = nsp; q[qt++] = k - cw; }
        if (k < N - cw && !ink[k + cw] && !sp[k + cw]) { sp[k + cw] = nsp; q[qt++] = k + cw; }
      }
    }
    // a grid of 8 pt cells: 1 = outside, 2+ = a space, 0 = walls and furniture; saved as value.run pairs
    var CELL = 8, cols = Math.ceil(W / CELL), rows = Math.ceil(H / CELL), runs = [], cur = -1, len = 0;
    for (var ry = 0; ry < rows; ry++) for (var rx = 0; rx < cols; rx++) {
      var votes = {}, tot = 0, o = 0;
      for (var sy = Math.floor(ry * CELL * s); sy < Math.min(ch, Math.floor((ry + 1) * CELL * s)); sy++)
        for (var sx = Math.floor(rx * CELL * s); sx < Math.min(cw, Math.floor((rx + 1) * CELL * s)); sx++) {
          var kk = sy * cw + sx; tot++;
          if (out[kk]) o++; else if (sp[kk]) votes[sp[kk]] = (votes[sp[kk]] || 0) + 1;
        }
      var v = 0, bestv = 0;
      if (tot && o * 2 >= tot) v = 1;
      else Object.keys(votes).forEach(function (lb) { if (votes[lb] > bestv) { bestv = votes[lb]; v = +lb; } });
      if (v !== 1 && bestv * 4 < tot) v = 0;
      if (v === cur) len++; else { if (len) runs.push(cur.toString(36) + '.' + len.toString(36)); cur = v; len = 1; }
    }
    runs.push(cur.toString(36) + '.' + len.toString(36));
    return { shell: { x: R[0], y: R[1], cell: CELL, cols: cols, rows: rows, v: 2, grid: runs.join(',') }, core: core };
  });
}
// A layout saved before shells were read: read the shell from its uploaded PDF and save it (seating untouched).
function backfillShell(db) {
  if (!LAYOUT || LAYOUT.asIs || LAYOUT.shell || !LAYOUT.desks || !LAYOUT.desks.length || !db) return;
  db.collection('layouts').get().then(function (snap) {
    var recs = snap.docs.map(function (d) { return d.data(); }).filter(function (r) { return r && r.asset && /[.]pdf$/i.test(r.name || ''); })
      .sort(function (a, b) { return String(b.at || '').localeCompare(String(a.at || '')); });
    if (!recs.length) return;
    var url = '/_blob/' + recs[0].asset; if (window.__blobUrl) url = window.__blobUrl(url);
    var lib;
    return loadPdf().then(function (l) { lib = l; return fetch(url); }).then(function (r) { if (!r.ok) throw { code: 'fetch' }; return r.arrayBuffer(); })
      .then(function (buf) { return lib.getDocument({ data: new Uint8Array(buf) }).promise; })
      .then(function (pdf) { return pdf.getPage(1); })
      .then(function (pg) { return buildingShell(pg, LAYOUT.extent, LAYOUT.pscale); })
      .then(function (res) {
        LAYOUT.shell = res.shell; LAYOUT.core = res.core;
        if (window.__shellReady) window.__shellReady();
        return db.doc('plan/current').update({ shell: res.shell, core: res.core });
      });
  }).catch(function () {});
}
// a new floor makes the old seat numbers meaningless: clear names, seats and moves of the drawn teams; keep added teams
function clearOldSeating(db) {
  var raw = db && db.__raw ? db.__raw : db;
  var cols = ['names', 'teams', 'need', 'moves', 'assign', 'deleted', 'gone', 'flags', 'pseat', 'pkind'], p = Promise.resolve();
  MS.list.forEach(function (m) {
    cols.forEach(function (c0) {
      var c = msCol(c0, m.id);
      p = p.then(function () { return raw.collection(c).get(); }).then(function (snap) {
        var q = Promise.resolve();
        snap.docs.forEach(function (d) { if (c0 === 'assign' || c0 === 'moves' || c0 === 'pseat' || c0 === 'pkind' || /^[0-9]+(-x[0-9]+)?$/.test(d.id)) q = q.then(function () { return raw.collection(c).doc(d.id).delete(); }); });
        return q;
      });
    });
  });
  return p;
}
window.__autoLayout = function (file, db, recId) {
  if (!db) { lnote('Layout received, but automatic analysis needs the page database. Ask Claude to “process the new layout”.'); return; }
  ANALYZING = true;
  var lib, page, L;
  lnote('Analyzing ' + file.name + '… reading the drawing', true);
  loadPdf().then(function (l) { lib = l; return file.arrayBuffer(); })
    .then(function (buf) { return lib.getDocument({ data: new Uint8Array(buf) }).promise; })
    .then(function (pdf) { return pdf.getPage(1); })
    .then(function (p) { page = p; return readDesks(lib, page); })
    .then(function (R) {
      var D = R.D;
      if (D.length < 2) throw { code: 'nodesks' };
      // the uploaded drawing is kept as it is (whole page, its own colours, no outline or core drawn): only the desks are added
      L = buildLayout(D, file.name, R.box, R.ang, R.chairs);
      L.pscale = R.f; L.scale = R.n; L.asIs = true;
      lnote('Found ' + D.length + ' desks. Drawing the plan…', true);
      return oshFromPage(lib, page, R.f, L.desks, L.ang, L.chairs).then(function (res) { L.osh = res.osh; L.oshv = OSH_V; if (res.ask.length) L.flags = oshFlags([], res.ask); }, function () { L.osh = []; })
        .then(function () { lnote('Found ' + D.length + ' desks. Listing the elements (C3)…', true); return elOfPage(lib, page, L, R.f).then(function (E) { L.elements = E; L.elv = EL_V; }, function () {}); })
        .then(function () { return planPicture(page, L.extent, L.pscale, true); });
    })
    .then(function (png) { return window.claude.use('assets').then(function (a) { if (!a) throw { code: 'not_granted' }; return a.upload(png, { type: 'image/png' }); }); })
    .then(function (up) {
      L.img = '/_blob/' + up.id; L.imgAsset = up.id; L.v = Date.now(); L.source = recId || ''; L.file = file.name;
      lnote('Saving the new layout…', true);
      return clearOldSeating(db).then(function () { return db.doc('plan/current').set(L); });
    })
    .then(function () {
      if (recId) db.collection('layouts').doc(recId).update({ status: 'done (automatic)', seats: L.desks.length, teams: L.teams }).catch(function () {});
      try { localStorage.removeItem(EMBED.lskey); localStorage.removeItem(EMBED.lskey + ':undo'); } catch (e) {}
      lnote('Done: ' + L.desks.length + ' seats. Loading the new plan… (reload the page if it does not appear)', true);
      setTimeout(function () { location.reload(); }, 900);
    })
    .catch(function (e) {
      ANALYZING = false;
      var c = e && e.code;
      if (recId) db.collection('layouts').doc(recId).update({ status: 'waiting for Claude' }).catch(function () {});
      lnote(c === 'nodesks' ? 'No desks could be found in ' + file.name + '. Ask Claude to “process the new layout”.'
        : c === 'not_granted' ? 'Saving the plan needs edit access to this page.'
        : c === 'load' ? 'The PDF reader could not load. Check the connection and upload again.'
        : 'The layout could not be analyzed automatically. Ask Claude to “process the new layout”.');
    });
};

