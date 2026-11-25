var EMBED = {"v": 1794390941597, "extent": [0, 0, 2400, 1700], "margin": 250, "heading": "Layout · New floor", "desc": "No floor plan yet", "lskey": "edits:Seat Plan", "img": null, "desks": [], "sides": {}};
// ---- Layout data. The plan is drawn from EMBED (built by Claude) or, when newer, from the automatic
// analysis of an uploaded PDF saved in the database (doc plan/current). Upload layout runs that analysis here.
var LAYOUT = null, ANALYZING = false;
// Team colours: soft Stardust tones only. The range is cream #EADEC8, sand #E3BA82, peach #E4C5A9 and stone #BFB8A8;
// every other tone sits between them or is lighter, never darker. Hues alternate so teams next to each other differ.
var TEAM_COLORS = ['#E3BA82', '#EADEC8', '#E4C5A9', '#BFB8A8', '#E8CD9E', '#D9CFBF', '#EBD3BE', '#CEC6B4', '#E6C394', '#F0E6D4', '#DDBFA0', '#D3CBB8', '#EDD9B8', '#E9CDB6', '#C9C1AF', '#F2E2C9'];
var TEAM_INK = TEAM_COLORS.map(function () { return '#000000'; });
function teamColor(no) { var i = (no - 1) % TEAM_COLORS.length; return { c: TEAM_COLORS[i], ink: TEAM_INK[i] }; }
function paintColor(el, col) { if (!el) return; if (col) { el.style.setProperty('--tc', col.c); el.style.setProperty('--tci', col.ink); } else { el.style.removeProperty('--tc'); el.style.removeProperty('--tci'); } }
// Team markers: the pill (T1, T2…) is drawn 3.2× around its own center, big enough to grab and drag;
// the team name and "seats short" under it are drawn 1.6×.
var MK_SCALE = 3.2, LB_SCALE = 1.6;
function scaleMarkers() {
  document.querySelectorAll('#teams .team').forEach(function (g) {
    if (g.querySelector(':scope > g.mkr')) return;
    var r = g.querySelector('rect'); if (!r) return;
    var cx = +r.getAttribute('x') + +r.getAttribute('width') / 2, cy = +r.getAttribute('y') + +r.getAttribute('height') / 2;
    function grp(cls, k) {
      var w = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      w.setAttribute('class', cls);
      w.setAttribute('transform', 'translate(' + cx + ' ' + cy + ') scale(' + k + ') translate(' + (-cx) + ' ' + (-cy) + ')');
      return w;
    }
    var w = grp('mkr', MK_SCALE), lb = grp('mkl', LB_SCALE);
    Array.prototype.slice.call(g.childNodes).forEach(function (n) {
      (n.classList && (n.classList.contains('tname') || n.classList.contains('short')) ? lb : w).appendChild(n);
    });
    g.appendChild(w); g.appendChild(lb);
  });
}
window.__scaleMarkers = scaleMarkers;
function lnote(t, ok) { var m = document.getElementById('laymsg'); if (!m) return; m.textContent = t || ''; m.hidden = !t; m.classList.toggle('ok', !!ok); }
function xesc(v) { return String(v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function f1(v) { return (Math.round(v * 10) / 10).toFixed(1); }
function sideOf(E, b, outside) {
  var cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
  var dN = cy - E[1], dS = E[3] - cy, dW = cx - E[0], dE = E[2] - cx, m = Math.min(dN, dS, dW, dE);
  return m > 400 && !outside ? 'I' : m === dN ? 'N' : m === dS ? 'S' : m === dW ? 'W' : 'E';
}
// Chairs (set by the user 23 Nov 2026): one per desk, at the middle of a long edge, 22 units out. A desk touching
// another back to back (long side, gap under 6 units: benches are often drawn with a panel between the rows) has its
// chair on the other long side; touching on both long sides = no chair; a desk of a two-row bench with no desk right
// behind it sits away from the other row; otherwise the long side with more free room (no desk within 140 units counts
// as free), ties below / right. ang (optional, L.ang) = each desk's angle in degrees: desks are read in their own frame.
function chairsFor(desks, ang) {
  ang = ang || [];
  // every desk in the frame of its own angle (desks at the same angle share a frame)
  function fr(d, t) { var co = Math.cos(t), sn = Math.sin(t), cx = (d[0] + d[2]) / 2, cy = (d[1] + d[3]) / 2, x = co * cx + sn * cy, y = -sn * cx + co * cy, w = (d[2] - d[0]) / 2, h = (d[3] - d[1]) / 2; return [x - w, y - h, x + w, y + h]; }
  return desks.map(function (a0, i) {
    var t = (ang[i] || 0) * Math.PI / 180, co = Math.cos(t), sn = Math.sin(t), a = fr(a0, t);
    var hz = a[2] - a[0] >= a[3] - a[1], u0 = hz ? a[0] : a[1], u1 = hz ? a[2] : a[3], e0 = hz ? a[1] : a[0], e1 = hz ? a[3] : a[2];
    var L = u1 - u0, lo = 140, hi = 140, tlo = false, thi = false, F = [];
    desks.forEach(function (b0, j) { if (Math.abs((ang[j] || 0) - (ang[i] || 0)) <= 1) F.push([j, fr(b0, t)]); });
    F.forEach(function (q) {
      var j = q[0], b = q[1]; if (i === j) return;
      var ov = Math.min(u1, hz ? b[2] : b[3]) - Math.max(u0, hz ? b[0] : b[1]); if (ov <= 2) return;
      var dLo = e0 - (hz ? b[3] : b[2]), dHi = (hz ? b[1] : b[0]) - e1;
      if (dLo > -3) { lo = Math.min(lo, Math.max(0, dLo)); if (dLo < 6 && ov > 0.5 * L) tlo = true; }
      if (dHi > -3) { hi = Math.min(hi, Math.max(0, dHi)); if (dHi < 6 && ov > 0.5 * L) thi = true; }
    });
    if (tlo && thi) return null;
    var dir = tlo ? 1 : thi ? -1 : 0;
    if (!dir) {
      // no desk back to back: a desk of a bench with two rows sits away from the other row
      var par = {}, seen = [i], k = 0;
      par[i] = 1;
      while (k < seen.length) {
        var c = F.filter(function (q) { return q[0] === seen[k]; })[0][1]; k++;
        F.forEach(function (q) {
          if (par[q[0]]) return; var b = q[1];
          if (b[0] < c[2] + 6 && c[0] < b[2] + 6 && b[1] < c[3] + 6 && c[1] < b[3] + 6) { par[q[0]] = 1; seen.push(q[0]); }
        });
      }
      var up = 0, dn = 0, m0 = (e0 + e1) / 2;
      F.forEach(function (q) { if (!par[q[0]] || q[0] === i) return; var b = q[1], m = hz ? (b[1] + b[3]) / 2 : (b[0] + b[2]) / 2; if (m < m0 - (e1 - e0) / 2) up++; else if (m > m0 + (e1 - e0) / 2) dn++; });
      dir = up && !dn ? 1 : dn && !up ? -1 : lo > hi ? -1 : 1;
    }
    var m = (u0 + u1) / 2, v = dir > 0 ? e1 + 22 : e0 - 22;
    var px = hz ? m : v, py = hz ? v : m;
    return [co * px - sn * py, sn * px + co * py];
  });
}
function renderLayout(L) {
  LAYOUT = L;
  var E = L.extent, X0 = E[0], Y0 = E[1], X1 = E[2], Y1 = E[3], M = L.margin || 250;
  var plan = document.getElementById('plan');
  plan.setAttribute('data-ext', X0 + ' ' + Y0 + ' ' + X1 + ' ' + Y1);
  var VX = X0 - M, VY = Y0 - M, VW = X1 - X0 + 2 * M, VH = Y1 - Y0 + 2 * M;
  plan.setAttribute('viewBox', VX + ' ' + VY + ' ' + VW + ' ' + VH);
  var IB = L.imgBox || E;
  var bg = '<rect x="' + VX + '" y="' + VY + '" width="' + VW + '" height="' + VH + '" fill="var(--plan)"/>';
  if (L.img) bg += '<g class="bgimg' + (L.asIs ? ' asis' : '') + '"><image id="bgimage" href="' + xesc(L.img) + '" x="' + IB[0] + '" y="' + IB[1] + '" width="' + (IB[2] - IB[0]) + '" height="' + (IB[3] - IB[1]) + '"/></g>';
  else bg += '<g class="emptyplan"><rect x="' + X0 + '" y="' + Y0 + '" width="' + (X1 - X0) + '" height="' + (Y1 - Y0) + '" rx="24"/><text x="' + (X0 + X1) / 2 + '" y="' + ((Y0 + Y1) / 2 - 40) + '">No layout yet</text><text class="sub" x="' + (X0 + X1) / 2 + '" y="' + ((Y0 + Y1) / 2 + 50) + '">Press Upload layout to add the floor plan</text></g>';
  document.getElementById('bgwrap').innerHTML = bg;
  var D = L.desks || [], teams = {}, order = [], dk = [];
  // chairs: stored with the layout (L.chairs, one [cx, cy] or null per desk), else worked out from the desks
  var CH = Array.isArray(L.chairs) ? L.chairs : chairsFor(D, L.ang);
  D.forEach(function (d, i) {
    var t = String(d[4]), s = i + 1, x0 = d[0], y0 = d[1], x1 = d[2], y1 = d[3], w = x1 - x0, h = y1 - y0;
    if (!teams[t]) { teams[t] = []; order.push(t); }
    teams[t].push({ s: s, r: d });
    var chr = CH[i], chs = chr && isFinite(chr[0]) && isFinite(chr[1]) ? '<circle class="ch" cx="' + f1(chr[0]) + '" cy="' + f1(chr[1]) + '" r="13"/>' : '';
    // a desk at an angle (L.ang) is drawn turned around its centre
    var an = Array.isArray(L.ang) ? +L.ang[i] || 0 : 0, rot = Math.abs(an) >= 0.5 ? ' transform="rotate(' + an + ' ' + f1((x0 + x1) / 2) + ' ' + f1((y0 + y1) / 2) + ')"' : '';
    dk.push('<g class="dk" data-s="' + s + '" data-t="' + t + '" data-x="' + x0 + '" data-y="' + y0 + '" data-w="' + f1(w) + '" data-h="' + f1(h) + '">' + chs + '<rect x="' + x0 + '" y="' + y0 + '" width="' + f1(w) + '" height="' + f1(h) + '"' + rot + '/><text class="dn" x="' + f1((x0 + x1) / 2) + '" y="' + f1((y0 + y1) / 2) + '">' + s + '</text><text class="pn" x="' + f1((x0 + x1) / 2) + '" y="' + f1((y0 + y1) / 2) + '"></text></g>');
  });
  document.getElementById('desks').innerHTML = dk.join('');
  // team markers: outside the building on the side given (or nearest), spread so markers on one side never overlap
  var mk = order.filter(function (t) { return t !== '0'; }).map(function (t) {
    var ds = teams[t], b = [Infinity, Infinity, -Infinity, -Infinity];
    ds.forEach(function (e) { b[0] = Math.min(b[0], e.r[0]); b[1] = Math.min(b[1], e.r[1]); b[2] = Math.max(b[2], e.r[2]); b[3] = Math.max(b[3], e.r[3]); });
    var side = (L.sides && L.sides[t]) || sideOf(E, b), cx, y;
    if (side === 'N') { cx = (b[0] + b[2]) / 2; y = Y0 - 120; }
    else if (side === 'S') { cx = (b[0] + b[2]) / 2; y = Y1 + 140; }
    else if (side === 'W') { cx = X0 - 200; y = (b[1] + b[3]) / 2; }
    else if (side === 'E') { cx = X1 + 200; y = (b[1] + b[3]) / 2; }
    else { cx = b[0] - 200; y = (b[1] + b[3]) / 2; }
    return { t: t, b: b, side: side, cx: cx, y: y };
  });
  ['N', 'S', 'W', 'E'].forEach(function (sd) {
    var horiz = sd === 'N' || sd === 'S', key = horiz ? 'cx' : 'y', gap = horiz ? 560 : 460;
    var list = mk.filter(function (m) { return m.side === sd; }).sort(function (a, b) { return a[key] - b[key]; });
    for (var i = 1; i < list.length; i++) if (list[i][key] - list[i - 1][key] < gap) list[i][key] = list[i - 1][key] + gap;
  });
  var tm = [];
  mk.forEach(function (m) {
    var b = m.b, cx = m.cx, y = m.y, side = m.side, lead, lab = 'T' + m.t, tw = lab.length * 25 + 44;
    var clx = Math.max(b[0], Math.min(b[2], cx)), cly = Math.max(b[1], Math.min(b[3], y));
    if (side === 'N') lead = [cx, y + 32, clx, b[1]];
    else if (side === 'S') lead = [cx, y - 32, clx, b[3]];
    else if (side === 'W') lead = [cx + 60, y, b[0], cly];
    else if (side === 'E') lead = [cx - 60, y, b[2], cly];
    else lead = [cx + 47, y, b[0], cly];
    tm.push('<line class="lead" data-t="' + m.t + '" x1="' + f1(lead[0]) + '" y1="' + f1(lead[1]) + '" x2="' + f1(lead[2]) + '" y2="' + f1(lead[3]) + '"/>');
    tm.push('<g class="team" data-t="' + m.t + '" role="button" tabindex="0" aria-pressed="false" aria-label="Shade team ' + lab + '"><rect x="' + f1(cx - tw / 2) + '" y="' + f1(y - 32) + '" width="' + f1(tw) + '" height="64" rx="32"/><text x="' + f1(cx) + '" y="' + f1(y) + '">' + lab + '</text><text class="tname" x="' + f1(cx) + '" y="' + f1(side === 'N' ? y - 100 : y + 100) + '"></text><text class="short" x="' + f1(cx) + '" y="' + f1(side === 'N' ? y - 154 : y + 154) + '"></text></g>');
  });
  document.getElementById('teams').innerHTML = tm.join('');
  scaleMarkers();
  drawFlags(L);
  var rows = order.filter(function (t) { return t !== '0'; }).map(function (t) {
    var ds = teams[t];
    return '<tbody class="grp" data-t="' + t + '"><tr class="gh"><td><button type="button" class="fold" aria-expanded="false"><span class="car" aria-hidden="true"></span>T' + t + '</button></td><td class="tn ed" data-k="teams" data-id="' + t + '" title="Double-click to edit"></td><td class="num cnt ed" data-k="need" data-id="' + t + '" data-def="' + ds.length + '" title="Double-click to edit">' + ds.length + '</td><td></td><td class="del"><span class="acts"><button type="button" class="addbtn tip" data-tip="add team member" data-t="' + t + '" aria-label="Add a person to team T' + t + '">+</button><button type="button" class="delbtn" data-t="' + t + '" aria-label="Delete team T' + t + '">Delete</button></span></td></tr>' +
      ds.map(function (e, i) { return '<tr data-s="' + e.s + '" class="m" hidden><td class="num">' + (i + 1) + '</td><td class="nm ed" data-k="names" data-id="' + e.s + '" title="Double-click to edit"></td><td class="num">' + e.s + '</td><td class="num ty" title="Click to choose the type: OS, OSH, S, M, C or R2–R10"></td><td class="del"><button type="button" class="delbtn" data-s="' + e.s + '" aria-label="Delete this person">Delete</button></td></tr>'; }).join('') + '</tbody>';
  }).join('');
  var tbl = document.getElementById('srows');
  tbl.querySelectorAll('tbody').forEach(function (b) { b.remove(); });
  tbl.insertAdjacentHTML('beforeend', rows);
  document.getElementById('tottot').textContent = D.length;
  document.getElementById('totused').textContent = D.length;
  document.getElementById('totfree').textContent = 0;
  document.getElementById('pd').textContent = (L.desc || 'Floor plan') + ' with all ' + D.length + ' workstation desks coloured by team, numbered 1 to ' + D.length + ', and grouped into ' + order.filter(function (t) { return t !== '0'; }).length + ' teams.';
  if (L.heading) { var lt = document.getElementById('ltitle'); lt.dataset.def = L.heading; lt.textContent = L.heading; }
  // an uploaded plan picture: swap in an inline copy so "Export → Layout as picture" includes it
  if (L.img && !/^data:/.test(L.img) && window.fetch) fetch(L.img).then(function (r) { return r.ok ? r.blob() : null; }).then(function (b) {
    if (!b) return; var fr = new FileReader(); fr.onload = function () { var im = document.getElementById('bgimage'); if (im) im.setAttribute('href', fr.result); }; fr.readAsDataURL(b);
  }).catch(function () {});
}
