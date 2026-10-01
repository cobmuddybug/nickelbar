import QtQuick

// The harder Zen Geometry, after the original Bejeweled. Same board and
// pieces as ZenGeometry.qml (which holds all the logic); the only
// difference is `classic`. It's a separate catalog entry rather than a key
// inside Zen so each mode keeps its own best score and its own saved game.
ZenGeometry {
  gameId: "zenclassic"
  title: "GEOMETRY CLASSIC"
  classic: true
}
