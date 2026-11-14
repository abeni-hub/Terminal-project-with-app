'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type ApiError } from '@/src/services/api';
import type { Vehicle } from '@/src/types/vehicle';
import type { QueryParams } from '@/src/services/http';

export function useVehicles(params: QueryParams) {
  return useQuery({
    queryKey: ['vehicles', params],
    queryFn: () => api.vehicles.list(params),
  });
}

export function useCreateVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.vehicles.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
}

export function useUpdateVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Vehicle> }) => api.vehicles.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
}

export function useDeleteVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.vehicles.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
}

export function useVehicleFilters() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [terminalFilter, setTerminalFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const params = useMemo(
    () => ({
      page,
      pageSize,
      search,
      filters: { status: statusFilter, type: typeFilter, terminalId: terminalFilter },
    }),
    [page, pageSize, search, statusFilter, typeFilter, terminalFilter],
  );

  return {
    search, setSearch, statusFilter, setStatusFilter, typeFilter, setTypeFilter,
    terminalFilter, setTerminalFilter, page, setPage, pageSize, setPageSize, params,
  };
}

export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return (err as ApiError).message;
  }
  return fallback;
}
