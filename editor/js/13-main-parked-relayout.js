  // ---- Parked markers (set by the user 24 Nov 2026): teams holding no desk get their markers in a tidy aligned grid
  // (same column x, equal row spacing) in blank space of the plan's own area (the viewBox renderLayout set, never grown),
  // as close to the drawing as possible: no desks, no ink of the plan picture, no other markers or their lines, no red flags.
  // Too many for one blank area: the biggest grid that fits goes nearest, the rest fill the next blank area.
  var PARK = {}, INK = null, INK_CELL = 16;
  // ink of the plan picture, read once (cells of 16 units: 1 = something drawn); null until read, false = cannot be read
  function loadInk(tries) {
    var im = document.getElementById('bgimage');
    if (!im) { INK = false; return; }
    var href = im.getAttribute('href') || '';
    if (!/^data:/.test(href) && (tries || 0) < 16) { setTimeout(function () { loadInk((tries || 0) + 1); }, 500); return; }
    var ix = +im.getAttribute('x'), iy = +im.getAttribute('y'), iw = +im.getAttribute('width'), ih = +im.getAttribute('height');
    var pic = new Image();
    pic.onload = function () {
      try {
        var k = 4, cw = Math.max(1, Math.ceil(iw / k)), ch = Math.max(1, Math.ceil(ih / k)), c = document.createElement('canvas');
        c.width = cw; c.height = ch;
        var ctx = c.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cw, ch); ctx.drawImage(pic, 0, 0, cw, ch);
        var px = ctx.getImageData(0, 0, cw, ch).data, step = INK_CELL / k, cols = Math.ceil(cw / step), rows = Math.ceil(ch / step), g = new Uint8Array(cols * rows);
        for (var y = 0; y < ch; y++) for (var x = 0; x < cw; x++) {
          var i = (y * cw + x) * 4;
          if (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2] < 238) g[Math.floor(y / step) * cols + Math.floor(x / step)] = 1;
        }
        INK = { x: ix, y: iy, cols: cols, rows: rows, g: g };
      } catch (e) { INK = false; }
      relayout();
    };
    pic.onerror = function () { INK = false; };
    pic.src = href;
  }
  function parkMarkers() {
    var ids = teamIds.filter(function (t) { return PARK[t]; }), items = [];
    ids.forEach(function (t) {
      var g = document.querySelector('#teams .team[data-t="' + t + '"]'); if (!g || g.style.display === 'none') return;
      var lead = document.querySelector('#teams .lead[data-t="' + t + '"]'); if (lead) lead.style.display = 'none';
      g.removeAttribute('transform');
      var b = markerBase(g), sh = g.querySelector('.short');
      // "seats short" right under its own pill, so in the grid it reads with the pill above it, not the one below
      if (sh) { if (sh.dataset.y0 === undefined) sh.dataset.y0 = sh.getAttribute('y'); sh.setAttribute('y', (b.y + 86).toFixed(1)); sh.setAttribute('x', b.x.toFixed(1)); sh.style.textAnchor = 'middle'; }
      var bx = svgBox(g); if (!bx) return;
      items.push({ g: g, b: b, r: { x0: bx.x0 - b.x, y0: bx.y0 - b.y, x1: bx.x1 - b.x, y1: bx.y1 - b.y } });
    });
    if (!items.length) return;
    var V = VB0, C = INK_CELL, GC = Math.ceil(V[2] / C), GR = Math.ceil(V[3] / C), occ = new Uint8Array(GC * GR);
    function mark(x0, y0, x1, y1) {
      var c0 = Math.max(0, Math.floor((x0 - V[0]) / C)), c1 = Math.min(GC - 1, Math.floor((x1 - V[0]) / C));
      var r0 = Math.max(0, Math.floor((y0 - V[1]) / C)), r1 = Math.min(GR - 1, Math.floor((y1 - V[1]) / C));
      for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) occ[r * GC + c] = 1;
    }
    // the drawing: desks, and the building (outline grid, else the picture's ink, else the desks' area)
    var BB = [Infinity, Infinity, -Infinity, -Infinity];
    allDesks.forEach(function (d) {
      var x = +d.dataset.x, y = +d.dataset.y, w = +d.dataset.w, h = +d.dataset.h;
      mark(x - 40, y - 40, x + w + 40, y + h + 40);
      BB = [Math.min(BB[0], x), Math.min(BB[1], y), Math.max(BB[2], x + w), Math.max(BB[3], y + h)];
    });
    if (!isFinite(BB[0])) BB = EXT.slice();
    if (SHELL) { for (var r = 0; r < GR; r++) for (var c = 0; c < GC; c++) if (cellAt(V[0] + (c + 0.5) * C, V[1] + (r + 0.5) * C) !== 1) occ[r * GC + c] = 1; }
    else if (INK) {
      for (var r2 = 0; r2 < INK.rows; r2++) for (var c2 = 0; c2 < INK.cols; c2++) if (INK.g[r2 * INK.cols + c2]) {
        var ax = INK.x + c2 * C, ay = INK.y + r2 * C; mark(ax - 24, ay - 24, ax + C + 24, ay + C + 24);
      }
    } else if (LAYOUT && LAYOUT.img) mark(EXT[0], EXT[1], EXT[2], EXT[3]);   // picture not readable: keep off the whole building
    else mark(BB[0] - 150, BB[1] - 150, BB[2] + 150, BB[3] + 150);
    // other markers and their lines, red flags
    document.querySelectorAll('#teams .team').forEach(function (g) {
      if (g.style.display === 'none' || PARK[g.dataset.t]) return;
      var b = svgBox(g); if (b) mark(b.x0 - MARK_GAP, b.y0 - MARK_GAP, b.x1 + MARK_GAP, b.y1 + MARK_GAP);
    });
    document.querySelectorAll('#teams .lead').forEach(function (l) {
      if (l.style.display === 'none' || PARK[l.dataset.t]) return;
      var x1 = +l.getAttribute('x1'), y1 = +l.getAttribute('y1'), x2 = +l.getAttribute('x2'), y2 = +l.getAttribute('y2');
      mark(Math.min(x1, x2) - 16, Math.min(y1, y2) - 16, Math.max(x1, x2) + 16, Math.max(y1, y2) + 16);
    });
    // one grid cell = the widest / tallest parked marker plus a gap; all markers centred in their cells
    var rx0 = Infinity, ry0 = Infinity, rx1 = -Infinity, ry1 = -Infinity;
    items.forEach(function (it) { rx0 = Math.min(rx0, it.r.x0); ry0 = Math.min(ry0, it.r.y0); rx1 = Math.max(rx1, it.r.x1); ry1 = Math.max(ry1, it.r.y1); });
    var hw = Math.max(-rx0, rx1);
    function tryPlace(k, gx, gy, any) {
      var cw = Math.ceil((2 * hw + gx) / C), chh = Math.ceil((ry1 - ry0 + gy) / C), best = null;
      // summed-area table: free blocks are found in one step each
      var S = new Int32Array((GC + 1) * (GR + 1));
      for (var r = 0; r < GR; r++) for (var c = 0; c < GC; c++) S[(r + 1) * (GC + 1) + c + 1] = (any ? 0 : occ[r * GC + c]) + S[r * (GC + 1) + c + 1] + S[(r + 1) * (GC + 1) + c] - S[r * (GC + 1) + c];
      function sum(c0, r0, c1, r1) { return S[r1 * (GC + 1) + c1] - S[r0 * (GC + 1) + c1] - S[r1 * (GC + 1) + c0] + S[r0 * (GC + 1) + c0]; }
      for (var cols = 1; cols <= k; cols++) {
        var rows = Math.ceil(k / cols), W = cols * cw, H = rows * chh;
        if (W > GC || H > GR) continue;
        for (var r0 = 0; r0 + H <= GR; r0++) for (var c0 = 0; c0 + W <= GC; c0++) {
          if (sum(c0, r0, c0 + W, r0 + H)) continue;
          var x0 = V[0] + c0 * C, y0 = V[1] + r0 * C, x1 = x0 + W * C, y1 = y0 + H * C;
          var gapX = Math.max(0, BB[0] - x1, x0 - BB[2]), gapY = Math.max(0, BB[1] - y1, y0 - BB[3]);
          var sc = Math.sqrt(gapX * gapX + gapY * gapY) * 3 + Math.hypot((x0 + x1) / 2 - (BB[0] + BB[2]) / 2, (y0 + y1) / 2 - (BB[1] + BB[3]) / 2) * 0.1 + (W + H) * C * 0.05;
          if (!best || sc < best.sc) best = { sc: sc, c0: c0, r0: r0, cols: cols, cw: cw, ch: chh };
        }
      }
      return best;
    }
    var left = items.slice(), guard = 0;
    while (left.length && guard++ < 20) {
      var pl = null, k = left.length;
      // the most markers one blank area holds (roomy spacing first, then tighter)
      for (; k >= 1 && !pl; k--) pl = tryPlace(k, 60, 40) || tryPlace(k, 24, 16);
      k++;
      if (!pl) { k = left.length; pl = tryPlace(k, 24, 16, true); }   // no blank area at all: still inside the plan's area
      if (!pl) break;
      left.splice(0, k).forEach(function (it, i) {
        var col = i % pl.cols, row = Math.floor(i / pl.cols);
        var cx = V[0] + (pl.c0 + col * pl.cw) * C + pl.cw * C / 2, top = V[1] + (pl.r0 + row * pl.ch) * C;
        var ty = top + (pl.ch * C - (ry1 - ry0)) / 2 - ry0;
        it.g.setAttribute('transform', 'translate(' + (cx - it.b.x).toFixed(1) + ' ' + (ty - it.b.y).toFixed(1) + ')');
      });
      mark(V[0] + pl.c0 * C, V[1] + pl.r0 * C, V[0] + (pl.c0 + pl.cols * pl.cw) * C - 1, V[1] + (pl.r0 + Math.ceil(k / pl.cols) * pl.ch) * C - 1);
    }
  }
  if (LAYOUT && LAYOUT.img && !SHELL) loadInk(0);
  function relayout() {
    PLACED = [];
    syncAdded();
    paintEds();   // rows made just now (e.g. while the plan is loading) get their names
    var any = false, claim = {}, homeUsed = {}, deskName = {}, deskTy = {};
    allDesks.forEach(function (d) { d.classList.remove('ov', 'empty', 'mv', 'free'); });
    document.querySelectorAll('tr.m.unused, tr.m.pgone').forEach(function (r) { r.classList.remove('unused', 'pgone'); });
    // Team numbers shown on screen skip deleted teams (T1, T2, … with no gaps).
    var shownNo = 0, shortList = [], noOf = {}, teamSum = [], pillLab = {};
    // the pill shows the team name (T-number only while the team has no name) and its head count, sized to fit
    // (head count added 19 Nov 2026, set by the user: the number only, no title)
    function setPill(t, n) {
      var mk = document.querySelector('#teams .team[data-t="' + t + '"] text:not(.tname):not(.short)'); if (!mk) return;
      var nmT = (cap(store.teams[t] || '').trim() || pillLab[t] || '') + '\u2002' + n;
      if (mk.textContent === nmT) return;
      mk.textContent = nmT;
      if (/[\u0590-\u05FF\u0600-\u06FF]/.test(nmT)) mk.setAttribute('direction', 'rtl'); else mk.removeAttribute('direction');
      var pr = mk.parentNode.querySelector('rect');
      if (pr) { try { var pw = Math.max(110, mk.getComputedTextLength() + 48), pcx = +pr.getAttribute('x') + +pr.getAttribute('width') / 2; pr.setAttribute('x', (pcx - pw / 2).toFixed(1)); pr.setAttribute('width', pw.toFixed(1)); } catch (e) {} }
    }
    teamIds.forEach(function (t) {
      if (store.deleted[t]) return;
      shownNo++; noOf[t] = shownNo;
      var lab = 'T' + shownNo;
      paintColor(document.querySelector('#teams .team[data-t="' + t + '"]'), teamColor(shownNo));
      paintColor(document.querySelector('tbody.grp[data-t="' + t + '"]'), teamColor(shownNo));
      pillLab[t] = lab;
      var fb = document.querySelector('tbody.grp[data-t="' + t + '"] .fold');
      if (fb) { fb.dataset.lab = lab; fb.setAttribute('aria-label', 'Open or close team ' + lab); if (fb.lastChild.nodeType === 3 && fb.lastChild.nodeValue !== '') fb.lastChild.nodeValue = ''; }
    });
    teamIds.forEach(function (t) {
      var all = Array.prototype.slice.call(document.querySelectorAll('#desks .dk[data-t="' + t + '"]'));
      var own = all.filter(function (d) { return !store.gone[d.dataset.s]; });
      all.forEach(function (d) { if (store.gone[d.dataset.s]) homeUsed[d.dataset.s] = homeUsed[d.dataset.s] || false; });
      var cnt = document.querySelector('.cnt[data-k="need"][data-id="' + t + '"]');
      if (cnt && !store.added[t]) { cnt.dataset.def = own.length; if (!store.need[t] && !cnt.querySelector('input')) cnt.textContent = own.length; }
      var need = needOf(t, own), mv = moveOf(t);
      if (!store.deleted[t]) setPill(t, need);
      var g = document.querySelector('#teams .team[data-t="' + t + '"]'), lead = document.querySelector('#teams .lead[data-t="' + t + '"]');
      var short = document.querySelector('#teams .team[data-t="' + t + '"] .short');
      var rows = Array.prototype.slice.call(document.querySelectorAll('#srows tr.m[data-s]')).filter(function (r) { return r.parentNode.dataset.t === t; });
      rows = rows.filter(function (r) { if (store.gone[r.dataset.s]) { r.classList.add('pgone'); return false; } return true; });
      // people rows show no number in the # column (kept in data-no for the Excel)
      rows.forEach(function (r, i) { r.dataset.no = i + 1; if (r.children[0].textContent !== '') r.children[0].textContent = ''; });
      var mine, gone = !!store.deleted[t], grp = document.querySelector('tbody.grp[data-t="' + t + '"]');
      g.style.display = gone ? 'none' : ''; if (lead) lead.style.display = gone ? 'none' : '';
      if (grp) grp.classList.toggle('gone', gone);
      if (gone) {
        CUR[t] = [];
        if (short) short.textContent = '';
        own.forEach(function (d) { homeUsed[d.dataset.s] = homeUsed[d.dataset.s] || false; });
        return;
      }
      var tnc = grp && grp.querySelector('.tn');
      teamSum.push({ t: t, no: noOf[t], name: cap(store.teams[t] || (tnc && !tnc.querySelector('input') ? tnc.textContent : '') || '').trim(), n: need });
      var asg = !mv && store.assign[t] ? store.assign[t] : null;
      if (asg) {
        mine = asg.map(function (id) { return deskBy[id]; }).filter(Boolean).slice(0, need);
        var same = own.length && mine.length && mine.every(function (d) { return d.dataset.t === t; });
        if (same) resetMarker(g, lead); else placeOutside(g, lead, mine);
      } else if (mv) {
        any = true;
        var byDist = allDesks.slice().sort(function (a, b) {
          var A = ctr(a), B = ctr(b);
          return (Math.pow(A.x - mv.x, 2) + Math.pow(A.y - mv.y, 2)) - (Math.pow(B.x - mv.x, 2) + Math.pow(B.y - mv.y, 2));
        });
        var nS = rows.filter(function (r, i) { return i < need && !store.pseat[r.dataset.s] && rowSingle(r.dataset.s); }).length;
        var nH = rows.filter(function (r, i) { return i < need && !store.pseat[r.dataset.s] && rowHidden(r.dataset.s); }).length;
        mine = byDist.filter(isSingleDesk).slice(0, nS);
        mine = mine.concat(byDist.filter(isOshDesk).slice(0, Math.min(nH, need - mine.length)));
        mine = mine.concat(benchFill(mv, need).filter(function (d) { return mine.indexOf(d) < 0; }).slice(0, need - mine.length));
        if (mine.length < need) mine = mine.concat(byDist.filter(function (d) { return mine.indexOf(d) < 0; }).slice(0, need - mine.length));
        if (dragT === t) {
          // while dragging, the marker follows the pointer
          var r0 = g.querySelector('rect'), hx = +r0.getAttribute('x') + +r0.getAttribute('width') / 2, hy = +r0.getAttribute('y') + 32;
          g.setAttribute('transform', 'translate(' + (mv.x - hx).toFixed(1) + ' ' + (mv.y - hy).toFixed(1) + ')');
          if (lead) lead.style.display = 'none';
        } else placeOutside(g, lead, mine);
      } else {
        resetMarker(g, lead);
        mine = own.slice(0, need);
      }
      // people dragged to a desk of their own (store.pseat) keep it; the others fill the team's desks in order
      // the others fill the team's desks in order: single-desk people (program type S / M / C, or seated at a single desk)
      // take its single desks, everyone else its connected desks; a desk left over goes to whoever still has none
      var held = [], usedD = {};
      rows.forEach(function (r, i) {
        r._desk = null; if (i >= need) return;
        var o = store.pseat[r.dataset.s];
        if (o && deskBy[o]) { r._desk = deskBy[o]; usedD[o] = 1; }
      });
      var pend = rows.filter(function (r, i) { return i < need && !r._desk; });
      // hid: true = only OSH desks, false = other desks first, then OSH ones; undefined = any
      function takeDesk(r, single, hid) {
        for (var pass = 0; pass < 2; pass++) for (var k = 0; k < mine.length; k++) {
          var d = mine[k]; if (usedD[d.dataset.s]) continue;
          if (single !== undefined && isSingleDesk(d) !== single) continue;
          if (hid !== undefined && pass === 0 && isOshDesk(d) !== hid) continue;
          if (hid === true && pass === 1) return;
          r._desk = d; usedD[d.dataset.s] = 1; return;
        }
      }
      // OSH people (program type OSH) take the team's OSH desks before anyone else: their own place if it is one
      rows.forEach(function (r, i) {
        if (i >= need || r._desk || !rowHidden(r.dataset.s)) return;
        var d = mine[i];
        if (d && !usedD[d.dataset.s] && isOshDesk(d)) { r._desk = d; usedD[d.dataset.s] = 1; }
      });
      rows.forEach(function (r, i) { if (i < need && !r._desk && rowHidden(r.dataset.s)) takeDesk(r, false, true); });
      // first everyone keeps their own place in the team's desk order (when it is the right kind of desk)
      rows.forEach(function (r, i) {
        if (i >= need || r._desk) return;
        var d = mine[i];
        if (d && !usedD[d.dataset.s] && isSingleDesk(d) === rowSingle(r.dataset.s)) { r._desk = d; usedD[d.dataset.s] = 1; }
      });
      pend = pend.filter(function (r) { return !r._desk; });
      pend.forEach(function (r) { var sg = rowSingle(r.dataset.s); takeDesk(r, sg, sg ? undefined : false); });
      // no desk of the right kind: keep one's own place if it is free, else any desk left
      pend.forEach(function (r) {
        if (r._desk) return;
        var own = mine[rows.indexOf(r)];
        if (own && !usedD[own.dataset.s]) { r._desk = own; usedD[own.dataset.s] = 1; } else takeDesk(r);
      });
      rows.forEach(function (r, i) { if (i < need && r._desk) held.push(r._desk); });
      if (rows.length < need) mine.slice(rows.length, need).forEach(function (d) { if (!usedD[d.dataset.s]) held.push(d); });
      mine.forEach(function (d) { if (held.indexOf(d) < 0 && d.dataset.t === t) homeUsed[d.dataset.s] = homeUsed[d.dataset.s] || false; });
      held.forEach(function (d) { if (mine.indexOf(d) < 0 && d.dataset.t !== t) d.classList.add('mv'); });
      mine = held;
      CUR[t] = mine.map(function (d) { return d.dataset.s; });
      if (short) short.textContent = need > mine.length ? (need - mine.length) + ' seats short' : '';
      if (need > mine.length) shortList.push('T' + noOf[t] + ' (' + (need - mine.length) + ')');
      mine.forEach(function (d) { (claim[d.dataset.s] = claim[d.dataset.s] || []).push(t); });
      // table: show as many people rows as seats needed; the Seat column shows the desk each one now has
      rows.forEach(function (r, i) {
        if (i >= need) { r.classList.add('unused'); return; }
        var seatCell = r.children[2], d = r._desk;
        seatCell.textContent = d ? d.dataset.s : '–';
        var tyCell = r.querySelector('td.ty');
        if (tyCell && !tyCell.querySelector('input')) {
          var tyx = store.ptype[r.dataset.s];
          tyCell.textContent = tyx || (d ? autoType(d) : '');
          tyCell.classList.toggle('auto', !tyx);
        }
        if (d && !(d.dataset.s in deskName)) deskName[d.dataset.s] = store.names[r.dataset.s] || '';
        if (d && store.ptype[r.dataset.s] && !deskTy[d.dataset.s]) deskTy[d.dataset.s] = store.ptype[r.dataset.s];
      });
      if (mv || asg) own.forEach(function (d) { homeUsed[d.dataset.s] = homeUsed[d.dataset.s] || false; });
      else own.forEach(function (d, i) { if (i >= need) homeUsed[d.dataset.s] = homeUsed[d.dataset.s] || false; });
      if (mv) mine.forEach(function (d) { if (d.dataset.t !== t) d.classList.add('mv'); });
    });
    allDesks.forEach(function (d) {
      var c = claim[d.dataset.s];
      paintColor(d, c && c.length === 1 ? teamColor(noOf[c[0]]) : null);
      if (c && c.length > 1) { d.classList.remove('mv'); d.classList.add('ov'); }
      else if (!c) d.classList.add('free');   // unused: white with the desk outline
    });
    // parked = a team holding no desk (Suggest found none, or never seated): its marker goes into the parking block
    PARK = {};
    teamIds.forEach(function (t) {
      if (!store.deleted[t] && t !== dragT && !(CUR[t] || []).length) { PARK[t] = true; return; }
      // no longer parked: its "seats short" goes back where it was (placed markers had it set again by setLabels)
      var g = document.querySelector('#teams .team[data-t="' + t + '"]'), sh = g && g.querySelector('.short');
      if (sh && sh.dataset.y0 !== undefined) { if (!g.dataset.side0) { sh.setAttribute('y', sh.dataset.y0); sh.setAttribute('x', markerBase(g).x.toFixed(1)); sh.style.textAnchor = ''; } delete sh.dataset.y0; }
    });
    spreadMarkers();
    clearMarkers();
    parkMarkers();
    // red flags last, off every marker
    if (LAYOUT && Array.isArray(LAYOUT.flags) && LAYOUT.flags.length) {
      var avoid = [];
      document.querySelectorAll('#teams .team').forEach(function (g) { if (g.style.display === 'none') return; var bx = svgBox(g); if (bx) avoid.push({ x0: bx.x0 - MARK_GAP, y0: bx.y0 - MARK_GAP, x1: bx.x1 + MARK_GAP, y1: bx.y1 + MARK_GAP }); });
      drawFlags(LAYOUT, avoid);
    }
    fitView();
    paintShade();
    // a selected person (orange row) and a selected desk follow the person to their desk now
    document.querySelectorAll('#desks .dk.ts').forEach(function (d) { d.classList.remove('ts'); });
    document.querySelectorAll('#srows tr.m.sh').forEach(function (r) {
      var s0 = deskOfRow(r); if (s0 && deskBy[s0] && !r.classList.contains('unused') && !r.classList.contains('pgone')) deskBy[s0].classList.add('ts');
    });
    var hr = document.querySelector('#srows tr.m.hi');
    if (hr) {
      var s1 = deskOfRow(hr);
      document.querySelectorAll('#desks .dk.hi').forEach(function (d) { if (d.dataset.s !== s1) d.classList.remove('hi'); });
      if (s1 && deskBy[s1]) deskBy[s1].classList.add('hi');
    }
    DESKNAME = deskName; paintDeskNames();
    allDesks.forEach(function (d) { d.classList.toggle('hasp', d.dataset.s in deskName); });
    var sm = document.getElementById('shortmsg');
    sm.textContent = shortList.length ? 'Seats short: ' + shortList.join(', ') + '.' : '';
    sm.hidden = !shortList.length;
    alignProgram();
    var used = Object.keys(claim).length;
    document.getElementById('totused').textContent = used;
    document.getElementById('totfree').textContent = allDesks.length - used;
    // seats by type: a desk's type is the program type of the person sitting there, else its own (OSH, S or OS)
    var byTy = {}, sets = { all: { total: [], used: [], free: [] } };
    allDesks.forEach(function (d) {
      var s0 = d.dataset.s, ty = deskTy[s0] || autoType(d), k = claim[s0] ? 'used' : 'free';
      var g = byTy[ty] = byTy[ty] || { total: [], used: [], free: [] };
      g.total.push(s0); g[k].push(s0); sets.all.total.push(s0); sets.all[k].push(s0);
    });
    Object.keys(byTy).forEach(function (t) { sets[t] = byTy[t]; });
    TYSETS = sets;
    renderSummary(allDesks.length, used, teamSum, sets);
    paintTyHi();
    alignProgram();
  }
  // seat-type tiles: pressing one lights its desks on the plan (TYHI = { t: type or 'all', k: total / used / free })
  var TYHI = null, TYSETS = {};
  var TY_NAMES = { OS: 'Open space', OSH: 'Open space hidden', S: 'Single room', M: 'Manager room', C: 'C-level room' };
  R_TYPES.forEach(function (t) { TY_NAMES[t] = 'Room for ' + t.slice(1); });
  var TY_ORDER = ['OS', 'OSH', 'S', 'M', 'C'].concat(R_TYPES);
  function paintTyHi() {
    var on = {}, g = TYHI && TYSETS[TYHI.t];
    if (TYHI && !g) TYHI = null;
    if (g) g[TYHI.k].forEach(function (s0) { on[s0] = 1; });
    allDesks.forEach(function (d) { d.classList.toggle('tyhi', !!on[d.dataset.s]); });
    document.querySelectorAll('#summ [data-ty]').forEach(function (b) { b.setAttribute('aria-pressed', TYHI && b.dataset.ty === TYHI.t && b.dataset.k === TYHI.k ? 'true' : 'false'); });
  }
  // Program summary: seats used / available as tiles and a bar, then every group with its number of people
  function renderSummary(total, used, teams, sets) {
    sets = sets || {};
    window.__lastSum = { total: total, used: used, teams: teams, types: TY_ORDER.filter(function (t) { return sets[t]; }).map(function (t) { return { t: t, name: TY_NAMES[t], total: sets[t].total.length, used: sets[t].used.length, free: sets[t].free.length }; }) };
    var el = document.getElementById('summ'); if (!el) return;
    var free = Math.max(0, total - used), pct = total ? Math.round(used * 100 / total) : 0, over = used > total;
    var people = teams.reduce(function (a, x) { return a + (x.n || 0); }, 0);
    function esc(v) { return String(v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    el.innerHTML =
      '<div class="sum-stats">'
      + '<button type="button" class="st" data-ty="all" data-k="total" aria-pressed="false" title="Show all seats on the plan"><b>' + total + '</b><span>Total seats</span></button>'
      + '<button type="button" class="st used" data-ty="all" data-k="used" aria-pressed="false" title="Show the used seats on the plan"><b>' + used + '</b><span>Used</span></button>'
      + '<button type="button" class="st free" data-ty="all" data-k="free" aria-pressed="false" title="Show the available seats on the plan"><b>' + free + '</b><span>Available</span></button>'
      + '</div>'
      + (function () {
          var ts = TY_ORDER.filter(function (t) { return sets[t] && sets[t].total.length; });
          if (!ts.length) return '';
          return '<div class="sum-types" role="group" aria-label="Seats by type"><span></span><span class="th">Total</span><span class="th">Used</span><span class="th">Available</span>'
            + ts.map(function (t) {
              var g = sets[t], nm = TY_NAMES[t];
              return '<span class="tl">' + esc(nm) + '<small>' + t + '</small></span>'
                + [['total', 'Total'], ['used', 'Used'], ['free', 'Available']].map(function (k) {
                  return '<button type="button" class="tt ' + k[0] + '" data-ty="' + t + '" data-k="' + k[0] + '" aria-pressed="false" aria-label="' + esc(nm + ' · ' + k[1] + ': ' + g[k[0]].length) + '" title="Show ' + esc(nm.toLowerCase() + ' · ' + k[1].toLowerCase()) + ' on the plan">' + g[k[0]].length + '</button>';
                }).join('');
            }).join('') + '</div>';
        })()
      + (teams.length ? '<ul class="sum-teams">' + teams.map(function (x) {
          var col = teamColor(x.no);
          return '<li class="tb"><button type="button" class="tbtn" data-t="' + esc(x.t) + '" aria-pressed="' + (SHADED[x.t] ? 'true' : 'false') + '" style="--tc:' + col.c + ';--tci:' + col.ink + '"><span class="tnm">' + esc(x.name || 'Group ' + x.no) + '</span><span class="tct">' + x.n + '</span></button></li>';
        }).join('') + '</ul>' : '');
  }
