import QtQuick
import "../engine" as Engine
import "logic/knucklebones.js" as KB

// Knucklebones against the computer; see logic/knucklebones.js. One round
// per game; score is your total, best kept either way.
Engine.GameBase {
  id: root
  gameId: "knucklebones"
  difficulties: ["Easy", "Normal", "Hard"]
  onDifficultyChanged: KB.setDifficulty(difficulty)
  title: "KNUCKLEBONES"
  helpText: "Place each roll in one of your three columns · matching dice in a column multiply (two 4s = 16, three = 36) · your die knocks out the computer's dice of the same value in the facing column, and theirs do the same to you · LEFT/RIGHT or 1-3 pick a column · SPACE place · round ends when a board fills"
  mouseHelp: "Click one of your columns to place the die"

  property var state: null
  score: state ? KB.total(state.you) : 0
  overTitle: !state ? "" : KB.outcome(state) === "win" ? "YOU WIN" : KB.outcome(state) === "lose" ? "YOU LOSE" : "DRAW"
  status: !state ? ""
    : over ? "YOU " + KB.total(state.you) + " · CPU " + KB.total(state.cpu) + "  ·  SPACE to play again"
    : paused ? "PAUSED"
    : state.turn === "you" ? "YOUR ROLL: " + state.die + "  ·  pick a column"
    : "COMPUTER ROLLED " + state.die + "…"

  onStateChanged: over = !!state && state.done

  Timer {
    interval: 750
    running: !!root.state && root.state.turn === "cpu" && !root.state.done && !root.paused
    onTriggered: root.state = KB.cpuMove(root.state)
  }

  function newGame() { state = KB.makeState(); paused = false }

  function moveCursor(dx, dy) {
    if (!state || over || state.turn !== "you") return
    if (dx) state = KB.moveCursor(state, dx)
    else if (dy > 0) state = KB.place(state, state.cursor)
  }

  function activate() {
    if (over) { newGame(); return }
    if (state && state.turn === "you") state = KB.place(state, state.cursor)
  }

  function handleKey(key, text) {
    if (!state || over || state.turn !== "you") return false
    var i = "123".indexOf(text)
    if (i >= 0 && text) { state = KB.place(KB.moveCursor(state, i - state.cursor), i); return true }
    return false
  }

  function saveState() { return state && !over ? KB.serialize(state) : null }
  function loadState(saved) {
    var r = KB.deserialize(saved)
    if (r) { state = r; paused = false }
    else newGame()
  }

  function pointer(kind, x, y, b) {
    if (!state || over || state.turn !== "you") return
    var L = board.layout()
    var c = Math.floor((x - L.x0) / L.colW)
    if (c < 0 || c >= KB.COLS) return
    if (c !== state.cursor) state = KB.moveCursor(state, c - state.cursor)
    if (kind === "press" && b === Qt.LeftButton && y > height * 0.5) state = KB.place(state, c)
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    anchors.fill: parent
    Engine.Pointer { game: root }

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onOverChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    readonly property var pips: [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]]

    function layout() {
      var size = Math.min(width / 5.2, height / 10)
      var colW = size * 1.25, x0 = (width - colW * KB.COLS) / 2
      return { size: size, colW: colW, x0: x0, mid: height / 2 }
    }

    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath()
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
    }

    // Matching dice share a colour: pairs in one tone, triples in another.
    function die(ctx, x, y, size, value, mult) {
      roundRect(ctx, x, y, size, size, size * 0.16)
      ctx.fillStyle = mult === 3 ? theme.withAlpha(theme.tone(1), 0.45) : mult === 2 ? theme.withAlpha(theme.tone(0), 0.35) : theme.withAlpha(theme.foreground, 0.1)
      ctx.fill()
      ctx.strokeStyle = mult > 1 ? theme.withAlpha(mult === 3 ? theme.tone(1) : theme.tone(0), 0.9) : theme.withAlpha(theme.foreground, 0.35)
      ctx.lineWidth = mult > 1 ? 2 : 1
      ctx.stroke()
      ctx.fillStyle = theme.foreground
      var p = pips[value]
      for (var i = 0; i < p.length; ++i) {
        ctx.beginPath()
        ctx.arc(x + size * (0.25 + (p[i] % 3) * 0.25), y + size * (0.25 + Math.floor(p[i] / 3) * 0.25), size * 0.085, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // One side's board. dir = +1 grows downward from `top` (you), -1 grows
    // upward toward the middle (the computer, mirrored).
    function side(ctx, L, cols, top, dir, mine) {
      var s = root.state, size = L.size, gap = size * 0.12
      for (var c = 0; c < KB.COLS; ++c) {
        var cx = L.x0 + c * L.colW + (L.colW - size) / 2
        var h = size * 3 + gap * 4
        var y0 = dir > 0 ? top : top - h
        var cursor = mine && s.turn === "you" && !root.over && c === s.cursor
        roundRect(ctx, cx - gap, y0, size + gap * 2, h, size * 0.2)
        ctx.fillStyle = cursor ? theme.withAlpha(theme.accent, 0.14) : theme.withAlpha(theme.foreground, 0.04)
        ctx.fill()
        ctx.strokeStyle = cursor ? theme.accent : theme.faint
        ctx.lineWidth = cursor ? 2 : 1
        ctx.stroke()
        var col = cols[c], cnt = [0, 0, 0, 0, 0, 0, 0]
        for (var k = 0; k < col.length; ++k) cnt[col[k]]++
        for (var r = 0; r < col.length; ++r) {
          var dy = dir > 0 ? top + gap + r * (size + gap) : top - gap - size - r * (size + gap)
          die(ctx, cx, dy, size, col[r], cnt[col[r]])
        }
        // Column score on the outside edge.
        ctx.fillStyle = theme.dim
        ctx.font = "bold " + Math.floor(size * 0.34) + "px " + theme.fontFamily
        ctx.textAlign = "center"; ctx.textBaseline = "middle"
        ctx.fillText(String(KB.columnScore(col)), cx + size / 2, dir > 0 ? y0 + h + size * 0.3 : y0 - size * 0.3)
      }
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state, L = layout(), size = L.size
      var gapMid = size * 0.5
      side(ctx, L, s.cpu, L.mid - gapMid, -1, false)
      side(ctx, L, s.you, L.mid + gapMid, 1, true)

      // Totals either side of the middle line, and the die to place.
      ctx.textBaseline = "middle"
      ctx.font = "bold " + Math.floor(size * 0.42) + "px " + theme.fontFamily
      ctx.textAlign = "right"
      var lx = L.x0 - size * 0.4
      ctx.fillStyle = theme.dim
      ctx.fillText("CPU " + KB.total(s.cpu), lx, L.mid - gapMid - size * 0.6)
      ctx.fillStyle = theme.accent
      ctx.fillText("YOU " + KB.total(s.you), lx, L.mid + gapMid + size * 0.6)
      if (!s.done) {
        var dx = L.x0 + L.colW * KB.COLS + size * 0.5
        var dy = s.turn === "you" ? L.mid + gapMid + size * 0.2 : L.mid - gapMid - size * 1.2
        if (dx + size < width) die(ctx, dx, dy, size, s.die, 1)
      }
      if (s.last && s.last.knocked) {
        ctx.textAlign = "center"
        ctx.font = Math.floor(size * 0.28) + "px " + theme.fontFamily
        ctx.fillStyle = s.last.who === "you" ? theme.accent : theme.danger
        ctx.fillText((s.last.who === "you" ? "You knocked out " : "Lost ") + s.last.knocked + " × " + s.last.value, width / 2, L.mid)
      }
      if (root.paused) {
        ctx.fillStyle = theme.background; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
