'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { ConfirmModal } from '@/components/dashboard/ConfirmModal';
import { TaxCategory } from '@/lib/types';
import {
  Building2,
  Palette,
  Database,
  Upload,
  Download,
  RotateCcw,
  Globe,
  Sun,
  Moon,
  Trash2,
  CheckCircle2,
  X,
  FileJson,
  Receipt,
  Printer,
  Stethoscope,
  Boxes,
  Bell,
  ShieldCheck,
  UserCircle,
  LogOut,
  Info,
  Loader2,
} from 'lucide-react';

const TAX_CATEGORIES: TaxCategory[] = ['Frame', 'Lens', 'Reading Glass', 'Solution', 'Contact Lens', 'Consultation'];

// Small reusable toggle row — matches the visual style of the existing GST
// "Enable GST" switch above, factored out only for the several new toggles
// added in this phase (the existing GST/theme toggles are left exactly as
// they were, untouched).
const SettingToggle: React.FC<{ label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; id?: string }> = ({
  label,
  description,
  checked,
  onChange,
  id,
}) => (
  <div className="p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-4">
    <div>
      <span className="text-sm font-bold text-slate-900 dark:text-white block">{label}</span>
      {description && <span className="text-[11px] text-slate-500 dark:text-slate-400">{description}</span>}
    </div>
    <button
      id={id}
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        checked ? 'bg-blue-600' : 'bg-slate-300'
      }`}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-6' : 'translate-x-0'
        }`}
      />
    </button>
  </div>
);

