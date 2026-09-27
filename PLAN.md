# PLAN — Multi-Vendor Marketplace

This document is the build plan: database schema, API surface, and a phased checklist.
Architectural choices and trade-offs are recorded in [DECISIONS.md](./DECISIONS.md).

## 1. Domain rules (summary)

- All money is stored as **integer minor units (paise)**, currency `INR`.
- A customer checkout creates one `Order` that is split into one `SubOrder` per vendor.
- Stock is **reserved (deducted) at checkout** inside a DB transaction using a conditional
  `UPDATE … WHERE stock >= qty`. If payment fails / expires / the sub-order is cancelled,
  stock is restored.
- An order's payment is only ever marked successful by the **server** — via signature
  verification (`/payments/verify`) or a signed webhook — never by the client.
- SubOrder status flow: `PLACED → PACKED → SHIPPED → DELIVERED`, or `CANCELLED` from
  `PLACED`/`PACKED`. Vendors can only act on sub-orders whose parent order is `PAID`.
- Commission rate is a platform setting (basis points, default `1000` = 10%). It is
  **snapshotted** on every SubOrder at checkout so later changes never rewrite history.
  `vendorEarnings = subtotal − commission`.
- Earnings become payable when a SubOrder is `DELIVERED` and not refunded. Admin
  generates `Payout` batches per vendor and marks them `PAID`.

## 2. Database schema (Prisma)

```prisma
enum Role            { CUSTOMER VENDOR ADMIN }
enum VendorStatus    { PENDING APPROVED REJECTED }
enum PaymentStatus   { PENDING PAID FAILED CANCELLED }           // Order-level
enum SubOrderStatus  { PLACED PACKED SHIPPED DELIVERED CANCELLED }
enum PaymentProvider { RAZORPAY MOCK }
enum PaymentRecordStatus { CREATED CAPTURED FAILED }
enum PayoutStatus    { PENDING PAID }
enum RefundStatus    { REQUESTED APPROVED REJECTED }

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String
  role         Role     @default(CUSTOMER)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  vendor         Vendor?
  refreshTokens  RefreshToken[]
  cartItems      CartItem[]
  orders         Order[]
  reviews        Review[]
  refundRequests RefundRequest[]
}

model RefreshToken {           // rotated on every refresh; reuse => family revoked
  id        String    @id @default(cuid())
  userId    String
  tokenHash String    @unique   // sha256 of the opaque token
  familyId  String
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime  @default(now())
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Vendor {
  id              String       @id @default(cuid())
  userId          String       @unique
  storeName       String       @unique
  slug            String       @unique
  description     String
  status          VendorStatus @default(PENDING)
  rejectionReason String?
  approvedAt      DateTime?
  createdAt       DateTime     @default(now())
  user      User       @relation(...)
  products  Product[]
  subOrders SubOrder[]
  payouts   Payout[]
}

model Category { id, name @unique, slug @unique, createdAt, products Product[] }

model Product {
  id          String   @id @default(cuid())
  vendorId    String
  categoryId  String
  title       String
  slug        String   @unique
  description String
  price       Int                     // paise
  stock       Int                     // CHECK-like guard enforced in service layer
  isActive    Boolean  @default(true)  // soft delete / hide
  avgRating   Float    @default(0)
  reviewCount Int      @default(0)
  images      ProductImage[]
  @@index([categoryId]) @@index([vendorId]) @@index([price])
}

model ProductImage { id, productId, url, storageKey?, position }

model CartItem { id, userId, productId, quantity, @@unique([userId, productId]) }

model Order {
  id            String        @id @default(cuid())
  customerId    String
  paymentStatus PaymentStatus @default(PENDING)
  totalAmount   Int
  currency      String        @default("INR")
  // shipping address snapshot
  shippingName, shippingPhone, shippingLine1, shippingLine2?, shippingCity,
  shippingState, shippingPostalCode, shippingCountry
  paidAt DateTime?
  createdAt, updatedAt
  subOrders SubOrder[]
  payment   Payment?
}

model SubOrder {
  id                String         @id @default(cuid())
  orderId           String
  vendorId          String
  status            SubOrderStatus @default(PLACED)
  subtotal          Int
  commissionRateBps Int            // snapshot
  commissionAmount  Int
  vendorEarnings    Int
  trackingNumber    String?
  carrier           String?
  packedAt, shippedAt, deliveredAt, cancelledAt DateTime?
  cancelReason      String?
  refundedAmount    Int            @default(0)
  payoutId          String?
  items          OrderItem[]
  refundRequests RefundRequest[]
  statusHistory  SubOrderEvent[]
}

model SubOrderEvent { id, subOrderId, status, note?, createdAt }   // tracking timeline

model OrderItem {
  id, subOrderId, productId,
  productTitle String   // snapshot
  imageUrl     String?  // snapshot
  unitPrice    Int
  quantity     Int
  lineTotal    Int
}

model Payment {
  id                String @id
  orderId           String @unique
  provider          PaymentProvider
  providerOrderId   String @unique
  providerPaymentId String?
  status            PaymentRecordStatus @default(CREATED)
  amount            Int
  currency          String
  failureReason     String?
  createdAt, updatedAt
}

model WebhookEvent {           // idempotency ledger for webhooks
  id String @id, provider PaymentProvider, eventId String @unique,
  type String, payload Json, processedAt DateTime @default(now())
}

model Review {
  id, productId, userId, rating Int (1..5), comment, createdAt
  @@unique([productId, userId])   // one review per buyer per product
}

model Payout {
  id, vendorId, amount Int, status PayoutStatus @default(PENDING),
  subOrders SubOrder[], createdAt, paidAt?, reference?
}

model RefundRequest {
  id, subOrderId, customerId, reason, amount Int,
  status RefundStatus @default(REQUESTED), adminNote?, providerRefundId?,
  createdAt, resolvedAt?
}

model Setting { key String @id, value String, updatedAt }   // e.g. commission_rate_bps
```

