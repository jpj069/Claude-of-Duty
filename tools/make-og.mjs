#!/usr/bin/env node
/**
 * Compose the 1200x630 Open Graph card.
 *
 * Built from a real in-engine still with the wordmark typeset locally, rather
 * than generated: a model asked for text produces text that drifts — near-miss
 * letterforms and wrong kerning — and this image is the first thing anyone sees
 * of the project in a link preview.
 *
 *   node tools/make-og.mjs
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const still = readFileSync(resolve(ROOT, 'public/img/still-street.jpg')).toString('base64');

const html = `<!doctype html><meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:1200px; height:630px; overflow:hidden;
         font-family:"Inter","Helvetica Neue",Arial,sans-serif; background:#0b0d10; }
  .card { position:relative; width:1200px; height:630px; }
  .shot { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
  .veil { position:absolute; inset:0;
    background:
      radial-gradient(80% 70% at 30% 45%, rgba(11,13,16,.35) 0%, rgba(11,13,16,.9) 75%),
      linear-gradient(90deg, rgba(11,13,16,.94) 0%, rgba(11,13,16,.55) 55%, rgba(11,13,16,.8) 100%); }
  .inner { position:absolute; inset:0; padding:74px 78px;
           display:flex; flex-direction:column; justify-content:center; gap:22px; }
  .eyebrow { font:600 17px/1 ui-monospace,Menlo,monospace; letter-spacing:.3em; color:#ffc400; }
  .mark { font-weight:200; font-size:94px; line-height:.92; letter-spacing:.05em;
          color:#f4f6f8; text-transform:uppercase; }
  .mark b { display:block; font-weight:200; color:#ffc400; }
  .sub { max-width:26ch; font-size:26px; line-height:1.35; font-weight:300; color:#c3cad3; }
  .rule { width:78px; height:3px; background:#ffc400; }
</style>
<div class="card">
  <img class="shot" src="data:image/jpeg;base64,${still}">
  <div class="veil"></div>
  <div class="inner">
    <div class="eyebrow">BROWSER FPS &middot; WEBGL2</div>
    <div class="mark">Claude<b>of Duty</b></div>
    <div class="rule"></div>
    <div class="sub">A shooter that ships no art assets. Everything is generated at load time.</div>
  </div>
</div>`;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? undefined,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
const buf = await page.screenshot({ type: 'jpeg', quality: 88 });
writeFileSync(resolve(ROOT, 'public/img/og.jpg'), buf);
console.log(`og.jpg  ${(buf.length / 1024).toFixed(0)} KB`);
await browser.close();
