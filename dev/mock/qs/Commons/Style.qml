pragma Singleton
import QtQuick

// Stand-in for qs.Commons Style — the subset engine/Theme.qml and the games
// actually read. Not a faithful clone of the real token set; grows only if
// a game starts reading a token this doesn't have yet.
QtObject {
  id: root

  property int cornerRadius: 6
  property int gapsOut: 6

  function space(px) { return Math.round(px) }
  function spaceReal(px) { return px }

  readonly property QtObject spacing: QtObject {
    property int hairline: 1
    property int xxs: 2
    property int xs: 3
    property int sm: 4
    property int md: 6
    property int lg: 8
    property int xl: 10
    property int xxl: 12
    property int xxxl: 14
    property int huge: 18
    property int controlPaddingX: 10
    property int controlPaddingY: 6
    property int panelGap: 14
    property int panelPadding: 18
    property int popupPadding: 14
  }

  readonly property QtObject font: QtObject {
    property string family: "monospace"
    property string menuFamily: "monospace"
    property int caption: 10
    property int bodySmall: 11
    property int body: 12
    property int subtitle: 13
    property int title: 14
    property int heading: 16
    property int display: 24
    property int displayLarge: 28
  }

  readonly property QtObject bar: QtObject {
    property int sizeHorizontal: 26
    property int sizeVertical: 28
    property int iconSlot: 27
    property int iconCanvas: 16
    property int iconFont: 13
    property int statusSlot: 21
  }
}
