.pragma library

// The full roster. `qml` is the games/ file to load; a game with no `qml`
// yet is listed dimmed and unselectable, so the picker always shows every
// entry even mid-build.
var GAMES = [
  { id: "snake",       title: "Snake",        type: "Arcade", qml: "Snake.qml" },
  { id: "breakout",    title: "Bricks",       type: "Arcade", qml: "Breakout.qml", tags: "brick paddle ball" },
  // Id stays "stack" so existing best scores and saves carry over; the
  // title changed to make room for Stacker below.
  { id: "stack",       title: "Blockfall",    type: "Arcade", qml: "Stack.qml", tags: "falling blocks" },
  { id: "pong",        title: "Paddles",      type: "Arcade", qml: "Pong.qml", tags: "table tennis paddle ball" },
  { id: "invaders",    title: "Invaders",     type: "Arcade", qml: "Invaders.qml", tags: "space shooter" },
  { id: "asteroids",   title: "Rockfall",     type: "Arcade", qml: "Asteroids.qml", tags: "space shooter" },
  { id: "lightcycles", title: "Light Cycles", type: "Arcade", qml: "LightCycles.qml", tags: "light trails" },
  { id: "crossing",    title: "Crossing",     type: "Arcade", qml: "Crossing.qml", tags: "road river hop" },
  { id: "runner",      title: "Runner",       type: "Arcade", qml: "Runner.qml", tags: "dino jump" },
  { id: "cave",        title: "Cave Flyer",   type: "Arcade", qml: "Cave.qml", tags: "helicopter cave" },
  { id: "missile",     title: "Skyguard",     type: "Arcade", qml: "MissileCommand.qml", tags: "defend cities" },
  { id: "lander",      title: "Moon Lander",  type: "Arcade", qml: "Lander.qml", tags: "moon landing" },
  { id: "stacker",     title: "Stacker",      type: "Midway", qml: "Stacker.qml" },
  { id: "skeeball",    title: "Alley Roll",   type: "Midway", qml: "Skeeball.qml", tags: "arcade ball" },
  { id: "slots",       title: "Slots",        type: "Midway", qml: "Slots.qml", tags: "casino" },
  { id: "whackamole",  title: "Mole Mash",    type: "Midway", qml: "WhackAMole.qml", tags: "mole hammer" },
  { id: "plinko",      title: "Chip Drop",    type: "Midway", qml: "Plinko.qml", tags: "pachinko pegs chips" },
  { id: "cyclone",     title: "Cyclone",      type: "Midway", qml: "Cyclone.qml", tags: "light chaser jackpot tickets" },
  { id: "gallery",     title: "Shooting Gallery", type: "Midway", qml: "ShootingGallery.qml", tags: "ducks targets shoot" },
  { id: "hoops",       title: "Hoops",        type: "Midway", qml: "Hoops.qml", tags: "basketball" },
  { id: "claw",        title: "Claw Machine", type: "Midway", qml: "ClawMachine.qml", tags: "crane grabber prizes" },
  { id: "coinpusher",  title: "Coin Pusher",  type: "Midway", qml: "CoinPusher.qml", tags: "penny falls tipping point" },
  { id: "derby",       title: "Derby",        type: "Midway", qml: "Derby.qml", tags: "horse race roll ball" },
  { id: "minesweeper", title: "Minesweeper",  type: "Puzzle", qml: "Minesweeper.qml", tags: "mines" },
  { id: "sudoku",      title: "Sudoku",       type: "Logic",  qml: "Sudoku.qml" },
  { id: "2048",        title: "2048",         type: "Puzzle", qml: "TwentyFortyEight.qml", tags: "merge tiles" },
  { id: "lightsout",   title: "Switch Off",   type: "Puzzle", qml: "LightsOut.qml", tags: "switch lights toggle grid" },
  { id: "nonogram",    title: "Nonogram",     type: "Logic",  qml: "Nonogram.qml" },
  { id: "sokoban",     title: "Sokoban",      type: "Puzzle", qml: "Sokoban.qml" },
  { id: "0hh1",        title: "Binary Grid",  type: "Logic",  qml: "OhHi.qml", tags: "takuzu binairo binary two colours" },
  { id: "0hn0",        title: "Sightlines",   type: "Logic",  qml: "OhNo.qml", tags: "kuromasu dots walls line of sight" },
  { id: "net",         title: "Net",          type: "Logic",  qml: "Net.qml", tags: "netwalk pipes network" },
  { id: "bridges",     title: "Bridges",      type: "Logic",  qml: "Bridges.qml", tags: "hashi hashiwokakero islands" },
  // ARC-AGI-1's 800 public tasks (835 test grids), bundled in games/data.
  { id: "arc",         title: "ARC",          type: "Puzzle", qml: "Arc.qml", tags: "agi abstraction reasoning chollet" },
  { id: "klondike",    title: "Klondike",     type: "Cards",  qml: "Klondike.qml", tags: "solitaire patience" },
  { id: "freecell",    title: "FreeCell",     type: "Cards",  qml: "FreeCell.qml", tags: "solitaire patience" },
  { id: "spider",      title: "Spider",       type: "Cards",  qml: "Spider.qml", tags: "solitaire patience" },
  { id: "blackjack",   title: "Blackjack",    type: "Cards",  qml: "Blackjack.qml", tags: "21 casino" },
  { id: "videopoker",  title: "Video Poker",  type: "Cards",  qml: "VideoPoker.qml", tags: "poker jacks casino" },
  { id: "reversi",     title: "Reversi",      type: "Board",  qml: "Reversi.qml", tags: "flip discs" },
  { id: "codebreaker", title: "Codebreaker",  type: "Board",  qml: "Codebreaker.qml", tags: "code pegs" },
  { id: "yacht",       title: "Yacht",        type: "Board",  qml: "Yacht.qml", tags: "dice poker" },
  { id: "mahjong",     title: "Mahjong",      type: "Board",  qml: "Mahjong.qml", tags: "solitaire tiles" },
  // Part of the same plugin as every other game, with the same GameBase contract.
  { id: "zengeometry", title: "Zen Geometry", type: "Board", qml: "ZenGeometry.qml", tags: "match three gems" },
  // The same board with Bejeweled's rules: levels, chains, no reshuffle, can end.
  { id: "zenclassic", title: "Geometry Classic", type: "Board", qml: "ZenGeometryClassic.qml", tags: "match three gems levels" },
  // OpenTriviaQA's ~49k questions, one file per topic in games/data/trivia.
  // Games added 2026-09-29.
  { id: "muncher",     title: "Muncher",      type: "Arcade", qml: "Muncher.qml", tags: "maze ghosts pellets chase" },
  { id: "hexfall",     title: "Hexfall",      type: "Arcade", qml: "Hexfall.qml", tags: "hextris hexagon" },
  { id: "melon",       title: "Melon Drop",   type: "Arcade", qml: "MelonDrop.qml", tags: "watermelon merge fruit" },
  { id: "bubbles",     title: "Bubble Pop",   type: "Arcade", qml: "BubblePop.qml", tags: "frozen bubble bubble shooter" },
  { id: "bounce",      title: "Bounce",       type: "Arcade", qml: "Bounce.qml", tags: "kbounce" },
  { id: "moonbuggy",   title: "Moon Buggy",   type: "Arcade", qml: "MoonBuggy.qml", tags: "moon-buggy terminal jump" },
  // After Simon Tatham's puzzles; most play from prebuilt packs in games/data/tatham.
  { id: "loopy",       title: "Loopy",        type: "Logic",  qml: "Loopy.qml", tags: "slitherlink tatham" },
  { id: "signpost",    title: "Signpost",     type: "Logic",  qml: "Signpost.qml", tags: "arrows tatham" },
  { id: "tents",       title: "Tents",        type: "Logic",  qml: "Tents.qml", tags: "trees tatham" },
  { id: "towers",      title: "Towers",       type: "Logic",  qml: "Towers.qml", tags: "skyscrapers tatham" },
  { id: "keen",        title: "Keen",         type: "Logic",  qml: "Keen.qml", tags: "calcudoku tatham" },
  { id: "lightup",     title: "Light Up",     type: "Logic",  qml: "LightUp.qml", tags: "tatham" },
  { id: "samegame",    title: "Same Game",    type: "Logic",  qml: "SameGame.qml", tags: "ksame swell foop klickety tatham" },
  { id: "inertia",     title: "Inertia",      type: "Logic",  qml: "Inertia.qml", tags: "gems tatham" },
  // After open-source Linux games.
  { id: "robots",      title: "Robots",       type: "Puzzle", qml: "Robots.qml", tags: "chase gnome bsd" },
  { id: "tetravex",    title: "Tetravex",     type: "Puzzle", qml: "Tetravex.qml", tags: "gnome tiles" },
  { id: "fiveormore",  title: "Five or More", type: "Puzzle", qml: "FiveOrMore.qml", tags: "color lines kolor gnome" },
  { id: "klotski",     title: "Klotski",      type: "Puzzle", qml: "Klotski.qml", tags: "huarong sliding block gnome" },
  { id: "fourinarow",  title: "Four in a Row", type: "Board", qml: "FourInARow.qml", tags: "vertical grid discs" },
  { id: "checkers",    title: "Checkers",     type: "Board",  qml: "Checkers.qml", tags: "draughts" },
  { id: "dotsboxes",   title: "Dots and Boxes", type: "Board", qml: "DotsAndBoxes.qml", tags: "ksquares" },
  { id: "shisen",      title: "Shisen-Sho",   type: "Board",  qml: "ShisenSho.qml", tags: "kshisen mahjong connect pairs" },
  { id: "greed",       title: "Greed",        type: "Board",  qml: "Greed.qml", tags: "10000 dice push-your-luck" },
  { id: "fiveletters", title: "Five Letters", type: "Quiz",   qml: "FiveLetters.qml", tags: "word guess five letters" },
  { id: "trivia",      title: "Trivia",       type: "Quiz",   qml: "Trivia.qml", tags: "quiz questions pub" },
  { id: "wangernumb",  title: "Wangernumb",   type: "Quiz",   qml: "Wangernumb.qml", tags: "joke gameshow chaos numbers" },
  // Added 2026-09-29 (second batch).
  { id: "centipede",   title: "Crawler",      type: "Arcade", qml: "Centipede.qml", tags: "mushrooms bug shooter" },
  { id: "swarm",       title: "Swarm",        type: "Arcade", qml: "Swarm.qml", tags: "space shooter formation" },
  { id: "tempest",     title: "Vortex",       type: "Arcade", qml: "Tempest.qml", tags: "tube vector shooter" },
  { id: "cubehop",     title: "Cube Hop",     type: "Arcade", qml: "CubeHop.qml", tags: "pyramid hop cubes" },
  { id: "digger",      title: "Digger",       type: "Arcade", qml: "Digger.qml", tags: "dig pump tunnel" },
  { id: "catapult",    title: "Catapult",     type: "Arcade", qml: "Catapult.qml", tags: "sling fort" },
  { id: "deepwell",    title: "Deep Well",    type: "Arcade", qml: "DeepWell.qml", tags: "gunboots fall well" },
  { id: "grapple",     title: "Grapple",      type: "Arcade", qml: "Grapple.qml", tags: "swing rope grapple" },
  { id: "artillery",   title: "Artillery",    type: "Arcade", qml: "Artillery.qml", tags: "tanks cannon turns" },
  { id: "pinball",     title: "Pinball",      type: "Midway", qml: "Pinball.qml", tags: "flippers bumpers" },
  { id: "minigolf",    title: "Mini Golf",    type: "Midway", qml: "MiniGolf.qml", tags: "putting golf" },
  { id: "scratch",     title: "Scratch Cards", type: "Midway", qml: "ScratchCards.qml", tags: "lottery scratchers" },
  { id: "crazyeights", title: "Crazy Eights", type: "Cards",  qml: "CrazyEights.qml", tags: "8s" },
  { id: "knucklebones", title: "Knucklebones", type: "Board", qml: "Knucklebones.qml", tags: "dice columns" },
  { id: "pipeline",    title: "Pipeline",     type: "Puzzle", qml: "Pipeline.qml", tags: "plumber water pipes" },
  { id: "empire",      title: "Empire",       type: "Board",  qml: "Empire.qml", tags: "territory hex conquest" },
  // Flash-era favourites.
  { id: "chainburst",  title: "Chain Burst",  type: "Arcade", qml: "ChainBurst.qml", tags: "chain reaction explosion" },
  { id: "bigfish",     title: "Big Fish",     type: "Arcade", qml: "BigFish.qml", tags: "eat grow fish" },
  { id: "cuberun",     title: "Cube Run",     type: "Arcade", qml: "CubeRun.qml", tags: "dodge cubes 3d" },
  { id: "pitfall",     title: "Jungle Run",   type: "Arcade", qml: "Pitfall.qml", tags: "jungle vine crocodile treasure platformer" },
  { id: "kittylaunch", title: "Kitty Launch", type: "Arcade", qml: "KittyLaunch.qml", tags: "kitten cannon distance" },
  { id: "rollblock",   title: "Roll Block",   type: "Puzzle", qml: "RollBlock.qml", tags: "block roll" },
  // Added 2026-10-01, after Pixel Tailgames' Tower Unite arcade and casino.
  { id: "bowling",     title: "Bowling",      type: "Midway", qml: "Bowling.qml", tags: "ten pin strike spare lanes" },
  { id: "fishing",     title: "Fishing",      type: "Midway", qml: "Fishing.qml", tags: "cast reel bait rod lake catch log" },
  { id: "bumpercars",  title: "Bumper Cars",  type: "Arcade", qml: "BumperCars.qml", tags: "sumo ram boost knockout arena" },
  { id: "echo",        title: "Echo",         type: "Puzzle", qml: "Echo.qml", tags: "memory pattern sequence piano" },
  { id: "roulette",    title: "Roulette",     type: "Midway", qml: "Roulette.qml", tags: "casino wheel red black zero chips" },
  { id: "striker",     title: "High Striker", type: "Midway", qml: "HighStriker.qml", tags: "hammer strongman bell mallet test your strength" },
  { id: "quickdraw",   title: "Quick Draw",   type: "Arcade", qml: "QuickDraw.qml", tags: "western duel showdown reaction gunslinger" },
  { id: "mindtester",  title: "Mind Tester",  type: "Quiz",   qml: "MindTester.qml", tags: "iq joke machine brain intelligence" },
  { id: "ringtoss",    title: "Ring Toss",    type: "Midway", qml: "RingToss.qml", tags: "bottles rings carnival throw" },
  { id: "milkjugs",    title: "Milk Jugs",    type: "Midway", qml: "MilkJugs.qml", tags: "knockdown bottles toss ball pyramid carnival" },
  { id: "holdem",      title: "Hold'em",      type: "Cards",  qml: "Holdem.qml", tags: "texas poker holdem casino bots blinds" },
  { id: "raid",        title: "Raid",         type: "Arcade", qml: "Raid.qml", tags: "shmup side scrolling shooter space boss" },
  { id: "billiards",   title: "Billiards",    type: "Board",  qml: "Billiards.qml", tags: "pool eight ball 8-ball snooker cue" },
  { id: "newton",      title: "Newton's Apples", type: "Midway", qml: "NewtonsApples.qml", tags: "apples wheel drop jackpot tower unite" },
  { id: "tornado",     title: "Tornado",      type: "Midway", qml: "Tornado.qml", tags: "storm wind balls drop eye jackpot" },
  { id: "stomper",     title: "Stomper",      type: "Arcade", qml: "Stomper.qml", tags: "platformer jump run stomp flag pipes" },
  { id: "roadrally",   title: "Road Rally",   type: "Arcade", qml: "RoadRally.qml", tags: "racing car driving traffic fuel top-down overtake" },
  // Added 2026-09-30.
  { id: "airhockey",   title: "Air Hockey",   type: "Midway", qml: "AirHockey.qml", tags: "puck mallet table arcade" },
  { id: "foosball",    title: "Foosball",     type: "Midway", qml: "Foosball.qml", tags: "table football soccer rods kicker" },
  { id: "bingo",       title: "Bingo",        type: "Midway", qml: "Bingo.qml", tags: "balls cards daub numbers hall" },
  { id: "sunlane",     title: "Sunlane",      type: "Arcade", qml: "Sunlane.qml", tags: "rail shooter 3d" },
  { id: "triples",     title: "Triples",      type: "Puzzle", qml: "Triples.qml", tags: "sliding numbers 1 2 3" },
  { id: "numberlink",  title: "Numberlink",   type: "Puzzle", qml: "Numberlink.qml", tags: "connect dots pipes paths" },
  { id: "hitori",      title: "Hitori",       type: "Logic",  qml: "Hitori.qml", tags: "shade cells numbers" },
  { id: "fillomino",   title: "Fillomino",    type: "Logic",  qml: "Fillomino.qml", tags: "polyomino regions numbers" },
  { id: "mancala",     title: "Mancala",      type: "Board",  qml: "Mancala.qml", tags: "kalah seeds pits sowing oware" },
  { id: "wordhunt",    title: "Word Hunt",    type: "Quiz",   qml: "WordHunt.qml", tags: "word search letters grid" }
]

