'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { api } from '@/src/services/api';
import type { Violation } from '@/src/types/operations';
import { PageHeader } from '@/src/components/PageHeader';
import { DataTable } from '@/src/components/DataTable';
import { StatusBadge } from '@/src/components/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { VIOLATION_SEVERITY_LABELS, VIOLATION_STATUS_LABELS } from '@/src/constants';
import {
  AlertTriangle, ShieldAlert, CheckCircle, Filter, Camera, ArrowRight,
  MapPin, CheckCircle2, XCircle, LogIn, RefreshCw, Eye,
} from 'lucide-react';
import type { ViolationSeverity, ViolationStatus } from '@/src/types/operations';
import { useAuthStore } from '@/src/store/auth-store';

const sevVariant: Record<ViolationSeverity, string> = {
  CRITICAL: 'border-destructive/30 bg-destructive/15 text-destructive font-semibold',
  HIGH: 'border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold',
  MEDIUM: 'border-blue-500/30 bg-blue-500/15 text-blue-600 dark:text-blue-400',
  LOW: 'border-border bg-muted text-muted-foreground',
};

const statusVariant: Record<ViolationStatus, 'success' | 'warning' | 'info' | 'muted'> = {
  OPEN: 'warning',
  IN_REVIEW: 'info',
  UNDER_REVIEW: 'info',
  PENALTY_APPLIED: 'warning',
  PAID: 'success',
  WAIVED: 'info',
  RESOLVED: 'success',
  DISMISSED: 'muted',
};

