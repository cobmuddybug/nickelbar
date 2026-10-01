.pragma library

// Card drawing shared by the card games (and their on-screen buttons). Pure Canvas-2D
// calls; every colour comes in through `theme` (an engine/Theme instance),
// so both tables repaint with the active theme and look the same.

var SUIT_GLYPH = { S: "♠", H: "♥", D: "♦", C: "♣" }
var RANK_NAMES = { 1: "A", 11: "J", 12: "Q", 13: "K" }

function rankName(rank) { return RANK_NAMES[rank] || String(rank) }
function suitGlyph(suit) { return SUIT_GLYPH[suit] || "" }
function isRed(suit) { return suit === "H" || suit === "D" }
function label(card) { return rankName(card.rank) + suitGlyph(card.suit) }

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function radius(r) { return Math.max(2, Math.min(r.w, r.h) * 0.07) }

function placeholder(ctx, theme, r, glyph) {
  roundRect(ctx, r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, radius(r))
  ctx.strokeStyle = theme.faint
  ctx.lineWidth = 1
  ctx.stroke()
  if (!glyph) return
  ctx.fillStyle = theme.faint
  ctx.font = Math.floor(r.w * 0.42) + "px " + theme.fontFamily
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(glyph, r.x + r.w / 2, r.y + r.h / 2)
}

// Which card back is drawn: 0 standard, or a prize (1 lattice, 2 stripes, 3 gold).
// The overlay sets it from the player's equipped prize.
var BACK = 0
function setBack(i) { BACK = i || 0 }

function back(ctx, theme, r) {
  roundRect(ctx, r.x, r.y, r.w, r.h, radius(r))
  ctx.fillStyle = theme.background
  ctx.fill()
  roundRect(ctx, r.x, r.y, r.w, r.h, radius(r))
  ctx.fillStyle = theme.withAlpha(theme.accent, 0.28)
  ctx.fill()
  ctx.strokeStyle = theme.withAlpha(theme.accent, 0.7)
  ctx.lineWidth = 1
  ctx.stroke()
  // Inset frame so a back never reads as a blank face.
  var m = Math.max(3, r.w * 0.1)
  roundRect(ctx, r.x + m, r.y + m, r.w - m * 2, r.h - m * 2, radius(r) * 0.6)
  ctx.strokeStyle = theme.withAlpha(theme.accent, 0.45)
  ctx.stroke()
  // Prize patterns, clipped to the inset frame.
  if (BACK > 0) {
    ctx.save()
    roundRect(ctx, r.x + m, r.y + m, r.w - m * 2, r.h - m * 2, radius(r) * 0.6)
    ctx.clip()
    var col = BACK === 3 ? theme.highlight : theme.accent, step = Math.max(5, r.w * 0.16)
    ctx.strokeStyle = theme.withAlpha(col, BACK === 3 ? 0.55 : 0.4); ctx.lineWidth = 1
    ctx.beginPath()
    if (BACK === 1) {                       // lattice of diamonds
      for (var i = -r.h; i < r.w + r.h; i += step) { ctx.moveTo(r.x + i, r.y); ctx.lineTo(r.x + i + r.h, r.y + r.h); ctx.moveTo(r.x + i + r.h, r.y); ctx.lineTo(r.x + i, r.y + r.h) }
    } else if (BACK === 2) {                // stripes
      for (var j = 0; j < r.w; j += step * 0.7) { ctx.moveTo(r.x + j, r.y); ctx.lineTo(r.x + j, r.y + r.h) }
    } else {                                // gold: a double lattice and a centre medallion
      for (var q = -r.h; q < r.w + r.h; q += step * 1.2) { ctx.moveTo(r.x + q, r.y); ctx.lineTo(r.x + q + r.h, r.y + r.h) }
      ctx.arc(r.x + r.w / 2, r.y + r.h / 2, Math.min(r.w, r.h) * 0.2, 0, Math.PI * 2)
    }
    ctx.stroke()
    ctx.restore()
  }
}

