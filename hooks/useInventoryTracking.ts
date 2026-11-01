import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiFetch';
import type { StockMovement } from '@/lib/types';

export interface InventoryTrackingInfo {
  lastRestockedAt?: string; // most recent Stock In movement date for this item
  totalSold: number; // sum of Stock Out quantities with reason 'Sale' for this item
}

// All-time tracking info per medicine, derived from stock_movements — a
// different question than the existing period-filtered summary cards in
// useInventoryReports.ts, so this is its own lightweight query rather than
// an extension of that hook.
export function useInventoryTracking() {
  const query = useQuery({
    queryKey: ['inventory-tracking'],
    queryFn: async () => {
      const movements = await apiFetch<StockMovement[]>('/api/stock-movements');
      const trackingByItemId: Record<string, InventoryTrackingInfo> = {};

      for (const mv of movements) {
        if (!mv.itemId) continue;
        const entry = trackingByItemId[mv.itemId] || { totalSold: 0 };
        if (mv.movementType === 'Stock In') {
          if (!entry.lastRestockedAt || mv.date > entry.lastRestockedAt) {
            entry.lastRestockedAt = mv.date;
          }
        } else if (mv.movementType === 'Stock Out' && mv.reason === 'Sale') {
          entry.totalSold += mv.quantity;
        }
        trackingByItemId[mv.itemId] = entry;
      }

      return trackingByItemId;
    },
  });

  return {
    trackingByItemId: query.data || {},
    isLoading: query.isLoading,
  };
}
