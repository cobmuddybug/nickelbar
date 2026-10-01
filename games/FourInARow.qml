import QtQuick
import "../engine" as Engine
import "logic/fourinarow.js" as Four

// Four in a Row against an alpha-beta AI (see logic/fourinarow.js). You
// always move first. Score is games won.
Engine.GameBase {
  id: root
  gameId: "fourinarow"
  hasTwoPlayer: true
  onPlayersChanged: Four.setTwoPlayer(players === 2)
  title: "FOUR IN A ROW"
  helpText: "Line up four of yours across, down or diagonally · LEFT/RIGHT pick a column · SPACE drop · 1-7 drop in that column · D difficulty easy/medium/hard (new game) · U take back"
  mouseHelp: "Hover picks the column, click drops"

  property var state: null
  score: state ? state.wins : 0
  overTitle: !state ? "" : state.winner === 3 ? "DRAW" : players === 2 ? "PLAYER " + state.winner + " WINS" : state.winner === 1 ? "YOU WIN" : "AI WINS"
  status: !state ? ""
    : paused ? "PAUSED"
    : over ? overTitle + "  ·  SPACE for a new game"
    : players === 2 ? "PLAYER " + state.turn + " TO DROP  ·  LEFT/RIGHT, SPACE"
    : Four.LEVELS[state.level].name + "  ·  WON " + state.wins + "  ·  LOST " + state.losses

  onStateChanged: over = !!state && Four.over(state)

  function newGame() {
    state = state ? Four.makeState(state.level, state.wins, state.losses) : Four.makeState(1)
    paused = false
  }

  function moveCursor(dx, dy) {
    if (!state || over) return
    if (dy > 0) { state = Four.drop(state); return }
    state = Four.moveCursor(state, dx)
  }

  function activate() {
    if (!state) return
    if (over) { newGame(); return }
    state = Four.drop(state)
  }

  function undo() { if (state) state = Four.undo(state) }

  function handleKey(key, text) {
    if (!state) return false
    var t = text ? text.toLowerCase() : ""
    if (t === "d") {
      var n = Four.makeState((state.level + 1) % Four.LEVELS.length, state.wins, state.losses)
      state = n
      paused = false
      return true
    }
    if (over) return false
    if (t >= "1" && t <= "7" && t.length === 1) {
      state = Four.dropAt(state, t.charCodeAt(0) - 49)
      return true
    }
    return false
  }

  function saveState() { return state ? Four.serialize(state) : null }

  function loadState(saved) {
    var r = Four.deserialize(saved)
    if (r && !Four.over(r)) { state = r; paused = false }
    else { state = r || Four.makeState(1); newGame() }
  }

  // Mouse (engine/Pointer.qml): hover picks the column, click drops.
  function pointer(kind, x, y, b) {
    if (!state || over || (kind !== "move" && kind !== "press")) return
    var col = Math.floor(x / board.cell)
    if (col < 0 || col >= Four.COLS) return
    if (col !== state.cursor) state = Four.moveCursor(state, col - state.cursor)
    if (kind === "press" && b === Qt.LeftButton) state = Four.drop(state)
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property real cell: Math.floor(Math.min(parent.width / Four.COLS, parent.height / (Four.ROWS + 1)))
    width: cell * Four.COLS
    height: cell * (Four.ROWS + 1)

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onOverChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    function disc(ctx, x, y, r, p) {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2)
      if (p === 1) { ctx.fillStyle = theme.accent; ctx.fill() }
      else if (p === 2) { ctx.fillStyle = theme.tone(1); ctx.fill() }
      else { ctx.fillStyle = theme.withAlpha(theme.foreground, 0.06); ctx.fill() }
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state, c = cell, r = c * 0.4

      // Hover disc above the chosen column.
      if (!root.over) {
        disc(ctx, s.cursor * c + c / 2, c / 2, r, 1)
        ctx.fillStyle = theme.withAlpha(theme.accent, 0.08)
        ctx.fillRect(s.cursor * c, c, c, c * Four.ROWS)
      }

      ctx.strokeStyle = theme.faint
      ctx.lineWidth = 1
      ctx.strokeRect(0.5, c + 0.5, width - 1, c * Four.ROWS - 1)
      for (var y = 0; y < Four.ROWS; ++y)
        for (var x = 0; x < Four.COLS; ++x) disc(ctx, x * c + c / 2, (y + 1) * c + c / 2, r, s.board[y][x])

      // AI's last disc gets a ring; the winning four get a bold one.
      if (s.last && s.board[s.last.y][s.last.x] === 2 && !s.line) {
        ctx.strokeStyle = theme.foreground; ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(s.last.x * c + c / 2, (s.last.y + 1) * c + c / 2, r * 0.55, 0, Math.PI * 2); ctx.stroke()
      }
      if (s.line) {
        ctx.strokeStyle = theme.foreground; ctx.lineWidth = Math.max(3, c * 0.07)
        for (var i = 0; i < s.line.length; ++i) {
          ctx.beginPath(); ctx.arc(s.line[i].x * c + c / 2, (s.line[i].y + 1) * c + c / 2, r * 0.7, 0, Math.PI * 2); ctx.stroke()
        }
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
