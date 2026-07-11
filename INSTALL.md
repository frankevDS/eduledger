# EduLedger — Full Install Guide, Start to Finish

Follow this in order. Nothing here assumes you've done anything already.

---

## Step 0 — What you need before starting

- A computer (Mac, Windows, or Linux) with a terminal/command line.
- Free accounts on: **GitHub**, **Supabase**, **Groq**. (A **Paystack** account too, if you want to test real payments later — not required to get everything else working.)
- The `eduledger-api.zip` file from our conversation, downloaded to your computer.

---

## Step 1 — Install Node.js

Next.js (the framework this project uses) needs Node.js version 18.18 or newer (20+ is best).

**Check if you already have it:**
Open your terminal (Mac: Terminal app; Windows: Command Prompt or PowerShell) and type:
```bash
node -v
```
- If you see something like `v20.11.0` or `v18.18.0` or higher → you're set, skip to Step 2.
- If you see "command not found" or a version below 18.18 → install it:
  - Go to **https://nodejs.org**
  - Download the **LTS** version (the left, recommended button)
  - Run the installer, click through with defaults
  - Close and reopen your terminal, then run `node -v` again to confirm

Also confirm npm (comes bundled with Node):
```bash
npm -v
```
You should see a version number like `10.x.x`.

---

## Step 2 — Unzip the project

1. Find `eduledger-api.zip` wherever you downloaded it.
2. Unzip it:
   - **Mac**: double-click the zip file
   - **Windows**: right-click → "Extract All"
   - **Terminal (any OS)**: `unzip eduledger-api.zip`
3. Move the extracted `eduledger-api` folder somewhere sensible, e.g. your Documents or a `projects` folder.
4. Open your terminal and navigate into it:
```bash
cd path/to/eduledger-api
```
(Replace `path/to/` with wherever you put it. On Mac you can type `cd ` then drag the folder into the terminal window and press Enter.)

Confirm you're in the right place:
```bash
ls
```
You should see `package.json`, `src`, `supabase`, `README.md`, etc.

---

## Step 3 — Install the project's dependencies

Still in that folder, run:
```bash
npm install
```
This downloads everything the project needs (Next.js, Supabase's libraries, etc.) into a `node_modules` folder. It can take 1–3 minutes and will print a lot of text — that's normal. Wait for it to finish and return you to a normal prompt.

---

## Step 4 — Create your Supabase project

1. Go to **https://supabase.com** and sign up (GitHub login is the fastest option).
2. Click **New project**.
3. Fill in:
   - **Name**: e.g. `eduledger`
   - **Database password**: create a strong one and **save it somewhere** (a password manager or notes file) — you'll rarely need it directly, but you don't want to lose it.
   - **Region**: pick whichever is closest to Ghana/Nigeria that's offered (e.g. an EU region) — doesn't have to be perfect for testing.
4. Click **Create new project** and wait — it takes about 1–2 minutes to provision. Don't move to the next step until the project dashboard finishes loading (you'll see a sidebar with Table Editor, SQL Editor, Authentication, etc.).

---

## Step 5 — Run the database migrations, in order

This creates every table, security rule, and function the app needs. You'll do this by pasting SQL files into Supabase's SQL Editor, one at a time, **in this exact order**.

1. In the Supabase dashboard, click **SQL Editor** in the left sidebar.
2. Click **New query**.
3. On your computer, open `supabase/migrations/0001_init.sql` in a text editor (VS Code, Notepad, TextEdit — anything).
4. Select all the text in that file (Ctrl+A / Cmd+A), copy it (Ctrl+C / Cmd+C).
5. Paste it into the Supabase SQL Editor box, then click **Run** (or press Ctrl+Enter / Cmd+Enter).
6. You should see a green "Success" message at the bottom. If you see a red error, stop and re-check you copied the *entire* file.
7. Click **New query** again, and repeat steps 3–6 for each of these files, **in this exact order**:
   - `0001_init.sql` ← you just did this one
   - `0002_profiles_rls.sql`
   - `0003_remaining_rls.sql`
   - `0004_transport_parent_request.sql`
   - `0005_permissions_and_quiz_taking.sql`
   - `0006_setup_write_policies.sql`

