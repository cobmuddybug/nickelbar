import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import qs.Commons
import qs.Ui
import "engine" as Engine
import "engine/GamesCatalog.js" as Catalog
import "engine/help.js" as Help
import "engine/Rng.js" as Rng
import "games/logic/cardart.js" as CardArt

// Centred game surface. One instance per shell session (keepLoaded), one
// Loader for whichever game is active — switching games autosaves the one
// being left, closing pauses and autosaves rather than destroying anything.
Item {
  id: root

  property string omarchyPath: Quickshell.env("OMARCHY_PATH")
  property var shell: null
  property var manifest: null
  readonly property string pluginId: (manifest && manifest.id) || "io.github.cobmuddybug.nickelbar"

  property bool opened: false
  property string activeGameId: ""
  property bool showHelp: false
  // Tab flips back to the game list without dropping the running game;
  // the list is also what shows when nothing has been played yet.
  property bool showPicker: false
  readonly property bool pickerVisible: activeGameId === "" || showPicker
  // Set when the game that just ended beat its stored best, so the header
  // can say so; cleared as soon as a new round starts.
  property bool newBest: false
  property int lastScore: 0
  // Daily challenge: today's seeded game, with its own save slot and no effect on bests.
  property bool dailyMode: false
  property string dailyDate: ""
  // Tickets paid by the round that just ended, shown on the round-over card.
  property int lastEarned: 0
  // The game whose first-run hint is showing in the footer (it clears itself).
  property string hintId: ""
  readonly property var difficultyNames: gameLoader.item && gameLoader.item.difficulties ? gameLoader.item.difficulties : []
  readonly property var parsedHelp: Help.parse(gameLoader.item ? gameLoader.item.helpText : "")

  function setDifficulty(i) {
    var item = gameLoader.item
    if (!item || !root.activeGameId || i < 0 || i >= root.difficultyNames.length) return
    item.difficulty = i
    store.setDifficulty(root.activeGameId, i)
    root.newBest = false
    if (typeof item.newGame === "function") item.newGame()
    if ("started" in item) item.started = false
  }

  function setPlayers(n) {
    var item = gameLoader.item
    if (!item || !root.activeGameId || item.hasTwoPlayer !== true || (n !== 1 && n !== 2)) return
    item.players = n
    store.setPlayerCount(root.activeGameId, n)
    root.newBest = false
    if (typeof item.newGame === "function") item.newGame()
    if ("started" in item) item.started = false
  }

  function togglePlayers() {
    var item = gameLoader.item
    if (item && item.hasTwoPlayer === true) setPlayers(item.players === 2 ? 1 : 2)
  }

  function cycleDifficulty() {
    var n = root.difficultyNames.length, item = gameLoader.item
    if (n > 1 && item) setDifficulty((item.difficulty + 1) % n)
  }

  // Time played, counted a second at a time while a game is on screen and running.
  Timer {
    interval: 1000; repeat: true
    running: root.opened && !root.pickerVisible && root.activeGameId !== "" && !!gameLoader.item && !gameLoader.item.paused && !gameLoader.item.over
    onTriggered: store.addTime(root.activeGameId, 1)
  }

  Connections {
    target: store
    function onCardBackChanged() { CardArt.setBack(store.cardBack) }
  }

  Timer { id: hintTimer; interval: 7000; onTriggered: root.hintId = "" }

  readonly property var activeSpec: Catalog.byId(activeGameId)

  Engine.Store { id: store }
  Engine.Theme { id: theme }
  Engine.Sfx { id: sfx; muted: store.muted }

  function open(payloadJson) {
    var payload = {}
    try { payload = JSON.parse(payloadJson || "{}") } catch (e) { payload = {} }
    var requested = (typeof payload.game === "string" && payload.game.length > 0) ? payload.game : ""
    if (payload.daily === true) {
      loadGame(Catalog.dailyId(Rng.dayNumber(Rng.today())), true)
      requested = root.activeGameId
    }

    if (payload.daily === true) {
      // already loaded above
    } else if (requested && Catalog.isReady(requested)) {
      loadGame(requested)
    } else if (!activeGameId) {
      var fallback = (store.lastPlayed && Catalog.isReady(store.lastPlayed)) ? store.lastPlayed : ""
      if (fallback) loadGame(fallback)
    } else if (gameLoader.item && "paused" in gameLoader.item && !root.showPicker) {
      // Real-time games wait on the pause card after a reopen rather than
      // dropping the player straight back into a moving ball; puzzles
      // (nothing ticking) just carry on.
      if (gameLoader.item.ticking !== true) gameLoader.item.paused = false
    }

    root.showHelp = false
    pickerList.endSearch()
    if (requested) root.showPicker = false
    root.opened = true
    Qt.callLater(function() { keyCatcher.forceActiveFocus() })
  }

  function loadGame(id, daily) {
    root.showPicker = false
    if (id === root.activeGameId && !daily && !root.dailyMode) {
      if (gameLoader.item && "paused" in gameLoader.item) gameLoader.item.paused = false
      return
    }
    persistActive()
    var spec = Catalog.byId(id)
    if (!spec || !spec.qml) return
    root.dailyMode = !!daily
    root.dailyDate = Rng.today()
    root.newBest = false
    var same = id === root.activeGameId
    if (same) gameLoader.active = false      // same game, other mode: load it afresh
    root.activeGameId = id
    store.setLastPlayed(id)
    gameLoader.setSource(Qt.resolvedUrl("games/" + spec.qml), {})
    if (same) gameLoader.active = true
  }

  function togglePicker() {
    if (root.activeGameId === "") return
    root.showPicker = !root.showPicker
    releaseHeld()
    var item = gameLoader.item
    pickerList.endSearch()
    if (root.showPicker) {
      pickerList.selectId(root.activeGameId)
      if (item && "paused" in item && !item.over) item.paused = true
    }
  }

  // Banks the live score. Called the moment a round ends (not only on
  // close/switch — otherwise dying and pressing N threw the score away).
  function bankScore() {
    var item = gameLoader.item
    if (root.dailyMode || !item || !root.activeGameId || typeof item.score !== "number") return
    if (store.reportScore(root.activeGameId, item.score) && item.over) root.newBest = true
  }

  function releaseHeld() {
    var item = gameLoader.item
    if (item && "heldDx" in item) { item.heldDx = 0; item.heldDy = 0; item.heldAction = false }
  }

  function persistActive() {
    var item = gameLoader.item
    if (!item || !root.activeGameId) return
    store.commitTime()
    if (typeof item.saveState === "function") {
      var snapshot = item.saveState()
      if (root.dailyMode) {
        if (snapshot) store.saveState("daily_" + root.activeGameId, { date: root.dailyDate, snap: snapshot })
        else store.clearState("daily_" + root.activeGameId)
      } else if (snapshot) store.saveState(root.activeGameId, snapshot)
      else store.clearState(root.activeGameId)
    }
    if (root.dailyMode) return
    if (item.over === true || item.endless === true) bankScore()
    store.noteProgress(root.activeGameId, item.started === true && item.over !== true, item.progress || "")
  }

  function close() {
    persistActive()
    releaseHeld()
    if (gameLoader.item && "paused" in gameLoader.item) gameLoader.item.paused = true
    root.opened = false
    root.showHelp = false
  }

  function dismiss() {
    close()
    if (root.shell && typeof root.shell.hide === "function") root.shell.hide(root.pluginId)
  }

  function toggle() { root.opened ? root.dismiss() : root.open("{}") }

  function forward(fnName, a, b) {
    var item = gameLoader.item
    if (item && typeof item[fnName] === "function") item[fnName](a, b)
  }

  // Arrow keys -> {dx, dy}, or null for anything else.
  function directionFor(event) {
    if (event.key === Qt.Key_Left) return { dx: -1, dy: 0 }
    if (event.key === Qt.Key_Right) return { dx: 1, dy: 0 }
    if (event.key === Qt.Key_Up) return { dx: 0, dy: -1 }
    if (event.key === Qt.Key_Down) return { dx: 0, dy: 1 }
    return null
  }

  // A round just finished: history, tickets, and the daily if this was it.
  function roundEnded() {
    var item = gameLoader.item, id = root.activeGameId
    if (!item || !id) return
    var won = Catalog.wonTitle(item.overTitle)
    var earned = Catalog.ticketsFor(root.activeSpec, item.score, won)
    store.noteRound(id, won)
    if (root.dailyMode) {
      var type = root.activeSpec ? root.activeSpec.type : ""
      var puzzleLike = type === "Puzzle" || type === "Logic" || type === "Quiz"
      if ((won || !puzzleLike) && store.noteDaily(root.dailyDate, id, item.score)) earned += 20
    }
    store.earnTickets(earned)
    root.lastEarned = earned
  }

  Connections {
    target: gameLoader.item
    ignoreUnknownSignals: true
    function onOverChanged() {
      if (gameLoader.item.over) {
        root.bankScore()
        sfx.roundOver(gameLoader.item.overTitle, root.newBest)
        root.roundEnded()
      } else root.newBest = false
    }
    function onScoreChanged() {
      var item = gameLoader.item
      if (item.over || item.paused || !item.started) { root.lastScore = item.score; return }
      if (item.score > root.lastScore && item.ownSounds !== true) sfx.scored()
      root.lastScore = item.score
    }
    function onSound(name) { sfx.play(name) }
    function onPausedChanged() {
      if (gameLoader.item.ticking === true && !gameLoader.item.over) sfx.play("pause", 150)
    }
  }

  // Scripted testing without a hand on the keyboard — same rationale as
  // omageddon's own IpcHandler (its press/release pair drives exactly what
  // the mouse drives). Useful beyond development too: anyone scripting
  // against this plugin gets the same surface the overlay's own keys use.
  IpcHandler {
    target: "io.github.cobmuddybug.nickelbar"
    function open(): void { root.open("{}") }
    function close(): void { root.dismiss() }
    function toggle(): void { root.toggle() }
    function move(dx: string, dy: string): void { root.forward("moveCursor", Number(dx), Number(dy)) }
    function act(): void { root.forward("activate") }
    function newgame(): void { root.forward("newGame") }
    function pause(): void { root.forward("togglePause") }
    function help(): void { root.showHelp = !root.showHelp }
    function difficulty(i: string): void { root.setDifficulty(Number(i)) }
    function undo(): void { root.forward("undo") }
    function state(): string {
      var item = gameLoader.item
      return JSON.stringify({
        opened: root.opened, game: root.activeGameId,
        over: item ? !!item.over : null, paused: item ? !!item.paused : null,
        score: item && typeof item.score === "number" ? item.score : null,
        status: item ? item.status : null
      })
    }
  }

  PanelWindow {
    id: panel
    visible: root.opened
    anchors { top: true; bottom: true; left: true; right: true }
    color: "transparent"
    WlrLayershell.namespace: "nickelbar"
    WlrLayershell.layer: WlrLayer.Overlay
    WlrLayershell.keyboardFocus: WlrKeyboardFocus.Exclusive
    exclusionMode: ExclusionMode.Ignore

    Rectangle {
      anchors.fill: parent
      color: theme.scrim
    }

    MouseArea {
      anchors.fill: parent
      onClicked: root.dismiss()
    }

    BorderSurface {
      id: card
      width: Math.min(Style.space(760), panel.width - Style.gapsOut * 2)
      height: Math.min(Style.space(680), panel.height - Style.gapsOut * 2)
      anchors.centerIn: parent
      radius: Style.cornerRadius
      color: theme.background
      borderSpec: Border.surfaceSpec("menu", "border", theme.border, Math.max(1, Style.space(2)))
      padding: Style.spacing.panelPadding

      MouseArea { anchors.fill: parent; onClicked: {} }

      Item {
        id: keyCatcher
        anchors.fill: parent
        anchors.topMargin: card.contentTopInset
        anchors.rightMargin: card.contentRightInset
        anchors.bottomMargin: card.contentBottomInset
        anchors.leftMargin: card.contentLeftInset
        focus: true
        Keys.priority: Keys.BeforeItem

        Keys.onPressed: function(event) {
          // The game list gets first go: it owns typing (search), arrows,
          // and Esc while a search is open.
          if (root.pickerVisible && !root.showHelp && pickerList.handleKey(event.key, event.text)) {
            event.accepted = true
            return
          }
          if (event.key === Qt.Key_Escape) {
            if (root.showHelp) root.showHelp = false
            else root.dismiss()
            event.accepted = true
            return
          }
          if (event.key === Qt.Key_M && (event.modifiers & Qt.ControlModifier)) {
            store.setMuted(!store.muted)
            if (!store.muted) sfx.play("act")
            event.accepted = true
            return
          }
          if (event.key === Qt.Key_2 && (event.modifiers & Qt.ControlModifier)) {
            if (!root.pickerVisible) root.togglePlayers()
            event.accepted = true
            return
          }
          if (event.key === Qt.Key_D && (event.modifiers & Qt.ControlModifier)) {
            if (!root.pickerVisible) root.cycleDifficulty()
            event.accepted = true
            return
          }
          if (event.text === "?" || event.text === "h" || event.text === "H") {
            root.showHelp = !root.showHelp
            event.accepted = true
            return
          }
          event.accepted = true
          if (root.showHelp) return
          if (event.key === Qt.Key_Tab || event.key === Qt.Key_Backtab) { sfx.play("open", 120); root.togglePicker(); return }

          if (root.pickerVisible) return

          var item = gameLoader.item
          if (item && "started" in item && !item.over) item.started = true
          if (item && typeof item.handleKey === "function" && !item.paused) {
            if (item.handleKey(event.key, event.text)) return
          }

          var dir = root.directionFor(event)
          if (dir) {
            if (item && item.continuousMove === true) {
              if (event.isAutoRepeat) return
              if (dir.dx !== 0) item.heldDx = dir.dx
              if (dir.dy !== 0) item.heldDy = dir.dy
            }
            if (item && item.continuousMove !== true && item.ownSounds !== true && !item.over && !item.paused) sfx.play("move", 35)
            root.forward("moveCursor", dir.dx, dir.dy)
            return
          }
          if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter || event.key === Qt.Key_Space) {
            if (item && item.continuousMove === true) {
              if (event.isAutoRepeat) return
              item.heldAction = true
            }
            if (root.dailyMode && item && item.over) Rng.seed(Rng.hash(root.activeGameId + root.dailyDate))
            if (item && item.paused) item.paused = false
            else {
              if (item && item.continuousMove !== true && item.ownSounds !== true && !item.over) sfx.play("act", 60)
              root.forward("activate")
            }
            return
          }
          if (event.text === "q" || event.text === "Q") { root.dismiss(); return }
          if (event.text === "u" || event.text === "U") { root.forward("undo"); return }
          if (event.text === "n" || event.text === "N") {
            root.newBest = false
            if (root.dailyMode) Rng.seed(Rng.hash(root.activeGameId + root.dailyDate))
            root.forward("newGame")
            if (item && "started" in item) item.started = false
            return
          }
          if (event.text === "p" || event.text === "P") { root.forward("togglePause"); return }
        }

        Keys.onReleased: function(event) {
          if (event.isAutoRepeat) return
          var item = gameLoader.item
          if (!item || item.continuousMove !== true) return
          if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter || event.key === Qt.Key_Space) {
            item.heldAction = false
            event.accepted = true
            return
          }
          var dir = root.directionFor(event)
          if (!dir) return
          if (dir.dx !== 0 && item.heldDx === dir.dx) item.heldDx = 0
          if (dir.dy !== 0 && item.heldDy === dir.dy) item.heldDy = 0
          event.accepted = true
        }

        onActiveFocusChanged: if (!activeFocus) root.releaseHeld()

        Column {
          anchors.fill: parent
          spacing: Style.spacing.md

          Item {
            id: header
            width: parent.width
            height: Math.max(Style.space(30), Style.font.heading + Style.spacing.controlPaddingY * 2)

            Text {
              anchors.left: parent.left
              anchors.verticalCenter: parent.verticalCenter
              text: root.activeSpec && !root.pickerVisible ? root.activeSpec.title.toUpperCase() : "NICKELBAR"
              color: theme.foreground
              font.family: theme.fontFamily
              font.pixelSize: Style.font.heading
              font.bold: true
            }

            Column {
              anchors.right: parent.right
              anchors.verticalCenter: parent.verticalCenter
              spacing: Style.space(1)

              Text {
                anchors.right: parent.right
                text: root.pickerVisible ? (root.activeGameId ? "tab back to " + root.activeSpec.title : "choose a game")
                  : (root.newBest ? "NEW BEST  ·  " : "") + (gameLoader.item && gameLoader.item.status ? gameLoader.item.status : "")
                color: root.newBest && !root.pickerVisible ? theme.highlight : theme.accent
                font.family: theme.fontFamily
                font.pixelSize: Style.font.bodySmall
                font.bold: true
              }
              Text {
                anchors.right: parent.right
                readonly property int liveScore: gameLoader.item && typeof gameLoader.item.score === "number" ? gameLoader.item.score : 0
                readonly property int best: root.activeGameId ? store.bestScore(root.activeGameId) : 0
                text: root.activeGameId && !root.pickerVisible ? (liveScore + " · best " + Math.max(best, liveScore)) : ""
                color: theme.dim
                font.family: theme.fontFamily
                font.pixelSize: Style.font.caption
              }
            }
          }

          Item {
            id: body
            width: parent.width
            height: parent.height - Style.spacing.md * 2 - header.height - footer.height

            Loader {
              id: gameLoader
              anchors.fill: parent
              active: true
              visible: !root.pickerVisible
              onLoaded: {
                var it = item
                if (!it) return
                if (it.hasTwoPlayer === true) it.players = store.playerCount(root.activeGameId)
                if ("difficulty" in it) it.difficulty = store.difficultyOf(root.activeGameId, it.defaultDifficulty)
                root.lastEarned = 0
                if (!store.isSeen(root.activeGameId)) { root.hintId = root.activeGameId; store.markSeen(root.activeGameId); hintTimer.restart() }
                CardArt.setBack(store.cardBack)
                if (root.dailyMode) {
                  // Today's seeded game: the same deal for everyone, resumed from its own save if started today.
                  var did = root.activeGameId, daySeed = Rng.hash(did + root.dailyDate)
                  Rng.seed(daySeed)
                  store.loadState("daily_" + did, function(savedDaily) {
                    if (gameLoader.item !== it) return
                    if (savedDaily && savedDaily.date === root.dailyDate && typeof it.loadState === "function") it.loadState(savedDaily.snap)
                    else { Rng.seed(daySeed); if (typeof it.newGame === "function") it.newGame() }
                    if ("started" in it && savedDaily && savedDaily.date === root.dailyDate) it.started = true
                  })
                  return
                }
                Rng.unseed()
                if (typeof it.loadState === "function") {
                  var gid = root.activeGameId
                  store.loadState(gid, function(saved) {
                    if (gameLoader.item !== it) return
                    it.loadState(saved)
                    if ("started" in it && store.inProgress[gid]) it.started = true
                  })
                } else if (typeof it.newGame === "function") {
                  it.newGame()
                }
              }
            }

            GameList {
              id: pickerList
              anchors.fill: parent
              visible: root.pickerVisible
              store: store
              activeId: root.activeGameId
              onChosen: function(id) { root.loadGame(id) }
              onDailyChosen: function(id) { root.loadGame(id, true) }
            }

            // Shared paused / round-over card. Every game already dims its own
            // board; this says why, and what key gets you going again.
            Rectangle {
              id: banner
              readonly property var game: gameLoader.item
              readonly property bool isPaused: !!game && game.paused === true && !game.over
              readonly property bool isOver: !!game && game.over === true
              visible: !root.pickerVisible && !root.showHelp && (isPaused || isOver)
              // Paused hides the board anyway, so centre it; a finished round
              // sits low so the final board stays readable above it.
              anchors.horizontalCenter: parent.horizontalCenter
              y: isOver ? parent.height - height - Style.spacing.lg : (parent.height - height) / 2
              width: Math.min(parent.width * 0.8, bannerColumn.implicitWidth + Style.spacing.xxl * 2)
              height: bannerColumn.implicitHeight + Style.spacing.xl * 2
              radius: Style.cornerRadius
              color: theme.background
              border.width: Math.max(1, Style.space(1))
              border.color: root.newBest && isOver ? theme.highlight : theme.border
              opacity: 0.94

              Column {
                id: bannerColumn
                anchors.centerIn: parent
                spacing: Style.spacing.xs

                Text {
                  anchors.horizontalCenter: parent.horizontalCenter
                  text: banner.isPaused ? "PAUSED" : (root.newBest ? "NEW BEST · " + (banner.game ? banner.game.score : 0) : (banner.game ? (banner.game.overTitle || "GAME OVER") : ""))
                  color: root.newBest && banner.isOver ? theme.highlight : theme.foreground
                  font.family: theme.fontFamily
                  font.pixelSize: Style.font.title
                  font.bold: true
                }
                Text {
                  anchors.horizontalCenter: parent.horizontalCenter
                  text: banner.isPaused ? "p or space to resume" : (root.dailyMode ? "n or space to retry today's board" : "n or space for a new game")
                  color: theme.dim
                  font.family: theme.fontFamily
                  font.pixelSize: Style.font.caption
                }
                Text {
                  anchors.horizontalCenter: parent.horizontalCenter
                  visible: banner.isOver && root.lastEarned > 0
                  text: "+" + root.lastEarned + " tickets" + (root.dailyMode && store.dailyDone(root.dailyDate) ? "  ·  daily done ✓" : "")
                  color: theme.accent
                  font.family: theme.fontFamily
                  font.pixelSize: Style.font.caption
                  font.bold: true
                }
              }
            }

            // Click (or ctrl+m) to mute / unmute; the choice is saved.
            Rectangle {
              id: muteBadge
              visible: !root.pickerVisible && !root.showHelp
              anchors.top: parent.top
              anchors.right: parent.right
              anchors.margins: Style.spacing.sm
              width: muteLabel.implicitWidth + Style.spacing.md * 2
              height: muteLabel.implicitHeight + Style.spacing.xs * 2
              radius: Style.cornerRadius
              color: theme.background
              border.width: Math.max(1, Style.space(1))
              border.color: theme.border
              opacity: muteMouse.containsMouse ? 0.95 : 0.6

              Text {
                id: muteLabel
                anchors.centerIn: parent
                text: store.muted ? "🔇 muted" : "🔊"
                color: store.muted ? theme.highlight : theme.dim
                font.family: theme.fontFamily
                font.pixelSize: Style.font.caption
              }
              MouseArea {
                id: muteMouse
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: {
                  store.setMuted(!store.muted)
                  if (!store.muted) sfx.play("act")
                }
              }
            }

            Rectangle {
              anchors.fill: parent
              visible: root.showHelp
              radius: Style.cornerRadius
              color: theme.background
              opacity: 0.96

              // Keeps clicks off the game underneath; a click closes help.
              MouseArea { anchors.fill: parent; onClicked: root.showHelp = false }

              Flickable {
                id: helpFlick
                anchors.fill: parent
                anchors.margins: Style.spacing.xl
                contentWidth: width
                contentHeight: helpColumn.implicitHeight
                clip: true
                boundsBehavior: Flickable.StopAtBounds

                Column {
                  id: helpColumn
                  width: helpFlick.width
                  y: Math.max(0, (helpFlick.height - implicitHeight) / 2)
                  spacing: Style.spacing.sm

                  Text {
                    width: parent.width
                    text: root.activeSpec ? root.activeSpec.title.toUpperCase() : "HELP"
                    color: theme.accent
                    font.family: theme.fontFamily
                    font.pixelSize: Style.font.title
                    font.bold: true
                  }
                  Text {
                    width: parent.width
                    visible: !!root.activeSpec
                    wrapMode: Text.WordWrap
                    text: root.activeSpec ? Catalog.blurb(root.activeGameId) : ""
                    color: theme.foreground
                    font.family: theme.fontFamily
                    font.pixelSize: Style.font.body
                  }

                  Text {
                    visible: root.parsedHelp.keys.length > 0
                    topPadding: Style.spacing.sm
                    text: "CONTROLS"
                    color: theme.dim
                    font.family: theme.fontFamily
                    font.pixelSize: Style.font.caption
                    font.bold: true
                    font.letterSpacing: 1
                  }
                  Repeater {
                    model: root.parsedHelp.keys
                    delegate: Item {
                      required property var modelData
                      width: helpColumn.width
                      height: Math.max(keyText.implicitHeight, descText.implicitHeight)
                      Text {
                        id: keyText
                        width: parent.width * 0.3
                        wrapMode: Text.WordWrap
                        text: parent.modelData.key
                        color: theme.highlight
                        font.family: theme.fontFamily
                        font.pixelSize: Style.font.bodySmall
                        font.bold: true
                      }
                      Text {
                        id: descText
                        x: parent.width * 0.32
                        width: parent.width * 0.68
                        wrapMode: Text.WordWrap
                        text: parent.modelData.desc
                        color: theme.foreground
                        font.family: theme.fontFamily
                        font.pixelSize: Style.font.bodySmall
                      }
                    }
                  }

                  Text {
                    visible: root.parsedHelp.notes.length > 0
                    topPadding: Style.spacing.sm
                    text: "HOW IT PLAYS"
                    color: theme.dim
                    font.family: theme.fontFamily
                    font.pixelSize: Style.font.caption
                    font.bold: true
                    font.letterSpacing: 1
                  }
                  Repeater {
                    model: root.parsedHelp.notes
                    delegate: Text {
                      required property string modelData
                      width: helpColumn.width
                      wrapMode: Text.WordWrap
                      text: "•  " + modelData
                      color: theme.foreground
                      font.family: theme.fontFamily
                      font.pixelSize: Style.font.bodySmall
                    }
                  }

                  Text {
                    visible: !!gameLoader.item && !!gameLoader.item.mouseHelp
                    topPadding: Style.spacing.sm
                    width: parent.width
                    wrapMode: Text.WordWrap
                    text: gameLoader.item && gameLoader.item.mouseHelp ? "MOUSE  ·  " + gameLoader.item.mouseHelp : ""
                    color: theme.dim
                    font.family: theme.fontFamily
                    font.pixelSize: Style.font.bodySmall
                  }

                  // Players, for games with a two-player mode: click one, or ctrl+2 to switch.
                  Item {
                    visible: !!gameLoader.item && gameLoader.item.hasTwoPlayer === true
                    width: parent.width
                    height: visible ? Style.space(30) : 0
                    Row {
                      spacing: Style.spacing.xs
                      anchors.verticalCenter: parent.verticalCenter
                      Text {
                        anchors.verticalCenter: parent.verticalCenter
                        rightPadding: Style.spacing.sm
                        text: "PLAYERS"
                        color: theme.dim
                        font.family: theme.fontFamily
                        font.pixelSize: Style.font.caption
                        font.bold: true
                        font.letterSpacing: 1
                      }
                      Repeater {
                        model: ["vs computer", "two players"]
                        delegate: Rectangle {
                          required property string modelData
                          required property int index
                          readonly property bool current: !!gameLoader.item && gameLoader.item.players === index + 1
                          width: pText.implicitWidth + Style.spacing.md * 2
                          height: pText.implicitHeight + Style.spacing.xs * 2
                          radius: height / 2
                          color: current ? theme.accent : "transparent"
                          border.width: 1
                          border.color: current ? theme.accent : theme.faint
                          Text {
                            id: pText
                            anchors.centerIn: parent
                            text: parent.modelData
                            color: parent.current ? theme.background : theme.dim
                            font.family: theme.fontFamily
                            font.pixelSize: Style.font.caption
                            font.bold: true
                          }
                          MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: root.setPlayers(parent.index + 1) }
                        }
                      }
                    }
                  }

                  // Difficulty, for games that have levels: click one, or ctrl+d to cycle.
                  Item {
                    visible: root.difficultyNames.length > 1
                    width: parent.width
                    height: visible ? Style.space(30) : 0
                    Row {
                      spacing: Style.spacing.xs
                      anchors.verticalCenter: parent.verticalCenter
                      Text {
                        anchors.verticalCenter: parent.verticalCenter
                        rightPadding: Style.spacing.sm
                        text: "DIFFICULTY"
                        color: theme.dim
                        font.family: theme.fontFamily
                        font.pixelSize: Style.font.caption
                        font.bold: true
                        font.letterSpacing: 1
                      }
                      Repeater {
                        model: root.difficultyNames
                        delegate: Rectangle {
                          required property string modelData
                          required property int index
                          readonly property bool current: !!gameLoader.item && gameLoader.item.difficulty === index
                          width: dText.implicitWidth + Style.spacing.md * 2
                          height: dText.implicitHeight + Style.spacing.xs * 2
                          radius: height / 2
                          color: current ? theme.accent : "transparent"
                          border.width: 1
                          border.color: current ? theme.accent : theme.faint
                          Text {
                            id: dText
                            anchors.centerIn: parent
                            text: parent.modelData
                            color: parent.current ? theme.background : theme.dim
                            font.family: theme.fontFamily
                            font.pixelSize: Style.font.caption
                            font.bold: true
                          }
                          MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: root.setDifficulty(parent.index) }
                        }
                      }
                    }
                  }

                  Text {
                    topPadding: Style.spacing.md
                    width: parent.width
                    wrapMode: Text.WordWrap
                    text: "everywhere:  h this help  ·  u undo  ·  n new game  ·  p pause  ·  tab game list  ·  ctrl+m or the speaker badge: sound" + (root.difficultyNames.length > 1 ? "  ·  ctrl+d difficulty (restarts)" : "") + (!!gameLoader.item && gameLoader.item.hasTwoPlayer === true ? "  ·  ctrl+2 players (restarts)" : "") + "  ·  esc / q close"
                    color: theme.dim
                    font.family: theme.fontFamily
                    font.pixelSize: Style.font.caption
                  }
                }
              }
            }
          }

          Item {
            id: footer
            width: parent.width
            height: Math.max(Style.space(22), Style.font.caption + Style.spacing.sm)

            Text {
              anchors.left: parent.left
              anchors.verticalCenter: parent.verticalCenter
              text: root.pickerVisible ? "type to search · arrows move · enter play" + (root.activeGameId ? " · tab back to game" : "")
                : (root.hintId === root.activeGameId && root.hintId !== "" ? "first time here? press h for this game's controls" : "arrows move · space act · n new · p pause · tab games · h help")
              color: theme.dim
              font.family: theme.fontFamily
              font.pixelSize: Style.font.caption
            }
            Text {
              anchors.right: parent.right
              anchors.verticalCenter: parent.verticalCenter
              text: root.pickerVisible ? "esc close" : "esc / q close"
              color: theme.dim
              font.family: theme.fontFamily
              font.pixelSize: Style.font.caption
            }
          }
        }
      }
    }
  }

  onOpenedChanged: if (opened) Qt.callLater(function() { keyCatcher.forceActiveFocus() })
}
