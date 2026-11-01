import type { ClinicSettings, Supplier, Expense, Medicine } from '@/lib/types';
import type { SupplierPaymentStatus } from '@/hooks/useSupplierDetails';
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

export interface SupplierDetailsPdfOptions {
  settings: ClinicSettings;
  supplier: Supplier;
  products: Medicine[];
  transactions: Expense[];
  paymentStatus: SupplierPaymentStatus;
}

// Same section-flow pagination architecture as gstReportPdf.ts — a running
// cursor that breaks to a new page whenever the next block wouldn't fit,
// footers drawn in a second pass once total page count is known.
export async function generateSupplierDetailsPDF(opts: SupplierDetailsPdfOptions): Promise<void> {
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
    pdf.text('SUPPLIER STATEMENT', pageWidth - MARGIN_X, y + 6, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text(opts.supplier.name, pageWidth - MARGIN_X, y + 11, { align: 'right' });
    pdf.text(`Generated: ${formatDate(new Date().toISOString())}`, pageWidth - MARGIN_X, y + 15.5, { align: 'right' });

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
    pdf.text(`SUPPLIER STATEMENT — ${opts.supplier.name} — CONTINUED`, pageWidth - MARGIN_X, y + 4, { align: 'right' });
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

  const drawInfoLine = (text: string) => {
    ensureSpace(6);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(60, 60, 60);
    pdf.text(text, MARGIN_X, cursorY + 4);
    pdf.setTextColor(0, 0, 0);
    cursorY += 6;
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
    pdf.text('Supplier Statement', pageWidth / 2, y, { align: 'center' });
    pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth - MARGIN_X, y, { align: 'right' });
    pdf.setTextColor(0, 0, 0);
  };

  // ── Page 1: letterhead + supplier info ─────────────────────────────────
  cursorY = drawLetterhead();
  sectionTitle('Supplier Information');
  const infoLine = [opts.supplier.phone, opts.supplier.address, opts.supplier.gstin ? `GSTIN: ${opts.supplier.gstin}` : null, opts.supplier.state ? `${opts.supplier.state}${opts.supplier.stateCode ? ` (${opts.supplier.stateCode})` : ''}` : null]
    .filter(Boolean)
    .join('   •   ');
  drawInfoLine(infoLine || 'No additional contact details on file.');
  cursorY += 2;

  // ── Payment Status ───────────────────────────────────────────────────────
  sectionTitle('Payment Status');
  drawStatRow([
    ['Total Purchased', money(opts.paymentStatus.totalPurchased)],
    ['Total Paid', money(opts.paymentStatus.totalPaid)],
    ['Outstanding (Payable)', money(opts.paymentStatus.outstanding)],
    ['Advance Paid', money(opts.paymentStatus.advance)],
  ]);

  // ── Stock / Products Supplied ────────────────────────────────────────────
  sectionTitle('Stock / Products Supplied');
  drawTable(
    ['Product', 'Brand', 'Category', 'Available Stock', 'Purchase Price', 'Selling Price'],
    [contentWidth - (30 + 30 + 26 + 26 + 26), 30, 30, 26, 26, 26],
    ['left', 'left', 'left', 'right', 'right', 'right'],
    opts.products.map((m) => [m.name, m.brand, m.category, String(m.availableStock), money(m.purchasePrice), money(m.sellingPrice)]),
    'No stock currently on file from this supplier.'
  );

  // ── Transaction History ──────────────────────────────────────────────────
  sectionTitle('Transaction History');
  drawTable(
    ['Date', 'Expense ID', 'Category', 'Description', 'Reference', 'Amount', 'Paid', 'Balance'],
    [22, 26, 30, contentWidth - (22 + 26 + 30 + 26 + 26 + 26 + 26), 26, 26, 26, 26],
    ['left', 'left', 'left', 'left', 'left', 'right', 'right', 'right'],
    opts.transactions.map((t) => {
      const paid = t.paidAmount ?? t.amount;
      return [formatDate(t.date), t.displayId || '-', t.category, t.description || '-', t.referenceNumber || '-', money(t.amount), money(paid), money(t.amount - paid)];
    }),
    'No transactions found for this supplier.'
  );

  const totalPages = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    drawFooter(p, totalPages);
  }

  const safeName = opts.supplier.name.replace(/\s+/g, '_').replace(/[^\w-]/g, '');
  pdf.save(`Supplier_Statement_${safeName}.pdf`);
}
