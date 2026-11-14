'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type ApiError } from '@/src/services/api';
import type { CustomRole, Permission } from '@/src/types/user';
import { PageHeader } from '@/src/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Shield, Lock } from 'lucide-react';

export default function RolesPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CustomRole | null>(null);
  const qc = useQueryClient();

  const { data: roles, isLoading } = useQuery<import('@/src/types/user').CustomRole[]>({ queryKey: ['roles'], queryFn: api.rbac.getRoles });
  const { data: permissions } = useQuery<import('@/src/types/user').Permission[]>({ queryKey: ['permissions'], queryFn: api.rbac.getPermissions });

  const deleteMut = useMutation({
    mutationFn: api.rbac.deleteRole,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); toast.success('Role deleted'); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const modules: string[] = Array.from(new Set((permissions ?? []).map((p: import('@/src/types/user').Permission) => p.module)));

  return (
    <div className="space-y-6">
      <PageHeader title="Roles & Permissions" description="Manage roles and assign permissions dynamically (RBAC)" actions={<Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Create Role</Button>} />

      <div className="grid gap-4 lg:grid-cols-2">
        {isLoading && <p className="text-sm text-muted-foreground">Loading roles...</p>}
        {(roles ?? []).map((role: import('@/src/types/user').CustomRole) => (
          <Card key={role.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Shield className="h-4 w-4" /></div>
                  <div>
                    <CardTitle className="text-base">{role.label}</CardTitle>
                    <CardDescription className="text-xs">{role.description}</CardDescription>
                  </div>
                </div>
                {role.isSystem && <Badge variant="outline" className="border-info/20 bg-info/10 text-info text-xs"><Lock className="mr-1 h-3 w-3" /> System</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Permissions</span>
                <span className="font-medium">{role.permissionIds.length} / {permissions?.length ?? 0}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {role.permissionIds.slice(0, 5).map((pid: string) => {
                  const perm = permissions?.find((p: import('@/src/types/user').Permission) => p.id === pid);
                  return perm ? <Badge key={pid} variant="outline" className="text-xs">{perm.label}</Badge> : null;
                })}
                {role.permissionIds.length > 5 && <Badge variant="outline" className="text-xs">+{role.permissionIds.length - 5} more</Badge>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setEditing(role); setFormOpen(true); }}><Pencil className="mr-1 h-3 w-3" /> Edit</Button>
                {!role.isSystem && <Button variant="outline" size="sm" className="text-destructive" onClick={() => deleteMut.mutate(role.id)}><Trash2 className="mr-1 h-3 w-3" /> Delete</Button>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <RoleFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} permissions={permissions ?? []} modules={modules} />
    </div>
  );
}

function RoleFormDialog({ open, onOpenChange, editing, permissions, modules }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: CustomRole | null;
  permissions: Permission[];
  modules: string[];
}) {
  const [name, setName] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const qc = useQueryClient();

  // Sync state when dialog opens
  if (open && editing && selectedPerms.length === 0 && name === '') {
    setName(editing.label);
    setLabel(editing.label);
    setDescription(editing.description ?? '');
    setSelectedPerms(editing.permissionIds);
  }
  if (open && !editing && name === '' && selectedPerms.length === 0 && label === '') {
    // fresh form, do nothing
  }

  const createMut = useMutation({
    mutationFn: () => api.rbac.createRole({ name: name.toUpperCase().replace(/\s/g, '_'), label, description, isSystem: false, permissionIds: selectedPerms as string[] }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); toast.success('Role created'); onOpenChange(false); resetForm(); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: () => api.rbac.updateRole(editing!.id, { label, description, permissionIds: selectedPerms as string[] }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); toast.success('Role updated'); onOpenChange(false); resetForm(); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const resetForm = () => { setName(''); setLabel(''); setDescription(''); setSelectedPerms([]); };

  const togglePerm = (id: string) => {
    setSelectedPerms((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
  };

  const toggleModule = (module: string) => {
    const modulePerms = permissions.filter((p: import('@/src/types/user').Permission) => p.module === module).map((p: import('@/src/types/user').Permission) => p.id);
    const allSelected = modulePerms.every((id) => selectedPerms.includes(id));
    if (allSelected) {
      setSelectedPerms((prev) => prev.filter((id) => !modulePerms.includes(id)));
    } else {
      setSelectedPerms((prev) => [...new Set([...prev, ...modulePerms])]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{editing ? `Edit Role: ${editing.label}` : 'Create Custom Role'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Role Name</Label><Input value={label} onChange={(e) => { setLabel(e.target.value); setName(e.target.value); }} placeholder="Terminal Supervisor" disabled={editing?.isSystem} /></div>
            <div className="space-y-2"><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Manages terminal operations" /></div>
          </div>
          <div>
            <Label className="mb-2 block">Permissions</Label>
            <ScrollArea className="h-[300px] rounded-md border border-border">
              <div className="p-4 space-y-4">
                {modules.map((module) => {
                  const modulePerms = permissions.filter((p) => p.module === module);
                  const allSelected = modulePerms.every((p: import('@/src/types/user').Permission) => selectedPerms.includes(p.id));
                  return (
                    <div key={module} className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={allSelected} onCheckedChange={() => toggleModule(module)} />
                        <span className="text-sm font-semibold">{module}</span>
                      </label>
                      <div className="ml-6 space-y-1">
                        {modulePerms.map((p: import('@/src/types/user').Permission) => (
                          <label key={p.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1">
                            <Checkbox checked={selectedPerms.includes(p.id)} onCheckedChange={() => togglePerm(p.id)} />
                            <div>
                              <span className="text-sm">{p.label}</span>
                              <span className="ml-2 text-xs text-muted-foreground">{p.name}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => editing ? updateMut.mutate() : createMut.mutate()} disabled={createMut.isPending || updateMut.isPending || !label}>
            {createMut.isPending || updateMut.isPending ? 'Saving...' : 'Save Role'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
