.pragma library

// Splits a game's one-line help text ("ARROWS move · SPACE act · the goal is...")
// into key rows and plain notes, so the help screen can show them as a list.
// A key row starts with key names in capitals (optionally after hold / tap /
// press / type) followed by a short description; anything else is a note.

var VERBS = { hold: 1, tap: 1, press: 1, type: 1, HOLD: 1, TAP: 1, PRESS: 1, TYPE: 1 }
var JOINERS = { or: 1, and: 1, then: 1, "/": 1, "+": 1, ",": 1 }

var STOP = { AI: 1, CPU: 1, TNT: 1, UFO: 1, HP: 1, WALLS: 1, WRAP: 1, ONE: 1 }

function isKeyToken(w) {
  if (STOP[w] || /^\d{2,}$/.test(w)) return false
  return isKey(w)
}

function isKey(w) { return /^[A-Z0-9<>.+\-\/\[\]*,]+$/.test(w) && !/^[A-Z]{5,}$/.test(w) || /^(ARROWS|ENTER|SPACE|ESC|TAB|BACKSPACE|HJKL|LEFT|RIGHT|DOWN|UP)([\/,]|$)/.test(w) }

function keyRow(seg) {
  var words = seg.split(/\s+/), i = 0, key = []
  if (words.length && VERBS[words[0]]) { key.push(words[0]); i = 1 }
  var got = false
  while (i < words.length) {
    var w = words[i]
    if (isKeyToken(w)) { key.push(w); got = true; ++i; continue }
    if (got && JOINERS[w] && i + 1 < words.length && (isKeyToken(words[i + 1]) || JOINERS[words[i + 1]])) { key.push(w); ++i; continue }
    break
  }
  if (!got) return null
  var desc = words.slice(i).join(" ")
  if (!desc || desc.length > 64) return null
  // A lone capital letter starting a sentence ("A stomped Shellback...") is not a key.
  if (key.length === 1 && /^[A-Z]$/.test(key[0]) && /^[a-z]/.test(desc) === false) return null
  if (key.length === 1 && key[0] === "A" && desc.length > 30) return null
  return { key: key.join(" "), desc: desc }
}

function parse(text) {
  var segs = String(text || "").split(/\s+·\s+/).map(function(s) { return s.trim() }).filter(function(s) { return s.length })
  var keys = [], notes = []
  segs.forEach(function(s) {
    var r = keyRow(s)
    if (r) keys.push(r); else notes.push(s)
  })
  return { keys: keys, notes: notes }
}
