'use strict';

var diff = require('./index').diff,
    diffWords = require('./index').diffWords,
    diffLines = require('./index').diffLines,
    diffHybrid = require('./index').diffHybrid,
    minimize = require('./index').minimize;

var expect = require('expect.js');

describe('diff', function () {
  it('should return no change', function () {
    expect(diff(
      ['a', 'b', 'c'],
      ['a', 'b', 'c']
    )).to.eql([
      { type: 'same', value: 'a' },
      { type: 'same', value: 'b' },
      { type: 'same', value: 'c' }
    ]);
  });

  it('should return all insertions', function () {
    expect(diff(
      [ ],
      ['a', 'b', 'c']
    )).to.eql([
      { type: 'ins', value: 'a' },
      { type: 'ins', value: 'b' },
      { type: 'ins', value: 'c' }
    ]);
  });

  it('should return all deletions', function () {
    expect(diff(
      ['a', 'b', 'c'],
      [ ]
    )).to.eql([
      { type: 'del', value: 'a' },
      { type: 'del', value: 'b' },
      { type: 'del', value: 'c' }
    ]);
  });

  it('should return deletions at the beginning', function () {
    expect(diff(
      ['a', 'b', 'c'],
      ['b', 'c']
    )).to.eql([
      { type: 'del', value: 'a' },
      { type: 'same', value: 'b' },
      { type: 'same', value: 'c' }
    ]);
  });

  it('should return deletions at the end', function () {
    expect(diff(
      ['a', 'b', 'c'],
      ['a', 'b']
    )).to.eql([
      { type: 'same', value: 'a' },
      { type: 'same', value: 'b' },
      { type: 'del', value: 'c' }
    ]);
  });

  it('should return insertions at the beginning', function () {
    expect(diff(
      ['a', 'b', 'c'],
      ['z', 'a', 'b', 'c']
    )).to.eql([
      { type: 'ins', value: 'z' },
      { type: 'same', value: 'a' },
      { type: 'same', value: 'b' },
      { type: 'same', value: 'c' }
    ]);
  });

  it('should return insertions at the end', function () {
    expect(diff(
      ['a', 'b', 'c'],
      ['a', 'b', 'c', 'z']
    )).to.eql([
      { type: 'same', value: 'a' },
      { type: 'same', value: 'b' },
      { type: 'same', value: 'c' },
      { type: 'ins', value: 'z' }
    ]);
  });

  it('should deal with repeats', function () {
    expect(diff(
      ['a', 'b', 'b', 'b', 'a'],
      ['c', 'b', 'b', 'b', 'c']
    )).to.eql([
      { type: 'del', value: 'a' },
      { type: 'ins', value: 'c' },
      { type: 'same', value: 'b' },
      { type: 'same', value: 'b' },
      { type: 'same', value: 'b' },
      { type: 'del', value: 'a' },
      { type: 'ins', value: 'c' }
    ]);
  });

  // we have the ability to detect and represent block moves, but don't care
  // for the purposes of this library
  it('should recognize transpositions as individual edits', function () {
    expect(diff(
      ['a', 'b', 'c', 'd', 'e'],
      ['a', 'd', 'c', 'b', 'e']
    )).to.eql([
      { type: 'same', value: 'a' },
      { type: 'del', value: 'b' },
      { type: 'ins', value: 'd' },
      { type: 'same', value: 'c' },
      { type: 'del', value: 'd' },
      { type: 'ins', value: 'b' },
      { type: 'same', value: 'e' }
    ]);
  });

  it('should handle a more complex transposition', function () {
    expect(diff(
      ['a', 'b', 'c', 'u', 'x', 'd', 'e'],
      ['a', 'd', 'u', 'c', 'x', 'b', 'e']
    )).to.eql([
      { type: 'same', value: 'a' },
      { type: 'del', value: 'b' },
      { type: 'ins', value: 'd' },
      { type: 'ins', value: 'u' },
      { type: 'same', value: 'c' },
      { type: 'del', value: 'u' },
      { type: 'same', value: 'x' },
      { type: 'del', value: 'd' },
      { type: 'ins', value: 'b' },
      { type: 'same', value: 'e' }
    ]);
  });

  it('should handle a more complex transposition with a large offset', function () {
    expect(diff(
      ['a', 'b', 'c', 'u', 'x', 'd', 'e'],
      ['z', 'z', 'z', 'z', 'z', 'z', 'z', 'z', 'z', 'z', 'a', 'd', 'u', 'c', 'x', 'b', 'e']
    )).to.eql([
      { type: 'ins', value: 'z' },
      { type: 'ins', value: 'z' },
      { type: 'ins', value: 'z' },
      { type: 'ins', value: 'z' },
      { type: 'ins', value: 'z' },
      { type: 'ins', value: 'z' },
      { type: 'ins', value: 'z' },
      { type: 'ins', value: 'z' },
      { type: 'ins', value: 'z' },
      { type: 'ins', value: 'z' },
      { type: 'same', value: 'a' },
      { type: 'del', value: 'b' },
      { type: 'ins', value: 'd' },
      { type: 'ins', value: 'u' },
      { type: 'same', value: 'c' },
      { type: 'del', value: 'u' },
      { type: 'same', value: 'x' },
      { type: 'del', value: 'd' },
      { type: 'ins', value: 'b' },
      { type: 'same', value: 'e' }
    ]);
  });

  it('should handle extra deletions with a previously-emitted change', function () {
    expect(diff(
      ['a', 'b', 'c', 'v', 'v', 'd', 'e'],
      ['a', 'd', 'c', 'b', 'e']
    )).to.eql([
      { type: 'same', value: 'a' },
      { type: 'del', value: 'b' },
      { type: 'ins', value: 'd' },
      { type: 'same', value: 'c' },
      { type: 'del', value: 'v' },
      { type: 'del', value: 'v' },
      { type: 'del', value: 'd' },
      { type: 'ins', value: 'b' },
      { type: 'same', value: 'e' }
    ]);
  });

  it('should handle neighboring transpostion', function () {
    expect(diff(
      ['a', 'b', 'c', 'd'],
      ['a', 'c', 'b', 'd']
    )).to.eql([
      { type: 'same', value: 'a' },
      { type: 'ins', value: 'c' },
      { type: 'same', value: 'b' },
      { type: 'del', value: 'c' },
      { type: 'same', value: 'd' }
    ]);
  });

  // it still won't be able to reconcile the 'b's as the same in the case of something like:
  // a b b b c b b b d
  // e b b b f b b b g
  it('should handle multiple repeats of different lengths', function () {
    expect(diff(
      ['a', 'b', 'b', 'c', 'b', 'b', 'b', 'd'],
      ['e', 'b', 'b', 'f', 'b', 'b', 'b', 'g']
    )).to.eql([
      { type: 'del', value: 'a' },
      { type: 'ins', value: 'e' },
      { type: 'same', value: 'b' },
      { type: 'same', value: 'b' },
      { type: 'del', value: 'c' },
      { type: 'ins', value: 'f' },
      { type: 'same', value: 'b' },
      { type: 'same', value: 'b' },
      { type: 'same', value: 'b' },
      { type: 'del', value: 'd' },
      { type: 'ins', value: 'g' }
    ]);
  });
});

