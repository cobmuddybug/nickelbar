import QtQuick
import "../engine" as Engine
import "logic/crazyeights.js" as C8
import "logic/cardart.js" as CardArt

// Crazy Eights against two computer players; see logic/crazyeights.js.
// Rounds until someone reaches 100; score is your points.
Engine.GameBase {
  id: root
  gameId: "crazyeights"
  title: "CRAZY EIGHTS"
  helpText: "Match the top card's suit or rank · eights are wild and name the next suit · no match: D (or SPACE) draws until one plays · LEFT/RIGHT pick a card · SPACE or UP play · after an 8, LEFT/RIGHT or 1-4 pick the suit · going out scores the others' cards (8 = 50, court = 10) · first to 100"
  mouseHelp: "Click a card to play it, the stock to draw, a suit after an eight"

  property var state: null
  score: state ? state.scores[0] : 0
  overTitle: !state ? "" : C8.leader(state) === 0 ? "YOU WIN" : C8.NAMES[C8.leader(state)] + " WINS"
  readonly property bool myTurn: !!state && state.phase === "play" && state.turn === 0
  readonly property bool mustDraw: myTurn && !C8.anyPlayable(state, state.hands[0])
  status: !state ? ""
    : over ? "YOU " + state.scores[0] + " · WEST " + state.scores[1] + " · EAST " + state.scores[2] + "  ·  SPACE to play again"
    : paused ? "PAUSED"
    : state.phase === "round" ? state.note + "  ·  SPACE for the next round"
    : state.phase === "suit" ? "NAME A SUIT  ·  1 ♠  2 ♥  3 ♦  4 ♣"
    : myTurn ? (state.note ? state.note + "  ·  " : "") + (mustDraw ? "nothing plays: D or SPACE to draw" : "your turn")
    : state.note || (C8.NAMES[state.turn] + " to play")

  onStateChanged: over = !!state && state.phase === "done"

  Timer {
    interval: 900
    running: !!root.state && root.state.phase === "play" && root.state.turn !== 0 && !root.paused
    onTriggered: root.state = C8.cpuMove(root.state)
  }

  function newGame() { state = C8.makeState(); paused = false }

  function moveCursor(dx, dy) {
    if (!state || over) return
    if (dx && (state.phase === "suit" || myTurn)) state = C8.moveCursor(state, dx)
    else if (dy < 0) activate()
  }

  function activate() {
    if (over) { newGame(); return }
    if (!state) return
    if (state.phase === "round") state = C8.nextRound(state)
    else if (state.phase === "suit") state = C8.chooseSuit(state, C8.SUITS[state.suitCursor])
    else if (mustDraw) state = C8.drawUntilPlayable(state, 0)
    else if (myTurn) state = C8.playCard(state, 0, state.cursor)
  }

  function handleKey(key, text) {
    if (!state || over) return false
    var t = text ? text.toLowerCase() : ""
    if (state.phase === "suit") {
      var i = "1234".indexOf(t)
      if (i >= 0 && t) { state = C8.chooseSuit(state, C8.SUITS[i]); return true }
    }
    if (t === "d" && myTurn) { state = C8.drawUntilPlayable(state, 0); return true }
    return false
  }

  function saveState() { return state && !over ? C8.serialize(state) : null }
  function loadState(saved) {
    var r = C8.deserialize(saved)
    if (r) { state = r; paused = false }
    else newGame()
  }

  function pointer(kind, x, y, b) {
    if (!state || over) return
    var L = board.layout()
    if (state.phase === "suit") {
      var si = Math.floor((x - L.suitX) / L.suitW)
      if (y >= L.suitY && y <= L.suitY + L.suitW && si >= 0 && si < 4) {
        if (kind === "press") state = C8.chooseSuit(state, C8.SUITS[si])
        else if (si !== state.suitCursor) state = C8.moveCursor(state, si - state.suitCursor)
      }
      return
    }
    if (kind !== "press") {
      var hi = board.handIndexAt(L, x, y)
      if (myTurn && hi >= 0 && hi !== state.cursor) state = C8.moveCursor(state, hi - state.cursor)
      return
    }
    if (state.phase === "round") { state = C8.nextRound(state); return }
    if (!myTurn) return
    if (x >= L.stockX && x <= L.stockX + L.cw && y >= L.midY && y <= L.midY + L.ch) { state = C8.drawUntilPlayable(state, 0); return }
    var i = board.handIndexAt(L, x, y)
    if (i >= 0) state = C8.playCard(state, 0, i)
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    anchors.fill: parent
    Engine.Pointer { game: root }

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onOverChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    function layout() {
      var cw = Math.min(width / 9, height / 1.4 / 4.2), ch = cw * 1.4
      var n = root.state ? root.state.hands[0].length : 1
      var step = Math.min(cw * 0.75, (width - cw - 16) / Math.max(1, n - 1))
      var handW = cw + step * (n - 1)
      var midY = height * 0.36
      return {
        cw: cw, ch: ch, step: step, handX: (width - handW) / 2, handY: height - ch - cw * 0.25,
        midY: midY, stockX: width / 2 - cw * 1.2, pileX: width / 2 + cw * 0.2,
        suitW: cw * 0.9, suitX: width / 2 - cw * 1.8, suitY: midY + ch + cw * 0.3
      }
    }

    function handIndexAt(L, x, y) {
      if (y < L.handY - L.ch * 0.2 || y > L.handY + L.ch) return -1
      var n = root.state.hands[0].length
      for (var i = n - 1; i >= 0; --i) {
        var cx = L.handX + i * L.step
        if (x >= cx && x <= cx + L.cw) return i
      }
      return -1
    }

    function backs(ctx, L, p, cx, label) {
      var s = root.state, n = s.hands[p].length, st = Math.min(L.cw * 0.22, L.cw * 2.2 / Math.max(1, n))
      var total = L.cw + st * Math.max(0, n - 1), x0 = cx - total / 2, y = height * 0.05
      for (var i = 0; i < n; ++i) CardArt.back(ctx, theme, { x: x0 + i * st, y: y, w: L.cw * 0.8, h: L.ch * 0.8 })
      ctx.textAlign = "center"; ctx.textBaseline = "top"
      ctx.font = "bold " + Math.floor(L.cw * 0.2) + "px " + theme.fontFamily
      ctx.fillStyle = s.turn === p && s.phase === "play" ? theme.accent : theme.dim
      ctx.fillText(label + "  " + s.scores[p] + "  ·  " + n + (n === 1 ? " card" : " cards"), cx, y + L.ch * 0.8 + L.cw * 0.12)
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state, L = layout()
      backs(ctx, L, 1, width * 0.27, "WEST")
      backs(ctx, L, 2, width * 0.73, "EAST")

      // Stock and pile, with the called suit when an eight changed it.
      var stock = { x: L.stockX, y: L.midY, w: L.cw, h: L.ch }
      if (s.deck.length) {
        CardArt.back(ctx, theme, stock)
        if (root.mustDraw) CardArt.outline(ctx, theme.highlight, stock, 3)
      } else CardArt.placeholder(ctx, theme, stock, "")
      var pile = { x: L.pileX, y: L.midY, w: L.cw, h: L.ch }
      CardArt.face(ctx, theme, pile, C8.top(s))
      ctx.textAlign = "center"; ctx.textBaseline = "top"
      ctx.font = Math.floor(L.cw * 0.18) + "px " + theme.fontFamily
      ctx.fillStyle = theme.dim
      ctx.fillText(s.deck.length + " left", stock.x + L.cw / 2, stock.y + L.ch + 4)
      if (s.suit !== C8.top(s).suit || C8.top(s).rank === 8) {
        ctx.font = "bold " + Math.floor(L.cw * 0.5) + "px " + theme.fontFamily
        ctx.textBaseline = "middle"
        ctx.fillStyle = CardArt.isRed(s.suit) ? theme.danger : theme.foreground
        ctx.fillText(CardArt.suitGlyph(s.suit), pile.x + L.cw * 1.55, pile.y + L.ch / 2)
      }

      // Your hand: the cursor card lifts, cards that can't go down dim.
      var n = s.hands[0].length
      for (var i = 0; i < n; ++i) {
        var c = s.hands[0][i], lift = root.myTurn && i === s.cursor ? L.ch * 0.18 : 0
        var r = { x: L.handX + i * L.step, y: L.handY - lift, w: L.cw, h: L.ch }
        if (root.myTurn && !C8.playable(s, c)) {
          // Opaque base first so the overlapping fan doesn't show through.
          CardArt.roundRect(ctx, r.x, r.y, r.w, r.h, CardArt.radius(r))
          ctx.fillStyle = theme.background; ctx.fill()
          ctx.globalAlpha = 0.4
        }
        CardArt.face(ctx, theme, r, c)
        ctx.globalAlpha = 1
        if (lift) CardArt.outline(ctx, C8.playable(s, c) ? theme.highlight : theme.danger, r, 2)
      }
      ctx.textAlign = "left"; ctx.textBaseline = "bottom"
      ctx.font = "bold " + Math.floor(L.cw * 0.2) + "px " + theme.fontFamily
      ctx.fillStyle = s.turn === 0 && s.phase !== "round" ? theme.accent : theme.dim
      ctx.fillText("YOU  " + s.scores[0], 8, L.handY - L.ch * 0.22)

      if (s.phase === "suit") {
        for (var k = 0; k < 4; ++k) {
          var sx = L.suitX + k * L.suitW, suit = C8.SUITS[k]
          CardArt.roundRect(ctx, sx + 3, L.suitY, L.suitW - 6, L.suitW - 6, 6)
          ctx.fillStyle = k === s.suitCursor ? theme.withAlpha(theme.accent, 0.3) : theme.withAlpha(theme.foreground, 0.08)
          ctx.fill()
          if (k === s.suitCursor) { ctx.strokeStyle = theme.highlight; ctx.lineWidth = 2; ctx.stroke() }
          ctx.fillStyle = CardArt.isRed(suit) ? theme.danger : theme.foreground
          ctx.textAlign = "center"; ctx.textBaseline = "middle"
          ctx.font = Math.floor(L.suitW * 0.5) + "px " + theme.fontFamily
          ctx.fillText(CardArt.suitGlyph(suit), sx + L.suitW / 2, L.suitY + (L.suitW - 6) / 2)
        }
      } else if (s.note && s.phase !== "play") {
        ctx.textAlign = "center"; ctx.textBaseline = "middle"
        ctx.font = "bold " + Math.floor(L.cw * 0.24) + "px " + theme.fontFamily
        ctx.fillStyle = s.winner === 0 ? theme.accent : theme.danger
        ctx.fillText(s.note, width / 2, L.suitY + L.suitW * 0.4)
      }

      if (root.paused) {
        ctx.fillStyle = theme.background; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
