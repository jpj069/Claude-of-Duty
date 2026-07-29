/**
 * Shared Chromium launch options for every screenshot / probe harness.
 *
 * The harnesses all used to hard-pin `--use-angle=metal`. That backend only
 * exists on macOS; anywhere else Chromium brings up no GL backend at all and
 * the run dies on a null WebGL context. Since the harnesses are what enforce
 * the "screenshot or it didn't happen" gate, pinning metal quietly made that
 * gate macOS-only — it could not run in CI or in a container.
 *
 * Resolution order here:
 *   darwin  -> pin metal, exactly as before.
 *   else    -> let Chromium choose. Real GPU when the box has one, SwiftShader
 *              when it does not. `--enable-unsafe-swiftshader` only matters in
 *              that fallback: without it newer Chromium refuses to expose WebGL
 *              over the software rasteriser.
 *
 * `CAPTURE_CHROME` overrides the browser binary, for images that preinstall
 * Chromium at a revision the bundled playwright does not match.
 *
 * Note that a SwiftShader fallback is correctness-preserving but very slow —
 * heavy GPU-side work (the material forge's 19 procedural 1K PBR sets, the full
 * render pipeline's 18 passes) can take orders of magnitude longer than on a
 * real GPU. Prefer the per-subsystem previews when there is no hardware.
 */
import { platform } from 'node:os';

const angleArgs = platform() === 'darwin' ? ['--use-angle=metal'] : ['--enable-unsafe-swiftshader'];

/**
 * @param {string[]} extra  harness-specific flags appended after the shared set
 * @returns launch options to spread into `chromium.launch({ ... })`
 */
export const launchOptions = (extra = []) => ({
  headless: true,
  ...(process.env.CAPTURE_CHROME ? { executablePath: process.env.CAPTURE_CHROME } : {}),
  args: [
    ...angleArgs,
    '--ignore-gpu-blocklist',
    '--enable-gpu-rasterization',
    '--force-color-profile=srgb',
    '--hide-scrollbars',
    ...extra,
  ],
});
