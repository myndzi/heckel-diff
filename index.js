'use strict';

var util = require('util'),
    SuffixTree = require('./suffixtree');

// pass one -- find truly unique sequences
function findUnique(st, left, right) {
  var walker = st.createWalker();

  var i = 0, x = right.length;

  while (i < x) {
    // if no match, reset search to root
    if (!walker.advance(right[i].value)) {
      // if walker.pos is at 0, this was the first token of the search
      // if it's greater, we don't increment the counter because we want to
      // try the search again at the root with the same token
      if (walker.pos === 0) { i++; }
      walker.reset();
      continue;
    }

    // if we have a match, record pairs when we're on a leaf
    var leftIdx = walker.pos, rightIdx = i;
    if (walker.isLeaf()) {
      //console.log(left[leftIdx], walker);
      left[leftIdx].ref = rightIdx;
      right[rightIdx].ref = leftIdx;
    }

    i++;
  }
}

function expandUnique(left, right, dir) {
  var lx = left.length, rx = right.length;

  //console.log('expanding in direction', dir);
  left.forEach(function (token, idx) {
    var i, j, lx = left.length, rx = right.length;

    // the start and end of a sequence can be considered unique
    // so we can expand from there
    if (dir === 1 && idx === 0) {
      i = 0;
      j = 0;
    } else if (dir === -1 && idx === lx - 1) {
      i = lx - 1;
      j = rx - 1;
    } else if (token.ref === -1) {
      return;
    }

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
      //console.log("expanding pairs: %s<->%s", i, j);
      left[i].ref = j;
      right[j].ref = i;

      i += dir;
      j += dir;

      // we may be overwriting previous stuff we don't need to overwrite here
      // it seems though that .ref is getting set possibly incorrectly earlier
      // so this doesn't currently work
      /*
      if (left[i].ref || right[j].ref) {
        console.log(i, left[i], j, right[j]);
        break;
      }
      */
    }
  });
}

function push(acc, token, type) {
  acc.push({ type: type, value: token.value });
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
    push(acc, left[lPos], 'same');

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

function wrap(v) {
  return {
    value: v,
    ref: -1
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

  var st = new SuffixTree();
  st.add(left);

  left = left.map(wrap);
  right = right.map(wrap);

  findUnique(st, left, right);

  expandUnique(left, right, 1);
  expandUnique(left, right, -1);

  left.push({ ref: right.length, eof: true }); // include trailing deletions

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
    }

    if (cur.type === 'del' && ptr < 0) {
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
