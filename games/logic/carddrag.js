.pragma library

// Mouse dragging shared by the solitaire tables (Klondike, FreeCell,
// Spider). A press on a card picks it up as usual and starts a drag record;
// once the pointer has moved a few pixels the picked cards follow it, and
// on release they go to whichever pile the top card overlaps most. A press
// that never moves stays a plain click, so click-to-pick / click-to-drop
// keeps working.
//
// The record: { sel, again, x0, y0, x, y, ox, oy, moved }. `sel` is the
// game's own selection, `again` whether that card was already picked up
// before this press (a second click on it is the smart move), (ox, oy)
// where on the top card it was grabbed.

var THRESHOLD = 5

// A press below a column's last card still picks that card up; the grab
// point is kept on the card so it stays under the pointer.
function begin(sel, again, x, y, cardRect) {
  var r = cardRect || { x: x, y: y, w: 0, h: 0 }
  return { sel: sel, again: again, x0: x, y0: y, x: x, y: y,
    ox: Math.max(0, Math.min(r.w, x - r.x)), oy: Math.max(0, Math.min(r.h * 0.8, y - r.y)), moved: false }
}

function update(d, x, y) {
  var moved = d.moved || Math.abs(x - d.x0) > THRESHOLD || Math.abs(y - d.y0) > THRESHOLD
  return { sel: d.sel, again: d.again, x0: d.x0, y0: d.y0, x: x, y: y, ox: d.ox, oy: d.oy, moved: moved }
}

// Where the dragged top card is now.
function rect(d, w, h) { return { x: d.x - d.ox, y: d.y - d.oy, w: w, h: h } }

function overlap(a, b) {
  var w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  var h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  return w > 0 && h > 0 ? w * h : 0
}

// targets: [{ spot, rect }]. The spot whose rect the card covers most, or
// null if it's over none of them.
function bestTarget(targets, r) {
  var best = null, area = 0
  for (var i = 0; i < targets.length; ++i) {
    var a = overlap(targets[i].rect, r)
    if (a > area) { area = a; best = targets[i].spot }
  }
  return best
}

// Draws the carried cards fanned down from r, with a soft shadow so they
// read as lifted off the table. drawCard(ctx, rect, card, visibleH).
function drawCarried(ctx, theme, cards, r, step, drawCard) {
  var h = r.h + step * (cards.length - 1)
  ctx.fillStyle = theme.withAlpha(theme.foreground, 0.15)
  ctx.fillRect(r.x + 4, r.y + 5, r.w, h)
  for (var i = 0; i < cards.length; ++i)
    drawCard(ctx, { x: r.x, y: r.y + i * step, w: r.w, h: r.h }, cards[i], i + 1 < cards.length ? step : undefined)
}
