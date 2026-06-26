import type { ApiError } from './types';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.REACT_NATIVE_API_BASE_URL ||
  'http://localhost:3000';

// TODO: replace with the real authenticated user id once a signup/login flow exists.
// The backend currently identifies users via the x-user-id header (no auth yet).
// Set by useBootstrapUser on app start, before any screen can issue a request.
let currentUserId: string | undefined;

export function setCurrentUserId(id: string): void {
  currentUserId = id;
}

function getCurrentUserId(): string {
  if (!currentUserId) {
    throw new Error('No current user set. App should call setCurrentUserId before rendering screens.');
  }
  return currentUserId;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
};

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(path, API_BASE_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return fallback;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query } = options;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': getCurrentUserId(),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    const apiError: ApiError = {
      message: 'Network request failed. Check your connection and API base URL.',
      details: err,
    };
    throw apiError;
  }

  const text = await response.text();
  const data = text.length > 0 ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const apiError: ApiError = {
      status: response.status,
      message: (data && typeof data.error === 'string' && data.error) || 'Request failed',
      details: data,
    };
    throw apiError;
  }

  return data as T;
}
