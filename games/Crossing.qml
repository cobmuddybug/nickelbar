import QtQuick
import "../engine" as Engine
import "logic/crossing.js" as Crossing

// Frogger-style crossing: hop the road, ride the river, fill all five bays.
Engine.GameBase {
  id: root
  gameId: "crossing"
  title: "CROSSING"
  helpText: "ARROWS hop one square · ride logs and turtles across the river (turtles dive!) · fill all five bays for a faster level · 30s per crossing"
  mouseHelp: "Click to hop toward that spot (along whichever axis it's further off)"

  property var state: null
  tickInterval: 16
  ticking: !!state && state.alive && !over
  score: state ? state.score : 0
  overTitle: state ? "LEVEL " + (state.level + 1) + " · " + state.score : ""
  status: !state ? ""
    : (over ? "GAME OVER  ·  N for a new game"
      : (paused ? "PAUSED"
        : (state.dying > 0 ? state.lastDeath.toUpperCase() + "!" : "LEVEL " + (state.level + 1) + "  ·  " + state.lives + " lives  ·  " + Math.ceil(state.timeLeft) + "s")))

  onTick: {
    state = Crossing.step(state, tickInterval / 1000)
    if (!state.alive) over = true
  }

  function newGame() {
    state = Crossing.makeState()
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {
    if (over || !state) return
    state = Crossing.hop(state, dx, dy)
  }

  function activate() { if (over) newGame() }

  function saveState() {
    if (!state || over) return null
    return Crossing.serialize(state)
  }

  function loadState(saved) {
    var restored = Crossing.deserialize(saved)
    if (restored) { state = restored; over = false }
    else newGame()
  }

  // Mouse (engine/Pointer.qml): click to hop toward that spot (along
  // whichever axis it's further off).
  function pointer(kind, x, y, b) {
    if (!state || over || kind !== "press" || b !== Qt.LeftButton) return
    var c = board.cell, dx = x - (state.frog.x + 0.5) * c, dy = y - (state.frog.y + 0.5) * c
    if (Math.abs(dx) < c / 2 && Math.abs(dy) < c / 2) return
    if (Math.abs(dx) > Math.abs(dy)) moveCursor(dx < 0 ? -1 : 1, 0)
    else moveCursor(0, dy < 0 ? -1 : 1)
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property real cell: Math.floor(Math.min(parent.width / Crossing.COLS, parent.height / Crossing.ROWS))
    width: cell * Crossing.COLS
    height: cell * Crossing.ROWS

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

      // Bands: hedge/home, river, median, road, verge.
      ctx.fillStyle = theme.withAlpha(theme.tone(4), 0.25)
      ctx.fillRect(0, 0, width, c)
      ctx.fillStyle = theme.withAlpha(theme.tone(3), 0.22)
      ctx.fillRect(0, c, width, c * 5)
      ctx.fillStyle = theme.withAlpha(theme.tone(4), 0.18)
      ctx.fillRect(0, c * 6, width, c)
      ctx.fillRect(0, c * 12, width, c)
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.04)
      ctx.fillRect(0, c * 7, width, c * 5)
      ctx.strokeStyle = theme.withAlpha(theme.foreground, 0.2)
      ctx.setLineDash([c * 0.4, c * 0.4])
      for (var ly = 8; ly < 12; ++ly) { ctx.beginPath(); ctx.moveTo(0, ly * c); ctx.lineTo(width, ly * c); ctx.stroke() }
      ctx.setLineDash([])

      // Home bays
      for (var b = 0; b < Crossing.BAYS.length; ++b) {
        var bx = (Crossing.BAYS[b] - 0.05) * c
        ctx.fillStyle = theme.background
        ctx.fillRect(bx, c * 0.1, c * 1.1, c * 0.9)
        if (s.bays[b]) {
          ctx.fillStyle = theme.accent
          ctx.beginPath(); ctx.arc(bx + c * 0.55, c * 0.55, c * 0.3, 0, Math.PI * 2); ctx.fill()
        }
      }

      // Lane traffic
      for (var i = 0; i < s.lanes.length; ++i) {
        var lane = s.lanes[i]
        var y = lane.row * c
        for (var k = 0; k < lane.items.length; ++k) {
          var x = Crossing.itemX(lane, lane.items[k]) * c
          var w = lane.len * c
          if (lane.kind === "log") {
            ctx.fillStyle = theme.withAlpha(theme.tone(2), 0.85)
            ctx.fillRect(x + 2, y + c * 0.18, w - 4, c * 0.64)
            ctx.strokeStyle = theme.withAlpha(theme.background, 0.4)
            ctx.beginPath(); ctx.moveTo(x + 6, y + c * 0.5); ctx.lineTo(x + w - 6, y + c * 0.5); ctx.stroke()
          } else if (lane.kind === "turtle") {
            var up = Crossing.turtlesUp(lane, k, s.clock)
            ctx.fillStyle = theme.withAlpha(theme.tone(1), up ? 0.9 : 0.25)
            for (var t = 0; t < lane.len; ++t) {
              ctx.beginPath(); ctx.arc(x + (t + 0.5) * c, y + c / 2, c * 0.36, 0, Math.PI * 2); ctx.fill()
            }
          } else {
            ctx.fillStyle = lane.kind === "truck" ? theme.tone(5) : theme.tone(lane.row)
            ctx.fillRect(x + 3, y + c * 0.16, w - 6, c * 0.68)
            ctx.fillStyle = theme.withAlpha(theme.background, 0.5)
            var front = lane.speed > 0 ? x + w - 3 - c * 0.22 : x + 3
            ctx.fillRect(front, y + c * 0.24, c * 0.22, c * 0.52)
          }
        }
      }

      // Hopper
      var f = s.frog
      var fx = f.x * c + c / 2, fy = f.y * c + c / 2
      if (s.dying > 0) {
        ctx.strokeStyle = theme.danger
        ctx.lineWidth = 3
        var rr = c * (0.2 + (0.9 - s.dying) * 0.5)
        ctx.beginPath(); ctx.arc(fx, fy, rr, 0, Math.PI * 2); ctx.stroke()
        ctx.lineWidth = 1
      } else {
        ctx.fillStyle = theme.foreground
        ctx.beginPath(); ctx.arc(fx, fy, c * 0.32, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = theme.background
        ctx.beginPath(); ctx.arc(fx - c * 0.12, fy - c * 0.1, c * 0.07, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(fx + c * 0.12, fy - c * 0.1, c * 0.07, 0, Math.PI * 2); ctx.fill()
      }

      // Timer bar along the bottom verge.
      var frac = Math.max(0, s.timeLeft / Crossing.TIME_LIMIT)
      ctx.fillStyle = frac < 0.25 ? theme.danger : theme.dim
      ctx.fillRect(0, height - 4, width * frac, 4)

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
