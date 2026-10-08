# 06. Scripts & Data Migration Guide

This document details the maintenance, migration, and diagnostic scripts included in the repository root. These scripts facilitated the transition from legacy spreadsheets to Supabase PostgreSQL and provide operational tools for database verification.

---

## 1. The Excel Data Migration Pipeline (`migrate-from-excel.ts`)

When migrating from the legacy Google Sheets / Excel spreadsheet (`database.xlsx`) to Supabase, `migrate-from-excel.ts` was engineered to automate the extraction, data cleaning, and schema mapping.

### 1.1 Key Architecture of the Migration Script
- **Library**: Uses `xlsx` (SheetJS) to parse binary spreadsheet workbooks.
- **WebSocket Polyfill**: Polyfills global WebSocket (`(global as any).WebSocket = WebSocket`) so `@supabase/supabase-js` can operate in Node.js environments.
- **Header Stripping & Empty Row Elimination**:
  ```typescript
  const getSheetData = (sheetName: string) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];
    let rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as any[][];
    rows = rows.filter(r => r && r.some(cell => String(cell).trim() !== ''));
    return rows.slice(1); // Strip header row
  };
  ```
- **Batch Table Ingestion**: Ingests data across 11 distinct sheets in sequence:
  1. `Flights` $\rightarrow$ `flights`
  2. `Hotels` $\rightarrow$ `hotels`
  3. `Trains` $\rightarrow$ `trains`
  4. `Buses` $\rightarrow$ `buses`
  5. `Events` $\rightarrow$ `events`
  6. `Expenses` $\rightarrow$ `expenses`
  7. `Advances` $\rightarrow$ `advances`
  8. `Allowances` $\rightarrow$ `allowances`
  9. `NotesReminders` $\rightarrow$ `notes_reminders`
  10. `Documents` $\rightarrow$ `documents`
  11. `User Details` $\rightarrow$ `users`

### 1.2 How to Execute the Migration
```bash
# Ensure database.xlsx is placed in the project root
bun run migrate-from-excel.ts
# Or with npx tsx:
npx tsx migrate-from-excel.ts
```

---

## 2. Database Schema & Security Scripts

### 2.1 `supabase/schema.sql`
- Defines the fundamental 13 PostgreSQL tables with appropriate primary keys, foreign references, and default values.
- Configures Supabase Realtime publications:
  ```sql
  alter publication supabase_realtime add table flights;
  alter publication supabase_realtime add table hotels;
  alter publication supabase_realtime add table trains;
  alter publication supabase_realtime add table buses;
  alter publication supabase_realtime add table events;
  alter publication supabase_realtime add table expenses;
  alter publication supabase_realtime add table advances;
  alter publication supabase_realtime add table allowances;
  alter publication supabase_realtime add table notes_reminders;
  alter publication supabase_realtime add table documents;
  ```

### 2.2 `secure_database.sql`
- **Session Username Extractor (`get_session_username()`)**: Parses the `Prefer: custom-auth-<token>` header injected by the client and returns the authenticated `username`.
- **Atomic Authentication Procedure (`login_secure`)**: Verifies plain or SHA-256 hashed passwords and creates an active 30-day session token in `sessions`.
- **Row-Level Security Policies**: Enables RLS on all 13 tables and establishes access permissions for authenticated users and system managers.

### 2.3 `fix-rls.sql`
- Applied to resolve manager permission updates on the `users` table:
  ```sql
  CREATE POLICY "managers_can_manage_users" ON users FOR ALL
  USING (
    (SELECT role FROM sessions WHERE username = current_setting('request.jwt.claims', true)::json->>'username' LIMIT 1) IN ('System Manager', 'Owner')
  );
  ```

---

## 3. Diagnostic & Verification Scripts

The repository contains several targeted CLI tools used during integration testing:

### 3.1 `test-login.mjs`
Tests the PostgreSQL `login_secure` RPC directly from the command line without launching the browser UI:
```bash
node test-login.mjs
```
*Validates that username matching, password verification (plain and SHA-256), and session token issuance succeed.*

### 3.2 `test-bus.mjs` & `test-bus2.mjs`
Verifies bus booking insertions, testing column alignment (`from_station` vs `cityfrom`):
```bash
node test-bus.mjs
```

### 3.3 `test-fx.ts`
Tests the Frankfurter Foreign Exchange API endpoint to ensure historical rates resolve properly for non-INR currencies:
```bash
bun run test-fx.ts
```

### 3.4 `query-users.ts` & `query-receipts.ts`
Fast CLI utilities to inspect database records:
```bash
bun run query-users.ts     # Lists all registered system users and their roles
bun run query-receipts.ts  # Inspects receipt records and validates Storage URLs
```

### 3.5 `extract-har.js`
A developer utility to parse HTTP Archive (`network.har`) files recorded during browser sessions, extracting JSON responses returned by legacy Apps Script webhooks during the initial reverse-engineering phase.

---

## 4. Script Reference Summary Table

| Script File | Execution Environment | Core Responsibility |
| :--- | :--- | :--- |
| `migrate-from-excel.ts` | Node.js / Bun | Reads `database.xlsx` and batch-populates all Supabase tables. |
| `migrate-data.ts` | Node.js / Bun | Secondary data transformation and normalization utility. |
| `secure_database.sql` | Supabase SQL Editor | Implements `login_secure`, `get_session_username`, and RLS policies. |
| `fix-rls.sql` | Supabase SQL Editor | Hotfix for manager RLS policies on the `users` table. |
| `test-login.mjs` | Node.js | CLI test script verifying login RPC behavior. |
| `test-bus.mjs` | Node.js | CLI test script testing bus booking inserts. |
| `test-fx.ts` | Bun | Validates currency exchange rate resolution. |
| `query-users.ts` | Bun | Quick audit of registered system users. |
| `query-receipts.ts` | Bun | Quick audit of uploaded receipt records and Storage links. |
| `extract-har.js` | Node.js | Extracts JSON payloads from browser network HAR recordings. |
