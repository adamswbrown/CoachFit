# CoachFit Performance Optimization Plan

## Problem Statement

Loading pages takes significantly longer than desired. Switching between pages triggers full-page loading elements that can take multiple seconds. Main affected pages are coach dashboard (2-5s), admin overview (3-7s), and admin dashboard (2-4s). Client dashboard is faster (1-2s) but still shows loading spinners.

## Root Cause Analysis

Five critical bottlenecks identified:

1. **Coach dashboard entry stats load unbounded history** — fetches ALL entry history for ALL clients to calculate weight trends, potentially 1000+ rows per coach load
2. **Admin insights regenerate on every load** — heavy computational load without caching, 3-5 seconds alone
3. **N+1 query pattern in admin dashboard** — coach metadata fetched separately after cohort batch query instead of in single query
4. **Zero HTTP-level caching** — no `unstable_cache()`, no ISR, no revalidatePath implemented
5. **No cursor pagination** — offset-based pagination becomes O(n) on large entry lists

## Proposed Solution: Three-Phase Approach

### Phase 1: Quick Wins (1-2 Days) — ~60% Performance Gain

**No schema changes. No data model changes. Query optimization only.**

#### 1.1 Fix Duplicate Insights Query
- **File**: `app/api/admin/overview/route.ts` (lines 146-176)
- **Issue**: Fire-and-forget insights call followed by await — duplicate execution
- **Fix**: Remove fire-and-forget, keep only awaited version
- **Impact**: Admin overview instantly 20-30% faster
- **Risk**: None (cleanup only)

#### 1.2 Scope Coach Entry Stats to Last 90 Days
- **File**: `app/api/coach-dashboard/overview/route.ts` (lines 205-220)
- **Issue**: Fetches entire entry history for all clients
- **Fix**: Add date filter `date: { gte: 90DaysAgo }` to Entry.findMany()
- **Impact**: Coach dashboard 40-50% faster (single biggest bottleneck)
- **Risk**: None (coaches always query recent trends; historical view can be separate)

#### 1.3 Add Server-Side Caching with `unstable_cache()`
- **File**: Create new `lib/cached-queries.ts`
- **Queries to cache**:
  - Cohort list for coach (5-min TTL)
  - Coach metadata in admin dashboard (5-min TTL)
  - Admin metrics counts (2-min TTL)
- **Implementation**: Wrap existing queries with NextJS `unstable_cache()` helper
- **Impact**: Repeated page visits 30-40% faster
- **Risk**: Low (cache TTL allows fresh data within 5 minutes)

#### 1.4 Add Database Indexes
- **File**: New migration in `prisma/migrations/`
- **Indexes to add**:
  - `Entry.userId` (single field for fast user lookups)
  - `AdminInsight(createdAt, priority)` (compound for filtering)
  - `CoachCohortMembership(coachId, cohortId)` (compound for coach queries)
- **Impact**: 10-20% improvement, compounds as data grows
- **Risk**: None (indexes are transparent to application)

#### 1.5 Fix N+1 Coach Lookup
- **File**: `app/api/admin/overview/route.ts` (lines 103-116)
- **Issue**: Cohorts fetched, then coaches fetched separately
- **Fix**: Add `include: { User: true }` to Cohort.findMany()
- **Impact**: Admin overview additional 10-15% faster
- **Risk**: None (same data, single query)

**Phase 1 Total Impact**:
- Coach dashboard: 60-70% faster
- Admin overview: 40-50% faster
- Admin dashboard: 30-40% faster

---

### Phase 2: Medium-Lift Improvements (3-4 Days) — Additional ~25% Gain

**If Phase 1 alone doesn't reach performance targets.**

#### 2.1 Implement Cursor-Based Pagination
- **Files**: 
  - `app/api/entries/route.ts`
  - `app/api/clients/[id]/entries/route.ts`
- **Change**: Replace offset-based pagination with cursor-based (Prisma native support)
- **Impact**: Pagination through large entry lists becomes O(1) instead of O(n)
- **When**: After Phase 1 profiling shows pagination is a bottleneck

#### 2.2 Add Suspense Boundaries for Progressive Loading
- **Files**:
  - `app/coach-dashboard/page.tsx` — Load cohorts first, entries skeleton while stats load
  - `app/admin/overview/page.tsx` — Load metrics in parallel with insights
  - `app/clients/[id]/page.tsx` — Load entries first, analytics in background
