import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { appToDbRow } from '@/lib/supabase/mappers';
import { validateBody } from '@/lib/validation';
import { updateExpenseSchema } from '@/lib/apiSchemas';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const validated = await validateBody(request, updateExpenseSchema);
  if ('error' in validated) return validated.error;
  const supabase = createServiceClient();
  const row = appToDbRow(validated.data);
  const { error } = await supabase.from('expenses').update(row).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
