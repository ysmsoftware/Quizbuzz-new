'use client';

import { useState } from 'react';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { useOrgAnalytics } from '@/lib/hooks/useOrgAnalytics';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export default function OrganizationAnalyticsPage() {
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });

  const { analytics, loading, exportCSV } = useOrgAnalytics('org-1');

  const chartConfig = {
    registrations: {
      label: 'Total Registrations',
      color: 'hsl(var(--chart-1))',
    },
    paid: {
      label: 'Paid',
      color: 'hsl(var(--chart-2))',
    },
    free: {
      label: 'Free',
      color: 'hsl(var(--chart-3))',
    },
    revenue: {
      label: 'Revenue',
      color: 'hsl(var(--chart-4))',
    },
  };

  const statusData = [
    { name: 'Live', value: analytics.contestsByStatus.live, fill: '#10b981' },
    { name: 'Upcoming', value: analytics.contestsByStatus.upcoming, fill: '#3b82f6' },
    { name: 'Ended', value: analytics.contestsByStatus.ended, fill: '#6b7280' },
    { name: 'Draft', value: analytics.contestsByStatus.draft, fill: '#f59e0b' },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Organization-wide performance metrics</p>
        </div>
        <Button onClick={() => exportCSV()} disabled={loading} className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Registrations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{analytics.totalRegistrations.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">{analytics.avgDailyRegistrations} avg/day</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">₹{(analytics.totalRevenue / 100000).toFixed(1)}L</div>
            <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Contests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{analytics.contestsByStatus.live}</div>
            <p className="text-xs text-muted-foreground mt-1">{analytics.contestsByStatus.upcoming} upcoming</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">68%</div>
            <p className="text-xs text-muted-foreground mt-1">Registered to Paid</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Participation Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Participation Over Time</CardTitle>
            <CardDescription>Daily registrations for the past 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig}>
              <AreaChart data={analytics.dailyMetrics}>
                <defs>
                  <linearGradient id="colorRegistrations" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-registrations)" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="var(--color-registrations)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="registrations" stroke="var(--color-registrations)" fillOpacity={1} fill="url(#colorRegistrations)" />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Revenue Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Over Time</CardTitle>
            <CardDescription>Daily revenue for the past 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig}>
              <BarChart data={analytics.dailyMetrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Contests by Status */}
        <Card>
          <CardHeader>
            <CardTitle>Contests by Status</CardTitle>
            <CardDescription>Current contest distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Top Contests */}
        <Card>
          <CardHeader>
            <CardTitle>Top Contests</CardTitle>
            <CardDescription>By participation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.topContests.map(contest => (
                <div key={contest.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{contest.title}</p>
                    <p className="text-sm text-muted-foreground">{contest.registrations} registrations</p>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{ width: `${(contest.participationRate / 100) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{contest.participationRate}% participation</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
