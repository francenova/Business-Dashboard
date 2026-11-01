import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const supabase = createServiceClient();

  const { count: totalPatients } = await supabase.from('patients').select('id', { count: 'exact', head: true });

  const { count: newPatients } = await supabase
    .from('patients')
    .select('id', { count: 'exact', head: true })
    .gte('created_date', dateFrom)
    .lte('created_date', `${dateTo}T23:59:59.999`);

  const [{ data: inPeriod }, { data: beforePeriod }] = await Promise.all([
    supabase.from('prescriptions').select('patient_id').gte('date', dateFrom).lte('date', `${dateTo}T23:59:59.999`),
    supabase.from('prescriptions').select('patient_id').lt('date', dateFrom),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beforeSet = new Set((beforePeriod || []).map((r: any) => r.patient_id));
  const returningSet = new Set(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (inPeriod || []).map((r: any) => r.patient_id).filter((id: string) => beforeSet.has(id))
  );

  return NextResponse.json({
    totalPatients: totalPatients || 0,
    newPatients: newPatients || 0,
    returningPatients: returningSet.size,
  });
}
