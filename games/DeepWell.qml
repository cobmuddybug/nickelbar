import QtQuick
import "../engine" as Engine
import "logic/deepwell.js" as Well

// Deep Well (after Downwell); see logic/deepwell.js. Score is metres
// fallen plus gems.
Engine.GameBase {
  id: root
  gameId: "deepwell"
  title: "DEEP WELL"
  helpText: "LEFT/RIGHT move · SPACE or UP jump; in mid-air each press fires the gunboots down (and slows your fall) · landing or stomping reloads · stomp bats and blobs, shoot the red spiky ones · shots break the cracked blocks · kills without landing chain for bonus gems · four hits and you're out; +1 HP every 200 m"
  mouseHelp: "Click to jump / fire"

  property var state: null
  tickInterval: 16
  continuousMove: true
  ticking: !!state && !over
  score: state ? Well.score(state) : 0
  overTitle: state ? state.depth + " m · " + state.gems + " gems" : ""
  status: !state ? ""
    : over ? "OUT OF HP  ·  SPACE to play again"
    : paused ? "PAUSED"
    : state.depth + " m  ·  " + state.gems + " gems  ·  HP " + state.hp + "  ·  ammo " + state.ammo
      + (state.combo >= 2 ? "  ·  combo " + state.combo : "")

  property bool mouseJump: false

  onTick: {
    state = Well.step(state, { dx: heldDx, jump: heldAction || heldDy < 0 || mouseJump }, tickInterval / 1000)
    if (state.dead) over = true
  }

  function newGame() { state = Well.makeState(); over = false; paused = false; mouseJump = false }
  function moveCursor(dx, dy) {}
  function activate() { if (over) newGame() }

  function pointer(kind, x, y, b) {
    if (kind === "press") mouseJump = true
    if (kind === "release") mouseJump = false
  }

  // The whole state is plain data, so it saves as is.
  function saveState() { return state && !over ? JSON.parse(JSON.stringify(state)) : null }
  function loadState(saved) {
    if (saved && typeof saved === "object" && saved.rows !== undefined) { state = saved; over = false; paused = false }
    else newGame()
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property real unit: Math.min(parent.width / Well.COLS, parent.height / Well.VIEW_H)
    width: unit * Well.COLS
    height: unit * Well.VIEW_H

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
      var s = root.state, u = unit, cam = s.camY
      function Y(y) { return (y - cam) * u }

      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.03)
      ctx.fillRect(0, 0, width, height)

      // Tiles in view.
      var r0 = Math.floor(cam), r1 = Math.ceil(cam + Well.VIEW_H)
      for (var r = r0; r <= r1; ++r) {
        var row = s.rows[r]
        if (!row) continue
        for (var c = 0; c < Well.COLS; ++c) {
          var t = row[c]
          if (!t) continue
          var x = c * u, y = Y(r)
          if (t === Well.WALL) { ctx.fillStyle = theme.withAlpha(theme.foreground, 0.22); ctx.fillRect(x, y, u + 0.5, u + 0.5) }
          else if (t === Well.SOLID) {
            ctx.fillStyle = theme.dim; ctx.fillRect(x + 1, y + 1, u - 2, u - 2)
          } else {
            // Cracked block: outlined, with a crack through it.
            ctx.fillStyle = theme.withAlpha(theme.tone(3), 0.35); ctx.fillRect(x + 1, y + 1, u - 2, u - 2)
            ctx.strokeStyle = theme.tone(3); ctx.lineWidth = 1
            ctx.strokeRect(x + 1.5, y + 1.5, u - 3, u - 3)
            ctx.beginPath(); ctx.moveTo(x + u * 0.3, y + 2); ctx.lineTo(x + u * 0.5, y + u * 0.5); ctx.lineTo(x + u * 0.4, y + u - 2); ctx.stroke()
          }
        }
      }

      // Enemies.
      for (var i = 0; i < s.enemies.length; ++i) {
        var e = s.enemies[i], ex = e.x * u, ey = Y(e.y), ew = e.w * u, eh = e.h * u
        if (ey < -u || ey > height + u) continue
        if (e.kind === "bat") {
          var flap = Math.sin(s.t * 14 + i) * eh * 0.4
          ctx.fillStyle = theme.tone(4)
          ctx.beginPath()
          ctx.moveTo(ex, ey + eh * 0.3 + flap); ctx.lineTo(ex + ew / 2, ey + eh * 0.5); ctx.lineTo(ex + ew, ey + eh * 0.3 + flap)
          ctx.lineTo(ex + ew / 2, ey + eh); ctx.closePath(); ctx.fill()
        } else {
          ctx.fillStyle = e.kind === "spike" ? theme.danger : theme.tone(2)
          ctx.beginPath()
          ctx.moveTo(ex, ey + eh); ctx.lineTo(ex, ey + eh * 0.45)
          ctx.quadraticCurveTo(ex + ew / 2, ey - eh * 0.3, ex + ew, ey + eh * 0.45)
          ctx.lineTo(ex + ew, ey + eh); ctx.closePath(); ctx.fill()
          if (e.kind === "spike") {
            for (var sp = 0; sp < 3; ++sp) {
              var sx = ex + ew * (0.2 + sp * 0.3)
              ctx.beginPath(); ctx.moveTo(sx - ew * 0.1, ey + eh * 0.25); ctx.lineTo(sx, ey - eh * 0.25); ctx.lineTo(sx + ew * 0.1, ey + eh * 0.25); ctx.fill()
            }
          }
          ctx.fillStyle = theme.background
          ctx.fillRect(ex + ew * (e.vx > 0 ? 0.6 : 0.25), ey + eh * 0.45, Math.max(2, ew * 0.12), Math.max(2, eh * 0.15))
        }
      }

      // Bullets.
      ctx.fillStyle = theme.highlight
      for (var b = 0; b < s.bullets.length; ++b) ctx.fillRect(s.bullets[b].x * u, Y(s.bullets[b].y), 0.2 * u, 0.45 * u)

      // The player: blinks while invulnerable.
      var p = s.p
      if (!(s.inv > 0 && Math.floor(s.inv * 12) % 2)) {
        var px = p.x * u, py = Y(p.y), pw = Well.PW * u, ph = Well.PH * u
        ctx.fillStyle = theme.foreground
        ctx.fillRect(px + pw * 0.15, py, pw * 0.7, ph * 0.55)
        ctx.fillStyle = theme.accent
        ctx.fillRect(px, py + ph * 0.55, pw * 0.4, ph * 0.45)
        ctx.fillRect(px + pw * 0.6, py + ph * 0.55, pw * 0.4, ph * 0.45)
        ctx.fillStyle = theme.background
        ctx.fillRect(px + pw * (p.face > 0 ? 0.55 : 0.25), py + ph * 0.15, pw * 0.15, ph * 0.12)
      }

      // Gem pops.
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.font = "bold " + Math.floor(u * 0.45) + "px " + theme.fontFamily
      for (var k = 0; k < s.pops.length; ++k) {
        ctx.fillStyle = theme.withAlpha(theme.tone(3), Math.min(1, s.pops[k].t * 2))
        ctx.fillText(s.pops[k].text, s.pops[k].x * u, Y(s.pops[k].y))
      }

      // HUD: HP on the left wall, ammo down the right one.
      for (var h = 0; h < Well.HP; ++h) {
        ctx.fillStyle = h < s.hp ? theme.danger : theme.faint
        ctx.beginPath(); ctx.arc(u * 0.5, u * (0.6 + h * 0.8), u * 0.28, 0, Math.PI * 2); ctx.fill()
      }
      for (var a = 0; a < Well.AMMO; ++a) {
        ctx.fillStyle = a < s.ammo ? theme.highlight : theme.faint
        ctx.fillRect(width - u * 0.7, u * (0.4 + a * 0.55), u * 0.4, u * 0.4)
      }
      ctx.fillStyle = theme.foreground
      ctx.font = "bold " + Math.floor(u * 0.5) + "px " + theme.fontFamily
      ctx.fillText(s.depth + " m", width / 2, u * 0.6)
      ctx.fillStyle = theme.tone(3)
      ctx.fillText("◆ " + s.gems, width / 2, u * 1.25)
      if (s.msgT > 0) {
        ctx.fillStyle = theme.accent
        ctx.font = "bold " + Math.floor(u * 0.7) + "px " + theme.fontFamily
        ctx.fillText(s.msg, width / 2, height * 0.2)
      }
      if (root.paused) {
        ctx.fillStyle = theme.background; ctx.globalAlpha = 0.8; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
