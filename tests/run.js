#!/usr/bin/env node
// Runs every tiny rule test: node tests/run.js   (exit code 1 when a test fails)
'use strict';
var h = require('./harness.js'), tests = require('./rules.test.js'), ed = h.loadEditor(), bad = 0, t0 = Date.now();
tests.forEach(function (t, i) {
  var got, why = [];
  try { got = h.read(ed, t.draw()); } catch (e) { why.push('error: ' + e.message); }
  if (got && t.desks !== undefined && got.desks !== t.desks) why.push('desks: expected ' + t.desks + ', read ' + got.desks);
  if (got && t.osh !== undefined && JSON.stringify(got.osh) !== JSON.stringify(t.osh)) why.push('OSH: expected [' + t.osh + '], read [' + got.osh + ']');
  if (why.length) bad++;
  console.log((why.length ? 'FAIL ' : 'ok   ') + (i + 1) + '. ' + t.rule + ': ' + t.says + (why.length ? '\n       ' + why.join('; ') : ''));
});
console.log('\n' + (tests.length - bad) + ' of ' + tests.length + ' passed in ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
process.exit(bad ? 1 : 0);
