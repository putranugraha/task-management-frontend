// lib/api.ts
import axios, { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { autoLoginIfEnabled } from './auth';
import { getApiBaseUrl, shouldProxyApiThroughNext, shouldUseSanctum } from './config';

// Note: We'll still override baseURL per-request to ensure runtime correctness
// across SSR/CSR and stale builds.
const API_BASE_URL = shouldProxyApiThroughNext() ? '' : getApiBaseUrl();
const USE_SANCTUM = shouldUseSanctum();

// Small cookie helper (browser only)
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

// 1. Buat Axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
  withCredentials: USE_SANCTUM, // include cookies for Sanctum when proxying
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
  timeout: 30000,
  proxy: false,
});

// 2. Interceptor: tambahkan Bearer token jika ada
api.interceptors.request.use((config: InternalAxiosRequestConfig<unknown>) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    // In Sanctum mode, explicitly set XSRF header from cookie if present
    if (USE_SANCTUM && config.headers) {
      const xsrf = getCookie('XSRF-TOKEN');
      if (xsrf) {
        config.headers['X-XSRF-TOKEN'] = xsrf;
      }
    }
  }
  // If sending FormData, let the browser set the Content-Type (with boundary)
  if (config.data && typeof FormData !== 'undefined' && config.data instanceof FormData) {
    if (config.headers) {
      delete (config.headers as any)['Content-Type'];
      delete (config.headers as any)['content-type'];
    }
  }
  return config;
});

async function ensureCsrfCookie(): Promise<void> {
  if (typeof window === 'undefined') return; // SSR: skip
  if (!USE_SANCTUM) return; // Only relevant for Sanctum session mode
  const token = getCookie('XSRF-TOKEN');
  if (token) return;
  try {
    const base = shouldProxyApiThroughNext() ? '' : getApiBaseUrl();
    try {
      await api.get('/sanctum/csrf-cookie', { baseURL: base });
    } catch {
      await api.get('/csrf-cookie', { baseURL: base });
    }
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[api] Failed to prefetch CSRF cookie:', e);
    }
  }
}

