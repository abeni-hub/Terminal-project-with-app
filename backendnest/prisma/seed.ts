import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PERMISSIONS = [
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
  { id: 'perm-card-view', name: 'card.view', label: 'View Transport Cards', module: 'Cards & Accounts' },
  { id: 'perm-card-create', name: 'card.create', label: 'Create Transport Cards', module: 'Cards & Accounts' },
  { id: 'perm-card-assign', name: 'card.assign', label: 'Assign / Link Cards', module: 'Cards & Accounts' },
  { id: 'perm-card-block', name: 'card.block', label: 'Block / Unlink Cards', module: 'Cards & Accounts' },
  { id: 'perm-card-replace', name: 'card.replace', label: 'Replace Transport Cards', module: 'Cards & Accounts' },
  { id: 'perm-account-view', name: 'vehicle_account.view', label: 'View Vehicle Accounts', module: 'Cards & Accounts' },
  { id: 'perm-balance-view', name: 'vehicle_balance.view', label: 'View Vehicle Balance', module: 'Cards & Accounts' },
  { id: 'perm-topup-create', name: 'topup.create', label: 'Top-Up Vehicle Balance', module: 'Cards & Accounts' },
  { id: 'perm-transaction-view', name: 'transaction.view', label: 'View Financial Transactions', module: 'Cards & Accounts' },
];

const allPermissionIds = PERMISSIONS.map((p) => p.id);

