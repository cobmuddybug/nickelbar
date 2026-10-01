import QtQuick
import "../engine" as Engine
import "logic/numberlink.js" as Numberlink

// Numberlink (after Flow Free): join each pair of matching dots with a path.
// Paths never cross, and together they must fill every square. Running
// into another path cuts it; backing up along your own path rewinds it.
Engine.GameBase {
  id: root
  gameId: "numberlink"
  title: "NUMBERLINK"
  helpText: "ARROWS move · SPACE/ENTER pick up the dot or path under the cursor, then the arrows draw it, SPACE again lets go · a path ends on its matching dot · running into another path cuts it · X clears the path under the cursor · connect every pair AND fill every square · U undo"
  mouseHelp: "Press a dot (or the end of a path) and drag to draw; RIGHT-click a path to clear it"

  property var state: null
  property int solved: 0

  score: solved
  progress: solved ? solved + " solved" : ""
  overTitle: state ? "ALL LINKED IN " + state.moves + " MOVES" : ""
  status: {
    if (!state) return ""
    if (over) return "SOLVED  ·  SPACE for the next puzzle"
    if (paused) return "PAUSED"
    var linked = 0
    for (var i = 0; i < state.pairs.length; ++i) if (Numberlink.connectedPair(state, i)) linked++
    var cov = Numberlink.covered(state)
    return linked + "/" + state.pairs.length + " linked  ·  " + cov + "/" + (state.size * state.size) + " filled"
  }

  onStateChanged: if (state && state.won) over = true

  function sizeFor(n) { return Math.min(7, 5 + Math.floor(n / 3)) }

  function newGame() {
    clearUndo()
    state = Numberlink.makeState(sizeFor(solved))
    over = false
    paused = false
  }

  function undo() { var p = popUndo(); if (p) { state = p; over = !!p.won; paused = false } }

  function moveCursor(dx, dy) { if (!over && state) state = Numberlink.moveCursor(state, dx, dy) }

  function activate() {
    if (over) { solved++; newGame(); return }
    if (!state) return
    if (state.active >= 0) state = Numberlink.drop(state)
    else { pushUndo(state); state = Numberlink.pickUp(state, state.cursor.x, state.cursor.y) }
  }

  function handleKey(key, text) {
    if (over || !state) return false
    if (key === Qt.Key_X) {
      var o = Numberlink.dotAt(state, state.cursor.x, state.cursor.y)
      if (o < 0) { var own = board.ownerAt(state.cursor.x, state.cursor.y); o = own }
      if (o >= 0) { pushUndo(state); state = Numberlink.clearColour(state, o) }
      return true
    }
    return false
  }

  function saveState() {
    if (!state || over) return { solved: solved }
    var o = Numberlink.serialize(state); o.solvedCount = solved
    return o
  }
  function loadState(saved) {
    solved = saved && saved.solvedCount !== undefined ? saved.solvedCount : (saved && saved.solved ? saved.solved : 0)
    var r = saved && saved.pairs ? Numberlink.deserialize(saved) : null
    clearUndo()
    if (r) { state = r; over = r.won } else newGame()
  }

  function cellAt(x, y) {
    if (!state) return null
    var c = board.cell
    var cx = Math.floor((x - board.ox) / c), cy = Math.floor((y - board.oy) / c)
    if (cx < 0 || cy < 0 || cx >= state.size || cy >= state.size) return null
    return { x: cx, y: cy }
  }

  function pointer(kind, x, y, b) {
    if (!state || over) return
    var p = cellAt(x, y)
    if (kind === "press") {
      if (!p) return
      if (b === Qt.RightButton) {
        var o = Numberlink.dotAt(state, p.x, p.y)
        if (o < 0) o = board.ownerAt(p.x, p.y)
        if (o >= 0) { pushUndo(state); state = Numberlink.clearColour(state, o) }
        return
      }
      pushUndo(state)
      state = Numberlink.pickUp(state, p.x, p.y)
    } else if (kind === "drag") {
      if (p) state = Numberlink.dragTo(state, p.x, p.y)
    } else if (kind === "release") {
      state = Numberlink.drop(state)
    } else if (kind === "move" && p && state.active < 0) {
      if (p.x !== state.cursor.x || p.y !== state.cursor.y) state = Numberlink.moveCursor(state, p.x - state.cursor.x, p.y - state.cursor.y)
    }
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.fill: parent

    readonly property int n: root.state ? root.state.size : 5
    readonly property real cell: Math.floor(Math.min(width * 0.96, height * 0.96) / n)
    readonly property real ox: Math.floor((width - cell * n) / 2)
    readonly property real oy: Math.floor((height - cell * n) / 2)

    function ownerAt(x, y) {
      if (!root.state) return -1
      return Numberlink.owners(root.state)[y][x]
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
      var s = root.state, c = board.cell, n = board.n
      if (c <= 0) return
      var ox = board.ox, oy = board.oy
      var owners = Numberlink.owners(s)
      // cells: tinted by the path that fills them
      for (var y = 0; y < n; ++y) for (var x = 0; x < n; ++x) {
        var o = owners[y][x]
        ctx.fillStyle = o >= 0 ? theme.tone(o) : theme.faint
        ctx.globalAlpha = o >= 0 ? 0.2 : 0.12
        ctx.fillRect(ox + x * c + 1, oy + y * c + 1, c - 2, c - 2)
        ctx.globalAlpha = 1
      }
      // paths
      ctx.lineCap = "round"; ctx.lineJoin = "round"
      for (var i = 0; i < s.paths.length; ++i) {
        var path = s.paths[i]
        if (path.length < 2) continue
        ctx.strokeStyle = theme.tone(i)
        ctx.lineWidth = c * (s.active === i ? 0.42 : 0.34)
        ctx.beginPath()
        for (var j = 0; j < path.length; ++j) {
          var px = ox + (path[j][0] + 0.5) * c, py = oy + (path[j][1] + 0.5) * c
          if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
        }
        ctx.stroke()
      }
      // dots
      for (var k = 0; k < s.pairs.length; ++k) {
        var pr = s.pairs[k], ends = [pr.a, pr.b]
        for (var e = 0; e < 2; ++e) {
          ctx.fillStyle = theme.tone(k)
          ctx.beginPath(); ctx.arc(ox + (ends[e][0] + 0.5) * c, oy + (ends[e][1] + 0.5) * c, c * 0.31, 0, Math.PI * 2); ctx.fill()
          ctx.strokeStyle = theme.background; ctx.lineWidth = 2
          ctx.beginPath(); ctx.arc(ox + (ends[e][0] + 0.5) * c, oy + (ends[e][1] + 0.5) * c, c * 0.31, 0, Math.PI * 2); ctx.stroke()
        }
      }
      // grid
      ctx.strokeStyle = theme.faint; ctx.lineWidth = 1
      for (var g = 0; g <= n; ++g) {
        ctx.beginPath(); ctx.moveTo(ox + g * c, oy); ctx.lineTo(ox + g * c, oy + n * c); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(ox, oy + g * c); ctx.lineTo(ox + n * c, oy + g * c); ctx.stroke()
      }
      ctx.strokeStyle = s.active >= 0 ? theme.tone(s.active) : theme.foreground
      ctx.lineWidth = 2
      ctx.strokeRect(ox + s.cursor.x * c + 2, oy + s.cursor.y * c + 2, c - 4, c - 4)
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
