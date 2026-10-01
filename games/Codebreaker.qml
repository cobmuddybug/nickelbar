import QtQuick
import "../engine" as Engine
import "logic/codebreaker.js" as Codebreaker

// Classic Mastermind. Peg colors are indices 0-4 into a 5-entry palette
// built from Theme roles (see `palette` below) — the logic module never
// knows a color name, only an index.
Engine.GameBase {
  id: root
  gameId: "codebreaker"
  title: "CODEBREAKER"
  helpText: "LEFT/RIGHT move slot · UP/DOWN cycle colour · 1-5 set colour and advance · SPACE/ENTER submit · solid dot = right colour & place, ring = right colour wrong place"
  mouseHelp: "Click a peg in the current row to cycle its colour (right-click backwards), a colour in the key to set the selected peg, anywhere else to submit the guess"

  property var state: null
  score: state ? Codebreaker.score(state) : 0
  status: !state ? ""
    : (over ? (Codebreaker.isWon(state) ? "CRACKED IN " + (state.currentRow + 1) + "  ·  N for a new game" : "OUT OF GUESSES  ·  N for a new game")
      : (paused ? "PAUSED" : "ROW " + (state.currentRow + 1) + "/10"))

  overTitle: state && Codebreaker.isWon(state) ? "CRACKED IN " + (state.currentRow + 1) : "OUT OF GUESSES"

  onStateChanged: if (state && Codebreaker.isOver(state)) over = true

  function handleKey(key, text) {
    if (over || !state) return false
    if (text.length === 1 && text >= "1" && text <= "5") { state = Codebreaker.setPeg(state, Number(text) - 1); return true }
    return false
  }

  function newGame() {
    state = Codebreaker.makeState()
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {
    if (over || !state) return
    state = Codebreaker.moveCursor(state, dx, dy)
  }

  function activate() {
    if (over) { newGame(); return }
    if (!state) return
    state = Codebreaker.submit(state)
  }

  function saveState() {
    if (!state || over) return null
    return Codebreaker.serialize(state)
  }

  function loadState(saved) {
    var restored = Codebreaker.deserialize(saved)
    if (restored) { state = restored; over = Codebreaker.isOver(restored) }
    else newGame()
  }

  function hitAt(x, y) {
    var h = board.hits
    for (var i = h.length - 1; i >= 0; --i) if (x >= h[i].x && x <= h[i].x + h[i].w && y >= h[i].y && y <= h[i].y + h[i].h) return h[i]
    return null
  }
  // Mouse (engine/Pointer.qml): click a peg in the current row to cycle its
  // colour (right-click backwards), a colour in the key to set the selected
  // peg, anywhere else to submit the guess.
  function pointer(kind, x, y, b) {
    if (!state || over || kind !== "press") return
    var h = hitAt(x, y)
    if (h && h.act === "peg") {
      state = Codebreaker.moveCursor(state, h.i - state.currentSlot, 0)
      state = Codebreaker.moveCursor(state, 0, b === Qt.RightButton ? -1 : 1)
    } else if (h && h.act === "color") state = Codebreaker.setPeg(state, h.i)
    else if (b === Qt.LeftButton) activate()
  }

  Engine.Theme { id: theme }

  // Five hue-separated tones, and each peg also carries its number (1-5),
  // so colours never have to be told apart by hue alone.
  readonly property var palette: [theme.tone(0), theme.tone(1), theme.tone(2), theme.tone(3), theme.danger]

  Canvas {
    id: board
    Engine.Pointer { game: root }
    property var hits: []     // clickable spots, recorded as onPaint draws them
    anchors.fill: parent
    anchors.margins: 8

    readonly property bool showSecret: root.over && root.state && !Codebreaker.isWon(root.state)
    readonly property int totalRows: 10
    readonly property real rowH: height / totalRows
    readonly property real pegR: Math.min(rowH * 0.28, width * 0.05)
    readonly property real pegGap: pegR * 2.4

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onOverChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    function drawPeg(ctx, cx, cy, r, colorIdx, ringed) {
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fillStyle = root.palette[colorIdx]
      ctx.fill()
      ctx.strokeStyle = theme.border
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.fillStyle = theme.background
      ctx.font = "bold " + Math.floor(r * 1.05) + "px " + theme.fontFamily
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(String(colorIdx + 1), cx, cy + 1)
      if (ringed) {
        ctx.beginPath()
        ctx.arc(cx, cy, r + 4, 0, Math.PI * 2)
        ctx.strokeStyle = theme.accent
        ctx.lineWidth = 2
        ctx.stroke()
      }
    }

    function drawFeedback(ctx, x, y, feedback) {
      if (!feedback) return
      var r = board.pegR * 0.32
      var order = []
      for (var i = 0; i < feedback.black; ++i) order.push(true)
      for (var j = 0; j < feedback.white; ++j) order.push(false)
      for (var k = 0; k < order.length; ++k) {
        var col = k % 2, row = Math.floor(k / 2)
        var cx = x + col * (r * 2.4) + r
        var cy = y + row * (r * 2.4) + r
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        if (order[k]) { ctx.fillStyle = theme.foreground; ctx.fill() }
        else { ctx.strokeStyle = theme.dim; ctx.lineWidth = 1.5; ctx.stroke() }
      }
    }

    function drawRow(ctx, y, pegs, feedback, selectedSlot, dim) {
      ctx.globalAlpha = dim ? 0.35 : 1.0
      var cy = y + board.rowH / 2
      for (var p = 0; p < 4; ++p) {
        var cx = 8 + board.pegR + p * board.pegGap
        if (dim) {
          // Rows not reached yet are just empty holes.
          ctx.beginPath()
          ctx.arc(cx, cy, board.pegR * 0.45, 0, Math.PI * 2)
          ctx.strokeStyle = theme.dim
          ctx.lineWidth = 1
          ctx.stroke()
        } else {
          board.drawPeg(ctx, cx, cy, board.pegR, pegs[p], selectedSlot === p)
        }
      }
      board.drawFeedback(ctx, 8 + 4 * board.pegGap + 10, y + board.rowH * 0.5 - board.pegR * 0.7, feedback)
      ctx.globalAlpha = 1.0
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state
      board.hits = []

      for (var r = 0; r < 10; ++r) {
        var row = s.rows[r]
        var isCurrent = r === s.currentRow && row.feedback === null
        if (isCurrent) for (var hp = 0; hp < 4; ++hp)
          board.hits.push({ x: 8 + hp * board.pegGap, y: r * board.rowH, w: board.pegR * 2, h: board.rowH, act: "peg", i: hp })
        board.drawRow(ctx, r * board.rowH, row.pegs, row.feedback, isCurrent ? s.currentSlot : -1, r > s.currentRow)
      }

      // Colour key down the right-hand side, and the secret revealed
      // above it after a loss (kept clear of the overlay's bottom card).
      var keyX = width - board.pegR * 2 - 8
      ctx.font = Math.floor(board.pegR * 0.8) + "px " + theme.fontFamily
      ctx.textAlign = "right"
      ctx.textBaseline = "middle"
      for (var k = 0; k < 5; ++k) {
        board.drawPeg(ctx, keyX + board.pegR, (k + 0.5) * board.rowH, board.pegR * 0.8, k, false)
        board.hits.push({ x: keyX, y: k * board.rowH, w: board.pegR * 2, h: board.rowH, act: "color", i: k })
      }
      if (board.showSecret) {
        ctx.fillStyle = theme.foreground
        ctx.textAlign = "left"
        ctx.fillText("CODE WAS", 8 + 4 * board.pegGap + 60, 5.5 * board.rowH)
        for (var sp = 0; sp < 4; ++sp)
          board.drawPeg(ctx, 8 + 4 * board.pegGap + 60 + board.pegR + sp * board.pegGap, 6.5 * board.rowH, board.pegR, s.secret[sp], false)
      }

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
