import { chromium } from 'playwright';
import { launchOptions } from './chromium-launch.mjs';
import { GAME_PATH } from './game-url.mjs';
const PORT=5402;
const browser = await chromium.launch(launchOptions(['--mute-audio']));
const page = await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
await page.goto(`http://127.0.0.1:${PORT}${GAME_PATH}?capture=1`,{waitUntil:'domcontentloaded',timeout:90000});
await page.waitForFunction('window.__READY__ === true',null,{timeout:90000});
const shot=process.argv[2]??'interior';
await page.evaluate((n)=>window.__APPLY_SHOT__(n,{grabFrame:60}),shot);
await page.evaluate((n)=>new Promise(d=>{let i=0;const t=()=>(++i>=n?d():requestAnimationFrame(t));requestAnimationFrame(t)}),60);
for(const m of ['ao','contact','skyvis']){
  await page.evaluate((mm)=>{window.__ENGINE__.ctx.get('render').debugView=mm;},m);
  await page.evaluate((n)=>new Promise(d=>{let i=0;const t=()=>(++i>=n?d():requestAnimationFrame(t));requestAnimationFrame(t)}),8);
  await page.screenshot({path:`/tmp/dbg-${shot}-${m}.png`});
}
await browser.close();
console.log('ok');
