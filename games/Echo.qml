import QtQuick
import "../engine" as Engine
import "logic/echo.js" as Echo

// Echo (see logic/echo.js): watch the pattern, play it back, add one more.
Engine.GameBase {
  id: root
  gameId: "echo"
  title: "ECHO"
  helpText: "ARROWS press the four pads (PADS mode) · 1-8 play the notes (KEYS mode; 1-4 work on pads) · M switch instrument (restarts) · Repeat the pattern, which grows by one each time · One wrong note ends the round · Score is the length you reached times the pad count"
  mouseHelp: "Click the pads / keys"

  property var state: null
  property int mode: 0
  tickInterval: 16
  ticking: !!state && !state.done
  score: state ? state.score : 0
  overTitle: state ? "PATTERN OF " + state.best : ""
  progress: state ? "best pattern " + state.best : ""
  status: !state ? ""
    : over ? "WRONG NOTE  ·  held " + state.best + "  ·  SPACE for a new round"
    : paused ? "PAUSED"
    : (state.phase === "show" ? "WATCH " : "YOUR TURN ") + " ·  " + Echo.MODES[state.mode].name + "  ·  length " + state.seq.length + "  ·  M switches instrument"

  onTick: update(Echo.step(state, tickInterval / 1000))

  function update(next) {
    var prevLit = state ? state.lit : -1
    state = next
    if (next.lit >= 0 && (next.lit !== prevLit || next.litFor > 0.2)) root.sound(next.done ? "buzz" : "note" + (Echo.MODES[next.mode].n === 4 ? next.lit * 2 : next.lit))
    if (next.done) { over = true; root.sound("buzz") }
  }

  function newGame() { state = Echo.makeState(mode); over = false; paused = false }
  function play(i) { if (state && !over) update(Echo.press(state, i)) }
  function moveCursor(dx, dy) {
    if (state && state.mode === 0) play(dy < 0 ? 0 : dx > 0 ? 1 : dy > 0 ? 2 : 3)
  }
  function activate() { if (over) newGame() }
  function handleKey(key, text) {
    if (!state || !text) return false
    if (text === "m" || text === "M") { mode = 1 - mode; newGame(); return true }
    var d = "12345678".indexOf(text)
    if (d >= 0) { play(d); return true }
    return false
  }

  function pointer(kind, x, y, b) {
    if (kind !== "press" || b !== Qt.LeftButton || !state) return
    var n = Echo.MODES[state.mode].n
    if (n === 4) play((y < board.height / 2 ? 0 : 2) + (x < board.width / 2 ? 0 : 1))
    else play(Math.min(7, Math.floor(x / (board.width / 8))))
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.fill: parent

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      var s = root.state
      if (!s) return
      var n = Echo.MODES[s.mode].n, gap = 8
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      for (var i = 0; i < n; ++i) {
        var x, y, w, h, lbl
        if (n === 4) {
          // Order on screen: 0 top-left, 1 top-right, 2 bottom-left, 3 bottom-right; arrows map to up/right/down/left pads.
          var slot = [0, 1, 3, 2][i]
          w = (width - gap) / 2; h = (height * 0.9 - gap) / 2
          x = (slot % 2) * (w + gap); y = Math.floor(slot / 2) * (h + gap)
          lbl = ["↑", "→", "↓", "←"][i]
        } else {
          w = (width - gap * 7) / 8; h = height * 0.8; x = i * (w + gap); y = height * 0.05
          lbl = String(i + 1)
        }
        var lit = s.lit === i
        ctx.fillStyle = lit ? theme.tone(i) : theme.withAlpha(theme.tone(i), 0.28)
        ctx.fillRect(x, y, w, h)
        if (s.done && s.wrong === i) { ctx.strokeStyle = theme.danger; ctx.lineWidth = 4; ctx.strokeRect(x + 2, y + 2, w - 4, h - 4) }
        ctx.fillStyle = lit ? theme.background : theme.dim; ctx.font = "bold " + Math.floor(Math.min(w, h) * 0.25) + "px " + theme.fontFamily
        ctx.fillText(lbl, x + w / 2, n === 4 ? y + h / 2 : y + h - 40)
      }
      if (root.paused) { ctx.fillStyle = theme.background; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1 }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
