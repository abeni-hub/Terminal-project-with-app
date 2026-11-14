'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ShieldX, ArrowLeft } from 'lucide-react';

export default function UnauthorizedPage() {
  const router = useRouter();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <ShieldX className="h-12 w-12 text-destructive" />
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Access denied</h1>
        <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
      </div>
      <Button variant="outline" onClick={() => router.push('/dashboard')}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Go to dashboard
      </Button>
    </div>
  );
}
