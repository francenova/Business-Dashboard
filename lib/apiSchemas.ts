import { z } from 'zod';

// Patients
export const addPatientSchema = z.object({
  name: z.string().min(1),
  age: z.number(),
  gender: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().optional().nullable(),
  address: z.string().optional().default(''),
  notes: z.string().optional().nullable(),
});
export const updatePatientSchema = addPatientSchema.partial();

// Suppliers
export const addSupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required.'),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  gstin: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  stateCode: z.string().optional().nullable(),
});

// Expenses
export const addExpenseSchema = z.object({
  category: z.string().min(1),
  description: z.string().min(1),
  amount: z.number(),
  date: z.string().min(1),
  vendor: z.string().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  referenceNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  paidAmount: z.number().optional().nullable(),
  productDetails: z.any().optional(),
});
export const updateExpenseSchema = addExpenseSchema.partial();

// Medicines
export const addMedicineSchema = z.object({
  name: z.string().min(1),
  brand: z.string().optional().default(''),
  category: z.string().min(1),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
  purchasePrice: z.number(),
  sellingPrice: z.number(),
  supplier: z.string().optional(),
  availableStock: z.number(),
  minimumStock: z.number(),
  barcode: z.string().optional(),
  rackNumber: z.string().optional(),
  hsnSac: z.string().optional(),
  taxRate: z.number().optional(),
  specification: z.string().optional(),
});
export const updateMedicineSchema = addMedicineSchema.partial();

export const issueStockSchema = z.object({
  idOrName: z.string().min(1),
  quantity: z.number().positive(),
});

export const purchaseStockSchema = z.object({
  category: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().min(1),
  specification: z.string().optional(),
  barcode: z.string().optional(),
  quantity: z.number().positive(),
  purchasePrice: z.number(),
  sellingPrice: z.number(),
  supplier: z.string().optional(),
  date: z.string().min(1),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
  discount: z.number().optional(),
  paidAmount: z.number().optional(),
  defaultMinimumStock: z.number().optional(),
});

// Tax rate config
export const updateTaxRateConfigSchema = z.object({
  category: z.string().min(1),
  data: z.object({
    hsnSac: z.string().optional(),
    taxRate: z.number().optional(),
    isTaxable: z.boolean().optional(),
  }),
});

// Activity log
export const addActivityLogSchema = z.object({
  timestamp: z.string().min(1),
  type: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  patientName: z.string().optional(),
  amount: z.number().optional(),
});

// Device / admin
export const enrollDeviceSchema = z.object({
  enrollmentToken: z.string().min(1),
});
export const createEnrollmentSchema = z.object({
  label: z.string().optional(),
});
export const revokeDeviceSchema = z.object({
  deviceId: z.string().min(1),
});

// Prescriptions (standalone save flow) — matches the plain snake_case
// object PrescriptionPage.tsx has always sent.
export const prescriptionSaveSchema = z
  .object({
    patient_id: z.string().nullable().optional(),
    visit_id: z.string().nullable().optional(),
    date: z.string().min(1),
    payment: z.record(z.string(), z.any()).optional(),
  })
  .passthrough();

// Visits — the full visitData shape is large (payment/visionTest/medicines/
// frame/lens/...); validating every nested field here would duplicate the
// entire Visit TypeScript interface for little real benefit over what
// Postgres' own column types already enforce. This checks the fields the
// route handler itself actually relies on.
export const createVisitSchema = z.object({
  visitData: z
    .object({
      patientId: z.string().min(1),
      patientName: z.string().optional(),
      date: z.string().min(1),
      medicines: z.array(z.any()).optional().default([]),
      payment: z.record(z.string(), z.any()),
    })
    .passthrough(),
});

export const updateVisitSchema = z.record(z.string(), z.any());

// Clinic settings — a large partial-update object; same reasoning as
// visits above, light passthrough rather than modeling every field.
export const updateSettingsSchema = z.record(z.string(), z.any());

// Bulk import — an entire database snapshot (same shape exportDataJSON
// produces). Confirms it's a real object before the per-table upsert loop,
// which already checks each array's presence itself.
export const bulkImportSchema = z.object({}).passthrough();
