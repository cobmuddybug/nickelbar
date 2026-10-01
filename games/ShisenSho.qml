import QtQuick
import "../engine" as Engine
import "logic/shisen.js" as Shisen
import "logic/mahjong.js" as Mahjong

// Shisen-Sho, after KShisen (see logic/shisen.js). Tiles are drawn as in
// Mahjong.qml. Score is boards cleared.
Engine.GameBase {
  id: root
  gameId: "shisen"
  title: "SHISEN-SHO"
  helpText: "Remove matching pairs that can be joined by a line with at most two turns through empty space (it may go round the outside) · ARROWS move · SPACE pick a tile, SPACE its twin · I hint · X shuffle when stuck · S size · U undo"
  mouseHelp: "Hover moves the cursor, LEFT does what SPACE does"

  property var state: null
  property int size: 0
  tickInterval: 1000
  ticking: !!state && !over
  score: state ? state.cleared : 0
  progress: score ? score + " cleared" : ""
  overTitle: state ? "CLEARED IN " + clock(state.time) : ""
  status: !state ? ""
    : over ? "CLEARED  ·  SPACE for a new board"
    : paused ? "PAUSED"
    : (state.note ? state.note.toUpperCase() + "  ·  " : "") + Shisen.left(state) + " tiles  ·  " + clock(state.time)
      + (state.shuffles ? "  ·  " + state.shuffles + " shuffles" : "")

  function clock(t) { var m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ":" + (s < 10 ? "0" : "") + s }

  onTick: state = Shisen.tick(state, 1)
  onStateChanged: over = !!state && state.done

  function newGame() { state = Shisen.makeState(size, state ? state.cleared : 0); paused = false }
  function moveCursor(dx, dy) { if (state && !over) state = Shisen.moveCursor(state, dx, dy) }
  function activate() {
    if (!state) return
    if (over) { newGame(); return }
    state = Shisen.activate(state)
  }
  function undo() { if (state) state = Shisen.undo(state) }
  function handleKey(key, text) {
    if (!state) return false
    var t = text ? text.toLowerCase() : ""
    if (t === "s") { size = (size + 1) % Shisen.SIZES.length; newGame(); return true }
    if (over) return false
    if (t === "i") { state = Shisen.hint(state); return true }
    if (t === "x") { state = Shisen.shuffle(state); return true }
    return false
  }
  function saveState() { return state ? Shisen.serialize(state) : null }
  function loadState(saved) {
    if (saved && saved.size >= 0 && saved.size < Shisen.SIZES.length) size = saved.size
    var r = Shisen.deserialize(saved)
    if (r) { state = r; paused = false }
    else { state = saved && saved.cleared ? { cleared: saved.cleared } : null; newGame() }
  }

  // Mouse (engine/Pointer.qml): hover moves the cursor, LEFT does what
  // SPACE does.
  function pointer(kind, x, y, b) {
    if (!state || over) return
    if (kind !== "move" && kind !== "press") return
    var cx = Math.floor((x - (board.tw / 2)) / (board.tw)), cy = Math.floor((y - (board.th / 2)) / (board.th))
    if (cx < 0 || cy < 0 || cx >= state.w || cy >= state.h) return
    if (cx !== state.cursor.x || cy !== state.cursor.y) moveCursor(cx - state.cursor.x, cy - state.cursor.y)
    if (kind !== "press" || b === Qt.MiddleButton) return
    if (b === Qt.RightButton) return
    activate()
  }

  Engine.Theme { id: theme }

  function faceColor(f) {
    var suit = Mahjong.suitOf(f)
    if (suit === "dots") return theme.tone(0)
    if (suit === "bamboo") return theme.tone(2)
    if (suit === "chars") return theme.tone(1)
    if (suit === "dragon") return Mahjong.rankOf(f) === 0 ? theme.danger : Mahjong.rankOf(f) === 1 ? theme.tone(4) : theme.dim
    return theme.foreground
  }
  readonly property var winds: ["E", "S", "W", "N"]
  readonly property var dragons: ["中", "發", "白"]
  readonly property var suitMark: ({ dots: "●", bamboo: "竹", chars: "萬" })

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property int cols: root.state ? root.state.w : 12
    readonly property int rows: root.state ? root.state.h : 6
    // Tiles are taller than wide; one padding tile all round for paths.
    readonly property real tw: Math.floor(Math.min(parent.width / (cols + 1), parent.height / ((rows + 1) * 1.3)))
    readonly property real th: Math.floor(tw * 1.3)
    width: tw * (cols + 1)
    height: th * (rows + 1)

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
      var s = root.state, ox = tw / 2, oy = th / 2
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      for (var i = 0; i < s.w * s.h; ++i) {
        var f = s.grid[i]
        if (f < 0) continue
        var x = ox + (i % s.w) * tw, y = oy + Math.floor(i / s.w) * th, w = tw - 2, h = th - 2
        ctx.fillStyle = i === s.sel ? theme.withAlpha(theme.accent, 0.35) : theme.withAlpha(theme.foreground, 0.14)
        ctx.fillRect(x + 1, y + 1, w, h)
        ctx.strokeStyle = theme.withAlpha(theme.foreground, 0.45); ctx.lineWidth = 1
        ctx.strokeRect(x + 1.5, y + 1.5, w - 1, h - 1)
        var suit = Mahjong.suitOf(f), rank = Mahjong.rankOf(f), cx = x + 1 + w / 2, cy = y + 1 + h / 2
        ctx.fillStyle = root.faceColor(f)
        if (suit === "dots" || suit === "bamboo" || suit === "chars") {
          ctx.font = "bold " + Math.floor(tw * 0.5) + "px " + theme.fontFamily
          ctx.fillText(String(rank), cx, cy - h * 0.12)
          ctx.font = Math.floor(tw * 0.3) + "px " + theme.fontFamily
          ctx.fillText(root.suitMark[suit], cx, cy + h * 0.25)
        } else if (suit === "wind") {
          ctx.font = "bold " + Math.floor(tw * 0.6) + "px " + theme.fontFamily
          ctx.fillText(root.winds[rank], cx, cy)
        } else if (rank === 2) {
          ctx.strokeStyle = root.faceColor(f); ctx.lineWidth = Math.max(1.5, tw * 0.06)
          ctx.strokeRect(x + w * 0.22, y + h * 0.2, w * 0.56, h * 0.6)
          ctx.lineWidth = Math.max(1, tw * 0.03)
          ctx.strokeRect(x + w * 0.32, y + h * 0.3, w * 0.36, h * 0.4)
        } else {
          ctx.font = "bold " + Math.floor(tw * 0.6) + "px " + theme.fontFamily
          ctx.fillText(root.dragons[rank], cx, cy)
        }
      }
      // The line from the last match (or a hint).
      if (s.flash) {
        ctx.strokeStyle = theme.highlight; ctx.lineWidth = Math.max(2, tw * 0.08); ctx.lineJoin = "round"
        ctx.beginPath()
        for (var k = 0; k < s.flash.length; ++k) {
          var px = (s.flash[k].x - 1) * tw + ox + tw / 2, py = (s.flash[k].y - 1) * th + oy + th / 2
          if (!k) ctx.moveTo(px, py); else ctx.lineTo(px, py)
        }
        ctx.stroke()
      }
      if (!root.over) {
        ctx.strokeStyle = theme.highlight; ctx.lineWidth = 3
        ctx.strokeRect(ox + s.cursor.x * tw + 1, oy + s.cursor.y * th + 1, tw - 2, th - 2)
      }
      if (root.paused) {
        ctx.fillStyle = theme.background; ctx.globalAlpha = 0.9; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
