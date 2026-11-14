// ─── Types used by both mockApi and realApi ───────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface QueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  filters?: Record<string, string | undefined>;
}

// ─── Typed API error class ────────────────────────────────────────────────────
export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  isUnauthorized() { return this.status === 401; }
  isForbidden() { return this.status === 403; }
  isNotFound() { return this.status === 404; }
  isConflict() { return this.status === 409; }
  isServerError() { return this.status >= 500; }
}

// ─── Mock helpers (used by mockApi.ts during development) ───────────────────
export function withLatency<T>(fn: () => T, min = 100, max = 300): Promise<T> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(() => resolve(fn()), delay));
}

export function paginate<T>(
  items: T[],
  params?: QueryParams | { page: number; pageSize: number },
): PaginatedResponse<T> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 10;
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const data = items.slice((page - 1) * pageSize, page * pageSize);
  return { data, total, page, pageSize, totalPages };
}

export function applySearch<T>(
  items: T[],
  search: string,
  selector: (item: T) => (string | undefined | null)[],
): T[] {
  if (!search) return items;
  const q = search.toLowerCase();
  return items.filter((item) => {
    const fields = selector(item);
    return fields.some((field) => String(field ?? '').toLowerCase().includes(q));
  });
}

export function applySort<T>(
  items: T[],
  sortBy?: string,
  sortDir?: 'asc' | 'desc',
): T[] {
  if (!sortBy) return items;
  return [...items].sort((a, b) => {
    const aVal = (a as any)[sortBy] ?? '';
    const bVal = (b as any)[sortBy] ?? '';
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    }
    const result = String(aVal).localeCompare(String(bVal));
    return sortDir === 'desc' ? -result : result;
  });
}
