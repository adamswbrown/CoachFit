# CoachFit External API Rate Limits & Capacity Planning

## External APIs

### 1. OpenFoodFacts (Barcode Lookup + Product Search)

| Detail | Value |
|--------|-------|
| **Used by** | iOS app, React Native app |
| **Endpoints** | `world.openfoodfacts.net/api/v2/product/{barcode}`, `world.openfoodfacts.org/cgi/search.pl` |
| **Auth** | None (public API) |
| **Rate Limit** | No formal limit — they ask for courtesy (few req/sec) |
| **Cost** | Free |
| **Calls per user action** | 1 per barcode scan, 1 per product search |

**Capacity:** Effectively unlimited for a coaching app. Even 1,000 users scanning 5 products/day = 5,000 calls/day, well within courtesy limits.

**Risk:** If they detect abuse they may block your IP/User-Agent. Add a `User-Agent` header identifying the app.

---

### 2. USDA FoodData Central (Ingredient Search)

| Detail | Value |
|--------|-------|
| **Used by** | iOS app |
| **Endpoint** | `api.nal.usda.gov/fdc/v1/foods/search` |
| **Auth** | API key (currently hardcoded — **move to config**) |
| **Rate Limit** | **1,000 requests/hour** per API key |
| **Cost** | Free |
| **Calls per user action** | 1 per ingredient search |

**Capacity at 1,000 req/hour:**

| Users | Searches/day each | Daily calls | Hourly peak (assume 3hr window) | Status |
|-------|-------------------|-------------|----------------------------------|--------|
| 10 | 5 | 50 | ~17/hr | OK |
| 50 | 5 | 250 | ~83/hr | OK |
| 100 | 5 | 500 | ~167/hr | OK |
| 200 | 5 | 1,000 | ~333/hr | OK |
| 500 | 5 | 2,500 | ~833/hr | CLOSE |
| 600+ | 5 | 3,000+ | ~1,000/hr | AT LIMIT |

**Mitigation:** Request a higher limit by contacting USDA (free). Or cache common ingredient searches locally.

**Action needed:** Replace hardcoded API key with a config/environment value. Get a production key and request higher limits when approaching 500 users.

---

### 3. FatSecret (Restaurant Search)

| Detail | Value |
|--------|-------|
| **Used by** | iOS app |
| **Endpoint** | `platform.fatsecret.com/rest/server.api` |
| **Auth** | OAuth 1.0 (consumer key + secret — **currently hardcoded**) |
| **Rate Limit (Basic Free)** | **5,000 requests/day** |
| **Rate Limit (Premier Free)** | Unlimited (requires application approval) |
| **Cost** | Free (Basic), Free (Premier — for startups/students) |
| **Calls per user action** | 1 per restaurant search |

**Capacity at 5,000 req/day:**

| Users | Searches/day each | Daily calls | Status |
|-------|-------------------|-------------|--------|
| 10 | 3 | 30 | OK |
| 50 | 3 | 150 | OK |
| 100 | 3 | 300 | OK |
| 500 | 3 | 1,500 | OK |
| 1,000 | 3 | 3,000 | OK |
| 1,500 | 3 | 4,500 | CLOSE |
| 1,700+ | 3 | 5,100 | AT LIMIT |

**Mitigation:** Apply for Premier Free tier (unlimited calls). Or upgrade to Premier ($3/month for 10,000 calls/day).

**Action needed:** Replace hardcoded credentials. Apply for Premier Free if scaling beyond 1,000 users. Attribution required on free tiers (show "Powered by FatSecret" somewhere).

---

### 4. Clerk (Authentication)

| Detail | Value |
|--------|-------|
| **Used by** | Web app (server-side), iOS app (SDK) |
| **Auth** | Publishable key + Secret key (in .env.local) |
| **Rate Limit** | Managed by Clerk — generous for typical usage |
| **Cost** | Free up to 10,000 MAU, then $0.02/MAU |
| **Calls per user action** | 1 per sign-in, 1 webhook per user creation |

