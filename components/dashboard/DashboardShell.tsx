'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider, useApp } from '@/context/AppContext';
import { Header } from '@/components/dashboard/Header';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { GlobalSearchModal } from '@/components/dashboard/GlobalSearchModal';
import { ToastContainer } from '@/components/dashboard/ToastContainer';
import { useEnterToNext } from '@/hooks/useEnterToNext';
import { useRouter } from 'next/navigation';

import { DashboardPage } from '@/components/dashboard/pages/DashboardPage';
import { PatientsPage } from '@/components/dashboard/pages/PatientsPage';
import { MedicineInventoryPage } from '@/components/dashboard/pages/MedicineInventoryPage';
import { ReportsPage } from '@/components/dashboard/pages/ReportsPage';
import { SettingsPage } from '@/components/dashboard/pages/SettingsPage';

import {
  LayoutDashboard,
  Users,
  Stethoscope,
  FileText,
  Pill,
} from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      refetchOnWindowFocus: true,
    },
  },
});

const DashboardMain: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { activePage, navigateTo, isLoading } = useApp();
  const router = useRouter();
  useEnterToNext();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100/70 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Loading clinic data…</p>
        </div>
      </div>
    );
  }

  const handleNav = (page: any) => {
    navigateTo(page);
    router.push('/');
  };

  return (
    <div className="dashboard-app-root min-h-screen bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Sticky Top Header */}
      <Header />

      {/* Main Body with Sidebar + Active Page */}
      <div className="flex-1 flex items-start">
        {/* Desktop Sidebar */}
        <Sidebar />

        {/* Dynamic Page Container */}
        <main className="flex-1 min-w-0 pb-20 md:pb-8">
          {children ? (
            children
          ) : (
            <>
              {activePage === 'dashboard' && <DashboardPage />}
              {activePage === 'patients' && <PatientsPage />}
              {activePage === 'inventory' && <MedicineInventoryPage />}
              {activePage === 'reports' && <ReportsPage />}
              {activePage === 'settings' && <SettingsPage />}
            </>
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        id="mobile-bottom-nav"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 py-2 flex items-center justify-around text-[10px] font-medium"
      >
        <button
          onClick={() => handleNav('dashboard')}
          className={`flex flex-col items-center gap-1 p-1 ${
            activePage === 'dashboard' && !children ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span>Home</span>
        </button>

        <button
          onClick={() => handleNav('patients')}
          className={`flex flex-col items-center gap-1 p-1 ${
            (activePage === 'patients' || activePage === 'patient-profile') && !children
              ? 'text-indigo-600 dark:text-indigo-400 font-bold'
              : 'text-slate-500'
          }`}
        >
          <Users className="w-5 h-5" />
          <span>Patients</span>
        </button>

        <button
          onClick={() => {
            // No direct route for 'patient-visit' from bottom nav if they need to select a patient first,
            // but for simplicity we push them to patients list or a new visit page.
            router.push('/visit/new');
          }}
          className={`flex flex-col items-center gap-1 p-1 ${
            activePage === 'patient-visit' || children ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500'
          }`}
        >
          <Stethoscope className="w-5 h-5" />
          <span>Exam Visit</span>
        </button>

        <button
          onClick={() => handleNav('inventory')}
          className={`flex flex-col items-center gap-1 p-1 ${
            activePage === 'inventory' && !children ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500'
          }`}
        >
          <Pill className="w-5 h-5" />
          <span>Pharma</span>
        </button>
      </nav>

      {/* Global Overlays */}
      <GlobalSearchModal />
      <ToastContainer />
    </div>
  );
};

export const DashboardShell: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <DashboardMain>{children}</DashboardMain>
      </AppProvider>
    </QueryClientProvider>
  );
};
