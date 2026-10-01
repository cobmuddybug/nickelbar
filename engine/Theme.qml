import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons

// Short names for the theme roles games actually need. Every color a game
// draws with should come from here (or straight from Color/Style) rather
// than a literal, so a theme switch repaints the board with no extra code.
QtObject {
  id: root

  readonly property color background: Color.menu.background
  readonly property color foreground: Color.menu.text
  readonly property color border: Color.menu.border
  readonly property color scrim: Color.menu.scrim
  readonly property color accent: Color.accent
  readonly property color danger: Color.urgent
  readonly property color highlight: Color.menu.selectedText
  readonly property color selectedBackground: Color.menu.selectedBackground
  readonly property color dim: Qt.rgba(foreground.r, foreground.g, foreground.b, 0.45)
  readonly property color faint: Qt.rgba(foreground.r, foreground.g, foreground.b, 0.18)

  readonly property string fontFamily: Style.font.menuFamily

  // ---- the theme's own palette -------------------------------------
  // Color.qml only exposes foreground/background/accent/urgent/muted, so
  // read the named ANSI colours from colors.toml directly. NICKELBAR_COLORS
  // points the dev harness at any theme's file.
  property var palette: ({})
  readonly property string colorsPath: Quickshell.env("NICKELBAR_COLORS")
    || (Quickshell.env("HOME") + "/.local/state/omarchy/current/theme/colors.toml")

  property FileView colorsFile: FileView {
    path: root.colorsPath
    watchChanges: true
    printErrors: false
    onLoaded: root.palette = root.parsePalette(text())
    onFileChanged: reload()
  }
  // A shell theme switch repaints Color first; re-read the file when it does.
  property Connections colorWatch: Connections {
    target: Color
    function onAccentChanged() { root.reloadSoon.restart() }
    function onBackgroundChanged() { root.reloadSoon.restart() }
  }
  property Timer reloadSoon: Timer { interval: 150; onTriggered: colorsFile.reload() }

  function parsePalette(raw) {
    var out = {}
    var lines = String(raw || "").split("\n")
    for (var i = 0; i < lines.length; ++i) {
      var m = lines[i].match(/^\s*([A-Za-z0-9_-]+)\s*=\s*["']?(#[0-9A-Fa-f]{6})/)
      if (m) out[m[1]] = m[2]
    }
    // Themes that only define color0..15 still get the named entries.
    var ansi = { red: 1, green: 2, yellow: 3, blue: 4, magenta: 5, cyan: 6 }
    for (var k in ansi) {
      if (!out[k] && out["color" + ansi[k]]) out[k] = out["color" + ansi[k]]
      if (!out["bright_" + k] && out["color" + (ansi[k] + 8)]) out["bright_" + k] = out["color" + (ansi[k] + 8)]
    }
    return out
  }

  // ---- colour maths (OKLab, so "distinct" means distinct to the eye) ----
  function lin(v) { return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
  function lab(c) {
    var r = lin(c.r), g = lin(c.g), b = lin(c.b)
    var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
    var m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    var s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s]
  }
  function dist(a, b) {
    var x = lab(a), y = lab(b)
    return Math.sqrt((x[0] - y[0]) * (x[0] - y[0]) + (x[1] - y[1]) * (x[1] - y[1]) + (x[2] - y[2]) * (x[2] - y[2]))
  }
  function fromHex(h) { return Qt.color(h) }

  // Candidate colours in contrast order: accent, then the theme's named
  // colours, each followed by its bright variant. Missing entries are skipped.
  readonly property var candidates: {
    var p = palette, out = [accent]
    var names = ["blue", "yellow", "green", "orange", "magenta", "cyan", "red", "brown"]
    for (var i = 0; i < names.length; ++i) if (p[names[i]]) out.push(fromHex(p[names[i]]))
    for (var j = 0; j < names.length; ++j) if (p["bright_" + names[j]]) out.push(fromHex(p["bright_" + names[j]]))
    return out
  }

  // The old behaviour (accent hue rotated, clamped), now only used to fill
  // slots the palette can't: a grey or sparse theme.
  function rotated(step, n) {
    var h = accent.hslHue, s = accent.hslSaturation, l = accent.hslLightness
    if (h < 0) h = 0.58
    // stay inside what this theme itself spans rather than forcing neon
    var span = spanOf()
    s = Math.max(span.sMin, Math.min(span.sMax, Math.max(0.3, s)))
    l = Math.max(span.lMin, Math.min(span.lMax, l))
    return Qt.hsla((h + step) % 1, s, l, 1)
  }
  // Saturation / lightness range of the theme's chromatic colours.
  function spanOf() {
    var sMin = 1, sMax = 0, lMin = 1, lMax = 0, sSum = 0, lSum = 0, n = 0
    for (var i = 0; i < candidates.length; ++i) {
      var c = candidates[i]
      if (c.hslSaturation < 0.12) continue
      sMin = Math.min(sMin, c.hslSaturation); sMax = Math.max(sMax, c.hslSaturation)
      lMin = Math.min(lMin, c.hslLightness); lMax = Math.max(lMax, c.hslLightness)
      sSum += c.hslSaturation; lSum += c.hslLightness; n++
    }
    if (n === 0) return { sMin: 0.42, sMax: 0.8, lMin: 0.55, lMax: 0.72, sMean: 0.6, lMean: 0.64 }
    return { sMin: sMin, sMax: Math.max(sMax, sMin + 0.1), lMin: Math.max(lMin, 0.3), lMax: Math.min(Math.max(lMax, lMin + 0.1), 0.8), sMean: sSum / n, lMean: Math.max(0.4, lSum / n) }
  }

  // n colours that are all clearly different from each other and readable
  // on `background`. Palette entries first (so the board looks like the
  // theme); any that clash with an earlier pick are skipped; if the palette
  // runs out, extra hues are derived inside the theme's own S/L range.
  // `minGap` is the OKLab distance two picks must keep (default 0.10).
  function categorical(n, minGap) {
    var gap = minGap === undefined ? 0.10 : minGap
    var out = [], pool = candidates
    function ok(c) {
      if (Math.abs(lab(c)[0] - lab(background)[0]) < 0.18) return false
      for (var k = 0; k < out.length; ++k) if (dist(c, out[k]) < gap) return false
      return true
    }
    for (var i = 0; i < pool.length && out.length < n; ++i) if (ok(pool[i])) out.push(pool[i])
    // derived fill: the theme's average saturation/lightness (so extras are
    // as muted as the theme), at the midpoint of the widest gap between hues
    var span = spanOf(), tries = 0
    while (out.length < n && tries < 24) {
      var hues = []
      for (var q = 0; q < out.length; ++q) if (out[q].hslSaturation >= 0.12) hues.push(out[q].hslHue)
      if (hues.length === 0) hues.push(accent.hslHue < 0 ? 0.58 : accent.hslHue)
      hues.sort(function(x, y) { return x - y })
      var best = 0, at = hues[0] + 0.5
      for (var w = 0; w < hues.length; ++w) {
        var nxt = w + 1 < hues.length ? hues[w + 1] : hues[0] + 1
        if (nxt - hues[w] > best) { best = nxt - hues[w]; at = hues[w] + best / 2 }
      }
      var wob = (tries % 3 - 1) * 0.06
      var c = Qt.hsla(at % 1, span.sMean, Math.max(0.3, Math.min(0.8, span.lMean + wob)), 1)
      if (ok(c)) out.push(c)
      else out.push(Qt.hsla((at + 0.03 * (tries + 1)) % 1, span.sMean, Math.max(0.3, Math.min(0.8, span.lMean - wob)), 1))
      tries++
    }
    while (out.length < n) out.push(rotated(out.length / n, n))   // last resort
    return out
  }

  // Short categorical palette for ordinary games; tone(i) wraps.
  readonly property var tones: categorical(6)

  // A colour by its name in the theme's palette ("green", "bright_yellow", ...)
  // for things that have to look like what they are (grass, fuel, fire), even
  // when `tones` skipped it for being close to the accent. Falls back to a
  // tone if the theme doesn't define it.
  function named(name, fallbackTone) { return palette[name] ? fromHex(palette[name]) : tone(fallbackTone || 0) }

  function tone(i) { return tones[((i % tones.length) + tones.length) % tones.length] }
  function withAlpha(c, a) { return Qt.rgba(c.r, c.g, c.b, a) }
}
