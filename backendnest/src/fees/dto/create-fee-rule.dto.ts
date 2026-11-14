import { IsNotEmpty, IsString, IsOptional, IsNumber, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { VehicleType } from '@prisma/client';

export class CreateFeeRuleDto {
  @ApiProperty({ example: 'Standard Bus Fee' }) @IsString() @IsNotEmpty() name!: string;
  @ApiProperty({ example: 25 }) @IsNumber() @IsNotEmpty() amount!: number;
  @ApiProperty({ example: 'ETB' }) @IsString() @IsOptional() currency?: string;
  @ApiProperty({ example: 'BUS', enum: VehicleType }) @IsEnum(VehicleType) @IsNotEmpty() vehicleType!: VehicleType;
  @ApiProperty({ example: true }) @IsBoolean() @IsOptional() active?: boolean;
}

export class UpdateFeeRuleDto {
  @IsString() @IsOptional() name?: string;
  @IsNumber() @IsOptional() amount?: number;
  @IsString() @IsOptional() currency?: string;
  @IsEnum(VehicleType) @IsOptional() vehicleType?: VehicleType;
  @IsBoolean() @IsOptional() active?: boolean;
}
