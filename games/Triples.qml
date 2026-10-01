import QtQuick
import "../engine" as Engine
import "logic/triples.js" as Triples

// Triples (after Threes): slide the whole board one step at a time. 1 and 2
// join into a 3, then only equal tiles join. Every slide brings in one new
// tile (previewed on top) at the edge you slid away from.
Engine.GameBase {
  id: root
  gameId: "triples"
  title: "TRIPLES"
  helpText: "ARROWS slide every tile one step · 1 + 2 make 3, then equal tiles join (3+3, 6+6...) · the next tile is shown on top · the game ends when nothing can move · score counts big tiles most · U undo"
  mouseHelp: "Drag across the board to slide; or click the side of the board you want the tiles to go toward"

  property var state: null
  property real pressX: 0
  property real pressY: 0

  score: state ? Triples.score(state.grid) : 0
  progress: state && state.moves ? state.moves + " moves" : ""
  overTitle: state ? "NO MOVES LEFT · " + score : ""
  status: !state ? ""
    : (over ? "STUCK at " + score + " points  ·  N for a new game"
      : (paused ? "PAUSED" : "SCORE " + score + "  ·  BEST TILE " + Math.max.apply(null, [].concat.apply([], state.grid))))

  onStateChanged: if (state && state.over) over = true

  function newGame() { clearUndo(); state = Triples.makeState(); over = false; paused = false }
  function undo() { var p = popUndo(); if (p) { state = p; over = !!p.over; paused = false } }

  function slide(dir) {
    if (over || !state) return
    var next = Triples.move(state, dir)
    if (next !== state) { pushUndo(state); state = next }
  }

  function moveCursor(dx, dy) {
    if (dx < 0) slide("left")
    else if (dx > 0) slide("right")
    else if (dy < 0) slide("up")
    else if (dy > 0) slide("down")
  }

  function activate() { if (over) newGame() }

  function saveState() { return state && !over ? Triples.serialize(state) : null }
  function loadState(saved) {
    var r = Triples.deserialize(saved)
    clearUndo()
    if (r) { state = r; over = r.over } else newGame()
  }

  function pointer(kind, x, y, b) {
    if (!state || over) return
    if (kind === "press") { pressX = x; pressY = y; return }
    if (kind !== "release") return
    var dx = x - pressX, dy = y - pressY
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) { dx = x - (board.grid.ox + board.grid.side / 2); dy = y - (board.grid.oy + board.grid.side / 2) }
    if (Math.abs(dx) > Math.abs(dy)) slide(dx < 0 ? "left" : "right")
    else slide(dy < 0 ? "up" : "down")
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.fill: parent

    // board square and the strip above it for the preview
    readonly property var grid: {
      var top = Math.min(84, height * 0.13)
      var side = Math.floor(Math.min(width * 0.94, height - top - 10))
      return { side: side, ox: Math.floor((width - side) / 2), oy: Math.floor(top + (height - top - side) / 2), top: top }
    }

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onOverChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    function tileColor(v) {
      if (v === 1) return theme.tone(3)
      if (v === 2) return theme.tone(1)
      var lvl = Math.round(Math.log(v / 3) / Math.LN2)
      return Qt.lighter(theme.tone(0), 1 + Math.min(lvl, 8) * 0.07)
    }

    function drawTile(ctx, x, y, size, v, alpha) {
      var r = size * 0.14
      ctx.globalAlpha = alpha === undefined ? 1 : alpha
      ctx.fillStyle = tileColor(v)
      ctx.beginPath()
      ctx.moveTo(x + r, y); ctx.lineTo(x + size - r, y); ctx.quadraticCurveTo(x + size, y, x + size, y + r)
      ctx.lineTo(x + size, y + size - r); ctx.quadraticCurveTo(x + size, y + size, x + size - r, y + size)
      ctx.lineTo(x + r, y + size); ctx.quadraticCurveTo(x, y + size, x, y + size - r)
      ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y)
      ctx.closePath(); ctx.fill()
      ctx.fillStyle = theme.background
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      var digits = String(v).length
      ctx.font = "bold " + Math.floor(size * (digits > 3 ? 0.3 : digits > 2 ? 0.38 : 0.5)) + "px " + theme.fontFamily
      ctx.fillText(String(v), x + size / 2, y + size / 2 + size * 0.02)
      ctx.globalAlpha = 1
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var g = board.grid, s = root.state
      if (g.side <= 0) return
      var cell = g.side / 4, gap = Math.max(3, cell * 0.06)
      // preview
      var pv = Math.min(g.top - 12, 56)
      ctx.fillStyle = theme.dim
      ctx.font = "bold 12px " + theme.fontFamily
      ctx.textAlign = "right"; ctx.textBaseline = "middle"
      ctx.fillText("NEXT", g.ox + g.side / 2 - pv / 2 - 10, g.oy - g.top / 2 - 2)
      if (s.nextBonus) {
        ctx.fillStyle = theme.accent
        ctx.beginPath(); ctx.arc(g.ox + g.side / 2, g.oy - g.top / 2 - 2, pv / 2, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = theme.background; ctx.textAlign = "center"
        ctx.font = "bold " + Math.floor(pv * 0.6) + "px " + theme.fontFamily
        ctx.fillText("+", g.ox + g.side / 2, g.oy - g.top / 2 - 2)
      } else {
        drawTile(ctx, g.ox + g.side / 2 - pv / 2, g.oy - g.top / 2 - 2 - pv / 2, pv, s.next)
      }
      // board
      ctx.fillStyle = theme.faint
      ctx.fillRect(g.ox - gap, g.oy - gap, g.side + gap * 2, g.side + gap * 2)
      for (var y = 0; y < 4; ++y) for (var x = 0; x < 4; ++x) {
        var px = g.ox + x * cell + gap / 2, py = g.oy + y * cell + gap / 2, sz = cell - gap
        var v = s.grid[y][x]
        if (v === 0) { ctx.fillStyle = theme.background; ctx.globalAlpha = 0.5; ctx.fillRect(px, py, sz, sz); ctx.globalAlpha = 1 }
        else drawTile(ctx, px, py, sz, v)
      }
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
