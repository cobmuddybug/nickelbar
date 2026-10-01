import QtQuick

// Base every game in games/ extends. Owns the tick timer, pause state, and
// the status/help text the overlay's chrome reads — games override
// newGame()/moveCursor()/activate() (and optionally undo()/saveState()/
// loadState()/handleKey()) the same way qs.Ui's Panel is overridden by
// first-party panels: redeclare the function in the derived type.
Item {
  id: root

  property string gameId: ""
  property string title: ""
  property string helpText: ""
  // What the mouse does, for the ? screen (games with a pointer() hook).
  property string mouseHelp: ""
  property int score: 0
  property int best: 0
  property bool paused: false
  property bool over: false
  property string status: ""
  // Headline for the overlay's round-over card ("SOLVED", "YOU WIN"...);
  // empty means the generic "GAME OVER".
  property string overTitle: ""

  // Set by the overlay once you've pressed something in this round, so the
  // picker's "Continue" row only lists games you actually got into.
  property bool started: false
  // Optional difficulty levels, e.g. ["Easy", "Normal", "Hard"]. The overlay saves the
  // choice per game, sets `difficulty` (an index) before newGame(), and restarts the
  // round when the player changes it from the help screen (ctrl+d cycles).
  property var difficulties: []
  property int defaultDifficulty: 1
  property int difficulty: -1       // -1 until the overlay sets it

  // A game that can seat a second person at the same keyboard sets hasTwoPlayer; `players`
  // (1 or 2; -1 until the overlay sets it) says which, and the game reacts in onPlayersChanged.
  // The overlay saves the choice per game and restarts the round when it changes (ctrl+2).
  property bool hasTwoPlayer: false
  property int players: -1

  // Optional one-line progress for the picker ("12 solved", "level 8/60").
  property string progress: ""
  // The engine/Pointer.qml over this game's board, if it has one (it
  // registers itself); lets the dev harness click in scripts.
  property Item pointerArea: null

  // Endless games (no fail state) never flip `over`, so the overlay banks
  // their score whenever it persists them instead of only on game over.
  property bool endless: false

  // Games that want a heartbeat set tickInterval and ticking; games driven
  // entirely by input (puzzles, cards, board games) just leave ticking false.
  property int tickInterval: 250
  property bool ticking: false

  // Held-direction state for real-time games. The overlay sets these on
  // key press/release (ignoring autorepeat), so a paddle can glide for as
  // long as a key is down instead of stuttering at the keyboard's repeat
  // rate. A game opts in with `continuousMove: true`; the overlay then
  // stops forwarding autorepeated moveCursor() calls to it.
  property bool continuousMove: false
  property int heldDx: 0
  property int heldDy: 0
  // Same idea for SPACE/ENTER: true while held (activate() still fires once
  // on the initial press).
  property bool heldAction: false

  // True for a game that makes all its own sounds: the overlay then skips its
  // generic move / select / score sounds for it.
  property bool ownSounds: false

  signal tick()
  // A named sound for the overlay to play (see engine/Sfx.qml), for games
  // with sounds of their own: "note0".."note7", "buzz", and the platformer set (jump, coin, stomp, bump, power, die, flag).
  signal sound(string name)

  Timer {
    interval: Math.max(16, root.tickInterval)
    running: root.ticking && !root.paused && !root.over
    repeat: true
    onTriggered: root.tick()
  }

  // Sound events from game logic: a state carries `ev` (names) and `evSeq` (bumped
  // whenever `ev` is new). Call playEvents(state) when the state changes; each
  // batch plays once however many times the state is copied.
  property int lastEvSeq: 0
  function playEvents(s) {
    if (!s || !s.ev || s.evSeq === undefined || s.evSeq === root.lastEvSeq) return
    root.lastEvSeq = s.evSeq
    for (var i = 0; i < s.ev.length; ++i) root.sound(s.ev[i])
  }

  // Undo history for turn-based games whose states are replaced, never edited
  // in place: call pushUndo(state) just before an action replaces the state,
  // and popUndo() from undo(). newGame() and loadState() call clearUndo().
  property var undoStack: []
  function pushUndo(s) {
    var a = root.undoStack.slice(-199)
    a.push(s)
    root.undoStack = a
  }
  function popUndo() {
    if (!root.undoStack.length) return null
    var a = root.undoStack.slice()
    var s = a.pop()
    root.undoStack = a
    return s
  }
  function clearUndo() { root.undoStack = [] }

  function togglePause() {
    if (!root.over) root.paused = !root.paused
  }

  // Overridden by the concrete game.
  function newGame() {}
  function moveCursor(dx, dy) {}
  function activate() {}

  // Optional overrides. Overlay.qml checks `typeof fn === "function"`
  // before calling any of these, so a game that has no use for one (undo
  // in Snake, say) simply doesn't declare it.
  // function undo() {}
  // function saveState() { return null }
  // function loadState(state) {}
  //
  // function pointer(kind, x, y, button) {}   (mouse; see Pointer.qml)
  //
  // handleKey(key, text) sees every key before the shared keymap does
  // (except Esc, Tab and ?). Return true to consume it — Sudoku takes the
  // digit keys this way, Minesweeper takes F for flag.
  // function handleKey(key, text) { return false }
}
