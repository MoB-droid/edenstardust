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

  function docRef(c, id) {
    return {
      id: id,
      get: function () { return ready.then(function () { return docSnap(c, id); }); },
      set: function (data) {
        return ready.then(function () {
          colOf(c)[id] = clone(data) || {}; notify(c, id);
          return sb.from('plan_docs').upsert({ plan_id: planId, col: c, doc_id: id, data: colOf(c)[id], updated_at: new Date().toISOString() })
            .then(function (r) { if (r.error) return fail(r.error); return afterWrite(c, id); });
        });
      },
      update: function (part) {
        return ready.then(function () {
          colOf(c)[id] = Object.assign({}, colOf(c)[id] || {}, clone(part)); notify(c, id);
          return sb.from('plan_docs').upsert({ plan_id: planId, col: c, doc_id: id, data: colOf(c)[id], updated_at: new Date().toISOString() })
            .then(function (r) { if (r.error) return fail(r.error); return afterWrite(c, id); });
        });
      },
      delete: function () {
        return ready.then(function () {
          delete colOf(c)[id]; notify(c, id);
          return sb.from('plan_docs').delete().eq('plan_id', planId).eq('col', c).eq('doc_id', id)
            .then(function (r) { if (r.error) return fail(r.error); return afterWrite(c, id); });
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
    return sb.from('plan_docs').select('col, doc_id, data').eq('plan_id', planId).range(0, 9999);
  }).then(function (r) {
    if (r.error) throw { code: 'load_failed', message: r.error.message };
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

  // a way back to the dashboard, next to the logo
  document.addEventListener('DOMContentLoaded', function () {
    var bar = document.querySelector('.bar.brand');
    if (!bar) return;
    var a = document.createElement('a');
    a.href = '/'; a.className = 'eden-back'; a.textContent = '← My plans';
    a.setAttribute('aria-label', 'Back to my seat plans');
    bar.insertBefore(a, bar.firstChild);
    var st = document.createElement('style');
    st.textContent = '.eden-back{font:600 14px "IBM Plex Mono",ui-monospace,monospace;color:#ffffff;background:#144878;border-radius:8px;padding:8px 12px;text-decoration:none;white-space:nowrap}.eden-back:hover{background:#0e3659}.eden-back:focus-visible{outline:2px solid #9fd0f5;outline-offset:2px}';
    document.head.appendChild(st);
  });
})();
