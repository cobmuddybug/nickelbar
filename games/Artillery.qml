import QtQuick
import "../engine" as Engine
import "logic/artillery.js" as Art

// Artillery (after Worms); see logic/artillery.js. Score is damage dealt,
// 50 a kill, 200 for the win.
Engine.GameBase {
  id: root
  gameId: "artillery"
  difficulties: ["Easy", "Normal", "Hard"]
  onDifficultyChanged: Art.setDifficulty(difficulty)
  title: "ARTILLERY"
  helpText: "Your three against the computer's, turn about · LEFT/RIGHT walk a short way (and turn) · UP/DOWN aim · hold SPACE for power (it swings up and back), release to fire · W swaps bazooka (rides the wind, bursts on contact) and grenade (no wind, bounces, three-second fuse) · water and the island's edge are fatal"
  mouseHelp: "Point to aim; hold the button for power, release to fire; right-click swaps weapon"

  property var state: null
  tickInterval: 16
  continuousMove: true
  ticking: !!state && !over
  score: state ? Art.points(state) : 0
  overTitle: !state ? "" : state.winner === 0 ? "YOU WIN" : "YOU LOSE"
  readonly property bool myTurn: !!state && state.turnTeam === 0 && state.phase === "aim"
  status: !state ? ""
    : over ? "dealt " + state.dealt + " · " + state.kills + " kills  ·  SPACE to play again"
    : paused ? "PAUSED"
    : (state.turnTeam === 0 ? "YOUR TURN" : "COMPUTER'S TURN") + "  ·  " + Art.WEAPONS[state.weapon].name
      + "  ·  wind " + (state.wind > 0 ? "→ " : state.wind < 0 ? "← " : "") + Math.abs(Math.round(state.wind * 10))
      + (myTurn ? "  ·  walk " + Math.max(0, Math.round((Art.MOVE_BUDGET - state.moved) * 10) / 10) : "")

  property bool mouseHold: false

  onTick: {
    var dt = tickInterval / 1000
    state = Art.cpuStep(Art.step(state, { dx: heldDx, dy: heldDy, hold: heldAction || mouseHold }, dt), dt)
    if (state.phase === "done") over = true
  }

  function newGame() { state = Art.makeState(); over = false; paused = false; mouseHold = false }
  function moveCursor(dx, dy) {}
  function activate() { if (over) newGame() }

  function swapWeapon() {
    if (!myTurn) return
    var s = Art.copy(state)
    s.weapon = (s.weapon + 1) % Art.WEAPONS.length
    state = s
  }

  function handleKey(key, text) {
    if (text === "w" || text === "W") { swapWeapon(); return true }
    return false
  }

  function pointer(kind, x, y, b) {
    if (!state || over) return
    if (kind === "press" && b === Qt.RightButton) { swapWeapon(); return }
    if (myTurn && (kind === "move" || kind === "drag" || kind === "press")) {
      var u = board.unit, w = state.worms[state.cur], s = Art.copy(state)
      var dx = x / u - w.x, dy = y / u - w.y
      s.worms[s.cur].face = dx >= 0 ? 1 : -1
      s.angle = Math.max(-1.3, Math.min(1.5, Math.atan2(-dy, Math.abs(dx))))
      state = s
    }
    if (kind === "press") mouseHold = true
    if (kind === "release") mouseHold = false
  }

  // The whole state is plain data, so it saves as is.
  function saveState() { return state && !over ? JSON.parse(JSON.stringify(state)) : null }
  function loadState(saved) {
    if (saved && typeof saved === "object" && saved.worms !== undefined) { state = saved; over = false; paused = false }
    else newGame()
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root; shape: Qt.CrossCursor }
    anchors.centerIn: parent
    readonly property real unit: Math.min(parent.width / Art.W, parent.height / Art.H)
    width: unit * Art.W
    height: unit * Art.H

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onOverChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    function teamColor(t) { return t === 0 ? theme.accent : theme.danger }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state, u = unit, g = s.ground

      // Ground.
      ctx.beginPath()
      ctx.moveTo(0, height)
      for (var i = 0; i < Art.COLS; ++i) ctx.lineTo(i * Art.STEP * u, g[i] * u)
      ctx.lineTo(width, height)
      ctx.closePath()
      ctx.fillStyle = theme.withAlpha(theme.tone(2), 0.35); ctx.fill()
      ctx.beginPath()
      for (var j = 0; j < Art.COLS; ++j) ctx.lineTo(j * Art.STEP * u, g[j] * u)
      ctx.strokeStyle = theme.tone(2); ctx.lineWidth = Math.max(2, u * 0.2); ctx.stroke()

      // Water.
      ctx.fillStyle = theme.withAlpha(theme.tone(1), 0.45)
      ctx.beginPath()
      ctx.moveTo(0, height)
      for (var wx = 0; wx <= Art.W; wx += 0.5) ctx.lineTo(wx * u, (Art.WATER + Math.sin(wx * 0.9 + s.t * 2) * 0.15) * u)
      ctx.lineTo(width, height); ctx.closePath(); ctx.fill()

      // Blasts.
      for (var b = 0; b < s.blasts.length; ++b) {
        var bl = s.blasts[b]
        ctx.fillStyle = theme.withAlpha(theme.tone(3), bl.t * 1.6)
        ctx.beginPath(); ctx.arc(bl.x * u, bl.y * u, bl.r * u * (1.3 - bl.t * 0.6), 0, Math.PI * 2); ctx.fill()
      }

      // Worms: a rounded body, an eye facing their way, hp above.
      ctx.textAlign = "center"; ctx.textBaseline = "bottom"
      ctx.font = "bold " + Math.floor(u * 0.9) + "px " + theme.fontFamily
      for (var k = 0; k < s.worms.length; ++k) {
        var w = s.worms[k]
        if (!w.alive) continue
        var cur = k === s.cur && s.phase === "aim"
        ctx.fillStyle = teamColor(w.team)
        ctx.beginPath(); ctx.ellipse((w.x - Art.WORM_R * 0.8) * u, (w.y - Art.WORM_R) * u, Art.WORM_R * 1.6 * u, Art.WORM_R * 2 * u); ctx.fill()
        ctx.fillStyle = theme.background
        ctx.beginPath(); ctx.arc((w.x + w.face * Art.WORM_R * 0.35) * u, (w.y - Art.WORM_R * 0.35) * u, Math.max(1.5, u * 0.14), 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = cur ? theme.foreground : theme.withAlpha(teamColor(w.team), 0.9)
        ctx.fillText(String(w.hp), w.x * u, (w.y - Art.WORM_R - 0.35) * u)
        if (cur) {
          ctx.beginPath()
          ctx.moveTo((w.x - 0.35) * u, (w.y - 2.9) * u); ctx.lineTo((w.x + 0.35) * u, (w.y - 2.9) * u); ctx.lineTo(w.x * u, (w.y - 2.4) * u)
          ctx.closePath(); ctx.fill()
        }
      }

      // Aim: crosshair and the power swell.
      if (s.phase === "aim" && s.cur >= 0) {
        var aw = s.worms[s.cur], d = Art.aimVector(aw, s.angle)
        var cx = aw.x + d.x * 3.2, cy = aw.y + d.y * 3.2
        ctx.strokeStyle = teamColor(aw.team); ctx.lineWidth = Math.max(1.5, u * 0.12)
        ctx.beginPath(); ctx.arc(cx * u, cy * u, 0.45 * u, 0, Math.PI * 2); ctx.stroke()
        ctx.beginPath(); ctx.moveTo((cx - 0.7) * u, cy * u); ctx.lineTo((cx + 0.7) * u, cy * u); ctx.moveTo(cx * u, (cy - 0.7) * u); ctx.lineTo(cx * u, (cy + 0.7) * u); ctx.stroke()
        if (s.power > 0) {
          ctx.strokeStyle = s.power > 0.85 ? theme.danger : theme.tone(3)
          ctx.lineWidth = Math.max(3, u * 0.35)
          ctx.beginPath(); ctx.moveTo((aw.x + d.x * 0.9) * u, (aw.y + d.y * 0.9) * u)
          ctx.lineTo((aw.x + d.x * (0.9 + s.power * 2.6)) * u, (aw.y + d.y * (0.9 + s.power * 2.6)) * u); ctx.stroke()
        }
      }

      if (s.shot) {
        ctx.fillStyle = theme.foreground
        ctx.beginPath(); ctx.arc(s.shot.x * u, s.shot.y * u, Math.max(2.5, u * 0.3), 0, Math.PI * 2); ctx.fill()
        if (s.shot.fuse > 0) {
          ctx.font = "bold " + Math.floor(u * 0.9) + "px " + theme.fontFamily
          ctx.fillText(String(Math.ceil(s.shot.fuse)), s.shot.x * u, (s.shot.y - 0.6) * u)
        }
      }

      ctx.font = "bold " + Math.floor(u * 1.0) + "px " + theme.fontFamily
      for (var p = 0; p < (s.pops || []).length; ++p) {
        var po = s.pops[p]
        ctx.fillStyle = theme.withAlpha(teamColor(po.team), Math.min(1, po.t * 2))
        ctx.fillText(po.text, po.x * u, po.y * u)
      }

      // Wind sock, top middle.
      var wy = 1.6 * u, len = s.wind * 6 * u
      ctx.strokeStyle = theme.dim; ctx.lineWidth = Math.max(2, u * 0.25)
      ctx.beginPath(); ctx.moveTo(width / 2 - 6 * u, wy); ctx.lineTo(width / 2 + 6 * u, wy); ctx.stroke()
      ctx.strokeStyle = theme.tone(4)
      ctx.beginPath(); ctx.moveTo(width / 2, wy); ctx.lineTo(width / 2 + len, wy); ctx.stroke()
      ctx.fillStyle = theme.dim
      ctx.textBaseline = "top"
      ctx.font = Math.floor(u * 0.8) + "px " + theme.fontFamily
      ctx.fillText("WIND", width / 2, wy + 0.5 * u)
      ctx.textAlign = "left"
      ctx.fillStyle = theme.accent
      ctx.fillText("YOU " + Art.alive(s, 0) + " left", u, u)
      ctx.textAlign = "right"
      ctx.fillStyle = theme.danger
      ctx.fillText("CPU " + Art.alive(s, 1) + " left", width - u, u)

      if (s.msgT > 0) {
        ctx.textAlign = "center"; ctx.textBaseline = "middle"
        ctx.fillStyle = theme.foreground
        ctx.font = "bold " + Math.floor(u * 1.3) + "px " + theme.fontFamily
        ctx.fillText(s.msg, width / 2, height * 0.22)
      }
      if (root.paused) {
        ctx.fillStyle = theme.background; ctx.globalAlpha = 0.8; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
