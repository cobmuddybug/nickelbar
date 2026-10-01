import QtQuick
import "../engine" as Engine
import "logic/robots.js" as Robots

// Robots, after BSD robots / GNOME Robots (see logic/robots.js).
Engine.GameBase {
  id: root
  gameId: "robots"
  title: "ROBOTS"
  helpText: "Robots step toward you every turn; make them crash into each other or into junk · ARROWS move · numpad 7 9 1 3 or Y O B M diagonals · SPACE or . or 5 wait a turn · T teleport (random, risky) · S safe teleport (limited) · W wait it out for a bonus · you can shove a junk heap onto a robot · U undo"
  mouseHelp: "Click to step toward that spot (any of eight directions); click yourself to wait a turn"

  property var state: null
  score: state ? state.score : 0
  overTitle: state ? "CAUGHT ON LEVEL " + state.level : ""
  status: !state ? ""
    : over ? "CAUGHT  ·  N for a new game"
    : paused ? "PAUSED"
    : (state.note ? state.note.toUpperCase() + "  ·  " : "") + "LEVEL " + state.level + "  ·  " + state.robots.length
      + " robots  ·  " + state.safe + " safe teleports"

  onStateChanged: over = !!state && !state.alive

  function newGame() { clearUndo(); state = Robots.makeState(); paused = false }

  // Every action goes through here so it can be taken back.
  function act(next) { if (next !== state) { pushUndo(state); state = next } }
  function undo() { var p = popUndo(); if (p) { state = p; paused = false } }

  // up, right, down, left -> 0, 2, 4, 6
  function moveCursor(dx, dy) {
    if (!state || over) return
    act(Robots.move(state, dy < 0 ? 0 : dx > 0 ? 2 : dy > 0 ? 4 : 6))
  }

  function activate() {
    if (over) { newGame(); return }
    if (state) act(Robots.move(state, 8))
  }

  function handleKey(key, text) {
    if (!state || over) return false
    var t = text ? text.toLowerCase() : ""
    var d = { "8": 0, "9": 1, "6": 2, "3": 3, "2": 4, "1": 5, "4": 6, "7": 7, "y": 7, "o": 1, "b": 5, "m": 3, "5": 8, ".": 8 }[t]
    if (d === undefined) d = key === Qt.Key_Home ? 7 : key === Qt.Key_PageUp ? 1 : key === Qt.Key_End ? 5 : key === Qt.Key_PageDown ? 3 : -1
    if (d >= 0) { act(Robots.move(state, d)); return true }
    if (t === "t") { act(Robots.teleport(state, false)); return true }
    if (t === "s") { act(Robots.teleport(state, true)); return true }
    if (t === "w") { act(Robots.waitOut(state)); return true }
    return false
  }

  function saveState() { return state && !over ? Robots.serialize(state) : null }

  function loadState(saved) {
    var r = Robots.deserialize(saved)
    clearUndo()
    if (r) { state = r; paused = false }
    else newGame()
  }

  // Mouse (engine/Pointer.qml): click to step toward that spot (any of
  // eight directions); click yourself to wait a turn.
  function pointer(kind, x, y, b) {
    if (!state || over || kind !== "press" || b !== Qt.LeftButton) return
    var c = board.cell, px = (state.player.x + 0.5) * c, py = (state.player.y + 0.5) * c
    if (Math.abs(x - px) < c / 2 && Math.abs(y - py) < c / 2) { act(Robots.move(state, 8)); return }
    var a = Math.atan2(x - px, -(y - py))
    act(Robots.move(state, (Math.round(a / (Math.PI / 4)) + 8) % 8))
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property real cell: Math.floor(Math.min(parent.width / Robots.W, parent.height / Robots.H))
    width: cell * Robots.W
    height: cell * Robots.H

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
      var s = root.state, c = cell
      for (var y = 0; y < Robots.H; ++y)
        for (var x = 0; x < Robots.W; ++x) {
          ctx.fillStyle = (x + y) % 2 ? theme.withAlpha(theme.foreground, 0.05) : theme.withAlpha(theme.foreground, 0.02)
          ctx.fillRect(x * c, y * c, c, c)
        }
      // Squares a robot could reach next turn, faintly.
      if (!root.over) {
        ctx.fillStyle = theme.withAlpha(theme.danger, 0.07)
        for (var i = 0; i < s.robots.length; ++i) ctx.fillRect((s.robots[i].x - 1) * c, (s.robots[i].y - 1) * c, c * 3, c * 3)
      }
      for (var k in s.heaps) {
        var p = k.split(","), hx = +p[0] * c, hy = +p[1] * c
        ctx.fillStyle = theme.dim
        ctx.beginPath()
        ctx.moveTo(hx + c * 0.15, hy + c * 0.85); ctx.lineTo(hx + c * 0.3, hy + c * 0.35); ctx.lineTo(hx + c * 0.5, hy + c * 0.55)
        ctx.lineTo(hx + c * 0.65, hy + c * 0.2); ctx.lineTo(hx + c * 0.85, hy + c * 0.85); ctx.closePath(); ctx.fill()
      }
      for (var r = 0; r < s.robots.length; ++r) {
        var rx = s.robots[r].x * c, ry = s.robots[r].y * c
        ctx.fillStyle = theme.tone(1)
        ctx.fillRect(rx + c * 0.2, ry + c * 0.25, c * 0.6, c * 0.55)
        ctx.fillStyle = theme.background
        ctx.fillRect(rx + c * 0.3, ry + c * 0.38, c * 0.12, c * 0.12)
        ctx.fillRect(rx + c * 0.58, ry + c * 0.38, c * 0.12, c * 0.12)
        ctx.strokeStyle = theme.tone(1); ctx.lineWidth = Math.max(1, c * 0.06)
        ctx.beginPath(); ctx.moveTo(rx + c / 2, ry + c * 0.25); ctx.lineTo(rx + c / 2, ry + c * 0.1); ctx.stroke()
      }
      var px = s.player.x * c + c / 2, py = s.player.y * c + c / 2
      ctx.fillStyle = s.alive ? theme.accent : theme.danger
      ctx.beginPath(); ctx.arc(px, py - c * 0.18, c * 0.16, 0, Math.PI * 2); ctx.fill()
      ctx.fillRect(px - c * 0.18, py, c * 0.36, c * 0.3)
      if (root.paused || root.over) {
        ctx.fillStyle = theme.background
        ctx.globalAlpha = root.paused ? 0.85 : 0.35
        ctx.fillRect(0, 0, width, height)
        ctx.globalAlpha = 1.0
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
