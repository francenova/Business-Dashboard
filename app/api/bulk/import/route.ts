import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { appToDbRow } from '@/lib/supabase/mappers';
import { validateBody } from '@/lib/validation';
import { bulkImportSchema } from '@/lib/apiSchemas';

// Mirrors AppContext.tsx's old importDataJSON's async upsert block —
// restores a clinic database snapshot (same shape exportDataJSON produces).
export async function POST(request: Request) {
  const validated = await validateBody(request, bulkImportSchema);
  if ('error' in validated) return validated.error;
  const parsed = validated.data as Record<string, any>;
  const supabase = createServiceClient();

  try {
    if (parsed.patients?.length) {
      for (const p of parsed.patients) {
        await supabase.from('patients').upsert(appToDbRow(p as Record<string, unknown>));
      }
    }
    if (parsed.medicines?.length) {
      for (const m of parsed.medicines) {
        await supabase.from('medicines').upsert(appToDbRow(m as Record<string, unknown>));
      }
    }
    if (parsed.visits?.length) {
      for (const v of parsed.visits) {
        await supabase.from('visits').upsert(appToDbRow(v as Record<string, unknown>));
      }
    }
    if (parsed.prescriptions?.length) {
      for (const rx of parsed.prescriptions) {
        await supabase.from('prescriptions').upsert(appToDbRow(rx as Record<string, unknown>));
      }
    }
    if (parsed.expenses?.length) {
      for (const e of parsed.expenses) {
        await supabase.from('expenses').upsert(appToDbRow(e as Record<string, unknown>));
      }
    }
    if (parsed.settings) {
      await supabase.from('clinic_settings').update(appToDbRow(parsed.settings as Record<string, unknown>)).eq('id', 1);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Some records failed to import.' }, { status: 500 });
  }
}