// `visibleH` is how much of the card shows under the next one in a fan —
// the corner index sits in that strip so a squeezed column stays legible.
function face(ctx, theme, r, card, visibleH) {
  roundRect(ctx, r.x, r.y, r.w, r.h, radius(r))
  ctx.fillStyle = theme.background
  ctx.fill()
  roundRect(ctx, r.x, r.y, r.w, r.h, radius(r))
  ctx.fillStyle = theme.withAlpha(theme.foreground, 0.1)
  ctx.fill()
  ctx.strokeStyle = theme.withAlpha(theme.foreground, 0.4)
  ctx.lineWidth = 1
  ctx.stroke()

  var red = isRed(card.suit)
  ctx.fillStyle = red ? theme.danger : theme.foreground
  var strip = visibleH === undefined ? r.h : visibleH
  var fs = Math.max(9, Math.floor(Math.min(r.w * 0.3, strip * 0.78, r.h * 0.2)))
  ctx.font = "bold " + fs + "px " + theme.fontFamily
  ctx.textAlign = "left"
  ctx.textBaseline = "top"
  ctx.fillText(label(card), r.x + r.w * 0.08, r.y + Math.max(1, (Math.min(strip, fs * 1.3) - fs) / 2))

  if (visibleH === undefined || visibleH >= r.h * 0.6) {
    ctx.font = Math.floor(r.w * 0.46) + "px " + theme.fontFamily
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(suitGlyph(card.suit), r.x + r.w / 2, r.y + r.h * 0.6)
  }
}

function outline(ctx, color, r, width) {
  roundRect(ctx, r.x - 1, r.y - 1, r.w + 2, r.h + 2, radius(r) + 1)
  ctx.strokeStyle = color
  ctx.lineWidth = width || 2
  ctx.stroke()
}

// An on-screen button for mouse play, recorded into `hits` (an array the
// game hit-tests against) when enabled. `hot` is the hover highlight.
function button(ctx, theme, r, text, enabled, hot, act, hits) {
  roundRect(ctx, r.x, r.y, r.w, r.h, Math.min(r.h / 2, 8))
  ctx.fillStyle = !enabled ? theme.withAlpha(theme.foreground, 0.04)
    : hot ? theme.withAlpha(theme.accent, 0.35) : theme.withAlpha(theme.accent, 0.16)
  ctx.fill()
  ctx.strokeStyle = enabled ? theme.withAlpha(theme.accent, hot ? 0.95 : 0.6) : theme.faint
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.fillStyle = enabled ? theme.foreground : theme.faint
  ctx.font = "bold " + Math.floor(r.h * 0.42) + "px " + theme.fontFamily
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(text, r.x + r.w / 2, r.y + r.h / 2 + 1)
  if (enabled && hits) hits.push({ x: r.x, y: r.y, w: r.w, h: r.h, act: act })
}

// A row of buttons centred on cx: items [{ text, enabled, act }].
function buttonRow(ctx, theme, cx, y, w, h, gap, items, hot, hits) {
  var x = cx - (items.length * w + (items.length - 1) * gap) / 2
  for (var i = 0; i < items.length; ++i) {
    var r = { x: x + i * (w + gap), y: y, w: w, h: h }
    button(ctx, theme, r, items[i].text, items[i].enabled !== false, hot === items[i].act, items[i].act, hits)
  }
}

// The recorded hit under (x, y), or null.
function hitAt(hits, x, y) {
  for (var i = 0; i < hits.length; ++i) {
    var h = hits[i]
    if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h
  }
  return null
}

// Fans a column into `avail` pixels: face-down cards get a tight step,
// face-up cards a roomier one, both squeezed proportionally when a long
// column would otherwise run off the bottom of the board.
function fanSteps(cards, cardH, avail) {
  var down = 0, up = 0
  for (var i = 0; i < cards.length - 1; ++i) { if (cards[i].faceUp === false) down++; else up++ }
  var downStep = cardH * 0.12, upStep = cardH * 0.26
  var need = down * downStep + up * upStep
  var room = Math.max(0, avail - cardH)
  if (need > room && need > 0) {
    var k = room / need
    downStep *= k; upStep *= k
  }
  return { down: downStep, up: upStep }
}

// Y offsets for every card in a fanned column.
function fanOffsets(cards, cardH, avail) {
  var steps = fanSteps(cards, cardH, avail)
  var out = [], y = 0
  for (var i = 0; i < cards.length; ++i) {
    out.push(y)
    y += cards[i].faceUp === false ? steps.down : steps.up
  }
  return out
}
