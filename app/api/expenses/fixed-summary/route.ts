import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// Mirrors AppContext... actually hooks/useExpenses.ts's old
// fetchFixedScopeExpenseSummary — always-current totals, independent of
// whatever filters are active on the Expense Management table.
export async function GET() {
  const supabase = createServiceClient();
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const monthStart = `${todayStr.slice(0, 7)}-01`;
  const yearStart = `${now.getFullYear()}-01-01`;

  const [{ data: yearRows, error: yearErr }, { data: allRows, error: allErr }] = await Promise.all([
    supabase.from('expenses').select('amount, date').gte('date', yearStart),
    supabase.from('expenses').select('amount'),
  ]);
  if (yearErr) return NextResponse.json({ error: yearErr.message }, { status: 500 });
  if (allErr) return NextResponse.json({ error: allErr.message }, { status: 500 });

  let today = 0;
  let thisMonth = 0;
  let thisYear = 0;
  for (const row of yearRows || []) {
    const amount = (row.amount as number) || 0;
    const dateStr = String(row.date).split('T')[0];
    thisYear += amount;
    if (dateStr >= monthStart) thisMonth += amount;
    if (dateStr === todayStr) today += amount;
  }
  const allTime = (allRows || []).reduce((s, r: any) => s + (r.amount || 0), 0);

  return NextResponse.json({ today, thisMonth, thisYear, allTime });
}
