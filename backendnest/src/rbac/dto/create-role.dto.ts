import { IsNotEmpty, IsString, IsOptional, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty({ example: 'MUNICIPAL_PLANNER', description: 'Name of the role (system identifier)' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'Municipal Planner', description: 'User-friendly label' })
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiProperty({ example: 'Plans weekly route schedules', description: 'Description of the role' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: ['perm-dashboard-view'], description: 'List of permission IDs' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissionIds?: string[];
}

export class UpdateRoleDto {
  @ApiProperty({ example: 'Municipal Planner', description: 'User-friendly label' })
  @IsString()
  @IsOptional()
  label?: string;

  @ApiProperty({ example: 'Plans weekly route schedules', description: 'Description of the role' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: ['perm-dashboard-view'], description: 'List of permission IDs' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissionIds?: string[];
}
