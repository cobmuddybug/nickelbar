pragma Singleton
import QtQuick
import Quickshell
import Quickshell.Io

// Stand-in for the real shell's qs.Commons Color singleton, just enough for
// games/engine files to draw with while iterating outside the live shell.
// Fixed values instead of a live theme — the dev harness trades theme
// accuracy for not needing the shell running at all.
QtObject {
  id: root
  property color foreground: "#cacccc"
  property color background: "#101315"
  property color accent: "#8fbcbb"
  property color urgent: "#bf616a"
  property color muted: "#707880"

  // NICKELBAR_COLORS=/path/to/colors.toml makes the harness wear that theme.
  property FileView themeFile: FileView {
    path: Quickshell.env("NICKELBAR_COLORS") || ""
    printErrors: false
    onLoaded: {
      var lines = text().split("\n")
      for (var i = 0; i < lines.length; ++i) {
        var m = lines[i].match(/^\s*([A-Za-z0-9_-]+)\s*=\s*["']?(#[0-9A-Fa-f]{6})/)
        if (!m) continue
        if (m[1] === "accent") { root.accent = m[2]; root.menu.selectedText = m[2] }
        else if (m[1] === "background") { root.background = m[2]; root.menu.background = m[2] }
        else if (m[1] === "foreground") { root.foreground = m[2]; root.menu.text = m[2] }
        else if (m[1] === "red") root.urgent = m[2]
      }
    }
  }

  readonly property QtObject menu: QtObject {
    property color background: "#181c1f"
    property color text: "#cacccc"
    property color border: "#333a3f"
    property color scrim: Qt.rgba(0, 0, 0, 0.5)
    property color selectedBackground: Qt.rgba(0.56, 0.73, 0.73, 0.18)
    property color selectedText: "#8fbcbb"
    property color selectedBorder: Qt.rgba(0, 0, 0, 0)
  }

  readonly property QtObject popups: QtObject {
    property color background: "#181c1f"
    property color text: "#cacccc"
    property color border: "#8fbcbb"
  }
}
