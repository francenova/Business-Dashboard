import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { mapSupplier, mapExpense, mapMedicine } from '@/lib/supabase/mappers';

// Mirrors hooks/useSupplierDetails.ts — supplier contact card + every
// medicine sourced from them + every expense recorded under their name
// (matched by name, same as before — expenses.vendor / medicines.supplier
// are plain text, not a foreign key to suppliers.id).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: supplierRow, error: supplierErr } = await supabase.from('suppliers').select('*').eq('id', id).single();
  if (supplierErr) return NextResponse.json({ error: supplierErr.message }, { status: 500 });
  const supplier = mapSupplier(supplierRow);

  const [{ data: expenseRows, error: expenseErr }, { data: medicineRows, error: medicineErr }] = await Promise.all([
    supabase.from('expenses').select('*').ilike('vendor', supplier.name).order('date', { ascending: false }),
    supabase.from('medicines').select('*').ilike('supplier', supplier.name).order('name', { ascending: true }),
  ]);
  if (expenseErr) return NextResponse.json({ error: expenseErr.message }, { status: 500 });
  if (medicineErr) return NextResponse.json({ error: medicineErr.message }, { status: 500 });

  const transactions = (expenseRows || []).map((r: Record<string, unknown>) => mapExpense(r));
  const products = (medicineRows || []).map((r: Record<string, unknown>) => mapMedicine(r));

  const totalPurchased = transactions.reduce((s, t) => s + t.amount, 0);
  const totalPaid = transactions.reduce((s, t) => s + (t.paidAmount ?? t.amount), 0);
  const balance = totalPurchased - totalPaid;

  return NextResponse.json({
    supplier,
    products,
    transactions,
    paymentStatus: {
      totalPurchased,
      totalPaid,
      outstanding: Math.max(0, balance),
      advance: Math.max(0, -balance),
    },
  });
}

// Mirrors AppContext.tsx's old deleteSupplier — soft delete (is_active =
// false), not a real row delete, so every expense/medicine that already
// stored this supplier's name stays exactly as it was.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();
  const { error } = await supabase.from('suppliers').update({ is_active: false }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
