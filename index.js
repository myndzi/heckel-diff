'use strict';

var util = require('util');

function flattenRepeats(acc, cur) {
  if (acc.length && acc[acc.length-1].value === cur) {
    acc[acc.length-1].count++;
    return acc;
  }
  return acc.concat({
    value: cur,
    ref: -1,
    count: 1
  });
}

function addToTable(table, arr, type) {
  arr.forEach(function (token, idx) {
    var ref = table;

    ref = ref[token.value] || (
      ref[token.value] = { }
    );

    ref = ref[token.count] || (
      ref[token.count] = {
        left: -1,
        right: -1
      }
    );

    if (ref[type] === -1) {
      ref[type] = idx;
    } else if (ref[type] >= 0) {
      ref[type] = -2;
    }
  });
}

function findUnique(table, left, right) {
  left.forEach(function (token) {
    var ref = table[token.value][token.count];
    if (ref.left >= 0 && ref.right >= 0) {
      left[ref.left].ref = ref.right;
      right[ref.right].ref = ref.left;
    }
  });
}

function expandUnique(table, left, right, dir) {
  left.forEach(function (token, idx) {
    if (token.ref === -1) { return; }
    var i = idx + dir, j = token.ref + dir,
        lx = left.length, rx = right.length;

    while (i >= 0 && j >= 0 && i < lx && j < rx) {
      // not checking counts here has a few subtle effects
      // this means that lines "next to" not-quite-exact (but repeated) lines
      // will be taken to be part of the span:
      // in [a f f c a, a f c a], the first 'a' will be marked as a pair
      // with the second one, because the 'f f' will be marked as a pair with 'f'
      // this is cleaned up when outputting the diff data: ['f f', 'f']
      // will become 'f -f' on output
      if (left[i].value !== right[j].value) {
        break;
      }
      left[i].ref = j;
      right[j].ref = i;

      i += dir;
      j += dir;
    }
  });
}

function push(acc, token, type) {
  var n = token.count;
  while (n--) {
    acc.push({ type: type, value: token.value });
  }
}

function calcDist(lTarget, lPos, rTarget, rPos) {
  return (lTarget - lPos) + (rTarget - rPos) + Math.abs((lTarget - lPos) - (rTarget - rPos));
}
function processDiff(left, right) {
  var acc = [ ], lPos = 0, rPos = 0,
      lx = left.length, rx = right.length,
      lToken, rToken, lTarget, rTarget,
      rSeek, dist1, dist2;

  var countDiff;

  while (lPos < lx) {
    lTarget = lPos;

    // find the first sync-point on the left
    while (left[lTarget].ref < 0) {
      lTarget++;
    }

    rTarget = left[lTarget].ref;

    // left side referenced something we've already emitted, emit up to here
    if (rTarget < rPos) {
      // left-side un-referenced items are still deletions
      while (lPos < lTarget) {
        push(acc, left[lPos++], 'del');
      }

      // ... but since we've already emitted this change, this reference is void
      // and this token should be emitted as a deletion, not "same"
      push(acc, left[lPos++], 'del');
      continue;
    }

    rToken = right[rTarget];

    dist1 = calcDist(lTarget, lPos, rTarget, rPos);

    for (rSeek = rTarget - 1; dist1 > 0 && rSeek >= rPos; rSeek--) {
      // if this isn't a paired token, keep seeking
      if (right[rSeek].ref < 0) { continue; }

      // if we've already emitted the referenced left-side token, keep seeking
      if (right[rSeek].ref < lPos) { continue; }

      // is this pair "closer" than the current pair?
      dist2 = calcDist(right[rSeek].ref, lPos, rSeek, rPos);
      if (dist2 < dist1) {
        dist1 = dist2;
        rTarget = rSeek;
        lTarget = right[rSeek].ref;
      }
    }

    // emit deletions
    while (lPos < lTarget) {
      push(acc, left[lPos++], 'del');
    }

    // emit insertions
    while (rPos < rTarget) {
      push(acc, right[rPos++], 'ins');
    }

    // we're done when we hit the pseudo-token on the left
    if ('eof' in left[lPos]) { break; }

    // emit synced pair
    // since we allow repeats of different lengths to be matched
    // via the pass 4 & 5 expansion, we need to ensure we emit
    // the correct sequence when the counts don't align
    countDiff = left[lPos].count - right[rPos].count;
    if (countDiff === 0) {
      push(acc, left[lPos], 'same');
    } else if (countDiff < 0) {
      // more on the right than the left: some same, some insertion
      push(acc, {
        count: right[rPos].count + countDiff,
        value: right[rPos].value
      }, 'same');
      push(acc, {
        count: -countDiff,
        value: right[rPos].value
      }, 'ins');
    } else if (countDiff > 0) {
      // more on the left than the right: some same, some deletion
      push(acc, {
        count: left[lPos].count - countDiff,
        value: left[lPos].value
      }, 'same');
      push(acc, {
        count: countDiff,
        value: left[lPos].value
      }, 'del');
    }

    lPos++;
    rPos++;
  }

  return acc;
}

