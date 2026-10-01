import QtQuick
import Quickshell.Io
import "../engine" as Engine
import "logic/wordhunt.js" as WordHunt

// Word Hunt (after Boggle): find words in a 4x4 grid of letters before three
// minutes run out. Type a word and press ENTER (the game finds the path for
// you), or drag across touching tiles. Diagonals count; a tile is used once
// per word; three letters or more. The Qu tile counts as two letters.
Engine.GameBase {
  id: root
  gameId: "wordhunt"
  title: "WORD HUNT"
  helpText: "Type a word (3+ letters) and ENTER to score it · BACKSPACE deletes · tiles must touch, diagonals too, none used twice · Qu is one tile · 3-4 letters 1 point, 5 → 2, 6 → 3, 7 → 5, 8+ → 11 · Esc closes; letters go to the word, so use the mouse or the game list for the rest · once time is up, N or SPACE for a new board · Dictionary: ENABLE (public domain)"
  mouseHelp: "Press a tile and drag across touching tiles, let go to submit; RIGHT-click clears the word"

  property var state: null
  property var words: []
  property var pendingSave: null
  property bool hasPendingSave: false
  property var trace: []          // tiles being dragged over

  tickInterval: 1000
  ticking: !!state && !over && words.length > 0
  score: state ? state.score : 0
  progress: state && state.found.length ? state.found.length + " words" : ""
  overTitle: state ? state.found.length + " WORDS · " + state.score + " POINTS" : ""
  status: !words.length ? "LOADING WORDS…"
    : !state ? ""
    : paused ? "PAUSED"
    : over ? (state.found.length + " of " + state.total + " words  ·  " + state.score + " points  ·  SPACE for a new board")
    : (state.note ? state.note + "  ·  " : "") + Math.floor(state.timeLeft / 60) + ":" + ("0" + Math.floor(state.timeLeft % 60)).slice(-2)
      + "  ·  " + state.found.length + " words  ·  " + state.score + " pts"

  onStateChanged: if (state && state.over) over = true
  onTick: if (state && !over) state = WordHunt.tick(state, 1)

  FileView {
    path: String(Qt.resolvedUrl("data/wordhunt.txt")).replace(/^file:\/\//, "")
    printErrors: true
    onLoaded: {
      var list = text().split("\n")
      var out = []
      for (var i = 0; i < list.length; ++i) if (list[i].length) out.push(list[i])
      root.words = out
      if (root.hasPendingSave) { root.hasPendingSave = false; root.loadState(root.pendingSave); root.pendingSave = null }
      else if (!root.state) root.newGame()
    }
  }

  function newGame() {
    if (!words.length) return
    state = WordHunt.makeState(words)
    trace = []
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {}

  function activate() {
    if (!state) return
    if (over) { newGame(); return }
    state = WordHunt.submit(state, words)
  }

  function handleKey(key, text) {
    if (!state || over || !words.length) return false
    if (key === Qt.Key_Backspace || key === Qt.Key_Delete) { state = WordHunt.backspace(state); return true }
    if (key === Qt.Key_Return || key === Qt.Key_Enter) { state = WordHunt.submit(state, words); return true }
    var t = text ? text.toLowerCase() : ""
    if (/^[a-z]$/.test(t)) { state = WordHunt.type(state, t); return true }
    return false
  }

  function saveState() {
    if (!words.length) return pendingSave
    if (!state || over) return null
    return WordHunt.serialize(state)
  }
  function loadState(saved) {
    if (!words.length) { pendingSave = saved; hasPendingSave = true; return }
    var r = WordHunt.deserialize(saved, words)
    if (r && !r.over) { state = r; over = false } else newGame()
  }

  function tileAt(x, y) {
    var g = board.geo
    if (!g) return -1
    var cx = (x - g.ox) / g.cell, cy = (y - g.oy) / g.cell
    var ix = Math.floor(cx), iy = Math.floor(cy)
    if (ix < 0 || iy < 0 || ix > 3 || iy > 3) return -1
    // only the middle of a tile counts, so diagonal drags are forgiving
    if (Math.abs(cx - ix - 0.5) > 0.36 || Math.abs(cy - iy - 0.5) > 0.36) return -2
    return iy * 4 + ix
  }

  function pointer(kind, x, y, b) {
    if (!state || over) return
    if (kind === "press") {
      if (b === Qt.RightButton) { trace = []; state = WordHunt.clear(state); return }
      var t = tileAt(x, y)
      trace = t >= 0 ? [t] : []
    } else if (kind === "drag") {
      if (!trace.length) return
      var n = tileAt(x, y)
      if (n < 0) return
      var last = trace[trace.length - 1]
      if (n === last) return
      var prev = trace.length > 1 ? trace[trace.length - 2] : -1
      if (n === prev) trace = trace.slice(0, -1)
      else if (trace.indexOf(n) < 0 && WordHunt.adjacent(last, n)) trace = trace.concat([n])
    } else if (kind === "release") {
      if (trace.length >= 1) state = WordHunt.submitWord(state, WordHunt.wordOfCells(state, trace), words)
      trace = []
    }
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.fill: parent

    readonly property var geo: {
      var wide = width > height * 1.15
      var side = wide ? Math.min(height * 0.86, width * 0.56) : Math.min(width * 0.94, height * 0.6)
      var ox = wide ? Math.floor(width * 0.03) : Math.floor((width - side) / 2)
      var oy = wide ? Math.floor((height - side) / 2) : Math.floor(height * 0.14)
      return { wide: wide, side: side, cell: side / 4, ox: ox, oy: oy }
    }

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onTraceChanged() { board.requestPaint() }
      function onOverChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state, g = board.geo
      if (g.side <= 0) return
      var c = g.cell, gap = Math.max(3, c * 0.06)
      // the path to highlight: the drag, or wherever the typed word can be traced
      var hl = root.trace.length ? root.trace : (s.typed ? (WordHunt.findPath(s.board, s.typed) || []) : [])
      var order = {}
      for (var h = 0; h < hl.length; ++h) order[hl[h]] = h + 1
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      for (var i = 0; i < 16; ++i) {
        var x = g.ox + (i % 4) * c + gap / 2, y = g.oy + Math.floor(i / 4) * c + gap / 2, sz = c - gap
        var on = order[i] > 0
        ctx.fillStyle = on ? theme.accent : theme.faint
        ctx.globalAlpha = on ? 1 : 0.9
        ctx.fillRect(x, y, sz, sz)
        ctx.globalAlpha = 1
        ctx.fillStyle = on ? theme.background : theme.foreground
        var t = s.board[i]
        ctx.font = "bold " + Math.floor(sz * (t.length > 1 ? 0.5 : 0.62)) + "px " + theme.fontFamily
        ctx.fillText(t.length > 1 ? "Qu" : t.toUpperCase(), x + sz / 2, y + sz / 2 + sz * 0.03)
      }
      if (hl.length > 1) {
        ctx.strokeStyle = theme.highlight; ctx.lineWidth = Math.max(3, c * 0.08); ctx.lineCap = "round"; ctx.lineJoin = "round"
        ctx.beginPath()
        for (var k = 0; k < hl.length; ++k) {
          var px = g.ox + (hl[k] % 4 + 0.5) * c, py = g.oy + (Math.floor(hl[k] / 4) + 0.5) * c
          if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
        }
        ctx.stroke()
      }
      // typed word, then time bar
      var wordX = g.wide ? g.ox + g.side / 2 : width / 2
      var wordY = g.wide ? g.oy - 4 : g.oy - c * 0.45
      var wordTxt = root.trace.length ? WordHunt.wordOfCells(s, root.trace) : s.typed
      ctx.fillStyle = theme.foreground
      ctx.font = "bold " + Math.floor(Math.min(28, c * 0.4)) + "px " + theme.fontFamily
      ctx.fillText(wordTxt.toUpperCase() + (wordTxt && !root.trace.length ? "▏" : ""), wordX, wordY - 6)
      var barW = g.side, barX = g.ox
      ctx.fillStyle = theme.faint; ctx.fillRect(barX, g.oy + g.side + 8, barW, 6)
      ctx.fillStyle = s.timeLeft < 20 ? theme.danger : theme.accent
      ctx.fillRect(barX, g.oy + g.side + 8, barW * Math.max(0, s.timeLeft / WordHunt.ROUND), 6)
      // found words
      var lx = g.wide ? g.ox + g.side + Math.floor(width * 0.04) : g.ox
      var ly = g.wide ? g.oy : g.oy + g.side + 30
      var lw = g.wide ? width - lx - 10 : g.side
      var lh = g.wide ? g.side : height - ly - 8
      ctx.textAlign = "left"; ctx.textBaseline = "top"
      ctx.font = "bold 13px " + theme.fontFamily
      ctx.fillStyle = theme.dim
      ctx.fillText(root.over ? "LONGEST WORDS YOU MISSED" : "FOUND  " + s.found.length + (s.total ? " / " + s.total : ""), lx, ly)
      ctx.font = "14px " + theme.fontFamily
      var list = root.over ? WordHunt.missed(s, 60) : s.found.slice().reverse()
      var rowH = 18, cols = Math.max(1, Math.floor(lw / 110)), perCol = Math.max(1, Math.floor((lh - 24) / rowH))
      for (var w = 0; w < list.length && w < cols * perCol; ++w) {
        var colI = Math.floor(w / perCol), rowI = w % perCol
        ctx.fillStyle = root.over ? theme.dim : (WordHunt.points(list[w]) >= 3 ? theme.accent : theme.foreground)
        ctx.fillText(list[w], lx + colI * 110, ly + 22 + rowI * rowH)
      }
      if (root.paused || root.over) {
        ctx.fillStyle = theme.background
        ctx.globalAlpha = root.paused ? 0.7 : 0.25
        ctx.fillRect(g.ox - 4, g.oy - 4, g.side + 8, g.side + 8)
        ctx.globalAlpha = 1
      }
    }
  }

  Component.onCompleted: {}
}
