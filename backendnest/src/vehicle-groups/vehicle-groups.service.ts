import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleGroupDto, UpdateVehicleGroupDto } from './dto/create-vehicle-group.dto';
import { QueryParamsDto } from '../common/dto/query-params.dto';

@Injectable()
export class VehicleGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  private async mapGroup(g: any) {
    const vehicles = await this.prisma.vehicle.findMany({
      where: { groupId: g.id },
      select: { id: true },
    });
    return {
      id: g.id,
      name: g.name,
      description: g.description || undefined,
      vehicleCount: vehicles.length,
      vehicleIds: vehicles.map((v) => v.id),
    };
  }

  async list(query?: QueryParamsDto) {
    const page = query?.page ?? 1;
    const pageSize = query?.pageSize ?? 100;
    const search = query?.search;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.vehicleGroup.findMany({ where, skip, take: pageSize, orderBy: { name: 'asc' } }),
      this.prisma.vehicleGroup.count({ where }),
    ]);

    const mappedData = await Promise.all(data.map((g) => this.mapGroup(g)));
    return {
      data: mappedData,
      total, page, pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async create(dto: CreateVehicleGroupDto) {
    const g = await this.prisma.vehicleGroup.create({
      data: { id: `g${Date.now()}`, name: dto.name, description: dto.description || null },
    });
    return this.mapGroup(g);
  }

  async update(id: string, dto: UpdateVehicleGroupDto) {
    const group = await this.prisma.vehicleGroup.findUnique({ where: { id } });
    if (!group) throw new HttpException('Vehicle group not found.', HttpStatus.NOT_FOUND);
    const g = await this.prisma.vehicleGroup.update({
      where: { id },
      data: { name: dto.name ?? group.name, description: dto.description !== undefined ? dto.description : group.description },
    });
    return this.mapGroup(g);
  }

  async delete(id: string) {
    const group = await this.prisma.vehicleGroup.findUnique({ where: { id } });
    if (!group) throw new HttpException('Vehicle group not found.', HttpStatus.NOT_FOUND);
    const vehicleCount = await this.prisma.vehicle.count({ where: { groupId: id } });
    if (vehicleCount > 0) throw new HttpException('Cannot delete group with assigned vehicles.', HttpStatus.BAD_REQUEST);
    await this.prisma.vehicleGroup.delete({ where: { id } });
    return { success: true };
  }
}
