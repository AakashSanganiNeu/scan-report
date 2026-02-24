import { DateEntryDraft, DailyEntryItemInput } from '@/lib/types';

export const computeDraftTotals = (lines: DateEntryDraft['lines']) => {
  return lines.reduce(
    (acc, line) => {
      acc.totalScans += line.quantity;
      acc.totalRevenue += line.line_total;
      return acc;
    },
    { totalScans: 0, totalRevenue: 0 }
  );
};

export const normalizeItemInputs = (items: DailyEntryItemInput[]): DailyEntryItemInput[] =>
  items.map((item) => ({
    scan_catalog_id: item.scan_catalog_id,
    quantity: Math.max(0, Math.floor(Number(item.quantity) || 0)),
  }));
