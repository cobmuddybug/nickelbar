.pragma library

// A small vector icon per game, for the picker. draw(ctx, id, x, y, s, c)
// paints game `id` into the s×s square at (x, y); c holds theme colours:
// { fg, dim, bg, accent, danger, soft, warm, tone: [6] } (soft: the accent
// faded; warm: tone 3 faded). Everything is in unit
// coordinates (0..1) and scaled, so the same drawing works at 16px and
// at 120px. Unknown ids get a plain die.

function draw(ctx, id, x, y, s, c) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.lineWidth = 0.07
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  var f = ICONS[id] || ICONS._default
  f(ctx, c)
  ctx.restore()
}

// ---- helpers (unit square) -------------------------------------------------

function box(ctx, col, x, y, w, h) { ctx.fillStyle = col; ctx.fillRect(x, y, w, h) }
function dot(ctx, col, x, y, r) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill() }
function ring(ctx, col, x, y, r, w) { ctx.strokeStyle = col; ctx.lineWidth = w || 0.07; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke() }
function poly(ctx, col, pts, stroke) {
  ctx.beginPath()
  ctx.moveTo(pts[0], pts[1])
  for (var i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1])
  if (stroke) { ctx.strokeStyle = col; ctx.stroke() }
  else { ctx.closePath(); ctx.fillStyle = col; ctx.fill() }
}
function line(ctx, col, pts, w) { ctx.lineWidth = w || 0.07; poly(ctx, col, pts, true) }
function text(ctx, col, str, x, y, size, bold) {
  ctx.fillStyle = col
  ctx.textAlign = "center"; ctx.textBaseline = "middle"
  // Canvas fonts can't be fractional-scaled reliably; draw at 100x and shrink.
  ctx.save(); ctx.translate(x, y); ctx.scale(0.01, 0.01)
  ctx.font = (bold ? "bold " : "") + Math.round(size * 100) + "px sans-serif"
  ctx.fillText(str, 0, 0)
  ctx.restore()
}
function grid(ctx, col, n, x, y, w) {
  ctx.strokeStyle = col; ctx.lineWidth = 0.03
  for (var i = 0; i <= n; ++i) {
    ctx.beginPath(); ctx.moveTo(x + i * w / n, y); ctx.lineTo(x + i * w / n, y + w); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(x, y + i * w / n); ctx.lineTo(x + w, y + i * w / n); ctx.stroke()
  }
}
function card(ctx, c, x, y, w, h, mark, col) {
  box(ctx, c.fg, x, y, w, h)
  box(ctx, c.bg, x + 0.03, y + 0.03, w - 0.06, h - 0.06)
  text(ctx, col, mark, x + w / 2, y + h / 2, h * 0.45, true)
}
function die(ctx, c, x, y, w, n, col) {
  box(ctx, col || c.fg, x, y, w, w)
  var P = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]][n]
  for (var i = 0; i < P.length; ++i) dot(ctx, c.bg, x + w * (0.25 + (P[i] % 3) * 0.25), y + w * (0.25 + Math.floor(P[i] / 3) * 0.25), w * 0.09)
}
function ghost(ctx, col, x, y, r) {
  ctx.fillStyle = col
  ctx.beginPath(); ctx.moveTo(x - r, y + r); ctx.lineTo(x - r, y); ctx.arc(x, y, r, Math.PI, 0); ctx.lineTo(x + r, y + r)
  ctx.lineTo(x + r * 0.5, y + r * 0.7); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.5, y + r * 0.7); ctx.closePath(); ctx.fill()
}

// ---- icons -----------------------------------------------------------------

