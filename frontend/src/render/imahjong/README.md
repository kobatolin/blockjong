# I.Mahjong-HK face pipeline

This directory contains the V2 tile-face pipeline used by `facePainter.ts`.

- `I.MahjongHK.otf` (in `src/assets/fonts/`) is the source; it is **not loaded at
  runtime**.
- `hk-contours.js` is generated from the font: each tile is split into
  independent vector contour groups, with the tile frame removed.
- `tile-segmentation.js` maps those groups to ink/red/green layers, including
  per-pip and per-bamboo color rules and flower overlays.
- `tile-renderer.js` draws the colored face in a 120×160 design space.

The game scales the design space 2× into a 256×320 face texture with an 8px
paper margin, then maps it onto the 3D tile body from `TileFactory`.

License: I.Mahjong-HK by 內木一郎, **M+ Font License**; see
`src/assets/fonts/I-MAHJONG-LICENSE.md`. The V2 pipeline is based on the
reference package `麻将牌面细节修正V2.zip`.
