import QtQuick
import "../engine" as Engine
import "logic/sokoban.js" as Sokoban

// Box-pushing puzzle. Movement is real motion (push/no-op), not a free
// cursor. U steps back through the whole move history (un-pushing boxes
// too); R restarts the current level.
Engine.GameBase {
  id: root
  gameId: "sokoban"
  title: "SOKOBAN"
  helpText: "ARROWS move & push boxes · U undo (repeatable) · R or N restart level · boxes can't be pulled"
  mouseHelp: "Click a floor square to walk there (the shortest way round, pushing nothing); click next to a crate to push it"

  property var state: null
  score: state ? (state.levelsCleared * 100 + Sokoban.boxesOnGoal(state)) : 0
  status: !state ? ""
    : (over ? "ALL LEVELS CLEARED  ·  N for a new game"
      : (paused ? "PAUSED"
        : (state.justAdvanced ? "LEVEL CLEARED  ·  next level"
          : "LEVEL " + (state.levelIndex + 1) + "/" + Sokoban.levelCount() + "  ·  " + Sokoban.boxesOnGoal(state) + "/" + state.boxes.length + " home  ·  " + state.moves + " moves")))
  overTitle: "ALL LEVELS CLEARED"

  function handleKey(key, text) {
    if ((text === "r" || text === "R") && state && !over) { state = Sokoban.restartLevel(state); return true }
    return false
  }

  onStateChanged: if (state && state.allCleared) over = true

  // Restarts the current level in place; a fresh (no prior state) or
  // already-cleared run starts over from level 0.
  function newGame() {
    var idx = (state && !over) ? state.levelIndex : 0
    var cleared = (state && !over) ? state.levelsCleared : 0
    state = Sokoban.makeState(idx, cleared)
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {
    if (over || !state) return
    if (dx !== 0 && dy !== 0) return
    if (dx === 0 && dy === 0) return
    state = Sokoban.move(state, dx, dy)
  }

  function activate() {
    if (over) newGame()
  }

  function undo() {
    if (over || !state) return
    state = Sokoban.undo(state)
  }

  function saveState() {
    if (!state || over) return null
    return Sokoban.serialize(state)
  }

  function loadState(saved) {
    var restored = Sokoban.deserialize(saved)
    if (restored) { state = restored; over = !!restored.allCleared }
    else newGame()
  }

  // Mouse (engine/Pointer.qml): click a floor square to walk there (the
  // shortest way round, pushing nothing); click next to a crate to push it.
  function pointer(kind, x, y, b) {
    if (!state || over || kind !== "press" || b !== Qt.LeftButton) return
    var c = board.cell, tx = Math.floor(x / c), ty = Math.floor(y / c), p = state.player
    if (Math.abs(tx - p.x) + Math.abs(ty - p.y) === 1) { moveCursor(tx - p.x, ty - p.y); return }
    // Breadth-first walk over free floor.
    var key = function(a, b2) { return a + "," + b2 }, prev = {}, q = [p], found = false
    prev[key(p.x, p.y)] = null
    var D = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    while (q.length && !found) {
      var cur = q.shift()
      for (var d = 0; d < 4; ++d) {
        var nx = cur.x + D[d][0], ny = cur.y + D[d][1], k = key(nx, ny)
        if (k in prev || !Sokoban.inBounds(state, nx, ny) || Sokoban.isWall(state, nx, ny) || Sokoban.boxAt(state.boxes, nx, ny)) continue
        prev[k] = cur
        if (nx === tx && ny === ty) { found = true; break }
        q.push({ x: nx, y: ny })
      }
    }
    if (!found) return
    var path = [], at = { x: tx, y: ty }
    while (prev[key(at.x, at.y)]) { var pr = prev[key(at.x, at.y)]; path.unshift({ dx: at.x - pr.x, dy: at.y - pr.y }); at = pr }
    for (var i = 0; i < path.length; ++i) moveCursor(path[i].dx, path[i].dy)
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property int gridCols: root.state ? root.state.width : 1
    readonly property int gridRows: root.state ? root.state.height : 1
    readonly property real cell: Math.floor(Math.min(parent.width / gridCols, parent.height / gridRows))
    width: cell * gridCols
    height: cell * gridRows

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

      var onGoalAt = {}
      for (var i = 0; i < s.boxes.length; ++i) {
        var b = s.boxes[i]
        onGoalAt[b.x + "," + b.y] = s.grid[b.y].charAt(b.x) === "."
      }

      for (var y = 0; y < s.height; ++y) {
        for (var x = 0; x < s.width; ++x) {
          var ch = s.grid[y].charAt(x)
          var px = x * c, py = y * c

          if (ch === "#") {
            ctx.fillStyle = theme.border
            ctx.fillRect(px, py, c, c)
            continue
          }

          ctx.fillStyle = theme.background
          ctx.fillRect(px, py, c, c)

          if (ch === ".") {
            ctx.strokeStyle = theme.accent
            ctx.lineWidth = 2
            ctx.strokeRect(px + c * 0.28, py + c * 0.28, c * 0.44, c * 0.44)
          }

          // Boxes: outlined crates normally, solid with a check once home,
          // so the difference never depends on two theme colours differing.
          var key = x + "," + y
          if (onGoalAt.hasOwnProperty(key)) {
            var home = onGoalAt[key]
            ctx.fillStyle = home ? theme.accent : theme.withAlpha(theme.tone(1), 0.3)
            ctx.fillRect(px + c * 0.12, py + c * 0.12, c * 0.76, c * 0.76)
            ctx.strokeStyle = home ? theme.accent : theme.tone(1)
            ctx.lineWidth = Math.max(2, c * 0.06)
            ctx.strokeRect(px + c * 0.12, py + c * 0.12, c * 0.76, c * 0.76)
            ctx.beginPath()
            if (home) {
              ctx.strokeStyle = theme.background
              ctx.moveTo(px + c * 0.3, py + c * 0.52); ctx.lineTo(px + c * 0.45, py + c * 0.66); ctx.lineTo(px + c * 0.7, py + c * 0.36)
            } else {
              ctx.moveTo(px + c * 0.12, py + c * 0.12); ctx.lineTo(px + c * 0.88, py + c * 0.88)
              ctx.moveTo(px + c * 0.88, py + c * 0.12); ctx.lineTo(px + c * 0.12, py + c * 0.88)
            }
            ctx.stroke()
          }
        }
      }

      var p = s.player
      ctx.fillStyle = theme.foreground
      ctx.beginPath()
      ctx.arc(p.x * c + c / 2, p.y * c + c / 2, c * 0.3, 0, Math.PI * 2)
      ctx.fill()

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
