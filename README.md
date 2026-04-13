<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/3a2c972f-ff5f-470e-ab7e-83caa69510ac

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the runtime secrets in `.env` or `.env.local`:
   - `GEMINI_API_KEY` for AI generation
   - `RESEND_API_KEY` for transactional email delivery
   - `EMAIL_FROM` for the verified Resend sender, for example `hello@papera.io`
   - `PUBLIC_APP_URL` for links included in emails
   - `VITE_PUBLIC_BLOG_ENABLED=false` to keep the public blog hidden from the web app
   For the deployed Convex backend, set these in Convex as well, not only in Vercel/local env:
   `cd packages/convex && npx convex env set RESEND_API_KEY re_xxx`
   `cd packages/convex && npx convex env set EMAIL_FROM hello@papera.io`
   `cd packages/convex && npx convex env set PUBLIC_APP_URL https://papera.io`
   `cd packages/convex && npx convex env set PUBLIC_BLOG_ENABLED false`
3. Run the app:
   `npm run dev`
