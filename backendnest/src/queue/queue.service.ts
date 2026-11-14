import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CheckInVehicleDto,
  DispatchVehicleDto,
  DispatchInDto,
  ConfirmPaymentDto,
  ResolveViolationEntryDto,
} from './dto/queue.dto';
import { QueryParamsDto } from '../common/dto/query-params.dto';
import { EventsGateway } from '../events/events.gateway';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
    private readonly auditService: AuditService,
  ) {}

  private mapEntry(q: any) {
    return {
      id: q.id,
      vehicleId: q.vehicleId,
      plateNumber: q.plateNumber,
      vehicleGroupName: q.vehicleGroupName,
      assignmentId: q.assignmentId,
      terminalId: q.terminalId,
      terminalName: q.terminalName,
      destinationTerminalName: q.destinationTerminalName,
      position: q.position,
      status: q.status,
      entryType: q.entryType,
      confidence: q.confidence,
      cameraId: q.cameraId,
      exitCameraId: q.exitCameraId,
      checkedInAt: q.checkedInAt.toISOString(),
      checkedInBy: q.checkedInBy,
      dispatchInTime: q.dispatchInTime?.toISOString() || undefined,
      exitCapturedAt: q.exitCapturedAt?.toISOString() || undefined,
      dispatchedAt: q.dispatchedAt?.toISOString() || undefined,
      dispatchedBy: q.dispatchedBy || undefined,
      isViolation: q.isViolation,
      violationRemark: q.violationRemark || undefined,
    };
  }

  async list(
    query: QueryParamsDto & {
      terminalId?: string;
      assignmentId?: string;
      status?: string;
      isViolation?: boolean;
      plateNumber?: string;
    },
    currentUser?: any,
  ) {
    const { page = 1, pageSize = 10, search, sortBy, sortDir, plateNumber } = query;
    const skip = (page - 1) * pageSize;
    const where: any = {};

    const isDispatcher = currentUser?.role?.name === 'DISPATCHER' || currentUser?.roleId === 'role-dispatcher';

    if (isDispatcher && currentUser) {
      if (currentUser.terminalId) {
        where.terminalId = currentUser.terminalId;
      }
      // Look up active assignments for dispatcher for current active week
      const currentWeek = require('../common/utils/date.util').getCurrentWeekNumber();
      const activeAssignments = await this.prisma.weeklyAssignment.findMany({
        where: {
          weekNumber: currentWeek,
          status: { in: ['PUBLISHED', 'LOCKED'] },
          dispatcherIds: { has: currentUser.id },
        },
        select: { id: true },
      });
      const activeAssignmentIds = activeAssignments.map((a) => a.id);

      if (query.assignmentId && query.assignmentId !== 'all') {
        if (activeAssignmentIds.includes(query.assignmentId)) {
          where.assignmentId = query.assignmentId;
        } else {
          return { data: [], total: 0, page: Number(page), pageSize: Number(pageSize), totalPages: 1 };
        }
      } else if (activeAssignmentIds.length > 0) {
        where.assignmentId = { in: activeAssignmentIds };
      }
    } else {
      if (query.terminalId && query.terminalId !== 'all') where.terminalId = query.terminalId;
      if (query.assignmentId && query.assignmentId !== 'all') where.assignmentId = query.assignmentId;
    }

    if (plateNumber && plateNumber !== 'all') {
      where.plateNumber = { contains: plateNumber, mode: 'insensitive' };
    } else if (search) {
      where.OR = [
        { plateNumber: { contains: search, mode: 'insensitive' } },
        { vehicleGroupName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (query.isViolation !== undefined) where.isViolation = query.isViolation;

    if (query.status) {
      if (query.status === 'OTHERS') {
        where.status = { in: ['CANCELLED', 'NO_SHOW'] };
      } else if (query.status === 'ACTIVE_OPERATIONAL') {
        where.status = { in: ['WAITING', 'LOADING', 'READY_TO_DEPART', 'DETECTED_AT_EXIT'] };
      } else if (query.status === 'VIOLATIONS') {
        where.isViolation = true;
      } else if (query.status !== 'ALL') {
        where.status = query.status as any;
      }
    }

    const orderBy: any = sortBy ? { [sortBy]: sortDir || 'asc' } : { position: 'asc' };
    const [data, total] = await Promise.all([
      this.prisma.queueEntry.findMany({ where, skip, take: pageSize, orderBy }),
      this.prisma.queueEntry.count({ where }),
    ]);

    return {
      data: data.map(this.mapEntry),
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  /**
   * Dispatch In: Confirms arrival of an assigned (or permitted) vehicle,
   * moves it into the Loading / Yard state.
   */
  async dispatchIn(dto: DispatchInDto) {
    const entry = await this.prisma.queueEntry.findUnique({
      where: { id: dto.queueEntryId },
      include: { vehicle: true, assignment: true, terminal: true },
    });
    if (!entry) throw new HttpException('Queue entry not found.', HttpStatus.NOT_FOUND);

    const dispatcher = await this.prisma.user.findUnique({ where: { id: dto.dispatcherId } });
    if (!dispatcher) throw new HttpException('Dispatcher not found.', HttpStatus.NOT_FOUND);

    const now = new Date();

    // If entry had a violation, resolve it or record resolution remark
    if (entry.isViolation) {
      const openViolation = await this.prisma.violation.findFirst({
        where: { vehicleId: entry.vehicleId, terminalId: entry.terminalId, status: 'OPEN' },
        orderBy: { reportedAt: 'desc' },
      });

      if (openViolation) {
        await this.prisma.violation.update({
          where: { id: openViolation.id },
          data: {
            status: 'RESOLVED',
            resolutionAction: 'DISPATCH_IN',
            dispatcherId: dispatcher.id,
            remark: dto.remark || 'Dispatcher approved operational dispatch in with remark.',
            resolvedAt: now,
          },
        });
      }
    }

    // Update queue entry state to LOADING
    const updatedEntry = await this.prisma.queueEntry.update({
      where: { id: entry.id },
      data: {
        status: 'LOADING',
        dispatchInTime: now,
        violationRemark: dto.remark ? `${entry.violationRemark || ''} | Dispatch In: ${dto.remark}` : entry.violationRemark,
      },
    });

    // Update vehicle status
    await this.prisma.vehicle.update({
      where: { id: entry.vehicleId },
      data: { status: 'WAITING', journeyState: 'WAITING' },
    });

    // Audit Log
    await this.auditService.log(
      dispatcher.name,
      'DISPATCH_IN',
      'QueueEntry',
      entry.id,
      `Confirmed Dispatch In for ${entry.plateNumber} at ${entry.terminalName}. Moved to LOADING yard.${dto.remark ? ` Remark: ${dto.remark}` : ''}`,
    );

    this.eventsGateway.emitQueueUpdated({
      type: 'DISPATCH_IN',
      queueEntry: updatedEntry,
      terminalId: entry.terminalId,
    });

    return this.mapEntry(updatedEntry);
  }

  /**
   * Dispatch Out: Confirms vehicle departure from terminal after loading and fee check.
   */
  async dispatchOut(dto: DispatchVehicleDto) {
    const entry = await this.prisma.queueEntry.findUnique({
      where: { id: dto.queueEntryId },
      include: { vehicle: true, assignment: true, terminal: true },
    });
    if (!entry) throw new HttpException('Queue entry not found.', HttpStatus.NOT_FOUND);
    if (entry.status === 'DISPATCHED') {
      throw new HttpException('Vehicle is already dispatched out.', HttpStatus.BAD_REQUEST);
    }

    const dispatcher = await this.prisma.user.findUnique({ where: { id: dto.dispatcherId } });
    if (!dispatcher) throw new HttpException('Dispatcher not found.', HttpStatus.NOT_FOUND);

    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: entry.vehicleId } });
    if (!vehicle) throw new HttpException('Vehicle not found.', HttpStatus.NOT_FOUND);

    // Get active fee rule for vehicle type
    const feeRule = await this.prisma.dispatchFeeRule.findFirst({
      where: { vehicleType: vehicle.type, active: true },
    });
    const feeAmount = dto.feeAmount !== undefined ? dto.feeAmount : (feeRule?.amount || 25.0);
    const feeRuleId = feeRule ? feeRule.id : 'default-fee-rule';
    // Fetch related entities for dispatch record
    const assignment = entry.assignmentId !== 'unassigned'
      ? await this.prisma.weeklyAssignment.findUnique({ where: { id: entry.assignmentId } })
      : null;
    const vehicleGroup = assignment
      ? await this.prisma.vehicleGroup.findUnique({ where: { id: assignment.vehicleGroupId } })
      : null;
    const destTerminal = assignment
      ? await this.prisma.terminal.findUnique({ where: { id: assignment.destinationTerminalId } })
      : null;

    const now = new Date();
    const paymentStatus = dto.paymentStatus || 'PAID';
    const paymentRef = dto.paymentReference || `REC-${Date.now()}`;

    // Get or ensure vehicle financial account
    let vehicleAccount = await this.prisma.vehicleAccount.findUnique({ where: { vehicleId: vehicle.id } });
    if (!vehicleAccount) {
      vehicleAccount = await this.prisma.vehicleAccount.create({
        data: {
          vehicleId: vehicle.id,
          plateNumber: vehicle.plateNumber,
          balance: 0.0,
          status: 'ACTIVE',
        },
      });
    }

    const activeCard = await this.prisma.transportCard.findFirst({
      where: { vehicleId: vehicle.id, status: 'ACTIVE' },
    });

    const balanceBefore = vehicleAccount.balance;
    const balanceAfter = Number((balanceBefore - feeAmount).toFixed(2));
    const newAccountStatus = balanceAfter < 0 ? 'OUTSTANDING_DEBT' : vehicleAccount.status;

    // Execute atomic transaction for dispatch, account balance deduction, and ledger record
    const [record, updatedEntry] = await this.prisma.$transaction([
      this.prisma.dispatchRecord.create({
        data: {
          vehicleId: vehicle.id,
          plateNumber: vehicle.plateNumber,
          vehicleGroupId: assignment?.vehicleGroupId || vehicle.groupId,
          vehicleGroupName: vehicleGroup?.name || entry.vehicleGroupName,
          originTerminalId: entry.terminalId,
          originTerminalName: entry.terminalName,
          destinationTerminalId: destTerminal?.id || entry.terminalId,
          destinationTerminalName: destTerminal?.name || entry.destinationTerminalName,
          dispatcherId: dispatcher.id,
          dispatcherName: dispatcher.name,
          dispatchTime: now,
          entryTime: entry.checkedInAt,
          dispatchInTime: entry.dispatchInTime,
          dispatchOutTime: now,
          queuePosition: entry.position,
          feeAmount,
          feeRuleId,
          paymentStatus,
          paymentReference: paymentRef,
          paymentCollectorId: dispatcher.id,
          paymentCollectorName: dispatcher.name,
          paymentConfirmedAt: paymentStatus === 'PAID' ? now : null,
          tripStatus: 'COMPLETED',
          deviceId: dto.deviceId || null,
          auditRef: `AUD-${Date.now()}`,
          departureConfirmed: true,
        },
      }),
      this.prisma.queueEntry.update({
        where: { id: entry.id },
        data: {
          status: 'DISPATCHED',
          dispatchedAt: now,
          dispatchedBy: dispatcher.name,
        },
      }),
      this.prisma.vehicleAccount.update({
        where: { id: vehicleAccount.id },
        data: {
          balance: balanceAfter,
          status: newAccountStatus,
          lastTransactionAt: now,
        },
      }),
      this.prisma.vehicleAccountTransaction.create({
        data: {
          vehicleAccountId: vehicleAccount.id,
          vehicleId: vehicle.id,
          cardId: activeCard?.id || null,
          type: 'DISPATCH_FEE',
          amount: -feeAmount,
          balanceBefore,
          balanceAfter,
          paymentMethod: 'CASH',
          paymentReference: paymentRef,
          description: `Dispatch fee deduction (${feeAmount} ETB) from ${entry.terminalName} to ${destTerminal?.name || entry.destinationTerminalName}`,
          performedBy: dispatcher.name,
          createdAt: now,
        },
      }),
      this.prisma.vehicle.update({
        where: { id: vehicle.id },
        data: { status: 'DISPATCHED', journeyState: 'ON_ROUTE' },
      }),
    ]);

    // Audit log
    await this.auditService.log(
      dispatcher.name,
      'DISPATCH_OUT',
      'QueueEntry',
      entry.id,
      `Dispatched out ${vehicle.plateNumber} from ${entry.terminalName} to ${entry.destinationTerminalName}. Fee: ${feeAmount} ETB deducted. New Balance: ${balanceAfter} ETB. Ref: ${paymentRef}`,
    );

    this.eventsGateway.emitQueueUpdated({
      type: 'DISPATCH_OUT',
      queueEntry: updatedEntry,
      terminalId: entry.terminalId,
    });
    this.eventsGateway.emitJourneyStateChanged({
      vehicleId: vehicle.id,
      plateNumber: vehicle.plateNumber,
      journeyState: 'ON_ROUTE',
      terminalId: entry.terminalId,
    });
    this.eventsGateway.emitAccountUpdated({
      type: 'DISPATCH_FEE',
      vehicleId: vehicle.id,
      plateNumber: vehicle.plateNumber,
      balance: balanceAfter,
      feeAmount,
      dispatchRecordId: record.id,
    });

    return {
      id: record.id,
      vehicleId: record.vehicleId,
      plateNumber: record.plateNumber,
      vehicleGroupId: record.vehicleGroupId,
      vehicleGroupName: record.vehicleGroupName,
      originTerminalId: record.originTerminalId,
      originTerminalName: record.originTerminalName,
      destinationTerminalId: record.destinationTerminalId,
      destinationTerminalName: record.destinationTerminalName,
      dispatcherId: record.dispatcherId,
      dispatcherName: record.dispatcherName,
      dispatchTime: record.dispatchTime.toISOString(),
      entryTime: record.entryTime?.toISOString(),
      dispatchInTime: record.dispatchInTime?.toISOString(),
      dispatchOutTime: record.dispatchOutTime?.toISOString(),
      queuePosition: record.queuePosition,
      feeAmount: record.feeAmount,
      feeRuleId: record.feeRuleId,
      paymentStatus: record.paymentStatus,
      paymentReference: record.paymentReference,
      paymentConfirmedAt: record.paymentConfirmedAt?.toISOString(),
      deviceId: record.deviceId || undefined,
      auditRef: record.auditRef,
    };
  }

  /**
   * Confirm fee payment for a trip / dispatch record
   */
  async confirmPayment(dto: ConfirmPaymentDto) {
    const dispatcher = await this.prisma.user.findUnique({ where: { id: dto.dispatcherId } });
    if (!dispatcher) throw new HttpException('Dispatcher not found.', HttpStatus.NOT_FOUND);

    let record = null;
    if (dto.dispatchRecordId) {
      record = await this.prisma.dispatchRecord.findUnique({ where: { id: dto.dispatchRecordId } });
    }

    if (!record && dto.queueEntryId) {
      record = await this.prisma.dispatchRecord.findFirst({
        where: { vehicleId: dto.queueEntryId },
        orderBy: { dispatchTime: 'desc' },
      });
    }

    if (!record) throw new HttpException('Dispatch record not found.', HttpStatus.NOT_FOUND);

    const now = new Date();
    const updated = await this.prisma.dispatchRecord.update({
      where: { id: record.id },
      data: {
        paymentStatus: dto.paymentStatus || 'PAID',
        paymentReference: dto.paymentReference,
        paymentCollectorId: dispatcher.id,
        paymentCollectorName: dispatcher.name,
        paymentConfirmedAt: now,
      },
    });

    await this.auditService.log(
      dispatcher.name,
      'FEE_PAYMENT_CONFIRMED',
      'DispatchRecord',
      record.id,
      `Confirmed payment of ${record.feeAmount} ETB for ${record.plateNumber}. Ref: ${dto.paymentReference}`,
    );

    return updated;
  }

  /**
   * Resolve an unassigned / wrong-terminal violation entry directly from dispatcher live console
   */
  async resolveViolationEntry(dto: ResolveViolationEntryDto) {
    const entry = await this.prisma.queueEntry.findUnique({ where: { id: dto.queueEntryId } });
    if (!entry) throw new HttpException('Queue entry not found.', HttpStatus.NOT_FOUND);

    const dispatcher = await this.prisma.user.findUnique({ where: { id: dto.dispatcherId } });
    if (!dispatcher) throw new HttpException('Dispatcher not found.', HttpStatus.NOT_FOUND);

    const now = new Date();

    if (dto.action === 'DISPATCH_IN') {
      return this.dispatchIn({
        queueEntryId: dto.queueEntryId,
        dispatcherId: dto.dispatcherId,
        remark: dto.remark,
      });
    } else {
      // REJECT: Cancel queue entry and update vehicle status to IDLE
      const updated = await this.prisma.queueEntry.update({
        where: { id: entry.id },
        data: {
          status: 'CANCELLED',
          violationRemark: `REJECTED by ${dispatcher.name}: ${dto.remark}`,
        },
      });

      await this.prisma.vehicle.update({
        where: { id: entry.vehicleId },
        data: { status: 'IDLE', journeyState: 'WAITING' },
      });

      const openViolation = await this.prisma.violation.findFirst({
        where: { vehicleId: entry.vehicleId, terminalId: entry.terminalId, status: 'OPEN' },
        orderBy: { reportedAt: 'desc' },
      });

      if (openViolation) {
        await this.prisma.violation.update({
          where: { id: openViolation.id },
          data: {
            status: 'RESOLVED',
            resolutionAction: 'REJECT',
            dispatcherId: dispatcher.id,
            remark: dto.remark,
            resolvedAt: now,
          },
        });
      }

      await this.auditService.log(
        dispatcher.name,
        'VIOLATION_REJECTED',
        'QueueEntry',
        entry.id,
        `Rejected entry for ${entry.plateNumber} at ${entry.terminalName}. Reason: ${dto.remark}`,
      );

      this.eventsGateway.emitQueueUpdated({
        type: 'QUEUE_CANCELLED',
        queueEntry: updated,
        terminalId: entry.terminalId,
      });

      return this.mapEntry(updated);
    }
  }

  /**
   * Manual Check-in Fallback when ANPR camera is unavailable or plate is unreadable
   */
  async checkIn(dto: CheckInVehicleDto) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } });
    if (!vehicle) throw new HttpException('Vehicle not found.', HttpStatus.NOT_FOUND);
    if (!vehicle.groupId) throw new HttpException('Vehicle must belong to a vehicle group.', HttpStatus.BAD_REQUEST);

    const assignment = await this.prisma.weeklyAssignment.findUnique({ where: { id: dto.assignmentId } });
    if (!assignment) throw new HttpException('Weekly route assignment not found.', HttpStatus.NOT_FOUND);
    if (!['PUBLISHED', 'LOCKED'].includes(assignment.status)) {
      throw new HttpException('Assignment is not published or locked.', HttpStatus.BAD_REQUEST);
    }

    const alreadyWaiting = await this.prisma.queueEntry.findFirst({
      where: {
        vehicleId: dto.vehicleId,
        assignmentId: dto.assignmentId,
        status: { in: ['WAITING', 'LOADING', 'READY_TO_DEPART'] },
      },
    });
    if (alreadyWaiting) throw new HttpException('Vehicle is already active in the queue.', HttpStatus.BAD_REQUEST);

    const dispatcher = await this.prisma.user.findUnique({ where: { id: dto.dispatcherId } });
    if (!dispatcher) throw new HttpException('Dispatcher not found.', HttpStatus.NOT_FOUND);

    const checkInTerminalId = dispatcher.terminalId || assignment.originTerminalId;
    const checkOutTerminalId =
      checkInTerminalId === assignment.originTerminalId
        ? assignment.destinationTerminalId
        : assignment.originTerminalId;

    const checkInTerminal = await this.prisma.terminal.findUnique({ where: { id: checkInTerminalId } });
    const checkOutTerminal = await this.prisma.terminal.findUnique({ where: { id: checkOutTerminalId } });
    const vehicleGroup = await this.prisma.vehicleGroup.findUnique({ where: { id: assignment.vehicleGroupId } });

    const groupMismatch = assignment.vehicleGroupId !== vehicle.groupId;
    const isViolation = groupMismatch || dto.isViolation || false;
    const violationRemark = isViolation
      ? (dto.violationRemark?.trim() || `Manual Check-In: Vehicle from group ${vehicle.groupId} admitted to route assignment for ${vehicleGroup?.name || assignment.vehicleGroupId}`)
      : null;

    const waitingCount = await this.prisma.queueEntry.count({
      where: { assignmentId: dto.assignmentId, terminalId: checkInTerminalId, status: 'WAITING' },
    });
    const position = waitingCount + 1;

    const entry = await this.prisma.queueEntry.create({
      data: {
        vehicleId: vehicle.id,
        plateNumber: vehicle.plateNumber,
        vehicleGroupName: isViolation ? `${vehicle.groupId} (Unassigned/Wrong Group)` : (vehicleGroup?.name || ''),
        assignmentId: dto.assignmentId,
        terminalId: checkInTerminalId,
        terminalName: checkInTerminal?.name || '',
        destinationTerminalName: checkOutTerminal?.name || '',
        position,
        status: 'WAITING',
        entryType: isViolation ? 'VIOLATION' : 'MANUAL',
        checkedInBy: `${dispatcher.name} (Manual Fallback)`,
        isViolation,
        violationRemark,
      },
    });

    await this.prisma.vehicle.update({ where: { id: vehicle.id }, data: { status: 'WAITING', journeyState: 'WAITING' } });

    if (isViolation) {
      await this.prisma.violation.create({
        data: {
          vehicleId: vehicle.id,
          plateNumber: vehicle.plateNumber,
          assignmentId: dto.assignmentId,
          terminalId: checkInTerminalId,
          type: 'WRONG_VEHICLE_GROUP',
          description: `Manual Check-in: Vehicle ${vehicle.plateNumber} from group ${vehicle.groupId} admitted to assignment for ${vehicleGroup?.name}. ${violationRemark}`,
          severity: 'HIGH',
          status: 'OPEN',
          reportedBy: `${dispatcher.name} (Manual Fallback)`,
        },
      });
    }

    await this.auditService.log(
      dispatcher.name,
      'MANUAL_CHECK_IN',
      'QueueEntry',
      entry.id,
      `Manual check-in for vehicle ${vehicle.plateNumber} at ${checkInTerminal?.name}.${groupMismatch ? ` (Violation: ${dto.violationRemark})` : ''}`,
    );

    this.eventsGateway.emitQueueUpdated({
      type: 'CHECK_IN',
      queueEntry: entry,
      terminalId: checkInTerminalId,
    });

    return this.mapEntry(entry);
  }

  /**
   * Dispatch vehicle (alias to dispatchOut)
   */
  async dispatch(dto: DispatchVehicleDto) {
    return this.dispatchOut(dto);
  }

  async getDispatchRecords(query: QueryParamsDto & { dispatcherId?: string; originTerminalId?: string }) {
    const { page = 1, pageSize = 10, search, sortBy, sortDir } = query;
    const skip = (page - 1) * pageSize;
    const where: any = {};

    if (search) {
      where.OR = [
        { plateNumber: { contains: search, mode: 'insensitive' } },
        { dispatcherName: { contains: search, mode: 'insensitive' } },
        { originTerminalName: { contains: search, mode: 'insensitive' } },
        { paymentReference: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (query.dispatcherId) where.dispatcherId = query.dispatcherId;
    if (query.originTerminalId) where.originTerminalId = query.originTerminalId;

    const orderBy: any = sortBy ? { [sortBy]: sortDir || 'asc' } : { dispatchTime: 'desc' };
    const [data, total] = await Promise.all([
      this.prisma.dispatchRecord.findMany({ where, skip, take: pageSize, orderBy }),
      this.prisma.dispatchRecord.count({ where }),
    ]);

    return {
      data: data.map((r) => ({
        id: r.id, vehicleId: r.vehicleId, plateNumber: r.plateNumber,
        vehicleGroupId: r.vehicleGroupId, vehicleGroupName: r.vehicleGroupName,
        originTerminalId: r.originTerminalId, originTerminalName: r.originTerminalName,
        destinationTerminalId: r.destinationTerminalId, destinationTerminalName: r.destinationTerminalName,
        dispatcherId: r.dispatcherId, dispatcherName: r.dispatcherName,
        dispatchTime: r.dispatchTime.toISOString(),
        entryTime: r.entryTime?.toISOString(),
        dispatchInTime: r.dispatchInTime?.toISOString(),
        dispatchOutTime: r.dispatchOutTime?.toISOString(),
        queuePosition: r.queuePosition,
        feeAmount: r.feeAmount,
        feeRuleId: r.feeRuleId,
        paymentStatus: r.paymentStatus,
        paymentReference: r.paymentReference,
        paymentCollectorName: r.paymentCollectorName,
        paymentConfirmedAt: r.paymentConfirmedAt?.toISOString(),
        tripStatus: r.tripStatus,
        deviceId: r.deviceId || undefined,
        auditRef: r.auditRef,
      })),
      total, page, pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }
}
