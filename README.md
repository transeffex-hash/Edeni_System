





# EdeniSystem

Monorepo for a Rwanda-focused wholesaler/retailer management system.

...

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