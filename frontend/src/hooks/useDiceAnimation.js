/**
 * hooks/useDiceAnimation.js
 *
 * Manages the dice roll animation lifecycle.
 *
 * Phases:
 *   'idle'     — dice not yet rolled this turn
 *   'rolling'  — dice spinning animation playing  (1200 ms)
 *   'landing'  — dice settling on final value     ( 400 ms)
 *   'showing'  — showing final dice result        ( 300 ms pause before tokens move)
 *
 * KEY: triggerRoll accepts an `onDone` callback that fires AFTER the full
 * dice animation + landing pause, so token movement only begins once
 * dice are completely settled. This eliminates the overlap bug.
 *
 * Returns:
 *   dicePhase         — current phase string
 *   displayDice       — { d1, d2 } to render (null during idle)
 *   triggerRoll       — call with ({ d1, d2, onDone? }) from server event
 *   resetDice         — call on turn change
 *   isDiceAnimating   — boolean — true while any dice animation is in progress
 */

import { useState, useRef, useCallback } from 'react';
import { delay } from '../utils/animationHelpers';

// ── Timing ────────────────────────────────────────────────────────────────────
const ROLL_ANIM_MS = 1200; // total dice spin duration
const LAND_ANIM_MS = 400;  // settling bounce
const POST_LAND_MS = 300;  // pause after showing result, before tokens move

const randomFace = () => Math.floor(Math.random() * 6) + 1;

export function useDiceAnimation() {
  const [dicePhase,   setDicePhase]   = useState('idle');
  const [displayDice, setDisplayDice] = useState(null);
  const inProgress = useRef(false);

  /**
   * triggerRoll — start the full dice animation sequence.
   *
   * @param {{ d1: number, d2: number, onDone?: () => void }} params
   */
  const triggerRoll = useCallback(async ({ d1, d2, onDone }) => {
    if (inProgress.current) return;
    inProgress.current = true;

    // Phase 1: rolling (scramble faces)
    setDicePhase('rolling');
    setDisplayDice({ d1: randomFace(), d2: randomFace() });

    const scrambleInterval = setInterval(() => {
      setDisplayDice({ d1: randomFace(), d2: randomFace() });
    }, 80);

    await delay(ROLL_ANIM_MS);
    clearInterval(scrambleInterval);

    // Phase 2: landing (settle on true value)
    setDicePhase('landing');
    setDisplayDice({ d1, d2 });

    await delay(LAND_ANIM_MS);

    // Phase 3: showing (result visible, post-land pause)
    setDicePhase('showing');

    await delay(POST_LAND_MS);

    // Done — signal caller so token movement can begin
    inProgress.current = false;
    onDone?.();
  }, []);

  const resetDice = useCallback(() => {
    setDicePhase('idle');
    setDisplayDice(null);
    inProgress.current = false;
  }, []);

  const isDiceAnimating = dicePhase === 'rolling' || dicePhase === 'landing';

  return { dicePhase, displayDice, triggerRoll, resetDice, isDiceAnimating };
}
