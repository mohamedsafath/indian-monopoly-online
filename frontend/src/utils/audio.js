/**
 * frontend/src/utils/audio.js
 *
 * Web Audio API synthesizer for gameplay sound effects.
 * Avoids loading latency, requires no external static audio files, and works offline.
 */

// Shared Audio Context (lazy-loaded on first user interaction)
let audioCtx = null;

const getAudioContext = () => {
  if (!audioCtx) {
    // Standard audio context initialization
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume context if suspended (common browser security policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
};

const isMuted = () => {
  return localStorage.getItem('mi_mute_sounds') === 'true';
};

export const toggleMute = () => {
  const current = isMuted();
  localStorage.setItem('mi_mute_sounds', (!current).toString());
  return !current;
};

export const getMuteStatus = () => {
  return isMuted();
};

/**
 * 🪙 Coin Clink Sound (Rent, Purchases, passing Go)
 */
export const playCoinSound = () => {
  if (isMuted()) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Coin sound consists of two rapid, high-pitched metallic arpeggio clinks
    const playClink = (time, pitch) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, time);
      osc.frequency.exponentialRampToValueAtTime(pitch * 1.5, time + 0.08);

      gainNode.gain.setValueAtTime(0.15, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(time);
      osc.stop(time + 0.2);
    };

    // First clink (higher frequency)
    playClink(now, 987.77); // B5 note
    // Second clink (delayed slightly, higher pitch)
    playClink(now + 0.08, 1318.51); // E6 note
  } catch (err) {
    console.warn('[Audio] Failed to play coin sound:', err.message);
  }
};

/**
 * 🎲 Dice Tumbling Sound (Rolling dice)
 */
export const playDiceRoll = () => {
  if (isMuted()) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Simulate tumbling by playing 5 short low-frequency noise-like ticks
    for (let i = 0; i < 6; i++) {
      const tickTime = now + i * 0.08;
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120 - i * 12, tickTime);
      
      gainNode.gain.setValueAtTime(0.2, tickTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, tickTime + 0.06);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(tickTime);
      osc.stop(tickTime + 0.07);
    }
  } catch (err) {
    console.warn('[Audio] Failed to play dice roll sound:', err.message);
  }
};

/**
 * 🔒 Jail Gate Clank (Sent to Jail)
 */
export const playJailSound = () => {
  if (isMuted()) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Metallic heavy clank (combination of low frequencies + quick drop)
    const playBar = (pitch, delaySec, gainVal) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(pitch, now + delaySec);
      osc.frequency.linearRampToValueAtTime(pitch / 2, now + delaySec + 0.3);

      gainNode.gain.setValueAtTime(gainVal, now + delaySec);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + delaySec + 0.35);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now + delaySec);
      osc.stop(now + delaySec + 0.4);
    };

    // Heavy iron gating effect (3 resonant bars slamming)
    playBar(110, 0, 0.3);
    playBar(90, 0.05, 0.25);
    playBar(70, 0.10, 0.2);
  } catch (err) {
    console.warn('[Audio] Failed to play jail sound:', err.message);
  }
};

/**
 * 🏆 Winner/Success Fanfare (Winning auction, winning match)
 */
export const playWinnerSound = () => {
  if (isMuted()) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Rising major arpeggio chords
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
    notes.forEach((pitch, idx) => {
      const time = now + idx * 0.12;
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(pitch, time);

      gainNode.gain.setValueAtTime(0.15, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.4);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(time);
      osc.stop(time + 0.45);
    });
  } catch (err) {
    console.warn('[Audio] Failed to play winner sound:', err.message);
  }
};

/**
 * 🤝 Trade Click / Propose Sound
 */
export const playTradeSound = () => {
  if (isMuted()) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Friendly dual sliding chirp
    const playChirp = (time, startFreq, endFreq) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(startFreq, time);
      osc.frequency.exponentialRampToValueAtTime(endFreq, time + 0.15);

      gainNode.gain.setValueAtTime(0.12, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(time);
      osc.stop(time + 0.2);
    };

    playChirp(now, 440, 660); // A4 to E5
    playChirp(now + 0.08, 554, 880); // C#5 to A5
  } catch (err) {
    console.warn('[Audio] Failed to play trade sound:', err.message);
  }
};

/**
 * 📉 Bankruptcy / Error Sound
 */
export const playBankruptcySound = () => {
  if (isMuted()) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Descending sad flat tone
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(110, now + 0.6);

    gainNode.gain.setValueAtTime(0.2, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.7);
  } catch (err) {
    console.warn('[Audio] Failed to play bankruptcy sound:', err.message);
  }
};
