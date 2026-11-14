import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

const variantStyles: Record<NonNullable<StatCardProps['variant']>, string> = {
  default: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-destructive/10 text-destructive',
  info: 'bg-info/10 text-info',
};

export function StatCard({ label, value, icon: Icon, trend, variant = 'default', className }: StatCardProps) {
  return (
    <Card className={cn('overflow-hidden transition-shadow hover:shadow-md', className)}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
            {trend && (
              <p className={cn('text-xs font-medium', trend.positive ? 'text-success' : 'text-destructive')}>
                {trend.positive ? '+' : '-'}{trend.value}% vs yesterday
              </p>
            )}
          </div>
          <div className={cn('flex h-11 w-11 items-center justify-center rounded-lg', variantStyles[variant])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
