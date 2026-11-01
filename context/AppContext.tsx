'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Patient,
  Visit,
  Medicine,
  Prescription,
  ActivityLog,
  Expense,
  ClinicSettings,
  TaxRateConfig,
  Supplier,
  NavigationPage,
} from '@/lib/types';
// Every table this provider touches now goes through /api/* routes (see
// lib/supabase/server.ts) instead of a direct Supabase client — this file
// holds no Supabase credential at all anymore.
import { apiFetch } from '@/lib/apiFetch';
import { DEFAULT_CLINIC_SETTINGS } from '@/lib/defaultClinicSettings';

// ── Toast type (unchanged) ──────────────────────────────────────────────────
export interface ToastItem {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
}

export interface HistoryEntry {
  page: NavigationPage;
  params?: {
    patientId?: string;
    visitId?: string;
    prescriptionId?: string;
    draft?: Partial<Visit>;
  };
}

export const getPageTitle = (page: NavigationPage): string => {
  switch (page) {
    case 'dashboard':
      return 'Dashboard';
    case 'patients':
      return 'Patients';
    case 'patient-profile':
      return 'Patient Profile';
    case 'patient-visit':
      return 'Visit & Eye Test';
    case 'prescription':
      return 'Prescription';
    case 'inventory':
      return 'Medicines & Frames';
    case 'sales-register':
      return 'Sales Register';
    case 'expense-report':
      return 'Expense Report';
    case 'ledger':
      return 'Customer Ledger';
    case 'reports':
      return 'Reports & Analytics';
    case 'settings':
      return 'Settings';
    default:
      return 'Dashboard';
  }
};

// ── Context interface (100 % backwards-compatible) ──────────────────────────
interface AppContextType {
  settings: ClinicSettings;
  patients: Patient[];
  visits: Visit[];
  prescriptions: Prescription[];
  medicines: Medicine[];
  activities: ActivityLog[];
  expenses: Expense[];
  taxRateConfig: TaxRateConfig[];
  suppliers: Supplier[];

  activePage: NavigationPage;
  selectedPatientId: string | null;
  setSelectedPatientId: (id: string | null) => void;
  selectedVisitId: string | null;
  selectedPrescriptionId: string | null;
  activeVisitDraft: Partial<Visit> | null;

  canGoBack: boolean;
  previousPageTitle: string | null;
  navigationHistory: HistoryEntry[];

  toasts: ToastItem[];
  isGlobalSearchOpen: boolean;
  globalSearchQuery: string;

  isLoading: boolean;

  // Actions
  navigateTo: (
    page: NavigationPage,
    params?: {
      patientId?: string;
      visitId?: string;
      prescriptionId?: string;
      draft?: Partial<Visit>;
    },
    options?: { skipHistory?: boolean }
  ) => void;
  goBack: () => void;

  setGlobalSearchOpen: (open: boolean) => void;
  setGlobalSearchQuery: (query: string) => void;

  addPatient: (patientData: Omit<Patient, 'id' | 'displayId' | 'createdDate' | 'lastVisitDate' | 'outstandingAmount'>) => Promise<Patient>;
  updatePatient: (id: string, data: Partial<Patient>) => Promise<void>;
  deletePatient: (id: string) => void;

  updateVisitDraft: (draft: Partial<Visit>) => void;
  clearVisitDraft: () => void;

  updateVisit: (visitId: string, data: Partial<Visit>) => void;
  deleteVisit: (visitId: string) => void;
  deletePrescription: (prescriptionId: string) => void;

  addMedicine: (medData: Omit<Medicine, 'id'>) => Promise<Medicine>;
  updateMedicine: (id: string, data: Partial<Medicine>) => Promise<void>;
  deleteMedicine: (id: string) => void;
  issueMedicineStock: (idOrName: string, qtyToDeduct: number) => void;
  purchaseStock: (data: {
    category: 'Frame' | 'Lens' | 'Solution' | 'Contact Lens' | 'Reading Glass';
    name: string;
    brand: string;
    specification?: string;
    barcode?: string;
    quantity: number;
    purchasePrice: number;
    sellingPrice: number;
    supplier?: string;
    date: string;
    referenceNumber?: string;
    notes?: string;
    discount?: number;
    paidAmount?: number;
  }) => Promise<void>;
  addSupplier: (data: Omit<Supplier, 'id' | 'createdAt'>) => Promise<Supplier | null>;
  deleteSupplier: (id: string) => void;

