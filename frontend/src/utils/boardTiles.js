/**
 * utils/boardTiles.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Frontend mirror of backend/game-engine/boardData.js
 * ES module (no module.exports) safe to import in React.
 *
 * ⚠️  DO NOT EDIT tile IDs, positions, prices, rent arrays, or group keys.
 *     This file MUST stay in perfect sync with backend boardData.js.
 *     Schema fix: backend uses `amount` (not `taxAmount`) for tax tiles.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const TILE_TYPES = Object.freeze({
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

export const GROUPS = Object.freeze({
  BROWN:      'brown',
  LIGHT_BLUE: 'light_blue',
  PINK:       'pink',
  ORANGE:     'orange',
  RED:        'red',
  YELLOW:     'yellow',
  GREEN:      'green',
  DARK_BLUE:  'dark_blue',
});

export const COLOR_GROUP_META = Object.freeze({
  brown:      { hex: '#8B4513', label: 'Brown',      size: 2 },
  light_blue: { hex: '#87CEEB', label: 'Light Blue', size: 3 },
  pink:       { hex: '#FF69B4', label: 'Pink',       size: 3 },
  orange:     { hex: '#FF8C00', label: 'Orange',     size: 3 },
  red:        { hex: '#DC143C', label: 'Red',        size: 3 },
  yellow:     { hex: '#FFD700', label: 'Yellow',     size: 3 },
  green:      { hex: '#228B22', label: 'Green',      size: 3 },
  dark_blue:  { hex: '#00008B', label: 'Dark Blue',  size: 2 },
});

export const BOARD_TILES = [

  // ══════════════════════════════════════════════════════════════════════════
  // BOTTOM ROW  ·  Tiles 0–10  ·  Right → Left
  // ══════════════════════════════════════════════════════════════════════════

  // ── 0: GO
  {
    id: 0, position: 0,
    name: 'Start Journey 🇮🇳', subtitle: 'Collect ₹2,000 Salary',
    type: 'go', icon: '🇮🇳',
    goReward: 2000,
    description: 'Each time you pass or land here, collect ₹2,000 salary from the bank.',
  },

  // ── 1: PATNA (Brown)
  {
    id: 1, position: 1,
    name: 'Patna', subtitle: 'Capital of Bihar',
    type: 'property', group: 'brown', groupSize: 2, icon: '🏙️',
    price: 600,
    rent: [20, 100, 300, 900, 1_600, 2_500],
    houseCost: 500, mortgage: 300, unmortgage: 330,
    description: 'An affordable entry into the property market.',
  },

  // ── 2: COMMUNITY CHEST
  {
    id: 2, position: 2,
    name: 'Community Chest', subtitle: 'Draw a card',
    type: 'community', icon: '📦',
    description: 'Draw the top Community Chest card and follow its instructions.',
  },

  // ── 3: RANCHI (Brown)
  {
    id: 3, position: 3,
    name: 'Ranchi', subtitle: 'Capital of Jharkhand',
    type: 'property', group: 'brown', groupSize: 2, icon: '🌿',
    price: 800,
    rent: [40, 200, 600, 1_800, 3_200, 4_500],
    houseCost: 500, mortgage: 400, unmortgage: 440,
    description: 'Second brown property — owning both browns doubles base rent.',
  },

  // ── 4: INCOME TAX
  {
    id: 4, position: 4,
    name: 'Income Tax', subtitle: 'Pay ₹2,000',
    type: 'tax', icon: '📋',
    amount: 2000,                          // ← backend field name is `amount`
    description: 'Pay ₹2,000 Income Tax to the government.',
  },

  // ── 5: INDIAN RAILWAYS NORTH (Railway)
  {
    id: 5, position: 5,
    name: 'Indian Railways North 🚂', subtitle: 'Northern Division',
    type: 'railway', icon: '🚂',
    price: 2000,
    rent: [250, 500, 1_000, 2_000],
    mortgage: 1000, unmortgage: 1100,
    description: 'Railways pay escalating rent based on how many stations the owner controls.',
  },

  // ── 6: CHANDIGARH (Light Blue)
  {
    id: 6, position: 6,
    name: 'Chandigarh', subtitle: 'The City Beautiful',
    type: 'property', group: 'light_blue', groupSize: 3, icon: '🌸',
    price: 1_000,
    rent: [60, 300, 900, 2_700, 4_000, 5_500],
    houseCost: 500, mortgage: 500, unmortgage: 550,
    description: "India's first planned city — modern, clean, and a solid early purchase.",
  },

  // ── 7: CHANCE
  {
    id: 7, position: 7,
    name: 'Chance', subtitle: 'Draw a card',
    type: 'chance', icon: '❓',
    description: 'Draw the top Chance card and follow its instructions.',
  },

  // ── 8: INDORE (Light Blue)
  {
    id: 8, position: 8,
    name: 'Indore', subtitle: 'Cleanest City of India',
    type: 'property', group: 'light_blue', groupSize: 3, icon: '🏅',
    price: 1_000,
    rent: [60, 300, 900, 2_700, 4_000, 5_500],
    houseCost: 500, mortgage: 500, unmortgage: 550,
    description: "Indore has won India's cleanest city award 7 times.",
  },

  // ── 9: LUCKNOW (Light Blue)
  {
    id: 9, position: 9,
    name: 'Lucknow', subtitle: 'City of Nawabs',
    type: 'property', group: 'light_blue', groupSize: 3, icon: '🕌',
    price: 1_200,
    rent: [80, 400, 1_000, 3_000, 4_500, 6_000],
    houseCost: 500, mortgage: 600, unmortgage: 660,
    description: 'The city of Tehzeeb — most expensive Light Blue.',
  },

  // ── 10: TIHAR JAIL
  {
    id: 10, position: 10,
    name: 'Tihar Jail 🔒', subtitle: 'Just Visiting / In Jail',
    type: 'jail', icon: '🔒',
    jailFine: 500,
    description: 'Just visiting: no effect. In Jail: roll doubles, use card, or pay ₹500.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // LEFT COLUMN  ·  Tiles 11–19  ·  Bottom → Top
  // ══════════════════════════════════════════════════════════════════════════

  // ── 11: AHMEDABAD (Pink)
  {
    id: 11, position: 11,
    name: 'Ahmedabad', subtitle: 'Manchester of India',
    type: 'property', group: 'pink', groupSize: 3, icon: '🏭',
    price: 1_400,
    rent: [100, 500, 1_500, 4_500, 6_250, 7_500],
    houseCost: 1_000, mortgage: 700, unmortgage: 770,
    description: "India's textile hub and a major commercial centre.",
  },

  // ── 12: ELECTRICITY BOARD (Utility)
  {
    id: 12, position: 12,
    name: 'Electricity Board ⚡', subtitle: 'National Power Grid',
    type: 'utility', icon: '⚡',
    price: 1_500,
    rent: [4, 10],
    mortgage: 750, unmortgage: 825,
    description: 'Rent = dice total × 4 (one utility) or × 10 (both utilities).',
  },

  // ── 13: PUNE (Pink)
  {
    id: 13, position: 13,
    name: 'Pune', subtitle: 'Oxford of the East',
    type: 'property', group: 'pink', groupSize: 3, icon: '🎓',
    price: 1_400,
    rent: [100, 500, 1_500, 4_500, 6_250, 7_500],
    houseCost: 1_000, mortgage: 700, unmortgage: 770,
    description: 'A thriving IT and education hub.',
  },

  // ── 14: KOCHI (Pink)
  {
    id: 14, position: 14,
    name: 'Kochi', subtitle: 'Queen of the Arabian Sea',
    type: 'property', group: 'pink', groupSize: 3, icon: '⛵',
    price: 1_600,
    rent: [120, 600, 1_800, 5_000, 7_000, 9_000],
    houseCost: 1_000, mortgage: 800, unmortgage: 880,
    description: 'The historic port city — most expensive Pink.',
  },

  // ── 15: INDIAN RAILWAYS SOUTH (Railway)
  {
    id: 15, position: 15,
    name: 'Indian Railways South 🚂', subtitle: 'Southern Division',
    type: 'railway', icon: '🚂',
    price: 2_000,
    rent: [250, 500, 1_000, 2_000],
    mortgage: 1_000, unmortgage: 1_100,
    description: 'Second railway station — owning two railways doubles rent to ₹500.',
  },

  // ── 16: CHENNAI (Orange)
  {
    id: 16, position: 16,
    name: 'Chennai', subtitle: 'Detroit of India',
    type: 'property', group: 'orange', groupSize: 3, icon: '🚗',
    price: 1_800,
    rent: [140, 700, 2_000, 5_500, 7_500, 9_500],
    houseCost: 1_000, mortgage: 900, unmortgage: 990,
    description: "India's automobile capital — Orange group is a powerful mid-game target.",
  },

  // ── 17: COMMUNITY CHEST
  {
    id: 17, position: 17,
    name: 'Community Chest', subtitle: 'Draw a card',
    type: 'community', icon: '📦',
    description: 'Draw the top Community Chest card and follow its instructions.',
  },

  // ── 18: HYDERABAD (Orange)
  {
    id: 18, position: 18,
    name: 'Hyderabad', subtitle: 'City of Pearls',
    type: 'property', group: 'orange', groupSize: 3, icon: '💎',
    price: 1_800,
    rent: [140, 700, 2_000, 5_500, 7_500, 9_500],
    houseCost: 1_000, mortgage: 900, unmortgage: 990,
    description: 'HITEC City makes Hyderabad a tech powerhouse.',
  },

  // ── 19: KOLKATA (Orange)
  {
    id: 19, position: 19,
    name: 'Kolkata', subtitle: 'City of Joy',
    type: 'property', group: 'orange', groupSize: 3, icon: '🎭',
    price: 2_000,
    rent: [160, 800, 2_200, 6_000, 8_000, 10_000],
    houseCost: 1_000, mortgage: 1_000, unmortgage: 1_100,
    description: 'The cultural capital — most expensive Orange.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TOP-LEFT CORNER  ·  Tile 20
  // ══════════════════════════════════════════════════════════════════════════

  // ── 20: TEA BREAK (Free Parking)
  {
    id: 20, position: 20,
    name: 'Tea Break ☕', subtitle: 'Free Parking',
    type: 'free_parking', icon: '☕',
    description: 'Rest and collect all taxes/fees accumulated in the pot.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TOP ROW  ·  Tiles 21–29  ·  Left → Right
  // ══════════════════════════════════════════════════════════════════════════

  // ── 21: BENGALURU (Red)
  {
    id: 21, position: 21,
    name: 'Bengaluru', subtitle: 'Silicon Valley of India',
    type: 'property', group: 'red', groupSize: 3, icon: '💻',
    price: 2_200,
    rent: [180, 900, 2_500, 7_000, 8_750, 10_500],
    houseCost: 1_500, mortgage: 1_100, unmortgage: 1_210,
    description: "India's IT capital — Red group has high house costs but exceptional hotel returns.",
  },

  // ── 22: CHANCE
  {
    id: 22, position: 22,
    name: 'Chance', subtitle: 'Draw a card',
    type: 'chance', icon: '❓',
    description: 'Draw the top Chance card and follow its instructions.',
  },

  // ── 23: DELHI (Red)
  {
    id: 23, position: 23,
    name: 'Delhi', subtitle: 'Capital of India',
    type: 'property', group: 'red', groupSize: 3, icon: '🏛️',
    price: 2_200,
    rent: [180, 900, 2_500, 7_000, 8_750, 10_500],
    houseCost: 1_500, mortgage: 1_100, unmortgage: 1_210,
    description: 'The seat of power.',
  },

  // ── 24: MUMBAI (Red)
  {
    id: 24, position: 24,
    name: 'Mumbai', subtitle: 'Financial Capital of India',
    type: 'property', group: 'red', groupSize: 3, icon: '💰',
    price: 2_400,
    rent: [200, 1_000, 3_000, 7_500, 9_250, 11_000],
    houseCost: 1_500, mortgage: 1_200, unmortgage: 1_320,
    description: 'Bollywood + Dalal Street = the most valuable Red property.',
  },

  // ── 25: INDIAN RAILWAYS EAST (Railway)
  {
    id: 25, position: 25,
    name: 'Indian Railways East 🚂', subtitle: 'Eastern Division',
    type: 'railway', icon: '🚂',
    price: 2_000,
    rent: [250, 500, 1_000, 2_000],
    mortgage: 1_000, unmortgage: 1_100,
    description: 'Third railway — with three stations the owner collects ₹1,000 per visit.',
  },

  // ── 26: JAIPUR (Yellow)
  {
    id: 26, position: 26,
    name: 'Jaipur', subtitle: 'Pink City of India',
    type: 'property', group: 'yellow', groupSize: 3, icon: '🏰',
    price: 2_600,
    rent: [220, 1_100, 3_300, 8_000, 9_750, 11_500],
    houseCost: 1_500, mortgage: 1_300, unmortgage: 1_430,
    description: 'The royal Pink City — Yellow is the penultimate power group.',
  },

  // ── 27: GOA (Yellow)
  {
    id: 27, position: 27,
    name: 'Goa', subtitle: 'Beach Paradise of India',
    type: 'property', group: 'yellow', groupSize: 3, icon: '🌊',
    price: 2_600,
    rent: [220, 1_100, 3_300, 8_000, 9_750, 11_500],
    houseCost: 1_500, mortgage: 1_300, unmortgage: 1_430,
    description: 'Sun, sand, and strong returns.',
  },

  // ── 28: WATER BOARD (Utility)
  {
    id: 28, position: 28,
    name: 'Water Board 💧', subtitle: 'National Water Authority',
    type: 'utility', icon: '💧',
    price: 1_500,
    rent: [4, 10],
    mortgage: 750, unmortgage: 825,
    description: 'Second utility — owning both means rent = dice × 10.',
  },

  // ── 29: SHIMLA (Yellow)
  {
    id: 29, position: 29,
    name: 'Shimla', subtitle: 'Queen of Hills',
    type: 'property', group: 'yellow', groupSize: 3, icon: '🏔️',
    price: 2_800,
    rent: [240, 1_200, 3_600, 8_500, 10_250, 12_000],
    houseCost: 1_500, mortgage: 1_400, unmortgage: 1_540,
    description: 'The Himalayan hill station — most expensive Yellow.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TOP-RIGHT CORNER  ·  Tile 30
  // ══════════════════════════════════════════════════════════════════════════

  // ── 30: GO TO JAIL
  {
    id: 30, position: 30,
    name: 'Income Tax Raid 🚔', subtitle: 'Go Directly to Tihar Jail',
    type: 'go_to_jail', icon: '🚔',
    jailDestination: 10,
    description: 'Caught! Move directly to Tihar Jail. Do not pass Start. Do not collect ₹2,000.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // RIGHT COLUMN  ·  Tiles 31–39  ·  Top → Bottom
  // ══════════════════════════════════════════════════════════════════════════

  // ── 31: MUNNAR (Green)
  {
    id: 31, position: 31,
    name: 'Munnar', subtitle: 'Tea Gardens of Kerala',
    type: 'property', group: 'green', groupSize: 3, icon: '🍃',
    price: 3_000,
    rent: [260, 1_300, 3_900, 9_000, 11_000, 12_750],
    houseCost: 2_000, mortgage: 1_500, unmortgage: 1_650,
    description: 'The emerald hills of Kerala — Green group requires heavy investment.',
  },

  // ── 32: SRINAGAR (Green)
  {
    id: 32, position: 32,
    name: 'Srinagar', subtitle: 'Paradise on Earth',
    type: 'property', group: 'green', groupSize: 3, icon: '🏞️',
    price: 3_000,
    rent: [260, 1_300, 3_900, 9_000, 11_000, 12_750],
    houseCost: 2_000, mortgage: 1_500, unmortgage: 1_650,
    description: "Heaven on Earth — shares Munnar's cost.",
  },

  // ── 33: COMMUNITY CHEST
  {
    id: 33, position: 33,
    name: 'Community Chest', subtitle: 'Draw a card',
    type: 'community', icon: '📦',
    description: 'Draw the top Community Chest card and follow its instructions.',
  },

  // ── 34: ANDAMAN & NICOBAR (Green)
  {
    id: 34, position: 34,
    name: 'Andaman & Nicobar 🏝️', subtitle: 'Emerald Islands of India',
    type: 'property', group: 'green', groupSize: 3, icon: '🏝️',
    price: 3_200,
    rent: [280, 1_500, 4_500, 10_000, 12_000, 14_000],
    houseCost: 2_000, mortgage: 1_600, unmortgage: 1_760,
    description: 'Remote island paradise — the most expensive Green.',
  },

  // ── 35: INDIAN RAILWAYS WEST (Railway)
  {
    id: 35, position: 35,
    name: 'Indian Railways West 🚂', subtitle: 'Western Division',
    type: 'railway', icon: '🚂',
    price: 2_000,
    rent: [250, 500, 1_000, 2_000],
    mortgage: 1_000, unmortgage: 1_100,
    description: 'Fourth and final railway — all four stations unlocks maximum ₹2,000 rent.',
  },

  // ── 36: CHANCE
  {
    id: 36, position: 36,
    name: 'Chance', subtitle: 'Draw a card',
    type: 'chance', icon: '❓',
    description: 'Draw the top Chance card and follow its instructions.',
  },

  // ── 37: BENGALURU TECH PARK (Dark Blue)
  {
    id: 37, position: 37,
    name: 'Bengaluru Tech Park 💻', subtitle: "India's IT Hub",
    type: 'property', group: 'dark_blue', groupSize: 2, icon: '🖥️',
    price: 3_500,
    rent: [350, 1_750, 5_000, 11_000, 13_000, 15_000],
    houseCost: 2_000, mortgage: 1_750, unmortgage: 1_925,
    description: "The jewel of India's tech economy.",
  },

  // ── 38: GST PAYMENT (Tax)
  {
    id: 38, position: 38,
    name: 'GST Payment 💸', subtitle: 'Goods & Services Tax',
    type: 'tax', icon: '💸',
    amount: 750,                           // ← backend field name is `amount`
    description: 'Pay ₹750 GST to the government.',
  },

  // ── 39: MUMBAI MARINE DRIVE (Dark Blue)
  {
    id: 39, position: 39,
    name: 'Mumbai Marine Drive 🌊', subtitle: "Queen's Necklace",
    type: 'property', group: 'dark_blue', groupSize: 2, icon: '🌃',
    price: 4_000,
    rent: [500, 2_000, 6_000, 14_000, 17_000, 20_000],
    houseCost: 2_000, mortgage: 2_000, unmortgage: 2_200,
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

/** Quick O(1) lookup by tile id */
export const TILE_BY_ID = Object.fromEntries(BOARD_TILES.map((t) => [t.id, t]));
