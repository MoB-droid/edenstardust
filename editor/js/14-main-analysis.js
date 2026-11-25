  // ---- ANALYSIS (C3 element inventory, set by the user 25 Nov 2026): a foldable table above PROGRAM, closed by default,
  // grouped by the six C3 sections. Tapping a row outlines that element on the plan (gold on black, in #elhi under the
  // markers and the flags); tapping it again clears. The view and the zoom never change.
  var anWrap = document.getElementById('anwrap'), anTog = document.getElementById('antitle'), anBox = document.getElementById('antbl'), anSel = null;
  function anRows() { var E = LAYOUT && LAYOUT.elements; return E && Array.isArray(E.rows) ? E.rows : []; }
  function anDraw() {
    var g = document.getElementById('elhi'); if (!g) return;
    var r = anSel ? anRows().filter(function (x) { return x.id === anSel; })[0] : null;
    if (!r || !Array.isArray(r.boxes) || !r.boxes.length) { g.innerHTML = ''; return; }
    var h = [];
    r.boxes.forEach(function (b) {
      if (!Array.isArray(b) || b.length < 4 || !b.every(isFinite)) return;
      var x = Math.min(b[0], b[2]) - 6, y = Math.min(b[1], b[3]) - 6, w = Math.abs(b[2] - b[0]) + 12, hh = Math.abs(b[3] - b[1]) + 12;
      var a = ' x="' + f1(x) + '" y="' + f1(y) + '" width="' + f1(w) + '" height="' + f1(hh) + '" rx="6"';
      h.push('<rect class="elb"' + a + '/><rect class="eli"' + a + '/>');
    });
    g.innerHTML = h.join('');
  }
  function anRender() {
    var rows = anRows();
    anWrap.hidden = !rows.length; if (!rows.length) { anBox.innerHTML = ''; anDraw(); return; }
    var h = '<table class="antab"><thead><tr><th class="num">#</th><th>Element</th><th>On layout</th><th>Location</th><th class="num">Count</th></tr></thead>', sec = 0;
    rows.forEach(function (r) {
      if (r.sec !== sec) { if (sec) h += '</tbody>'; sec = r.sec; h += '<tbody><tr class="sec"><td colspan="5">' + sec + ' · ' + esc(EL_SECTIONS[sec] || '') + '</td></tr>'; }
      var has = Array.isArray(r.boxes) && r.boxes.length > 0, yes = r.found === 'yes', fd = yes ? 'yes' : r.found === 'no' ? 'no' : 'not detected yet', on = anSel === r.id;
      h += '<tr class="el' + (has ? ' pick' : '') + (yes ? '' : ' nd') + (on ? ' on' : '') + '" data-id="' + esc(r.id) + '"' + (has ? ' tabindex="0" role="button" aria-pressed="' + on + '" aria-label="' + esc(r.id + ' ' + r.name + ': show on the plan') + '"' : '') + (r.note ? ' title="' + esc(r.note) + '"' : '') + '>'
        + '<td class="num">' + esc(r.id) + '</td><td class="en">' + esc(r.name) + '</td><td class="fd">' + fd + '</td>'
        + '<td class="lc" dir="auto">' + esc(r.loc || '') + (!yes && r.note ? '<small>' + esc(r.note) + '</small>' : '') + '</td>'
        + '<td class="num">' + (r.n === null || r.n === undefined ? '–' : esc(r.n)) + '</td></tr>';
    });
    anBox.innerHTML = h + '</tbody></table>';
    anDraw();
  }
  function anPick(tr) {
    if (!tr || !tr.classList.contains('pick')) return;
    anSel = anSel === tr.dataset.id ? null : tr.dataset.id;
    anBox.querySelectorAll('tr.el').forEach(function (x) { var on = x.dataset.id === anSel; x.classList.toggle('on', on); if (x.classList.contains('pick')) x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    anDraw();
  }
  anTog.addEventListener('click', function () {
    var open = anTog.getAttribute('aria-expanded') !== 'true';
    anTog.setAttribute('aria-expanded', open ? 'true' : 'false'); anBox.hidden = !open;
    alignProgram();
  });
  anBox.addEventListener('click', function (e) { anPick(e.target.closest('tr.el')); });
  anBox.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { var tr = e.target.closest('tr.el'); if (tr) { e.preventDefault(); anPick(tr); } } });
  window.__elReady = function () { anRender(); alignProgram(); };
  anRender();
  window.__relayout = relayout;
  // tapping a team in the team list shades that team on the layout (tap again to clear)
  document.getElementById('summ').addEventListener('click', function (e) {
    var tb = e.target.closest('[data-ty]');
    if (tb) { var same = TYHI && TYHI.t === tb.dataset.ty && TYHI.k === tb.dataset.k; TYHI = same ? null : { t: tb.dataset.ty, k: tb.dataset.k }; paintTyHi(); return; }
    var b = e.target.closest('.tbtn'); if (!b) return;
    shade(b.dataset.t, b.getAttribute('aria-pressed') !== 'true');
  });
  function svgPt(e) {
    var p = plan.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    return p.matrixTransform(plan.getScreenCTM().inverse());
  }
  function saveMove(t) {
    var mv = moveOf(t);
    relayout();
    if (db) {
      var ref = db.collection('moves').doc(String(t));
      (mv ? ref.set({ x: Math.round(mv.x * 10) / 10, y: Math.round(mv.y * 10) / 10 }) : ref.delete()).then(function () { showErr(''); }, function () {
        showErr('Move not saved. You may not have edit access to this page.');
      });
    } else {
      try { localStorage.setItem(LS, JSON.stringify(store)); } catch (e) {}
    }
  }
  var ds = null;
  teamsG.addEventListener('pointerdown', function (e) {
    var g = e.target.closest('.team'); if (!g || e.button > 0) return;
    ds = { g: g, t: g.dataset.t, sx: e.clientX, sy: e.clientY, prev: moveOf(g.dataset.t), moving: false };
    try { g.setPointerCapture(e.pointerId); } catch (err) {}
  });
  teamsG.addEventListener('pointermove', function (e) {
    if (!ds) return;
    if (!ds.moving) {
      if (Math.abs(e.clientX - ds.sx) + Math.abs(e.clientY - ds.sy) < 6) return;
      ds.moving = true; ds.kinds = captureKinds([ds.t]); dragT = ds.t; ds.g.classList.add('drag');
    }
    e.preventDefault();
    var p = svgPt(e);
    store.moves[ds.t] = { x: p.x, y: p.y };
    if (store.assign[ds.t]) { ds.prevAsg = store.assign[ds.t]; delete store.assign[ds.t]; }
    relayout();
  });
  function endDrag(e) {
    if (!ds) return;
    var d = ds; ds = null;
    try { d.g.releasePointerCapture(e.pointerId); } catch (err) {}
    if (!d.moving) return;
    justDragged = true; setTimeout(function () { justDragged = false; }, 300);
    d.g.classList.remove('drag');
    dragT = null;
    var stp = [['moves', d.t, clone(d.prev)]].concat(d.kinds || []);
    if (d.prevAsg) { stp.push(['assign', d.t, clone(d.prevAsg)]); writeAssign(d.t, null); }
    // moving a team takes its people along: their personal desks are cleared
    document.querySelectorAll('#srows tbody.grp[data-t="' + d.t + '"] tr.m').forEach(function (r) { if (store.pseat[r.dataset.s]) { stp.push(['pseat', r.dataset.s, store.pseat[r.dataset.s]]); writePseat(r.dataset.s, null); } });
    pushStep(stp);
    saveMove(d.t);
  }
  teamsG.addEventListener('pointerup', endDrag);
  teamsG.addEventListener('pointercancel', endDrag);
  relayout();
  function saveGone(seat, on) {
    pushStep([['gone', seat, clone(store.gone[seat])]]);
    if (on) store.gone[seat] = true; else delete store.gone[seat];
    relayout();
    if (db) {
      var ref = db.collection('gone').doc(String(seat));
      (on ? ref.set({ on: true }) : ref.delete()).then(function () { showErr(''); }, function () {
        showErr('Not saved. You may not have edit access to this page.');
      });
    } else {
      try { localStorage.setItem(LS, JSON.stringify(store)); } catch (e) {}
    }
  }
  function saveDeleted(t, on) {
    pushStep([['deleted', t, clone(store.deleted[t])]]);
    if (on) store.deleted[t] = true; else delete store.deleted[t];
    relayout();
    if (db) {
      var ref = db.collection('deleted').doc(String(t));
      (on ? ref.set({ on: true }) : ref.delete()).then(function () { showErr(''); }, function () {
        showErr('Not saved. You may not have edit access to this page.');
      });
    } else {
      try { localStorage.setItem(LS, JSON.stringify(store)); } catch (e) {}
    }
  }
  // centre the "Are you sure?" button on the Delete button that opened it
  function placeConfirm(c, btn) {
    var op = c.offsetParent; if (!op) return;
    var b = btn.getBoundingClientRect(), o = op.getBoundingClientRect();
    c.style.left = (b.left - o.left - op.clientLeft + b.width / 2) + 'px';
    c.style.top = (b.top - o.top - op.clientTop + b.height / 2) + 'px';
  }
  function closeConfirm() { document.querySelectorAll('.confirm').forEach(function (c) { c.remove(); }); }
  document.addEventListener('click', function (e) { if (!e.target.closest('.confirm, .delbtn')) closeConfirm(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeConfirm(); });
  // a person moved by drag sits at their own desk: collection pseat, doc = person row id, field s = desk number
  function writePseat(id, val) {
    if (val) store.pseat[id] = String(val); else delete store.pseat[id];
    if (db) {
      var ref = db.collection('pseat').doc(String(id));
      (val ? ref.set({ s: String(val) }) : ref.delete()).then(function () {}, function () { showErr('Not saved. You may not have edit access to this page.'); });
    } else { try { localStorage.setItem(LS, JSON.stringify(store)); } catch (e) {} }
  }
  function writePkind(id, on) {
    if (on) store.pkind[id] = true; else delete store.pkind[id];
    if (db) {
      var ref = db.collection('pkind').doc(String(id));
      (on ? ref.set({ on: true }) : ref.delete()).then(function () {}, function () { showErr('Not saved. You may not have edit access to this page.'); });
    } else { try { localStorage.setItem(LS, JSON.stringify(store)); } catch (e) {} }
  }
  function writePtype(id, val) {
    if (val) store.ptype[id] = val; else delete store.ptype[id];
    if (db) {
      var ref = db.collection('ptype').doc(String(id));
      (val ? ref.set({ t: val }) : ref.delete()).then(function () {}, function () { showErr('Not saved. You may not have edit access to this page.'); });
    } else { try { localStorage.setItem(LS, JSON.stringify(store)); } catch (e) {} }
  }
  function writeAssign(t, val) {
    if (val) store.assign[t] = val; else delete store.assign[t];
    if (db) {
      var ref = db.collection('assign').doc(String(t));
      (val ? ref.set({ s: val }) : ref.delete()).then(function () {}, function () { showErr('Not saved. You may not have edit access to this page.'); });
    } else { try { localStorage.setItem(LS, JSON.stringify(store)); } catch (e) {} }
  }
  function writeMove(t, val) {
    if (val) store.moves[t] = val; else delete store.moves[t];
    if (db) {
      var ref = db.collection('moves').doc(String(t));
      (val ? ref.set({ x: val.x, y: val.y }) : ref.delete()).then(function () {}, function () { showErr('Not saved. You may not have edit access to this page.'); });
    } else { try { localStorage.setItem(LS, JSON.stringify(store)); } catch (e) {} }
  }
