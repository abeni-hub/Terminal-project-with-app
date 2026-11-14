'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { api } from '@/src/services/api';
import type { AuditLog } from '@/src/types/operations';
import { PageHeader } from '@/src/components/PageHeader';
import { DataTable } from '@/src/components/DataTable';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PaginatedResponse } from '@/src/services/http';

export default function AuditLogsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<PaginatedResponse<AuditLog>>({ queryKey: ['audit-logs', { page, pageSize: 10, search }], queryFn: () => api.auditLogs.list({ page, pageSize: 10, search }) });

  const columns = useMemo<ColumnDef<AuditLog>[]>(() => [
    { accessorKey: 'timestamp', header: 'Time', cell: ({ row }) => <span className="text-xs">{new Date(row.original.timestamp).toLocaleString()}</span> },
    { accessorKey: 'actor', header: 'Actor', cell: ({ row }) => <span className="font-medium">{row.original.actor}</span> },
    { accessorKey: 'action', header: 'Action', cell: ({ row }) => <Badge variant="outline" className="text-xs">{row.original.action}</Badge> },
    { accessorKey: 'entity', header: 'Entity' },
    { accessorKey: 'entityId', header: 'Entity ID', cell: ({ row }) => <span className="font-mono text-xs">{row.original.entityId}</span> },
    { accessorKey: 'details', header: 'Details', cell: ({ row }) => <span className="text-xs text-muted-foreground truncate">{row.original.details}</span> },
    {
      id: 'actions', header: '', enableSorting: false,
      cell: ({ row }) => <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelected(row.original)}><Eye className="h-3.5 w-3.5" /></Button>,
    },
  ], []);

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Logs" description="Complete activity history for compliance and troubleshooting" />

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        error={isError ? 'Failed to load audit logs' : null}
        onRetry={refetch}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search by actor, action, entity..."
        serverPagination={{
          page,
          pageSize: 10,
          total: data?.total ?? 0,
          totalPages: data?.totalPages ?? 1,
          onPageChange: (p) => setPage(p),
        }}
      />

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Audit Log Detail</DialogTitle></DialogHeader>
          {selected && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">Timestamp</p><p>{new Date(selected.timestamp).toLocaleString()}</p></div>
                  <div><p className="text-xs text-muted-foreground">Actor</p><p>{selected.actor}</p></div>
                  <div><p className="text-xs text-muted-foreground">Action</p><p><Badge variant="outline" className="text-xs">{selected.action}</Badge></p></div>
                  <div><p className="text-xs text-muted-foreground">Entity</p><p>{selected.entity}</p></div>
                  <div><p className="text-xs text-muted-foreground">Entity ID</p><p className="font-mono text-xs">{selected.entityId}</p></div>
                  <div><p className="text-xs text-muted-foreground">IP Address</p><p className="font-mono text-xs">{selected.ipAddress}</p></div>
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Details</p>
                  <pre className="rounded-md bg-muted p-3 text-xs">{JSON.stringify({ details: selected.details, entityId: selected.entityId, actor: selected.actor, action: selected.action }, null, 2)}</pre>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
