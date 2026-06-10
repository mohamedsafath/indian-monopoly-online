/**
 * frontend/src/components/ConnectionStatus.jsx
 *
 * Small pill that shows live socket connection state.
 * Subscribes to socket events directly.
 */

import { useEffect, useState } from 'react';
import socket from '@/socket/socket';

const STATES = {
  connected:    { label: 'Connected',      dot: '#22c55e', glow: '#16a34a' },
  disconnected: { label: 'Disconnected',   dot: '#ef4444', glow: '#dc2626' },
  reconnecting: { label: 'Reconnecting…',  dot: '#f59e0b', glow: '#d97706' },
};

export default function ConnectionStatus({ className = '' }) {
  const [status, setStatus] = useState(socket.connected ? 'connected' : 'disconnected');

  useEffect(() => {
    const onConnect    = () => setStatus('connected');
    const onDisconnect = () => setStatus('disconnected');
    const onReconnect  = () => setStatus('reconnecting');

    socket.on('connect',           onConnect);
    socket.on('disconnect',        onDisconnect);
    socket.on('reconnect_attempt', onReconnect);
    socket.on('reconnect',         onConnect);

    return () => {
      socket.off('connect',           onConnect);
      socket.off('disconnect',        onDisconnect);
      socket.off('reconnect_attempt', onReconnect);
      socket.off('reconnect',         onConnect);
    };
  }, []);

  const { label, dot, glow } = STATES[status];

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                     select-none ${className}`}
         style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)',
                  fontFamily: "'DM Sans', sans-serif", color: '#d1d5db' }}>
      {/* Animated dot */}
      <span className="relative flex h-2 w-2">
        {status === 'connected' && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                style={{ background: glow }} />
        )}
        <span className="relative inline-flex rounded-full h-2 w-2"
              style={{ background: dot, boxShadow: `0 0 6px ${glow}` }} />
      </span>
      <span className="hidden md:inline">{label}</span>
    </div>
  );
}
