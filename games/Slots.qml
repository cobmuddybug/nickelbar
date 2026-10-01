import QtQuick
import "../engine" as Engine
import "logic/slots.js" as Slots

// Three-reel slots. Score is the highest chip balance reached (endless —
// banked whenever it's saved); running out of chips ends the session.
Engine.GameBase {
  id: root
  gameId: "slots"
  title: "SLOTS"
  helpText: "SPACE/ENTER spin · UP/DOWN or LEFT/RIGHT change bet (1-5) · pays on the centre line: 7 7 7 ×100 · BAR ×30 · ★ ×15 · ◆ ×10 · ● ×5 · ▲ ×4 · any 7/BAR mix ×10 · two ▲ ×3 · ▲ first ×1"
  mouseHelp: "Click spins"

  property var state: null
  tickInterval: 16
  ticking: !!state && Slots.busy(state) && !over
  endless: true
  score: state ? state.peak : 0
  overTitle: "OUT OF CHIPS"
  status: !state ? ""
    : (over ? "BROKE  ·  N for a fresh 100 chips"
      : (paused ? "PAUSED"
        : (Slots.busy(state) ? "SPINNING…" : (state.lastLine ? state.lastLine.toUpperCase() + "  ·  " : "") + state.balance + " chips  ·  bet " + state.bet)))

  onTick: {
    state = Slots.step(state, tickInterval / 1000)
    if (Slots.broke(state)) over = true
  }

  function newGame() {
    state = Slots.makeState()
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {
    if (over || !state) return
    var d = dx !== 0 ? dx : -dy
    state = Slots.setBet(state, d)
  }

  function activate() {
    if (over) { newGame(); return }
    if (state) state = Slots.spin(state)
  }

  function saveState() {
    if (!state || over) return null
    return Slots.serialize(state)
  }

  function loadState(saved) {
    var restored = Slots.deserialize(saved)
    if (restored) { state = restored; over = false }
    else newGame()
  }

  // Mouse (engine/Pointer.qml): click spins.
  function pointer(kind, x, y, b) {
    if (kind === "press" && b === Qt.LeftButton) { activate() }
  }

  Engine.Theme { id: theme }

  readonly property var symbolColors: [theme.danger, theme.foreground, theme.tone(2), theme.tone(0), theme.tone(1), theme.tone(4)]

  function drawSymbol(ctx, sym, cx, cy, r) {
    ctx.fillStyle = symbolColors[sym]
    ctx.strokeStyle = symbolColors[sym]
    ctx.lineWidth = Math.max(2, r * 0.18)
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    if (sym === 0) {
      ctx.font = "bold " + Math.floor(r * 1.9) + "px " + theme.fontFamily
      ctx.fillText("7", cx, cy + r * 0.05)
    } else if (sym === 1) {
      ctx.fillRect(cx - r, cy - r * 0.42, r * 2, r * 0.84)
      ctx.fillStyle = theme.background
      ctx.font = "bold " + Math.floor(r * 0.62) + "px " + theme.fontFamily
      ctx.fillText("BAR", cx, cy + 1)
    } else if (sym === 2) {
      ctx.beginPath()
      for (var i = 0; i < 10; ++i) {
        var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 === 0 ? r : r * 0.45
        if (i === 0) ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
        else ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
      }
      ctx.closePath(); ctx.fill()
    } else if (sym === 3) {
      ctx.beginPath()
      ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r * 0.75, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r * 0.75, cy)
      ctx.closePath(); ctx.fill()
    } else if (sym === 4) {
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2); ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.moveTo(cx, cy - r * 0.85); ctx.lineTo(cx + r * 0.9, cy + r * 0.7); ctx.lineTo(cx - r * 0.9, cy + r * 0.7)
      ctx.closePath(); ctx.fill()
    }
  }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    width: Math.min(parent.width, parent.height * 1.25)
    height: Math.min(parent.height, width * 0.8)

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
      var s = root.state
      var reelW = width * 0.24, gap = width * 0.04
      var left = (width - reelW * 3 - gap * 2) / 2
      var top = height * 0.12, cellH = height * 0.2, reelH = cellH * 3
      var n = Slots.STRIP.length

      for (var r = 0; r < 3; ++r) {
        var x = left + r * (reelW + gap)
        ctx.fillStyle = theme.withAlpha(theme.foreground, 0.06)
        ctx.fillRect(x, top, reelW, reelH)
        ctx.save()
        ctx.beginPath(); ctx.rect(x, top, reelW, reelH); ctx.clip()
        var pos = s.reels[r]
        var base = Math.floor(pos), frac = pos - base
        for (var k = -2; k <= 2; ++k) {
          var sym = Slots.STRIP[(((base + k) % n) + n) % n]
          var cy = top + cellH * 1.5 + (k - frac) * cellH
          ctx.globalAlpha = s.spinning[r] ? 0.55 : (k === 0 && frac === 0 ? 1.0 : 0.4)
          root.drawSymbol(ctx, sym, x + reelW / 2, cy, cellH * 0.32)
        }
        ctx.globalAlpha = 1.0
        ctx.restore()
        ctx.strokeStyle = theme.border
        ctx.lineWidth = 1
        ctx.strokeRect(x + 0.5, top + 0.5, reelW - 1, reelH - 1)
      }

      // Pay line
      var won = !Slots.busy(s) && s.lastWin > 0
      ctx.strokeStyle = won ? theme.accent : theme.withAlpha(theme.danger, 0.7)
      ctx.lineWidth = won ? 3 : 2
      ctx.beginPath()
      ctx.moveTo(left - gap * 0.6, top + cellH * 1.5); ctx.lineTo(left + reelW * 3 + gap * 2.6, top + cellH * 1.5)
      ctx.stroke()

      // Balance and bet
      ctx.fillStyle = theme.foreground
      ctx.font = "bold " + Math.floor(height * 0.07) + "px " + theme.fontFamily
      ctx.textAlign = "left"; ctx.textBaseline = "middle"
      ctx.fillText(s.balance + " chips", left, top + reelH + height * 0.12)
      ctx.textAlign = "right"
      ctx.fillStyle = theme.accent
      ctx.fillText("BET " + s.bet, left + reelW * 3 + gap * 2, top + reelH + height * 0.12)
      for (var b = 0; b < Slots.MAX_BET; ++b) {
        ctx.fillStyle = b < s.bet ? theme.accent : theme.faint
        ctx.beginPath()
        ctx.arc(left + reelW * 3 + gap * 2 - height * 0.016 - (Slots.MAX_BET - 1 - b) * height * 0.045, top + reelH + height * 0.2, height * 0.014, 0, Math.PI * 2)
        ctx.fill()
      }
      if (won) {
        ctx.fillStyle = theme.accent
        ctx.textAlign = "center"
        ctx.font = "bold " + Math.floor(height * 0.08) + "px " + theme.fontFamily
        ctx.fillText("+" + s.lastWin, width / 2, top * 0.5)
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
