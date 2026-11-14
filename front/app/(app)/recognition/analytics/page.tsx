'use client';

import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import { BarChart3, TrendingUp, CheckCircle2, Scan, Activity, Camera } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ALPR_API_BASE } from '@/src/services/alpr-api';

const hourlyData = [
  { hour: '06:00', total: 12, accepted: 11, unknown: 1 },
  { hour: '07:00', total: 28, accepted: 26, unknown: 2 },
  { hour: '08:00', total: 45, accepted: 42, unknown: 3 },
  { hour: '09:00', total: 38, accepted: 35, unknown: 3 },
  { hour: '10:00', total: 30, accepted: 29, unknown: 1 },
  { hour: '11:00', total: 22, accepted: 21, unknown: 1 },
  { hour: '12:00', total: 18, accepted: 18, unknown: 0 },
];

const checkinTypeData = [
  { name: 'AUTO_RECOGNIZED (ALPR)', value: 78, color: '#10B981' },
  { name: 'MANUAL (Fallback)', value: 16, color: '#3B82F6' },
  { name: 'VIOLATION', value: 6, color: '#EF4444' },
];

export default function ALPRAnalyticsPage() {
  const [stats, setStats] = useState<any>({ totalEvents: 193, accuracyRate: 97.4, acceptedCount: 182, unknownCount: 11 });

  useEffect(() => {
    fetch(`${ALPR_API_BASE}/recognition/stats`)
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch((e) => console.error(e));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ALPR System Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Performance metrics, recognition accuracy rates, and queue creation breakdown.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Recognition Accuracy</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{stats.accuracyRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">+1.2% over target threshold</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Auto vs Manual Queue Split</CardTitle>
            <Activity className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sky-600">82.5% Auto</div>
            <p className="text-xs text-muted-foreground mt-1">17.5% Manual Dispatcher fallback</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Average Processing Latency</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">140 ms</div>
            <p className="text-xs text-muted-foreground mt-1">From camera capture to NestJS queue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Camera Uptime</CardTitle>
            <Camera className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">100%</div>
            <p className="text-xs text-muted-foreground mt-1">All terminal cameras healthy</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Hourly Volume Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" /> Hourly Plate Recognition Volume
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="accepted" fill="#10B981" name="Accepted Plates" radius={[4, 4, 0, 0]} />
                <Bar dataKey="unknown" fill="#F59E0B" name="Unknown Plates" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Queue Entry Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" /> Queue Creation Mechanism Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={checkinTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`}
                >
                  {checkinTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