// One line each for the picker's detail panel.
var BLURBS = {
  snake: "Eat, grow, and don't bite yourself.",
  breakout: "Keep the ball up and knock out every brick.",
  stack: "The falling-block classic: clear lines before the well fills.",
  pong: "Table tennis against the computer.",
  invaders: "Hold off the descending waves from behind your bunkers.",
  asteroids: "Thrust, turn and shoot your way through a rock field.",
  lightcycles: "Leave a trail, and make the other cycle hit one first.",
  crossing: "Get across the road and the river, one hop at a time.",
  runner: "Jump the cacti for as long as you can.",
  cave: "Hold to climb, let go to fall, and don't touch the walls.",
  missile: "Shoot down the incoming missiles before they reach your cities.",
  lander: "Set the module down gently on the flat bit.",
  muncher: "Clear the maze of pellets while four ghosts hunt you.",
  hexfall: "Turn the hexagon so falling blocks match up in threes.",
  melon: "Drop fruit; matching sizes merge into bigger ones.",
  bubbles: "Aim, bounce and pop groups of three before the ceiling comes down.",
  bounce: "Build walls to fence the balls into ever smaller space.",
  moonbuggy: "Jump craters and shoot rocks across the lunar surface.",
  stacker: "Stop the sliding row right on top of the last one.",
  skeeball: "Roll for the rings; the small ones score big.",
  slots: "Pull the lever and hope for three of a kind.",
  whackamole: "Sixty seconds of moles; hit them while they're up.",
  plinko: "Drop chips through the pegs and hope for the 10K slot.",
  bowling: "Ten frames: place the ball, aim, set the spin and time the power.",
  fishing: "Cast, wait for the bite, then reel without snapping the line; a log keeps every catch.",
  bumpercars: "Shove the other cars off the edge of the arena; boost for a hard hit.",
  echo: "Repeat the growing pattern on four pads or an eight-note keyboard; one slip ends it.",
  roulette: "A European wheel and the full table: numbers, dozens, colours, odds and evens.",
  striker: "Mash for hammer power and ring the bell, but swing too hard and you miss it.",
  quickdraw: "Wait for DRAW, fire first; early shots and decoys cost a life.",
  mindtester: "A machine with a single button that tells you how clever you are. It's lying.",
  ringtoss: "Throw rings over bottles as the marker sweeps past; the far ones pay most.",
  milkjugs: "Three balls to knock a pyramid of jugs off its shelf.",
  holdem: "No-limit Texas Hold'em against three bots with their own tempers.",
  raid: "A side-scrolling shooter: drone waves, power-up capsules and a boss each stage.",
  billiards: "Eight-ball against the computer: solids or stripes, then the 8.",
  newton: "Drop fifty apples into the cups of a spinning wheel; fill the jackpot cup.",
  tornado: "Drop balls through a storm and blow them toward the slot you want.",
  stomper: "A run-and-jump platformer: stomp Gribbles, bonk blocks, grab a berry, reach the flag.",
  cyclone: "Stop the racing light dead on the jackpot.",
  gallery: "Twenty-five shots at ducks, plates and the odd star.",
  hoops: "Time the power and the aim; the hoop starts moving at halftime.",
  claw: "Line up the claw, drop it, and hope the grip holds.",
  coinpusher: "Drop coins in front of the shelf and shove the pile over the edge.",
  derby: "Roll balls into the holes to race your horse home.",
  minesweeper: "Clear the field using the numbers; flag the mines.",
  "2048": "Slide and merge tiles all the way to 2048.",
  lightsout: "Every press flips its neighbours too; switch them all off.",
  sokoban: "Push every crate onto a target without getting stuck.",
  arc: "Work out the hidden rule from examples, then paint the answer.",
  robots: "Dodge the robots until they crash into each other.",
  tetravex: "Place the square tiles so every touching edge matches.",
  fiveormore: "Line up five of a colour before the board fills.",
  klotski: "Slide the blocks to free the big one. Can you make par?",
  sudoku: "Every row, column and box holds 1 to 9 once.",
  nonogram: "Paint the grid from the run lengths at each row and column.",
  "0hh1": "Two colours, no three in a row, and no two lines the same.",
  "0hn0": "Blue dots see exactly their number of other blues.",
  net: "Rotate the tiles until every computer is connected.",
  bridges: "Join the islands with bridges to match their numbers.",
  loopy: "Draw one loop that passes each number's count of sides.",
  signpost: "Chain the squares 1 to N, each step along the last arrow.",
  tents: "Pitch a tent beside every tree, no two touching.",
  towers: "Skyscrapers: fill the grid so the edge clues see the right number.",
  keen: "KenKen: Latin square where every cage makes its sum.",
  lightup: "Place lights so every cell is lit and no light sees another.",
  samegame: "Clear groups of colour; bigger groups score far more.",
  inertia: "Slide the ball to every gem without hitting a mine.",
  klondike: "The patience classic: build the four suits up from the ace.",
  freecell: "Every deal open to see, four free cells to work with.",
  spider: "Build full suits from king to ace in ten columns.",
  blackjack: "Get closer to 21 than the dealer without going bust.",
  videopoker: "Jacks or Better: hold, draw, and hope for a flush.",
  reversi: "Flank the computer's discs to turn them yours.",
  codebreaker: "Crack the colour code in ten guesses.",
  yacht: "Five dice, three rolls a turn, thirteen boxes to fill.",
  greed: "Push your luck: bank the points or roll again and risk a bust.",
  mahjong: "Match free tiles in pairs until the turtle is gone.",
  shisen: "Match tiles joined by a line with at most two turns.",
  zengeometry: "Swap shapes to make lines of three; no clock, no fail.",
  zenclassic: "Zen Geometry with Bejeweled's teeth: fill the bar, chain for points, and run out of swaps and it's over.",
  fourinarow: "Drop discs to line up four before the computer does.",
  checkers: "Jump and crown your way across the board.",
  dotsboxes: "Close boxes to claim them; don't hand over the third side.",
  trivia: "Multiple choice from 49,000 questions, three strikes and out.",
  fiveletters: "Guess the five-letter word in six tries.",
  pitfall: "Run the jungle: hop logs, swing over the tar, cross the crocodiles, grab the treasure.",
  wangernumb: "Type numbers at a game show whose rules nobody knows; sometimes it's Wangernumb.",
  centipede: "Shoot the centipede apart before it winds down to you.",
  swarm: "Hold off the formation as its bugs peel off and dive.",
  tempest: "Ride the rim of the tube and blast what climbs it.",
  cubehop: "Hop the pyramid to recolour every cube; mind the snake.",
  digger: "Tunnel, pump the monsters till they pop, drop rocks on them.",
  catapult: "Fling stones to bring the forts down on their targets.",
  deepwell: "Fall down the well, stomping and gunbooting as you go.",
  grapple: "Swing from the ceiling as far as you can; don't touch down.",
  artillery: "Three against three: bazookas, grenades, wind and craters.",
  pinball: "Three balls, three bumpers, lanes and drop targets.",
  minigolf: "Nine holes of banks, sand, water and a windmill.",
  scratch: "Ten cards: rub off the foil and hope for three of a kind.",
  crazyeights: "Match suit or rank, eights are wild; first to 100.",
  knucklebones: "Place dice to multiply your own and knock out theirs.",
  pipeline: "Lay pipe ahead of the water and run the quota before it spills.",
  empire: "Spend population on hexes to grow, fortify and take capitals.",
  chainburst: "One burst per level: start the chain reaction that catches the most.",
  bigfish: "Eat the little fish, flee the big ones, grow to rule the sea.",
  cuberun: "Steer through a rushing field of cubes; skim close for points.",
  kittylaunch: "Fire the kitty from the cannon, then upgrade for a longer flight.",
  rollblock: "Tip the block across the tiles and drop it upright in the hole.",
  airhockey: "Knock the puck past the computer's mallet; a fast swing hits hard. First to seven.",
  foosball: "Slide and kick four rods of little men, and beat the computer to five.",
  bingo: "75-ball bingo against two rivals with two cards each: call it first, and keep the streak going.",
  roadrally: "A top-down 8-bit-style race against a fuel gauge: weave through traffic to the next checkpoint.",
  sunlane: "Skim a chequered plain, shooting what comes at you and dodging the rest.",
  triples: "Slide the whole board one step at a time; 1 and 2 make 3, then match to double.",
  numberlink: "Join each pair of dots with a path so that every square is filled.",
  hitori: "Shade cells until no number repeats in any row or column and the rest stay connected.",
  fillomino: "Fill the grid so every group of equal numbers is exactly that many cells.",
  mancala: "Sow seeds round the pits, chase extra turns, and capture across the board.",
  wordhunt: "Trace words through touching letters before three minutes run out."
}

