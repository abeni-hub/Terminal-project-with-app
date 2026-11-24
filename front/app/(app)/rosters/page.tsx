'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { api, type ApiError } from '@/src/services/api';
import type { WeeklyRouteAssignment } from '@/src/types/operations';
import { PageHeader } from '@/src/components/PageHeader';
import { DataTable } from '@/src/components/DataTable';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ASSIGNMENT_STATUS_LABELS } from '@/src/constants';
import { toast } from 'sonner';
import {
  Plus, Send, CalendarDays,
  Sparkles, Loader2, Lock, Eye, Archive, CheckCircle2,
  Truck, ArrowRight, RefreshCw, UserCheck, Clock,
} from 'lucide-react';
import type { AssignmentStatus } from '@/src/types/operations';
import { useAuthStore } from '@/src/store/auth-store';

/**
 * Returns the current 3-month quarter information and date boundaries.
 * Municipal route assignments rotate once every 3 months.
 */
function currentQuarterInfo() {
  const now = new Date();
  const year = now.getFullYear();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  const startMonth = (quarter - 1) * 3;
  const startDate = new Date(year, startMonth, 1);
  const endDate = new Date(year, startMonth + 3, 0);
  const quarterNames = ['Q1 (Jan - Mar)', 'Q2 (Apr - Jun)', 'Q3 (Jul - Sep)', 'Q4 (Oct - Dec)'];
  return {
    quarter,
    year,
    label: `${year} ${quarterNames[quarter - 1]}`,
    quarterName: quarterNames[quarter - 1],
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

/**
 * Returns date range and label for any specified quarter and year.
 */
function getQuarterDates(quarter: number, year: number = new Date().getFullYear()) {
  const q = Math.max(1, Math.min(4, quarter));
  const startMonth = (q - 1) * 3;
  const startDate = new Date(year, startMonth, 1);
  const endDate = new Date(year, startMonth + 3, 0);
  const quarterNames = ['Q1 (Jan - Mar)', 'Q2 (Apr - Jun)', 'Q3 (Jul - Sep)', 'Q4 (Oct - Dec)'];
  return {
    quarter: q,
    year,
    label: `${year} ${quarterNames[q - 1]}`,
    quarterName: quarterNames[q - 1],
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

export default function RostersPage() {
  const session = useAuthStore((s) => s.session);
  const isDispatcher = session?.role?.name === 'DISPATCHER' || session?.user?.roleId === 'role-dispatcher';
  const currentPeriod = currentQuarterInfo();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [autoGenOpen, setAutoGenOpen] = useState(false);

  // Lifecycle confirmation targets
  const [reviewing, setReviewing] = useState<WeeklyRouteAssignment | null>(null);
  const [publishing, setPublishing] = useState<WeeklyRouteAssignment | null>(null);
  const [locking, setLocking] = useState<WeeklyRouteAssignment | null>(null);
  const [archiving, setArchiving] = useState<WeeklyRouteAssignment | null>(null);

  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery<import('@/src/services/http').PaginatedResponse<WeeklyRouteAssignment>>({
    queryKey: ['assignments', { page, pageSize, search, status: statusFilter !== 'ALL' ? statusFilter : undefined, isDispatcher, userId: session?.user?.id }],
    queryFn: () => api.assignments.list({
      page,
      pageSize,
      search,
      filters: {
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        ...(isDispatcher ? { weekNumber: currentPeriod.quarter, dispatcherId: session?.user?.id } : {}),
      },
    }),
  });

  const reviewMut = useMutation({
    mutationFn: (id: string) => api.assignments.review(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments'] });
      toast.success('Roster marked as REVIEWED');
      setReviewing(null);
    },
    onError: (e: ApiError) => toast.error(e.message || 'Failed to review assignment'),
  });

  const publishMut = useMutation({
    mutationFn: (id: string) => api.assignments.publish(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments'] });
      toast.success('Roster published! ANPR gate recognition is now active.');
      setPublishing(null);
    },
    onError: (e: ApiError) => toast.error(e.message || 'Failed to publish assignment'),
  });

  const lockMut = useMutation({
    mutationFn: (id: string) => api.assignments.lock(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments'] });
      toast.success('Roster locked! Schedule modifications are now frozen for authoritative operations.');
      setLocking(null);
    },
    onError: (e: ApiError) => toast.error(e.message || 'Failed to lock assignment'),
  });

  const archiveMut = useMutation({
    mutationFn: (id: string) => api.assignments.archive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments'] });
      toast.success('Roster archived');
      setArchiving(null);
    },
    onError: (e: ApiError) => toast.error(e.message || 'Failed to archive assignment'),
  });

  const allAssignments = data?.data ?? [];

  // Summary KPIs
  const kpis = useMemo(() => {
    const total = data?.total ?? allAssignments.length;
    const active = allAssignments.filter((a: any) => a.status === 'PUBLISHED' || a.status === 'LOCKED').length;
    const locked = allAssignments.filter((a: any) => a.status === 'LOCKED').length;
    const draft = allAssignments.filter((a: any) => a.status === 'DRAFT' || a.status === 'REVIEWED').length;
    const conflicts = allAssignments.reduce((acc: number, a: any) => acc + (a.conflictCount || 0), 0);
    return { total, active, locked, draft, conflicts };
  }, [allAssignments, data?.total]);

  const columns = useMemo<ColumnDef<WeeklyRouteAssignment>[]>(() => [
    {
      accessorKey: 'name',
      header: '3-Month Assignment',
      cell: ({ row }) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground text-sm">{row.original.name}</span>
            {row.original.status === 'LOCKED' && (
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-500 text-[10px] px-1.5 py-0 flex items-center gap-0.5">
                <Lock className="h-2.5 w-2.5" /> Locked
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <CalendarDays className="h-3 w-3" />
            {row.original.weekStart} to {row.original.weekEnd}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'weekNumber',
      header: 'Period / Quarter',
      cell: ({ row }) => {
        const qNum = row.original.weekNumber;
        const isQ = qNum >= 1 && qNum <= 4;
        return (
          <Badge variant="secondary" className="font-medium text-xs">
            {isQ ? `Q${qNum} (3 Months)` : `Week ${qNum}`}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'vehicleGroupName',
      header: 'Vehicle Group',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-xs">
          <Truck className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">{row.original.vehicleGroupName}</span>
        </div>
      ),
    },
    {
      id: 'terminals',
      header: 'Terminals / Route',
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-xs">
          <span className="font-medium text-foreground">{row.original.originTerminalName}</span>
          <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="font-medium text-foreground">{row.original.destinationTerminalName}</span>
        </div>
      ),
    },
    {
      accessorKey: 'dispatcherNames',
      header: 'Assigned Dispatchers',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.dispatcherNames?.length ? (
            row.original.dispatcherNames.map((name: string, i: number) => (
              <Badge key={i} variant="outline" className="text-[11px] font-normal flex items-center gap-1">
                <UserCheck className="h-3 w-3 text-primary" /> {name}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground italic">None assigned</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const s = row.original.status;
        switch (s) {
          case 'DRAFT':
            return (
              <Badge variant="outline" className="border-slate-400/40 text-slate-600 dark:text-slate-400">
                Draft
              </Badge>
            );
          case 'REVIEWED':
            return (
              <Badge variant="outline" className="border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <Eye className="h-3 w-3" /> Reviewed
              </Badge>
            );
          case 'PUBLISHED':
            return (
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Published
              </Badge>
            );
          case 'LOCKED':
            return (
              <Badge variant="outline" className="border-amber-500/50 bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                <Lock className="h-3 w-3" /> Locked
              </Badge>
            );
          case 'ARCHIVED':
            return (
              <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground flex items-center gap-1">
                <Archive className="h-3 w-3" /> Archived
              </Badge>
            );
          default:
            return <Badge variant="outline">{s}</Badge>;
        }
      },
    },
    ...(!isDispatcher ? [{
      id: 'actions',
      header: 'Operations',
      enableSorting: false,
      cell: ({ row }: any) => {
        const item = row.original;
        return (
          <div className="flex items-center gap-1.5 justify-end">
            {item.status === 'DRAFT' && (
              <>
                <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setReviewing(item)}>
                  <Eye className="mr-1 h-3 w-3 text-blue-500" /> Review
                </Button>
                <Button size="sm" variant="default" className="h-7 text-xs px-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => setPublishing(item)}>
                  <Send className="mr-1 h-3 w-3" /> Publish
                </Button>
              </>
            )}

            {item.status === 'REVIEWED' && (
              <Button size="sm" variant="default" className="h-7 text-xs px-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => setPublishing(item)}>
                <Send className="mr-1 h-3 w-3" /> Publish
              </Button>
            )}

            {item.status === 'PUBLISHED' && (
              <Button size="sm" variant="outline" className="h-7 text-xs px-2 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10" onClick={() => setLocking(item)}>
                <Lock className="mr-1 h-3 w-3" /> Lock Roster
              </Button>
            )}

            {(item.status === 'PUBLISHED' || item.status === 'LOCKED') && (
              <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground" onClick={() => setArchiving(item)}>
                <Archive className="mr-1 h-3 w-3" /> Archive
              </Button>
            )}
          </div>
        );
      },
    }] : []),
  ], [isDispatcher]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={isDispatcher ? "Published Assignments (Approved by Planner)" : "Quarterly Route Rosters & Assignments (3 Months)"}
        description={
          isDispatcher
            ? `Active 3-month periodic route rosters approved by Municipal Planner for ${currentPeriod.label} assigned to ${session?.user?.name}`
            : "Authoritative 3-month (quarterly) vehicle-to-route assignments guiding terminal dispatch and ANPR gate verification"
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
            {!isDispatcher && (
              <>
                <Button variant="outline" size="sm" onClick={() => setAutoGenOpen(true)}>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" /> Auto-Generate
                </Button>
                <Button size="sm" onClick={() => setWizardOpen(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> New Assignment
                </Button>
              </>
            )}
          </div>
        }
      />

      {isDispatcher && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold">
              Currently Active Period: <span className="text-primary font-bold">{currentPeriod.label} (3-Month Assignment)</span>
            </span>
          </div>
          <Badge variant="outline" className="text-xs">
            Terminal: {session?.user?.terminalName || session?.user?.terminalId || 'Assigned Terminal'}
          </Badge>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 border shadow-sm">
          <div className="text-xs text-muted-foreground font-medium">Total Rosters</div>
          <div className="text-2xl font-bold mt-1">{kpis.total}</div>
        </Card>
        <Card className="p-3 border shadow-sm border-emerald-500/20 bg-emerald-500/5">
          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Active (Published)</div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{kpis.active}</div>
        </Card>
        <Card className="p-3 border shadow-sm border-amber-500/20 bg-amber-500/5">
          <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">Locked (Operational)</div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{kpis.locked}</div>
        </Card>
        <Card className="p-3 border shadow-sm">
          <div className="text-xs text-muted-foreground font-medium">Draft & Review</div>
          <div className="text-2xl font-bold mt-1">{kpis.draft}</div>
        </Card>
      </div>

      {/* Status Filter Bar (hidden or limited for Dispatcher) */}
      {!isDispatcher && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {['ALL', 'DRAFT', 'REVIEWED', 'PUBLISHED', 'LOCKED', 'ARCHIVED'].map((st) => (
              <Button
                key={st}
                size="sm"
                variant={statusFilter === st ? 'default' : 'outline'}
                className="h-8 text-xs font-medium"
                onClick={() => { setStatusFilter(st); setPage(1); }}
              >
                {st === 'ALL' ? 'All Statuses' : ASSIGNMENT_STATUS_LABELS[st as AssignmentStatus] || st}
              </Button>
            ))}
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={allAssignments}
        isLoading={isLoading}
        error={isError ? 'Failed to load assignments' : null}
        onRetry={refetch}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search assignments, routes, groups..."
        serverPagination={{
          page,
          pageSize,
          total: data?.total ?? 0,
          totalPages: data?.totalPages ?? 1,
          onPageChange: (p) => setPage(p),
        }}
      />

      <AssignmentWizard open={wizardOpen} onOpenChange={setWizardOpen} />
      <AutoGenerateDialog open={autoGenOpen} onOpenChange={setAutoGenOpen} />

      {/* Review Confirm Dialog */}
      <ConfirmDialog
        open={!!reviewing}
        onOpenChange={(o) => !o && setReviewing(null)}
        title="Review 3-Month Assignment"
        description={`Mark assignment "${reviewing?.name}" as REVIEWED? This confirms route and dispatcher configuration for the 3-month period before publishing.`}
        confirmLabel="Confirm Review"
        onConfirm={() => reviewing && reviewMut.mutate(reviewing.id)}
        loading={reviewMut.isPending}
      />

      {/* Publish Confirm Dialog */}
      <ConfirmDialog
        open={!!publishing}
        onOpenChange={(o) => !o && setPublishing(null)}
        title="Publish 3-Month Assignment"
        description={`Publish "${publishing?.name}" to activate ANPR terminal gate verification? Vehicles belonging to "${publishing?.vehicleGroupName}" will immediately be recognized at ${publishing?.originTerminalName} and ${publishing?.destinationTerminalName} throughout the 3-month period.`}
        confirmLabel="Publish to Gates"
        onConfirm={() => publishing && publishMut.mutate(publishing.id)}
        loading={publishMut.isPending}
      />

      {/* Lock Confirm Dialog */}
      <ConfirmDialog
        open={!!locking}
        onOpenChange={(o) => !o && setLocking(null)}
        title="Lock Authoritative Operational Roster"
        description={`Freeze "${locking?.name}" into the authoritative record? Modifications will be permanently restricted to prevent unauthorized route shifts during operations.`}
        confirmLabel="Lock Roster"
        onConfirm={() => locking && lockMut.mutate(locking.id)}
        loading={lockMut.isPending}
      />

      {/* Archive Confirm Dialog */}
      <ConfirmDialog
        open={!!archiving}
        onOpenChange={(o) => !o && setArchiving(null)}
        title="Archive 3-Month Assignment"
        description={`Archive completed assignment "${archiving?.name}"? It will be preserved in historical reports.`}
        confirmLabel="Archive"
        onConfirm={() => archiving && archiveMut.mutate(archiving.id)}
        loading={archiveMut.isPending}
      />
    </div>
  );
}

// ─── Auto-Generate 3-Month Schedule Dialog ──────────────────────────────────

function AutoGenerateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const current = currentQuarterInfo();
  const [quarter, setQuarter] = useState(current.quarter);
  const [year, setYear] = useState(current.year);
  const [preview, setPreview] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const qc = useQueryClient();

  const selectedPeriod = getQuarterDates(quarter, year);

  const generatePreview = async () => {
    setLoadingPreview(true);
    try {
      const result = await api.assignments.generatePreview(quarter);
      setPreview(result);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to generate schedule preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  const saveMut = useMutation({
    mutationFn: () => api.assignments.bulkSave(preview?.assignments ?? []),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['assignments'] });
      toast.success(`Successfully saved ${res.savedCount} assignments as Draft!`);
      if (res.skippedCount > 0) {
        toast.warning(`${res.skippedCount} assignment(s) skipped due to existing conflicts.`);
      }
      onOpenChange(false);
      setPreview(null);
    },
    onError: (e: ApiError) => toast.error(e.message || 'Failed to save assignments'),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setPreview(null); setQuarter(current.quarter); } }}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Auto-Generate 3-Month Route Schedule
          </DialogTitle>
          <DialogDescription className="text-xs">
            Distributes active vehicle groups across routes round-robin for the selected 3-month period with distinct dispatchers per terminal and conflict avoidance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg border bg-muted/40 items-end">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Select 3-Month Period (Quarter)</Label>
              <Select value={String(quarter)} onValueChange={(v) => { setQuarter(Number(v)); setPreview(null); }}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select Quarter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Q1 (Jan - Mar)</SelectItem>
                  <SelectItem value="2">Q2 (Apr - Jun)</SelectItem>
                  <SelectItem value="3">Q3 (Jul - Sep)</SelectItem>
                  <SelectItem value="4">Q4 (Oct - Dec)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Planning Year</Label>
              <Input
                type="number"
                min={2024}
                max={2030}
                className="h-8 text-xs font-mono"
                value={year}
                onChange={(e) => { setYear(Number(e.target.value)); setPreview(null); }}
              />
            </div>

            <div>
              <Button onClick={generatePreview} disabled={loadingPreview || !quarter} size="sm" className="w-full">
                {loadingPreview ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                Generate 3-Month Preview
              </Button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground flex items-center gap-1.5 px-1">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span>Target Cycle: <strong>{selectedPeriod.label}</strong> ({selectedPeriod.startDate} to {selectedPeriod.endDate} — 3 Months)</span>
          </div>

          {preview && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">
                  {preview.periodLabel || `Quarter ${preview.weekNumber}`} Preview — {preview.assignments.length} assignment(s)
                </span>
                <span className="text-muted-foreground font-mono">
                  {preview.weekStart} to {preview.weekEnd}
                </span>
              </div>

              <div className="border rounded-lg divide-y max-h-72 overflow-y-auto">
                {preview.assignments.map((a: any, i: number) => (
                  <div key={i} className={`p-3 text-xs flex items-center justify-between ${a.hasConflict ? 'bg-destructive/5' : 'hover:bg-muted/30'}`}>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{a.vehicleGroupName}</span>
                        {a.hasConflict && (
                          <Badge variant="destructive" className="text-[10px] py-0">Conflict (Already Assigned)</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <span>{a.originTerminalName}</span>
                        <ArrowRight className="h-3 w-3" />
                        <span>{a.destinationTerminalName}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-muted-foreground block">
                        {a.dispatcherNames.length ? a.dispatcherNames.join(', ') : 'Auto-Assigned'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-3">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          {preview && (
            <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {saveMut.isPending ? 'Saving...' : `Approve & Save as Draft (${preview.assignments.length})`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Manual Assignment Wizard (3-Month Cycle) ───────────────────────────────

function AssignmentWizard({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const current = currentQuarterInfo();
  const [step, setStep] = useState(1);
  const [quarter, setQuarter] = useState(current.quarter);
  const [year, setYear] = useState(current.year);
  const [vehicleGroupId, setVehicleGroupId] = useState('');
  const [originTerminalId, setOriginTerminalId] = useState('');
  const [destinationTerminalId, setDestinationTerminalId] = useState('');
  const [originDispatcherId, setOriginDispatcherId] = useState<string>('');
  const [destDispatcherId, setDestDispatcherId] = useState<string>('');
  const qc = useQueryClient();

  const periodDates = getQuarterDates(quarter, year);

  const { data: groupsData } = useQuery<import('@/src/services/http').PaginatedResponse<import('@/src/types/vehicle').VehicleGroup>>(
    { queryKey: ['vehicle-groups-all'], queryFn: () => api.vehicleGroups.list({ page: 1, pageSize: 100 }) },
  );
  const { data: terminalsData } = useQuery<import('@/src/services/http').PaginatedResponse<import('@/src/types/terminal').Terminal>>(
    { queryKey: ['terminals-all'], queryFn: () => api.terminals.list({ page: 1, pageSize: 100 }) },
  );
  const { data: dispatchersData } = useQuery<import('@/src/services/http').PaginatedResponse<import('@/src/types/user').User>>(
    { queryKey: ['dispatchers-all'], queryFn: () => api.users.list({ page: 1, pageSize: 100, search: '' }) },
  );

  const groups = groupsData?.data ?? [];
  const terminals = terminalsData?.data ?? [];

  const allDispatchers = (dispatchersData?.data ?? []).filter(
    (u: import('@/src/types/user').User) => u.status === 'ACTIVE',
  );

  const originDispatchers = allDispatchers.filter(
    (u: import('@/src/types/user').User) => u.terminalId === originTerminalId,
  );
  const destDispatchers = allDispatchers.filter(
    (u: import('@/src/types/user').User) => u.terminalId === destinationTerminalId,
  );

  const createMut = useMutation({
    mutationFn: () => {
      const group = groups.find((g: import('@/src/types/vehicle').VehicleGroup) => g.id === vehicleGroupId);
      const originName = terminals.find((t: import('@/src/types/terminal').Terminal) => t.id === originTerminalId)?.name ?? '';
      const destName = terminals.find((t: import('@/src/types/terminal').Terminal) => t.id === destinationTerminalId)?.name ?? '';
      
      const dispatcherIds = [originDispatcherId, destDispatcherId].filter(Boolean);

      return api.assignments.create({
        name: `Q${quarter} ${year} - ${group?.name ?? ''} - ${originName} to ${destName}`,
        weekNumber: quarter,
        weekStart: periodDates.startDate,
        weekEnd: periodDates.endDate,
        vehicleGroupId,
        originTerminalId,
        destinationTerminalId,
        dispatcherIds,
      });
    },
    onSuccess: (assignment) => {
      qc.invalidateQueries({ queryKey: ['assignments'] });
      if (assignment.conflicts && assignment.conflicts.length > 0) {
        toast.warning(`Assignment created with ${assignment.conflicts.length} conflict(s). Review before publishing.`);
      } else {
        toast.success('3-Month Route Assignment created successfully');
      }
      onOpenChange(false);
      resetWizard();
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const resetWizard = () => {
    setStep(1);
    setQuarter(current.quarter);
    setYear(current.year);
    setVehicleGroupId('');
    setOriginTerminalId('');
    setDestinationTerminalId('');
    setOriginDispatcherId('');
    setDestDispatcherId('');
  };

  const canProceed = () => {
    if (step === 1) return quarter >= 1 && quarter <= 4;
    if (step === 2) return !!vehicleGroupId;
    if (step === 3) return !!originTerminalId;
    if (step === 4) return !!destinationTerminalId && destinationTerminalId !== originTerminalId;
    if (step === 5) return !!originDispatcherId || !!destDispatcherId;
    return true;
  };

  const steps = ['Select Period', 'Vehicle Group', 'Origin Terminal', 'Destination', 'Assign Dispatchers', 'Review & Validate'];

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetWizard(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" /> New 3-Month Route Assignment
          </DialogTitle>
          <DialogDescription className="text-xs">
            Planner configures authoritative 3-month periodic vehicle group routes and designated dispatchers.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1 flex-wrap">
          {steps.map((s, i) => (
            <div
              key={i}
              className={`flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-medium transition-colors
                ${step > i + 1 ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : step === i + 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            >
              <span>{i + 1}. {s}</span>
            </div>
          ))}
        </div>

        <div className="min-h-[240px] space-y-4">
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select 3-Month Planning Period (Quarter)</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { q: 1, name: 'Q1', desc: 'January 1 – March 31' },
                    { q: 2, name: 'Q2', desc: 'April 1 – June 30' },
                    { q: 3, name: 'Q3', desc: 'July 1 – September 30' },
                    { q: 4, name: 'Q4', desc: 'October 1 – December 31' },
                  ].map((item) => (
                    <div
                      key={item.q}
                      onClick={() => setQuarter(item.q)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${quarter === item.q ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'hover:bg-muted/50'}`}
                    >
                      <div className="font-semibold text-sm">{item.name} ({year})</div>
                      <div className="text-xs text-muted-foreground">{item.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Planning Year</Label>
                  <Input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    min={2024}
                    max={2030}
                    className="w-32 h-8 text-xs font-mono"
                  />
                </div>
                <div className="pt-4 text-xs text-muted-foreground">
                  Span: <strong>{periodDates.startDate}</strong> to <strong>{periodDates.endDate}</strong> (3 Months)
                </div>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-3">
              <Label>Select a vehicle group</Label>
              <p className="text-xs text-muted-foreground">Planning is done at the vehicle group level.</p>
              <Select value={vehicleGroupId} onValueChange={setVehicleGroupId}>
                <SelectTrigger><SelectValue placeholder="Choose a vehicle group" /></SelectTrigger>
                <SelectContent>
                  {groups.map((g: import('@/src/types/vehicle').VehicleGroup) => (
                    <SelectItem key={g.id} value={g.id}>{g.name} ({g.vehicleCount} vehicles)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-3">
              <Label>Select the origin terminal</Label>
              <Select value={originTerminalId} onValueChange={(v) => { setOriginTerminalId(v); setOriginDispatcherId(''); }}>
                <SelectTrigger><SelectValue placeholder="Choose origin terminal" /></SelectTrigger>
                <SelectContent>
                  {terminals.map((t: import('@/src/types/terminal').Terminal) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {step === 4 && (
            <div className="space-y-3">
              <Label>Select the destination terminal</Label>
              <Select value={destinationTerminalId} onValueChange={(v) => { setDestinationTerminalId(v); setDestDispatcherId(''); }}>
                <SelectTrigger><SelectValue placeholder="Choose destination terminal" /></SelectTrigger>
                <SelectContent>
                  {terminals
                    .filter((t: import('@/src/types/terminal').Terminal) => t.id !== originTerminalId)
                    .map((t: import('@/src/types/terminal').Terminal) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {step === 5 && (
            <div className="space-y-4">
              <div className="rounded-md border border-primary/20 bg-primary/5 p-2.5 text-xs text-primary">
                <strong>Assignment Rule:</strong> A dispatcher belongs to only one terminal. Multiple dispatchers from the same terminal must be assigned to different routes. Select at most 1 dispatcher per terminal for this route.
              </div>

              {/* Origin Terminal Dispatcher Selection */}
              <div className="space-y-2 border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">
                    Origin Dispatcher ({terminals.find((t: any) => t.id === originTerminalId)?.name})
                  </Label>
                  {originDispatcherId && (
                    <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setOriginDispatcherId('')}>Clear</Button>
                  )}
                </div>
                {originDispatchers.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No dispatchers assigned to origin terminal.</p>
                ) : (
                  <RadioGroup value={originDispatcherId} onValueChange={setOriginDispatcherId} className="space-y-1.5">
                    {originDispatchers.map((d: any) => (
                      <label key={d.id} className="flex items-center gap-2 text-xs p-2 rounded hover:bg-muted/50 cursor-pointer border">
                        <RadioGroupItem value={d.id} id={`orig-${d.id}`} />
                        <div>
                          <span className="font-medium">{d.name}</span>
                          <span className="text-muted-foreground block text-[11px]">{d.email}</span>
                        </div>
                      </label>
                    ))}
                  </RadioGroup>
                )}
              </div>

              {/* Destination Terminal Dispatcher Selection */}
              <div className="space-y-2 border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">
                    Destination Dispatcher ({terminals.find((t: any) => t.id === destinationTerminalId)?.name})
                  </Label>
                  {destDispatcherId && (
                    <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setDestDispatcherId('')}>Clear</Button>
                  )}
                </div>
                {destDispatchers.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No dispatchers assigned to destination terminal.</p>
                ) : (
                  <RadioGroup value={destDispatcherId} onValueChange={setDestDispatcherId} className="space-y-1.5">
                    {destDispatchers.map((d: any) => (
                      <label key={d.id} className="flex items-center gap-2 text-xs p-2 rounded hover:bg-muted/50 cursor-pointer border">
                        <RadioGroupItem value={d.id} id={`dest-${d.id}`} />
                        <div>
                          <span className="font-medium">{d.name}</span>
                          <span className="text-muted-foreground block text-[11px]">{d.email}</span>
                        </div>
                      </label>
                    ))}
                  </RadioGroup>
                )}
              </div>
            </div>
          )}
          {step === 6 && (
            <div className="space-y-3">
              <Label>Review and validate</Label>
              <Card>
                <CardContent className="space-y-2 p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">3-Month Period</span>
                    <span className="font-medium">{periodDates.label} ({periodDates.startDate} to {periodDates.endDate})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vehicle Group</span>
                    <span className="font-medium">{groups.find((g: import('@/src/types/vehicle').VehicleGroup) => g.id === vehicleGroupId)?.name ?? '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Route</span>
                    <span className="font-medium">
                      {terminals.find((t: import('@/src/types/terminal').Terminal) => t.id === originTerminalId)?.name ?? '-'}
                      {' → '}
                      {terminals.find((t: import('@/src/types/terminal').Terminal) => t.id === destinationTerminalId)?.name ?? '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dispatchers</span>
                    <span className="font-medium">
                      {[originDispatcherId, destDispatcherId]
                        .filter(Boolean)
                        .map((id: string) => allDispatchers.find((d: import('@/src/types/user').User) => d.id === id)?.name)
                        .join(', ') || 'None assigned'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <DialogFooter>
          {step > 1 && <Button variant="outline" onClick={() => setStep(step - 1)}>Back</Button>}
          {step < 6 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>Next</Button>
          ) : (
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
              {createMut.isPending ? 'Creating...' : 'Create 3-Month Assignment'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
