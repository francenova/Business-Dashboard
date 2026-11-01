import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { validateBody } from '@/lib/validation';
import { issueStockSchema } from '@/lib/apiSchemas';

// Mirrors AppContext.tsx's old issueMedicineStock — fuzzy-matches by id or
// name (same fallback order as before), deducts, logs the movement.
export async function POST(request: Request) {
  const validated = await validateBody(request, issueStockSchema);
  if ('error' in validated) return validated.error;
  const { idOrName, quantity } = validated.data;

  const supabase = createServiceClient();
  const { data: allMeds, error: fetchError } = await supabase.from('medicines').select('*');
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  const needle = String(idOrName).toLowerCase().trim();
  const matchingMed = (allMeds || []).find(
    (med: Record<string, unknown>) =>
      med.id === idOrName ||
      String(med.name).toLowerCase().trim() === needle ||
      String(med.name).toLowerCase().includes(needle)
  );

  if (!matchingMed) {
    return NextResponse.json({ error: `Medicine "${idOrName}" not found in inventory.` }, { status: 404 });
  }

  const currentStock = (matchingMed.available_stock as number) || 0;
  const newQty = Math.max(0, currentStock - quantity);

  const { error } = await supabase.from('medicines').update({ available_stock: newQty }).eq('id', matchingMed.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const actuallyDeducted = currentStock - newQty;
  await supabase.from('stock_movements').insert({
    item_id: matchingMed.id,
    item_name: matchingMed.name,
    category: matchingMed.category,
    movement_type: 'Stock Out',
    quantity: actuallyDeducted,
    reason: 'Manual Issue',
    date: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true, itemName: matchingMed.name, deducted: actuallyDeducted });
}
