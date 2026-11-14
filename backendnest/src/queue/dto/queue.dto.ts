import { IsNotEmpty, IsString, IsOptional, IsBoolean, IsNumber, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';

export class CheckInVehicleDto {
  @ApiProperty({ example: 'v1' }) @IsString() @IsNotEmpty() vehicleId!: string;
  @ApiProperty({ example: 'wa1' }) @IsString() @IsNotEmpty() assignmentId!: string;
  @ApiProperty({ example: 'u3' }) @IsString() @IsNotEmpty() dispatcherId!: string;
  @ApiProperty({ example: false }) @IsBoolean() @IsOptional() isViolation?: boolean;
  @ApiProperty({ example: 'Wrong group override reason' }) @IsString() @IsOptional() violationRemark?: string;
}

export class DispatchInDto {
  @ApiProperty({ example: 'q1' }) @IsString() @IsNotEmpty() queueEntryId!: string;
  @ApiProperty({ example: 'u3' }) @IsString() @IsNotEmpty() dispatcherId!: string;
  @ApiProperty({ example: 'Approved emergency dispatch' }) @IsString() @IsOptional() remark?: string;
}

export class DispatchVehicleDto {
  @ApiProperty({ example: 'q1' }) @IsString() @IsNotEmpty() queueEntryId!: string;
  @ApiProperty({ example: 'u3' }) @IsString() @IsNotEmpty() dispatcherId!: string;
  @ApiProperty({ example: 'DEV-0001' }) @IsString() @IsOptional() deviceId?: string;
  @ApiProperty({ example: 'REC-98213' }) @IsString() @IsOptional() paymentReference?: string;
  @ApiProperty({ example: 25.0 }) @IsNumber() @IsOptional() feeAmount?: number;
  @ApiProperty({ enum: PaymentStatus, example: 'PAID' }) @IsEnum(PaymentStatus) @IsOptional() paymentStatus?: PaymentStatus;
}

export class ConfirmPaymentDto {
  @ApiProperty({ example: 'd1' }) @IsString() @IsOptional() dispatchRecordId?: string;
  @ApiProperty({ example: 'q1' }) @IsString() @IsOptional() queueEntryId?: string;
  @ApiProperty({ example: 'u3' }) @IsString() @IsNotEmpty() dispatcherId!: string;
  @ApiProperty({ example: 'TXN-98421' }) @IsString() @IsNotEmpty() paymentReference!: string;
  @ApiProperty({ enum: PaymentStatus, example: 'PAID' }) @IsEnum(PaymentStatus) @IsOptional() paymentStatus?: PaymentStatus;
}

export class ResolveViolationEntryDto {
  @ApiProperty({ example: 'q1' }) @IsString() @IsNotEmpty() queueEntryId!: string;
  @ApiProperty({ example: 'DISPATCH_IN', enum: ['DISPATCH_IN', 'REJECT'] }) @IsString() @IsNotEmpty() action!: 'DISPATCH_IN' | 'REJECT';
  @ApiProperty({ example: 'Emergency reroute approved by supervisor' }) @IsString() @IsNotEmpty() remark!: string;
  @ApiProperty({ example: 'u3' }) @IsString() @IsNotEmpty() dispatcherId!: string;
}
