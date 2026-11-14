import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ViolationsService } from './violations.service';
import { QueryParamsDto } from '../common/dto/query-params.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';

@ApiTags('Violations')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('violations')
export class ViolationsController {
  constructor(private readonly service: ViolationsService) {}

  @Get()
  @RequirePermissions('violations.view')
  @ApiOperation({ summary: 'List violations' })
  list(@Query() query: QueryParamsDto, @Query('severity') severity?: string, @Query('status') status?: string) {
    return this.service.list({ ...query, severity, status });
  }

  @Post()
  @RequirePermissions('violations.view')
  @ApiOperation({ summary: 'Report a new violation' })
  create(
    @CurrentUser('name') reportedBy: string,
    @Body() dto: {
      vehicleId: string;
      plateNumber: string;
      assignmentId?: string;
      routeId?: string;
      terminalId?: string;
      type: string;
      description: string;
      severity?: string;
    }
  ) {
    return this.service.create(reportedBy, dto);
  }

  @Post(':id/resolve')
  @RequirePermissions('violations.resolve', 'queue.checkin')
  @ApiOperation({ summary: 'Resolve a violation' })
  @ApiBody({ schema: { properties: { resolution: { type: 'string' }, resolutionAction: { type: 'string' }, remark: { type: 'string' } } } })
  resolve(
    @Param('id') id: string,
    @CurrentUser('id') dispatcherId: string,
    @Body() body: any,
  ) {
    const dto = typeof body === 'string' ? { resolution: body, dispatcherId } : { ...body, dispatcherId };
    return this.service.resolve(id, dto);
  }
}
