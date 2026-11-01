import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { mapVisit, appToDbRow } from '@/lib/supabase/mappers';
import type { Visit } from '@/lib/types';
import { validateBody } from '@/lib/validation';
import { createVisitSchema } from '@/lib/apiSchemas';

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('visits').select('*').order('date', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data || []).map((r: Record<string, unknown>) => mapVisit(r)));
}

// Relocated verbatim from hooks/useCreateVisitAndPrescription.ts — insert
// visit, insert prescription, deduct stock across every pick type (plain
// medicines / reading glass / solution / frame / lens / contact lens),
// update the patient's last-visit/outstanding fields, log activity. One
// route instead of 6+ separate client-side round trips, running
// server-side with the service_role key instead of the renderer's old
// direct Supabase calls.
export async function POST(request: Request) {
  const validated = await validateBody(request, createVisitSchema);
  if ('error' in validated) return validated.error;
  const visitData = validated.data.visitData as unknown as Omit<Visit, 'id' | 'displayId'>;
  const supabase = createServiceClient();

  const { patientName, patientAge, patientGender, patientPhone, patientAddress, ...visitDataForDb } = visitData as Record<string, unknown>;
  const visitRow = appToDbRow(visitDataForDb);

  const { data: insertedVisit, error: visitError } = await supabase.from('visits').insert(visitRow).select().single();
  if (visitError) return NextResponse.json({ error: `Visit Error: ${visitError.message}` }, { status: 500 });

  const realVisitId = insertedVisit.id;

  const rxRow = appToDbRow({
    visitId: realVisitId,
    patientId: visitData.patientId,
    date: visitData.date,
    visionTest: visitData.visionTest,
    diagnosis: visitData.diagnosis,
    medicines: visitData.medicines,
    contactLens: visitData.contactLens,
    frame: visitData.frame,
    readingGlass: visitData.readingGlass,
    lens: visitData.lens,
    solution: visitData.solution,
    doctorNotes: visitData.doctorNotes,
    payment: visitData.payment,
    printedCount: 0,
  });

  const { data: insertedRx, error: rxError } = await supabase.from('prescriptions').insert(rxRow).select().single();
  if (rxError) return NextResponse.json({ error: `Prescription Error: ${rxError.message}` }, { status: 500 });

  // Current stock snapshot, queried fresh server-side rather than trusting
  // whatever the client had cached — same deduction logic as before, just a
  // more correct source for "current available stock" to deduct from.
  const { data: medicinesData } = await supabase.from('medicines').select('*');
  const medicines = (medicinesData || []).map((m: Record<string, unknown>) => ({
    id: m.id as string,
    name: m.name as string,
    category: m.category as string,
    availableStock: (m.available_stock as number) || 0,
  }));

  const deduct = async (medicineId: string | undefined, qty: number) => {
    if (!medicineId || qty <= 0) return;
    const matchingMed = medicines.find((med) => med.id === medicineId);
    if (!matchingMed) return;
    const newQty = Math.max(0, matchingMed.availableStock - qty);
    await supabase.from('medicines').update({ available_stock: newQty }).eq('id', matchingMed.id);
    const actuallyDeducted = matchingMed.availableStock - newQty;
    matchingMed.availableStock = newQty; // keep the local snapshot consistent if the same item is deducted twice in one visit
    if (actuallyDeducted > 0) {
      await supabase.from('stock_movements').insert({
        item_id: matchingMed.id,
        item_name: matchingMed.name,
        category: matchingMed.category,
        movement_type: 'Stock Out',
        quantity: actuallyDeducted,
        reason: 'Sale',
        reference: insertedRx.display_id || insertedRx.id,
        date: visitData.date,
      });
    }
  };

  // Plain prescribed medicines — matched by id first, then a fuzzy name
  // match, same fallback the original client-side code used.
  for (const prescribed of visitData.medicines || []) {
    if (prescribed.totalQty > 0) {
      const matchingMed = medicines.find(
        (med) =>
          (prescribed.medicineId && prescribed.medicineId === med.id) ||
          (prescribed.medicineName &&
            (prescribed.medicineName.toLowerCase().trim() === med.name.toLowerCase().trim() ||
              med.name.toLowerCase().trim().includes(prescribed.medicineName.toLowerCase().trim()) ||
              prescribed.medicineName.toLowerCase().trim().includes(med.name.toLowerCase().trim())))
      );
      if (matchingMed) await deduct(matchingMed.id, prescribed.totalQty);
    }
  }

  await deduct(visitData.readingGlass?.medicineId, visitData.readingGlass?.quantity || 0);
  await deduct(visitData.solution?.medicineId, visitData.solution?.quantity || 0);
  await deduct(visitData.frame?.medicineId, visitData.frame?.medicineId ? 1 : 0);
  await deduct(visitData.lens?.medicineId, visitData.lens?.medicineId ? 1 : 0);
  await deduct(visitData.contactLens?.medicineId, visitData.contactLens?.quantity || 0);

  await supabase
    .from('patients')
    .update({ last_visit_date: visitData.date, outstanding_amount: visitData.payment.balance })
    .eq('id', visitData.patientId);

  const activityRow = appToDbRow({
    timestamp: new Date().toISOString(),
    type: 'visit',
    title: 'Eye Test & Prescription Created',
    description: `Visit ${insertedVisit.display_id || realVisitId} & Rx ${insertedRx.display_id || insertedRx.id} created for ${visitData.patientName}. Total: ₹${visitData.payment.grandTotal}`,
    patientName: visitData.patientName,
    amount: visitData.payment.grandTotal,
  });
  await supabase.from('activity_log').insert(activityRow);

  return NextResponse.json({ insertedVisit, insertedRx });
}
