import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';
import { QueryParamsDto } from '../common/dto/query-params.dto';
import { hashPassword } from '../common/utils/password.util';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QueryParamsDto & { roleId?: string; status?: string; terminalId?: string }) {
    const { page = 1, pageSize = 10, search, sortBy, sortDir } = query;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (query.roleId) {
      where.roleId = query.roleId;
    }

    if (query.status) {
      where.status = query.status as any;
    }

    if (query.terminalId && query.terminalId !== 'all') {
      where.terminalId = query.terminalId;
    }

    const orderBy: any = {};
    if (sortBy) {
      orderBy[sortBy] = sortDir || 'asc';
    } else {
      orderBy.createdAt = 'desc';
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: { role: true, terminal: true },
      }),
      this.prisma.user.count({ where }),
    ]);

    // Map user entities to match expected client properties
    const mappedData = data.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone || undefined,
      roleId: u.roleId,
      role: u.role ? { id: u.role.id, name: u.role.name, label: u.role.label } : undefined,
      status: u.status,
      terminalId: u.terminalId || undefined,
      terminalName: u.terminal?.name || undefined,
      avatarColor: u.avatarColor || undefined,
      lastActiveAt: u.lastActiveAt?.toISOString() || undefined,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    }));

    return {
      data: mappedData,
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new HttpException('A user with this email already exists.', HttpStatus.CONFLICT);
    }

    // Enforce: A dispatcher must be assigned to exactly one terminal
    const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
    const isDispatcherRole = role?.name === 'DISPATCHER' || dto.roleId === 'role-dispatcher';

    if (isDispatcherRole) {
      if (!dto.terminalId || !dto.terminalId.trim()) {
        throw new HttpException('A dispatcher must be assigned to exactly one terminal.', HttpStatus.BAD_REQUEST);
      }
      const terminal = await this.prisma.terminal.findUnique({ where: { id: dto.terminalId } });
      if (!terminal) {
        throw new HttpException('Assigned terminal does not exist.', HttpStatus.BAD_REQUEST);
      }
    }

    const defaultHash = await hashPassword('password123');

    const user = await this.prisma.user.create({
      data: {
        id: `u${Date.now()}`,
        name: dto.name,
        email: dto.email,
        phone: dto.phone || null,
        passwordHash: defaultHash,
        roleId: dto.roleId,
        status: dto.status || 'ACTIVE',
        terminalId: dto.terminalId || null,
        avatarColor: dto.avatarColor || '#3B82F6',
      },
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || undefined,
      roleId: user.roleId,
      status: user.status,
      terminalId: user.terminalId || undefined,
      avatarColor: user.avatarColor || undefined,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!user) {
      throw new HttpException('User not found.', HttpStatus.NOT_FOUND);
    }

    if (dto.email && dto.email !== user.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existing) {
        throw new HttpException('A user with this email already exists.', HttpStatus.CONFLICT);
      }
    }

    const targetRoleId = dto.roleId ?? user.roleId;
    const role = await this.prisma.role.findUnique({ where: { id: targetRoleId } });
    const isDispatcherRole = role?.name === 'DISPATCHER' || targetRoleId === 'role-dispatcher';

    const targetTerminalId = dto.terminalId !== undefined ? dto.terminalId : user.terminalId;

    if (isDispatcherRole) {
      if (!targetTerminalId || !targetTerminalId.trim()) {
        throw new HttpException('A dispatcher must be assigned to exactly one terminal.', HttpStatus.BAD_REQUEST);
      }
      const terminal = await this.prisma.terminal.findUnique({ where: { id: targetTerminalId } });
      if (!terminal) {
        throw new HttpException('Assigned terminal does not exist.', HttpStatus.BAD_REQUEST);
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name ?? user.name,
        email: dto.email ?? user.email,
        phone: dto.phone !== undefined ? dto.phone : user.phone,
        roleId: targetRoleId,
        status: dto.status ?? user.status,
        terminalId: targetTerminalId,
        avatarColor: dto.avatarColor ?? user.avatarColor,
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone || undefined,
      roleId: updated.roleId,
      status: updated.status,
      terminalId: updated.terminalId || undefined,
      avatarColor: updated.avatarColor || undefined,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async delete(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new HttpException('User not found.', HttpStatus.NOT_FOUND);
    }

    await this.prisma.user.delete({
      where: { id },
    });

    return { success: true };
  }

  async resetPassword(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new HttpException('User not found.', HttpStatus.NOT_FOUND);
    }

    const defaultHash = await hashPassword('password123');

    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: defaultHash },
    });

    return { success: true };
  }
}
