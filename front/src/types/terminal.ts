export type TerminalStatus = 'OPERATIONAL' | 'DEGRADED' | 'OFFLINE' | 'MAINTENANCE';

export interface Terminal {
  id: string;
  name: string;
  code: string;
  address: string;
  latitude: number;
  longitude: number;
  capacity: number;
  status: TerminalStatus;
  routeIds: string[];
  activeVehicles: number;
  createdAt: string;
  updatedAt: string;
}

export type RouteStatus = 'ACTIVE' | 'INACTIVE' | 'PLANNED';

export interface Route {
  id: string;
  name: string;
  code: string;
  originTerminalId: string;
  destinationTerminalId: string;
  distanceKm: number;
  estimatedMinutes: number;
  status: RouteStatus;
  createdAt: string;
  updatedAt: string;
}
