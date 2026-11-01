import type { TaxCategory } from '@/lib/types';

// Single source of truth for every GST calculation in the app. Called from
// exactly one place — PatientVisitPage.tsx's billing block — at the moment
// a visit is saved. Its output is written into payment (jsonb) and never
// recomputed anywhere else: Invoice and TSR only ever read what's stored
// here. That's what makes "TSR matches invoice matches billing" true by
// construction instead of by hoping three separate calculations agree.

export interface TaxLineItem {
  category: TaxCategory | 'Medicines';
  amount: number; // pre-discount line amount
  medicineTaxRate?: number; // only meaningful when category === 'Medicines'
}

export interface TaxEngineConfig {
  gstEnabled: boolean;
  taxMode: 'inclusive' | 'exclusive';
  taxRounding: 'none' | 'nearest_rupee';
  defaultGstRate: number; // fallback for medicines with no per-item rate
  categoryRates: Partial<Record<TaxCategory, { taxRate: number; isTaxable: boolean }>>;
}

export interface TaxBreakdown {
  subtotal: number;
  discount: number;
  taxableAmount: number;
  placeOfSupply: string;
  taxMode: 'inclusive' | 'exclusive';
  cgstRate: number; // effective/blended rate when line items carry different rates
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalTax: number;
  grandTotal: number;
}

function resolveLineRate(item: TaxLineItem, config: TaxEngineConfig): { rate: number; taxable: boolean } {
  if (item.category === 'Medicines') {
    const rate = item.medicineTaxRate ?? config.defaultGstRate;
    return { rate, taxable: rate > 0 || config.defaultGstRate > 0 };
  }
  const cat = config.categoryRates[item.category];
  if (!cat) return { rate: 0, taxable: false };
  return { rate: cat.taxRate, taxable: cat.isTaxable };
}

// One line's discounted amount → { taxableValue, taxAmount }, honoring
// tax-inclusive vs tax-exclusive pricing so GST is never double-charged.
function computeLineTax(discountedAmount: number, rate: number, taxable: boolean, taxMode: 'inclusive' | 'exclusive') {
  if (!taxable || rate <= 0 || discountedAmount <= 0) {
    return { taxableValue: Math.max(0, discountedAmount), taxAmount: 0 };
  }
  if (taxMode === 'inclusive') {
    const taxableValue = discountedAmount / (1 + rate / 100);
    return { taxableValue, taxAmount: discountedAmount - taxableValue };
  }
  return { taxableValue: discountedAmount, taxAmount: (discountedAmount * rate) / 100 };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeInvoiceTax(
  lineItems: TaxLineItem[],
  discount: number,
  config: TaxEngineConfig,
  businessState: string | undefined,
  placeOfSupplyState: string | undefined
): TaxBreakdown {
  const subtotal = lineItems.reduce((sum, i) => sum + i.amount, 0);
  // Local shop default: an unspecified customer state is assumed to be the
  // business's own state (most walk-in customers), not treated as an
  // unknown inter-state sale.
  const effectivePlaceOfSupply = placeOfSupplyState || businessState || '';

  if (!config.gstEnabled) {
    return {
      subtotal,
      discount,
      taxableAmount: 0,
      placeOfSupply: effectivePlaceOfSupply,
      taxMode: config.taxMode,
      cgstRate: 0, cgstAmount: 0,
      sgstRate: 0, sgstAmount: 0,
      igstRate: 0, igstAmount: 0,
      totalTax: 0,
      grandTotal: Math.max(0, round2(subtotal - discount)),
    };
  }

  // Discount → taxable value → GST → total (section 8's required order),
  // applied proportionally across lines so a single overall discount still
  // reduces each line's own taxable base correctly.
  let taxableAmount = 0;
  let totalTax = 0;
  for (const item of lineItems) {
    const discountShare = subtotal > 0 ? (item.amount / subtotal) * discount : 0;
    const discountedAmount = Math.max(0, item.amount - discountShare);
    const { rate, taxable } = resolveLineRate(item, config);
    const { taxableValue, taxAmount } = computeLineTax(discountedAmount, rate, taxable, config.taxMode);
    taxableAmount += taxableValue;
    totalTax += taxAmount;
  }
  taxableAmount = round2(taxableAmount);
  totalTax = round2(totalTax);

  const isIntraState = Boolean(businessState) && businessState === effectivePlaceOfSupply;
  const effectiveRate = taxableAmount > 0 ? (totalTax / taxableAmount) * 100 : 0;

  let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;
  let cgstRate = 0, sgstRate = 0, igstRate = 0;
  if (isIntraState) {
    cgstAmount = round2(totalTax / 2);
    sgstAmount = round2(totalTax - cgstAmount); // avoids a rounding-off rupee going missing
    cgstRate = round2(effectiveRate / 2);
    sgstRate = cgstRate;
  } else {
    igstAmount = totalTax;
    igstRate = round2(effectiveRate);
  }

  let grandTotal = taxableAmount + totalTax;
  if (config.taxRounding === 'nearest_rupee') {
    grandTotal = Math.round(grandTotal);
  } else {
    grandTotal = round2(grandTotal);
  }

  return {
    subtotal,
    discount,
    taxableAmount,
    placeOfSupply: effectivePlaceOfSupply,
    taxMode: config.taxMode,
    cgstRate, cgstAmount,
    sgstRate, sgstAmount,
    igstRate, igstAmount,
    totalTax,
    grandTotal: Math.max(0, grandTotal),
  };
}
