'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePatientProfile } from '@/hooks/usePatientProfile';
import { useApp } from '@/context/AppContext';
import { formatDate } from '@/lib/formatDate';
import { motion } from 'motion/react';
import {
  User,
  Phone,
  MapPin,
  Calendar,
  IndianRupee,
  Eye,
  FileText,
  Pill,
  Glasses,
  Clock,
  Printer,
  Plus,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Trash2,
  Save,
  Check,
  BookOpen,
} from 'lucide-react';

export const PatientProfilePage: React.FC<{ id: string }> = ({ id }) => {
  const router = useRouter();
  const { data, isLoading, isError } = usePatientProfile(id);
  const { updatePatient, deleteVisit, deletePrescription, addToast } = useApp();

  const [patientNotes, setPatientNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  useEffect(() => {
    if (data?.patient) {
      setPatientNotes(data.patient.notes || '');
    }
  }, [data?.patient]);

  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-500">
        <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
        <p>Loading patient profile...</p>
      </div>
    );
  }

  if (isError || !data?.patient) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>Patient not found or error loading.</p>
        <button
          onClick={() => router.push('/')}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold"
        >
          Back to Patient List
        </button>
      </div>
    );
  }

  const { patient, visits: patientVisits, prescriptions: patientPrescriptions } = data;

  // Total / Advance / Pending, aggregated across this patient's visits — same
  // formula used on the Dashboard and Patient Database.
  const totalAmount = patientVisits.reduce((acc, v) => acc + (v.payment?.grandTotal || 0), 0);
  const advanceAmount = patientVisits.reduce((acc, v) => acc + (v.payment?.advance || 0), 0);
  const pendingAmount = Math.max(0, totalAmount - advanceAmount);

  // Every medicine dispensed across this patient's visits.
  const medicinePurchases = patientVisits.flatMap((v) =>
    v.medicines.map((m) => ({
      ...m,
      date: v.date,
      visitId: v.id,
      invoiceNumber: v.payment?.invoiceNumber,
    }))
  );

  const handleDeleteVisit = (visitId: string) => {
    if (window.confirm('Are you sure you want to delete this visit?')) {
      deleteVisit(visitId);
    }
  };

  const handleDeletePrescription = (prescriptionId: string) => {
    if (window.confirm('Are you sure you want to delete this prescription?')) {
      deletePrescription(prescriptionId);
    }
  };

  const handleSaveNotes = () => {
    setIsSavingNotes(true);
    updatePatient(patient.id, { notes: patientNotes });
    setTimeout(() => {
      setIsSavingNotes(false);
      addToast('Notes Saved', `Updated clinical notes for ${patient.name}`);
    }, 300);
  };

  return (
    <div id="patient-profile-page" className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Breadcrumb & Action Bar */}
      <div className="flex items-center justify-between gap-4">
        <button
          id="back-to-patients-btn"
          onClick={() => router.back()}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700/80 rounded-xl transition-all active:scale-95 shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            id="view-ledger-for-patient-btn"
            onClick={() => router.push(`/ledger?patientId=${patient.id}`)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs sm:text-sm border border-slate-200/80 dark:border-slate-700/80 shadow-2xs transition-all active:scale-95"
          >
            <BookOpen className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span>View Ledger</span>
          </button>
          <button
            id="start-visit-for-patient-btn"
            onClick={() => router.push(`/visit/new?patientId=${patient.id}`)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Start New Visit For {patient.name.split(' ')[0]}</span>
          </button>
        </div>
      </div>

      {/* PATIENT PERSONAL INFO BANNER */}
      <div className="p-6 bg-white dark:bg-slate-800/90 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
              {patient.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {patient.name}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-mono text-xs font-bold border border-indigo-200 dark:border-indigo-800">
                  {patient.displayId}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                {patient.age} years old • {patient.gender} • Registered:{' '}
                {formatDate(patient.createdDate)}
              </p>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1 font-medium">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {patient.phone}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {patient.address}
                </span>
              </div>
            </div>
          </div>

          {/* Total / Advance / Pending Summary */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-right">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Total
              </span>
              <div className="text-lg font-black mt-0.5 text-slate-900 dark:text-white">
                ₹{totalAmount.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-right">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Advance
              </span>
              <div className="text-lg font-black mt-0.5 text-slate-900 dark:text-white">
                ₹{advanceAmount.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-right">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Pending
              </span>
              <div
                className={`text-2xl font-black mt-1 ${
                  pendingAmount > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                ₹{pendingAmount.toLocaleString('en-IN')}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {pendingAmount > 0 ? 'Pending Payment Due' : 'Account Fully Paid'}
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* EYE TEST HISTORY (VISION COMPARISON TABLE) */}
      <div className="p-6 bg-white dark:bg-slate-800/80 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <Eye className="w-5 h-5 text-indigo-600" />
          Computerized Eye Examination History (Refraction Matrix)
        </h3>

        {patientVisits.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-4">No eye examination tests recorded yet.</p>
        ) : (
          <div className="overflow-auto max-h-[340px] scroll-smooth rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-bold">
                  <th className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-900 p-2.5 border border-slate-200 dark:border-slate-700">Date & Visit ID</th>
                  <th className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-900 p-2.5 border border-slate-200 dark:border-slate-700 text-center">Eye</th>
                  <th className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-900 p-2.5 border border-slate-200 dark:border-slate-700">SPH</th>
                  <th className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-900 p-2.5 border border-slate-200 dark:border-slate-700">CYL</th>
                  <th className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-900 p-2.5 border border-slate-200 dark:border-slate-700">AXIS</th>
                  <th className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-900 p-2.5 border border-slate-200 dark:border-slate-700">ADD</th>
                  <th className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-900 p-2.5 border border-slate-200 dark:border-slate-700">PD</th>
                  <th className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-900 p-2.5 border border-slate-200 dark:border-slate-700">Visual Acuity</th>
                  <th className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-900 p-2.5 border border-slate-200 dark:border-slate-700">Diagnosis</th>
                </tr>
              </thead>
              <tbody>
                {patientVisits.map((v, visitIdx) => (
                  <React.Fragment key={v.id}>
                    {visitIdx > 0 && (
                      <tr aria-hidden="true">
                        <td colSpan={9} className="h-2.5 border-0 bg-transparent p-0"></td>
                      </tr>
                    )}
                    {/* Right Eye (OD) */}
                    <tr className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                      <td rowSpan={2} className="p-2.5 border border-slate-200 dark:border-slate-700 font-mono font-bold text-indigo-600 align-top">
                        {formatDate(v.date)}
                        <br />
                        <span className="text-[10px] text-slate-400 font-normal">{v.displayId}</span>
                      </td>
                      <td className="p-2 border border-slate-200 dark:border-slate-700 font-bold text-blue-600 text-center bg-blue-50/50 dark:bg-blue-950/30">
                        Right (OD)
                      </td>
                      <td className="p-2 border border-slate-200 dark:border-slate-700 font-mono">{v.visionTest?.rightEye?.sph}</td>
                      <td className="p-2 border border-slate-200 dark:border-slate-700 font-mono">{v.visionTest?.rightEye?.cyl}</td>
                      <td className="p-2 border border-slate-200 dark:border-slate-700 font-mono">{v.visionTest?.rightEye?.axis}&deg;</td>
                      <td className="p-2 border border-slate-200 dark:border-slate-700 font-mono">{v.visionTest?.rightEye?.add}</td>
                      <td className="p-2 border border-slate-200 dark:border-slate-700 font-mono">{v.visionTest?.rightEye?.pd} mm</td>
                      <td className="p-2 border border-slate-200 dark:border-slate-700 font-bold">{v.visionTest?.rightEye?.va}</td>
                      <td rowSpan={2} className="p-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 align-top">
                        {v.diagnosis}
                      </td>
                    </tr>
                    {/* Left Eye (OS) */}
                    <tr className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                      <td className="p-2 border border-slate-200 dark:border-slate-700 font-bold text-emerald-600 text-center bg-emerald-50/50 dark:bg-emerald-950/30">
                        Left (OS)
                      </td>
                      <td className="p-2 border border-slate-200 dark:border-slate-700 font-mono">{v.visionTest?.leftEye?.sph}</td>
                      <td className="p-2 border border-slate-200 dark:border-slate-700 font-mono">{v.visionTest?.leftEye?.cyl}</td>
                      <td className="p-2 border border-slate-200 dark:border-slate-700 font-mono">{v.visionTest?.leftEye?.axis}&deg;</td>
                      <td className="p-2 border border-slate-200 dark:border-slate-700 font-mono">{v.visionTest?.leftEye?.add}</td>
                      <td className="p-2 border border-slate-200 dark:border-slate-700 font-mono">{v.visionTest?.leftEye?.pd} mm</td>
                      <td className="p-2 border border-slate-200 dark:border-slate-700 font-bold">{v.visionTest?.leftEye?.va}</td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* VISIT TIMELINE & PRESCRIPTION HISTORY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Visit Timeline */}
        <div className="p-6 bg-white dark:bg-slate-800/80 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            Visit Timeline
          </h3>

          <div className="relative pl-6 space-y-6 max-h-[480px] overflow-y-auto scroll-smooth pr-1 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
            {patientVisits.map((v) => (
              <div key={v.id} className="relative group">
                <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-indigo-600 border-2 border-white dark:border-slate-800 shadow-xs"></div>
                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs font-mono text-indigo-600">{v.displayId}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">{formatDate(v.date)}</span>
                      <button
                        onClick={() => handleDeleteVisit(v.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title="Delete Visit"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">
                    Complaint: {v.chiefComplaint}
                  </p>
                  <p className="text-xs text-slate-500">
                    Diagnosis: {v.diagnosis}
                  </p>
                  <div className="pt-2 flex items-center justify-between border-t border-slate-200/60 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Total: ₹{v.payment?.grandTotal || 0}
                    </span>
                    <button
                      onClick={() => router.push(`/visit/${v.id}`)}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      View Visit Details &rarr;
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Prescription & Order History */}
        <div className="p-6 bg-white dark:bg-slate-800/80 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600" />
            Prescription & Order History
          </h3>

          <div className="space-y-3 max-h-[480px] overflow-y-auto scroll-smooth pr-1">
            {patientPrescriptions.map((rx, idx) => (
              <motion.div
                key={rx.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.1 }}
                className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs font-mono text-emerald-600">{rx.displayId}</span>
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded font-semibold">
                      Printed {rx.printedCount}x
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{formatDate(rx.date)}</span>
                    <button
                      onClick={() => handleDeletePrescription(rx.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      title="Delete Prescription"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {rx.frame && (
                  <div className="text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Glasses className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Frame: {rx.frame.brand} {rx.frame.frameName}</span>
                  </div>
                )}

                {rx.readingGlass && (
                  <div className="text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Glasses className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Reading Glass ({rx.readingGlass.variant}): {rx.readingGlass.brand} {rx.readingGlass.productName}</span>
                  </div>
                )}

                {rx.solution && (
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    Solution: {rx.solution.brand} {rx.solution.product} ({rx.solution.packSize})
                  </div>
                )}

                {rx.lens && (
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    Lens: {rx.lens.brand} {rx.lens.productName} ({rx.lens.lensType})
                  </div>
                )}

                {rx.contactLens && (
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    Contact Lens: {rx.contactLens.brand} {rx.contactLens.productName} ({rx.contactLens.power})
                  </div>
                )}

                <div className="pt-2 flex items-center justify-between border-t border-slate-200/60 dark:border-slate-800">
                  <span className="text-xs text-slate-500">
                    Inv #: {rx.payment?.invoiceNumber || 'N/A'}
                  </span>
                  <button
                    onClick={() => router.push(`/prescription/${rx.id}`)}
                    className="flex items-center gap-1 px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-semibold shadow-xs transition-transform active:scale-95"
                  >
                    <Printer className="w-3 h-3" />
                    <span>Print Rx</span>
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* MEDICINE PURCHASES */}
      <div className="p-6 bg-white dark:bg-slate-800/80 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <Pill className="w-5 h-5 text-indigo-600" />
          Medicine Purchases
        </h3>

        {medicinePurchases.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-4">No medicine purchases recorded.</p>
        ) : (
          <div className="space-y-3">
            {medicinePurchases.map((m, idx) => (
              <div
                key={idx}
                className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Pill className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{m.medicineName}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Dosage: {m.morning}-{m.afternoon}-{m.night} for {m.days} days ({m.instructions})
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-1">
                    Date: {formatDate(m.date)} • Inv #: {m.invoiceNumber || 'N/A'}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-bold text-slate-900 dark:text-white font-mono">
                    ₹{m.totalPrice || m.unitPrice * m.totalQty}
                  </div>
                  <span className="text-[10px] text-slate-400">{m.totalQty} Units</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* NOTES */}
      <div className="p-6 bg-white dark:bg-slate-800/80 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs space-y-3">
        <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <FileText className="w-5 h-5 text-amber-600" />
          Patient Medical & Clinical Notes
        </h3>
        <textarea
          id="profile-patient-notes-textarea"
          rows={5}
          value={patientNotes}
          onChange={(e) => setPatientNotes(e.target.value)}
          placeholder="Type allergy details, vision observations, lens wear preferences..."
          className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500 font-medium"
        ></textarea>
        <div className="flex justify-end">
          <button
            id="save-profile-notes-btn"
            onClick={handleSaveNotes}
            disabled={isSavingNotes}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs shadow-md transition-all active:scale-95"
          >
            {isSavingNotes ? <Check className="w-4 h-4 animate-bounce" /> : <Save className="w-4 h-4" />}
            <span>{isSavingNotes ? 'Saving...' : 'Save Notes'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

