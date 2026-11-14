/**
 * alpr-api.ts
 * Shared base URL and typed fetch helpers for all ALPR-specific pages
 * (cameras, recognition, journey). Re-uses the same backend base URL
 * as the existing realApi service.
 */
export const ALPR_API_BASE =
  (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api') + '/v1';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('aato_session');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.session?.token ?? parsed?.token ?? parsed?.session?.token ?? null;
  } catch {
    return null;
  }
}

export async function alprFetch(path: string, options?: RequestInit) {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${ALPR_API_BASE}${path}`, {
    ...options,
    headers,
  });
  return res;
}
