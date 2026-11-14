'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/src/store/auth-store';
import { useUIStore } from '@/src/store/ui-store';
import { Sidebar } from '@/src/components/layout/Sidebar';
import { Topbar } from '@/src/components/layout/Topbar';
import { Breadcrumbs } from '@/src/components/layout/Breadcrumbs';
import { CommandPalette } from '@/src/components/layout/CommandPalette';
import { OfflineBanner } from '@/src/components/OfflineBanner';
import { cn } from '@/lib/utils';

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useAuthStore((s) => s.session);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const setOnline = useUIStore((s) => s.setOnline);

  useEffect(() => {
    // Also mark hydrated on client mount if onRehydrateStorage fired synchronously
    if (useAuthStore.persist?.hasHydrated()) {
      useAuthStore.getState().setHasHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (hasHydrated && !session) {
      router.replace('/login');
    }
  }, [hasHydrated, session, router]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, [setOnline]);

  if (!hasHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Restoring session...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className={cn('flex min-h-screen flex-col transition-[padding] duration-200', collapsed ? 'lg:pl-16' : 'lg:pl-64')}>
        <OfflineBanner />
        <Topbar />
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl space-y-6">
            <Breadcrumbs />
            {children}
          </div>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
