import type { User, CustomRole, Permission } from '@/src/types/user';
import type { Terminal, Route } from '@/src/types/terminal';
import type { Vehicle, VehicleGroup } from '@/src/types/vehicle';
import type { WeeklyRouteAssignment, QueueEntry, DispatchRecord, DispatchFeeRule, Violation, Override, AuditLog, Device } from '@/src/types/operations';
import { PERMISSIONS } from '@/src/constants';

const now = new Date();
const iso = (daysAgo: number, hoursAgo = 0) => {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(d.getHours() - hoursAgo);
  return d.toISOString();
};

const allPermissionIds = PERMISSIONS.map((p) => p.id);

export const mockPermissions: Permission[] = PERMISSIONS.map((p) => ({
  id: p.id,
  name: p.name,
  label: p.label,
  module: p.module,
  description: (p as { description?: string }).description,
}));

export const mockRoles: CustomRole[] = [
  {
    id: 'role-super-admin',
    name: 'SUPER_ADMIN',
    label: 'Super Administrator',
    description: 'Unrestricted access to the entire system',
    isSystem: true,
    permissionIds: [...allPermissionIds],
    createdAt: iso(200),
    updatedAt: iso(2),
  },
  {
    id: 'role-planner',
    name: 'MUNICIPAL_PLANNER',
    label: 'Municipal Planner',
    description: 'Plans weekly transport operations',
    isSystem: true,
    permissionIds: [
      'perm-dashboard-view',
      'perm-assignments-create',
      'perm-assignments-publish',
      'perm-dispatcher-assign',
      'perm-vehicles-manage',
      'perm-groups-manage',
      'perm-terminals-manage',
      'perm-routes-manage',
      'perm-reports-view',
      'perm-violations-view',
      'perm-settings-manage',
    ],
    createdAt: iso(200),
    updatedAt: iso(1),
  },
  {
    id: 'role-dispatcher',
    name: 'DISPATCHER',
    label: 'Dispatcher',
    description: 'Operational user - check-in and dispatch',
    isSystem: true,
    permissionIds: [
      'perm-dashboard-view',
      'perm-queue-view',
      'perm-queue-checkin',
      'perm-queue-dispatch',
      'perm-violations-view',
      'perm-reports-view',
    ],
    createdAt: iso(200),
    updatedAt: iso(0, 1),
  },
];

export const mockUsers: User[] = [
  { id: 'u1', name: 'Abebe Bekele', email: 'abebe@aato.gov.et', phone: '+251911000001', roleId: 'role-super-admin', status: 'ACTIVE', avatarColor: '#2176ff', lastActiveAt: iso(0, 1), createdAt: iso(120), updatedAt: iso(2) },
  { id: 'u2', name: 'Sara Tadesse', email: 'sara@aato.gov.et', phone: '+251911000002', roleId: 'role-planner', status: 'ACTIVE', avatarColor: '#16a34a', lastActiveAt: iso(0, 3), createdAt: iso(110), updatedAt: iso(1) },
  { id: 'u3', name: 'Dawit Kebede', email: 'dawit@aato.gov.et', phone: '+251911000003', roleId: 'role-dispatcher', status: 'ACTIVE', terminalId: 't2', avatarColor: '#f59e0b', lastActiveAt: iso(0, 0), createdAt: iso(100), updatedAt: iso(0, 1) },
  { id: 'u4', name: 'Helen Girma', email: 'helen@aato.gov.et', phone: '+251911000004', roleId: 'role-dispatcher', status: 'ACTIVE', terminalId: 't1', avatarColor: '#0ea5e9', lastActiveAt: iso(0, 2), createdAt: iso(90), updatedAt: iso(3) },
  { id: 'u5', name: 'Yonas Assefa', email: 'yonas@aato.gov.et', phone: '+251911000005', roleId: 'role-dispatcher', status: 'SUSPENDED', terminalId: 't3', avatarColor: '#ef4444', lastActiveAt: iso(5), createdAt: iso(80), updatedAt: iso(5) },
  { id: 'u6', name: 'Meron Tesfaye', email: 'meron@aato.gov.et', phone: '+251911000006', roleId: 'role-planner', status: 'ACTIVE', avatarColor: '#8b5cf6', lastActiveAt: iso(1), createdAt: iso(70), updatedAt: iso(1) },
  { id: 'u7', name: 'Solomon Haile', email: 'solomon@aato.gov.et', phone: '+251911000007', roleId: 'role-dispatcher', status: 'INVITED', terminalId: 't2', avatarColor: '#14b8a6', createdAt: iso(3), updatedAt: iso(3) },
  { id: 'u8', name: 'Bethel Alemu', email: 'bethel@aato.gov.et', phone: '+251911000008', roleId: 'role-super-admin', status: 'ACTIVE', avatarColor: '#f97316', lastActiveAt: iso(0, 5), createdAt: iso(60), updatedAt: iso(2) },
];

