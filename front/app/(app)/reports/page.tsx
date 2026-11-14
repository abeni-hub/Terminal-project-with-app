'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/src/services/api';
import { PageHeader } from '@/src/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from 'recharts';
import {
  FileText, FileSpreadsheet, FileDown, DollarSign, TrendingUp, Building2,
  Route as RouteIcon, UserCog, ShieldAlert, CheckCircle2, Clock, Truck,
  Calendar, CheckCircle, AlertTriangle, ArrowUpRight,
} from 'lucide-react';
import { toast } from 'sonner';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('dispatches');
  const [terminalFilter, setTerminalFilter] = useState('ALL');

  const { data: dashboardData } = useQuery<import('@/src/types/dashboard').DashboardData>({
    queryKey: ['dashboard'],
    queryFn: api.dashboard.get,
  });

  const { data: dispatchRecords } = useQuery<import('@/src/services/http').PaginatedResponse<import('@/src/types/operations').DispatchRecord>>({
    queryKey: ['dispatch-records-all'],
    queryFn: () => api.dispatchRecords.list({ page: 1, pageSize: 200 }),
  });

  const { data: violationsData } = useQuery({
    queryKey: ['violations-all'],
    queryFn: () => api.violations.list({ page: 1, pageSize: 200 }),
  });

  const { data: terminalsData } = useQuery({
    queryKey: ['terminals-list'],
    queryFn: () => api.terminals.list({ page: 1, pageSize: 50 }),
  });

  const rawRecords = dispatchRecords?.data ?? [];
  const rawViolations = violationsData?.data ?? [];
  const terminals = terminalsData?.data ?? [];

  // Filtered by terminal if selected
  const records = useMemo(() => {
    if (terminalFilter === 'ALL') return rawRecords;
    return rawRecords.filter((r: any) => r.originTerminalId === terminalFilter || r.originTerminalName?.includes(terminalFilter));
  }, [rawRecords, terminalFilter]);

  const violations = useMemo(() => {
    if (terminalFilter === 'ALL') return rawViolations;
    return rawViolations.filter((v: any) => v.terminalId === terminalFilter || v.reportedBy?.includes(terminalFilter));
  }, [rawViolations, terminalFilter]);

  // Financial Calculations
  const totalRevenue = useMemo(() => records.reduce((sum: number, r: any) => sum + (r.feeAmount || 0), 0), [records]);
  const paidRevenue = useMemo(() => records.filter((r: any) => r.paymentStatus === 'PAID').reduce((sum: number, r: any) => sum + (r.feeAmount || 0), 0), [records]);
  const pendingRevenue = useMemo(() => records.filter((r: any) => r.paymentStatus !== 'PAID').reduce((sum: number, r: any) => sum + (r.feeAmount || 0), 0), [records]);

  // Revenue by Terminal
  const revenueByTerminal = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach((r: any) => {
      const term = r.originTerminalName || 'Unknown';
      map.set(term, (map.get(term) || 0) + (r.feeAmount || 0));
    });
    return Array.from(map.entries()).map(([terminal, revenue]) => ({ terminal, revenue }));
  }, [records]);

  // Revenue by Route
  const revenueByRoute = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach((r: any) => {
      const route = `${r.originTerminalName || ''} → ${r.destinationTerminalName || ''}`;
      map.set(route, (map.get(route) || 0) + (r.feeAmount || 0));
    });
    return Array.from(map.entries()).map(([route, revenue]) => ({ route, revenue }));
  }, [records]);

  // Revenue by Dispatcher
  const revenueByDispatcher = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach((r: any) => {
      const d = r.dispatcherName || 'System';
      map.set(d, (map.get(d) || 0) + (r.feeAmount || 0));
    });
    return Array.from(map.entries()).map(([dispatcher, revenue]) => ({ dispatcher, revenue }));
  }, [records]);

  // Violations Breakdown
  const violationsByType = useMemo(() => {
    const map = new Map<string, number>();
    violations.forEach((v: any) => {
      const type = v.type === 'WRONG_TERMINAL_ENTRY' ? 'Wrong Terminal'
        : v.type === 'UNASSIGNED_VEHICLE_ENTRY' ? 'Unassigned Vehicle'
        : v.type;
      map.set(type, (map.get(type) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [violations]);

  // Export handlers
  const handleExportCSV = () => {
    try {
      let csvContent = '';
      if (activeTab === 'dispatches' || activeTab === 'revenue') {
        const headers = ['AuditRef', 'PlateNumber', 'OriginTerminal', 'DestinationTerminal', 'Dispatcher', 'FeeAmount', 'PaymentStatus', 'DispatchTime'];
        const rows = records.map((r: any) => [
          r.auditRef || r.id,
          r.plateNumber,
          r.originTerminalName,
          r.destinationTerminalName,
          r.dispatcherName,
          r.feeAmount,
          r.paymentStatus || 'PENDING',
          new Date(r.dispatchTime).toISOString(),
        ]);
        csvContent = [headers.join(','), ...rows.map((e: any[]) => e.join(','))].join('\n');
      } else {
        const headers = ['ID', 'PlateNumber', 'Type', 'Severity', 'Status', 'ReportedBy', 'ReportedAt', 'Resolution'];
        const rows = violations.map((v: any) => [
          v.id,
          v.plateNumber,
          v.type,
          v.severity,
          v.status,
          v.reportedBy,
          new Date(v.reportedAt).toISOString(),
          `"${(v.resolution || '').replace(/"/g, '""')}"`,
        ]);
        csvContent = [headers.join(','), ...rows.map((e: any[]) => e.join(','))].join('\n');
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `terminal_report_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('CSV Report downloaded successfully');
    } catch (e) {
      toast.error('Failed to export CSV');
    }
  };

  const handleExportJSON = () => {
    try {
      const dataToExport = activeTab === 'compliance' ? violations : records;
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `terminal_report_${activeTab}_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('JSON Report downloaded successfully');
    } catch (e) {
      toast.error('Failed to export JSON');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Terminal Operations & Revenue Reports"
        description="Comprehensive analytics on weekly roster compliance, daily dispatches, gate throughput, and fee collections"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-emerald-600" /> Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportJSON}>
              <FileDown className="mr-1.5 h-3.5 w-3.5 text-primary" /> Export JSON
            </Button>
          </div>
        }
      />

      {/* Terminal Filter Bar */}
      <Card className="p-3 border shadow-sm">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold">Filter Terminal:</span>
            <Select value={terminalFilter} onValueChange={setTerminalFilter}>
              <SelectTrigger className="h-8 w-56 text-xs">
                <SelectValue placeholder="All Terminals" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Operational Terminals</SelectItem>
                {terminals.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="text-xs text-muted-foreground">
            Showing records for <strong>{terminalFilter === 'ALL' ? 'All Terminals' : terminals.find((t: any) => t.id === terminalFilter)?.name || terminalFilter}</strong>
          </div>
        </div>
      </Card>

      {/* Executive KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Fees Assessed</p>
              <p className="text-2xl font-bold mt-1">{totalRevenue.toLocaleString()} ETB</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border shadow-sm border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Paid & Verified Revenue</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{paidRevenue.toLocaleString()} ETB</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Trips Dispatched</p>
              <p className="text-2xl font-bold mt-1">{records.length}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              <Truck className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border shadow-sm border-amber-500/20 bg-amber-500/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Gate Violations Logged</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{violations.length}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/80 p-1">
          <TabsTrigger value="dispatches" className="text-xs">
            <Truck className="mr-1.5 h-3.5 w-3.5" /> Dispatches & Trips
          </TabsTrigger>
          <TabsTrigger value="revenue" className="text-xs">
            <DollarSign className="mr-1.5 h-3.5 w-3.5" /> Revenue & Collections
          </TabsTrigger>
          <TabsTrigger value="compliance" className="text-xs">
            <ShieldAlert className="mr-1.5 h-3.5 w-3.5" /> Roster Compliance & Violations
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab 1: Dispatches ─── */}
        <TabsContent value="dispatches" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <RouteIcon className="h-4 w-4 text-primary" /> Dispatches by Route
                </CardTitle>
                <CardDescription className="text-xs">Total volume of trips dispatched across active weekly routes</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={revenueByRoute} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis type="category" dataKey="route" stroke="hsl(var(--muted-foreground))" fontSize={10} width={130} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="revenue" name="Volume (ETB)" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-emerald-500" /> Terminal Dispatch Output
                </CardTitle>
                <CardDescription className="text-xs">Trips and operations initiated per origin terminal</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={revenueByTerminal}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="terminal" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="revenue" name="Total (ETB)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Authoritative Dispatch Records Audit</CardTitle>
              <CardDescription className="text-xs">Recent vehicle departures with timestamps, dispatcher authorization, and fee audit references</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Plate Number</TableHead>
                      <TableHead className="text-xs">Route</TableHead>
                      <TableHead className="text-xs">Dispatcher</TableHead>
                      <TableHead className="text-xs">Fee Amount</TableHead>
                      <TableHead className="text-xs">Payment</TableHead>
                      <TableHead className="text-xs">Audit Ref</TableHead>
                      <TableHead className="text-xs">Dispatch Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.slice(0, 15).map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs font-bold">{r.plateNumber}</TableCell>
                        <TableCell className="text-xs">{r.originTerminalName} → {r.destinationTerminalName}</TableCell>
                        <TableCell className="text-xs">{r.dispatcherName}</TableCell>
                        <TableCell className="text-xs font-semibold">{r.feeAmount} ETB</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={r.paymentStatus === 'PAID' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 text-[10px]' : 'border-amber-500/40 text-amber-600 text-[10px]'}>
                            {r.paymentStatus || 'PENDING'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-[10px] text-muted-foreground">{r.auditRef}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(r.dispatchTime).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {records.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                          No dispatch records found for the selected terminal filter.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab 2: Revenue ─── */}
        <TabsContent value="revenue" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <UserCog className="h-4 w-4 text-primary" /> Collections by Dispatcher
                </CardTitle>
                <CardDescription className="text-xs">Total terminal dispatch fees collected per active dispatcher</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={revenueByDispatcher}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="dispatcher" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="revenue" name="Fee Revenue (ETB)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" /> Revenue Timeline Trend
                </CardTitle>
                <CardDescription className="text-xs">Daily dispatch revenue volume</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={dashboardData?.dispatchTrend ?? []}>
                    <defs>
                      <linearGradient id="revGrad2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fill="url(#revGrad2)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Tab 3: Compliance & Violations ─── */}
        <TabsContent value="compliance" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-500" /> Gate Violation Categories
                </CardTitle>
                <CardDescription className="text-xs">Proportion of wrong-terminal entries vs unassigned vehicle scans</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[260px] flex items-center justify-center">
                  {violationsByType.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={violationsByType}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={4}
                          dataKey="value"
                          label={({ name, percent }: any) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                        >
                          {violationsByType.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-xs text-muted-foreground flex flex-col items-center">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-1" />
                      100% Roster Compliance — No violations recorded.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Weekly Roster Enforcement Health</CardTitle>
                <CardDescription className="text-xs">Summary of ANPR gate validation outcomes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-2 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded bg-muted/30 border">
                  <span>Total Monitored Gate Events</span>
                  <span className="font-bold">{records.length + violations.length}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                  <span>Valid Roster Admissions</span>
                  <span className="font-bold">{records.length}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300">
                  <span>Gate Mismatches & Overrides</span>
                  <span className="font-bold">{violations.length}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Recent Gate Violations & Resolutions</CardTitle>
              <CardDescription className="text-xs">Log of automated alerts and supervisor interventions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Plate Number</TableHead>
                      <TableHead className="text-xs">Violation Type</TableHead>
                      <TableHead className="text-xs">Severity</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Gate / Reporter</TableHead>
                      <TableHead className="text-xs">Resolution Remark</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {violations.slice(0, 10).map((v: any) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono text-xs font-bold">{v.plateNumber}</TableCell>
                        <TableCell className="text-xs">{v.type}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{v.severity}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={v.status === 'RESOLVED' ? 'border-emerald-500/40 text-emerald-600 text-[10px]' : 'border-amber-500/40 text-amber-600 text-[10px]'}>
                            {v.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{v.reportedBy}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{v.resolution || v.remark || 'Pending'}</TableCell>
                      </TableRow>
                    ))}
                    {violations.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-xs text-muted-foreground">
                          No violations found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
