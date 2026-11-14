import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';
import { QueryParamsDto } from '../common/dto/query-params.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('User Management')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions('users.manage')
  @ApiOperation({ summary: 'List users with filters & pagination' })
  list(@Query() query: QueryParamsDto, @Query('roleId') roleId?: string, @Query('status') status?: string) {
    return this.usersService.list({ ...query, roleId, status });
  }

  @Post()
  @RequirePermissions('users.manage')
  @ApiOperation({ summary: 'Create user' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Put(':id')
  @RequirePermissions('users.manage')
  @ApiOperation({ summary: 'Update user properties' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('users.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete user' })
  delete(@Param('id') id: string) {
    return this.usersService.delete(id);
  }

  @Post(':id/reset-password')
  @RequirePermissions('users.manage')
  @ApiOperation({ summary: 'Reset user password to default' })
  resetPassword(@Param('id') id: string) {
    return this.usersService.resetPassword(id);
  }
}
