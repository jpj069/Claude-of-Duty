/**
 * Where the game lives, in one place.
 *
 * The game used to be served at `/`. When the landing page took that slot and the
 * game moved to `/play/`, every harness that hard-coded the root kept "working" —
 * it loaded the landing page, waited for `window.__READY__` on a page that never
 * boots an engine, and failed on a 30-minute timeout with no shots and no clue.
 * Fourteen call sites across tools/ and src/ had the path baked in.
 *
 * So the path is a constant now, and the next move only has to change this file.
 * Anything that drives the actual game must build its URL through here.
 */
export const GAME_PATH = '/play/';

/**
 * Absolute dev-server URL for the game page.
 *
 * @param {number|string} port
 * @param {Record<string, string|number|boolean>} [params] query params, omitted when falsy
 * @returns {string}
 */
export const gameUrl = (port, params = {}) => {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== false && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return `http://127.0.0.1:${port}${GAME_PATH}${qs ? `?${qs}` : ''}`;
};
