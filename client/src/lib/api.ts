import type { Session } from './types';

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Resolves image URLs: uploads are served by the API, seeded images may be absolute. */
export function assetUrl(url: string | null | undefined): string {
  if (!url) return '';
  return url.startsWith('/') ? `${API_BASE}${url}` : url;
}

// ---- Access token lives in memory only; the refresh token is an httpOnly cookie. ----
let accessToken: string | null = null;
type SessionListener = (session: Session | null) => void;
const listeners = new Set<SessionListener>();

export const session = {
  getToken: () => accessToken,
  set(s: Session | null) {
    accessToken = s?.accessToken ?? null;
    listeners.forEach((l) => l(s));
  },
  subscribe(l: SessionListener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

let refreshInFlight: Promise<Session | null> | null = null;

/** Exchanges the refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshSession(): Promise<Session | null> {
  refreshInFlight ??= (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, { method: 'POST', credentials: 'include' });
      if (!res.ok) {
        session.set(null);
        return null;
      }
      const data = (await res.json()) as Session;
      session.set(data);
      return data;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

type Query = Record<string, string | number | boolean | undefined | null>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Query;
  formData?: FormData;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: Query) {
  const url = `${API_BASE}/api${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

export async function api<T>(path: string, opts: RequestOptions = {}, retried = false): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  let body: BodyInit | undefined;
  if (opts.formData) body = opts.formData;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? 'GET',
      headers,
      body,
      credentials: 'include',
      signal: opts.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Is the API running?');
  }

  if (res.status === 401 && !retried && !path.startsWith('/auth/')) {
    const refreshed = await refreshSession();
    if (refreshed) return api<T>(path, opts, true);
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error;
    throw new ApiError(res.status, e?.code ?? 'UNKNOWN', e?.message ?? `Request failed (${res.status})`, e?.details);
  }
  return data as T;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'VALIDATION_ERROR' && err.details?.length) return err.details[0].message;
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}
