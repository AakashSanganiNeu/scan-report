'use client';

import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MonthlySummary } from '@/lib/types';
import { formatCurrency } from '@/lib/utils/formatting';

interface MonthlySummaryTableProps {
  summary: MonthlySummary | null;
  isLoading?: boolean;
}

export function MonthlySummaryTable({ summary, isLoading = false }: MonthlySummaryTableProps) {
  if (isLoading) {
    return (
      <Card className="p-8 text-center bg-white border-slate-200">
        <p className="text-slate-500">Loading monthly summary...</p>
      </Card>
    );
  }

  if (!summary || summary.items.length === 0) {
    return (
      <Card className="p-8 text-center bg-white border-slate-200">
        <p className="text-slate-700 font-medium">No monthly summary data</p>
      </Card>
    );
  }

  return (
    <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Scan Type</TableHead>
              <TableHead className="text-right">Total Qty</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Avg Qty/Day</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.items.map((item) => (
              <TableRow key={item.scan_catalog_id}>
                <TableCell className="font-medium">{item.scan_name}</TableCell>
                <TableCell className="text-right">{item.total_quantity}</TableCell>
                <TableCell className="text-right font-semibold text-emerald-700">
                  {formatCurrency(item.total_revenue)}
                </TableCell>
                <TableCell className="text-right">{item.average_quantity_per_day.toFixed(2)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-indigo-50">
              <TableCell className="font-semibold">Grand Total</TableCell>
              <TableCell className="text-right font-semibold">{summary.total_scans}</TableCell>
              <TableCell className="text-right font-semibold text-indigo-900">
                {formatCurrency(summary.total_revenue)}
              </TableCell>
              <TableCell className="text-right font-semibold">
                {summary.total_days ? (summary.total_scans / summary.total_days).toFixed(2) : '0.00'}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
