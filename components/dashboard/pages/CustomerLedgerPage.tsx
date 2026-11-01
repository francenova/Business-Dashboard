'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { usePatientProfile } from '@/hooks/usePatientProfile';
import { useCustomerSearch, computeCustomerLedger } from '@/hooks/useCustomerLedger';
import { generateLedgerPDF } from '@/lib/ledgerPdf';
import { formatDate } from '@/lib/formatDate';
import { motion } from 'motion/react';
import {
  BookOpen,
  Search,
  Printer,
  Download,
  Loader2,
  AlertTriangle,
  Inbox,
  UserRound,
  Phone,
  MapPin,
  X,
} from 'lucide-react';

type DateFilter = 'all' | 'today' | 'month' | 'custom';

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

const money = (n?: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

export const CustomerLedgerPage: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { settings, addToast } = useApp();

  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(searchParams.get('patientId'));
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: searchResults, isLoading: isSearching } = useCustomerSearch(search);

  const { data: profile, isLoading: isProfileLoading, isError: isProfileError, error: profileError } = usePatientProfile(selectedPatientId || '');

  const todayStr = toDateStr(new Date());
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customFrom, setCustomFrom] = useState(todayStr);
  const [customTo, setCustomTo] = useState(todayStr);

  const { dateFrom, dateTo } = useMemo(() => {
    if (dateFilter === 'all') return { dateFrom: undefined, dateTo: undefined };
    if (dateFilter === 'today') return { dateFrom: todayStr, dateTo: todayStr };
    if (dateFilter === 'month') return { dateFrom: todayStr.slice(0, 7) + '-01', dateTo: todayStr };
    return { dateFrom: customFrom, dateTo: customTo };
  }, [dateFilter, customFrom, customTo, todayStr]);

  const ledger = useMemo(() => {
    if (!profile) return null;
    return computeCustomerLedger(profile.prescriptions, { dateFrom, dateTo });
  }, [profile, dateFrom, dateTo]);

  const [exportBusy, setExportBusy] = useState<'print' | 'pdf' | null>(null);

  const periodLabel =
    dateFilter === 'all' ? 'All Transactions' :
    dateFilter === 'today' ? formatDate(todayStr) :
    dateFilter === 'month' ? new Date(todayStr).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) :
    `${formatDate(customFrom)} – ${formatDate(customTo)}`;

  const handleSelectCustomer = (id: string) => {
    setSelectedPatientId(id);
    setSearchInput('');
    setSearch('');
    router.replace(`/ledger?patientId=${id}`);
  };

  const handleChangeCustomer = () => {
    setSelectedPatientId(null);
    router.replace('/ledger');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!profile || !ledger) return;
    setExportBusy('pdf');
    try {
      await generateLedgerPDF(ledger, {
        settings,
        patient: profile.patient,
        periodLabel,
      });
      addToast('PDF Downloaded', 'Customer ledger statement saved successfully!', 'success');
    } catch (err) {
      console.error('Ledger PDF error:', err);
      addToast('PDF Failed', 'Could not generate the ledger PDF.', 'error');
    } finally {
      setExportBusy(null);
    }
  };

  return (
    <motion.div
      id="ledger-page"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="p-4 lg:p-8 space-y-6 max-w-6xl mx-auto font-sans"
    >
      {/* HEADER */}
      <div className="print:hidden backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-teal-600 via-cyan-500 to-blue-500 text-white rounded-2xl shadow-md shadow-cyan-500/20">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Customer Ledger</h1>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Financial history per patient — invoices and payments</p>
          </div>
        </div>

        {!selectedPatientId && (
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              autoFocus
              placeholder="Search by name, phone, or patient ID..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
            {search.trim().length >= 2 && (
              <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-h-72 overflow-y-auto">
                {isSearching ? (
                  <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching...
                  </div>
                ) : !searchResults || searchResults.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">No matching patients found.</div>
                ) : (
                  searchResults.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectCustomer(p.id)}
                      className="w-full text-left px-4 py-2.5 hover:bg-teal-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{p.name}</p>
                        <p className="text-[11px] text-slate-400">{p.phone}</p>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-teal-600 dark:text-teal-400">{p.displayId}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {!selectedPatientId ? (
        <div className="print:hidden flex flex-col items-center justify-center gap-3 py-24 text-center">
          <UserRound className="w-12 h-12 text-slate-300 dark:text-slate-700" />
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Select a customer to view their ledger.</p>
        </div>
      ) : isProfileLoading ? (
        <div className="print:hidden flex items-center justify-center gap-3 py-24">
          <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
        </div>
      ) : isProfileError || !profile ? (
        <div className="print:hidden flex flex-col items-center justify-center gap-3 py-24 text-center">
          <AlertTriangle className="w-10 h-10 text-rose-500" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Unable to load ledger</p>
          <p className="text-xs text-slate-500 max-w-sm">{profileError instanceof Error ? profileError.message : 'An unexpected error occurred.'}</p>
          <button onClick={() => window.location.reload()} className="mt-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold">Retry</button>
        </div>
      ) : (
        <>
          {/* CUSTOMER INFO + CONTROLS */}
          <div className="print:hidden backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black text-slate-900 dark:text-white">{profile.patient.name}</h2>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 rounded-full">
                    {profile.patient.displayId}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {profile.patient.phone}</span>
                  {profile.patient.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {profile.patient.address}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleChangeCustomer} className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all active:scale-95">
                  <X className="w-3.5 h-3.5" /> Change Customer
                </button>
                <button onClick={handlePrint} className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all active:scale-95">
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
                <button onClick={handleDownloadPDF} disabled={exportBusy !== null} className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50">
                  {exportBusy === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} PDF
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(['all', 'today', 'month', 'custom'] as DateFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setDateFilter(f)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                    dateFilter === f ? 'bg-teal-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {f}
                </button>
              ))}
              {dateFilter === 'custom' && (
                <div className="flex items-center gap-2">
                  <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-teal-500" />
                  <span className="text-xs text-slate-400 font-bold">to</span>
                  <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-teal-500" />
                </div>
              )}
            </div>
          </div>

          {ledger && (
            <>
              {/* SUMMARY CARDS */}
              <div className="print:hidden grid grid-cols-2 lg:grid-cols-3 gap-3.5">
                <div className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
                  <span className="text-xs font-semibold text-slate-500">Total Billed</span>
                  <div className="mt-2 text-xl font-black text-slate-900 dark:text-white">{money(ledger.totalBilled)}</div>
                </div>
                <div className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
                  <span className="text-xs font-semibold text-slate-500">Total Paid</span>
                  <div className="mt-2 text-xl font-black text-emerald-600 dark:text-emerald-400">{money(ledger.totalPaid)}</div>
                </div>
                <div className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
                  <span className="text-xs font-semibold text-slate-500">Pending</span>
                  <div className="mt-2 text-xl font-black text-rose-600 dark:text-rose-400">{money(ledger.totalPending)}</div>
                </div>
              </div>

              {/* LEDGER TABLE */}
              <div className="print:hidden p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-4">
                {ledger.transactions.length === 0 && ledger.openingBalance === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                    <Inbox className="w-10 h-10 text-slate-300 dark:text-slate-700" />
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No transactions found for this customer.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100/90 dark:bg-slate-950/90 text-slate-600 dark:text-slate-400 uppercase font-black tracking-wider border-b border-slate-200/80 dark:border-slate-800/80">
                          <th className="p-3">Date</th>
                          <th className="p-3">Type</th>
                          <th className="p-3">Reference</th>
                          <th className="p-3">Description</th>
                          <th className="p-3 text-right">Debit</th>
                          <th className="p-3 text-right">Credit</th>
                          <th className="p-3 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                        {dateFilter !== 'all' && (
                          <tr className="bg-slate-50 dark:bg-slate-950/40 font-bold">
                            <td className="p-3 text-slate-500" colSpan={6}>Opening Balance / Brought Forward</td>
                            <td className="p-3 text-right font-mono">{money(ledger.openingBalance)}</td>
                          </tr>
                        )}
                        {ledger.transactions.map((t, idx) => (
                          <tr
                            key={idx}
                            onClick={() => router.push(`/prescription/${t.prescriptionId}`)}
                            className="hover:bg-teal-50/40 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                          >
                            <td className="p-3 text-slate-600 dark:text-slate-300 font-semibold">{formatDate(t.date)}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                                t.type === 'Invoice'
                                  ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-900'
                                  : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-900'
                              }`}>
                                {t.type}
                              </span>
                            </td>
                            <td className="p-3 font-mono font-black text-teal-600 dark:text-teal-400">{t.reference}</td>
                            <td className="p-3 text-slate-600 dark:text-slate-300">{t.description}</td>
                            <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-100">{t.debit > 0 ? money(t.debit) : '—'}</td>
                            <td className="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400">{t.credit > 0 ? money(t.credit) : '—'}</td>
                            <td className="p-3 text-right font-mono font-black text-slate-900 dark:text-white">{money(t.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100/90 dark:bg-slate-950/90 font-black text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-700">
                          <td className="p-3" colSpan={4}>Closing Balance</td>
                          <td className="p-3 text-right font-mono">{money(ledger.periodDebit)}</td>
                          <td className="p-3 text-right font-mono">{money(ledger.periodCredit)}</td>
                          <td className="p-3 text-right font-mono">{money(ledger.closingBalance)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* PRINTABLE STATEMENT */}
              <div id="printable-ledger" className="hidden print:block">
                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3 mb-4">
                  <div className="flex items-center gap-3">
                    {settings.showLogoOnDocuments && settings.logoUrl && (
                      <img src={settings.logoUrl} alt={settings.clinicName} className="w-12 h-12 object-contain shrink-0" />
                    )}
                    <div>
                      <h2 className="text-xl font-black">{settings.clinicName || 'Royal Opticals'}</h2>
                      <p className="text-xs text-slate-600 mt-0.5">{[settings.address, settings.phone, settings.email].filter(Boolean).join('  •  ')}</p>
                      {settings.gstin && <p className="text-xs text-slate-600">GSTIN: {settings.gstin}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <h3 className="text-base font-black tracking-wide">CUSTOMER LEDGER STATEMENT</h3>
                    <p className="text-xs text-slate-600 mt-0.5">Customer: {profile.patient.name} ({profile.patient.displayId})</p>
                    <p className="text-xs text-slate-600">Period: {periodLabel}</p>
                  </div>
                </div>

                <table className="w-full text-[10px] border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white">
                      <th className="p-1.5 text-left">Date</th>
                      <th className="p-1.5 text-left">Type</th>
                      <th className="p-1.5 text-left">Reference</th>
                      <th className="p-1.5 text-left">Description</th>
                      <th className="p-1.5 text-right">Debit</th>
                      <th className="p-1.5 text-right">Credit</th>
                      <th className="p-1.5 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dateFilter !== 'all' && (
                      <tr className="border-b border-slate-300 font-bold">
                        <td className="p-1.5" colSpan={6}>Opening Balance / Brought Forward</td>
                        <td className="p-1.5 text-right">{money(ledger.openingBalance)}</td>
                      </tr>
                    )}
                    {ledger.transactions.length === 0 ? (
                      <tr><td colSpan={7} className="p-4 text-center text-slate-500 italic">No transactions found for this customer.</td></tr>
                    ) : (
                      ledger.transactions.map((t, idx) => (
                        <tr key={idx} className="border-b border-slate-200">
                          <td className="p-1.5">{formatDate(t.date)}</td>
                          <td className="p-1.5">{t.type}</td>
                          <td className="p-1.5 font-mono">{t.reference}</td>
                          <td className="p-1.5">{t.description}</td>
                          <td className="p-1.5 text-right">{t.debit > 0 ? money(t.debit) : '—'}</td>
                          <td className="p-1.5 text-right">{t.credit > 0 ? money(t.credit) : '—'}</td>
                          <td className="p-1.5 text-right">{money(t.balance)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                <div className="mt-4 border-2 border-slate-900 p-3 break-inside-avoid">
                  <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
                    <div><p className="text-slate-500">Opening Balance</p><p className="font-black text-sm mt-0.5">{money(ledger.openingBalance)}</p></div>
                    <div><p className="text-slate-500">Total Debit</p><p className="font-black text-sm mt-0.5">{money(ledger.periodDebit)}</p></div>
                    <div><p className="text-slate-500">Total Credit</p><p className="font-black text-sm mt-0.5">{money(ledger.periodCredit)}</p></div>
                    <div><p className="text-slate-500">Closing Balance</p><p className="font-black text-sm mt-0.5">{money(ledger.closingBalance)}</p></div>
                  </div>
                </div>

                <div className="mt-4 pt-2 border-t border-slate-300 flex items-center justify-between text-[9px] text-slate-500">
                  <span>{settings.clinicName || 'Royal Opticals'}</span>
                  <span>Customer Ledger Statement</span>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </motion.div>
  );
};
