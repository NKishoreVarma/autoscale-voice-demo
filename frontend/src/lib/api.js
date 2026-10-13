// API client. Attaches the Firebase ID token as a Bearer token so the backend can
// verify the admin server-side. Produces a typed ApiError so the UI can show safe,
// specific messages (never a raw "Failed to fetch" or a server stack trace).
import { appConfig } from './config.js';

// token getter returns a (possibly cached) ID token; refresher forces a new one.
let getToken = async () => null;
let refreshToken = async () => null;
export function setTokenProviders({ get, refresh }) {
  if (get) getToken = get;
  if (refresh) refreshToken = refresh;
}

export class ApiError extends Error {
  constructor(kind, message, { status, code } = {}) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind; // network | unauthorized | forbidden | not_found | rate_limited | validation | provider_unavailable | server | unknown
    this.status = status;
    this.code = code;
  }
}

function kindForStatus(status, code) {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'validation';
  if (status === 422) return 'validation';
  if (status === 429) return 'rate_limited';
  if (status === 503 && code === 'PROVIDER_NOT_CONFIGURED') return 'provider_unavailable';
  if (status >= 500) return 'server';
  return 'unknown';
}

function joinUrl(base, path) {
  return `${String(base).replace(/\/+$/, '')}/${String(path).replace(/^\/+/, '')}`;
}

async function doFetch(path, { method, body, token }) {
  const url = joinUrl(appConfig.apiBaseUrl, path);
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // fetch() rejects only on network/CORS/DNS failures — never leak the raw error.
    throw new ApiError(
      'network',
      'Cannot reach the API. Check your connection, the backend URL, or that the server is awake.'
    );
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty/non-JSON body */
  }
  if (!res.ok) {
    throw new ApiError(kindForStatus(res.status, data?.code), data?.error || `Request failed (${res.status})`, {
      status: res.status,
      code: data?.code,
    });
  }
  return data;
}

async function request(path, { method = 'GET', body } = {}) {
  const token = await getToken();
  try {
    return await doFetch(path, { method, body, token });
  } catch (err) {
    // One retry with a force-refreshed token if the token was expired/stale.
    if (err instanceof ApiError && err.kind === 'unauthorized') {
      const fresh = await refreshToken().catch(() => null);
      if (fresh && fresh !== token) {
        return doFetch(path, { method, body, token: fresh });
      }
    }
    throw err;
  }
}

export const api = {
  status: () => request('/api/status'),
  listCalls: () => request('/api/voice/calls'),
  getCall: (id) => request(`/api/voice/calls/${encodeURIComponent(id)}`),
  createCall: (payload) => request('/api/voice/calls', { method: 'POST', body: payload }),
};

// Human-friendly message for an error (ApiError or otherwise), for toasts/banners.
export function describeError(err) {
  if (err instanceof ApiError) {
    switch (err.kind) {
      case 'network':
        return err.message;
      case 'unauthorized':
        return 'Your session has expired. Please sign in again.';
      case 'forbidden':
        return err.message; // e.g. email not verified / not authorized
      case 'rate_limited':
        return err.message || 'Too many requests — please wait a moment.';
      case 'validation':
        return err.message || 'The request was invalid.';
      case 'provider_unavailable':
        return 'The voice provider is not fully configured on the server.';
      case 'server':
        return 'The server encountered an error. Please try again.';
      default:
        return err.message || 'Something went wrong.';
    }
  }
  return err?.message || 'Something went wrong.';
}
