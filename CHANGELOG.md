# Changelog

## 0.12.0 (unreleased)

- Arcade: **Road Rally** (119 → 120), a top-down 8-bit-era race after Road Fighter: four lanes against a
  fuel gauge, blue cars, weaving cars and slow trucks, oil slicks, fuel cans, turbo, and a checkpoint
  every stage that refuels you. Bends scroll the road; a rear-end at speed or the wall is a crash.
  Easy / Normal / Hard; mouse steers; has its own sounds.
- Licence notices for the bundled data are complete (ARC changes statement, wordfreq's data-source credits,
  ENABLE's public-domain statement, OpenTriviaQA credit), with an in-game credit line for Trivia, ARC,
  Five Letters and Word Hunt. Search tags no longer name other companies' games.
- Theme colours come from the theme's own palette (`Theme.categorical`, `Theme.named`), so muted themes
  stay muted.

### Evaluation round: help, difficulty, two players, sound
- **Help**: the `?` screen is now structured: the game's one-liner, a controls list, the rules as
  bullets, its mouse use, and its options. First-run hint in the footer. Every new game's help
  text rewritten so its keys come first.
- **Difficulty** (Easy / Normal / Hard, `Ctrl+D`, saved per game) for Paddles, Air Hockey, Foosball,
  Light Cycles, Artillery, Reversi, Mancala, Knucklebones, Empire, Billiards, Hold'em, Raid, Bumper
  Cars, Stomper, Quick Draw and Bingo.
- **Two players** at one keyboard (`Ctrl+2`): Paddles, Four in a Row, Checkers, Reversi.
- **Undo** added to Robots, Five or More, Pipeline (before the water starts), Triples and Numberlink.
  **Resume** added to Billiards, Raid and Bumper Cars.
- **Picker**: session length and "vs computer" on each game, NEW tags, Quick / Versus / New / Unplayed
  filters (`f`), category counts, rounds played and won, time played.
- **Daily challenge** (a seeded game of the day, own save, streak), **tickets and a prize shelf**
  (three card backs). `engine/Rng.js` replaces `Math.random()` in every logic file, so any game can
  be seeded; the test loader shares one Rng like QML does.
- **Sound**: 15 new tones and per-game sound events in Billiards, Bowling, Roulette, Bumper Cars,
  Newton's Apples, Tornado, Milk Jugs, Ring Toss, High Striker, Quick Draw, Fishing, Raid, Pinball,
  Chip Drop, Bricks, Paddles and Blockfall (`ownSounds`, `playEvents`).
- **Shared parts**: `games/logic/physics.js` (circle collisions: Bowling, Billiards, Milk Jugs, Bumper
  Cars) and `meter.js` (the swinging power meter: Artillery, Catapult, Kitty Launch, Bowling, Fishing,
  Milk Jugs, Ring Toss).
- **Tests**: `make fuzz` (random input into every game in the real harness), tests for the new
  mechanisms, and tuning (Bumper Cars is gentler at the start; Paddles' score digits are readable;
  Billiards balls are larger; Milk Jugs zooms to its rack).

### Bingo is now a competition
- You hold two cards and two computer players (Bea and Gus) hold two each, shown beside yours with how close
  each is. They mark instantly and call after a short reaction time that shrinks as your streak grows. The
  score is the number of games you win in a row; the first loss ends the run. False calls just lock you out
  for three balls (no chips any more).

### Sixteen new games (103 → 119)
Ideas from Pixel Tailgames' Tower Unite arcade and casino, skipping anything Nickelbar already had.
- Midway: Bowling (ten frames; position, aim, spin and a power meter, then a real physics run of ball and
  pins), Fishing (cast, hook, reel against the tension; a catch log of ten species), Roulette (European
  wheel, the full table), High Striker (mash for power, but the bell is just under full power), Ring Toss
  (back bottles pay more), Milk Jugs (knock a pyramid off its shelf), Newton's Apples (fifty apples into a
  wheel of cups) and Tornado (steer falling balls through a storm with wind).
- Arcade: Stomper (a platformer: variable-height jumps, prize blocks, a Super Berry, stompable Gribbles and
  kickable Shellbacks, pipes, a flagpole, and endless levels generated from their number, each checked by
  tests to use only jumpable gaps and pipes), Bumper Cars (ring-out sumo with boost), Quick Draw (a showdown with decoys), Raid (a Gradius-style
  side shooter with power-up capsules and bosses).
- Puzzle: Echo (repeat the pattern; pads or an eight-note keyboard). Cards: Texas Hold'em against three bots
  with side pots. Board: Billiards (eight-ball against the computer). Quiz: Mind Tester (a joke).
