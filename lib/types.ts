export type ScanCatalog = {
  id: string;
  name: string;
  modality: string;
  is_active: boolean;
  created_at: string;
};

export type ScanPriceHistory = {
  id: string;
  scan_catalog_id: string;
  price: number;
  effective_start_date: string;
  reason: string | null;
  created_at: string;
  created_by: string | null;
};

export type CurrentEffectivePrice = {
  scan_catalog_id: string;
  scan_name: string;
  price: number;
  effective_start_date: string;
};

export type DailyEntry = {
  id: string;
  entry_date: string;
  notes: string | null;
  total_scans: number;
  total_revenue: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type DailyEntryItem = {
  id: string;
  daily_entry_id: string;
  scan_catalog_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
};

export type DailyEntryItemWithScan = DailyEntryItem & {
  scan_name: string;
};

export type DailyEntryWithItems = DailyEntry & {
  items: DailyEntryItemWithScan[];
};

export type DailyEntryItemInput = {
  scan_catalog_id: string;
  quantity: number;
};

export type DailyEntryFormData = {
  entry_date: string;
  notes: string;
  items: DailyEntryItemInput[];
};

export type DateDraftLine = {
  scan_catalog_id: string;
  scan_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  missing_price: boolean;
};

export type DateEntryDraft = {
  entry_date: string;
  notes: string;
  exists: boolean;
  entry_id: string | null;
  lines: DateDraftLine[];
  total_scans: number;
  total_revenue: number;
};

export type MonthlySummaryItem = {
  scan_catalog_id: string;
  scan_name: string;
  total_quantity: number;
  total_revenue: number;
  average_quantity_per_day: number;
};

export type MonthlySummary = {
  month: string;
  total_days: number;
  total_scans: number;
  total_revenue: number;
  average_revenue_per_day: number;
  highest_revenue_day: {
    date: string;
    revenue: number;
  } | null;
  items: MonthlySummaryItem[];
};

export type DailyStats = {
  date: string;
  total_scans: number;
  total_revenue: number;
};

export type AuditLog = {
  id: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  change_summary: string | null;
  before_data: unknown;
  after_data: unknown;
  created_at: string;
  created_by: string | null;
};

export type AuditFilter = {
  startDate?: string;
  endDate?: string;
  action?: 'CREATE' | 'UPDATE' | 'DELETE' | 'ALL';
  entityType?: 'daily_entry' | 'price' | 'ALL';
};
