'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/src/services/api';
import type { User } from '@/src/types/user';
import type { WeeklyRouteAssignment } from '@/src/types/operations';
import type { PaginatedResponse } from '@/src/services/http';
import { PageHeader } from '@/src/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { UserCog, ArrowRightLeft } from 'lucide-react';
import { useAuthStore } from '@/src/store/auth-store';

export default function DispatcherAssignmentPage() {
  const { data: usersData } = useQuery<PaginatedResponse<User>>({ queryKey: ['users-all'], queryFn: () => api.users.list({ page: 1, pageSize: 100 }) });
  const { data: assignmentsData } = useQuery<PaginatedResponse<WeeklyRouteAssignment>>({ queryKey: ['assignments-all'], queryFn: () => api.assignments.list({ page: 1, pageSize: 100 }) });
  const { data: rolesData } = useQuery({ queryKey: ['roles'], queryFn: api.rbac.getRoles });

  const dispatchers = (usersData?.data ?? []).filter((u: User) => {
    const role = rolesData?.find((r: import('@/src/types/user').CustomRole) => r.id === u.roleId);
    return role?.name === 'DISPATCHER';
  });
  const assignments = assignmentsData?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Dispatcher Assignment" description="View dispatcher assignments to weekly route assignments" actions={<button className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"><ArrowRightLeft className="h-4 w-4" /> Swap Routes</button>} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {dispatchers.map((d: User) => {
          const dispatcherAssignments = assignments.filter((a: WeeklyRouteAssignment) => a.dispatcherIds.includes(d.id));
          return (
            <Card key={d.id}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10"><AvatarFallback style={{ backgroundColor: d.avatarColor ?? '#2176ff' }} className="text-white">{d.name.split(' ').map((n: string) => n[0]).join('')}</AvatarFallback></Avatar>
                  <div>
                    <CardTitle className="text-sm">{d.name}</CardTitle>
                    <CardDescription className="text-xs">{d.email}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="outline" className={d.status === 'ACTIVE' ? 'border-success/20 bg-success/10 text-success' : 'border-warning/20 bg-warning/10 text-warning'}>{d.status}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Assignments</span>
                  <span className="font-medium">{dispatcherAssignments.length}</span>
                </div>
                {dispatcherAssignments.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {dispatcherAssignments.map((a: WeeklyRouteAssignment) => (
                      <Badge key={a.id} variant="outline" className="text-xs">{a.originTerminalName} → {a.destinationTerminalName}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><UserCog className="h-4 w-4" /> Assignment Timeline</CardTitle><CardDescription>Upcoming dispatcher assignments from published weekly route assignments</CardDescription></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {assignments.filter((a: WeeklyRouteAssignment) => a.status === 'PUBLISHED' && a.dispatcherIds.length > 0).slice(0, 10).map((a: WeeklyRouteAssignment) => {
              return (
                <div key={a.id} className="flex items-center gap-3 rounded-md border border-border p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary"><UserCog className="h-4 w-4" /></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{a.dispatcherNames.join(', ')}</p>
                    <p className="text-xs text-muted-foreground">Week {a.weekNumber} - {a.originTerminalName} → {a.destinationTerminalName} ({a.vehicleGroupName})</p>
                  </div>
                </div>
              );
            })}
            {assignments.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No assignments yet</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
