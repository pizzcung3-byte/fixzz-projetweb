/* By @maklodevv. Pembuat kode QR kecil tanpa library (mode byte, level L atau M, versi 1 sampai 40). */
(function (root) {
  'use strict';

  var ECC_PER_BLOCK = {
    L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  };
  var NUM_BLOCKS = {
    L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  };
  var FORMAT_BITS = { L: 1, M: 0 };

  function rawModules(ver) {
    var r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      var n = Math.floor(ver / 7) + 2;
      r -= (25 * n - 10) * n - 55;
      if (ver >= 7) r -= 36;
    }
    return r;
  }
  function dataCodewords(ver, ecl) {
    return Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ecl][ver] * NUM_BLOCKS[ecl][ver];
  }
  function alignPositions(ver) {
    if (ver === 1) return [];
    var n = Math.floor(ver / 7) + 2;
    var step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
    var res = [6];
    for (var pos = ver * 4 + 10; res.length < n; pos -= step) res.splice(1, 0, pos);
    return res;
  }

  function gfMul(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }
  function rsDivisor(degree) {
    var res = [];
    for (var i = 0; i < degree - 1; i++) res.push(0);
    res.push(1);
    var root = 1;
    for (var k = 0; k < degree; k++) {
      for (var j = 0; j < res.length; j++) {
        res[j] = gfMul(res[j], root);
        if (j + 1 < res.length) res[j] ^= res[j + 1];
      }
      root = gfMul(root, 2);
    }
    return res;
  }
  function rsRemainder(data, divisor) {
    var res = divisor.map(function () { return 0; });
    data.forEach(function (b) {
      var factor = b ^ res.shift();
      res.push(0);
      divisor.forEach(function (coef, i) { res[i] ^= gfMul(coef, factor); });
    });
    return res;
  }

  function utf8(str) {
    var out = [];
    var s = unescape(encodeURIComponent(str));
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return out;
  }

  function buildDataBits(bytes, ver) {
    var bits = [];
    function put(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    put(4, 4);
    put(bytes.length, ver <= 9 ? 8 : 16);
    bytes.forEach(function (b) { put(b, 8); });
    return { bits: bits, put: put };
  }

  function encode(text, preferEcl) {
    var bytes = utf8(String(text));
    var order = preferEcl === 'L' ? ['L'] : ['M', 'L'];
    var ver = 0; var ecl = '';
    outer:
    for (var oi = 0; oi < order.length; oi++) {
      for (var v = 1; v <= 40; v++) {
        var need = 4 + (v <= 9 ? 8 : 16) + bytes.length * 8;
        if (need <= dataCodewords(v, order[oi]) * 8) { ver = v; ecl = order[oi]; break outer; }
      }
    }
    if (!ver) throw new Error('Teks terlalu panjang untuk QR');

    var built = buildDataBits(bytes, ver);
    var bits = built.bits;
    var cap = dataCodewords(ver, ecl) * 8;
    built.put(0, Math.min(4, cap - bits.length));
    while (bits.length % 8) bits.push(0);
    for (var pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) built.put(pad, 8);
    var data = [];
    for (var i = 0; i < bits.length; i += 8) {
      var byte = 0;
      for (var j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
      data.push(byte);
    }

    // blok + koreksi kesalahan
    var nb = NUM_BLOCKS[ecl][ver]; var eccLen = ECC_PER_BLOCK[ecl][ver];
    var raw = Math.floor(rawModules(ver) / 8);
    var shortBlocks = nb - (raw % nb); var shortLen = Math.floor(raw / nb);
    var blocks = []; var div = rsDivisor(eccLen);
    for (var b = 0, k = 0; b < nb; b++) {
      var len = shortLen - eccLen + (b < shortBlocks ? 0 : 1);
      var dat = data.slice(k, k + len); k += len;
      var ecc = rsRemainder(dat, div);
      if (b < shortBlocks) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    var all = [];
    for (var x = 0; x < blocks[0].length; x++) {
      blocks.forEach(function (blk, bi) { if (x !== shortLen - eccLen || bi >= shortBlocks) all.push(blk[x]); });
    }

    // matriks
    var size = ver * 4 + 17;
    var mod = []; var fn = [];
    for (var r = 0; r < size; r++) { mod.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    function setFn(px, py, dark) { mod[py][px] = dark; fn[py][px] = true; }
    for (var t = 0; t < size; t++) { setFn(6, t, t % 2 === 0); setFn(t, 6, t % 2 === 0); }
    function finder(cx, cy) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var d = Math.max(Math.abs(dx), Math.abs(dy)); var xx = cx + dx; var yy = cy + dy;
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) setFn(xx, yy, d !== 2 && d !== 4);
      }
    }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    var ap = alignPositions(ver);
    for (var ai = 0; ai < ap.length; ai++) for (var aj = 0; aj < ap.length; aj++) {
      if ((ai === 0 && aj === 0) || (ai === 0 && aj === ap.length - 1) || (ai === ap.length - 1 && aj === 0)) continue;
      for (var ay = -2; ay <= 2; ay++) for (var ax = -2; ax <= 2; ax++) setFn(ap[ai] + ax, ap[aj] + ay, Math.max(Math.abs(ax), Math.abs(ay)) !== 1);
    }
    function bit(n, i) { return ((n >>> i) & 1) !== 0; }
    function drawFormat(mask) {
      var d = (FORMAT_BITS[ecl] << 3) | mask; var rem = d;
      for (var q = 0; q < 10; q++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var fb = ((d << 10) | rem) ^ 0x5412;
      for (var a = 0; a <= 5; a++) setFn(8, a, bit(fb, a));
      setFn(8, 7, bit(fb, 6)); setFn(8, 8, bit(fb, 7)); setFn(7, 8, bit(fb, 8));
      for (var c = 9; c < 15; c++) setFn(14 - c, 8, bit(fb, c));
      for (var e = 0; e < 8; e++) setFn(size - 1 - e, 8, bit(fb, e));
      for (var f = 8; f < 15; f++) setFn(8, size - 15 + f, bit(fb, f));
      setFn(8, size - 8, true);
    }
    drawFormat(0);
    if (ver >= 7) {
      var rm = ver;
      for (var vq = 0; vq < 12; vq++) rm = (rm << 1) ^ ((rm >>> 11) * 0x1f25);
      var vb = (ver << 12) | rm;
      for (var vi = 0; vi < 18; vi++) {
        var col = bit(vb, vi); var va = size - 11 + (vi % 3); var vbb = Math.floor(vi / 3);
        setFn(va, vbb, col); setFn(vbb, va, col);
      }
    }
    // tempatkan codeword
    var idx = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (var jj = 0; jj < 2; jj++) {
          var px = right - jj; var upward = ((right + 1) & 2) === 0; var py = upward ? size - 1 - vert : vert;
          if (!fn[py][px] && idx < all.length * 8) { mod[py][px] = bit(all[idx >>> 3], 7 - (idx & 7)); idx++; }
        }
      }
    }
    function applyMask(m) {
      for (var y = 0; y < size; y++) for (var xx = 0; xx < size; xx++) {
        var inv;
        switch (m) {
          case 0: inv = (xx + y) % 2 === 0; break;
          case 1: inv = y % 2 === 0; break;
          case 2: inv = xx % 3 === 0; break;
          case 3: inv = (xx + y) % 3 === 0; break;
          case 4: inv = (Math.floor(xx / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: inv = ((xx * y) % 2) + ((xx * y) % 3) === 0; break;
          case 6: inv = (((xx * y) % 2) + ((xx * y) % 3)) % 2 === 0; break;
          default: inv = (((xx + y) % 2) + ((xx * y) % 3)) % 2 === 0;
        }
        if (!fn[y][xx] && inv) mod[y][xx] = !mod[y][xx];
      }
    }
    function penalty() {
      var res = 0; var y; var x;
      for (y = 0; y < size; y++) {
        var run = 1;
        for (x = 1; x < size; x++) { if (mod[y][x] === mod[y][x - 1]) { run++; if (run === 5) res += 3; else if (run > 5) res++; } else run = 1; }
      }
      for (x = 0; x < size; x++) {
        var run2 = 1;
        for (y = 1; y < size; y++) { if (mod[y][x] === mod[y - 1][x]) { run2++; if (run2 === 5) res += 3; else if (run2 > 5) res++; } else run2 = 1; }
      }
      for (y = 0; y < size - 1; y++) for (x = 0; x < size - 1; x++) {
        var c = mod[y][x];
        if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) res += 3;
      }
      var pat = [true, false, true, true, true, false, true, false, false, false, false];
      function matches(get, off) { for (var i2 = 0; i2 < 11; i2++) if (get(off + i2) !== pat[i2]) return false; return true; }
      function matchesRev(get, off) { for (var i3 = 0; i3 < 11; i3++) if (get(off + i3) !== pat[10 - i3]) return false; return true; }
      for (y = 0; y < size; y++) for (x = 0; x + 11 <= size; x++) {
        var gr = function (o) { return mod[y][o]; };
        if (matches(gr, x)) res += 40; if (matchesRev(gr, x)) res += 40;
      }
      for (x = 0; x < size; x++) for (y = 0; y + 11 <= size; y++) {
        var gc = function (o) { return mod[o][x]; };
        if (matches(gc, y)) res += 40; if (matchesRev(gc, y)) res += 40;
      }
      var dark = 0;
      mod.forEach(function (row) { row.forEach(function (v) { if (v) dark++; }); });
      var total = size * size;
      res += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10 > 0 ? (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10 : 0;
      return res;
    }
    var best = 0; var bestPen = Infinity;
    for (var m = 0; m < 8; m++) {
      applyMask(m); drawFormat(m);
      var p = penalty();
      if (p < bestPen) { bestPen = p; best = m; }
      applyMask(m);
    }
    applyMask(best); drawFormat(best);
    return { size: size, version: ver, ecl: ecl, mask: best, modules: mod };
  }

  function toSvg(text, opts) {
    opts = opts || {};
    var q = encode(text, opts.ecl);
    var border = opts.border == null ? 4 : opts.border;
    var dim = q.size + border * 2;
    var d = [];
    for (var y = 0; y < q.size; y++) {
      var x = 0;
      while (x < q.size) {
        if (q.modules[y][x]) {
          var start = x;
          while (x < q.size && q.modules[y][x]) x++;
          d.push('M' + (start + border) + ',' + (y + border) + 'h' + (x - start) + 'v1h-' + (x - start) + 'z');
        } else x++;
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + dim + ' ' + dim + '" shape-rendering="crispEdges" role="img" aria-label="Kode QR pembayaran"><rect width="100%" height="100%" fill="#fff"/><path d="' + d.join('') + '" fill="#000"/></svg>';
  }

  root.QR = { encode: encode, toSvg: toSvg };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.QR;
})(typeof window !== 'undefined' ? window : globalThis);