function blurb(id) { return BLURBS[id] || "" }

function byId(id) {
  for (var i = 0; i < GAMES.length; ++i) if (GAMES[i].id === id) return GAMES[i]
  return null
}

function isReady(id) {
  var g = byId(id)
  return !!(g && g.qml)
}

function readyGames() {
  var out = []
  for (var i = 0; i < GAMES.length; ++i) if (GAMES[i].qml) out.push(GAMES[i])
  return out
}

function randomReadyId() {
  var ready = readyGames()
  if (ready.length === 0) return ""
  return ready[Math.floor(Math.random() * ready.length)].id
}

// ---- picker helpers --------------------------------------------------------

var TYPE_ORDER = ["Arcade", "Midway", "Puzzle", "Logic", "Cards", "Board", "Quiz"]

// Fuzzy score of `query` against a game: 0 = no match, higher = better.
// Matches the letters in order anywhere in the title ("lc" -> Light
// Cycles), with bonuses for a prefix hit and for hits at word starts.
// The category name matches too, so "cards" lists the card games.
function matchScore(game, query) {
  var q = String(query || "").toLowerCase().replace(/\s+/g, "")
  if (!q) return 1
  var title = game.title.toLowerCase()
  if (game.type.toLowerCase().indexOf(q) === 0) return 5
  var compact = title.replace(/[\s-]+/g, "")
  if (compact.indexOf(q) === 0) return 100 - compact.length
  var ti = 0, score = 10, prevWordStart = true
  for (var qi = 0; qi < q.length; ++qi) {
    var found = false
    while (ti < title.length) {
      var ch = title.charAt(ti)
      var wordStart = ti === 0 || title.charAt(ti - 1) === " " || title.charAt(ti - 1) === "-"
      ti++
      if (ch === q.charAt(qi)) { if (wordStart) score += 8; found = true; break }
    }
    if (!found) return 0
  }
  if (title.indexOf(q) >= 0) score += 20
  return score
}

