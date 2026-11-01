import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { mapClinicSettings, appToDbRow } from '@/lib/supabase/mappers';
import { validateBody } from '@/lib/validation';
import { updateSettingsSchema } from '@/lib/apiSchemas';

// GET returns the mapped row, or null if it doesn't exist yet — the caller
// (AppContext's settingsQuery) already knows how to fall back to
// DEFAULT_CLINIC_SETTINGS, same as it did when reading straight from
// Supabase.
export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('clinic_settings').select('*').eq('id', 1).single();
  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows — not a real error, just means it hasn't been created yet.
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json(null);
  return NextResponse.json(mapClinicSettings(data as Record<string, unknown>));
}

// PATCH mirrors the exact update-then-insert-on-missing-row fallback that
// previously lived in AppContext.tsx's updateSettings.
export async function PATCH(request: Request) {
  const validated = await validateBody(request, updateSettingsSchema);
  if ('error' in validated) return validated.error;
  const supabase = createServiceClient();
  const row = appToDbRow(validated.data);

  const { error } = await supabase.from('clinic_settings').update(row).eq('id', 1);
  if (error) {
    if (error.code === 'PGRST116' || error.message.includes('No rows')) {
      const { error: insertError } = await supabase.from('clinic_settings').insert({ ...row, id: 1 });
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
