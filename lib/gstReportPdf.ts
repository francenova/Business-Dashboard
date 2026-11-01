import type { ClinicSettings, Prescription, TaxRateConfig } from '@/lib/types';
import type { SalesSummary } from '@/hooks/useSalesRegister';
import { formatDate } from '@/lib/formatDate';

const MARGIN_X = 10;
const MARGIN_TOP = 10;
const MARGIN_BOTTOM = 16;
const LETTERHEAD_HEIGHT = 26;
const SLIM_HEADER_HEIGHT = 10;
const STRUCTURAL_LINE_WEIGHT = 0.3;
const HAIRLINE_WEIGHT = 0.15;

function money(n?: number): string {
  return `Rs. ${(n || 0).toLocaleString('en-IN')}`;
}

export interface GstReportPdfOptions {
  settings: ClinicSettings;
  periodHeading: string;
  summary: SalesSummary;
  rows: Prescription[];
  taxRateConfig: TaxRateConfig[];
}

// Same section-flow pagination architecture as reportAnalysisPdf.ts /
// inventoryReportsPdf.ts — a running cursor that breaks to a new page
// whenever the next block wouldn't fit, footers drawn in a second pass.
export async function generateGstReportPDF(opts: GstReportPdfOptions): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { loadLogoAsPngDataUrl, fitLogoBox } = await import('@/lib/pdfLogo');
  const logo = opts.settings.showLogoOnDocuments ? await loadLogoAsPngDataUrl(opts.settings.logoUrl) : null;

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
    pdf.text(opts.settings.clinicName || 'Royal Opticals', textX, y + 6);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    const contactLine = [opts.settings.address, opts.settings.phone, opts.settings.email].filter(Boolean).join('  •  ');
    if (contactLine) pdf.text(contactLine, textX, y + 11);
    if (opts.settings.gstin) pdf.text(`GSTIN: ${opts.settings.gstin}`, textX, y + 15.5);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('GST / TAX REPORT', pageWidth - MARGIN_X, y + 6, { align: 'right' });
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
    pdf.text('GST / TAX REPORT — CONTINUED', pageWidth - MARGIN_X, y + 4, { align: 'right' });
    pdf.setDrawColor(15, 23, 42);
    pdf.setLineWidth(STRUCTURAL_LINE_WEIGHT);
    pdf.line(MARGIN_X, y + SLIM_HEADER_HEIGHT - 2, pageWidth - MARGIN_X, y + SLIM_HEADER_HEIGHT - 2);
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
    pdf.text('GST / Tax Report', pageWidth / 2, y, { align: 'center' });
    pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth - MARGIN_X, y, { align: 'right' });
    pdf.setTextColor(0, 0, 0);
  };

  // ── Page 1: letterhead + Summary ─────────────────────────────────────
  cursorY = drawLetterhead();
  sectionTitle('Summary');
  drawStatRow([
    ['Taxable Amount', money(opts.summary.taxableAmount)],
    ['CGST', money(opts.summary.cgstTotal)],
    ['SGST', money(opts.summary.sgstTotal)],
    ['IGST', money(opts.summary.igstTotal)],
    ['Total GST', money(opts.summary.totalTax)],
  ]);

  // ── Category Tax Rates ─────────────────────────────────────────────────
  sectionTitle('Category Tax Rates');
  drawTable(
    ['Category', 'HSN/SAC', 'Rate', 'Taxable'],
    [contentWidth - 90, 40, 25, 25],
    ['left', 'left', 'right', 'center'],
    opts.taxRateConfig.map((r) => [r.category, r.hsnSac || '-', `${r.taxRate}%`, r.isTaxable ? 'Yes' : 'No']),
    'No category tax rates configured.'
  );

  // ── GST Invoices ───────────────────────────────────────────────────────
  sectionTitle('GST Invoices');
  drawTable(
    ['#', 'Date', 'Invoice No', 'Patient', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total Tax', 'Grand Total'],
    [10, 20, 28, contentWidth - (10 + 20 + 28 + 26 * 6), 26, 26, 26, 26, 26, 26],
    ['center', 'left', 'left', 'left', 'right', 'right', 'right', 'right', 'right', 'right'],
    opts.rows.map((rx, idx) => [
      String(idx + 1),
      formatDate(rx.date),
      rx.payment?.invoiceNumber || rx.displayId || '-',
      rx.patientName || '-',
      money(rx.payment?.taxableAmount),
      money(rx.payment?.cgstAmount),
      money(rx.payment?.sgstAmount),
      money(rx.payment?.igstAmount),
      money(rx.payment?.totalTax),
      money(rx.payment?.grandTotal),
    ]),
    'No GST invoices found for this period.'
  );

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

  const safeHeading = opts.periodHeading.replace(/\s+/g, '_').replace(/[^\w-]/g, '');
  pdf.save(`GST_Report_${safeHeading}.pdf`);
}
