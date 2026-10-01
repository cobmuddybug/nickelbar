import QtQuick
import "../engine/Rng.js" as Rng
import Quickshell.Io
import "../engine" as Engine
import "logic/fiveletters.js" as Words

// Five Letters (after Wordle): six tries at a five-letter word. Typing goes
// straight to the board, so the usual single-letter keys (n, p, q, u) only
// work once the word is done. Score is the win streak.
Engine.GameBase {
  id: root
  gameId: "fiveletters"
  title: "FIVE LETTERS"
  helpText: "Guess the word in six tries · type letters · ENTER or SPACE submit · BACKSPACE delete · filled = right letter, right place · outlined with a dot = in the word, wrong place · dim = not in it · once the word is done, N or SPACE for the next one · Words: ENABLE (public domain) and wordfreq data (CC BY-SA 4.0), see THIRD_PARTY.md"
  mouseHelp: "Click the on-screen keys; the board itself submits on click, right-click deletes a letter"

  property var state: null
  property var answers: []
  property var valid: ({})
  property var pendingSave: null
  property bool hasPendingSave: false

  score: state ? state.streak : 0
  progress: state && state.streak ? "streak " + state.streak : ""
  overTitle: !state ? "" : state.won ? "GOT IT IN " + state.guesses.length : "IT WAS " + state.answer.toUpperCase()
  status: !answers.length ? "LOADING WORDS…"
    : !state ? ""
    : paused ? "PAUSED"
    : over ? (state.won ? "STREAK " + state.streak : "STREAK OVER") + "  ·  SPACE for the next word"
    : (state.note ? state.note.toUpperCase() + "  ·  " : "") + "GUESS " + (state.guesses.length + 1) + "/" + Words.ROWS
      + "  ·  STREAK " + state.streak

  onStateChanged: over = !!state && Words.done(state)

  FileView {
    path: String(Qt.resolvedUrl("data/words.json")).replace(/^file:\/\//, "")
    printErrors: true
    onLoaded: {
      var data = null
      try { data = JSON.parse(text()) } catch (e) { data = null }
      if (!data) return
      var v = {}
      for (var i = 0; i < data.guesses.length; ++i) v[data.guesses[i]] = true
      for (var j = 0; j < data.answers.length; ++j) v[data.answers[j]] = true
      root.valid = v
      root.answers = data.answers
      if (root.hasPendingSave) { root.hasPendingSave = false; root.loadState(root.pendingSave); root.pendingSave = null }
      else if (!root.state) root.newGame()
    }
  }

  function newGame() {
    if (!answers.length) return
    var prev = state
    var word = answers[Math.floor(Rng.random() * answers.length)]
    if (prev && word === prev.answer) word = answers[(answers.indexOf(word) + 1) % answers.length]
    state = Words.makeState(word, prev ? prev.streak : 0, prev ? prev.stats : null)
    paused = false
  }

  function moveCursor(dx, dy) {}

  function activate() {
    if (!state) return
    if (over) { newGame(); return }
    state = Words.submit(state, valid)
  }

  function handleKey(key, text) {
    if (!state || over) return false
    if (key === Qt.Key_Backspace || key === Qt.Key_Delete) { state = Words.backspace(state); return true }
    if (key === Qt.Key_Return || key === Qt.Key_Enter) { state = Words.submit(state, valid); return true }
    var t = text ? text.toLowerCase() : ""
    if (/^[a-z]$/.test(t)) { state = Words.type(state, t); return true }
    return false
  }

  function saveState() {
    if (!answers.length) return pendingSave
    if (!state) return null
    // A finished word saves only the streak and stats; reopening deals a new one.
    if (over) return { answer: "", streak: state.streak, stats: state.stats }
    return Words.serialize(state)
  }

  function loadState(saved) {
    if (!answers.length) { pendingSave = saved; hasPendingSave = true; return }
    var restored = Words.deserialize(saved)
    if (restored && !Words.done(restored)) { state = restored; paused = false; return }
    state = saved ? Words.makeState("", saved.streak || 0, saved.stats || null) : null
    newGame()
  }

  // Mouse (engine/Pointer.qml): click the on-screen keys; the board itself
  // submits on click, right-click deletes a letter.
  function pointer(kind, x, y, b) {
    if (!state || over || kind !== "press") return
    if (b === Qt.RightButton) { state = Words.backspace(state); return }
    var k = board.keyAt(x, y)
    if (k) state = Words.type(state, k)
    else state = Words.submit(state, valid)
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.fill: parent

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onOverChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    readonly property var rowsOfKeys: ["qwertyuiop", "asdfghjkl", "zxcvbnm"]

    // The on-screen key under (x, y), laid out exactly as onPaint draws them.
    function keyAt(x, y) {
      var kbH = height * 0.28, gap = Math.max(3, Math.min(width, height) * 0.012), kGap = Math.max(2, gap * 0.7)
      var kw = Math.min((width - kGap * 9) / 10, kbH / 3 * 1.1), kh = Math.min(kbH / 3 - kGap, kw * 1.25)
      var ky0 = height - (kh * 3 + kGap * 2)
      for (var row = 0; row < 3; ++row) {
        var keys = rowsOfKeys[row], kx0 = (width - (keys.length * kw + (keys.length - 1) * kGap)) / 2, ky = ky0 + row * (kh + kGap)
        if (y < ky || y > ky + kh) continue
        for (var k = 0; k < keys.length; ++k) {
          var kx = kx0 + k * (kw + kGap)
          if (x >= kx && x <= kx + kw) return keys[k]
        }
      }
      return ""
    }

    // One square: mark -1 = still typing / empty, 0 absent, 1 elsewhere, 2 exact.
    function tile(ctx, x, y, sz, ch, m, current) {
      var r = Math.max(2, sz * 0.08)
      ctx.beginPath()
      ctx.moveTo(x + r, y); ctx.arcTo(x + sz, y, x + sz, y + sz, r); ctx.arcTo(x + sz, y + sz, x, y + sz, r)
      ctx.arcTo(x, y + sz, x, y, r); ctx.arcTo(x, y, x + sz, y, r); ctx.closePath()
      var fg = theme.foreground
      if (m === 2) { ctx.fillStyle = theme.accent; ctx.fill(); fg = theme.background }
      else if (m === 1) {
        ctx.fillStyle = theme.withAlpha(theme.tone(3), 0.28); ctx.fill()
        ctx.strokeStyle = theme.tone(3); ctx.lineWidth = 2; ctx.stroke()
      } else if (m === 0) { ctx.fillStyle = theme.withAlpha(theme.foreground, 0.1); ctx.fill(); fg = theme.dim }
      else {
        ctx.strokeStyle = ch ? theme.dim : (current ? theme.withAlpha(theme.foreground, 0.28) : theme.faint)
        ctx.lineWidth = ch ? 2 : 1.5
        ctx.stroke()
      }
      if (ch) {
        ctx.fillStyle = fg
        ctx.fillText(ch.toUpperCase(), x + sz / 2, y + sz / 2 + 1)
      }
      if (m === 1) {
        ctx.fillStyle = theme.tone(3)
        ctx.beginPath(); ctx.arc(x + sz / 2, y + sz * 0.86, Math.max(1.5, sz * 0.04), 0, Math.PI * 2); ctx.fill()
      }
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state

      // Board takes the top ~68%, keyboard the rest.
      var kbH = height * 0.28
      var gap = Math.max(3, Math.min(width, height) * 0.012)
      var sz = Math.floor(Math.min((width - gap * 4) / Words.LEN, (height - kbH - gap * 7) / Words.ROWS))
      var gx = (width - (sz * Words.LEN + gap * (Words.LEN - 1))) / 2, gy = 0
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.font = "bold " + Math.floor(sz * 0.52) + "px " + theme.fontFamily
      for (var r = 0; r < Words.ROWS; ++r) {
        var g = s.guesses[r]
        var word = g ? g.word : (r === s.guesses.length ? s.typing : "")
        for (var c = 0; c < Words.LEN; ++c)
          tile(ctx, gx + c * (sz + gap), gy + r * (sz + gap), sz, word[c] || "", g ? g.marks[c] : -1,
               r === s.guesses.length && !Words.done(s))
      }

      // On-screen keyboard shows what's known about each letter.
      var marks = Words.letterMarks(s)
      var kGap = Math.max(2, gap * 0.7)
      var kw = Math.min((width - kGap * 9) / 10, kbH / 3 * 1.1)
      var kh = Math.min(kbH / 3 - kGap, kw * 1.25)
      var ky0 = height - (kh * 3 + kGap * 2)
      ctx.font = "bold " + Math.floor(Math.min(kw, kh) * 0.45) + "px " + theme.fontFamily
      for (var row = 0; row < 3; ++row) {
        var keys = rowsOfKeys[row]
        var kx0 = (width - (keys.length * kw + (keys.length - 1) * kGap)) / 2
        for (var k = 0; k < keys.length; ++k) {
          var ch = keys[k], m = marks[ch] === undefined ? -1 : marks[ch]
          var x = kx0 + k * (kw + kGap), y = ky0 + row * (kh + kGap)
          ctx.fillStyle = m === 2 ? theme.accent : m === 1 ? theme.withAlpha(theme.tone(3), 0.45)
            : m === 0 ? theme.withAlpha(theme.foreground, 0.03) : theme.withAlpha(theme.foreground, 0.1)
          ctx.fillRect(x, y, kw, kh)
          ctx.fillStyle = m === 2 ? theme.background : m === 0 ? theme.faint : theme.foreground
          ctx.fillText(ch.toUpperCase(), x + kw / 2, y + kh / 2 + 1)
        }
      }

      if (root.paused) {
        ctx.fillStyle = theme.background
        ctx.globalAlpha = 0.85
        ctx.fillRect(0, 0, width, height)
        ctx.globalAlpha = 1.0
      }
    }
  }
}
