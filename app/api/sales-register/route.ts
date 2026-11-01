import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { mapPrescription } from '@/lib/supabase/mappers';
import { parseSalesRegisterFilters, applyFilters, applySort, resolvePatientIds, accumulateSummary, cloneEmptySummary, type SalesSummary } from '@/lib/salesRegisterQueryHelpers';

const PAGE_SIZE = 50;

// ?summary=true → aggregated totals only (mirrors summaryQuery /
// fetchSalesSummary). ?all=true → every matching row, unpaginated (mirrors
// fetchAllSalesRows, used by Print/PDF export). Otherwise ?page=N → the
// paginated table (mirrors the old useInfiniteQuery rowsQuery).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters = parseSalesRegisterFilters(searchParams);
  const supabase = createServiceClient();
  const patientIds = await resolvePatientIds(supabase, filters.search.trim());

  if (searchParams.get('summary') === 'true') {
    let query = supabase.from('prescriptions').select('payment');
    query = applyFilters(query, filters, patientIds);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const summary: SalesSummary = (data || []).reduce((acc, row) => accumulateSummary(acc, row), cloneEmptySummary());
    return NextResponse.json(summary);
  }

  if (searchParams.get('all') === 'true') {
    let query = supabase.from('prescriptions').select('*, patients (*)');
    query = applyFilters(query, filters, patientIds);
    query = query.order('date', { ascending: false }).order('id', { ascending: true });
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json((data || []).map((r: Record<string, unknown>) => mapPrescription(r)));
  }

  const page = Number(searchParams.get('page') || '0');
  let query = supabase.from('prescriptions').select('*, patients (*)', { count: 'exact' });
  query = applyFilters(query, filters, patientIds);
  query = applySort(query, filters).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    rows: (data || []).map((r: Record<string, unknown>) => mapPrescription(r)),
    totalCount: count || 0,
    page,
  });
}
