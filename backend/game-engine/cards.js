/**
 * backend/game-engine/cards.js
 * ═══════════════════════════════════════════════════════════════════════════════
 * INDIAN MONOPOLY — Chance & Community Chest Card Decks
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Two decks:  CHANCE_CARDS (30)  and  COMMUNITY_CHEST_CARDS (30)
 *
 * Every card has a fixed schema so gameEngine.js can apply effects without
 * any switch statements on strings — it reads card.effect and acts on it.
 *
 * ── Card Schema ──────────────────────────────────────────────────────────────
 *
 *  {
 *    id:       string   — unique e.g. 'CH-01', 'CC-01'
 *    deck:     string   — 'chance' | 'community'
 *    title:    string   — short bold heading shown in the UI popup
 *    text:     string   — full flavour text shown below the title
 *    icon:     string   — emoji for the card face
 *    effect: {
 *      type:   string   — see EFFECT_TYPES below
 *
 *      // ── MONEY effect ─────────────────────────────────────────────────────
 *      amount?:          number  — positive = collect, negative = pay
 *      destination?:     'free_parking' | 'bank'
 *
 *      // ── MOVE effect ──────────────────────────────────────────────────────
 *      tileId?:          number   — exact board position to move to
 *      collectGoReward?: boolean  — collect ₹2,000 if passing Start (default true)
 *      moveBack?:        number   — move N spaces backward (alternative to tileId)
 *
 *      // ── NEAREST effect ───────────────────────────────────────────────────
 *      nearest?:  'railway' | 'utility'
 *
 *      // ── REPAIRS effect ───────────────────────────────────────────────────
 *      perHouse?:  number
 *      perHotel?:  number
 *
 *      // ── COLLECT_FROM_ALL effect ───────────────────────────────────────────
 *      perPlayer?: number
 *
 *      // ── JAIL / GET_OUT_OF_JAIL — no extra fields
 *    }
 *  }
 *
 * ── Effect Types ─────────────────────────────────────────────────────────────
 *   MONEY            — adjust current player's balance (+ or −)
 *   MOVE             — teleport player to tileId (or move back N spaces)
 *   NEAREST          — find and move to nearest railway/utility
 *   REPAIRS          — pay per house + per hotel across portfolio
 *   COLLECT_FROM_ALL — receive perPlayer from each other active player
 *   JAIL             — go directly to Tihar Jail (tile 10), no GO reward
 *   GET_OUT_OF_JAIL  — receive one Get Out of Jail Free card
 *
 * ── Server-authoritative design ──────────────────────────────────────────────
 *   Cards are created server-side. The client only receives the drawn card
 *   object for display — it NEVER applies effects itself.
 *   gameEngine.js calls applyCardEffect(gameState, playerId, card) and the
 *   resulting state delta is broadcast to all clients.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use strict';

const crypto = require('crypto');

// ─────────────────────────────────────────────────────────────────────────────
// EFFECT TYPE CONSTANTS  — imported by gameEngine.js for exhaustive matching
// ─────────────────────────────────────────────────────────────────────────────

const EFFECT_TYPES = Object.freeze({
  MONEY:            'MONEY',
  MOVE:             'MOVE',
  NEAREST:          'NEAREST',
  REPAIRS:          'REPAIRS',
  COLLECT_FROM_ALL: 'COLLECT_FROM_ALL',
  JAIL:             'JAIL',
  GET_OUT_OF_JAIL:  'GET_OUT_OF_JAIL',
});

// ─────────────────────────────────────────────────────────────────────────────
// DECK IDENTIFIERS
// ─────────────────────────────────────────────────────────────────────────────

const DECKS = Object.freeze({
  CHANCE:    'chance',
  COMMUNITY: 'community',
});

// ─────────────────────────────────────────────────────────────────────────────
// CHANCE CARDS  (30 cards)
// ─────────────────────────────────────────────────────────────────────────────

const CHANCE_CARDS = Object.freeze([

  // ── POSITIVE MONEY (10 cards) ─────────────────────────────────────────────

  {
    id:    'CH-01',
    deck:  DECKS.CHANCE,
    title: 'IPL Sponsorship Deal',
    text:  'Your startup just signed a jersey sponsorship with your favourite IPL team. Collect ₹1,000.',
    icon:  '🏏',
    effect: {
      type:   EFFECT_TYPES.MONEY,
      amount: 1_000,
    },
  },

  {
    id:    'CH-02',
    deck:  DECKS.CHANCE,
    title: 'Angel Investor',
    text:  'A Bengaluru angel investor loved your pitch deck. Seed funding credited. Collect ₹2,000.',
    icon:  '💡',
    effect: {
      type:   EFFECT_TYPES.MONEY,
      amount: 2_000,
    },
  },

  {
    id:    'CH-03',
    deck:  DECKS.CHANCE,
    title: 'Diwali Bonus',
    text:  'Your employer surprises everyone with a Diwali performance bonus. Collect ₹1,500.',
    icon:  '🪔',
    effect: {
      type:   EFFECT_TYPES.MONEY,
      amount: 1_500,
    },
  },

  {
    id:    'CH-04',
    deck:  DECKS.CHANCE,
    title: 'Income Tax Refund',
    text:  'The IT department processed your refund faster than expected. Collect ₹800.',
    icon:  '📝',
    effect: {
      type:   EFFECT_TYPES.MONEY,
      amount: 800,
    },
  },

  {
    id:    'CH-05',
    deck:  DECKS.CHANCE,
    title: 'Stock Market Rally',
    text:  'Your NIFTY 50 index fund surged 8% overnight. Book profits. Collect ₹1,200.',
    icon:  '📈',
    effect: {
      type:   EFFECT_TYPES.MONEY,
      amount: 1_200,
    },
  },

  {
    id:    'CH-06',
    deck:  DECKS.CHANCE,
    title: 'Government Subsidy',
    text:  'Your new EV qualifies for a FAME-II subsidy. Reimbursement credited. Collect ₹600.',
    icon:  '🏛️',
    effect: {
      type:   EFFECT_TYPES.MONEY,
      amount: 600,
    },
  },

  {
    id:    'CH-07',
    deck:  DECKS.CHANCE,
    title: 'Freelance Project Windfall',
    text:  'A US client paid in dollars — after conversion it\'s a great day. Collect ₹900.',
    icon:  '💻',
    effect: {
      type:   EFFECT_TYPES.MONEY,
      amount: 900,
    },
  },

  {
    id:    'CH-08',
    deck:  DECKS.CHANCE,
    title: 'Hackathon Winner',
    text:  'You won first place at an IIT Bombay hackathon. Prize money awarded. Collect ₹1,400.',
    icon:  '🏆',
    effect: {
      type:   EFFECT_TYPES.MONEY,
      amount: 1_400,
    },
  },

  {
    id:    'CH-09',
    deck:  DECKS.CHANCE,
    title: 'UPI Cashback Jackpot',
    text:  'You hit the lucky cashback on a big transaction. Collect ₹500.',
    icon:  '📱',
    effect: {
      type:   EFFECT_TYPES.MONEY,
      amount: 500,
    },
  },

  {
    id:    'CH-10',
    deck:  DECKS.CHANCE,
    title: 'Crypto Bull Run',
    text:  'You sold at the top (for once). Short-term gains credited. Collect ₹1,800.',
    icon:  '🚀',
    effect: {
      type:   EFFECT_TYPES.MONEY,
      amount: 1_800,
    },
  },

  // ── NEGATIVE MONEY (8 cards) ──────────────────────────────────────────────

  {
    id:    'CH-11',
    deck:  DECKS.CHANCE,
    title: 'Traffic Challan',
    text:  'Caught jumping a red light in Delhi. Electronic challan issued. Pay ₹500.',
    icon:  '🚦',
    effect: {
      type:        EFFECT_TYPES.MONEY,
      amount:      -500,
      destination: 'free_parking',
    },
  },

  {
    id:    'CH-12',
    deck:  DECKS.CHANCE,
    title: 'Hospital Emergency',
    text:  'A sudden appendicitis scare — insurance doesn\'t cover everything. Pay ₹1,500.',
    icon:  '🏥',
    effect: {
      type:        EFFECT_TYPES.MONEY,
      amount:      -1_500,
      destination: 'free_parking',
    },
  },

  {
    id:    'CH-13',
    deck:  DECKS.CHANCE,
    title: 'Grand Wedding Baraat',
    text:  'Cousin\'s wedding demands top-tier celebrations. Family contribution expected. Pay ₹2,000.',
    icon:  '💒',
    effect: {
      type:        EFFECT_TYPES.MONEY,
      amount:      -2_000,
      destination: 'free_parking',
    },
  },

  {
    id:    'CH-14',
    deck:  DECKS.CHANCE,
    title: 'Missed Rajdhani Express',
    text:  'Slept through the alarm. Last-minute Tatkal ticket costs a fortune. Pay ₹700.',
    icon:  '🚂',
    effect: {
      type:        EFFECT_TYPES.MONEY,
      amount:      -700,
      destination: 'free_parking',
    },
  },

  {
    id:    'CH-15',
    deck:  DECKS.CHANCE,
    title: 'Phone Shattered',
    text:  'Dropped your flagship phone on a marble floor. No back glass warranty. Pay ₹800.',
    icon:  '📱',
    effect: {
      type:        EFFECT_TYPES.MONEY,
      amount:      -800,
      destination: 'free_parking',
    },
  },

  {
    id:    'CH-16',
    deck:  DECKS.CHANCE,
    title: 'GST Audit Notice',
    text:  'Your business received a GST discrepancy notice. Penalty assessed. Pay ₹1,000.',
    icon:  '📊',
    effect: {
      type:        EFFECT_TYPES.MONEY,
      amount:      -1_000,
      destination: 'free_parking',
    },
  },

  {
    id:    'CH-17',
    deck:  DECKS.CHANCE,
    title: 'Scam Call Victim',
    text:  'You fell for a KYC fraud call. Partial bank recovery only. Pay ₹600.',
    icon:  '☎️',
    effect: {
      type:        EFFECT_TYPES.MONEY,
      amount:      -600,
      destination: 'free_parking',
    },
  },

  {
    id:    'CH-18',
    deck:  DECKS.CHANCE,
    title: 'Property Maintenance Bill',
    text:  'Structural repairs across your portfolio. Pay ₹400 per house, ₹1,150 per hotel.',
    icon:  '🔧',
    effect: {
      type:     EFFECT_TYPES.REPAIRS,
      perHouse: 400,
      perHotel: 1_150,
    },
  },

  // ── MOVEMENT (8 cards) ────────────────────────────────────────────────────

  {
    id:    'CH-19',
    deck:  DECKS.CHANCE,
    title: 'Advance to Start Journey',
    text:  'Patriotic duty calls you home. Advance to Start Journey 🇮🇳 and collect ₹2,000.',
    icon:  '🇮🇳',
    effect: {
      type:            EFFECT_TYPES.MOVE,
      tileId:          0,
      collectGoReward: true,
    },
  },

  {
    id:    'CH-20',
    deck:  DECKS.CHANCE,
    title: 'IT Conference in Chennai',
    text:  'You\'re keynoting a major tech summit. Fly to Chennai immediately.',
    icon:  '🚗',
    effect: {
      type:            EFFECT_TYPES.MOVE,
      tileId:          16,
      collectGoReward: true,
    },
  },

  {
    id:    'CH-21',
    deck:  DECKS.CHANCE,
    title: 'Business Meeting at Mumbai Marine Drive',
    text:  'High-stakes board meeting with sea view. Advance to Mumbai Marine Drive.',
    icon:  '🌊',
    effect: {
      type:            EFFECT_TYPES.MOVE,
      tileId:          39,
      collectGoReward: true,
    },
  },

  {
    id:    'CH-22',
    deck:  DECKS.CHANCE,
    title: 'Heritage Summit in Jaipur',
    text:  'Invited to a UNESCO heritage conference at the Pink City. Rush to Jaipur.',
    icon:  '🏰',
    effect: {
      type:            EFFECT_TYPES.MOVE,
      tileId:          26,
      collectGoReward: true,
    },
  },

  {
    id:    'CH-23',
    deck:  DECKS.CHANCE,
    title: 'Advance to Nearest Railway',
    text:  'Your travel allowance is approved. Advance to the nearest Indian Railways station. If owned, pay double rent.',
    icon:  '🚆',
    effect: {
      type:    EFFECT_TYPES.NEAREST,
      nearest: 'railway',
    },
  },

  {
    id:    'CH-24',
    deck:  DECKS.CHANCE,
    title: 'Advance to Nearest Utility',
    text:  'Infrastructure inspection required. Advance to the nearest Utility. If owned, pay double rent.',
    icon:  '⚡',
    effect: {
      type:    EFFECT_TYPES.NEAREST,
      nearest: 'utility',
    },
  },

  {
    id:    'CH-25',
    deck:  DECKS.CHANCE,
    title: 'Go Back 3 Spaces',
    text:  'Wrong lane, wrong direction — GPS lost signal. Move back 3 spaces.',
    icon:  '🔙',
    effect: {
      type:     EFFECT_TYPES.MOVE,
      moveBack: 3,
    },
  },

  {
    id:    'CH-26',
    deck:  DECKS.CHANCE,
    title: 'Tech Park Expansion',
    text:  'A major tech firm flies you in for a partnership signing. Advance to Bengaluru Tech Park.',
    icon:  '🖥️',
    effect: {
      type:            EFFECT_TYPES.MOVE,
      tileId:          37,
      collectGoReward: true,
    },
  },

  // ── SPECIAL (4 cards) ─────────────────────────────────────────────────────

  {
    id:    'CH-27',
    deck:  DECKS.CHANCE,
    title: 'Income Tax Raid!',
    text:  'Enforcement Directorate officers are at your door. Go directly to Tihar Jail. Do NOT pass Start Journey.',
    icon:  '🚔',
    effect: {
      type: EFFECT_TYPES.JAIL,
    },
  },

  {
    id:    'CH-28',
    deck:  DECKS.CHANCE,
    title: 'Get Out of Jail Free',
    text:  'A well-connected political contact pulls strings. Keep this card — play it to leave Tihar Jail at no cost.',
    icon:  '🎟️',
    effect: {
      type: EFFECT_TYPES.GET_OUT_OF_JAIL,
    },
  },

  {
    id:    'CH-29',
    deck:  DECKS.CHANCE,
    title: 'It\'s Your Birthday!',
    text:  'Your colleagues insist on celebrating. Each player pays you ₹500. Jai ho!',
    icon:  '🎂',
    effect: {
      type:      EFFECT_TYPES.COLLECT_FROM_ALL,
      perPlayer: 500,
    },
  },

  {
    id:    'CH-30',
    deck:  DECKS.CHANCE,
    title: 'Chairman of the Board',
    text:  'Elected as independent director. Each player pays you a consulting fee of ₹500.',
    icon:  '👔',
    effect: {
      type:      EFFECT_TYPES.COLLECT_FROM_ALL,
      perPlayer: 500,
    },
  },

]);

// ─────────────────────────────────────────────────────────────────────────────
// COMMUNITY CHEST CARDS  (30 cards)
// ─────────────────────────────────────────────────────────────────────────────

const COMMUNITY_CHEST_CARDS = Object.freeze([

  // ── POSITIVE MONEY (13 cards) ─────────────────────────────────────────────

  {
    id:    'CC-01',
    deck:  DECKS.COMMUNITY,
    title: 'National Scholarship',
    text:  'Your academic excellence earns a government merit scholarship. Collect ₹1,000.',
    icon:  '🎓',
    effect: {
      type:   EFFECT_TYPES.MONEY,
      amount: 1_000,
    },
  },

  {
    id:    'CC-02',
    deck:  DECKS.COMMUNITY,
    title: 'Annual Salary Increment',
    text:  'HR just sent the increment letter — above your expectations. Collect ₹1,500.',
    icon:  '💼',
    effect: {
      type:   EFFECT_TYPES.MONEY,
      amount: 1_500,
    },
  },

  {
    id:    'CC-03',
    deck:  DECKS.COMMUNITY,
    title: 'Grandparent\'s Gift',
    text:  'Nana-Nani transfer some savings as a blessing. Collect ₹800.',
    icon:  '👴',
    effect: {
      type:   EFFECT_TYPES.MONEY,
      amount: 800,
    },
  },

  {
    id:    'CC-04',
    deck:  DECKS.COMMUNITY,
    title: 'Bank Error in Your Favour',
    text:  'The bank made a crediting error — and they\'re not asking it back. Collect ₹2,000.',
    icon:  '🏦',
    effect: {
      type:   EFFECT_TYPES.MONEY,
      amount: 2_000,
    },
  },

  {
    id:    'CC-05',
    deck:  DECKS.COMMUNITY,
    title: 'Sold Old Jewellery',
    text:  'Old gold ornaments appraised above market rate. Collect ₹700.',
    icon:  '💍',
    effect: {
      type:   EFFECT_TYPES.MONEY,
      amount: 700,
    },
  },

  {
    id:    'CC-06',
    deck:  DECKS.COMMUNITY,
    title: 'Online Business Profits',
    text:  'Your Meesho / Flipkart seller account had a bumper sale day. Collect ₹900.',
    icon:  '📦',
    effect: {
      type:   EFFECT_TYPES.MONEY,
      amount: 900,
    },
  },

  {
    id:    'CC-07',
    deck:  DECKS.COMMUNITY,
    title: 'Aadhaar-Linked Benefit',
    text:  'Government DBT (Direct Benefit Transfer) credited directly to your account. Collect ₹600.',
    icon:  '🆔',
    effect: {
      type:   EFFECT_TYPES.MONEY,
      amount: 600,
    },
  },

  {
    id:    'CC-08',
    deck:  DECKS.COMMUNITY,
    title: 'Mutual Fund Matured',
    text:  'Your 5-year SIP completed. CAGR of 14%. Collect ₹1,800.',
    icon:  '📊',
    effect: {
      type:   EFFECT_TYPES.MONEY,
      amount: 1_800,
    },
  },

  {
    id:    'CC-09',
    deck:  DECKS.COMMUNITY,
    title: 'State Sports Prize',
    text:  'Won the state kabaddi championship. Prize money and sponsorship. Collect ₹500.',
    icon:  '🏅',
    effect: {
      type:   EFFECT_TYPES.MONEY,
      amount: 500,
    },
  },

  {
    id:    'CC-10',
    deck:  DECKS.COMMUNITY,
    title: 'Bollywood Cameo',
    text:  'A filmmaker spotted you and paid for a 30-second cameo. Collect ₹1,200.',
    icon:  '🎬',
    effect: {
      type:   EFFECT_TYPES.MONEY,
      amount: 1_200,
    },
  },

  {
    id:    'CC-11',
    deck:  DECKS.COMMUNITY,
    title: 'Agricultural Subsidy',
    text:  'PM-KISAN instalment credited. Collect ₹400.',
    icon:  '🌾',
    effect: {
      type:   EFFECT_TYPES.MONEY,
      amount: 400,
    },
  },

  {
    id:    'CC-12',
    deck:  DECKS.COMMUNITY,
    title: 'Train Delay Compensation',
    text:  'IRCTC processed your delay refund — surprisingly fast. Collect ₹300.',
    icon:  '⏱️',
    effect: {
      type:   EFFECT_TYPES.MONEY,
      amount: 300,
    },
  },

  {
    id:    'CC-13',
    deck:  DECKS.COMMUNITY,
    title: 'National Award Cash Prize',
    text:  'Recognised for social work by the state government. Collect ₹3,000.',
    icon:  '🌟',
    effect: {
      type:   EFFECT_TYPES.MONEY,
      amount: 3_000,
    },
  },

  // ── NEGATIVE MONEY (11 cards) ─────────────────────────────────────────────

  {
    id:    'CC-14',
    deck:  DECKS.COMMUNITY,
    title: 'Medical Emergency',
    text:  'Sudden hospitalisation for a family member. Insurance deductible applies. Pay ₹2,000.',
    icon:  '🏥',
    effect: {
      type:        EFFECT_TYPES.MONEY,
      amount:      -2_000,
      destination: 'free_parking',
    },
  },

  {
    id:    'CC-15',
    deck:  DECKS.COMMUNITY,
    title: 'Vehicle Breakdown',
    text:  'Crankshaft failure on the highway. Towing + parts. Pay ₹900.',
    icon:  '🚗',
    effect: {
      type:        EFFECT_TYPES.MONEY,
      amount:      -900,
      destination: 'free_parking',
    },
  },

  {
    id:    'CC-16',
    deck:  DECKS.COMMUNITY,
    title: 'Unexpected Family Travel',
    text:  'Flight tickets for family during a crisis — last-minute price. Pay ₹1,100.',
    icon:  '✈️',
    effect: {
      type:        EFFECT_TYPES.MONEY,
      amount:      -1_100,
      destination: 'free_parking',
    },
  },

  {
    id:    'CC-17',
    deck:  DECKS.COMMUNITY,
    title: 'School Fee Hike',
    text:  'Private school announced a 40% annual fee hike. No warning. Pay ₹1,300.',
    icon:  '📚',
    effect: {
      type:        EFFECT_TYPES.MONEY,
      amount:      -1_300,
      destination: 'free_parking',
    },
  },

  {
    id:    'CC-18',
    deck:  DECKS.COMMUNITY,
    title: 'Electricity Bill Arrears',
    text:  'DISCOM sent revised bills with arrears for 6 months. Pay ₹500.',
    icon:  '🔌',
    effect: {
      type:        EFFECT_TYPES.MONEY,
      amount:      -500,
      destination: 'free_parking',
    },
  },

  {
    id:    'CC-19',
    deck:  DECKS.COMMUNITY,
    title: 'Relative\'s Wedding Gift',
    text:  'Social obligation demands a generous shagun envelope. Pay ₹700.',
    icon:  '💒',
    effect: {
      type:        EFFECT_TYPES.MONEY,
      amount:      -700,
      destination: 'free_parking',
    },
  },

  {
    id:    'CC-20',
    deck:  DECKS.COMMUNITY,
    title: 'Health Insurance Premium',
    text:  'Annual premium due for your family floater policy. Pay ₹600.',
    icon:  '🩺',
    effect: {
      type:        EFFECT_TYPES.MONEY,
      amount:      -600,
      destination: 'free_parking',
    },
  },

  {
    id:    'CC-21',
    deck:  DECKS.COMMUNITY,
    title: 'Water Pipeline Repair',
    text:  'Society maintenance committee assessed every flat for road-level pipe work. Pay ₹400.',
    icon:  '🔧',
    effect: {
      type:        EFFECT_TYPES.MONEY,
      amount:      -400,
      destination: 'free_parking',
    },
  },

  {
    id:    'CC-22',
    deck:  DECKS.COMMUNITY,
    title: 'Online Return Nightmare',
    text:  'Seller refused to accept return; bank sided with them. Pay ₹350.',
    icon:  '📦',
    effect: {
      type:        EFFECT_TYPES.MONEY,
      amount:      -350,
      destination: 'free_parking',
    },
  },

  {
    id:    'CC-23',
    deck:  DECKS.COMMUNITY,
    title: 'Property Tax Demand',
    text:  'Municipal corporation sent a revised property tax notice with interest. Pay ₹1,200.',
    icon:  '📄',
    effect: {
      type:        EFFECT_TYPES.MONEY,
      amount:      -1_200,
      destination: 'free_parking',
    },
  },

  {
    id:    'CC-24',
    deck:  DECKS.COMMUNITY,
    title: 'Street Repairs Assessment',
    text:  'Society levied building maintenance charges. Pay ₹500 per house, ₹1,500 per hotel.',
    icon:  '🏗️',
    effect: {
      type:     EFFECT_TYPES.REPAIRS,
      perHouse: 500,
      perHotel: 1_500,
    },
  },

  // ── MOVEMENT (2 cards) ────────────────────────────────────────────────────

  {
    id:    'CC-25',
    deck:  DECKS.COMMUNITY,
    title: 'Community Parade',
    text:  'The neighbourhood procession starts at the main square. Advance to Start Journey 🇮🇳 and collect ₹2,000.',
    icon:  '🎉',
    effect: {
      type:            EFFECT_TYPES.MOVE,
      tileId:          0,
      collectGoReward: true,
    },
  },

  {
    id:    'CC-26',
    deck:  DECKS.COMMUNITY,
    title: 'Arrested for Unpaid Dues',
    text:  'Municipal officers arrive with a warrant for unpaid civic dues. Go directly to Tihar Jail.',
    icon:  '🚔',
    effect: {
      type: EFFECT_TYPES.JAIL,
    },
  },

  // ── SPECIAL (4 cards) ─────────────────────────────────────────────────────

  {
    id:    'CC-27',
    deck:  DECKS.COMMUNITY,
    title: 'Get Out of Jail Free',
    text:  'An influential community leader intervenes on your behalf. Keep this card — use it to leave Tihar Jail free.',
    icon:  '🎟️',
    effect: {
      type: EFFECT_TYPES.GET_OUT_OF_JAIL,
    },
  },

  {
    id:    'CC-28',
    deck:  DECKS.COMMUNITY,
    title: 'Community Birthday',
    text:  'The entire mohalla celebrates your birthday. Each player pays you ₹300.',
    icon:  '🎂',
    effect: {
      type:      EFFECT_TYPES.COLLECT_FROM_ALL,
      perPlayer: 300,
    },
  },

  {
    id:    'CC-29',
    deck:  DECKS.COMMUNITY,
    title: 'Panchayat Award',
    text:  'Elected Best Citizen of the year. Community collection handed to you. Each player pays ₹200.',
    icon:  '🏅',
    effect: {
      type:      EFFECT_TYPES.COLLECT_FROM_ALL,
      perPlayer: 200,
    },
  },

  {
    id:    'CC-30',
    deck:  DECKS.COMMUNITY,
    title: 'Life Insurance Maturity',
    text:  'Your LIC endowment policy matured after 20 years. Collect ₹2,500.',
    icon:  '📋',
    effect: {
      type:   EFFECT_TYPES.MONEY,
      amount: 2_500,
    },
  },

]);

// ─────────────────────────────────────────────────────────────────────────────
// DECK MANAGEMENT UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shuffle a card array using Fisher-Yates (Knuth) algorithm.
 * Returns a NEW array — never mutates the frozen source.
 *
 * @param {ReadonlyArray} deck
 * @returns {Array}
 */
