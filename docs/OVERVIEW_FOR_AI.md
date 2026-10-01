# Nickelbar: overview for an AI assistant

Paste this (or point an assistant at it) to give it the context for working on Nickelbar.

## What it is

**Nickelbar** is a single plugin for the **Omarchy** desktop shell (Omarchy = an Arch Linux + Hyprland setup;
its shell runs on **Quickshell**, `qs`, which is QML). The plugin id is `io.github.cobmuddybug.nickelbar`. It bundles **120 small
games** behind one bar icon: click the gamepad icon in the bar, pick a game, and it plays in a centred overlay
on the desktop. It is not a standalone app or a terminal game; it lives inside the shell.

- MIT licence (bundled data keeps its own licences, see `THIRD_PARTY.md`). Current version 0.12.0. Unofficial:
  not affiliated with the Omarchy project.
- The repository is the source of truth. The installed copy is `~/.config/omarchy/plugins/io.github.cobmuddybug.nickelbar`, a copy
  made by `make install`; it is not linked to the repo.
- User data: `~/.local/share/nickelbar/` (`scores.json`, `state.json`, `saves/`)
- Keybind: `SUPER + SHIFT + G` toggles it (`omarchy-shell shell toggle io.github.cobmuddybug.nickelbar '{}'`) in `~/.config/hypr/bindings.lua`
- Bar widget: left click = picker, right click = resume last game, middle click = random game.
  IPC with a game id opens straight into it: `omarchy-shell shell toggle io.github.cobmuddybug.nickelbar '{"game":"snake"}'`.

## The key design rules

1. **Every colour comes from the active Omarchy theme** (`engine/Theme.qml`), so switching themes repaints all
   games. Exception: the ARC game keeps its own ten colours because they carry meaning.
2. **Everything works with the keyboard and the mouse.** Real-time games keep moving while a key is held and
   wait, paused, when the overlay is closed.
3. **Game logic is pure JavaScript** (`games/logic/<name>.js`, `.pragma library`), separate from the QML that
   draws it. Most keep an immutable state and return a new one from `step()` or a move function, which is what
   makes the games testable in plain Node.
4. Best scores save the moment a round ends; unfinished rounds appear under "Continue" in the picker.

## The games (120, in seven categories)

- **Arcade** (about 30): Snake, Bricks (id `breakout`), Blockfall (the falling-piece game; its id is still `stack`), Paddles (`pong`),
  Invaders, Rockfall (`asteroids`), Light Cycles, Crossing, Runner, Cave Flyer, Skyguard (`missile`), Moon Lander (`lander`), Muncher
  (Pac-Man-like), Hexfall, Melon Drop, Bubble Pop, Jungle Run (`pitfall`), Bounce, Moon Buggy, Crawler (`centipede`), Swarm, Vortex (`tempest`),
  Cube Hop, Digger, Catapult, Deep Well, Grapple, Artillery, Chain Burst, Big Fish, Cube Run, Kitty Launch, Road Rally (a Road Fighter-style top-down race), Sunlane (a Space Harrier-style rail shooter), Stomper (platformer), Bumper Cars, Quick Draw, Raid (a Gradius-style side shooter).
- **Midway** (fairground): Stacker, Alley Roll (`skeeball`), Slots, Mole Mash (`whackamole`), Chip Drop (`plinko`), Cyclone, Shooting Gallery, Hoops,
  Claw Machine, Coin Pusher, Derby, Pinball, Mini Golf, Scratch Cards, Air Hockey, Foosball, Bingo, Bowling, Fishing, Roulette, High Striker, Ring Toss, Milk Jugs, Newton's Apples, Tornado.
- **Puzzle**: Minesweeper, 2048, Switch Off (`lightsout`), Sokoban, ARC (all of ARC-AGI-1: infer the rule from examples and
  paint the answer), Robots, Tetravex, Five or More, Klotski, Pipeline, Roll Block, Triples (Threes-like), Numberlink (Flow Free-like), Echo (Simon-like).
- **Logic** (pen and paper): Sudoku, Nonogram, Binary Grid (`0hh1`), Sightlines (`0hn0`), and Simon Tatham-style Net, Bridges, Loopy,
  Signpost, Tents, Towers, Keen, Light Up, Same Game, Inertia, Hitori, Fillomino. Most are solvable by human-style deduction with no
  guessing (the generators verify this with a limited solver); Fillomino is unique-solution by exhaustive search.
