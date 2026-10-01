import QtQuick
import QtQuick.Window
import Quickshell

// Standalone runner for iterating on one game without the live shell.
// Run with `make dev` (defaults to snake) or `make dev GAME=2048`, which
// sets NICKELBAR_GAME and points QML_IMPORT_PATH at dev/mock so `import
// qs.Commons` resolves to the stand-ins next door instead of the real
// shell singletons.
//
// This has to be `dev/harness/shell.qml`, not a bare `dev/harness.qml` run
// with `qs -p dev/harness.qml`: Quickshell wraps a single bare file in a
// synthetic root that a static `import "../..."` can't cross ("Script
// qrc:/qs-blackhole unavailable"). A directory config doesn't have that
// problem. The Loader below still can't statically import
// engine/GamesCatalog.js for the same reason, so the id-to-file mapping is
// duplicated here in miniature instead.
Window {
  id: win
  visible: true
  width: 640
  height: 720
  color: "#101315"
  title: "Nickelbar dev harness — " + gameId

  readonly property var files: ({
    snake: "Snake.qml",
    breakout: "Breakout.qml",
    stack: "Stack.qml",
    pong: "Pong.qml",
    invaders: "Invaders.qml",
    asteroids: "Asteroids.qml",
    lightcycles: "LightCycles.qml",
    crossing: "Crossing.qml",
    runner: "Runner.qml",
    cave: "Cave.qml",
    missile: "MissileCommand.qml",
    lander: "Lander.qml",
    stacker: "Stacker.qml",
    skeeball: "Skeeball.qml",
    slots: "Slots.qml",
    whackamole: "WhackAMole.qml",
    plinko: "Plinko.qml",
    cyclone: "Cyclone.qml",
    gallery: "ShootingGallery.qml",
    hoops: "Hoops.qml",
    claw: "ClawMachine.qml",
    coinpusher: "CoinPusher.qml",
    derby: "Derby.qml",
    minesweeper: "Minesweeper.qml",
    sudoku: "Sudoku.qml",
    "2048": "TwentyFortyEight.qml",
    lightsout: "LightsOut.qml",
    nonogram: "Nonogram.qml",
    sokoban: "Sokoban.qml",
    "0hh1": "OhHi.qml",
    "0hn0": "OhNo.qml",
    net: "Net.qml",
    bridges: "Bridges.qml",
    arc: "Arc.qml",
    klondike: "Klondike.qml",
    freecell: "FreeCell.qml",
    spider: "Spider.qml",
    blackjack: "Blackjack.qml",
    videopoker: "VideoPoker.qml",
    reversi: "Reversi.qml",
    codebreaker: "Codebreaker.qml",
    yacht: "Yacht.qml",
    mahjong: "Mahjong.qml",
    zengeometry: "ZenGeometry.qml",
    zenclassic: "ZenGeometryClassic.qml",
    muncher: "Muncher.qml",
    hexfall: "Hexfall.qml",
    melon: "MelonDrop.qml",
    bubbles: "BubblePop.qml",
    bounce: "Bounce.qml",
    moonbuggy: "MoonBuggy.qml",
    loopy: "Loopy.qml",
    signpost: "Signpost.qml",
    tents: "Tents.qml",
    towers: "Towers.qml",
    keen: "Keen.qml",
    lightup: "LightUp.qml",
    samegame: "SameGame.qml",
    inertia: "Inertia.qml",
    robots: "Robots.qml",
    tetravex: "Tetravex.qml",
    fiveormore: "FiveOrMore.qml",
    klotski: "Klotski.qml",
    fourinarow: "FourInARow.qml",
    checkers: "Checkers.qml",
    dotsboxes: "DotsAndBoxes.qml",
    shisen: "ShisenSho.qml",
    greed: "Greed.qml",
    fiveletters: "FiveLetters.qml",
    trivia: "Trivia.qml",
    wangernumb: "Wangernumb.qml",
    centipede: "Centipede.qml",
    swarm: "Swarm.qml",
    tempest: "Tempest.qml",
    cubehop: "CubeHop.qml",
    digger: "Digger.qml",
    catapult: "Catapult.qml",
    deepwell: "DeepWell.qml",
    grapple: "Grapple.qml",
    artillery: "Artillery.qml",
    pinball: "Pinball.qml",
    minigolf: "MiniGolf.qml",
    scratch: "ScratchCards.qml",
    crazyeights: "CrazyEights.qml",
    knucklebones: "Knucklebones.qml",
    pipeline: "Pipeline.qml",
    empire: "Empire.qml",
    chainburst: "ChainBurst.qml",
    bigfish: "BigFish.qml",
    cuberun: "CubeRun.qml",
    pitfall: "Pitfall.qml",
    kittylaunch: "KittyLaunch.qml",
    rollblock: "RollBlock.qml",
    bowling: "Bowling.qml",
    fishing: "Fishing.qml",
    bumpercars: "BumperCars.qml",
    echo: "Echo.qml",
    roulette: "Roulette.qml",
    striker: "HighStriker.qml",
    quickdraw: "QuickDraw.qml",
    mindtester: "MindTester.qml",
    ringtoss: "RingToss.qml",
    milkjugs: "MilkJugs.qml",
    holdem: "Holdem.qml",
    raid: "Raid.qml",
    billiards: "Billiards.qml",
    newton: "NewtonsApples.qml",
    tornado: "Tornado.qml",
    stomper: "Stomper.qml",
    roadrally: "RoadRally.qml",
    airhockey: "AirHockey.qml",
    foosball: "Foosball.qml",
    bingo: "Bingo.qml",
    sunlane: "Sunlane.qml",
    triples: "Triples.qml",
    numberlink: "Numberlink.qml",
    hitori: "Hitori.qml",
    fillomino: "Fillomino.qml",
    mancala: "Mancala.qml",
    wordhunt: "WordHunt.qml"
  })
  readonly property string gameId: {
    var requested = Quickshell.env("NICKELBAR_GAME") || "snake"
    return files[requested] ? requested : "snake"
  }
  readonly property string qmlFile: files[gameId]

  // Headless checks: NICKELBAR_SCRIPT is a comma list of steps played into
  // the game (h/j/k/l move, a activate, u undo, n new, p pause, t tick,
  // w wait, R save+restore round trip, @fx:fy click (@fx:fy:r right-click),
  // ~fx:fy hover and >fx:fy:gx:gy a left-button drag from one point to the
  // other, at a fraction of the board, anything else goes to handleKey as
  // text; a drag ending in :h holds the button down for a screenshot), then
  // NICKELBAR_SHOT
  // saves a PNG of the window and the harness quits. Run with
  // QT_QPA_PLATFORM=offscreen QT_QUICK_BACKEND=software for no window.
  readonly property var script: (Quickshell.env("NICKELBAR_SCRIPT") || "").split(",").filter(function(t) { return t.length > 0 })
  readonly property string shotPath: Quickshell.env("NICKELBAR_SHOT") || ""
  property int scriptPos: 0

  Timer {
    interval: 40
    repeat: true
    running: win.shotPath.length > 0 || win.script.length > 0
    triggeredOnStart: false
    property int warmup: 12
    onTriggered: {
      if (warmup-- > 0) return
      var item = loader.item
      if (!item) return
      if (win.scriptPos < win.script.length) {
        var t = win.script[win.scriptPos++]
        var moves = { h: [-1, 0], l: [1, 0], k: [0, -1], j: [0, 1] }
        if (moves[t]) item.moveCursor(moves[t][0], moves[t][1])
        else if (t === "a") item.activate()
        else if (t === "u") { if (typeof item.undo === "function") item.undo() }
        else if (t === "n") item.newGame()
        else if (t === "p") item.togglePause()
        else if (t === "t") item.tick()
        else if (t === "A") item.heldAction = !item.heldAction
        else if (t === "L" || t === "H") item.heldDx = item.heldDx ? 0 : (t === "L" ? 1 : -1)
        else if (t === "K" || t === "J") item.heldDy = item.heldDy ? 0 : (t === "J" ? 1 : -1)
        else if (t === "w") {}
        else if (t[0] === "@" || t[0] === "~" || t[0] === ">") {
          // @fx:fy[:r] clicks (right-click with :r), ~fx:fy hovers, at a
          // fraction of the Pointer's area (the board).
          var pa = item.pointerArea, parts = t.slice(1).split(":")
          if (pa) {
            var px = Number(parts[0]) * pa.width, py = Number(parts[1]) * pa.height
            var btn = parts[2] === "r" ? Qt.RightButton : Qt.LeftButton
            if (t[0] === "~") pa.send("move", px, py, 0)
            else if (t[0] === ">") {
              var gx = Number(parts[2]) * pa.width, gy = Number(parts[3]) * pa.height
              item.started = true
              pa.send("press", px, py, Qt.LeftButton)
              for (var st = 1; st <= 6; ++st) pa.send("drag", px + (gx - px) * st / 6, py + (gy - py) * st / 6, Qt.LeftButton)
              if (parts[4] !== "h") pa.send("release", gx, gy, Qt.LeftButton)
            }
            else if (item.over) item.activate()
            else { item.started = true; pa.send("press", px, py, btn); pa.send("release", px, py, btn) }
          }
        }
        else if (t === "R") {
          // Save and restore through JSON, as closing and reopening would.
          if (typeof item.saveState === "function") {
            var snap = JSON.parse(JSON.stringify(item.saveState() || null))
            if (typeof item.loadState === "function") item.loadState(snap)
          }
        }
        else if (typeof item.handleKey === "function") item.handleKey(0, t)
        return
      }
      stop()
      if (!win.shotPath) return
      win.contentItem.grabToImage(function(result) {
        result.saveToFile(win.shotPath)
        console.log("NICKELBAR_STATUS", item.over, item.score, item.status)
        Qt.quit()
      })
    }
  }

  Item {
    id: keyCatcher
    anchors.fill: parent
    focus: true

    // Mirrors Overlay.qml's routing (handleKey first, held-direction state
    // for continuousMove games, autorepeat filtering) minus the chrome.
    function directionFor(event) {
      if (event.key === Qt.Key_Left || event.text === "h") return { dx: -1, dy: 0 }
      if (event.key === Qt.Key_Right || event.text === "l") return { dx: 1, dy: 0 }
      if (event.key === Qt.Key_Up || event.text === "k") return { dx: 0, dy: -1 }
      if (event.key === Qt.Key_Down || event.text === "j") return { dx: 0, dy: 1 }
      return null
    }

    Keys.onPressed: function(event) {
      var item = loader.item
      if (!item) return
      event.accepted = true
      if (typeof item.handleKey === "function" && !item.paused && item.handleKey(event.key, event.text)) return
      var dir = directionFor(event)
      if (dir) {
        if (item.continuousMove === true) {
          if (event.isAutoRepeat) return
          if (dir.dx !== 0) item.heldDx = dir.dx
          if (dir.dy !== 0) item.heldDy = dir.dy
        }
        item.moveCursor(dir.dx, dir.dy)
        return
      }
      if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter || event.key === Qt.Key_Space) {
        if (item.continuousMove === true) {
          if (event.isAutoRepeat) return
          item.heldAction = true
        }
        if (item.paused) item.paused = false
        else item.activate()
        return
      }
      if (event.text === "n" || event.text === "N") { item.newGame(); return }
      if (event.text === "p" || event.text === "P") { item.togglePause(); return }
      if (event.text === "u" || event.text === "U") { if (typeof item.undo === "function") item.undo(); return }
      event.accepted = false
    }

    Keys.onReleased: function(event) {
      var item = loader.item
      if (!item || event.isAutoRepeat || item.continuousMove !== true) return
      if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter || event.key === Qt.Key_Space) { item.heldAction = false; return }
      var dir = directionFor(event)
      if (!dir) return
      if (dir.dx !== 0 && item.heldDx === dir.dx) item.heldDx = 0
      if (dir.dy !== 0 && item.heldDy === dir.dy) item.heldDy = 0
    }

    Column {
      anchors.fill: parent
      anchors.margins: 16
      spacing: 10

      Text {
        text: win.gameId.toUpperCase()
        color: "#cacccc"
        font.pixelSize: 18
        font.bold: true
      }

      Loader {
        id: loader
        width: parent.width
        height: parent.height - 90
        active: true
        // Quickshell blackholes relative URLs that leave the config dir, so
        // load the game by absolute path (make dev runs from the repo root).
        source: win.qmlFile ? "file://" + (Quickshell.env("NICKELBAR_ROOT") || Quickshell.env("PWD")) + "/games/" + win.qmlFile : ""
        onLoaded: {
          if (item && typeof item.newGame === "function") item.newGame()
          // NICKELBAR_LOAD: a JSON save to start from instead (a known deal
          // for scripted mouse checks). Needs QML_XHR_ALLOW_FILE_READ=1,
          // which harness-run.sh sets.
          var load = Quickshell.env("NICKELBAR_LOAD")
          if (item && load && typeof item.loadState === "function") {
            var xhr = new XMLHttpRequest()
            xhr.open("GET", "file://" + load, false)
            xhr.send()
            item.loadState(JSON.parse(xhr.responseText))
          }
        }
      }

      Text {
        width: parent.width
        color: "#8fbcbb"
        font.pixelSize: 13
        text: loader.item ? (loader.item.over ? "[" + (loader.item.overTitle || "GAME OVER") + "]  " : "") + (loader.item.status || "") + "   score " + loader.item.score : "no game loaded"
      }

      Text {
        width: parent.width
        wrapMode: Text.WordWrap
        color: "#707880"
        font.pixelSize: 11
        text: (loader.item ? loader.item.helpText + "  ·  " : "")
          + "hjkl/arrows move · space/enter act · n new · p pause · u undo (if supported)"
      }
    }
  }
}
