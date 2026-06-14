/**
 * components/Board/MonopolyBoard.jsx
 *
 * Premium AAA Monopoly India Board — complete overhaul.
 *
 * KEY CHANGES vs original:
 *  - Grid columns: corners 2fr, regular tiles 1fr (was all 1fr)
 *    → corners are larger, outer ring is thicker, center is smaller
 *  - BoardCenter shrinks from 9×9 to 7×7 (columns 3-9, rows 3-9)
 *  - Physical deck stacks for Chance (top-right) & Community (bottom-left) in center
 *  - Deck glow when pendingCardDraw is active
 *  - Click-to-draw card interaction (current player only)
 *  - PropertyPurchaseModal shown when pendingPurchase && isMyTurn
 *  - PropertyPurchaseModal shown for ALL players as read-only when not your turn
 *  - RentModal shown informational after RENT_PAID event
 *  - TradeModal for full trade system
 *  - BuildPanel for houses/hotels
 *  - TokenLayer, DiceArena, TileDetailsPanel unchanged
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

import { BOARD_ANIMATIONS_CSS }  from './Animations/animations';
import { BoardTile }             from './BoardTile';
import { CornerTile }            from './CornerTile';
import { TokenLayer }            from './TokenLayer';
import { DiceArena }             from './DiceArena';
import { TileDetailsPanel }      from './TileDetailsPanel';
import { CardPopup }             from './Animations/Chancedeckanimation';
import { PropertyPurchaseModal } from './PropertyPurchaseModal';
import { RentModal }             from './RentModal';
import { TradeModal }            from './TradeModal';
import { LoanModal }             from './LoanModal';
import { BuildPanel }            from './BuildPanel';
import { AuctionModal }          from './AuctionModal';

import { BOARD_TILES, TILE_BY_ID, COLOR_GROUP_META } from '../../utils/boardTiles';
import {
  TILE_POSITIONS,
  PLAYER_TOKENS,
  PLAYER_COLORS,
} from '../../utils/boardLayout';

const fmt = (n) => Number(n ?? 0).toLocaleString('en-IN');

// ── Monopoly detection ────────────────────────────────────────────────────────
function computeMonopolies(properties) {
  const monopolies  = {};
  const groupTotals = {};
  const groupOwned  = {};

  BOARD_TILES.forEach((tile) => {
    if (!tile.group) return;
    const prop = properties[tile.id];
    if (!groupTotals[tile.group]) {
      groupTotals[tile.group] = BOARD_TILES.filter(t => t.group === tile.group).length;
      groupOwned[tile.group]  = {};
    }
    if (prop?.ownerId) {
      groupOwned[tile.group][prop.ownerId] = (groupOwned[tile.group][prop.ownerId] ?? 0) + 1;
    }
  });

  BOARD_TILES.forEach((tile) => {
    if (!tile.group) return;
    const prop = properties[tile.id];
    if (!prop?.ownerId) return;
    const ownedCount = groupOwned[tile.group]?.[prop.ownerId] ?? 0;
    if (ownedCount === groupTotals[tile.group]) {
      monopolies[tile.id] = true;
    }
  });

  return monopolies;
}

// Compute monopoly info for a tile (would buying complete it?)
function monopolyInfo(tileId, myId, properties) {
  const tile = TILE_BY_ID[tileId];
  if (!tile?.group) return { wouldCompleteMonopoly: false, groupSize: 0, ownedInGroup: 0 };

  const groupTiles = BOARD_TILES.filter(t => t.group === tile.group);
  const groupSize  = groupTiles.length;
  const ownedInGroup = groupTiles.filter(t => properties[t.id]?.ownerId === myId).length;
  const wouldCompleteMonopoly = ownedInGroup + 1 === groupSize;

  return { wouldCompleteMonopoly, groupSize, ownedInGroup };
}

// ── Enrich players ────────────────────────────────────────────────────────────
function enrichPlayers(rawPlayers) {
  if (!rawPlayers) return {};
  return Object.fromEntries(
    Object.entries(rawPlayers).map(([id, p], idx) => [
      id,
      {
        ...p,
        token: p.token ?? PLAYER_TOKENS[idx % PLAYER_TOKENS.length],
        color: p.color ?? PLAYER_COLORS[idx % PLAYER_COLORS.length],
      },
    ])
  );
}

// ── Physical deck component (lives in board center) ───────────────────────────
const DECK_ANIMATIONS_CSS = `
@keyframes deckFloat {
  0%,100% { transform: translateY(0px); }
  50%      { transform: translateY(-3px); }
}
@keyframes deckGlowPulse {
  0%,100% { box-shadow: 0 0 12px 2px var(--deck-color); }
  50%      { box-shadow: 0 0 28px 8px var(--deck-color); }
}
@keyframes deckCardSlide {
  from { transform: translateY(-8px) rotate(-3deg); opacity: 0; }
  to   { transform: translateY(0) rotate(0deg); opacity: 1; }
}
@keyframes deckClickHint {
  0%,100% { transform: scale(1); }
  50%      { transform: scale(1.05); }
}
`;

function PhysicalDeck({
  type,      // 'chance' | 'community'
  isGlowing, // boolean — this deck has a pending draw
  isMyTurn,  // can click
  onClick,   // called when current player clicks
  playerName, // name of player who must draw
}) {
  const isChance  = type === 'chance';
  const accent    = isChance ? '#f59e0b' : '#3b82f6';
  const label     = isChance ? 'CHANCE' : 'COMMUNITY';
  const icon      = isChance ? '❓' : '📦';
  const bgGrad    = isChance
    ? 'linear-gradient(145deg,#2a1a00,#1a1000)'
    : 'linear-gradient(145deg,#001528,#000d1a)';

  const canClick = isGlowing && isMyTurn;
  const isMobile = typeof window !== 'undefined' ? window.innerWidth <= 768 : false;

  return (
    <div
      onClick={canClick ? onClick : undefined}
      title={isGlowing ? (isMyTurn ? `Click to draw ${label} card` : `Waiting for ${playerName} to draw`) : label}
      style={{
        width:        'var(--deck-width, 135px)',
        height:       'var(--deck-height, 175px)',
        borderRadius: isMobile ? 8 : 16,
        background:   bgGrad,
        border:       `1.5px solid ${isGlowing ? accent : accent + '35'}`,
        cursor:       canClick ? 'pointer' : 'default',
        position:     'relative',
        overflow:     'hidden',
        '--deck-color': `${accent}55`,
        animation:    isGlowing
          ? canClick
            ? 'deckGlowPulse 1.2s ease-in-out infinite, deckClickHint 1.5s ease-in-out infinite'
            : 'deckGlowPulse 1.8s ease-in-out infinite'
          : 'deckFloat 4s ease-in-out infinite',
        boxShadow:    isGlowing
          ? `0 0 24px ${accent}60, 0 6px 24px rgba(0,0,0,0.55)`
          : `0 6px 20px rgba(0,0,0,0.45)`,
        transition:   'border 0.3s, box-shadow 0.3s',
        userSelect:   'none',
        display:      'flex',
        flexDirection:'column',
        justifyContent:'space-between',
        boxSizing:    'border-box',
        padding:      'var(--deck-gap, 6px)',
      }}
    >
      {/* Card stack illusion */}
      {!isMobile && [3, 2, 1].map((offset) => (
        <div key={offset} style={{
          position:    'absolute',
          bottom:      `calc(${offset * 4}px + var(--deck-bottom-offset, 32px))`,
          left:        offset * 2 + 8,
          right:       offset * 2 + 8,
          height:      'var(--deck-stack-height, 120px)',
          borderRadius: 12,
          background:  isGlowing
            ? `${accent}${['08','10','14'][offset - 1]}`
            : 'rgba(255,255,255,0.03)',
          border:      `1px solid ${accent}${['15','20','28'][offset - 1]}`,
        }} />
      ))}

      {/* Top card */}
      <div style={{
        position:     'relative',
        height:       'var(--deck-top-card-height, 122px)',
        borderRadius: isMobile ? 6 : 12,
        background:   isGlowing
          ? `linear-gradient(135deg, ${accent}22, ${accent}10)`
          : 'rgba(255,255,255,0.06)',
        border:       `1px solid ${accent}40`,
        display:      'flex',
        flexDirection:'column',
        alignItems:   'center',
        justifyContent:'center',
        gap:          'var(--deck-gap, 6px)',
        animation:    isGlowing ? 'deckCardSlide 0.4s ease-out' : 'none',
      }}>
        <div style={{
          fontSize: 'var(--deck-icon-size, 36px)',
          filter:   isGlowing ? `drop-shadow(0 0 12px ${accent})` : 'none',
          lineHeight: 1,
        }}>{icon}</div>
        <div style={{
          fontSize:      isMobile ? (label.length > 7 ? '5px' : '6px') : 'var(--deck-label-size, 12px)',
          fontWeight:    900,
          letterSpacing: isMobile ? '0.02em' : '0.15em',
          textTransform: 'uppercase',
          color:         isGlowing ? accent : `${accent}80`,
          textAlign:     'center',
          lineHeight:    1.2,
        }}>{label}</div>
      </div>

      {/* Bottom label bar */}
      <div style={{
        textAlign:     'center',
        fontSize:      'var(--deck-bottom-label-size, 10px)',
        fontWeight:    800,
        letterSpacing: isMobile ? '0.02em' : '0.08em',
        color:         isGlowing ? accent : `${accent}60`,
        textTransform: 'uppercase',
        paddingTop:    '4px',
      }}>
        {isGlowing
          ? (canClick ? '▶ Draw' : `⏳ ${playerName?.split(' ')[0] ?? '…'}`)
          : 'Draw Card'}
      </div>
    </div>
  );
}

