'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/src/services/api';
import { useAuthStore } from '@/src/store/auth-store';
import { PageHeader } from '@/src/components/PageHeader';
import { StatCard } from '@/src/components/StatCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatusBadge } from '@/src/components/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton, ErrorState } from '@/src/components/states';
import {
  Bus, Send, Route as RouteIcon, Building2, UserCog, AlertTriangle,
  Smartphone, RefreshCw, TrendingUp, Clock, Activity, CalendarDays, DollarSign,
  ListOrdered, CheckCircle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';

const CHART_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function DashboardPage() {
  const session = useAuthStore((s) => s.session);
  const isDispatcher = session?.role.name === 'DISPATCHER';

  if (isDispatcher && session) {
    return <DispatcherDashboard userId={session.user.id} />;
  }
  return <AdminDashboard />;
}

function AdminDashboard() {
  const { data, isLoading, isError, refetch } = useQuery<import('@/src/types/dashboard').DashboardData>({
    queryKey: ['dashboard'],
    queryFn: api.dashboard.get,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Loading operational overview..." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <LoadingSkeleton key={i} rows={1} />)}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Operational overview" />
        <ErrorState message="Failed to load dashboard data." onRetry={refetch} />
      </div>
    );
  }

  const cards = [
    { label: 'Vehicles in Queue', value: data.stats.vehiclesInQueue, icon: Bus, variant: 'default' as const, trend: { value: 8, positive: true } },
    { label: 'Dispatched Today', value: data.stats.vehiclesDispatchedToday, icon: Send, variant: 'success' as const, trend: { value: 12, positive: true } },
    { label: 'Active Assignments', value: data.stats.activeAssignments, icon: CalendarDays, variant: 'info' as const },
    { label: 'Active Routes', value: data.stats.activeRoutes, icon: RouteIcon, variant: 'default' as const },
    { label: 'Active Terminals', value: data.stats.activeTerminals, icon: Building2, variant: 'default' as const },
    { label: 'Active Dispatchers', value: data.stats.activeDispatchers, icon: UserCog, variant: 'info' as const },
    { label: 'Violations Today', value: data.stats.violationsToday, icon: AlertTriangle, variant: 'warning' as const, trend: { value: 3, positive: false } },
    { label: 'Revenue Today', value: `${data.stats.dispatchRevenueToday} ETB`, icon: DollarSign, variant: 'success' as const },
    { label: 'Offline Devices', value: data.stats.offlineDevices, icon: Smartphone, variant: 'danger' as const },
    { label: 'Pending Sync', value: data.stats.pendingSyncActions, icon: RefreshCw, variant: 'warning' as const },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Real-time operational overview of the Addis Ababa transport network" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4 text-primary" /> Dispatch Trend</CardTitle>
            <CardDescription>Vehicles dispatched over the past 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data.dispatchTrend}>
                <defs>
                  <linearGradient id="dispatchGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS[0]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="value" stroke={CHART_COLORS[0]} strokeWidth={2} fill="url(#dispatchGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4 text-info" /> Queue Trend</CardTitle>
            <CardDescription>Average queue length over the past 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data.queueTrend}>
                <defs>
                  <linearGradient id="queueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS[4]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS[4]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="value" stroke={CHART_COLORS[4]} strokeWidth={2} fill="url(#queueGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-warning" /> Violations by Route</CardTitle>
            <CardDescription>Distribution of violations across active routes</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.violationsByRoute} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis type="category" dataKey="route" stroke="hsl(var(--muted-foreground))" fontSize={11} width={120} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill={CHART_COLORS[3]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4 text-success" /> Terminal Utilization</CardTitle>
            <CardDescription>Current capacity usage by terminal</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={data.terminalUtilization} dataKey="utilization" nameKey="terminal" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                  {data.terminalUtilization.map((_: unknown, i: number) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily Activity</CardTitle>
          <CardDescription>Total operational events over the past week</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.dailyActivity}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="value" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <RecentDispatchesTable />
        <RecentViolationsTable data={data.recentViolations} />
        <RecentAuditLogsTable data={data.recentAuditLogs} />
        <RecentOverridesTable data={data.recentOverrides} />
      </div>
    </div>
  );
}

function RecentDispatchesTable() {
  const [page, setPage] = useState(1);
  const pageSize = 5;
  const { data } = useQuery<import('@/src/types/dashboard').DashboardData>({ queryKey: ['dashboard'], queryFn: api.dashboard.get });
  const dispatches = data?.recentDispatches ?? [];
  const total = dispatches.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paginatedDispatches = dispatches.slice((page - 1) * pageSize, page * pageSize);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base">Recent Dispatches</CardTitle>
          <CardDescription>Latest vehicle dispatches across terminals</CardDescription>
        </div>
        <Badge variant="outline" className="font-mono text-xs">
          {total} Total
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {total === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No recent dispatches</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plate</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Dispatcher</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedDispatches.map((d: import('@/src/types/dashboard').RecentDispatch) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">{d.plateNumber}</TableCell>
                    <TableCell className="text-xs">{d.route}</TableCell>
                    <TableCell className="text-xs">{d.dispatcher}</TableCell>
                    <TableCell><StatusBadge label={d.status} variant="info" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                <span>
                  Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} of {total}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                  >
                    <ChevronsLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="px-2 font-medium text-foreground">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                  >
                    <ChevronsRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RecentViolationsTable({ data }: { data: import('@/src/types/operations').Violation[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Violations</CardTitle>
        <CardDescription>Latest reported violations</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plate</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((v: import('@/src/types/operations').Violation) => (
              <TableRow key={v.id}>
                <TableCell className="font-mono text-xs">{v.plateNumber}</TableCell>
                <TableCell className="text-xs">{v.type}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={
                    v.severity === 'CRITICAL' ? 'border-destructive/20 bg-destructive/10 text-destructive' :
                    v.severity === 'HIGH' ? 'border-warning/20 bg-warning/10 text-warning' :
                    v.severity === 'MEDIUM' ? 'border-info/20 bg-info/10 text-info' :
                    'border-border bg-muted text-muted-foreground'
                  }>{v.severity}</Badge>
                </TableCell>
                <TableCell><StatusBadge label={v.status} variant={v.status === 'RESOLVED' ? 'success' : v.status === 'OPEN' ? 'warning' : 'muted'} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RecentAuditLogsTable({ data }: { data: import('@/src/types/operations').AuditLog[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Audit Logs</CardTitle>
        <CardDescription>Latest system activity</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((a: import('@/src/types/operations').AuditLog) => (
              <TableRow key={a.id}>
                <TableCell className="text-xs">{a.actor}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{a.action}</Badge></TableCell>
                <TableCell className="text-xs">{a.entity}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RecentOverridesTable({ data }: { data: import('@/src/types/operations').Override[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Overrides</CardTitle>
        <CardDescription>Latest supervisor override requests</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Requested By</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((o: import('@/src/types/operations').Override) => (
              <TableRow key={o.id}>
                <TableCell className="text-xs">{o.requestedBy}</TableCell>
                <TableCell className="text-xs">{o.action}</TableCell>
                <TableCell><StatusBadge label={o.status} variant={o.status === 'APPROVED' ? 'success' : o.status === 'PENDING' ? 'warning' : 'danger'} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function DispatcherDashboard({ userId }: { userId: string }) {
  const router = useRouter();
  const [historyPage, setHistoryPage] = useState(1);
  const historyPageSize = 5;

  const { data, isLoading, isError, refetch } = useQuery<import('@/src/types/dashboard').DispatcherDashboardData>({
    queryKey: ['dispatcher-dashboard', userId],
    queryFn: () => api.dashboard.getDispatcher(userId),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dispatcher Dashboard" description="Loading your assignments..." />
        <LoadingSkeleton rows={5} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dispatcher Dashboard" description="Your operational overview" />
        <ErrorState message="Failed to load dashboard data." onRetry={refetch} />
      </div>
    );
  }

  const totalHistory = data.recentDispatchHistory.length;
  const totalHistoryPages = Math.max(1, Math.ceil(totalHistory / historyPageSize));
  const paginatedHistory = data.recentDispatchHistory.slice(
    (historyPage - 1) * historyPageSize,
    historyPage * historyPageSize
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dispatcher Dashboard"
        description={`Welcome - you are assigned to ${data.assignedTerminal}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/queue')}><ListOrdered className="mr-2 h-4 w-4" /> View Queue</Button>
            <Button onClick={() => router.push('/queue')}><CheckCircle className="mr-2 h-4 w-4" /> Check In Vehicle</Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Vehicles Waiting" value={data.vehiclesWaiting} icon={Bus} variant="info" />
        <StatCard label="Dispatched Today" value={data.vehiclesDispatchedToday} icon={Send} variant="success" />
        <StatCard label="Revenue Today" value={`${data.dispatchRevenueToday} ETB`} icon={DollarSign} variant="success" />
        <StatCard label="Revenue This Week" value={`${data.dispatchRevenueWeek} ETB`} icon={DollarSign} variant="default" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4 text-primary" /> Today's Assignments</CardTitle>
            <CardDescription>Your active weekly route assignments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.todayAssignments.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No assignments for today</p>
            ) : (
              data.todayAssignments.map((a: import('@/src/types/dashboard').DispatcherAssignmentInfo) => (
                <div key={a.assignmentId} className="flex items-center justify-between rounded-md border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">{a.route}</p>
                    <p className="text-xs text-muted-foreground">Group: {a.vehicleGroup}</p>
                  </div>
                  <Badge variant="outline" className="border-success/20 bg-success/10 text-success">Active</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><ListOrdered className="h-4 w-4 text-info" /> Live Queue</CardTitle>
            <CardDescription>Vehicles currently waiting in your queues</CardDescription>
          </CardHeader>
          <CardContent>
            {data.liveQueue.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No vehicles in queue</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Position</TableHead>
                    <TableHead>Plate</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.liveQueue.map((q: { position: number; plateNumber: string; status: string }, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs font-bold">#{q.position}</TableCell>
                      <TableCell className="font-mono text-xs">{q.plateNumber}</TableCell>
                      <TableCell><StatusBadge label={q.status} variant="info" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4 text-primary" /> Assigned Terminal & Routes</CardTitle>
            <CardDescription>Your terminal and route assignments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Terminal</p>
              <p className="text-sm font-medium">{data.assignedTerminal}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Routes</p>
              <div className="flex flex-wrap gap-2">
                {data.assignedRoutes.map((r: string, i: number) => <Badge key={i} variant="outline" className="text-xs">{r}</Badge>)}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vehicle Groups</p>
              <div className="flex flex-wrap gap-2">
                {data.assignedVehicleGroups.map((g: string, i: number) => <Badge key={i} variant="outline" className="text-xs">{g}</Badge>)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><DollarSign className="h-4 w-4 text-success" /> Dispatch Revenue</CardTitle>
            <CardDescription>Revenue trend over the past week</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data.dispatchRevenue.trend}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS[1]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS[1]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke={CHART_COLORS[1]} strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">Recent Dispatch History</CardTitle>
            <CardDescription>Your latest dispatch actions</CardDescription>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {totalHistory} Total
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {totalHistory === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No dispatch history yet</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plate</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Fee</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedHistory.map((d: import('@/src/types/operations').DispatchRecord) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-xs">{d.plateNumber}</TableCell>
                      <TableCell className="text-xs">{d.originTerminalName} - {d.destinationTerminalName}</TableCell>
                      <TableCell className="text-xs">{d.feeAmount} ETB</TableCell>
                      <TableCell className="text-xs">{new Date(d.dispatchTime).toLocaleTimeString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalHistoryPages > 1 && (
                <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                  <span>
                    Showing {((historyPage - 1) * historyPageSize) + 1}–{Math.min(historyPage * historyPageSize, totalHistory)} of {totalHistory}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setHistoryPage(1)}
                      disabled={historyPage === 1}
                    >
                      <ChevronsLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                      disabled={historyPage === 1}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="px-2 font-medium text-foreground">
                      {historyPage} / {totalHistoryPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                      disabled={historyPage === totalHistoryPages}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setHistoryPage(totalHistoryPages)}
                      disabled={historyPage === totalHistoryPages}
                    >
                      <ChevronsRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
