# Brand sources

The generator output the shipped marks are derived from. Nothing here is served —
`node tools/make-logo.mjs` keys, trims and resamples these into `public/`:

| source | → | shipped |
| --- | --- | --- |
| `lockup-square.jpg` | | `public/img/logo-lockup.webp` — hero |
| `lockup-wide.jpg` | | `public/img/logo-wide.webp` — boot screen, OG card |
| `badge.jpg` | | `public/icon-512.png` — apple-touch icon |

`public/logo.svg` is not derived from any of these. It is drawn by hand to the
same brand — shield, cloud, three stars — because a downscale of the raster is
mush below roughly 48 px and the favicon has to hold at 16.

They are committed rather than re-fetched so a clean checkout can rebuild the
marks. Generated with Lynk Studio, tier `ultra` (`google/gemini-3-pro-image`),
2026-08-09, from prompts asking for a stacked `CLAUDE / OF / DUTY` wordmark in
heavy condensed military block letterforms cut from weathered concrete, over a
chipped olive-drab hexagonal shield carrying the cloud emblem and three stars.

Two things worth knowing before regenerating:

- **Check the spelling at full size.** A model asked for lettering returns
  lettering that drifts — a dropped stroke, a near-miss letterform, kerning that
  collapses two characters into one. Every candidate here was read letter by
  letter before it was kept, and one of the three generated in the same batch
  was discarded for a different reason (a cloud with no face, off-brand).
- **The marks arrive on opaque black.** They have to be keyed before use, and
  the key cannot be a luminance threshold — see the note in `tools/make-logo.mjs`.
