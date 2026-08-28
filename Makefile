# ── Arlo Doc – top-level Makefile ─────────────────────────────────────────
#
# Usage:
#   make              – build the desktop app (default)
#   make build        – full production build + package (DMG / NSIS)
#   make bundle       – compile only (electron-vite, no packager)
#   make dev          – start the electron dev server
#   make test         – run all tests across the monorepo
#   make typecheck    – run TypeScript type checks across the monorepo
#   make clean        – remove all build artefacts

PNPM        := pnpm
DESKTOP_DIR := apps/desktop

.PHONY: all build bundle dev test typecheck clean

all: build

## build ─ compile + package into dist-electron/ (DMG on macOS, NSIS on Windows)
build:
	$(PNPM) --filter @arlo-doc/desktop build

## bundle ─ compile only with electron-vite (skips electron-builder packaging)
bundle:
	cd $(DESKTOP_DIR) && npx electron-vite build

## dev ─ launch the electron app with hot reload
dev:
	$(PNPM) --filter @arlo-doc/desktop dev

## test ─ run the full monorepo test suite
test:
	$(PNPM) run test

## typecheck ─ type-check the entire monorepo
typecheck:
	$(PNPM) run typecheck

## clean ─ remove compiled output and packaged artefacts
clean:
	rm -rf $(DESKTOP_DIR)/out
	rm -rf $(DESKTOP_DIR)/dist-electron
	@echo "Cleaned build artefacts."
