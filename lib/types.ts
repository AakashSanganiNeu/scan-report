export type Profile = {
  id: string;
  full_name: string | null;
  created_at: string;
};

export type SubscriptionStatus = 'trialing' | 'active' | 'expired' | 'canceled';

export type Subscription = {
  id: string;
  user_id: string;
  subscription_status: SubscriptionStatus;
  plan_name: string | null;
  trial_start_at: string | null;
  trial_end_at: string | null;
  premium_start_at: string | null;
  premium_end_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Hospital = {
  id: string;
  user_id: string;
  name: string;
  location: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AccountOverview = {
  user_email: string;
  profile: Profile | null;
  subscription: Subscription | null;
  days_remaining: number;
  hospitals_count: number;
  categories_count: number;
  is_read_only: boolean;
};

export type ScanCatalog = {
  id: string;
  user_id: string | null;
  name: string;
  modality: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at?: string;
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
  user_id?: string | null;
  hospital_id: string | null;
  hospital_name?: string | null;
  entry_date: string;
  notes: string | null;
  total_scans: number;
  total_revenue: number;
  calculated_total_revenue: number;
  final_total_revenue: number;
  is_manual_override: boolean;
  manual_override_reason: string | null;
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
  hospital_id: string;
  notes: string;
  use_manual_override: boolean;
  manual_total_revenue: number | null;
  manual_override_reason: string;
  copy_previous_day?: boolean;
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
  hospital_id: string | null;
  notes: string;
  exists: boolean;
  entry_id: string | null;
  lines: DateDraftLine[];
  total_scans: number;
  calculated_total_revenue: number;
  final_total_revenue: number;
  is_manual_override: boolean;
  manual_override_reason: string;
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
  hospital_name?: string;
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
  entityType?: 'daily_entry' | 'price' | 'subscription' | 'hospital' | 'ALL';
};
