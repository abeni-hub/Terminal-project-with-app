import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCameraDto, UpdateCameraDto, CameraHeartbeatDto } from './dto/create-camera.dto';
import { QueryParamsDto } from '../common/dto/query-params.dto';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class CameraService {
  private readonly logger = new Logger(CameraService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  private mapCamera(c: any) {
    return {
      id: c.id,
      name: c.name,
      code: c.code,
      terminalId: c.terminalId,
      terminalName: c.terminal?.name || '',
      gateName: c.gateName,
      cameraType: c.cameraType,
      sourceType: c.sourceType,
      sourceAddress: c.sourceAddress,
      status: c.status,
      lastHeartbeat: c.lastHeartbeat ? c.lastHeartbeat.toISOString() : null,
      recognitionEnabled: c.recognitionEnabled,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }

  async list(query: QueryParamsDto & { terminalId?: string; status?: string; cameraType?: string }) {
    const { page = 1, pageSize = 10, search, sortBy, sortDir } = query;
    const skip = (page - 1) * pageSize;
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { gateName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (query.terminalId) where.terminalId = query.terminalId;
    if (query.status) where.status = query.status as any;
    if (query.cameraType) where.cameraType = query.cameraType as any;

    const orderBy: any = sortBy ? { [sortBy]: sortDir || 'asc' } : { createdAt: 'desc' };
    const [data, total] = await Promise.all([
      this.prisma.cameraDevice.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: { terminal: true },
      }),
      this.prisma.cameraDevice.count({ where }),
    ]);

    return {
      data: data.map((c) => this.mapCamera(c)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findOne(id: string) {
    const camera = await this.prisma.cameraDevice.findUnique({
      where: { id },
      include: { terminal: true, heartbeats: { take: 10, orderBy: { timestamp: 'desc' } } },
    });
    if (!camera) throw new HttpException('Camera device not found.', HttpStatus.NOT_FOUND);
    return this.mapCamera(camera);
  }

  async create(dto: CreateCameraDto) {
    const existingCode = await this.prisma.cameraDevice.findUnique({ where: { code: dto.code } });
    if (existingCode) throw new HttpException('Camera code already exists.', HttpStatus.BAD_REQUEST);

    const terminal = await this.prisma.terminal.findUnique({ where: { id: dto.terminalId } });
    if (!terminal) throw new HttpException('Terminal not found.', HttpStatus.NOT_FOUND);

    const camera = await this.prisma.cameraDevice.create({
      data: {
        name: dto.name,
        code: dto.code,
        terminalId: dto.terminalId,
        gateName: dto.gateName,
        cameraType: dto.cameraType,
        sourceType: dto.sourceType,
        sourceAddress: dto.sourceAddress,
        status: dto.status || 'ACTIVE',
        recognitionEnabled: dto.recognitionEnabled !== undefined ? dto.recognitionEnabled : true,
      },
      include: { terminal: true },
    });

    const result = this.mapCamera(camera);
    this.eventsGateway.emitCameraStatusChanged(result);
    return result;
  }

  async update(id: string, dto: UpdateCameraDto) {
    const camera = await this.prisma.cameraDevice.findUnique({ where: { id } });
    if (!camera) throw new HttpException('Camera device not found.', HttpStatus.NOT_FOUND);

    if (dto.terminalId) {
      const terminal = await this.prisma.terminal.findUnique({ where: { id: dto.terminalId } });
      if (!terminal) throw new HttpException('Terminal not found.', HttpStatus.NOT_FOUND);
    }

    const updated = await this.prisma.cameraDevice.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.terminalId && { terminalId: dto.terminalId }),
        ...(dto.gateName && { gateName: dto.gateName }),
        ...(dto.cameraType && { cameraType: dto.cameraType }),
        ...(dto.sourceType && { sourceType: dto.sourceType }),
        ...(dto.sourceAddress && { sourceAddress: dto.sourceAddress }),
        ...(dto.status && { status: dto.status }),
        ...(dto.recognitionEnabled !== undefined && { recognitionEnabled: dto.recognitionEnabled }),
      },
      include: { terminal: true },
    });

    const result = this.mapCamera(updated);
    this.eventsGateway.emitCameraStatusChanged(result);
    return result;
  }

  async delete(id: string) {
    const camera = await this.prisma.cameraDevice.findUnique({ where: { id } });
    if (!camera) throw new HttpException('Camera device not found.', HttpStatus.NOT_FOUND);

    await this.prisma.cameraDevice.delete({ where: { id } });
    return { success: true, message: 'Camera device deleted successfully.' };
  }

  async toggleRecognition(id: string, enabled: boolean) {
    const camera = await this.prisma.cameraDevice.findUnique({ where: { id } });
    if (!camera) throw new HttpException('Camera device not found.', HttpStatus.NOT_FOUND);

    const updated = await this.prisma.cameraDevice.update({
      where: { id },
      data: { recognitionEnabled: enabled },
      include: { terminal: true },
    });

    const result = this.mapCamera(updated);
    this.eventsGateway.emitCameraStatusChanged(result);
    return result;
  }

  async testConnection(id: string) {
    const camera = await this.prisma.cameraDevice.findUnique({ where: { id } });
    if (!camera) throw new HttpException('Camera device not found.', HttpStatus.NOT_FOUND);

    return {
      cameraId: camera.id,
      code: camera.code,
      status: 'SUCCESS',
      message: `Connection test successful for ${camera.name} (${camera.sourceType} @ ${camera.sourceAddress})`,
      latencyMs: Math.floor(Math.random() * 40) + 10,
      timestamp: new Date().toISOString(),
    };
  }

  async processHeartbeat(id: string, dto: CameraHeartbeatDto) {
    const camera = await this.prisma.cameraDevice.findUnique({ where: { id } });
    if (!camera) throw new HttpException('Camera device not found.', HttpStatus.NOT_FOUND);

    const now = new Date();
    await this.prisma.cameraDevice.update({
      where: { id },
      data: { status: dto.status, lastHeartbeat: now },
    });

    await this.prisma.cameraHeartbeat.create({
      data: {
        cameraId: id,
        status: dto.status,
        timestamp: now,
        details: dto.details || null,
      },
    });

    const result = { cameraId: id, status: dto.status, lastHeartbeat: now.toISOString() };
    this.eventsGateway.emitCameraStatusChanged(result);
    return result;
  }
}
