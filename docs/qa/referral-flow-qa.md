# Referral flow — QA checklist

Manual verification playbook for the end-to-end user referral program. Run this against a production or preview Vercel deployment after deploying the latest Convex functions.

Prerequisites:
- Two browsers (or one browser + one incognito window) so you can act as both the referrer and the referred user.
- Admin access to `/admin → Referrals` tab.
- A Stripe-unaware test account is fine — the program works in pure freemium mode.

---

## 1. Referrer provisioning

- [ ] Log in as **User A** (the would-be referrer).
- [ ] Navigate to `/referral` via the Dashboard nav (`Dashboard.tsx:1737`).
- [ ] A unique code is provisioned on first visit (e.g. `hayk23kx`).
- [ ] The hero card shows the current reward amounts from admin config (default 25 / 25).
- [ ] The referral link shows `<origin>/r/<code>` (path-based — no query string). The Copy button turns green on click.
- [ ] The stats grid reads `Clicks: 0 · Signups: 0 · Qualified: 0 · Ink earned: 0`.

**If this fails:** check `/api/referral/ensure-code` in Network tab, confirm `referralCodes` table has a row for User A.

---

## 2a. Path-based URL capture (`/r/<code>` — primary format)

- [ ] In an **incognito window**, paste the copied link: `<origin>/r/<code>`.
- [ ] The address bar **stays at** `/r/<code>` — the URL is **not** cleaned (this is by design; the pretty path is the share format).
- [ ] DevTools → Application → Local Storage shows key `papergrid_referral_ref` with `{"code":"<code>","capturedAt":<ms>}`.
- [ ] DevTools → Application → Local Storage also shows key `papergrid_referral_click_ttl` with `{"code":"<code>","firedAt":<ms>}`.
- [ ] Network tab shows `GET /api/referral/lookup?code=<code>` → 200 `{valid:true, rewards:{...}}`.
- [ ] Network tab shows `POST /api/referral/track-click` → 200 `{ok:true}`.
- [ ] The floating **ReferralBanner** card slides up from bottom-right within ~1s: "A friend sent you 25 free Ink" with a "Claim 25 Ink →" button and a "Details" link.
- [ ] The landing page renders normally underneath — no NavBar collision.
- [ ] Go back to User A's `/referral` page and click **Refresh** on the stat grid — `Clicks` should now read `1`.

## 2b. Query-based URL capture (`?ref=<code>` — legacy fallback)

- [ ] In a fresh incognito window, visit `<origin>/?ref=<code>`.
- [ ] Within 1 second the address bar URL is cleaned to `<origin>/` (the `?ref=` **is** stripped, because query-based URLs get sanitized for aesthetics).
- [ ] Same localStorage + network checks as 2a pass.
- [ ] Banner renders identically to 2a.

**If clicks don't increment:** confirm `VITE_API_URL` is set (or the relative path reaches the Convex HTTP router). Check the rate-limit ceiling in `referrals.track_click_ip` (30/min/IP).

---

## 3. Click dedup

- [ ] With the incognito window still open, hit refresh 5 times.
- [ ] Network tab should show `POST /api/referral/track-click` **only on the first load** — the next 4 refreshes skip the fetch because the 24h dedup window is active.
- [ ] User A's `Clicks` stat still reads `1` on refresh.
- [ ] Edit localStorage: delete `papergrid_referral_click_ttl`, reload the page. The POST fires again and `Clicks` bumps to `2`.

---

## 4. Capture-time validation

- [ ] In a fresh incognito window, visit `<origin>/?ref=thiscodeisnotreal`.
- [ ] Network tab shows `GET /api/referral/lookup?code=thiscodeisnotreal` → 200 `{valid:false, reason:"not_found"}`.
- [ ] Local Storage does **not** contain `papergrid_referral_ref`.
- [ ] No `POST /api/referral/track-click` was fired.
- [ ] The landing page renders with **no** referral banner.
- [ ] URL is cleaned to `<origin>/` regardless.

---

## 5. Signup attribution

- [ ] In the incognito window from step 2 (with valid code stored), click **Sign up** and complete the form as **User B**.
- [ ] Network tab: `POST /api/auth/signup` request body contains `"referralCode":"<code>"`.
- [ ] Response is 200.
- [ ] Local Storage: `papergrid_referral_ref` is **removed** (cleared by `clearStoredReferralCode` on success).
- [ ] Log in as Admin, open `/admin → Referrals → Redemptions` tab.
- [ ] A new row appears: `User A → User B`, status badge matches the configured qualifying action:
  - **signup** (default) → `qualified` (green)
  - **first_notebook** → `pending` (amber)
  - **first_ink_spend** → `pending` (amber)

---

## 6. Reward payout (qualifying action = `signup`)

