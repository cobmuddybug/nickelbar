import QtQuick
import "../engine" as Engine
import "logic/scratch.js" as Scratch

// Scratch cards; see logic/scratch.js. Ten cards, score is the winnings.
Engine.GameBase {
  id: root
  gameId: "scratch"
  title: "SCRATCH CARDS"
  helpText: "Three of a symbol wins its prize, times the bonus box · ARROWS pick a spot · SPACE scratch it · A scratch the lot · SPACE again for the next card · ten cards"
  mouseHelp: "Hold the button and rub to scratch; click once a card is done for the next"

  property var state: null
  score: state ? state.score : 0
  overTitle: state ? state.score + " WON" : ""
  status: !state ? ""
    : over ? "TEN CARDS, " + state.score + " WON  ·  SPACE to play again"
    : paused ? "PAUSED"
    : "CARD " + state.dealt + "/" + Scratch.CARDS
      + (state.settled ? (state.last ? "  ·  WINNER! +" + state.last : "  ·  no luck") + "  ·  SPACE next card" : "")

  onStateChanged: over = !!state && Scratch.finished(state)

  function newGame() { state = Scratch.makeState(); paused = false }

  function moveCursor(dx, dy) { if (state && !over && !state.settled) state = Scratch.moveCursor(state, dx, dy) }

  function activate() {
    if (over) { newGame(); return }
    if (!state) return
    if (state.settled) state = Scratch.nextCard(state)
    else state = Scratch.uncover(state, state.cursor)
  }

  function handleKey(key, text) {
    if (!state || over) return false
    if (text === "a" || text === "A") { state = Scratch.uncoverAll(state); return true }
    return false
  }

  function saveState() { return state && !over ? Scratch.serialize(state) : null }
  function loadState(saved) {
    var r = Scratch.deserialize(saved)
    if (r) { state = r; paused = false }
    else newGame()
  }

  // Mouse: rubbing with the button down scratches a small disc at the
  // pointer, in whichever spot it's over.
  property point lastRub: Qt.point(-1, -1)
  function pointer(kind, x, y, b) {
    if (!state || over) return
    if (kind === "press" && state.settled) { state = Scratch.nextCard(state); return }
    if (kind !== "press" && kind !== "drag") return
    // Interpolate between drag events so a fast rub leaves no gaps.
    var pts = [[x, y]]
    if (kind === "drag" && lastRub.x >= 0) {
      var d = Math.hypot(x - lastRub.x, y - lastRub.y), n = Math.ceil(d / (board.layout().flake * 0.8))
      for (var k = 1; k < n; ++k) pts.push([lastRub.x + (x - lastRub.x) * k / n, lastRub.y + (y - lastRub.y) * k / n])
    }
    lastRub = Qt.point(x, y)
    var s = state, L = board.layout()
    for (var p = 0; p < pts.length; ++p) {
      for (var i = 0; i < 10; ++i) {
        var r = board.spotRect(L, i)
        if (pts[p][0] < r.x - L.flake || pts[p][0] > r.x + r.w + L.flake || pts[p][1] < r.y - L.flake || pts[p][1] > r.y + r.h + L.flake) continue
        s = Scratch.scratch(s, i, (pts[p][0] - r.x) / r.w * Scratch.SUB, (pts[p][1] - r.y) / r.h * Scratch.SUB, 1.1)
      }
    }
    if (s !== state) state = s
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    anchors.fill: parent
    Engine.Pointer { game: root; shape: Qt.CrossCursor }

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onOverChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    function layout() {
      var cw = Math.min(width * 0.62, height * 0.72), ch = cw * 1.36
      if (ch > height * 0.97) { ch = height * 0.97; cw = ch / 1.36 }
      var x = (width - cw) / 2, y = (height - ch) / 2
      var spot = cw * 0.22, gap = cw * 0.045
      var gx = x + (cw - spot * 3 - gap * 2) / 2, gy = y + ch * 0.19
      return { x: x, y: y, w: cw, h: ch, spot: spot, gap: gap, gx: gx, gy: gy, flake: spot / Scratch.SUB }
    }

    function spotRect(L, i) {
      if (i === 9) return { x: L.gx + L.spot * 0.5 + L.gap, y: L.gy + 3 * (L.spot + L.gap) + L.gap * 0.4, w: L.spot * 2, h: L.spot * 0.6 }
      return { x: L.gx + (i % 3) * (L.spot + L.gap), y: L.gy + Math.floor(i / 3) * (L.spot + L.gap), w: L.spot, h: L.spot }
    }

    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath()
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
    }

    // The foil: flakes still covering the spot, with a faint diagonal sheen.
    function foil(ctx, r, mask) {
      var fw = r.w / Scratch.SUB, fh = r.h / Scratch.SUB
      // Whole-pixel flakes so neighbours meet without overlapping (the
      // foil tint is translucent; the base under it is not).
      for (var k = 0; k < mask.length; ++k) {
        if (!mask[k]) continue
        var fx = k % Scratch.SUB, fy = Math.floor(k / Scratch.SUB)
        var x0 = Math.round(r.x + fx * fw), x1 = Math.round(r.x + (fx + 1) * fw)
        var y0 = Math.round(r.y + fy * fh), y1 = Math.round(r.y + (fy + 1) * fh)
        ctx.fillStyle = theme.background
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
        ctx.fillStyle = theme.withAlpha(theme.foreground, (fx + fy) % 2 ? 0.5 : 0.44)
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
      }
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state, L = layout(), card = s.card

      // The ticket.
      roundRect(ctx, L.x, L.y, L.w, L.h, L.w * 0.04)
      ctx.fillStyle = theme.withAlpha(theme.accent, 0.12); ctx.fill()
      ctx.strokeStyle = theme.withAlpha(theme.accent, 0.6); ctx.lineWidth = 2; ctx.stroke()
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.fillStyle = theme.accent
      ctx.font = "bold " + Math.floor(L.w * 0.08) + "px " + theme.fontFamily
      ctx.fillText("LUCKY THREES", L.x + L.w / 2, L.y + L.h * 0.065)
      // Prize table.
      ctx.font = Math.floor(L.w * 0.036) + "px " + theme.fontFamily
      var tx = L.x + L.w * 0.08, tw = L.w * 0.84 / Scratch.SYMBOLS.length
      for (var t = 0; t < Scratch.SYMBOLS.length; ++t) {
        ctx.fillStyle = theme.tone(t)
        ctx.fillText(Scratch.SYMBOLS[t].glyph + " " + Scratch.SYMBOLS[t].prize, tx + tw * (t + 0.5), L.y + L.h * 0.14)
      }

      for (var i = 0; i < 10; ++i) {
        var r = spotRect(L, i), p = i === 9 ? card.bonus : card.spots[i]
        var winning = s.settled && i < 9 && p.sym === card.win
        roundRect(ctx, r.x, r.y, r.w, r.h, L.spot * 0.08)
        ctx.fillStyle = winning ? theme.withAlpha(theme.tone(p.sym), 0.3) : theme.background
        ctx.fill()
        ctx.fillStyle = i === 9 ? theme.foreground : theme.tone(p.sym)
        ctx.font = "bold " + Math.floor(i === 9 ? r.h * 0.5 : r.h * 0.55) + "px " + theme.fontFamily
        ctx.fillText(i === 9 ? "BONUS ×" + p.mult : Scratch.SYMBOLS[p.sym].glyph, r.x + r.w / 2, r.y + r.h / 2)
        if (!p.open) foil(ctx, r, p.mask)
        if (i === 9 && !p.open) {
          ctx.fillStyle = theme.withAlpha(theme.background, 0.7)
          ctx.font = "bold " + Math.floor(r.h * 0.3) + "px " + theme.fontFamily
          ctx.fillText("BONUS", r.x + r.w / 2, r.y + r.h / 2)
        }
        if (i === s.cursor && !s.settled && !root.over) {
          roundRect(ctx, r.x - 4, r.y - 4, r.w + 8, r.h + 8, L.spot * 0.1)
          ctx.strokeStyle = theme.highlight; ctx.lineWidth = 3; ctx.stroke()
        }
      }

      if (s.settled) {
        ctx.font = "bold " + Math.floor(L.w * 0.07) + "px " + theme.fontFamily
        ctx.fillStyle = s.last ? theme.accent : theme.dim
        ctx.fillText(s.last ? "WIN " + s.last : "NO WIN", L.x + L.w / 2, L.y + L.h * 0.955)
      }
      // Cards to come, stacked at the side.
      ctx.fillStyle = theme.dim
      ctx.font = Math.floor(L.w * 0.04) + "px " + theme.fontFamily
      ctx.textAlign = "left"
      ctx.fillText(s.score + " won", L.x + L.w + 12, L.y + 12)
      ctx.fillText((Scratch.CARDS - s.dealt) + " to go", L.x + L.w + 12, L.y + 12 + L.w * 0.06)
      if (root.paused) {
        ctx.fillStyle = theme.background; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
