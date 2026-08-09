#!/usr/bin/env node
/**
 * Derive the shipped brand rasters from the generated source art.
 *
 *   node tools/make-logo.mjs
 *
 * Sources live in `assets/brand/` and are committed, so this is reproducible
 * from a clean checkout. They were generated with Lynk Studio (tier `ultra`,
 * google/gemini-3-pro-image); the prompts are in `assets/brand/README.md`.
 *
 * The generators return a mark centred on an opaque black field. That reads
 * fine on this site's near-black background right up until the mark sits over
 * the hero key art, where the baked-in field shows as a rectangle. So the field
 * has to go — but a plain luminance key cannot do it: the badge's own plate is
 * dark olive gunmetal and its shadowed corners are darker than the threshold,
 * so a global key punches holes straight through the artwork.
 *
 * Instead: flood-fill inwards from the border. Only black that is *connected to
 * the outside* is background; every dark pixel enclosed by the mark survives,
 * whatever its luminance. The one-pixel ring where the fill stops gets a
 * luminance ramp so the letter glow fades out instead of ending on a hard step.
 *
 * There is no ImageMagick and no sharp in this image, and adding a native
 * dependency for four files is not worth it — Chromium is already a dependency
 * of every harness here, and its canvas does decode, key, trim and resample.
 */
import { chromium } from 'playwright';
import { launchOptions } from './chromium-launch.mjs';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { resolve, extname } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};
const dataUrl = (rel) => {
  const p = resolve(ROOT, rel);
  return `data:${MIME[extname(p)]};base64,${readFileSync(p).toString('base64')}`;
};

/**
 * `width` is the exported pixel width, cut for 2x display at the size the page
 * actually renders the asset — not the source's native size, which is square
 * 1024 regardless of how much of it is margin.
 */
const JOBS = [
  // Hero mark. Rendered at up to 560 CSS px. WebP because the same artwork is
  // 900 kB as a PNG — lossless is the wrong trade for a photographic texture,
  // and alpha-WebP has been safe since Safari 14.
  { src: 'assets/brand/lockup-square.jpg', out: 'public/img/logo-lockup.webp', width: 1120, q: 0.9 },
  // Wide lockup: the OG card and the boot screen. Rendered at up to 640 CSS px.
  { src: 'assets/brand/lockup-wide.jpg', out: 'public/img/logo-wide.webp', width: 1280, q: 0.9 },
  // Touch / PWA icon: rasterised from the shipped SVG rather than from its own
  // generated source, so the home-screen tile and the favicon cannot drift apart.
  // PNG because apple-touch-icon is the one place WebP is still not accepted, and
  // on an opaque tile because iOS composites a transparent one onto white.
  { svg: 'public/logo.svg', out: 'public/icon-512.png', width: 512, bg: '#0d1015', pad: 0.1 },
];

/**
 * Runs in page context, so it closes over nothing: the luminance cut for
 * "this is background" and the trim padding are inline below.
 */
