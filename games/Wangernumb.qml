import QtQuick
import "../engine/Rng.js" as Rng
import "../engine" as Engine
import "logic/wangernumb.js" as Wang

// A game show whose rules nobody knows. Type a number, hear whether it was
// WANGERNUMB. The hidden rule keeps changing, the board keeps turning, and
// the on-screen number wheel reshuffles every turn. All the chaos stays
// inside the board; the overlay around it never moves.
Engine.GameBase {
  id: root
  gameId: "wangernumb"
  title: "WANGERNUMB"
  mouseHelp: "Click the number wheel (it reshuffles every turn); GO submits, DEL or right-click deletes"
  helpText: "Type digits · ENTER or SPACE submits · BACKSPACE deletes · three strikes or twenty turns end the round, and every fifth WANGERNUMB opens WANGERNUMB, where everything scores · THE RULES: "
    + Wang.fakeHelp(state ? state.seed % 97 + state.turn : 0)

  property var state: null
  property bool animateAngle: true
  // Quarter turns, animated; plus a continuous spin while WANGERNUMB lasts.
  property real turnDeg: state ? state.rot * 90 : 0
  Behavior on turnDeg { enabled: root.animateAngle; NumberAnimation { duration: 450; easing.type: Easing.OutBack } }
  readonly property real angleRad: (turnDeg + (state && state.bonus > 0 ? state.bonus * 180 : 0)) * Math.PI / 180

  tickInterval: 33
  ticking: !!state && !over && (state.age < 2 || state.bonus > 0)
  score: state ? state.score : 0
  progress: state && state.wangs ? state.wangs + " wangernumb" + (state.wangs === 1 ? "" : "s") : ""
  overTitle: state && state.strikes >= Wang.MAX_STRIKES ? "NOT WANGERNUMB" : "THAT'S WANGERNUMB"
  status: !state ? ""
    : (over ? "THE SHOW IS OVER  ·  N for another"
      : (paused ? "PAUSED"
        : "turn " + Wang.turnShown(state) + "/" + Wang.MAX_TURNS + "  ·  " + state.score + " " + Wang.unitName(state)
          + "  ·  strikes " + state.strikes + "/" + Wang.MAX_STRIKES))

  onTick: {
    state = Wang.step(state, tickInterval / 1000)
    if (Wang.done(state)) over = true
  }

  function newGame() {
    animateAngle = false
    state = Wang.makeState(Math.floor(Rng.random() * 4294967296))
    over = false
    paused = false
    Qt.callLater(function() { root.animateAngle = true })
  }

  function submit() {
    if (!state || over) return
    state = Wang.submit(state, Date.now() / 1000)
    if (Wang.done(state)) over = true
  }

  function activate() {
    if (over) { newGame(); return }
    submit()
  }

  function moveCursor(dx, dy) {}

  function handleKey(key, text) {
    if (!state || over) return false
    if (key === Qt.Key_Backspace || key === Qt.Key_Delete) { state = Wang.backspace(state); return true }
    if (key === Qt.Key_Return || key === Qt.Key_Enter) { submit(); return true }
    if (text && /^[0-9]$/.test(text)) { state = Wang.typeDigit(state, parseInt(text, 10)); return true }
    return false
  }

  function saveState() {
    if (!state || over) return null
    return Wang.serialize(state)
  }

  function loadState(saved) {
    var restored = Wang.deserialize(saved)
    if (restored) {
      animateAngle = false
      state = restored
      over = false
      Qt.callLater(function() { root.animateAngle = true })
    } else newGame()
  }

  // ---- layout, in the card's own units (S = card side, origin at centre) ----
  readonly property real wheelY: 0.31
  readonly property real wheelR: 0.135
  function wheelPos(i) {
    var a = -Math.PI / 2 + i * Math.PI / 5
    return { x: Math.cos(a) * wheelR, y: wheelY + Math.sin(a) * wheelR }
  }

  // Mouse (engine/Pointer.qml): undo the board's turn, then hit-test the wheel.
  function pointer(kind, x, y, b) {
    if (kind !== "press" || !state) return
    var S = Math.min(board.width, board.height) * 0.86
    var dx = x - board.width / 2, dy = y - board.height / 2
    var c = Math.cos(angleRad), sn = Math.sin(angleRad)
    var lx = (dx * c + dy * sn) / S, ly = (-dx * sn + dy * c) / S
    if (b === Qt.RightButton) { state = Wang.backspace(state); return }
    if (b !== Qt.LeftButton) return
    if (Math.hypot(lx, ly - wheelY) < 0.065) { submit(); return }
    if (Math.hypot(lx - 0.36, ly - wheelY) < 0.05) { state = Wang.backspace(state); return }
    for (var i = 0; i < 10; ++i) {
      var p = wheelPos(i)
      if (Math.hypot(lx - p.x, ly - p.y) < 0.05) { state = Wang.typeDigit(state, state.wheel[i]); return }
    }
  }

  Engine.Theme { id: theme }

  function wrapText(ctx, text, maxW) {
    var words = text.split(" "), lines = [], line = ""
    for (var i = 0; i < words.length; ++i) {
      var t = line ? line + " " + words[i] : words[i]
      if (line && ctx.measureText(t).width > maxW) { lines.push(line); line = words[i] }
      else line = t
    }
    if (line) lines.push(line)
    return lines
  }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.fill: parent

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onAngleRadChanged() { board.requestPaint() }
      function onOverChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state
      var S = Math.min(width, height) * 0.86
      var pal = s.pal
      function tone(i) { return theme.tone(i + pal) }
      function font(size, bold) { ctx.font = (bold ? "bold " : "") + Math.max(6, Math.floor(size * S)) + "px " + theme.fontFamily }

      ctx.save()
      ctx.translate(width / 2, height / 2)
      ctx.rotate(root.angleRad)
      ctx.scale(S, S)
      ctx.lineWidth = 1 / S

      // Card
      var bonus = s.bonus > 0
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.05)
      ctx.fillRect(-0.5, -0.5, 1, 1)
      ctx.strokeStyle = bonus ? tone(Math.floor(s.bonus * 6)) : theme.border
      ctx.lineWidth = (bonus ? 5 : 1) / S
      ctx.strokeRect(-0.5, -0.5, 1, 1)
      ctx.restore()

      // Text is easier to place in card units with the scale undone.
      ctx.save()
      ctx.translate(width / 2, height / 2)
      ctx.rotate(root.angleRad)
      function T(str, x, y, size, color, align, bold) {
        ctx.fillStyle = color
        ctx.textAlign = align || "center"
        ctx.textBaseline = "middle"
        font(size, bold)
        ctx.fillText(str, x * S, y * S)
      }
      function disc(x, y, r, fill) {
        ctx.fillStyle = fill
        ctx.beginPath(); ctx.arc(x * S, y * S, r * S, 0, Math.PI * 2); ctx.fill()
      }

      // Scoreboard
      T("YOU " + s.score + " " + Wang.unitName(s), -0.45, -0.455, 0.032, theme.accent, "left", true)
      T("RIVAL " + s.rival, 0.45, -0.455, 0.032, theme.dim, "right", false)
      for (var k = 0; k < Wang.MAX_STRIKES; ++k)
        disc(0.1 + k * 0.05, -0.455, 0.014, k < s.strikes ? theme.danger : theme.faint)

      // Host bubble
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.08)
      ctx.fillRect(-0.44 * S, -0.41 * S, 0.88 * S, 0.245 * S)
      font(0.04, true)
      var lines = root.wrapText(ctx, s.host, 0.82 * S)
      for (var i = 0; i < lines.length && i < 3; ++i) T(lines[i], -0.41, -0.375 + i * 0.05, 0.04, theme.foreground, "left", true)
      if (s.hint) T(s.hint, -0.41, -0.2, 0.032, tone(2), "left", false)
      if (s.event) {
        font(0.03, false)
        var ev = root.wrapText(ctx, s.event, 0.88 * S)
        T(ev[0] + (ev.length > 1 ? "…" : ""), 0, -0.135, 0.03, theme.dim, "center", false)
      }

      // The number, and what you've typed so far
      T("SAY A NUMBER" + (s.clockDir < 0 ? "  (turn " + Wang.turnShown(s) + ", backwards)" : ""), 0, -0.1, 0.028, theme.dim, "center", false)
      T(Wang.glyph(s.target, s.glyph), 0, -0.035, 0.095, tone(1), "center", true)
      T(s.input + (Math.floor(Date.now() / 450) % 2 === 0 ? "_" : " "), 0, 0.05, 0.065, theme.foreground, "center", true)
      if (bonus) {
        ctx.fillStyle = tone(Math.floor(s.bonus * 8))
        ctx.fillRect(-0.5 * S, -0.5 * S, S * (s.bonus / Wang.BONUS_TIME), 0.012 * S)
        T("WANGERNUMB", 0.45, 0.05, 0.028, tone(3), "right", true)
      }

      // The wheel: digits reshuffled each turn, GO in the middle
      for (var w = 0; w < 10; ++w) {
        var p = root.wheelPos(w)
        disc(p.x, p.y, 0.04, theme.withAlpha(theme.foreground, 0.12))
        T(String(s.wheel[w]), p.x, p.y + 0.002, 0.046, theme.foreground, "center", true)
      }
      disc(0, root.wheelY, 0.065, theme.accent)
      T("GO", 0, root.wheelY, 0.05, theme.background, "center", true)
      disc(0.36, root.wheelY, 0.045, theme.withAlpha(theme.foreground, 0.12))
      T("DEL", 0.36, root.wheelY, 0.03, theme.dim, "center", true)

      // Verdict flash
      if (s.verdict && s.age < 1.6) {
        var fade = 1 - s.age / 1.6
        var shake = Math.sin(s.age * 70) * 0.012 * fade
        var good = s.verdict !== "wrong"
        if (good) {
          for (var q = 0; q < 28; ++q) {
            var ang = q * 2.39996, dist = s.age * (0.35 + ((q * 37) % 10) / 22)
            ctx.globalAlpha = Math.max(0, fade)
            disc(Math.cos(ang) * dist, -0.02 + Math.sin(ang) * dist, 0.014, tone(q))
          }
        }
        ctx.globalAlpha = Math.min(1, fade * 2.2)
        ctx.fillStyle = theme.background
        ctx.fillRect(-0.5 * S, -0.075 * S, S, 0.15 * S)
        var label = s.verdict === "wangernumb" ? "WANGERNUMB!" : (good ? "THAT'S WANGERNUMB!" : "NOT WANGERNUMB")
        T(label, shake, -0.01, 0.075, good ? tone(s.age * 10 | 0) : theme.danger, "center", true)
        if (s.gain !== 0) T((s.gain > 0 ? "+" : "") + s.gain + " " + Wang.unitName(s), -shake, 0.045, 0.04, theme.foreground, "center", false)
        ctx.globalAlpha = 1
      }
      ctx.restore()

      if (root.paused || root.over) {
        ctx.fillStyle = theme.background
        ctx.globalAlpha = root.paused ? 0.7 : 0.35
        ctx.fillRect(0, 0, width, height)
        ctx.globalAlpha = 1.0
      }
    }
  }

  // Keeps the input cursor blinking while the round waits for you.
  Timer {
    interval: 450
    running: !!root.state && !root.over && !root.paused
    repeat: true
    onTriggered: board.requestPaint()
  }

  Component.onCompleted: if (!state) newGame()
}
