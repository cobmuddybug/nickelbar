import QtQuick
import "../engine" as Engine
import "logic/pong.js" as Pong

// Pong vs an AI whose reaction speed and aim sharpen as you score — no
// spare key in the shared keymap for a manual difficulty picker, so it
// ramps on its own instead.
Engine.GameBase {
  id: root
  gameId: "pong"
  hasTwoPlayer: true
  onPlayersChanged: Pong.setTwoPlayer(players === 2)
  difficulties: ["Easy", "Normal", "Hard"]
  onDifficultyChanged: Pong.setDifficulty(difficulty)
  title: "PADDLES"
  helpText: "UP/DOWN move · SPACE/ENTER serve · first to 7 · AI sharpens as you score"
  mouseHelp: "The paddle follows the pointer; click serves"

  property var state: null
  tickInterval: 16
  continuousMove: true
  ticking: !!state && state.alive && !over && (state.inPlay || heldDy !== 0)
  score: state ? state.playerScore : 0
  overTitle: state ? (state.playerScore > state.aiScore ? (players === 2 ? "LEFT WINS " : "YOU WIN ") : (players === 2 ? "RIGHT WINS " : "AI WINS ")) + state.playerScore + " – " + state.aiScore : ""
  status: !state ? ""
    : (over ? (state.playerScore > state.aiScore ? (players === 2 ? "LEFT WINS  " : "YOU WIN  ") : (players === 2 ? "RIGHT WINS  " : "AI WINS  ")) + state.playerScore + " – " + state.aiScore
      : (paused ? "PAUSED"
        : state.playerScore + " – " + state.aiScore + (players === 2 ? "  ·  left UP/DOWN, right W/S" : "") + (state.inPlay ? "" : "  ·  SPACE to serve")))

  // Sounds read off what changed: a paddle hit, a wall bounce, a point.
  property real _vx: 0
  property real _vy: 0
  property int _pts: 0
  onStateChanged: {
    if (!state) return
    if (state.playerScore + state.aiScore !== _pts) { if (_pts <= state.playerScore + state.aiScore) sound("thud") }
    else if ((_vx < 0) !== (state.ballVX < 0) && _vx !== 0 && state.ballVX !== 0) sound("click")
    else if ((_vy < 0) !== (state.ballVY < 0) && _vy !== 0 && state.ballVY !== 0) sound("tick")
    _vx = state.ballVX; _vy = state.ballVY; _pts = state.playerScore + state.aiScore
  }

  onTick: {
    var dt = tickInterval / 1000
    var s = Pong.glidePlayer(state, heldDy, dt)
    if (s.inPlay) s = Pong.step(s, dt)
    if (s !== state) state = s
    if (!state.alive) over = true
  }

  function newGame() {
    state = Pong.makeState()
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {
    if (over || !state || dy === 0) return
    state = Pong.movePlayer(state, dy)
  }

  // Two players: the right paddle is on W / S (taps and key repeat).
  function handleKey(key, text) {
    if (players !== 2 || !state || over || !text) return false
    if (text === "w" || text === "W") { state = Pong.movePaddle2(state, -1); return true }
    if (text === "s" || text === "S") { state = Pong.movePaddle2(state, 1); return true }
    return false
  }

  function activate() {
    if (over) { newGame(); return }
    if (state && !state.inPlay) state = Pong.serve(state)
  }

  function saveState() {
    if (!state || over) return null
    return Pong.serialize(state)
  }

  function loadState(saved) {
    var restored = Pong.deserialize(saved)
    if (restored) { state = restored; over = false }
    else newGame()
  }

  // Mouse (engine/Pointer.qml): the paddle follows the pointer; click serves.
  function pointer(kind, x, y, b) {
    if (!state || over) return
    var target = y / board.height - Pong.PADDLE_H / 2
    if (kind === "move" || kind === "drag" || kind === "press") state = Pong.movePlayer(state, (target - state.playerY) / Pong.PADDLE_STEP)
    if (kind === "press" && b === Qt.LeftButton) activate()
  }

  Canvas {
    id: board
    Engine.Pointer { game: root; shape: Qt.BlankCursor }
    anchors.fill: parent

  Engine.Theme { id: theme }

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
      var s = root.state
      var w = width, h = height
      if (w <= 0 || h <= 0) return

      ctx.strokeStyle = theme.faint
      ctx.setLineDash([6, 8])
      ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke()
      ctx.setLineDash([])

      // Big faded score digits either side of the net.
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.4)
      ctx.font = "bold " + Math.floor(h * 0.16) + "px " + theme.fontFamily
      ctx.textAlign = "center"
      ctx.textBaseline = "top"
      ctx.fillText(String(s.playerScore), w * 0.25, h * 0.05)
      ctx.fillText(String(s.aiScore), w * 0.75, h * 0.05)

      var paddleH = 0.18 * h, paddleW = 0.018 * w
      ctx.fillStyle = theme.foreground
      ctx.fillRect(0.02 * w, s.playerY * h, paddleW, paddleH)
      ctx.fillStyle = theme.accent
      ctx.fillRect(w - 0.02 * w - paddleW, s.aiY * h, paddleW, paddleH)

      ctx.beginPath()
      ctx.fillStyle = theme.foreground
      ctx.arc(s.ballX * w, s.ballY * h, 0.012 * Math.min(w, h), 0, Math.PI * 2)
      ctx.fill()

      if (root.paused || root.over) {
        ctx.fillStyle = theme.background
        ctx.globalAlpha = root.paused ? 0.7 : 0.35
        ctx.fillRect(0, 0, w, h)
        ctx.globalAlpha = 1.0
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
