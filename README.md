





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

## Recently Completed Features

- **Landing Page UI Enhancements**: Professional, responsive landing page with mobile hamburger navigation, live dynamic statistics bar, scroll-reveal animations, and SVG social icons.
- **Credit Sales & Supplier Ledgers**: Complete accounting-style ledgers that automatically update based on sales and payments.
- **Reporting & Analytics**: Comprehensive reporting system with PDF and Excel export for sales, product performance, expiry, and cash flow.
- **Firebase Push Notifications**: Real-time alerts for expiring products, low stock, and credit sales.
- **Internationalization (i18n)**: Fully translated UI supporting English and Kinyarwanda across all components.
- **Security**: JWT authentication, refresh tokens, bcrypt password hashing, role-based access control (`boss` / `user`), database-level PII encryption, HTTPS enforcement, rate limiting, and full audit logging across inventory, sales, and user management routes.
- **Performance**: Pagination on all list endpoints, composite and single-column indexes on every heavily queried field (`business_id`, `party_name_hash`, `email_hash`, `created_at`), and lean API responses with no over-fetching.

## Planned After Customer Feedback

The following features are not yet built. They will be prioritized based on real usage, customer requests, and business feedback gathered after the initial launch.

| Feature | Description |
|---------|-------------|
| Barcode scanning | Scan product barcodes at the point of sale or during stock entry instead of searching manually. |
| Receipt printer integration | Print physical receipts directly from the sell page to a compatible thermal printer. |
| QR Code support | Generate QR codes for products or share payment details via QR. |
| Mobile application | A dedicated iOS and Android app for faster access on mobile devices. |
| SMS notifications | Send SMS alerts to business owners or customers for sales, payments, or low stock. |
| Email notifications | Send email receipts, credit reminders, and platform alerts. |
| Customer loyalty program | Track customer points, offer discounts, and reward repeat buyers. |
| Multi-branch support | Allow one business account to manage multiple shop locations with separate stock and sales. |
| Advanced analytics dashboard | Charts and visualizations for sales trends, top products, and profit margins over time. |
| AI-powered demand forecasting | Predict when stock will run out based on historical sales patterns. |
| Accounting integrations | Sync sales and ledger data with external accounting tools. |
| Electronic invoicing | Generate and send formal digital invoices to customers and suppliers. |
| Offline Support (PWA) | Continue operating without internet, queue transactions, and sync automatically when connectivity returns. |