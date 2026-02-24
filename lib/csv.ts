import { DailyEntryWithItems, MonthlySummary } from '@/lib/types';
import { formatDate } from '@/lib/utils/formatting';

const quote = (value: string | number | null | undefined) => {
  const input = value == null ? '' : String(value);
  if (input.includes(',') || input.includes('"') || input.includes('\n')) {
    return `"${input.replaceAll('"', '""')}"`;
  }
  return input;
};

const download = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const exportDailyEntriesCSV = (
  entries: DailyEntryWithItems[],
  monthLabel: string
) => {
  const header = ['Date', 'Total Scans', 'Total Revenue (INR)', 'Last Updated At', 'Notes'];
  const rows = entries.map((entry) => [
    formatDate(entry.entry_date),
    entry.total_scans,
    entry.total_revenue,
    entry.updated_at,
    entry.notes || '',
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map(quote).join(','))
    .join('\n');

  download(csv, `ramya-daily-entries-${monthLabel}.csv`);
};

export const exportMonthlySummaryCSV = (summary: MonthlySummary) => {
  const header = ['Scan Type', 'Total Quantity', 'Revenue (INR)', 'Average Qty/Day'];
  const rows = summary.items.map((item) => [
    item.scan_name,
    item.total_quantity,
    item.total_revenue,
    item.average_quantity_per_day.toFixed(2),
  ]);

  rows.push([
    'Grand Total',
    summary.total_scans,
    summary.total_revenue,
    summary.total_days > 0 ? (summary.total_scans / summary.total_days).toFixed(2) : '0.00',
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map(quote).join(','))
    .join('\n');

  download(csv, `ramya-monthly-summary-${summary.month}.csv`);
};
