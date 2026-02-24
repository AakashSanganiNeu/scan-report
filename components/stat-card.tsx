'use client';

import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/formatting';
import { Loader2 } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  currency?: boolean;
  loading?: boolean;
}

export function StatCard({
  label,
  value,
  currency = false,
  loading = false,
}: StatCardProps) {
  return (
    <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-50 border-blue-100">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-gray-600">{label}</p>
        {loading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          </div>
        ) : (
          <p className="text-2xl font-bold text-blue-900">
            {currency ? formatCurrency(Number(value)) : value}
          </p>
        )}
      </div>
    </Card>
  );
}