const shuffleDeck = (deck) => {
  const arr = Array.from(deck);
  for (let i = arr.length - 1; i > 0; i--) {
    const j   = crypto.randomInt(0, i + 1);
    const tmp = arr[i];
    arr[i]    = arr[j];
    arr[j]    = tmp;
  }
  return arr;
};

/**
 * Create a fresh pair of shuffled decks for the start of a new game.
 * Called by gameEngine.initializeGame().
 *
 * Returns a DeckState object stored inside gameState:
 *
 *   gameState.chanceDeck        {Card[]}  — shuffled chance cards
 *   gameState.chanceIndex       {number}  — next card to draw (0-based, wraps)
 *   gameState.communityDeck     {Card[]}  — shuffled community cards
 *   gameState.communityIndex    {number}  — next card to draw
 *
 * @returns {{ chanceDeck, chanceIndex, communityDeck, communityIndex }}
 */
const createFreshDecks = () => ({
  chanceDeck:     shuffleDeck(CHANCE_CARDS),
  chanceIndex:    0,
  communityDeck:  shuffleDeck(COMMUNITY_CHEST_CARDS),
  communityIndex: 0,
});

/**
 * Draw the next card from a deck, advancing the index.
 * Index wraps to 0 when exhausted — standard Monopoly cycle rule.
 *
 * Usage in gameEngine:
 *   const { card, nextIndex } = drawCard(gameState.chanceDeck, gameState.chanceIndex);
 *   gameState.chanceIndex = nextIndex;
 *   applyCardEffect(gameState, playerId, card);
 *
 * @param {Card[]}  deck
 * @param {number}  currentIndex
 * @returns {{ card: Card, nextIndex: number }}
 */
