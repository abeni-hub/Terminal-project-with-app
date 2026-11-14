import { Module } from '@nestjs/common';
import { RecognitionController } from './recognition.controller';
import { RecognitionService } from './recognition.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [PrismaModule, EventsModule],
  controllers: [RecognitionController],
  providers: [RecognitionService],
  exports: [RecognitionService],
})
export class RecognitionModule {}
