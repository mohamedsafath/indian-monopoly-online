/**
 * hooks/useTokenMovement.js
 *
 * Manages step-by-step tile animation for all players.
 * Refactored to expose an explicit Promise-based animateMovement function
 * controlled directly by the GameRoom sequencer.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { buildMovePath, delay } from '../utils/animationHelpers';

const STEP_DELAY_MS = 250;  // ms per tile step (0.25s)
const ARRIVE_MS     = 500;  // bounce animation duration (landing pause)

export function useTokenMovement(players) {
  const [displayPositions, setDisplayPositions] = useState({});
  const [arrivingPlayers,  setArrivingPlayers]  = useState(new Set());
  
  // Track players currently running an animation to avoid overwriting their positions
  const animatingPlayersRef = useRef(new Set());

  // Snapshot / Sync positions whenever server players change
  useEffect(() => {
    if (!players) return;
    setDisplayPositions((prev) => {
      const next = { ...prev };
      Object.values(players).forEach((p) => {
        // Only sync/snap if the player is not currently animating!
        if (!animatingPlayersRef.current.has(p.id)) {
          next[p.id] = p.position;
        }
      });
      return next;
    });
  }, [players]);

  /**
   * Animate a player's token step-by-step from one position to another.
   * Resolves a Promise once the movement and arrival bounce are fully complete.
   */
  const animateMovement = useCallback((playerId, from, to, teleport = false) => {
    return new Promise((resolve) => {
      const run = async () => {
        animatingPlayersRef.current.add(playerId);

        const done = () => {
          animatingPlayersRef.current.delete(playerId);
          resolve();
        };

        if (teleport) {
          // Snap immediately without walking tile-by-tile
          setDisplayPositions((d) => ({ ...d, [playerId]: to }));

          // Brief landing pause / bounce at destination
          setArrivingPlayers((s) => {
            const ns = new Set(s);
            ns.add(playerId);
            return ns;
          });

          await delay(ARRIVE_MS);

          setArrivingPlayers((s) => {
            const ns = new Set(s);
            ns.delete(playerId);
            return ns;
          });

          done();
          return;
        }

        const path = buildMovePath(from, to);

        // Walk step-by-step
        for (const step of path) {
          setDisplayPositions((d) => ({ ...d, [playerId]: step }));
          await delay(STEP_DELAY_MS);
        }

        // Ensure exact final tile
        setDisplayPositions((d) => ({ ...d, [playerId]: to }));

        // Landing pause / bounce
        setArrivingPlayers((s) => {
          const ns = new Set(s);
          ns.add(playerId);
          return ns;
        });

        await delay(ARRIVE_MS);

        setArrivingPlayers((s) => {
          const ns = new Set(s);
          ns.delete(playerId);
          return ns;
        });

        done();
      };

      run();
    });
  }, []);

  return { displayPositions, arrivingPlayers, animateMovement };
}
