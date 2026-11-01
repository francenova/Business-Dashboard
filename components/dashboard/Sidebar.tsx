'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { NavigationPage } from '@/lib/types';
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  FileText,
  Pill,
  BarChart3,
  Settings as SettingsIcon,
  Sparkles,
  ChevronRight,
  AlertCircle,
  Eye,
  Receipt,
  Wallet,
  BookOpen,
  Boxes,
  Percent,
} from 'lucide-react';

interface NavItem {
  id: NavigationPage;
  label: string;
  icon: React.ElementType;
  badge?: number | string;
  badgeColor?: string;
}

// Pages with their own URL (as opposed to dashboard/patients/inventory/
// settings, which all share '/' and switch purely via activePage SPA
// state) — matched from the real pathname so the highlight tracks
// navigation that happens from inside a page (e.g. a button on Patient
// Visit routing straight to /prescription/...), not just Sidebar clicks.
function navIdForPathname(pathname: string): NavigationPage | null {
  if (pathname.startsWith('/expenses')) return 'expense-report';
  if (pathname.startsWith('/gst')) return 'gst-report';
  if (pathname.startsWith('/inventory-reports')) return 'inventory-reports';
  if (pathname.startsWith('/ledger')) return 'ledger';
  if (pathname.startsWith('/patients/')) return 'patients';
  if (pathname.startsWith('/prescription/')) return 'prescription';
  if (pathname.startsWith('/prescriptions')) return 'prescription-management';
  if (pathname.startsWith('/reports')) return 'reports';
  if (pathname.startsWith('/sales')) return 'sales-register';
  if (pathname.startsWith('/suppliers/')) return 'expense-report';
  if (pathname.startsWith('/visit/')) return 'patient-visit';
  return null;
}

// The single source of truth for each nav item's target URL — used both to
// navigate on click and to prefetch every route up front, so the RSC
// payload + code chunk are already warm by the time the user clicks
// (Sidebar buttons aren't <Link>, so Next.js's automatic viewport
// prefetching never applied to the one nav surface visible on every page).
function pathForNavId(id: NavigationPage): string {
  switch (id) {
    case 'patient-visit':
      return '/visit/new';
    case 'prescription':
      return '/prescription/blank';
    case 'sales-register':
      return '/sales';
    case 'expense-report':
      return '/expenses';
    case 'ledger':
      return '/ledger';
    case 'gst-report':
      return '/gst';
    case 'reports':
      return '/reports';
    case 'inventory-reports':
      return '/inventory-reports';
    case 'prescription-management':
      return '/prescriptions';
    default:
      return '/';
  }
}

export const Sidebar: React.FC = () => {
  const { activePage, navigateTo, medicines, visits, settings } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const routeNavId = navIdForPathname(pathname);

  // Pre-warm every Sidebar destination shortly after first paint — Next.js
  // normally does this automatically for <Link> components scrolled into
  // view, but the Sidebar navigates via onClick + router.push(), which
  // opts out of that. Without this, every section switch paid for a full
  // cold fetch/compile of the destination route on click.
  useEffect(() => {
    const paths = new Set([
      '/', '/visit/new', '/prescription/blank', '/sales', '/expenses',
      '/ledger', '/gst', '/reports', '/inventory-reports', '/prescriptions',
    ]);
    paths.forEach((p) => router.prefetch(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Count low stock items for badge — hidden entirely when the Inventory
  // Settings toggle is off, per Settings > Inventory.
  const lowStockCount = settings.lowStockAlertsEnabled
    ? medicines.filter((m) => m.availableStock <= m.minimumStock).length
    : 0;

  // Count ready orders / pending visits
  const pendingVisitsCount = visits.filter(
    (v) => v.status === 'Pending Delivery' || v.status === 'Ready Order'
  ).length;

  const navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'patients',
      label: 'Patients',
      icon: Users,
    },
    {
      id: 'patient-visit',
      label: 'Patient Visit',
      icon: Stethoscope,
      badge: pendingVisitsCount > 0 ? pendingVisitsCount : undefined,
      badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300',
    },
    {
      id: 'prescription',
      label: 'Prescription',
      icon: FileText,
    },
    {
      id: 'inventory',
      label: 'Medicine Inventory',
      icon: Pill,
      badge: lowStockCount > 0 ? lowStockCount : undefined,
      badgeColor: 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300',
    },
    {
      id: 'inventory-reports',
      label: 'Inventory Reports',
      icon: Boxes,
    },
    {
      id: 'prescription-management',
      label: 'Prescription Management',
      icon: FileText,
    },
    {
      id: 'sales-register',
      label: 'Sales Register',
      icon: Receipt,
    },
    {
      id: 'expense-report',
      label: 'Expense Management',
      icon: Wallet,
    },
    {
      id: 'ledger',
      label: 'Customer Ledger',
      icon: BookOpen,
    },
    {
      id: 'gst-report',
      label: 'GST / Tax Report',
      icon: Percent,
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: BarChart3,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: SettingsIcon,
    },
  ];

  return (
    <aside
      id="main-app-sidebar"
      className="w-64 shrink-0 hidden md:flex flex-col bg-slate-50/80 dark:bg-slate-900/40 backdrop-blur-xl border-r border-slate-200/80 dark:border-slate-800/80 h-[calc(100vh-4rem)] sticky top-16 p-4 select-none transition-colors"
    >
      {/* Navigation List */}
      <nav className="flex-1 min-h-0 overflow-y-auto space-y-1">
        <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Main Menu
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = routeNavId ? routeNavId === item.id : activePage === item.id;

          return (
            <button
              key={item.id}
              id={`sidebar-nav-${item.id}`}
              onClick={() => {
                navigateTo(item.id);
                router.push(pathForNavId(item.id));
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                    isActive
                      ? 'text-white'
                      : 'text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </div>

              {item.badge !== undefined && (
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : item.badgeColor || 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Low Stock Warning Card if any */}
      {lowStockCount > 0 && (
        <div
          onClick={() => navigateTo('inventory')}
          className="mb-3 p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 rounded-xl cursor-pointer hover:border-amber-400 transition-colors"
        >
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-xs">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Low Stock Warning</span>
          </div>
          <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
            {lowStockCount} medicine{lowStockCount > 1 ? 's' : ''} running below reorder threshold.
          </p>
        </div>
      )}

      {/* Bottom Clinic Info Card */}
      <div className="p-3.5 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0"></div>
            <span
              className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate"
              title={settings.clinicName || 'VisionCare Eye Clinic'}
            >
              {settings.clinicName || 'VisionCare Eye Clinic'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono shrink-0">v2.4</span>
        </div>
        <p
          className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate"
          title={settings.address || 'Sector 21, Noida'}
        >
          {settings.address || 'Sector 21, Noida'}
        </p>
        <div className="mt-2 text-[10px] text-indigo-600 dark:text-indigo-400 font-medium truncate">
          Ph: {settings.phone || '+91 98110 22345'}
        </div>
      </div>
    </aside>
  );
};
