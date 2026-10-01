import QtQuick
import "../engine" as Engine
import "logic/empire.js" as Emp

// Empire (after Empire Attack); see logic/empire.js. A five-minute match
// on a hex map; score is area, capitals taken and the win.
Engine.GameBase {
  id: root
  gameId: "empire"
  difficulties: ["Easy", "Normal", "Hard"]
  onDifficultyChanged: Emp.setDifficulty(difficulty)
  title: "EMPIRE"
  helpText: "Population pours into your pool; spend it on hexes · ARROWS move · SPACE spends the chosen amount on the hex under the cursor: your own hex is reinforced, empty land next to yours is claimed (any amount will do), an enemy hex next to yours is attacked (attack and defence cancel out) · 1-5 or +/- choose the amount (1 person, 10%, 25%, 50%, all) · C jumps to your capital · attacks from more sides hit harder (+50% a side) · mountains defend double, capitals 1.5× · coins pay out · take a capital and the whole empire is yours; lose yours and it's over · largest area after five minutes wins"
  mouseHelp: "Click a hex to spend on it; the wheel changes the amount"

  property var state: null
  tickInterval: 50
  ticking: !!state && !over
  score: state ? Emp.score(state) : 0
  overTitle: state ? state.result : ""
  readonly property int pool: state ? Math.floor(state.empires[0].pool) : 0
  readonly property int spend: state ? Emp.spendFor(state, 0, state.amount) : 0
  status: !state ? ""
    : over ? "area " + Emp.area(state, 0) + (state.capsTaken ? " · " + state.capsTaken + " capitals taken" : "") + "  ·  SPACE to play again"
    : paused ? "PAUSED"
    : "POOL " + pool + "  ·  spend " + Emp.AMOUNT_NAMES[state.amount] + " (" + spend + ")  ·  area " + Emp.area(state, 0)
      + "  ·  " + timeLeft(state)

  function timeLeft(s) {
    var left = Math.max(0, Math.ceil(Emp.MATCH - s.t))
    return Math.floor(left / 60) + ":" + (left % 60 < 10 ? "0" : "") + (left % 60)
  }

  onTick: {
    state = Emp.step(state, tickInterval / 1000)
    if (state.done) over = true
  }

  function newGame() { state = Emp.makeState(); over = false; paused = false }

  function moveCursor(dx, dy) { if (state && !over) state = Emp.moveCursor(state, dx, dy) }

  function activate() {
    if (over) { newGame(); return }
    if (state) state = Emp.act(state, 0, state.cursor, spend)
  }

  function setAmount(a) {
    var s = Emp.shallow(state)
    s.amount = Math.max(0, Math.min(Emp.AMOUNTS.length - 1, a))
    state = s
  }

  function handleKey(key, text) {
    if (!state || over) return false
    var i = "12345".indexOf(text)
    if (text && i >= 0) { setAmount(i); return true }
    if (text === "+" || text === "=") { setAmount(state.amount + 1); return true }
    if (text === "-" || text === "_") { setAmount(state.amount - 1); return true }
    if (text === "c" || text === "C") { var s = Emp.shallow(state); s.cursor = state.empires[0].capital; state = s; return true }
    return false
  }

  function pointer(kind, x, y, b) {
    if (!state || over) return
    if (kind === "wheel") { setAmount(state.amount + b); return }
    var h = board.hexAt(x, y)
    if (h < 0) return
    if (h !== state.cursor) { var s = Emp.shallow(state); s.cursor = h; state = s }
    if (kind === "press") state = Emp.act(state, 0, h, spend)
  }

  // The whole state is plain data, so it saves as is.
  function saveState() { return state && !over ? JSON.parse(JSON.stringify(state)) : null }
  function loadState(saved) {
    if (saved && typeof saved === "object" && saved.tiles !== undefined) { state = saved; over = false; paused = false }
    else newGame()
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

    readonly property real hudH: Math.max(34, height * 0.1)

    function layout() {
      var R = Math.min(width / ((Emp.COLS + 0.5) * Math.sqrt(3)), (height - hudH) / (Emp.ROWS * 1.5 + 0.5))
      var w = Math.sqrt(3) * R
      var totalW = (Emp.COLS + 0.5) * w, totalH = Emp.ROWS * 1.5 * R + 0.5 * R
      return { R: R, w: w, x0: (width - totalW) / 2 + w / 2, y0: (height - hudH - totalH) / 2 + R }
    }

    function centre(L, i) {
      var c = i % Emp.COLS, r = Math.floor(i / Emp.COLS)
      return { x: L.x0 + c * L.w + (r % 2 ? L.w / 2 : 0), y: L.y0 + r * 1.5 * L.R }
    }

    function hexAt(x, y) {
      var L = layout(), best = -1, bd = L.R * L.R
      for (var i = 0; i < Emp.COLS * Emp.ROWS; ++i) {
        var p = centre(L, i), d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y)
        if (d < bd) { bd = d; best = i }
      }
      return best
    }

    function hexPath(ctx, x, y, R) {
      ctx.beginPath()
      for (var k = 0; k < 6; ++k) {
        var a = Math.PI / 180 * (60 * k - 30)
        if (k === 0) ctx.moveTo(x + R * Math.cos(a), y + R * Math.sin(a)); else ctx.lineTo(x + R * Math.cos(a), y + R * Math.sin(a))
      }
      ctx.closePath()
    }

    function empireColor(e) { return e === 0 ? theme.accent : e === 1 ? theme.danger : e === 2 ? theme.tone(2) : theme.tone(4) }

    function short(n) { n = Math.floor(n); return n >= 10000 ? Math.round(n / 1000) + "k" : n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n) }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state, L = layout(), R = L.R
      ctx.textAlign = "center"; ctx.textBaseline = "middle"

      for (var i = 0; i < s.tiles.length; ++i) {
        var t = s.tiles[i], p = centre(L, i)
        hexPath(ctx, p.x, p.y, R * 0.94)
        if (t.terrain === "lake") { ctx.fillStyle = theme.withAlpha(theme.tone(5), 0.25); ctx.fill(); continue }
        if (t.owner >= 0) {
          // Denser hexes read stronger, like the original's taller squares.
          var dense = Math.min(1, Math.log(t.pop + 1) / Math.log(400))
          ctx.fillStyle = theme.withAlpha(empireColor(t.owner), 0.22 + 0.6 * dense)
        } else ctx.fillStyle = theme.withAlpha(theme.foreground, 0.06)
        ctx.fill()
        if (t.terrain === "mountain") {
          ctx.fillStyle = theme.withAlpha(theme.foreground, 0.35)
          ctx.beginPath(); ctx.moveTo(p.x - R * 0.5, p.y + R * 0.35); ctx.lineTo(p.x - R * 0.1, p.y - R * 0.4); ctx.lineTo(p.x + R * 0.2, p.y + R * 0.05)
          ctx.lineTo(p.x + R * 0.35, p.y - R * 0.15); ctx.lineTo(p.x + R * 0.6, p.y + R * 0.35); ctx.closePath(); ctx.fill()
        }
        if (t.coin) {
          ctx.fillStyle = theme.tone(3)
          ctx.beginPath(); ctx.arc(p.x + R * 0.42, p.y - R * 0.42, R * 0.2, 0, Math.PI * 2); ctx.fill()
        }
        if (t.capital) {
          // A star.
          ctx.fillStyle = theme.foreground
          ctx.beginPath()
          for (var k = 0; k < 10; ++k) {
            var a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? R * 0.18 : R * 0.42
            if (k === 0) ctx.moveTo(p.x + Math.cos(a) * rr, p.y - R * 0.3 + Math.sin(a) * rr); else ctx.lineTo(p.x + Math.cos(a) * rr, p.y - R * 0.3 + Math.sin(a) * rr)
          }
          ctx.closePath(); ctx.fill()
        }
        if (t.owner >= 0 && R > 11) {
          ctx.fillStyle = theme.foreground
          ctx.font = (t.capital ? "bold " : "") + Math.floor(R * 0.5) + "px " + theme.fontFamily
          ctx.fillText(short(t.pop), p.x, p.y + (t.capital ? R * 0.3 : 0))
        }
      }

      // Attacks flash.
      for (var f = 0; f < s.flashes.length; ++f) {
        var fp = centre(L, s.flashes[f].i)
        hexPath(ctx, fp.x, fp.y, R * 0.94)
        ctx.strokeStyle = theme.withAlpha(empireColor(s.flashes[f].by), s.flashes[f].t * 2.5); ctx.lineWidth = 3; ctx.stroke()
      }

      // Cursor, and what spending here would do.
      var cp = centre(L, s.cursor)
      hexPath(ctx, cp.x, cp.y, R * 0.98)
      ctx.strokeStyle = theme.highlight; ctx.lineWidth = 2.5; ctx.stroke()
      var pv = Emp.preview(s, 0, s.cursor, root.spend)
      var hint = pv.kind === "reinforce" ? "REINFORCE +" + pv.gain
        : pv.kind === "claim" ? (pv.ok ? "CLAIM with " + root.spend : "CLAIM needs " + pv.need)
        : pv.kind === "attack" ? "ATTACK " + short(pv.strength) + (pv.mult > 1 ? " (×" + pv.mult + ")" : "") + " vs " + short(pv.def) + (pv.ok ? "  TAKES IT" : "  leaves " + short(pv.left))
        : s.tiles[s.cursor].terrain === "lake" ? "LAKE" : "NOT NEXT TO YOUR LAND"

      // HUD strip: the hint, then each empire's area.
      var hy = height - hudH / 2, fs = Math.max(10, Math.floor(hudH * 0.3))
      ctx.font = "bold " + fs + "px " + theme.fontFamily
      ctx.textAlign = "left"
      ctx.fillStyle = pv.kind === "attack" ? (pv.ok ? theme.accent : theme.danger) : theme.foreground
      ctx.fillText(hint, 8, hy)
      ctx.textAlign = "right"
      var x = width - 8
      for (var e = Emp.EMPIRES - 1; e >= 0; --e) {
        var label = (s.empires[e].alive ? Emp.area(s, e) : "✗") + ""
        ctx.fillStyle = empireColor(e)
        ctx.fillText(label, x, hy)
        var lw = ctx.measureText(label).width
        ctx.fillRect(x - lw - fs * 0.9, hy - fs * 0.3, fs * 0.6, fs * 0.6)
        x -= lw + fs * 1.6
      }
      if (s.log.length) {
        ctx.textAlign = "center"
        ctx.font = Math.floor(fs * 0.85) + "px " + theme.fontFamily
        ctx.fillStyle = theme.dim
        ctx.fillText(s.log[0], width / 2, hy - fs * 1.1)
      }
      if (root.paused) {
        ctx.fillStyle = theme.background; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
