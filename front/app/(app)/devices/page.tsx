'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { api } from '@/src/services/api';
import type { Device } from '@/src/types/operations';
import { PageHeader } from '@/src/components/PageHeader';
import { DataTable } from '@/src/components/DataTable';
import { StatusBadge } from '@/src/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/src/components/StatCard';
import { toast } from 'sonner';
import { DEVICE_STATUS_LABELS } from '@/src/constants';
import { Smartphone, Check, X, RefreshCw } from 'lucide-react';
import type { DeviceStatus } from '@/src/types/operations';
import type { PaginatedResponse } from '@/src/services/http';

const statusVariant: Record<DeviceStatus, 'success' | 'warning' | 'danger' | 'muted'> = {
  APPROVED: 'success', PENDING: 'warning', REJECTED: 'danger', OFFLINE: 'muted',
};

export default function DevicesPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery<PaginatedResponse<Device>>({ queryKey: ['devices', { page, pageSize: 10, search }], queryFn: () => api.devices.list({ page, pageSize: 10, search }) });

  const approveMut = useMutation({ mutationFn: api.devices.approve, onSuccess: () => { qc.invalidateQueries({ queryKey: ['devices'] }); toast.success('Device approved'); }, onError: () => toast.error('Failed to approve device') });
  const rejectMut = useMutation({ mutationFn: api.devices.reject, onSuccess: () => { qc.invalidateQueries({ queryKey: ['devices'] }); toast.success('Device rejected'); }, onError: () => toast.error('Failed to reject device') });

  const columns = useMemo<ColumnDef<Device>[]>(() => [
    { accessorKey: 'name', header: 'Name', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: 'deviceId', header: 'Device ID', cell: ({ row }) => <span className="font-mono text-xs">{row.original.deviceId}</span> },
    { accessorKey: 'terminalId', header: 'Terminal' },
    { accessorKey: 'appVersion', header: 'Version', cell: ({ row }) => <span className="text-xs">v{row.original.appVersion}</span> },
    { accessorKey: 'lastSyncAt', header: 'Last Sync', cell: ({ row }) => <span className="text-xs">{row.original.lastSyncAt ? new Date(row.original.lastSyncAt).toLocaleString() : 'Never'}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge label={DEVICE_STATUS_LABELS[row.original.status]} variant={statusVariant[row.original.status]} /> },
    {
      id: 'actions', header: '', enableSorting: false,
      cell: ({ row }) => row.original.status === 'PENDING' ? (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-success" onClick={() => approveMut.mutate(row.original.id)}><Check className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => rejectMut.mutate(row.original.id)}><X className="h-4 w-4" /></Button>
        </div>
      ) : null,
    },
  ], [approveMut, rejectMut]);

  return (
    <div className="space-y-6">
      <PageHeader title="Device Management" description="Approve and manage dispatch devices across terminals" />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Approved Devices" value={(data?.data ?? []).filter((d: Device) => d.status === 'APPROVED').length} icon={Smartphone} variant="success" />
        <StatCard label="Pending Approval" value={(data?.data ?? []).filter((d: Device) => d.status === 'PENDING').length} icon={Smartphone} variant="warning" />
        <StatCard label="Offline" value={(data?.data ?? []).filter((d: Device) => d.status === 'OFFLINE').length} icon={Smartphone} variant="danger" />
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        error={isError ? 'Failed to load devices' : null}
        onRetry={refetch}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search devices..."
        serverPagination={{
          page,
          pageSize: 10,
          total: data?.total ?? 0,
          totalPages: data?.totalPages ?? 1,
          onPageChange: (p) => setPage(p),
        }}
      />
    </div>
  );
}
