  // ---- Suggest: seat every team following the rules.
  // Rule 1 (no overlaps): teams that were dragged keep the desks nearest their drop point; any team pushed off
  // its desks moves to the nearest free benches, and so on, until no desk has two teams.
  // Rule 2 (no mixing): a bench belongs to one team only; a team's leftover desks on its bench stay empty.
  // Rule 4 (keep the team together): a team is placed as one compact group of benches, not scattered (see groupNear).
  // Rule 5 (fill the bench): a team fills each bench before starting another; nobody sits alone on a new bench (byBench).
  // automatic Suggest (set by the user 19 Nov 2026): when a plan or a milestone opens, teams that were never seated
  // (no Suggest result, never dragged) are seated at once; plans already seated are left exactly as they are
  window.__autoSuggest = function () {
    if (!allDesks.length) return;
    var todo = addedIds().some(function (t) { return !store.deleted[t] && !store.assign[t] && !store.moves[t] && +(store.need[t] || 0) > 0; });
    if (todo) suggest();
  };
  function suggest() {
    var taken = {}, res = {}, short = [];
    function dist(a, b) { return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2)); }
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
    // single-desk people (sNeed) get single desks near the team; everyone else gets connected desks (benches of 2+)
    function isOne(i) { return BENCH[i].desks.length === 1; }
    // Rule 5 (fill the bench): a team fills each of its benches before using another; only one bench can be partly
    // used, and its empty seats are the ones farthest from the rest of the team (so nobody sits alone on a new bench)
    function byBench(list, n) {
      if (!list.length || n <= 0) return [];
      list = pruneBenches(list, n, function (i) { return BENCH[i].desks.length; });
      var all = []; list.forEach(function (i) { all = all.concat(BENCH[i].desks); });
      var c = all.map(ctr), gc = { x: c.reduce(function (s, q) { return s + q.x; }, 0) / c.length, y: c.reduce(function (s, q) { return s + q.y; }, 0) / c.length };
      var order = list.slice().sort(function (a, b) { return dist(gc, BENCH[a]) - dist(gc, BENCH[b]); }), out = [];
      order.forEach(function (i) {
        if (out.length >= n) return;
        var ds = BENCH[i].desks.slice().sort(function (a, b) { return dist(gc, ctr(a)) - dist(gc, ctr(b)); });
        out = out.concat(ds.slice(0, n - out.length));
      });
      return out;
    }
    // Rule 4 (keep the team together): grow the team bench by bench from its own desks (or from one of the ~10 free
    // benches nearest its home), always taking the free bench closest to the desks it already has. Of these candidate
    // groups, take the one whose desks are closest together; being a little farther from home matters less.
    function cc(d) { return d._c || (d._c = ctr(d)); }
    function groupNear(base, need, h) {
      var baseDesks = []; base.forEach(function (i) { baseDesks = baseDesks.concat(BENCH[i].desks); });
      var free = []; BENCH.forEach(function (b, i) { if (!(i in taken) && b.desks.length > 1) free.push(i); });
      if (!free.length) return [];
      var seeds = base.length ? [null] : free.slice().sort(function (a, b) { return dist(h, BENCH[a]) - dist(h, BENCH[b]); }).slice(0, 10);
      var best = null;
      seeds.forEach(function (seed) {
        var sel = [], pts = baseDesks.map(cc), have = 0, used = {};
        function add(i) { used[i] = 1; sel.push(i); BENCH[i].desks.forEach(function (d) { pts.push(cc(d)); }); have += BENCH[i].desks.length; }
        if (seed !== null) add(seed);
        while (have < need) {
          var bi = -1, bs = Infinity, left = need - have;
          free.forEach(function (i) {
            if (used[i]) return;
            var b = BENCH[i], gd = Infinity;
            if (pts.length) pts.forEach(function (q) { var dd = Math.sqrt(Math.pow(q.x - b.x, 2) + Math.pow(q.y - b.y, 2)); if (dd < gd) gd = dd; });
            else gd = dist(h, b);
            var sc = gd + 60 * Math.max(0, b.desks.length - left) + (b.desks.length < left ? 40 : 0);
            if (sc < bs) { bs = sc; bi = i; }
          });
          if (bi < 0) break;
          add(bi);
        }
        var cx = pts.reduce(function (s, q) { return s + q.x; }, 0) / pts.length, cy = pts.reduce(function (s, q) { return s + q.y; }, 0) / pts.length;
        var spread = pts.reduce(function (s, q) { return s + Math.sqrt(Math.pow(q.x - cx, 2) + Math.pow(q.y - cy, 2)); }, 0) / pts.length;
        var cost = 2 * spread + 0.5 * Math.sqrt(Math.pow(cx - h.x, 2) + Math.pow(cy - h.y, 2)) + 30 * Math.max(0, have - need) + (have < need ? 1e6 : 0);
        if (!best || cost < best.cost) best = { cost: cost, sel: sel };
      });
      return best ? best.sel : [];
    }
    function fill(t, n, keep) {
      var h = homeOf(t), nS = Math.min(n, sNeed[t] || 0), nO = n - nS;
      keep.forEach(function (i) { if (isOne(i) && taken[i] === t) delete taken[i]; });   // single desks are chosen again, near the team
      var got = keep.filter(function (i) { return !isOne(i); }), cap = got.reduce(function (s, i) { return s + BENCH[i].desks.length; }, 0);
      function pick(left, h0, kind) {
        var best = -1, bs = Infinity;
        BENCH.forEach(function (b, i) {
          if (i in taken) return;
          if (kind === 'multi' && isOne(i)) return;
          if (kind === 'one' && !isOne(i)) return;
          // nearest first; penalties for desks left empty and for splitting the team over several benches
          var sc = dist(h0, b) + (kind === 'one' ? 0 : 60 * Math.max(0, b.desks.length - left) + (b.desks.length < left ? 500 : 0));
          if (sc < bs) { bs = sc; best = i; }
        });
        return best;
      }
      // connected desks first, as one compact group (rule 4)
      if (cap < nO) groupNear(got, nO - cap, h).forEach(function (b1) { taken[b1] = t; got.push(b1); cap += BENCH[b1].desks.length; });
      var osDesks = byBench(got, nO);
      // OSH people: the team's open-space desks must include enough OSH desks; add the nearest free benches that have them
      var hN = Math.min(nO, hNeed[t] || 0);
      if (hN) {
        var oshIn = function () { var c = 0; got.forEach(function (i) { if (!isOne(i)) BENCH[i].desks.forEach(function (d) { if (isOshDesk(d)) c++; }); }); return c; };
        var hc0 = osDesks.length ? ctr(osDesks[0]) : h;
        while (oshIn() < hN) {
          var bi = -1, bd = Infinity;
          BENCH.forEach(function (b, i) { if (i in taken || isOne(i) || !b.desks.some(isOshDesk)) return; var dd = dist(hc0, b); if (dd < bd) { bd = dd; bi = i; } });
          if (bi < 0) break;
          taken[bi] = t; got.push(bi);
        }
        var pool = []; got.forEach(function (i) { if (!isOne(i)) pool = pool.concat(BENCH[i].desks); });
        var hs = pool.filter(isOshDesk).sort(function (a, b) { return dist(hc0, ctr(a)) - dist(hc0, ctr(b)); }).slice(0, hN);
        osDesks = hs.concat(byBench(got.filter(function (i) { return !isOne(i); }), nO).filter(function (d) { return hs.indexOf(d) < 0; })).slice(0, nO);
      }
      // then the single desks nearest the team's connected desks
      var hc = osDesks.length ? (function () { var c = osDesks.map(ctr); return { x: c.reduce(function (s, q) { return s + q.x; }, 0) / c.length, y: c.reduce(function (s, q) { return s + q.y; }, 0) / c.length }; })() : h;
      var ones = [];
      while (ones.length < nS) { var b2 = pick(1, hc, 'one'); if (b2 < 0) break; taken[b2] = t; got.push(b2); ones.push(BENCH[b2].desks[0]); }
      // not enough of one kind: take any free desks near the team
      var all = osDesks.concat(ones), extra = [];
      while (all.length + extra.length < n) {
        var b3 = pick(n - all.length - extra.length, hc, 'any'); if (b3 < 0) break;
        taken[b3] = t; got.push(b3); extra = extra.concat(BENCH[b3].desks);
      }
      extra.sort(function (a, b) { return dist(hc, ctr(a)) - dist(hc, ctr(b)); });
      res[t] = all.concat(extra).slice(0, n);
      if (res[t].length < n) short.push(t);
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
    var moved = live.filter(function (t) { return store.moves[t]; }), rest = live.filter(function (t) { return !store.moves[t]; });
    moved.forEach(function (t) { fill(t, needFor(t), []); });
    var pending = [];
    rest.forEach(function (t) {
      var n = needFor(t), h = homeOf(t), keep = [], cap = 0;
      var mineB = [];
      current(t).forEach(function (d) { var b = +d.dataset.bench; if (mineB.indexOf(b) < 0) mineB.push(b); });
      mineB.sort(function (a, b) { return dist(h, BENCH[a]) - dist(h, BENCH[b]); });
      mineB.forEach(function (b) { if (cap < n && !(b in taken)) { taken[b] = t; keep.push(b); cap += BENCH[b].desks.length; } });
      if (cap >= n) { fill(t, n, keep); } else pending.push({ t: t, n: n, keep: keep });
    });
    pending.sort(function (a, b) { return b.n - a.n; }).forEach(function (p) { fill(p.t, p.n, p.keep); });
    // Rule 3 (seat as many as possible): bigger teams come first. If a team is short, take out the smallest
    // seated team that is smaller than it, re-seat the short team, then try to fit the small team elsewhere.
    // A small team that no longer fits is left out completely and shown as short by its whole size.
    var needs = {}; live.forEach(function (t) { needs[t] = needFor(t); });
    function release(t) { Object.keys(taken).forEach(function (b) { if (taken[b] === t) delete taken[b]; }); res[t] = []; }
    function benchesOf(t) { return Object.keys(taken).filter(function (b) { return taken[b] === t; }).map(Number); }
    function isShort(t) { return (res[t] || []).length < needs[t]; }
    function seatedCount() { return live.reduce(function (s, t) { return s + Math.min((res[t] || []).length, needs[t]); }, 0); }
    var out = {}, guard = 0;
    while (guard++ < 60) {
      var sh = live.filter(function (t) { return needs[t] > 0 && isShort(t) && !out[t]; }).sort(function (a, b) { return needs[b] - needs[a]; });
      if (!sh.length) break;
      var S = sh[0];
      var victims = live.filter(function (t) { return t !== S && !out[t] && (res[t] || []).length && needs[t] < needs[S]; })
        .sort(function (a, b) { return needs[a] - needs[b]; });
      if (!victims.length) { out[S] = 'partial'; continue; }
      // try each smaller team (smallest first); keep the change only if more people end up seated
      var done = false;
      for (var vi = 0; vi < victims.length && !done; vi++) {
        var E = victims[vi];
        var snapT = JSON.parse(JSON.stringify(taken)), snapR = {};
        Object.keys(res).forEach(function (t) { snapR[t] = res[t].slice(); });
        var before = seatedCount();
        release(E);
        var keepS = benchesOf(S); release(S); keepS.forEach(function (b) { taken[b] = S; });
        fill(S, needs[S], keepS);
        fill(E, needs[E], []);
        if (isShort(E)) release(E);
        if (seatedCount() > before) { if (!(res[E] || []).length) out[E] = 'all'; done = true; }
        else { taken = snapT; res = snapR; }
      }
      if (!done) out[S] = 'partial';
    }
    short = live.filter(function (t) { return needs[t] > 0 && isShort(t); });
    // save: one undo step for the whole suggestion
    var step = kindSteps.slice();
    live.forEach(function (t) { step.push(['assign', t, clone(store.assign[t])]); if (store.moves[t]) step.push(['moves', t, clone(store.moves[t])]); });
    var pIds = Object.keys(store.pseat); pIds.forEach(function (id) { step.push(['pseat', id, store.pseat[id]]); });
    pushStep(step);
    pIds.forEach(function (id) { writePseat(id, null); });   // Suggest re-seats everyone: personal moves are cleared
    live.forEach(function (t) {
      var ids = (res[t] || []).map(function (d) { return d.dataset.s; });
      var own = Array.prototype.slice.call(document.querySelectorAll('#desks .dk[data-t="' + t + '"]')).filter(function (d) { return !store.gone[d.dataset.s]; }).map(function (d) { return d.dataset.s; });
      var sameAsOwn = ids.length && ids.length <= own.length && ids.every(function (id) { return own.indexOf(id) >= 0; }) && own.slice(0, ids.length).every(function (id) { return ids.indexOf(id) >= 0; });
      if (store.moves[t]) writeMove(t, null);
      writeAssign(t, sameAsOwn ? null : ids);
    });
    relayout();
    showErr('');
  }
  document.getElementById('suggest').addEventListener('click', suggest);
