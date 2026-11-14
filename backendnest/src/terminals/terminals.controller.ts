import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { TerminalsService } from './terminals.service';
import { CreateTerminalDto, UpdateTerminalDto } from './dto/create-terminal.dto';
import { QueryParamsDto } from '../common/dto/query-params.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Terminal Management')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('terminals')
export class TerminalsController {
  constructor(private readonly terminalsService: TerminalsService) {}

  @Get()
  @RequirePermissions('terminals.manage', 'queue.view', 'assignments.create')
  @ApiOperation({ summary: 'List terminals with pagination & search' })
  list(@Query() query: QueryParamsDto) {
    return this.terminalsService.list(query);
  }

  @Post()
  @RequirePermissions('terminals.manage')
  @ApiOperation({ summary: 'Create terminal' })
  create(@Body() dto: CreateTerminalDto) {
    return this.terminalsService.create(dto);
  }

  @Put(':id')
  @RequirePermissions('terminals.manage')
  @ApiOperation({ summary: 'Update terminal' })
  update(@Param('id') id: string, @Body() dto: UpdateTerminalDto) {
    return this.terminalsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('terminals.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete terminal' })
  delete(@Param('id') id: string) {
    return this.terminalsService.delete(id);
  }
}
