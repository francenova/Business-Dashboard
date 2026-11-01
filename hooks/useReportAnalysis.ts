import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiFetch';

export interface ReportAnalysisFilters {
  dateFrom: string; // YYYY-MM-DD
  dateTo: string; // YYYY-MM-DD
}

export interface TrendPoint {
  key: string; // sort key, YYYY-MM-DD or YYYY-MM
  label: string; // display label
  sales: number;
  collection: number;
  tax: number;
  invoiceCount: number;
}

export interface ExpenseTrendPoint {
  key: string;
  amount: number;
}

export interface CategoryBreakdownRow {
  category: string;
  amount: number;
  quantity: number;
}

export interface TopMedicineRow {
  key: string;
  name: string;
  category: string;
  quantity: number;
  amount: number;
}

export interface PatientAnalysis {
  totalPatients: number;
  newPatients: number;
  returningPatients: number;
}

const VISIT_STATUSES = ['Completed', 'Pending Delivery', 'Ready Order', 'In Progress'] as const;
type VisitStatus = (typeof VISIT_STATUSES)[number];

export interface VisitAnalysis {
  totalVisits: number;
  byStatus: Record<VisitStatus, number>;
  byWeekday: { day: string; count: number }[];
}

export interface OutstandingCustomerRow {
  patientId: string;
  patientName: string;
  pending: number;
}

// Every fetch below now goes through app/api/report-analysis/** (service_role
// key, server-side) instead of calling Supabase directly — each route holds
// the exact same bucketing/aggregation logic that used to live in this file.
function periodParams(filters: ReportAnalysisFilters): string {
  return new URLSearchParams({ dateFrom: filters.dateFrom, dateTo: filters.dateTo }).toString();
}

async function fetchSalesTrend(filters: ReportAnalysisFilters): Promise<TrendPoint[]> {
  return apiFetch(`/api/report-analysis/sales-trend?${periodParams(filters)}`);
}

async function fetchExpenseTrend(filters: ReportAnalysisFilters): Promise<ExpenseTrendPoint[]> {
  return apiFetch(`/api/report-analysis/expense-trend?${periodParams(filters)}`);
}

async function fetchCategoryBreakdown(filters: ReportAnalysisFilters): Promise<CategoryBreakdownRow[]> {
  return apiFetch(`/api/report-analysis/category-breakdown?${periodParams(filters)}`);
}

// Medicines is the only real product catalog in this app — frames, lenses,
// reading glasses, solutions and contact lenses are free-typed jsonb per
// visit with no catalog table to rank by product name. Per the master
// prompt's own fallback instruction ("if exact product-level data isn't
// available, show category-level analysis instead"), Top Products is
// medicines-only; the other categories are covered by the breakdown above.
async function fetchTopMedicines(filters: ReportAnalysisFilters): Promise<TopMedicineRow[]> {
  return apiFetch(`/api/report-analysis/top-medicines?${periodParams(filters)}`);
}

async function fetchPatientAnalysis(filters: ReportAnalysisFilters): Promise<PatientAnalysis> {
  return apiFetch(`/api/report-analysis/patient-analysis?${periodParams(filters)}`);
}

async function fetchVisitAnalysis(filters: ReportAnalysisFilters): Promise<VisitAnalysis> {
  return apiFetch(`/api/report-analysis/visit-analysis?${periodParams(filters)}`);
}

// All-time, not period-scoped — matches the Ledger module's own definition
// of "Total Pending" (a customer's real current balance), not a snapshot of
// only what became due during the selected period.
async function fetchOutstandingByCustomer(limit = 10): Promise<OutstandingCustomerRow[]> {
  return apiFetch(`/api/report-analysis/outstanding-by-customer?limit=${limit}`);
}

export function useReportAnalysis(filters: ReportAnalysisFilters) {
  const trendQuery = useQuery({
    queryKey: ['report-analysis-trend', filters],
    queryFn: () => fetchSalesTrend(filters),
  });
  const expenseTrendQuery = useQuery({
    queryKey: ['report-analysis-expense-trend', filters],
    queryFn: () => fetchExpenseTrend(filters),
  });
  const categoryQuery = useQuery({
    queryKey: ['report-analysis-category', filters],
    queryFn: () => fetchCategoryBreakdown(filters),
  });
  const topMedicinesQuery = useQuery({
    queryKey: ['report-analysis-top-medicines', filters],
    queryFn: () => fetchTopMedicines(filters),
  });
  const patientsQuery = useQuery({
    queryKey: ['report-analysis-patients', filters],
    queryFn: () => fetchPatientAnalysis(filters),
  });
  const visitsQuery = useQuery({
    queryKey: ['report-analysis-visits', filters],
    queryFn: () => fetchVisitAnalysis(filters),
  });
  const outstandingQuery = useQuery({
    queryKey: ['report-analysis-outstanding'],
    queryFn: () => fetchOutstandingByCustomer(10),
  });

  return {
    trend: trendQuery.data || [],
    expenseTrend: expenseTrendQuery.data || [],
    categoryBreakdown: categoryQuery.data || [],
    topMedicines: topMedicinesQuery.data || [],
    patients: patientsQuery.data,
    visits: visitsQuery.data,
    outstandingByCustomer: outstandingQuery.data || [],
    isLoading:
      trendQuery.isLoading ||
      expenseTrendQuery.isLoading ||
      categoryQuery.isLoading ||
      topMedicinesQuery.isLoading ||
      patientsQuery.isLoading ||
      visitsQuery.isLoading ||
      outstandingQuery.isLoading,
    isError:
      trendQuery.isError ||
      expenseTrendQuery.isError ||
      categoryQuery.isError ||
      topMedicinesQuery.isError ||
      patientsQuery.isError ||
      visitsQuery.isError ||
      outstandingQuery.isError,
  };
}

// Previous period of equal length, immediately preceding dateFrom — e.g.
// Aug 1-31 vs Jul 1-31, or a custom 7-day range vs the 7 days before it.
export function getPreviousPeriodRange(dateFrom: string, dateTo: string): { dateFrom: string; dateTo: string } {
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  const lengthMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 86400000);
  const prevFrom = new Date(prevTo.getTime() - lengthMs);
  const toStr = (d: Date) => d.toISOString().split('T')[0];
  return { dateFrom: toStr(prevFrom), dateTo: toStr(prevTo) };
}

export type ChangeDirection = 'up' | 'down' | 'flat';

// Section 19's safe-zero-state rule: a zero previous period produces no
// percentage — showing e.g. "+∞%" or fabricating a number would be
// misleading, so callers must render "No previous-period comparison"
// instead when this returns null.
export function pctChange(current: number, previous: number): { value: number; direction: ChangeDirection } | null {
  if (previous === 0) return null;
  const value = ((current - previous) / previous) * 100;
  const direction: ChangeDirection = value > 0.05 ? 'up' : value < -0.05 ? 'down' : 'flat';
  return { value, direction };
}
