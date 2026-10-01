import QtQuick
import "../engine" as Engine
import "logic/missile.js" as Missile

// Missile Command. Arrows steer the crosshair for as long as they're held;
// SPACE fires from the nearest battery with ammo (hold to keep firing).
Engine.GameBase {
  id: root
  gameId: "missile"
  title: "SKYGUARD"
  helpText: "ARROWS move the crosshair · SPACE fire from the nearest battery (hold for more) · blasts catch anything flying through · wave bonus for cities and unused missiles · spare city every 10,000"
  mouseHelp: "The crosshair follows the pointer; click fires (hold to keep firing)"

  property var state: null
  tickInterval: 16
  continuousMove: true
  ticking: !!state && state.alive && !over
  score: state ? state.score : 0
  overTitle: state ? "WAVE " + state.wave + " · " + state.score : ""
  status: !state ? ""
    : (over ? "THE END  ·  N for a new game"
      : (paused ? "PAUSED"
        : "WAVE " + state.wave + "  ·  ×" + Missile.multiplier(state.wave) + "  ·  "
          + Missile.citiesLeft(state) + " cities" + (state.spare ? " +" + state.spare + " spare" : "")))

  property real fireCooldown: 0

  onTick: {
    var dt = tickInterval / 1000
    fireCooldown = Math.max(0, fireCooldown - dt)
    var s = state
    if (heldAction && fireCooldown === 0) { s = Missile.fire(s); fireCooldown = 0.28 }
    state = Missile.step(s, { dx: heldDx, dy: heldDy }, dt)
    if (!state.alive) over = true
  }

  function newGame() {
    state = Missile.makeState()
    over = false
    paused = false
  }

  // Taps nudge the crosshair between ticks.
  function moveCursor(dx, dy) {
    if (over || !state || paused) return
    state = Missile.moveCross(state, dx, dy, 0.02)
  }

  function activate() {
    if (over) { newGame(); return }
    if (state) { state = Missile.fire(state); fireCooldown = 0.28 }
  }

  function saveState() {
    if (!state || over) return null
    return Missile.serialize(state)
  }

  function loadState(saved) {
    var restored = Missile.deserialize(saved)
    if (restored) { state = restored; over = false }
    else newGame()
  }

  // Mouse (engine/Pointer.qml): the crosshair follows the pointer; click
  // fires (hold to keep firing).
  function pointer(kind, x, y, b) {
    if (!state || over) return
    if (kind === "move" || kind === "drag" || kind === "press")
      state = Missile.aim(state, x / board.unit, y / board.unit)
    if (kind === "press" && b === Qt.LeftButton) { activate(); heldAction = true }
    if (kind === "release") heldAction = false
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root; shape: Qt.CrossCursor }
    anchors.centerIn: parent
    readonly property real unit: Math.min(parent.width / Missile.W, parent.height / Missile.H)
    width: unit * Missile.W
    height: unit * Missile.H

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
      var s = root.state, u = unit
      var gy = Missile.GROUND * u

      ctx.strokeStyle = theme.faint
      ctx.lineWidth = 1
      ctx.strokeRect(0.5, 0.5, width - 1, height - 1)

      // Ground, with a mound under each battery.
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.14)
      ctx.fillRect(0, gy, width, height - gy)
      for (var b = 0; b < s.batteries.length; ++b) {
        var bx = Missile.BATTERY_X[b] * u, bat = s.batteries[b]
        ctx.beginPath()
        ctx.moveTo(bx - 0.06 * u, gy); ctx.lineTo(bx - 0.025 * u, gy - 0.035 * u)
        ctx.lineTo(bx + 0.025 * u, gy - 0.035 * u); ctx.lineTo(bx + 0.06 * u, gy); ctx.closePath()
        ctx.fillStyle = theme.withAlpha(theme.foreground, 0.14)
        ctx.fill()
        if (!bat.alive) {
          ctx.fillStyle = theme.danger
          ctx.fillRect(bx - 0.012 * u, gy - 0.05 * u, 0.024 * u, 0.012 * u)
          continue
        }
        // Ammo as a little pyramid of pips.
        ctx.fillStyle = theme.foreground
        var shown = 0, pr = Math.max(1.2, 0.0045 * u)
        for (var row = 0; row < 4 && shown < bat.ammo; ++row)
          for (var col = 0; col <= row && shown < bat.ammo; ++col, ++shown) {
            var px = bx + (col - row / 2) * pr * 3, py = gy - 0.045 * u + row * pr * 2.6
            ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2)
          }
      }

      // Cities: a small skyline each, rubble when lost.
      for (var c = 0; c < s.cities.length; ++c) {
        var cx = Missile.CITY_X[c] * u
        if (!s.cities[c]) {
          ctx.fillStyle = theme.faint
          ctx.fillRect(cx - 0.03 * u, gy - 0.008 * u, 0.06 * u, 0.008 * u)
          continue
        }
        var heights = [0.022, 0.034, 0.028, 0.04, 0.02]
        for (var k = 0; k < heights.length; ++k) {
          ctx.fillStyle = theme.tone(k % 2 ? 2 : 0)
          ctx.fillRect(cx + (k - 2.5) * 0.012 * u, gy - heights[k] * u, 0.011 * u, heights[k] * u)
        }
      }

      // Incoming: a trail from where it started, and a bright head.
      ctx.lineWidth = Math.max(1, u * 0.0025)
      for (var e = 0; e < s.enemies.length; ++e) {
        var en = s.enemies[e]
        ctx.strokeStyle = theme.withAlpha(theme.danger, 0.75)
        ctx.beginPath(); ctx.moveTo(en.sx * u, en.sy * u); ctx.lineTo(en.x * u, en.y * u); ctx.stroke()
        ctx.fillStyle = theme.foreground
        ctx.fillRect(en.x * u - 1.5, en.y * u - 1.5, 3, 3)
      }

      // Counter-missiles, with an X on their destination.
      for (var i = 0; i < s.shots.length; ++i) {
        var sh = s.shots[i]
        ctx.strokeStyle = theme.withAlpha(theme.accent, 0.8)
        ctx.beginPath(); ctx.moveTo(sh.sx * u, sh.sy * u); ctx.lineTo(sh.x * u, sh.y * u); ctx.stroke()
        var m = 0.008 * u
        ctx.strokeStyle = theme.dim
        ctx.beginPath()
        ctx.moveTo(sh.tx * u - m, sh.ty * u - m); ctx.lineTo(sh.tx * u + m, sh.ty * u + m)
        ctx.moveTo(sh.tx * u + m, sh.ty * u - m); ctx.lineTo(sh.tx * u - m, sh.ty * u + m)
        ctx.stroke()
      }

      // Blasts flicker through the theme's tones.
      for (var j = 0; j < s.blasts.length; ++j) {
        var bl = s.blasts[j], r = Missile.blastRadius(bl) * u
        if (r <= 0.5) continue
        ctx.fillStyle = theme.withAlpha(bl.enemy ? theme.danger : theme.tone(Math.floor(bl.t * 20) % 3), 0.75)
        ctx.beginPath(); ctx.arc(bl.x * u, bl.y * u, r, 0, Math.PI * 2); ctx.fill()
      }

      // Crosshair.
      var hx = s.cross.x * u, hy = s.cross.y * u, hr = 0.018 * u
      ctx.strokeStyle = theme.foreground
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(hx - hr, hy); ctx.lineTo(hx - hr * 0.35, hy)
      ctx.moveTo(hx + hr * 0.35, hy); ctx.lineTo(hx + hr, hy)
      ctx.moveTo(hx, hy - hr); ctx.lineTo(hx, hy - hr * 0.35)
      ctx.moveTo(hx, hy + hr * 0.35); ctx.lineTo(hx, hy + hr)
      ctx.stroke()

      // Between waves: the bonus count.
      if (s.phase === "tally" && s.tally) {
        var t = s.tally
        ctx.fillStyle = theme.foreground
        ctx.textAlign = "center"; ctx.textBaseline = "middle"
        ctx.font = "bold " + Math.floor(u * 0.05) + "px " + theme.fontFamily
        ctx.fillText("WAVE " + s.wave + " CLEAR", width / 2, height * 0.3)
        ctx.font = Math.floor(u * 0.035) + "px " + theme.fontFamily
        ctx.fillStyle = theme.dim
        ctx.fillText(t.cities + " cities · " + t.ammo + " missiles · ×" + t.mult, width / 2, height * 0.39)
        ctx.fillStyle = theme.accent
        ctx.fillText("BONUS " + t.bonus + (t.rebuilt ? "  ·  CITY REBUILT" : ""), width / 2, height * 0.46)
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
