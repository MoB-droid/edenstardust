function MAIN() {
  var plan = document.getElementById('plan'), wrap = document.getElementById('wrap');
  var btns = document.querySelectorAll('.zoom button');
  // Zoom: Fit = the whole plan inside the box (width and height, no scrolling); 2× and 3× zoom from there.
  var zoomF = 1;
  function fitWidth() {
    var vb = plan.viewBox.baseVal, availW = wrap.clientWidth || wrap.getBoundingClientRect().width;
    var availH = (window.innerWidth >= 1200 ? wrap.clientHeight : window.innerHeight * 0.82) - 2;
    if (!vb || !vb.width || !vb.height) return availW;
    return Math.max(120, Math.min(availW, availH * vb.width / vb.height));
  }
  function applyZoom() {
    var w = fitWidth() * zoomF;
    plan.style.width = Math.floor(w) + 'px';
    wrap.classList.toggle('zoomed', zoomF > 1);
  }
  btns.forEach(function (b) { b.addEventListener('click', function () {
    zoomF = parseFloat(b.dataset.z) || 1; applyZoom();
    btns.forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
  }); });
  window.addEventListener('resize', applyZoom);
  window.__applyZoom = applyZoom;
  // Wide screens: the PROGRAM title starts at 1/3 of the screen height + 2.3 cm (87 px) (totals and Suggest stay at the top).
  // totals line: font size chosen so the whole line spans the width above the PROGRAM table
  function fitTotals() {
    var t = document.querySelector('.tot'), sec = t && t.closest('section'); if (!t) return;
    var scs = getComputedStyle(sec), avail = sec.clientWidth - parseFloat(scs.paddingLeft) - parseFloat(scs.paddingRight); if (!avail) return;
    t.style.fontSize = '100px';
    var w = t.scrollWidth || 1; t.style.fontSize = '100px';
    var range = document.createRange(); range.selectNodeContents(t); w = range.getBoundingClientRect().width || w;
    t.style.fontSize = Math.max(14, Math.min(80, 100 * avail / w * 0.999)).toFixed(2) + 'px';
    var pt = document.querySelector('.tabletitle h2'); if (pt) pt.style.fontSize = t.style.fontSize;   // PROGRAM title = same text as the totals
    var lt = document.getElementById('ltitle'); if (lt) lt.style.fontSize = t.style.fontSize;          // layout title = same size too
    var at = document.getElementById('antitle'); if (at) at.style.fontSize = t.style.fontSize;         // ANALYSIS title = PROGRAM title
  }
  // wide screens: the right frame has the same top and height as the plan frame
  function alignTotalsTop() {
    var sec = document.querySelector('main > section.stack:last-child'), pw = document.getElementById('wrap');
    if (!sec || !pw) return;
    if (window.innerWidth < 1200) { sec.style.marginTop = ''; sec.style.height = ''; pw.style.height = ''; return; }
    // the plan box ends 24 px above the bottom of the window, so the page itself never scrolls
    var want = Math.max(320, Math.floor(window.innerHeight - (pw.getBoundingClientRect().top + window.scrollY) - 24));
    if (Math.abs((parseFloat(pw.style.height) || 0) - want) > 1) { pw.style.height = want + 'px'; if (window.__applyZoom) window.__applyZoom(); }
    var over = document.documentElement.scrollHeight - window.innerHeight;
    if (over > 0) { pw.style.height = Math.max(320, (parseFloat(pw.style.height) || want) - over) + 'px'; if (window.__applyZoom) window.__applyZoom(); }
    var cur = parseFloat(sec.style.marginTop) || 0;
    var off = pw.getBoundingClientRect().top - (sec.getBoundingClientRect().top - cur);
    sec.style.marginTop = Math.max(0, Math.round(off)) + 'px';
    sec.style.height = pw.offsetHeight + 'px';
  }
  function alignProgram() {
    fitTotals();
    alignTotalsTop();
    var el = document.querySelector('.tabletitle'); if (!el) return;
    if (window.innerWidth < 1200) { el.style.marginTop = ''; return; }
    var cur = parseFloat(el.style.marginTop) || parseFloat(getComputedStyle(el).marginTop) || 0;
    var sc = el.closest('section'), top = el.getBoundingClientRect().top + window.scrollY + (sc ? sc.scrollTop : 0) - cur;   // count the frame's own scroll, so a resize while it is scrolled does not push PROGRAM down
    el.style.marginTop = Math.max(14, Math.round((window.innerHeight / 3 + 87) - top)) + 'px';
  }
  window.addEventListener('resize', alignProgram);
  alignProgram();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(alignProgram);
  setTimeout(alignProgram, 600);
  applyZoom();
  function deskOfRow(r) { var v = r && r.children[2] ? r.children[2].textContent.trim() : ''; return /^[0-9]+$/.test(v) ? v : ''; }
  // the person row sitting at desk n now (by the Seat column), else the row with that id
  function rowOfDesk(n) {
    var hit = null;
    document.querySelectorAll('#srows tbody.grp:not(.gone) tr.m').forEach(function (r) { if (!hit && !r.classList.contains('unused') && !r.classList.contains('pgone') && deskOfRow(r) === String(n)) hit = r; });
    return hit || document.querySelector('#srows tr[data-s="' + n + '"]');
  }
  function hi(n, scroll) {
    document.querySelectorAll('.hi').forEach(function (e) { e.classList.remove('hi'); });
    var r = rowOfDesk(n);
    document.querySelectorAll('.dk[data-s="' + n + '"]').forEach(function (x) { x.classList.add('hi'); });
    var d = document.querySelector('#desks .dk[data-s="' + n + '"]');
    if (r) { r.classList.add('hi'); setOpen(r.parentNode, true); }
    if (scroll && d) {
      if (zoomF === 1) document.getElementById('z3').click();
      wrap.scrollIntoView({ block: 'nearest' });
      requestAnimationFrame(function () {
        var bb = d.getBoundingClientRect(), wb = wrap.getBoundingClientRect();
        wrap.scrollLeft += (bb.left + bb.width / 2) - (wb.left + wb.width / 2);
        wrap.scrollTop += (bb.top + bb.height / 2) - (wb.top + wb.height / 2);
      });
    }
  }
  // Pan: with the mouse, drag the plan to move around it (when zoomed in); touch screens scroll natively.
  var pan = null, panMoved = false;
  wrap.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch' || e.button !== 0 || e.target.closest('.team')) return;
    if (wrap.scrollWidth <= wrap.clientWidth + 1 && wrap.scrollHeight <= wrap.clientHeight + 1) return;
    pan = { x: e.clientX, y: e.clientY, sl: wrap.scrollLeft, st: wrap.scrollTop, id: e.pointerId }; panMoved = false;
  });
  wrap.addEventListener('pointermove', function (e) {
    if (!pan || e.pointerId !== pan.id) return;
    var dx = e.clientX - pan.x, dy = e.clientY - pan.y;
    if (!panMoved && Math.abs(dx) + Math.abs(dy) < 5) return;
    if (!panMoved) { panMoved = true; wrap.classList.add('panning'); try { wrap.setPointerCapture(e.pointerId); } catch (err) {} }
    wrap.scrollLeft = pan.sl - dx; wrap.scrollTop = pan.st - dy; e.preventDefault();
  });
  function endPan(e) {
    if (!pan) return; pan = null; wrap.classList.remove('panning');
    try { wrap.releasePointerCapture(e.pointerId); } catch (err) {}
    if (panMoved) setTimeout(function () { panMoved = false; }, 0);
  }
  wrap.addEventListener('pointerup', endPan); wrap.addEventListener('pointercancel', endPan);
  wrap.addEventListener('click', function (e) { if (panMoved) { e.stopPropagation(); e.preventDefault(); } }, true);
