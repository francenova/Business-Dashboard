import type { Prescription, ClinicSettings } from '@/lib/types';
import type { SalesSummary } from '@/hooks/useSalesRegister';
import { formatDate } from '@/lib/formatDate';
import { deriveSaleDescription } from '@/hooks/useSalesRegister';

interface Column {
  label: string;
  width: number; // mm
  align: 'left' | 'right' | 'center';
}

const COLUMNS: Column[] = [
  { label: 'S.No', width: 8, align: 'center' },
  { label: 'Date', width: 16, align: 'left' },
  { label: 'Invoice No', width: 26, align: 'left' },
  { label: 'Patient', width: 32, align: 'left' },
  { label: 'Items', width: 30, align: 'left' },
  { label: 'Subtotal', width: 18, align: 'right' },
  { label: 'Discount', width: 16, align: 'right' },
  { label: 'Taxable', width: 18, align: 'right' },
  { label: 'GST', width: 14, align: 'right' },
  { label: 'Grand Total', width: 20, align: 'right' },
  { label: 'Paid', width: 18, align: 'right' },
  { label: 'Pending', width: 18, align: 'right' },
  { label: 'Method', width: 16, align: 'center' },
];

const ROW_HEIGHT = 7;
const TABLE_HEADER_HEIGHT = 8;
const LETTERHEAD_HEIGHT = 30;
const SLIM_HEADER_HEIGHT = 10;
const CLOSING_BLOCK_HEIGHT = 46;
const MARGIN_X = 10;
const MARGIN_TOP = 10;
const MARGIN_BOTTOM = 16;
const STRUCTURAL_LINE_WEIGHT = 0.3;
const HAIRLINE_WEIGHT = 0.15;

interface PagePlan {
  rowStart: number;
  rowEnd: number;
  includesClosing: boolean;
}

