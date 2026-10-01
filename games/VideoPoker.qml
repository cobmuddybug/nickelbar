import QtQuick
import "../engine" as Engine
import "logic/videopoker.js" as VP
import "logic/cardart.js" as CardArt

// Jacks or Better. Score is the highest credit count reached (endless,
// banked on save); running out of credits ends the session.
Engine.GameBase {
  id: root
  gameId: "videopoker"
  title: "VIDEO POKER"
  helpText: "Jacks or Better, 9/6 pay table · UP/DOWN change bet (1-5) · SPACE deal · LEFT/RIGHT pick a card · SPACE or 1-5 hold/release · UP hold · DOWN release · D draw · royal on 5 coins pays 4000"
  mouseHelp: "Click a card to hold or release it · DEAL / DRAW button to play · click a bet along the bottom to change it"

  property var state: null
  endless: true
  score: state ? state.peak : 0
  overTitle: "OUT OF CREDITS"
  status: !state ? ""
    : (over ? "BROKE  ·  N for a fresh 100 credits"
      : (paused ? "PAUSED"
        : state.phase === "hold" ? "HOLD WHAT YOU WANT  ·  D to draw" + (state.result ? "  ·  " + VP.handName(state.result).toUpperCase() : "")
        : state.phase === "done" ? (state.win ? VP.handName(state.result).toUpperCase() + "  +" + state.win : "NO WIN") + "  ·  SPACE to deal"
        : state.credits + " credits  ·  bet " + state.bet + "  ·  SPACE to deal"))

  onStateChanged: if (state && VP.broke(state)) over = true

  function newGame() {
    state = VP.makeState()
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {
    if (over || !state) return
    if (state.phase === "hold") {
      if (dx) state = VP.moveCursor(state, dx)
      else if (dy < 0) state = VP.setHold(state, true)
      else if (dy > 0) state = VP.setHold(state, false)
    } else state = VP.changeBet(state, dy ? -dy : dx)
  }

  function activate() {
    if (over) { newGame(); return }
    if (!state) return
    if (state.phase === "hold") state = VP.toggleHold(state)
    else state = VP.deal(state)
  }

  function handleKey(key, text) {
    if (over || !state) return false
    if (text === "d" || text === "D") { state = state.phase === "hold" ? VP.draw(state) : VP.deal(state); return true }
    var n = "12345".indexOf(text)
    if (n >= 0 && state.phase === "hold") { state = VP.toggleHold(state, n); return true }
    return false
  }

  function saveState() {
    if (!state || over) return null
    return VP.serialize(state)
  }

  function loadState(saved) {
    var restored = VP.deserialize(saved)
    if (restored) { state = restored; over = false }
    else newGame()
  }

  // Mouse (engine/Pointer.qml): click a card to hold or release it, the
  // DEAL / DRAW button to play, a bet size along the bottom to change it.
  // Spots are recorded into board.hits as they're drawn; a click anywhere
  // else does nothing, so a near miss on a card never draws by accident.
  property string hot: ""
  function pointer(kind, x, y, b) {
    if (!state || over) return
    var h = CardArt.hitAt(board.hits, x, y)
    if (kind === "move") { var name = h ? h.act : ""; if (name !== hot) hot = name; return }
    if (kind !== "press" || b !== Qt.LeftButton || !h) return
    if (h.act.indexOf("card:") === 0) state = VP.toggleHold(state, Number(h.act.slice(5)))
    else if (h.act === "draw") state = VP.draw(state)
    else if (h.act === "deal") state = VP.deal(state)
    else if (h.act.indexOf("bet:") === 0) state = VP.changeBet(state, Number(h.act.slice(4)) - state.bet)
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
      function onHotChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      var hits = []
      board.hits = hits
      if (!root.state) return
      var s = root.state
      var gap = Math.max(6, width * 0.02)
      var cardW = Math.min((width - gap * 6) / 5, height * 0.34 / 1.4), cardH = cardW * 1.4

      // Pay table: hand name and what it pays at the current bet. The row
      // for the hand on the table lights up.
      var rows = VP.HANDS.length
      var tableH = height * 0.42
      var rowH = tableH / rows
      var fs = Math.max(10, Math.floor(Math.min(rowH * 0.62, width * 0.04)))
      var tx0 = width * 0.12, tx1 = width * 0.88
      ctx.font = "bold " + fs + "px " + theme.fontFamily
      ctx.textBaseline = "middle"
      for (var i = 0; i < rows; ++i) {
        var h = VP.HANDS[i]
        var y = gap + rowH * i + rowH / 2
        var lit = s.result === h.id && s.phase !== "bet"
        if (lit) {
          ctx.fillStyle = theme.withAlpha(theme.accent, s.phase === "done" ? 0.35 : 0.15)
          ctx.fillRect(tx0 - gap, y - rowH / 2, tx1 - tx0 + gap * 2, rowH)
        }
        ctx.fillStyle = lit ? theme.foreground : theme.dim
        ctx.textAlign = "left"
        ctx.fillText(h.name.toUpperCase(), tx0, y)
        ctx.textAlign = "right"
        ctx.fillText(String(VP.payout(h.id, s.bet)), tx1, y)
      }

      // The hand.
      var handY = gap * 2 + tableH
      var x0 = (width - (cardW * 5 + gap * 4)) / 2
      for (var c = 0; c < 5; ++c) {
        var r = { x: x0 + c * (cardW + gap), y: handY, w: cardW, h: cardH }
        if (s.phase === "hold") hits.push({ x: r.x, y: r.y, w: r.w, h: r.h, act: "card:" + c })
        if (s.hand.length) CardArt.face(ctx, theme, r, s.hand[c])
        else CardArt.back(ctx, theme, r)
        if (s.held[c]) {
          ctx.fillStyle = theme.accent
          ctx.font = "bold " + Math.floor(cardW * 0.2) + "px " + theme.fontFamily
          ctx.textAlign = "center"; ctx.textBaseline = "top"
          ctx.fillText("HELD", r.x + r.w / 2, r.y + r.h + gap * 0.5)
        }
        if (s.phase === "hold" && root.hot === "card:" + c && !s.held[c])
          CardArt.outline(ctx, theme.withAlpha(theme.accent, 0.5), r, 2)
        if (s.phase === "hold" && c === s.cursor)
          CardArt.outline(ctx, theme.accent, { x: r.x - 2, y: r.y - 2, w: r.w + 4, h: r.h + 4 }, 3)
        else if (s.held[c]) CardArt.outline(ctx, theme.withAlpha(theme.accent, 0.6), r, 2)
      }

      // Credits and bet along the bottom.
      var by = height - gap - fs
      ctx.font = "bold " + Math.floor(fs * 1.1) + "px " + theme.fontFamily
      ctx.textBaseline = "middle"
      ctx.textAlign = "left"
      ctx.fillStyle = theme.foreground
      ctx.fillText(s.credits + " CREDITS", gap, by)
      // DEAL / DRAW in the middle of the strip; a win shows above it.
      var btnH = Math.max(30, fs * 2.2), btnW = Math.max(btnH * 2.8, cardW * 1.1)
      if (s.phase === "done" && s.win) {
        ctx.textAlign = "center"
        ctx.fillStyle = theme.accent
        ctx.fillText("WIN " + s.win, width / 2, by - btnH * 0.5 - fs)
      }
      CardArt.button(ctx, theme, { x: (width - btnW) / 2, y: by - btnH / 2, w: btnW, h: btnH },
        s.phase === "hold" ? "DRAW" : "DEAL", s.phase === "hold" || s.credits > 0, root.hot === "draw" || root.hot === "deal",
        s.phase === "hold" ? "draw" : "deal", hits)
      ctx.font = "bold " + Math.floor(fs * 1.1) + "px " + theme.fontFamily
      ctx.textBaseline = "middle"
      ctx.textAlign = "right"
      var bx = width - gap
      for (var b = VP.MAX_BET; b >= 1; --b) {
        var label = String(b)
        var w = ctx.measureText(label).width
        var active = b === s.bet, canPick = s.phase !== "hold" && b <= s.credits
        ctx.fillStyle = active ? theme.accent : root.hot === "bet:" + b && canPick ? theme.foreground
          : (b <= s.credits + (s.phase === "hold" ? s.bet : 0) ? theme.dim : theme.faint)
        ctx.fillText(label, bx, by)
        if (canPick) hits.push({ x: bx - w - fs * 0.4, y: by - fs, w: w + fs * 0.8, h: fs * 2, act: "bet:" + b })
        if (active) ctx.fillRect(bx - w, by + fs * 0.7, w, 2)
        bx -= w + fs
      }
      ctx.fillStyle = theme.dim
      ctx.fillText("BET", bx, by)

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
