# Architecture

Small Business Operating System (V1) helps a single-owner shop manage products, stock, bills, purchases, expenses, and day-end closing. It is not a CRM, not full accounting, and has no AI layer yet.

## Shape

```
Next.js (UI)
    → REST /api/v1/*
FastAPI (routers)
    → services (business rules)
    → SQLAlchemy
    → PostgreSQL (Supabase or local Docker)
```

Inventory math, prices, invoice numbers, and stock movements live only on the backend. The UI never writes stock directly.

## Tenancy

- Every business-owned row has `business_id`.
- Access is enforced in FastAPI by resolving the user from a Supabase JWT, then loading a `business_memberships` row.
- Queries always filter by that `business_id`. Client-supplied IDs are not trusted for tenancy.
- Schema supports multiple businesses per user and `OWNER` / `STAFF`. V1 API and UI behave as **OWNER only**.

## Inventory

`stock_transactions` is the source of truth.

- Positive quantity = stock in
- Negative quantity = stock out
- Current stock = `SUM(quantity)` for `(business_id, product_id)`
- Products have no `stock` column
- Opening stock is an `OPENING` transaction

Sale, purchase, and adjustment run in one database transaction. Product rows are locked with `SELECT … FOR UPDATE` so two bills cannot oversell the last units. Negative inventory is rejected.

Stock value (V1) = current qty × `products.purchase_price`.

## Sales

Prices come from the product row, not the request body.

In one commit: validate stock → allocate invoice number (`business_counters` row lock) → insert sale + items → insert negative `SALE` transactions.

## Purchases

Same atomic pattern with positive `PURCHASE` transactions.

## Daily closing

`daily_closings` is an immutable daily snapshot (values and unit totals), unique on `(business_id, business_date)`.

Quantities are not copied into another product/stock table. The next day’s opening **value** is the previous closing’s `closing_stock_value`. Live quantities remain the running sum of transactions.

## Auth

Email/password accounts are created through FastAPI (`POST /api/v1/auth/register` and `/login`). The API issues an HS256 JWT (`aud=authenticated`) and scopes all data by business membership.

Supabase Auth can still be used later: the same JWT verification path accepts a Supabase access token if `SUPABASE_JWT_SECRET` matches that project. Browser signs in and sends `Authorization: Bearer <access_token>`. Optional `X-Business-Id` selects a membership; V1 defaults to the user’s first business.

## Invoice PDF

`GET /api/v1/sales/{id}/invoice.pdf` is generated on the backend (ReportLab). Print via the browser; no printer SDK in V1.

## Out of scope (intentionally)

AI insights, WhatsApp, hardware printers, multi-store, customer CRM, weighted-average costing, staff permission UI, negative stock.
