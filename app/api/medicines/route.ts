import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { mapMedicine, appToDbRow } from '@/lib/supabase/mappers';
import { validateBody } from '@/lib/validation';
import { addMedicineSchema } from '@/lib/apiSchemas';

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('medicines').select('*').order('name', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data || []).map((r: Record<string, unknown>) => mapMedicine(r)));
}

// Mirrors AppContext.tsx's old addMedicine — insert, log activity, and (if
// an initial stock quantity was given) log the Stock In movement too.
export async function POST(request: Request) {
  const validated = await validateBody(request, addMedicineSchema);
  if ('error' in validated) return validated.error;
  const medData = validated.data;
  const supabase = createServiceClient();

  const row = appToDbRow(medData);
  delete row['id'];
  const { data: inserted, error } = await supabase.from('medicines').insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('activity_log').insert(
    appToDbRow({
      timestamp: new Date().toISOString(),
      type: 'inventory',
      title: 'New Medicine Added',
      description: `Added ${medData.name} (${medData.availableStock} in stock)`,
    })
  );

  if (medData.availableStock > 0) {
    await supabase.from('stock_movements').insert({
      item_id: inserted.id,
      item_name: medData.name,
      category: medData.category,
      movement_type: 'Stock In',
      quantity: medData.availableStock,
      reason: 'Initial Stock',
      date: new Date().toISOString(),
    });
  }

  return NextResponse.json(mapMedicine(inserted));
}
