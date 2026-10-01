import QtQuick
import "../engine" as Engine
import "logic/breakout.js" as Breakout

// Paddle-angle Breakout. Three brick layouts, cycling as each clears.
Engine.GameBase {
  id: root
  gameId: "breakout"
  title: "BRICKS"
  helpText: "ARROWS move paddle · SPACE/ENTER launch · hit off-centre to steer the angle"
  mouseHelp: "The paddle follows the pointer; click launches"

  readonly property real paddleY: 0.92
  readonly property real paddleHeight: 0.018
  readonly property real ballRadius: 0.012
  readonly property real brickTop: 0.10
  readonly property real brickBottom: 0.50

  property var state: null
  tickInterval: 16
  continuousMove: true
  ticking: !!state && state.alive && (!state.attached || heldDx !== 0)
  score: state ? state.score : 0
  status: !state ? ""
    : (over ? "GAME OVER  ·  N for a new game"
      : (paused ? "PAUSED"
        : (state.attached ? "LEVEL " + (state.level + 1) + "  ·  " + state.lives + " lives  ·  SPACE to launch"
          : state.lives + " lives  ·  level " + (state.level + 1))))
  overTitle: state ? "LEVEL " + (state.level + 1) + " · " + state.score + " pts" : ""

  // Sounds read off what changed: a brick gone, a life lost, the ball turning round.
  property int _bricks: -1
  property int _lives: -1
  property real _vy: 0
  onStateChanged: {
    if (!state) return
    var br = Breakout.bricksRemaining(state.bricks)
    if (_bricks >= 0 && br < _bricks) sound("pop")
    if (_lives >= 0 && state.lives < _lives) sound("thud")
    if (!state.attached && _vy > 0 && state.ballVY < 0) sound("click")
    else if (_vy < 0 && state.ballVY > 0) sound("tick")
    _bricks = br; _lives = state.lives; _vy = state.ballVY
  }

  onTick: {
    var dt = tickInterval / 1000
    var s = Breakout.glidePaddle(state, heldDx, dt)
    if (!s.attached) s = Breakout.step(s, dt)
    if (s !== state) state = s
    if (!state.alive) over = true
  }

  function newGame() {
    state = Breakout.makeState(0)
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {
    if (over || !state) return
    if (dx !== 0) state = Breakout.movePaddle(state, dx)
  }

  function activate() {
    if (over) { newGame(); return }
    if (state && state.attached) state = Breakout.launch(state)
  }

  function saveState() {
    if (!state || over) return null
    return Breakout.serialize(state)
  }

  function loadState(saved) {
    var restored = Breakout.deserialize(saved)
    if (restored) { state = restored; over = false }
    else newGame()
  }

  // Mouse (engine/Pointer.qml): the paddle follows the pointer; click launches.
  function pointer(kind, x, y, b) {
    if (!state || over) return
    var target = x / board.width - state.paddleWidth / 2
    if (kind === "move" || kind === "drag" || kind === "press") state = Breakout.movePaddle(state, (target - state.paddleX) / Breakout.PADDLE_STEP)
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

      // Bricks
      var rowH = (root.brickBottom - root.brickTop) * h / s.rows
      var colW = w / s.cols
      for (var r = 0; r < s.rows; ++r) {
        for (var c = 0; c < s.cols; ++c) {
          var hp = s.bricks[r][c]
          if (hp <= 0) continue
          var bx = c * colW, by = root.brickTop * h + r * rowH
          // Rows shade through the categorical tones so the wall reads as
          // bands; two-hit bricks keep an inner outline until cracked.
          ctx.fillStyle = hp >= 2 ? theme.danger : theme.tone(r)
          ctx.globalAlpha = 0.9
          ctx.fillRect(bx + 1.5, by + 1.5, colW - 3, rowH - 3)
          if (hp >= 2) {
            ctx.globalAlpha = 1.0
            ctx.strokeStyle = theme.background
            ctx.lineWidth = 2
            ctx.strokeRect(bx + 5, by + 5, colW - 10, rowH - 10)
          }
        }
      }
      ctx.globalAlpha = 1.0

      // Lives, bottom-left, as small pips.
      ctx.fillStyle = theme.dim
      for (var li = 0; li < s.lives; ++li) {
        ctx.beginPath()
        ctx.arc(10 + li * 14, h - 8, 4, 0, Math.PI * 2)
        ctx.fill()
      }

      // Paddle
      ctx.fillStyle = theme.foreground
      ctx.fillRect(s.paddleX * w, root.paddleY * h, s.paddleWidth * w, root.paddleHeight * h)

      // Ball
      ctx.beginPath()
      ctx.fillStyle = theme.foreground
      ctx.arc(s.ballX * w, s.ballY * h, root.ballRadius * Math.min(w, h), 0, Math.PI * 2)
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
