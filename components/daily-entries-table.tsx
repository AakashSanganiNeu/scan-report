'use client';

import { useState } from 'react';
import { Eye, Loader2, Pencil, Trash2 } from 'lucide-react';
import { DailyEntryWithItems } from '@/lib/types';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils/formatting';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DailyEntriesTableProps {
  entries: DailyEntryWithItems[];
  onEdit: (entry: DailyEntryWithItems) => void;
  onDelete: (entryId: string) => Promise<void>;
  isDeleting?: boolean;
}

export function DailyEntriesTable({
  entries,
  onEdit,
  onDelete,
  isDeleting = false,
}: DailyEntriesTableProps) {
  const [viewEntry, setViewEntry] = useState<DailyEntryWithItems | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<DailyEntryWithItems | null>(null);

  if (entries.length === 0) {
    return (
      <Card className="p-8 text-center bg-white border-slate-200">
        <p className="text-slate-700 font-medium">No daily entries for this month</p>
        <p className="text-sm text-slate-500 mt-1">Use the form above to save the first day.</p>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total Scans</TableHead>
                <TableHead className="text-right">Total Revenue</TableHead>
                <TableHead>Last Updated At</TableHead>
                <TableHead>Last Updated By</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{formatDate(entry.entry_date)}</TableCell>
                  <TableCell className="text-right">{entry.total_scans}</TableCell>
                  <TableCell className="text-right font-semibold text-emerald-700">
                    {formatCurrency(Number(entry.total_revenue))}
                  </TableCell>
                  <TableCell>{formatDateTime(entry.updated_at)}</TableCell>
                  <TableCell>{entry.updated_by || '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setViewEntry(entry)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onEdit(entry)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        onClick={() => setDeleteEntry(entry)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={!!viewEntry} onOpenChange={(open) => !open && setViewEntry(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Entry Breakdown</DialogTitle>
            <DialogDescription>{viewEntry ? formatDate(viewEntry.entry_date) : ''}</DialogDescription>
          </DialogHeader>

          {viewEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-slate-50">
                <div>
                  <p className="text-xs text-slate-600">Total Scans</p>
                  <p className="text-xl font-semibold">{viewEntry.total_scans}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600">Total Revenue</p>
                  <p className="text-xl font-semibold text-emerald-700">
                    {formatCurrency(Number(viewEntry.total_revenue))}
                  </p>
                </div>
              </div>

              {viewEntry.notes && (
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-1">Notes</p>
                  <p className="text-sm text-slate-600 rounded-md border border-slate-200 bg-slate-50 p-3">
                    {viewEntry.notes}
                  </p>
                </div>
              )}

              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Scan Type</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Line Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewEntry.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.scan_name}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.line_total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteEntry} onOpenChange={(open) => !open && setDeleteEntry(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete Entry</AlertDialogTitle>
          <AlertDialogDescription>
            Delete entry for {deleteEntry ? formatDate(deleteEntry.entry_date) : ''}? This cannot be undone.
          </AlertDialogDescription>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              disabled={isDeleting}
              onClick={async () => {
                if (!deleteEntry) return;
                await onDelete(deleteEntry.id);
                setDeleteEntry(null);
              }}
            >
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
