import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRouteDto, UpdateRouteDto } from './dto/create-route.dto';
import { QueryParamsDto } from '../common/dto/query-params.dto';

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService) {}

  private mapRoute(r: any) {
    return {
      id: r.id,
      name: r.name,
      code: r.code,
      originTerminalId: r.originTerminalId,
      destinationTerminalId: r.destinationTerminalId,
      distanceKm: r.distanceKm,
      estimatedMinutes: r.estimatedMinutes,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  async list(query: QueryParamsDto) {
    const { page = 1, pageSize = 10, search, sortBy, sortDir } = query;
    const skip = (page - 1) * pageSize;
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }
    const orderBy: any = sortBy ? { [sortBy]: sortDir || 'asc' } : { createdAt: 'desc' };
    const [data, total] = await Promise.all([
      this.prisma.route.findMany({ where, skip, take: pageSize, orderBy }),
      this.prisma.route.count({ where }),
    ]);
    return {
      data: data.map(this.mapRoute),
      total, page, pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async create(dto: CreateRouteDto) {
    const existing = await this.prisma.route.findUnique({ where: { code: dto.code } });
    if (existing) throw new HttpException('A route with this code already exists.', HttpStatus.CONFLICT);
    const r = await this.prisma.route.create({ data: { ...dto } });
    return this.mapRoute(r);
  }

  async update(id: string, dto: UpdateRouteDto) {
    const route = await this.prisma.route.findUnique({ where: { id } });
    if (!route) throw new HttpException('Route not found.', HttpStatus.NOT_FOUND);
    const r = await this.prisma.route.update({ where: { id }, data: { ...dto } });
    return this.mapRoute(r);
  }

  async delete(id: string) {
    const route = await this.prisma.route.findUnique({ where: { id } });
    if (!route) throw new HttpException('Route not found.', HttpStatus.NOT_FOUND);
    await this.prisma.route.delete({ where: { id } });
    return { success: true };
  }
}
