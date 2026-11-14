import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryParamsDto } from '../common/dto/query-params.dto';

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  private mapDevice(d: any) {
    return {
      id: d.id, name: d.name, deviceId: d.deviceId,
      terminalId: d.terminalId || undefined, status: d.status,
      lastSyncAt: d.lastSyncAt?.toISOString() || undefined,
      appVersion: d.appVersion || undefined,
    };
  }

  async list(query: QueryParamsDto) {
    const { page = 1, pageSize = 10, search, sortBy, sortDir } = query;
    const skip = (page - 1) * pageSize;
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { deviceId: { contains: search, mode: 'insensitive' } },
      ];
    }
    const orderBy: any = sortBy ? { [sortBy]: sortDir || 'asc' } : { id: 'asc' };
    const [data, total] = await Promise.all([
      this.prisma.device.findMany({ where, skip, take: pageSize, orderBy }),
      this.prisma.device.count({ where }),
    ]);
    return { data: data.map(this.mapDevice), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async register(name: string, deviceId: string, terminalId?: string, appVersion?: string) {
    const existing = await this.prisma.device.findUnique({ where: { deviceId } });
    if (existing) return this.mapDevice(existing);
    const d = await this.prisma.device.create({
      data: { name, deviceId, terminalId: terminalId || null, status: 'PENDING', appVersion: appVersion || null },
    });
    return this.mapDevice(d);
  }

  async approve(id: string) {
    const device = await this.prisma.device.findUnique({ where: { id } });
    if (!device) throw new HttpException('Device not found.', HttpStatus.NOT_FOUND);
    const d = await this.prisma.device.update({
      where: { id }, data: { status: 'APPROVED', lastSyncAt: new Date() },
    });
    return this.mapDevice(d);
  }

  async reject(id: string) {
    const device = await this.prisma.device.findUnique({ where: { id } });
    if (!device) throw new HttpException('Device not found.', HttpStatus.NOT_FOUND);
    const d = await this.prisma.device.update({ where: { id }, data: { status: 'REJECTED' } });
    return this.mapDevice(d);
  }

  async heartbeat(id: string) {
    const device = await this.prisma.device.findUnique({ where: { id } });
    if (!device) throw new HttpException('Device not found.', HttpStatus.NOT_FOUND);
    const d = await this.prisma.device.update({ where: { id }, data: { lastSyncAt: new Date() } });
    return this.mapDevice(d);
  }

  async sync(deviceId: string, payload: {
    queueEntries?: any[];
    dispatches?: any[];
    violations?: any[];
    overrides?: any[];
  }) {
    const device = await this.prisma.device.findUnique({ where: { deviceId } });
    if (!device) throw new HttpException('Device not registered.', HttpStatus.NOT_FOUND);
    if (device.status !== 'APPROVED') throw new HttpException('Device is not approved.', HttpStatus.FORBIDDEN);

    const results = {
      queueEntries: 0,
      dispatches: 0,
      violations: 0,
      overrides: 0,
    };

    // Ingest Queue Entries
    if (payload.queueEntries && Array.isArray(payload.queueEntries)) {
      for (const entry of payload.queueEntries) {
        try {
          await this.prisma.queueEntry.upsert({
            where: { id: entry.id },
            update: {
              status: entry.status,
              dispatchedAt: entry.dispatchedAt ? new Date(entry.dispatchedAt) : null,
              dispatchedBy: entry.dispatchedBy || null,
              position: entry.position,
            },
            create: {
              id: entry.id,
              vehicleId: entry.vehicleId,
              plateNumber: entry.plateNumber,
              vehicleGroupName: entry.vehicleGroupName,
              assignmentId: entry.assignmentId,
              terminalId: entry.terminalId,
              terminalName: entry.terminalName,
              destinationTerminalName: entry.destinationTerminalName,
              position: entry.position,
              status: entry.status,
              checkedInAt: entry.checkedInAt ? new Date(entry.checkedInAt) : new Date(),
              checkedInBy: entry.checkedInBy,
              dispatchedAt: entry.dispatchedAt ? new Date(entry.dispatchedAt) : null,
              dispatchedBy: entry.dispatchedBy || null,
              isViolation: entry.isViolation ?? false,
              violationRemark: entry.violationRemark || null,
            },
          });
          results.queueEntries++;
        } catch (e) {
          console.error(`Sync error on queue entry ${entry.id}:`, e);
        }
      }
    }

    // Ingest Dispatches
    if (payload.dispatches && Array.isArray(payload.dispatches)) {
      for (const d of payload.dispatches) {
        try {
          const exists = await this.prisma.dispatchRecord.findUnique({ where: { id: d.id } });
          if (!exists) {
            await this.prisma.dispatchRecord.create({
              data: {
                id: d.id,
                vehicleId: d.vehicleId,
                plateNumber: d.plateNumber,
                vehicleGroupId: d.vehicleGroupId,
                vehicleGroupName: d.vehicleGroupName,
                originTerminalId: d.originTerminalId,
                originTerminalName: d.originTerminalName,
                destinationTerminalId: d.destinationTerminalId,
                destinationTerminalName: d.destinationTerminalName,
                dispatcherId: d.dispatcherId,
                dispatcherName: d.dispatcherName,
                dispatchTime: d.dispatchTime ? new Date(d.dispatchTime) : new Date(),
                queuePosition: d.queuePosition,
                feeAmount: d.feeAmount,
                feeRuleId: d.feeRuleId,
                deviceId: deviceId,
                auditRef: d.auditRef || `AUD-${Date.now()}`,
              },
            });
            results.dispatches++;
          }
        } catch (e) {
          console.error(`Sync error on dispatch ${d.id}:`, e);
        }
      }
    }

    // Ingest Violations
    if (payload.violations && Array.isArray(payload.violations)) {
      for (const v of payload.violations) {
        try {
          await this.prisma.violation.upsert({
            where: { id: v.id },
            update: {
              status: v.status,
              resolution: v.resolution || null,
              resolvedAt: v.resolvedAt ? new Date(v.resolvedAt) : null,
            },
            create: {
              id: v.id,
              vehicleId: v.vehicleId,
              plateNumber: v.plateNumber,
              assignmentId: v.assignmentId || null,
              routeId: v.routeId || null,
              terminalId: v.terminalId || null,
              type: v.type,
              description: v.description,
              severity: v.severity || 'MEDIUM',
              status: v.status || 'OPEN',
              reportedBy: v.reportedBy,
              reportedAt: v.reportedAt ? new Date(v.reportedAt) : new Date(),
              resolvedAt: v.resolvedAt ? new Date(v.resolvedAt) : null,
              resolution: v.resolution || null,
            },
          });
          results.violations++;
        } catch (e) {
          console.error(`Sync error on violation ${v.id}:`, e);
        }
      }
    }

    // Ingest Overrides
    if (payload.overrides && Array.isArray(payload.overrides)) {
      for (const o of payload.overrides) {
        try {
          await this.prisma.override.upsert({
            where: { id: o.id },
            update: {
              status: o.status,
              approvedBy: o.approvedBy || null,
              approvedAt: o.approvedAt ? new Date(o.approvedAt) : null,
              auditRef: o.auditRef || null,
            },
            create: {
              id: o.id,
              requestedBy: o.requestedBy,
              action: o.action,
              reason: o.reason,
              assignmentId: o.assignmentId || null,
              status: o.status || 'PENDING',
              approvedBy: o.approvedBy || null,
              approvedAt: o.approvedAt ? new Date(o.approvedAt) : null,
              auditRef: o.auditRef || null,
              createdAt: o.createdAt ? new Date(o.createdAt) : new Date(),
            },
          });
          results.overrides++;
        } catch (e) {
          console.error(`Sync error on override ${o.id}:`, e);
        }
      }
    }

    await this.prisma.device.update({
      where: { id: device.id },
      data: { lastSyncAt: new Date() },
    });

    return { success: true, results };
  }
}
