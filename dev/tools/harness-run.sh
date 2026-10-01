#!/bin/bash
# Runs one game headless in the dev harness: dev/tools/harness-run.sh GAME
# "SCRIPT" [OUT.png]. Prints the harness's status line and any QML errors.
# See the comment in dev/harness/shell.qml for the script step codes.
# NICKELBAR_LOAD=save.json starts from that save instead of a fresh game.
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
NICKELBAR_GAME="$1" NICKELBAR_LOAD="${NICKELBAR_LOAD:-}" QML_XHR_ALLOW_FILE_READ=1 NICKELBAR_SCRIPT="$2" NICKELBAR_SHOT="${3:-/dev/null}" NICKELBAR_ROOT="$ROOT" \
QML_IMPORT_PATH="$ROOT/dev/mock" QML2_IMPORT_PATH="$ROOT/dev/mock" \
QT_QPA_PLATFORM=offscreen QT_QUICK_BACKEND=software \
timeout 60 qs -p dev/harness 2>&1 | grep -E 'NICKELBAR_STATUS|Error|error:|TypeError|ReferenceError|is not a function|Cannot read' | grep -v 'QFont'
