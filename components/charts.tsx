'use client';

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '@/components/ui/card';
import { DailyStats, MonthlySummary } from '@/lib/types';
import { formatCurrency } from '@/lib/utils/formatting';

interface RevenueChartProps {
  data: DailyStats[];
  isLoading?: boolean;
}

export function RevenueChart({ data, isLoading = false }: RevenueChartProps) {
  if (isLoading) {
    return (
      <Card className="p-6 border-0 shadow-sm bg-white">
        <p className="text-gray-500 text-center">Loading chart...</p>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="p-6 border-0 shadow-sm bg-white">
        <p className="text-gray-500 text-center">No data available</p>
      </Card>
    );
  }

  const chartData = data.map((item) => ({
    date: new Date(item.date).toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
    }),
    revenue: item.total_revenue,
    scans: item.total_scans,
  }));

  return (
    <Card className="p-6 border-0 shadow-sm bg-white">
      <h3 className="text-lg font-semibold mb-4 text-gray-900">
        Daily Revenue Trend
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
            formatter={(value: any) => formatCurrency(value)}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#1e40af"
            strokeWidth={2}
            dot={{ fill: '#1e40af', r: 4 }}
            activeDot={{ r: 6 }}
            name="Revenue (INR)"
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}

interface ScanTypeChartProps {
  summary: MonthlySummary | null;
  isLoading?: boolean;
}

export function ScanTypeChart({ summary, isLoading = false }: ScanTypeChartProps) {
  if (isLoading) {
    return (
      <Card className="p-6 border-0 shadow-sm bg-white">
        <p className="text-gray-500 text-center">Loading chart...</p>
      </Card>
    );
  }

  if (!summary || summary.items.length === 0) {
    return (
      <Card className="p-6 border-0 shadow-sm bg-white">
        <p className="text-gray-500 text-center">No data available</p>
      </Card>
    );
  }

  // Get top 8 scan types by revenue
  const chartData = summary.items.slice(0, 8).map((item) => ({
    name: item.scan_name.split('(')[0].trim(),
    revenue: item.total_revenue,
    quantity: item.total_quantity,
  }));

  return (
    <Card className="p-6 border-0 shadow-sm bg-white">
      <h3 className="text-lg font-semibold mb-4 text-gray-900">
        Top Scan Types by Revenue
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="name"
            angle={-45}
            textAnchor="end"
            height={100}
            interval={0}
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
            formatter={(value: any) => formatCurrency(value)}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Bar
            dataKey="revenue"
            fill="#06b6d4"
            name="Revenue (INR)"
            radius={[8, 8, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

interface ScansPerDayChartProps {
  data: DailyStats[];
  isLoading?: boolean;
}

export function ScansPerDayChart({ data, isLoading = false }: ScansPerDayChartProps) {
  if (isLoading) {
    return (
      <Card className="p-6 border-0 shadow-sm bg-white">
        <p className="text-gray-500 text-center">Loading chart...</p>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="p-6 border-0 shadow-sm bg-white">
        <p className="text-gray-500 text-center">No data available</p>
      </Card>
    );
  }

  const chartData = data.map((item) => ({
    date: new Date(item.date).toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
    }),
    scans: item.total_scans,
  }));

  return (
    <Card className="p-6 border-0 shadow-sm bg-white">
      <h3 className="text-lg font-semibold mb-4 text-gray-900">
        Daily Scan Count
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
          />
          <Bar
            dataKey="scans"
            fill="#0f766e"
            name="Scans"
            radius={[8, 8, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
