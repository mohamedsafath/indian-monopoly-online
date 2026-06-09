/**
 * utils/animationHelpers.js
 *
 * Shared animation utilities.
 *
 * BUG FIX — buildMovePath:
 *   Previous logic could produce a path that included one extra step past
 *   the destination when wrapping around GO (e.g. from 38 → 2 the path
 *   ended at 3 instead of 2). Root cause: the loop condition used `<= to`
 *   after normalizing which double-counted the destination tile.
 *
 *   Fix: build the path by counting exact steps = (to - from + 40) % 40.
 *   The destination tile is always the LAST entry. The path always has
 *   exactly `steps` entries (minimum 1).
 *
 *   Special case — GO_TO_JAIL (tile 30):
 *   When the server reports position 10 (Jail) after a GO_TO_JAIL event,
 *   the backend already teleported the player. We detect this by checking
 *   whether `from` was 30 (GO_TO_JAIL tile) AND `to` is 10 (Jail).
 *   In that case we return a single-step path [10] (snap, no walk-through).
 *
 * delay(ms) — tiny promise-based wait used in async animation sequences.
 */

const BOARD_SIZE     = 40;
const GO_TO_JAIL_POS = 30;
const JAIL_POS       = 10;

/**
 * Build an ordered list of tile indices the token should visit,
 * starting at the tile AFTER `from`, ending at `to` (inclusive).
 *
 * @param {number} from  — current displayed tile (0-39)
 * @param {number}  to   — destination tile from server (0-39)
 * @returns {number[]}   — array of tile indices to step through
 */
export function buildMovePath(from, to, moveBack = 0) {
  from = ((from % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
  to   = ((to   % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;

  // Same tile — no movement needed (shouldn't normally happen, but guard it)
  if (from === to) return [to];

  // GO_TO_JAIL teleport — snap directly, no walk-around animation
  if (from === GO_TO_JAIL_POS && to === JAIL_POS) return [JAIL_POS];

  // If moveBack is specified and positive, walk BACKWARDS (counter-clockwise)
  if (moveBack > 0) {
    const path = [];
    for (let i = 1; i <= moveBack; i++) {
      path.push((from - i + BOARD_SIZE) % BOARD_SIZE);
    }
    return path;
  }

  const steps = (to - from + BOARD_SIZE) % BOARD_SIZE;

  const path = [];
  for (let i = 1; i <= steps; i++) {
    path.push((from + i) % BOARD_SIZE);
  }
  return path; // last element === to, always
}

/**
 * Promise-based delay.
 * @param {number} ms
 */
export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
