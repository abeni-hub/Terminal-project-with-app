import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { FeesService } from './fees.service';
import { CreateFeeRuleDto, UpdateFeeRuleDto } from './dto/create-fee-rule.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Dispatch Fees')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('fees')
export class FeesController {
  constructor(private readonly service: FeesService) {}

  @Get()
  @RequirePermissions('fees.manage')
  @ApiOperation({ summary: 'List all fee rules' })
  list() { return this.service.list(); }

  @Post()
  @RequirePermissions('fees.manage')
  @ApiOperation({ summary: 'Create fee rule' })
  create(@Body() dto: CreateFeeRuleDto) { return this.service.create(dto); }

  @Put(':id')
  @RequirePermissions('fees.manage')
  @ApiOperation({ summary: 'Update fee rule' })
  update(@Param('id') id: string, @Body() dto: UpdateFeeRuleDto) { return this.service.update(id, dto); }

  @Delete(':id')
  @RequirePermissions('fees.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete fee rule' })
  delete(@Param('id') id: string) { return this.service.delete(id); }
}
