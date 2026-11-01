import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiFetch';
import { Medicine, StockMovement } from '@/lib/types';

export type InventoryCategory = 'all' | 'Frames' | 'Lenses' | 'Medicines' | 'Solutions' | 'Reading Glasses' | 'Contact Lens';

export interface InventoryReportFilters {
  dateFrom: string; // YYYY-MM-DD — scopes stock_movements only; current stock is always "right now"
  dateTo: string;
  category: InventoryCategory;
  search: string;
}

export interface InventorySummary {
  totalItems: number;
  totalStockQty: number;
  lowStockCount: number;
  outOfStockCount: number;
  stockIn: number;
  stockOut: number;
  inventoryValue: number;
}

export interface CategorySummaryRow {
  category: Exclude<InventoryCategory, 'all'>;
  totalProducts: number;
  inStockCount: number; // items with availableStock > 0
  availableQty: number; // remaining quantity (sum of availableStock)
  stockAdded: number; // Stock In movement quantity within the active date range
  lowStock: number;
  outOfStock: number;
  stockValue: number;
}

const REPORT_CATEGORIES: Exclude<InventoryCategory, 'all'>[] = ['Frames', 'Lenses', 'Medicines', 'Solutions', 'Reading Glasses', 'Contact Lens'];

// Maps a real medicines.category value to its report-level bucket. Frame,
// Lens, and Contact Lens rows are now real (Expense↔Inventory connection —
// added via Medicine Inventory's category cards or the Expense Management
// "+ Add Stock" flow, both writing into this same table).
function reportCategoryOf(medicineCategory: string): Exclude<InventoryCategory, 'all'> {
  if (medicineCategory === 'Solution') return 'Solutions';
  if (medicineCategory === 'Reading Glass') return 'Reading Glasses';
  if (medicineCategory === 'Frame') return 'Frames';
  if (medicineCategory === 'Lens') return 'Lenses';
  if (medicineCategory === 'Contact Lens') return 'Contact Lens';
  return 'Medicines';
}

function isLowStock(item: Medicine): boolean {
  return item.availableStock > 0 && item.availableStock <= item.minimumStock;
}

function matchesCategory(category: string, filter: InventoryCategory): boolean {
  if (filter === 'all') return true;
  return reportCategoryOf(category) === filter;
}

function matchesSearch(item: Medicine, term: string): boolean {
  if (!term) return true;
  const t = term.toLowerCase();
  return (
    item.name.toLowerCase().includes(t) ||
    (item.barcode || '').toLowerCase().includes(t) ||
    (item.brand || '').toLowerCase().includes(t) ||
    (item.category || '').toLowerCase().includes(t)
  );
}

async function fetchMedicines(): Promise<Medicine[]> {
  return apiFetch('/api/medicines');
}

// Date-range scoped only — deliberately NOT category-filtered here, so a
// single fetch can serve both the (possibly category-filtered) movements
// table the caller sees AND the always-full-catalog category summary cards
// below, which need every category's Stock In total regardless of which
// category chip is currently selected.
async function fetchMovements(dateFrom: string, dateTo: string): Promise<StockMovement[]> {
  return apiFetch(`/api/stock-movements?dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`);
}

export function useInventoryReports(filters: InventoryReportFilters) {
  const medicinesQuery = useQuery({ queryKey: ['inventory-reports-medicines'], queryFn: fetchMedicines });
  const movementsQuery = useQuery({
    queryKey: ['inventory-reports-movements', filters.dateFrom, filters.dateTo],
    queryFn: () => fetchMovements(filters.dateFrom, filters.dateTo),
  });

  const allItems = medicinesQuery.data || [];
  const allMovementsInRange = movementsQuery.data || [];

  const items = allItems.filter((item) => matchesCategory(item.category, filters.category) && matchesSearch(item, filters.search));

  // Movements shown to the caller (the Stock Movement table) still respect
  // the active category chip + search box, same behavior as before.
  const movements = allMovementsInRange.filter((m) => {
    if (filters.category !== 'all' && !matchesCategory(m.category, filters.category)) return false;
    const term = filters.search.trim().toLowerCase();
    if (!term) return true;
    return (
      m.itemName.toLowerCase().includes(term) ||
      m.category.toLowerCase().includes(term) ||
      (m.reference || '').toLowerCase().includes(term)
    );
  });

  const lowStockItems = items.filter(isLowStock);
  const outOfStockItems = items.filter((i) => i.availableStock === 0);

  const summary: InventorySummary = {
    totalItems: items.length,
    totalStockQty: items.reduce((s, i) => s + i.availableStock, 0),
    lowStockCount: lowStockItems.length,
    outOfStockCount: outOfStockItems.length,
    stockIn: movements.filter((m) => m.movementType === 'Stock In').reduce((s, m) => s + m.quantity, 0),
    stockOut: movements.filter((m) => m.movementType === 'Stock Out').reduce((s, m) => s + m.quantity, 0),
    inventoryValue: items.reduce((s, i) => s + i.availableStock * i.sellingPrice, 0),
  };

  // Category summary's item counts always cover the full catalog (not the
  // active category/search filters) — an at-a-glance breakdown across every
  // category. stockAdded is scoped to the active date range (the period
  // selector) but, like the counts, never to the category/search filters —
  // otherwise picking one category chip would zero out every other
  // category's card.
  const categorySummary: CategorySummaryRow[] = REPORT_CATEGORIES.map((cat) => {
    const catItems = allItems.filter((i) => matchesCategory(i.category, cat));
    const catStockAdded = allMovementsInRange
      .filter((m) => matchesCategory(m.category, cat) && m.movementType === 'Stock In')
      .reduce((s, m) => s + m.quantity, 0);
    return {
      category: cat,
      totalProducts: catItems.length,
      inStockCount: catItems.filter((i) => i.availableStock > 0).length,
      availableQty: catItems.reduce((s, i) => s + i.availableStock, 0),
      stockAdded: catStockAdded,
      lowStock: catItems.filter(isLowStock).length,
      outOfStock: catItems.filter((i) => i.availableStock === 0).length,
      stockValue: catItems.reduce((s, i) => s + i.availableStock * i.sellingPrice, 0),
    };
  });

  return {
    items,
    movements,
    summary,
    lowStockItems,
    outOfStockItems,
    categorySummary,
    isLoading: medicinesQuery.isLoading || movementsQuery.isLoading,
    isError: medicinesQuery.isError || movementsQuery.isError,
    error: medicinesQuery.error || movementsQuery.error,
    refetch: () => {
      medicinesQuery.refetch();
      movementsQuery.refetch();
    },
  };
}
