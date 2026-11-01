import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { mapExpense, appToDbRow } from '@/lib/supabase/mappers';
import { parseExpenseFilters, applyFilters } from '@/lib/expenseQueryHelpers';
import { validateBody } from '@/lib/validation';
import { addExpenseSchema } from '@/lib/apiSchemas';

const PAGE_SIZE = 50;

// ?all=true returns every matching row unpaginated — mirrors the old
// fetchAllExpenseRows (used by Print/PDF/Excel export). Otherwise ?page=N
// (0-based) mirrors the old useInfiniteQuery rowsQuery page shape.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters = parseExpenseFilters(searchParams);
  const supabase = createServiceClient();

  if (searchParams.get('all') === 'true') {
    let query = supabase.from('expenses').select('*');
    query = applyFilters(query, filters);
    query = query.order('date', { ascending: false }).order('id', { ascending: true });
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json((data || []).map((r: Record<string, unknown>) => mapExpense(r)));
  }

  const page = Number(searchParams.get('page') || '0');
  let query = supabase.from('expenses').select('*', { count: 'exact' });
  query = applyFilters(query, filters);
  query = query.order('date', { ascending: false }).order('id', { ascending: true }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    rows: (data || []).map((r: Record<string, unknown>) => mapExpense(r)),
    totalCount: count || 0,
    page,
  });
}

// Mirrors AppContext.tsx's old addExpense.
export async function POST(request: Request) {
  const validated = await validateBody(request, addExpenseSchema);
  if ('error' in validated) return validated.error;
  const supabase = createServiceClient();
  const row = appToDbRow(validated.data);
  delete row['id'];
  const { error } = await supabase.from('expenses').insert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
