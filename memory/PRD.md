# ROOTS Order Sheet — PRD

## Original Problem Statement
User uploaded `AMBALA CITY ORDER SHEET-9.xlsx` (a multi-sheet Excel workbook used by ROOTS restaurant chain in Ambala City to plan orders, forecast sales, and reconcile receiving across outlets). User asked to convert it into a web app.

### User choices
- App type: Web app
- Data seeding: Start blank (manual entry)
- Users: Multi-user with login (JWT-based custom auth)
- Theme: Clean modern (Organic & Earthy palette — deep terracotta accents)
- Priority feature: **Order generation** (forecast → to-order list)

## Personas
1. **Admin / Owner** — configures business settings, monitors health KPIs, has full access
2. **Cantt Outlet Operator** — packs orders, records "Delivered" qty
3. **City Outlet Operator** — receives orders, records "Received" qty, flags variance
4. **General Operator** — enters recipes, forecasts, inventory

## Core Requirements (from Excel workflow)
1. Recipe Mapping: ingredient → SKU with qty, cost, category, selling price
2. SKU Sales Forecast per 10 order cycles
3. Auto-computed Cycle Planning (Required = Σ recipe.qty × forecast.sku)
4. Order-to-be-Packed list per cycle grouped by stock category (FROZEN / DRY STOCK / MISE-EN / BREADS / DIARY)
5. Cantt-vs-City delivered/received variance tracking
6. Owner KPI dashboard with Health Score

## Architecture
- **Backend**: FastAPI + Motor (async MongoDB) + PyJWT + bcrypt. Cookie-based JWT auth (httpOnly access + refresh tokens).
- **Frontend**: React 19 + React Router 7 + Tailwind + Recharts + Sonner + Shadcn UI. Cabinet Grotesk (headings) + IBM Plex Sans (body).
- **DB collections**: users, settings (singleton), recipes, forecasts, ingredients

## Implemented (2026-02)
- ✅ Multi-user auth: register, login, logout, /me, cookie-based JWT
- ✅ Admin auto-seeded (admin@roots.com / admin123)
- ✅ Setup page: business config + ingredient categorization
- ✅ Recipe Mapping CRUD with search
- ✅ SKU Forecast entry (10 cycles per SKU, batch save)
- ✅ Cycle Planning: auto-computed Required, editable Inventory/Wastage, live To-Order calc
- ✅ Order to be Packed (priority): grouped by stock category, delivered/received entry, variance, CSV export, cycle selector
- ✅ Variance Check: reconciliation report with OK/CHECK/MISSING status
- ✅ Owner Summary Dashboard: Health Score, KPI tiles, Recharts (sales vs order value, wastage/cycle)
- ✅ End-to-end tested (backend 20/20 pytest + frontend Playwright e2e all pass)

## Backlog

### P1
- Excel/PDF export for Order-to-be-Packed
- Import existing Excel file directly (bulk-load recipes and forecasts)
- Per-cycle date scheduling (dates for each of 10 cycles)
- Attach photos/comments to receiving items (from "COMMENT RECIEVING" section in the original Excel)

### P2
- Multi-outlet support (ambala-city, ambala-cantt as first-class entities)
- Historical cycle archiving (rollover to next month)
- Wastage rate benchmarks per ingredient
- SKU sales history vs forecast accuracy report
- Push notifications when Variance > threshold
- Recipe cost auto-recalc when ingredient cost changes

### P3
- Mobile responsive receiving workflow (Cantt/City operators on phones)
- Supplier management + auto PO generation
- Menu item image gallery
