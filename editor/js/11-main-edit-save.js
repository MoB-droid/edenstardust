  // ---- Drag a person: with the mouse, drag a person's desk onto another desk. They move there; if someone sits
  // there, the two swap. One Undo step. Suggest and moving the team clear personal moves.
  var pd = null, pGhost = null, justMovedP = false;
  function dropDeskAt(x, y) { var el = document.elementFromPoint(x, y); return el && el.closest ? el.closest('#desks .dk') : null; }
  document.getElementById('desks').addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch' || e.button > 0) return;
    var d = e.target.closest('.dk'); if (!d) return;
    var r = rowOfDesk(d.dataset.s); if (!r || deskOfRow(r) !== d.dataset.s) return;
    pd = { d: d, r: r, x: e.clientX, y: e.clientY, moving: false, over: null };
    e.stopPropagation();
  });
  window.addEventListener('pointermove', function (e) {
    if (!pd) return;
    if (!pd.moving) {
      if (Math.abs(e.clientX - pd.x) + Math.abs(e.clientY - pd.y) < 6) return;
      pd.moving = true; pd.d.classList.add('src'); wrap.classList.add('pmoving');
      pGhost = document.createElement('div'); pGhost.className = 'pdrag';
      pGhost.textContent = (cap(store.names[pd.r.dataset.s] || '') || 'Seat ' + pd.d.dataset.s) + ' → drop on a desk';
      document.body.appendChild(pGhost);
    }
    e.preventDefault();
    pGhost.style.left = (e.clientX + 14) + 'px'; pGhost.style.top = (e.clientY + 12) + 'px';
    var t = dropDeskAt(e.clientX, e.clientY);
    if (pd.over && pd.over !== t) pd.over.classList.remove('drop');
    pd.over = t && t !== pd.d ? t : null; if (pd.over) pd.over.classList.add('drop');
  });
  window.addEventListener('pointerup', function (e) {
    if (!pd) return;
    var p = pd; pd = null;
    if (!p.moving) return;
    justMovedP = true; setTimeout(function () { justMovedP = false; }, 300);
    p.d.classList.remove('src'); wrap.classList.remove('pmoving'); if (pGhost) { pGhost.remove(); pGhost = null; }
    if (p.over) p.over.classList.remove('drop');
    var to = p.over; if (!to) return;
    var from = p.d.dataset.s, other = rowOfDesk(to.dataset.s);
    if (other && (other === p.r || deskOfRow(other) !== to.dataset.s)) other = null;
    var stp = [['pseat', p.r.dataset.s, clone(store.pseat[p.r.dataset.s])], ['pkind', p.r.dataset.s, store.pkind[p.r.dataset.s] ? 1 : null]];
    if (other) stp.push(['pkind', other.dataset.s, store.pkind[other.dataset.s] ? 1 : null]);
    if (other) stp.push(['pseat', other.dataset.s, clone(store.pseat[other.dataset.s])]);
    pushStep(stp);
    writePseat(p.r.dataset.s, to.dataset.s);
    if (other) writePseat(other.dataset.s, from);
    if (!store.ptype[p.r.dataset.s]) writePkind(p.r.dataset.s, isSingleDesk(to));
    if (other && !store.ptype[other.dataset.s]) writePkind(other.dataset.s, isSingleDesk(p.d));
    relayout();
  });
  function deskClick(e) {
    if (justMovedP) return;
    var d = e.target.closest('.dk'); if (!d || d.classList.contains('empty')) return;
    hi(d.dataset.s, false);
    var r = rowOfDesk(d.dataset.s);
    if (r) r.scrollIntoView({ block: 'nearest' });
  }
  document.getElementById('desks').addEventListener('click', deskClick);
  var teamIds = [];
  document.querySelectorAll('#teams .team').forEach(function (g) { teamIds.push(g.dataset.t); });
  function setOpen(g, open) {
    var b = g.querySelector('.fold'); b.setAttribute('aria-expanded', open ? 'true' : 'false');
    g.querySelectorAll('tr.m').forEach(function (r) { r.hidden = !open; });
  }
  var store = { names: {}, teams: {}, moves: {}, need: {}, deleted: {}, gone: {}, added: {}, assign: {}, flags: {}, pseat: {}, ptype: {}, pkind: {} }, db = null, LS = "edits:Seat Plan";
  // Undo: every change pushes one step (a list of [collection, id, previous value]).
  var hist = [], undoing = false, HK = LS + ':undo' + (MS.active === 'm0' ? '' : ':' + MS.active);
  try { hist = JSON.parse(localStorage.getItem(HK) || '[]') || []; } catch (e) { hist = []; }
  // another milestone opened in place: its own Undo history
  window.__msSwitched = function () {
    HK = LS + ':undo' + (MS.active === 'm0' ? '' : ':' + MS.active);
    try { hist = JSON.parse(localStorage.getItem(HK) || '[]') || []; } catch (e) { hist = []; }
    var u = document.getElementById('undo'); if (u) u.disabled = !hist.length;
  };
  function keepHist() { try { localStorage.setItem(HK, JSON.stringify(hist)); } catch (e) {} var u = document.getElementById('undo'); if (u) u.disabled = !hist.length; }
  // batch(): run several changes as one Undo step
  function batch(fn) {
    var step = [], orig = pushStep;
    pushStep = function (st) { step = step.concat(st); };
    try { fn(); } finally { pushStep = orig; }
    if (step.length) pushStep(step);
  }
  function pushStep(step) { if (undoing || !step.length) return; hist.push(step); if (hist.length > 200) hist.shift(); keepHist(); }
  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  // Names always start with a capital letter.
  function cap(v) { v = String(v); return v ? v.charAt(0).toLocaleUpperCase() + v.slice(1) : v; }
  function paint() {
    setTimeout(function () { paintTotal(); if (window.__relayout) window.__relayout(); }, 0);
    paintFlags();
    paintEds();
    paintDeskNames();
    paintTeamNames();
  }
  // the editable cells (team names, people's names, seats needed) show what is saved
  function paintEds() {
    document.querySelectorAll('.ed').forEach(function (c) {
      if (!c.querySelector('input')) { var v0 = store[c.dataset.k][c.dataset.id] || c.dataset.def || ''; var s0 = c.dataset.k === 'need' ? v0 : cap(v0); if (c.textContent !== s0 || (c.dataset.k === 'teams' && s0 && !c.querySelector('.tchip'))) { if (c.dataset.k === 'teams' && s0) { c.textContent = ''; var chip = document.createElement('span'); chip.className = 'tchip'; chip.textContent = s0; c.appendChild(chip); } else c.textContent = s0; } }
    });
  }
  // names on desks: the person who sits at each desk now (from the program rows), else a name typed for that seat
  var DESKNAME = null;
  function paintDeskNames() {
    document.querySelectorAll('.dk').forEach(function (g) {
      var nm = cap((DESKNAME && g.dataset.s in DESKNAME) ? DESKNAME[g.dataset.s] : (store.names[g.dataset.s] || '')), pn = g.querySelector('.pn'), dn = g.querySelector('.dn');
      if (g.dataset.nm === nm) return;
      g.dataset.nm = nm;
      var x = +g.dataset.x, y = +g.dataset.y, w = +g.dataset.w, h = +g.dataset.h, cx = x + w / 2, cy = y + h / 2, vert = h > w;
      pn.removeAttribute('transform');
      if (!nm) { pn.textContent = ''; dn.setAttribute('y', cy.toFixed(1)); return; }
      var max = vert ? h - 26 : w - 6;
      if (vert) { dn.setAttribute('y', (y + 12).toFixed(1)); pn.setAttribute('x', cx.toFixed(1)); pn.setAttribute('y', (cy + 11).toFixed(1)); pn.setAttribute('transform', 'rotate(-90 ' + cx.toFixed(1) + ' ' + (cy + 11).toFixed(1) + ')'); }
      else { dn.setAttribute('y', (cy - 11).toFixed(1)); pn.setAttribute('x', cx.toFixed(1)); pn.setAttribute('y', (cy + 8).toFixed(1)); }
      pn.textContent = nm;
      try {
        var t = nm;
        while (t.length > 1 && pn.getComputedTextLength() > max) { t = t.slice(0, -1); pn.textContent = t.replace(/ +$/, '') + '…'; }
      } catch (e) {}
      var ttl = g.querySelector('title') || g.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'title'));
      ttl.textContent = 'Seat ' + g.dataset.s + ': ' + nm;
    });
  }
  function paintTeamNames() {
    document.querySelectorAll('#teams .team').forEach(function (g) {
      var nm = cap(store.teams[g.dataset.t] || ''), tn = g.querySelector('.tname');
      if (tn.textContent !== nm) tn.textContent = nm;
      g.setAttribute('aria-label', 'Shade team T' + g.dataset.t + (nm ? ' ' + nm : ''));
    });
  }
  function paintFlags() {
    document.querySelectorAll('#srows tbody.grp').forEach(function (g) {
      var f = store.flags[g.dataset.t] || '', tn = g.querySelector('.tn'); if (!tn) return;
      if (f) { tn.dataset.flag = f; tn.title = 'Check: ' + f + ' (double-click to edit)'; } else { delete tn.dataset.flag; tn.title = 'Double-click to edit'; }
    });
  }
  function paintTotal() {}
  function showErr(m) { var e = document.getElementById('saveerr'); e.textContent = m || ''; e.hidden = !m; alignProgram(); }
  try { var ls = JSON.parse(localStorage.getItem(LS) || 'null'); if (ls && ls.names && ls.teams) { store = ls; if (!store.moves) store.moves = {}; if (!store.need) store.need = {}; if (!store.deleted) store.deleted = {}; if (!store.gone) store.gone = {}; if (!store.added) store.added = {}; if (!store.assign) store.assign = {}; if (!store.flags) store.flags = {}; if (!store.pseat) store.pseat = {}; if (!store.ptype) store.ptype = {}; if (!store.pkind) store.pkind = {}; } } catch (e) {}
  paint();
  if (window.claude && window.claude.use) window.claude.use('db').then(function (d) {
    if (!d) return;
    d = msDb(d);   // program and seating collections of the milestone shown
    db = d;
    d.collection('moves').onSnapshot(function (snap) {
      var m = {};
      snap.docs.forEach(function (doc) { var b = doc.data(); if (b && isFinite(b.x) && isFinite(b.y)) m[doc.id] = { x: +b.x, y: +b.y }; });
      if (dragT && store.moves[dragT]) m[dragT] = store.moves[dragT];
      store.moves = m; relayout();
    }, function () {});
    ['names', 'teams', 'flags'].forEach(function (k) {
      d.collection(k).onSnapshot(function (snap) {
        var n = {};
        snap.docs.forEach(function (doc) { var b = doc.data(); if (b && b.name) n[doc.id] = String(b.name); });
        store[k] = n; paint();
      }, function () { showErr('Saved names could not be loaded. Edits stay on this device only.'); db = null; });
    });
    d.collection('pseat').onSnapshot(function (snap) {
      var n = {};
      snap.docs.forEach(function (doc) { var b = doc.data(); if (b && b.s) n[doc.id] = String(b.s); });
      store.pseat = n; relayout();
    }, function () {});
    d.collection('assign').onSnapshot(function (snap) {
      var n = {};
      snap.docs.forEach(function (doc) { var b = doc.data(); if (b && Array.isArray(b.s)) n[doc.id] = b.s.map(String); });
      store.assign = n; relayout();
    }, function () {});
    d.collection('added').onSnapshot(function (snap) {
      var n = {};
      snap.docs.forEach(function (doc) { var b = doc.data(); if (b && isFinite(b.order)) n[doc.id] = { order: +b.order }; });
      store.added = n; syncAdded(); paint(); relayout();
    }, function () {});
    d.collection('gone').onSnapshot(function (snap) {
      var n = {};
      snap.docs.forEach(function (doc) { var b = doc.data(); if (b && b.on) n[doc.id] = true; });
      store.gone = n; relayout();
    }, function () {});
    d.collection('deleted').onSnapshot(function (snap) {
      var n = {};
      snap.docs.forEach(function (doc) { var b = doc.data(); if (b && b.on) n[doc.id] = true; });
      store.deleted = n; relayout();
    }, function () {});
    setTimeout(function () { backfillShell(d); Promise.resolve(backfillOsh(d)).then(function () { backfillElements(d); }); }, 1500);
    d.collection('ptype').onSnapshot(function (snap) {
      var n = {};
      snap.docs.forEach(function (doc) { var b = doc.data(); if (b && b.t) n[doc.id] = String(b.t); });
      store.ptype = n; relayout();
    }, function () {});
    d.collection('pkind').onSnapshot(function (snap) {
      var n = {};
      snap.docs.forEach(function (doc) { var b = doc.data(); if (b && b.on) n[doc.id] = true; });
      store.pkind = n; relayout();
    }, function () {});
    d.collection('need').onSnapshot(function (snap) {
      var n = {};
      snap.docs.forEach(function (doc) { var b = doc.data(); if (b && isFinite(b.n)) n[doc.id] = String(Math.round(b.n)); });
      store.need = n; paint();
    }, function () {});
  });
  function save(k, id, val) {
    val = val.trim();
    if (k === 'names' || k === 'teams') val = cap(val);
    if (k === 'need') {
      if (val !== '' && !/^[0-9]{1,3}$/.test(val)) { showErr('Seats needed must be a whole number.'); return; }
      if (val !== '') val = String(parseInt(val, 10));
      var def = document.querySelector('.cnt[data-id="' + id + '"]').dataset.def;
      if (val === def) val = '';
      showErr('');
    }
    if ((store[k][id] || '') === val) return;
    pushStep([[k, id, clone(store[k][id])]]);
    if (val) store[k][id] = val; else delete store[k][id];
    paint();
    if (db) {
      var ref = db.collection(k).doc(String(id));
      (val ? ref.set(k === 'need' ? { n: +val } : { name: val }) : ref.delete()).then(function () { showErr(''); }, function () {
        showErr('Not saved. You may not have edit access to this page.');
      });
    } else {
      try { localStorage.setItem(LS, JSON.stringify(store)); } catch (e) {}
    }
  }
  document.getElementById('srows').addEventListener('dblclick', function (e) {
    var c = e.target.closest('.ed'); if (!c || c.querySelector('input')) return;
    var k = c.dataset.k, id = c.dataset.id;
    var inp = document.createElement('input');
    inp.type = 'text'; inp.id = 'ed-' + k + '-' + id; inp.value = store[k][id] || c.dataset.def || ''; if (k === 'need') inp.inputMode = 'numeric';
    inp.setAttribute('aria-label', (k === 'teams' ? 'Name for team T' : k === 'need' ? 'Seats needed for team T' : 'Name for seat ') + id);
    c.textContent = ''; c.appendChild(inp); inp.focus(); inp.select();
    var done = false;
    function finish(keep) { if (done) return; done = true; var v = inp.value; c.removeChild(inp); if (keep) { var was = store[k][id] || ''; save(k, id, v); if ((k === 'teams' || k === 'need') && store.flags[id] && (store[k][id] || '') !== was) save('flags', id, ''); } paint(); }
    inp.addEventListener('keydown', function (ev) { ev.stopPropagation(); if (ev.key === 'Enter') finish(true); else if (ev.key === 'Escape') finish(false); });
    inp.addEventListener('blur', function () { finish(true); });
    inp.addEventListener('click', function (ev) { ev.stopPropagation(); });
  });
  // the Type cell: one click opens a list of the allowed types (nothing else can be entered)
  document.getElementById('srows').addEventListener('click', function (e) {
    var c = e.target.closest('td.ty'); if (!c) return;
    e.stopPropagation();
    if (c.querySelector('select')) return;
    var r = c.closest('tr.m'), id = r.dataset.s, cur = store.ptype[id] || '', auto = c.classList.contains('auto') ? c.textContent : '';
    var sel = document.createElement('select');
    sel.id = 'ed-ptype-' + id; sel.setAttribute('aria-label', 'Desk type');
    [['', 'Automatic' + (auto ? ' (' + auto + ')' : '')], ['OS', 'OS · open space'], ['OSH', 'OSH · open space hidden'], ['S', 'S · single room'], ['M', 'M · manager room'], ['C', 'C · C-level room']].concat(R_TYPES.map(function (t) { return [t, t + ' · room for ' + t.slice(1)]; })).forEach(function (o) {
      var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; if (o[0] === cur) op.selected = true; sel.appendChild(op);
    });
    c.textContent = ''; c.appendChild(sel); sel.focus();
    try { if (sel.showPicker) sel.showPicker(); } catch (err) {}
    var done = false;
    function finish(keep) {
      if (done) return; done = true; var v = sel.value; c.removeChild(sel);
      if (keep && (store.ptype[id] || '') !== v) { showErr(''); pushStep([['ptype', id, store.ptype[id] || null]]); writePtype(id, v || null); }
      relayout();
    }
    sel.addEventListener('change', function () { finish(true); });
    sel.addEventListener('keydown', function (ev) { ev.stopPropagation(); if (ev.key === 'Escape') finish(false); else if (ev.key === 'Enter') finish(true); });
    sel.addEventListener('blur', function () { finish(false); });
    sel.addEventListener('click', function (ev) { ev.stopPropagation(); });
  }, true);
  var teamsG = document.getElementById('teams');
  // Shading follows the desks a team holds now (its own, the ones Suggest gave it, or the ones a drag gave it).
  var SHADED = {}, CUR = {};
  function paintShade() {
    var on = {};
    Object.keys(SHADED).forEach(function (t) {
      (CUR[t] || Array.prototype.map.call(document.querySelectorAll('#desks .dk[data-t="' + t + '"]'), function (d) { return d.dataset.s; })).forEach(function (s) { on[s] = true; });
    });
    document.querySelectorAll('.dk').forEach(function (d) { d.classList.toggle('th', !!on[d.dataset.s]); });
  }
  function shade(t, on) {
    var g = teamsG.querySelector('.team[data-t="' + t + '"]');
    if (g) g.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) SHADED[t] = true; else delete SHADED[t];
    paintShade();
    document.querySelectorAll('.lead[data-t="' + t + '"]').forEach(function (l) { l.classList.toggle('on', on); });
    var grp = document.querySelector('tbody.grp[data-t="' + t + '"]');
    if (grp) grp.classList.toggle('on', on);
    document.querySelectorAll('#summ .tbtn[data-t="' + t + '"]').forEach(function (b) { b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  }
  function shadeTeam(g) {
    var on = g.getAttribute('aria-pressed') !== 'true';
    shade(g.dataset.t, on);
  }
  teamsG.addEventListener('click', function (e) {
    var g = e.target.closest('.team'); if (!g) return;
    if (justDragged) { justDragged = false; return; }
    shadeTeam(g);
  });
  teamsG.addEventListener('keydown', function (e) {
    var g = e.target.closest('.team');
    if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); shadeTeam(g); }
  });
