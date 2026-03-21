# Revolut Payments Research — CoachFit Integration Options

**Date**: 2026-03-21
**Context**: Hitsona Bangor uses Revolut Business as their bank account. Need to accept payments for credit packs (£9.99-£275), 8-week challenges (£250), and monthly subscriptions.

---

## Key Finding: Two Separate Revolut APIs

Revolut has **two distinct APIs** — this is critical to understand:

### 1. Business API (financial operations)
- **Purpose**: Automate business finances — view accounts, manage counterparties, make payments, exchange currencies
- **NOT for**: Accepting payments from customers
- **Auth**: OAuth 2.0 + JWT, scopes: READ, WRITE, PAY
- **Requires**: Grow plan or above
- **Webhooks**: TransactionCreated, TransactionStateChanged (can detect incoming bank transfers)
- **Use case for CoachFit**: Could auto-detect incoming payments by reference number and auto-approve credit submissions

### 2. Merchant API (accepting payments)
- **Purpose**: Accept online payments from customers
- **This is what CoachFit needs for payment acceptance**
- **The Merchant account is a sub-account of your Business account**
- **Auth**: Secret API Key (server-side only) + Public API Key (client-side widget)

---

## Revolut Merchant API — Full Breakdown

### Payment Methods Supported
- Visa, Mastercard, American Express, Maestro
- Apple Pay, Google Pay
- Revolut Pay (1-click for Revolut users)
- Pay by Bank (open banking)

### Integration Options (3 tiers, simplest first)

#### Option A: Payment Links (simplest — recommended for CoachFit MVP)
- Generate payment links via API (`POST /orders` returns `checkout_url`)
- Client clicks link → lands on Revolut-hosted checkout page
- Supports pre-filled amounts, descriptions, metadata
- Zero frontend code needed — just generate the link
- Webhook confirms payment → auto-approve credit submission

#### Option B: Hosted Checkout Page (medium complexity)
- Create an order via API (`POST /orders`)
- Redirect client to Revolut's hosted checkout page (`checkout_url`)
- Revolut handles all PCI compliance, card forms, 3D Secure
- Webhook callback on payment completion
- Can brand with logo/colors

#### Option C: Revolut Checkout Widget (embedded — most control)
- Embed checkout widget directly in CoachFit UI
- `@anthropic-ai/revolut-checkout` or `RevolutCheckout.js` SDK
- All payment methods in one widget (card, Apple Pay, Google Pay, Revolut Pay)
- Full control over UX
- Still Revolut handles PCI compliance

### Fees (UK/GBP)
- **Card payments**: From 0.8% + £0.02 per transaction
- **Revolut Pay**: 1% + £0.20 flat per transaction
- **No contracts, no commitment** — pay per successful transaction only
- **Next-day settlement** (even weekends)

### Fee Examples for CoachFit Products
| Product | Price | Card Fee (0.8%+£0.02) | Revolut Pay Fee (1%+£0.20) |
|---------|-------|----------------------|---------------------------|
| 1 Session Pass | £9.99 | £0.10 | £0.30 |
| 3 PT Sessions | £110.00 | £0.90 | £1.30 |
| 8 Week Challenge | £250.00 | £2.02 | £2.70 |
| 10 PT Sessions | £275.00 | £2.22 | £2.95 |

### API Flow (Create Order → Payment)
```
1. CoachFit server: POST /orders
   Body: { amount: 25000, currency: "GBP", description: "8 Week Challenge", metadata: { creditProductId, clientId } }
   Response: { id: "order_xxx", checkout_url: "https://checkout.revolut.com/..." }

2. Client clicks checkout_url → Revolut hosted page → pays

3. Revolut webhook → POST /api/webhooks/revolut
   Event: ORDER_COMPLETED
   Body: { order_id: "order_xxx", metadata: { creditProductId, clientId } }

4. CoachFit auto-processes: approve credit submission, topup credits
```

### Webhook Events (Merchant API)
- `ORDER_COMPLETED` — payment successful
- `ORDER_AUTHORISED` — payment authorised (pre-capture)
- `ORDER_PAYMENT_DECLINED` — payment failed
- `ORDER_CANCELLED` — order cancelled
- Signed with HMAC SHA-256 for verification
- Retries: 3 attempts, 10-minute intervals on failure

