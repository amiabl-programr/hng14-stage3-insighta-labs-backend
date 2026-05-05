# Stage 4B Implementation - Optimization Solution

## 1. Optimization Approach

### Task 1: Query Performance Optimization
- **Database Indexes**: Added single-column indexes on `country_id`, `gender`, `age_group`, `created_at` and composite index on `[country_id, gender, age_group]` in `prisma/schema.prisma`
- **Connection Pooling**: Configured Prisma client with explicit connection settings for vertical scaling
- **Redis Caching**:
  - Query results cached with 5-minute TTL in `profile.model.ts`
  - External API responses (Genderize, Agify, Nationalize) cached with 24-hour TTL in `external.service.ts`

### Task 2: Query Normalization
- **Normalization Utility**: Created `src/utils/queryNormalizer.ts` that:
  - Sorts filter keys alphabetically for deterministic output
  - Standardizes values (gender → lowercase, country_id → uppercase)
  - Removes undefined/null/empty values
  - Produces consistent cache keys for same-intent queries

### Task 3: CSV Data Ingestion
- **Streaming Upload Endpoint**: `POST /api/profiles/upload` (admin only)
  - Uses `multer` for file upload middleware
  - Streams CSV with `fast-csv` (no full file in memory)
  - Processes in batches of 1000 rows using `Prisma.createMany`
  - Handles partial failures without rollback
  - Returns summary with `total_rows`, `inserted`, `skipped`, and `reasons`

---

## 2. Design Decisions & Trade-offs

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| Database indexes on 4 columns + composite | Reduces O(N) full table scans for 1M+ records | Slight write overhead (negligible for append-heavy workloads) |
| Redis for caching (not a new DB) | Read-heavy system; cache-only, not primary datastore | Requires Redis instance; adds infrastructure dependency |
| 5-minute TTL for queries | Balances freshness vs. performance | Recently updated data may be stale for up to 5 minutes |
| 24-hour TTL for external APIs | External APIs change infrequently | Rare API updates won't reflect for 24 hours |
| Streaming CSV (not full file load) | Handle 500k rows without memory issues | Slightly more complex implementation |
| Batch inserts (1000 rows) | Reduce DB round-trips | If batch fails, all 1000 rows in that batch fail |
| No rollback on partial failure | Continue processing remaining rows | Some rows may be lost if midway failure occurs |
| Query normalization before cache key | Same intent → same cache key | Minor CPU overhead for normalization (negligible) |

---

## 3. Before/After Comparison

*Metrics based on expected performance with 1M+ records, hundreds-thousands of queries/minute*

| Query Type | Before (no indexes/cache) | After (with indexes + cache) | Improvement |
|-----------|---------------------------|------------------------------|-------------|
| Filtered query (gender + country) | ~2000ms (full table scan) | ~50ms (index + cache hit) | ~97.5% |
| Unfiltered query with pagination | ~1500ms | ~200ms (with index) | ~86.7% |
| External API calls (per name) | ~300-500ms (network call) | ~5ms (cache hit) | ~98% |
| CSV upload (500k rows) | N/A (not supported) | ~5-10 minutes (streaming) | New feature |

*Note: Actual metrics depend on hardware, database size, and Redis instance location. Run tests with your dataset to populate exact numbers.*

---

## 4. Edge Case Handling

### Partial Failures (CSV Upload)
- **Row-level validation**: Each row validated independently
- **Skip conditions**:
  - Missing required fields (name, gender, age, country_id)
  - Invalid age (< 0 or non-numeric)
  - Unrecognized gender (not 'male' or 'female')
  - Duplicate names (within file or existing in DB)
- **No rollback**: Successfully inserted rows remain even if later batches fail
- **Summary report**: Response includes counts for each failure reason

### Concurrent Uploads
- Multiple admin users can upload simultaneously
- Each upload uses independent batch processing
- No table locking; Prisma handles concurrent inserts

### Malformed Rows
- CSV parsing errors handled by fast-csv error event
- Rows with extra columns: extra fields ignored
- Rows with missing columns: detected as missing fields, skipped
- Empty rows: skipped during streaming

### Cache Invalidation
- Cache keys based on normalized query
- 5-minute TTL ensures eventual consistency
- No manual invalidation needed (simple and effective for this use case)

---

## 5. Implementation Branches

| Branch | Description |
|--------|-------------|
| `feat/optimize-query-perf-cache` | Task 1: Database indexes, Redis caching, connection pool |
| `feat/query-normalization` | Task 2: Query normalization utility |
| `feat/streaming-csv-ingestion` | Task 3: CSV upload with streaming processing |

---

## 6. Testing Recommendations

1. **Index performance**: Run `EXPLAIN ANALYZE` on filtered queries before/after migration
2. **Cache effectiveness**: Hit same endpoint twice, check Redis for cache key
3. **CSV upload**: Test with:
   - Valid 500k-row file
   - File with duplicate names
   - File with invalid ages and genders
   - Empty/malformed CSV
4. **Concurrent uploads**: Upload two large files simultaneously
