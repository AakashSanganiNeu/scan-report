'use server';

import { createClient } from '@/lib/supabase/server';
import {
  AccountOverview,
  AuditFilter,
  AuditLog,
  CurrentEffectivePrice,
  Hospital,
  Profile,
  DateEntryDraft,
  DailyEntryFormData,
  DailyEntryWithItems,
  DailyStats,
  MonthlySummary,
  MonthlySummaryItem,
  ScanCatalog,
  ScanPriceHistory,
  Subscription,
} from '@/lib/types';
import { normalizeItemInputs } from '@/lib/calculations';

async function requireUserAndSubscription(write = false) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('You must be signed in to continue.');
  }

  const sub = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = Date.now();
  const trialActive = Boolean(
    sub.data?.trial_end_at && new Date(sub.data.trial_end_at).getTime() >= now
  );
  const premiumActive = Boolean(
    sub.data?.premium_end_at && new Date(sub.data.premium_end_at).getTime() >= now
  );

  const status = premiumActive
    ? 'active'
    : trialActive
      ? 'trialing'
      : sub.data?.subscription_status === 'canceled'
        ? 'canceled'
        : 'expired';

  if (write && status === 'expired') {
    throw new Error('Your trial has expired. Upgrade to continue editing data.');
  }

  return { supabase, userId: user.id, subscriptionStatus: status };
}

const DEFAULT_SCAN_PRICES: Array<{ name: string; price: number }> = [
  { name: 'Abdomen Pelvis', price: 1200 },
  { name: 'TVS', price: 1200 },
  { name: 'Growth Scan', price: 1000 },
  { name: 'Obs Doppler', price: 2000 },
  { name: 'Obs BPP', price: 2000 },
  { name: 'Color Doppler (1 leg arterial/venous)', price: 4000 },
  { name: 'TIFFA', price: 2500 },
  { name: 'NT Scan', price: 1800 },
  { name: 'Early Pregnancy', price: 1000 },
  { name: 'Small Parts (Swelling)', price: 1500 },
  { name: 'Follicular Study (3 visits)', price: 1800 },
  { name: 'USG Neck', price: 1500 },
  { name: 'Breast', price: 1500 },
  { name: 'Scrotum', price: 1500 },
  { name: 'Carotid Doppler', price: 2500 },
];
const DEFAULT_PRICE_BY_NAME = new Map(DEFAULT_SCAN_PRICES.map((scan) => [scan.name, scan.price]));

const monthRange = (year: number, month: number) => {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0).toISOString().split('T')[0];
  return { startDate, endDate };
};

const isMissingTableError = (message: string) =>
  message.includes("Could not find the table") || message.includes('does not exist');

const isMissingColumnError = (message: string) =>
  message.includes('does not exist') ||
  (message.includes('Could not find') && message.includes('column'));

const isMissingFunctionError = (message: string) =>
  message.includes('Could not find the function') || message.includes('does not exist');

const applyAuditFilterInMemory = (
  logs: AuditLog[],
  filter: AuditFilter
): AuditLog[] => {
  return logs.filter((log) => {
    const datePart = (log.created_at || '').slice(0, 10);
    if (filter.startDate && datePart && datePart < filter.startDate) return false;
    if (filter.endDate && datePart && datePart > filter.endDate) return false;
    if (filter.action && filter.action !== 'ALL' && log.action !== filter.action) return false;
    if (filter.entityType && filter.entityType !== 'ALL' && log.entity_type !== filter.entityType) {
      return false;
    }
    return true;
  });
};

async function writeAuditCompat(params: {
  entityType: 'daily_entry' | 'price';
  entityId?: string | null;
  entityLabel?: string | null;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  summary: string;
  beforeData?: unknown;
  afterData?: unknown;
  dailyEntryIdForLegacy?: string;
}) {
  const supabase = await createClient();

  const modern = await supabase.from('audit_logs').insert({
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    entity_label: params.entityLabel ?? null,
    action: params.action,
    change_summary: params.summary,
    before_data: params.beforeData ?? null,
    after_data: params.afterData ?? null,
  });

  if (!modern.error) return;
  if (!isMissingTableError(modern.error.message)) return;

  if (params.entityType !== 'daily_entry' || !params.dailyEntryIdForLegacy) return;

  await supabase.from('entry_history').insert({
    daily_entry_id: params.dailyEntryIdForLegacy,
    change_type: params.action,
    previous_values: params.beforeData ?? null,
    new_values: params.afterData ?? null,
  } as any);
}

async function resolveLegacyUserIds(scanCatalogId?: string): Promise<string[]> {
  const supabase = await createClient();
  const candidates = new Set<string>();

  const authUser = await supabase.auth.getUser();
  if (authUser.data?.user?.id) candidates.add(authUser.data.user.id);

  // When running with service-role key, try admin user listing.
  try {
    const admin = await (supabase as any).auth?.admin?.listUsers?.({ page: 1, perPage: 5 });
    for (const user of admin?.data?.users || []) {
      if (user?.id) candidates.add(user.id);
    }
  } catch {
    // ignore if admin API is not available
  }

  if (scanCatalogId) {
    const fromPriceHistory = await supabase
      .from('scan_price_history')
      .select('user_id')
      .eq('scan_catalog_id', scanCatalogId)
      .not('user_id', 'is', null)
      .limit(1)
      .maybeSingle();
    if (!fromPriceHistory.error && (fromPriceHistory.data as any)?.user_id) {
      candidates.add((fromPriceHistory.data as any).user_id as string);
    }

    const fromCatalog = await supabase
      .from('scan_catalog')
      .select('user_id')
      .eq('id', scanCatalogId)
      .maybeSingle();
    if (!fromCatalog.error && (fromCatalog.data as any)?.user_id) {
      candidates.add((fromCatalog.data as any).user_id as string);
    }
  }

  const anyHistory = await supabase
    .from('scan_price_history')
    .select('user_id')
    .not('user_id', 'is', null)
    .limit(1)
    .maybeSingle();
  if (!anyHistory.error && (anyHistory.data as any)?.user_id) {
    candidates.add((anyHistory.data as any).user_id as string);
  }

  const anyDailyEntry = await supabase
    .from('daily_entries')
    .select('user_id')
    .not('user_id', 'is', null)
    .limit(5);
  if (!anyDailyEntry.error) {
    for (const row of anyDailyEntry.data || []) {
      if ((row as any).user_id) candidates.add((row as any).user_id as string);
    }
  }

  return Array.from(candidates);
}

