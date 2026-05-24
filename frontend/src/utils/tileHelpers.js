/**
 * utils/tileHelpers.js
 *
 * Shared helper functions for tile data display.
 * Imported by TileDetailsPanel, BoardTile, and modals.
 */

/** Format a number as Indian Rupees with commas, e.g. 1_500 → "1,500" */
export const fmt = (n) =>
  Number(n ?? 0).toLocaleString('en-IN');

/** Returns true when a tile is purchasable from the bank */
export const isPurchasable = (tile) =>
  tile && ['property', 'railway', 'utility'].includes(tile.type);

/**
 * Returns an array of human-readable rent description strings for a tile.
 * Each entry is formatted as "₹amount (label)" so TileDetailsPanel can split on " (".
 *
 * Property:  site, 1h–4h, hotel
 * Railway:   1–4 stations
 * Utility:   1 or 2 utilities (dice multipliers)
 * Tax:       single entry
 */
export const rentDescription = (tile) => {
  if (!tile) return [];

  if (tile.type === 'property' && Array.isArray(tile.rent)) {
    const labels = ['Site', '1 House', '2 Houses', '3 Houses', '4 Houses', 'Hotel'];
    return tile.rent.map((r, i) => `₹${fmt(r)} (${labels[i] ?? `Level ${i}`})`);
  }

  if (tile.type === 'railway' && Array.isArray(tile.rent)) {
    return tile.rent.map((r, i) => `₹${fmt(r)} (${i + 1} Station${i > 0 ? 's' : ''})`);
  }

  if (tile.type === 'utility' && Array.isArray(tile.rent)) {
    const labels = ['×4 Dice (1 utility)', '×10 Dice (2 utilities)'];
    return tile.rent.map((r, i) => `×${r} dice (${labels[i] ?? `${i + 1} util`})`);
  }

  if (tile.type === 'tax' && tile.amount) {
    return [`₹${fmt(tile.amount)} (Fixed Tax)`];
  }

  return [];
};