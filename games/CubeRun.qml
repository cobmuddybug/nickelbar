import QtQuick
import "../engine" as Engine
import "logic/cuberun.js" as Run

// Cube Run (after Cube Field); see logic/cuberun.js.
Engine.GameBase {
  id: root
  gameId: "cuberun"
  title: "CUBE RUN"
  helpText: "LEFT/RIGHT steer · one touch and it's over · faster all the time · phases: open field, thicket, a winding corridor, slalom gates, then round again, harder · skim past cubes for near-miss points (quick ones stack a multiplier) · grab the gems"
  mouseHelp: "Steer toward the pointer's side of the screen"

  property var state: null
  tickInterval: 16
  continuousMove: true
  ticking: !!state && !over
  score: state ? state.score : 0
  overTitle: state ? Math.floor(state.z) + " m · " + state.score : ""
  status: !state ? ""
    : over ? state.near + " near misses · " + state.gemCount + " gems  ·  SPACE to play again"
    : paused ? "PAUSED"
    : Math.floor(state.z) + " m  ·  " + Math.round(state.speed * 3.6) + " km/h" + (state.mult > 1 ? "  ·  ×" + state.mult : "")

  property real mouseX: -1

  onTick: {
    var dx = heldDx
    if (!dx && mouseX >= 0) { var off = mouseX - board.width / 2; dx = Math.abs(off) < board.width * 0.06 ? 0 : off > 0 ? 1 : -1 }
    state = Run.step(state, { dx: dx }, tickInterval / 1000)
    if (state.dead) over = true
  }

  function newGame() { state = Run.makeState(); over = false; paused = false; mouseX = -1 }
  function moveCursor(dx, dy) { mouseX = -1 }
  function activate() { if (over) newGame() }
  function pointer(kind, x, y, b) { mouseX = x }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    anchors.fill: parent
    Engine.Pointer { game: root; shape: Qt.BlankCursor }

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
      var horizon = height * 0.3, F = Math.min(height * 1.05, width * 1.1), camH = 1.6
      var camX = s.x, camZ = s.z - 3.2, cx = width / 2
      var tone0 = s.phase * 2 + Math.floor(s.z / (Run.PHASE_LEN * 4)) * 3

      ctx.save()
      // Lean into turns.
      ctx.translate(cx, height * 0.6); ctx.rotate(-s.vx * 0.012); ctx.translate(-cx, -height * 0.6)

      // Sky and ground.
      ctx.fillStyle = theme.withAlpha(theme.tone(tone0 + 1), 0.08)
      ctx.fillRect(-width, -height, width * 3, horizon + height)
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.05)
      ctx.fillRect(-width, horizon, width * 3, height * 2)
      // Ground lines rushing past, for the sense of speed.
      ctx.strokeStyle = theme.withAlpha(theme.foreground, 0.08); ctx.lineWidth = 1
      for (var gz = Math.ceil(camZ / 5) * 5; gz < camZ + Run.VIEW; gz += 5) {
        var dz0 = gz - camZ
        if (dz0 < 0.5) continue
        var gy = horizon + camH * F / dz0
        ctx.beginPath(); ctx.moveTo(-width, gy); ctx.lineTo(width * 2, gy); ctx.stroke()
      }

      function px(x, dz) { return cx + (x - camX) * F / dz }
      function py(y, dz) { return horizon + (camH - y) * F / dz }

      // Cubes, far to near.
      var list = s.cubes.filter(function(c) { return c.z - camZ > 0.4 && c.z - camZ < Run.VIEW })
      list.sort(function(a, b) { return b.z - a.z })
      for (var i = 0; i < list.length; ++i) {
        var c = list[i], dn = c.z - camZ, df = dn + 1
        var x0 = px(c.x - 0.5, dn), x1 = px(c.x + 0.5, dn)
        if (x1 < -20 || x0 > width + 20) continue
        var fog = Math.max(0, Math.min(1, 1.15 - dn / Run.VIEW))
        var col = theme.tone(tone0 + c.hue)
        var yb = py(0, dn), yt = py(1, dn)
        // Top face.
        ctx.fillStyle = theme.withAlpha(col, 0.55 * fog)
        ctx.beginPath(); ctx.moveTo(x0, yt); ctx.lineTo(x1, yt); ctx.lineTo(px(c.x + 0.5, df), py(1, df)); ctx.lineTo(px(c.x - 0.5, df), py(1, df)); ctx.closePath(); ctx.fill()
        // The side facing us.
        if (c.x + 0.5 < camX) {
          ctx.fillStyle = theme.withAlpha(col, 0.4 * fog)
          ctx.beginPath(); ctx.moveTo(x1, yt); ctx.lineTo(px(c.x + 0.5, df), py(1, df)); ctx.lineTo(px(c.x + 0.5, df), py(0, df)); ctx.lineTo(x1, yb); ctx.closePath(); ctx.fill()
        } else if (c.x - 0.5 > camX) {
          ctx.fillStyle = theme.withAlpha(col, 0.4 * fog)
          ctx.beginPath(); ctx.moveTo(x0, yt); ctx.lineTo(px(c.x - 0.5, df), py(1, df)); ctx.lineTo(px(c.x - 0.5, df), py(0, df)); ctx.lineTo(x0, yb); ctx.closePath(); ctx.fill()
        }
        // Front face.
        ctx.fillStyle = theme.withAlpha(col, 0.9 * fog)
        ctx.fillRect(x0, yt, x1 - x0, yb - yt)
      }

      // Gems.
      for (var g = 0; g < s.gems.length; ++g) {
        var gm = s.gems[g], gd = gm.z - camZ
        if (gm.got || gd < 0.5 || gd > Run.VIEW) continue
        var gx = px(gm.x, gd), gyy = py(0.5 + Math.sin(s.t * 4 + g) * 0.15, gd), gr = 0.25 * F / gd
        ctx.fillStyle = theme.tone(3)
        ctx.beginPath(); ctx.moveTo(gx, gyy - gr); ctx.lineTo(gx + gr * 0.7, gyy); ctx.lineTo(gx, gyy + gr); ctx.lineTo(gx - gr * 0.7, gyy); ctx.closePath(); ctx.fill()
      }

      // The ship, with its shadow.
      var sd = s.z - camZ, sx = px(s.x, sd), sy = py(0.12, sd), sw = Run.SHIP_W * F / sd
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.15)
      ctx.beginPath(); ctx.ellipse(sx - sw, py(0, sd) - sw * 0.15, sw * 2, sw * 0.3); ctx.fill()
      ctx.fillStyle = root.over ? theme.danger : theme.accent
      ctx.beginPath(); ctx.moveTo(sx, sy - sw * 0.6); ctx.lineTo(sx + sw, sy + sw * 0.35); ctx.lineTo(sx, sy + sw * 0.15); ctx.lineTo(sx - sw, sy + sw * 0.35); ctx.closePath(); ctx.fill()
      ctx.restore()

      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      for (var p = 0; p < s.pops.length; ++p) {
        var po = s.pops[p]
        ctx.fillStyle = theme.withAlpha(theme.tone(3), Math.min(1, po.t * 2))
        ctx.font = "bold " + Math.floor(height * 0.035) + "px " + theme.fontFamily
        ctx.fillText(po.text, cx + po.x * 25, height * 0.72 - (0.8 - po.t) * height * 0.08)
      }
      ctx.fillStyle = theme.foreground
      ctx.font = "bold " + Math.floor(height * 0.045) + "px " + theme.fontFamily
      ctx.textAlign = "left"; ctx.textBaseline = "top"
      ctx.fillText(String(s.score), 12, 10)
      if (s.msgT > 0) {
        ctx.textAlign = "center"
        ctx.fillStyle = theme.accent
        ctx.font = "bold " + Math.floor(height * 0.055) + "px " + theme.fontFamily
        ctx.fillText(s.msg, cx, height * 0.12)
      }
      if (root.paused) {
        ctx.fillStyle = theme.background; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
