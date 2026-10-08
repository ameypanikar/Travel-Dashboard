# Travel Tracker Dashboard — Documentation Index

Welcome to the comprehensive technical and operational documentation for the **Travel Tracker Dashboard**. This documentation suite details every aspect of the platform: its historical evolution, architecture, database design, zero-knowledge encryption, core transit workflows, automated corporate voucher accounting, diagnostic scripts, and future engineering roadmap.

---

## 📚 Documentation Directory

The documentation is organized into 7 focused manuals:

| Document | Focus Area | Description |
| :--- | :--- | :--- |
| [**01. Project Vision, Origins & Evolution**](file:///home/embedded4/travel-tracker-dashboard/docs/01_PROJECT_VISION_AND_EVOLUTION.md) | Origins & Strategy | Why the project was created, failure points of the original Google Sheets workflow, the 5-stage transformation, and corporate objectives. |
| [**02. Architecture & Tech Stack**](file:///home/embedded4/travel-tracker-dashboard/docs/02_ARCHITECTURE_AND_TECH_STACK.md) | System Design | Full-stack architecture (TanStack Start, React 19, Supabase, Cloudflare Workers), directory anatomy, Omnisearch architecture, and error-handling patterns. |
| [**03. Database Schema & Security Model**](file:///home/embedded4/travel-tracker-dashboard/docs/03_DATABASE_SCHEMA_AND_SECURITY.md) | Database & Crypto | Specifications of all 13 PostgreSQL tables, custom session auth (`login_secure`), Row-Level Security (RLS), and Web Crypto AES-256-GCM encryption. |
| [**04. Core Features & User Workflows**](file:///home/embedded4/travel-tracker-dashboard/docs/04_CORE_FEATURES_AND_WORKFLOWS.md) | Features & Transit | Multi-modal transit cards, universal Omnisearch (`Ctrl+K`), live transit trackers, Gemini AI receipt cropping, UPI upload animation, draft auto-saving, offline caching, and i18n. |
| [**05. Corporate Spend & Voucher Engine**](file:///home/embedded4/travel-tracker-dashboard/docs/05_CORPORATE_SPEND_AND_VOUCHERS.md) | Finance & Accounting | Corporate expense logging, card spend separation, Frankfurter FX, shared cost allocation, print-ready vouchers, resilient Google Drive receipts, and 3x3/4x3 print grids. |
| [**06. Scripts & Data Migration Guide**](file:///home/embedded4/travel-tracker-dashboard/docs/06_SCRIPTS_AND_MIGRATION_GUIDE.md) | Migration & Diagnostics | The Excel data migration pipeline (`migrate-from-excel.ts`), database seed scripts, hotfixes, and targeted CLI verification utilities. |
| [**07. Codebase Audit & Strategic Roadmap**](file:///home/embedded4/travel-tracker-dashboard/docs/07_AUDIT_FINDINGS_AND_ROADMAP.md) | Audit & Future Work | Critical evaluation of architectural wins, technical debt/security findings, and a 4-phase engineering roadmap (Realtime, PWA, ERP export). |

---

## 🧭 Recommended Reading Paths

Depending on your role or objective, here is the suggested reading sequence:

### For New Developers & Maintainers
1. Start with [**01. Project Vision & Evolution**](file:///home/embedded4/travel-tracker-dashboard/docs/01_PROJECT_VISION_AND_EVOLUTION.md) to understand why the app was built.
2. Read [**02. Architecture & Tech Stack**](file:///home/embedded4/travel-tracker-dashboard/docs/02_ARCHITECTURE_AND_TECH_STACK.md) for codebase structure and component hierarchy.
3. Review [**03. Database Schema & Security**](file:///home/embedded4/travel-tracker-dashboard/docs/03_DATABASE_SCHEMA_AND_SECURITY.md) before writing any database queries or mutations.
4. Check [**07. Audit Findings & Roadmap**](file:///home/embedded4/travel-tracker-dashboard/docs/07_AUDIT_FINDINGS_AND_ROADMAP.md) to see active tasks and upcoming features.

### For Security, DevOps & Database Administrators
1. [**03. Database Schema & Security Model**](file:///home/embedded4/travel-tracker-dashboard/docs/03_DATABASE_SCHEMA_AND_SECURITY.md) (PostgreSQL RLS policies, custom auth, zero-knowledge PBKDF2/AES-GCM encryption).
2. [**06. Scripts & Migration Guide**](file:///home/embedded4/travel-tracker-dashboard/docs/06_SCRIPTS_AND_MIGRATION_GUIDE.md) (Schema setup, migration scripts, and test harnesses).
3. [**07. Codebase Audit**](file:///home/embedded4/travel-tracker-dashboard/docs/07_AUDIT_FINDINGS_AND_ROADMAP.md#2-audit-findings--technical-debt) (Credential hygiene and dependency optimizations).

### For Product, HR & Accounting Auditors
1. [**04. Core Features & Workflows**](file:///home/embedded4/travel-tracker-dashboard/docs/04_CORE_FEATURES_AND_WORKFLOWS.md) (Transit tracking, daily itineraries, offline capability).
2. [**05. Corporate Spend & Voucher Engine**](file:///home/embedded4/travel-tracker-dashboard/docs/05_CORPORATE_SPEND_AND_VOUCHERS.md) (Receipt auditing, currency conversion, advance reconciliation, and print formats).

---

## ⚡ Quick Reference: Tech Stack Matrix

```
┌─────────────────┬────────────────────────────────────────────────────────┐
│ Layer           │ Technology / Provider                                  │
├─────────────────┼────────────────────────────────────────────────────────┤
│ Framework       │ TanStack Start + TanStack Router + React 19            │
│ Bundler & Build │ Vite 7                                                 │
│ Styling         │ Tailwind CSS v4 + Lucide React Icons                   │
│ Data Fetching   │ TanStack Query (React Query)                           │
│ Database        │ PostgreSQL 15 on Supabase                              │
│ Authentication  │ Custom Session Auth (Prefer: custom-auth-... header)   │
│ Encryption      │ Browser Web Crypto API (AES-256-GCM + PBKDF2 150k)     │
│ AI Vision       │ Google Gemini API (gemini-3.1-flash-lite)              │
│ FX / Weather    │ Frankfurter Currency API & Open-Meteo Weather API      │
│ Deployment      │ Cloudflare Workers / Nitro SSR Engine                  │
└─────────────────┴────────────────────────────────────────────────────────┘
```
