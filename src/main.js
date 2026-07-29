import { Engine } from './core/engine.js';
import { createConfig } from './core/config.js';

import { RenderSystem } from './render/index.js';
import { MaterialSystem } from './materials/index.js';
import { SkySystem } from './sky/index.js';
import { WorldSystem } from './world/index.js';
import { PhysicsSystem } from './physics/index.js';
import { PlayerSystem } from './player/index.js';
import { WeaponSystem } from './weapons/index.js';
import { FxSystem } from './fx/index.js';
import { AiSystem } from './ai/index.js';
import { UiSystem } from './ui/index.js';
import { AudioSystem } from './audio/index.js';

import { installShotApi } from './dev/shots.js';
import { prewarm } from './core/prewarm.js';

const params = new URLSearchParams(location.search);
const capture = params.get('capture') === '1';
// Deterministic shutter for the pixel gate: the engine does not schedule its own
// frames, the driver advances exactly N of them through window.__PUMP__. Opt-in,
// because tools that measure real frame pacing (tools/perf.mjs) need the loop to
// free-run. See the long comment in src/dev/shots.js.
const lockstep = capture && params.get('lockstep') === '1';

const config = createConfig({
  quality: params.get('q') ?? 'ultra',
  deterministic: capture,
});

const canvas = document.getElementById('game');

const engine = new Engine({ canvas, config });

// Registration order is irrelevant — Registry topo-sorts on static deps.
engine
  .add(RenderSystem)
  .add(MaterialSystem)
  .add(SkySystem)
  .add(WorldSystem)
  .add(PhysicsSystem)
  .add(PlayerSystem)
  .add(WeaponSystem)
  .add(FxSystem)
  .add(AiSystem)
  .add(UiSystem)
  .add(AudioSystem);

/**
 * Drive the inline boot overlay in play/index.html.
 *
 * Subsystem names are mapped to plain language: "generating surface textures"
 * says what the wait is for, where "materials" reads as a progress-bar label
 * nobody outside this repo can interpret. Absent overlay (capture harness, the
 * subsystem preview pages) is fine — every call no-ops.
 */
const bootUi = (() => {
  const root = document.getElementById('boot');
  if (!root) return { step: () => {}, progress: () => {}, done: () => {}, fail: () => {} };
  const fill = document.getElementById('boot-fill');
  const step = document.getElementById('boot-step');
  const count = document.getElementById('boot-count');
  const elapsed = document.getElementById('boot-elapsed');
  const slow = document.getElementById('boot-slow');

  /**
   * Elapsed-time readout, started as soon as this module runs.
   *
   * The progress bar alone answers "how far", not "is it moving" — and a single
   * subsystem here can hold for tens of seconds (ai material prewarm is ~45 s
   * through a software rasteriser), during which a bar that does not budge looks
   * exactly like a hang. A ticking clock is the cheapest possible proof of life.
   *
   * `SLOW_AFTER` then says out loud that a long wait is expected rather than
   * broken, because the honest failure mode here is a visitor closing the tab at
   * 20 seconds believing it crashed.
   */
  const t0 = performance.now();
  const SLOW_AFTER = 20_000;
  let timer = setInterval(() => {
    const ms = performance.now() - t0;
    if (elapsed) elapsed.textContent = `${(ms / 1000).toFixed(1)}s`;
    if (slow && ms > SLOW_AFTER) slow.hidden = false;
  }, 100);
  const LABEL = {
    render: 'starting renderer',
    materials: 'generating surface textures',
    sky: 'computing atmosphere',
    world: 'building the street',
    physics: 'indexing collision',
    player: 'wiring movement',
    weapons: 'machining weapons',
    fx: 'seeding effects',
    ai: 'dressing soldiers',
    ui: 'drawing the HUD',
    audio: 'synthesising audio',
  };
  return {
    step: (id) => {
      if (step) step.textContent = LABEL[id] ?? id;
    },
    progress: (done, total) => {
      if (fill) fill.style.width = `${Math.round((done / total) * 100)}%`;
      if (count) count.textContent = `${done}/${total}`;
    },
    done: () => {
      clearInterval(timer);
      timer = null;
      if (fill) fill.style.width = '100%';
      if (step) step.textContent = 'ready';
      if (elapsed) elapsed.textContent = `${((performance.now() - t0) / 1000).toFixed(1)}s`;
      if (slow) slow.hidden = true;
      root.classList.add('done');
      document.body.classList.add('booted');
      // Removed rather than left hidden: it covers the canvas, and a stray
      // pointer-events regression on it would silently eat every click.
      setTimeout(() => root.remove(), 600);
    },
    /** Boot threw: drop the overlay so the error is not hidden behind it, and
        stop the clock — otherwise it keeps ticking against a detached node. */
    fail: () => {
      clearInterval(timer);
      timer = null;
      root.remove();
    },
  };
})();

