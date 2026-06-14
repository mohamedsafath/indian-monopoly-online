/**
 * backend/game-engine/boardData.js
 * ═══════════════════════════════════════════════════════════════════════════════
 * INDIAN MONOPOLY — Complete Board Data (Single Source of Truth)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Contains ALL 40 board tiles in exact Monopoly clockwise order:
 *   Tiles  0–10  → Bottom row  (right → left)
 *   Tiles 11–19  → Left column (bottom → top)
 *   Tile  20     → Top-left corner (Tea Break)
 *   Tiles 21–29  → Top row    (left → right)
 *   Tile  30     → Top-right corner (Go To Jail)
 *   Tiles 31–39  → Right column (top → bottom)
 *
 * Every purchasable tile includes:
 *   price        — cost to buy from bank
 *   rent[]       — [base, 1h, 2h, 3h, 4h, hotel]  for properties
 *                  [1rly, 2rly, 3rly, 4rly]         for railways
 *                  [1util, 2util]  (dice multiplier) for utilities
 *   houseCost    — cost per house (same for hotel upgrade)
 *   mortgage     — money received when mortgaging (≈ price/2)
 *   unmortgage   — cost to lift mortgage (mortgage × 1.1, rounded)
 *   group        — color group key (for monopoly detection)
 *   groupSize    — how many properties share this color
 *   position     — board index (0–39), mirrors array index
 *
 * Rent philosophy (scaled from standard Monopoly, ×10 for Indian ₹):
 *   Brown       cheap starter — rents ₹20–₹2,500
 *   Light Blue  early game    — rents ₹60–₹6,000
 *   Pink        mid-low       — rents ₹100–₹9,000
 *   Orange      mid           — rents ₹140–₹10,000
 *   Red         mid-high      — rents ₹180–₹11,000
 *   Yellow      high          — rents ₹220–₹12,000
 *   Green       premium       — rents ₹260–₹14,000
 *   Dark Blue   luxury        — rents ₹350–₹20,000
 *
 * DO NOT EDIT tile IDs or positions — game engine indexes by array position.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// ENUMERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/** All possible tile types on the board */
const TILE_TYPES = Object.freeze({
  GO:           'go',
  PROPERTY:     'property',
  RAILWAY:      'railway',
  UTILITY:      'utility',
  TAX:          'tax',
  CHANCE:       'chance',
  COMMUNITY:    'community',
  JAIL:         'jail',
  FREE_PARKING: 'free_parking',
  GO_TO_JAIL:   'go_to_jail',
});

/** Color group identifiers — must match COLOR_GROUPS keys */
const GROUPS = Object.freeze({
  BROWN:      'brown',
  LIGHT_BLUE: 'light_blue',
  PINK:       'pink',
  ORANGE:     'orange',
  RED:        'red',
  YELLOW:     'yellow',
  GREEN:      'green',
  DARK_BLUE:  'dark_blue',
});

/**
 * Color group display metadata
 * hex     — CSS color for board/UI rendering
 * label   — Human-readable group name
 * size    — Number of properties in this group
 */
const COLOR_GROUP_META = Object.freeze({
  [GROUPS.BROWN]:      { hex: '#8B4513', label: 'Brown',      size: 2 },
  [GROUPS.LIGHT_BLUE]: { hex: '#87CEEB', label: 'Light Blue', size: 3 },
  [GROUPS.PINK]:       { hex: '#FF69B4', label: 'Pink',       size: 3 },
  [GROUPS.ORANGE]:     { hex: '#FF8C00', label: 'Orange',     size: 3 },
  [GROUPS.RED]:        { hex: '#DC143C', label: 'Red',        size: 3 },
  [GROUPS.YELLOW]:     { hex: '#FFD700', label: 'Yellow',     size: 3 },
  [GROUPS.GREEN]:      { hex: '#228B22', label: 'Green',      size: 3 },
  [GROUPS.DARK_BLUE]:  { hex: '#00008B', label: 'Dark Blue',  size: 2 },
});

// ─────────────────────────────────────────────────────────────────────────────
// BOARD TILES — 40 tiles, index === board position
// ─────────────────────────────────────────────────────────────────────────────

