import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiFetch';
import { Supplier, Expense, Medicine } from '@/lib/types';

export interface SupplierPaymentStatus {
  totalPurchased: number;
  totalPaid: number;
  outstanding: number; // positive = owed to supplier, 0 = settled
  advance: number; // positive = supplier has been paid ahead of what's owed
}

export interface SupplierDetails {
  supplier: Supplier;
  products: Medicine[];
  transactions: Expense[];
  paymentStatus: SupplierPaymentStatus;
}

// Everything about one supplier — their contact card, every medicines row
// currently sourced from them, and every expense recorded under their name.
// See app/api/suppliers/[id]/route.ts.
export function useSupplierDetails(supplierId: string) {
  return useQuery({
    queryKey: ['supplier-details', supplierId],
    queryFn: async (): Promise<SupplierDetails> => apiFetch(`/api/suppliers/${supplierId}`),
    enabled: !!supplierId,
  });
}
