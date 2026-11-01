import type { Medicine, StockMovement } from '@/lib/types';

// Same convention already used on-screen (StockInventoryTable.tsx) — plain
// medicine categories have no barcode/specification of their own (Batch/
// Rack/Expiry cover that ground instead), so their Code/Type columns are
// derived differently than the optical categories (Frame/Lens/Contact
// Lens/Solution/Reading Glass), which store a real barcode + a composed
// specification string (e.g. "Full Rim", "Single Vision • BlueCut").
// Shared by the Inventory Reports PDF and its print sheet so both stay in
// sync — a single place to update if the rule ever changes.
export const PLAIN_MEDICINE_CATEGORIES = new Set(['Eye Drops', 'Tablets', 'Ointment', 'Capsules']);

export function categoryLabel(m: Medicine): string {
  if (m.category === 'Frame') return 'Frame (Regular)';
  if (m.category === 'Reading Glass') return 'Frame (Reading Glass)';
  if (PLAIN_MEDICINE_CATEGORIES.has(m.category)) return `Medicine (${m.category})`;
  return m.category;
}

export function codeFor(m: Medicine): string {
  if (PLAIN_MEDICINE_CATEGORIES.has(m.category)) return m.batchNumber || '-';
  return m.barcode || '-';
}

// The one column whose meaning genuinely changes per category — Frame Type
// for Frame, Lens Type + coatings for Lens, Power/BC/DIA for Contact Lens,
// Pack Size for Solution, Batch/Expiry for plain medicines (which have no
// `specification` value at all).
export function typeSpecFor(m: Medicine): string {
  if (PLAIN_MEDICINE_CATEGORIES.has(m.category)) {
    return [m.batchNumber ? `Batch ${m.batchNumber}` : '', m.expiryDate ? `Exp ${m.expiryDate}` : ''].filter(Boolean).join(', ') || '-';
  }
  return m.specification || '-';
}

export function stockStatusLabel(m: Medicine): string {
  if (m.availableStock === 0) return 'Out of Stock';
  if (m.availableStock <= m.minimumStock) return 'Low Stock';
  return 'In Stock';
}

// Per-item Stock In / Stock Out totals within the active Export Period —
// `movements` passed in is already date+category+search filtered by
// useInventoryReports, so this is just a group-by over data already fetched
// for the page (no extra Supabase query needed).
export function buildMovementTotals(movements: StockMovement[]): Map<string, { added: number; sold: number }> {
  const map = new Map<string, { added: number; sold: number }>();
  for (const mv of movements) {
    if (!mv.itemId) continue;
    const entry = map.get(mv.itemId) || { added: 0, sold: 0 };
    if (mv.movementType === 'Stock In') entry.added += mv.quantity;
    else entry.sold += mv.quantity;
    map.set(mv.itemId, entry);
  }
  return map;
}
