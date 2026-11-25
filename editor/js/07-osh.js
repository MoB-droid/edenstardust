// ---- OSH = open space hidden (rules C2 23-25). Which seats are OSH is decided by the brain (server) from the drawing;
// this page keeps the answer (L.osh), the question flags and the re-check of layouts read with older rules.
// OSH_V = the version of the OSH rules (the same number as on the server: raise both together); stored layouts with a
// lower oshv are read again once. ASK_TRANSPARENT: the "Transparent? y / n" question (C2 rule 24), paused by the user.
var OSH_V = 3, OSH_REV = 0, ASK_TRANSPARENT = false;
// OSH seats of a layout from its PDF page: { osh: [seat numbers], ask: [{ seats, at }] } (f = layout units per page point)
function oshFromPage(lib, page, f, desks, ang, chairs) {
  return pageRaw(lib, page, { ink: 1 }).then(function (raw) { return brain('osh', raw, { f: f || 1, desks: desks, ang: ang || [], chairs: chairs }); });
}
// the questions as red flags on the plan; answers already given to the same seats are kept
function oshFlags(old, ask) {
  var keep = (Array.isArray(old) ? old : []).filter(function (f) { return f && f.q !== 'transparent'; });
  if (!ASK_TRANSPARENT) return keep;   // the question is paused: note flags only
  var prev = (Array.isArray(old) ? old : []).filter(function (f) { return f && f.q === 'transparent' && f.ans; });
  return keep.concat(ask.map(function (a) {
    var key = a.seats.join(','), was = prev.filter(function (f) { return (f.seats || []).join(',') === key; })[0];
    return { q: 'transparent', seats: a.seats, at: a.at, n: seatRange(a.seats), text: 'Transparent?', ans: was ? was.ans : null };
  }));
}
function seatRange(s) {
  var out = [], i = 0;
  while (i < s.length) { var j = i; while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++; out.push(j > i + 1 ? s[i] + '–' + s[j] : j === i + 1 ? s[i] + ', ' + s[j] : String(s[i])); i = j + 1; }
  return out.join(', ');
}
// layouts read with an older OSH rule (or before OSH existed): read their OSH desks again from the stored PDF, once
function backfillOsh(db) {
  if (!LAYOUT || !LAYOUT.asIs || (LAYOUT.oshv || 0) >= OSH_V || !LAYOUT.desks || !LAYOUT.desks.length || !db) return;
  return db.collection('layouts').get().then(function (snap) {
    var recs = snap.docs.map(function (d) { return d.data(); }).filter(function (r) { return r && r.asset && /[.]pdf$/i.test(r.name || ''); })
      .sort(function (a, b) { return String(b.at || '').localeCompare(String(a.at || '')); });
    if (!recs.length) return;
    var url = '/_blob/' + recs[0].asset; if (window.__blobUrl) url = window.__blobUrl(url);
    var lib;
    return loadPdf().then(function (l) { lib = l; return fetch(url); }).then(function (r) { if (!r.ok) throw { code: 'fetch' }; return r.arrayBuffer(); })
      .then(function (buf) { return lib.getDocument({ data: new Uint8Array(buf) }).promise; })
      .then(function (pdf) { return pdf.getPage(1); })
      .then(function (pg) { return oshFromPage(lib, pg, LAYOUT.pscale || 1, LAYOUT.desks, LAYOUT.ang, LAYOUT.chairs); })
      .then(function (res) {
        LAYOUT.osh = res.osh; LAYOUT.oshv = OSH_V; LAYOUT.flags = oshFlags(LAYOUT.flags, res.ask); OSH_REV++;
        drawFlags(LAYOUT);
        if (window.__oshReady) window.__oshReady();
        return db.doc('plan/current').update({ osh: res.osh, oshv: OSH_V, flags: LAYOUT.flags });
      });
  }).catch(function () {});
}
