import type { Expense, ClinicSettings, ExpenseCategory, ExpensePaymentMethod } from '@/lib/types';
import type { ExpenseSummary, SupplierExpenseSummary } from '@/hooks/useExpenses';
import { formatDate } from '@/lib/formatDate';

const MARGIN_X = 10;
const MARGIN_TOP = 10;
const MARGIN_BOTTOM = 16;
const LETTERHEAD_HEIGHT = 30;
const SLIM_HEADER_HEIGHT = 10;
const STRUCTURAL_LINE_WEIGHT = 0.3;
const HAIRLINE_WEIGHT = 0.15;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function money(n?: number): string {
  return `Rs. ${(n || 0).toLocaleString('en-IN')}`;
}

export interface ExpenseReportPdfOptions {
  settings: ClinicSettings;
  reportNumber: string;
  heading: string;
  summary: ExpenseSummary;
  supplierSummary: SupplierExpenseSummary[];
  monthlyBreakdown: { month: number; total: number }[] | null;
}

// Same section-flow pagination architecture as lib/inventoryReportsPdf.ts —
// a running cursor that breaks to a new page whenever the next section
// wouldn't fit, footers drawn in a second pass once the true page count is
// known. Replaces the old fixed-height "planPages + one fixed-size closing
// block" design, which could only ever show Category/Payment summaries of a
// bounded, hand-tuned size — it had no room for a variable-length
// Supplier-wise or Monthly table without risking overlap at the page
// bottom, the same class of bug already hit and fixed once this session for
// the Patient Database PDF.
export async function generateExpenseReportPDF(rows: Expense[], opts: ExpenseReportPdfOptions): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { loadLogoAsPngDataUrl, fitLogoBox } = await import('@/lib/pdfLogo');
  const logo = opts.settings.showLogoOnDocuments ? await loadLogoAsPngDataUrl(opts.settings.logoUrl) : null;
  const { summary } = opts;

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN_X * 2;

  let cursorY = MARGIN_TOP;

  const drawLetterhead = () => {
    const y = MARGIN_TOP;
    let textX = MARGIN_X;
    if (logo) {
      const box = fitLogoBox(logo, 16, 14);
      pdf.addImage(logo.dataUrl, 'PNG', MARGIN_X, y, box.w, box.h);
      textX = MARGIN_X + box.w + 3;
    }
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.setTextColor(15, 23, 42);
    pdf.text(opts.settings.clinicName || 'Royal Opticals', textX, y + 6);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(60, 60, 60);
    const contactLine = [opts.settings.address, opts.settings.phone, opts.settings.email].filter(Boolean).join('  •  ');
    if (contactLine) pdf.text(contactLine, textX, y + 11);
    if (opts.settings.gstin) pdf.text(`GSTIN: ${opts.settings.gstin}`, textX, y + 15.5);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(15, 23, 42);
    pdf.text('EXPENSE REPORT', pageWidth - MARGIN_X, y + 6, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(60, 60, 60);
    pdf.text(`Report No: ${opts.reportNumber}`, pageWidth - MARGIN_X, y + 11, { align: 'right' });
    pdf.text(`Report Period: ${opts.heading}`, pageWidth - MARGIN_X, y + 15.5, { align: 'right' });

    pdf.setDrawColor(15, 23, 42);
    pdf.setLineWidth(STRUCTURAL_LINE_WEIGHT);
    pdf.line(MARGIN_X, y + LETTERHEAD_HEIGHT - 4, pageWidth - MARGIN_X, y + LETTERHEAD_HEIGHT - 4);
    pdf.setTextColor(0, 0, 0);
    return MARGIN_TOP + LETTERHEAD_HEIGHT;
  };

  const drawSlimHeader = () => {
    const y = MARGIN_TOP;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(15, 23, 42);
    pdf.text(opts.settings.clinicName || 'Royal Opticals', MARGIN_X, y + 4);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.text('EXPENSE REPORT — CONTINUED', pageWidth - MARGIN_X, y + 4, { align: 'right' });
    pdf.setDrawColor(15, 23, 42);
    pdf.setLineWidth(STRUCTURAL_LINE_WEIGHT);
    pdf.line(MARGIN_X, y + SLIM_HEADER_HEIGHT - 2, pageWidth - MARGIN_X, y + SLIM_HEADER_HEIGHT - 2);
    pdf.setTextColor(0, 0, 0);
    return MARGIN_TOP + SLIM_HEADER_HEIGHT;
  };

  const newPage = () => {
    pdf.addPage();
    cursorY = drawSlimHeader();
  };

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

  const drawTable = (headers: string[], widths: number[], aligns: ('left' | 'right' | 'center')[], rows: string[][], emptyLabel: string) => {
    const rowHeight = 8;
    const headerHeight = 8;

    const drawColumnDividers = (top: number, height: number, color: [number, number, number]) => {
      let x = MARGIN_X;
      pdf.setDrawColor(...color);
      pdf.setLineWidth(0.15);
      widths.forEach((w, i) => {
        x += w;
        if (i < widths.length - 1) pdf.line(x, top, x, top + height);
      });
    };

    const drawHeaderRow = () => {
      pdf.setFillColor(15, 23, 42);
      pdf.rect(MARGIN_X, cursorY, contentWidth, headerHeight, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      let x = MARGIN_X;
      headers.forEach((h, i) => {
        const w = widths[i];
        const align = aligns[i];
        const textX = align === 'right' ? x + w - 1.5 : align === 'center' ? x + w / 2 : x + 1.5;
        pdf.text(h, textX, cursorY + headerHeight / 2 + 1, { align: align === 'left' ? 'left' : align });
        x += w;
      });
      drawColumnDividers(cursorY, headerHeight, [80, 90, 110]);
      pdf.setTextColor(0, 0, 0);
      cursorY += headerHeight;
    };

    ensureSpace(headerHeight + rowHeight);
    const tableTopY = cursorY;
    drawHeaderRow();

    if (rows.length === 0) {
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      pdf.text(emptyLabel, MARGIN_X + contentWidth / 2, cursorY + 5, { align: 'center' });
      pdf.setTextColor(0, 0, 0);
      cursorY += 9;
    }

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
      pdf.setFontSize(7.5);
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
      drawColumnDividers(cursorY, rowHeight, [224, 228, 236]);
      pdf.setDrawColor(224, 228, 236);
      pdf.setLineWidth(0.12);
      pdf.line(MARGIN_X, cursorY + rowHeight, MARGIN_X + contentWidth, cursorY + rowHeight);
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
    pdf.text('Expense Report', pageWidth / 2, y, { align: 'center' });
    pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth - MARGIN_X, y, { align: 'right' });
    pdf.setTextColor(0, 0, 0);
  };

  // ── Letterhead, then straight into the main table. ──────────────────────
  cursorY = drawLetterhead();

  // ── Expense Detail — the full per-transaction table, now with
  // percentage-based column widths so it always fills the exact usable
  // landscape width instead of leaving a dead strip on the right. ─────────
  sectionTitle('Expense Detail');
  drawTable(
    ['#', 'Date', 'Expense ID', 'Category', 'Description', 'Vendor', 'Reference', 'Method', 'Amount', 'Paid', 'Pending'],
    [4, 7, 10, 11, 16, 10, 10, 8, 8, 8, 8].map((pct) => (pct / 100) * contentWidth),
    ['center', 'left', 'left', 'left', 'left', 'left', 'left', 'center', 'right', 'right', 'right'],
    rows.map((exp, idx) => {
      const paid = exp.paidAmount ?? exp.amount;
      const pending = Math.max(0, exp.amount - paid);
      return [
        String(idx + 1),
        formatDate(exp.date),
        exp.displayId || '-',
        exp.category,
        exp.description || '-',
        exp.vendor || '-',
        exp.referenceNumber || '-',
        exp.paymentMethod || '-',
        money(exp.amount),
        money(paid),
        money(pending),
      ];
    }),
    `No expense records were found for ${opts.heading}.`
  );

  // ── Category Summary ──────────────────────────────────────────────────
  const categoryEntries = Object.entries(summary.byCategory) as [ExpenseCategory, number][];
  sectionTitle('Category Summary');
  drawTable(
    ['Category', 'Amount', 'Share'],
    [contentWidth - 70, 35, 35],
    ['left', 'right', 'right'],
    categoryEntries
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amount]) => [cat, money(amount), summary.total > 0 ? `${((amount / summary.total) * 100).toFixed(1)}%` : '0%']),
    'No category data available.'
  );

  // ── Payment Summary ────────────────────────────────────────────────────
  const paymentEntries = Object.entries(summary.byPaymentMethod) as [ExpensePaymentMethod, { count: number; amount: number }][];
  sectionTitle('Payment Summary');
  drawTable(
    ['Payment Method', 'Transactions', 'Amount'],
    [contentWidth - 70, 35, 35],
    ['left', 'right', 'right'],
    paymentEntries.sort((a, b) => b[1].amount - a[1].amount).map(([m, data]) => [m, String(data.count), money(data.amount)]),
    'No payment data available.'
  );

  // ── Supplier / Vendor-wise Summary — real data already computed for the
  // on-screen Suppliers view, never previously shown on the PDF at all. ───
  sectionTitle('Supplier / Vendor-wise Summary');
  drawTable(
    ['Vendor', 'Transactions', 'Total Amount', 'Total Paid', 'Outstanding', 'Last Purchase'],
    [contentWidth - (26 + 32 + 32 + 32 + 28), 26, 32, 32, 32, 28],
    ['left', 'right', 'right', 'right', 'right', 'left'],
    opts.supplierSummary.map((s) => [s.vendor, String(s.count), money(s.totalAmount), money(s.totalPaid), money(s.outstanding), formatDate(s.lastDate)]),
    'No supplier activity for this period.'
  );

  // ── Monthly Breakdown — only present for the Yearly view (same condition
  // already used to show/hide it on screen). ──────────────────────────────
  if (opts.monthlyBreakdown) {
    sectionTitle('Monthly Breakdown');
    drawTable(
      ['Month', 'Amount'],
      [contentWidth - 50, 50],
      ['left', 'right'],
      opts.monthlyBreakdown.map((m) => [MONTH_NAMES[m.month], money(m.total)]),
      'No monthly data available.'
    );
  }

  // ── Grand Total ────────────────────────────────────────────────────────
  const totalPaid = rows.reduce((s, r) => s + (r.paidAmount ?? r.amount), 0);
  const totalPending = rows.reduce((s, r) => s + Math.max(0, r.amount - (r.paidAmount ?? r.amount)), 0);
  sectionTitle('Grand Total');
  drawStatRow([
    ['Total Transactions', String(summary.count)],
    ['Total Expense', money(summary.total)],
    ['Total Paid', money(totalPaid)],
    ['Total Pending', money(totalPending)],
    ['Average / Transaction', money(summary.average)],
    ['Largest Expense', money(summary.largest)],
  ]);

  // ── Prepared By / Authorized Signature ────────────────────────────────
  ensureSpace(18);
  cursorY += 6;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(0, 0, 0);
  pdf.text('Prepared By:', MARGIN_X, cursorY);
  pdf.setDrawColor(100, 100, 100);
  pdf.setLineWidth(HAIRLINE_WEIGHT);
  pdf.line(MARGIN_X + 24, cursorY, MARGIN_X + 80, cursorY);
  const sigLabelX = pageWidth - MARGIN_X - 90;
  pdf.text('Authorized Signature:', sigLabelX, cursorY);
  pdf.line(sigLabelX + 34, cursorY, pageWidth - MARGIN_X, cursorY);

  const totalPages = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    drawFooter(p, totalPages);
  }

  const safeHeading = opts.heading.replace(/\s+/g, '_').replace(/[^\w-]/g, '');
  pdf.save(`Expense_Report_${safeHeading}_${opts.reportNumber}.pdf`);
}
