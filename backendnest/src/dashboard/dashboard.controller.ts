import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get()
  @RequirePermissions('dashboard.view')
  @ApiOperation({ summary: 'Get admin dashboard data' })
  getDashboard() { return this.service.getDashboardData(); }

  @Get('dispatcher')
  @RequirePermissions('dashboard.view')
  @ApiOperation({ summary: 'Get dispatcher dashboard for current user' })
  getDispatcherDashboard(@CurrentUser('id') userId: string) {
    return this.service.getDispatcherDashboard(userId);
  }

  @Get('dispatcher/:userId')
  @RequirePermissions('dashboard.view')
  @ApiOperation({ summary: 'Get dispatcher dashboard for specific user' })
  getDispatcherDashboardById(@Param('userId') userId: string) {
    return this.service.getDispatcherDashboard(userId);
  }
}
