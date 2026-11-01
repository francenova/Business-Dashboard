import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { parseExpenseFilters, applyFilters, type ExpenseFilters } from '@/lib/expenseQueryHelpers';
import type { ExpenseCategory, ExpensePaymentMethod } from '@/lib/types';

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

function accumulate(acc: ExpenseSummary, row: { amount: number; category: ExpenseCategory; payment_method: ExpensePaymentMethod | null }): ExpenseSummary {
  const amount = row.amount || 0;
  acc.total += amount;
  acc.count += 1;
  if (amount > acc.largest) acc.largest = amount;
  acc.byCategory[row.category] = (acc.byCategory[row.category] || 0) + amount;
  if (row.payment_method) {
    const existing = acc.byPaymentMethod[row.payment_method] || { count: 0, amount: 0 };
    existing.count += 1;
    existing.amount += amount;
    acc.byPaymentMethod[row.payment_method] = existing;
  }
  return acc;
}

// Mirrors both useExpenses.ts's summaryQuery and the standalone
// fetchExpenseSummary (Report & Analysis's period-comparison) — same query,
// same math, just driven by query-string filters now.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters: ExpenseFilters = parseExpenseFilters(searchParams);
  const supabase = createServiceClient();

  let query = supabase.from('expenses').select('amount, category, payment_method');
  query = applyFilters(query, filters);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const summary = (data || []).reduce((acc: ExpenseSummary, row: any) => accumulate(acc, row), emptySummary());
  summary.average = summary.count > 0 ? summary.total / summary.count : 0;
  return NextResponse.json(summary);
}
