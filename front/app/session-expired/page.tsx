'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Clock, ArrowLeft } from 'lucide-react';

export default function SessionExpiredPage() {
  const router = useRouter();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <Clock className="h-12 w-12 text-warning" />
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Session expired</h1>
        <p className="text-sm text-muted-foreground">Your session has timed out. Please sign in again.</p>
      </div>
      <Button onClick={() => router.push('/login')}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Sign in again
      </Button>
    </div>
  );
}
