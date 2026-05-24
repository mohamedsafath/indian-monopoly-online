/**
 * frontend/src/components/PlayerCard.jsx
 *
 * Displays a single player in the lobby or game.
 *
 * Props:
 *   player    { id, username, ready, connected } — player data
 *   isHost    {boolean}  — show host crown
 *   isMe      {boolean}  — highlight self
 *   showReady {boolean}  — show ready badge (lobby mode)
 */

const TOKENS = ['🚗','🐘','🚆','👑','🛺','🐅','⚓','🎯'];
const COLORS  = [
  '#e74c3c','#3498db','#2ecc71','#f39c12',
  '#9b59b6','#1abc9c','#e67e22','#34495e',
];

export default function PlayerCard({
  player,
  isHost    = false,
  isMe      = false,
  showReady = true,
  index     = 0,
}) {
  const token = TOKENS[index % TOKENS.length];
  const color = COLORS[index % COLORS.length];

  const connected = player.connected !== false;

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200"
         style={{
           background: isMe
             ? 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(180,83,9,0.08) 100%)'
             : 'rgba(255,255,255,0.03)',
           border: isMe
             ? '1px solid rgba(245,158,11,0.35)'
             : '1px solid rgba(255,255,255,0.06)',
           opacity: connected ? 1 : 0.5,
         }}>

      {/* Avatar token */}
      <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
           style={{ background: `${color}22`, border: `2px solid ${color}55` }}>
        {token}
      </div>

      {/* Name + badges */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm truncate"
                style={{ color: isMe ? '#fde68a' : '#f3f4f6',
                         fontFamily: "'DM Sans', sans-serif" }}>
            {player.username}
          </span>

          {isMe && (
            <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                  style={{ background: 'rgba(245,158,11,0.18)', color: '#fbbf24',
                           fontFamily: "'DM Sans', sans-serif" }}>
              You
            </span>
          )}

          {isHost && (
            <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                  style={{ background: 'rgba(234,179,8,0.15)', color: '#facc15',
                           fontFamily: "'DM Sans', sans-serif" }}>
              👑 Host
            </span>
          )}

          {!connected && (
            <span className="text-xs px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171',
                           fontFamily: "'DM Sans', sans-serif" }}>
              Reconnecting…
            </span>
          )}
        </div>
      </div>

      {/* Ready indicator */}
      {showReady && (
        <div className="flex-shrink-0">
          {player.ready ? (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80',
                           border: '1px solid rgba(34,197,94,0.25)',
                           fontFamily: "'DM Sans', sans-serif" }}>
              ✓ Ready
            </span>
          ) : (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(107,114,128,0.15)', color: '#9ca3af',
                           border: '1px solid rgba(107,114,128,0.2)',
                           fontFamily: "'DM Sans', sans-serif" }}>
              Waiting
            </span>
          )}
        </div>
      )}
    </div>
  );
}
