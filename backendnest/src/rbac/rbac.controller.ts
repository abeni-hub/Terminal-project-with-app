import { Controller, Get, Post, Put, Delete, Body, Param, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/create-role.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('RBAC - Roles & Permissions')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('rbac')
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('roles')
  @RequirePermissions('roles.manage')
  @ApiOperation({ summary: 'Get all roles' })
  getRoles() {
    return this.rbacService.getRoles();
  }

  @Post('roles')
  @RequirePermissions('roles.manage')
  @ApiOperation({ summary: 'Create a new role' })
  createRole(@Body() dto: CreateRoleDto) {
    return this.rbacService.createRole(dto);
  }

  @Put('roles/:id')
  @RequirePermissions('roles.manage')
  @ApiOperation({ summary: 'Update a role' })
  updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rbacService.updateRole(id, dto);
  }

  @Delete('roles/:id')
  @RequirePermissions('roles.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a role' })
  deleteRole(@Param('id') id: string) {
    return this.rbacService.deleteRole(id);
  }

  @Get('permissions')
  @RequirePermissions('roles.manage')
  @ApiOperation({ summary: 'Get all permissions' })
  getPermissions() {
    return this.rbacService.getPermissions();
  }
}
