import QtQuick
import "../engine" as Engine
import "logic/whack.js" as Whack

// Whack-a-Mole (see logic/whack.js). The number keys follow the numpad's
// layout, so 7 is the top-left hole and 3 the bottom-right.
Engine.GameBase {
  id: root
  gameId: "whackamole"
  title: "MOLE MASH"
  helpText: "Hit the moles while they're up · 1-9 hit that hole (laid out like a numpad: 7 8 9 on top) · or ARROWS + SPACE · gold moles are worth 50 · hits in a row build a combo up to ×4; swinging at an empty hole breaks it · 60 seconds"
  mouseHelp: "Click a mole to whack it"

  property var state: null
  tickInterval: 16
  ticking: !!state && !state.done && !over
  score: state ? state.score : 0
  overTitle: state ? state.hits + " MOLES · " + state.score : ""
  status: !state ? ""
    : over ? "TIME!  ·  best combo " + state.best + "  ·  SPACE to play again"
    : paused ? "PAUSED"
    : Math.ceil(state.clock) + "s  ·  " + state.hits + " whacked" + (state.combo >= 4 ? "  ·  COMBO ×" + Whack.multiplier(state) : "")

  onTick: { state = Whack.step(state, tickInterval / 1000); if (state.done) over = true }

  function newGame() { state = Whack.makeState(); over = false; paused = false }
  function moveCursor(dx, dy) { if (state && !over) state = Whack.moveCursor(state, dx, dy) }
  function activate() {
    if (over) { newGame(); return }
    if (state) state = Whack.whack(state, state.cursor)
  }
  function handleKey(key, text) {
    if (!state || over || !text) return false
    var i = "789456123".indexOf(text)
    if (i < 0) return false
    state = Whack.whack(state, i)
    return true
  }

  // Mouse (engine/Pointer.qml): click a hole to whack it.
  function pointer(kind, x, y, b) {
    if (!state || over || kind !== "press" || b !== Qt.LeftButton) return
    var c = board.cell, i = Math.floor(y / c) * 3 + Math.floor(x / c)
    if (x >= 0 && y >= 0 && x < c * 3 && y < c * 3) state = Whack.whack(state, i)
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property real cell: Math.floor(Math.min(parent.width, parent.height * 0.92) / 3)
    width: cell * 3
    height: cell * 3 + cell * 0.25

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
      var s = root.state, c = cell
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      for (var i = 0; i < 9; ++i) {
        var cx = (i % 3 + 0.5) * c, cy = (Math.floor(i / 3) + 0.62) * c, hw = c * 0.34, hh = c * 0.1
        var h = s.holes[i]
        // Mole: rises over its first 0.12s, sinks over its last 0.12s.
        if (h) {
          var rise = h.hit > 0 ? 0.55 : Math.min(1, h.age / 0.12, (h.up + 0.001) / 0.12)
          var mh = c * 0.5 * rise, top = cy - mh
          ctx.save()
          ctx.beginPath(); ctx.rect(cx - hw, cy - c * 0.7, hw * 2, c * 0.7); ctx.clip()
          ctx.fillStyle = h.gold ? theme.tone(3) : theme.withAlpha(theme.foreground, 0.55)
          ctx.beginPath()
          ctx.moveTo(cx - hw * 0.62, cy); ctx.lineTo(cx - hw * 0.62, top + hw * 0.62)
          ctx.arc(cx, top + hw * 0.62, hw * 0.62, Math.PI, 0); ctx.lineTo(cx + hw * 0.62, cy); ctx.closePath(); ctx.fill()
          ctx.fillStyle = theme.background
          var ey = top + hw * 0.55
          if (h.hit > 0) {
            ctx.strokeStyle = theme.background; ctx.lineWidth = 2
            for (var e = -1; e <= 1; e += 2) {
              ctx.beginPath(); ctx.moveTo(cx + e * hw * 0.25 - 4, ey - 4); ctx.lineTo(cx + e * hw * 0.25 + 4, ey + 4)
              ctx.moveTo(cx + e * hw * 0.25 + 4, ey - 4); ctx.lineTo(cx + e * hw * 0.25 - 4, ey + 4); ctx.stroke()
            }
          } else {
            ctx.beginPath(); ctx.arc(cx - hw * 0.25, ey, Math.max(2, hw * 0.08), 0, Math.PI * 2); ctx.fill()
            ctx.beginPath(); ctx.arc(cx + hw * 0.25, ey, Math.max(2, hw * 0.08), 0, Math.PI * 2); ctx.fill()
          }
          ctx.fillStyle = theme.danger
          ctx.beginPath(); ctx.arc(cx, ey + hw * 0.2, Math.max(2, hw * 0.09), 0, Math.PI * 2); ctx.fill()
          ctx.restore()
        }
        // The hole's front lip over the mole's base.
        ctx.fillStyle = theme.withAlpha(theme.foreground, 0.12)
        ctx.beginPath(); ctx.ellipse(cx - hw, cy - hh, hw * 2, hh * 2); ctx.fill()
        ctx.strokeStyle = i === s.cursor && !root.over ? theme.accent : theme.faint
        ctx.lineWidth = i === s.cursor ? 3 : 1.5
        ctx.beginPath(); ctx.ellipse(cx - hw, cy - hh, hw * 2, hh * 2); ctx.stroke()
        ctx.fillStyle = theme.dim
        ctx.font = Math.floor(c * 0.1) + "px " + theme.fontFamily
        ctx.fillText("789456123"[i], cx, cy + hh + c * 0.1)
      }
      for (var p = 0; p < s.pops.length; ++p) {
        var pp = s.pops[p]
        ctx.fillStyle = theme.withAlpha(theme.highlight, Math.min(1, pp.life * 2))
        ctx.font = "bold " + Math.floor(c * 0.16) + "px " + theme.fontFamily
        ctx.fillText("+" + pp.v, (pp.i % 3 + 0.5) * c, (Math.floor(pp.i / 3) + 0.1 - (0.6 - pp.life) * 0.4) * c)
      }
      // Clock bar.
      ctx.fillStyle = theme.faint
      ctx.fillRect(c * 0.2, 3 * c + c * 0.08, c * 2.6, c * 0.06)
      ctx.fillStyle = s.clock < 10 ? theme.danger : theme.accent
      ctx.fillRect(c * 0.2, 3 * c + c * 0.08, c * 2.6 * s.clock / Whack.TIME, c * 0.06)
      if (root.paused) { ctx.fillStyle = theme.background; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1 }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
