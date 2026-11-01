import type { ExpenseCategory, ExpensePaymentMethod } from '@/lib/types';

export interface ExpenseFilters {
  dateFrom: string;
  dateTo: string;
  search: string;
  category: ExpenseCategory | 'all';
  paymentMethod: ExpensePaymentMethod | 'all';
}

// Shared by every app/api/expenses/** route — same filter-application logic
// that used to live once in hooks/useExpenses.ts, now reused server-side
// instead of duplicated per route.
export function parseExpenseFilters(searchParams: URLSearchParams): ExpenseFilters {
  return {
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
    search: searchParams.get('search') || '',
    category: (searchParams.get('category') as ExpenseCategory | 'all') || 'all',
    paymentMethod: (searchParams.get('paymentMethod') as ExpensePaymentMethod | 'all') || 'all',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyFilters(query: any, filters: ExpenseFilters) {
  if (filters.dateFrom) query = query.gte('date', filters.dateFrom);
  if (filters.dateTo) query = query.lte('date', `${filters.dateTo}T23:59:59.999`);
  if (filters.category !== 'all') query = query.eq('category', filters.category);
  if (filters.paymentMethod !== 'all') query = query.eq('payment_method', filters.paymentMethod);

  const term = filters.search.trim();
  if (term) {
    query = query.or(
      `display_id.ilike.%${term}%,description.ilike.%${term}%,vendor.ilike.%${term}%,reference_number.ilike.%${term}%,category.ilike.%${term}%`
    );
  }
  return query;
}
