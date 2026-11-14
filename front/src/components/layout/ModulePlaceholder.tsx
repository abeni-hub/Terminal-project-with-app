'use client';

import { PageHeader } from '@/src/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Construction } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export function ModulePlaceholder({ title, description, icon: Icon = Construction }: { title: string; description: string; icon?: LucideIcon }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Icon className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="font-medium text-foreground">{title} module</p>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <p className="text-xs text-muted-foreground">This module is fully wired with mock data and ready for backend integration.</p>
        </CardContent>
      </Card>
    </div>
  );
}
