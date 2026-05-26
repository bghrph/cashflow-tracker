# App Prompt & Functional Specification
## Personal Income & Expenses Tracker

---

## 1. App Overview

**App Name:** Income & Expenses Tracker

**Tagline:** A simple, powerful personal finance tracker that helps you log every dollar earned and spent, then automatically summarizes your cash flow month by month.

**Problem Statement:** Most people struggle to understand where their money goes each month. They need a lightweight, no-frills tool that lets them quickly log income and expenses against predefined categories, and then view an automatic monthly breakdown showing whether they're in the green or the red.

**Target Users:** Individuals, freelancers, small business owners, and households who want a straightforward way to track personal or small-business cash flow without the complexity of full accounting software.

---

## 2. Core Architecture (4 Modules)

The app is structured around **four distinct screens/modules**, each mapping to a tab in the original spreadsheet:

| Module | Purpose | User Interaction |
|---|---|---|
| **Instructions** | Onboarding & help guide | Read-only |
| **Setup** | Configure currency, income categories, expense categories | Full CRUD |
| **Transactions** | Log individual income and expense entries | Full CRUD |
| **Month Overview** | Auto-generated monthly summary dashboard | Read-only (select month/year) |

---

## 3. Module-by-Module Functional Specification

### 3.1 — Instructions Screen

**Purpose:** First-time onboarding and reference guide.

**Content:**
- Welcome message and motivational text
- Step-by-step walkthrough:
  - **Step 1:** Go to Setup → configure your currency, add income streams, and add expense categories
  - **Step 2:** Go to Transactions → log each income receipt or expense as it happens (date, type, category, amount, optional description)
  - **Step 3:** Go to Month Overview → select any month & year to see your auto-calculated summary
- Contact/support email
- Copyright / usage notice

**Behavior:**
- Static content, no data input
- Accessible from a help icon or navigation at any time

---

### 3.2 — Setup Screen

**Purpose:** One-time (or occasional) configuration of the user's financial categories.

**Data Model:**

```
Setup {
  currency: string           // e.g. "$", "€", "£"
  incomeCategories: string[] // user-defined income sources
  expenseCategories: string[] // user-defined expense types
}
```

**UI Elements:**
- **Currency field:** Single text input (cell B6) — user types their currency symbol
- **Income Categories:** A vertical list/column (Column D, starting row 7). Users can add up to ~50 income sources
- **Expense Categories:** A vertical list/column (Column E, starting row 7). Users can add up to ~50 expense types

**Business Rules:**
- Categories defined here populate the dropdown selectors on the Transactions screen
- Categories also flow into the Month Overview as row labels (linked via formulas like `=Setup!D7`, `=Setup!E7`)
- The currency symbol propagates to all other screens (via `=Setup!$B$6`)
- Users should be able to add, edit, and reorder categories

---

### 3.3 — Transactions Screen

**Purpose:** The core data-entry screen where users log every financial event.

**Data Model:**

```
Transaction {
  id: int                    // Auto-incrementing row number (1–2000)
  date: Date                 // When the transaction occurred
  type: enum["Income", "Expense"]  // Dropdown selector
  category: string           // Dropdown populated from Setup income or expense categories
  currency: string           // Auto-filled from Setup.currency
  amount: number             // Dollar (or currency) value
  description: string        // Optional free-text note
}
```

**UI Elements:**
- A scrollable table/list with columns: `#`, `Date`, `Type`, `Category`, `Amount`, `Description`
- **Date picker** for the date field
- **Dropdown (Type):** "Income" or "Expense"
- **Dropdown (Category):** Dynamically filtered — if Type = "Income", show only income categories from Setup; if Type = "Expense", show only expense categories
- **Amount:** Numeric input with currency symbol auto-prepended
- **Description:** Optional text field
- Capacity: Up to **2,000 transactions**

**Business Rules:**
- The `currency` column auto-fills from `Setup.currency` (formula: `=Setup!$B$6`)
- The `category` dropdown must be conditionally filtered based on the selected `type`
- Data validation should prevent:
  - Missing date on a transaction that has an amount
  - Negative amounts (amounts should always be positive; the type field determines sign)
  - Categories not in the Setup list
- Transactions are the **single source of truth** — the Month Overview reads from this data

---

### 3.4 — Month Overview Screen (Dashboard)

**Purpose:** An auto-calculated, read-only monthly summary that shows total income, total expenses, net balance, and a category-by-category breakdown.

**Inputs (User Selects):**
- **Month:** Dropdown — January through December
- **Year:** Numeric input (e.g. 2024)

**Computed Outputs:**

#### Summary Bar
```
Total Income:   [currency][calculated total]
Total Expenses: [currency][calculated total]
Balance:        [currency][income - expenses]
```

**Formulas (logic to replicate):**
- `Total Income = SUM of all income category amounts for the selected month`
- `Total Expenses = SUM of all expense category amounts for the selected month`
- `Balance = Total Income - Total Expenses`

