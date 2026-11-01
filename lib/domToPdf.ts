// Captures real DOM elements (already rendered on screen) into a PDF, one
// element per page — a screenshot-based alternative to hand-drawing a PDF
// from raw data, so it can never drift out of sync with the print page's
// design the way a separate reimplementation can.
//
// The subtlety: html2canvas renders using whatever styles are CURRENTLY
// ACTIVE in the browser — and a normal page view is always "screen" media,
// never "print", so every `@media print { ... }` rule (and every Tailwind
// `print:` utility, which compiles to the same thing) is simply inactive
// during a capture. That's what made the first version look like the
// on-screen editing card (shadow, rounded corners, input boxes) instead of
// the actual print output. Fixed below by temporarily forcing every
// `@media print` rule already in the stylesheet to apply as "all" for the
// duration of the capture, then reverting it — reusing the exact CSS that
// print already uses, not a second copy of it.
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

function collectPrintMediaRules(ruleList: CSSRuleList, acc: CSSMediaRule[]): void {
  for (const rule of Array.from(ruleList)) {
    if (rule instanceof CSSMediaRule) {
      if (rule.media.mediaText.includes('print')) acc.push(rule);
      collectPrintMediaRules(rule.cssRules, acc);
    } else if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) {
      // Tailwind v4 nests utilities in native @layer blocks, which can wrap
      // (or be wrapped by) @media print — recurse into any such container
      // (@layer, @supports, @container, ...) so nested print rules are
      // still found regardless of nesting depth.
      collectPrintMediaRules((rule as CSSGroupingRule).cssRules, acc);
    }
  }
}

// Forces every `@media print` rule in every same-origin stylesheet to
// match immediately (mediaText: 'all'), returning a function that restores
// each rule's original media text. Cross-origin stylesheets (none expected
// in this app, but defensively handled) are skipped — reading their
// cssRules throws a SecurityError.
function forcePrintStylesOn(): () => void {
  const mediaRules: CSSMediaRule[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      collectPrintMediaRules(sheet.cssRules, mediaRules);
    } catch {
      continue;
    }
  }
  const originals = mediaRules.map((r) => r.media.mediaText);
  mediaRules.forEach((r) => {
    r.media.mediaText = 'all';
  });
  return () => {
    mediaRules.forEach((r, i) => {
      r.media.mediaText = originals[i];
    });
  };
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

export async function generatePdfFromElements(elementIds: string[], filename: string): Promise<void> {
  const { default: html2canvas } = await import('html2canvas-pro');
  const { jsPDF } = await import('jspdf');

  const restorePrintStyles = forcePrintStylesOn();
  try {
    // Let the browser actually repaint with the print styles now active
    // before the first capture reads computed styles off stale layout.
    await nextFrame();

    let pdf: InstanceType<typeof jsPDF> | null = null;

    for (const id of elementIds) {
      const el = document.getElementById(id);
      if (!el) continue;

      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });
      const imgData = canvas.toDataURL('image/png');

      // Fit the captured image to A4 width, scaling height proportionally —
      // each page is sized to its own content's aspect ratio (via jsPDF's
      // custom page format) so the full page is always visible with
      // nothing cropped or squeezed, while still matching standard A4
      // width.
      const imgHeightMm = (canvas.height * A4_WIDTH_MM) / canvas.width;
      const pageHeightMm = Math.max(imgHeightMm, A4_HEIGHT_MM * 0.3);

      if (!pdf) {
        pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [A4_WIDTH_MM, pageHeightMm] });
      } else {
        pdf.addPage([A4_WIDTH_MM, pageHeightMm], 'portrait');
      }
      pdf.addImage(imgData, 'PNG', 0, 0, A4_WIDTH_MM, imgHeightMm);
    }

    if (pdf) pdf.save(filename);
  } finally {
    // Always revert, even if capture throws — the live page must go back
    // to its normal on-screen editing appearance.
    restorePrintStyles();
  }
}
