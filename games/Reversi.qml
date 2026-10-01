import QtQuick
import "../engine" as Engine
import "logic/reversi.js" as Reversi

// Othello against a built-in two-ply positional AI. Black (the player)
// moves first; white replies synchronously inside activate(). U takes back
// your last move and the AI's reply together.
Engine.GameBase {
  id: root
  gameId: "reversi"
  hasTwoPlayer: true
  onPlayersChanged: Reversi.setTwoPlayer(players === 2)
  difficulties: ["Easy", "Normal", "Hard"]
  onDifficultyChanged: Reversi.setDifficulty(difficulty)
  title: "REVERSI"
  helpText: "ARROWS move · SPACE/ENTER place disc · U take back · you play the light discs; dots show legal moves, the ring marks the AI's last move"
  mouseHelp: "Hover moves the cursor, LEFT does what SPACE does"

  property var state: null
  readonly property int blackCount: state ? Reversi.countDiscs(state.board, Reversi.BLACK) : 0
  readonly property int whiteCount: state ? Reversi.countDiscs(state.board, Reversi.WHITE) : 0

  score: blackCount
  status: !state ? ""
    : (over
        ? (blackCount > whiteCount ? "YOU WIN " + blackCount + "-" + whiteCount + "  ·  N for a new game"
          : blackCount < whiteCount ? "YOU LOSE " + blackCount + "-" + whiteCount + "  ·  N for a new game"
          : "DRAW " + blackCount + "-" + whiteCount + "  ·  N for a new game")
        : (paused ? "PAUSED" : players === 2 ? (state.aiPassed ? "PASS  ·  " : "") + (state.turn === Reversi.BLACK ? "LIGHT" : "DARK") + " TO MOVE  ·  LIGHT " + blackCount + "  ·  DARK " + whiteCount
          : (state.aiPassed ? "AI PASSES  ·  " : "") + "YOU " + blackCount + "  ·  AI " + whiteCount))
  overTitle: blackCount > whiteCount ? (players === 2 ? "LIGHT WINS " : "YOU WIN ") + blackCount + "–" + whiteCount
    : blackCount < whiteCount ? (players === 2 ? "DARK WINS " : "AI WINS ") + whiteCount + "–" + blackCount : "DRAW"

  onStateChanged: if (state && state.over) over = true

  function newGame() {
    state = Reversi.makeState()
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {
    if (over || !state) return
    state = Reversi.moveCursor(state, dx, dy)
  }

  function activate() {
    if (over) { newGame(); return }
    if (!state) return
    var c = state.cursor
    state = Reversi.humanMove(state, c.x, c.y)
  }

  function undo() {
    if (!state) return
    state = Reversi.undo(state)
    over = false
  }

  function saveState() {
    if (!state || over) return null
    return Reversi.serialize(state)
  }

  function loadState(saved) {
    var restored = Reversi.deserialize(saved)
    if (restored) { state = restored; over = !!restored.over }
    else newGame()
  }

  // Mouse (engine/Pointer.qml): hover moves the cursor, LEFT does what
  // SPACE does.
  function pointer(kind, x, y, b) {
    if (!state || over) return
    if (kind !== "move" && kind !== "press") return
    var cx = Math.floor((x - (0)) / (board.cell)), cy = Math.floor((y - (0)) / (board.cell))
    if (cx < 0 || cy < 0 || cx >= Reversi.SIZE || cy >= Reversi.SIZE) return
    if (cx !== state.cursor.x || cy !== state.cursor.y) moveCursor(cx - state.cursor.x, cy - state.cursor.y)
    if (kind !== "press" || b === Qt.MiddleButton) return
    if (b === Qt.RightButton) return
    activate()
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property real cell: Math.floor(Math.min(parent.width / Reversi.SIZE, parent.height / Reversi.SIZE))
    width: cell * Reversi.SIZE
    height: cell * Reversi.SIZE

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
      var c = board.cell
      if (c <= 0) return

      ctx.strokeStyle = theme.faint
      ctx.lineWidth = 1
      for (var i = 0; i <= Reversi.SIZE; ++i) {
        ctx.beginPath(); ctx.moveTo(i * c, 0); ctx.lineTo(i * c, Reversi.SIZE * c); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(0, i * c); ctx.lineTo(Reversi.SIZE * c, i * c); ctx.stroke()
      }

      var legal = (!root.over && s.turn === Reversi.BLACK) ? Reversi.legalMoves(s.board, Reversi.BLACK) : []
      var legalSet = {}
      for (i = 0; i < legal.length; ++i) legalSet[legal[i].x + "," + legal[i].y] = true

      for (var y = 0; y < Reversi.SIZE; ++y) {
        for (var x = 0; x < Reversi.SIZE; ++x) {
          var v = s.board[y][x]
          var px = x * c, py = y * c
          if (v === Reversi.BLACK) {
            ctx.fillStyle = theme.foreground
            ctx.beginPath(); ctx.arc(px + c / 2, py + c / 2, c * 0.38, 0, Math.PI * 2); ctx.fill()
          } else if (v === Reversi.WHITE) {
            ctx.fillStyle = theme.background
            ctx.beginPath(); ctx.arc(px + c / 2, py + c / 2, c * 0.38, 0, Math.PI * 2); ctx.fill()
            ctx.strokeStyle = theme.border
            ctx.lineWidth = 2
            ctx.stroke()
          }
          if (s.lastAi && s.lastAi.x === x && s.lastAi.y === y) {
            ctx.strokeStyle = theme.accent
            ctx.lineWidth = 2
            ctx.beginPath(); ctx.arc(px + c / 2, py + c / 2, c * 0.44, 0, Math.PI * 2); ctx.stroke()
          }
          if (v === Reversi.EMPTY && legalSet[x + "," + y]) {
            ctx.fillStyle = theme.dim
            ctx.beginPath(); ctx.arc(px + c / 2, py + c / 2, c * 0.08, 0, Math.PI * 2); ctx.fill()
          }
        }
      }

      ctx.strokeStyle = theme.highlight
      ctx.lineWidth = 2
      ctx.strokeRect(s.cursor.x * c + 1, s.cursor.y * c + 1, c - 2, c - 2)

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
