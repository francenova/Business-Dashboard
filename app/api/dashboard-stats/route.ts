import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasVisionTestData(vt: any): boolean {
  if (!vt) return false;
  const re = vt.rightEye || {};
  const le = vt.leftEye || {};
  const fields = [re.sph, re.cyl, re.axis, re.add, re.va, le.sph, le.cyl, le.axis, le.add, le.va, vt.iopRight, vt.iopLeft];
  return fields.some((f) => typeof f === 'string' && f.trim() !== '');
}

// Mirrors hooks/useDashboardStats.ts's old queryFn verbatim.
export async function GET() {
  const supabase = createServiceClient();
  const todayStr = new Date().toISOString().split('T')[0];

  const { data: visits } = await supabase.from('visits').select('*, payment').eq('date', todayStr);
  const { count: prescriptionsCount } = await supabase.from('prescriptions').select('id', { count: 'exact', head: true }).eq('date', todayStr);
  const { data: expenses } = await supabase.from('expenses').select('amount').eq('date', todayStr);
  const { data: pendingDeliveries } = await supabase.from('visits').select('id').eq('status', 'Pending Delivery');
  const { data: readyOrders } = await supabase.from('visits').select('id').eq('status', 'Ready Order');
  const { data: allVisitsPayments } = await supabase.from('visits').select('payment');

  const monthStart = `${todayStr.slice(0, 7)}-01`;
  const { data: monthVisitsPayments } = await supabase
    .from('visits')
    .select('payment')
    .gte('date', monthStart)
    .lte('date', `${todayStr}T23:59:59.999`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const monthGstCollected = (monthVisitsPayments || []).reduce((acc, v: any) => acc + (v.payment?.totalTax || 0), 0);

  const todayVisits = visits || [];
  const todayExpensesData = expenses || [];
  const allPayments = allVisitsPayments || [];

  const todayRevenue = todayVisits.reduce((acc, v) => acc + (v.payment?.grandTotal || 0), 0);
  const todayExpenses = todayExpensesData.reduce((acc, e) => acc + e.amount, 0);
  const todayProfit = Math.max(0, todayRevenue - todayExpenses);
  const todayMedicineSales = todayVisits.reduce((acc, v) => acc + (v.payment?.medicineTotal || 0), 0);
  const totalAcrossAllVisits = allPayments.reduce((acc, v) => acc + (v.payment?.grandTotal || 0), 0);
  const advanceAcrossAllVisits = allPayments.reduce((acc, v) => acc + (v.payment?.advance || 0), 0);
  const pendingPaymentsTotal = Math.max(0, totalAcrossAllVisits - advanceAcrossAllVisits);

  const todayPatientsCount = new Set(todayVisits.map((v) => v.patient_id)).size;
  const todayEyeExamsCount = todayVisits.filter((v) => hasVisionTestData(v.vision_test)).length;

  return NextResponse.json({
    todayVisits: todayVisits.length,
    todayEyeExamsCount,
    todayPatientsCount,
    todayPrescriptionsCount: prescriptionsCount || 0,
    todayRevenue,
    todayExpenses,
    todayProfit,
    todayMedicineSales,
    pendingPaymentsTotal,
    pendingDeliveriesCount: pendingDeliveries?.length || 0,
    readyOrdersCount: readyOrders?.length || 0,
    monthGstCollected,
  });
}
