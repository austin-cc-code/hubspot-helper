# Epic 1: HubSpot API & MCP Research - Summary

**Status:** ✅ Complete
**Date:** 2025-12-21

## Objectives Achieved

1. ✅ Documented HubSpot API capabilities comprehensively
2. ✅ Researched and documented rate limits (100 per 10 seconds)
3. ✅ Designed security and credential storage strategy
4. ✅ Created API capability matrix
5. ✅ Created prototype scripts for key operations
6. ✅ Documented batch operations
7. ✅ Confirmed MCP decision (use `@hubspot/api-client` only)

## Deliverables

### Documentation

1. **`hubspot-api-research.md`** - Comprehensive API documentation including:
   - Authentication with Private Apps
   - Rate limits (100 requests per 10 seconds)
   - All CRM Objects APIs (Contacts, Companies, Deals)
   - Search API with operators and examples
   - Batch Operations (read/create/update/delete)
   - Properties API
   - Associations API
   - Lists management
   - Timeline & Engagement tracking
   - Marketing Contacts optimization
   - Workflows (limited Private App support)
   - Account & Subscription info
   - API Capability Matrix
   - Best practices summary

2. **`security-requirements.md`** - Security design including:
   - Credential management (environment variables, OS keychain future)
   - PII protection and masking
   - Data access controls
   - Audit logging
   - Rollback security
   - Network security
   - Threat model
   - GDPR/CCPA compliance considerations
   - Security testing approach
   - Incident response procedures

3. **`epic-1-summary.md`** - This document

### Prototype Scripts

Created in `scripts/prototypes/`:

1. **`test-connection.ts`**
   - Validates HubSpot credentials
   - Checks portal access
   - Verifies required scopes
   - Displays rate limit information

2. **`test-search.ts`**
   - Demonstrates CRM Search API
   - Shows various operators (HAS_PROPERTY, NOT_HAS_PROPERTY, GTE, etc.)
   - Demonstrates AND/OR logic
   - Shows sorting capabilities

3. **`test-batch.ts`**
   - Demonstrates batch read operations
   - Shows batch update structure
   - Demonstrates error handling (partial success)
   - Compares performance (100x faster than individual calls)

4. **`test-rate-limits.ts`**
   - Empirically tests rate limits
   - Observes rate limit headers
   - Demonstrates interval-based limiting

## Key Findings

### Authentication
- **Use Private Apps** for CLI tools (no OAuth complexity)
- Access tokens don't expire
- Store in `.env` file (gitignored)
- Required scopes documented

### Rate Limits
- **100 requests per 10 seconds** (standard tier)
- Rolling window, not fixed intervals
- Can burst all 100 immediately
- 429 responses include `Retry-After` header
- Batch operations count as 1 request (huge efficiency gain)

### API Capabilities
- **Search API** is much faster than fetch-all-and-filter
- **Batch operations** support up to 100 records per call
- **Merges are NOT reversible** - secondary record permanently deleted
- **Soft deletes** can be recovered within 90 days
- **Properties API** provides definitions and validation rules

### Security Requirements
- Automatic PII masking in all logs
- File permissions (0600) for sensitive data
- Confirmation required for all write operations
- Extra warnings for non-reversible operations (merges)
- 30-day retention for logs and rollback data
- Encryption at rest (Phase 2)

### MCP Decision (Confirmed)
- **Do NOT use HubSpot MCP Server**
- MCP is for LLM tool exposure, not programmatic CLI use
- `@hubspot/api-client` provides direct, efficient access
- No code savings from using MCP
- Safety comes from our code logic, not infrastructure

## Architecture Implications for Epic 3 (HubSpot Service)

Based on research findings, the HubSpot Service implementation should:

### 1. Rate Limiting
```typescript
class RateLimiter {
  private tokens = 100;
  private lastRefill = Date.now();
  private readonly WINDOW_MS = 10000;
  private readonly MAX_TOKENS = 100;

  async throttle(): Promise<void> {
    // Refill tokens based on time elapsed
    // Queue request if no tokens available
    // Implement exponential backoff on 429
  }
}
```

### 2. Batch Operations
```typescript
class HubSpotService {
  // Always use batch for multiple records
  async updateContacts(updates: ContactUpdate[]): Promise<void> {
    const chunks = chunk(updates, 100); // Max 100 per batch
    for (const chunk of chunks) {
      await this.client.crm.contacts.batchApi.update({ inputs: chunk });
      // Handle partial success
    }
  }
}
```

### 3. Search Over Fetch
```typescript
// GOOD: Use Search API
const stale = await this.client.crm.contacts.searchApi.doSearch({
  filterGroups: [{
    filters: [{
      propertyName: 'lastmodifieddate',
      operator: 'LT',
      value: oneYearAgo.toString()
    }]
  }]
});

// BAD: Don't fetch all and filter
const all = await this.client.crm.contacts.getAll(); // Slow!
const stale = all.filter(c => ...); // Memory intensive!
```

### 4. PII Protection
```typescript
import { safeLog } from '../utils/logger.js';

logger.info(safeLog({ contact }), 'Processing contact');
// Automatically redacts email, phone, name fields
```

### 5. Error Handling
```typescript
try {
  await operation();
} catch (error) {
  if (error.code === 401) {
    throw new AuthError('Invalid access token');
  } else if (error.code === 403) {
    throw new ScopeError('Missing required scope');
  } else if (error.code === 429) {
    const retryAfter = error.response.headers['retry-after'];
    await sleep((parseInt(retryAfter) * 1000) + jitter());
    return retry(operation);
  }
  throw error;
}
```

## Testing Plan

### Manual Testing (User)
1. Run `npx tsx scripts/prototypes/test-connection.ts`
2. Verify all scopes are accessible
3. Run other prototype scripts to test operations
4. Confirm rate limiting behavior

### Automated Testing (Epic 3)
1. Unit tests with mocked HubSpot client
2. Integration tests against test portal
3. Rate limiter tests
4. PII masking tests
5. Batch operation tests

## Next Steps (Epic 2: Configuration System)

With API research complete, we can now:

1. **Design config schema** with proper types (config.yaml)
2. **Implement ConfigManager** with validation
3. **Create `config init` wizard** to collect:
   - Company context (name, industry, business model)
   - ICP (ideal customer profile)
   - Data quality rules (required fields, stale thresholds)
   - Audit settings (batch size, rate limits, cache TTL)
4. **Support environment variable fallbacks** for API keys
5. **Validate credentials on startup**

## References

- [HubSpot API Documentation](https://developers.hubspot.com/docs/api/overview)
- [Private Apps Guide](https://developers.hubspot.com/docs/api/private-apps)
- [Rate Limits](https://developers.hubspot.com/docs/api/usage-details)
- [`@hubspot/api-client` SDK](https://github.com/HubSpot/hubspot-api-nodejs)
- [GDPR Compliance](https://www.hubspot.com/data-privacy/gdpr)

---

## Acceptance Criteria - All Met

- [x] All required API endpoints documented with rate limits
- [x] Security model designed and documented
- [x] Prototype scripts created (connection, search, batch, rate limits)
- [x] Credential storage strategy decided (environment variables)
- [x] Rate limiting strategy designed (token bucket algorithm)
- [x] MCP decision confirmed and documented
- [x] API capability matrix created
- [x] Research findings documented

**Epic 1 is complete and ready for Epic 2!**
