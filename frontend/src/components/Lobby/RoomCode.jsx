/**
 * frontend/src/components/RoomCode.jsx
 *
 * Displays a room code in a styled box with a copy-to-clipboard button.
 *
 * Props:
 *   code  {string}  — 6-char room code
 */

import { useState } from 'react';

export default function RoomCode({ code = '' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const lobbyLink = `${window.location.origin}/lobby/${code}`;
    try {
      await navigator.clipboard.writeText(lobbyLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea');
      el.value = lobbyLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs font-semibold uppercase tracking-widest"
         style={{ color: '#9ca3af', fontFamily: "'DM Sans', sans-serif" }}>
        Room Code
      </p>

      <div className="flex items-center gap-3">
        {/* Code display */}
        <div
          onClick={handleCopy}
          onCopy={(e) => {
            e.preventDefault();
            e.clipboardData.setData('text/plain', `${window.location.origin}/game/${code}?join=true`);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          title="Click or copy to get lobby join link"
          className="px-5 py-2.5 rounded-lg font-black text-2xl tracking-[0.35em] select-all cursor-pointer transition-all duration-200 active:scale-95"
          style={{
            fontFamily: "'Playfair Display', serif",
            background: 'linear-gradient(135deg, #1c1205 0%, #2d1f08 100%)',
            border: '2px solid rgba(212,175,55,0.45)',
            color: '#fde68a',
            boxShadow: '0 0 24px rgba(212,175,55,0.15), inset 0 1px 0 rgba(255,255,255,0.05)',
            letterSpacing: '0.35em',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'rgba(212,175,55,0.85)';
            e.currentTarget.style.boxShadow = '0 0 32px rgba(212,175,55,0.35), inset 0 1px 0 rgba(255,255,255,0.05)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'rgba(212,175,55,0.45)';
            e.currentTarget.style.boxShadow = '0 0 24px rgba(212,175,55,0.15), inset 0 1px 0 rgba(255,255,255,0.05)';
          }}
        >
          {code}
        </div>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          title="Copy lobby join link"
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold
                     uppercase tracking-wider transition-all duration-200 cursor-pointer"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.1)',
            border: copied ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(245,158,11,0.3)',
            color: copied ? '#4ade80' : '#f59e0b',
          }}>
          {copied ? '✓ Copied' : '⎘ Copy Link'}
        </button>
      </div>

      <p className="text-xs" style={{ color: '#6b7280', fontFamily: "'DM Sans', sans-serif" }}>
        Share this link with friends to invite them
      </p>
    </div>
  );
}
