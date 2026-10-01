import QtQuick
import "../engine" as Engine
import "logic/muncher.js" as Muncher

// Muncher, a maze chase after Pac-Man (see logic/muncher.js). Arrows queue
// the next turn, so tapping early takes the next opening that way.
Engine.GameBase {
  id: root
  gameId: "muncher"
  title: "MUNCHER"
  helpText: "Eat every pellet and dodge the ghosts · ARROWS steer (press early to take the next turning) · big pellets turn the ghosts edible for a few seconds: 200, 400, 800, 1600 · the side tunnel wraps round · extra life every 10,000"
  mouseHelp: "Click to turn toward that spot"

  property var state: null
  property int wantDir: -1
  tickInterval: 16
  ticking: !!state && state.alive && !over
  score: state ? state.score : 0
  overTitle: state ? "LEVEL " + state.level + " · " + state.score : ""
  status: !state ? ""
    : over ? "GAME OVER  ·  N for a new game"
    : paused ? "PAUSED"
    : "LEVEL " + state.level + "  ·  " + state.left + " left"

  onTick: {
    state = Muncher.step(state, { dir: wantDir }, tickInterval / 1000)
    wantDir = -1
    if (!state.alive) over = true
  }

  function newGame() {
    state = Muncher.makeState()
    wantDir = -1
    over = false
    paused = false
  }

  // up, left, down, right -> 0..3, matching Muncher.DIRS.
  function moveCursor(dx, dy) {
    if (!state || over) return
    wantDir = dy < 0 ? 0 : dx < 0 ? 1 : dy > 0 ? 2 : 3
  }

  function activate() { if (over) newGame() }

  function saveState() { return state && !over ? Muncher.serialize(state) : null }

  function loadState(saved) {
    var r = Muncher.deserialize(saved)
    if (r) { state = r; over = false }
    else newGame()
  }

  // Mouse (engine/Pointer.qml): click to turn toward that spot.
  function pointer(kind, x, y, b) {
    if (!state || over || kind !== "press") return
    var c = board.cell, p = Muncher.pos(state.pac), dx = x - (p.x + 0.5) * c, dy = y - (p.y + 0.5) * c
    wantDir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 3) : (dy < 0 ? 0 : 2)
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property real cell: Math.floor(Math.min(parent.width / Muncher.W, parent.height / (Muncher.H + 1)))
    width: cell * Muncher.W
    height: cell * (Muncher.H + 1)

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onOverChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    function isWall(x, y) {
      if (x < 0 || x >= Muncher.W || y < 0 || y >= Muncher.H) return true
      var ch = Muncher.MAZE[y][x]
      return ch === "#"
    }

    function ghostShape(ctx, x, y, r, wobble) {
      ctx.beginPath()
      ctx.moveTo(x - r, y + r)
      ctx.lineTo(x - r, y)
      ctx.arc(x, y, r, Math.PI, 0)
      ctx.lineTo(x + r, y + r)
      var n = 3, w = r * 2 / n
      for (var i = 0; i < n; ++i) {
        var bx = x + r - i * w
        ctx.lineTo(bx - w / 2, y + r - r * (wobble ? 0.35 : 0.2))
        ctx.lineTo(bx - w, y + r)
      }
      ctx.closePath()
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state, c = cell, W = Muncher.W, H = Muncher.H

      // Walls: soft fill, with a line wherever a wall meets open floor.
      ctx.fillStyle = theme.withAlpha(theme.accent, 0.1)
      ctx.strokeStyle = theme.accent
      ctx.lineWidth = Math.max(1.5, c * 0.1)
      ctx.lineCap = "round"
      ctx.beginPath()
      for (var y = 0; y < H; ++y)
        for (var x = 0; x < W; ++x) {
          if (!isWall(x, y)) continue
          ctx.fillRect(x * c, y * c, c, c)
          var i0 = c * 0.18
          if (!isWall(x, y - 1) && y > 0) { ctx.moveTo(x * c, y * c + i0); ctx.lineTo(x * c + c, y * c + i0) }
          if (!isWall(x, y + 1) && y < H - 1) { ctx.moveTo(x * c, y * c + c - i0); ctx.lineTo(x * c + c, y * c + c - i0) }
          if (!isWall(x - 1, y) && x > 0) { ctx.moveTo(x * c + i0, y * c); ctx.lineTo(x * c + i0, y * c + c) }
          if (!isWall(x + 1, y) && x < W - 1) { ctx.moveTo(x * c + c - i0, y * c); ctx.lineTo(x * c + c - i0, y * c + c) }
        }
      ctx.stroke()
      // Ghost-house door.
      ctx.strokeStyle = theme.tone(4)
      ctx.lineWidth = Math.max(2, c * 0.14)
      ctx.beginPath(); ctx.moveTo(Muncher.DOOR.x * c, Muncher.DOOR.y * c + c / 2); ctx.lineTo(Muncher.DOOR.x * c + c, Muncher.DOOR.y * c + c / 2); ctx.stroke()

      // Pellets; the big ones pulse.
      var pulse = 0.75 + 0.25 * Math.sin(s.clock * 8)
      for (y = 0; y < H; ++y)
        for (x = 0; x < W; ++x) {
          var p = s.pellets[y][x]
          if (!p) continue
          ctx.fillStyle = p === 2 ? theme.foreground : theme.withAlpha(theme.foreground, 0.7)
          ctx.beginPath()
          ctx.arc(x * c + c / 2, y * c + c / 2, p === 2 ? c * 0.3 * pulse : Math.max(1.5, c * 0.1), 0, Math.PI * 2)
          ctx.fill()
        }

      // Ghosts.
      for (var g = 0; g < s.ghosts.length; ++g) {
        var gh = s.ghosts[g], gp = Muncher.pos(gh)
        var gx = gp.x * c + c / 2, gy = gp.y * c + c / 2, r = c * 0.45
        if (s.dying > 0) break
        if (gh.mode !== "eyes" && gh.mode !== "entering") {
          var scared = gh.mode === "fright"
          var flash = scared && s.fright < 2 && Math.floor(s.fright * 5) % 2 === 0
          ghostShape(ctx, gx, gy, r, Math.floor(s.clock * 8) % 2)
          ctx.fillStyle = scared ? (flash ? theme.foreground : theme.withAlpha(theme.foreground, 0.35)) : theme.tone(g + 1)
          ctx.fill()
          if (scared) {
            ctx.fillStyle = theme.background
            ctx.fillRect(gx - r * 0.4, gy - r * 0.2, r * 0.22, r * 0.22)
            ctx.fillRect(gx + r * 0.18, gy - r * 0.2, r * 0.22, r * 0.22)
            continue
          }
        }
        // Eyes look where the ghost is going.
        var d = Muncher.DIRS[gh.dir]
        for (var e = -1; e <= 1; e += 2) {
          var ex = gx + e * r * 0.38, ey = gy - r * 0.15
          ctx.fillStyle = theme.background
          ctx.beginPath(); ctx.arc(ex, ey, r * 0.28, 0, Math.PI * 2); ctx.fill()
          ctx.fillStyle = theme.foreground
          ctx.beginPath(); ctx.arc(ex + d.x * r * 0.12, ey + d.y * r * 0.12, r * 0.13, 0, Math.PI * 2); ctx.fill()
        }
      }

      // The muncher: mouth faces its heading; shrinks away on dying.
      var pp = Muncher.pos(s.pac), px = pp.x * c + c / 2, py = pp.y * c + c / 2
      var ang = [-Math.PI / 2, Math.PI, Math.PI / 2, 0][s.pac.dir]
      var open = s.dying > 0 ? Math.PI * (1 - s.dying / 1.4) : (s.pac.moving ? 0.1 + 0.55 * Math.abs(Math.sin(s.mouth)) : 0.35)
      ctx.fillStyle = theme.tone(3)
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.arc(px, py, c * 0.46, ang + open, ang + Math.PI * 2 - open)
      ctx.closePath()
      ctx.fill()

      // Points for eaten ghosts.
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.font = "bold " + Math.floor(c * 0.55) + "px " + theme.fontFamily
      ctx.fillStyle = theme.highlight
      for (var k = 0; k < s.pops.length; ++k) ctx.fillText(String(s.pops[k].v), s.pops[k].x * c + c / 2, s.pops[k].y * c + c / 2)

      if (s.ready > 0) {
        ctx.fillStyle = theme.tone(3)
        ctx.font = "bold " + Math.floor(c * 0.8) + "px " + theme.fontFamily
        ctx.fillText(s.level > 1 && s.lives > 0 ? "LEVEL " + s.level : "READY!", width / 2, 11 * c + c / 2)
      }

      // Lives along the bottom.
      ctx.fillStyle = theme.tone(3)
      for (var l = 0; l < Math.min(s.lives - (s.dying > 0 ? 0 : 1), 8); ++l) {
        var lx = c + l * c * 1.2, ly = H * c + c / 2
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.arc(lx, ly, c * 0.38, Math.PI + 0.5, Math.PI * 3 - 0.5); ctx.closePath(); ctx.fill()
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
