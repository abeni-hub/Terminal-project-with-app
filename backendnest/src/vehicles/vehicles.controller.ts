import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/create-vehicle.dto';
import { QueryParamsDto } from '../common/dto/query-params.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Vehicle Management')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly service: VehiclesService) {}

  @Get()
  @RequirePermissions('vehicles.manage', 'queue.view', 'queue.checkin')
  @ApiOperation({ summary: 'List vehicles with filters & pagination' })
  list(
    @Query() query: QueryParamsDto,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('groupId') groupId?: string,
    @Query('assignmentId') assignmentId?: string,
    @Query('dispatcherId') dispatcherId?: string,
    @CurrentUser() user?: any,
  ) {
    return this.service.list({ ...query, status, type, groupId, assignmentId, dispatcherId }, user);
  }

  @Get(':id/history')
  @RequirePermissions('vehicles.manage', 'queue.view', 'reports.view')
  @ApiOperation({ summary: 'Get 360-degree operational history for a vehicle' })
  getHistory(@Param('id') id: string) { return this.service.getVehicleHistory(id); }

  @Get(':id')
  @RequirePermissions('vehicles.manage', 'queue.view')
  @ApiOperation({ summary: 'Get vehicle by ID' })
  getById(@Param('id') id: string) { return this.service.getById(id); }

  @Post()
  @RequirePermissions('vehicles.manage')
  @ApiOperation({ summary: 'Create vehicle' })
  create(@Body() dto: CreateVehicleDto) { return this.service.create(dto); }

  @Put(':id')
  @RequirePermissions('vehicles.manage')
  @ApiOperation({ summary: 'Update vehicle' })
  update(@Param('id') id: string, @Body() dto: UpdateVehicleDto) { return this.service.update(id, dto); }

  @Delete(':id')
  @RequirePermissions('vehicles.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete vehicle' })
  delete(@Param('id') id: string) { return this.service.delete(id); }
}
