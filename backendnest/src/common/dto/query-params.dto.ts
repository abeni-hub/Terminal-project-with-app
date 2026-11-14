import { IsOptional, IsInt, IsString, IsEnum, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum SortDir {
  ASC = 'asc',
  DESC = 'desc',
}

export class QueryParamsDto {
  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 10;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiProperty({ required: false, enum: SortDir })
  @IsOptional()
  @IsEnum(SortDir)
  sortDir?: SortDir = SortDir.ASC;
}