### API Security
- Secret API Key: server-side only (never expose in frontend)
- Revolut-Api-Version header required
- HMAC SHA-256 webhook signature verification
- Amounts in minor units (pence): £250.00 = 25000

---

## Recommendation for CoachFit

### Phase 1 (MVP): Payment Links via Merchant API
**Why**: Simplest integration, zero frontend changes needed, Revolut handles all PCI/3DS

1. **Setup**: Apply for Merchant account (sub-account of existing Business account)
2. **Integration**:
   - When client wants to buy credits → CoachFit creates an order via Merchant API
   - Returns `checkout_url` → client redirected to Revolut checkout
   - Webhook confirms payment → auto-approve `CreditSubmission`
3. **Effort**: ~1 day of backend work (webhook handler + order creation)
4. **Files needed**:
   - `lib/revolut.ts` — Revolut API client (create order, verify webhook)
   - `app/api/webhooks/revolut/route.ts` — webhook handler
   - Modify `app/api/credits/submit/route.ts` — add "pay now" flow that creates Revolut order

### Phase 2 (Enhancement): Embedded Checkout Widget
**Why**: Better UX, client stays in CoachFit app, all payment methods in one widget

1. Add `RevolutCheckout.js` to the credit purchase page
2. Create order server-side, pass public key to widget
3. Client pays within CoachFit UI
4. Same webhook flow for confirmation

### Alternative: Keep Manual + Business API Webhooks
If setting up the Merchant account is too much overhead initially:
- Keep the existing `CreditSubmission` with `revolutReference` flow
- Add Business API webhook for `TransactionCreated`
- Auto-match incoming Revolut transfers by reference number
- Auto-approve matching credit submissions

**Downside**: Only works for bank transfers (not card payments), requires clients to manually transfer and enter reference numbers.

---

## Integration with Existing Credit System

The Revolut Merchant API maps perfectly to the existing `CreditSubmission` model:

```
CreditSubmission.status: PENDING → client pays → webhook → APPROVED
CreditSubmission.revolutReference: → order_id from Revolut
```

New field needed on CreditSubmission:
```prisma
revolutOrderId    String?   // Revolut Merchant API order ID
revolutCheckoutUrl String?  // Checkout URL for client redirect
```

### Updated Payment Flow
1. Client selects credit product → clicks "Buy"
2. CoachFit creates `CreditSubmission` (PENDING) + Revolut order
3. Client redirected to Revolut checkout (or shown embedded widget)
4. Client pays
5. Revolut webhook → CoachFit auto-processes submission (APPROVED)
6. Credits added to client's account via ledger

### For Subscriptions (Monthly HIIT/CORE plans)
Revolut Merchant API supports recurring payments:
- Create a subscription via the API
- Revolut handles recurring charges
- Webhook on each successful charge → monthly credit topup

---

## Prerequisites
1. **Revolut Business account** — already have this ✅
2. **Merchant account** — apply within Revolut Business dashboard (sub-account)
3. **Grow plan or above** — check current plan
4. **API keys** — generated from Revolut Business → API settings
5. **Webhook endpoint** — HTTPS required (Vercel provides this automatically)

---

## Sources
- [Revolut Merchant API Docs](https://developer.revolut.com/docs/accept-payments)
- [Revolut Merchant API Reference](https://developer.revolut.com/docs/merchant/merchant-api)
- [Create an Order](https://developer.revolut.com/docs/merchant/create-order)
- [Hosted Checkout Page Guide](https://developer.revolut.com/docs/guides/accept-payments/online-payments/hosted-checkout-page/api)
- [Merchant Webhooks](https://developer.revolut.com/docs/merchant/webhooks)
- [Revolut Checkout Widget](https://developer.revolut.com/docs/guides/accept-payments/online-payments/revolut-checkout/web)
- [Revolut Business API](https://developer.revolut.com/docs/business/business-api)
- [Revolut Payment Gateway](https://www.revolut.com/business/payment-gateway/)
- [Revolut Pay](https://www.revolut.com/business/revolut-pay/)
- [Apply for Merchant Account](https://developer.revolut.com/docs/guides/accept-payments/get-started/apply-for-a-merchant-account)
