  // ---- Moving teams: drag a marker. Only the team (and its seats needed) moves; the desks stay.
  // On drop the team takes the desks nearest the drop point. Desks another team already uses
  // turn red (overlap); the team's old desks that nobody uses any more get a red outline (empty).
  var dragT = null, justDragged = false;
  function moveOf(t) { return store.moves[t] || null; }
  function ctr(d) { return { x: +d.dataset.x + +d.dataset.w / 2, y: +d.dataset.y + +d.dataset.h / 2 }; }
  function needOf(t, own) {
    if (store.added[t]) return +(store.need[t] || 0);
    var c = document.querySelector('.cnt[data-k="need"][data-id="' + t + '"]');
    return +(store.need[t] || (c && c.dataset.def) || own.length);
  }
  // ---- Added teams: created with "+", listed at the bottom, marker parked under the plan until dragged in.
  var baseIds = teamIds.slice(), SVGNS = 'http://www.w3.org/2000/svg';
  var EXT = document.getElementById('plan').dataset.ext.split(' ').map(Number);
  // A layout kept as uploaded (asIs) has the whole sheet as its extent: the Revit / CAD frame, title block and
  // notes around the plan included. For team markers the building is the desks' area plus the facade walls
  // (BLD_PAD) and every marker goes outside it (no interior markers), never out by the sheet frame.
  var ASIS = !!(LAYOUT && LAYOUT.asIs), BLD_PAD = 150;
  if (ASIS && LAYOUT.desks && LAYOUT.desks.length) {
    var bx = [Infinity, Infinity, -Infinity, -Infinity];
    LAYOUT.desks.forEach(function (d) { bx[0] = Math.min(bx[0], d[0]); bx[1] = Math.min(bx[1], d[1]); bx[2] = Math.max(bx[2], d[2]); bx[3] = Math.max(bx[3], d[3]); });
    EXT = [Math.max(EXT[0], bx[0] - BLD_PAD), Math.max(EXT[1], bx[1] - BLD_PAD), Math.min(EXT[2], bx[2] + BLD_PAD), Math.min(EXT[3], bx[3] + BLD_PAD)];
  }
  function addedIds() { return Object.keys(store.added).sort(function (a, b) { return store.added[a].order - store.added[b].order; }); }
  function esc(v) { return String(v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function personRow(pid, i) {
    return '<tr data-s="' + esc(pid) + '" class="m" hidden><td class="num">' + i + '</td><td class="nm ed" data-k="names" data-id="' + esc(pid) + '" title="Double-click to edit"></td><td class="num">–</td><td class="num ty" title="Click to choose the type: OS, OSH, S, M, C or R2–R10"></td><td class="del"><button type="button" class="delbtn" data-s="' + esc(pid) + '" aria-label="Delete this person">Delete</button></td></tr>';
  }
  function syncAdded() {
    var ids = addedIds(), tbl = document.getElementById('srows'), tg = document.getElementById('teams');
    document.querySelectorAll('tbody.grp[data-added]').forEach(function (b) { if (!store.added[b.dataset.t]) b.remove(); });
    document.querySelectorAll('#teams .team[data-added], #teams .lead[data-added]').forEach(function (g) { if (!store.added[g.dataset.t]) g.remove(); });
    ids.forEach(function (t, k) {
      var grp = document.querySelector('tbody.grp[data-t="' + t + '"]');
      if (!grp) {
        grp = document.createElement('tbody');
        grp.className = 'grp'; grp.dataset.t = t; grp.dataset.added = '1';
        grp.innerHTML = '<tr class="gh"><td><button type="button" class="fold" aria-expanded="false"><span class="car" aria-hidden="true"></span>T</button></td><td class="tn ed" data-k="teams" data-id="' + esc(t) + '" title="Double-click to edit"></td><td class="num cnt ed" data-k="need" data-id="' + esc(t) + '" data-def="" title="Double-click to edit"></td><td></td><td class="del"><span class="acts"><button type="button" class="addbtn tip" data-tip="add team member" data-t="' + esc(t) + '" aria-label="Add a person to this team">+</button><button type="button" class="delbtn" data-t="' + esc(t) + '" aria-label="Delete this team">Delete</button></span></td></tr>';
        tbl.appendChild(grp);
      } else tbl.appendChild(grp);
      // people rows: one per seat needed
      var n = Math.max(0, Math.min(500, +(store.need[t] || 0)));
      var rows = grp.querySelectorAll('tr.m'), open = grp.querySelector('.fold').getAttribute('aria-expanded') === 'true';
      for (var i = rows.length; i < n; i++) { grp.insertAdjacentHTML('beforeend', personRow(t + '-' + (i + 1), i + 1)); grp.lastChild.hidden = !open; }
      for (var j = rows.length - 1; j >= n; j--) rows[j].remove();
      var g = document.querySelector('#teams .team[data-t="' + t + '"]');
      if (!g) {
        // park it close under the plan, 680 pt apart, in rows 300 pt apart, skipping spots taken by other markers
        var cy = EXT[3] + 140, cx = EXT[0] + 180, taken2, rowGuard = 0;
        var rowTaken = function (y) {
          var out = [];
          document.querySelectorAll('#teams .team').forEach(function (o) {
            var r = o.querySelector('rect'); if (!r || o.style.display === 'none') return;
            var ox = +r.getAttribute('x') + +r.getAttribute('width') / 2, oy = +r.getAttribute('y') + 32;
            if (Math.abs(oy - y) < 120) out.push(ox);
          });
          return out;
        };
        while (rowGuard++ < 200) {
          taken2 = rowTaken(cy);
          while (taken2.some(function (ox) { return Math.abs(ox - cx) < 680; })) cx += 680;
          if (cx <= EXT[2] + 150 || cx === EXT[0] + 180) break;
          cx = EXT[0] + 180; cy += 300;
        }
        g = document.createElementNS(SVGNS, 'g');
        g.setAttribute('class', 'team'); g.setAttribute('data-t', t); g.setAttribute('data-added', '1');
        g.setAttribute('role', 'button'); g.setAttribute('tabindex', '0'); g.setAttribute('aria-pressed', 'false');
        g.innerHTML = '<rect x="' + (cx - 60) + '" y="' + (cy - 32) + '" width="120" height="64" rx="32"></rect><text x="' + cx + '" y="' + cy + '">T</text><text class="tname" x="' + cx + '" y="' + (cy + 100) + '"></text><text class="short" x="' + cx + '" y="' + (cy + 154) + '"></text>';
        var ln = document.createElementNS(SVGNS, 'line');
        ln.setAttribute('class', 'lead'); ln.setAttribute('data-t', t); ln.setAttribute('data-added', '1');
        ['x1', 'y1', 'x2', 'y2'].forEach(function (k) { ln.setAttribute(k, k[0] === 'x' ? cx : cy); });
        tg.appendChild(ln);
        tg.appendChild(g);
        if (window.__scaleMarkers) window.__scaleMarkers();
      }
    });
    // base teams: extra people rows when seats needed is more than the team's desks
    baseIds.forEach(function (t) {
      var grp = document.querySelector('tbody.grp[data-t="' + t + '"]'); if (!grp) return;
      var deskRows = Array.prototype.slice.call(grp.querySelectorAll('tr.m:not([data-extra])')).filter(function (r) { return !store.gone[r.dataset.s]; });
      var need = store.need[t] !== undefined && store.need[t] !== '' ? +store.need[t] : deskRows.length;
      var want = Math.max(0, Math.min(500, need - deskRows.length));
      var extra = grp.querySelectorAll('tr.m[data-extra]'), open = grp.querySelector('.fold').getAttribute('aria-expanded') === 'true';
      for (var i = extra.length; i < want; i++) {
        grp.insertAdjacentHTML('beforeend', personRow(t + '-x' + (i + 1), 0));
        grp.lastChild.setAttribute('data-extra', '1'); grp.lastChild.hidden = !open;
      }
      for (var j = extra.length - 1; j >= want; j--) extra[j].remove();
    });
    teamIds.length = 0;
    baseIds.concat(ids).forEach(function (t) { teamIds.push(t); });
  }
  var allDesks = Array.prototype.slice.call(document.querySelectorAll('#desks .dk'));
  var deskBy = {}; allDesks.forEach(function (d) { deskBy[d.dataset.s] = d; });
  // Benches = groups of desks that touch each other.
  var BENCH = (function () {
    var par = allDesks.map(function (_, i) { return i; });
    function f(i) { while (par[i] !== i) i = par[i] = par[par[i]]; return i; }
    var R = allDesks.map(function (d) { return { x: +d.dataset.x, y: +d.dataset.y, w: +d.dataset.w, h: +d.dataset.h }; });
    for (var i = 0; i < R.length; i++) for (var j = 0; j < i; j++) {
      var a = R[i], b = R[j], tol = 2.5;
      if (a.x - tol < b.x + b.w && b.x - tol < a.x + a.w && a.y - tol < b.y + b.h && b.y - tol < a.y + a.h) par[f(i)] = f(j);
    }
    var map = {}, out = [];
    allDesks.forEach(function (d, i) { var r = f(i); if (!(r in map)) { map[r] = out.length; out.push({ desks: [] }); } out[map[r]].desks.push(d); d.dataset.bench = map[r]; });
    out.forEach(function (b) { var c = b.desks.map(ctr); b.x = c.reduce(function (s, p) { return s + p.x; }, 0) / c.length; b.y = c.reduce(function (s, p) { return s + p.y; }, 0) / c.length; });
    return out;
  })();
  // A single desk touches no other desk (a bench of one). A person "sits at a single desk" when the program gives
  // their type as S, M or C, or (no type given) when they sat at a single desk when the team last moved or Suggest ran.
  // leave out benches the team does not need: while the other benches still hold everyone, drop the last-listed one
  function pruneBenches(list, n, size) {
    var out = list.slice(), tot = out.reduce(function (s, i) { return s + size(i); }, 0), changed = true;
    while (changed && out.length > 1) {
      changed = false;
      for (var k = out.length - 1; k >= 0; k--) if (tot - size(out[k]) >= n) { tot -= size(out[k]); out.splice(k, 1); changed = true; break; }
    }
    return out;
  }
  // a moved team takes the benches nearest the drop point, filling each bench before the next (rule 5)
  function benchFill(pt, n) {
    if (n <= 0) return [];
    var bs = []; BENCH.forEach(function (b, i) { if (b.desks.length > 1) bs.push(i); });
    bs.sort(function (a, b) { return Math.hypot(BENCH[a].x - pt.x, BENCH[a].y - pt.y) - Math.hypot(BENCH[b].x - pt.x, BENCH[b].y - pt.y); });
    var pickB = [], tot = 0;
    for (var k0 = 0; k0 < bs.length && tot < n; k0++) { pickB.push(bs[k0]); tot += BENCH[bs[k0]].desks.length; }
    bs = pruneBenches(pickB, n, function (i) { return BENCH[i].desks.length; });
    var out = [];
    for (var k = 0; k < bs.length && out.length < n; k++) {
      var ds = BENCH[bs[k]].desks.slice().sort(function (a, b) { var A = ctr(a), B = ctr(b); return Math.hypot(A.x - pt.x, A.y - pt.y) - Math.hypot(B.x - pt.x, B.y - pt.y); });
      out = out.concat(ds.slice(0, n - out.length));
    }
    return out;
  }
  function isSingleDesk(d) { return !!d && !!BENCH[+d.dataset.bench] && BENCH[+d.dataset.bench].desks.length === 1; }
  // S, M, C and R2…R10 (closed-room desks) all sit at single desks
  function rowSingle(id) { var ty = store.ptype[id]; if (ty) return ty !== 'OS' && ty !== 'OSH'; return !!store.pkind[id]; }
  // OSH: open-space desks with nothing behind the seat (found when the layout is read: LAYOUT.osh = seat numbers), plus
  // the seats of a "Transparent?" red flag answered n (opaque). Only the layout reading puts a desk in LAYOUT.osh (it
  // reads benches with a panel gap between the rows, so a desk can be OSH here and still count as a single desk below).
  var oshKey = null, oshSet = {};
  function isOshDesk(d) {
    if (!d) return false;
    var key = OSH_REV + '|' + (LAYOUT && LAYOUT.v);   // OSH_REV changes whenever the OSH seats or an answer change
    if (oshKey !== key) {
      oshKey = key; oshSet = {};
      ((LAYOUT && LAYOUT.osh) || []).forEach(function (s) { oshSet[String(s)] = 1; });
      ((LAYOUT && LAYOUT.flags) || []).forEach(function (f) { if (ASK_TRANSPARENT && f && f.q === 'transparent' && f.ans === 'n') (f.seats || []).forEach(function (s) { oshSet[String(s)] = 1; }); });
    }
    return !!oshSet[d.dataset.s];
  }
  function rowHidden(id) { return store.ptype[id] === 'OSH'; }
  // a desk's own type when nobody with a program type sits there: OSH, S (a single desk) or OS
  function autoType(d) { return isOshDesk(d) ? 'OSH' : isSingleDesk(d) ? 'S' : 'OS'; }
  window.__oshReady = function () { oshKey = null; relayout(); };
  // "Transparent? y / n" red flags: y = glass (the seats stay OS), n = opaque (they become OSH); the same answer again
  // takes it back. Saved with the layout (plan/current, field flags) for everyone.
  function answerFlag(el) {
    var i = +el.getAttribute('data-i'), a = el.getAttribute('data-a'), F = LAYOUT && LAYOUT.flags, f = F && F[i];
    if (!f || f.q !== 'transparent') return;
    f.ans = f.ans === a ? null : a; OSH_REV++;
    drawFlags(LAYOUT); relayout();
    var bt = document.querySelector('#flags .fl-opt[data-i="' + i + '"][data-a="' + a + '"]'); if (bt) try { bt.focus(); } catch (e) {}
    if (db) db.doc('plan/current').update({ flags: F }).then(function () { showErr(''); }, function () { showErr('Not saved. You may not have edit access to this page.'); });
  }
  var flagsG = document.getElementById('flags');
  flagsG.addEventListener('click', function (e) { var o = e.target.closest && e.target.closest('.fl-opt'); if (o) { e.stopPropagation(); answerFlag(o); } });
  flagsG.addEventListener('keydown', function (e) { var o = e.target.closest && e.target.closest('.fl-opt'); if (o && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); answerFlag(o); } });
  flagsG.addEventListener('pointerdown', function (e) { if (e.target.closest && e.target.closest('.fl-opt')) e.stopPropagation(); });
  // Show / hide flags (set by the user 24 Nov 2026): only shown when the plan has flags; hiding them changes nothing else.
  // On the website it sits left of the share button the site adds in the same corner (.eden-share, 44 px + 8 px gap).
  var flagTog = document.getElementById('flagtog');
  function placeFlagTog() {
    var sec = flagTog.parentNode, w = document.getElementById('wrap'), sh = document.querySelector('.eden-share');
    var has = !!document.querySelector('#flags .flag');
    flagTog.hidden = !has; if (!has) return;
    flagTog.style.top = (w.offsetTop + 12) + 'px';
    flagTog.style.right = (sec.clientWidth - (w.offsetLeft + w.offsetWidth) + 12 + (sh && sh.offsetParent ? sh.offsetWidth + 8 : 0)) + 'px';
    flagTog.setAttribute('aria-pressed', flagsShown() ? 'true' : 'false');
  }
  flagTog.addEventListener('click', function () {
    var on = !flagsShown();
    try { localStorage.setItem(flagsKey(), on ? 'on' : 'off'); } catch (e) {}
    flagsG.style.display = on ? '' : 'none'; placeFlagTog();
  });
  window.__placeFlagTog = placeFlagTog;
  addEventListener('resize', placeFlagTog);
  if (window.ResizeObserver) new ResizeObserver(placeFlagTog).observe(document.getElementById('wrap'));
  [0, 1000, 3000].forEach(function (ms) { setTimeout(placeFlagTog, ms); });
  // remember who sits at a single desk now (people with a program type keep it); returns undo entries
  function captureKinds(teams) {
    var stp = [];
    teams.forEach(function (t) {
      document.querySelectorAll('#srows tbody.grp[data-t="' + t + '"] tr.m').forEach(function (r) {
        if (r.classList.contains('unused') || r.classList.contains('pgone') || store.ptype[r.dataset.s]) return;
        var seat = deskOfRow(r), on = !!(seat && isSingleDesk(deskBy[seat]));
        if (on === !!store.pkind[r.dataset.s]) return;
        stp.push(['pkind', r.dataset.s, store.pkind[r.dataset.s] ? 1 : null]);
        writePkind(r.dataset.s, on);
      });
    });
    return stp;
  }
  // Team markers always sit outside the floor plan (rule for drag and Suggest too): on the building side nearest
  // the team's desks, with a dashed line to them. Teams deep inside the building get their marker in the core,
  // 100 pt left of their desks.
  function markerBase(g) {
    var r = g.querySelector('rect');
    if (!g.dataset.bx) { g.dataset.bx = +r.getAttribute('x') + +r.getAttribute('width') / 2; g.dataset.by = +r.getAttribute('y') + 32; }
    return { x: +g.dataset.bx, y: +g.dataset.by };
  }
  function leadBase(l) {
    if (l && !l.dataset.o) l.dataset.o = ['x1', 'y1', 'x2', 'y2'].map(function (k) { return l.getAttribute(k); }).join(' ');
  }
  // align: where the team name and "seats short" run from, so they stay off the building:
  // 'start' = from the pill's left edge rightwards (east of the facade), 'end' = from its right edge leftwards
  function setLabels(g, north, align) {
    var b = markerBase(g), tn = g.querySelector('.tname'), sh = g.querySelector('.short'), r = g.querySelector('rect');
    var rx = r ? +r.getAttribute('x') : b.x, rw = r ? +r.getAttribute('width') : 0, a = align || 'middle';
    var lx = a === 'start' ? rx + 4 : a === 'end' ? rx + rw - 4 : b.x;
    if (tn) { tn.setAttribute('y', (north ? b.y - 100 : b.y + 100).toFixed(1)); tn.setAttribute('x', lx.toFixed(1)); tn.style.textAnchor = a; }
    if (sh) { sh.setAttribute('y', (north ? b.y - 154 : b.y + 154).toFixed(1)); sh.setAttribute('x', lx.toFixed(1)); sh.style.textAnchor = a; }
  }
  function resetMarker(g, lead) {
    g.removeAttribute('transform');
    if (g.dataset.side0) setLabels(g, g.dataset.side0 === 'N');
    if (lead) { leadBase(lead); var o = lead.dataset.o.split(' '); ['x1', 'y1', 'x2', 'y2'].forEach(function (k, i) { lead.setAttribute(k, o[i]); }); lead.style.display = ''; }
  }
  function placeOutside(g, lead, desks) {
    if (!desks.length) { resetMarker(g, lead); return; }
    var b = markerBase(g);
    if (!g.dataset.side0) { var tn0 = g.querySelector('.tname'); g.dataset.side0 = tn0 && +tn0.getAttribute('y') < b.y ? 'N' : 'S'; }
    leadBase(lead);
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    desks.forEach(function (d) { var x = +d.dataset.x, y = +d.dataset.y; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + +d.dataset.w); y1 = Math.max(y1, y + +d.dataset.h); });
    var cs = desks.map(ctr), cx = cs.reduce(function (s, q) { return s + q.x; }, 0) / cs.length, cy = cs.reduce(function (s, q) { return s + q.y; }, 0) / cs.length;
    var tx, ty, L;
    // with the building's outline: just outside the facade nearest the team, or, when no facade is near
    // (the core or other rooms in between), inside the core on the side facing the team
    var sp = SHELL && shellSpot(x0, y0, x1, y1, cx, cy, desks);
    if (sp) {
      g.setAttribute('transform', 'translate(' + (sp.x - b.x).toFixed(1) + ' ' + (sp.y - b.y).toFixed(1) + ')');
      setLabels(g, sp.side === 'N', sp.align);
      PLACED.push({ g: g, lead: lead, side: sp.side, x: sp.x, y: sp.y, b: b, L: sp.L });
      if (lead) { ['x1', 'y1', 'x2', 'y2'].forEach(function (k, i) { lead.setAttribute(k, sp.L[i].toFixed(1)); }); lead.style.display = ''; }
      return;
    }
    // side = building edge nearest the team's centre
    var dN = cy - EXT[1], dS = EXT[3] - cy, dW = cx - EXT[0], dE = EXT[2] - cx, m = Math.min(dN, dS, dW, dE), far = m > 400 && !ASIS;
    if (far) { tx = x0 - 200; ty = cy; L = [tx + 47, ty, x0, ty]; }
    else if (m === dN) { tx = cx; ty = EXT[1] - 120; L = [tx, ty + 32, tx, y0]; }
    else if (m === dS) { tx = cx; ty = EXT[3] + 140; L = [tx, ty - 32, tx, y1]; }
    else if (m === dW) { tx = EXT[0] - 200; ty = cy; L = [tx + 60, ty, x0, ty]; }
    else { tx = EXT[2] + 200; ty = cy; L = [tx - 60, ty, x1, ty]; }
    g.setAttribute('transform', 'translate(' + (tx - b.x).toFixed(1) + ' ' + (ty - b.y).toFixed(1) + ')');
    setLabels(g, !far && m === dN);
    PLACED.push({ g: g, lead: lead, side: far ? 'I' : m === dN ? 'N' : m === dS ? 'S' : m === dW ? 'W' : 'E', x: tx, y: ty, b: b, L: L });
    if (lead) { ['x1', 'y1', 'x2', 'y2'].forEach(function (k, i) { lead.setAttribute(k, L[i].toFixed(1)); }); lead.style.display = ''; }
  }
  var PLACED = [];
  // the drawing area grows to show every marker and team name in full (not while a marker is being dragged)
  var VB0 = plan.getAttribute('viewBox').split(' ').map(Number);
  function fitView() {
    if (dragT) return;
    var b = null;
    // parked markers sit inside the plan's own area and never grow it (set by the user 24 Nov 2026)
    var pk = Array.prototype.filter.call(document.querySelectorAll('#teams .team, #teams .lead'), function (el) { return PARK[el.dataset.t] && el.style.display !== 'none'; });
    pk.forEach(function (el) { el.style.display = 'none'; });
    try { b = document.getElementById('teams').getBBox(); } catch (e) {}
    pk.forEach(function (el) { el.style.display = ''; });
    // red flags never change the view: they are placed inside it (set by the user 24 Nov 2026)
    var v = VB0.slice();
    if (b && b.width) {
      var x0 = Math.min(v[0], b.x - 30), y0 = Math.min(v[1], b.y - 30), x1 = Math.max(v[0] + v[2], b.x + b.width + 30), y1 = Math.max(v[1] + v[3], b.y + b.height + 30);
      v = [x0, y0, x1 - x0, y1 - y0];
    }
    var s = v.map(function (n) { return Math.round(n); }).join(' ');
    if (plan.getAttribute('viewBox') !== s) { plan.setAttribute('viewBox', s); if (window.__applyZoom) window.__applyZoom(); }
  }
  // the building outline (outside cells) and core from the layout, when it was read
  var SHELL = null, CORE = null;
  function readShell() {
    SHELL = null; CORE = LAYOUT && LAYOUT.core ? LAYOUT.core : null;
    var sh = LAYOUT && LAYOUT.shell; if (!sh || !sh.grid) return;
    var grid = new Int32Array(sh.cols * sh.rows), pos = 0;
    String(sh.grid).split(',').forEach(function (pr) { var a = pr.split('.'), v = parseInt(a[0], 36) || 0, n = parseInt(a[1], 36) || 0; if (v) grid.fill(v, pos, Math.min(grid.length, pos + n)); pos += n; });
    var size = {}; for (var i = 0; i < grid.length; i++) if (grid[i] >= 2) size[grid[i]] = (size[grid[i]] || 0) + 1;
    SHELL = { x: sh.x, y: sh.y, cell: sh.cell, cols: sh.cols, rows: sh.rows, g: grid, size: size };
    // desks and their chairs are furniture: cells within about 30 pt of a desk can always be crossed
    var near = new Uint8Array(grid.length);
    document.querySelectorAll('#desks .dk').forEach(function (d) {
      var x0 = +d.dataset.x - 30, y0 = +d.dataset.y - 30, x1 = +d.dataset.x + +d.dataset.w + 30, y1 = +d.dataset.y + +d.dataset.h + 30;
      for (var cy = Math.max(0, Math.floor((y0 - sh.y) / sh.cell)); cy <= Math.min(sh.rows - 1, Math.floor((y1 - sh.y) / sh.cell)); cy++)
        for (var cx = Math.max(0, Math.floor((x0 - sh.x) / sh.cell)); cx <= Math.min(sh.cols - 1, Math.floor((x1 - sh.x) / sh.cell)); cx++) near[cy * sh.cols + cx] = 1;
    });
    SHELL.near = near;
  }
  // The floorplate (everything inside the building outline) is a very light warm white, a touch darker than the
  // white around the building, so the building stands out. Drawn from the outline grid, multiplied over the plan picture.
  var FLOOR = [248, 247, 244];   // #F8F7F4
  function paintFloor() {
    var old = document.getElementById('floorplate'); if (old) old.remove();
    if (!SHELL) return;
    try {
      var c = document.createElement('canvas'); c.width = SHELL.cols; c.height = SHELL.rows;
      var ctx = c.getContext('2d'), im = ctx.createImageData(SHELL.cols, SHELL.rows), d = im.data;
      for (var i = 0; i < SHELL.g.length; i++) {
        var inside = SHELL.g[i] !== 1;
        d[i * 4] = inside ? FLOOR[0] : 255; d[i * 4 + 1] = inside ? FLOOR[1] : 255; d[i * 4 + 2] = inside ? FLOOR[2] : 255; d[i * 4 + 3] = 255;
      }
      ctx.putImageData(im, 0, 0);
      var el = document.createElementNS('http://www.w3.org/2000/svg', 'image');
      el.setAttribute('id', 'floorplate');
      el.setAttribute('href', c.toDataURL('image/png'));
      el.setAttribute('x', SHELL.x); el.setAttribute('y', SHELL.y);
      el.setAttribute('width', SHELL.cols * SHELL.cell); el.setAttribute('height', SHELL.rows * SHELL.cell);
      el.setAttribute('preserveAspectRatio', 'none');
      el.setAttribute('style', 'mix-blend-mode: multiply; pointer-events: none');
      document.getElementById('bgwrap').appendChild(el);
    } catch (e) {}
    paintOutlines();
  }
  // thin black lines: the building's outer edge (shell, from the outline grid) and the core (its outline box)
  function paintOutlines() {
    var old = document.getElementById('outlines'); if (old) old.remove();
    if (!SHELL) return;
    var C = SHELL.cols, R = SHELL.rows, G = SHELL.g, cs = SHELL.cell, X = SHELL.x, Y = SHELL.y;
    function ins(cx, cy) { return cx >= 0 && cy >= 0 && cx < C && cy < R && G[cy * C + cx] !== 1; }
    var d = [];
    // horizontal edges: between row cy-1 and cy, merged along the row
    for (var cy = 0; cy <= R; cy++) {
      var start = -1;
      for (var cx = 0; cx <= C; cx++) {
        var edge = cx < C && ins(cx, cy - 1) !== ins(cx, cy);
        if (edge && start < 0) start = cx;
        if (!edge && start >= 0) { d.push('M' + (X + start * cs) + ' ' + (Y + cy * cs) + 'H' + (X + cx * cs)); start = -1; }
      }
    }
    // vertical edges: between column cx-1 and cx, merged down the column
    for (var vx = 0; vx <= C; vx++) {
      var st = -1;
      for (var vy = 0; vy <= R; vy++) {
        var ed = vy < R && ins(vx - 1, vy) !== ins(vx, vy);
        if (ed && st < 0) st = vy;
        if (!ed && st >= 0) { d.push('M' + (X + vx * cs) + ' ' + (Y + st * cs) + 'V' + (Y + vy * cs)); st = -1; }
      }
    }
    var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', 'outlines');
    var html = '<path class="shell-line" d="' + d.join('') + '"/>';
    if (CORE) html += '<rect class="core-line" x="' + CORE[0] + '" y="' + CORE[1] + '" width="' + (CORE[2] - CORE[0]) + '" height="' + (CORE[3] - CORE[1]) + '"/>';
    g.innerHTML = html;
    document.getElementById('bgwrap').appendChild(g);
  }
  readShell(); paintFloor();
  window.__shellReady = function () { readShell(); paintFloor(); relayout(); };
  function cellAt(x, y) {
    var cx = Math.floor((x - SHELL.x) / SHELL.cell), cy = Math.floor((y - SHELL.y) / SHELL.cell);
    if (cx < 0 || cy < 0 || cx >= SHELL.cols || cy >= SHELL.rows) return 1;
    return SHELL.g[cy * SHELL.cols + cx];
  }
  function nearDesk(x, y) {
    var cx = Math.floor((x - SHELL.x) / SHELL.cell), cy = Math.floor((y - SHELL.y) / SHELL.cell);
    return cx >= 0 && cy >= 0 && cx < SHELL.cols && cy < SHELL.rows && SHELL.near[cy * SHELL.cols + cx] === 1;
  }
  function inCore(x, y) { return !!CORE && x > CORE[0] && x < CORE[2] && y > CORE[1] && y < CORE[3]; }
  // the spaces a team sits in: the rooms / open space right around its desks
  function spacesOf(desks) {
    var cnt = {}, top = 0, own = {};
    desks.forEach(function (d) {
      var x = +d.dataset.x, y = +d.dataset.y, w = +d.dataset.w, h = +d.dataset.h;
      for (var ax = x - 24; ax <= x + w + 24; ax += 8) for (var ay = y - 24; ay <= y + h + 24; ay += 8) {
        var v = cellAt(ax, ay); if (v >= 2) cnt[v] = (cnt[v] || 0) + 1;
      }
    });
    Object.keys(cnt).forEach(function (k) { if (cnt[k] > top) top = cnt[k]; });
    Object.keys(cnt).forEach(function (k) { if (cnt[k] >= top * 0.2) own[k] = true; });
    return own;
  }
  // from a desk, walk outwards through the team's own space (and furniture) until outside the building;
  // null when another room or the core is in the way, or the facade is more than about 16 m away
  // Big spaces (about 40 m² and more) are open space, even when a thin line (a dimension) splits them: they can be
  // crossed. Rooms and small enclosed areas block the way once the walk has gone about 50 pt through them.
  var OPEN_CELLS = 2000;
  function walkOut(x, y, dx, dy, own) {
    var blocked = 0;
    for (var d = 0; d <= 900; d += 6) {
      var px = x + dx * d, py = y + dy * d;
      if (inCore(px, py)) return null;
      var v = cellAt(px, py);
      if (v === 1) return { d: d, x: px, y: py };
      if (v >= 2 && !own[v] && (SHELL.size[v] || 0) < OPEN_CELLS && d > 48 && !nearDesk(px, py) && ++blocked >= 8) return null;
    }
    return null;
  }
  function shellSpot(x0, y0, x1, y1, cx, cy, desks) {
    var best = null, own = spacesOf(desks);
    [['N', 0, -1], ['S', 0, 1], ['W', -1, 0], ['E', 1, 0]].forEach(function (dir) {
      desks.forEach(function (dk) {
        var x = +dk.dataset.x, y = +dk.dataset.y, w = +dk.dataset.w, h = +dk.dataset.h;
        var sx = dir[1] ? (dir[1] < 0 ? x : x + w) : x + w / 2, sy = dir[2] ? (dir[2] < 0 ? y : y + h) : y + h / 2;
        var hit = walkOut(sx, sy, dir[1], dir[2], own);
        if (hit && (!best || hit.d < best.d)) best = { d: hit.d, x: hit.x, y: hit.y, side: dir[0], sx: sx, sy: sy };
      });
    });
    if (best) {
      // right outside the facade where the walk came out, with the line back to that desk
      var m = best.side, tx, ty, L;
      if (m === 'N') { tx = best.x; ty = best.y - 120; L = [tx, ty + 32, tx, best.sy]; }
      else if (m === 'S') { tx = best.x; ty = best.y + 140; L = [tx, ty - 32, tx, best.sy]; }
      else if (m === 'W') { tx = best.x - 200; ty = best.y; L = [tx + 60, ty, best.sx, ty]; }
      else { tx = best.x + 200; ty = best.y; L = [tx - 60, ty, best.sx, ty]; }
      return { side: m, x: tx, y: ty, L: L, align: m === 'E' ? 'start' : m === 'W' ? 'end' : 'middle' };
    }
    if (!CORE) return null;
    // interior team: inside the core, on the core side facing the team
    var C = CORE, gaps = [['W', C[0] - x1], ['E', x0 - C[2]], ['N', C[1] - y1], ['S', y0 - C[3]]].sort(function (a, b2) { return b2[1] - a[1]; });
    var face = gaps[0][0], clx = Math.max(C[0] + 110, Math.min(C[2] - 110, cx)), cly = Math.max(C[1] + 90, Math.min(C[3] - 90, cy));
    if (face === 'W') return { side: 'I', x: C[0] + 110, y: cly, L: [C[0] + 110 + 60, cly, x0, cly], align: 'start' };
    if (face === 'E') return { side: 'I', x: C[2] - 110, y: cly, L: [C[2] - 110 - 60, cly, x1, cly], align: 'end' };
    if (face === 'N') return { side: 'I', x: clx, y: C[1] + 90, L: [clx, C[1] + 90 + 32, clx, y0] };
    return { side: 'I', x: clx, y: C[3] - 90, L: [clx, C[3] - 90 - 32, clx, y1] };
  }
  // keep markers on the same side from overlapping: spread them along that side
  function spreadMarkers() {
    var sides = { N: [], S: [], W: [], E: [] };
    PLACED.forEach(function (p) { if (sides[p.side]) sides[p.side].push(p); });
    // markers still at their original spot are fixed obstacles
    document.querySelectorAll('#teams .team').forEach(function (g) {
      if (g.style.display === 'none' || g.getAttribute('transform') || PARK[g.dataset.t]) return;
      var b = markerBase(g), sd = b.x < EXT[0] ? 'W' : b.x > EXT[2] ? 'E' : b.y < EXT[1] ? 'N' : b.y > EXT[3] ? 'S' : null;
      if (sd) sides[sd].push({ fixed: true, x: b.x, y: b.y });
    });
    Object.keys(sides).forEach(function (sd) {
      var horiz = sd === 'N' || sd === 'S', gap = horiz ? 560 : 460, list = sides[sd];
      var key = horiz ? 'x' : 'y';
      list.sort(function (a, c) { return a[key] - c[key]; });
      for (var i = 1; i < list.length; i++) {
        var prev = list[i - 1], cur = list[i];
        if (cur[key] - prev[key] >= gap) continue;
        if (!cur.fixed) cur[key] = prev[key] + gap;
        else if (!prev.fixed) prev[key] = cur[key] - gap;
      }
      list.forEach(function (p) {
        if (p.fixed) return;
        p.g.setAttribute('transform', 'translate(' + (p.x - p.b.x).toFixed(1) + ' ' + (p.y - p.b.y).toFixed(1) + ')');
        if (p.lead) {
          var L = p.L.slice();
          if (horiz) { L[0] = p.x; L[2] = p.x; } else { L[1] = p.y; L[3] = p.y; }
          ['x1', 'y1', 'x2', 'y2'].forEach(function (k, i) { p.lead.setAttribute(k, L[i].toFixed(1)); });
        }
      });
    });
    // interior markers (in the core): move down past any marker they would cover
    var taken = [];
    document.querySelectorAll('#teams .team').forEach(function (g) {
      if (g.style.display === 'none' || g.getAttribute('transform') || PARK[g.dataset.t]) return;
      var b = markerBase(g); taken.push({ x: b.x, y: b.y });
    });
    PLACED.forEach(function (p) { if (p.side !== 'I') taken.push(p); });
    PLACED.filter(function (p) { return p.side === 'I'; }).sort(function (a, c) { return a.y - c.y; }).forEach(function (p) {
      var y0 = p.y, guard = 0;
      while (guard++ < 30 && taken.some(function (o) { return Math.abs(o.x - p.x) < 560 && Math.abs(o.y - p.y) < 460; })) p.y += 460;
      if (p.y !== y0) {
        p.g.setAttribute('transform', 'translate(' + (p.x - p.b.x).toFixed(1) + ' ' + (p.y - p.b.y).toFixed(1) + ')');
        if (p.lead) { p.lead.setAttribute('y1', p.y.toFixed(1)); }
      }
      taken.push(p);
    });
  }
  // Markers never touch each other or the building: each marker (pill + "seats short") keeps a clear space from the
  // building outline (or the desks' area when the outline was not read) and from every other marker. A marker that
  // would touch moves straight outwards, away from the building, until it is clear; its dashed line follows it.
  var SHELL_GAP = 60, MARK_GAP = 40;
  function svgBox(el) {
    var r = el.getBoundingClientRect(), m = plan.getScreenCTM(); if (!m || !r.width || !r.height) return null;
    var inv = m.inverse(), p = plan.createSVGPoint();
    p.x = r.left; p.y = r.top; var a = p.matrixTransform(inv); p.x = r.right; p.y = r.bottom; var b = p.matrixTransform(inv);
    return { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) };
  }
  function hitsBuilding(b) {
    var x0 = b.x0 - SHELL_GAP, y0 = b.y0 - SHELL_GAP, x1 = b.x1 + SHELL_GAP, y1 = b.y1 + SHELL_GAP;
    if (!SHELL) return x0 < EXT[2] && x1 > EXT[0] && y0 < EXT[3] && y1 > EXT[1];
    for (var y = y0; y <= y1 + 0.1; y += Math.min(16, y1 - y0 || 16)) for (var x = x0; x <= x1 + 0.1; x += Math.min(16, x1 - x0 || 16)) if (cellAt(x, y) !== 1) return true;
    return false;
  }
  function hitsBox(b, o) { return b.x0 - MARK_GAP < o.x1 && b.x1 + MARK_GAP > o.x0 && b.y0 - MARK_GAP < o.y1 && b.y1 + MARK_GAP > o.y0; }
  function clearMarkers() {
    var list = [];
    document.querySelectorAll('#teams .team').forEach(function (g) {
      if (g.style.display === 'none' || g.dataset.t === dragT || PARK[g.dataset.t]) return;
      var pl = null; PLACED.forEach(function (q) { if (q.g === g) pl = q; });
      var side = pl ? pl.side : null, b = markerBase(g);
      if (!side) side = b.x < EXT[0] ? 'W' : b.x > EXT[2] ? 'E' : b.y < EXT[1] ? 'N' : b.y > EXT[3] ? 'S' : 'I';
      list.push({ g: g, side: side, lead: document.querySelector('#teams .lead[data-t="' + g.dataset.t + '"]') });
    });
    // red flags are placed after the markers and keep off them (so flags never move markers or the view)
    var done = [];
    if (dragT) { var dg = document.querySelector('#teams .team[data-t="' + dragT + '"]'), db0 = dg && svgBox(dg); if (db0) done.push(db0); }
    list.forEach(function (m) {
      var dir = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0], I: [0, 1] }[m.side] || [0, 1];
      var box = svgBox(m.g); if (!box) return;
      var dx = 0, dy = 0, guard = 0;
      function bad(b) { return (m.side !== 'I' && hitsBuilding(b)) || done.some(function (o) { return hitsBox(b, o); }); }
      while (guard++ < 120 && bad({ x0: box.x0 + dx, y0: box.y0 + dy, x1: box.x1 + dx, y1: box.y1 + dy })) { dx += dir[0] * 24; dy += dir[1] * 24; }
      if (dx || dy) {
        var tr = /translate\(([-\d.e]+)[ ,]+([-\d.e]+)\)/.exec(m.g.getAttribute('transform') || ''), tx = tr ? +tr[1] : 0, ty = tr ? +tr[2] : 0;
        m.g.setAttribute('transform', 'translate(' + (tx + dx).toFixed(1) + ' ' + (ty + dy).toFixed(1) + ')');
        box = { x0: box.x0 + dx, y0: box.y0 + dy, x1: box.x1 + dx, y1: box.y1 + dy };
      }
      // the dashed line starts at the pill edge facing the building
      var pr = m.g.querySelector('rect'), pb = pr && svgBox(pr);
      if (m.lead && pb && m.lead.style.display !== 'none') {
        var cx = (pb.x0 + pb.x1) / 2, cy = (pb.y0 + pb.y1) / 2;
        if (m.side === 'N') { m.lead.setAttribute('x1', cx.toFixed(1)); m.lead.setAttribute('y1', pb.y1.toFixed(1)); }
        else if (m.side === 'S') { m.lead.setAttribute('x1', cx.toFixed(1)); m.lead.setAttribute('y1', pb.y0.toFixed(1)); }
        else if (m.side === 'W') { m.lead.setAttribute('x1', pb.x1.toFixed(1)); m.lead.setAttribute('y1', cy.toFixed(1)); }
        else if (m.side === 'E') { m.lead.setAttribute('x1', pb.x0.toFixed(1)); m.lead.setAttribute('y1', cy.toFixed(1)); }
      }
      done.push(box);
    });
  }
