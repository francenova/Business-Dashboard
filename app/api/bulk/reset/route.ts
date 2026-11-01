import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { appToDbRow } from '@/lib/supabase/mappers';
import { DEFAULT_CLINIC_SETTINGS } from '@/lib/defaultClinicSettings';

// Mirrors AppContext.tsx's old resetAllData — deletes every real data
// table (in FK-respecting order) and resets clinic_settings to defaults.
// invoice_number_counters is deliberately excluded (nothing in the app
// reads/writes it except next_invoice_number() itself).
export async function POST() {
  const supabase = createServiceClient();
  const tables = ['prescriptions', 'visits', 'activity_log', 'expenses', 'stock_movements', 'medicines', 'suppliers', 'patients'];

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) return NextResponse.json({ error: `Could not clear ${table}: ${error.message}` }, { status: 500 });
  }

  const row = appToDbRow(DEFAULT_CLINIC_SETTINGS as unknown as Record<string, unknown>);
  const { error: settingsError } = await supabase.from('clinic_settings').update(row).eq('id', 1);
  if (settingsError) return NextResponse.json({ error: `Could not reset settings: ${settingsError.message}` }, { status: 500 });

  return NextResponse.json({ ok: true });
}
