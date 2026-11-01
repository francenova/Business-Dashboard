import type { Prescription, ClinicSettings } from '@/lib/types';
import type { SalesSummary } from '@/hooks/useSalesRegister';
import { formatDate } from '@/lib/formatDate';
import { deriveSaleDescription } from '@/hooks/useSalesRegister';

interface Column {
  label: string;
  widthPct: number; // % of content width — columns always sum to exactly
  // the usable landscape width, so the table fills the full A4 sheet
  // instead of leaving a dead strip on the right (what fixed-mm widths did).
  align: 'left' | 'right' | 'center';
}

const COLUMNS: Column[] = [
  { label: 'S.No', widthPct: 4, align: 'center' },
  { label: 'Date', widthPct: 7, align: 'left' },
  { label: 'Invoice No', widthPct: 12, align: 'left' },
  { label: 'Customer', widthPct: 15, align: 'left' },
  { label: 'Description', widthPct: 22, align: 'left' },
  { label: 'Total', widthPct: 8, align: 'right' },
  { label: 'Paid', widthPct: 8, align: 'right' },
  { label: 'Pending', widthPct: 8, align: 'right' },
  { label: 'Method', widthPct: 8, align: 'center' },
  { label: 'Status', widthPct: 8, align: 'center' },
];

const ROW_HEIGHT = 7;
const TABLE_HEADER_HEIGHT = 8;
const LETTERHEAD_HEIGHT = 36; // page 1 only: full clinic header + report meta
const SLIM_HEADER_HEIGHT = 12; // pages 2+: "CONTINUED" repeat header
// The closing block = bordered summary box + optional Notes line + the
// Prepared By / Authorized Signature row. It's a single unit that must be
// kept together on the last page (never split across a page break).
const CLOSING_BLOCK_HEIGHT = 56;
const MARGIN_X = 10;
const MARGIN_TOP = 10;
const MARGIN_BOTTOM = 16; // reserved for the footer band
const STRUCTURAL_LINE_WEIGHT = 0.3; // major boundaries: dividers, table/summary borders
const HAIRLINE_WEIGHT = 0.15; // row separators inside the table

interface PagePlan {
  rowStart: number;
  rowEnd: number;
  includesClosing: boolean;
}

// Deterministic layout planner — decides how rows are distributed across
// pages before anything is drawn, so the footer's "Page X of Y" is correct
// on the first pass and no row is ever split across a page break.
function planPages(rowCount: number, pageHeight: number): PagePlan[] {
  const firstPageCapacity = pageHeight - MARGIN_TOP - LETTERHEAD_HEIGHT - TABLE_HEADER_HEIGHT - MARGIN_BOTTOM;
  const otherPageCapacity = pageHeight - MARGIN_TOP - SLIM_HEADER_HEIGHT - TABLE_HEADER_HEIGHT - MARGIN_BOTTOM;

  const pages: PagePlan[] = [];

  if (rowCount === 0) {
    return [{ rowStart: 0, rowEnd: 0, includesClosing: true }];
  }

  let idx = 0;
  let pageIdx = 0;
  while (idx < rowCount) {
    const capacity = pageIdx === 0 ? firstPageCapacity : otherPageCapacity;
    const rowsThisPage = Math.max(1, Math.floor(capacity / ROW_HEIGHT));
    const end = Math.min(rowCount, idx + rowsThisPage);
    const isFinalBatch = end === rowCount;
    const usedHeight = (end - idx) * ROW_HEIGHT;
    const closingFits = isFinalBatch && capacity - usedHeight >= CLOSING_BLOCK_HEIGHT;
    pages.push({ rowStart: idx, rowEnd: end, includesClosing: closingFits });
    idx = end;
    pageIdx++;
  }

  if (!pages[pages.length - 1].includesClosing) {
    pages.push({ rowStart: rowCount, rowEnd: rowCount, includesClosing: true });
  }

  return pages;
}

function truncate(pdf: any, text: string, maxWidth: number): string {
  const lines = pdf.splitTextToSize(text || '-', maxWidth);
  return lines.length > 1 ? `${lines[0]}…` : lines[0] || '-';
}

function money(n: number): string {
  return `Rs. ${(n || 0).toLocaleString('en-IN')}`;
}

export interface SalesRegisterPdfOptions {
  settings: ClinicSettings;
  reportNumber: string;
  periodHeading: string;
  preparedBy: string | null;
  notes: string;
}

