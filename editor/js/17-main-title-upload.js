  // ---- Layout title: double-click to rename (saved in db collection "meta", doc "title").
  var ltitle = document.getElementById('ltitle'), titleVal = null;
  function paintTitle() { if (!ltitle.querySelector('input')) ltitle.textContent = titleVal || ltitle.dataset.def; }
  try { titleVal = JSON.parse(localStorage.getItem(LS + ':title') || 'null'); } catch (e) {}
  paintTitle();
  function saveTitle(v, rec) {
    v = (v || '').trim();
    if (v === ltitle.dataset.def) v = '';
    if ((titleVal || '') === v) return;
    if (rec !== false) pushStep([['title', 'title', titleVal || '']]);
    titleVal = v || null; paintTitle();
    if (db) {
      var ref = db.collection('meta').doc('title');
      (v ? ref.set({ name: v }) : ref.delete()).then(function () {}, function () { showErr('Not saved. You may not have edit access to this page.'); });
    } else { try { localStorage.setItem(LS + ':title', JSON.stringify(titleVal)); } catch (e) {} }
  }
  window.__saveTitle = saveTitle;
  ltitle.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && !ltitle.querySelector('input')) { e.preventDefault(); ltitle.click(); } });
  ltitle.addEventListener('click', function () {
    if (ltitle.querySelector('input')) return;
    var inp = document.createElement('input'); inp.type = 'text'; inp.id = 'ed-title'; inp.value = titleVal || ltitle.dataset.def;
    inp.setAttribute('aria-label', 'Layout title');
    ltitle.textContent = ''; ltitle.appendChild(inp); inp.focus(); inp.select();
    var done = false;
    function fin(keep) { if (done) return; done = true; var v = inp.value; ltitle.removeChild(inp); if (keep) saveTitle(v); paintTitle(); }
    inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') fin(true); else if (ev.key === 'Escape') fin(false); });
    inp.addEventListener('blur', function () { fin(true); });
  });
  if (window.claude && window.claude.use) window.claude.use('db').then(function (d) {
    if (!d) return;
    d.collection('meta').onSnapshot(function (snap) {
      var v = null, sh = null, fo = null, de = null; snap.docs.forEach(function (doc) { var b = doc.data(); if (doc.id === 'title' && b && b.name) v = String(b.name); if (doc.id === 'sheet' && b && b.id) sh = b; if (doc.id === 'folder' && b && b.id) fo = b; if (doc.id === 'dest' && b) de = b; if (doc.id === 'option' && b && window.__setOption) window.__setOption(+b.n); });
      if (window.__setSheetMeta) window.__setSheetMeta(sh);
      if (window.__setDest) window.__setDest(de, fo);
      titleVal = v; paintTitle();
    }, function () {});
  });
  // ---- Upload layout: stores the new plan file with the page; Claude then reads it and rebuilds the layout.
  var layfile = document.getElementById('layfile'), laymsg = document.getElementById('laymsg');
  function layNote(text, ok) { laymsg.textContent = text; laymsg.hidden = !text; laymsg.classList.toggle('ok', !!ok); }
  document.getElementById('uplayout').addEventListener('click', function () { layfile.value = ''; layfile.click(); });
  layfile.addEventListener('change', function () {
    var f = layfile.files && layfile.files[0]; if (!f) return;
    var type = /[.]pdf$/i.test(f.name) ? 'application/pdf' : /[.]png$/i.test(f.name) ? 'image/png' : 'image/jpeg';
    var getAssets = window.claude && window.claude.use ? window.claude.use('assets') : Promise.resolve(null);
    layNote('Uploading ' + f.name + '…', true);
    getAssets.then(function (a) {
      if (!a) { layNote('Uploading a layout needs edit access to this page.'); return; }
      return a.upload(f, { type: type }).then(function (r) {
        var isPdf = type === 'application/pdf', recId = 'a' + Date.now().toString(36);
        var rec = { asset: r.id, name: f.name, size: r.sizeBytes, at: new Date().toISOString(), status: isPdf ? 'analyzing' : 'waiting for Claude' };
        var go = function () {
          if (isPdf) window.__autoLayout(f, db, recId);
          else layNote('Layout received: ' + f.name + '. A picture cannot be read automatically: upload the plan as a PDF, or ask Claude to “process the new layout”.', true);
        };
        if (db) db.collection('layouts').doc(recId).set(rec).then(go, go);
        else go();
      });
    }).catch(function (e) {
      var c = e && e.code;
      layNote(c === 'too_large' ? 'That file is too large (20 MB max).' : c === 'not_granted' ? 'Uploading a layout needs edit access to this page.' : 'Could not upload the layout. Try again.');
    });
  });
  // ---- Delete program: removes every team (one Undo step).
  document.getElementById('delprog').addEventListener('click', function (e) {
    e.stopPropagation();
    var wrap = this.parentNode, open = wrap.querySelector('.confirm');
    closeConfirm(); if (open) return;
    var c = document.createElement('button');
    c.type = 'button'; c.className = 'confirm'; c.textContent = 'Are you sure?'; c.setAttribute('aria-label', 'Yes, delete the whole program');
    c.addEventListener('click', function (ev) {
      ev.stopPropagation(); closeConfirm();
      batch(function () { teamIds.slice().forEach(function (t) { if (!store.deleted[t]) { shade(t, false); saveDeleted(t, true); } }); });
    });
    wrap.appendChild(c); placeConfirm(c, this); c.focus();
  });
  // ---- Upload a table (Excel or CSV): adds its teams and people to the program, then runs Suggest.
  var upfile = document.getElementById('upfile');
  document.getElementById('upload').addEventListener('click', function () { upfile.value = ''; upfile.click(); });
  function parseCSV(text) {
    var first = text.split(/\r?\n/)[0] || '', sep = [',', ';', '\t'].sort(function (a, b) { return first.split(b).length - first.split(a).length; })[0];
    var rows = [], row = [], cur = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; continue; }
      if (ch === '"') q = true;
      else if (ch === sep) { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }
  function loadXLSX() {
    return new Promise(function (ok, bad) {
      if (window.XLSX) return ok(window.XLSX);
      var sc = document.createElement('script');
      sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      sc.onload = function () { ok(window.XLSX); }; sc.onerror = function () { bad(new Error('load')); };
      document.head.appendChild(sc);
    });
  }
