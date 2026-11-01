import type { ClinicSettings, Medicine, StockMovement } from '@/lib/types';
import type { InventorySummary, CategorySummaryRow } from '@/hooks/useInventoryReports';
import { formatDate } from '@/lib/formatDate';
import { categoryLabel, codeFor, typeSpecFor, stockStatusLabel, buildMovementTotals } from '@/lib/inventoryReportHelpers';

const MARGIN_X = 12;
const MARGIN_TOP = 10;
const MARGIN_BOTTOM = 16;
const LETTERHEAD_HEIGHT = 28;
const SLIM_HEADER_HEIGHT = 10;
const STRUCTURAL_LINE_WEIGHT = 0.3;
const HAIRLINE_WEIGHT = 0.15;

function money(n?: number): string {
  return `Rs. ${(n || 0).toLocaleString('en-IN')}`;
}

export interface InventoryReportsPdfOptions {
  settings: ClinicSettings;
  periodHeading: string;
  categoryHeading: string;
  summary: InventorySummary;
  items: Medicine[];
  lowStockItems: Medicine[];
  outOfStockItems: Medicine[];
  categorySummary: CategorySummaryRow[];
  movements: StockMovement[];
}

// Same section-flow pagination architecture as lib/reportAnalysisPdf.ts —
// a running cursor that breaks to a new page whenever the next section
// wouldn't fit, footers drawn in a second pass once the true page count is
// known. Fits this document's mix of card rows and variable-length tables
// better than TSR/DSR's single-table row-count formula.
export async function generateInventoryReportsPDF(opts: InventoryReportsPdfOptions): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { loadLogoAsPngDataUrl, fitLogoBox } = await import('@/lib/pdfLogo');
  const logo = opts.settings.showLogoOnDocuments ? await loadLogoAsPngDataUrl(opts.settings.logoUrl) : null;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN_X * 2;

  let cursorY = MARGIN_TOP;

  // Centered title stack — "INVENTORY REPORT" large, clinic name directly
  // below it, then contact/period/category as small centered detail lines.
  // A small logo (if enabled) sits in the corner as an accent rather than
  // anchoring the layout, so it never pushes the centered text off-center.
  const drawLetterhead = () => {
    const y = MARGIN_TOP;
    if (logo) {
      const box = fitLogoBox(logo, 12, 10);
      pdf.addImage(logo.dataUrl, 'PNG', MARGIN_X, y, box.w, box.h);
    }
    const cx = pageWidth / 2;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.setTextColor(15, 23, 42);
    pdf.text('INVENTORY REPORT', cx, y + 8, { align: 'center' });

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(30, 58, 138);
    pdf.text(opts.settings.clinicName || 'Royal Opticals', cx, y + 14, { align: 'center' });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(90, 90, 90);
    const contactLine = [opts.settings.address, opts.settings.phone, opts.settings.email, opts.settings.gstin ? `GSTIN: ${opts.settings.gstin}` : ''].filter(Boolean).join('  •  ');
    if (contactLine) pdf.text(contactLine, cx, y + 18.5, { align: 'center' });

    pdf.setFontSize(7.5);
    pdf.setTextColor(60, 60, 60);
    pdf.text(`Period: ${opts.periodHeading}   |   Category: ${opts.categoryHeading}   |   Generated: ${new Date().toLocaleDateString('en-IN')}`, cx, y + 23, { align: 'center' });

    pdf.setDrawColor(15, 23, 42);
    pdf.setLineWidth(STRUCTURAL_LINE_WEIGHT);
    pdf.line(MARGIN_X, y + LETTERHEAD_HEIGHT - 3, pageWidth - MARGIN_X, y + LETTERHEAD_HEIGHT - 3);
    pdf.setTextColor(0, 0, 0);
    return MARGIN_TOP + LETTERHEAD_HEIGHT;
  };

  const drawSlimHeader = () => {
    const y = MARGIN_TOP;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(15, 23, 42);
    pdf.text(`${opts.settings.clinicName || 'Royal Opticals'} — INVENTORY REPORT (CONTINUED)`, pageWidth / 2, y + 4, { align: 'center' });
    pdf.setTextColor(0, 0, 0);
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

  // rowHeight/headerHeight tuned so the main per-record table lands at
  // roughly 20-28 rows per A4 page (fewer on page 1, which shares space
  // with the letterhead) — spacious enough to read comfortably, per-column
  // gridlines drawn on every row so it reads as a real bordered grid
  // (matching a standard printed inventory report) rather than plain text
  // rows with only an outer box.
  const drawTable = (headers: string[], widths: number[], aligns: ('left' | 'right' | 'center')[], rows: string[][], emptyLabel: string) => {
    const rowHeight = 9;
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
    pdf.text('Inventory Report', pageWidth / 2, y, { align: 'center' });
    pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth - MARGIN_X, y, { align: 'right' });
    pdf.setTextColor(0, 0, 0);
  };

  // ── Page 1: letterhead, then straight into the main table — Summary
  // moves to the END of the document (see below), per the requested layout. ──
  cursorY = drawLetterhead();

  // ── Inventory Detail — the main per-product table, redesigned to carry
  // real product identity (Brand, Code, a category-adaptive Type/Spec
  // column) and this period's movement alongside current stock, not just a
  // generic stock/status snapshot. The leading "#" is a true running row
  // number (from this single .map's index) so it continues correctly across
  // pages — page 1 ending at #25 means page 2 starts at #26, never resetting
  // or duplicating. ───────────────────────────────────────────────────────
  const movementTotals = buildMovementTotals(opts.movements);
  sectionTitle('Inventory Detail');
  drawTable(
    ['#', 'Category', 'Item', 'Code', 'Brand', 'Type / Spec', 'Stock', 'Added', 'Sold', 'Unit Price', 'Value', 'Supplier', 'Status'],
    [8, 16, 24, 16, 14, 18, 10, 10, 10, 13, 15, 14, contentWidth - (8 + 16 + 24 + 16 + 14 + 18 + 10 + 10 + 10 + 13 + 15 + 14)],
    ['center', 'left', 'left', 'left', 'left', 'left', 'right', 'right', 'right', 'right', 'right', 'left', 'center'],
    opts.items.map((m, idx) => {
      const mv = movementTotals.get(m.id);
      return [
        String(idx + 1),
        categoryLabel(m),
        m.name,
        codeFor(m),
        m.brand || '-',
        typeSpecFor(m),
        String(m.availableStock),
        mv?.added ? `+${mv.added}` : '-',
        mv?.sold ? `-${mv.sold}` : '-',
        money(m.sellingPrice),
        money(m.availableStock * m.sellingPrice),
        m.supplier || '-',
        stockStatusLabel(m),
      ];
    }),
    'No inventory items found.'
  );

  // ── Category Summary ──────────────────────────────────────────────────
  sectionTitle('Category-wise Report');
  drawTable(
    ['Category', 'Products', 'Available Qty', 'Low Stock', 'Out of Stock', 'Stock Value'],
    [40, 26, 30, 24, 26, contentWidth - (40 + 26 + 30 + 24 + 26)],
    ['left', 'right', 'right', 'right', 'right', 'right'],
    opts.categorySummary.map((c) => [c.category, String(c.totalProducts), String(c.availableQty), String(c.lowStock), String(c.outOfStock), money(c.stockValue)]),
    'No category data available.'
  );

  // ── Low Stock ──────────────────────────────────────────────────────────
  sectionTitle('Low Stock Report');
  drawTable(
    ['Item', 'Category', 'Brand', 'Code', 'Current', 'Minimum', 'Shortage', 'Supplier'],
    [contentWidth - (26 + 20 + 20 + 16 + 16 + 18 + 26), 26, 20, 20, 16, 16, 18, 26],
    ['left', 'left', 'left', 'left', 'right', 'right', 'right', 'left'],
    opts.lowStockItems.map((m) => [
      m.name,
      categoryLabel(m),
      m.brand || '-',
      codeFor(m),
      String(m.availableStock),
      String(m.minimumStock),
      String(Math.max(0, m.minimumStock - m.availableStock)),
      m.supplier || '-',
    ]),
    'No low-stock items.'
  );

  // ── Out of Stock ───────────────────────────────────────────────────────
  sectionTitle('Out of Stock Report');
  drawTable(
    ['Item', 'Category', 'Brand', 'Code', 'Last Known Price', 'Supplier'],
    [contentWidth - (26 + 20 + 22 + 28 + 28), 26, 20, 22, 28, 28],
    ['left', 'left', 'left', 'left', 'right', 'left'],
    opts.outOfStockItems.map((m) => [m.name, categoryLabel(m), m.brand || '-', codeFor(m), money(m.sellingPrice), m.supplier || '-']),
    'No out-of-stock items.'
  );

  // ── Stock Movement ─────────────────────────────────────────────────────
  sectionTitle('Stock Movement');
  drawTable(
    ['Date', 'Item', 'Category', 'Type', 'Qty', 'Reason', 'Reference'],
    [22, contentWidth - (22 + 26 + 20 + 14 + 30 + 28), 26, 20, 14, 30, 28],
    ['left', 'left', 'left', 'center', 'right', 'left', 'left'],
    opts.movements.map((m) => [formatDate(m.date), m.itemName, m.category, m.movementType, String(m.quantity), m.reason || '-', m.reference || '-']),
    'No stock movement found for this period.'
  );

  // ── Summary — moved to the end of the document: the overall totals read
  // as a closing recap once every detail table has already been seen. ─────
  sectionTitle('Summary');
  drawStatRow([
    ['Total Items', String(opts.summary.totalItems)],
    ['Stock Qty', String(opts.summary.totalStockQty)],
    ['Low Stock', String(opts.summary.lowStockCount)],
    ['Out of Stock', String(opts.summary.outOfStockCount)],
    ['Stock In', String(opts.summary.stockIn)],
    ['Stock Out', String(opts.summary.stockOut)],
  ]);
  drawStatRow([['Inventory Value', money(opts.summary.inventoryValue)]]);

  const totalPages = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    drawFooter(p, totalPages);
  }

  const safeHeading = opts.periodHeading.replace(/\s+/g, '_').replace(/[^\w-]/g, '');
  pdf.save(`Inventory_Reports_${safeHeading}.pdf`);
}
