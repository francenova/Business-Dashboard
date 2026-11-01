import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// Calls the same next_invoice_number() Postgres function the renderer used
// to call directly via supabase.rpc(). Moving it server-side lets us
// revoke the function's anon/authenticated execute grants later (see
// supabase/schema.sql) without breaking invoice numbering.
export async function POST() {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('next_invoice_number');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoiceNumber: data });
}
