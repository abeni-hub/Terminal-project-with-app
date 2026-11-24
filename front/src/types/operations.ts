export type AssignmentStatus = 'DRAFT' | 'REVIEWED' | 'PUBLISHED' | 'LOCKED' | 'ARCHIVED';

/**
 * Route assignment entity.
 * In production municipal planning, assignments are scheduled once every 3 months (quarterly period),
 * where weekNumber stores the Quarter / Period number (1 to 4) and weekStart / weekEnd span the 3-month cycle.
 */
export interface WeeklyRouteAssignment {
  id: string;
  name: string;
  weekNumber: number; // Quarter / Period Number (1: Q1, 2: Q2, 3: Q3, 4: Q4)
  weekStart: string;  // Start date of 3-month period
  weekEnd: string;    // End date of 3-month period
  vehicleGroupId: string;
  vehicleGroupName: string;
  originTerminalId: string;
  originTerminalName: string;
  destinationTerminalId: string;
  destinationTerminalName: string;
  dispatcherIds: string[];
  dispatcherNames: string[];
  status: AssignmentStatus;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  lockedAt?: string | null;
  lockedBy?: string | null;
  conflictCount: number;
  conflicts: AssignmentConflict[];
  createdAt: string;
  updatedAt: string;
}

export type PeriodicRouteAssignment = WeeklyRouteAssignment;

export interface AssignmentConflict {
  type: 'GROUP_ALREADY_ASSIGNED' | 'DISPATCHER_OVERBOOKED' | 'TERMINAL_MISMATCH';
  message: string;
  conflictingAssignmentId?: string;
}

export type QueueStatus =
  | 'WAITING'
  | 'LOADING'
  | 'READY_TO_DEPART'
  | 'DETECTED_AT_EXIT'
  | 'DISPATCHED'
  | 'CANCELLED'
  | 'NO_SHOW';

export type PaymentStatus = 'PENDING' | 'PAID' | 'WAIVED' | 'CANCELLED';

export interface QueueEntry {
  id: string;
  vehicleId: string;
  plateNumber: string;
  vehicleGroupName: string;
  assignmentId: string;
  terminalId: string;
  terminalName: string;
  destinationTerminalName: string;
  position: number;
  status: QueueStatus;
  entryType?: 'AUTO_RECOGNIZED' | 'MANUAL' | 'VIOLATION';
  confidence?: number;
  cameraId?: string;
  exitCameraId?: string;
  checkedInAt: string;
  checkedInBy: string;
  dispatchInTime?: string;
  exitCapturedAt?: string;
  dispatchedAt?: string;
  dispatchedBy?: string;
  isViolation: boolean;
  violationRemark?: string;
}

export interface DispatchRecord {
  id: string;
  vehicleId: string;
  plateNumber: string;
  vehicleGroupId: string;
  vehicleGroupName: string;
  originTerminalId: string;
  originTerminalName: string;
  destinationTerminalId: string;
  destinationTerminalName: string;
  dispatcherId: string;
  dispatcherName: string;
  dispatchTime: string;
  entryTime?: string;
  dispatchInTime?: string;
  dispatchOutTime?: string;
  queuePosition: number;
  feeAmount: number;
  feeRuleId: string;
  paymentStatus: PaymentStatus;
  paymentReference?: string;
  paymentCollectorName?: string;
  paymentConfirmedAt?: string;
  tripStatus?: string;
  departureConfirmed?: boolean;
  deviceId?: string;
  auditRef: string;
}

export interface DispatchFeeRule {
  id: string;
  name: string;
  amount: number;
  currency: string;
  vehicleType: VehicleType;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DispatchRevenue {
  daily: number;
  weekly: number;
  monthly: number;
  byTerminal: { terminal: string; revenue: number }[];
  byRoute: { route: string; revenue: number }[];
  byDispatcher: { dispatcher: string; revenue: number }[];
  trend: { date: string; revenue: number }[];
}

export type ViolationSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ViolationStatus =
  | 'OPEN'
  | 'IN_REVIEW'
  | 'UNDER_REVIEW'
  | 'PENALTY_APPLIED'
  | 'PAID'
  | 'WAIVED'
  | 'RESOLVED'
  | 'DISMISSED';

export interface Violation {
  id: string;
  vehicleId: string;
  plateNumber: string;
  assignmentId?: string;
  routeId?: string;
  terminalId?: string;
  assignedTerminalId?: string;
  assignedRouteId?: string;
  entryRecognitionEventId?: string;
  imagePath?: string;
  type: string;
  description: string;
  severity: ViolationSeverity;
  status: ViolationStatus;
  reportedBy: string;
  reportedAt: string;
  resolvedAt?: string;
  resolution?: string;
  resolutionAction?: string;
  dispatcherId?: string;
  remark?: string;
  queueEntryId?: string;
  originalDispatchFee?: number;
  penaltyAmount?: number;
  totalAmountDue?: number;
  evidence?: string;
}

export interface Override {
  id: string;
  requestedBy: string;
  action: string;
  reason: string;
  assignmentId?: string;
  status: OverrideStatus;
  approvedBy?: string;
  approvedAt?: string;
  auditRef?: string;
  createdAt: string;
}

export type OverrideStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AuditLog {
  id: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  ipAddress?: string;
  timestamp: string;
}

export type DeviceStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'OFFLINE';

export interface Device {
  id: string;
  name: string;
  deviceId: string;
  terminalId?: string;
  status: DeviceStatus;
  lastSyncAt?: string;
  appVersion?: string;
}

export interface VehicleHistoryResponse {
  vehicle: {
    id: string;
    plateNumber: string;
    model: string;
    type: VehicleType;
    capacity: number;
    status: string;
    groupId: string;
    groupName: string;
    driverName?: string;
    driverPhone?: string;
    lastMaintenance?: string;
    createdAt: string;
  };
  assignments: {
    id: string;
    name: string;
    weekNumber: number;
    weekStart: string;
    weekEnd: string;
    status: AssignmentStatus;
    route: string;
    originTerminalName: string;
    destinationTerminalName: string;
  }[];
  queueEntries: QueueEntry[];
  dispatchRecords: DispatchRecord[];
  violations: Violation[];
  recognitionEvents: {
    id: string;
    cameraName: string;
    cameraType: string;
    terminalName: string;
    confidence: number;
    capturedAt: string;
    imagePath?: string;
    processingResult: string;
    remarks?: string;
  }[];
  auditLogs: AuditLog[];
}

import type { VehicleType } from '@/src/types/vehicle';
