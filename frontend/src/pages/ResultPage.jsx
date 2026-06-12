import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socketService from '../services/socketService';
import socket from '../socket/socket';
import CreatorFooter from '../components/CreatorFooter';

export default function ResultPage() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fireworks, setFireworks] = useState([]);

  // Feedback states
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [category, setCategory] = useState('');
  const [comment, setComment] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) {
      return setFeedbackError('Please select a star rating.');
    }
    if (!category) {
      return setFeedbackError('Please select a feedback category.');
    }
    
    setFeedbackLoading(true);
    setFeedbackError('');
    try {
      const stored = localStorage.getItem('mi_google_user');
      const user = stored ? JSON.parse(stored) : { playerId: 'guest', username: 'Guest' };
      
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
      const res = await fetch(`${BACKEND_URL}/api/feedback/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode,
          playerId: user.playerId,
          username: user.username,
          email: user.email || '',
          rating,
          category,
          comment
        })
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Submission failed');
      }
      setFeedbackSubmitted(true);
    } catch (err) {
      setFeedbackError(err.message || 'Failed to submit feedback. Try again.');
    } finally {
      setFeedbackLoading(false);
    }
  };

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

  // Update persistent Google Auth statistics once upon game completion
  useEffect(() => {
    if (!gameState || gameState.status !== 'finished') return;
    
    try {
      const stored = localStorage.getItem('mi_google_user');
      if (stored) {
        const user = JSON.parse(stored);
        const myIdInGame = sessionStorage.getItem('mi_playerId');
        
        // Find if this player is in the rankings
        const myRank = gameState.ranking?.find(r => r.playerId === myIdInGame);
        if (myRank) {
          // Check if we already registered this match outcome to prevent double counts
          const gameId = gameState.roomId || roomCode;
          const processedKey = `mi_processed_game_${gameId}`;
          const alreadyProcessed = localStorage.getItem(processedKey);
          
          if (!alreadyProcessed) {
            localStorage.setItem(processedKey, 'true');
            
            const isWinner = gameState.winnerId === myIdInGame;
            user.games = (user.games ?? 0) + 1;
            if (isWinner) {
              user.wins = (user.wins ?? 0) + 1;
            } else {
              user.losses = (user.losses ?? 0) + 1;
            }
            
            // Increment lifetime metrics from final match stats
            user.loansTaken = (user.loansTaken ?? 0) + (myRank.loansTaken ?? 0);
            user.propertiesPurchased = (user.propertiesPurchased ?? 0) + (myRank.propertiesPurchased ?? 0);
            user.totalNetWorthEarned = (user.totalNetWorthEarned ?? 0) + (myRank.netWorth ?? 0);
            user.propertiesMortgaged = (user.propertiesMortgaged ?? 0) + (myRank.propertiesMortgaged ?? 0);
            user.propertiesRepossessed = (user.propertiesRepossessed ?? 0) + (myRank.propertiesRepossessed ?? 0);
            user.auctionsWon = (user.auctionsWon ?? 0) + (myRank.auctionsWon ?? 0);
            user.rentPaid = (user.rentPaid ?? 0) + (myRank.rentPaid ?? 0);
            user.rentEarned = (user.rentEarned ?? 0) + (myRank.rentEarned ?? 0);
            user.bankruptcies = (user.bankruptcies ?? 0) + (myRank.isBankrupt ? 1 : 0);
            user.hotelsBuilt = (user.hotelsBuilt ?? 0) + (myRank.hotelsBuiltCount ?? 0);

            // Recalculate level
            user.level = Math.floor((user.wins ?? 0) * 0.3) + 1;
            
            localStorage.setItem('mi_google_user', JSON.stringify(user));

            // Sync updated stats to persistent backend server database
            if (!user.isGuest) {
              const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
              const headers = { 'Content-Type': 'application/json' };
              if (user.token) {
                headers['Authorization'] = `Bearer ${user.token}`;
              }
              fetch(`${BACKEND_URL}/api/auth/update-stats`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                  playerId: user.playerId,
                  wins: user.wins,
                  games: user.games,
                  losses: user.losses,
                  loansTaken: user.loansTaken,
                  propertiesPurchased: user.propertiesPurchased,
                  totalNetWorthEarned: user.totalNetWorthEarned,
                  propertiesMortgaged: user.propertiesMortgaged,
                  propertiesRepossessed: user.propertiesRepossessed,
                  auctionsWon: user.auctionsWon,
                  rentPaid: user.rentPaid,
                  rentEarned: user.rentEarned,
                  bankruptcies: user.bankruptcies,
                  hotelsBuilt: user.hotelsBuilt
                })
              }).catch(e => console.error("Failed to sync stats to server:", e));
            }
          }
        }
      }
    } catch (e) {
      console.error("Failed to update user stats:", e);
    }
  }, [gameState, roomCode]);

  // Determine winner and rank players
  const sortedRanking = useMemo(() => {
    if (!gameState || !gameState.ranking) return [];
    // Sort ranking by netWorth descending
    return [...gameState.ranking].sort((a, b) => b.netWorth - a.netWorth);
  }, [gameState]);

  const winner = sortedRanking[0];

  // Trigger gold fireworks once the results are successfully loaded
  useEffect(() => {
    if (!loading && gameState && sortedRanking.length > 0) {
      const newParticles = [];
      const burstPoints = [
        { x: '50vw', y: '50vh' },
        { x: '15vw', y: '80vh' },
        { x: '85vw', y: '80vh' },
        { x: '50vw', y: '25vh' }
      ];
      const colors = ['#fbbf24', '#f59e0b', '#d4af37', '#ffe082', '#ffffff'];

      burstPoints.forEach((point, pIdx) => {
        for (let i = 0; i < 35; i++) {
          const angle = Math.random() * Math.PI * 2;
          const distance = Math.random() * 250 + 50;
          const tx = Math.cos(angle) * distance;
          const ty = Math.sin(angle) * distance;
          const rot = Math.random() * 720;
          const size = Math.random() * 10 + 4;
          const color = colors[Math.floor(Math.random() * colors.length)];
          const delay = pIdx * 0.45 + Math.random() * 0.15; // staggered bursts

          newParticles.push({
            id: `p-${pIdx}-${i}`,
            x: point.x,
            y: point.y,
            tx,
            ty,
            rot,
            size,
            color,
            delay
          });
        }
      });

      setFireworks(newParticles);
    }
  }, [loading, gameState, sortedRanking]);

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

      {/* Gold Celebration Fireworks */}
      {fireworks.map(p => (
        <div
          key={p.id}
          style={{
            position: 'fixed',
            left: p.x,
            top: p.y,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: p.color,
            borderRadius: '50%',
            zIndex: 100,
            pointerEvents: 'none',
            '--tx': `${p.tx}px`,
            '--ty': `${p.ty}px`,
            '--rot': `${p.rot}deg`,
            animation: 'fireworkBurst 1.8s cubic-bezier(0.1, 0.8, 0.3, 1) forwards',
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}

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

        {/* 🏆 3D RANKING PEDESTAL & AUDIENCE SHOWCASE */}
        {winner && (
          <div style={{
            position: 'relative',
            background: 'radial-gradient(circle at center, rgba(212, 175, 55, 0.08) 0%, rgba(2, 6, 23, 0.5) 100%)',
            border: '2px solid #d4af37',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(212, 175, 55, 0.15)',
            borderRadius: 24,
            padding: '40px 20px',
            textAlign: 'center',
            marginBottom: 48,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}>
            {/* Crown icon with float animation */}
            <div style={{
              fontSize: 48,
              marginBottom: 20,
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
              marginBottom: 24,
            }}>
              Tournament Results
            </div>

            {/* 3D Podium Row */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              gap: '16px',
              width: '100%',
              maxWidth: '500px',
              marginBottom: '32px',
              height: '240px',
              position: 'relative',
            }}>
              {/* 2nd Place (Left) */}
              {sortedRanking[1] && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flex: 1,
                }}>
                  <span style={{ fontSize: '20px', marginBottom: 4 }}>
                    {sortedRanking[1].token || '🚗'}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 'bold', color: '#cbd5e1', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sortedRanking[1].username}
                  </span>
                  <span style={{ fontSize: 10, color: '#94a3b8', marginBottom: 8, fontWeight: 700 }}>
                    ₹{sortedRanking[1].netWorth.toLocaleString('en-IN')}
                  </span>
                  
                  {/* Podium block */}
                  <div style={{
                    width: '90px',
                    height: '90px',
                    background: 'linear-gradient(180deg, #cbd5e1 0%, #475569 100%)',
                    border: '1.5px solid rgba(255, 255, 255, 0.6)',
                    borderBottom: 'none',
                    borderRadius: '10px 10px 0 0',
                    boxShadow: '0 10px 20px rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: 'perspective(400px) rotateX(10deg)',
                  }}>
                    <span style={{ fontSize: 24, fontWeight: 900, color: '#94a3b8', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>2</span>
                  </div>
                </div>
              )}

              {/* 1st Place (Center) */}
              {sortedRanking[0] && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flex: 1.2,
                  transform: 'translateY(-10px)',
                }}>
                  <span style={{ fontSize: '28px', marginBottom: 4, display: 'inline-block', animation: 'crownFloat 1.5s ease-in-out infinite' }}>
                    {sortedRanking[0].token || '🎩'}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 'black', color: '#fbbf24', textShadow: '0 0 10px rgba(251,191,36,0.3)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sortedRanking[0].username}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#fde68a', marginBottom: 8 }}>
                    ₹{sortedRanking[0].netWorth.toLocaleString('en-IN')}
                  </span>
                  
                  {/* Podium block */}
                  <div style={{
                    width: '110px',
                    height: '130px',
                    background: 'linear-gradient(180deg, #fbbf24 0%, #b45309 100%)',
                    border: '2px solid #fff',
                    borderBottom: 'none',
                    borderRadius: '12px 12px 0 0',
                    boxShadow: '0 15px 30px rgba(245, 158, 11, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: 'perspective(400px) rotateX(10deg)',
                    position: 'relative',
                  }}>
                    <span style={{ fontSize: 36, fontWeight: 900, color: '#fff', textShadow: '0 2px 6px rgba(0,0,0,0.4)' }}>1</span>
                  </div>
                </div>
              )}

              {/* 3rd Place (Right) */}
              {sortedRanking[2] && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flex: 0.9,
                }}>
                  <span style={{ fontSize: '20px', marginBottom: 4 }}>
                    {sortedRanking[2].token || '🚂'}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 'bold', color: '#eab308', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sortedRanking[2].username}
                  </span>
                  <span style={{ fontSize: 10, color: '#94a3b8', marginBottom: 8, fontWeight: 700 }}>
                    ₹{sortedRanking[2].netWorth.toLocaleString('en-IN')}
                  </span>
                  
                  {/* Podium block */}
                  <div style={{
                    width: '80px',
                    height: '70px',
                    background: 'linear-gradient(180deg, #b45309 0%, #78350f 100%)',
                    border: '1.5px solid rgba(251, 191, 36, 0.4)',
                    borderBottom: 'none',
                    borderRadius: '8px 8px 0 0',
                    boxShadow: '0 8px 15px rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: 'perspective(400px) rotateX(10deg)',
                  }}>
                    <span style={{ fontSize: 20, fontWeight: 900, color: '#b45309', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>3</span>
                  </div>
                </div>
              )}
            </div>

            {/* Clapping Audience block */}
            <div style={{
              width: '100%',
              background: 'rgba(0,0,0,0.25)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '16px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
            }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>
                👏 Clapping Audience 👏
              </span>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: '12px',
              }}>
                {sortedRanking.slice(1).map((p, idx) => (
                  <div
                    key={p.playerId}
                    className="animate-clap"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#d1d5db',
                      animationDelay: `${idx * 0.15}s`,
                    }}
                  >
                    <span>👏</span>
                    <span>{p.username}</span>
                    <span style={{ opacity: 0.6 }}>{p.token || '🎲'}</span>
                  </div>
                ))}
                {sortedRanking.length <= 1 && (
                  <span style={{ fontSize: '12px', color: '#64748b' }}>No other landlords to clap!</span>
                )}
              </div>
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

        {/* DETAILED STATS SECTION */}
        <h2 style={{
          fontSize: 18,
          fontWeight: 800,
          color: '#cbd5e1',
          marginTop: 48,
          marginBottom: 20,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: 10,
        }}>
          📈 Player Performance & Statistics
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: 24,
          marginBottom: 48,
        }}>
          {sortedRanking.map((row) => (
            <div
              key={row.playerId}
              style={{
                background: 'rgba(2, 6, 23, 0.45)',
                border: row.playerId === winner?.playerId ? '1.5px solid rgba(212, 175, 55, 0.35)' : '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: 20,
                padding: '24px',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: row.playerId === winner?.playerId ? '#fde68a' : '#fff' }}>
                  {row.username} {row.playerId === winner?.playerId ? '👑' : ''}
                </span>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: 12,
                  background: row.isBankrupt ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                  border: row.isBankrupt ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(34, 197, 94, 0.3)',
                  color: row.isBankrupt ? '#f87171' : '#4ade80',
                  fontSize: 9,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                }}>
                  {row.isBankrupt ? 'Eliminated' : 'Active'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Net Worth */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingBottom: 6 }}>
                  <span style={{ color: '#94a3b8' }}>Net Worth</span>
                  <span style={{ fontWeight: 800, color: '#fbbf24' }}>₹{row.netWorth.toLocaleString('en-IN')}</span>
                </div>

                {/* Cash */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingBottom: 6 }}>
                  <span style={{ color: '#94a3b8' }}>Cash Balance</span>
                  <span style={{ fontWeight: 700, color: '#cbd5e1' }}>₹{row.cash.toLocaleString('en-IN')}</span>
                </div>

                {/* Properties Owned */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingBottom: 6 }}>
                  <span style={{ color: '#94a3b8' }}>Properties Owned</span>
                  <span style={{ fontWeight: 700, color: '#cbd5e1' }}>{row.propertiesOwnedCount} properties</span>
                </div>

                {/* Rent Collected */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingBottom: 6 }}>
                  <span style={{ color: '#94a3b8' }}>Rent Collected</span>
                  <span style={{ fontWeight: 700, color: '#34d399' }}>₹{(row.rentCollected ?? 0).toLocaleString('en-IN')}</span>
                </div>

                {/* Loans Taken */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingBottom: 6 }}>
                  <span style={{ color: '#94a3b8' }}>Loans Taken</span>
                  <span style={{ fontWeight: 700, color: '#f87171' }}>{row.loansTaken ?? 0}</span>
                </div>

                {/* Properties Repossessed */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#94a3b8' }}>Repossessed Assets</span>
                  <span style={{ fontWeight: 700, color: '#f87171' }}>{row.propertiesRepossessed ?? 0}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 💬 MATCH FEEDBACK CARD */}
        <div style={{
          background: 'rgba(2, 6, 23, 0.45)',
          border: '1.5px solid rgba(212, 175, 55, 0.2)',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
          borderRadius: 20,
          padding: '28px',
          marginBottom: 48,
          fontFamily: "'DM Sans', sans-serif",
          position: 'relative'
        }}>
          {feedbackSubmitted ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <span style={{ fontSize: 48, display: 'block', marginBottom: 12 }}>🎉</span>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fde68a', fontFamily: "'Playfair Display', serif", marginBottom: 6 }}>
                Feedback Submitted!
              </h3>
              <p style={{ fontSize: 13, color: '#94a3b8' }}>
                Thank you for helping us improve Monopoly India. Your review has been recorded.
              </p>
            </div>
          ) : (
            <form onSubmit={handleFeedbackSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fde68a', fontFamily: "'Playfair Display', serif", marginBottom: 4 }}>
                  💬 Rate Your Match
                </h3>
                <p style={{ fontSize: 12, color: '#94a3b8' }}>
                  Please share your feedback so we can improve the game mechanics and user experience.
                </p>
              </div>

              {/* Star Rating Selectors */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0' }}>
                {[1, 2, 3, 4, 5].map((star) => {
                  const isActive = (hoverRating || rating) >= star;
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(star)}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: 28,
                        color: isActive ? '#fbbf24' : 'rgba(255,255,255,0.15)',
                        cursor: 'pointer',
                        padding: 0,
                        transition: 'color 0.1s, transform 0.1s',
                        filter: isActive ? 'drop-shadow(0 0 8px rgba(251,191,36,0.5))' : 'none'
                      }}
                    >
                      ★
                    </button>
                  );
                })}
                {rating > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#fbbf24', marginLeft: 8, textTransform: 'uppercase' }}>
                    {rating === 1 ? 'Poor' : rating === 2 ? 'Fair' : rating === 3 ? 'Good' : rating === 4 ? 'Very Good' : 'Excellent!'}
                  </span>
                )}
              </div>

              {/* Category Selectors */}
              <div>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#cbd5e1', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                  Select Feedback Category
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {['Gameplay Rules', 'AI Bots Balance', 'UI/UX Design', 'Connection & Sockets', 'Other'].map((cat) => {
                    const isSelected = category === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.03)',
                          border: isSelected ? '1.5px solid #d4af37' : '1.5px solid rgba(255,255,255,0.08)',
                          color: isSelected ? '#fde68a' : '#94a3b8',
                          transition: 'all 0.2s'
                        }}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Comment Textbox */}
              <div>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#cbd5e1', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                  Write Your Review (Optional)
                </span>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="What did you like or dislike? How can we make the board game more entertaining?"
                  maxLength={400}
                  rows={3}
                  disabled={feedbackLoading}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(212,175,55,0.2)',
                    color: '#f3f4f6',
                    fontSize: 12,
                    outline: 'none',
                    fontFamily: "'DM Sans', sans-serif",
                    resize: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {feedbackError && (
                <p style={{ fontSize: 11, color: '#f87171', fontWeight: 600, margin: 0, textAlign: 'center' }}>
                  ⚠️ {feedbackError}
                </p>
              )}

              <button
                type="submit"
                disabled={feedbackLoading}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  cursor: 'pointer',
                  border: 'none',
                  background: feedbackLoading
                    ? 'rgba(180,83,9,0.3)'
                    : 'linear-gradient(135deg, #d97706 0%, #f59e0b 50%, #d97706 100%)',
                  color: '#030712',
                  boxShadow: '0 4px 15px rgba(245,158,11,0.25)',
                  transition: 'all 0.2s'
                }}
              >
                {feedbackLoading ? 'Submitting Review…' : 'Submit Review'}
              </button>
            </form>
          )}
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
        @keyframes fireworkBurst {
          0% { transform: translate3d(0, 0, 0) scale(1); opacity: 1; }
          100% { transform: translate3d(var(--tx), var(--ty), 0) scale(0.3) rotate(var(--rot)); opacity: 0; }
        }
        @keyframes audienceClap {
          0%, 100% { transform: scale(1) translateY(0); }
          50%       { transform: scale(1.06) translateY(-6px); }
        }
        .animate-clap {
          animation: audienceClap 0.6s infinite ease-in-out;
          display: inline-flex;
        }
      `}</style>
      <CreatorFooter />
    </div>
  );
}
