# Shop OS — Small Business Operating System

Helps a small shop owner manage products, stock, bills, purchases, expenses, and day-end closing. It is **not** a CRM, not full accounting, and has no AI layer in V1.

The important loop is:

**Product → Bill or Purchase → Stock transaction → Current stock**

and

**Day’s activity → Daily closing snapshot → Next day’s opening value**

Stock is never edited by hand on the product row. Completing a bill reduces stock; recording a purchase increases it.

## Architecture

```
Next.js (UI)
    → REST /api/v1/*
FastAPI (routers)
    → services (inventory, sales, purchases, closing)
    → SQLAlchemy
    → PostgreSQL (local Docker or Supabase)
```

Inventory math, prices, invoice numbers, and stock movements live on the backend. The UI never writes stock directly. See [docs/architecture.md](docs/architecture.md).

## Tech stack

- Frontend: Next.js 15, TypeScript, React, Tailwind CSS
- Backend: Python, FastAPI, Pydantic, SQLAlchemy 2, Alembic
- Database: PostgreSQL
- Auth: Supabase Auth (JWT verified by FastAPI)

## Local setup

You need Docker (Postgres), Python 3.12+, Node 20+, and a Supabase project (Auth).

### 1. Database

```bash
docker compose up -d
```

This starts Postgres on `localhost:5432` (`sbos` / `sbos`) and creates `sbos_test` for pytest.

### 2. Environment variables

Copy the examples:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | backend | App database |
| `TEST_DATABASE_URL` | backend | Pytest database |
| `SUPABASE_JWT_SECRET` | backend | JWT secret from Supabase **Project Settings → API → JWT Secret** |
| `SUPABASE_URL` | backend | Optional, unused by V1 API besides documentation |
| `CORS_ORIGINS` | backend | `http://localhost:3000` |
| `NEXT_PUBLIC_API_URL` | frontend | `http://localhost:8000` |
| `NEXT_PUBLIC_SUPABASE_URL` | frontend | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | frontend | Supabase anon key |

Never put the JWT secret or database password in the frontend.

### 3. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Health check: [http://localhost:8000/health](http://localhost:8000/health)

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Create an account with email and password (stored in your local Postgres). First visit creates the shop on `/setup`.

Supabase Auth can be wired later. For V1 local use, the FastAPI `/api/v1/auth/register` and `/login` endpoints issue the same JWT the API already verifies.

### 5. Tests

```bash
cd backend
source .venv/bin/activate
pytest
```

Postgres must be running. Tests cover product + opening stock, sale/purchase stock changes, insufficient stock, adjustments, daily closing (including duplicate close and next-day opening), and business isolation.

### 6. Seed data

Sign up in the app, then copy your user UUID from Supabase **Authentication → Users**.

```bash
cd backend
source .venv/bin/activate
SEED_USER_ID=<supabase-user-uuid> SEED_USER_EMAIL=you@example.com python -m scripts.seed
```

Creates **Demo Store** with Rice 5kg, Oil 1L, Sugar 2kg, Milk 1L, Bread, opening stock, sample bills, a purchase, and expenses.

## Main screens

| Path | What it does |
|---|---|
| `/login` | Sign in / create account |
| `/setup` | First-time shop setup |
| `/dashboard` | Today’s sales, bills, purchases, expenses, stock alerts |
| `/sell` | New bill (POS) |
| `/products` | Catalogue + stock |
| `/stock` | Inventory dashboard |
| `/purchases/new` | Record purchase (adds stock) |
| `/expenses` | Record expenses |
| `/closing` | Close the business day |
| `/sales/[id]` | Bill + printable PDF |

## Product principles (V1)

No AI, WhatsApp, printers, CRM, multi-store, or negative inventory. Staff roles exist in the database; the app behaves as **OWNER** only.
