import { IsNotEmpty, IsString, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { VehicleStatus, VehicleType } from '@prisma/client';

export class CreateVehicleDto {
  @ApiProperty({ example: 'AA-00001' }) @IsString() @IsNotEmpty() plateNumber!: string;
  @ApiProperty({ example: 'Toyota Coaster' }) @IsString() @IsNotEmpty() model!: string;
  @ApiProperty({ example: 'BUS', enum: VehicleType }) @IsEnum(VehicleType) @IsNotEmpty() type!: VehicleType;
  @ApiProperty({ example: 30 }) @IsNumber() @IsNotEmpty() capacity!: number;
  @ApiProperty({ example: 'IDLE', enum: VehicleStatus }) @IsEnum(VehicleStatus) @IsOptional() status?: VehicleStatus;
  @ApiProperty({ example: 'g1' }) @IsString() @IsNotEmpty() groupId!: string;
  @ApiProperty({ example: 'Abebe' }) @IsString() @IsOptional() driverName?: string;
  @ApiProperty({ example: '+251912100001' }) @IsString() @IsOptional() driverPhone?: string;
}

export class UpdateVehicleDto {
  @IsString() @IsOptional() plateNumber?: string;
  @IsString() @IsOptional() model?: string;
  @IsEnum(VehicleType) @IsOptional() type?: VehicleType;
  @IsNumber() @IsOptional() capacity?: number;
  @IsEnum(VehicleStatus) @IsOptional() status?: VehicleStatus;
  @IsString() @IsOptional() groupId?: string;
  @IsString() @IsOptional() driverName?: string;
  @IsString() @IsOptional() driverPhone?: string;
}
