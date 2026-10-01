import QtQuick
import "../engine" as Engine
import "logic/snake.js" as Snake

// Classic snake, walls wrap. Undo isn't declared — an arcade game has
// nothing sensible to rewind to, so `u` is silently ignored by the overlay.
Engine.GameBase {
  id: root
  gameId: "snake"
  title: "SNAKE"
  helpText: "ARROWS steer  ·  N new game  ·  P pause  ·  WALLS WRAP"
  mouseHelp: "Click to head toward that spot (along whichever axis it's further off)"

  readonly property int cols: 22
  readonly property int rows: 20

  property var state: null
  tickInterval: state ? Snake.speedForScore(state.score) : 160
  ticking: !!state && state.alive && !over
  score: state ? state.score : 0
  overTitle: state ? "LENGTH " + state.snake.length : ""
  status: over ? "GAME OVER  ·  N for a new game" : (paused ? "PAUSED" : (state ? state.score + " eaten" : ""))

  onTick: {
    state = Snake.step(state, true)
    if (!state.alive) { over = true }
  }

  function newGame() {
    state = Snake.makeState(cols, rows)
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {
    if (over || !state) return
    state = Snake.setDirection(state, dx, dy)
  }

  function activate() {
    if (over) newGame()
  }

  function saveState() {
    if (!state || over) return null
    return Snake.serialize(state)
  }

  function loadState(saved) {
    var restored = Snake.deserialize(saved)
    if (restored) { state = restored; over = false }
    else newGame()
  }

  // Mouse (engine/Pointer.qml): click to head toward that spot (along
  // whichever axis it's further off).
  function pointer(kind, x, y, b) {
    if (!state || over || kind !== "press" || b !== Qt.LeftButton) return
    var c = board.cell, dx = x - (state.snake[0].x + 0.5) * c, dy = y - (state.snake[0].y + 0.5) * c
    if (Math.abs(dx) < c / 2 && Math.abs(dy) < c / 2) return
    if (Math.abs(dx) > Math.abs(dy)) moveCursor(dx < 0 ? -1 : 1, 0)
    else moveCursor(0, dy < 0 ? -1 : 1)
  }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property real cell: Math.floor(Math.min(parent.width / root.cols, parent.height / root.rows))
    width: cell * root.cols
    height: cell * root.rows

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

      var c = board.cell

      ctx.strokeStyle = theme.faint
      ctx.lineWidth = 1
      for (var gx = 0; gx <= root.cols; ++gx) {
        ctx.beginPath()
        ctx.moveTo(gx * c, 0)
        ctx.lineTo(gx * c, root.rows * c)
        ctx.stroke()
      }
      for (var gy = 0; gy <= root.rows; ++gy) {
        ctx.beginPath()
        ctx.moveTo(0, gy * c)
        ctx.lineTo(root.cols * c, gy * c)
        ctx.stroke()
      }

      var food = root.state.food
      if (food) {
        ctx.fillStyle = theme.danger
        var fp = Math.max(2, c * 0.16)
        ctx.fillRect(food.x * c + fp, food.y * c + fp, c - fp * 2, c - fp * 2)
      }

      var snake = root.state.snake
      var pad = Math.max(1, c * 0.08)
      for (var i = 0; i < snake.length; ++i) {
        ctx.fillStyle = i === 0 ? theme.foreground : theme.accent
        ctx.globalAlpha = i === 0 ? 1.0 : 0.88
        ctx.fillRect(snake[i].x * c + pad, snake[i].y * c + pad, c - pad * 2, c - pad * 2)
      }
      ctx.globalAlpha = 1.0

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
