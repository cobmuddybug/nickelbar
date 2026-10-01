import QtQuick
import "../engine" as Engine
import "logic/blackjack.js" as BJ
import "logic/cardart.js" as CardArt

// Blackjack vs the house. Score is the highest chip count reached (endless,
// banked on save); running out of chips ends the session.
Engine.GameBase {
  id: root
  gameId: "blackjack"
  title: "BLACKJACK"
  helpText: "ARROWS change bet · SPACE deal / hit · S stand · D double down · dealer stands on 17 · blackjack pays 3:2"
  mouseHelp: "Click the buttons: DEAL, HIT, STAND, DOUBLE, NEXT HAND · click a bet along the bottom to change it · RIGHT-click stands"

  property var state: null
  endless: true
  score: state ? state.peak : 0
  overTitle: "OUT OF CHIPS"
  status: !state ? ""
    : (over ? "BROKE  ·  N for a fresh 100 chips"
      : (paused ? "PAUSED"
        : state.phase === "bet" ? state.chips + " chips  ·  bet " + state.bet + "  ·  SPACE to deal"
        : state.phase === "player" ? "YOU " + BJ.value(state.player) + "  ·  SPACE hit · S stand" + (state.player.length === 2 && state.chips >= state.bet ? " · D double" : "")
        : state.phase === "dealer" ? "DEALER PLAYS…"
        : state.result.toUpperCase() + (state.net > 0 ? "  +" + state.net : state.net < 0 ? "  " + state.net : "") + "  ·  SPACE next hand"))

  onStateChanged: if (state && BJ.broke(state)) over = true

  Timer {
    interval: 520
    repeat: true
    running: !!root.state && root.state.phase === "dealer" && !root.paused
    onTriggered: root.state = BJ.dealerStep(root.state)
  }

  function newGame() {
    state = BJ.makeState()
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {
    if (over || !state) return
    state = BJ.changeBet(state, dx !== 0 ? dx : -dy)
  }

  function activate() {
    if (over) { newGame(); return }
    if (!state) return
    if (state.phase === "bet") state = BJ.deal(state)
    else if (state.phase === "player") state = BJ.hit(state)
    else if (state.phase === "done") state = BJ.nextHand(state)
  }

  function handleKey(key, text) {
    if (over || !state) return false
    if (text === "s" || text === "S") { state = BJ.stand(state); return true }
    if (text === "d" || text === "D") { state = BJ.double(state); return true }
    return false
  }

  function saveState() {
    if (!state || over) return null
    return BJ.serialize(state)
  }

  function loadState(saved) {
    var restored = BJ.deserialize(saved)
    if (restored) { state = restored; over = false }
    else newGame()
  }

  // Mouse (engine/Pointer.qml): on-screen buttons for every action and the
  // bet sizes along the bottom (recorded into board.hits as they're drawn).
  // Clicking the table between hands deals / moves on too, but never hits,
  // so a stray click mid-hand costs nothing. RIGHT-click stands.
  property string hot: ""
  function act(name) {
    if (name === "deal" || name === "hit" || name === "next") activate()
    else if (name === "stand") state = BJ.stand(state)
    else if (name === "double") state = BJ.double(state)
    else if (name.indexOf("bet:") === 0) state = BJ.changeBet(state, Number(name.slice(4)) - state.betIndex)
  }
  function pointer(kind, x, y, b) {
    if (!state || over) return
    var h = CardArt.hitAt(board.hits, x, y)
    if (kind === "move") { var name = h ? h.act : ""; if (name !== hot) hot = name; return }
    if (kind !== "press") return
    if (b === Qt.RightButton) { state = BJ.stand(state); return }
    if (b !== Qt.LeftButton) return
    if (h) act(h.act)
    else if (state.phase === "bet" || state.phase === "done") activate()
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
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

    property var hits: []     // clickable spots, recorded as onPaint draws them

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      var hits = []
      board.hits = hits
      if (!root.state) return
      var s = root.state
      var cardW = Math.min(width / 8, height / 1.4 / 3.2), cardH = cardW * 1.4
      var step = cardW * 0.62

      function hand(cards, y, hideSecond, label) {
        var total = cardW + step * Math.max(0, cards.length - 1)
        var x0 = (width - total) / 2
        for (var i = 0; i < cards.length; ++i) {
          var r = { x: x0 + i * step, y: y, w: cardW, h: cardH }
          if (hideSecond && i === 1) CardArt.back(ctx, theme, r)
          else CardArt.face(ctx, theme, r, cards[i], i + 1 < cards.length ? step : undefined)
        }
        if (label) {
          ctx.fillStyle = theme.dim
          ctx.font = "bold " + Math.floor(cardH * 0.14) + "px " + theme.fontFamily
          ctx.textAlign = "right"; ctx.textBaseline = "middle"
          ctx.fillText(label, x0 - cardW * 0.2, y + cardH / 2)
        }
      }

      var dealerY = height * 0.04, playerY = height * 0.42
      if (s.dealer.length) {
        var dv = s.holeHidden ? BJ.value([s.dealer[0]]) + "+?" : String(BJ.value(s.dealer))
        hand(s.dealer, dealerY, s.holeHidden, "DEALER " + dv)
      } else {
        ctx.strokeStyle = theme.faint
        ctx.strokeRect((width - cardW) / 2, dealerY, cardW, cardH)
      }
      if (s.player.length) {
        var pv = BJ.value(s.player)
        hand(s.player, playerY, false, "YOU " + (BJ.isSoft(s.player) && pv < 21 ? "soft " : "") + pv)
      }

      // Result banner between the hands.
      if (s.phase === "done") {
        ctx.fillStyle = s.net > 0 ? theme.accent : s.net < 0 ? theme.danger : theme.foreground
        ctx.font = "bold " + Math.floor(cardH * 0.2) + "px " + theme.fontFamily
        ctx.textAlign = "center"; ctx.textBaseline = "middle"
        ctx.fillText(s.result.toUpperCase() + (s.net ? (s.net > 0 ? "  +" : "  ") + s.net : ""), width / 2, (dealerY + cardH + playerY) / 2)
      }

      // Action buttons under the player's hand.
      var btnH = Math.max(30, cardH * 0.3), btnW = Math.max(btnH * 2.8, cardW * 1.1), btnY = playerY + cardH + btnH * 0.45
      var items = s.phase === "bet" ? [{ text: "DEAL", act: "deal" }]
        : s.phase === "player" ? [{ text: "HIT", act: "hit" }, { text: "STAND", act: "stand" },
            { text: "DOUBLE", act: "double", enabled: s.player.length === 2 && s.chips >= s.bet }]
        : s.phase === "done" ? [{ text: "NEXT HAND", act: "next" }] : []
      CardArt.buttonRow(ctx, theme, width / 2, btnY, s.phase === "done" ? btnW * 1.5 : btnW, btnH, btnH * 0.4, items, root.hot, hits)

      // Chips and bet strip along the bottom; in betting, each stake is a
      // click target.
      var by = height - cardH * 0.28
      ctx.font = "bold " + Math.floor(cardH * 0.15) + "px " + theme.fontFamily
      ctx.textBaseline = "middle"
      ctx.textAlign = "left"
      ctx.fillStyle = theme.foreground
      ctx.fillText(s.chips + " chips", 8, by)
      ctx.textAlign = "right"
      for (var b = BJ.BETS.length - 1, x = width - 8; b >= 0; --b) {
        var label = String(BJ.BETS[b])
        var active = b === s.betIndex
        var afford = BJ.BETS[b] <= s.chips + (s.phase !== "bet" ? s.bet : 0)
        var lw = ctx.measureText(label).width, canPick = s.phase === "bet" && afford
        ctx.fillStyle = active ? theme.accent : root.hot === "bet:" + b && canPick ? theme.foreground : (afford ? theme.dim : theme.faint)
        ctx.fillText(label, x, by)
        if (canPick) hits.push({ x: x - lw - 6, y: by - cardH * 0.14, w: lw + 12, h: cardH * 0.28, act: "bet:" + b })
        if (active) { ctx.fillRect(x - ctx.measureText(label).width, by + cardH * 0.1, ctx.measureText(label).width, 2) }
        x -= ctx.measureText(label).width + cardW * 0.3
      }
      if (s.doubled && s.phase !== "bet") {
        ctx.textAlign = "center"
        ctx.fillStyle = theme.accent
        ctx.fillText("DOUBLED", width / 2, by)
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
