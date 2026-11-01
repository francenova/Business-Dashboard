import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiFetch';
import { Prescription } from '@/lib/types';
import { accumulateSummary, cloneEmptySummary } from '@/lib/salesRegisterQueryHelpers';
import type {
  SalesCategory,
  PaymentMethodFilter,
  PaymentStatusFilter,
  TaxStatusFilter,
  SortField,
  SortDir,
  SalesRegisterFilters,
  SalesSummary,
} from '@/lib/salesRegisterQueryHelpers';

export type { SalesCategory, PaymentMethodFilter, PaymentStatusFilter, TaxStatusFilter, SortField, SortDir, SalesRegisterFilters, SalesSummary };
export { accumulateSummary, cloneEmptySummary };

export interface PaymentMethodTotal {
  method: 'Cash' | 'UPI' | 'Card' | 'Mixed';
  count: number;
  amount: number;
}

const PAGE_SIZE = 50;

function filterParams(filters: SalesRegisterFilters): string {
  const params = new URLSearchParams({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    search: filters.search,
    paymentMethod: filters.paymentMethod,
    paymentStatus: filters.paymentStatus,
    category: filters.category,
    taxStatus: filters.taxStatus || 'all',
  });
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortDir) params.set('sortDir', filters.sortDir);
  return params.toString();
}

// Every query below now goes through /api/sales-register (service_role key,
// server-side) instead of calling Supabase directly — see
// app/api/sales-register/route.ts and lib/salesRegisterQueryHelpers.ts for
// the exact same filter/sort/aggregation logic that used to live here.
export function useSalesRegister(filters: SalesRegisterFilters) {
  const rowsQuery = useInfiniteQuery({
    queryKey: ['sales-register-rows', filters],
    queryFn: async ({ pageParam }) =>
      apiFetch<{ rows: Prescription[]; totalCount: number; page: number }>(`/api/sales-register?${filterParams(filters)}&page=${pageParam}`),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const loadedSoFar = (lastPage.page + 1) * PAGE_SIZE;
      return loadedSoFar < lastPage.totalCount ? lastPage.page + 1 : undefined;
    },
  });

  const summaryQuery = useQuery({
    queryKey: ['sales-register-summary', filters],
    queryFn: async (): Promise<SalesSummary> => apiFetch(`/api/sales-register?${filterParams(filters)}&summary=true`),
  });

  const rows: Prescription[] = rowsQuery.data?.pages.flatMap((p) => p.rows) || [];
  const totalCount = rowsQuery.data?.pages[0]?.totalCount || 0;

  return {
    rows,
    totalCount,
    summary: summaryQuery.data || cloneEmptySummary(),
    isLoading: rowsQuery.isLoading || summaryQuery.isLoading,
    isError: rowsQuery.isError || summaryQuery.isError,
    error: rowsQuery.error || summaryQuery.error,
    hasNextPage: Boolean(rowsQuery.hasNextPage),
    isFetchingNextPage: rowsQuery.isFetchingNextPage,
    fetchNextPage: rowsQuery.fetchNextPage,
  };
}

// Same summary math useSalesRegister's summaryQuery runs, exposed as a
// standalone async call — used by Report & Analysis's period-comparison.
export async function fetchSalesSummary(filters: SalesRegisterFilters): Promise<SalesSummary> {
  return apiFetch(`/api/sales-register?${filterParams(filters)}&summary=true`);
}

// Fetches every row matching the active filters, unpaginated — used by
// Print/PDF export.
export async function fetchAllSalesRows(filters: SalesRegisterFilters): Promise<Prescription[]> {
  return apiFetch(`/api/sales-register?${filterParams(filters)}&all=true`);
}

// Derives a short human-readable description of what was sold on a
// prescription/sale row — same signals used for the Category filter above.
export function deriveSaleDescription(rx: Prescription): string {
  const parts: string[] = [];
  if (rx.frame) parts.push('Frame');
  if (rx.lens) parts.push('Lens');
  if (rx.readingGlass) parts.push('Reading Glass');
  if (rx.solution) parts.push('Solution');
  if (rx.contactLens) parts.push('Contact Lens');
  if (rx.medicines && rx.medicines.length > 0) parts.push('Medicines');
  if (parts.length === 0) return 'Consultation';
  return parts.join(' + ');
}
