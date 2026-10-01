import QtQuick
import "../engine" as Engine
import "logic/raid.js" as Raid

// Raid (see logic/raid.js): a side-scrolling shooter in the Gradius mould.
Engine.GameBase {
  id: root
  gameId: "raid"
  difficulties: ["Easy", "Normal", "Hard"]
  onDifficultyChanged: Raid.setDifficulty(difficulty)
  title: "RAID"
  helpText: "ARROWS fly · hold SPACE fire · Shoot drone lines and gunships; grab capsules: P adds double shot, then a spread; S is a one-hit shield · Each stage ends with a boss · Dying drops you back to a single shot · Three lives"
  mouseHelp: "The ship follows the pointer; hold the button to fire"

  property var state: null
  property bool mouseDown: false
  property real mx: 0
  property real my: 0
  property bool usingMouse: false
  tickInterval: 16
  ownSounds: true
  onStateChanged: playEvents(state)
  ticking: !!state && !state.done
  continuousMove: true
  score: state ? state.score : 0
  overTitle: state ? "STAGE " + state.wave + " · " + state.score : ""
  progress: state ? "stage " + state.wave : ""
  status: !state ? ""
    : over ? "SHOT DOWN in stage " + state.wave + "  ·  SPACE to fly again"
    : paused ? "PAUSED"
    : "STAGE " + state.wave + "  ·  " + new Array(Math.max(0, state.lives)).fill("▲").join(" ") + (state.boss ? "  ·  BOSS" : "") + "  ·  shot " + state.power + (state.shield ? " +shield" : "")

  onTick: {
    var dx = heldDx, dy = heldDy, fire = heldAction
    if (usingMouse) {
      var ex = mx - state.ship.x, ey = my - state.ship.y
      dx = Math.abs(ex) > 0.02 ? Math.sign(ex) : 0; dy = Math.abs(ey) > 0.02 ? Math.sign(ey) : 0
      fire = mouseDown || heldAction
      if (!dx && !dy) { dx = 0; dy = 0 }
    }
    state = Raid.step(Raid.setInput(state, dx, dy, fire), tickInterval / 1000)
    if (state.done) over = true
  }

  function saveState() { return state && !over ? Raid.serialize(state) : null }
  function loadState(saved) {
    var s = Raid.deserialize(saved)
    if (s) { state = s; over = false; paused = false } else newGame()
  }
  function newGame() { state = Raid.makeState(); over = false; paused = false; mouseDown = false; usingMouse = false }
  function moveCursor(dx, dy) { usingMouse = false }
  function activate() { if (over) newGame() }

  function pointer(kind, x, y, b) {
    mx = (x - board.ox) / board.u; my = (y - board.oy) / board.u
    if (kind === "move" || kind === "drag") usingMouse = true
    if (kind === "press" && b === Qt.LeftButton) { mouseDown = true; usingMouse = true }
    else if (kind === "release") mouseDown = false
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.fill: parent
    readonly property real u: Math.min(width / 1.6, height * 0.96)
    readonly property real ox: (width - 1.6 * u) / 2
    readonly property real oy: (height - u) / 2

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
      var u = board.u, ox = board.ox, oy = board.oy
      var X = function(x) { return ox + x * u }, Y = function(y) { return oy + y * u }
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.05); ctx.fillRect(ox, oy, 1.6 * u, u)
      // Stars.
      ctx.fillStyle = theme.dim
      for (var i = 0; i < 40; ++i) {
        var layer = 1 + (i % 3), sx = ((i * 0.137 + 5 - s.t * 0.05 * layer) % 1.6 + 1.6) % 1.6, sy = (i * 0.371) % 1
        ctx.fillRect(X(sx), Y(sy), layer, layer)
      }
      // Capsules.
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "bold " + Math.floor(u * 0.035) + "px " + theme.fontFamily
      s.caps.forEach(function(c) {
        ctx.fillStyle = c.kind === "shield" ? theme.tone(1) : theme.tone(3); ctx.beginPath(); ctx.arc(X(c.x), Y(c.y), u * 0.026, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = theme.background; ctx.fillText(c.kind === "shield" ? "S" : "P", X(c.x), Y(c.y))
      })
      // Enemies.
      s.enemies.forEach(function(e) {
        ctx.fillStyle = e.type === "gunner" ? theme.tone(2) : e.type === "diver" ? theme.danger : theme.tone(4)
        var x = X(e.x), y = Y(e.y), r = u * (e.type === "gunner" ? 0.035 : 0.026)
        ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r * 0.7, y - r); ctx.lineTo(x + r * 0.7, y + r); ctx.closePath(); ctx.fill()
        if (e.carrier) { ctx.strokeStyle = theme.highlight; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r * 1.3, 0, Math.PI * 2); ctx.stroke() }
      })
      if (s.boss) {
        var b = s.boss, bx = X(b.x), by = Y(b.y)
        ctx.fillStyle = theme.tone(5); ctx.fillRect(bx - u * 0.09, by - u * 0.12, u * 0.18, u * 0.24)
        ctx.fillStyle = theme.danger; ctx.fillRect(bx - u * 0.12, by - u * 0.03, u * 0.06, u * 0.06)
        ctx.fillStyle = theme.faint; ctx.fillRect(X(0.4), Y(0.02), u * 0.8, 6)
        ctx.fillStyle = theme.danger; ctx.fillRect(X(0.4), Y(0.02), u * 0.8 * Math.max(0, b.hp / b.max), 6)
      }
      // Shots.
      ctx.fillStyle = theme.accent
      s.bullets.forEach(function(b) { ctx.fillRect(X(b.x) - 4, Y(b.y) - 1.5, 9, 3) })
      ctx.fillStyle = theme.danger
      s.shots.forEach(function(b) { ctx.beginPath(); ctx.arc(X(b.x), Y(b.y), Math.max(2.5, u * 0.01), 0, Math.PI * 2); ctx.fill() })
      // Ship.
      if (!(s.inv > 0 && Math.floor(s.t * 12) % 2 === 0)) {
        var px = X(s.ship.x), py = Y(s.ship.y), r = u * 0.03
        ctx.fillStyle = theme.accent
        ctx.beginPath(); ctx.moveTo(px + r, py); ctx.lineTo(px - r, py - r * 0.8); ctx.lineTo(px - r * 0.5, py); ctx.lineTo(px - r, py + r * 0.8); ctx.closePath(); ctx.fill()
        if (s.shield) { ctx.strokeStyle = theme.tone(1); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, r * 1.6, 0, Math.PI * 2); ctx.stroke() }
      }
      s.booms.forEach(function(e) {
        ctx.strokeStyle = theme.withAlpha(theme.highlight, Math.min(1, e.life * 2)); ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(X(e.x), Y(e.y), u * (0.05 - e.life * 0.04) + 4, 0, Math.PI * 2); ctx.stroke()
      })
      if (root.paused) { ctx.fillStyle = theme.background; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1 }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
