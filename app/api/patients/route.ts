import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { mapPatient, appToDbRow } from '@/lib/supabase/mappers';
import { validateBody } from '@/lib/validation';
import { addPatientSchema } from '@/lib/apiSchemas';

// ?search=term switches to the same name/phone/display_id ilike search
// hooks/useCustomerLedger.ts's useCustomerSearch used to run directly
// against Supabase (used by the Ledger's customer picker).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const supabase = createServiceClient();

  let query = supabase.from('patients').select('*');
  if (search && search.trim()) {
    const term = search.trim();
    query = query
      .or(`name.ilike.%${term}%,phone.ilike.%${term}%,display_id.ilike.%${term}%`)
      .order('name', { ascending: true })
      .limit(20);
  } else {
    query = query.order('created_date', { ascending: false });
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data || []).map((r: Record<string, unknown>) => mapPatient(r)));
}

// Mirrors AppContext.tsx's old addPatient — insert, then log activity.
export async function POST(request: Request) {
  const validated = await validateBody(request, addPatientSchema);
  if ('error' in validated) return validated.error;
  const patientData = validated.data;
  const supabase = createServiceClient();

  const row = appToDbRow({
    name: patientData.name,
    age: patientData.age,
    gender: patientData.gender,
    phone: patientData.phone,
    email: patientData.email || null,
    address: patientData.address,
    notes: patientData.notes || null,
    createdDate: new Date().toISOString(),
    outstandingAmount: 0,
  });

  const { data: inserted, error } = await supabase.from('patients').insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const activityRow = appToDbRow({
    timestamp: new Date().toISOString(),
    type: 'patient',
    title: 'New Patient Registered',
    description: `Registered ${patientData.name} (${patientData.phone})`,
    patientName: patientData.name,
    amount: 0,
  });
  await supabase.from('activity_log').insert(activityRow);

  return NextResponse.json(mapPatient(inserted));
}
