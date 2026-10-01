import QtQuick
import "../engine" as Engine
import "logic/samegame.js" as Same

// Same Game, after Simon Tatham's / KSame / Swell Foop (see
// logic/samegame.js). Score is points: a group of n is worth (n-2)².
Engine.GameBase {
  id: root
  gameId: "samegame"
  title: "SAME GAME"
  helpText: "Clear groups of two or more touching tiles of one colour · a group of n scores (n−2)², so save up for big ones · tiles fall down and empty columns close up · clear the board for +1000 · ARROWS move · SPACE clear the group · S size / colours · U undo"
  mouseHelp: "Hover moves the cursor, LEFT does what SPACE does"

  property var state: null
  property int size: 1
  score: state ? state.score : 0
  overTitle: !state ? "" : Same.cleared(state) ? "CLEARED · " + state.score : "NO MOVES · " + state.score
  readonly property int groupSize: {
    if (!state) return 0
    var p = Same.cellAt(state, state.cursor.x, state.cursor.y)
    return Same.group(state, p[0], p[1]).length
  }
  status: !state ? ""
    : over ? overTitle + "  ·  SPACE for a new board"
    : paused ? "PAUSED"
    : (groupSize >= 2 ? "GROUP " + groupSize + " → " + (groupSize - 2) * (groupSize - 2) + "  ·  " : "")
      + Same.tilesLeft(state) + " tiles left  ·  " + Same.SIZES[state.size].name

  onStateChanged: over = !!state && state.done

  function newGame() {
    state = Same.makeState(size)
    paused = false
  }

  function moveCursor(dx, dy) { if (state && !over) state = Same.moveCursor(state, dx, dy) }

  function activate() {
    if (!state) return
    if (over) { newGame(); return }
    state = Same.pick(state)
  }

  function undo() { if (state) state = Same.undo(state) }

  function handleKey(key, text) {
    if (!state || !text || text.toLowerCase() !== "s") return false
    size = (size + 1) % Same.SIZES.length
    newGame()
    return true
  }

  function saveState() { return state ? (over ? { size: size, done: true } : Same.serialize(state)) : null }

  function loadState(saved) {
    if (saved && saved.size >= 0 && saved.size < Same.SIZES.length) size = saved.size
    var r = Same.deserialize(saved)
    if (r) { state = r; paused = false }
    else newGame()
  }

  // Mouse (engine/Pointer.qml): hover moves the cursor, LEFT does what
  // SPACE does.
  function pointer(kind, x, y, b) {
    if (!state || over) return
    if (kind !== "move" && kind !== "press") return
    var cx = Math.floor((x - (0)) / (board.cell)), cy = Math.floor((y - (0)) / (board.cell))
    if (cx < 0 || cy < 0 || cx >= state.w || cy >= state.h) return
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
    readonly property int cols: root.state ? root.state.w : 12
    readonly property int rows: root.state ? root.state.h : 8
    readonly property real cell: Math.floor(Math.min(parent.width / cols, parent.height / rows))
    width: cell * cols
    height: cell * rows

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
      var cur = Same.cellAt(s, s.cursor.x, s.cursor.y), g = root.over ? [] : Same.group(s, cur[0], cur[1]), inGroup = {}
      if (g.length >= 2) for (var i = 0; i < g.length; ++i) inGroup[g[i][0] + "," + g[i][1]] = true
      for (var x = 0; x < s.w; ++x)
        for (var y = 0; y < s.h; ++y) {
          var v = s.grid[x][y]
          if (v < 0) continue
          var px = x * c, py = (s.h - 1 - y) * c, pad = Math.max(1, c * 0.06)
          ctx.fillStyle = theme.tone(v)
          ctx.globalAlpha = g.length >= 2 && !inGroup[x + "," + y] ? 0.55 : 1
          ctx.fillRect(px + pad, py + pad, c - pad * 2, c - pad * 2)
          ctx.globalAlpha = 1
          if (inGroup[x + "," + y]) {
            ctx.strokeStyle = theme.foreground; ctx.lineWidth = 2
            ctx.strokeRect(px + pad + 1, py + pad + 1, c - pad * 2 - 2, c - pad * 2 - 2)
          }
        }
      if (!root.over) {
        ctx.strokeStyle = theme.highlight; ctx.lineWidth = 3
        ctx.strokeRect(s.cursor.x * c + 1.5, s.cursor.y * c + 1.5, c - 3, c - 3)
      }
      if (root.paused || root.over) {
        ctx.fillStyle = theme.background
        ctx.globalAlpha = root.paused ? 0.85 : 0.35
        ctx.fillRect(0, 0, width, height)
        ctx.globalAlpha = 1.0
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
