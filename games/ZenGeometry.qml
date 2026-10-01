import QtQuick
import qs.Commons
import "../engine" as Engine
import "logic/zengeometry.js" as Game

// Endless geometry match-3, ported from the standalone Zen Geometry plugin
// into the shared arcade shell. Shape carries piece identity; every colour
// still comes from the active theme. There's no fail state by design (no
// timer, lives, or score pressure) so `over` never becomes true; it's
// flagged `endless` instead, and the overlay banks the running total of
// cleared pieces as its best whenever the game is saved.
//
// Classic mode (ZenGeometryClassic.qml sets `classic`) is the harder cousin,
// after the original Bejeweled: clearing pieces fills a level bar, each
// level asks for more, points multiply down a cascade, there's no
// reshuffle, and the round ends when no swap is left on the board.
//
// Reshuffle has no key of its own in the shared keymap, so it rides `undo`
// (U) — same idea as Stack riding U for hold.
Engine.GameBase {
  id: root
  gameId: "zengeometry"
  title: "ZEN GEOMETRY"
  property bool classic: false
  helpText: classic
    ? "ARROWS move · select then ARROW/click adjacent to swap · SPACE/ENTER select · fill the bar to level up · the round ends when no swap is left · N new game"
    : "ARROWS move · select then ARROW/click adjacent to swap · SPACE/ENTER select · U reshuffle · N reset"
  mouseHelp: "Hover a shape and click to pick it, click a neighbour to swap"

  property var board: []
  property var uidCounter: ({ value: 1 })
  property int cursorIndex: 0
  property int selectedIndex: -1
  property var clearingIndices: []
  property var rejectedIndices: []
  property var pendingPlan: null
  property var pendingSwapBoard: []
  property int pendingSwapA: -1
  property int pendingSwapB: -1
  property bool pendingSwapPrism: false
  property bool busy: false
  property int moves: 0
  property int cleared: 0
  property int cascadeDepth: 0
  // Classic only: points scored, 1-based level, pieces cleared this level.
  property int points: 0
  property int level: 1
  property int levelCleared: 0
  readonly property int levelTarget: 30 + 10 * level

  score: classic ? points : cleared
  progress: classic ? "level " + level : ""
  // Zen has no fail state, so the overlay banks `cleared` whenever it saves.
  endless: !classic

  // Motion state. Geometry carries identity; animation and colour carry feedback.
  property int swapA: -1
  property int swapB: -1
  property real swapProgress: 0.0
  property var fallOffsets: []
  property real fallProgress: 1.0
  property real clearProgress: 0.0
  property real breathe: 0.0
  property real selectionPulse: 0.0
  property real boardReveal: 1.0

  Engine.Theme { id: theme }

  function contains(list, value) { for (var i = 0; i < list.length; ++i) if (list[i] === value) return true; return false }
  function clamp01(value) { return Math.max(0, Math.min(1, value)) }

  function mixColor(a, b, t) {
    var x = clamp01(t)
    return Qt.rgba(a.r + (b.r - a.r) * x, a.g + (b.g - a.g) * x, a.b + (b.b - a.b) * x, a.a + (b.a - a.a) * x)
  }

  // One colour per piece type: the theme's own palette where it has seven
  // distinguishable entries, topped up from inside its saturation/lightness
  // range where it doesn't (see Theme.categorical). A slightly wider gap
  // than the default since the pieces are small and must read at a glance.
  readonly property var typeColors: theme.categorical(7, 0.08)
  function typeColor(type) {
    if (type < 0 || type >= typeColors.length) return theme.foreground
    return typeColors[type]
  }

  function pieceColor(type, selected, specialType) {
    if (specialType === 3) return mixColor(theme.accent, theme.foreground, 0.30)
    var c = typeColor(type)
    if (selected) c = mixColor(c, theme.highlight, 0.28)
    return c
  }

  function markColorFor(fill, selected) {
    var c = mixColor(theme.accent, fill, 0.22)
    if (selected) c = mixColor(c, theme.highlight, 0.20)
    return c
  }

  function stride() { return boardFrame.cellSize + boardFrame.cellGap }

  function swapTarget(index) {
    if (index === swapA) return swapB
    if (index === swapB) return swapA
    return -1
  }

  function pieceDx(index) {
    var target = swapTarget(index)
    if (target < 0) return 0
    return (Game.colOf(target) - Game.colOf(index)) * stride() * swapProgress
  }

  function pieceDy(index) {
    var dy = 0
    var target = swapTarget(index)
    if (target >= 0) dy += (Game.rowOf(target) - Game.rowOf(index)) * stride() * swapProgress
    var offset = (fallOffsets && fallOffsets.length > index) ? (fallOffsets[index] || 0) : 0
    dy -= offset * stride() * (1.0 - fallProgress)
    return dy
  }

  function clearingOpacity(index) { return contains(clearingIndices, index) ? (1.0 - clearProgress * 0.90) : 0.90 }

  function clearingScale(index) {
    if (!contains(clearingIndices, index)) return 1.0
    var bloom = 0.13 * Math.sin(clearProgress * Math.PI)
    return (1.0 + bloom) * (1.0 - 0.42 * clearProgress)
  }

  function computeFallOffsets(oldBoard, newBoard) {
    var offsets = []
    var oldByUid = {}
    var i
    for (i = 0; i < oldBoard.length; ++i) if (oldBoard[i] && oldBoard[i].uid) oldByUid[String(oldBoard[i].uid)] = i

    var newTotals = {}
    for (i = 0; i < newBoard.length; ++i) {
      var piece = newBoard[i]
      if (!piece || oldByUid[String(piece.uid)] !== undefined) continue
      var col = Game.colOf(i)
      newTotals[col] = (newTotals[col] || 0) + 1
    }

    var newSeen = {}
    for (i = 0; i < newBoard.length; ++i) {
      var p = newBoard[i]
      if (!p) { offsets.push(0); continue }
      var oldIndex = oldByUid[String(p.uid)]
      if (oldIndex !== undefined) {
        offsets.push(Math.max(0, Game.rowOf(i) - Game.rowOf(oldIndex)))
      } else {
        var c = Game.colOf(i)
        var seen = newSeen[c] || 0
        var total = newTotals[c] || 1
        var originRow = -(total - seen)
        offsets.push(Math.max(1, Game.rowOf(i) - originRow))
        newSeen[c] = seen + 1
      }
    }
    return offsets
  }

  function idleStatus() {
    return classic ? "LEVEL " + level + " · " + Math.min(100, Math.floor(levelCleared * 100 / levelTarget)) + "%" : "ENDLESS"
  }

  function resetMotion() {
    swapAnimation.stop(); rejectAnimation.stop(); clearAnimation.stop(); fallAnimation.stop()
    settleTimer.stop(); statusTimer.stop(); revealAnimation.stop()
    swapA = -1; swapB = -1; swapProgress = 0
    fallOffsets = []; fallProgress = 1; clearProgress = 0
    pendingSwapBoard = []; pendingSwapA = -1; pendingSwapB = -1; pendingSwapPrism = false
  }

  function newGame() {
    resetMotion()
    uidCounter = { value: 1 }
    board = Game.makeBoard(uidCounter)
    cursorIndex = 0
    selectedIndex = -1
    clearingIndices = []
    rejectedIndices = []
    pendingPlan = null
    busy = false
    over = false
    paused = false
    moves = 0
    cleared = 0
    points = 0
    level = 1
    levelCleared = 0
    overTitle = ""
    cascadeDepth = 0
    root.status = root.idleStatus()
    boardReveal = 0.52
    revealAnimation.restart()
  }

  function reshuffle() {
    if (classic || over || busy || paused || board.length !== 64) return
    board = Game.shuffleBoard(board, uidCounter)
    selectedIndex = -1
    root.status = "RESHUFFLED"
    boardReveal = 0.48
    revealAnimation.restart()
    statusTimer.restart()
  }

  function moveCursorTo(next) {
    if (next < 0) return
    cursorIndex = next
  }

  function activateCell(index) {
    if (busy || paused || over || index < 0 || index >= 64) return
    cursorIndex = index

    if (selectedIndex < 0) { selectedIndex = index; return }
    if (selectedIndex === index) { selectedIndex = -1; return }
    if (!Game.adjacent(selectedIndex, index)) { selectedIndex = index; return }

    attemptSwap(selectedIndex, index)
  }

  // dx/dy match the shared keymap (Left/Right = dx, Up/Down = dy); the
  // engine itself works in row/col deltas, so this just flips the order.
  function moveCursor(dx, dy) {
    if (busy || paused || over) return
    if (selectedIndex >= 0) {
      var target = Game.neighbour(selectedIndex, dy, dx)
      if (target >= 0) { cursorIndex = target; attemptSwap(selectedIndex, target) }
    } else {
      moveCursorTo(Game.neighbour(cursorIndex, dy, dx))
    }
  }

  function activate() {
    activateCell(cursorIndex)
  }

  function undo() {
    reshuffle()
  }

  function attemptSwap(a, b) {
    if (busy || !Game.adjacent(a, b)) return
    var pa = board[a], pb = board[b]
    if (!pa || !pb) return

    var swapped = Game.swap(board, a, b)
    var prism = (pa.special || 0) === 3 || (pb.special || 0) === 3
    var legal = prism || Game.formsMatchAt(swapped, a) || Game.formsMatchAt(swapped, b)

    busy = true
    selectedIndex = -1
    swapA = a; swapB = b; swapProgress = 0

    if (!legal) {
      rejectedIndices = [a, b]
      rejectAnimation.restart()
      return
    }

    moves += 1
    cascadeDepth = 1
    pendingSwapBoard = swapped
    pendingSwapA = a; pendingSwapB = b; pendingSwapPrism = prism
    root.status = prism ? "PRISM" : "FLOW"
    swapAnimation.restart()
  }

  function commitSwap() {
    var a = pendingSwapA, b = pendingSwapB, prism = pendingSwapPrism
    board = pendingSwapBoard
    pendingSwapBoard = []; pendingSwapA = -1; pendingSwapB = -1; pendingSwapPrism = false
    swapA = -1; swapB = -1; swapProgress = 0

    if (prism) {
      var prismPlan = Game.planPrismSwap(board, a, b)
      board = prismPlan.board
      beginPlan(prismPlan)
    } else {
      beginPlan(Game.planMatches(board, b, a))
    }
  }

  function finishRejectedSwap() {
    swapA = -1; swapB = -1; swapProgress = 0
    rejectedIndices = []
    busy = false
    root.status = root.idleStatus()
  }

  function beginPlan(plan) {
    if (!plan || (plan.clearIndices.length === 0 && plan.creations.length === 0)) { finishTurn(); return }
    pendingPlan = plan
    clearingIndices = plan.clearIndices.slice(0)
    clearProgress = 0
    clearAnimation.restart()
  }

  function finishResolution() {
    if (!pendingPlan) { finishTurn(); return }
    var oldBoard = board
    var count = pendingPlan.clearIndices.length
    cleared += count
    if (classic) {
      levelCleared += count
      points += count * 10 * Math.max(1, cascadeDepth)
    }
    var nextBoard = Game.applyPlan(board, pendingPlan, uidCounter)
    pendingPlan = null
    clearingIndices = []
    startFall(oldBoard, nextBoard)
  }

  function startFall(oldBoard, nextBoard) {
    fallOffsets = computeFallOffsets(oldBoard, nextBoard)
    board = nextBoard
    fallProgress = 0
    fallAnimation.restart()
  }

  function continueCascade() {
    var nextPlan = Game.planMatches(board, -1, -1)
    if (nextPlan.clearIndices.length > 0 || nextPlan.creations.length > 0) {
      cascadeDepth += 1
      root.status = "CASCADE ×" + cascadeDepth
      beginPlan(nextPlan)
    } else {
      finishTurn()
    }
  }

  function finishTurn() {
    busy = false
    pendingPlan = null
    clearingIndices = []
    fallOffsets = []
    fallProgress = 1
    cascadeDepth = 0
    if (classic) {
      if (levelCleared >= levelTarget) {
        points += 100 * level
        level += 1
        levelCleared = 0
        board = Game.makeBoard(uidCounter)
        selectedIndex = -1
        root.status = "LEVEL " + level
        boardReveal = 0.48
        revealAnimation.restart()
        statusTimer.restart()
      } else if (!Game.hasLegalMove(board)) {
        over = true
        overTitle = "NO MOVES LEFT"
        root.status = "NO MOVES LEFT"
      } else {
        root.status = root.idleStatus()
      }
      return
    }
    if (!Game.hasLegalMove(board)) {
      board = Game.shuffleBoard(board, uidCounter)
      root.status = "RESHUFFLED"
      boardReveal = 0.48
      revealAnimation.restart()
      statusTimer.restart()
    } else {
      root.status = root.idleStatus()
    }
  }

  function saveState() {
    if (!board.length || over) return null
    return { board: board, moves: moves, cleared: cleared, uidNext: uidCounter.value,
             points: points, level: level, levelCleared: levelCleared }
  }

  function loadState(saved) {
    if (!saved || !saved.board || saved.board.length !== 64) { newGame(); return }
    resetMotion()
    board = saved.board
    uidCounter = { value: saved.uidNext || (board.length + 1) }
    cursorIndex = 0
    selectedIndex = -1
    clearingIndices = []
    rejectedIndices = []
    pendingPlan = null
    busy = false
    over = false
    moves = saved.moves || 0
    cleared = saved.cleared || 0
    points = saved.points || 0
    level = saved.level || 1
    levelCleared = saved.levelCleared || 0
    overTitle = ""
    cascadeDepth = 0
    root.status = root.idleStatus()
    boardReveal = 1.0
  }

  NumberAnimation { id: swapAnimation; target: root; property: "swapProgress"; from: 0; to: 1; duration: 155; easing.type: Easing.InOutCubic; onFinished: root.commitSwap() }

  SequentialAnimation {
    id: rejectAnimation
    NumberAnimation { target: root; property: "swapProgress"; from: 0; to: 1; duration: 115; easing.type: Easing.OutCubic }
    NumberAnimation { target: root; property: "swapProgress"; from: 1; to: 0; duration: 145; easing.type: Easing.InOutCubic }
    onFinished: root.finishRejectedSwap()
  }

  NumberAnimation { id: clearAnimation; target: root; property: "clearProgress"; from: 0; to: 1; duration: 235; easing.type: Easing.InOutSine; onFinished: root.finishResolution() }
  NumberAnimation { id: fallAnimation; target: root; property: "fallProgress"; from: 0; to: 1; duration: 285; easing.type: Easing.OutCubic; onFinished: settleTimer.restart() }
  NumberAnimation { id: revealAnimation; target: root; property: "boardReveal"; to: 1; duration: 330; easing.type: Easing.OutCubic }

  SequentialAnimation {
    running: !root.paused
    loops: Animation.Infinite
    NumberAnimation { target: root; property: "breathe"; from: 0; to: 1; duration: 3600; easing.type: Easing.InOutSine }
    NumberAnimation { target: root; property: "breathe"; from: 1; to: 0; duration: 3600; easing.type: Easing.InOutSine }
  }

  SequentialAnimation {
    running: !root.paused
    loops: Animation.Infinite
    NumberAnimation { target: root; property: "selectionPulse"; from: 0; to: 1; duration: 780; easing.type: Easing.InOutSine }
    NumberAnimation { target: root; property: "selectionPulse"; from: 1; to: 0; duration: 780; easing.type: Easing.InOutSine }
  }

  Timer { id: settleTimer; interval: 85; repeat: false; onTriggered: root.continueCascade() }
  Timer { id: statusTimer; interval: 1100; repeat: false; onTriggered: if (!root.busy && !root.over) root.status = root.idleStatus() }

  Item {
    id: boardFrame
    anchors.centerIn: parent
    width: Math.min(parent.width, parent.height)
    height: width

    readonly property real cellGap: Math.max(2, Style.space(4))
    readonly property real cellSize: Math.floor((width - cellGap * 7) / 8)

    Rectangle {
      id: boardBack
      width: boardFrame.cellSize * 8 + boardFrame.cellGap * 7 + Style.space(12)
      height: width
      anchors.centerIn: parent
      radius: Style.cornerRadius
      color: "transparent"
      border.width: Math.max(1, Style.space(1))
      border.color: theme.border
      opacity: (0.88 + root.breathe * 0.055) * root.boardReveal
      scale: 1.0 + root.breathe * 0.004

      Grid {
        id: grid
        anchors.centerIn: parent
        columns: 8
        rows: 8
        spacing: boardFrame.cellGap

        Repeater {
          model: 64

          delegate: Item {
            id: cell
            required property int index
            width: boardFrame.cellSize
            height: boardFrame.cellSize

            readonly property var piece: root.board.length === 64 ? root.board[index] : null
            readonly property bool cursorHere: root.cursorIndex === index
            readonly property bool selectedHere: root.selectedIndex === index
            readonly property bool clearingHere: root.contains(root.clearingIndices, index)
            readonly property bool rejectedHere: root.contains(root.rejectedIndices, index)

            Rectangle {
              anchors.fill: parent
              radius: Math.max(2, Style.cornerRadius * 0.55)
              color: cell.selectedHere ? theme.selectedBackground : "transparent"
              border.width: cell.cursorHere || cell.selectedHere ? Math.max(1, Style.space(2)) : Math.max(1, Style.space(1))
              border.color: cell.rejectedHere ? theme.danger : (cell.cursorHere || cell.selectedHere ? theme.accent : theme.border)
              opacity: cell.rejectedHere ? 1.0 : (cell.selectedHere ? 0.82 + root.selectionPulse * 0.15 : (cell.cursorHere ? 0.76 : 0.30))

              Behavior on opacity { NumberAnimation { duration: 95 } }
            }

            Canvas {
              id: glyph
              anchors.fill: parent
              anchors.margins: Math.max(Style.space(5), parent.width * 0.13)
              opacity: root.clearingOpacity(cell.index)
              scale: cell.clearingHere ? root.clearingScale(cell.index) : (cell.selectedHere ? 1.055 + root.selectionPulse * 0.025 : (cell.cursorHere ? 1.018 : 1.0))
              rotation: (cell.piece && (cell.piece.special || 0) === 3) ? (root.breathe * 8.0 - 4.0) : 0
              transform: Translate { x: root.pieceDx(cell.index); y: root.pieceDy(cell.index) }

              property int shapeType: cell.piece ? cell.piece.type : -2
              property int specialType: cell.piece ? (cell.piece.special || 0) : 0
              property color fillColor: root.pieceColor(shapeType, cell.selectedHere, specialType)
              property color markColor: root.markColorFor(fillColor, cell.selectedHere)

              onShapeTypeChanged: requestPaint()
              onSpecialTypeChanged: requestPaint()
              onFillColorChanged: requestPaint()
              onMarkColorChanged: requestPaint()
              onWidthChanged: requestPaint()
              onHeightChanged: requestPaint()

              Behavior on rotation { NumberAnimation { duration: 180 } }

              onPaint: {
                var ctx = getContext("2d")
                ctx.clearRect(0, 0, width, height)
                var w = width, h = height
                if (w <= 0 || h <= 0) return
                var cx = w / 2, cy = h / 2
                var r = Math.min(w, h) * 0.38

                ctx.fillStyle = fillColor
                ctx.strokeStyle = fillColor
                ctx.lineWidth = Math.max(1.5, Math.min(w, h) * 0.055)
                ctx.lineJoin = "round"
                ctx.lineCap = "round"

                if (specialType === 3) {
                  ctx.shadowColor = Qt.rgba(markColor.r, markColor.g, markColor.b, 0.18)
                  ctx.shadowBlur = Math.max(1, Math.min(w, h) * 0.08)
                  ctx.beginPath()
                  for (var s = 0; s < 16; ++s) {
                    var rr = (s % 2 === 0) ? r : r * 0.43
                    var a = -Math.PI / 2 + s * Math.PI / 8
                    var px = cx + Math.cos(a) * rr
                    var py = cy + Math.sin(a) * rr
                    if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
                  }
                  ctx.closePath()
                  ctx.fill()
                } else if (shapeType === 0) {
                  ctx.beginPath()
                  ctx.arc(cx, cy, r, 0, Math.PI * 2)
                  ctx.fill()
                } else if (shapeType === 1) {
                  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
                } else if (shapeType === 2) {
                  ctx.beginPath()
                  ctx.moveTo(cx, cy - r * 1.34)
                  ctx.lineTo(cx + r * 0.82, cy)
                  ctx.lineTo(cx, cy + r * 1.34)
                  ctx.lineTo(cx - r * 0.82, cy)
                  ctx.closePath()
                  ctx.fill()
                } else if (shapeType === 3) {
                  ctx.beginPath()
                  ctx.moveTo(cx, cy - r * 1.24)
                  ctx.lineTo(cx + r * 0.98, cy + r * 0.92)
                  ctx.lineTo(cx - r * 0.98, cy + r * 0.92)
                  ctx.closePath()
                  ctx.fill()
                } else if (shapeType === 4) {
                  ctx.beginPath()
                  ctx.arc(cx, cy, r * 0.96, 0, Math.PI * 2)
                  ctx.strokeStyle = fillColor
                  ctx.lineWidth = Math.max(2.5, Math.min(w, h) * 0.16)
                  ctx.stroke()
                  ctx.strokeStyle = fillColor
                  ctx.lineWidth = Math.max(1.5, Math.min(w, h) * 0.055)
                } else if (shapeType === 5) {
                  var q = r * 0.42
                  ctx.beginPath()
                  ctx.moveTo(cx - q, cy - r)
                  ctx.lineTo(cx + q, cy - r)
                  ctx.lineTo(cx + q, cy - q)
                  ctx.lineTo(cx + r, cy - q)
                  ctx.lineTo(cx + r, cy + q)
                  ctx.lineTo(cx + q, cy + q)
                  ctx.lineTo(cx + q, cy + r)
                  ctx.lineTo(cx - q, cy + r)
                  ctx.lineTo(cx - q, cy + q)
                  ctx.lineTo(cx - r, cy + q)
                  ctx.lineTo(cx - r, cy - q)
                  ctx.lineTo(cx - q, cy - q)
                  ctx.closePath()
                  ctx.fill()
                } else if (shapeType === 6) {
                  var arm = Math.max(3, Math.min(w, h) * 0.18)
                  ctx.save()
                  ctx.translate(cx, cy)
                  ctx.rotate(Math.PI / 4)
                  ctx.fillRect(-arm / 2, -r * 1.15, arm, r * 2.3)
                  ctx.rotate(Math.PI / 2)
                  ctx.fillRect(-arm / 2, -r * 1.15, arm, r * 2.3)
                  ctx.restore()
                }

                ctx.shadowBlur = 0

                if (specialType === 1) {
                  ctx.strokeStyle = markColor
                  ctx.lineWidth = Math.max(1.5, Math.min(w, h) * 0.07)
                  var inner = r * 0.78, outer = r * 1.16
                  for (var d = 0; d < 4; ++d) {
                    var da = Math.PI / 4 + d * Math.PI / 2
                    ctx.beginPath()
                    ctx.moveTo(cx + Math.cos(da) * inner, cy + Math.sin(da) * inner)
                    ctx.lineTo(cx + Math.cos(da) * outer, cy + Math.sin(da) * outer)
                    ctx.stroke()
                  }
                } else if (specialType === 2) {
                  ctx.strokeStyle = markColor
                  ctx.lineWidth = Math.max(1.5, Math.min(w, h) * 0.07)
                  ctx.beginPath()
                  ctx.moveTo(cx - r * 1.18, cy)
                  ctx.lineTo(cx + r * 1.18, cy)
                  ctx.moveTo(cx, cy - r * 1.18)
                  ctx.lineTo(cx, cy + r * 1.18)
                  ctx.stroke()
                }
              }
            }

            Item {
              anchors.fill: parent
              visible: cell.clearingHere
              z: 6

              Repeater {
                model: 6

                delegate: Rectangle {
                  property int shard: index
                  property real angle: -Math.PI / 2 + shard * Math.PI / 3
                  property real travel: Math.min(cell.width, cell.height) * (0.12 + root.clearProgress * 0.42)
                  width: Math.max(2, cell.width * 0.07)
                  height: width
                  radius: width * 0.18
                  color: shard % 2 === 0 ? theme.foreground : theme.accent
                  opacity: (1.0 - root.clearProgress) * 0.78
                  rotation: 45 + shard * 30 + root.clearProgress * 70
                  x: cell.width / 2 - width / 2 + Math.cos(angle) * travel
                  y: cell.height / 2 - height / 2 + Math.sin(angle) * travel
                  scale: 1.0 - root.clearProgress * 0.42
                }
              }
            }

            MouseArea {
              anchors.fill: parent
              z: 10
              hoverEnabled: true
              cursorShape: root.busy ? Qt.BusyCursor : Qt.PointingHandCursor
              onContainsMouseChanged: if (containsMouse && !root.busy) root.cursorIndex = index
              onClicked: root.activateCell(index)
            }
          }
        }
      }
    }
  }

  Component.onCompleted: if (!board.length) newGame()
}
