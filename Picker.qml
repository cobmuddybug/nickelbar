import QtQuick
import qs.Commons
import qs.Ui

// The bar-anchored dropdown: left-clicking the gamepad icon opens this,
// same nested-Loader-inside-the-bar-widget shape as the built-in clock's
// calendar. BarWidget.qml owns the button and hands this the anchor.
Panel {
  id: root
  moduleName: "io.github.cobmuddybug.nickelbar"
  manageIpc: false

  property var anchorItem: null
  property var hostWidget: null
  readonly property var barIdentity: hostWidget || root
  property var store: null

  readonly property color contentForeground: bar ? bar.foreground : Color.foreground
  readonly property string contentFontFamily: bar ? bar.fontFamily : Style.font.family

  function open() { list.endSearch(); list.resetToTop(); root.controller.show() }
  function close() { root.controller.hide() }
  function toggle() { root.opened ? root.close() : root.open() }

  function launch(gameId) {
    root.close()
    if (root.bar && root.bar.shell && typeof root.bar.shell.summon === "function")
      root.bar.shell.summon(root.moduleName, JSON.stringify({ game: gameId }))
  }

  KeyboardPanel {
    id: panel
    anchorItem: root.anchorItem
    owner: root.barIdentity
    bar: root.bar
    open: root.opened
    contentWidth: panel.fittedContentWidth(Style.space(300))
    contentHeight: panel.fittedContentHeight(list.height + header.height + Style.spacing.md)

    // PanelKeyCatcher turns hjkl/x into moves and deletes, so while a
    // search is open it's blocked and a focused sink hands every key to
    // the list instead (letters then type, including h/j/k/l).
    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      blocked: list.searching
      onMoveRequested: function(dx, dy) { list.move(dx, dy) }
      onActivateRequested: list.confirmSelection()
      onCloseRequested: root.close()
      onDeleteRequested: list.handleKey(0, "x")
      onTextKey: function(t) { list.handleKey(0, t) }

      Item {
        id: searchSink
        Keys.onPressed: function(event) {
          if (list.handleKey(event.key, event.text)) { event.accepted = true; return }
          if (event.key === Qt.Key_Escape) { root.close(); event.accepted = true }
        }
      }

      Connections {
        target: list
        function onSearchingChanged() {
          if (list.searching) searchSink.forceActiveFocus()
          else keyCatcher.forceActiveFocus()
        }
      }

      Column {
        anchors.fill: parent
        spacing: Style.spacing.sm

        Text {
          id: header
          text: "NICKELBAR"
          color: root.contentForeground
          font.family: root.contentFontFamily
          font.pixelSize: Style.font.subtitle
          font.bold: true
          font.letterSpacing: 1
        }

        GameList {
          id: list
          width: parent.width
          height: Style.space(380)
          compact: true
          store: root.store
          onChosen: function(id) { root.launch(id) }
        }
      }
    }
  }
}