const derive = ([src, opts]) =>
  new Promise((done, fail) => {
    const CUT = 30;
    const img = new Image();
    img.onerror = () => fail(new Error(`decode failed: ${src.slice(0, 48)}`));
    img.onload = () => {
      const { width: w, height: h } = img;
      const src2d = Object.assign(document.createElement('canvas'), { width: w, height: h })
        .getContext('2d', { willReadFrequently: true });
      src2d.drawImage(img, 0, 0);
      const id = src2d.getImageData(0, 0, w, h);
      const px = id.data;

      const lum = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) {
        // Rec.601 is enough here; we only need "is this pixel dark".
        lum[i] = (px[i * 4] * 77 + px[i * 4 + 1] * 150 + px[i * 4 + 2] * 29) >> 8;
      }

      // Flood fill the outside. Iterative — a 1024x1024 field recurses too deep.
      const bg = new Uint8Array(w * h);
      const stack = [];
      const push = (i) => {
        if (!bg[i] && lum[i] <= CUT) {
          bg[i] = 1;
          stack.push(i);
        }
      };
      for (let x = 0; x < w; x++) {
        push(x);
        push((h - 1) * w + x);
      }
      for (let y = 0; y < h; y++) {
        push(y * w);
        push(y * w + w - 1);
      }
      while (stack.length) {
        const i = stack.pop();
        const x = i % w;
        if (x > 0) push(i - 1);
        if (x < w - 1) push(i + 1);
        if (i >= w) push(i - w);
        if (i < w * (h - 1)) push(i + w);
      }

      // Alpha: 0 in the fill, a luminance ramp on the ring where it stopped so
      // the soft glow around the letters fades instead of ending on a step.
      let x0 = w;
      let y0 = h;
      let x1 = -1;
      let y1 = -1;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          let a = 255;
          if (bg[i]) {
            a = 0;
          } else {
            const edge =
              (x > 0 && bg[i - 1]) ||
              (x < w - 1 && bg[i + 1]) ||
              (y > 0 && bg[i - w]) ||
              (y < h - 1 && bg[i + w]);
            if (edge) a = Math.min(255, Math.round((lum[i] / CUT) * 255));
          }
          px[i * 4 + 3] = a;
          if (a > 8) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      }
      if (x1 < 0) return fail(new Error('nothing survived the key'));

      const pad = Math.round(Math.max(w, h) * 0.015);
      x0 = Math.max(0, x0 - pad);
      y0 = Math.max(0, y0 - pad);
      x1 = Math.min(w - 1, x1 + pad);
      y1 = Math.min(h - 1, y1 + pad);
      let cw = x1 - x0 + 1;
      let ch = y1 - y0 + 1;

      if (opts.square) {
        const s = Math.max(cw, ch);
        x0 = Math.max(0, Math.round(x0 - (s - cw) / 2));
        y0 = Math.max(0, Math.round(y0 - (s - ch) / 2));
        cw = Math.min(s, w - x0);
        ch = Math.min(s, h - y0);
      }

      src2d.putImageData(id, 0, 0);

      const outW = Math.min(opts.width, cw);
      const outH = Math.round((ch / cw) * outW);
      const out = Object.assign(document.createElement('canvas'), { width: outW, height: outH });
      const o2d = out.getContext('2d');
      o2d.imageSmoothingEnabled = true;
      o2d.imageSmoothingQuality = 'high';
      o2d.drawImage(src2d.canvas, x0, y0, cw, ch, 0, 0, outW, outH);
      const url = opts.q
        ? out.toDataURL('image/webp', opts.q)
        : out.toDataURL('image/png');
      if (!url.startsWith(opts.q ? 'data:image/webp' : 'data:image/png')) {
        return fail(new Error('encoder fell back to another format'));
      }
      done({ url, w: outW, h: outH, from: `${w}x${h}` });
    };
    img.src = src;
  });

/**
 * The icon path: no keying, no trim. An SVG has no black field to remove, and
 * its own margins are already the ones the author drew.
 */
const raster = ([src, opts]) =>
  new Promise((done, fail) => {
    const img = new Image();
    img.onerror = () => fail(new Error('svg decode failed'));
    img.onload = () => {
      const s = opts.width;
      const c = Object.assign(document.createElement('canvas'), { width: s, height: s });
      const ctx = c.getContext('2d');
      ctx.fillStyle = opts.bg;
      ctx.fillRect(0, 0, s, s);
      const inset = Math.round(s * opts.pad);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, inset, inset, s - inset * 2, s - inset * 2);
      done({ url: c.toDataURL('image/png'), w: s, h: s, from: 'svg' });
    };
    // A bare SVG data URL has no intrinsic pixel size in some paths; give the
    // decoder the size we want it rasterised at.
    img.width = opts.width;
    img.height = opts.width;
    img.src = src;
  });

const browser = await chromium.launch(launchOptions());
const page = await browser.newPage();
await page.goto('about:blank');

for (const job of JOBS) {
  const r = job.svg
    ? await page.evaluate(raster, [dataUrl(job.svg), job])
    : await page.evaluate(derive, [dataUrl(job.src), job]);
  const abs = resolve(ROOT, job.out);
  writeFileSync(abs, Buffer.from(r.url.split(',')[1], 'base64'));
  const kb = (statSync(abs).size / 1024).toFixed(0);
  console.log(`${job.out.padEnd(28)} ${r.from} -> ${r.w}x${r.h}  ${kb} kB`);
}

await browser.close();
