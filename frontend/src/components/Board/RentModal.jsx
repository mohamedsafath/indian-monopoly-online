/**
 * components/Board/RentModal.jsx
 *
 * Informational and interactive modal shown after RENT_PAID event.
 * If the current client is the payer, it forces a click to "Pay Rent"
 * and animates the money deduction and a floating rent value.
 *
 * Props:
 *   rentInfo  — { amount, fromId, toId, partial }
 *   players   — enriched players map
 *   myId      — current client's player id
 *   onClose   — dismiss callback
 */
import React, { useState, useEffect } from 'react';

const fmt = (n) => Number(n ?? 0).toLocaleString('en-IN');

export function RentModal({ rentInfo, players, myId, onClose }) {
  if (!rentInfo) return null;

  const payer  = players?.[rentInfo.fromId];
  const owner  = players?.[rentInfo.toId];
  const isMe   = rentInfo.fromId === myId;
  const isPaid = rentInfo.toId === myId;
  
  const myMoney = players?.[myId]?.money ?? 0;

  const [status, setStatus] = useState(isMe ? 'unpaid' : 'unpaid');
  const [animatedMoney, setAnimatedMoney] = useState(myMoney);

  // Auto-dismiss for spectators (not me, not getting paid)
  useEffect(() => {
    if (!isMe && !isPaid) {
      const t = setTimeout(onClose, 3500);
      return () => clearTimeout(t);
    }
  }, [isMe, isPaid, onClose]);

  // Auto-trigger receive animation for the landlord
  useEffect(() => {
    if (isPaid && status === 'unpaid') {
      const t = setTimeout(() => {
        handleTriggerReceiveAnimation();
      }, 600);
      return () => clearTimeout(t);
    }
  }, [isPaid, status]);

  const handlePay = () => {
    if (status !== 'unpaid') return;
    setStatus('paying');

    const duration = 1000; // 1s
    const startTime = performance.now();
    const startVal = myMoney;
    const targetVal = myMoney - rentInfo.amount;

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const ease = progress * (2 - progress); // easeOutQuad
      const current = Math.round(startVal - (startVal - targetVal) * ease);
      setAnimatedMoney(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setTimeout(onClose, 500);
      }
    };
    requestAnimationFrame(animate);
  };

  const handleTriggerReceiveAnimation = () => {
    setStatus('paying');

    const duration = 1000; // 1s
    const startTime = performance.now();
    const startVal = myMoney;
    const targetVal = myMoney + rentInfo.amount;

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const ease = progress * (2 - progress);
      const current = Math.round(startVal + (targetVal - startVal) * ease);
      setAnimatedMoney(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setTimeout(onClose, 500);
      }
    };
    requestAnimationFrame(animate);
  };

  return (
    <div
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         1100,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        background:     'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <style>{`
        @keyframes rentFloatUp {
          0% { transform: translate(-50%, 0) scale(0.85); opacity: 0; }
          20% { transform: translate(-50%, -20px) scale(1.15); opacity: 1; }
          100% { transform: translate(-50%, -90px) scale(1); opacity: 0; }
        }
      `}</style>

      {/* Floating deduction feedback */}
      {status === 'paying' && (isMe || isPaid) && (
        <div
          style={{
            position: 'absolute',
            top: '32%',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 38,
            fontWeight: 900,
            color: isMe ? '#f87171' : '#4ade80',
            animation: 'rentFloatUp 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards',
            pointerEvents: 'none',
            textShadow: '0 4px 20px rgba(0,0,0,0.9)',
            zIndex: 1200,
          }}
        >
          {isMe ? '−' : '+'}₹{fmt(rentInfo.amount)}
        </div>
      )}

      <div
        onClick={e => e.stopPropagation()}
        style={{
          width:        340,
          maxWidth:     '92vw',
          borderRadius: 22,
          padding:      '28px 24px 24px',
          background:   'linear-gradient(160deg,#140205 0%,#090002 100%)',
          border:       `1.5px solid ${isMe ? 'rgba(239,68,68,0.4)' : isPaid ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.08)'}`,
          boxShadow:    `0 24px 80px rgba(0,0,0,0.85), 0 0 45px ${isMe ? 'rgba(239,68,68,0.12)' : isPaid ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.02)'}`,
          fontFamily:   "'DM Sans',sans-serif",
          textAlign:    'center',
          animation:    'propModalIn 0.3s cubic-bezier(0.34,1.2,0.64,1) forwards',
          position:     'relative',
        }}
      >
        <div style={{ fontSize: 44, marginBottom: 12 }}>
          {isMe ? '💸' : isPaid ? '💰' : '💸'}
        </div>

        <h3 style={{
          fontSize:   20, fontWeight: 900,
          color:      isMe ? '#f87171' : isPaid ? '#4ade80' : '#f3f4f6',
          margin:     '0 0 6px',
          lineHeight: 1.2,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          {isMe   ? 'Rent Due!'
          : isPaid ? 'Rent Received!'
          : 'Rent Transaction'}
        </h3>

        <div style={{ fontSize: 13, color: 'rgba(156,163,175,0.5)', marginBottom: 16 }}>
          {payer?.username} → {owner?.username}
        </div>

        <div style={{
          fontSize:   32, fontWeight: 900,
          color:      isMe ? '#f87171' : '#4ade80',
          marginBottom: 16,
          background: isMe ? 'linear-gradient(135deg,#f87171,#ef4444)' : 'linear-gradient(135deg,#4ade80,#10b981)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          ₹{fmt(rentInfo.amount)}
        </div>

        {rentInfo.partial && (
          <div style={{
            fontSize:   11, color: '#f59e0b', marginBottom: 12,
            fontWeight: 800,
            background: 'rgba(245,158,11,0.1)',
            padding: '4px 8px',
            borderRadius: 6,
            display: 'inline-block',
          }}>
            ⚠️ Partial payment due to low funds
          </div>
        )}

        {/* Balance displays for players in the transaction */}
        {(isMe || isPaid) && (
          <div
            style={{
              padding: '10px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              fontSize: 12,
              color: 'rgba(156,163,175,0.7)',
              fontWeight: 600,
              marginBottom: 16,
            }}
          >
            Your Balance:{' '}
            <span style={{ color: '#4ade80', fontWeight: 800 }}>
              ₹{fmt(animatedMoney)}
            </span>
          </div>
        )}

        {/* Interaction controls */}
        {isMe && status === 'unpaid' ? (
          <button
            onClick={handlePay}
            style={{
              padding: '12px',
              borderRadius: 12,
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: '#fff',
              fontWeight: 900,
              fontSize: 13,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(239,68,68,0.3)',
              fontFamily: "'DM Sans',sans-serif",
              width: '100%',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            💸 Pay Rent (₹{fmt(rentInfo.amount)})
          </button>
        ) : (
          <div
            style={{
              fontSize: 11,
              color: 'rgba(156,163,175,0.4)',
              letterSpacing: '0.05em',
            }}
          >
            {status === 'paying' ? '🔄 Animating payment...' : 'Tap anywhere to dismiss'}
          </div>
        )}
      </div>
    </div>
  );
}