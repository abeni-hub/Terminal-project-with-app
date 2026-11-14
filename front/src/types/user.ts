export type BuiltInRole = 'SUPER_ADMIN' | 'MUNICIPAL_PLANNER' | 'DISPATCHER';

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'INVITED';

export interface Permission {
  id: string;
  name: string;
  label: string;
  module: string;
  description?: string;
}

export interface CustomRole {
  id: string;
  name: string;
  label: string;
  description?: string;
  isSystem: boolean;
  permissionIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  roleId: string;
  status: UserStatus;
  terminalId?: string;
  terminalName?: string;
  avatarColor?: string;
  lastActiveAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser extends User {
  token: string;
  role: CustomRole;
  permissions: Permission[];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface Session {
  user: User;
  role: CustomRole;
  permissions: Permission[];
  token: string;
  expiresAt: number;
}
