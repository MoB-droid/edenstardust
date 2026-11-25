  // ---- Export: the layout as a PNG picture, the program as an Excel file (through the downloads capability).
  // Export: the Export next to Upload layout saves the layout picture; the one next to Upload program saves the Excel.
  function closeExp() {}
  function fileBase() { return (titleVal || ltitle.dataset.def).replace(/^Layout\s*·\s*/, '').replace(/[\/:*?"<>|]+/g, '').trim() || 'Seat plan'; }
  function offerFile(name, blob, kind) {
    if (window.__appShare && window.__appShare(name, blob, kind)) return Promise.resolve();
    if (window.__driveSave && window.__driveSave(name, blob, kind)) return Promise.resolve();
    return downloadFile(name, blob);
  }
  // Chrome and Edge (computers and Android) share only pictures, video, sound, PDF and text files: never Excel.
  // Their navigator.canShare() still says yes, and share() then fails, so those files are downloaded instead.
  window.__shareable = function (name) { return !navigator.userAgentData || /\.(jpe?g|png|gif|webp|bmp|pdf|csv|txt)$/i.test(name); };
  window.__downloadFile = function (name, blob) { return downloadFile(name, blob); };
  function downloadFile(name, blob) {
    var use = window.claude && window.claude.use ? window.claude.use('downloads') : Promise.resolve(null);
    return use.then(function (dl) {
      if (!dl) { layNote('Saving files is not available in this view.'); return; }
      return dl.save({ filename: name, data: blob }).then(function () { layNote(''); }, function (e) {
        if (e && e.code === 'declined') return;
        layNote(e && e.code === 'rate_limited' ? 'A save is already open. Finish it, then try again.' : 'Could not save the file.');
      });
    });
  }
  var STYLE_PROPS = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linejoin', 'opacity', 'display', 'visibility', 'font-family', 'font-size', 'font-weight', 'letter-spacing', 'text-anchor', 'dominant-baseline', 'paint-order', 'filter', 'mix-blend-mode'];
  // ---- The layout picture: a header (logo, title, option number, date, edenstardust.com) at the top left, then the
  // high-level summary (total / used / available and every team in its colour with its number of people), then the plan.
  // Each layout picture made gets the next option number (saved in meta / option, field n).
  var optNo = 0;
  try { optNo = +(localStorage.getItem(LS + ':option') || 0) || 0; } catch (e) {}
  window.__setOption = function (n) { if (isFinite(n) && n > optNo) optNo = n; };
  function nextOption() {
    optNo += 1;
    if (db) db.collection('meta').doc('option').set({ n: optNo }).then(function () {}, function () {});
    else { try { localStorage.setItem(LS + ':option', String(optNo)); } catch (e) {} }
    return optNo;
  }
  function logoData() {
    if (!window.fetch) return Promise.resolve(null);
    return fetch('logo.png').then(function (r) { return r.ok ? r.blob() : null; }).then(function (b) {
      if (!b) return null;
      return new Promise(function (ok) { var fr = new FileReader(); fr.onload = function () { var im = new Image(); im.onload = function () { ok(im); }; im.onerror = function () { ok(null); }; im.src = fr.result; }; fr.onerror = function () { ok(null); }; fr.readAsDataURL(b); });
    }).catch(function () { return null; });
  }
  function planImage() {
    return new Promise(function (ok, bad) {
      var svg = document.getElementById('plan'), clone = svg.cloneNode(true);
      var src = svg.querySelectorAll('*'), dst = clone.querySelectorAll('*');
      for (var i = 0; i < src.length; i++) {
        var cs = getComputedStyle(src[i]), st = '';
        STYLE_PROPS.forEach(function (k) { var v = cs.getPropertyValue(k); if (v) st += k + ':' + v + ';'; });
        dst[i].setAttribute('style', st);
      }
      var vb = svg.viewBox.baseVal, W = Math.round(vb.width * 2), H = Math.round(vb.height * 2);
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); clone.setAttribute('width', W); clone.setAttribute('height', H);
      clone.removeAttribute('style');
      var url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
      var img = new Image();
      img.onload = function () { ok({ img: img, W: W, H: H, url: url }); };
      img.onerror = function () { URL.revokeObjectURL(url); bad(new Error('svg')); };
      img.src = url;
    });
  }
  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function makeLayoutPicture() {
    var sum = window.__lastSum || { total: 0, used: 0, teams: [] }, no = nextOption();
    var day = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    var title = (titleVal || ltitle.dataset.def || 'Seat plan').trim();
    return Promise.all([planImage(), logoData()]).then(function (res) {
      var P = res[0], logo = res[1], W = P.W, k = W / 1600;
      var F = '"IBM Plex Sans Condensed", "Arial Narrow", sans-serif', M = '"IBM Plex Mono", Menlo, monospace';
      var pad = 48 * k, headH = 170 * k, cols = 4, gap = 14 * k, tileH = 110 * k, blockH = 64 * k;
      var rows = Math.ceil(sum.teams.length / cols), sumH = tileH + (rows ? 24 * k + rows * blockH + (rows - 1) * gap : 0) + 40 * k;
      var c = document.createElement('canvas'); c.width = W; c.height = Math.round(headH + sumH + P.H);
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, c.width, c.height);
      // header, top left: logo, title, option number and date, site
      var x = pad, y = 36 * k;
      if (logo) { ctx.drawImage(logo, x, y, 96 * k, 96 * k); x += 120 * k; }
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.fillStyle = '#000000';
      ctx.font = '600 ' + (40 * k) + 'px ' + F; ctx.fillText(title, x, y + 38 * k);
      ctx.font = '600 ' + (28 * k) + 'px ' + F; ctx.fillText('Option ' + no + '  ·  ' + day, x, y + 76 * k);
      ctx.fillStyle = '#6E6E6E'; ctx.font = '500 ' + (22 * k) + 'px ' + M; ctx.fillText('edenstardust.com', x, y + 108 * k);
      ctx.fillStyle = '#BEAC6E'; ctx.fillRect(pad, headH - 6 * k, W - 2 * pad, 3 * k);
      // summary: total / used / available
      var top = headH + 20 * k, tw = (W - 2 * pad - 2 * gap) / 3;
      [[sum.total, 'TOTAL SEATS', '#000000'], [sum.used, 'USED', '#000000'], [Math.max(0, sum.total - sum.used), 'AVAILABLE', '#BEAC6E']].forEach(function (t, i) {
        var tx = pad + i * (tw + gap);
        rrect(ctx, tx, top, tw, tileH - 10 * k, 14 * k); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.lineWidth = 2 * k; ctx.strokeStyle = '#E5E5E5'; ctx.stroke();
        ctx.fillStyle = t[2]; ctx.font = '700 ' + (46 * k) + 'px ' + F; ctx.fillText(String(t[0]), tx + 22 * k, top + 52 * k);
        ctx.fillStyle = '#6E6E6E'; ctx.font = '600 ' + (16 * k) + 'px ' + M; ctx.fillText(t[1], tx + 22 * k, top + 82 * k);
      });
      // every team in its colour, name and number of people centred
      var bw = (W - 2 * pad - (cols - 1) * gap) / cols, by0 = top + tileH + 14 * k;
      sum.teams.forEach(function (tm, i) {
        var bx = pad + (i % cols) * (bw + gap), by = by0 + Math.floor(i / cols) * (blockH + gap), col = teamColor(tm.no);
        rrect(ctx, bx, by, bw, blockH, 12 * k); ctx.fillStyle = col.c; ctx.fill();
        ctx.fillStyle = col.ink; ctx.textBaseline = 'middle';
        var nm = tm.name || ('Group ' + tm.no), cnt = String(tm.n), nf = '500 ' + (24 * k) + 'px ' + F, cf = '700 ' + (24 * k) + 'px ' + M;
        ctx.font = nf; var nw = ctx.measureText(nm).width; ctx.font = cf; var cw = ctx.measureText(cnt).width, sp = 14 * k;
        var maxN = bw - cw - sp - 28 * k; while (nw > maxN && nm.length > 1) { nm = nm.slice(0, -1); ctx.font = nf; nw = ctx.measureText(nm + '…').width; if (nw <= maxN) nm += '…'; }
        var sx = bx + (bw - (nw + sp + cw)) / 2;
        ctx.font = nf; ctx.fillText(nm, sx, by + blockH / 2); ctx.font = cf; ctx.fillText(cnt, sx + nw + sp, by + blockH / 2);
        ctx.textBaseline = 'alphabetic';
      });
      ctx.drawImage(P.img, 0, headH + sumH, W, P.H); URL.revokeObjectURL(P.url);
      return new Promise(function (ok, bad) { c.toBlob(function (b) { if (b) ok(b); else bad(new Error('jpg')); }, 'image/jpeg', 0.92); });
    });
  }
  function programRows() {
    var rows = [['Team', 'Team name', 'Seats needed', '#', 'Name', 'Type', 'Seat']];
    document.querySelectorAll('#srows tbody.grp').forEach(function (g) {
      if (g.classList.contains('gone')) return;
      rows.push([g.querySelector('.fold').dataset.lab || '', g.querySelector('.tn').textContent.trim(), +(g.querySelector('.cnt').textContent || 0), '', '', '', '']);
      g.querySelectorAll('tr.m').forEach(function (r) {
        if (r.classList.contains('unused') || r.classList.contains('pgone')) return;
        var seat = r.children[2].textContent.trim();
        var ty = store.ptype[r.dataset.s] || (/^[0-9]+$/.test(seat) ? autoType(deskBy[seat]) : '');
        rows.push(['', '', '', +(r.dataset.no || 0), r.children[1].textContent.trim(), ty, /^[0-9]+$/.test(seat) ? +seat : seat]);
      });
    });
    return rows;
  }
  // the program as CSV (opens in Excel; UTF-8 mark so Hebrew shows right): for share menus that refuse Excel files
  function makeProgramCsv() {
    var csv = programRows().map(function (r) { return r.map(function (v) { v = String(v == null ? '' : v); return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\r\n');
    return new Blob(['\ufeff' + csv], { type: 'text/csv' });
  }
  function makeProgramXlsx() {
    var rows = programRows();
    return loadXLSX().then(function (X) {
      var ws = X.utils.aoa_to_sheet(rows), wb = X.utils.book_new();
      ws['!cols'] = [{ wch: 8 }, { wch: 24 }, { wch: 13 }, { wch: 5 }, { wch: 28 }, { wch: 6 }, { wch: 7 }];
      X.utils.book_append_sheet(wb, ws, 'Program');
      return new Blob([X.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    });
  }
  // send several files to the place chosen for this kind (share menu, Google Drive or this computer)
  function deliverMany(list, kind) {
    var to = destOf(kind).to;
    if (to === 'app' && navigator.share && navigator.canShare) {
      // a file the share menu will not take (the program Excel on Chrome / Edge) is sent in its other form (CSV);
      // anything still refused is saved to Downloads first
      list = list.map(function (f) { return window.__shareable(f.name) || !f.alt ? f : f.alt; });
      var rest = list.filter(function (f) { return !window.__shareable(f.name); });
      list = list.filter(function (f) { return window.__shareable(f.name); });
      if (rest.length) {
        rest.reduce(function (p, f) { return p.then(function () { return downloadFile(f.name, f.blob); }); }, Promise.resolve())
          .then(function () { layNote('The program Excel was saved to Downloads: attach it in WhatsApp with the paperclip.', true); });
        if (!list.length) return;
      }
      var files; try { files = list.map(function (f) { return new File([f.blob], f.name, { type: f.blob.type || 'application/octet-stream' }); }); } catch (e) { files = null; }
      var data = files && { files: files, title: fileBase() };
      if (data && navigator.canShare(data)) {
        navigator.share(data).then(function () { layNote(''); }, function (e) {
          if (e && e.name === 'AbortError') return;
          if (e && e.name === 'NotAllowedError') { tapToShare(data); return; }
          layNote('Could not open the share menu. Try again.');
        });
        return;
      }
      layNote('This device cannot send these files to apps, so they are downloaded instead.');
    }
    if (window.__driveSave && onDrive(kind) && onSite() && GSHEET.apiKey) { list.forEach(function (f) { window.__driveSave(f.name, f.blob, kind); }); return; }
    list.reduce(function (p, f) { return p.then(function () { return downloadFile(f.name, f.blob); }); }, Promise.resolve());
  }
  // layout picture only (kept for the layout destination)
  document.getElementById('exp-png').addEventListener('click', function () {
    if (window.__driveWarm) window.__driveWarm('layout');
    closeExp();
    makeLayoutPicture().then(function (b) { offerFile(fileBase() + ' - layout.jpg', b, 'layout'); }, function () { layNote('Could not make the picture.'); });
  });
  // Share / Reshare under Suggest: the layout picture and the program Excel together
  document.getElementById('exp-xlsx').addEventListener('click', function () {
    if (window.__driveWarm) window.__driveWarm('program');
    closeExp();
    layNote('Making the layout picture and the program…', true);
    Promise.all([makeLayoutPicture(), makeProgramXlsx()]).then(function (r) {
      layNote('');
      deliverMany([{ name: fileBase() + ' - layout.jpg', blob: r[0] }, { name: fileBase() + ' - program.xlsx', blob: r[1], alt: { name: fileBase() + ' - program.csv', blob: makeProgramCsv() } }], 'program');
    }, function () { layNote('Could not make the files.'); });
  });
