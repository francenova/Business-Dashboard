import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

function pickGranularity(dateFrom: string, dateTo: string): 'day' | 'month' {
  const days = (new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000;
  return days <= 31 ? 'day' : 'month';
}
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}
function dayLabel(d: string): string {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const supabase = createServiceClient();

  const { data, error } = await supabase.from('prescriptions').select('date, payment').gte('date', dateFrom).lte('date', `${dateTo}T23:59:59.999`);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const granularity = pickGranularity(dateFrom, dateTo);
  const buckets = new Map<string, { sales: number; collection: number; tax: number; invoiceCount: number }>();

  for (const row of data || []) {
    const dateStr = String(row.date).split('T')[0];
    const key = granularity === 'day' ? dateStr : dateStr.slice(0, 7);
    const bucket = buckets.get(key) || { sales: 0, collection: 0, tax: 0, invoiceCount: 0 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (row.payment as Record<string, any>) || {};
    bucket.sales += p.grandTotal || 0;
    bucket.collection += p.advance || 0;
    bucket.tax += p.totalTax || 0;
    bucket.invoiceCount += 1;
    buckets.set(key, bucket);
  }

  const trend = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({
      key,
      label: granularity === 'day' ? dayLabel(key) : monthLabel(key),
      sales: v.sales,
      collection: v.collection,
      tax: v.tax,
      invoiceCount: v.invoiceCount,
    }));

  return NextResponse.json(trend);
}
