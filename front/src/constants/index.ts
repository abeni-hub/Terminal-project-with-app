import type { BuiltInRole } from '@/src/types/user';
import type { VehicleStatus, VehicleType } from '@/src/types/vehicle';
import type { TerminalStatus, RouteStatus } from '@/src/types/terminal';
import type { ViolationSeverity, ViolationStatus, OverrideStatus, DeviceStatus, QueueStatus, AssignmentStatus } from '@/src/types/operations';

export const APP_NAME = 'Addis Ababa Transport Office';
export const APP_SHORT_NAME = 'AATO Roster';
export const APP_TAGLINE = 'Terminal Digital Roster System';

export const STORAGE_KEYS = {
  SESSION: 'aato_session',
  THEME: 'aato_theme',
} as const;

export const BUILTIN_ROLE_IDS: Record<BuiltInRole, string> = {
  SUPER_ADMIN: 'role-super-admin',
  MUNICIPAL_PLANNER: 'role-planner',
  DISPATCHER: 'role-dispatcher',
};

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  IDLE: 'Idle',
  WAITING: 'Waiting',
  DISPATCHED: 'Dispatched',
  IN_TRANSIT: 'In Transit',
  MAINTENANCE: 'Maintenance',
  OFFLINE: 'Offline',
};

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  BUS: 'Bus',
  MINIBUS: 'Minibus',
  COASTER: 'Coaster',
  TRUCK: 'Truck',
};

export const TERMINAL_STATUS_LABELS: Record<TerminalStatus, string> = {
  OPERATIONAL: 'Operational',
  DEGRADED: 'Degraded',
  OFFLINE: 'Offline',
  MAINTENANCE: 'Maintenance',
};

export const ROUTE_STATUS_LABELS: Record<RouteStatus, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  PLANNED: 'Planned',
};

export const VIOLATION_SEVERITY_LABELS: Record<ViolationSeverity, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

export const VIOLATION_STATUS_LABELS: Record<ViolationStatus, string> = {
  OPEN: 'Open',
  IN_REVIEW: 'In Review',
  UNDER_REVIEW: 'Under Review',
  PENALTY_APPLIED: 'Penalty Applied',
  PAID: 'Paid',
  WAIVED: 'Waived',
  RESOLVED: 'Resolved',
  DISMISSED: 'Dismissed',
};

export const OVERRIDE_STATUS_LABELS: Record<OverrideStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export const DEVICE_STATUS_LABELS: Record<DeviceStatus, string> = {
  APPROVED: 'Approved',
  PENDING: 'Pending',
  REJECTED: 'Rejected',
  OFFLINE: 'Offline',
};

export const QUEUE_STATUS_LABELS: Record<QueueStatus, string> = {
  WAITING: 'Waiting In Yard',
  LOADING: 'Loading Passengers',
  READY_TO_DEPART: 'Ready to Depart',
  DETECTED_AT_EXIT: 'Detected at Exit Gate',
  DISPATCHED: 'Dispatched Out',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No Show',
};

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  DRAFT: 'Draft',
  REVIEWED: 'Reviewed',
  PUBLISHED: 'Published',
  LOCKED: 'Locked (Active)',
  ARCHIVED: 'Archived',
};

export const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
} as const;

export const PERMISSIONS = [
  { id: 'perm-dashboard-view', name: 'dashboard.view', label: 'View Dashboard', module: 'Dashboard' },
  { id: 'perm-users-manage', name: 'users.manage', label: 'Manage Users', module: 'Users' },
  { id: 'perm-roles-manage', name: 'roles.manage', label: 'Manage Roles & Permissions', module: 'RBAC' },
  { id: 'perm-terminals-manage', name: 'terminals.manage', label: 'Manage Terminals', module: 'Terminals' },
  { id: 'perm-routes-manage', name: 'routes.manage', label: 'Manage Routes', module: 'Routes' },
  { id: 'perm-vehicles-manage', name: 'vehicles.manage', label: 'Manage Vehicles', module: 'Vehicles' },
  { id: 'perm-groups-manage', name: 'groups.manage', label: 'Manage Vehicle Groups', module: 'Vehicle Groups' },
  { id: 'perm-assignments-create', name: 'assignments.create', label: 'Create Weekly Assignments', module: 'Weekly Planning' },
  { id: 'perm-assignments-publish', name: 'assignments.publish', label: 'Publish Weekly Assignments', module: 'Weekly Planning' },
  { id: 'perm-dispatcher-assign', name: 'dispatcher.assign', label: 'Assign Dispatchers', module: 'Dispatcher Assignment' },
  { id: 'perm-queue-view', name: 'queue.view', label: 'View Queue', module: 'Queue' },
  { id: 'perm-queue-checkin', name: 'queue.checkin', label: 'Check In Vehicles', module: 'Queue' },
  { id: 'perm-queue-dispatch', name: 'queue.dispatch', label: 'Dispatch Vehicles', module: 'Queue' },
  { id: 'perm-fees-manage', name: 'fees.manage', label: 'Configure Dispatch Fees', module: 'Fees' },
  { id: 'perm-violations-view', name: 'violations.view', label: 'View Violations', module: 'Violations' },
  { id: 'perm-violations-resolve', name: 'violations.resolve', label: 'Resolve Violations', module: 'Violations' },
  { id: 'perm-overrides-approve', name: 'overrides.approve', label: 'Approve Overrides', module: 'Overrides' },
  { id: 'perm-reports-view', name: 'reports.view', label: 'View Reports', module: 'Reports' },
  { id: 'perm-audit-view', name: 'audit.view', label: 'View Audit Logs', module: 'Audit Logs' },
  { id: 'perm-devices-manage', name: 'devices.manage', label: 'Manage Devices', module: 'Devices' },
  { id: 'perm-settings-manage', name: 'settings.manage', label: 'Manage System Settings', module: 'Settings' },
  { id: 'perm-override-operational', name: 'override.operational', label: 'Override Operational Restrictions', module: 'Overrides' },
] as const;

export type PermissionId = (typeof PERMISSIONS)[number]['id'];
