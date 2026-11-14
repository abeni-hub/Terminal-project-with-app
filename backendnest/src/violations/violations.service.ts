import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryParamsDto } from '../common/dto/query-params.dto';

@Injectable()
export class ViolationsService {
  constructor(private readonly prisma: PrismaService) {}

  private mapViolation(v: any) {
    return {
      id: v.id,
      vehicleId: v.vehicleId,
      plateNumber: v.plateNumber,
      assignmentId: v.assignmentId || undefined,
      routeId: v.routeId || undefined,
      terminalId: v.terminalId || undefined,
      assignedTerminalId: v.assignedTerminalId || undefined,
      assignedRouteId: v.assignedRouteId || undefined,
      entryRecognitionEventId: v.entryRecognitionEventId || undefined,
      imagePath: v.imagePath || undefined,
      type: v.type,
      description: v.description,
      severity: v.severity,
      status: v.status,
      reportedBy: v.reportedBy,
      reportedAt: v.reportedAt.toISOString(),
      resolvedAt: v.resolvedAt?.toISOString() || undefined,
      resolution: v.resolution || undefined,
      resolutionAction: v.resolutionAction || undefined,
      dispatcherId: v.dispatcherId || undefined,
      remark: v.remark || undefined,
      queueEntryId: v.queueEntryId || undefined,
      originalDispatchFee: v.originalDispatchFee || 0,
      penaltyAmount: v.penaltyAmount || 0,
      totalAmountDue: v.totalAmountDue || 0,
      evidence: v.evidence || undefined,
    };
  }

  async list(query: QueryParamsDto & { severity?: string; status?: string; terminalId?: string; type?: string; vehicleId?: string }) {
    const { page = 1, pageSize = 10, search, sortBy, sortDir } = query;
    const skip = (page - 1) * pageSize;
    const where: any = {};
    if (search) {
      where.OR = [
        { plateNumber: { contains: search, mode: 'insensitive' } },
        { type: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (query.severity) where.severity = query.severity as any;
    if (query.status && query.status !== 'ALL') where.status = query.status as any;
    if (query.terminalId && query.terminalId !== 'all') where.terminalId = query.terminalId;
    if (query.type && query.type !== 'ALL') where.type = query.type;
    if (query.vehicleId && query.vehicleId !== 'all') where.vehicleId = query.vehicleId;

    const orderBy: any = sortBy ? { [sortBy]: sortDir || 'asc' } : { reportedAt: 'desc' };
    const [data, total] = await Promise.all([
      this.prisma.violation.findMany({ where, skip, take: pageSize, orderBy }),
      this.prisma.violation.count({ where }),
    ]);
    return { data: data.map(this.mapViolation), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async resolve(
    id: string,
    dto: {
      resolution?: string;
      resolutionAction?: string;
      remark?: string;
      dispatcherId?: string;
      status?: 'RESOLVED' | 'WAIVED' | 'PAID' | 'DISMISSED';
    },
  ) {
    const violation = await this.prisma.violation.findUnique({ where: { id } });
    if (!violation) throw new HttpException('Violation not found.', HttpStatus.NOT_FOUND);

    const targetStatus = dto.status || (dto.resolutionAction === 'WAIVE' ? 'WAIVED' : 'RESOLVED');
    const now = new Date();

    // If penalty was waived and penalty was deducted from account, credit the vehicle account back!
    if (targetStatus === 'WAIVED' && violation.penaltyAmount && violation.penaltyAmount > 0) {
      const account = await this.prisma.vehicleAccount.findUnique({ where: { vehicleId: violation.vehicleId } });
      if (account) {
        const balanceBefore = account.balance;
        const balanceAfter = Number((balanceBefore + violation.penaltyAmount).toFixed(2));
        const newAccountStatus = balanceAfter >= 0 && account.status === 'OUTSTANDING_DEBT' ? 'ACTIVE' : account.status;

        await this.prisma.$transaction([
          this.prisma.vehicleAccount.update({
            where: { id: account.id },
            data: {
              balance: balanceAfter,
              status: newAccountStatus,
              lastTransactionAt: now,
            },
          }),
          this.prisma.vehicleAccountTransaction.create({
            data: {
              vehicleAccountId: account.id,
              vehicleId: violation.vehicleId,
              type: 'REFUND',
              amount: violation.penaltyAmount,
              balanceBefore,
              balanceAfter,
              violationId: violation.id,
              description: `Penalty waived by supervisor: ${dto.remark || dto.resolution || 'Penalty waived'}`,
              performedBy: dto.dispatcherId || 'Supervisor',
              createdAt: now,
            },
          }),
        ]);
      }
    }

    const v = await this.prisma.violation.update({
      where: { id },
      data: {
        status: targetStatus as any,
        resolution: dto.resolution || dto.remark || `Resolved with action ${targetStatus}`,
        resolutionAction: dto.resolutionAction || targetStatus,
        remark: dto.remark,
        dispatcherId: dto.dispatcherId,
        resolvedAt: now,
      },
    });
    return this.mapViolation(v);
  }

  async create(reportedBy: string, dto: {
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
    severity?: string;
    originalDispatchFee?: number;
    penaltyAmount?: number;
    totalAmountDue?: number;
    evidence?: string;
  }) {
    const v = await this.prisma.violation.create({
      data: {
        vehicleId: dto.vehicleId,
        plateNumber: dto.plateNumber,
        assignmentId: dto.assignmentId || null,
        routeId: dto.routeId || null,
        terminalId: dto.terminalId || null,
        assignedTerminalId: dto.assignedTerminalId || null,
        assignedRouteId: dto.assignedRouteId || null,
        entryRecognitionEventId: dto.entryRecognitionEventId || null,
        imagePath: dto.imagePath || null,
        type: dto.type,
        description: dto.description,
        severity: (dto.severity || 'MEDIUM') as any,
        status: 'OPEN',
        reportedBy,
        originalDispatchFee: dto.originalDispatchFee || 0,
        penaltyAmount: dto.penaltyAmount || 0,
        totalAmountDue: dto.totalAmountDue || 0,
        evidence: dto.evidence || null,
      },
    });
    return this.mapViolation(v);
  }
}
