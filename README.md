# HeckelDiff

An implementation of Paul Heckel's diff algorithm described in the paper, "A technique for isolating differences between files". I've modified it in a few ways:

- Repeated text will be correctly identified as unique so long as the *number* of repeats is also unique. That is, diff('a b b b a', 'c b b b c') will be read as '-a +c b b b -a +c' rather than '-a -b -b -b -a +c +b +b +b +c', as would be the case with the original paper. If there are multiple repeated tokens of the same length, the original problem will still apply if there are no uniquely identifiable lines between them.
- When processing the data into an array of changes, some effort is made to minimize the amount of change between a pair of referenced tokens. For example, diff('a b c d e', 'a d c b e') might be interpreted validly as 'a -b -c d +c +b e'; my heuristic will instead give 'a -b +d c -d +b e'. The exact approach involves summing the difference of the indices of the last-output token and the currently-under-consideration token, plus the relative difference of these values.

# Features
- Fast!
- Line-based and word-based diffing
- Or, tokenize your input however you like and pass an array of strings
- Hybrid diff which diffs by line, finds sequences of change, and diffs the localized changes by word
- Minimize function to reduce a change set to its minimal representation

# Motivation

The available diff implementations suffer from one of two problems:

1. They're based on the longest common substring solution, i.e. that described in the paper "An O(ND) Difference Algorithm and its Variations" by Eugene Myers; this method has some pathological cases when being applied to otherwise simple text samples, e.g. when a large block of text has been deleted and using word-based diffing.
2. They're not designed for programmatic use and are tightly coupled with rendering logic, outputting html without providing easy access to the raw data.
3. They bundle a bunch of functionality I don't need or care about

I wanted something fast and reasonably minimal that exposed a useful API that would give me just the change data so that it could be rendered separately... and that wouldn't choke on large block deletions. Heckel's algorithm has a few problems, but I've negated them adequately for my needs.

# Usage

```
var hDiff = require('heckel-diff');

var changes = hDiff.diffWords('a b c', 'a b d');
/*
 * [ { type: 'same', value: 'a ' },
 *   { type: 'same', value: 'b ' },
 *   { type: 'del', value: 'c' },
 *   { type: 'ins', value: 'd' } ]
 */

var minimal = hDiff.minimize(hDiff.diffWords('a a a a', 'b b b b');
/*
 * [ { type: 'del', value: 'a a a a' },
 *   { type: 'ins', value: 'b b b b' } ]
 */

var custom = hDiff.diff(['a', 'b', 'c'], ['c', 'b', 'a']);
/*
 * [ { type: 'del', value: 'a' },
 *   { type: 'ins', value: 'c' },
 *   { type: 'same', value: 'b' },
 *   { type: 'del', value: 'c' },
 *   { type: 'ins', value: 'a' } ]
 */
```

The `diff` function returns an array of changes; each change is an object with a `type` equal to `del` for deletion, `ins` for insertion, or `same` for no change, and a `value` property containing the relevant token data. the `diffWords`, `diffLines`, and `diffHybrid` functions are simply helpers that tokenize your input for you based on space, newline, and the hybrid approach respectively.

Hybrid diff performs a line-based diff, then finds all spans of deletes and inserts, reconstitutes the original text, and performs a word-based diff on the changed lines instead, inserting the results in the place of the original change objects. This is a way of reducing the amount of data a word diff has to deal with and increasing localization of change.

# Note

When using the built-in `diffWords`, `diffLines`, and `diffHybrid` functions, separators are appended to the tokens when splitting. That is, `a b c` when split as words becomes `['a ', 'b ', 'c']`. This is to avoid extra work and noise in the diff results due to matching spaces, while allowing spaces and newlines to be mixed into the same diff and preserved. If you join all the tokens, you get your original text back. You may pass a third argument to eliminate empty tokens: `hDiff.diffwords('a  b  c', 'a b c', true)` will report all 'same' tokens;

# Tests

`npm test`

The tests could stand to be expanded on, but should cover the basics. Test suggestions are welcome!

# Related work

- [diff](https://npmjs.com/package/diff) ("JsDiff", not to be confused with John Resig's implementation of the Heckel algorithm), which is a useful implementation of the LCS approach; I can't speak to its efficiency, but it did cause my browser to crash in the aforementioned pathological cases.
- [prettydiff](https://github.com/prettydiff/prettydiff) offers a lot of really useful features, including strong context awareness based on the type of input, and performed fine-grained diffing on my pathological case with no sweat at all... though the output was maybe not as useful as it might have been.
- [WikEdDiff](https://en.wikipedia.org/wiki/User:Cacycle/wikEdDiff) Pretty fast and very featureful, the code is well-commented but that doesn't make it any easier to extricate the relevant work-performing functionality from the view-rendering code and other things like block movement and such.
- [google-diff-match-patch](https://github.com/lqc/google-diff-match-patch) another LCS-based implementation, seems to be more efficient than JsDiff, offers some interesting tuning options, along with lots of optimizations, but still weighed in at around 2 seconds for my test case.
- [XinDiff](https://sourceforge.net/projects/xindiff/) based on the Heckel algorithm (I think?), bundles in view rendering, but the website is down and the API is unclear.
- [Resig's jsdiff.js](http://ejohn.org/projects/javascript-diff-algorithm/), seems to have some bugs, not be maintained or particularly usable.
