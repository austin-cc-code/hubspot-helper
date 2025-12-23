# Integration Tests

Integration tests run against a real HubSpot portal and test the actual API interactions.

## Setup

1. Create a test HubSpot portal (or use a sandbox)
2. Create a Private App with the following scopes:
   - `crm.objects.contacts.read`
   - `crm.objects.contacts.write`
   - `crm.objects.companies.read`
   - `crm.objects.deals.read`
   - `crm.schemas.contacts.read`
   - `crm.schemas.companies.read`
   - `crm.schemas.deals.read`
   - `crm.lists.read`
3. Copy the access token

## Running Integration Tests

**Run all integration tests:**
```bash
HUBSPOT_ACCESS_TOKEN=your-token-here npm test -- integration
```

**Run specific integration test file:**
```bash
HUBSPOT_ACCESS_TOKEN=your-token-here npm test -- HubSpotService.integration.test.ts
```

**Run with coverage:**
```bash
HUBSPOT_ACCESS_TOKEN=your-token-here npm run test:coverage -- integration
```

## Important Notes

- Integration tests are **skipped by default** if `HUBSPOT_ACCESS_TOKEN` is not set
- Tests will create and delete test data in your HubSpot portal
- Test contacts are created with email addresses like `test-{timestamp}@example.com`
- Tests clean up after themselves, but if a test fails, orphaned data may remain
- **Never run integration tests against a production portal**

## Test Coverage

Current integration tests cover:
- Contact CRUD operations (create, read, update, delete)
- Contact search and batch operations
- Property fetching with caching
- Rate limiting and concurrent requests
- Error handling (404, etc.)

## Future Additions

- Company operations
- Deal operations
- Association management
- List operations
- Marketing contact status
- Batch updates with chunking
- Retry logic on 429 errors
