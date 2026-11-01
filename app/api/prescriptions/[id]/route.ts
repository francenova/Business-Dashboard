import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { mapPrescription } from '@/lib/supabase/mappers';
import { validateBody } from '@/lib/validation';
import { prescriptionSaveSchema } from '@/lib/apiSchemas';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('prescriptions').select('*, patients (*), visits (*)').eq('id', id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(mapPrescription(data));
}

// Mirrors PrescriptionPage.tsx's old handleSave update branch (edits an
// existing standalone prescription's invoice number / date / payment).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const validated = await validateBody(request, prescriptionSaveSchema);
  if ('error' in validated) return validated.error;
  const supabase = createServiceClient();
  const { error } = await supabase.from('prescriptions').update(validated.data).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();
  const { error } = await supabase.from('prescriptions').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
