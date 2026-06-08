# Card Shop Manager

A deployed, multi-user web app for running a trading-card business: inventory,
purchases, sales, expenses, a built-in CRM (customers + lead/deal pipeline), and
a California income-tax estimator — all behind an invite-only team login.

Built with **Next.js 14 (App Router) + TypeScript + Prisma + PostgreSQL +
Auth.js**, designed to deploy on **Railway** as a single service plus a Postgres
database.

---

## What's inside

- **Dashboard** — YTD revenue, gross/net profit, inventory value, monthly
  revenue chart, top customers, and open follow-ups.
- **Inventory** — the hub of the app. Trading-card fields (set, year, card #,
  condition, grading company / grade / cert #, SKU), quantity, cost basis,
  status. Organized into lifecycle tabs: **In Brazil**, **In US**, and
  **History**. Purchases, sales, and trades are recorded right here via popup
  buttons in the header (there are no separate Purchases/Sales/Trades pages).
  Each item gets an auto-generated **internal SKU** (`CSM-000123`); broken-down
  units inherit a child SKU (`CSM-000123-B01`) that ties them back to the parent.
- **History (activity log)** — every purchase, sale, trade, shipment, and break
  down in one timeline, each tagged by type and filterable. Sales appear
  per-sale as they happen, even while stock remains (sell 1 of 10 → a sale of 1
  shows in History and 9 stay in stock). Records can be deleted here, which
  reverses their inventory effect.
- **Purchases** — recorded from the Inventory header (**+ Purchase**); choose the
  **location** (Brazil / US); optionally link to an existing item
  (auto-increments stock and recomputes weighted-average cost) or auto-create a
  new item.
- **Sales** — recorded from the Inventory header (**+ Sale**); linked to
  inventory and a customer; auto-reduces stock and computes COGS + profit
  (price − fees − shipping − cost).
- **Trades** — recorded from the Inventory header (**+ Trade**); swap items for
  items (plus cash), with cost basis passing through to what you receive.
- **Expenses** — categorized deductible business expenses.
- **Customers (CRM)** — contacts with type/tags/notes, purchase history, and
  lifetime spend.
- **Leads & deals** — pipeline with stages (Prospect → Contacted → Negotiating →
  Won / Lost), estimated value, and follow-up dates (overdue flagged).
- **Taxes (California)** — estimates federal income tax + self-employment tax
  (15.3%) + CA state income tax on your business net profit, with filing status,
  other household income, and an optional 20% QBI deduction. **Planning estimate
  only — not tax advice.**
- **Team** (admins only) — add/disable/delete members, set roles, reset
  passwords. Two roles: **ADMIN** (everything, including the Team page) and
  **STAFF** (everything except team management).
- **Break down sealed product** — open a case/box into smaller units (see below).
- **Quick add** — record activity from a popup opened by a single button:
  purchases, sales, and trades from the Inventory header; expenses, customers,
  and leads from their own pages.
- **Search & filter** — the Inventory tabs and the History activity log have a
  search box and filters (status / graded / activity type) driven by the URL, so
  views are bookmarkable.
- **CSV export** — one click downloads a spreadsheet (inventory from the
  Inventory header; sales and purchases from the History tab; expenses /
  customers / leads from their pages).

### Item lifecycle: Brazil → US → sold

Inventory moves through three stages, each on its own tab under **Inventory**:

1. **In Brazil** — record a purchase with location **Brazil** (the **+ Purchase**
   button) and the item lands here. This is product you own but haven't imported
   yet.
2. **Ship to US** — on the **In Brazil** tab, click **+ Ship to US** to open a
   popup. Check the items going in the pack, set a **ship quantity** for each
   (you can ship part of a stack — e.g. 250 of 500 boxes), enter the
   **shipping** and **tariff/duty** (and any other fees), and submit. Those
   costs are *landed costs*: they're split across the shipped units (weighted by
   cost value) and folded into cost basis, so profit math stays correct when
   they sell. The shipped units move to the **In US** tab (a partial ship leaves
   the remainder in Brazil) and the shipment is logged in **History** (deleting
   it there moves its items back to Brazil and reverses the cost).
3. **In US** — landed inventory, ready to sell. Use **+ Sale** to record a sale
   (wholesale or Whatnot) — only US items can be sold. For Whatnot, use **Break
   down** to open a sealed item into singles/units first.

Every purchase, sale, trade, shipment, and break down is logged in the
**History** tab.

### Breaking down sealed product

Inventory → any item → **Break down**. Use this when you buy something as one
unit but sell it as several — e.g. a case logged as 1 unit at $1,000 that you
open into 10 booster boxes.

You choose how many units to open and how many units come out, then either
**create a new item** (e.g. "Booster box") or **merge into an existing item**.
The app conserves cost basis: the opened cost is split evenly across the new
units (here, $100/box), so total inventory value and all future profit/COGS math
stay correct. Merging into an item that already has stock uses weighted-average
cost. The parent's quantity is reduced by the number of units you opened.

When the parent is fully opened (quantity hits zero) it moves out of the **In
stock** tab and into **History**, marked **Broken down**, where it lists the
units it was opened into (by internal SKU). The new units stay active in stock.
Likewise, when an item is fully sold it moves to **History** marked **Sold**,
showing its sale details (price, profit, platform, customer).

### Exporting data

Each list page (Inventory, Purchases, Sales, Expenses, Customers, Leads) has an
**Export CSV** button that downloads a UTF-8 CSV (opens cleanly in Excel or
Google Sheets) — handy for backups or handing records to an accountant.

