import type { ClinicSettings } from '@/lib/types';
import type { SalesSummary } from '@/hooks/useSalesRegister';
import type { ExpenseSummary } from '@/hooks/useExpenses';
import type { CategoryBreakdownRow, TopMedicineRow, PatientAnalysis, VisitAnalysis, OutstandingCustomerRow } from '@/hooks/useReportAnalysis';

const MARGIN_X = 12;
const MARGIN_TOP = 10;
const MARGIN_BOTTOM = 16;
const LETTERHEAD_HEIGHT = 26;
const SLIM_HEADER_HEIGHT = 10;
const STRUCTURAL_LINE_WEIGHT = 0.3;
const HAIRLINE_WEIGHT = 0.15;

function money(n?: number): string {
  return `Rs. ${(n || 0).toLocaleString('en-IN')}`;
}

export interface ReportAnalysisPdfOptions {
  settings: ClinicSettings;
  periodHeading: string;
  from: string;
  to: string;
  sales: SalesSummary;
  expenses: ExpenseSummary;
  categoryBreakdown: CategoryBreakdownRow[];
  topMedicines: TopMedicineRow[];
  patients: PatientAnalysis;
  visits: VisitAnalysis;
  outstandingByCustomer: OutstandingCustomerRow[];
  reportTable: { key: string; label: string; sales: number; collection: number; tax: number; invoiceCount: number; expense: number; pending: number }[];
  avgInvoiceValue: number;
}

