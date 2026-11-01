export type Gender = 'Male' | 'Female' | 'Other';

export interface Patient {
  id: string; // uuid
  displayId: string; // e.g., 'PAT-1001'
  name: string;
  age: number;
  gender: Gender;
  phone: string;
  email?: string;
  address: string;
  createdDate: string; // ISO date
  lastVisitDate?: string;
  outstandingAmount: number;
  notes?: string;
  state?: string; // for GST place-of-supply comparison
}

export interface EyeVisionData {
  sph: string; // e.g. -1.50
  cyl: string; // e.g. -0.50
  axis: string; // e.g. 90
  add: string; // e.g. +2.00
  nearCyl?: string; // e.g. -0.50
  nearAxis?: string; // e.g. 90
  pd: string; // e.g. 62
  va: string; // e.g. 6/6
}

export interface VisionTest {
  rightEye: EyeVisionData;
  leftEye: EyeVisionData;
  iopRight?: string;
  iopLeft?: string;
  notes?: string;
}

export interface PrescribedMedicine {
  id: string;
  medicineId: string;
  medicineName: string;
  morning: number;
  afternoon: number;
  night: number;
  days: number;
  totalQty: number;
  unitPrice: number;
  totalPrice: number;
  instructions: string; // e.g. "1 drop 3 times daily"
  inStock: number;
  isLowStock?: boolean;
  isOutOfStock?: boolean;
}

export interface FrameSelection {
  // Reused inventory (Medicine rows with category 'Frame') — set when picked
  // from a search result; absent when hand-typed with no matching stock.
  // (Was `frameId` — renamed for consistency; the old field was never read
  // or written anywhere, so this is a safe rename, not a behavior change.)
  medicineId?: string;
  frameName: string;
  brand: string;
  code: string;
  type: 'Full Rim' | 'Half Rim' | 'Rimless' | 'Sunglasses' | 'Shell' | 'Other';
  price: number;
  discount: number;
  finalAmount: number;
}

export interface ReadingGlassSelection {
  // Reused inventory (Medicine rows with category 'Reading Glass') — set when
  // picked from a search result; absent when hand-typed with no matching stock.
  medicineId?: string;
  variant: 'Pen Type' | 'Pouch Type';
  brand: string;
  productName: string;
  code: string;
  readingPower: string; // e.g. '+2.00'
  quantity: number;
  price: number;
  discount: number;
  finalAmount: number;
}

export interface SolutionSelection {
  // Reused inventory (Medicine rows with category 'Solution') — set when
  // picked from a search result; absent when hand-typed with no matching stock.
  medicineId?: string;
  brand: string;
  product: string;
  // Product code/SKU — auto-filled from the matched inventory item, but
  // editable (typing an existing code re-fills the rest of the fields),
  // same convention as Frame/Lens/Contact Lens's Code field.
  code?: string;
  packSize: string;
  quantity: number;
  price: number;
  discount: number;
  finalAmount: number;
}

export interface LensSelection {
  // Reused inventory (Medicine rows with category 'Lens') — set when picked
  // from a search result; absent when hand-typed with no matching stock.
  medicineId?: string;
  // Free-text with suggestions (the form uses an <input list="..."> datalist,
  // not a <select>), so this is deliberately a string rather than a strict
  // union — matches the actual UI behavior.
  lensType: string;
  // Brand and Product/Model Name are separate fields — matches Add Stock's
  // Lens form exactly (Brand + "Product / Model Name"), so the same product
  // structure/naming is used on both the purchase side and the sale side.
  brand: string;
  productName: string;
  // Product code/SKU, auto-filled from the matched inventory item (read-only
  // in the UI, like Solution's Product Code/SKU field) — undefined when
  // hand-typed with no matching stock.
  code?: string;
  index: '1.50' | '1.56' | '1.60 High Index' | '1.67 Polycarbonate' | '1.74 Ultra Thin';
  coating: string;
  blueCut: boolean;
  photochromic: boolean;
  antiGlare: boolean;
  price: number;
}

export interface ContactLensSelection {
  // Reused inventory (Medicine rows with category 'Contact Lens') — set when
  // picked from a search result; absent when hand-typed with no matching stock.
  medicineId?: string;
  // Brand and Product/Model Name are separate fields — matches Add Stock's
  // Contact Lens form (Brand + "Product / Model Name"), same as Lens.
  brand: string;
  productName?: string;
  // Product code/SKU — auto-filled from the matched inventory item, but
  // editable (typing an existing code re-fills the rest of the fields).
  code?: string;
  power: string;
  baseCurve: string;
  diameter: string;
  eye: 'Both' | 'Right (OD)' | 'Left (OS)';
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export type PaymentMethod = 'Cash' | 'UPI' | 'Card' | 'Mixed';

export interface PaymentDetails {
  consultationFee: number;
  medicineTotal: number;
  lensTotal: number;
  frameTotal: number;
  readingGlassTotal: number;
  solutionTotal: number;
  contactLensTotal: number;
  additionalCharges: number;
  discount: number;
  subtotal: number;
  grandTotal: number;
  advance: number;
  balance: number;
  paymentMethod: PaymentMethod;
  invoiceNumber: string; // e.g. 'INV-2026-0042'
  paymentDate: string;
  status: 'Paid' | 'Partial' | 'Pending';

