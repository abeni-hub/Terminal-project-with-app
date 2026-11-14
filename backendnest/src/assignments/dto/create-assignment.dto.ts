import { IsNotEmpty, IsString, IsOptional, IsNumber, IsArray, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAssignmentDto {
  @ApiProperty({ example: 'Week 31 - Group A - Mercato to Bole' }) @IsString() @IsNotEmpty() name!: string;
  @ApiProperty({ example: 31 }) @IsNumber() @IsNotEmpty() weekNumber!: number;
  @ApiProperty({ example: '2026-07-27' }) @IsDateString() @IsNotEmpty() weekStart!: string;
  @ApiProperty({ example: '2026-08-02' }) @IsDateString() @IsNotEmpty() weekEnd!: string;
  @ApiProperty({ example: 'g1' }) @IsString() @IsNotEmpty() vehicleGroupId!: string;
  @ApiProperty({ example: 't2' }) @IsString() @IsNotEmpty() originTerminalId!: string;
  @ApiProperty({ example: 't3' }) @IsString() @IsNotEmpty() destinationTerminalId!: string;
  @ApiProperty({ example: ['u3'] }) @IsArray() @IsString({ each: true }) dispatcherIds!: string[];
}

export class UpdateAssignmentDto {
  @IsString() @IsOptional() name?: string;
  @IsArray() @IsString({ each: true }) @IsOptional() dispatcherIds?: string[];
  @IsString() @IsOptional() destinationTerminalId?: string;
}
