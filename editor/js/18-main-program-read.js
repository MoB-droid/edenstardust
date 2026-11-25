  // ---- Reading a program table: columns are recognised by header words (any language, typos allowed) and by
  // their content: a column of whole numbers is the seats count, text columns are team name and person name.
  function isNum(v) { return /^ *[0-9]+([.]0+)? *$/.test(String(v)); }
  function kindOf(h) {
    h = String(h).trim().toLowerCase();
    if (!h) return null;
    if (/(^|[^a-z])type([^a-z]|$)|kind|סוג/.test(h)) return 'ptype';
    if (/seat|count|headcount|size|capacity|member|people|employees|desks|places|מקומ|עמד|כמות|מספר עובדים|מס.? עובדים|תקן/.test(h)) return 'seats';
    if (/^(team *(#|no[.]?|num(ber)?|id)|#|מספר צוות|מס.? צוות)$/.test(h)) return 'team';
    if (/team|dep|group|unit|division|צוות|מחלק|יחיד|קבוצ|חטיב|אגף/.test(h)) return 'tname';
    if (/name|employee|person|worker|שם|עובד/.test(h)) return 'person';
    return null;
  }
  function mapColumns(rows) {
    var w = Math.max.apply(null, rows.map(function (r) { return r.length; })), first = rows[0], body = rows.slice(1);
    var numeric = [], text = [];
    for (var i = 0; i < w; i++) {
      var vals = body.map(function (r) { return r[i]; }).filter(function (v) { return v !== undefined && String(v).trim() !== ''; });
      var nn = vals.filter(isNum).length;
      numeric[i] = vals.length > 0 && nn >= 0.8 * vals.length; text[i] = vals.length > 0 && nn < 0.5 * vals.length;
    }
    var m = {}, hits = 0;
    for (var ti = 0; ti < w; ti++) {
      var tv = body.map(function (r) { return String(r[ti] === undefined ? '' : r[ti]).trim(); }).filter(Boolean);
      if (tv.length && tv.every(function (v) { return !!normType(v); })) { m.ptype = ti; numeric[ti] = text[ti] = false; break; }
    }
    first.forEach(function (c, i) {
      var k = kindOf(c); if (!k) return;
      if (k === 'person' && numeric[i]) k = 'seats';
      if (k === 'seats' && !numeric[i]) return;
      if (k === 'ptype' && m.ptype !== undefined && m.ptype !== i) return;
      if (m[k] === undefined) { m[k] = i; hits++; } else if (k === 'ptype') hits++;
    });
    var header = hits > 0 || first.some(function (c, i) { return numeric[i] && String(c).trim() !== '' && !isNum(c); });
    // fill what the headers did not name, from the column contents
    for (var j = 0; j < w; j++) {
      if (Object.keys(m).some(function (k) { return m[k] === j; })) continue;
      if (numeric[j] && m.seats === undefined && m.team !== j) m.seats = j;
      else if (text[j] && m.tname === undefined && m.team === undefined) m.tname = j;
      else if (text[j] && m.person === undefined) m.person = j;
    }
    if (!header && m.tname === undefined && m.team === undefined) return null;
    return { m: m, header: header };
  }
  var SKIP = /^(total|sum|סה.?כ|סך הכל|סיכום|הערה)/i;
  // seat type from the program: OS = connected desk; S, M, C = single desks; R2…R10 = a desk in a closed room for N
  // people (no meeting table): a closed-room desk like S / M / C (set by the user 24 Nov 2026)
  // desk type: the initials or the words of our format (Open space, Single, Manager, C-level), also in Hebrew
  function normType(v) {
    v = String(v || '').trim().toLowerCase().replace(/[\s_.-]+/g, ' ');
    if (/^(osh|os ?h|open ?space ?hidden|openspace ?hidden|hidden|אופן ?ספייס ?(נסתר|מוסתר|חבוי)|חלל פתוח ?(נסתר|מוסתר|חבוי)|נסתר|מוסתר)$/.test(v)) return 'OSH';
    if (/^(os|open ?space|openspace|אופן ?ספייס|חלל פתוח)$/.test(v)) return 'OS';
    if (/^(s|single|single desk|יחיד|בודד)$/.test(v)) return 'S';
    if (/^(m|manager|מנהל|מנהלת)$/.test(v)) return 'M';
    if (/^(c|c ?level|clevel|c ?suite|הנהלה|בכיר|בכירה)$/.test(v)) return 'C';
    var r = /^(?:r ?(\d{1,2})|room ?(?:for ?)?(\d{1,2})(?: ?(?:people|persons?|pax|seats?))?|(\d{1,2}) ?(?:people|persons?|pax|seats?) ?room|חדר ?(?:ל ?-? ?)?(\d{1,2})(?: ?(?:אנשים|עובדים|מקומות))?)$/.exec(v);
    var n = r ? +(r[1] || r[2] || r[3] || r[4]) : 0;
    if (n >= 2 && n <= 10) return 'R' + n;
    return '';
  }

  // ---- Upload program: Claude reads the whole file (every sheet, messy tables, notes, totals) and returns the teams.
  // They are added at once and Suggest runs; a team Claude was unsure about shows a ⚠ note. Without Claude, the
  // column reader (mapColumns) is used instead.
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
  function filled(rows) { return rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); }); }
  function sheetText(sheets) {
    var out = [], size = 0;
    sheets.forEach(function (sh) {
      var rows = filled(sh.rows); if (!rows.length) return;
      out.push('### Sheet: ' + sh.name);
      rows.forEach(function (r, i) {
        if (size > 170000) return;
        var line = 'r' + (i + 1) + ': ' + r.map(function (c) { return String(c).replace(/\s+/g, ' ').trim().slice(0, 80); }).join(' | ');
        size += line.length * 2; out.push(line);
      });
    });
    return out.join('\n');
  }
  function aiPrompt(name, text) {
    return [
      'You read an office "program": a table a client sent saying which teams need desks on a floor. It is often messy: titles, notes, totals, subtotals, several sheets, merged headers, floors, extra columns (phones, emails, ids), Hebrew or English, typos.',
      'Return ONLY JSON: {"teams":[{"name":"...","seats":28,"people":["..."],"flag":null}],"ignored":[{"rows":3,"why":"totals"}]}',
      'Rules:',
      '1. A team is a department, unit, group, company or project that needs workstations. Keep its name exactly as written (never translate).',
      '2. seats = workstations it needs: an explicit seat / desk / headcount / members number. If open-space desks and rooms (offices, manager rooms) are counted separately, add them: each room is 1 seat unless a number is given. If only people are listed, the number of people. If both, the larger.',
      '3. people = person names listed for the team (an empty list if none). Never put numbers, roles or emails in people.',
      '4. Ignore titles, notes, empty rows, repeated headers, totals and subtotals (total, sum, סה"כ, סיכום), and summary tables that repeat teams already counted. Count what you ignored in "ignored" with a short reason.',
      '5. The same team in several rows (split by floor or sub-unit) is one team with the seats added up, unless the rows list its people.',
      '6. If several sheets hold the same data, use the most detailed one, once.',
      '7. flag: null, or a short English note (max 8 words) when something is unsure, e.g. "no seat count", "seats guessed from people", "possible duplicate of X", "mixed totals". Use seats 0 when there is no number and no people.',
      '8. Never invent teams, people or numbers.',
      '9. If there is a type column (OS = open-space desk; OSH = open-space desk with nothing behind the seat; S = single room, M = manager room, C = C-level room; R2 … R10 = a desk in a closed room for 2 … 10 people, no meeting table), also return "people_types": one of "OS", "OSH", "S", "M", "C", "R2" … "R10" or null for each person (same order as people), and "seat_types": {"OS": n, "OSH": n, "S": n, "M": n, "C": n, "R2": n, …, "R10": n} for seats not tied to a listed person (only the types that occur). Leave both out when there is no type column.',
      '', 'File: ' + name, '', text
    ].join('\n');
  }
  function aiRead(name, sheets) {
    if (!(window.claude && window.claude.use)) return Promise.resolve(null);
    return window.claude.use('sample').then(function (s) {
      if (!s) return null;
      return s.json(aiPrompt(name, sheetText(sheets)), { modelTier: 'default' }).then(function (j) {
        if (!j || !Array.isArray(j.teams)) return null;
        var teams = j.teams.map(function (t) {
          var people = Array.isArray(t && t.people) ? t.people.map(function (p) { return String(p).trim(); }).filter(function (p) { return p && !isNum(p); }) : [];
          var seats = Math.max(0, Math.min(2000, Math.round(+(t && t.seats) || 0)));
          var pt = Array.isArray(t && t.people_types) ? t.people_types.map(normType) : [], st = [];
          var sc = t && t.seat_types && typeof t.seat_types === 'object' ? t.seat_types : {};
          ['OS', 'OSH', 'S', 'M', 'C'].concat(R_TYPES).forEach(function (k) { for (var q = 0; q < Math.min(2000, Math.round(+sc[k] || 0)); q++) st.push(k); });
          while (pt.length < people.length) pt.push('');
          return { name: String((t && t.name) || '').trim().slice(0, 80), seats: seats, people: people, flag: t && t.flag ? String(t.flag).slice(0, 80) : '', types: pt.slice(0, people.length).concat(st), typesPeople: people.length };
        }).filter(function (t) { return t.name; });
        var ign = Array.isArray(j.ignored) ? j.ignored : [];
        return { teams: teams, ignored: ign.reduce(function (s, x) { return s + (Math.round(+(x && x.rows)) || 0); }, 0), why: ign.map(function (x) { return x && x.why ? String(x.why) : ''; }).filter(Boolean).slice(0, 4).join(', ') };
      }, function (e) { return { error: (e && e.code) || 'error' }; });
    }, function () { return null; });
  }
  // the column reader: first sheet with rows, columns found by header words or by content
  function columnRead(sheets) {
    var sh = sheets.filter(function (s) { return filled(s.rows).length; })[0]; if (!sh) return null;
    var rows = filled(sh.rows), mc = mapColumns(rows); if (!mc) return null;
    var m = mc.m; if (mc.header) rows = rows.slice(1);
    var groups = [], byKey = {}, ign = 0;
    rows.forEach(function (r) {
      var cell = function (k) { return m[k] === undefined ? '' : String(r[m[k]] === undefined ? '' : r[m[k]]).trim(); };
      var tn = cell('tname'), tid = cell('team'), key = (tn || tid).toLowerCase();
      if (!key || SKIP.test(key) || key.length > 60) { ign++; return; }
      if (!byKey[key]) { byKey[key] = { name: tn || (isNaN(+tid) ? tid : ''), people: [], seats: 0, flag: '', ptypes: [], stypes: [] }; groups.push(byKey[key]); }
      var g = byKey[key], pn = cell('person'), se = parseInt(cell('seats'), 10);
      var ty = normType(cell('ptype'));
      if (pn && !isNum(pn)) { g.people.push(pn); g.ptypes.push(ty); }
      else if (m.seats === undefined) { g.blank = (g.blank || 0) + 1; g.stypes.push(ty); }   // our format: every row is one seat, a name is optional
      else if (se > 0 && ty) for (var q = 0; q < Math.min(se, 2000); q++) g.stypes.push(ty);
      // seats on person rows repeat the team size (keep the largest); on team rows they add up (a team split over rows)
      if (se > 0) g.seats = m.person !== undefined ? Math.max(g.seats, se) : g.seats + se;
    });
    groups.forEach(function (g) { if (m.seats === undefined) g.seats = g.people.length + (g.blank || 0); if (!g.seats && !g.people.length) g.flag = 'no seat count'; g.types = g.ptypes.concat(g.stypes); g.typesPeople = g.ptypes.length; });
    return { teams: groups, ignored: ign, why: ign ? 'totals, notes or empty' : '', header: mc.header };
  }
  // ---- HR seating files (rules D4, set by the user 18 Nov 2026): a tab of rooms with many columns (floor, unit,
  // team, first / last name, role, manager, space needed, 0/1 room columns). Team = the TOP group: of the group
  // columns, the one with the fewest distinct values (the header words differ between companies). First names only:
  // last names are never kept. Future hires = a seat with no name. Type from the space column, else the 0/1 columns.
  // One floor: when the plan title names a floor that is in the file, only that floor is read.
  var HR = {
    tab: /חדרים|rooms|seating|הושבה|עמדות/i,
    group: /יחיד|צוות|מחלק|אגף|חטיב|קבוצ|unit|team|dep|division|group/i,
    first: /שם פרטי|first ?name|given name/i,
    last: /שם משפחה|last ?name|surname|family/i,
    name: /^(שם|שם עובד|שם העובד|name|employee|employee name|full name)$/i,
    floor: /קומה|floor|level/i,
    space: /סוג חלל|חלל נדרש|סוג עמדה|seat ?type|space/i,
    future: /גיוס|עתידי|\btbd\b|vacant|open position|future/i
  };
  function hrCell(v) { return String(v === undefined || v === null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function hrType(v) {
    v = hrCell(v).toLowerCase();
    if (!v || v.charAt(0) === '#' || v === '0') return '';
    if (/מנהל|מנכ|בכיר|manager|c-?level|executive/.test(v)) return 'M';
    if (/ר"צ|רצ|חדר|יחיד|בודד|single|office|room/.test(v)) return 'S';
    if (/עמד|אופן|חלל פתוח|open|workstation|desk/.test(v)) return 'OS';
    return '';
  }
  function hrHeader(rows) {
    for (var i = 0; i < Math.min(rows.length, 30); i++) {
      var h = (rows[i] || []).map(hrCell), f = -1, g = 0;
      h.forEach(function (x, j) { if (f < 0 && HR.first.test(x)) f = j; });
      if (f < 0) h.forEach(function (x, j) { if (f < 0 && HR.name.test(x)) f = j; });
      h.forEach(function (x, j) { if (x && j !== f && HR.group.test(x) && !HR.first.test(x) && !HR.last.test(x)) g++; });
      if (f >= 0 && g >= 1 && (HR.first.test(h[f]) || g >= 2)) return { i: i, h: h, first: f };
    }
    return null;
  }
  function hrRead(sheets) {
    var order = sheets.filter(function (s) { return HR.tab.test(s.name); }).concat(sheets.filter(function (s) { return !HR.tab.test(s.name); }));
    for (var si = 0; si < order.length; si++) {
      var rows = order[si].rows || [], hd = hrHeader(rows); if (!hd) continue;
      var h = hd.h, first = hd.first;
      var at = function (r, j) { return j < 0 ? '' : hrCell(r[j]); };
      var idx = function (re, skip) { for (var j = 0; j < h.length; j++) if (h[j] && re.test(h[j]) && skip.indexOf(j) < 0) return j; return -1; };
      var last = idx(HR.last, [first]), floor = idx(HR.floor, [first, last]), space = idx(HR.space, [first, last, floor]);
      var used = [first, last, floor, space], gcols = [];
      h.forEach(function (x, j) { if (x && HR.group.test(x) && used.indexOf(j) < 0 && !HR.first.test(x) && !HR.last.test(x)) gcols.push(j); });
      used = used.concat(gcols);
      if (!gcols.length) continue;
      var rest = filled(rows.slice(hd.i + 1));
      // a row is a seat when it has a first or a last name (the last name is only checked, never kept)
      var body = rest.filter(function (r) { var a = at(r, first); return (a || at(r, last)) && !SKIP.test(a) && !SKIP.test(at(r, space)); });
      var ign = rest.length - body.length;
      // one floor: a number in the plan title that is a floor in the file
      var floors = {}, fl = '', other = 0;
      if (floor >= 0) body.forEach(function (r) { var f = at(r, floor); if (f) floors[f] = 1; });
      (fileBase().match(/\d+/g) || []).forEach(function (n) { if (!fl && floors[n]) fl = n; });
      if (fl) { other = body.length; body = body.filter(function (r) { return at(r, floor) === fl; }); other -= body.length; }
      // top group = the group column with the fewest distinct values (several sub-groups share one top group)
      var cnt = {};
      gcols.forEach(function (j) { var d = {}; body.forEach(function (r) { var v = at(r, j); if (v) d[v] = 1; }); cnt[j] = Object.keys(d).length; });
      gcols = gcols.filter(function (j) { return cnt[j] > 0; }).sort(function (a, b) { return cnt[a] - cnt[b]; });
      if (!gcols.length) continue;
      // 0/1 room columns (e.g. "עמדת עבודה", "חדר ר"צ", "חדר מנהל בכיר"): the header word gives the type
      var flags = [];
      h.forEach(function (x, j) {
        if (used.indexOf(j) >= 0 || !hrType(x)) return;
        if (body.every(function (r) { var v = at(r, j); return v === '' || v === '0' || v === '1'; })) flags.push([j, hrType(x)]);
      });
      var groups = [], byKey = {};
      body.forEach(function (r) {
        var tn = ''; for (var k = 0; k < gcols.length && !tn; k++) tn = at(r, gcols[k]);
        if (!tn) { ign++; return; }
        var key = tn.toLowerCase();
        if (!byKey[key]) { byKey[key] = { name: tn.slice(0, 80), people: [], ptypes: [], stypes: [], flag: '' }; groups.push(byKey[key]); }
        var g = byKey[key], nm = at(r, first).split(' ')[0];
        if (HR.future.test(at(r, first)) || HR.future.test(at(r, last))) nm = '';
        var ty = space >= 0 ? hrType(at(r, space)) : '';
        if (!ty) flags.some(function (f) { if (at(r, f[0]) === '1') { ty = f[1]; return true; } return false; });
        if (nm) { g.people.push(nm); g.ptypes.push(ty); } else g.stypes.push(ty);
      });
      if (!groups.length) continue;
      groups.forEach(function (g) { g.seats = g.people.length + g.stypes.length; g.types = g.ptypes.concat(g.stypes); g.typesPeople = g.ptypes.length; });
      return { teams: groups, ignored: ign, why: ign ? 'totals, notes or empty' : '', header: true,
        how: 'HR file: tab “' + order[si].name + '”, team = “' + h[gcols[0]] + '”' + (fl ? ', floor ' + fl + ' only (' + other + ' on other floors)' : '') + ', first names only' };
    }
    return null;
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
  function isMessy(res, sheets) {
    if (!res || !res.teams || !res.teams.length) return true;
    var empty = res.teams.filter(function (t) { return !t.seats && !(t.people && t.people.length); }).length;
    if (empty * 2 >= res.teams.length) return true;
    if (res.header === false) return true;   // the column reader found no header row
    var rows = 0; sheets.forEach(function (sh) { rows += filled(sh.rows).length; });
    return rows > 4 && (res.ignored || 0) * 2 > rows;
  }
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
  function readProgram(fname, sheets) {
    if (!sheets.some(function (s) { return filled(s.rows).length; })) { showErr(fname + ' is empty.'); return Promise.resolve(null); }
    // an HR seating file is read by its own rules (hrRead), never by Claude or the column reader
    var hr = hrRead(sheets);
    if (hr) { showErr(''); showMessy(false); return Promise.resolve(hr); }
    progNote('Reading ' + fname + ' with Claude…');
    return aiRead(fname, sheets).then(function (res) {
      var how = '';
      if (!res || res.error || !res.teams.length) {
        how = res && res.error === 'rate_limited' ? 'read without Claude (usage limit reached)' : 'read without Claude';
        res = columnRead(sheets);
      }
      if (isMessy(res, sheets)) { progNote(''); showErr(''); showMessy(true); return null; }
      showMessy(false);
      res.how = how; return res;
    });
  }
  upfile.addEventListener('change', function () {
    var file = upfile.files && upfile.files[0]; if (!file) return;
    readSheets(file).then(function (sheets) {
      var tabs = programTabs(sheets);
      if (tabs) return loadTabs(tabs, file.name, false);
      return readProgram(file.name, sheets).then(function (res) { if (res) addProgram(res, file.name, res.how); });
    }, function () { showErr('Could not read that file. Use .xlsx or .csv.'); });
  });

