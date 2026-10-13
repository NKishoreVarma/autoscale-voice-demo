// Thin API client. Attaches the Firebase ID token as a Bearer token on every
// request so the backend can verify the admin server-side.
import { appConfig } from './config.js';

let tokenGetter = async () => null;
export function setTokenGetter(fn) {
  tokenGetter = fn;
}

async function request(path, { method = 'GET', body } = {}) {
  const token = await tokenGetter();
  const res = await fetch(`${appConfig.apiBaseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = data?.code;
    throw err;
  }
  return data;
}

export const api = {
  status: () => request('/api/status'),
  listCalls: () => request('/api/voice/calls'),
  getCall: (id) => request(`/api/voice/calls/${id}`),
  createCall: (payload) => request('/api/voice/calls', { method: 'POST', body: payload }),
};
