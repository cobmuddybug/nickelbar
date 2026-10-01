import QtQuick
import "../engine" as Engine
import "logic/roadrally.js" as Rally

// Road Rally (after Road Fighter): a top-down race against a fuel gauge. The
// road scrolls down the screen; weave through traffic, grab fuel cans, and
// reach each checkpoint. See logic/roadrally.js.
Engine.GameBase {
  id: root
  gameId: "roadrally"
  difficulties: ["Easy", "Normal", "Hard"]
  onDifficultyChanged: Rally.setDifficulty(difficulty)
  title: "ROAD RALLY"
  ownSounds: true
  helpText: "LEFT/RIGHT steer · UP gas · DOWN brake · hold SPACE for turbo (faster, burns fuel) · Drive through the F cans to refuel · Reach each checkpoint flag for +35 fuel and a bonus · Ramming the back of a car at speed, or the roadside wall, is a crash · Oil makes you skid · Slow trucks, weaving cars · Run out of fuel and it's over"
  mouseHelp: "Move the pointer to steer; hold LEFT for gas, RIGHT for turbo"

  property var state: null
  property bool mouseGas: false
  property bool mouseTurbo: false
  property var mouseTarget: null

  tickInterval: 16
  continuousMove: true
  ticking: !!state && state.alive && !over
  score: state ? Math.floor(state.score) : 0
  overTitle: state ? "SCORE " + Math.floor(state.score) : ""
  progress: state ? "stage " + state.stage : ""
  status: !state ? ""
    : over ? state.why + " at stage " + state.stage + "  ·  " + Math.floor(state.score) + " points  ·  SPACE for a new race"
    : paused ? "PAUSED"
    : "STAGE " + state.stage + "  ·  FUEL " + Math.ceil(state.fuel) + "  ·  " + Math.round(state.v * 14.5) + " km/h  ·  SCORE " + Math.floor(state.score)

  onTick: {
    var s = Rally.step(state, {
      dx: heldDx, up: heldDy < 0 || mouseGas, down: heldDy > 0,
      turbo: heldAction || mouseTurbo, target: heldDx !== 0 ? null : mouseTarget
    }, tickInterval / 1000)
    if (heldDx !== 0) mouseTarget = null
    if (s !== state) { state = s; playEvents(s) }
    if (!state.alive) over = true
  }

  function newGame() { state = Rally.makeState(); over = false; paused = false; mouseGas = false; mouseTurbo = false; mouseTarget = null; lastEvSeq = 0 }
  function moveCursor(dx, dy) {}
  function activate() { if (over) newGame() }
  function saveState() { return state && !over ? Rally.serialize(state) : null }
  function loadState(saved) {
    var r = Rally.deserialize(saved)
    if (r) { state = r; over = !r.alive } else newGame()
  }

  function pointer(kind, x, y, b) {
    if (!state || over) return
    if (kind === "move" || kind === "drag" || kind === "press") mouseTarget = (x - board.width / 2) / board.xs
    if (kind === "press") { if (b === Qt.RightButton) mouseTurbo = true; else if (b === Qt.LeftButton) mouseGas = true }
    if (kind === "release") { if (b === Qt.RightButton) mouseTurbo = false; else if (b === Qt.LeftButton) mouseGas = false }
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root; shape: Qt.CrossCursor }
    anchors.fill: parent

    readonly property real ys: height / 14           // pixels per unit of distance
    readonly property real xs: Math.min(width / 9, height / 7)   // pixels per lane
    readonly property real py: height * 0.75         // where the player's car sits

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onOverChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    function hash(n) { var x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x) }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      var s = root.state
      if (!s || width <= 0 || height <= 0) return
      var W = width, H = height, ys = board.ys, xs = board.xs, py = board.py
      var off0 = Rally.roadOff(s.d)
      function rowD(y) { return s.d + (py - y) / ys }
      function cx(d) { return W / 2 + (Rally.roadOff(d) - off0) * xs }
      function sy(d) { return py - (d - s.d) * ys }
      var grass = Math.abs(s.p) > 1.88
      ctx.save()
      if (grass && s.v > 2) ctx.translate(0, Math.sin(s.t * 90) * 1.6)

      ctx.fillStyle = theme.background; ctx.fillRect(0, 0, W, H)
      // ---- ground, road, kerbs, lane dashes (drawn in thin horizontal strips)
      var strip = 2
      for (var y = 0; y < H; y += strip) {
        var d = rowD(y + strip / 2), c = cx(d)
        var band = Math.floor(d / 2.2) % 2 === 0
        ctx.fillStyle = theme.withAlpha(theme.named("green", 3), band ? 0.2 : 0.27)
        ctx.fillRect(0, y, W, strip)
        var kb = Math.floor(d / 0.9) % 2 === 0
        ctx.fillStyle = kb ? theme.danger : theme.foreground
        ctx.fillRect(c - 2.4 * xs, y, 0.4 * xs, strip); ctx.fillRect(c + 2.0 * xs, y, 0.4 * xs, strip)
        ctx.fillStyle = theme.withAlpha(theme.foreground, 0.16)
        ctx.fillRect(c - 2.0 * xs, y, 4 * xs, strip)
        ctx.fillStyle = theme.withAlpha(theme.foreground, 0.7)
        ctx.fillRect(c - 2.0 * xs, y, 0.07 * xs, strip); ctx.fillRect(c + 2.0 * xs - 0.07 * xs, y, 0.07 * xs, strip)
        if (Math.floor(d / 1.6) % 2 === 0) {
          ctx.fillStyle = theme.dim
          for (var ln = -1; ln <= 1; ++ln) ctx.fillRect(c + ln * xs - 0.03 * xs, y, 0.06 * xs, strip)
        }
      }

      // ---- roadside trees and posts
      var dTop = rowD(-40), dBot = rowD(H + 40)
      for (var k = Math.floor(dBot / 2.6); k <= Math.ceil(dTop / 2.6); ++k) {
        var h1 = board.hash(k), h2 = board.hash(k + 91)
        if (h1 < 0.3) continue
        var side = h2 < 0.5 ? -1 : 1
        var dd = k * 2.6 + h1 * 1.5, tx = cx(dd) + side * (2.9 + h2 * 2.6) * xs, ty = sy(dd)
        if (tx < -30 || tx > W + 30) continue
        var tw = xs * (0.55 + h1 * 0.35)
        ctx.fillStyle = theme.withAlpha(theme.background, 0.55); ctx.fillRect(tx - tw * 0.45 + 3, ty - tw * 0.3 + 4, tw, tw)
        ctx.fillStyle = theme.dim; ctx.fillRect(tx - tw * 0.08, ty + tw * 0.1, tw * 0.16, tw * 0.3)
        ctx.fillStyle = theme.named("bright_green", 3); ctx.fillRect(tx - tw / 2, ty - tw * 0.55, tw, tw * 0.75)
        ctx.fillStyle = theme.withAlpha(theme.background, 0.3); ctx.fillRect(tx, ty - tw * 0.55, tw * 0.5, tw * 0.75)
        ctx.fillStyle = theme.withAlpha(theme.foreground, 0.25); ctx.fillRect(tx - tw / 2, ty - tw * 0.55, tw, tw * 0.12)
      }

      // ---- checkpoint line
      var ey = sy(s.stageEnd)
      if (ey > -30 && ey < H + 30) {
        var ec = cx(s.stageEnd), sq = xs * 0.25
        for (var qy = 0; qy < 2; ++qy) for (var qx = 0; qx < 16; ++qx) {
          ctx.fillStyle = (qx + qy) % 2 === 0 ? theme.foreground : theme.background
          ctx.fillRect(ec - 2 * xs + qx * sq, ey - sq + qy * sq, sq + 0.5, sq + 0.5)
        }
        ctx.fillStyle = theme.accent; ctx.font = "bold " + Math.floor(xs * 0.34) + "px " + theme.fontFamily; ctx.textAlign = "center"; ctx.textBaseline = "bottom"
        ctx.fillText("CHECKPOINT", ec, ey - sq * 1.4)
      }

      // ---- a pixel-style car, nose up: body, windscreen, wheels, lights
      function car(x, y, w, len, body, trim, glass, spin) {
        ctx.save(); ctx.translate(x, y); if (spin) ctx.rotate(spin)
        var hw = w / 2, hl = len / 2, wh = w * 0.2, whl = len * 0.2
        ctx.fillStyle = theme.withAlpha(theme.background, 0.5); ctx.fillRect(-hw + 3, -hl + 4, w, len)
        ctx.fillStyle = theme.background
        ctx.fillRect(-hw - wh * 0.6, -hl * 0.72, wh, whl); ctx.fillRect(hw - wh * 0.4, -hl * 0.72, wh, whl)
        ctx.fillRect(-hw - wh * 0.6, hl * 0.42, wh, whl); ctx.fillRect(hw - wh * 0.4, hl * 0.42, wh, whl)
        ctx.fillStyle = body; ctx.fillRect(-hw, -hl, w, len)
        ctx.fillStyle = trim; ctx.fillRect(-hw * 0.18, -hl, hw * 0.36, len)
        ctx.fillStyle = glass; ctx.fillRect(-hw * 0.72, -hl * 0.34, w * 0.72, len * 0.2)
        ctx.fillRect(-hw * 0.72, hl * 0.3, w * 0.72, len * 0.1)
        ctx.fillStyle = theme.highlight; ctx.fillRect(-hw * 0.9, -hl, w * 0.22, len * 0.06); ctx.fillRect(hw * 0.68, -hl, w * 0.22, len * 0.06)
        ctx.fillStyle = theme.danger; ctx.fillRect(-hw * 0.9, hl - len * 0.05, w * 0.22, len * 0.05); ctx.fillRect(hw * 0.68, hl - len * 0.05, w * 0.22, len * 0.05)
        ctx.restore()
      }
      function truck(x, y, w, len, body) {
        ctx.save(); ctx.translate(x, y)
        var hw = w / 2, hl = len / 2
        ctx.fillStyle = theme.withAlpha(theme.background, 0.5); ctx.fillRect(-hw + 3, -hl + 4, w, len)
        ctx.fillStyle = theme.background
        ctx.fillRect(-hw - 3, -hl * 0.8, 4, len * 0.14); ctx.fillRect(hw - 1, -hl * 0.8, 4, len * 0.14)
        ctx.fillRect(-hw - 3, hl * 0.55, 4, len * 0.14); ctx.fillRect(hw - 1, hl * 0.55, 4, len * 0.14)
        ctx.fillRect(-hw - 3, hl * 0.2, 4, len * 0.14); ctx.fillRect(hw - 1, hl * 0.2, 4, len * 0.14)
        ctx.fillStyle = body; ctx.fillRect(-hw * 0.9, -hl, w * 0.9, len * 0.28)          // cab
        ctx.fillStyle = theme.withAlpha(theme.foreground, 0.85); ctx.fillRect(-hw, -hl * 0.38, w, len * 0.72)   // box
        ctx.fillStyle = theme.withAlpha(theme.background, 0.25); ctx.fillRect(-hw, -hl * 0.38, w * 0.5, len * 0.72)
        ctx.fillStyle = theme.background; ctx.fillRect(-hw * 0.7, -hl * 0.84, w * 0.7, len * 0.08)
        ctx.fillStyle = theme.danger; ctx.fillRect(-hw * 0.9, hl - len * 0.04, w * 0.25, len * 0.04); ctx.fillRect(hw * 0.65, hl - len * 0.04, w * 0.25, len * 0.04)
        ctx.restore()
      }

      // ---- oil, fuel cans
      for (var i = 0; i < s.slicks.length; ++i) {
        var sl = s.slicks[i], ox = cx(sl.d) + sl.q * xs, oy = sy(sl.d)
        if (oy < -30 || oy > H + 30) continue
        ctx.fillStyle = theme.withAlpha(theme.background, 0.9)
        ctx.beginPath(); ctx.ellipse(ox - xs * 0.5, oy - xs * 0.3, xs, xs * 0.6); ctx.fill()
        ctx.fillStyle = theme.withAlpha(theme.tone(1), 0.45)
        ctx.beginPath(); ctx.ellipse(ox - xs * 0.3, oy - xs * 0.18, xs * 0.5, xs * 0.2); ctx.fill()
      }
      for (i = 0; i < s.cans.length; ++i) {
        var cn = s.cans[i], fx = cx(cn.d) + cn.q * xs, fy = sy(cn.d)
        if (fy < -30 || fy > H + 30) continue
        var fw = xs * 0.48, fh = xs * 0.6, bob = Math.sin(s.t * 6 + cn.d) * 2
        ctx.fillStyle = theme.withAlpha(theme.background, 0.5); ctx.fillRect(fx - fw / 2 + 3, fy - fh / 2 + 4, fw, fh)
        ctx.fillStyle = theme.named("bright_yellow", 2); ctx.fillRect(fx - fw / 2, fy - fh / 2 + bob, fw, fh)
        ctx.fillStyle = theme.foreground; ctx.fillRect(fx - fw * 0.2, fy - fh / 2 - fh * 0.14 + bob, fw * 0.4, fh * 0.14)
        ctx.fillStyle = theme.background; ctx.font = "bold " + Math.floor(fh * 0.7) + "px " + theme.fontFamily
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("F", fx, fy + bob + 1)
      }

      // ---- traffic, far to near
      var cars = s.cars.slice().sort(function(a, b) { return b.d - a.d })
      for (i = 0; i < cars.length; ++i) {
        var cr = cars[i], kx = cx(cr.d) + cr.q * xs, ky = sy(cr.d)
        if (ky < -cr.len * ys || ky > H + cr.len * ys) continue
        var cw = cr.w * xs, cl = cr.len * ys
        if (cr.kind === "truck") truck(kx, ky, cw, cl, theme.tone(5))
        else if (cr.kind === "weaver") car(kx, ky, cw, cl, theme.tone(4), theme.withAlpha(theme.background, 0.35), theme.background, 0)
        else car(kx, ky, cw, cl, theme.tone(1), theme.withAlpha(theme.foreground, 0.5), theme.background, 0)
      }

      // ---- the player
      var px = W / 2 + s.p * xs, pw = 0.6 * xs, pl = 1.5 * ys
      var blink = s.inv > 0 && s.crashT <= 0 && Math.floor(s.t * 14) % 2 === 0
      var spin = s.crashT > 0 ? (1 - s.crashT / 1.3) * Math.PI * 4 : (s.skidT > 0 ? Math.sin(s.t * 22) * 0.32 : 0)
      if (s.turboOn) {
        ctx.fillStyle = theme.tone(4); ctx.fillRect(px - pw * 0.3, py + pl / 2, pw * 0.2, pl * 0.35 + Math.sin(s.t * 70) * 3)
        ctx.fillRect(px + pw * 0.1, py + pl / 2, pw * 0.2, pl * 0.35 + Math.cos(s.t * 70) * 3)
        ctx.fillStyle = theme.highlight; ctx.fillRect(px - pw * 0.26, py + pl / 2, pw * 0.12, pl * 0.18); ctx.fillRect(px + pw * 0.14, py + pl / 2, pw * 0.12, pl * 0.18)
      }
      if (!blink) car(px, py, pw, pl, theme.accent, theme.foreground, theme.background, spin)

      // ---- bursts
      for (i = 0; i < s.bursts.length; ++i) {
        var bu = s.bursts[i], bx = cx(bu.d) + bu.q * xs, by = sy(bu.d), br = xs * (0.3 + bu.age * 2.4)
        ctx.globalAlpha = Math.max(0, 1 - bu.age / 0.7)
        for (var sp = 0; sp < 8; ++sp) {
          var a = sp * Math.PI / 4 + bu.age * 2, pr = br * (sp % 2 ? 0.7 : 1), sz = Math.max(3, xs * 0.18 * (1 - bu.age))
          ctx.fillStyle = sp % 3 === 0 ? theme.highlight : (sp % 3 === 1 ? theme.tone(4) : theme.danger)
          ctx.fillRect(bx + Math.cos(a) * pr - sz / 2, by + Math.sin(a) * pr - sz / 2, sz, sz)
        }
        ctx.globalAlpha = 1
      }
      ctx.restore()

      // ---- hud
      var low = s.fuel < 25
      ctx.fillStyle = theme.withAlpha(theme.background, 0.72); ctx.fillRect(0, 0, W, 34); ctx.fillRect(0, H - 40, 150, 40)
      ctx.textBaseline = "top"; ctx.font = "bold 15px " + theme.fontFamily
      ctx.textAlign = "left"; ctx.fillStyle = theme.foreground; ctx.fillText("FUEL", 12, 10)
      ctx.fillStyle = theme.withAlpha(theme.background, 0.7); ctx.fillRect(56, 10, 128, 14)
      ctx.fillStyle = low && Math.floor(s.t * 5) % 2 === 0 ? theme.danger : theme.named("bright_green", 3)
      ctx.fillRect(58, 12, 124 * Math.max(0, s.fuel) / 100, 10)
      ctx.strokeStyle = theme.foreground; ctx.lineWidth = 1; ctx.strokeRect(56.5, 10.5, 127, 13)
      ctx.textAlign = "right"; ctx.fillStyle = theme.foreground; ctx.fillText(String(Math.floor(s.score)), W - 12, 10)
      ctx.textAlign = "center"; ctx.fillText("STAGE " + s.stage, W / 2, 10)
      ctx.textAlign = "left"; ctx.font = "bold 18px " + theme.fontFamily
      ctx.fillStyle = s.turboOn ? theme.tone(4) : theme.foreground
      ctx.fillText(Math.round(s.v * 14.5) + " km/h", 12, H - 30)
      // progress to the checkpoint, down the left edge
      var len0 = Rally.stageLength(s.stage), prog = Math.max(0, Math.min(1, 1 - (s.stageEnd - s.d) / len0))
      var tt = H * 0.18, tb = H * 0.62
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.2); ctx.fillRect(W - 18, tt, 6, tb - tt)
      ctx.fillStyle = theme.accent; ctx.fillRect(W - 24, tb - (tb - tt) * prog - 4, 18, 8)
      ctx.fillStyle = theme.foreground; ctx.fillRect(W - 20, tt - 2, 10, 4)
      if (s.msgT > 0) {
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "bold 30px " + theme.fontFamily
        ctx.fillStyle = theme.withAlpha(theme.background, 0.7); ctx.fillText(s.msg, W / 2 + 2, H * 0.3 + 2)
        ctx.fillStyle = theme.highlight; ctx.fillText(s.msg, W / 2, H * 0.3)
      }
      if (root.paused || root.over) {
        ctx.fillStyle = theme.background; ctx.globalAlpha = root.paused ? 0.75 : 0.4
        ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
