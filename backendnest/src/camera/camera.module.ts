import { Module } from '@nestjs/common';
import { CameraController } from './camera.controller';
import { CameraService } from './camera.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [PrismaModule, EventsModule],
  controllers: [CameraController],
  providers: [CameraService],
  exports: [CameraService],
})
export class CameraModule {}
