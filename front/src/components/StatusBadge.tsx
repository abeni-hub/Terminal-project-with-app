import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

const variantClasses: Record<Variant, string> = {
  default: 'bg-primary/10 text-primary border-primary/20',
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  danger: 'bg-destructive/10 text-destructive border-destructive/20',
  info: 'bg-info/10 text-info border-info/20',
  muted: 'bg-muted text-muted-foreground border-border',
};

export function StatusBadge({ label, variant = 'default', className }: { label: string; variant?: Variant; className?: string }) {
  return (
    <Badge variant="outline" className={cn('font-medium', variantClasses[variant], className)}>
      <span className={cn('mr-1.5 inline-block h-1.5 w-1.5 rounded-full', {
        'bg-primary': variant === 'default',
        'bg-success': variant === 'success',
        'bg-warning': variant === 'warning',
        'bg-destructive': variant === 'danger',
        'bg-info': variant === 'info',
        'bg-muted-foreground': variant === 'muted',
      })} />
      {label}
    </Badge>
  );
}
