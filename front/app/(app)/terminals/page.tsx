'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { api, type ApiError } from '@/src/services/api';
import type { Terminal } from '@/src/types/terminal';
import { PageHeader } from '@/src/components/PageHeader';
import { DataTable } from '@/src/components/DataTable';
import { StatusBadge } from '@/src/components/StatusBadge';
import { StatCard } from '@/src/components/StatCard';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { TERMINAL_STATUS_LABELS } from '@/src/constants';
import { Plus, Pencil, Trash2, Building2, MapPin } from 'lucide-react';
import type { TerminalStatus } from '@/src/types/terminal';
import type { PaginatedResponse } from '@/src/services/http';

const schema = z.object({
  name: z.string().min(2, 'Name required'),
  code: z.string().min(2, 'Code required'),
  address: z.string().min(3, 'Address required'),
  capacity: z.coerce.number().int().min(1),
  status: z.enum(['OPERATIONAL', 'DEGRADED', 'OFFLINE', 'MAINTENANCE']),
});
type FormData = z.infer<typeof schema>;

const statusVariant: Record<TerminalStatus, 'success' | 'warning' | 'danger' | 'muted'> = {
  OPERATIONAL: 'success',
  DEGRADED: 'warning',
  OFFLINE: 'danger',
  MAINTENANCE: 'muted',
};

export default function TerminalsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Terminal | null>(null);
  const [deleting, setDeleting] = useState<Terminal | null>(null);
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery<PaginatedResponse<Terminal>>({ queryKey: ['terminals', { page, pageSize: 10, search }], queryFn: () => api.terminals.list({ page, pageSize: 10, search }) });
  const createMut = useMutation({ mutationFn: api.terminals.create, onSuccess: () => { qc.invalidateQueries({ queryKey: ['terminals'] }); toast.success('Terminal created'); setFormOpen(false); }, onError: (e: ApiError) => toast.error(e.message) });
  const updateMut = useMutation({ mutationFn: ({ id, data }: { id: string; data: Partial<Terminal> }) => api.terminals.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['terminals'] }); toast.success('Terminal updated'); setFormOpen(false); } });
  const deleteMut = useMutation({ mutationFn: api.terminals.delete, onSuccess: () => { qc.invalidateQueries({ queryKey: ['terminals'] }); toast.success('Terminal deleted'); setDeleting(null); } });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });
  const statusValue = watch('status');

  const openForm = (t?: Terminal) => { setEditing(t ?? null); if (t) reset({ name: t.name, code: t.code, address: t.address, capacity: t.capacity, status: t.status }); else reset({ name: '', code: '', address: '', capacity: 50, status: 'OPERATIONAL' }); setFormOpen(true); };

  const columns = useMemo<ColumnDef<Terminal>[]>(() => [
    { accessorKey: 'name', header: 'Name', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: 'code', header: 'Code', cell: ({ row }) => <span className="font-mono text-xs">{row.original.code}</span> },
    { accessorKey: 'address', header: 'Address', cell: ({ row }) => <span className="flex items-center gap-1 text-xs"><MapPin className="h-3 w-3 text-muted-foreground" />{row.original.address}</span> },
    { accessorKey: 'capacity', header: 'Capacity' },
    { accessorKey: 'activeVehicles', header: 'Active Vehicles' },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge label={TERMINAL_STATUS_LABELS[row.original.status]} variant={statusVariant[row.original.status]} /> },
    {
      id: 'actions', header: '', enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openForm(row.original)}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleting(row.original)}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      ),
    },
  ], []);

  return (
    <div className="space-y-6">
      <PageHeader title="Terminals" description="Manage transport terminals, capacity, and status" actions={<Button onClick={() => openForm()}><Plus className="mr-2 h-4 w-4" /> Add Terminal</Button>} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Terminals" value={data?.total ?? 0} icon={Building2} variant="default" />
        <StatCard label="Operational" value={(data?.data ?? []).filter((t: Terminal) => t.status === 'OPERATIONAL').length} icon={Building2} variant="success" />
        <StatCard label="Degraded" value={(data?.data ?? []).filter((t: Terminal) => t.status === 'DEGRADED').length} icon={Building2} variant="warning" />
        <StatCard label="Offline" value={(data?.data ?? []).filter((t: Terminal) => t.status === 'OFFLINE' || t.status === 'MAINTENANCE').length} icon={Building2} variant="danger" />
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        error={isError ? 'Failed to load terminals' : null}
        onRetry={refetch}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search terminals..."
        serverPagination={{
          page,
          pageSize: 10,
          total: data?.total ?? 0,
          totalPages: data?.totalPages ?? 1,
          onPageChange: (p) => setPage(p),
        }}
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Edit Terminal' : 'Add Terminal'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => editing ? updateMut.mutate({ id: editing.id, data: d }) : createMut.mutate(d as Parameters<typeof api.terminals.create>[0]))} className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input {...register('name')} />{errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}</div>
            <div className="space-y-2"><Label>Code</Label><Input {...register('code')} />{errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}</div>
            <div className="space-y-2"><Label>Address</Label><Input {...register('address')} />{errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Capacity</Label><Input type="number" {...register('capacity')} />{errors.capacity && <p className="text-xs text-destructive">{errors.capacity.message}</p>}</div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusValue} onValueChange={(v) => setValue('status', v as TerminalStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TERMINAL_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>{createMut.isPending || updateMut.isPending ? 'Saving...' : 'Save'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title="Delete terminal?" description={`This will permanently delete ${deleting?.name ?? ''}.`} confirmLabel="Delete" destructive loading={deleteMut.isPending} onConfirm={() => deleting && deleteMut.mutate(deleting.id)} />
    </div>
  );
}
