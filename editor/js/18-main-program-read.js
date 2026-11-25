  // ---- Upload program: the file (Excel or CSV) is opened here; the server (the brain) reads its tables (columns by
  // their header words, HR seating files, tabs that become milestones) and returns the teams. They are added at once
  // and Suggest runs; a team the reader was unsure about shows a ⚠ note.
  function readSheets(file) {
    var isX = /[.]xls[xm]?$/i.test(file.name);
    return new Promise(function (ok, bad) {
      var fr = new FileReader();
      fr.onerror = function () { bad(new Error('read')); };
      fr.onload = function () {
        if (!isX) return ok([{ name: file.name, rows: parseCSV(String(fr.result)) }]);
        loadXLSX().then(function (X) {
          var wb = X.read(new Uint8Array(fr.result), { type: 'array' });
          ok(wb.SheetNames.map(function (n) { return { name: n, rows: X.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' }) }; }));
        }, bad);
      };
      if (isX) fr.readAsArrayBuffer(file); else fr.readAsText(file);
    });
  }
  function progNote(t) { var p = document.getElementById('prognote'); p.textContent = t || ''; p.hidden = !t; }
  function addProgram(res, fname, how) {
    var groups = res.teams, nPeople = 0, nSeats = 0, nFlag = 0;
    batch(function () {
      groups.forEach(function (g, gi) {
        var n = Math.max(g.people.length, g.seats); nPeople += g.people.length; nSeats += n; if (g.flag) nFlag++;
        // a team with the same name already in the program gets the people added to it
        var t = null;
        if (g.name) teamIds.forEach(function (x) { if (!t && !store.deleted[x] && (store.teams[x] || '').toLowerCase() === g.name.toLowerCase()) t = x; });
        if (t) {
          var cntEl = document.querySelector('.cnt[data-k="need"][data-id="' + t + '"]');
          var cur = +((cntEl && cntEl.textContent) || 0);
          var grp = document.querySelector('tbody.grp[data-t="' + t + '"]');
          var base = store.added[t] ? cur : cur - grp.querySelectorAll('tr.m:not([data-extra])').length + Array.prototype.filter.call(grp.querySelectorAll('tr.m:not([data-extra])'), function (r) { return store.gone[r.dataset.s]; }).length;
          save('need', t, String(cur + n));
          g.people.forEach(function (pn, i) { save('names', store.added[t] ? t + '-' + (cur + i + 1) : t + '-x' + (base + i + 1), pn); });
          (g.types || []).forEach(function (ty, i) {
            if (!ty) return;
            var rid = store.added[t] ? t + '-' + (cur + i + 1) : (i < g.people.length ? t + '-x' + (base + i + 1) : null);
            if (rid) { pushStep([['ptype', rid, store.ptype[rid] || null]]); writePtype(rid, ty); }
          });
        } else {
          t = 'a' + Date.now().toString(36) + gi;
          saveAdded(t, { order: Date.now() + gi });
          if (g.name) save('teams', t, g.name);
          save('need', t, String(n));
          g.people.forEach(function (pn, i) { save('names', t + '-' + (i + 1), pn); });
          (g.types || []).forEach(function (ty, i) { if (ty && i < n) { pushStep([['ptype', t + '-' + (i + 1), store.ptype[t + '-' + (i + 1)] || null]]); writePtype(t + '-' + (i + 1), ty); } });
        }
        if (g.flag) save('flags', t, g.flag);
      });
      syncAdded(); paint(); relayout();
      suggest();
    });
    showErr('');
    progNote('Added ' + groups.length + ' teams · ' + nSeats + ' seats' + (nPeople ? ' · ' + nPeople + ' people' : '') +
      (res.ignored ? ' · ignored ' + res.ignored + ' rows' + (res.why ? ' (' + res.why + ')' : '') : '') +
      (nFlag ? ' · ⚠ ' + nFlag + ' to check' : '') + ' · from ' + fname + (how ? ' · ' + how : '') + '.');
  }
  // read the tables of a file or a Google Sheet into teams (Claude first, else the column reader)
  // a table is messy when no teams come out of it, most teams have no seat count and no people, or most rows were skipped
  function showMessy(on) { var m = document.getElementById('messymsg'); if (m) m.hidden = !on; alignProgram(); }
  // Download format: an empty program in our format (Excel), with example rows and a sheet of instructions
  document.getElementById('dlfmt').addEventListener('click', function () {
    loadXLSX().then(function (X) {
      var wb = X.utils.book_new();
      var ws = X.utils.aoa_to_sheet([
        ['Team name', 'Employee name', 'Type'],
        ['Example team A', 'Dana Cohen', 'Manager'],
        ['Example team A', 'Avi Levi', 'Open space'],
        ['Example team A', 'Noa Mizrahi', 'Open space'],
        ['Example team B', '', 'Open space'],
        ['Example team B', '', 'Open space']
      ]);
      ws['!cols'] = [{ wch: 28 }, { wch: 28 }, { wch: 14 }];
      X.utils.book_append_sheet(wb, ws, 'Program');
      var how = X.utils.aoa_to_sheet([
        ['How to fill the EdenStardust program'],
        ['1. One sheet, one header row: Team name | Employee name | Type. Keep the header as it is.'],
        ['2. One row per seat: write the team name on every row. EdenStardust counts the seats of each team for you.'],
        ['3. Employee name is optional: leave it empty for a seat with no name yet (like Example team B).'],
        ['4. Type (optional): Open space, Open space hidden (an open-space desk with a wall behind the seat), Single, Manager, C-level, or Room for N (R2 … R10: a desk in a closed room for N people, e.g. R4 or Room for 4).'],
        ['5. No totals, notes, titles or merged cells. Hebrew or English.'],
        ['6. Delete the example rows, then upload the file with Upload program.']
      ]);
      how['!cols'] = [{ wch: 100 }];
      X.utils.book_append_sheet(wb, how, 'How to fill');
      var out = X.write(wb, { bookType: 'xlsx', type: 'array' });
      downloadFile('EdenStardust program format.xlsx', new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    }, function () { layNote('Could not make the format file.'); });
  });
  // Ask the brain to read a file's sheets. Resolves with { tabs } (each tab its own milestone), { res } (one program),
  // or null after showing why not (empty, messy table, no server).
  function askProgram(fname, sheets) {
    progNote('Reading ' + fname + '…');
    return brain('program', null, { sheets: sheets, title: fileBase(), tabs: !!(MS.db && MS.wrapped) }).then(function (a) {
      if (!a || a.kind === 'empty') { progNote(''); showErr(fname + ' is empty.'); return null; }
      if (a.kind === 'messy') { progNote(''); showErr(''); showMessy(true); return null; }
      showErr(''); showMessy(false);
      return a.kind === 'tabs' ? { tabs: a.tabs } : { res: a.res };
    }, function (e) {
      progNote('');
      showErr(e && e.code === 'nobrain' ? 'Reading a program works on edenstardust.com (this page is a preview).' : 'The file could not be read: no answer from the server. Check the connection and try again.');
      return null;
    });
  }
  upfile.addEventListener('change', function () {
    var file = upfile.files && upfile.files[0]; if (!file) return;
    readSheets(file).then(function (sheets) {
      return askProgram(file.name, sheets).then(function (a) {
        if (!a) return;
        if (a.tabs) return loadTabs(a.tabs, file.name, false);
        addProgram(a.res, file.name, a.res.how);
      });
    }, function () { showErr('Could not read that file. Use .xlsx or .csv.'); });
  });


