/**
 * hooks/useBoardAnimation.js
 *
 * Coordinates board visual states, toasts, modals, and card draws.
 * Refactored to remove the socket listener and serve as a state manager
 * driven by the GameRoom sequencer.
 */

import { useState, useCallback, useRef } from 'react';

export function useBoardAnimation() {
  // Card draw state
  const [pendingCardDraw, setPendingCardDraw] = useState(null);
  const [activeCard,      setActiveCard]      = useState(null);

  // Purchase modal state
  const [pendingPurchase, setPendingPurchase] = useState(null);

  // Rent info state
  const [rentInfo, setRentInfo] = useState(null);

  // Toast state
  const [activeToast, setActiveToast] = useState(null);

  // Tile flash state
  const [flashTile, setFlashTile] = useState(null);

  // Trade state
  const [activeTrade, setActiveTrade] = useState(null);

  // House/hotel info
  const [houseBuiltInfo, setHouseBuiltInfo] = useState(null);

  // ── Internal refs for timers ──────────────────────────────────────────────
  const toastTimerRef = useRef(null);
  const rentTimerRef  = useRef(null);
  const houseTimerRef = useRef(null);

  // ── Actions/Helpers ───────────────────────────────────────────────────────
  const showToast = useCallback((toast) => {
    setActiveToast(toast);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setActiveToast(null), 3500);
  }, []);

  const flashProperty = useCallback((tileId) => {
    setFlashTile(tileId);
    setTimeout(() => setFlashTile(null), 1400);
  }, []);

  const showCard = useCallback((cardData) => {
    setActiveCard(cardData);
    setPendingCardDraw(null);
  }, []);

  const dismissCard = useCallback(() => {
    setActiveCard(null);
    setPendingCardDraw(null);
  }, []);

  const dismissPurchase = useCallback(() => setPendingPurchase(null), []);

  const dismissRent = useCallback(() => {
    clearTimeout(rentTimerRef.current);
    setRentInfo(null);
  }, []);

  return {
    // Card system
    pendingCardDraw,
    setPendingCardDraw,
    activeCard,
    setActiveCard,
    showCard,
    dismissCard,

    // Purchase modal
    pendingPurchase,
    setPendingPurchase,
    dismissPurchase,

    // Rent
    rentInfo,
    setRentInfo,
    dismissRent,

    // Trade
    activeTrade,
    setActiveTrade,

    // House/hotel
    houseBuiltInfo,
    setHouseBuiltInfo,

    // Visuals
    activeToast,
    showToast,
    flashTile,
    flashProperty,
  };
}
