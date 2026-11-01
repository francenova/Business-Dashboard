import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// Mirrors hooks/useExpenses.ts's old fetchSupplierSummary — groups
// expenses.vendor (free text) for the active date range.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('expenses')
    .select('vendor, amount, paid_amount, date')
    .gte('date', dateFrom)
    .lte('date', `${dateTo}T23:59:59.999`)
    .not('vendor', 'is', null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const map = new Map<string, { vendor: string; totalAmount: number; totalPaid: number; outstanding: number; count: number; lastDate: string }>();
  for (const row of data || []) {
    const vendor = ((row.vendor as string) || '').trim();
    if (!vendor) continue;
    const key = vendor.toLowerCase();
    const amount = (row.amount as number) || 0;
    const paid = row.paid_amount === null || row.paid_amount === undefined ? amount : (row.paid_amount as number);
    const existing = map.get(key) || { vendor, totalAmount: 0, totalPaid: 0, outstanding: 0, count: 0, lastDate: row.date as string };
    existing.totalAmount += amount;
    existing.totalPaid += paid;
    existing.count += 1;
    if ((row.date as string) > existing.lastDate) existing.lastDate = row.date as string;
    map.set(key, existing);
  }
  const results = Array.from(map.values());
  for (const r of results) r.outstanding = r.totalAmount - r.totalPaid;
  results.sort((a, b) => b.totalAmount - a.totalAmount);

  return NextResponse.json(results);
}