export const mockTerminals: Terminal[] = [
  { id: 't1', name: 'Megenagna Terminal', code: 'TRM-MGN', address: 'Megenagna, Addis Ababa', latitude: 9.0084, longitude: 38.7575, capacity: 80, status: 'OPERATIONAL', routeIds: ['r1', 'r2'], activeVehicles: 45, createdAt: iso(200), updatedAt: iso(1) },
  { id: 't2', name: 'Mercato Terminal', code: 'TRM-MRC', address: 'Addis Mercato, Addis Ababa', latitude: 9.0333, longitude: 38.7433, capacity: 120, status: 'OPERATIONAL', routeIds: ['r1', 'r3'], activeVehicles: 78, createdAt: iso(200), updatedAt: iso(2) },
  { id: 't3', name: 'Bole Airport Terminal', code: 'TRM-BOLE', address: 'Bole, Addis Ababa', latitude: 8.9806, longitude: 38.7969, capacity: 60, status: 'DEGRADED', routeIds: ['r2', 'r4'], activeVehicles: 30, createdAt: iso(190), updatedAt: iso(0, 2) },
  { id: 't4', name: 'Piazza Terminal', code: 'TRM-PZA', address: 'Piazza, Addis Ababa', latitude: 9.0372, longitude: 38.7467, capacity: 50, status: 'OPERATIONAL', routeIds: ['r3'], activeVehicles: 28, createdAt: iso(180), updatedAt: iso(3) },
  { id: 't5', name: 'Akaki Terminal', code: 'TRM-AKK', address: 'Akaki Kality, Addis Ababa', latitude: 8.8942, longitude: 38.7889, capacity: 40, status: 'MAINTENANCE', routeIds: ['r4'], activeVehicles: 0, createdAt: iso(170), updatedAt: iso(10) },
  { id: 't6', name: 'Kaliti Terminal', code: 'TRM-KAL', address: 'Kaliti, Addis Ababa', latitude: 8.9086, longitude: 38.7394, capacity: 35, status: 'OFFLINE', routeIds: [], activeVehicles: 0, createdAt: iso(160), updatedAt: iso(20) },
];

export const mockRoutes: Route[] = [
  { id: 'r1', name: 'Megenagna - Mercato Express', code: 'RTE-001', originTerminalId: 't1', destinationTerminalId: 't2', distanceKm: 6.5, estimatedMinutes: 25, status: 'ACTIVE', createdAt: iso(150), updatedAt: iso(5) },
  { id: 'r2', name: 'Megenagna - Bole Airport', code: 'RTE-002', originTerminalId: 't1', destinationTerminalId: 't3', distanceKm: 4.2, estimatedMinutes: 18, status: 'ACTIVE', createdAt: iso(150), updatedAt: iso(3) },
  { id: 'r3', name: 'Mercato - Piazza Loop', code: 'RTE-003', originTerminalId: 't2', destinationTerminalId: 't4', distanceKm: 3.1, estimatedMinutes: 15, status: 'ACTIVE', createdAt: iso(140), updatedAt: iso(7) },
  { id: 'r4', name: 'Bole - Akaki Corridor', code: 'RTE-004', originTerminalId: 't3', destinationTerminalId: 't5', distanceKm: 12.8, estimatedMinutes: 45, status: 'INACTIVE', createdAt: iso(130), updatedAt: iso(12) },
  { id: 'r5', name: 'Mercato - Bole', code: 'RTE-005', originTerminalId: 't2', destinationTerminalId: 't3', distanceKm: 5.0, estimatedMinutes: 20, status: 'ACTIVE', createdAt: iso(20), updatedAt: iso(2) },
  { id: 'r6', name: 'Mercato - Lebu', code: 'RTE-006', originTerminalId: 't2', destinationTerminalId: 't5', distanceKm: 8.5, estimatedMinutes: 30, status: 'ACTIVE', createdAt: iso(15), updatedAt: iso(1) },
];

