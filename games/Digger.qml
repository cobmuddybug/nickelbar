import QtQuick
import "../engine" as Engine
import "logic/digger.js" as Dig

// Digger (after Dig Dug); see logic/digger.js.
Engine.GameBase {
  id: root
  gameId: "digger"
  title: "DIGGER"
  helpText: "ARROWS dig (you turn on the grid, like a maze game) · SPACE pump: the hose reaches three cells along open tunnel; keep pumping (tap or hold) until the monster pops · deeper pops pay more, dragons double from the side · dragons breathe fire along their row · dig under a rock to drop it on them (1000 and up) · monsters can ghost through dirt"
  mouseHelp: "Hold the left button to walk toward the pointer; right-click pumps"

  property var state: null
  tickInterval: 16
  continuousMove: true
  ticking: !!state && !over
  score: state ? state.score : 0
  overTitle: state ? "LEVEL " + state.level + " · " + state.score : ""
  status: !state ? ""
    : over ? "GAME OVER  ·  SPACE to play again"
    : paused ? "PAUSED"
    : "LEVEL " + state.level + "  ·  " + state.lives + (state.lives === 1 ? " life" : " lives") + "  ·  " + state.enemies.length + " to go"

  property bool prevPump: false
  property bool mouseWalk: false
  property bool mousePump: false
  property point mouseAt: Qt.point(-1, -1)

  onTick: {
    var pump = heldAction || mousePump
    var dx = heldDx, dy = heldDy
    if (mouseWalk && !dx && !dy) {
      var mx = mouseAt.x - state.p.x, my = mouseAt.y - state.p.y
      if (Math.abs(mx) > 0.3 || Math.abs(my) > 0.3) { if (Math.abs(mx) >= Math.abs(my)) dx = mx > 0 ? 1 : -1; else dy = my > 0 ? 1 : -1 }
    }
    state = Dig.step(state, { dx: dx, dy: dy, pump: pump, pumpPress: pump && !prevPump }, tickInterval / 1000)
    prevPump = pump
    mousePump = false
    if (state.dead) over = true
  }

  function newGame() { state = Dig.makeState(); over = false; paused = false; prevPump = false; mouseWalk = false }
  function moveCursor(dx, dy) {}
  function activate() { if (over) newGame() }

  function pointer(kind, x, y, b) {
    mouseAt = Qt.point(x / board.unit - 0.5, y / board.unit - 0.5)
    if (kind === "press" && b === Qt.RightButton) { mousePump = true; return }
    if (kind === "press") mouseWalk = true
    if (kind === "release") mouseWalk = false
  }

  // The whole state is plain data, so it saves as is.
  function saveState() { return state && !over ? JSON.parse(JSON.stringify(state)) : null }
  function loadState(saved) {
    if (saved && typeof saved === "object" && saved.dug !== undefined) { state = saved; over = false; paused = false }
    else newGame()
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property real unit: Math.min(parent.width / Dig.COLS, parent.height / Dig.ROWS)
    width: unit * Dig.COLS
    height: unit * Dig.ROWS

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

      // Dirt in four bands, tunnels cut out.
      var bands = [2, 5, 9, 12, Dig.ROWS]
      for (var bnd = 0; bnd < 4; ++bnd) {
        ctx.fillStyle = theme.withAlpha(theme.tone(3 + bnd), 0.22 + bnd * 0.06)
        ctx.fillRect(0, bands[bnd] * u, width, (bands[bnd + 1] - bands[bnd]) * u)
      }
      ctx.fillStyle = theme.background
      for (var r = 2; r < Dig.ROWS; ++r) for (var c = 0; c < Dig.COLS; ++c) {
        if (!s.dug[Dig.idx(c, r)]) continue
        var m = u * 0.1
        ctx.fillRect(c * u + m, r * u + m, u - 2 * m, u - 2 * m)
        if (c + 1 < Dig.COLS && s.dug[Dig.idx(c + 1, r)]) ctx.fillRect(c * u + u - m - 1, r * u + m, 2 * m + 2, u - 2 * m)
        if (r + 1 < Dig.ROWS && s.dug[Dig.idx(c, r + 1)]) ctx.fillRect(c * u + m, r * u + u - m - 1, u - 2 * m, 2 * m + 2)
      }
      ctx.strokeStyle = theme.tone(2); ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(0, 2 * u); ctx.lineTo(width, 2 * u); ctx.stroke()

      // Rocks (shaking before they drop).
      for (var q = 0; q < s.rocks.length; ++q) {
        var rk = s.rocks[q], shake = rk.state === "wobble" ? Math.sin(s.t * 60) * u * 0.06 : 0
        ctx.globalAlpha = rk.state === "gone" ? rk.t / 0.4 : 1
        ctx.fillStyle = theme.dim
        ctx.beginPath()
        var rx = rk.c * u + shake, ry = rk.y * u
        ctx.moveTo(rx + u * 0.15, ry + u * 0.9); ctx.lineTo(rx + u * 0.05, ry + u * 0.45); ctx.lineTo(rx + u * 0.3, ry + u * 0.12)
        ctx.lineTo(rx + u * 0.72, ry + u * 0.08); ctx.lineTo(rx + u * 0.95, ry + u * 0.5); ctx.lineTo(rx + u * 0.85, ry + u * 0.9); ctx.closePath(); ctx.fill()
        ctx.globalAlpha = 1
      }

      // Fire.
      for (var fi = 0; fi < s.fires.length; ++fi) {
        var f = s.fires[fi], reach = 3 * Math.min(1, (0.7 - f.t) * 4)
        ctx.fillStyle = theme.withAlpha(theme.danger, 0.75)
        var fx0 = f.dir > 0 ? f.x + 0.5 : f.x + 0.5 - reach
        ctx.fillRect(fx0 * u, (f.y + 0.25) * u, reach * u, u * 0.5)
      }

      // Hose.
      var p = s.p
      if (s.hose) {
        ctx.strokeStyle = theme.foreground; ctx.lineWidth = Math.max(1.5, u * 0.08)
        ctx.beginPath(); ctx.moveTo((p.x + 0.5) * u, (p.y + 0.5) * u)
        ctx.lineTo((p.x + 0.5 + s.hose.dir[0] * s.hose.len) * u, (p.y + 0.5 + s.hose.dir[1] * s.hose.len) * u); ctx.stroke()
      }

      // Monsters.
      for (var i = 0; i < s.enemies.length; ++i) {
        var e = s.enemies[i], ep = Dig.epos(e), ex = (ep.x + 0.5) * u, ey = (ep.y + 0.5) * u
        var sz = u * 0.38 * (1 + e.inflate * 0.28)
        if (e.ghost) {
          ctx.strokeStyle = theme.withAlpha(theme.foreground, 0.7); ctx.lineWidth = 1.5
          ctx.beginPath(); ctx.arc(ex - u * 0.15, ey, u * 0.12, 0, Math.PI * 2); ctx.stroke()
          ctx.beginPath(); ctx.arc(ex + u * 0.15, ey, u * 0.12, 0, Math.PI * 2); ctx.stroke()
          continue
        }
        ctx.fillStyle = e.kind === "fygar" ? (e.charging > 0 ? theme.danger : theme.tone(2)) : theme.tone(1)
        ctx.beginPath(); ctx.arc(ex, ey, sz, 0, Math.PI * 2); ctx.fill()
        if (e.kind === "fygar") {
          var fc = e.face || 1
          ctx.beginPath(); ctx.moveTo(ex + fc * sz * 0.6, ey - sz * 0.4); ctx.lineTo(ex + fc * sz * 1.4, ey); ctx.lineTo(ex + fc * sz * 0.6, ey + sz * 0.3); ctx.fill()
        }
        ctx.fillStyle = theme.background
        ctx.fillRect(ex - sz * 0.6, ey - sz * 0.35, sz * 1.2, sz * 0.4)
        ctx.fillStyle = theme.foreground
        ctx.fillRect(ex - sz * 0.4, ey - sz * 0.28, sz * 0.2, sz * 0.26)
        ctx.fillRect(ex + sz * 0.2, ey - sz * 0.28, sz * 0.2, sz * 0.26)
      }

      // The digger.
      if (!(s.dying > 0 && Math.floor(s.dying * 8) % 2)) {
        var px = (p.x + 0.5) * u, py = (p.y + 0.5) * u, fcx = p.dir[0] || 0, fcy = p.dir[1] || 0
        ctx.fillStyle = s.dying > 0 ? theme.danger : theme.foreground
        ctx.beginPath(); ctx.arc(px, py, u * 0.38, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = theme.accent
        ctx.beginPath(); ctx.arc(px, py - u * 0.05, u * 0.26, Math.PI, 0); ctx.fill()
        ctx.fillStyle = theme.background
        ctx.beginPath(); ctx.arc(px + fcx * u * 0.18 + (fcy ? 0 : 0), py + fcy * u * 0.12 + u * 0.06, u * 0.07, 0, Math.PI * 2); ctx.fill()
      }

      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.font = "bold " + Math.floor(u * 0.45) + "px " + theme.fontFamily
      for (var o = 0; o < s.pops.length; ++o) {
        ctx.fillStyle = theme.withAlpha(theme.foreground, Math.min(1, s.pops[o].t * 2))
        ctx.fillText(s.pops[o].text, (s.pops[o].c + 0.5) * u, (s.pops[o].r + 0.5) * u)
      }
      ctx.textAlign = "left"; ctx.textBaseline = "middle"
      ctx.fillStyle = theme.dim
      ctx.fillText(String(s.score), u * 0.3, u * 0.5)
      ctx.textAlign = "right"
      ctx.fillText("♥ " + s.lives, width - u * 0.3, u * 0.5)
      if (s.msgT > 0) {
        ctx.textAlign = "center"
        ctx.fillStyle = theme.accent
        ctx.font = "bold " + Math.floor(u * 0.7) + "px " + theme.fontFamily
        ctx.fillText(s.msg, width / 2, u * 0.5)
      }
      if (root.paused) {
        ctx.fillStyle = theme.background; ctx.globalAlpha = 0.8; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
