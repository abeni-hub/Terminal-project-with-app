import { Module } from '@nestjs/common';
import { VehicleGroupsService } from './vehicle-groups.service';
import { VehicleGroupsController } from './vehicle-groups.controller';

@Module({
  providers: [VehicleGroupsService],
  controllers: [VehicleGroupsController],
  exports: [VehicleGroupsService],
})
export class VehicleGroupsModule {}
