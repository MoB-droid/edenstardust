// ---- Milestones (set by the user 19 Nov 2026). Each milestone keeps its own program and seating (the collections in
// MS_COLS, stored as "<collection>@<milestone id>"; the first milestone "m0" uses the plain names); the layout, title and
// files are shared. The list and the milestone shown are kept in meta / milestones. + copies the LAST milestone and opens
// the copy; changes then go to that milestone only, earlier ones stay as they were. Switching reloads the page.
// seat types R2…R10: a desk in a closed room for N people (set by the user 24 Nov 2026)
var R_TYPES = ['R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10'];
var MS_COLS = { names: 1, teams: 1, need: 1, moves: 1, assign: 1, deleted: 1, gone: 1, added: 1, flags: 1, pseat: 1, ptype: 1, pkind: 1 };
var MS = { list: [{ id: 'm0', label: '' }], active: 'm0', db: null };
function msCol(c, id) { id = id || MS.active; return MS_COLS[c] && id !== 'm0' ? c + '@' + id : c; }
// the editor's db, routed to the milestone shown. Live listeners are kept so a switch re-points them in place (no reload:
// the floor plan stays, only the teams and seating change); the first snapshots after a switch are applied together.
function msDb(d) {
  if (!d || d.__raw) return d;
  var subs = [], initPending = 0;
  var w = { __raw: d,
    collection: function (c) {
      if (!MS_COLS[c]) return d.collection(c);
      return { doc: function (id) { return d.collection(msCol(c)).doc(id); },
        get: function () { return d.collection(msCol(c)).get(); },
        onSnapshot: function (fn, err) {
          var sub = { c: c, fn: fn, err: err }; initPending++;
          // when every listener has had its first data, the plan is loaded: seat teams that were never seated
          sub.off = d.collection(msCol(c)).onSnapshot(function (snap) {
            fn(snap);
            if (!sub.seen) { sub.seen = true; if (--initPending === 0) setTimeout(msLoaded, 0); }
          }, err);
          subs.push(sub);
          return function () { if (typeof sub.off === 'function') sub.off(); subs = subs.filter(function (x) { return x !== sub; }); };
        } };
    },
    doc: function (p) { var s = String(p).split('/'); return d.doc(msCol(s[0]) + '/' + s.slice(1).join('/')); },
    resub: function (done) {
      var pending = subs.length, buf = [];
      if (!pending) { if (done) done(); return; }
      subs.forEach(function (sub) {
        try { if (typeof sub.off === 'function') sub.off(); } catch (e) {}
        var first = true;
        sub.off = d.collection(msCol(sub.c)).onSnapshot(function (snap) {
          if (!first) return sub.fn(snap);
          first = false; buf.push([sub.fn, snap]);
          if (--pending === 0) { buf.forEach(function (b) { try { b[0](b[1]); } catch (e) {} }); if (done) done(); setTimeout(msLoaded, 0); }
        }, sub.err);
      });
    } };
  MS.wrapped = w;
  return w;
}
function msLoaded() { if (window.__autoSuggest) window.__autoSuggest(); }
// open another milestone in place: undo history and listeners follow, the background plan is not redrawn
// done (optional): called once the milestone's program and seating are loaded
function msShow(id, done) {
  MS.active = id;
  if (window.__msSwitched) window.__msSwitched();
  msRender();
  if (MS.wrapped) MS.wrapped.resub(function () { lnote(''); if (done) setTimeout(done, 30); }); else location.reload();
}
// Sheet tabs = milestones (set by the user 24 Nov 2026): the milestone for each tab name, in tab order. A milestone
// whose label is the tab name; else the next one with no label of its own ("Start" or a date), which takes the tab
// name; else a new empty milestone at the end of the line. Saves the list; returns the milestone ids.
function msForTabs(names) {
  var ids = [], used = {};
  function norm(v) { return String(v || '').trim().toLowerCase(); }
  function generic(m) { var l = String(m.label || '').trim(); return !l || /^start$/i.test(l) || /^\d{1,2} [A-Za-z]{3,9}\.? \d{4}$/.test(l) || /^\d{4}-\d{2}-\d{2}$/.test(l); }
  names.forEach(function (n, i) { MS.list.some(function (m) { if (!used[m.id] && norm(m.label) === norm(n)) { ids[i] = m.id; used[m.id] = 1; return true; } return false; }); });
  names.forEach(function (n, i) {
    if (ids[i]) return;
    var m = MS.list.filter(function (x) { return !used[x.id] && generic(x); })[0];
    if (!m) { m = { id: 'm' + Date.now().toString(36) + i, label: '' }; MS.list.push(m); }
    m.label = String(n).trim().slice(0, 60); ids[i] = m.id; used[m.id] = 1;
  });
  return ids;
}
function msLoad() {
  if (!(window.claude && window.claude.use)) return Promise.resolve();
  return window.claude.use('db').then(function (d) {
    if (!d) return;
    MS.db = d;
    return d.doc('meta/milestones').get().then(function (s) {
      var v = s && s.exists ? s.data() : null;
      if (v && Array.isArray(v.list) && v.list.length) {
        MS.list = v.list.filter(function (m) { return m && m.id; });
        MS.active = MS.list.some(function (m) { return m.id === v.active; }) ? v.active : MS.list[MS.list.length - 1].id;
      }
    });
  }).catch(function () {});
}
function msToday() { try { return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return new Date().toISOString().slice(0, 10); } }
function msSave() { return MS.db.doc('meta/milestones').set({ list: MS.list, active: MS.active }); }
function msGo(id) {
  if (id === MS.active) return;
  msShow(id);
  msSave().catch(function () {});
}
// + : copy every program and seating collection of the last milestone into a new one, then open it
function msAdd(btn) {
  var last = MS.list[MS.list.length - 1].id, id = 'm' + Date.now().toString(36), d = MS.db, jobs = [];
  btn.disabled = true; lnote('Making a new milestone…', true);
  var p = Promise.resolve();
  Object.keys(MS_COLS).forEach(function (c) {
    p = p.then(function () { return d.collection(msCol(c, last)).get(); }).then(function (snap) {
      snap.docs.forEach(function (doc) { jobs.push([msCol(c, id), doc.id, doc.data()]); });
    });
  });
  p.then(function () {
    var q = Promise.resolve();
    for (var i = 0; i < jobs.length; i += 20) (function (part) {
      q = q.then(function () { return Promise.all(part.map(function (j) { return d.collection(j[0]).doc(j[1]).set(j[2]); })); });
    })(jobs.slice(i, i + 20));
    return q;
  }).then(function () {
    MS.list.push({ id: id, label: msToday() });
    msShow(id);
    return msSave();
  }).then(function () { btn.disabled = false; }, function () { btn.disabled = false; lnote('Could not make the milestone. Try again.'); });
}
function msEdit(m, lab) {
  if (lab.querySelector('input')) return;
  var inp = document.createElement('input'); inp.type = 'text'; inp.value = m.label || ''; inp.setAttribute('aria-label', 'Milestone text');
  lab.textContent = ''; lab.appendChild(inp); inp.focus(); inp.select();
  var done = false;
  function fin(save) {
    if (done) return; done = true;
    if (save) { m.label = inp.value.trim().slice(0, 60); msSave().catch(function () {}); }
    msRender();
  }
  inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') fin(true); else if (e.key === 'Escape') fin(false); e.stopPropagation(); });
  inp.addEventListener('blur', function () { fin(true); });
}
// drag a dot along the line: the others make room as it passes them; dropping saves the new order (no switch)
function msDrag(w, e) {
  if (e.button !== undefined && e.button !== 0) return;
  var track = w.parentNode, x0 = e.clientX, moved = false;
  function mv(ev) {
    if (!moved && Math.abs(ev.clientX - x0) < 6) return;
    if (!moved) { moved = true; w.classList.add('drag'); }
    ev.preventDefault();
    var others = Array.prototype.slice.call(track.querySelectorAll('.tl-ms')).filter(function (i) { return i !== w; });
    var before = null;
    others.some(function (i) { var r = i.getBoundingClientRect(); if (ev.clientX < r.left + r.width / 2) { before = i; return true; } return false; });
    if (before) { if (w.nextSibling !== before) track.insertBefore(w, before); }
    else if (track.lastChild !== w) track.appendChild(w);
  }
  function up() {
    window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
    w.classList.remove('drag');
    if (!moved) return;
    MS.dragged = Date.now();
    var ids = Array.prototype.slice.call(track.querySelectorAll('.tl-ms')).map(function (i) { return i.dataset.id; });
    var order = ids.map(function (id) { return MS.list.filter(function (x) { return x.id === id; })[0]; }).filter(Boolean);
    if (order.length === MS.list.length && order.some(function (x, i) { return x !== MS.list[i]; })) { MS.list = order; msSave().catch(function () {}); }
    msRender();
  }
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
}
// keyboard: Shift + Left / Right moves the milestone one place
function msNudge(m, k) {
  var i = MS.list.indexOf(m), j = i + k; if (i < 0 || j < 0 || j >= MS.list.length) return;
  MS.list.splice(i, 1); MS.list.splice(j, 0, m); msSave().catch(function () {}); msRender();
  var d = document.querySelectorAll('.tl-dot')[j]; if (d) d.focus();
}
function msRender() {
  var el = document.getElementById('tline'); if (!el || !MS.db) return;
  el.hidden = false; el.innerHTML = '';
  var add = document.createElement('button');
  add.type = 'button'; add.className = 'tl-add tip'; add.textContent = '+'; add.dataset.tip = 'add a milestone (copies the last one)'; add.setAttribute('aria-label', 'Add a milestone');
  add.addEventListener('click', function () { msAdd(add); });
  var track = document.createElement('div'); track.className = 'tl-track';
  MS.list.forEach(function (m) {
    var on = m.id === MS.active, w = document.createElement('div'); w.className = 'tl-ms' + (on ? ' on' : ''); w.dataset.id = m.id;
    var dot = document.createElement('button'); dot.type = 'button'; dot.className = 'tl-dot'; dot.setAttribute('aria-pressed', on ? 'true' : 'false');
    var txt = m.label || (m.id === 'm0' ? 'Start' : msToday());
    dot.setAttribute('aria-label', (on ? 'Milestone shown: ' : 'Open milestone ') + txt); dot.title = (on ? 'Shown now · tap to write its text' : 'Open ' + txt) + ' · drag to move it';
    var lab = document.createElement('span'); lab.className = 'tl-lab'; lab.textContent = txt; lab.title = 'Tap to write text';
    dot.addEventListener('click', function () { if (MS.dragged && Date.now() - MS.dragged < 400) return; if (on) msEdit(m, lab); else msGo(m.id); });
    dot.addEventListener('pointerdown', function (e) { msDrag(w, e); });
    dot.addEventListener('keydown', function (e) { if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); msNudge(m, e.key === 'ArrowLeft' ? -1 : 1); } });
    lab.addEventListener('click', function () { msEdit(m, lab); });
    w.appendChild(dot); w.appendChild(lab); track.appendChild(w);
  });
  el.appendChild(add); el.appendChild(track);
}
function START() {
  renderLayout(EMBED);
  pickLayout().then(function (L) { if (L) renderLayout(L); return msLoad(); }).then(function () { MAIN(); watchPlan(); msRender(); });
}

