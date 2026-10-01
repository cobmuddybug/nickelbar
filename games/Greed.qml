import QtQuick
import "../engine" as Engine
import "logic/greed.js" as Greed

// Greed (Farkle), the push-your-luck dice game; see logic/greed.js. Ten
// turns, score is the total banked.
Engine.GameBase {
  id: root
  gameId: "greed"
  title: "GREED"
  helpText: "Roll, set aside scoring dice, then bank or push your luck · 1 = 100, 5 = 50, three of a kind = 100 × face (1s: 1000), each extra doubles it, 1-6 straight 1500, three pairs 750 · R roll · 1-6 or SPACE on a die: set it aside · T take the best · B bank · no scoring dice in a roll = bust · score all six to roll them all again · 10 turns"
  mouseHelp: "Click a die to set it aside (or put it back); click the empty space to roll, right-click to bank"

  property var state: null
  score: state ? state.total : 0
  overTitle: state ? "10 TURNS · " + state.total : ""
  readonly property int pickPts: state ? Greed.selPoints(state) : 0
  status: !state ? ""
    : over ? "DONE  ·  N for a new game"
    : paused ? "PAUSED"
    : (state.note ? state.note.toUpperCase() + "  ·  " : "") + "TURN " + state.turn + "/" + Greed.TURNS
      + (state.phase === "picking" ? "  ·  this turn " + (state.turnPts + pickPts) : "")

  onStateChanged: over = !!state && Greed.finished(state)

  function newGame() { state = Greed.makeState(); paused = false }
  function moveCursor(dx, dy) { if (state && !over && dx) state = Greed.moveCursor(state, dx) }

  function activate() {
    if (!state) return
    if (over) { newGame(); return }
    if (state.phase === "start") state = Greed.roll(state)
    else if (state.phase === "bust") state = Greed.acceptBust(state)
    else state = Greed.toggle(state, state.cursor)
  }

  function handleKey(key, text) {
    if (!state || over) return false
    var t = text ? text.toLowerCase() : ""
    if (state.phase === "bust" && t) { state = Greed.acceptBust(state); return true }
    if (t === "r") { state = Greed.roll(state); return true }
    if (t === "b") { state = Greed.bank(state); return true }
    if (t === "t") { state = Greed.takeBest(state); return true }
    var i = "123456".indexOf(t)
    if (i >= 0) { state = Greed.toggle(state, i); return true }
    return false
  }

  function saveState() { return state && !over ? Greed.serialize(state) : null }
  function loadState(saved) {
    var r = Greed.deserialize(saved)
    if (r) { state = r; paused = false }
    else newGame()
  }

  // Mouse (engine/Pointer.qml): click a die to set it aside (or put it back);
  // click the empty space to roll, right-click to bank.
  function pointer(kind, x, y, b) {
    if (!state || over || kind !== "press") return
    if (state.phase === "bust") { state = Greed.acceptBust(state); return }
    if (b === Qt.RightButton) { state = Greed.bank(state); return }
    var size = Math.min(board.width / 8, board.height * 0.18), gap = size * 0.3
    var nd = Math.max(1, state.dice.length), x0 = (board.width - (size * nd + gap * (nd - 1))) / 2, y0 = board.height * 0.12
    for (var i = 0; i < state.dice.length; ++i) {
      var dx = x0 + i * (size + gap)
      if (x >= dx && x <= dx + size && y >= y0 - size * 0.1 && y <= y0 + size * 1.3) { state = Greed.toggle(state, i); return }
    }
    state = Greed.roll(state)
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

    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath()
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
    }

    function die(ctx, x, y, size, value, held, cursor, dead) {
      var r = size * 0.16
      roundRect(ctx, x, y, size, size, r)
      ctx.fillStyle = held ? theme.withAlpha(theme.accent, 0.3) : theme.withAlpha(theme.foreground, 0.1)
      ctx.fill()
      ctx.strokeStyle = dead ? theme.danger : held ? theme.accent : theme.withAlpha(theme.foreground, 0.35)
      ctx.lineWidth = held || dead ? 2 : 1
      ctx.stroke()
      ctx.fillStyle = dead ? theme.danger : theme.foreground
      var p = pips[value]
      for (var i = 0; i < p.length; ++i) {
        var cx = x + size * (0.25 + (p[i] % 3) * 0.25), cy = y + size * (0.25 + Math.floor(p[i] / 3) * 0.25)
        ctx.beginPath(); ctx.arc(cx, cy, size * 0.085, 0, Math.PI * 2); ctx.fill()
      }
      if (cursor) {
        roundRect(ctx, x - 4, y - 4, size + 8, size + 8, r + 3)
        ctx.strokeStyle = theme.highlight; ctx.lineWidth = 3; ctx.stroke()
      }
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state
      var size = Math.min(width / 8, height * 0.18), gap = size * 0.3
      var nd = Math.max(1, s.dice.length), x0 = (width - (size * nd + gap * (nd - 1))) / 2, y0 = height * 0.12
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      if (!s.dice.length) {
        ctx.fillStyle = theme.dim
        ctx.font = Math.floor(size * 0.3) + "px " + theme.fontFamily
        ctx.fillText(root.over ? "" : "R to roll six dice", width / 2, y0 + size / 2)
      }
      for (var i = 0; i < s.dice.length; ++i)
        die(ctx, x0 + i * (size + gap), y0 + (s.held[i] ? size * 0.25 : 0), size, s.dice[i], s.held[i],
            s.phase === "picking" && i === s.cursor && !root.over, s.phase === "bust")
      // Turn / pick / total readout.
      var ty = y0 + size * 1.7
      ctx.font = "bold " + Math.floor(size * 0.32) + "px " + theme.fontFamily
      ctx.fillStyle = theme.foreground
      if (s.phase === "picking") {
        var hint = Greed.best(s.dice)
        ctx.fillText("this turn " + (s.turnPts + root.pickPts) + (root.pickPts ? "  (+" + root.pickPts + " picked)" : ""), width / 2, ty)
        ctx.font = Math.floor(size * 0.22) + "px " + theme.fontFamily
        ctx.fillStyle = theme.dim
        ctx.fillText("best in this roll: " + hint.points + "  ·  R roll the rest  ·  B bank", width / 2, ty + size * 0.45)
      } else if (s.phase === "bust") {
        ctx.fillStyle = theme.danger
        ctx.fillText("BUST: " + s.turnPts + " lost  ·  any key", width / 2, ty)
      }
      // Scoreboard of banked turns.
      var by = height * 0.62, bw = Math.min(width * 0.8, size * 9), bx = (width - bw) / 2, cw = bw / Greed.TURNS
      ctx.font = Math.floor(Math.min(cw * 0.28, size * 0.22)) + "px " + theme.fontFamily
      for (var t = 0; t < Greed.TURNS; ++t) {
        var v = s.log[t], cur = t === s.log.length && !root.over
        ctx.strokeStyle = cur ? theme.accent : theme.faint; ctx.lineWidth = cur ? 2 : 1
        ctx.strokeRect(bx + t * cw + 2, by, cw - 4, size * 0.7)
        ctx.fillStyle = theme.dim
        ctx.fillText(String(t + 1), bx + t * cw + cw / 2, by - size * 0.18)
        if (v !== undefined) {
          ctx.fillStyle = v ? theme.foreground : theme.danger
          ctx.fillText(v ? String(v) : "✗", bx + t * cw + cw / 2, by + size * 0.35)
        }
      }
      ctx.font = "bold " + Math.floor(size * 0.4) + "px " + theme.fontFamily
      ctx.fillStyle = theme.accent
      ctx.fillText("TOTAL " + s.total, width / 2, by + size * 1.3)
      if (root.paused) {
        ctx.fillStyle = theme.background; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
