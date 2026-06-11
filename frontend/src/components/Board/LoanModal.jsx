/**
 * components/Board/LoanModal.jsx
 *
 * Premium modal for selecting and confirming a bank loan.
 * Features a luxury dark Monopoly theme, gold accents, and Tamil Nadu styling.
 */
import { useState } from 'react';

const fmt = (n) => Number(n ?? 0).toLocaleString('en-IN');

const MODAL_CSS = `
@keyframes loanModalIn {
  from { opacity:0; transform: translateY(32px) scale(0.95); }
  to   { opacity:1; transform: translateY(0)    scale(1); }
}
@keyframes loanModalOut {
  from { opacity:1; transform: translateY(0)    scale(1); }
  to   { opacity:0; transform: translateY(32px) scale(0.95); }
}
@keyframes goldGlow {
  0%,100% { box-shadow: 0 0 10px rgba(212,175,55,0.15); }
  50%      { box-shadow: 0 0 25px rgba(212,175,55,0.3); }
}
`;

let cssInjected = false;
function injectCSS() {
  if (cssInjected || typeof document === 'undefined') return;
  const s = document.createElement('style');
  s.textContent = MODAL_CSS;
  document.head.appendChild(s);
  cssInjected = true;
}

export function LoanModal({
  currentBalance = 0,
  onConfirm,
  onClose,
}) {
  injectCSS();
  const [amount, setAmount] = useState(3000);
  const [leaving, setLeaving] = useState(false);

  const interest = Math.floor(amount * 0.2);
  const repaymentTotal = amount + interest;

  const handleClose = () => {
    setLeaving(true);
    setTimeout(() => {
      onClose();
    }, 280);
  };

  const handleConfirm = () => {
    onConfirm(amount);
    handleClose();
  };

  const increment = () => {
    setAmount(prev => Math.min(5000, prev + 500));
  };

  const decrement = () => {
    setAmount(prev => Math.max(500, prev - 500));
  };

  return (
    <div
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         1500,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        background:     'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(12px)',
        animation:      leaving ? 'loanModalOut 0.3s ease-in forwards' : 'loanModalIn 0.35s cubic-bezier(0.34,1.2,0.64,1) forwards',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width:        400,
          maxWidth:     '95vw',
          borderRadius: 24,
          background:   'linear-gradient(165deg, #0e121a 0%, #06090e 100%)',
          border:       '2px solid #d4af37',
          boxShadow:    '0 24px 64px rgba(0,0,0,0.85), 0 0 40px rgba(212,175,55,0.15)',
          fontFamily:   "'DM Sans',sans-serif",
          overflow:     'hidden',
          padding:      '28px 24px',
          color:        '#f3f4f6',
          animation:    'goldGlow 3s ease-in-out infinite',
          position:     'relative',
        }}
      >
        {/* Luxury Gold Border Strip */}
        <div style={{
          position:   'absolute',
          top:        0,
          left:       0,
          right:      0,
          height:     4,
          background: 'linear-gradient(90deg, #b38728, #fbf5b7, #daae51, #fbf5b7, #aa771c)',
        }} />

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            fontSize:      11,
            fontWeight:    800,
            color:         '#d4af37',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            marginBottom:  4,
          }}>
            🏦 MADRAS BANKING CORP
          </div>
          <div style={{
            fontSize:   22,
            fontWeight: 900,
            fontFamily: "'Playfair Display', serif",
            color:      '#ffffff',
            letterSpacing: '0.02em',
          }}>
            Emergency Bank Loan
          </div>
          <div style={{
            fontSize:  12,
            color:     '#9ca3af',
            marginTop: 4,
          }}>
            Borrow up to ₹5,000 to keep your venture active.
          </div>
        </div>

        {/* Quick Amount Selection Chips */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 10,
          marginBottom: 20
        }}>
          {[1000, 3000, 5000].map(val => (
            <button
              key={val}
              onClick={() => setAmount(val)}
              style={{
                background: amount === val ? 'rgba(212,175,55,0.18)' : 'rgba(255,255,255,0.03)',
                border:     amount === val ? '1.5px solid #d4af37' : '1px solid rgba(255,255,255,0.08)',
                color:      amount === val ? '#fbf5b7' : '#9ca3af',
                padding:    '6px 16px',
                borderRadius: 20,
                fontSize:   12,
                fontWeight: 700,
                cursor:     'pointer',
                transition: 'all 0.2s',
              }}
            >
              ₹{fmt(val)}
            </button>
          ))}
        </div>

        {/* Amount Adjuster Box */}
        <div style={{
          background:   'rgba(255,255,255,0.02)',
          border:       '1px solid rgba(255,255,255,0.05)',
          borderRadius: 16,
          padding:      '20px 16px',
          marginBottom: 24,
          textAlign:    'center',
        }}>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8, fontWeight: 500 }}>
            SELECT LOAN AMOUNT
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            maxWidth: 240,
            margin: '0 auto 16px'
          }}>
            {/* Decrement Button */}
            <button
              onClick={decrement}
              disabled={amount <= 500}
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#ffffff',
                fontSize: 20,
                fontWeight: 'bold',
                cursor: amount <= 500 ? 'not-allowed' : 'pointer',
                opacity: amount <= 500 ? 0.3 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => { if (amount > 500) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
            >
              −
            </button>

            {/* Display amount */}
            <div style={{
              fontSize:   28,
              fontWeight: 900,
              color:      '#fbf5b7',
              fontFamily: "'Playfair Display', serif",
              textShadow: '0 2px 10px rgba(212,175,55,0.2)',
            }}>
              ₹{fmt(amount)}
            </div>

            {/* Increment Button */}
            <button
              onClick={increment}
              disabled={amount >= 5000}
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#ffffff',
                fontSize: 20,
                fontWeight: 'bold',
                cursor: amount >= 5000 ? 'not-allowed' : 'pointer',
                opacity: amount >= 5000 ? 0.3 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => { if (amount < 5000) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
            >
              +
            </button>
          </div>

          {/* Slider input */}
          <input
            type="range"
            min="500"
            max="5000"
            step="500"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            style={{
              width: '90%',
              accentColor: '#d4af37',
              cursor: 'pointer',
            }}
          />
        </div>

        {/* Statistics breakdown */}
        <div style={{
          display:        'flex',
          flexDirection:  'column',
          gap:            12,
          marginBottom:   28,
          background:     'rgba(0,0,0,0.15)',
          borderRadius:   16,
          padding:        '16px 18px',
          border:         '1px solid rgba(212,175,55,0.08)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: '#9ca3af' }}>Principal Amount</span>
            <span style={{ fontWeight: 700, color: '#f3f4f6' }}>₹{fmt(amount)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: '#9ca3af' }}>Interest Fee (20%)</span>
            <span style={{ fontWeight: 700, color: '#f87171' }}>+ ₹{fmt(interest)}</span>
          </div>
          <div style={{
            height: 1,
            background: 'rgba(255,255,255,0.06)',
            margin: '4px 0'
          }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
            <span style={{ color: '#d4af37', fontWeight: 600 }}>Total Repayment</span>
            <span style={{ fontWeight: 900, color: '#fbf5b7', fontSize: 16 }}>₹{fmt(repaymentTotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
            <span style={{ color: '#9ca3af' }}>Due In</span>
            <span style={{ fontWeight: 800, color: '#fbbf24' }}>5 turns</span>
          </div>
        </div>

        {/* Actions buttons */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={handleClose}
            style={{
              flex:            1,
              padding:         '12px 0',
              borderRadius:    12,
              background:      'rgba(255,255,255,0.04)',
              border:          '1px solid rgba(255,255,255,0.1)',
              color:           '#e5e7eb',
              fontWeight:      700,
              fontSize:        13,
              cursor:          'pointer',
              transition:      'background 0.2s',
              fontFamily:      "'DM Sans',sans-serif",
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
          >
            CANCEL
          </button>
          <button
            onClick={handleConfirm}
            style={{
              flex:            1,
              padding:         '12px 0',
              borderRadius:    12,
              background:      'linear-gradient(135deg, #d4af37 0%, #aa771c 100%)',
              border:          'none',
              color:           '#000000',
              fontWeight:      900,
              fontSize:        13,
              cursor:          'pointer',
              transition:      'opacity 0.2s',
              fontFamily:      "'DM Sans',sans-serif",
              boxShadow:       '0 4px 15px rgba(212,175,55,0.3)',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = 0.9}
            onMouseLeave={e => e.currentTarget.style.opacity = 1}
          >
            CONFIRM LOAN
          </button>
        </div>
      </div>
    </div>
  );
}
