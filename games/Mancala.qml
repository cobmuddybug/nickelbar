import QtQuick
import "../engine" as Engine
import "logic/mancala.js" as Mancala

// Mancala (Kalah): pick up a pit's seeds and sow them round, one per pit,
// counter-clockwise. Finish in your store (right) and you go again; finish
// in an empty pit of yours and you capture what's opposite. When one side
// is empty the other keeps what's left on its row. Most seeds home wins.
Engine.GameBase {
  id: root
  gameId: "mancala"
  difficulties: ["Easy", "Normal", "Hard"]
  onDifficultyChanged: Mancala.setDifficulty(difficulty)
  title: "MANCALA"
  helpText: "LEFT/RIGHT choose a pit · SPACE/ENTER sow it · last seed in your store (right) = go again · last seed in an empty pit of yours takes the seeds opposite · you play the bottom row, sowing left to right · most seeds in your store wins"
  mouseHelp: "Hover one of your pits, click to sow it"

  property var state: null

  tickInterval: 650
  ticking: !!state && state.turn === 1 && !state.over && !over
  score: state ? state.pits[6] : 0
  overTitle: state ? (Mancala.winner(state) === 0 ? "YOU WIN " : Mancala.winner(state) === 1 ? "COMPUTER WINS " : "A DRAW ") + state.pits[6] + " – " + state.pits[13] : ""
  status: !state ? ""
    : (over ? overTitle + "  ·  N for a new game"
      : (paused ? "PAUSED"
        : (state.note ? state.note.toUpperCase() + "  ·  " : "") + (state.turn === 0 ? "YOUR MOVE" : "COMPUTER THINKING…")
          + "  ·  " + state.pits[6] + " – " + state.pits[13]))

  onStateChanged: if (state && state.over) over = true

  onTick: {
    if (!state || state.turn !== 1 || state.over) return
    state = Mancala.cpuMove(state, 6)
  }

  function newGame() { state = Mancala.makeState(); over = false; paused = false }

  function moveCursor(dx, dy) {
    if (over || !state || dx === 0) return
    state = Mancala.moveCursor(state, dx)
  }

  function activate() {
    if (over) { newGame(); return }
    if (!state || state.turn !== 0) return
    var next = Mancala.playCursor(state)
    if (next !== state) state = Mancala.fixCursor(next)
  }

  function saveState() { return state && !over ? Mancala.serialize(state) : null }
  function loadState(saved) {
    var r = Mancala.deserialize(saved)
    if (r) { state = r; over = r.over } else newGame()
  }

  function pitAt(x, y) {
    var g = board.geo
    if (!g) return -1
    var col = Math.floor((x - g.px) / g.pw)
    if (col < 0 || col > 5) return -1
    var cy = g.rowY[1] - g.pw * 0.08
    if (y >= cy - g.pw * 0.5 && y <= cy + g.pw * 0.62) return col     // your row (pit + its count)
    return -1
  }

  function setCursor(i) {
    var s2 = {}
    for (var k in state) s2[k] = state[k]
    s2.cursor = i
    state = s2
  }

  function pointer(kind, x, y, b) {
    if (!state || over || state.turn !== 0) return
    if (kind !== "move" && kind !== "press") return
    var i = pitAt(x, y)
    if (i < 0 || state.pits[i] === 0) return
    if (state.cursor !== i) setCursor(i)
    if (kind === "press" && b === Qt.LeftButton) activate()
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.fill: parent

    // pits on a 8-column strip: store | six pits | store
    readonly property var geo: {
      var pw = Math.min(width / 8.4, height / 3.6)
      var totalW = pw * 8
      var left = (width - totalW) / 2
      var midY = height / 2
      return { pw: pw, pr: pw * 0.42, px: left + pw, left: left, totalW: totalW,
               rowY: [midY - pw * 0.72, midY + pw * 0.72], midY: midY }
    }

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onOverChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    function drawSeeds(ctx, cx, cy, r, n, seedIndex) {
      var shown = Math.min(n, 14)
      for (var i = 0; i < shown; ++i) {
        var a = i * 2.399963 + seedIndex, d = r * 0.58 * Math.sqrt((i + 0.5) / Math.max(shown, 6))
        ctx.fillStyle = theme.tone((i + seedIndex) % 4)
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, Math.max(3, r * 0.15), 0, Math.PI * 2); ctx.fill()
      }
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state, g = board.geo
      if (g.pw <= 0) return
      // board slab
      ctx.fillStyle = theme.faint
      ctx.fillRect(g.left, g.midY - g.pw * 1.5, g.totalW, g.pw * 3)
      ctx.strokeStyle = theme.dim; ctx.lineWidth = 2
      ctx.strokeRect(g.left, g.midY - g.pw * 1.5, g.totalW, g.pw * 3)
      var last = {}
      for (var q = 0; q < s.last.length; ++q) last[s.last[q]] = true

      function pit(cx, cy, n, idx, mine, label) {
        var selected = idx === s.cursor && s.turn === 0 && !root.over && mine
        ctx.fillStyle = theme.background; ctx.globalAlpha = 0.7
        ctx.beginPath(); ctx.arc(cx, cy, g.pr, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1
        ctx.strokeStyle = selected ? theme.highlight : (last[idx] ? theme.accent : theme.dim)
        ctx.lineWidth = selected ? 3 : (last[idx] ? 2.5 : 1.5)
        ctx.beginPath(); ctx.arc(cx, cy, g.pr, 0, Math.PI * 2); ctx.stroke()
        drawSeeds(ctx, cx, cy, g.pr, n, idx)
        ctx.fillStyle = n === 0 ? theme.dim : theme.foreground
        ctx.font = "bold " + Math.floor(g.pw * 0.24) + "px " + theme.fontFamily
        ctx.textAlign = "center"; ctx.textBaseline = "middle"
        ctx.fillText(String(n), cx, cy + g.pr + g.pw * 0.2 * (label ? 1 : 1))
      }
      // your row (bottom, left to right = pits 0..5), computer's row (top, pit 12 above pit 0)
      for (var c = 0; c < 6; ++c) {
        var x = g.px + (c + 0.5) * g.pw
        pit(x, g.rowY[1] - g.pw * 0.08, s.pits[c], c, true)
        pit(x, g.rowY[0] - g.pw * 0.08, s.pits[12 - c], 12 - c, false)
      }
      // stores
      function store(cx, n, idx, label, col) {
        var h = g.pw * 2.4, w = g.pw * 0.8
        ctx.fillStyle = theme.background; ctx.globalAlpha = 0.7
        ctx.fillRect(cx - w / 2, g.midY - h / 2, w, h); ctx.globalAlpha = 1
        ctx.strokeStyle = last[idx] ? theme.accent : theme.dim; ctx.lineWidth = last[idx] ? 2.5 : 1.5
        ctx.strokeRect(cx - w / 2, g.midY - h / 2, w, h)
        ctx.fillStyle = col
        ctx.font = "bold " + Math.floor(g.pw * 0.42) + "px " + theme.fontFamily
        ctx.textAlign = "center"; ctx.textBaseline = "middle"
        ctx.fillText(String(n), cx, g.midY)
        ctx.fillStyle = theme.dim
        ctx.font = Math.floor(g.pw * 0.16) + "px " + theme.fontFamily
        ctx.fillText(label, cx, g.midY - h / 2 + g.pw * 0.2)
      }
      store(g.left + g.pw * 0.5, s.pits[13], 13, "CPU", theme.accent)
      store(g.left + g.pw * 7.5, s.pits[6], 6, "YOU", theme.foreground)
      // direction hint
      ctx.fillStyle = theme.dim
      ctx.font = Math.floor(g.pw * 0.16) + "px " + theme.fontFamily
      ctx.textAlign = "center"
      ctx.fillText("sow  ➜", g.px + g.pw * 3, g.rowY[1] + g.pw * 0.78)
      if (root.paused || root.over) {
        ctx.fillStyle = theme.background
        ctx.globalAlpha = root.paused ? 0.7 : 0.3
        ctx.fillRect(0, 0, width, height)
        ctx.globalAlpha = 1
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
