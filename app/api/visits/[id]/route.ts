import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { mapVisit, mapPatient, appToDbRow } from '@/lib/supabase/mappers';
import { validateBody } from '@/lib/validation';
import { updateVisitSchema } from '@/lib/apiSchemas';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('visits').select('*, patients (*)').eq('id', id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    visit: mapVisit(data),
    patient: data.patients ? mapPatient(data.patients) : null,
  });
}

// Mirrors AppContext.tsx's old updateVisit — strips denormalized patient
// fields (visits only stores patient_id), and also updates the linked
// prescription when billing/clinical fields changed, same as before.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const validated = await validateBody(request, updateVisitSchema);
  if ('error' in validated) return validated.error;
  const data = validated.data;
  const supabase = createServiceClient();

  const { patientName: _pn, patientAge: _pa, patientGender: _pg, patientPhone: _pp, patientAddress: _paddr, ...dataForDb } = data;
  const row = appToDbRow(dataForDb);

  const { error } = await supabase.from('visits').update(row).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (data.payment || data.medicines || data.visionTest || data.diagnosis || data.doctorNotes) {
    const rxRow = appToDbRow(dataForDb);
    await supabase.from('prescriptions').update(rxRow).eq('visit_id', id);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();
  const { error } = await supabase.from('visits').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
