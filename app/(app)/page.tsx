'use client';

import { useApp } from '@/context/AppContext';
import { DashboardPage } from '@/components/dashboard/pages/DashboardPage';
import { PatientsPage } from '@/components/dashboard/pages/PatientsPage';
import { MedicineInventoryPage } from '@/components/dashboard/pages/MedicineInventoryPage';
import { SettingsPage } from '@/components/dashboard/pages/SettingsPage';

export default function DashboardRootPage() {
  const { activePage } = useApp();

  return (
    <>
      {activePage === 'dashboard' && <DashboardPage />}
      {activePage === 'patients' && <PatientsPage />}
      {activePage === 'inventory' && <MedicineInventoryPage />}
      {activePage === 'settings' && <SettingsPage />}
    </>
  );
}
