import QtQuick
import qs.Commons
import "engine" as Engine
import "engine/GamesCatalog.js" as Catalog
import "engine/Rng.js" as Rng

// The game picker, used full-size by the overlay (a grid of tiles in
// sections) and compact by the bar's dropdown (one column). One component,
// two sizes, so the two never drift apart.
//
// Keys (fed in through handleKey by whoever owns keyboard focus):
//   arrows          move — across the grid and between sections
//   enter / space   play the selected game
//   [ ]             previous / next section; Home / End first / last game
//   *               favourite on/off for the selected game
//   any other key   starts a search ("lc" finds Light Cycles, "tetris"
//                   finds Blockfall); / starts an empty one (kept for habit). While searching, arrows still move,
//                   Backspace edits, Esc clears.
Item {
  id: root

  property var store: null
  property bool compact: false
  // The game currently loaded in the overlay (marked "playing").
  property string activeId: ""

  property string query: ""
  property bool searching: false
  // "", "quick", "vs", "new" or "unplayed": narrows the categories (f cycles).
  property string filter: ""

  // Selection is by (section, index) rather than id: a game can appear
  // twice (Recent and its own category).
  property int selSection: 0
  property int selIndex: 0

  signal chosen(string id)
  signal dailyChosen(string id)

  // Today's date, refreshed whenever the list is shown (the shell can stay up for days).
  property string today: Rng.today()
  onVisibleChanged: if (visible) today = Rng.today()
  readonly property string dailyGameId: Catalog.dailyId(Rng.dayNumber(today))
  property bool showPrizes: false

  readonly property var recentIds: store ? store.recent : []
  readonly property var contIds: store ? Object.keys(store.inProgress) : []
  readonly property var sections: Catalog.sections(searching ? query : "", recentIds, store ? store.favourites : [], contIds, filter, store ? store.scores : ({}), compact ? "" : dailyGameId)
  readonly property real gridSpacing: Style.spacing.md
  // Wide enough (the overlay, not the bar dropdown): a detail panel on the right.
  readonly property bool showPanel: !compact && width >= Style.space(680)
  readonly property real panelWidth: showPanel ? Math.max(Style.space(220), width * 0.3) : 0
  readonly property real listWidth: width - (showPanel ? panelWidth + Style.spacing.lg : 0)
  readonly property int columns: compact ? 1 : Math.max(2, Math.floor((listWidth + gridSpacing) / (Style.space(170) + gridSpacing)))
  readonly property var selectedGame: {
    var sec = sections[selSection]
    return sec && sec.games[selIndex] ? sec.games[selIndex] : null
  }

  Engine.Theme { id: theme }

  onSectionsChanged: clampSelection()

  function clampSelection() {
    if (!sections.length) { selSection = 0; selIndex = 0; return }
    if (selSection >= sections.length) selSection = sections.length - 1
    var len = sections[selSection].games.length
    if (!len) { selIndex = 0; return }
    if (selIndex >= len) selIndex = len - 1
  }

  // Points the selection at a game in its own category (not Recent), e.g.
  // the one that's running when the overlay flips back to the list.
  function selectId(id) {
    for (var s = 0; s < sections.length; ++s) {
      if (sections[s].name === "Recent") continue
      for (var i = 0; i < sections[s].games.length; ++i)
        if (sections[s].games[i].id === id) { selSection = s; selIndex = i; return }
    }
  }

  function resetToTop() { selSection = 0; selIndex = 0; flick.contentY = 0 }

  function move(dx, dy) {
    if (!sections.length) return
    var cols = root.columns
    var len = sections[selSection].games.length
    if (dx !== 0) {
      var i = selIndex + dx, s = selSection
      if (i < 0) { if (s === 0) return; s--; i = sections[s].games.length - 1 }
      else if (i >= len) { if (s === sections.length - 1) return; s++; i = 0 }
      selSection = s; selIndex = i
      return
    }
    var col = selIndex % cols
    if (dy > 0) {
      if (selIndex + cols < len) { selIndex += cols; return }
      if (Math.floor(selIndex / cols) < Math.floor((len - 1) / cols)) { selIndex = len - 1; return }
      if (selSection === sections.length - 1) return
      selSection++
      selIndex = Math.min(col, sections[selSection].games.length - 1)
    } else if (dy < 0) {
      if (selIndex - cols >= 0) { selIndex -= cols; return }
      if (selSection === 0) return
      selSection--
      var plen = sections[selSection].games.length
      selIndex = Math.min(Math.floor((plen - 1) / cols) * cols + col, plen - 1)
    }
  }

  // Where the pointer last really was, in screen coordinates.
  property point lastPointer: Qt.point(-1, -1)
  function pointerMoved(p) {
    if (Math.abs(p.x - lastPointer.x) < 1 && Math.abs(p.y - lastPointer.y) < 1) return false
    lastPointer = p
    return true
  }

  function cycleFilter() {
    var i = Catalog.FILTERS.indexOf(root.filter)
    root.filter = Catalog.FILTERS[(i + 1) % Catalog.FILTERS.length]
    resetToTop()
  }

  function jumpSection(d) {
    if (!sections.length) return
    selSection = Math.max(0, Math.min(sections.length - 1, selSection + d))
    selIndex = 0
  }

  // Keeps the same game selected as the Favourites row appears or changes.
  function toggleFavourite() {
    var g = root.selectedGame
    if (!g || !root.store) return
    root.store.toggleFavourite(g.id)
    Qt.callLater(function() { root.selectId(g.id) })
  }

  function confirmSelection() {
    var g = root.selectedGame
    if (!g || !g.qml) return
    endSearch()
    if (g.daily) root.dailyChosen(g.id)
    else root.chosen(g.id)
  }

  function beginSearch(initial) {
    root.searching = true
    root.query = initial || ""
    resetToTop()
  }

  function endSearch() {
    if (!root.searching) return
    root.searching = false
    root.query = ""
    resetToTop()
  }

  // Returns true when the key was used. Esc with no search running, Tab
  // and ? are left for the caller.
  function handleKey(key, text) {
    if (key === Qt.Key_Escape) {
      if (root.showPrizes) { root.showPrizes = false; return true }
      if (root.searching) { endSearch(); return true }
      return false
    }
    if (key === Qt.Key_Return || key === Qt.Key_Enter || key === Qt.Key_Space) { confirmSelection(); return true }
    if (key === Qt.Key_Left) { move(-1, 0); return true }
    if (key === Qt.Key_Right) { move(1, 0); return true }
    if (key === Qt.Key_Up) { move(0, -1); return true }
    if (key === Qt.Key_Down) { move(0, 1); return true }
    if (key === Qt.Key_Home) { selSection = 0; selIndex = 0; return true }
    if (key === Qt.Key_End) { selSection = sections.length - 1; selIndex = sections[selSection].games.length - 1; return true }
    if (key === Qt.Key_Backspace) {
      if (!root.searching) return true
      if (root.query.length > 1) { root.query = root.query.slice(0, -1); resetToTop() }
      else endSearch()
      return true
    }
    if (key === Qt.Key_Tab || key === Qt.Key_Backtab) return false
    if (!text || text.length !== 1 || text === "?" || text.trim() === "") return false
    if (!root.searching) {
      if (text === "[") { jumpSection(-1); return true }
      if (text === "]") { jumpSection(1); return true }
      if (text === "*") { toggleFavourite(); return true }
      if (text === "f") { cycleFilter(); return true }
      if (text === "$") { root.showPrizes = !root.showPrizes; return true }
      beginSearch(text === "/" ? "" : text)
      return true
    }
    if (text === "/") return true
    root.query = root.query + text
    resetToTop()
    return true
  }

  // Tiles report in when selected; scrolling happens a beat later (after
  // layout), from here rather than from the tile, because a search can
  // destroy the tile before the deferred call runs. Item-typed properties
  // null themselves when their target is destroyed.
  property Item selectedTile: null
  property Item selectedSectionItem: null

  function noteSelected(tile, sectionItem) {
    selectedTile = tile
    selectedSectionItem = sectionItem
    Qt.callLater(scrollToSelected)
  }

  function scrollToSelected() {
    if (selectedTile && selectedSectionItem) ensureVisible(selectedTile, selectedSectionItem)
  }

  // Keep the selected tile on screen (and its section header, when the
  // tile is on the section's first row).
  function ensureVisible(item, sectionItem) {
    var top = (item.index < root.columns ? sectionItem : item).mapToItem(flick.contentItem, 0, 0).y
    var bottom = item.mapToItem(flick.contentItem, 0, 0).y + item.height
    if (top < flick.contentY) flick.contentY = Math.max(0, top)
    else if (bottom > flick.contentY + flick.height)
      flick.contentY = Math.min(Math.max(0, flick.contentHeight - flick.height), bottom - flick.height)
  }

  // Search line: shows the query while searching, a hint otherwise.
  Item {
    id: searchBar
    width: root.listWidth
    height: Math.max(Style.space(root.compact ? 20 : 26), Style.font.body + Style.spacing.sm * 2)

    Rectangle {
      anchors.fill: parent
      radius: Style.cornerRadius
      color: root.searching ? theme.selectedBackground : "transparent"
      border.width: root.searching ? Math.max(1, Style.space(1)) : 0
      border.color: theme.accent
    }
    Text {
      anchors.left: parent.left
      anchors.leftMargin: Style.spacing.md
      anchors.right: escHint.left
      anchors.verticalCenter: parent.verticalCenter
      text: root.searching ? "/ " + root.query + "▏" : (root.compact ? "type to search" : "type to search  ·  [ ] sections  ·  f filter  ·  $ prizes  ·  * favourite  ·  enter plays")
      color: root.searching ? theme.foreground : theme.dim
      font.family: theme.fontFamily
      font.pixelSize: root.searching ? Style.font.body : Style.font.caption
      elide: Text.ElideRight
    }
    Text {
      id: escHint
      anchors.right: parent.right
      anchors.rightMargin: Style.spacing.md
      anchors.verticalCenter: parent.verticalCenter
      text: root.searching ? "esc clears" : ""
      color: theme.dim
      font.family: theme.fontFamily
      font.pixelSize: Style.font.caption
    }
  }

  // Filter chips: All, Quick (3 minutes or less), Versus (a computer opponent), New, Unplayed.
  Flow {
    id: filterBar
    visible: !root.compact && !root.searching
    anchors.top: searchBar.bottom
    anchors.topMargin: visible ? Style.spacing.sm : 0
    width: root.listWidth
    height: visible ? implicitHeight : 0
    spacing: Style.spacing.xs

    Repeater {
      model: Catalog.FILTERS
      delegate: Rectangle {
        required property string modelData
        readonly property bool current: modelData === root.filter
        width: chipText.implicitWidth + Style.spacing.md * 2
        height: chipText.implicitHeight + Style.spacing.xs * 2
        radius: height / 2
        color: current ? theme.accent : "transparent"
        border.width: 1
        border.color: current ? theme.accent : theme.faint
        Text {
          id: chipText
          anchors.centerIn: parent
          text: Catalog.FILTER_NAMES[parent.modelData]
          color: parent.current ? theme.background : theme.dim
          font.family: theme.fontFamily
          font.pixelSize: Style.font.caption
          font.bold: true
        }
        MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: { root.filter = parent.modelData; root.resetToTop() } }
      }
    }

    // Opens the prize shelf: tickets buy card backs.
    Rectangle {
      width: prizeChipText.implicitWidth + Style.spacing.md * 2
      height: prizeChipText.implicitHeight + Style.spacing.xs * 2
      radius: height / 2
      color: root.showPrizes ? theme.highlight : "transparent"
      border.width: 1
      border.color: root.showPrizes ? theme.highlight : theme.faint
      Text {
        id: prizeChipText
        anchors.centerIn: parent
        text: "★ " + (root.store ? root.store.tickets : 0) + " · Prizes"
        color: root.showPrizes ? theme.background : theme.dim
        font.family: theme.fontFamily
        font.pixelSize: Style.font.caption
        font.bold: true
      }
      MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: root.showPrizes = !root.showPrizes }
    }
  }

  // The prize shelf: card backs for tickets. Click to buy, click an owned one to equip it.
  Rectangle {
    id: shelf
    visible: root.showPrizes && !root.compact
    z: 5
    anchors.top: filterBar.bottom
    anchors.topMargin: Style.spacing.sm
    anchors.bottom: parent.bottom
    width: root.listWidth
    radius: Style.cornerRadius
    color: theme.background
    border.width: 1
    border.color: theme.accent

    Column {
      anchors.fill: parent
      anchors.margins: Style.spacing.lg
      spacing: Style.spacing.sm

      Text {
        width: parent.width
        text: "PRIZE SHELF  ·  " + (root.store ? root.store.tickets : 0) + " tickets  ·  " + Catalog.rankFor(root.store ? root.store.ticketsEarned : 0)
        color: theme.accent
        font.family: theme.fontFamily
        font.pixelSize: Style.font.body
        font.bold: true
      }
      Text {
        width: parent.width
        wrapMode: Text.WordWrap
        text: "Finished rounds pay tickets: Midway games by score, the rest a few, wins a bonus, and the daily challenge 20. Card backs show in every card game."
        color: theme.dim
        font.family: theme.fontFamily
        font.pixelSize: Style.font.caption
      }
      Repeater {
        model: [{ id: "back-standard", name: "Standard card backs", cost: 0, back: 0 }].concat(Catalog.PRIZES)
        delegate: Rectangle {
          required property var modelData
          readonly property bool owned: modelData.cost === 0 || (!!root.store && root.store.prizes.indexOf(modelData.id) >= 0)
          readonly property bool equipped: !!root.store && root.store.cardBack === modelData.back
          readonly property bool affordable: !!root.store && root.store.tickets >= modelData.cost
          width: parent.width
          height: Style.space(34)
          radius: Style.cornerRadius
          color: equipped ? theme.selectedBackground : theme.withAlpha(theme.foreground, 0.04)
          border.width: equipped ? 1 : 0
          border.color: theme.accent
          Text {
            anchors.left: parent.left
            anchors.leftMargin: Style.spacing.md
            anchors.verticalCenter: parent.verticalCenter
            text: parent.modelData.name
            color: parent.owned || parent.affordable ? theme.foreground : theme.dim
            font.family: theme.fontFamily
            font.pixelSize: Style.font.body
          }
          Text {
            anchors.right: parent.right
            anchors.rightMargin: Style.spacing.md
            anchors.verticalCenter: parent.verticalCenter
            text: parent.equipped ? "equipped" : parent.owned ? "equip" : parent.modelData.cost + " tickets"
            color: parent.equipped ? theme.accent : parent.owned || parent.affordable ? theme.highlight : theme.dim
            font.family: theme.fontFamily
            font.pixelSize: Style.font.bodySmall
            font.bold: true
          }
          MouseArea {
            anchors.fill: parent
            cursorShape: Qt.PointingHandCursor
            onClicked: {
              if (!root.store) return
              if (parent.owned) root.store.equipBack(parent.modelData.back)
              else if (parent.affordable) root.store.buyPrize(parent.modelData.id, parent.modelData.cost, parent.modelData.back)
            }
          }
        }
      }
    }
  }

  // Section tabs: where you are, and a click to jump.
  Flow {
    id: tabs
    visible: !root.compact && !root.searching
    anchors.top: filterBar.bottom
    anchors.topMargin: visible ? Style.spacing.sm : 0
    width: root.listWidth
    height: visible ? implicitHeight : 0
    spacing: Style.spacing.xs

    Repeater {
      model: root.sections
      delegate: Rectangle {
        required property var modelData
        required property int index
        readonly property bool current: index === root.selSection
        width: tabText.implicitWidth + Style.spacing.md * 2
        height: tabText.implicitHeight + Style.spacing.xs * 2
        radius: height / 2
        color: current ? theme.selectedBackground : "transparent"
        border.width: 1
        border.color: current ? theme.accent : theme.faint
        Text {
          id: tabText
          anchors.centerIn: parent
          text: parent.modelData.name + "  " + parent.modelData.games.length
          color: parent.current ? theme.highlight : theme.dim
          font.family: theme.fontFamily
          font.pixelSize: Style.font.caption
          // Same weight whether current or not: a bold tab is wider, and
          // the row could re-wrap and shift the whole list as you move.
          font.bold: true
        }
        MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: { root.selSection = parent.index; root.selIndex = 0 } }
      }
    }
  }

  Flickable {
    id: flick
    anchors.top: tabs.bottom
    anchors.topMargin: Style.spacing.sm
    anchors.left: parent.left
    width: root.listWidth
    anchors.bottom: parent.bottom
    clip: true
    contentWidth: width
    contentHeight: sectionColumn.implicitHeight
    boundsBehavior: Flickable.StopAtBounds

    Column {
      id: sectionColumn
      width: flick.width
      spacing: root.compact ? Style.spacing.sm : Style.spacing.lg

      Repeater {
        model: root.sections

        delegate: Column {
          id: sectionDelegate
          required property var modelData
          required property int index
          width: sectionColumn.width
          spacing: Style.spacing.xs

          Text {
            text: sectionDelegate.modelData.name.toUpperCase()
            color: theme.dim
            font.family: theme.fontFamily
            font.pixelSize: Style.font.caption
            font.bold: true
            font.letterSpacing: 1
            leftPadding: Style.spacing.xs
          }

          Grid {
            id: grid
            columns: root.columns
            spacing: root.compact ? 0 : root.gridSpacing
            width: parent.width

            Repeater {
              model: sectionDelegate.modelData.games

              delegate: Item {
                id: tile
                required property var modelData
                required property int index
                readonly property bool selected: sectionDelegate.index === root.selSection && index === root.selIndex
                readonly property bool playing: modelData.id === root.activeId
                readonly property int best: root.store ? root.store.bestScore(modelData.id) : 0
                readonly property bool going: !!root.store && !!root.store.inProgress[modelData.id] && !playing
                readonly property bool fav: !!root.store && root.store.favourites.indexOf(modelData.id) >= 0
                readonly property string prog: root.store && root.store.progress[modelData.id] ? root.store.progress[modelData.id] : ""
                readonly property bool isNew: Catalog.isNew(modelData.id)
                readonly property string alias: root.searching ? Catalog.matchedTag(modelData, root.query) : ""

                width: root.compact ? grid.width : (grid.width - root.gridSpacing * (root.columns - 1)) / root.columns
                height: root.compact ? Style.space(26) : Style.space(60)

                onSelectedChanged: if (selected) root.noteSelected(tile, sectionDelegate)
                Component.onCompleted: if (selected) root.noteSelected(tile, sectionDelegate)

                Rectangle {
                  anchors.fill: parent
                  radius: Style.cornerRadius
                  color: tile.selected ? theme.selectedBackground : (root.compact ? "transparent" : theme.withAlpha(theme.foreground, 0.04))
                  border.width: tile.selected && !root.compact ? Math.max(1, Style.space(2)) : 0
                  border.color: theme.accent
                }

                Engine.GameIcon {
                  id: tileIcon
                  gameId: tile.modelData.id
                  anchors.left: parent.left
                  anchors.leftMargin: root.compact ? Style.spacing.sm : Style.spacing.md
                  anchors.verticalCenter: parent.verticalCenter
                  width: root.compact ? Style.space(16) : parent.height * 0.62
                  height: width
                }

                // Full tile: icon, title on top, status below.
                Column {
                  visible: !root.compact
                  anchors.left: tileIcon.right
                  anchors.right: parent.right
                  anchors.leftMargin: Style.spacing.md
                  anchors.rightMargin: Style.spacing.lg
                  anchors.verticalCenter: parent.verticalCenter
                  spacing: Style.space(2)

                  Text {
                    width: parent.width
                    text: tile.modelData.title + (tile.fav ? "  ★" : "")
                    color: tile.selected ? theme.highlight : theme.foreground
                    font.family: theme.fontFamily
                    font.pixelSize: Style.font.body
                    font.bold: true
                    elide: Text.ElideRight
                  }
                  Text {
                    width: parent.width
                    text: {
                      var parts = []
                      if (tile.alias) parts.push("“" + tile.alias + "”")
                      if (tile.playing) parts.push("▶ playing")
                      else if (tile.going) parts.push("● in progress")
                      if (tile.modelData.daily) parts.push(root.store && root.store.dailyDone(root.today) ? "DAILY · done ✓" : "DAILY · streak " + (root.store ? root.store.dailyStreak(root.today) : 0))
                      else if (tile.isNew && !tile.playing) parts.push("NEW")
                      if (tile.prog) parts.push(tile.prog)
                      else if (tile.best > 0) parts.push("best " + tile.best)
                      if (!tile.prog && tile.best <= 0) parts.push("~" + Catalog.meta(tile.modelData.id).mins + " min")
                      if (!parts.length) parts.push(tile.modelData.type.toLowerCase())
                      return parts.join("  ·  ")
                    }
                    color: tile.playing || tile.going ? theme.accent : theme.dim
                    font.family: theme.fontFamily
                    font.pixelSize: Style.font.caption
                    elide: Text.ElideRight
                  }
                }

                // Compact row: title left, best right.
                Text {
                  visible: root.compact
                  anchors.left: tileIcon.right
                  anchors.leftMargin: Style.spacing.sm
                  anchors.verticalCenter: parent.verticalCenter
                  width: parent.width * 0.62
                  text: (tile.playing ? "▶ " : tile.going ? "● " : "") + tile.modelData.title + (tile.fav ? " ★" : "")
                  color: tile.selected ? theme.highlight : theme.foreground
                  font.family: theme.fontFamily
                  font.pixelSize: Style.font.body
                  font.bold: tile.selected
                  elide: Text.ElideRight
                }
                Text {
                  visible: root.compact
                  anchors.right: parent.right
                  anchors.rightMargin: Style.spacing.md
                  anchors.verticalCenter: parent.verticalCenter
                  text: tile.best > 0 ? "best " + tile.best : ""
                  color: theme.dim
                  font.family: theme.fontFamily
                  font.pixelSize: Style.font.bodySmall
                }

                MouseArea {
                  anchors.fill: parent
                  hoverEnabled: true
                  cursorShape: Qt.PointingHandCursor
                  // Only a pointer that has really moved takes the selection.
                  // When the arrow keys scroll the list, Qt sends hover
                  // moves to whatever tile slid under a resting pointer;
                  // following those made keyboard and mouse fight.
                  onPositionChanged: function(mouse) {
                    if (!root.pointerMoved(mapToGlobal(mouse.x, mouse.y))) return
                    root.selSection = sectionDelegate.index; root.selIndex = tile.index
                  }
                  onClicked: { root.selSection = sectionDelegate.index; root.selIndex = tile.index; root.confirmSelection() }
                }
              }
            }
          }
        }
      }
    }
  }

  // Detail panel: what the selected game is, and how you're getting on.
  Rectangle {
    id: panel
    visible: root.showPanel
    anchors.right: parent.right
    anchors.top: parent.top
    anchors.bottom: parent.bottom
    width: root.panelWidth
    radius: Style.cornerRadius
    color: theme.withAlpha(theme.foreground, 0.04)
    border.width: 1
    border.color: theme.faint
    clip: true

    readonly property var game: root.selectedGame
    readonly property string gid: game ? game.id : ""
    readonly property int best: root.store && gid ? root.store.bestScore(gid) : 0
    readonly property bool fav: !!root.store && root.store.favourites.indexOf(gid) >= 0
    readonly property bool going: !!root.store && !!root.store.inProgress[gid]
    readonly property string prog: root.store && root.store.progress[gid] ? root.store.progress[gid] : ""
    readonly property var stats: root.store && gid ? root.store.statsOf(gid) : ({ plays: 0, wins: 0, secs: 0, streak: 0, bestStreak: 0 })

    Column {
      anchors.top: parent.top
      anchors.left: parent.left
      anchors.right: parent.right
      anchors.margins: Style.spacing.xl
      spacing: Style.spacing.md

      Engine.GameIcon {
        anchors.horizontalCenter: parent.horizontalCenter
        width: Math.min(parent.width * 0.6, Style.space(120), panel.height * 0.25)
        height: width
        gameId: panel.gid
      }

      Text {
        width: parent.width
        text: panel.game ? panel.game.title : ""
        color: theme.foreground
        font.family: theme.fontFamily
        font.pixelSize: Style.font.heading
        font.bold: true
        wrapMode: Text.Wrap
        horizontalAlignment: Text.AlignHCenter
      }

      Text {
        width: parent.width
        text: panel.game ? panel.game.type.toUpperCase() + (panel.fav ? "  ·  ★ FAVOURITE" : "") : ""
        color: theme.dim
        font.family: theme.fontFamily
        font.pixelSize: Style.font.caption
        font.bold: true
        font.letterSpacing: 1
        horizontalAlignment: Text.AlignHCenter
      }

      Text {
        width: parent.width
        text: panel.game ? Catalog.blurb(panel.gid) : ""
        color: theme.foreground
        font.family: theme.fontFamily
        font.pixelSize: Style.font.body
        wrapMode: Text.Wrap
        horizontalAlignment: Text.AlignHCenter
        lineHeight: 1.15
      }

      Rectangle { width: parent.width; height: 1; color: theme.faint }

      Repeater {
        model: [
          { label: "LENGTH", value: panel.gid ? "about " + Catalog.meta(panel.gid).mins + " min" : "—" },
          { label: "PLAY", value: panel.gid ? Catalog.meta(panel.gid).mode : "—" },
          { label: "BEST", value: panel.best > 0 ? String(panel.best) : "—" },
          { label: "PLAYED", value: panel.stats.plays > 0 ? panel.stats.plays + (panel.stats.plays === 1 ? " round" : " rounds") + (panel.stats.secs >= 60 ? "  ·  " + Math.round(panel.stats.secs / 60) + " min" : "") : "—" },
          { label: "WINS", value: panel.stats.wins > 0 ? panel.stats.wins + " of " + panel.stats.plays + (panel.stats.streak > 1 ? "  ·  streak " + panel.stats.streak : "") : "—" },
          { label: "PROGRESS", value: panel.prog || "—" },
          { label: "NOW", value: panel.gid === root.activeId ? "▶ playing" : panel.going ? "● round in progress" : "—" }
        ]
        delegate: Item {
          required property var modelData
          width: parent.width
          height: valueText.implicitHeight
          Text {
            text: parent.modelData.label
            color: theme.dim
            font.family: theme.fontFamily
            font.pixelSize: Style.font.caption
            font.bold: true
            anchors.verticalCenter: parent.verticalCenter
          }
          Text {
            id: valueText
            anchors.right: parent.right
            text: parent.modelData.value
            color: parent.modelData.value === "—" ? theme.dim : theme.accent
            font.family: theme.fontFamily
            font.pixelSize: Style.font.bodySmall
            font.bold: true
          }
        }
      }
    }

    Text {
      anchors.bottom: parent.bottom
      anchors.bottomMargin: Style.spacing.lg
      anchors.horizontalCenter: parent.horizontalCenter
      text: "enter play  ·  * " + (panel.fav ? "unfavourite" : "favourite")
      color: theme.dim
      font.family: theme.fontFamily
      font.pixelSize: Style.font.caption
    }
  }
}
