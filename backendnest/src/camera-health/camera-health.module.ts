import { Module } from '@nestjs/common';
import { CameraHealthService } from './camera-health.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [PrismaModule, EventsModule],
  providers: [CameraHealthService],
  exports: [CameraHealthService],
})
export class CameraHealthModule {}