// Report & Analysis is a sequence of independently-sized sections (unlike
// TSR/DSR/Ledger's single dense row table), so pagination here is a running
// cursor that breaks to a new page whenever the next section wouldn't fit —
// rather than DSR's upfront row-count formula. Footers are drawn in a
// second pass once the true page count is known, using jsPDF's setPage().
export async function generateReportAnalysisPDF(opts: ReportAnalysisPdfOptions): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { loadLogoAsPngDataUrl, fitLogoBox } = await import('@/lib/pdfLogo');
  const logo = opts.settings.showLogoOnDocuments ? await loadLogoAsPngDataUrl(opts.settings.logoUrl) : null;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN_X * 2;

  let cursorY = MARGIN_TOP;

  const drawLetterhead = () => {
    const y = MARGIN_TOP;
    let textX = MARGIN_X;
    if (logo) {
      const box = fitLogoBox(logo, 14, 12);
      pdf.addImage(logo.dataUrl, 'PNG', MARGIN_X, y, box.w, box.h);
      textX = MARGIN_X + box.w + 3;
    }
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.text(opts.settings.clinicName || 'Royal Opticals', textX, y + 6);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    const contactLine = [opts.settings.address, opts.settings.phone, opts.settings.email].filter(Boolean).join('  •  ');
    if (contactLine) pdf.text(contactLine, textX, y + 11);
    if (opts.settings.gstin) pdf.text(`GSTIN: ${opts.settings.gstin}`, textX, y + 15.5);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('REPORT & ANALYSIS', pageWidth - MARGIN_X, y + 6, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text(`Period: ${opts.periodHeading}`, pageWidth - MARGIN_X, y + 11, { align: 'right' });

    pdf.setDrawColor(15, 23, 42);
    pdf.setLineWidth(STRUCTURAL_LINE_WEIGHT);
    pdf.line(MARGIN_X, y + LETTERHEAD_HEIGHT - 4, pageWidth - MARGIN_X, y + LETTERHEAD_HEIGHT - 4);
    return MARGIN_TOP + LETTERHEAD_HEIGHT;
  };

  const drawSlimHeader = () => {
    const y = MARGIN_TOP;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(opts.settings.clinicName || 'Royal Opticals', MARGIN_X, y + 4);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.text('REPORT & ANALYSIS — CONTINUED', pageWidth - MARGIN_X, y + 4, { align: 'right' });
    pdf.setDrawColor(15, 23, 42);
    pdf.setLineWidth(STRUCTURAL_LINE_WEIGHT);
    pdf.line(MARGIN_X, y + SLIM_HEADER_HEIGHT - 2, pageWidth - MARGIN_X, y + SLIM_HEADER_HEIGHT - 2);
    return MARGIN_TOP + SLIM_HEADER_HEIGHT;
  };

  const newPage = () => {
    pdf.addPage();
    cursorY = drawSlimHeader();
  };

  // Breaks to a new page if the next block (of the given height) would not
  // fit above the footer zone — keeps every section intact, never cut
  // mid-way, per section 26's "do not allow overlap" requirement.
  const ensureSpace = (height: number) => {
    if (cursorY + height > pageHeight - MARGIN_BOTTOM) newPage();
  };

  const sectionTitle = (title: string) => {
    ensureSpace(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    pdf.text(title.toUpperCase(), MARGIN_X, cursorY + 5);
    cursorY += 8;
  };

  const drawStatRow = (cells: [string, string][]) => {
    const rowHeight = 15;
    ensureSpace(rowHeight);
    const colWidth = contentWidth / cells.length;
    pdf.setDrawColor(15, 23, 42);
    pdf.setLineWidth(STRUCTURAL_LINE_WEIGHT);
    pdf.rect(MARGIN_X, cursorY, contentWidth, rowHeight);
    cells.forEach(([label, value], i) => {
      const cx = MARGIN_X + colWidth * i + colWidth / 2;
      if (i > 0) pdf.line(MARGIN_X + colWidth * i, cursorY, MARGIN_X + colWidth * i, cursorY + rowHeight);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.5);
      pdf.setTextColor(100, 100, 100);
      pdf.text(label, cx, cursorY + 6, { align: 'center' });
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(0, 0, 0);
      pdf.text(value, cx, cursorY + 12, { align: 'center' });
    });
    cursorY += rowHeight + 6;
  };

  const drawTable = (headers: string[], widths: number[], aligns: ('left' | 'right' | 'center')[], rows: string[][]) => {
    const rowHeight = 6.5;
    const headerHeight = 7;

    const drawHeaderRow = () => {
      pdf.setFillColor(15, 23, 42);
      pdf.rect(MARGIN_X, cursorY, contentWidth, headerHeight, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      let x = MARGIN_X;
      headers.forEach((h, i) => {
        const w = widths[i];
        const align = aligns[i];
        const textX = align === 'right' ? x + w - 1.5 : align === 'center' ? x + w / 2 : x + 1.5;
        pdf.text(h, textX, cursorY + headerHeight / 2 + 1, { align: align === 'left' ? 'left' : align });
        x += w;
      });
      pdf.setTextColor(0, 0, 0);
      cursorY += headerHeight;
    };

    ensureSpace(headerHeight + rowHeight);
    const tableTopY = cursorY;
    drawHeaderRow();

    rows.forEach((row, idx) => {
      if (cursorY + rowHeight > pageHeight - MARGIN_BOTTOM) {
        pdf.setDrawColor(15, 23, 42);
        pdf.setLineWidth(STRUCTURAL_LINE_WEIGHT);
        pdf.rect(MARGIN_X, tableTopY, contentWidth, cursorY - tableTopY);
        newPage();
        drawHeaderRow();
      }
      if (idx % 2 === 1) {
        pdf.setFillColor(248, 250, 252);
        pdf.rect(MARGIN_X, cursorY, contentWidth, rowHeight, 'F');
      }
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      let x = MARGIN_X;
      row.forEach((val, i) => {
        const w = widths[i];
        const align = aligns[i];
        const textX = align === 'right' ? x + w - 1.5 : align === 'center' ? x + w / 2 : x + 1.5;
        const lines = pdf.splitTextToSize(val || '-', w - 2.5);
        const display = lines.length > 1 ? `${lines[0]}…` : lines[0] || '-';
        pdf.text(display, textX, cursorY + rowHeight / 2 + 1.5, { align: align === 'left' ? 'left' : align });
        x += w;
      });
      cursorY += rowHeight;
    });

    pdf.setDrawColor(15, 23, 42);
    pdf.setLineWidth(STRUCTURAL_LINE_WEIGHT);
    pdf.rect(MARGIN_X, tableTopY, contentWidth, cursorY - tableTopY);
    cursorY += 8;
  };

  const drawFooter = (pageNum: number, totalPages: number) => {
    const y = pageHeight - 8;
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(HAIRLINE_WEIGHT);
    pdf.line(MARGIN_X, y - 4, pageWidth - MARGIN_X, y - 4);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(100, 100, 100);
    pdf.text(opts.settings.clinicName || 'Royal Opticals', MARGIN_X, y);
    pdf.text('Report & Analysis', pageWidth / 2, y, { align: 'center' });
    pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth - MARGIN_X, y, { align: 'right' });
    pdf.setTextColor(0, 0, 0);
  };

  // ── Page 1: letterhead + Summary ─────────────────────────────────────
  cursorY = drawLetterhead();
  sectionTitle('Summary');
  drawStatRow([
    ['Sales', money(opts.sales.grandTotal)],
    ['Collection', money(opts.sales.collected)],
    ['Expenses', money(opts.expenses.total)],
    ['Pending', money(opts.sales.pending)],
    ['GST', money(opts.sales.totalTax)],
    ['Invoices', String(opts.sales.totalInvoices)],
  ]);

  // ── Sales Analysis ────────────────────────────────────────────────────
  if (opts.reportTable.length > 0) {
    sectionTitle('Sales Analysis');
    drawTable(
      ['Date', 'Sales', 'Collection', 'Expenses', 'GST', 'Invoices', 'Pending'],
      [38, 26, 28, 26, 24, 20, 24],
      ['left', 'right', 'right', 'right', 'right', 'right', 'right'],
      opts.reportTable.map((r) => [
        r.label,
        money(r.sales),
        money(r.collection),
        money(r.expense),
        money(r.tax),
        String(r.invoiceCount),
        money(r.pending),
      ])
    );
  }

  // ── Expense Analysis ──────────────────────────────────────────────────
  const expenseCategoryRows = Object.entries(opts.expenses.byCategory).filter(([, v]) => (v || 0) > 0);
  if (expenseCategoryRows.length > 0) {
    sectionTitle('Expense Analysis');
    drawTable(
      ['Category', 'Amount'],
      [contentWidth - 40, 40],
      ['left', 'right'],
      expenseCategoryRows
        .sort(([, a], [, b]) => (b || 0) - (a || 0))
        .map(([cat, amt]) => [cat, money(amt)])
    );
  }

  // ── GST Summary ────────────────────────────────────────────────────────
  sectionTitle('GST Summary');
  drawStatRow([
    ['Taxable', money(opts.sales.taxableAmount)],
    ['CGST', money(opts.sales.cgstTotal)],
    ['SGST', money(opts.sales.sgstTotal)],
    ['IGST', money(opts.sales.igstTotal)],
    ['Total GST', money(opts.sales.totalTax)],
  ]);

  // ── Payment Analysis ───────────────────────────────────────────────────
  const methods: Array<'Cash' | 'UPI' | 'Card' | 'Mixed'> = ['Cash', 'UPI', 'Card', 'Mixed'];
  const usedMethods = methods.filter((m) => opts.sales.byPaymentMethod[m].count > 0);
  if (usedMethods.length > 0) {
    sectionTitle('Payment Analysis');
    drawStatRow(usedMethods.map((m) => [`${m} (${opts.sales.byPaymentMethod[m].count})`, money(opts.sales.byPaymentMethod[m].amount)]));
  }

  // ── Invoice Analysis ───────────────────────────────────────────────────
  sectionTitle('Invoice Analysis');
  drawStatRow([
    ['Total', String(opts.sales.totalInvoices)],
    ['Paid', String(opts.sales.byStatus.Paid)],
    ['Partial', String(opts.sales.byStatus.Partial)],
    ['Pending', String(opts.sales.byStatus.Pending)],
    ['Avg Value', money(opts.avgInvoiceValue)],
  ]);

  // ── Category Analysis ──────────────────────────────────────────────────
  if (opts.categoryBreakdown.length > 0) {
    sectionTitle('Category Analysis');
    drawTable(
      ['Category', 'Quantity', 'Amount'],
      [contentWidth - 70, 30, 40],
      ['left', 'right', 'right'],
      opts.categoryBreakdown.map((r) => [r.category, String(r.quantity), money(r.amount)])
    );
  }

  if (opts.topMedicines.length > 0) {
    sectionTitle('Top Selling Medicines');
    drawTable(
      ['Product', 'Category', 'Qty', 'Amount'],
      [contentWidth - 84, 34, 20, 30],
      ['left', 'left', 'right', 'right'],
      opts.topMedicines.map((r) => [r.name, r.category, String(r.quantity), money(r.amount)])
    );
  }

  // ── Outstanding ────────────────────────────────────────────────────────
  if (opts.outstandingByCustomer.length > 0) {
    sectionTitle('Outstanding by Customer');
    drawTable(
      ['Customer', 'Pending'],
      [contentWidth - 40, 40],
      ['left', 'right'],
      opts.outstandingByCustomer.map((r) => [r.patientName, money(r.pending)])
    );
  }

  // ── Closing Summary ────────────────────────────────────────────────────
  sectionTitle('Closing Summary');
  drawStatRow([
    ['Total Patients', String(opts.patients.totalPatients)],
    ['New Patients', String(opts.patients.newPatients)],
    ['Returning', String(opts.patients.returningPatients)],
    ['Total Visits', String(opts.visits.totalVisits)],
    ['Completed', String(opts.visits.byStatus.Completed)],
  ]);

  const totalPages = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    drawFooter(p, totalPages);
  }

  const safeHeading = opts.periodHeading.replace(/\s+/g, '_').replace(/[^\w-]/g, '');
  pdf.save(`Report_Analysis_${safeHeading}.pdf`);
}
