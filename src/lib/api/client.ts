const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const API_REQUEST_HEADER = 'x-lawguide-request';

/** Adds the application request marker to state-changing same-origin calls. */
export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase();
  if (SAFE_METHODS.has(method)) return fetch(input, init);

  const headers = new Headers(init.headers);
  headers.set(API_REQUEST_HEADER, '1');
  return fetch(input, { ...init, headers });
}
