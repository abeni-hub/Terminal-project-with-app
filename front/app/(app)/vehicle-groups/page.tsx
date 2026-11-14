'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { api, type ApiError } from '@/src/services/api';
import type { VehicleGroup } from '@/src/types/vehicle';
import { PageHeader } from '@/src/components/PageHeader';
import { DataTable } from '@/src/components/DataTable';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Car } from 'lucide-react';

export default function VehicleGroupsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<VehicleGroup | null>(null);
  const [deleting, setDeleting] = useState<VehicleGroup | null>(null);
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['vehicle-groups', { page, pageSize: 10, search }],
    queryFn: () => api.vehicleGroups.list({ page, pageSize: 10, search }),
  });

  const deleteMut = useMutation({
    mutationFn: api.vehicleGroups.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicle-groups'] }); toast.success('Vehicle group deleted'); setDeleting(null); },
  });

  const columns = useMemo<ColumnDef<VehicleGroup>[]>(() => [
    { accessorKey: 'name', header: 'Group Name', cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Car className="h-4 w-4" /></div>
        <span className="font-medium">{row.original.name}</span>
      </div>
    ) },
    { accessorKey: 'description', header: 'Description', cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.description ?? '-'}</span> },
    { accessorKey: 'vehicleCount', header: 'Vehicles', cell: ({ row }) => <Badge variant="outline">{row.original.vehicleCount}</Badge> },
    { accessorKey: 'vehicleIds', header: 'Vehicle Plates', enableSorting: false, cell: ({ row }) => (
      <div className="flex flex-wrap gap-1 max-w-xs">
        {row.original.vehicleIds.slice(0, 3).map((id) => <Badge key={id} variant="outline" className="font-mono text-xs">{id}</Badge>)}
        {row.original.vehicleIds.length > 3 && <Badge variant="outline" className="text-xs">+{row.original.vehicleIds.length - 3}</Badge>}
      </div>
    ) },
    {
      id: 'actions', header: '', enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(row.original); setFormOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleting(row.original)}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      ),
    },
  ], []);

  return (
    <div className="space-y-6">
      <PageHeader title="Vehicle Groups" description="Manage vehicle groups - planning is performed at the group level" actions={<Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add Group</Button>} />

      <Card>
        <CardContent className="p-4">
          <DataTable
            columns={columns}
            data={data?.data ?? []}
            isLoading={isLoading}
            error={isError ? 'Failed to load groups' : null}
            onRetry={refetch}
            searchValue={search}
            onSearchChange={(v) => { setSearch(v); setPage(1); }}
            searchPlaceholder="Search vehicle groups..."
            serverPagination={{
              page,
              pageSize: 10,
              total: data?.total ?? 0,
              totalPages: data?.totalPages ?? 1,
              onPageChange: (p) => setPage(p),
            }}
          />
        </CardContent>
      </Card>

      <GroupFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} />

      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title="Delete vehicle group?" description={`This will permanently delete ${deleting?.name ?? ''}.`} confirmLabel="Delete" destructive loading={deleteMut.isPending} onConfirm={() => deleting && deleteMut.mutate(deleting.id)} />
    </div>
  );
}

function GroupFormDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (o: boolean) => void; editing: VehicleGroup | null }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const qc = useQueryClient();

  if (open && editing && name === '') { setName(editing.name); setDescription(editing.description ?? ''); }

  const createMut = useMutation({
    mutationFn: () => api.vehicleGroups.create({ name, description, vehicleCount: 0, vehicleIds: [] }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicle-groups'] }); toast.success('Vehicle group created'); onOpenChange(false); resetForm(); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: () => api.vehicleGroups.update(editing!.id, { name, description }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicle-groups'] }); toast.success('Vehicle group updated'); onOpenChange(false); resetForm(); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const resetForm = () => { setName(''); setDescription(''); };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editing ? 'Edit Vehicle Group' : 'Add Vehicle Group'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Group Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group A" /></div>
          <div className="space-y-2"><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Northern district fleet" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => editing ? updateMut.mutate() : createMut.mutate()} disabled={!name || createMut.isPending || updateMut.isPending}>
            {createMut.isPending || updateMut.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