**Do NOT run** `0000_local_auth_stub_TEST_ONLY.sql` — that file only exists for testing outside Supabase and would conflict with Supabase's real login system.

After all six, you can double check: click **Table Editor** in the sidebar — you should see a long list of tables (tenants, branches, students, scores, guardians, etc.).

---

## Step 6 — Get your Supabase API keys

1. In the Supabase dashboard, click the **gear icon** (Project Settings) in the bottom of the left sidebar.
2. Click **API** in the settings menu.
3. You'll see three things you need — keep this page open, you'll copy from it in Step 9:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key (a long string)
   - **service_role** key (another long string, further down — click "Reveal" if it's hidden). **This one is secret — never share it or put it in a public place.**

---

## Step 7 — Get a Groq API key

Groq powers the weekend-quiz auto-generation feature.

1. Go to **https://console.groq.com** and sign up.
2. Click **API Keys** in the sidebar.
3. Click **Create API Key**, give it any name (e.g. "eduledger"), click Create.
4. Copy the key immediately — Groq only shows it once.

---

## Step 8 — (Optional for now) Get a Paystack key

You can skip this step entirely for now and come back to it later — everything else works without it. If you want it now:

1. Go to **https://paystack.com** and sign up.
2. Once in the dashboard, go to **Settings → API Keys & Webhooks**.
3. Copy the **Test Secret Key** (starts with `sk_test_`) — safe to use for testing, no real money moves.

If you're skipping this for now, just leave that value blank in the next step.

---

## Step 9 — Create your local environment file

Back in your terminal, still inside the `eduledger-api` folder:

```bash
cp .env.example .env.local
```

Now open the new `.env.local` file in a text editor and fill in the real values you collected:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-actual-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-actual-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-actual-service-role-key
GROQ_API_KEY=your-actual-groq-key
PAYSTACK_SECRET_KEY=your-actual-paystack-key-or-leave-blank
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Save the file.

---

## Step 10 — Run the project locally

```bash
npm run dev
```

Wait for it to print something like `Ready in 1.2s` and a line with `Local: http://localhost:3000`. Open that address in your browser. You should be redirected to a login screen with "Staff" and "Parent" tabs.

**If this works, your installation is correct.** Leave this terminal window running — it's your live local server. To stop it later, click into that terminal and press Ctrl+C.

---

## Step 11 — Seed your first school (nothing exists yet, so login will fail until you do this)

Right now the database has tables but no school, no branch, and no user accounts with roles. You need to create the first one — yourself, as the Owner.

**11a. Create your own login in Supabase:**
1. In Supabase, click **Authentication** in the sidebar → **Users** tab.
2. Click **Add user** → **Create new user**.
3. Enter your email and a password you'll remember. Check "Auto Confirm User" if that option is shown (so you don't need to click an email link).
4. Click **Create user**. You'll see yourself appear in the users list — copy the **User UID** shown next to your row (a long id) — you'll need it in a moment.

**11b. Create the school (tenant + branch) and link your profile to it:**
1. Go back to **SQL Editor** → **New query**.
2. Paste this, replacing the placeholders with your own values (keep the quotes):

```sql
-- Create the school
insert into tenants (id, name, country_default)
values (gen_random_uuid(), 'Golden Crest Academy', 'GH')
returning id;
```
Run it, and copy the `id` it returns (your tenant id).

```sql
-- Create the first campus (paste your tenant id from above)
insert into branches (id, tenant_id, name, country, address)
values (gen_random_uuid(), 'PASTE-YOUR-TENANT-ID-HERE', 'Accra Campus', 'GH', 'Spintex Road, Accra')
returning id;
```
Run it, and copy the `id` it returns (your branch id).

