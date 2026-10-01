import QtQuick
import "../engine" as Engine
import "logic/kittylaunch.js" as Kit

// Kitty Launch (after Kitten Cannon and Toss the Turtle); see
// logic/kittylaunch.js. Ten launches; score is the best distance.
Engine.GameBase {
  id: root
  gameId: "kittylaunch"
  title: "KITTY LAUNCH"
  helpText: "UP/DOWN aim the cannon · hold SPACE for power (it swings), release to fire · in the air, SPACE fires a rocket boost while you have any · TNT blasts you on, springs throw you high, balloons bounce you, traps stop you dead · coins buy upgrades between launches (UP/DOWN, SPACE to buy, LAUNCH to go) · ten launches, score is the best"
  mouseHelp: "Point to aim, hold to power up, release to fire; click in the air to boost; click shop rows to buy"

  property var state: null
  tickInterval: 16
  continuousMove: true
  ticking: !!state && !over
  score: state ? state.best : 0
  overTitle: state ? "BEST " + state.best + " m" : ""
  status: !state ? ""
    : over ? "ten launches, " + state.total + " m in all  ·  SPACE to play again"
    : paused ? "PAUSED"
    : "LAUNCH " + state.launch + "/" + Kit.LAUNCHES + "  ·  best " + state.best + " m  ·  " + state.coins + " coins"
      + (state.phase === "flight" ? "  ·  boosts " + state.boostsLeft : state.phase === "landed" ? "  ·  SPACE to go on" : "")

  property bool mouseHold: false

  onTick: {
    state = Kit.step(state, { dy: state.phase === "aim" ? heldDy : 0, hold: heldAction || mouseHold, boost: heldAction || mouseHold }, tickInterval / 1000)
    if (state.done) over = true
  }

  function newGame() { state = Kit.makeState(); over = false; paused = false; mouseHold = false }

  function moveCursor(dx, dy) {
    if (state && state.phase === "shop" && dy) state = Kit.shopMove(state, dy)
  }

  function activate() {
    if (over) { newGame(); return }
    if (!state) return
    if (state.phase === "landed") state = Kit.next(state)
    else if (state.phase === "shop") state = Kit.buy(state, state.shopCursor)
  }

  function pointer(kind, x, y, b) {
    if (!state || over) return
    var L = board.layout()
    if (state.phase === "shop") {
      var row = Math.floor((y - L.shopY) / L.rowH)
      if (row >= 0 && row <= Kit.SHOP.length) {
        if (row !== state.shopCursor) state = Kit.shopMove(state, row - state.shopCursor)
        if (kind === "press") state = Kit.buy(state, row)
      }
      return
    }
    if (state.phase === "landed" && kind === "press") { state = Kit.next(state); return }
    if (state.phase === "aim" && kind !== "release") {
      var s = Kit.shallow(state), wx = (x - L.left) / L.u + state.cam.x, wy = (L.ground - y) / L.u + state.cam.y
      s.angle = Math.max(0.15, Math.min(1.45, Math.atan2(wy - 1.4, wx - 1.6)))
      state = s
    }
    if (kind === "press") mouseHold = true
    if (kind === "release") mouseHold = false
  }

  function saveState() {
    return state && !over && (state.phase === "aim" || state.phase === "shop")
      ? { launch: state.launch, coins: state.coins, best: state.best, total: state.total, up: state.up, phase: state.phase } : null
  }
  function loadState(saved) {
    newGame()
    if (saved && saved.launch) {
      var s = Kit.shallow(state)
      s.launch = saved.launch; s.coins = saved.coins; s.best = saved.best; s.total = saved.total; s.up = saved.up; s.phase = saved.phase
      state = s
    }
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
      var u = height / 15
      return { u: u, left: u * 1.2, ground: height - u * 1.4, shopY: height * 0.22, rowH: Math.min(height * 0.11, 44) }
    }

    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath()
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
    }

    function kitty(ctx, x, y, r, spin) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(spin)
      ctx.strokeStyle = theme.tone(3); ctx.lineWidth = Math.max(2, r * 0.25); ctx.lineCap = "round"
      ctx.beginPath(); ctx.moveTo(-r * 0.8, r * 0.3); ctx.quadraticCurveTo(-r * 1.6, r * 0.2, -r * 1.5, -r * 0.6); ctx.stroke()
      ctx.fillStyle = theme.tone(3)
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.moveTo(-r * 0.75, -r * 0.5); ctx.lineTo(-r * 0.55, -r * 1.35); ctx.lineTo(-r * 0.1, -r * 0.85); ctx.fill()
      ctx.beginPath(); ctx.moveTo(r * 0.75, -r * 0.5); ctx.lineTo(r * 0.55, -r * 1.35); ctx.lineTo(r * 0.1, -r * 0.85); ctx.fill()
      ctx.fillStyle = theme.background
      ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.1, r * 0.14, 0, Math.PI * 2); ctx.arc(r * 0.35, -r * 0.1, r * 0.14, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state, L = layout(), u = L.u, cam = s.cam
      function X(x) { return L.left + (x - cam.x) * u }
      function Y(y) { return L.ground - (y - cam.y) * u }

      if (s.phase === "shop") {
        // The shop.
        ctx.textAlign = "center"; ctx.textBaseline = "middle"
        ctx.fillStyle = theme.accent
        ctx.font = "bold " + Math.floor(L.rowH * 0.6) + "px " + theme.fontFamily
        ctx.fillText("UPGRADES  ·  " + s.coins + " coins", width / 2, L.shopY - L.rowH * 0.9)
        var w = Math.min(width * 0.9, 560), x0 = (width - w) / 2
        for (var i = 0; i <= Kit.SHOP.length; ++i) {
          var y = L.shopY + i * L.rowH, cur = i === s.shopCursor
          roundRect(ctx, x0, y + 3, w, L.rowH - 6, 6)
          ctx.fillStyle = cur ? theme.withAlpha(theme.accent, 0.22) : theme.withAlpha(theme.foreground, 0.06); ctx.fill()
          if (cur) { ctx.strokeStyle = theme.highlight; ctx.lineWidth = 2; ctx.stroke() }
          ctx.font = "bold " + Math.floor(L.rowH * 0.36) + "px " + theme.fontFamily
          if (i === Kit.SHOP.length) {
            ctx.fillStyle = theme.accent; ctx.textAlign = "center"
            ctx.fillText("LAUNCH " + (s.launch + 1) + " ▶", width / 2, y + L.rowH / 2)
            continue
          }
          var it = Kit.SHOP[i], lvl = s.up[it.id], maxed = lvl >= it.max, afford = !maxed && s.coins >= it.cost[lvl]
          ctx.textAlign = "left"; ctx.fillStyle = theme.foreground
          ctx.fillText(it.name, x0 + 12, y + L.rowH * 0.38)
          ctx.font = Math.floor(L.rowH * 0.26) + "px " + theme.fontFamily
          ctx.fillStyle = theme.dim
          ctx.fillText(it.desc, x0 + 12, y + L.rowH * 0.7)
          for (var p = 0; p < it.max; ++p) {
            ctx.fillStyle = p < lvl ? theme.accent : theme.faint
            ctx.fillRect(x0 + w * 0.55 + p * L.rowH * 0.32, y + L.rowH * 0.4, L.rowH * 0.24, L.rowH * 0.24)
          }
          ctx.textAlign = "right"
          ctx.font = "bold " + Math.floor(L.rowH * 0.34) + "px " + theme.fontFamily
          ctx.fillStyle = maxed ? theme.dim : afford ? theme.tone(3) : theme.danger
          ctx.fillText(maxed ? "MAX" : it.cost[lvl] + " ¢", x0 + w - 12, y + L.rowH / 2)
        }
        return
      }

      // Sky, ground, distance marks.
      ctx.fillStyle = theme.withAlpha(theme.tone(5), 0.07)
      ctx.fillRect(0, 0, width, height)
      var gy = Y(0)
      ctx.fillStyle = theme.withAlpha(theme.tone(2), 0.3)
      ctx.fillRect(0, gy, width, height - gy)
      ctx.strokeStyle = theme.tone(2); ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(width, gy); ctx.stroke()
      ctx.textAlign = "center"; ctx.textBaseline = "top"
      ctx.font = Math.floor(u * 0.45) + "px " + theme.fontFamily
      for (var m = Math.ceil(cam.x / 25) * 25; m < cam.x + width / u; m += 25) {
        ctx.fillStyle = theme.dim
        ctx.fillRect(X(m) - 1, gy, 2, u * 0.3)
        ctx.fillText(m + " m", X(m), gy + u * 0.35)
      }
      if (s.best > 0 && X(s.best) > 0 && X(s.best) < width) {
        ctx.strokeStyle = theme.withAlpha(theme.accent, 0.6); ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(X(s.best), gy); ctx.lineTo(X(s.best), gy - u * 3); ctx.stroke()
        ctx.fillStyle = theme.accent; ctx.fillText("BEST", X(s.best), gy - u * 3.6)
      }

      // Objects.
      for (var o = 0; o < s.objects.length; ++o) {
        var ob = s.objects[o], ox = X(ob.x)
        if (ox < -u * 3 || ox > width + u * 3) continue
        ctx.globalAlpha = ob.used ? 0.3 : 1
        if (ob.kind === "tnt") {
          ctx.fillStyle = theme.danger; ctx.fillRect(ox - u * 0.6, gy - u * 1.1, u * 1.2, u * 1.1)
          ctx.fillStyle = theme.background; ctx.font = "bold " + Math.floor(u * 0.4) + "px " + theme.fontFamily; ctx.textBaseline = "middle"
          ctx.fillText("TNT", ox, gy - u * 0.55); ctx.textBaseline = "top"
        } else if (ob.kind === "spring") {
          ctx.strokeStyle = theme.dim; ctx.lineWidth = 2
          ctx.beginPath(); for (var z = 0; z <= 6; ++z) ctx.lineTo(ox + (z % 2 ? u * 0.4 : -u * 0.4), gy - z * u * 0.14); ctx.stroke()
          ctx.fillStyle = theme.tone(2); ctx.fillRect(ox - u * 1.1, gy - u * 1, u * 2.2, u * 0.2)
        } else if (ob.kind === "balloon") {
          var by = Y(ob.y)
          ctx.strokeStyle = theme.dim; ctx.lineWidth = 1
          ctx.beginPath(); ctx.moveTo(ox, by + u * 0.8); ctx.lineTo(ox + Math.sin(s.t * 2 + o) * u * 0.3, by + u * 2.2); ctx.stroke()
          ctx.fillStyle = theme.tone(4); ctx.beginPath(); ctx.ellipse(ox - u * 0.65, by - u * 0.85, u * 1.3, u * 1.7); ctx.fill()
        } else {
          ctx.fillStyle = theme.danger
          for (var tt = 0; tt < 4; ++tt) { ctx.beginPath(); ctx.moveTo(ox - u * 0.8 + tt * u * 0.4, gy); ctx.lineTo(ox - u * 0.6 + tt * u * 0.4, gy - u * 0.6); ctx.lineTo(ox - u * 0.4 + tt * u * 0.4, gy); ctx.fill() }
          ctx.fillStyle = theme.dim; ctx.fillRect(ox - u * 0.9, gy - u * 0.12, u * 1.8, u * 0.12)
        }
        ctx.globalAlpha = 1
      }

      // Cannon.
      var cx = X(1.6), cy = Y(1.4)
      if (cx > -u * 4) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(-s.angle)
        ctx.fillStyle = theme.foreground; ctx.fillRect(0, -u * 0.35, u * 1.9, u * 0.7)
        ctx.fillStyle = theme.dim; ctx.fillRect(u * 1.6, -u * 0.45, u * 0.35, u * 0.9)
        ctx.restore()
        ctx.fillStyle = theme.dim
        ctx.beginPath(); ctx.arc(cx, cy + u * 0.2, u * 0.7, 0, Math.PI * 2); ctx.fill()
        ctx.fillRect(cx - u * 0.9, cy + u * 0.4, u * 1.8, gy - cy - u * 0.4)
        if (s.phase === "aim") {
          // Power gauge beside it, and a dotted guide.
          ctx.fillStyle = theme.faint; ctx.fillRect(cx + u * 2.4, cy - u * 3, u * 0.35, u * 3)
          ctx.fillStyle = s.power > 0.85 ? theme.danger : theme.accent
          ctx.fillRect(cx + u * 2.4, cy - u * 3 * s.power, u * 0.35, u * 3 * s.power)
          ctx.fillStyle = theme.withAlpha(theme.foreground, 0.3)
          for (var d = 2.4; d < 7; d += 0.7) { ctx.beginPath(); ctx.arc(cx + Math.cos(s.angle) * d * u, cy - Math.sin(s.angle) * d * u, 2, 0, Math.PI * 2); ctx.fill() }
        }
      }

      for (var bi = 0; bi < s.booms.length; ++bi) {
        var bm = s.booms[bi]
        ctx.fillStyle = theme.withAlpha(theme.tone(3), bm.t * 2)
        ctx.beginPath(); ctx.arc(X(bm.x), Y(bm.y), (0.6 - bm.t) * u * 4 + u * 0.3, 0, Math.PI * 2); ctx.fill()
      }

      if (s.kitty) {
        var kx = X(s.kitty.x), ky = Y(s.kitty.y)
        if (ky < -u) {
          // Off the top: an arrow with the height.
          ctx.fillStyle = theme.tone(3)
          ctx.beginPath(); ctx.moveTo(kx, u * 0.3); ctx.lineTo(kx - u * 0.4, u * 0.9); ctx.lineTo(kx + u * 0.4, u * 0.9); ctx.fill()
          ctx.font = Math.floor(u * 0.4) + "px " + theme.fontFamily
          ctx.fillText(Math.round(s.kitty.y) + " m up", kx, u)
        } else kitty(ctx, kx, ky, Kit.R * u * 1.3, s.spin)
      }

      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.font = "bold " + Math.floor(u * 0.55) + "px " + theme.fontFamily
      for (var q = 0; q < s.pops.length; ++q) {
        ctx.fillStyle = theme.withAlpha(theme.foreground, Math.min(1, s.pops[q].t * 2))
        ctx.fillText(s.pops[q].text, X(s.pops[q].x), Y(s.pops[q].y))
      }
      // Distance, big, top right; boosts left beneath it.
      ctx.textAlign = "right"; ctx.textBaseline = "top"
      ctx.fillStyle = theme.foreground
      ctx.font = "bold " + Math.floor(u * 1.1) + "px " + theme.fontFamily
      ctx.fillText((s.kitty ? Math.max(0, Math.floor(s.kitty.x)) : 0) + " m", width - u * 0.4, u * 0.3)
      if (s.phase === "flight") {
        for (var r = 0; r < s.boostsLeft; ++r) { ctx.fillStyle = theme.tone(3); ctx.fillRect(width - u * (0.9 + r * 0.6), u * 1.7, u * 0.4, u * 0.4) }
        for (var sh = 0; sh < s.shieldLeft; ++sh) { ctx.fillStyle = theme.accent; ctx.beginPath(); ctx.arc(width - u * (0.7 + sh * 0.6), u * 2.6, u * 0.2, 0, Math.PI * 2); ctx.fill() }
      }
      if (s.msgT > 0) {
        ctx.textAlign = "center"
        ctx.fillStyle = theme.accent
        ctx.font = "bold " + Math.floor(u * 0.8) + "px " + theme.fontFamily
        ctx.fillText(s.msg, width / 2, height * 0.18)
      }
      if (root.paused) {
        ctx.fillStyle = theme.background; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
