import QtQuick
import "../engine" as Engine
import "logic/minigolf.js" as Golf

// Mini golf, nine holes; see logic/minigolf.js. Score is points per hole
// against par.
Engine.GameBase {
  id: root
  gameId: "minigolf"
  title: "MINI GOLF"
  helpText: "LEFT/RIGHT aim (hold) · UP/DOWN fine aim · hold SPACE to build power (it swings up and back), release to putt · sand drags, water costs a stroke, slopes pull, mind the windmill · per hole: ace 100, eagle 100, birdie 80, par 60, bogey 40, double 20 · eight strokes and you pick up"
  mouseHelp: "Point to aim; hold the button to build power, release to putt"

  property var state: null
  tickInterval: 16
  continuousMove: true
  ticking: !!state && !over
  score: state ? state.points : 0
  readonly property int rel: state ? Golf.toPar(state) : 0
  readonly property string relText: rel === 0 ? "EVEN" : rel > 0 ? "+" + rel : String(rel)
  overTitle: state ? Golf.totalStrokes(state) + " STROKES · " + relText : ""
  status: !state ? ""
    : over ? "NINE HOLES, " + relText + "  ·  SPACE to play again"
    : paused ? "PAUSED"
    : "HOLE " + (state.hole + 1) + "/" + Golf.HOLES.length + "  ·  PAR " + Golf.HOLES[state.hole].par
      + "  ·  STROKE " + (state.strokes + (state.phase === "aim" ? 1 : 0)) + "  ·  " + relText
      + (state.phase === "sunk" ? "  ·  SPACE next hole" : "")

  property bool mouseHold: false

  onTick: {
    state = Golf.step(state, { turn: heldDx, fine: heldDy, hold: heldAction || mouseHold }, tickInterval / 1000)
    if (state.phase === "done") over = true
  }

  function newGame() { state = Golf.makeState(); over = false; paused = false; mouseHold = false }
  function moveCursor(dx, dy) {}
  function activate() {
    if (over) { newGame(); return }
    if (state && state.phase === "sunk") state = Golf.nextHole(state)
  }

  function saveState() { return state && !over ? Golf.serialize(state) : null }
  function loadState(saved) {
    var r = Golf.deserialize(saved)
    if (r) { state = r; over = false }
    else newGame()
  }

  function pointer(kind, x, y, b) {
    if (!state || over) return
    var u = board.unit
    if (state.phase === "aim" && (kind === "move" || kind === "drag" || kind === "press")) {
      var s = Golf.copy(state)
      s.aim = Golf.aimAt(state.ball.x, state.ball.y, x / u, y / u)
      state = s
    }
    if (kind === "press") {
      if (state.phase === "sunk") state = Golf.nextHole(state)
      else mouseHold = true
    }
    if (kind === "release") mouseHold = false
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root; shape: Qt.CrossCursor }
    anchors.centerIn: parent
    readonly property real unit: Math.min(parent.width / Golf.W, parent.height / Golf.H)
    width: unit * Golf.W
    height: unit * Golf.H

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onOverChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    function poly(ctx, pts, u) {
      ctx.beginPath()
      ctx.moveTo(pts[0][0] * u, pts[0][1] * u)
      for (var i = 1; i < pts.length; ++i) ctx.lineTo(pts[i][0] * u, pts[i][1] * u)
      ctx.closePath()
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state, u = unit, h = Golf.HOLES[s.hole]
      ctx.lineCap = "round"; ctx.lineJoin = "round"

      // The green, then hazards on it, then blocks and walls.
      poly(ctx, h.walls[0], u)
      ctx.fillStyle = theme.withAlpha(theme.tone(2), 0.16); ctx.fill()
      var k
      for (k = 0; k < (h.slopes || []).length; ++k) {
        var sl = h.slopes[k], r = sl.r
        ctx.fillStyle = theme.withAlpha(theme.foreground, 0.05)
        ctx.fillRect(r[0] * u, r[1] * u, (r[2] - r[0]) * u, (r[3] - r[1]) * u)
        // Chevrons pointing downhill.
        var ang = Math.atan2(sl.ay, sl.ax)
        ctx.strokeStyle = theme.withAlpha(theme.foreground, 0.18); ctx.lineWidth = Math.max(1, u * 0.04)
        for (var cx = r[0] + 0.6; cx < r[2]; cx += 1.2) for (var cy = r[1] + 0.6; cy < r[3]; cy += 1.2) {
          ctx.save(); ctx.translate(cx * u, cy * u); ctx.rotate(ang)
          ctx.beginPath(); ctx.moveTo(-0.15 * u, -0.2 * u); ctx.lineTo(0.1 * u, 0); ctx.lineTo(-0.15 * u, 0.2 * u); ctx.stroke()
          ctx.restore()
        }
      }
      for (k = 0; k < (h.sand || []).length; ++k) {
        var sa = h.sand[k]
        ctx.fillStyle = theme.withAlpha(theme.tone(3), 0.35)
        ctx.fillRect(sa[0] * u, sa[1] * u, (sa[2] - sa[0]) * u, (sa[3] - sa[1]) * u)
      }
      for (k = 0; k < (h.water || []).length; ++k) {
        var wa = h.water[k]
        ctx.fillStyle = theme.withAlpha(theme.tone(1), 0.4)
        ctx.fillRect(wa[0] * u, wa[1] * u, (wa[2] - wa[0]) * u, (wa[3] - wa[1]) * u)
        ctx.strokeStyle = theme.withAlpha(theme.foreground, 0.2); ctx.lineWidth = 1
        for (var wy = wa[1] + 0.35; wy < wa[3]; wy += 0.5) {
          ctx.beginPath()
          for (var wx = wa[0]; wx <= wa[2]; wx += 0.1) ctx.lineTo(wx * u, (wy + Math.sin(wx * 5 + s.t * 2) * 0.05) * u)
          ctx.stroke()
        }
      }
      for (k = 1; k < h.walls.length; ++k) { poly(ctx, h.walls[k], u); ctx.fillStyle = theme.dim; ctx.fill() }
      ctx.strokeStyle = theme.foreground; ctx.lineWidth = Math.max(2, u * 0.08)
      for (k = 0; k < h.walls.length; ++k) { poly(ctx, h.walls[k], u); ctx.stroke() }
      for (k = 0; k < (h.posts || []).length; ++k) {
        var po = h.posts[k]
        ctx.fillStyle = theme.dim
        ctx.beginPath(); ctx.arc(po[0] * u, po[1] * u, po[2] * u, 0, Math.PI * 2); ctx.fill()
      }

      // Tee mark, cup and flag.
      ctx.fillStyle = theme.faint
      ctx.fillRect((h.tee[0] - 0.2) * u, (h.tee[1] - 0.03) * u, 0.4 * u, 0.06 * u)
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.85)
      ctx.beginPath(); ctx.arc(h.cup[0] * u, h.cup[1] * u, Golf.CUP_R * u, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = theme.background
      ctx.beginPath(); ctx.arc(h.cup[0] * u, h.cup[1] * u, Golf.CUP_R * 0.8 * u, 0, Math.PI * 2); ctx.fill()
      if (s.phase !== "sunk") {
        ctx.strokeStyle = theme.foreground; ctx.lineWidth = Math.max(1, u * 0.03)
        ctx.beginPath(); ctx.moveTo(h.cup[0] * u, h.cup[1] * u); ctx.lineTo(h.cup[0] * u, (h.cup[1] - 0.9) * u); ctx.stroke()
        ctx.fillStyle = theme.danger
        ctx.beginPath(); ctx.moveTo(h.cup[0] * u, (h.cup[1] - 0.9) * u); ctx.lineTo((h.cup[0] + 0.45) * u, (h.cup[1] - 0.75) * u); ctx.lineTo(h.cup[0] * u, (h.cup[1] - 0.6) * u); ctx.fill()
      }

      if (h.windmill) {
        var e = Golf.windmillEnds(h.windmill, s.t)
        ctx.strokeStyle = theme.accent; ctx.lineWidth = Math.max(3, u * 0.18)
        ctx.beginPath(); ctx.moveTo(e.ax * u, e.ay * u); ctx.lineTo(e.bx * u, e.by * u); ctx.stroke()
        ctx.fillStyle = theme.foreground
        ctx.beginPath(); ctx.arc(h.windmill.x * u, h.windmill.y * u, 0.1 * u, 0, Math.PI * 2); ctx.fill()
      }

      // Aim line: a dotted guide, and a solid stretch for the power.
      var b = s.ball
      if (s.phase === "aim" && !root.over) {
        var dx = Math.cos(s.aim), dy = Math.sin(s.aim)
        ctx.fillStyle = theme.withAlpha(theme.foreground, 0.35)
        for (var d = 0.35; d < 2.6; d += 0.2) {
          ctx.beginPath(); ctx.arc((b.x + dx * d) * u, (b.y + dy * d) * u, Math.max(1, u * 0.025), 0, Math.PI * 2); ctx.fill()
        }
        if (s.charge > 0) {
          ctx.strokeStyle = s.charge > 0.8 ? theme.danger : theme.accent
          ctx.lineWidth = Math.max(2, u * 0.07)
          ctx.beginPath(); ctx.moveTo((b.x + dx * 0.2) * u, (b.y + dy * 0.2) * u)
          ctx.lineTo((b.x + dx * (0.2 + s.charge * 2.2)) * u, (b.y + dy * (0.2 + s.charge * 2.2)) * u); ctx.stroke()
        }
      }
      if (s.phase !== "sunk") {
        ctx.fillStyle = theme.foreground
        ctx.beginPath(); ctx.arc(b.x * u, b.y * u, Golf.BALL_R * u, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = theme.withAlpha(theme.background, 0.6); ctx.lineWidth = 1; ctx.stroke()
      }

      // Hole number and par, top left.
      ctx.textAlign = "left"; ctx.textBaseline = "top"
      ctx.fillStyle = theme.dim
      ctx.font = "bold " + Math.floor(u * 0.32) + "px " + theme.fontFamily
      ctx.fillText("HOLE " + (s.hole + 1) + "  PAR " + h.par, 0.15 * u, 0.12 * u)
      ctx.textAlign = "right"
      ctx.fillText(s.points + " PTS", width - 0.15 * u, 0.12 * u)

      if (s.msgT > 0) {
        ctx.textAlign = "center"; ctx.textBaseline = "middle"
        ctx.fillStyle = theme.accent
        ctx.font = "bold " + Math.floor(u * 0.6) + "px " + theme.fontFamily
        ctx.fillText(s.msg, width / 2, height / 2)
      }
      if (root.paused) {
        ctx.fillStyle = theme.background; ctx.globalAlpha = 0.8; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
