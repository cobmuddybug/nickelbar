#!/usr/bin/env python3
"""Builds games/data/trivia/ from an OpenTriviaQA checkout.

    python3 dev/tools/trivia.py ~/OpenTriviaQA

OpenTriviaQA (github.com/uberspot/OpenTriviaQA, CC BY-SA 4.0) keeps one
plain-text file per category:

    #Q The question, possibly over several lines
    ^ The correct answer
    A First choice
    B Second choice ...

Output is one JSON file per topic, so the game only parses the topic it's
playing, plus index.json listing them. Each question is compact:
[question, [choices...], answerIndex]. The files mix UTF-8 and cp1252
(and a few UTF-8 quotes with their last byte mangled to '?'), so lines are
decoded one at a time; anything still garbled after that is dropped, as
are questions whose answer isn't one of the choices, and repeats.
"""
import json
import re
import sys
from pathlib import Path

# Source file -> (topic id, title). "newest" and "rated" are the site's
# buckets rather than subjects, so they only feed the Mixed pool.
TOPICS = [
    ("general", "General"),
    ("science-technology", "Science & Tech"),
    ("history", "History"),
    ("geography", "Geography"),
    ("world", "World"),
    ("people", "People"),
    ("literature", "Literature"),
    ("humanities", "Humanities"),
    ("religion-faith", "Religion & Faith"),
    ("animals", "Animals"),
    ("sports", "Sports"),
    ("hobbies", "Hobbies"),
    ("movies", "Movies"),
    ("television", "Television"),
    ("music", "Music"),
    ("celebrities", "Celebrities"),
    ("entertainment", "Entertainment"),
    ("video-games", "Video Games"),
    ("brain-teasers", "Brain Teasers"),
    ("for-kids", "For Kids"),
]
EXTRA = ["newest", "rated"]


def decode(raw):
    raw = raw.replace(b"\xe2\x80?", b"\xe2\x80\x9d")
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("cp1252", errors="replace")


def clean(s):
    s = s.replace(" ", " ").replace("\u0085", "…")
    return re.sub(r"[ \t]+", " ", s).strip()


def parse(path):
    out, cur = [], None
    def flush():
        if not cur:
            return
        q = clean("\n".join(cur["q"]).strip("\n"))
        q = re.sub(r"\n{3,}", "\n\n", q)
        choices = [clean(c) for c in cur["c"]]
        ans = clean(cur["a"] or "")
        if not q or len(choices) < 2 or ans not in choices:
            return
        if len(set(choices)) != len(choices):
            return
        text = q + "".join(choices)
        if "�" in text or "â€" in text:
            return
        out.append([q, choices, choices.index(ans)])

    for raw in path.read_bytes().split(b"\n"):
        line = decode(raw).rstrip("\r")
        if line.startswith("#Q "):
            flush()
            cur = {"q": [line[3:]], "a": None, "c": []}
        elif cur is None:
            continue
        elif line.startswith("^ "):
            cur["a"] = line[2:]
        elif re.match(r"^[A-Z] ", line) and cur["a"] is not None:
            cur["c"].append(line[2:])
        elif cur["a"] is None:
            cur["q"].append(line.strip())
    flush()
    return out


def main():
    src = Path(sys.argv[1] if len(sys.argv) > 1 else Path.home() / "OpenTriviaQA") / "categories"
    dest = Path(__file__).resolve().parents[2] / "games" / "data" / "trivia"
    dest.mkdir(parents=True, exist_ok=True)
    seen, index, total = set(), [], 0
    for name in [t[0] for t in TOPICS] + EXTRA:
        qs = []
        for q in parse(src / name):
            key = re.sub(r"\W+", "", q[0].lower())
            if key in seen:
                continue
            seen.add(key)
            qs.append(q)
        (dest / (name + ".json")).write_text(json.dumps(qs, ensure_ascii=False, separators=(",", ":")) + "\n")
        title = dict(TOPICS).get(name)
        index.append({"id": name, "title": title, "count": len(qs)} if title else {"id": name, "count": len(qs), "hidden": True})
        total += len(qs)
    (dest / "index.json").write_text(json.dumps({"total": total, "topics": index}, indent=1) + "\n")
    print(total, "questions in", len(index), "files ->", dest)


if __name__ == "__main__":
    main()
