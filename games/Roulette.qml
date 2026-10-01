import QtQuick
import "../engine" as Engine
import "logic/roulette.js" as Rou

// Roulette (see logic/roulette.js): European wheel, inside and outside bets.
Engine.GameBase {
  id: root
  gameId: "roulette"
  title: "ROULETTE"
  helpText: "ARROWS move over the table · SPACE or ENTER put a chip on the cell · D take one back · C clear the table · R repeat last round's bets · + / - change chip size · S spin · Numbers pay 35 to 1, dozens and columns 2 to 1, red/black, odd/even and low/high even money; 0 beats them all · Endless: your score is your chips"
  mouseHelp: "Click a cell to bet (right-click takes a chip back); click the chips to pick a size, wheel to change it; click SPIN"

  property var state: null
  property int cur: 0
  tickInterval: 16
  ownSounds: true
  onStateChanged: playEvents(state)
  ticking: !!state && state.phase === "spin"
  endless: true
  score: state ? state.chips + Rou.staked(state) : 0
  overTitle: "BROKE"
  progress: state ? state.chips + " chips" : ""
  status: !state ? ""
    : over ? "OUT OF CHIPS  ·  SPACE to sit down again"
    : paused ? "PAUSED"
    : state.phase === "spin" ? "NO MORE BETS…"
    : state.result >= 0 && state.history.length ? "LAST " + state.history[0] + (state.win > 0 ? "  ·  WON " + state.win : state.win < 0 ? "  ·  LOST " + (-state.win) : "") + "  ·  chips " + state.chips + "  ·  chip " + Rou.CHIPS[state.chip]
    : "CHIPS " + state.chips + "  ·  chip " + Rou.CHIPS[state.chip] + "  ·  S to spin"

  onTick: { state = Rou.step(state, tickInterval / 1000); if (state.done) over = true }

  // The table as cells in a 14 x 5 grid: zero, three rows of twelve, the column bets,
  // then dozens and the even-money bets underneath.
  readonly property var cells: {
    var out = [{ id: "n0", x: 0, y: 0, w: 1, h: 3, label: "0", color: "green" }]
    for (var c = 0; c < 12; ++c)
      for (var r = 0; r < 3; ++r) {
        var n = (c + 1) * 3 - r
        out.push({ id: "n" + n, x: c + 1, y: r, w: 1, h: 1, label: String(n), color: Rou.isRed(n) ? "red" : "black" })
      }
    for (var k = 0; k < 3; ++k) {
      out.push({ id: "col" + (3 - k), x: 13, y: k, w: 1, h: 1, label: "2:1", color: "plain" })
      out.push({ id: "dz" + (k + 1), x: 1 + k * 4, y: 3, w: 4, h: 1, label: ["1st 12", "2nd 12", "3rd 12"][k], color: "plain" })
    }
    var ev = [["low", "1-18"], ["even", "EVEN"], ["red", "RED"], ["black", "BLACK"], ["odd", "ODD"], ["high", "19-36"]]
    for (var e = 0; e < 6; ++e) out.push({ id: ev[e][0], x: 1 + e * 2, y: 4, w: 2, h: 1, label: ev[e][1], color: ev[e][0] === "red" ? "red" : ev[e][0] === "black" ? "black" : "plain" })
    return out
  }

  function moveCursor(dx, dy) {
    if (!state || over || state.phase !== "bet") return
    var c = cells[cur], cx = c.x + c.w / 2, cy = c.y + c.h / 2, best = -1, bd = 1e9
    for (var i = 0; i < cells.length; ++i) {
      if (i === cur) continue
      var o = cells[i], ox = o.x + o.w / 2 - cx, oy = o.y + o.h / 2 - cy
      var along = dx ? ox * dx : oy * dy, across = dx ? oy : ox
      if (along <= 0.01) continue
      var d = along + Math.abs(across) * 2.5
      if (d < bd) { bd = d; best = i }
    }
    if (best >= 0) cur = best
  }
  function newGame() { state = Rou.makeState(); over = false; paused = false; cur = 1 }
  function activate() {
    if (over) { newGame(); return }
    if (state) state = Rou.place(state, cells[cur].id)
  }
  function handleKey(key, text) {
    if (!state || over || !text) return false
    if (text === "s" || text === "S") { state = Rou.spin(state); return true }
    if (text === "d" || text === "D") { state = Rou.take(state, cells[cur].id); return true }
    if (text === "c" || text === "C") { state = Rou.clear(state); return true }
    if (text === "r" || text === "R") { state = Rou.rebet(state); return true }
    if (text === "+" || text === "=") { state = Rou.setChip(state, 1); return true }
    if (text === "-" || text === "_") { state = Rou.setChip(state, -1); return true }
    return false
  }
  function saveState() { return !state || over ? null : Rou.serialize(state) }
  function loadState(saved) { var s = Rou.deserialize(saved); if (s) { state = s; over = false } else newGame() }

  // Geometry shared by painting and the mouse.
  readonly property real cw: board.width / 14
  readonly property real ch: Math.min(cw * 1.05, board.height * 0.5 / 5)
  readonly property real gy: board.height - ch * 6.3
  function cellAt(x, y) {
    var gx = x / cw, gyy = (y - gy) / ch
    for (var i = 0; i < cells.length; ++i) { var c = cells[i]; if (gx >= c.x && gx < c.x + c.w && gyy >= c.y && gyy < c.y + c.h) return i }
    return -1
  }
  function pointer(kind, x, y, b) {
    if (!state) return
    if (kind === "wheel") { state = Rou.setChip(state, b); return }
    if (kind === "move") { var m = cellAt(x, y); if (m >= 0) cur = m; return }
    if (kind !== "press") return
    var rowY = gy + ch * 5.35
    if (y >= rowY && y < rowY + ch * 0.9) {
      if (x > board.width - cw * 3) state = Rou.spin(state)
      else { var chip = Math.floor((x - cw) / (cw * 1.4)); if (chip >= 0 && chip < 4) state = Rou.setChip(state, chip - state.chip) }
      return
    }
    var i = cellAt(x, y)
    if (i < 0) return
    cur = i
    state = b === Qt.RightButton ? Rou.take(state, cells[i].id) : Rou.place(state, cells[i].id)
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.fill: parent

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onCurChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    function wheel(ctx, s, cx, cy, R) {
      var n = 37, spin = s.phase === "spin", p = spin ? Math.min(1, s.spinT / s.spinFor) : 1
      var wAng = spin ? s.spinT * 0.9 : (s.spinFor * 0.9)
      for (var i = 0; i < n; ++i) {
        var pk = Rou.WHEEL[i], a0 = wAng + i / n * Math.PI * 2 - Math.PI / 2 - Math.PI / n
        ctx.fillStyle = pk === 0 ? theme.tone(4) : Rou.isRed(pk) ? theme.danger : theme.withAlpha(theme.foreground, 0.7)
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0, a0 + Math.PI * 2 / n); ctx.closePath(); ctx.fill()
      }
      ctx.fillStyle = theme.background; ctx.beginPath(); ctx.arc(cx, cy, R * 0.62, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = theme.dim; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke()
      // The ball: orbits against the wheel, slows, drops into its pocket.
      if (s.result >= 0) {
        var slot = Rou.WHEEL.indexOf(s.result), pocket = wAng + slot / n * Math.PI * 2 - Math.PI / 2
        var ease = 1 - Math.pow(1 - p, 3), ang = pocket + (1 - ease) * Math.PI * 2 * 7
        var rad = R * (0.95 - 0.1 * ease * ease)
        ctx.fillStyle = theme.highlight; ctx.beginPath(); ctx.arc(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad, Math.max(3, R * 0.06), 0, Math.PI * 2); ctx.fill()
      }
      ctx.fillStyle = theme.foreground; ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.font = "bold " + Math.floor(R * 0.5) + "px " + theme.fontFamily
      if (!spin && s.history.length) ctx.fillText(String(s.history[0]), cx, cy)
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      var s = root.state
      if (!s) return
      var cw = root.cw, ch = root.ch, gy = root.gy
      var R = Math.min(width * 0.2, (gy - 12) / 2)
      wheel(ctx, s, width * 0.5, gy / 2, Math.max(20, R))
      // Recent numbers down the left.
      ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.font = Math.floor(ch * 0.5) + "px " + theme.fontFamily
      for (var h = 0; h < Math.min(8, s.history.length); ++h) {
        var hv = s.history[h]
        ctx.fillStyle = hv === 0 ? theme.tone(4) : Rou.isRed(hv) ? theme.danger : theme.foreground
        ctx.fillText(String(hv), 10, 12 + h * ch * 0.55)
      }
      ctx.textAlign = "center"
      var cells = root.cells
      for (var i = 0; i < cells.length; ++i) {
        var c = cells[i], x = c.x * cw, y = gy + c.y * ch, w = c.w * cw, hh = c.h * ch
        ctx.fillStyle = c.color === "green" ? theme.withAlpha(theme.tone(4), 0.55) : c.color === "red" ? theme.withAlpha(theme.danger, 0.55) : c.color === "black" ? theme.withAlpha(theme.foreground, 0.28) : theme.faint
        ctx.fillRect(x + 1, y + 1, w - 2, hh - 2)
        if (i === root.cur && !root.over) { ctx.strokeStyle = theme.accent; ctx.lineWidth = 3; ctx.strokeRect(x + 2, y + 2, w - 4, hh - 4) }
        ctx.fillStyle = theme.foreground; ctx.font = Math.floor(Math.min(ch * 0.4, cw * 0.38 * (c.w > 1 ? 1.4 : 1))) + "px " + theme.fontFamily
        ctx.fillText(c.label, x + w / 2, y + hh / 2)
        var amt = s.bets[c.id]
        if (amt) {
          ctx.fillStyle = theme.highlight; ctx.beginPath(); ctx.arc(x + w / 2, y + hh * 0.72, ch * 0.24, 0, Math.PI * 2); ctx.fill()
          ctx.fillStyle = theme.background; ctx.font = "bold " + Math.floor(ch * 0.26) + "px " + theme.fontFamily
          ctx.fillText(String(amt), x + w / 2, y + hh * 0.72)
        }
      }
      // Chip selector and the spin button.
      var ry = gy + ch * 5.35
      for (var k = 0; k < 4; ++k) {
        var cx = cw + k * cw * 1.4 + cw * 0.5
        ctx.fillStyle = k === s.chip ? theme.highlight : theme.faint; ctx.beginPath(); ctx.arc(cx, ry + ch * 0.45, ch * 0.4, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = k === s.chip ? theme.background : theme.dim; ctx.font = "bold " + Math.floor(ch * 0.3) + "px " + theme.fontFamily
        ctx.fillText(String(Rou.CHIPS[k]), cx, ry + ch * 0.45)
      }
      var staked = Rou.staked(s)
      ctx.fillStyle = staked > 0 && s.phase === "bet" ? theme.accent : theme.faint
      ctx.fillRect(width - cw * 3, ry, cw * 2.8, ch * 0.9)
      ctx.fillStyle = staked > 0 && s.phase === "bet" ? theme.background : theme.dim; ctx.font = "bold " + Math.floor(ch * 0.4) + "px " + theme.fontFamily
      ctx.fillText("SPIN", width - cw * 1.6, ry + ch * 0.45)
      if (root.paused) { ctx.fillStyle = theme.background; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1 }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
