import QtQuick
import "../engine" as Engine
import "logic/grapple.js" as Grap

// Grapple (after Floating Point); see logic/grapple.js. Score is metres
// plus ten per orb.
Engine.GameBase {
  id: root
  gameId: "grapple"
  title: "GRAPPLE"
  helpText: "Hold SPACE to grab the ceiling ahead (the ring shows where) and swing; let go to fly · LEFT/RIGHT pump the swing, or drift in the air · UP reels in (faster swing), DOWN pays out · let go on the upswing for distance · no grabbing over gaps · keep off the floor and the spikes · orbs are worth 10"
  mouseHelp: "Hold the button to grab toward the pointer (above you); release to let go"

  property var state: null
  tickInterval: 16
  continuousMove: true
  ticking: !!state && !over
  score: state ? Grap.score(state) : 0
  overTitle: state ? state.dist + " m · " + state.orbs + " orbs" : ""
  status: !state ? ""
    : over ? "DOWN  ·  SPACE to play again"
    : paused ? "PAUSED"
    : !state.started ? "hold SPACE to grab the ceiling, let go to fly" : state.dist + " m  ·  " + state.orbs + " orbs"

  property bool mouseHold: false
  property var mouseAim: null

  onTick: {
    state = Grap.step(state, { hold: heldAction || mouseHold, dx: heldDx, dy: heldDy, aim: mouseAim }, tickInterval / 1000)
    if (state.dead) over = true
  }

  function newGame() { state = Grap.makeState(); over = false; paused = false; mouseHold = false; mouseAim = null }
  function moveCursor(dx, dy) { mouseAim = null }
  function activate() { if (over) newGame() }

  function pointer(kind, x, y, b) {
    if (!state) return
    var u = board.unit, a = Math.atan2(y / u - state.p.y, x / u + state.camX - state.p.x)
    mouseAim = a < -0.15 && a > -3.0 ? a : null
    if (kind === "press") mouseHold = true
    if (kind === "release") mouseHold = false
  }

  // The whole state is plain data, so it saves as is.
  function saveState() { return state && !over ? JSON.parse(JSON.stringify(state)) : null }
  function loadState(saved) {
    if (saved && typeof saved === "object" && saved.w !== undefined) { state = saved; over = false; paused = false }
    else newGame()
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root; shape: Qt.CrossCursor }
    anchors.centerIn: parent
    readonly property real unit: Math.min(parent.width / Grap.VIEW_W, parent.height / Grap.H)
    width: unit * Grap.VIEW_W
    height: unit * Grap.H

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
      var s = root.state, w = s.w, u = unit, cam = s.camX
      function X(x) { return (x - cam) * u }
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.03)
      ctx.fillRect(0, 0, width, height)

      // Ceiling and spikes, a column at a time.
      var i0 = Math.max(0, Math.floor(cam)), i1 = Math.min(w.ceil.length - 1, Math.ceil(cam + Grap.VIEW_W))
      for (var i = i0; i <= i1; ++i) {
        var c = w.ceil[i]
        if (c !== Grap.NONE) {
          // Whole pixels, so the translucent columns meet without seams.
          var x0 = Math.round(X(i)), x1 = Math.round(X(i + 1))
          ctx.fillStyle = theme.withAlpha(theme.tone(0), 0.5)
          ctx.fillRect(x0, 0, x1 - x0, Math.round(c * u))
          ctx.fillStyle = theme.tone(0)
          ctx.fillRect(x0, Math.round(c * u) - Math.max(2, Math.round(u * 0.1)), x1 - x0, Math.max(2, Math.round(u * 0.1)))
        }
        var sp = w.spike[i]
        if (sp < Grap.H) {
          ctx.fillStyle = theme.danger
          ctx.beginPath(); ctx.moveTo(X(i), Grap.H * u); ctx.lineTo(X(i + 0.5), sp * u); ctx.lineTo(X(i + 1), Grap.H * u); ctx.closePath(); ctx.fill()
        }
      }
      // The floor.
      ctx.fillStyle = theme.withAlpha(theme.danger, 0.35)
      ctx.fillRect(0, (Grap.H - 0.25) * u, width, 0.25 * u)

      ctx.fillStyle = theme.tone(3)
      for (var o = 0; o < w.orbs.length; ++o) {
        var orb = w.orbs[o]
        if (orb.got || orb.x < cam - 1 || orb.x > cam + Grap.VIEW_W + 1) continue
        ctx.beginPath(); ctx.arc(X(orb.x), orb.y * u, 0.22 * u, 0, Math.PI * 2); ctx.fill()
      }

      var p = s.p
      // Aim guide while free; the line itself while attached (or a whiff).
      ctx.lineCap = "round"
      if (s.line) {
        ctx.strokeStyle = theme.foreground; ctx.lineWidth = Math.max(1.5, u * 0.05)
        ctx.beginPath(); ctx.moveTo(X(p.x), p.y * u); ctx.lineTo(X(s.line.x), s.line.y * u); ctx.stroke()
        ctx.fillStyle = theme.foreground
        ctx.beginPath(); ctx.arc(X(s.line.x), s.line.y * u, 0.12 * u, 0, Math.PI * 2); ctx.fill()
      } else if (!root.over && s.target) {
        // Where a grab would catch.
        ctx.strokeStyle = theme.withAlpha(theme.foreground, 0.7); ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.arc(X(s.target.x), s.target.y * u, 0.22 * u, 0, Math.PI * 2); ctx.stroke()
        ctx.fillStyle = theme.withAlpha(theme.foreground, 0.25)
        var len = s.target.len
        for (var d = 0.6; d < len - 0.3; d += 0.5) {
          ctx.beginPath(); ctx.arc(X(p.x + (s.target.x - p.x) * d / len), (p.y + (s.target.y - p.y) * d / len) * u, Math.max(1, u * 0.035), 0, Math.PI * 2); ctx.fill()
        }
      }
      if (s.missT > 0 && s.missTo) {
        ctx.strokeStyle = theme.withAlpha(theme.danger, s.missT * 3); ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(X(p.x), p.y * u); ctx.lineTo(X(s.missTo.x), s.missTo.y * u); ctx.stroke()
      }
      ctx.fillStyle = root.over ? theme.danger : theme.accent
      ctx.beginPath(); ctx.arc(X(p.x), p.y * u, Grap.R * u, 0, Math.PI * 2); ctx.fill()

      ctx.textAlign = "right"; ctx.textBaseline = "top"
      ctx.fillStyle = theme.foreground
      ctx.font = "bold " + Math.floor(u * 0.6) + "px " + theme.fontFamily
      ctx.fillText(s.dist + " m", width - u * 0.3, (Grap.H - 1.4) * u)
      if (root.paused) {
        ctx.fillStyle = theme.background; ctx.globalAlpha = 0.8; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
