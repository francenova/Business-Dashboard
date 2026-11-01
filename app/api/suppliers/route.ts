import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { mapSupplier } from '@/lib/supabase/mappers';
import { validateBody } from '@/lib/validation';
import { addSupplierSchema } from '@/lib/apiSchemas';

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('suppliers').select('*').eq('is_active', true).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data || []).map((r: Record<string, unknown>) => mapSupplier(r)));
}

// Mirrors AppContext.tsx's old addSupplier.
export async function POST(request: Request) {
  const validated = await validateBody(request, addSupplierSchema);
  if ('error' in validated) return validated.error;
  const data = validated.data;
  const supabase = createServiceClient();
  const { data: inserted, error } = await supabase
    .from('suppliers')
    .insert({
      name: data.name.trim(),
      phone: data.phone || null,
      address: data.address || null,
      gstin: data.gstin || null,
      state: data.state || null,
      state_code: data.stateCode || null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(mapSupplier(inserted));
}
