import { Patient, Visit, Prescription, Medicine, Expense, ActivityLog, ClinicSettings, TaxRateConfig, StockMovement, Supplier } from '@/lib/types';

export function dbRowToApp<T = Record<string, unknown>>(row: Record<string, unknown>): T {
  // Generic fallback if needed, but we'll use explicit mappers mostly
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = v;
  }
  return out as T;
}

export function mapPatient(row: Record<string, any>): Patient {
  return {
    id: row.id,
    displayId: row.display_id,
    name: row.name,
    age: row.age,
    gender: row.gender,
    phone: row.phone,
    email: row.email,
    address: row.address,
    createdDate: row.created_date,
    lastVisitDate: row.last_visit_date,
    outstandingAmount: row.outstanding_amount,
    notes: row.notes,
    state: row.state,
  };
}

export function mapVisit(row: Record<string, any>): Visit {
  return {
    id: row.id,
    displayId: row.display_id,
    patientId: row.patient_id,
    date: row.date,
    chiefComplaint: row.chief_complaint,
    symptoms: row.symptoms,
    diagnosis: row.diagnosis,
    visionTest: row.vision_test || {},
    medicines: row.medicines || [],
    contactLens: row.contact_lens,
    frame: row.frame,
    readingGlass: row.reading_glass,
    lens: row.lens,
    solution: row.solution,
    doctorNotes: row.doctor_notes,
    payment: row.payment || {},
    status: row.status,
    patientName: row.patients?.name || '',
    patientAge: row.patients?.age || 0,
    patientGender: row.patients?.gender || 'Other',
    patientPhone: row.patients?.phone || '',
    patientAddress: row.patients?.address || '',
  };
}

export function mapPrescription(row: Record<string, any>): Prescription {
  return {
    id: row.id,
    displayId: row.display_id,
    visitId: row.visit_id,
    patientId: row.patient_id,
    date: row.date,
    visionTest: row.vision_test || {},
    diagnosis: row.diagnosis,
    medicines: row.medicines || [],
    contactLens: row.contact_lens,
    frame: row.frame,
    readingGlass: row.reading_glass,
    lens: row.lens,
    solution: row.solution,
    doctorNotes: row.doctor_notes,
    payment: row.payment || {},
    printedCount: row.printed_count,
    lastPrintedAt: row.last_printed_at,
    patientName: row.patients?.name || '',
    patientAge: row.patients?.age || 0,
    patientGender: row.patients?.gender || 'Other',
    patientPhone: row.patients?.phone || '',
    patientAddress: row.patients?.address || '',
    patientDisplayId: row.patients?.display_id,
  };
}

export function mapMedicine(row: Record<string, any>): Medicine {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    category: row.category,
    batchNumber: row.batch_number,
    expiryDate: row.expiry_date,
    purchasePrice: row.purchase_price,
    sellingPrice: row.selling_price,
    supplier: row.supplier,
    availableStock: row.available_stock,
    minimumStock: row.minimum_stock,
    barcode: row.barcode,
    rackNumber: row.rack_number,
    hsnSac: row.hsn_sac,
    taxRate: row.tax_rate === null ? undefined : row.tax_rate,
    specification: row.specification || undefined,
  };
}

export function mapStockMovement(row: Record<string, any>): StockMovement {
  return {
    id: row.id,
    itemId: row.item_id || undefined,
    itemName: row.item_name,
    category: row.category,
    movementType: row.movement_type,
    quantity: row.quantity,
    reason: row.reason || undefined,
    reference: row.reference || undefined,
    notes: row.notes || undefined,
    date: row.date,
  };
}

export function mapExpense(row: Record<string, any>): Expense {
  return {
    id: row.id,
    displayId: row.display_id,
    category: row.category,
    description: row.description,
    amount: row.amount,
    date: row.date,
    vendor: row.vendor,
    paymentMethod: row.payment_method,
    referenceNumber: row.reference_number,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // null/undefined paid_amount means "fully paid" — see Expense.paidAmount.
    paidAmount: row.paid_amount === null || row.paid_amount === undefined ? row.amount : row.paid_amount,
    // Stored (and read back) as-is — appToDbRow only transforms top-level
    // keys, so the jsonb blob's own keys stay camelCase round-trip.
    productDetails: row.product_details || undefined,
  };
}

export function mapSupplier(row: Record<string, any>): Supplier {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone || undefined,
    address: row.address || undefined,
    gstin: row.gstin || undefined,
    state: row.state || undefined,
    stateCode: row.state_code || undefined,
    createdAt: row.created_at,
    isActive: row.is_active ?? true,
  };
}

export function mapActivityLog(row: Record<string, any>): ActivityLog {
  return {
    id: row.id,
    timestamp: row.timestamp,
    type: row.type,
    title: row.title,
    description: row.description,
    patientName: row.patient_name,
    amount: row.amount,
  };
}

export function mapClinicSettings(row: Record<string, any>): ClinicSettings {
  return {
    id: row.id || 1,
    clinicName: row.clinic_name,
    businessTypes: row.business_types || [],
    address: row.address,
    phone: row.phone,
    email: row.email,
    doctorName: row.doctor_name,
    doctorTitle: row.doctor_title,
    credentials: row.credentials,
    registrationNumber: row.registration_number,
    gstin: row.gstin,
    defaultConsultationFee: row.default_consultation_fee,
    defaultPrinter: row.default_printer,
    currencySymbol: row.currency_symbol,
    currency: row.currency,
    language: row.language,
    logoUrl: row.logo_url,
    enableAutoSave: row.enable_auto_save,
    theme: row.theme,
    updatedAt: row.updated_at,
    gstEnabled: row.gst_enabled || false,
    businessState: row.business_state,
    stateCode: row.state_code,
    registrationType: row.registration_type,
    taxMode: row.tax_mode || 'exclusive',
    defaultGstRate: row.default_gst_rate || 0,
    taxRounding: row.tax_rounding || 'nearest_rupee',
    invoicePrefix: row.invoice_prefix || 'INV',
    showLogoOnDocuments: row.show_logo_on_documents ?? true,
    showGstDetailsOnInvoice: row.show_gst_details_on_invoice ?? true,
    showTermsOnInvoice: row.show_terms_on_invoice ?? false,
    invoiceTermsText: row.invoice_terms_text,
    showDoctorDetailsOnPrescription: row.show_doctor_details_on_prescription ?? true,
    showPatientContactOnPrescription: row.show_patient_contact_on_prescription ?? true,
    showNotesOnPrescription: row.show_notes_on_prescription ?? true,
    lowStockAlertsEnabled: row.low_stock_alerts_enabled ?? true,
    defaultMinimumStock: row.default_minimum_stock ?? 5,
  };
}

export function mapTaxRateConfig(row: Record<string, any>): TaxRateConfig {
  return {
    category: row.category,
    hsnSac: row.hsn_sac,
    taxRate: row.tax_rate || 0,
    isTaxable: row.is_taxable ?? true,
  };
}

export function appToDbRow(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    // Don't map displayId back to DB on inserts/updates unless explicitly named display_id
    if (k === 'displayId') continue;
    out[k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)] = v;
  }
  return out;
}
