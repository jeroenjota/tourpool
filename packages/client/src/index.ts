import { reactive } from 'vue';

export interface Account {
  accountID: number; adrID: number; email: string; role: 'admin' | 'user';
}
export interface Profile {
  vNaam: string; tNaam: string; aNaam: string; plaats: string; tel: string;
}
export const emptyProfile = (): Profile => ({ vNaam: '', tNaam: '', aNaam: '', plaats: '', tel: '' });
export const auth = reactive<{ account: Account | null; csrfToken: string; checked: boolean }>({
  account: null, csrfToken: '', checked: false
});
const apiBase = import.meta.env.VITE_API_URL || '/api';
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

async function request(endpoint: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (auth.csrfToken && options.method && !['GET', 'HEAD'].includes(options.method.toUpperCase())) {
    headers.set('X-CSRF-Token', auth.csrfToken);
  }
  const response = await fetch(`${apiBase}${endpoint}`, { ...options, headers, credentials: 'include' });
  if (!response.ok) {
    if (response.status === 401) { auth.account = null; auth.csrfToken = ''; }
    let message = `HTTP ${response.status}: ${response.statusText}`;
    const contentType = response.headers.get('Content-Type');
    if (contentType?.includes('application/json')) {
      const data = await response.json();
      message = data.message || message;
      if (data.issues?.length) message += `: ${data.issues.map((issue: { path: string[]; message: string }) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`;
    }
    throw new ApiError(response.status, message);
  }
  return response;
}
export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await request(endpoint, options);
  if (response.status === 204) return undefined as T;
  return response.json();
}
export async function loadSession() {
  try {
    const session = await apiFetch<{ account: Account; csrfToken: string }>('/auth/session');
    Object.assign(auth, session, { checked: true });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    auth.checked = true;
  }
  return auth.account;
}
export async function login(email: string, password: string) {
  const session = await apiFetch<{ account: Account; csrfToken: string }>('/auth/login', {
    method: 'POST', body: JSON.stringify({ email, password })
  });
  Object.assign(auth, session, { checked: true });
}
export async function logout() {
  await apiFetch('/auth/logout', { method: 'POST' });
  auth.account = null;
  auth.csrfToken = '';
}
export async function downloadPdf(deelnID: number) {
  const response = await request(`/me/entries/${deelnID}/pdf`);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = `tourpool-inschrijving-${deelnID}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
