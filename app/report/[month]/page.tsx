'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { getMonthlyStats, fetchDailyEntriesForMonth } from '@/lib/actions';
import { DailyEntryWithItems, MonthlySummary } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils/formatting';
import { Button } from '@/components/ui/button';

export default function MonthlyReportPage() {
  const params = useParams<{ month: string }>();
  const monthKey = params.month;

  const [entries, setEntries] = useState<DailyEntryWithItems[]>([]);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(true);

  const parsed = useMemo(() => {
    const [year, month] = (monthKey || '').split('-').map(Number);
    return { year, month };
  }, [monthKey]);

  const label = useMemo(() => {
    if (!parsed.year || !parsed.month) return monthKey;
    return new Intl.DateTimeFormat('en-IN', {
      month: 'long',
      year: 'numeric',
    }).format(new Date(parsed.year, parsed.month - 1));
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
          <Button
            variant="outline"
            onClick={() => {
              if (window.history.length > 1) {
                window.history.back();
                return;
              }
              window.location.href = '/';
            }}
          >
            Back to Dashboard
          </Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => window.print()}>
            Print (A4)
          </Button>
        </div>

        <header className="border-b border-slate-300 pb-4">
          <h1 className="text-2xl font-bold text-slate-900">
            Ramya&apos;s Ultrasound Scan revenue calculator
          </h1>
          <p className="text-slate-600">Monthly Report: {label}</p>
          <p className="text-sm text-slate-500">
            Generated at: {new Date().toLocaleString('en-IN')}
          </p>
        </header>

        {loading || !summary ? (
          <p className="text-slate-500">Loading report...</p>
        ) : (
          <>
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="border rounded-lg p-3">
                <p className="text-xs text-slate-600">Total Days</p>
                <p className="text-xl font-semibold">{summary.total_days}</p>
              </div>
              <div className="border rounded-lg p-3">
                <p className="text-xs text-slate-600">Total Scans</p>
                <p className="text-xl font-semibold">{summary.total_scans}</p>
              </div>
              <div className="border rounded-lg p-3">
                <p className="text-xs text-slate-600">Total Revenue</p>
                <p className="text-xl font-semibold">{formatCurrency(summary.total_revenue)}</p>
              </div>
              <div className="border rounded-lg p-3">
                <p className="text-xs text-slate-600">Avg / Day</p>
                <p className="text-xl font-semibold">{formatCurrency(summary.average_revenue_per_day)}</p>
              </div>
            </section>

            <section>
              <h2 className="font-semibold text-slate-900 mb-2">Daily Entries</h2>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-3 py-2">Date</th>
                      <th className="text-right px-3 py-2">Scans</th>
                      <th className="text-right px-3 py-2">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.id} className="border-t">
                        <td className="px-3 py-2">{formatDate(entry.entry_date)}</td>
                        <td className="px-3 py-2 text-right">{entry.total_scans}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(entry.total_revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="font-semibold text-slate-900 mb-2">Monthly Summary by Scan Type</h2>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-3 py-2">Scan Type</th>
                      <th className="text-right px-3 py-2">Total Qty</th>
                      <th className="text-right px-3 py-2">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.items.map((item) => (
                      <tr key={item.scan_catalog_id} className="border-t">
                        <td className="px-3 py-2">{item.scan_name}</td>
                        <td className="px-3 py-2 text-right">{item.total_quantity}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(item.total_revenue)}</td>
                      </tr>
                    ))}
                    <tr className="border-t bg-slate-50 font-semibold">
                      <td className="px-3 py-2">Grand Total</td>
                      <td className="px-3 py-2 text-right">{summary.total_scans}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(summary.total_revenue)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
