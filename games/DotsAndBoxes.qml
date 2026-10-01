import QtQuick
import "../engine" as Engine
import "logic/dotsboxes.js" as Dots

// Dots and Boxes, after KSquares (see logic/dotsboxes.js). You go first.
// Score is games won.
Engine.GameBase {
  id: root
  gameId: "dotsboxes"
  title: "DOTS AND BOXES"
  helpText: "Take turns drawing lines; close a box to own it and go again · most boxes wins · ARROWS pick a line · SPACE draw it · D difficulty easy/normal (new game) · careful: the third side of a box hands it over"
  mouseHelp: "Hover picks the nearest line, click draws it"

  property var state: null
  score: state ? state.wins : 0
  readonly property int mine: state ? Dots.count(state, 1) : 0
  readonly property int theirs: state ? Dots.count(state, 2) : 0
  overTitle: mine > theirs ? "YOU WIN " + mine + "–" + theirs : theirs > mine ? "AI WINS " + theirs + "–" + mine : "DRAW"
  status: !state ? ""
    : over ? overTitle + "  ·  SPACE for a new game"
    : paused ? "PAUSED"
    : (state.turnNote ? state.turnNote.toUpperCase() + "  ·  " : "") + ["EASY", "NORMAL"][state.level]
      + "  ·  YOU " + mine + "  ·  AI " + theirs

  onStateChanged: over = !!state && state.done

  function newGame() {
    state = state ? Dots.makeState(state.level, state.wins, state.losses) : Dots.makeState(1)
    paused = false
  }
  function moveCursor(dx, dy) { if (state && !over) state = Dots.moveCursor(state, dx, dy) }
  function activate() {
    if (!state) return
    if (over) { newGame(); return }
    state = Dots.play(state)
  }
  function handleKey(key, text) {
    if (!state || !text || text.toLowerCase() !== "d") return false
    state = Dots.makeState((state.level + 1) % 2, state.wins, state.losses)
    paused = false
    return true
  }
  function saveState() { return state ? Dots.serialize(state) : null }
  function loadState(saved) {
    var r = Dots.deserialize(saved)
    if (r && !r.done) { state = r; paused = false }
    else { state = r; newGame() }
  }

  // Mouse (engine/Pointer.qml): hover picks the nearest line, click draws it.
  function pointer(kind, x, y, b) {
    if (!state || over || (kind !== "move" && kind !== "press")) return
    var c = board.cell, o = c * 0.3, u = (x - o) / c, v = (y - o) / c, best = -1, bd = 1e9
    for (var e = 0; e < Dots.E; ++e) {
      var m = Dots.mid(e), d = (m.x - u) * (m.x - u) + (m.y - v) * (m.y - v)
      if (d < bd) { bd = d; best = e }
    }
    if (best < 0 || bd > 0.36) return
    if (best !== state.cursor) state = Dots.setCursor(state, best)
    if (kind === "press" && b === Qt.LeftButton) state = Dots.play(state)
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property real cell: Math.floor(Math.min(parent.width, parent.height) / (Math.max(Dots.W, Dots.H) + 0.6))
    width: cell * (Dots.W + 0.6)
    height: cell * (Dots.H + 0.6)

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
      var s = root.state, c = cell, o = c * 0.3
      // Owned boxes.
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.font = "bold " + Math.floor(c * 0.3) + "px " + theme.fontFamily
      for (var b = 0; b < Dots.W * Dots.H; ++b) {
        if (!s.owner[b]) continue
        var bx = o + (b % Dots.W) * c, by = o + Math.floor(b / Dots.W) * c
        ctx.fillStyle = theme.withAlpha(s.owner[b] === 1 ? theme.accent : theme.tone(1), 0.3)
        ctx.fillRect(bx + 3, by + 3, c - 6, c - 6)
        ctx.fillStyle = s.owner[b] === 1 ? theme.accent : theme.tone(1)
        ctx.fillText(s.owner[b] === 1 ? "YOU" : "AI", bx + c / 2, by + c / 2)
      }
      // Lines: yours, the AI's (its latest brighter), and the cursor.
      ctx.lineCap = "round"
      for (var e = 0; e < Dots.E; ++e) {
        var m = Dots.mid(e), horiz = e < Dots.HC
        var ax = o + (horiz ? m.x - 0.5 : m.x) * c, ay = o + (horiz ? m.y : m.y - 0.5) * c
        var ex = o + (horiz ? m.x + 0.5 : m.x) * c, ey = o + (horiz ? m.y : m.y + 0.5) * c
        if (s.edges[e]) {
          var recent = s.last.indexOf(e) >= 0
          ctx.strokeStyle = s.edges[e] === 1 ? theme.accent : (recent ? theme.foreground : theme.tone(1))
          ctx.lineWidth = Math.max(3, c * (recent ? 0.09 : 0.07))
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ex, ey); ctx.stroke()
        } else if (e === s.cursor && !root.over) {
          ctx.strokeStyle = theme.withAlpha(theme.highlight, 0.7)
          ctx.lineWidth = Math.max(3, c * 0.07)
          ctx.beginPath(); ctx.moveTo(ax + c * 0.12 * (horiz ? 1 : 0), ay + c * 0.12 * (horiz ? 0 : 1))
          ctx.lineTo(ex - c * 0.12 * (horiz ? 1 : 0), ey - c * 0.12 * (horiz ? 0 : 1)); ctx.stroke()
        }
      }
      if (!root.over && s.edges[s.cursor]) {
        var cm = Dots.mid(s.cursor)
        ctx.strokeStyle = theme.highlight; ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(o + cm.x * c, o + cm.y * c, c * 0.14, 0, Math.PI * 2); ctx.stroke()
      }
      ctx.fillStyle = theme.foreground
      for (var y = 0; y <= Dots.H; ++y)
        for (var x = 0; x <= Dots.W; ++x) { ctx.beginPath(); ctx.arc(o + x * c, o + y * c, Math.max(3, c * 0.06), 0, Math.PI * 2); ctx.fill() }
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