## 3. API endpoints (`/api`)

All responses are JSON. Errors: `{ "error": { "code": string, "message": string, "details"?: any } }`.
Every endpoint validates `params`/`query`/`body` with Zod.

| Area | Method & path | Role |
|---|---|---|
| Health | `GET /health` | public |
| Auth | `POST /auth/register` | public (rate-limited) |
| | `POST /auth/login` | public (rate-limited) |
| | `POST /auth/refresh` (httpOnly cookie) | public (rate-limited) |
| | `POST /auth/logout` | public |
| | `GET /auth/me` | any authed |
| Categories | `GET /categories` | public |
| | `POST /admin/categories`, `PATCH /admin/categories/:id`, `DELETE /admin/categories/:id` | ADMIN |
| Catalog | `GET /products?search&category&minPrice&maxPrice&sort&page&limit` | public |
| | `GET /products/:slug` | public |
| | `GET /products/:id/reviews?page` | public |
| | `POST /products/:id/reviews` | CUSTOMER (verified buyer) |
| | `GET /products/:id/reviews/eligibility` | authed |
| Vendors | `POST /vendors/apply` | CUSTOMER |
| | `GET /vendors/me` | authed |
| | `GET /vendors/:slug` | public (approved store page) |
| Vendor products | `GET /vendor/products`, `POST /vendor/products`, `GET/PATCH/DELETE /vendor/products/:id` | VENDOR (approved) |
| | `POST /vendor/products/:id/images` (multipart), `DELETE /vendor/products/:id/images/:imageId` | VENDOR |
| Vendor orders | `GET /vendor/orders?status&page`, `GET /vendor/orders/:id`, `PATCH /vendor/orders/:id/status` | VENDOR |
| Vendor analytics | `GET /vendor/analytics?days=30` | VENDOR |
| Vendor payouts | `GET /vendor/payouts` | VENDOR |
| Cart | `GET /cart`, `POST /cart/items`, `PATCH /cart/items/:productId`, `DELETE /cart/items/:productId`, `DELETE /cart` | CUSTOMER |
| Checkout | `POST /orders/checkout` → creates Order+SubOrders, reserves stock, creates payment order | CUSTOMER |
| Orders | `GET /orders`, `GET /orders/:id` | CUSTOMER (own) |
| | `POST /orders/:id/sub-orders/:subOrderId/cancel` | CUSTOMER (own) |
| | `POST /orders/:id/cancel` (only while payment pending) | CUSTOMER |
| | `POST /orders/:id/sub-orders/:subOrderId/refund-requests` | CUSTOMER |
| Payments | `GET /payments/config` (provider + public key) | public |
| | `POST /payments/verify` | CUSTOMER |
| | `POST /payments/webhook/razorpay` (raw body, HMAC) | provider |
| | `POST /payments/mock/:providerOrderId/pay` (mock gateway only) | CUSTOMER |
| Admin | `GET /admin/dashboard?days=30` | ADMIN |
| | `GET /admin/vendors?status`, `POST /admin/vendors/:id/approve`, `POST /admin/vendors/:id/reject` | ADMIN |
| | `GET /admin/orders?paymentStatus&page`, `GET /admin/orders/:id` | ADMIN |
| | `GET /admin/settings`, `PATCH /admin/settings/commission` | ADMIN |
| | `GET /admin/payouts`, `POST /admin/payouts/generate`, `POST /admin/payouts/:id/mark-paid` | ADMIN |
| | `GET /admin/refunds?status`, `POST /admin/refunds/:id/approve`, `POST /admin/refunds/:id/reject` | ADMIN |

