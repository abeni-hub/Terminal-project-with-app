import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTerminalDto, UpdateTerminalDto } from './dto/create-terminal.dto';
import { QueryParamsDto } from '../common/dto/query-params.dto';

@Injectable()
export class TerminalsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QueryParamsDto) {
    const { page = 1, pageSize = 10, search, sortBy, sortDir } = query;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy: any = {};
    if (sortBy) {
      orderBy[sortBy] = sortDir || 'asc';
    } else {
      orderBy.createdAt = 'desc';
    }

    const [data, total] = await Promise.all([
      this.prisma.terminal.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
      }),
      this.prisma.terminal.count({ where }),
    ]);

    // Compute routeIds and activeVehicles dynamically for each terminal
    const mappedData = await Promise.all(
      data.map(async (t) => {
        const routes = await this.prisma.route.findMany({
          where: {
            OR: [
              { originTerminalId: t.id },
              { destinationTerminalId: t.id },
            ],
          },
          select: { id: true },
        });

        const activeVehicles = await this.prisma.queueEntry.count({
          where: {
            terminalId: t.id,
            status: 'WAITING',
          },
        });

        return {
          id: t.id,
          name: t.name,
          code: t.code,
          address: t.address,
          latitude: t.latitude,
          longitude: t.longitude,
          capacity: t.capacity,
          status: t.status,
          routeIds: routes.map((r) => r.id),
          activeVehicles,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        };
      }),
    );

    return {
      data: mappedData,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async create(dto: CreateTerminalDto) {
    const existing = await this.prisma.terminal.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new HttpException('A terminal with this code already exists.', HttpStatus.CONFLICT);
    }

    const t = await this.prisma.terminal.create({
      data: {
        name: dto.name,
        code: dto.code,
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
        capacity: dto.capacity,
        status: dto.status || 'OPERATIONAL',
      },
    });

    return {
      id: t.id,
      name: t.name,
      code: t.code,
      address: t.address,
      latitude: t.latitude,
      longitude: t.longitude,
      capacity: t.capacity,
      status: t.status,
      routeIds: [],
      activeVehicles: 0,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }

  async update(id: string, dto: UpdateTerminalDto) {
    const terminal = await this.prisma.terminal.findUnique({
      where: { id },
    });
    if (!terminal) {
      throw new HttpException('Terminal not found.', HttpStatus.NOT_FOUND);
    }

    if (dto.code && dto.code !== terminal.code) {
      const existing = await this.prisma.terminal.findUnique({
        where: { code: dto.code },
      });
      if (existing) {
        throw new HttpException('A terminal with this code already exists.', HttpStatus.CONFLICT);
      }
    }

    const t = await this.prisma.terminal.update({
      where: { id },
      data: {
        name: dto.name ?? terminal.name,
        code: dto.code ?? terminal.code,
        address: dto.address ?? terminal.address,
        latitude: dto.latitude ?? terminal.latitude,
        longitude: dto.longitude ?? terminal.longitude,
        capacity: dto.capacity ?? terminal.capacity,
        status: dto.status ?? terminal.status,
      },
    });

    // Compute routeIds and activeVehicles
    const routes = await this.prisma.route.findMany({
      where: {
        OR: [{ originTerminalId: t.id }, { destinationTerminalId: t.id }],
      },
      select: { id: true },
    });

    const activeVehicles = await this.prisma.queueEntry.count({
      where: { terminalId: t.id, status: 'WAITING' },
    });

    return {
      id: t.id,
      name: t.name,
      code: t.code,
      address: t.address,
      latitude: t.latitude,
      longitude: t.longitude,
      capacity: t.capacity,
      status: t.status,
      routeIds: routes.map((r) => r.id),
      activeVehicles,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }

  async delete(id: string) {
    const terminal = await this.prisma.terminal.findUnique({
      where: { id },
    });
    if (!terminal) {
      throw new HttpException('Terminal not found.', HttpStatus.NOT_FOUND);
    }

    // In a real application, make sure no active assignments or routes require this terminal
    await this.prisma.terminal.delete({
      where: { id },
    });

    return { success: true };
  }
}
