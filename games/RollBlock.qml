import QtQuick
import "../engine" as Engine
import "logic/rollblock.js" as Roll

// Roll Block (after Bloxorz); see logic/rollblock.js.
Engine.GameBase {
  id: root
  gameId: "rollblock"
  title: "ROLL BLOCK"
  helpText: "ARROWS tip the block over · drop it upright into the hole · off the edge and the level starts again · orange tiles crack under the block standing · a round switch works with any part of the block, a cross switch only standing up; both swing the bridges · U undo · R restart the level · 200 a level, minus 10 a move over par"
  mouseHelp: "Click beside the block to tip it that way"

  property var state: null
  tickInterval: 16
  ticking: !!state && !over
  score: state ? state.score : 0
  progress: state ? "level " + (state.level + 1) + "/" + Roll.LEVELS.length : ""
  overTitle: "ALL " + Roll.LEVELS.length + " CLEARED"
  status: !state ? ""
    : over ? state.score + " points · " + state.falls + " falls  ·  SPACE to play again"
    : paused ? "PAUSED"
    : "LEVEL " + (state.level + 1) + "/" + Roll.LEVELS.length + "  ·  moves " + state.moves + "  ·  par " + Roll.PARS[state.level]

  onTick: {
    state = Roll.step(state, tickInterval / 1000)
    if (state.done) over = true
  }

  function newGame() { state = Roll.makeState(); over = false; paused = false }
  function moveCursor(dx, dy) { if (state && !over) state = Roll.move(state, dx, dy) }
  function activate() { if (over) newGame() }
  function undo() { if (state && !over) state = Roll.undo(state) }
  function handleKey(key, text) {
    if ((text === "r" || text === "R") && state && !over) {
      var s = Roll.shallow(state), keep = s.total
      Roll.startLevel(s, s.level); s.total = keep
      state = s
      return true
    }
    return false
  }

  function pointer(kind, x, y, b) {
    if (!state || over || kind !== "press") return
    var L = board.layout(), c = Roll.cells(state.block), mx = 0, my = 0
    for (var i = 0; i < c.length; ++i) { mx += c[i][0] + 0.5; my += c[i][1] + 0.5 }
    mx = L.gx + mx / c.length * L.u; my = L.gy + my / c.length * L.v
    var dx = x - mx, dy = (y - my) / 0.75
    if (Math.abs(dx) > Math.abs(dy)) state = Roll.move(state, dx > 0 ? 1 : -1, 0)
    else state = Roll.move(state, 0, dy > 0 ? 1 : -1)
  }

  function saveState() { return state && !over ? { level: state.level, score: state.score, falls: state.falls, total: state.total } : null }
  function loadState(saved) {
    newGame()
    if (saved && saved.level !== undefined && saved.level < Roll.LEVELS.length) {
      var s = Roll.shallow(state)
      Roll.startLevel(s, saved.level); s.score = saved.score; s.falls = saved.falls; s.total = saved.total
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

    // Tiles are u wide and v (= 0.75u) deep on screen; height lifts things
    // by 0.55u per unit.
    function layout() {
      var m = root.state.map
      var u = Math.min(width / (m.w + 1), height / (m.h * 0.75 + 2.2))
      var v = u * 0.75, lift = u * 0.55
      return { u: u, v: v, lift: lift, gx: (width - m.w * u) / 2, gy: (height - m.h * v) / 2 + lift }
    }

    // A box with footprint (x, y, w, d) in tiles, h tall, bottom at z.
    function box(ctx, L, x, y, w, d, h, z, top, front) {
      var sx = L.gx + x * L.u, sy = L.gy + y * L.v - (z + h) * L.lift
      ctx.fillStyle = top
      ctx.fillRect(sx, sy, w * L.u, d * L.v)
      ctx.fillStyle = front
      ctx.fillRect(sx, sy + d * L.v, w * L.u, h * L.lift)
      ctx.strokeStyle = theme.withAlpha(theme.background, 0.5); ctx.lineWidth = 1
      ctx.strokeRect(sx + 0.5, sy + 0.5, w * L.u - 1, d * L.v - 1)
    }

    function footprint(b) {
      return b.o === "S" ? { x: b.x, y: b.y, w: 1, d: 1, h: 2 } : b.o === "H" ? { x: b.x, y: b.y, w: 2, d: 1, h: 1 } : { x: b.x, y: b.y, w: 1, d: 2, h: 1 }
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state, m = s.map, L = layout(), u = L.u, v = L.v
      var slab = 0.35

      for (var y = 0; y < m.h; ++y) for (var x = 0; x < m.w; ++x) {
        var t = m.tiles[y][x]
        if (t === ".") continue
        var bridge = t === "b" || t === "B"
        if (bridge && !s.out) {
          ctx.strokeStyle = theme.withAlpha(theme.tone(5), 0.4); ctx.lineWidth = 1
          ctx.strokeRect(L.gx + x * u + 3, L.gy + y * v + 3, u - 6, v - 6)
          continue
        }
        if (t === "G") {
          ctx.fillStyle = theme.withAlpha(theme.foreground, 0.85)
          ctx.fillRect(L.gx + x * u, L.gy + y * v, u, v)
          ctx.fillStyle = theme.background
          ctx.fillRect(L.gx + x * u + u * 0.12, L.gy + y * v + v * 0.12, u * 0.76, v * 0.76)
          continue
        }
        var top = t === "F" ? theme.withAlpha(theme.tone(3), 0.8) : bridge ? theme.withAlpha(theme.tone(5), 0.7) : theme.withAlpha(theme.foreground, (x + y) % 2 ? 0.22 : 0.28)
        box(ctx, L, x, y, 1, 1, slab, -slab, top, theme.withAlpha(theme.foreground, 0.1))
        var cx = L.gx + (x + 0.5) * u, cy = L.gy + (y + 0.5) * v
        if (t === "o") { ctx.strokeStyle = theme.accent; ctx.lineWidth = Math.max(2, u * 0.08); ctx.beginPath(); ctx.ellipse(cx - u * 0.25, cy - v * 0.25, u * 0.5, v * 0.5); ctx.stroke() }
        if (t === "x") {
          ctx.strokeStyle = theme.accent; ctx.lineWidth = Math.max(2, u * 0.08)
          ctx.beginPath(); ctx.moveTo(cx - u * 0.25, cy - v * 0.25); ctx.lineTo(cx + u * 0.25, cy + v * 0.25); ctx.moveTo(cx + u * 0.25, cy - v * 0.25); ctx.lineTo(cx - u * 0.25, cy + v * 0.25); ctx.stroke()
        }
      }

      // The block: tweened between footprints while it tips; falls sink.
      var fp = footprint(s.block), z = 0, alpha = 1
      if (s.anim) {
        var a = footprint(s.anim.from), b = footprint(s.anim.to), k = s.anim.result === "fall" ? Math.min(1, s.anim.t * 3) : s.anim.t
        var e = k * k * (3 - 2 * k)
        fp = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, w: a.w + (b.w - a.w) * e, d: a.d + (b.d - a.d) * e, h: a.h + (b.h - a.h) * e }
        z = Math.sin(Math.PI * e) * 0.35
        if (s.anim.result === "fall" && s.anim.t > 0.33) { z = -(s.anim.t - 0.33) * 6; alpha = Math.max(0, 1 - (s.anim.t - 0.33) * 1.5) }
        if (s.anim.result === "win" && e > 0.9) z = -(e - 0.9) * 10
      }
      ctx.globalAlpha = alpha
      box(ctx, L, fp.x, fp.y, fp.w, fp.d, fp.h, z, theme.accent, theme.withAlpha(theme.accent, 0.65))
      ctx.globalAlpha = 1

      ctx.textAlign = "center"; ctx.textBaseline = "top"
      ctx.fillStyle = theme.dim
      ctx.font = "bold " + Math.floor(Math.max(12, u * 0.35)) + "px " + theme.fontFamily
      ctx.fillText("LEVEL " + (s.level + 1) + "  ·  " + s.moves + " / par " + Roll.PARS[s.level], width / 2, 6)
      if (s.msgT > 0) {
        ctx.textBaseline = "bottom"
        ctx.fillStyle = s.msg.indexOf("FELL") === 0 ? theme.danger : theme.accent
        ctx.font = "bold " + Math.floor(Math.max(13, u * 0.45)) + "px " + theme.fontFamily
        ctx.fillText(s.msg, width / 2, height - 6)
      }
      if (root.paused) {
        ctx.fillStyle = theme.background; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
