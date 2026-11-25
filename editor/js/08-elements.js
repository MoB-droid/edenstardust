// ---- C3 element inventory (set by the user 25 Nov 2026): every C2 element in C3 order: on the layout or not, where,
// how many. Worked out by the brain (server) from the drawing; this page keeps and shows the answer (L.elements).
// EL_V = the version of the inventory rules (the same number as on the server: raise both together).
var EL_V = 1;
var EL_SECTIONS = ['', 'Entrances, shell and core', 'Interior walls and doors', 'Public spaces', 'Corridors', 'Room types', 'Open-space desks'];
// the inventory of a PDF page for layout L (f = layout units per page point); saved as plan / current fields elements, elv
function elOfPage(lib, page, L, f) {
  return pageRaw(lib, page, { el: 1, ink: 1 }).then(function (raw) { return brain('elements', raw, { L: { desks: L.desks, ang: L.ang, chairs: L.chairs, osh: L.osh }, f: f || 1 }); });
}
// layouts read before the inventory existed (or with an older one): read it from the stored PDF, once; desks, seat
// numbers and OSH are not touched
function backfillElements(db) {
  if (!LAYOUT || !LAYOUT.asIs || (LAYOUT.elv || 0) >= EL_V || !LAYOUT.desks || !LAYOUT.desks.length || !db) return;
  return db.collection('layouts').get().then(function (snap) {
    var recs = snap.docs.map(function (d) { return d.data(); }).filter(function (r) { return r && r.asset && /[.]pdf$/i.test(r.name || ''); })
      .sort(function (a, b) { return String(b.at || '').localeCompare(String(a.at || '')); });
    if (!recs.length) return;
    var url = '/_blob/' + recs[0].asset; if (window.__blobUrl) url = window.__blobUrl(url);
    var lib;
    return loadPdf().then(function (l) { lib = l; return fetch(url); }).then(function (r) { if (!r.ok) throw { code: 'fetch' }; return r.arrayBuffer(); })
      .then(function (buf) { return lib.getDocument({ data: new Uint8Array(buf) }).promise; })
      .then(function (pdf) { return pdf.getPage(1); })
      .then(function (pg) { return elOfPage(lib, pg, LAYOUT, LAYOUT.pscale || 1); })
      .then(function (E) {
        LAYOUT.elements = E; LAYOUT.elv = EL_V;
        if (window.__elReady) window.__elReady();
        return db.doc('plan/current').update({ elements: E, elv: EL_V });
      });
  }).catch(function () {});
}
