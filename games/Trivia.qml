import QtQuick
import Quickshell.Io
import "../engine" as Engine
import "logic/trivia.js" as Trivia

// Multiple-choice trivia from OpenTriviaQA (see logic/trivia.js and
// dev/tools/trivia.py). Pick a topic, answer until three strikes; score is
// the number right. Only the chosen topic's file is parsed (Mixed loads
// them all), and each topic deals from its own shuffled deck so questions
// don't come round again until the topic is used up.
Engine.GameBase {
  id: root
  gameId: "trivia"
  title: "TRIVIA"
  helpText: "Pick a topic, then answer until " + Trivia.STRIKES + " strikes · ARROWS move · SPACE choose · 1-4 or A-D answer directly · SPACE next question · T change topic · N new run (topic list) · Questions: OpenTriviaQA (CC BY-SA 4.0), see THIRD_PARTY.md"
  mouseHelp: "Click a topic to start; click an answer to pick it, then click again for the next question"

  property var topics: []          // [{ id, title, count }], Mixed first
  property var allIds: []          // every data file, hidden ones included
  property var cache: ({})         // id -> parsed rows; plain JS, never bound to
  property var pool: []
  property var poolFrom: []
  property string poolTopic: ""
  property string wantedTopic: ""
  property var queue: []
  property string loadingId: ""
  property var perm: []
  property string permKey: ""

  property var state: null
  property var decks: ({})         // topic -> { seed, pos }
  property var topicBest: ({})     // topic -> most right in one run
  property var pendingSave: null
  property bool hasPendingSave: false

  readonly property var topic: state ? topicById(state.topic) : null

  score: state ? state.right : 0
  overTitle: Trivia.STRIKES + " STRIKES  ·  " + (state ? state.right : 0) + " RIGHT"
  status: !topics.length ? "LOADING…"
    : !state ? ""
    : paused ? "PAUSED"
    : over ? (topic ? topic.title.toUpperCase() : "") + "  ·  T for topics"
    : state.phase === "topics" ? "PICK A TOPIC"
    : !state.q ? "LOADING " + (topic ? topic.title.toUpperCase() : "") + "…"
    : (topic ? topic.title.toUpperCase() : "") + "  ·  Q" + state.asked
      + (state.phase === "reveal" && !Trivia.wasRight(state) ? "  ·  SPACE for the next one"
        : state.streak > 1 ? "  ·  STREAK " + state.streak : "")

  onStateChanged: over = Trivia.isOver(state)

  function dataPath(name) {
    return String(Qt.resolvedUrl("data/trivia/" + name)).replace(/^file:\/\//, "")
  }

  function topicById(id) {
    for (var i = 0; i < topics.length; ++i) if (topics[i].id === id) return topics[i]
    return null
  }

  function topicIndex(id) {
    for (var i = 0; i < topics.length; ++i) if (topics[i].id === id) return i
    return 0
  }

  FileView {
    id: indexFile
    path: root.dataPath("index.json")
    printErrors: true
    onLoaded: {
      var idx = null
      try { idx = JSON.parse(text()) } catch (e) { idx = null }
      if (!idx || !idx.topics) return
      var list = [{ id: "mixed", title: "Mixed", count: idx.total }], ids = []
      for (var i = 0; i < idx.topics.length; ++i) {
        ids.push(idx.topics[i].id)
        if (!idx.topics[i].hidden) list.push(idx.topics[i])
      }
      root.allIds = ids
      root.topics = list
      if (root.hasPendingSave) { root.hasPendingSave = false; root.loadState(root.pendingSave); root.pendingSave = null }
      else if (!root.state) root.newGame()
    }
  }

  FileView {
    id: topicFile
    path: root.loadingId ? root.dataPath(root.loadingId + ".json") : ""
    printErrors: true
    onLoaded: {
      if (!root.loadingId) return
      var rows = []
      try { rows = JSON.parse(text()) } catch (e) { rows = [] }
      root.cache[root.loadingId] = rows
      // Changing `path` from inside onLoaded drops the next load, so step
      // to the next file once this handler has returned.
      Qt.callLater(root.loadNext)
    }
  }

  // Makes `pool` the questions for `id`, loading whatever isn't cached yet,
  // then deals if the current run is waiting on a question.
  function ensurePool(id) {
    wantedTopic = id
    if (poolTopic === id) { if (state && state.phase === "question" && !state.q) nextQuestion(); return }
    var ids = id === "mixed" ? allIds : [id]
    var missing = ids.filter(function(x) { return !cache[x] })
    if (missing.length) {
      queue = missing
      if (!loadingId) loadNext()
      return
    }
    var rows = [], from = []
    for (var i = 0; i < ids.length; ++i) {
      var t = topicById(ids[i]), part = cache[ids[i]]
      rows = rows.concat(part)
      if (id === "mixed") for (var j = 0; j < part.length; ++j) from.push(t ? t.title : "")
    }
    pool = rows
    poolFrom = from
    poolTopic = id
    if (state && state.phase === "question" && !state.q && state.topic === id) nextQuestion()
  }

  function loadNext() {
    if (queue.length) {
      var id = queue[0]
      queue = queue.slice(1)
      loadingId = id
    } else {
      loadingId = ""
      if (wantedTopic) ensurePool(wantedTopic)
    }
  }

  function nextQuestion() {
    if (!state || poolTopic !== state.topic || !pool.length) { if (state) ensurePool(state.topic); return }
    var id = state.topic
    var d = decks[id] || { seed: Trivia.newSeed(), pos: 0 }
    if (d.pos >= pool.length) d = { seed: Trivia.newSeed(), pos: 0 }
    var key = id + ":" + d.seed + ":" + pool.length
    if (permKey !== key) { perm = Trivia.shuffled(pool.length, d.seed); permKey = key }
    var n = perm[d.pos]
    var nextDecks = {}
    for (var k in decks) nextDecks[k] = decks[k]
    nextDecks[id] = { seed: d.seed, pos: d.pos + 1 }
    decks = nextDecks
    state = Trivia.ask(state, Trivia.question(pool[n], id === "mixed" ? poolFrom[n] : ""))
  }

  function begin(id) {
    state = Trivia.start(id)
    paused = false
    ensurePool(id)
  }

  function showTopics() {
    state = Trivia.menu(topicIndex(state ? state.topic : ""))
    paused = false
  }

  // N: back to the topic list (SPACE on the round-over card replays the
  // same topic instead).
  function newGame() {
    if (!topics.length) return
    showTopics()
  }

  function moveCursor(dx, dy) {
    if (!state || over) return
    state = Trivia.moveCursor(state, dx, dy, topics.length)
  }

  function answer(i) {
    state = Trivia.pick(state, i)
    if (Trivia.wasRight(state) && state.right > (topicBest[state.topic] || 0)) {
      var next = {}
      for (var k in topicBest) next[k] = topicBest[k]
      next[state.topic] = state.right
      topicBest = next
    }
  }

  function activate() {
    if (!state) return
    if (state.phase === "topics") { if (topics.length) begin(topics[state.cursor].id); return }
    if (over) { begin(state.topic); return }
    if (state.phase === "question") { if (state.q) answer(state.cursor); return }
    nextQuestion()
  }

  // Mouse: the topic tiles and answer rows have their own MouseAreas;
  // hovering one moves the cursor there.
  function pointTo(i) {
    if (!state || over || paused || state.cursor === i) return
    var d = i - state.cursor
    state = state.phase === "topics" ? Trivia.moveCursor(state, d, 0, topics.length) : Trivia.moveCursor(state, 0, d, topics.length)
  }

  function handleKey(key, text) {
    if (!state) return false
    var t = text ? text.toLowerCase() : ""
    if (t === "t") { showTopics(); return true }
    if (state.phase !== "question" || !state.q || t.length !== 1) return false
    var i = t >= "1" && t <= "9" ? t.charCodeAt(0) - 49 : (t >= "a" && t <= "f" ? t.charCodeAt(0) - 97 : -1)
    if (i < 0 || i >= state.q.choices.length) return false
    answer(i)
    return true
  }

  // A right answer moves on by itself; a wrong one waits for SPACE so
  // there's time to read the correct answer.
  Timer {
    interval: 1100
    running: !!root.state && Trivia.wasRight(root.state) && !root.over && !root.paused
    onTriggered: root.nextQuestion()
  }

  function saveState() {
    if (!topics.length) return pendingSave
    return { run: over ? null : state, decks: decks, best: topicBest }
  }

  function loadState(saved) {
    if (!topics.length) { pendingSave = saved; hasPendingSave = true; return }
    decks = saved && saved.decks ? saved.decks : {}
    topicBest = saved && saved.best ? saved.best : {}
    var run = saved && saved.run
    if (run && run.phase && (run.phase === "topics" || topicById(run.topic))) {
      state = run
      paused = false
      if (run.phase !== "topics") ensurePool(run.topic)
    } else newGame()
  }

  // ---- drawing ---------------------------------------------------------------

  Engine.Theme { id: theme }

  readonly property real unit: Math.max(9, Math.min(width / 34, height / 30))

  Item {
    id: content
    anchors.fill: parent
    opacity: root.paused ? 0.15 : 1

    // Topic grid.
    Item {
      anchors.fill: parent
      visible: !!root.state && root.state.phase === "topics"

      Text {
        id: menuHead
        anchors.horizontalCenter: parent.horizontalCenter
        text: "CHOOSE A TOPIC"
        color: theme.dim
        font.family: theme.fontFamily
        font.pixelSize: root.unit * 0.8
        font.bold: true
        font.letterSpacing: 2
      }

      Grid {
        id: grid
        anchors.top: menuHead.bottom
        anchors.topMargin: root.unit * 0.6
        anchors.horizontalCenter: parent.horizontalCenter
        columns: Trivia.MENU_COLS
        spacing: root.unit * 0.4
        readonly property int rows: Math.ceil(root.topics.length / columns)
        readonly property real tileW: (root.width - spacing * (columns - 1)) / columns
        readonly property real tileH: Math.min(root.unit * 3.2, (root.height - menuHead.height - root.unit * 0.6 - spacing * (rows - 1)) / Math.max(1, rows))

        Repeater {
          model: root.topics
          delegate: Rectangle {
            required property var modelData
            required property int index
            readonly property bool sel: !!root.state && root.state.cursor === index
            readonly property int best: root.topicBest[modelData.id] || 0
            width: grid.tileW
            height: grid.tileH
            radius: 4
            color: sel ? theme.selectedBackground : theme.withAlpha(theme.foreground, 0.04)
            border.width: sel ? 2 : 1
            border.color: sel ? theme.accent : theme.faint

            MouseArea {
              anchors.fill: parent
              hoverEnabled: true
              cursorShape: Qt.PointingHandCursor
              onPositionChanged: root.pointTo(index)
              onClicked: { root.pointTo(index); root.started = true; root.activate() }
            }

            Column {
              anchors.verticalCenter: parent.verticalCenter
              anchors.left: parent.left
              anchors.right: parent.right
              anchors.margins: root.unit * 0.6
              spacing: root.unit * 0.1
              Text {
                width: parent.width
                text: modelData.title
                elide: Text.ElideRight
                color: sel ? theme.highlight : theme.foreground
                font.family: theme.fontFamily
                font.pixelSize: Math.min(root.unit * 0.9, grid.tileH * 0.36)
                font.bold: true
              }
              Text {
                width: parent.width
                text: modelData.count.toLocaleString(Qt.locale("en_US"), "f", 0) + (best ? "  ·  best " + best : "")
                elide: Text.ElideRight
                color: theme.dim
                font.family: theme.fontFamily
                font.pixelSize: Math.min(root.unit * 0.65, grid.tileH * 0.26)
              }
            }
          }
        }
      }
    }

    // Question and answers.
    Item {
      anchors.fill: parent
      visible: !!root.state && root.state.phase !== "topics" && !!root.state.q

      Item {
        id: topLine
        width: parent.width
        height: root.unit * 1.2

        Text {
          anchors.left: parent.left
          anchors.verticalCenter: parent.verticalCenter
          text: root.state && root.state.q
            ? "QUESTION " + root.state.asked + (root.state.q.from ? "  ·  " + root.state.q.from.toUpperCase() : "")
            : ""
          color: theme.dim
          font.family: theme.fontFamily
          font.pixelSize: root.unit * 0.7
          font.bold: true
          font.letterSpacing: 1
        }

        // Strikes left, as pips: filled = still in hand.
        Row {
          anchors.right: parent.right
          anchors.verticalCenter: parent.verticalCenter
          spacing: root.unit * 0.3
          Text {
            anchors.verticalCenter: parent.verticalCenter
            text: (root.state ? root.state.right : 0) + " right"
            color: theme.dim
            font.family: theme.fontFamily
            font.pixelSize: root.unit * 0.7
            rightPadding: root.unit * 0.3
          }
          Repeater {
            model: Trivia.STRIKES
            delegate: Rectangle {
              required property int index
              readonly property bool used: !!root.state && index >= Trivia.STRIKES - root.state.strikes
              anchors.verticalCenter: parent.verticalCenter
              width: root.unit * 0.6; height: width; radius: width / 2
              color: used ? "transparent" : theme.accent
              border.width: 1.5
              border.color: used ? theme.danger : theme.accent
            }
          }
        }
      }

      Text {
        id: questionText
        anchors.top: topLine.bottom
        anchors.topMargin: root.unit * 0.5
        width: parent.width
        height: parent.height * 0.36
        text: root.state && root.state.q ? root.state.q.text : ""
        textFormat: Text.PlainText
        wrapMode: Text.Wrap
        fontSizeMode: Text.Fit
        minimumPixelSize: 9
        font.pixelSize: root.unit * 1.25
        font.family: theme.fontFamily
        font.bold: true
        color: theme.foreground
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
        lineHeight: 1.15
      }

      Column {
        id: choices
        anchors.top: questionText.bottom
        anchors.topMargin: root.unit * 0.6
        anchors.bottom: parent.bottom
        width: parent.width
        spacing: root.unit * 0.4
        readonly property int n: root.state && root.state.q ? root.state.q.choices.length : 0
        readonly property real rowH: Math.min(root.unit * 3.2, (height - spacing * (n - 1)) / Math.max(1, n))

        Repeater {
          model: root.state && root.state.q ? root.state.q.choices : []
          delegate: Rectangle {
            required property var modelData
            required property int index
            readonly property bool reveal: root.state.phase === "reveal"
            readonly property bool isAnswer: index === root.state.q.answer
            readonly property bool isPicked: index === root.state.picked
            readonly property bool sel: !reveal && root.state.cursor === index
            readonly property color tint: reveal && isAnswer ? theme.accent : (reveal && isPicked ? theme.danger : theme.accent)
            width: choices.width
            height: choices.rowH
            radius: 4
            color: reveal && (isAnswer || isPicked) ? theme.withAlpha(tint, 0.22)
              : sel ? theme.selectedBackground : theme.withAlpha(theme.foreground, 0.04)
            border.width: sel || (reveal && (isAnswer || isPicked)) ? 2 : 1
            border.color: reveal && (isAnswer || isPicked) ? tint : (sel ? theme.accent : theme.faint)
            opacity: reveal && !isAnswer && !isPicked ? 0.45 : 1

            MouseArea {
              anchors.fill: parent
              hoverEnabled: true
              cursorShape: Qt.PointingHandCursor
              onPositionChanged: if (!parent.reveal) root.pointTo(index)
              onClicked: {
                root.started = true
                if (parent.reveal) { if (root.over) root.activate(); else root.nextQuestion() }
                else root.answer(index)
              }
            }

            Rectangle {
              id: badge
              anchors.left: parent.left
              anchors.leftMargin: root.unit * 0.5
              anchors.verticalCenter: parent.verticalCenter
              width: Math.min(root.unit * 1.6, parent.height - root.unit * 0.5); height: width
              radius: 3
              color: "transparent"
              border.width: 1
              border.color: parent.border.color
              Text {
                anchors.centerIn: parent
                text: parent.parent.reveal && parent.parent.isAnswer ? "✓"
                  : parent.parent.reveal && parent.parent.isPicked ? "✗"
                  : String.fromCharCode(65 + parent.parent.index)
                color: parent.parent.sel ? theme.highlight : theme.foreground
                font.family: theme.fontFamily
                font.pixelSize: parent.height * 0.6
                font.bold: true
              }
            }

            Text {
              anchors.left: badge.right
              anchors.leftMargin: root.unit * 0.6
              anchors.right: parent.right
              anchors.rightMargin: root.unit * 0.6
              anchors.verticalCenter: parent.verticalCenter
              height: parent.height - root.unit * 0.3
              text: modelData
              textFormat: Text.PlainText
              wrapMode: Text.Wrap
              fontSizeMode: Text.Fit
              minimumPixelSize: 8
              font.pixelSize: root.unit * 0.95
              font.family: theme.fontFamily
              color: parent.sel ? theme.highlight : theme.foreground
              verticalAlignment: Text.AlignVCenter
            }
          }
        }
      }
    }

    Text {
      anchors.centerIn: parent
      visible: !root.topics.length || (!!root.state && root.state.phase !== "topics" && !root.state.q)
      text: "loading questions…"
      color: theme.dim
      font.family: theme.fontFamily
      font.pixelSize: root.unit * 0.9
    }
  }
}
