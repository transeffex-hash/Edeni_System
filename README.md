





# EdeniSystem

EdeniSystem is a Rwanda-focused wholesaler and retailer management system. It is organized as a monorepo with a Next.js frontend and a FastAPI backend.

The goal of the system is to help small and medium businesses manage products, stock, sales, credit ledgers, notifications, business users, and platform administration from one guided application.

## Tech Stack

### Frontend

- **Framework**: Next.js 14 App Router
- **Language**: TypeScript
- **UI**: React 18
- **Styling**: Tailwind CSS
- **State management**: Zustand
- **Internationalization**: use-intl

### Backend

- **Framework**: FastAPI
- **Language**: Python
- **Database layer**: SQLAlchemy
- **Migrations**: Alembic
- **Authentication**: JWT stored in httpOnly cookies
- **Rate limiting**: SlowAPI

## Project Folder Structure

```text
EdeniSystem/
├── backend/
│   ├── alembic/                 # Database migration configuration and versions
│   ├── app/
│   │   ├── api/                 # FastAPI API router, route modules, and dependencies
│   │   ├── core/                # App settings, database, security, encryption, push, limiter
│   │   ├── models/              # SQLAlchemy database models
│   │   ├── schemas/             # Pydantic request and response schemas
│   │   ├── main.py              # FastAPI application entry point
│   │   ├── create_tables.py     # Helper for creating database tables
│   │   └── initial_data.py      # Initial seed data helper
│   ├── certs/                   # Local certificates or service credentials when needed
│   └── create_platform_admin.py # Helper script for platform admin setup
├── frontend/
│   ├── messages/                # Translation message files
│   ├── public/                  # Static public assets
│   ├── src/
│   │   ├── app/                 # Next.js App Router pages and layouts
│   │   ├── components/          # Reusable React components
│   │   ├── i18n/                # Internationalization setup
│   │   └── lib/                 # Shared frontend utilities and API helpers
│   ├── package.json             # Frontend dependencies and scripts
│   └── tsconfig.json            # TypeScript configuration
├── README.md                    # Project documentation
└── .gitignore                   # Files ignored by Git, including node_modules
```

## Frontend Pages and Routes

The frontend uses the Next.js App Router. Some pages exist in both non-localized and localized forms. Localized routes use `[locale]`, for example `/en/dashboard` or `/rw/dashboard` depending on the configured locale.

### Public and Auth Pages

| Route | Purpose |
|------|---------|
| `/` | Main landing or redirect page for the application. |
| `/login` | Business user login page. |
| `/register` | Business registration page for creating a business account. |
| `/[locale]` | Localized landing or redirect page. |
| `/[locale]/login` | Localized business user login page. |
| `/[locale]/register` | Localized business registration page. |

### Business App Pages

| Route | Purpose |
|------|---------|
| `/dashboard` and `/[locale]/dashboard` | Main business dashboard after login. |
| `/products` and `/[locale]/products` | Product list and inventory management area. |
| `/products/[id]/stock` and `/[locale]/products/[id]/stock` | Stock management page for a single product. |
| `/sell` and `/[locale]/sell` | Sales page for creating cash or credit sales. |
| `/analytics` and `/[locale]/analytics` | Business analytics and reporting dashboard. |
| `/[locale]/ledger` | Ledger overview for customer or supplier balances. |
| `/[locale]/ledger/[type]/[party]` | Detailed ledger page for one party. `type` identifies customer or supplier ledger, and `party` identifies the selected customer or supplier. |

### Platform Admin Pages

| Route | Purpose |
|------|---------|
| `/[locale]/admin/login` | Platform admin login page. |
| `/[locale]/admin/businesses` | Platform admin page for managing registered businesses. |

## Backend API Routes

All backend API routes are mounted under the `/api` prefix.

### Authentication: `/api/auth`

| Method and Route | Purpose |
|------------------|---------|
| `POST /api/auth/login` | Logs in a business user and sets an `access_token` httpOnly cookie. |
| `POST /api/auth/logout` | Logs out the current business user by clearing the auth cookie. |
| `POST /api/auth/register` | Creates a business and owner user, then logs the owner in. |

### Users: `/api/users`

