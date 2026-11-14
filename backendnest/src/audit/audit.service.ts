import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryParamsDto } from '../common/dto/query-params.dto';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QueryParamsDto) {
    const { page = 1, pageSize = 10, search, sortBy, sortDir } = query;
    const skip = (page - 1) * pageSize;
    const where: any = {};
    if (search) {
      where.OR = [
        { actor: { contains: search, mode: 'insensitive' } },
        { action: { contains: search, mode: 'insensitive' } },
        { entity: { contains: search, mode: 'insensitive' } },
        { details: { contains: search, mode: 'insensitive' } },
      ];
    }
    const orderBy: any = sortBy ? { [sortBy]: sortDir || 'asc' } : { timestamp: 'desc' };
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, skip, take: pageSize, orderBy }),
      this.prisma.auditLog.count({ where }),
    ]);
    return {
      data: data.map((a) => ({
        id: a.id, actor: a.actor, action: a.action, entity: a.entity,
        entityId: a.entityId, details: a.details,
        ipAddress: a.ipAddress || undefined, timestamp: a.timestamp.toISOString(),
      })),
      total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async log(actor: string, action: string, entity: string, entityId: string, details: string, ipAddress?: string) {
    return this.prisma.auditLog.create({
      data: { actor, action, entity, entityId, details, ipAddress: ipAddress || null },
    });
  }
}
