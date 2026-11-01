import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { mapActivityLog, appToDbRow } from '@/lib/supabase/mappers';
import { validateBody } from '@/lib/validation';
import { addActivityLogSchema } from '@/lib/apiSchemas';

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('activity_log').select('*').order('timestamp', { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data || []).map((r: Record<string, unknown>) => mapActivityLog(r)));
}

// Mirrors AppContext.tsx's old logActivity helper — shared by every entity
// that logs an activity entry (patients, medicines, etc).
export async function POST(request: Request) {
  const validated = await validateBody(request, addActivityLogSchema);
  if ('error' in validated) return validated.error;
  const supabase = createServiceClient();
  const row = appToDbRow(validated.data);
  const { error } = await supabase.from('activity_log').insert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
