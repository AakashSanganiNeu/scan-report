'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { AuditLog } from '@/lib/types';
import { formatDateTime } from '@/lib/utils/formatting';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AuditHistoryTableProps {
  logs: AuditLog[];
  onFilterChange: (filter: {
    startDate?: string;
    endDate?: string;
    action?: 'CREATE' | 'UPDATE' | 'DELETE' | 'ALL';
    entityType?: 'daily_entry' | 'price' | 'ALL';
  }) => Promise<void>;
}

export function AuditHistoryTable({ logs, onFilterChange }: AuditHistoryTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [action, setAction] = useState<'CREATE' | 'UPDATE' | 'DELETE' | 'ALL'>('ALL');
  const [entityType, setEntityType] = useState<'daily_entry' | 'price' | 'ALL'>('ALL');

  const actionTone = useMemo(
    () => ({
      CREATE: 'bg-emerald-100 text-emerald-800',
      UPDATE: 'bg-indigo-100 text-indigo-800',
      DELETE: 'bg-rose-100 text-rose-800',
    }),
    []
  );

  const runFilter = async () => {
    await onFilterChange({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      action,
      entityType,
    });
  };

  return (
    <Card className="bg-white border-slate-200 shadow-sm">
      <div className="p-5 border-b border-slate-100 space-y-4">
        <div>
          <h3 className="font-semibold text-slate-900">Edit History / Audit Trail</h3>
          <p className="text-sm text-slate-600">Track create, update, and delete changes.</p>
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          <Select value={action} onValueChange={(value) => setAction(value as typeof action)}>
            <SelectTrigger>
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Actions</SelectItem>
              <SelectItem value="CREATE">CREATE</SelectItem>
              <SelectItem value="UPDATE">UPDATE</SelectItem>
              <SelectItem value="DELETE">DELETE</SelectItem>
            </SelectContent>
          </Select>
          <Select value={entityType} onValueChange={(value) => setEntityType(value as typeof entityType)}>
            <SelectTrigger>
              <SelectValue placeholder="Entity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Entities</SelectItem>
              <SelectItem value="daily_entry">daily_entry</SelectItem>
              <SelectItem value="price">price</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={runFilter} className="bg-indigo-600 hover:bg-indigo-700">
            Apply Filter
          </Button>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {logs.length === 0 && (
          <p className="p-6 text-sm text-slate-500 text-center">No audit logs found for selected filters.</p>
        )}

        {logs.map((log) => {
          const isOpen = expanded.has(log.id);
          return (
            <div key={log.id} className="p-4">
              <button
                type="button"
                onClick={() => {
                  const next = new Set(expanded);
                  if (next.has(log.id)) next.delete(log.id);
                  else next.add(log.id);
                  setExpanded(next);
                }}
                className="w-full flex items-start justify-between gap-3 text-left"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded ${actionTone[log.action]}`}>
                      {log.action}
                    </span>
                    <span className="text-xs text-slate-500">{log.entity_type}</span>
                    <span className="text-xs text-slate-500">{formatDateTime(log.created_at)}</span>
                  </div>
                  <p className="text-sm text-slate-900">{log.change_summary || '-'}</p>
                  <p className="text-xs text-slate-500">Reference: {log.entity_label || log.entity_id || '-'}</p>
                </div>
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {isOpen && (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border border-slate-200 p-3 bg-slate-50">
                    <p className="text-xs font-semibold text-slate-600 mb-2">Before</p>
                    <pre className="text-xs whitespace-pre-wrap break-all">
                      {JSON.stringify(log.before_data, null, 2) || 'null'}
                    </pre>
                  </div>
                  <div className="rounded-md border border-slate-200 p-3 bg-slate-50">
                    <p className="text-xs font-semibold text-slate-600 mb-2">After</p>
                    <pre className="text-xs whitespace-pre-wrap break-all">
                      {JSON.stringify(log.after_data, null, 2) || 'null'}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
