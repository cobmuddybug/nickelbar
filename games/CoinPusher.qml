import QtQuick
import "../engine" as Engine
import "logic/pusher.js" as Pusher

// Coin pusher (see logic/pusher.js), seen from above.
Engine.GameBase {
  id: root
  gameId: "coinpusher"
  title: "COIN PUSHER"
  helpText: "Drop coins in front of the sliding shelf to shove the pile over the front edge · coins over the edge are yours (and go back in your tray); over the sides, gone · bonus tokens are worth 10 · LEFT/RIGHT move the slot (hold to glide) · SPACE drop"
  mouseHelp: "The slot follows the pointer; click drops a coin"

  property var state: null
  tickInterval: 16
  continuousMove: true
  ticking: !!state && !state.done && !over
  score: state ? state.score : 0
  overTitle: state ? "WON " + state.score : ""
  status: !state ? ""
    : over ? "TRAY EMPTY  ·  SPACE to play again"
    : paused ? "PAUSED"
    : state.hand + " coins in the tray  ·  won " + state.score + (state.hand === 0 ? "  ·  settling…" : "")

  onTick: {
    var dt = tickInterval / 1000, s = state
    if (heldDx) s = Pusher.slide(s, s.dropX + heldDx * 0.6 * dt)
    state = Pusher.step(s, dt)
    if (state.done) over = true
  }

  function newGame() { state = Pusher.makeState(); over = false; paused = false }
  function moveCursor(dx, dy) {
    if (!state || over) return
    if (dy) state = Pusher.drop(state)
    else if (dx) state = Pusher.slide(state, state.dropX + dx * 0.02)
  }
  function activate() {
    if (over) { newGame(); return }
    if (state) state = Pusher.drop(state)
  }

  // Mouse (engine/Pointer.qml): the slot follows the pointer; click drops a coin.
  function pointer(kind, x, y, b) {
    if (!state || over) return
    state = Pusher.slide(state, (x - board.tableLeft) / board.side)
    if (kind === "press" && b === Qt.LeftButton) state = Pusher.drop(state)
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    height: parent.height
    width: Math.min(parent.width, height * 0.9)

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onOverChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()
    readonly property real side: Math.min(width, height * 0.84)
    readonly property real tableLeft: (width - side) / 2

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      // The table is square, like the physics: side th, left edge at L.
      var s = root.state, top = height * 0.08, th = board.side, L = board.tableLeft, w = th
      function Y(y) { return top + y * th }
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.05)
      ctx.fillRect(L, top, w, th)
      // Gutters on the sides, the win edge at the front.
      ctx.fillStyle = theme.withAlpha(theme.danger, 0.25)
      ctx.fillRect(L, top, 3, th); ctx.fillRect(L + w - 3, top, 3, th)
      ctx.fillStyle = theme.withAlpha(theme.accent, 0.5)
      ctx.fillRect(L, Y(1) - 2, w, 4)
      // The shelf.
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.25)
      ctx.fillRect(L, top, w, s.shelf * th)
      ctx.fillStyle = theme.foreground
      ctx.fillRect(L, Y(s.shelf) - 2, w, 3)
      var r = Pusher.R * w
      for (var i = 0; i < s.coins.length; ++i) {
        var c = s.coins[i], cx = L + c.x * w, cy = Y(c.y)
        ctx.fillStyle = c.bonus ? theme.tone(1) : theme.tone(3)
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = theme.withAlpha(theme.background, 0.5); ctx.lineWidth = 1
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2); ctx.stroke()
        if (c.bonus) {
          ctx.fillStyle = theme.background
          ctx.font = "bold " + Math.floor(r * 0.9) + "px " + theme.fontFamily
          ctx.textAlign = "center"; ctx.textBaseline = "middle"
          ctx.fillText("10", cx, cy + 1)
        }
      }
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      for (var f = 0; f < s.falls.length; ++f) {
        var fl = s.falls[f]
        ctx.fillStyle = theme.withAlpha(fl.won ? theme.highlight : theme.danger, fl.life)
        ctx.font = "bold " + Math.floor(w * 0.04) + "px " + theme.fontFamily
        ctx.fillText(fl.won ? (fl.bonus ? "+10" : "+1") : "✗", L + fl.x * w, Y(Math.min(1, fl.y)) + (fl.won ? (0.8 - fl.life) * 40 : 0))
      }
      // The drop slot and the coin waiting in it.
      if (!root.over && s.hand > 0) {
        var dx = L + s.dropX * w
        ctx.fillStyle = theme.tone(3)
        ctx.globalAlpha = s.cooldown > 0 ? 0.4 : 1
        ctx.beginPath(); ctx.arc(dx, top * 0.5, r, 0, Math.PI * 2); ctx.fill()
        ctx.globalAlpha = 1
      }
      if (root.paused) { ctx.fillStyle = theme.background; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1 }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
