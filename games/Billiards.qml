import QtQuick
import "../engine" as Engine
import "logic/billiards.js" as Bil

// Billiards (see logic/billiards.js): eight-ball against the computer.
Engine.GameBase {
  id: root
  gameId: "billiards"
  difficulties: ["Easy", "Normal", "Hard"]
  onDifficultyChanged: Bil.setDifficulty(difficulty)
  title: "BILLIARDS"
  helpText: "LEFT/RIGHT turn the cue (hold for fine steps) · UP/DOWN set power · SPACE shoot (or place the cue ball when you have it in hand) · Eight-ball against the computer: the table is open until someone pots a ball, then pot your group (solids or stripes), then the 8 · Scratch, miss everything or hit the wrong group first and the other side gets the cue ball in hand · Potting the 8 early loses"
  mouseHelp: "Move to aim (distance from the cue ball sets power), click to shoot; with ball in hand click to place the cue ball"

  property var state: null
  property real hx: 0.5
  property real hy: 0.5
  property real cpuWait: 0
  tickInterval: 16
  ownSounds: true
  onStateChanged: playEvents(state)
  ticking: !!state && !state.done
  score: state ? state.score : 0
  overTitle: state ? (state.winner === 0 ? "YOU WIN" : "YOU LOSE") : ""
  progress: state && !state.done ? "shot " + state.shots : ""
  status: !state ? ""
    : over ? state.msg + "  ·  SPACE for a new rack"
    : paused ? "PAUSED"
    : (state.turn === 0 ? "YOUR SHOT" : "COMPUTER") + (state.groups[0] ? "  ·  you: " + state.groups[0] + "s" : "  ·  table open") + (state.msg ? "  ·  " + state.msg : "")

  onTick: {
    state = Bil.step(state, tickInterval / 1000)
    if (state.phase === "roll") { cpuWait = 0.9 }
    else if (state.turn === 1 && (state.phase === "aim" || state.phase === "place") && !state.done) {
      cpuWait -= tickInterval / 1000
      if (cpuWait <= 0) { state = Bil.cpuTurn(state); cpuWait = 0.9 }
    }
    if (state.done) over = true
  }

  function newGame() { state = Bil.makeState(); over = false; paused = false; hx = 0.5; hy = 0.5; cpuWait = 0.9 }
  function saveState() { return state && !over ? Bil.serialize(state) : null }
  function loadState(saved) {
    var s = Bil.deserialize(saved)
    if (s) { state = s; over = false; paused = false; cpuWait = 0.9 } else newGame()
  }
  function human() { return state && !over && state.turn === 0 }
  function moveCursor(dx, dy) {
    if (!human()) return
    if (state.phase === "place") { hx = Math.max(Bil.R, Math.min(Bil.TW - Bil.R, hx + dx * 0.04)); hy = Math.max(Bil.R, Math.min(Bil.TH - Bil.R, hy + dy * 0.04)) }
    else if (state.phase === "aim") state = dx ? Bil.setAim(state, state.aim + dx * 0.03) : Bil.setPower(state, state.power - dy * 0.06)
  }
  function activate() {
    if (over) { newGame(); return }
    if (!human()) return
    if (state.phase === "place") state = Bil.place(state, hx, hy)
    else if (state.phase === "aim") state = Bil.shoot(state)
  }

  function pointer(kind, x, y, b) {
    if (!human()) return
    var wx = (x - board.ox) / board.u, wy = (y - board.oy) / board.u
    if (state.phase === "place") {
      if (kind === "move" || kind === "drag") { hx = wx; hy = wy }
      else if (kind === "press" && b === Qt.LeftButton) { hx = wx; hy = wy; state = Bil.place(state, wx, wy) }
      return
    }
    if (state.phase !== "aim") return
    var c = state.balls[0], dx = wx - c.x, dy = wy - c.y
    if (kind === "move" || kind === "drag") { state = Bil.setAim(state, Math.atan2(dy, dx)); state = Bil.setPower(state, Math.hypot(dx, dy) / 0.8) }
    else if (kind === "wheel") state = Bil.setPower(state, state.power + b * 0.05)
    else if (kind === "press" && b === Qt.LeftButton) state = Bil.shoot(state)
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.fill: parent
    readonly property real u: Math.min(width * 0.94 / 2, height * 0.8)
    readonly property real ox: (width - 2 * u) / 2
    readonly property real oy: (height - u) / 2

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onHxChanged() { board.requestPaint() }
      function onHyChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    function ball(ctx, b, X, Y, u) {
      var r = Bil.R * u, x = X(b.x), y = Y(b.y), g = Bil.groupOf(b.id)
      ctx.fillStyle = b.id === 0 ? theme.foreground : g === "eight" ? theme.background : theme.tone(b.id % 8)
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
      if (g === "stripe") {
        ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip()
        ctx.fillStyle = theme.withAlpha(theme.foreground, 0.9); ctx.fillRect(x - r, y - r, r * 2, r * 0.6); ctx.fillRect(x - r, y + r * 0.4, r * 2, r * 0.6)
        ctx.restore()
      }
      if (b.id > 0) {
        ctx.fillStyle = g === "eight" ? theme.foreground : theme.background; ctx.font = "bold " + Math.floor(r * 0.95) + "px " + theme.fontFamily
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(b.id), x, y + 1)
      }
      if (g === "eight") { ctx.strokeStyle = theme.dim; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke() }
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      var s = root.state
      if (!s) return
      var u = board.u, ox = board.ox, oy = board.oy
      var X = function(x) { return ox + x * u }, Y = function(y) { return oy + y * u }
      var rail = u * 0.07
      ctx.fillStyle = theme.withAlpha(theme.tone(2), 0.55); ctx.fillRect(ox - rail, oy - rail, 2 * u + rail * 2, u + rail * 2)
      ctx.fillStyle = theme.withAlpha(theme.tone(4), 0.4); ctx.fillRect(ox, oy, 2 * u, u)
      ctx.fillStyle = theme.background
      Bil.POCKETS.forEach(function(p) { ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), p.r * u, 0, Math.PI * 2); ctx.fill() })
      var c = s.balls[0]
      var inHand = s.phase === "place" && s.turn === 0
      if (inHand) { ctx.globalAlpha = 0.6; board.ball(ctx, { id: 0, x: root.hx, y: root.hy }, X, Y, u); ctx.globalAlpha = 1 }
      s.balls.forEach(function(b) { if (!b.in && !(b.id === 0 && inHand)) board.ball(ctx, b, X, Y, u) })
      // Cue, aim line and power while it's your shot.
      if (s.phase === "aim" && s.turn === 0 && !c.in) {
        var ca = Math.cos(s.aim), sa = Math.sin(s.aim)
        ctx.strokeStyle = theme.withAlpha(theme.accent, 0.7); ctx.lineWidth = 1.5; ctx.setLineDash([5, 5])
        ctx.beginPath(); ctx.moveTo(X(c.x), Y(c.y)); ctx.lineTo(X(c.x) + ca * u * 0.7, Y(c.y) + sa * u * 0.7); ctx.stroke(); ctx.setLineDash([])
        var pull = u * (0.04 + s.power * 0.18)
        ctx.strokeStyle = theme.tone(3); ctx.lineWidth = Math.max(3, u * 0.012)
        ctx.beginPath(); ctx.moveTo(X(c.x) - ca * (Bil.R * u + pull), Y(c.y) - sa * (Bil.R * u + pull)); ctx.lineTo(X(c.x) - ca * (Bil.R * u + pull + u * 0.5), Y(c.y) - sa * (Bil.R * u + pull + u * 0.5)); ctx.stroke()
      }
      // Potted balls in the tray below the table, and the power bar.
      var py = oy + u + rail + 12, k = 0
      s.balls.forEach(function(b) { if (b.in && b.id > 0) { board.ball(ctx, { id: b.id, x: (ox + 14 + k * Bil.R * 2.4 * u - ox) / u, y: (py + Bil.R * u - oy) / u }, X, Y, u); k++ } })
      ctx.fillStyle = theme.faint; ctx.fillRect(ox + 2 * u * 0.7, py, 2 * u * 0.3, 10)
      ctx.fillStyle = theme.accent; ctx.fillRect(ox + 2 * u * 0.7, py, 2 * u * 0.3 * s.power, 10)
      if (root.paused) { ctx.fillStyle = theme.background; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1 }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
