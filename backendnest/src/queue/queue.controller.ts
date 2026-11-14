import { Controller, Get, Post, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { QueueService } from './queue.service';
import {
  CheckInVehicleDto,
  DispatchVehicleDto,
  DispatchInDto,
  ConfirmPaymentDto,
  ResolveViolationEntryDto,
} from './dto/queue.dto';
import { QueryParamsDto } from '../common/dto/query-params.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Queue & Dispatch')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('queue')
export class QueueController {
  constructor(private readonly service: QueueService) {}

  @Get()
  @RequirePermissions('queue.view', 'dashboard.view', 'assignments.create')
  @ApiOperation({ summary: 'List queue entries' })
  list(
    @Query() query: QueryParamsDto,
    @Query('terminalId') terminalId?: string,
    @Query('assignmentId') assignmentId?: string,
    @Query('status') status?: string,
    @Query('plateNumber') plateNumber?: string,
    @CurrentUser() user?: any,
  ) {
    return this.service.list({ ...query, terminalId, assignmentId, status, plateNumber }, user);
  }

  @Post('check-in')
  @RequirePermissions('queue.checkin', 'assignments.create')
  @ApiOperation({ summary: 'Check vehicle into queue (Manual fallback)' })
  checkIn(@Body() dto: CheckInVehicleDto) {
    return this.service.checkIn(dto);
  }

  @Post('dispatch-in')
  @RequirePermissions('queue.checkin', 'queue.dispatch', 'assignments.create')
  @ApiOperation({ summary: 'Dispatcher confirms vehicle entry (moves to LOADING)' })
  dispatchIn(@Body() dto: DispatchInDto) {
    return this.service.dispatchIn(dto);
  }

  @Post('dispatch')
  @RequirePermissions('queue.dispatch', 'assignments.create')
  @ApiOperation({ summary: 'Dispatch vehicle out from terminal' })
  dispatch(@Body() dto: DispatchVehicleDto) {
    return this.service.dispatch(dto);
  }

  @Post('dispatch-out')
  @RequirePermissions('queue.dispatch', 'assignments.create')
  @ApiOperation({ summary: 'Dispatch vehicle out from terminal' })
  dispatchOut(@Body() dto: DispatchVehicleDto) {
    return this.service.dispatchOut(dto);
  }

  @Post('confirm-payment')
  @RequirePermissions('queue.dispatch', 'assignments.create')
  @ApiOperation({ summary: 'Confirm fee payment for vehicle dispatch' })
  confirmPayment(@Body() dto: ConfirmPaymentDto) {
    return this.service.confirmPayment(dto);
  }

  @Post('resolve-violation')
  @RequirePermissions('queue.checkin', 'violations.resolve', 'assignments.create')
  @ApiOperation({ summary: 'Resolve violation entry (Dispatch In or Reject)' })
  resolveViolation(@Body() dto: ResolveViolationEntryDto) {
    return this.service.resolveViolationEntry(dto);
  }

  @Get('dispatch-records')
  @RequirePermissions('queue.view', 'dashboard.view', 'reports.view')
  @ApiOperation({ summary: 'List dispatch records' })
  dispatchRecords(
    @Query() query: QueryParamsDto,
    @Query('dispatcherId') dispatcherId?: string,
    @Query('originTerminalId') originTerminalId?: string,
  ) {
    return this.service.getDispatchRecords({ ...query, dispatcherId, originTerminalId });
  }
}
