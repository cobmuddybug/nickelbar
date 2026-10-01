import QtQuick
import "../engine" as Engine
import "logic/klondike.js" as Klondike
import "logic/cardart.js" as CardArt
import "logic/carddrag.js" as CardDrag

// Klondike solitaire, draw one. Two-row cursor (piles on top, tableau
// below); up/down inside a column reaches into a face-up run so the whole
// run moves together. See the top of klondike.js for the full model.
Engine.GameBase {
  id: root
  gameId: "klondike"
  title: "KLONDIKE"
  helpText: "ARROWS move · UP/DOWN in a column picks how much of a run to take · SPACE select, SPACE on a pile to drop · SPACE twice = auto-move · D draw · F send to foundation · U undo"
  mouseHelp: "Drag a card (and the run under it) to a pile, or click it then click the pile · double-click a card to play it to its best spot · RIGHT sends a card straight home · click the table to let go"

  property var state: null
  score: state ? Klondike.score(state) : 0
  overTitle: "SOLVED IN " + (state ? state.moves : 0) + " MOVES"
  status: !state ? ""
    : (over ? "WON  ·  N for a new game"
      : (paused ? "PAUSED"
        : (state.note ? state.note.toUpperCase() + "  ·  " : "")
          + (autoFinish.running ? "FINISHING…" : score + "/52 home  ·  " + state.moves + " moves")))

  onStateChanged: {
    if (!state) return
    if (Klondike.isWon(state.foundations)) over = true
    else if (Klondike.canAutoFinish(state) && !autoFinish.running) autoFinish.start()
  }

  // Once every card is face up the rest is mechanical: play it out.
  Timer {
    id: autoFinish
    interval: 70
    repeat: true
    running: false
    onTriggered: {
      if (!root.state || root.paused || !Klondike.canAutoFinish(root.state)) { stop(); return }
      root.state = Klondike.autoStep(root.state)
    }
  }

  function newGame() {
    drag = null
    autoFinish.stop()
    state = Klondike.makeState()
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {
    if (over || !state) return
    state = Klondike.moveCursor(state, dx, dy)
  }

  function activate() {
    if (over) { newGame(); return }
    if (!state) return
    state = Klondike.activate(state)
  }

  function undo() {
    if (!state) return
    drag = null
    autoFinish.stop()
    state = Klondike.undo(state)
    over = false
  }

  function handleKey(key, text) {
    if (over || !state) return false
    if (text === "d" || text === "D") { state = Klondike.draw(state); return true }
    if (text === "f" || text === "F") { state = Klondike.sendHome(state); return true }
    return false
  }

  function saveState() {
    if (!state || over) return null
    return Klondike.serialize(state)
  }

  function loadState(saved) {
    var restored = Klondike.deserialize(saved)
    if (restored) { state = restored; over = Klondike.isWon(restored.foundations) }
    else newGame()
  }

  // Which spot (as a keyboard cursor) is at (x, y), or null.
  function cardAt(x, y) {
    var lo = board.layout(), col = -1
    for (var c = 0; c < 7; ++c) if (x >= board.colX(lo, c) && x <= board.colX(lo, c) + lo.cardW) col = c
    if (col < 0) return null
    if (y >= lo.topY && y <= lo.topY + lo.cardH) return col === 2 ? null : { row: 0, col: col, depth: 0 }
    if (y < lo.tableauY) return null
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
      if (spot) state = Klondike.sendHome(Klondike.setCursor(Klondike.deselect(state), spot))
      return
    }
    if (b !== Qt.LeftButton) return
    if (!spot) { if (state.selected) state = Klondike.deselect(state); return }
    if (spot.row === 0 && spot.col === 0) { state = Klondike.draw(state.selected ? Klondike.deselect(state) : state); return }
    var sel = state.selected
    var again = !!sel && samePile(sel, spot) && (spot.row === 0 || sel.depth === spot.depth)
    state = Klondike.setCursor(state, spot)
    if (!again) activate()   // pick up, drop on this pile, or switch to this run
    if (state.selected) drag = CardDrag.begin(state.selected, again, x, y, board.cardRect(state.selected))
  }

  function finishDrag() {
    var d = drag
    drag = null
    if (!d.moved) { if (d.again) activate(); return }
    var lo = board.layout()
    var target = CardDrag.bestTarget(board.dropTargets(), CardDrag.rect(d, lo.cardW, lo.cardH))
    var dropped = target && !samePile(target, d.sel) ? Klondike.dropTo(state, d.sel, target) : null
    if (dropped) { state = dropped; return }
    var back = Klondike.deselect(state)
    if (target && !samePile(target, d.sel)) back.note = "can't go there"
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

    // Card size is bounded by width (7 columns) AND height (the top row
    // plus a tableau that should show at least a few cards unsqueezed).
    function layout() {
      var gap = Math.max(4, width * 0.012)
      var cardW = Math.min((width - gap * 8) / 7, (height - gap * 4) / 1.4 / 3.2)
      var cardH = cardW * 1.4
      var left = (width - (cardW * 7 + gap * 6)) / 2
      var topY = gap
      var tableauY = topY + cardH + gap * 3
      return { gap: gap, cardW: cardW, cardH: cardH, left: left, topY: topY, tableauY: tableauY }
    }

    function colX(lo, col) { return lo.left + col * (lo.cardW + lo.gap) }

    // The top card of a selection where it sits on the table.
    function cardRect(sel) {
      var lo = layout()
      if (sel.row === 0) return { x: colX(lo, sel.col), y: lo.topY, w: lo.cardW, h: lo.cardH }
      var offs = CardArt.fanOffsets(root.state.tableau[sel.col], lo.cardH, height - lo.tableauY - lo.gap)
      return { x: colX(lo, sel.col), y: lo.tableauY + (offs[sel.depth] || 0), w: lo.cardW, h: lo.cardH }
    }

    // Piles a dragged card can land on: the foundations, and each tableau
    // column from its top down to the bottom of the table.
    function dropTargets() {
      var lo = layout(), out = []
      for (var f = 3; f < 7; ++f) out.push({ spot: { row: 0, col: f, depth: 0 }, rect: { x: colX(lo, f), y: lo.topY, w: lo.cardW, h: lo.cardH } })
      for (var c = 0; c < 7; ++c) {
        var n = root.state.tableau[c].length
        out.push({ spot: { row: 1, col: c, depth: Math.max(0, n - 1) }, rect: { x: colX(lo, c), y: lo.tableauY, w: lo.cardW, h: height - lo.tableauY } })
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
      var sel = s.selected, cur = s.cursor
      var avail = height - lo.tableauY - lo.gap
      // While dragging, the carried cards leave their pile and follow the
      // pointer (drawn last, on top).
      var carry = root.drag && root.drag.moved ? root.drag.sel : null
      var carryTop = carry && carry.row === 0

      function rectAt(col, y) { return { x: colX(lo, col), y: y, w: lo.cardW, h: lo.cardH } }

      // Stock: card back with a remaining count, or a recycle mark.
      var stockR = rectAt(0, lo.topY)
      if (s.stock.length) {
        CardArt.back(ctx, theme, stockR)
        ctx.fillStyle = theme.foreground
        ctx.font = "bold " + Math.floor(lo.cardW * 0.26) + "px " + theme.fontFamily
        ctx.textAlign = "center"; ctx.textBaseline = "middle"
        ctx.fillText(String(s.stock.length), stockR.x + stockR.w / 2, stockR.y + stockR.h / 2)
      } else CardArt.placeholder(ctx, theme, stockR, s.waste.length ? "↻" : "")

      // Waste: top card, with the next two peeking out beneath it.
      var wasteR = rectAt(1, lo.topY)
      var shown = carryTop && carry.col === 1 ? s.waste.length - 1 : s.waste.length
      if (shown) {
        if (shown > 1) CardArt.face(ctx, theme, { x: wasteR.x - lo.gap * 0.5, y: wasteR.y, w: wasteR.w, h: wasteR.h }, s.waste[shown - 2])
        CardArt.face(ctx, theme, wasteR, s.waste[shown - 1])
      } else CardArt.placeholder(ctx, theme, wasteR, "")

      for (var f = 0; f < 4; ++f) {
        var suit = Klondike.SUITS[f]
        var fr = rectAt(3 + f, lo.topY)
        var frank = s.foundations[suit] - (carryTop && carry.col === 3 + f ? 1 : 0)
        if (frank > 0) CardArt.face(ctx, theme, fr, { rank: frank, suit: suit })
        else CardArt.placeholder(ctx, theme, fr, CardArt.suitGlyph(suit))
      }

      // Tableau columns, fanned to fit.
      var offsets = []
      for (var i = 0; i < 7; ++i) {
        var col = s.tableau[i]
        var offs = CardArt.fanOffsets(col, lo.cardH, avail)
        offsets.push(offs)
        var upto = carry && carry.row === 1 && carry.col === i ? carry.depth : col.length
        if (!upto) { CardArt.placeholder(ctx, theme, rectAt(i, lo.tableauY), "K"); continue }
        for (var k = 0; k < upto; ++k) {
          var r = rectAt(i, lo.tableauY + offs[k])
          var visible = k + 1 < upto ? offs[k + 1] - offs[k] : undefined
          if (col[k].faceUp) CardArt.face(ctx, theme, r, col[k], visible)
          else CardArt.back(ctx, theme, r)
        }
      }

      // Selection: outline the whole picked-up run.
      function spotRect(p, wholeRun) {
        if (p.row === 0) return rectAt(p.col, lo.topY)
        var c = s.tableau[p.col], o = offsets[p.col]
        if (!c.length) return rectAt(p.col, lo.tableauY)
        var y0 = lo.tableauY + o[Math.min(p.depth, c.length - 1)]
        var y1 = wholeRun ? lo.tableauY + o[c.length - 1] + lo.cardH : y0 + (p.depth + 1 < c.length ? o[p.depth + 1] - o[p.depth] : lo.cardH)
        return { x: colX(lo, p.col), y: y0, w: lo.cardW, h: y1 - y0 }
      }

      if (carry) {
        var cards = Klondike.selectionCards(s, carry)
        var target = CardDrag.bestTarget(dropTargets(), CardDrag.rect(root.drag, lo.cardW, lo.cardH))
        if (target && !root.samePile(target, carry)) {
          var tr = target.row === 0 ? rectAt(target.col, lo.topY) : spotRect({ row: 1, col: target.col, depth: target.depth }, false)
          var ok = !!Klondike.dropTo(s, carry, target)
          CardArt.outline(ctx, ok ? theme.accent : theme.danger, { x: tr.x - 2, y: tr.y - 2, w: tr.w + 4, h: tr.h + 4 }, 3)
        }
        CardDrag.drawCarried(ctx, theme, cards, CardDrag.rect(root.drag, lo.cardW, lo.cardH), lo.cardH * 0.26,
          function(c2, r2, card, vis) { CardArt.face(c2, theme, r2, card, vis) })
      } else if (sel) {
        var sr = spotRect(sel, true)
        ctx.fillStyle = theme.withAlpha(theme.accent, 0.18)
        ctx.fillRect(sr.x, sr.y, sr.w, sr.h)
        CardArt.outline(ctx, theme.accent, sr, 2)
      }

      // Cursor.
      var cr = spotRect(cur, true)
      if (!carry) CardArt.outline(ctx, sel ? theme.foreground : theme.accent, { x: cr.x - 2, y: cr.y - 2, w: cr.w + 4, h: cr.h + 4 }, sel ? 2 : 3)

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
