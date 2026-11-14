'use client';

import { type ReactNode } from 'react';
import { useAuthStore } from '@/src/store/auth-store';

export function PermissionGuard({ permission, children, fallback = null }: { permission: string; children: ReactNode; fallback?: ReactNode }) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  if (!hasPermission(permission)) return <>{fallback}</>;
  return <>{children}</>;
}
