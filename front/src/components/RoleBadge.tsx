import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface RoleBadgeProps {
  role: string;
  className?: string;
}

const roleVariant: Record<string, string> = {
  SUPER_ADMIN: 'bg-primary/10 text-primary border-primary/20',
  MUNICIPAL_PLANNER: 'bg-info/10 text-info border-info/20',
  DISPATCHER: 'bg-success/10 text-success border-success/20',
};

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const label = role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <Badge variant="outline" className={cn('font-medium', roleVariant[role] ?? 'bg-muted text-muted-foreground border-border', className)}>
      {label}
    </Badge>
  );
}
