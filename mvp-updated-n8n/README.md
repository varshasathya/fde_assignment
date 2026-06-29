# SliceMatic — Full-Stack Ordering System

A production-ready rebuild of the PizzaFlow MVP for **Stage 3**: a Next.js storefront on Vercel, Supabase Postgres for menu + orders, a Supabase-Auth admin dashboard, and an OpenRouter-powered recommendation engine. All Stage 2 business rules (validation, 10% discount at 5+, 18% GST on the post-discount total, three payment modes, order persistence) are preserved in one shared module.

It runs **out of the box with zero config** in an offline demo mode (menu falls back to local data, orders aren't persisted). Add Supabase + OpenRouter keys to go live.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS |
| Database | Supabase Postgres — `menu_items`, `orders`, `order_items` |
| Auth | Supabase Auth (email/password) for the admin dashboard |
| AI | OpenRouter chat completions, called from a server route |
| Hosting | Vercel |

---

## Quick start (local)

```bash
npm install
npm run dev          # http://localhost:3000
npm run test:pricing # verifies the bill engine against the reference numbers
```

Without any `.env.local`, the app runs in offline demo mode. To go live, copy `.env.local.example` to `.env.local` and fill it in.

## Supabase setup

1. Create a project at supabase.com.
2. **SQL Editor → New query →** paste `supabase/schema.sql` → **Run.** This creates the three tables, seeds the menu, and sets row-level security.
3. **Authentication → Users → Add user:** create your admin email + password (this logs into `/admin`).
4. **Project Settings → API:** copy the Project URL, the `anon` key, and the `service_role` key into `.env.local`.

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser | Public anon key (menu read, order insert, admin auth) |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Lets `/api/recommend` read order history |
| `OPENROUTER_API_KEY` | server only | AI recommendations (omit → friendly fallback) |
| `OPENROUTER_MODEL` | server only | Defaults to `meta-llama/llama-3.1-8b-instruct` |

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. vercel.com → **New Project →** import the repo (Next.js is auto-detected).
3. Add the five environment variables above in **Settings → Environment Variables.**
4. **Deploy.** You get a public URL that works on demo day.

---

## Architecture

```
Browser ──> Next.js (Vercel)
              ├─ /            ordering UI  ── Supabase (anon): read menu, insert order
              ├─ /admin       dashboard    ── Supabase Auth + read orders, CSV export
              └─ /api/recommend (server)   ── Supabase (service role) + OpenRouter LLM

lib/pricing.js   ← single source of truth: validation, discount, GST, payment text
```

Why a shared `lib/pricing.js`: the discount threshold, GST rate, and validation live in **one** place, imported by the UI and the test. Changing the discount threshold from 5 to 3 for the live demo is a one-line edit (`RULES.DISCOUNT_THRESHOLD`) that updates the UI hint, the bill, and the receipt together.

## AI feature — Recommendation engine (Option A)

After the customer enters name + phone, the app calls `/api/recommend`, which looks up their last five orders in Supabase and asks an LLM for one personalised crust + pizza + topping suggestion, shown above the menu. New customers get a crowd-pleaser. The OpenRouter key stays server-side.

**Model:** `meta-llama/llama-3.1-8b-instruct` (configurable) — fast and cheap for a one-sentence suggestion.

**System prompt** (in `app/api/recommend/route.js`):

> You are SliceMatic's friendly in-app pizza concierge for an outlet in New Ashok Nagar, Delhi. Recommend exactly ONE combination of crust + pizza + one topping from the menu, in ONE warm sentence (max 30 words). If the customer has order history, build on what they liked before. If they are new, suggest a crowd-pleaser. Never invent items that are not on the menu. Do not mention prices. Output only the sentence, no preamble.

---

## How this maps to the Stage 3 rubric

- **Vercel frontend, full flow, responsive** — `/` covers intake → menu → bill → payment → confirmation, mobile-first.
- **Supabase, 3+ tables, menu from DB** — `menu_items`, `orders`, `order_items`; menu loaded at runtime.
- **Auth + admin** — Supabase Auth login; orders with date + payment filters; revenue, top pizza, busiest hour; CSV export.
- **Stage 2 logic preserved** — `lib/pricing.js`, verified by `npm run test:pricing` (matches the ₹3,594.87 reference bill).
- **AI feature, system prompt documented** — recommendation engine above.

## Gaps from the Gradio MVP that this fixes

- **Real validation messages:** quantity and inputs accept free text, so out-of-range / non-integer / bad-phone inputs surface the exact rejection message (the slider-based MVP couldn't trigger these).
- **Per-mode payment confirmation:** Cash / Card / UPI each show a distinct, specific message.
