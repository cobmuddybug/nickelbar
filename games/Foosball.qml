import QtQuick
import "../engine" as Engine
import "logic/foosball.js" as Foosball

// Foosball against the computer. You own the goalie, defence, midfield and
// attack rods on the left; pick one, slide it, and kick. Rods block each
// other's shots as much as the ball, so time your kick. First to five.
Engine.GameBase {
  id: root
  gameId: "foosball"
  difficulties: ["Easy", "Normal", "Hard"]
  onDifficultyChanged: Foosball.setDifficulty(difficulty)
  title: "FOOSBALL"
  helpText: "1-4 or LEFT/RIGHT pick a rod (goalie, defence, midfield, attack) · UP/DOWN slide it · SPACE/ENTER kick (and serve) · first to 5 · rods block shots, so clear a lane before you kick · the computer sharpens as you score"
  mouseHelp: "Move the pointer: the rod nearest it slides to follow; click kicks; the wheel steps between rods"

  property var state: null
  property real dtSlide: 150

  tickInterval: 16
  continuousMove: true
  ticking: !!state && state.alive && !over
  score: state ? state.playerScore : 0
  overTitle: state ? (state.playerScore > state.aiScore ? "YOU WIN " : "COMPUTER WINS ") + state.playerScore + " – " + state.aiScore : ""
  status: !state ? ""
    : (over ? overTitle + "  ·  N for a new game"
      : (paused ? "PAUSED"
        : state.playerScore + " – " + state.aiScore + "  ·  " + Foosball.MINE_NAMES[state.active]
          + (state.inPlay ? "" : "  ·  SPACE to serve")))

  onHeldDxChanged: {
    if (heldDx !== 0 && state && !over && !paused) state = Foosball.cycleRod(state, heldDx)
  }

  onTick: {
    var dt = tickInterval / 1000
    var s = state
    if (heldDy !== 0) {
      var i = Foosball.MINE[s.active]
      s = Foosball.setSlide(s, i, s.rods[i].ty + heldDy * dtSlide * dt * 2)
    }
    s = Foosball.step(s, dt)
    if (s !== state) state = s
    if (!state.alive) over = true
  }

  function newGame() { state = Foosball.makeState(); over = false; paused = false }

  function moveCursor(dx, dy) {}

  function activate() {
    if (over) { newGame(); return }
    if (!state) return
    if (!state.inPlay) { state = Foosball.serve(state); return }
    state = Foosball.kick(state, Foosball.MINE[state.active])
  }

  function handleKey(key, text) {
    if (!state || over) return false
    if (text && /^[1-4]$/.test(text)) { state = Foosball.selectRod(state, parseInt(text) - 1); return true }
    return false
  }

  function saveState() { return state && !over ? Foosball.serialize(state) : null }
  function loadState(saved) {
    var r = Foosball.deserialize(saved)
    if (r) { state = r; over = !r.alive } else newGame()
  }

  function pointer(kind, x, y, b) {
    if (!state || over) return
    var g = board.geo
    var tx = (x - g.ox) / g.sc, ty = (y - g.oy) / g.sc
    if (kind === "wheel") { state = Foosball.cycleRod(state, b > 0 ? -1 : 1); return }
    if (kind === "move" || kind === "drag" || kind === "press") {
      // the rod of yours nearest the pointer, left to right
      var best = 0, bd = 1e9
      for (var j = 0; j < 4; ++j) {
        var d = Math.abs(Foosball.RODS[Foosball.MINE[j]].x - tx)
        if (d < bd) { bd = d; best = j }
      }
      var next = state.active === best ? state : Foosball.selectRod(state, best)
      state = Foosball.setSlide(next, Foosball.MINE[best], ty)
    }
    if (kind === "press" && b === Qt.LeftButton) activate()
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.fill: parent

    readonly property var geo: {
      var sc = Math.min(width * 0.96 / Foosball.W, height * 0.92 / Foosball.H)
      return { sc: sc, ox: (width - Foosball.W * sc) / 2, oy: (height - Foosball.H * sc) / 2 }
    }

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
      var s = root.state, g = board.geo, W = Foosball.W, H = Foosball.H, sc = g.sc
      if (sc <= 0) return
      function X(v) { return g.ox + v * sc }
      function Y(v) { return g.oy + v * sc }
      // pitch
      ctx.fillStyle = theme.faint; ctx.globalAlpha = 0.4
      ctx.fillRect(X(0), Y(0), W * sc, H * sc); ctx.globalAlpha = 1
      ctx.strokeStyle = theme.dim; ctx.lineWidth = 3
      ctx.strokeRect(X(0), Y(0), W * sc, H * sc)
      ctx.strokeStyle = theme.faint; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(X(W / 2), Y(0)); ctx.lineTo(X(W / 2), Y(H)); ctx.stroke()
      ctx.beginPath(); ctx.arc(X(W / 2), Y(H / 2), 12 * sc, 0, Math.PI * 2); ctx.stroke()
      var gy0 = (H - Foosball.GOAL) / 2
      ctx.fillStyle = theme.background
      ctx.fillRect(X(-4), Y(gy0), 6 * sc, Foosball.GOAL * sc)
      ctx.fillRect(X(W - 2), Y(gy0), 6 * sc, Foosball.GOAL * sc)
      // rods and men
      for (var i = 0; i < 8; ++i) {
        var def = Foosball.RODS[i], rod = s.rods[i], mine = def.owner === 0
        var isActive = mine && Foosball.MINE[s.active] === i
        var dir = mine ? 1 : -1
        ctx.strokeStyle = isActive ? theme.highlight : theme.dim
        ctx.globalAlpha = isActive ? 0.9 : 0.45; ctx.lineWidth = isActive ? 3 : 2
        ctx.beginPath(); ctx.moveTo(X(def.x), Y(0)); ctx.lineTo(X(def.x), Y(H)); ctx.stroke(); ctx.globalAlpha = 1
        var col = mine ? (isActive ? theme.highlight : theme.foreground) : theme.danger
        for (var m = 0; m < def.offs.length; ++m) {
          var mx = def.x + dir * rod.k * Foosball.REACH, my = rod.y + def.offs[m]
          ctx.fillStyle = col
          ctx.fillRect(X(mx - Foosball.MAN_HX), Y(my - Foosball.MAN_HY), Foosball.MAN_HX * 2 * sc, Foosball.MAN_HY * 2 * sc)
          // a little head so the men read as players
          ctx.fillStyle = theme.background
          ctx.beginPath(); ctx.arc(X(mx), Y(my), Foosball.MAN_HX * 0.5 * sc, 0, Math.PI * 2); ctx.fill()
        }
      }
      // ball
      ctx.fillStyle = theme.foreground
      ctx.beginPath(); ctx.arc(X(s.ball.x), Y(s.ball.y), Foosball.BALL_R * sc, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = theme.background; ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(X(s.ball.x), Y(s.ball.y), Foosball.BALL_R * sc, 0, Math.PI * 2); ctx.stroke()
      // score
      ctx.fillStyle = theme.dim
      ctx.font = "bold " + Math.floor(Math.min(22, sc * 8)) + "px " + theme.fontFamily
      ctx.textAlign = "center"; ctx.textBaseline = "bottom"
      ctx.fillText(s.playerScore + "  –  " + s.aiScore, width / 2, g.oy - 4)
      if (root.paused || root.over) {
        ctx.fillStyle = theme.background
        ctx.globalAlpha = root.paused ? 0.7 : 0.35
        ctx.fillRect(0, 0, width, height)
        ctx.globalAlpha = 1
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
