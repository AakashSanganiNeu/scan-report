'use client';

import { useMemo, useState } from 'react';
import { Eye, Loader2, Plus } from 'lucide-react';
import { CurrentEffectivePrice, ScanCatalog, ScanPriceHistory } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils/formatting';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface PriceManagementTableProps {
  scanCatalog: ScanCatalog[];
  currentPrices: CurrentEffectivePrice[];
  onUpdatePrice: (
    scanCatalogId: string,
    price: number,
    effectiveStartDate: string,
    reason?: string
  ) => Promise<void>;
  onFetchHistory: (scanCatalogId: string) => Promise<ScanPriceHistory[]>;
  isSaving?: boolean;
}

export function PriceManagementTable({
  scanCatalog,
  currentPrices,
  onUpdatePrice,
  onFetchHistory,
  isSaving = false,
}: PriceManagementTableProps) {
  const [scanId, setScanId] = useState(scanCatalog[0]?.id || '');
  const [price, setPrice] = useState('');
  const [effectiveStartDate, setEffectiveStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [historyScan, setHistoryScan] = useState<CurrentEffectivePrice | null>(null);
  const [historyRows, setHistoryRows] = useState<ScanPriceHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const currentMap = useMemo(
    () => new Map(currentPrices.map((row) => [row.scan_catalog_id, row])),
    [currentPrices]
  );

  const openHistory = async (row: CurrentEffectivePrice) => {
    setHistoryScan(row);
    setHistoryLoading(true);
    try {
      const data = await onFetchHistory(row.scan_catalog_id);
      setHistoryRows(data);
    } finally {
      setHistoryLoading(false);
    }
  };

  const submit = async () => {
    if (!scanId || !effectiveStartDate) return;
    const parsed = Number(price);
    if (Number.isNaN(parsed) || parsed < 0) return;

    await onUpdatePrice(scanId, parsed, effectiveStartDate, reason || undefined);
    setPrice('');
    setReason('');
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Current Effective Prices</h3>
          <p className="text-sm text-slate-600">Latest price active as of today</p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Scan Type</TableHead>
                <TableHead className="text-right">Current Price</TableHead>
                <TableHead>Effective From</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentPrices.map((row) => (
                <TableRow key={row.scan_catalog_id}>
                  <TableCell className="font-medium">{row.scan_name}</TableCell>
                  <TableCell className="text-right font-semibold text-emerald-700">
                    {formatCurrency(row.price)}
                  </TableCell>
                  <TableCell>{formatDate(row.effective_start_date)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => openHistory(row)}>
                      <Eye className="h-4 w-4 mr-1" />
                      History
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className="bg-white border-slate-200 shadow-sm p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-slate-900">Price Update</h3>
          <p className="text-sm text-slate-600">Add new effective price without overwriting history</p>
        </div>

        <div className="space-y-2">
          <Label>Scan Type</Label>
          <select
            className="w-full h-10 rounded-md border border-slate-300 px-3 text-sm"
            value={scanId}
            onChange={(event) => setScanId(event.target.value)}
          >
            {scanCatalog.map((scan) => (
              <option key={scan.id} value={scan.id}>
                {scan.name} {currentMap.get(scan.id) ? `(${formatCurrency(currentMap.get(scan.id)!.price)})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="new-price">New Price (INR)</Label>
          <Input
            id="new-price"
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="0.00"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="effective-date">Effective Start Date</Label>
          <Input
            id="effective-date"
            type="date"
            value={effectiveStartDate}
            onChange={(event) => setEffectiveStartDate(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="reason">Reason (optional)</Label>
          <Input
            id="reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Price revision note"
          />
        </div>

        <Button onClick={submit} disabled={isSaving} className="w-full bg-indigo-600 hover:bg-indigo-700">
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <Plus className="h-4 w-4 mr-2" />
          Save Price Update
        </Button>
      </Card>

      <Dialog open={!!historyScan} onOpenChange={(open) => !open && setHistoryScan(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Price History</DialogTitle>
            <DialogDescription>{historyScan?.scan_name}</DialogDescription>
          </DialogHeader>

          {historyLoading ? (
            <div className="py-8 text-center text-slate-500">Loading history...</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Price</TableHead>
                    <TableHead>Effective Start</TableHead>
                    <TableHead>Effective End (derived)</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyRows.map((row, index) => {
                    const next = historyRows[index - 1];
                    const endDate = next ? new Date(new Date(next.effective_start_date).getTime() - 86400000) : null;
                    return (
                      <TableRow key={row.id}>
                        <TableCell>{formatCurrency(row.price)}</TableCell>
                        <TableCell>{formatDate(row.effective_start_date)}</TableCell>
                        <TableCell>{endDate ? formatDate(endDate.toISOString().split('T')[0]) : 'Current'}</TableCell>
                        <TableCell>{new Date(row.created_at).toLocaleString('en-IN')}</TableCell>
                        <TableCell>{row.reason || '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
