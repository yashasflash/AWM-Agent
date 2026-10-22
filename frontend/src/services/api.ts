import { API_BASE_URL, STORAGE_KEYS } from '../utils/constants';

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
  skipCache?: boolean;
  cacheTtlMs?: number;
}

export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// Client-side in-flight request deduplication & short-lived response cache
const inFlightRequests = new Map<string, Promise<unknown>>();
const responseCache = new Map<string, { data: unknown; expiry: number }>();

export function clearApiCache() {
  responseCache.clear();
  inFlightRequests.clear();
}

export function invalidateApiCache(pattern?: string) {
  if (!pattern) {
    responseCache.clear();
    return;
  }
  for (const key of responseCache.keys()) {
    if (key.includes(pattern)) {
      responseCache.delete(key);
    }
  }
}

export async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers, skipCache, cacheTtlMs, ...restOptions } = options;
  const isGet = (restOptions.method || 'GET').toUpperCase() === 'GET';

  let url = `${API_BASE_URL}${endpoint}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
  const cacheKey = `${token ? 'auth:' : 'anon:'}${url}`;

  // Check cache for GET requests
  if (isGet && !skipCache) {
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      return cached.data as T;
    }
    // Deduplicate identical in-flight GET requests
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey) as Promise<T>;
    }
  }

  const requestHeaders: Record<string, string> = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(headers as Record<string, string>),
  };

  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  const executeFetch = async (): Promise<T> => {
    try {
      const response = await fetch(url, {
        ...restOptions,
        headers: requestHeaders,
      });

      // Parse JSON or text
      let data: unknown;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        let errorMessage = 'An error occurred with the request.';
        if (typeof data === 'object' && data !== null) {
          const errorObj = data as { detail?: string; message?: string };
          errorMessage = errorObj.detail || errorObj.message || errorMessage;
        } else if (typeof data === 'string' && data) {
          errorMessage = data;
        }

        // If token expired or unauthorized, trigger a custom event
        if (response.status === 401) {
          clearApiCache();
          window.dispatchEvent(new CustomEvent('awm:unauthorized'));
        }

        throw new ApiError(errorMessage, response.status, data);
      }

      // If mutation succeeded, invalidate related GET caches
      if (!isGet) {
        invalidateApiCache(endpoint.split('/')[3] || '');
      } else if (!skipCache) {
        // Cache successful GET responses (default 10s TTL, customizable)
        const ttl = cacheTtlMs !== undefined ? cacheTtlMs : 10000;
        if (ttl > 0) {
          responseCache.set(cacheKey, { data, expiry: Date.now() + ttl });
        }
      }

      return data as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Network error or backend unreachable.';
      throw new ApiError(message, 0);
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  };

  if (isGet && !skipCache) {
    const promise = executeFetch();
    inFlightRequests.set(cacheKey, promise);
    return promise;
  }

  return executeFetch();
}

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
};
