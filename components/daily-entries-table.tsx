'use client';

import { useState } from 'react';
import { Eye, Loader2, Pencil, Trash2 } from 'lucide-react';
import { DailyEntryWithItems } from '@/lib/types';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils/formatting';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface DailyEntriesTableProps {
  entries: DailyEntryWithItems[];
  onEdit: (entry: DailyEntryWithItems) => void;
  onDelete: (entryId: string) => Promise<void>;
  isDeleting?: boolean;
}

export function DailyEntriesTable({ entries, onEdit, onDelete, isDeleting = false }: DailyEntriesTableProps) {
  const [viewEntry, setViewEntry] = useState<DailyEntryWithItems | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<DailyEntryWithItems | null>(null);

  if (entries.length === 0) {
    return <Card className="p-8 text-center bg-white border-slate-200"><p className="text-slate-700 font-medium">No daily entries for this month</p></Card>;
  }

  return (
    <>
      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader><TableRow className="bg-slate-50"><TableHead>Date</TableHead><TableHead>Hospital</TableHead><TableHead className="text-right">Scans</TableHead><TableHead className="text-right">Calculated</TableHead><TableHead className="text-right">Final</TableHead><TableHead>Updated</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{formatDate(entry.entry_date)}</TableCell>
                  <TableCell>{entry.hospital_name || '-'}</TableCell>
                  <TableCell className="text-right">{entry.total_scans}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(entry.calculated_total_revenue ?? entry.total_revenue))}</TableCell>
                  <TableCell className="text-right font-semibold text-emerald-700">{formatCurrency(Number(entry.final_total_revenue ?? entry.total_revenue))}</TableCell>
                  <TableCell>{formatDateTime(entry.updated_at)}</TableCell>
                  <TableCell><div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => setViewEntry(entry)}><Eye className="h-4 w-4" /></Button><Button variant="ghost" size="sm" onClick={() => onEdit(entry)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="sm" className="text-rose-600" onClick={() => setDeleteEntry(entry)}><Trash2 className="h-4 w-4" /></Button></div></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="md:hidden p-3 space-y-2">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-lg border p-3 space-y-1">
              <div className="flex items-center justify-between"><p className="font-medium">{formatDate(entry.entry_date)}</p><p className="text-xs text-slate-500">{entry.hospital_name || '-'}</p></div>
              <p className="text-sm">Scans: {entry.total_scans}</p>
              <p className="text-sm">Calculated: {formatCurrency(Number(entry.calculated_total_revenue ?? entry.total_revenue))}</p>
              <p className="text-sm font-semibold text-emerald-700">Final: {formatCurrency(Number(entry.final_total_revenue ?? entry.total_revenue))}</p>
            </div>
          ))}
        </div>
      </Card>

      <Dialog open={!!viewEntry} onOpenChange={(open) => !open && setViewEntry(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Entry Breakdown</DialogTitle><DialogDescription>{viewEntry ? formatDate(viewEntry.entry_date) : ''}</DialogDescription></DialogHeader>
          {viewEntry && <div className="space-y-3"><p className="text-sm">Hospital: {viewEntry.hospital_name || '-'}</p><p className="text-sm">Override: {viewEntry.is_manual_override ? 'Yes' : 'No'} {viewEntry.manual_override_reason ? `(${viewEntry.manual_override_reason})` : ''}</p></div>}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteEntry} onOpenChange={(open) => !open && setDeleteEntry(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete Entry</AlertDialogTitle>
          <AlertDialogDescription>Delete entry for {deleteEntry ? formatDate(deleteEntry.entry_date) : ''}?</AlertDialogDescription>
          <div className="flex justify-end gap-2"><AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel><AlertDialogAction className="bg-rose-600" disabled={isDeleting} onClick={async () => { if (!deleteEntry) return; await onDelete(deleteEntry.id); setDeleteEntry(null); }}>{isDeleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Delete</AlertDialogAction></div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
