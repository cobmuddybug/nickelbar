import QtQuick
import "../engine" as Engine
import "logic/centipede.js" as Cent

// Centipede; see logic/centipede.js.
Engine.GameBase {
  id: root
  gameId: "centipede"
  title: "CRAWLER"
  helpText: "ARROWS move about the bottom patch · SPACE fire (hold for auto) · a shot segment turns into a mushroom and splits the chain · head 100, body 10, spider 300-900 (closer pays more), flea 200 · mushrooms take four shots · extra life every 12,000"
  mouseHelp: "The shooter follows the pointer; hold the button to fire"

  property var state: null
  tickInterval: 16
  continuousMove: true
  ticking: !!state && !over
  score: state ? state.score : 0
  overTitle: state ? "WAVE " + state.wave + " · " + state.score : ""
  status: !state ? ""
    : over ? "GAME OVER  ·  SPACE to play again"
    : paused ? "PAUSED"
    : "WAVE " + state.wave + "  ·  " + state.lives + (state.lives === 1 ? " life" : " lives")

  property bool mouseFire: false
  property point mouseAt: Qt.point(-1, -1)

  onTick: {
    var dx = heldDx, dy = heldDy
    if (mouseAt.x >= 0 && !dx && !dy) {
      var mx = mouseAt.x - state.p.x, my = mouseAt.y - state.p.y
      if (Math.abs(mx) > 0.2) dx = mx > 0 ? 1 : -1
      if (Math.abs(my) > 0.2) dy = my > 0 ? 1 : -1
    }
    state = Cent.step(state, { dx: dx, dy: dy, fire: heldAction || mouseFire }, tickInterval / 1000)
    if (state.dead) over = true
  }

  function newGame() { state = Cent.makeState(); over = false; paused = false; mouseFire = false; mouseAt = Qt.point(-1, -1) }
  function moveCursor(dx, dy) { mouseAt = Qt.point(-1, -1) }
  function activate() { if (over) newGame() }

  function pointer(kind, x, y, b) {
    mouseAt = Qt.point(x / board.unit, y / board.unit)
    if (kind === "press") mouseFire = true
    if (kind === "release") mouseFire = false
  }

  // The whole state is plain data, so it saves as is.
  function saveState() { return state && !over ? JSON.parse(JSON.stringify(state)) : null }
  function loadState(saved) {
    if (saved && typeof saved === "object" && saved.segs !== undefined) { state = saved; over = false; paused = false }
    else newGame()
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root; shape: Qt.BlankCursor }
    anchors.centerIn: parent
    readonly property real unit: Math.min(parent.width / Cent.COLS, parent.height / Cent.ROWS)
    width: unit * Cent.COLS
    height: unit * Cent.ROWS

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
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.03)
      ctx.fillRect(0, 0, width, height)
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.04)
      ctx.fillRect(0, (Cent.ROWS - Cent.ZONE) * u, width, Cent.ZONE * u)

      // Mushrooms shrink as they're shot.
      for (var k in s.mush) {
        var hp = s.mush[k], c = k % Cent.COLS, r = Math.floor(k / Cent.COLS)
        var f = 0.4 + 0.6 * hp / Cent.MUSH_HP, cx = (c + 0.5) * u, cy = (r + 0.55) * u
        ctx.fillStyle = r >= Cent.ROWS - Cent.ZONE ? theme.tone(3) : theme.tone(1)
        ctx.beginPath(); ctx.arc(cx, cy, u * 0.45 * f, Math.PI, 0); ctx.closePath(); ctx.fill()
        ctx.fillRect(cx - u * 0.12 * f, cy, u * 0.24 * f, u * 0.35 * f)
      }

      // Segments, eased between grid steps.
      var fr = s.frac || 0
      var ids = {}
      for (var i = 0; i < s.segs.length; ++i) ids[s.segs[i].id] = true
      for (var j = 0; j < s.segs.length; ++j) {
        var g = s.segs[j], head = g.lead < 0 || !ids[g.lead]
        var gx = (g.pc + (g.c - g.pc) * fr + 0.5) * u, gy = (g.pr + (g.r - g.pr) * fr + 0.5) * u
        ctx.fillStyle = head ? theme.tone(0) : theme.tone(2)
        ctx.beginPath(); ctx.arc(gx, gy, u * 0.47, 0, Math.PI * 2); ctx.fill()
        if (head) {
          ctx.fillStyle = theme.background
          ctx.beginPath(); ctx.arc(gx + g.dir * u * 0.2, gy - u * 0.12, u * 0.1, 0, Math.PI * 2); ctx.fill()
          ctx.beginPath(); ctx.arc(gx + g.dir * u * 0.2, gy + u * 0.12, u * 0.1, 0, Math.PI * 2); ctx.fill()
        } else {
          ctx.strokeStyle = theme.withAlpha(theme.background, 0.5); ctx.lineWidth = 1
          ctx.beginPath(); ctx.moveTo(gx, gy - u * 0.47); ctx.lineTo(gx, gy + u * 0.47); ctx.stroke()
        }
      }

      if (s.spider) {
        var sx = s.spider.x * u, sy = s.spider.y * u
        ctx.strokeStyle = theme.danger; ctx.lineWidth = Math.max(1.5, u * 0.1)
        for (var l = -1; l <= 1; l += 2) for (var m = 0; m < 3; ++m) {
          var wig = Math.sin(Date.now() / 60 + m) * u * 0.15
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + l * u * 0.6, sy - u * 0.3 + m * u * 0.3 + wig); ctx.lineTo(sx + l * u * 0.9, sy + u * 0.1 + m * u * 0.25); ctx.stroke()
        }
        ctx.fillStyle = theme.danger
        ctx.beginPath(); ctx.ellipse(sx - u * 0.45, sy - u * 0.3, u * 0.9, u * 0.6); ctx.fill()
      }
      if (s.flea) {
        ctx.fillStyle = theme.tone(4)
        ctx.beginPath(); ctx.ellipse((s.flea.x - 0.35) * u, (s.flea.y - 0.45) * u, u * 0.7, u * 0.9); ctx.fill()
      }

      if (s.bullet) {
        ctx.fillStyle = theme.highlight
        ctx.fillRect(s.bullet.x * u - 1, s.bullet.y * u - u * 0.35, 2.5, u * 0.7)
      }

      // The shooter: a little blaster; flashes while dying.
      if (!(s.dying > 0 && Math.floor(s.dying * 10) % 2)) {
        var px = s.p.x * u, py = s.p.y * u
        ctx.fillStyle = s.dying > 0 ? theme.danger : theme.accent
        ctx.beginPath()
        ctx.moveTo(px, py - u * 0.55); ctx.lineTo(px + u * 0.4, py + u * 0.45); ctx.lineTo(px - u * 0.4, py + u * 0.45)
        ctx.closePath(); ctx.fill()
      }

      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.font = "bold " + Math.floor(u * 0.6) + "px " + theme.fontFamily
      for (var p = 0; p < s.pops.length; ++p) {
        ctx.fillStyle = theme.withAlpha(theme.foreground, Math.min(1, s.pops[p].t * 2))
        ctx.fillText(s.pops[p].text, s.pops[p].x * u, s.pops[p].y * u)
      }
      ctx.textAlign = "left"; ctx.textBaseline = "top"
      ctx.fillStyle = theme.dim
      ctx.fillText(String(s.score), u * 0.3, u * 0.2)
      for (var lv = 0; lv < s.lives - 1; ++lv) {
        ctx.fillStyle = theme.accent
        var lx = width - u * (0.8 + lv * 0.9)
        ctx.beginPath(); ctx.moveTo(lx, u * 0.25); ctx.lineTo(lx + u * 0.3, u * 0.85); ctx.lineTo(lx - u * 0.3, u * 0.85); ctx.closePath(); ctx.fill()
      }
      if (root.paused) {
        ctx.fillStyle = theme.background; ctx.globalAlpha = 0.8; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
