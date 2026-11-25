// One tiny drawn test per rule. Each test draws only what the rule talks about and says what the editor must read.
// Rule numbers are the ones in the "Sitting arrangement" rules (section C2 = elements, C5 = finding desks).
// How to add one (a correction from the user = a new example): copy a test, change the drawing, state the answer.
// Sizes are cm on a 1:50 plan. Seats are numbered in the order the desks are drawn (1 = first).
'use strict';
var h = require('./harness.js'), D = function () { return new h.Drawing().shell(300, 300, 2600, 2000); };

// a bench row of n desks (160 × 70) starting at x, y; chairs on the given side
function row(d, x, y, n, chair) { for (var i = 0; i < n; i++) d.desk(x + i * 160, y, 160, 70, chair); return d; }
// the pocket used by the OSH tests: a row of 4 desks at (1000, 1000), chairs up, with hatched walls at both bench ends
function ends(d) { return d.wall(885, 800, 15, 400).wall(1740, 800, 15, 400); }

module.exports = [
  // ---- Finding desks (C5; desk sizes 160×70, 140×70, 160×80)
  { rule: 'C5 desk 160×70', says: 'a 160 × 70 rectangle is a desk',
    draw: function () { return D().rect(1000, 1000, 160, 70); }, desks: 1 },
  { rule: 'C5 desk 140×70', says: 'a 140 × 70 rectangle is a desk',
    draw: function () { return D().rect(1000, 1000, 140, 70); }, desks: 1 },
  { rule: 'C5 desk 160×80', says: 'a 160 × 80 rectangle is a desk',
    draw: function () { return D().rect(1000, 1000, 160, 80); }, desks: 1 },
  { rule: 'C5 upright desk', says: 'a desk drawn upright (70 × 160) is a desk',
    draw: function () { return D().rect(1000, 1000, 70, 160); }, desks: 1 },
  { rule: 'C5 not a desk: table', says: 'a 100 × 100 table is not a desk',
    draw: function () { return D().rect(1000, 1000, 100, 100); }, desks: 0 },
  { rule: 'C2 19 bench', says: '2 rows × 4 desks back to back = a bench of 8',
    draw: function () { return row(row(D(), 1000, 1000, 4, 'up'), 1000, 1070, 4, 'down'); }, desks: 8 },
  { rule: 'C2 annotations', says: 'a red rectangle of desk size is an annotation, not a desk',
    draw: function () { return D().rect(1000, 1000, 160, 70, { colour: true }); }, desks: 0 },

  // ---- OSH (C2 23): all three conditions must hold
  { rule: 'C2 23 OSH', says: 'gypsum wall behind the chairs, bench ends at walls (dead-end pocket) = OSH',
    draw: function () { return ends(row(D(), 1000, 1000, 4, 'up')).wall(885, 865, 870, 15); }, osh: [1, 2, 3, 4] },
  { rule: 'C2 23 (1) nothing behind', says: 'no wall behind the chairs = OS',
    draw: function () { return ends(row(D(), 1000, 1000, 4, 'up')); }, osh: [] },
  { rule: 'C2 23 (1) facade', says: 'the facade behind the chairs counts as a wall (nobody passes outside) = OSH',
    draw: function () { return row(new h.Drawing().shell(300, 880, 2600, 1400), 1000, 1000, 4, 'up').wall(885, 880, 15, 400).wall(1740, 880, 15, 400); }, osh: [1, 2, 3, 4] },
  { rule: 'C2 23 (1) / C2 5 free column', says: 'a free-standing column behind the chair does not hide the seat = OS',
    draw: function () { var d = ends(row(D(), 1000, 1000, 4, 'up')); [1050, 1210, 1370, 1530].forEach(function (x) { d.column(x, 850, 60); }); return d; }, osh: [] },
  { rule: 'C2 23 (2) seats behind', says: 'another bench behind the chairs = OS (seats 1-4); the bench at the wall is OSH (5-8)',
    draw: function () { return ends(row(row(D(), 1000, 1000, 4, 'up'), 1000, 830, 4, 'up')).wall(885, 700, 870, 15); }, osh: [5, 6, 7, 8] },
  { rule: 'C2 23 (3) / 21b open end', says: 'bench ends open to an aisle: the end seats are OS, the inner seats stay OSH (as 89 / 95 and 91 / 93 in rule 21b)',
    draw: function () { return row(D(), 1000, 1000, 4, 'up').wall(700, 865, 1240, 15); }, osh: [2, 3] },
  { rule: 'C2 19 back-to-back', says: 'on a bench of 2 rows only the row with the wall behind it is OSH',
    draw: function () { return ends(row(row(D(), 1000, 1000, 4, 'up'), 1000, 1070, 4, 'down')).wall(885, 865, 870, 15); }, osh: [1, 2, 3, 4] },
  { rule: 'C2 24 thin wall (paused)', says: 'a thin wall with no hatching behind the chairs = OS, no question',
    draw: function () { return ends(row(D(), 1000, 1000, 4, 'up')).thinWall(900, 870, 1740, 870); }, osh: [] },
  { rule: 'C2 annotations behind', says: 'a red line behind the chairs is an annotation, not a wall = OS',
    draw: function () { return ends(row(D(), 1000, 1000, 4, 'up')).line(900, 870, 1740, 870, { colour: true }); }, osh: [] },
];