function planPages(rowCount: number, pageHeight: number): PagePlan[] {
  const firstPageCapacity = pageHeight - MARGIN_TOP - LETTERHEAD_HEIGHT - TABLE_HEADER_HEIGHT - MARGIN_BOTTOM;
  const otherPageCapacity = pageHeight - MARGIN_TOP - SLIM_HEADER_HEIGHT - TABLE_HEADER_HEIGHT - MARGIN_BOTTOM;

  if (rowCount === 0) return [{ rowStart: 0, rowEnd: 0, includesClosing: true }];

  const pages: PagePlan[] = [];
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

export interface DSRPdfOptions {
  settings: ClinicSettings;
  reportNumber: string;
  heading: string; // e.g. "14 Aug 2026" / "August 2026" / "2026"
}

export async function generateDSRPDF(rows: Prescription[], summary: SalesSummary, opts: DSRPdfOptions): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { loadLogoAsPngDataUrl, fitLogoBox } = await import('@/lib/pdfLogo');
  const logo = opts.settings.showLogoOnDocuments ? await loadLogoAsPngDataUrl(opts.settings.logoUrl) : null;

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const tableWidth = COLUMNS.reduce((sum, c) => sum + c.width, 0);
  const tableStartX = MARGIN_X;

  const plan = planPages(rows.length, pageHeight);
  const totalPages = plan.length;

  const drawColumnHeaders = (y: number) => {
    pdf.setFillColor(15, 23, 42);
    pdf.rect(tableStartX, y, tableWidth, TABLE_HEADER_HEIGHT, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    let x = tableStartX;
    for (const col of COLUMNS) {
      const textX = col.align === 'right' ? x + col.width - 1.5 : col.align === 'center' ? x + col.width / 2 : x + 1.5;
      pdf.text(col.label, textX, y + TABLE_HEADER_HEIGHT / 2 + 1, { align: col.align === 'left' ? 'left' : col.align });
      x += col.width;
    }
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
    pdf.setFontSize(15);
    pdf.text(opts.settings.clinicName || 'Royal Opticals', textX, y + 6);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    const contactLine = [opts.settings.address, opts.settings.phone, opts.settings.email].filter(Boolean).join('  •  ');
    if (contactLine) pdf.text(contactLine, textX, y + 11);
    if (opts.settings.gstin) pdf.text(`GSTIN: ${opts.settings.gstin}`, textX, y + 15.5);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('DAILY SALES REPORT', pageWidth - MARGIN_X, y + 6, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text(`Report No: ${opts.reportNumber}`, pageWidth - MARGIN_X, y + 11, { align: 'right' });
    pdf.text(`Report Date: ${opts.heading}`, pageWidth - MARGIN_X, y + 15.5, { align: 'right' });

    pdf.setDrawColor(15, 23, 42);
    pdf.setLineWidth(STRUCTURAL_LINE_WEIGHT);
    pdf.line(tableStartX, y + LETTERHEAD_HEIGHT - 4, pageWidth - MARGIN_X, y + LETTERHEAD_HEIGHT - 4);
    return MARGIN_TOP + LETTERHEAD_HEIGHT;
  };

  const drawSlimHeader = () => {
    const y = MARGIN_TOP;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(opts.settings.clinicName || 'Royal Opticals', tableStartX, y + 4);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.text('DAILY SALES REPORT — CONTINUED', pageWidth - MARGIN_X, y + 4, { align: 'right' });
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
    pdf.setFontSize(7);
    pdf.setTextColor(100, 100, 100);
    pdf.text(opts.settings.clinicName || 'Royal Opticals', tableStartX, y);
    pdf.text('Daily Sales Report', pageWidth / 2, y, { align: 'center' });
    pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth - MARGIN_X, y, { align: 'right' });
    pdf.setTextColor(0, 0, 0);
  };

  const drawRow = (rx: Prescription, index: number, y: number) => {
    if (index % 2 === 1) {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(tableStartX, y, tableWidth, ROW_HEIGHT, 'F');
    }
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);

    const values = [
      String(index + 1),
      formatDate(rx.date),
      rx.payment?.invoiceNumber || rx.displayId || '-',
      rx.patientName || '-',
      deriveSaleDescription(rx),
      money(rx.payment?.subtotal),
      money(rx.payment?.discount),
      // Taxable falls back to grandTotal for rows saved before GST existed
      // (or while it's disabled) — no tax was ever calculated for them, so
      // taxable value legitimately equals the total.
      money(rx.payment?.taxableAmount || rx.payment?.grandTotal),
      money(rx.payment?.totalTax || 0),
      money(rx.payment?.grandTotal),
      money(rx.payment?.advance),
      money(rx.payment?.balance),
      rx.payment?.paymentMethod || '-',
    ];

    let x = tableStartX;
    const textY = y + ROW_HEIGHT / 2 + 1.5;
    values.forEach((val, i) => {
      const col = COLUMNS[i];
      const display = truncate(pdf, val, col.width - 2.5);
      const textX = col.align === 'right' ? x + col.width - 1.5 : col.align === 'center' ? x + col.width / 2 : x + 1.5;
      pdf.text(display, textX, textY, { align: col.align === 'left' ? 'left' : col.align });
      x += col.width;
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
    pdf.setFontSize(8);
    pdf.text('TOTAL SUMMARY', tableStartX + 3, y + 6);

    const cards: [string, string][] = [
      ['Invoices', String(summary.totalInvoices)],
      ['Subtotal', money(summary.grossSales)],
      ['Discount', money(summary.discount)],
      ['GST', money(summary.totalTax)],
      ['Grand Total', money(summary.grandTotal)],
      ['Paid', money(summary.collected)],
      ['Pending', money(summary.pending)],
    ];
    const colWidth = tableWidth / cards.length;
    cards.forEach(([label, value], i) => {
      const cx = tableStartX + colWidth * i + colWidth / 2;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.5);
      pdf.setTextColor(100, 100, 100);
      pdf.text(label, cx, y + 13, { align: 'center' });
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9.5);
      pdf.setTextColor(0, 0, 0);
      pdf.text(value, cx, y + 19, { align: 'center' });
    });

    let cursorY = y + summaryBoxHeight + 8;
    const methods: Array<'Cash' | 'UPI' | 'Card' | 'Mixed'> = ['Cash', 'UPI', 'Card', 'Mixed'];
    const used = methods.filter((m) => summary.byPaymentMethod[m].count > 0);
    if (used.length > 0) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.text('PAYMENT SUMMARY', tableStartX, cursorY);
      cursorY += 5;
      const boxWidth = tableWidth / used.length - 3;
      used.forEach((m, i) => {
        const bx = tableStartX + i * (boxWidth + 3);
        pdf.setDrawColor(180, 180, 180);
        pdf.setLineWidth(HAIRLINE_WEIGHT);
        pdf.rect(bx, cursorY, boxWidth, 12);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(6.5);
        pdf.setTextColor(100, 100, 100);
        pdf.text(`${m} (${summary.byPaymentMethod[m].count})`, bx + 2, cursorY + 4.5);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8.5);
        pdf.setTextColor(0, 0, 0);
        pdf.text(money(summary.byPaymentMethod[m].amount), bx + 2, cursorY + 9.5);
      });
    }
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
      pdf.text(`No sales were recorded for ${opts.heading}.`, tableStartX + tableWidth / 2, y + 10, { align: 'center' });
      pdf.setTextColor(0, 0, 0);
      y += 16;
    }

    drawTableOuterBorder(tableHeaderY, y);

    if (page.includesClosing) {
      drawClosingBlock(y + 6);
    }

    drawFooter(pageIdx + 1);
  });

  const safeHeading = opts.heading.replace(/\s+/g, '_').replace(/[^\w-]/g, '');
  pdf.save(`Daily_Sales_Report_${safeHeading}_${opts.reportNumber}.pdf`);
}