- [ ] Admin config is on default `signup`.
- [ ] As User B, check the Ink wallet indicator — it should show the base free-plan grant **plus 25 bonus Ink**.
- [ ] User B's Ink transactions (Dashboard → Ink history, if surfaced) show a `reward` row: "Referral bonus — you were invited".
- [ ] As User A, refresh `/referral`. Stats now read `Clicks: 1+ · Signups: 1 · Qualified: 1 · Ink earned: 25`.
- [ ] User A's Ink wallet shows the +25 bonus as well.
- [ ] The "Your recent referrals" section on User A's `/referral` shows the new row tagged `qualified`.

---

## 7. Deferred qualifying action (first_notebook)

- [ ] As Admin, change qualifying action to `first_notebook` and save config.
- [ ] Create a fresh User C signed up with User A's link.
- [ ] Redemption is `pending` — User C has **no** referral bonus yet.
- [ ] As User C, create a first notebook (any title, cover).
- [ ] The redemption flips to `qualified`. User C and User A both receive +25 Ink.
- [ ] Creating a **second** notebook is a no-op — `onQualifyingEventInternal` is idempotent.

**If this fails:** the hook in `notebooks.ts` create mutation isn't firing. Verify `internal.referrals.onQualifyingEventInternal` is imported and wrapped in try/catch.

---

## 8. Deferred qualifying action (first_ink_spend)

- [ ] As Admin, change qualifying action to `first_ink_spend` and save config.
- [ ] Fresh User D signs up with the link → redemption is `pending`.
- [ ] As User D, trigger any Ink-costing action (AI layout generation, cover generation).
- [ ] `spendInk` fires → redemption flips to `qualified` → both sides get +25 Ink.
- [ ] A **second** ink-spend is a no-op.

---

## 9. Self-referral guard

- [ ] Log back in as User A.
- [ ] Paste User A's own referral link in the same browser → URL is cleaned, code stored.
- [ ] Navigate to `/referral`. An amber notice appears: "That's your own referral link."
- [ ] Local Storage: `papergrid_referral_ref` is now cleared.
- [ ] Even if you manually re-store the code and retry signup, the backend `attachOnSignupInternal` short-circuits via `if (referralRow.userId === userId) return null;` — no redemption row is ever created.

---

## 10. First-referral-wins

- [ ] Fresh User E visits with `?ref=<codeA>` → localStorage has codeA.
- [ ] Without signing up, they visit `?ref=<codeB>` → localStorage now has codeB (latest valid wins).
- [ ] User E signs up → attributed to **User B** only.
- [ ] Old attempts to re-attach on a future signup are blocked by the `by_referred` index guard in `attachOnSignupInternal`.

---

## 11. Admin config knobs

- [ ] Admin panel → Referrals → change `Referrer reward` to `50`, save.
- [ ] Fresh signup with a ref link → both sides receive 50 Ink (not 25).
- [ ] Reset to 25.
- [ ] Toggle `Enabled` off → `lookupCode` returns `{valid:false, reason:"disabled"}`.
- [ ] Landing page with `?ref=<code>` while disabled → no banner, no stored code, no attribution.
- [ ] Toggle back on → flow resumes.

---

## 12. Admin void + rollback

- [ ] From `Redemptions` tab, find a `qualified` row and click **Void**.
- [ ] Supply a reason ("QA test").
- [ ] Row status flips to `voided`.
- [ ] Both User A and the referred user have their Ink decremented by the stored `referrerInkReward` / `referredInkReward`.
- [ ] User A's aggregate `Qualified` and `Ink earned` stats drop by the voided amount.
- [ ] `adminAuditLog` table has a `referrals.adminVoidRedemption` entry with the reason.

---

## 13. Rate limiting sanity

- [ ] Hit `/api/referral/track-click` 40 times in under a minute from one IP via `curl`.
- [ ] After ~30 calls, responses return 429 `{ok:false, reason:"rate_limited"}`.
- [ ] Same for `/api/referral/lookup` at the 30/min ceiling.

---

## 14. Landing banner dismissal

- [ ] Fresh incognito window, visit with a valid `?ref=<code>`.
- [ ] Banner renders.
- [ ] Click the X in the banner → it disappears.
- [ ] SessionStorage: `papergrid_referral_banner_dismissed=1`.
- [ ] Navigate within the landing page (scroll, click nav) → banner stays dismissed.
- [ ] Open a new tab and visit with the same `?ref=` → banner re-appears (sessionStorage is per-tab).

---

## 15. Signup when backend is unreachable

- [ ] DevTools → Network → Offline mode.
- [ ] Visit with `?ref=<validcode>` — lookup fails with network error.
- [ ] Per the fallback branch in `referralCapture.ts`, the code is **persisted optimistically** (we don't punish the user for transient network).
- [ ] Turn network back on and sign up — attribution still works because the code is in localStorage and the signup POST includes it.

---

## Sign-off

- [ ] All 15 sections pass on at least one fresh browser profile.
- [ ] No errors in DevTools console during any step.
- [ ] Admin audit log reflects all config changes + voids performed during this QA.
- [ ] Verified against Convex deployment: `_________________`
- [ ] Verified by: `_________________`
- [ ] Date: `_________________`
