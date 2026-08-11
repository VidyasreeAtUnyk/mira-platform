/**
 * PriceIndexChart — Recharts line chart of DLD price index over time
 */

'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { DLDPriceIndex } from '@/types';

interface PriceIndexChartProps {
  data: DLDPriceIndex[];
}

export function PriceIndexChart({ data }: PriceIndexChartProps) {
  const chartData = data.map((row) => ({
    date: format(parseISO(row.first_date_of_month), 'MMM yy'),
    Apartments: row.flat_monthly_index ? Math.round(Number(row.flat_monthly_index) * 10) / 10 : null,
    Villas: row.villa_monthly_index ? Math.round(Number(row.villa_monthly_index) * 10) / 10 : null,
    All: row.all_monthly_index ? Math.round(Number(row.all_monthly_index) * 10) / 10 : null,
  }));

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No price index data available.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <BarChart2 className="h-4 w-4 text-primary" />
          Dubai Price Index (Base: Jan 2019 = 100)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              interval={3}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                fontSize: '12px',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            <Line
              type="monotone"
              dataKey="Apartments"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="Villas"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