export async function generateSalesRegisterPDF(
  rows: Prescription[],
  summary: SalesSummary,
  opts: SalesRegisterPdfOptions
): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { loadLogoAsPngDataUrl, fitLogoBox } = await import('@/lib/pdfLogo');
  const logo = opts.settings.showLogoOnDocuments ? await loadLogoAsPngDataUrl(opts.settings.logoUrl) : null;

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const tableStartX = MARGIN_X;
  const tableWidth = pageWidth - MARGIN_X * 2;
  // Resolved once pageWidth is known — percentages always sum to the full
  // usable width, so the table edge lands exactly on the right margin.
  const colWidths = COLUMNS.map((c) => (c.widthPct / 100) * tableWidth);

  const plan = planPages(rows.length, pageHeight);
  const totalPages = plan.length;

  const drawColumnHeaders = (y: number) => {
    pdf.setFillColor(15, 23, 42); // slate-900
    pdf.rect(tableStartX, y, tableWidth, TABLE_HEADER_HEIGHT, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);

    let x = tableStartX;
    COLUMNS.forEach((col, i) => {
      const w = colWidths[i];
      const textX = col.align === 'right' ? x + w - 1.5 : col.align === 'center' ? x + w / 2 : x + 1.5;
      pdf.text(col.label, textX, y + TABLE_HEADER_HEIGHT / 2 + 1, { align: col.align === 'left' ? 'left' : col.align });
      x += w;
    });
    pdf.setTextColor(0, 0, 0);
    return y + TABLE_HEADER_HEIGHT;
  };

  const drawLetterhead = () => {
    const y = MARGIN_TOP;
    let textX = tableStartX;
    if (logo) {
      const box = fitLogoBox(logo, 16, 14);
      pdf.addImage(logo.dataUrl, 'PNG', tableStartX, y, box.w, box.h);
      textX = tableStartX + box.w + 3;
    }
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(17);
    pdf.text(opts.settings.clinicName || 'Royal Opticals', textX, y + 6);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    let leftY = y + 12;
    if (opts.settings.address) {
      pdf.text(opts.settings.address, textX, leftY);
      leftY += 4.5;
    }
    const contactLine = [opts.settings.phone, opts.settings.email].filter(Boolean).join('   •   ');
    if (contactLine) {
      pdf.text(contactLine, textX, leftY);
      leftY += 4.5;
    }
    if (opts.settings.registrationNumber) {
      pdf.text(`Reg. No: ${opts.settings.registrationNumber}`, textX, leftY);
      leftY += 4.5;
    }
    if (opts.settings.gstin) {
      pdf.text(`GSTIN: ${opts.settings.gstin}`, textX, leftY);
    }

    let rightY = y + 6;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.text('SALES REGISTER', pageWidth - MARGIN_X, rightY, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    rightY += 6;
    pdf.text(`Report No: ${opts.reportNumber}`, pageWidth - MARGIN_X, rightY, { align: 'right' });
    rightY += 4.5;
    pdf.text(`Period: ${opts.periodHeading}`, pageWidth - MARGIN_X, rightY, { align: 'right' });
    if (opts.preparedBy) {
      rightY += 4.5;
      pdf.text(`Prepared by: ${opts.preparedBy}`, pageWidth - MARGIN_X, rightY, { align: 'right' });
    }

    pdf.setDrawColor(15, 23, 42);
    pdf.setLineWidth(STRUCTURAL_LINE_WEIGHT);
    pdf.line(tableStartX, y + LETTERHEAD_HEIGHT - 4, pageWidth - MARGIN_X, y + LETTERHEAD_HEIGHT - 4);

    return MARGIN_TOP + LETTERHEAD_HEIGHT;
  };

  const drawSlimHeader = () => {
    const y = MARGIN_TOP;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10.5);
    pdf.text(opts.settings.clinicName || 'Royal Opticals', tableStartX, y + 4);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text('SALES REGISTER — CONTINUED', tableStartX, y + 8.5);

    pdf.setFontSize(8);
    pdf.text(`Report No: ${opts.reportNumber}`, pageWidth - MARGIN_X, y + 4, { align: 'right' });
    pdf.text(`Period: ${opts.periodHeading}`, pageWidth - MARGIN_X, y + 8.5, { align: 'right' });

    pdf.setDrawColor(15, 23, 42);
    pdf.setLineWidth(STRUCTURAL_LINE_WEIGHT);
    pdf.line(tableStartX, y + SLIM_HEADER_HEIGHT - 2, pageWidth - MARGIN_X, y + SLIM_HEADER_HEIGHT - 2);

    return MARGIN_TOP + SLIM_HEADER_HEIGHT;
  };

  const drawFooter = (pageNum: number) => {
    const y = pageHeight - 8;
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(HAIRLINE_WEIGHT);
    pdf.line(tableStartX, y - 4, pageWidth - MARGIN_X, y - 4);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(100, 100, 100);
    pdf.text(opts.settings.clinicName || 'Royal Opticals', tableStartX, y);
    pdf.text('Computer Generated Report', pageWidth / 2, y, { align: 'center' });
    pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth - MARGIN_X, y, { align: 'right' });
    pdf.setTextColor(0, 0, 0);
  };

  const drawRow = (rx: Prescription, index: number, y: number) => {
    if (index % 2 === 1) {
      pdf.setFillColor(248, 250, 252); // slate-50 zebra stripe
      pdf.rect(tableStartX, y, tableWidth, ROW_HEIGHT, 'F');
    }
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);

    const values = [
      String(index + 1),
      formatDate(rx.date),
      rx.payment?.invoiceNumber || rx.displayId || '-',
      rx.patientName || '-',
      deriveSaleDescription(rx),
      money(rx.payment?.grandTotal),
      money(rx.payment?.advance),
      money(rx.payment?.balance),
      rx.payment?.paymentMethod || '-',
      rx.payment?.status || '-',
    ];

    let x = tableStartX;
    const textY = y + ROW_HEIGHT / 2 + 1.5;
    values.forEach((val, i) => {
      const col = COLUMNS[i];
      const w = colWidths[i];
      const display = truncate(pdf, val, w - 3);
      const textX = col.align === 'right' ? x + w - 1.5 : col.align === 'center' ? x + w / 2 : x + 1.5;
      pdf.text(display, textX, textY, { align: col.align === 'left' ? 'left' : col.align });
      x += w;
    });

    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(HAIRLINE_WEIGHT);
    pdf.line(tableStartX, y + ROW_HEIGHT, tableStartX + tableWidth, y + ROW_HEIGHT);
  };

  const drawTableOuterBorder = (headerY: number, bottomY: number) => {
    pdf.setDrawColor(15, 23, 42);
    pdf.setLineWidth(STRUCTURAL_LINE_WEIGHT);
    pdf.rect(tableStartX, headerY, tableWidth, bottomY - headerY);
  };

  const drawClosingBlock = (y: number) => {
    const summaryBoxHeight = 22;
    pdf.setDrawColor(15, 23, 42);
    pdf.setLineWidth(STRUCTURAL_LINE_WEIGHT);
    pdf.rect(tableStartX, y, tableWidth, summaryBoxHeight);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.text('SUMMARY', tableStartX + 3, y + 6);

    const cards: [string, string][] = [
      ['Total Invoices', String(summary.totalInvoices)],
      ['Gross Sales', money(summary.grossSales)],
      ['Discount', money(summary.discount)],
      ...(summary.totalTax > 0 ? ([['Total GST', money(summary.totalTax)]] as [string, string][]) : []),
      ['Grand Total', money(summary.grandTotal)],
      ['Collected', money(summary.collected)],
      ['Pending', money(summary.pending)],
    ];

    const colWidth = tableWidth / cards.length;
    cards.forEach(([label, value], i) => {
      const cx = tableStartX + colWidth * i + colWidth / 2;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(100, 100, 100);
      pdf.text(label, cx, y + 13, { align: 'center' });
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10.5);
      pdf.setTextColor(0, 0, 0);
      pdf.text(value, cx, y + 19, { align: 'center' });
    });

    let cursorY = y + summaryBoxHeight + 7;

    const noteText = opts.notes.trim();
    if (noteText) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.text('Notes:', tableStartX, cursorY);
      pdf.setFont('helvetica', 'normal');
      const noteLines = pdf.splitTextToSize(noteText, tableWidth - 18);
      pdf.text(noteLines, tableStartX + 15, cursorY);
      cursorY += Math.max(5, noteLines.length * 4);
    }

    cursorY += 8;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text('Prepared By:', tableStartX, cursorY);
    pdf.setDrawColor(100, 100, 100);
    pdf.setLineWidth(HAIRLINE_WEIGHT);
    pdf.line(tableStartX + 24, cursorY, tableStartX + 70, cursorY);

    const sigLabelX = tableStartX + tableWidth - 70;
    pdf.text('Authorized Signature:', sigLabelX, cursorY);
    pdf.line(sigLabelX + 34, cursorY, tableStartX + tableWidth, cursorY);
  };

  plan.forEach((page, pageIdx) => {
    if (pageIdx > 0) pdf.addPage();

    let y = pageIdx === 0 ? drawLetterhead() : drawSlimHeader();
    const tableHeaderY = y;
    y = drawColumnHeaders(y);

    for (let i = page.rowStart; i < page.rowEnd; i++) {
      drawRow(rows[i], i, y);
      y += ROW_HEIGHT;
    }

    if (page.rowStart === page.rowEnd && rows.length === 0) {
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(9);
      pdf.setTextColor(120, 120, 120);
      pdf.text('No sales in this period.', tableStartX + tableWidth / 2, y + 10, { align: 'center' });
      pdf.setTextColor(0, 0, 0);
      y += 16;
    }

    drawTableOuterBorder(tableHeaderY, y);

    if (page.includesClosing) {
      drawClosingBlock(y + 6);
    }

    drawFooter(pageIdx + 1);
  });

  const safePeriod = opts.periodHeading.replace(/\s+/g, '_').replace(/[^\w-]/g, '');
  pdf.save(`Sales_Register_${safePeriod}_${opts.reportNumber}.pdf`);
}