  // GST/Tax — all optional. Absent/undefined on every record created before
  // GST was enabled, and on any record created while it's off; never
  // fabricated. Computed once by lib/taxEngine.ts at billing time and saved
  // here — Invoice and TSR only ever read these, never recompute.
  placeOfSupply?: string;
  taxMode?: 'inclusive' | 'exclusive';
  taxableAmount?: number;
  cgstRate?: number;
  cgstAmount?: number;
  sgstRate?: number;
  sgstAmount?: number;
  igstRate?: number;
  igstAmount?: number;
  totalTax?: number;
}

export interface Visit {
  id: string; // uuid
  displayId: string; // e.g. 'VIS-5001'
  patientId: string; // uuid
  patientName: string; // mapped from join
  patientAge: number;
  patientGender: Gender;
  patientPhone: string;
  patientAddress: string;
  date: string;
  chiefComplaint: string;
  symptoms: string;
  diagnosis: string;
  visionTest: VisionTest;
  medicines: PrescribedMedicine[];
  contactLens?: ContactLensSelection;
  frame?: FrameSelection;
  readingGlass?: ReadingGlassSelection;
  lens?: LensSelection;
  solution?: SolutionSelection;
  doctorNotes: string;
  payment: PaymentDetails;
  status: 'Completed' | 'Pending Delivery' | 'Ready Order' | 'In Progress';
}

export interface Medicine {
  id: string; // uuid
  name: string;
  brand: string;
  category: 'Eye Drops' | 'Tablets' | 'Ointment' | 'Capsules' | 'Solution' | 'Reading Glass' | 'Frame' | 'Lens' | 'Contact Lens';
  batchNumber: string;
  expiryDate: string; // YYYY-MM
  purchasePrice: number;
  sellingPrice: number;
  supplier: string;
  availableStock: number;
  minimumStock: number;
  barcode: string;
  rackNumber: string;
  hsnSac?: string;
  taxRate?: number; // null/undefined = use the Medicines category default
  // Generic descriptor reused per category — Frame Type for Frame rows,
  // Lens Specification for Lens rows, Power/Spec for Contact Lens rows.
  // Not applicable to plain medicines.
  specification?: string;
}

export interface Prescription {
  id: string; // uuid
  displayId: string; // e.g. 'RX-8001'
  visitId: string; // uuid
  patientId: string; // uuid
  patientDisplayId?: string; // e.g. 'PAT-1001' — mapped from join
  patientName: string; // mapped from join
  patientAge: number;
  patientGender: Gender;
  patientPhone: string;
  patientAddress: string;
  date: string;
  visionTest: VisionTest;
  diagnosis: string;
  medicines: PrescribedMedicine[];
  contactLens?: ContactLensSelection;
  frame?: FrameSelection;
  readingGlass?: ReadingGlassSelection;
  lens?: LensSelection;
  solution?: SolutionSelection;
  doctorNotes: string;
  payment: PaymentDetails;
  printedCount: number;
  lastPrintedAt?: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  type: 'patient' | 'visit' | 'prescription' | 'medicine' | 'payment' | 'inventory';
  title: string;
  description: string;
  patientName?: string;
  amount?: number;
}

export type ExpenseCategory =
  | 'Rent'
  | 'Electricity'
  | 'Water'
  | 'Internet'
  | 'Staff Salary'
  | 'Transport'
  | 'Maintenance'
  | 'Cleaning'
  | 'Office Supplies'
  | 'Medical / Clinic Supplies'
  | 'Equipment'
  | 'Software / Subscription'
  | 'Marketing'
  | 'Purchase'
  | 'Frame'
  | 'Reading Glass'
  | 'Lens'
  | 'Solution'
  | 'Contact Lens'
  | 'Miscellaneous';

export type ExpensePaymentMethod = 'Cash' | 'UPI' | 'Card' | 'Bank Transfer' | 'Other';

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  gstin?: string;
  state?: string;
  stateCode?: string;
  createdAt?: string;
  // Soft-delete flag — false once removed via deleteSupplier(). Historical
  // expenses/medicines still reference the supplier's name in plain text
  // and are never touched by this.
  isActive?: boolean;
}

