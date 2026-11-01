import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { mapStockMovement } from '@/lib/supabase/mappers';

// Optional ?dateFrom=&dateTo= (YYYY-MM-DD) — used by useInventoryReports.ts.
// With neither param, returns every movement with a real item_id — used by
// useInventoryTracking.ts's all-time per-item stats.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const supabase = createServiceClient();

  let query = supabase.from('stock_movements').select('*');
  if (dateFrom && dateTo) {
    query = query.gte('date', dateFrom).lte('date', `${dateTo}T23:59:59.999`).order('date', { ascending: false }).order('id', { ascending: true });
  } else {
    query = query.not('item_id', 'is', null);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data || []).map((r: Record<string, unknown>) => mapStockMovement(r)));
}
