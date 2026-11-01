import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { generateToken, hashToken } from '@/lib/deviceAuth';
import { validateBody } from '@/lib/validation';
import { createEnrollmentSchema } from '@/lib/apiSchemas';

// Both routes here are gated by middleware.ts's checkAdminSecret — reached
// only with a valid X-Admin-Secret header, which only you (the developer)
// ever hold. Never shipped in the Electron app or any client-facing code.

// GET: list every enrolled/pending device — for you to see what's
// registered, when it last checked in, and its status.
export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('device_credentials')
    .select('device_id, label, revoked, created_at, last_seen_at, token_hash, enrollment_expires_at')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const devices = (data || []).map((d) => ({
    deviceId: d.device_id,
    label: d.label,
    revoked: d.revoked,
    createdAt: d.created_at,
    lastSeenAt: d.last_seen_at,
    status: d.revoked ? 'revoked' : d.token_hash ? 'active' : 'pending-enrollment',
  }));
  return NextResponse.json(devices);
}

// POST: create a new one-time enrollment token for a new device (PC).
// Expires in 24 hours and can only ever be exchanged once — see
// app/api/device/enroll/route.ts.
export async function POST(request: Request) {
  const validated = await validateBody(request, createEnrollmentSchema);
  if ('error' in validated) return validated.error;
  const { label } = validated.data;

  const enrollmentToken = generateToken();
  const enrollmentHash = await hashToken(enrollmentToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('device_credentials')
    .insert({ label: label || null, enrollment_token_hash: enrollmentHash, enrollment_expires_at: expiresAt })
    .select('device_id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ enrollmentToken, deviceId: data.device_id, expiresAt });
}