// Aliases ("solitaire", "draughts"...) count as a solid but lower match.
function tagScore(game, q) {
  if (!game.tags || !q) return 0
  var words = game.tags.split(" ")
  for (var i = 0; i < words.length; ++i) if (words[i].indexOf(q) === 0) return 30
  return 0
}

// Sections for the picker: [{ name, games: [...] }]. With a query it's one
// "Results" section, best match first; without: "Continue" (games with a
// round in progress, most recent first), "Recent" (the rest of the recent
// ones), "Favourites", then every category in TYPE_ORDER.
function sections(query, recentIds, favIds, contIds, filter, scores, dailyGame) {
  var out = []
  if (query) {
    var hits = []
    for (var i = 0; i < GAMES.length; ++i) {
      var sc = Math.max(matchScore(GAMES[i], query), tagScore(GAMES[i], String(query).toLowerCase().replace(/\s+/g, "")))
      if (sc > 0 && GAMES[i].qml) hits.push({ g: GAMES[i], s: sc, i: i })
    }
    hits.sort(function(a, b) { return b.s - a.s || a.i - b.i })
    // With a strong hit (prefix, whole-word or alias), drop the scattered
    // letter-by-letter matches that would only clutter the results.
    if (hits.length && hits[0].s >= 30) hits = hits.filter(function(h) { return h.s >= 20 })
    out.push({ name: hits.length ? "Results" : "No matches", games: hits.map(function(h) { return h.g }) })
    return out
  }
  var cont = {}
  for (var c = 0; c < (contIds || []).length; ++c) cont[contIds[c]] = true
  var going = [], recent = []
  for (var r = 0; r < (recentIds || []).length; ++r) {
    var g = byId(recentIds[r])
    if (!g || !g.qml) continue
    if (cont[g.id] && going.length < 4) going.push(g)
    else if (recent.length < 4) recent.push(g)
  }
  var filtered = !!filter
  if (!filtered && dailyGame && byId(dailyGame) && byId(dailyGame).qml) {
    var dg = {}; var src = byId(dailyGame)
    for (var dk in src) dg[dk] = src[dk]
    dg.daily = true
    out.push({ name: "Daily", games: [dg] })
  }
  if (!filtered && going.length) out.push({ name: "Continue", games: going })
  if (!filtered && recent.length) out.push({ name: "Recent", games: recent })
  var favs = []
  for (var f = 0; f < (favIds || []).length; ++f) { var fg = byId(favIds[f]); if (fg && fg.qml) favs.push(fg) }
  if (!filtered && favs.length) out.push({ name: "Favourites", games: favs })
  for (var t = 0; t < TYPE_ORDER.length; ++t) {
    var games = GAMES.filter(function(x) { return x.type === TYPE_ORDER[t] && passes(x, filter, scores, cont) })
    // Alphabetical within a category, ignoring case ("2048" sorts first).
    games.sort(function(a, b) { var x = a.title.toLowerCase(), y = b.title.toLowerCase(); return x < y ? -1 : x > y ? 1 : 0 })
    if (games.length) out.push({ name: TYPE_ORDER[t], games: games })
  }
  return out
}

