import QtQuick
import "../engine" as Engine
import "logic/sunlane.js" as Sunlane

// Sunlane (after Space Harrier): a rail shooter. You fly low over a
// chequered plain and can go anywhere on the screen; enemies and columns
// come at you out of the horizon. Shoot the enemies (they shoot back), dodge
// everything else. Three lives.
Engine.GameBase {
  id: root
  gameId: "sunlane"
  title: "SUNLANE"
  helpText: "ARROWS fly (hold to keep moving) · hold SPACE/ENTER to fire · shoot the enemies, dodge their shots and the columns · shots are stopped by columns · you're briefly untouchable after a hit · three lives, and it gets faster every thirty seconds"
  mouseHelp: "The ship follows the pointer; hold LEFT to fire"

  property var state: null
  property bool mouseFire: false
  property bool usingMouse: false
  property bool keysWereHeld: false

  tickInterval: 16
  continuousMove: true
  ticking: !!state && state.alive && !over
  score: state ? Math.floor(state.score) : 0
  overTitle: state ? "SCORE " + Math.floor(state.score) : ""
  status: !state ? ""
    : (over ? "SHOT DOWN at " + Math.floor(state.score) + "  ·  " + state.kills + " kills  ·  N for a new game"
      : (paused ? "PAUSED" : "LIVES " + state.lives + "  ·  SCORE " + Math.floor(state.score) + "  ·  LEVEL " + state.level))

  onTick: {
    var dt = tickInterval / 1000
    var s = state
    if (heldDx !== 0 || heldDy !== 0) {
      usingMouse = false; keysWereHeld = true
      s = Sunlane.setTarget(s, s.ship.x + heldDx * 0.6, s.ship.y - heldDy * 0.5)
    } else if (keysWereHeld) {
      keysWereHeld = false
      s = Sunlane.setTarget(s, s.ship.x, s.ship.y)
    }
    s = Sunlane.step(s, { fire: heldAction || mouseFire }, dt)
    if (s !== state) state = s
    if (!state.alive) over = true
  }

  function newGame() { state = Sunlane.makeState(); over = false; paused = false; mouseFire = false; usingMouse = false }

  function moveCursor(dx, dy) {}

  function activate() { if (over) newGame() }

  function saveState() { return state && !over ? Sunlane.serialize(state) : null }
  function loadState(saved) {
    var r = Sunlane.deserialize(saved)
    if (r) { state = r; over = !r.alive } else newGame()
  }

  function pointer(kind, x, y, b) {
    if (!state || over) return
    if (kind === "move" || kind === "drag" || kind === "press") {
      usingMouse = true
      var p = board.unproject(x, y)
      state = Sunlane.setTarget(state, p.x, p.y)
    }
    if (kind === "press" && b === Qt.LeftButton) mouseFire = true
    if (kind === "release") mouseFire = false
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root; shape: Qt.CrossCursor }
    anchors.fill: parent

    // camera: horizon a third of the way down; ground runs down to ~90% of the rest
    readonly property real hy: height * 0.36
    readonly property real gnd: (height - hy) * 0.86
    readonly property real rng: height * 0.62
    readonly property real xs: width * 0.46

    function persp(z) { return 1 / (1 + 3 * z) }
    function projX(x, z) { return width / 2 + x * xs * persp(z) }
    function projY(y, z) { return hy + (gnd - y * rng) * persp(z) }
    function unproject(px, py) {
      var f = persp(Sunlane.SHIP_Z)
      return { x: (px - width / 2) / (xs * f), y: (gnd - (py - hy) / f) / rng }
    }

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
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
      var W = width, H = height, hy = board.hy
      if (W <= 0 || H <= 0) return
      // sun on the horizon
      ctx.fillStyle = theme.accent; ctx.globalAlpha = 0.18
      ctx.beginPath(); ctx.arc(W / 2, hy, Math.min(W, H) * 0.2, Math.PI, 0); ctx.fill()
      ctx.globalAlpha = 0.35
      ctx.beginPath(); ctx.arc(W / 2, hy, Math.min(W, H) * 0.11, Math.PI, 0); ctx.fill(); ctx.globalAlpha = 1
      // chequered floor: bands in z, scrolling toward you
      var depth = 0.06, off = (s.scroll % (depth * 2))
      for (var band = -1; band < 22; ++band) {
        var zFar = band * depth - off + depth, zNear = zFar - depth
        var z0 = Math.max(0, zNear), z1 = Math.min(1, zFar)
        if (z1 <= 0 || z0 >= 1) continue
        var yA = board.projY(0, z1), yB = board.projY(0, z0)
        ctx.fillStyle = ((band % 2) === 0) ? theme.faint : theme.background
        ctx.globalAlpha = ((band % 2) === 0) ? 0.55 : 0.4
        ctx.fillRect(0, yA, W, yB - yA + 1)
      }
      ctx.globalAlpha = 1
      // lane lines converging on the horizon
      ctx.strokeStyle = theme.faint; ctx.lineWidth = 1
      for (var lane = -4; lane <= 4; ++lane) {
        var lx = lane * 0.5
        ctx.beginPath(); ctx.moveTo(board.projX(lx, 1), board.projY(0, 1)); ctx.lineTo(board.projX(lx, 0), board.projY(0, 0)); ctx.stroke()
      }
      ctx.strokeStyle = theme.dim; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(W, hy); ctx.stroke()

      // everything with depth, far to near
      var items = []
      var i
      for (i = 0; i < s.columns.length; ++i) items.push({ z: s.columns[i].z, kind: "col", o: s.columns[i] })
      for (i = 0; i < s.enemies.length; ++i) items.push({ z: s.enemies[i].z, kind: "enemy", o: s.enemies[i] })
      for (i = 0; i < s.eshots.length; ++i) items.push({ z: s.eshots[i].z, kind: "eshot", o: s.eshots[i] })
      for (i = 0; i < s.shots.length; ++i) items.push({ z: s.shots[i].z, kind: "shot", o: s.shots[i] })
      for (i = 0; i < s.bursts.length; ++i) items.push({ z: s.bursts[i].z, kind: "burst", o: s.bursts[i] })
      items.sort(function(a, b) { return b.z - a.z })
      for (i = 0; i < items.length; ++i) {
        var it = items[i], o = it.o, z = Math.max(0, it.z), f = board.persp(z)
        if (it.z > 1.06) continue
        var sx = board.projX(o.x, z)
        if (it.kind === "col") {
          var top = board.projY(o.h, z), bot = board.projY(0, z), w = board.xs * 0.09 * f
          ctx.fillStyle = theme.tone(4); ctx.globalAlpha = Math.min(1, 1.2 - z * 0.5)
          ctx.fillRect(sx - w, top, w * 2, bot - top)
          ctx.fillStyle = theme.background; ctx.globalAlpha = 0.35
          ctx.fillRect(sx + w * 0.3, top, w * 0.7, bot - top)
          ctx.globalAlpha = 1
        } else if (it.kind === "enemy") {
          var ey = board.projY(o.y, z), r = board.xs * 0.13 * f
          // shadow on the floor
          ctx.fillStyle = theme.background; ctx.globalAlpha = 0.5
          ctx.beginPath(); ctx.ellipse(sx - r * 0.8, board.projY(0, z) - r * 0.15, r * 1.6, r * 0.3); ctx.fill(); ctx.globalAlpha = 1
          ctx.fillStyle = theme.danger
          ctx.beginPath(); ctx.moveTo(sx, ey - r); ctx.lineTo(sx + r, ey); ctx.lineTo(sx, ey + r); ctx.lineTo(sx - r, ey); ctx.closePath(); ctx.fill()
          ctx.fillStyle = theme.background; ctx.globalAlpha = 0.6
          ctx.beginPath(); ctx.arc(sx, ey, r * 0.35, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1
        } else if (it.kind === "eshot") {
          var sy = board.projY(o.y, z), rr = Math.max(2.5, board.xs * 0.045 * f)
          ctx.fillStyle = theme.danger
          ctx.beginPath(); ctx.arc(sx, sy, rr, 0, Math.PI * 2); ctx.fill()
          ctx.fillStyle = theme.highlight
          ctx.beginPath(); ctx.arc(sx, sy, rr * 0.45, 0, Math.PI * 2); ctx.fill()
        } else if (it.kind === "shot") {
          var shy = board.projY(o.y, z), sr = Math.max(2, board.xs * 0.03 * f)
          ctx.fillStyle = theme.highlight
          ctx.beginPath(); ctx.arc(sx, shy, sr, 0, Math.PI * 2); ctx.fill()
        } else {
          var by = board.projY(o.y, z), br = board.xs * (0.05 + o.age * 0.45) * f
          ctx.strokeStyle = theme.accent; ctx.lineWidth = Math.max(2, br * 0.2); ctx.globalAlpha = Math.max(0, 1 - o.age / 0.45)
          ctx.beginPath(); ctx.arc(sx, by, br, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1
        }
      }
      // the ship, in the z = SHIP_Z plane, with a shadow below it
      var zs = Sunlane.SHIP_Z, fs = board.persp(zs)
      var shipX = board.projX(s.ship.x, zs), shipY = board.projY(s.ship.y, zs), gy = board.projY(0, zs)
      var blink = s.invuln > 0 && Math.floor(s.t * 12) % 2 === 0
      ctx.fillStyle = theme.background; ctx.globalAlpha = 0.5
      ctx.beginPath(); ctx.ellipse(shipX - 22, gy - 4, 44, 9); ctx.fill(); ctx.globalAlpha = 1
      if (!blink) {
        var u = Math.max(14, board.xs * 0.075)
        ctx.fillStyle = theme.foreground
        ctx.beginPath(); ctx.moveTo(shipX, shipY - u * 1.1); ctx.lineTo(shipX + u * 1.2, shipY + u * 0.8); ctx.lineTo(shipX, shipY + u * 0.4)
        ctx.lineTo(shipX - u * 1.2, shipY + u * 0.8); ctx.closePath(); ctx.fill()
        ctx.fillStyle = theme.accent
        ctx.beginPath(); ctx.moveTo(shipX, shipY - u * 0.5); ctx.lineTo(shipX + u * 0.35, shipY + u * 0.3); ctx.lineTo(shipX - u * 0.35, shipY + u * 0.3); ctx.closePath(); ctx.fill()
      }
      if (s.flash > 0) { ctx.fillStyle = theme.danger; ctx.globalAlpha = s.flash * 1.2; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1 }
      // hud
      ctx.textBaseline = "top"; ctx.font = "bold 16px " + theme.fontFamily
      ctx.textAlign = "left"; ctx.fillStyle = theme.foreground
      var hearts = ""
      for (var l = 0; l < s.lives; ++l) hearts += "◆ "
      ctx.fillText(hearts, 12, 10)
      ctx.textAlign = "right"; ctx.fillText(String(Math.floor(s.score)), W - 12, 10)
      if (root.paused || root.over) {
        ctx.fillStyle = theme.background
        ctx.globalAlpha = root.paused ? 0.7 : 0.35
        ctx.fillRect(0, 0, W, H)
        ctx.globalAlpha = 1
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