export const SettingsPage: React.FC = () => {
  const {
    settings,
    updateSettings,
    taxRateConfig,
    updateTaxRateConfig,
    exportDataJSON,
    importDataJSON,
    resetAllData,
    addToast,
  } = useApp();

  const [formData, setFormData] = useState({
    clinicName: settings.clinicName || 'VisionCare Eye Clinic',
    doctorName: settings.doctorName || 'Dr. R. Kumar',
    credentials: settings.credentials || settings.doctorTitle || 'MBBS, MS Ophthalmology',
    registrationNumber: settings.registrationNumber || 'DMC-12345',
    gstin: settings.gstin || '',
    phone: settings.phone || '+91 98110 22345',
    email: settings.email || 'hello@visioncare.clinic',
    address: settings.address || 'Sector 21, Noida',
    defaultConsultationFee: settings.defaultConsultationFee ?? 500,
    currency: settings.currency || 'INR (₹)',
    language: settings.language || 'English',
    theme: settings.theme || 'light',
    logoUrl: settings.logoUrl || '',
    defaultPrinter: settings.defaultPrinter || 'Thermal HP LaserJet Pro 400',
  });

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // GST / Tax settings — a separate form from Clinic Information above, so
  // saving one never touches the other.
  const [taxFormData, setTaxFormData] = useState({
    gstEnabled: settings.gstEnabled,
    businessState: settings.businessState || '',
    stateCode: settings.stateCode || '',
    registrationType: settings.registrationType || 'Unregistered',
    taxMode: settings.taxMode,
    defaultGstRate: settings.defaultGstRate,
    taxRounding: settings.taxRounding,
  });

  useEffect(() => {
    setTaxFormData({
      gstEnabled: settings.gstEnabled,
      businessState: settings.businessState || '',
      stateCode: settings.stateCode || '',
      registrationType: settings.registrationType || 'Unregistered',
      taxMode: settings.taxMode,
      defaultGstRate: settings.defaultGstRate,
      taxRounding: settings.taxRounding,
    });
  }, [settings]);

  // Invoice & Print — own independent form/save, same pattern as GST above.
  const [invoiceFormData, setInvoiceFormData] = useState({
    invoicePrefix: settings.invoicePrefix || 'INV',
    showLogoOnDocuments: settings.showLogoOnDocuments,
    showGstDetailsOnInvoice: settings.showGstDetailsOnInvoice,
    showTermsOnInvoice: settings.showTermsOnInvoice,
    invoiceTermsText: settings.invoiceTermsText || '',
  });
  useEffect(() => {
    setInvoiceFormData({
      invoicePrefix: settings.invoicePrefix || 'INV',
      showLogoOnDocuments: settings.showLogoOnDocuments,
      showGstDetailsOnInvoice: settings.showGstDetailsOnInvoice,
      showTermsOnInvoice: settings.showTermsOnInvoice,
      invoiceTermsText: settings.invoiceTermsText || '',
    });
  }, [settings]);
  const handleSaveInvoiceSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      invoicePrefix: invoiceFormData.invoicePrefix.trim() || 'INV',
      showLogoOnDocuments: invoiceFormData.showLogoOnDocuments,
      showGstDetailsOnInvoice: invoiceFormData.showGstDetailsOnInvoice,
      showTermsOnInvoice: invoiceFormData.showTermsOnInvoice,
      invoiceTermsText: invoiceFormData.invoiceTermsText,
    });
    addToast('Invoice Settings Saved', 'Only future invoices use the updated configuration — already-issued invoices are unchanged.', 'success');
  };

  // Prescription print settings — own independent form/save.
  const [rxFormData, setRxFormData] = useState({
    showDoctorDetailsOnPrescription: settings.showDoctorDetailsOnPrescription,
    showPatientContactOnPrescription: settings.showPatientContactOnPrescription,
    showNotesOnPrescription: settings.showNotesOnPrescription,
  });
  useEffect(() => {
    setRxFormData({
      showDoctorDetailsOnPrescription: settings.showDoctorDetailsOnPrescription,
      showPatientContactOnPrescription: settings.showPatientContactOnPrescription,
      showNotesOnPrescription: settings.showNotesOnPrescription,
    });
  }, [settings]);
  const handleSaveRxSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(rxFormData);
    addToast('Prescription Settings Saved', 'Print/download layout updated.', 'success');
  };

  // Inventory settings — own independent form/save. defaultMinimumStock only
  // prefills the Add Medicine form; it never overrides an existing item's
  // own minimum-stock value (that stays item-level, in Medicine Inventory).
  const [inventoryFormData, setInventoryFormData] = useState({
    lowStockAlertsEnabled: settings.lowStockAlertsEnabled,
    defaultMinimumStock: settings.defaultMinimumStock,
  });
  useEffect(() => {
    setInventoryFormData({
      lowStockAlertsEnabled: settings.lowStockAlertsEnabled,
      defaultMinimumStock: settings.defaultMinimumStock,
    });
  }, [settings]);
  const handleSaveInventorySettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      lowStockAlertsEnabled: inventoryFormData.lowStockAlertsEnabled,
      defaultMinimumStock: Number(inventoryFormData.defaultMinimumStock) || 0,
    });
    addToast('Inventory Settings Saved', 'Existing items keep their own minimum-stock value.', 'success');
  };

  // Account — real session check (same pattern as TSR's "prepared by"
  // lookup). Login is currently bypassed app-wide (middleware.ts redirects
  // /login back to /), so this will normally show "no active session"
  // rather than a fabricated logged-in user.
  const [accountUser, setAccountUser] = useState<{ email?: string; name?: string } | null | undefined>(undefined);
  useEffect(() => {
    import('@/lib/supabase/client').then(({ createClient }) => {
      createClient()
        .auth.getUser()
        .then(({ data }) => {
          const user = data?.user;
          setAccountUser(user ? { email: user.email, name: user.user_metadata?.full_name || user.user_metadata?.name } : null);
        })
        .catch(() => setAccountUser(null));
    });
  }, []);
  const handleSignOut = async () => {
    const { createClient } = await import('@/lib/supabase/client');
    await createClient().auth.signOut();
    setAccountUser(null);
    addToast('Signed Out', 'Session cleared.', 'info');
  };

  const handleSaveTaxSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      gstEnabled: taxFormData.gstEnabled,
      businessState: taxFormData.businessState,
      stateCode: taxFormData.stateCode,
      registrationType: taxFormData.registrationType as any,
      taxMode: taxFormData.taxMode as 'inclusive' | 'exclusive',
      defaultGstRate: Number(taxFormData.defaultGstRate) || 0,
      taxRounding: taxFormData.taxRounding as 'none' | 'nearest_rupee',
    });
    addToast('Tax Settings Saved', 'GST configuration updated successfully.', 'success');
  };

  // Sync form data when settings change in context
  useEffect(() => {
    setFormData({
      clinicName: settings.clinicName || 'VisionCare Eye Clinic',
      doctorName: settings.doctorName || 'Dr. R. Kumar',
      credentials: settings.credentials || settings.doctorTitle || 'MBBS, MS Ophthalmology',
      registrationNumber: settings.registrationNumber || 'DMC-12345',
      gstin: settings.gstin || '',
      phone: settings.phone || '+91 98110 22345',
      email: settings.email || 'hello@visioncare.clinic',
      address: settings.address || 'Sector 21, Noida',
      defaultConsultationFee: settings.defaultConsultationFee ?? 500,
      currency: settings.currency || 'INR (₹)',
      language: settings.language || 'English',
      theme: settings.theme || 'light',
      logoUrl: settings.logoUrl || '',
      defaultPrinter: settings.defaultPrinter || 'Thermal HP LaserJet Pro 400',
    });
  }, [settings]);

  // Handle Logo Upload — goes through /api/upload/logo (server-side,
  // service_role key) instead of calling Supabase Storage directly from
  // the renderer.
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      addToast('File Too Large', 'Please upload an image smaller than 2MB.', 'warning');
      return;
    }

    try {
      const { apiFetch } = await import('@/lib/apiFetch');
      const body = new FormData();
      body.append('file', file);
      if (formData.logoUrl) body.append('oldLogoUrl', formData.logoUrl);

      const { url } = await apiFetch<{ url: string }>('/api/upload/logo', { method: 'POST', body });

      setFormData((prev) => ({ ...prev, logoUrl: url }));
      addToast('Logo Selected', 'Logo uploaded. Click "Save Changes" to apply.');
    } catch (err) {
      addToast('Upload Failed', err instanceof Error ? err.message : 'Could not upload logo. Please try again.', 'error');
    }
  };

  const handleRemoveLogo = async () => {
    if (formData.logoUrl) {
      try {
        const { apiFetch } = await import('@/lib/apiFetch');
        await apiFetch('/api/upload/logo', { method: 'DELETE', body: JSON.stringify({ logoUrl: formData.logoUrl }) });
      } catch {
        // Non-critical — the URL will just be cleared
      }
    }
    setFormData((prev) => ({ ...prev, logoUrl: '' }));
  };

  // Form submit handler
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      clinicName: formData.clinicName,
      doctorName: formData.doctorName,
      credentials: formData.credentials,
      doctorTitle: formData.credentials,
      registrationNumber: formData.registrationNumber,
      gstin: formData.gstin,
      phone: formData.phone,
      email: formData.email,
      address: formData.address,
      defaultConsultationFee: Number(formData.defaultConsultationFee) || 0,
      currency: formData.currency,
      language: formData.language,
      theme: formData.theme as 'light' | 'dark',
      logoUrl: formData.logoUrl,
      defaultPrinter: formData.defaultPrinter,
    });
    addToast('Settings Saved', 'Clinic configuration updated successfully.', 'success');
  };

  // Immediate Theme Switch
  const handleToggleTheme = () => {
    const nextTheme = formData.theme === 'dark' ? 'light' : 'dark';
    setFormData((prev) => ({ ...prev, theme: nextTheme }));
    updateSettings({ theme: nextTheme });
    addToast(
      'Appearance Changed',
      `Switched to ${nextTheme === 'dark' ? 'Dark' : 'Light'} Mode.`,
      'info'
    );
  };

  // Export JSON Backup
  const handleBackupData = () => {
    const jsonStr = exportDataJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clinic_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Backup Downloaded', 'Saved complete clinic dataset backup JSON file.');
  };

  // Restore JSON Backup
  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = importDataJSON(content);
        if (success) {
          addToast('Database Restored', 'Successfully restored clinic records from JSON file.');
        }
      }
    };
    reader.readAsText(file);
    // Reset file input value
    e.target.value = '';
  };

  return (
    <div id="settings-page" className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6 font-sans">
      {/* 1. CLINIC INFORMATION SECTION */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-6 space-y-6">
          {/* Section Header */}
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800/60">
            <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Clinic Information
            </h2>
          </div>

          {/* Form Fields Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs font-semibold">
            {/* Clinic Name */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1.5 font-bold">
                Clinic Name
              </label>
              <input
                id="setting-clinic-name"
                type="text"
                required
                value={formData.clinicName}
                onChange={(e) => setFormData({ ...formData, clinicName: e.target.value })}
                placeholder="VisionCare Eye Clinic"
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>

            {/* Doctor Name */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1.5 font-bold">
                Doctor Name
              </label>
              <input
                id="setting-doctor-name"
                type="text"
                required
                value={formData.doctorName}
                onChange={(e) => setFormData({ ...formData, doctorName: e.target.value })}
                placeholder="Dr. R. Kumar"
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>

            {/* Credentials */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1.5 font-bold">
                Credentials
              </label>
              <input
                id="setting-credentials"
                type="text"
                value={formData.credentials}
                onChange={(e) => setFormData({ ...formData, credentials: e.target.value })}
                placeholder="MBBS, MS Ophthalmology"
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>

            {/* Registration No */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1.5 font-bold">
                Registration No.
              </label>
              <input
                id="setting-registration-no"
                type="text"
                value={formData.registrationNumber}
                onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                placeholder="DMC-12345"
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>

            {/* GSTIN (optional) */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1.5 font-bold">
                GSTIN <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id="setting-gstin"
                type="text"
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                placeholder="Leave blank if not applicable"
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Shown on the Sales Register letterhead when set. Display only — not used for any tax calculation.
              </p>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1.5 font-bold">
                Phone
              </label>
              <input
                id="setting-phone"
                type="text"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 98110 22345"
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1.5 font-bold">
                Email
              </label>
              <input
                id="setting-email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="hello@visioncare.clinic"
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>

            {/* Address */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1.5 font-bold">
                Address
              </label>
              <input
                id="setting-address"
                type="text"
                required
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Sector 21, Noida"
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>

            {/* Consultation Fee */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1.5 font-bold">
                Consultation Fee (₹)
              </label>
              <input
                id="setting-consultation-fee"
                type="number"
                value={formData.defaultConsultationFee}
                onChange={(e) => setFormData({ ...formData, defaultConsultationFee: parseFloat(e.target.value) || 0 })}
                placeholder="500"
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
          </div>

          {/* Clinic Logo Section */}
          <div className="space-y-2 pt-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Clinic Logo
            </label>

            {formData.logoUrl ? (
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <img
                    src={formData.logoUrl}
                    alt="Clinic Logo Preview"
                    className="w-14 h-14 object-contain rounded-xl bg-white p-1 border border-slate-200 dark:border-slate-700 shadow-xs"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Uploaded Logo Active</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Appears on prescriptions, bills, and main header.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-xl cursor-pointer transition-colors">
                    Change Logo
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/svg+xml"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-xl transition-colors cursor-pointer"
                    title="Remove Logo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <label className="relative flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl bg-white dark:bg-slate-950/50 cursor-pointer group transition-all">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  <Upload className="w-4 h-4" />
                  <span className="text-xs font-semibold">Click to upload logo (PNG/SVG/JPG)</span>
                </div>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/svg+xml"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <button
              id="save-settings-submit-btn"
              type="submit"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-2"
            >
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </form>

      {/* GST / TAX SETTINGS SECTION */}
      <form onSubmit={handleSaveTaxSettings} className="space-y-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-6 space-y-6">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800/60">
            <Receipt className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              GST / Tax Settings
            </h2>
          </div>

          {/* Enable GST Toggle */}
          <div className="p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-4">
            <div>
              <span className="text-sm font-bold text-slate-900 dark:text-white block">
                Enable GST
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Off by default. Billing, invoices and reports show no tax until this is on and rates below are set.
              </span>
            </div>
            <button
              id="gst-enabled-toggle"
              type="button"
              onClick={() => setTaxFormData({ ...taxFormData, gstEnabled: !taxFormData.gstEnabled })}
              className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                taxFormData.gstEnabled ? 'bg-blue-600' : 'bg-slate-300'
              }`}
              role="switch"
              aria-checked={taxFormData.gstEnabled}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  taxFormData.gstEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs font-semibold">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1.5 font-bold">
                Business State
              </label>
              <input
                id="setting-business-state"
                type="text"
                value={taxFormData.businessState}
                onChange={(e) => setTaxFormData({ ...taxFormData, businessState: e.target.value })}
                placeholder="e.g. Karnataka"
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Used with each customer's state to decide CGST+SGST vs IGST automatically.
              </p>
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1.5 font-bold">
                State Code
              </label>
              <input
                id="setting-state-code"
                type="text"
                value={taxFormData.stateCode}
                onChange={(e) => setTaxFormData({ ...taxFormData, stateCode: e.target.value })}
                placeholder="e.g. 29"
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1.5 font-bold">
                Registration Type
              </label>
              <select
                id="setting-registration-type"
                value={taxFormData.registrationType}
                onChange={(e) => setTaxFormData({ ...taxFormData, registrationType: e.target.value as any })}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
              >
                <option value="Unregistered">Unregistered</option>
                <option value="Regular">Regular</option>
                <option value="Composition">Composition</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1.5 font-bold">
                Tax Mode
              </label>
              <select
                id="setting-tax-mode"
                value={taxFormData.taxMode}
                onChange={(e) => setTaxFormData({ ...taxFormData, taxMode: e.target.value as any })}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
              >
                <option value="exclusive">Tax Exclusive (price + GST)</option>
                <option value="inclusive">Tax Inclusive (price already includes GST)</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1.5 font-bold">
                Default GST Rate (%)
              </label>
              <input
                id="setting-default-gst-rate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={taxFormData.defaultGstRate}
                onChange={(e) => setTaxFormData({ ...taxFormData, defaultGstRate: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Fallback rate for medicines with no per-item rate set in Inventory.
              </p>
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1.5 font-bold">
                Tax Rounding
              </label>
              <select
                id="setting-tax-rounding"
                value={taxFormData.taxRounding}
                onChange={(e) => setTaxFormData({ ...taxFormData, taxRounding: e.target.value as any })}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
              >
                <option value="nearest_rupee">Round total to nearest ₹1</option>
                <option value="none">No rounding</option>
              </select>
            </div>
          </div>

          {/* Category Tax Rate Config */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 space-y-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Category Tax Rates</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Frames, Lenses, Reading Glasses, Solutions and Contact Lenses are entered per-visit with no product
                catalog, so their GST rate is set per category here. Medicines have their own per-item rate — set that
                on each medicine in Medicine Inventory.
              </p>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">HSN/SAC</th>
                    <th className="py-2.5 px-3">GST Rate (%)</th>
                    <th className="py-2.5 px-3">Taxable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {TAX_CATEGORIES.map((cat) => {
                    const row = taxRateConfig.find((r) => r.category === cat);
                    return (
                      <tr key={cat}>
                        <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-200">{cat}</td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            defaultValue={row?.hsnSac || ''}
                            placeholder="Optional"
                            onBlur={(e) => updateTaxRateConfig(cat, { hsnSac: e.target.value })}
                            className="w-28 px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold outline-none focus:border-blue-600"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            defaultValue={row?.taxRate ?? 0}
                            onBlur={(e) => updateTaxRateConfig(cat, { taxRate: parseFloat(e.target.value) || 0 })}
                            className="w-20 px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold outline-none focus:border-blue-600"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="checkbox"
                            defaultChecked={row?.isTaxable ?? true}
                            onChange={(e) => updateTaxRateConfig(cat, { isTaxable: e.target.checked })}
                            className="w-4 h-4 accent-blue-600 cursor-pointer"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-2">
            <button
              id="save-tax-settings-submit-btn"
              type="submit"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-2"
            >
              <span>Save Tax Settings</span>
            </button>
          </div>
        </div>
      </form>

      {/* 2. PREFERENCES SECTION */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-6 space-y-6">
        {/* Section Header */}
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800/60">
          <Palette className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
            Preferences
          </h2>
        </div>

        {/* Currency & Language Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs font-semibold">
          {/* Currency Dropdown */}
          <div>
            <label className="block text-slate-700 dark:text-slate-300 mb-1.5 font-bold">
              Currency
            </label>
            <select
              id="setting-currency"
              value={formData.currency}
              onChange={(e) => {
                setFormData({ ...formData, currency: e.target.value });
                updateSettings({ currency: e.target.value });
              }}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-600 transition-all cursor-pointer"
            >
              <option value="INR (₹)">INR (₹)</option>
              <option value="USD ($)">USD ($)</option>
              <option value="EUR (€)">EUR (€)</option>
              <option value="GBP (£)">GBP (£)</option>
              <option value="AED (د.إ)">AED (د.إ)</option>
              <option value="CAD ($)">CAD ($)</option>
              <option value="AUD ($)">AUD ($)</option>
            </select>
          </div>

          {/* Language Dropdown */}
          <div>
            <label className="block text-slate-700 dark:text-slate-300 mb-1.5 font-bold">
              Language
            </label>
            <select
              id="setting-language"
              value={formData.language}
              onChange={(e) => {
                setFormData({ ...formData, language: e.target.value });
                updateSettings({ language: e.target.value });
              }}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-600 transition-all cursor-pointer"
            >
              <option value="English">English</option>
              <option value="Hindi">Hindi</option>
              <option value="Tamil">Tamil</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
              <option value="Arabic">Arabic</option>
              <option value="Bengali">Bengali</option>
              <option value="Marathi">Marathi</option>
            </select>
          </div>
        </div>

        {/* Appearance Toggle Row */}
        <div className="p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              Appearance — {formData.theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
            </span>
          </div>

          {/* Smooth Interactive Pill Switch */}
          <button
            id="theme-toggle-switch"
            type="button"
            onClick={handleToggleTheme}
            className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              formData.theme === 'dark' ? 'bg-blue-600' : 'bg-slate-300'
            }`}
            role="switch"
            aria-checked={formData.theme === 'dark'}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                formData.theme === 'dark' ? 'translate-x-6' : 'translate-x-0'
              }`}
            >
              {formData.theme === 'dark' ? (
                <Moon className="w-3.5 h-3.5 text-blue-600" />
              ) : (
                <Sun className="w-3.5 h-3.5 text-amber-500" />
              )}
            </span>
          </button>
        </div>
      </div>

      {/* 3. DATA & BACKUP SECTION */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-6 space-y-6">
        {/* Section Header */}
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800/60">
          <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
            Data & Backup
          </h2>
        </div>

        {/* 4 Action Buttons Row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* 1. Backup Data */}
          <button
            id="backup-data-btn"
            type="button"
            onClick={handleBackupData}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all cursor-pointer shadow-2xs active:scale-95"
          >
            <RotateCcw className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Backup Data</span>
          </button>

          {/* 2. Restore Data */}
          <label className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all cursor-pointer shadow-2xs active:scale-95">
            <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Restore Data</span>
            <input
              type="file"
              accept=".json"
              onChange={handleRestoreFile}
              className="hidden"
            />
          </label>

          {/* 3. Export Database */}
          <button
            id="export-database-btn"
            type="button"
            onClick={handleBackupData}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all cursor-pointer shadow-2xs active:scale-95"
          >
            <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Export Database</span>
          </button>

          {/* 4. Import Database */}
          <label className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all cursor-pointer shadow-2xs active:scale-95">
            <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Import Database</span>
            <input
              type="file"
              accept=".json"
              onChange={handleRestoreFile}
              className="hidden"
            />
          </label>

          {/* Reset Dataset Option */}
          <button
            id="reset-sample-data-btn"
            type="button"
            onClick={() => setIsResetModalOpen(true)}
            className="ml-auto flex items-center gap-2 px-4 py-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-all cursor-pointer active:scale-95"
          >
            <RotateCcw className="w-4 h-4 text-rose-600" />
            <span>Reset Dataset</span>
          </button>
        </div>
      </div>

      {/* 4. INVOICE & PRINT SETTINGS */}
      <form onSubmit={handleSaveInvoiceSettings} className="space-y-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-6 space-y-6">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800/60">
            <Printer className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Invoice &amp; Print Settings</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs font-semibold">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1.5 font-bold">Invoice Prefix</label>
              <input
                type="text"
                maxLength={10}
                value={invoiceFormData.invoicePrefix}
                onChange={(e) => setInvoiceFormData({ ...invoiceFormData, invoicePrefix: e.target.value })}
                placeholder="INV"
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Numbers are generated as {invoiceFormData.invoicePrefix || 'INV'}-2026-000123. Only affects invoices created
                after saving — already-issued invoice numbers never change.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <SettingToggle
              label="Show Business Logo"
              description="Shown on printed documents' letterhead, if a logo is uploaded in Business Profile above."
              checked={invoiceFormData.showLogoOnDocuments}
              onChange={(v) => setInvoiceFormData({ ...invoiceFormData, showLogoOnDocuments: v })}
            />
            <SettingToggle
              label="Show GST Details on Invoice"
              description="Only has an effect while GST is enabled in GST/Tax Settings above."
              checked={invoiceFormData.showGstDetailsOnInvoice}
              onChange={(v) => setInvoiceFormData({ ...invoiceFormData, showGstDetailsOnInvoice: v })}
            />
            <SettingToggle
              label="Show Terms / Notes on Invoice"
              checked={invoiceFormData.showTermsOnInvoice}
              onChange={(v) => setInvoiceFormData({ ...invoiceFormData, showTermsOnInvoice: v })}
            />
            {invoiceFormData.showTermsOnInvoice && (
              <textarea
                value={invoiceFormData.invoiceTermsText}
                onChange={(e) => setInvoiceFormData({ ...invoiceFormData, invoiceTermsText: e.target.value })}
                placeholder="e.g. Goods once sold will not be taken back. Warranty as per manufacturer terms."
                rows={3}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            )}
          </div>

          <p className="text-[11px] text-slate-400">
            Customer details and payment/total amounts always appear on invoices — they aren't optional, since hiding
            them would make the document unusable as a business record.
          </p>

          <div className="pt-2">
            <button type="submit" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer">
              Save Invoice Settings
            </button>
          </div>
        </div>
      </form>

      {/* 5. PRESCRIPTION SETTINGS */}
      <form onSubmit={handleSaveRxSettings} className="space-y-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-6 space-y-6">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800/60">
            <Stethoscope className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Prescription Settings</h2>
          </div>

          <div className="space-y-3">
            <SettingToggle
              label="Show Doctor / Optometrist Details"
              checked={rxFormData.showDoctorDetailsOnPrescription}
              onChange={(v) => setRxFormData({ ...rxFormData, showDoctorDetailsOnPrescription: v })}
            />
            <SettingToggle
              label="Show Patient Contact"
              checked={rxFormData.showPatientContactOnPrescription}
              onChange={(v) => setRxFormData({ ...rxFormData, showPatientContactOnPrescription: v })}
            />
            <SettingToggle
              label="Show Notes"
              checked={rxFormData.showNotesOnPrescription}
              onChange={(v) => setRxFormData({ ...rxFormData, showNotesOnPrescription: v })}
            />
          </div>

          <div className="pt-2">
            <button type="submit" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer">
              Save Prescription Settings
            </button>
          </div>
        </div>
      </form>

      {/* 6. INVENTORY SETTINGS */}
      <form onSubmit={handleSaveInventorySettings} className="space-y-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-6 space-y-6">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800/60">
            <Boxes className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Inventory Settings</h2>
          </div>

          <SettingToggle
            label="Enable Low-Stock Alerts"
            description="Shows the low-stock count badge next to Medicine Inventory in the sidebar."
            checked={inventoryFormData.lowStockAlertsEnabled}
            onChange={(v) => setInventoryFormData({ ...inventoryFormData, lowStockAlertsEnabled: v })}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs font-semibold">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1.5 font-bold">Default Minimum Stock</label>
              <input
                type="number"
                min={0}
                value={inventoryFormData.defaultMinimumStock}
                onChange={(e) => setInventoryFormData({ ...inventoryFormData, defaultMinimumStock: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Prefills the Minimum Stock field when adding a <em>new</em> medicine. Existing items keep their own
                minimum-stock value — this never changes stock thresholds already set on a specific item.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <button type="submit" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer">
              Save Inventory Settings
            </button>
          </div>
        </div>
      </form>

      {/* 7. NOTIFICATIONS */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-6 space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800/60">
          <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Notifications</h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Low-stock alerts are controlled by the toggle in Inventory Settings above (kept in one place rather than
          duplicated here). The app doesn't currently have a separate pending-payment alert or push-notification
          system to configure — Dashboard's pending-amount figure is a core stat, not a dismissible alert, and
          save/error toasts are core feedback rather than an optional notification. Nothing here is a placeholder for
          something that doesn't work.
        </p>
      </div>

      {/* 8. USERS & PERMISSIONS */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-6 space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800/60">
          <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Users &amp; Permissions</h2>
        </div>
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-2xl flex items-start gap-3">
          <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900 dark:text-amber-200 font-semibold">
            This app doesn't have real multi-user login yet — everyone currently shares one workspace with no
            separate accounts or enforced roles. Toggles here would save nowhere and enforce nothing, so instead of a
            fake permissions grid, this lists the structure the app is designed to support once real accounts exist:
          </p>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200 dark:border-slate-800">
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Intended Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {[
                ['Admin', 'Dashboard, Patients, Visits, Prescriptions, Inventory, Invoices, Reports, Expenses, Settings'],
                ['Staff', 'Dashboard, Patients, Visits, Prescriptions, Inventory, Invoices'],
                ['Doctor / Optometrist', 'Dashboard, Patients, Visits, Prescriptions'],
              ].map(([role, access]) => (
                <tr key={role}>
                  <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">{role}</td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{access}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 9. ACCOUNT */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-6 space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800/60">
          <UserCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Account</h2>
        </div>
        {accountUser === undefined ? (
          <div className="flex items-center gap-2 text-xs text-slate-400"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking session…</div>
        ) : accountUser ? (
          <div className="space-y-3">
            <div className="text-xs">
              <span className="block text-slate-400 font-semibold">Logged in as</span>
              <span className="font-bold text-slate-900 dark:text-white">{accountUser.name || accountUser.email}</span>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-all cursor-pointer active:scale-95"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              No active session. Login is currently disabled for this deployment — every staff member shares this
              same workspace without individually signing in.
            </p>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Resetting */}
      <ConfirmModal
        isOpen={isResetModalOpen}
        title="Reset All Clinic Data?"
        message="This permanently deletes ALL patients, visits, prescriptions, expenses, medicines, stock movements, and suppliers from the live shared database — not a local copy — and restores default settings. This cannot be undone."
        confirmLabel="Reset All Data"
        variant="danger"
        onConfirm={resetAllData}
        onCancel={() => setIsResetModalOpen(false)}
      />
    </div>
  );
};
