import QtQuick
import "../engine" as Engine
import "logic/invaders.js" as Invaders

// Waves, shields, and a march that quickens as rows thin.
Engine.GameBase {
  id: root
  gameId: "invaders"
  title: "INVADERS"
  helpText: "ARROWS move · SPACE/ENTER fire · shields absorb one hit per block"
  mouseHelp: "The cannon follows the pointer; click fires"

  property var state: null
  tickInterval: 16
  continuousMove: true
  ticking: !!state && state.alive && !over
  score: state ? state.score : 0
  overTitle: state ? "WAVE " + state.wave + " · " + state.score + " pts" : ""
  status: !state ? ""
    : (over ? "GAME OVER  ·  N for a new game"
      : (paused ? "PAUSED" : "WAVE " + state.wave + "  ·  " + state.lives + " lives"))

  onTick: {
    var dt = tickInterval / 1000
    state = Invaders.step(Invaders.glidePlayer(state, heldDx, dt), dt)
    if (!state.alive) over = true
  }

  function newGame() {
    state = Invaders.makeState()
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {
    if (over || !state || dx === 0) return
    state = Invaders.movePlayer(state, dx)
  }

  function activate() {
    if (over) { newGame(); return }
    if (state) state = Invaders.fire(state)
  }

  function saveState() {
    if (!state || over) return null
    return Invaders.serialize(state)
  }

  function loadState(saved) {
    var restored = Invaders.deserialize(saved)
    if (restored) { state = restored; over = false }
    else newGame()
  }

  // Mouse (engine/Pointer.qml): the cannon follows the pointer; click fires.
  function pointer(kind, x, y, b) {
    if (!state || over) return
    var target = x / board.width - Invaders.PLAYER_W / 2
    if (kind === "move" || kind === "drag" || kind === "press") state = Invaders.movePlayer(state, (target - state.playerX) / Invaders.PLAYER_STEP)
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

      // Aliens: a little two-frame sprite per row tone, legs flipping
      // with each march step so the block visibly walks.
      var frame = Math.round(s.alienX / Invaders.STEP_X) % 2
      for (var r = 0; r < Invaders.ROWS; ++r) {
        ctx.fillStyle = theme.tone(Math.floor(r / 2))
        for (var c = 0; c < Invaders.COLS; ++c) {
          if (!s.aliens[r][c]) continue
          var ax = (s.alienX + c * Invaders.CELL_W) * w
          var ay = (s.alienY + r * Invaders.CELL_H) * h
          var aw = Invaders.CELL_W * w, ah = Invaders.CELL_H * h
          var bx = ax + aw * 0.18, bw = aw * 0.64
          ctx.fillRect(bx, ay + ah * 0.2, bw, ah * 0.42)
          ctx.clearRect(bx + bw * 0.2, ay + ah * 0.32, bw * 0.14, ah * 0.12)
          ctx.clearRect(bx + bw * 0.66, ay + ah * 0.32, bw * 0.14, ah * 0.12)
          var legIn = frame === 0 ? 0.08 : 0.22
          ctx.fillRect(bx + bw * legIn, ay + ah * 0.62, bw * 0.14, ah * 0.2)
          ctx.fillRect(bx + bw * (1 - legIn - 0.14), ay + ah * 0.62, bw * 0.14, ah * 0.2)
        }
      }

      // Shields
      ctx.fillStyle = theme.highlight
      for (var si = 0; si < s.shields.length; ++si) {
        var blocks = s.shields[si]
        for (var bi = 0; bi < blocks.length; ++bi) {
          if (!blocks[bi].alive) continue
          ctx.fillRect(blocks[bi].x * w, blocks[bi].y * h, Invaders.SHIELD_BLOCK * w, Invaders.SHIELD_BLOCK * h)
        }
      }

      // Player: a base with a turret.
      ctx.fillStyle = theme.foreground
      var pw = Invaders.PLAYER_W * w, py = Invaders.PLAYER_Y * h
      ctx.fillRect(s.playerX * w, py + 0.01 * h, pw, 0.018 * h)
      ctx.fillRect(s.playerX * w + pw * 0.4, py, pw * 0.2, 0.012 * h)

      // Lives
      ctx.fillStyle = theme.dim
      for (var li = 0; li < s.lives; ++li) ctx.fillRect(8 + li * (pw * 0.5 + 6), h - 10, pw * 0.5, 5)

      // Bullets
      if (s.playerBullet) {
        ctx.fillStyle = theme.foreground
        ctx.fillRect(s.playerBullet.x * w - 1.5, s.playerBullet.y * h - 6, 3, 10)
      }
      ctx.fillStyle = theme.danger
      for (var abi = 0; abi < s.alienBullets.length; ++abi) {
        var ab = s.alienBullets[abi]
        ctx.fillRect(ab.x * w - 1.5, ab.y * h - 6, 3, 10)
      }

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
