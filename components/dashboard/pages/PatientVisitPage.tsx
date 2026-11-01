'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import { usePatientProfile } from '@/hooks/usePatientProfile';
import { usePatientVisit } from '@/hooks/usePatientVisit';
import { useCreateVisitAndPrescription } from '@/hooks/useCreateVisitAndPrescription';
import { computeInvoiceTax, TaxLineItem, TaxEngineConfig } from '@/lib/taxEngine';
import { InventorySearchPicker } from '@/components/dashboard/InventorySearchPicker';
import { TextAutosuggest } from '@/components/dashboard/TextAutosuggest';
import { highlightMatch } from '@/components/dashboard/highlightMatch';
import {
  Visit,
  Patient,
  EyeVisionData,
  PrescribedMedicine,
  FrameSelection,
  ReadingGlassSelection,
  LensSelection,
  ContactLensSelection,
  SolutionSelection,
  PaymentMethod,
} from '@/lib/types';
import {
  Stethoscope,
  Eye,
  Pill,
  Glasses,
  Search,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  IndianRupee,
  Clock,
  Sparkles,
  ShieldAlert,
  User,
  X,
  Save,
  Droplet,
  BookOpen,
} from 'lucide-react';

export const PatientVisitPage: React.FC<{ patientId?: string; visitId?: string }> = ({ patientId, visitId }) => {
  const router = useRouter();
  const {
    patients,
    medicines,
    settings,
    taxRateConfig,
    addToast,
    updateVisitDraft,
    navigateTo,
  } = useApp();

  const { data: profileData } = usePatientProfile(patientId || '');
  const { data: visitData } = usePatientVisit(visitId || '');

  // Patient is either from the explicit profile, or the fetched visit
  const patient = profileData?.patient || visitData?.patient || null;
  // If we are editing/viewing an existing visit, use it as activeVisitDraft
  const activeVisitDraft = visitData?.visit || null;

  const [visitDate, setVisitDate] = useState<string>(
    activeVisitDraft?.date || new Date().toISOString().split('T')[0]
  );
  const [visitStatus, setVisitStatus] = useState<string>(activeVisitDraft?.status || 'Completed');

  // Vision Test state - Default clean and empty
  const [rightEye, setRightEye] = useState<EyeVisionData>({
    sph: activeVisitDraft?.visionTest?.rightEye?.sph || '',
    cyl: activeVisitDraft?.visionTest?.rightEye?.cyl || '',
    axis: activeVisitDraft?.visionTest?.rightEye?.axis || '',
    add: activeVisitDraft?.visionTest?.rightEye?.add || '',
    nearCyl: activeVisitDraft?.visionTest?.rightEye?.nearCyl || '',
    nearAxis: activeVisitDraft?.visionTest?.rightEye?.nearAxis || '',
    pd: activeVisitDraft?.visionTest?.rightEye?.pd || '',
    va: activeVisitDraft?.visionTest?.rightEye?.va || '',
  });

  const [leftEye, setLeftEye] = useState<EyeVisionData>({
    sph: activeVisitDraft?.visionTest?.leftEye?.sph || '',
    cyl: activeVisitDraft?.visionTest?.leftEye?.cyl || '',
    axis: activeVisitDraft?.visionTest?.leftEye?.axis || '',
    add: activeVisitDraft?.visionTest?.leftEye?.add || '',
    nearCyl: activeVisitDraft?.visionTest?.leftEye?.nearCyl || '',
    nearAxis: activeVisitDraft?.visionTest?.leftEye?.nearAxis || '',
    pd: activeVisitDraft?.visionTest?.leftEye?.pd || '',
    va: activeVisitDraft?.visionTest?.leftEye?.va || '',
  });

  const [iopRight, setIopRight] = useState<string>(
    activeVisitDraft?.visionTest?.iopRight || ''
  );
  const [iopLeft, setIopLeft] = useState<string>(
    activeVisitDraft?.visionTest?.iopLeft || ''
  );

  // Clinical Diagnosis & Complaint - Default clean and empty
  const [chiefComplaint, setChiefComplaint] = useState(
    activeVisitDraft?.chiefComplaint || ''
  );
  const [symptoms, setSymptoms] = useState(
    activeVisitDraft?.symptoms || ''
  );
  const [diagnosis, setDiagnosis] = useState(
    activeVisitDraft?.diagnosis || ''
  );
  const [doctorNotes, setDoctorNotes] = useState(
    activeVisitDraft?.doctorNotes || ''
  );

  // Prescribed Medicines State
  const [prescribedMeds, setPrescribedMeds] = useState<PrescribedMedicine[]>(
    activeVisitDraft?.medicines || []
  );
  const [medSearchTerm, setMedSearchTerm] = useState('');
  const [isMedDropdownOpen, setIsMedDropdownOpen] = useState(false);
  const medSearchRef = useRef<HTMLDivElement>(null);

  // Click outside listener for the medicine search dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (medSearchRef.current && !medSearchRef.current.contains(event.target as Node)) {
        setIsMedDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Frame Selection State
  const [includeFrame, setIncludeFrame] = useState<boolean>(
    Boolean(activeVisitDraft?.frame)
  );
  const [frameData, setFrameData] = useState<FrameSelection>({
    frameName: activeVisitDraft?.frame?.frameName || '',
    brand: activeVisitDraft?.frame?.brand || '',
    code: activeVisitDraft?.frame?.code || '',
    type: activeVisitDraft?.frame?.type || 'Full Rim',
    price: activeVisitDraft?.frame?.price || 0,
    discount: activeVisitDraft?.frame?.discount || 0,
    finalAmount: activeVisitDraft?.frame?.finalAmount || 0,
  });

  // Frame Selection is either a Regular Frame (above) or Reading Glass — one
  // product at a time, sharing the single "Include Frame" toggle.
  const [frameCategory, setFrameCategory] = useState<'Regular Frame' | 'Reading Glass'>(
    activeVisitDraft?.readingGlass ? 'Reading Glass' : 'Regular Frame'
  );
  const [readingGlassData, setReadingGlassData] = useState<ReadingGlassSelection>({
    medicineId: activeVisitDraft?.readingGlass?.medicineId,
    variant: activeVisitDraft?.readingGlass?.variant || 'Pen Type',
    brand: activeVisitDraft?.readingGlass?.brand || '',
    productName: activeVisitDraft?.readingGlass?.productName || '',
    code: activeVisitDraft?.readingGlass?.code || '',
    readingPower: activeVisitDraft?.readingGlass?.readingPower || '+1.00',
    quantity: activeVisitDraft?.readingGlass?.quantity || 1,
    price: activeVisitDraft?.readingGlass?.price || 0,
    discount: activeVisitDraft?.readingGlass?.discount || 0,
    finalAmount: activeVisitDraft?.readingGlass?.finalAmount || 0,
  });

  // Lens Selection State
  const [includeLens, setIncludeLens] = useState<boolean>(
    Boolean(activeVisitDraft?.lens)
  );
  const [lensData, setLensData] = useState<LensSelection>({
    medicineId: activeVisitDraft?.lens?.medicineId,
    lensType: activeVisitDraft?.lens?.lensType || '',
    brand: activeVisitDraft?.lens?.brand || '',
    productName: activeVisitDraft?.lens?.productName || '',
    code: activeVisitDraft?.lens?.code,
    index: activeVisitDraft?.lens?.index || '1.56',
    coating: activeVisitDraft?.lens?.coating || '',
    blueCut: activeVisitDraft?.lens?.blueCut ?? false,
    photochromic: activeVisitDraft?.lens?.photochromic ?? false,
    antiGlare: activeVisitDraft?.lens?.antiGlare ?? false,
    price: activeVisitDraft?.lens?.price || 0,
  });

  // Contact Lens State
  const [includeContactLens, setIncludeContactLens] = useState<boolean>(
    Boolean(activeVisitDraft?.contactLens)
  );
  const [contactLensData, setContactLensData] = useState<ContactLensSelection>({
    medicineId: activeVisitDraft?.contactLens?.medicineId,
    brand: activeVisitDraft?.contactLens?.brand || '',
    productName: activeVisitDraft?.contactLens?.productName || '',
    code: activeVisitDraft?.contactLens?.code,
    power: activeVisitDraft?.contactLens?.power || '',
    baseCurve: activeVisitDraft?.contactLens?.baseCurve || '',
    diameter: activeVisitDraft?.contactLens?.diameter || '',
    eye: activeVisitDraft?.contactLens?.eye || 'Both',
    quantity: activeVisitDraft?.contactLens?.quantity || 1,
    unitPrice: activeVisitDraft?.contactLens?.unitPrice || 0,
    totalPrice: activeVisitDraft?.contactLens?.totalPrice || 0,
  });

  // Solution Selection State (contact-lens care solutions)
  const [includeSolution, setIncludeSolution] = useState<boolean>(
    Boolean(activeVisitDraft?.solution)
  );
  const [solutionData, setSolutionData] = useState<SolutionSelection>({
    medicineId: activeVisitDraft?.solution?.medicineId,
    brand: activeVisitDraft?.solution?.brand || '',
    product: activeVisitDraft?.solution?.product || '',
    code: activeVisitDraft?.solution?.code,
    packSize: activeVisitDraft?.solution?.packSize || '120 ml',
    quantity: activeVisitDraft?.solution?.quantity || 1,
    price: activeVisitDraft?.solution?.price || 0,
    discount: activeVisitDraft?.solution?.discount || 0,
    finalAmount: activeVisitDraft?.solution?.finalAmount || 0,
  });

  // Payment Details State
  const [consultationFee, setConsultationFee] = useState<number>(
    settings.defaultConsultationFee || 200
  );
  const [discount, setDiscount] = useState<number>(0);
  const [advance, setAdvance] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  // GST place-of-supply — only used/shown when settings.gstEnabled. Defaults
  // to the patient's own state; editable for the rare out-of-state sale.
  const [customerState, setCustomerState] = useState<string>('');
  useEffect(() => {
    setCustomerState(patient?.state || settings.businessState || '');
  }, [patient?.id, settings.businessState]);

  // Hydrate all form state once an existing visit finishes loading. Every
  // field above is initialized from `activeVisitDraft`, but that comes from
  // usePatientVisit's async query — on the very first render (before the
  // fetch resolves) it's null, so useState locks in empty defaults and never
  // re-evaluates them. Without this, opening an existing visit shows a blank
  // form until you navigate away and back (by then react-query has the
  // result cached, so the *next* mount sees real data from the start).
  useEffect(() => {
    const v = visitData?.visit;
    if (!v) return;

    setVisitDate(v.date || new Date().toISOString().split('T')[0]);
    setVisitStatus(v.status || 'Completed');

    setRightEye({
      sph: v.visionTest?.rightEye?.sph || '',
      cyl: v.visionTest?.rightEye?.cyl || '',
      axis: v.visionTest?.rightEye?.axis || '',
      add: v.visionTest?.rightEye?.add || '',
      nearCyl: v.visionTest?.rightEye?.nearCyl || '',
      nearAxis: v.visionTest?.rightEye?.nearAxis || '',
      pd: v.visionTest?.rightEye?.pd || '',
      va: v.visionTest?.rightEye?.va || '',
    });
    setLeftEye({
      sph: v.visionTest?.leftEye?.sph || '',
      cyl: v.visionTest?.leftEye?.cyl || '',
      axis: v.visionTest?.leftEye?.axis || '',
      add: v.visionTest?.leftEye?.add || '',
      nearCyl: v.visionTest?.leftEye?.nearCyl || '',
      nearAxis: v.visionTest?.leftEye?.nearAxis || '',
      pd: v.visionTest?.leftEye?.pd || '',
      va: v.visionTest?.leftEye?.va || '',
    });
    setIopRight(v.visionTest?.iopRight || '');
    setIopLeft(v.visionTest?.iopLeft || '');

    setChiefComplaint(v.chiefComplaint || '');
    setSymptoms(v.symptoms || '');
    setDiagnosis(v.diagnosis || '');
    setDoctorNotes(v.doctorNotes || '');

    setPrescribedMeds(v.medicines || []);

    setIncludeFrame(Boolean(v.frame) || Boolean(v.readingGlass));
    setFrameCategory(v.readingGlass ? 'Reading Glass' : 'Regular Frame');
    setFrameData({
      frameName: v.frame?.frameName || '',
      brand: v.frame?.brand || '',
      code: v.frame?.code || '',
      type: v.frame?.type || 'Full Rim',
      price: v.frame?.price || 0,
      discount: v.frame?.discount || 0,
      finalAmount: v.frame?.finalAmount || 0,
    });
    setReadingGlassData({
      medicineId: v.readingGlass?.medicineId,
      variant: v.readingGlass?.variant || 'Pen Type',
      brand: v.readingGlass?.brand || '',
      productName: v.readingGlass?.productName || '',
      code: v.readingGlass?.code || '',
      readingPower: v.readingGlass?.readingPower || '+1.00',
      quantity: v.readingGlass?.quantity || 1,
      price: v.readingGlass?.price || 0,
      discount: v.readingGlass?.discount || 0,
      finalAmount: v.readingGlass?.finalAmount || 0,
    });

    setIncludeSolution(Boolean(v.solution));
    setSolutionData({
      medicineId: v.solution?.medicineId,
      brand: v.solution?.brand || '',
      product: v.solution?.product || '',
      code: v.solution?.code,
      packSize: v.solution?.packSize || '120 ml',
      quantity: v.solution?.quantity || 1,
      price: v.solution?.price || 0,
      discount: v.solution?.discount || 0,
      finalAmount: v.solution?.finalAmount || 0,
    });

    setIncludeLens(Boolean(v.lens));
    setLensData({
      medicineId: v.lens?.medicineId,
      lensType: v.lens?.lensType || '',
      brand: v.lens?.brand || '',
      productName: v.lens?.productName || '',
      code: v.lens?.code,
      index: v.lens?.index || '1.56',
      coating: v.lens?.coating || '',
      blueCut: v.lens?.blueCut ?? false,
      photochromic: v.lens?.photochromic ?? false,
      antiGlare: v.lens?.antiGlare ?? false,
      price: v.lens?.price || 0,
    });

    setIncludeContactLens(Boolean(v.contactLens));
    setContactLensData({
      medicineId: v.contactLens?.medicineId,
      brand: v.contactLens?.brand || '',
      productName: v.contactLens?.productName || '',
      code: v.contactLens?.code,
      power: v.contactLens?.power || '',
      baseCurve: v.contactLens?.baseCurve || '',
      diameter: v.contactLens?.diameter || '',
      eye: v.contactLens?.eye || 'Both',
      quantity: v.contactLens?.quantity || 1,
      unitPrice: v.contactLens?.unitPrice || 0,
      totalPrice: v.contactLens?.totalPrice || 0,
    });

    setConsultationFee(v.payment?.consultationFee ?? (settings.defaultConsultationFee || 200));
    setDiscount(v.payment?.discount || 0);
    setAdvance(v.payment?.advance || 0);
    setPaymentMethod(v.payment?.paymentMethod || 'UPI');
  }, [visitData]);

  // ── Reading Glass & Solution inventory (reuses the medicines table, same
  // as prescribed medicines — no separate inventory system) ──────────────
  const readingGlassInventory = medicines.filter((m) => m.category === 'Reading Glass');
  const solutionInventory = medicines.filter((m) => m.category === 'Solution');
  // Frame / Lens / Contact Lens inventory — same table, added via Medicine
  // Inventory's category cards or Expense Management's "+ Add Stock" flow.
  // Uses a lighter datalist-based picker (matching Lens's own existing
  // free-text-with-suggestions convention) rather than duplicating Reading
  // Glass's heavier dropdown UI, to minimize change to this billing page.
  const frameInventory = medicines.filter((m) => m.category === 'Frame');
  const lensInventory = medicines.filter((m) => m.category === 'Lens');
  const contactLensInventory = medicines.filter((m) => m.category === 'Contact Lens');

  // Exact-match (case-insensitive) on name — set when the typed value
  // matches a real stocked item, cleared otherwise, so a plain free-typed
  // entry never accidentally links to the wrong stock row.
  const matchInventoryByName = (inventory: typeof medicines, name: string) =>
    inventory.find((m) => m.name.toLowerCase().trim() === name.toLowerCase().trim());

  // Lens specification is stored as "Lens Type • Coating1, Coating2" by
  // Add Stock's Lens form — pull the lens type back out so selecting a
  // stocked lens also fills the Lens Type field, not just Brand & price.
  const parseLensTypeFromSpec = (spec?: string): string | undefined => spec?.split(' • ')[0]?.trim() || undefined;

  const frameBrandOptions = Array.from(new Set(frameInventory.map((m) => m.brand))).filter(Boolean);
  const frameNameOptions = frameInventory.filter(
    (m) => !frameData.brand.trim() || m.brand.toLowerCase().includes(frameData.brand.trim().toLowerCase())
  );

  // Applies a matched inventory item to the Frame card — shared by the Frame
  // Name picker's onSelect and the Frame Code reverse-lookup below.
  const applyFrameSelection = (m: (typeof medicines)[0]) => {
    const validTypes = ['Full Rim', 'Half Rim', 'Rimless', 'Sunglasses', 'Shell'];
    setFrameData((prev) => {
      const matchedType = validTypes.includes(m.specification || '') ? (m.specification as FrameSelection['type']) : prev.type;
      return {
        ...prev,
        frameName: m.name,
        brand: m.brand,
        code: m.barcode || prev.code,
        type: matchedType,
        medicineId: m.id,
        price: m.sellingPrice,
        finalAmount: Math.max(0, m.sellingPrice - prev.discount),
      };
    });
  };

  useEffect(() => {
    const code = frameData.code.trim();
    if (!code) return;
    const match = frameInventory.find((m) => m.barcode && m.barcode.toLowerCase() === code.toLowerCase());
    if (match && match.id !== frameData.medicineId) applyFrameSelection(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameData.code]);

  const lensBrandOptions = Array.from(new Set(lensInventory.map((m) => m.brand))).filter(Boolean);
  const lensProductOptions = lensInventory.filter(
    (m) => !lensData.brand.trim() || m.brand.toLowerCase().includes(lensData.brand.trim().toLowerCase())
  );

  // Applies a matched inventory item to the Lens card — shared by the
  // Product Name picker's onSelect and the Code reverse-lookup below.
  const applyLensSelection = (m: (typeof medicines)[0]) => {
    const parsedType = parseLensTypeFromSpec(m.specification);
    setLensData((prev) => ({
      ...prev,
      productName: m.name,
      brand: m.brand,
      code: m.barcode || prev.code,
      medicineId: m.id,
      price: m.sellingPrice,
      lensType: parsedType || prev.lensType,
    }));
  };

  useEffect(() => {
    const code = lensData.code?.trim();
    if (!code) return;
    const match = lensInventory.find((m) => m.barcode && m.barcode.toLowerCase() === code.toLowerCase());
    if (match && match.id !== lensData.medicineId) applyLensSelection(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lensData.code]);

  // Contact Lens specification is stored as "Power • BC x • DIA y" by Add
  // Stock's Contact Lens form — pull all three back out on selection.
  const parseContactLensSpec = (spec?: string): { power?: string; baseCurve?: string; diameter?: string } => {
    if (!spec) return {};
    const parts = spec.split(' • ').map((p) => p.trim());
    const power = parts.find((p) => p && !p.startsWith('BC ') && !p.startsWith('DIA '));
    const baseCurve = parts.find((p) => p.startsWith('BC '))?.slice(3);
    const diameter = parts.find((p) => p.startsWith('DIA '))?.slice(4);
    return { power, baseCurve, diameter };
  };

  const contactLensBrandOptions = Array.from(new Set(contactLensInventory.map((m) => m.brand))).filter(Boolean);
  const contactLensProductOptions = contactLensInventory.filter(
    (m) => !contactLensData.brand.trim() || m.brand.toLowerCase().includes(contactLensData.brand.trim().toLowerCase())
  );

  // Applies a matched inventory item to the Contact Lens card — shared by the
  // Product Name picker's onSelect and the Code-field reverse-lookup below,
  // so both paths fill the form identically.
  const applyContactLensSelection = (m: (typeof medicines)[0]) => {
    const parsed = parseContactLensSpec(m.specification);
    setContactLensData((prev) => ({
      ...prev,
      brand: m.brand,
      productName: m.name,
      code: m.barcode || prev.code,
      medicineId: m.id,
      unitPrice: m.sellingPrice,
      totalPrice: m.sellingPrice * prev.quantity,
      power: parsed.power || prev.power,
      baseCurve: parsed.baseCurve || prev.baseCurve,
      diameter: parsed.diameter || prev.diameter,
    }));
  };

  // Typing an exact existing barcode into the Code field re-fills the rest
  // of the card, same as picking the product from the suggestion dropdown.
  useEffect(() => {
    const code = contactLensData.code?.trim();
    if (!code) return;
    const match = contactLensInventory.find((m) => m.barcode && m.barcode.toLowerCase() === code.toLowerCase());
    if (match && match.id !== contactLensData.medicineId) applyContactLensSelection(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactLensData.code]);

  const readingGlassBrandOptions = Array.from(new Set(readingGlassInventory.map((m) => m.brand))).filter(Boolean);
  const readingGlassProductOptions = readingGlassInventory.filter(
    (m) => !readingGlassData.brand.trim() || m.brand.toLowerCase().includes(readingGlassData.brand.trim().toLowerCase())
  );

  // Applies a matched inventory item to the Reading Glass card — shared by
  // the Product picker's onSelect and the Product Code reverse-lookup below.
  const applyReadingGlassSelection = (m: (typeof medicines)[0]) => {
    setReadingGlassData((prev) => ({
      ...prev,
      medicineId: m.id,
      brand: m.brand,
      productName: m.name,
      code: m.barcode || m.id.slice(0, 8).toUpperCase(),
      price: m.sellingPrice,
      quantity: Math.min(prev.quantity || 1, Math.max(1, m.availableStock)),
    }));
  };

  useEffect(() => {
    const code = readingGlassData.code?.trim();
    if (!code) return;
    const match = readingGlassInventory.find((m) => m.barcode && m.barcode.toLowerCase() === code.toLowerCase());
    if (match && match.id !== readingGlassData.medicineId) applyReadingGlassSelection(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readingGlassData.code]);

  // Solution brand options: real inventory brands if any exist, otherwise the
  // known Bausch + Lomb line as a bootstrap default so the card still works
  // before a clinic has stocked any Solution inventory items.
  const solutionBrands = Array.from(new Set(solutionInventory.map((m) => m.brand)));
  const effectiveSolutionBrands = solutionBrands.length > 0 ? solutionBrands : ['Bausch + Lomb'];

  const solutionProductsForBrand = solutionInventory.filter(
    (m) => !solutionData.brand.trim() || m.brand.toLowerCase().includes(solutionData.brand.trim().toLowerCase())
  );
  const solutionMatchedItem = solutionInventory.find((m) => m.id === solutionData.medicineId);

  // Applies a matched inventory item to the Solution card — shared by the
  // Product picker's onSelect and the Code reverse-lookup below.
  const applySolutionSelection = (m: (typeof medicines)[0]) => {
    const validPackSizes = ['60 ml', '120 ml', '360 ml'];
    setSolutionData((prev) => ({
      ...prev,
      medicineId: m.id,
      brand: m.brand,
      product: m.name,
      code: m.barcode || prev.code,
      price: m.sellingPrice,
      packSize: validPackSizes.includes(m.specification || '') ? m.specification! : prev.packSize,
      quantity: Math.min(prev.quantity || 1, Math.max(1, m.availableStock)),
    }));
  };

  useEffect(() => {
    const code = solutionData.code?.trim();
    if (!code) return;
    const match = solutionInventory.find((m) => m.barcode && m.barcode.toLowerCase() === code.toLowerCase());
    if (match && match.id !== solutionData.medicineId) applySolutionSelection(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solutionData.code]);

  // Auto Calculations
  const medicineTotal = prescribedMeds.reduce((acc, m) => acc + m.totalPrice, 0);
  // Frame Selection is one product at a time — Regular Frame OR Reading Glass —
  // so only the active category contributes to the bill.
  const frameTotal =
    includeFrame && frameCategory === 'Regular Frame'
      ? Math.max(0, frameData.price - frameData.discount)
      : 0;
  const readingGlassTotal =
    includeFrame && frameCategory === 'Reading Glass'
      ? Math.max(0, readingGlassData.quantity * readingGlassData.price - readingGlassData.discount)
      : 0;
  const lensTotal = includeLens ? lensData.price : 0;
  const contactLensTotal = includeContactLens ? contactLensData.quantity * contactLensData.unitPrice : 0;
  const solutionTotal = includeSolution
    ? Math.max(0, solutionData.quantity * solutionData.price - solutionData.discount)
    : 0;

  const subtotal =
    consultationFee + medicineTotal + frameTotal + readingGlassTotal + lensTotal + contactLensTotal + solutionTotal;

  // GST — computed by the single shared engine (lib/taxEngine.ts). When
  // settings.gstEnabled is false (the default), this produces the exact
  // same grandTotal as the plain subtotal-minus-discount math always has —
  // verified directly against the old formula, so nothing changes for the
  // real, current, disabled state.
  const taxConfig: TaxEngineConfig = {
    gstEnabled: settings.gstEnabled,
    taxMode: settings.taxMode,
    taxRounding: settings.taxRounding,
    defaultGstRate: settings.defaultGstRate,
    categoryRates: Object.fromEntries(taxRateConfig.map((r) => [r.category, { taxRate: r.taxRate, isTaxable: r.isTaxable }])),
  };
  const taxLineItems: TaxLineItem[] = [
    ...(consultationFee > 0 ? [{ category: 'Consultation' as const, amount: consultationFee }] : []),
    ...(frameTotal > 0 ? [{ category: 'Frame' as const, amount: frameTotal }] : []),
    ...(readingGlassTotal > 0 ? [{ category: 'Reading Glass' as const, amount: readingGlassTotal }] : []),
    ...(lensTotal > 0 ? [{ category: 'Lens' as const, amount: lensTotal }] : []),
    ...(contactLensTotal > 0 ? [{ category: 'Contact Lens' as const, amount: contactLensTotal }] : []),
    ...(solutionTotal > 0 ? [{ category: 'Solution' as const, amount: solutionTotal }] : []),
    // Each prescribed medicine is its own line so a per-medicine tax rate
    // override (set in Medicine Inventory) is honored individually.
    ...prescribedMeds
      .filter((m) => m.totalPrice > 0)
      .map((m) => ({
        category: 'Medicines' as const,
        amount: m.totalPrice,
        medicineTaxRate: medicines.find((med) => med.id === m.medicineId)?.taxRate,
      })),
  ];
  const taxBreakdown = computeInvoiceTax(taxLineItems, discount, taxConfig, settings.businessState, customerState);

  const grandTotal = taxBreakdown.grandTotal;
  const balance = Math.max(0, grandTotal - advance);

  // Sync Auto-Save Draft
  useEffect(() => {
    updateVisitDraft({
      patientId: patient?.id,
      patientName: patient?.name,
      patientAge: patient?.age,
      patientGender: patient?.gender,
      patientPhone: patient?.phone,
      patientAddress: patient?.address,
      chiefComplaint,
      symptoms,
      diagnosis,
      visionTest: { rightEye, leftEye, iopRight, iopLeft },
      medicines: prescribedMeds,
      frame: includeFrame && frameCategory === 'Regular Frame' ? frameData : undefined,
      readingGlass: includeFrame && frameCategory === 'Reading Glass' ? readingGlassData : undefined,
      lens: includeLens ? lensData : undefined,
      contactLens: includeContactLens ? contactLensData : undefined,
      solution: includeSolution ? solutionData : undefined,
      doctorNotes,
    });
  }, [
    patient,
    chiefComplaint,
    symptoms,
    diagnosis,
    rightEye,
    leftEye,
    iopRight,
    iopLeft,
    prescribedMeds,
    includeFrame,
    frameCategory,
    frameData,
    readingGlassData,
    includeLens,
    lensData,
    includeContactLens,
    contactLensData,
    includeSolution,
    solutionData,
    doctorNotes,
    updateVisitDraft,
  ]);

  // Smart Medicine Selection Logic
  const filteredMedicines = medSearchTerm
    ? medicines.filter(
        (m) =>
          m.name.toLowerCase().includes(medSearchTerm.toLowerCase()) ||
          m.brand.toLowerCase().includes(medSearchTerm.toLowerCase())
      )
    : medicines;

  const handleSelectMedicine = (m: (typeof medicines)[0]) => {
    // Default dosage: Morning 1, Afternoon 0, Night 1 for 7 days
    const morning = 1;
    const afternoon = 0;
    const night = 1;
    const days = 7;
    const isDrop = m.category === 'Eye Drops' || m.name.toLowerCase().includes('drop');
    const calculatedQty = isDrop ? 1 : (morning + afternoon + night) * days;

    const newPrescMed: PrescribedMedicine = {
      id: 'pmed-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      medicineId: m.id,
      medicineName: m.name,
      morning,
      afternoon,
      night,
      days,
      totalQty: calculatedQty,
      unitPrice: m.sellingPrice,
      totalPrice: calculatedQty * m.sellingPrice,
      instructions: isDrop ? 'Instill 1 drop twice daily' : 'Take 1 tablet twice daily after food',
      inStock: m.availableStock,
      isLowStock: m.availableStock <= m.minimumStock,
      isOutOfStock: m.availableStock === 0,
    };

    setPrescribedMeds((prev) => [...prev, newPrescMed]);
    setMedSearchTerm('');
    setIsMedDropdownOpen(false);
  };

  const handleAddCustomMedicine = () => {
    if (!medSearchTerm.trim()) return;

    const term = medSearchTerm.trim();
    const matchedInv = medicines.find(
      (m) =>
        m.name.toLowerCase().trim() === term.toLowerCase() ||
        m.brand.toLowerCase().trim() === term.toLowerCase() ||
        m.name.toLowerCase().includes(term.toLowerCase())
    );

    const morning = 1;
    const afternoon = 0;
    const night = 1;
    const days = 7;
    const isDrop = term.toLowerCase().includes('drop');
    const calculatedQty = isDrop ? 1 : (morning + afternoon + night) * days;

    const unitPrice = matchedInv ? matchedInv.sellingPrice : 50;

    const newPrescMed: PrescribedMedicine = {
      id: 'pmed-custom-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      medicineId: matchedInv ? matchedInv.id : 'custom-' + Date.now(),
      medicineName: matchedInv ? matchedInv.name : term,
      morning,
      afternoon,
      night,
      days,
      totalQty: calculatedQty,
      unitPrice,
      totalPrice: calculatedQty * unitPrice,
      instructions: isDrop ? 'Instill 1 drop twice daily' : 'Take 1 tablet twice daily after food',
      inStock: matchedInv ? matchedInv.availableStock : 99,
      isLowStock: matchedInv ? matchedInv.availableStock <= matchedInv.minimumStock : false,
      isOutOfStock: matchedInv ? matchedInv.availableStock === 0 : false,
    };

    setPrescribedMeds((prev) => [...prev, newPrescMed]);
    setMedSearchTerm('');
    setIsMedDropdownOpen(false);
    addToast('Medicine Added', `Added "${newPrescMed.medicineName}" to prescription list.`);
  };

  const handleUpdateMedDosage = (
    id: string,
    field: 'morning' | 'afternoon' | 'night' | 'days',
    val: number
  ) => {
    setPrescribedMeds((prev) =>
      prev.map((pm) => {
        if (pm.id === id) {
          const updated = { ...pm, [field]: val };
          const isDrop = pm.medicineName.toLowerCase().includes('drop');
          const calcQty = isDrop
            ? 1
            : (updated.morning + updated.afternoon + updated.night) * updated.days;

          return {
            ...updated,
            totalQty: calcQty,
            totalPrice: calcQty * updated.unitPrice,
          };
        }
        return pm;
      })
    );
  };

  const handleUpdateTotalQty = (id: string, qty: number) => {
    setPrescribedMeds((prev) =>
      prev.map((pm) => {
        if (pm.id === id) {
          const validQty = Math.max(1, qty);
          return {
            ...pm,
            totalQty: validQty,
            totalPrice: validQty * pm.unitPrice,
          };
        }
        return pm;
      })
    );
  };

  const handleRemovePrescMed = (id: string) => {
    setPrescribedMeds((prev) => prev.filter((m) => m.id !== id));
  };

  const createVisitMutation = useCreateVisitAndPrescription();

  // Submit Visit (Internal Helper)
  const submitVisit = async (skipNavigation: boolean = false) => {
    if (!patient) {
      addToast('Select Patient', 'Please select a patient before moving to prescription.', 'warning');
      return;
    }

    // Sequential, DB-atomic invoice number (Postgres function, called
    // server-side now — see app/api/next-invoice-number/route.ts) —
    // replaces the old Math.random() generator, which could collide with
    // numbers minted independently by the standalone Prescription flow.
    let invoiceNum: string;
    try {
      const { apiFetch } = await import('@/lib/apiFetch');
      ({ invoiceNumber: invoiceNum } = await apiFetch<{ invoiceNumber: string }>('/api/next-invoice-number', { method: 'POST' }));
    } catch (err) {
      addToast('Error', `Could not generate an invoice number: ${err instanceof Error ? err.message : 'unknown error'}`, 'error');
      return;
    }

    createVisitMutation.mutate({
      visitData: {
        patientId: patient.id,
        patientName: patient.name,
        patientAge: patient.age,
        patientGender: patient.gender,
        patientPhone: patient.phone,
        patientAddress: patient.address,
        date: visitDate || new Date().toISOString().split('T')[0],
        chiefComplaint,
        symptoms,
        diagnosis,
        visionTest: {
          rightEye,
          leftEye,
          iopRight,
          iopLeft,
          notes: doctorNotes,
        },
        medicines: prescribedMeds,
        contactLens: includeContactLens ? contactLensData : undefined,
        frame:
          includeFrame && frameCategory === 'Regular Frame'
            ? { ...frameData, finalAmount: frameTotal }
            : undefined,
        readingGlass:
          includeFrame && frameCategory === 'Reading Glass'
            ? { ...readingGlassData, finalAmount: readingGlassTotal }
            : undefined,
        lens: includeLens ? lensData : undefined,
        solution: includeSolution ? { ...solutionData, finalAmount: solutionTotal } : undefined,
        doctorNotes,
        payment: {
          consultationFee,
          medicineTotal,
          lensTotal,
          frameTotal,
          readingGlassTotal,
          solutionTotal,
          contactLensTotal,
          additionalCharges: 0,
          discount,
          subtotal,
          grandTotal,
          advance,
          balance,
          paymentMethod,
          invoiceNumber: invoiceNum,
          paymentDate: visitDate,
          status: balance === 0 ? 'Paid' : advance > 0 ? 'Partial' : 'Pending',
          // GST — all zero/absent when settings.gstEnabled is false, same
          // as every other field the tax engine returns for the disabled
          // case. Saved once here; Invoice and TSR only ever read this.
          placeOfSupply: taxBreakdown.placeOfSupply,
          taxMode: taxBreakdown.taxMode,
          taxableAmount: taxBreakdown.taxableAmount,
          cgstRate: taxBreakdown.cgstRate,
          cgstAmount: taxBreakdown.cgstAmount,
          sgstRate: taxBreakdown.sgstRate,
          sgstAmount: taxBreakdown.sgstAmount,
          igstRate: taxBreakdown.igstRate,
          igstAmount: taxBreakdown.igstAmount,
          totalTax: taxBreakdown.totalTax,
        },
        status: visitStatus as any,
      },
      medicines: medicines,
      skipNavigation,
    });
  };

  const handleSaveVisit = () => submitVisit(true);
  const handleMoveToPrescription = () => submitVisit(false);

  return (
    <div id="patient-visit-page" className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Breadcrumb & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          id="visit-back-btn"
          onClick={() => router.back()}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700/80 rounded-xl transition-all active:scale-95 shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>Back</span>
        </button>
      </div>

      {/* TOP CONTROLS & PATIENT SELECTOR */}
      <div className="p-6 bg-white dark:bg-slate-800/80 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Visit Date
            </label>
            <input
              id="visit-date-input"
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold outline-none focus:border-indigo-500 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Patient Name *
            </label>
            {patient ? (
               <div className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-indigo-600 dark:text-indigo-400">
                  {patient.name} ({patient.phone})
               </div>
            ) : (
               <select
                 className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-medium outline-none focus:border-indigo-500 text-slate-900 dark:text-white cursor-pointer"
                 onChange={(e) => {
                   if (e.target.value) {
                     router.push(`/visit/new?patientId=${e.target.value}`);
                   }
                 }}
                 defaultValue=""
               >
                 <option value="" disabled>Select a patient...</option>
                 {patients.map(p => (
                   <option key={p.id} value={p.id}>
                     {p.name} ({p.phone})
                   </option>
                 ))}
               </select>
            )}
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Visit Status
            </label>
            <select
              id="visit-status-select"
              value={visitStatus}
              onChange={(e) => setVisitStatus(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold outline-none focus:border-indigo-500 text-slate-900 dark:text-white cursor-pointer"
            >
              <option value="Completed">Completed</option>
              <option value="In Progress">In Progress</option>
              <option value="Ready Order">Ready Order</option>
            </select>
          </div>
        </div>

        {patient ? (
          <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 font-bold text-xs">
                  Selected Patient Record
                </span>
                <span className="text-xs text-slate-400 font-mono">ID: {patient.id}</span>
              </div>
              <h2 className="text-xl font-black tracking-tight">{patient.name}</h2>
              <p className="text-xs text-slate-300 font-medium">
                {patient.age} Yrs • {patient.gender} • Ph: {patient.phone} • {patient.address}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  navigateTo('patients');
                  router.push('/');
                }}
                className="px-3.5 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 text-slate-200 rounded-xl transition-all cursor-pointer"
              >
                Change Patient
              </button>
              <button
                id="top-move-to-rx-btn"
                onClick={handleMoveToPrescription}
                disabled={createVisitMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-black rounded-xl shadow-lg transition-all active:scale-95 shrink-0 cursor-pointer"
              >
                <span>{createVisitMutation.isPending ? 'Saving...' : 'Move To Prescription'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-indigo-900 dark:text-indigo-200 font-medium">
              <User className="w-5 h-5 shrink-0 text-indigo-600 dark:text-indigo-400" />
              <span>No patient selected. Choose a patient from the dropdown above or register a new patient to start an exam.</span>
            </div>
            <button
              onClick={() => {
                navigateTo('patients');
                router.push('/');
              }}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shrink-0 transition-all cursor-pointer"
            >
              + Register New Patient
            </button>
          </div>
        )}
      </div>

      {/* SECTION 1: CLINICAL DIAGNOSIS & COMPLAINTS */}
      <div className="p-6 bg-white dark:bg-slate-800/80 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <Stethoscope className="w-5 h-5 text-indigo-600" />
          Visit Details & Clinical Assessment
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Chief Complaint *
            </label>
            <input
              id="visit-chief-complaint"
              type="text"
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 font-medium"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Symptoms
            </label>
            <input
              id="visit-symptoms"
              type="text"
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 font-medium"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Diagnosis *
            </label>
            <input
              id="visit-diagnosis"
              type="text"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 font-bold text-indigo-600 dark:text-indigo-400"
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: COMPUTERIZED EYE TESTING (REFRACTION TABLE) */}
      <div className="p-6 bg-white dark:bg-slate-800/80 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs space-y-6">
        <div>
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
            REFRACTION / VISION TEST
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-center text-xs font-sans border-separate border-spacing-y-2">
              <thead>
                <tr className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[11px] tracking-wider">
                  <th className="py-2 px-3 text-left w-24">EYE</th>
                  <th colSpan={3} className="py-2 px-3 text-center border-b border-slate-200 dark:border-slate-700/60 pb-2">
                    DISTANCE (D.V)
                  </th>
                  <th colSpan={3} className="py-2 px-3 text-center border-b border-slate-200 dark:border-slate-700/60 pb-2">
                    NEAR (N.V)
                  </th>
                </tr>
                <tr className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                  <th></th>
                  <th className="py-1 px-2">SPH</th>
                  <th className="py-1 px-2">CYL</th>
                  <th className="py-1 px-2">AXIS</th>
                  <th className="py-1 px-2">SPH</th>
                  <th className="py-1 px-2">CYL</th>
                  <th className="py-1 px-2">AXIS</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {/* OD (Right Eye) Row */}
                <tr>
                  <td className="py-2 px-3 text-left font-sans font-bold text-slate-700 dark:text-slate-200 text-sm">
                    OD (R)
                  </td>
                  {/* Distance SPH */}
                  <td className="p-1">
                    <input
                      id="re-sph"
                      type="text"
                      value={rightEye.sph}
                      onChange={(e) => setRightEye({ ...rightEye, sph: e.target.value })}
                      placeholder="+0.00"
                      className="w-full text-center py-2 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-2xs"
                    />
                  </td>
                  {/* Distance CYL */}
                  <td className="p-1">
                    <input
                      id="re-cyl"
                      type="text"
                      value={rightEye.cyl}
                      onChange={(e) => setRightEye({ ...rightEye, cyl: e.target.value })}
                      placeholder="-0.00"
                      className="w-full text-center py-2 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-2xs"
                    />
                  </td>
                  {/* Distance AXIS */}
                  <td className="p-1">
                    <input
                      id="re-axis"
                      type="text"
                      value={rightEye.axis}
                      onChange={(e) => setRightEye({ ...rightEye, axis: e.target.value })}
                      placeholder="0"
                      className="w-full text-center py-2 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-2xs"
                    />
                  </td>
                  {/* Near SPH (ADD) */}
                  <td className="p-1">
                    <input
                      id="re-add"
                      type="text"
                      value={rightEye.add}
                      onChange={(e) => setRightEye({ ...rightEye, add: e.target.value })}
                      placeholder="+0.00"
                      className="w-full text-center py-2 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-2xs"
                    />
                  </td>
                  {/* Near CYL */}
                  <td className="p-1">
                    <input
                      id="re-near-cyl"
                      type="text"
                      value={rightEye.nearCyl || ''}
                      onChange={(e) => setRightEye({ ...rightEye, nearCyl: e.target.value })}
                      placeholder="-0.00"
                      className="w-full text-center py-2 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-2xs"
                    />
                  </td>
                  {/* Near AXIS */}
                  <td className="p-1">
                    <input
                      id="re-near-axis"
                      type="text"
                      value={rightEye.nearAxis || ''}
                      onChange={(e) => setRightEye({ ...rightEye, nearAxis: e.target.value })}
                      placeholder="0"
                      className="w-full text-center py-2 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-2xs"
                    />
                  </td>
                </tr>

                {/* OS (Left Eye) Row */}
                <tr>
                  <td className="py-2 px-3 text-left font-sans font-bold text-slate-700 dark:text-slate-200 text-sm">
                    OS (L)
                  </td>
                  {/* Distance SPH */}
                  <td className="p-1">
                    <input
                      id="le-sph"
                      type="text"
                      value={leftEye.sph}
                      onChange={(e) => setLeftEye({ ...leftEye, sph: e.target.value })}
                      placeholder="+0.00"
                      className="w-full text-center py-2 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-2xs"
                    />
                  </td>
                  {/* Distance CYL */}
                  <td className="p-1">
                    <input
                      id="le-cyl"
                      type="text"
                      value={leftEye.cyl}
                      onChange={(e) => setLeftEye({ ...leftEye, cyl: e.target.value })}
                      placeholder="-0.00"
                      className="w-full text-center py-2 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-2xs"
                    />
                  </td>
                  {/* Distance AXIS */}
                  <td className="p-1">
                    <input
                      id="le-axis"
                      type="text"
                      value={leftEye.axis}
                      onChange={(e) => setLeftEye({ ...leftEye, axis: e.target.value })}
                      placeholder="0"
                      className="w-full text-center py-2 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-2xs"
                    />
                  </td>
                  {/* Near SPH (ADD) */}
                  <td className="p-1">
                    <input
                      id="le-add"
                      type="text"
                      value={leftEye.add}
                      onChange={(e) => setLeftEye({ ...leftEye, add: e.target.value })}
                      placeholder="+0.00"
                      className="w-full text-center py-2 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-2xs"
                    />
                  </td>
                  {/* Near CYL */}
                  <td className="p-1">
                    <input
                      id="le-near-cyl"
                      type="text"
                      value={leftEye.nearCyl || ''}
                      onChange={(e) => setLeftEye({ ...leftEye, nearCyl: e.target.value })}
                      placeholder="-0.00"
                      className="w-full text-center py-2 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-2xs"
                    />
                  </td>
                  {/* Near AXIS */}
                  <td className="p-1">
                    <input
                      id="le-near-axis"
                      type="text"
                      value={leftEye.nearAxis || ''}
                      onChange={(e) => setLeftEye({ ...leftEye, nearAxis: e.target.value })}
                      placeholder="0"
                      className="w-full text-center py-2 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-2xs"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-3">
            OD = Right Eye &middot; OS = Left Eye &middot; SPH = Sphere &middot; CYL = Cylinder &middot; AXIS = Axis in degrees &middot; D.V = Distance Vision &middot; N.V = Near Vision
          </p>
        </div>

        {/* INTRAOCULAR PRESSURE (IOP) SECTION */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
            INTRAOCULAR PRESSURE (IOP)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                IOP &mdash; OD (Right)
              </label>
              <input
                id="iop-od"
                type="text"
                value={iopRight}
                onChange={(e) => setIopRight(e.target.value)}
                placeholder="e.g. 14"
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none font-semibold text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-2xs"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">mmHg</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                IOP &mdash; OS (Left)
              </label>
              <input
                id="iop-os"
                type="text"
                value={iopLeft}
                onChange={(e) => setIopLeft(e.target.value)}
                placeholder="e.g. 15"
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none font-semibold text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-2xs"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">mmHg</span>
            </div>
          </div>
        </div>

        {/* Additional Parameters: Pupillary Distance (PD) & Visual Acuity (VA) */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Right Eye PD (mm)
            </span>
            <input
              id="re-pd"
              type="text"
              value={rightEye.pd}
              onChange={(e) => setRightEye({ ...rightEye, pd: e.target.value })}
              placeholder="e.g. 31.5"
              className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none focus:border-indigo-500 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Right Eye Visual Acuity (VA)
            </span>
            <select
              id="re-va"
              value={rightEye.va || '6/6'}
              onChange={(e) => setRightEye({ ...rightEye, va: e.target.value })}
              className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none focus:border-indigo-500 text-slate-900 dark:text-white cursor-pointer"
            >
              <option value="6/6">6/6</option>
              <option value="6/9">6/9</option>
              <option value="6/12">6/12</option>
              <option value="6/18">6/18</option>
              <option value="6/24">6/24</option>
              <option value="6/36">6/36</option>
              <option value="6/60">6/60</option>
            </select>
          </div>

          <div>
            <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Left Eye PD (mm)
            </span>
            <input
              id="le-pd"
              type="text"
              value={leftEye.pd}
              onChange={(e) => setLeftEye({ ...leftEye, pd: e.target.value })}
              placeholder="e.g. 31.5"
              className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none focus:border-indigo-500 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Left Eye Visual Acuity (VA)
            </span>
            <select
              id="le-va"
              value={leftEye.va || '6/6'}
              onChange={(e) => setLeftEye({ ...leftEye, va: e.target.value })}
              className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none focus:border-indigo-500 text-slate-900 dark:text-white cursor-pointer"
            >
              <option value="6/6">6/6</option>
              <option value="6/9">6/9</option>
              <option value="6/12">6/12</option>
              <option value="6/18">6/18</option>
              <option value="6/24">6/24</option>
              <option value="6/36">6/36</option>
              <option value="6/60">6/60</option>
            </select>
          </div>
        </div>
      </div>

      {/* SECTION 3: MEDICINE SELECTION & SMART STOCK LOGIC */}
      <div className="p-6 bg-white dark:bg-slate-800/80 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Pill className="w-5 h-5 text-indigo-600" />
              Medicine Prescription & Smart Stock Logic
            </h3>
            <p className="text-xs text-slate-500">
              Autocomplete search directly connected to inventory stock deduction.
            </p>
          </div>
        </div>

        {/* Autocomplete Input Search */}
        <div ref={medSearchRef} className="relative">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 absolute left-3.5 text-slate-400" />
            <input
              id="medicine-search-autocomplete"
              type="text"
              value={medSearchTerm}
              onFocus={() => setIsMedDropdownOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setIsMedDropdownOpen(false);
              }}
              onChange={(e) => {
                const value = e.target.value;
                // Typing/pasting an exact existing barcode selects that
                // medicine directly, same shortcut as the other product cards.
                const barcodeMatch = medicines.find((m) => m.barcode && m.barcode.toLowerCase() === value.trim().toLowerCase());
                if (barcodeMatch) {
                  handleSelectMedicine(barcodeMatch);
                  return;
                }
                setMedSearchTerm(value);
                setIsMedDropdownOpen(true);
              }}
              placeholder="Search or type medicine name to prescribe..."
              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:border-indigo-500 text-slate-900 dark:text-white"
            />
            {(medSearchTerm || isMedDropdownOpen) && (
              <button
                type="button"
                onClick={() => {
                  setMedSearchTerm('');
                  setIsMedDropdownOpen(false);
                }}
                className="absolute right-3 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Close suggestion menu"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown List */}
          {isMedDropdownOpen && (
            <div className="absolute z-30 left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl max-h-72 overflow-y-auto p-2">
              <div className="flex items-center justify-between px-2 py-1 border-b border-slate-100 dark:border-slate-800 mb-1 text-[11px] font-bold text-slate-400 uppercase">
                <span>Inventory Suggestions ({filteredMedicines.length})</span>
                <button
                  type="button"
                  onClick={() => setIsMedDropdownOpen(false)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
                  title="Close dropdown"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {medSearchTerm.trim() && (
                <button
                  type="button"
                  onClick={handleAddCustomMedicine}
                  className="w-full p-2.5 mb-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-semibold text-xs flex items-center gap-2 cursor-pointer transition-colors border border-indigo-200/50 dark:border-indigo-800/50"
                >
                  <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Add "{medSearchTerm}" as Custom Medicine</span>
                </button>
              )}

              {filteredMedicines.length === 0 && !medSearchTerm.trim() ? (
                <div className="p-3 text-xs text-slate-400 text-center">
                  No matching medicines found in inventory.
                </div>
              ) : (
                filteredMedicines.map((m) => {
                  const isLow = m.availableStock <= m.minimumStock;
                  const isOut = m.availableStock === 0;

                  return (
                    <div
                      key={m.id}
                      onClick={() => handleSelectMedicine(m)}
                      className={`p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between text-xs transition-colors ${
                        isOut ? 'opacity-60 bg-rose-50/50 dark:bg-rose-950/20' : ''
                      }`}
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          {highlightMatch(m.name, medSearchTerm)} <span className="text-slate-400 font-normal">({m.brand})</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Rack: {m.rackNumber} • Supplier: {m.supplier} • Exp: {m.expiryDate}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          ₹{m.sellingPrice}
                        </span>
                        <div>
                          {isOut ? (
                            <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 text-[10px] font-bold">
                              Out Of Stock
                            </span>
                          ) : isLow ? (
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 text-[10px] font-bold flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Stock: {m.availableStock} (Low)
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-bold text-[10px]">
                              Stock: {m.availableStock}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Selected Prescribed Medicines Table */}
        {prescribedMeds.length > 0 && (
          <div className="overflow-x-auto pt-2">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider">
                  <th className="p-3">Medicine Name</th>
                  <th className="p-3 text-center">Morning</th>
                  <th className="p-3 text-center">Afternoon</th>
                  <th className="p-3 text-center">Night</th>
                  <th className="p-3 text-center">Days</th>
                  <th className="p-3 text-center">Req Qty</th>
                  <th className="p-3">In Stock</th>
                  <th className="p-3">Instructions</th>
                  <th className="p-3 text-right">Price</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {prescribedMeds.map((pm) => {
                  const invMatch = medicines.find(
                    (m) =>
                      m.id === pm.medicineId ||
                      m.name.toLowerCase().trim() === pm.medicineName.toLowerCase().trim() ||
                      m.name.toLowerCase().includes(pm.medicineName.toLowerCase())
                  );
                  const liveStock = invMatch ? invMatch.availableStock : pm.inStock;
                  const isOut = liveStock === 0;

                  return (
                    <tr key={pm.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                      <td className="p-3 font-semibold text-slate-900 dark:text-white">
                        {pm.medicineName}
                        {isOut && (
                          <span className="block text-[10px] text-rose-500 font-bold">
                            ⚠️ Warning: Out of Stock in Inventory
                          </span>
                        )}
                        {liveStock > 0 && liveStock < pm.totalQty && (
                          <span className="block text-[10px] text-amber-600 font-bold">
                            ⚠️ Note: Prescribed ({pm.totalQty}) exceeds live stock ({liveStock})
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          min="0"
                          value={pm.morning}
                          onChange={(e) =>
                            handleUpdateMedDosage(pm.id, 'morning', parseInt(e.target.value) || 0)
                          }
                          className="w-12 text-center py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          min="0"
                          value={pm.afternoon}
                          onChange={(e) =>
                            handleUpdateMedDosage(pm.id, 'afternoon', parseInt(e.target.value) || 0)
                          }
                          className="w-12 text-center py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          min="0"
                          value={pm.night}
                          onChange={(e) =>
                            handleUpdateMedDosage(pm.id, 'night', parseInt(e.target.value) || 0)
                          }
                          className="w-12 text-center py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          min="1"
                          value={pm.days}
                          onChange={(e) =>
                            handleUpdateMedDosage(pm.id, 'days', parseInt(e.target.value) || 1)
                          }
                          className="w-14 text-center py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          min="1"
                          value={pm.totalQty}
                          onChange={(e) =>
                            handleUpdateTotalQty(pm.id, parseInt(e.target.value) || 1)
                          }
                          className="w-16 text-center py-1 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-lg font-black text-indigo-700 dark:text-indigo-300 font-mono text-xs"
                        />
                      </td>
                      <td className="p-3">
                        <span
                          className={`font-semibold ${
                            liveStock === 0
                              ? 'text-rose-500'
                              : liveStock <= 10
                              ? 'text-amber-500'
                              : 'text-emerald-600'
                          }`}
                        >
                          {liveStock} avail
                        </span>
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={pm.instructions}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPrescribedMeds((prev) =>
                              prev.map((item) => (item.id === pm.id ? { ...item, instructions: val } : item))
                            );
                          }}
                          className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                        />
                      </td>
                      <td className="p-3 text-right font-bold text-slate-900 dark:text-white">
                        ₹{pm.totalPrice}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleRemovePrescMed(pm.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 4: FRAME & LENS SELECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Frame Selection */}
        <div className="p-6 bg-white dark:bg-slate-800/80 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Glasses className="w-5 h-5 text-indigo-600" />
              Frame Selection
            </h3>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                id="toggle-include-frame"
                type="checkbox"
                checked={includeFrame}
                onChange={(e) => setIncludeFrame(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              <span className="ml-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                Include Frame
              </span>
            </label>
          </div>

          {includeFrame && (
            <div className="space-y-3 text-xs">
              {/* Category: Regular Frame vs Reading Glass — one product, shared toggle */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Regular Frame', 'Reading Glass'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      id={cat === 'Regular Frame' ? 'frame-category-regular' : 'frame-category-reading-glass'}
                      onClick={() => setFrameCategory(cat)}
                      className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                        frameCategory === cat
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {frameCategory === 'Regular Frame' && (
              <>
              <div className="grid grid-cols-2 gap-3">
                <TextAutosuggest
                  id="frame-brand-input"
                  label="Frame Brand"
                  options={frameBrandOptions}
                  value={frameData.brand}
                  onChange={(brand) => setFrameData({ ...frameData, brand, medicineId: undefined })}
                  placeholder="e.g. Titan"
                />
                <InventorySearchPicker
                  id="frame-name-input"
                  label="Frame Name"
                  items={frameNameOptions}
                  value={frameData.frameName}
                  onSearchChange={(value) => setFrameData({ ...frameData, frameName: value, medicineId: undefined })}
                  onSelect={applyFrameSelection}
                  placeholder="Type to search stocked frames, or enter a new one"
                  hint={frameData.medicineId ? `Selected from inventory — Available Stock: ${frameInventory.find((m) => m.id === frameData.medicineId)?.availableStock ?? 0}` : undefined}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Frame Code
                  </label>
                  <input
                    id="frame-code-input"
                    type="text"
                    value={frameData.code}
                    onChange={(e) => setFrameData({ ...frameData, code: e.target.value })}
                    placeholder="Auto (from inventory)"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Frame Type
                  </label>
                  <select
                    id="frame-type-select"
                    value={frameData.type}
                    onChange={(e) => setFrameData({ ...frameData, type: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
                  >
                    <option value="Full Rim">Full Rim</option>
                    <option value="Half Rim">Half Rim</option>
                    <option value="Rimless">Rimless</option>
                    <option value="Sunglasses">Sunglasses</option>
                    <option value="Shell">Shell</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Price (₹)
                  </label>
                  <input
                    id="frame-price-input"
                    type="number"
                    value={frameData.price}
                    onChange={(e) => setFrameData({ ...frameData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Discount (₹)
                  </label>
                  <input
                    id="frame-discount-input"
                    type="number"
                    value={frameData.discount}
                    onChange={(e) => setFrameData({ ...frameData, discount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                  />
                </div>
              </div>
              </>
              )}

              {frameCategory === 'Reading Glass' && (
              <div className="space-y-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Reading Glass Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['Pen Type', 'Pouch Type'] as const).map((variant) => (
                      <button
                        key={variant}
                        type="button"
                        id={variant === 'Pen Type' ? 'reading-glass-type-pen' : 'reading-glass-type-pouch'}
                        onClick={() => setReadingGlassData({ ...readingGlassData, variant })}
                        className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                          readingGlassData.variant === variant
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {variant}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Brand + Product + Code — same shared search/suggestion
                    components used by Frame/Lens/Contact Lens. */}
                <div className="grid grid-cols-2 gap-3">
                  <TextAutosuggest
                    id="reading-glass-brand-input"
                    label="Brand"
                    options={readingGlassBrandOptions}
                    value={readingGlassData.brand}
                    onChange={(brand) => setReadingGlassData({ ...readingGlassData, brand, medicineId: undefined })}
                  />
                  <InventorySearchPicker
                    id="reading-glass-product-input"
                    label="Product (search inventory or type to enter manually)"
                    items={readingGlassProductOptions}
                    value={readingGlassData.productName}
                    onSearchChange={(value) => setReadingGlassData({ ...readingGlassData, productName: value, medicineId: undefined })}
                    onSelect={applyReadingGlassSelection}
                    placeholder="Search reading glass inventory..."
                    hint={readingGlassData.medicineId ? `Selected from inventory — Available Stock: ${readingGlassInventory.find((m) => m.id === readingGlassData.medicineId)?.availableStock ?? 0}` : undefined}
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Product Code
                  </label>
                  <input
                    id="reading-glass-code-input"
                    type="text"
                    value={readingGlassData.code}
                    onChange={(e) => setReadingGlassData({ ...readingGlassData, code: e.target.value })}
                    placeholder="Auto (from inventory)"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Reading Power
                    </label>
                    <select
                      id="reading-glass-power-select"
                      value={readingGlassData.readingPower}
                      onChange={(e) => setReadingGlassData({ ...readingGlassData, readingPower: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-semibold"
                    >
                      {['+0.50', '+0.75', '+1.00', '+1.25', '+1.50', '+1.75', '+2.00', '+2.25', '+2.50', '+2.75', '+3.00', '+3.25', '+3.50', '+3.75', '+4.00'].map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Quantity
                    </label>
                    <input
                      id="reading-glass-quantity-input"
                      type="number"
                      min="1"
                      value={readingGlassData.quantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        const stockItem = readingGlassInventory.find((m) => m.id === readingGlassData.medicineId);
                        if (stockItem && val > stockItem.availableStock) {
                          addToast('Insufficient Stock', `Only ${stockItem.availableStock} units of ${stockItem.name} are available.`, 'warning');
                          setReadingGlassData({ ...readingGlassData, quantity: Math.max(1, stockItem.availableStock) });
                        } else {
                          setReadingGlassData({ ...readingGlassData, quantity: Math.max(1, val) });
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Price (₹)
                    </label>
                    <input
                      id="reading-glass-price-input"
                      type="number"
                      value={readingGlassData.price}
                      onChange={(e) => setReadingGlassData({ ...readingGlassData, price: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Discount (₹)
                    </label>
                    <input
                      id="reading-glass-discount-input"
                      type="number"
                      value={readingGlassData.discount}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        const maxDiscount = readingGlassData.quantity * readingGlassData.price;
                        if (val > maxDiscount) {
                          addToast('Invalid Discount', 'Discount cannot exceed the item price.', 'warning');
                          setReadingGlassData({ ...readingGlassData, discount: maxDiscount });
                        } else {
                          setReadingGlassData({ ...readingGlassData, discount: val });
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                    />
                  </div>
                </div>
              </div>
              )}
            </div>
          )}
        </div>

        {/* Lens Selection */}
        <div className="p-6 bg-white dark:bg-slate-800/80 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Eye className="w-5 h-5 text-indigo-600" />
              Ophthalmic Lens Selection
            </h3>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                id="toggle-include-lens"
                type="checkbox"
                checked={includeLens}
                onChange={(e) => setIncludeLens(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              <span className="ml-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                Include Lens
              </span>
            </label>
          </div>

          {includeLens && (
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Lens Type (Select or Type Custom)
                </label>
                <div className="space-y-1.5">
                  <input
                    id="lens-type-input"
                    type="text"
                    list="lens-type-options"
                    value={lensData.lensType}
                    onChange={(e) => setLensData({ ...lensData, lensType: e.target.value })}
                    placeholder="Type custom lens or choose..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-900 dark:text-white"
                  />
                  <datalist id="lens-type-options">
                    <option value="Single Vision" />
                    <option value="Kryptok Bifocal" />
                    <option value="D-Bifocal" />
                    <option value="Progressive (Varilux / Hoya)" />
                    <option value="Zero Power BlueCut" />
                    <option value="Photochromic / Photogray" />
                    <option value="Executive Bifocal" />
                    <option value="Toric / Astigmatic Lens" />
                    <option value="Cosmetic Color Lens" />
                  </datalist>

                  {/* Quick selection chips */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {['Single Vision', 'Kryptok Bifocal', 'D-Bifocal', 'Progressive', 'BlueCut'].map((lt) => (
                      <button
                        type="button"
                        key={lt}
                        onClick={() => setLensData({ ...lensData, lensType: lt })}
                        className={`px-2 py-0.5 text-[10px] rounded-lg border font-medium cursor-pointer transition-colors ${
                          lensData.lensType.toLowerCase().includes(lt.toLowerCase())
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {lt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Brand + Product / Model Name — same two-field structure as
                  Add Stock's Lens form (was one combined "Brand & Index"
                  search box before, which didn't match Add Stock at all). */}
              <div className="grid grid-cols-2 gap-3">
                <TextAutosuggest
                  id="lens-brand-input"
                  label="Brand"
                  options={lensBrandOptions}
                  value={lensData.brand}
                  onChange={(brand) => setLensData({ ...lensData, brand, medicineId: undefined })}
                  placeholder="e.g. Essilor"
                />
                <InventorySearchPicker
                  id="lens-product-name-input"
                  label="Product / Model Name"
                  items={lensProductOptions}
                  value={lensData.productName}
                  displayItem={(m) => m.name}
                  onSearchChange={(value) => setLensData({ ...lensData, productName: value, medicineId: undefined })}
                  onSelect={applyLensSelection}
                  placeholder="e.g. Crizal Prevencia"
                  hint={lensData.medicineId ? `Selected from inventory — Available Stock: ${lensInventory.find((m) => m.id === lensData.medicineId)?.availableStock ?? 0}` : undefined}
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Code</label>
                <input
                  id="lens-code-input"
                  type="text"
                  value={lensData.code || ''}
                  onChange={(e) => setLensData({ ...lensData, code: e.target.value })}
                  placeholder="Auto (from inventory)"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                />
              </div>

              {/* Coatings toggles */}
              <div className="flex flex-wrap gap-2 pt-1">
                <label className={`px-3 py-1.5 rounded-xl border text-xs cursor-pointer font-medium transition-all ${lensData.blueCut ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                  <input
                    type="checkbox"
                    checked={lensData.blueCut}
                    onChange={(e) => setLensData({ ...lensData, blueCut: e.target.checked })}
                    className="hidden"
                  />
                  Blue Cut Filter
                </label>

                <label className={`px-3 py-1.5 rounded-xl border text-xs cursor-pointer font-medium transition-all ${lensData.photochromic ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                  <input
                    type="checkbox"
                    checked={lensData.photochromic}
                    onChange={(e) => setLensData({ ...lensData, photochromic: e.target.checked })}
                    className="hidden"
                  />
                  Photochromic (Transitions)
                </label>

                <label className={`px-3 py-1.5 rounded-xl border text-xs cursor-pointer font-medium transition-all ${lensData.antiGlare ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                  <input
                    type="checkbox"
                    checked={lensData.antiGlare}
                    onChange={(e) => setLensData({ ...lensData, antiGlare: e.target.checked })}
                    className="hidden"
                  />
                  Anti-Glare Coating (ARC)
                </label>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Lens Price (₹)
                </label>
                <input
                  id="lens-price-input"
                  type="number"
                  value={lensData.price}
                  onChange={(e) => setLensData({ ...lensData, price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 4a2: CONTACT LENS SELECTION */}
      <div className="p-6 bg-white dark:bg-slate-800/80 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Eye className="w-5 h-5 text-indigo-600" />
            Contact Lens Selection
          </h3>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              id="toggle-include-contact-lens"
              type="checkbox"
              checked={includeContactLens}
              onChange={(e) => setIncludeContactLens(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            <span className="ml-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Include Contact Lens
            </span>
          </label>
        </div>

        {includeContactLens && (
          <div className="space-y-3 text-xs">
            {/* Brand + Product / Model Name + Code — same field structure as
                Add Stock's Contact Lens form (was one combined brand+name
                search box before, with no Code field at all). */}
            <div className="grid grid-cols-3 gap-3">
              <TextAutosuggest
                id="contact-lens-brand-input"
                label="Brand"
                options={contactLensBrandOptions}
                value={contactLensData.brand}
                onChange={(brand) => setContactLensData({ ...contactLensData, brand, medicineId: undefined })}
                placeholder="e.g. Bausch & Lomb"
              />
              <InventorySearchPicker
                id="contact-lens-product-name-input"
                label="Product / Model Name"
                items={contactLensProductOptions}
                value={contactLensData.productName || ''}
                displayItem={(m) => m.name}
                onSearchChange={(value) => setContactLensData({ ...contactLensData, productName: value, medicineId: undefined })}
                onSelect={applyContactLensSelection}
                placeholder="e.g. SofLens"
                hint={contactLensData.medicineId ? `Selected from inventory — Available Stock: ${contactLensInventory.find((m) => m.id === contactLensData.medicineId)?.availableStock ?? 0}` : undefined}
              />
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Code</label>
                <input
                  id="contact-lens-code-input"
                  type="text"
                  value={contactLensData.code || ''}
                  onChange={(e) => setContactLensData({ ...contactLensData, code: e.target.value })}
                  placeholder="Auto (from inventory)"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Power / Specification</label>
              <input
                id="contact-lens-power-input"
                type="text"
                value={contactLensData.power}
                onChange={(e) => setContactLensData({ ...contactLensData, power: e.target.value })}
                placeholder="e.g. -1.00 OD / -1.00 OS"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Base Curve</label>
                <input
                  id="contact-lens-base-curve-input"
                  type="text"
                  value={contactLensData.baseCurve}
                  onChange={(e) => setContactLensData({ ...contactLensData, baseCurve: e.target.value })}
                  placeholder="e.g. 8.6"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Diameter</label>
                <input
                  id="contact-lens-diameter-input"
                  type="text"
                  value={contactLensData.diameter}
                  onChange={(e) => setContactLensData({ ...contactLensData, diameter: e.target.value })}
                  placeholder="e.g. 14.2"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Eye</label>
                <select
                  id="contact-lens-eye-select"
                  value={contactLensData.eye}
                  onChange={(e) => setContactLensData({ ...contactLensData, eye: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
                >
                  <option value="Both">Both</option>
                  <option value="Right (OD)">Right (OD)</option>
                  <option value="Left (OS)">Left (OS)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Quantity</label>
                <input
                  id="contact-lens-quantity-input"
                  type="number"
                  min={1}
                  value={contactLensData.quantity}
                  onChange={(e) => {
                    const qty = Math.max(1, parseInt(e.target.value, 10) || 1);
                    const stockItem = contactLensInventory.find((m) => m.id === contactLensData.medicineId);
                    if (stockItem && qty > stockItem.availableStock) {
                      addToast('Insufficient Stock', `Only ${stockItem.availableStock} units of ${stockItem.name} are available.`, 'warning');
                      setContactLensData({ ...contactLensData, quantity: stockItem.availableStock, totalPrice: stockItem.availableStock * contactLensData.unitPrice });
                    } else {
                      setContactLensData({ ...contactLensData, quantity: qty, totalPrice: qty * contactLensData.unitPrice });
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Unit Price (₹)</label>
                <input
                  id="contact-lens-unit-price-input"
                  type="number"
                  value={contactLensData.unitPrice}
                  onChange={(e) => {
                    const unitPrice = parseFloat(e.target.value) || 0;
                    setContactLensData({ ...contactLensData, unitPrice, totalPrice: unitPrice * contactLensData.quantity });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Total (₹)</label>
                <input
                  id="contact-lens-total-price-input"
                  type="number"
                  value={contactLensData.totalPrice}
                  readOnly
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 4b: SOLUTION SELECTION */}
      <div className="p-6 bg-white dark:bg-slate-800/80 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Droplet className="w-5 h-5 text-indigo-600" />
            Solution Selection
          </h3>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              id="toggle-include-solution"
              type="checkbox"
              checked={includeSolution}
              onChange={(e) => setIncludeSolution(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            <span className="ml-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Include Solution
            </span>
          </label>
        </div>

        {includeSolution && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <TextAutosuggest
                id="solution-brand-input"
                label="Brand"
                options={effectiveSolutionBrands}
                value={solutionData.brand}
                onChange={(brand) => setSolutionData({ ...solutionData, brand, medicineId: undefined })}
              />
              <InventorySearchPicker
                id="solution-product-input"
                label="Product"
                items={solutionProductsForBrand}
                value={solutionData.product}
                displayItem={(m) => m.name}
                onSearchChange={(value) => setSolutionData({ ...solutionData, product: value, medicineId: undefined })}
                onSelect={applySolutionSelection}
                placeholder="e.g. ReNu"
                hint={solutionData.medicineId ? `Selected from inventory — Available Stock: ${solutionMatchedItem?.availableStock ?? 0}` : undefined}
              />
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Pack Size
                </label>
                <select
                  id="solution-pack-size-select"
                  value={solutionData.packSize}
                  onChange={(e) => setSolutionData({ ...solutionData, packSize: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
                >
                  <option value="60 ml">60 ml</option>
                  <option value="120 ml">120 ml</option>
                  <option value="360 ml">360 ml</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Product Code / SKU
                </label>
                <input
                  id="solution-code-input"
                  type="text"
                  value={solutionData.code || ''}
                  onChange={(e) => setSolutionData({ ...solutionData, code: e.target.value })}
                  placeholder="Auto (from inventory)"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Quantity
                </label>
                <input
                  id="solution-quantity-input"
                  type="number"
                  min="1"
                  value={solutionData.quantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    if (solutionMatchedItem && val > solutionMatchedItem.availableStock) {
                      addToast('Insufficient Stock', `Only ${solutionMatchedItem.availableStock} units of ${solutionMatchedItem.name} are available.`, 'warning');
                      setSolutionData({ ...solutionData, quantity: Math.max(1, solutionMatchedItem.availableStock) });
                    } else {
                      setSolutionData({ ...solutionData, quantity: Math.max(1, val) });
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Price (₹)
                </label>
                <input
                  id="solution-price-input"
                  type="number"
                  value={solutionData.price}
                  onChange={(e) => setSolutionData({ ...solutionData, price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Discount (₹)
                </label>
                <input
                  id="solution-discount-input"
                  type="number"
                  value={solutionData.discount}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    const maxDiscount = solutionData.quantity * solutionData.price;
                    if (val > maxDiscount) {
                      addToast('Invalid Discount', 'Discount cannot exceed the item price.', 'warning');
                      setSolutionData({ ...solutionData, discount: maxDiscount });
                    } else {
                      setSolutionData({ ...solutionData, discount: val });
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 5: PAYMENT & BILLING CALCULATION */}
      <div className="p-6 bg-white dark:bg-slate-800/80 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs space-y-6">
        <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <IndianRupee className="w-5 h-5 text-emerald-600" />
          Automated Payment Calculation & Billing
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Detailed Itemized Line Items */}
          <div className="space-y-3 text-xs bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-400">Consultation Fee</span>
              <div className="flex items-center gap-1">
                <span>₹</span>
                <input
                  id="consultation-fee-input"
                  type="number"
                  value={consultationFee}
                  onChange={(e) => setConsultationFee(parseFloat(e.target.value) || 0)}
                  className="w-20 text-right py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-400">Medicines Subtotal</span>
              <span className="font-bold">₹{medicineTotal}</span>
            </div>

            {frameTotal > 0 && (
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">Frame Subtotal</span>
                <span className="font-bold">₹{frameTotal}</span>
              </div>
            )}

            {readingGlassTotal > 0 && (
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">Reading Glass Subtotal</span>
                <span className="font-bold">₹{readingGlassTotal}</span>
              </div>
            )}

            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-400">Lens Subtotal</span>
              <span className="font-bold">₹{lensTotal}</span>
            </div>

            {solutionTotal > 0 && (
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">Solution Subtotal</span>
                <span className="font-bold">₹{solutionTotal}</span>
              </div>
            )}

            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-400">Discount</span>
              <div className="flex items-center gap-1 text-rose-600">
                <span>- ₹</span>
                <input
                  id="billing-discount-input"
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  className="w-20 text-right py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                />
              </div>
            </div>

            {settings.gstEnabled && (
              <>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400">Customer State</span>
                  <input
                    id="billing-customer-state-input"
                    type="text"
                    value={customerState}
                    onChange={(e) => setCustomerState(e.target.value)}
                    placeholder={settings.businessState || 'State'}
                    className="w-32 text-right py-1 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-xs"
                  />
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400">Taxable Amount</span>
                  <span className="font-bold">₹{taxBreakdown.taxableAmount.toLocaleString('en-IN')}</span>
                </div>

                {taxBreakdown.igstAmount > 0 ? (
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-400">IGST ({taxBreakdown.igstRate.toFixed(1)}%)</span>
                    <span className="font-bold">₹{taxBreakdown.igstAmount.toLocaleString('en-IN')}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                      <span className="text-slate-600 dark:text-slate-400">CGST ({taxBreakdown.cgstRate.toFixed(1)}%)</span>
                      <span className="font-bold">₹{taxBreakdown.cgstAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                      <span className="text-slate-600 dark:text-slate-400">SGST ({taxBreakdown.sgstRate.toFixed(1)}%)</span>
                      <span className="font-bold">₹{taxBreakdown.sgstAmount.toLocaleString('en-IN')}</span>
                    </div>
                  </>
                )}
              </>
            )}

            <div className="flex items-center justify-between pt-1 text-sm font-black text-slate-900 dark:text-white">
              <span>Grand Total</span>
              <span className="text-emerald-600 dark:text-emerald-400 text-lg">
                ₹{grandTotal.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Payment Method & Advance / Balance */}
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Advance Paid (₹)
                </label>
                <input
                  id="billing-advance-input"
                  type="number"
                  value={advance}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    if (val > grandTotal) {
                      addToast('Invalid Advance', 'Advance cannot exceed the Grand Total.', 'warning');
                      setAdvance(grandTotal);
                    } else {
                      setAdvance(val);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm text-emerald-600"
                />
                <button
                  type="button"
                  id="billing-mark-fully-paid-btn"
                  onClick={() => setAdvance(grandTotal)}
                  disabled={advance === grandTotal}
                  title="Set Advance Paid to the Grand Total so this visit shows as fully paid"
                  className="mt-1.5 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/70 disabled:bg-slate-50 dark:disabled:bg-slate-900 border border-emerald-200 dark:border-emerald-900 disabled:border-slate-200 dark:disabled:border-slate-700 text-emerald-700 dark:text-emerald-300 disabled:text-slate-400 dark:disabled:text-slate-600 disabled:cursor-not-allowed rounded-lg text-[11px] font-bold transition-all active:scale-95"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mark as Fully Paid
                </button>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Pending (₹)
                </label>
                <div className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm text-emerald-600">
                  ₹{balance.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Payment Method
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['UPI', 'Cash', 'Card', 'Mixed'] as PaymentMethod[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`py-2 rounded-xl border text-xs font-bold transition-all ${
                      paymentMethod === m
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* MAIN ACTION BUTTON */}
            <div className="pt-4 space-y-3">
              <button
                id="main-save-visit-btn"
                onClick={handleSaveVisit}
                disabled={createVisitMutation.isPending}
                className="w-full flex items-center justify-center gap-3 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm rounded-2xl shadow-md transition-all active:scale-98"
              >
                <Save className="w-4 h-4" />
                <span>{createVisitMutation.isPending ? 'Saving...' : 'Save Visit'}</span>
              </button>
              <button
                id="main-move-to-prescription-btn"
                onClick={handleMoveToPrescription}
                disabled={createVisitMutation.isPending}
                className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-black text-base rounded-2xl shadow-xl transition-all active:scale-98"
              >
                <span>{createVisitMutation.isPending ? 'Saving...' : 'Move To Prescription'}</span>
                <ArrowRight className="w-5 h-5" />
              </button>
              <p className="text-[11px] text-slate-400 text-center mt-2">
                Directly populates printable prescription, deducts medicine inventory, updates patient history & reports.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
