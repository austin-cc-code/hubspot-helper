# HubSpot API Research & Documentation

**Last Updated:** 2025-12-21
**API Version:** v3 (current)
**SDK:** `@hubspot/api-client` v12.0.1

## Table of Contents

1. [Authentication](#authentication)
2. [Rate Limits](#rate-limits)
3. [CRM Objects API](#crm-objects-api)
4. [Search API](#search-api)
5. [Batch Operations](#batch-operations)
6. [Properties API](#properties-api)
7. [Associations](#associations)
8. [Lists](#lists)
9. [Timeline & Engagement](#timeline--engagement)
10. [Marketing Contacts](#marketing-contacts)
11. [Workflows](#workflows)
12. [Account & Subscription Info](#account--subscription-info)

---

## Authentication

### Private Apps (Recommended)

**Why Private Apps over OAuth:**
- No token refresh needed (tokens don't expire)
- Simpler for CLI tools (no callback URL needed)
- Suitable for internal/personal tools
- Full control over scopes

**Creating a Private App:**
1. Navigate to: Settings → Integrations → Private Apps
2. Click "Create a private app"
3. Configure required scopes (see below)
4. Generate access token
5. Store token securely (never commit to git)

**Required Scopes for Audit Tool:**

```yaml
Contacts:
  - crm.objects.contacts.read
  - crm.objects.contacts.write

Companies:
  - crm.objects.companies.read
  - crm.objects.companies.write

Deals:
  - crm.objects.deals.read
  - crm.objects.deals.write

Properties:
  - crm.schemas.contacts.read
  - crm.schemas.companies.read
  - crm.schemas.deals.read

Lists:
  - crm.lists.read
  - crm.lists.write

Marketing:
  - settings.users.read (for portal info)
  - settings.users.write (for marketing status changes)

Timeline:
  - timeline (for engagement data)
```

**Token Usage:**

```typescript
import { Client } from '@hubspot/api-client';

const hubspotClient = new Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });
```

---

## Rate Limits

### Standard Limits

| Tier | Requests per 10 seconds | Daily Limit |
|------|------------------------|-------------|
| Free | 100 | 250,000 |
| Starter | 100 | 500,000 |
| Professional | 100 | 1,000,000 |
| Enterprise | 120-200* | 2,000,000+ |

*Enterprise limits vary by subscription

### Key Points

1. **Window-based:** 100 requests per rolling 10-second window
2. **Burst allowed:** Can send all 100 immediately, but must wait 10s for refill
3. **429 Response:** Returns `Retry-After` header (in seconds)
4. **Different endpoints:** Some endpoints (search, batch) have separate sub-limits
5. **Per-portal:** Limits are per HubSpot portal, not per app

### Rate Limit Headers

```http
X-HubSpot-RateLimit-Daily: 1000000
X-HubSpot-RateLimit-Daily-Remaining: 998547
X-HubSpot-RateLimit-Interval-Milliseconds: 10000
X-HubSpot-RateLimit-Max: 100
X-HubSpot-RateLimit-Remaining: 98
X-HubSpot-RateLimit-Secondly: 10
X-HubSpot-RateLimit-Secondly-Remaining: 9
```

### Handling Strategy

1. **Token Bucket Algorithm:**
   - Track 100 tokens per 10-second window
   - Consume 1 token per request
   - Refill to 100 every 10 seconds

2. **Exponential Backoff on 429:**
   - First retry: Wait `Retry-After` + jitter
   - Subsequent retries: Double wait time (max 60s)
   - Max 3 retries before failing

3. **Request Queuing:**
   - Queue requests when approaching limit
   - Process queue with rate limiting

---

## CRM Objects API

### Contacts

**Endpoints:**

```typescript
// Get all contacts (paginated)
GET /crm/v3/objects/contacts
const contacts = await client.crm.contacts.getAll(limit, after);

// Get single contact
GET /crm/v3/objects/contacts/{contactId}
const contact = await client.crm.contacts.getById(contactId, properties);

// Create contact
POST /crm/v3/objects/contacts
const contact = await client.crm.contacts.create({ properties });

// Update contact
PATCH /crm/v3/objects/contacts/{contactId}
const contact = await client.crm.contacts.update(contactId, { properties });

// Delete contact (soft delete)
DELETE /crm/v3/objects/contacts/{contactId}
await client.crm.contacts.archive(contactId);

// Merge contacts (NOT REVERSIBLE!)
POST /crm/v3/objects/contacts/merge
await client.crm.contacts.merge({ primaryObjectId, objectIdToMerge });
```

**Important Notes:**
- Default limit: 100 per page (max: 100)
- Pagination uses `after` cursor, not offset
- `properties` parameter: comma-separated list of properties to return
- Archived contacts can be restored within 90 days
- **Merges are permanent** - secondary contact is deleted forever

### Companies

Same structure as Contacts:

```typescript
await client.crm.companies.getAll(limit, after);
await client.crm.companies.getById(companyId, properties);
await client.crm.companies.create({ properties });
await client.crm.companies.update(companyId, { properties });
await client.crm.companies.archive(companyId);
await client.crm.companies.merge({ primaryObjectId, objectIdToMerge });
```

### Deals

```typescript
await client.crm.deals.getAll(limit, after);
await client.crm.deals.getById(dealId, properties);
await client.crm.deals.create({ properties });
await client.crm.deals.update(dealId, { properties });
await client.crm.deals.archive(dealId);
```

---

## Search API

**Much more efficient than fetching all records when filtering!**

### Basic Search

```typescript
POST /crm/v3/objects/contacts/search

const response = await client.crm.contacts.searchApi.doSearch({
  filterGroups: [
    {
      filters: [
        {
          propertyName: 'email',
          operator: 'HAS_PROPERTY', // or 'EQ', 'NEQ', 'CONTAINS', etc.
        },
        {
          propertyName: 'createdate',
          operator: 'GTE',
          value: '2024-01-01',
        }
      ]
    }
  ],
  properties: ['email', 'firstname', 'lastname'],
  limit: 100,
  after: 0, // For pagination
});
```

### Available Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `EQ` | Equals | `email = 'test@example.com'` |
| `NEQ` | Not equals | `email != 'test@example.com'` |
| `LT` | Less than | `createdate < '2024-01-01'` |
| `LTE` | Less than or equal | `createdate <= '2024-01-01'` |
| `GT` | Greater than | `createdate > '2024-01-01'` |
| `GTE` | Greater than or equal | `createdate >= '2024-01-01'` |
| `BETWEEN` | Between two values | `createdate BETWEEN '2024-01-01' AND '2024-12-31'` |
| `IN` | In list | `lifecycle IN ['lead', 'customer']` |
| `NOT_IN` | Not in list | `lifecycle NOT_IN ['subscriber']` |
| `HAS_PROPERTY` | Property has a value | `email HAS_PROPERTY` |
| `NOT_HAS_PROPERTY` | Property is empty | `phone NOT_HAS_PROPERTY` |
| `CONTAINS_TOKEN` | Contains word/token | `company CONTAINS_TOKEN 'tech'` |
| `NOT_CONTAINS_TOKEN` | Doesn't contain word | `company NOT_CONTAINS_TOKEN 'test'` |

### Search Limits

- Max 3 filter groups (OR logic between groups)
- Max 3 filters per group (AND logic within group)
- Max 10,000 results total
- For >10k results, use exports API or incremental sync

### Best Practices

1. **Use Search for filtered queries** - Don't fetch all contacts then filter in memory
2. **Request only needed properties** - Reduces response size and API load
3. **Use appropriate operators** - `HAS_PROPERTY` is faster than `NEQ null`
4. **Cache results** - Search can be expensive, cache when appropriate

---

## Batch Operations

### Batch Read

**More efficient than individual GETs:**

```typescript
POST /crm/v3/objects/contacts/batch/read

const response = await client.crm.contacts.batchApi.read({
  properties: ['email', 'firstname', 'lastname'],
  inputs: [
    { id: '12345' },
    { id: '67890' },
    // ... up to 100 IDs
  ]
});
```

**Limits:**
- Max 100 objects per batch
- 1 batch request = 1 API call (not 100!)

### Batch Create

```typescript
POST /crm/v3/objects/contacts/batch/create

const response = await client.crm.contacts.batchApi.create({
  inputs: [
    { properties: { email: 'test1@example.com', firstname: 'Test' } },
    { properties: { email: 'test2@example.com', firstname: 'Test' } },
    // ... up to 100 objects
  ]
});
```

### Batch Update

```typescript
POST /crm/v3/objects/contacts/batch/update

const response = await client.crm.contacts.batchApi.update({
  inputs: [
    { id: '12345', properties: { firstname: 'Updated' } },
    { id: '67890', properties: { firstname: 'Updated' } },
    // ... up to 100 objects
  ]
});
```

### Batch Archive (Delete)

```typescript
POST /crm/v3/objects/contacts/batch/archive

await client.crm.contacts.batchApi.archive({
  inputs: [
    { id: '12345' },
    { id: '67890' },
    // ... up to 100 IDs
  ]
});
```

### Error Handling

Batch operations are **partial success** - some can succeed while others fail:

```typescript
{
  status: 'COMPLETE',
  results: [...], // Successful operations
  errors: [       // Failed operations
    {
      status: 'error',
      category: 'VALIDATION_ERROR',
      message: 'Property "email" is required',
      context: { id: '12345' }
    }
  ]
}
```

**Strategy:**
1. Always check `errors` array
2. Retry failed items individually or in smaller batches
3. Log errors for user review

---

## Properties API

### Get Property Definitions

**Essential for validation and understanding data structure:**

```typescript
GET /crm/v3/properties/contacts

const properties = await client.crm.properties.coreApi.getAll('contacts');

// Response structure
{
  results: [
    {
      name: 'email',
      label: 'Email',
      type: 'string',
      fieldType: 'text',
      groupName: 'contactinformation',
      description: 'Contact email address',
      options: [], // For enumeration/select properties
      hidden: false,
      readOnlyValue: false,
      calculated: false,
      externalOptions: false
    },
    // ... more properties
  ]
}
```

### Property Types

| Type | Field Type | Description |
|------|-----------|-------------|
| `string` | `text` | Single-line text |
| `string` | `textarea` | Multi-line text |
| `enumeration` | `select`, `radio`, `checkbox` | Predefined options |
| `date` | `date` | Date (YYYY-MM-DD) |
| `datetime` | `date` | Timestamp (Unix milliseconds) |
| `number` | `number` | Numeric value |
| `bool` | `booleancheckbox` | True/false |
| `phone_number` | `phonenumber` | Phone number |

### Custom Properties

```typescript
POST /crm/v3/properties/contacts

await client.crm.properties.coreApi.create('contacts', {
  name: 'data_quality_score',
  label: 'Data Quality Score',
  type: 'number',
  fieldType: 'number',
  groupName: 'contactinformation',
  description: 'Automated data quality assessment (0-100)',
});
```

**Use Cases:**
- Store audit metadata (last_audit_date, quality_score)
- Flag issues for manual review
- Track data enrichment sources

---

## Associations

### Get Associations

**Example: Get companies associated with a contact:**

```typescript
GET /crm/v3/objects/contacts/{contactId}/associations/companies

const associations = await client.crm.contacts.associationsApi.getAll(
  contactId,
  'companies'
);

// Response
{
  results: [
    {
      id: '789012', // Company ID
      type: 'contact_to_company' // Association type
    }
  ]
}
```

### Create Association

```typescript
PUT /crm/v3/objects/contacts/{contactId}/associations/companies/{companyId}/{associationType}

await client.crm.contacts.associationsApi.create(
  contactId,
  companyId,
  [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 1 }] // 1 = contact_to_company
);
```

### Association Types

Common association type IDs:
- `1` - Contact to Company
- `2` - Company to Contact
- `3` - Deal to Contact
- `5` - Deal to Company
- `279` - Contact to Deal (primary)
- `280` - Company to Deal (primary)

**For custom associations:** Use the Associations Schema API to get type IDs

### Batch Associations

```typescript
POST /crm/v3/associations/contacts/companies/batch/create

await client.crm.associations.batchApi.create('contacts', 'companies', {
  inputs: [
    { from: { id: 'contactId1' }, to: { id: 'companyId1' }, type: 'contact_to_company' },
    { from: { id: 'contactId2' }, to: { id: 'companyId2' }, type: 'contact_to_company' },
    // ... up to 100 associations
  ]
});
```

---

## Lists

### Get All Lists

```typescript
GET /crm/v3/lists

const lists = await client.crm.lists.listsApi.getAll();

{
  lists: [
    {
      listId: '123',
      name: 'Active Customers',
      dynamic: true, // Dynamic (smart) list vs static
      size: 1245,
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-12-20T14:22:00Z',
      filters: [...] // For dynamic lists
    }
  ]
}
```

### Get List Members

```typescript
GET /crm/v3/lists/{listId}/memberships

const members = await client.crm.lists.membershipsApi.getAll(listId);

// Returns contact IDs
{
  results: [
    { recordId: '12345' },
    { recordId: '67890' }
  ]
}
```

### Add to List

```typescript
POST /crm/v3/lists/{listId}/memberships/add

await client.crm.lists.membershipsApi.add(listId, [
  { recordId: '12345' },
  { recordId: '67890' }
]);
```

### Remove from List

```typescript
POST /crm/v3/lists/{listId}/memberships/remove

await client.crm.lists.membershipsApi.remove(listId, [
  { recordId: '12345' },
  { recordId: '67890' }
]);
```

**Use Cases:**
- List hygiene audit: Find unused lists, overlapping members
- Remove bounced/unsubscribed from marketing lists
- Bulk list management

---

## Timeline & Engagement

### Engagement Events

**Get all engagement events for a contact:**

```typescript
GET /engagements/v1/engagements/associated/contact/{contactId}

// SDK usage (v1 API, different client structure)
const engagements = await hubspotClient.apiRequest({
  method: 'GET',
  path: `/engagements/v1/engagements/associated/contact/${contactId}`,
});
```

**Event Types:**
- `NOTE` - Notes added to record
- `EMAIL` - Email sent/received
- `CALL` - Call logged
- `MEETING` - Meeting logged
- `TASK` - Task created

### Email Events

**More specific email tracking:**

```typescript
GET /email/public/v1/events

// Query parameters
{
  startTimestamp: 1640995200000, // Unix ms
  endTimestamp: 1672531199000,
  limit: 1000,
  offset: 0
}
```

**Event Types:**
- `SENT` - Email sent
- `DELIVERED` - Successfully delivered
- `OPEN` - Email opened
- `CLICK` - Link clicked
- `BOUNCE` - Hard or soft bounce
- `SPAMREPORT` - Marked as spam

**Use Cases:**
- Identify inactive contacts (no opens in 12+ months)
- Find bounced emails for cleanup
- Calculate engagement scores

### Last Activity Date

```typescript
// Contact property: lastmodifieddate
// Or use engagement API to find most recent engagement

const lastEngagement = await getLastEngagement(contactId);
const daysSinceActivity = (Date.now() - lastEngagement.timestamp) / (1000 * 60 * 60 * 24);
```

---

## Marketing Contacts

### Marketing Status

**What is a Marketing Contact?**
- Contacts you can send marketing emails to
- Count against your subscription limit
- Non-marketing contacts are free but can't receive marketing emails

### Get Marketing Status

```typescript
// Contact property: hs_marketable_status
// Values: 'MARKETABLE' or 'NON_MARKETABLE'

const contact = await client.crm.contacts.getById(contactId, ['hs_marketable_status']);
```

### Set Marketing Status

```typescript
PATCH /crm/v3/objects/contacts/{contactId}

await client.crm.contacts.update(contactId, {
  properties: {
    hs_marketable_status: 'NON_MARKETABLE' // or 'MARKETABLE'
  }
});
```

### Batch Marketing Status Update

```typescript
await client.crm.contacts.batchApi.update({
  inputs: contacts.map(contact => ({
    id: contact.id,
    properties: { hs_marketable_status: 'NON_MARKETABLE' }
  }))
});
```

**Audit Use Cases:**
1. **Identify conversion candidates:**
   - Unsubscribed but still marked marketing
   - Hard bounced but still marketing
   - No engagement in 18+ months
   - Internal/test contacts

2. **Calculate savings:**
   - Marketing Hub Pro: ~$0.40/contact/month
   - Converting 1,000 contacts = $400/month savings

---

## Workflows

### List Workflows

```typescript
GET /automation/v4/workflows

// Note: Requires OAuth (not available for Private Apps)
// Alternative: Use Workflows API v3

const workflows = await hubspotClient.apiRequest({
  method: 'GET',
  path: '/automation/v3/workflows',
});
```

### Create Workflow (v3 API)

**Example: Standardize phone numbers on update**

```typescript
POST /automation/v3/workflows

{
  name: 'Standardize Phone Numbers',
  type: 'CONTACT_WORKFLOW',
  enabled: true,
  triggers: [
    {
      type: 'PROPERTY_CHANGE',
      propertyName: 'phone'
    }
  ],
  actions: [
    {
      type: 'FORMAT_PHONE',
      propertyName: 'phone',
      format: 'E164' // International format: +15551234567
    }
  ]
}
```

**Note:** Workflows API has limited Private App support. Some features require OAuth.

**Workaround for Prevention Automation:**
- Use webhooks + our CLI to monitor changes
- Scheduled audits to catch issues
- Document manual workflow creation steps

---

## Account & Subscription Info

### Get Portal Information

```typescript
GET /integrations/v1/me

const portalInfo = await hubspotClient.apiRequest({
  method: 'GET',
  path: '/integrations/v1/me',
});

{
  portalId: 12345678,
  timeZone: 'America/New_York',
  companyCurrency: 'USD',
  // ...
}
```

### Subscription Tier

**Not directly available via API**, but can infer from:
- Feature availability (workflows, custom properties, etc.)
- Rate limits in response headers
- Available hubs (Marketing, Sales, Service, CMS, Operations)

**For feature utilization audit:**
- Query available features
- Compare against tier documentation
- Identify unused paid features

---

## API Capability Matrix

| Feature | Endpoint Available | Batch Support | Search Support | Notes |
|---------|-------------------|---------------|----------------|-------|
| **Contacts** |
| Read | ✅ | ✅ | ✅ | Full support |
| Create | ✅ | ✅ | N/A | Batch up to 100 |
| Update | ✅ | ✅ | N/A | Batch up to 100 |
| Delete | ✅ | ✅ | N/A | Soft delete, 90-day recovery |
| Merge | ✅ | ❌ | N/A | NOT REVERSIBLE! |
| **Companies** |
| Read | ✅ | ✅ | ✅ | Full support |
| Create | ✅ | ✅ | N/A | Batch up to 100 |
| Update | ✅ | ✅ | N/A | Batch up to 100 |
| Delete | ✅ | ✅ | N/A | Soft delete, 90-day recovery |
| Merge | ✅ | ❌ | N/A | NOT REVERSIBLE! |
| **Deals** |
| Read | ✅ | ✅ | ✅ | Full support |
| Create | ✅ | ✅ | N/A | Batch up to 100 |
| Update | ✅ | ✅ | N/A | Batch up to 100 |
| Delete | ✅ | ✅ | N/A | Soft delete |
| **Properties** |
| List definitions | ✅ | N/A | N/A | All object types |
| Create custom | ✅ | N/A | N/A | Private App support |
| Update | ✅ | N/A | N/A | Limited |
| **Associations** |
| Read | ✅ | N/A | N/A | By object + type |
| Create | ✅ | ✅ | N/A | Batch up to 100 |
| Delete | ✅ | ✅ | N/A | Batch up to 100 |
| **Lists** |
| Read lists | ✅ | N/A | N/A | Dynamic & static |
| Read members | ✅ | N/A | N/A | Contact IDs only |
| Add members | ✅ | ✅ | N/A | Batch supported |
| Remove members | ✅ | ✅ | N/A | Batch supported |
| Create list | ✅ | N/A | N/A | Static lists only via API |
| **Timeline** |
| Engagements | ✅ | N/A | N/A | v1 API, per-contact |
| Email events | ✅ | N/A | ✅ | Query by date range |
| **Marketing** |
| Get status | ✅ | ✅ | ✅ | Via contact property |
| Set status | ✅ | ✅ | N/A | Batch supported |
| **Workflows** |
| List | ⚠️ | N/A | N/A | Limited Private App access |
| Create | ⚠️ | N/A | N/A | Requires OAuth for some types |

**Legend:**
- ✅ Full support
- ⚠️ Limited support or requires OAuth
- ❌ Not available
- N/A Not applicable

---

## Best Practices Summary

### 1. Authentication
- Use Private Apps for CLI tools
- Store tokens in `.env` (gitignored)
- Never log access tokens
- Request minimum required scopes

### 2. Rate Limiting
- Implement token bucket algorithm
- Queue requests when approaching limit
- Honor `Retry-After` on 429
- Use batch operations where possible

### 3. Data Fetching
- Use Search API for filtered queries (not getAll + filter)
- Request only needed properties
- Use batch read for multiple records
- Paginate with `after` cursor, not offset

### 4. Data Modification
- Use batch operations (up to 100x more efficient)
- Handle partial success in batch responses
- Capture original values before changes (for rollback)
- **Never merge without explicit confirmation** (irreversible!)

### 5. Performance
- Cache property definitions (change rarely)
- Cache portal info
- Use batch APIs to reduce request count
- Prefer Search over getAll when filtering

### 6. Security & Privacy
- Mask PII in all logs
- Store credentials securely
- Validate scopes before operations
- Use HTTPS only (SDK handles this)

---

## Next Steps for Epic 3 (HubSpot Service Implementation)

1. **Implement rate limiter** with token bucket
2. **Wrap SDK methods** with error handling and retries
3. **Add pagination helpers** for all list endpoints
4. **Implement caching layer** for properties and portal info
5. **Create batch operation wrappers** with partial success handling
6. **Add PII masking** to all log statements
7. **Write integration tests** against test portal

## References

- [HubSpot API Documentation](https://developers.hubspot.com/docs/api/overview)
- [CRM Objects API](https://developers.hubspot.com/docs/api/crm/understanding-the-crm)
- [Search API](https://developers.hubspot.com/docs/api/crm/search)
- [Rate Limits](https://developers.hubspot.com/docs/api/usage-details)
- [@hubspot/api-client SDK](https://github.com/HubSpot/hubspot-api-nodejs)
