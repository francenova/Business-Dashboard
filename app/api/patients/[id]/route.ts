import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { mapPatient, mapVisit, mapPrescription, appToDbRow } from '@/lib/supabase/mappers';
import { validateBody } from '@/lib/validation';
import { updatePatientSchema } from '@/lib/apiSchemas';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('patients')
    .select('*, visits (*), prescriptions (*)')
    .eq('id', id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    patient: mapPatient(data),
    visits: (data.visits || []).map((v: Record<string, unknown>) => mapVisit({ ...v, patients: data })),
    prescriptions: (data.prescriptions || []).map((p: Record<string, unknown>) =>
      mapPrescription({ ...p, patients: data, visits: data.visits?.find((v: Record<string, unknown>) => v.id === p.visit_id) })
    ),
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const validated = await validateBody(request, updatePatientSchema);
  if ('error' in validated) return validated.error;
  const supabase = createServiceClient();
  const row = appToDbRow(validated.data);
  const { error } = await supabase.from('patients').update(row).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Mirrors AppContext.tsx's old deletePatient — cascades through
// activity_log / prescriptions / visits before removing the patient row
// itself (same order as before, since these tables have no DB-level
// cascading delete configured).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();

  await supabase.from('activity_log').delete().eq('patient_id', id);
  await supabase.from('prescriptions').delete().eq('patient_id', id);
  await supabase.from('visits').delete().eq('patient_id', id);
  const { error } = await supabase.from('patients').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
