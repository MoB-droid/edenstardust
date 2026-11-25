  // ---- Where downloads go: each Download button (layout, program) has its own place, shown as one icon
  // (this computer or Google Drive) with a Change button that lists the places. Google Drive asks for a folder;
  // a file with the same name in that folder is updated. Saved in db meta/dest: { layout: {to, folder}, program: {to, folder} }.
  var ICON_PC = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="pc" d="M8 21v-2h2v-2H4q-.825 0-1.412-.587T2 15V5q0-.825.588-1.412T4 3h16q.825 0 1.413.588T22 5v10q0 .825-.587 1.413T20 17h-6v2h2v2zm-4-6h16V5H4z"/></svg>';
  var ICON_DRIVE = '<svg viewBox="0 0 87.3 78" aria-hidden="true"><path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/><path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/><path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/><path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/><path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/><path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/></svg>';
  var ICON_APP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M8 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-2"/></svg>';
  var DEST_KINDS = { layout: 'layout', program: 'program' };
  var dest = { layout: { to: 'pc' }, program: { to: 'pc' } }, driveTok = {};
  function destOf(kind) { return dest[kind] || { to: 'pc' }; }
  function onDrive(kind) { var d = destOf(kind); return d.to === 'drive' && d.folder && d.folder.id; }
  function paintDest() {
    Object.keys(DEST_KINDS).forEach(function (kind) {
      var el = document.getElementById('dest-' + kind); if (!el) return;
      var drive = onDrive(kind), app = destOf(kind).to === 'app';
      var label = app ? 'Sends with the share menu (WhatsApp, Mail…)' : drive ? 'Saves to Google Drive · ' + destOf(kind).folder.name : 'Saves to this computer';
      el.innerHTML = app ? ICON_APP : drive ? ICON_DRIVE : ICON_PC;
      el.title = label; el.setAttribute('aria-label', label);
    });
    if ((onDrive('layout') || onDrive('program')) && onSite() && GSHEET.apiKey) googleReady().catch(function () {});   // ready for the next Download click
  }
  function saveDest(kind, d) {
    dest[kind] = d; paintDest();
    if (db) db.collection('meta').doc('dest').set(dest).then(function () {}, function () {});
  }
  // meta/dest from the database; plans that linked a folder before this existed send both downloads there
  window.__setDest = function (d, oldFolder) {
    if (d && (d.layout || d.program)) dest = { layout: d.layout || { to: 'pc' }, program: d.program || { to: 'pc' } };
    else if (oldFolder && oldFolder.id) dest = { layout: { to: 'drive', folder: oldFolder }, program: { to: 'drive', folder: oldFolder } };
    else dest = { layout: { to: 'pc' }, program: { to: 'pc' } };
    paintDest();
  };
  // WhatsApp, Mail & other apps: the device's own share menu (website only; phones, and Chrome/Edge on Windows)
  window.__appShare = function (name, blob, kind) {
    if (destOf(kind).to !== 'app') return false;
    var file; try { file = new File([blob], name, { type: blob.type || 'application/octet-stream' }); } catch (e) { return false; }
    var data = { files: [file], title: name };
    if (!window.__shareable(name)) return false;
    if (!navigator.share || !navigator.canShare || !navigator.canShare(data)) { layNote('This device cannot send files to apps, so the file is downloaded instead.'); return false; }
    navigator.share(data).then(function () { layNote(''); }, function (e) {
      if (e && e.name === 'AbortError') return;
      if (e && e.name === 'NotAllowedError') { tapToShare(data); return; }
      layNote('Could not open the share menu. Try again.');
    });
    return true;
  };
  // the file took a moment to make and the phone wants a fresh tap: one button that opens the share menu
  function tapToShare(data) {
    var old = document.getElementById('tapshare'); if (old) old.remove();
    var b = document.createElement('button'); b.type = 'button'; b.id = 'tapshare'; b.className = 'undo big tapshare';
    b.textContent = 'Tap to share ' + data.title;
    b.addEventListener('click', function () {
      b.remove();
      navigator.share(data).catch(function (e) {
        if (e && e.name === 'AbortError') return;
        // the device still refuses: save the files instead and say so
        data.files.reduce(function (p, f) { return p.then(function () { return window.__downloadFile(f.name, f); }); }, Promise.resolve())
          .then(function () { layNote('The share menu would not open here, so the files were saved to Downloads.'); });
      });
    });
    document.body.appendChild(b); b.focus();
  }
  // Share: after a destination is chosen, send the file there (the same as pressing Reshare)
  function sendNow(kind) { var b = document.getElementById(kind === 'layout' ? 'exp-png' : 'exp-xlsx'); if (b) b.click(); }
  function pickFolder(kind, send) {
    if (!onSite()) { layNote('Saving to Google Drive works on edenstardust.com.'); return; }
    if (!GSHEET.apiKey) { layNote('Google Drive is not switched on yet.'); return; }
    googleReady().then(googleToken).then(function (token) {
      var gp = window.google.picker;
      var view = new gp.DocsView(gp.ViewId.FOLDERS).setIncludeFolders(true).setSelectFolderEnabled(true).setMimeTypes('application/vnd.google-apps.folder');
      new gp.PickerBuilder().addView(view).setOAuthToken(token).setDeveloperKey(GSHEET.apiKey).setAppId(GSHEET.appId)
        .setTitle('Choose the Google Drive folder for the ' + kind).setCallback(function (r) {
          if (r.action !== gp.Action.PICKED || !r.docs || !r.docs[0]) return;
          var f = r.docs[0];
          saveDest(kind, { to: 'drive', folder: { id: f.id, name: f.name, url: f.url || '' } });
          layNote('The ' + kind + ' will be saved to the Google Drive folder "' + f.name + '".', true);
          if (send) sendNow(kind);
        }).build().setVisible(true);
    }).catch(sheetError);
  }
  function lastFolder() { var a = destOf('layout').folder, b = destOf('program').folder; return a || b || null; }
  Object.keys(DEST_KINDS).forEach(function (kind) {
    var btn = document.getElementById('chg-' + kind); if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = document.querySelector('.sheetmenu'); closeSheetMenu();
      if (open && open.dataset.kind === kind) return;
      var d = destOf(kind), drive = onDrive(kind), app = d.to === 'app', known = d.folder || lastFolder();
      var m = document.createElement('div'); m.className = 'sheetmenu'; m.dataset.kind = kind; m.setAttribute('role', 'menu');
      m.innerHTML = '<div class="sm-name">Share the ' + (kind === 'program' ? 'layout and the program' : kind) + ' to</div>'
        + '<button type="button" role="menuitemradio" class="opt" data-a="pc" aria-checked="' + (!drive && !app) + '">' + ICON_PC + '<span>This computer</span></button>'
        + '<button type="button" role="menuitemradio" class="opt" data-a="drive" aria-checked="' + !!drive + '">' + ICON_DRIVE + '<span class="dn"></span></button>'
        + '<button type="button" role="menuitemradio" class="opt" data-a="app" aria-checked="' + app + '">' + ICON_APP + '<span>WhatsApp, Mail &amp; other apps</span></button>'
        + (known ? '<button type="button" data-a="other">Choose another folder…</button>' : '')
        + (drive ? '<button type="button" data-a="open">Open the folder</button>' : '');
      m.querySelector('.dn').textContent = known ? 'Google Drive · ' + known.name : 'Google Drive…';
      m.addEventListener('click', function (ev) {
        var t = ev.target.closest('button'); var a = t && t.dataset.a; if (!a) return;
        closeSheetMenu();
        if (a === 'pc') { saveDest(kind, { to: 'pc', folder: d.folder || null }); sendNow(kind); }
        else if (a === 'app') { if (!onSite()) { layNote('Sharing to WhatsApp, Mail and other apps works on edenstardust.com.'); return; } saveDest(kind, { to: 'app', folder: d.folder || null }); sendNow(kind); }
        else if (a === 'drive') { if (known) { saveDest(kind, { to: 'drive', folder: known }); sendNow(kind); } else pickFolder(kind, true); }
        else if (a === 'other') pickFolder(kind, true);
        else window.open(d.folder.url || 'https://drive.google.com/drive/folders/' + d.folder.id, '_blank', 'noopener');
      });
      btn.parentNode.appendChild(m);
      m.querySelector('button').focus();
    });
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('.sheetmenu, .chg')) closeSheetMenu(); });
  // at the Download click: get Google access now, so its window is not blocked
  window.__driveWarm = function (kind) {
    if (!onDrive(kind) || !onSite() || !GSHEET.apiKey) return;
    driveTok[kind] = googleReady().then(googleToken);
    driveTok[kind].catch(function () {});
  };
  // save into the chosen folder: the file with the same name is updated, else a new one is made
  window.__driveSave = function (name, blob, kind) {
    if (!onDrive(kind) || !onSite() || !GSHEET.apiKey) return false;
    var folder = destOf(kind).folder, tok = driveTok[kind] || googleReady().then(googleToken);
    driveTok[kind] = null;
    layNote('Saving ' + name + ' to Google Drive…', true);
    tok.then(function (token) {
      var q = "name = '" + name.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "' and '" + folder.id + "' in parents and trashed = false";
      return fetch('https://www.googleapis.com/drive/v3/files?fields=files(id)&q=' + encodeURIComponent(q), { headers: { Authorization: 'Bearer ' + token } })
        .then(function (r) { return r.ok ? r.json() : { files: [] }; })
        .then(function (found) {
          var id = found.files && found.files[0] && found.files[0].id;
          if (id) return fetch('https://www.googleapis.com/upload/drive/v3/files/' + id + '?uploadType=media&fields=id,webViewLink', { method: 'PATCH', headers: { Authorization: 'Bearer ' + token }, body: blob });
          var form = new FormData();
          form.append('metadata', new Blob([JSON.stringify({ name: name, parents: [folder.id] })], { type: 'application/json' }));
          form.append('file', blob);
          return fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: form });
        })
        .then(function (r) { if (!r.ok) throw { code: 'http', status: r.status }; layNote('Saved to Google Drive: ' + folder.name + ' / ' + name, true); });
    }).catch(function (e) {
      layNote('Could not save to Google Drive' + (e && e.status ? ' (' + e.status + ')' : '') + '. The file is downloaded instead.');
      downloadFile(name, blob);
    });
    return true;
  };
  paintDest();
  paintSheet();
  // ---- Drag and drop: drop a floor plan (PDF / PNG / JPG) or a program (Excel / CSV) anywhere on the page.
  // The frame under the pointer lights up; the file type decides whether it is the layout or the program.
  var leftSec = document.querySelector('main > section.stack:first-child'), rightSec = document.querySelector('main > section.stack:last-child'), dropDepth = 0;
  leftSec.dataset.drop = 'Drop the floor plan here (PDF, PNG or JPG)';
  rightSec.dataset.drop = 'Drop the program here (Excel or CSV)';
  function dropKind(name) { return /[.](pdf|png|jpe?g)$/i.test(name) ? 'layout' : /[.](xlsx|xlsm|xls|csv|txt)$/i.test(name) ? 'program' : null; }
  function hasFiles(e) { return !!(e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0); }
  function dropMark(e) {
    var over = e.target && e.target.closest ? e.target.closest('main > section.stack') : null;
    leftSec.classList.toggle('dropping', over === leftSec);
    rightSec.classList.toggle('dropping', over === rightSec);
  }
  function clearDrop() { dropDepth = 0; leftSec.classList.remove('dropping'); rightSec.classList.remove('dropping'); }
  window.addEventListener('dragenter', function (e) { if (!hasFiles(e)) return; e.preventDefault(); dropDepth++; dropMark(e); });
  window.addEventListener('dragover', function (e) { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; dropMark(e); });
  window.addEventListener('dragleave', function (e) { if (!hasFiles(e)) return; if (--dropDepth <= 0) clearDrop(); });
  window.addEventListener('drop', function (e) {
    if (!hasFiles(e)) return;
    e.preventDefault(); clearDrop();
    var f = e.dataTransfer.files && e.dataTransfer.files[0]; if (!f) return;
    var kind = dropKind(f.name);
    if (!kind) { layNote('Drop a floor plan (PDF, PNG or JPG) or a program (Excel or CSV).'); return; }
    var input = kind === 'layout' ? layfile : upfile;
    try { var dt = new DataTransfer(); dt.items.add(f); input.files = dt.files; }
    catch (err) { layNote('This browser cannot take dropped files. Use the Upload buttons.'); return; }
    input.dispatchEvent(new Event('change'));
  });
  function saveAdded(t, val) {
    pushStep([['added', t, clone(store.added[t])]]);
    if (val) store.added[t] = val; else delete store.added[t];
    syncAdded(); paint(); relayout();
    if (db) {
      var ref = db.collection('added').doc(t);
      (val ? ref.set({ order: val.order }) : ref.delete()).then(function () { showErr(''); }, function () {
        showErr('Not saved. You may not have edit access to this page.');
      });
    } else {
      try { localStorage.setItem(LS, JSON.stringify(store)); } catch (e) {}
    }
  }
  document.getElementById('addteam').addEventListener('click', function () {
    var t = 'a' + Date.now().toString(36);
    saveAdded(t, { order: Date.now() });
    var grp = document.querySelector('tbody.grp[data-t="' + t + '"]');
    if (grp) grp.scrollIntoView({ block: 'nearest' });
  });
  document.getElementById('undo').addEventListener('click', function () {
    var step = hist.pop(); if (!step) return;
    undoing = true;
    step.slice().reverse().forEach(function (it) {
      var k = it[0], id = it[1], prev = it[2];
      if (k === 'moves') { if (prev) store.moves[id] = prev; else delete store.moves[id]; saveMove(id); }
      else if (k === 'deleted') saveDeleted(id, !!prev);
      else if (k === 'gone') saveGone(id, !!prev);
      else if (k === 'added') saveAdded(id, prev);
      else if (k === 'pseat') writePseat(id, prev || null);
      else if (k === 'pkind') writePkind(id, !!prev);
      else if (k === 'ptype') writePtype(id, prev || null);
      else if (k === 'assign') writeAssign(id, prev || null);
      else if (k === 'title') window.__saveTitle(prev || '', false);
      else save(k, id, prev === undefined ? '' : String(prev));
    });
    undoing = false;
    paint(); relayout();
    keepHist();
  });
  keepHist();
  document.getElementById('srows').addEventListener('click', function (e) {
    var cf = e.target.closest('.confirm');
    if (cf) {
      e.stopPropagation(); closeConfirm();
      if (cf.dataset.s) {
        var row = document.querySelector('#srows tr.m[data-s="' + cf.dataset.s + '"]'), at = row && row.parentNode.dataset.t;
        if (at && (store.added[at] || row.hasAttribute('data-extra'))) {
          var nm = row.querySelector('.nm');
          var rest = Array.prototype.slice.call(row.parentNode.querySelectorAll(store.added[at] ? 'tr.m' : 'tr.m[data-extra]')), idx = rest.indexOf(row), step = [['need', at, clone(store.need[at])]];
          for (var q = idx; q < rest.length; q++) step.push(['names', rest[q].dataset.s, clone(store.names[rest[q].dataset.s])]);
          pushStep(step); undoing = true;
          for (var q2 = idx; q2 < rest.length - 1; q2++) save('names', rest[q2].dataset.s, store.names[rest[q2 + 1].dataset.s] || '');
          save('names', rest[rest.length - 1].dataset.s, '');
          var curNeed = +(document.querySelector('.cnt[data-k="need"][data-id="' + at + '"]').textContent || 0);
          save('need', at, String(Math.max(0, curNeed - 1)));
          undoing = false; relayout();
          return;
        }
        saveGone(cf.dataset.s, true); return;
      }
      var t = cf.dataset.t; shade(t, false); saveDeleted(t, true); return;
    }
    var ab = e.target.closest('.addbtn');
    if (ab) {
      e.stopPropagation(); closeConfirm();
      var at2 = ab.dataset.t, cur = +(document.querySelector('.cnt[data-k="need"][data-id="' + at2 + '"]').textContent || 0);
      save('need', at2, String(cur + 1));
      var g2 = ab.closest('tbody'); setOpen(g2, true);
      return;
    }
    var db1 = e.target.closest('.delbtn');
    if (db1) {
      e.stopPropagation();
      var open = db1.parentNode.querySelector('.confirm');
      closeConfirm();
      if (open) return;
      var c = document.createElement('button');
      c.type = 'button'; c.className = 'confirm'; c.textContent = 'Are you sure?';
      if (db1.dataset.s) { c.dataset.s = db1.dataset.s; c.setAttribute('aria-label', 'Yes, delete this person'); }
      else { c.dataset.t = db1.dataset.t; c.setAttribute('aria-label', 'Yes, delete team T' + db1.dataset.t); }
      db1.parentNode.appendChild(c); placeConfirm(c, db1); c.focus();
      return;
    }
    var b = e.target.closest('.fold');
    // the team name opens / closes the team like the arrow (double-click still edits it)
    if (!b) { var tnc = e.target.closest('tr.gh td.tn'); if (tnc && !tnc.querySelector('input')) b = tnc.parentNode.querySelector('.fold'); }
    if (b) { var g = b.closest('tbody'); var open = b.getAttribute('aria-expanded') !== 'true'; setOpen(g, open); shade(g.dataset.t, open); return; }
    var r = e.target.closest('tr.m'); if (!r) return;
    shade(r.parentNode.dataset.t, false);
    var on = !r.classList.contains('sh');
    document.querySelectorAll('#srows tr.m.sh').forEach(function (o) { if (o !== r) o.classList.remove('sh'); });
    document.querySelectorAll('.dk.ts').forEach(function (d) { d.classList.remove('ts'); });
    r.classList.toggle('sh', on);
    // the person's desk = the one in the Seat column (program teams and moved teams sit at other desks than their row id)
    var seat = deskOfRow(r);
    if (on && seat) document.querySelectorAll('#desks .dk[data-s="' + seat + '"]').forEach(function (d) { d.classList.add('ts'); });
  });
}
START();
