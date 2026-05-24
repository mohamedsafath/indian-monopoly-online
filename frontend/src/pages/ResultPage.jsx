import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socketService from '../services/socketService';
import socket from '../socket/socket';

export default function ResultPage() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Initial state fetch
    socketService.getRoomState()
      .then((data) => {
        if (data.gameState) {
          setGameState(data.gameState);
        } else {
          setError('No game data found.');
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to fetch results.');
        setLoading(false);
      });

    // Listen for room updates just in case
    const handleGameUpdated = (envelope) => {
      if (envelope.ok && envelope.data) {
        setGameState(envelope.data);
      }
    };

    socket.on('game-updated', handleGameUpdated);
    return () => {
      socket.off('game-updated', handleGameUpdated);
    };
  }, [roomCode]);

  // Determine winner and rank players
  const sortedRanking = useMemo(() => {
    if (!gameState || !gameState.ranking) return [];
    // Sort ranking by netWorth descending
    return [...gameState.ranking].sort((a, b) => b.netWorth - a.netWorth);
  }, [gameState]);

  const winner = sortedRanking[0];

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#030712',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, animation: 'spin 2s linear infinite', marginBottom: 16 }}>👑</div>
          <p style={{ color: '#94a3b8', fontWeight: 600 }}>Calculating net worth...</p>
        </div>
      </div>
    );
  }

  if (error || !gameState || sortedRanking.length === 0) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#030712',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 16,
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <p style={{ color: '#ef4444', fontWeight: 700 }}>{error || 'Game results not available'}</p>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Return Home
        </button>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at top, #091326 0%, #030712 100%)',
      color: '#fff',
      padding: '60px 20px',
      fontFamily: "'DM Sans', sans-serif",
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      {/* Background patterns */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(212,175,55,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(212,175,55,0.015) 1px,transparent 1px)',
        backgroundSize: '30px 30px',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 840, position: 'relative', zIndex: 10 }}>
        {/* Title */}
        <div style={{
          textAlign: 'center',
          fontSize: 12,
          fontWeight: 900,
          letterSpacing: '0.3em',
          color: '#d4af37',
          textTransform: 'uppercase',
          marginBottom: 40,
        }}>
          🇮🇳 Monopoly India Match Results 🇮🇳
        </div>

        {/* 🏆 WINNER CARD */}
        {winner && (
          <div style={{
            position: 'relative',
            background: 'radial-gradient(circle at center, rgba(212, 175, 55, 0.08) 0%, rgba(2, 6, 23, 0.5) 100%)',
            border: '2px solid #d4af37',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(212, 175, 55, 0.15)',
            borderRadius: 24,
            padding: '40px 30px',
            textAlign: 'center',
            marginBottom: 48,
            overflow: 'hidden',
          }}>
            {/* Crown icon with float animation */}
            <div style={{
              fontSize: 64,
              marginBottom: 16,
              filter: 'drop-shadow(0 0 15px rgba(212,175,55,0.6))',
              animation: 'crownFloat 3s ease-in-out infinite',
            }}>
              👑
            </div>

            <div style={{
              fontSize: 11,
              fontWeight: 800,
              color: '#fde68a',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}>
              Grand Champion
            </div>

            <h1 style={{
              fontSize: 36,
              fontWeight: 900,
              fontFamily: "'Playfair Display', serif",
              background: 'linear-gradient(135deg, #fff 30%, #fde68a 70%, #d4af37)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: 10,
            }}>
              {winner.username}
            </h1>

            <p style={{
              fontSize: 14,
              color: '#94a3b8',
              marginBottom: 20,
            }}>
              Winner based on Highest Net Worth
            </p>

            <div style={{
              display: 'inline-block',
              padding: '8px 24px',
              borderRadius: 30,
              background: 'rgba(212, 175, 55, 0.15)',
              border: '1.5px solid rgba(212, 175, 55, 0.4)',
              color: '#fde68a',
              fontSize: 18,
              fontWeight: 900,
              letterSpacing: '0.05em',
            }}>
              Net Worth: ₹{winner.netWorth.toLocaleString('en-IN')}
            </div>
          </div>
        )}

        {/* RANKINGS SECTION */}
        <h2 style={{
          fontSize: 18,
          fontWeight: 800,
          color: '#cbd5e1',
          marginBottom: 20,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: 10,
        }}>
          📊 Leaderboard & Asset Summary
        </h2>

        {/* Luxury Ranking Table */}
        <div style={{
          background: 'rgba(2, 6, 23, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: 18,
          overflowX: 'auto',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
          marginBottom: 40,
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left',
            fontSize: 13,
          }}>
            <thead>
              <tr style={{
                background: 'rgba(255, 255, 255, 0.02)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              }}>
                <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: 800 }}>Rank</th>
                <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: 800 }}>Player Name</th>
                <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: 800, textAlign: 'right' }}>Cash</th>
                <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: 800, textAlign: 'center' }}>Props</th>
                <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: 800, textAlign: 'center' }}>Houses</th>
                <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: 800, textAlign: 'center' }}>Hotels</th>
                <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: 800, textAlign: 'right' }}>Net Worth</th>
                <th style={{ padding: '16px 20px', color: '#64748b', fontWeight: 800, textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedRanking.map((row, index) => {
                const isWinner = index === 0;
                const statusText = row.isBankrupt ? 'Bankrupt' : isWinner ? 'Winner' : 'Active';
                const statusColor = row.isBankrupt ? '#ef4444' : isWinner ? '#d4af37' : '#22c55e';
                const rowBg = isWinner ? 'rgba(212, 175, 55, 0.04)' : 'transparent';
                
                return (
                  <tr
                    key={row.playerId}
                    style={{
                      background: rowBg,
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = rowBg}
                  >
                    <td style={{ padding: '16px 20px', fontWeight: 800, color: isWinner ? '#d4af37' : '#64748b' }}>
                      {isWinner ? '🏆 1st' : `${index + 1}th`}
                    </td>
                    <td style={{ padding: '16px 20px', fontWeight: 700, color: isWinner ? '#fde68a' : '#cbd5e1' }}>
                      {row.username}
                    </td>
                    <td style={{ padding: '16px 20px', color: '#94a3b8', textAlign: 'right', fontWeight: 600 }}>
                      ₹{row.cash.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '16px 20px', color: '#94a3b8', textAlign: 'center', fontWeight: 600 }}>
                      {row.propertiesOwnedCount}
                    </td>
                    <td style={{ padding: '16px 20px', color: '#94a3b8', textAlign: 'center', fontWeight: 600 }}>
                      {row.housesCount}
                    </td>
                    <td style={{ padding: '16px 20px', color: '#94a3b8', textAlign: 'center', fontWeight: 600 }}>
                      {row.hotelsCount}
                    </td>
                    <td style={{ padding: '16px 20px', color: isWinner ? '#fde68a' : '#fff', fontWeight: 800, textAlign: 'right' }}>
                      ₹{row.netWorth.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: 20,
                        background: `${statusColor}15`,
                        border: `1px solid ${statusColor}35`,
                        color: statusColor,
                        fontSize: 10,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}>
                        {statusText}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '14px 28px',
              borderRadius: 12,
              background: 'linear-gradient(135deg, #1e293b, #0f172a)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#cbd5e1',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.border = '1px solid rgba(212, 175, 55, 0.3)'}
            onMouseLeave={e => e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.1)'}
          >
            🏠 Return Home
          </button>
        </div>
      </div>

      {/* Styled Animations CSS */}
      <style>{`
        @keyframes crownFloat {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-8px) scale(1.03); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
