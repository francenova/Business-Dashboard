import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// All-time, not period-scoped — matches the Ledger module's own definition
// of "Total Pending" (a customer's real current balance).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get('limit') || '10');
  const supabase = createServiceClient();

  const { data, error } = await supabase.from('prescriptions').select('patient_id, payment, patients (name)');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const totals = new Map<string, { name: string; pending: number }>();
  for (const row of data || []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (row.payment as Record<string, any>) || {};
    const pending = (p.grandTotal || 0) - (p.advance || 0);
    if (pending <= 0) continue;
    const existing = totals.get(row.patient_id as string) || {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: (row as any).patients?.name || 'Unknown',
      pending: 0,
    };
    existing.pending += pending;
    totals.set(row.patient_id as string, existing);
  }

  const result = Array.from(totals.entries())
    .map(([patientId, v]) => ({ patientId, patientName: v.name, pending: v.pending }))
    .sort((a, b) => b.pending - a.pending)
    .slice(0, limit);

  return NextResponse.json(result);
}
