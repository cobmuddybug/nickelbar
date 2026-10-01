import QtQuick
import "../engine" as Engine
import "logic/fishing.js" as Fish

// Fishing (see logic/fishing.js): one button does everything.
Engine.GameBase {
  id: root
  gameId: "fishing"
  title: "FISHING"
  helpText: "SPACE charge a cast, then throw · LEFT/RIGHT change bait (before casting) · SPACE hook the fish when the bobber dips (!) · hold SPACE reel; let go to ease the line · A short cast fishes the shallows, a long one the deep · Past the red tension zone the line snaps · The catch log is your score sheet"
  mouseHelp: "Click for SPACE (hold the button to reel)"

  property var state: null
  tickInterval: 16
  ownSounds: true
  onStateChanged: playEvents(state)
  ticking: !!state
  endless: true
  continuousMove: true
  score: state ? state.score : 0
  progress: state ? Object.keys(state.log).length + "/" + Fish.SPECIES.length + " species" : ""
  status: !state ? ""
    : paused ? "PAUSED"
    : state.msg ? state.msg
    : ({ idle: "SPACE to cast  ·  bait " + Fish.BAITS[state.bait].name, charge: "SPACE to throw", wait: "waiting…  (SPACE reels in early)", bite: "BITE!  SPACE!", reel: "HOLD SPACE to reel", result: "" })[state.phase]

  onTick: {
    var s = Fish.setHold(state, heldAction)
    state = Fish.step(s, tickInterval / 1000)
  }

  function newGame() { state = Fish.makeState(); over = false; paused = false }
  function moveCursor(dx, dy) { if (state && dx) state = Fish.setBait(state, dx) }
  function activate() { if (state) state = Fish.action(state) }
  function saveState() { return state ? Fish.serialize(state) : null }
  function loadState(saved) { var s = Fish.deserialize(saved); if (s) state = s; else newGame() }

  function pointer(kind, x, y, b) {
    if (b !== Qt.LeftButton && kind !== "release") return
    if (kind === "press") { heldAction = true; activate() }
    else if (kind === "release") heldAction = false
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.fill: parent

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    function bar(ctx, x, y, w, h, v, col, danger) {
      ctx.fillStyle = theme.faint; ctx.fillRect(x, y, w, h)
      ctx.fillStyle = col; ctx.fillRect(x, y, w * Math.min(1, v), h)
      if (danger) { ctx.fillStyle = theme.withAlpha(theme.danger, 0.5); ctx.fillRect(x + w * danger, y, w * (1 - danger), h) }
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      var s = root.state
      if (!s) return
      var sw = width * 0.62, wy = height * 0.22
      // Water in three bands: shallows, middle, deep.
      for (var z = 0; z < 3; ++z) {
        ctx.fillStyle = theme.withAlpha(theme.tone(1), 0.14 + z * 0.1)
        ctx.fillRect(0, wy + (height * 0.5) * z / 3, sw, height * 0.5 / 3 + 1)
      }
      ctx.fillStyle = theme.dim; ctx.fillRect(0, wy, sw, 2)
      ctx.font = Math.floor(height * 0.025) + "px " + theme.fontFamily; ctx.textAlign = "left"; ctx.textBaseline = "middle"
      var names = ["SHALLOWS", "MIDDLE", "DEEP"]
      names.forEach(function(n, i) { ctx.fillStyle = theme.dim; ctx.fillText(n, 8, wy + height * 0.5 * (i + 0.15) / 3) })
      // Angler on the left bank and the line out to the bobber.
      var px = sw * 0.08, py = wy - 6
      ctx.fillStyle = theme.foreground; ctx.fillRect(px - 5, py - 26, 10, 26); ctx.beginPath(); ctx.arc(px, py - 32, 6, 0, Math.PI * 2); ctx.fill()
      var zone = s.phase === "charge" ? (s.power < 0.34 ? 0 : s.power < 0.7 ? 1 : 2) : s.zone
      var bx = sw * (0.3 + 0.6 * (s.phase === "charge" ? s.power : [0.17, 0.52, 0.85][s.zone]))
      var by = wy + (height * 0.5) * (zone + 0.5) / 3 * (s.phase === "reel" ? 0.9 : 1)
      if (s.phase !== "idle" && s.phase !== "result") {
        var dip = s.phase === "bite" ? 6 : s.phase === "reel" ? 0 : Math.sin(Date.now() / 400) * 2
        var rx = s.phase === "reel" ? px + (bx - px) * (1 - s.progress) : bx
        ctx.strokeStyle = theme.dim; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(px + 10, py - 40); ctx.quadraticCurveTo((px + rx) / 2, wy - 40, rx, wy + dip); ctx.stroke()
        if (s.phase !== "charge") {
          ctx.fillStyle = s.phase === "bite" ? theme.danger : theme.tone(3)
          ctx.beginPath(); ctx.arc(rx, wy + dip, 6, 0, Math.PI * 2); ctx.fill()
        }
        if (s.phase === "bite") {
          ctx.fillStyle = theme.danger; ctx.font = "bold " + Math.floor(height * 0.08) + "px " + theme.fontFamily; ctx.textAlign = "center"
          ctx.fillText("!", rx, wy - height * 0.1)
        }
        if (s.phase === "reel" && s.fish) {
          var fx = rx + 10, fy = by * 0.7 + wy * 0.3
          ctx.fillStyle = theme.tone(2); ctx.beginPath(); ctx.ellipse(fx - 14, fy - 6, 28, 12); ctx.fill()
          ctx.beginPath(); ctx.moveTo(fx + 14, fy); ctx.lineTo(fx + 24, fy - 8); ctx.lineTo(fx + 24, fy + 8); ctx.fill()
        }
      }
      // Meters under the water.
      var my = wy + height * 0.5 + 18, mw = sw * 0.8, mx = (sw - mw) / 2
      ctx.textAlign = "left"; ctx.font = Math.floor(height * 0.03) + "px " + theme.fontFamily; ctx.fillStyle = theme.dim
      if (s.phase === "charge") { ctx.fillText("CAST POWER", mx, my - 8); board.bar(ctx, mx, my, mw, 14, s.power, theme.accent, 0) }
      else if (s.phase === "reel") {
        ctx.fillText("TENSION", mx, my - 8); board.bar(ctx, mx, my, mw, 14, s.tension, theme.tone(3), 0.85)
        ctx.fillText("FISH", mx, my + 34); board.bar(ctx, mx, my + 42, mw, 14, s.progress, theme.accent, 0)
      } else if (s.phase === "idle") {
        ctx.fillText("BAIT", mx, my - 8)
        for (var b = 0; b < 3; ++b) {
          ctx.fillStyle = b === s.bait ? theme.accent : theme.dim; ctx.font = (b === s.bait ? "bold " : "") + Math.floor(height * 0.035) + "px " + theme.fontFamily
          ctx.fillText(Fish.BAITS[b].name, mx + b * mw / 3, my + 14)
        }
      }
      // Catch log.
      var lx = sw + 14, lw = width - lx - 6, rh = Math.min(height * 0.07, 26)
      ctx.textBaseline = "middle"
      for (var i = 0; i < Fish.SPECIES.length; ++i) {
        var sp = Fish.SPECIES[i], e = s.log[sp.id], y = 10 + i * rh
        ctx.textAlign = "left"; ctx.font = Math.floor(rh * 0.5) + "px " + theme.fontFamily
        ctx.fillStyle = e ? theme.foreground : theme.faint
        ctx.fillText(e ? sp.name : "? ? ?", lx, y + rh / 2)
        if (e) { ctx.textAlign = "right"; ctx.fillStyle = theme.dim; ctx.fillText("×" + e.n + "  " + e.best + "kg", lx + lw, y + rh / 2) }
      }
      if (root.paused) { ctx.fillStyle = theme.background; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1 }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
