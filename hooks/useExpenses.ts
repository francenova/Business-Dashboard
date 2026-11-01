import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiFetch';
import { Expense, ExpenseCategory, ExpensePaymentMethod } from '@/lib/types';

export interface ExpenseFilters {
  dateFrom: string; // YYYY-MM-DD
  dateTo: string; // YYYY-MM-DD
  search: string;
  category: ExpenseCategory | 'all';
  paymentMethod: ExpensePaymentMethod | 'all';
}

export interface ExpenseSummary {
  total: number;
  count: number;
  largest: number;
  average: number;
  byCategory: Partial<Record<ExpenseCategory, number>>;
  byPaymentMethod: Partial<Record<ExpensePaymentMethod, { count: number; amount: number }>>;
}

function emptySummary(): ExpenseSummary {
  return { total: 0, count: 0, largest: 0, average: 0, byCategory: {}, byPaymentMethod: {} };
}

function filterParams(filters: ExpenseFilters): string {
  const params = new URLSearchParams({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    search: filters.search,
    category: filters.category,
    paymentMethod: filters.paymentMethod,
  });
  return params.toString();
}

// Every query below now goes through /api/expenses/** (service_role key,
// server-side) instead of calling Supabase directly — see
// app/api/expenses/*/route.ts and lib/expenseQueryHelpers.ts for the exact
// same filter/aggregation logic that used to live in this file.
export function useExpenses(filters: ExpenseFilters) {
  const rowsQuery = useInfiniteQuery({
    queryKey: ['expense-report-rows', filters],
    queryFn: async ({ pageParam }) =>
      apiFetch<{ rows: Expense[]; totalCount: number; page: number }>(`/api/expenses?${filterParams(filters)}&page=${pageParam}`),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const PAGE_SIZE = 50;
      const loadedSoFar = (lastPage.page + 1) * PAGE_SIZE;
      return loadedSoFar < lastPage.totalCount ? lastPage.page + 1 : undefined;
    },
  });

  const summaryQuery = useQuery({
    queryKey: ['expense-report-summary', filters],
    queryFn: async (): Promise<ExpenseSummary> => apiFetch(`/api/expenses/summary?${filterParams(filters)}`),
  });

  const rows: Expense[] = rowsQuery.data?.pages.flatMap((p) => p.rows) || [];
  const totalCount = rowsQuery.data?.pages[0]?.totalCount || 0;

  return {
    rows,
    totalCount,
    summary: summaryQuery.data || emptySummary(),
    isLoading: rowsQuery.isLoading || summaryQuery.isLoading,
    isError: rowsQuery.isError || summaryQuery.isError,
    error: rowsQuery.error || summaryQuery.error,
    hasNextPage: Boolean(rowsQuery.hasNextPage),
    isFetchingNextPage: rowsQuery.isFetchingNextPage,
    fetchNextPage: rowsQuery.fetchNextPage,
    refetch: () => {
      rowsQuery.refetch();
      summaryQuery.refetch();
    },
  };
}

// Same summary math useExpenses's summaryQuery runs, exposed as a
// standalone async call — used by Report & Analysis's period-comparison.
export async function fetchExpenseSummary(filters: ExpenseFilters): Promise<ExpenseSummary> {
  return apiFetch(`/api/expenses/summary?${filterParams(filters)}`);
}

// Fetches every row matching the active filters, unpaginated — used by
// Print/PDF/Excel export.
export async function fetchAllExpenseRows(filters: ExpenseFilters): Promise<Expense[]> {
  return apiFetch(`/api/expenses?${filterParams(filters)}&all=true`);
}

export interface FixedScopeExpenseSummary {
  today: number;
  thisMonth: number;
  thisYear: number;
  allTime: number;
}

// Always-current totals shown at the top of Expense Management — deliberately
// independent of whatever date/category/payment filters are active on the
// table below, so the owner can see "today" and "this month" no matter what
// they're currently filtering by.
export async function fetchFixedScopeExpenseSummary(): Promise<FixedScopeExpenseSummary> {
  return apiFetch('/api/expenses/fixed-summary');
}

export interface SupplierExpenseSummary {
  vendor: string;
  totalAmount: number;
  totalPaid: number;
  outstanding: number; // positive = owed to supplier, negative = advance paid
  count: number;
  lastDate: string;
}

// Supplier-wise spend for the active date range.
export async function fetchSupplierSummary(dateFrom: string, dateTo: string): Promise<SupplierExpenseSummary[]> {
  return apiFetch(`/api/expenses/supplier-summary?dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`);
}

// Yearly mode's monthly breakdown — a lightweight, separate aggregate query
// scoped to just the selected year.
export async function fetchMonthlyBreakdown(year: string): Promise<{ month: number; total: number }[]> {
  return apiFetch(`/api/expenses/monthly-breakdown?year=${encodeURIComponent(year)}`);
}
