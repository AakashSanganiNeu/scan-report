'use client';

import Link from 'next/link';
import { Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DailyEntryWithItems, MonthlySummary } from '@/lib/types';
import { exportDailyEntriesCSV, exportMonthlySummaryCSV } from '@/lib/csv';

interface ExportMenuProps {
  entries: DailyEntryWithItems[];
  summary: MonthlySummary;
  monthLabel: string;
  monthKey: string;
  hospitalLabel: string;
}

export function ExportMenu({ entries, summary, monthLabel, monthKey, hospitalLabel }: ExportMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 border-indigo-200"><Download className="h-4 w-4" />Export</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportDailyEntriesCSV(entries, monthLabel, hospitalLabel)}>Daily Entries CSV</DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportMonthlySummaryCSV(summary, hospitalLabel)}>Monthly Summary CSV</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/report/${monthKey}?hospital=${encodeURIComponent(hospitalLabel)}`} target="_blank" className="flex items-center gap-2"><FileText className="h-4 w-4" />Print-Friendly Report</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
