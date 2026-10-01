import QtQuick
import Quickshell
import Quickshell.Io

// Scores and per-game save state under $XDG_DATA_HOME/nickelbar/. Both the
// bar widget's picker and the overlay instantiate their own Store; scores
// and lastPlayed use `watchChanges: true` so a write from one side shows up
// on the other without either needing to know the other exists.
Item {
  id: root

  readonly property string dataDir: (Quickshell.env("XDG_DATA_HOME") && Quickshell.env("XDG_DATA_HOME").length > 0
    ? Quickshell.env("XDG_DATA_HOME") : (Quickshell.env("HOME") + "/.local/share")) + "/nickelbar"

  property var scores: ({})
  property string lastPlayed: ""
  // Most-recent-first ids, a few long; the picker's "Recent" row.
  property var recent: []
  // Picker extras, kept in state.json too: pinned games, games with a
  // round in progress (id -> true), and a short progress line per game
  // ("12 solved") for the detail panel.
  property var favourites: []
  property var inProgress: ({})
  property var progress: ({})
  property bool muted: false
  // Per-game difficulty choice (id -> index) and the games whose first-run hint has shown.
  property var difficulty: ({})
  property var seenHelp: []
  property var playersOf: ({})      // game id -> 1 or 2
  // Per-game history: { plays, wins, secs, streak, bestStreak }.
  property var stats: ({})
  // Daily challenge log: "YYYY-MM-DD" -> { id, score }, completed days only.
  property var dailyLog: ({})
  // Tickets: balance, earned in all, prizes bought, and the equipped card back (0 = standard).
  property int tickets: 0
  property int ticketsEarned: 0
  property var prizes: []
  property int cardBack: 0
  property var pendingSecs: ({})
  property bool ready: false

  // `scores` reassignment already emits the auto property-change signal —
  // no need to declare one, and doing so collides with it.

  function bestScore(gameId) {
    var v = scores[gameId]
    return (typeof v === "number" && v > 0) ? v : 0
  }

  // Returns true when this is a new best, so the caller can flash "NEW BEST".
  function reportScore(gameId, value) {
    var current = bestScore(gameId)
    if (!(value > current)) return false
    var next = {}
    for (var k in scores) next[k] = scores[k]
    next[gameId] = value
    scores = next
    scoresFile.setText(JSON.stringify(scores, null, 2) + "\n")
    return true
  }

  function setLastPlayed(gameId) {
    if (root.lastPlayed === gameId && root.recent.length && root.recent[0] === gameId) return
    var next = [gameId]
    for (var i = 0; i < root.recent.length && next.length < 8; ++i)
      if (root.recent[i] !== gameId) next.push(root.recent[i])
    root.lastPlayed = gameId
    root.recent = next
    writeState()
  }

  function isFavourite(gameId) { return root.favourites.indexOf(gameId) >= 0 }

  function toggleFavourite(gameId) {
    root.favourites = isFavourite(gameId)
      ? root.favourites.filter(function(v) { return v !== gameId })
      : root.favourites.concat([gameId])
    writeState()
  }

  // Called whenever the overlay persists a game.
  function noteProgress(gameId, going, text) {
    var was = !!root.inProgress[gameId], txt = root.progress[gameId] || ""
    if (was === !!going && txt === (text || "")) return
    var ip = {}, pr = {}
    for (var k in root.inProgress) if (k !== gameId) ip[k] = true
    for (var q in root.progress) if (q !== gameId) pr[q] = root.progress[q]
    if (going) ip[gameId] = true
    if (text) pr[gameId] = text
    root.inProgress = ip
    root.progress = pr
    writeState()
  }

  function difficultyOf(gameId, fallback) {
    var v = root.difficulty[gameId]
    return typeof v === "number" ? v : fallback
  }

  function setDifficulty(gameId, index) {
    var next = {}
    for (var k in root.difficulty) next[k] = root.difficulty[k]
    next[gameId] = index
    root.difficulty = next
    writeState()
  }

  function statsOf(gameId) {
    var s = root.stats[gameId] || {}
    return { plays: s.plays || 0, wins: s.wins || 0, secs: s.secs || 0, streak: s.streak || 0, bestStreak: s.bestStreak || 0 }
  }

  // A finished round: counts a play, and a win extends the streak (a loss ends it).
  function noteRound(gameId, won) {
    var cur = statsOf(gameId), next = {}
    for (var k in root.stats) next[k] = root.stats[k]
    var streak = won ? cur.streak + 1 : 0
    next[gameId] = { plays: cur.plays + 1, wins: cur.wins + (won ? 1 : 0), secs: cur.secs, streak: streak, bestStreak: Math.max(cur.bestStreak, streak) }
    root.stats = next
    writeState()
  }

  // Seconds played accumulate in memory (a write a second would be silly); commitTime() saves them.
  function addTime(gameId, secs) {
    var p = {}
    for (var k in root.pendingSecs) p[k] = root.pendingSecs[k]
    p[gameId] = (p[gameId] || 0) + secs
    root.pendingSecs = p
  }

  function commitTime() {
    var any = false, next = {}
    for (var k in root.stats) next[k] = root.stats[k]
    for (var id in root.pendingSecs) {
      var cur = statsOf(id)
      next[id] = { plays: cur.plays, wins: cur.wins, secs: cur.secs + root.pendingSecs[id], streak: cur.streak, bestStreak: cur.bestStreak }
      any = true
    }
    if (!any) return
    root.pendingSecs = ({})
    root.stats = next
    writeState()
  }

  function dailyDone(date) { return !!root.dailyLog[date] }

  // Consecutive completed days ending today (or yesterday, if today is still open).
  function dailyStreak(todayStr) {
    var d = Date.parse(todayStr + "T00:00:00Z") / 86400000, n = 0
    function key(day) { return new Date(day * 86400000).toISOString().slice(0, 10) }
    if (!root.dailyLog[key(d)]) d -= 1
    while (root.dailyLog[key(d)]) { n++; d -= 1 }
    return n
  }

  function noteDaily(date, gameId, score) {
    if (root.dailyLog[date]) return false
    var next = {}
    for (var k in root.dailyLog) next[k] = root.dailyLog[k]
    next[date] = { id: gameId, score: score }
    root.dailyLog = next
    writeState()
    return true
  }

  function earnTickets(n) {
    if (n <= 0) return
    root.tickets += n
    root.ticketsEarned += n
    writeState()
  }

  function buyPrize(prizeId, cost, back) {
    if (root.prizes.indexOf(prizeId) >= 0 || root.tickets < cost) return false
    root.tickets -= cost
    root.prizes = root.prizes.concat([prizeId])
    if (back) root.cardBack = back
    writeState()
    return true
  }

  function equipBack(back) { root.cardBack = back; writeState() }

  function playerCount(gameId) { return root.playersOf[gameId] === 2 ? 2 : 1 }

  function setPlayerCount(gameId, n) {
    var next = {}
    for (var k in root.playersOf) next[k] = root.playersOf[k]
    next[gameId] = n
    root.playersOf = next
    writeState()
  }

  function isSeen(gameId) { return root.seenHelp.indexOf(gameId) >= 0 }

  function markSeen(gameId) {
    if (isSeen(gameId)) return
    root.seenHelp = root.seenHelp.concat([gameId])
    writeState()
  }

  function setMuted(value) {
    root.muted = !!value
    writeState()
  }

  function writeState() {
    stateFile.setText(JSON.stringify({ muted: root.muted, difficulty: root.difficulty, seenHelp: root.seenHelp, players: root.playersOf, stats: root.stats, dailyLog: root.dailyLog, tickets: root.tickets, ticketsEarned: root.ticketsEarned, prizes: root.prizes, cardBack: root.cardBack, lastPlayed: root.lastPlayed, recent: root.recent, favourites: root.favourites,
      inProgress: Object.keys(root.inProgress), progress: root.progress }, null, 2) + "\n")
  }

  function parseExtras(raw) {
    var obj = null
    try { obj = JSON.parse(raw || "{}") } catch (e) { obj = null }
    obj = obj && typeof obj === "object" ? obj : {}
    root.muted = obj.muted === true
    root.difficulty = obj.difficulty && typeof obj.difficulty === "object" ? obj.difficulty : ({})
    root.playersOf = obj.players && typeof obj.players === "object" ? obj.players : ({})
    root.stats = obj.stats && typeof obj.stats === "object" ? obj.stats : ({})
    root.dailyLog = obj.dailyLog && typeof obj.dailyLog === "object" ? obj.dailyLog : ({})
    root.tickets = typeof obj.tickets === "number" ? obj.tickets : 0
    root.ticketsEarned = typeof obj.ticketsEarned === "number" ? obj.ticketsEarned : 0
    root.prizes = Array.isArray(obj.prizes) ? obj.prizes.filter(function(v) { return typeof v === "string" }) : []
    root.cardBack = typeof obj.cardBack === "number" ? obj.cardBack : 0
    root.seenHelp = Array.isArray(obj.seenHelp) ? obj.seenHelp.filter(function(v) { return typeof v === "string" }) : []
    root.favourites = Array.isArray(obj.favourites) ? obj.favourites.filter(function(v) { return typeof v === "string" }) : []
    var ip = {}
    if (Array.isArray(obj.inProgress)) for (var i = 0; i < obj.inProgress.length; ++i) ip[obj.inProgress[i]] = true
    root.inProgress = ip
    root.progress = obj.progress && typeof obj.progress === "object" ? obj.progress : {}
  }

  function parseScores(raw) {
    try {
      var obj = JSON.parse(raw || "{}")
      return (obj && typeof obj === "object") ? obj : {}
    } catch (e) { return {} }
  }

  function parseState(raw) {
    try {
      var obj = JSON.parse(raw || "{}")
      return (obj && typeof obj.lastPlayed === "string") ? obj.lastPlayed : ""
    } catch (e) { return "" }
  }

  function parseRecent(raw) {
    try {
      var obj = JSON.parse(raw || "{}")
      if (obj && Array.isArray(obj.recent)) return obj.recent.filter(function(v) { return typeof v === "string" })
      return (obj && typeof obj.lastPlayed === "string" && obj.lastPlayed) ? [obj.lastPlayed] : []
    } catch (e) { return [] }
  }

  // ---- per-game save state, loaded/saved on demand rather than kept as a
  // permanent FileView per game (there are dozens of them, and only one is
  // ever active at a time).

  function saveState(gameId, stateObj) {
    var fv = Qt.createQmlObject(
      'import Quickshell.Io\nFileView { atomicWrites: true; printErrors: false }',
      root, "nickelbarSaveWriter")
    fv.path = root.dataDir + "/saves/" + gameId + ".json"
    fv.setText(JSON.stringify(stateObj || {}))
  }

  function loadState(gameId, callback) {
    // FileView has both a `loaded` PROPERTY (bool) and a `loaded` SIGNAL —
    // `fv.loaded.connect(...)` resolves to the property and throws. The
    // declarative `onLoaded:`/`onLoadFailed:` handlers always bind to the
    // signal regardless, so the callback has to be built into the object
    // itself rather than wired up after the fact.
    var fv = Qt.createQmlObject(
      'import Quickshell.Io\n' +
      'FileView {\n' +
      '  printErrors: false; watchChanges: false\n' +
      '  property var cb: null\n' +
      '  onLoaded: { var raw = text(); var obj = null; try { obj = JSON.parse(raw || "null") } catch (e) { obj = null } cb(obj); destroy() }\n' +
      '  onLoadFailed: { cb(null); destroy() }\n' +
      '}',
      root, "nickelbarSaveReader")
    fv.cb = callback
    fv.path = root.dataDir + "/saves/" + gameId + ".json"
  }

  function clearState(gameId) {
    var fv = Qt.createQmlObject(
      'import Quickshell.Io\nFileView { atomicWrites: true; printErrors: false }',
      root, "nickelbarSaveClearer")
    fv.path = root.dataDir + "/saves/" + gameId + ".json"
    fv.setText("null")
  }

  FileView {
    id: scoresFile
    path: root.dataDir + "/scores.json"
    watchChanges: true
    atomicWrites: true
    printErrors: false
    onLoaded: { root.scores = root.parseScores(text()); root.ready = true }
    onFileChanged: reload()
    onLoadFailed: { root.scores = {}; root.ready = true }
  }

  FileView {
    id: stateFile
    path: root.dataDir + "/state.json"
    watchChanges: true
    atomicWrites: true
    printErrors: false
    onLoaded: { var raw = text(); root.lastPlayed = root.parseState(raw); root.recent = root.parseRecent(raw); root.parseExtras(raw) }
    onFileChanged: reload()
    onLoadFailed: { root.lastPlayed = ""; root.recent = []; root.parseExtras("{}") }
  }

  Process {
    id: ensureDirs
    command: ["bash", "-c", "mkdir -p -- \"$1/saves\"", "--", root.dataDir]
  }

  Component.onCompleted: {
    ensureDirs.running = true
    Qt.callLater(function() {
      scoresFile.reload()
      stateFile.reload()
    })
  }
}
