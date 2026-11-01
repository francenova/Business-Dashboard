import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const VISIT_STATUSES = ['Completed', 'Pending Delivery', 'Ready Order', 'In Progress'] as const;
type VisitStatus = (typeof VISIT_STATUSES)[number];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const supabase = createServiceClient();

  const { data, error } = await supabase.from('visits').select('date, status').gte('date', dateFrom).lte('date', `${dateTo}T23:59:59.999`);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data || [];
  const byStatus: Record<VisitStatus, number> = {
    Completed: 0,
    'Pending Delivery': 0,
    'Ready Order': 0,
    'In Progress': 0,
  };
  const byWeekdayCount = new Array(7).fill(0);

  for (const row of rows) {
    const status = row.status as VisitStatus;
    if (status && byStatus[status] !== undefined) byStatus[status] += 1;
    const weekday = new Date(row.date as string).getDay();
    byWeekdayCount[weekday] += 1;
  }

  return NextResponse.json({
    totalVisits: rows.length,
    byStatus,
    byWeekday: WEEKDAYS.map((day, i) => ({ day, count: byWeekdayCount[i] })),
  });
}