describe('diffLines', function () {
  it('should diff text by lines', function () {
    expect(diffLines(
      'a\nb\nc',
      'a\nd\nc'
    )).to.eql([
      { type: 'same', value: 'a\n' },
      { type: 'del', value: 'b\n' },
      { type: 'ins', value: 'd\n' },
      { type: 'same', value: 'c' }
    ]);
  });
});

describe('diffWords', function () {
  it('should diff text by words (spaces)', function () {
    expect(diffWords(
      'a b c',
      'a d c'
    )).to.eql([
      { type: 'same', value: 'a ' },
      { type: 'del', value: 'b ' },
      { type: 'ins', value: 'd ' },
      { type: 'same', value: 'c' }
    ]);
  });

  it('should preserve spaces when trim is false', function () {
    expect(diffWords(
      'a  b  c',
      'a b c',
      false
    )).to.eql([
      { type: 'same', value: 'a ' },
      { type: 'del', value: ' ' },
      { type: 'same', value: 'b ' },
      { type: 'del', value: ' ' },
      { type: 'same', value: 'c' }
    ]);
  });

  it('should ignore consecutive spaces when trim is true', function () {
    expect(diffWords(
      'a  b  c',
      'a b c',
      true
    )).to.eql([
      { type: 'same', value: 'a ' },
      { type: 'same', value: 'b ' },
      { type: 'same', value: 'c' }
    ]);
  });
});

describe('diffHybrid', function () {
  it('should diff text by lines and words', function () {
    expect(diffHybrid(
      'a b\nc d\nz z\ne f\ng h',
      'a b\ni j\nz z\nk f\ng h'
    )).to.eql([
      { type: 'same', value: 'a b\n' },
      { type: 'del', value: 'c ' },
      { type: 'del', value: 'd\n' },
      { type: 'ins', value: 'i ' },
      { type: 'ins', value: 'j\n' },
      { type: 'same', value: 'z z\n' },
      { type: 'del', value: 'e ' },
      { type: 'ins', value: 'k ' },
      { type: 'same', value: 'f\n' },
      { type: 'same', value: 'g h' }
    ]);
  });
});

describe('minimize', function () {
  it('should combine like edits', function () {
    expect(minimize([
      { type: 'del', value: 'a' },
      { type: 'del', value: 'a' },
      { type: 'ins', value: 'b' },
      { type: 'ins', value: 'b' },
      { type: 'same', value: 'c' },
      { type: 'same', value: 'c' }
    ])).to.eql([
      { type: 'del', value: 'aa' },
      { type: 'ins', value: 'bb' },
      { type: 'same', value: 'cc' }
    ]);
  });

  it('should combine interleaved del/ins', function () {
    expect(minimize([
      { type: 'ins', value: 'a' },
      { type: 'del', value: 'b' },
      { type: 'del', value: 'b' },
      { type: 'ins', value: 'a' },
      { type: 'same', value: 'c' },
      { type: 'same', value: 'c' }
    ])).to.eql([
      { type: 'del', value: 'bb' },
      { type: 'ins', value: 'aa' },
      { type: 'same', value: 'cc' }
    ]);
  });

  it('should work with no \'same\' blocks', function () {
    expect(minimize([
      { type: 'del', value: 'b' },
      { type: 'del', value: 'b' },
      { type: 'ins', value: 'a' },
      { type: 'ins', value: 'a' }
    ])).to.eql([
      { type: 'del', value: 'bb' },
      { type: 'ins', value: 'aa' }
    ]);
  });
});
