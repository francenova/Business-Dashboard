import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { mapTaxRateConfig, appToDbRow } from '@/lib/supabase/mappers';
import { validateBody } from '@/lib/validation';
import { updateTaxRateConfigSchema } from '@/lib/apiSchemas';

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('tax_rate_config').select('*').order('category', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data || []).map((r: Record<string, unknown>) => mapTaxRateConfig(r)));
}

export async function PATCH(request: Request) {
  const validated = await validateBody(request, updateTaxRateConfigSchema);
  if ('error' in validated) return validated.error;
  const { category, data } = validated.data;

  const supabase = createServiceClient();
  const row = appToDbRow(data as Record<string, unknown>);
  const { error } = await supabase.from('tax_rate_config').update(row).eq('category', category);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
