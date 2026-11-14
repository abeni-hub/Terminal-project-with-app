import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { QueryParamsDto } from '../common/dto/query-params.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Public } from '../common/decorators/public.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';

@ApiTags('Device Management')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly service: DevicesService) {}

  @Get()
  @RequirePermissions('devices.manage')
  @ApiOperation({ summary: 'List devices' })
  list(@Query() query: QueryParamsDto) { return this.service.list(query); }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a device (public)' })
  @ApiBody({ schema: { properties: { name: { type: 'string' }, deviceId: { type: 'string' }, terminalId: { type: 'string' }, appVersion: { type: 'string' } } } })
  register(@Body() body: { name: string; deviceId: string; terminalId?: string; appVersion?: string }) {
    return this.service.register(body.name, body.deviceId, body.terminalId, body.appVersion);
  }

  @Post(':id/approve')
  @RequirePermissions('devices.manage')
  @ApiOperation({ summary: 'Approve a device' })
  approve(@Param('id') id: string) { return this.service.approve(id); }

  @Post(':id/reject')
  @RequirePermissions('devices.manage')
  @ApiOperation({ summary: 'Reject a device' })
  reject(@Param('id') id: string) { return this.service.reject(id); }

  @Post(':id/heartbeat')
  @ApiOperation({ summary: 'Device heartbeat' })
  heartbeat(@Param('id') id: string) { return this.service.heartbeat(id); }

  @Public()
  @Post('sync')
  @ApiOperation({ summary: 'Synchronize device data' })
  @ApiBody({ schema: { properties: { deviceId: { type: 'string' }, queueEntries: { type: 'array', items: { type: 'object' } }, dispatches: { type: 'array', items: { type: 'object' } }, violations: { type: 'array', items: { type: 'object' } }, overrides: { type: 'array', items: { type: 'object' } } } } })
  sync(@Body() body: { deviceId: string; queueEntries?: any[]; dispatches?: any[]; violations?: any[]; overrides?: any[] }) {
    const { deviceId, ...payload } = body;
    return this.service.sync(deviceId, payload);
  }
}
