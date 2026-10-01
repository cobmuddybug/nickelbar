import QtQuick
import "../engine" as Engine
import "logic/swarm.js" as Swarm

// Swarm (after Galaga); see logic/swarm.js.
Engine.GameBase {
  id: root
  gameId: "swarm"
  title: "SWARM"
  helpText: "LEFT/RIGHT move · SPACE fire (two shots in the air at once; hold to keep firing) · hit divers for double points · the back-row bosses take two hits · extra ship at 20,000"
  mouseHelp: "The ship follows the pointer; hold the button to fire"

  property var state: null
  tickInterval: 16
  continuousMove: true
  ticking: !!state && !over
  score: state ? state.score : 0
  overTitle: state ? "STAGE " + state.stage + " · " + state.score : ""
  status: !state ? ""
    : over ? "GAME OVER  ·  " + (state.fired ? Math.round(state.hits / state.fired * 100) : 0) + "% hit  ·  SPACE to play again"
    : paused ? "PAUSED"
    : "STAGE " + state.stage + "  ·  " + state.lives + (state.lives === 1 ? " ship" : " ships")

  property bool mouseFire: false
  property real mouseX: -1

  onTick: {
    var dx = heldDx
    if (mouseX >= 0 && !dx) dx = Math.abs(mouseX - state.px) < 0.15 ? 0 : mouseX > state.px ? 1 : -1
    state = Swarm.step(state, { dx: dx, fire: heldAction || mouseFire }, tickInterval / 1000)
    if (state.dead) over = true
  }

  function newGame() { state = Swarm.makeState(); over = false; paused = false; mouseFire = false; mouseX = -1 }
  function moveCursor(dx, dy) { mouseX = -1 }
  function activate() { if (over) newGame() }

  function pointer(kind, x, y, b) {
    mouseX = x / board.unit
    if (kind === "press") mouseFire = true
    if (kind === "release") mouseFire = false
  }

  // The whole state is plain data, so it saves as is.
  function saveState() { return state && !over ? JSON.parse(JSON.stringify(state)) : null }
  function loadState(saved) {
    if (saved && typeof saved === "object" && saved.enemies !== undefined) { state = saved; over = false; paused = false }
    else newGame()
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root; shape: Qt.BlankCursor }
    anchors.centerIn: parent
    readonly property real unit: Math.min(parent.width / Swarm.W, parent.height / Swarm.H)
    width: unit * Swarm.W
    height: unit * Swarm.H

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onOverChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    function bug(ctx, e, u, t) {
      var x = e.x * u, y = e.y * u, flap = Math.sin(t * 10 + e.id) > 0 ? 1 : 0.7
      var down = e.mode === "dive" ? 1 : -1
      var col = e.kind === "boss" ? (e.hp > 1 ? theme.tone(4) : theme.danger) : e.kind === "moth" ? theme.tone(1) : theme.tone(3)
      var r = (e.kind === "boss" ? 0.48 : 0.38) * u
      ctx.fillStyle = theme.withAlpha(col, 0.55)
      // Wings.
      ctx.beginPath(); ctx.ellipse(x - r * 1.5 * flap, y - r * 0.5, r * 1.3 * flap, r); ctx.fill()
      ctx.beginPath(); ctx.ellipse(x + r * 0.2, y - r * 0.5, r * 1.3 * flap, r); ctx.fill()
      // Body.
      ctx.fillStyle = col
      ctx.beginPath(); ctx.ellipse(x - r * 0.5, y - r, r, r * 2); ctx.fill()
      ctx.fillStyle = theme.background
      ctx.beginPath(); ctx.arc(x - r * 0.2, y + down * r * 0.45, r * 0.14, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(x + r * 0.2, y + down * r * 0.45, r * 0.14, 0, Math.PI * 2); ctx.fill()
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state, u = unit
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.03)
      ctx.fillRect(0, 0, width, height)

      // Stars scrolling past.
      for (var k = 0; k < 40; ++k) {
        var sx = ((k * 7919) % 1000) / 1000 * width
        var sy = ((((k * 104729) % 1000) / 1000 * Swarm.H + s.t * (1 + k % 3)) % Swarm.H) * u
        ctx.fillStyle = theme.withAlpha(theme.tone(k), 0.35)
        ctx.fillRect(sx, sy, 1.5, 1.5)
      }

      for (var i = 0; i < s.enemies.length; ++i) bug(ctx, s.enemies[i], u, s.t)

      ctx.fillStyle = theme.highlight
      for (var b = 0; b < s.shots.length; ++b) ctx.fillRect(s.shots[b].x * u - 1.5, s.shots[b].y * u, 3, u * 0.5)
      ctx.fillStyle = theme.danger
      for (var m = 0; m < s.bombs.length; ++m) {
        ctx.beginPath(); ctx.ellipse(s.bombs[m].x * u - u * 0.08, s.bombs[m].y * u - u * 0.18, u * 0.16, u * 0.36); ctx.fill()
      }

      for (var o = 0; o < s.booms.length; ++o) {
        var bm = s.booms[o], big = bm.c === "ship" ? 2 : 1
        ctx.strokeStyle = theme.withAlpha(bm.c === "ship" ? theme.accent : theme.tone(3), Math.min(1, bm.t * 3))
        ctx.lineWidth = Math.max(1.5, u * 0.08)
        for (var ray = 0; ray < 8; ++ray) {
          var a = ray * Math.PI / 4, r0 = (0.9 - bm.t) * u * 0.8 * big, r1 = r0 + u * 0.3 * big
          ctx.beginPath(); ctx.moveTo(bm.x * u + Math.cos(a) * r0, bm.y * u + Math.sin(a) * r0)
          ctx.lineTo(bm.x * u + Math.cos(a) * r1, bm.y * u + Math.sin(a) * r1); ctx.stroke()
        }
      }

      // The ship.
      if (s.respawn <= 0 && !root.over) {
        var px = s.px * u, py = Swarm.PLAYER_Y * u
        ctx.fillStyle = theme.accent
        ctx.beginPath()
        ctx.moveTo(px, py - u * 0.6); ctx.lineTo(px + u * 0.2, py - u * 0.1); ctx.lineTo(px + u * 0.55, py + u * 0.4)
        ctx.lineTo(px + u * 0.15, py + u * 0.25); ctx.lineTo(px - u * 0.15, py + u * 0.25); ctx.lineTo(px - u * 0.55, py + u * 0.4)
        ctx.lineTo(px - u * 0.2, py - u * 0.1); ctx.closePath(); ctx.fill()
        ctx.fillStyle = theme.danger
        ctx.fillRect(px - 1.5, py - u * 0.2, 3, u * 0.25)
      }

      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.font = "bold " + Math.floor(u * 0.45) + "px " + theme.fontFamily
      for (var p = 0; p < s.pops.length; ++p) {
        ctx.fillStyle = theme.withAlpha(theme.foreground, Math.min(1, s.pops[p].t * 2))
        ctx.fillText(s.pops[p].text, s.pops[p].x * u, s.pops[p].y * u)
      }
      if (s.stageMsg > 0) {
        ctx.fillStyle = theme.accent
        ctx.font = "bold " + Math.floor(u * 0.9) + "px " + theme.fontFamily
        ctx.fillText("STAGE " + s.stage, width / 2, height * 0.55)
      }
      ctx.textAlign = "left"; ctx.textBaseline = "top"
      ctx.fillStyle = theme.dim
      ctx.font = "bold " + Math.floor(u * 0.5) + "px " + theme.fontFamily
      ctx.fillText(String(s.score), u * 0.2, u * 0.15)
      for (var lv = 0; lv < s.lives - (s.respawn > 0 ? 0 : 1); ++lv) {
        var lx = width - u * (0.6 + lv * 0.8), ly = u * 0.55
        ctx.fillStyle = theme.accent
        ctx.beginPath(); ctx.moveTo(lx, ly - u * 0.35); ctx.lineTo(lx + u * 0.3, ly + u * 0.25); ctx.lineTo(lx - u * 0.3, ly + u * 0.25); ctx.closePath(); ctx.fill()
      }
      if (root.paused) {
        ctx.fillStyle = theme.background; ctx.globalAlpha = 0.8; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