- **Cards**: Klondike, FreeCell, Spider (1/2/4 suits), Blackjack, Video Poker, Crazy Eights, Hold'em (vs three bots).
- **Board**: Reversi, Codebreaker, Yacht, Mahjong, Zen Geometry, Geometry Classic, Four in a Row, Checkers, Dots and Boxes,
  Shisen-Sho, Greed (a push-your-luck dice game), Knucklebones, Empire, Mancala (Kalah), Billiards (eight-ball vs the computer).
- **Quiz**: Mind Tester (joke), Trivia (about 49,000 questions, 20 topics), Five Letters (a word-guessing game), Wangernumb (a joke game show with hidden rules), Word Hunt (Boggle-like).

Many games are "after" a well-known game (the README names each one). The picker searches titles fuzzily and
also matches aliases: typing "tetris", "pacman" or "wordle" finds the right game.

## Layout of the repo

```
manifest.json, BarWidget.qml, Picker.qml, Overlay.qml, GameList.qml   the plugin shell: bar icon, picker, overlay
engine/   Sfx.qml (UI sounds from ../sounds, played by the overlay; Ctrl+M mutes), GameBase.qml (base class every game extends), Theme.qml, Store.qml (scores/saves),
          GamesCatalog.js (the roster: id, title, category, qml file, search tags, blurbs),
          Pointer.qml (mouse routing), icons.js + GameIcon.qml, PackGame.qml + PuzzlePack.qml
games/    one <Name>.qml per game (about 16.7k lines) + logic/<name>.js (about 18k lines) ; data/ = puzzle packs,
          trivia, word list, ARC tasks (about 10 MB)
dev/      harness/ + mock/ (run one game in a window without the live shell), tests/ (Node), tools/
docs/     screenshots/gallery.png ; this file
Makefile, CHANGELOG.md, README.md, THIRD_PARTY.md, LICENSE
```

## Systems worth knowing

- `engine/Store.qml` keeps `state.json` (last played, recent, favourites, in-progress, per-game difficulty and
  player count, help-seen list, stats, daily log, tickets, prizes, mute) and `scores.json`.
- `engine/Rng.js`: games call `Rng.random()`; the overlay seeds it for the daily challenge (seed = hash of game id and
  local date). `engine/help.js` splits `helpText` for the help screen. `engine/Sfx.qml` plays sounds by name; games emit
  them with `sound(name)` or `playEvents(state)`.
- Overlay features: help screen, difficulty (`Ctrl+D`), players (`Ctrl+2`), daily mode (`{"daily":true}`), tickets on
  round end. `GameBase` has `difficulties`/`difficulty`, `hasTwoPlayer`/`players`, `ownSounds`, undo helpers.
- Tooling: `make test`, `make smoke`, `make fuzz` (random input in the QML harness), `make screenshots`.

## How to work on it

- Edit the repo, then `make install` (rsync to the plugin dir). Most changes hot-reload; some need
  `make restart` (`omarchy restart shell`). `make enable` / `make disable` toggles the plugin.
- `make dev GAME=<id>` runs one game in a standalone Quickshell window with a stand-in theme.
- `make test` = Node logic tests (~30 s). `make smoke` = every game loaded in the real QML harness (a few
  minutes). `make check` = both. `make screenshots` regenerates `docs/screenshots/`.
- Adding a game: write `games/logic/<name>.js`; write `games/<Name>.qml` extending `GameBase.qml` (set `gameId`,
  `title`, `helpText`, `mouseHelp`; implement `newGame()`, `moveCursor()`, `activate()`, optionally `pointer()`,
  `handleKey()`, `undo()`, `saveState()/loadState()`); register it in `GAMES` and `BLURBS` in
  `engine/GamesCatalog.js`; draw an icon in `engine/icons.js`; run `make sync`; bump the game count in
  `manifest.json` and the README; run `make check`.
- Colours: use `engine/Theme.qml` only. Game ids are stable keys for saved scores, so do not rename them.

## Third-party data

ARC-AGI-1 tasks (Apache 2.0), OpenTriviaQA (CC BY-SA 4.0), the Five Letters word list (ENABLE, filtered with
wordfreq). Details in `THIRD_PARTY.md`.
