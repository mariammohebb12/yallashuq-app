import * as SecureStore from 'expo-secure-store';

/**
 * Persistent cookie jar for the Odoo session.
 *
 * Why not the platform's built-in cookie handling: the Odoo session cookie (`session_id`) is
 * rotated on the login response itself, which is a redirect. We make requests with native
 * cookies and redirects disabled (see odoo-client.ts) so we can read that `Set-Cookie`, store it
 * here, and keep the same session — guest cart included — across app restarts.
 *
 * Stored in SecureStore (Keychain / Keystore) because `session_id` is a login credential.
 */

type StoredCookie = {
  name: string;
  value: string;
  domain: string;
  /** true when the server sent no Domain attribute: only sent back to that exact host. */
  hostOnly: boolean;
  path: string;
  secure: boolean;
  /** Epoch ms; undefined for a session cookie (kept until the server replaces or clears it). */
  expiresAt?: number;
};

const STORAGE_KEY = 'odoo_cookie_jar_v1';

let cookies: StoredCookie[] | null = null;
let loading: Promise<StoredCookie[]> | null = null;

function loadCookies(): Promise<StoredCookie[]> {
  if (cookies) {
    return Promise.resolve(cookies);
  }
  // Share one read between concurrent callers so they all mutate the same array.
  loading ??= (async () => {
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      cookies = raw ? (JSON.parse(raw) as StoredCookie[]) : [];
    } catch {
      cookies = [];
    }
    return cookies;
  })();
  return loading;
}

async function saveCookies(): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(cookies ?? []));
}

function isExpired(cookie: StoredCookie, now = Date.now()): boolean {
  return cookie.expiresAt !== undefined && cookie.expiresAt <= now;
}

function defaultPath(url: URL): string {
  const path = url.pathname;
  if (!path.startsWith('/') || path.lastIndexOf('/') === 0) {
    return '/';
  }
  return path.slice(0, path.lastIndexOf('/'));
}

function domainMatches(cookie: StoredCookie, host: string): boolean {
  if (cookie.hostOnly) {
    return host === cookie.domain;
  }
  return host === cookie.domain || host.endsWith(`.${cookie.domain}`);
}

function pathMatches(cookiePath: string, requestPath: string): boolean {
  if (requestPath === cookiePath) {
    return true;
  }
  return (
    requestPath.startsWith(cookiePath) &&
    (cookiePath.endsWith('/') || requestPath.charAt(cookiePath.length) === '/')
  );
}

/** Parses one Set-Cookie header value (RFC 6265 §5.2). Returns null if malformed. */
function parseSetCookie(header: string, requestUrl: URL, now: number): StoredCookie | null {
  const [nameValue, ...attributes] = header.split(';');
  const separator = nameValue.indexOf('=');
  if (separator <= 0) {
    return null;
  }
  const cookie: StoredCookie = {
    name: nameValue.slice(0, separator).trim(),
    value: nameValue.slice(separator + 1).trim(),
    domain: requestUrl.hostname,
    hostOnly: true,
    path: defaultPath(requestUrl),
    secure: false,
  };

  let maxAge: number | undefined;
  let expires: number | undefined;
  for (const attribute of attributes) {
    const eq = attribute.indexOf('=');
    const key = (eq === -1 ? attribute : attribute.slice(0, eq)).trim().toLowerCase();
    const value = eq === -1 ? '' : attribute.slice(eq + 1).trim();
    if (key === 'max-age' && /^-?\d+$/.test(value)) {
      maxAge = Number(value);
    } else if (key === 'expires') {
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) {
        expires = parsed;
      }
    } else if (key === 'domain' && value) {
      const domain = value.replace(/^\./, '').toLowerCase();
      if (!domainMatches({ ...cookie, domain, hostOnly: false }, requestUrl.hostname)) {
        return null; // A server may not set cookies for a domain it doesn't belong to.
      }
      cookie.domain = domain;
      cookie.hostOnly = false;
    } else if (key === 'path' && value.startsWith('/')) {
      cookie.path = value;
    } else if (key === 'secure') {
      cookie.secure = true;
    }
  }
  // Max-Age takes precedence over Expires.
  if (maxAge !== undefined) {
    cookie.expiresAt = now + maxAge * 1000;
  } else if (expires !== undefined) {
    cookie.expiresAt = expires;
  }
  return cookie;
}

/**
 * Splits a combined Set-Cookie header. Platforms may join multiple Set-Cookie headers with ", ",
 * and Expires dates also contain a comma ("Sat, 25 Sep 2027 ..."), so only split on a comma that
 * is followed by the start of a new "name=" pair.
 */
export function splitSetCookieHeader(combined: string): string[] {
  return combined
    .split(/,(?=\s*[^;,=\s]+=)/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Stores the cookies from a response's Set-Cookie headers. */
export async function storeResponseCookies(requestUrl: string, setCookieHeaders: string[]) {
  if (setCookieHeaders.length === 0) {
    return;
  }
  const jar = await loadCookies();
  const url = new URL(requestUrl);
  const now = Date.now();
  for (const header of setCookieHeaders) {
    const cookie = parseSetCookie(header, url, now);
    if (!cookie) {
      continue;
    }
    const existing = jar.findIndex(
      (c) => c.name === cookie.name && c.domain === cookie.domain && c.path === cookie.path
    );
    if (existing !== -1) {
      jar.splice(existing, 1);
    }
    // An already-expired cookie is how a server deletes one (e.g. on logout).
    if (!isExpired(cookie, now)) {
      jar.push(cookie);
    }
  }
  await saveCookies();
}

/** Builds the Cookie request header for `requestUrl`, or undefined if no cookies apply. */
export async function getCookieHeader(requestUrl: string): Promise<string | undefined> {
  const jar = await loadCookies();
  const url = new URL(requestUrl);
  const now = Date.now();
  const matching = jar
    .filter(
      (c) =>
        !isExpired(c, now) &&
        domainMatches(c, url.hostname) &&
        pathMatches(c.path, url.pathname) &&
        (!c.secure || url.protocol === 'https:')
    )
    // Longer paths first, as browsers do.
    .sort((a, b) => b.path.length - a.path.length);
  if (matching.length === 0) {
    return undefined;
  }
  return matching.map((c) => `${c.name}=${c.value}`).join('; ');
}

/** Removes every stored cookie (e.g. for a future logout or account deletion). */
export async function clearCookies(): Promise<void> {
  cookies = [];
  await saveCookies();
}
