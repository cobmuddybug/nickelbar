import QtQuick
import "../engine" as Engine
import "logic/plinko.js" as Plinko

// Plinko (see logic/plinko.js): ten chips down the peg board.
Engine.GameBase {
  id: root
  gameId: "plinko"
  title: "CHIP DROP"
  helpText: "Slide the chip along the top, drop it, and let the pegs decide · LEFT/RIGHT slide (hold to glide) · SPACE drop · ten chips; score is the total"
  mouseHelp: "The chip follows the pointer; click drops it"

  property var state: null
  tickInterval: 16
  onStateChanged: playEvents(state)
  continuousMove: true
  ticking: !!state && !over
  score: state ? state.score : 0
  overTitle: state ? state.score + " POINTS" : ""
  status: !state ? ""
    : over ? "ALL CHIPS DROPPED  ·  SPACE to play again"
    : paused ? "PAUSED"
    : state.chips + " chips left" + (state.last >= 0 && state.flash > 0 ? "  ·  +" + Plinko.SLOTS[state.last] : "")

  onTick: {
    var s = state
    if (heldDx && !s.ball) s = Plinko.slide(s, s.dropX + heldDx * 5 * tickInterval / 1000)
    state = Plinko.step(s, tickInterval / 1000)
    if (state.done) over = true
  }

  function newGame() { state = Plinko.makeState(); over = false; paused = false }
  function moveCursor(dx, dy) {
    if (!state || over) return
    if (dy > 0) state = Plinko.drop(state)
    else if (dx) state = Plinko.slide(state, state.dropX + dx * 0.25)
  }
  function activate() {
    if (over) { newGame(); return }
    if (state) state = Plinko.drop(state)
  }

  // Mouse (engine/Pointer.qml): the chip follows the pointer; click drops it.
  function pointer(kind, x, y, b) {
    if (!state || over) return
    if (kind === "move" || kind === "drag" || kind === "press") state = Plinko.slide(state, x / board.unit)
    if (kind === "press" && b === Qt.LeftButton) state = Plinko.drop(state)
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property real unit: Math.min(parent.width / Plinko.W, parent.height / Plinko.H)
    width: unit * Plinko.W
    height: unit * Plinko.H

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
      var s = root.state, u = unit, n = Plinko.SLOTS.length, sw = Plinko.W / n
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.04)
      ctx.fillRect(0, 0, width, height)
      // Slots: the jackpot bright, the zeros dim; the last one flashes.
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      for (var i = 0; i < n; ++i) {
        var v = Plinko.SLOTS[i], x = i * sw * u
        var lit = i === s.last && s.flash > 0 && Math.floor(s.flash * 8) % 2 === 0
        ctx.fillStyle = lit ? theme.withAlpha(theme.highlight, 0.5)
          : theme.withAlpha(v >= 10000 ? theme.tone(3) : v === 0 ? theme.danger : theme.accent, v >= 1000 ? 0.3 : 0.14)
        ctx.fillRect(x + 1, Plinko.SLOT_TOP * u, sw * u - 2, (Plinko.H - Plinko.SLOT_TOP) * u)
        ctx.fillStyle = v === 0 ? theme.danger : theme.foreground
        ctx.font = "bold " + Math.floor(Math.min(sw * u * (v >= 10000 ? 0.3 : 0.36), u * 0.4)) + "px " + theme.fontFamily
        ctx.fillText(v >= 10000 ? "10K" : String(v), x + sw * u / 2, (Plinko.SLOT_TOP + (Plinko.H - Plinko.SLOT_TOP) / 2) * u)
        if (i) { ctx.fillStyle = theme.dim; ctx.fillRect(x - 1, Plinko.SLOT_TOP * u, 2, (Plinko.H - Plinko.SLOT_TOP) * u) }
      }
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.7)
      for (var p = 0; p < Plinko.PEGS.length; ++p) {
        ctx.beginPath(); ctx.arc(Plinko.PEGS[p].x * u, Plinko.PEGS[p].y * u, Math.max(2, Plinko.PEG_R * u), 0, Math.PI * 2); ctx.fill()
      }
      function chip(cx, cy, a) {
        ctx.globalAlpha = a
        ctx.fillStyle = theme.tone(1)
        ctx.beginPath(); ctx.arc(cx * u, cy * u, Plinko.BALL_R * u, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = theme.withAlpha(theme.background, 0.6); ctx.lineWidth = Math.max(1, u * 0.04)
        ctx.beginPath(); ctx.arc(cx * u, cy * u, Plinko.BALL_R * u * 0.6, 0, Math.PI * 2); ctx.stroke()
        ctx.globalAlpha = 1
      }
      if (s.ball) chip(s.ball.x, s.ball.y, 1)
      else if (!root.over && s.chips) {
        ctx.strokeStyle = theme.faint; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(s.dropX * u, 0.7 * u); ctx.lineTo(s.dropX * u, 1.1 * u); ctx.stroke()
        chip(s.dropX, 0.4, 1)
      }
      // Chips still to come, down the side.
      for (var k = 0; k < s.chips - (s.ball ? 0 : 1); ++k) chip(Plinko.W - 0.35, 0.35 + k * 0.3, 0.35)
      if (root.paused) { ctx.fillStyle = theme.background; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1 }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
