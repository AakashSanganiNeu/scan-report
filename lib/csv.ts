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

export const exportDailyEntriesCSV = (entries: DailyEntryWithItems[], monthLabel: string, hospitalLabel: string, userName?: string) => {
  const header = ['Generated At', 'User', 'Hospital Filter', 'Date', 'Hospital', 'Total Scans', 'Calculated Revenue', 'Final Revenue', 'Manual Override', 'Override Reason', 'Last Updated At', 'Notes'];
  const generatedAt = new Date().toLocaleString('en-IN');
  const rows = entries.map((entry) => [
    generatedAt,
    userName || '',
    hospitalLabel,
    formatDate(entry.entry_date),
    entry.hospital_name || '',
    entry.total_scans,
    Number(entry.calculated_total_revenue ?? entry.total_revenue),
    Number(entry.final_total_revenue ?? entry.total_revenue),
    entry.is_manual_override ? 'Yes' : 'No',
    entry.manual_override_reason || '',
    entry.updated_at,
    entry.notes || '',
  ]);

  const csv = [header, ...rows].map((row) => row.map(quote).join(',')).join('\n');
  download(csv, `ramya-daily-entries-${monthLabel}.csv`);
};

export const exportMonthlySummaryCSV = (summary: MonthlySummary, hospitalLabel: string) => {
  const header = ['Hospital Filter', 'Scan Type', 'Total Quantity', 'Revenue (INR)', 'Average Qty/Day'];
  const rows = summary.items.map((item) => [hospitalLabel, item.scan_name, item.total_quantity, item.total_revenue, item.average_quantity_per_day.toFixed(2)]);
  rows.push([hospitalLabel, 'Grand Total', summary.total_scans, summary.total_revenue, summary.total_days > 0 ? (summary.total_scans / summary.total_days).toFixed(2) : '0.00']);
  const csv = [header, ...rows].map((row) => row.map(quote).join(',')).join('\n');
  download(csv, `ramya-monthly-summary-${summary.month}.csv`);
};
