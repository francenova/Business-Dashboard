import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('prescriptions')
    .select('frame, lens, reading_glass, solution, contact_lens, medicines, payment')
    .gte('date', dateFrom)
    .lte('date', `${dateTo}T23:59:59.999`);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data || [];
  const totals: Record<string, { amount: number; quantity: number }> = {
    Frame: { amount: 0, quantity: 0 },
    Lens: { amount: 0, quantity: 0 },
    'Reading Glass': { amount: 0, quantity: 0 },
    Solution: { amount: 0, quantity: 0 },
    'Contact Lens': { amount: 0, quantity: 0 },
    Medicines: { amount: 0, quantity: 0 },
    Consultation: { amount: 0, quantity: 0 },
  };

  for (const row of rows) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (row.payment as Record<string, any>) || {};
    if (row.frame) {
      totals.Frame.amount += p.frameTotal || 0;
      totals.Frame.quantity += 1;
    }
    if (row.lens) {
      totals.Lens.amount += p.lensTotal || 0;
      totals.Lens.quantity += 1;
    }
    if (row.reading_glass) {
      totals['Reading Glass'].amount += p.readingGlassTotal || 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      totals['Reading Glass'].quantity += (row.reading_glass as any).quantity || 1;
    }
    if (row.solution) {
      totals.Solution.amount += p.solutionTotal || 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      totals.Solution.quantity += (row.solution as any).quantity || 1;
    }
    if (row.contact_lens) {
      totals['Contact Lens'].amount += p.contactLensTotal || 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      totals['Contact Lens'].quantity += (row.contact_lens as any).quantity || 1;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meds = (row.medicines as any[]) || [];
    if (meds.length > 0) {
      totals.Medicines.amount += p.medicineTotal || 0;
      totals.Medicines.quantity += meds.reduce((s, m) => s + (m.totalQty || 0), 0);
    }
    if ((p.consultationFee || 0) > 0) {
      totals.Consultation.amount += p.consultationFee || 0;
      totals.Consultation.quantity += 1;
    }
  }

  const breakdown = Object.entries(totals)
    .filter(([, v]) => v.amount > 0 || v.quantity > 0)
    .map(([category, v]) => ({ category, amount: v.amount, quantity: v.quantity }))
    .sort((a, b) => b.amount - a.amount);

  return NextResponse.json(breakdown);
}
