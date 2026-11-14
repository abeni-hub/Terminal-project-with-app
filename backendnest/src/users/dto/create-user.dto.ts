import { IsEmail, IsNotEmpty, IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'Abebe Bekele', description: 'Name of the user' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'abebe@aato.gov.et', description: 'Unique email address' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: '+251911000001', description: 'Optional phone number' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: 'role-super-admin', description: 'ID of the assigned role' })
  @IsString()
  @IsNotEmpty()
  roleId!: string;

  @ApiProperty({ example: 'ACTIVE', enum: UserStatus, description: 'User account status' })
  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus = UserStatus.ACTIVE;

  @ApiProperty({ example: 't1', description: 'Assigned terminal ID (required for dispatchers)' })
  @IsString()
  @IsOptional()
  terminalId?: string;

  @ApiProperty({ example: '#2176ff', description: 'Avatar hex color code' })
  @IsString()
  @IsOptional()
  avatarColor?: string;
}

export class UpdateUserDto {
  @ApiProperty({ example: 'Abebe Bekele' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'abebe@aato.gov.et' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '+251911000001' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: 'role-super-admin' })
  @IsString()
  @IsOptional()
  roleId?: string;

  @ApiProperty({ example: 'ACTIVE', enum: UserStatus })
  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;

  @ApiProperty({ example: 't1' })
  @IsString()
  @IsOptional()
  terminalId?: string;

  @ApiProperty({ example: '#2176ff' })
  @IsString()
  @IsOptional()
  avatarColor?: string;
}
