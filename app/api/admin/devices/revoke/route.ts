import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { validateBody } from '@/lib/validation';
import { revokeDeviceSchema } from '@/lib/apiSchemas';

// Gated by middleware.ts's checkAdminSecret, same as app/api/admin/devices.
export async function POST(request: Request) {
  const validated = await validateBody(request, revokeDeviceSchema);
  if ('error' in validated) return validated.error;
  const { deviceId } = validated.data;

  const supabase = createServiceClient();
  const { error } = await supabase.from('device_credentials').update({ revoked: true }).eq('device_id', deviceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
