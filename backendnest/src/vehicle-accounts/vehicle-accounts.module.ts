import { Module } from '@nestjs/common';
import { VehicleAccountsController } from './vehicle-accounts.controller';
import { VehicleAccountsService } from './vehicle-accounts.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, EventsModule, AuditModule],
  controllers: [VehicleAccountsController],
  providers: [VehicleAccountsService],
  exports: [VehicleAccountsService],
})
export class VehicleAccountsModule {}