// 3. Helper function apiRequest<T>
export async function apiRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  url: string,
  data?: Record<string, unknown> | FormData,
  config?: AxiosRequestConfig
): Promise<T> {
  try {
    // Detect common auth endpoints
    const isAuthRoute = /\/api\/(login|register|forgot-password|reset-password)$/i.test(url) || /^(\/login|\/register)$/i.test(url);

    // In Sanctum (stateful) mode, Laravel may apply CSRF verification to requests from
    // SANCTUM_STATEFUL_DOMAINS (even for /api/*). To avoid 419, ensure CSRF cookie exists and
    // send credentials for state-changing requests, including auth endpoints.
    const shouldSendStateful = USE_SANCTUM && method !== 'GET' && typeof window !== 'undefined';
    if (shouldSendStateful) {
      await ensureCsrfCookie();
    }
    // Resolve base dynamically per request (handles SSR/CSR and localhost heuristics)
    const resolvedBase = shouldProxyApiThroughNext() ? '' : getApiBaseUrl();
    if (process.env.NODE_ENV !== 'production') {
      const fullUrlForLog = url.startsWith('http') ? url : `${resolvedBase}${url}`;
      console.log(`[api] ${method} ${fullUrlForLog}`);
      console.log('[api] Base URL:', resolvedBase || '(relative via Next proxy)');
      console.log('[api] Request config:', { method, url, data, config });
    }
    
    const response = await api({
      method,
      url,
      data,
      baseURL: resolvedBase,
      // In Sanctum mode, send cookies so CSRF validation passes when stateful is applied
      withCredentials: shouldSendStateful ? true : api.defaults.withCredentials,
      ...config,
    });
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Successful response from ${url}`, response.status);
      console.log('Response data:', response.data);
    }
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as { 
      message?: string; 
      response?: { status?: number }; 
      config?: unknown 
    };
    if (process.env.NODE_ENV !== 'production') {
      console.error(`Error in apiRequest to ${url}:`, axiosError.message || 'Unknown error');
      console.error('Full error object:', error);
      console.error('Error response:', axiosError.response);
      console.error('Error config:', axiosError.config);
    }
    
    // If we get a 500 error, try alternative approaches
    if (axiosError.response?.status === 500) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Received 500 error, trying alternative approaches...');
      }
      const retryBase = shouldProxyApiThroughNext() ? '' : getApiBaseUrl();
      
      // Try 1: Direct fetch without axios
      try {
        if (process.env.NODE_ENV !== 'production') {
          console.log('Attempting direct fetch...');
        }
        const fullUrl = url.startsWith('http') ? url : `${retryBase}${url}`;
        const fetchResponse = await fetch(fullUrl, {
          method,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          credentials: USE_SANCTUM ? 'include' : 'same-origin',
          body: data ? JSON.stringify(data) : undefined,
        });
        
        if (fetchResponse.ok) {
          const fetchData = await fetchResponse.json();
          if (process.env.NODE_ENV !== 'production') {
            console.log('Direct fetch successful:', fetchData);
          }
        return fetchData as T;
      } else {
          if (process.env.NODE_ENV !== 'production') {
            console.error('Direct fetch failed:', fetchResponse.status, fetchResponse.statusText);
          }
        }
      } catch (fetchError) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('Direct fetch error:', fetchError);
        }
      }
      
      // Try 2: XHR fallback
      if (method === 'GET') {
        if (process.env.NODE_ENV !== 'production') {
          console.log('Attempting XHR fallback...');
        }
        return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          const fullUrl = url.startsWith('http') ? url : `${retryBase}${url}`;
          
          xhr.open(method, fullUrl, true);
          xhr.setRequestHeader('Accept', 'application/json');
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
          
          xhr.withCredentials = USE_SANCTUM;
          xhr.timeout = 30000;
          
          xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const response = JSON.parse(xhr.responseText);
                if (process.env.NODE_ENV !== 'production') {
                  console.log('XHR fallback successful', response);
                }
                resolve(response as T);
              } catch (e) {
                reject(new Error(`JSON parse error: ${e}`));
              }
            } else {
              reject(new Error(`HTTP error status: ${xhr.status}`));
            }
          };
          
          xhr.onerror = function() {
            console.error('XHR error occurred');
            reject(new Error('Network error occurred'));
          };
          
          xhr.ontimeout = function() {
            reject(new Error('Request timed out'));
          };
          
          xhr.send();
        });
      }
    }
    
    // If axios fails and no fallback worked, try with native fetch as fallback
    if (!axiosError.response && method === 'GET') {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Attempting fallback with XHR');
      }
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const resolvedBase = shouldProxyApiThroughNext() ? '' : getApiBaseUrl();
        const fullUrl = url.startsWith('http') ? url : `${resolvedBase}${url}`;
        
        xhr.open(method, fullUrl, true);
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        
        xhr.withCredentials = USE_SANCTUM;
        xhr.timeout = 30000;
        
        xhr.onload = function() {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              console.log('XHR fallback successful', response);
              resolve(response as T);
            } catch (e) {
              reject(new Error(`JSON parse error: ${e}`));
            }
          } else {
            reject(new Error(`HTTP error status: ${xhr.status}`));
          }
        };
        
        xhr.onerror = function() {
            if (process.env.NODE_ENV !== 'production') {
              console.error('XHR error occurred');
            }
            reject(new Error('Network error occurred'));
        };
        
        xhr.ontimeout = function() {
          reject(new Error('Request timed out'));
        };
        
        xhr.send();
      });
    }
    
    throw error;
  }
}

// 4. Error handler global untuk menangani token expired
api.interceptors.response.use(
  (response) => response,
  async (error: { response?: { status?: number; data?: unknown }; code?: string; message?: string; config?: any }) => {
    // Log error details for debugging
    console.error('API Error:', {
      message: error.message,
      config: error.config,
      status: error.response?.status,
      data: error.response?.data
    });

    // Handle unauthorized by attempting auto-login once
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // Try auto-login once, then retry original request
      try {
        const ok = await autoLoginIfEnabled();
        if (ok && error.config) {
          // Update Authorization header if token-based
          const token = localStorage.getItem('access_token');
          if (token) {
            error.config.headers = error.config.headers || {};
            error.config.headers['Authorization'] = `Bearer ${token}`;
          }
          return api.request(error.config);
        }
      } catch {}

      // If still unauthorized: clean storage and redirect
      localStorage.removeItem('access_token');
      localStorage.removeItem('token_type');
      localStorage.removeItem('user');
      window.location.href = '/auth/login';
    }

    // Handle Laravel Sanctum CSRF mismatch (419) by fetching a new CSRF cookie
    if (error.response?.status === 419 && typeof window !== 'undefined' && error.config) {
      // Prevent infinite retry loops
      if ((error.config as any)._retriedCsrf) {
        return Promise.reject(error);
      }
      try {
        try {
          await apiRequest('GET', '/sanctum/csrf-cookie');
        } catch {
          // Some setups expose it at /csrf-cookie
          await apiRequest('GET', '/csrf-cookie');
        }

        const retryConfig = { ...error.config, _retriedCsrf: true };
        // Ensure headers exist and include X-Requested-With for Laravel
        retryConfig.headers = retryConfig.headers || {};
        retryConfig.headers['X-Requested-With'] = 'XMLHttpRequest';
        return api.request(retryConfig);
      } catch (csrfErr) {
        console.error('Failed to refresh CSRF cookie:', csrfErr);
      }
    }
    
    if (error.code === 'ECONNABORTED') {
      console.error('Request timeout - consider increasing the timeout value');
    }
    
    if (!error.response) {
      console.error('Network error - check your internet connection or API endpoint availability');
    }
    
    return Promise.reject(error);
  }
);

// 5. Export default instance dan apiRequest
export default api;
