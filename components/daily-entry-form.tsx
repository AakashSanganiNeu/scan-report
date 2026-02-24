'use client';

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { DateEntryDraft, DailyEntryFormData, ScanCatalog } from '@/lib/types';
import { formatCurrency, toInputDateFormat } from '@/lib/utils/formatting';

const schema = z.object({
  entry_date: z.string().min(1, 'Date is required'),
  notes: z.string().optional().default(''),
  items: z.array(
    z.object({
      scan_catalog_id: z.string().min(1),
      quantity: z.number().int().min(0, 'Quantity must be 0 or more'),
    })
  ),
});

type FormValues = z.infer<typeof schema>;

interface DailyEntryFormProps {
  scanCatalog: ScanCatalog[];
  draft: DateEntryDraft | null;
  onDateChange: (date: string) => Promise<void>;
  onSubmit: (data: DailyEntryFormData) => Promise<void>;
  isSaving?: boolean;
  isLoadingDate?: boolean;
}

const buildDefaults = (scanCatalog: ScanCatalog[], draft: DateEntryDraft | null): FormValues => ({
  entry_date: draft?.entry_date || toInputDateFormat(new Date()),
  notes: draft?.notes || '',
  items: scanCatalog.map((scan) => ({
    scan_catalog_id: scan.id,
    quantity: draft?.lines.find((line) => line.scan_catalog_id === scan.id)?.quantity || 0,
  })),
});

export function DailyEntryForm({
  scanCatalog,
  draft,
  onDateChange,
  onSubmit,
  isSaving = false,
  isLoadingDate = false,
}: DailyEntryFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: buildDefaults(scanCatalog, draft),
  });

  useEffect(() => {
    form.reset(buildDefaults(scanCatalog, draft));
  }, [draft, scanCatalog, form]);

  const watchedItems = form.watch('items');
  const lineMap = useMemo(
    () =>
      new Map(
        (draft?.lines || []).map((line) => [
          line.scan_catalog_id,
          { unit_price: line.unit_price, missing_price: line.missing_price },
        ])
      ),
    [draft]
  );

  const totals = useMemo(
    () =>
      watchedItems.reduce(
        (acc, item) => {
          const meta = lineMap.get(item.scan_catalog_id);
          const unitPrice = meta?.unit_price || 0;
          acc.totalScans += item.quantity;
          acc.totalRevenue += item.quantity * unitPrice;
          return acc;
        },
        { totalScans: 0, totalRevenue: 0 }
      ),
    [watchedItems, lineMap]
  );

  const onReset = () => form.reset(buildDefaults(scanCatalog, draft));

  const hasMissingPrice = (draft?.lines || []).some((line) => line.missing_price);

  return (
    <Card className="border-slate-200 shadow-sm bg-white">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Daily Scan Entry</h2>
            <p className="text-sm text-slate-600">
              {draft?.exists ? 'Existing entry loaded for selected date' : 'Enter quantities for each scan type'}
            </p>
          </div>
          {isLoadingDate && <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />}
        </div>

        {hasMissingPrice && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 flex gap-2 text-sm text-amber-900">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <p>Some scan types do not have a price for this date. They are treated as ₹0 until a price is added.</p>
          </div>
        )}

        <Form {...form}>
          <form
            className="space-y-6"
            onSubmit={form.handleSubmit(async (values) => {
              await onSubmit({
                entry_date: values.entry_date,
                notes: values.notes || '',
                items: values.items,
              });
            })}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="entry_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        onChange={async (event) => {
                          const date = event.target.value;
                          field.onChange(date);
                          if (date) await onDateChange(date);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (optional)</FormLabel>
                    <FormControl>
                      <Textarea rows={2} placeholder="Optional day notes" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-slate-700">Scan Type</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-700">Unit Price</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-700">Quantity</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-700">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {scanCatalog.map((scan, index) => {
                    const unitPrice = lineMap.get(scan.id)?.unit_price || 0;
                    const quantity = watchedItems[index]?.quantity || 0;
                    return (
                      <tr key={scan.id} className="border-t border-slate-100">
                        <td className="px-4 py-3 text-slate-900">{scan.name}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(unitPrice)}</td>
                        <td className="px-4 py-3 text-right">
                          <FormField
                            control={form.control}
                            name={`items.${index}.quantity`}
                            render={({ field }) => (
                              <Input
                                type="number"
                                min="0"
                                value={field.value}
                                onChange={(event) => field.onChange(Math.max(0, Number(event.target.value) || 0))}
                                className="w-24 ml-auto text-right"
                              />
                            )}
                          />
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-emerald-700">
                          {formatCurrency(quantity * unitPrice)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-indigo-50 border-t border-indigo-200">
                  <tr>
                    <td className="px-4 py-3 font-semibold text-slate-900">Totals</td>
                    <td />
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{totals.totalScans}</td>
                    <td className="px-4 py-3 text-right font-semibold text-indigo-900">
                      {formatCurrency(totals.totalRevenue)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="sticky bottom-0 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 border-t border-slate-200 pt-4 flex items-center justify-end gap-3">
              <Button type="button" variant="outline" onClick={onReset} disabled={isSaving || isLoadingDate}>
                Reset
              </Button>
              <Button type="submit" disabled={isSaving || isLoadingDate} className="bg-indigo-600 hover:bg-indigo-700">
                {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {draft?.exists ? 'Update Existing Entry' : 'Save Day Entry'}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </Card>
  );
}
