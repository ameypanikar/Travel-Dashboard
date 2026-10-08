# Travel Tracker Dashboard

An enterprise transit, accommodation, itinerary, and expense management platform built for modern corporate business travel.

Unifies multi-leg transit bookings (flights, trains, buses, hotels, corporate events), real-time transit intelligence, zero-knowledge encrypted notes, multi-currency corporate spend tracking, and automated print-ready expense vouchers.

---

## 📖 Comprehensive Documentation

Complete, in-depth documentation covering architecture, database models, security, and workflows is available in the [`docs/`](file:///home/embedded4/travel-tracker-dashboard/docs/README.md) directory:

1. [**01. Project Vision, Origins & Evolution**](file:///home/embedded4/travel-tracker-dashboard/docs/01_PROJECT_VISION_AND_EVOLUTION.md) — Why this platform was built, Google Sheets migration, and core value delivered.
2. [**02. Architecture & Tech Stack**](file:///home/embedded4/travel-tracker-dashboard/docs/02_ARCHITECTURE_AND_TECH_STACK.md) — TanStack Start, React 19, Supabase, Cloudflare Workers, directory anatomy, and search architecture.
3. [**03. Database Schema & Security Model**](file:///home/embedded4/travel-tracker-dashboard/docs/03_DATABASE_SCHEMA_AND_SECURITY.md) — 13 PostgreSQL tables, custom session auth, RLS, and Web Crypto AES-256-GCM encryption.
4. [**04. Core Features & User Workflows**](file:///home/embedded4/travel-tracker-dashboard/docs/04_CORE_FEATURES_AND_WORKFLOWS.md) — Transit cards, live PNR tracking, universal Omnisearch (`Ctrl+K`), Gemini AI receipt cropping/parsing, UPI upload animation, offline mode, and i18n.
5. [**05. Corporate Spend & Voucher Engine**](file:///home/embedded4/travel-tracker-dashboard/docs/05_CORPORATE_SPEND_AND_VOUCHERS.md) — Expense tracking, card separation, Frankfurter FX, shared cost math, 3x3/4x3 compact print grids, and print vouchers.
6. [**06. Scripts & Migration Guide**](file:///home/embedded4/travel-tracker-dashboard/docs/06_SCRIPTS_AND_MIGRATION_GUIDE.md) — Excel ingestion pipeline (`migrate-from-excel.ts`), database seed scripts, CLI verification tools.
7. [**07. Codebase Audit & Strategic Roadmap**](file:///home/embedded4/travel-tracker-dashboard/docs/07_AUDIT_FINDINGS_AND_ROADMAP.md) — Architectural strengths, technical debt findings, and phased engineering roadmap.

---

## 🚀 Quick Start & Development

### Prerequisites
- Node.js (v20+) or Bun
- Supabase account & project

### Local Development

```sh
# Clone repository
git clone <this-repository-url>
cd travel-tracker-dashboard

# Install dependencies
npm install

# Start local development server
npm run dev
```

The application runs on Vite 7 with TanStack Start at `http://localhost:3000`.

