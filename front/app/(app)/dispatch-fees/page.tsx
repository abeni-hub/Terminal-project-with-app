'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type ApiError } from '@/src/services/api';
import type { DispatchFeeRule } from '@/src/types/operations';
import { PageHeader } from '@/src/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { VEHICLE_TYPE_LABELS } from '@/src/constants';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, DollarSign } from 'lucide-react';
import type { VehicleType } from '@/src/types/vehicle';

export default function DispatchFeesPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DispatchFeeRule | null>(null);
  const qc = useQueryClient();

  const { data: rules, isLoading } = useQuery<import('@/src/types/operations').DispatchFeeRule[]>({ queryKey: ['fee-rules'], queryFn: api.fees.list });

  const deleteMut = useMutation({
    mutationFn: api.fees.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fee-rules'] }); toast.success('Fee rule deleted'); },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Dispatch Fees" description="Configure dispatch fee rules for each vehicle type" actions={<Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add Fee Rule</Button>} />

      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Vehicle Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rules ?? []).map((rule: import('@/src/types/operations').DispatchFeeRule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell><Badge variant="outline">{VEHICLE_TYPE_LABELS[rule.vehicleType]}</Badge></TableCell>
                    <TableCell className="font-mono">{rule.amount}</TableCell>
                    <TableCell>{rule.currency}</TableCell>
                    <TableCell><Switch checked={rule.active} disabled /></TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(rule); setFormOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMut.mutate(rule.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <FeeRuleDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} />
    </div>
  );
}

function FeeRuleDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (o: boolean) => void; editing: DispatchFeeRule | null }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(0);
  const [currency, setCurrency] = useState('ETB');
  const [vehicleType, setVehicleType] = useState<VehicleType>('BUS');
  const [active, setActive] = useState(true);
  const qc = useQueryClient();

  useState(() => {
    if (editing) { setName(editing.name); setAmount(editing.amount); setCurrency(editing.currency); setVehicleType(editing.vehicleType); setActive(editing.active); }
  });

  const createMut = useMutation({
    mutationFn: () => api.fees.create({ name, amount, currency, vehicleType, active }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fee-rules'] }); toast.success('Fee rule created'); onOpenChange(false); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: () => api.fees.update(editing!.id, { name, amount, currency, vehicleType, active }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fee-rules'] }); toast.success('Fee rule updated'); onOpenChange(false); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editing ? 'Edit Fee Rule' : 'Add Fee Rule'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Rule Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Standard Bus Fee" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Amount</Label><Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></div>
            <div className="space-y-2"><Label>Currency</Label><Input value={currency} onChange={(e) => setCurrency(e.target.value)} /></div>
          </div>
          <div className="space-y-2">
            <Label>Vehicle Type</Label>
            <Select value={vehicleType} onValueChange={(v) => setVehicleType(v as VehicleType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(VEHICLE_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div><p className="text-sm font-medium">Active</p><p className="text-xs text-muted-foreground">Inactive rules are not applied to dispatches</p></div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => editing ? updateMut.mutate() : createMut.mutate()} disabled={createMut.isPending || updateMut.isPending || !name}>
            {createMut.isPending || updateMut.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
