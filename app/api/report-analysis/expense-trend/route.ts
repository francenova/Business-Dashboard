import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

function pickGranularity(dateFrom: string, dateTo: string): 'day' | 'month' {
  const days = (new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000;
  return days <= 31 ? 'day' : 'month';
}

// Same bucketing as sales-trend, scoped to expenses instead — combined with
// it (joined by key) in the Report Table.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const supabase = createServiceClient();

  const { data, error } = await supabase.from('expenses').select('date, amount').gte('date', dateFrom).lte('date', `${dateTo}T23:59:59.999`);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const granularity = pickGranularity(dateFrom, dateTo);
  const buckets = new Map<string, number>();
  for (const row of data || []) {
    const dateStr = String(row.date).split('T')[0];
    const key = granularity === 'day' ? dateStr : dateStr.slice(0, 7);
    buckets.set(key, (buckets.get(key) || 0) + ((row.amount as number) || 0));
  }

  return NextResponse.json(Array.from(buckets.entries()).map(([key, amount]) => ({ key, amount })));
}
