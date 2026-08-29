# Arlo Doc app icon

Sources for `build/icon.icns`, `build/icon.ico` and `build/icon.png`, which
`electron-builder.yml` picks up out of `directories.buildResources`.

## The mark

A page with a folded corner and the Arlo **A** monogram set inside it — the hub
mark from arlo-ai.app, on a document. Flat `#5856D6`, white glyph, round caps and
joins, tile radius 25%: the same construction as the Arlo Rust, Arlo Lite and
AG-UI marks, so the four read as one family.

The glyph is drawn on a 24 grid. The page body and fold are the same paths the
Arlo AI site uses for its "Docs" icon:

```
page  M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z
fold  M14 2v6h6
apex  M8.4 18.3 12 9.9l3.6 8.4
bar   M9.5 15.7h5
```

The paths are duplicated across the variant files so each one opens standalone in
a design tool. **Change one, change all of them.**

## Files

| File | Tile | Used for |
|---|---|---|
| `icon.svg` | full-bleed 1024, radius 256 | `icon.png`, Linux, store listings |
| `icon-macos.svg` | 824 at (100,100), radius 185.4, shadow baked | `.icns`, 64px and up |
| `icon-macos-small.svg` | same tile, heavier strokes | `.icns`, 16pt and 32pt slots |
| `icon-windows.svg` | 944 at (40,40), radius 236, no shadow | `.ico`, 48px and up |
| `icon-windows-small.svg` | same tile, heavier strokes | `.ico`, 16/24/32px |
| `icon-mono.svg` | transparent, black glyph | macOS menu-bar template image |
| `mark.svg` | 28 grid | web mark, sibling of the three project marks |

macOS masks nothing and adds no shadow, so both are baked in on Apple's Big Sur
grid. Windows masks nothing either but expects a tighter tile and adds no shadow
of its own — hence two framings of one drawing.

The `*-small.svg` variants only thicken the strokes. At 32px the monogram's
2.0-wide strokes downsample into a grey smudge; at 2.5 they hold.

## Rebuilding

```bash
brew install librsvg      # one-time
./build-icons.sh
```

Writes `icon.icns` (10 slots), `icon.ico` (7 PNG-compressed entries, 16→256) and
`icon.png` (512) into `build/`. `pack-ico.py` is Python standard library only, so
nothing beyond `rsvg-convert` is needed.

## Provenance

Designed against the Arlo AI design system in the `arlo-web` repo
(`assets/arlo-doc/`), where three other directions are kept as concepts. This is
direction **B**, the monogram page.
