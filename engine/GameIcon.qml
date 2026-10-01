import QtQuick
import "icons.js" as Icons

// A game's picker icon (engine/icons.js) at whatever size it's given,
// in the current theme's colours.
Canvas {
  id: root

  property string gameId: ""
  property bool dimmed: false

  Theme { id: theme }

  readonly property var colors: ({
    fg: theme.foreground, dim: theme.dim, bg: theme.background, accent: theme.accent, danger: theme.danger,
    soft: theme.withAlpha(theme.accent, 0.35), warm: theme.withAlpha(theme.tone(3), 0.35), tone: theme.tones
  })

  onColorsChanged: requestPaint()
  onGameIdChanged: requestPaint()
  onWidthChanged: requestPaint()
  onHeightChanged: requestPaint()
  opacity: dimmed ? 0.45 : 1

  onPaint: {
    var ctx = getContext("2d")
    ctx.clearRect(0, 0, width, height)
    if (!gameId) return
    var s = Math.min(width, height)
    Icons.draw(ctx, gameId, (width - s) / 2, (height - s) / 2, s, colors)
  }
}
