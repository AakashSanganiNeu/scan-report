'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  deleteDailyEntry,
  fetchAuditLogs,
  fetchCurrentEffectivePrices,
  fetchDailyEntriesForMonth,
  fetchDateEntryDraft,
  fetchScanCatalog,
  fetchScanPriceHistory,
  getDailyStats,
  getMonthlyStats,
  seedDefaultCatalogAndPrices,
  saveDailyEntry,
  updateScanPrice,
} from '@/lib/actions';
import {
  AuditLog,
  DateEntryDraft,
  DailyEntryFormData,
  DailyEntryWithItems,
  DailyStats,
  MonthlySummary,
  ScanCatalog,
  ScanPriceHistory,
  CurrentEffectivePrice,
} from '@/lib/types';
import {
  getCurrentMonthYear,
  getMonthLabel,
  toInputDateFormat,
} from '@/lib/utils/formatting';
import { DailyEntryForm } from '@/components/daily-entry-form';
import { DailyEntriesTable } from '@/components/daily-entries-table';
import { MonthlySummaryTable } from '@/components/monthly-summary-table';
import { PriceManagementTable } from '@/components/price-management-table';
import { AuditHistoryTable } from '@/components/audit-history-table';
import { RevenueChart, ScanTypeChart, ScansPerDayChart } from '@/components/charts';
import { StatCard } from '@/components/stat-card';
import { ExportMenu } from '@/components/export-menu';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function DashboardPage() {
  const { toast } = useToast();

  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthYear());
  const [selectedDate, setSelectedDate] = useState(toInputDateFormat(new Date()));

  const [scanCatalog, setScanCatalog] = useState<ScanCatalog[]>([]);
  const [draft, setDraft] = useState<DateEntryDraft | null>(null);
  const [dailyEntries, setDailyEntries] = useState<DailyEntryWithItems[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [currentPrices, setCurrentPrices] = useState<CurrentEffectivePrice[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingEntry, setIsSavingEntry] = useState(false);
  const [isDeletingEntry, setIsDeletingEntry] = useState(false);
  const [isSavingPrice, setIsSavingPrice] = useState(false);
  const [isLoadingDate, setIsLoadingDate] = useState(false);
  const [isSeedingDefaults, setIsSeedingDefaults] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);

  const monthKey = `${currentMonth.year}-${String(currentMonth.month).padStart(2, '0')}`;
  const monthLabel = getMonthLabel(currentMonth.year, currentMonth.month);

  const monthRange = useMemo(() => {
    const startDate = `${currentMonth.year}-${String(currentMonth.month).padStart(2, '0')}-01`;
    const endDate = new Date(currentMonth.year, currentMonth.month, 0).toISOString().split('T')[0];
    return { startDate, endDate };
  }, [currentMonth]);

  const loadDateDraft = useCallback(async (date: string) => {
    setIsLoadingDate(true);
    try {
      const data = await fetchDateEntryDraft(date);
      setDraft(data);
    } finally {
      setIsLoadingDate(false);
    }
  }, []);

  const loadMonthData = useCallback(async () => {
    setIsLoading(true);
    setFatalError(null);
    try {
      const [catalog, entries, summary, stats, prices, logs] = await Promise.all([
        fetchScanCatalog(),
        fetchDailyEntriesForMonth(currentMonth.year, currentMonth.month),
        getMonthlyStats(currentMonth.year, currentMonth.month),
        getDailyStats(currentMonth.year, currentMonth.month),
        fetchCurrentEffectivePrices(),
        fetchAuditLogs({
          startDate: monthRange.startDate,
          endDate: monthRange.endDate,
          action: 'ALL',
          entityType: 'ALL',
        }),
      ]);

      setScanCatalog(catalog);
      setDailyEntries(entries);
      setMonthlySummary(summary);
      setDailyStats(stats);
      setCurrentPrices(prices);
      setAuditLogs(logs);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load dashboard data';
      setFatalError(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth, monthRange.endDate, monthRange.startDate, toast]);

  useEffect(() => {
    loadMonthData();
  }, [loadMonthData]);

  useEffect(() => {
    loadDateDraft(selectedDate).catch(() => {
      toast({
        title: 'Error',
        description: 'Failed to load selected date details',
        variant: 'destructive',
      });
    });
  }, [selectedDate, loadDateDraft, toast]);

  const refreshAll = async () => {
    await Promise.all([loadMonthData(), loadDateDraft(selectedDate)]);
  };

  const handleEntrySubmit = async (data: DailyEntryFormData) => {
    setIsSavingEntry(true);
    try {
      await saveDailyEntry(data);
      await refreshAll();
      toast({
        title: 'Saved',
        description: 'Daily entry saved successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not save daily entry',
        variant: 'destructive',
      });
    } finally {
      setIsSavingEntry(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    setIsDeletingEntry(true);
    try {
      await deleteDailyEntry(entryId);
      await refreshAll();
      toast({
        title: 'Deleted',
        description: 'Daily entry deleted',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete entry',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingEntry(false);
    }
  };

  const handleUpdatePrice = async (
    scanCatalogId: string,
    price: number,
    effectiveStartDate: string,
    reason?: string
  ) => {
    setIsSavingPrice(true);
    try {
      await updateScanPrice(scanCatalogId, price, effectiveStartDate, reason);
      await refreshAll();
      toast({
        title: 'Price Updated',
        description: 'New effective price saved successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to update price',
        variant: 'destructive',
      });
    } finally {
      setIsSavingPrice(false);
    }
  };

  const handleAuditFilter = async (filter: {
    startDate?: string;
    endDate?: string;
    action?: 'CREATE' | 'UPDATE' | 'DELETE' | 'ALL';
    entityType?: 'daily_entry' | 'price' | 'ALL';
  }) => {
    const logs = await fetchAuditLogs(filter);
    setAuditLogs(logs);
  };

  const handleSeedDefaults = async () => {
    setIsSeedingDefaults(true);
    try {
      await seedDefaultCatalogAndPrices();
      await refreshAll();
      toast({
        title: 'Defaults Loaded',
        description: 'Default scan types and prices were initialized.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to initialize defaults';
      setFatalError(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSeedingDefaults(false);
    }
  };

  const handleEditEntry = async (entry: DailyEntryWithItems) => {
    setSelectedDate(entry.entry_date);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-indigo-50/30 to-teal-50/30">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Ramya&apos;s Ultrasound Scan revenue calculator
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Daily tracking, effective-date pricing, monthly reports, and audit logs
            </p>
          </div>

          {monthlySummary && (
            <ExportMenu
              entries={dailyEntries}
              summary={monthlySummary}
              monthLabel={monthLabel}
              monthKey={monthKey}
            />
          )}
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {fatalError && (
          <div className="rounded-lg border border-rose-300 bg-rose-50 p-4">
            <p className="text-sm font-medium text-rose-900">Database Connection / Query Error</p>
            <p className="text-sm text-rose-800 mt-1">{fatalError}</p>
          </div>
        )}

        {!fatalError && !isLoading && scanCatalog.length === 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-amber-900">No scan types found in database.</p>
              <p className="text-sm text-amber-800">
                Initialize default scan catalog and prices to start entering daily data.
              </p>
            </div>
            <Button onClick={handleSeedDefaults} disabled={isSeedingDefaults} className="bg-amber-700 hover:bg-amber-800">
              {isSeedingDefaults ? 'Initializing...' : 'Initialize Defaults'}
            </Button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                setCurrentMonth((prev) =>
                  prev.month === 1
                    ? { year: prev.year - 1, month: 12 }
                    : { ...prev, month: prev.month - 1 }
                )
              }
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <Select
              value={monthKey}
              onValueChange={(value) => {
                const [year, month] = value.split('-').map(Number);
                setCurrentMonth({ year, month });
              }}
            >
              <SelectTrigger className="w-52 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 36 }, (_, index) => {
                  const date = new Date();
                  date.setMonth(date.getMonth() - 18 + index);
                  const year = date.getFullYear();
                  const month = date.getMonth() + 1;
                  const value = `${year}-${String(month).padStart(2, '0')}`;
                  const label = new Intl.DateTimeFormat('en-IN', {
                    month: 'long',
                    year: 'numeric',
                  }).format(date);
                  return (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                setCurrentMonth((prev) =>
                  prev.month === 12
                    ? { year: prev.year + 1, month: 1 }
                    : { ...prev, month: prev.month + 1 }
                )
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Total Days Entered" value={monthlySummary?.total_days || 0} loading={isLoading} />
          <StatCard label="Total Scans (Month)" value={monthlySummary?.total_scans || 0} loading={isLoading} />
          <StatCard label="Total Revenue (Month)" value={monthlySummary?.total_revenue || 0} currency loading={isLoading} />
          <StatCard
            label="Average Revenue / Day"
            value={monthlySummary?.average_revenue_per_day || 0}
            currency
            loading={isLoading}
          />
          <StatCard
            label="Highest Revenue Day"
            value={monthlySummary?.highest_revenue_day?.revenue || 0}
            currency
            loading={isLoading}
          />
        </div>

        <Tabs defaultValue="entries" className="space-y-6">
          <TabsList className="bg-white border border-slate-200">
            <TabsTrigger value="entries">Daily Entries</TabsTrigger>
            <TabsTrigger value="summary">Monthly Summary</TabsTrigger>
            <TabsTrigger value="prices">Price Management</TabsTrigger>
            <TabsTrigger value="history">Edit History</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="entries" className="space-y-6">
            <DailyEntryForm
              scanCatalog={scanCatalog}
              draft={draft}
              onDateChange={async (date) => {
                setSelectedDate(date);
              }}
              onSubmit={handleEntrySubmit}
              isSaving={isSavingEntry}
              isLoadingDate={isLoadingDate}
            />

            <DailyEntriesTable
              entries={dailyEntries}
              onEdit={handleEditEntry}
              onDelete={handleDeleteEntry}
              isDeleting={isDeletingEntry}
            />
          </TabsContent>

          <TabsContent value="summary" className="space-y-6">
            <MonthlySummaryTable summary={monthlySummary} isLoading={isLoading} />
          </TabsContent>

          <TabsContent value="prices" className="space-y-6">
            <PriceManagementTable
              scanCatalog={scanCatalog}
              currentPrices={currentPrices}
              onUpdatePrice={handleUpdatePrice}
              onFetchHistory={(id: string): Promise<ScanPriceHistory[]> => fetchScanPriceHistory(id)}
              isSaving={isSavingPrice}
            />
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <AuditHistoryTable logs={auditLogs} onFilterChange={handleAuditFilter} />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RevenueChart data={dailyStats} isLoading={isLoading} />
              <ScansPerDayChart data={dailyStats} isLoading={isLoading} />
            </div>
            <ScanTypeChart summary={monthlySummary} isLoading={isLoading} />
          </TabsContent>
        </Tabs>
      </section>
    </main>
  );
}
