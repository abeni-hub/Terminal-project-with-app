'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/src/store/auth-store';

export default function Home() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  useEffect(() => {
    if (useAuthStore.persist?.hasHydrated()) {
      useAuthStore.getState().setHasHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (hasHydrated) {
      router.replace(session ? '/dashboard' : '/login');
    }
  }, [hasHydrated, session, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
