import {
  LayoutDashboard, Users, Building2, Route as RouteIcon, Bus, CalendarDays,
  ListOrdered, AlertTriangle, ShieldCheck, FileBarChart, ScrollText,
  Smartphone, Settings, Shield, Car, DollarSign, Camera, Scan, History, BarChart3, ShieldAlert,
  CreditCard, WalletCards, Contact2
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: string;
  description?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard.view', description: 'Operational overview' },
  { label: 'Top-Up Station', href: '/topup', icon: CreditCard, permission: 'topup.create', description: 'Fast balance top-up & RFID lookup' },
  { label: 'Vehicle Accounts', href: '/vehicle-accounts', icon: WalletCards, permission: 'vehicle_account.view', description: 'Fleet balances & financial ledger' },
  { label: 'Transport Cards', href: '/transport-cards', icon: Contact2, permission: 'card.view', description: 'RFID card registry & lifecycle' },
  { label: 'Users', href: '/users', icon: Users, permission: 'users.manage', description: 'Manage user accounts' },
  { label: 'Roles & Permissions', href: '/roles', icon: Shield, permission: 'roles.manage', description: 'RBAC management' },
  { label: 'Terminals', href: '/terminals', icon: Building2, permission: 'terminals.manage', description: 'Terminal management' },
  { label: 'Camera Management', href: '/cameras', icon: Camera, permission: 'terminals.manage', description: 'ALPR camera devices' },
  { label: 'Recognition Feed', href: '/recognition/dashboard', icon: Scan, permission: 'queue.view', description: 'Live ALPR stream & alerts' },
  { label: 'Unregistered Vehicles', href: '/recognition/unknown', icon: ShieldAlert, permission: 'queue.view', description: 'Review & assign unknown plates' },
  { label: 'Recognition History', href: '/recognition/history', icon: History, permission: 'queue.view', description: 'ALPR recognition log' },
  { label: 'ALPR Analytics', href: '/recognition/analytics', icon: BarChart3, permission: 'reports.view', description: 'ALPR performance metrics' },
  { label: 'Routes', href: '/routes', icon: RouteIcon, permission: 'routes.manage', description: 'Route configuration' },
  { label: 'Vehicle Groups', href: '/vehicle-groups', icon: Car, permission: 'groups.manage', description: 'Vehicle group management' },
  { label: 'Vehicles', href: '/vehicles', icon: Bus, permission: 'vehicles.manage', description: 'Fleet management' },
  { label: 'Weekly Assignments', href: '/rosters', icon: CalendarDays, permission: 'assignments.create', description: 'Weekly route planning' },
  { label: 'Queue Management', href: '/queue', icon: ListOrdered, permission: 'queue.view', description: 'Live FIFO queue' },
  { label: 'Violations', href: '/violations', icon: AlertTriangle, permission: 'violations.view', description: 'Violation tracking' },
  { label: 'Overrides', href: '/overrides', icon: ShieldCheck, permission: 'overrides.approve', description: 'Supervisor approvals' },
  { label: 'Dispatch Fees', href: '/dispatch-fees', icon: DollarSign, permission: 'fees.manage', description: 'Fee configuration' },
  { label: 'Reports', href: '/reports', icon: FileBarChart, permission: 'reports.view', description: 'Analytics and exports' },
  { label: 'Audit Logs', href: '/audit-logs', icon: ScrollText, permission: 'audit.view', description: 'Activity history' },
  { label: 'Device Management', href: '/devices', icon: Smartphone, permission: 'devices.manage', description: 'Device approvals' },
  { label: 'Settings', href: '/settings', icon: Settings, permission: 'settings.manage', description: 'System settings' },
];

export function getNavItemsForPermissions(permissions: string[]): NavItem[] {
  if (permissions.includes('*') || permissions.includes('admin')) {
    return NAV_ITEMS;
  }
  return NAV_ITEMS.filter((item) => permissions.includes(item.permission));
}

