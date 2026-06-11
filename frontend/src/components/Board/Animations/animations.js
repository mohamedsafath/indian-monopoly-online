/**
 * components/Board/animations.js
 * Shared CSS keyframe strings and animation helpers.
 * Injected via a single <style> block in MonopolyBoard.
 */

export const BOARD_ANIMATIONS_CSS = `
  @keyframes tokenBounce {
    0%   { transform: translateY(-12px) scale(1.3); opacity: 0.7; }
    60%  { transform: translateY(3px)  scale(0.95); }
    80%  { transform: translateY(-2px) scale(1.02); }
    100% { transform: translateY(0)    scale(1);    opacity: 1; }
  }

  @keyframes tokenPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.5); }
    50%       { box-shadow: 0 0 0 8px rgba(255, 215, 0, 0);  }
  }

  @keyframes tokenGlow {
    0%, 100% { filter: drop-shadow(0 0 4px currentColor); }
    50%       { filter: drop-shadow(0 0 12px currentColor) brightness(1.3); }
  }

  @keyframes diceRoll {
    0%   { transform: rotate(0deg)   scale(1)    translateY(0);    }
    15%  { transform: rotate(180deg) scale(1.25) translateY(-20px); }
    30%  { transform: rotate(360deg) scale(1.1)  translateY(-8px);  }
    45%  { transform: rotate(450deg) scale(1.15) translateY(-15px); }
    60%  { transform: rotate(540deg) scale(1.05) translateY(-4px);  }
    75%  { transform: rotate(630deg) scale(1.1)  translateY(-8px);  }
    90%  { transform: rotate(700deg) scale(1.02) translateY(-2px);  }
    100% { transform: rotate(720deg) scale(1)    translateY(0);     }
  }

  @keyframes diceLand {
    0%   { transform: scale(1.2) rotate(var(--die-end-rot)); }
    40%  { transform: scale(0.9) rotate(var(--die-end-rot)); }
    70%  { transform: scale(1.05) rotate(var(--die-end-rot)); }
    100% { transform: scale(1) rotate(var(--die-end-rot)); }
  }

  @keyframes cardFlip {
    0%   { transform: rotateY(90deg) scale(0.8); opacity: 0; }
    50%  { transform: rotateY(0deg)  scale(1.05); opacity: 1; }
    100% { transform: rotateY(0deg)  scale(1); }
  }

  @keyframes cardDismiss {
    0%   { transform: translateY(0) scale(1); opacity: 1; }
    100% { transform: translateY(-30px) scale(0.8); opacity: 0; }
  }

  @keyframes ownershipFlash {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.4; }
  }

  @keyframes monopolyGlow {
    0%, 100% { box-shadow: 0 0 6px 2px currentColor; }
    50%       { box-shadow: 0 0 16px 4px currentColor; }
  }

  @keyframes panelSlideIn {
    0%   { opacity: 0; transform: translateX(24px) scale(0.97); }
    100% { opacity: 1; transform: translateX(0) scale(1); }
  }

  @keyframes panelSlideOut {
    0%   { opacity: 1; transform: translateX(0) scale(1); }
    100% { opacity: 0; transform: translateX(24px) scale(0.97); }
  }

  @keyframes currentPlayerPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(255,215,0,0.6), inset 0 0 20px rgba(255,215,0,0.1); }
    50%       { box-shadow: 0 0 0 6px rgba(255,215,0,0), inset 0 0 30px rgba(255,215,0,0.2); }
  }

  @keyframes houseAppear {
    0%   { transform: scale(0) translateY(-8px); opacity: 0; }
    80%  { transform: scale(1.2) translateY(0); opacity: 1; }
    100% { transform: scale(1) translateY(0); }
  }

  @keyframes boardShimmer {
    0%   { background-position: -200% center; }
    100% { background-position: 200% center;  }
  }

  @keyframes floatUpFade {
    0%   { transform: translateX(-50%) translateY(0); opacity: 1; }
    100% { transform: translateX(-50%) translateY(-40px); opacity: 0; }
  }

  .token-arrive   { animation: tokenBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
  .token-active   { animation: tokenGlow 1.8s ease-in-out infinite; }
  .dice-rolling   { animation: diceRoll3D 1.2s ease-in-out forwards; }
  .dice-landing   { animation: diceLand 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
  .card-flip      { animation: cardFlip 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
  .card-dismiss   { animation: cardDismiss 0.3s ease-in forwards; }
  .panel-in       { animation: panelSlideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
  .panel-out      { animation: panelSlideOut 0.25s ease-in forwards; }
  .house-appear   { animation: houseAppear 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
  .monopoly-glow  { animation: monopolyGlow 1.5s ease-in-out infinite; }
  .current-player { animation: currentPlayerPulse 2s ease-in-out infinite; }

  @keyframes diceRoll3D {
    0%   { transform: rotate3d(1, 1, 0, 0deg) scale(1) translateY(0); }
    20%  { transform: rotate3d(1, 2, 1, 180deg) scale(1.3) translateY(-25px); }
    40%  { transform: rotate3d(2, 1, 1, 360deg) scale(1.1) translateY(-10px); }
    60%  { transform: rotate3d(1, 3, 2, 540deg) scale(1.2) translateY(-20px); }
    80%  { transform: rotate3d(3, 1, 1, 720deg) scale(1.05) translateY(-5px); }
    100% { transform: rotate3d(0, 0, 0, 0deg) scale(1) translateY(0) rotate(var(--die-end-rot)); }
  }

  @keyframes turnFlash {
    0%   { opacity: 1; }
    100% { opacity: 0; }
  }

  @keyframes turnBanner {
    0%   { transform: scale(3) rotate(-5deg); opacity: 0; filter: blur(10px); }
    30%  { transform: scale(1) rotate(0deg); opacity: 1; filter: blur(0); }
    75%  { transform: scale(1.05); opacity: 1; }
    100% { transform: scale(0.5) translateY(-100px); opacity: 0; filter: blur(5px); }
  }

  @keyframes deedFlyToSidebar {
    0%   { transform: translate(-50%, -50%) scale(0) rotate(-10deg); opacity: 0; left: 50%; top: 50%; }
    20%  { transform: translate(-50%, -50%) scale(1.1) rotate(5deg); opacity: 1; left: 50%; top: 50%; }
    35%  { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 1; left: 50%; top: 50%; }
    70%  { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 1; left: 50%; top: 50%; }
    100% { transform: translate(-50%, -50%) scale(0.2) rotate(15deg); opacity: 0; left: var(--deed-dest-x, 90%); top: var(--deed-dest-y, 80%); }
  }

  @keyframes coinFly {
    0%   { transform: translate(0, 0) scale(0); opacity: 0; }
    10%  { transform: scale(1.2); opacity: 1; }
    90%  { transform: translate(var(--dx), var(--dy)) scale(1); opacity: 1; }
    100% { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0; }
  }

  @keyframes rentFloatUp {
    0%   { transform: translateY(0); opacity: 0; }
    20%  { opacity: 1; }
    80%  { opacity: 1; }
    100% { transform: translateY(-35px); opacity: 0; }
  }

  @keyframes audienceClap {
    0%, 100% { transform: scale(1) translateY(0); }
    50%       { transform: scale(1.06) translateY(-6px); }
  }

  .animate-clap   { animation: audienceClap 0.6s infinite ease-in-out; }
  .animate-turnFlash { animation: turnFlash 0.4s ease-out forwards; }
  .animate-turnBanner { animation: turnBanner 1.8s cubic-bezier(0.25, 1, 0.5, 1) forwards; }
  .animate-deedFly { animation: deedFlyToSidebar 1.7s cubic-bezier(0.25, 1, 0.5, 1) forwards; }
  .animate-coinFly { animation: coinFly 0.8s ease-in-out forwards; }
  .animate-rentFloat { animation: rentFloatUp 1.8s ease-out forwards; }
`;