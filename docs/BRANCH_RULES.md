# Branch Rules — Localhost → Production

**Goal:** never lose work again. Every edit you make locally MUST survive to production via clear, predictable steps.

---

## The two branches

```
main          ←  active development. all features ON.
                 Vercel deploys to PREVIEW URL (papergrid-git-main-...).
                 You work here 99% of the time.

production    ←  what users see. only stable, tested code.
                 Hex/Iso/Music render as "Coming Soon" placeholders.
                 Vercel deploys to the real production URL (papergrid-five.vercel.app).
                 Updated by merging main → production when a release is ready.
```

No other long-lived branches. If you need a feature branch, create it, work, merge back to `main` within the same day, delete it.

---

## The golden rule (read this before every session)

> **If a file is on localhost but not in `git status` as committed, it does not exist for Vercel, iOS, or another machine.**

Localhost reads from disk. Vercel and iOS read from `git`. A file that's only on disk will work on localhost forever and silently disappear the moment you deploy, switch machines, or accidentally stash.

**Check before every commit:**
```bash
git status --short
```

If you see `??` (untracked) files that are part of the work you're shipping, `git add` them before committing. If you see `M` (modified) files that shouldn't be in this commit, unstage them explicitly.

---

## Daily dev loop

```bash
# 1. Pull latest from main
git checkout main
git pull origin main

# 2. Start dev server(s)
cd packages/web
npm run dev          # localhost:3000 — dev mode, all 7 papers active
# optional: npm run dev:both for localhost:3000 + localhost:3001 (prod preview)

# 3. Edit files
# ... make changes ...

# 4. Before walking away from the keyboard, always:
git status --short                   # see everything uncommitted
git add <explicit file paths>        # stage what belongs in this commit
git diff --cached --name-only        # double-check the staged list
git commit -m "feat: ..."
git push origin main                 # Vercel deploys preview URL

# 5. Verify the preview URL loads your change
# Vercel sends a deploy notification; check the preview deploy link.
```

### Never leave untracked work overnight

Work that lives only in the working tree is at risk every time you:
- Run `git stash`
- Run `git checkout <other-branch>`
- Run `git reset`
- Accept an IDE "revert file" suggestion
- Close your laptop on a low battery

**Commit daily, even if the feature is incomplete.** WIP commits are cheap. Losing a day's work is expensive. You can always squash later.

---

## Releasing dev → production

Only when `main` is a known-good state:

```bash
# From main, with a clean working tree
git status --short                       # should be empty (or just intentional WIP)
git checkout production
git pull origin production               # sync with remote (belt and braces)
git merge main                           # bring all main changes in
git push origin production               # → Vercel auto-deploys the real prod URL
git checkout main                        # back to dev

# Optional: tag the release for easy rollback
git tag -a v0.4.0 -m "Release v0.4.0 — Grid + waitlist + plan limits"
git push origin v0.4.0
```

That's the full release. ~60 seconds later, users see the new version at the production URL.

### Release checklist (do BEFORE merging to production)

- [ ] `git status --short` shows nothing unintentional
- [ ] `npm --workspace @papergrid/core run build` passes locally
- [ ] `npm --workspace @papergrid/web run build` passes locally
- [ ] Manual smoke test on `localhost:3001` (prod mode) covers the change
- [ ] The preview URL from the latest `main` push is green
- [ ] Convex schema changes (if any) are deployed: `cd packages/convex && npx convex deploy`

---

## Rolling back (when a release breaks prod)

```bash
git checkout production
git revert HEAD                          # undoes the latest merge
git push origin production               # → Vercel re-deploys the previous state
git checkout main
```

For rolling back multiple commits (full release), revert the merge commit:
```bash
git revert -m 1 <merge-sha>
```

---

## Hotfixes (urgent bug on production)

When `main` has unfinished work and you can't ship it yet:

```bash
git checkout production
git checkout -b hotfix/<short-description>
# ... fix the bug ...
git add <files>
git commit -m "fix: ..."
git checkout production
git merge hotfix/<short-description>
git push origin production               # → deploy the fix
git checkout main
git merge hotfix/<short-description>     # bring fix into dev too
git push origin main
git branch -d hotfix/<short-description>
```

---

## Recovering lost work

**If `git status` shows a file you don't recognize:**
```bash
# Inspect it
git diff <file>                          # for modified files
cat <file>                               # for untracked files
git log -- <file>                        # see if git knows about it historically
```

**If you ran `git stash` and can't remember what's in it:**
```bash
git stash list
git stash show --stat stash@{0}          # see file names
git stash show -p stash@{0}              # see the diff
git checkout stash@{0} -- <specific-file>  # restore one file
git stash pop stash@{0}                   # restore all and drop stash
git stash apply stash@{0}                 # restore all and KEEP stash (safer)
```

**If you accidentally reset and lost commits:**
```bash
git reflog                               # shows every HEAD move
git checkout <sha-from-reflog>           # inspect
git cherry-pick <sha>                    # recover specific commits
```

---

## The "localhost shows old" symptom

If localhost is not showing your latest changes:

1. **Check the dev server actually restarted** after a package.json or vite.config.ts change. HMR doesn't cover those.
2. **Hard refresh the browser**: Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows). Bypasses service worker + HTTP cache.
3. **Check `git status`**: is the file you edited actually `M` (modified)? If it shows up as untracked or not listed at all, your edit may have been reverted by the IDE.
4. **Check the dev server logs**: Vite prints compile errors as red text. If Vite hit an error, it stopped compiling your change.
5. **Last resort: restart the dev server**. Sometimes file watchers drift, especially on macOS after system sleep.

---

## What lives where

| Thing | Where |
|---|---|
| Coming-soon paper types (hex/iso/music in production) | `packages/web/.env.production` → `VITE_COMING_SOON_PAPERS` |
| Convex backend URL | `packages/web/.env.development` and `.env.production` → `VITE_API_URL` |
| Convex CORS allowlist | `packages/convex/convex/http.ts` → `ALLOWED_ORIGINS` (requires `npx convex deploy` to take effect) |
| Admin dashboard overrides for plan limits | `appSettings` table in Convex, key `plan-limits` (edit via `/admin` panel) |
| Release workflow detail | `docs/RELEASE.md` |

---

## Red flags that mean STOP and commit

- **"I've been working for more than 2 hours without committing"** → commit a WIP now
- **"I'm about to close my laptop and my dev server is still running"** → commit what you have
- **"The stash count is > 1"** → clean up the stashes, don't let them accumulate
- **"`git status` has more than 10 untracked files"** → triage them: commit useful ones, delete noise
- **"localhost works but I haven't verified the committed state builds"** → run `npm --workspace @papergrid/web run build` before you stop for the day
