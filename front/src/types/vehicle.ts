export type VehicleStatus =
  | 'IDLE'
  | 'WAITING'
  | 'DISPATCHED'
  | 'IN_TRANSIT'
  | 'MAINTENANCE'
  | 'OFFLINE';

export type VehicleType = 'BUS' | 'MINIBUS' | 'COASTER' | 'TRUCK';

export interface Vehicle {
  id: string;
  plateNumber: string;
  model: string;
  type: VehicleType;
  capacity: number;
  status: VehicleStatus;
  groupId: string;
  driverName?: string;
  driverPhone?: string;
  lastMaintenance?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleGroup {
  id: string;
  name: string;
  description?: string;
  vehicleCount: number;
  vehicleIds: string[];
}
