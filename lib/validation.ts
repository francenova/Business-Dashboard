import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';

// Shared by every mutating route — parses the JSON body and validates it
// against the given schema, returning either the parsed data or a ready-
// to-return 400 response. The device-token check in middleware.ts is the
// primary defense (nothing reaches a route handler at all without a valid,
// non-revoked device); this is a second layer so a buggy or compromised
// client still can't send malformed data into Supabase.
export async function validateBody<T>(request: Request, schema: ZodType<T>): Promise<{ data: T } | { error: NextResponse }> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return { error: NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }) };
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    return { error: NextResponse.json({ error: result.error.issues[0]?.message || 'Invalid request body.' }, { status: 400 }) };
  }
  return { data: result.data };
}
