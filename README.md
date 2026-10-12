# UniMerch — SorSU Campus Marketplace

UniMerch is the official online marketplace of **Sorsogon State University (SorSU)**. It lets students, faculty, staff and the public buy campus goods, such as organization shirts, uniforms, ID laces and supplies, from student organizations and university offices in one place. It is built for the university community and the offices that govern it: the Business Affairs Office (BAO), the Supply Office, and the Verification Admin.

---

## 📌 Overview

**What problem it solves**
Campus merchandise is normally sold through scattered social-media posts, chat messages and paper lists. There is no single, trusted place to browse products, no consistent way to restrict items to the right people (e.g. faculty uniforms), and no clear record of sales and the royalty owed to the university for items that carry its official logo.

**Who it is for**
- **Buyers:** students, faculty, staff and guests who browse and order campus goods.
- **Sellers:** student organizations that sell their own products.
- **University offices:** the Supply Office and its campus branches, the BAO, and the Verification Admin, each with its own management dashboard.

**Why it matters**
UniMerch centralizes campus selling under university oversight. Every product is reviewed by the BAO before it goes live, buyer identities can be verified, restricted items reach only eligible buyers, and logo royalties are tracked and remitted with a receipt trail.

**High-level features**
- A public marketplace with search, categories, store pages, carts, checkout and order tracking
- Identity verification (COR / School ID) that unlocks restricted, role-based items
- Five management dashboards: Verification Admin, BAO, Supply Office (and its branches), and organization Sellers
- Product approval, inventory with stock history, sales reports and BAO analytics
- Official-logo royalty with remittance and BAO approval
- Real-time chat, notifications, and an installable mobile app (PWA)

> This system centralizes campus merchandise operations and improves efficiency, transparency and user experience across Sorsogon State University.

---

## 🏗️ System Architecture

**Frontend:** Next.js 16 (App Router) with React 19, TypeScript, Tailwind CSS 4, shadcn/ui and Base UI components, Lucide icons
**Backend:** Next.js Server Actions, Route Handlers and a request proxy (`proxy.ts`), running on the server side of the same app
**Database:** PostgreSQL on Supabase, with Row Level Security (RLS) policies, triggers and SQL functions; Supabase Storage for images and documents
**Authentication:** Supabase Auth (email + password and Google sign-in), with session cookies via `@supabase/ssr`
**Real-time:** Supabase Realtime (chat, notifications, cart sync)
**Deployment:** Vercel (with Vercel Analytics); the database and storage run on Supabase

---

## 📁 Folder Structure

```
/uni-merch
├── app/                  Pages and server actions (Next.js App Router)
│   ├── marketplace/        Buyer pages: home, search, cart, checkout, orders, messages
│   ├── seller/             Organization seller dashboard + public storefronts
│   ├── supply-office/      Supply Office dashboard
│   ├── cashier/            Supply Office branch dashboards
│   ├── bao/                BAO dashboard (approvals, royalty, analytics)
│   ├── admin/              Verification Admin dashboard
│   ├── auth/               Login, sign-up, password reset, terms acceptance
│   └── verify/             Identity verification
├── components/           Reusable UI (marketplace, management, store, messages, ui…)
├── lib/                  Shared logic: auth, dashboards, analytics, products, Supabase clients
├── scripts/              SQL setup scripts for the Supabase database
├── public/               Static files: seal, icons, service worker, offline page
├── proxy.ts              Session refresh, route protection and role redirects
└── next.config.mjs       Security headers, PWA settings
```

---

## 🚀 Features

**For buyers**
- Browse and search products by name, category, price, rating, campus and stock
- Store pages, store directory, follow stores, product reviews and ratings
- Cart that syncs across devices, checkout with GCash / bank receipt upload or walk-in payment
- Pre-orders with a pick-up date, ID check at the counter, and a penalty for unclaimed pre-orders
- Order tracking, reorder, in-app chat with sellers, and live notifications
- Restricted items shown only to eligible buyers (verified student / faculty / staff, or guest)