## 4. Phased checklist

### Phase 1 — Foundation & auth
- [x] Monorepo (npm workspaces), docker-compose (Postgres), .env.example files
- [x] Server skeleton: Express 5, helmet, CORS, cookie-parser, logging, centralised errors, Zod validate middleware
- [x] Prisma schema + initial migration
- [x] Auth: register/login/refresh (rotation + reuse detection)/logout/me, bcrypt, JWT
- [x] `authenticate` + `requireRole` middleware, rate limiting on auth routes
- [x] Email service interface (console)
- [x] Client skeleton: Vite + React + TS + Tailwind + Router + TanStack Query + toasts
- [x] Client auth context with silent refresh, login/register pages, protected routes
- [x] Tests: auth flow (server), ProtectedRoute (client); lint + type-check

### Phase 2 — Catalog & vendor products
- [x] Categories (public list + admin CRUD)
- [x] Vendor application + status
- [x] Vendor product CRUD, image upload via storage interface (local disk)
- [x] Public catalog: search, category filter, price sort, pagination; product detail
- [x] Client: catalog, product detail, vendor apply, vendor product management
- [x] Tests

### Phase 3 — Cart, checkout & payments
- [ ] Cart API (multi-vendor), client cart page
- [ ] Checkout: address, order split per vendor, stock reservation
- [ ] Payment provider interface: Razorpay (test mode) + Mock provider
- [ ] Signature verification, idempotent webhooks (captured / failed), stale-order expiry
- [ ] Client checkout + Razorpay Checkout / mock payment dialog
- [ ] Tests (signature, webhook idempotency, checkout)

### Phase 4 — Orders, sub-orders & inventory
- [ ] Customer order history + detail with per-sub-order tracking timeline
- [ ] Vendor order list + status transitions (state machine)
- [ ] Cancellation restores stock (+ auto-refund if paid)
- [ ] Concurrency test: two buyers, last unit
- [ ] Tests

### Phase 5 — Admin, commission & payouts
- [ ] Admin: vendor approval, categories, all orders, commission setting
- [ ] Platform dashboard (GMV, commission, daily chart, top vendors)
- [ ] Vendor analytics (daily sales, top products, pending orders) + payout summary
- [ ] Payout generation & mark-paid; refund request handling
- [ ] Client admin panel + vendor dashboard charts
- [ ] Tests

### Phase 6 — Reviews, polish & tests
- [ ] Reviews (verified buyers only), rating aggregates
- [ ] Seed script with realistic demo data
- [ ] UI polish: loading/empty/error states, responsive layout
- [ ] README (features, Mermaid architecture, setup, credentials), DECISIONS.md
- [ ] Final full lint/type-check/test pass