export default function ViolationsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sevFilter, setSevFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [resolving, setResolving] = useState<Violation | null>(null);
  const [resolutionType, setResolutionType] = useState<'DISPATCH_IN' | 'REJECT' | 'GENERAL'>('DISPATCH_IN');
  const [remark, setRemark] = useState('');
  const session = useAuthStore((s) => s.session);
  const user = session?.user;
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['violations', { page, pageSize: 20, search, filters: { severity: sevFilter, status: statusFilter } }],
    queryFn: () => api.violations.list({ page, pageSize: 20, search, filters: { severity: sevFilter, status: statusFilter } }),
  });

  const resolveMut = useMutation({
    mutationFn: async ({ id, remark, action }: { id: string; remark: string; action: string }) => {
      return api.violations.resolve(id, {
        resolution: remark,
        resolutionAction: action,
        remark,
        dispatcherId: user?.id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['violations'] });
      qc.invalidateQueries({ queryKey: ['queue'] });
      toast.success('Violation resolved successfully');
      setResolving(null);
      setRemark('');
    },
    onError: () => toast.error('Failed to resolve violation'),
  });

  const violationsList = data?.data ?? [];

  // Summary KPIs
  const kpis = useMemo(() => {
    const total = data?.total ?? violationsList.length;
    const openCount = violationsList.filter((v: Violation) => v.status === 'OPEN' || v.status === 'IN_REVIEW').length;
    const wrongTerminal = violationsList.filter((v: Violation) => v.type === 'WRONG_TERMINAL_ENTRY').length;
    const unassigned = violationsList.filter((v: Violation) => v.type === 'UNASSIGNED_VEHICLE_ENTRY').length;
    return { total, openCount, wrongTerminal, unassigned };
  }, [violationsList, data?.total]);

  const columns = useMemo<ColumnDef<Violation>[]>(() => [
    {
      accessorKey: 'plateNumber',
      header: 'Vehicle Plate',
      cell: ({ row }) => (
        <div>
          <span className="font-mono text-xs font-bold text-foreground bg-muted/60 px-2 py-1 rounded">
            {row.original.plateNumber}
          </span>
          {row.original.entryRecognitionEventId && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
              <Camera className="h-3 w-3 text-primary" /> ANPR Scan
            </div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'type',
      header: 'Violation Type & Context',
      cell: ({ row }) => {
        const t = row.original.type;
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="font-medium text-xs text-foreground">
                {t === 'WRONG_TERMINAL_ENTRY' ? 'Wrong Terminal Entry'
                  : t === 'UNASSIGNED_VEHICLE_ENTRY' ? 'Unassigned Vehicle Entry'
                  : t.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground line-clamp-2 max-w-sm">
              {row.original.description}
            </p>
          </div>
        );
      },
    },
    {
      accessorKey: 'severity',
      header: 'Severity',
      cell: ({ row }) => (
        <Badge variant="outline" className={sevVariant[row.original.severity]}>
          {VIOLATION_SEVERITY_LABELS[row.original.severity]}
        </Badge>
      ),
    },
    {
      accessorKey: 'totalAmountDue',
      header: 'Financial Fine',
      cell: ({ row }) => {
        const totalDue = row.original.totalAmountDue || 0;
        if (!totalDue) return <span className="text-[11px] text-muted-foreground">—</span>;
        return (
          <div className="text-xs font-mono">
            <span className="font-bold text-rose-600 dark:text-rose-400">
              {totalDue.toFixed(2)} ETB
            </span>
            <span className="block text-[10px] text-muted-foreground">
              Fee: {(row.original.originalDispatchFee || 0).toFixed(2)} + Fine: {(row.original.penaltyAmount || 0).toFixed(2)}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const s = row.original.status;
        const variant =
          s === 'RESOLVED' || s === 'PAID'
            ? 'success'
            : s === 'WAIVED'
            ? 'info'
            : s === 'PENALTY_APPLIED'
            ? 'warning'
            : statusVariant[s] || 'warning';
        return <StatusBadge label={VIOLATION_STATUS_LABELS[s] || s} variant={variant as any} />;
      },
    },
    {
      accessorKey: 'reportedBy',
      header: 'Source / Gate',
      cell: ({ row }) => (
        <div className="text-xs">
          <span className="font-medium">{row.original.reportedBy}</span>
          <span className="block text-[11px] text-muted-foreground mt-0.5">
            {new Date(row.original.reportedAt).toLocaleString()}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'resolution',
      header: 'Resolution',
      cell: ({ row }) => {
        const res = row.original.resolution;
        if (!res) return <span className="text-xs text-muted-foreground italic">Pending Review</span>;
        return (
          <div className="text-xs max-w-xs">
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle className="h-3 w-3" />
              <span>{row.original.resolutionAction || 'Resolved'}</span>
            </div>
            <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{res}</p>
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => {
        const isOpen = row.original.status === 'OPEN' || row.original.status === 'IN_REVIEW' || row.original.status === 'PENALTY_APPLIED';
        return isOpen ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
            onClick={() => {
              setResolving(row.original);
              setRemark(row.original.resolution ?? '');
              setResolutionType('DISPATCH_IN');
            }}
          >
            <ShieldAlert className="mr-1 h-3 w-3" /> Review & Resolve
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => {
              setResolving(row.original);
              setRemark(row.original.resolution ?? '');
              setResolutionType('GENERAL');
            }}
          >
            <Eye className="mr-1 h-3 w-3" /> Details
          </Button>
        );
      },
    },
  ], []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gate Violations & Roster Enforcement"
        description="Review automated ANPR gate alerts, wrong-terminal entries, and resolve operational roster mismatches"
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 border shadow-sm">
          <div className="text-xs text-muted-foreground font-medium">Total Violations</div>
          <div className="text-2xl font-bold mt-1">{kpis.total}</div>
        </Card>
        <Card className="p-3 border shadow-sm border-amber-500/20 bg-amber-500/5">
          <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">Open / Pending Review</div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{kpis.openCount}</div>
        </Card>
        <Card className="p-3 border shadow-sm border-destructive/20 bg-destructive/5">
          <div className="text-xs text-destructive font-medium">Wrong Terminal Entries</div>
          <div className="text-2xl font-bold text-destructive mt-1">{kpis.wrongTerminal}</div>
        </Card>
        <Card className="p-3 border shadow-sm">
          <div className="text-xs text-muted-foreground font-medium">Unassigned Vehicles</div>
          <div className="text-2xl font-bold mt-1">{kpis.unassigned}</div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Filters:</span>
        <Select value={sevFilter ?? 'all'} onValueChange={(v) => { setSevFilter(v === 'all' ? undefined : v); setPage(1); }}>
          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            {Object.entries(VIOLATION_SEVERITY_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter ?? 'all'} onValueChange={(v) => { setStatusFilter(v === 'all' ? undefined : v); setPage(1); }}>
          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(VIOLATION_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={violationsList}
        isLoading={isLoading}
        error={isError ? 'Failed to load violations' : null}
        onRetry={refetch}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search by plate number, violation type, or details..."
        serverPagination={{
          page,
          pageSize: 20,
          total: data?.total ?? 0,
          totalPages: data?.totalPages ?? 1,
          onPageChange: (p) => setPage(p),
        }}
      />

      {/* Resolution Dialog */}
      <Dialog open={!!resolving} onOpenChange={(o) => !o && setResolving(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              {resolving?.status === 'RESOLVED' || resolving?.status === 'DISMISSED' ? 'Violation Details' : 'Resolve Gate Violation'}
            </DialogTitle>
            <DialogDescription>
              Authoritative supervisor resolution for automated ANPR gate flag.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Context Box */}
            <div className="rounded-md border border-border bg-muted/40 p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-bold bg-background px-2 py-0.5 rounded border">
                  {resolving?.plateNumber}
                </span>
                <Badge variant="outline" className={sevVariant[resolving?.severity || 'MEDIUM']}>
                  {resolving?.severity}
                </Badge>
              </div>

              <div className="text-foreground font-medium pt-1">
                {resolving?.type === 'WRONG_TERMINAL_ENTRY' ? 'Wrong Terminal Entry Alert'
                  : resolving?.type === 'UNASSIGNED_VEHICLE_ENTRY' ? 'Unassigned Vehicle Entry Alert'
                  : resolving?.type}
              </div>
              <p className="text-muted-foreground">{resolving?.description}</p>
              <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/50 flex justify-between">
                <span>Detected: {resolving ? new Date(resolving.reportedAt).toLocaleString() : '-'}</span>
                <span>Source: {resolving?.reportedBy}</span>
              </div>
            </div>

            {/* Action Choice for Open Violations */}
            {resolving && (resolving.status === 'OPEN' || resolving.status === 'IN_REVIEW') ? (
              <div className="space-y-3">
                <Label className="text-xs font-semibold">Operational Resolution Action</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setResolutionType('DISPATCH_IN')}
                    className={`flex flex-col items-start p-3 rounded-md border text-left text-xs transition-all ${
                      resolutionType === 'DISPATCH_IN'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold">
                      <LogIn className="h-4 w-4 text-emerald-600" />
                      <span>Allow Dispatch In</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground mt-1">
                      Admit vehicle into loading yard with audited override remark.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setResolutionType('REJECT')}
                    className={`flex flex-col items-start p-3 rounded-md border text-left text-xs transition-all ${
                      resolutionType === 'REJECT'
                        ? 'border-destructive bg-destructive/10 text-destructive ring-1 ring-destructive'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold">
                      <XCircle className="h-4 w-4 text-destructive" />
                      <span>Turn Away / Dismiss</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground mt-1">
                      Reject entry at gate. Vehicle not permitted into terminal.
                    </span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Mandatory Supervisor Remark & Audit Justification
                  </Label>
                  <Textarea
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder={
                      resolutionType === 'DISPATCH_IN'
                        ? 'e.g. Special dispatcher authorization due to peak passenger surge on Bole route...'
                        : 'e.g. Vehicle redirected to assigned terminal Piassa...'
                    }
                    rows={3}
                    className="text-xs"
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Resolution Record</span>
                </div>
                <p className="text-foreground">{resolving?.resolution || resolving?.remark || 'Resolved'}</p>
                {resolving?.resolvedAt && (
                  <p className="text-[11px] text-muted-foreground">
                    Resolved at {new Date(resolving.resolvedAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResolving(null)}>
              {resolving?.status === 'OPEN' || resolving?.status === 'IN_REVIEW' ? 'Cancel' : 'Close'}
            </Button>
            {resolving && (resolving.status === 'OPEN' || resolving.status === 'IN_REVIEW') && (
              <Button
                onClick={() =>
                  resolveMut.mutate({
                    id: resolving.id,
                    remark,
                    action: resolutionType === 'DISPATCH_IN' ? 'ALLOW_DISPATCH_IN' : 'TURN_AWAY',
                  })
                }
                disabled={!remark.trim() || resolveMut.isPending}
                className={resolutionType === 'DISPATCH_IN' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-destructive hover:bg-destructive/90'}
              >
                {resolveMut.isPending ? 'Processing...' : resolutionType === 'DISPATCH_IN' ? 'Confirm & Admit Vehicle' : 'Confirm Rejection'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
