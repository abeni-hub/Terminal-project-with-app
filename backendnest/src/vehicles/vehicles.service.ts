import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/create-vehicle.dto';
import { QueryParamsDto } from '../common/dto/query-params.dto';

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  private mapVehicle(v: any) {
    return {
      id: v.id,
      plateNumber: v.plateNumber,
      model: v.model,
      type: v.type,
      capacity: v.capacity,
      status: v.status,
      groupId: v.groupId,
      driverName: v.driverName || undefined,
      driverPhone: v.driverPhone || undefined,
      lastMaintenance: v.lastMaintenance?.toISOString() || undefined,
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
    };
  }

  async list(
    query: QueryParamsDto & {
      status?: string;
      type?: string;
      groupId?: string;
      assignmentId?: string;
      dispatcherId?: string;
    },
    currentUser?: any,
  ) {
    const { page = 1, pageSize = 10, search, sortBy, sortDir } = query;
    const skip = (page - 1) * pageSize;
    const where: any = {};

    const isDispatcher = currentUser?.role?.name === 'DISPATCHER' || currentUser?.roleId === 'role-dispatcher';

    if (query.assignmentId && query.assignmentId !== 'all') {
      const assignment = await this.prisma.weeklyAssignment.findUnique({ where: { id: query.assignmentId } });
      if (assignment) {
        where.groupId = assignment.vehicleGroupId;
      }
    } else if (query.groupId && query.groupId !== 'all') {
      where.groupId = query.groupId;
    } else if (query.dispatcherId && query.dispatcherId !== 'all') {
      const currentWeek = require('../common/utils/date.util').getCurrentWeekNumber();
      const activeAssignments = await this.prisma.weeklyAssignment.findMany({
        where: {
          weekNumber: currentWeek,
          status: { in: ['PUBLISHED', 'LOCKED'] },
          dispatcherIds: { has: query.dispatcherId },
        },
        select: { vehicleGroupId: true },
      });
      const activeGroupIds = [...new Set(activeAssignments.map((a) => a.vehicleGroupId))];
      if (activeGroupIds.length > 0) {
        where.groupId = { in: activeGroupIds };
      }
    }

    if (search) {
      where.OR = [
        { plateNumber: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { driverName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (query.status && query.status !== 'all') where.status = query.status as any;
    if (query.type && query.type !== 'all') where.type = query.type as any;

    const orderBy: any = sortBy ? { [sortBy]: sortDir || 'asc' } : { createdAt: 'desc' };
    const [data, total] = await Promise.all([
      this.prisma.vehicle.findMany({ where, skip, take: pageSize, orderBy }),
      this.prisma.vehicle.count({ where }),
    ]);

    return {
      data: data.map(this.mapVehicle),
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async create(dto: CreateVehicleDto) {
    const existing = await this.prisma.vehicle.findUnique({ where: { plateNumber: dto.plateNumber } });
    if (existing) throw new HttpException('A vehicle with this plate number already exists.', HttpStatus.CONFLICT);
    const group = await this.prisma.vehicleGroup.findUnique({ where: { id: dto.groupId } });
    if (!group) throw new HttpException('Vehicle group not found.', HttpStatus.NOT_FOUND);
    const v = await this.prisma.vehicle.create({
      data: {
        ...dto,
        status: dto.status || 'IDLE',
        account: {
          create: {
            plateNumber: dto.plateNumber,
            balance: 0.0,
            status: 'ACTIVE',
          },
        },
      },
    });
    return this.mapVehicle(v);
  }

  async update(id: string, dto: UpdateVehicleDto) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) throw new HttpException('Vehicle not found.', HttpStatus.NOT_FOUND);
    if (dto.plateNumber && dto.plateNumber !== vehicle.plateNumber) {
      const existing = await this.prisma.vehicle.findUnique({ where: { plateNumber: dto.plateNumber } });
      if (existing) throw new HttpException('A vehicle with this plate number already exists.', HttpStatus.CONFLICT);
    }
    const v = await this.prisma.vehicle.update({ where: { id }, data: { ...dto } });
    return this.mapVehicle(v);
  }

  async getById(id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      include: { group: true },
    });
    if (!vehicle) throw new HttpException('Vehicle not found.', HttpStatus.NOT_FOUND);
    return {
      ...this.mapVehicle(vehicle),
      groupName: vehicle.group?.name || '',
    };
  }

  async getVehicleHistory(idOrPlate: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        OR: [{ id: idOrPlate }, { plateNumber: idOrPlate }],
      },
      include: { group: true },
    });
    if (!vehicle) throw new HttpException('Vehicle not found.', HttpStatus.NOT_FOUND);

    // 1. Fetch Weekly Assignments for vehicle's group
    const assignments = await this.prisma.weeklyAssignment.findMany({
      where: { vehicleGroupId: vehicle.groupId },
      orderBy: { weekStart: 'desc' },
      include: { originTerminal: true, destinationTerminal: true },
    });

    // 2. Fetch Terminal Entries (Queue records)
    const queueEntries = await this.prisma.queueEntry.findMany({
      where: { vehicleId: vehicle.id },
      orderBy: { checkedInAt: 'desc' },
      take: 50,
      include: { terminal: true },
    });

    // 3. Fetch Dispatches / Trips
    const dispatchRecords = await this.prisma.dispatchRecord.findMany({
      where: { vehicleId: vehicle.id },
      orderBy: { dispatchTime: 'desc' },
      take: 50,
    });

    // 4. Fetch Violations
    const violations = await this.prisma.violation.findMany({
      where: { vehicleId: vehicle.id },
      orderBy: { reportedAt: 'desc' },
      take: 50,
    });

    // 5. Fetch ALPR Recognition Events
    const recognitionEvents = await this.prisma.recognitionEvent.findMany({
      where: {
        OR: [{ vehicleId: vehicle.id }, { plateNumber: vehicle.plateNumber }],
      },
      orderBy: { capturedAt: 'desc' },
      take: 50,
      include: { camera: true, terminal: true },
    });

    // 6. Fetch Audit Logs
    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        OR: [
          { entityId: vehicle.id },
          { details: { contains: vehicle.plateNumber, mode: 'insensitive' } },
        ],
      },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    return {
      vehicle: {
        ...this.mapVehicle(vehicle),
        groupName: vehicle.group?.name || '',
      },
      assignments: assignments.map((a) => ({
        id: a.id,
        name: a.name,
        weekNumber: a.weekNumber,
        weekStart: a.weekStart.toISOString().split('T')[0],
        weekEnd: a.weekEnd.toISOString().split('T')[0],
        status: a.status,
        route: `${a.originTerminal.name} → ${a.destinationTerminal.name}`,
        originTerminalName: a.originTerminal.name,
        destinationTerminalName: a.destinationTerminal.name,
      })),
      queueEntries: queueEntries.map((q) => ({
        id: q.id,
        terminalName: q.terminalName,
        destinationTerminalName: q.destinationTerminalName,
        position: q.position,
        status: q.status,
        entryType: q.entryType,
        confidence: q.confidence,
        checkedInAt: q.checkedInAt.toISOString(),
        checkedInBy: q.checkedInBy,
        dispatchInTime: q.dispatchInTime?.toISOString(),
        exitCapturedAt: q.exitCapturedAt?.toISOString(),
        dispatchedAt: q.dispatchedAt?.toISOString(),
        dispatchedBy: q.dispatchedBy,
        isViolation: q.isViolation,
        violationRemark: q.violationRemark,
      })),
      dispatchRecords: dispatchRecords.map((d) => ({
        id: d.id,
        originTerminalName: d.originTerminalName,
        destinationTerminalName: d.destinationTerminalName,
        dispatcherName: d.dispatcherName,
        dispatchTime: d.dispatchTime.toISOString(),
        entryTime: d.entryTime?.toISOString(),
        dispatchInTime: d.dispatchInTime?.toISOString(),
        dispatchOutTime: d.dispatchOutTime?.toISOString(),
        feeAmount: d.feeAmount,
        paymentStatus: d.paymentStatus,
        paymentReference: d.paymentReference,
        departureConfirmed: d.departureConfirmed,
        auditRef: d.auditRef,
      })),
      violations: violations.map((v) => ({
        id: v.id,
        type: v.type,
        description: v.description,
        severity: v.severity,
        status: v.status,
        reportedBy: v.reportedBy,
        reportedAt: v.reportedAt.toISOString(),
        resolvedAt: v.resolvedAt?.toISOString(),
        resolution: v.resolution,
        resolutionAction: v.resolutionAction,
        remark: v.remark,
      })),
      recognitionEvents: recognitionEvents.map((r) => ({
        id: r.id,
        cameraName: r.camera?.name || '',
        cameraType: r.cameraType,
        terminalName: r.terminal?.name || '',
        confidence: r.confidence,
        capturedAt: r.capturedAt.toISOString(),
        imagePath: r.imagePath,
        processingResult: r.processingResult,
        remarks: r.remarks,
      })),
      auditLogs: auditLogs.map((a) => ({
        id: a.id,
        actor: a.actor,
        action: a.action,
        entity: a.entity,
        details: a.details,
        timestamp: a.timestamp.toISOString(),
      })),
    };
  }

  async delete(id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) throw new HttpException('Vehicle not found.', HttpStatus.NOT_FOUND);
    await this.prisma.vehicle.delete({ where: { id } });
    return { success: true };
  }
}
