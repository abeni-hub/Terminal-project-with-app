'use client';

import { useState, useMemo, type ReactNode } from 'react';
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel,
  getPaginationRowModel, flexRender, type ColumnDef, type SortingState,
  type ColumnFiltersState, VisibilityState,
} from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, Inbox } from 'lucide-react';

export interface ServerPaginationProps {
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange?: (newPageSize: number) => void;
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  toolbar?: ReactNode;
  pageSize?: number;
  onRowClick?: (row: TData) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  serverPagination?: ServerPaginationProps;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading,
  error,
  onRetry,
  searchPlaceholder = 'Search...',
  searchValue,
  onSearchChange,
  toolbar,
  pageSize = 10,
  onRowClick,
  emptyTitle = 'No records found',
  emptyDescription = 'Try adjusting your filters or search.',
  serverPagination,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility] = useState<VisibilityState>({});
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize });

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, columnVisibility, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: !!serverPagination,
    pageCount: serverPagination ? serverPagination.totalPages : undefined,
  });

  const rows = table.getRowModel().rows;

  const renderBody = useMemo(() => {
    if (isLoading) {
      return Array.from({ length: 6 }).map((_, i) => (
        <tr key={i}>
          {columns.map((_, j) => (
            <td key={j} className="p-3">
              <Skeleton className="h-5 w-full" />
            </td>
          ))}
        </tr>
      ));
    }
    if (error) {
      return (
        <tr>
          <td colSpan={columns.length} className="p-8 text-center text-sm text-destructive">
            {error}
            {onRetry && (
              <Button variant="outline" size="sm" className="ml-2" onClick={onRetry}>Retry</Button>
            )}
          </td>
        </tr>
      );
    }
    if (rows.length === 0) {
      return (
        <tr>
          <td colSpan={columns.length} className="p-12">
            <div className="flex flex-col items-center justify-center gap-2 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground/40" />
              <p className="font-medium text-foreground">{emptyTitle}</p>
              <p className="text-sm text-muted-foreground">{emptyDescription}</p>
            </div>
          </td>
        </tr>
      );
    }
    return rows.map((row) => (
      <tr
        key={row.id}
        className={cn('border-b border-border transition-colors hover:bg-muted/50', onRowClick && 'cursor-pointer')}
        onClick={() => onRowClick?.(row.original)}
      >
        {row.getVisibleCells().map((cell) => (
          <td key={cell.id} className="p-3 text-sm">
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        ))}
      </tr>
    ));
  }, [isLoading, error, rows, columns, onRowClick, onRetry, emptyTitle, emptyDescription]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {onSearchChange ? (
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchValue ?? ''}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
        ) : <div />}
        {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border scrollbar-thin">
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th key={header.id} className="p-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={cn('inline-flex items-center gap-1', header.column.getCanSort() && 'cursor-pointer hover:text-foreground')}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && <ArrowUpDown className="h-3 w-3" />}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>{renderBody}</tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading ? (
            'Loading...'
          ) : serverPagination ? (
            `Showing page ${serverPagination.page} of ${serverPagination.totalPages} (${serverPagination.total} total)`
          ) : (
            `${table.getFilteredRowModel().rows.length} record(s)`
          )}
        </p>
        <div className="flex items-center gap-2">
          {serverPagination ? (
            <>
              <span className="text-sm text-muted-foreground">
                Page {serverPagination.page} of {Math.max(1, serverPagination.totalPages)}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => serverPagination.onPageChange(1)}
                  disabled={serverPagination.page <= 1 || isLoading}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => serverPagination.onPageChange(serverPagination.page - 1)}
                  disabled={serverPagination.page <= 1 || isLoading}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => serverPagination.onPageChange(serverPagination.page + 1)}
                  disabled={serverPagination.page >= serverPagination.totalPages || isLoading}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => serverPagination.onPageChange(serverPagination.totalPages)}
                  disabled={serverPagination.page >= serverPagination.totalPages || isLoading}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <>
              <span className="text-sm text-muted-foreground">
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}>
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
