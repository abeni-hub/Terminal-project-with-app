import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { RoutesService } from './routes.service';
import { CreateRouteDto, UpdateRouteDto } from './dto/create-route.dto';
import { QueryParamsDto } from '../common/dto/query-params.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Route Management')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get()
  @RequirePermissions('routes.manage')
  @ApiOperation({ summary: 'List routes with pagination & search' })
  list(@Query() query: QueryParamsDto) { return this.routesService.list(query); }

  @Post()
  @RequirePermissions('routes.manage')
  @ApiOperation({ summary: 'Create route' })
  create(@Body() dto: CreateRouteDto) { return this.routesService.create(dto); }

  @Put(':id')
  @RequirePermissions('routes.manage')
  @ApiOperation({ summary: 'Update route' })
  update(@Param('id') id: string, @Body() dto: UpdateRouteDto) { return this.routesService.update(id, dto); }

  @Delete(':id')
  @RequirePermissions('routes.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete route' })
  delete(@Param('id') id: string) { return this.routesService.delete(id); }
}
