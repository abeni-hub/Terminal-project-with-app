import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/create-role.dto';

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  async getRoles() {
    return this.prisma.role.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRole(dto: CreateRoleDto) {
    const existing = await this.prisma.role.findFirst({
      where: { name: dto.name },
    });
    if (existing) {
      throw new HttpException('A role with this name already exists.', HttpStatus.CONFLICT);
    }

    return this.prisma.role.create({
      data: {
        id: `role-${Date.now()}`,
        name: dto.name,
        label: dto.label,
        description: dto.description || null,
        isSystem: false,
        permissionIds: dto.permissionIds || [],
      },
    });
  }

  async updateRole(id: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findUnique({
      where: { id },
    });
    if (!role) {
      throw new HttpException('Role not found.', HttpStatus.NOT_FOUND);
    }

    // Business rule: System roles cannot be renamed, but descriptions and permissions can be adjusted
    return this.prisma.role.update({
      where: { id },
      data: {
        label: dto.label ?? role.label,
        description: dto.description !== undefined ? dto.description : role.description,
        permissionIds: dto.permissionIds ?? role.permissionIds,
      },
    });
  }

  async deleteRole(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
    });
    if (!role) {
      throw new HttpException('Role not found.', HttpStatus.NOT_FOUND);
    }
    if (role.isSystem) {
      throw new HttpException('System roles cannot be deleted.', HttpStatus.BAD_REQUEST);
    }

    // In a real application, make sure no users are assigned to this role first
    const usersAssigned = await this.prisma.user.count({
      where: { roleId: id },
    });
    if (usersAssigned > 0) {
      throw new HttpException('Cannot delete role. Users are currently assigned to it.', HttpStatus.BAD_REQUEST);
    }

    await this.prisma.role.delete({
      where: { id },
    });
    return { success: true };
  }

  async getPermissions() {
    return this.prisma.permission.findMany({
      orderBy: { module: 'asc' },
    });
  }
}
