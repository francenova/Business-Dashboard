'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { Patient, Gender } from '@/lib/types';
import { ConfirmModal } from '@/components/dashboard/ConfirmModal';
import { exportToExcel } from '@/lib/excelExport';
import { formatDate } from '@/lib/formatDate';
import {
  Users,
  Search,
  Plus,
  Filter,
  Eye,
  Edit2,
  Trash2,
  Stethoscope,
  ChevronLeft,
  ChevronRight,
  Phone,
  MapPin,
  X,
  AlertCircle,
  ArrowUpDown,
  Download,
  FileText,
} from 'lucide-react';

// Export period — scopes only the Excel/PDF downloads below (which patients
// get included), not the on-screen table, so the database view itself still
// always shows every patient regardless of which period is selected here.
type ExportPeriod = 'today' | 'week' | 'month' | 'year' | 'custom';

// Builds a YYYY-MM-DD string from `d`'s LOCAL calendar date — NOT
// `d.toISOString()`, which converts through UTC and silently shifts the
// date by a day in timezones ahead of UTC (e.g. IST, UTC+5:30): local
// midnight on the last day of the month becomes 18:30 the day before in
// UTC, so "This Month" would wrongly exclude the month's actual last day.
// "Today/This Week/This Month/This Year" are calendar concepts and must be
// computed against the clinic's local calendar day.
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getRangeForPeriod(period: ExportPeriod, customFrom: string, customTo: string): { from: string; to: string } {
  const today = new Date();
  if (period === 'today') {
    const s = toDateStr(today);
    return { from: s, to: s };
  }
  if (period === 'week') {
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((day + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { from: toDateStr(monday), to: toDateStr(sunday) };
  }
  if (period === 'month') {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { from: toDateStr(first), to: toDateStr(last) };
  }
  if (period === 'year') {
    return { from: `${today.getFullYear()}-01-01`, to: `${today.getFullYear()}-12-31` };
  }
  return { from: customFrom || toDateStr(today), to: customTo || toDateStr(today) };
}

function getPeriodLabel(period: ExportPeriod, from: string, to: string): string {
  if (period === 'today') return `Today (${formatDate(from)})`;
  if (period === 'week') return `This Week (${formatDate(from)} - ${formatDate(to)})`;
  if (period === 'month') return `This Month (${formatDate(from)} - ${formatDate(to)})`;
  if (period === 'year') return `This Year (${formatDate(from)} - ${formatDate(to)})`;
  return `${formatDate(from)} - ${formatDate(to)}`;
}

// Real Date-based comparison (not string concatenation) so this holds up
// regardless of whether `dateStr` carries a time/timezone suffix (visits are
// timestamptz, patients.createdDate too) — `from`/`to` are plain YYYY-MM-DD
// boundaries, expanded here to the full local day they represent.
function isWithinRange(dateStr: string | undefined, from: string, to: string): boolean {
  if (!dateStr) return false;
  const t = new Date(dateStr).getTime();
  const start = new Date(`${from}T00:00:00`).getTime();
  const end = new Date(`${to}T23:59:59.999`).getTime();
  if (isNaN(t) || isNaN(start) || isNaN(end)) return false;
  return t >= start && t <= end;
}

export const PatientsPage: React.FC = () => {
  const { patients, visits, addPatient, updatePatient, deletePatient, navigateTo, settings, addToast } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState<string>('all');
  const [dueFilter, setDueFilter] = useState<string>('all');
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<string>(
    searchParams.get('deliveryStatus') || 'all'
  );
  const [sortField, setSortField] = useState<'name' | 'id' | 'createdDate' | 'outstandingAmount'>('createdDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Export Period — a real filter on the patient list itself (table, count,
  // pagination, and totals all derive from `filteredPatients` below, which
  // includes this range), and the Excel/PDF downloads simply export whatever
  // that same filtered list currently is — see ExportPeriod above.
  const [exportPeriod, setExportPeriod] = useState<ExportPeriod>('month');
  const todayStr = toDateStr(new Date());
  const [customFrom, setCustomFrom] = useState(todayStr);
  const [customTo, setCustomTo] = useState(todayStr);
  const { from: exportFrom, to: exportTo } = useMemo(
    () => getRangeForPeriod(exportPeriod, customFrom, customTo),
    [exportPeriod, customFrom, customTo]
  );

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Any change to a filter (including the Export Period) should snap back
  // to page 1 — otherwise switching filters can strand the user on a page
  // number that no longer exists for the new, smaller result set.
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, genderFilter, dueFilter, deliveryStatusFilter, exportFrom, exportTo]);

  // Modals & Drawer state
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingPatientId, setDeletingPatientId] = useState<string | null>(null);

  // Form fields for new/edit patient
  const [formData, setFormData] = useState({
    name: '',
    age: 30,
    gender: 'Male' as Gender,
    phone: '',
    email: '',
    address: '',
    notes: '',
  });

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      age: 30,
      gender: 'Male',
      phone: '',
      email: '',
      address: '',
      notes: '',
    });
    setEditingPatient(null);
    setIsAddDrawerOpen(true);
  };

  const handleOpenEdit = (p: Patient) => {
    setEditingPatient(p);
    setFormData({
      name: p.name,
      age: p.age,
      gender: p.gender,
      phone: p.phone,
      email: p.email || '',
      address: p.address,
      notes: p.notes || '',
    });
    setIsAddDrawerOpen(true);
  };

  const handleSavePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;

    setIsSubmitting(true);
    try {
      if (editingPatient) {
        await updatePatient(editingPatient.id, formData);
      } else {
        await addPatient(formData);
      }
      setIsAddDrawerOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Total / Advance / Pending per patient, aggregated across all their visits.
  // Same formula used on the Dashboard and Patient Visit billing panel:
  // Total = sum of Grand Total, Advance = sum of amount paid, Pending = Total - Advance.
  const patientFinancials = new Map<string, { total: number; advance: number; pending: number }>();
  for (const p of patients) {
    const pVisits = visits.filter((v) => v.patientId === p.id);
    const total = pVisits.reduce((acc, v) => acc + (v.payment?.grandTotal || 0), 0);
    const advance = pVisits.reduce((acc, v) => acc + (v.payment?.advance || 0), 0);
    patientFinancials.set(p.id, { total, advance, pending: Math.max(0, total - advance) });
  }

  // Filter & Sort logic
  const filteredPatients = patients
    .filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.phone.includes(searchTerm) ||
        p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.address.toLowerCase().includes(searchTerm.toLowerCase());

      const matchGender = genderFilter === 'all' || p.gender === genderFilter;
      const pending = patientFinancials.get(p.id)?.pending || 0;
      const matchDue =
        dueFilter === 'all'
          ? true
          : dueFilter === 'due'
          ? pending > 0
          : pending === 0;
      const matchDeliveryStatus =
        deliveryStatusFilter === 'all' ||
        visits.some((v) => v.patientId === p.id && v.status === deliveryStatusFilter);

      // Export Period — a patient matches if any of their visits fall in
      // the selected range, or (for a patient with no visits yet) if their
      // registration date does.
      const pVisits = visits.filter((v) => v.patientId === p.id);
      const matchPeriod =
        pVisits.length > 0
          ? pVisits.some((v) => isWithinRange(v.date, exportFrom, exportTo))
          : isWithinRange(p.createdDate, exportFrom, exportTo);

      return matchSearch && matchGender && matchDue && matchDeliveryStatus && matchPeriod;
    })
    .sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'createdDate') {
        valA = new Date(a.createdDate).getTime();
        valB = new Date(b.createdDate).getTime();
      } else if (sortField === 'outstandingAmount') {
        valA = patientFinancials.get(a.id)?.pending || 0;
        valB = patientFinancials.get(b.id)?.pending || 0;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  // Pagination calculation
  const totalPages = Math.ceil(filteredPatients.length / itemsPerPage) || 1;
  const paginatedPatients = filteredPatients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleExportPatients = () => {
    const patientRows = filteredPatients.map((p) => {
      const fin = patientFinancials.get(p.id) || { total: 0, advance: 0, pending: 0 };
      return {
        'Patient ID': p.id,
        Name: p.name,
        Age: p.age,
        Gender: p.gender,
        Phone: p.phone,
        Address: p.address,
        'Last Visit Date': p.lastVisitDate || p.createdDate,
        'Total (₹)': fin.total,
        'Advance (₹)': fin.advance,
        'Pending (₹)': fin.pending,
        Notes: p.notes || '',
      };
    });

    exportToExcel(patientRows, 'Patients_Database_2026', 'Patients');
  };

  // DOWNLOAD PDF ACTION — one combined PDF listing every currently filtered
  // patient (same list the table shows) as a single rows-and-columns table.
  // Hand-drawn jsPDF document (same architecture as the Prescription PDF)
  // rather than a screenshot, so it stays a real, crisp A4 document
  // regardless of how many patients are in the list.
  const handleDownloadPatientsPDF = async () => {
    try {
      addToast('Generating PDF...', 'Preparing the patient database PDF.');
      const { generatePatientsDatabasePDF } = await import('@/lib/patientPdf');
      await generatePatientsDatabasePDF({
        settings,
        patients: filteredPatients,
        visits,
        periodLabel: getPeriodLabel(exportPeriod, exportFrom, exportTo),
      });
    } catch (err) {
      addToast('PDF Failed', 'Could not generate the patient database PDF.', 'error');
    }
  };

  return (
    <div id="patients-page" className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-7 h-7 text-indigo-600" />
            Patient Database
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage patient records, view clinical history, and start new examinations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="export-patients-excel-btn"
            onClick={handleExportPatients}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold rounded-xl text-sm shadow-2xs transition-all active:scale-95 cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Export Excel</span>
          </button>

          <button
            id="download-patients-pdf-btn"
            onClick={handleDownloadPatientsPDF}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold rounded-xl text-sm shadow-2xs transition-all active:scale-95 cursor-pointer"
          >
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>Download PDF</span>
          </button>

          <button
            id="add-patient-main-btn"
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>New Patient Registration</span>
          </button>
        </div>
      </div>

      {/* Export Period — scopes only the Excel/PDF downloads above (which
          patients get included); the table below always shows everyone. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide pr-1">
          Export Period:
        </span>
        {(
          [
            { key: 'today', label: 'Today' },
            { key: 'week', label: 'This Week' },
            { key: 'month', label: 'This Month' },
            { key: 'year', label: 'This Year' },
            { key: 'custom', label: 'Custom Range' },
          ] as { key: ExportPeriod; label: string }[]
        ).map((p) => (
          <button
            key={p.key}
            id={`export-period-${p.key}`}
            onClick={() => setExportPeriod(p.key)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              exportPeriod === p.key
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {p.label}
          </button>
        ))}
        {exportPeriod === 'custom' && (
          <>
            <input
              id="export-period-custom-from"
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
            />
            <span className="text-xs text-slate-400 font-bold">to</span>
            <input
              id="export-period-custom-to"
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
            />
          </>
        )}
        <span className="text-xs text-slate-400 ml-1">
          {filteredPatients.length} patient{filteredPatients.length === 1 ? '' : 's'} match this period
        </span>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search Bar */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            id="patient-search-input"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Patient Name, ID, Phone Number, or Address..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-indigo-500 transition-all"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
            <span className="text-xs text-slate-400 px-2 font-medium">Gender:</span>
            <select
              id="filter-gender-select"
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer pr-2"
            >
              <option value="all">All</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
            <span className="text-xs text-slate-400 px-2 font-medium">Payment:</span>
            <select
              id="filter-due-select"
              value={dueFilter}
              onChange={(e) => setDueFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer pr-2"
            >
              <option value="all">All Status</option>
              <option value="due">Outstanding Due</option>
              <option value="paid">Fully Paid</option>
            </select>
          </div>

          {deliveryStatusFilter !== 'all' && (
            <div className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950 p-1 pl-2.5 rounded-xl">
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                {deliveryStatusFilter}
              </span>
              <button
                id="clear-delivery-status-filter"
                onClick={() => {
                  setDeliveryStatusFilter('all');
                  router.push('/');
                }}
                className="p-1 text-indigo-400 hover:text-indigo-600 rounded-lg"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            id="toggle-sort-dir"
            onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
            className="flex items-center gap-1 px-3 py-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>{sortDirection === 'asc' ? 'Oldest First' : 'Newest First'}</span>
          </button>
        </div>
      </div>

      {/* Patients Table */}
      <div className="bg-white dark:bg-slate-800/80 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 uppercase text-[11px] font-bold tracking-wider border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-3.5 px-4">Patient ID</th>
                <th className="py-3.5 px-4">Name & Contact</th>
                <th className="py-3.5 px-4">Age / Gender</th>
                <th className="py-3.5 px-4">Address</th>
                <th className="py-3.5 px-4">Last Visit</th>
                <th className="py-3.5 px-4">Total</th>
                <th className="py-3.5 px-4">Advance</th>
                <th className="py-3.5 px-4">Pending</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedPatients.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">No patients found for this period</p>
                    <p className="text-xs mt-1">Try a different Export Period, adjust search/filters, or register a new patient.</p>
                  </td>
                </tr>
              ) : (
                paginatedPatients.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => router.push(`/patients/${p.id}`)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors cursor-pointer"
                  >
                    <td className="py-4 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                      {p.displayId || p.id}
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {p.name}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {p.phone}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-slate-700 dark:text-slate-300">
                      {p.age} yrs • {p.gender}
                    </td>
                    <td className="py-4 px-4 text-slate-500 text-xs max-w-xs truncate">
                      {p.address}
                    </td>
                    <td className="py-4 px-4 text-xs font-mono text-slate-600 dark:text-slate-400">
                      {p.lastVisitDate ? formatDate(p.lastVisitDate) : 'No visits yet'}
                    </td>
                    <td className="py-4 px-4 font-semibold text-xs text-slate-700 dark:text-slate-300">
                      ₹{(patientFinancials.get(p.id)?.total || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-4 px-4 font-semibold text-xs text-slate-700 dark:text-slate-300">
                      ₹{(patientFinancials.get(p.id)?.advance || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-4 px-4 font-semibold text-xs">
                      {(patientFinancials.get(p.id)?.pending || 0) > 0 ? (
                        <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 font-bold">
                          ₹{(patientFinancials.get(p.id)?.pending || 0).toLocaleString('en-IN')}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 font-bold">
                          ₹0
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {(patientFinancials.get(p.id)?.pending || 0) > 0 ? (
                        <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 font-black text-[10px] border border-rose-200 dark:border-rose-900">
                          Pending
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 font-black text-[10px] border border-emerald-200 dark:border-emerald-900">
                          Completed
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {/* View Full Profile Page */}
                        <button
                          id={`view-profile-${p.id}`}
                          onClick={() => router.push(`/patients/${p.id}`)}
                          className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
                          title="View Full Profile"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>

                        {/* Move To Visit */}
                        <button
                          id={`move-to-visit-${p.id}`}
                          onClick={() => {
                            navigateTo('patient-visit');
                            router.push('/visit/new?patientId=' + p.id);
                          }}
                          className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center gap-1"
                          title="Start Eye Exam Visit"
                        >
                          <Stethoscope className="w-3.5 h-3.5" />
                          <span>Move To Visit</span>
                        </button>

                        {/* Edit */}
                        <button
                          id={`edit-patient-${p.id}`}
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          id={`delete-patient-${p.id}`}
                          onClick={() => setDeletingPatientId(p.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing {filteredPatients.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to{' '}
            {Math.min(currentPage * itemsPerPage, filteredPatients.length)} of {filteredPatients.length} patients
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Previous
            </button>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* NEW / EDIT PATIENT DRAWER MODAL */}
      {isAddDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingPatient ? 'Edit Patient Record' : 'Register New Patient'}
              </h3>
              <button
                onClick={() => setIsAddDrawerOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePatient} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name *
                </label>
                <input
                  id="patient-form-name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Karthik Subramanian"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Age *
                  </label>
                  <input
                    id="patient-form-age"
                    type="number"
                    min="1"
                    max="110"
                    required
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Gender *
                  </label>
                  <select
                    id="patient-form-gender"
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as Gender })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 font-medium"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phone Number *
                  </label>
                  <input
                    id="patient-form-phone"
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="9092919432"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    id="patient-form-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="patient@gmail.com"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Address
                </label>
                <input
                  id="patient-form-address"
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g. Villianur Main Road, Puducherry 605110"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Doctor Notes & Special Observations
                </label>
                <textarea
                  id="patient-form-notes"
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g., Computer worker, astigmatism history..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 font-medium"
                ></textarea>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddDrawerOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                >
                  Cancel
                </button>
                <button
                  id="save-patient-submit-btn"
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl shadow-md transition-all"
                >
                  {isSubmitting ? 'Saving...' : editingPatient ? 'Save Changes' : 'Register Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      <ConfirmModal
        isOpen={Boolean(deletingPatientId)}
        title="Delete Patient Record?"
        message="Are you sure you want to delete this patient record? This action cannot be undone."
        confirmLabel="Delete Patient"
        variant="danger"
        onConfirm={() => {
          if (deletingPatientId) deletePatient(deletingPatientId);
        }}
        onCancel={() => setDeletingPatientId(null)}
      />
    </div>
  );
};
