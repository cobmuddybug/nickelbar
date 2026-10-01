import QtQuick
import "../engine" as Engine
import "logic/yacht.js" as Yacht

// Yacht (the Yahtzee scorecard). Three rolls a turn, thirteen boxes; the
// score is the card's grand total.
Engine.GameBase {
  id: root
  gameId: "yacht"
  title: "YACHT"
  helpText: "R roll (3 a turn) · SPACE on a die or 1-5 hold it · DOWN to the scorecard, SPACE scores the box (dim numbers are what you'd get) · 35 bonus at 63 upstairs · extra yachts +100 and wild"
  mouseHelp: "Click a die to hold it, a box to score it, anywhere else (or right-click) to roll"

  property var state: null
  score: state ? Yacht.total(state) : 0
  overTitle: "FINAL SCORE " + score
  status: !state ? ""
    : (over ? "DONE  ·  N for a new card"
      : (paused ? "PAUSED"
        : (state.note ? state.note.toUpperCase() + "  ·  " : "")
          + "TURN " + Math.min(13, state.turn) + "/13  ·  "
          + (!state.dice.length ? "R to roll" : state.rolls ? state.rolls + " roll" + (state.rolls > 1 ? "s" : "") + " left" : "pick a box")))

  onStateChanged: if (state && Yacht.finished(state)) over = true

  function newGame() {
    state = Yacht.makeState()
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {
    if (over || !state) return
    state = Yacht.moveCursor(state, dx, dy)
  }

  function activate() {
    if (over) { newGame(); return }
    if (state) state = Yacht.activate(state)
  }

  function handleKey(key, text) {
    if (over || !state) return false
    if (text === "r" || text === "R") { state = Yacht.roll(state); return true }
    var n = "12345".indexOf(text)
    if (n >= 0) { state = Yacht.toggleHold(state, n); return true }
    return false
  }

  function saveState() {
    if (!state || over) return null
    return Yacht.serialize(state)
  }

  function loadState(saved) {
    var restored = Yacht.deserialize(saved)
    if (restored) { state = restored; over = false }
    else newGame()
  }

  function hitAt(x, y) {
    var h = board.hits
    for (var i = h.length - 1; i >= 0; --i) if (x >= h[i].x && x <= h[i].x + h[i].w && y >= h[i].y && y <= h[i].y + h[i].h) return h[i]
    return null
  }
  // Mouse (engine/Pointer.qml): click a die to hold it, a box to score it,
  // anywhere else (or right-click) to roll.
  function pointer(kind, x, y, b) {
    if (!state || over || kind !== "press") return
    var h = b === Qt.LeftButton ? hitAt(x, y) : null
    if (h && h.act === "die") state = Yacht.toggleHold(state, h.i)
    else if (h && h.act === "box") state = Yacht.scoreBox(state, h.i)
    else state = Yacht.roll(state)
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    property var hits: []     // clickable spots, recorded as onPaint draws them
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

    // Pip positions on a 3x3 grid for each face.
    readonly property var pips: [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]]

    function die(ctx, x, y, size, value, held, cursor) {
      var r = size * 0.16
      roundRect(ctx, x, y, size, size, r)
      ctx.fillStyle = held ? theme.withAlpha(theme.accent, 0.3) : theme.withAlpha(theme.foreground, value ? 0.1 : 0.04)
      ctx.fill()
      ctx.strokeStyle = held ? theme.accent : theme.withAlpha(theme.foreground, 0.35)
      ctx.lineWidth = held ? 2 : 1
      ctx.stroke()
      if (value) {
        ctx.fillStyle = theme.foreground
        var p = pips[value]
        for (var i = 0; i < p.length; ++i) {
          var cx = x + size * (0.25 + (p[i] % 3) * 0.25), cy = y + size * (0.25 + Math.floor(p[i] / 3) * 0.25)
          ctx.beginPath(); ctx.arc(cx, cy, size * 0.085, 0, Math.PI * 2); ctx.fill()
        }
      }
      if (cursor) {
        roundRect(ctx, x - 4, y - 4, size + 8, size + 8, r + 3)
        ctx.strokeStyle = theme.accent
        ctx.lineWidth = 3
        ctx.stroke()
      }
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state
      board.hits = []
      var pad = Math.max(8, width * 0.03)

      // Dice
      var size = Math.min((width - pad * 2) / 6.2, height * 0.16)
      var gap = size * 0.3
      var x0 = (width - (size * 5 + gap * 4)) / 2
      var dy = pad
      for (var d = 0; d < 5; ++d) {
        board.hits.push({ x: x0 + d * (size + gap), y: dy, w: size, h: size * 1.15, act: "die", i: d })
        var held = s.held[d] && s.dice.length > 0
        die(ctx, x0 + d * (size + gap), dy + (held ? size * 0.12 : 0), size, s.dice[d] || 0, held,
          s.cursor.row === "dice" && s.cursor.i === d)
      }
      // Rolls left as small pips under the dice.
      for (var k = 0; k < 3; ++k) {
        ctx.fillStyle = k < s.rolls ? theme.accent : theme.faint
        ctx.beginPath(); ctx.arc(width / 2 + (k - 1) * size * 0.3, dy + size * 1.32, size * 0.06, 0, Math.PI * 2); ctx.fill()
      }

      // Scorecard: two columns.
      var cardY = dy + size * 1.55
      var rowH = Math.min((height - cardY - pad) / 9, size * 0.6)
      var colW = (width - pad * 3) / 2
      var fs = Math.max(10, Math.floor(rowH * 0.5))
      var jk = Yacht.joker(s)
      ctx.textBaseline = "middle"

      function row(i, x, y) {
        board.hits.push({ x: x, y: y, w: colW, h: rowH, act: "box", i: i })
        var used = s.scores[i] !== null
        var cur = s.cursor.row === "card" && s.cursor.i === i
        if (cur) {
          ctx.fillStyle = theme.withAlpha(theme.accent, 0.18)
          ctx.fillRect(x, y, colW, rowH)
          ctx.strokeStyle = theme.accent
          ctx.lineWidth = 2
          ctx.strokeRect(x + 1, y + 1, colW - 2, rowH - 2)
        } else if (i === s.last) {
          ctx.fillStyle = theme.withAlpha(theme.foreground, 0.06)
          ctx.fillRect(x, y, colW, rowH)
        }
        ctx.font = (used ? "" : "bold ") + fs + "px " + theme.fontFamily
        ctx.textAlign = "left"
        ctx.fillStyle = used ? theme.dim : theme.foreground
        ctx.fillText(Yacht.CATS[i].name.toUpperCase(), x + fs * 0.5, y + rowH / 2)
        ctx.textAlign = "right"
        ctx.font = "bold " + fs + "px " + theme.fontFamily
        if (used) {
          ctx.fillStyle = theme.foreground
          ctx.fillText(String(s.scores[i]), x + colW - fs * 0.5, y + rowH / 2)
        } else if (s.dice.length) {
          var v = Yacht.potential(s.dice, i, jk)
          ctx.fillStyle = v ? theme.withAlpha(theme.accent, cur ? 1 : 0.7) : theme.faint
          ctx.fillText(String(v), x + colW - fs * 0.5, y + rowH / 2)
        }
      }

      var lx = pad, rx = pad * 2 + colW
      for (var i = 0; i < 6; ++i) row(i, lx, cardY + i * rowH)
      for (var j = 6; j < 13; ++j) row(j, rx, cardY + (j - 6) * rowH)

      // Totals under the upper column.
      var up = Yacht.upperTotal(s)
      ctx.font = fs + "px " + theme.fontFamily
      ctx.textAlign = "left"
      ctx.fillStyle = theme.dim
      var ty = cardY + 6.5 * rowH
      ctx.fillText("UPPER " + up + "/" + Yacht.UPPER_BONUS_AT, lx + fs * 0.5, ty)
      ctx.fillStyle = Yacht.bonus(s) ? theme.accent : theme.dim
      ctx.fillText("BONUS " + Yacht.bonus(s), lx + fs * 0.5, ty + rowH)
      if (s.yachtBonus) {
        ctx.fillStyle = theme.accent
        ctx.fillText("YACHT BONUS " + s.yachtBonus, lx + fs * 0.5, ty + rowH * 2)
      }
      ctx.font = "bold " + Math.floor(fs * 1.3) + "px " + theme.fontFamily
      ctx.textAlign = "right"
      ctx.fillStyle = theme.foreground
      ctx.fillText("TOTAL " + Yacht.total(s), rx + colW - fs * 0.5, cardY + 7.6 * rowH)

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
