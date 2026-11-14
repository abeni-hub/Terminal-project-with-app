import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardData() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      vehiclesInQueue,
      vehiclesDispatchedToday,
      activeRoutes,
      activeTerminals,
      activeDispatchers,
      violationsToday,
      offlineDevices,
      pendingDevices,
      activeAssignments,
      revenueToday,
      recentDispatches,
      recentViolations,
      recentAuditLogs,
      recentOverrides,
    ] = await Promise.all([
      this.prisma.queueEntry.count({ where: { status: 'WAITING' } }),
      this.prisma.dispatchRecord.count({ where: { dispatchTime: { gte: today } } }),
      this.prisma.route.count({ where: { status: 'ACTIVE' } }),
      this.prisma.terminal.count({ where: { status: 'OPERATIONAL' } }),
      this.prisma.user.count({ where: { role: { name: 'DISPATCHER' }, status: 'ACTIVE' } }),
      this.prisma.violation.count({ where: { reportedAt: { gte: today } } }),
      this.prisma.device.count({ where: { status: 'OFFLINE' } }),
      this.prisma.device.count({ where: { status: 'PENDING' } }),
      this.prisma.weeklyAssignment.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.dispatchRecord.aggregate({ where: { dispatchTime: { gte: today } }, _sum: { feeAmount: true } }),
      this.prisma.dispatchRecord.findMany({ take: 5, orderBy: { dispatchTime: 'desc' } }),
      this.prisma.violation.findMany({ take: 5, orderBy: { reportedAt: 'desc' } }),
      this.prisma.auditLog.findMany({ take: 5, orderBy: { timestamp: 'desc' } }),
      this.prisma.override.findMany({ take: 5, orderBy: { createdAt: 'desc' } }),
    ]);

    // Generate 7-day dispatch trend
    const dispatchTrend = await Promise.all(
      Array.from({ length: 7 }, async (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        date.setHours(0, 0, 0, 0);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        const count = await this.prisma.dispatchRecord.count({ where: { dispatchTime: { gte: date, lt: nextDate } } });
        return { date: date.toLocaleDateString('en-US', { weekday: 'short' }), value: count };
      }),
    );

    // Generate 7-day queue trend
    const queueTrend = await Promise.all(
      Array.from({ length: 7 }, async (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        date.setHours(0, 0, 0, 0);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        const count = await this.prisma.queueEntry.count({ where: { checkedInAt: { gte: date, lt: nextDate } } });
        return { date: date.toLocaleDateString('en-US', { weekday: 'short' }), value: count };
      }),
    );

    return {
      stats: {
        vehiclesInQueue,
        vehiclesDispatchedToday,
        activeRoutes,
        activeTerminals,
        activeDispatchers,
        violationsToday,
        offlineDevices,
        pendingSyncActions: pendingDevices,
        activeAssignments,
        dispatchRevenueToday: revenueToday._sum.feeAmount || 0,
      },
      dispatchTrend,
      queueTrend,
      violationsByRoute: [],
      terminalUtilization: [],
      dailyActivity: dispatchTrend,
      recentDispatches: recentDispatches.map((d) => ({
        id: d.id, plateNumber: d.plateNumber,
        route: `${d.originTerminalName} - ${d.destinationTerminalName}`,
        terminal: d.originTerminalName, dispatcher: d.dispatcherName,
        dispatchedAt: d.dispatchTime.toISOString(), status: 'DISPATCHED',
      })),
      recentViolations: recentViolations.map((v) => ({
        id: v.id, vehicleId: v.vehicleId, plateNumber: v.plateNumber,
        assignmentId: v.assignmentId || undefined, routeId: v.routeId || undefined,
        terminalId: v.terminalId || undefined, type: v.type, description: v.description,
        severity: v.severity, status: v.status, reportedBy: v.reportedBy,
        reportedAt: v.reportedAt.toISOString(), resolvedAt: v.resolvedAt?.toISOString(),
        resolution: v.resolution || undefined,
      })),
      recentAuditLogs: recentAuditLogs.map((a) => ({
        id: a.id, actor: a.actor, action: a.action, entity: a.entity,
        entityId: a.entityId, details: a.details, ipAddress: a.ipAddress || undefined,
        timestamp: a.timestamp.toISOString(),
      })),
      recentOverrides: recentOverrides.map((o) => ({
        id: o.id, requestedBy: o.requestedBy, action: o.action, reason: o.reason,
        assignmentId: o.assignmentId || undefined, status: o.status,
        approvedBy: o.approvedBy || undefined, approvedAt: o.approvedAt?.toISOString(),
        auditRef: o.auditRef || undefined, createdAt: o.createdAt.toISOString(),
      })),
    };
  }

  async getDispatcherDashboard(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { terminal: true } });
    if (!user) return null;

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1);
    weekStart.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const userAssignments = await this.prisma.weeklyAssignment.findMany({
      where: { dispatcherIds: { has: userId }, status: 'PUBLISHED', weekStart: { gte: weekStart } },
    });

    const assignmentIds = userAssignments.map((a) => a.id);

    const [liveQueue, userDispatchesToday, weeklyRevenue, recentHistory] = await Promise.all([
      this.prisma.queueEntry.findMany({ where: { assignmentId: { in: assignmentIds }, status: 'WAITING' }, orderBy: { position: 'asc' } }),
      this.prisma.dispatchRecord.findMany({ where: { dispatcherId: userId, dispatchTime: { gte: today } } }),
      this.prisma.dispatchRecord.aggregate({ where: { dispatcherId: userId, dispatchTime: { gte: weekStart } }, _sum: { feeAmount: true } }),
      this.prisma.dispatchRecord.findMany({ where: { dispatcherId: userId }, take: 10, orderBy: { dispatchTime: 'desc' } }),
    ]);

    const dailyRevenue = userDispatchesToday.reduce((sum, d) => sum + d.feeAmount, 0);

    // Build assignment info
    const todayAssignments = await Promise.all(
      userAssignments.map(async (a) => {
        const origin = await this.prisma.terminal.findUnique({ where: { id: a.originTerminalId } });
        const dest = await this.prisma.terminal.findUnique({ where: { id: a.destinationTerminalId } });
        const group = await this.prisma.vehicleGroup.findUnique({ where: { id: a.vehicleGroupId } });
        return {
          assignmentId: a.id,
          route: `${origin?.name} - ${dest?.name}`,
          vehicleGroup: group?.name || '',
          originTerminal: origin?.name || '',
          destinationTerminal: dest?.name || '',
        };
      }),
    );

    return {
      todayAssignments,
      assignedTerminal: user.terminal?.name || '',
      assignedRoutes: todayAssignments.map((a) => a.route),
      assignedVehicleGroups: [...new Set(todayAssignments.map((a) => a.vehicleGroup))],
      liveQueue: liveQueue.map((q) => ({ position: q.position, plateNumber: q.plateNumber, status: q.status })),
      vehiclesWaiting: liveQueue.length,
      vehiclesDispatchedToday: userDispatchesToday.length,
      dispatchRevenueToday: dailyRevenue,
      dispatchRevenueWeek: weeklyRevenue._sum.feeAmount || 0,
      recentDispatchHistory: recentHistory.map((r) => ({
        id: r.id, vehicleId: r.vehicleId, plateNumber: r.plateNumber,
        vehicleGroupId: r.vehicleGroupId, vehicleGroupName: r.vehicleGroupName,
        originTerminalId: r.originTerminalId, originTerminalName: r.originTerminalName,
        destinationTerminalId: r.destinationTerminalId, destinationTerminalName: r.destinationTerminalName,
        dispatcherId: r.dispatcherId, dispatcherName: r.dispatcherName,
        dispatchTime: r.dispatchTime.toISOString(), queuePosition: r.queuePosition,
        feeAmount: r.feeAmount, feeRuleId: r.feeRuleId,
        deviceId: r.deviceId || undefined, auditRef: r.auditRef,
      })),
      dispatchRevenue: {
        daily: dailyRevenue,
        weekly: weeklyRevenue._sum.feeAmount || 0,
        monthly: weeklyRevenue._sum.feeAmount || 0,
        byTerminal: [{ terminal: user.terminal?.name || '', revenue: dailyRevenue }],
        byRoute: todayAssignments.map((a) => ({ route: a.route, revenue: 0 })),
        byDispatcher: [{ dispatcher: user.name, revenue: dailyRevenue }],
        trend: Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return { date: d.toLocaleDateString('en-US', { weekday: 'short' }), revenue: 0 };
        }),
      },
    };
  }
}
