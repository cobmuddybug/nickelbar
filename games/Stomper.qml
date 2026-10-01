import QtQuick
import "../engine" as Engine
import "logic/stomper.js" as Stomp

// Stomper (see logic/stomper.js): a platformer. The logic mutates its state in
// place each frame, so `frame` is what tells the canvas and the status to refresh.
Engine.GameBase {
  id: root
  gameId: "stomper"
  difficulties: ["Easy", "Normal", "Hard"]
  onDifficultyChanged: Stomp.setDifficulty(difficulty)
  title: "STOMPER"
  helpText: "LEFT/RIGHT run · SPACE or UP jump, hold for a higher jump · Land on Gribbles and Shellbacks to stomp them; a stomped Shellback can be kicked · Bonk ? blocks from below for coins; some hold a Super Berry that makes you big · Big, you smash bricks and survive one hit · Reach the flag before the clock runs out · Endless levels, each a bit harder · Three lives · U undo"
  mouseHelp: "Hold the left or right half of the board to run; click the upper half to jump"

  property var state: null
  property int frame: 0
  property int mouseDir: 0
  tickInterval: 16
  ticking: !!state && !state.done
  continuousMove: true
  score: state ? state.score : 0
  overTitle: state ? "ZONE " + state.level + " · " + state.score : ""
  progress: state ? "zone " + state.level : ""
  status: !state || frame < 0 ? ""
    : over ? "GAME OVER at zone " + state.level + "  ·  SPACE to play again"
    : paused ? "PAUSED"
    : "ZONE " + state.level + "  ·  ♥ " + state.lives + "  ·  ● " + state.coins + "  ·  " + Math.ceil(state.time) + "s" + (state.status === "clear" ? "  ·  COURSE CLEAR!" : "")

  onTick: {
    var dx = heldDx || mouseDir
    var next = Stomp.step(state, tickInterval / 1000, { dx: dx, jump: heldAction || heldDy < 0, view: board.width / board.u })
    if (next !== state) state = next
    for (var i = 0; i < next.ev.length; ++i) root.sound(next.ev[i])
    frame = next.rev
    if (next.done) over = true
  }

  function newGame() { state = Stomp.makeState(1); over = false; paused = false; frame = 0; mouseDir = 0 }
  function moveCursor(dx, dy) { if (dy < 0) activate() }
  function activate() { if (over) newGame(); else if (state) Stomp.jump(state) }
  function saveState() { return !state || over ? null : Stomp.serialize(state) }
  function loadState(saved) { var s = Stomp.deserialize(saved); if (s) { state = s; over = false } else newGame() }

  function pointer(kind, x, y, b) {
    if (!state) return
    if (kind === "press") {
      if (y < board.height * 0.45) activate()
      else mouseDir = x < board.width / 2 ? -1 : 1
    } else if (kind === "release") mouseDir = 0
    else if (kind === "drag" && y >= board.height * 0.45) mouseDir = x < board.width / 2 ? -1 : 1
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.fill: parent
    readonly property real u: height / 14

    Connections {
      target: root
      function onFrameChanged() { board.requestPaint() }
      function onStateChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      var s = root.state
      if (!s) return
      var u = board.u, cam = s.cam
      var X = function(x) { return (x - cam) * u }, Y = function(y) { return y * u }
      ctx.fillStyle = theme.withAlpha(theme.tone(1), 0.1); ctx.fillRect(0, 0, width, height)
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      var x0 = Math.max(0, Math.floor(cam)), x1 = Math.min(s.W - 1, Math.ceil(cam + width / u) + 1)
      for (var ty = 0; ty < Stomp.H; ++ty) for (var tx = x0; tx <= x1; ++tx) {
        var ch = s.tiles[ty][tx]
        if (ch === ".") continue
        var px = X(tx), py = Y(ty)
        if (ch === "#") {
          ctx.fillStyle = theme.withAlpha(theme.tone(2), 0.75); ctx.fillRect(px, py, u + 0.5, u + 0.5)
          if (ty === 0 || s.tiles[ty - 1][tx] === "." || s.tiles[ty - 1][tx] === "c") { ctx.fillStyle = theme.tone(4); ctx.fillRect(px, py, u + 0.5, u * 0.18) }
        } else if (ch === "B") {
          ctx.fillStyle = theme.tone(3); ctx.fillRect(px + 0.5, py + 0.5, u - 1, u - 1)
          ctx.strokeStyle = theme.withAlpha(theme.background, 0.5); ctx.lineWidth = 1
          ctx.strokeRect(px + 2, py + 2, u - 4, u / 2 - 3); ctx.strokeRect(px + 2, py + u / 2, u - 4, u / 2 - 3)
        } else if (ch === "?" || ch === "M") {
          ctx.fillStyle = theme.highlight; ctx.fillRect(px + 0.5, py + 0.5, u - 1, u - 1)
          ctx.fillStyle = theme.background; ctx.font = "bold " + Math.floor(u * 0.7) + "px " + theme.fontFamily
          ctx.fillText("?", px + u / 2, py + u / 2 + 1)
        } else if (ch === "E") {
          ctx.fillStyle = theme.dim; ctx.fillRect(px + 0.5, py + 0.5, u - 1, u - 1)
        } else if (ch === "p") {
          ctx.fillStyle = theme.tone(4); ctx.fillRect(px, py, u + 0.5, u + 0.5)
          ctx.fillStyle = theme.withAlpha(theme.background, 0.3); ctx.fillRect(px + u * 0.15, py, u * 0.12, u + 0.5)
          if (s.tiles[ty - 1][tx] !== "p") { ctx.fillStyle = theme.tone(4); ctx.fillRect(px - 2, py, u + 4.5, u * 0.35) }
        } else if (ch === "c") {
          ctx.fillStyle = theme.highlight; ctx.beginPath(); ctx.ellipse(px + u * 0.3, py + u * 0.2, u * 0.4, u * 0.6); ctx.fill()
        } else if (ch === "F") {
          ctx.fillStyle = theme.foreground; ctx.fillRect(px + u * 0.45, py, u * 0.1, u + 0.5)
          if (ty === Stomp.G - 9) { ctx.fillStyle = theme.danger; ctx.beginPath(); ctx.moveTo(px + u * 0.45, py + u * 0.1); ctx.lineTo(px - u * 0.7, py + u * 0.4); ctx.lineTo(px + u * 0.45, py + u * 0.7); ctx.fill() }
        }
      }
      // Creatures.
      s.ents.forEach(function(e) {
        var ex = X(e.x), ey = Y(e.y), w = e.w * u, h = e.h * u
        if (ex < -u * 2 || ex > width + u * 2) return
        if (e.dead > 0 && e.mode === "knocked") { ctx.save(); ctx.translate(ex + w / 2, ey + h / 2); ctx.scale(1, -1); ctx.translate(-(ex + w / 2), -(ey + h / 2)) }
        if (e.type === "berry") {
          ctx.fillStyle = theme.danger; ctx.beginPath(); ctx.arc(ex + w / 2, ey + h * 0.55, w * 0.45, 0, Math.PI * 2); ctx.fill()
          ctx.fillStyle = theme.tone(4); ctx.fillRect(ex + w * 0.45, ey, w * 0.1, h * 0.2)
        } else if (e.type === "gribble") {
          ctx.fillStyle = theme.tone(2)
          if (e.mode === "squashed") ctx.fillRect(ex, ey, w, h)
          else {
            ctx.beginPath(); ctx.arc(ex + w / 2, ey + h * 0.5, w * 0.5, Math.PI, 0); ctx.lineTo(ex + w, ey + h * 0.7); ctx.lineTo(ex, ey + h * 0.7); ctx.fill()
            ctx.fillStyle = theme.foreground; var step = Math.floor(s.t * 6) % 2
            ctx.fillRect(ex + w * 0.1 + step * 2, ey + h * 0.72, w * 0.3, h * 0.28); ctx.fillRect(ex + w * 0.6 - step * 2, ey + h * 0.72, w * 0.3, h * 0.28)
            ctx.fillStyle = theme.background; ctx.fillRect(ex + w * 0.28, ey + h * 0.32, w * 0.14, h * 0.2); ctx.fillRect(ex + w * 0.58, ey + h * 0.32, w * 0.14, h * 0.2)
          }
        } else {
          var still = e.mode === "shellstill" || e.mode === "slide"
          ctx.fillStyle = theme.tone(4); ctx.beginPath(); ctx.ellipse(ex, ey + h * (still ? 0.1 : 0.3), w, h * (still ? 0.9 : 0.7)); ctx.fill()
          ctx.fillStyle = theme.withAlpha(theme.background, 0.35); ctx.fillRect(ex + w * 0.3, ey + h * 0.3, w * 0.1, h * 0.5)
          if (!still) { ctx.fillStyle = theme.tone(1); ctx.beginPath(); ctx.arc(ex + (e.vx < 0 ? w * 0.1 : w * 0.9), ey + h * 0.15, w * 0.22, 0, Math.PI * 2); ctx.fill() }
        }
        if (e.dead > 0 && e.mode === "knocked") ctx.restore()
      })
      s.bits.forEach(function(b) { ctx.fillStyle = theme.tone(3); ctx.fillRect(X(b.x), Y(b.y), u * 0.25, u * 0.25) })
      // The hero: cap, face, overalls, little legs that swing as he runs.
      var p = s.p, hx = X(p.x), hy = Y(p.y), pw = p.w * u, ph = p.h * u
      if (!(p.inv > 0 && Math.floor(s.t * 14) % 2 === 0)) {
        var dir = p.dir, bodyH = ph * (p.big ? 0.5 : 0.5)
        ctx.fillStyle = theme.accent; ctx.fillRect(hx + pw * 0.1, hy + ph * 0.4, pw * 0.8, bodyH * 0.9)                        // overalls
        ctx.fillStyle = theme.tone(3); ctx.beginPath(); ctx.arc(hx + pw / 2, hy + ph * 0.24, pw * 0.42, 0, Math.PI * 2); ctx.fill() // head
        ctx.fillStyle = theme.danger; ctx.beginPath(); ctx.arc(hx + pw / 2, hy + ph * 0.18, pw * 0.44, Math.PI, 0); ctx.fill()      // cap
        ctx.fillRect(hx + pw * (dir > 0 ? 0.5 : 0.0), hy + ph * 0.18, pw * 0.55, ph * 0.05)
        ctx.fillStyle = theme.background; ctx.fillRect(hx + pw * (dir > 0 ? 0.62 : 0.28), hy + ph * 0.22, pw * 0.1, ph * 0.07)
        var leg = p.ground ? Math.sin(p.anim * 3) * pw * 0.15 : pw * 0.1
        ctx.fillStyle = theme.foreground; ctx.fillRect(hx + pw * 0.12 + leg, hy + ph * 0.88, pw * 0.3, ph * 0.12); ctx.fillRect(hx + pw * 0.58 - leg, hy + ph * 0.88, pw * 0.3, ph * 0.12)
      }
      s.pops.forEach(function(q) {
        ctx.fillStyle = theme.withAlpha(theme.foreground, Math.min(1, q.life * 2)); ctx.font = "bold " + Math.floor(u * 0.45) + "px " + theme.fontFamily
        ctx.fillText(q.text, X(q.x), Y(q.y))
      })
      // A small HUD along the top.
      ctx.textAlign = "left"; ctx.fillStyle = theme.foreground; ctx.font = "bold " + Math.floor(u * 0.5) + "px " + theme.fontFamily
      ctx.fillText("● " + s.coins + "   " + Math.ceil(s.time), 10, u * 0.6)
      if (s.status === "dead") { ctx.fillStyle = theme.withAlpha(theme.background, 0.5); ctx.fillRect(0, 0, width, height) }
      if (root.paused) { ctx.fillStyle = theme.background; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1 }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
