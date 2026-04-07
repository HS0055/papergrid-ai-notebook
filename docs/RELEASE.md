# Release Workflow

Two long-lived branches. One mental model.

```
main         ←  active development. all features ON. push freely.
                ↳ Vercel deploys to PREVIEW URL.

production   ←  what users see. only stable, tested code.
                hex/iso/music render as "Coming Soon" placeholders.
                ↳ Vercel deploys to REAL PRODUCTION URL.
```

---

## Daily workflow

1. **Work on `main`**
   ```bash
   git checkout main
   # ... edit files ...
   git add <files>
   git commit -m "feat: ..."
   git push
   ```
   → Vercel re-deploys the preview URL automatically.

2. **Test the preview URL** in a real browser. If anything is broken, fix on `main` and push again.

---

## Releasing to production

When `main` is in a known-good state and you want users to see it:

```bash
git checkout production
git pull origin production              # sync with remote (in case someone else released)
git merge main                          # bring all main changes in
git push origin production              # → Vercel deploys to real prod
git checkout main                       # back to dev
```

That's the full release. Vercel handles the deploy. Your prod URL updates within ~60s.

---

## Hotfixes (urgent bug in production)

If something breaks on prod and you need to fix it without dragging in unfinished work from `main`:

```bash
git checkout production
git checkout -b hotfix/<short-description>
# ... fix the bug, commit ...
git checkout production
git merge hotfix/<short-description>
git push origin production              # → deploys the fix
git checkout main
git merge hotfix/<short-description>    # bring fix into dev too
git push origin main
git branch -d hotfix/<short-description>
```

---

## Rolling back

If a release introduces a bug and you need the previous state back FAST:

```bash
git checkout production
git revert HEAD                         # undoes the latest commit, creates a new revert commit
git push origin production              # → Vercel re-deploys the previous good state
```

For multi-commit rollback, revert the merge commit:
```bash
git revert -m 1 <merge-sha>
```

---

## Shipping a Coming-Soon paper type to production

When a paper type (currently hex, iso, music) is finally ready:

1. On `main`: open `packages/web/.env.production` and remove the entry from `VITE_COMING_SOON_PAPERS=`. Commit and push.
2. Test on the preview URL.
3. Merge `main → production` as usual.

Zero code changes. The feature flag does all the work.

---

## What lives where

| Setting | File | Affects |
|---|---|---|
| Coming-soon paper types | `packages/web/.env.production` → `VITE_COMING_SOON_PAPERS` | Production builds only. Dev shows everything. |
| API URL | `packages/web/.env.production` and `.env.development` → `VITE_API_URL` | Both modes |
| Convex CORS allowlist | `packages/convex/convex/http.ts` → `ALLOWED_ORIGINS` | Backend. Requires `npx convex deploy` to take effect. |
| Vite dev port | `packages/web/package.json` scripts | `npm run dev` → 3000, `npm run dev:prod` → 3001 |

---

## Local previews (without pushing anything)

```bash
cd packages/web

# Just the dev mode (all 7 papers active)
npm run dev               # → localhost:3000

# Just the production mode (only ready papers, others "Coming Soon")
npm run dev:prod          # → localhost:3001

# Both at once, color-coded
npm run dev:both          # → 3000 + 3001
```

`localhost:3001` mirrors what users will see on the production URL after a release.

---

## Checklist before every release

- [ ] All A.* tasks for the paper types you're shipping are complete
- [ ] `npm run dev:prod` shows the right "Coming Soon" tiles
- [ ] No TypeScript errors: `cd packages/web && npx tsc --noEmit`
- [ ] No console errors in `localhost:3001`
- [ ] Manual smoke test:
  - [ ] Create a notebook
  - [ ] Open a Lined page → type → text sits on lines
  - [ ] Open a Grid page → tap a cell → cursor lands → type
  - [ ] Open a Dotted / Blank page → both work
  - [ ] Try to switch to Hex/Iso/Music → SOON badge visible, click does nothing
- [ ] Convex backend reachable from `localhost:3001` (login works)
