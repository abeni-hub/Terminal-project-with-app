import {
  LayoutDashboard, Users, Building2, Route as RouteIcon, Bus, CalendarDays,
  ListOrdered, AlertTriangle, ShieldCheck, FileBarChart, ScrollText,
  Smartphone, Settings, Shield, Car, DollarSign, Camera, Scan, History, BarChart3, ShieldAlert,
  CreditCard, WalletCards, Contact2, Send, Activity, QrCode
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
  description?: string;
  badge?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/**
 * Master flat list of all navigation items for Breadcrumbs, CommandPalette, and direct lookups.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard.view', description: 'Operational overview' },
  { label: 'Vehicles', href: '/vehicles', icon: Bus, permission: 'vehicles.manage', description: 'Fleet records & management' },
  { label: 'Vehicle Groups', href: '/vehicle-groups', icon: Car, permission: 'groups.manage', description: 'Vehicle group management' },
  { label: 'Vehicle Accounts', href: '/vehicle-accounts', icon: WalletCards, permission: 'vehicle_account.view', description: 'Fleet balances & financial ledger' },
  { label: 'Terminals', href: '/terminals', icon: Building2, permission: 'terminals.manage', description: 'Terminal management' },
  { label: 'Routes', href: '/routes', icon: RouteIcon, permission: 'routes.manage', description: 'Route configuration' },
  { label: 'Quarterly Assignments', href: '/rosters', icon: CalendarDays, permission: 'assignments.create', description: '3-Month periodic route planning' },
  { label: 'Weekly Assignments', href: '/rosters', icon: CalendarDays, permission: 'assignments.create', description: 'Periodic route planning' },
  { label: 'Published Assignments', href: '/rosters', icon: CalendarDays, permission: 'queue.view', badge: 'Approved', description: 'View approved 3-month published assignments' },
  { label: 'Recognition Feed', href: '/recognition/dashboard', icon: Scan, permission: 'queue.view', description: 'Live ALPR stream & alerts' },
  { label: 'QR Pass & Gate Scanner', href: '/recognition/qr-gate', icon: QrCode, permission: 'queue.view', description: 'QR pass scanner, plate reconciliation & gate control' },
  { label: 'Recognition History', href: '/recognition/history', icon: History, permission: 'queue.view', description: 'ALPR recognition log' },
  { label: 'Unregistered Vehicles', href: '/recognition/unknown', icon: ShieldAlert, permission: 'queue.view', description: 'Review & assign unknown plates' },
  { label: 'Camera Management', href: '/cameras', icon: Camera, permission: 'terminals.manage', description: 'ALPR camera devices' },
  { label: 'Camera Status', href: '/cameras', icon: Camera, permission: 'dashboard.view', description: 'Camera status (view-only)' },
  { label: 'Top-Up Station', href: '/topup', icon: CreditCard, permission: 'topup.create', description: 'Fast balance top-up & RFID lookup' },
  { label: 'Transport Cards', href: '/transport-cards', icon: Contact2, permission: 'card.view', description: 'RFID card registry & lifecycle' },
  { label: 'Revenue & Reconciliation', href: '/dispatch-fees', icon: DollarSign, permission: 'fees.manage', description: 'Revenue tracking & fee reconciliation' },
  { label: 'Revenue', href: '/dispatch-fees', icon: DollarSign, permission: 'fees.manage', description: 'Revenue & fee reconciliation' },
  { label: 'Dispatch Revenue & Fees', href: '/dispatch-fees', icon: DollarSign, permission: 'queue.view', description: 'Fee status & tariffs' },
  { label: 'Queue Management', href: '/queue', icon: ListOrdered, permission: 'queue.view', description: 'Live FIFO terminal queue' },
  { label: 'Vehicle Dispatch', href: '/queue', icon: Send, permission: 'queue.dispatch', description: 'Vehicle clearance & departure confirmation' },
  { label: 'Violations & Incidents', href: '/violations', icon: AlertTriangle, permission: 'violations.view', description: 'Violation tracking & registration' },
  { label: 'Supervisor Overrides', href: '/overrides', icon: ShieldCheck, permission: 'overrides.approve', description: 'Supervisor approvals' },
  { label: 'ALPR Analytics', href: '/recognition/analytics', icon: BarChart3, permission: 'reports.view', description: 'ALPR accuracy metrics' },
  { label: 'Reports', href: '/reports', icon: FileBarChart, permission: 'reports.view', description: 'Operational & planning reports' },
  { label: 'Users', href: '/users', icon: Users, permission: 'users.manage', description: 'Manage user accounts' },
  { label: 'Roles & Permissions', href: '/roles', icon: Shield, permission: 'roles.manage', description: 'RBAC management' },
  { label: 'System Settings & Integrations', href: '/settings', icon: Settings, permission: 'settings.manage', description: 'System configuration & external integrations' },
  { label: 'System Settings', href: '/settings', icon: Settings, permission: 'settings.manage', description: 'System configuration' },
  { label: 'Audit Logs', href: '/audit-logs', icon: ScrollText, permission: 'audit.view', description: 'System audit log & security history' },
  { label: 'User Activity History', href: '/audit-logs', icon: Activity, permission: 'audit.view', description: 'User login & operator action logs' },
  { label: 'Device Management', href: '/devices', icon: Smartphone, permission: 'devices.manage', description: 'Handheld & gate devices' },
];

/**
 * Super Administrator Menu Sections
 * Full system-wide administration, oversight, configuration and control.
 */
export const SUPER_ADMIN_SECTIONS: NavSection[] = [
  {
    title: 'Dashboard',
    items: [
      { label: 'System Overview', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard.view', description: 'System-wide overview' },
    ],
  },
  {
    title: 'Vehicle Management',
    items: [
      { label: 'Vehicles', href: '/vehicles', icon: Bus, permission: 'vehicles.manage', description: 'Fleet registry & records' },
      { label: 'Vehicle Groups', href: '/vehicle-groups', icon: Car, permission: 'groups.manage', description: 'Vehicle group management' },
      { label: 'Vehicle Accounts', href: '/vehicle-accounts', icon: WalletCards, permission: 'vehicle_account.view', description: 'Fleet balances & financial ledger' },
    ],
  },
  {
    title: 'Terminal & Route Management',
    items: [
      { label: 'Terminals', href: '/terminals', icon: Building2, permission: 'terminals.manage', description: 'Terminal management' },
      { label: 'Routes', href: '/routes', icon: RouteIcon, permission: 'routes.manage', description: 'Route configuration' },
      { label: 'Quarterly Assignments (3 Months)', href: '/rosters', icon: CalendarDays, permission: 'assignments.create', description: '3-Month periodic route planning' },
    ],
  },
  {
    title: 'Recognition & Monitoring',
    items: [
      { label: 'Recognition Feed', href: '/recognition/dashboard', icon: Scan, permission: 'queue.view', description: 'Live ALPR stream & alerts' },
      { label: 'QR Pass & Gate Scanner', href: '/recognition/qr-gate', icon: QrCode, permission: 'queue.view', description: 'QR pass scanner, plate reconciliation & gate control' },
      { label: 'Recognition History', href: '/recognition/history', icon: History, permission: 'queue.view', description: 'ALPR recognition log' },
      { label: 'Unregistered Vehicles', href: '/recognition/unknown', icon: ShieldAlert, permission: 'queue.view', description: 'Review & assign unknown plates' },
      { label: 'Camera Management', href: '/cameras', icon: Camera, permission: 'terminals.manage', description: 'ALPR camera devices' },
    ],
  },
  {
    title: 'Financial Management',
    items: [
      { label: 'Top-Up Station', href: '/topup', icon: CreditCard, permission: 'topup.create', description: 'Balance top-up & RFID lookup' },
      { label: 'Transport Cards', href: '/transport-cards', icon: Contact2, permission: 'card.view', description: 'RFID card registry' },
      { label: 'Revenue & Reconciliation', href: '/dispatch-fees', icon: DollarSign, permission: 'fees.manage', description: 'Revenue summary & fee reconciliation' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Queue Management', href: '/queue', icon: ListOrdered, permission: 'queue.view', description: 'Live FIFO terminal queue' },
      { label: 'Violations & Incidents', href: '/violations', icon: AlertTriangle, permission: 'violations.view', description: 'Violation tracking' },
      { label: 'Supervisor Overrides', href: '/overrides', icon: ShieldCheck, permission: 'overrides.approve', description: 'Supervisor approvals' },
    ],
  },
  {
    title: 'Analytics & Reports',
    items: [
      { label: 'ALPR Analytics', href: '/recognition/analytics', icon: BarChart3, permission: 'reports.view', description: 'ALPR metrics & accuracy' },
      { label: 'Operational Reports', href: '/reports', icon: FileBarChart, permission: 'reports.view', description: 'Analytics, exports & logs' },
    ],
  },
  {
    title: 'System Administration',
    items: [
      { label: 'Users', href: '/users', icon: Users, permission: 'users.manage', description: 'Manage user accounts' },
      { label: 'Roles & Permissions', href: '/roles', icon: Shield, permission: 'roles.manage', description: 'RBAC management' },
      { label: 'System Settings & Integrations', href: '/settings', icon: Settings, permission: 'settings.manage', description: 'System configuration & external integrations' },
      { label: 'Audit Logs', href: '/audit-logs', icon: ScrollText, permission: 'audit.view', description: 'Security audit trail & compliance' },
      { label: 'User Activity History', href: '/audit-logs', icon: Activity, permission: 'audit.view', description: 'User login & operator action logs' },
      { label: 'Device Management', href: '/devices', icon: Smartphone, permission: 'devices.manage', description: 'Device management' },
    ],
  },
];

/**
 * Municipal Planner Menu Sections
 * Prepare and manage vehicle, group, route and terminal plans.
 */
export const PLANNER_SECTIONS: NavSection[] = [
  {
    title: 'Dashboard',
    items: [
      { label: 'Planning Overview', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard.view', description: 'Planning & allocation overview' },
    ],
  },
  {
    title: 'Vehicle Management',
    items: [
      { label: 'Vehicles', href: '/vehicles', icon: Bus, permission: 'vehicles.manage', description: 'Register & maintain planning records' },
      { label: 'Vehicle Groups', href: '/vehicle-groups', icon: Car, permission: 'groups.manage', description: 'Create & manage groups' },
      { label: 'Vehicle Accounts', href: '/vehicle-accounts', icon: WalletCards, permission: 'vehicle_account.view', description: 'View-only operational details' },
    ],
  },
  {
    title: 'Planning',
    items: [
      { label: 'Terminals', href: '/terminals', icon: Building2, permission: 'terminals.manage', description: 'Manage planning allocations' },
      { label: 'Routes', href: '/routes', icon: RouteIcon, permission: 'routes.manage', description: 'Create & manage routes' },
      { label: 'Quarterly Assignments (3 Months)', href: '/rosters', icon: CalendarDays, permission: 'assignments.create', description: 'Prepare, review & publish 3-month assignments' },
    ],
  },
  {
    title: 'Monitoring & Review',
    items: [
      { label: 'Camera Status', href: '/cameras', icon: Camera, permission: 'dashboard.view', description: 'Camera status (view-only)' },
      { label: 'Recognition Analytics', href: '/recognition/analytics', icon: BarChart3, permission: 'reports.view', description: 'Planning ALPR analytics' },
      { label: 'Violations Review', href: '/violations', icon: AlertTriangle, permission: 'violations.view', description: 'Review route-related trends & cases' },
    ],
  },
  {
    title: 'Planning Reports',
    items: [
      { label: 'Planning Reports', href: '/reports', icon: FileBarChart, permission: 'reports.view', description: 'Route, vehicle & assignment reports' },
    ],
  },
];

/**
 * Dispatcher Menu Sections
 * Execute published assignments, manage terminal queues and dispatch activities.
 */
export const DISPATCHER_SECTIONS: NavSection[] = [
  {
    title: 'Dashboard',
    items: [
      { label: 'Dispatcher Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard.view', description: 'Terminal assignments & live queue' },
    ],
  },
  {
    title: 'Daily Operations',
    items: [
      { label: 'Published Assignments', href: '/rosters', icon: CalendarDays, permission: 'queue.view', badge: 'Approved', description: 'Active 3-month route rosters approved by Municipal Planner' },
      { label: 'Queue Management', href: '/queue', icon: ListOrdered, permission: 'queue.view', description: 'Live FIFO terminal queue & vehicle check-in' },
      { label: 'Vehicle Dispatch', href: '/queue', icon: Send, permission: 'queue.dispatch', description: 'Clearance, fee collection & departure confirmation' },
    ],
  },
  {
    title: 'Vehicle Recognition',
    items: [
      { label: 'Live Recognition Feed', href: '/recognition/dashboard', icon: Scan, permission: 'queue.view', description: 'Live ALPR stream & gate entry' },
      { label: 'QR Pass & Gate Scanner', href: '/recognition/qr-gate', icon: QrCode, permission: 'queue.view', description: 'Scan QR pass & gate clearance' },
      { label: 'Recognition History', href: '/recognition/history', icon: History, permission: 'queue.view', description: 'Terminal ALPR recognition log' },
      { label: 'Unregistered Vehicles', href: '/recognition/unknown', icon: ShieldAlert, permission: 'queue.view', description: 'Review & escalate unknown plates' },
    ],
  },
  {
    title: 'Violations & Incidents',
    items: [
      { label: 'Violations & Incidents', href: '/violations', icon: AlertTriangle, permission: 'violations.view', description: 'Register & route-assign violations' },
    ],
  },
  {
    title: 'Monitoring',
    items: [
      { label: 'Terminal Cameras', href: '/cameras', icon: Camera, permission: 'queue.view', description: 'Assigned terminal camera feed (view-only)' },
      { label: 'Operational ALPR Stats', href: '/recognition/analytics', icon: BarChart3, permission: 'reports.view', description: 'Operational ALPR statistics' },
    ],
  },
  {
    title: 'Payment & Revenue',
    items: [
      { label: 'Dispatch Fees & Status', href: '/dispatch-fees', icon: DollarSign, permission: 'queue.view', description: 'Verify departure fee status & tariffs' },
    ],
  },
  {
    title: 'Dispatch Reports',
    items: [
      { label: 'Dispatch Reports', href: '/reports', icon: FileBarChart, permission: 'reports.view', description: 'Daily dispatch & waiting-time reports' },
    ],
  },
];

/**
 * Returns role-based navigation sections filtered by user permissions.
 */
export function getRoleNavSections(roleName?: string, permissions: string[] = []): NavSection[] {
  const isSuperAdmin = roleName === 'SUPER_ADMIN' || permissions.includes('*') || permissions.includes('admin');
  const isPlanner = roleName === 'MUNICIPAL_PLANNER' || roleName === 'PLANNER';
  const isDispatcher = roleName === 'DISPATCHER';

  let rawSections: NavSection[];

  if (isSuperAdmin) {
    rawSections = SUPER_ADMIN_SECTIONS;
  } else if (isPlanner) {
    rawSections = PLANNER_SECTIONS;
  } else if (isDispatcher) {
    rawSections = DISPATCHER_SECTIONS;
  } else {
    // Fallback for custom roles: filter Super Admin sections by user's specific permissions
    rawSections = SUPER_ADMIN_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.permission || permissions.includes(item.permission)),
    })).filter((section) => section.items.length > 0);
  }

  // If super admin, return all sections without filtering
  if (isSuperAdmin) {
    return rawSections;
  }

  // Filter items in each section by permission
  return rawSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.permission || permissions.includes(item.permission)
      ),
    }))
    .filter((section) => section.items.length > 0);
}

/**
 * Returns a flat list of items for search palettes and command menus.
 */
export function getNavItemsForPermissions(permissions: string[] = []): NavItem[] {
  if (permissions.includes('*') || permissions.includes('admin')) {
    return NAV_ITEMS;
  }
  return NAV_ITEMS.filter((item) => !item.permission || permissions.includes(item.permission));
}
