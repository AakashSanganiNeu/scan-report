'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchDailyEntriesForMonth, getMonthlyStats } from '@/lib/actions';
import { DailyEntryWithItems, MonthlySummary } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils/formatting';
import { Button } from '@/components/ui/button';

export default function ReportPage({ params }: { params: { month: string } }) {
  const monthKey = params.month;
  const search = useSearchParams();
  const hospitalParam = search.get('hospital') || 'All Hospitals';
  const [entries, setEntries] = useState<DailyEntryWithItems[]>([]);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(true);

  const parsed = useMemo(() => {
    const [year, month] = (monthKey || '').split('-').map(Number);
    return { year, month };
  }, [monthKey]);

  const label = useMemo(() => {
    if (!parsed.year || !parsed.month) return monthKey;
    return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(parsed.year, parsed.month - 1));
  }, [parsed, monthKey]);

  useEffect(() => {
    const load = async () => {
      if (!parsed.year || !parsed.month) return;
      setLoading(true);
      try {
        const [dailyRows, monthlySummary] = await Promise.all([
          fetchDailyEntriesForMonth(parsed.year, parsed.month),
          getMonthlyStats(parsed.year, parsed.month),
        ]);
        setEntries(dailyRows);
        setSummary(monthlySummary);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [parsed]);

  return (
    <main className="min-h-screen bg-white p-4 sm:p-8 print:p-0">
      <div className="max-w-4xl mx-auto space-y-6 print:space-y-4">
        <div className="flex items-center justify-between print:hidden">
          <Button variant="outline" onClick={() => (window.history.length > 1 ? window.history.back() : (window.location.href = '/'))}>Back</Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => window.print()}>Print (A4)</Button>
        </div>

        <header className="border-b border-slate-300 pb-4">
          <h1 className="text-2xl font-bold text-slate-900">Ramya&apos;s Ultrasound Scan revenue calculator</h1>
          <p className="text-slate-600">Monthly Report: {label}</p>
          <p className="text-sm text-slate-500">Hospital filter: {hospitalParam}</p>
          <p className="text-sm text-slate-500">Generated at: {new Date().toLocaleString('en-IN')}</p>
        </header>

        {loading || !summary ? (
          <p className="text-slate-500">Loading report...</p>
        ) : (
          <section>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50"><tr><th className="text-left px-3 py-2">Date</th><th className="text-right px-3 py-2">Scans</th><th className="text-right px-3 py-2">Calculated</th><th className="text-right px-3 py-2">Final</th><th className="text-right px-3 py-2">Override</th></tr></thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-t">
                      <td className="px-3 py-2">{formatDate(entry.entry_date)}</td>
                      <td className="px-3 py-2 text-right">{entry.total_scans}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(Number(entry.calculated_total_revenue ?? entry.total_revenue))}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(Number(entry.final_total_revenue ?? entry.total_revenue))}</td>
                      <td className="px-3 py-2 text-right">{entry.is_manual_override ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
