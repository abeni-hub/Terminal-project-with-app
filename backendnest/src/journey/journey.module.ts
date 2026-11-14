import { Module } from '@nestjs/common';
import { JourneyController } from './journey.controller';
import { JourneyService } from './journey.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [PrismaModule, EventsModule],
  controllers: [JourneyController],
  providers: [JourneyService],
  exports: [JourneyService],
})
export class JourneyModule {}
