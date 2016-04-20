'use strict';

var hDiff = require('./index');


function genRandom(len, max) {
  return (new Array(
    Math.floor(Math.random() * 26)
  )).fill(0)
    .map(v => String.fromCharCode(
      Math.floor(Math.random() * len) + 97
    ));
}

function verify(d, l, r, out) {
  var lr = d.filter(v =>
    v.type === 'same' || v.type === 'del'
  ).reduce((acc, cur) =>
    acc + cur.value
  , '');

  var rr = d.filter(v =>
    v.type === 'same' || v.type === 'ins'
  ).reduce((acc, cur) =>
    acc + cur.value
  , '');

  if (out) {
    console.log(l.join(''), r.join(''));
    console.log(lr, rr);
  }
  return l.join('') === lr && r.join('') === rr;
}

var left, right, diff;
for (var i = 0; i < 26; i++) {
  process.stdout.write('.');
  for (var j = 0; j < 10000; j++) {
    left = genRandom(i, 26);
    right = genRandom(i, 26);
    diff = hDiff.diff(left, right);
    if (!verify(diff, left, right)) {
      verify(diff, left, right, true);
      console.log(diff);
      process.exit();
    }
  }
}

console.log();

for (var i = 0; i < 26; i++) {
  process.stdout.write('.');
  for (var j = 0; j < 10000; j++) {
    left = genRandom(i, 1000);
    right = genRandom(i, 1000);
    diff = hDiff.diff(left, right);
    if (!verify(diff, left, right)) {
      verify(diff, left, right, true);
      console.log(diff);
      process.exit();
    }
  }
}

console.log();
