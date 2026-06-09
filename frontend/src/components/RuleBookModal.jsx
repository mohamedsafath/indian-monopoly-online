import React, { useState } from 'react';

const TABS = [
  { id: 'setup', label: 'Setup & Flow', icon: '🏡' },
  { id: 'movement', label: 'Movement & Spaces', icon: '🚶' },
  { id: 'jail', label: 'Tihar Jail', icon: '🔒' },
  { id: 'building', label: 'Monopolies & Builds', icon: '🏠' },
  { id: 'auctions', label: 'Auctions & Trade', icon: '🔨' },
  { id: 'loans', label: 'Loans & Mortgages', icon: '🏦' },
  { id: 'bankruptcy', label: 'Default & AFK', icon: '💸' },
];

export default function RuleBookModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('setup');

  if (!isOpen) return null;

  const renderContent = () => {
    switch (activeTab) {
      case 'setup':
        return (
          <div style={styles.pane}>
            <h4 style={styles.paneTitle}>🏡 Setup & Cash Flow</h4>
            <p style={styles.paragraph}>
              Welcome to <strong>Monopoly India</strong>! This edition is tailored for 2 to 8 players, taking you across the country's most vibrant and prestigious cities.
            </p>
            
            <div style={styles.highlightCard}>
              <div style={styles.cardHeader}>💰 Starting Assets</div>
              <div style={styles.cardBody}>
                Each player starts their entrepreneurial journey with a capital of <strong>₹20,000</strong>.
              </div>
            </div>

            <h5 style={styles.sectionHeader}>Game Sequence</h5>
            <ul style={styles.list}>
              <li style={styles.listItem}>
                <span style={styles.bullet}>✦</span>
                <span>Turns proceed in a randomized order decided at room initialization.</span>
              </li>
              <li style={styles.listItem}>
                <span style={styles.bullet}>✦</span>
                <span>On your turn, you roll both dice, resolve the space you land on, and make any building or trading decisions.</span>
              </li>
              <li style={styles.listItem}>
                <span style={styles.bullet}>✦</span>
                <span>Once finished, click <strong>✔ End Turn</strong> to pass the turn to the next player.</span>
              </li>
            </ul>
          </div>
        );

      case 'movement':
        return (
          <div style={styles.pane}>
            <h4 style={styles.paneTitle}>🚶 Movement & Board Spaces</h4>
            <p style={styles.paragraph}>
              Advance clockwise around the 40-tile board according to your dice total.
            </p>

            <div style={styles.grid}>
              <div style={styles.gridCard}>
                <div style={styles.cardHeaderEmoji}>🇮🇳</div>
                <div style={styles.gridCardTitle}>Start Journey</div>
                <p style={styles.gridCardText}>
                  Land on or pass Start to collect your <strong>₹2,000</strong> salary from the Bank.
                </p>
              </div>

              <div style={styles.gridCard}>
                <div style={styles.cardHeaderEmoji}>☕</div>
                <div style={styles.gridCardTitle}>Tea Break</div>
                <p style={styles.gridCardText}>
                  Accumulated taxes and jail fees collect here. Land on this space to sweep the entire public pot!
                </p>
              </div>

              <div style={styles.gridCard}>
                <div style={styles.cardHeaderEmoji}>📋</div>
                <div style={styles.gridCardTitle}>Income Tax & GST</div>
                <p style={styles.gridCardText}>
                  Landings require paying <strong>₹2,000</strong> for Income Tax or <strong>₹750</strong> for GST.
                </p>
              </div>

              <div style={styles.gridCard}>
                <div style={styles.cardHeaderEmoji}>📦</div>
                <div style={styles.gridCardTitle}>Chance & Chest</div>
                <p style={styles.gridCardText}>
                  Draw cards with unique effects like <em>IPL Sponsorship Deals</em>, <em>Diwali Bonuses</em>, or <em>Traffic Challans</em>.
                </p>
              </div>
            </div>
            
            <h5 style={styles.sectionHeader}>Rolling Doubles</h5>
            <p style={styles.paragraph}>
              Rolling identical numbers allows you to move and take actions, then roll again. However, rolling <strong>3 consecutive doubles</strong> triggers an instant tax audit, sending you straight to jail!
            </p>
          </div>
        );

      case 'jail':
        return (
          <div style={styles.pane}>
            <h4 style={styles.paneTitle}>🔒 Tihar Jail Rules</h4>
            <p style={styles.paragraph}>
              If you land on <strong>Income Tax Raid 🚔</strong>, roll three consecutive doubles, or draw a jail card, you are sent directly to Tihar Jail. While in jail, you cannot collect rent on properties if you are bankrupt or in debt, and you cannot move normally.
            </p>

            <h5 style={styles.sectionHeader}>How to Escape:</h5>
            <div style={styles.escapeOptions}>
              <div style={styles.optionBox}>
                <span style={styles.optionEmoji}>🎲</span>
                <strong>Roll Doubles</strong>
                <span style={styles.optionDesc}>Roll identical dice on your turn. You escape and advance, but do not get a consecutive turn.</span>
              </div>
              <div style={styles.optionBox}>
                <span style={styles.optionEmoji}>💸</span>
                <strong>Pay Fine</strong>
                <span style={styles.optionDesc}>Pay a fine of <strong>₹500</strong> to the bank (added to Tea Break pot) before rolling.</span>
              </div>
              <div style={styles.optionBox}>
                <span style={styles.optionEmoji}>🎟️</span>
                <strong>Political Card</strong>
                <span style={styles.optionDesc}>Use a Get Out of Jail Free card drawn from Chance or Community Chest.</span>
              </div>
            </div>

            <div style={styles.warningAlert}>
              <span style={styles.alertIcon}>⚠️</span>
              <div style={styles.alertText}>
                <strong>3-Turn Escape Limit:</strong> You may spend at most 3 turns trying to roll doubles. If you fail on the third attempt, you are forced to pay the ₹500 fine and advance. If you cannot afford the fine, you instantly face bankruptcy.
              </div>
            </div>
          </div>
        );

      case 'building':
        return (
          <div style={styles.pane}>
            <h4 style={styles.paneTitle}>🏠 Monopolies & Building Empire</h4>
            <p style={styles.paragraph}>
              Own all properties within a single color group to establish a <strong>Monopoly</strong>. This represents a complete control of the region's market.
            </p>

            <div style={styles.highlightCardGold}>
              <div style={styles.cardHeaderGold}>⭐ Monopoly Benefit</div>
              <div style={styles.cardBody}>
                Owning a complete color group <strong>doubles the base rent</strong> of all unimproved properties in that group. It also unlocks the ability to build houses.
              </div>
            </div>

            <h5 style={styles.sectionHeader}>Building Rules</h5>
            <ul style={styles.list}>
              <li style={styles.listItem}>
                <span style={styles.bullet}>✦</span>
                <span>You must build <strong>evenly</strong>. You cannot build a second house on a property until all properties in that color group have at least one house. The house count across the group cannot differ by more than 1.</span>
              </li>
              <li style={styles.listItem}>
                <span style={styles.bullet}>✦</span>
                <span>A maximum of <strong>4 Houses</strong> can be built per property.</span>
              </li>
              <li style={styles.listItem}>
                <span style={styles.bullet}>✦</span>
                <span>Once all properties in a group have 4 houses, you can upgrade to a <strong>Hotel</strong>. Hotels yield extremely high rents, such as <strong>₹20,000</strong> at Mumbai Marine Drive.</span>
              </li>
              <li style={styles.listItem}>
                <span style={styles.bullet}>✦</span>
                <span>Houses/Hotels can be sold back to the bank at <strong>50%</strong> of their purchase cost if you need to raise emergency cash.</span>
              </li>
            </ul>
          </div>
        );

      case 'auctions':
        return (
          <div style={styles.pane}>
            <h4 style={styles.paneTitle}>🔨 Auctions & Trading</h4>
            <p style={styles.paragraph}>
              Take advantage of trading and open auctions to acquire properties strategically and complete your monopolies.
            </p>

            <h5 style={styles.sectionHeader}>Active Property Auctions</h5>
            <p style={styles.paragraph}>
              If a player lands on an unowned property, railway, or utility and chooses <strong>not to purchase it</strong> at list price, the bank puts it up for <strong>Auction</strong>.
            </p>
            <ul style={styles.list}>
              <li style={styles.listItem}>
                <span style={styles.bullet}>✦</span>
                <span>All active players, including the player who landed on it, can place bids.</span>
              </li>
              <li style={styles.listItem}>
                <span style={styles.bullet}>✦</span>
                <span>Bids must exceed the current highest bid.</span>
              </li>
              <li style={styles.listItem}>
                <span style={styles.bullet}>✦</span>
                <span>Players may pass at any time. Bidding ₹0 or passing exits the auction. The highest bidder wins and pays the bid amount to the bank.</span>
              </li>
            </ul>

            <h5 style={styles.sectionHeader}>Player-to-Player Trading</h5>
            <p style={styles.paragraph}>
              On your turn or between turns, you can initiate a <strong>Trade</strong> with any other player. You can offer or request combinations of cash, unmortgaged properties, mortgaged properties, and Get Out of Jail Free cards.
            </p>
          </div>
        );

      case 'loans':
        return (
          <div style={styles.pane}>
            <h4 style={styles.paneTitle}>🏦 Loans & Mortgages</h4>
            <p style={styles.paragraph}>
              Manage your liquidity carefully to survive unexpected rent bills and government taxes.
            </p>

            <h5 style={styles.sectionHeader}>Madras Banking Corp Emergency Loans</h5>
            <p style={styles.paragraph}>
              When cash is critically low, you can apply for an emergency loan directly from the bank.
            </p>
            <ul style={styles.list}>
              <li style={styles.listItem}>
                <span style={styles.bullet}>✦</span>
                <span><strong>Loan Amount:</strong> ₹500 to ₹5,000, in increments of ₹500.</span>
              </li>
              <li style={styles.listItem}>
                <span style={styles.bullet}>✦</span>
                <span><strong>Interest Rate:</strong> A 20% flat interest is added immediately (Repayment = <strong>1.2 × loan amount</strong>).</span>
              </li>
              <li style={styles.listItem}>
                <span style={styles.bullet}>✦</span>
                <span><strong>Duration:</strong> The loan must be repaid within <strong>5 turns</strong>.</span>
              </li>
              <li style={styles.listItem}>
                <span style={styles.bullet}>✦</span>
                <span><strong>Repayment:</strong> At the start of your 5th turn, if you have sufficient cash, the repayment amount is automatically deducted. If cash is insufficient, the bank automatically liquidates your assets to collect the debt. If assets are still insufficient, you default.</span>
              </li>
            </ul>

            <h5 style={styles.sectionHeader}>Mortgages</h5>
            <p style={styles.paragraph}>
              Mortgage any property to the bank to receive <strong>50%</strong> of its purchase price as immediate cash.
            </p>
            <ul style={styles.list}>
              <li style={styles.listItem}>
                <span style={styles.bullet}>✦</span>
                <span>You must sell all houses/hotels on a property before mortgaging it.</span>
              </li>
              <li style={styles.listItem}>
                <span style={styles.bullet}>✦</span>
                <span><strong>No Rent:</strong> You cannot collect rent on a property while it is mortgaged.</span>
              </li>
              <li style={styles.listItem}>
                <span style={styles.bullet}>✦</span>
                <span><strong>Unmortgage:</strong> Lift the mortgage by paying the mortgage value plus a <strong>10% fee</strong>.</span>
              </li>
            </ul>
          </div>
        );

      case 'bankruptcy':
        return (
          <div style={styles.pane}>
            <h4 style={styles.paneTitle}>💸 Default & AFK Safeguards</h4>
            <p style={styles.paragraph}>
              Understanding bankruptcy and default sequences is vital to preventing an early exit from the match.
            </p>

            <h5 style={styles.sectionHeader}>Negative Balance & Bankruptcy</h5>
            <p style={styles.paragraph}>
              If a tax, rent payment, or loan repayment drives your balance below zero, you are in debt. You <strong>cannot end your turn</strong> with a negative balance. You must mortgage properties, sell buildings, request a bank loan, or negotiate trades to raise cash. If you cannot return to a positive balance, you must declare <strong>Bankruptcy</strong>:
            </p>
            <ul style={styles.list}>
              <li style={styles.listItem}>
                <span style={styles.bullet}>✦</span>
                <span><strong>Bankrupted by a Player:</strong> Your creditor receives all your remaining cash, properties, and cards. Any houses or hotels you owned are automatically sold back to the bank at half cost to satisfy your debts first.</span>
              </li>
              <li style={styles.listItem}>
                <span style={styles.bullet}>✦</span>
                <span><strong>Bankrupted by the Bank:</strong> All your properties are repossessed, unmortgaged automatically, and put up for <strong>active auction</strong>. Multiple repossessed properties are queued and auctioned one by one.</span>
              </li>
            </ul>

            <h5 style={styles.sectionHeader}>AFK / Idle Safeguard</h5>
            <p style={styles.paragraph}>
              To keep the game flowing, each turn is protected by an AFK timer of <strong>90 seconds</strong>. If you do not roll or make decisions within this window, the server will auto-roll the dice for you and force-end your turn, skipping any property buy decisions.
            </p>
          </div>
        );

      default:
        return null;
    }
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
      `}</style>

      {/* Modal Card */}
      <div style={styles.modal}>
        {/* Top Edge Decorative Border */}
        <div style={styles.decorativeTop} />

        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerTitleWrap}>
            <span style={styles.headerEmoji}>📜</span>
            <div>
              <h2 style={styles.headerTitle}>Rule Book</h2>
              <span style={styles.headerSubtitle}>Official Indian Monopoly Guidelines</span>
            </div>
          </div>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close rule book">
            ✕
          </button>
        </div>

        {/* Main Content Area */}
        <div style={styles.body}>
          {/* Left Navigation Sidebar */}
          <div style={styles.sidebar}>
            {TABS.map((tab) => {
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    ...styles.tabBtn,
                    ...(isSelected ? styles.tabBtnActive : {}),
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'rgba(212,175,55,0.08)';
                      e.currentTarget.style.color = '#fde68a';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'rgba(209, 213, 219, 0.7)';
                    }
                  }}
                >
                  <span style={styles.tabIcon}>{tab.icon}</span>
                  <span style={styles.tabLabel}>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right Text Content Panel */}
          <div style={styles.contentPanel}>
            {renderContent()}
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <span style={styles.footerNote}>✦ Monopoly India · Built on Real Code Mechanics ✦</span>
          <button
            onClick={onClose}
            style={styles.actionBtn}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(245,158,11,0.55)';
              e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(245,158,11,0.35)';
              e.currentTarget.style.transform = 'none';
            }}
          >
            Got It
          </button>
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
    zIndex: 2000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(5, 4, 3, 0.88)',
    backdropFilter: 'blur(16px)',
    animation: 'modalFadeIn 0.22s ease-out forwards',
    padding: 16,
  },
  modal: {
    width: '100%',
    maxWidth: 760,
    height: '80vh',
    maxHeight: 640,
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
  headerEmoji: {
    fontSize: 28,
    filter: 'drop-shadow(0 0 8px rgba(212,175,55,0.5))',
  },
  headerTitle: {
    margin: 0,
    fontSize: 20,
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
    display: 'flex',
    flexDirection: 'row',
    overflow: 'hidden',
    background: 'rgba(255,255,255,0.01)',
    '@media (max-width: 640px)': {
      flexDirection: 'column',
    },
  },
  sidebar: {
    width: 220,
    borderRight: '1px solid rgba(255, 255, 255, 0.05)',
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    overflowY: 'auto',
    background: 'rgba(0,0,0,0.15)',
    flexShrink: 0,
  },
  tabBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '10px 14px',
    background: 'transparent',
    border: 'none',
    borderRadius: 10,
    color: 'rgba(209, 213, 219, 0.7)',
    fontSize: 12,
    fontWeight: 600,
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontFamily: "'DM Sans', sans-serif",
    outline: 'none',
  },
  tabBtnActive: {
    background: 'rgba(212, 175, 55, 0.12)',
    color: '#f59e0b',
    borderLeft: '3px solid #d4af37',
    boxShadow: 'inset 4px 0 10px rgba(212,175,55,0.05)',
  },
  tabIcon: {
    fontSize: 14,
  },
  tabLabel: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  contentPanel: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px 28px',
  },
  pane: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  paneTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    color: '#f3f4f6',
    fontFamily: "'Playfair Display', serif",
  },
  paragraph: {
    margin: 0,
    fontSize: 13,
    color: 'rgba(209, 213, 219, 0.8)',
    lineHeight: 1.6,
  },
  highlightCard: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  cardHeader: {
    fontSize: 11,
    fontWeight: 800,
    color: 'rgba(156,163,175,0.6)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  cardBody: {
    fontSize: 13,
    color: '#e5e7eb',
    lineHeight: 1.5,
  },
  highlightCardGold: {
    background: 'rgba(212, 175, 55, 0.06)',
    border: '1px solid rgba(212, 175, 55, 0.2)',
    borderRadius: 12,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  cardHeaderGold: {
    fontSize: 11,
    fontWeight: 800,
    color: '#f59e0b',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  sectionHeader: {
    margin: '12px 0 0',
    fontSize: 14,
    fontWeight: 800,
    color: '#d4af37',
    fontFamily: "'DM Sans', sans-serif",
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  list: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  listItem: {
    fontSize: 13,
    color: 'rgba(209, 213, 219, 0.85)',
    lineHeight: 1.5,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
  },
  bullet: {
    color: '#d4af37',
    fontWeight: 'bold',
    flexShrink: 0,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12,
  },
  gridCard: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  cardHeaderEmoji: {
    fontSize: 22,
  },
  gridCardTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: '#f3f4f6',
  },
  gridCardText: {
    margin: 0,
    fontSize: 11,
    color: 'rgba(156, 163, 175, 0.8)',
    lineHeight: 1.4,
  },
  escapeOptions: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  optionBox: {
    flex: '1 1 calc(33.333% - 10px)',
    minWidth: 140,
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: 6,
  },
  optionEmoji: {
    fontSize: 20,
    marginBottom: 2,
  },
  optionDesc: {
    fontSize: 10,
    color: 'rgba(156, 163, 175, 0.85)',
    lineHeight: 1.4,
  },
  warningAlert: {
    display: 'flex',
    gap: 12,
    padding: 14,
    borderRadius: 10,
    background: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
  },
  alertIcon: {
    fontSize: 18,
    flexShrink: 0,
  },
  alertText: {
    fontSize: 11,
    color: '#cbd5e1',
    lineHeight: 1.5,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    background: 'rgba(0,0,0,0.1)',
  },
  footerNote: {
    fontSize: 10,
    color: 'rgba(212, 175, 55, 0.45)',
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 600,
    letterSpacing: '0.05em',
  },
  actionBtn: {
    padding: '10px 24px',
    background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 50%, #d97706 100%)',
    color: '#0a0805',
    border: 'none',
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(245,158,11,0.35)',
    transition: 'transform 0.2s, boxShadow 0.2s',
    fontFamily: "'DM Sans', sans-serif",
    outline: 'none',
  },
};