const plateNum = (i: number) => `AA-${String(i).padStart(5, '0')}`;
const models = ['Toyota Coaster', 'Isuzu NPR', 'Hyundai County', 'Mitsubishi Rosa', 'King Long'];
const types: Vehicle['type'][] = ['BUS', 'MINIBUS', 'COASTER', 'TRUCK'];

const groupAssignments = [
  { groupId: 'g1', groupPrefix: 1, count: 16 },
  { groupId: 'g2', groupPrefix: 101, count: 16 },
  { groupId: 'g3', groupPrefix: 201, count: 16 },
];

export const mockVehicles: Vehicle[] = groupAssignments.flatMap((ga) =>
  Array.from({ length: ga.count }, (_, i) => {
    const idx = ga.groupPrefix + i;
    return {
      id: `v${ga.groupPrefix + i}`,
      plateNumber: `AA-${String(idx).padStart(5, '0')}`,
      model: models[i % models.length],
      type: types[i % types.length],
      capacity: [30, 45, 25, 15][i % 4],
      status: 'IDLE' as const,
      groupId: ga.groupId,
      driverName: ['Abebe', 'Kebede', 'Tesfaye', 'Girma'][i % 4],
      driverPhone: `+251912${String(100000 + idx).padStart(6, '0')}`,
      lastMaintenance: iso(i * 3),
      createdAt: iso(100 - (i % 50)),
      updatedAt: iso(i % 5),
    };
  }),
);

export const mockVehicleGroups: VehicleGroup[] = [
  { id: 'g1', name: 'Group A', description: 'Northern district fleet', vehicleCount: 16, vehicleIds: mockVehicles.filter((v) => v.groupId === 'g1').map((v) => v.id) },
  { id: 'g2', name: 'Group B', description: 'Southern district fleet', vehicleCount: 16, vehicleIds: mockVehicles.filter((v) => v.groupId === 'g2').map((v) => v.id) },
  { id: 'g3', name: 'Group C', description: 'Express routes fleet', vehicleCount: 16, vehicleIds: mockVehicles.filter((v) => v.groupId === 'g3').map((v) => v.id) },
];

function getWeekRange(weekNum: number): { start: string; end: string } {
  const year = now.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const dayOfWeek = jan1.getDay() || 7;
  const weekStart = new Date(year, 0, 1 + (weekNum - 1) * 7 - dayOfWeek + 1);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return { start: weekStart.toISOString().split('T')[0], end: weekEnd.toISOString().split('T')[0] };
}

