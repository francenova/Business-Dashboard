import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiFetch';

export interface DashboardStats {
  todayVisits: number;
  todayEyeExamsCount: number;
  todayPatientsCount: number;
  todayPrescriptionsCount: number;
  todayRevenue: number;
  todayExpenses: number;
  todayProfit: number;
  todayMedicineSales: number;
  pendingPaymentsTotal: number;
  pendingDeliveriesCount: number;
  readyOrdersCount: number;
  monthGstCollected: number;
}

const POLL_INTERVAL_MS = 20000;

// Was a real-time Supabase subscription (postgres_changes on visits/
// expenses/prescriptions/patients) — that required the renderer to hold a
// Supabase client capable of opening its own realtime channel, which no
// longer exists now that all table access goes through /api/* routes (see
// the architecture discussion: moving data access server-side means the
// renderer no longer holds any Supabase credential at all). Replaced with
// plain polling — the dashboard still updates on its own, just within
// POLL_INTERVAL_MS instead of instantly. The global QueryClient's
// refetchOnWindowFocus also still fires a refresh whenever the window
// regains focus, which covers the most common "I just saved something,
// let me check the dashboard" case immediately.
export function useDashboardStats() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async (): Promise<DashboardStats> => apiFetch('/api/dashboard-stats'),
    refetchInterval: POLL_INTERVAL_MS,
  });

  return { stats: data, isLoading };
}
