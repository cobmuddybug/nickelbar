# Third-party notices

Nickelbar's own code, drawings and sounds are MIT (see `LICENSE`). Four bundled
data sets come from elsewhere and keep their own licences. If you redistribute
Nickelbar, these notices and licence files go with it. The licences below apply
only to the data files named, not to the code.

| Data | Used by | Source | Licence | Notices |
|---|---|---|---|---|
| `games/data/arc1.json` | ARC | [ARC-AGI-1](https://github.com/fchollet/ARC-AGI) by François Chollet | Apache License 2.0 | `games/data/ARC-AGI-LICENSE` (with the notice of changes) |
| `games/data/trivia/*.json` | Trivia | [OpenTriviaQA](https://github.com/uberspot/OpenTriviaQA) | CC BY-SA 4.0 | `games/data/trivia/OpenTriviaQA-LICENSE` (with attribution and changes) |
| `games/data/wordhunt.txt` | Word Hunt | Every 3-16 letter word of ENABLE, minus a short blocklist | Public domain | `games/data/WORDS-LICENSE` |
| `games/data/words.json` | Five Letters | Guesses from ENABLE (public domain); answers selected with [wordfreq](https://github.com/rspeer/wordfreq)'s frequency data | CC BY-SA 4.0 (wordfreq's data) | `games/data/WORDS-LICENSE` (with wordfreq's required credits) |

ENABLE (Enhanced North American Benchmark Lexicon) was compiled by Mendel
Cooper with research by Alan Beale and released into the public domain by its
author; the statement is quoted in `WORDS-LICENSE`.

The converted files are adapted material: `trivia/*.json` and `words.json`
are under CC BY-SA 4.0 like their sources, so changes to them must be shared
under the same licence. `arc1.json` stays under Apache 2.0. The tools that
rebuild them are in `dev/tools/` (`trivia.py`, `words.py`). The questions in
the trivia files are included as published by OpenTriviaQA, whose own sources
are not documented; if you hold rights in a question and want it removed, open
an issue and it will be taken out.

## What Nickelbar runs on

Nickelbar is a plugin for the [Omarchy](https://omarchy.org) shell (MIT) and
runs on [Quickshell](https://quickshell.org) (LGPL-3.0). Neither is bundled,
copied or modified here; the plugin imports them at run time, and the stand-in
modules in `dev/mock/` that let the games run outside the shell are original
code. **Nickelbar is an independent, unofficial project: it is not made,
endorsed or supported by the Omarchy project, Quickshell, or anyone named
below.**

## Games after other games

Many games here are after (inspired by) older games, and the README says
which. None of their code, art, music, levels or text are used: every game is
written from scratch and draws only in the active theme's colours, and the
sounds are synthesised by `dev/tools/make-sounds.js` (nothing sampled). Game
rules and mechanics are not protected by copyright, and the traditional ones
(Klondike, Knucklebones, Crazy Eights, Sudoku and the like) are in the public
domain. Where a game name here is also someone else's trademark, it is used
only to say what a game is after; all trademarks belong to their owners, and
nothing here is affiliated with or endorsed by them.

The puzzle packs for the games after Simon Tatham's Portable Puzzle
Collection (in `games/data/tatham/`) and the Klotski and Roll Block levels
were generated or designed for this project with its own tools, and are
covered by its MIT licence. None of Tatham's code is used.
