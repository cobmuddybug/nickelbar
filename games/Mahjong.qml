import QtQuick
import "../engine" as Engine
import "logic/mahjong.js" as Mahjong

// Mahjong solitaire on the turtle. Every deal can be cleared. Score is
// tiles cleared, less 10 per reshuffle.
Engine.GameBase {
  id: root
  gameId: "mahjong"
  title: "MAHJONG"
  helpText: "Clear matching pairs of free tiles (nothing on top, left or right side open) · any flower matches any flower, same for seasons · ARROWS jump between free tiles · SPACE pick / match · I hint · R reshuffle (−10) · U undo"
  mouseHelp: "Hover a free tile to point at it, click to pick it (and then its match). Laid out exactly as onPaint draws it"

  property var state: null
  score: state ? Mahjong.score(state) : 0
  overTitle: "CLEARED" + (state && state.shuffles ? " · " + state.shuffles + " RESHUFFLES" : "")
  status: !state ? ""
    : (over ? "CLEARED  ·  N for a new deal"
      : (paused ? "PAUSED"
        : (state.note ? state.note.toUpperCase() + "  ·  " : "")
          + (144 - state.removed) + " tiles  ·  " + Mahjong.availableMoves(state) + " moves open"))

  onStateChanged: if (state && Mahjong.isWon(state)) over = true

  function newGame() {
    state = Mahjong.makeState()
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {
    if (over || !state) return
    state = Mahjong.moveCursor(state, dx, dy)
  }

  function activate() {
    if (over) { newGame(); return }
    if (state) state = Mahjong.activate(state)
  }

  function undo() { if (state && !over) state = Mahjong.undo(state) }

  function handleKey(key, text) {
    if (over || !state) return false
    if (text === "i" || text === "I") { state = Mahjong.hint(state); return true }
    if (text === "r" || text === "R") { state = Mahjong.reshuffle(state); return true }
    return false
  }

  function saveState() {
    if (!state || over) return null
    return Mahjong.serialize(state)
  }

  function loadState(saved) {
    var restored = Mahjong.deserialize(saved)
    if (restored) { state = restored; over = false }
    else newGame()
  }

  // Mouse (engine/Pointer.qml): hover a free tile to point at it, click to
  // pick it (and then its match). Laid out exactly as onPaint draws it.
  function tileAt(x, y) {
    var tw = Math.min(board.width / (Mahjong.COLS + 0.8), board.height / (Mahjong.ROWS * 1.3 + 0.8)), th = tw * 1.3
    var lift = tw * 0.12
    var ox = (board.width - tw * Mahjong.COLS) / 2 + lift * 1.5, oy = (board.height - th * Mahjong.ROWS) / 2 + lift * 1.5
    var best = -1, bz = -1
    for (var i = 0; i < Mahjong.LAYOUT.length; ++i) {
      if (!state.alive[i]) continue
      var t = Mahjong.LAYOUT[i], tx = ox + t.x * tw - t.z * lift, ty = oy + t.y * th - t.z * lift
      if (x >= tx && x <= tx + tw - 2 && y >= ty && y <= ty + th - 2 && t.z >= bz) { best = i; bz = t.z }
    }
    return best
  }
  function pointer(kind, x, y, b) {
    if (!state || over || (kind !== "move" && kind !== "press")) return
    var i = tileAt(x, y)
    if (i < 0) return
    state = Mahjong.setCursor(state, i)
    if (kind === "press" && b === Qt.LeftButton && state.cursor === i) activate()
  }

  Engine.Theme { id: theme }

  // Suits get a tone each; honours use the text colour, red dragon the
  // danger colour, as on a real set.
  function faceColor(f) {
    var suit = Mahjong.suitOf(f)
    if (suit === "dots") return theme.tone(0)
    if (suit === "bamboo") return theme.tone(2)
    if (suit === "chars") return theme.tone(1)
    if (suit === "dragon") return Mahjong.rankOf(f) === 0 ? theme.danger : Mahjong.rankOf(f) === 1 ? theme.tone(4) : theme.dim
    if (suit === "flower") return theme.tone(3)
    if (suit === "season") return theme.tone(5)
    return theme.foreground
  }

  readonly property var winds: ["E", "S", "W", "N"]
  readonly property var dragons: ["中", "發", "白"]
  readonly property var suitMark: ({ dots: "●", bamboo: "竹", chars: "萬" })

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.fill: parent

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onOverChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath()
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state
      // Tile size: the 15 x 8 footprint plus room for the stack's lean.
      var tw = Math.min(width / (Mahjong.COLS + 0.8), height / (Mahjong.ROWS * 1.3 + 0.8))
      var th = tw * 1.3
      var lift = tw * 0.12, depth = tw * 0.09
      var ox = (width - tw * Mahjong.COLS) / 2 + lift * 1.5
      var oy = (height - th * Mahjong.ROWS) / 2 + lift * 1.5

      var free = {}
      var fl = Mahjong.freeList(s.alive)
      for (var q = 0; q < fl.length; ++q) free[fl[q]] = true
      var hint = s.hint ? { a: s.hint[0], b: s.hint[1] } : null

      // Bottom layer first; within a layer left to right, top to bottom,
      // so each tile's edge is overlapped by its right-hand neighbour.
      var order = []
      for (var i = 0; i < Mahjong.LAYOUT.length; ++i) if (s.alive[i]) order.push(i)
      order.sort(function(a, b) {
        var A = Mahjong.LAYOUT[a], B = Mahjong.LAYOUT[b]
        return A.z - B.z || A.x - B.x || A.y - B.y
      })

      var r = tw * 0.12
      for (var k = 0; k < order.length; ++k) {
        var idx = order[k], t = Mahjong.LAYOUT[idx], f = s.faces[idx]
        var x = ox + t.x * tw - t.z * lift, y = oy + t.y * th - t.z * lift
        var w = tw - 2, h = th - 2

        // Edge (thickness), then face.
        roundRect(ctx, x + depth, y + depth, w, h, r)
        ctx.fillStyle = theme.withAlpha(theme.foreground, 0.35)
        ctx.fill()
        roundRect(ctx, x, y, w, h, r)
        ctx.fillStyle = theme.background
        ctx.fill()
        roundRect(ctx, x, y, w, h, r)
        var sel = idx === s.selected, isHint = hint && (idx === hint.a || idx === hint.b)
        ctx.fillStyle = sel ? theme.withAlpha(theme.accent, 0.35)
          : isHint ? theme.withAlpha(theme.accent, 0.18)
          : theme.withAlpha(theme.foreground, free[idx] ? 0.16 : 0.07)
        ctx.fill()
        ctx.strokeStyle = theme.withAlpha(theme.foreground, 0.45)
        ctx.lineWidth = 1
        ctx.stroke()

        // Face.
        var suit = Mahjong.suitOf(f), rank = Mahjong.rankOf(f)
        var col = root.faceColor(f)
        if (!free[idx]) col = theme.withAlpha(col, 0.55)
        ctx.fillStyle = col
        ctx.textAlign = "center"; ctx.textBaseline = "middle"
        var cx = x + w / 2, cy = y + h / 2
        if (suit === "dots" || suit === "bamboo" || suit === "chars") {
          ctx.font = "bold " + Math.floor(tw * 0.52) + "px " + theme.fontFamily
          ctx.fillText(String(rank), cx, cy - h * 0.12)
          ctx.font = Math.floor(tw * 0.3) + "px " + theme.fontFamily
          ctx.fillText(root.suitMark[suit], cx, cy + h * 0.25)
        } else if (suit === "wind") {
          ctx.font = "bold " + Math.floor(tw * 0.6) + "px " + theme.fontFamily
          ctx.fillText(root.winds[rank], cx, cy)
        } else if (suit === "dragon") {
          if (rank === 2) {
            ctx.strokeStyle = col
            ctx.lineWidth = Math.max(1.5, tw * 0.06)
            // White dragon: a double frame, so it can't be mistaken for a
            // missing glyph.
            ctx.strokeRect(x + w * 0.22, y + h * 0.2, w * 0.56, h * 0.6)
            ctx.lineWidth = Math.max(1, tw * 0.03)
            ctx.strokeRect(x + w * 0.32, y + h * 0.3, w * 0.36, h * 0.4)
          } else {
            ctx.font = "bold " + Math.floor(tw * 0.6) + "px " + theme.fontFamily
            ctx.fillText(root.dragons[rank], cx, cy)
          }
        } else {
          ctx.font = Math.floor(tw * 0.48) + "px " + theme.fontFamily
          ctx.fillText(suit === "flower" ? "✿" : "✦", cx, cy - h * 0.1)
          ctx.font = "bold " + Math.floor(tw * 0.3) + "px " + theme.fontFamily
          ctx.fillText(String(rank), cx, cy + h * 0.28)
        }

        if (idx === s.cursor) {
          roundRect(ctx, x - 2, y - 2, w + 4, h + 4, r + 2)
          ctx.strokeStyle = theme.accent
          ctx.lineWidth = 3
          ctx.stroke()
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
