export interface LoadedLogo {
  dataUrl: string; // always PNG, regardless of source format
  width: number;
  height: number;
}

// Rasterizes the clinic logo (PNG/JPEG/SVG — whatever was uploaded in
// Settings) onto a canvas and reads it back as a PNG data URL, which every
// jsPDF build can embed via addImage regardless of the original format.
// Never throws — a failed fetch/CORS/decode just means the PDF renders
// without the logo (text-only letterhead, exactly like before this
// feature existed), never a broken/blank PDF.
export async function loadLogoAsPngDataUrl(url?: string | null): Promise<LoadedLogo | null> {
  if (!url) return null;
  try {
    const img: HTMLImageElement = await new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('logo image failed to load'));
      image.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    if (!canvas.width || !canvas.height) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);

    const dataUrl = canvas.toDataURL('image/png');
    return { dataUrl, width: canvas.width, height: canvas.height };
  } catch {
    return null;
  }
}

// Scales a loaded logo to fit a target box (mm) while preserving aspect
// ratio — used so a very wide or very tall uploaded logo never distorts or
// overruns the letterhead.
export function fitLogoBox(logo: LoadedLogo, maxWidthMm: number, maxHeightMm: number): { w: number; h: number } {
  const ratio = logo.width / logo.height;
  let w = maxHeightMm * ratio;
  let h = maxHeightMm;
  if (w > maxWidthMm) {
    w = maxWidthMm;
    h = maxWidthMm / ratio;
  }
  return { w, h };
}
