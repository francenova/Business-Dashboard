import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { appToDbRow } from '@/lib/supabase/mappers';
import { validateBody } from '@/lib/validation';
import { updateMedicineSchema } from '@/lib/apiSchemas';

// Mirrors AppContext.tsx's old updateMedicine — update, then log a stock
// movement if availableStock actually changed (manual adjustment).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const validated = await validateBody(request, updateMedicineSchema);
  if ('error' in validated) return validated.error;
  const data = validated.data;
  const supabase = createServiceClient();

  const { data: existing } = await supabase.from('medicines').select('*').eq('id', id).single();

  const row = appToDbRow(data);
  const { error } = await supabase.from('medicines').update(row).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (existing && typeof data.availableStock === 'number' && data.availableStock !== existing.available_stock) {
    const delta = data.availableStock - existing.available_stock;
    await supabase.from('stock_movements').insert({
      item_id: id,
      item_name: existing.name,
      category: data.category || existing.category,
      movement_type: delta > 0 ? 'Stock In' : 'Stock Out',
      quantity: Math.abs(delta),
      reason: 'Manual Adjustment',
      date: new Date().toISOString(),
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();
  const { error } = await supabase.from('medicines').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
