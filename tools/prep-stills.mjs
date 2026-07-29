#!/usr/bin/env node
/**
 * Re-encode captured PNG stills to web-sized JPEGs for the landing page.
 *
 * The capture harness writes lossless PNG, which is right for the pixel gate and
 * wrong for a landing page — five 1.3 MB stills is 6.5 MB of hero imagery. There
 * is no ImageMagick in the build environment, so the encode goes through the
 * headless Chromium that is already a dependency: draw the PNG to a canvas and
 * read it back as JPEG.
 *
 *   node tools/prep-stills.mjs --src=/path/to/shots --out=public/img --width=1600
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve, basename, extname } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  })
);

const SRC = resolve(args.src ?? 'shots');
const OUT = resolve(args.out ?? 'public/img');
const WIDTH = Number(args.width ?? 1600);
const QUALITY = Number(args.quality ?? 0.82);

mkdirSync(OUT, { recursive: true });
const files = readdirSync(SRC).filter((f) => extname(f).toLowerCase() === '.png');
if (!files.length) {
  console.error(`no PNGs in ${SRC}`);
  process.exit(1);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? undefined,
  args: ['--no-sandbox'],
});
const page = await browser.newPage();

for (const f of files) {
  const b64 = readFileSync(resolve(SRC, f)).toString('base64');
  const jpeg = await page.evaluate(
    async ([data, width, quality]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${data}`;
      await img.decode();
      const scale = Math.min(1, width / img.naturalWidth);
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', quality).split(',')[1];
    },
    [b64, WIDTH, QUALITY]
  );
  const name = `${basename(f, '.png')}.jpg`;
  const buf = Buffer.from(jpeg, 'base64');
  writeFileSync(resolve(OUT, name), buf);
  console.log(`${f} -> ${name}  ${(buf.length / 1024).toFixed(0)} KB`);
}

await browser.close();
