import QtQuick
import "../engine" as Engine
import "logic/freecell.js" as FreeCell
import "logic/cardart.js" as CardArt
import "logic/carddrag.js" as CardDrag

// FreeCell with supermoves and safe auto-play (see freecell.js). Same
// two-row cursor as Klondike: cells and foundations on top, tableau below.
Engine.GameBase {
  id: root
  gameId: "freecell"
  title: "FREECELL"
  helpText: "ARROWS move · UP/DOWN in a column picks how much of a run to take · SPACE select, SPACE on a pile to drop · SPACE twice = auto-move · C park in a free cell · F send to foundation · U undo"
  mouseHelp: "Drag a card (and the run under it) to a pile or free cell, or click it then click the spot · double-click a card to play it to its best spot · RIGHT sends a card straight home · click the table to let go"

  property var state: null
  score: state ? FreeCell.score(state) : 0
  overTitle: "SOLVED IN " + (state ? state.moves : 0) + " MOVES"
  status: !state ? ""
    : (over ? "WON  ·  N for a new game"
      : (paused ? "PAUSED"
        : (state.note ? state.note.toUpperCase() + "  ·  " : "")
          + score + "/52 home  ·  " + FreeCell.freeCellCount(state) + " cells free  ·  moves up to " + FreeCell.maxMovable(state, false, -1)))

  onStateChanged: if (state && FreeCell.isWon(state)) over = true

  function newGame() {
    drag = null
    state = FreeCell.makeState()
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {
    if (over || !state) return
    state = FreeCell.moveCursor(state, dx, dy)
  }

  function activate() {
    if (over) { newGame(); return }
    if (!state) return
    state = FreeCell.activate(state)
  }

  function undo() {
    if (!state) return
    drag = null
    state = FreeCell.undo(state)
    over = false
  }

  function handleKey(key, text) {
    if (over || !state) return false
    if (text === "f" || text === "F") { state = FreeCell.sendHome(state); return true }
    if (text === "c" || text === "C") { state = FreeCell.toFreeCell(state); return true }
    return false
  }

  function saveState() {
    if (!state || over) return null
    return FreeCell.serialize(state)
  }

  function loadState(saved) {
    var restored = FreeCell.deserialize(saved)
    if (restored) { state = restored; over = FreeCell.isWon(restored) }
    else newGame()
  }

  // Which spot (as a keyboard cursor) is at (x, y), or null.
  function cardAt(x, y) {
    var lo = board.layout()
    if (y >= lo.topY && y <= lo.topY + lo.cardH) {
      for (var t = 0; t < 8; ++t) if (x >= board.colX(lo, t, 0) && x <= board.colX(lo, t, 0) + lo.cardW) return { row: 0, col: t, depth: 0 }
      return null
    }
    if (y < lo.tableauY) return null
    var col = -1
    for (var c = 0; c < 8; ++c) if (x >= board.colX(lo, c, 1) && x <= board.colX(lo, c, 1) + lo.cardW) col = c
    if (col < 0) return null
    var cards = state.tableau[col], offs = CardArt.fanOffsets(cards, lo.cardH, board.height - lo.tableauY - lo.gap), d = 0
    for (var k = 0; k < cards.length; ++k) if (y >= lo.tableauY + offs[k]) d = k
    return { row: 1, col: col, depth: d }
  }
  function samePile(a, b) { return !!a && !!b && a.row === b.row && a.col === b.col }

  // Mouse (engine/Pointer.qml), with the dragging in logic/carddrag.js.
  // Press on a card picks it (and the run under it) up; drag it to a pile,
  // or let go and click the pile. Clicking a picked-up card again plays it
  // to its best spot, so a double-click does that in one go. RIGHT sends
  // a card straight home; clicking empty table lets go of a pick.
  property var drag: null
  function pointer(kind, x, y, b) {
    if (!state || over) return
    if (kind === "drag") { if (drag) drag = CardDrag.update(drag, x, y); return }
    if (kind === "release") { if (drag) finishDrag(); return }
    if (kind !== "press") return
    drag = null   // a release lost to a pause leaves one behind
    var spot = cardAt(x, y)
    if (b === Qt.RightButton) {
      if (spot) state = FreeCell.sendHome(FreeCell.setCursor(FreeCell.deselect(state), spot))
      return
    }
    if (b !== Qt.LeftButton) return
    if (!spot) { if (state.selected) state = FreeCell.deselect(state); return }
    var sel = state.selected
    var again = !!sel && samePile(sel, spot) && (spot.row === 0 || sel.depth === spot.depth)
    state = FreeCell.setCursor(state, spot)
    if (!again) activate()   // pick up, drop on this spot, or switch to this run
    if (state.selected) drag = CardDrag.begin(state.selected, again, x, y, board.cardRect(state.selected))
  }

  function finishDrag() {
    var d = drag
    drag = null
    if (!d.moved) { if (d.again) activate(); return }
    var lo = board.layout()
    var target = CardDrag.bestTarget(board.dropTargets(), CardDrag.rect(d, lo.cardW, lo.cardH))
    var dropped = target && !samePile(target, d.sel) ? FreeCell.dropTo(state, d.sel, target) : null
    if (dropped) { state = dropped; return }
    var back = FreeCell.deselect(state)
    if (target && !samePile(target, d.sel)) {
      var cards = FreeCell.selectionCards(state, d.sel)
      var most = FreeCell.maxMovable(state, target.row === 1 && !state.tableau[target.col].length, d.sel.row === 1 ? d.sel.col : -1)
      back.note = target.row === 1 && cards.length > most ? "only " + most + " cards can move" : "can't go there"
    }
    state = back
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.fill: parent

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onOverChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
      function onDragChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    function layout() {
      var gap = Math.max(4, width * 0.01)
      var split = gap * 2 // extra space between free cells and foundations
      var cardW = Math.min((width - gap * 9 - split) / 8, (height - gap * 4) / 1.4 / 3.4)
      var cardH = cardW * 1.4
      var left = (width - (cardW * 8 + gap * 7 + split)) / 2
      return { gap: gap, split: split, cardW: cardW, cardH: cardH, left: left, topY: gap, tableauY: gap + cardH + gap * 3 }
    }

    function colX(lo, col, row) {
      return lo.left + col * (lo.cardW + lo.gap) + (row === 0 && col >= 4 ? lo.split : 0)
    }

    // The top card of a selection where it sits on the table.
    function cardRect(sel) {
      var lo = layout()
      if (sel.row === 0) return { x: colX(lo, sel.col, 0), y: lo.topY, w: lo.cardW, h: lo.cardH }
      var offs = CardArt.fanOffsets(root.state.tableau[sel.col], lo.cardH, height - lo.tableauY - lo.gap)
      return { x: colX(lo, sel.col, 1), y: lo.tableauY + (offs[sel.depth] || 0), w: lo.cardW, h: lo.cardH }
    }

    // Spots a dragged card can land on: free cells, foundations, and each
    // tableau column from its top down to the bottom of the table.
    function dropTargets() {
      var lo = layout(), out = []
      for (var t = 0; t < 8; ++t) out.push({ spot: { row: 0, col: t, depth: 0 }, rect: { x: colX(lo, t, 0), y: lo.topY, w: lo.cardW, h: lo.cardH } })
      for (var c = 0; c < 8; ++c) {
        var n = root.state.tableau[c].length
        out.push({ spot: { row: 1, col: c, depth: Math.max(0, n - 1) }, rect: { x: colX(lo, c, 1), y: lo.tableauY, w: lo.cardW, h: height - lo.tableauY } })
      }
      return out
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state
      var lo = layout()
      if (lo.cardW <= 0) return
      var avail = height - lo.tableauY - lo.gap
      // While dragging, the carried cards leave their spot and follow the
      // pointer (drawn last, on top).
      var carry = root.drag && root.drag.moved ? root.drag.sel : null

      function rectAt(col, row, y) { return { x: colX(lo, col, row), y: y, w: lo.cardW, h: lo.cardH } }

      for (var i = 0; i < 4; ++i) {
        var r = rectAt(i, 0, lo.topY)
        if (s.freeCells[i] && !(carry && carry.row === 0 && carry.col === i)) CardArt.face(ctx, theme, r, s.freeCells[i]); else CardArt.placeholder(ctx, theme, r, "")
      }
      for (var f = 0; f < 4; ++f) {
        var suit = FreeCell.SUITS[f]
        var fr = rectAt(4 + f, 0, lo.topY)
        var frank = s.foundations[suit] - (carry && carry.row === 0 && carry.col === 4 + f ? 1 : 0)
        if (frank > 0) CardArt.face(ctx, theme, fr, { rank: frank, suit: suit })
        else CardArt.placeholder(ctx, theme, fr, CardArt.suitGlyph(suit))
      }

      var offsets = []
      for (var c = 0; c < 8; ++c) {
        var cards = s.tableau[c]
        var offs = CardArt.fanOffsets(cards, lo.cardH, avail)
        offsets.push(offs)
        var upto = carry && carry.row === 1 && carry.col === c ? carry.depth : cards.length
        if (!upto) { CardArt.placeholder(ctx, theme, rectAt(c, 1, lo.tableauY), ""); continue }
        for (var k = 0; k < upto; ++k) {
          var visible = k + 1 < upto ? offs[k + 1] - offs[k] : undefined
          CardArt.face(ctx, theme, rectAt(c, 1, lo.tableauY + offs[k]), cards[k], visible)
        }
      }

      function spotRect(p) {
        if (p.row === 0) return rectAt(p.col, 0, lo.topY)
        var cs = s.tableau[p.col], o = offsets[p.col]
        if (!cs.length) return rectAt(p.col, 1, lo.tableauY)
        var y0 = lo.tableauY + o[Math.min(p.depth, cs.length - 1)]
        var y1 = lo.tableauY + o[cs.length - 1] + lo.cardH
        return { x: colX(lo, p.col, 1), y: y0, w: lo.cardW, h: y1 - y0 }
      }

      if (carry) {
        var target = CardDrag.bestTarget(dropTargets(), CardDrag.rect(root.drag, lo.cardW, lo.cardH))
        if (target && !root.samePile(target, carry)) {
          var tr = target.row === 0 ? rectAt(target.col, 0, lo.topY) : spotRect({ row: 1, col: target.col, depth: target.depth })
          var ok = !!FreeCell.dropTo(s, carry, target)
          CardArt.outline(ctx, ok ? theme.accent : theme.danger, { x: tr.x - 2, y: tr.y - 2, w: tr.w + 4, h: tr.h + 4 }, 3)
        }
        CardDrag.drawCarried(ctx, theme, FreeCell.selectionCards(s, carry), CardDrag.rect(root.drag, lo.cardW, lo.cardH), lo.cardH * 0.26,
          function(c2, r2, card, vis) { CardArt.face(c2, theme, r2, card, vis) })
      } else if (s.selected) {
        var sr = spotRect(s.selected)
        ctx.fillStyle = theme.withAlpha(theme.accent, 0.18)
        ctx.fillRect(sr.x, sr.y, sr.w, sr.h)
        CardArt.outline(ctx, theme.accent, sr, 2)
      }
      var cr = spotRect(s.cursor)
      if (!carry) CardArt.outline(ctx, s.selected ? theme.foreground : theme.accent, { x: cr.x - 2, y: cr.y - 2, w: cr.w + 4, h: cr.h + 4 }, s.selected ? 2 : 3)

      if (root.paused || root.over) {
        ctx.fillStyle = theme.background
        ctx.globalAlpha = root.paused ? 0.7 : 0.35
        ctx.fillRect(0, 0, width, height)
        ctx.globalAlpha = 1.0
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
