// Real NestJS backend HTTP client
// Maps every method signature exactly to the original mockApi contract

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// ─── Auth helpers ────────────────────────────────────────────────────────────
function getSession(): any | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('aato_session');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getToken(): string | null {
  return getSession()?.state?.session?.token ?? getSession()?.token ?? getSession()?.session?.token ?? null;
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────
async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  isPublic = false,
): Promise<T> {
  const headers = isPublic
    ? { 'Content-Type': 'application/json' }
    : authHeaders();

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined') {
      // Clear expired session if token has expired
      localStorage.removeItem('aato_session');
    }
    const { ApiError } = await import('./http');
    throw new ApiError(
      json.message || `Request to ${path} failed with status ${res.status}`,
      res.status,
      json.code || 'REQUEST_FAILED',
      json.details,
    );
  }

  return json as T;
}

function get<T>(path: string) { return request<T>('GET', path); }
function post<T>(path: string, body?: unknown, isPublic = false) { return request<T>('POST', path, body, isPublic); }
function put<T>(path: string, body?: unknown) { return request<T>('PUT', path, body); }
function del<T>(path: string) { return request<T>('DELETE', path); }

// ─── Query string builder ─────────────────────────────────────────────────────
function qs(params?: Record<string, unknown>): string {
  if (!params) return '';
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

// ─── API surface ──────────────────────────────────────────────────────────────
export const realApi = {
  auth: {
    login: async (credentials: any) => {
      const session = await post<any>('/auth/login', credentials, true);
      if (typeof window !== 'undefined') {
        localStorage.setItem('aato_session', JSON.stringify({ state: { session }, version: 2 }));
      }
      return session;
    },
    logout: async () => {
      try {
        await post<void>('/auth/logout');
      } catch (err) {
        // Silently swallow errors during logout (e.g. if token expired)
        console.warn('Logout server request ignored or token expired:', err);
      } finally {
        if (typeof window !== 'undefined') localStorage.removeItem('aato_session');
      }
    },
    refresh: async (refreshToken: string) => {
      const session = await post<any>('/auth/refresh', { refreshToken }, true);
      if (typeof window !== 'undefined') {
        localStorage.setItem('aato_session', JSON.stringify({ state: { session }, version: 2 }));
      }
      return session;
    },
  },

  rbac: {
    getRoles: () => get<any[]>('/rbac/roles'),
    createRole: (input: any) => post<any>('/rbac/roles', input),
    updateRole: (id: string, input: any) => put<any>(`/rbac/roles/${id}`, input),
    deleteRole: (id: string) => del<void>(`/rbac/roles/${id}`),
    getPermissions: () => get<any[]>('/rbac/permissions'),
  },

  users: {
    list: (params: any) => get<any>(`/users${qs({ page: params.page, pageSize: params.pageSize, search: params.search, sortBy: params.sortBy, sortDir: params.sortDir, roleId: params.filters?.roleId, status: params.filters?.status })}`),
    create: (input: any) => post<any>('/users', input),
    update: (id: string, input: any) => put<any>(`/users/${id}`, input),
    delete: (id: string) => del<void>(`/users/${id}`),
    resetPassword: (id: string) => post<void>(`/users/${id}/reset-password`),
  },

  vehicles: {
    list: (params: any) => get<any>(`/vehicles${qs({ page: params.page, pageSize: params.pageSize, search: params.search, sortBy: params.sortBy, sortDir: params.sortDir, status: params.filters?.status, type: params.filters?.type, groupId: params.filters?.groupId, assignmentId: params.filters?.assignmentId, dispatcherId: params.filters?.dispatcherId })}`),
    getById: (id: string) => get<any>(`/vehicles/${id}`),
    getHistory: (idOrPlate: string) => get<any>(`/vehicles/${idOrPlate}/history`),
    create: (input: any) => post<any>('/vehicles', input),
    update: (id: string, input: any) => put<any>(`/vehicles/${id}`, input),
    delete: (id: string) => del<void>(`/vehicles/${id}`),
  },

  vehicleGroups: {
    list: (params?: any) => get<any>(`/vehicle-groups${qs({ page: params?.page, pageSize: params?.pageSize, search: params?.search })}`),
    create: (input: any) => post<any>('/vehicle-groups', input),
    update: (id: string, input: any) => put<any>(`/vehicle-groups/${id}`, input),
    delete: (id: string) => del<void>(`/vehicle-groups/${id}`),
  },

  terminals: {
    list: (params: any) => get<any>(`/terminals${qs({ page: params.page, pageSize: params.pageSize, search: params.search, sortBy: params.sortBy, sortDir: params.sortDir })}`),
    create: (input: any) => post<any>('/terminals', input),
    update: (id: string, input: any) => put<any>(`/terminals/${id}`, input),
    delete: (id: string) => del<void>(`/terminals/${id}`),
  },

  routes: {
    list: (params: any) => get<any>(`/routes${qs({ page: params.page, pageSize: params.pageSize, search: params.search, sortBy: params.sortBy, sortDir: params.sortDir })}`),
    create: (input: any) => post<any>('/routes', input),
    update: (id: string, input: any) => put<any>(`/routes/${id}`, input),
    delete: (id: string) => del<void>(`/routes/${id}`),
  },

  assignments: {
    list: (params: any) => get<any>(`/assignments${qs({ page: params.page, pageSize: params.pageSize, search: params.search, sortBy: params.sortBy, sortDir: params.sortDir, status: params.filters?.status, weekNumber: params.filters?.weekNumber, terminalId: params.filters?.terminalId, dispatcherId: params.filters?.dispatcherId })}`),
    create: (input: any) => post<any>('/assignments', input),
    update: (id: string, input: any) => put<any>(`/assignments/${id}`, input),
    review: (id: string) => post<any>(`/assignments/${id}/review`),
    publish: (id: string) => post<any>(`/assignments/${id}/publish`),
    lock: (id: string) => post<any>(`/assignments/${id}/lock`),
    archive: (id: string) => post<any>(`/assignments/${id}/archive`),
    delete: (id: string) => del<void>(`/assignments/${id}`),
    generatePreview: (weekNumber: number) => get<any>(`/assignments/preview${qs({ weekNumber })}`),
    bulkSave: (assignments: any[]) => post<any>('/assignments/bulk', { assignments }),
  },

  queue: {
    list: (params: any) => get<any>(`/queue${qs({ page: params.page, pageSize: params.pageSize, search: params.search, terminalId: params.filters?.terminalId, assignmentId: params.filters?.assignmentId, status: params.filters?.status, isViolation: params.filters?.isViolation, plateNumber: params.filters?.plateNumber })}`),
    checkIn: (input: any) => post<any>('/queue/check-in', input),
    dispatchIn: (input: { queueEntryId: string; dispatcherId: string; remark?: string }) => post<any>('/queue/dispatch-in', input),
    dispatch: (input: any) => post<any>('/queue/dispatch', input),
    dispatchOut: (input: { queueEntryId: string; dispatcherId: string; deviceId?: string; paymentReference?: string; feeAmount?: number; paymentStatus?: string }) => post<any>('/queue/dispatch-out', input),
    confirmPayment: (input: { dispatchRecordId?: string; queueEntryId?: string; dispatcherId: string; paymentReference: string; paymentStatus?: string }) => post<any>('/queue/confirm-payment', input),
    resolveViolation: (input: { queueEntryId: string; action: 'DISPATCH_IN' | 'REJECT'; remark: string; dispatcherId: string }) => post<any>('/queue/resolve-violation', input),
  },

  dispatchRecords: {
    list: (params: any) => get<any>(`/queue/dispatch-records${qs({ page: params.page, pageSize: params.pageSize, search: params.search, dispatcherId: params.filters?.dispatcherId, originTerminalId: params.filters?.originTerminalId })}`),
  },

  fees: {
    list: () => get<any[]>('/fees'),
    create: (input: any) => post<any>('/fees', input),
    update: (id: string, input: any) => put<any>(`/fees/${id}`, input),
    delete: (id: string) => del<void>(`/fees/${id}`),
  },

  violations: {
    list: (params: any) => get<any>(`/violations${qs({ page: params.page, pageSize: params.pageSize, search: params.search, severity: params.filters?.severity, status: params.filters?.status, terminalId: params.filters?.terminalId, type: params.filters?.type })}`),
    resolve: (id: string, payload: any) => post<any>(`/violations/${id}/resolve`, typeof payload === 'string' ? { resolution: payload } : payload),
  },

  overrides: {
    list: (params: any) => get<any>(`/overrides${qs({ page: params.page, pageSize: params.pageSize, search: params.search })}`),
    approve: (id: string, pin: string) => post<any>(`/overrides/${id}/approve`, { pin }),
  },

  auditLogs: {
    list: (params: any) => get<any>(`/audit-logs${qs({ page: params.page, pageSize: params.pageSize, search: params.search })}`),
  },

  devices: {
    list: (params: any) => get<any>(`/devices${qs({ page: params.page, pageSize: params.pageSize, search: params.search })}`),
    approve: (id: string) => post<any>(`/devices/${id}/approve`),
    reject: (id: string) => post<any>(`/devices/${id}/reject`),
    sync: (input: any) => post<any>('/devices/sync', input),
  },

  dashboard: {
    get: () => get<any>('/dashboard'),
    getDispatcher: (userId: string) => get<any>(`/dashboard/dispatcher/${userId}`),
  },

  vehicleAccounts: {
    list: (params: any) =>
      get<any>(
        `/vehicle-accounts${qs({
          page: params.page,
          pageSize: params.pageSize,
          search: params.search,
          sortBy: params.sortBy,
          sortDir: params.sortDir,
          status: params.filters?.status,
          hasDebt: params.filters?.hasDebt,
          groupId: params.filters?.groupId,
          plateNumber: params.filters?.plateNumber,
        })}`,
      ),
    getById: (idOrVehicleId: string) => get<any>(`/vehicle-accounts/${idOrVehicleId}`),
    search: (query: string) => get<any[]>(`/vehicle-accounts/search${qs({ q: query })}`),
    topUp: (input: {
      vehicleId?: string;
      plateNumber?: string;
      cardUid?: string;
      cardNumber?: string;
      amount: number;
      paymentMethod: string;
      paymentReference?: string;
      notes?: string;
    }) => post<any>('/vehicle-accounts/top-up', input),
    linkCard: (input: { vehicleId: string; cardUid: string; cardNumber: string; expiresAt?: string }) =>
      post<any>('/vehicle-accounts/cards/link', input),
    blockCard: (cardId: string, reason: string) => post<any>(`/vehicle-accounts/cards/${cardId}/block`, { reason }),
    markCardLost: (cardId: string, reason: string) => post<any>(`/vehicle-accounts/cards/${cardId}/lost`, { reason }),
    replaceCard: (input: {
      vehicleId: string;
      oldCardId: string;
      newCardUid: string;
      newCardNumber: string;
      reason?: string;
      feeCharged?: boolean;
      feeAmount?: number;
    }) => post<any>('/vehicle-accounts/cards/replace', input),
    getCards: (params?: any) =>
      get<any>(
        `/vehicle-accounts/cards${qs({
          page: params?.page,
          pageSize: params?.pageSize,
          search: params?.search,
          sortBy: params?.sortBy,
          sortDir: params?.sortDir,
          vehicleId: params?.filters?.vehicleId,
          status: params?.filters?.status,
        })}`,
      ),
    getTransactions: (params: any) =>
      get<any>(
        `/vehicle-accounts/transactions${qs({
          page: params.page,
          pageSize: params.pageSize,
          search: params.search,
          sortBy: params.sortBy,
          sortDir: params.sortDir,
          vehicleId: params.filters?.vehicleId,
          plateNumber: params.filters?.plateNumber,
          type: params.filters?.type,
          paymentMethod: params.filters?.paymentMethod,
          startDate: params.filters?.startDate,
          endDate: params.filters?.endDate,
        })}`,
      ),
    adjustBalance: (vehicleId: string, input: { amount: number; reason: string; reference?: string }) =>
      post<any>(`/vehicle-accounts/${vehicleId}/adjust-balance`, input),
    updateStatus: (vehicleId: string, input: { status: string; reason?: string }) =>
      post<any>(`/vehicle-accounts/${vehicleId}/status`, input),
    getPenaltyConfig: () => get<any>('/vehicle-accounts/penalty-config'),
    updatePenaltyConfig: (input: { ruleType: string; amount: number; description?: string; active?: boolean }) =>
      put<any>('/vehicle-accounts/penalty-config', input),
    getStatsSummary: () => get<any>('/vehicle-accounts/stats/summary'),
  },
};
