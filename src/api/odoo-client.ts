import { Config } from '@/config';

import { getCookieHeader, splitSetCookieHeader, storeResponseCookies } from './cookie-jar';

/**
 * Minimal HTTP client for the Odoo backend.
 *
 * Every request:
 * - is sent to `Config.odooBaseUrl` + path
 * - turns OFF the platform's native cookie handling (`credentials: 'omit'`) and attaches cookies
 *   from our own persistent jar instead (see cookie-jar.ts for why)
 * - does NOT auto-follow redirects (`redirect: 'manual'`), so the Set-Cookie on each redirect
 *   response is captured. Pass `followRedirects: true` to follow them here, hop by hop.
 *
 * Mobile only: in a web browser, cookies and redirect responses are hidden from JavaScript, so
 * this client does not work on web.
 */

const MAX_REDIRECTS = 5;

export type OdooRequestOptions = {
  method?: 'GET' | 'POST';
  /** Sent as application/x-www-form-urlencoded (how Odoo's HTML form routes expect it). */
  form?: Record<string, string>;
  /** Sent as multipart/form-data (for forms with file uploads). */
  formData?: FormData;
  /** Sent as application/json. */
  json?: unknown;
  followRedirects?: boolean;
};

export type OdooResponse = {
  status: number;
  /** Absolute URL of the final response. */
  url: string;
  /** Absolute redirect target when the response is a 3xx that wasn't followed. */
  location?: string;
  text: () => Promise<string>;
};

export function odooUrl(path: string): string {
  return new URL(path, `${Config.odooBaseUrl}/`).toString();
}

function readSetCookie(headers: Headers): string[] {
  const withGetSetCookie = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof withGetSetCookie.getSetCookie === 'function') {
    return withGetSetCookie.getSetCookie();
  }
  const combined = headers.get('set-cookie');
  return combined ? splitSetCookieHeader(combined) : [];
}

export async function odooRequest(
  path: string,
  { method = 'GET', form, formData, json, followRedirects = false }: OdooRequestOptions = {}
): Promise<OdooResponse> {
  let url = odooUrl(path);
  let currentMethod = method;
  let body: string | FormData | undefined;
  let contentType: string | undefined;
  if (form) {
    body = new URLSearchParams(form).toString();
    contentType = 'application/x-www-form-urlencoded';
  } else if (formData) {
    body = formData; // fetch sets multipart/form-data with its boundary itself.
  } else if (json !== undefined) {
    body = JSON.stringify(json);
    contentType = 'application/json';
  }

  for (let hop = 0; ; hop++) {
    const headers: Record<string, string> = { Accept: 'text/html,application/json' };
    const cookie = await getCookieHeader(url);
    if (cookie) {
      headers.Cookie = cookie;
    }
    if (body !== undefined && contentType) {
      headers['Content-Type'] = contentType;
    }

    const response = await fetch(url, {
      method: currentMethod,
      headers,
      body,
      credentials: 'omit',
      redirect: 'manual',
    });
    await storeResponseCookies(url, readSetCookie(response.headers));

    const locationHeader = response.headers.get('location');
    const location = locationHeader ? new URL(locationHeader, url).toString() : undefined;
    const isRedirect = response.status >= 300 && response.status < 400 && location;

    if (!isRedirect || !followRedirects) {
      return { status: response.status, url, location, text: () => response.text() };
    }
    if (hop >= MAX_REDIRECTS) {
      throw new Error(`Too many redirects starting from ${path}`);
    }
    // Redirects (other than 307/308) turn into a GET without a body, as in browsers.
    if (response.status !== 307 && response.status !== 308) {
      currentMethod = 'GET';
      body = undefined;
      contentType = undefined;
    }
    url = location;
  }
}

/** Odoo JSON-RPC error (the response had an `error` member instead of `result`). */
export class OdooRpcError extends Error {}

/**
 * Calls an Odoo `type="json"` route the way Odoo's web client does:
 * POST {jsonrpc: "2.0", method: "call", params} and return `result`.
 */
export async function odooJsonRpc<T>(path: string, params: object): Promise<T> {
  const response = await odooRequest(path, {
    method: 'POST',
    json: { jsonrpc: '2.0', method: 'call', params, id: Date.now() },
  });
  const data = JSON.parse(await response.text()) as {
    result?: T;
    error?: { message?: string; data?: { message?: string } };
  };
  if (__DEV__) {
    // Development builds only: shows each JSON-RPC route and the backend's reply in the Metro
    // terminal (params are not logged — they can contain emails, phone numbers and codes).
    console.log(`[odoo rpc] ${path} → HTTP ${response.status}`, JSON.stringify(data.error ?? data.result));
  }
  if (data.error) {
    throw new OdooRpcError(data.error.data?.message || data.error.message || 'Odoo RPC error');
  }
  return data.result as T;
}
