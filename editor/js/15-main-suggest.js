  // ---- Suggest: seat every team following the rules. The rules run on the server (the brain): this page sends where
  // the benches, desks and teams are, and applies the answer (one undo step).
  // automatic Suggest (set by the user 19 Nov 2026): when a plan or a milestone opens, teams that were never seated
  // (no Suggest result, never dragged) are seated at once; plans already seated are left exactly as they are
  window.__autoSuggest = function () {
    if (!allDesks.length) return;
    var todo = addedIds().some(function (t) { return !store.deleted[t] && !store.assign[t] && !store.moves[t] && +(store.need[t] || 0) > 0; });
    if (todo) suggest();
  };
  // The answer comes back a moment later: suggestDone resolves when the seating is applied (whoever needs the seating
  // finished waits for it). A Suggest asked for while one is running runs right after it, on the fresh state.
  var suggesting = false, suggestAgain = false, suggestDone = Promise.resolve();
  function suggest() {
    if (suggesting) { suggestAgain = true; return suggestDone; }
    var msAt = MS.active;
    function current(t) {
      if (store.assign[t]) return store.assign[t].map(function (id) { return deskBy[id]; }).filter(Boolean);
      return Array.prototype.slice.call(document.querySelectorAll('#desks .dk[data-t="' + t + '"]')).filter(function (d) { return !store.gone[d.dataset.s]; });
    }
    function needFor(t) {
      var c = document.querySelector('.cnt[data-k="need"][data-id="' + t + '"]');
      return +((c && c.textContent) || 0);
    }
    function homeOf(t) {
      if (store.moves[t]) return store.moves[t];
      var cur = current(t);
      if (cur.length) { var c = cur.map(ctr); return { x: c.reduce(function (s, p) { return s + p.x; }, 0) / c.length, y: c.reduce(function (s, p) { return s + p.y; }, 0) / c.length }; }
      var r = document.querySelector('#teams .team[data-t="' + t + '"] rect'); return { x: +r.getAttribute('x') + +r.getAttribute('width') / 2, y: +r.getAttribute('y') + 32 };
    }
    var live = teamIds.filter(function (t) { return !store.deleted[t]; });
    var kindSteps = captureKinds(live), sNeed = {}, hNeed = {};
    live.forEach(function (t) {
      var n = needFor(t), k = 0;
      document.querySelectorAll('#srows tbody.grp[data-t="' + t + '"] tr.m').forEach(function (r) {
        if (k >= n || r.classList.contains('pgone')) return; k++;
        if (rowSingle(r.dataset.s)) sNeed[t] = (sNeed[t] || 0) + 1;
        else if (rowHidden(r.dataset.s)) hNeed[t] = (hNeed[t] || 0) + 1;
      });
    });
    var desk = {};
    allDesks.forEach(function (d) { var c = ctr(d); desk[d.dataset.s] = { x: c.x, y: c.y, osh: isOshDesk(d) ? 1 : 0 }; });
    var q = {
      benches: BENCH.map(function (b) { return { x: b.x, y: b.y, desks: b.desks.map(function (d) { return d.dataset.s; }) }; }),
      desk: desk,
      teams: live.map(function (t) {
        var mine = []; current(t).forEach(function (d) { var b = +d.dataset.bench; if (mine.indexOf(b) < 0) mine.push(b); });
        return { t: t, need: needFor(t), home: homeOf(t), moved: !!store.moves[t], mine: mine, sNeed: sNeed[t] || 0, hNeed: hNeed[t] || 0 };
      })
    };
    suggesting = true;
    suggestDone = brain('suggest', null, q).then(function (ans) {
      suggesting = false;
      if (MS.active !== msAt) return;   // the milestone changed meanwhile: this answer is for another program
      var res = (ans && ans.res) || {};
      // save: one undo step for the whole suggestion
      var step = kindSteps.slice();
      live.forEach(function (t) { step.push(['assign', t, clone(store.assign[t])]); if (store.moves[t]) step.push(['moves', t, clone(store.moves[t])]); });
      var pIds = Object.keys(store.pseat); pIds.forEach(function (id) { step.push(['pseat', id, store.pseat[id]]); });
      pushStep(step);
      pIds.forEach(function (id) { writePseat(id, null); });   // Suggest re-seats everyone: personal moves are cleared
      live.forEach(function (t) {
        var ids = (res[t] || []).map(String);
        var own = Array.prototype.slice.call(document.querySelectorAll('#desks .dk[data-t="' + t + '"]')).filter(function (d) { return !store.gone[d.dataset.s]; }).map(function (d) { return d.dataset.s; });
        var sameAsOwn = ids.length && ids.length <= own.length && ids.every(function (id) { return own.indexOf(id) >= 0; }) && own.slice(0, ids.length).every(function (id) { return ids.indexOf(id) >= 0; });
        if (store.moves[t]) writeMove(t, null);
        writeAssign(t, sameAsOwn ? null : ids);
      });
      relayout();
      showErr('');
    }, function (e) {
      suggesting = false;
      showErr(e && e.code === 'nobrain' ? 'Suggest works on edenstardust.com (this page is a preview).' : 'Suggest could not reach the server. Check the connection and try again.');
    }).then(function () { if (suggestAgain) { suggestAgain = false; return suggest(); } });
    return suggestDone;
  }
  document.getElementById('suggest').addEventListener('click', suggest);
