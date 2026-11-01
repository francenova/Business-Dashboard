import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { appToDbRow } from '@/lib/supabase/mappers';
import { validateBody } from '@/lib/validation';
import { purchaseStockSchema } from '@/lib/apiSchemas';

// Mirrors AppContext.tsx's old purchaseStock (the Expense Management "+ Add
// Stock" flow) verbatim — upsert the medicine row, log the Stock In
// movement, and log the matching expense, all server-side in one request
// instead of the client calling medicines/stock_movements/expenses
// separately (the last of those previously went through the client-side
// addExpense() — folded in here since it's the same single insert).
export async function POST(request: Request) {
  const validated = await validateBody(request, purchaseStockSchema);
  if ('error' in validated) return validated.error;
  const data = validated.data;

  const supabase = createServiceClient();

  const { data: allMeds, error: fetchError } = await supabase.from('medicines').select('*');
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  const existing = (allMeds || []).find(
    (m: Record<string, unknown>) =>
      m.category === data.category &&
      String(m.name).toLowerCase().trim() === String(data.name).toLowerCase().trim() &&
      String(m.brand).toLowerCase().trim() === String(data.brand).toLowerCase().trim()
  );

  let itemId: string;
  let itemName: string;

  if (existing) {
    const newStock = (existing.available_stock as number) + data.quantity;
    const { error } = await supabase
      .from('medicines')
      .update({
        available_stock: newStock,
        purchase_price: data.purchasePrice,
        selling_price: data.sellingPrice,
        specification: data.specification || existing.specification || null,
        supplier: data.supplier || existing.supplier,
      })
      .eq('id', existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    itemId = existing.id as string;
    itemName = existing.name as string;
  } else {
    const row = appToDbRow({
      name: data.name,
      brand: data.brand,
      category: data.category,
      batchNumber: '',
      expiryDate: '',
      purchasePrice: data.purchasePrice,
      sellingPrice: data.sellingPrice,
      supplier: data.supplier || '',
      availableStock: data.quantity,
      minimumStock: data.defaultMinimumStock ?? 5,
      barcode: data.barcode || '',
      rackNumber: '',
      specification: data.specification,
    });
    const { data: inserted, error } = await supabase.from('medicines').insert(row).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    itemId = inserted.id;
    itemName = data.name;
  }

  await supabase.from('stock_movements').insert({
    item_id: itemId,
    item_name: itemName,
    category: data.category,
    movement_type: 'Stock In',
    quantity: data.quantity,
    reason: 'Purchase',
    reference: data.referenceNumber || null,
    notes: data.notes || null,
    date: data.date,
  });

  const discount = Math.min(data.discount || 0, data.purchasePrice * data.quantity);
  const finalAmount = data.purchasePrice * data.quantity - discount;
  const paidAmount = data.paidAmount === undefined ? finalAmount : Math.max(0, Math.min(data.paidAmount, finalAmount));

  const expenseRow = appToDbRow({
    category: data.category,
    description: `${data.category} Purchase — ${data.brand} ${data.name} x${data.quantity}`,
    amount: finalAmount,
    date: data.date,
    vendor: data.supplier,
    paymentMethod: 'Cash',
    referenceNumber: data.referenceNumber,
    notes: data.notes,
    paidAmount,
    productDetails: {
      productName: data.name,
      brand: data.brand,
      code: data.barcode,
      specification: data.specification,
      quantity: data.quantity,
      unitPurchasePrice: data.purchasePrice,
      unitSellingPrice: data.sellingPrice,
    },
  });
  delete expenseRow['id'];
  await supabase.from('expenses').insert(expenseRow);

  return NextResponse.json({ ok: true, itemId, itemName });
}
