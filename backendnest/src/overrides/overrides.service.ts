import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryParamsDto } from '../common/dto/query-params.dto';

@Injectable()
export class OverridesService {
  constructor(private readonly prisma: PrismaService) {}

  private mapOverride(o: any) {
    return {
      id: o.id, requestedBy: o.requestedBy, action: o.action, reason: o.reason,
      assignmentId: o.assignmentId || undefined, status: o.status,
      approvedBy: o.approvedBy || undefined, approvedAt: o.approvedAt?.toISOString() || undefined,
      auditRef: o.auditRef || undefined, createdAt: o.createdAt.toISOString(),
    };
  }

  async list(query: QueryParamsDto) {
    const { page = 1, pageSize = 10, search, sortBy, sortDir } = query;
    const skip = (page - 1) * pageSize;
    const where: any = {};
    if (search) {
      where.OR = [
        { requestedBy: { contains: search, mode: 'insensitive' } },
        { action: { contains: search, mode: 'insensitive' } },
        { reason: { contains: search, mode: 'insensitive' } },
      ];
    }
    const orderBy: any = sortBy ? { [sortBy]: sortDir || 'asc' } : { createdAt: 'desc' };
    const [data, total] = await Promise.all([
      this.prisma.override.findMany({ where, skip, take: pageSize, orderBy }),
      this.prisma.override.count({ where }),
    ]);
    return { data: data.map(this.mapOverride), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async approve(id: string, pin: string, approvedBy: string) {
    const supervisorPin = process.env.SUPERVISOR_PIN || '1234';
    if (pin !== supervisorPin) throw new HttpException('Invalid supervisor PIN.', HttpStatus.FORBIDDEN);
    const override = await this.prisma.override.findUnique({ where: { id } });
    if (!override) throw new HttpException('Override not found.', HttpStatus.NOT_FOUND);
    if (override.status !== 'PENDING') throw new HttpException('Override is not pending.', HttpStatus.BAD_REQUEST);
    const auditRef = `AUD-${Date.now()}`;
    const o = await this.prisma.override.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy, approvedAt: new Date(), auditRef },
    });
    await this.prisma.auditLog.create({
      data: { actor: approvedBy, action: 'APPROVE', entity: 'Override', entityId: id, details: `Override approved. Action: ${override.action}` },
    });
    return this.mapOverride(o);
  }

  async reject(id: string, rejectedBy: string) {
    const override = await this.prisma.override.findUnique({ where: { id } });
    if (!override) throw new HttpException('Override not found.', HttpStatus.NOT_FOUND);
    const o = await this.prisma.override.update({ where: { id }, data: { status: 'REJECTED', approvedBy: rejectedBy, approvedAt: new Date() } });
    return this.mapOverride(o);
  }

  async create(requestedBy: string, action: string, reason: string, assignmentId?: string) {
    const o = await this.prisma.override.create({
      data: { requestedBy, action, reason, assignmentId: assignmentId || null, status: 'PENDING' },
    });
    return this.mapOverride(o);
  }
}