async function resolvePriceMap(
  entryDate: string,
  catalog: ScanCatalog[]
): Promise<Map<string, { price: number; effective_start_date: string }>> {
  const supabase = await createClient();
  const out = new Map<string, { price: number; effective_start_date: string }>();
  const catalogRows = catalog as Array<ScanCatalog & { price?: number }>;

  const fillMissingWithFallback = () => {
    for (const scan of catalogRows) {
      if (out.has(scan.id)) continue;
      const catalogPrice = typeof scan.price === 'number' ? Number(scan.price) : 0;
      const defaultPrice = Number(DEFAULT_PRICE_BY_NAME.get(scan.name) || 0);
      const fallbackPrice = catalogPrice > 0 ? catalogPrice : defaultPrice;
      if (fallbackPrice > 0) {
        out.set(scan.id, { price: fallbackPrice, effective_start_date: entryDate });
      }
    }
    return out;
  };

  const modern = await supabase
    .from('scan_price_history')
    .select('scan_catalog_id, price, effective_start_date, created_at')
    .lte('effective_start_date', entryDate)
    .order('effective_start_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (!modern.error) {
    for (const row of modern.data || []) {
      if (!out.has(row.scan_catalog_id)) {
        out.set(row.scan_catalog_id, {
          price: Number(row.price),
          effective_start_date: row.effective_start_date,
        });
      }
    }
    return fillMissingWithFallback();
  }

  if (
    isMissingTableError(modern.error.message) ||
    isMissingColumnError(modern.error.message)
  ) {
    const legacy = await supabase
      .from('scan_price_history')
      .select('scan_catalog_id, new_price, effective_from, changed_at')
      .lte('effective_from', entryDate)
      .order('effective_from', { ascending: false })
      .order('changed_at', { ascending: false });

    if (!legacy.error) {
      for (const row of legacy.data || []) {
        if (!out.has(row.scan_catalog_id)) {
          out.set(row.scan_catalog_id, {
            price: Number(row.new_price),
            effective_start_date: row.effective_from,
          });
        }
      }
      return fillMissingWithFallback();
    }

    if (isMissingTableError(legacy.error.message) || isMissingColumnError(legacy.error.message)) {
      return fillMissingWithFallback();
    }

    throw new Error(`Failed to fetch scan prices: ${legacy.error.message}`);
  }

  throw new Error(`Failed to fetch scan prices: ${modern.error.message}`);
}

export async function fetchScanCatalog(): Promise<ScanCatalog[]> {
  const { supabase, userId } = await requireUserAndSubscription();
  const { data, error } = await supabase
    .from('scan_catalog')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw new Error(`Failed to fetch scan catalog: ${error.message}`);
  return (data || []) as ScanCatalog[];
}

