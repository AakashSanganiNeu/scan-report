'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  createCategory,
  createHospital,
  deleteDailyEntry,
  fetchAuditLogs,
  fetchCurrentEffectivePrices,
  fetchDailyEntriesForMonth,
  fetchDateEntryDraft,
  fetchHospitals,
  fetchScanCatalog,
  fetchScanPriceHistory,
  getDailyStats,
  getMonthlyStats,
  getSubscriptionStatus,
  saveDailyEntry,
  updateScanPrice,
} from '@/lib/actions';
import { AuditLog, DateEntryDraft, DailyEntryFormData, DailyEntryWithItems, DailyStats, Hospital, MonthlySummary, ScanCatalog, ScanPriceHistory, CurrentEffectivePrice } from '@/lib/types';
import { getCurrentMonthYear, getMonthLabel, toInputDateFormat } from '@/lib/utils/formatting';
import { DailyEntryForm } from '@/components/daily-entry-form';
import { DailyEntriesTable } from '@/components/daily-entries-table';
import { MonthlySummaryTable } from '@/components/monthly-summary-table';
import { PriceManagementTable } from '@/components/price-management-table';
import { AuditHistoryTable } from '@/components/audit-history-table';
import { RevenueChart, ScanTypeChart, ScansPerDayChart } from '@/components/charts';
import { StatCard } from '@/components/stat-card';
import { ExportMenu } from '@/components/export-menu';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HospitalManagement } from '@/components/hospital-management';
import { CategoryManagement } from '@/components/category-management';