---

## Deploy to Railway (step by step)

You'll create a GitHub repo, a Railway project with Postgres, set a few
variables, and create your first admin. Budget ~15 minutes. Cost is roughly
**$5–8/month** on Railway's Hobby plan.

### 1. Put the code on GitHub

1. Create a new empty repository on GitHub (e.g. `card-shop-manager`).
2. From this project folder on your computer:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<you>/card-shop-manager.git
   git push -u origin main
   ```

### 2. Create the Railway project + database

1. Go to https://railway.app and sign in. Upgrade to the **Hobby** plan so the
   app stays always-on.
2. Click **New Project → Deploy from GitHub repo** and pick your repo.
   Railway will start building it (it may fail the first build until the
   database and variables exist — that's expected, we fix it next).
3. In the same project, click **New → Database → Add PostgreSQL**.

### 3. Set environment variables

Open your **app service → Variables** tab and add:

| Variable        | Value                                                        |
| --------------- | ------------------------------------------------------------ |
| `DATABASE_URL`  | `${{Postgres.DATABASE_URL}}` (references the Postgres service) |
| `AUTH_SECRET`   | a long random string — generate with `openssl rand -base64 32` |
| `AUTH_URL`      | your app's public URL, e.g. `https://card-shop-manager-production.up.railway.app` |

> Tip: To get the public URL, go to the app service → **Settings → Networking →
> Generate Domain**. Paste that value into `AUTH_URL` (include `https://`).

### 4. Redeploy

Trigger a redeploy (Railway auto-redeploys on variable changes, or click
**Deploy**). On start, the app runs `prisma migrate deploy`, which creates all
the tables automatically. When the deploy is green, open the generated domain —
you'll see the login page.

### 5. Create your first admin account

The login is invite-only, so you need one admin to start.

**Easiest — the one-time setup page (no terminal):** visit
`https://your-app-url/setup`, fill in your name, email, and password, and submit.
That creates your ADMIN account and the page permanently closes (it only works
while the database has zero users). Do this right after your first deploy.

Prefer the command line instead? Use the seed script:

**Option A — Railway's one-off command**
1. Install the Railway CLI: `npm i -g @railway/cli`, then `railway login`.
2. From the project folder, link it: `railway link` (select your project).
3. Run, substituting your details:
   ```bash
   railway run \
     -e SEED_ADMIN_EMAIL="you@example.com" \
     -e SEED_ADMIN_PASSWORD="a-strong-password" \
     -e SEED_ADMIN_NAME="Your Name" \
     npm run db:seed
   ```

**Option B — from your computer**
Copy the database's public connection string from the Postgres service
(**Variables → DATABASE_PUBLIC_URL**), then locally:
```bash
DATABASE_URL="<public-connection-string>" \
SEED_ADMIN_EMAIL="you@example.com" \
SEED_ADMIN_PASSWORD="a-strong-password" \
SEED_ADMIN_NAME="Your Name" \
npm run db:seed
```

Now log in at your domain with that email/password. Go to **Team** to add the
rest of your staff (each gets a role and a temporary password they can use to
sign in; you can reset passwords any time).

---

## Run it locally (optional, for development)

You need Node 18+ and a local PostgreSQL (or use the Railway DB's public URL).

```bash
cp .env.example .env        # then fill in DATABASE_URL and AUTH_SECRET
npm install
npm run db:migrate          # creates tables locally (prisma migrate dev)
npm run db:seed             # creates the first admin from SEED_ADMIN_* in .env
npm run dev                 # http://localhost:3000
```

---

## Environment variables

| Variable              | Required | Notes                                            |
| --------------------- | -------- | ------------------------------------------------ |
| `DATABASE_URL`        | yes      | Postgres connection string.                      |
| `AUTH_SECRET`         | yes      | Signs session tokens. Keep secret.               |
| `AUTH_URL`            | prod     | Public app URL. Needed for auth callbacks.       |
| `SEED_ADMIN_EMAIL`    | seed     | Used only by `npm run db:seed`.                  |
| `SEED_ADMIN_PASSWORD` | seed     | Used only by `npm run db:seed`.                  |
| `SEED_ADMIN_NAME`     | no       | Defaults to "Owner".                             |

---

## How the numbers work

- **Profit per sale** = sale price − fees − shipping − cost basis (COGS). Cost
  basis is taken from the linked inventory item's average cost at the time of
  sale.
- **Weighted-average cost**: logging a purchase against an existing item updates
  its average cost: `(oldQty·oldCost + buyQty·buyCost) / (oldQty + buyQty)`.
- **Tax estimate** uses business net profit = gross revenue − COGS − selling
  costs − operating expenses. Don't also log purchases as "Inventory (COGS)"
  expenses — purchases already flow into COGS through sales, so doing both would
  double-count.

---

## Security notes

- Access is **invite-only**: there is no public sign-up. Only accounts an admin
  creates can log in, and disabled accounts are rejected.
- Passwords are hashed with bcrypt; sessions are signed JWTs.
- All app routes are protected by middleware; the Team page additionally
  requires the ADMIN role.
- Use a strong, unique `AUTH_SECRET` and rotate it if it's ever exposed (this
  signs everyone out).

---

## Tax disclaimer

The tax estimator uses 2025 federal and California figures and a simplified
sole-proprietor / Schedule C model. It is a planning estimate to help you set
money aside — **not tax advice and not a substitute for a CPA.** Verify before
making estimated payments or filing.
