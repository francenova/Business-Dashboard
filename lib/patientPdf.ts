import type { ClinicSettings, Patient, Visit } from '@/lib/types';
import { formatDate } from '@/lib/formatDate';

// Landscape A4 (297 x 210mm) — the 11-column table needs the extra width to
// stay readable; this also matches the reference design. Page size is fixed
// and never changes regardless of record count — pagination only ever
// changes how many rows are drawn, never the page dimensions.
const MARGIN = 10;
const PAGE_WIDTH = 297;
const PAGE_HEIGHT = 210;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_RESERVE = 10;
// Full clinic+report header repeats identically on every page (not a
// shrunk "continued" variant) — same height everywhere so the table always
// starts at the same vertical position, per the requested layout.
const HEADER_BLOCK_HEIGHT = 27;
const TABLE_HEADER_H = 7;
const DATA_ROW_H = 5.6; // single-line row height — see PATIENTS_PER_PAGE below for why this exact value matters
const MAX_ROW_H = 10; // cap on how tall a row is allowed to grow when a page has far fewer than 25 patients — tall enough to visibly fill the page, not so tall a lone row looks broken
// Vertical room available for table rows on any page, after the fixed
// header and before the Grand Total bar (reserved separately, below).
const ROWS_BUDGET_PER_PAGE = PAGE_HEIGHT - FOOTER_RESERVE - (MARGIN + HEADER_BLOCK_HEIGHT + TABLE_HEADER_H) - (TABLE_HEADER_H + 3);
// The page is deliberately chunked at a FIXED 25 patients, not left to
// emerge from cumulative row height — 25 rows (25 * 5.6mm = 140mm) plus the
// Grand Total row (~10mm) is 150mm, safely under the ~156mm actually
// available per page, so 25-per-page always holds and Grand Total always
// fits after the final chunk's 25th row. A purely height-driven "whatever
// fits" approach can't guarantee the boundary lands at exactly patient #25
// (the physical row budget and the budget that also needs to leave room for
// Grand Total don't divide evenly), which is why this is fixed rather than
// computed from available space on every page.
const PATIENTS_PER_PAGE = 25;
const INK: [number, number, number] = [30, 58, 138]; // blue-900
const INK_DARK: [number, number, number] = [23, 37, 84]; // blue-950

function money(n?: number): string {
  return `Rs. ${(n || 0).toLocaleString('en-IN')}`;
}

interface PatientsDatabasePdfData {
  settings: ClinicSettings;
  patients: Patient[];
  visits: Visit[]; // all visits across all patients — used to compute per-patient totals
  periodLabel?: string; // e.g. "This Year (01 Jan 2026 - 31 Dec 2026)" shown in the header
}

// Column order and relative widths match the agreed spec exactly
// (# 5%, Patient ID 10%, Name 11%, Age 5%, Gender 8%, Address 13%,
// Visit Date 11%, Total 8%, Advance 9%, Pending 8%, Status 12% — Status
// absorbs the small rounding remainder so the columns sum to exactly
// CONTENT_WIDTH). '#' is a true running row number from the single render
// loop's index below, so it continues correctly across pages — it is never
// the patient's database ID and never resets on a new page.
const COLUMNS: { key: string; label: string; w: number; align?: 'left' | 'right' | 'center' }[] = [
  { key: 'no', label: '#', w: 0.05, align: 'center' },
  { key: 'id', label: 'PATIENT ID', w: 0.10 },
  { key: 'name', label: 'NAME', w: 0.11 },
  { key: 'age', label: 'AGE', w: 0.05, align: 'center' },
  { key: 'gender', label: 'GENDER', w: 0.08, align: 'center' },
  { key: 'address', label: 'ADDRESS', w: 0.13 },
  { key: 'visit', label: 'VISIT DATE', w: 0.11, align: 'center' },
  { key: 'total', label: 'TOTAL', w: 0.08, align: 'right' },
  { key: 'advance', label: 'ADVANCE', w: 0.09, align: 'right' },
  { key: 'pending', label: 'PENDING', w: 0.08, align: 'right' },
  { key: 'status', label: 'STATUS', w: 0.12, align: 'center' },
];

