/**
 * Export generic array of objects to Excel .xlsx file download
 * Uses dynamic import to reduce main bundle size.
 */
export async function exportToExcel<T extends Record<string, any>>(
  data: T[],
  fileName: string,
  sheetName: string = 'Sheet1'
) {
  if (!data || data.length === 0) {
    alert('No data available to export.');
    return;
  }

  // Dynamically import xlsx to keep the initial JS bundle small
  const XLSX = await import('xlsx');

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Trigger browser download
  XLSX.writeFile(workbook, `${fileName.replace(/\.xlsx$/i, '')}.xlsx`);
}
