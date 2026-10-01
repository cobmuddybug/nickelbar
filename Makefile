PLUGIN_ID := io.github.cobmuddybug.nickelbar
PLUGIN_DIR := $(HOME)/.config/omarchy/plugins/$(PLUGIN_ID)
GAME ?= snake

.PHONY: install validate enable disable rescan restart dev clean uninstall test test-slow smoke fuzz check sync screenshots

install:
	mkdir -p "$(PLUGIN_DIR)"
	rsync -a --delete \
		--exclude '.git' \
		--exclude '.gitignore' \
		--exclude 'dev' \
		--exclude 'docs' \
		--exclude 'Makefile' \
		--exclude 'README.md' \
		--exclude 'CHANGELOG.md' \
		./ "$(PLUGIN_DIR)/"

validate: install
	omarchy plugin validate "$(PLUGIN_DIR)"

enable: validate
	omarchy plugin enable $(PLUGIN_ID)

rescan:
	omarchy-shell shell rescanPlugins

# keepLoaded plugins don't pick up code changes from a
# rescan alone — the running instance has to actually be torn down.
restart:
	omarchy restart shell

# Iterate on one game outside the live shell. GAME defaults to snake;
# `make dev GAME=2048` once that file exists. Must be `-p dev/harness`
# (a directory config) rather than `-p dev/harness/shell.qml` — see the
# comment at the top of that file for why.
dev:
	NICKELBAR_GAME=$(GAME) \
	QML_IMPORT_PATH="$(CURDIR)/dev/mock:$$QML_IMPORT_PATH" \
	QML2_IMPORT_PATH="$(CURDIR)/dev/mock:$$QML2_IMPORT_PATH" \
	qs -p dev/harness

disable:
	omarchy plugin disable $(PLUGIN_ID)

# Remove the installed copy. Scores and saves live in
# $XDG_DATA_HOME/nickelbar (usually ~/.local/share/nickelbar) and are left
# alone; delete that folder too for a clean slate.
uninstall: clean
clean:
	rm -rf "$(PLUGIN_DIR)"

# Logic tests in Node: rules, solvers and simulated play (about 30 s).
test:
	node dev/tests/run.js

# Also the slow ones: a brute-force search that every Catapult fort can
# be cleared (about half a minute).
test-slow:
	SLOW=1 node dev/tests/run.js

# Every game loaded in the real QML harness, played briefly, and its save
# round-tripped; fails on any QML error (a few minutes).
smoke:
	dev/tools/smoke.sh

# Random keys, clicks and drags into every game, saves round-tripped, any QML error fails
# (SEED=n STEPS=n to vary; about ten minutes).
fuzz:
	node dev/tools/fuzz.js

check: test smoke fuzz

# Regenerate the dev harness's id -> file map from the catalog.
sync:
	node dev/tools/sync-harness.js

# Screenshot every game into docs/screenshots/ and tile gallery.png.
screenshots:
	dev/tools/screenshots.sh