// Structured snapshot of an Add Stock purchase, captured once at the time
// of purchase — the one flexible piece the "90% common columns" table
// design relies on: every stock category fills the same shape (productName/
// brand/code/specification/quantity/prices), so one table component can
// render Frame, Lens, Solution, Contact Lens, and Medicine rows identically.
// `code` holds the item's barcode/SKU for every category except Medicine,
// where it holds the batch number instead (Medicine has no barcode field).
export interface ExpenseProductDetails {
  productName: string;
  brand: string;
  code?: string;
  specification?: string;
  quantity: number;
  unitPurchasePrice: number;
  unitSellingPrice: number;
}

export interface Expense {
  id: string;
  displayId?: string; // e.g. 'EXP-1001'
  category: ExpenseCategory;
  description: string;
  amount: number;
  date: string;
  vendor?: string;
  paymentMethod?: ExpensePaymentMethod;
  referenceNumber?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  // How much was actually paid at the time of this transaction. Undefined
  // means "fully paid" (== amount) — true for every expense recorded before
  // this field existed and for the plain Add Expense flow. Only Add Stock
  // purchases can set this below `amount` to record a partial/credit purchase.
  paidAmount?: number;
  // Present only for rows created via Add Stock — see ExpenseProductDetails.
  productDetails?: ExpenseProductDetails;
}

export interface ClinicSettings {
  id: number;
  clinicName: string;
  businessTypes: string[];
  address: string;
  phone: string;
  email: string;
  doctorName: string;
  doctorTitle: string;
  credentials?: string;
  registrationNumber: string;
  gstin?: string;
  defaultConsultationFee: number;
  defaultPrinter: string;
  currencySymbol: string;
  currency?: string;
  language?: string;
  logoUrl?: string;
  enableAutoSave: boolean;
  theme: 'light' | 'dark' | 'system';
  updatedAt?: string;

  // GST / Tax — gstEnabled defaults false; everything else here is inert
  // until an admin turns it on and fills in real values.
  gstEnabled: boolean;
  businessState?: string;
  stateCode?: string;
  registrationType?: 'Regular' | 'Composition' | 'Unregistered' | 'Other';
  taxMode: 'inclusive' | 'exclusive';
  defaultGstRate: number;
  taxRounding: 'none' | 'nearest_rupee';

  // Invoice & Print — invoicePrefix only affects invoice numbers generated
  // from now on (next_invoice_number() reads it); already-issued numbers in
  // past records are untouched. All display toggles default true (or false
  // for showTermsOnInvoice, since there's no terms text yet) so nothing on
  // any document changes until deliberately turned off.
  invoicePrefix: string;
  showLogoOnDocuments: boolean;
  showGstDetailsOnInvoice: boolean;
  showTermsOnInvoice: boolean;
  invoiceTermsText?: string;

  // Prescription print
  showDoctorDetailsOnPrescription: boolean;
  showPatientContactOnPrescription: boolean;
  showNotesOnPrescription: boolean;

  // Inventory — defaultMinimumStock only prefills the Add Medicine form;
  // it never overrides an existing item's own minimumStock.
  lowStockAlertsEnabled: boolean;
  defaultMinimumStock: number;
}

// Category-level default GST rate for the product types with no real
// catalog table (Frame/Lens/Reading Glass/Solution/Contact Lens/
// Consultation — see hooks/useSalesRegister.ts's deriveSaleDescription for
// the same category vocabulary). Medicines uses its own per-item
// Medicine.hsnSac/taxRate instead.
export type TaxCategory = 'Frame' | 'Lens' | 'Reading Glass' | 'Solution' | 'Contact Lens' | 'Consultation';

export interface TaxRateConfig {
  category: TaxCategory;
  hsnSac?: string;
  taxRate: number;
  isTaxable: boolean;
}

export type NavigationPage =
  | 'dashboard'
  | 'patients'
  | 'patient-profile'
  | 'patient-visit'
  | 'prescription'
  | 'inventory'
  | 'inventory-reports'
  | 'prescription-management'
  | 'sales-register'
  | 'expense-report'
  | 'ledger'
  | 'gst-report'
  | 'reports'
  | 'settings';

// Stock movement — see hooks/useInventoryReports.ts. Only two real
// directions exist in this app (no distinct purchase-order/return flow);
// item_name/category are snapshots taken at movement time so history stays
// correct even if the medicine is later renamed, recategorized, or deleted.
export type StockMovementType = 'Stock In' | 'Stock Out';

export interface StockMovement {
  id: string;
  itemId?: string;
  itemName: string;
  category: string;
  movementType: StockMovementType;
  quantity: number;
  reason?: string;
  reference?: string;
  notes?: string;
  date: string;
}
