/**
 * api.ts — single import point for all components.
 *
 * This application now always uses the real NestJS backend API.
 * Components never import from mockApi or realApi directly.
 */
import { realApi } from './realApi';
import type { User, LoginCredentials, Session, CustomRole, Permission } from '@/src/types/user';
import type { Terminal, Route } from '@/src/types/terminal';
import type { Vehicle, VehicleGroup } from '@/src/types/vehicle';
import type { WeeklyRouteAssignment, QueueEntry, DispatchRecord, DispatchFeeRule, Violation, Override, AuditLog, Device } from '@/src/types/operations';
import type { DashboardData, DispatcherDashboardData } from '@/src/types/dashboard';
import type {
  VehicleAccount,
  TransportCard,
  VehicleAccountTransaction,
  PenaltyConfiguration,
  AccountStatsSummary,
  VehicleAccountDetail,
  FastVehicleSearchResult,
} from '@/src/types/vehicle-account';
import type { PaginatedResponse, QueryParams } from './http';
export { ApiError } from './http';

// Always use the real backend API for both web and app.
export const api = realApi as typeof realApi;

export type {
  PaginatedResponse,
  QueryParams,
  User,
  LoginCredentials,
  Session,
  CustomRole,
  Permission,
  Terminal,
  Route,
  Vehicle,
  VehicleGroup,
  WeeklyRouteAssignment,
  QueueEntry,
  DispatchRecord,
  DispatchFeeRule,
  Violation,
  Override,
  AuditLog,
  Device,
  DashboardData,
  DispatcherDashboardData,
  VehicleAccount,
  TransportCard,
  VehicleAccountTransaction,
  PenaltyConfiguration,
  AccountStatsSummary,
  VehicleAccountDetail,
  FastVehicleSearchResult,
};
