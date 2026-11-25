// Test harness for the editor's plan-reading code (no browser, no extra packages).
// It loads the top-level parts of the editor (editor/js/01 … 09: everything before MAIN) into a sandbox, and gives
// the tests a tiny drawing kit: a test draws a few lines the way a CAD plan has them, then asks the editor's own
// functions what they read. Sizes are in cm on a 1:50 plan, as in the rules.
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm');
var DIR = path.join(__dirname, '..', 'editor', 'js');
var K = 72 / 2.54 / 50;   // page points per cm at 1:50

function loadEditor() {
  var src = fs.readdirSync(DIR).filter(function (f) { return /^0\d-.*\.js$/.test(f); }).sort()
    .map(function (f) { return fs.readFileSync(path.join(DIR, f), 'utf8'); }).join('');
  var el = function () { return { style: { setProperty: function () {}, removeProperty: function () {} }, classList: { add: function () {}, remove: function () {}, toggle: function () {} }, appendChild: function () {}, setAttribute: function () {} }; };
  var doc = { getElementById: function () { return null; }, querySelector: function () { return null; }, querySelectorAll: function () { return []; }, createElement: el, addEventListener: function () {}, head: el(), body: el(), documentElement: el() };
  var win = { addEventListener: function () {}, location: { search: '', href: '' } };
  var box = { window: win, document: doc, localStorage: { getItem: function () { return null; }, setItem: function () {} }, navigator: { userAgent: 'test' }, console: console, setTimeout: setTimeout, clearTimeout: clearTimeout, Promise: Promise };
  vm.createContext(box);
  vm.runInContext(src, box, { filename: 'editor-01-09.js' });
  return box;
}

// A drawing: lines in cm (x right, y down). The sheet is 4500 × 4500 cm (a line over 85% of the sheet is read as the drawing frame, so the shell stays smaller); shell() draws the building's outer edge.
function Drawing() { this.segs = []; this.W = 4500 * K; this.H = 4500 * K; }
Drawing.prototype.line = function (x0, y0, x1, y1, o) {
  o = o || {};
  this.segs.push([x0 * K, y0 * K, x1 * K, y1 * K, 0, o.width || 1, o.colour ? 1 : 0, 0]);
  return this;
};
Drawing.prototype.rect = function (x, y, w, h, o) {
  return this.line(x, y, x + w, y, o).line(x + w, y, x + w, y + h, o).line(x + w, y + h, x, y + h, o).line(x, y + h, x, y, o);
};
// a hatched block (gypsum / cement wall, column): its outline and 45° strokes every 10 cm, each ending on the outline
Drawing.prototype.hatched = function (x, y, w, h) {
  this.rect(x, y, w, h);
  for (var c = 10; c < w + h; c += 10) {
    var ax = Math.min(c, w), ay = c - ax, by = Math.min(c, h), bx = c - by;
    this.line(x + ax, y + ay, x + bx, y + by);
  }
  return this;
};
Drawing.prototype.wall = Drawing.prototype.hatched;
Drawing.prototype.column = function (x, y, size) { return this.hatched(x, y, size || 60, size || 60); };
// a thin wall with no hatching (glass, or unclear): two plain lines 8 cm apart
Drawing.prototype.thinWall = function (x0, y0, x1, y1) {
  var h = y0 === y1; return this.line(x0, y0, x1, y1).line(x0 + (h ? 0 : 8), y0 + (h ? 8 : 0), x1 + (h ? 0 : 8), y1 + (h ? 8 : 0));
};
// the building's outer edge (the facade): the sheet beyond it is the outside
Drawing.prototype.shell = function (x, y, w, h) { return this.rect(x, y, w, h); };
// a desk; chair = the side its chair is on: 'up' | 'down' | 'left' | 'right'
Drawing.prototype.desk = function (x, y, w, h, chair) {
  this.rect(x, y, w, h); (this.desks = this.desks || []).push({ box: [x, y, x + w, y + h], chair: chair }); return this;
};
// the page's lines the way the editor reads them from a PDF: { H, V, A } (see pdfSegments)
Drawing.prototype.segments = function () {
  var H = [], V = [], A = [];
  this.segs.forEach(function (q) {
    if (q[6]) return;
    var dx = Math.abs(q[2] - q[0]), dy = Math.abs(q[3] - q[1]), len = Math.sqrt(dx * dx + dy * dy);
    if (len > 20 && len < 110) A.push([q[0], q[1], q[2], q[3]]);
    if (dy < 0.3 && dx > 20 && dx < 110) H.push([Math.min(q[0], q[2]), (q[1] + q[3]) / 2, Math.max(q[0], q[2])]);
    else if (dx < 0.3 && dy > 20 && dy < 110) V.push([Math.min(q[1], q[3]), (q[0] + q[2]) / 2, Math.max(q[1], q[3])]);
  });
  return { H: H, V: V, A: A };
};

// What the editor reads from a drawing: how many desks it finds, and which of the drawn desks are OSH (1 = first drawn).
function read(ed, dr) {
  var found = ed.findDesks(dr.segments()), drawn = dr.desks || [];
  var boxes = drawn.map(function (d) { return d.box.map(function (v) { return v * K; }); });
  var chairs = drawn.map(function (d, i) {
    var b = boxes[i], cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, r = 30 * K;
    return d.chair === 'up' ? [cx, b[1] - r] : d.chair === 'down' ? [cx, b[3] + r] : d.chair === 'left' ? [b[0] - r, cy] : d.chair === 'right' ? [b[2] + r, cy] : null;
  });
  var out = { desks: found.length, osh: [] };
  if (drawn.length && chairs.every(Boolean)) out.osh = Array.from(ed.oshDecide(boxes, [], ed.oshGrid(dr.segs, 1, dr.W, dr.H), chairs).osh);
  return out;
}

module.exports = { loadEditor: loadEditor, Drawing: Drawing, read: read, K: K };
