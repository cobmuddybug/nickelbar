import QtQuick
import "../engine" as Engine
import "logic/bumper.js" as Bump

// Bumper Cars (see logic/bumper.js): sumo on wheels. Hold a direction to
// push that way, SPACE to boost, and knock the other cars off the edge.
Engine.GameBase {
  id: root
  gameId: "bumpercars"
  difficulties: ["Easy", "Normal", "Hard"]
  onDifficultyChanged: Bump.setDifficulty(difficulty)
  title: "BUMPER CARS"
  helpText: "ARROWS push that way (hold; the cars slide) · SPACE boost: a dash that hits far harder, then the meter refills · Knock every other car off the edge; cars you shove out score 100 (25 if they fell alone) · Clear a round for a bonus and a bigger field · Fall off yourself and it is over"
  mouseHelp: "Hold the button to push toward the pointer; right-click to boost"

  property var state: null
  property real mx: 0
  property real my: 0
  property bool mouseDown: false
  tickInterval: 16
  ownSounds: true
  onStateChanged: playEvents(state)
  ticking: !!state && !state.done
  continuousMove: true
  score: state ? state.score : 0
  overTitle: state ? "ROUND " + state.round + " · " + state.score : ""
  progress: state ? "round " + state.round : ""
  status: !state ? ""
    : over ? "KNOCKED OUT in round " + state.round + "  ·  SPACE to play again"
    : paused ? "PAUSED"
    : "ROUND " + state.round + "  ·  " + state.cars.filter(function(c, i) { return i > 0 && !c.out }).length + " cars left"

  onTick: {
    var ix = heldDx, iy = heldDy
    if (mouseDown) { var dx = mx - state.cars[0].x, dy = my - state.cars[0].y, l = Math.hypot(dx, dy) || 1; ix = dx / l; iy = dy / l }
    state = Bump.step(Bump.setInput(state, ix, iy), tickInterval / 1000)
    if (state.done) over = true
  }

  function saveState() { return state && !over ? Bump.serialize(state) : null }
  function loadState(saved) {
    var s = Bump.deserialize(saved)
    if (s) { state = s; over = false; paused = false; mouseDown = false } else newGame()
  }
  function newGame() { state = Bump.makeState(); over = false; paused = false; mouseDown = false }
  function moveCursor(dx, dy) {}
  function activate() { if (over) newGame(); else if (state) state = Bump.boost(state) }

  function pointer(kind, x, y, b) {
    var u = board.u
    mx = (x - board.width / 2) / u; my = (y - board.height / 2) / u
    if (kind === "press") { if (b === Qt.RightButton) activate(); else mouseDown = true }
    else if (kind === "release") mouseDown = false
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.fill: parent
    readonly property real u: Math.min(width, height * 0.94) / 1.1

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
      var u = board.u, cx = width / 2, cy = height / 2
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.07)
      ctx.beginPath(); ctx.arc(cx, cy, Bump.R * u, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = theme.danger; ctx.lineWidth = 3
      ctx.beginPath(); ctx.arc(cx, cy, Bump.R * u + 1.5, 0, Math.PI * 2); ctx.stroke()
      for (var i = s.cars.length - 1; i >= 0; --i) {
        var c = s.cars[i]
        if (c.out) continue
        var x = cx + c.x * u, y = cy + c.y * u, r = Bump.CAR * u
        ctx.fillStyle = i === 0 ? theme.accent : theme.tone(i + 1)
        if (c.boost > 0) { ctx.strokeStyle = theme.highlight; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r * 1.35, 0, Math.PI * 2); ctx.stroke() }
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = theme.background; ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + c.fx * r * 0.9, y + c.fy * r * 0.9); ctx.stroke()
        if (i === 0) { ctx.fillStyle = theme.background; ctx.beginPath(); ctx.arc(x, y, r * 0.3, 0, Math.PI * 2); ctx.fill() }
      }
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      for (var k = 0; k < s.pops.length; ++k) {
        var pp = s.pops[k]
        ctx.fillStyle = theme.withAlpha(theme.highlight, Math.min(1, pp.life * 2)); ctx.font = "bold " + Math.floor(u * 0.06) + "px " + theme.fontFamily
        ctx.fillText("+" + pp.v, cx + pp.x * u, cy + pp.y * u - (1 - pp.life) * 20)
      }
      // Boost meter.
      var bw = u * 0.6, by = cy + Bump.R * u + 14
      ctx.fillStyle = theme.faint; ctx.fillRect(cx - bw / 2, by, bw, 8)
      ctx.fillStyle = s.cars[0].meter >= Bump.BOOST_COST ? theme.accent : theme.dim; ctx.fillRect(cx - bw / 2, by, bw * s.cars[0].meter, 8)
      if (root.paused) { ctx.fillStyle = theme.background; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1 }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
