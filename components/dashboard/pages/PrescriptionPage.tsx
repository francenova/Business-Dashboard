'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePrescription } from '@/hooks/usePrescription';
import {
  Printer,
  Download,
  FileSpreadsheet,
  ArrowLeft,
  RotateCcw,
  FileText,
  UserRound,
} from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';
import { formatDate } from '@/lib/formatDate';

export const PrescriptionPage: React.FC<{ id?: string }> = ({ id }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoActionRef = useRef<string | null>(null);
  const {
    patients,
    prescriptions,
    settings,
    addToast,
  } = useApp();

  const printRef = useRef<HTMLDivElement>(null);

  const { data: activeRecord } = usePrescription(id || '');

  // Selected mode: 'blank' or specific prescription id
  const [activePrescriptionId, setActivePrescriptionId] = useState<string>(
    id || 'blank'
  );

  // Basic fillable patient fields
  const todayStr = new Date().toISOString().split('T')[0];
  const [patientName, setPatientName] = useState<string>('');
  const [patientAge, setPatientAge] = useState<string>('');
  const [patientGender, setPatientGender] = useState<string>('Male');
  const [patientAddress, setPatientAddress] = useState<string>('');
  const [patientPhone, setPatientPhone] = useState<string>('');
  const [date, setDate] = useState<string>(todayStr);
  const [dueDate, setDueDate] = useState<string>(todayStr);
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Sync state whenever active prescription selection changes
  useEffect(() => {
    if (activeRecord) {
      // Fallback: if patient details are not on the prescription record, look up from patients list
      const fallbackPatient = patients.find(p => p.id === activeRecord.patientId);
      
      setPatientName(activeRecord.patientName || fallbackPatient?.name || '');
      setPatientAge(activeRecord.patientAge ? String(activeRecord.patientAge) : fallbackPatient?.age ? String(fallbackPatient.age) : '');
      setPatientGender(activeRecord.patientGender || fallbackPatient?.gender || 'Male');
      setPatientAddress(activeRecord.patientAddress || fallbackPatient?.address || '');
      setPatientPhone(activeRecord.patientPhone || fallbackPatient?.phone || '');
      
      setDate(todayStr);
      setDueDate(todayStr);
      setInvoiceNumber(activeRecord.payment?.invoiceNumber || activeRecord.id);
    } else if (activePrescriptionId === 'blank') {
      // Default blank mode
      setPatientName('');
      setPatientAge('');
      setPatientGender('Male');
      setPatientAddress('');
      setPatientPhone('');
      setDate(todayStr);
      setDueDate(todayStr);
      // Sequential, DB-atomic invoice number — same shared source used by the
      // Visit-creation flow, so the two can never collide.
      setInvoiceNumber('Generating...');
      apiFetch<{ invoiceNumber: string }>('/api/next-invoice-number', { method: 'POST' })
        .then(({ invoiceNumber }) => setInvoiceNumber(invoiceNumber))
        .catch((error: Error) => {
          addToast('Error', `Could not generate an invoice number: ${error.message}`, 'error');
          setInvoiceNumber('');
        });
    }
  }, [activePrescriptionId, activeRecord, todayStr]);

  // Determine if full visit details exist for this selection
  const hasVisitDetails = Boolean(activeRecord);

  // Reset to default blank prescription order form
  const handleResetToBlank = () => {
    setActivePrescriptionId('blank');
    setPatientName('');
    setPatientAge('');
    setPatientGender('Male');
    setPatientAddress('');
    setPatientPhone('');
    setDate(todayStr);
    setDueDate(todayStr);
    setInvoiceNumber('Generating...');
    apiFetch<{ invoiceNumber: string }>('/api/next-invoice-number', { method: 'POST' })
      .then(({ invoiceNumber }) => setInvoiceNumber(invoiceNumber))
      .catch((error: Error) => {
        addToast('Error', `Could not generate an invoice number: ${error.message}`, 'error');
        setInvoiceNumber('');
      });
    addToast('Blank Template', 'Loaded blank prescription order form template.', 'info');
  };

  // PRINT ACTION (Print Prescription & Order Form)
  const handlePrint = () => {
    window.print();
    addToast('Print Job Sent', 'Sent prescription order form to printer.', 'success');
  };

  // DOWNLOAD PDF ACTION
  // Screenshots the actual printable DOM (the same content the Print
  // button sends to the browser) into the PDF, rather than a separate
  // hand-drawn reimplementation — guaranteed to always match the print
  // page exactly, since it IS the print page, with no duplicate layout
  // code that can drift out of sync as the print page's design changes.
  const handleDownloadPDF = async () => {
    try {
      addToast('Generating PDF...', 'Preparing your prescription PDF file.');

      const { generatePdfFromElements } = await import('@/lib/domToPdf');
      const safeName = patientName.trim() ? patientName.trim().replace(/\s+/g, '_') : 'Blank';
      await generatePdfFromElements(
        ['printable-prescription-document', 'printable-prescription-medicines-page'],
        `Prescription_Order_${safeName}_${invoiceNumber || 'Rx'}.pdf`
      );

      addToast('PDF Downloaded', 'Prescription PDF saved successfully!', 'success');
    } catch (error) {
      console.error('PDF export error:', error);
      addToast('PDF Failed', 'Could not generate the PDF. Opening print preview.', 'error');
      window.print();
    }
  };

  // Optional one-click Print/Download from Prescription Management's list
  // rows (?action=print|download) — purely additive: absent param means no
  // change from today's behavior, and it fires at most once per page load
  // once the real record has finished loading.
  useEffect(() => {
    const action = searchParams.get('action');
    if (!action || autoActionRef.current === action || !activeRecord) return;
    autoActionRef.current = action;
    if (action === 'print') handlePrint();
    else if (action === 'download') handleDownloadPDF();
  }, [searchParams, activeRecord]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let pId = activeRecord?.patientId;
      if (!pId && patientName) {
         const p = patients.find(pat => pat.name.toLowerCase() === patientName.toLowerCase() || pat.phone === patientPhone);
         pId = p?.id;
      }

      const rxData = {
        patient_id: pId || null,
        visit_id: activeRecord?.visitId || null,
        date: date || todayStr,
        payment: { ...(activeRecord?.payment || {}), invoiceNumber },
      };

      if (activeRecord) {
        await apiFetch(`/api/prescriptions/${activeRecord.id}`, { method: 'PATCH', body: JSON.stringify(rxData) });
      } else if (pId) {
        await apiFetch('/api/prescriptions', { method: 'POST', body: JSON.stringify(rxData) });
      } else {
        addToast('Warning', 'Patient not found in database. Printed copy only.', 'warning');
      }
      addToast('Success', 'Prescription saved successfully.', 'success');
    } catch (e) {
      addToast('Error', 'Failed to save prescription.', 'error');
    }
    setIsSaving(false);
  };

  // EXPORT EXCEL ACTION
  const handleExportExcel = async () => {
    try {
      const isRecord = hasVisitDetails && activeRecord;
      const payment = isRecord ? activeRecord.payment : null;
      const vision = isRecord ? activeRecord.visionTest : null;

      const excelRows = [
        [`${(settings.clinicName || 'VisionCare Eye Clinic').toUpperCase()} - PRESCRIPTION ORDER FORM`],
        [settings.credentials || settings.doctorTitle || 'Computerized Eye Testing & Contact Lens Clinic'],
        [''],
        ['PATIENT BASIC INFORMATION'],
        ['Name', patientName || '-'],
        ['Age / Gender', patientAge ? `${patientAge} Yrs (${patientGender})` : '-'],
        ['Address', patientAddress || '-'],
        ['Phone', patientPhone || '-'],
        ['Date', date || '-'],
        ['Due Date', dueDate || '-'],
        ['Order / Invoice No', invoiceNumber || '-'],
        [''],
        ['DESCRIPTION & BILLING DETAILS'],
        ['Item Description', 'Amount (INR)'],
        ...(isRecord && activeRecord.frame
          ? [[`Frame: ${activeRecord.frame.brand} ${activeRecord.frame.frameName} (${activeRecord.frame.code})`, activeRecord.frame.finalAmount || activeRecord.frame.price]]
          : []),
        ...(isRecord && activeRecord.readingGlass
          ? [[`Reading Glass (${activeRecord.readingGlass.variant}): ${activeRecord.readingGlass.brand} ${activeRecord.readingGlass.productName} (${activeRecord.readingGlass.readingPower})`, activeRecord.readingGlass.finalAmount || activeRecord.readingGlass.price]]
          : []),
        ...(isRecord && activeRecord.lens
          ? [[`Lens: ${activeRecord.lens.brand} ${activeRecord.lens.productName || ''} (${activeRecord.lens.lensType})`.replace(/\s+/g, ' ').trim(), activeRecord.lens.price]]
          : []),
        ...(isRecord && activeRecord.contactLens
          ? [[`Contact Lens: ${activeRecord.contactLens.brand} ${activeRecord.contactLens.productName || ''} (${activeRecord.contactLens.power})`.replace(/\s+/g, ' ').trim(), activeRecord.contactLens.totalPrice || activeRecord.contactLens.unitPrice]]
          : []),
        ...(isRecord && activeRecord.solution
          ? [[`Solution: ${activeRecord.solution.brand} ${activeRecord.solution.product} (${activeRecord.solution.packSize} x${activeRecord.solution.quantity})`, activeRecord.solution.finalAmount || activeRecord.solution.price * activeRecord.solution.quantity]]
          : []),
        ...(isRecord && payment && payment.consultationFee > 0
          ? [['Computerized Vision Exam & Consultation', payment.consultationFee]]
          : []),
        ...(isRecord && activeRecord.medicines && activeRecord.medicines.length > 0
          ? [[`Prescribed Medicines (${activeRecord.medicines.length} items)`, payment?.medicineTotal || 0]]
          : []),
        ...(!isRecord ? [['Description', '-'], ['Amount', '-']] : []),
        ['TOTAL', isRecord && payment ? payment.grandTotal : '-'],
        ['ADVANCE', isRecord && payment ? payment.advance : '-'],
        ['BALANCE', isRecord && payment ? payment.balance : '-'],
        [''],
        ['REFRACTION POWER GRID'],
        ['Eye', 'Vision Type', 'SPH', 'CYL', 'AXIS'],
        ['Right Eye (RE / OD)', 'Distance (D.V)', vision?.rightEye?.sph || '-', vision?.rightEye?.cyl || '-', vision?.rightEye?.axis ? `${vision.rightEye.axis}°` : '-'],
        ['Right Eye (RE / OD)', 'Near (N.V / ADD)', vision?.rightEye?.add || '-', vision?.rightEye?.nearCyl || '-', vision?.rightEye?.nearAxis ? `${vision.rightEye.nearAxis}°` : '-'],
        ['Left Eye (LE / OS)', 'Distance (D.V)', vision?.leftEye?.sph || '-', vision?.leftEye?.cyl || '-', vision?.leftEye?.axis ? `${vision.leftEye.axis}°` : '-'],
        ['Left Eye (LE / OS)', 'Near (N.V / ADD)', vision?.leftEye?.add || '-', vision?.leftEye?.nearCyl || '-', vision?.leftEye?.nearAxis ? `${vision.leftEye.nearAxis}°` : '-'],
        [''],
        ['INTRAOCULAR PRESSURE (IOP)'],
        ['OD (Right Eye)', vision?.iopRight ? `${vision.iopRight} mmHg` : '-'],
        ['OS (Left Eye)', vision?.iopLeft ? `${vision.iopLeft} mmHg` : '-'],
        [''],
        ['Doctor Notes', vision?.notes || '-'],
      ];

      // Dynamically import xlsx to keep initial bundle small
      const XLSX = await import('xlsx');
      const worksheet = XLSX.utils.aoa_to_sheet(excelRows);
      worksheet['!cols'] = [
        { wch: 35 },
        { wch: 25 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Prescription Order');

      const safeName = patientName.trim() ? patientName.trim().replace(/\s+/g, '_') : 'Blank';
      const fileName = `Prescription_Order_${safeName}_${invoiceNumber || 'Rx'}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      addToast('Excel Exported', `Saved successfully as ${fileName}`, 'success');
    } catch (err) {
      console.error('Excel Export error:', err);
      addToast('Export Failed', 'Could not export Excel file.', 'error');
    }
  };

  const isSelectedLensType = (type: string) =>
    activeRecord?.lens?.lensType?.toLowerCase().includes(type.toLowerCase());

  return (
    <div id="prescription-page" className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
      {/* TOP CONTROLS & RECORD SELECTOR BAR (Hidden during printing) */}
      <div className="print:hidden flex flex-wrap items-center justify-between gap-4 p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
        {/* Back Button & Visit Record Selector */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            id="rx-back-to-visits-btn"
            onClick={() => router.back()}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700/80 rounded-xl transition-all active:scale-95 shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Back</span>
          </button>

          {/* Desktop Only Actions */}
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2"
            >
              {isSaving ? 'Saving...' : 'Save Rx'}
            </button>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 hidden sm:inline">
              Source:
            </span>
            <select
              id="prescription-source-select"
              value={activePrescriptionId}
              onChange={(e) => {
                setActivePrescriptionId(e.target.value);
                if (e.target.value !== 'blank') {
                  router.push(`/prescription/${e.target.value}`);
                }
              }}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="blank">📄 Default Blank Prescription Form</option>
              {activePrescriptionId !== 'blank' && !activeRecord && (
                <option value={activePrescriptionId}>⏳ Loading prescription...</option>
              )}
              {/* Only display the latest 10 prescriptions to prevent the dropdown from getting too large */}
              {prescriptions.slice(0, 10).map((p) => (
                <option key={p.id} value={p.id}>
                  👤 Visited: {p.patientName} ({formatDate(p.date)}) - {p.id}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons: Print, Download PDF, Export Excel, Reset */}
        <div className="flex flex-wrap items-center gap-2">
          {activePrescriptionId !== 'blank' && (
            <button
              id="reset-to-blank-rx-btn"
              onClick={handleResetToBlank}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-all active:scale-95"
              title="Switch to default blank form"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Blank Form</span>
            </button>
          )}

          {activeRecord?.patientId && (
            <button
              id="view-patient-from-rx-btn"
              onClick={() => router.push(`/patients/${activeRecord.patientId}`)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-all active:scale-95"
              title="View patient profile"
            >
              <UserRound className="w-3.5 h-3.5" />
              <span>View Patient</span>
            </button>
          )}

          <button
            id="print-rx-btn"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>Print Prescription & Order Form</span>
          </button>

          <button
            id="download-rx-pdf-btn"
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF</span>
          </button>

          <button
            id="export-rx-excel-btn"
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* PRINTABLE PRESCRIPTION DOCUMENT */}
      <div
        ref={printRef}
        id="printable-prescription-document"
        className="bg-white text-blue-950 p-6 sm:p-8 rounded-xl border-2 border-blue-900 shadow-2xl space-y-0 print:border-2 print:border-blue-900 print:shadow-none print:p-3 print:m-0 font-serif"
      >
        {/* OUTER DOUBLE BORDER FRAME */}
        <div className="border border-blue-900 p-4 print:p-3 space-y-4 print:space-y-2.5">

          {/* HEADER SECTION (CLINIC DETAILS + BASIC PATIENT INPUT FIELDS) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pb-3 border-b-2 border-blue-900">
            {/* Left Header - Clinic Details */}
            <div className="md:col-span-7 space-y-1">
              <div className="flex items-center gap-3">
                {settings.showLogoOnDocuments && settings.logoUrl && (
                  <img
                    src={settings.logoUrl}
                    alt={settings.clinicName}
                    className="w-12 h-12 object-contain rounded-lg p-0.5 bg-white border border-blue-200 shrink-0"
                  />
                )}
                <div>
                  <h1 className="text-2xl sm:text-3xl print:text-2xl font-black text-blue-950 tracking-tight font-serif uppercase">
                    {settings.clinicName || 'VisionCare Eye Clinic'}
                  </h1>
                  <h2 className="text-xs sm:text-sm font-bold text-blue-900 uppercase font-sans tracking-wide">
                    {settings.credentials || settings.doctorTitle || 'Computerized Eye Testing & Contact Lens Clinic'}
                  </h2>
                </div>
              </div>
              <div className="text-[11px] leading-tight text-slate-700 font-sans space-y-0.5 pt-1">
                <p>{settings.address || 'Sector 21, Noida'}</p>
                {settings.showDoctorDetailsOnPrescription && (
                  <p>Doctor: {settings.doctorName || 'Dr. R. Kumar'} ({settings.registrationNumber || 'DMC-12345'})</p>
                )}
              </div>
              <p className="text-xs font-bold font-mono text-blue-950 pt-1">
                Phone : {settings.phone || '+91 98110 22345'} | Email: {settings.email || 'hello@visioncare.clinic'}
              </p>
            </div>

            {/* Right Header - Basic Patient Fields (Name, Age, Address, Phone, Date) */}
            <div className="md:col-span-5 text-xs font-sans space-y-2 print:space-y-1.5 border-l-0 md:border-l md:border-blue-300 md:pl-4">
              <div className="flex items-baseline gap-2">
                <span className="font-bold text-blue-950 shrink-0">Name :</span>
                <input
                  id="rx-patient-name-input"
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Enter Patient Name"
                  className="border-b border-dotted border-blue-900 flex-1 font-bold text-slate-900 px-1 outline-none bg-transparent"
                />
              </div>

              <div className="flex items-baseline gap-2">
                <span className="font-bold text-blue-950 shrink-0">Age / Sex :</span>
                <div className="flex items-center gap-1 flex-1">
                  <input
                    id="rx-patient-age-input"
                    type="text"
                    value={patientAge}
                    onChange={(e) => setPatientAge(e.target.value)}
                    placeholder="Age"
                    className="border-b border-dotted border-blue-900 w-16 font-semibold text-slate-800 px-1 outline-none bg-transparent"
                  />
                  <span className="text-slate-500 font-semibold">Yrs</span>
                  <select
                    id="rx-patient-gender-select"
                    value={patientGender}
                    onChange={(e) => setPatientGender(e.target.value)}
                    className="border-b border-dotted border-blue-900 font-semibold text-slate-800 px-1 outline-none bg-transparent cursor-pointer"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {settings.showPatientContactOnPrescription && (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-blue-950 shrink-0">Address :</span>
                    <input
                      id="rx-patient-address-input"
                      type="text"
                      value={patientAddress}
                      onChange={(e) => setPatientAddress(e.target.value)}
                      placeholder="Enter Address"
                      className="border-b border-dotted border-blue-900 flex-1 text-slate-800 px-1 outline-none bg-transparent"
                    />
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-blue-950 shrink-0">Cell :</span>
                    <input
                      id="rx-patient-phone-input"
                      type="text"
                      value={patientPhone}
                      onChange={(e) => setPatientPhone(e.target.value)}
                      placeholder="Enter Phone Number"
                      className="border-b border-dotted border-blue-900 flex-1 font-mono text-slate-800 px-1 outline-none bg-transparent"
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-baseline gap-1">
                  <span className="font-bold text-blue-950 shrink-0">Date :</span>
                  <input
                    id="rx-date-input"
                    type="text"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    placeholder="DD/MM/YYYY"
                    className="border-b border-dotted border-blue-900 flex-1 text-slate-800 px-1 outline-none bg-transparent"
                  />
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-bold text-blue-950 shrink-0">Due on :</span>
                  <input
                    id="rx-due-date-input"
                    type="text"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    placeholder="DD/MM/YYYY"
                    className="border-b border-dotted border-blue-900 flex-1 text-slate-800 px-1 outline-none bg-transparent"
                  />
                </div>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="font-bold text-blue-950 shrink-0">Order Form / Invoice No :</span>
                <input
                  id="rx-invoice-no-input"
                  type="text"
                  value={invoiceNumber}
                  readOnly
                  title="Auto-generated — sequential invoice numbers can't be edited"
                  placeholder="INV-1001"
                  className="border-b border-dotted border-blue-900 flex-1 font-mono font-bold text-indigo-900 px-1 outline-none bg-transparent cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* MAIN BILLING TABLE (DESCRIPTION | AMOUNT) */}
          <div className="border-2 border-blue-900">
            <table className="w-full text-xs font-sans border-collapse">
              <thead>
                <tr className="border-b-2 border-blue-900 text-blue-950 font-black tracking-wider uppercase">
                  <th className="py-2 px-3 text-left border-r-2 border-blue-900 w-3/4">
                    DESCRIPTION
                  </th>
                  <th className="py-2 px-3 text-center w-1/4">AMOUNT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-200 text-slate-900 font-medium">
                {/* Description & Amount are deliberately left blank — Frame,
                    Reading Glass, Lens, Contact Lens, Solution, Consultation
                    Fee, and Medicines are no longer itemized here. Only
                    Total/Advance/Balance below reflect the real computed
                    amounts; the itemized purchase now prints on its own
                    Medicines page (see the print-only block further down). */}
                <tr>
                  <td className="py-12 px-3 border-r-2 border-blue-900 text-slate-400 font-sans italic text-center">
                    -
                  </td>
                  <td className="py-12 px-3 text-center text-slate-400 font-mono">
                    -
                  </td>
                </tr>
              </tbody>
            </table>

            {/* TOTAL, ADVANCE, BALANCE SECTION */}
            <div className="border-t-2 border-blue-900 bg-blue-50/50 text-xs font-sans">
              <div className="grid grid-cols-12 border-b border-blue-900">
                <div className="col-span-8 py-3 px-3 font-black text-right border-r-2 border-blue-900 text-blue-950 uppercase tracking-wider">
                  TOTAL
                </div>
                <div className="col-span-4 py-3 px-3 font-mono font-black text-right text-slate-900">
                  {hasVisitDetails && activeRecord?.payment
                    ? `₹${activeRecord.payment.grandTotal.toLocaleString('en-IN')}`
                    : '-'}
                </div>
              </div>
              <div className="grid grid-cols-12 border-b border-blue-900">
                <div className="col-span-8 py-3 px-3 font-black text-right border-r-2 border-blue-900 text-blue-950 uppercase tracking-wider">
                  ADVANCE
                </div>
                <div className="col-span-4 py-3 px-3 font-mono font-black text-right text-emerald-700">
                  {hasVisitDetails && activeRecord?.payment
                    ? `₹${activeRecord.payment.advance.toLocaleString('en-IN')}`
                    : '-'}
                </div>
              </div>
              <div className="grid grid-cols-12">
                <div className="col-span-8 py-3 px-3 font-black text-right border-r-2 border-blue-900 text-blue-950 uppercase tracking-wider">
                  BALANCE
                </div>
                <div className="col-span-4 py-3 px-3 font-mono font-black text-right text-rose-700">
                  {hasVisitDetails && activeRecord?.payment
                    ? `₹${activeRecord.payment.balance.toLocaleString('en-IN')}`
                    : '-'}
                </div>
              </div>
            </div>

            {settings.showTermsOnInvoice && settings.invoiceTermsText && (
              <div className="border-t border-blue-900 px-3 py-2 text-[10px] text-slate-600 italic">
                {settings.invoiceTermsText}
              </div>
            )}
          </div>

          {/* LENS TYPE SELECTION GRID WITH DIAGRAMS */}
          <div className="border-2 border-blue-900 text-[11px] font-sans">
            {/* Top Row Titles */}
            <div className="grid grid-cols-6 border-b border-blue-900 bg-blue-950 text-white font-black text-center uppercase tracking-tight py-1">
              <div>RX.BY.DR</div>
              <div>SINGLE VN</div>
              <div>KRYP TOK</div>
              <div>EXECUTIVE</div>
              <div>D.BIFOCAL</div>
              <div>PROGRESSIVE</div>
            </div>

            {/* Diagram Illustrations Row */}
            <div className="grid grid-cols-6 border-b border-blue-900 py-2 print:py-1.5 items-center text-center">
              {/* Rx By Dr */}
              <div className="p-1 flex justify-center">
                <div className="w-10 h-7 border border-blue-900 rounded-full flex items-center justify-center font-serif text-[10px] font-bold text-blue-950">
                  Rx
                </div>
              </div>

              {/* Single Vision */}
              <div className={`p-1 flex flex-col items-center justify-center ${isSelectedLensType('Single Vision') ? 'bg-blue-100 font-bold' : ''}`}>
                <div className="w-10 h-6 border-2 border-blue-900 rounded-full"></div>
              </div>

              {/* Kryptok */}
              <div className={`p-1 flex flex-col items-center justify-center ${isSelectedLensType('Bifocal') ? 'bg-blue-100 font-bold' : ''}`}>
                <div className="w-10 h-6 border-2 border-blue-900 rounded-full relative overflow-hidden">
                  <div className="w-5 h-5 border border-blue-900 rounded-full absolute -bottom-2 left-2.5"></div>
                </div>
              </div>

              {/* Executive */}
              <div className="p-1 flex flex-col items-center justify-center">
                <div className="w-10 h-6 border-2 border-blue-900 rounded-full relative">
                  <div className="w-full border-b border-blue-900 absolute top-3"></div>
                  <div className="text-[8px] leading-none text-slate-500 absolute top-0.5 left-1">distance</div>
                  <div className="text-[8px] leading-none text-slate-500 absolute bottom-0.5 left-3">near</div>
                </div>
              </div>

              {/* D.Bifocal */}
              <div className="p-1 flex flex-col items-center justify-center">
                <div className="w-10 h-6 border-2 border-blue-900 rounded-full relative">
                  <div className="w-4 h-3 border-t border-x border-blue-900 rounded-t-xs absolute bottom-0 left-3"></div>
                </div>
              </div>

              {/* Progressive */}
              <div className={`p-1 flex flex-col items-center justify-center ${isSelectedLensType('Progressive') ? 'bg-blue-100 font-bold' : ''}`}>
                <div className="w-10 h-6 border-2 border-blue-900 rounded-full relative border-dashed">
                  <div className="text-[7px] leading-none text-blue-950 font-bold absolute top-0.5 left-2">distance</div>
                  <div className="text-[7px] leading-none text-blue-950 font-bold absolute bottom-0.5 left-3">& near</div>
                </div>
              </div>
            </div>

            {/* Bottom Row Titles (Contact Lens Types) */}
            <div className="grid grid-cols-6 bg-blue-900 text-white font-bold text-center uppercase tracking-tight py-1">
              <div>CONTACT LENS</div>
              <div>DAILY</div>
              <div>MONTHLY</div>
              <div>YEARLY</div>
              <div>TORIC</div>
              <div>COSMETIC</div>
            </div>
          </div>

          {/* FOLLOW-UP VISIT + CUSTOMER SIGNATURE */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-2 text-[11px] font-sans items-end">
            <div className="md:col-span-6 text-center">
              <p className="font-black text-blue-950 uppercase tracking-wide text-[10px] pb-1">Follow-Up Visit</p>
              <div className="flex items-baseline justify-center gap-1.5">
                <span className="font-bold text-blue-950 shrink-0">On :</span>
                <span className="border-b border-dotted border-blue-900 flex-1 h-3"></span>
              </div>
            </div>
            <div className="md:col-span-6 text-center space-y-1">
              <div className="border-b border-blue-900 h-8"></div>
              <p className="font-bold text-blue-950">Customer signature</p>
            </div>
          </div>

          {/* REFRACTION POWER GRID AT BOTTOM (STAR PATTERN SEPARATOR + GRID) */}
          <div className="pt-2">
            {/* Decorative separator — no information, dropped from print to save vertical space */}
            <div className="print:hidden text-center text-blue-900 text-xs font-bold tracking-widest pb-2">
              ☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆
            </div>

            {/* Refraction Subheader Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-sans font-bold text-blue-950 pb-2 print:pb-1 print:pt-1">
              <div>
                No. <span className="font-mono text-slate-800">{invoiceNumber || '-'}</span>
              </div>
              <div>
                Name : <span className="text-slate-800">{patientName || '-'}</span>
              </div>
              <div>
                Lens Type :{' '}
                <span className="text-indigo-900">
                  {hasVisitDetails && activeRecord?.lens?.lensType
                    ? activeRecord.lens.lensType
                    : '-'}
                </span>
              </div>
            </div>

            {/* Refraction Table Grid (RE / LE SPH CYL AXIS D.V N.V) */}
            <div className="border-2 border-blue-900">
              <table className="w-full text-center text-xs font-sans border-collapse">
                <thead>
                  <tr className="border-b-2 border-blue-900 bg-blue-950 text-white font-black uppercase">
                    <th className="py-1.5 px-2 border-r-2 border-blue-900 w-16"></th>
                    <th colSpan={3} className="py-1.5 px-2 border-r-2 border-blue-900 text-center bg-blue-900">
                      RE (RIGHT EYE)
                    </th>
                    <th colSpan={3} className="py-1.5 px-2 text-center bg-indigo-900">
                      LE (LEFT EYE)
                    </th>
                  </tr>
                  <tr className="border-b-2 border-blue-900 bg-blue-100 text-blue-950 font-black uppercase text-[11px]">
                    <th className="py-1 px-2 border-r-2 border-blue-900">VISION</th>
                    <th className="py-1 px-2 border-r border-blue-900">SPH</th>
                    <th className="py-1 px-2 border-r border-blue-900">CYL</th>
                    <th className="py-1 px-2 border-r-2 border-blue-900">AXIS</th>
                    <th className="py-1 px-2 border-r border-blue-900">SPH</th>
                    <th className="py-1 px-2 border-r border-blue-900">CYL</th>
                    <th className="py-1 px-2">AXIS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-200 font-mono font-bold text-slate-900">
                  {/* Distance Vision Row */}
                  <tr>
                    <td className="py-2.5 print:py-2 px-2 border-r-2 border-blue-900 font-sans font-black text-blue-950 bg-blue-50">
                      D.V
                    </td>
                    <td className="py-2.5 print:py-2 px-2 border-r border-blue-900">
                      {hasVisitDetails && activeRecord?.visionTest?.rightEye?.sph
                        ? activeRecord.visionTest.rightEye.sph
                        : '-'}
                    </td>
                    <td className="py-2.5 print:py-2 px-2 border-r border-blue-900">
                      {hasVisitDetails && activeRecord?.visionTest?.rightEye?.cyl
                        ? activeRecord.visionTest.rightEye.cyl
                        : '-'}
                    </td>
                    <td className="py-2.5 print:py-2 px-2 border-r-2 border-blue-900">
                      {hasVisitDetails && activeRecord?.visionTest?.rightEye?.axis
                        ? `${activeRecord.visionTest.rightEye.axis}°`
                        : '-'}
                    </td>
                    <td className="py-2.5 print:py-2 px-2 border-r border-blue-900">
                      {hasVisitDetails && activeRecord?.visionTest?.leftEye?.sph
                        ? activeRecord.visionTest.leftEye.sph
                        : '-'}
                    </td>
                    <td className="py-2.5 print:py-2 px-2 border-r border-blue-900">
                      {hasVisitDetails && activeRecord?.visionTest?.leftEye?.cyl
                        ? activeRecord.visionTest.leftEye.cyl
                        : '-'}
                    </td>
                    <td className="py-2.5 print:py-2 px-2">
                      {hasVisitDetails && activeRecord?.visionTest?.leftEye?.axis
                        ? `${activeRecord.visionTest.leftEye.axis}°`
                        : '-'}
                    </td>
                  </tr>

                  {/* Near Vision / ADD Row */}
                  <tr>
                    <td className="py-2.5 print:py-2 px-2 border-r-2 border-blue-900 font-sans font-black text-blue-950 bg-blue-50">
                      N.V
                    </td>
                    <td className="py-2.5 print:py-2 px-2 border-r border-blue-900">
                      {hasVisitDetails && activeRecord?.visionTest?.rightEye?.add
                        ? activeRecord.visionTest.rightEye.add
                        : '-'}
                    </td>
                    <td className="py-2.5 print:py-2 px-2 border-r border-blue-900">
                      {hasVisitDetails && activeRecord?.visionTest?.rightEye?.nearCyl
                        ? activeRecord.visionTest.rightEye.nearCyl
                        : '-'}
                    </td>
                    <td className="py-2.5 print:py-2 px-2 border-r-2 border-blue-900">
                      {hasVisitDetails && activeRecord?.visionTest?.rightEye?.nearAxis
                        ? `${activeRecord.visionTest.rightEye.nearAxis}°`
                        : '-'}
                    </td>
                    <td className="py-2.5 print:py-2 px-2 border-r border-blue-900">
                      {hasVisitDetails && activeRecord?.visionTest?.leftEye?.add
                        ? activeRecord.visionTest.leftEye.add
                        : '-'}
                    </td>
                    <td className="py-2.5 print:py-2 px-2 border-r border-blue-900">
                      {hasVisitDetails && activeRecord?.visionTest?.leftEye?.nearCyl
                        ? activeRecord.visionTest.leftEye.nearCyl
                        : '-'}
                    </td>
                    <td className="py-2.5 print:py-2 px-2">
                      {hasVisitDetails && activeRecord?.visionTest?.leftEye?.nearAxis
                        ? `${activeRecord.visionTest.leftEye.nearAxis}°`
                        : '-'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* IOP Display (If Available) */}
          <div className="mt-3 print:mt-1 pt-2 print:pt-1 border-t border-slate-200 text-xs flex flex-wrap items-center justify-between px-2 text-slate-700">
            <span className="font-bold text-slate-900">Intraocular Pressure (IOP):</span>
            <span>
              OD (Right):{' '}
              <strong className="font-bold text-blue-900">
                {hasVisitDetails && activeRecord?.visionTest?.iopRight
                  ? `${activeRecord.visionTest.iopRight} mmHg`
                  : '-'}
              </strong>
            </span>
            <span>
              OS (Left):{' '}
              <strong className="font-bold text-blue-900">
                {hasVisitDetails && activeRecord?.visionTest?.iopLeft
                  ? `${activeRecord.visionTest.iopLeft} mmHg`
                  : '-'}
              </strong>
            </span>
          </div>

        </div>
      </div>

      {/* PAGE 2 — MEDICINES PROVIDED. A separate page appended after the
          main prescription document (not inside it, so it never disturbs
          that page's own pagination) — print:break-before-page forces it
          onto its own sheet whenever the document is printed/downloaded.
          Only generated when there's something to list. */}
      {hasVisitDetails && activeRecord && activeRecord.medicines && activeRecord.medicines.length > 0 && (
        <div
          id="printable-prescription-medicines-page"
          className="bg-white text-blue-950 p-6 sm:p-8 rounded-xl border-2 border-blue-900 shadow-2xl mt-6 print:mt-0 print:border-2 print:border-blue-900 print:shadow-none print:p-3 print:m-0 print:break-before-page font-serif"
        >
          <div className="border border-blue-900 p-4 print:p-2.5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b-2 border-blue-900">
              <div>
                <h1 className="text-xl font-black text-blue-950 tracking-tight font-serif uppercase">
                  {settings.clinicName || 'VisionCare Eye Clinic'}
                </h1>
                <p className="text-[11px] text-slate-600 font-sans">Medicines Provided</p>
              </div>
              <div className="text-right text-xs font-sans">
                <p className="font-bold text-blue-950">{patientName || '-'}</p>
                <p className="text-slate-500">Invoice No: {invoiceNumber || '-'}</p>
                <p className="text-slate-500">Date: {date || '-'}</p>
              </div>
            </div>

            <table className="w-full text-xs font-sans border-collapse">
              <thead>
                <tr className="border-b-2 border-blue-900 bg-blue-50 text-blue-950 font-black tracking-wider uppercase text-[11px]">
                  <th className="py-2 px-2 text-left border-r border-blue-200 w-8">#</th>
                  <th className="py-2 px-2 text-left border-r border-blue-200">Medicine</th>
                  <th className="py-2 px-2 text-center border-r border-blue-200">Dosage (M-A-N)</th>
                  <th className="py-2 px-2 text-center border-r border-blue-200">Days</th>
                  <th className="py-2 px-2 text-right border-r border-blue-200">Qty</th>
                  <th className="py-2 px-2 text-right border-r border-blue-200">Unit Price</th>
                  <th className="py-2 px-2 text-right border-r border-blue-200">Total</th>
                  <th className="py-2 px-2 text-left">Instructions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-100 text-slate-900">
                {activeRecord.medicines.map((m, i) => (
                  <tr key={m.id || i}>
                    <td className="py-2 px-2 border-r border-blue-100 text-slate-500">{i + 1}</td>
                    <td className="py-2 px-2 border-r border-blue-100 font-bold text-blue-950">{m.medicineName}</td>
                    <td className="py-2 px-2 border-r border-blue-100 text-center font-mono">
                      {m.morning}-{m.afternoon}-{m.night}
                    </td>
                    <td className="py-2 px-2 border-r border-blue-100 text-center font-mono">{m.days}</td>
                    <td className="py-2 px-2 border-r border-blue-100 text-right font-mono">{m.totalQty}</td>
                    <td className="py-2 px-2 border-r border-blue-100 text-right font-mono">₹{m.unitPrice?.toLocaleString('en-IN')}</td>
                    <td className="py-2 px-2 border-r border-blue-100 text-right font-mono font-bold">₹{m.totalPrice?.toLocaleString('en-IN')}</td>
                    <td className="py-2 px-2 text-slate-600">{m.instructions || '-'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-blue-900 bg-blue-50 font-black text-blue-950">
                  <td className="py-2 px-2" colSpan={6}>
                    MEDICINES TOTAL
                  </td>
                  <td className="py-2 px-2 text-right font-mono">
                    ₹{activeRecord.medicines.reduce((sum, m) => sum + (m.totalPrice || 0), 0).toLocaleString('en-IN')}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>

            <div className="pt-2 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-200">
              <span>{settings.clinicName || 'Royal Opticals'}</span>
              <span>Computer Generated Report</span>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM ACTIONS (Hidden during printing) */}
      <div className="print:hidden flex justify-end pt-4">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md transition-all active:scale-95 flex items-center gap-2"
        >
          {isSaving ? 'Saving...' : 'Save Prescription'}
        </button>
      </div>
    </div>
  );
};