| Method and Route | Purpose |
|------------------|---------|
| `GET /api/users/me` | Returns the currently authenticated user's ID, email, and role. |
| `POST /api/users/` | Allows a boss user to create another user for the same business. |

### Inventory: `/api/inventory`

| Method and Route | Purpose |
|------------------|---------|
| `POST /api/inventory/products` | Creates a product for the current business. |
| `GET /api/inventory/products` | Lists products for the current business with pagination. |
| `GET /api/inventory/products/{product_id}/units` | Lists configured units for one product. |
| `POST /api/inventory/products/{product_id}/units` | Creates a product unit and conversion factor. |
| `POST /api/inventory/stock` | Adds stock to a product, including quantity, unit, cost price, and expiry date. |

### Sales: `/api/sales`

| Method and Route | Purpose |
|------------------|---------|
| `POST /api/sales/` | Creates a sale, deducts stock using available batches, creates ledger entries for credit sales, and sends a best-effort sale notification to boss users. |

### Ledger: `/api/ledger`

| Method and Route | Purpose |
|------------------|---------|
| `POST /api/ledger/entries` | Creates a customer or supplier ledger entry. Positive amounts increase the balance, negative amounts reduce it. |
| `GET /api/ledger/entries` | Lists ledger entries by ledger type and optional party name. |
| `GET /api/ledger/balances` | Returns total balance per party for the selected ledger type. |

### Notifications: `/api/notifications`

| Method and Route | Purpose |
|------------------|---------|
| `POST /api/notifications/register-device` | Saves a device token for push notifications. |
| `POST /api/notifications/run-expiry-check` | Checks expiring stock batches and sends expiry alerts to boss users. |

### Platform Admin: `/api/admin`

| Method and Route | Purpose |
|------------------|---------|
| `POST /api/admin/login` | Logs in the platform admin and sets an `admin_token` httpOnly cookie. |
| `POST /api/admin/logout` | Logs out the platform admin. |
| `GET /api/admin/businesses` | Lists registered businesses for platform admin review. |
| `POST /api/admin/businesses/{business_id}/set-active` | Activates or deactivates a business. |
| `POST /api/admin/businesses/{business_id}/add-payment` | Adds a payment amount to a business account record. |
| `POST /api/admin/businesses/{business_id}/delete` | Soft-deletes a business and marks it inactive. |

## Developer Guidance

### Important Git Rule

Do not commit dependencies or generated files. The repository intentionally ignores `node_modules`, build output, local environment files, editor files, and cache folders. Another developer should install dependencies locally instead of receiving them through Git.

### Frontend Setup

From the `frontend` folder:

```bash
npm install
npm run dev
```

Common scripts:

```bash
npm run dev      # Start Next.js development server
npm run build    # Build frontend for production
npm run start    # Start production frontend server
npm run lint     # Run frontend linting
```

### Backend Setup

From the repository root or backend environment, install the backend Python dependencies used by the project, configure environment variables, run migrations if needed, then start the FastAPI app with Uvicorn.

Typical development command:

```bash
uvicorn backend.app.main:app --reload
```

### Authentication Flow

- Business users register or login through `/api/auth`.
- The backend stores the JWT in an httpOnly `access_token` cookie.
- Protected API routes use the current user dependency from the backend API dependencies.
- Platform admin routes use a separate `admin_token` cookie.

### Business Logic Notes

- Each business owns its own products, stock, users, sales, ledgers, and notification tokens.
- Stock is stored in batches and sale creation deducts stock from available batches.
- Credit sales automatically create customer ledger entries.
- Ledger entries use positive and negative amounts instead of manually editing balances.
- Sensitive personal data such as emails, phone numbers, and party names is encrypted and/or hashed before storage.

## Future Development Roadmap / System Requirements

The following features are considered part of the production version of EdeniSystem.

---

## 1. Credit Sales Ledger (Highest Priority)

The current ledger should be expanded into a complete accounting-style customer ledger.

### Objectives

Every customer who buys on credit must have a continuously updated ledger showing:

- Initial credit sale amount
- Every partial payment made
- Remaining balance after each payment
- Current outstanding balance
- Complete payment history
- Running balance after every transaction

Example:

