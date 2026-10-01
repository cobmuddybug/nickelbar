import QtQuick
import "../engine" as Engine
import "logic/catapult.js" as Cat

// Catapult (after Angry Birds); see logic/catapult.js.
Engine.GameBase {
  id: root
  gameId: "catapult"
  title: "CATAPULT"
  helpText: "UP/DOWN aim · hold SPACE for power (it swings), release to fling · knock out every target · glass breaks easily, stone hardly · loose pieces fall and crush · stones left over pay 10,000"
  mouseHelp: "Point to aim; hold the button for power, release to fling"

  property var state: null
  tickInterval: 16
  continuousMove: true
  ticking: !!state && !over
  score: state ? state.score : 0
  overTitle: state ? "FORT " + (state.level + 1) + " · " + state.score : ""
  status: !state ? "" : over ? "OUT OF STONES  ·  SPACE to play again" : paused ? "PAUSED"
    : "FORT " + (state.level + 1) + "  ·  " + state.birds + " stones  ·  " + Cat.countTargets(state.grid) + " targets"

  property bool mouseHold: false
  onTick: {
    state = Cat.step(state, { dy: heldDy, hold: heldAction || mouseHold }, tickInterval / 1000)
    if (state.dead) over = true
  }
  function newGame() { state = Cat.makeState(); over = false; paused = false; mouseHold = false }
  function moveCursor(dx, dy) {}
  function activate() { if (over) newGame() }
  function pointer(kind, x, y, b) {
    if (!state || over) return
    if (state.phase === "aim" && kind !== "release") {
      var s = Cat.shallow(state), u = board.unit
      s.angle = Math.max(-0.4, Math.min(1.45, Math.atan2(Cat.SLING.y - y / u, x / u - Cat.SLING.x)))
      state = s
    }
    if (kind === "press") mouseHold = true
    if (kind === "release") mouseHold = false
  }

  // The whole state is plain data, so it saves as is.
  function saveState() { return state && !over ? JSON.parse(JSON.stringify(state)) : null }
  function loadState(saved) {
    if (saved && typeof saved === "object" && saved.grid !== undefined) { state = saved; over = false; paused = false }
    else newGame()
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root; shape: Qt.CrossCursor }
    anchors.centerIn: parent
    readonly property real unit: Math.min(parent.width / Cat.W, parent.height / Cat.H)
    width: unit * Cat.W
    height: unit * Cat.H
    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state, u = unit, cs = Cat.CELL * u
      ctx.fillStyle = theme.withAlpha(theme.tone(2), 0.3)
      ctx.fillRect(0, Cat.GROUND * u, width, height - Cat.GROUND * u)
      var cols = { g: theme.withAlpha(theme.tone(1), 0.45), w: theme.tone(3), s: theme.dim }
      for (var i = 0; i < s.grid.length; ++i) {
        var cell = s.grid[i]
        if (!cell) continue
        var x = (i % Cat.GW) * cs, y = Math.floor(i / Cat.GW) * cs
        if (cell.m === "T") {
          ctx.fillStyle = theme.danger
          ctx.beginPath(); ctx.arc(x + cs / 2, y + cs / 2, cs * 0.45, 0, Math.PI * 2); ctx.fill()
          continue
        }
        ctx.fillStyle = cols[cell.m]
        ctx.fillRect(x + 0.5, y + 0.5, cs - 1, cs - 1)
        if (cell.hp < Cat.MATS[cell.m].hp) {
          ctx.strokeStyle = theme.background; ctx.lineWidth = 1
          ctx.beginPath(); ctx.moveTo(x + cs * 0.2, y + cs * 0.2); ctx.lineTo(x + cs * 0.8, y + cs * 0.8); ctx.stroke()
        }
      }
      // Sling, last shot's trail, aim preview.
      ctx.strokeStyle = theme.foreground; ctx.lineWidth = Math.max(2, u * 0.15)
      ctx.beginPath(); ctx.moveTo(Cat.SLING.x * u, Cat.GROUND * u); ctx.lineTo(Cat.SLING.x * u, (Cat.SLING.y + 0.4) * u)
      ctx.lineTo((Cat.SLING.x - 0.4) * u, (Cat.SLING.y - 0.3) * u); ctx.moveTo(Cat.SLING.x * u, (Cat.SLING.y + 0.4) * u)
      ctx.lineTo((Cat.SLING.x + 0.4) * u, (Cat.SLING.y - 0.3) * u); ctx.stroke()
      ctx.fillStyle = theme.faint
      for (var t = 0; t < s.lastTrail.length; ++t) { ctx.beginPath(); ctx.arc(s.lastTrail[t][0] * u, s.lastTrail[t][1] * u, 2, 0, Math.PI * 2); ctx.fill() }
      if (s.phase === "aim") {
        var pv = Cat.preview(s, 16)
        ctx.fillStyle = s.charging ? theme.accent : theme.dim
        for (var k = 0; k < pv.length; ++k) { ctx.beginPath(); ctx.arc(pv[k][0] * u, pv[k][1] * u, 2.5, 0, Math.PI * 2); ctx.fill() }
      }
      var b = s.ball || (s.phase === "aim" && s.birds > 0 ? { x: Cat.SLING.x, y: Cat.SLING.y } : null)
      if (b) { ctx.fillStyle = theme.accent; ctx.beginPath(); ctx.arc(b.x * u, b.y * u, Cat.BALL_R * u, 0, Math.PI * 2); ctx.fill() }
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.font = "bold " + Math.floor(u * 0.6) + "px " + theme.fontFamily
      for (var p = 0; p < s.pops.length; ++p) { ctx.fillStyle = theme.foreground; ctx.fillText(s.pops[p].text, s.pops[p].x * u, s.pops[p].y * u) }
      if (s.msgT > 0) { ctx.fillStyle = theme.accent; ctx.fillText(s.msg, width / 2, height * 0.2) }
      if (root.paused) { ctx.fillStyle = theme.background; ctx.globalAlpha = 0.8; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1 }
    }
  }
  Component.onCompleted: if (!state) newGame()
}
