import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiFetch';
import { Patient, Prescription } from '@/lib/types';
import { deriveSaleDescription } from '@/hooks/useSalesRegister';

// Customer search — the entry point into the Ledger. Reuses the same
// patients table every other search in the app uses; no duplicate data.
export function useCustomerSearch(term: string) {
  const trimmed = term.trim();

  return useQuery({
    queryKey: ['ledger-customer-search', trimmed],
    queryFn: async (): Promise<Patient[]> => apiFetch(`/api/patients?search=${encodeURIComponent(trimmed)}`),
    enabled: trimmed.length >= 2,
  });
}

export interface LedgerTransaction {
  date: string;
  type: 'Invoice' | 'Payment';
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number; // running balance immediately after this row
  prescriptionId: string; // for "open the existing invoice" click-through
}

export interface LedgerResult {
  openingBalance: number;
  transactions: LedgerTransaction[];
  periodDebit: number;
  periodCredit: number;
  closingBalance: number;
  // All-time totals (unaffected by the date filter) — the customer's real,
  // current financial position, per section 16's primary summary cards.
  totalBilled: number;
  totalPaid: number;
  totalPending: number;
}

// Debit = the sale (Invoice), Credit = the advance captured at the same
// moment (Payment) — this app has no separate payment-events table (advance
// is set once, at invoice creation; there's no way today to record a later,
// second payment against an existing invoice). So each prescription becomes
// one or two rows, both derived from that same single stored record — never
// a fabricated independent transaction. Reads `prescriptions`, not `visits`,
// because prescriptions is the confirmed superset (includes standalone
// walk-in orders with no linked visit) — the same reasoning already
// established for TSR/DSR/ESR.
export function computeCustomerLedger(
  prescriptions: Prescription[],
  filters?: { dateFrom?: string; dateTo?: string }
): LedgerResult {
  const sorted = [...prescriptions].sort((a, b) => a.date.localeCompare(b.date));

  const totalBilled = sorted.reduce((s, rx) => s + (rx.payment?.grandTotal || 0), 0);
  const totalPaid = sorted.reduce((s, rx) => s + (rx.payment?.advance || 0), 0);
  const totalPending = Math.max(0, totalBilled - totalPaid);

  const dateFrom = filters?.dateFrom;
  const dateTo = filters?.dateTo;

  let openingBalance = 0;
  if (dateFrom) {
    for (const rx of sorted) {
      if (rx.date < dateFrom) {
        openingBalance += (rx.payment?.grandTotal || 0) - (rx.payment?.advance || 0);
      }
    }
  }

  const inPeriod = sorted.filter((rx) => {
    if (dateFrom && rx.date < dateFrom) return false;
    if (dateTo && rx.date > `${dateTo}T23:59:59.999`) return false;
    return true;
  });

  let running = openingBalance;
  let periodDebit = 0;
  let periodCredit = 0;
  const transactions: LedgerTransaction[] = [];

  for (const rx of inPeriod) {
    const grandTotal = rx.payment?.grandTotal || 0;
    const advance = rx.payment?.advance || 0;
    const reference = rx.payment?.invoiceNumber || rx.displayId || rx.id;

    running += grandTotal;
    periodDebit += grandTotal;
    transactions.push({
      date: rx.date,
      type: 'Invoice',
      reference,
      description: deriveSaleDescription(rx),
      debit: grandTotal,
      credit: 0,
      balance: running,
      prescriptionId: rx.id,
    });

    if (advance > 0) {
      running -= advance;
      periodCredit += advance;
      transactions.push({
        date: rx.date,
        type: 'Payment',
        reference,
        description: 'Advance / Payment received',
        debit: 0,
        credit: advance,
        balance: running,
        prescriptionId: rx.id,
      });
    }
  }

  return {
    openingBalance,
    transactions,
    periodDebit,
    periodCredit,
    closingBalance: running,
    totalBilled,
    totalPaid,
    totalPending,
  };
}
