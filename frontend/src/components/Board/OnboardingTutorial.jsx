import React, { useState, useEffect } from 'react';

export default function OnboardingTutorial({ isOpen, onClose }) {
  const [step, setStep] = useState(0);

  // Step 1: Dice & Movement Simulation States
  const [dice1, setDice1] = useState(3);
  const [dice2, setDice2] = useState(4);
  const [isRolling, setIsRolling] = useState(false);
  const [tokenPos, setTokenPos] = useState(0); // 0: START, 1: GST, 2: Chance, 3: Mumbai
  const [rollMessage, setRollMessage] = useState("Click 'Roll Dice' to start your journey around the track!");

  // Step 2: India's Spaces States
  const [activeSpaceTab, setActiveSpaceTab] = useState('tea_break');

  // Step 3: Monopoly & Build States
  const [houses, setHouses] = useState(0);
  const [hasHotel, setHasHotel] = useState(false);

  // Step 4: Liquidation & Debt Puzzle States
  const [cash, setCash] = useState(1000);
  const [isBengaluruMortgaged, setIsBengaluruMortgaged] = useState(false);
  const [isLoanTaken, setIsLoanTaken] = useState(false);
  const [puzzleSolved, setPuzzleSolved] = useState(false);

  // Reset interactive widgets on step changes to ensure freshness
  useEffect(() => {
    if (step === 0) {
      setDice1(3);
      setDice2(4);
      setTokenPos(0);
      setRollMessage("Click 'Roll Dice' to start your journey around the track!");
    } else if (step === 3) {
      setCash(1000);
      setIsBengaluruMortgaged(false);
      setIsLoanTaken(false);
      setPuzzleSolved(false);
    }
  }, [step]);

  if (!isOpen) return null;

  // Step 1 Simulator: Roll Dice & Step Token
  const handleRollDice = () => {
    if (isRolling) return;
    setIsRolling(true);
    setRollMessage("Rolling dice...");

    let counter = 0;
    const interval = setInterval(() => {
      setDice1(Math.floor(Math.random() * 6) + 1);
      setDice2(Math.floor(Math.random() * 6) + 1);
      counter++;
      if (counter > 8) {
        clearInterval(interval);
        
        const r1 = Math.floor(Math.random() * 3) + 1; // Limit movement range to stay within 4 spaces
        const r2 = Math.floor(Math.random() * 3) + 1;
        setDice1(r1);
        setDice2(r2);
        const rolledSum = r1 + r2;

        setIsRolling(false);
        setTokenPos(prev => {
          const next = (prev + rolledSum) % 4;
          const spaces = [
            "START 🇮🇳",
            "GST Tax 📋",
            "Chance Card 📦",
            "Mumbai Marine Drive 🏙️"
          ];
          
          let msg = `You rolled ${rolledSum} (${r1} + ${r2}) and advanced to ${spaces[next]}!`;
          if (prev + rolledSum >= 4) {
            msg += " Passed START and collected salary ₹2,000!";
          }
          setRollMessage(msg);
          return next;
        });
      }
    }, 60);
  };

  // Step 3 Simulator: Houses Rent Calculation
  const rentMultiplier = houses === 0 ? (1) : houses === 1 ? 4 : houses === 2 ? 10 : houses === 3 ? 22 : houses === 4 ? 30 : 40;
  const currentRent = hasHotel ? 20000 : (houses === 0 ? 500 : 500 * rentMultiplier);

  const handleBuild = () => {
    if (hasHotel) return;
    if (houses < 4) {
      setHouses(prev => prev + 1);
    } else {
      setHasHotel(true);
    }
  };

  const handleDemolish = () => {
    if (hasHotel) {
      setHasHotel(false);
      setHouses(4);
    } else if (houses > 0) {
      setHouses(prev => prev - 1);
    }
  };

  // Step 4 Simulator: Liquidation Puzzle Action
  const toggleBengaluruMortgage = () => {
    if (puzzleSolved) return;
    setIsBengaluruMortgaged(prev => {
      const mortgaged = !prev;
      if (mortgaged) {
        setCash(c => c + 1500);
      } else {
        setCash(c => c - 1650); // Unmortgage costs 10% fee
      }
      return mortgaged;
    });
  };

  const takeLoan = () => {
    if (puzzleSolved || isLoanTaken) return;
    setIsLoanTaken(true);
    setCash(c => c + 1000);
  };

  const payDebt = () => {
    if (cash >= 2000) {
      setCash(c => c - 2000);
      setPuzzleSolved(true);
    }
  };

  const resetPuzzle = () => {
    setCash(1000);
    setIsBengaluruMortgaged(false);
    setIsLoanTaken(false);
    setPuzzleSolved(false);
  };

  return (
    <div style={styles.overlay}>
      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalSlideUp {
          from { transform: scale(0.9) translateY(40px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes glowPulse {
          0%, 100% { border-color: rgba(212, 175, 55, 0.45); box-shadow: 0 10px 40px rgba(0, 0, 0, 0.85), 0 0 25px rgba(212, 175, 55, 0.15); }
          50% { border-color: rgba(212, 175, 55, 0.75); box-shadow: 0 10px 40px rgba(0, 0, 0, 0.85), 0 0 35px rgba(212, 175, 55, 0.25); }
        }
        @keyframes bounceToken {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .animate-token {
          animation: bounceToken 0.6s infinite ease-in-out;
        }
      `}</style>

      {/* Tutorial Container */}
      <div style={styles.modal}>
        {/* Top Edge Decorative Border */}
        <div style={styles.decorativeTop} />

        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerTitleWrap}>
            <span style={styles.headerIcon}>🎓</span>
            <div>
              <h2 style={styles.headerTitle}>Indian Monopoly Guide</h2>
              <span style={styles.headerSubtitle}>Master the board and build your fortune</span>
            </div>
          </div>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close tutorial">
            ✕
          </button>
        </div>

        {/* Main Body Grid */}
        <div style={styles.body}>
          
          {/* SLIDE 1: BOARD FLOW & MOVEMENT */}
          {step === 0 && (
            <div style={styles.slideContainer}>
              <div style={styles.slideLeft}>
                <h3 style={styles.slideTitle}>🎲 1. Dice & Board Movement</h3>
                <p style={styles.slideDesc}>
                  On your turn, you roll two dice and advance clockwise around the board's 40 spaces.
                </p>
                <div style={styles.bulletList}>
                  <div style={styles.bulletItem}>
                    <span style={styles.bulletDot}>✦</span>
                    <span><strong>Salary Day:</strong> Collect <strong>₹2,000</strong> every time you land on or pass the <strong>START</strong> space.</span>
                  </div>
                  <div style={styles.bulletItem}>
                    <span style={styles.bulletDot}>✦</span>
                    <span><strong>Rolling Doubles:</strong> Rolling identical numbers on your dice rewards you with an extra turn!</span>
                  </div>
                  <div style={styles.bulletItem}>
                    <span style={styles.bulletDot}>✦</span>
                    <span><strong>Double Trouble:</strong> Roll 3 consecutive doubles, and you're sent straight to Tihar Jail for tax evasion!</span>
                  </div>
                </div>
              </div>

              <div style={styles.slideRight}>
                <div style={styles.interactiveBox}>
                  <span style={styles.widgetHeader}>🚀 Try It: Roll & Move Simulator</span>
                  
                  {/* Dice visualizer */}
                  <div style={styles.diceContainer}>
                    <div style={{...styles.die, transform: isRolling ? 'rotate(15deg) scale(1.05)' : 'none'}}>{dice1}</div>
                    <div style={{...styles.die, transform: isRolling ? 'rotate(-15deg) scale(1.05)' : 'none'}}>{dice2}</div>
                  </div>

                  {/* Track visualization */}
                  <div style={styles.trackLayout}>
                    {[0, 1, 2, 3].map((idx) => {
                      const names = ["START", "GST Tax", "Chance", "Mumbai"];
                      const colors = ["#22c55e", "#ef4444", "#3b82f6", "#9333ea"];
                      const isTokenHere = tokenPos === idx;
                      return (
                        <div key={idx} style={{
                          ...styles.trackTile,
                          borderColor: isTokenHere ? '#d4af37' : 'rgba(255,255,255,0.08)',
                          background: isTokenHere ? 'rgba(212,175,55,0.08)' : 'rgba(255,255,255,0.01)',
                        }}>
                          <div style={{...styles.tileHeaderLine, background: colors[idx]}} />
                          <span style={styles.tileName}>{names[idx]}</span>
                          {isTokenHere && (
                            <div className="animate-token" style={styles.tokenPeg}>🚶</div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <p style={styles.widgetLog}>{rollMessage}</p>

                  <button
                    onClick={handleRollDice}
                    disabled={isRolling}
                    style={{
                      ...styles.widgetBtn,
                      background: isRolling ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, #d97706 0%, #f59e0b 50%, #d97706 100%)',
                      color: isRolling ? 'rgba(255,255,255,0.3)' : '#0a0805',
                      cursor: isRolling ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isRolling ? 'Rolling...' : '🎲 Roll Dice'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SLIDE 2: BOARD SPACES */}
          {step === 1 && (
            <div style={styles.slideContainer}>
              <div style={styles.slideLeft}>
                <h3 style={styles.slideTitle}>🇮🇳 2. India's Board Spaces</h3>
                <p style={styles.slideDesc}>
                  Every space on the Indian Monopoly board triggers a unique action when a player lands on it.
                </p>
                <div style={styles.bulletList}>
                  <div style={styles.bulletItem}>
                    <span style={styles.bulletDot}>✦</span>
                    <span><strong>Indian Cities:</strong> Buy unowned cities (e.g. Mumbai, Goa) to collect rent from landing opponents.</span>
                  </div>
                  <div style={styles.bulletItem}>
                    <span style={styles.bulletDot}>✦</span>
                    <span><strong>Taxes (GST/Income Tax):</strong> Landing on tax spaces forces you to pay fines to the public pot.</span>
                  </div>
                  <div style={styles.bulletItem}>
                    <span style={styles.bulletDot}>✦</span>
                    <span><strong>Tea Break:</strong> Land on this corner space to sweep the entire accumulated tax pot!</span>
                  </div>
                </div>
              </div>

              <div style={styles.slideRight}>
                <div style={styles.interactiveBox}>
                  <span style={styles.widgetHeader}>🔍 Click Spaces to Learn Rules</span>

                  {/* Tabs selector */}
                  <div style={styles.spacesTabContainer}>
                    <button
                      onClick={() => setActiveSpaceTab('tea_break')}
                      style={{...styles.spaceTabBtn, ...(activeSpaceTab === 'tea_break' ? styles.spaceTabBtnActive : {})}}
                    >
                      ☕ Tea Break
                    </button>
                    <button
                      onClick={() => setActiveSpaceTab('tihar_jail')}
                      style={{...styles.spaceTabBtn, ...(activeSpaceTab === 'tihar_jail' ? styles.spaceTabBtnActive : {})}}
                    >
                      🔒 Tihar Jail
                    </button>
                    <button
                      onClick={() => setActiveSpaceTab('chance_chest')}
                      style={{...styles.spaceTabBtn, ...(activeSpaceTab === 'chance_chest' ? styles.spaceTabBtnActive : {})}}
                    >
                      📦 Chance/Chest
                    </button>
                  </div>

                  {/* Spaces Details Card */}
                  <div style={styles.spacesTabCard}>
                    {activeSpaceTab === 'tea_break' && (
                      <div style={styles.tabContent}>
                        <div style={styles.tabContentIcon}>☕</div>
                        <h4 style={styles.tabContentTitle}>Tea Break Corner</h4>
                        <p style={styles.tabContentDesc}>
                          All government taxes (GST, Income Tax) and Jail escape fines are deposited here. Any player who lands directly on this space wins the entire jackpot instantly!
                        </p>
                        <span style={styles.tabContentBadge}>💰 Average Jackpot: ₹1,500 - ₹5,000</span>
                      </div>
                    )}
                    {activeSpaceTab === 'tihar_jail' && (
                      <div style={styles.tabContent}>
                        <div style={styles.tabContentIcon}>🔒</div>
                        <h4 style={styles.tabContentTitle}>Tihar Jail</h4>
                        <p style={styles.tabContentDesc}>
                          Sent to jail? Your token is locked. You can escape by paying a ₹500 fine, using a Get Out of Jail Free card, or attempting to roll doubles on your next three turns.
                        </p>
                        <span style={styles.tabContentBadge}>⚠️ If you fail to escape in 3 turns, fine is forced!</span>
                      </div>
                    )}
                    {activeSpaceTab === 'chance_chest' && (
                      <div style={styles.tabContent}>
                        <div style={styles.tabContentIcon}>📦</div>
                        <h4 style={styles.tabContentTitle}>Chance & Community Chest</h4>
                        <p style={styles.tabContentDesc}>
                          Draw unpredictable event cards. You might get a Diwali Bonus (+₹1,000), win IPL sponsorship deals, or get fined for speeding in Delhi traffic (-₹500).
                        </p>
                        <span style={styles.tabContentBadge}>🃏 Dynamic event triggers every game</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SLIDE 3: MONOPOLIES & CONSTRUCTIONS */}
          {step === 2 && (
            <div style={styles.slideContainer}>
              <div style={styles.slideLeft}>
                <h3 style={styles.slideTitle}>🏠 3. Monopolies & Upgrades</h3>
                <p style={styles.slideDesc}>
                  Own all properties of a single color group to unlock massive scaling rent!
                </p>
                <div style={styles.bulletList}>
                  <div style={styles.bulletItem}>
                    <span style={styles.bulletDot}>✦</span>
                    <span><strong>Double Rent:</strong> Simply owning a full Monopoly group doubles the base rent of those properties.</span>
                  </div>
                  <div style={styles.bulletItem}>
                    <span style={styles.bulletDot}>✦</span>
                    <span><strong>Houses (Up to 4):</strong> Build houses to exponentially scale rent. Houses must be built evenly across properties.</span>
                  </div>
                  <div style={styles.bulletItem}>
                    <span style={styles.bulletDot}>✦</span>
                    <span><strong>Hotels:</strong> Upgrade a property with 4 houses into a Hotel. It unlocks the maximum devastating rent tier!</span>
                  </div>
                </div>
              </div>

              <div style={styles.slideRight}>
                <div style={styles.interactiveBox}>
                  <span style={styles.widgetHeader}>🏠 Try It: Dynamic Build Simulator</span>

                  {/* Mock property card */}
                  <div style={styles.propCard}>
                    <div style={styles.propCardHeader}>
                      {hasHotel ? (
                        <div style={styles.propCardHotelBadge}>🏨 HOTEL UPGRADE</div>
                      ) : houses > 0 ? (
                        <div style={styles.propCardHousesBadge}>
                          {Array.from({length: houses}).map((_, i) => (
                            <span key={i}>🏠</span>
                          ))}
                        </div>
                      ) : (
                        <span style={{color: 'rgba(255,255,255,0.4)', fontSize: 10}}>NO BUILDINGS</span>
                      )}
                      <h4 style={styles.propCardTitle}>MUMBAI</h4>
                      <span style={styles.propCardSub}>Marine Drive</span>
                    </div>

                    <div style={styles.propCardRentSection}>
                      <div style={styles.rentScaleRow}>
                        <span>Base Rent</span>
                        <span>₹500</span>
                      </div>
                      <div style={{...styles.rentScaleRow, color: houses === 0 && !hasHotel ? '#f59e0b' : '#9ca3af', fontWeight: houses === 0 && !hasHotel ? 'bold' : 'normal'}}>
                        <span>Monopoly (Unimproved)</span>
                        <span>₹1,000</span>
                      </div>
                      <div style={{...styles.rentScaleRow, color: houses === 1 ? '#f59e0b' : '#9ca3af', fontWeight: houses === 1 ? 'bold' : 'normal'}}>
                        <span>With 1 House</span>
                        <span>₹2,000</span>
                      </div>
                      <div style={{...styles.rentScaleRow, color: houses === 2 ? '#f59e0b' : '#9ca3af', fontWeight: houses === 2 ? 'bold' : 'normal'}}>
                        <span>With 2 Houses</span>
                        <span>₹5,000</span>
                      </div>
                      <div style={{...styles.rentScaleRow, color: houses === 3 ? '#f59e0b' : '#9ca3af', fontWeight: houses === 3 ? 'bold' : 'normal'}}>
                        <span>With 3 Houses</span>
                        <span>₹11,000</span>
                      </div>
                      <div style={{...styles.rentScaleRow, color: houses === 4 && !hasHotel ? '#f59e0b' : '#9ca3af', fontWeight: houses === 4 && !hasHotel ? 'bold' : 'normal'}}>
                        <span>With 4 Houses</span>
                        <span>₹15,000</span>
                      </div>
                      <div style={{...styles.rentScaleRow, color: hasHotel ? '#ef4444' : '#9ca3af', fontWeight: hasHotel ? 'bold' : 'normal'}}>
                        <span>🔥 WITH HOTEL</span>
                        <span>₹20,000</span>
                      </div>
                    </div>

                    <div style={styles.propCardRentBadge}>
                      Current Rent: <strong style={{color: hasHotel ? '#f43f5e' : '#fbbf24', marginLeft: 4}}>₹{currentRent.toLocaleString()}</strong>
                    </div>
                  </div>

                  {/* Build action controls */}
                  <div style={styles.buildControls}>
                    <button
                      onClick={handleDemolish}
                      disabled={houses === 0 && !hasHotel}
                      style={{
                        ...styles.buildBtn,
                        background: (houses === 0 && !hasHotel) ? 'rgba(255,255,255,0.03)' : 'rgba(239, 68, 68, 0.1)',
                        color: (houses === 0 && !hasHotel) ? 'rgba(255,255,255,0.2)' : '#ef4444',
                        border: `1px solid ${(houses === 0 && !hasHotel) ? 'rgba(255,255,255,0.05)' : 'rgba(239, 68, 68, 0.3)'}`,
                      }}
                    >
                      🔨 Demolish
                    </button>
                    <button
                      onClick={handleBuild}
                      disabled={hasHotel}
                      style={{
                        ...styles.buildBtn,
                        background: hasHotel ? 'rgba(255,255,255,0.03)' : 'rgba(34, 197, 94, 0.1)',
                        color: hasHotel ? 'rgba(255,255,255,0.2)' : '#22c55e',
                        border: `1px solid ${hasHotel ? 'rgba(255,255,255,0.05)' : 'rgba(34, 197, 94, 0.3)'}`,
                      }}
                    >
                      {hasHotel ? 'Fully Built' : houses === 4 ? '🏨 Upgrade Hotel' : '🏠 Build House'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SLIDE 4: CASH FLOW & LIQUIDATIONS */}
          {step === 3 && (
            <div style={styles.slideContainer}>
              <div style={styles.slideLeft}>
                <h3 style={styles.slideTitle}>🏦 4. Cash Flow & Mortgages</h3>
                <p style={styles.slideDesc}>
                  Maintain positive cash flow! If your balance falls below zero, you must raise cash to exit debt before ending your turn.
                </p>
                <div style={styles.bulletList}>
                  <div style={styles.bulletItem}>
                    <span style={styles.bulletDot}>✦</span>
                    <span><strong>Mortgage:</strong> Repossess 50% of the property value immediately. Mortgaged properties stop yielding rent.</span>
                  </div>
                  <div style={styles.bulletItem}>
                    <span style={styles.bulletDot}>✦</span>
                    <span><strong>Emergency Loan:</strong> Apply for a Madras Banking Corp loan. Repay in 5 turns with 20% interest added.</span>
                  </div>
                  <div style={styles.bulletItem}>
                    <span style={styles.bulletDot}>✦</span>
                    <span><strong>Bankruptcy:</strong> If you cannot pay off your debts through trades, loans, or mortgages, you must declare default.</span>
                  </div>
                </div>
              </div>

              <div style={styles.slideRight}>
                <div style={styles.interactiveBox}>
                  <span style={styles.widgetHeader}>💡 Puzzle: Pay off the ₹2,000 Rent Debt!</span>

                  {/* Bank dashboard stats */}
                  <div style={styles.liquidationDashboard}>
                    <div style={styles.statsRow}>
                      <span style={{color: 'rgba(255,255,255,0.5)'}}>Your Cash:</span>
                      <strong style={{color: cash >= 2000 ? '#22c55e' : '#f43f5e', fontSize: 16}}>₹{cash.toLocaleString()}</strong>
                    </div>
                    <div style={styles.statsRow}>
                      <span style={{color: 'rgba(255,255,255,0.5)'}}>Debt Required:</span>
                      <strong style={{color: '#f43f5e', fontSize: 16}}>₹2,000</strong>
                    </div>
                  </div>

                  {/* Puzzle Controls */}
                  {puzzleSolved ? (
                    <div style={styles.puzzleSuccessBox}>
                      <span style={{fontSize: 28}}>🎉</span>
                      <h4 style={styles.successTitle}>Debt Resolved!</h4>
                      <p style={styles.successDesc}>Excellent! You raised enough money to clear your debts. You are ready to rule the Indian Monopoly board!</p>
                      <button onClick={resetPuzzle} style={styles.resetBtn}>Reset Simulation</button>
                    </div>
                  ) : (
                    <div style={styles.puzzleActionList}>
                      {/* Action 1: Mortgage property */}
                      <button
                        onClick={toggleBengaluruMortgage}
                        style={{
                          ...styles.puzzleActionItem,
                          borderColor: isBengaluruMortgaged ? '#991b1b' : 'rgba(255, 255, 255, 0.08)',
                          background: isBengaluruMortgaged ? 'rgba(153, 27, 27, 0.15)' : 'rgba(255,255,255,0.02)'
                        }}
                      >
                        <div>
                          <div style={{fontSize: 12, fontWeight: 'bold', color: '#cbd5e1'}}>Bengaluru Property</div>
                          <div style={{fontSize: 10, color: 'rgba(255,255,255,0.4)'}}>
                            {isBengaluruMortgaged ? '🚫 Mortgaged' : '🏠 Rent active'}
                          </div>
                        </div>
                        <span style={{fontSize: 11, fontWeight: 'bold', color: isBengaluruMortgaged ? '#ef4444' : '#22c55e'}}>
                          {isBengaluruMortgaged ? 'Unmortgage (-₹1,650)' : 'Mortgage (+₹1,500)'}
                        </span>
                      </button>

                      {/* Action 2: Bank Loan */}
                      <button
                        onClick={takeLoan}
                        disabled={isLoanTaken}
                        style={{
                          ...styles.puzzleActionItem,
                          opacity: isLoanTaken ? 0.5 : 1,
                          cursor: isLoanTaken ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <div>
                          <div style={{fontSize: 12, fontWeight: 'bold', color: '#cbd5e1'}}>Madras Bank Loan</div>
                          <div style={{fontSize: 10, color: 'rgba(255,255,255,0.4)'}}>
                            {isLoanTaken ? 'Loan active' : 'Borrow cash'}
                          </div>
                        </div>
                        <span style={{fontSize: 11, fontWeight: 'bold', color: '#3b82f6'}}>
                          {isLoanTaken ? 'Loan Taken' : 'Take Loan (+₹1,000)'}
                        </span>
                      </button>

                      {/* Trigger resolve */}
                      <button
                        onClick={payDebt}
                        disabled={cash < 2000}
                        style={{
                          ...styles.payDebtBtn,
                          background: cash >= 2000 ? 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)' : 'rgba(255,255,255,0.03)',
                          color: cash >= 2000 ? '#ffffff' : 'rgba(255,255,255,0.2)',
                          cursor: cash >= 2000 ? 'pointer' : 'not-allowed',
                          boxShadow: cash >= 2000 ? '0 4px 15px rgba(34,197,94,0.3)' : 'none'
                        }}
                      >
                        💸 Pay Rent Debt (₹2,000)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer controls */}
        <div style={styles.footer}>
          
          {/* Skip Button */}
          <button style={styles.skipBtn} onClick={onClose}>
            Skip Guide
          </button>

          {/* Dots Indicator */}
          <div style={styles.dotsContainer}>
            {[0, 1, 2, 3].map((idx) => {
              const isActive = step === idx;
              return (
                <button
                  key={idx}
                  onClick={() => setStep(idx)}
                  style={{
                    ...styles.dot,
                    width: isActive ? 24 : 8,
                    background: isActive ? '#f59e0b' : 'rgba(255,255,255,0.25)',
                    borderRadius: isActive ? 4 : '50%',
                  }}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              );
            })}
          </div>

          {/* Navigation Buttons */}
          <div style={styles.navBtnGroup}>
            {step > 0 && (
              <button
                style={styles.backBtn}
                onClick={() => setStep(prev => prev - 1)}
              >
                Back
              </button>
            )}
            
            {step < 3 ? (
              <button
                style={styles.nextBtn}
                onClick={() => setStep(prev => prev + 1)}
              >
                Next
              </button>
            ) : (
              <button
                style={styles.finishBtn}
                onClick={onClose}
              >
                Start Game!
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 2200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(5, 4, 3, 0.9)',
    backdropFilter: 'blur(12px)',
    animation: 'modalFadeIn 0.22s ease-out forwards',
    padding: 16,
  },
  modal: {
    width: '100%',
    maxWidth: 860,
    background: 'radial-gradient(circle at top left, #1c0f00 0%, #0a0805 70%, #050302 100%)',
    border: '1.5px solid rgba(212, 175, 55, 0.45)',
    borderRadius: 20,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    animation: 'modalSlideUp 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, glowPulse 4s infinite ease-in-out',
    overflow: 'hidden',
  },
  decorativeTop: {
    position: 'absolute',
    top: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '80%',
    height: 2,
    background: 'linear-gradient(90deg, transparent, #d4af37, #fde68a, #d4af37, transparent)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid rgba(212, 175, 55, 0.15)',
    background: 'rgba(0,0,0,0.2)',
  },
  headerTitleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    fontSize: 28,
    filter: 'drop-shadow(0 0 8px rgba(212,175,55,0.5))',
  },
  headerTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    fontFamily: "'Playfair Display', serif",
    background: 'linear-gradient(135deg, #d4af37 0%, #fde68a 50%, #f59e0b 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  headerSubtitle: {
    fontSize: 11,
    color: 'rgba(156, 163, 175, 0.6)',
    fontFamily: "'DM Sans', sans-serif",
    letterSpacing: '0.05em',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(156, 163, 175, 0.7)',
    fontSize: 18,
    cursor: 'pointer',
    padding: 6,
    transition: 'color 0.2s',
    fontFamily: 'monospace',
    outline: 'none',
    ':hover': {
      color: '#ef4444',
    },
  },
  body: {
    flex: 1,
    padding: 24,
    minHeight: 380,
    maxHeight: 520,
    overflowY: 'auto',
  },
  slideContainer: {
    display: 'flex',
    flexDirection: 'row',
    gap: 28,
    height: '100%',
    alignItems: 'stretch',
    flexWrap: 'wrap',
  },
  slideLeft: {
    flex: '1 1 320px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 12,
  },
  slideTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 800,
    color: '#f3f4f6',
    fontFamily: "'Playfair Display', serif",
  },
  slideDesc: {
    margin: 0,
    fontSize: 13,
    color: 'rgba(209, 213, 219, 0.8)',
    lineHeight: 1.6,
  },
  bulletList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginTop: 8,
  },
  bulletItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    fontSize: 12,
    color: 'rgba(209, 213, 219, 0.75)',
    lineHeight: 1.5,
  },
  bulletDot: {
    color: '#d4af37',
    fontWeight: 'bold',
    flexShrink: 0,
  },
  slideRight: {
    flex: '1 1 320px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  interactiveBox: {
    width: '100%',
    maxWidth: 360,
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 12,
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
  },
  widgetHeader: {
    fontSize: 11,
    fontWeight: 800,
    color: 'rgba(212, 175, 55, 0.7)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    textAlign: 'center',
  },
  diceContainer: {
    display: 'flex',
    justifyContent: 'center',
    gap: 16,
    margin: '8px 0',
  },
  die: {
    width: 44,
    height: 44,
    background: 'radial-gradient(circle, #ffffff 0%, #e2e8f0 100%)',
    border: '1.5px solid #cbd5e1',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    boxShadow: '0 4px 10px rgba(0,0,0,0.3), inset 0 -3px 0 rgba(0,0,0,0.1)',
    transition: 'transform 0.1s ease',
  },
  trackLayout: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 6,
    margin: '6px 0',
  },
  trackTile: {
    aspectRatio: '1',
    border: '1px solid',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 4,
    transition: 'all 0.2s',
  },
  tileHeaderLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  tileName: {
    fontSize: 8,
    fontWeight: 'bold',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    wordBreak: 'break-word',
  },
  tokenPeg: {
    position: 'absolute',
    fontSize: 16,
    bottom: 4,
    textShadow: '0 2px 4px rgba(0,0,0,0.6)',
  },
  widgetLog: {
    margin: 0,
    fontSize: 11,
    color: 'rgba(209, 213, 219, 0.7)',
    minHeight: 34,
    lineHeight: 1.4,
    textAlign: 'center',
  },
  widgetBtn: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 800,
    transition: 'all 0.15s ease',
    outline: 'none',
  },
  spacesTabContainer: {
    display: 'flex',
    gap: 4,
    background: 'rgba(0,0,0,0.2)',
    padding: 3,
    borderRadius: 8,
  },
  spaceTabBtn: {
    flex: 1,
    padding: '6px 4px',
    border: 'none',
    background: 'transparent',
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: 'bold',
    cursor: 'pointer',
    borderRadius: 6,
    transition: 'all 0.2s',
    outline: 'none',
  },
  spaceTabBtnActive: {
    background: 'rgba(212,175,55,0.15)',
    color: '#fbbf24',
  },
  spacesTabCard: {
    background: 'rgba(0,0,0,0.15)',
    border: '1px solid rgba(255,255,255,0.04)',
    borderRadius: 10,
    padding: 12,
    minHeight: 140,
  },
  tabContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    textAlign: 'center',
  },
  tabContentIcon: {
    fontSize: 24,
  },
  tabContentTitle: {
    margin: 0,
    fontSize: 13,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  tabContentDesc: {
    margin: 0,
    fontSize: 11,
    color: 'rgba(209, 213, 219, 0.7)',
    lineHeight: 1.4,
  },
  tabContentBadge: {
    fontSize: 9,
    color: '#fbbf24',
    background: 'rgba(245,158,11,0.08)',
    padding: '2px 8px',
    borderRadius: 4,
    marginTop: 4,
  },
  propCard: {
    width: '100%',
    maxWidth: 240,
    margin: '0 auto',
    background: '#ffffff',
    borderRadius: 10,
    overflow: 'hidden',
    boxShadow: '0 6px 16px rgba(0,0,0,0.4)',
    display: 'flex',
    flexDirection: 'column',
  },
  propCardHeader: {
    background: '#1e3a8a',
    color: '#ffffff',
    padding: '12px 8px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },
  propCardHotelBadge: {
    background: '#ef4444',
    color: '#ffffff',
    fontSize: 8,
    fontWeight: 'black',
    padding: '1px 6px',
    borderRadius: 4,
  },
  propCardHousesBadge: {
    display: 'flex',
    gap: 2,
    fontSize: 10,
  },
  propCardTitle: {
    margin: 0,
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: '0.05em',
  },
  propCardSub: {
    fontSize: 8,
    opacity: 0.8,
    textTransform: 'uppercase',
  },
  propCardRentSection: {
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  rentScaleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 9,
    color: '#4b5563',
  },
  propCardRentBadge: {
    background: '#f8fafc',
    borderTop: '1px solid #e2e8f0',
    padding: '8px 12px',
    fontSize: 10,
    textAlign: 'center',
    color: '#1e293b',
    fontWeight: 'bold',
  },
  buildControls: {
    display: 'flex',
    gap: 8,
    marginTop: 4,
  },
  buildBtn: {
    flex: 1,
    padding: '8px',
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.15s',
    outline: 'none',
  },
  liquidationDashboard: {
    background: 'rgba(0,0,0,0.2)',
    padding: 10,
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  statsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 12,
  },
  puzzleSuccessBox: {
    background: 'rgba(34,197,94,0.08)',
    border: '1px solid rgba(34,197,94,0.25)',
    borderRadius: 10,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: 6,
  },
  successTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4ade80',
  },
  successDesc: {
    margin: 0,
    fontSize: 11,
    color: 'rgba(209,213,219,0.7)',
    lineHeight: 1.4,
  },
  resetBtn: {
    marginTop: 6,
    padding: '4px 12px',
    fontSize: 10,
    background: 'rgba(255,255,255,0.06)',
    color: '#ffffff',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    cursor: 'pointer',
  },
  puzzleActionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  puzzleActionItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    border: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.01)',
    borderRadius: 8,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s',
    outline: 'none',
  },
  payDebtBtn: {
    padding: '10px',
    border: 'none',
    borderRadius: 8,
    fontWeight: 'extrabold',
    fontSize: 12,
    textAlign: 'center',
    transition: 'all 0.2s',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    background: 'rgba(0,0,0,0.1)',
  },
  skipBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'color 0.2s',
    outline: 'none',
    ':hover': {
      color: '#d4af37',
    },
  },
  dotsContainer: {
    display: 'flex',
    gap: 8,
  },
  dot: {
    height: 8,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    outline: 'none',
  },
  navBtnGroup: {
    display: 'flex',
    gap: 8,
  },
  backBtn: {
    padding: '8px 16px',
    background: 'rgba(255,255,255,0.06)',
    color: 'rgba(209, 213, 219, 0.8)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s',
    outline: 'none',
  },
  nextBtn: {
    padding: '8px 20px',
    background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 50%, #d97706 100%)',
    color: '#0a0805',
    border: 'none',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(245,158,11,0.3)',
    transition: 'transform 0.2s, boxShadow 0.2s',
    outline: 'none',
  },
  finishBtn: {
    padding: '8px 20px',
    background: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #059669 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
    transition: 'transform 0.2s, boxShadow 0.2s',
    outline: 'none',
  },
};
