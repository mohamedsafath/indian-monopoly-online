/**
 * utils/boardLayout.js
 * Maps each of the 40 tile positions to:
 *   - CSS grid coordinates (col, row) in an 11×11 grid
 *   - Which edge they belong to (bottom, left, top, right, corner)
 *   - Text rotation angle for labels
 *
 * Grid layout (11×11):
 *   Corners:      (0,10), (0,0), (10,0), (10,10)
 *   Bottom row:   cols 1–9, row 10  → tiles 1–9
 *   Left col:     col 0, rows 9–1   → tiles 11–19
 *   Top row:      cols 1–9, row 0   → tiles 21–29
 *   Right col:    col 10, rows 1–9  → tiles 31–39
 */

// Tile index → { col, row, edge, rotate }
export const TILE_POSITIONS = (() => {
  const map = {};

  // Tile 0 — GO corner (bottom-right)
  map[0] = { col: 10, row: 10, edge: 'corner', rotate: 0 };

  // Bottom row: tiles 1–9, right→left (col 9 down to 1), row 10
  for (let i = 1; i <= 9; i++) {
    map[i] = { col: 10 - i, row: 10, edge: 'bottom', rotate: 0 };
  }

  // Tile 10 — Jail corner (bottom-left)
  map[10] = { col: 0, row: 10, edge: 'corner', rotate: 0 };

  // Left column: tiles 11–19, bottom→top (rows 9 down to 1), col 0
  for (let i = 11; i <= 19; i++) {
    map[i] = { col: 0, row: 10 - (i - 10), edge: 'left', rotate: 90 };
  }

  // Tile 20 — Free Parking corner (top-left)
  map[20] = { col: 0, row: 0, edge: 'corner', rotate: 0 };

  // Top row: tiles 21–29, left→right (cols 1–9), row 0
  for (let i = 21; i <= 29; i++) {
    map[i] = { col: i - 20, row: 0, edge: 'top', rotate: 180 };
  }

  // Tile 30 — Go To Jail corner (top-right)
  map[30] = { col: 10, row: 0, edge: 'corner', rotate: 0 };

  // Right column: tiles 31–39, top→bottom (rows 1–9), col 10
  for (let i = 31; i <= 39; i++) {
    map[i] = { col: 10, row: i - 30, edge: 'right', rotate: 270 };
  }

  return map;
})();

/** Color group → CSS color mapping (matching boardData.js COLOR_GROUP_META) */
export const GROUP_COLORS = {
  brown:      '#8B4513',
  light_blue: '#87CEEB',
  pink:       '#FF69B4',
  orange:     '#FF8C00',
  red:        '#DC143C',
  yellow:     '#FFD700',
  green:      '#228B22',
  dark_blue:  '#00008B',
};

/** Accent hex for group color strips */
export const GROUP_ACCENT = {
  brown:      '#A0522D',
  light_blue: '#ADD8E6',
  pink:       '#FF1493',
  orange:     '#FF6200',
  red:        '#B22222',
  yellow:     '#DAA520',
  green:      '#006400',
  dark_blue:  '#000080',
};

/** Human-readable group labels */
export const GROUP_LABELS = {
  brown:      'Brown',
  light_blue: 'Light Blue',
  pink:       'Pink',
  orange:     'Orange',
  red:        'Red',
  yellow:     'Yellow',
  green:      'Green',
  dark_blue:  'Dark Blue',
};

/** Player token emojis & colors (must match gameEngine.js) */
export const PLAYER_TOKENS  = ['🚗', '🐘', '🚆', '👑', '🛺', '🐅', '⚓', '🎯'];
export const PLAYER_COLORS  = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#34495e',
];

/**
 * Given a tile id, return the CSS grid-column and grid-row (1-indexed).
 */
export const tileToGridCell = (tileId) => {
  const pos = TILE_POSITIONS[tileId];
  if (!pos) return { gridColumn: 1, gridRow: 1 };
  return {
    gridColumn: pos.col + 1,
    gridRow:    pos.row + 1,
  };
};

/**
 * Return the stacking offset for multiple tokens on the same tile.
 * Distributes up to 8 tokens in a circular arrangement.
 */
export const tokenStackOffset = (index, total) => {
  if (total <= 1) return { x: 0, y: 0 };
  const angle  = (index / total) * 2 * Math.PI;
  const radius = Math.min(10, 4 + total * 1.5);
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
};