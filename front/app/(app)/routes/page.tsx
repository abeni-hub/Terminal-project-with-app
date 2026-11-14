'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { api, type ApiError } from '@/src/services/api';
import { PageHeader } from '@/src/components/PageHeader';
import { DataTable } from '@/src/components/DataTable';
import { StatusBadge } from '@/src/components/StatusBadge';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ROUTE_STATUS_LABELS } from '@/src/constants';
import { Plus, Pencil, Trash2, Route as RouteIcon } from 'lucide-react';
import type { Route, RouteStatus, Terminal } from '@/src/types/terminal';
import type { PaginatedResponse } from '@/src/services/http';

const schema = z.object({
  name: z.string().min(2, 'Name required'),
  code: z.string().min(2, 'Code required'),
  originTerminalId: z.string().min(1, 'Origin terminal required'),
  destinationTerminalId: z.string().min(1, 'Destination terminal required'),
  distanceKm: z.coerce.number().min(0.1),
  estimatedMinutes: z.coerce.number().int().min(1),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PLANNED']),
});
type FormData = z.infer<typeof schema>;

const statusVariant: Record<RouteStatus, 'success' | 'muted' | 'info'> = { ACTIVE: 'success', INACTIVE: 'muted', PLANNED: 'info' };

export default function RoutesPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Route | null>(null);
  const [deleting, setDeleting] = useState<Route | null>(null);
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery<PaginatedResponse<Route>>({ queryKey: ['routes', { page, pageSize: 10, search }], queryFn: () => api.routes.list({ page, pageSize: 10, search }) });
  const { data: terminalsData } = useQuery({ queryKey: ['terminals-all'], queryFn: () => api.terminals.list({ page: 1, pageSize: 100 }) });
  const terminals = terminalsData?.data ?? [];

  const createMut = useMutation({ mutationFn: api.routes.create, onSuccess: () => { qc.invalidateQueries({ queryKey: ['routes'] }); toast.success('Route created'); setFormOpen(false); }, onError: (e: ApiError) => toast.error(e.message) });
  const updateMut = useMutation({ mutationFn: ({ id, data }: { id: string; data: Partial<Route> }) => api.routes.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['routes'] }); toast.success('Route updated'); setFormOpen(false); } });
  const deleteMut = useMutation({ mutationFn: api.routes.delete, onSuccess: () => { qc.invalidateQueries({ queryKey: ['routes'] }); toast.success('Route deleted'); setDeleting(null); } });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });
  const statusValue = watch('status');
  const originValue = watch('originTerminalId');
  const destValue = watch('destinationTerminalId');

  const openForm = (r?: Route) => { setEditing(r ?? null); if (r) reset({ name: r.name, code: r.code, originTerminalId: r.originTerminalId, destinationTerminalId: r.destinationTerminalId, distanceKm: r.distanceKm, estimatedMinutes: r.estimatedMinutes, status: r.status }); else reset({ name: '', code: '', originTerminalId: '', destinationTerminalId: '', distanceKm: 1, estimatedMinutes: 10, status: 'PLANNED' }); setFormOpen(true); };

  const terminalName = (id: string) => terminals.find((t: Terminal) => t.id === id)?.name ?? '-';

  const columns = useMemo<ColumnDef<Route>[]>(() => [
    { accessorKey: 'name', header: 'Name', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: 'code', header: 'Code', cell: ({ row }) => <span className="font-mono text-xs">{row.original.code}</span> },
    { accessorKey: 'originTerminalId', header: 'From', cell: ({ row }) => <span className="text-xs">{terminalName(row.original.originTerminalId)}</span> },
    { accessorKey: 'destinationTerminalId', header: 'To', cell: ({ row }) => <span className="text-xs">{terminalName(row.original.destinationTerminalId)}</span> },
    { accessorKey: 'distanceKm', header: 'Distance (km)', cell: ({ row }) => <span className="text-xs">{row.original.distanceKm} km</span> },
    { accessorKey: 'estimatedMinutes', header: 'Est. Time', cell: ({ row }) => <span className="text-xs">{row.original.estimatedMinutes} min</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge label={ROUTE_STATUS_LABELS[row.original.status]} variant={statusVariant[row.original.status]} /> },
    {
      id: 'actions', header: '', enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openForm(row.original)}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleting(row.original)}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      ),
    },
  ], [terminals]);

  return (
    <div className="space-y-6">
      <PageHeader title="Routes" description="Manage transport routes between terminals" actions={<Button onClick={() => openForm()}><Plus className="mr-2 h-4 w-4" /> Add Route</Button>} />

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        error={isError ? 'Failed to load routes' : null}
        onRetry={refetch}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search routes..."
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
          <DialogHeader><DialogTitle>{editing ? 'Edit Route' : 'Add Route'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => editing ? updateMut.mutate({ id: editing.id, data: d }) : createMut.mutate(d as Parameters<typeof api.routes.create>[0]))} className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input {...register('name')} />{errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}</div>
            <div className="space-y-2"><Label>Code</Label><Input {...register('code')} />{errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}</div>
            <div className="space-y-2"><Label>Origin Terminal</Label><Select value={originValue} onValueChange={(v) => setValue('originTerminalId', v)}><SelectTrigger><SelectValue placeholder="Select origin" /></SelectTrigger><SelectContent>{terminals.map((t: Terminal) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select>{errors.originTerminalId && <p className="text-xs text-destructive">{errors.originTerminalId.message}</p>}</div>
            <div className="space-y-2"><Label>Destination Terminal</Label><Select value={destValue} onValueChange={(v) => setValue('destinationTerminalId', v)}><SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger><SelectContent>{terminals.map((t: Terminal) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select>{errors.destinationTerminalId && <p className="text-xs text-destructive">{errors.destinationTerminalId.message}</p>}</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Distance (km)</Label><Input type="number" step="0.1" {...register('distanceKm')} />{errors.distanceKm && <p className="text-xs text-destructive">{errors.distanceKm.message}</p>}</div>
              <div className="space-y-2"><Label>Est. Minutes</Label><Input type="number" {...register('estimatedMinutes')} />{errors.estimatedMinutes && <p className="text-xs text-destructive">{errors.estimatedMinutes.message}</p>}</div>
            </div>
            <div className="space-y-2"><Label>Status</Label><Select value={statusValue} onValueChange={(v) => setValue('status', v as RouteStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(ROUTE_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button><Button type="submit" disabled={createMut.isPending || updateMut.isPending}>{createMut.isPending || updateMut.isPending ? 'Saving...' : 'Save'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title="Delete route?" description={`This will permanently delete ${deleting?.name ?? ''}.`} confirmLabel="Delete" destructive loading={deleteMut.isPending} onConfirm={() => deleting && deleteMut.mutate(deleting.id)} />
    </div>
  );
}