// Search also matches the alias that found a game, for showing "pacman →".
function matchedTag(game, query) {
  var q = String(query || "").toLowerCase().replace(/\s+/g, "")
  if (!q || !game.tags || matchScore(game, query) >= 20) return ""
  var words = game.tags.split(" ")
  for (var i = 0; i < words.length; ++i) if (words[i].indexOf(q) === 0) return words[i]
  return ""
}

// Typical session length in minutes and who you play against, for the
// picker's detail panel and its Quick / Versus filters.
var META = {
  snake: [4, "solo"],
  breakout: [5, "solo"],
  stack: [5, "solo"],
  pong: [5, "vs CPU"],
  invaders: [5, "solo"],
  asteroids: [5, "solo"],
  lightcycles: [5, "vs CPU"],
  crossing: [5, "solo"],
  runner: [3, "solo"],
  cave: [3, "solo"],
  missile: [5, "solo"],
  lander: [5, "solo"],
  stacker: [2, "solo"],
  skeeball: [3, "solo"],
  slots: [5, "solo"],
  whackamole: [1, "solo"],
  plinko: [2, "solo"],
  cyclone: [2, "solo"],
  gallery: [2, "solo"],
  hoops: [2, "solo"],
  claw: [2, "solo"],
  coinpusher: [4, "solo"],
  derby: [3, "solo"],
  minesweeper: [5, "solo"],
  sudoku: [15, "solo"],
  "2048": [8, "solo"],
  lightsout: [5, "solo"],
  nonogram: [15, "solo"],
  sokoban: [10, "solo"],
  "0hh1": [10, "solo"],
  "0hn0": [10, "solo"],
  net: [10, "solo"],
  bridges: [10, "solo"],
  arc: [15, "solo"],
  klondike: [10, "solo"],
  freecell: [12, "solo"],
  spider: [15, "solo"],
  blackjack: [10, "vs CPU"],
  videopoker: [8, "solo"],
  reversi: [10, "vs CPU"],
  codebreaker: [6, "solo"],
  yacht: [10, "solo"],
  mahjong: [12, "solo"],
  zengeometry: [10, "solo"],
  zenclassic: [10, "solo"],
  muncher: [5, "solo"],
  hexfall: [5, "solo"],
  melon: [5, "solo"],
  bubbles: [6, "solo"],
  bounce: [5, "solo"],
  moonbuggy: [5, "solo"],
  loopy: [10, "solo"],
  signpost: [10, "solo"],
  tents: [10, "solo"],
  towers: [10, "solo"],
  keen: [10, "solo"],
  lightup: [10, "solo"],
  samegame: [4, "solo"],
  inertia: [8, "solo"],
  robots: [8, "solo"],
  tetravex: [6, "solo"],
  fiveormore: [8, "solo"],
  klotski: [8, "solo"],
  fourinarow: [4, "vs CPU"],
  checkers: [12, "vs CPU"],
  dotsboxes: [8, "vs CPU"],
  shisen: [10, "solo"],
  greed: [8, "solo"],
  fiveletters: [3, "solo"],
  trivia: [5, "solo"],
  wangernumb: [5, "vs CPU"],
  centipede: [5, "solo"],
  swarm: [5, "solo"],
  tempest: [5, "solo"],
  cubehop: [5, "solo"],
  digger: [5, "solo"],
  catapult: [5, "solo"],
  deepwell: [5, "solo"],
  grapple: [5, "solo"],
  artillery: [5, "vs CPU"],
  pinball: [6, "solo"],
  minigolf: [8, "solo"],
  scratch: [3, "solo"],
  crazyeights: [8, "vs CPU"],
  knucklebones: [6, "vs CPU"],
  pipeline: [6, "solo"],
  empire: [20, "vs CPU"],
  chainburst: [5, "solo"],
  bigfish: [5, "solo"],
  cuberun: [5, "solo"],
  pitfall: [5, "solo"],
  kittylaunch: [5, "solo"],
  rollblock: [10, "solo"],
  bowling: [8, "solo"],
  fishing: [8, "solo"],
  bumpercars: [5, "vs CPU"],
  echo: [3, "solo"],
  roulette: [10, "solo"],
  striker: [2, "solo"],
  quickdraw: [2, "vs CPU"],
  mindtester: [1, "solo"],
  ringtoss: [2, "solo"],
  milkjugs: [3, "solo"],
  holdem: [20, "vs CPU"],
  raid: [5, "solo"],
  billiards: [10, "vs CPU"],
  newton: [3, "solo"],
  tornado: [2, "solo"],
  stomper: [5, "solo"],
  airhockey: [4, "vs CPU"],
  foosball: [4, "vs CPU"],
  bingo: [4, "vs CPU"],
  sunlane: [5, "solo"],
  roadrally: [4, "solo"],
  triples: [8, "solo"],
  numberlink: [6, "solo"],
  hitori: [10, "solo"],
  fillomino: [10, "solo"],
  mancala: [6, "vs CPU"],
  wordhunt: [3, "solo"]
}