// ── Board center (contains dice + deck stacks) ────────────────────────────────
function BoardCenter({
  gameState, myId, isMyTurn, hasRolled,
  dicePhase, displayDice, onRoll,
  activeToast, players,
  pendingCardDraw, onDeckClick,
}) {
  const currentPlayerId = gameState?.currentPlayerId;
  const currentPlayer   = currentPlayerId ? players[currentPlayerId] : null;
  const pendingAction   = gameState?.pendingAction ?? null;

  const isChancePending    = pendingCardDraw?.deck === 'chance';
  const isCommunityPending = pendingCardDraw?.deck === 'community';
  const drawingPlayerName  = pendingCardDraw
    ? (players[pendingCardDraw.playerId]?.username ?? '…')
    : null;

  return (
    <div style={{
      position:       'absolute',
      width:          '67%',
      height:         '67%',
      top:            '16.5%',
      left:           '16.5%',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      background:     'radial-gradient(ellipse at center,#0d1520 0%,#080c12 70%,#050709 100%)',
      overflow:       'hidden',
      borderRadius:   20,
      border:         '1px solid rgba(212,175,55,0.06)',
      boxShadow:      '0 8px 32px rgba(0,0,0,0.6), inset 0 0 20px rgba(0,0,0,0.5)',
      zIndex:         4,
    }}>
      <style>{DECK_ANIMATIONS_CSS}</style>

      {/* Decorative grid */}
      <div style={{
        position:        'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(212,175,55,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(212,175,55,0.025) 1px,transparent 1px)',
        backgroundSize:  '20px 20px',
        pointerEvents:   'none',
      }} />

      {/* Center glow */}
      <div style={{
        position: 'absolute', width: '70%', height: '70%', borderRadius: '50%',
        background: 'radial-gradient(ellipse,rgba(212,175,55,0.05) 0%,transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Board title */}
      <div style={{
        position: 'absolute', top: '9%', left: '50%', transform: 'translateX(-50%)',
        textAlign: 'center', zIndex: 2, pointerEvents: 'none',
        fontSize: 'var(--board-title-size, 16px)', fontWeight: 900, letterSpacing: '0.22em', textTransform: 'uppercase',
        background: 'linear-gradient(135deg,#d4af37,#fde68a,#d97706)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        fontFamily: "'Playfair Display',serif", opacity: 0.85,
        whiteSpace: 'nowrap',
      }}>
        Monopoly India
      </div>

      {/* ── Deck stacks ── */}
      {/* Chance deck — top-right of center */}
      <div style={{
        position: 'absolute', top: 'var(--deck-top, 12%)', right: 'var(--deck-right, 12%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        zIndex: 5,
      }}>
        <PhysicalDeck
          type="chance"
          isGlowing={isChancePending}
          isMyTurn={isMyTurn && pendingCardDraw?.playerId === myId}
          onClick={() => onDeckClick('chance')}
          playerName={drawingPlayerName}
        />
      </div>

      {/* Community deck — bottom-left of center */}
      <div style={{
        position: 'absolute', bottom: 'var(--deck-bottom, 12%)', left: 'var(--deck-left, 12%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        zIndex: 5,
      }}>
        <PhysicalDeck
          type="community"
          isGlowing={isCommunityPending}
          isMyTurn={isMyTurn && pendingCardDraw?.playerId === myId}
          onClick={() => onDeckClick('community')}
          playerName={drawingPlayerName}
        />
      </div>

      {/* Dice Arena */}
      <DiceArena
        dicePhase={dicePhase}
        displayDice={displayDice}
        currentPlayer={currentPlayer}
        hasRolled={hasRolled}
        isMyTurn={isMyTurn}
        onRoll={onRoll}
        pendingAction={pendingAction}
      />

      {/* Toast overlay */}
      {activeToast && (
        <div style={{
          position:  'absolute', bottom: '12%', left: '50%',
          transform: 'translateX(-50%)',
          zIndex:    40,
          animation: 'floatUpFade 2.8s ease-out forwards',
          background: activeToast.type === 'rent'    ? 'rgba(239,68,68,0.88)'
                    : activeToast.type === 'repossession' ? 'linear-gradient(135deg, rgba(185,28,28,0.92) 0%, rgba(127,17,17,0.92) 100%)'
                    : activeToast.type === 'mortgage' ? 'linear-gradient(135deg, rgba(217,119,6,0.92) 0%, rgba(180,83,9,0.92) 100%)'
                    : activeToast.type === 'go'      ? 'rgba(34,197,94,0.88)'
                    : activeToast.type === 'house'   ? 'rgba(34,197,94,0.88)'
                    : activeToast.type === 'hotel'   ? 'rgba(168,85,247,0.88)'
                    : activeToast.type === 'trade'   ? 'rgba(59,130,246,0.88)'
                    : 'rgba(245,158,11,0.88)',
          backdropFilter: 'blur(8px)',
          border:    (activeToast.type === 'repossession' || activeToast.type === 'mortgage') ? '1.5px solid rgba(251,191,36,0.5)' : '1px solid rgba(255,255,255,0.15)',
          borderRadius: 10,
          padding:   'var(--center-toast-padding, 7px 16px)',
          fontSize:  'var(--center-toast-font-size, 11px)',
          fontWeight: 700,
          color:     '#fff',
          whiteSpace:'nowrap',
          boxShadow: (activeToast.type === 'repossession' || activeToast.type === 'mortgage') ? '0 0 16px rgba(251,191,36,0.35), 0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.4)',
        }}>
          {activeToast.type === 'rent'    && `💸 ${players[activeToast.fromId]?.username ?? 'Someone'} paid ₹${Number(activeToast.amount).toLocaleString('en-IN')} to ${players[activeToast.toId]?.username ?? 'someone'}`}
          {activeToast.type === 'buy'     && `🏠 Purchased ${TILE_BY_ID[activeToast.tileId]?.name ?? 'property'}`}
          {activeToast.type === 'tax'     && `🚔 Tax ₹${Number(activeToast.amount).toLocaleString('en-IN')}`}
          {activeToast.type === 'go'      && `🇮🇳 Passed GO! +₹${Number(activeToast.amount).toLocaleString('en-IN')}`}
          {activeToast.type === 'collect' && `☕ Free Parking ₹${Number(activeToast.amount).toLocaleString('en-IN')}`}
          {activeToast.type === 'house'   && `🏠 House built!`}
          {activeToast.type === 'hotel'   && `🏨 Hotel built!`}
          {activeToast.type === 'trade'   && `🤝 ${activeToast.message ?? 'Trade completed!'}`}
          {activeToast.type === 'auction' && `🔨 Auction started!`}
          {activeToast.type === 'repossession' && `🏦 Bank repossessed ${activeToast.tileName}`}
          {activeToast.type === 'mortgage' && `🏦 Mortgaged ${activeToast.tileName}`}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN BOARD
// ─────────────────────────────────────────────────────────────────────────────

export const MonopolyBoard = React.memo(function MonopolyBoard({
  gameState,
  myId,
  isMyTurn,
  hasRolled,
  dicePhase,
  displayDice,
  onRoll,
  onBuy,
  onEndTurn,
  // Sizing states
  showTradeModal,
  setShowTradeModal,
  showBuildPanel,
  setShowBuildPanel,
  showLoanModal,
  setShowLoanModal,
  // From useBoardAnimation:
  pendingCardDraw,
  activeCard,
  onDeckClick,
  onDismissCard,
  pendingPurchase,
  onDismissPurchase,
  rentInfo,
  onDismissRent,
  activeTrade,
  activeToast,
  flashTile,
  // From useTokenMovement:
  displayPositions,
  arrivingPlayers,
  teleportingPlayers,
  // Extra actions:
  onBuildHouse,
  onBuildHotel,
  onSellHouse,
  onSellHotel,
  onInitiateTrade,
  onCounterTrade,
  onAcceptTrade,
  onRejectTrade,
  onCancelTrade,
  onPlaceBid,
  onPassAuction,
  onAuctionProperty,
  onTakeLoan,
  onRepayLoan,
  onDeclareBankruptcy,
}) {
  const [selectedTile, setSelectedTile] = useState(null);
  const [minimizedShortfall, setMinimizedShortfall] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isMyTurn) {
      setMinimizedShortfall(false);
    }
  }, [isMyTurn]);

  const players    = useMemo(() => enrichPlayers(gameState?.players), [gameState?.players]);
  const properties = gameState?.properties ?? {};
  const monopolies = useMemo(() => computeMonopolies(properties), [properties]);

  const currentPlayerId = gameState?.currentPlayerId;
  const me              = players[myId];
  const pendingAction   = gameState?.pendingAction ?? null;
  const currentActiveTrade = gameState?.activeTrade || activeTrade;

  const selectedTileData = useMemo(
    () => (selectedTile !== null ? (TILE_BY_ID[selectedTile] ?? null) : null),
    [selectedTile]
  );
  const selectedProperty = selectedTile !== null ? (properties[selectedTile] ?? null) : null;
  const selectedOwner    = selectedProperty?.ownerId ? players[selectedProperty.ownerId] : null;

  const handleTileClick  = useCallback((id) => setSelectedTile(p => p === id ? null : id), []);
  const handlePanelClose = useCallback(() => setSelectedTile(null), []);

  const occupiedTiles = useMemo(() => {
    const set = new Set();
    Object.values(players).forEach((p) => {
      const pos = displayPositions?.[p.id] ?? p.position;
      if (pos !== undefined) set.add(pos);
    });
    return set;
  }, [players, displayPositions]);

  const getOwnerColor = useCallback((tileId) => {
    const prop = properties[tileId];
    if (!prop?.ownerId) return null;
    return players[prop.ownerId]?.color ?? null;
  }, [properties, players]);

  const getOwnerToken = useCallback((tileId) => {
    const prop = properties[tileId];
    if (!prop?.ownerId) return null;
    return players[prop.ownerId]?.token ?? null;
  }, [properties, players]);

  // Monopoly info for purchase modal
  const purchaseTile = pendingPurchase ? TILE_BY_ID[pendingPurchase.tileId] : null;
  const purchaseMonopolyInfo = purchaseTile
    ? monopolyInfo(purchaseTile.id, myId, properties)
    : null;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minWidth: 0, minHeight: 0 }}>
      <style>{BOARD_ANIMATIONS_CSS}</style>

      {/* Outer board frame */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--board-padding, 6px)',
      }}>
        {/* Square aspect-ratio wrapper — visually dominates the screen */}
        <div style={{
          position:    'relative',
          width:       '100%',
          height:      'auto',
          aspectRatio: '1 / 1',
          maxWidth:    '100%',
          maxHeight:   '100%',
        }}>
          {/* Gold border */}
          <div style={{
            position: 'absolute', inset: -3, borderRadius: 16,
            background: 'linear-gradient(135deg,#d4af37 0%,#8b6914 25%,#d4af37 50%,#8b6914 75%,#d4af37 100%)',
            zIndex: 0,
          }} />

          {/* Board surface */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 14,
            background: '#080c12', overflow: 'hidden', zIndex: 1,
            boxShadow: '0 24px 80px rgba(0,0,0,0.8),inset 0 0 80px rgba(0,0,0,0.5)',
          }}>
            {/*
              11×11 Grid — PREMIUM RESPONSIVE PROPORTIONS:
              Columns/Rows:
                col 1  = corner col (16.5%)
                cols 2-10 = regular tiles (7.44% each)
                col 11 = corner col (16.5%)
            */}
            <div style={{
              display:             'grid',
              gridTemplateColumns: '16.5% repeat(9, 7.44%) 16.5%',
              gridTemplateRows:    '16.5% repeat(9, 7.44%) 16.5%',
              width:               '100%',
              height:              '100%',
              position:            'relative',
            }}>
              {/* Corner Tiles */}
              {[0, 10, 20, 30].map((id) => (
                <CornerTile
                  key={id}
                  tileId={id}
                  isOccupied={occupiedTiles.has(id)}
                  onClick={handleTileClick}
                />
              ))}

              {/* Regular Tiles */}
              {BOARD_TILES.filter((t) => ![0, 10, 20, 30].includes(t.id)).map((tile) => {
                const pos = TILE_POSITIONS[tile.id];
                if (!pos) return null;
                return (
                  <BoardTile
                    key={tile.id}
                    tile={tile}
                    property={properties[tile.id]}
                    ownerColor={getOwnerColor(tile.id)}
                    ownerToken={getOwnerToken(tile.id)}
                    isMonopoly={monopolies[tile.id] ?? false}
                    isFlashing={flashTile === tile.id}
                    edge={pos.edge}
                    gridColumn={pos.col + 1}
                    gridRow={pos.row + 1}
                    isActive={occupiedTiles.has(tile.id)}
                    onClick={handleTileClick}
                  />
                );
              })}

              {/* Board center with dice + decks */}
              <BoardCenter
                gameState={gameState}
                myId={myId}
                isMyTurn={isMyTurn}
                hasRolled={hasRolled}
                dicePhase={dicePhase}
                displayDice={displayDice}
                onRoll={onRoll}
                activeToast={activeToast}
                players={players}
                pendingCardDraw={pendingCardDraw}
                onDeckClick={onDeckClick}
              />

              {/* Token Layer */}
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 20 }}>
                <TokenLayer
                  players={players}
                  displayPositions={displayPositions}
                  arrivingPlayers={arrivingPlayers ?? new Set()}
                  teleportingPlayers={teleportingPlayers}
                  currentPlayerId={currentPlayerId}
                  myId={myId}
                />
              </div>

              {/* Tile Details Panel (Desktop inside board wrapper) */}
              {selectedTileData && !isMobile && (
                <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 30, pointerEvents: 'auto' }}>
                  <TileDetailsPanel
                    tile={selectedTileData}
                    property={selectedProperty}
                    ownerPlayer={selectedOwner}
                    pendingAction={pendingAction}
                    isMyTurn={isMyTurn}
                    myMoney={me?.money ?? 0}
                    monopolies={monopolies}
                    onBuy={onBuy}
                    onEndTurn={onEndTurn}
                    onBuildHouse={onBuildHouse}
                    onBuildHotel={onBuildHotel}
                    onSellHouse={onSellHouse}
                    onSellHotel={onSellHotel}
                    myId={myId}
                    gameState={gameState}
                    onClose={handlePanelClose}
                    onAuctionProperty={onAuctionProperty}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Overlays (outside board, full-screen) ── */}

      {/* Tile Details Panel (Mobile outside board wrapper to prevent overflow:hidden clipping) */}
      {selectedTileData && isMobile && (
        <TileDetailsPanel
          tile={selectedTileData}
          property={selectedProperty}
          ownerPlayer={selectedOwner}
          pendingAction={pendingAction}
          isMyTurn={isMyTurn}
          myMoney={me?.money ?? 0}
          monopolies={monopolies}
          onBuy={onBuy}
          onEndTurn={onEndTurn}
          onBuildHouse={onBuildHouse}
          onBuildHotel={onBuildHotel}
          onSellHouse={onSellHouse}
          onSellHotel={onSellHotel}
          myId={myId}
          gameState={gameState}
          onClose={handlePanelClose}
          onAuctionProperty={onAuctionProperty}
        />
      )}

      {/* Card reveal popup */}
      {activeCard && (
        <CardPopup
          card={activeCard}
          onDismiss={onDismissCard}
        />
      )}

      {/* Property purchase modal */}
      {purchaseTile && !!pendingPurchase && (
        <PropertyPurchaseModal
          tile={purchaseTile}
          property={properties[purchaseTile.id]}
          monopolyInfo={purchaseMonopolyInfo}
          myMoney={me?.money ?? 0}
          isMyTurn={isMyTurn}
          ownerPlayer={selectedOwner}
          onBuy={() => { onBuy(); onDismissPurchase(); }}
          onDecline={() => { onEndTurn(); onDismissPurchase(); }}
          onClose={onDismissPurchase}
        />
      )}

      {/* Rent informational modal */}
      {rentInfo && (
        <RentModal
          rentInfo={rentInfo}
          players={players}
          myId={myId}
          onClose={onDismissRent}
        />
      )}

      {/* Auction Modal */}
      {gameState?.activeAuction && (
        <AuctionModal
          activeAuction={gameState.activeAuction}
          players={players}
          myId={myId}
          onPlaceBid={onPlaceBid}
          onPassAuction={onPassAuction}
        />
      )}

      {/* Trade modal */}
      {showTradeModal && (
        <TradeModal
          gameState={gameState}
          myId={myId}
          players={players}
          properties={properties}
          activeTrade={currentActiveTrade}
          onInitiateTrade={onInitiateTrade}
          onCounterTrade={onCounterTrade}
          onAcceptTrade={onAcceptTrade}
          onRejectTrade={onRejectTrade}
          onCancelTrade={onCancelTrade}
          onClose={() => setShowTradeModal(false)}
        />
      )}



      {/* Build panel */}
      {showBuildPanel && (
        <BuildPanel
          gameState={gameState}
          myId={myId}
          properties={properties}
          monopolies={monopolies}
          onBuildHouse={onBuildHouse}
          onBuildHotel={onBuildHotel}
          onSellHouse={onSellHouse}
          onSellHotel={onSellHotel}
          onClose={() => setShowBuildPanel(false)}
        />
      )}

      {/* Active trade notification for non-initiator */}
      {currentActiveTrade && currentActiveTrade.toPlayerId === myId && !showTradeModal && (
        <div
          onClick={() => setShowTradeModal(true)}
          style={{
            position:   'fixed', bottom: 70, right: 16,
            zIndex:     500,
            background: 'rgba(59,130,246,0.15)',
            border:     '1px solid rgba(59,130,246,0.4)',
            borderRadius: 12,
            padding:    '10px 16px',
            cursor:     'pointer',
            fontFamily: "'DM Sans',sans-serif",
            animation:  'tokenGlow 1.5s ease-in-out infinite',
            color:      '#93c5fd',
            fontSize:   12,
            fontWeight: 700,
          }}
        >
          🤝 Trade offer waiting — Click to review
        </div>
      )}

      {/* Loan Modal */}
      {showLoanModal && (
        <LoanModal
          currentBalance={me?.money}
          onConfirm={(amount) => {
            onTakeLoan(amount);
            setShowLoanModal(false);
          }}
          onClose={() => setShowLoanModal(false)}
        />
      )}

      {/* Shortfall Debt Resolution Modal */}
      {me && me.money < 0 && isMyTurn && !minimizedShortfall && (
        <div style={{
          position:       'fixed',
          inset:          0,
          zIndex:         1300,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          background:     'rgba(0,0,0,0.82)',
          backdropFilter: 'blur(14px)',
          fontFamily:     "'DM Sans',sans-serif",
        }}>
          <div style={{
            width:        '90%',
            maxWidth:     360,
            borderRadius: 24,
            background:   'linear-gradient(160deg, #1b0a0a 0%, #0d0404 100%)',
            border:       '2.5px solid #ef4444',
            boxShadow:    '0 24px 64px rgba(0,0,0,0.9), 0 0 40px rgba(239,68,68,0.2)',
            padding:      32,
            color:        '#f3f4f6',
            textAlign:    'center',
          }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>⚠️</div>
            <h3 style={{
              fontSize: 22, fontWeight: 900, color: '#f87171',
              fontFamily: "'Playfair Display', serif", margin: '0 0 10px'
            }}>
              Insufficient Cash
            </h3>
            <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 24px', lineHeight: 1.5 }}>
              You don't have enough cash to cover your debt of <span style={{ color: '#ef4444', fontWeight: 800 }}>₹{fmt(Math.abs(me.money))}</span>. 
              Please liquidate assets, borrow, or declare bankruptcy.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                disabled={me.loanActive}
                onClick={() => setShowLoanModal(true)}
                style={{
                  padding: '12px', borderRadius: 12,
                  background: me.loanActive ? 'rgba(255,255,255,0.03)' : 'linear-gradient(135deg, #d4af37 0%, #aa771c 100%)',
                  border: 'none',
                  color: me.loanActive ? '#6b7280' : '#000000',
                  fontWeight: 900, fontSize: 13, cursor: me.loanActive ? 'not-allowed' : 'pointer',
                  fontFamily: "'DM Sans',sans-serif",
                  boxShadow: me.loanActive ? 'none' : '0 4px 12px rgba(212,175,55,0.25)',
                }}
              >
                🏦 Take Emergency Loan
              </button>

              <button
                onClick={() => setMinimizedShortfall(true)}
                style={{
                  padding: '12px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#e5e7eb',
                  fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  fontFamily: "'DM Sans',sans-serif",
                }}
              >
                🏠 Mortgage / Sell Buildings
              </button>

              <button
                onClick={() => {
                  setShowTradeModal(true);
                  setMinimizedShortfall(true);
                }}
                style={{
                  padding: '12px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#e5e7eb',
                  fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  fontFamily: "'DM Sans',sans-serif",
                }}
              >
                🤝 Trade Assets
              </button>

              <button
                onClick={() => {
                  if (confirm('Are you sure you want to declare bankruptcy? You will be eliminated from the game.')) {
                    onDeclareBankruptcy();
                  }
                }}
                style={{
                  padding: '12px', borderRadius: 12,
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 900, fontSize: 13, cursor: 'pointer',
                  fontFamily: "'DM Sans',sans-serif",
                  boxShadow: '0 4px 12px rgba(239,68,68,0.25)',
                }}
              >
                💸 Declare Bankruptcy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Minimized Shortfall Bar */}
      {me && me.money < 0 && isMyTurn && minimizedShortfall && (
        <div 
          onClick={() => setMinimizedShortfall(false)}
          style={{
            position: 'fixed',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(90deg, #ef4444, #b91c1c)',
            border: '2px solid #ffffff',
            boxShadow: '0 8px 32px rgba(239,68,68,0.5), 0 0 15px rgba(239,68,68,0.3)',
            borderRadius: 16,
            padding: '10px 24px',
            zIndex: 1300,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 16 }}>⚠️</span>
          <span style={{ fontWeight: 800, color: '#ffffff', fontSize: 13, letterSpacing: '0.02em' }}>
            DEBT RESOLUTION ACTIVE: Owe ₹{fmt(Math.abs(me.money))} (Click to return)
          </span>
        </div>
      )}
    </div>
  );
});