const currentWeek = Math.ceil(((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 + new Date(now.getFullYear(), 0, 1).getDay() + 1) / 7);

export const mockWeeklyAssignments: WeeklyRouteAssignment[] = [
  {
    id: 'wa1',
    name: `Week ${currentWeek} - Group A - Mercato to Bole`,
    weekNumber: currentWeek,
    weekStart: getWeekRange(currentWeek).start,
    weekEnd: getWeekRange(currentWeek).end,
    vehicleGroupId: 'g1',
    vehicleGroupName: 'Group A',
    originTerminalId: 't2',
    originTerminalName: 'Mercato Terminal',
    destinationTerminalId: 't3',
    destinationTerminalName: 'Bole Airport Terminal',
    dispatcherIds: ['u3'],
    dispatcherNames: ['Dawit Kebede'],
    status: 'PUBLISHED',
    conflictCount: 0,
    conflicts: [],
    createdAt: iso(3),
    updatedAt: iso(1),
  },
  {
    id: 'wa2',
    name: `Week ${currentWeek} - Group B - Mercato to Piazza`,
    weekNumber: currentWeek,
    weekStart: getWeekRange(currentWeek).start,
    weekEnd: getWeekRange(currentWeek).end,
    vehicleGroupId: 'g2',
    vehicleGroupName: 'Group B',
    originTerminalId: 't2',
    originTerminalName: 'Mercato Terminal',
    destinationTerminalId: 't4',
    destinationTerminalName: 'Piazza Terminal',
    dispatcherIds: ['u3', 'u4'],
    dispatcherNames: ['Dawit Kebede', 'Helen Girma'],
    status: 'PUBLISHED',
    conflictCount: 0,
    conflicts: [],
    createdAt: iso(3),
    updatedAt: iso(1),
  },
  {
    id: 'wa3',
    name: `Week ${currentWeek} - Group C - Megenagna to Bole`,
    weekNumber: currentWeek,
    weekStart: getWeekRange(currentWeek).start,
    weekEnd: getWeekRange(currentWeek).end,
    vehicleGroupId: 'g3',
    vehicleGroupName: 'Group C',
    originTerminalId: 't1',
    originTerminalName: 'Megenagna Terminal',
    destinationTerminalId: 't3',
    destinationTerminalName: 'Bole Airport Terminal',
    dispatcherIds: ['u4'],
    dispatcherNames: ['Helen Girma'],
    status: 'PUBLISHED',
    conflictCount: 0,
    conflicts: [],
    createdAt: iso(3),
    updatedAt: iso(1),
  },
  {
    id: 'wa4',
    name: `Week ${currentWeek + 1} - Group A - Mercato to Lebu`,
    weekNumber: currentWeek + 1,
    weekStart: getWeekRange(currentWeek + 1).start,
    weekEnd: getWeekRange(currentWeek + 1).end,
    vehicleGroupId: 'g1',
    vehicleGroupName: 'Group A',
    originTerminalId: 't2',
    originTerminalName: 'Mercato Terminal',
    destinationTerminalId: 't5',
    destinationTerminalName: 'Akaki Terminal',
    dispatcherIds: ['u3'],
    dispatcherNames: ['Dawit Kebede'],
    status: 'DRAFT',
    conflictCount: 0,
    conflicts: [],
    createdAt: iso(0, 2),
    updatedAt: iso(0, 1),
  },
];

export const mockQueue: QueueEntry[] = [
  { id: 'q1', vehicleId: 'v1', plateNumber: 'AA-00001', vehicleGroupName: 'Group A', assignmentId: 'wa1', terminalId: 't2', terminalName: 'Mercato Terminal', destinationTerminalName: 'Bole Airport Terminal', position: 1, status: 'WAITING', checkedInAt: iso(0, 1), checkedInBy: 'Dawit Kebede', isViolation: false },
  { id: 'q2', vehicleId: 'v2', plateNumber: 'AA-00002', vehicleGroupName: 'Group A', assignmentId: 'wa1', terminalId: 't2', terminalName: 'Mercato Terminal', destinationTerminalName: 'Bole Airport Terminal', position: 2, status: 'WAITING', checkedInAt: iso(0, 1), checkedInBy: 'Dawit Kebede', isViolation: false },
  { id: 'q3', vehicleId: 'v3', plateNumber: 'AA-00003', vehicleGroupName: 'Group A', assignmentId: 'wa1', terminalId: 't2', terminalName: 'Mercato Terminal', destinationTerminalName: 'Bole Airport Terminal', position: 3, status: 'WAITING', checkedInAt: iso(0, 0), checkedInBy: 'Dawit Kebede', isViolation: false },
  { id: 'q4', vehicleId: 'v101', plateNumber: 'AA-00101', vehicleGroupName: 'Group B', assignmentId: 'wa2', terminalId: 't2', terminalName: 'Mercato Terminal', destinationTerminalName: 'Piazza Terminal', position: 1, status: 'WAITING', checkedInAt: iso(0, 0), checkedInBy: 'Helen Girma', isViolation: false },
  { id: 'q5', vehicleId: 'v102', plateNumber: 'AA-00102', vehicleGroupName: 'Group B', assignmentId: 'wa2', terminalId: 't2', terminalName: 'Mercato Terminal', destinationTerminalName: 'Piazza Terminal', position: 2, status: 'WAITING', checkedInAt: iso(0, 0), checkedInBy: 'Helen Girma', isViolation: false },
];

export const mockDispatchRecords: DispatchRecord[] = Array.from({ length: 30 }, (_, i) => {
  const assignment = mockWeeklyAssignments[i % 3];
  const groupVehicles = mockVehicles.filter((v) => v.groupId === assignment.vehicleGroupId);
  const vehicle = groupVehicles[i % groupVehicles.length];
  const dispatcher = mockUsers.find((u) => assignment.dispatcherIds.includes(u.id)) ?? mockUsers[2];
  return {
    id: `dr${i + 1}`,
    vehicleId: vehicle.id,
    plateNumber: vehicle.plateNumber,
    vehicleGroupId: assignment.vehicleGroupId,
    vehicleGroupName: assignment.vehicleGroupName,
    originTerminalId: assignment.originTerminalId,
    originTerminalName: assignment.originTerminalName,
    destinationTerminalId: assignment.destinationTerminalId,
    destinationTerminalName: assignment.destinationTerminalName,
    dispatcherId: dispatcher.id,
    dispatcherName: dispatcher.name,
    dispatchTime: iso(i % 7, i),
    queuePosition: (i % 5) + 1,
    paymentStatus: (i % 5 === 0 ? 'PENDING' : 'PAID') as import('@/src/types/operations').PaymentStatus,
    feeAmount: [15, 20, 25, 30][i % 4],
    feeRuleId: 'fee-1',
    deviceId: i % 3 === 0 ? `DEV-${String(i).padStart(4, '0')}` : undefined,
    auditRef: `AUD-${1000 + i}`,
  };
});

export const mockDispatchFeeRules: DispatchFeeRule[] = [
  { id: 'fee-1', name: 'Standard Bus Fee', amount: 25, currency: 'ETB', vehicleType: 'BUS', active: true, createdAt: iso(100), updatedAt: iso(5) },
  { id: 'fee-2', name: 'Minibus Fee', amount: 15, currency: 'ETB', vehicleType: 'MINIBUS', active: true, createdAt: iso(100), updatedAt: iso(5) },
  { id: 'fee-3', name: 'Coaster Fee', amount: 20, currency: 'ETB', vehicleType: 'COASTER', active: true, createdAt: iso(100), updatedAt: iso(5) },
  { id: 'fee-4', name: 'Truck Fee', amount: 30, currency: 'ETB', vehicleType: 'TRUCK', active: true, createdAt: iso(100), updatedAt: iso(5) },
];

const violationTypes = ['Overcapacity', 'Route Deviation', 'Late Departure', 'Missed Stop', 'Speed Violation', 'Expired Permit'];
const severities: Violation['severity'][] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const violationStatuses: Violation['status'][] = ['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED'];

export const mockViolations: Violation[] = Array.from({ length: 32 }, (_, i) => {
  const status = violationStatuses[i % violationStatuses.length];
  const assignment = mockWeeklyAssignments[i % 3];
  return {
    id: `vl${i + 1}`,
    vehicleId: `v${(i % 48) + 1}`,
    plateNumber: plateNum((i % 48) + 1),
    assignmentId: assignment.id,
    routeId: i % 2 === 0 ? `r${(i % 4) + 1}` : undefined,
    terminalId: assignment.originTerminalId,
    type: violationTypes[i % violationTypes.length],
    description: `${violationTypes[i % violationTypes.length]} detected during scheduled operation.`,
    severity: severities[i % severities.length],
    status,
    reportedBy: ['Dawit Kebede', 'Helen Girma', 'Sara Tadesse'][i % 3],
    reportedAt: iso(i % 10, i),
    resolvedAt: status === 'RESOLVED' || status === 'DISMISSED' ? iso(i % 5) : undefined,
    resolution: status === 'RESOLVED' ? 'Warning issued to driver.' : status === 'DISMISSED' ? 'False positive.' : undefined,
  };
});

export const mockOverrides: Override[] = Array.from({ length: 16 }, (_, i) => {
  const status: Override['status'] = i % 3 === 0 ? 'PENDING' : i % 3 === 1 ? 'APPROVED' : 'REJECTED';
  return {
    id: `ov${i + 1}`,
    requestedBy: ['Dawit Kebede', 'Helen Girma', 'Solomon Haile'][i % 3],
    action: ['Queue Reorder', 'Route Override', 'Dispatch Without Assignment', 'Capacity Override'][i % 4],
    reason: 'Operational exigency requiring supervisor intervention.',
    assignmentId: mockWeeklyAssignments[i % 3].id,
    status,
    approvedBy: status !== 'PENDING' ? 'Abebe Bekele' : undefined,
    approvedAt: status !== 'PENDING' ? iso(i % 3) : undefined,
    auditRef: status !== 'PENDING' ? `AUD-${i + 1000}` : undefined,
    createdAt: iso(i % 5),
  };
});

export const mockAuditLogs: AuditLog[] = Array.from({ length: 40 }, (_, i) => ({
  id: `al${i + 1}`,
  actor: ['Abebe Bekele', 'Sara Tadesse', 'Dawit Kebede', 'Helen Girma', 'Bethel Alemu'][i % 5],
  action: ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'APPROVE', 'EXPORT', 'DISPATCH', 'CHECK_IN'][i % 8],
  entity: ['Vehicle', 'Route', 'Terminal', 'Assignment', 'User', 'Override', 'Dispatch', 'Queue'][i % 8],
  entityId: `${['v', 'r', 't', 'wa', 'u', 'ov', 'dr', 'q'][i % 8]}${(i % 10) + 1}`,
  details: `${['Created', 'Updated', 'Deleted', 'Logged in', 'Approved', 'Exported', 'Dispatched', 'Checked in'][i % 8]} record.`,
  ipAddress: `10.0.${i % 255}.${(i * 3) % 255}`,
  timestamp: iso(i % 7, i),
}));

