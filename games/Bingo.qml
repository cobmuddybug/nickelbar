import QtQuick
import "../engine" as Engine
import "logic/bingo.js" as Bingo

// Bingo: 75-ball, you and two computer players. You hold two cards and each
// rival holds two; the rivals mark theirs instantly, you find and mark your
// own numbers. Complete the pattern and call BINGO before either of them
// does. The score is how many games you win in a row; the first loss ends
// the run. A call with no finished pattern locks you out for three balls.
Engine.GameBase {
  id: root
  gameId: "bingo"
  difficulties: ["Easy", "Normal", "Hard"]
  onDifficultyChanged: Bingo.setDifficulty(difficulty)
  title: "BINGO"
  helpText: "ARROWS move over your two cards · SPACE or ENTER mark the number under the cursor, once it has been called · B call BINGO when a card shows the pattern · Win as many bingos in a row as you can; a loss ends the run · Bea and Gus each hold two cards, mark every number instantly and call the moment they finish; they get quicker as your streak grows · A false call locks you out for 3 balls"
  mouseHelp: "Click a number to mark it; click the BINGO button to call it"

  property var state: null

  tickInterval: 100
  ticking: !!state && state.phase === "play" && !over
  score: state ? state.streak : 0
  progress: state ? "streak " + state.streak : ""
  overTitle: state ? state.streak + " IN A ROW" : ""
  status: !state ? ""
    : over ? "RUN OVER  ·  " + state.streak + " in a row  ·  N for a new run"
    : paused ? "PAUSED"
    : state.phase === "won" ? state.note + "  ·  SPACE for the next game"
    : state.phase === "lost" ? state.note + "  ·  SPACE to see your result"
    : (state.note ? state.note + "  ·  " : "") + "GAME " + state.game + "  ·  " + state.called.length + " BALLS  ·  STREAK " + state.streak

  onTick: {
    if (!state || state.phase !== "play") return
    state = Bingo.step(state, tickInterval / 1000)
  }

  function newGame() { state = Bingo.makeState(); over = false; paused = false }

  function moveCursor(dx, dy) { if (state && !over) state = Bingo.moveCursor(state, dx, dy) }

  function activate() {
    if (!state) return
    if (over) { newGame(); return }
    if (state.phase !== "play") {
      state = Bingo.advance(state)
      if (state.over) over = true
      return
    }
    state = Bingo.daub(state, state.cursor.x, state.cursor.y)
  }

  function handleKey(key, text) {
    if (!state || over || state.phase !== "play") return false
    if (key === Qt.Key_B) { state = Bingo.claim(state); return true }
    return false
  }

  function saveState() { return state && !over ? Bingo.serialize(state) : null }
  function loadState(saved) {
    var r = Bingo.deserialize(saved)
    if (r) { state = r; over = !!r.over } else newGame()
  }

  function pointer(kind, x, y, b) {
    if (!state || over) return
    var g = board.geo
    if (kind === "press" && state.phase !== "play" && b === Qt.LeftButton) { activate(); return }
    if (kind === "press" && state.phase === "play" && x >= g.btn.x && x <= g.btn.x + g.btn.w && y >= g.btn.y && y <= g.btn.y + g.btn.h) {
      state = Bingo.claim(state); return
    }
    if (kind !== "move" && kind !== "press") return
    var cy = Math.floor((y - g.cy0) / g.cell), cx
    if (x >= g.cx0 && x < g.cx0 + g.cardW) cx = Math.floor((x - g.cx0) / g.cell)
    else if (x >= g.cx0 + g.cardW + g.gap && x < g.cx0 + g.cardW * 2 + g.gap) cx = 5 + Math.floor((x - g.cx0 - g.cardW - g.gap) / g.cell)
    else return
    if (cy < 0 || cy > 4) return
    if (cx !== state.cursor.x || cy !== state.cursor.y) state = Bingo.moveCursor(state, cx - state.cursor.x, cy - state.cursor.y)
    if (kind === "press" && b === Qt.LeftButton) state = Bingo.daub(state, cx, cy)
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.fill: parent

    readonly property var geo: {
      var top = Math.min(84, height * 0.15), bottom = Math.min(44, height * 0.08)
      var gap = Math.max(10, width * 0.02)
      var cell = Math.floor(Math.min((width - gap - 16) / 10, (height - top - bottom - gap * 2 - 8) / 7.7))
      var cardW = cell * 5, cardH = cell * 5
      var cx0 = Math.floor((width - cardW * 2 - gap) / 2), cy0 = Math.floor(top)
      return { top: top, bottom: bottom, gap: gap, cell: cell, cardW: cardW, cardH: cardH, cx0: cx0, cy0: cy0,
               mini: cell * 0.42, ry: cy0 + cardH + gap,
               btn: { x: cx0 + cardW * 2 + gap - cell * 3.2, y: height - bottom + 6, w: cell * 3.2, h: Math.max(26, cell * 0.7) } }
    }

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onOverChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    // One card at (ox, oy) with square cells of `cell` px; `small` skips the big type.
    function drawCard(ctx, card, ox, oy, cell, pattern, called, small) {
      var w = cell * 5
      ctx.fillStyle = theme.faint; ctx.globalAlpha = 0.5
      ctx.fillRect(ox - 2, oy - 2, w + 4, w + 4); ctx.globalAlpha = 1
      var won = Bingo.complete(card, pattern)
      for (var r = 0; r < 5; ++r) for (var c = 0; c < 5; ++c) {
        var n = card.nums[r][c], mk = card.marks[r][c]
        var x = ox + c * cell, y = oy + r * cell
        var isCalled = n === 0 || called.indexOf(n) >= 0
        if (mk) {
          ctx.fillStyle = won ? theme.highlight : theme.accent
          ctx.globalAlpha = 0.85
          ctx.beginPath(); ctx.arc(x + cell / 2, y + cell / 2, cell * 0.4, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1
        }
        if (small) continue
        ctx.textAlign = "center"
        ctx.fillStyle = mk ? theme.background : (isCalled ? theme.foreground : theme.dim)
        ctx.font = (isCalled && !mk ? "bold " : "") + Math.floor(cell * 0.4) + "px " + theme.fontFamily
        ctx.fillText(n === 0 ? "★" : String(n), x + cell / 2, y + cell / 2 + 1)
      }
      ctx.strokeStyle = won ? theme.highlight : theme.dim; ctx.lineWidth = won ? 3 : 1
      ctx.strokeRect(ox, oy, w, w)
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state, g = board.geo
      if (g.cell <= 0) return
      ctx.textBaseline = "middle"
      // Header: pattern, closest card, last ball and the recent ones.
      var pat = Bingo.PATTERNS[0].name
      for (var pi = 0; pi < Bingo.PATTERNS.length; ++pi) if (Bingo.PATTERNS[pi].id === s.pattern) pat = Bingo.PATTERNS[pi].name
      var bestNow = Bingo.best(s)
      ctx.textAlign = "left"
      ctx.fillStyle = theme.dim; ctx.font = "bold 12px " + theme.fontFamily
      ctx.fillText("GAME " + s.game + "  ·  STREAK " + s.streak, g.cx0, 14)
      ctx.fillStyle = theme.accent; ctx.font = "bold 20px " + theme.fontFamily
      ctx.fillText(pat, g.cx0, 36)
      ctx.fillStyle = theme.dim; ctx.font = "12px " + theme.fontFamily
      ctx.fillText("your closest card: " + bestNow.have + " / " + bestNow.need, g.cx0, 58)
      var lastBall = s.called.length ? s.called[s.called.length - 1] : 0
      var bx = g.cx0 + g.cardW * 2 + g.gap - 30, by = 34
      if (lastBall) {
        ctx.fillStyle = theme.accent
        ctx.beginPath(); ctx.arc(bx, by, 26, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = theme.background; ctx.textAlign = "center"
        ctx.font = "bold 11px " + theme.fontFamily
        ctx.fillText(Bingo.LETTERS[Math.floor((lastBall - 1) / 15)], bx, by - 12)
        ctx.font = "bold 22px " + theme.fontFamily
        ctx.fillText(String(lastBall), bx, by + 5)
      }
      ctx.textAlign = "right"; ctx.font = "13px " + theme.fontFamily; ctx.fillStyle = theme.foreground
      var recent = s.called.slice(-7, -1).reverse()
      ctx.fillText(recent.map(function(n) { return Bingo.LETTERS[Math.floor((n - 1) / 15)] + n }).join("  "), bx - 36, by + 2)
      // Your two cards.
      for (var ci = 0; ci < 2; ++ci) board.drawCard(ctx, s.cards[ci], g.cx0 + ci * (g.cardW + g.gap), g.cy0, g.cell, s.pattern, s.called, false)
      // The cursor.
      var cur = s.cursor
      var curX = g.cx0 + (cur.x < 5 ? cur.x * g.cell : g.cardW + g.gap + (cur.x - 5) * g.cell)
      ctx.strokeStyle = theme.highlight; ctx.lineWidth = 2
      ctx.strokeRect(curX + 1, g.cy0 + cur.y * g.cell + 1, g.cell - 2, g.cell - 2)
      // The rivals' cards, small, with how close each is.
      var mini = g.mini, mw = mini * 5, mgap = Math.max(6, mini * 0.6), rgap = Math.max(14, mini * 1.6)
      var rowW = 4 * mw + 2 * mgap + rgap, rx = Math.floor((width - rowW) / 2)
      for (var ri = 0; ri < s.rivals.length; ++ri) {
        var rv = s.rivals[ri], x0 = rx + ri * (2 * mw + mgap + rgap)
        var nb = Bingo.bestOf(rv.cards, s.pattern)
        ctx.textAlign = "left"; ctx.fillStyle = rv.claimAt >= 0 ? theme.danger : theme.foreground; ctx.font = "bold 12px " + theme.fontFamily
        ctx.fillText(rv.name.toUpperCase() + "  " + nb.have + "/" + nb.need + (rv.claimAt >= 0 ? "  BINGO!" : ""), x0, g.ry + 8)
        for (var k = 0; k < 2; ++k) board.drawCard(ctx, rv.cards[k], x0 + k * (mw + mgap), g.ry + 20, mini, s.pattern, s.called, true)
      }
      // The call button.
      var b = g.btn
      var locked = s.lockout > 0 || s.phase !== "play"
      ctx.fillStyle = locked ? theme.faint : theme.accent
      ctx.fillRect(b.x, b.y, b.w, b.h)
      ctx.fillStyle = locked ? theme.dim : theme.background; ctx.textAlign = "center"
      ctx.font = "bold " + Math.floor(Math.min(16, b.h * 0.55)) + "px " + theme.fontFamily
      ctx.fillText(s.lockout > 0 ? "LOCKED " + s.lockout : "BINGO!  [B]", b.x + b.w / 2, b.y + b.h / 2)
      // Result banner.
      if (s.phase !== "play" && !root.over) {
        ctx.fillStyle = theme.background; ctx.globalAlpha = 0.72
        ctx.fillRect(0, height / 2 - 34, width, 68); ctx.globalAlpha = 1
        ctx.fillStyle = s.phase === "won" ? theme.accent : theme.danger
        ctx.font = "bold 26px " + theme.fontFamily; ctx.textAlign = "center"
        ctx.fillText(s.note, width / 2, height / 2 - 6)
        ctx.fillStyle = theme.dim; ctx.font = "13px " + theme.fontFamily
        ctx.fillText("SPACE or click to continue", width / 2, height / 2 + 20)
      }
      if (root.paused || root.over) {
        ctx.fillStyle = theme.background
        ctx.globalAlpha = root.paused ? 0.7 : 0.35
        ctx.fillRect(0, 0, width, height)
        ctx.globalAlpha = 1
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
