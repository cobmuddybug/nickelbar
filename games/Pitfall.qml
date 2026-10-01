import QtQuick
import "../engine" as Engine
import "logic/pitfall.js" as Pitfall

// Jungle run after Pitfall!: hop logs, fire and cobras, swing over the tar
// and quicksand on vines, cross the crocodile pond on closed mouths, take
// the tunnels to skip three screens at a time, and grab the treasure.
// Three lives and a clock; the score is points, as in the original.
Engine.GameBase {
  id: root
  gameId: "pitfall"
  title: "JUNGLE RUN"
  helpText: "LEFT/RIGHT run · UP or SPACE jump (grab a vine in mid-air, SPACE lets go) · hold UP at a ladder to climb out · logs, fire and cobras cost 100 points; pits, water and scorpions cost a life · walk into a hole to drop to the tunnel"
  mouseHelp: "Hold left and drag to run toward the pointer (above your head to climb) · right-click jumps"

  property var state: null
  property bool started: false
  property bool mouseHeld: false
  property real mouseX: 0
  property real mouseY: 0
  tickInterval: 16
  continuousMove: true
  ticking: !!state && state.alive && started && !over
  score: state ? state.score : 0
  progress: state ? state.treasures + "/" + treasureTotal + " treasures" : ""
  overTitle: !state ? "" : (state.won ? "OUT OF THE JUNGLE" : (state.time <= 0 ? "OUT OF TIME" : "GAME OVER"))
  readonly property int treasureTotal: Pitfall.countTreasures()

  function clock(t) {
    var m = Math.floor(t / 60), s = Math.floor(t % 60)
    return m + ":" + (s < 10 ? "0" : "") + s
  }

  status: !state ? ""
    : (over ? "N or SPACE to play again"
      : (paused ? "PAUSED"
        : (!started ? "RIGHT to run · SPACE to jump"
          : clock(state.time) + "  ·  " + state.lives + (state.lives === 1 ? " life" : " lives") + "  ·  " + state.treasures + "/" + treasureTotal + "  ·  screen " + (state.i + 1) + "/" + Pitfall.N)))

  function steer() {
    var dx = heldDx, up = heldDy < 0
    if (mouseHeld && state) {
      var px = state.x * board.width, py = board.playerY(state)
      if (!dx) dx = mouseX > px + board.width * 0.03 ? 1 : (mouseX < px - board.width * 0.03 ? -1 : 0)
      if (mouseY < py - board.height * 0.22) up = true
    }
    return { dx: dx, up: up }
  }

  onTick: {
    state = Pitfall.step(state, steer(), tickInterval / 1000)
    if (!state.alive) over = true
  }

  function newGame() {
    state = Pitfall.makeState()
    started = false
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {
    if (dy < 0) jumpNow()
  }

  function jumpNow() {
    if (over) { newGame(); started = true; return }
    if (!state) return
    started = true
    state = Pitfall.jump(state)
  }

  function activate() { jumpNow() }

  function saveState() {
    if (!state || over || !state.alive) return null
    return Pitfall.serialize(state)
  }

  function loadState(saved) {
    var restored = Pitfall.deserialize(saved)
    if (restored) { state = restored; over = false; started = false }
    else newGame()
  }

  // Mouse (engine/Pointer.qml): hold left to run toward the pointer,
  // right-click to jump.
  function pointer(kind, x, y, b) {
    mouseX = x; mouseY = y
    if (kind === "press") {
      if (b === Qt.LeftButton) mouseHeld = true
      else if (b === Qt.RightButton) jumpNow()
    } else if (kind === "release") {
      mouseHeld = false
    }
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property real unit: Math.min(parent.width, parent.height / 0.62)
    width: unit
    height: unit * 0.62
    readonly property real gy: height * 0.52       // surface
    readonly property real floorY: height * 0.94    // tunnel floor
    readonly property real roofY: height * 0.66     // tunnel ceiling

    function playerY(s) { return s.mode === "under" ? floorY - s.y * unit : gy - s.y * unit }

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
      var s = root.state, u = unit, gy0 = gy
      var k = Pitfall.kind(s.i)
      function X(x) { return x * u }
      function Y(y) { return gy0 - y * u }
      function box(x, y, w, h) { ctx.fillRect(X(x), Y(y + h), w * u, h * u) }

      // Canopy and trunks.
      ctx.fillStyle = theme.withAlpha(theme.tone(4), 0.35)
      ctx.fillRect(0, 0, width, height * 0.1)
      for (var c = 0; c < 9; ++c) {
        var cx = (c + 0.5) / 9 + (Pitfall.rnd(s.i, 20 + c) - 0.5) * 0.06
        ctx.beginPath(); ctx.arc(X(cx), height * 0.1, u * (0.05 + Pitfall.rnd(s.i, 40 + c) * 0.04), 0, Math.PI); ctx.fill()
      }
      ctx.fillStyle = theme.withAlpha(theme.tone(2), 0.5)
      for (var t = 0; t < 5; ++t) {
        var tx = 0.06 + t * 0.22 + (Pitfall.rnd(s.i, 60 + t) - 0.5) * 0.08
        ctx.fillRect(X(tx), height * 0.1, u * 0.018, gy0 - height * 0.1)
      }

      // Ground, and the earth under it.
      ctx.fillStyle = theme.withAlpha(theme.tone(4), 0.55)
      ctx.fillRect(0, gy0, width, height * 0.03)
      ctx.fillStyle = theme.withAlpha(theme.tone(2), 0.28)
      ctx.fillRect(0, gy0 + height * 0.03, width, height - gy0 - height * 0.03)

      // Pits and ponds cut through the ground.
      if (k === "tar" || k === "sand" || k === "crocs") {
        var pw = (Pitfall.PIT_R - Pitfall.PIT_L) * u
        ctx.fillStyle = theme.background
        ctx.fillRect(X(Pitfall.PIT_L), gy0, pw, height * 0.09)
        ctx.fillStyle = k === "tar" ? theme.dim : (k === "sand" ? theme.withAlpha(theme.tone(2), 0.85) : theme.withAlpha(theme.tone(3), 0.8))
        ctx.fillRect(X(Pitfall.PIT_L), gy0, pw, height * 0.05)
        if (k === "crocs") {
          for (var n = 0; n < 3; ++n) {
            var open = Pitfall.crocOpen(s.clock, n)
            var warn = !open && Pitfall.crocWarn(s.clock, n) < 0.35
            var cx0 = Pitfall.CROC_X[n] - Pitfall.CROC_HALF
            ctx.fillStyle = theme.tone(4)
            box(cx0, -0.01, Pitfall.CROC_HALF * 2, 0.02)
            box(cx0 + Pitfall.CROC_HALF * 1.4, 0.0, Pitfall.CROC_HALF * 0.6, open ? 0.035 : 0.022)
            if (open) {
              ctx.fillStyle = theme.danger
              box(cx0 + Pitfall.CROC_HALF * 1.2, 0.012, Pitfall.CROC_HALF * 0.8, 0.012)
            } else if (warn) {
              ctx.fillStyle = theme.danger
              box(cx0 + Pitfall.CROC_HALF * 1.5, 0.018, Pitfall.CROC_HALF * 0.3, 0.008)
            }
            ctx.fillStyle = theme.background
            box(cx0 + Pitfall.CROC_HALF * 0.3, 0.012, 0.008, 0.008)
          }
        }
      }

      // Hole and the tunnel beneath it.
      if (k === "hole") {
        var hx = Pitfall.HOLE_X - Pitfall.HOLE_R
        ctx.fillStyle = theme.background
        ctx.fillRect(X(hx), gy0, Pitfall.HOLE_R * 2 * u, height * 0.03)
        var side = Pitfall.wallAt(s.i)
        ctx.fillStyle = theme.background
        ctx.fillRect(0, roofY, width, floorY - roofY)
        ctx.strokeStyle = theme.dim
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(X(hx + 0.01), gy0); ctx.lineTo(X(hx + 0.01), roofY)
        ctx.moveTo(X(hx + Pitfall.HOLE_R * 2 - 0.01), gy0); ctx.lineTo(X(hx + Pitfall.HOLE_R * 2 - 0.01), roofY)
        for (var r = 0; r < 12; ++r) {
          var ry = gy0 + (floorY - gy0) * (r + 0.5) / 12
          ctx.moveTo(X(hx + 0.01), ry); ctx.lineTo(X(hx + Pitfall.HOLE_R * 2 - 0.01), ry)
        }
        ctx.stroke()
        if (side !== 0) {
          var wx = Pitfall.wallX(side)
          ctx.fillStyle = theme.tone(2)
          ctx.fillRect(X(wx - 0.02), roofY, u * 0.04, floorY - roofY)
          ctx.fillStyle = theme.background
          for (var b = 0; b < 6; ++b) ctx.fillRect(X(wx - 0.02), roofY + (floorY - roofY) * b / 6, u * 0.04, 1.5)
        }
        // Scorpion.
        var sc = s.scorpion || Pitfall.freshScorpion(s.i)
        ctx.fillStyle = theme.danger
        var sy = floorY - 0.018 * u
        ctx.fillRect(X(sc.x) - u * 0.025, sy, u * 0.05, u * 0.018)
        ctx.fillRect(X(sc.x) - sc.dir * u * 0.04, sy - u * 0.012, u * 0.02, u * 0.01)
        ctx.fillRect(X(sc.x) + sc.dir * u * 0.02, sy - u * 0.03, u * 0.012, u * 0.03)
      }

      // Vine.
      if (k === "tar" || k === "sand") {
        var tip = Pitfall.vineTip(s.clock, s.i)
        ctx.strokeStyle = theme.tone(4)
        ctx.lineWidth = 3
        ctx.beginPath(); ctx.moveTo(X(Pitfall.VINE_X), height * 0.1); ctx.lineTo(X(Pitfall.VINE_X), Y(Pitfall.VINE_Y)); ctx.lineTo(X(tip.x), Y(tip.y)); ctx.stroke()
      }

      // Fire and cobra.
      if (k === "fire") {
        var fl = Math.floor(s.clock * 8) % 2
        ctx.fillStyle = theme.danger
        ctx.beginPath()
        ctx.moveTo(X(0.46), Y(0)); ctx.lineTo(X(0.5), Y(fl ? 0.085 : 0.07)); ctx.lineTo(X(0.54), Y(0)); ctx.fill()
        ctx.fillStyle = theme.tone(2)
        ctx.beginPath()
        ctx.moveTo(X(0.48), Y(0)); ctx.lineTo(X(0.5), Y(fl ? 0.045 : 0.055)); ctx.lineTo(X(0.52), Y(0)); ctx.fill()
      } else if (k === "cobra") {
        ctx.fillStyle = theme.accent
        box(0.47, 0, 0.06, 0.022)
        box(0.49, 0.022, 0.025, 0.04)
        box(0.48, 0.06, 0.04, 0.018)
        ctx.fillStyle = theme.background
        box(0.505, 0.066, 0.008, 0.006)
      }

      // Logs.
      for (var q = 0; q < s.logs.length; ++q) {
        var lg = s.logs[q]
        ctx.fillStyle = theme.tone(2)
        ctx.beginPath(); ctx.arc(X(lg.x), Y(0.04), u * 0.04, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = theme.background
        ctx.lineWidth = 1.5
        var rot = lg.x * 30
        ctx.beginPath(); ctx.moveTo(X(lg.x), Y(0.04)); ctx.lineTo(X(lg.x) + Math.cos(rot) * u * 0.035, Y(0.04) + Math.sin(rot) * u * 0.035); ctx.stroke()
      }

      // Treasure.
      var tr = Pitfall.treasureAt(s.i)
      if (tr && !s.taken[s.i]) {
        var glint = Math.floor(s.clock * 4) % 2
        ctx.fillStyle = theme.tone(tr.type === 3 ? 3 : (tr.type === 1 ? 5 : (tr.type === 2 ? 2 : 4)))
        if (tr.type === 0) { box(tr.x - 0.02, 0, 0.04, 0.035); box(tr.x - 0.012, 0.035, 0.024, 0.01) }
        else if (tr.type === 1) { box(tr.x - 0.03, 0, 0.06, 0.025) }
        else if (tr.type === 2) { box(tr.x - 0.03, 0, 0.06, 0.03); box(tr.x - 0.02, 0.03, 0.04, 0.012) }
        else {
          ctx.strokeStyle = ctx.fillStyle
          ctx.lineWidth = 3
          ctx.beginPath(); ctx.arc(X(tr.x), Y(0.022), u * 0.017, 0, Math.PI * 2); ctx.stroke()
        }
        if (glint) { ctx.fillStyle = theme.foreground; box(tr.x + 0.012, 0.04, 0.008, 0.008) }
      }

      // Player.
      var blink = s.invuln > 0 && Math.floor(s.clock * 12) % 2 === 0
      if (!blink) {
        var under = s.mode === "under"
        var baseY = under ? floorY : gy0
        var px = X(s.x), pyB = baseY - s.y * u
        var ph = Pitfall.PLAYER_H * u, pw2 = Pitfall.PLAYER_W * u
        var moving = (s.mode === "run" || under) && s.y === 0 && s.dead <= 0
        var stride = moving ? Math.floor(s.clock * 10) % 2 : 0
        ctx.fillStyle = s.dead > 0 ? theme.dim : theme.foreground
        if (s.dead > 0) {
          ctx.fillRect(px - ph * 0.5, pyB - pw2 * 0.6, ph, pw2 * 0.6)
        } else if (s.mode === "vine") {
          ctx.fillRect(px - pw2 * 0.3, pyB - ph, pw2 * 0.6, ph * 0.55)
          ctx.fillRect(px - pw2 * 0.15, pyB - ph * 1.1, pw2 * 0.3, ph * 0.5)
          ctx.fillRect(px - pw2 * 0.3, pyB - ph * 0.45, pw2 * 0.25, ph * 0.45)
          ctx.fillRect(px + pw2 * 0.05, pyB - ph * 0.45, pw2 * 0.25, ph * 0.45)
        } else {
          ctx.fillRect(px - pw2 * 0.35, pyB - ph * 0.95, pw2 * 0.7, pw2 * 0.7)   // head
          ctx.fillRect(px - pw2 * 0.3, pyB - ph * 0.72, pw2 * 0.6, ph * 0.36)     // body
          ctx.fillStyle = theme.accent
          ctx.fillRect(px - pw2 * 0.3, pyB - ph * 0.58, pw2 * 0.6, ph * 0.1)      // belt
          ctx.fillStyle = theme.foreground
          var air = s.y > 0
          var l1 = air ? 0.3 : (stride ? 0.36 : 0.22), l2 = air ? 0.22 : (stride ? 0.22 : 0.36)
          ctx.fillRect(px - pw2 * 0.3, pyB - ph * 0.36, pw2 * 0.25, ph * l1)
          ctx.fillRect(px + pw2 * 0.05, pyB - ph * 0.36, pw2 * 0.25, ph * l2)
          if (air) {
            ctx.fillRect(px + s.face * pw2 * 0.3, pyB - ph * 0.85, pw2 * 0.3 * s.face, pw2 * 0.15)
          }
        }
      }

      // HUD.
      ctx.fillStyle = theme.dim
      ctx.font = "bold " + Math.floor(u * 0.04) + "px " + theme.fontFamily
      ctx.textAlign = "left"; ctx.textBaseline = "top"
      ctx.fillText(String(s.score).padStart(6, "0"), 8, 6)
      ctx.textAlign = "right"
      ctx.fillText(root.clock(s.time), width - 8, 6)
      ctx.fillStyle = theme.danger
      for (var lv = 0; lv < s.lives; ++lv) {
        ctx.beginPath(); ctx.arc(width - 12 - lv * u * 0.035, 6 + u * 0.06, u * 0.011, 0, Math.PI * 2); ctx.fill()
      }
      if (s.flashT > 0) {
        ctx.fillStyle = theme.foreground
        ctx.textAlign = "center"
        ctx.font = "bold " + Math.floor(u * 0.036) + "px " + theme.fontFamily
        ctx.fillText(s.flash, width / 2, height * 0.16)
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
