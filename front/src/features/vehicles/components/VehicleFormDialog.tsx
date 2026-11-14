'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, type ApiError } from '@/src/services/api';
import { vehicleSchema, type VehicleFormData } from '@/src/features/vehicles/schemas/vehicle-schema';
import type { Vehicle } from '@/src/types/vehicle';
import type { VehicleGroup } from '@/src/types/vehicle';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VEHICLE_STATUS_LABELS, VEHICLE_TYPE_LABELS } from '@/src/constants';

interface VehicleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle?: Vehicle | null;
  groups: VehicleGroup[];
}

export function VehicleFormDialog({ open, onOpenChange, vehicle, groups }: VehicleFormDialogProps) {
  const isEdit = !!vehicle;
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: { type: 'BUS', status: 'IDLE', capacity: 30, groupId: '' },
  });

  useEffect(() => {
    if (open) {
      if (vehicle) {
        reset({
          plateNumber: vehicle.plateNumber,
          model: vehicle.model,
          type: vehicle.type,
          capacity: vehicle.capacity,
          status: vehicle.status,
          groupId: vehicle.groupId,
          driverName: vehicle.driverName,
          driverPhone: vehicle.driverPhone,
        });
      } else {
        reset({ type: 'BUS', status: 'IDLE', capacity: 30, groupId: '' });
      }
    }
  }, [open, vehicle, reset]);

  const mutation = useMutation({
    mutationFn: async (data: VehicleFormData) => {
      if (isEdit && vehicle) return api.vehicles.update(vehicle.id, data);
      return api.vehicles.create(data as Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Vehicle updated successfully' : 'Vehicle created successfully');
      onOpenChange(false);
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const statusValue = watch('status');
  const typeValue = watch('type');
  const groupValue = watch('groupId');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Vehicle' : 'Add New Vehicle'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="plateNumber">Plate Number</Label>
              <Input id="plateNumber" placeholder="AA-00001" {...register('plateNumber')} />
              {errors.plateNumber && <p className="text-xs text-destructive">{errors.plateNumber.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input id="model" placeholder="Toyota Coaster" {...register('model')} />
              {errors.model && <p className="text-xs text-destructive">{errors.model.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select value={typeValue} onValueChange={(v) => setValue('type', v as VehicleFormData['type'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(VEHICLE_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="capacity">Capacity</Label>
              <Input id="capacity" type="number" {...register('capacity')} />
              {errors.capacity && <p className="text-xs text-destructive">{errors.capacity.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Vehicle Group</Label>
            <Select value={groupValue} onValueChange={(v) => setValue('groupId', v)}>
              <SelectTrigger><SelectValue placeholder="Select vehicle group" /></SelectTrigger>
              <SelectContent>
                {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name} ({g.vehicleCount} vehicles)</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.groupId && <p className="text-xs text-destructive">{errors.groupId.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={statusValue} onValueChange={(v) => setValue('status', v as VehicleFormData['status'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(VEHICLE_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="driverName">Driver Name</Label>
              <Input id="driverName" placeholder="Driver name" {...register('driverName')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="driverPhone">Driver Phone</Label>
              <Input id="driverPhone" placeholder="+251..." {...register('driverPhone')} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Vehicle'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
