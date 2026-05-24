import React from 'react';

export default function BankruptcyModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(5, 7, 12, 0.9)',
      backdropFilter: 'blur(12px)',
      animation: 'fadeIn 0.25s ease-out forwards',
    }}>
      <div style={{
        width: '90%',
        maxWidth: 420,
        background: 'radial-gradient(circle at top left, #1e1b4b, #03001e)',
        border: '1.5px solid rgba(239, 68, 68, 0.45)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 35px rgba(239, 68, 68, 0.2)',
        borderRadius: 20,
        padding: '36px 28px',
        textAlign: 'center',
        position: 'relative',
        animation: 'slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
      }}>
        {/* Top edge warning light */}
        <div style={{
          position: 'absolute',
          top: 0, left: '50%', transform: 'translateX(-50%)',
          width: '70%', height: 2,
          background: 'linear-gradient(90deg, transparent, #ef4444, transparent)',
        }} />

        <div style={{ fontSize: 56, marginBottom: 18 }}>💸</div>

        <h3 style={{
          fontSize: 24,
          fontWeight: 900,
          color: '#fecaca',
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          marginBottom: 14,
          fontFamily: "'Playfair Display', serif",
        }}>
          Bankrupt
        </h3>

        <p style={{
          fontSize: 14,
          color: '#cbd5e1',
          lineHeight: 1.6,
          marginBottom: 32,
        }}>
          You no longer have enough assets to continue in this match. You have been declared bankrupt.
        </p>

        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '14px 24px',
            borderRadius: 12,
            background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
            border: 'none',
            color: '#fff',
            fontSize: 14,
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
            transition: 'transform 0.2s, boxShadow 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.02)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(239, 68, 68, 0.55)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = '0 4px 14px rgba(239, 68, 68, 0.4)';
          }}
        >
          View Summary & Spectate
        </button>
      </div>
    </div>
  );
}
