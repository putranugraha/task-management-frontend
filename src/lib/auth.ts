// lib/auth.ts

import { getApiBaseUrl, shouldProxyApiThroughNext, shouldUseSanctum } from './config';
import { apiRequest } from './api';

// Attempt auto-login if enabled by env/flags.
// Return true if login succeeded and token is present; otherwise false.
export async function autoLoginIfEnabled(): Promise<boolean> {
  try {
    if (typeof window === 'undefined') return false;

    // if already have token, treat as logged in
    const existing = localStorage.getItem('access_token');
    if (existing) return true;

    const enabled = (process.env.NEXT_PUBLIC_AUTO_LOGIN || '').toLowerCase();
    if (!(enabled === '1' || enabled === 'true')) return false;

    const email = process.env.NEXT_PUBLIC_AUTO_EMAIL || '';
    const password = process.env.NEXT_PUBLIC_AUTO_PASSWORD || '';
    if (!email || !password) return false;

    // Prefer axios pipeline which handles CSRF and withCredentials under Sanctum
    let data: any;
    try {
      data = await apiRequest<any>('POST', '/api/login', { email, password });
    } catch (e) {
      // Fallback to fetch if axios path fails (e.g., misconfig)
      const base = shouldProxyApiThroughNext() ? '' : getApiBaseUrl();
      const resp = await fetch(`${base}/api/login`, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        credentials: shouldUseSanctum() ? 'include' : 'same-origin',
        body: JSON.stringify({ email, password }),
      });
      if (!resp.ok) return false;
      data = await resp.json();
    }

    // Try common token fields: token or access_token
    const token: string | undefined = data?.token || data?.access_token;
    const tokenType: string = data?.token_type || 'Bearer';
    if (token) {
      localStorage.setItem('access_token', token);
      localStorage.setItem('token_type', tokenType);
      if (data?.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
