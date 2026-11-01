import type { SupabaseClient } from '@supabase/supabase-js';

export type SalesCategory = 'all' | 'Frame' | 'Lens' | 'Reading Glass' | 'Solution' | 'Contact Lens' | 'Medicines' | 'Consultation';
export type PaymentMethodFilter = 'all' | 'Cash' | 'UPI' | 'Card' | 'Mixed';
export type PaymentStatusFilter = 'all' | 'Paid' | 'Partial' | 'Pending';
export type TaxStatusFilter = 'all' | 'gst' | 'non-gst';
export type SortField = 'date' | 'invoiceNumber' | 'grandTotal' | 'advance' | 'balance';
export type SortDir = 'asc' | 'desc';

export interface SalesRegisterFilters {
  dateFrom: string;
  dateTo: string;
  search: string;
  paymentMethod: PaymentMethodFilter;
  paymentStatus: PaymentStatusFilter;
  category: SalesCategory;
  taxStatus?: TaxStatusFilter;
  sortBy?: SortField;
  sortDir?: SortDir;
}

export interface SalesSummary {
  totalInvoices: number;
  grossSales: number;
  discount: number;
  grandTotal: number;
  collected: number;
  pending: number;
  byPaymentMethod: Record<'Cash' | 'UPI' | 'Card' | 'Mixed', { count: number; amount: number }>;
  byStatus: Record<'Paid' | 'Partial' | 'Pending', number>;
  taxableAmount: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  totalTax: number;
}

export function cloneEmptySummary(): SalesSummary {
  return {
    totalInvoices: 0,
    grossSales: 0,
    discount: 0,
    grandTotal: 0,
    collected: 0,
    pending: 0,
    byPaymentMethod: {
      Cash: { count: 0, amount: 0 },
      UPI: { count: 0, amount: 0 },
      Card: { count: 0, amount: 0 },
      Mixed: { count: 0, amount: 0 },
    },
    byStatus: { Paid: 0, Partial: 0, Pending: 0 },
    taxableAmount: 0,
    cgstTotal: 0,
    sgstTotal: 0,
    igstTotal: 0,
    totalTax: 0,
  };
}

// Shared reducer — a single row → summary accumulation used everywhere a
// summary is computed, so TSR and DSR can never disagree on the math.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function accumulateSummary(acc: SalesSummary, row: { payment: Record<string, any> | null }): SalesSummary {
  const p = row.payment || {};
  acc.totalInvoices += 1;
  acc.grossSales += p.subtotal || 0;
  acc.discount += p.discount || 0;
  acc.grandTotal += p.grandTotal || 0;
  acc.collected += p.advance || 0;
  acc.pending += p.balance || 0;
  acc.taxableAmount += p.taxableAmount || 0;
  acc.cgstTotal += p.cgstAmount || 0;
  acc.sgstTotal += p.sgstAmount || 0;
  acc.igstTotal += p.igstAmount || 0;
  acc.totalTax += p.totalTax || 0;

  const method = p.paymentMethod as 'Cash' | 'UPI' | 'Card' | 'Mixed' | undefined;
  if (method && acc.byPaymentMethod[method]) {
    acc.byPaymentMethod[method].count += 1;
    acc.byPaymentMethod[method].amount += p.grandTotal || 0;
  }

  const status = p.status as 'Paid' | 'Partial' | 'Pending' | undefined;
  if (status && acc.byStatus[status] !== undefined) {
    acc.byStatus[status] += 1;
  }
  return acc;
}

export function parseSalesRegisterFilters(searchParams: URLSearchParams): SalesRegisterFilters {
  return {
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
    search: searchParams.get('search') || '',
    paymentMethod: (searchParams.get('paymentMethod') as PaymentMethodFilter) || 'all',
    paymentStatus: (searchParams.get('paymentStatus') as PaymentStatusFilter) || 'all',
    category: (searchParams.get('category') as SalesCategory) || 'all',
    taxStatus: (searchParams.get('taxStatus') as TaxStatusFilter) || 'all',
    sortBy: (searchParams.get('sortBy') as SortField) || undefined,
    sortDir: (searchParams.get('sortDir') as SortDir) || undefined,
  };
}

const CATEGORY_COLUMN: Record<string, string> = {
  Frame: 'frame',
  Lens: 'lens',
  'Reading Glass': 'reading_glass',
  Solution: 'solution',
  'Contact Lens': 'contact_lens',
};

// Shared filter application so the paginated table, the unpaginated
// summary, and the unpaginated print/PDF export all agree on exactly the
// same rows. Relocated verbatim from hooks/useSalesRegister.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyFilters(query: any, filters: SalesRegisterFilters, patientIds: string[] | null) {
  if (filters.dateFrom) query = query.gte('date', filters.dateFrom);
  if (filters.dateTo) query = query.lte('date', `${filters.dateTo}T23:59:59.999`);

  if (filters.paymentMethod !== 'all') query = query.eq('payment->>paymentMethod', filters.paymentMethod);
  if (filters.paymentStatus !== 'all') query = query.eq('payment->>status', filters.paymentStatus);

  if (filters.taxStatus && filters.taxStatus !== 'all') {
    if (filters.taxStatus === 'gst') {
      query = query.not('payment->>totalTax', 'is', null).neq('payment->>totalTax', '0');
    } else {
      query = query.or('payment->>totalTax.is.null,payment->>totalTax.eq.0');
    }
  }

  if (filters.category !== 'all') {
    if (filters.category === 'Medicines') {
      query = query.neq('medicines', '[]');
    } else if (filters.category === 'Consultation') {
      query = query.is('frame', null).is('lens', null).is('reading_glass', null).is('solution', null).is('contact_lens', null).eq('medicines', '[]');
    } else {
      const col = CATEGORY_COLUMN[filters.category];
      if (col) query = query.not(col, 'is', null);
    }
  }

  const term = filters.search.trim();
  if (term) {
    const orParts = [`display_id.ilike.%${term}%`];
    if (patientIds && patientIds.length > 0) {
      orParts.push(`patient_id.in.(${patientIds.join(',')})`);
    }
    query = query.or(orParts.join(','));
  }

  return query;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applySort(query: any, filters: SalesRegisterFilters) {
  const dir = { ascending: filters.sortDir === 'asc' };
  switch (filters.sortBy) {
    case 'invoiceNumber':
      return query.order('payment->>invoiceNumber', dir).order('id', { ascending: true });
    case 'grandTotal':
      return query.order('payment->grandTotal', dir).order('id', { ascending: true });
    case 'advance':
      return query.order('payment->advance', dir).order('id', { ascending: true });
    case 'balance':
      return query.order('payment->balance', dir).order('id', { ascending: true });
    default:
      return query.order('date', { ascending: filters.sortDir === 'asc' }).order('id', { ascending: true });
  }
}

// Resolves a search term to candidate patient IDs (name/phone match) so the
// prescriptions query can filter by patient without a fragile embedded
// .or() filter across the join.
export async function resolvePatientIds(supabase: SupabaseClient, term: string): Promise<string[] | null> {
  if (!term) return null;
  const { data, error } = await supabase.from('patients').select('id').or(`name.ilike.%${term}%,phone.ilike.%${term}%`).limit(200);
  if (error) throw error;
  return (data || []).map((p: { id: string }) => p.id);
}
