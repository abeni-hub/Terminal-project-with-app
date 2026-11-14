import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class CameraHealthService {
  private readonly logger = new Logger(CameraHealthService.name);
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
  ) {
    this.startMonitoring();
  }

  startMonitoring() {
    // Check every 60 seconds
    this.checkInterval = setInterval(() => this.checkCameraUptime(), 60000);
  }

  async checkCameraUptime() {
    try {
      const timeoutThreshold = new Date(Date.now() - 3 * 60 * 1000); // 3 minutes ago
      const staleCameras = await this.prisma.cameraDevice.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            { lastHeartbeat: { lt: timeoutThreshold } },
            { lastHeartbeat: null },
          ],
        },
      });

      for (const camera of staleCameras) {
        await this.prisma.cameraDevice.update({
          where: { id: camera.id },
          data: { status: 'OFFLINE' },
        });

        this.logger.warn(`Camera ${camera.name} (${camera.code}) flagged as OFFLINE due to missed heartbeat`);
        this.eventsGateway.emitCameraStatusChanged({
          cameraId: camera.id,
          status: 'OFFLINE',
          message: 'Camera missed 3 heartbeat pings.',
        });
      }
    } catch (e: any) {
      this.logger.error(`Error checking camera uptime: ${e?.message}`);
    }
  }
}