**For sellers (organizations)**
- Customizable storefront (logo, banner, accent color, layout) with a live preview
- Add and edit products with sizes, prices, stock, photos, payment options and restrictions
- Orders, payments, inventory, banners, buyer chat and a chat with the BAO
- Sales reports sent to the BAO, and official-logo royalty remittance

**For the Supply Office and its branches**
- Walk-in counter payments with cash and change, inventory and stock movement
- Restricted-item registry with buyer ID checks, branch management and sales reports

**For the BAO**
- Product approval queue, a view-only marketplace, product pulling and store violations
- BI analytics, royalty earnings and remittance review, sales report review and operational logs

**For the Verification Admin**
- Verification queue (COR / ID review), user management and duplicate-account detection
- Reported accounts, organization and branch management, dashboard admins and activity logs (including login-email changes)

**System-wide**
- Light and dark mode, installable PWA with an offline page, history-aware Back / Forward navigation
- Terms and Conditions and Privacy Policy with required agreement
- Security headers, encrypted transport (HTTPS) and storage encryption at rest by Supabase

---

## 🧰 Installation & Setup

### Prerequisites
- Node.js 20 or newer (developed on Node 24)
- [pnpm](https://pnpm.io/) (the project includes `pnpm-lock.yaml`; npm also works)
- Git
- A free [Supabase](https://supabase.com/) project (database, auth and storage)
- Optional: a Google Cloud OAuth client ID for "Continue with Google"

### Clone the repository
```bash
git clone https://github.com/krisestareja08-spec/SorSU_UniMerch.git
cd SorSU_UniMerch
```

### Install and run
UniMerch is a single Next.js app: the frontend and backend run together.
```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Other commands:
```bash
pnpm build        # production build
pnpm start        # run the production build
pnpm lint         # check code style
```

### Database setup
1. In the Supabase dashboard, open **SQL Editor**.
2. Paste the whole of `scripts/setup_all.sql` and click **Run**. It is safe to re-run.
3. Run `scripts/14_appoint_verification_admin.sql` after editing the email list at the bottom, so your account becomes the Verification Admin's Main Admin.
4. After pulling updates, run `scripts/32_performance.sql` again (it holds the newest database changes and is safe to re-run).

The scripts are numbered by when they were added; `setup_all.sql` combines them for a fresh install.

---

## 🔐 Environment Variables

Create a `.env.local` file in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
NEXT_PUBLIC_PHONE_OTP_ENABLED=false
```

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public (anon / publishable) key |
| `SUPABASE_URL` | Same project URL, used by server code |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret.** Server-only key used for admin tasks such as creating seller logins and changing store login emails. Never expose it in the browser. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Optional, enables Google sign-in |
| `NEXT_PUBLIC_PHONE_OTP_ENABLED` | `true` once an SMS provider is connected; phone numbers then need a 6-digit code |

`.env*` files are ignored by Git. Never commit keys.

**Storage buckets** (created by the SQL scripts): `product-images`, `order-receipts`, `verification-docs`, `preorder-ids`, `chat-images`, `store-banners`.

---

## 👤 User Guide

### Accessing the system
1. Open the deployed UniMerch URL.
2. **Register** with your email (or continue with Google) and agree to the Terms and Privacy Policy, or **log in**.
3. You land on the marketplace, or on your dashboard if you manage one.

### User roles
- **Buyer / Guest:** anyone with an account. Can browse, order, chat and review. Unverified users can buy everything that isn't restricted.
- **Verified member (student, faculty, staff):** a buyer whose COR / School ID was approved by the Verification Admin. Unlocks restricted items for their role.
- **Seller (organization):** manages a store: storefront, products, orders, inventory, reports and royalty. Each organization has a Main Admin who can add members and choose which pages they can use.
- **Supply Office / branch staff:** run the main Supply Office or a campus branch, with walk-in payments, inventory and restricted-item checks.
- **BAO:** approves products, monitors the marketplace, reviews sales reports, and approves royalty remittances.
- **Verification Admin:** reviews identity documents, manages users, organizations, branches and dashboard admins, and sees the activity logs.

Dashboard accounts manage and sell; they don't shop. Opening a buyer page sends them back to their own dashboard.

### Basic user actions
- **Browse items:** use search, categories, or the Stores page; open a product to choose a size and see its price.
- **Order:** add to cart, check out, pay by GCash / bank (upload the receipt) or walk-in, and track the order under **My Orders**.
- **Contact a seller:** use **Message Seller** on a product or **Contact Seller** on a storefront.
- **Get verified:** Settings → Verification → upload your documents.
- **Manage a store (sellers):** Products → Add Product / Edit product; Orders to confirm payments; Inventory to restock.
- **Reports and analytics:** stores send Sales Reports to the BAO; the BAO sees BI Analytics and Royalty Earnings.

---

## 🧑‍💻 Developer Guide

### Coding standards
- TypeScript and modern ES features throughout
- Server pages load data; client components handle interaction
- Server actions return results with `attempt()` / `unwrap()` (`lib/action-result.ts`) so users see real error messages
- Dashboard access goes through `requireDashboard()` / `assertDashboard()` (`lib/dashboards.ts`), never role checks on the user
- Database rules live in Row Level Security policies, not only in the UI
- Database changes go into the related existing SQL script (and `setup_all.sql`), not a new file per change
- Write meaningful commit messages

> **Note:** this project uses a recent Next.js version with breaking changes. Read the guides in `node_modules/next/dist/docs/` before changing framework-level code (see `AGENTS.md`).

### Branching workflow
- `main` — production
- `feature/*` — new features
- `fix/*` — bug fixes

### Pull request guidelines
- Describe the change clearly
- Attach screenshots for UI changes (check phone and desktop widths)
- Mention whether a SQL script must be re-run

---

## 🧪 Testing

There is no automated test suite yet. Before merging, run:
```bash
pnpm lint            # code style
npx tsc --noEmit     # type check
pnpm build           # production build must succeed
```
Then try the change in the browser at phone width (about 360px) and desktop width. For database changes, run the SQL in a Supabase test project first.

---

## 📦 Deployment

**App (Vercel)**
1. Import the GitHub repository into Vercel.
2. Add all environment variables from the table above (the service role key must be set as a secret).
3. Build command `pnpm build`; Vercel deploys on every push to `main`.

**Database (Supabase)**
1. Run `scripts/setup_all.sql`, then `14_appoint_verification_admin.sql`.
2. In Supabase Auth settings, add your site URL and `/auth/callback` to the allowed redirect URLs (needed for Google sign-in and email confirmation links).
3. After each update that changes the database, re-run `scripts/32_performance.sql`.

---

## 📊 System Requirements

**Users**
- A modern browser (Chrome, Edge, Safari or Firefox)
- A stable internet connection
- Phone, tablet or desktop; the app can be installed to the home screen

**Developers**
- 8 GB RAM minimum
- Node.js 20+ and pnpm
- A Supabase project (cloud)

---

## 📚 Documentation

- `scripts/` — database schema, policies and functions, in the order they were added
- `scripts/setup_all.sql` — complete database setup in one file
- `scripts/check_setup.sql` — read-only check that lists which setup scripts the database is still missing
- `data/final-manuscript-nganiiii-5af851.docx` — project manuscript
- `/terms` and `/privacy` pages inside the app — Terms and Conditions and Privacy Policy

---

**Developer:**
Bon, Kris Angela E.

**Project Members:**
- Monzales, Loren
- Gasid, Ralph James G.
- Teodocio, Cyrene Jane

## 📬 Contact

For questions or collaboration:

- Email: krisestareja08@gmail.com or kabon@sorsu.edu.ph
- LinkedIn: krisestareja08@gmail.com
- Socials: FB: Kris Estareja · IG: krezzuee