export const mockDevices: Device[] = Array.from({ length: 12 }, (_, i) => {
  const statuses: Device['status'][] = ['APPROVED', 'PENDING', 'REJECTED', 'OFFLINE'];
  return {
    id: `d${i + 1}`,
    name: `Dispatch Tablet ${i + 1}`,
    deviceId: `DEV-${String(i + 1).padStart(4, '0')}`,
    terminalId: ['t1', 't2', 't3', 't4'][i % 4],
    status: statuses[i % statuses.length],
    lastSyncAt: iso(i % 3, i),
    appVersion: `2.${i % 4}.1`,
  };
});

export const mockDashboardData = {
  stats: {
    vehiclesInQueue: mockQueue.filter((q) => q.status === 'WAITING').length,
    vehiclesDispatchedToday: mockDispatchRecords.filter((d) => d.dispatchTime.startsWith(new Date().toISOString().split('T')[0])).length || 30,
    activeRoutes: mockRoutes.filter((r) => r.status === 'ACTIVE').length,
    activeTerminals: mockTerminals.filter((t) => t.status === 'OPERATIONAL').length,
    activeDispatchers: mockUsers.filter((u) => u.roleId === 'role-dispatcher' && u.status === 'ACTIVE').length,
    violationsToday: mockViolations.filter((v) => v.reportedAt.startsWith(new Date().toISOString().split('T')[0])).length || 6,
    offlineDevices: mockDevices.filter((d) => d.status === 'OFFLINE').length,
    pendingSyncActions: 5,
    activeAssignments: mockWeeklyAssignments.filter((a) => a.status === 'PUBLISHED').length,
    dispatchRevenueToday: mockDispatchRecords.reduce((sum, d) => sum + d.feeAmount, 0),
  },
  dispatchTrend: Array.from({ length: 7 }, (_, i) => ({
    date: new Date(now.getTime() - (6 - i) * 86400000).toLocaleDateString('en-US', { weekday: 'short' }),
    value: 60 + Math.round(Math.sin(i) * 15) + i * 3,
  })),
  queueTrend: Array.from({ length: 7 }, (_, i) => ({
    date: new Date(now.getTime() - (6 - i) * 86400000).toLocaleDateString('en-US', { weekday: 'short' }),
    value: 18 + Math.round(Math.cos(i) * 6) + i,
  })),
  violationsByRoute: [
    { route: 'Mercato-Bole', count: 8 },
    { route: 'Megenagna-Bole', count: 5 },
    { route: 'Mercato-Piazza', count: 3 },
    { route: 'Mercato-Lebu', count: 2 },
  ],
  terminalUtilization: [
    { terminal: 'Megenagna', utilization: 56 },
    { terminal: 'Mercato', utilization: 65 },
    { terminal: 'Bole', utilization: 50 },
    { terminal: 'Piazza', utilization: 56 },
  ],
  dailyActivity: Array.from({ length: 7 }, (_, i) => ({
    date: new Date(now.getTime() - (6 - i) * 86400000).toLocaleDateString('en-US', { weekday: 'short' }),
    value: 120 + Math.round(Math.sin(i + 1) * 30) + i * 4,
  })),
  recentDispatches: mockDispatchRecords.slice(0, 5).map((d) => ({
    id: d.id,
    plateNumber: d.plateNumber,
    route: `${d.originTerminalName} - ${d.destinationTerminalName}`,
    terminal: d.originTerminalName,
    dispatcher: d.dispatcherName,
    dispatchedAt: d.dispatchTime,
    status: 'DISPATCHED',
  })),
  recentViolations: mockViolations.slice(0, 5),
  recentAuditLogs: mockAuditLogs.slice(0, 5),
  recentOverrides: mockOverrides.slice(0, 5),
};

