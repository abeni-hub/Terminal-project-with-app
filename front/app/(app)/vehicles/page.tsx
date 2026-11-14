'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { api } from '@/src/services/api';
import type { Vehicle } from '@/src/types/vehicle';
import type { VehicleGroup } from '@/src/types/vehicle';
import type { PaginatedResponse } from '@/src/services/http';
import { useVehicles, useDeleteVehicle, useVehicleFilters } from '@/src/features/vehicles/hooks/use-vehicles';
import { VehicleFormDialog } from '@/src/features/vehicles/components/VehicleFormDialog';
import { VehicleHistoryModal } from '@/src/features/vehicles/components/VehicleHistoryModal';
import { PageHeader } from '@/src/components/PageHeader';
import { DataTable } from '@/src/components/DataTable';
import { StatusBadge } from '@/src/components/StatusBadge';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { StatCard } from '@/src/components/StatCard';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { VEHICLE_STATUS_LABELS, VEHICLE_TYPE_LABELS } from '@/src/constants';
import { toast } from 'sonner';
import { Plus, Bus, Send, Wrench, Pencil, Trash2, Filter } from 'lucide-react';

const statusVariant: Record<Vehicle['status'], 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted'> = {
  WAITING: 'info',
  DISPATCHED: 'success',
  IN_TRANSIT: 'default',
  IDLE: 'muted',
  MAINTENANCE: 'warning',
  OFFLINE: 'danger',
};

export default function VehiclesPage() {
  const filters = useVehicleFilters();
  const { data, isLoading, isError, refetch } = useVehicles(filters.params);
  const deleteMutation = useDeleteVehicle();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [deleting, setDeleting] = useState<Vehicle | null>(null);
  const [historyVehicleId, setHistoryVehicleId] = useState<string | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  const { data: groupsData } = useQuery<PaginatedResponse<VehicleGroup>>({ queryKey: ['vehicle-groups-all'], queryFn: () => api.vehicleGroups.list({ page: 1, pageSize: 100 }) });
  const groups = groupsData?.data ?? [];

  const groupName = (id?: string) => groups.find((g: import('@/src/types/vehicle').VehicleGroup) => g.id === id)?.name ?? '-';

  const columns = useMemo<ColumnDef<Vehicle>[]>(() => [
    {
      accessorKey: 'plateNumber', header: 'Plate',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setHistoryVehicleId(row.original.id);
            setHistoryModalOpen(true);
          }}
          className="font-mono text-xs font-bold text-primary hover:underline flex items-center gap-1"
        >
          {row.original.plateNumber}
        </button>
      ),
    },
    { accessorKey: 'model', header: 'Model' },
    { accessorKey: 'type', header: 'Type', cell: ({ row }) => <span className="text-xs">{VEHICLE_TYPE_LABELS[row.original.type]}</span> },
    { accessorKey: 'capacity', header: 'Capacity' },
    { accessorKey: 'groupId', header: 'Group', cell: ({ row }) => <span className="text-xs">{groupName(row.original.groupId)}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge label={VEHICLE_STATUS_LABELS[row.original.status]} variant={statusVariant[row.original.status]} /> },
    {
      id: 'actions', header: '', enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={(e) => {
              e.stopPropagation();
              setHistoryVehicleId(row.original.id);
              setHistoryModalOpen(true);
            }}
          >
            History
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setEditing(row.original); setFormOpen(true); }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleting(row.original); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ], [groups]);

  const handleDelete = () => {
    if (!deleting) return;
    deleteMutation.mutate(deleting.id, {
      onSuccess: () => { toast.success('Vehicle deleted'); setDeleting(null); },
      onError: () => toast.error('Failed to delete vehicle'),
    });
  };

  const stats = useMemo(() => {
    const all = data?.data ?? [];
    return {
      total: data?.total ?? 0,
      waiting: all.filter((v: Vehicle) => v.status === 'WAITING').length,
      dispatched: all.filter((v: Vehicle) => v.status === 'DISPATCHED' || v.status === 'IN_TRANSIT').length,
      maintenance: all.filter((v: Vehicle) => v.status === 'MAINTENANCE').length,
    };
  }, [data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vehicles"
        description="Manage the vehicle fleet - every vehicle belongs to a vehicle group"
        actions={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add Vehicle
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Vehicles" value={stats.total} icon={Bus} variant="default" />
        <StatCard label="Waiting" value={stats.waiting} icon={Bus} variant="info" />
        <StatCard label="Dispatched" value={stats.dispatched} icon={Send} variant="success" />
        <StatCard label="In Maintenance" value={stats.maintenance} icon={Wrench} variant="warning" />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters:</span>
            <Select value={filters.statusFilter ?? 'all'} onValueChange={(v) => { filters.setStatusFilter(v === 'all' ? undefined : v); filters.setPage(1); }}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.entries(VEHICLE_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.typeFilter ?? 'all'} onValueChange={(v) => { filters.setTypeFilter(v === 'all' ? undefined : v); filters.setPage(1); }}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {Object.entries(VEHICLE_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.terminalFilter ?? 'all'} onValueChange={(v) => { filters.setTerminalFilter(v === 'all' ? undefined : v); filters.setPage(1); }}>
              <SelectTrigger className="h-8 w-48 text-xs"><SelectValue placeholder="Group" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All groups</SelectItem>
                {groups.map((g: import('@/src/types/vehicle').VehicleGroup) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <DataTable
            columns={columns}
            data={data?.data ?? []}
            isLoading={isLoading}
            error={isError ? 'Failed to load vehicles' : null}
            onRetry={refetch}
            searchValue={filters.search}
            onSearchChange={(v) => { filters.setSearch(v); filters.setPage(1); }}
            searchPlaceholder="Search by plate, model, driver..."
            onRowClick={(row) => { setEditing(row); setFormOpen(true); }}
            serverPagination={{
              page: filters.page,
              pageSize: filters.pageSize,
              total: data?.total ?? 0,
              totalPages: data?.totalPages ?? 1,
              onPageChange: (p) => filters.setPage(p),
            }}
          />
        </CardContent>
      </Card>

      <VehicleFormDialog open={formOpen} onOpenChange={setFormOpen} vehicle={editing} groups={groups} />

      <VehicleHistoryModal
        open={historyModalOpen}
        onOpenChange={setHistoryModalOpen}
        vehicleIdOrPlate={historyVehicleId}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete vehicle?"
        description={`This will permanently delete vehicle ${deleting?.plateNumber ?? ''}. This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
