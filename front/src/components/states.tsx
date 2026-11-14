import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle } from 'lucide-react';

export function EmptyState({ title, description, icon: Icon, action, className }: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: { label: string; onClick: () => void };
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-12 text-center', className)}>
      {Icon && <Icon className="h-10 w-10 text-muted-foreground/50" />}
      <div className="space-y-1">
        <p className="font-medium text-foreground">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && (
        <Button size="sm" variant="outline" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function LoadingSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 w-full animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-12 text-center', className)}>
      <AlertCircle className="h-10 w-10 text-destructive/60" />
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" /> Retry
        </Button>
      )}
    </div>
  );
}
