// Tiny cookie-free referral-code capture helper.
//
// When a visitor lands on the site with `?ref=CODE`, we:
//   1. Pull the code out of the URL
//   2. Persist it in localStorage under a dedicated key
//   3. Fire a click-track ping to the backend (best-effort, no await)
//   4. Clean the URL so the next copy-paste doesn't look ugly
//
// On signup, the auth flow reads `getStoredReferralCode()` and includes
// it in the POST body so the backend can create the referral binding.
//
// The code survives across reloads but expires after 30 days so stale
// codes don't stick around forever.

const STORAGE_KEY = 'papergrid_referral_ref';
const EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const API_BASE = import.meta.env.VITE_API_URL || '';

interface StoredRef {
  code: string;
  capturedAt: number;
}

export function captureReferralFromUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get('ref');
    if (!raw) return;
    const code = raw.trim().toLowerCase().slice(0, 32);
    if (!code || !/^[a-z0-9_-]+$/.test(code)) return;

    // Persist (overwrites any prior ref so the latest link wins).
    const payload: StoredRef = { code, capturedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

    // Fire a click-track ping. Best-effort — we intentionally don't
    // await this so the page doesn't block on network.
    if (API_BASE) {
      void fetch(`${API_BASE}/api/referral/track-click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      }).catch(() => {
        // Swallow — click tracking is fire-and-forget
      });
    }

    // Clean the URL so the user sees a pretty link in the address bar.
    url.searchParams.delete('ref');
    const clean = url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : '') + url.hash;
    window.history.replaceState({}, '', clean);
  } catch {
    // ignore — URL parsing failure shouldn't break the page
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
