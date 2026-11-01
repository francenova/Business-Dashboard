import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// Medicines is the only real product catalog in this app — Top Products is
// medicines-only; other categories are covered by category-breakdown.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('prescriptions')
    .select('medicines')
    .gte('date', dateFrom)
    .lte('date', `${dateTo}T23:59:59.999`)
    .neq('medicines', '[]');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const totals = new Map<string, { name: string; medicineId?: string; quantity: number; amount: number }>();
  for (const row of data || []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meds = (row.medicines as any[]) || [];
    for (const m of meds) {
      const key = m.medicineId || m.medicineName;
      if (!key) continue;
      const existing = totals.get(key) || { name: m.medicineName, medicineId: m.medicineId, quantity: 0, amount: 0 };
      existing.quantity += m.totalQty || 0;
      existing.amount += m.totalPrice || 0;
      totals.set(key, existing);
    }
  }

  const ranked = Array.from(totals.entries())
    .sort(([, a], [, b]) => b.amount - a.amount)
    .slice(0, 10);

  const medicineIds = ranked.map(([, v]) => v.medicineId).filter(Boolean) as string[];
  let categoryById = new Map<string, string>();
  if (medicineIds.length > 0) {
    const { data: catalog } = await supabase.from('medicines').select('id, category').in('id', medicineIds);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    categoryById = new Map((catalog || []).map((m: any) => [m.id, m.category]));
  }

  const result = ranked.map(([key, v]) => ({
    key,
    name: v.name,
    category: (v.medicineId && categoryById.get(v.medicineId)) || '-',
    quantity: v.quantity,
    amount: v.amount,
  }));

  return NextResponse.json(result);
}
