import QtQuick
import "../engine" as Engine
import "logic/checkers.js" as Checkers

// Checkers (English draughts) against an alpha-beta AI; see
// logic/checkers.js for the rules as played. Score is games won.
Engine.GameBase {
  id: root
  gameId: "checkers"
  hasTwoPlayer: true
  onPlayersChanged: Checkers.setTwoPlayer(players === 2)
  title: "CHECKERS"
  helpText: "Move diagonally forward; jump to capture, and you must when you can · ARROWS move · SPACE pick a piece, then SPACE on each square it lands on (multi-jumps hop by hop) · SPACE on the picked piece lets go · reach the far row to crown a king · D difficulty (new game) · U take back"
  mouseHelp: "Hover moves the cursor, LEFT does what SPACE does"

  property var state: null
  score: state ? state.wins : 0
  overTitle: !state ? "" : state.winner === 3 ? "DRAW" : players === 2 ? "PLAYER " + state.winner + " WINS" : state.winner === 1 ? "YOU WIN" : "AI WINS"
  status: !state ? ""
    : paused ? "PAUSED"
    : over ? overTitle + "  ·  SPACE for a new game"
    : (state.note ? state.note.toUpperCase() + "  ·  " : "")
      + (players === 2 ? "PLAYER " + state.turn + " TO MOVE  ·  P1 " + Checkers.count(state.board, 1) + "  ·  P2 " + Checkers.count(state.board, 2) : Checkers.LEVELS[state.level].name + "  ·  YOU " + Checkers.count(state.board, 1) + "  ·  AI " + Checkers.count(state.board, 2))

  onStateChanged: over = !!state && Checkers.over(state)

  function newGame() {
    state = state ? Checkers.makeState(state.level, state.wins, state.losses) : Checkers.makeState(1)
    paused = false
  }

  function moveCursor(dx, dy) {
    if (!state || over) return
    state = Checkers.moveCursor(state, dx, dy)
  }

  function activate() {
    if (!state) return
    if (over) { newGame(); return }
    state = Checkers.activate(state)
  }

  function undo() { if (state) state = Checkers.undo(state) }

  function handleKey(key, text) {
    if (!state || !text || text.toLowerCase() !== "d") return false
    state = Checkers.makeState((state.level + 1) % Checkers.LEVELS.length, state.wins, state.losses)
    paused = false
    return true
  }

  function saveState() { return state ? Checkers.serialize(state) : null }

  function loadState(saved) {
    var r = Checkers.deserialize(saved)
    if (r && !Checkers.over(r)) { state = r; paused = false }
    else { state = r || Checkers.makeState(1); newGame() }
  }

  // Mouse (engine/Pointer.qml): hover moves the cursor, LEFT does what
  // SPACE does.
  function pointer(kind, x, y, b) {
    if (!state || over) return
    if (kind !== "move" && kind !== "press") return
    var cx = Math.floor((x - (0)) / (board.cell)), cy = Math.floor((y - (0)) / (board.cell))
    if (cx < 0 || cy < 0 || cx >= Checkers.N || cy >= Checkers.N) return
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
    readonly property real cell: Math.floor(Math.min(parent.width, parent.height) / Checkers.N)
    width: cell * Checkers.N
    height: cell * Checkers.N

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
      var s = root.state, c = cell, N = Checkers.N

      for (var y = 0; y < N; ++y)
        for (var x = 0; x < N; ++x) {
          ctx.fillStyle = (x + y) % 2 ? theme.withAlpha(theme.foreground, 0.1) : theme.withAlpha(theme.foreground, 0.02)
          ctx.fillRect(x * c, y * c, c, c)
        }

      // The AI's last move: its path, faintly.
      if (s.last) {
        ctx.fillStyle = theme.withAlpha(theme.tone(1), 0.18)
        for (var l = 0; l < s.last.path.length; ++l) ctx.fillRect(s.last.path[l].x * c, s.last.path[l].y * c, c, c)
      }

      // Where you can go next.
      if (!root.over) {
        var t = Checkers.targets(s)
        for (var i = 0; i < t.length; ++i) {
          ctx.strokeStyle = theme.withAlpha(theme.accent, 0.6)
          ctx.lineWidth = 2
          ctx.strokeRect(t[i].x * c + 3, t[i].y * c + 3, c - 6, c - 6)
        }
        for (var k = 1; k < s.sel.length; ++k) {
          ctx.fillStyle = theme.withAlpha(theme.accent, 0.25)
          ctx.fillRect(s.sel[k].x * c, s.sel[k].y * c, c, c)
        }
      }

      for (y = 0; y < N; ++y)
        for (x = 0; x < N; ++x) {
          var v = s.board[y][x]
          if (!v) continue
          var mine = Checkers.side(v) === Checkers.me(s)
          var lifted = s.sel.length && s.sel[0].x === x && s.sel[0].y === y
          var cx = x * c + c / 2, cy = y * c + c / 2 - (lifted ? c * 0.06 : 0), r = c * 0.36
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
          ctx.fillStyle = mine ? theme.accent : theme.tone(1)
          ctx.fill()
          ctx.strokeStyle = theme.withAlpha(theme.background, 0.5); ctx.lineWidth = Math.max(1.5, c * 0.04)
          ctx.beginPath(); ctx.arc(cx, cy, r * 0.68, 0, Math.PI * 2); ctx.stroke()
          if (Checkers.isKing(v)) {
            // A little crown.
            ctx.fillStyle = theme.background
            var w = r * 0.9, h = r * 0.55, bx = cx - w / 2, by = cy + h / 2
            ctx.beginPath()
            ctx.moveTo(bx, by); ctx.lineTo(bx, by - h); ctx.lineTo(bx + w * 0.25, by - h * 0.45)
            ctx.lineTo(bx + w * 0.5, by - h); ctx.lineTo(bx + w * 0.75, by - h * 0.45); ctx.lineTo(bx + w, by - h)
            ctx.lineTo(bx + w, by); ctx.closePath(); ctx.fill()
          }
          if (lifted) {
            ctx.strokeStyle = theme.foreground; ctx.lineWidth = 2.5
            ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, Math.PI * 2); ctx.stroke()
          }
        }

      if (!root.over) {
        ctx.strokeStyle = theme.highlight
        ctx.lineWidth = 3
        ctx.strokeRect(s.cursor.x * c + 1.5, s.cursor.y * c + 1.5, c - 3, c - 3)
      }

      if (root.paused) {
        ctx.fillStyle = theme.background
        ctx.globalAlpha = 0.7
        ctx.fillRect(0, 0, width, height)
        ctx.globalAlpha = 1.0
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
