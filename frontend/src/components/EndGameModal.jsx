import React from 'react';

export default function EndGameModal({
  isOpen,
  onClose,
  onRequestEnd,
  voteState, // { initiatorId, votes }
  myId,
  onVote, // (accept)
  players,
}) {
  if (!isOpen && !voteState) return null;

  const isInitiator = voteState?.initiatorId === myId;
  const alreadyVoted = voteState ? voteState.votes[myId] !== undefined : false;
  const initiatorName = voteState ? (players[voteState.initiatorId]?.username ?? 'A player') : '';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(5, 7, 12, 0.85)',
      backdropFilter: 'blur(10px)',
      animation: 'fadeIn 0.25s ease-out forwards',
    }}>
      <div style={{
        width: '90%',
        maxWidth: 460,
        background: 'radial-gradient(circle at top left, #0f172a, #020617)',
        border: '1.5px solid rgba(212, 175, 55, 0.45)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(212, 175, 55, 0.15)',
        borderRadius: 20,
        padding: '30px 24px',
        textAlign: 'center',
        position: 'relative',
        animation: 'slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
      }}>
        {/* Glow effect */}
        <div style={{
          position: 'absolute',
          top: 0, left: '50%', transform: 'translateX(-50%)',
          width: '60%', height: 2,
          background: 'linear-gradient(90deg, transparent, #d4af37, transparent)',
        }} />

        {!voteState ? (
          /* Initial confirmation modal */
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏛️</div>
            <h3 style={{
              fontSize: 22,
              fontWeight: 800,
              color: '#fde68a',
              letterSpacing: '0.05em',
              marginBottom: 12,
              fontFamily: "'Playfair Display', serif",
            }}>
              End Monopoly India?
            </h3>
            <p style={{
              fontSize: 14,
              color: '#94a3b8',
              lineHeight: 1.6,
              marginBottom: 28,
            }}>
              Do you want to finish the match and calculate the winner based on total net worth? This will initiate a vote among all active players.
            </p>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#cbd5e1',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
              >
                Cancel
              </button>
              <button
                onClick={onRequestEnd}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #d4af37, #b59023)',
                  border: 'none',
                  color: '#020617',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(212, 175, 55, 0.3)',
                  transition: 'transform 0.2s, boxShadow 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'scale(1.02)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(212, 175, 55, 0.45)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(212, 175, 55, 0.3)';
                }}
              >
                Request End Game
              </button>
            </div>
          </>
        ) : (
          /* Active voting popup */
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🗳️</div>
            <h3 style={{
              fontSize: 20,
              fontWeight: 800,
              color: '#fde68a',
              letterSpacing: '0.05em',
              marginBottom: 12,
              fontFamily: "'Playfair Display', serif",
            }}>
              {initiatorName} wants to end the game
            </h3>
            <p style={{
              fontSize: 14,
              color: '#94a3b8',
              lineHeight: 1.6,
              marginBottom: 20,
            }}>
              If approved, the match will finish instantly, and the winner will be determined by the highest net worth.
            </p>

            {/* Voting progress */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 12,
              padding: 16,
              marginBottom: 28,
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Votes Received
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {Object.values(players).filter(p => !p.isBankrupt).map(p => {
                  const vote = voteState.votes[p.id];
                  const hasVoted = vote !== undefined;
                  const voteText = vote === true ? '✅ Yes' : vote === false ? '❌ No' : '⏳ Pending';
                  const color = vote === true ? '#22c55e' : vote === false ? '#ef4444' : '#64748b';
                  return (
                    <div key={p.id} style={{
                      padding: '5px 10px',
                      borderRadius: 20,
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: `1.5px solid ${color}44`,
                      fontSize: 11,
                      fontWeight: 700,
                      color: hasVoted ? color : '#94a3b8',
                    }}>
                      {p.username}: {voteText}
                    </div>
                  );
                })}
              </div>
            </div>

            {isInitiator ? (
              <div style={{ fontSize: 13, fontStyle: 'italic', color: '#64748b' }}>
                Waiting for other players to vote...
              </div>
            ) : alreadyVoted ? (
              <div style={{ fontSize: 13, fontStyle: 'italic', color: '#22c55e', fontWeight: 700 }}>
                Your vote has been submitted! Waiting for others...
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button
                  onClick={() => onVote(false)}
                  style={{
                    flex: 1,
                    padding: '12px 20px',
                    borderRadius: 12,
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1.5px solid rgba(239, 68, 68, 0.3)',
                    color: '#fca5a5',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                >
                  Continue Playing
                </button>
                <button
                  onClick={() => onVote(true)}
                  style={{
                    flex: 1,
                    padding: '12px 20px',
                    borderRadius: 12,
                    background: 'rgba(34, 197, 94, 0.15)',
                    border: '1.5px solid rgba(34, 197, 94, 0.45)',
                    color: '#4ade80',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(34, 197, 94, 0.25)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(34, 197, 94, 0.15)'}
                >
                  Accept
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