function same(left, right) {
  if (left.length !== right.length) { return false; }
  return left.reduce(function (acc, cur, idx) {
    return acc && cur === right[idx];
  }, true);
};

function all(type) {
  return function (val) {
    return {
      type: type,
      value: val
    };
  };
}

function diff(_left, _right, __testcb) {
  var left = (_left && Array.isArray(_left) ? _left : [ ]),
      right = (_right && Array.isArray(_right) ? _right : [ ]);

  // if they're the same, no need to do all that work...
  if (same(_left, _right)) {
    if (typeof __testcb === 'function') { __testcb('all same'); }
    return left.map(all('same'));
  }

  if (left.length === 0) {
    if (typeof __testcb === 'function') { __testcb('all right'); }
    return right.map(all('ins'));
  }

  if (right.length === 0) {
    if (typeof __testcb === 'function') { __testcb('all left'); }
    return left.map(all('del'));
  }

  left = left.reduce(flattenRepeats, [ ]);
  right = right.reduce(flattenRepeats, [ ]);

  var table = { };

  addToTable(table, left, 'left');
  addToTable(table, right, 'right');

  findUnique(table, left, right);

  expandUnique(table, left, right, 1);
  expandUnique(table, left, right, -1);

  left.push({ ref: right.length, eof: true }); // include trailing deletions

  table = null;

  var res = processDiff(left, right);

  left = null;
  right = null;

  return res;
}

function accumulateChanges(changes, fn) {
  var del = [ ], ins = [ ];

  changes.forEach(function (change) {
    if (change.type === 'del') { del.push(change.value); }
    if (change.type === 'ins') { ins.push(change.value); }
  });

  if (!del.length || !ins.length) { return changes; }

  return fn(del.join(''), ins.join(''));
}

function refineChanged(changes, fn) {
  var ptr = -1;

  return changes.concat({
    type: 'same',
    eof: true
  }).reduce(function (acc, cur, idx, a) {
    var part = [ ];

    if (cur.type === 'same') {
      if (ptr >= 0) {
        part = accumulateChanges(a.slice(ptr, idx), fn);
        if (a[idx - 1].type !== 'ins') {
          part = a.slice(ptr, idx);
        } else {

        }
        ptr = -1;
      }
      return acc.concat(part).concat(cur.eof ? [ ] : [ cur ]);
    } else if (ptr < 0) {
      ptr = idx;
    }

    return acc;
  }, [ ]);
}

function splitInclusive(str, sep, trim) {
  if (!str.length) { return [ ]; }

  var split = str.split(sep);
  if (trim) {
    split = split.filter(function (v) {
      return v.length;
    });
  }
  return split.map(function (line, idx, arr) {
    return idx < arr.length - 1 ? line + sep : line;
  });
}

function minimize(changes) {
  var del = [ ], ins = [ ];
  return changes.concat({ type: 'same', eof: true })
  .reduce(function (acc, cur) {
    if (cur.type === 'del') {
      del.push(cur.value);
      return acc;
    }

    if (cur.type === 'ins') {
      ins.push(cur.value);
      return acc;
    }

    if (del.length) {
      acc.push({
        type: 'del',
        value: del.join('')
      });
      del = [ ];
    }

    if (ins.length) {
      acc.push({
        type: 'ins',
        value: ins.join('')
      });
      ins = [ ];
    }

    if (cur.eof !== true) {
      if (acc.length && acc[acc.length - 1].type === 'same') {
        acc[acc.length - 1].value += cur.value;
      } else {
        acc.push(cur);
      }
    }

    return acc;
  }, [ ]);
}

function diffLines(left, right, trim) {
  return diff(
    splitInclusive(left, '\n', trim),
    splitInclusive(right, '\n', trim)
  );
}

function diffWords(left, right, trim) {
  return diff(
    splitInclusive(left, ' ', trim),
    splitInclusive(right, ' ', trim)
  );
}

function diffHybrid(left, right, trim) {
  return refineChanged(
    diffLines(left, right, trim),
    function (del, ins) {
      return diffWords(del, ins, trim);
    }
  );
}

module.exports = {
  diff: diff,
  minimize: minimize,
  diffLines: diffLines,
  diffWords: diffWords,
  diffHybrid: diffHybrid,
  refineChanged: refineChanged
};
