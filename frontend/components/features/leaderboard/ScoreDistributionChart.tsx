'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ScoreDistributionChartProps {
  data: Record<string, number>;
}

/**
 * High-fidelity bar chart for performance distribution analysis.
 * Standardized for use within Dashboard Cards and Error Boundaries.
 */
export function ScoreDistributionChart({ data }: ScoreDistributionChartProps) {
  const chartData = Object.entries(data).map(([range, count]) => ({
    range,
    count
  }));

  return (
    <div className="h-[300px] w-full animate-in fade-in duration-700">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
        >
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" opacity={0.5} />
          <XAxis 
            dataKey="range" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fontWeight: 700, fill: 'hsl(var(--muted-foreground))' }}
            dy={10}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fontWeight: 700, fill: 'hsl(var(--muted-foreground))' }}
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--secondary))', opacity: 0.4 }}
            contentStyle={{ 
              backgroundColor: 'hsl(var(--background))', 
              borderColor: 'hsl(var(--border))',
              borderRadius: '1rem',
              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
              border: '1px solid hsl(var(--border))',
              padding: '12px'
            }}
            labelStyle={{ fontWeight: 900, marginBottom: '4px', color: 'hsl(var(--primary))', fontSize: '12px' }}
            itemStyle={{ fontSize: '11px', fontWeight: 600 }}
            formatter={(value: number) => [`${value} Participants`, 'Count']}
          />
          <Bar
            dataKey="count"
            fill="hsl(var(--primary))"
            radius={[6, 6, 0, 0]}
            barSize={40}
            animationDuration={1500}
            animationBegin={200}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