var ICONS = {
  _default: function(ctx, c) { die(ctx, c, 0.2, 0.2, 0.6, 5, c.tone[0]) },

  // Arcade
  snake: function(ctx, c) {
    line(ctx, c.tone[2], [0.15, 0.75, 0.15, 0.3, 0.55, 0.3, 0.55, 0.6, 0.8, 0.6], 0.14)
    dot(ctx, c.danger, 0.82, 0.25, 0.07)
  },
  breakout: function(ctx, c) {
    for (var r = 0; r < 3; ++r) for (var k = 0; k < 4; ++k) box(ctx, c.tone[r], 0.1 + k * 0.2, 0.12 + r * 0.12, 0.17, 0.09)
    dot(ctx, c.fg, 0.55, 0.62, 0.05); box(ctx, c.fg, 0.35, 0.82, 0.3, 0.06)
  },
  stack: function(ctx, c) {
    box(ctx, c.tone[0], 0.2, 0.62, 0.6, 0.18); box(ctx, c.tone[0], 0.2, 0.44, 0.2, 0.18)
    box(ctx, c.tone[3], 0.4, 0.2, 0.2, 0.2); box(ctx, c.tone[3], 0.4, 0.4, 0.2, 0.2); box(ctx, c.tone[3], 0.6, 0.4, 0.2, 0.2)
  },
  pong: function(ctx, c) {
    box(ctx, c.fg, 0.1, 0.25, 0.07, 0.3); box(ctx, c.fg, 0.83, 0.45, 0.07, 0.3); dot(ctx, c.accent, 0.5, 0.45, 0.06)
    line(ctx, c.dim, [0.5, 0.1, 0.5, 0.9], 0.02)
  },
  invaders: function(ctx, c) {
    var px = [[0, 1, 0, 1, 0], [1, 1, 1, 1, 1], [1, 0, 1, 0, 1], [1, 1, 1, 1, 1], [0, 1, 0, 1, 0]]
    for (var y = 0; y < 5; ++y) for (var x = 0; x < 5; ++x) if (px[y][x]) box(ctx, c.tone[2], 0.2 + x * 0.12, 0.15 + y * 0.1, 0.12, 0.1)
    box(ctx, c.fg, 0.42, 0.8, 0.16, 0.08)
  },
  asteroids: function(ctx, c) {
    poly(ctx, c.tone[1], [0.55, 0.12, 0.85, 0.2, 0.9, 0.45, 0.7, 0.55, 0.5, 0.4], true)
    line(ctx, c.fg, [0.2, 0.85, 0.3, 0.55, 0.4, 0.85, 0.3, 0.77, 0.2, 0.85])
  },
  lightcycles: function(ctx, c) {
    line(ctx, c.tone[0], [0.1, 0.8, 0.5, 0.8, 0.5, 0.35], 0.08); line(ctx, c.tone[1], [0.9, 0.2, 0.3, 0.2, 0.3, 0.55], 0.08)
  },
  crossing: function(ctx, c) {
    box(ctx, c.dim, 0.05, 0.3, 0.9, 0.02); box(ctx, c.dim, 0.05, 0.6, 0.9, 0.02)
    box(ctx, c.tone[1], 0.15, 0.38, 0.3, 0.16); box(ctx, c.tone[3], 0.6, 0.68, 0.3, 0.16); dot(ctx, c.tone[2], 0.55, 0.2, 0.08)
  },
  runner: function(ctx, c) {
    box(ctx, c.dim, 0.05, 0.8, 0.9, 0.04)
    box(ctx, c.fg, 0.2, 0.45, 0.2, 0.25); box(ctx, c.fg, 0.35, 0.35, 0.15, 0.12); box(ctx, c.tone[2], 0.7, 0.6, 0.08, 0.2)
  },
  cave: function(ctx, c) {
    poly(ctx, c.dim, [0, 0, 1, 0, 1, 0.2, 0.7, 0.3, 0.4, 0.18, 0, 0.3])
    poly(ctx, c.dim, [0, 1, 1, 1, 1, 0.7, 0.6, 0.8, 0.3, 0.68, 0, 0.8])
    box(ctx, c.tone[3], 0.35, 0.45, 0.25, 0.1)
  },
  missile: function(ctx, c) {
    line(ctx, c.danger, [0.2, 0.05, 0.4, 0.6], 0.04); line(ctx, c.danger, [0.8, 0.05, 0.65, 0.5], 0.04)
    ring(ctx, c.tone[3], 0.4, 0.6, 0.12, 0.05)
    box(ctx, c.tone[0], 0.1, 0.85, 0.2, 0.1); box(ctx, c.tone[0], 0.7, 0.85, 0.2, 0.1)
  },
  lander: function(ctx, c) {
    poly(ctx, c.dim, [0, 1, 0, 0.8, 0.3, 0.85, 0.4, 0.75, 0.65, 0.75, 0.75, 0.9, 1, 0.8, 1, 1])
    box(ctx, c.fg, 0.42, 0.35, 0.18, 0.15); line(ctx, c.fg, [0.42, 0.5, 0.36, 0.62], 0.04); line(ctx, c.fg, [0.6, 0.5, 0.66, 0.62], 0.04)
    poly(ctx, c.danger, [0.46, 0.52, 0.56, 0.52, 0.51, 0.66])
  },
  muncher: function(ctx, c) {
    ctx.fillStyle = c.tone[3]; ctx.beginPath(); ctx.moveTo(0.35, 0.5); ctx.arc(0.35, 0.5, 0.25, 0.6, Math.PI * 2 - 0.6); ctx.closePath(); ctx.fill()
    dot(ctx, c.fg, 0.65, 0.5, 0.04); ghost(ctx, c.tone[1], 0.8, 0.45, 0.13)
  },
  hexfall: function(ctx, c) {
    var pts = []
    for (var i = 0; i < 6; ++i) { var a = Math.PI / 3 * i - Math.PI / 6; pts.push(0.5 + Math.cos(a) * 0.2, 0.55 + Math.sin(a) * 0.2) }
    poly(ctx, c.fg, pts, true)
    box(ctx, c.tone[0], 0.4, 0.2, 0.2, 0.08); box(ctx, c.tone[1], 0.4, 0.06, 0.2, 0.08)
  },
  melon: function(ctx, c) {
    line(ctx, c.dim, [0.1, 0.1, 0.1, 0.9, 0.9, 0.9, 0.9, 0.1], 0.04)
    dot(ctx, c.tone[2], 0.38, 0.68, 0.2); dot(ctx, c.tone[1], 0.72, 0.75, 0.13); dot(ctx, c.tone[3], 0.6, 0.25, 0.08)
  },
  bubbles: function(ctx, c) {
    for (var k = 0; k < 4; ++k) dot(ctx, c.tone[k], 0.2 + k * 0.2, 0.18, 0.09)
    for (var j = 0; j < 3; ++j) dot(ctx, c.tone[j + 2], 0.3 + j * 0.2, 0.35, 0.09)
    line(ctx, c.fg, [0.5, 0.9, 0.62, 0.62], 0.06); dot(ctx, c.tone[4], 0.5, 0.88, 0.09)
  },
  bounce: function(ctx, c) {
    box(ctx, c.soft, 0.1, 0.1, 0.3, 0.8)
    line(ctx, c.dim, [0.1, 0.1, 0.9, 0.1, 0.9, 0.9, 0.1, 0.9, 0.1, 0.1], 0.04)
    box(ctx, c.tone[3], 0.6, 0.3, 0.06, 0.4); dot(ctx, c.fg, 0.78, 0.25, 0.06); dot(ctx, c.fg, 0.52, 0.78, 0.06)
  },
  moonbuggy: function(ctx, c) {
    box(ctx, c.dim, 0, 0.75, 0.55, 0.25); box(ctx, c.dim, 0.75, 0.75, 0.25, 0.25)
    box(ctx, c.tone[3], 0.12, 0.48, 0.4, 0.14); box(ctx, c.tone[3], 0.2, 0.38, 0.18, 0.1)
    dot(ctx, c.fg, 0.18, 0.68, 0.07); dot(ctx, c.fg, 0.32, 0.68, 0.07); dot(ctx, c.fg, 0.46, 0.68, 0.07)
  },

  // Midway
  stacker: function(ctx, c) {
    for (var r = 0; r < 5; ++r) box(ctx, r === 0 ? c.tone[1] : c.tone[0], 0.3 + (r % 2) * 0.1 - (r === 0 ? 0.1 : 0), 0.15 + r * 0.14, 0.3, 0.1)
  },
  skeeball: function(ctx, c) { ring(ctx, c.fg, 0.5, 0.4, 0.3, 0.05); ring(ctx, c.tone[0], 0.5, 0.4, 0.18, 0.05); dot(ctx, c.tone[1], 0.5, 0.4, 0.07); dot(ctx, c.tone[3], 0.5, 0.85, 0.08) },
  whackamole: function(ctx, c) {
    ctx.fillStyle = c.dim; ctx.beginPath(); ctx.ellipse(0.15, 0.72, 0.7, 0.18); ctx.fill()
    ctx.fillStyle = c.fg; ctx.beginPath(); ctx.moveTo(0.35, 0.8); ctx.lineTo(0.35, 0.5); ctx.arc(0.5, 0.5, 0.15, Math.PI, 0); ctx.lineTo(0.65, 0.8); ctx.fill()
    dot(ctx, c.bg, 0.45, 0.5, 0.025); dot(ctx, c.bg, 0.55, 0.5, 0.025); dot(ctx, c.danger, 0.5, 0.57, 0.03)
    box(ctx, c.tone[3], 0.6, 0.1, 0.3, 0.14); line(ctx, c.tone[3], [0.72, 0.24, 0.62, 0.42], 0.05)
  },
  plinko: function(ctx, c) {
    for (var r = 0; r < 4; ++r) for (var k = 0; k < 4 - (r % 2); ++k) dot(ctx, c.dim, 0.2 + k * 0.2 + (r % 2) * 0.1, 0.2 + r * 0.16, 0.025)
    dot(ctx, c.tone[1], 0.42, 0.34, 0.07)
    for (var s2 = 0; s2 < 5; ++s2) box(ctx, s2 === 2 ? c.tone[3] : c.soft, 0.1 + s2 * 0.16, 0.82, 0.14, 0.1)
  },
  bowling: function(ctx, c) {
    [[0.5, 0.18], [0.4, 0.3], [0.6, 0.3], [0.3, 0.42], [0.5, 0.42], [0.7, 0.42]].forEach(function(p) { dot(ctx, c.fg, p[0], p[1], 0.065) })
    dot(ctx, c.accent, 0.5, 0.78, 0.13); dot(ctx, c.bg, 0.46, 0.74, 0.02); dot(ctx, c.bg, 0.52, 0.73, 0.02); dot(ctx, c.bg, 0.5, 0.79, 0.02)
  },
  fishing: function(ctx, c) {
    line(ctx, c.fg, [0.15, 0.85, 0.7, 0.12], 0.05); line(ctx, c.dim, [0.7, 0.12, 0.7, 0.55], 0.025); dot(ctx, c.danger, 0.7, 0.58, 0.05)
    ctx.fillStyle = c.tone[1]; ctx.beginPath(); ctx.ellipse(0.4, 0.68, 0.3, 0.14); ctx.fill(); poly(ctx, c.tone[1], [0.7, 0.75, 0.84, 0.66, 0.84, 0.84])
  },
  bumpercars: function(ctx, c) {
    ring(ctx, c.dim, 0.5, 0.5, 0.42, 0.04); dot(ctx, c.accent, 0.38, 0.55, 0.13); dot(ctx, c.tone[2], 0.64, 0.4, 0.11)
    line(ctx, c.fg, [0.5, 0.45, 0.54, 0.46], 0.04); line(ctx, c.danger, [0.8, 0.2, 0.9, 0.1], 0.05)
  },
  echo: function(ctx, c) {
    box(ctx, c.tone[0], 0.12, 0.12, 0.34, 0.34); box(ctx, c.tone[1], 0.54, 0.12, 0.34, 0.34)
    box(ctx, c.tone[2], 0.12, 0.54, 0.34, 0.34); box(ctx, c.tone[3], 0.54, 0.54, 0.34, 0.34)
  },
  roulette: function(ctx, c) {
    ring(ctx, c.fg, 0.5, 0.5, 0.38, 0.06); ring(ctx, c.danger, 0.5, 0.5, 0.24, 0.1); ring(ctx, c.dim, 0.5, 0.5, 0.1, 0.05); dot(ctx, c.tone[3], 0.5, 0.15, 0.06)
  },
  striker: function(ctx, c) {
    box(ctx, c.dim, 0.44, 0.15, 0.12, 0.7); box(ctx, c.tone[3], 0.44, 0.22, 0.12, 0.12); dot(ctx, c.tone[3], 0.5, 0.12, 0.09); dot(ctx, c.accent, 0.5, 0.6, 0.07)
    box(ctx, c.fg, 0.1, 0.78, 0.3, 0.07); box(ctx, c.fg, 0.1, 0.62, 0.08, 0.2)
  },
  quickdraw: function(ctx, c) {
    box(ctx, c.fg, 0.2, 0.4, 0.4, 0.12); box(ctx, c.fg, 0.2, 0.48, 0.12, 0.28); line(ctx, c.danger, [0.7, 0.3, 0.88, 0.2], 0.05); line(ctx, c.danger, [0.7, 0.45, 0.9, 0.45], 0.05)
  },
  mindtester: function(ctx, c) {
    ring(ctx, c.fg, 0.5, 0.56, 0.32, 0.06); line(ctx, c.danger, [0.5, 0.56, 0.68, 0.34], 0.06); dot(ctx, c.danger, 0.5, 0.9, 0.06); text(ctx, c.accent, "?", 0.5, 0.2, 0.2, true)
  },
  ringtoss: function(ctx, c) {
    box(ctx, c.fg, 0.22, 0.55, 0.12, 0.3); box(ctx, c.fg, 0.62, 0.55, 0.12, 0.3); box(ctx, c.fg, 0.255, 0.42, 0.05, 0.15); box(ctx, c.fg, 0.655, 0.42, 0.05, 0.15)
    ring(ctx, c.tone[3], 0.28, 0.5, 0.12, 0.05); ring(ctx, c.accent, 0.5, 0.2, 0.1, 0.05)
  },
  milkjugs: function(ctx, c) {
    [[0.34, 0.75], [0.5, 0.75], [0.66, 0.75], [0.42, 0.55], [0.58, 0.55], [0.5, 0.35]].forEach(function(p) { box(ctx, c.fg, p[0] - 0.06, p[1] - 0.09, 0.12, 0.18); box(ctx, c.accent, p[0] - 0.06, p[1] - 0.02, 0.12, 0.05) })
    dot(ctx, c.tone[3], 0.14, 0.52, 0.06)
  },
  holdem: function(ctx, c) {
    box(ctx, c.fg, 0.14, 0.2, 0.26, 0.38); box(ctx, c.fg, 0.4, 0.2, 0.26, 0.38); text(ctx, c.danger, "A", 0.27, 0.39, 0.22, true); text(ctx, c.bg, "K", 0.53, 0.39, 0.22, true)
    dot(ctx, c.tone[3], 0.3, 0.78, 0.1); dot(ctx, c.accent, 0.52, 0.78, 0.1); dot(ctx, c.danger, 0.74, 0.78, 0.1)
  },
  raid: function(ctx, c) {
    poly(ctx, c.accent, [0.12, 0.5, 0.36, 0.4, 0.3, 0.5, 0.36, 0.6]); line(ctx, c.fg, [0.45, 0.5, 0.6, 0.5], 0.04)
    poly(ctx, c.tone[4], [0.88, 0.3, 0.7, 0.22, 0.7, 0.38]); poly(ctx, c.danger, [0.88, 0.7, 0.7, 0.62, 0.7, 0.78])
  },
  billiards: function(ctx, c) {
    dot(ctx, c.fg, 0.3, 0.7, 0.1); dot(ctx, c.tone[3], 0.6, 0.35, 0.1); dot(ctx, c.danger, 0.78, 0.5, 0.1); dot(ctx, c.fg, 0.68, 0.22, 0.01)
    line(ctx, c.dim, [0.1, 0.9, 0.24, 0.76], 0.05); dot(ctx, c.bg, 0.5, 0.5, 0.0)
  },
  newton: function(ctx, c) {
    ring(ctx, c.dim, 0.5, 0.62, 0.26, 0.05); dot(ctx, c.tone[3], 0.5, 0.36, 0.07); dot(ctx, c.tone[1], 0.74, 0.7, 0.07); dot(ctx, c.tone[2], 0.26, 0.7, 0.07); dot(ctx, c.danger, 0.5, 0.12, 0.06)
  },
  tornado: function(ctx, c) {
    line(ctx, c.accent, [0.2, 0.2, 0.8, 0.2], 0.07); line(ctx, c.tone[1], [0.28, 0.38, 0.72, 0.38], 0.07); line(ctx, c.tone[2], [0.36, 0.56, 0.64, 0.56], 0.07); line(ctx, c.tone[3], [0.44, 0.74, 0.56, 0.74], 0.07); dot(ctx, c.danger, 0.5, 0.9, 0.05)
  },
  stomper: function(ctx, c) {
    box(ctx, c.tone[2], 0.05, 0.8, 0.9, 0.15); box(ctx, c.tone[4], 0.7, 0.55, 0.2, 0.25); box(ctx, c.tone[3], 0.15, 0.3, 0.14, 0.14); box(ctx, c.tone[3], 0.29, 0.3, 0.14, 0.14)
    dot(ctx, c.danger, 0.5, 0.6, 0.08); box(ctx, c.accent, 0.43, 0.66, 0.14, 0.14)
    ctx.fillStyle = c.tone[2]; ctx.beginPath(); ctx.arc(0.78, 0.5, 0.06, Math.PI, 0); ctx.fill()
  },
  cyclone: function(ctx, c) {
    for (var i = 0; i < 16; ++i) { var a = -Math.PI / 2 + i / 16 * Math.PI * 2; dot(ctx, i === 0 ? c.tone[3] : i === 5 ? c.accent : c.dim, 0.5 + Math.cos(a) * 0.36, 0.5 + Math.sin(a) * 0.36, i === 0 ? 0.07 : 0.04) }
  },
  gallery: function(ctx, c) {
    ctx.fillStyle = c.tone[3]; ctx.beginPath(); ctx.ellipse(0.12, 0.45, 0.4, 0.2); ctx.fill(); dot(ctx, c.tone[3], 0.5, 0.42, 0.08)
    ring(ctx, c.fg, 0.7, 0.55, 0.14, 0.04); line(ctx, c.fg, [0.7, 0.33, 0.7, 0.45], 0.04); line(ctx, c.fg, [0.48, 0.55, 0.6, 0.55], 0.04)
  },
  hoops: function(ctx, c) {
    line(ctx, c.dim, [0.25, 0.12, 0.75, 0.12, 0.75, 0.4, 0.25, 0.4, 0.25, 0.12], 0.03)
    line(ctx, c.danger, [0.36, 0.38, 0.64, 0.38], 0.05); dot(ctx, c.tone[3], 0.5, 0.7, 0.14); line(ctx, c.bg, [0.36, 0.7, 0.64, 0.7], 0.02)
  },
  claw: function(ctx, c) {
    line(ctx, c.fg, [0.5, 0.05, 0.5, 0.35], 0.03); box(ctx, c.fg, 0.42, 0.33, 0.16, 0.08)
    line(ctx, c.fg, [0.44, 0.41, 0.36, 0.52, 0.42, 0.58], 0.04); line(ctx, c.fg, [0.56, 0.41, 0.64, 0.52, 0.58, 0.58], 0.04)
    dot(ctx, c.tone[1], 0.5, 0.75, 0.14); dot(ctx, c.tone[1], 0.4, 0.63, 0.05); dot(ctx, c.tone[1], 0.6, 0.63, 0.05)
  },
  coinpusher: function(ctx, c) {
    box(ctx, c.dim, 0.1, 0.1, 0.8, 0.2)
    for (var i = 0; i < 7; ++i) dot(ctx, c.tone[3], 0.2 + (i % 4) * 0.2 + (i >= 4 ? 0.1 : 0), 0.45 + (i >= 4 ? 0.18 : 0), 0.08)
    line(ctx, c.accent, [0.1, 0.9, 0.9, 0.9], 0.04)
  },
  derby: function(ctx, c) {
    for (var i = 0; i < 3; ++i) { ctx.fillStyle = i === 0 ? c.accent : c.tone[i + 1]; ctx.beginPath(); ctx.ellipse(0.15 + i * 0.12, 0.15 + i * 0.22, 0.3, 0.13); ctx.fill() }
    line(ctx, c.danger, [0.85, 0.1, 0.85, 0.8], 0.04)
    dot(ctx, c.tone[3], 0.3, 0.88, 0.05); dot(ctx, c.danger, 0.5, 0.88, 0.05); dot(ctx, c.tone[0], 0.7, 0.88, 0.05)
  },
  slots: function(ctx, c) {
    for (var k = 0; k < 3; ++k) { box(ctx, c.fg, 0.1 + k * 0.28, 0.25, 0.24, 0.45); text(ctx, c.tone[1], "7", 0.22 + k * 0.28, 0.48, 0.3, true) }
  },

  // Puzzle
  minesweeper: function(ctx, c) {
    grid(ctx, c.dim, 3, 0.1, 0.1, 0.8); dot(ctx, c.fg, 0.5, 0.5, 0.1)
    text(ctx, c.tone[0], "1", 0.23, 0.23, 0.2, true); text(ctx, c.tone[1], "2", 0.77, 0.77, 0.2, true)
    poly(ctx, c.danger, [0.7, 0.15, 0.85, 0.22, 0.7, 0.3])
  },
  "2048": function(ctx, c) { box(ctx, c.tone[3], 0.1, 0.1, 0.38, 0.38); box(ctx, c.tone[1], 0.52, 0.52, 0.38, 0.38); text(ctx, c.bg, "2", 0.29, 0.3, 0.25, true); text(ctx, c.bg, "4", 0.71, 0.72, 0.25, true) },
  lightsout: function(ctx, c) { for (var i = 0; i < 9; ++i) box(ctx, [0, 2, 4, 6, 8].indexOf(i) >= 0 ? c.tone[3] : c.dim, 0.12 + (i % 3) * 0.27, 0.12 + Math.floor(i / 3) * 0.27, 0.22, 0.22) },
  sokoban: function(ctx, c) {
    box(ctx, c.tone[3], 0.45, 0.35, 0.35, 0.35); line(ctx, c.bg, [0.45, 0.35, 0.8, 0.7], 0.04); line(ctx, c.bg, [0.8, 0.35, 0.45, 0.7], 0.04)
    dot(ctx, c.fg, 0.25, 0.4, 0.08); box(ctx, c.fg, 0.19, 0.48, 0.12, 0.2)
  },
  arc: function(ctx, c) {
    var cols = ["#0074D9", "#FF4136", "#2ECC40", "#FFDC00"]
    for (var i = 0; i < 4; ++i) box(ctx, cols[i], 0.12 + (i % 2) * 0.4, 0.12 + Math.floor(i / 2) * 0.4, 0.34, 0.34)
  },
  robots: function(ctx, c) {
    box(ctx, c.tone[1], 0.55, 0.2, 0.3, 0.25); dot(ctx, c.bg, 0.63, 0.3, 0.035); dot(ctx, c.bg, 0.77, 0.3, 0.035)
    poly(ctx, c.dim, [0.5, 0.9, 0.58, 0.7, 0.66, 0.8, 0.74, 0.62, 0.85, 0.9])
    dot(ctx, c.accent, 0.25, 0.55, 0.08); box(ctx, c.accent, 0.18, 0.64, 0.14, 0.16)
  },
  tetravex: function(ctx, c) {
    var t = [c.tone[0], c.tone[1], c.tone[2], c.tone[3]]
    poly(ctx, t[0], [0.2, 0.2, 0.8, 0.2, 0.5, 0.5]); poly(ctx, t[1], [0.8, 0.2, 0.8, 0.8, 0.5, 0.5])
    poly(ctx, t[2], [0.8, 0.8, 0.2, 0.8, 0.5, 0.5]); poly(ctx, t[3], [0.2, 0.8, 0.2, 0.2, 0.5, 0.5])
  },
  fiveormore: function(ctx, c) { for (var k = 0; k < 5; ++k) dot(ctx, c.tone[2], 0.14 + k * 0.18, 0.86 - k * 0.18, 0.08); dot(ctx, c.tone[1], 0.2, 0.2, 0.08) },
  klotski: function(ctx, c) {
    box(ctx, c.accent, 0.3, 0.1, 0.4, 0.4); box(ctx, c.tone[1], 0.1, 0.1, 0.17, 0.4); box(ctx, c.tone[1], 0.73, 0.1, 0.17, 0.4)
    box(ctx, c.tone[2], 0.3, 0.53, 0.4, 0.17); box(ctx, c.tone[3], 0.1, 0.73, 0.17, 0.17); box(ctx, c.tone[3], 0.73, 0.73, 0.17, 0.17)
  },

  // Logic
  sudoku: function(ctx, c) { grid(ctx, c.dim, 3, 0.1, 0.1, 0.8); text(ctx, c.fg, "5", 0.23, 0.23, 0.2, true); text(ctx, c.accent, "3", 0.5, 0.5, 0.2, true); text(ctx, c.fg, "9", 0.77, 0.77, 0.2, true) },
  nonogram: function(ctx, c) { var on = [0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0]; for (var i = 0; i < 12; ++i) if (on[i]) box(ctx, c.fg, 0.3 + (i % 4) * 0.15, 0.3 + Math.floor(i / 4) * 0.15, 0.13, 0.13); box(ctx, c.dim, 0.1, 0.3, 0.12, 0.43); box(ctx, c.dim, 0.3, 0.1, 0.58, 0.12) },
  "0hh1": function(ctx, c) { for (var i = 0; i < 9; ++i) box(ctx, [0, 3, 5, 7].indexOf(i) >= 0 ? c.tone[1] : c.tone[0], 0.12 + (i % 3) * 0.27, 0.12 + Math.floor(i / 3) * 0.27, 0.23, 0.23) },
  "0hn0": function(ctx, c) { for (var i = 0; i < 9; ++i) dot(ctx, i === 4 ? c.tone[0] : i % 2 ? c.tone[1] : c.tone[0], 0.22 + (i % 3) * 0.28, 0.22 + Math.floor(i / 3) * 0.28, 0.12); text(ctx, c.bg, "3", 0.5, 0.5, 0.16, true) },
  net: function(ctx, c) { line(ctx, c.tone[0], [0.2, 0.5, 0.8, 0.5], 0.08); line(ctx, c.tone[0], [0.5, 0.2, 0.5, 0.8], 0.08); box(ctx, c.fg, 0.4, 0.4, 0.2, 0.2); dot(ctx, c.tone[3], 0.2, 0.5, 0.07); dot(ctx, c.tone[3], 0.8, 0.5, 0.07) },
  bridges: function(ctx, c) {
    line(ctx, c.fg, [0.25, 0.25, 0.75, 0.25], 0.04); line(ctx, c.fg, [0.25, 0.25, 0.25, 0.75], 0.04); line(ctx, c.fg, [0.29, 0.25, 0.29, 0.75], 0.04)
    var isl = [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75]]
    for (var k = 0; k < 3; ++k) { dot(ctx, c.bg, isl[k][0], isl[k][1], 0.12); ring(ctx, c.accent, isl[k][0], isl[k][1], 0.12, 0.04) }
  },
  loopy: function(ctx, c) {
    for (var i = 0; i < 16; ++i) dot(ctx, c.dim, 0.15 + (i % 4) * 0.23, 0.15 + Math.floor(i / 4) * 0.23, 0.025)
    line(ctx, c.fg, [0.15, 0.15, 0.61, 0.15, 0.61, 0.38, 0.84, 0.38, 0.84, 0.84, 0.15, 0.84, 0.15, 0.15], 0.05)
    text(ctx, c.accent, "3", 0.27, 0.27, 0.16, true)
  },
  signpost: function(ctx, c) {
    grid(ctx, c.dim, 2, 0.1, 0.1, 0.8)
    line(ctx, c.fg, [0.22, 0.4, 0.4, 0.22], 0.05); line(ctx, c.fg, [0.3, 0.22, 0.4, 0.22, 0.4, 0.32], 0.05)
    text(ctx, c.accent, "1", 0.7, 0.3, 0.2, true); text(ctx, c.fg, "4", 0.3, 0.7, 0.2, true)
  },
  tents: function(ctx, c) { dot(ctx, c.tone[2], 0.3, 0.35, 0.16); box(ctx, c.dim, 0.28, 0.48, 0.05, 0.14); poly(ctx, c.tone[3], [0.68, 0.45, 0.88, 0.82, 0.48, 0.82]) },
  towers: function(ctx, c) { box(ctx, c.tone[0], 0.15, 0.5, 0.18, 0.35); box(ctx, c.tone[1], 0.41, 0.2, 0.18, 0.65); box(ctx, c.tone[2], 0.67, 0.38, 0.18, 0.47); text(ctx, c.fg, "2", 0.5, 0.08, 0.14, true) },
  keen: function(ctx, c) { grid(ctx, c.dim, 2, 0.1, 0.1, 0.8); line(ctx, c.fg, [0.1, 0.5, 0.5, 0.5, 0.5, 0.9], 0.05); text(ctx, c.fg, "6×", 0.3, 0.25, 0.16, true); text(ctx, c.accent, "3", 0.7, 0.7, 0.22, true) },
  lightup: function(ctx, c) { box(ctx, c.warm, 0.1, 0.4, 0.8, 0.2); box(ctx, c.warm, 0.4, 0.1, 0.2, 0.8); box(ctx, c.fg, 0.1, 0.1, 0.25, 0.25); text(ctx, c.bg, "1", 0.225, 0.225, 0.16, true); dot(ctx, c.bg, 0.5, 0.5, 0.08) },
  samegame: function(ctx, c) { var k = [0, 0, 1, 2, 0, 1, 1, 2, 3, 3, 1, 2]; for (var i = 0; i < 12; ++i) box(ctx, c.tone[k[i]], 0.1 + (i % 4) * 0.2, 0.3 + Math.floor(i / 4) * 0.2, 0.18, 0.18) },
  inertia: function(ctx, c) { ring(ctx, c.dim, 0.75, 0.25, 0.12, 0.04); poly(ctx, c.tone[2], [0.5, 0.3, 0.62, 0.5, 0.5, 0.7, 0.38, 0.5]); dot(ctx, c.accent, 0.2, 0.8, 0.1); line(ctx, c.dim, [0.25, 0.75, 0.7, 0.3], 0.03) },

  // Cards
  klondike: function(ctx, c) { card(ctx, c, 0.15, 0.15, 0.4, 0.55, "K", c.danger); card(ctx, c, 0.45, 0.3, 0.4, 0.55, "Q", c.fg) },
  freecell: function(ctx, c) { for (var i = 0; i < 4; ++i) line(ctx, c.dim, [0.08 + i * 0.22, 0.1, 0.26 + i * 0.22, 0.1, 0.26 + i * 0.22, 0.35, 0.08 + i * 0.22, 0.35, 0.08 + i * 0.22, 0.1], 0.03); card(ctx, c, 0.3, 0.45, 0.4, 0.5, "A", c.fg) },
  spider: function(ctx, c) { card(ctx, c, 0.3, 0.3, 0.4, 0.55, "♠", c.fg); for (var i = 0; i < 4; ++i) line(ctx, c.fg, [0.5, 0.2, 0.2 + i * 0.2, 0.05], 0.025) },
  blackjack: function(ctx, c) { card(ctx, c, 0.12, 0.2, 0.4, 0.55, "A", c.fg); card(ctx, c, 0.45, 0.3, 0.4, 0.55, "J", c.danger) },
  videopoker: function(ctx, c) { for (var i = 0; i < 5; ++i) card(ctx, c, 0.05 + i * 0.18, 0.3, 0.2, 0.4, "", c.fg); text(ctx, c.danger, "♥", 0.14, 0.5, 0.2, true) },

  // Board
  reversi: function(ctx, c) { grid(ctx, c.dim, 2, 0.1, 0.1, 0.8); dot(ctx, c.fg, 0.3, 0.3, 0.15); dot(ctx, c.fg, 0.7, 0.7, 0.15); ring(ctx, c.fg, 0.7, 0.3, 0.15, 0.04); ring(ctx, c.fg, 0.3, 0.7, 0.15, 0.04) },
  codebreaker: function(ctx, c) { for (var i = 0; i < 4; ++i) dot(ctx, c.tone[i], 0.17 + i * 0.22, 0.4, 0.09); dot(ctx, c.fg, 0.4, 0.7, 0.04); dot(ctx, c.fg, 0.5, 0.7, 0.04); ring(ctx, c.fg, 0.6, 0.7, 0.04, 0.02) },
  yacht: function(ctx, c) { die(ctx, c, 0.1, 0.15, 0.4, 6); die(ctx, c, 0.5, 0.45, 0.4, 6) },
  greed: function(ctx, c) { die(ctx, c, 0.08, 0.3, 0.26, 1, c.tone[3]); die(ctx, c, 0.37, 0.3, 0.26, 5, c.tone[3]); die(ctx, c, 0.66, 0.3, 0.26, 1, c.tone[3]); text(ctx, c.accent, "+", 0.5, 0.8, 0.3, true) },
  mahjong: function(ctx, c) { box(ctx, c.dim, 0.28, 0.18, 0.44, 0.6); box(ctx, c.fg, 0.22, 0.24, 0.44, 0.6); box(ctx, c.bg, 0.25, 0.27, 0.38, 0.54); text(ctx, c.danger, "中", 0.44, 0.54, 0.34, true) },
  shisen: function(ctx, c) { box(ctx, c.fg, 0.1, 0.4, 0.25, 0.35); box(ctx, c.fg, 0.65, 0.4, 0.25, 0.35); line(ctx, c.accent, [0.22, 0.4, 0.22, 0.15, 0.78, 0.15, 0.78, 0.4], 0.05); text(ctx, c.bg, "竹", 0.225, 0.58, 0.16, true); text(ctx, c.bg, "竹", 0.775, 0.58, 0.16, true) },
  zenclassic: function(ctx, c) { poly(ctx, c.tone[3], [0.3, 0.1, 0.5, 0.45, 0.1, 0.45]); box(ctx, c.tone[0], 0.55, 0.12, 0.33, 0.33); dot(ctx, c.tone[1], 0.3, 0.72, 0.17); poly(ctx, c.tone[2], [0.72, 0.55, 0.9, 0.72, 0.72, 0.9, 0.54, 0.72]); box(ctx, c.fg, 0.08, 0.93, 0.84, 0.05) },
  zengeometry: function(ctx, c) { poly(ctx, c.tone[0], [0.3, 0.1, 0.5, 0.45, 0.1, 0.45]); box(ctx, c.tone[1], 0.55, 0.12, 0.33, 0.33); dot(ctx, c.tone[2], 0.3, 0.72, 0.17); poly(ctx, c.tone[3], [0.72, 0.55, 0.9, 0.72, 0.72, 0.9, 0.54, 0.72]) },
  fourinarow: function(ctx, c) { for (var i = 0; i < 4; ++i) dot(ctx, c.accent, 0.2 + i * 0.2, 0.8 - i * 0.2, 0.09); dot(ctx, c.tone[1], 0.4, 0.8, 0.09); dot(ctx, c.tone[1], 0.6, 0.8, 0.09); dot(ctx, c.tone[1], 0.6, 0.6, 0.09) },
  checkers: function(ctx, c) { for (var i = 0; i < 16; ++i) if ((i + Math.floor(i / 4)) % 2) box(ctx, c.dim, 0.1 + (i % 4) * 0.2, 0.1 + Math.floor(i / 4) * 0.2, 0.2, 0.2); dot(ctx, c.accent, 0.4, 0.6, 0.08); dot(ctx, c.tone[1], 0.6, 0.4, 0.08) },
  dotsboxes: function(ctx, c) { box(ctx, c.soft, 0.2, 0.2, 0.3, 0.3); for (var i = 0; i < 9; ++i) dot(ctx, c.fg, 0.2 + (i % 3) * 0.3, 0.2 + Math.floor(i / 3) * 0.3, 0.04); line(ctx, c.accent, [0.2, 0.2, 0.5, 0.2, 0.5, 0.5, 0.2, 0.5, 0.2, 0.2], 0.04); line(ctx, c.tone[1], [0.5, 0.5, 0.8, 0.5], 0.04) },

  // Quiz
  trivia: function(ctx, c) { dot(ctx, c.accent, 0.5, 0.5, 0.36); text(ctx, c.bg, "?", 0.5, 0.52, 0.5, true) },
  wangernumb: function(ctx, c) { ctx.save(); ctx.translate(0.5, 0.5); ctx.rotate(0.35); ctx.translate(-0.5, -0.5); box(ctx, c.soft, 0.16, 0.16, 0.68, 0.68); text(ctx, c.accent, "7", 0.5, 0.52, 0.6, true); ctx.restore(); dot(ctx, c.tone[3], 0.82, 0.2, 0.07) },
  fiveletters: function(ctx, c) { var cols = [c.accent, c.dim, c.tone[3], c.dim, c.accent]; for (var i = 0; i < 5; ++i) box(ctx, cols[i], 0.04 + i * 0.19, 0.38, 0.16, 0.22) },

  // Added 2026-09-29 (second batch)
  centipede: function(ctx, c) {
    for (var i = 0; i < 5; ++i) dot(ctx, i === 4 ? c.tone[0] : c.tone[2], 0.14 + i * 0.16, 0.3, 0.085)
    poly(ctx, c.tone[1], [0.2, 0.62, 0.36, 0.62, 0.28, 0.52]); box(ctx, c.tone[1], 0.26, 0.62, 0.04, 0.08)
    poly(ctx, c.accent, [0.62, 0.72, 0.72, 0.92, 0.52, 0.92]); box(ctx, c.fg, 0.61, 0.5, 0.02, 0.14)
  },
  swarm: function(ctx, c) {
    dot(ctx, c.soft, 0.36, 0.3, 0.1); dot(ctx, c.soft, 0.64, 0.3, 0.1); dot(ctx, c.tone[4], 0.5, 0.32, 0.1)
    dot(ctx, c.warm, 0.18, 0.5, 0.06); dot(ctx, c.tone[3], 0.18, 0.5, 0.045); dot(ctx, c.warm, 0.82, 0.5, 0.06); dot(ctx, c.tone[3], 0.82, 0.5, 0.045)
    poly(ctx, c.accent, [0.5, 0.66, 0.6, 0.9, 0.5, 0.84, 0.4, 0.9])
  },
  tempest: function(ctx, c) {
    var o = [], n = [], k
    for (k = 0; k <= 8; ++k) { var a = -Math.PI / 2 + k / 8 * Math.PI * 2; o.push(0.5 + Math.cos(a) * 0.42, 0.5 + Math.sin(a) * 0.42); n.push(0.5 + Math.cos(a) * 0.1, 0.5 + Math.sin(a) * 0.1) }
    line(ctx, c.tone[0], o, 0.04); line(ctx, c.soft, n, 0.03)
    for (k = 0; k < 8; ++k) line(ctx, c.soft, [o[k * 2], o[k * 2 + 1], n[k * 2], n[k * 2 + 1]], 0.02)
    line(ctx, c.accent, [0.36, 0.9, 0.5, 0.97, 0.64, 0.9], 0.06); line(ctx, c.tone[1], [0.62, 0.38, 0.72, 0.3], 0.05)
  },
  cubehop: function(ctx, c) {
    function cube(x, y, s, top) {
      poly(ctx, top, [x, y - s * 0.5, x + s, y, x, y + s * 0.5, x - s, y])
      poly(ctx, c.dim, [x - s, y, x, y + s * 0.5, x, y + s * 1.1, x - s, y + s * 0.6])
      poly(ctx, c.soft, [x + s, y, x, y + s * 0.5, x, y + s * 1.1, x + s, y + s * 0.6])
    }
    cube(0.5, 0.3, 0.2, c.accent); cube(0.3, 0.6, 0.2, c.tone[1]); cube(0.7, 0.6, 0.2, c.accent)
    dot(ctx, c.tone[3], 0.5, 0.2, 0.08)
  },
  digger: function(ctx, c) {
    box(ctx, c.warm, 0.05, 0.25, 0.9, 0.7); box(ctx, c.bg, 0.15, 0.45, 0.7, 0.2); box(ctx, c.bg, 0.15, 0.25, 0.2, 0.4)
    dot(ctx, c.fg, 0.25, 0.55, 0.1); line(ctx, c.fg, [0.33, 0.55, 0.56, 0.55], 0.04); dot(ctx, c.tone[1], 0.7, 0.55, 0.15)
  },
  catapult: function(ctx, c) {
    box(ctx, c.soft, 0, 0.88, 1, 0.12); line(ctx, c.fg, [0.2, 0.88, 0.2, 0.62, 0.12, 0.5, 0.2, 0.62, 0.28, 0.5], 0.05)
    box(ctx, c.tone[3], 0.62, 0.52, 0.08, 0.36); box(ctx, c.tone[3], 0.84, 0.52, 0.08, 0.36); box(ctx, c.dim, 0.58, 0.44, 0.38, 0.08)
    dot(ctx, c.danger, 0.77, 0.8, 0.07); dot(ctx, c.accent, 0.42, 0.3, 0.07); line(ctx, c.dim, [0.2, 0.5, 0.3, 0.32], 0.02)
  },
  deepwell: function(ctx, c) {
    box(ctx, c.dim, 0.08, 0, 0.12, 1); box(ctx, c.dim, 0.8, 0, 0.12, 1); box(ctx, c.soft, 0.2, 0.7, 0.3, 0.1)
    box(ctx, c.fg, 0.44, 0.2, 0.12, 0.12); box(ctx, c.accent, 0.42, 0.32, 0.07, 0.1); box(ctx, c.accent, 0.51, 0.32, 0.07, 0.1)
    box(ctx, c.tone[3], 0.48, 0.48, 0.04, 0.1); box(ctx, c.tone[3], 0.48, 0.64, 0.04, 0.1); dot(ctx, c.tone[4], 0.65, 0.85, 0.07)
  },
  grapple: function(ctx, c) {
    box(ctx, c.soft, 0, 0, 1, 0.18); line(ctx, c.fg, [0.66, 0.18, 0.36, 0.62], 0.03); dot(ctx, c.fg, 0.66, 0.18, 0.035)
    dot(ctx, c.accent, 0.36, 0.64, 0.09); dot(ctx, c.tone[3], 0.8, 0.55, 0.05)
    poly(ctx, c.danger, [0.6, 1, 0.7, 0.8, 0.8, 1])
  },
  artillery: function(ctx, c) {
    poly(ctx, c.soft, [0, 1, 0, 0.7, 0.25, 0.6, 0.5, 0.72, 0.75, 0.58, 1, 0.68, 1, 1])
    dot(ctx, c.accent, 0.22, 0.54, 0.07); dot(ctx, c.danger, 0.78, 0.52, 0.07)
    line(ctx, c.dim, [0.28, 0.46, 0.4, 0.22, 0.52, 0.2], 0.025); dot(ctx, c.fg, 0.55, 0.22, 0.04)
  },
  pinball: function(ctx, c) {
    ring(ctx, c.dim, 0.5, 0.5, 0.44, 0.04); dot(ctx, c.tone[0], 0.35, 0.35, 0.09); dot(ctx, c.tone[0], 0.65, 0.35, 0.09)
    line(ctx, c.accent, [0.22, 0.72, 0.42, 0.82], 0.07); line(ctx, c.accent, [0.78, 0.72, 0.58, 0.82], 0.07); dot(ctx, c.fg, 0.52, 0.58, 0.06)
  },
  minigolf: function(ctx, c) {
    box(ctx, c.soft, 0.08, 0.3, 0.84, 0.5); dot(ctx, c.fg, 0.75, 0.6, 0.06); line(ctx, c.fg, [0.75, 0.6, 0.75, 0.15], 0.025)
    poly(ctx, c.danger, [0.75, 0.15, 0.92, 0.22, 0.75, 0.29]); dot(ctx, c.accent, 0.25, 0.6, 0.05)
  },
  scratch: function(ctx, c) {
    box(ctx, c.soft, 0.1, 0.1, 0.8, 0.8)
    for (var i = 0; i < 9; ++i) box(ctx, i < 4 ? c.dim : c.bg, 0.17 + (i % 3) * 0.23, 0.2 + Math.floor(i / 3) * 0.23, 0.2, 0.2)
    text(ctx, c.tone[4], "7", 0.5, 0.53, 0.16, true); text(ctx, c.tone[4], "7", 0.73, 0.53, 0.16, true); text(ctx, c.tone[4], "7", 0.27, 0.76, 0.16, true)
  },
  crazyeights: function(ctx, c) { card(ctx, c, 0.12, 0.2, 0.4, 0.55, "8", c.danger); card(ctx, c, 0.45, 0.3, 0.4, 0.55, "8", c.fg) },
  knucklebones: function(ctx, c) {
    die(ctx, c, 0.1, 0.1, 0.24, 4, c.tone[0]); die(ctx, c, 0.1, 0.38, 0.24, 4, c.tone[0]); die(ctx, c, 0.66, 0.1, 0.24, 2)
    die(ctx, c, 0.38, 0.62, 0.24, 6, c.tone[1]); die(ctx, c, 0.66, 0.62, 0.24, 6, c.tone[1])
  },
  pipeline: function(ctx, c) {
    line(ctx, c.fg, [0.1, 0.3, 0.6, 0.3, 0.6, 0.9], 0.16); line(ctx, c.bg, [0.1, 0.3, 0.6, 0.3, 0.6, 0.9], 0.07)
    line(ctx, c.accent, [0.1, 0.3, 0.6, 0.3, 0.6, 0.5], 0.07); dot(ctx, c.fg, 0.12, 0.3, 0.1)
  },
  empire: function(ctx, c) {
    function hex(x, y, col) {
      var p = []
      for (var k = 0; k < 6; ++k) { var a = Math.PI / 180 * (60 * k - 30); p.push(x + 0.17 * Math.cos(a), y + 0.17 * Math.sin(a)) }
      poly(ctx, col, p)
    }
    hex(0.33, 0.3, c.accent); hex(0.63, 0.3, c.soft); hex(0.18, 0.56, c.accent); hex(0.48, 0.56, c.accent)
    hex(0.78, 0.56, c.danger); hex(0.33, 0.82, c.soft); hex(0.63, 0.82, c.danger)
    text(ctx, c.bg, "★", 0.33, 0.3, 0.16, true)
  },
  chainburst: function(ctx, c) {
    dot(ctx, c.soft, 0.4, 0.45, 0.26); dot(ctx, c.warm, 0.68, 0.62, 0.18)
    dot(ctx, c.tone[0], 0.4, 0.45, 0.06); dot(ctx, c.tone[3], 0.68, 0.62, 0.05)
    dot(ctx, c.tone[2], 0.82, 0.25, 0.05); dot(ctx, c.tone[4], 0.15, 0.82, 0.05); dot(ctx, c.tone[1], 0.85, 0.88, 0.05)
  },
  bigfish: function(ctx, c) {
    function fish(x, y, r, col) { dot(ctx, col, x, y, r); poly(ctx, col, [x - r * 0.8, y, x - r * 1.7, y - r * 0.7, x - r * 1.7, y + r * 0.7]) }
    fish(0.62, 0.45, 0.22, c.accent); dot(ctx, c.bg, 0.72, 0.4, 0.035)
    fish(0.3, 0.78, 0.08, c.tone[2]); fish(0.9, 0.85, 0.06, c.tone[2])
  },
  cuberun: function(ctx, c) {
    box(ctx, c.soft, 0, 0.62, 1, 0.38)
    box(ctx, c.tone[0], 0.12, 0.42, 0.22, 0.22); box(ctx, c.tone[1], 0.62, 0.3, 0.3, 0.32); box(ctx, c.tone[2], 0.46, 0.5, 0.08, 0.08)
    poly(ctx, c.accent, [0.5, 0.72, 0.64, 0.9, 0.5, 0.85, 0.36, 0.9])
  },
  pitfall: function(ctx, c) {
    box(ctx, c.dim, 0.05, 0.62, 0.9, 0.04); box(ctx, c.tone[2], 0.05, 0.66, 0.9, 0.2)
    box(ctx, c.bg, 0.45, 0.62, 0.3, 0.24)
    line(ctx, c.tone[4], [0.6, 0.05, 0.6, 0.3, 0.72, 0.5], 0.05)
    dot(ctx, c.tone[4], 0.72, 0.5, 0.05)
    box(ctx, c.fg, 0.16, 0.36, 0.1, 0.1); box(ctx, c.fg, 0.15, 0.46, 0.12, 0.16)
  },
  kittylaunch: function(ctx, c) {
    box(ctx, c.soft, 0, 0.86, 1, 0.14); line(ctx, c.fg, [0.12, 0.8, 0.3, 0.62], 0.12)
    line(ctx, c.dim, [0.3, 0.55, 0.45, 0.35, 0.58, 0.28], 0.02)
    dot(ctx, c.tone[3], 0.68, 0.3, 0.12); poly(ctx, c.tone[3], [0.58, 0.24, 0.6, 0.1, 0.68, 0.19]); poly(ctx, c.tone[3], [0.78, 0.24, 0.76, 0.1, 0.68, 0.19])
    box(ctx, c.danger, 0.8, 0.72, 0.14, 0.14)
  },
  rollblock: function(ctx, c) {
    for (var i = 0; i < 6; ++i) box(ctx, c.soft, 0.08 + (i % 3) * 0.28, 0.55 + Math.floor(i / 3) * 0.2, 0.26, 0.18)
    box(ctx, c.bg, 0.64, 0.75, 0.26, 0.18); box(ctx, c.dim, 0.67, 0.78, 0.2, 0.12)
    box(ctx, c.accent, 0.36, 0.15, 0.26, 0.4); box(ctx, c.soft, 0.36, 0.55, 0.26, 0.1)
  },
  // Added 2026-09-30.
  airhockey: function(ctx, c) {
    ctx.strokeStyle = c.dim; ctx.lineWidth = 0.05; ctx.strokeRect(0.06, 0.18, 0.88, 0.64)
    line(ctx, c.dim, [0.5, 0.18, 0.5, 0.82], 0.03)
    dot(ctx, c.fg, 0.24, 0.5, 0.11); dot(ctx, c.bg, 0.24, 0.5, 0.05)
    dot(ctx, c.accent, 0.76, 0.5, 0.11); dot(ctx, c.bg, 0.76, 0.5, 0.05)
    dot(ctx, c.tone[3], 0.5, 0.5, 0.05)
  },
  foosball: function(ctx, c) {
    box(ctx, c.soft, 0.06, 0.16, 0.88, 0.68)
    for (var i = 0; i < 4; ++i) {
      var x = 0.2 + i * 0.2
      line(ctx, c.dim, [x, 0.12, x, 0.88], 0.03)
      box(ctx, i % 2 ? c.accent : c.fg, x - 0.04, 0.3 + (i % 2) * 0.1, 0.08, 0.13)
      box(ctx, i % 2 ? c.accent : c.fg, x - 0.04, 0.58 - (i % 2) * 0.05, 0.08, 0.13)
    }
    dot(ctx, c.tone[3], 0.5, 0.5, 0.05)
  },
  bingo: function(ctx, c) {
    grid(ctx, c.dim, 3, 0.08, 0.08, 0.6)
    dot(ctx, c.accent, 0.18, 0.18, 0.06); dot(ctx, c.accent, 0.38, 0.38, 0.06); dot(ctx, c.accent, 0.58, 0.58, 0.06)
    dot(ctx, c.tone[3], 0.74, 0.7, 0.19); text(ctx, c.bg, "B7", 0.74, 0.7, 0.16, true)
  },
  roadrally: function(ctx, c) {
    box(ctx, c.soft, 0, 0, 1, 1)
    poly(ctx, c.dim, [0.22, 0, 0.78, 0, 0.92, 1, 0.08, 1])
    line(ctx, c.fg, [0.22, 0, 0.08, 1], 0.04); line(ctx, c.fg, [0.78, 0, 0.92, 1], 0.04)
    line(ctx, c.fg, [0.5, 0.05, 0.5, 0.2], 0.04); line(ctx, c.fg, [0.5, 0.36, 0.5, 0.5], 0.04)
    box(ctx, c.tone[1], 0.56, 0.2, 0.15, 0.26); box(ctx, c.bg, 0.59, 0.25, 0.09, 0.06)
    box(ctx, c.accent, 0.3, 0.52, 0.2, 0.34); box(ctx, c.bg, 0.33, 0.6, 0.14, 0.07); box(ctx, c.fg, 0.38, 0.52, 0.04, 0.34)
    box(ctx, c.bg, 0.26, 0.56, 0.05, 0.1); box(ctx, c.bg, 0.49, 0.56, 0.05, 0.1)
    box(ctx, c.bg, 0.26, 0.74, 0.05, 0.1); box(ctx, c.bg, 0.49, 0.74, 0.05, 0.1)
  },
  sunlane: function(ctx, c) {
    box(ctx, c.soft, 0, 0.5, 1, 0.5)
    line(ctx, c.dim, [0.5, 0.5, 0.05, 1], 0.03); line(ctx, c.dim, [0.5, 0.5, 0.95, 1], 0.03); line(ctx, c.dim, [0.5, 0.5, 0.5, 1], 0.03)
    line(ctx, c.dim, [0.1, 0.62, 0.9, 0.62], 0.03); line(ctx, c.dim, [0.02, 0.8, 0.98, 0.8], 0.03)
    dot(ctx, c.tone[1], 0.5, 0.46, 0.12)
    poly(ctx, c.fg, [0.5, 0.42, 0.62, 0.7, 0.5, 0.64, 0.38, 0.7])
    dot(ctx, c.danger, 0.22, 0.32, 0.06); dot(ctx, c.danger, 0.8, 0.24, 0.05)
  },
  triples: function(ctx, c) {
    box(ctx, c.tone[3], 0.06, 0.34, 0.26, 0.32); text(ctx, c.bg, "1", 0.19, 0.5, 0.24, true)
    box(ctx, c.tone[1], 0.37, 0.34, 0.26, 0.32); text(ctx, c.bg, "2", 0.5, 0.5, 0.24, true)
    box(ctx, c.accent, 0.68, 0.34, 0.26, 0.32); text(ctx, c.bg, "3", 0.81, 0.5, 0.24, true)
  },
  hitori: function(ctx, c) {
    grid(ctx, c.dim, 3, 0.1, 0.1, 0.8)
    var cell = 0.8 / 3
    box(ctx, c.fg, 0.1, 0.1 + cell, cell, cell); box(ctx, c.fg, 0.1 + cell * 2, 0.1, cell, cell); box(ctx, c.fg, 0.1 + cell, 0.1 + cell * 2, cell, cell)
    text(ctx, c.accent, "4", 0.5, 0.5, 0.22, true); text(ctx, c.fg, "2", 0.23, 0.23, 0.2, true); text(ctx, c.fg, "3", 0.77, 0.77, 0.2, true)
  },
  fillomino: function(ctx, c) {
    grid(ctx, c.dim, 3, 0.1, 0.1, 0.8)
    var cell = 0.8 / 3
    box(ctx, c.soft, 0.1, 0.1, cell * 2, cell); box(ctx, c.soft, 0.1 + cell * 2, 0.1 + cell, cell, cell * 2)
    text(ctx, c.fg, "2", 0.1 + cell * 0.5, 0.1 + cell * 0.5, 0.22, true); text(ctx, c.fg, "2", 0.1 + cell * 1.5, 0.1 + cell * 0.5, 0.22, true)
    text(ctx, c.accent, "3", 0.1 + cell * 2.5, 0.1 + cell * 1.5, 0.22, true); text(ctx, c.accent, "3", 0.1 + cell * 2.5, 0.1 + cell * 2.5, 0.22, true)
    text(ctx, c.fg, "1", 0.1 + cell * 0.5, 0.1 + cell * 2.5, 0.22, true)
  },
  numberlink: function(ctx, c) {
    grid(ctx, c.dim, 3, 0.1, 0.1, 0.8)
    line(ctx, c.tone[0], [0.23, 0.23, 0.5, 0.23, 0.5, 0.5], 0.1); line(ctx, c.tone[1], [0.77, 0.23, 0.77, 0.77, 0.5, 0.77], 0.1)
    dot(ctx, c.tone[0], 0.23, 0.23, 0.09); dot(ctx, c.tone[0], 0.5, 0.5, 0.09)
    dot(ctx, c.tone[1], 0.77, 0.23, 0.09); dot(ctx, c.tone[1], 0.5, 0.77, 0.09)
  },
  mancala: function(ctx, c) {
    box(ctx, c.soft, 0.04, 0.22, 0.92, 0.56)
    for (var i = 0; i < 4; ++i) { dot(ctx, c.bg, 0.22 + i * 0.185, 0.36, 0.07); dot(ctx, c.bg, 0.22 + i * 0.185, 0.64, 0.07) }
    box(ctx, c.bg, 0.06, 0.28, 0.1, 0.44); box(ctx, c.bg, 0.84, 0.28, 0.1, 0.44)
    dot(ctx, c.accent, 0.22, 0.64, 0.035); dot(ctx, c.tone[1], 0.405, 0.64, 0.035); dot(ctx, c.tone[3], 0.59, 0.36, 0.035); dot(ctx, c.accent, 0.89, 0.5, 0.035)
  },
  wordhunt: function(ctx, c) {
    grid(ctx, c.dim, 3, 0.1, 0.1, 0.8)
    var cell = 0.8 / 3, L = ["W", "O", "R", "D", "H", "U", "N", "T", "S"]
    for (var i = 0; i < 9; ++i) text(ctx, [0, 1, 5, 8].indexOf(i) >= 0 ? c.accent : c.fg, L[i], 0.1 + (i % 3 + 0.5) * cell, 0.1 + (Math.floor(i / 3) + 0.5) * cell, 0.2, true)
    line(ctx, c.accent, [0.1 + cell * 0.5, 0.1 + cell * 0.5, 0.1 + cell * 1.5, 0.1 + cell * 0.5, 0.1 + cell * 2.5, 0.1 + cell * 1.5, 0.1 + cell * 2.5, 0.1 + cell * 2.5], 0.035)
  }
}
