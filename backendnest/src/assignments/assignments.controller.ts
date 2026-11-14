import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto, UpdateAssignmentDto } from './dto/create-assignment.dto';
import { QueryParamsDto } from '../common/dto/query-params.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Weekly Route Assignments')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly service: AssignmentsService) {}

  @Get()
  @RequirePermissions('assignments.create', 'assignments.publish', 'queue.view')
  @ApiOperation({ summary: 'List weekly assignments' })
  list(
    @Query() query: QueryParamsDto,
    @Query('status') status?: string,
    @Query('weekNumber') weekNumber?: string,
    @Query('terminalId') terminalId?: string,
    @Query('dispatcherId') dispatcherId?: string,
    @CurrentUser() user?: any,
  ) {
    return this.service.list({ ...query, status, weekNumber, terminalId, dispatcherId }, user);
  }

  @Get('preview')
  @RequirePermissions('assignments.create')
  @ApiOperation({ summary: 'Generate auto-schedule preview for a given week' })
  generatePreview(@Query('weekNumber') weekNumber: string) {
    return this.service.generatePreview(Number(weekNumber));
  }

  @Post()
  @RequirePermissions('assignments.create')
  @ApiOperation({ summary: 'Create weekly assignment' })
  create(@Body() dto: CreateAssignmentDto) { return this.service.create(dto); }

  @Post('bulk')
  @RequirePermissions('assignments.create')
  @ApiOperation({ summary: 'Bulk save auto-generated assignments to database as DRAFT' })
  bulkSave(@Body() dto: { assignments: CreateAssignmentDto[] }) {
    return this.service.bulkSave(dto.assignments);
  }

  @Put(':id')
  @RequirePermissions('assignments.create')
  @ApiOperation({ summary: 'Update assignment' })
  update(@Param('id') id: string, @Body() dto: UpdateAssignmentDto) { return this.service.update(id, dto); }

  @Post(':id/review')
  @RequirePermissions('assignments.create')
  @ApiOperation({ summary: 'Mark a draft assignment as reviewed' })
  review(@Param('id') id: string) { return this.service.review(id); }

  @Post(':id/publish')
  @RequirePermissions('assignments.publish')
  @ApiOperation({ summary: 'Publish a reviewed or draft assignment' })
  publish(@Param('id') id: string) { return this.service.publish(id); }

  @Post(':id/lock')
  @RequirePermissions('assignments.publish')
  @ApiOperation({ summary: 'Lock a published assignment to prevent edits' })
  lock(@Param('id') id: string) { return this.service.lock(id); }

  @Post(':id/archive')
  @RequirePermissions('assignments.create')
  @ApiOperation({ summary: 'Archive an assignment' })
  archive(@Param('id') id: string) { return this.service.archive(id); }

  @Delete(':id')
  @RequirePermissions('assignments.create')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete draft assignment' })
  delete(@Param('id') id: string) { return this.service.delete(id); }
}