| Date | Description | Debit (Credit Sale) | Credit (Payment) | Balance |
|------|-------------|--------------------:|-----------------:|--------:|
| 01 Jan | Credit Sale | 150,000 | - | 150,000 |
| 05 Jan | Payment | - | 50,000 | 100,000 |
| 10 Jan | Payment | - | 30,000 | 70,000 |
| 20 Jan | Credit Sale | 80,000 | - | 150,000 |
| 25 Jan | Payment | - | 150,000 | 0 |

The balance should never be manually calculated. It must always be generated from ledger transactions.

---

### Required Features

- Create ledger automatically whenever a credit sale is made.
- Automatically increase balance after every new credit sale.
- Automatically decrease balance after every payment.
- Allow unlimited partial payments.
- Allow multiple credit sales before previous balances are cleared.
- Never delete ledger history.
- Every ledger transaction must remain permanently auditable.
- Running balance must always be correct.

---

### Ledger Filters

The ledger page should support:

- Today
- Last 7 Days
- Last 30 Days
- This Month
- Custom Date Range
- All Time

Important:

When filtering to **Last 30 Days** (or any custom period), the system must calculate an **Opening Balance** from transactions before the selected period.

Example:

Opening Balance (before June 1): 350,000 RWF

Then display only transactions occurring after June 1.

Closing Balance should equal:

Opening Balance
+ Credit Sales
- Payments

This allows accountants to understand the customer's true financial position during the selected period.

---

### Ledger Summary

Display summary cards:

- Total Credit Sales
- Total Payments
- Outstanding Balance
- Opening Balance (if filtered)
- Closing Balance

---

## 2. Supplier Ledger

The same ledger system should also be implemented for suppliers.

It should track:

- Goods purchased on credit
- Payments made to suppliers
- Remaining payable balance
- Full transaction history
- Opening and closing balances

Business owners should always know:

- How much is owed to each supplier.
- Which suppliers have been fully paid.
- Which suppliers still have outstanding balances.

---

## 3. Firebase Push Notifications

Integrate Firebase Cloud Messaging (FCM).

Notifications should include:

### Expiry Notifications

- Products expiring in 30 days
- Products expiring in 14 days
- Products expiring in 7 days
- Products expiring today

---

### Stock Notifications

- Low stock
- Out of stock

---

### Credit Notifications

Notify business owners when:

- New credit sale is created
- Customer payment received
- Large outstanding balances exist

---

### Subscription Notifications

Notify owners before subscription expires.

Examples:

- 14 days remaining
- 7 days remaining
- 3 days remaining
- 1 day remaining
- Subscription expired

---

## 4. Internationalization (i18n)

Every visible text in the application must support translation.

Languages:

- English
- Kinyarwanda

Future-ready architecture should allow adding more languages without changing application logic.

This includes:

- Buttons
- Forms
- Validation messages
- Notifications
- Reports
- Receipts
- Dashboard
- Errors

No hardcoded strings should exist in frontend components.

---

## 5. Reports

Generate printable reports for:

- Daily Sales
- Weekly Sales
- Monthly Sales
- Product Performance
- Customer Credit Balances
- Supplier Balances
- Expiry Reports
- Profit Reports
- Cash Flow Reports

Support:

- PDF
- Excel
- Printing

---

## 6. Offline Support (PWA)

Since internet connectivity may be unreliable, the application should:

- Continue operating offline.
- Cache frequently used data.
- Queue transactions while offline.
- Automatically synchronize once internet returns.

---

## 7. Security

Production requirements include:

- JWT authentication
- Refresh tokens
- Password hashing
- Role-based permissions
- Audit logs
- HTTPS
- Database encryption for sensitive information

---

## 8. Performance

The system should remain responsive with:

- 100,000+ products
- 1,000,000+ ledger transactions
- Multiple concurrent users

Implement:

- Pagination
- Lazy loading
- Indexed database queries
- Optimized API responses

---

## 9. Future Modules

Planned future enhancements include:

- Barcode scanning
- Receipt printer integration
- QR Code support
- Mobile application
- SMS notifications
- Email notifications
- Customer loyalty program
- Multi-branch support
- Advanced analytics dashboard
- AI-powered demand forecasting
- Accounting integrations
- Electronic invoicing