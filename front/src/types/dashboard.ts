import type { Violation, AuditLog, Override, DispatchRecord, DispatchRevenue } from '@/src/types/operations';

export interface DashboardStats {
  vehiclesInQueue: number;
  vehiclesDispatchedToday: number;
  activeRoutes: number;
  activeTerminals: number;
  activeDispatchers: number;
  violationsToday: number;
  offlineDevices: number;
  pendingSyncActions: number;
  activeAssignments: number;
  dispatchRevenueToday: number;
}

export interface TrendPoint {
  date: string;
  value: number;
}

export interface ViolationByRoute {
  route: string;
  count: number;
}

export interface TerminalUtilization {
  terminal: string;
  utilization: number;
}

export interface RecentDispatch {
  id: string;
  plateNumber: string;
  route: string;
  terminal: string;
  dispatcher: string;
  dispatchedAt: string;
  status: string;
}

export interface DashboardData {
  stats: DashboardStats;
  dispatchTrend: TrendPoint[];
  queueTrend: TrendPoint[];
  violationsByRoute: ViolationByRoute[];
  terminalUtilization: TerminalUtilization[];
  dailyActivity: TrendPoint[];
  recentDispatches: RecentDispatch[];
  recentViolations: Violation[];
  recentAuditLogs: AuditLog[];
  recentOverrides: Override[];
}

export interface DispatcherAssignmentInfo {
  assignmentId: string;
  route: string;
  vehicleGroup: string;
  originTerminal: string;
  destinationTerminal: string;
}

export interface DispatcherDashboardData {
  todayAssignments: DispatcherAssignmentInfo[];
  assignedTerminal: string;
  assignedRoutes: string[];
  assignedVehicleGroups: string[];
  liveQueue: { position: number; plateNumber: string; status: string }[];
  vehiclesWaiting: number;
  vehiclesDispatchedToday: number;
  dispatchRevenueToday: number;
  dispatchRevenueWeek: number;
  recentDispatchHistory: DispatchRecord[];
  dispatchRevenue: DispatchRevenue;
}