- Games can now play sounds of their own: `GameBase` has a `sound(name)` signal the overlay routes to
  `engine/Sfx.qml` (Echo's notes use it).

### Subtle sounds
- Quiet synthesised blips for every game, wired once in the overlay rather than per game: a soft tick
  on moves, a click on select, a chime when the score goes up, a short jingle when a round ends (win,
  lose, or new best), and cues for pause and the picker. Games that score every tick go quiet after a
  few blips. Ctrl+M mutes (saved in `state.json`). The wavs in `sounds/` come from
  `node dev/tools/make-sounds.js`; nothing is sampled. Played with Qt's SoundEffect (`engine/Sfx.qml`).

### Geometry Classic (102 → 103 games)
- A harder Zen Geometry, after the original Bejeweled, as its own entry so it keeps its own best and
  saved game. Zen stays endless. Classic: clearing pieces fills a level bar (40 for level 1, ten more each
  level), 10 points a piece multiplied down a cascade, 100 × level for finishing one, no reshuffle, and
  the round ends when no swap is left on the board. Same code as Zen (`classic` in `ZenGeometry.qml`).

## 0.11.0 — 2026-10-01

### Ten new games (92 → 102)
- Midway: Air Hockey (a mallet each, mallet speed carries into the puck, first to 7), Foosball
  (eight rods, four of them yours; slide, pick a rod, kick; first to 5) and Bingo (75-ball, five
  rounds and five patterns, four cards to watch against three rivals who never miss a number).
- Arcade: Sunlane, a rail shooter after Space Harrier: fly anywhere over a chequered plain,
  shoot the enemies that come out of the horizon, dodge their shots and the columns.
- Puzzle: Triples (after Threes) and Numberlink (after Flow Free; every square must be filled).
- Logic: Hitori (generated, solver-checked, unique) and Fillomino (generated, unique by exhaustive
  search).
- Board: Mancala (Kalah, with an alpha-beta computer). Quiz: Word Hunt (after Boggle; three minutes,
  type or drag; a 170,000-word ENABLE dictionary in `games/data/wordhunt.txt`).
- Tests: `dev/tests/newgames.test.js`.

### New game
- Jungle Run (Arcade): a jungle run after Pitfall! on the Atari. A hundred
  screens of rolling logs, fire, cobras, tar and quicksand pits crossed on
  swinging vines, and a crocodile pond to hop across on closed mouths; holes
  lead to tunnels (scorpions, brick walls) that skip three screens at a
  time. 32-odd treasures, three lives, eight minutes, and 2000 points to
  start with, as in the original. 91 → 92 games.
- Wangernumb (Quiz): a chaotic joke game after Numberwang. Ten hidden
  rules swap every two to five turns, the board turns a quarter every
  three or four, the number wheel reshuffles each turn, and every fifth
  Numberwang opens a ten-second bonus round. 90 → 91 games.

### Mouse play in the card games
- Klondike, FreeCell and Spider: dragged cards now follow the pointer and
  land on whichever pile they overlap most (outlined as you drag, red if
  the move isn't legal); a missed drop snaps back. Double-click plays a
  card to its best spot, and clicking empty table lets go of a pick.
  Spider's right-click plays a run to its best spot.
- Blackjack and Video Poker: on-screen buttons (DEAL, HIT, STAND, DOUBLE,
  NEXT HAND / DEAL, DRAW) and clickable bet sizes. A stray click no longer
  hits or draws.
- Dev harness: `>fx:fy:gx:gy` script step drags, and `NICKELBAR_LOAD` starts
  from a saved state, for scripted mouse checks.

### Changed
- The overlay no longer sets `keepLoaded`: it is unmounted when closed and remounted on open, instead
  of holding 102 games' worth of QML in the shell. Game state was already saved on close.

### Fixed
- Logic puzzles can all be solved by deduction now, with no guessing.
  Before, most generators only checked for a unique answer (or none at
  all), and many puzzles needed trial and error: over half of 8×8 and
  10×10 Binary Grid boards, most larger Sightlines boards, and about 70% of
  Nonograms. Bridges and Net boards often had several answers. Each
  generator now keeps a puzzle only if a solver limited to human-style
  reasoning can finish it: Binary Grid, Sightlines, Nonogram, Sudoku, Bridges and
  Net live, and the Tatham packs at build time (Loopy and Signpost
  rebuilt; the other four already passed). `make test` checks them all.

## 0.10.0 — 2026-09-29

Twenty-one new games (69 → 90), and the project packaged as a repository.

### New games
- Arcade: Crawler, Swarm (after Galaga), Vortex, Cube Hop (after
  Q*bert), Digger (after Dig Dug), Catapult (after Angry Birds), Deep Well
  (after Downwell), Grapple (after Floating Point), Artillery (after
  Worms), Chain Burst (after Boomshine), Big Fish (after Fishy), Cube Run
  (after Cube Field), Kitty Launch (after Kitten Cannon and Toss the
  Turtle)
- Midway: Pinball, Mini Golf, Scratch Cards
- Puzzle: Pipeline (after Pipe Mania), Roll Block (after Bloxorz)
- Cards: Crazy Eights
- Board: Knucklebones (after Cult of the Lamb), Empire (after Empire
  Attack, on hexes)

### Packaging
- Git repository, `LICENSE` (MIT) and `THIRD_PARTY.md` for the bundled
  data; `games/data/WORDS-LICENSE` for the Five Letters word list.
- `make test`: logic tests in Node (catalog completeness, level solvers,
  card-count invariants, simulated play). `make smoke`: every game loaded
  in the QML harness with a save round-trip. `make check` runs both.
- `make sync` generates the dev harness's game list from the catalog.
- `make screenshots` renders every game and a gallery for the README.
- `make disable` and `make uninstall`.

### Fixes
- Crazy Eights: a late round could churn forever (everyone drawing the
  pile back and passing); rounds now end as a stalemate past 240 turns.

## 0.9.0

Sixty-nine games: the arcade, midway, puzzle, logic, card, board and quiz
collection that this repository started from.
