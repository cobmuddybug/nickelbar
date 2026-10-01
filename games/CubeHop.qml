import QtQuick
import "../engine" as Engine
import "logic/cubehop.js" as Hop

// Cube Hop (after Q*bert); see logic/cubehop.js.
Engine.GameBase {
  id: root
  gameId: "cubehop"
  title: "CUBE HOP"
  helpText: "Hop diagonally: UP ↗  RIGHT ↘  DOWN ↙  LEFT ↖ · turn every top to the target colour (top left) · level 2: two visits each · level 3: a second visit turns it back · dodge the red balls and the snake; catch a green ball to freeze everything · hop off the side onto a disc to ride to the top (a snake on your tail follows you off, 500) · 25 a top, big bonus a level"
  mouseHelp: "Click the cube you want to hop to"

  property var state: null
  tickInterval: 16
  ticking: !!state && !over
  score: state ? state.score : 0
  overTitle: state ? "LEVEL " + state.level + " · " + state.score : ""
  status: !state ? ""
    : over ? "GAME OVER  ·  SPACE to play again"
    : paused ? "PAUSED"
    : "LEVEL " + state.level + "  ·  " + state.lives + (state.lives === 1 ? " life" : " lives")
      + (state.freeze > 0 ? "  ·  FROZEN" : "")

  onTick: {
    state = Hop.step(state, tickInterval / 1000)
    if (state.dead) over = true
  }

  function newGame() { state = Hop.makeState(); over = false; paused = false }

  function moveCursor(dx, dy) {
    if (!state || over) return
    var dir = dy < 0 ? "ur" : dx > 0 ? "dr" : dy > 0 ? "dl" : "ul"
    state = Hop.hopPlayer(state, dir)
  }

  function activate() { if (over) newGame() }

  function pointer(kind, x, y, b) {
    if (!state || over || kind !== "press") return
    var L = board.layout(), best = null, bd = 1e9
    for (var k in Hop.DIRS) {
      var q = board.cubeXY(L, state.p.r + Hop.DIRS[k][0], state.p.c + Hop.DIRS[k][1])
      var d = (q.x - x) * (q.x - x) + (q.y - y) * (q.y - y)
      if (d < bd) { bd = d; best = k }
    }
    if (best) state = Hop.hopPlayer(state, best)
  }

  // The whole state is plain data, so it saves as is.
  function saveState() { return state && !over ? JSON.parse(JSON.stringify(state)) : null }
  function loadState(saved) {
    if (saved && typeof saved === "object" && saved.tops !== undefined) { state = saved; over = false; paused = false }
    else newGame()
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    anchors.fill: parent
    Engine.Pointer { game: root }

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onOverChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    function layout() {
      var cw = Math.min(width / 8.2, height / 6.8)
      var h = cw * 0.5, side = cw * 0.5, rowH = h / 2 + side
      var totalH = Hop.ROWS * rowH + h
      return { cw: cw, h: h, side: side, rowH: rowH, x0: width / 2, y0: (height - totalH) / 2 + h * 0.9 }
    }

    function cubeXY(L, r, c) { return { x: L.x0 + (c - r / 2) * L.cw, y: L.y0 + r * L.rowH } }

    // Where an entity is drawn mid-hop: along the line with a little arc.
    function entityXY(L, e) {
      var a = cubeXY(L, e.fr, e.fc), b = cubeXY(L, e.r, e.c), t = e.t
      if (e.fr < 0) a = { x: b.x, y: b.y - L.cw * 2 }
      var x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t - Math.sin(Math.PI * t) * L.cw * 0.35
      return { x: x, y: y - L.h * 0.3 }
    }

    function topColor(v) {
      var need = Hop.rule(root.state.level).need
      if (v >= need) return theme.accent
      return v === 1 ? theme.tone(3) : theme.tone(1)
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state, L = layout(), cw = L.cw, h = L.h, sd = L.side

      // Cubes, back to front.
      for (var r = 0; r < Hop.ROWS; ++r) for (var c = 0; c <= r; ++c) {
        var q = cubeXY(L, r, c), x = q.x, y = q.y
        ctx.fillStyle = theme.withAlpha(theme.foreground, 0.28)
        ctx.beginPath(); ctx.moveTo(x - cw / 2, y); ctx.lineTo(x, y + h / 2); ctx.lineTo(x, y + h / 2 + sd); ctx.lineTo(x - cw / 2, y + sd); ctx.closePath(); ctx.fill()
        ctx.fillStyle = theme.withAlpha(theme.foreground, 0.14)
        ctx.beginPath(); ctx.moveTo(x + cw / 2, y); ctx.lineTo(x, y + h / 2); ctx.lineTo(x, y + h / 2 + sd); ctx.lineTo(x + cw / 2, y + sd); ctx.closePath(); ctx.fill()
        ctx.fillStyle = topColor(s.tops[r][c])
        ctx.beginPath(); ctx.moveTo(x, y - h / 2); ctx.lineTo(x + cw / 2, y); ctx.lineTo(x, y + h / 2); ctx.lineTo(x - cw / 2, y); ctx.closePath(); ctx.fill()
      }

      // Discs.
      for (var d = 0; d < s.discs.length; ++d) {
        var disc = s.discs[d]
        if (disc.used) continue
        var dq = cubeXY(L, disc.r, disc.c), wob = Math.sin(s.t * 6 + d) * 0.3 + 0.7
        ctx.fillStyle = theme.tone(5)
        ctx.beginPath(); ctx.ellipse(dq.x - cw * 0.32 * wob, dq.y - h * 0.4, cw * 0.64 * wob, h * 0.45); ctx.fill()
      }

      // Enemies.
      for (var i = 0; i < s.enemies.length; ++i) {
        var e = s.enemies[i], p = entityXY(L, e)
        if (e.kind === "snake") {
          ctx.fillStyle = theme.tone(4)
          ctx.beginPath(); ctx.arc(p.x, p.y + h * 0.1, cw * 0.22, 0, Math.PI * 2); ctx.fill()
          ctx.beginPath(); ctx.arc(p.x, p.y - h * 0.45, cw * 0.16, 0, Math.PI * 2); ctx.fill()
          ctx.fillStyle = theme.background
          ctx.beginPath(); ctx.arc(p.x - cw * 0.06, p.y - h * 0.5, cw * 0.04, 0, Math.PI * 2); ctx.arc(p.x + cw * 0.06, p.y - h * 0.5, cw * 0.04, 0, Math.PI * 2); ctx.fill()
        } else {
          ctx.fillStyle = e.kind === "red" ? theme.danger : e.kind === "green" ? theme.tone(2) : theme.tone(4)
          ctx.beginPath(); ctx.arc(p.x, p.y, cw * (e.kind === "purple" ? 0.2 : 0.16), 0, Math.PI * 2); ctx.fill()
        }
        if (s.freeze > 0) { ctx.strokeStyle = theme.foreground; ctx.lineWidth = 1; ctx.stroke() }
      }

      // The hopper (riding a disc, hopping, or falling off the side).
      var pp
      if (s.ride) {
        var from = cubeXY(L, s.ride.r, s.ride.c), to = cubeXY(L, -1.2, -0.6)
        pp = { x: from.x + (to.x - from.x) * s.ride.t, y: from.y + (to.y - from.y) * s.ride.t - L.h * 0.3 }
        ctx.fillStyle = theme.tone(5)
        ctx.beginPath(); ctx.ellipse(pp.x - cw * 0.32, pp.y + h * 0.2, cw * 0.64, h * 0.45); ctx.fill()
      } else {
        pp = entityXY(L, s.p)
        if (s.p.state === "fall") pp.y += (1.4 - s.dying) * cw * 3
      }
      if (!(s.dying > 0 && s.p.state !== "fall" && Math.floor(s.dying * 8) % 2)) {
        var dir = s.p.dir || "dl", fx = dir === "ur" || dir === "dr" ? 1 : -1, fy = dir === "dl" || dir === "dr" ? 1 : -1
        ctx.fillStyle = theme.tone(3)
        ctx.beginPath(); ctx.arc(pp.x, pp.y, cw * 0.22, 0, Math.PI * 2); ctx.fill()
        // The snout, pointing the way it last hopped.
        ctx.beginPath(); ctx.arc(pp.x + fx * cw * 0.2, pp.y + fy * cw * 0.08, cw * 0.09, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = theme.background
        ctx.beginPath(); ctx.arc(pp.x + fx * cw * 0.07, pp.y - cw * 0.06, cw * 0.05, 0, Math.PI * 2); ctx.fill()
      }
      if (s.dying > 0 && s.p.state !== "fall") {
        ctx.fillStyle = theme.danger
        ctx.font = "bold " + Math.floor(cw * 0.3) + "px " + theme.fontFamily
        ctx.textAlign = "center"; ctx.textBaseline = "bottom"
        ctx.fillText("@!#?@!", pp.x, pp.y - cw * 0.3)
      }

      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.font = "bold " + Math.floor(cw * 0.28) + "px " + theme.fontFamily
      for (var o = 0; o < s.pops.length; ++o) {
        var op = cubeXY(L, s.pops[o].r, s.pops[o].c)
        ctx.fillStyle = theme.withAlpha(theme.foreground, Math.min(1, s.pops[o].t * 2))
        ctx.fillText(s.pops[o].text, op.x, op.y - cw * 0.7)
      }

      // Target colour and score, top left.
      ctx.textAlign = "left"; ctx.textBaseline = "top"
      ctx.fillStyle = theme.dim
      ctx.font = "bold " + Math.floor(cw * 0.22) + "px " + theme.fontFamily
      ctx.fillText(String(s.score), 10, 8)
      ctx.fillText("TARGET", 10, 8 + cw * 0.32)
      ctx.fillStyle = theme.accent
      ctx.beginPath(); var tx = 10 + cw * 0.3, ty = 8 + cw * 0.85
      ctx.moveTo(tx, ty - h / 3); ctx.lineTo(tx + cw / 3, ty); ctx.lineTo(tx, ty + h / 3); ctx.lineTo(tx - cw / 3, ty); ctx.closePath(); ctx.fill()
      if (s.msgT > 0) {
        ctx.textAlign = "center"; ctx.textBaseline = "middle"
        ctx.fillStyle = theme.accent
        ctx.font = "bold " + Math.floor(cw * 0.45) + "px " + theme.fontFamily
        ctx.fillText(s.msg, width / 2, height - cw * 0.35)
      }
      if (root.paused) {
        ctx.fillStyle = theme.background; ctx.globalAlpha = 0.8; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
