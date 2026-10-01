import QtQuick
import "../engine" as Engine
import "logic/spider.js" as Spider
import "logic/cardart.js" as CardArt
import "logic/carddrag.js" as CardDrag

// Spider solitaire, 1, 2 or 4 suits. Same cursor model as Klondike (see
// the top of spider.js). Score is the classic 500 - moves + 100 a run.
Engine.GameBase {
  id: root
  gameId: "spider"
  title: "SPIDER"
  helpText: "Build down in any suit; only same-suit runs move together; K to A of one suit clears · LEFT/RIGHT column · UP/DOWN how much to take · SPACE pick up, SPACE on a column to drop · SPACE twice = best move · D deal a row · S suits 1/2/4 (new game) · U undo"
  mouseHelp: "Drag a card (and the run under it) to a column, or click it then click the column · double-click or RIGHT-click a run to play it to its best spot · click the stock to deal a row · click the table to let go"

  property var state: null
  property int suits: 1
  score: state ? Spider.score(state) : 0
  overTitle: "CLEARED IN " + (state ? state.moves : 0) + " MOVES"
  status: !state ? ""
    : (over ? "WON  ·  N for a new game"
      : (paused ? "PAUSED"
        : (state.note ? state.note.toUpperCase() + "  ·  " : "")
          + state.suits + " SUIT" + (state.suits > 1 ? "S" : "") + "  ·  " + state.done.length + "/8 runs  ·  "
          + Spider.dealsLeft(state) + " deals left"))

  onStateChanged: if (state && Spider.isWon(state)) over = true

  function newGame() {
    drag = null
    state = Spider.makeState(suits)
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {
    if (over || !state) return
    state = Spider.moveCursor(state, dx, dy)
  }

  function activate() {
    if (over) { newGame(); return }
    if (state) state = Spider.activate(state)
  }

  function undo() {
    if (!state) return
    drag = null
    state = Spider.undo(state)
    over = false
  }

  function handleKey(key, text) {
    if (!state) return false
    if (text === "s" || text === "S") {
      suits = suits === 1 ? 2 : suits === 2 ? 4 : 1
      newGame()
      return true
    }
    if (over) return false
    if (text === "d" || text === "D") { state = Spider.deal(state); return true }
    return false
  }

  function saveState() {
    if (!state || over) return over ? { suits: suits } : null
    return Spider.serialize(state)
  }

  function loadState(saved) {
    if (saved && saved.suits) suits = saved.suits
    var restored = Spider.deserialize(saved)
    if (restored && !Spider.isWon(restored)) { state = restored; over = false }
    else newGame()
  }

  // Which spot is at (x, y): { row: 0 } is the stock, else a column/depth.
  function cardAt(x, y) {
    var lo = board.layout(), colX = function(c) { return lo.left + c * (lo.cardW + lo.gap) }
    if (y >= lo.topY && y <= lo.topY + lo.cardH) return x >= colX(0) && x <= colX(2) ? { row: 0, col: -1, depth: 0 } : null
    if (y < lo.tableauY) return null
    var col = -1
    for (var c = 0; c < 10; ++c) if (x >= colX(c) && x <= colX(c) + lo.cardW) col = c
    if (col < 0) return null
    var cards = state.tableau[col], offs = CardArt.fanOffsets(cards, lo.cardH, board.height - lo.tableauY - lo.gap), d = 0
    for (var k = 0; k < cards.length; ++k) if (y >= lo.tableauY + offs[k]) d = k
    return { row: 1, col: col, depth: d }
  }

  // Mouse (engine/Pointer.qml), with the dragging in logic/carddrag.js.
  // Press on a card picks it (and the run under it) up; drag it to a
  // column, or let go and click the column. Clicking a picked-up run again
  // (a double-click) or RIGHT-clicking one plays it to its best spot.
  // Clicking the stock deals; clicking empty table lets go of a pick.
  property var drag: null
  function unpick(s, note) { var n = Spider.setCursor(s, s.cursor.col, s.cursor.depth); n.selected = null; n.note = note || ""; return n }
  function bestMove(s, col, depth) {
    var to = Spider.smartTarget(s, col, depth)
    return (to >= 0 && Spider.moveRun(s, col, depth, to)) || unpick(s, "nowhere to go")
  }
  function pointer(kind, x, y, b) {
    if (!state || over) return
    if (kind === "drag") { if (drag) drag = CardDrag.update(drag, x, y); return }
    if (kind === "release") { if (drag) finishDrag(); return }
    if (kind !== "press") return
    drag = null   // a release lost to a pause leaves one behind
    var spot = cardAt(x, y)
    if (spot && spot.row === 0) { state = Spider.deal(state.selected ? unpick(state) : state); return }
    if (!spot) { if (state.selected) state = unpick(state); return }
    var col = state.tableau[spot.col]
    if (b === Qt.RightButton) {
      state = Spider.setCursor(unpick(state), spot.col, spot.depth)
      if (Spider.canLift(col, spot.depth)) state = bestMove(state, spot.col, spot.depth)
      return
    }
    if (b !== Qt.LeftButton) return
    var sel = state.selected
    var again = !!sel && sel.col === spot.col && sel.depth === spot.depth
    state = Spider.setCursor(state, spot.col, spot.depth)
    if (sel && !again) {
      // Click-to-drop onto this column; failing that, pick this run up.
      var moved = sel.col !== spot.col ? Spider.moveRun(state, sel.col, sel.depth, spot.col) : null
      if (moved) { state = moved; return }
      state = unpick(state, Spider.canLift(col, spot.depth) ? "" : "doesn't go there")
    }
    if (!again) state = Spider.activate(state)
    if (state.selected) drag = CardDrag.begin(state.selected, again, x, y, board.cardRect(state.selected))
  }

  function finishDrag() {
    var d = drag
    drag = null
    if (!d.moved) { if (d.again) state = bestMove(state, d.sel.col, d.sel.depth); return }
    var lo = board.layout()
    var target = CardDrag.bestTarget(board.dropTargets(), CardDrag.rect(d, lo.cardW, lo.cardH))
    var moved = target && target.col !== d.sel.col ? Spider.moveRun(state, d.sel.col, d.sel.depth, target.col) : null
    state = moved || unpick(state, target && target.col !== d.sel.col ? "doesn't go there" : "")
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
      var gap = Math.max(3, width * 0.008)
      var cardW = Math.min((width - gap * 11) / 10, (height - gap * 4) / 1.4 / 3.4)
      var cardH = cardW * 1.4
      var left = (width - (cardW * 10 + gap * 9)) / 2
      return { gap: gap, cardW: cardW, cardH: cardH, left: left, topY: gap, tableauY: gap * 3 + cardH }
    }

    function colLeft(lo, c) { return lo.left + c * (lo.cardW + lo.gap) }

    // The top card of a picked-up run where it sits on the table.
    function cardRect(sel) {
      var lo = layout()
      var offs = CardArt.fanOffsets(root.state.tableau[sel.col], lo.cardH, height - lo.tableauY - lo.gap)
      return { x: colLeft(lo, sel.col), y: lo.tableauY + (offs[sel.depth] || 0), w: lo.cardW, h: lo.cardH }
    }

    // Each column from its top down to the bottom of the table.
    function dropTargets() {
      var lo = layout(), out = []
      for (var c = 0; c < 10; ++c) out.push({ spot: { row: 1, col: c }, rect: { x: colLeft(lo, c), y: lo.tableauY, w: lo.cardW, h: height - lo.tableauY } })
      return out
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state
      var lo = layout()
      if (lo.cardW <= 0) return
      function colX(c) { return lo.left + c * (lo.cardW + lo.gap) }

      // Stock (one back per deal left, overlapped) on the left; finished
      // runs as their kings on the right.
      var deals = Spider.dealsLeft(s)
      if (deals) {
        for (var d = 0; d < deals; ++d)
          CardArt.back(ctx, theme, { x: colX(0) + d * lo.cardW * 0.14, y: lo.topY, w: lo.cardW, h: lo.cardH })
        ctx.fillStyle = theme.foreground
        ctx.font = "bold " + Math.floor(lo.cardW * 0.24) + "px " + theme.fontFamily
        ctx.textAlign = "center"; ctx.textBaseline = "middle"
        ctx.fillText("D", colX(0) + (deals - 1) * lo.cardW * 0.14 + lo.cardW / 2, lo.topY + lo.cardH / 2)
      } else CardArt.placeholder(ctx, theme, { x: colX(0), y: lo.topY, w: lo.cardW, h: lo.cardH }, "")
      for (var f = 0; f < 8; ++f) {
        var fr = { x: colX(2 + f), y: lo.topY, w: lo.cardW, h: lo.cardH }
        if (f < s.done.length) CardArt.face(ctx, theme, fr, { rank: 13, suit: s.done[f] })
        else CardArt.placeholder(ctx, theme, fr, "")
      }

      // Tableau. While dragging, the carried run leaves its column and
      // follows the pointer (drawn last, on top).
      var carry = root.drag && root.drag.moved ? root.drag.sel : null
      var avail = height - lo.tableauY - lo.gap
      var offsets = []
      for (var c = 0; c < 10; ++c) {
        var col = s.tableau[c]
        var offs = CardArt.fanOffsets(col, lo.cardH, avail)
        offsets.push(offs)
        var upto = carry && carry.col === c ? carry.depth : col.length
        if (!upto) { CardArt.placeholder(ctx, theme, { x: colX(c), y: lo.tableauY, w: lo.cardW, h: lo.cardH }, ""); continue }
        for (var k = 0; k < upto; ++k) {
          var r = { x: colX(c), y: lo.tableauY + offs[k], w: lo.cardW, h: lo.cardH }
          var visible = k + 1 < upto ? offs[k + 1] - offs[k] : undefined
          if (col[k].faceUp) CardArt.face(ctx, theme, r, col[k], visible)
          else CardArt.back(ctx, theme, r)
        }
      }

      function runRect(col, depth) {
        var cards = s.tableau[col], o = offsets[col]
        if (!cards.length) return { x: colX(col), y: lo.tableauY, w: lo.cardW, h: lo.cardH }
        var dd = Math.min(depth, cards.length - 1)
        var y0 = lo.tableauY + o[dd]
        return { x: colX(col), y: y0, w: lo.cardW, h: lo.tableauY + o[cards.length - 1] + lo.cardH - y0 }
      }

      if (carry) {
        var target = CardDrag.bestTarget(dropTargets(), CardDrag.rect(root.drag, lo.cardW, lo.cardH))
        if (target && target.col !== carry.col) {
          var tcol = s.tableau[target.col]
          var tr = runRect(target.col, Math.max(0, tcol.length - 1))
          var ok = !!Spider.moveRun(s, carry.col, carry.depth, target.col)
          CardArt.outline(ctx, ok ? theme.accent : theme.danger, { x: tr.x - 2, y: tr.y - 2, w: tr.w + 4, h: tr.h + 4 }, 3)
        }
        CardDrag.drawCarried(ctx, theme, s.tableau[carry.col].slice(carry.depth), CardDrag.rect(root.drag, lo.cardW, lo.cardH), lo.cardH * 0.26,
          function(c2, r2, card, vis) { CardArt.face(c2, theme, r2, card, vis) })
      } else if (s.selected) {
        var sr = runRect(s.selected.col, s.selected.depth)
        ctx.fillStyle = theme.withAlpha(theme.accent, 0.18)
        ctx.fillRect(sr.x, sr.y, sr.w, sr.h)
        CardArt.outline(ctx, theme.accent, sr, 2)
      }
      var cr = runRect(s.cursor.col, s.cursor.depth)
      var liftable = Spider.canLift(s.tableau[s.cursor.col], s.cursor.depth) || !s.tableau[s.cursor.col].length
      if (!carry) CardArt.outline(ctx, s.selected ? theme.foreground : (liftable ? theme.accent : theme.danger),
        { x: cr.x - 2, y: cr.y - 2, w: cr.w + 4, h: cr.h + 4 }, s.selected ? 2 : 3)

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
