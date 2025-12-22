# HubSpot API Prototype Scripts

These scripts demonstrate key HubSpot API operations and validate our implementation approach.

## Prerequisites

```bash
# Ensure dependencies are installed
npm install

# Set up credentials
cp .env.example .env
# Edit .env and add your HUBSPOT_ACCESS_TOKEN
```

## Running Prototypes

```bash
# Test basic connection and credentials
npm run dev -- ./scripts/prototypes/test-connection.ts

# Test CRM Search API
npm run dev -- ./scripts/prototypes/test-search.ts

# Test batch operations
npm run dev -- ./scripts/prototypes/test-batch.ts

# Test rate limits (makes rapid requests)
npm run dev -- ./scripts/prototypes/test-rate-limits.ts
```

## What Each Script Tests

### test-connection.ts
- ✅ Validates HubSpot credentials
- ✅ Checks portal access
- ✅ Verifies required scopes (contacts, companies, properties)
- ✅ Displays rate limit information

**Run this first** to ensure your setup is correct.

### test-search.ts
- ✅ Demonstrates CRM Search API
- ✅ Shows filtering with various operators (HAS_PROPERTY, NOT_HAS_PROPERTY, GTE)
- ✅ Shows AND logic (multiple filters in one group)
- ✅ Shows OR logic (multiple filter groups)
- ✅ Demonstrates sorting

**Key insight:** Search is MUCH faster than fetching all records and filtering in memory.

### test-batch.ts
- ✅ Demonstrates batch read (fetch multiple records in 1 call)
- ✅ Shows batch update structure
- ✅ Demonstrates error handling (partial success)
- ✅ Shows performance benefits (100x faster than individual calls)

**Key insight:** Always use batch operations when working with multiple records.

### test-rate-limits.ts
- ✅ Empirically tests HubSpot's rate limits
- ✅ Observes rate limit headers
- ✅ Demonstrates interval-based limiting (100 per 10s)
- ✅ Shows how to extract rate limit info from responses

**Key insight:** Implement token bucket algorithm to stay under limits.

## Expected Output

Each script will output:
- ✅ Success indicators for each test
- 📊 Relevant statistics and data
- ℹ️  Implementation notes
- ❌ Error messages if something fails

## Integration with Epic 3

These prototypes inform the HubSpotService implementation:

1. **test-connection.ts** → Scope validation in service initialization
2. **test-search.ts** → Search API wrapper methods
3. **test-batch.ts** → Batch operation helpers
4. **test-rate-limits.ts** → Rate limiter implementation

## Troubleshooting

### Authentication Errors (401)
- Check that `HUBSPOT_ACCESS_TOKEN` is set in `.env`
- Verify token hasn't been revoked in HubSpot
- Ensure token starts with `pat-na1-` or similar

### Forbidden Errors (403)
- Your Private App is missing required scopes
- Add scopes in: HubSpot > Settings > Integrations > Private Apps
- Required scopes:
  - `crm.objects.contacts.read`
  - `crm.objects.companies.read`
  - `crm.schemas.contacts.read`

### Rate Limit Errors (429)
- This is expected in test-rate-limits.ts
- For other scripts, reduce request frequency
- Wait for Retry-After duration before retrying

## Next Steps

After running all prototypes successfully:

1. Review the output and confirm all operations work
2. Note any subscription tier limitations
3. Document any unexpected behavior
4. Use findings to implement HubSpotService (Epic 3)
