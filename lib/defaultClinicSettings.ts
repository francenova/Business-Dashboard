import type { ClinicSettings } from '@/lib/types';

// Default settings — used by AppContext as a fallback while the DB row
// loads, and by app/api/bulk/reset/route.ts to restore defaults on a full
// data reset. Shared so the two can never drift apart.
export const DEFAULT_CLINIC_SETTINGS: ClinicSettings = {
  id: 1,
  clinicName: 'Royal Opticals',
  businessTypes: ['Optical Shop', 'Eye Clinic', 'Computerized Eye Testing', 'Contact Lens Center', 'Spectacle Sales'],
  address: '',
  phone: '',
  email: '',
  doctorName: '',
  doctorTitle: '',
  credentials: '',
  registrationNumber: '',
  defaultConsultationFee: 200,
  defaultPrinter: '',
  currencySymbol: '₹',
  currency: 'INR (₹)',
  language: 'English',
  logoUrl: '',
  enableAutoSave: true,
  theme: 'light',
  gstEnabled: false,
  taxMode: 'exclusive',
  defaultGstRate: 0,
  taxRounding: 'nearest_rupee',
  invoicePrefix: 'INV',
  showLogoOnDocuments: true,
  showGstDetailsOnInvoice: true,
  showTermsOnInvoice: false,
  showDoctorDetailsOnPrescription: true,
  showPatientContactOnPrescription: true,
  showNotesOnPrescription: true,
  lowStockAlertsEnabled: true,
  defaultMinimumStock: 5,
};