  addExpense: (expenseData: Omit<Expense, 'id'>) => Promise<void>;
  updateExpense: (id: string, data: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: string) => void;
  updateSettings: (newSettings: Partial<ClinicSettings>) => Promise<void>;
  updateTaxRateConfig: (category: string, data: Partial<TaxRateConfig>) => Promise<void>;

  addToast: (title: string, message: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
  removeToast: (id: string) => void;

  resetAllData: () => void;
  exportDataJSON: () => string;
  importDataJSON: (jsonStr: string) => boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// ── Provider ────────────────────────────────────────────────────────────────
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();

  // ── React-Query: read all tables ──────────────────────────────────────────

  // Patients/Visits/Prescriptions/Activity Log now go through the local
  // /api/* routes (service_role key, server-side) instead of calling
  // Supabase directly — same reasoning as Settings/Tax Rate Config above.
  const patientsQuery = useQuery({
    queryKey: ['patients'],
    queryFn: async () => apiFetch<Patient[]>('/api/patients'),
  });

  const visitsQuery = useQuery({
    queryKey: ['visits'],
    queryFn: async () => apiFetch<Visit[]>('/api/visits'),
  });

  const prescriptionsQuery = useQuery({
    queryKey: ['prescriptions'],
    queryFn: async () => apiFetch<Prescription[]>('/api/prescriptions'),
  });

  const medicinesQuery = useQuery({
    queryKey: ['medicines'],
    queryFn: async () => apiFetch<Medicine[]>('/api/medicines'),
  });

  const activitiesQuery = useQuery({
    queryKey: ['activity_log'],
    queryFn: async () => apiFetch<ActivityLog[]>('/api/activity-log'),
  });

  const expensesQuery = useQuery({
    queryKey: ['expenses'],
    // No filters applied → /api/expenses?all=true returns every row,
    // date-descending — same as the old unfiltered direct query.
    queryFn: async () => apiFetch<Expense[]>('/api/expenses?all=true'),
  });

  // Settings and Tax Rate Config now go through the local /api/* routes
  // instead of calling Supabase directly — those routes run server-side
  // using the service_role key, which never ships to the browser/Electron
  // renderer. See lib/supabase/server.ts for why.
  const settingsQuery = useQuery({
    queryKey: ['clinic_settings'],
    queryFn: async () => {
      const data = await apiFetch<ClinicSettings | null>('/api/clinic-settings');
      return data || DEFAULT_CLINIC_SETTINGS;
    },
  });

  const taxRateConfigQuery = useQuery({
    queryKey: ['tax_rate_config'],
    queryFn: async () => apiFetch<TaxRateConfig[]>('/api/tax-rate-config'),
  });

  const suppliersQuery = useQuery({
    queryKey: ['suppliers'],
    // Active only — a soft-deleted supplier (is_active = false) should
    // never appear in the picker, the Suppliers section, or anywhere else
    // fed by this array. Their historical expenses/medicines are untouched
    // and still queried directly by name where needed (Supplier Details).
    // See app/api/suppliers/route.ts.
    queryFn: async () => apiFetch<Supplier[]>('/api/suppliers'),
  });

  // ── Derived data arrays ───────────────────────────────────────────────────
  const patients: Patient[] = patientsQuery.data || [];
  
  const visits: Visit[] = (visitsQuery.data || []).map(v => {
    const p = patients.find(pat => pat.id === v.patientId);
    return {
      ...v,
      patientName: v.patientName || p?.name || 'Unknown Patient',
      patientAge: v.patientAge || p?.age || 0,
      patientGender: v.patientGender || p?.gender || 'Other',
      patientPhone: v.patientPhone || p?.phone || '',
      patientAddress: v.patientAddress || p?.address || '',
    };
  });

  const prescriptions: Prescription[] = (prescriptionsQuery.data || []).map(rx => {
    const p = patients.find(pat => pat.id === rx.patientId);
    return {
      ...rx,
      patientName: rx.patientName || p?.name || 'Unknown Patient',
      patientAge: rx.patientAge || p?.age || 0,
      patientGender: rx.patientGender || p?.gender || 'Other',
      patientPhone: rx.patientPhone || p?.phone || '',
      patientAddress: rx.patientAddress || p?.address || '',
    };
  });
  const medicines: Medicine[] = medicinesQuery.data || [];
  const activities: ActivityLog[] = activitiesQuery.data || [];
  const expenses: Expense[] = expensesQuery.data || [];
  const settings: ClinicSettings = settingsQuery.data || DEFAULT_CLINIC_SETTINGS;
  const taxRateConfig: TaxRateConfig[] = taxRateConfigQuery.data || [];
  const suppliers: Supplier[] = suppliersQuery.data || [];

  const isLoading =
    patientsQuery.isLoading ||
    visitsQuery.isLoading ||
    prescriptionsQuery.isLoading ||
    medicinesQuery.isLoading ||
    settingsQuery.isLoading;

  // ── Navigation state (client-only, not persisted) ─────────────────────────
  const [activePage, setActivePage] = useState<NavigationPage>('dashboard');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState<string | null>(null);
  const [activeVisitDraft, setActiveVisitDraft] = useState<Partial<Visit> | null>(null);
  const [navigationHistory, setNavigationHistory] = useState<HistoryEntry[]>([]);

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isGlobalSearchOpen, setGlobalSearchOpen] = useState<boolean>(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');

  // Apply dark mode class to root HTML
  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  // ── Toasts ────────────────────────────────────────────────────────────────
  const addToast = (title: string, message: string, type: 'success' | 'warning' | 'error' | 'info' = 'success') => {
    const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const newToast: ToastItem = { id, title, message, type };
    setToasts((prev) => [newToast, ...prev].slice(0, 5));
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // ── Navigation ────────────────────────────────────────────────────────────
  const navigateTo = (
    page: NavigationPage,
    params?: {
      patientId?: string;
      visitId?: string;
      prescriptionId?: string;
      draft?: Partial<Visit>;
    },
    options?: { skipHistory?: boolean }
  ) => {
    if (!options?.skipHistory && (page !== activePage || params?.patientId !== selectedPatientId)) {
      setNavigationHistory((prev) => [
        ...prev,
        {
          page: activePage,
          params: {
            patientId: selectedPatientId || undefined,
            visitId: selectedVisitId || undefined,
            prescriptionId: selectedPrescriptionId || undefined,
          },
        },
      ]);
    }

    setActivePage(page);
    if (params?.patientId !== undefined) setSelectedPatientId(params.patientId);
    if (params?.visitId !== undefined) setSelectedVisitId(params.visitId);
    if (params?.prescriptionId !== undefined) setSelectedPrescriptionId(params.prescriptionId);
    if (params?.draft !== undefined) setActiveVisitDraft(params.draft);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = () => {
    if (navigationHistory.length > 0) {
      const newHistory = [...navigationHistory];
      const previous = newHistory.pop()!;
      setNavigationHistory(newHistory);

      setActivePage(previous.page);
      if (previous.params?.patientId !== undefined) setSelectedPatientId(previous.params.patientId);
      if (previous.params?.visitId !== undefined) setSelectedVisitId(previous.params.visitId);
      if (previous.params?.prescriptionId !== undefined) setSelectedPrescriptionId(previous.params.prescriptionId);

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (activePage !== 'dashboard') {
      setActivePage('dashboard');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const canGoBack = navigationHistory.length > 0 || activePage !== 'dashboard';
  const previousPageTitle =
    navigationHistory.length > 0
      ? getPageTitle(navigationHistory[navigationHistory.length - 1].page)
      : activePage !== 'dashboard'
      ? 'Dashboard'
      : null;

  const updateVisitDraft = useCallback((draft: Partial<Visit>) => {
    setActiveVisitDraft((prev) => ({ ...prev, ...draft }));
  }, []);

  const clearVisitDraft = () => {
    setActiveVisitDraft(null);
  };

  // ── Helper: log activity via the local API ────────────────────────────────
  const logActivity = async (act: Omit<ActivityLog, 'id'>) => {
    await apiFetch('/api/activity-log', { method: 'POST', body: JSON.stringify(act) });
    queryClient.invalidateQueries({ queryKey: ['activity_log'] });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ── PATIENTS ──────────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  const addPatient = async (
    patientData: Omit<Patient, 'id' | 'displayId' | 'createdDate' | 'lastVisitDate' | 'outstandingAmount'>
  ): Promise<Patient> => {
    // Build optimistic patient (id will be replaced by DB uuid on refetch)
    const tempId = 'temp-' + Date.now();
    const newPatient: Patient = {
      ...patientData,
      id: tempId,
      displayId: 'Pending...',
      createdDate: new Date().toISOString(),
      outstandingAmount: 0,
    };

    try {
      // The route handler does the insert and logs the activity entry in
      // one request — see app/api/patients/route.ts.
      await apiFetch('/api/patients', { method: 'POST', body: JSON.stringify(patientData) });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['activity_log'] });
    } catch (err) {
      addToast('Error', `Failed to add patient: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }

    addToast('Patient Registered', `${newPatient.name} registered successfully.`);
    return newPatient;
  };

  const updatePatient = async (id: string, data: Partial<Patient>): Promise<void> => {
    try {
      await apiFetch(`/api/patients/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      addToast('Patient Updated', `Record for patient saved successfully.`);
    } catch (err) {
      addToast('Error', `Failed to update patient: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  const deletePatient = (id: string) => {
    const patientToDelete = patients.find((p) => p.id === id);
    (async () => {
      try {
        await apiFetch(`/api/patients/${id}`, { method: 'DELETE' });
        queryClient.invalidateQueries({ queryKey: ['patients'] });
        queryClient.invalidateQueries({ queryKey: ['visits'] });
        queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
        queryClient.invalidateQueries({ queryKey: ['activity_log'] });
      } catch (err) {
        addToast('Error', `Failed to delete patient: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      }
    })();
    addToast('Patient Removed', `Deleted ${patientToDelete?.name || id} from database.`, 'warning');
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ── VISITS & PRESCRIPTIONS ────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════


  const updateVisit = async (visitId: string, data: Partial<Visit>): Promise<void> => {
    try {
      // The route handler strips denormalized patient fields and updates
      // the linked prescription too, when relevant — see
      // app/api/visits/[id]/route.ts.
      await apiFetch(`/api/visits/${visitId}`, { method: 'PATCH', body: JSON.stringify(data) });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      if (data.payment || data.medicines || data.visionTest || data.diagnosis || data.doctorNotes) {
        queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
      }
      addToast('Visit Updated', `Updated visit details.`);
    } catch (err) {
      addToast('Error', `Failed to update visit: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  const deleteVisit = async (visitId: string): Promise<void> => {
    try {
      await apiFetch(`/api/visits/${visitId}`, { method: 'DELETE' });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      addToast('Visit Deleted', 'The visit has been permanently removed.', 'warning');
    } catch (err) {
      addToast('Error', `Failed to delete visit: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  const deletePrescription = async (prescriptionId: string): Promise<void> => {
    try {
      await apiFetch(`/api/prescriptions/${prescriptionId}`, { method: 'DELETE' });
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
      addToast('Prescription Deleted', 'The prescription has been permanently removed.', 'warning');
    } catch (err) {
      addToast('Error', `Failed to delete prescription: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ── MEDICINES ─────────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  // Stock movement logging is now folded into each entity's own route
  // handler server-side (app/api/medicines/**, app/api/stock/purchase) —
  // see those files for the same "one extra insert at each of the places
  // stock actually changes" logic that used to live in this local helper.

  const addMedicine = async (medData: Omit<Medicine, 'id'>): Promise<Medicine> => {
    const tempId = 'temp-' + Date.now();
    const newMed: Medicine = {
      ...medData,
      id: tempId,
    };

    try {
      await apiFetch('/api/medicines', { method: 'POST', body: JSON.stringify(medData) });
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      queryClient.invalidateQueries({ queryKey: ['activity_log'] });
    } catch (err) {
      addToast('Error', `Failed to add medicine: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      return newMed;
    }

    addToast('Inventory Added', `${medData.name} added to Rack ${medData.rackNumber}`);
    return newMed;
  };

  const updateMedicine = async (id: string, data: Partial<Medicine>): Promise<void> => {
    try {
      await apiFetch(`/api/medicines/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      addToast('Inventory Updated', `Stock record updated.`);
    } catch (err) {
      addToast('Error', `Failed to update medicine: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  const deleteMedicine = async (id: string): Promise<void> => {
    const med = medicines.find((m) => m.id === id);
    try {
      await apiFetch(`/api/medicines/${id}`, { method: 'DELETE' });
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      addToast('Medicine Removed', `Removed ${med?.name || id} from inventory.`, 'warning');
    } catch (err) {
      addToast('Error', `Failed to delete medicine: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  const issueMedicineStock = async (idOrName: string, qtyToDeduct: number): Promise<void> => {
    try {
      const result = await apiFetch<{ itemName: string }>('/api/medicines/issue-stock', {
        method: 'POST',
        body: JSON.stringify({ idOrName, quantity: qtyToDeduct }),
      });
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      addToast('Stock Issued', `Deducted ${qtyToDeduct} units from ${result.itemName}. Remaining live stock updated.`);
    } catch (err) {
      addToast('Error', err instanceof Error ? err.message : 'Failed to deduct stock.', 'error');
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ── EXPENSES ──────────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  const addExpense = async (expenseData: Omit<Expense, 'id'>): Promise<void> => {
    try {
      await apiFetch('/api/expenses', { method: 'POST', body: JSON.stringify(expenseData) });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      addToast('Expense Logged', `Recorded ₹${expenseData.amount} for ${expenseData.description}`);
    } catch (err) {
      addToast('Error', `Failed to log expense: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  const updateExpense = async (id: string, data: Partial<Expense>): Promise<void> => {
    try {
      await apiFetch(`/api/expenses/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      addToast('Expense Updated', 'Expense record updated successfully.');
    } catch (err) {
      addToast('Error', `Failed to update expense: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  const deleteExpense = (id: string) => {
    (async () => {
      try {
        await apiFetch(`/api/expenses/${id}`, { method: 'DELETE' });
        queryClient.invalidateQueries({ queryKey: ['expenses'] });
      } catch (err) {
        addToast('Error', `Failed to delete expense: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      }
    })();
    addToast('Expense Removed', 'Deleted expense record.', 'warning');
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ── ADD STOCK (Expense ↔ Inventory connection) ───────────────────────────────
  // Ties the 3 existing subsystems together in one action — never a 4th,
  // isolated "expense stock": (1) medicines row is created or its
  // available_stock increased, (2) a Stock In row is logged via the same
  // logStockMovement already used everywhere else, (3) a real expense row is
  // recorded via the existing addExpense, so it shows up in Expense
  // Management's totals/breakdown with no changes needed there.
  // ═══════════════════════════════════════════════════════════════════════════

  const purchaseStock = async (data: {
    category: 'Frame' | 'Lens' | 'Solution' | 'Contact Lens' | 'Reading Glass';
    name: string;
    brand: string;
    specification?: string;
    barcode?: string;
    quantity: number;
    purchasePrice: number;
    sellingPrice: number;
    supplier?: string;
    date: string;
    referenceNumber?: string;
    notes?: string;
    discount?: number;
    paidAmount?: number;
  }): Promise<void> => {
    if (data.quantity <= 0) {
      addToast('Error', 'Quantity must be greater than 0.', 'error');
      return;
    }
    try {
      // The route handles medicine upsert + stock movement + expense insert
      // in one request — see app/api/stock/purchase/route.ts.
      await apiFetch('/api/stock/purchase', {
        method: 'POST',
        body: JSON.stringify({ ...data, defaultMinimumStock: settings.defaultMinimumStock }),
      });
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      addToast('Stock Added', `${data.quantity} unit(s) of ${data.name} added to inventory.`, 'success');
    } catch (err) {
      addToast('Error', err instanceof Error ? err.message : 'Failed to add stock.', 'error');
    }
  };

  const addSupplier = async (data: Omit<Supplier, 'id' | 'createdAt'>): Promise<Supplier | null> => {
    if (!data.name.trim()) {
      addToast('Error', 'Supplier name is required.', 'error');
      return null;
    }
    try {
      const inserted = await apiFetch<Supplier>('/api/suppliers', { method: 'POST', body: JSON.stringify(data) });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      addToast('Supplier Added', `${data.name} saved to your supplier list.`, 'success');
      return inserted;
    } catch (err) {
      addToast('Error', `Failed to add supplier: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      return null;
    }
  };

  const deleteSupplier = async (id: string): Promise<void> => {
    // Soft delete — flips is_active off rather than removing the row, so
    // every expense/medicine that already stored this supplier's name stays
    // exactly as it was (they're plain text, not a foreign key) and the
    // Supplier Details page still works if it's ever opened again. Only the
    // active-only suppliers list (picker, Suppliers section) stops showing them.
    const sup = suppliers.find((s) => s.id === id);
    try {
      await apiFetch(`/api/suppliers/${id}`, { method: 'DELETE' });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      addToast('Supplier Removed', `Removed ${sup?.name || id} from your supplier list.`, 'warning');
    } catch (err) {
      addToast('Error', `Failed to delete supplier: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ── SETTINGS ──────────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  const updateSettings = async (newSettings: Partial<ClinicSettings>): Promise<void> => {
    // Optimistic: update the query cache immediately
    queryClient.setQueryData(['clinic_settings'], (old: ClinicSettings | undefined) => ({
      ...(old || DEFAULT_CLINIC_SETTINGS),
      ...newSettings,
    }));

    try {
      await apiFetch('/api/clinic-settings', { method: 'PATCH', body: JSON.stringify(newSettings) });
      queryClient.invalidateQueries({ queryKey: ['clinic_settings'] });
      addToast('Settings Saved', 'Clinic configuration updated globally.');
    } catch (err) {
      addToast('Error', `Failed to save settings: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      queryClient.invalidateQueries({ queryKey: ['clinic_settings'] });
    }
  };

  const updateTaxRateConfig = async (category: string, data: Partial<TaxRateConfig>): Promise<void> => {
    try {
      await apiFetch('/api/tax-rate-config', { method: 'PATCH', body: JSON.stringify({ category, data }) });
      queryClient.invalidateQueries({ queryKey: ['tax_rate_config'] });
      addToast('Tax Rate Updated', `${category} GST configuration saved.`);
    } catch {
      addToast('Error', 'Failed to update tax rate.', 'error');
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ── BULK OPERATIONS ───────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  const resetAllData = () => {
    (async () => {
      // app/api/bulk/reset/route.ts does the same FK-respecting
      // table-by-table delete + settings reset server-side now, stopping at
      // (and reporting) the first failure the same way this used to.
      try {
        await apiFetch('/api/bulk/reset', { method: 'POST' });
        queryClient.invalidateQueries();
        addToast('Data Reset', 'Cleared all data and restored default settings.', 'info');
      } catch (err) {
        addToast('Error', err instanceof Error ? err.message : 'Failed to reset data.', 'error');
      }
    })();
  };

  const exportDataJSON = (): string => {
    return JSON.stringify(
      {
        settings,
        patients,
        visits,
        prescriptions,
        medicines,
        activities,
        expenses,
        taxRateConfig,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
  };

  const importDataJSON = (jsonStr: string): boolean => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.patients && parsed.medicines) {
        // Fire async upserts — app/api/bulk/import/route.ts does the same
        // per-table upsert sequence server-side now.
        (async () => {
          try {
            await apiFetch('/api/bulk/import', { method: 'POST', body: JSON.stringify(parsed) });
            queryClient.invalidateQueries();
            addToast('Data Imported', 'Successfully imported clinic database snapshot.');
          } catch {
            addToast('Import Error', 'Some records failed to import.', 'error');
          }
        })();
        return true;
      }
      throw new Error('Invalid schema format');
    } catch {
      addToast('Import Failed', 'Selected JSON file is invalid or corrupt.', 'error');
      return false;
    }
  };

  return (
    <AppContext.Provider
      value={{
        settings,
        patients,
        visits,
        prescriptions,
        medicines,
        activities,
        expenses,
        taxRateConfig,
        suppliers,
        activePage,
        selectedPatientId,
        setSelectedPatientId,
        selectedVisitId,
        selectedPrescriptionId,
        activeVisitDraft,
        canGoBack,
        previousPageTitle,
        navigationHistory,
        toasts,
        isGlobalSearchOpen,
        globalSearchQuery,
        isLoading,

        navigateTo,
        goBack,
        setGlobalSearchOpen,
        setGlobalSearchQuery,
        addPatient,
        updatePatient,
        deletePatient,
        updateVisitDraft,
        clearVisitDraft,
        updateVisit,
        deleteVisit,
        deletePrescription,
        addMedicine,
        updateMedicine,
        deleteMedicine,
        issueMedicineStock,
        purchaseStock,
        addSupplier,
        deleteSupplier,
        addExpense,
        updateExpense,
        deleteExpense,
        updateSettings,
        updateTaxRateConfig,
        addToast,
        removeToast,
        resetAllData,
        exportDataJSON,
        importDataJSON,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
