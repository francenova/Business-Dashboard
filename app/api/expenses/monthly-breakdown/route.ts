import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// Mirrors hooks/useExpenses.ts's old fetchMonthlyBreakdown — Expense
// Management's Yearly-view monthly totals.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year');
  if (!year) return NextResponse.json({ error: 'year is required' }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('expenses')
    .select('amount, date')
    .gte('date', `${year}-01-01`)
    .lte('date', `${year}-12-31T23:59:59.999`);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const totals = new Array(12).fill(0);
  for (const row of data || []) {
    const month = new Date(row.date as string).getMonth();
    totals[month] += (row.amount as number) || 0;
  }
  return NextResponse.json(totals.map((total, i) => ({ month: i, total })));
}