```sql
-- Link your own login to this school as the Owner
-- (paste your Supabase Auth User UID from step 11a, and the tenant/branch ids from above)
update profiles
set tenant_id = 'PASTE-YOUR-TENANT-ID-HERE',
    branch_id = 'PASTE-YOUR-BRANCH-ID-HERE',
    role = 'owner',
    full_name = 'Your Name'
where id = 'PASTE-YOUR-AUTH-USER-UID-HERE';
```
Run it. (This works because creating your user in step 11a automatically created a blank `profiles` row for you with role `parent` — this just fills it in properly.)

---

## Step 12 — Log in and take your first look around

1. Go back to `http://localhost:3000/login` in your browser.
2. Click the **Staff** tab.
3. Enter the email and password you created in Step 11a.
4. Click **Sign in**.

You should land on the Teacher page (since staff login always redirects there first) — that's fine, just click the address bar and go to:
- `http://localhost:3000/owner` — your dashboard (will show 0 students, 0 fees — that's correct, nothing's created yet)
- `http://localhost:3000/setup` — this is where you'll actually build out the school

**In `/setup`, in this order:**
1. **Academic structure** tab: create an academic year (e.g. 2025/2026), then a term for it, then a subject (e.g. Mathematics), then a class (e.g. JHS 2), then a fee item for that class/term.
2. **Add a student** tab: create a student in that class, add their guardian, click "Generate parent access code" (write down the code it gives you), and generate their term invoice.
3. Try logging in as that parent: open a new private/incognito browser window, go to `http://localhost:3000/login`, click **Parent**, enter the access code you just generated.

To test the Teacher/Head Teacher approval flow, repeat Step 11a to create two more Supabase Auth users (one for a teacher, one for a head teacher), then use the same `update profiles set role = ...` SQL pattern from Step 11b to set one to `class_teacher` and one to `head_teacher` (same tenant/branch ids). Then, in `/setup` → **Teachers & weightings**, assign your class_teacher to the class you created.

---

## Step 13 — Push the project to GitHub

This isn't required to keep using it locally, but you'll want it before deploying to Vercel.

```bash
git init
git add .
git commit -m "Initial commit"
```

Then on **https://github.com**:
1. Click the **+** icon (top right) → **New repository**.
2. Name it (e.g. `eduledger-api`), leave it private or public as you prefer, **don't** check "Add a README" (you already have one).
3. Click **Create repository**.
4. GitHub will show you commands like this — run them in your terminal:
```bash
git remote add origin https://github.com/YOUR-USERNAME/eduledger-api.git
git branch -M main
git push -u origin main
```

---

## Step 14 — Deploy to Vercel

1. Go to **https://vercel.com** and sign up/log in (GitHub login is easiest).
2. Click **Add New** → **Project**.
3. Find and import the `eduledger-api` repo you just pushed.
4. Before clicking Deploy, expand **Environment Variables** and add every value from your `.env.local` file (same names, same values) — except set `NEXT_PUBLIC_SITE_URL` to your future Vercel URL (Vercel will show you the domain it's about to assign, typically `https://eduledger-api-yourname.vercel.app`).
5. Click **Deploy**. Wait for it to finish (a minute or two).
6. Once deployed, open the live URL it gives you and confirm the login page loads there too.

If you set `PAYSTACK_SECRET_KEY` in Step 8, go back to Paystack's dashboard → Settings → API Keys & Webhooks, and set the webhook URL to `https://your-vercel-domain/api/payments/webhook`.

---

## You're done — what "working" looks like

At this point you should be able to: log in as yourself (Owner), see `/owner` and `/setup`, create a full school structure, create a student and their parent's login, and log in separately as that parent to see (only) their child's approved records. If any of that doesn't work, check the terminal running `npm run dev` (or Vercel's deployment logs) for the actual error message — it will almost always say exactly which environment variable or step was missed.
