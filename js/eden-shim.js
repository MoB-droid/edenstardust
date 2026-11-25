// EdenStardust: runs the Seat Plan app (built as a claude.ai artifact) on edenstardust.com.
// It provides the same window.claude.use('db' | 'assets' | 'downloads' | 'sample') the app expects,
// backed by Supabase: plan data in table plan_docs, files in the private bucket plan-files.
(function () {
  if (window.claude && window.claude.use) return;   // inside claude.ai the real runtime is used

  var SUPABASE_URL = 'https://ldvzztgzamahlftnbawr.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_1BiE8kmut-C1AbXFck3QOA_11tONrHl';
  var BUCKET = 'plan-files';
  var planId = new URLSearchParams(location.search).get('id') || '';
  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  window.__edenSb = sb;
  window.__edenPlanId = planId;
  window.__edenLS = 'edits:' + planId;

  function home() { location.replace('/'); }
  if (!/^[0-9a-f-]{36}$/i.test(planId)) { home(); return; }

  var cache = {};          // col -> { docId: data }
  var colListeners = {};   // col -> [fn]
  var docListeners = {};   // col/id -> [fn]
  var signed = {};         // '/_blob/<path>' -> signed URL
  var uid = null, planRow = null;

  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function colOf(c) { return cache[c] || (cache[c] = {}); }
  function docSnap(c, id) {
    var has = Object.prototype.hasOwnProperty.call(colOf(c), id), d = colOf(c)[id];
    return { id: id, exists: has, data: function () { return has ? clone(d) : undefined; } };
  }
  function colSnap(c) {
    var docs = Object.keys(colOf(c)).map(function (id) { return docSnap(c, id); });
    return { docs: docs, empty: !docs.length, size: docs.length, forEach: function (f) { docs.forEach(f); } };
  }
  function notify(c, id) {
    setTimeout(function () {
      (colListeners[c] || []).forEach(function (f) { try { f(colSnap(c)); } catch (e) { console.error(e); } });
      (docListeners[c + '/' + id] || []).forEach(function (f) { try { f(docSnap(c, id)); } catch (e) { console.error(e); } });
    }, 0);
  }
  function fail(error) { return Promise.reject({ code: 'save_failed', message: error && error.message }); }

  // keep the dashboard row (title, picture, seat count, last change) in step with the plan
  var touchTimer = null, pendingRow = {};
  function touchPlan(extra) {
    Object.assign(pendingRow, extra || {});
    clearTimeout(touchTimer);
    touchTimer = setTimeout(function () {
      var row = Object.assign({ updated_at: new Date().toISOString() }, pendingRow);
      pendingRow = {};
      sb.from('plans').update(row).eq('id', planId).then(function () {}, function () {});
    }, 600);
  }
  // what the dashboard should show, worked out from the plan's own data
  function rowFromCache() {
    var cur = colOf('plan').current || {}, t = colOf('meta').title;
    var title = (t && t.name) || cur.heading || 'New floor';
    return { title: String(title).replace(/^Layout\s*·\s*/, '').slice(0, 120) || 'New floor', seats: (cur.desks || []).length, thumb: cur.imgAsset || null };
  }
  // layout and title changes update the dashboard row right away (the page may reload next); the rest just mark the time
  function afterWrite(c, id) {
    if ((c === 'plan' && id === 'current') || (c === 'meta' && id === 'title')) {
      var row = Object.assign(rowFromCache(), { updated_at: new Date().toISOString() });
      return sb.from('plans').update(row).eq('id', planId).then(function () {}, function () {});
    }
    touchPlan();
  }

  // Writes go through one queue (24 Nov 2026): a sheet with several tabs makes over a thousand writes at once, and
  // sent one request each the browser dropped the last ones (a milestone got 4 of its 6 teams). Writes made in the same
  // moment are merged per document (the last one wins) and sent as a few bulk requests, one batch at a time, retried.
  var pend = new Map(), flushing = null, flushTimer = null;
  function queue(c, id, data) {
    var k = c + '\u0000' + id, old = pend.get(k), w = { c: c, id: id, data: data, waiters: old ? old.waiters : [] };
    pend.set(k, w);
    var p = new Promise(function (ok, bad) { w.waiters.push([ok, bad]); });
    if (!flushTimer) flushTimer = setTimeout(flush, 30);
    return p;
  }
  function send(fn, tries) {
    return fn().then(function (r) { if (r && r.error) throw r.error; return r; }).catch(function (e) {
      if (tries <= 1) throw e;
      return new Promise(function (ok) { setTimeout(ok, 800 * (5 - tries)); }).then(function () { return send(fn, tries - 1); });
    });
  }
  function flush() {
    flushTimer = null;
    if (flushing) { flushing.then(function () { if (pend.size && !flushTimer) flushTimer = setTimeout(flush, 0); }); return; }
    var batch = Array.from(pend.values()); pend.clear();
    if (!batch.length) return;
    var now = new Date().toISOString(), ups = batch.filter(function (w) { return w.data !== null; }), dels = batch.filter(function (w) { return w.data === null; });
    var jobs = [];
    for (var i = 0; i < ups.length; i += 400) (function (part) {
      jobs.push({ ws: part, fn: function () { return sb.from('plan_docs').upsert(part.map(function (w) { return { plan_id: planId, col: w.c, doc_id: w.id, data: w.data, updated_at: now }; })); } });
    })(ups.slice(i, i + 400));
    var byCol = {}; dels.forEach(function (w) { (byCol[w.c] = byCol[w.c] || []).push(w); });
    Object.keys(byCol).forEach(function (c) {
      for (var i = 0; i < byCol[c].length; i += 200) (function (part) {
        jobs.push({ ws: part, fn: function () { return sb.from('plan_docs').delete().eq('plan_id', planId).eq('col', c).in('doc_id', part.map(function (w) { return w.id; })); } });
      })(byCol[c].slice(i, i + 200));
    });
    flushing = jobs.reduce(function (p, j) {
      return p.then(function () {
        return send(j.fn, 4).then(function () {
          j.ws.forEach(function (w) { w.waiters.forEach(function (f) { f[0](); }); });
        }, function (e) {
          console.error('EdenStardust: save failed', e);
          j.ws.forEach(function (w) { w.waiters.forEach(function (f) { f[1]({ code: 'save_failed', message: e && e.message }); }); });
        });
      });
    }, Promise.resolve()).then(function () { flushing = null; if (pend.size && !flushTimer) flushTimer = setTimeout(flush, 0); });
  }
  // the editor waits for this before saying a long load is done; leaving the page while writes are pending asks first
  window.__edenFlush = function () {
    return new Promise(function (ok) { (function chk() { if (!pend.size && !flushing && !flushTimer) ok(); else setTimeout(chk, 100); })(); });
  };
  addEventListener('beforeunload', function (e) { if (pend.size || flushing) { e.preventDefault(); e.returnValue = ''; } });

  function docRef(c, id) {
    return {
      id: id,
      get: function () { return ready.then(function () { return docSnap(c, id); }); },
      set: function (data) {
        return ready.then(function () {
          colOf(c)[id] = clone(data) || {}; notify(c, id);
          return queue(c, id, clone(colOf(c)[id])).then(function () { return afterWrite(c, id); });
        });
      },
      update: function (part) {
        return ready.then(function () {
          colOf(c)[id] = Object.assign({}, colOf(c)[id] || {}, clone(part)); notify(c, id);
          return queue(c, id, clone(colOf(c)[id])).then(function () { return afterWrite(c, id); });
        });
      },
      delete: function () {
        return ready.then(function () {
          delete colOf(c)[id]; notify(c, id);
          return queue(c, id, null).then(function () { return afterWrite(c, id); });
        });
      },
      onSnapshot: function (fn, err) {
        var k = c + '/' + id;
        (docListeners[k] = docListeners[k] || []).push(fn);
        ready.then(function () { fn(docSnap(c, id)); }, function (e) { if (err) err(e); });
        return function () { docListeners[k] = (docListeners[k] || []).filter(function (f) { return f !== fn; }); };
      }
    };
  }
  function collection(c) {
    return {
      doc: function (id) { return docRef(c, String(id)); },
      get: function () { return ready.then(function () { return colSnap(c); }); },
      onSnapshot: function (fn, err) {
        (colListeners[c] = colListeners[c] || []).push(fn);
        ready.then(function () { fn(colSnap(c)); }, function (e) { if (err) err(e); });
        return function () { colListeners[c] = (colListeners[c] || []).filter(function (f) { return f !== fn; }); };
      }
    };
  }
  var dbApi = {
    collection: collection,
    doc: function (path) { var p = String(path).split('/'); return docRef(p[0], p.slice(1).join('/')); }
  };

  var assetsApi = {
    upload: function (blob, opts) {
      if (blob.size > 20 * 1024 * 1024) return Promise.reject({ code: 'too_large' });
      var ext = ((opts && opts.type) || blob.type || '').split('/')[1] || 'bin';
      var path = uid + '/' + planId + '/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + '.' + ext.replace('jpeg', 'jpg');
      return sb.storage.from(BUCKET).upload(path, blob, { contentType: (opts && opts.type) || blob.type, upsert: false }).then(function (r) {
        if (r.error) return Promise.reject({ code: 'upload_failed', message: r.error.message });
        return { id: path, sizeBytes: blob.size };
      });
    }
  };

  var downloadsApi = {
    save: function (o) {
      try {
        var url = URL.createObjectURL(o.data), a = document.createElement('a');
        a.href = url; a.download = o.filename || 'download'; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
        return Promise.resolve();
      } catch (e) { return Promise.reject({ code: 'failed' }); }
    }
  };

  // the app shows uploaded pictures through '/_blob/<id>': map them to short-lived signed links
  window.__blobUrl = function (u) { return signed[u] || u; };

  var ready = sb.auth.getSession().then(function (r) {
    var s = r && r.data && r.data.session;
    if (!s) { home(); throw { code: 'signed_out' }; }
    uid = s.user.id;
    return sb.from('plans').select('id, title, seats, thumb').eq('id', planId).maybeSingle();
  }).then(function (r) {
    if (r.error || !r.data) { home(); throw { code: 'not_found' }; }
    planRow = r.data;
    // every document of the plan, 1000 at a time (the server returns at most 1000 rows per request; plans with
    // several milestones have more)
    var all = [];
    function page(from) {
      return sb.from('plan_docs').select('col, doc_id, data').eq('plan_id', planId).order('col').order('doc_id').range(from, from + 999).then(function (r) {
        if (r.error) throw { code: 'load_failed', message: r.error.message };
        all = all.concat(r.data || []);
        return (r.data || []).length === 1000 ? page(from + 1000) : { data: all };
      });
    }
    return page(0);
  }).then(function (r) {
    (r.data || []).forEach(function (row) { colOf(row.col)[row.doc_id] = row.data; });
    // repair the dashboard row if an earlier save was cut short
    var want = rowFromCache();
    if (want.title !== planRow.title || want.seats !== planRow.seats || want.thumb !== planRow.thumb) {
      sb.from('plans').update(want).eq('id', planId).then(function () {}, function () {});
    }
    var cur = colOf('plan').current, paths = [];
    if (cur && typeof cur.img === 'string' && cur.img.indexOf('/_blob/') === 0) paths.push(cur.img.slice(7));
    // the newest uploaded PDF too (the editor may need to read it again)
    var recs = Object.keys(colOf('layouts')).map(function (k) { return colOf('layouts')[k]; })
      .filter(function (r) { return r && r.asset && /[.]pdf$/i.test(r.name || ''); })
      .sort(function (a, b) { return String(b.at || '').localeCompare(String(a.at || '')); });
    if (recs.length) paths.push(recs[0].asset);
    if (!paths.length) return;
    return sb.storage.from(BUCKET).createSignedUrls(paths, 60 * 60 * 12).then(function (sr) {
      (sr.data || []).forEach(function (x) { if (x.signedUrl) signed['/_blob/' + x.path] = x.signedUrl; });
    });
  });
  ready.catch(function (e) { console.error('EdenStardust: could not load the plan', e); });

  window.claude = {
    use: function (name) {
      if (name === 'db') return ready.then(function () { return dbApi; });
      if (name === 'assets') return ready.then(function () { return assetsApi; });
      if (name === 'downloads') return Promise.resolve(downloadsApi);
      return Promise.resolve(null);   // 'sample' (Claude reading files) is not offered on the website yet
    }
  };

  // a way back to the dashboard: logo first on the left, then My layouts (black, as tall as the logo)
  document.addEventListener('DOMContentLoaded', function () {
    var bar = document.querySelector('.bar.brand');
    if (!bar) return;
    var a = document.createElement('a');
    a.href = '/'; a.className = 'eden-back'; a.textContent = 'My layouts';
    a.setAttribute('aria-label', 'Back to my layouts');
    var logo = bar.querySelector('.logo');
    if (logo) logo.insertAdjacentElement('afterend', a); else bar.insertBefore(a, bar.firstChild);
    var st = document.createElement('style');
    st.textContent = '.eden-back{display:inline-flex;align-items:center;box-sizing:border-box;height:44px;font:600 15px "IBM Plex Mono",ui-monospace,monospace;color:#ffffff;background:#000000;border-radius:8px;padding:0 16px;text-decoration:none;white-space:nowrap}.eden-back:hover{background:#333333}.eden-back:focus-visible{outline:2px solid #BEAC6E;outline-offset:2px}';
    document.head.appendChild(st);
  });

  // ---- Share a copy of this plan with another user (by email). The copy is theirs: never synced with this one.
  // Database side (Supabase): share_plan → files copied to shared/<share id>/ → share_ready; the other user's
  // My seat plans turns it into their own plan (claim_shares).
  function sharePlan(email) {
    var id;
    return ready.then(function () { return sb.rpc('share_plan', { p_plan: planId, p_email: email }); }).then(function (r) {
      if (r.error) throw r.error;
      id = r.data;
      // every file this plan points to (plan picture, uploaded floor plans, dashboard picture)
      var text = JSON.stringify(cache) + ' ' + (planRow && planRow.thumb || '') + ' ' + JSON.stringify(rowFromCache());
      var re = new RegExp(uid + '/' + planId + '/[^"\\\\\\s]+', 'g'), seen = {}, list = [];
      (text.match(re) || []).forEach(function (pth) { if (!seen[pth]) { seen[pth] = 1; list.push(pth); } });
      return list.reduce(function (pr, pth) {
        return pr.then(function () { return sb.storage.from(BUCKET).copy(pth, 'shared/' + id + '/' + pth.split('/').pop()); });
      }, Promise.resolve());
    }).then(function () { return sb.rpc('share_ready', { p_share: id }); }).then(function (r) { if (r.error) throw r.error; });
  }
  document.addEventListener('DOMContentLoaded', function () {
    var wrap = document.getElementById('wrap'), sec = wrap && wrap.parentNode;
    if (!sec) return;
    var st = document.createElement('style');
    st.textContent = '.eden-share{position:absolute;z-index:8;width:44px;height:44px;display:grid;place-items:center;background:#FFFFFF;color:#000000;border:1px solid #BEAC6E;border-radius:8px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.08)}'
      + '.eden-share:hover,.eden-share[aria-expanded="true"]{background:#F7F7F7}.eden-share:focus-visible{outline:2px solid #BEAC6E;outline-offset:2px}.eden-share svg{width:22px;height:22px}'
      + '.eden-sharebox{position:absolute;z-index:9;width:min(340px,calc(100% - 24px));box-sizing:border-box;display:grid;gap:10px;padding:16px;background:#FFFFFF;border:1px solid #E5E5E5;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.18);font:400 15px "IBM Plex Sans Condensed","Arial Narrow",system-ui,sans-serif;color:#000000}'
      + '.eden-sharebox h3{margin:0;font-weight:600;font-size:18px}.eden-sharebox p{margin:0;color:#6E6E6E;font-size:14px;line-height:1.35}'
      + '.eden-sharebox input{font:inherit;font-size:16px;padding:9px 11px;border:1px solid #E5E5E5;border-radius:8px;background:#FFFFFF;color:#000000}.eden-sharebox input:focus{outline:2px solid #BEAC6E;outline-offset:1px}'
      + '.eden-sharebox .row{display:flex;gap:8px;justify-content:flex-end}.eden-sharebox button{font:600 15px "IBM Plex Sans Condensed","Arial Narrow",system-ui,sans-serif;border-radius:8px;padding:8px 16px;cursor:pointer}'
      + '.eden-sharebox .go{background:#000000;color:#FFFFFF;border:0}.eden-sharebox .go:hover{background:#333333}.eden-sharebox .go:disabled{opacity:.6;cursor:wait}'
      + '.eden-sharebox .no{background:#FFFFFF;color:#000000;border:1px solid #BEAC6E}.eden-sharebox .msg{min-height:1.2em;color:#000000}.eden-sharebox .msg.err{color:#d92d20}';
    document.head.appendChild(st);
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'eden-share'; btn.title = 'Share a copy of this plan'; btn.setAttribute('aria-label', 'Share a copy of this plan with another user');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>';
    var box = document.createElement('form');
    box.className = 'eden-sharebox'; box.hidden = true; box.noValidate = true;
    box.innerHTML = '<h3>Share a copy</h3><p>They get their own copy in My seat plans. Changes are not synced.</p>'
      + '<input type="email" autocomplete="email" placeholder="Their email" aria-label="Email of the person to share with" required>'
      + '<p class="msg" role="status"></p><div class="row"><button type="button" class="no">Cancel</button><button type="submit" class="go">Share</button></div>';
    sec.appendChild(btn); sec.appendChild(box);
    var input = box.querySelector('input'), msg = box.querySelector('.msg'), go = box.querySelector('.go'), no = box.querySelector('.no');
    // top-right corner of the plan frame
    function place() {
      var top = wrap.offsetTop + 12, right = sec.clientWidth - (wrap.offsetLeft + wrap.offsetWidth) + 12;
      btn.style.top = top + 'px'; btn.style.right = right + 'px';
      box.style.top = (top + 52) + 'px'; box.style.right = right + 'px';
    }
    place(); addEventListener('resize', place);
    if (window.ResizeObserver) new ResizeObserver(place).observe(wrap);
    function say(t, err) { msg.textContent = t || ''; msg.classList.toggle('err', !!err); }
    function open(on) {
      box.hidden = !on; btn.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (on) { say(''); go.disabled = false; input.value = ''; no.textContent = 'Cancel'; place(); input.focus(); }
    }
    btn.addEventListener('click', function () { open(box.hidden); });
    box.querySelector('.no').addEventListener('click', function () { open(false); });
    box.addEventListener('keydown', function (e) { if (e.key === 'Escape') { open(false); btn.focus(); } });
    document.addEventListener('click', function (e) { if (!box.hidden && !box.contains(e.target) && !btn.contains(e.target)) open(false); });
    box.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = input.value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { say('Enter a valid email address.', true); return; }
      go.disabled = true; say('Sharing…');
      sharePlan(email).then(function () {
        go.disabled = false; input.value = ''; no.textContent = 'Done';   // after a share the box closes with Done
        say('Shared with ' + email + '. It appears in their My seat plans next time they open it (after they sign up, if they have not yet).');
      }, function (err) {
        go.disabled = false;
        var m = String(err && err.message || '');
        say(/own email/.test(m) ? 'That is your own email.' : /bad email/.test(m) ? 'Enter a valid email address.' : 'Could not share: ' + (m || 'unknown error') + '. Try again.', true);
      });
    });
  });
})();
