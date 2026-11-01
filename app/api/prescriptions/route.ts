import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { mapPrescription } from '@/lib/supabase/mappers';
import { validateBody } from '@/lib/validation';
import { prescriptionSaveSchema } from '@/lib/apiSchemas';

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('prescriptions').select('*').order('date', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data || []).map((r: Record<string, unknown>) => mapPrescription(r)));
}

// Standalone prescription create — mirrors PrescriptionPage.tsx's old
// handleSave insert branch (used for the blank/manual order-form flow, as
// opposed to /api/visits which creates a prescription as part of a full
// eye-test visit).
export async function POST(request: Request) {
  const validated = await validateBody(request, prescriptionSaveSchema);
  if ('error' in validated) return validated.error;
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('prescriptions').insert(validated.data).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(mapPrescription(data));
}
