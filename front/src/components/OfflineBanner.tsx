'use client';

import { WifiOff, RefreshCw } from 'lucide-react';
import { useUIStore } from '@/src/store/ui-store';
import { useIsClient } from '@/src/hooks/useIsClient';

export function OfflineBanner() {
  const online = useUIStore((s) => s.online);
  const pendingSync = useUIStore((s) => s.pendingSync);
  const lastSyncAt = useUIStore((s) => s.lastSyncAt);
  const isClient = useIsClient();
  if (!isClient || online) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-warning px-4 py-2 text-sm text-warning-foreground">
      <WifiOff className="h-4 w-4" />
      <span className="font-medium">You are offline. Changes are queued locally.</span>
      {pendingSync > 0 && <span className="opacity-80">{pendingSync} pending sync action(s)</span>}
      {lastSyncAt && <span className="opacity-70">Last synced: {new Date(lastSyncAt).toLocaleTimeString()}</span>}
      <RefreshCw className="h-3.5 w-3.5 animate-pulse" />
    </div>
  );
}
