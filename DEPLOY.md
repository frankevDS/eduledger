# EduLedger — Deployment Guide (GitHub → Vercel)

Follow this in order. This assumes your local project already runs correctly with `npm run dev` and you've been testing successfully against your live Supabase project.

---

## Step 0 — Critical: add the missing `.gitignore` file first

**Do this before anything else in this guide.** Without it, pushing to GitHub would upload your `node_modules` folder (huge, unnecessary) and — much more seriously — your `.env.local` file, which contains your real Supabase and Groq secret keys, into your GitHub repo where anyone with access could see them.

1. In your project folder (`eduledger-api`), open Notepad to create a new file:
```
notepad .gitignore
```
2. If Notepad asks "Do you want to create a new file?", click **Yes**.
3. Paste this in exactly:
```
# Dependencies
/node_modules

# Next.js build output
/.next/
/out/

# Environment files — NEVER commit real keys
.env
.env.local
.env.*.local

# TypeScript build info
*.tsbuildinfo
next-env.d.ts

# OS/editor files
.DS_Store
Thumbs.db

# Vercel
.vercel

# Logs
npm-debug.log*
```
4. Save (Ctrl+S) and close Notepad.

**Important naming note:** the file must be named exactly `.gitignore` (starting with a dot, no `.txt` at the end) — the same Notepad "silently adds .txt" issue from earlier in our setup applies here too. Verify it with:
```
dir /a
```
You should see `.gitignore` listed exactly like that. If you see `.gitignore.txt`, fix it the same way as before:
```
ren .gitignore.txt .gitignore
```

---

## Step 1 — Install Git (if you don't already have it)

Check first:
```
git --version
```
If you see a version number, skip to Step 2. If you see "not recognized":
1. Go to **https://git-scm.com/download/win**
2. Download and run the installer — click through with all default options.
3. Close and reopen your terminal, then run `git --version` again to confirm.

---

## Step 2 — Turn your project into a Git repository

In your terminal, in the `eduledger-api` folder:

```
git init
git add .
git commit -m "Initial commit"
```

**After running `git add .`, it's worth double-checking your secrets weren't included.** Run:
```
git status
```
Look through the list — you should **not** see `.env.local` mentioned anywhere. If you do see it listed, **stop** and tell me before continuing — it means the `.gitignore` step didn't take effect and we need to fix that first.

---

## Step 3 — Create the repository on GitHub

