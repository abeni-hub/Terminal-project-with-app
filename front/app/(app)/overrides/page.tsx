'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { api, type ApiError } from '@/src/services/api';
import type { Override } from '@/src/types/operations';
import { PageHeader } from '@/src/components/PageHeader';
import { DataTable } from '@/src/components/DataTable';
import { StatusBadge } from '@/src/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { OVERRIDE_STATUS_LABELS } from '@/src/constants';
import { ShieldCheck, Lock } from 'lucide-react';
import type { OverrideStatus } from '@/src/types/operations';
import type { PaginatedResponse } from '@/src/services/http';

const statusVariant: Record<OverrideStatus, 'warning' | 'success' | 'danger'> = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger' };

export default function OverridesPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [approving, setApproving] = useState<Override | null>(null);
  const [pin, setPin] = useState('');
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery<PaginatedResponse<Override>>({ queryKey: ['overrides', { page, pageSize: 10, search }], queryFn: () => api.overrides.list({ page, pageSize: 10, search }) });

  const approveMut = useMutation({
    mutationFn: ({ id, pin }: { id: string; pin: string }) => api.overrides.approve(id, pin),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['overrides'] }); toast.success('Override approved'); setApproving(null); setPin(''); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const columns = useMemo<ColumnDef<Override>[]>(() => [
    { accessorKey: 'requestedBy', header: 'Requested By', cell: ({ row }) => <span className="font-medium">{row.original.requestedBy}</span> },
    { accessorKey: 'action', header: 'Action' },
    { accessorKey: 'reason', header: 'Reason', cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.reason}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge label={OVERRIDE_STATUS_LABELS[row.original.status]} variant={statusVariant[row.original.status]} /> },
    { accessorKey: 'createdAt', header: 'Created', cell: ({ row }) => <span className="text-xs">{new Date(row.original.createdAt).toLocaleDateString()}</span> },
    {
      id: 'actions', header: '', enableSorting: false,
      cell: ({ row }) => row.original.status === 'PENDING' ? (
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setApproving(row.original); setPin(''); }}>
          <ShieldCheck className="mr-1 h-3 w-3" /> Review
        </Button>
      ) : null,
    },
  ], []);

  return (
    <div className="space-y-6">
      <PageHeader title="Overrides" description="Review and approve supervisor override requests" />

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        error={isError ? 'Failed to load overrides' : null}
        onRetry={refetch}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search overrides..."
        serverPagination={{
          page,
          pageSize: 10,
          total: data?.total ?? 0,
          totalPages: data?.totalPages ?? 1,
          onPageChange: (p) => setPage(p),
        }}
      />

      <Dialog open={!!approving} onOpenChange={(o) => !o && setApproving(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Approve Override Request</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <p><span className="font-medium">{approving?.action}</span> by {approving?.requestedBy}</p>
              <p className="mt-1 text-muted-foreground">{approving?.reason}</p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Lock className="h-3.5 w-3.5" /> Supervisor PIN</Label>
              <Input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Enter 4-digit PIN (demo: 1234)" maxLength={4} />
              <p className="text-xs text-muted-foreground">PIN: 1234</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproving(null)}>Cancel</Button>
            <Button onClick={() => approving && approveMut.mutate({ id: approving.id, pin })} disabled={pin.length !== 4 || approveMut.isPending}>
              {approveMut.isPending ? 'Approving...' : 'Approve Override'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
