import QtQuick
import "../engine" as Engine
import "logic/tetravex.js" as Tetravex

// Tetravex, after GNOME Tetravex (see logic/tetravex.js). Score is puzzles
// solved; the clock is just for bragging.
Engine.GameBase {
  id: root
  gameId: "tetravex"
  title: "TETRAVEX"
  helpText: "Move every tile from the right onto the left board so touching edges match · ARROWS move (across both halves) · SPACE pick up / put down (swaps with what's there) · S size 2-5 · U undo"
  mouseHelp: "Click a tile to pick it up and click where it goes, or drag it there"

  property var state: null
  property int size: 3
  tickInterval: 1000
  ticking: !!state && !over
  score: state ? state.solved : 0
  progress: score ? score + " solved" : ""
  overTitle: state ? "SOLVED IN " + clock(state.time) : ""
  status: !state ? ""
    : over ? "SOLVED  ·  SPACE for the next one"
    : paused ? "PAUSED"
    : (state.held >= 0 ? "HOLDING A TILE  ·  " : "") + state.n + "×" + state.n + "  ·  " + clock(state.time) + "  ·  " + state.moves + " moves"

  function clock(t) { var m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ":" + (s < 10 ? "0" : "") + s }

  onTick: state = Tetravex.tick(state, 1)
  onStateChanged: over = !!state && state.done

  function newGame() { state = Tetravex.makeState(size, state ? state.solved : 0); paused = false }
  function moveCursor(dx, dy) { if (state && !over) state = Tetravex.moveCursor(state, dx, dy) }
  function activate() {
    if (!state) return
    if (over) { newGame(); return }
    state = Tetravex.activate(state)
  }
  function undo() { if (state) state = Tetravex.undo(state) }

  function handleKey(key, text) {
    if (!state || !text || text.toLowerCase() !== "s") return false
    var i = Tetravex.SIZES.indexOf(size)
    size = Tetravex.SIZES[(i + 1) % Tetravex.SIZES.length]
    newGame()
    return true
  }

  function saveState() { return state ? Tetravex.serialize(state) : null }

  function loadState(saved) {
    var r = Tetravex.deserialize(saved)
    if (r && !r.done) { size = r.n; state = r; paused = false }
    else { if (r) size = r.n; state = r; newGame() }
  }

  // Mouse (engine/Pointer.qml): click a tile to pick it up and click where
  // it goes, or drag it there.
  function slotAt(x, y) {
    var c = board.cell, n = state.n, row = Math.floor(y / c)
    if (row < 0 || row >= n) return null
    var gx = x / c
    if (gx >= 0 && gx < n) return { side: 0, x: Math.floor(gx), y: row }
    gx -= n + board.gap
    if (gx >= 0 && gx < n) return { side: 1, x: Math.floor(gx), y: row }
    return null
  }
  function pointer(kind, x, y, b) {
    if (!state || over) return
    var at = slotAt(x, y)
    if (!at || kind === "wheel") return
    var here = at.side * state.n + at.x, cur = state.cursor.side * state.n + state.cursor.x
    if (here !== cur || at.y !== state.cursor.y) state = Tetravex.moveCursor(state, here - cur, at.y - state.cursor.y)
    if (kind === "press" && b === Qt.LeftButton) state = Tetravex.activate(state)
    // Letting go somewhere else finishes a drag.
    if (kind === "release" && state.held >= 0 && Tetravex.slotOf(state, state.cursor) !== state.held) state = Tetravex.activate(state)
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property int n: root.state ? root.state.n : 3
    readonly property real gap: 0.5
    readonly property real cell: Math.floor(Math.min(parent.width / (n * 2 + gap), parent.height / n))
    width: cell * (n * 2 + gap)
    height: cell * n

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onOverChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    function slotXY(side, x, y) { return [(side * (n + gap) + x) * cell, y * cell] }

    function tile(ctx, t, px, py, c, bad) {
      var cx = px + c / 2, cy = py + c / 2, pad = 2
      var tri = [[[px + pad, py + pad], [px + c - pad, py + pad]], [[px + c - pad, py + pad], [px + c - pad, py + c - pad]],
                 [[px + c - pad, py + c - pad], [px + pad, py + c - pad]], [[px + pad, py + c - pad], [px + pad, py + pad]]]
      var lab = [[cx, py + c * 0.2], [px + c * 0.8, cy], [cx, py + c * 0.8], [px + c * 0.2, cy]]
      ctx.font = "bold " + Math.floor(c * 0.2) + "px " + theme.fontFamily
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      for (var e = 0; e < 4; ++e) {
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tri[e][0][0], tri[e][0][1]); ctx.lineTo(tri[e][1][0], tri[e][1][1]); ctx.closePath()
        ctx.fillStyle = theme.withAlpha(theme.tone(t[e]), 0.75); ctx.fill()
        ctx.strokeStyle = theme.withAlpha(theme.background, 0.6); ctx.lineWidth = 1; ctx.stroke()
        ctx.fillStyle = theme.background
        ctx.fillText(String(t[e]), lab[e][0], lab[e][1])
      }
      ctx.strokeStyle = bad ? theme.danger : theme.withAlpha(theme.foreground, 0.4)
      ctx.lineWidth = bad ? 3 : 1
      ctx.strokeRect(px + 1, py + 1, c - 2, c - 2)
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state, c = cell, bad = Tetravex.mismatches(s)
      for (var side = 0; side < 2; ++side)
        for (var y = 0; y < n; ++y)
          for (var x = 0; x < n; ++x) {
            var xy = slotXY(side, x, y), slot = side * n * n + y * n + x
            ctx.fillStyle = side === 0 ? theme.withAlpha(theme.foreground, 0.06) : theme.withAlpha(theme.foreground, 0.02)
            ctx.fillRect(xy[0] + 1, xy[1] + 1, c - 2, c - 2)
            var t = s.slots[slot]
            if (t >= 0) {
              if (s.held === slot) ctx.globalAlpha = 0.35
              tile(ctx, s.tiles[t], xy[0], xy[1], c, side === 0 && bad[slot])
              ctx.globalAlpha = 1
            }
          }
      if (!root.over) {
        var cxy = slotXY(s.cursor.side, s.cursor.x, s.cursor.y)
        ctx.strokeStyle = s.held >= 0 ? theme.accent : theme.highlight; ctx.lineWidth = 4
        ctx.strokeRect(cxy[0] + 3, cxy[1] + 3, c - 6, c - 6)
        if (s.held >= 0) {
          ctx.globalAlpha = 0.85
          tile(ctx, s.tiles[s.slots[s.held]], cxy[0] + c * 0.2, cxy[1] + c * 0.2, c * 0.6, false)
          ctx.globalAlpha = 1
        }
      }
      if (root.paused) {
        ctx.fillStyle = theme.background
        ctx.globalAlpha = 0.9
        ctx.fillRect(0, 0, width, height)
        ctx.globalAlpha = 1.0
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