const BOARD_TILES = [

  // ═══════════════════════════════════════════════════════════════════════════
  // BOTTOM ROW  ·  Tiles 0–10  ·  Right → Left
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Tile 0 ─ START ────────────────────────────────────────────────────────
  {
    id:          0,
    position:    0,
    name:        'Start Journey 🇮🇳',
    subtitle:    'Collect ₹2,000 Salary',
    type:        TILE_TYPES.GO,
    goReward:    2000,
    description: 'Each time you pass or land here, collect ₹2,000 salary from the bank.',
    icon:        '🇮🇳',
  },

  // ── Tile 1 ─ PATNA (Brown) ────────────────────────────────────────────────
  {
    id:          1,
    position:    1,
    name:        'Patna',
    subtitle:    'Capital of Bihar',
    type:        TILE_TYPES.PROPERTY,
    group:       GROUPS.BROWN,
    groupSize:   2,
    icon:        '🏙️',
    price:       600,
    rent:        [20, 100, 300, 900, 1_600, 2_500],
    houseCost:   500,
    mortgage:    300,
    unmortgage:  330,
    description: 'An affordable entry into the property market.',
  },

  // ── Tile 2 ─ COMMUNITY CHEST ──────────────────────────────────────────────
  {
    id:          2,
    position:    2,
    name:        'Community Chest',
    subtitle:    'Draw a card',
    type:        TILE_TYPES.COMMUNITY,
    icon:        '📦',
    description: 'Draw the top Community Chest card and follow its instructions.',
  },

  // ── Tile 3 ─ RANCHI (Brown) ───────────────────────────────────────────────
  {
    id:          3,
    position:    3,
    name:        'Ranchi',
    subtitle:    'Capital of Jharkhand',
    type:        TILE_TYPES.PROPERTY,
    group:       GROUPS.BROWN,
    groupSize:   2,
    icon:        '🌿',
    price:       800,
    rent:        [40, 200, 600, 1_800, 3_200, 4_500],
    houseCost:   500,
    mortgage:    400,
    unmortgage:  440,
    description: 'Second brown property — owning both browns doubles base rent.',
  },

  // ── Tile 4 ─ INCOME TAX ───────────────────────────────────────────────────
  {
    id:          4,
    position:    4,
    name:        'Income Tax',
    subtitle:    'Pay ₹2,000',
    type:        TILE_TYPES.TAX,
    icon:        '📋',
    amount:      2000,
    description: 'Pay ₹2,000 Income Tax to the government.',
  },

  // ── Tile 5 ─ INDIAN RAILWAYS NORTH (Railway) ──────────────────────────────
  {
    id:          5,
    position:    5,
    name:        'Indian Railways North 🚂',
    subtitle:    'Northern Division',
    type:        TILE_TYPES.RAILWAY,
    icon:        '🚂',
    price:       2000,
    rent:        [250, 500, 1_000, 2_000],
    mortgage:    1000,
    unmortgage:  1100,
    description: 'Railways pay escalating rent based on how many stations the owner controls.',
  },

  // ── Tile 6 ─ CHANDIGARH (Light Blue) ──────────────────────────────────────
  {
    id:          6,
    position:    6,
    name:        'Chandigarh',
    subtitle:    'The City Beautiful',
    type:        TILE_TYPES.PROPERTY,
    group:       GROUPS.LIGHT_BLUE,
    groupSize:   3,
    icon:        '🌸',
    price:       1_000,
    rent:        [60, 300, 900, 2_700, 4_000, 5_500],
    houseCost:   500,
    mortgage:    500,
    unmortgage:  550,
    description: 'India\'s first planned city — modern, clean, and a solid early purchase.',
  },

  // ── Tile 7 ─ CHANCE ───────────────────────────────────────────────────────
  {
    id:          7,
    position:    7,
    name:        'Chance',
    subtitle:    'Draw a card',
    type:        TILE_TYPES.CHANCE,
    icon:        '❓',
    description: 'Draw the top Chance card and follow its instructions.',
  },

  // ── Tile 8 ─ INDORE (Light Blue) ──────────────────────────────────────────
  {
    id:          8,
    position:    8,
    name:        'Indore',
    subtitle:    'Cleanest City of India',
    type:        TILE_TYPES.PROPERTY,
    group:       GROUPS.LIGHT_BLUE,
    groupSize:   3,
    icon:        '🏅',
    price:       1_000,
    rent:        [60, 300, 900, 2_700, 4_000, 5_500],
    houseCost:   500,
    mortgage:    500,
    unmortgage:  550,
    description: 'Indore has won India\'s cleanest city award 7 times.',
  },

  // ── Tile 9 ─ LUCKNOW (Light Blue) ─────────────────────────────────────────
  {
    id:          9,
    position:    9,
    name:        'Lucknow',
    subtitle:    'City of Nawabs',
    type:        TILE_TYPES.PROPERTY,
    group:       GROUPS.LIGHT_BLUE,
    groupSize:   3,
    icon:        '🕌',
    price:       1_200,
    rent:        [80, 400, 1_000, 3_000, 4_500, 6_000],
    houseCost:   500,
    mortgage:    600,
    unmortgage:  660,
    description: 'The city of Tehzeeb — most expensive Light Blue.',
  },

  // ── Tile 10 ─ TIHAR JAIL ──────────────────────────────────────────────────
  {
    id:          10,
    position:    10,
    name:        'Tihar Jail 🔒',
    subtitle:    'Just Visiting / In Jail',
    type:        TILE_TYPES.JAIL,
    icon:        '🔒',
    jailFine:    500,
    jailTile:    10,
    description: 'Just visiting: no effect. In Jail: roll doubles, use card, or pay ₹500.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LEFT COLUMN  ·  Tiles 11–19  ·  Bottom → Top
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Tile 11 ─ AHMEDABAD (Pink) ────────────────────────────────────────────
  {
    id:          11,
    position:    11,
    name:        'Ahmedabad',
    subtitle:    'Manchester of India',
    type:        TILE_TYPES.PROPERTY,
    group:       GROUPS.PINK,
    groupSize:   3,
    icon:        '🏭',
    price:       1_400,
    rent:        [100, 500, 1_500, 4_500, 6_250, 7_500],
    houseCost:   1_000,
    mortgage:    700,
    unmortgage:  770,
    description: 'India\'s textile hub and a major commercial centre.',
  },

  // ── Tile 12 ─ ELECTRICITY BOARD (Utility) ─────────────────────────────────
  {
    id:          12,
    position:    12,
    name:        'Electricity Board ⚡',
    subtitle:    'National Power Grid',
    type:        TILE_TYPES.UTILITY,
    icon:        '⚡',
    price:       1_500,
    rent:        [4, 10],
    mortgage:    750,
    unmortgage:  825,
    description: 'Rent = dice total × 4 (one utility) or × 10 (both utilities).',
  },

  // ── Tile 13 ─ PUNE (Pink) ─────────────────────────────────────────────────
  {
    id:          13,
    position:    13,
    name:        'Pune',
    subtitle:    'Oxford of the East',
    type:        TILE_TYPES.PROPERTY,
    group:       GROUPS.PINK,
    groupSize:   3,
    icon:        '🎓',
    price:       1_400,
    rent:        [100, 500, 1_500, 4_500, 6_250, 7_500],
    houseCost:   1_000,
    mortgage:    700,
    unmortgage:  770,
    description: 'A thriving IT and education hub.',
  },

  // ── Tile 14 ─ KOCHI (Pink) ────────────────────────────────────────────────
  {
    id:          14,
    position:    14,
    name:        'Kochi',
    subtitle:    'Queen of the Arabian Sea',
    type:        TILE_TYPES.PROPERTY,
    group:       GROUPS.PINK,
    groupSize:   3,
    icon:        '⛵',
    price:       1_600,
    rent:        [120, 600, 1_800, 5_000, 7_000, 9_000],
    houseCost:   1_000,
    mortgage:    800,
    unmortgage:  880,
    description: 'The historic port city — most expensive Pink.',
  },

  // ── Tile 15 ─ INDIAN RAILWAYS SOUTH (Railway) ─────────────────────────────
  {
    id:          15,
    position:    15,
    name:        'Indian Railways South 🚂',
    subtitle:    'Southern Division',
    type:        TILE_TYPES.RAILWAY,
    icon:        '🚂',
    price:       2_000,
    rent:        [250, 500, 1_000, 2_000],
    mortgage:    1_000,
    unmortgage:  1_100,
    description: 'Second railway station — owning two railways doubles rent to ₹500.',
  },

  // ── Tile 16 ─ CHENNAI (Orange) ────────────────────────────────────────────
  {
    id:          16,
    position:    16,
    name:        'Chennai',
    subtitle:    'Detroit of India',
    type:        TILE_TYPES.PROPERTY,
    group:       GROUPS.ORANGE,
    groupSize:   3,
    icon:        '🚗',
    price:       1_800,
    rent:        [140, 700, 2_000, 5_500, 7_500, 9_500],
    houseCost:   1_000,
    mortgage:    900,
    unmortgage:  990,
    description: 'India\'s automobile capital — Orange group is a powerful mid-game target.',
  },

  // ── Tile 17 ─ COMMUNITY CHEST ─────────────────────────────────────────────
  {
    id:          17,
    position:    17,
    name:        'Community Chest',
    subtitle:    'Draw a card',
    type:        TILE_TYPES.COMMUNITY,
    icon:        '📦',
    description: 'Draw the top Community Chest card and follow its instructions.',
  },

  // ── Tile 18 ─ HYDERABAD (Orange) ──────────────────────────────────────────
  {
    id:          18,
    position:    18,
    name:        'Hyderabad',
    subtitle:    'City of Pearls',
    type:        TILE_TYPES.PROPERTY,
    group:       GROUPS.ORANGE,
    groupSize:   3,
    icon:        '💎',
    price:       1_800,
    rent:        [140, 700, 2_000, 5_500, 7_500, 9_500],
    houseCost:   1_000,
    mortgage:    900,
    unmortgage:  990,
    description: 'HITEC City makes Hyderabad a tech powerhouse.',
  },

  // ── Tile 19 ─ KOLKATA (Orange) ────────────────────────────────────────────
  {
    id:          19,
    position:    19,
    name:        'Kolkata',
    subtitle:    'City of Joy',
    type:        TILE_TYPES.PROPERTY,
    group:       GROUPS.ORANGE,
    groupSize:   3,
    icon:        '🎭',
    price:       2_000,
    rent:        [160, 800, 2_200, 6_000, 8_000, 10_000],
    houseCost:   1_000,
    mortgage:    1_000,
    unmortgage:  1_100,
    description: 'The cultural capital — most expensive Orange.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TOP-LEFT CORNER  ·  Tile 20
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Tile 20 ─ TEA BREAK (Free Parking) ───────────────────────────────────
  {
    id:          20,
    position:    20,
    name:        'Tea Break ☕',
    subtitle:    'Free Parking',
    type:        TILE_TYPES.FREE_PARKING,
    icon:        '☕',
    description: 'Rest and collect all taxes/fees accumulated in the pot.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TOP ROW  ·  Tiles 21–29  ·  Left → Right
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Tile 21 ─ BENGALURU (Red) ─────────────────────────────────────────────
  {
    id:          21,
    position:    21,
    name:        'Bengaluru',
    subtitle:    'Silicon Valley of India',
    type:        TILE_TYPES.PROPERTY,
    group:       GROUPS.RED,
    groupSize:   3,
    icon:        '💻',
    price:       2_200,
    rent:        [180, 900, 2_500, 7_000, 8_750, 10_500],
    houseCost:   1_500,
    mortgage:    1_100,
    unmortgage:  1_210,
    description: 'India\'s IT capital — Red group has high house costs but exceptional hotel returns.',
  },

  // ── Tile 22 ─ CHANCE ──────────────────────────────────────────────────────
  {
    id:          22,
    position:    22,
    name:        'Chance',
    subtitle:    'Draw a card',
    type:        TILE_TYPES.CHANCE,
    icon:        '❓',
    description: 'Draw the top Chance card and follow its instructions.',
  },

  // ── Tile 23 ─ DELHI (Red) ─────────────────────────────────────────────────
  {
    id:          23,
    position:    23,
    name:        'Delhi',
    subtitle:    'Capital of India',
    type:        TILE_TYPES.PROPERTY,
    group:       GROUPS.RED,
    groupSize:   3,
    icon:        '🏛️',
    price:       2_200,
    rent:        [180, 900, 2_500, 7_000, 8_750, 10_500],
    houseCost:   1_500,
    mortgage:    1_100,
    unmortgage:  1_210,
    description: 'The seat of power.',
  },

  // ── Tile 24 ─ MUMBAI (Red) ────────────────────────────────────────────────
  {
    id:          24,
    position:    24,
    name:        'Mumbai',
    subtitle:    'Financial Capital of India',
    type:        TILE_TYPES.PROPERTY,
    group:       GROUPS.RED,
    groupSize:   3,
    icon:        '💰',
    price:       2_400,
    rent:        [200, 1_000, 3_000, 7_500, 9_250, 11_000],
    houseCost:   1_500,
    mortgage:    1_200,
    unmortgage:  1_320,
    description: 'Bollywood + Dalal Street = the most valuable Red property.',
  },

  // ── Tile 25 ─ INDIAN RAILWAYS EAST (Railway) ──────────────────────────────
  {
    id:          25,
    position:    25,
    name:        'Indian Railways East 🚂',
    subtitle:    'Eastern Division',
    type:        TILE_TYPES.RAILWAY,
    icon:        '🚂',
    price:       2_000,
    rent:        [250, 500, 1_000, 2_000],
    mortgage:    1_000,
    unmortgage:  1_100,
    description: 'Third railway — with three stations the owner collects ₹1,000 per visit.',
  },

  // ── Tile 26 ─ JAIPUR (Yellow) ─────────────────────────────────────────────
  {
    id:          26,
    position:    26,
    name:        'Jaipur',
    subtitle:    'Pink City of India',
    type:        TILE_TYPES.PROPERTY,
    group:       GROUPS.YELLOW,
    groupSize:   3,
    icon:        '🏰',
    price:       2_600,
    rent:        [220, 1_100, 3_300, 8_000, 9_750, 11_500],
    houseCost:   1_500,
    mortgage:    1_300,
    unmortgage:  1_430,
    description: 'The royal Pink City — Yellow is the penultimate power group.',
  },

  // ── Tile 27 ─ GOA (Yellow) ────────────────────────────────────────────────
  {
    id:          27,
    position:    27,
    name:        'Goa',
    subtitle:    'Beach Paradise of India',
    type:        TILE_TYPES.PROPERTY,
    group:       GROUPS.YELLOW,
    groupSize:   3,
    icon:        '🌊',
    price:       2_600,
    rent:        [220, 1_100, 3_300, 8_000, 9_750, 11_500],
    houseCost:   1_500,
    mortgage:    1_300,
    unmortgage:  1_430,
    description: 'Sun, sand, and strong returns.',
  },

  // ── Tile 28 ─ WATER BOARD (Utility) ──────────────────────────────────────
  {
    id:          28,
    position:    28,
    name:        'Water Board 💧',
    subtitle:    'National Water Authority',
    type:        TILE_TYPES.UTILITY,
    icon:        '💧',
    price:       1_500,
    rent:        [4, 10],
    mortgage:    750,
    unmortgage:  825,
    description: 'Second utility — owning both means rent = dice × 10.',
  },

  // ── Tile 29 ─ SHIMLA (Yellow) ─────────────────────────────────────────────
  {
    id:          29,
    position:    29,
    name:        'Shimla',
    subtitle:    'Queen of Hills',
    type:        TILE_TYPES.PROPERTY,
    group:       GROUPS.YELLOW,
    groupSize:   3,
    icon:        '🏔️',
    price:       2_800,
    rent:        [240, 1_200, 3_600, 8_500, 10_250, 12_000],
    houseCost:   1_500,
    mortgage:    1_400,
    unmortgage:  1_540,
    description: 'The Himalayan hill station — most expensive Yellow.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TOP-RIGHT CORNER  ·  Tile 30
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Tile 30 ─ GO TO JAIL ─────────────────────────────────────────────────
  {
    id:              30,
    position:        30,
    name:            'Income Tax Raid 🚔',
    subtitle:        'Go Directly to Tihar Jail',
    type:            TILE_TYPES.GO_TO_JAIL,
    icon:            '🚔',
    jailDestination: 10,
    description:     'Caught! Move directly to Tihar Jail. Do not pass Start Journey. Do not collect ₹2,000.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // RIGHT COLUMN  ·  Tiles 31–39  ·  Top → Bottom
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Tile 31 ─ MUNNAR (Green) ──────────────────────────────────────────────
  {
    id:          31,
    position:    31,
    name:        'Munnar',
    subtitle:    'Tea Gardens of Kerala',
    type:        TILE_TYPES.PROPERTY,
    group:       GROUPS.GREEN,
    groupSize:   3,
    icon:        '🍃',
    price:       3_000,
    rent:        [260, 1_300, 3_900, 9_000, 11_000, 12_750],
    houseCost:   2_000,
    mortgage:    1_500,
    unmortgage:  1_650,
    description: 'The emerald hills of Kerala — Green group requires heavy investment.',
  },

  // ── Tile 32 ─ SRINAGAR (Green) ────────────────────────────────────────────
  {
    id:          32,
    position:    32,
    name:        'Srinagar',
    subtitle:    'Paradise on Earth',
    type:        TILE_TYPES.PROPERTY,
    group:       GROUPS.GREEN,
    groupSize:   3,
    icon:        '🏞️',
    price:       3_000,
    rent:        [260, 1_300, 3_900, 9_000, 11_000, 12_750],
    houseCost:   2_000,
    mortgage:    1_500,
    unmortgage:  1_650,
    description: 'Heaven on Earth — shares Munnar\'s cost.',
  },

  // ── Tile 33 ─ COMMUNITY CHEST ─────────────────────────────────────────────
  {
    id:          33,
    position:    33,
    name:        'Community Chest',
    subtitle:    'Draw a card',
    type:        TILE_TYPES.COMMUNITY,
    icon:        '📦',
    description: 'Draw the top Community Chest card and follow its instructions.',
  },

  // ── Tile 34 ─ ANDAMAN & NICOBAR (Green) ──────────────────────────────────
  {
    id:          34,
    position:    34,
    name:        'Andaman & Nicobar 🏝️',
    subtitle:    'Emerald Islands of India',
    type:        TILE_TYPES.PROPERTY,
    group:       GROUPS.GREEN,
    groupSize:   3,
    icon:        '🏝️',
    price:       3_200,
    rent:        [280, 1_500, 4_500, 10_000, 12_000, 14_000],
    houseCost:   2_000,
    mortgage:    1_600,
    unmortgage:  1_760,
    description: 'Remote island paradise — the most expensive Green.',
  },

  // ── Tile 35 ─ INDIAN RAILWAYS WEST (Railway) ──────────────────────────────
  {
    id:          35,
    position:    35,
    name:        'Indian Railways West 🚂',
    subtitle:    'Western Division',
    type:        TILE_TYPES.RAILWAY,
    icon:        '🚂',
    price:       2_000,
    rent:        [250, 500, 1_000, 2_000],
    mortgage:    1_000,
    unmortgage:  1_100,
    description: 'Fourth and final railway — all four stations unlocks maximum ₹2,000 rent.',
  },

  // ── Tile 36 ─ CHANCE ──────────────────────────────────────────────────────
  {
    id:          36,
    position:    36,
    name:        'Chance',
    subtitle:    'Draw a card',
    type:        TILE_TYPES.CHANCE,
    icon:        '❓',
    description: 'Draw the top Chance card and follow its instructions.',
  },

  // ── Tile 37 ─ BENGALURU TECH PARK (Dark Blue) ────────────────────────────
  {
    id:          37,
    position:    37,
    name:        'Bengaluru Tech Park 💻',
    subtitle:    'India\'s IT Hub',
    type:        TILE_TYPES.PROPERTY,
    group:       GROUPS.DARK_BLUE,
    groupSize:   2,
    icon:        '🖥️',
    price:       3_500,
    rent:        [350, 1_750, 5_000, 11_000, 13_000, 15_000],
    houseCost:   2_000,
    mortgage:    1_750,
    unmortgage:  1_925,
    description: 'The jewel of India\'s tech economy.',
  },

  // ── Tile 38 ─ GST PAYMENT (Luxury Tax) ───────────────────────────────────
  {
    id:          38,
    position:    38,
    name:        'GST Payment 💸',
    subtitle:    'Goods & Services Tax',
    type:        TILE_TYPES.TAX,
    icon:        '💸',
    amount:      750,
    description: 'Pay ₹750 GST to the government.',
  },

  // ── Tile 39 ─ MUMBAI MARINE DRIVE (Dark Blue) ─────────────────────────────
  {
    id:          39,
    position:    39,
    name:        'Mumbai Marine Drive 🌊',
    subtitle:    'Queen\'s Necklace',
    type:        TILE_TYPES.PROPERTY,
    group:       GROUPS.DARK_BLUE,
    groupSize:   2,
    icon:        '🌃',
    price:       4_000,
    rent:        [500, 2_000, 6_000, 14_000, 17_000, 20_000],
    houseCost:   2_000,
    mortgage:    2_000,
    unmortgage:  2_200,
    description: 'The most expensive property on the board. Hotel rent: ₹20,000.',
  },

];

const NEW_PRICES = {
  1:  1000, // Patna (Brown: 1000-1500)
  3:  1500, // Ranchi (Brown: 1000-1500)
  6:  2000, // Chandigarh (Light Blue: 2k-3k)
  8:  2500, // Indore (Light Blue: 2k-3k)
  9:  3000, // Lucknow (Light Blue: 2k-3k)
  11: 3000, // Ahmedabad (Pink: 3k-4.5k)
  13: 3800, // Pune (Pink: 3k-4.5k)
  14: 4500, // Kochi (Pink: 3k-4.5k)
  16: 5000, // Chennai (Orange: 5k-7k)
  18: 6000, // Hyderabad (Orange: 5k-7k)
  19: 7000, // Kolkata (Orange: 5k-7k)
  21: 7000, // Bengaluru (Red: 7k-8k)
  23: 7500, // Delhi (Red: 7k-8k)
  24: 8000, // Mumbai (Red: 7k-8k)
  26: 5000, // Jaipur (Yellow: 5k-6k)
  27: 5500, // Goa (Yellow: 5k-6k)
  29: 6000, // Shimla (Yellow: 5k-6k)
  31: 7000, // Munnar (Green: 7k-8k)
  32: 7500, // Srinagar (Green: 7k-8k)
  34: 8000, // Andaman (Green: 7k-8k)
  37: 8000, // Bengaluru Tech Park (Blue: 8k-9k)
  39: 9000, // Mumbai Marine Drive (Blue: 8k-9k)
  
  // Railways (3k-5k)
  5:  3000, // Railways North
  15: 3600, // Railways South
  25: 4200, // Railways East
  35: 5000, // Railways West
  
  // Utilities
  12: 2500, // Electricity Board
  28: 3000, // Water Board
};

BOARD_TILES.forEach((tile) => {
  const newPrice = NEW_PRICES[tile.id];
  if (newPrice !== undefined) {
    const oldPrice = tile.price || 1;
    const scale = newPrice / oldPrice;
    tile.price = newPrice;
    tile.mortgage = Math.round(newPrice / 2);
    tile.unmortgage = Math.round(tile.mortgage * 1.1);
    if (tile.houseCost) {
      tile.houseCost = Math.round((tile.houseCost * scale) / 100) * 100;
    }
    if (Array.isArray(tile.rent)) {
      tile.rent = tile.rent.map(r => Math.round((r * scale) / 10) * 10);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DERIVED LOOKUP TABLES
// ─────────────────────────────────────────────────────────────────────────────

const COLOR_GROUP_TILES = (() => {
  const map = {};
  BOARD_TILES.forEach((tile) => {
    if (tile.type === TILE_TYPES.PROPERTY && tile.group) {
      if (!map[tile.group]) map[tile.group] = [];
      map[tile.group].push(tile.id);
    }
  });
  Object.keys(map).forEach((g) => map[g].sort((a, b) => a - b));
  return Object.freeze(map);
})();

const TILE_BY_ID = Object.freeze(
  BOARD_TILES.reduce((acc, tile) => {
    acc[tile.id] = tile;
    return acc;
  }, {})
);

const RAILWAY_TILE_IDS = Object.freeze(
  BOARD_TILES.filter((t) => t.type === TILE_TYPES.RAILWAY).map((t) => t.id)
);

const UTILITY_TILE_IDS = Object.freeze(
  BOARD_TILES.filter((t) => t.type === TILE_TYPES.UTILITY).map((t) => t.id)
);

const CHANCE_TILE_IDS = Object.freeze(
  BOARD_TILES.filter((t) => t.type === TILE_TYPES.CHANCE).map((t) => t.id)
);

const COMMUNITY_TILE_IDS = Object.freeze(
  BOARD_TILES.filter((t) => t.type === TILE_TYPES.COMMUNITY).map((t) => t.id)
);

const PURCHASABLE_TILE_IDS = Object.freeze(
  BOARD_TILES
    .filter((t) => [TILE_TYPES.PROPERTY, TILE_TYPES.RAILWAY, TILE_TYPES.UTILITY].includes(t.type))
    .map((t) => t.id)
);

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

const getColorGroupTiles = (tileId) => {
  const tile = TILE_BY_ID[tileId];
  if (!tile || !tile.group) return [];
  return COLOR_GROUP_TILES[tile.group] || [];
};

const hasMonopoly = (properties, playerId, tileId) => {
  const groupTiles = getColorGroupTiles(tileId);
  if (groupTiles.length === 0) return false;
  return groupTiles.every(
    (id) => properties[id] && properties[id].ownerId === playerId
  );
};

const countRailwaysOwned = (properties, playerId) =>
  RAILWAY_TILE_IDS.filter((id) => properties[id]?.ownerId === playerId && !properties[id]?.mortgaged).length;

const countUtilitiesOwned = (properties, playerId) =>
  UTILITY_TILE_IDS.filter((id) => properties[id]?.ownerId === playerId && !properties[id]?.mortgaged).length;

const calculateRent = (properties, players, tileId, landingPlayerId, diceTotal) => {
  const prop = properties[tileId];

  if (!prop)                              return 0;
  if (!prop.ownerId)                      return 0;
  if (prop.mortgaged)                     return 0;
  if (prop.ownerId === landingPlayerId)   return 0;
  if (players[prop.ownerId]?.isBankrupt)  return 0;

  const tile = TILE_BY_ID[tileId];

  if (tile.type === TILE_TYPES.RAILWAY) {
    const owned = countRailwaysOwned(properties, prop.ownerId);
    return tile.rent[Math.max(0, owned - 1)];
  }

  if (tile.type === TILE_TYPES.UTILITY) {
    const owned      = countUtilitiesOwned(properties, prop.ownerId);
    const multiplier = tile.rent[owned === 2 ? 1 : 0];
    return diceTotal * multiplier;
  }

  if (tile.type === TILE_TYPES.PROPERTY) {
    if (prop.hotel)       return tile.rent[5];
    if (prop.houses > 0)  return tile.rent[prop.houses];
    const groupTiles = getColorGroupTiles(tileId);
    const anyMortgaged = groupTiles.some((id) => properties[id]?.mortgaged);
    const monopoly = hasMonopoly(properties, prop.ownerId, tileId);
    return monopoly && !anyMortgaged ? tile.rent[0] * 2 : tile.rent[0];
  }

  return 0;
};

const buildInitialProperties = () => {
  const map = {};
  PURCHASABLE_TILE_IDS.forEach((id) => {
    map[id] = {
      tileId:    id,
      ownerId:   null,
      houses:    0,
      hotel:     false,
      mortgaged: false,
    };
  });
  return map;
};

const findNearestTile = (currentPosition, targetIds) => {
  let nearest     = null;
  let minDistance = Infinity;

  targetIds.forEach((id) => {
    const dist = id > currentPosition
      ? id - currentPosition
      : 40 - currentPosition + id;

    if (dist < minDistance) {
      minDistance = dist;
      nearest     = id;
    }
  });

  return nearest;
};

const isTilePurchasable = (tileId) =>
  PURCHASABLE_TILE_IDS.includes(tileId);

const canBuildHouse = (properties, playerId, tileId, playerPosition) => {
  const tile = TILE_BY_ID[tileId];
  const prop = properties[tileId];

  if (!tile || tile.type !== TILE_TYPES.PROPERTY)
    return { canBuild: false, reason: 'Not a buildable property' };
  if (!prop || prop.ownerId !== playerId)
    return { canBuild: false, reason: 'You do not own this property' };
  if (prop.mortgaged)
    return { canBuild: false, reason: 'Property is mortgaged' };
  if (prop.hotel)
    return { canBuild: false, reason: 'Property already has a hotel' };
  if (prop.houses >= 4)
    return { canBuild: false, reason: 'Need to upgrade to hotel' };
  if (!hasMonopoly(properties, playerId, tileId))
    return { canBuild: false, reason: 'Must own the entire color group first' };

  // Check if player is currently landed on this property
  if (playerPosition !== undefined && Number(playerPosition) !== Number(tileId)) {
    return { canBuild: false, reason: 'You must land on the property to build on it' };
  }

  const groupTiles  = getColorGroupTiles(tileId);
  const hasMortgaged = groupTiles.some((id) => properties[id]?.mortgaged);
  if (hasMortgaged) {
    return { canBuild: false, reason: 'Cannot build if any property in the color group is mortgaged' };
  }

  // Enforce Even Building Rule: cannot exceed any sibling property's houses by more than 1
  const currentHouses = prop.houses || 0;
  const isUneven = groupTiles.some((id) => {
    if (id === Number(tileId)) return false;
    const siblingProp = properties[id];
    const siblingHouses = siblingProp?.hotel ? 5 : (siblingProp?.houses || 0);
    return siblingHouses < currentHouses;
  });
  if (isUneven) {
    return { canBuild: false, reason: 'Must build evenly across color group' };
  }

  return { canBuild: true, reason: null };
};

const canBuildHotel = (properties, playerId, tileId, playerPosition) => {
  const tile = TILE_BY_ID[tileId];
  const prop = properties[tileId];

  if (!tile || tile.type !== TILE_TYPES.PROPERTY)
    return { canBuild: false, reason: 'Not a buildable property' };
  if (!prop || prop.ownerId !== playerId)
    return { canBuild: false, reason: 'You do not own this property' };
  if (prop.mortgaged)
    return { canBuild: false, reason: 'Property is mortgaged' };
  if (prop.hotel)
    return { canBuild: false, reason: 'Already has a hotel' };
  if (prop.houses < 4)
    return { canBuild: false, reason: `Need 4 houses first (currently ${prop.houses})` };
  if (!hasMonopoly(properties, playerId, tileId))
    return { canBuild: false, reason: 'Must own the entire color group' };

  // Check if player is currently landed on this property
  if (playerPosition !== undefined && Number(playerPosition) !== Number(tileId)) {
    return { canBuild: false, reason: 'You must land on the property to build on it' };
  }

  const groupTiles = getColorGroupTiles(tileId);
  const hasMortgaged = groupTiles.some((id) => properties[id]?.mortgaged);
  if (hasMortgaged) {
    return { canBuild: false, reason: 'Cannot build if any property in the color group is mortgaged' };
  }

  // Enforce Even Building Rule for Hotels: all sibling properties must have at least 4 houses (or a hotel)
  const isUnevenHotel = groupTiles.some((id) => {
    if (id === Number(tileId)) return false;
    const siblingProp = properties[id];
    return !siblingProp || (!siblingProp.hotel && (siblingProp.houses || 0) < 4);
  });
  if (isUnevenHotel) {
    return { canBuild: false, reason: 'Must build 4 houses on all sibling properties before building a hotel' };
  }

  return { canBuild: true, reason: null };
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  BOARD_TILES,
  TILE_TYPES,
  GROUPS,
  COLOR_GROUP_META,
  COLOR_GROUP_TILES,
  TILE_BY_ID,
  RAILWAY_TILE_IDS,
  UTILITY_TILE_IDS,
  CHANCE_TILE_IDS,
  COMMUNITY_TILE_IDS,
  PURCHASABLE_TILE_IDS,
  getColorGroupTiles,
  hasMonopoly,
  countRailwaysOwned,
  countUtilitiesOwned,
  calculateRent,
  buildInitialProperties,
  findNearestTile,
  isTilePurchasable,
  canBuildHouse,
  canBuildHotel,
};