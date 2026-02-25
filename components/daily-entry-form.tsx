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
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { DateEntryDraft, DailyEntryFormData, Hospital, ScanCatalog } from '@/lib/types';
import { formatCurrency, toInputDateFormat } from '@/lib/utils/formatting';

const schema = z.object({
  entry_date: z.string().min(1, 'Date is required'),
  hospital_id: z.string().min(1, 'Hospital is required'),
  notes: z.string().optional().default(''),
  use_manual_override: z.boolean().default(false),
  manual_total_revenue: z.number().min(0).nullable(),
  manual_override_reason: z.string().default(''),
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
  hospitals: Hospital[];
  selectedHospitalId: string;
  draft: DateEntryDraft | null;
  onDateChange: (date: string) => Promise<void>;
  onHospitalChange: (hospitalId: string) => Promise<void>;
  onCopyPreviousDay: () => Promise<void>;
  onSubmit: (data: DailyEntryFormData) => Promise<void>;
  isSaving?: boolean;
  isLoadingDate?: boolean;
}

const buildDefaults = (scanCatalog: ScanCatalog[], draft: DateEntryDraft | null, selectedHospitalId: string): FormValues => ({
  entry_date: draft?.entry_date || toInputDateFormat(new Date()),
  hospital_id: draft?.hospital_id || selectedHospitalId,
  notes: draft?.notes || '',
  use_manual_override: Boolean(draft?.is_manual_override),
  manual_total_revenue: draft ? Number(draft.final_total_revenue) : null,
  manual_override_reason: draft?.manual_override_reason || '',
  items: scanCatalog.map((scan) => ({
    scan_catalog_id: scan.id,
    quantity: draft?.lines.find((line) => line.scan_catalog_id === scan.id)?.quantity || 0,
  })),
});

export function DailyEntryForm({
  scanCatalog,
  hospitals,
  selectedHospitalId,
  draft,
  onDateChange,
  onHospitalChange,
  onCopyPreviousDay,
  onSubmit,
  isSaving = false,
  isLoadingDate = false,
}: DailyEntryFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: buildDefaults(scanCatalog, draft, selectedHospitalId),
  });

  useEffect(() => {
    form.reset(buildDefaults(scanCatalog, draft, selectedHospitalId));
  }, [draft, scanCatalog, selectedHospitalId, form]);

  const watchedItems = form.watch('items');
  const useManual = form.watch('use_manual_override');
  const manualTotal = form.watch('manual_total_revenue');
  const lineMap = useMemo(
    () => new Map((draft?.lines || []).map((line) => [line.scan_catalog_id, { unit_price: line.unit_price, missing_price: line.missing_price }])),
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

  const onReset = () => form.reset(buildDefaults(scanCatalog, draft, selectedHospitalId));
  const hasMissingPrice = (draft?.lines || []).some((line) => line.missing_price);

  return (
    <Card className="border-slate-200 shadow-sm bg-white">
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900">Daily Scan Entry</h2>
            <p className="text-sm text-slate-600">{draft?.exists ? 'Existing entry loaded for selected date' : 'Enter quantities for each scan type'}</p>
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
          <form className="space-y-4" onSubmit={form.handleSubmit(async (values) => {
            await onSubmit({
              entry_date: values.entry_date,
              hospital_id: values.hospital_id,
              notes: values.notes || '',
              use_manual_override: values.use_manual_override,
              manual_total_revenue: values.use_manual_override ? Number(values.manual_total_revenue || 0) : null,
              manual_override_reason: values.manual_override_reason || '',
              items: values.items,
            });
          })}>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField control={form.control} name="entry_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} onChange={async (event) => { const date = event.target.value; field.onChange(date); if (date) await onDateChange(date); }} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="hospital_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Hospital</FormLabel>
                  <FormControl>
                    <select className="w-full h-10 rounded-md border border-input bg-background px-3" {...field} onChange={async (e) => { field.onChange(e.target.value); await onHospitalChange(e.target.value); }}>
                      {hospitals.map((hospital) => <option key={hospital.id} value={hospital.id}>{hospital.name}</option>)}
                    </select>
                  </FormControl>
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes (optional)</FormLabel>
                <FormControl>
                  <Textarea rows={2} placeholder="Optional day notes" {...field} />
                </FormControl>
              </FormItem>
            )} />

            <div className="space-y-2">
              {scanCatalog.map((scan, index) => {
                const unitPrice = lineMap.get(scan.id)?.unit_price || 0;
                const quantity = watchedItems[index]?.quantity || 0;
                return (
                  <div key={scan.id} className="rounded-lg border p-3 bg-white">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{scan.name}</p>
                      <p className="text-xs text-slate-500">{formatCurrency(unitPrice)}</p>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (
                        <div className="flex items-center gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => field.onChange(Math.max(0, Number(field.value || 0) - 1))}>-</Button>
                          <Input type="number" min="0" value={field.value} onChange={(event) => field.onChange(Math.max(0, Number(event.target.value) || 0))} className="w-20 text-center h-11" />
                          <Button type="button" variant="outline" size="sm" onClick={() => field.onChange(Math.max(0, Number(field.value || 0) + 1))}>+</Button>
                        </div>
                      )} />
                      <p className="font-semibold text-emerald-700 text-sm">{formatCurrency(quantity * unitPrice)}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-lg border border-teal-200 bg-teal-50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Use manual revenue override</span>
                <FormField control={form.control} name="use_manual_override" render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                )} />
              </div>
              {useManual && (
                <>
                  <FormField control={form.control} name="manual_total_revenue" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Final revenue amount</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" value={field.value ?? ''} onChange={(e) => field.onChange(Number(e.target.value) || 0)} />
                      </FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="manual_override_reason" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Override reason</FormLabel>
                      <FormControl>
                        <Input placeholder="Why are you overriding?" {...field} />
                      </FormControl>
                    </FormItem>
                  )} />
                </>
              )}
              <div className="text-sm text-slate-700">Calculated: {formatCurrency(totals.totalRevenue)} · Final: {formatCurrency(useManual ? Number(manualTotal || 0) : totals.totalRevenue)}</div>
            </div>

            <div className="sticky bottom-14 md:bottom-0 bg-white/95 backdrop-blur border-t border-slate-200 pt-3 flex items-center justify-between gap-2">
              <Button type="button" variant="outline" onClick={onCopyPreviousDay} disabled={isSaving || isLoadingDate}>Copy previous day</Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onReset} disabled={isSaving || isLoadingDate}>Reset</Button>
                <Button type="submit" disabled={isSaving || isLoadingDate} className="bg-indigo-600 hover:bg-indigo-700">
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {draft?.exists ? 'Update Entry' : 'Save Entry'}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </div>
    </Card>
  );
}