1. Go to **https://github.com** and log in (or sign up if you haven't already).
2. Click the **+** icon in the top-right corner → **New repository**.
3. **Repository name**: `eduledger-api` (or whatever you'd like)
4. Choose **Private** (recommended, since this is a real school's system) or Public — your call.
5. Do **NOT** check "Add a README file", "Add .gitignore", or "Choose a license" — your project already has these, and adding them here would cause a conflict.
6. Click **Create repository**.

GitHub will now show you a page with some commands. You want the section titled **"…or push an existing repository from the command line"**. It looks like this (yours will have your own username):

```
git remote add origin https://github.com/YOUR-USERNAME/eduledger-api.git
git branch -M main
git push -u origin main
```

Copy those three lines from GitHub's own page (to make sure you get your exact URL right) and run them in your terminal, one at a time.

The first time you push, Git may open a browser window asking you to log in to GitHub and authorize — do that if prompted.

**Verify it worked:** refresh the GitHub page in your browser. You should see all your project's files listed there — `src`, `supabase`, `package.json`, `README.md`, etc. You should **not** see a `node_modules` folder or a `.env.local` file in that list.

---

## Step 4 — Import the project into Vercel

1. Go to **https://vercel.com** and sign up/log in — click **"Continue with GitHub"** to link the two accounts (easiest option).
2. Click **Add New...** → **Project**.
3. You'll see a list of your GitHub repositories — find `eduledger-api` and click **Import** next to it.
4. Vercel will auto-detect it as a Next.js project. **Don't click Deploy yet** — first expand **Environment Variables** below the project settings.

---

## Step 5 — Add your environment variables in Vercel

This is the step most likely to be missed, so go carefully. Open your local `.env.local` file (Notepad) in one window and Vercel's environment variables section in another, side by side.

Add each of these **one at a time** (paste the name in the "Key" box, the real value in the "Value" box, click **Add**):

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | same as your local `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same as your local `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | same as your local `.env.local` |
| `GROQ_API_KEY` | same as your local `.env.local` |
| `PAYSTACK_SECRET_KEY` | same as your local `.env.local` (or leave blank if you never set this up) |
| `NEXT_PUBLIC_SITE_URL` | **do NOT copy this one — see Step 6 first** |

Make sure each one has all three environment checkboxes ticked (**Production**, **Preview**, **Development**) unless you have a specific reason not to.

---

## Step 6 — `NEXT_PUBLIC_SITE_URL` needs a real value, not localhost

This one is important and easy to get wrong: your local value is `http://localhost:3000`, but that will **never work** once deployed — Vercel isn't running on your laptop. This specifically breaks the parent magic-link login, since that's the URL Supabase redirects back to after verifying a code.

**The problem:** you don't know your exact Vercel URL until after the first deploy. Here's how to handle that:

1. For now, add `NEXT_PUBLIC_SITE_URL` in Vercel with a **placeholder** value: `https://placeholder.vercel.app`
2. Click **Deploy** at the bottom of the page. Wait for it to finish (a minute or two).
3. Once deployed, Vercel shows you the **real** URL it assigned — something like `https://eduledger-api-yourname.vercel.app`. Copy that exact URL.
4. Go to **Settings** (top of your Vercel project) → **Environment Variables** → find `NEXT_PUBLIC_SITE_URL` → click the **⋯** menu next to it → **Edit** → replace the placeholder with your real URL (no trailing slash at the end) → **Save**.
5. Go to the **Deployments** tab → find the latest deployment → click the **⋯** menu → **Redeploy** (environment variable changes only take effect on a fresh deploy).

---

## Step 7 — Tell Supabase about your new production URL

Your Supabase project currently only trusts `http://localhost:3000` for login redirects (from our earlier setup). It needs to trust your real Vercel URL too, or the parent login will fail exactly the way it did before we fixed it locally.

1. In Supabase, go to **Authentication** → **URL Configuration**.
2. **Site URL**: you can leave this as `http://localhost:3000` for now (it's just a fallback default), or update it to your Vercel URL if you want production to be the primary one.
3. **Redirect URLs**: **add** (don't replace) your Vercel callback URL:
   ```
   https://your-actual-vercel-url.vercel.app/auth/callback
   ```
4. Click **Save**.

---

## Step 8 — If you're using Paystack, update its webhook too

1. Paystack dashboard → **Settings** → **API Keys & Webhooks**.
2. Set the webhook URL to:
   ```
   https://your-actual-vercel-url.vercel.app/api/payments/webhook
   ```

---

## Step 9 — Test the live deployment, from scratch

Open your real Vercel URL in a **fresh incognito window** and go through the same checks we did locally:

1. `https://your-vercel-url.vercel.app/login` → sign in as yourself (Owner) → should land on `/owner`.
2. Try `/setup`, `/fees`, `/transport`, `/permissions` — same data you already created should appear (it's the same Supabase database, just a different way of reaching it now).
3. Open a **separate** fresh incognito window → Parent login with one of your existing codes (e.g. `GCA-7048`) → this is the real test, since it's the piece Step 6/7 was specifically about. Confirm it lands properly on `/parent` and doesn't bounce back to `/login`.

---

## From now on: how to update your live site

Whenever you (or I) make a code change locally and you want it live:

```
git add .
git commit -m "describe what changed"
git push
```

Vercel automatically redeploys within a minute or two of every push to your `main` branch — no need to repeat the import process.

---

## If something goes wrong

Vercel keeps real error logs. Go to your project → **Deployments** → click the specific deployment → **Runtime Logs** (or **Functions** tab) to see the actual server-side error, the same way we used your local terminal's output throughout this whole setup. Screenshot whatever it shows and we'll debug it the same way we've been doing all along.
