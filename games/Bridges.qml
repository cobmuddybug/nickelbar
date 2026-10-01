import QtQuick
import "../engine" as Engine
import "logic/bridges.js" as Bridges

// Bridges (Hashiwokakero). Score is puzzles solved.
Engine.GameBase {
  id: root
  gameId: "bridges"
  title: "BRIDGES"
  helpText: "Join islands with bridges so each has its number, none cross, and all connect · ARROWS hop between islands · SPACE grab an island, then ARROWS cycle the bridge that way (0/1/2), SPACE to let go · X clear an island's bridges · S size 7/9/11/13 · U undo"
  mouseHelp: "Click an island, then another in line with it, to cycle the bridge between them (0/1/2); right-click an island to clear its bridges"

  property var state: null
  property int size: 9
  score: state ? state.count : 0
  progress: score ? score + " solved" : ""
  overTitle: "CONNECTED · " + (state ? state.moves : 0) + " MOVES"
  status: !state ? ""
    : (over ? "SOLVED  ·  SPACE for the next one"
      : (paused ? "PAUSED"
        : (state.note ? state.note.toUpperCase() + "  ·  " : "")
          + (state.grabbed ? "BUILDING · arrows add bridges · SPACE to let go" : state.n + "×" + state.n + "  ·  "
            + Bridges.doneCount(state) + "/" + state.islands.length + " islands done")))

  onStateChanged: if (state && state.solved) over = true

  function newGame() {
    state = Bridges.makeState(size, state ? state.count : 0)
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {
    if (over || !state) return
    state = Bridges.moveCursor(state, dx, dy)
  }

  function activate() {
    if (over) { newGame(); return }
    if (state) state = Bridges.activate(state)
  }

  function undo() { if (state && !over) state = Bridges.undo(state) }

  function handleKey(key, text) {
    if (!state) return false
    if (text === "s" || text === "S") {
      var i = Bridges.SIZES.indexOf(size)
      size = Bridges.SIZES[(i + 1) % Bridges.SIZES.length]
      newGame()
      return true
    }
    if (over) return false
    if (text === "x" || text === "X") { state = Bridges.clearIsland(state); return true }
    return false
  }

  function saveState() {
    if (!state) return null
    if (over) return { count: state.count, n: size, solved: true, islands: [] }
    return Bridges.serialize(state)
  }

  function loadState(saved) {
    if (saved && saved.n) size = saved.n
    var restored = Bridges.deserialize(saved)
    if (restored && !restored.solved) { state = restored; over = false; return }
    state = Bridges.makeState(size, saved && saved.count ? saved.count : 0)
    over = false
  }

  // Mouse (engine/Pointer.qml): click an island, then another in line with
  // it, to cycle the bridge between them (0/1/2); right-click an island
  // to clear its bridges.
  function islandAt(x, y) {
    var c = board.cell, isl = state.islands
    for (var i = 0; i < isl.length; ++i)
      if (Math.abs(x - (isl[i].x + 0.5) * c) < c * 0.45 && Math.abs(y - (isl[i].y + 0.5) * c) < c * 0.45) return i
    return -1
  }
  function pointer(kind, x, y, b) {
    if (!state || over || kind !== "press") return
    var i = islandAt(x, y)
    if (i < 0) { if (state.grabbed) state = Bridges.activate(state); return }
    var from = state.cursor, isl = state.islands
    if (b === Qt.RightButton) { state = Bridges.clearIsland(Bridges.moveTo(state, i)); return }
    if (state.grabbed && i !== from && (isl[i].x === isl[from].x || isl[i].y === isl[from].y)) {
      var dx = Math.sign(isl[i].x - isl[from].x), dy = Math.sign(isl[i].y - isl[from].y)
      state = Bridges.build(state, dx, dy)
      return
    }
    state = Bridges.moveTo(state, i)
    if (!state.grabbed) state = Bridges.activate(state)
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property int n: root.state ? root.state.n : 9
    readonly property real cell: Math.floor(Math.min(parent.width, parent.height) / n)
    width: cell * n
    height: cell * n

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
      var s = root.state, c = cell, isl = s.islands
      function px(i) { return isl[i].x * c + c / 2 }
      function py(i) { return isl[i].y * c + c / 2 }

      // Faint dot grid so distances read.
      ctx.fillStyle = theme.faint
      for (var gy = 0; gy < s.n; ++gy)
        for (var gx = 0; gx < s.n; ++gx) ctx.fillRect(gx * c + c / 2 - 1, gy * c + c / 2 - 1, 2, 2)

      // Bridges: one line or two parallel ones.
      ctx.strokeStyle = theme.foreground
      ctx.lineWidth = Math.max(2, c * 0.07)
      for (var k in s.links) {
        var cnt = s.links[k]
        if (!cnt) continue
        var e = k.split("-"), a = +e[0], b = +e[1]
        var horiz = isl[a].y === isl[b].y
        var offs = cnt === 2 ? [-c * 0.1, c * 0.1] : [0]
        for (var o = 0; o < offs.length; ++o) {
          ctx.beginPath()
          ctx.moveTo(px(a) + (horiz ? 0 : offs[o]), py(a) + (horiz ? offs[o] : 0))
          ctx.lineTo(px(b) + (horiz ? 0 : offs[o]), py(b) + (horiz ? offs[o] : 0))
          ctx.stroke()
        }
      }

      // Islands: done ones fill with the accent, over-built ones go red.
      var r = c * 0.38
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.font = "bold " + Math.floor(c * 0.42) + "px " + theme.fontFamily
      for (var i = 0; i < isl.length; ++i) {
        var d = Bridges.degree(s, i), need = isl[i].need
        ctx.beginPath(); ctx.arc(px(i), py(i), r, 0, Math.PI * 2)
        ctx.fillStyle = theme.background
        ctx.fill()
        ctx.fillStyle = d === need ? theme.withAlpha(theme.accent, 0.45) : d > need ? theme.withAlpha(theme.danger, 0.35) : theme.withAlpha(theme.foreground, 0.08)
        ctx.fill()
        ctx.strokeStyle = d > need ? theme.danger : d === need ? theme.accent : theme.dim
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.fillStyle = theme.foreground
        ctx.fillText(String(need), px(i), py(i) + 1)
      }

      // Cursor; grabbed shows a heavier ring and arrow ticks.
      var cx = px(s.cursor), cy = py(s.cursor)
      ctx.strokeStyle = theme.accent
      ctx.lineWidth = s.grabbed ? 4 : 2.5
      ctx.beginPath(); ctx.arc(cx, cy, r + 4, 0, Math.PI * 2); ctx.stroke()
      if (s.grabbed) {
        ctx.fillStyle = theme.accent
        var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
        for (var q = 0; q < 4; ++q) {
          var tx = cx + dirs[q][0] * (r + 10), ty = cy + dirs[q][1] * (r + 10)
          ctx.beginPath()
          ctx.moveTo(tx + dirs[q][0] * 6, ty + dirs[q][1] * 6)
          ctx.lineTo(tx - dirs[q][1] * 5, ty + dirs[q][0] * 5)
          ctx.lineTo(tx + dirs[q][1] * 5, ty - dirs[q][0] * 5)
          ctx.closePath(); ctx.fill()
        }
      }

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
