import { DashboardShell } from '@/components/dashboard/DashboardShell';

export const metadata = {
  title: 'Dashboard — Royal Optical',
};

// No longer forced dynamic — nothing under this layout reads cookies/session
// server-side (auth is bypassed per middleware.ts; the only supabase.auth
// calls in the app are client-side, in SettingsPage/SalesRegisterPage).
// Forcing every route segment dynamic disabled Next.js's route-segment
// caching and Link/router prefetching, which was the main cause of slow
// section-to-section navigation — every click had to wait on a full fresh
// server round-trip instead of using a pre-warmed payload.

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
