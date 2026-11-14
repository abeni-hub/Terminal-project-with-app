import { z } from 'zod';

export const vehicleSchema = z.object({
  plateNumber: z.string().min(3, 'Plate number must be at least 3 characters'),
  model: z.string().min(2, 'Model is required'),
  type: z.enum(['BUS', 'MINIBUS', 'COASTER', 'TRUCK']),
  capacity: z.coerce.number().int().min(1, 'Capacity must be at least 1').max(200, 'Capacity seems too high'),
  status: z.enum(['IDLE', 'WAITING', 'DISPATCHED', 'IN_TRANSIT', 'MAINTENANCE', 'OFFLINE']),
  groupId: z.string().min(1, 'Vehicle group is required'),
  driverName: z.string().optional(),
  driverPhone: z.string().optional(),
});

export type VehicleFormData = z.infer<typeof vehicleSchema>;
