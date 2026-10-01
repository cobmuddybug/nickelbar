import QtQuick

// Mouse support for a game: drop one over the board (usually the Canvas)
// and it forwards to the game's optional hook
//
//   function pointer(kind, x, y, button)
//
// in the board's own coordinates. kind is "move" (hover), "press",
// "drag" (moving with a button down), "release", or "wheel" (button is
// then +1 / -1). button is Qt.LeftButton / RightButton / MiddleButton.
// Clicks also do the obvious chrome things first: a click resumes a
// paused game, and on a finished round starts the next (as SPACE would).
MouseArea {
  id: area

  property Item game: null
  property int shape: Qt.PointingHandCursor

  anchors.fill: parent
  hoverEnabled: true
  acceptedButtons: Qt.LeftButton | Qt.RightButton | Qt.MiddleButton
  cursorShape: shape

  function send(kind, x, y, b) {
    if (game && typeof game.pointer === "function") game.pointer(kind, x, y, b)
  }

  Component.onCompleted: if (game) game.pointerArea = area

  onPositionChanged: function(mouse) {
    if (!game || game.paused || game.over) return
    send(pressed ? "drag" : "move", mouse.x, mouse.y, pressedButtons)
  }
  onPressed: function(mouse) {
    if (!game) return
    if (game.paused) { game.paused = false; return }
    if (game.over) { if (mouse.button === Qt.LeftButton) game.activate(); return }
    game.started = true
    send("press", mouse.x, mouse.y, mouse.button)
  }
  onReleased: function(mouse) {
    if (game && !game.paused && !game.over) send("release", mouse.x, mouse.y, mouse.button)
  }
  onWheel: function(wheel) {
    if (game && !game.paused && !game.over && wheel.angleDelta.y) send("wheel", wheel.x, wheel.y, wheel.angleDelta.y > 0 ? 1 : -1)
  }
}