// When a game joined, for the NEW tag (it shows for 30 days).
var ADDED = {
  bowling: "2026-10-01",
  fishing: "2026-10-01",
  bumpercars: "2026-10-01",
  echo: "2026-10-01",
  roulette: "2026-10-01",
  striker: "2026-10-01",
  quickdraw: "2026-10-01",
  mindtester: "2026-10-01",
  ringtoss: "2026-10-01",
  milkjugs: "2026-10-01",
  holdem: "2026-10-01",
  raid: "2026-10-01",
  billiards: "2026-10-01",
  newton: "2026-10-01",
  tornado: "2026-10-01",
  stomper: "2026-10-01",
  roadrally: "2026-10-01"
}

var TWO_PLAYER = ["pong", "fourinarow", "checkers", "reversi"]

function meta(id) {
  var m = META[id] || [5, "solo"]
  return { mins: m[0], mode: TWO_PLAYER.indexOf(id) >= 0 ? "vs computer or 2 players" : m[1] }
}

function isNew(id, nowMs) {
  if (!ADDED[id]) return false
  return ((nowMs || Date.now()) - Date.parse(ADDED[id])) < 30 * 86400000
}

var FILTERS = ["", "quick", "vs", "new", "unplayed"]
var FILTER_NAMES = { "": "All", quick: "Quick", vs: "Versus", new: "New", unplayed: "Unplayed" }

