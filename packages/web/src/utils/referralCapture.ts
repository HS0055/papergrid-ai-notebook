// Tiny cookie-free referral-code capture helper.
//
// Supports TWO URL formats:
//
//   Path-based (preferred, user-facing shareable):
//     https://papergrid-five.vercel.app/r/hayk-xyz23
//     → URL is LEFT AS-IS in the address bar — the pretty path is the
//       whole point, and keeping it visible is proof to the visitor
//       that the invitation was received.
//
//   Query-based (legacy, still works for email/newsletter URLs):
//     https://papergrid-five.vercel.app/?ref=hayk-xyz23
//     → The `?ref=` is stripped via history.replaceState so the
//       address bar looks clean afterwards.
//
// Flow for both:
//   1. Pull the code out of the URL (path first, query second)
//   2. Clean the URL if it was query-based
//   3. Validate the code against /api/referral/lookup (best-effort)
//   4. Persist it in localStorage under a dedicated key
//   5. Fire a click-track ping — deduped per code in a 24h window so
//      page reloads don't inflate the counter
//
// On signup, the auth flow reads `getStoredReferralCode()` and includes
// it in the POST body so the backend can create the referral binding.
//
// The code survives across reloads but expires after 30 days so stale
// codes don't stick around forever.

const STORAGE_KEY = 'papergrid_referral_ref';
const CLICK_DEDUP_KEY = 'papergrid_referral_click_ttl';
const EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const CLICK_DEDUP_MS = 24 * 60 * 60 * 1000; // 24 hours

const API_BASE = import.meta.env.VITE_API_URL || '';

// Build an API URL. Uses VITE_API_URL when configured (cross-origin
// deployments) OR falls back to a relative path so same-origin
// deployments (Vercel rewrites, Netlify proxies) still work. The
// original version short-circuited when API_BASE was empty, which
// silently broke click tracking on same-origin setups.
function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

interface StoredRef {
  code: string;
  capturedAt: number;
}

interface ClickDedup {
  code: string;
  firedAt: number;
}

interface LookupResponse {
  valid: boolean;
  reason?: 'disabled' | 'not_found' | 'rate_limited' | 'missing';
  rewards?: {
    referrer: number;
    referred: number;
  };
}

// Matches `/r/<code>` as the entire path, with optional trailing slash.
// Code is 1-32 chars of the lowercase referral alphabet. Anchored so
// `/referral` and other paths starting with `/r` don't accidentally match.
const PATH_REFERRAL_REGEX = /^\/r\/([a-z0-9_-]{1,32})\/?$/i;

/**
 * Capture a referral code from the current URL and persist it.
 *
 * Async — callers can fire-and-forget. Errors are swallowed so the
 * page never breaks on a referral-path failure. Detects BOTH formats:
 *
 *   Path-based: `/r/<code>`  — URL stays as-is (preferred)
 *   Query-based: `?ref=<code>` — URL gets cleaned to look pretty
 */
export async function captureReferralFromUrl(): Promise<void> {
  if (typeof window === 'undefined') return;
  let code: string;
  try {
    const url = new URL(window.location.href);

    // Path takes precedence — it's the shareable format.
    const pathMatch = url.pathname.match(PATH_REFERRAL_REGEX);
    const pathCode = pathMatch ? pathMatch[1].toLowerCase() : null;
    const queryCode = url.searchParams.get('ref');

    const raw = pathCode ?? queryCode;
    if (!raw) return;
    const candidate = raw.trim().toLowerCase().slice(0, 32);
    if (!candidate || !/^[a-z0-9_-]+$/.test(candidate)) return;
    code = candidate;

    // Only clean the URL if we came in via `?ref=`. For path-based
    // `/r/<code>`, the URL IS the pretty format — stripping it would
    // defeat the purpose and leave the visitor wondering whether we
    // received the invitation.
    if (!pathCode && queryCode) {
      url.searchParams.delete('ref');
      const clean =
        url.pathname +
        (url.searchParams.toString() ? `?${url.searchParams}` : '') +
        url.hash;
      window.history.replaceState({}, '', clean);
    }
  } catch {
    return;
  }

  // Validate against the backend so typos/expired codes never pollute
  // localStorage. If the server is unreachable (network error, non-OK
  // response), we fall back to persisting optimistically — the signup
  // attribution path re-validates server-side anyway, so an invalid
  // code just no-ops there.
  let serverSaidInvalid = false;
  try {
    const res = await fetch(
      apiUrl(`/api/referral/lookup?code=${encodeURIComponent(code)}`),
      { method: 'GET' },
    );
    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as LookupResponse;
      if (!data.valid) serverSaidInvalid = true;
    }
  } catch {
    // Swallow — network failure means "unknown", not "invalid".
  }
  if (serverSaidInvalid) return;

  // Persist (overwrites any prior ref so the latest valid link wins).
  try {
    const payload: StoredRef = { code, capturedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // If localStorage is full or blocked, skip storage but still let
    // the click tracker fire below.
  }

  // Fire click tracking — deduped per code in a 24h window so reloads
  // don't inflate the counter. Server also rate-limits by IP as a
  // backstop.
  if (shouldFireClick(code)) {
    markClickFired(code);
    void fetch(apiUrl('/api/referral/track-click'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    }).catch(() => {
      // Swallow — click tracking is fire-and-forget
    });
  }
}

function shouldFireClick(code: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(CLICK_DEDUP_KEY);
    if (!raw) return true;
    const parsed = JSON.parse(raw) as Partial<ClickDedup>;
    if (parsed?.code !== code) return true;
    if (typeof parsed.firedAt !== 'number') return true;
    return Date.now() - parsed.firedAt > CLICK_DEDUP_MS;
  } catch {
    return true;
  }
}

function markClickFired(code: string): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: ClickDedup = { code, firedAt: Date.now() };
    localStorage.setItem(CLICK_DEDUP_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

/**
 * Returns the stored referral code if one exists and hasn't expired.
 * Call this from the signup form before POSTing credentials.
 */
export function getStoredReferralCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredRef>;
    if (!parsed?.code || typeof parsed.code !== 'string') return null;
    if (typeof parsed.capturedAt !== 'number') return null;
    if (Date.now() - parsed.capturedAt > EXPIRY_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed.code;
  } catch {
    return null;
  }
}

/**
 * Look up the reward info attached to a referral code so UIs can
 * render "🎁 You get X Ink" banners. Returns null on miss or network
 * error. Used by the landing-page referral banner.
 */
export async function lookupReferralReward(code: string): Promise<{
  referrer: number;
  referred: number;
} | null> {
  if (!code) return null;
  try {
    const res = await fetch(
      apiUrl(`/api/referral/lookup?code=${encodeURIComponent(code)}`),
      { method: 'GET' },
    );
    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as LookupResponse;
    if (!data.valid || !data.rewards) return null;
    return data.rewards;
  } catch {
    return null;
  }
}

/**
 * Clear the stored referral code after a successful signup so we don't
 * keep re-attributing future signups from the same browser.
 */
export function clearStoredReferralCode(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
