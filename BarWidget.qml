import QtQuick
import Quickshell
import qs.Ui
import "engine" as Engine
import "engine/GamesCatalog.js" as Catalog

// The gamepad in the bar. Left click opens the picker (nested Loader, same
// shape as the built-in clock's calendar). Right click resumes whatever was
// last played. Middle click deals a random game. The overlay itself (the
// actual game surface) is a separate entry point — this widget and its
// picker only ever choose a game id and hand it off via shell.summon.
BarWidget {
  id: root
  moduleName: "io.github.cobmuddybug.nickelbar"

  Engine.Store { id: store }

  function launch(gameId) {
    if (!root.bar || !root.bar.shell || typeof root.bar.shell.summon !== "function") return
    root.bar.shell.summon(root.moduleName, JSON.stringify({ game: gameId }))
  }

  function resumeOrPick() {
    if (store.lastPlayed && Catalog.isReady(store.lastPlayed)) launch(store.lastPlayed)
    else togglePicker()
  }

  function launchRandom() {
    var id = Catalog.randomReadyId()
    if (id) launch(id)
  }

  function togglePicker() {
    if (pickerLoader.item) pickerLoader.item.toggle()
  }

  // ---- Shape contract for KeyboardPanel's popout coordinator and
  //      Bar.findPanelWidget (see clock's BarWidget.qml for the reference
  //      implementation). Picker.qml hands KeyboardPanel `owner: hostWidget`
  //      (this item) rather than itself, so without these three, an
  //      outside click closes the popup via `owner.close()` falling through
  //      to KeyboardPanel assigning its own `open` property directly —
  //      which permanently breaks the `open: root.opened` binding in
  //      Picker.qml and leaves the picker unable to ever reopen.
  readonly property bool opened: pickerLoader.item ? pickerLoader.item.opened === true : false

  function open() {
    if (pickerLoader.item) pickerLoader.item.open()
  }

  function close() {
    if (pickerLoader.item) pickerLoader.item.close()
  }

  readonly property bool popoutSwitchClosing: pickerLoader.item ? pickerLoader.item.popoutSwitchClosing === true : false

  function closeForPopoutSwitch() {
    if (pickerLoader.item) pickerLoader.item.closeForPopoutSwitch()
  }

  function injectPicker() {
    var target = pickerLoader.item
    if (!target) return
    if ("bar" in target) target.bar = root.bar
    if ("anchorItem" in target) target.anchorItem = button
    if ("hostWidget" in target) target.hostWidget = root
    if ("store" in target) target.store = store
  }

  onBarChanged: injectPicker()

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  Loader {
    id: pickerLoader
    active: true
    source: Qt.resolvedUrl("Picker.qml")
    onLoaded: { root.injectPicker(); Qt.callLater(root.injectPicker) }
  }

  WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: ""
    tooltipText: "Nickelbar"
    horizontalMargin: 7.5

    onPressed: function(mouseButton) {
      if (mouseButton === Qt.LeftButton) root.togglePicker()
      else if (mouseButton === Qt.RightButton) root.resumeOrPick()
      else if (mouseButton === Qt.MiddleButton) root.launchRandom()
    }
  }
}