**Capacity:**

| Users (MAU) | Cost/month |
|-------------|------------|
| 0-10,000 | Free |
| 10,001-50,000 | $0.02/MAU ($200-$1,000) |

**No rate limit concern** — Clerk handles this. Cost is the scaling factor.

---

### 5. Resend (Email)

| Detail | Value |
|--------|-------|
| **Used by** | Web backend only |
| **Auth** | API key (in .env.local) |
| **Rate Limit** | Free tier: **100 emails/day**, **3,000 emails/month** |
| **Cost** | Free up to 3,000/month, then $20/month for 50,000 |
| **Calls per user action** | 1 per invitation, 1 per welcome email, 1 per questionnaire reminder |

**Capacity at 100 emails/day:**

| Users | Emails/day (invites + reminders) | Status |
|-------|----------------------------------|--------|
| 10 | ~2-5 | OK |
| 50 | ~10-20 | OK |
| 100 | ~20-50 | CLOSE |
| 100+ | 50+ | AT LIMIT (upgrade to paid) |

**Mitigation:** Upgrade to Pro ($20/month) at ~50 active users. Email is bursty — most emails happen during onboarding.

---

## Internal API (CoachFit Backend)

### Self-Imposed Rate Limits

| Preset | Limit | Window |
|--------|-------|--------|
| Login | 5 | 1 minute |
| Signup | 3 | 1 minute |
| Password change | 3 | 1 hour |
| Invitations | 20 | 1 hour |
| Ingest (mobile sync) | 100 | 1 minute |
| Pairing | 10 | 15 minutes |
| General API | 100 | 1 minute |
| Admin | 60 | 1 minute |

**Ingest capacity (100 req/min):** Each user's background sync sends ~4 concurrent requests (workouts, sleep, steps, profile). At 100 req/min, that supports **25 users syncing simultaneously** — fine since syncs are staggered across 6-hour windows.

---

## Scaling Summary

### Safe at 100 users (current target)

| Service | Daily calls (est.) | Limit | Headroom |
|---------|-------------------|-------|----------|
| OpenFoodFacts | 500 | Unlimited | Plenty |
| USDA | 500 | 24,000/day | 48x |
| FatSecret | 300 | 5,000/day | 17x |
| Clerk | 100 MAU | 10,000 MAU | 100x |
| Resend | 50/day | 100/day | 2x (upgrade soon) |

### Actions needed before 500 users

1. **Resend** — Upgrade to Pro ($20/month) for 50,000 emails/month
2. **USDA** — Request higher rate limit (free, just email them)
3. **FatSecret** — Apply for Premier Free tier (unlimited)
4. **API keys** — Move USDA key and FatSecret credentials out of source code into secure config

### Actions needed before 1,000 users

1. **FatSecret** — Confirm Premier Free approved, or upgrade to paid ($3/month)
2. **Ingest rate limit** — Consider increasing from 100/min if sync congestion appears
3. **Clerk** — Still free (under 10,000 MAU)
4. **Caching** — Consider caching popular food/ingredient searches to reduce API calls

### Actions needed before 10,000 users

1. **Clerk** — Moves to paid (~$200/month at 10K MAU)
2. **USDA** — Likely need dedicated API key with custom limits
3. **OpenFoodFacts** — Consider self-hosting a mirror of the database
4. **FatSecret** — Upgrade to Professional tier
5. **Resend** — Upgrade to Business tier ($80/month for 200K emails)

---

## Security Notes

**Keys currently hardcoded in source (fix before public release):**
- USDA API key in `BarcodeService.swift` line 114
- FatSecret consumer key/secret in `BarcodeService.swift` lines 209-210

**Properly stored in .env.local:**
- Clerk keys
- Resend API key

**No key needed:**
- OpenFoodFacts (public API)