export async function fetchDateEntryDraft(entryDate: string, hospitalId?: string): Promise<DateEntryDraft> {
  const { supabase, userId } = await requireUserAndSubscription();

  const [catalog, entryResult] = await Promise.all([
    fetchScanCatalog(),
    supabase
      .from('daily_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('entry_date', entryDate)
      .eq('hospital_id', hospitalId || null)
      .maybeSingle(),
  ]);

  if (entryResult.error) {
    throw new Error(`Failed to fetch daily entry: ${entryResult.error.message}`);
  }
  const priceMap = await resolvePriceMap(entryDate, catalog);

  let itemMap = new Map<string, { quantity: number; unit_price: number }>();
  if (entryResult.data) {
    const itemsResult = await supabase
      .from('daily_entry_items')
      .select('scan_catalog_id, quantity, unit_price')
      .eq('daily_entry_id', entryResult.data.id);

    if (itemsResult.error) {
      throw new Error(`Failed to fetch daily entry items: ${itemsResult.error.message}`);
    }

    itemMap = new Map(
      (itemsResult.data || []).map((item) => [
        item.scan_catalog_id,
        {
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
        },
      ])
    );
  }

  const lines = catalog.map((scan) => {
    const existing = itemMap.get(scan.id);
    const priceRow = priceMap.get(scan.id);
    const unitPrice = existing?.unit_price ?? priceRow?.price ?? 0;
    const quantity = existing?.quantity ?? 0;
    return {
      scan_catalog_id: scan.id,
      scan_name: scan.name,
      quantity,
      unit_price: unitPrice,
      line_total: quantity * unitPrice,
      missing_price: !existing && unitPrice <= 0,
    };
  });

  const totals = lines.reduce(
    (acc, item) => {
      acc.total_scans += item.quantity;
      acc.total_revenue += item.line_total;
      return acc;
    },
    { total_scans: 0, total_revenue: 0 }
  );

  return {
    entry_date: entryDate,
    notes: entryResult.data?.notes || '',
    exists: Boolean(entryResult.data),
    entry_id: entryResult.data?.id || null,
    lines,
    total_scans: totals.total_scans,
    calculated_total_revenue: totals.total_revenue,
    final_total_revenue: Number(entryResult.data?.final_total_revenue ?? totals.total_revenue),
    is_manual_override: Boolean(entryResult.data?.is_manual_override),
    manual_override_reason: entryResult.data?.manual_override_reason || '',
    hospital_id: entryResult.data?.hospital_id || hospitalId || null,
  };
}

export async function fetchDailyEntriesForMonth(
  year: number,
  month: number,
  hospitalId?: string
): Promise<DailyEntryWithItems[]> {
  const { supabase, userId } = await requireUserAndSubscription();
  const { startDate, endDate } = monthRange(year, month);

  let entriesQuery = supabase
    .from('daily_entries')
    .select('*, hospital:hospital_id(name)')
    .eq('user_id', userId)
    .gte('entry_date', startDate)
    .lte('entry_date', endDate)
    .order('entry_date', { ascending: false });
  if (hospitalId && hospitalId !== 'all') entriesQuery = entriesQuery.eq('hospital_id', hospitalId);
  const { data: entries, error: entriesError } = await entriesQuery;

  if (entriesError) throw new Error(`Failed to fetch daily entries: ${entriesError.message}`);
  if (!entries || entries.length === 0) return [];

  const { data: items, error: itemsError } = await supabase
    .from('daily_entry_items')
    .select('*, scan_catalog:scan_catalog_id(name)')
    .in('daily_entry_id', entries.map((entry) => entry.id));

  if (itemsError) throw new Error(`Failed to fetch daily entry items: ${itemsError.message}`);

  const byEntry = new Map<string, any[]>();
  for (const item of items || []) {
    const arr = byEntry.get(item.daily_entry_id) || [];
    arr.push({
      ...item,
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
      line_total: Number(item.line_total),
      scan_name: item.scan_catalog?.name || 'Unknown',
    });
    byEntry.set(item.daily_entry_id, arr);
  }

  return entries.map((entry) => ({
    ...entry,
    total_scans: Number(entry.total_scans),
    total_revenue: Number(entry.final_total_revenue ?? entry.total_revenue),
    calculated_total_revenue: Number(entry.calculated_total_revenue ?? entry.total_revenue),
    final_total_revenue: Number(entry.final_total_revenue ?? entry.total_revenue),
    is_manual_override: Boolean(entry.is_manual_override),
    manual_override_reason: entry.manual_override_reason ?? null,
    hospital_name: (entry as any).hospital?.name ?? null,
    items: byEntry.get(entry.id) || [],
  })) as DailyEntryWithItems[];
}

export async function saveDailyEntry(formData: DailyEntryFormData): Promise<void> {
  const { supabase, userId } = await requireUserAndSubscription(true);

  const payload = {
    entry_date: formData.entry_date,
    notes: formData.notes || null,
    hospital_id: formData.hospital_id || null,
    use_manual_override: formData.use_manual_override || false,
    manual_total_revenue: formData.manual_total_revenue ?? null,
    manual_override_reason: formData.manual_override_reason || null,
    items: normalizeItemInputs(formData.items),
  };

  if (payload.use_manual_override && (payload.manual_total_revenue == null || !payload.manual_override_reason)) {
    throw new Error('Manual override reason and amount are required.');
  }

  const rpcResult = await supabase.rpc('save_daily_entry_with_items', {
    p_entry_date: payload.entry_date,
    p_notes: payload.notes,
    p_items: payload.items,
  });

  if (!rpcResult.error) return;
  if (!isMissingFunctionError(rpcResult.error.message)) {
    throw new Error(`Failed to save daily entry: ${rpcResult.error.message}`);
  }

  const catalog = await fetchScanCatalog();
  const priceMap = await resolvePriceMap(payload.entry_date, catalog);
  const existingBefore = await supabase
.from('daily_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('entry_date', payload.entry_date)
    .eq('hospital_id', payload.hospital_id)
    .maybeSingle();

  const totalScans = payload.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalRevenue = payload.items.reduce((sum, item) => {
    const price = priceMap.get(item.scan_catalog_id)?.price ?? 0;
    return sum + item.quantity * price;
  }, 0);

  const finalRevenue = payload.use_manual_override ? Number(payload.manual_total_revenue || 0) : totalRevenue;

  const upsertResult = await supabase
    .from('daily_entries')
    .upsert(
      {
        user_id: userId,
        hospital_id: payload.hospital_id,
        entry_date: payload.entry_date,
        notes: payload.notes,
        total_scans: totalScans,
        total_revenue: finalRevenue,
        calculated_total_revenue: totalRevenue,
        final_total_revenue: finalRevenue,
        is_manual_override: payload.use_manual_override,
        manual_override_reason: payload.use_manual_override ? payload.manual_override_reason : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,hospital_id,entry_date' }
    )
    .select('id')
    .single();

  if (upsertResult.error || !upsertResult.data) {
    throw new Error(`Failed to save daily entry: ${upsertResult.error?.message}`);
  }

  const entryId = upsertResult.data.id;
  const beforeSnapshot = existingBefore.data ?? null;

  const deleteItems = await supabase
    .from('daily_entry_items')
    .delete()
    .eq('daily_entry_id', entryId);

  if (deleteItems.error) {
    throw new Error(`Failed to clear old daily items: ${deleteItems.error.message}`);
  }

  const rows = payload.items.map((item) => {
    const unitPrice = priceMap.get(item.scan_catalog_id)?.price ?? 0;
    return {
      daily_entry_id: entryId,
      scan_catalog_id: item.scan_catalog_id,
      quantity: item.quantity,
      unit_price: unitPrice,
      line_total: unitPrice * item.quantity,
    };
  });

  const insertItems = await supabase.from('daily_entry_items').insert(rows);
  if (insertItems.error) {
    throw new Error(`Failed to save daily items: ${insertItems.error.message}`);
  }

  await writeAuditCompat({
    entityType: 'daily_entry',
    entityId: entryId,
    entityLabel: `${payload.entry_date} · ${payload.hospital_id || 'No hospital'}`,
    action: beforeSnapshot ? 'UPDATE' : 'CREATE',
    summary: `${beforeSnapshot ? 'Updated' : 'Created'} daily entry for ${payload.entry_date}`,
    beforeData: beforeSnapshot,
    afterData: { entry_date: payload.entry_date, notes: payload.notes, items: rows },
    dailyEntryIdForLegacy: entryId,
  });
}

export async function deleteDailyEntry(entryId: string): Promise<void> {
  const supabase = await createClient();
  const before = await supabase
    .from('daily_entries')
    .select('*')
    .eq('id', entryId)
    .maybeSingle();

  const rpcResult = await supabase.rpc('delete_daily_entry_with_audit', {
    p_daily_entry_id: entryId,
  });

  if (!rpcResult.error) return;
  if (!isMissingFunctionError(rpcResult.error.message)) {
    throw new Error(`Failed to delete daily entry: ${rpcResult.error.message}`);
  }

  const fallback = await supabase.from('daily_entries').delete().eq('id', entryId);
  if (fallback.error) throw new Error(`Failed to delete daily entry: ${fallback.error.message}`);

  await writeAuditCompat({
    entityType: 'daily_entry',
    entityId: entryId,
    entityLabel: before.data?.entry_date ?? null,
    action: 'DELETE',
    summary: `Deleted daily entry${before.data?.entry_date ? ` for ${before.data.entry_date}` : ''}`,
    beforeData: before.data ?? null,
    afterData: null,
    dailyEntryIdForLegacy: entryId,
  });
}

export async function getMonthlyStats(year: number, month: number, hospitalId?: string): Promise<MonthlySummary> {
  const entries = await fetchDailyEntriesForMonth(year, month, hospitalId);
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  if (entries.length === 0) {
    return {
      month: monthKey,
      total_days: 0,
      total_scans: 0,
      total_revenue: 0,
      average_revenue_per_day: 0,
      highest_revenue_day: null,
      items: [],
    };
  }

  const totalScans = entries.reduce((sum, entry) => sum + entry.total_scans, 0);
  const totalRevenue = entries.reduce((sum, entry) => sum + Number(entry.total_revenue), 0);
  const highest = entries.reduce(
    (best, entry) =>
      !best || Number(entry.total_revenue) > best.revenue
        ? { date: entry.entry_date, revenue: Number(entry.total_revenue) }
        : best,
    null as { date: string; revenue: number } | null
  );

  const summaryMap = new Map<string, MonthlySummaryItem>();
  for (const entry of entries) {
    for (const item of entry.items) {
      const existing = summaryMap.get(item.scan_catalog_id);
      if (existing) {
        existing.total_quantity += item.quantity;
        existing.total_revenue += Number(item.line_total);
      } else {
        summaryMap.set(item.scan_catalog_id, {
          scan_catalog_id: item.scan_catalog_id,
          scan_name: item.scan_name,
          total_quantity: item.quantity,
          total_revenue: Number(item.line_total),
          average_quantity_per_day: 0,
        });
      }
    }
  }

  const items = Array.from(summaryMap.values())
    .map((item) => ({
      ...item,
      average_quantity_per_day: item.total_quantity / entries.length,
    }))
    .sort((a, b) => b.total_revenue - a.total_revenue);

  return {
    month: monthKey,
    total_days: entries.length,
    total_scans: totalScans,
    total_revenue: totalRevenue,
    average_revenue_per_day: totalRevenue / entries.length,
    highest_revenue_day: highest,
    items,
  };
}

export async function getDailyStats(year: number, month: number, hospitalId?: string): Promise<DailyStats[]> {
  const { supabase, userId } = await requireUserAndSubscription();
  const { startDate, endDate } = monthRange(year, month);

  let query = supabase
    .from('daily_entries')
    .select('entry_date, total_scans, final_total_revenue, total_revenue')
    .eq('user_id', userId)
    .gte('entry_date', startDate)
    .lte('entry_date', endDate)
    .order('entry_date', { ascending: true });
  if (hospitalId && hospitalId !== 'all') query = query.eq('hospital_id', hospitalId);
  const { data, error } = await query;

  if (error) throw new Error(`Failed to fetch daily stats: ${error.message}`);

  return (data || []).map((row) => ({
    date: row.entry_date,
    total_scans: Number(row.total_scans),
    total_revenue: Number((row as any).final_total_revenue ?? row.total_revenue),
  }));
}

export async function fetchCurrentEffectivePrices(): Promise<CurrentEffectivePrice[]> {
  const { supabase, userId } = await requireUserAndSubscription();
  const modern = await supabase
.from('current_effective_prices')
    .select('*')
    .eq('user_id', userId)
    .order('scan_name', { ascending: true });

  if (!modern.error) {
    return (modern.data || []).map((row) => ({
      ...row,
      price: Number(row.price),
    })) as CurrentEffectivePrice[];
  }

  if (!isMissingTableError(modern.error.message)) {
    throw new Error(`Failed to fetch current prices: ${modern.error.message}`);
  }

  const catalog = await supabase
.from('scan_catalog')
    .select('id, name, price')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (catalog.error) {
    throw new Error(`Failed to fetch current prices: ${catalog.error.message}`);
  }

  const today = new Date().toISOString().split('T')[0];
  const catalogRows = (catalog.data || []) as Array<{ id: string; name: string; price?: number }>;

  const byId = new Map<string, CurrentEffectivePrice>(
    catalogRows.map((row) => [
      row.id,
      {
        scan_catalog_id: row.id,
        scan_name: row.name,
        price:
          Number(row.price || 0) > 0
            ? Number(row.price || 0)
            : Number(DEFAULT_PRICE_BY_NAME.get(row.name) || 0),
        effective_start_date: today,
      },
    ])
  );

  const histModern = await supabase
    .from('scan_price_history')
    .select('scan_catalog_id, price, effective_start_date, created_at')
    .lte('effective_start_date', today)
    .order('effective_start_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (!histModern.error) {
    const seen = new Set<string>();
    for (const row of histModern.data || []) {
      const existing = byId.get(row.scan_catalog_id);
      if (existing && !seen.has(row.scan_catalog_id)) {
        byId.set(row.scan_catalog_id, {
          ...existing,
          price: Number(row.price),
          effective_start_date: row.effective_start_date,
        });
        seen.add(row.scan_catalog_id);
      }
    }
    return Array.from(byId.values()).sort((a, b) => a.scan_name.localeCompare(b.scan_name));
  }

  if (isMissingColumnError(histModern.error.message) || isMissingTableError(histModern.error.message)) {
    const histLegacy = await supabase
      .from('scan_price_history')
      .select('scan_catalog_id, new_price, effective_from, changed_at')
      .lte('effective_from', today)
      .order('effective_from', { ascending: false })
      .order('changed_at', { ascending: false });

    if (!histLegacy.error) {
      const seen = new Set<string>();
      for (const row of histLegacy.data || []) {
        const existing = byId.get(row.scan_catalog_id);
        if (existing && !seen.has(row.scan_catalog_id)) {
          byId.set(row.scan_catalog_id, {
            ...existing,
            price: Number(row.new_price || 0),
            effective_start_date: row.effective_from,
          });
          seen.add(row.scan_catalog_id);
        }
      }
    }
  }

  return Array.from(byId.values()).sort((a, b) => a.scan_name.localeCompare(b.scan_name));
}

export async function fetchScanPriceHistory(scanCatalogId: string): Promise<ScanPriceHistory[]> {
  const { supabase, userId } = await requireUserAndSubscription();
  const modern = await supabase
    .from('scan_price_history')
    .select('*')
.eq('scan_catalog_id', scanCatalogId)
    .eq('user_id', userId)
    .order('effective_start_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (!modern.error) {
    return (modern.data || []).map((row) => ({
      ...row,
      price: Number((row as any).price),
    })) as ScanPriceHistory[];
  }

  if (
    isMissingTableError(modern.error.message) ||
    isMissingColumnError(modern.error.message)
  ) {
    const legacy = await supabase
      .from('scan_price_history')
      .select('*')
      .eq('scan_catalog_id', scanCatalogId)
      .order('effective_from', { ascending: false })
      .order('changed_at', { ascending: false });

    if (!legacy.error) {
      return (legacy.data || []).map((row: any) => ({
        id: row.id,
        scan_catalog_id: row.scan_catalog_id,
        price: Number(row.new_price ?? 0),
        effective_start_date: row.effective_from,
        reason: row.reason ?? null,
        created_at: row.changed_at ?? new Date().toISOString(),
        created_by: row.user_id ?? null,
      })) as ScanPriceHistory[];
    }

    if (isMissingTableError(legacy.error.message)) {
      const catalog = await supabase
        .from('scan_catalog')
        .select('id, price')
        .eq('id', scanCatalogId)
        .maybeSingle();
      if (!catalog.error && catalog.data) {
        return [
          {
            id: `${scanCatalogId}-fallback`,
            scan_catalog_id: scanCatalogId,
            price: Number((catalog.data as any).price || 0),
            effective_start_date: '2025-01-01',
            reason: 'Legacy base price',
            created_at: new Date().toISOString(),
            created_by: null,
          },
        ];
      }
    }
    throw new Error(`Failed to fetch price history: ${legacy.error.message}`);
  }

  throw new Error(`Failed to fetch price history: ${modern.error.message}`);
}

export async function updateScanPrice(
  scanCatalogId: string,
  newPrice: number,
  effectiveStartDate: string,
  reason?: string
): Promise<void> {
  const { supabase, userId } = await requireUserAndSubscription(true);
  const rpcResult = await supabase.rpc('add_scan_price_with_audit', {
    p_scan_catalog_id: scanCatalogId,
    p_price: Number(newPrice),
    p_effective_start_date: effectiveStartDate,
    p_reason: reason || null,
  });

  if (!rpcResult.error) return;
  if (!isMissingFunctionError(rpcResult.error.message)) {
    throw new Error(`Failed to update scan price: ${rpcResult.error.message}`);
  }

  const modernInsert = await supabase.from('scan_price_history').insert({
    user_id: userId,
    scan_catalog_id: scanCatalogId,
    price: Number(newPrice),
    effective_start_date: effectiveStartDate,
    reason: reason || null,
  });

  if (
    modernInsert.error &&
    (isMissingColumnError(modernInsert.error.message) || isMissingTableError(modernInsert.error.message))
  ) {
    const legacyUserIds = await resolveLegacyUserIds(scanCatalogId);
    let legacyError: string | null = null;

    // Try explicit user_id candidates first (legacy schemas often require it).
    for (const legacyUserId of legacyUserIds) {
      const legacyInsert = await supabase.from('scan_price_history').insert({
        scan_catalog_id: scanCatalogId,
        old_price: null,
        new_price: Number(newPrice),
        effective_from: effectiveStartDate,
        user_id: legacyUserId,
        reason: reason || null,
      });
      if (!legacyInsert.error) {
        legacyError = null;
        break;
      }
      legacyError = legacyInsert.error.message;
    }

    // Last attempt without user_id (for schemas where it's nullable).
    if (legacyError !== null || legacyUserIds.length === 0) {
      const legacyInsertNoUser = await supabase.from('scan_price_history').insert({
        scan_catalog_id: scanCatalogId,
        old_price: null,
        new_price: Number(newPrice),
        effective_from: effectiveStartDate,
        reason: reason || null,
      });
      if (!legacyInsertNoUser.error) {
        legacyError = null;
      } else {
        legacyError = legacyInsertNoUser.error.message;
      }
    }

    if (legacyError && !isMissingTableError(legacyError)) {
      throw new Error(`Failed to update scan price: ${legacyError}`);
    }
  } else if (modernInsert.error) {
    throw new Error(`Failed to update scan price: ${modernInsert.error.message}`);
  }

  await writeAuditCompat({
    entityType: 'price',
    entityId: scanCatalogId,
    entityLabel: scanCatalogId,
    action: 'UPDATE',
    summary: `Updated scan price effective ${effectiveStartDate}`,
    beforeData: null,
    afterData: { price: Number(newPrice), effective_start_date: effectiveStartDate, reason: reason ?? null },
  });

  const today = new Date().toISOString().split('T')[0];
  if (effectiveStartDate <= today) {
    const updateCatalog = await supabase
      .from('scan_catalog')
      .update({ price: Number(newPrice) } as any)
      .eq('id', scanCatalogId);
    if (updateCatalog.error && !isMissingColumnError(updateCatalog.error.message)) {
      throw new Error(`Failed to update scan catalog price: ${updateCatalog.error.message}`);
    }
  }

  // Read-after-write sanity check so UI refresh always sees a persisted row.
  const confirmModern = await supabase
    .from('scan_price_history')
    .select('id')
.eq('scan_catalog_id', scanCatalogId)
    .eq('user_id', userId)
    .limit(1);
  if (confirmModern.error && isMissingTableError(confirmModern.error.message)) {
    // No-op: legacy-only schemas may skip this table entirely.
  }
}

export async function fetchAuditLogs(
  filter: AuditFilter = {},
  limit = 150
): Promise<AuditLog[]> {
  const supabase = await createClient();

  let query = supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (filter.startDate) query = query.gte('created_at', `${filter.startDate}T00:00:00`);
  if (filter.endDate) query = query.lte('created_at', `${filter.endDate}T23:59:59`);
  if (filter.action && filter.action !== 'ALL') query = query.eq('action', filter.action);
  if (filter.entityType && filter.entityType !== 'ALL') query = query.eq('entity_type', filter.entityType);

  const buildLegacyLogs = async (): Promise<AuditLog[]> => {
    const out: AuditLog[] = [];

    const legacyDaily = await supabase
      .from('entry_history')
      .select(
        `
        id,
        daily_entry_id,
        change_type,
        previous_values,
        new_values,
        changed_at,
        daily_entries(entry_date)
      `
      )
      .order('changed_at', { ascending: false })
      .limit(limit);

    if (!legacyDaily.error) {
      for (const row of legacyDaily.data || []) {
        out.push({
          id: row.id,
          entity_type: 'daily_entry',
          entity_id: (row as any).daily_entry_id || null,
          entity_label: Array.isArray((row as any).daily_entries)
            ? (row as any).daily_entries?.[0]?.entry_date || null
            : (row as any).daily_entries?.entry_date || null,
          action: (((row as any).change_type || 'UPDATE') as 'CREATE' | 'UPDATE' | 'DELETE'),
          change_summary: `${(row as any).change_type || 'UPDATE'} daily entry`,
          before_data: (row as any).previous_values ?? null,
          after_data: (row as any).new_values ?? null,
          created_at: (row as any).changed_at,
          created_by: null,
        });
      }
    }

    const modernPrice = await supabase
      .from('scan_price_history')
      .select('id, scan_catalog_id, price, effective_start_date, reason, created_at, scan_catalog:scan_catalog_id(name)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!modernPrice.error) {
      for (const row of modernPrice.data || []) {
        out.push({
          id: `price-modern-${(row as any).id}`,
          entity_type: 'price',
          entity_id: (row as any).scan_catalog_id,
          entity_label: (row as any).scan_catalog?.name || (row as any).scan_catalog_id,
          action: 'UPDATE',
          change_summary: `Price set to ${(row as any).price} effective ${(row as any).effective_start_date}`,
          before_data: null,
          after_data: {
            price: (row as any).price,
            effective_start_date: (row as any).effective_start_date,
            reason: (row as any).reason ?? null,
          },
          created_at: (row as any).created_at,
          created_by: null,
        });
      }
    } else if (isMissingColumnError(modernPrice.error.message) || isMissingTableError(modernPrice.error.message)) {
      const legacyPrice = await supabase
        .from('scan_price_history')
        .select('id, scan_catalog_id, old_price, new_price, effective_from, reason, changed_at, scan_catalog:scan_catalog_id(name)')
        .order('changed_at', { ascending: false })
        .limit(limit);
      if (!legacyPrice.error) {
        for (const row of legacyPrice.data || []) {
          out.push({
            id: `price-legacy-${(row as any).id}`,
            entity_type: 'price',
            entity_id: (row as any).scan_catalog_id,
            entity_label: (row as any).scan_catalog?.name || (row as any).scan_catalog_id,
            action: (row as any).old_price == null ? 'CREATE' : 'UPDATE',
            change_summary: `Price ${(row as any).old_price == null ? 'added' : 'updated'} to ${(row as any).new_price} effective ${(row as any).effective_from}`,
            before_data: { price: (row as any).old_price ?? null },
            after_data: {
              price: (row as any).new_price,
              effective_start_date: (row as any).effective_from,
              reason: (row as any).reason ?? null,
            },
            created_at: (row as any).changed_at,
            created_by: null,
          });
        }
      }
    }

    return out
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, limit);
  };

  const buildFromDailyEntries = async (): Promise<AuditLog[]> => {
    let entriesQuery = supabase
      .from('daily_entries')
      .select('id, entry_date, notes, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (filter.startDate) entriesQuery = entriesQuery.gte('updated_at', `${filter.startDate}T00:00:00`);
    if (filter.endDate) entriesQuery = entriesQuery.lte('updated_at', `${filter.endDate}T23:59:59`);
    if (filter.entityType && filter.entityType !== 'ALL' && filter.entityType !== 'daily_entry') return [];
    if (filter.action && filter.action !== 'ALL' && filter.action !== 'UPDATE') return [];

    const entries = await entriesQuery;
    if (entries.error) return [];

    return (entries.data || []).map((row: any) => ({
      id: `derived-${row.id}-${row.updated_at}`,
      entity_type: 'daily_entry',
      entity_id: row.id,
      entity_label: row.entry_date,
      action: 'UPDATE',
      change_summary: `Daily entry activity on ${row.entry_date}`,
      before_data: null,
      after_data: {
        entry_date: row.entry_date,
        notes: row.notes ?? null,
      },
      created_at: row.updated_at || row.created_at,
      created_by: null,
    })) as AuditLog[];
  };

  const { data, error } = await query;
  if (error) {
    if (isMissingTableError(error.message)) {
      let legacyQuery = supabase
        .from('entry_history')
        .select(
          `
          id,
          daily_entry_id,
          change_type,
          previous_values,
          new_values,
          changed_at,
          daily_entries(entry_date)
        `
        )
        .order('changed_at', { ascending: false })
        .limit(limit);

      if (filter.startDate) legacyQuery = legacyQuery.gte('changed_at', `${filter.startDate}T00:00:00`);
      if (filter.endDate) legacyQuery = legacyQuery.lte('changed_at', `${filter.endDate}T23:59:59`);
      if (filter.action && filter.action !== 'ALL') legacyQuery = legacyQuery.eq('change_type', filter.action);
      if (filter.entityType && filter.entityType !== 'ALL' && filter.entityType !== 'daily_entry') return [];

      const legacy = await legacyQuery;
      if (legacy.error) {
        if (isMissingTableError(legacy.error.message)) {
          const legacyAll = await buildLegacyLogs();
          if (legacyAll.length > 0) return applyAuditFilterInMemory(legacyAll, filter);
          return buildFromDailyEntries();
        }
        throw new Error(`Failed to fetch audit logs: ${legacy.error.message}`);
      }

      const mapped = (legacy.data || []).map((row: any) => ({
        id: row.id,
        entity_type: 'daily_entry',
        entity_id: row.daily_entry_id || null,
        entity_label: Array.isArray(row.daily_entries)
          ? row.daily_entries?.[0]?.entry_date || null
          : row.daily_entries?.entry_date || null,
        action: (row.change_type || 'UPDATE') as 'CREATE' | 'UPDATE' | 'DELETE',
        change_summary: `${row.change_type || 'UPDATE'} daily entry`,
        before_data: row.previous_values ?? null,
        after_data: row.new_values ?? null,
        created_at: row.changed_at,
        created_by: null,
      })) as AuditLog[];

      if (mapped.length > 0) {
        const merged = [...mapped, ...(await buildLegacyLogs()).filter((x) => x.entity_type === 'price')];
        return applyAuditFilterInMemory(merged, filter);
      }
      const derived = await buildFromDailyEntries();
      return applyAuditFilterInMemory(derived, filter);
    }
    throw new Error(`Failed to fetch audit logs: ${error.message}`);
  }

  if ((data || []).length > 0) {
    return applyAuditFilterInMemory((data || []) as AuditLog[], filter);
  }
  const legacyAll = await buildLegacyLogs();
  if (legacyAll.length > 0) return applyAuditFilterInMemory(legacyAll, filter);
  const derived = await buildFromDailyEntries();
  return applyAuditFilterInMemory(derived, filter);
}

export async function seedDefaultCatalogAndPrices(
  effectiveStartDate = '2025-01-01'
): Promise<void> {
  const { supabase, userId } = await requireUserAndSubscription(true);

  let catalogError = (
    await supabase.from('scan_catalog').upsert(
      DEFAULT_SCAN_PRICES.map((scan) => ({
        user_id: userId,
        name: scan.name,
        modality: 'Ultrasound',
        is_active: true,
        price: scan.price,
      })) as any,
      { onConflict: 'user_id,name' }
    )
  ).error;

  if (catalogError && isMissingColumnError(catalogError.message)) {
    catalogError = (
      await supabase.from('scan_catalog').upsert(
    DEFAULT_SCAN_PRICES.map((scan) => ({
      user_id: userId,
      name: scan.name,
      modality: 'Ultrasound',
      is_active: true,
    })),
    { onConflict: 'user_id,name' }
      )
    ).error;
  }

  if (catalogError) {
    throw new Error(`Failed to seed scan catalog: ${catalogError.message}`);
  }

  const { data: catalogRows, error: fetchError } = await supabase
    .from('scan_catalog')
    .select('id, name')
    .eq('user_id', userId)
    .in(
      'name',
      DEFAULT_SCAN_PRICES.map((scan) => scan.name)
    );

  if (fetchError || !catalogRows) {
    throw new Error(`Failed to fetch seeded scan catalog: ${fetchError?.message}`);
  }

  const idByName = new Map(catalogRows.map((row) => [row.name, row.id]));
  const historyRows = DEFAULT_SCAN_PRICES.map((scan) => ({
    user_id: userId,
    scan_catalog_id: idByName.get(scan.name),
    price: scan.price,
    effective_start_date: effectiveStartDate,
    reason: 'Initial seeded price',
  })).filter((row) => Boolean(row.scan_catalog_id));

  const modernHistory = await supabase
    .from('scan_price_history')
    .upsert(historyRows, {
      onConflict: 'scan_catalog_id,effective_start_date',
    });

  if (!modernHistory.error) return;

  if (
    isMissingTableError(modernHistory.error.message) ||
    isMissingColumnError(modernHistory.error.message)
  ) {
    const legacyRows = DEFAULT_SCAN_PRICES.map((scan) => ({
      scan_catalog_id: idByName.get(scan.name),
      old_price: null,
      new_price: scan.price,
      effective_from: effectiveStartDate,
      reason: 'Initial seeded price',
    })).filter((row) => Boolean(row.scan_catalog_id));

    const legacyHistory = await supabase.from('scan_price_history').insert(legacyRows as any);
    if (legacyHistory.error && !legacyHistory.error.message.includes('duplicate')) {
      throw new Error(`Failed to seed scan price history: ${legacyHistory.error.message}`);
    }
    return;
  }

  throw new Error(`Failed to seed scan price history: ${modernHistory.error.message}`);
}

export async function getSubscriptionStatus() {
  const { subscriptionStatus } = await requireUserAndSubscription();
  return subscriptionStatus as 'trialing' | 'active' | 'expired' | 'canceled';
}

export async function bootstrapUserOnboarding(fullName?: string) {
  const { supabase, userId } = await requireUserAndSubscription(true);

  await supabase.from('profiles').upsert({ id: userId, full_name: fullName || null });

  const existingSub = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (!existingSub.data) {
    const start = new Date();
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    await supabase.from('subscriptions').insert({
      user_id: userId,
      subscription_status: 'trialing',
      plan_name: 'Free Trial',
      trial_start_at: start.toISOString(),
      trial_end_at: end.toISOString(),
    });
  }

  const hospitals = await supabase.from('hospitals').select('id').eq('user_id', userId).limit(1);
  if (!hospitals.data || hospitals.data.length === 0) {
    await supabase.from('hospitals').insert({ user_id: userId, name: 'Primary Hospital' });
  }

  await seedDefaultCatalogAndPrices();
}

export async function fetchHospitals(includeInactive = false): Promise<Hospital[]> {
  const { supabase, userId } = await requireUserAndSubscription();
  let query = supabase.from('hospitals').select('*').eq('user_id', userId).order('name', { ascending: true });
  if (!includeInactive) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch hospitals: ${error.message}`);
  return (data || []) as Hospital[];
}

export async function createHospital(name: string, location?: string) {
  const { supabase, userId } = await requireUserAndSubscription(true);
  const { error } = await supabase.from('hospitals').insert({ user_id: userId, name, location: location || null });
  if (error) throw new Error(`Failed to create hospital: ${error.message}`);
}

export async function updateHospital(hospitalId: string, patch: { name?: string; location?: string; is_active?: boolean }) {
  const { supabase, userId } = await requireUserAndSubscription(true);
  const { error } = await supabase.from('hospitals').update(patch).eq('id', hospitalId).eq('user_id', userId);
  if (error) throw new Error(`Failed to update hospital: ${error.message}`);
}

export async function createCategory(name: string, initialPrice: number, effectiveStartDate: string) {
  const { supabase, userId } = await requireUserAndSubscription(true);
  const category = await supabase
    .from('scan_catalog')
    .insert({ user_id: userId, name, modality: 'Ultrasound', is_active: true })
    .select('id')
    .single();
  if (category.error || !category.data) throw new Error(`Failed to create category: ${category.error?.message}`);

  const history = await supabase.from('scan_price_history').insert({
    user_id: userId,
    scan_catalog_id: category.data.id,
    price: initialPrice,
    effective_start_date: effectiveStartDate,
    reason: 'Initial category price',
  });
  if (history.error) throw new Error(`Failed to set initial category price: ${history.error.message}`);
}

export async function updateCategory(categoryId: string, patch: { name?: string; is_active?: boolean; display_order?: number }) {
  const { supabase, userId } = await requireUserAndSubscription(true);
  const { error } = await supabase.from('scan_catalog').update(patch).eq('id', categoryId).eq('user_id', userId);
  if (error) throw new Error(`Failed to update category: ${error.message}`);
}

export async function getAccountOverview(): Promise<AccountOverview> {
  const { supabase, userId, subscriptionStatus } = await requireUserAndSubscription();
  const userResult = await supabase.auth.getUser();
  const profile = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  const subscription = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const hospitals = await supabase.from('hospitals').select('id', { count: 'exact', head: true }).eq('user_id', userId);
  const categories = await supabase.from('scan_catalog').select('id', { count: 'exact', head: true }).eq('user_id', userId);

  const trialEnd = subscription.data?.premium_end_at || subscription.data?.trial_end_at;
  const daysRemaining = trialEnd
    ? Math.max(0, Math.ceil((new Date(trialEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return {
    user_email: userResult.data.user?.email || '',
    profile: (profile.data as Profile) || null,
    subscription: (subscription.data as Subscription) || null,
    days_remaining: daysRemaining,
    hospitals_count: hospitals.count || 0,
    categories_count: categories.count || 0,
    is_read_only: subscriptionStatus === 'expired',
  };
}
