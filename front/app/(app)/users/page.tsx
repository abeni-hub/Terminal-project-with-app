'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { api, type ApiError } from '@/src/services/api';
import type { User } from '@/src/types/user';
import type { CustomRole } from '@/src/types/user';
import type { PaginatedResponse } from '@/src/services/http';
import { PageHeader } from '@/src/components/PageHeader';
import { DataTable } from '@/src/components/DataTable';
import { StatusBadge } from '@/src/components/StatusBadge';
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
import { UserPlus, Pencil, Trash2, KeyRound } from 'lucide-react';
import type { UserStatus } from '@/src/types/user';

const userSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email required'),
  phone: z.string().optional(),
  roleId: z.string().min(1, 'Role is required'),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'INVITED']),
  terminalId: z.string().optional(),
});
type UserFormData = z.infer<typeof userSchema>;

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery<PaginatedResponse<User>>({
    queryKey: ['users', { page, pageSize: 10, search }],
    queryFn: () => api.users.list({ page, pageSize: 10, search }),
  });
  const { data: rolesData } = useQuery<CustomRole[]>({ queryKey: ['roles'], queryFn: api.rbac.getRoles });
  const roles = rolesData ?? [];

  const createMutation = useMutation({ mutationFn: api.users.create, onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User created'); setFormOpen(false); }, onError: (e: ApiError) => toast.error(e.message) });
  const updateMutation = useMutation({ mutationFn: ({ id, data }: { id: string; data: Partial<User> }) => api.users.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User updated'); setFormOpen(false); }, onError: (e: ApiError) => toast.error(e.message) });
  const deleteMutation = useMutation({ mutationFn: api.users.delete, onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User deleted'); setDeleting(null); } });
  const resetMutation = useMutation({ mutationFn: api.users.resetPassword, onSuccess: () => toast.success('Password reset email sent') });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<UserFormData>({ resolver: zodResolver(userSchema) });

  const openForm = (user?: User) => {
    setEditing(user ?? null);
    if (user) reset({ name: user.name, email: user.email, phone: user.phone, roleId: user.roleId, status: user.status, terminalId: user.terminalId });
    else reset({ name: '', email: '', phone: '', roleId: '', status: 'ACTIVE' });
    setFormOpen(true);
  };

  const roleName = (roleId: string) => roles.find((r: import('@/src/types/user').CustomRole) => r.id === roleId)?.label ?? roleId;

  const columns = useMemo<ColumnDef<User>[]>(() => [
    { accessorKey: 'name', header: 'Name', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'roleId', header: 'Role', cell: ({ row }) => <span className="text-xs">{roleName(row.original.roleId)}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge label={row.original.status} variant={row.original.status === 'ACTIVE' ? 'success' : row.original.status === 'SUSPENDED' ? 'danger' : 'warning'} /> },
    {
      id: 'actions', header: '', enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openForm(row.original)}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => resetMutation.mutate(row.original.id)}><KeyRound className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleting(row.original)}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      ),
    },
  ], [roles]);

  const roleValue = watch('roleId');
  const statusValue = watch('status');

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description="Manage user accounts and assign roles" actions={<Button onClick={() => openForm()}><UserPlus className="mr-2 h-4 w-4" /> Add User</Button>} />

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        error={isError ? 'Failed to load users' : null}
        onRetry={refetch}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search by name, email..."
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
          <DialogHeader><DialogTitle>{editing ? 'Edit User' : 'Add New User'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => editing ? updateMutation.mutate({ id: editing.id, data: d }) : createMutation.mutate(d as Parameters<typeof api.users.create>[0]))} className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input {...register('name')} />{errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}</div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" {...register('email')} />{errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}</div>
            <div className="space-y-2"><Label>Phone</Label><Input {...register('phone')} /></div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={roleValue} onValueChange={(v) => setValue('roleId', v)}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>{roles.map((r: import('@/src/types/user').CustomRole) => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
              {errors.roleId && <p className="text-xs text-destructive">{errors.roleId.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusValue} onValueChange={(v) => setValue('status', v as UserStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="SUSPENDED">Suspended</SelectItem><SelectItem value="INVITED">Invited</SelectItem></SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>{createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title="Delete user?" description={`This will permanently delete ${deleting?.name ?? ''}.`} confirmLabel="Delete" destructive loading={deleteMutation.isPending} onConfirm={() => deleting && deleteMutation.mutate(deleting.id)} />
    </div>
  );
}