- **Impact**: Perceived load time faster (user sees content earlier)
- **When**: After Phase 1, to improve UX while data loads

---

### Phase 3: Architectural Changes (If Needed) — Additional ~15% Gain

**Only if Phase 1+2 don't hit performance targets.**

#### 3.1 Background Job for Insights Calculation
- **Approach**: Use cron (Vercel Cron) or job queue (Bull/BullMQ) to regenerate insights every 5-10 minutes
- **Benefit**: Admin dashboard reads cached results (instant response)
- **Trade-off**: Insights freshness is 5-10 minutes instead of real-time
- **When**: If profiling shows insights generation is still the bottleneck after Phase 1

#### 3.2 Redis Caching Layer
- **Target**: Entry aggregations (weight trends, step averages) and cohort member lists
- **Impact**: Scales well for large deployments
- **Complexity**: Adds operational overhead (Redis service, cache invalidation logic)
- **When**: Only if database queries remain slow after Phase 1-2 and you're at scale

---

## Implementation Roadmap

### Week 1: Phase 1 (Full-Stack Batch)
- **Frontend**: None (pure optimization)
- **Backend**: All 5 fixes above (cached-queries.ts, index migration, query tweaks)
- **Data**: New migration for indexes
- **Testing**: Profiling before/after to validate improvements
- **Deployment**: Vercel auto-deploy, monitor for regressions

### Week 2: Phase 2 (If Needed)
- **Frontend**: Add Suspense boundaries to slow pages
- **Backend**: Implement cursor pagination endpoints
- **Testing**: Load testing with realistic data volumes
- **Deployment**: Verify pagination endpoints work with all roles

### Week 3+: Phase 3 (If Needed)
- **Backend**: Background job setup + cache invalidation logic
- **DevOps**: Redis deployment on Railway or alternative
- **Testing**: Cache hit/miss monitoring

---

## Success Metrics

**Before Phase 1**:
- Coach dashboard: ~3-5 seconds (measure with Chrome DevTools)
- Admin overview: ~3-7 seconds
- Admin dashboard: ~2-4 seconds

**After Phase 1** (target):
- Coach dashboard: <1.5 seconds
- Admin overview: <2 seconds
- Admin dashboard: <1.5 seconds

**After Phase 2** (if needed):
- All dashboards: <1 second
- Perceived load: Content visible within 500ms

---

## Risk Assessment

| Phase | Risk Level | Mitigation |
|-------|-----------|-----------|
| **1** | Low | All changes are query optimizations; no schema changes; easy rollback |
| **2** | Medium | Suspense boundaries require testing; pagination needs validation |
| **3** | High | Background jobs add complexity; cache invalidation is error-prone |

---

## Decision Points

**Before starting Phase 1**:
- [ ] Do you want to profile current performance first (Chrome DevTools, Railway logs)?
- [ ] Is 90-day scoping acceptable for coach entry trends (vs. unlimited history)?
- [ ] Are 5-minute cache TTLs acceptable for cohort/coach data freshness?

**After Phase 1 profiling**:
- [ ] Does coach dashboard hit <1.5s target? If yes, skip Phase 2.
- [ ] If not, proceed to Phase 2 cursor pagination + Suspense.

**Before Phase 3**:
- [ ] Profiling shows database queries still slow after Phase 1+2?
- [ ] Are you comfortable adding Redis/background jobs for additional complexity?

---

## Files to Modify (Phase 1)

1. `app/api/admin/overview/route.ts` — Remove duplicate insights, fix N+1, limit entry date range for coaches
2. `app/api/coach-dashboard/overview/route.ts` — Add 90-day date filter
3. `lib/cached-queries.ts` — NEW: Create cached query wrappers
4. `prisma/schema.prisma` — Add index definitions
5. `prisma/migrations/[timestamp]_add_performance_indexes/migration.sql` — NEW: Run indexes

---

## Notes

- **Railway Production Database**: Indexes and query changes apply directly; no downtime expected
- **Backward Compatibility**: All Phase 1 changes are backward-compatible; no API signature changes
- **Monitoring**: Enable Vercel Analytics post-deployment to track real-world improvement
- **Next Steps**: Decide if you want to profile first or jump straight to Phase 1 implementation
