import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { OverridesService } from './overrides.service';
import { QueryParamsDto } from '../common/dto/query-params.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';

@ApiTags('Supervisor Overrides')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('overrides')
export class OverridesController {
  constructor(private readonly service: OverridesService) {}

  @Get()
  @RequirePermissions('overrides.approve')
  @ApiOperation({ summary: 'List override requests' })
  list(@Query() query: QueryParamsDto) { return this.service.list(query); }

  @Post()
  @ApiOperation({ summary: 'Request an override' })
  @ApiBody({ schema: { properties: { requestedBy: { type: 'string' }, action: { type: 'string' }, reason: { type: 'string' }, assignmentId: { type: 'string' } } } })
  create(@Body() body: { requestedBy: string; action: string; reason: string; assignmentId?: string }) {
    return this.service.create(body.requestedBy, body.action, body.reason, body.assignmentId);
  }

  @Post(':id/approve')
  @RequirePermissions('overrides.approve')
  @ApiOperation({ summary: 'Approve override with supervisor PIN' })
  @ApiBody({ schema: { properties: { pin: { type: 'string' } } } })
  approve(@Param('id') id: string, @Body('pin') pin: string, @CurrentUser('name') name: string) {
    return this.service.approve(id, pin, name);
  }

  @Post(':id/reject')
  @RequirePermissions('overrides.approve')
  @ApiOperation({ summary: 'Reject override' })
  reject(@Param('id') id: string, @CurrentUser('name') name: string) {
    return this.service.reject(id, name);
  }
}
