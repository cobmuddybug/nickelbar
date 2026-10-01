import QtQuick
import "../engine" as Engine
import "logic/tempest.js" as Tempest

// Tempest; see logic/tempest.js.
Engine.GameBase {
  id: root
  gameId: "tempest"
  title: "VORTEX"
  helpText: "ARROWS slide round the rim (the way the arrow points on screen) · SPACE fire (hold for a stream) · Z superzapper, once a level · flippers climb and hop lanes, then hunt you on the rim · tankers split in two · spikers leave spikes: shoot them down before the warp, or the warp kills you · flipper 150, tanker 100, spiker 50, warp 500 × level"
  mouseHelp: "Point to pick a lane; hold the button to fire, right-click to zap"

  property var state: null
  tickInterval: 16
  continuousMove: true
  ticking: !!state && !over
  score: state ? state.score : 0
  overTitle: state ? "LEVEL " + state.level + " · " + state.score : ""
  status: !state ? ""
    : over ? "GAME OVER  ·  SPACE to play again"
    : paused ? "PAUSED"
    : "LEVEL " + state.level + " · " + state.shape.name + "  ·  " + state.lives + (state.lives === 1 ? " life" : " lives")
      + (state.zapper ? "  ·  Z zapper ready" : "")

  property bool mouseFire: false
  property int mouseLane: -1

  onTick: {
    state = Tempest.step(state, { dx: heldDx, dy: heldDy, fire: heldAction || mouseFire, lane: heldDx || heldDy ? -1 : mouseLane }, tickInterval / 1000)
    if (state.dead) over = true
  }

  function newGame() { state = Tempest.makeState(); over = false; paused = false; mouseFire = false; mouseLane = -1 }
  function moveCursor(dx, dy) { mouseLane = -1 }
  function activate() { if (over) newGame() }

  function handleKey(key, text) {
    if (text === "z" || text === "Z") { if (state && !over) state = Tempest.zap(state); return true }
    return false
  }

  function pointer(kind, x, y, b) {
    if (!state) return
    var g = board.geom()
    mouseLane = Tempest.laneAt(state, (x - g.cx) / g.R, (y - g.cy) / g.R)
    if (kind === "press" && b === Qt.RightButton) { state = Tempest.zap(state); return }
    if (kind === "press") mouseFire = true
    if (kind === "release") mouseFire = false
  }

  // The whole state is plain data, so it saves as is.
  function saveState() { return state && !over ? JSON.parse(JSON.stringify(state)) : null }
  function loadState(saved) {
    if (saved && typeof saved === "object" && saved.shape !== undefined) { state = saved; over = false; paused = false }
    else newGame()
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    anchors.fill: parent
    Engine.Pointer { game: root; shape: Qt.CrossCursor }

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onOverChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    function geom() { return { cx: width / 2, cy: height / 2, R: Math.min(width, height) * 0.43 } }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state, sh = s.shape, g = geom(), n = Tempest.lanes(sh)
      function P(lane, t, z) { var p = Tempest.lanePoint(sh, lane, t, z); return [g.cx + p[0] * g.R, g.cy + p[1] * g.R] }
      function V(i, z) { var q = sh.pts[i % sh.pts.length], k = Tempest.scale(z); return [g.cx + q[0] * k * g.R, g.cy + q[1] * k * g.R] }
      ctx.lineCap = "round"; ctx.lineJoin = "round"
      var np = sh.closed ? sh.pts.length : sh.pts.length

      if (s.flash > 0) { ctx.fillStyle = theme.withAlpha(theme.foreground, s.flash * 0.25); ctx.fillRect(0, 0, width, height) }

      // The tube: spokes, far edge, rim. The claw's lane is lit.
      ctx.strokeStyle = theme.withAlpha(theme.tone(0), 0.45); ctx.lineWidth = 1
      for (var i = 0; i < np; ++i) {
        var a = V(i, 0), b = V(i, 1)
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke()
      }
      for (var ring = 0; ring < 2; ++ring) {
        ctx.strokeStyle = ring ? theme.tone(0) : theme.withAlpha(theme.tone(0), 0.45)
        ctx.lineWidth = ring ? 2 : 1
        ctx.beginPath()
        for (var j = 0; j <= (sh.closed ? np : np - 1); ++j) {
          var v = V(j, ring)
          if (j === 0) ctx.moveTo(v[0], v[1]); else ctx.lineTo(v[0], v[1])
        }
        ctx.stroke()
      }
      if (s.respawn <= 0 && !root.over) {
        ctx.strokeStyle = theme.withAlpha(theme.accent, 0.5); ctx.lineWidth = 2
        var l0 = V(s.lane, 0), l1 = V(s.lane, 1), r0 = V(s.lane + 1, 0), r1 = V(s.lane + 1, 1)
        ctx.beginPath(); ctx.moveTo(l0[0], l0[1]); ctx.lineTo(l1[0], l1[1]); ctx.moveTo(r0[0], r0[1]); ctx.lineTo(r1[0], r1[1]); ctx.stroke()
      }

      // Spikes.
      ctx.strokeStyle = theme.tone(2); ctx.lineWidth = 2
      for (var k = 0; k < s.spikes.length; ++k) {
        if (s.spikes[k] <= 0) continue
        var f0 = P(k, 0.5, 0), f1 = P(k, 0.5, s.spikes[k])
        ctx.beginPath(); ctx.moveTo(f0[0], f0[1]); ctx.lineTo(f1[0], f1[1]); ctx.stroke()
        ctx.fillStyle = theme.tone(2)
        ctx.beginPath(); ctx.arc(f1[0], f1[1], 2.5, 0, Math.PI * 2); ctx.fill()
      }

      // Enemies.
      for (var e = 0; e < s.enemies.length; ++e) {
        var en = s.enemies[e], L = P(en.lane, 0.08, en.z), R = P(en.lane, 0.92, en.z), M = P(en.lane, 0.5, en.z)
        var dz = Math.min(1, en.z + 0.05), U = P(en.lane, 0.5, dz)
        var hx = (U[0] - M[0]) * 0.8, hy = (U[1] - M[1]) * 0.8
        ctx.lineWidth = 2
        if (en.kind === "flipper") {
          ctx.strokeStyle = theme.tone(1)
          ctx.beginPath()
          ctx.moveTo(L[0], L[1]); ctx.lineTo(R[0] - hx, R[1] - hy); ctx.lineTo(R[0], R[1]); ctx.lineTo(L[0] - hx, L[1] - hy); ctx.closePath(); ctx.stroke()
        } else if (en.kind === "tanker") {
          ctx.strokeStyle = theme.tone(4)
          ctx.beginPath()
          ctx.moveTo(L[0], L[1]); ctx.lineTo(M[0] - hx * 1.5, M[1] - hy * 1.5); ctx.lineTo(R[0], R[1]); ctx.lineTo(M[0] + hx * 1.5, M[1] + hy * 1.5); ctx.closePath(); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(L[0], L[1]); ctx.lineTo(R[0], R[1]); ctx.stroke()
        } else {
          ctx.strokeStyle = theme.tone(2)
          var rr = Math.max(3, Math.sqrt((R[0] - L[0]) * (R[0] - L[0]) + (R[1] - L[1]) * (R[1] - L[1])) * 0.35)
          ctx.beginPath()
          for (var sp = 0; sp < 20; ++sp) {
            var aa = sp * 0.6 + s.t * 6, rad = rr * sp / 20
            ctx.lineTo(M[0] + Math.cos(aa) * rad, M[1] + Math.sin(aa) * rad)
          }
          ctx.stroke()
        }
      }

      // Shots.
      ctx.fillStyle = theme.highlight
      for (var q = 0; q < s.shots.length; ++q) {
        var sp2 = P(s.shots[q].lane, 0.5, s.shots[q].z)
        ctx.beginPath(); ctx.arc(sp2[0], sp2[1], Math.max(1.5, 4 * Tempest.scale(s.shots[q].z)), 0, Math.PI * 2); ctx.fill()
      }
      ctx.strokeStyle = theme.danger; ctx.lineWidth = 1.5
      for (var w = 0; w < s.eshots.length; ++w) {
        var ep = P(s.eshots[w].lane, 0.5, s.eshots[w].z), es = Math.max(2, 5 * Tempest.scale(s.eshots[w].z))
        ctx.beginPath(); ctx.moveTo(ep[0] - es, ep[1]); ctx.lineTo(ep[0] + es, ep[1]); ctx.moveTo(ep[0], ep[1] - es); ctx.lineTo(ep[0], ep[1] + es); ctx.stroke()
      }
      for (var o = 0; o < s.booms.length; ++o) {
        var bm = s.booms[o], bp = P(bm.lane, 0.5, bm.z)
        ctx.strokeStyle = theme.withAlpha(theme.tone(3), bm.t * 2.5); ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(bp[0], bp[1], (0.45 - bm.t) * 60 * Tempest.scale(bm.z) + 2, 0, Math.PI * 2); ctx.stroke()
      }

      // The claw, on the rim (or riding down in the warp).
      if (s.respawn <= 0 && !root.over) {
        var cz = s.phase === "warp" ? s.warp : 1
        var cl = P(s.lane, 0, cz), cr = P(s.lane, 1, cz), cm = P(s.lane, 0.5, cz), inner = P(s.lane, 0.5, Math.max(0, cz - 0.08))
        var ox = cm[0] - inner[0], oy = cm[1] - inner[1]
        ctx.strokeStyle = theme.accent; ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.moveTo(cl[0], cl[1]); ctx.lineTo(cm[0] + ox * 0.45, cm[1] + oy * 0.45); ctx.lineTo(cr[0], cr[1])
        ctx.lineTo(cm[0] - ox * 0.25, cm[1] - oy * 0.25); ctx.closePath(); ctx.stroke()
      }

      ctx.textAlign = "left"; ctx.textBaseline = "top"
      ctx.fillStyle = theme.dim
      ctx.font = "bold " + Math.floor(g.R * 0.08) + "px " + theme.fontFamily
      ctx.fillText(String(s.score), 10, 8)
      if (s.msgT > 0) {
        ctx.textAlign = "center"; ctx.textBaseline = "middle"
        ctx.fillStyle = theme.accent
        ctx.font = "bold " + Math.floor(g.R * 0.1) + "px " + theme.fontFamily
        ctx.fillText(s.msg, g.cx, g.cy)
      }
      if (root.paused) {
        ctx.fillStyle = theme.background; ctx.globalAlpha = 0.8; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
