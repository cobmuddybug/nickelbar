#!/usr/bin/env python3
"""Builds games/data/words.json for Five Letters.

    Requires the wordfreq Python package (from PyPI).
    curl -LO https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt
    python3 dev/tools/words.py enable1.txt

Guesses: every five-letter word in ENABLE (public domain). Answers: the
common ones, by wordfreq's Zipf frequency (wordfreq's data is CC BY-SA
4.0), minus plain plurals and past tenses (the answer is never just
"another word + s") and a short blocklist of slurs and crude words.
"""
import json
import sys
from pathlib import Path

import wordfreq

MIN_ZIPF = 3.0
BLOCK = set("""
bitch whore sluts slutty dildo penis pussy boner horny prick twats semen fucks
shits turds cunts negro spick kikes dykes homos fagot faggy gooks wanks titty
booby bimbo hussy skank sissy lesbo porno pubes pubic queer nazis rapes raped
honky gringo coons chink slope tramp pervy perve sperm balls wench butts
""".split())


def main():
    src = Path(sys.argv[1] if len(sys.argv) > 1 else "enable1.txt")
    words = {w.strip() for w in src.read_text().split() if w.strip().isalpha()}
    five = sorted(w for w in words if len(w) == 5)

    def derived(w):
        if w.endswith("s") and not w.endswith("ss") and (w[:-1] in words or (w.endswith("es") and w[:-2] in words)):
            return True
        return w.endswith("ed") and (w[:-2] in words or w[:-1] in words)

    answers = sorted(w for w in five
                     if w not in BLOCK and not derived(w) and wordfreq.zipf_frequency(w, "en") >= MIN_ZIPF)
    dest = Path(__file__).resolve().parents[2] / "games" / "data" / "words.json"
    dest.write_text(json.dumps({"answers": answers, "guesses": five}, separators=(",", ":")) + "\n")
    print(len(answers), "answers,", len(five), "guesses ->", dest)


if __name__ == "__main__":
    main()
