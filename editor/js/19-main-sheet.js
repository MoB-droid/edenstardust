  // ---- Google Sheet as the program: pick a sheet in Google's own picker; it stays linked and Update re-reads it.
  // Teams that came from the sheet follow it: changed seats and people are updated, new teams added, teams no longer
  // in the sheet removed. Teams added another way are left alone. Works on edenstardust.com (Google's scripts).
  var GSHEET = { clientId: '151556140307-gftpb2fjte8g4kgjbdg1teh29dcgpe1b.apps.googleusercontent.com', apiKey: 'AIzaSyDbeT3-qqQO86JVDy9EqHPS8zY9ezrGCoo', appId: '151556140307',
    scope: 'https://www.googleapis.com/auth/drive.file' };
  var sheetMeta = null, gToken = null, gTokenAt = 0, gClient = null;
  var sheetBtn = document.getElementById('sheet'), sheetUp = document.getElementById('sheet-up');
  function paintSheet() {
    var on = !!(sheetMeta && sheetMeta.id);
    sheetBtn.innerHTML = on ? 'Link<br>sheet ✓' : 'Link<br>sheet';
    sheetBtn.dataset.tip = on ? 'program from “' + sheetMeta.name + '” · change or unlink' : 'take the program from a Google Sheet (it stays linked)';
    sheetBtn.title = on ? sheetMeta.name : '';
    sheetUp.hidden = false; sheetUp.disabled = !on;
  }
  function onSite() { return !!window.__edenSb; }
  function googleReady() {
    return Promise.all([
      window.google && window.google.accounts ? Promise.resolve() : loadScript('https://accounts.google.com/gsi/client'),
      window.gapi ? Promise.resolve() : loadScript('https://apis.google.com/js/api.js')
    ]).then(function () { return new Promise(function (ok) { window.gapi.load('picker', ok); }); });
  }
  // a Google access token for the files the user picks (asks only the first time)
  function googleToken() {
    if (gToken && Date.now() - gTokenAt < 50 * 60 * 1000) return Promise.resolve(gToken);
    return new Promise(function (ok, bad) {
      gClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GSHEET.clientId, scope: GSHEET.scope,
        callback: function (r) { if (r && r.access_token) { gToken = r.access_token; gTokenAt = Date.now(); ok(gToken); } else bad({ code: 'denied' }); },
        error_callback: function (e) { bad({ code: (e && e.type) || 'denied' }); }
      });
      gClient.requestAccessToken({ prompt: '' });
    });
  }
  function gfetch(url) {
    return fetch(url, { headers: { Authorization: 'Bearer ' + gToken } }).then(function (r) {
      if (r.status === 401) { gToken = null; throw { code: 'expired' }; }
      if (!r.ok) throw { code: 'http', status: r.status };
      return r.json();
    });
  }
  // every tab of the sheet as rows (the same shape a dropped Excel file gives)
  function sheetTables(id) {
    var base = 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(id);
    return gfetch(base + '?fields=properties.title,sheets.properties.title').then(function (meta) {
      var tabs = (meta.sheets || []).map(function (s) { return s.properties.title; });
      var q = tabs.map(function (tab) { return 'ranges=' + encodeURIComponent("'" + tab.replace(/'/g, "''") + "'"); }).join('&');
      return gfetch(base + '/values:batchGet?majorDimension=ROWS&' + q).then(function (v) {
        return { title: (meta.properties && meta.properties.title) || 'Google Sheet',
          sheets: (v.valueRanges || []).map(function (vr, i) { return { name: tabs[i], rows: vr.values || [] }; }) };
      });
    });
  }
  function sheetError(e) {
    var c = e && e.code;
    progNote('');
    showErr(c === 'denied' || c === 'popup_closed' ? 'Google sign-in was closed. Press the button again to continue.'
      : c === 'popup_failed_to_open' ? 'The Google window was blocked. Allow pop-ups for edenstardust.com and try again.'
      : c === 'http' && (e.status === 403 || e.status === 404) ? 'The sheet could not be opened. Pick it again with "Sheet: … → Change sheet".'
      : c === 'load' ? 'Google could not be reached. Check the connection and try again.'
      : 'Could not read the Google Sheet. Try again.');
  }
  function saveSheetMeta(v) {
    sheetMeta = v; paintSheet();
    if (db) { var ref = db.collection('meta').doc('sheet'); (v ? ref.set(v) : ref.delete()).then(function () {}, function () {}); }
  }
  // bring the program in line with the sheet
  // opt (a tab of a sheet with several tabs): { prev: the team ids that tab made last time }; returns the team ids now
  function syncProgram(res, fname, how, opt) {
    var prev = opt ? opt.prev || [] : (sheetMeta && sheetMeta.teams) || [], seen = {}, nSeats = 0, nPeople = 0, nNew = 0, nGone = 0;
    batch(function () {
      res.teams.forEach(function (g, gi) {
        var n = Math.max(g.people.length, g.seats), t = null;
        nSeats += n; nPeople += g.people.length;
        var key = (g.name || '').toLowerCase();
        prev.concat(addedIds()).forEach(function (x) { if (!t && !seen[x] && store.added[x] && !store.deleted[x] && (store.teams[x] || '').toLowerCase() === key) t = x; });
        if (!t) { t = 'a' + Date.now().toString(36) + gi; saveAdded(t, { order: Date.now() + gi }); if (g.name) save('teams', t, g.name); nNew++; }
        seen[t] = true;
        var oldN = +(store.need[t] || 0);
        save('need', t, String(n));
        for (var i = 0; i < Math.max(n, oldN); i++) {
          var id = t + '-' + (i + 1), nm = i < n ? (g.people[i] || '') : '', ty = i < n && g.types ? (g.types[i] || '') : '';
          if ((store.names[id] || '') !== cap(nm)) save('names', id, nm);
          if ((store.ptype[id] || '') !== ty) { pushStep([['ptype', id, store.ptype[id] || null]]); writePtype(id, ty || null); }
        }
        if ((store.flags[t] || '') !== (g.flag || '')) save('flags', t, g.flag || '');
      });
      prev.forEach(function (t) { if (!seen[t] && store.added[t] && !store.deleted[t]) { shade(t, false); saveDeleted(t, true); nGone++; } });
      syncAdded(); paint(); relayout();
      suggest();
    });
    showErr('');
    if (opt) return Object.keys(seen);
    var at = new Date();
    saveSheetMeta({ id: sheetMeta.id, name: sheetMeta.name, url: sheetMeta.url || '', teams: Object.keys(seen), at: at.toISOString() });
    progNote('Linked to ' + fname + ' (Google Sheet) · updated ' + at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · ' +
      res.teams.length + ' teams · ' + nSeats + ' seats' + (nPeople ? ' · ' + nPeople + ' people' : '') +
      (nNew ? ' · ' + nNew + ' new' : '') + (nGone ? ' · ' + nGone + ' removed' : '') + (how ? ' · ' + how : '') + '.');
  }
  window.__syncProgram = function (res, name) { sheetMeta = sheetMeta || { id: 'test', name: name, teams: [] }; syncProgram(res, name, ''); };   // for tests
  // ---- Sheet tabs = milestones (set by the user 24 Nov 2026): a Google Sheet or an Excel file with two or more tabs
  // that read as a program (e.g. 65%, 80%, 100%) puts each tab into its own milestone (msForTabs), one after the other:
  // that milestone is opened, its program is brought in line with the tab (sheet) or added (Excel upload) and Suggest
  // seats it, the others stay untouched; then the milestone shown before opens again. Empty or note tabs are skipped,
  // an HR seating file keeps its own rules, a single program tab works as before (the milestone shown).
  var tabsBusy = false;
  function loadTabs(tabs, fname, sheet) {
    if (tabsBusy) return Promise.resolve();
    tabsBusy = true;
    var back = MS.active, ids = msForTabs(tabs.map(function (t) { return t.name; })), map = {}, p = Promise.resolve();
    var sm = sheet ? sheetMeta : null, prevTabs = (sm && sm.tabs) || {};
    msSave().catch(function () {});
    progNote('Reading ' + tabs.length + ' tabs into milestones…');
    tabs.forEach(function (tab, i) {
      p = p.then(function () { return new Promise(function (ok) { msShow(ids[i], ok); }); }).then(function () {
        // a sheet linked before it was read by tabs (no tabs map yet): the teams it made are this tab's to update or remove
        if (sheet) map[ids[i]] = syncProgram(tab.res, tab.name, '', { prev: prevTabs[ids[i]] || (sm && !sm.tabs ? sm.teams || [] : []) });
        else addProgram(tab.res, fname, '');
        return suggestDone;   // the tab's teams are seated before the next milestone opens
      });
    });
    // every tab's whole program is saved before the load is called done (on the website the saves are queued)
    return p.then(function () { if (!window.__edenFlush) return; progNote('Saving ' + tabs.length + ' milestones…'); return window.__edenFlush(); })
      .then(function () { return new Promise(function (ok) { if (MS.active === back) ok(); else msShow(back, ok); }); }).then(function () {
      msSave().catch(function () {});
      if (sm) saveSheetMeta({ id: sm.id, name: sm.name, url: sm.url || '', teams: [], tabs: map, at: new Date().toISOString() });
      progNote(tabs.length + ' tabs → ' + tabs.length + ' milestones: ' + tabs.map(function (t) { return t.name; }).join(', ') + ' · from ' + fname + '.');
      tabsBusy = false;
    }, function () { tabsBusy = false; showErr('Could not load every tab. Try again.'); });
  }
  window.__loadTabs = function (sheets, name, sheet) {   // for tests: the same as a linked sheet (sheet true) or an Excel upload
    if (sheet && !sheetMeta) saveSheetMeta({ id: 'test', name: name, teams: [] });
    return askProgram(name, sheets).then(function (a) { return a && a.tabs ? loadTabs(a.tabs, name, sheet) : 'single'; });
  };
  function updateFromSheet() {
    if (!sheetMeta || !sheetMeta.id) return;
    progNote('Reading ' + sheetMeta.name + ' from Google…');
    return googleReady().then(googleToken).then(function () { return sheetTables(sheetMeta.id); }).then(function (tb) {
      sheetMeta.name = tb.title;
      return askProgram(tb.title, tb.sheets).then(function (a) {
        if (!a) return;
        if (a.tabs) return loadTabs(a.tabs, tb.title, true);
        syncProgram(a.res, tb.title, a.res.how);
      });
    }).catch(sheetError);
  }
  function pickSheet() {
    if (!onSite()) { layNote('Linking a Google Sheet works on edenstardust.com.'); return; }
    if (!GSHEET.apiKey) { layNote('Google Sheets linking is not switched on yet.'); return; }
    googleReady().then(googleToken).then(function (token) {
      var view = new window.google.picker.DocsView(window.google.picker.ViewId.SPREADSHEETS).setMode(window.google.picker.DocsViewMode.LIST);
      new window.google.picker.PickerBuilder().addView(view).setOAuthToken(token).setDeveloperKey(GSHEET.apiKey).setAppId(GSHEET.appId)
        .setTitle('Choose the program sheet').setCallback(function (d) {
          if (d.action !== window.google.picker.Action.PICKED || !d.docs || !d.docs[0]) return;
          var doc = d.docs[0];
          var keep = sheetMeta && sheetMeta.teams ? sheetMeta.teams : [];
          saveSheetMeta({ id: doc.id, name: doc.name, url: doc.url || '', teams: keep, at: '' });
          updateFromSheet();
        }).build().setVisible(true);
    }).catch(sheetError);
  }
  function closeSheetMenu() { document.querySelectorAll('.sheetmenu').forEach(function (m) { m.remove(); }); }
  sheetBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (document.querySelector('.sheetmenu')) return closeSheetMenu();
    if (!sheetMeta || !sheetMeta.id) return pickSheet();
    var m = document.createElement('div'); m.className = 'sheetmenu';
    m.innerHTML = '<div class="sm-name"></div><button type="button" data-a="open">Open the sheet</button><button type="button" data-a="change">Change sheet</button><button type="button" data-a="unlink">Unlink (keep the program)</button>';
    m.firstChild.textContent = sheetMeta.name;
    m.addEventListener('click', function (ev) {
      var a = ev.target.dataset && ev.target.dataset.a; if (!a) return;
      closeSheetMenu();
      if (a === 'open') window.open(sheetMeta.url || 'https://docs.google.com/spreadsheets/d/' + sheetMeta.id, '_blank', 'noopener');
      else if (a === 'change') pickSheet();
      else { saveSheetMeta(null); progNote('Unlinked from the Google Sheet. The program stays as it is.'); }
    });
    sheetBtn.parentNode.appendChild(m);
    m.querySelector('button').focus();
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('.sheetmenu, #sheet')) closeSheetMenu(); });
  sheetUp.addEventListener('click', updateFromSheet);
  window.__setSheetMeta = function (v) { sheetMeta = v; paintSheet(); };

