import QtQuick
import "../engine" as Engine
import "logic/bowling.js" as Bowl

// Bowling (see logic/bowling.js): position, aim, then a power meter.
Engine.GameBase {
  id: root
  gameId: "bowling"
  title: "BOWLING"
  helpText: "LEFT/RIGHT slide along the foul line, then aim · UP/DOWN set spin (the ball hooks late) · SPACE lock each step, then release on the power meter · Ten frames; near the top of the meter is fast, but not always straight"
  mouseHelp: "Move to place, then to aim; wheel for spin; click to lock each step and to release on the meter"

  property var state: null
  tickInterval: 16
  ownSounds: true
  onStateChanged: playEvents(state)
  ticking: !!state && !state.done && (state.phase === "power" || state.phase === "roll")
  score: state ? Bowl.score(state) : 0
  overTitle: state ? "GAME · " + Bowl.score(state) : ""
  progress: state && !state.done ? "frame " + state.frame + "/10 · " + Bowl.score(state) : ""
  status: !state ? ""
    : over ? "FINAL " + score + "  ·  SPACE for a new game"
    : paused ? "PAUSED"
    : "FRAME " + state.frame + "  ·  BALL " + state.ball + "  ·  " + ({ place: "slide and set spin", aim: "aim", power: "release on the meter", roll: "" })[state.phase]

  onTick: {
    state = Bowl.step(state, tickInterval / 1000)
    if (state.done) over = true
  }

  function newGame() { state = Bowl.makeState(); over = false; paused = false }
  function moveCursor(dx, dy) {
    if (!state || over) return
    if (state.phase === "place") state = dx ? Bowl.setX(state, state.x + dx * 0.05) : Bowl.setSpin(state, state.spin - dy * 0.25)
    else if (state.phase === "aim") state = dx ? Bowl.setAngle(state, state.angle + dx * 0.015) : Bowl.setSpin(state, state.spin - dy * 0.25)
  }
  function activate() {
    if (over) { newGame(); return }
    if (state) state = Bowl.advance(state)
  }
  function saveState() { return !state || over ? null : Bowl.serialize(state) }
  function loadState(saved) {
    var s = Bowl.deserialize(saved)
    if (s) { state = s; over = !!s.done } else newGame()
  }

  // The lane on the left, the card on the right (board geometry shared with the mouse).
  readonly property real u: Math.min(board.width * 0.3 / 1.5, board.height / 6.4)
  readonly property real ox: board.width / 2
  readonly property real oy: (board.height - 6.4 * u) / 2 + 6.1 * u
  function sx(wx) { return ox + wx * u }
  function sy(wy) { return oy - wy * u }

  function pointer(kind, x, y, b) {
    if (!state || over) return
    if (kind === "move" || kind === "drag") {
      if (state.phase === "place") state = Bowl.setX(state, (x - ox) / u)
      else if (state.phase === "aim") state = Bowl.setAngle(state, Math.atan2(x - sx(state.x), Math.max(1, sy(0) - y)))
    } else if (kind === "wheel") state = Bowl.setSpin(state, state.spin + b * 0.25)
    else if (kind === "press" && b === Qt.LeftButton) state = Bowl.advance(state)
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.fill: parent

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
      var s = root.state
      if (!s) return
      var u = root.u
      // Gutters and lane.
      ctx.fillStyle = theme.faint
      ctx.fillRect(root.sx(-0.75), root.sy(6.1), 1.5 * u, 6.4 * u)
      ctx.fillStyle = theme.withAlpha(theme.tone(2), 0.22)
      ctx.fillRect(root.sx(-0.5), root.sy(6.1), u, 6.4 * u)
      ctx.strokeStyle = theme.dim; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(root.sx(-0.5), root.sy(6.1)); ctx.lineTo(root.sx(-0.5), root.sy(-0.3))
      ctx.moveTo(root.sx(0.5), root.sy(6.1)); ctx.lineTo(root.sx(0.5), root.sy(-0.3)); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(root.sx(-0.5), root.sy(0)); ctx.lineTo(root.sx(0.5), root.sy(0)); ctx.stroke()
      // Pins.
      for (var i = 0; i < 10; ++i) {
        var p = s.pins[i]
        if (p.gone) continue
        ctx.fillStyle = p.down ? theme.withAlpha(theme.foreground, 0.4) : theme.foreground
        ctx.beginPath(); ctx.arc(root.sx(p.x), root.sy(p.y), Bowl.PIN_R * u * 1.5, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = theme.danger; ctx.lineWidth = Math.max(1, u * 0.02)
        ctx.beginPath(); ctx.arc(root.sx(p.x), root.sy(p.y), Bowl.PIN_R * u * 0.85, 0, Math.PI * 2); ctx.stroke()
      }
      // Ball, and while lining up, the aim line.
      var bx = s.b ? s.b.x : s.x, by = s.b ? s.b.y : 0
      if (s.phase === "aim" || s.phase === "power") {
        ctx.strokeStyle = theme.withAlpha(theme.accent, 0.7); ctx.lineWidth = 1.5; ctx.setLineDash([4, 5])
        ctx.beginPath(); ctx.moveTo(root.sx(s.x), root.sy(0))
        ctx.lineTo(root.sx(s.x) + Math.sin(s.angle) * 6 * u, root.sy(0) - Math.cos(s.angle) * 6 * u); ctx.stroke(); ctx.setLineDash([])
      }
      ctx.fillStyle = theme.accent
      ctx.beginPath(); ctx.arc(root.sx(bx), root.sy(by), Bowl.BALL_R * u * 1.2, 0, Math.PI * 2); ctx.fill()
      if (s.phase !== "roll") {
        // Spin indicator: an arrow either side of the ball.
        ctx.strokeStyle = theme.tone(3); ctx.lineWidth = 3
        ctx.beginPath(); ctx.moveTo(root.sx(bx), root.sy(0) + u * 0.22); ctx.lineTo(root.sx(bx) + s.spin * u * 0.3, root.sy(0) + u * 0.22); ctx.stroke()
      }
      // Power meter.
      if (s.phase === "power") {
        var mx = root.sx(0.62), mw = u * 0.1, mh = u * 3
        ctx.fillStyle = theme.faint; ctx.fillRect(mx, root.sy(0.2) - mh, mw, mh)
        ctx.fillStyle = theme.tone(3); ctx.fillRect(mx, root.sy(0.2) - mh * s.meter, mw, mh * s.meter)
      }
      // Score card on the right.
      var T = Bowl.tally(s.rolls), cx = width * 0.7, cw = width * 0.28, rowH = Math.min(height / 12.5, u * 0.62)
      ctx.textBaseline = "middle"
      for (var f = 0; f < 10; ++f) {
        var y = (height - rowH * 10) / 2 + f * rowH, fr = T.frames[f]
        ctx.strokeStyle = f + 1 === s.frame && !s.done ? theme.accent : theme.faint; ctx.lineWidth = 1.5
        ctx.strokeRect(cx, y + 1, cw, rowH - 2)
        ctx.fillStyle = theme.dim; ctx.textAlign = "left"; ctx.font = Math.floor(rowH * 0.4) + "px " + theme.fontFamily
        ctx.fillText(String(f + 1), cx + 6, y + rowH / 2)
        if (fr) {
          ctx.fillStyle = theme.foreground; ctx.font = "bold " + Math.floor(rowH * 0.5) + "px " + theme.fontFamily
          ctx.fillText(Bowl.marks(fr, f === 9).join(" "), cx + cw * 0.18, y + rowH / 2)
          if (fr.total !== null) { ctx.textAlign = "right"; ctx.fillText(String(fr.total), cx + cw - 8, y + rowH / 2) }
        }
      }
      if (root.paused) { ctx.fillStyle = theme.background; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1 }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
