import QtQuick
import "../engine" as Engine
import "logic/airhockey.js" as AirHockey

// Air Hockey against the computer: you are the left mallet. Mallets stay in
// their own half; a hard swing sends the puck fast. First to seven.
Engine.GameBase {
  id: root
  gameId: "airhockey"
  difficulties: ["Easy", "Normal", "Hard"]
  onDifficultyChanged: AirHockey.setDifficulty(difficulty)
  title: "AIR HOCKEY"
  helpText: "ARROWS move your mallet (hold to glide) · SPACE/ENTER serve · the mallet stays in your half · a fast swing sends the puck fast · first to 7 · the computer sharpens as you score"
  mouseHelp: "The mallet follows the pointer; click serves"

  property var state: null
  property bool usingMouse: false
  property bool keysWereHeld: false

  tickInterval: 16
  continuousMove: true
  ticking: !!state && state.alive && !over
  score: state ? state.playerScore : 0
  overTitle: state ? (state.playerScore > state.aiScore ? "YOU WIN " : "COMPUTER WINS ") + state.playerScore + " – " + state.aiScore : ""
  status: !state ? ""
    : (over ? overTitle + "  ·  N for a new game"
      : (paused ? "PAUSED" : state.playerScore + " – " + state.aiScore + (state.inPlay ? "" : "  ·  SPACE to serve")))

  onTick: {
    var dt = tickInterval / 1000
    var s = state
    if (heldDx !== 0 || heldDy !== 0) {
      usingMouse = false; keysWereHeld = true
      s = AirHockey.setTarget(s, s.player.x + heldDx * 60, s.player.y + heldDy * 60)
    } else if (keysWereHeld) {
      keysWereHeld = false
      s = AirHockey.setTarget(s, s.player.x, s.player.y)
    }
    s = AirHockey.step(s, dt)
    if (s !== state) state = s
    if (!state.alive) over = true
  }

  function newGame() { state = AirHockey.makeState(); over = false; paused = false; usingMouse = false }

  function moveCursor(dx, dy) {}

  function activate() {
    if (over) { newGame(); return }
    if (state && !state.inPlay) state = AirHockey.serve(state)
  }

  function saveState() { return state && !over ? AirHockey.serialize(state) : null }
  function loadState(saved) {
    var r = AirHockey.deserialize(saved)
    if (r) { state = r; over = !r.alive } else newGame()
  }

  function pointer(kind, x, y, b) {
    if (!state || over) return
    var g = board.geo
    if (kind === "move" || kind === "drag" || kind === "press") {
      usingMouse = true
      state = AirHockey.setTarget(state, (x - g.ox) / g.sc, (y - g.oy) / g.sc)
    }
    if (kind === "press" && b === Qt.LeftButton) activate()
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root; shape: Qt.BlankCursor }
    anchors.fill: parent

    readonly property var geo: {
      var sc = Math.min(width * 0.96 / AirHockey.W, height * 0.94 / AirHockey.H)
      return { sc: sc, ox: (width - AirHockey.W * sc) / 2, oy: (height - AirHockey.H * sc) / 2 }
    }

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
      var s = root.state, g = board.geo, W = AirHockey.W, H = AirHockey.H, sc = g.sc
      if (sc <= 0) return
      function X(v) { return g.ox + v * sc }
      function Y(v) { return g.oy + v * sc }
      // rink
      ctx.fillStyle = theme.faint; ctx.globalAlpha = 0.45
      ctx.fillRect(X(0), Y(0), W * sc, H * sc); ctx.globalAlpha = 1
      ctx.strokeStyle = theme.dim; ctx.lineWidth = 3
      ctx.strokeRect(X(0), Y(0), W * sc, H * sc)
      // centre line and circle
      ctx.strokeStyle = theme.faint; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(X(W / 2), Y(0)); ctx.lineTo(X(W / 2), Y(H)); ctx.stroke()
      ctx.beginPath(); ctx.arc(X(W / 2), Y(H / 2), 16 * sc, 0, Math.PI * 2); ctx.stroke()
      // goals: the gap in each end wall, and the crease in front
      var gy0 = (H - AirHockey.GOAL) / 2
      ctx.fillStyle = theme.background
      ctx.fillRect(X(-3), Y(gy0), 6 * sc, AirHockey.GOAL * sc)
      ctx.fillRect(X(W - 3), Y(gy0), 6 * sc, AirHockey.GOAL * sc)
      ctx.strokeStyle = theme.dim; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(X(0), Y(H / 2), 26 * sc, -Math.PI / 2, Math.PI / 2); ctx.stroke()
      ctx.beginPath(); ctx.arc(X(W), Y(H / 2), 26 * sc, Math.PI / 2, Math.PI * 1.5); ctx.stroke()
      // score, faded
      ctx.fillStyle = theme.faint
      ctx.font = "bold " + Math.floor(H * sc * 0.3) + "px " + theme.fontFamily
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.fillText(String(s.playerScore), X(W * 0.25), Y(H / 2))
      ctx.fillText(String(s.aiScore), X(W * 0.75), Y(H / 2))
      // mallets
      function mallet(m, col) {
        ctx.fillStyle = col
        ctx.beginPath(); ctx.arc(X(m.x), Y(m.y), AirHockey.MALLET_R * sc, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = theme.background; ctx.globalAlpha = 0.5
        ctx.beginPath(); ctx.arc(X(m.x), Y(m.y), AirHockey.MALLET_R * sc * 0.45, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1
      }
      mallet(s.player, theme.foreground)
      mallet(s.ai, theme.danger)
      // puck
      ctx.fillStyle = theme.accent
      ctx.beginPath(); ctx.arc(X(s.puck.x), Y(s.puck.y), AirHockey.PUCK_R * sc, 0, Math.PI * 2); ctx.fill()
      if (root.paused || root.over) {
        ctx.fillStyle = theme.background
        ctx.globalAlpha = root.paused ? 0.7 : 0.35
        ctx.fillRect(0, 0, width, height)
        ctx.globalAlpha = 1
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
