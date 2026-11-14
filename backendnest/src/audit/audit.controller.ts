import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { QueryParamsDto } from '../common/dto/query-params.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get()
  @RequirePermissions('audit.view')
  @ApiOperation({ summary: 'List audit logs' })
  list(@Query() query: QueryParamsDto) { return this.service.list(query); }
}