engine.events.on('boot:system', ({ id }) => bootUi.step(id));
engine.events.on('boot:progress', ({ done, total }) => bootUi.progress(done, total));

try {
  await engine.init();
} catch (err) {
  console.error('[boot] init failed', err);
  bootUi.fail();
  document.body.insertAdjacentHTML(
    'beforeend',
    `<pre style="position:fixed;inset:0;padding:2rem;color:#f66;background:#000;
       font:12px/1.5 ui-monospace,monospace;overflow:auto;z-index:9999;white-space:pre-wrap">
BOOT FAILURE\n\n${err.stack ?? err.message}</pre>`
  );
  throw err;
}

const shotApi = installShotApi(engine, { capture, lockstep });

// Compile every shader permutation before the frame loop starts. Measured: without
// this, 86 programs compile lazily during play, up to 30 on one frame, producing
// 3.1-3.9 SECOND stalls. See src/core/prewarm.js.
//
// ON BY DEFAULT since the capture path was made frame-deterministic; opt out with
// `?prewarm=0`. It is now PROVEN pixel-neutral: `tools/baseline.mjs` with
// `--query=prewarm=0` vs `--query=prewarm=1` reports identical:true on all 11
// shots (0 changed pixels, maxDelta 0). The two things that previously made the
// ~1.4 s pre-warm spend look like a visual change were both boot-duration
// couplings OUTSIDE the subsystems: (1) the shutter frame index was latency-bound
// because the engine kept stepping through the driver's round trips — fixed by
// lockstep in src/dev/shots.js; (2) `will-change: transform` on the compass strip
// cached a composited-layer raster taken at a wall-clock-dependent moment — fixed
// in src/ui/style.js.
const warmup = params.get('prewarm') === '0' ? { ok: false, reason: 'disabled by ?prewarm=0' } : await prewarm(engine);
console.info('[boot] prewarm', warmup);
window.__PREWARM__ = warmup;

engine.start();

// Capture harness handshake: only flag ready once a frame has actually landed.
//
// BOOT_FRAMES is deliberately a frame COUNT, not a rAF race. In lockstep mode the
// engine has no loop of its own, so we hand-pump exactly this many frames and only
// then raise __READY__; the shot is therefore always applied at engine frame 3, no
// matter how long boot (or pre-warm) took in wall-clock terms.
const BOOT_FRAMES = 3;
if (lockstep) {
  await shotApi.pump(BOOT_FRAMES);
  window.__READY__ = true;
  bootUi.done();
} else {
  let warm = 0;
  const readyProbe = () => {
    if (++warm >= BOOT_FRAMES) {
      window.__READY__ = true;
      // Same gate as __READY__ on purpose: the overlay must not lift until a
      // frame has really been drawn, or it reveals one black canvas frame.
      bootUi.done();
      return;
    }
    requestAnimationFrame(readyProbe);
  };
  requestAnimationFrame(readyProbe);
}

window.__ENGINE__ = engine;

if (import.meta.hot) {
  import.meta.hot.dispose(() => engine.dispose());
}
