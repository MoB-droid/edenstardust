// ---- Red flags (set by the user 24 Nov 2026): L.flags = [{ n, text, at: [x, y], pos: [x, y], w }]. at = the spot flagged
// (end of the red line, optional); pos = foot of the pole (the label sits there; missing = placed automatically just
// outside the building, as close to at as possible); w = max text width (wraps). Drawn in #flags, above everything.
// FLAG_BOXES = the label boxes, kept free of team markers (clearMarkers).
// flagsShown(): the Show / hide flags button (top right of the plan frame), remembered per plan in this browser
function flagsKey() { return (EMBED.lskey || 'edits:Seat Plan') + ':flags'; }
function flagsShown() { try { return localStorage.getItem(flagsKey()) !== 'off'; } catch (e) { return true; } }
var FLAG_BOXES = [], FL_POLE = 120, FL_PW = 80, FL_PH = 56, FL_FS = 46, FL_LH = 54;
function flagLines(s, w) {
  var cw = FL_FS * 0.5, max = w > 0 ? Math.max(1, Math.floor(w / cw)) : Infinity, out = [], cur = '';
  String(s).split(/\s+/).forEach(function (word) {
    if (!word) return;
    if (!cur) cur = word; else if ((cur + ' ' + word).length <= max) cur += ' ' + word; else { out.push(cur); cur = word; }
  });
  if (cur || !out.length) out.push(cur);
  return out;
}
// avoid (optional): boxes to keep the labels off (the team markers, placed first)
function drawFlags(L, avoid) {
  var g = document.getElementById('flags'); FLAG_BOXES = []; avoid = avoid || [];
  if (!g) return;
  var F = Array.isArray(L.flags) ? L.flags : [];
  if (!F.length) { g.innerHTML = ''; if (window.__placeFlagTog) window.__placeFlagTog(); return; }
  // the building: the extent, or for a sheet kept as uploaded the desks' area plus the facade
  var E = L.extent, B = E.slice();
  if (L.asIs && L.desks && L.desks.length) {
    var bx = [Infinity, Infinity, -Infinity, -Infinity];
    L.desks.forEach(function (d) { bx[0] = Math.min(bx[0], d[0]); bx[1] = Math.min(bx[1], d[1]); bx[2] = Math.max(bx[2], d[2]); bx[3] = Math.max(bx[3], d[3]); });
    B = [Math.max(E[0], bx[0] - 150), Math.max(E[1], bx[1] - 150), Math.min(E[2], bx[2] + 150), Math.min(E[3], bx[3] + 150)];
  }
  var out = [], M = L.margin || 250, VB = [E[0] - M, E[1] - M, E[2] + M, E[3] + M];
  function ok(a) { return Array.isArray(a) && a.length >= 2 && isFinite(a[0]) && isFinite(a[1]); }
  function onDesk(b) { return (L.desks || []).some(function (d) { return b.x0 < d[2] + 10 && b.x1 > d[0] - 10 && b.y0 < d[3] + 10 && b.y1 > d[1] - 10; }); }
  function cross(x0, y0, x1, y1) {
    var n = 0;
    (L.desks || []).forEach(function (d) {
      var t0 = 0, t1 = 1, dx = x1 - x0, dy = y1 - y0, P = [-dx, dx, -dy, dy], Q = [x0 - d[0] + 2, d[2] - 2 - x0, y0 - d[1] + 2, d[3] - 2 - y0];
      for (var j = 0; j < 4; j++) { if (P[j] === 0) { if (Q[j] < 0) return; continue; } var r = Q[j] / P[j]; if (P[j] < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r); if (t0 > t1) return; }
      n++;
    });
    return n;
  }
  function boxAt(px, py, tw, nl) { return { x0: px - 12, y0: py - FL_POLE - 12, x1: px + FL_PW + 16 + tw + 12, y1: Math.max(py, py - FL_POLE + FL_PH / 2 + (nl - 1) * FL_LH + FL_FS / 2) + 12 }; }
  function hit(b) { return FLAG_BOXES.concat(avoid).some(function (o) { return b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0; }); }
  F.forEach(function (f, i) {
    if (!f || (f.q === 'transparent' && !ASK_TRANSPARENT)) return;
    var isQ = f.q === 'transparent', OPW = 90, OPG = 24;
    var lab = isQ ? 'Seats  ' + (f.n || '') + ': ' + (f.text || 'Transparent?') : (f.n !== undefined && f.n !== null && f.n !== '' ? f.n + ' ' : '') + (f.text || '');
    var lines = flagLines(lab, +f.w || 0), tw = 0;
    lines.forEach(function (s) { tw = Math.max(tw, s.length * FL_FS * 0.5); });
    var tw0 = tw; if (isQ) tw += OPG + 2 * OPW + OPG;   // the y / n buttons after the text
    var bh = Math.max(FL_POLE, FL_PH / 2 + (lines.length - 1) * FL_LH + FL_FS / 2), bw = FL_PW + 16 + tw;
    var at = ok(f.at) ? [+f.at[0], +f.at[1]] : null, px, py;
    if (ok(f.pos)) { px = +f.pos[0]; py = +f.pos[1]; }
    else {
      // close to the flagged spot, in blank space inside the plan's view (the view never grows for a flag): of the spots
      // around it, the one whose label covers no desk and no other flag, stays inside the view, and whose red line
      // crosses the fewest desks, then the shortest line (set by the user 24 Nov 2026)
      var a = at || [B[0] + 60, B[1] + FL_POLE + 60], best = null;
      for (var r = at ? 90 : 0; r <= 2400 && !(best && best.sc < 1e6 && r > best.r + 400); r += 70) {
        var nd = r ? Math.max(12, Math.round(r / 40)) : 1;
        for (var k = 0; k < nd; k++) {
          var t = 2 * Math.PI * k / nd, qx = a[0] + Math.cos(t) * r, qy = a[1] + Math.sin(t) * r, bx = boxAt(qx, qy, tw, lines.length);
          if (bx.x0 < VB[0] || bx.y0 < VB[1] || bx.x1 > VB[2] || bx.y1 > VB[3] || hit(bx) || onDesk(bx)) continue;
          var sc = (at ? cross(qx, qy, at[0], at[1]) * 1e6 : 0) + r;
          if (!best || sc < best.sc) best = { sc: sc, x: qx, y: qy, r: r };
        }
      }
      if (best) { px = best.x; py = best.y; }
      else { px = Math.max(VB[0] + 12, Math.min(VB[2] - bw - 24, a[0])); py = Math.max(VB[1] + FL_POLE + 12, Math.min(VB[3] - 12, a[1])); }
    }
    var top = py - FL_POLE, h = [];
    if (at) h.push('<line class="fl-line" x1="' + f1(px) + '" y1="' + f1(py) + '" x2="' + f1(at[0]) + '" y2="' + f1(at[1]) + '"/>');
    h.push('<line class="fl-pole" x1="' + f1(px) + '" y1="' + f1(py) + '" x2="' + f1(px) + '" y2="' + f1(top) + '"/>');
    h.push('<path class="fl-pen" d="M' + f1(px) + ' ' + f1(top) + 'L' + f1(px + FL_PW) + ' ' + f1(top + FL_PH / 2) + 'L' + f1(px) + ' ' + f1(top + FL_PH) + 'Z"/>');
    lines.forEach(function (s, k) {
      h.push('<text class="fl-txt" x="' + f1(px + FL_PW + 16) + '" y="' + f1(top + FL_PH / 2 + k * FL_LH) + '">' + xesc(s) + '</text>');
    });
    if (isQ) [['y', 'y: glass, see-through. These seats stay OS'], ['n', 'n: opaque. These seats become OSH']].forEach(function (o, k) {
      var ox = px + FL_PW + 16 + tw0 + OPG + k * (OPW + OPG), oy = top + FL_PH / 2;
      h.push('<g class="fl-opt" data-i="' + i + '" data-a="' + o[0] + '" role="button" tabindex="0" aria-pressed="' + (f.ans === o[0] ? 'true' : 'false') + '" aria-label="' + xesc('Seats ' + (f.n || '') + ', ' + o[1]) + '"><title>' + xesc(o[1]) + '</title><rect x="' + f1(ox) + '" y="' + f1(oy - 30) + '" width="' + OPW + '" height="60" rx="14"/><text x="' + f1(ox + OPW / 2) + '" y="' + f1(oy) + '">' + o[0] + '</text></g>');
    });
    out.push('<g class="flag' + (isQ ? ' q' : '') + '" data-n="' + xesc(f.n === undefined ? i + 1 : f.n) + '">' + h.join('') + '</g>');
    FLAG_BOXES.push(boxAt(px, py, tw, lines.length));
  });
  g.innerHTML = out.join('');
  g.style.display = flagsShown() ? '' : 'none';
  if (window.__placeFlagTog) window.__placeFlagTog();
  // keep #flags the last thing drawn, whatever was added to the plan after it
  if (g.parentNode && g.parentNode.lastElementChild !== g) g.parentNode.appendChild(g);
}
// Start: draw the built-in layout, then (up to 4 s) check the database for a newer automatic one.
function pickLayout() {
  return new Promise(function (ok) {
    var done = false; function fin(L) { if (!done) { done = true; ok(L); } }
    setTimeout(function () { fin(null); }, 4000);
    if (!(window.claude && window.claude.use)) return fin(null);
    window.claude.use('db').then(function (d) {
      if (!d) return fin(null);
      d.doc('plan/current').get().then(function (s) {
        var L = s.exists ? s.data() : null;
        fin(L && L.v > EMBED.v && L.desks && L.extent ? L : null);
      }, function () { fin(null); });
    }, function () { fin(null); });
  });
}
function watchPlan() {
  if (!(window.claude && window.claude.use)) return;
  window.claude.use('db').then(function (d) {
    if (!d) return;
    d.doc('plan/current').onSnapshot(function (s) {
      var L = s.exists ? s.data() : null;
      if (!ANALYZING && L && LAYOUT && L.v > LAYOUT.v && L.v > EMBED.v) { lnote('A new layout was saved. Loading it… (reload the page if it does not appear)', true); setTimeout(function () { location.reload(); }, 800); }
    }, function () {});
  });
}
