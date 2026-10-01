import QtQuick
import "../engine" as Engine
import "logic/lightcycles.js" as Cycles

// Light cycles vs two AI riders. Each round waits for your first turn (or
// SPACE) before the bikes launch; SPACE after a round rides the next one.
Engine.GameBase {
  id: root
  gameId: "lightcycles"
  difficulties: ["Easy", "Normal", "Hard"]
  onDifficultyChanged: Cycles.setDifficulty(difficulty)
  title: "LIGHT CYCLES"
  helpText: "ARROWS steer · SPACE start round · outlast both AI bikes to win a round · 3 lives · bikes speed up as you win"
  mouseHelp: "Click to turn toward that spot; click starts a round too"

  property var state: null
  tickInterval: state ? Cycles.speedFor(state) : 90
  ticking: !!state && state.phase === "riding" && !over
  score: state ? state.wins : 0
  overTitle: state ? state.wins + (state.wins === 1 ? " ROUND WON" : " ROUNDS WON") : ""
  status: !state ? ""
    : (over ? "DEREZZED  ·  N for a new game"
      : (paused ? "PAUSED"
        : (state.phase === "ready" ? "ROUND " + state.round + "  ·  steer or SPACE to launch"
          : state.phase === "ended" ? (state.result === "won" ? "ROUND WON" : "CRASHED") + "  ·  SPACE for the next round"
          : "ROUND " + state.round + "  ·  " + state.wins + " won  ·  " + state.lives + " lives")))

  onTick: {
    state = Cycles.step(state)
    if (!state.alive) over = true
  }

  function newGame() {
    state = Cycles.makeState()
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {
    if (over || !state || state.phase === "ended") return
    state = Cycles.turn(state, dx, dy)
  }

  function activate() {
    if (over) { newGame(); return }
    if (!state) return
    if (state.phase === "ended") state = Cycles.newRound(state)
    else state = Cycles.launch(state)
  }

  function saveState() {
    if (!state || over) return null
    return Cycles.serialize(state)
  }

  function loadState(saved) {
    var restored = Cycles.deserialize(saved)
    if (restored) { state = restored; over = false }
    else newGame()
  }

  // Mouse (engine/Pointer.qml): click to turn toward that spot; click
  // starts a round too.
  function pointer(kind, x, y, b) {
    if (!state || over || kind !== "press" || b !== Qt.LeftButton) return
    if (state.phase !== "riding") { activate(); return }
    var me = state.bikes[0], c = board.cell, dx = x - (me.x + 0.5) * c, dy = y - (me.y + 0.5) * c
    if (Math.abs(dx) > Math.abs(dy)) moveCursor(dx < 0 ? -1 : 1, 0)
    else moveCursor(0, dy < 0 ? -1 : 1)
  }

  Engine.Theme { id: theme }

  readonly property var bikeColors: [theme.foreground, theme.tone(0), theme.danger]

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property real cell: Math.floor(Math.min(parent.width / Cycles.COLS, parent.height / Cycles.ROWS))
    width: cell * Cycles.COLS
    height: cell * Cycles.ROWS

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onOverChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state, c = cell

      // Faint floor grid every 4 cells.
      ctx.strokeStyle = theme.withAlpha(theme.foreground, 0.06)
      ctx.lineWidth = 1
      for (var gx = 0; gx <= Cycles.COLS; gx += 4) { ctx.beginPath(); ctx.moveTo(gx * c + 0.5, 0); ctx.lineTo(gx * c + 0.5, height); ctx.stroke() }
      for (var gy = 0; gy <= Cycles.ROWS; gy += 4) { ctx.beginPath(); ctx.moveTo(0, gy * c + 0.5); ctx.lineTo(width, gy * c + 0.5); ctx.stroke() }
      ctx.strokeStyle = theme.border
      ctx.strokeRect(0.5, 0.5, width - 1, height - 1)

      for (var i = 0; i < s.grid.length; ++i) {
        var v = s.grid[i]
        if (!v) continue
        var bc = root.bikeColors[v - 1]
        ctx.fillStyle = theme.withAlpha(bc, s.bikes[v - 1].alive ? 0.75 : 0.3)
        ctx.fillRect((i % Cycles.COLS) * c + 1, Math.floor(i / Cycles.COLS) * c + 1, c - 2, c - 2)
      }
      for (var b = 0; b < s.bikes.length; ++b) {
        var bk = s.bikes[b]
        ctx.fillStyle = bk.alive ? root.bikeColors[b] : theme.dim
        ctx.fillRect(bk.x * c - 1, bk.y * c - 1, c + 2, c + 2)
        if (!bk.alive) {
          ctx.strokeStyle = theme.danger
          ctx.lineWidth = 2
          ctx.beginPath(); ctx.arc(bk.x * c + c / 2, bk.y * c + c / 2, c * 1.4, 0, Math.PI * 2); ctx.stroke()
        }
      }

      // Lives
      ctx.fillStyle = theme.dim
      for (var l = 0; l < s.lives; ++l) ctx.fillRect(6 + l * 12, 6, 8, 8)

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