export const mockDispatcherDashboard = (userId: string) => {
  const userAssignments = mockWeeklyAssignments.filter(
    (a) => a.dispatcherIds.includes(userId) && a.status === 'PUBLISHED',
  );
  const user = mockUsers.find((u) => u.id === userId);
  const terminalName = mockTerminals.find((t) => t.id === user?.terminalId)?.name ?? '';
  const userQueue = mockQueue.filter((q) => userAssignments.some((a) => a.id === q.assignmentId));
  const userDispatches = mockDispatchRecords.filter((d) => d.dispatcherId === userId);

  return {
    todayAssignments: userAssignments.map((a) => ({
      assignmentId: a.id,
      route: `${a.originTerminalName} - ${a.destinationTerminalName}`,
      vehicleGroup: a.vehicleGroupName,
      originTerminal: a.originTerminalName,
      destinationTerminal: a.destinationTerminalName,
    })),
    assignedTerminal: terminalName,
    assignedRoutes: userAssignments.map((a) => `${a.originTerminalName} - ${a.destinationTerminalName}`),
    assignedVehicleGroups: Array.from(new Set(userAssignments.map((a) => a.vehicleGroupName))),
    liveQueue: userQueue.filter((q) => q.status === 'WAITING').map((q) => ({
      position: q.position,
      plateNumber: q.plateNumber,
      status: q.status,
    })),
    vehiclesWaiting: userQueue.filter((q) => q.status === 'WAITING').length,
    vehiclesDispatchedToday: userDispatches.length,
    dispatchRevenueToday: userDispatches.reduce((sum, d) => sum + d.feeAmount, 0),
    dispatchRevenueWeek: userDispatches.reduce((sum, d) => sum + d.feeAmount, 0),
    recentDispatchHistory: userDispatches.slice(0, 10),
    dispatchRevenue: {
      daily: userDispatches.reduce((sum, d) => sum + d.feeAmount, 0),
      weekly: userDispatches.reduce((sum, d) => sum + d.feeAmount, 0),
      monthly: userDispatches.reduce((sum, d) => sum + d.feeAmount, 0),
      byTerminal: [{ terminal: terminalName, revenue: userDispatches.reduce((sum, d) => sum + d.feeAmount, 0) }],
      byRoute: userAssignments.map((a) => ({
        route: `${a.originTerminalName} - ${a.destinationTerminalName}`,
        revenue: userDispatches.filter((d) => d.originTerminalId === a.originTerminalId).reduce((s, d) => s + d.feeAmount, 0),
      })),
      byDispatcher: [{ dispatcher: user?.name ?? '', revenue: userDispatches.reduce((sum, d) => sum + d.feeAmount, 0) }],
      trend: Array.from({ length: 7 }, (_, i) => ({
        date: new Date(now.getTime() - (6 - i) * 86400000).toLocaleDateString('en-US', { weekday: 'short' }),
        revenue: 200 + Math.round(Math.sin(i) * 50) + i * 10,
      })),
    },
  };
};
