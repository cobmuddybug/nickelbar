import QtQuick
import "../engine" as Engine
import "logic/holdem.js" as HE
import "logic/cardart.js" as CardArt

// Texas Hold'em (see logic/holdem.js): you and three bots, no limit.
Engine.GameBase {
  id: root
  gameId: "holdem"
  difficulties: ["Easy", "Normal", "Hard"]
  onDifficultyChanged: HE.setDifficulty(difficulty)
  title: "HOLD'EM"
  helpText: "F fold · SPACE or C check/call · R raise · UP/DOWN pick the raise size (min, half pot, pot, all in) · SPACE deal the next hand · No-limit Texas Hold'em against three bots: Rook is tight, Daisy calls everything, Rex is a maniac · Blinds climb every eight hands · Bust, or take all their chips"
  mouseHelp: "Click FOLD / CALL / RAISE; the arrows beside RAISE change its size"

  property var state: null
  property string hot: ""
  tickInterval: 50
  ticking: !!state && state.phase === "bet" && state.toAct > 0
  score: state ? state.players[0].chips : 0
  overTitle: state ? state.result + " · " + state.players[0].chips : ""
  progress: state ? "hand " + state.hand + " · " + state.players[0].chips + " chips" : ""
  status: !state ? ""
    : over ? state.result + "  ·  hand " + state.hand + "  ·  N for a new game"
    : paused ? "PAUSED"
    : state.phase === "over" ? state.msg + "  ·  SPACE for the next hand"
    : state.toAct === 0 ? "YOUR MOVE  ·  " + (HE.toCall(state, 0) > 0 ? "call " + HE.toCall(state, 0) : "check") + "  ·  raise " + HE.RAISE_SIZES[state.raiseIdx]
    : state.players[Math.max(0, state.toAct)].name.toUpperCase() + " is thinking…"

  onTick: { state = HE.step(state, tickInterval / 1000); if (state.done) over = true }
  onStateChanged: if (state && state.done) over = true

  function newGame() { state = HE.makeState(); over = false; paused = false }
  function moveCursor(dx, dy) { if (state && !over && dy) state = HE.setRaiseSize(state, -dy) }
  function activate() {
    if (over) { newGame(); return }
    if (!state) return
    if (state.phase === "over") state = HE.nextHand(state)
    else if (state.toAct === 0) state = HE.act(state, 0, "call")
  }
  function handleKey(key, text) {
    if (!state || over || !text || state.phase !== "bet" || state.toAct !== 0) return false
    if (text === "f" || text === "F") { state = HE.act(state, 0, "fold"); return true }
    if (text === "c" || text === "C") { state = HE.act(state, 0, "call"); return true }
    if (text === "r" || text === "R") { state = HE.act(state, 0, "raise"); return true }
    return false
  }
  function saveState() { return !state || over ? null : HE.serialize(state) }
  function loadState(saved) { var s = HE.deserialize(saved); if (s) { state = s; over = false } else newGame() }

  property var hits: []
  function pointer(kind, x, y, b) {
    var h = CardArt.hitAt(hits, x, y)
    if (kind === "move") { hot = h ? h.act : ""; return }
    if (kind !== "press" || b !== Qt.LeftButton || !state) return
    if (state.phase === "over") { state = HE.nextHand(state); return }
    if (!h || state.toAct !== 0) return
    if (h.act === "fold") state = HE.act(state, 0, "fold")
    else if (h.act === "call") state = HE.act(state, 0, "call")
    else if (h.act === "raise") state = HE.act(state, 0, "raise")
    else if (h.act === "up") state = HE.setRaiseSize(state, 1)
    else if (h.act === "down") state = HE.setRaiseSize(state, -1)
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.fill: parent

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onHotChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      var s = root.state
      if (!s) return
      var hits = []
      var cw = Math.min(width * 0.13, height * 0.15), chh = cw * 1.4, gap = cw * 0.18
      ctx.textBaseline = "middle"; ctx.textAlign = "center"
      // Opponents along the top.
      for (var o = 1; o < 4; ++o) {
        var p = s.players[o], ox = width * (o * 0.25), oy = height * 0.04
        var sw = cw * 0.7, sh = sw * 1.4, showCards = s.shown && !p.folded
        ctx.globalAlpha = p.folded || p.out ? 0.35 : 1
        for (var c = 0; c < 2; ++c) {
          var r = { x: ox - sw - 2 + c * (sw + 4), y: oy, w: sw, h: sh }
          if (p.out) continue
          if (showCards && p.hole.length) CardArt.face(ctx, theme, r, p.hole[c]); else CardArt.back(ctx, theme, r)
        }
        ctx.fillStyle = s.toAct === o ? theme.accent : theme.foreground; ctx.font = "bold " + Math.floor(sh * 0.2) + "px " + theme.fontFamily
        ctx.fillText(p.name + (s.dealer === o ? " (D)" : ""), ox, oy + sh + sh * 0.16)
        ctx.fillStyle = theme.dim; ctx.font = Math.floor(sh * 0.18) + "px " + theme.fontFamily
        ctx.fillText(p.out ? "out" : p.chips + (p.last ? "  ·  " + p.last : ""), ox, oy + sh + sh * 0.4)
        ctx.globalAlpha = 1
      }
      // Board and pot.
      var by = height * 0.29, bx = (width - (cw * 5 + gap * 4)) / 2
      for (var k = 0; k < 5; ++k) {
        var rr = { x: bx + k * (cw + gap), y: by, w: cw, h: chh }
        if (k < s.board.length) CardArt.face(ctx, theme, rr, s.board[k]); else CardArt.placeholder(ctx, theme, rr, "")
      }
      ctx.fillStyle = theme.highlight; ctx.font = "bold " + Math.floor(cw * 0.34) + "px " + theme.fontFamily
      ctx.fillText(s.phase === "over" ? s.msg : "POT " + HE.potSize(s), width / 2, by + chh + cw * 0.3)
      // You.
      var me = s.players[0], hy = height * 0.62
      for (var m = 0; m < 2; ++m) {
        var mr = { x: width / 2 - cw - gap / 2 + m * (cw + gap), y: hy, w: cw, h: chh }
        if (me.hole.length && !me.out) CardArt.face(ctx, theme, mr, me.hole[m])
        if (s.phase === "over" && s.winners.indexOf(0) >= 0) CardArt.outline(ctx, theme.highlight, mr, 3)
      }
      ctx.fillStyle = s.toAct === 0 ? theme.accent : theme.foreground; ctx.font = "bold " + Math.floor(cw * 0.26) + "px " + theme.fontFamily
      ctx.fillText("YOU" + (s.dealer === 0 ? " (D)" : "") + "  ·  " + me.chips + (me.last ? "  ·  " + me.last : ""), width / 2, hy + chh + cw * 0.28)
      // Buttons.
      var bh = Math.max(30, cw * 0.5), bw = cw * 1.5, byy = height - bh - 10, mine = s.phase === "bet" && s.toAct === 0
      var call = HE.toCall(s, 0), raiseTo = mine ? HE.raiseTo(s, 0, s.raiseIdx) : 0
      CardArt.buttonRow(ctx, theme, width / 2 - cw * 0.5, byy, bw, bh, 8, [
        { text: "FOLD", enabled: mine, act: "fold" },
        { text: call > 0 ? "CALL " + call : "CHECK", enabled: mine, act: "call" },
        { text: mine && HE.canRaise(s, 0) ? "RAISE " + HE.RAISE_SIZES[s.raiseIdx] : "RAISE", enabled: mine && HE.canRaise(s, 0), act: "raise" }
      ], root.hot, hits)
      var sx = width / 2 - cw * 0.5 + (bw * 3 + 16) / 2 + 12
      CardArt.button(ctx, theme, { x: sx, y: byy, w: bh, h: bh / 2 - 2 }, "▲", mine, root.hot === "up", "up", hits)
      CardArt.button(ctx, theme, { x: sx, y: byy + bh / 2 + 2, w: bh, h: bh / 2 - 2 }, "▼", mine, root.hot === "down", "down", hits)
      root.hits = hits
      if (root.paused) { ctx.fillStyle = theme.background; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1 }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