async function main() {
  console.log('Seeding database...');
  const passwordHash = await bcrypt.hash('password123', 10);

  // Seed Permissions
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { id: perm.id },
      update: {
        name: perm.name,
        label: perm.label,
        module: perm.module,
      },
      create: {
        id: perm.id,
        name: perm.name,
        label: perm.label,
        module: perm.module,
      },
    });
  }
  console.log('Permissions seeded.');

  // Seed Roles
  const roles = [
    {
      id: 'role-super-admin',
      name: 'SUPER_ADMIN',
      label: 'Super Administrator',
      description: 'Unrestricted access to the entire system',
      isSystem: true,
      permissionIds: [...allPermissionIds],
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
        'perm-account-view',
        'perm-balance-view',
        'perm-transaction-view',
      ],
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
        'perm-balance-view',
      ],
    },
    {
      id: 'role-card-officer',
      name: 'CARD_ACCOUNT_OFFICER',
      label: 'Card & Top-Up Officer',
      description: 'Manages RFID cards, vehicle financial accounts, balance top-ups, and ledger inquiries',
      isSystem: true,
      permissionIds: [
        'perm-dashboard-view',
        'perm-card-view',
        'perm-card-create',
        'perm-card-assign',
        'perm-card-block',
        'perm-card-replace',
        'perm-account-view',
        'perm-balance-view',
        'perm-topup-create',
        'perm-transaction-view',
        'perm-reports-view',
      ],
    },
  ];

  for (const r of roles) {
    await prisma.role.upsert({
      where: { id: r.id },
      update: {
        name: r.name,
        label: r.label,
        description: r.description,
        isSystem: r.isSystem,
        permissionIds: r.permissionIds,
      },
      create: {
        id: r.id,
        name: r.name,
        label: r.label,
        description: r.description,
        isSystem: r.isSystem,
        permissionIds: r.permissionIds,
      },
    });
  }
  console.log('Roles seeded.');

  // Seed Terminals
  const terminals = [
    { id: 't1', name: 'Megenagna Terminal', code: 'TRM-MGN', address: 'Megenagna, Addis Ababa', latitude: 9.0084, longitude: 38.7575, capacity: 80, status: 'OPERATIONAL' as const },
    { id: 't2', name: 'Mercato Terminal', code: 'TRM-MRC', address: 'Addis Mercato, Addis Ababa', latitude: 9.0333, longitude: 38.7433, capacity: 120, status: 'OPERATIONAL' as const },
    { id: 't3', name: 'Bole Airport Terminal', code: 'TRM-BOLE', address: 'Bole, Addis Ababa', latitude: 8.9806, longitude: 38.7969, capacity: 60, status: 'DEGRADED' as const },
    { id: 't4', name: 'Piazza Terminal', code: 'TRM-PZA', address: 'Piazza, Addis Ababa', latitude: 9.0372, longitude: 38.7467, capacity: 50, status: 'OPERATIONAL' as const },
    { id: 't5', name: 'Akaki Terminal', code: 'TRM-AKK', address: 'Akaki Kality, Addis Ababa', latitude: 8.8942, longitude: 38.7889, capacity: 40, status: 'MAINTENANCE' as const },
    { id: 't6', name: 'Kaliti Terminal', code: 'TRM-KAL', address: 'Kaliti, Addis Ababa', latitude: 8.9086, longitude: 38.7394, capacity: 35, status: 'OFFLINE' as const },
  ];

  for (const t of terminals) {
    await prisma.terminal.upsert({
      where: { id: t.id },
      update: t,
      create: t,
    });
  }
  console.log('Terminals seeded.');

  // Seed Users
  const users = [
    { id: 'u1', name: 'Abebe Bekele', email: 'abebe@aato.gov.et', phone: '+251911000001', roleId: 'role-super-admin', status: 'ACTIVE' as const, avatarColor: '#2176ff' },
    { id: 'u2', name: 'Sara Tadesse', email: 'sara@aato.gov.et', phone: '+251911000002', roleId: 'role-planner', status: 'ACTIVE' as const, avatarColor: '#16a34a' },
    { id: 'u3', name: 'Dawit Kebede', email: 'dawit@aato.gov.et', phone: '+251911000003', roleId: 'role-dispatcher', status: 'ACTIVE' as const, terminalId: 't2', avatarColor: '#f59e0b' },
    { id: 'u4', name: 'Helen Girma', email: 'helen@aato.gov.et', phone: '+251911000004', roleId: 'role-dispatcher', status: 'ACTIVE' as const, terminalId: 't1', avatarColor: '#0ea5e9' },
    { id: 'u5', name: 'Yonas Assefa', email: 'yonas@aato.gov.et', phone: '+251911000005', roleId: 'role-dispatcher', status: 'SUSPENDED' as const, terminalId: 't3', avatarColor: '#ef4444' },
    { id: 'u6', name: 'Meron Tesfaye', email: 'meron@aato.gov.et', phone: '+251911000006', roleId: 'role-planner', status: 'ACTIVE' as const, avatarColor: '#8b5cf6' },
    { id: 'u7', name: 'Solomon Haile', email: 'solomon@aato.gov.et', phone: '+251911000007', roleId: 'role-dispatcher', status: 'INVITED' as const, terminalId: 't2', avatarColor: '#14b8a6' },
    { id: 'u8', name: 'Bethel Alemu', email: 'bethel@aato.gov.et', phone: '+251911000008', roleId: 'role-super-admin', status: 'ACTIVE' as const, avatarColor: '#f97316' },
    { id: 'u9', name: 'Kalkidan Desta', email: 'officer@aato.gov.et', phone: '+251911000009', roleId: 'role-card-officer', status: 'ACTIVE' as const, avatarColor: '#8b5cf6' },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        passwordHash,
        phone: u.phone,
        roleId: u.roleId,
        status: u.status,
        terminalId: u.terminalId,
        avatarColor: u.avatarColor,
      },
      create: {
        id: u.id,
        name: u.name,
        email: u.email,
        passwordHash,
        phone: u.phone,
        roleId: u.roleId,
        status: u.status,
        terminalId: u.terminalId,
        avatarColor: u.avatarColor,
      },
    });
  }
  console.log('Users seeded.');

  // Seed Routes
  const routes = [
    { id: 'r1', name: 'Megenagna - Mercato Express', code: 'RTE-001', originTerminalId: 't1', destinationTerminalId: 't2', distanceKm: 6.5, estimatedMinutes: 25, status: 'ACTIVE' as const },
    { id: 'r2', name: 'Megenagna - Bole Airport', code: 'RTE-002', originTerminalId: 't1', destinationTerminalId: 't3', distanceKm: 4.2, estimatedMinutes: 18, status: 'ACTIVE' as const },
    { id: 'r3', name: 'Mercato - Piazza Loop', code: 'RTE-003', originTerminalId: 't2', destinationTerminalId: 't4', distanceKm: 3.1, estimatedMinutes: 15, status: 'ACTIVE' as const },
    { id: 'r4', name: 'Bole - Akaki Corridor', code: 'RTE-004', originTerminalId: 't3', destinationTerminalId: 't5', distanceKm: 12.8, estimatedMinutes: 45, status: 'INACTIVE' as const },
    { id: 'r5', name: 'Mercato - Bole', code: 'RTE-005', originTerminalId: 't2', destinationTerminalId: 't3', distanceKm: 5.0, estimatedMinutes: 20, status: 'ACTIVE' as const },
    { id: 'r6', name: 'Mercato - Lebu', code: 'RTE-006', originTerminalId: 't2', destinationTerminalId: 't5', distanceKm: 8.5, estimatedMinutes: 30, status: 'ACTIVE' as const },
  ];

  for (const r of routes) {
    await prisma.route.upsert({
      where: { id: r.id },
      update: r,
      create: r,
    });
  }
  console.log('Routes seeded.');

  // Seed Vehicle Groups
  const groups = [
    { id: 'g1', name: 'Group A', description: 'Northern district fleet' },
    { id: 'g2', name: 'Group B', description: 'Southern district fleet' },
    { id: 'g3', name: 'Group C', description: 'Express routes fleet' },
  ];

  for (const g of groups) {
    await prisma.vehicleGroup.upsert({
      where: { id: g.id },
      update: g,
      create: g,
    });
  }
  console.log('Vehicle groups seeded.');

  // Seed Vehicles
  const models = ['Toyota Coaster', 'Isuzu NPR', 'Hyundai County', 'Mitsubishi Rosa', 'King Long'];
  const types = ['BUS' as const, 'MINIBUS' as const, 'COASTER' as const, 'TRUCK' as const];
  const groupAssignments = [
    { groupId: 'g1', groupPrefix: 1, count: 16 },
    { groupId: 'g2', groupPrefix: 101, count: 16 },
    { groupId: 'g3', groupPrefix: 201, count: 16 },
  ];

  for (const ga of groupAssignments) {
    for (let i = 0; i < ga.count; i++) {
      const idx = ga.groupPrefix + i;
      const plateNumber = `AA-${String(idx).padStart(5, '0')}`;
      const type = types[i % types.length];
      const capacity = [30, 45, 25, 15][i % 4];
      const model = models[i % models.length];
      const driverName = ['Abebe', 'Kebede', 'Tesfaye', 'Girma'][i % 4];
      const driverPhone = `+251912${String(100000 + idx).padStart(6, '0')}`;

      await prisma.vehicle.upsert({
        where: { plateNumber },
        update: {
          model,
          type,
          capacity,
          groupId: ga.groupId,
          driverName,
          driverPhone,
        },
        create: {
          id: `v${idx}`,
          plateNumber,
          model,
          type,
          capacity,
          status: 'IDLE',
          groupId: ga.groupId,
          driverName,
          driverPhone,
        },
      });
    }
  }
  // Specific Transport Management vehicles for ANPR workflows
  const testVehicles = [
    { id: 'v-2a12345', plateNumber: '2-A12345', model: 'Toyota Coaster', type: 'COASTER' as const, capacity: 28, status: 'IDLE' as const, groupId: 'g1', driverName: 'Dawit Mengistu', driverPhone: '+251911223344' },
    { id: 'v-2b56789', plateNumber: '2-B56789', model: 'Isuzu NPR Bus', type: 'BUS' as const, capacity: 45, status: 'IDLE' as const, groupId: 'g1', driverName: 'Almaz Tadesse', driverPhone: '+251911556677' },
    { id: 'v-3c11111', plateNumber: '3-C11111', model: 'Hyundai Minibus', type: 'MINIBUS' as const, capacity: 16, status: 'IDLE' as const, groupId: 'g2', driverName: 'Kassahun Bekele', driverPhone: '+251911889900' },
    { id: 'v-4d55555', plateNumber: '4-D55555', model: 'Mitsubishi Rosa', type: 'COASTER' as const, capacity: 32, status: 'IDLE' as const, groupId: 'g1', driverName: 'Ermias Fikru', driverPhone: '+251911334455' },
    { id: 'v-aa12345', plateNumber: 'AA12345', model: 'Toyota HiAce', type: 'MINIBUS' as const, capacity: 15, status: 'IDLE' as const, groupId: 'g1', driverName: 'Solomon Desta', driverPhone: '+251911778899' },
  ];

  for (const tv of testVehicles) {
    await prisma.vehicle.upsert({
      where: { plateNumber: tv.plateNumber },
      update: tv,
      create: tv,
    });
  }

  console.log('Vehicles seeded.');

  // Seed Dispatch Fee Rules
  const feeRules = [
    { id: 'fee-1', name: 'Standard Bus Fee', amount: 25, vehicleType: 'BUS' as const, active: true },
    { id: 'fee-2', name: 'Minibus Fee', amount: 15, vehicleType: 'MINIBUS' as const, active: true },
    { id: 'fee-3', name: 'Coaster Fee', amount: 20, vehicleType: 'COASTER' as const, active: true },
    { id: 'fee-4', name: 'Truck Fee', amount: 30, vehicleType: 'TRUCK' as const, active: true },
  ];

  for (const rule of feeRules) {
    await prisma.dispatchFeeRule.upsert({
      where: { id: rule.id },
      update: rule,
      create: rule,
    });
  }
  console.log('Dispatch fee rules seeded.');

  // Seed Cameras (Entry & Exit for Mercato, Bole, Piassa)
  const cameras = [
    { id: 'cam-mer-in', name: 'Mercato Gate 1 (Entry)', code: 'CAM-MER-IN', terminalId: 't2', gateName: 'North Gate In', cameraType: 'ENTRY' as const, sourceType: 'USB' as const, sourceAddress: '0', status: 'ACTIVE' as const, recognitionEnabled: true },
    { id: 'cam-mer-out', name: 'Mercato Gate 1 (Exit)', code: 'CAM-MER-OUT', terminalId: 't2', gateName: 'North Gate Out', cameraType: 'EXIT' as const, sourceType: 'USB' as const, sourceAddress: '1', status: 'ACTIVE' as const, recognitionEnabled: true },
    { id: 'cam-bol-in', name: 'Bole Terminal Entry', code: 'CAM-BOL-IN', terminalId: 't3', gateName: 'Main Entry', cameraType: 'ENTRY' as const, sourceType: 'RTSP' as const, sourceAddress: 'rtsp://192.168.1.102:554/live', status: 'ACTIVE' as const, recognitionEnabled: true },
    { id: 'cam-bol-out', name: 'Bole Terminal Exit', code: 'CAM-BOL-OUT', terminalId: 't3', gateName: 'Main Exit', cameraType: 'EXIT' as const, sourceType: 'RTSP' as const, sourceAddress: 'rtsp://192.168.1.103:554/live', status: 'ACTIVE' as const, recognitionEnabled: true },
    { id: 'cam-pia-in', name: 'Piassa Terminal Entry', code: 'CAM-PIA-IN', terminalId: 't4', gateName: 'Gate A Entry', cameraType: 'ENTRY' as const, sourceType: 'RTSP' as const, sourceAddress: 'rtsp://192.168.1.104:554/live', status: 'ACTIVE' as const, recognitionEnabled: true },
    { id: 'cam-pc-01', name: 'PC Webcam (Entry Gate)', code: 'CAM-PC-01', terminalId: 't2', gateName: 'Mercato Gate In', cameraType: 'ENTRY' as const, sourceType: 'USB' as const, sourceAddress: '0', status: 'ACTIVE' as const, recognitionEnabled: true },
    { id: 'cam-demo-01', name: 'Synthetic ANPR Generator', code: 'CAM-DEMO-01', terminalId: 't2', gateName: 'Simulated Gate', cameraType: 'ENTRY' as const, sourceType: 'MOCK_SYNTHETIC' as const, sourceAddress: 'synthetic://demo', status: 'ACTIVE' as const, recognitionEnabled: true },
  ];

  for (const c of cameras) {
    await prisma.cameraDevice.upsert({
      where: { code: c.code },
      update: c,
      create: c,
    });
  }
  console.log('Cameras seeded.');

  // Seed Devices
  const devices = Array.from({ length: 12 }, (_, i) => {
    const statuses = ['APPROVED' as const, 'PENDING' as const, 'REJECTED' as const, 'OFFLINE' as const];
    return {
      id: `d${i + 1}`,
      name: `Dispatch Tablet ${i + 1}`,
      deviceId: `DEV-${String(i + 1).padStart(4, '0')}`,
      terminalId: ['t1', 't2', 't3', 't4'][i % 4],
      status: statuses[i % statuses.length],
      appVersion: `2.${i % 4}.1`,
    };
  });

  for (const d of devices) {
    await prisma.device.upsert({
      where: { deviceId: d.deviceId },
      update: d,
      create: d,
    });
  }
  console.log('Devices seeded.');

  // Seed Weekly Assignments (Including Current Week 38)
  const assignments = [
    {
      id: 'a-w38-g1',
      name: 'Week 38 - Group A (Mercato to Bole)',
      weekNumber: 38,
      weekStart: new Date('2026-09-21T00:00:00.000Z'),
      weekEnd: new Date('2026-09-27T23:59:59.000Z'),
      vehicleGroupId: 'g1',
      originTerminalId: 't2',
      destinationTerminalId: 't3',
      dispatcherIds: ['u3', 'u4'],
      status: 'PUBLISHED' as const,
    },
    {
      id: 'a-w38-g2',
      name: 'Week 38 - Group B (Piassa to Mercato)',
      weekNumber: 38,
      weekStart: new Date('2026-09-21T00:00:00.000Z'),
      weekEnd: new Date('2026-09-27T23:59:59.000Z'),
      vehicleGroupId: 'g2',
      originTerminalId: 't4',
      destinationTerminalId: 't2',
      dispatcherIds: ['u3', 'u4'],
      status: 'PUBLISHED' as const,
    },
    {
      id: 'a1',
      name: 'Week 32 Planning',
      weekNumber: 32,
      weekStart: new Date('2026-08-03T00:00:00.000Z'),
      weekEnd: new Date('2026-08-09T23:59:59.000Z'),
      vehicleGroupId: 'g1',
      originTerminalId: 't1',
      destinationTerminalId: 't2',
      dispatcherIds: ['u3', 'u4'],
      status: 'PUBLISHED' as const,
    },
  ];

  for (const a of assignments) {
    await prisma.weeklyAssignment.upsert({
      where: { id: a.id },
      update: a,
      create: a,
    });
  }
  console.log('Weekly assignments seeded.');

  // Seed Queue Entries
  const queueEntries = [
    {
      id: 'q1',
      vehicleId: 'v-2a12345',
      plateNumber: '2-A12345',
      vehicleGroupName: 'Group A',
      assignmentId: 'a-w38-g1',
      terminalId: 't2',
      terminalName: 'Mercato Terminal',
      destinationTerminalName: 'Bole Airport Terminal',
      position: 1,
      status: 'WAITING' as const,
      entryType: 'AUTO_RECOGNIZED' as const,
      confidence: 0.96,
      checkedInAt: new Date(Date.now() - 25 * 60 * 1000),
      checkedInBy: 'ANPR Gate (CAM-MER-IN)',
      isViolation: false,
    },
    {
      id: 'q2',
      vehicleId: 'v-2b56789',
      plateNumber: '2-B56789',
      vehicleGroupName: 'Group A',
      assignmentId: 'a-w38-g1',
      terminalId: 't2',
      terminalName: 'Mercato Terminal',
      destinationTerminalName: 'Bole Airport Terminal',
      position: 2,
      status: 'LOADING' as const,
      entryType: 'AUTO_RECOGNIZED' as const,
      confidence: 0.94,
      checkedInAt: new Date(Date.now() - 15 * 60 * 1000),
      checkedInBy: 'ANPR Gate (CAM-MER-IN)',
      dispatchInTime: new Date(Date.now() - 10 * 60 * 1000),
      isViolation: false,
    },
  ];

  for (const q of queueEntries) {
    await prisma.queueEntry.upsert({
      where: { id: q.id },
      update: q,
      create: q,
    });
  }
  console.log('Queue entries seeded.');

  // Seed Dispatch Records
  const dispatchRecords = [
    {
      id: 'dr1',
      vehicleId: 'v1',
      plateNumber: 'AA-00001',
      vehicleGroupId: 'g1',
      vehicleGroupName: 'Group A',
      originTerminalId: 't1',
      originTerminalName: 'Megenagna Terminal',
      destinationTerminalId: 't2',
      destinationTerminalName: 'Mercato Terminal',
      dispatcherId: 'u3',
      dispatcherName: 'Dawit Kebede',
      dispatchTime: new Date('2026-08-03T09:00:00.000Z'),
      queuePosition: 1,
      feeAmount: 25,
      feeRuleId: 'fee-1',
      deviceId: 'd1',
      auditRef: 'audit-1',
    },
  ];

  for (const dr of dispatchRecords) {
    await prisma.dispatchRecord.upsert({
      where: { id: dr.id },
      update: dr,
      create: dr,
    });
  }
  console.log('Dispatch records seeded.');

  // Seed Violations
  const violations = [
    {
      id: 'vln1',
      vehicleId: 'v2',
      plateNumber: 'AA-00002',
      assignmentId: 'a1',
      routeId: 'r1',
      terminalId: 't1',
      type: 'Late arrival',
      description: 'Vehicle arrived at the terminal later than scheduled.',
      severity: 'MEDIUM' as const,
      status: 'OPEN' as const,
      reportedBy: 'u3',
      reportedAt: new Date('2026-08-03T10:15:00.000Z'),
      resolution: null,
    },
    {
      id: 'vln2',
      vehicleId: 'v3',
      plateNumber: 'AA-00003',
      assignmentId: 'a2',
      routeId: 'r2',
      terminalId: 't2',
      type: 'Mechanical issue',
      description: 'Brake warning light activated during route.',
      severity: 'HIGH' as const,
      status: 'IN_REVIEW' as const,
      reportedBy: 'u4',
      reportedAt: new Date('2026-08-03T11:05:00.000Z'),
      resolution: null,
    },
  ];

  for (const v of violations) {
    await prisma.violation.upsert({
      where: { id: v.id },
      update: v,
      create: v,
    });
  }
  console.log('Violations seeded.');

  // Seed Overrides
  const overrides = [
    {
      id: 'o1',
      requestedBy: 'u4',
      action: 'Approve vehicle overtime',
      reason: 'Dispatch needed to cover last-minute passenger surge.',
      assignmentId: 'a1',
      status: 'PENDING' as const,
      approvedBy: null,
      approvedAt: null,
      auditRef: 'audit-2',
    },
    {
      id: 'o2',
      requestedBy: 'u3',
      action: 'Extend route window',
      reason: 'Traffic delays require extra dispatch time.',
      assignmentId: 'a2',
      status: 'APPROVED' as const,
      approvedBy: 'u2',
      approvedAt: new Date('2026-08-03T12:00:00.000Z'),
      auditRef: 'audit-3',
    },
  ];

  for (const o of overrides) {
    await prisma.override.upsert({
      where: { id: o.id },
      update: o,
      create: o,
    });
  }
  console.log('Overrides seeded.');

  // Seed Audit Logs
  const auditLogs = [
    {
      id: 'audit-1',
      actor: 'u3',
      action: 'Dispatch vehicle',
      entity: 'DispatchRecord',
      entityId: 'dr1',
      details: 'Vehicle AA-00001 dispatched by Dawit Kebede for route RTE-001.',
      ipAddress: '192.168.0.12',
      timestamp: new Date('2026-08-03T09:00:00.000Z'),
    },
    {
      id: 'audit-2',
      actor: 'u4',
      action: 'Request override',
      entity: 'Override',
      entityId: 'o1',
      details: 'Requested additional vehicle operating time due to passenger surge.',
      ipAddress: '192.168.0.14',
      timestamp: new Date('2026-08-03T10:00:00.000Z'),
    },
    {
      id: 'audit-3',
      actor: 'u2',
      action: 'Approve override',
      entity: 'Override',
      entityId: 'o2',
      details: 'Approved extension of route window due to traffic delays.',
      ipAddress: '192.168.0.11',
      timestamp: new Date('2026-08-03T12:00:00.000Z'),
    },
  ];

  for (const a of auditLogs) {
    await prisma.auditLog.upsert({
      where: { id: a.id },
      update: a,
      create: a,
    });
  }
  console.log('Audit logs seeded.');

  // Seed Penalty Configuration
  await prisma.penaltyConfiguration.upsert({
    where: { id: 'default-penalty-config' },
    update: {
      name: 'Standard Unauthorized Departure Penalty',
      ruleType: 'FIXED_AMOUNT',
      amount: 50.0,
      description: 'Standard 50 ETB fine for unauthorized departure or dispatch without payment',
      active: true,
      updatedBy: 'u1',
    },
    create: {
      id: 'default-penalty-config',
      name: 'Standard Unauthorized Departure Penalty',
      ruleType: 'FIXED_AMOUNT',
      amount: 50.0,
      description: 'Standard 50 ETB fine for unauthorized departure or dispatch without payment',
      active: true,
      updatedBy: 'u1',
    },
  });
  console.log('Penalty configuration seeded.');

  // Seed Vehicle Accounts & Cards for test and fleet vehicles
  const allVehicles = await prisma.vehicle.findMany();
  for (const v of allVehicles) {
    // Determine a realistic balance
    let balance = 450.0;
    let status: 'ACTIVE' | 'OUTSTANDING_DEBT' | 'SUSPENDED' | 'BLOCKED' = 'ACTIVE';
    if (v.plateNumber === '2-A12345') balance = 450.0;
    else if (v.plateNumber === '2-B56789') balance = 700.0;
    else if (v.plateNumber === '3-C11111') balance = 200.0;
    else if (v.plateNumber === '4-D55555') {
      balance = -60.0;
      status = 'OUTSTANDING_DEBT';
    } else if (v.plateNumber === 'AA12345') balance = 300.0;
    else balance = Math.floor(Math.random() * 8 + 2) * 50;

    const account = await prisma.vehicleAccount.upsert({
      where: { vehicleId: v.id },
      update: {
        plateNumber: v.plateNumber,
        balance,
        status,
        lastTransactionAt: new Date(),
      },
      create: {
        vehicleId: v.id,
        plateNumber: v.plateNumber,
        balance,
        status,
        lastTransactionAt: new Date(),
      },
    });

    // Seed a TransportCard for specific test vehicles
    if (['2-A12345', '2-B56789', '3-C11111', '4-D55555', 'AA12345', 'AA-00001'].includes(v.plateNumber)) {
      const cardSuffix = v.plateNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const cardUid = `04A7${cardSuffix}`.padEnd(10, '0').slice(0, 10);
      const cardNumber = `CARD-${cardSuffix}`;

      const card = await prisma.transportCard.upsert({
        where: { cardUid },
        update: {
          cardNumber,
          vehicleId: v.id,
          status: 'ACTIVE',
        },
        create: {
          cardUid,
          cardNumber,
          vehicleId: v.id,
          status: 'ACTIVE',
          issuedAt: new Date(Date.now() - 30 * 24 * 3600 * 1000),
          createdBy: 'Kalkidan Desta',
        },
      });

      // Seed an initial TOPUP transaction
      await prisma.vehicleAccountTransaction.create({
        data: {
          vehicleAccountId: account.id,
          vehicleId: v.id,
          cardId: card.id,
          type: 'TOPUP',
          amount: 500.0,
          balanceBefore: 0.0,
          balanceAfter: 500.0,
          paymentMethod: 'CASH',
          paymentReference: `REC-INIT-${v.id.slice(0, 6)}`,
          description: `Initial registration top-up for ${v.plateNumber}`,
          performedBy: 'Kalkidan Desta',
          createdAt: new Date(Date.now() - 25 * 24 * 3600 * 1000),
        },
      });

      if (v.plateNumber === '4-D55555') {
        // Seed an unauthorized departure penalty transaction resulting in negative balance
        await prisma.vehicleAccountTransaction.create({
          data: {
            vehicleAccountId: account.id,
            vehicleId: v.id,
            cardId: card.id,
            type: 'DISPATCH_FEE',
            amount: -20.0,
            balanceBefore: 10.0,
            balanceAfter: -10.0,
            description: 'Standard dispatch fee for unauthorized departure',
            performedBy: 'SYSTEM_ANPR',
            createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
          },
        });
        await prisma.vehicleAccountTransaction.create({
          data: {
            vehicleAccountId: account.id,
            vehicleId: v.id,
            cardId: card.id,
            type: 'PENALTY',
            amount: -50.0,
            balanceBefore: -10.0,
            balanceAfter: -60.0,
            description: 'Penalty for unauthorized departure without terminal dispatch',
            performedBy: 'SYSTEM_ANPR',
            createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
          },
        });
      }
    }
  }
  console.log('Vehicle accounts, cards, and transactions seeded.');

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
