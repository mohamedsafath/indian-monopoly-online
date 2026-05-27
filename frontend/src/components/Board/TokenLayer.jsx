/**
 * components/Board/TokenLayer.jsx
 *
 * Renders ALL player tokens as a floating overlay above the board.
 * Tokens are absolutely positioned within the board grid.
 * Each token animates step-by-step using useTokenMovement.
 */
import React, { useMemo } from 'react';
import { PlayerToken }    from './PlayerToken';
import { TILE_POSITIONS, tokenStackOffset } from '../../utils/boardLayout';

const getCellPercent = (index) => {
  if (index === 0) return 8.25;
  if (index === 10) return 91.75;
  return 12.78 + index * 7.44;
};

export const TokenLayer = React.memo(function TokenLayer({
  players,
  displayPositions,
  arrivingPlayers,
  teleportingPlayers = new Set(),
  currentPlayerId,
  myId,
}) {
  if (!players || !displayPositions) return null;

  const playerList = Object.values(players).filter((p) => !p.isBankrupt);

  // Group players by their DISPLAYED tile (for stacking)
  const tileGroups = useMemo(() => {
    const groups = {};
    playerList.forEach((p) => {
      const pos = displayPositions[p.id] ?? p.position;
      if (!groups[pos]) groups[pos] = [];
      groups[pos].push(p);
    });
    return groups;
  }, [playerList, displayPositions]);

  return (
    <>
      {playerList.map((player) => {
        const tileId   = displayPositions[player.id] ?? player.position;
        const tilePos  = TILE_POSITIONS[tileId];
        if (!tilePos) return null;

        const tileGroup = tileGroups[tileId] ?? [player];
        const idxInTile = tileGroup.findIndex((p) => p.id === player.id);
        const { x: ox, y: oy } = tokenStackOffset(idxInTile, tileGroup.length);

        // Map 0-indexed grid coordinates to physical percentage positions matching
        // the non-uniform grid columns/rows (2.2fr corners, 1fr regular tiles)
        const leftPct = getCellPercent(tilePos.col);
        const topPct  = getCellPercent(tilePos.row);

        // Determine if player is currently moving (walking step-by-step)
        const isMoving = displayPositions[player.id] !== undefined && displayPositions[player.id] !== player.position;
        // Determine if player is teleporting
        const isTeleporting = teleportingPlayers?.has(player.id);

        let transitionStyle = 'left 0.25s cubic-bezier(0.25, 1, 0.5, 1), top 0.25s cubic-bezier(0.25, 1, 0.5, 1)';
        if (isTeleporting) {
          transitionStyle = 'none';
        } else if (isMoving) {
          transitionStyle = 'left 0.25s linear, top 0.25s linear';
        }

        return (
          <div
            key={player.id}
            style={{
              position:  'absolute',
              left:      `${leftPct}%`,
              top:       `${topPct}%`,
              transform: 'translate(-50%, -50%)',
              zIndex:    player.id === currentPlayerId ? 30 : 20,
              // Smooth repositioning between tiles (no corner stutter, instant jail snaps)
              transition: transitionStyle,
              pointerEvents: 'none',
            }}
          >
            <PlayerToken
              player={player}
              offsetX={ox}
              offsetY={oy}
              isCurrentPlayer={player.id === currentPlayerId}
              isArriving={arrivingPlayers.has(player.id)}
              isMe={player.id === myId}
            />
          </div>
        );
      })}
    </>
  );
});