// Does a game pass a picker filter? `scores` is the store's best-score map.
function passes(g, filter, scores, going) {
  if (!filter) return true
  if (filter === "quick") return meta(g.id).mins <= 3
  if (filter === "vs") return meta(g.id).mode !== "solo"
  if (filter === "new") return isNew(g.id)
  if (filter === "unplayed") return !(scores && scores[g.id] > 0) && !(going && going[g.id])
  return true
}

// ---- Daily challenge ------------------------------------------------------------------
// One of these, seeded by the date, is "today's game": the same board for everyone
// who plays it that day. Finite games where a seed makes a complete puzzle.
var DAILY = ["sudoku", "nonogram", "minesweeper", "0hh1", "0hn0", "lightsout", "fiveletters", "wordhunt",
             "2048", "klondike", "freecell", "samegame", "net", "hitori", "towers", "tents"]

// dayNumber: whole days since 1970 for today's date (see Rng.dayNumber).
function dailyId(dayNumber) { return DAILY[((dayNumber % DAILY.length) + DAILY.length) % DAILY.length] }

// ---- Tickets and prizes ---------------------------------------------------------------
// Rounds pay tickets; tickets buy card backs. Ranks come from tickets earned in all.
var PRIZES = [
  { id: "back-lattice", name: "Lattice card backs", cost: 40, back: 1 },
  { id: "back-stripes", name: "Striped card backs", cost: 90, back: 2 },
  { id: "back-gold",    name: "Gold card backs",    cost: 180, back: 3 }
]
var RANKS = [{ min: 0, name: "Visitor" }, { min: 40, name: "Regular" }, { min: 150, name: "Barker" }, { min: 400, name: "Ringmaster" }, { min: 1000, name: "Carnival Legend" }]

function rankFor(earned) {
  var r = RANKS[0]
  for (var i = 0; i < RANKS.length; ++i) if (earned >= RANKS[i].min) r = RANKS[i]
  return r.name
}

// What a finished round pays: Midway games pay by score, the rest a flat amount, wins a bonus.
function ticketsFor(game, score, won) {
  if (!game) return 0
  var base = game.type === "Midway" ? Math.min(40, 3 + Math.floor(Math.sqrt(Math.max(0, score)))) : 2
  return base + (won ? 5 : 0)
}

// Did the round just ended count as a win? (The same words the jingle uses.)
function wonTitle(title) {
  return /^(YOU WIN|SOLVED|CLEARED|CONNECTED|PERFECT|WON|TOPPED|OUT OF THE JUNGLE|GOT IT)/i.test(title || "")
}
