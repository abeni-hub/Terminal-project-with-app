import type { VehicleType, VehicleStatus } from './vehicle';
import type { Violation } from './operations';

export type VehicleAccountStatus = 'ACTIVE' | 'SUSPENDED' | 'BLOCKED' | 'OUTSTANDING_DEBT';

export type TransportCardStatus = 'ACTIVE' | 'BLOCKED' | 'LOST' | 'REPLACED' | 'EXPIRED';

export type VehicleTransactionType =
  | 'TOPUP'
  | 'DISPATCH_FEE'
  | 'PENALTY'
  | 'REFUND'
  | 'ADJUSTMENT'
  | 'CARD_REPLACEMENT_FEE';

export type PaymentMethod = 'CASH' | 'TELEBIRR' | 'CBE_BIRR' | 'BANK_TRANSFER' | 'OTHER';

export type PenaltyRuleType = 'FIXED_AMOUNT' | 'PERCENTAGE_OF_FEE' | 'FEE_MULTIPLIER';

export interface TransportCard {
  id: string;
  cardUid: string;
  cardNumber: string;
  vehicleId: string;
  plateNumber?: string;
  vehicleModel?: string;
  status: TransportCardStatus;
  issuedAt: string;
  expiresAt?: string | null;
  blockedAt?: string | null;
  blockedReason?: string | null;
  createdBy: string;
  createdAt: string;
}

export interface VehicleAccount {
  id: string;
  vehicleId: string;
  plateNumber: string;
  balance: number;
  status: VehicleAccountStatus;
  lastTransactionAt?: string | null;
  createdAt: string;
  updatedAt: string;
  vehicleModel?: string;
  vehicleType?: VehicleType;
  vehicleCapacity?: number;
  groupId?: string;
  groupName?: string;
  driverName?: string;
  driverPhone?: string;
  hasDebt?: boolean;
  outstandingDebt?: number;
  activeCard?: {
    id: string;
    cardUid: string;
    cardNumber: string;
    status: TransportCardStatus;
    issuedAt: string;
  } | null;
}

export interface VehicleAccountTransaction {
  id: string;
  vehicleAccountId: string;
  vehicleId: string;
  plateNumber?: string;
  vehicleModel?: string;
  cardId?: string | null;
  cardUid?: string | null;
  cardNumber?: string | null;
  type: VehicleTransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  paymentMethod?: PaymentMethod | null;
  paymentReference?: string | null;
  dispatchRecordId?: string | null;
  violationId?: string | null;
  description: string;
  performedBy: string;
  createdAt: string;
}

export interface PenaltyConfiguration {
  id: string;
  name: string;
  ruleType: PenaltyRuleType;
  amount: number;
  description?: string;
  active: boolean;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AccountStatsSummary {
  totalAccounts: number;
  activeCardsCount: number;
  debtAccountsCount: number;
  todayTopupsAmount: number;
  todayTopupsCount: number;
  totalTopupsVolume: number;
  todayTransactionsCount: number;
  totalBalance?: number;
}

export interface VehicleAccountDetail {
  account: {
    id: string;
    vehicleId: string;
    plateNumber: string;
    balance: number;
    status: VehicleAccountStatus;
    lastTransactionAt?: string | null;
    createdAt: string;
    updatedAt: string;
  };
  vehicle: {
    id: string;
    plateNumber: string;
    model: string;
    type: VehicleType;
    capacity: number;
    status: VehicleStatus;
    journeyState: string;
    groupId: string;
    groupName?: string;
    driverName?: string;
    driverPhone?: string;
  };
  stats: {
    currentBalance: number;
    totalTopups: number;
    totalDispatchFees: number;
    totalPenalties: number;
    outstandingDebt: number;
    hasDebt: boolean;
  };
  activeCard?: TransportCard | null;
  cards: TransportCard[];
  recentTransactions: VehicleAccountTransaction[];
  violations: Violation[];
}

export interface FastVehicleSearchResult {
  vehicleId: string;
  plateNumber: string;
  model: string;
  type: VehicleType;
  capacity: number;
  groupId: string;
  groupName: string;
  driverName?: string;
  driverPhone?: string;
  accountId?: string | null;
  balance: number;
  accountStatus: VehicleAccountStatus;
  hasDebt: boolean;
  outstandingDebt: number;
  openViolationsCount: number;
  activeCard?: {
    id: string;
    cardUid: string;
    cardNumber: string;
    status: TransportCardStatus;
    issuedAt: string;
  } | null;
}
