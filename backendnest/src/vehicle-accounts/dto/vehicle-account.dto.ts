import { IsNotEmpty, IsOptional, IsNumber, IsString, IsEnum, Min, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export enum PaymentMethodDto {
  CASH = 'CASH',
  TELEBIRR = 'TELEBIRR',
  CBE_BIRR = 'CBE_BIRR',
  BANK_TRANSFER = 'BANK_TRANSFER',
  OTHER = 'OTHER',
}

export enum VehicleAccountStatusDto {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  BLOCKED = 'BLOCKED',
  OUTSTANDING_DEBT = 'OUTSTANDING_DEBT',
}

export enum TransportCardStatusDto {
  ACTIVE = 'ACTIVE',
  BLOCKED = 'BLOCKED',
  LOST = 'LOST',
  REPLACED = 'REPLACED',
  EXPIRED = 'EXPIRED',
}

export enum PenaltyRuleTypeDto {
  FIXED_AMOUNT = 'FIXED_AMOUNT',
  PERCENTAGE_OF_FEE = 'PERCENTAGE_OF_FEE',
  FEE_MULTIPLIER = 'FEE_MULTIPLIER',
}

export class TopUpDto {
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsOptional()
  @IsString()
  plateNumber?: string;

  @IsOptional()
  @IsString()
  cardUid?: string;

  @IsOptional()
  @IsString()
  cardNumber?: string;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'Top-up amount must be at least 1 ETB' })
  amount: number;

  @IsNotEmpty()
  @IsEnum(PaymentMethodDto)
  paymentMethod: PaymentMethodDto;

  @IsOptional()
  @IsString()
  paymentReference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class LinkCardDto {
  @IsNotEmpty()
  @IsString()
  vehicleId: string;

  @IsNotEmpty()
  @IsString()
  cardUid: string;

  @IsNotEmpty()
  @IsString()
  cardNumber: string;

  @IsOptional()
  expiresAt?: string;
}

export class BlockCardDto {
  @IsNotEmpty()
  @IsString()
  reason: string;
}

export class ReplaceCardDto {
  @IsNotEmpty()
  @IsString()
  vehicleId: string;

  @IsNotEmpty()
  @IsString()
  oldCardId: string;

  @IsNotEmpty()
  @IsString()
  newCardUid: string;

  @IsNotEmpty()
  @IsString()
  newCardNumber: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsBoolean()
  feeCharged?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  feeAmount?: number;
}

export class AdjustBalanceDto {
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  amount: number; // can be positive or negative

  @IsNotEmpty()
  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class UpdateAccountStatusDto {
  @IsNotEmpty()
  @IsEnum(VehicleAccountStatusDto)
  status: VehicleAccountStatusDto;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdatePenaltyConfigDto {
  @IsNotEmpty()
  @IsEnum(PenaltyRuleTypeDto)
  ruleType: PenaltyRuleTypeDto;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