// One combined PDF listing every (filtered) patient as a single table —
// #, Patient ID, Name, Age, Gender, Address, Visit Date, Total, Advance,
// Pending, Status. Grand Total is computed once over the FULL patient list
// and drawn exactly once, after the very last row — which, by construction
// (it is simply the next thing drawn once the loop ends), always lands on
// the last page, never an intermediate one.
export async function generatePatientsDatabasePDF(data: PatientsDatabasePdfData): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const financials = new Map<string, { total: number; advance: number; pending: number }>();
  for (const p of data.patients) {
    const pVisits = data.visits.filter((v) => v.patientId === p.id);
    const total = pVisits.reduce((acc, v) => acc + (v.payment?.grandTotal || 0), 0);
    const advance = pVisits.reduce((acc, v) => acc + (v.payment?.advance || 0), 0);
    financials.set(p.id, { total, advance, pending: Math.max(0, total - advance) });
  }

  let y = MARGIN;
  let pageIndex = 1; // 1-based; used only for the "(CONTINUED)" label — true footer numbering is drawn in a second pass once the final page count is known

  const colX: number[] = [];
  let acc = MARGIN;
  COLUMNS.forEach((c) => {
    colX.push(acc);
    acc += CONTENT_WIDTH * c.w;
  });

  const cellX = (i: number) => {
    const c = COLUMNS[i];
    const colW = CONTENT_WIDTH * c.w;
    if (c.align === 'right') return { x: colX[i] + colW - 2, opts: { align: 'right' as const } };
    if (c.align === 'center') return { x: colX[i] + colW / 2, opts: { align: 'center' as const } };
    return { x: colX[i] + 2, opts: {} };
  };

  // Thin navy outer frame enclosing the whole printable area — drawn first,
  // on every page, so header/table/footer all sit inside the same bordered
  // report sheet.
  const drawOuterFrame = () => {
    pdf.setDrawColor(...INK);
    pdf.setLineWidth(0.4);
    pdf.rect(MARGIN - 3, MARGIN - 3, CONTENT_WIDTH + 6, PAGE_HEIGHT - (MARGIN - 3) * 2);
  };

  // The SAME header on every page — clinic identity on the left, report
  // identity on the right, a "(CONTINUED)" tag on every page after the
  // first. No shrunk/alternate variant, so the table always begins at
  // exactly HEADER_BLOCK_HEIGHT regardless of which page it's on.
  const drawHeader = () => {
    const hy = MARGIN;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(17);
    pdf.setTextColor(...INK_DARK);
    pdf.text(data.settings.clinicName || 'Royal Opticals', MARGIN, hy + 7);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(70, 70, 70);
    const subtitle = data.settings.credentials || data.settings.doctorTitle || 'Computerized Eye Testing & Contact Lens Clinic';
    pdf.text(subtitle, MARGIN, hy + 12.5);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(...INK_DARK);
    const contactLine = [`Ph: ${data.settings.phone || '-'}`, data.settings.email || ''].filter(Boolean).join('   |   ');
    pdf.text(contactLine, MARGIN, hy + 17.5);

    const rightX = PAGE_WIDTH - MARGIN;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(...INK);
    const title = pageIndex > 1 ? 'PATIENT DATABASE  (CONTINUED)' : 'PATIENT DATABASE';
    pdf.text(title, rightX, hy + 7, { align: 'right' });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(90, 90, 90);
    if (data.periodLabel) pdf.text(data.periodLabel, rightX, hy + 12, { align: 'right' });
    pdf.text(`Generated: ${new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, rightX, hy + 16, { align: 'right' });
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...INK_DARK);
    pdf.text(`${data.patients.length} patient${data.patients.length === 1 ? '' : 's'}`, rightX, hy + 20, { align: 'right' });

    pdf.setDrawColor(...INK);
    pdf.setLineWidth(0.5);
    pdf.line(MARGIN, hy + HEADER_BLOCK_HEIGHT - 3, PAGE_WIDTH - MARGIN, hy + HEADER_BLOCK_HEIGHT - 3);
    pdf.setTextColor(0, 0, 0);
  };

  const drawColumnDividers = (top: number, height: number, color: [number, number, number]) => {
    let x = MARGIN;
    pdf.setDrawColor(...color);
    pdf.setLineWidth(0.15);
    COLUMNS.forEach((c, i) => {
      x += CONTENT_WIDTH * c.w;
      if (i < COLUMNS.length - 1) pdf.line(x, top, x, top + height);
    });
  };

  const drawTableHeader = () => {
    pdf.setFillColor(...INK_DARK);
    pdf.rect(MARGIN, y, CONTENT_WIDTH, TABLE_HEADER_H, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    COLUMNS.forEach((c, i) => {
      const { x, opts } = cellX(i);
      pdf.text(c.label, x, y + TABLE_HEADER_H / 2 + 1.5, opts);
    });
    drawColumnDividers(y, TABLE_HEADER_H, [90, 100, 130]);
    y += TABLE_HEADER_H;
    pdf.setTextColor(0, 0, 0);
  };

  const newPage = () => {
    pdf.addPage();
    pageIndex += 1;
    y = MARGIN;
    drawOuterFrame();
    drawHeader();
    y = MARGIN + HEADER_BLOCK_HEIGHT;
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_HEIGHT - FOOTER_RESERVE) {
      newPage();
      return true;
    }
    return false;
  };

  // ── Page 1 ────────────────────────────────────────────────────────────
  drawOuterFrame();
  drawHeader();
  y = MARGIN + HEADER_BLOCK_HEIGHT;

  ensureSpace(TABLE_HEADER_H + 2);
  drawTableHeader();

  if (data.patients.length === 0) {
    // Still draw a full, properly proportioned page — row height expands to
    // the cap and the message sits where a row normally would, with Grand
    // Total (all zeros) pinned at the bottom like any other page.
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(9);
    pdf.setTextColor(140, 140, 140);
    pdf.text('No patients match the current filters.', MARGIN + CONTENT_WIDTH / 2, y + ROWS_BUDGET_PER_PAGE / 2, { align: 'center' });
  } else {
    // Fixed 25-patient chunks drive the page breaks (see PATIENTS_PER_PAGE
    // above) — each chunk after the first starts on a fresh page via
    // newPage(). The "#" serial number is the patient's absolute position
    // in the full filtered list (pageStart + i + 1), so it's continuous
    // across chunks/pages by construction, never resetting. A genuinely
    // long address still gets the extra height it needs via
    // splitTextToSize (never clipped, never pushed into a neighbouring
    // column) — the per-row ensureSpace guard below is purely a safety net
    // for that rare case, pushing only the overflowing remainder of a
    // chunk onto a new page rather than ever clipping data.
    for (let pageStart = 0; pageStart < data.patients.length; pageStart += PATIENTS_PER_PAGE) {
      if (pageStart > 0) {
        newPage();
        drawTableHeader();
      }
      const chunk = data.patients.slice(pageStart, pageStart + PATIENTS_PER_PAGE);
      // A page with fewer than a full 25-patient chunk (always just the
      // final page, by construction) gets its row height expanded — up to
      // MAX_ROW_H — to actually fill the page rather than leaving a stub
      // table followed by a large gap before Grand Total. A full 25-row
      // chunk computes back down to ~DATA_ROW_H here, so this has no effect
      // on normal full pages.
      const baseRowH = Math.max(DATA_ROW_H, Math.min(MAX_ROW_H, ROWS_BUDGET_PER_PAGE / chunk.length));

      chunk.forEach((p, i) => {
        const serialNo = pageStart + i + 1;
        const fin = financials.get(p.id) || { total: 0, advance: 0, pending: 0 };
        const addressLines = pdf.splitTextToSize(p.address || '-', CONTENT_WIDTH * COLUMNS[5].w - 4);
        // A single-line address (the overwhelming common case) fits in
        // exactly baseRowH — only a genuinely wrapped address adds height
        // on top of it, so the 25-per-page chunk math above (which assumes
        // single-line rows) holds precisely instead of being silently
        // overridden by a fixed per-row minimum.
        const rowH = baseRowH + Math.max(0, addressLines.length - 1) * 3.2;

        const broke = ensureSpace(rowH);
        if (broke) drawTableHeader();

        // Light-blue alternating rows
        if (i % 2 === 1) {
          pdf.setFillColor(235, 243, 255);
          pdf.rect(MARGIN, y, CONTENT_WIDTH, rowH, 'F');
        }

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        pdf.setTextColor(30, 30, 30);

        const values: (string | string[])[] = [
          String(serialNo),
          p.displayId || p.id,
          p.name || '-',
          p.age ? String(p.age) : '-',
          p.gender || '-',
          addressLines,
          p.lastVisitDate ? formatDate(p.lastVisitDate) : '-',
          money(fin.total),
          money(fin.advance),
          money(fin.pending),
          '',
        ];

        values.forEach((v, colI) => {
          if (colI === 10) return; // Status is a drawn badge, not plain text — see below
          if (colI === 9) {
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(...(fin.pending > 0 ? ([194, 65, 12] as [number, number, number]) : ([4, 120, 87] as [number, number, number])));
          } else {
            pdf.setFont('helvetica', colI === 2 ? 'bold' : 'normal');
            pdf.setTextColor(colI === 2 ? INK_DARK[0] : 30, colI === 2 ? INK_DARK[1] : 30, colI === 2 ? INK_DARK[2] : 30);
          }
          const { x, opts } = cellX(colI);
          pdf.text(v as string | string[], x, y + rowH / 2 + 1.3, opts);
        });

        // Status badge — green "COMPLETED", orange "PENDING"
        const isPending = fin.pending > 0;
        const badgeColor: [number, number, number] = isPending ? [194, 65, 12] : [4, 120, 87];
        const badgeBg: [number, number, number] = isPending ? [255, 237, 213] : [209, 250, 229];
        const { x: statusCx } = cellX(10);
        const badgeW = Math.min(CONTENT_WIDTH * COLUMNS[10].w - 4, 24);
        const badgeH = Math.min(4.6, rowH - 1.6);
        pdf.setFillColor(...badgeBg);
        pdf.roundedRect(statusCx - badgeW / 2, y + (rowH - badgeH) / 2, badgeW, badgeH, 1, 1, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(6.3);
        pdf.setTextColor(...badgeColor);
        pdf.text(isPending ? 'PENDING' : 'COMPLETED', statusCx, y + rowH / 2 + 1.1, { align: 'center' });

        drawColumnDividers(y, rowH, [210, 220, 238]);
        y += rowH;
        pdf.setDrawColor(210, 220, 238);
        pdf.setLineWidth(0.15);
        pdf.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
      });
    }
  }

  // ── Grand Total — pinned to a fixed position near the bottom of the
  // final page's usable area (not simply "right after the last row"), so a
  // short page still looks like a complete, full-height report instead of
  // a stub table followed by a big empty gap. Always drawn exactly once,
  // after everything else — whichever page that physically ends up being
  // is by definition the final page, so this can never land on an
  // intermediate page. Drawn even when there are zero patients (all-zero
  // totals) so every generated PDF has the same complete structure. The
  // Math.max guard is a safety net only: if an extreme amount of wrapped
  // text ever pushed the last row past this fixed position, it falls back
  // to drawing right after that row instead of overlapping it. ──────────
  const grandTotalY = Math.max(PAGE_HEIGHT - FOOTER_RESERVE - (TABLE_HEADER_H + 1), y + 2);
  y = grandTotalY;
  const grandTotal = data.patients.reduce((a, p) => a + (financials.get(p.id)?.total || 0), 0);
  const grandAdvance = data.patients.reduce((a, p) => a + (financials.get(p.id)?.advance || 0), 0);
  const grandPending = data.patients.reduce((a, p) => a + (financials.get(p.id)?.pending || 0), 0);
  pdf.setFillColor(...INK_DARK);
  pdf.rect(MARGIN, y, CONTENT_WIDTH, TABLE_HEADER_H + 1, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(255, 255, 255);
  pdf.text('GRAND TOTAL', cellX(4).x, y + (TABLE_HEADER_H + 1) / 2 + 1.5);
  pdf.text(money(grandTotal), cellX(7).x, y + (TABLE_HEADER_H + 1) / 2 + 1.5, { align: 'right' });
  pdf.text(money(grandAdvance), cellX(8).x, y + (TABLE_HEADER_H + 1) / 2 + 1.5, { align: 'right' });
  pdf.text(money(grandPending), cellX(9).x, y + (TABLE_HEADER_H + 1) / 2 + 1.5, { align: 'right' });
  y += TABLE_HEADER_H + 1;

  // ── Footers on every page (drawn last, once the true page count is known) ──
  const totalPages = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    const fy = PAGE_HEIGHT - MARGIN + 4;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...INK_DARK);
    pdf.text(`Page ${p} of ${totalPages}`, PAGE_WIDTH - MARGIN, fy, { align: 'right' });
    pdf.setTextColor(140, 140, 140);
    pdf.text('Computer Generated Report', MARGIN, fy);
  }

  const safeName = (data.periodLabel || 'Report').replace(/\s+/g, '_').replace(/[^\w-]/g, '');
  pdf.save(`Patients_Database_${safeName}.pdf`);
}