const drawCard = (deck, currentIndex) => {
  const safeIndex = currentIndex % deck.length;
  const card      = deck[safeIndex];
  const nextIndex = (safeIndex + 1) % deck.length;
  return { card, nextIndex };
};

/**
 * Draw a Chance card from gameState (mutates chanceIndex in place).
 *
 * @param {Object} gameState
 * @returns {Card}
 */
const drawChanceCard = (gameState) => {
  const { card, nextIndex } = drawCard(gameState.chanceDeck, gameState.chanceIndex);
  gameState.chanceIndex = nextIndex;
  return card;
};

/**
 * Draw a Community Chest card from gameState (mutates communityIndex in place).
 *
 * @param {Object} gameState
 * @returns {Card}
 */
const drawCommunityCard = (gameState) => {
  const { card, nextIndex } = drawCard(gameState.communityDeck, gameState.communityIndex);
  gameState.communityIndex = nextIndex;
  return card;
};

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check that a card object has a recognised effect type.
 * Guards against corrupted state during DB restore or reconnect.
 *
 * @param {Card} card
 * @returns {boolean}
 */
const isValidCard = (card) => {
  if (!card || typeof card !== 'object')                        return false;
  if (!card.id || !card.deck || !card.effect)                   return false;
  if (!Object.values(EFFECT_TYPES).includes(card.effect.type)) return false;
  return true;
};

/**
 * Returns a sanitised version of a card safe to broadcast to all clients.
 *
 * @param {Card} card
 * @returns {Card}
 */
const toClientCard = (card) => ({
  id:     card.id,
  deck:   card.deck,
  title:  card.title,
  text:   card.text,
  icon:   card.icon,
  effect: card.effect,
});

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  EFFECT_TYPES,
  DECKS,
  CHANCE_CARDS,
  COMMUNITY_CHEST_CARDS,
  createFreshDecks,
  drawCard,
  drawChanceCard,
  drawCommunityCard,
  shuffleDeck,
  isValidCard,
  toClientCard,
};