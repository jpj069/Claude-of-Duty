# Brand sources

The generator output the shipped marks are derived from. Nothing here is served —
`node tools/make-logo.mjs` keys, trims and resamples these into `public/`:

| source | → | shipped |
| --- | --- | --- |
| `lockup-square.jpg` | | `public/img/logo-lockup.webp` — hero |
| `lockup-wide.jpg` | | `public/img/logo-wide.webp` — boot screen, OG card |

`public/logo.svg` is not derived from either. It is drawn by hand — the amber
placard with the delta knocked out of it — because a downscale of the raster is
mush below roughly 48 px and the favicon has to hold at 16. `public/icon-512.png`
is rasterised from that same SVG by the same tool, so the home-screen tile and the
favicon cannot drift apart.

The sources are committed rather than re-fetched so a clean checkout can rebuild
the marks. Generated with Lynk Studio, tier `ultra` (`google/gemini-3-pro-image`),
2026-08-09: a flat two-colour stencil wordmark, bone over amber and slightly out
of register, with the unit emblem — a delta whose lower half dissolves into a
triangular mesh.

The emblem is not decoration. This game ships no art assets and builds every
surface out of generated geometry at load time, so a mark made of mesh triangles
is both insignia and an accurate description.

Three things worth knowing before regenerating:

- **Check the spelling at full size.** A model asked for lettering returns
  lettering that drifts — a dropped stroke, a near-miss letterform, kerning that
  collapses two characters into one. Every candidate kept here was read letter by
  letter before it was used.
- **State the negatives, or the model invents context.** Asked for a logo on
  black, it has returned the mark on white, and once returned a screenshot of a
  drawing app with a toolbar and a layers panel. The prompts here name the
  background rule and the absent elements explicitly for that reason.
- **The marks arrive on opaque black.** They have to be keyed before use, and the
  key cannot be a luminance threshold — see the note in `tools/make-logo.mjs`.

An earlier round put a smiling cloud on a shield here. It came in through a
reference image and was carried forward unexamined; it is not this project's mark
and it leaned on an identity that is not ours to use. Do not reintroduce it.
