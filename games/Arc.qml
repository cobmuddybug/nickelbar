import QtQuick
import Quickshell.Io
import "../engine" as Engine
import "logic/arc.js" as Arc

// ARC-AGI-1 puzzles (see logic/arc.js). Study the examples, paint the
// answer, S to check. Score is puzzles solved.
//
// The one game here that doesn't take its colours from the theme: ARC's ten
// colours carry meaning (0 is usually the background), so they stay as the
// puzzles define them. The frame, cursor and text still follow the theme.
Engine.GameBase {
  id: root
  gameId: "arc"
  title: "ARC"
  helpText: "Work out the rule from the examples, then paint the test output · ARROWS move · 0-9 paint that colour · SPACE paint again · F fill · C copy the input · X clear · Z resize (arrows change size, Z done) · S check · , . examples · < > puzzles · R random · N next unsolved · U undo · Puzzles: ARC-AGI-1 by François Chollet (Apache 2.0)"
  mouseHelp: "Click or drag over the answer grid to paint with the brush, right-click to paint background (0), click a palette swatch to pick the brush; the wheel steps through the examples"

  property var puzzles: []
  property var solvedIds: ({})
  property var state: null
  property var pendingSave: null
  property bool pendingNew: false

  readonly property var puzzle: state && puzzles.length ? puzzles[state.idx] : null
  readonly property int solvedCount: Object.keys(solvedIds).length
  readonly property var palette: ["#000000", "#0074D9", "#FF4136", "#2ECC40", "#FFDC00",
                                  "#AAAAAA", "#F012BE", "#FF851B", "#7FDBFF", "#870C25"]

  score: solvedCount
  progress: solvedCount ? solvedCount + "/" + puzzles.length + " solved" : ""
  overTitle: "SOLVED" + (state && state.tries > 1 ? " IN " + state.tries + " TRIES" : " FIRST TRY")
  status: !puzzles.length ? "LOADING PUZZLES…"
    : !state ? ""
    : (over ? "SOLVED  ·  SPACE or N for the next one"
      : (paused ? "PAUSED"
        : (state.note ? state.note.toUpperCase() + "  ·  " : "")
          + (state.resizing ? "RESIZING " + state.out.w + "×" + state.out.h + " · arrows · Z done"
            : setLabel() + "  ·  " + state.id + (solvedIds[state.id] ? " ✓" : "")
              + (state.tries ? "  ·  " + state.tries + " tr" + (state.tries === 1 ? "y" : "ies") : ""))))

  function setLabel() {
    var p = puzzles[state.idx], n = 0, total = 0
    for (var i = 0; i < puzzles.length; ++i) {
      if (puzzles[i].set !== p.set) continue
      total++
      if (i <= state.idx) n++
    }
    return (p.set === "t" ? "TRAINING " : "EVALUATION ") + n + "/" + total
  }

  FileView {
    id: dataFile
    path: String(Qt.resolvedUrl("data/arc1.json")).replace(/^file:\/\//, "")
    printErrors: true
    onLoaded: {
      try { root.puzzles = JSON.parse(text()).puzzles } catch (e) { root.puzzles = [] }
      if (root.pendingSave) { root.loadState(root.pendingSave); root.pendingSave = null }
      else if (root.pendingNew || !root.state) root.newGame()
    }
  }

  function open(idx) {
    state = Arc.start(puzzles[idx], idx)
    over = false
    paused = false
  }

  // N (and SPACE after a solve): the next puzzle not yet solved.
  function newGame() {
    if (!puzzles.length) { pendingNew = true; return }
    pendingNew = false
    open(state ? Arc.nextUnsolved(puzzles, state.idx, solvedIds, 1) : Arc.nextUnsolved(puzzles, -1, solvedIds, 1))
  }

  function moveCursor(dx, dy) {
    if (over || !state) return
    state = Arc.moveCursor(state, dx, dy)
  }

  function activate() {
    if (!state) return
    if (over) { newGame(); return }
    state = Arc.paint(state)
  }

  function undo() { if (state && !over) state = Arc.undo(state) }

  function check() {
    state = Arc.submit(state, puzzle)
    if (state.solved) {
      var next = {}
      for (var k in solvedIds) next[k] = true
      next[state.id] = true
      solvedIds = next
      over = true
    }
  }

  function handleKey(key, text) {
    if (!state || !puzzle) return false
    var t = text ? text.toLowerCase() : ""
    // Puzzle navigation works even on the solved card.
    if (text === ">" || text === "<") { open((state.idx + (text === ">" ? 1 : -1) + puzzles.length) % puzzles.length); return true }
    if (t === "r") { open(Arc.randomUnsolved(puzzles, solvedIds)); return true }
    if (text === "." || text === ",") { state = Arc.setExample(state, puzzle, text === "." ? 1 : -1); return true }
    if (over) return false
    if (text.length === 1 && text >= "0" && text <= "9") { state = Arc.paint(state, text.charCodeAt(0) - 48); return true }
    if (t === "f") { state = Arc.fill(state); return true }
    if (t === "c") { state = Arc.copyInput(state, puzzle); return true }
    if (t === "x") { state = Arc.clear(state); return true }
    if (t === "z") { state = Arc.toggleResize(state); return true }
    if (t === "s") { check(); return true }
    return false
  }

  function saveState() {
    if (!state) return pendingSave
    var ids = Object.keys(solvedIds)
    return { current: Arc.serialize(state), solved: ids }
  }

  function loadState(saved) {
    if (!puzzles.length) { pendingSave = saved; return }
    var ids = {}
    if (saved && saved.solved) for (var i = 0; i < saved.solved.length; ++i) ids[saved.solved[i]] = true
    solvedIds = ids
    var cur = saved && saved.current
    var restored = cur && cur.idx >= 0 && cur.idx < puzzles.length ? Arc.deserialize(cur, puzzles[cur.idx]) : null
    if (restored && !restored.solved) { state = restored; over = false; paused = false }
    else { state = null; newGame() }
  }

  // Mouse (engine/Pointer.qml): click or drag over the answer grid to paint
  // with the brush, right-click to paint background (0), click a palette
  // swatch to pick the brush; the wheel steps through the examples.
  function pointer(kind, x, y, b) {
    if (!state || over || state.resizing) return
    if (kind === "wheel") { state = Arc.setExample(state, puzzle, -b); return }
    if (kind !== "press" && kind !== "drag") return
    var sw = board.swatches
    if (kind === "press") for (var k = 0; k < sw.length; ++k)
      if (x >= sw[k].x && x <= sw[k].x + sw[k].w && y >= sw[k].y - sw[k].w * 0.2 && y <= sw[k].y + sw[k].w) { state = Arc.setBrush(state, k); return }
    var o = board.outGrid
    if (!o || !state.out) return
    var cx = Math.floor((x - o.x) / o.c), cy = Math.floor((y - o.y) / o.c)
    if (cx < 0 || cy < 0 || cx >= state.out.w || cy >= state.out.h) return
    state = Arc.moveCursor(state, cx - state.cursor.x, cy - state.cursor.y)
    // Right button paints 0 but leaves the brush as it was.
    var right = b === Qt.RightButton || (kind === "drag" && (b & Qt.RightButton)), brush = state.brush
    state = right ? Arc.setBrush(Arc.paint(state, 0), brush) : Arc.paint(state)
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    anchors.fill: parent
    Engine.Pointer { game: root; shape: Qt.CrossCursor }
    // Where onPaint put the answer grid and the palette, for the mouse.
    property var outGrid: null
    property var swatches: []

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onOverChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
      function onPuzzlesChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    // Draws grid `g` with its top-left at (x, y), `c` px a cell.
    function grid(ctx, g, x, y, c, outline) {
      for (var gy = 0; gy < g.h; ++gy)
        for (var gx = 0; gx < g.w; ++gx) {
          ctx.fillStyle = root.palette[g.cells[gy * g.w + gx]]
          ctx.fillRect(x + gx * c, y + gy * c, c, c)
        }
      if (c >= 6) {
        ctx.strokeStyle = theme.withAlpha(theme.foreground, 0.16)
        ctx.lineWidth = 1
        ctx.beginPath()
        for (var i = 1; i < g.w; ++i) { ctx.moveTo(x + i * c + 0.5, y); ctx.lineTo(x + i * c + 0.5, y + g.h * c) }
        for (var j = 1; j < g.h; ++j) { ctx.moveTo(x, y + j * c + 0.5); ctx.lineTo(x + g.w * c, y + j * c + 0.5) }
        ctx.stroke()
      }
      ctx.strokeStyle = outline || theme.withAlpha(theme.foreground, 0.4)
      ctx.lineWidth = outline ? 2 : 1
      ctx.strokeRect(x - 0.5, y - 0.5, g.w * c + 1, g.h * c + 1)
    }

    // Two grids side by side with an arrow between, centred in a band.
    // Returns the right-hand grid's origin and cell size.
    function pair(ctx, a, b, top, bandH, label, bOutline) {
      var pad = 8, arrowW = Math.max(18, width * 0.05)
      var labelH = Math.max(12, bandH * 0.08)
      var availW = (width - pad * 2 - arrowW) / 2 - pad, availH = bandH - labelH - pad
      var c = Math.max(2, Math.floor(Math.min(availW / Math.max(a.w, b.w), availH / Math.max(a.h, b.h))))
      var y = top + labelH + (availH - Math.max(a.h, b.h) * c) / 2
      var ax = width / 2 - arrowW / 2 - a.w * c, bx = width / 2 + arrowW / 2
      grid(ctx, a, ax, y + (Math.max(a.h, b.h) - a.h) * c / 2, c)
      var by = y + (Math.max(a.h, b.h) - b.h) * c / 2
      grid(ctx, b, bx, by, c, bOutline)
      ctx.fillStyle = theme.dim
      ctx.font = "bold " + Math.floor(Math.min(arrowW * 0.8, 22)) + "px " + theme.fontFamily
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.fillText("→", width / 2, y + Math.max(a.h, b.h) * c / 2)
      ctx.font = "bold " + Math.floor(labelH * 0.8) + "px " + theme.fontFamily
      ctx.textAlign = "left"; ctx.textBaseline = "top"
      ctx.fillText(label, pad, top)
      return { x: bx, y: by, c: c }
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state || !root.puzzle) return
      var s = root.state, p = root.puzzle

      var swatchH = Math.max(18, height * 0.06)
      var bodyH = height - swatchH - 8
      var exH = bodyH * 0.44
      var ex = p.train[s.example]
      pair(ctx, Arc.decode(ex[0]), Arc.decode(ex[1]), 0, exH,
        "EXAMPLE " + (s.example + 1) + "/" + p.train.length + "   , .")

      // Divider between the examples and the test.
      ctx.strokeStyle = theme.faint
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(8, exH + 2); ctx.lineTo(width - 8, exH + 2); ctx.stroke()

      var o = pair(ctx, Arc.decode(p.test[0]), s.out, exH + 6, bodyH - exH - 6,
        "TEST  →  YOUR ANSWER" + (s.out ? "  " + s.out.w + "×" + s.out.h : ""),
        s.resizing ? theme.accent : (root.over ? theme.accent : theme.withAlpha(theme.foreground, 0.6)))

      board.outGrid = o
      // Cursor.
      if (!root.over) {
        ctx.strokeStyle = theme.background
        ctx.lineWidth = 4
        ctx.strokeRect(o.x + s.cursor.x * o.c + 1, o.y + s.cursor.y * o.c + 1, o.c - 2, o.c - 2)
        ctx.strokeStyle = theme.foreground
        ctx.lineWidth = 2
        ctx.strokeRect(o.x + s.cursor.x * o.c + 1, o.y + s.cursor.y * o.c + 1, o.c - 2, o.c - 2)
      }

      // Palette strip: digit keys, current brush lifted.
      var sw = Math.min(swatchH, (width - 16) / 11)
      var sx0 = (width - sw * 10 - (sw * 0.15) * 9) / 2, sy = height - swatchH
      ctx.font = "bold " + Math.floor(sw * 0.45) + "px " + theme.fontFamily
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      var spots = []
      for (var k = 0; k < 10; ++k) {
        var x = sx0 + k * sw * 1.15, lift = k === s.brush ? sw * 0.15 : 0
        spots.push({ x: x, y: sy, w: sw })
        ctx.fillStyle = root.palette[k]
        ctx.fillRect(x, sy - lift, sw, sw)
        ctx.strokeStyle = k === s.brush ? theme.accent : theme.withAlpha(theme.foreground, 0.35)
        ctx.lineWidth = k === s.brush ? 3 : 1
        ctx.strokeRect(x, sy - lift, sw, sw)
        ctx.fillStyle = k === 4 || k === 5 || k === 8 || k === 3 ? "#000000" : "#ffffff"
        ctx.fillText(String(k), x + sw / 2, sy - lift + sw / 2)
      }
      board.swatches = spots
      ctx.textAlign = "right"; ctx.fillStyle = theme.dim
      ctx.font = Math.floor(sw * 0.4) + "px " + theme.fontFamily
      ctx.fillText(root.solvedCount + " solved", width - 8, sy + sw / 2)

      if (root.paused) {
        ctx.fillStyle = theme.background
        ctx.globalAlpha = 0.7
        ctx.fillRect(0, 0, width, height)
        ctx.globalAlpha = 1.0
      }
    }
  }

  Component.onCompleted: if (!state && puzzles.length) newGame()
}
