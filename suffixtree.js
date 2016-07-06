// Modified from https://github.com/maclandrol/SuffixTreeJS
// which is itself based on code from http://www.allisons.org/ll/AlgDS/Tree/Suffix/

'use strict';

function Node() {
  this.children = Object.create(null);
  this.suffixLink = null;
  this.start = -1;
  this.end = -1;
  this.length = -1;
  this.isLeaf = true;
}
Node.prototype.setRange = function (start, end) {
  this.start = start;
  this.end = end;
  this.length = this.end - this.start + 1;
};
Node.prototype.addChild = function (node, start, end, t) {
  node.setRange(start, end);
  this.children[t] = node;
  this.isLeaf = false;
};
Node.prototype.forEach = function (cb, depth, prefixLen) {
  prefixLen = prefixLen || 0;
  depth = depth || 0;

  var key, child;
  for (key in this.children) {
    child = this.children[key];

    cb(child, depth, prefixLen);

    if (!child.isLeaf) {
      child.forEach(cb, depth + 1, prefixLen + child.length);
    }
  }
};

function Walker(tree) {
  this.tree = tree;
  this.reset();
}
Walker.prototype.reset = function () {
  this.node = this.tree.root;
  this.pos = -1;
  this.done = false;
};
Walker.prototype.advance = function (str) {
  if (this.done) { return false; }

  var pos = ++this.pos, nextNode;

  if (pos > 0 && pos <= this.node.end) {
    this.done = (this.tree.text[pos] !== str);
  } else {
    if (str in this.node.children) {
      this.node = this.node.children[str];
      this.pos = this.node.start;
    } else {
      this.done = true;
    }
  }

  return !this.done;
};
Walker.prototype.isLeaf = function () {
  return this.node.isLeaf;
};

function SuffixTree() {
  this.text = [ ];
  this.root = new Node();
  this.bottom = new Node();
  this.root.suffixLink = this.bottom;
  this.s = this.root;
  this.k = 0;
  this.i = -1;
}

SuffixTree.prototype.createWalker = function () {
  return new Walker(this);
};

SuffixTree.prototype.addString = function (str) {
  this.add(str.split(''));
};

SuffixTree.prototype.add = function (arr) {
  this.text = arr.slice();

  var s = this.s,
      k = this.k,
      i = this.i,
      up;

  // TODO: don't really know why this extra loop, can it be cleaned up with some shuffling around?
  // seems to be adding final nodes and suffix links for each character
  for (var j = 0; j < this.text.length; j++) {
    this.bottom.addChild(this.root, j, j, this.text[j]);
  }

  while (this.text[i+1]) {
    i++;
    up = this.update(s, k, i);
    up = this.canonize(up[0], up[1], i);
    s = up[0];
    k = up[1];
  }

  this.s = s;
  this.k = k;
  this.i = i;

  return this;
};

SuffixTree.prototype.update = function (s, k, i) {
  var oldr = this.root;
  var sAndk;
  var endAndr = this.testAndSplit(s, k, i - 1, this.text[i]);
  var endPoint = endAndr[0];
  var r = endAndr[1];

  while (!endPoint) {
    r.addChild(new Node(), i, Infinity, this.text[i]);

    if (oldr != this.root) {
      oldr.suffixLink = r;
    }

    oldr = r;

    sAndk = this.canonize(s.suffixLink, k, i - 1);
    s = sAndk[0];
    k = sAndk[1];

    endAndr = this.testAndSplit(s, k, i - 1, this.text[i]);
    endPoint = endAndr[0];
    r = endAndr[1];
  }

  if (oldr != this.root) {
    oldr.suffixLink = s;
  }

  return [s, k];
};


SuffixTree.prototype.testAndSplit = function (s, k, p, t) {
  if (k > p) {
    return [t in s.children, s];
  }

  var child = s.children[this.text[k]],
      k2 = child.start,
      p2 = child.end;

  if (t === this.text[k2 + p - k + 1]) {
    return [true, s];
  }

  var r = new Node();
  s.addChild(r, k2, k2 + p - k, this.text[k2]);
  r.addChild(child, k2 + p - k + 1, p2, this.text[k2 + p - k + 1]);

  return [false, r];
};


SuffixTree.prototype.canonize = function (s, k, p) {
  if (k > p) {
    return [s, k];
  }

  var child = s.children[this.text[k]];

  while (child.length - 1 <= p - k) {
    k += child.length;
    s = child;

    if (k <= p) {
      child = s.children[this.text[k]];
    }
  }

  return [s, k];
};

SuffixTree.prototype.toString = function() {
  var text = this.text, nodes = [ ];

  this.root.forEach(function (leaf, depth, prefixLen) {
    nodes.push(
      (new Array(depth+1)).join('\t') +
      '["'+text.slice(leaf.start-prefixLen, leaf.end+1).join('')+'", '+leaf.start+', '+leaf.end+']'
    );
  });

  return nodes.join('\n');
};

SuffixTree.prototype.print = function(){
  console.log(this.toString());
};

module.exports = SuffixTree;