export default function DashboardPage() {
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthYear());
  const [selectedDate, setSelectedDate] = useState(toInputDateFormat(new Date()));
  const [selectedHospitalId, setSelectedHospitalId] = useState('all');
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('trialing');

  const [scanCatalog, setScanCatalog] = useState<ScanCatalog[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
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

  const monthKey = `${currentMonth.year}-${String(currentMonth.month).padStart(2, '0')}`;
  const monthLabel = getMonthLabel(currentMonth.year, currentMonth.month);
  const hospitalLabel = selectedHospitalId === 'all' ? 'All Hospitals' : hospitals.find((h) => h.id === selectedHospitalId)?.name || 'All Hospitals';

  const monthRange = useMemo(() => {
    const startDate = `${currentMonth.year}-${String(currentMonth.month).padStart(2, '0')}-01`;
    const endDate = new Date(currentMonth.year, currentMonth.month, 0).toISOString().split('T')[0];
    return { startDate, endDate };
  }, [currentMonth]);

  const loadDateDraft = useCallback(async (date: string, hospitalId: string) => {
    setIsLoadingDate(true);
    try {
      if (hospitalId === 'all') return;
      const data = await fetchDateEntryDraft(date, hospitalId);
      setDraft(data);
    } finally {
      setIsLoadingDate(false);
    }
  }, []);

  const loadMonthData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [catalog, hospitalsData, entries, summary, stats, prices, logs, subStatus] = await Promise.all([
        fetchScanCatalog(),
        fetchHospitals(),
        fetchDailyEntriesForMonth(currentMonth.year, currentMonth.month, selectedHospitalId),
        getMonthlyStats(currentMonth.year, currentMonth.month, selectedHospitalId),
        getDailyStats(currentMonth.year, currentMonth.month, selectedHospitalId),
        fetchCurrentEffectivePrices(),
        fetchAuditLogs({ startDate: monthRange.startDate, endDate: monthRange.endDate, action: 'ALL', entityType: 'ALL' }),
        getSubscriptionStatus(),
      ]);

      setScanCatalog(catalog);
      setHospitals(hospitalsData);
      if (selectedHospitalId === 'all' && hospitalsData[0]) setSelectedHospitalId(hospitalsData[0].id);
      setDailyEntries(entries);
      setMonthlySummary(summary);
      setDailyStats(stats);
      setCurrentPrices(prices);
      setAuditLogs(logs);
      setSubscriptionStatus(subStatus);
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to load data', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth, monthRange.endDate, monthRange.startDate, selectedHospitalId, toast]);

  useEffect(() => { loadMonthData(); }, [loadMonthData]);
  useEffect(() => { if (selectedHospitalId !== 'all') loadDateDraft(selectedDate, selectedHospitalId); }, [selectedDate, selectedHospitalId, loadDateDraft]);

  const refreshAll = async () => {
    await Promise.all([loadMonthData(), selectedHospitalId === 'all' ? Promise.resolve() : loadDateDraft(selectedDate, selectedHospitalId)]);
  };

  const handleEntrySubmit = async (data: DailyEntryFormData) => {
    setIsSavingEntry(true);
    try { await saveDailyEntry(data); await refreshAll(); toast({ title: 'Saved', description: 'Daily entry saved successfully' }); }
    catch (error) { toast({ title: 'Error', description: error instanceof Error ? error.message : 'Could not save entry', variant: 'destructive' }); }
    finally { setIsSavingEntry(false); }
  };

  const handleDeleteEntry = async (entryId: string) => { setIsDeletingEntry(true); try { await deleteDailyEntry(entryId); await refreshAll(); } finally { setIsDeletingEntry(false); } };
  const handleUpdatePrice = async (scanCatalogId: string, price: number, effectiveStartDate: string, reason?: string) => { setIsSavingPrice(true); try { await updateScanPrice(scanCatalogId, price, effectiveStartDate, reason); await refreshAll(); } finally { setIsSavingPrice(false); } };

  const handleCopyPrevious = async () => {
    const previous = new Date(selectedDate);
    previous.setDate(previous.getDate() - 1);
    await loadDateDraft(previous.toISOString().slice(0, 10), selectedHospitalId);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-indigo-50/30 to-teal-50/30 pb-20 md:pb-8">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-slate-900">Ramya&apos;s Ultrasound Scan revenue calculator</h1>
            <p className="text-sm text-slate-600 mt-1">Status: <span className={subscriptionStatus === 'expired' ? 'text-rose-600' : 'text-emerald-600'}>{subscriptionStatus}</span></p>
          </div>
          {monthlySummary && <ExportMenu entries={dailyEntries} summary={monthlySummary} monthLabel={monthLabel} monthKey={monthKey} hospitalLabel={hospitalLabel} />}
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth((prev) => prev.month === 1 ? { year: prev.year - 1, month: 12 } : { ...prev, month: prev.month - 1 })}><ChevronLeft className="h-4 w-4" /></Button>
            <Select value={monthKey} onValueChange={(value) => { const [year, month] = value.split('-').map(Number); setCurrentMonth({ year, month }); }}><SelectTrigger className="w-52 bg-white"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 36 }, (_, index) => { const date = new Date(); date.setMonth(date.getMonth() - 18 + index); const year = date.getFullYear(); const month = date.getMonth() + 1; const value = `${year}-${String(month).padStart(2, '0')}`; const label = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(date); return <SelectItem key={value} value={value}>{label}</SelectItem>; })}</SelectContent></Select>
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth((prev) => prev.month === 12 ? { year: prev.year + 1, month: 1 } : { ...prev, month: prev.month + 1 })}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <select className="h-10 rounded-md border border-input bg-white px-3" value={selectedHospitalId} onChange={(e) => setSelectedHospitalId(e.target.value)}>
            <option value="all">All Hospitals</option>
            {hospitals.map((hospital) => <option key={hospital.id} value={hospital.id}>{hospital.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard label="Total Days" value={monthlySummary?.total_days || 0} loading={isLoading} />
          <StatCard label="Total Scans" value={monthlySummary?.total_scans || 0} loading={isLoading} />
          <StatCard label="Total Revenue" value={monthlySummary?.total_revenue || 0} currency loading={isLoading} />
          <StatCard label="Average / Day" value={monthlySummary?.average_revenue_per_day || 0} currency loading={isLoading} />
          <StatCard label="Highest Day" value={monthlySummary?.highest_revenue_day?.revenue || 0} currency loading={isLoading} />
        </div>

        <Tabs defaultValue="entries" className="space-y-4">
          <TabsList className="bg-white border border-slate-200 flex-wrap h-auto">
            <TabsTrigger value="entries">Entries</TabsTrigger><TabsTrigger value="summary">Summary</TabsTrigger><TabsTrigger value="prices">Prices</TabsTrigger><TabsTrigger value="categories">Categories</TabsTrigger><TabsTrigger value="hospitals">Hospitals</TabsTrigger><TabsTrigger value="history">History</TabsTrigger><TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="entries" className="space-y-4">
            {selectedHospitalId !== 'all' ? <DailyEntryForm scanCatalog={scanCatalog} hospitals={hospitals} selectedHospitalId={selectedHospitalId} draft={draft} onDateChange={async (date) => setSelectedDate(date)} onHospitalChange={async (id) => setSelectedHospitalId(id)} onCopyPreviousDay={handleCopyPrevious} onSubmit={handleEntrySubmit} isSaving={isSavingEntry || subscriptionStatus === 'expired'} isLoadingDate={isLoadingDate} /> : <p className="text-sm text-slate-600">Select a hospital to add/edit entries. All Hospitals mode is read-only aggregate.</p>}
            <DailyEntriesTable entries={dailyEntries} onEdit={(entry) => { setSelectedDate(entry.entry_date); if (entry.hospital_id) setSelectedHospitalId(entry.hospital_id); }} onDelete={handleDeleteEntry} isDeleting={isDeletingEntry} />
          </TabsContent>

          <TabsContent value="summary"><MonthlySummaryTable summary={monthlySummary} isLoading={isLoading} /></TabsContent>
          <TabsContent value="prices"><PriceManagementTable scanCatalog={scanCatalog} currentPrices={currentPrices} onUpdatePrice={handleUpdatePrice} onFetchHistory={(id: string): Promise<ScanPriceHistory[]> => fetchScanPriceHistory(id)} isSaving={isSavingPrice || subscriptionStatus === 'expired'} /></TabsContent>
          <TabsContent value="categories"><CategoryManagement categories={scanCatalog} onCreate={async (name, price, start) => { await createCategory(name, price, start); await refreshAll(); }} /></TabsContent>
          <TabsContent value="hospitals"><HospitalManagement hospitals={hospitals} onCreate={async (name, location) => { await createHospital(name, location); await refreshAll(); }} /></TabsContent>
          <TabsContent value="history"><AuditHistoryTable logs={auditLogs} onFilterChange={async (filter) => setAuditLogs(await fetchAuditLogs(filter))} /></TabsContent>
          <TabsContent value="analytics"><div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><RevenueChart data={dailyStats} isLoading={isLoading} /><ScansPerDayChart data={dailyStats} isLoading={isLoading} /></div><ScanTypeChart summary={monthlySummary} isLoading={isLoading} /></TabsContent>
        </Tabs>
      </section>
    </main>
  );
}
