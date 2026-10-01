import QtQuick
import "../engine/Rng.js" as Rng
import "../engine" as Engine
import "logic/asteroids.js" as Asteroids

// Vector Asteroids. LEFT/RIGHT rotate and UP thrusts for as long as they're
// held (continuousMove); SPACE fires, and holding it auto-fires.
Engine.GameBase {
  id: root
  gameId: "asteroids"
  title: "ROCKFALL"
  helpText: "LEFT/RIGHT rotate · UP thrust · SPACE fire (hold to keep firing) · edges wrap · extra ship every 10,000"
  mouseHelp: "The ship turns to face the pointer; LEFT fires (hold for more), RIGHT held thrusts. Touching a key hands steering back to the keyboard"

  property var state: null
  tickInterval: 16
  continuousMove: true
  ticking: !!state && state.alive && !over
  score: state ? state.score : 0
  overTitle: state ? "WAVE " + state.wave + " · " + state.score : ""
  status: !state ? ""
    : (over ? "GAME OVER  ·  N for a new game"
      : (paused ? "PAUSED" : "WAVE " + state.wave + "  ·  " + state.lives + " ships"))

  onTick: {
    var dt = tickInterval / 1000
    var s = state
    if (heldAction) s = Asteroids.fire(s)
    state = Asteroids.step(s, { turn: heldDx || aimTurn(), thrust: heldDy < 0 || mouseThrust }, dt)
    if (!state.alive) over = true
  }

  function newGame() {
    state = Asteroids.makeState()
    over = false
    paused = false
  }

  // Taps still nudge the heading even between ticks.
  function moveCursor(dx, dy) {}

  function activate() {
    if (over) { newGame(); return }
    if (state) state = Asteroids.fire(state)
  }

  function saveState() {
    if (!state || over) return null
    return Asteroids.serialize(state)
  }

  function loadState(saved) {
    var restored = Asteroids.deserialize(saved)
    if (restored) { state = restored; over = false }
    else newGame()
  }

  // Mouse (engine/Pointer.qml): the ship turns to face the pointer; LEFT
  // fires (hold for more), RIGHT held thrusts. Touching a key hands
  // steering back to the keyboard.
  property var aimAt: null        // { x, y } in field units, or null
  property bool mouseThrust: false
  function pointer(kind, x, y, b) {
    if (!state || over) return
    aimAt = { x: x / board.unit, y: y / board.unit }
    if (kind === "press") {
      if (b === Qt.LeftButton) { state = Asteroids.fire(state); heldAction = true }
      else if (b === Qt.RightButton) mouseThrust = true
    } else if (kind === "release") { heldAction = false; mouseThrust = false }
  }
  onHeldDxChanged: if (heldDx) aimAt = null
  function aimTurn() {
    if (!aimAt || !state || state.respawn > 0) return 0
    var sh = state.ship, want = Math.atan2(aimAt.y - sh.y, aimAt.x - sh.x)
    var diff = Math.atan2(Math.sin(want - sh.a), Math.cos(want - sh.a))
    return Math.abs(diff) < 0.08 ? 0 : diff > 0 ? 1 : -1
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root; shape: Qt.CrossCursor }
    anchors.centerIn: parent
    readonly property real unit: Math.min(parent.width / Asteroids.W, parent.height / Asteroids.H)
    width: unit * Asteroids.W
    height: unit * Asteroids.H

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onOverChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    // Draws `fn` at (x,y) and again across any seam it overlaps, so shapes
    // slide smoothly off one edge and onto the other.
    function wrapped(ctx, x, y, r, fn) {
      var u = unit
      var xs = [x], ys = [y]
      if (x < r) xs.push(x + Asteroids.W); else if (x > Asteroids.W - r) xs.push(x - Asteroids.W)
      if (y < r) ys.push(y + Asteroids.H); else if (y > Asteroids.H - r) ys.push(y - Asteroids.H)
      for (var i = 0; i < xs.length; ++i)
        for (var j = 0; j < ys.length; ++j) fn(xs[i] * u, ys[j] * u)
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state, u = unit

      ctx.strokeStyle = theme.faint
      ctx.lineWidth = 1
      ctx.strokeRect(0.5, 0.5, width - 1, height - 1)

      ctx.lineJoin = "round"
      ctx.lineWidth = Math.max(1.5, u * 0.004)

      // Rocks
      for (var i = 0; i < s.rocks.length; ++i) {
        var rk = s.rocks[i]
        var rr = Asteroids.ROCK_R[rk.size]
        ctx.strokeStyle = theme.tone(rk.size - 1)
        wrapped(ctx, rk.x, rk.y, rr, function(px, py) {
          ctx.beginPath()
          for (var v = 0; v < rk.verts.length; ++v) {
            var a = rk.rot + v / rk.verts.length * Math.PI * 2
            var rad = rr * rk.verts[v] * u
            var vx = px + Math.cos(a) * rad, vy = py + Math.sin(a) * rad
            if (v === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy)
          }
          ctx.closePath()
          ctx.stroke()
        })
      }

      // Bullets
      ctx.fillStyle = theme.foreground
      for (var b = 0; b < s.bullets.length; ++b) {
        var bl = s.bullets[b]
        ctx.beginPath(); ctx.arc(bl.x * u, bl.y * u, Math.max(1.5, u * 0.004), 0, Math.PI * 2); ctx.fill()
      }

      // Sparks
      for (var p = 0; p < s.sparks.length; ++p) {
        var sp = s.sparks[p]
        ctx.fillStyle = theme.withAlpha(theme.accent, Math.min(1, sp.life * 1.6))
        ctx.fillRect(sp.x * u - 1, sp.y * u - 1, 2, 2)
      }

      // Ship (blinks while invulnerable)
      var sh = s.ship
      if (s.respawn === 0 && !(sh.inv > 0 && Math.floor(sh.inv * 8) % 2 === 0)) {
        var R = Asteroids.SHIP_R
        wrapped(ctx, sh.x, sh.y, R * 1.5, function(px, py) {
          ctx.save()
          ctx.translate(px, py)
          ctx.rotate(sh.a)
          ctx.strokeStyle = theme.foreground
          ctx.beginPath()
          ctx.moveTo(R * 1.4 * u, 0)
          ctx.lineTo(-R * u, R * 0.85 * u)
          ctx.lineTo(-R * 0.6 * u, 0)
          ctx.lineTo(-R * u, -R * 0.85 * u)
          ctx.closePath()
          ctx.stroke()
          if (s.thrusting && Rng.random() < 0.8) {
            ctx.strokeStyle = theme.danger
            ctx.beginPath()
            ctx.moveTo(-R * 0.7 * u, R * 0.4 * u)
            ctx.lineTo(-R * (1.3 + Rng.random() * 0.5) * u, 0)
            ctx.lineTo(-R * 0.7 * u, -R * 0.4 * u)
            ctx.stroke()
          }
          ctx.restore()
        })
      }

      // Lives as little ships.
      ctx.strokeStyle = theme.dim
      ctx.lineWidth = 1.5
      for (var l = 0; l < s.lives; ++l) {
        var lx = 14 + l * 16, ly = 16
        ctx.beginPath()
        ctx.moveTo(lx, ly - 7); ctx.lineTo(lx + 5, ly + 6); ctx.lineTo(lx, ly + 3); ctx.lineTo(lx - 5, ly + 6)
        ctx.closePath(); ctx.stroke()
      }

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