#### Category Breakdown (Side-by-Side)

Two panels displayed side by side:

**INCOME panel:**
| Category | Amount |
|---|---|
| [Income Category 1] | [Calculated Amount] |
| [Income Category 2] | [Calculated Amount] |
| ... | ... |

**EXPENSE panel:**
| Category | Amount |
|---|---|
| [Expense Category 1] | [Calculated Amount] |
| [Expense Category 2] | [Calculated Amount] |
| ... | ... |

**Core Aggregation Formula (per category):**

```
CategoryTotal = SUMIFS(
    Transactions.Amount,
    Transactions.Date >= FirstDayOfSelectedMonth,
    Transactions.Date <= LastDayOfSelectedMonth,
    Transactions.Type == "Income" (or "Expense"),
    Transactions.Category == ThisCategoryName
)
```

This is the heart of the app — a `SUMIFS` that filters the Transactions table by date range, type, and category to produce per-category monthly totals.

**Business Rules:**
- This screen is **entirely read-only** — all values are computed
- Categories with $0 still display (showing the user everything they're tracking)
- The balance should be visually highlighted: **green** if positive, **red** if negative
- Date range is calculated as: first day of month → last day of month (using `DATE(year, month, 1)` and `EOMONTH`)

---

## 4. Data Flow Diagram

```
┌──────────┐       populates dropdowns        ┌──────────────┐
│          │ ──────────────────────────────▶   │              │
│  SETUP   │       currency symbol             │ TRANSACTIONS │
│          │ ──────────────────────────────▶   │              │
└──────────┘                                   └──────┬───────┘
     │                                                 │
     │  category labels                                │  raw transaction data
     │                                                 │
     ▼                                                 ▼
┌─────────────────────────────────────────────────────────────┐
│                      MONTH OVERVIEW                         │
│                                                             │
│  Reads category names from Setup                            │
│  Aggregates amounts from Transactions via SUMIFS            │
│  Filtered by user-selected Month + Year                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Technical Implementation Notes

### 5.1 — State Management
- **Setup data** (currency + categories) is the configuration layer — treat as app settings / user preferences
- **Transactions** is the primary data store — an append-only ledger (up to 2,000 rows)
- **Month Overview** is a derived/computed view — no stored state, pure aggregation

### 5.2 — Key Computations to Implement

| Computation | Logic |
|---|---|
| Month start date | `new Date(year, monthIndex, 1)` |
| Month end date | Last day of month (`EOMONTH` equivalent) |
| Category total | Filter transactions where `date` is within range AND `type` matches AND `category` matches, then sum `amount` |
| Total income | Sum of all income category totals |
| Total expense | Sum of all expense category totals |
| Net balance | Total income − Total expense |

### 5.3 — Validation Rules
- Transaction dates must be valid dates
- Transaction amounts must be non-negative numbers
- Transaction type must be "Income" or "Expense"
- Transaction category must exist in the corresponding Setup list
- Currency symbol is a free-text string (1–3 characters recommended)

### 5.4 — Scalability Constraints
- Supports up to **2,000 transactions** (matching the spreadsheet's row capacity)
- Supports up to **~50 income categories** and **~50 expense categories**
- If building as a web/mobile app, consider pagination or virtual scrolling for the transactions list

---

## 6. UI/UX Recommendations

### Visual Hierarchy
- **Month Overview** should feel like a dashboard — large summary numbers at top, detailed breakdown below
- **Transactions** should feel like a clean ledger — dense but scannable
- **Setup** should feel like a settings page — simple, minimal

### Color Coding
- **Income** → Green accent
- **Expense** → Red/coral accent
- **Positive balance** → Green text/background
- **Negative balance** → Red text/background
- **Currency symbol** → Subtle, muted color

### Key Interactions
- Month/year selector on the Overview should update the dashboard in real-time (no page reload)
- Adding a transaction should be fast — ideally a single-row inline form at the top of the list
- Category dropdowns should filter based on the Income/Expense toggle

---

## 7. Suggested Tech Stack Options

| Approach | Stack |
|---|---|
| **Web App (lightweight)** | HTML + Tailwind CSS + vanilla JS (localStorage) |
| **Web App (React)** | React + Tailwind + zustand/context for state |
| **Mobile App** | React Native or Flutter |
| **Full-Stack** | Next.js + Prisma + PostgreSQL |
| **Spreadsheet replacement** | Google Sheets API or Excel Online integration |

For an MVP, a single-page React app with localStorage persistence replicates 100% of the spreadsheet functionality with a better UX.

---

## 8. Summary

This app is a **personal cash flow tracker** with three user-facing workflows:

1. **Configure** your income and expense categories (once)
2. **Log** every transaction as it happens (ongoing)
3. **Review** your monthly financial summary (anytime)

The entire system is driven by one core computation: filtering and summing transactions by date range, type, and category. Everything else is configuration and presentation.
