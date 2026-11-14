import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { VehicleGroupsService } from './vehicle-groups.service';
import { CreateVehicleGroupDto, UpdateVehicleGroupDto } from './dto/create-vehicle-group.dto';
import { QueryParamsDto } from '../common/dto/query-params.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Vehicle Groups')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('vehicle-groups')
export class VehicleGroupsController {
  constructor(private readonly service: VehicleGroupsService) {}

  @Get()
  @RequirePermissions('groups.manage')
  @ApiOperation({ summary: 'List vehicle groups' })
  list(@Query() query: QueryParamsDto) { return this.service.list(query); }

  @Post()
  @RequirePermissions('groups.manage')
  @ApiOperation({ summary: 'Create vehicle group' })
  create(@Body() dto: CreateVehicleGroupDto) { return this.service.create(dto); }

  @Put(':id')
  @RequirePermissions('groups.manage')
  @ApiOperation({ summary: 'Update vehicle group' })
  update(@Param('id') id: string, @Body() dto: UpdateVehicleGroupDto) { return this.service.update(id, dto); }

  @Delete(':id')
  @RequirePermissions('groups.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete vehicle group' })
  delete(@Param('id') id: string) { return this.service.delete(id); }
}
